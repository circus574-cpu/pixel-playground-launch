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
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: CAS, duplicate rejection, constraints and least privileges; fixtures rolled back' AS verification;
