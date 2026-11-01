BEGIN;
ALTER TABLE game.online_character_state ADD COLUMN IF NOT EXISTS lease_id uuid;
ALTER TABLE game.online_character_state ADD COLUMN IF NOT EXISTS lease_until timestamptz;
COMMIT;
