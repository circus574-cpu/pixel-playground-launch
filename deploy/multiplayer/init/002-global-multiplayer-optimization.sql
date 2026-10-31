-- Global Multiplayer Optimization (Schema v2):
-- 1. UNLOGGED hot-path tables (active_sessions, server_nodes) with fillfactor=70 for HOT (Heap-Only Tuple)
--    in-memory speed updates without WAL fsync stalls or ping spikes during 20 Hz server ticks.
-- 2. Spatial Hash Grid AOI (512x512 cells) with covering Index-Only Scan (INCLUDE) so nearby-player
--    queries never touch the heap.
-- 3. Single-roundtrip batch RPCs (batch_sync_positions, query_aoi, record_node_heartbeat, append_server_log)
--    eliminating N+1 network roundtrips from authoritative game nodes.
-- 4. Time-series server metrics & structured server logs indexed with BRIN for minimal write amplification.

BEGIN;

INSERT INTO game.schema_version(version, applied_at)
VALUES (2, now())
ON CONFLICT (version) DO NOTHING;

-- Expand world_id check on character_snapshots to cover all 10 Superior features (4 continents + 6 islands)
ALTER TABLE game.character_snapshots
  DROP CONSTRAINT IF EXISTS character_snapshots_world_id_check;
ALTER TABLE game.character_snapshots
  ADD CONSTRAINT character_snapshots_world_id_check
  CHECK (world_id IN (
    'verdant', 'aether', 'nexus', 'pyra',
    'island-1', 'island-2', 'island-3', 'island-4', 'island-5', 'island-6'
  ));

-- 1. Live Server Nodes / Shards Telemetry (UNLOGGED + fillfactor=70 for zero-WAL HOT updates)
CREATE UNLOGGED TABLE IF NOT EXISTS game.server_nodes (
  node_id text PRIMARY KEY CHECK (char_length(node_id) BETWEEN 2 AND 64),
  name text NOT NULL DEFAULT 'Węzeł Gry' CHECK (char_length(name) BETWEEN 2 AND 128),
  region text NOT NULL CHECK (char_length(region) BETWEEN 2 AND 32),
  host text NOT NULL DEFAULT '127.0.0.1',
  port integer NOT NULL DEFAULT 7420 CHECK (port BETWEEN 1024 AND 65535),
  max_players integer NOT NULL DEFAULT 200 CHECK (max_players > 0),
  status text NOT NULL DEFAULT 'online' CHECK (status IN ('online', 'degraded', 'draining', 'offline', 'starting', 'stopping')),
  cpu_percent real NOT NULL DEFAULT 0 CHECK (cpu_percent >= 0 AND cpu_percent <= 100),
  mem_used_mb integer NOT NULL DEFAULT 0 CHECK (mem_used_mb >= 0),
  mem_total_mb integer NOT NULL DEFAULT 1024 CHECK (mem_total_mb > 0),
  load_avg_1m real NOT NULL DEFAULT 0 CHECK (load_avg_1m >= 0),
  tick_rate_hz real NOT NULL DEFAULT 20 CHECK (tick_rate_hz >= 0 AND tick_rate_hz <= 240),
  tick_p50_ms real NOT NULL DEFAULT 0 CHECK (tick_p50_ms >= 0),
  tick_p95_ms real NOT NULL DEFAULT 0 CHECK (tick_p95_ms >= 0),
  tick_p99_ms real NOT NULL DEFAULT 0 CHECK (tick_p99_ms >= 0),
  avg_ping_ms real NOT NULL DEFAULT 0 CHECK (avg_ping_ms >= 0),
  p95_ping_ms real NOT NULL DEFAULT 0 CHECK (p95_ping_ms >= 0),
  active_players integer NOT NULL DEFAULT 0 CHECK (active_players >= 0),
  active_entities integer NOT NULL DEFAULT 0 CHECK (active_entities >= 0),
  packets_in_sec integer NOT NULL DEFAULT 0 CHECK (packets_in_sec >= 0),
  packets_out_sec integer NOT NULL DEFAULT 0 CHECK (packets_out_sec >= 0),
  bandwidth_in_kbps real NOT NULL DEFAULT 0 CHECK (bandwidth_in_kbps >= 0),
  bandwidth_out_kbps real NOT NULL DEFAULT 0 CHECK (bandwidth_out_kbps >= 0),
  db_pool_active integer NOT NULL DEFAULT 0 CHECK (db_pool_active >= 0),
  db_pool_idle integer NOT NULL DEFAULT 0 CHECK (db_pool_idle >= 0),
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
) WITH (fillfactor = 70);

