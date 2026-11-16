-- Android client (Godot): cloud saves, content releases and client gating, managed from /admin.
-- Idempotent. The Android game is a local PvE simulation: these tables hold what the device sends, they never grant anything.
BEGIN;
CREATE SCHEMA IF NOT EXISTS godot_android;
REVOKE ALL ON SCHEMA godot_android FROM PUBLIC;

CREATE TABLE IF NOT EXISTS godot_android.schema_version (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- One row per account and slot. `revision` counts every accepted write; a client must name the revision it started from.
CREATE TABLE IF NOT EXISTS godot_android.saves (
  account_id uuid NOT NULL,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 3),
  revision bigint NOT NULL CHECK (revision > 0),
  data jsonb NOT NULL CHECK (jsonb_typeof(data) = 'object'),
  race text NOT NULL,
  land text NOT NULL,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 20),
  client_code integer NOT NULL DEFAULT 0,
  content_version text,
  bytes integer NOT NULL CHECK (bytes BETWEEN 2 AND 1048576),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, slot)
);
CREATE INDEX IF NOT EXISTS saves_updated ON godot_android.saves (updated_at DESC);

-- Content releases: a manifest of packs that exist on the server's content volume.
CREATE TABLE IF NOT EXISTS godot_android.releases (
  version text PRIMARY KEY CHECK (version ~ '^[0-9A-Za-z][0-9A-Za-z._-]{0,39}$'),
  manifest jsonb NOT NULL CHECK (jsonb_typeof(manifest) = 'object'),
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Single settings row: which release clients get, the oldest client allowed to play, maintenance switch, news line.
CREATE TABLE IF NOT EXISTS godot_android.settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  active_version text REFERENCES godot_android.releases(version),
  min_client_code integer NOT NULL DEFAULT 1 CHECK (min_client_code >= 0),
  maintenance boolean NOT NULL DEFAULT false,
  maintenance_message text CHECK (maintenance_message IS NULL OR char_length(maintenance_message) <= 300),
  news text CHECK (news IS NULL OR char_length(news) <= 300),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO godot_android.settings (id) VALUES (1) ON CONFLICT DO NOTHING;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ki_game_server') THEN
    GRANT USAGE ON SCHEMA godot_android TO ki_game_server;
    GRANT SELECT, INSERT, UPDATE, DELETE ON godot_android.saves, godot_android.releases, godot_android.settings TO ki_game_server;
    GRANT SELECT ON godot_android.schema_version TO ki_game_server;
  END IF;
END $$;

INSERT INTO godot_android.schema_version (version) VALUES (1) ON CONFLICT DO NOTHING;
COMMIT;
