-- Persistence only. No client can connect, and no existing save is imported here.
BEGIN;
CREATE SCHEMA game;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON DATABASE ki_multiplayer FROM PUBLIC;
CREATE ROLE ki_game_server NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
CREATE ROLE ki_game_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;
GRANT CONNECT ON DATABASE ki_multiplayer TO ki_game_server,ki_game_readonly;
GRANT USAGE ON SCHEMA game TO ki_game_server,ki_game_readonly;
CREATE TABLE game.schema_version(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO game.schema_version VALUES(1,now());
CREATE TABLE game.accounts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 auth_project text NOT NULL,
 auth_subject uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(auth_project,auth_subject)
);
CREATE TABLE game.characters(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 account_id uuid NOT NULL REFERENCES game.accounts(id),
 race text NOT NULL CHECK(race IN ('planetary','sage','android','legend')),
 created_at timestamptz NOT NULL DEFAULT now(),
 retired_at timestamptz
);
CREATE INDEX characters_account ON game.characters(account_id);
CREATE TABLE game.character_snapshots(
 character_id uuid PRIMARY KEY REFERENCES game.characters(id),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0),
 world_id text NOT NULL CHECK(world_id IN ('verdant','aether','nexus','pyra')),
 x double precision NOT NULL CHECK(x>=0 AND x<'Infinity'::float8),
 y double precision NOT NULL CHECK(y>=0 AND y<'Infinity'::float8),
 state jsonb NOT NULL CHECK(jsonb_typeof(state)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE game.inventory_instances(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 character_id uuid NOT NULL REFERENCES game.characters(id),
 item_definition text NOT NULL,
 quantity integer NOT NULL CHECK(quantity>0),
 attributes jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(attributes)='object'),
 revision bigint NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE INDEX inventory_character ON game.inventory_instances(character_id);
CREATE TABLE game.operations(
 id uuid PRIMARY KEY,
 character_id uuid NOT NULL REFERENCES game.characters(id),
 kind text NOT NULL,
 result jsonb NOT NULL CHECK(jsonb_typeof(result)='object'),
 committed_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operations_character_time ON game.operations(character_id,committed_at);
CREATE TABLE game.outbox(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 operation_id uuid NOT NULL REFERENCES game.operations(id),
 event_type text NOT NULL,
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 delivered_at timestamptz
);
CREATE INDEX outbox_pending ON game.outbox(id) WHERE delivered_at IS NULL;
GRANT SELECT,INSERT ON game.accounts TO ki_game_server;
GRANT SELECT,INSERT,UPDATE ON game.characters,game.character_snapshots,game.inventory_instances TO ki_game_server;
GRANT DELETE ON game.inventory_instances TO ki_game_server;
GRANT SELECT,INSERT ON game.operations TO ki_game_server;
GRANT SELECT,INSERT,UPDATE ON game.outbox TO ki_game_server;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA game TO ki_game_server;
GRANT SELECT ON ALL TABLES IN SCHEMA game TO ki_game_readonly;
COMMIT;
