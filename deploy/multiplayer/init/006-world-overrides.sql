-- World edits made in /admin, stored on the VPS and applied live by the game server.
-- Idempotent. Every publication is kept in world_admin.revisions for review and rollback.
BEGIN;
CREATE SCHEMA IF NOT EXISTS world_admin;
REVOKE ALL ON SCHEMA world_admin FROM PUBLIC;

CREATE TABLE IF NOT EXISTS world_admin.schema_version (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_admin.revisions (
  revision integer PRIMARY KEY CHECK (revision > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  published_by uuid,
  published_at timestamptz NOT NULL DEFAULT now(),
  note text CHECK (note IS NULL OR char_length(note) <= 200)
);
CREATE INDEX IF NOT EXISTS revisions_at ON world_admin.revisions (published_at DESC);

GRANT USAGE ON SCHEMA world_admin TO ki_game_server;
GRANT SELECT, INSERT ON world_admin.revisions TO ki_game_server;
GRANT SELECT ON world_admin.schema_version TO ki_game_server;

INSERT INTO world_admin.schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
