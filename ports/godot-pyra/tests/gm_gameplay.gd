extends SceneTree
const Fixture := preload("res://tests/hud_mobile.gd")
var game: PyraGame
var net: PyraOnline
var output := "/tmp/ki-gm-gameplay"
var checks: Array[Dictionary] = []

class Server extends Fixture.StaffServer:
	func cloud_push(_save: Dictionary, _base: int = -1, _version: String = "") -> Dictionary:
		return {"ok":true,"revision":1}

func verify(ok: bool, message: String) -> void:
	checks.append({"name":message,"passed":ok})
	if not ok:
		push_error(message)

func settle() -> void:
	for i in 8:
		await process_frame

func shot(name: String) -> void:
	await settle()
	if DisplayServer.get_name() != "headless":
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(output+"/"+name+".png")

func command(action: String, extra := {}) -> Dictionary:
	var payload: Dictionary = extra.duplicate()
	payload.action = action
	return await game.gm_tools.execute(payload)

func click(button: Button) -> void:
	for down in [true,false]:
		var event := InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.pressed = down
		event.position = button.get_global_rect().get_center()
		root.push_input(event,true)
	await settle()

func touch_button(button: Button) -> void:
	var at := root.get_final_transform() * button.get_global_rect().get_center()
	for down in [true,false]:
		var event := InputEventScreenTouch.new()
		event.index = 3
		event.pressed = down
		event.position = at
		Input.parse_input_event(event)
		await process_frame
	await settle()

func same_save(a: Dictionary, b: Dictionary) -> bool:
	# Godot JSON reads numbers as floats. Compare every serialized value, independently of in-memory int/float types.
	return JSON.parse_string(JSON.stringify(a)) == JSON.parse_string(JSON.stringify(b))

