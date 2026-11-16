extends SceneTree
var game: PyraGame
var race := "legend"
var output := "/tmp/android-audit-progression"
var report := {"race":"","kills":0,"deaths":0,"potions":0,"innRests":0,"simulationSeconds":0.0,"damageDealt":0,"levelEvents":[],"encounters":[],"checks":[],"xpSources":{},"otherXpSources":{}}
var death_seen := false
var render_live := false
const DT := 1.0/60.0
func settle(n:=3) -> void:
	for i in n:await process_frame
func touch(index:int,down:bool,at:Vector2) -> void:
	var event:=InputEventScreenTouch.new();event.index=index;event.pressed=down;event.position=at;root.push_input(event,true)
func move_stick(vector:Vector2) -> void:
	if game.hud.touch.move_pointer != 0:touch(0,true,game.hud.touch.left_center)
	var event:=InputEventScreenDrag.new();event.index=0;event.position=game.hud.touch.left_center+vector.limit_length(1.0)*84.0;root.push_input(event,true)
func damage(_foe:Node,amount:int,_crit:bool) -> void:report.damageDealt += amount
func killed(monster:PyraMonster) -> void:
	if not monster.no_reward:
		report.kills += 1
		var id:=str(monster.def.id);report.xpSources[id]=int(report.xpSources.get(id,0))+int(monster.def.xp)
func other_reward(xp:int,_coins:int,_items:Dictionary,source:String) -> void:
	if xp>0:report.otherXpSources[source]=int(report.otherXpSources.get(source,0))+xp
func check(ok:bool,id:String,detail:Variant=null) -> void:report.checks.append({"passed":ok,"id":id,"detail":detail})
func _initialize() -> void:run.call_deferred()
func free_near(at:Vector2) -> Variant:
	for r in range(40,260,16):
		for i in 16:
			var p:=at+Vector2.from_angle(TAU*i/16.0)*r
			if game.can_stand(p,"") and not game.in_safe_city(p):return p
	return null
func shot(name:String) -> void:
	if DisplayServer.get_name()=="headless":return
	game._process(0.0)
	for wait in 90:
		if game.continent.ground_ready():break
		await process_frame
	game.hud.refresh(game.kit)
	game.hud.set_player(game.player.position,game.player.facing)
	game.hud.art_layer.invalidate()
	await settle(3)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+"/"+name+".png")
func tick() -> void:
	game._process(DT)
	for value in game.monsters.active.values().duplicate():
		if is_instance_valid(value):
			value.set_process(false)
			value._process(DT)
	for child in game.monsters.get_children():
		if child.has_method("_process") and not child.is_queued_for_deletion():child._process(DT)
	game.monsters._process(DT)
	report.simulationSeconds += DT
	if game.kit.dead and not death_seen:report.deaths+=1;death_seen=true
	if not game.kit.dead:death_seen=false
func inn_between_fights() -> void:
	if game.kit.hp > float(game.kit.stats().maxHp)*0.55 or game.economy.gold < 5:return
	touch(1,false,game.hud.touch.attack_center)
	touch(0,false,game.hud.touch.left_center)
	var town:Dictionary=game.land.settlements[0]
	for service:Dictionary in town.services:
		if service.service!="inn":continue
		var door:=Vector2(float(service.door.x),float(service.door.y))
		game.load_space("",door)
		game.interact()
		await settle()
		var resident:Array=game.targets.filter(func(t):return t.kind=="npc")
		if resident.is_empty():return
		game.player.position=resident[0].point+Vector2(30,0)
		game.interact()
		await settle()
		for button in game.hud.buttons:
			if is_instance_valid(button) and button.text.begins_with("ODPOCZNIJ"):
				var gold:=game.economy.gold;button.pressed.emit()
				if game.economy.gold==gold-5:report.innRests+=1
				break
		if game.hud.modal.visible:game.hud.close_dialog()
		game.go_back()
		await settle()
