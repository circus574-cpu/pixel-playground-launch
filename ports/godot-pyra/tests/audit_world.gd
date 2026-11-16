extends SceneTree
## Exhaustive acceptance audit of existing land doors, services and NPC dialogue. No production source changes.
var game: PyraGame
var output := "/tmp/ki-audit-world"
var results: Array[Dictionary] = []
var buildings: Array[Dictionary] = []
var npcs: Array[Dictionary] = []
var topics_done: Dictionary = {}
var visual_done: Dictionary = {}
var bindings: Dictionary = {}

func check(ok: bool, category: String, id: String, detail: Variant = null) -> void:
	results.append({"passed":ok,"category":category,"id":id,"detail":detail})
	if not ok:
		print("AUDIT FAIL ",category," ",id," ",str(detail).left(150))

func settle(n := 2) -> void:
	for i in n:
		await process_frame

func body_text() -> String:
	if game.hud.modal_box.get_child_count() < 2:
		return ""
	var scroll: ScrollContainer = game.hud.modal_box.get_child(1)
	return (scroll.get_child(0) as Label).text

func close_ui() -> void:
	if is_instance_valid(game.screen):
		game.close_screen()
	if game.hud.modal.visible:
		game.hud.close_dialog()

func action(text: String) -> Button:
	for button in game.hud.buttons:
		if is_instance_valid(button) and button.is_visible_in_tree() and button.text.begins_with(text):
			return button
	return null

func approach(target: Dictionary) -> bool:
	for radius in range(0,153,8):
		for i in (1 if radius == 0 else 16):
			var at: Vector2 = target.point + Vector2.from_angle(TAU*i/16.0)*radius
			if game.can_stand(at,game.current_room):
				game.player.position = at
				if game.nearest_target() == target:
					return true
	return false

func shot(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	game._process(0.0)
	await settle(3)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output+"/"+name+".png")

func npc_audit(target: Dictionary, context: String) -> void:
	var id := context+"/"+str(target.id)+"/"+str(target.name)
	var role := str(game.ROLE_OF_SERVICE.get(str(target.get("service","")),target.id))
	var town: String = game.room_town if game.room_town != "" else game.settlement_at(target.point)
	var binding := "%s/%s/%s" % [game.land_id,town,role]
	bindings[binding] = str(target.name)
	var entry := {"id":id,"land":game.land_id,"town":town,"role":role,"name":str(target.name),"reachable":false,"dialogues":[]}
	entry.reachable = approach(target)
	check(entry.reachable,"npc-reachable",id)
	if not entry.reachable:
		npcs.append(entry)
		return
	for level in [1,2,3]:
		close_ui()
		game.kit.set_level(level)
		game.quests.sync()
		game.interact()
		await settle()
		var text := body_text()
		var title: String = game.hud.modal_box.get_child(0).text if game.hud.modal.visible else ""
		var buttons: Array = []
		for button in game.hud.buttons:
			if is_instance_valid(button) and button.is_visible_in_tree() and game.hud.modal.is_ancestor_of(button):
				buttons.append(button.text)
		entry.dialogues.append({"level":level,"title":title,"text":text,"actions":buttons})
		check(game.hud.modal.visible and not text.is_empty() and title.contains(str(target.name)),"npc-dialogue",id+"/level-%d" % level)
		check(root.get_visible_rect().encloses(game.hud.modal.get_global_rect()),"dialogue-layout",id+"/level-%d" % level,{"modal":str(game.hud.modal.get_global_rect()),"viewport":str(root.get_visible_rect())})
		if level == 1 and not visual_done.has(game.world_id+"/npc"):
			visual_done[game.world_id+"/npc"] = true
			await shot(game.world_id+"-npc-dialogue")
		close_ui()
	var key: String = game.world_id+"/"+role
	if not topics_done.has(key):
		topics_done[key] = true
		for topic: Dictionary in PyraStory.topics(game.world_id,role):
			game.open_topics(str(target.name),role)
			await settle()
			var found: Button
			for button in game.hud.buttons:
				if is_instance_valid(button) and button.is_visible_in_tree() and button.text.ends_with(str(topic.label)):
					found = button
					break
			var clicked := found != null
			if clicked:
				found.pressed.emit()
				await settle()
			check(clicked and body_text() == str(topic.text) and game.story.heard(str(topic.id)),"npc-topic",key+"/"+str(topic.id),{"found":clicked,"heard":game.story.heard(str(topic.id)),"actual":body_text(),"expected":str(topic.text)})
			close_ui()
	npcs.append(entry)

