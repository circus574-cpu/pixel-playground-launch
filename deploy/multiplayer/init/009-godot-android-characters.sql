-- Authoritative Android game characters: level, XP, gold, bank, backpack, equipment, talents and quests are computed and persisted exclusively on the server.
-- Idempotent. Apply before or alongside the server release exposing /ws/godot/characters/*.
BEGIN;

CREATE TABLE IF NOT EXISTS godot_android.characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 3 AND 16),
  race text NOT NULL CHECK (race IN ('legend', 'planetary', 'sage', 'android')),
  land text NOT NULL CHECK (land IN ('pyra', 'verdant', 'aether', 'nexus')),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  gold integer NOT NULL DEFAULT 120 CHECK (gold >= 0),
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0),
  state jsonb NOT NULL CHECK (jsonb_typeof(state) = 'object'),
  browser_character_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS android_chars_account
  ON godot_android.characters (account_id, updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS android_chars_name_ci
  ON godot_android.characters (lower(name));
CREATE UNIQUE INDEX IF NOT EXISTS android_chars_browser_link
  ON godot_android.characters (account_id, browser_character_id)
  WHERE browser_character_id IS NOT NULL;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ki_game_server') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON godot_android.characters TO ki_game_server;
  END IF;
END $$;

INSERT INTO godot_android.schema_version (version) VALUES (3) ON CONFLICT DO NOTHING;
COMMIT;
