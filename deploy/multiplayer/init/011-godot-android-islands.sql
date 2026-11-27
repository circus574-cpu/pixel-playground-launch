-- Expand godot_android.characters.land CHECK constraint to include the 6 Archipelago Islands (island-1..6).
-- Idempotent. Apply before or alongside the Stage 4 server release.
BEGIN;

ALTER TABLE godot_android.characters
  DROP CONSTRAINT IF EXISTS characters_land_check;

ALTER TABLE godot_android.characters
  ADD CONSTRAINT characters_land_check CHECK (
    land IN (
      'pyra', 'verdant', 'aether', 'nexus',
      'island-1', 'island-2', 'island-3', 'island-4', 'island-5', 'island-6'
    )
  );

INSERT INTO godot_android.schema_version (version) VALUES (5) ON CONFLICT DO NOTHING;
COMMIT;
