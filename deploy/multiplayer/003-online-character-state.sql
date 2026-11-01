-- Explicit upgrade, not an init script for an already existing database volume.
-- Server-private checkpoints. Does not replace, delete or import existing test/local saves.
BEGIN;
CREATE TABLE IF NOT EXISTS game.online_character_state (
 character_id uuid PRIMARY KEY REFERENCES game.characters(id),
 revision bigint NOT NULL CHECK(revision>0),
 state jsonb NOT NULL CHECK(jsonb_typeof(state)='object' AND state->>'format'='server-character-1'),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(octet_length(state::text)<=4000000)
);
CREATE TABLE IF NOT EXISTS game.online_character_operations (
 character_id uuid NOT NULL REFERENCES game.characters(id),
 operation_id uuid NOT NULL,
 command_digest text NOT NULL CHECK(command_digest ~ '^[a-f0-9]{64}$'),
 result_revision bigint NOT NULL CHECK(result_revision>0),
 committed_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(character_id,operation_id)
);
REVOKE ALL ON game.online_character_state,game.online_character_operations FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON game.online_character_state TO ki_game_server;
GRANT SELECT,INSERT ON game.online_character_operations TO ki_game_server;
GRANT SELECT ON game.online_character_state,game.online_character_operations TO ki_game_readonly;
COMMIT;