func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--race="):race=arg.substr(7)
		if arg.begins_with("--out="):output=arg.substr(6)
		if arg=="--live":render_live=true
	output+="/"+race
	DirAccess.make_dir_recursive_absolute(output)
	seed(20261116+["legend","planetary","sage","android"].find(race))
	report.race=race
	if render_live:Engine.max_fps=60
	root.size=Vector2i(844,390)
	var title:PyraTitleScreen=load("res://scenes/title.tscn").instantiate();root.add_child(title);await settle(6);title.start_city()
	while is_instance_valid(title):await process_frame
	game=root.get_children().filter(func(n):return n is PyraGame)[0];game.skip_intro=true;await settle(4);game.start_new_character(race);await settle(4)
	game.set_process(false);game.monsters.process_mode=Node.PROCESS_MODE_DISABLED
	game.kit.damage_dealt.connect(damage)
	game.quests.rewarded.connect(other_reward)
	check(game.kit.level==1 and game.economy.gold==20,"fresh-level-1",{"stats":game.kit.stats(),"inventory":game.economy.to_save()})
	check(not game.kit.gm_invulnerable and not game.kit.gm_no_cooldowns,"GM-modes-disabled")
	var candidates:Array=[]
	for index in game.monsters.rows.size():
		var row:Array=game.monsters.rows[index];var kind:=str(game.monsters.kinds[int(row[0])]);var def:Dictionary=game.monsters.defs[kind]
		if int(def.level)!=1 or int(def.xp)<=0:continue
		var p:=Vector2(float(row[1]),float(row[2]));var free:Variant=free_near(p)
		if free==null:continue
		var neighbours:=0
		for other:Array in game.monsters.rows:
			if p.distance_squared_to(Vector2(float(other[1]),float(other[2]))) < 450.0*450.0:neighbours+=1
		candidates.append({"index":index,"kind":kind,"spawn":p,"at":free,"score":neighbours*100000+p.distance_to(game.player.position)})
	candidates.sort_custom(func(a,b):return a.score<b.score)
	check(not candidates.is_empty(),"existing-level-1-spawn-available",candidates.size())
	var previous_level:=1
	for attempt in mini(80,candidates.size()):
		if game.kit.level>=3 or report.deaths>=12 or report.simulationSeconds>1200:break
		await inn_between_fights()
		var candidate:Dictionary=candidates[attempt]
		game.monsters.disengage_all()
		game.load_space("",candidate.at);game.monsters.process_mode=Node.PROCESS_MODE_DISABLED
		game.monsters.refresh();game.monsters.refresh()
		pass # Each spawned monster is observed below; production rewards remain attached.
		for m in game.monsters.active.values():
			if not m.died.is_connected(killed):m.died.connect(killed)
		var kills_before:int=report.kills
		var entry:Dictionary={"slot":candidate.index,"kind":candidate.kind,"levelBefore":game.kit.level,"hpBefore":game.kit.hp,"xpBefore":game.kit.xp,"activeMonsters":game.monsters.active.size()}
		touch(1,true,game.hud.touch.attack_center)
		if attempt==0:await shot("level-1-first-fight")
		for step in 60*100:
			if game.kit.level>=3:break
			if game.kit.dead:
				tick()
				if step%120==0:await process_frame
				continue
			if report.deaths>=12:break
			var foe:Node2D=game.monsters.nearest(game.player.position,1600)
			if foe==null:break
			if not game.attack_held:touch(1,true,game.hud.touch.attack_center)
			var offset:Vector2=foe.position-game.player.position
			var desired:=offset.normalized() if offset.length()>55.0 else Vector2.ZERO
			move_stick(desired)
			if game.kit.hp<float(game.kit.stats().maxHp)*0.4 and game.economy.potion_cooldown<=0 and game.economy.count("potion")>0:
				var count:=game.economy.count("potion");game.use_potion();report.potions+=count-game.economy.count("potion")
			if game.kit.level>=2 and not game.kit.has("A1") and game.kit.can_learn("A1").ok:game.kit.learn("A1")
			if game.kit.has("A1") and game.kit.cooldown_left("A1")<=0:game.use_slot(0)
			tick()
			for m in game.monsters.active.values():
				if not m.died.is_connected(killed):m.died.connect(killed)
			if game.kit.level!=previous_level:
				previous_level=game.kit.level;report.levelEvents.append({"level":previous_level,"simulationSeconds":report.simulationSeconds,"kills":report.kills,"stats":game.kit.stats(),"xp":game.kit.xp});await shot("level-%d"%previous_level)
			if render_live and step%4==0:await process_frame
			elif step%90==0:await process_frame
			if report.kills>kills_before:break
		touch(1,false,game.hud.touch.attack_center);touch(0,false,game.hud.touch.left_center)
		entry.levelAfter=game.kit.level;entry.hpAfter=game.kit.hp;entry.xpAfter=game.kit.xp;entry.kills=report.kills-kills_before;report.encounters.append(entry)
		await settle()
	check(game.kit.level==3,"reached-level-3-through-ordinary-rewards",{"level":game.kit.level,"xp":game.kit.xp,"kills":report.kills,"deaths":report.deaths})
	check(not game.kit.gm_invulnerable and not game.kit.gm_no_cooldowns,"GM-remained-disabled")
	check(game.kit.level<2 or game.kit.has("A1"),"level-2-skill-learned")
	check(game.save_checkpoint("user://audit-level3.json",true) and game.restore_checkpoint("user://audit-level3.json") and game.kit.level==3,"level-3-save-round-trip")
	report.final={"level":game.kit.level,"xp":game.kit.xp,"stats":game.kit.stats(),"inventory":game.economy.to_save(),"learned":game.kit.learned}
	report.fixtures="No XP/level/HP/attack overrides and no GM. Existing level-1 spawn positions selected and approached using joystick events; travel between encounters/inn is a fixture warp, not a measured traversal. Time is advanced through actual simulate/AI functions at 1/60; headless batches are accelerated. Native --live renders one frame per four fixed simulation steps; this is functional coverage, not a physical-device timing benchmark. Full Game._process, AI and presentation update paths are executed."
	var failed:int=(report.checks as Array).filter(func(c):return not c.passed).size();report.passed=report.checks.size()-failed;report.failed=failed
	var f:=FileAccess.open(output+"/result.json",FileAccess.WRITE);f.store_string(JSON.stringify(report,"\t"));f.close()
	print("PROGRESSION ",race," level=",game.kit.level," kills=",report.kills," deaths=",report.deaths," seconds=",report.simulationSeconds)
	root.remove_child(game);game.queue_free();game=null;await settle(8)
	quit(1 if failed else 0)
