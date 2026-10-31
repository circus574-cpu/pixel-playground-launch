\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE ki_game_server;
DO $$
DECLARE a uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); op uuid:=gen_random_uuid(); n integer;
BEGIN
 INSERT INTO game.accounts(id,auth_project,auth_subject) VALUES(a,'technical-verification',gen_random_uuid());
 INSERT INTO game.characters(id,account_id,race) VALUES(c,a,'planetary');
 INSERT INTO game.character_snapshots(character_id,world_id,x,y,state) VALUES(c,'verdant',10,20,'{}');
 UPDATE game.character_snapshots SET revision=revision+1,state='{"checkpoint":1}' WHERE character_id=c AND revision=1;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'CAS write failed'; END IF;
 UPDATE game.character_snapshots SET revision=revision+1 WHERE character_id=c AND revision=1;
 GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Stale write was accepted'; END IF;
 INSERT INTO game.operations(id,character_id,kind,result) VALUES(op,c,'verification','{}');
 BEGIN
  INSERT INTO game.operations(id,character_id,kind,result) VALUES(op,c,'duplicate','{}');
  RAISE EXCEPTION 'Duplicate operation accepted';
 EXCEPTION WHEN unique_violation THEN NULL; END;
 BEGIN
  INSERT INTO game.inventory_instances(character_id,item_definition,quantity) VALUES(c,'technical',0);
  RAISE EXCEPTION 'Invalid quantity accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 BEGIN
  UPDATE game.character_snapshots SET x='NaN'::float8 WHERE character_id=c;
  RAISE EXCEPTION 'Invalid coordinate accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF has_schema_privilege(current_user,'game','CREATE') OR has_table_privilege(current_user,'game.accounts','TRUNCATE') THEN RAISE EXCEPTION 'Excessive runtime privileges'; END IF;
 PERFORM game.record_node_heartbeat(
  'node-eu-verify','eu-central','127.0.0.1','online',
  18.5, 312, 1024, 0.42,
  20.0, 4.1, 9.8, 14.2,
  22.0, 38.0, 1, 40,
  120, 240, 64.5, 128.0,
  2, 6
 );
 GET DIAGNOSTICS n=ROW_COUNT;
 IF (SELECT game.batch_sync_positions(
  'node-eu-verify',
  'eu-central',
  jsonb_build_array(
   jsonb_build_object(
    'character_id', c,
    'account_id', a,
    'nick', 'Verifier',
    'race', 'planetary',
    'level', 12,
    'world_id', 'verdant',
    'town', 'verdant-city',
    'in_safe_zone', true,
    'combat_state', 'safe',
    'x', 1024,
    'y', 2048,
    'vx', 0,
    'vy', 0,
    'hp', 320,
    'max_hp', 320,
    'ki', 180,
    'max_ki', 180,
    'ping_ms', 19,
    'fps', 60,
    'client_tick', 100
   )
  )
 )) <> 1 THEN
  RAISE EXCEPTION 'batch_sync_positions failed';
 END IF;
 IF (SELECT count(*) FROM game.query_aoi('verdant', 2, 4, 1)) <> 1 THEN
  RAISE EXCEPTION 'query_aoi spatial lookup failed';
 END IF;
 PERFORM game.append_server_log('node-eu-verify', 'info', 'tick', 'Verification tick ok', a, c, 'verdant', 1024, 2048, '{"verified":true}'::jsonb);
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: CAS, duplicate rejection, constraints, UNLOGGED spatial AOI, node telemetry and least privileges; fixtures rolled back' AS verification;