func service_audit(door: Dictionary) -> Dictionary:
	var service := str(door.room)
	var result := {"service":service,"opened":false,"functional":false}
	game.economy.gold = 10000
	game.economy.bag = {"potion":3}
	match service:
		"shop":
			var button := action("HANDEL")
			if button != null: button.pressed.emit()
			result.opened = is_instance_valid(game.screen)
			var n := game.economy.count("potion")
			var gold := game.economy.gold
			var price := game.economy.buy_price("potion")
			result.functional = game.economy.buy("potion") and game.economy.count("potion") == n+1 and game.economy.gold == gold-price and game.economy.sell("potion") and game.economy.count("potion") == n
		"smithy":
			var button := action("KUŹNIA")
			if button != null: button.pressed.emit()
			result.opened = is_instance_valid(game.screen)
			for recipe: Dictionary in game.economy.recipes:
				if int(recipe.requiredLevel) <= game.kit.level and str(recipe.station) == "forge":
					for ingredient: Dictionary in recipe.ingredients:
						game.economy.add_item(str(ingredient.itemId),int(ingredient.count))
					var before := game.economy.count(str(recipe.result))
					result.functional = game.economy.craft(recipe) and game.economy.count(str(recipe.result)) == before+int(recipe.count)
					result.recipe = recipe.id
					break
		"depot":
			var button := action("OTWÓRZ SKRZYNIĘ")
			if button != null:button.pressed.emit()
			result.opened = is_instance_valid(game.screen)
			var before := game.economy.count("potion")
			result.functional = game.economy.deposit("potion") and game.economy.count("potion") == before-1 and game.economy.withdraw("potion") and game.economy.count("potion") == before
		"inn":
			game.kit.hp = float(game.kit.stats().maxHp)*0.5
			var before := game.economy.gold
			var button := action("ODPOCZNIJ")
			if button != null:button.pressed.emit()
			result.opened = button != null
			result.functional = game.kit.hp == float(game.kit.stats().maxHp) and game.economy.gold == before-PyraEconomy.INN_PRICE
		"arena":
			close_ui()
			result.opened = not game.dummies.is_empty()
			if result.opened:
				var dummy: PyraDummy = game.dummies[0]
				game.player.position = dummy.position+Vector2(25,0)
				var before := dummy.total_taken
				game.kit.tick(game.kit.interval()+0.1)
				game.do_basic()
				result.functional = dummy.total_taken > before
		"hall":
			result.opened = game.hud.modal.visible
			result.functional = not body_text().is_empty()
	return result

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):output = arg.substr(6)
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(844,390)
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle(6)
	title.start_city()
	while is_instance_valid(title):await process_frame
	game = root.get_children().filter(func(n):return n is PyraGame)[0]
	game.skip_intro = true
	await settle(6)
	game.start_new_character("legend")
	game.set_process(false)
	for land: String in game.ALL_LANDS:
		close_ui()
		game.enter_land(land)
		var home_races := {"pyra":"legend","verdant":"planetary","aether":"sage","nexus":"android"}
		game.set_race(str(home_races[game.world_id]))
		game.monsters.set_process(false)
		game.monsters.clear_all()
		await settle(4)
		await shot(land+"-capital")
		var doors: Array = game.targets.filter(func(t):return t.kind == "door").duplicate(true)
		check(doors.size() == (24 if land in ["pyra","verdant","aether","nexus"] else 6),"door-count",land,doors.size())
		var outdoor: Array = game.targets.filter(func(t):return t.kind == "npc").duplicate(true)
		for target: Dictionary in outdoor:
			await npc_audit(target,land+"/outdoor")
		for door: Dictionary in doors:
			close_ui()
			if not game.current_room.is_empty():game.go_back()
			var row := {"land":land,"town":str(door.town),"id":str(door.id),"service":str(door.room)}
			row.reachable = approach(door)
			check(row.reachable,"door-reachable",str(door.id))
			if not row.reachable:
				buildings.append(row)
				continue
			var before: Vector2 = game.player.position
			game.interact()
			await settle(3)
			row.entered = game.current_room == str(door.room) and game.can_stand(game.player.position,game.current_room)
			check(row.entered,"building-enter",str(door.id),game.current_room)
			if not row.entered:
				buildings.append(row)
				continue
			var visual_key: String = game.world_id+"/"+str(door.room)
			if not visual_done.has(visual_key):
				visual_done[visual_key] = true
				await shot(game.world_id+"-room-"+str(door.room))
			var residents := game.targets.filter(func(t):return t.kind == "npc").duplicate(true)
			row.residents = residents.size()
			check(not residents.is_empty(),"building-resident",str(door.id))
			for target: Dictionary in residents:
				await npc_audit(target,str(door.id))
				approach(target)
				game.interact()
				await settle()
				row.function = service_audit(door)
				check(bool(row.function.opened) and bool(row.function.functional),"building-service",str(door.id),row.function)
				close_ui()
			game.go_back()
			await settle()
			row.returned = game.current_room.is_empty() and game.player.position.distance_to(before) < 0.01
			check(row.returned,"building-exit",str(door.id))
			buildings.append(row)
		print("AUDIT LAND ",land," doors ",doors.size()," outdoor NPC ",outdoor.size())
	var failed := results.filter(func(r):return not r.passed).size()
	var file := FileAccess.open(output+"/result.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"source":"fe19c7b8549150021cd8b0d7cf8beef4d308f951","display":DisplayServer.get_name(),"checks":results.size(),"passed":results.size()-failed,"failed":failed,"buildings":buildings,"npcs":npcs,"bindings":bindings,"results":results,"fixtures":"Navigation warps only to select existing interaction targets; service budgets/materials seeded; dialogue levels 1/2/3 are controlled fixture states. No production account or save used."},"\t"))
	file.close()
	root.remove_child(game)
	game.queue_free()
	game = null
	await settle(8)
	print("WORLD AUDIT ",results.size()-failed,"/",results.size())
	quit(1 if failed else 0)