-- 2. Live Active Player Sessions & Spatial Grid State (UNLOGGED + fillfactor=70)
-- cell_x / cell_y represent 512x512 world-unit spatial buckets for O(1) AOI neighbor lookups.
CREATE UNLOGGED TABLE IF NOT EXISTS game.active_sessions (
  character_id uuid PRIMARY KEY REFERENCES game.characters(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES game.accounts(id) ON DELETE CASCADE,
  nick text NOT NULL CHECK (char_length(nick) BETWEEN 1 AND 32),
  race text NOT NULL CHECK (race IN ('planetary', 'sage', 'android', 'legend')),
  level integer NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 100),
  node_id text NOT NULL REFERENCES game.server_nodes(node_id) ON DELETE CASCADE,
  region text NOT NULL DEFAULT 'eu-central',
  world_id text NOT NULL CHECK (world_id IN (
    'verdant', 'aether', 'nexus', 'pyra',
    'island-1', 'island-2', 'island-3', 'island-4', 'island-5', 'island-6'
  )),
  town text,
  in_safe_zone boolean NOT NULL DEFAULT false,
  combat_state text NOT NULL DEFAULT 'idle' CHECK (combat_state IN ('idle', 'exploring', 'combat', 'safe', 'interior', 'dead')),
  x double precision NOT NULL CHECK (x >= 0 AND x < 'Infinity'::float8),
  y double precision NOT NULL CHECK (y >= 0 AND y < 'Infinity'::float8),
  vx real NOT NULL DEFAULT 0,
  vy real NOT NULL DEFAULT 0,
  cell_x integer GENERATED ALWAYS AS (floor(x / 512.0)::integer) STORED,
  cell_y integer GENERATED ALWAYS AS (floor(y / 512.0)::integer) STORED,
  hp integer NOT NULL DEFAULT 100 CHECK (hp >= 0),
  max_hp integer NOT NULL DEFAULT 100 CHECK (max_hp > 0),
  ki integer NOT NULL DEFAULT 100 CHECK (ki >= 0),
  max_ki integer NOT NULL DEFAULT 100 CHECK (max_ki >= 0),
  ping_ms integer NOT NULL DEFAULT 0 CHECK (ping_ms >= 0 AND ping_ms <= 60000),
  fps integer NOT NULL DEFAULT 60 CHECK (fps >= 0 AND fps <= 360),
  client_tick bigint NOT NULL DEFAULT 0,
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_heartbeat_at timestamptz NOT NULL DEFAULT now()
) WITH (fillfactor = 70);

-- Covering Index-Only Scan for Spatial AOI (Area of Interest) queries
CREATE INDEX IF NOT EXISTS active_sessions_aoi_idx
  ON game.active_sessions (world_id, cell_x, cell_y)
  INCLUDE (character_id, nick, race, level, x, y, vx, vy, hp, max_hp, ki, max_ki, combat_state, in_safe_zone, ping_ms, fps)
  WITH (fillfactor = 70);

CREATE INDEX IF NOT EXISTS active_sessions_node_idx
  ON game.active_sessions (node_id, last_heartbeat_at DESC);

-- 3. Time-Series Server Metrics History (BRIN-indexed for ultra-fast sequential appends)
CREATE TABLE IF NOT EXISTS game.server_metrics_history (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  node_id text NOT NULL,
  region text NOT NULL,
  cpu_percent real NOT NULL,
  mem_used_mb integer NOT NULL,
  tick_p95_ms real NOT NULL,
  avg_ping_ms real NOT NULL,
  active_players integer NOT NULL,
  active_entities integer NOT NULL,
  packets_in_sec integer NOT NULL,
  packets_out_sec integer NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS server_metrics_history_brin_idx
  ON game.server_metrics_history USING brin (recorded_at);
CREATE INDEX IF NOT EXISTS server_metrics_history_node_time_idx
  ON game.server_metrics_history (node_id, recorded_at DESC);

-- 4. Structured Server, Security, Anti-Cheat & Performance Logs
CREATE TABLE IF NOT EXISTS game.server_logs (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  node_id text NOT NULL DEFAULT 'node-eu-1',
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'critical')),
  category text NOT NULL CHECK (category IN ('tick', 'network', 'auth', 'anticheat', 'combat', 'db', 'world', 'admin')),
  message text NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  account_id uuid,
  character_id uuid,
  world_id text,
  x double precision,
  y double precision,
  metadata jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX IF NOT EXISTS server_logs_brin_idx
  ON game.server_logs USING brin (recorded_at);