func pending_command(state: Dictionary) -> void:
	state.result = await game.gm_tools.execute({"action":"level"})
	state.done = true

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i+1 < args.size():
			output = args[i+1]
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(844,390)
	var hub := KiNet.hub()
	var old := hub.online_node
	hub.remove_child(old)
	net = Server.new()
	hub.online_node = net
	hub.content_node.online = net
	hub.add_child(net)
	old.queue_free()
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle()
	title.start_city()
	while is_instance_valid(title):
		await process_frame
	game = root.get_children().filter(func(n):return n is PyraGame)[0]
	game.skip_intro = true
	await settle()
	game.start_new_character("legend")
	game.set_process(false)
	game.monsters.set_process(false)
	net.access_token = "qa-access"
	net.refresh_token = "qa-refresh"
	net.account_id = "qa-gm"
	net.roles = ["gm"]
	net.remember = false
	game.sync_staff_access()
	var outcome: Dictionary
	var start_level: int = game.kit.level
	net.authorized = false
	outcome = await command("level")
	verify(not outcome.ok and game.kit.level == start_level,"revoked/ordinary account cannot mutate level")
	net.authorized = true
	outcome = await command("level")
	verify(outcome.ok and game.kit.level == start_level+1,"GM +1 level changes actual game character")
	outcome = await command("setLevel",{"value":10})
	verify(outcome.ok and game.kit.level == 10 and game.kit.xp == 0 and game.kit.hp == game.kit.stats().maxHp,"set level restores HP and resets XP through existing progression")
	outcome = await command("setLevel",{"value":100})
	verify(not outcome.ok and game.kit.level == 10,"out-of-range level rejected without corrupting Android save")
	var coins: int = game.economy.gold
	outcome = await command("gold")
	verify(outcome.ok and game.economy.gold == coins+1000,"GM adds 1000 real economy coins")
	outcome = await command("setGold",{"value":5000})
	verify(outcome.ok and game.economy.gold == 5000,"GM can set current character coin balance")
	var potions: int = game.economy.count("potion")
	outcome = await command("potions")
	verify(outcome.ok and game.economy.count("potion") == potions+10,"GM adds ten usable potions")
	for race: String in ["legend","planetary","sage","android"]:
		game.set_race(race)
		game.kit.set_level(10)
		game.kit.learn("A1")
		var dummy := PyraDummy.new()
		game.continent.sorted.add_child(dummy)
		dummy.position = game.player.position + Vector2(30,0)
		game.kit.foes_in = func(_at:Vector2,_radius:float)->Array:return [dummy]
		game.kit.target = func()->Node:return dummy
		game.kit.hp = 25.0
		outcome = await command("god")
		var hp: float = game.kit.hp
		var dealt: float = game.kit.take_damage(1000000)
		game.kit.add_debuff("dot",100000,3)
		game.kit.tick(0.5)
		verify(outcome.ok and dealt == 0 and game.kit.hp >= hp and not game.kit.dead,"invulnerability blocks direct damage and DoT for "+race)
		outcome = await command("heal")
		verify(outcome.ok and game.kit.debuffs.is_empty() and game.kit.hp == game.kit.stats().maxHp and game.kit.ki == game.kit.stats().maxKi,"GM heal clears debuffs and fills HP/KI for "+race)
		outcome = await command("unlimited")
		var ki: float = game.kit.ki
		var cast1: Dictionary = game.kit.use("A1")
		var cast2: Dictionary = game.kit.use("A1")
		verify(outcome.ok and cast1.ok and cast2.ok and game.kit.cooldown_left("A1") == 0 and game.kit.ki < ki,"two real racial skill casts ignore cooldown but still spend KI for "+race)
		await command("unlimited")
		game.kit.ki = game.kit.stats().maxKi
		var normal: Dictionary = game.kit.use("A1")
		verify(normal.ok and game.kit.cooldown_left("A1") > 0 and not game.kit.use("A1").ok,"turning unlimited off restores normal skill cooldown for "+race)
		await command("god")
		game.kit.tick(1.0)   # let the Planetary skill's ordinary dodge invulnerability expire
		verify(not game.kit.gm_invulnerable and game.kit.take_damage(100000) > 0,"turning god off restores damage for "+race)
		await command("heal")
		game.kit.timers.clear()
		game.kit.foes_in = func(_at:Vector2,_r:float)->Array:return []
		game.kit.target = func()->Node:return null
		dummy.queue_free()
		await settle()
	game.set_race("legend")
	game.kit.set_level(10)
	var arrival := Vector2(float(game.land.arrival.x),float(game.land.arrival.y))
	outcome = await command("teleport",{"x":arrival.x,"y":arrival.y})
	verify(outcome.ok and game.can_stand(game.player.position,"") and game.player.position.distance_to(arrival) < 4001,"teleport moves actual player to navigable requested location")
	var position_before: Vector2 = game.player.position
	outcome = await command("teleport",{"x":-200,"y":100})
	verify(not outcome.ok and game.player.position == position_before,"off-map teleport is rejected without moving character")
	outcome = await command("teleport",{"x":30,"y":30})
	verify(not outcome.ok and game.player.position == position_before,"ocean teleport rejected without moving character")
	outcome = await command("teleport",{"x":NAN,"y":100})
	verify(not outcome.ok and game.player.position == position_before,"NaN teleport is rejected")
	var treasure: Dictionary = game.economy.to_save()
	outcome = await command("teleport",{"land":"island-1"})
	verify(outcome.ok and game.land_id == "island-1" and game.can_stand(game.player.position,"") and game.economy.to_save() == treasure,"cross-land teleport reaches island and preserves inventory and money")
	outcome = await command("teleport",{"land":"pyra"})
	verify(outcome.ok and game.land_id == "pyra" and game.can_stand(game.player.position,"") and game.economy.to_save() == treasure,"return teleport restores correct continent and preserves progress")
	await command("god")
	await command("unlimited")
	var saved: Dictionary = game.kit.to_save()
	verify(not saved.has("gm_invulnerable") and not saved.has("gm_no_cooldowns"),"GM modes are session-only and absent from saves")
	var backup_level: int = game.kit.level
	var pending := {"done":false,"result":{}}
	pending_command(pending)
	game.gm_tools.cancel_pending()
	while not bool(pending.done):
		await process_frame
	verify(not pending.result.ok and game.kit.level == backup_level,"closing/canceling a pending GM command prevents delayed mutation")
	var expected_kit: Dictionary = game.kit.to_save().duplicate(true)
	var expected_economy: Dictionary = game.economy.to_save().duplicate(true)
	var expected_quests: Dictionary = game.quests.to_save().duplicate(true)
	verify(game.save_checkpoint(game.SAVE_PATH,true),"GM changes use the existing atomic character save")
	game.economy.gold = 0
	var restored := game.restore_checkpoint()
	verify(restored and same_save(game.kit.to_save(),expected_kit) and same_save(game.economy.to_save(),expected_economy) and same_save(game.quests.to_save(),expected_quests),"GM save round-trip preserves character, inventory and quests")
	game.show_menu()
	await settle()
	verify(game.screen != null and game.player.locked and game.hud.suspended,"new compact game menu pauses input")
	await shot("menu-gm-844x390")
	for dimensions: Vector2i in [Vector2i(844,390),Vector2i(1280,576),Vector2i(854,480)]:
		root.size = dimensions
		await settle()
		if not root.get_visible_rect().encloses(game.screen.frame.get_global_rect()):
			print("MENU BOUNDS ",root.get_visible_rect()," frame ",game.screen.frame.get_global_rect()," minimum ",game.screen.frame.get_combined_minimum_size())
		verify(root.get_visible_rect().encloses(game.screen.frame.get_global_rect()),"compact menu fits "+str(dimensions))
	await click(game.screen.buttons.map)
	verify(game.screen is MapScreen,"new menu MAPA button opens the existing world map")
	game.close_screen()
	game.show_menu()
	await settle()
	await click(game.screen.buttons.gm)
	await settle()
	verify(game.screen.authorized and game.screen.command_buttons.has("god") and game.screen.command_buttons.has("teleport"),"actual GM screen exposes authenticated gameplay commands")
	verify(root.get_visible_rect().encloses(game.screen.frame.get_global_rect()),"actual gameplay GM panel fits viewport")
	for index in game.screen.land_picker.item_count:
		game.screen.land_picker.select(index)
		game.screen.fill_places()
		await settle()
		verify(root.get_visible_rect().encloses(game.screen.frame.get_global_rect()) and game.screen.place_picker.item_count > 0,"GM destination picker fits for "+game.screen.selected_land())
	game.screen.land_picker.select(0)
	game.screen.fill_places()
	var old_gold: int = game.economy.gold
	await click(game.screen.command_buttons.gold)
	verify(game.economy.gold == old_gold+1000,"native GM button executes command exactly once")
	var gold_before_touch: int = game.economy.gold
	await touch_button(game.screen.command_buttons.gold)
	verify(game.economy.gold == gold_before_touch+1000 and game.screen.gold_input.value == game.economy.gold,"native screen touch executes a GM action exactly once and refreshes balance")
	await shot("gm-tools-854x480")
	game.close_screen()
	net.authorized = false
	await net.verify_staff()
	verify(not game.kit.gm_invulnerable and not game.kit.gm_no_cooldowns and not game.hud.gm_button.visible,"server role revocation removes modes and GM entry")
	game.show_menu()
	await settle()
	verify(not game.screen.buttons.gm.visible,"ordinary game menu has no GM command entry")
	game.close_screen()
	var failed := checks.filter(func(c):return not c.passed).size()
	var file := FileAccess.open(output+"/result.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks.size(),"passed":checks.size()-failed,"failed":failed,"network":"isolated role and cloud fixture; actual Godot gameplay","results":checks},"\t"))
	file.close()
	root.remove_child(game)
	game.queue_free()
	game = null
	await settle()
	print("GM GAMEPLAY QA ",checks.size()-failed,"/",checks.size())
	quit(1 if failed else 0)
