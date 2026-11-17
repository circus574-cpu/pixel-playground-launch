-- Cloud saves of the Android game: one slot per character. The first release allowed slots 1..3 (a player still has three);
-- an administrator is not limited (the server enforces the limit per role), so the column only has to stay a positive smallint.
-- Idempotent. Apply BEFORE the server that lets administrators write slots above 3 is deployed.
BEGIN;
ALTER TABLE godot_android.saves DROP CONSTRAINT IF EXISTS saves_slot_check;
ALTER TABLE godot_android.saves ADD CONSTRAINT saves_slot_check CHECK (slot >= 1);
INSERT INTO godot_android.schema_version (version) VALUES (2) ON CONFLICT DO NOTHING;
COMMIT;
