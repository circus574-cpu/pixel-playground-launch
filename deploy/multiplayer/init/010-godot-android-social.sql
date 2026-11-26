-- Persistent social graph for the Android game: mutual friendships (with pending requests) and guilds/clans with unique short tags.
-- Idempotent. Apply before or alongside the server release exposing Stage 2 social features.
BEGIN;

CREATE TABLE IF NOT EXISTS godot_android.friendships (
  account_a uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  account_b uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'accepted')),
  requested_by uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_a, account_b),
  CHECK (account_a < account_b),
  CHECK (requested_by = account_a OR requested_by = account_b)
);

CREATE INDEX IF NOT EXISTS android_friendships_b_status
  ON godot_android.friendships (account_b, status);

CREATE TABLE IF NOT EXISTS godot_android.guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 24),
  tag text NOT NULL CHECK (char_length(tag) BETWEEN 2 AND 5 AND tag ~ '^[A-Z0-9]+$'),
  leader_account_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS android_guilds_name_ci
  ON godot_android.guilds (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS android_guilds_tag_ci
  ON godot_android.guilds (lower(tag));

CREATE TABLE IF NOT EXISTS godot_android.guild_members (
  account_id uuid PRIMARY KEY REFERENCES accounts.users(id) ON DELETE CASCADE,
  guild_id uuid NOT NULL REFERENCES godot_android.guilds(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'officer', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS android_guild_members_guild
  ON godot_android.guild_members (guild_id, joined_at);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ki_game_server') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON godot_android.friendships TO ki_game_server;
    GRANT SELECT, INSERT, UPDATE, DELETE ON godot_android.guilds TO ki_game_server;
    GRANT SELECT, INSERT, UPDATE, DELETE ON godot_android.guild_members TO ki_game_server;
  END IF;
END $$;

INSERT INTO godot_android.schema_version (version) VALUES (4) ON CONFLICT DO NOTHING;
COMMIT;
