-- Player accounts on the VPS (replaces the external account authority).
-- Idempotent: safe to run again. Version tracked in accounts.schema_version, not game.schema_version.
BEGIN;
CREATE SCHEMA IF NOT EXISTS accounts;
REVOKE ALL ON SCHEMA accounts FROM PUBLIC;

CREATE TABLE IF NOT EXISTS accounts.schema_version (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- Same UUID as the previous account authority for migrated players, so their characters
-- (game.*.auth_subject) stay linked without rewriting game data.
CREATE TABLE IF NOT EXISTS accounts.users (
  id uuid PRIMARY KEY,
  email text NOT NULL,
  nick text NOT NULL CHECK (char_length(nick) BETWEEN 3 AND 20),
  password_hash text NOT NULL,
  email_confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz,
  migrated_from text,
  disabled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON accounts.users (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_nick_key ON accounts.users (lower(nick));

CREATE TABLE IF NOT EXISTS accounts.roles (
  user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'gm')),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role)
);

-- One-time links (activation, password reset). Only SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS accounts.email_tokens (
  token_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('confirm', 'reset')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);
CREATE INDEX IF NOT EXISTS email_tokens_user ON accounts.email_tokens (user_id, purpose);

-- Long-lived sessions. Only SHA-256 of the refresh token is stored.
CREATE TABLE IF NOT EXISTS accounts.sessions (
  token_hash bytea PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  user_agent text
);
CREATE INDEX IF NOT EXISTS sessions_user ON accounts.sessions (user_id);

CREATE TABLE IF NOT EXISTS accounts.audit (
  id bigserial PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  actor uuid,
  action text NOT NULL,
  target uuid,
  details jsonb
);
CREATE INDEX IF NOT EXISTS audit_at ON accounts.audit (at DESC);

GRANT USAGE ON SCHEMA accounts TO ki_game_server;
GRANT SELECT, INSERT, UPDATE ON accounts.users, accounts.email_tokens, accounts.sessions
  TO ki_game_server;
GRANT SELECT, INSERT, DELETE ON accounts.roles TO ki_game_server;
GRANT SELECT, INSERT ON accounts.audit TO ki_game_server;
GRANT USAGE ON SEQUENCE accounts.audit_id_seq TO ki_game_server;
GRANT SELECT ON accounts.schema_version TO ki_game_server;

INSERT INTO accounts.schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