CREATE INDEX IF NOT EXISTS server_logs_level_time_idx
  ON game.server_logs (level, recorded_at DESC);
CREATE INDEX IF NOT EXISTS server_logs_category_time_idx
  ON game.server_logs (category, recorded_at DESC);

-- 5. Real-Time Monitoring Views for Admin Dashboard
CREATE OR REPLACE VIEW game.world_population_stats AS
SELECT
  world_id,
  count(*)::integer AS online_players,
  count(*) FILTER (WHERE in_safe_zone)::integer AS safe_zone_players,
  count(*) FILTER (WHERE combat_state = 'combat')::integer AS combat_players,
  round(avg(ping_ms)::numeric, 1) AS avg_ping_ms,
  round(avg(fps)::numeric, 1) AS avg_fps,
  max(last_heartbeat_at) AS last_activity_at
FROM game.active_sessions
WHERE last_heartbeat_at >= now() - interval '60 seconds'
GROUP BY world_id;

CREATE OR REPLACE VIEW game.aoi_hotspot_cells AS
SELECT
  world_id,
  cell_x,
  cell_y,
  count(*)::integer AS player_count,
  round(avg(ping_ms)::numeric, 1) AS avg_ping_ms,
  round(avg(fps)::numeric, 1) AS avg_fps
FROM game.active_sessions
WHERE last_heartbeat_at >= now() - interval '60 seconds'
GROUP BY world_id, cell_x, cell_y
ORDER BY player_count DESC;

-- 6. Single-Roundtrip Stored Procedures for Zero-Stall Tick Synchronization
CREATE OR REPLACE FUNCTION game.batch_sync_positions(
  p_node_id text,
  p_region text,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  IF jsonb_typeof(p_rows) <> 'array' THEN
    RAISE EXCEPTION 'p_rows must be a JSON array';
  END IF;

  INSERT INTO game.active_sessions (
    character_id, account_id, nick, race, level,
    node_id, region, world_id, town, in_safe_zone, combat_state,
    x, y, vx, vy, hp, max_hp, ki, max_ki, ping_ms, fps, client_tick, last_heartbeat_at
  )
  SELECT
    r.character_id,
    r.account_id,
    COALESCE(r.nick, 'Gracz'),
    r.race,
    COALESCE(r.level, 1),
    p_node_id,
    p_region,
    r.world_id,
    r.town,
    COALESCE(r.in_safe_zone, false),
    COALESCE(r.combat_state, 'exploring'),
    r.x,
    r.y,
    COALESCE(r.vx, 0),
    COALESCE(r.vy, 0),
    COALESCE(r.hp, 100),
    GREATEST(COALESCE(r.max_hp, 100), 1),
    COALESCE(r.ki, 100),
    GREATEST(COALESCE(r.max_ki, 100), 0),
    LEAST(GREATEST(COALESCE(r.ping_ms, 0), 0), 60000),
    LEAST(GREATEST(COALESCE(r.fps, 60), 0), 360),
    COALESCE(r.client_tick, 0),
    now()
  FROM jsonb_to_recordset(p_rows) AS r(
    character_id uuid,
    account_id uuid,
    nick text,
    race text,
    level integer,
    world_id text,
    town text,
    in_safe_zone boolean,
    combat_state text,
    x double precision,
    y double precision,
    vx real,
    vy real,
    hp integer,
    max_hp integer,
    ki integer,
    max_ki integer,
    ping_ms integer,
    fps integer,
    client_tick bigint
  )
  ON CONFLICT (character_id) DO UPDATE SET
    node_id = EXCLUDED.node_id,
    region = EXCLUDED.region,
    world_id = EXCLUDED.world_id,
    town = EXCLUDED.town,
    in_safe_zone = EXCLUDED.in_safe_zone,
    combat_state = EXCLUDED.combat_state,
    x = EXCLUDED.x,
    y = EXCLUDED.y,
    vx = EXCLUDED.vx,
    vy = EXCLUDED.vy,
    hp = EXCLUDED.hp,
    max_hp = EXCLUDED.max_hp,
    ki = EXCLUDED.ki,
    max_ki = EXCLUDED.max_ki,
    ping_ms = EXCLUDED.ping_ms,
    fps = EXCLUDED.fps,
    client_tick = EXCLUDED.client_tick,
    last_heartbeat_at = now();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION game.query_aoi(
  p_world_id text,
  p_cell_x integer,
  p_cell_y integer,
  p_radius integer DEFAULT 1
)
RETURNS TABLE (
  character_id uuid,
  nick text,
  race text,
  level integer,
  x double precision,
  y double precision,
  vx real,
  vy real,
  hp integer,
  max_hp integer,
  ki integer,
  max_ki integer,
  combat_state text,
  in_safe_zone boolean,
  ping_ms integer,
  fps integer
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    s.character_id, s.nick, s.race, s.level,
    s.x, s.y, s.vx, s.vy,
    s.hp, s.max_hp, s.ki, s.max_ki,
    s.combat_state, s.in_safe_zone, s.ping_ms, s.fps
  FROM game.active_sessions s
  WHERE s.world_id = p_world_id
    AND s.cell_x BETWEEN (p_cell_x - LEAST(GREATEST(p_radius, 0), 4)) AND (p_cell_x + LEAST(GREATEST(p_radius, 0), 4))
    AND s.cell_y BETWEEN (p_cell_y - LEAST(GREATEST(p_radius, 0), 4)) AND (p_cell_y + LEAST(GREATEST(p_radius, 0), 4))
    AND s.last_heartbeat_at >= now() - interval '30 seconds';
$$;

CREATE OR REPLACE FUNCTION game.record_node_heartbeat(
  p_node_id text,
  p_region text,
  p_host text,
  p_status text,
  p_cpu_percent real,
  p_mem_used_mb integer,
  p_mem_total_mb integer,
  p_load_avg_1m real,
  p_tick_rate_hz real,
  p_tick_p50_ms real,
  p_tick_p95_ms real,
  p_tick_p99_ms real,
  p_avg_ping_ms real,
  p_p95_ping_ms real,
  p_active_players integer,
  p_active_entities integer,
  p_packets_in_sec integer,
  p_packets_out_sec integer,
  p_bandwidth_in_kbps real,
  p_bandwidth_out_kbps real,
  p_db_pool_active integer,
  p_db_pool_idle integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO game.server_nodes (
    node_id, region, host, status,
    cpu_percent, mem_used_mb, mem_total_mb, load_avg_1m,
    tick_rate_hz, tick_p50_ms, tick_p95_ms, tick_p99_ms,
    avg_ping_ms, p95_ping_ms, active_players, active_entities,
    packets_in_sec, packets_out_sec, bandwidth_in_kbps, bandwidth_out_kbps,
    db_pool_active, db_pool_idle, updated_at
  ) VALUES (
    p_node_id, p_region, p_host, p_status,
    p_cpu_percent, p_mem_used_mb, p_mem_total_mb, p_load_avg_1m,
    p_tick_rate_hz, p_tick_p50_ms, p_tick_p95_ms, p_tick_p99_ms,
    p_avg_ping_ms, p_p95_ping_ms, p_active_players, p_active_entities,
    p_packets_in_sec, p_packets_out_sec, p_bandwidth_in_kbps, p_bandwidth_out_kbps,
    p_db_pool_active, p_db_pool_idle, now()
  )
  ON CONFLICT (node_id) DO UPDATE SET
    region = EXCLUDED.region,
    host = EXCLUDED.host,
    status = EXCLUDED.status,
    cpu_percent = EXCLUDED.cpu_percent,
    mem_used_mb = EXCLUDED.mem_used_mb,
    mem_total_mb = EXCLUDED.mem_total_mb,
    load_avg_1m = EXCLUDED.load_avg_1m,
    tick_rate_hz = EXCLUDED.tick_rate_hz,
    tick_p50_ms = EXCLUDED.tick_p50_ms,
    tick_p95_ms = EXCLUDED.tick_p95_ms,
    tick_p99_ms = EXCLUDED.tick_p99_ms,
    avg_ping_ms = EXCLUDED.avg_ping_ms,
    p95_ping_ms = EXCLUDED.p95_ping_ms,
    active_players = EXCLUDED.active_players,
    active_entities = EXCLUDED.active_entities,
    packets_in_sec = EXCLUDED.packets_in_sec,
    packets_out_sec = EXCLUDED.packets_out_sec,
    bandwidth_in_kbps = EXCLUDED.bandwidth_in_kbps,
    bandwidth_out_kbps = EXCLUDED.bandwidth_out_kbps,
    db_pool_active = EXCLUDED.db_pool_active,
    db_pool_idle = EXCLUDED.db_pool_idle,
    updated_at = now();

  INSERT INTO game.server_metrics_history (
    node_id, region, cpu_percent, mem_used_mb, tick_p95_ms,
    avg_ping_ms, active_players, active_entities, packets_in_sec, packets_out_sec
  ) VALUES (
    p_node_id, p_region, p_cpu_percent, p_mem_used_mb, p_tick_p95_ms,
    p_avg_ping_ms, p_active_players, p_active_entities, p_packets_in_sec, p_packets_out_sec
  );
END;
$$;

CREATE OR REPLACE FUNCTION game.configure_server_node(
  p_node_id text,
  p_name text,
  p_region text,
  p_host text,
  p_port integer DEFAULT 7420,
  p_max_players integer DEFAULT 200,
  p_tick_rate_hz real DEFAULT 20.0,
  p_status text DEFAULT 'online'
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO game.server_nodes (
    node_id, name, region, host, port, max_players, tick_rate_hz, status, updated_at
  ) VALUES (
    p_node_id, p_name, p_region, p_host, p_port, p_max_players, p_tick_rate_hz, p_status, now()
  )
  ON CONFLICT (node_id) DO UPDATE SET
    name = EXCLUDED.name,
    region = EXCLUDED.region,
    host = EXCLUDED.host,
    port = EXCLUDED.port,
    max_players = EXCLUDED.max_players,
    tick_rate_hz = EXCLUDED.tick_rate_hz,
    status = EXCLUDED.status,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION game.set_server_node_status(
  p_node_id text,
  p_status text
)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE game.server_nodes
  SET status = p_status, updated_at = now()
  WHERE node_id = p_node_id;
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION game.append_server_log(
  p_node_id text,
  p_level text,
  p_category text,
  p_message text,
  p_account_id uuid DEFAULT NULL,
  p_character_id uuid DEFAULT NULL,
  p_world_id text DEFAULT NULL,
  p_x double precision DEFAULT NULL,
  p_y double precision DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'
)
RETURNS bigint
LANGUAGE sql
AS $$
  INSERT INTO game.server_logs (
    node_id, level, category, message, account_id, character_id, world_id, x, y, metadata
  ) VALUES (
    p_node_id, p_level, p_category, p_message, p_account_id, p_character_id, p_world_id, p_x, p_y, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id;
$$;

-- Least-privilege runtime grants
GRANT SELECT, INSERT, UPDATE, DELETE ON game.server_nodes, game.active_sessions TO ki_game_server;
GRANT SELECT, INSERT ON game.server_metrics_history, game.server_logs TO ki_game_server;
GRANT SELECT ON game.world_population_stats, game.aoi_hotspot_cells TO ki_game_server, ki_game_readonly;
GRANT SELECT ON game.server_nodes, game.active_sessions, game.server_metrics_history, game.server_logs TO ki_game_readonly;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA game TO ki_game_server;
GRANT EXECUTE ON FUNCTION
  game.batch_sync_positions(text, text, jsonb),
  game.query_aoi(text, integer, integer, integer),
  game.record_node_heartbeat(
    text, text, text, text, real, integer, integer, real,
    real, real, real, real, real, real, integer, integer,
    integer, integer, real, real, integer, integer
  ),
  game.configure_server_node(text, text, text, text, integer, integer, real, text),
  game.set_server_node_status(text, text),
  game.append_server_log(text, text, text, text, uuid, uuid, text, double precision, double precision, jsonb)
TO ki_game_server;
GRANT EXECUTE ON FUNCTION game.query_aoi(text, integer, integer, integer) TO ki_game_readonly;

COMMIT;
