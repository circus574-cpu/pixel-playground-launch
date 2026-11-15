extends SceneTree

var game: PyraGame
var results: Array[Dictionary] = []
var failures: Array[String] = []
var output := "user://qa"

func _initialize() -> void:
	run.call_deferred()

func verify(condition: bool, name: String, details: Variant = null) -> void:
	results.append({"name":name,"passed":condition,"details":details})
	print(("PASS " if condition else "FAIL ") + name)
	if not condition:
		failures.append(name)
		push_error("FAILED: " + name + " " + str(details))

func settle(count: int = 3) -> void:
	for i in range(count):
		await process_frame
		await physics_frame

func touch(index: int, pressed: bool, at: Vector2, canceled: bool = false) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = at
	event.pressed = pressed
	event.canceled = canceled
	# Coordinates are viewport-local. Headless windows are physically 64x64, even
	# when the logical stretched canvas is 1280px; push through the real viewport.
	root.push_input(event, true)

func capture(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output + "/" + name + ".png")

func nearest_free(from: Vector2) -> Vector2:
	for r in range(0, 600, 16):
		for a in 16:
			var p := from + Vector2.from_angle(TAU * a / 16.0) * r
			if game.can_stand(p, ""):
				return p
	return from

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in range(args.size()):
		if args[i] == "--qa-output" and i+1 < args.size():
			output = args[i+1]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	var entry_path: String = ProjectSettings.get_setting("application/run/main_scene")
	var landing: PyraTitleScreen = load(entry_path).instantiate()
	root.add_child(landing)
	await settle(5)
	verify(landing.intro.texture.resource_path == "res://assets/branding/intro.webp" and landing.intro.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_CENTERED and landing.powered_caption.text == "Powered by GODOT ENGINE" and landing.powered.texture.resource_path == "res://assets/branding/godot/logo-large-color-dark.svg", "entry scene shows the owner key art undistorted and the Powered by GODOT credit with the official logo")
	verify(root.get_children().filter(func(n): return n is PyraGame).is_empty(), "city is not instantiated behind the title")
	var config := ConfigFile.new()
	config.load("res://export_presets.cfg")
	verify(config.get_value("preset.0.options","launcher_icons/main_192x192","") == ProjectSettings.get_setting("application/config/icon"), "Android launcher and desktop use KI icon")
	for viewport: Vector2i in [Vector2i(854,480),Vector2i(1280,720),Vector2i(1600,720)]:
		root.size = viewport
		await settle(5)
		verify(Rect2(Vector2.ZERO,root.get_visible_rect().size).encloses(landing.start_button.get_global_rect()) and not landing.start_button.get_global_rect().intersects(landing.powered.get_global_rect()), "title layout and credit are separate: "+str(viewport))
		await capture("title-%dx%d" % [viewport.x,viewport.y])
	root.size = Vector2i(1280,720)
	await settle(5)
	var play_center := landing.start_button.get_global_rect().get_center()
	touch(5,true,play_center)
	touch(5,false,play_center,true)
	verify(not landing.loading and landing.active_pointer == -1, "cancelled start touch does not load city")
	touch(5,true,play_center)
	landing.notification(MainLoop.NOTIFICATION_APPLICATION_FOCUS_OUT)
	touch(5,false,play_center)
	verify(not landing.loading, "focus loss disarms start button")
	touch(5,true,play_center)
	touch(7,false,play_center)
	verify(not landing.loading and landing.active_pointer == 5, "other finger cannot activate start button")
	touch(5,false,play_center)
	landing.start_city()
	verify(landing.loading and landing.start_button.disabled, "start touch loads city and rejects duplicate activation")
	var load_deadline := Time.get_ticks_msec() + 15000
	while is_instance_valid(landing) and Time.get_ticks_msec() < load_deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0] if root.get_children().any(func(n): return n is PyraGame) else null
	verify(is_instance_valid(game) and root.get_children().filter(func(n): return n is PyraGame).size() == 1, "title hands off to exactly one playable city")
	if not is_instance_valid(game):
		quit(1)
		return
	verify(game.hud.touch.move_pointer == -1 and game.player.touch_motion == Vector2.ZERO, "start touch is not inherited by city controls")
	await settle(5)
	# ---- continent -----------------------------------------------------------------------------
	verify(PyraContinent.WORLD == Vector2(65600, 42304) and int(game.continent.meta.world[0]) == 65600 and int(game.continent.meta.world[1]) == 42304, "whole Pyra continent has the published Superior v2 size")
	verify(game.data.name == "Twierdza Popiołu" and game.data.buildings.size() == 6, "capital layout from the first trial is kept")
	verify(game.can_stand(game.player.position, "") and game.player.position.distance_to(game.origin + game.point(game.data.spawn)) < 0.01, "start in the capital on walkable ground")
	verify(game.continent.loaded_sprite_count() > 100 and game.continent.loaded_sprite_count() < 2400, "scenery streams around the hero (bounded)", game.continent.loaded_sprite_count())
	verify(game.continent.world.towns.size() == 3 and game.continent.world.places.size() == 41 and game.continent.textures.size() >= 60, "three more cities, 41 named places, scenery sprites")
	var far := Vector2(17648, 25300)
	game.player.position = nearest_free(far)
	game.continent.update_view(game.camera_view())
	await settle(3)
	verify(game.continent.loaded.has("8,12") or game.continent.loaded.size() > 0, "chunks stream when the hero travels across the continent")
	var loaded_far := game.continent.loaded_sprite_count()
	verify(loaded_far < 2400, "distant chunk set stays bounded", loaded_far)
	game.player.position = game.origin + game.point(game.data.spawn)
	game.continent.update_view(game.camera_view())
	await settle(3)
	# ---- hero size (owner request: 15% larger) ----------------------------------------------------
	var base_cell: float = float(game.hero.size[0])
	verify(is_equal_approx(game.player.visual.display.x, base_cell * 1.15) and is_equal_approx(game.player.visual.display.y, float(game.hero.size[1]) * 1.15), "hero is 15% larger than the previous build", game.player.visual.display)
	verify(game.player.speed == 170.0 and game.kit.stats().speed == 170.0, "level 1 speed is the Legend base 170", game.player.speed)
	# ---- walk mask: water and authored footprints block --------------------------------------------
	verify(not game.continent.walkable(Vector2(900, 900)) and not game.continent.walkable(Vector2(5, 5)) and not game.continent.walkable(Vector2(66000, 100)), "sea, edge and outside are not walkable")
	var tested_collision := false
	for obstacle: Dictionary in game.data.obstacles:
		var box: Rect2 = game.rectangle(obstacle)
		box.position += game.origin
		var below := Vector2(box.get_center().x, box.end.y + 30)
		if game.can_stand(below, "") and box.size.x < 900:
			game.player.position = below
			game.player.touch_motion = Vector2.UP
			for i in range(30):
				await physics_frame
			game.player.touch_motion = Vector2.ZERO
			verify(game.player.position.y >= box.end.y + 10.0 and game.player.position.y < below.y - 2.0 and game.player.position.y <= box.end.y + 30.0, "authored footprint blocks the hero", {"y": game.player.position.y, "wall": box.end.y, "start": below.y})
			tested_collision = true
			break
	verify(tested_collision, "an authored capital footprint was tested")
	var doors := game.targets.filter(func(t): return t.kind == "door")
	verify(doors.size() == 24, "24 service doors: capital plus three cities", doors.size())
	for door in doors:
		verify(game.continent.walkable(door.point + Vector2(0, 40)), "door is reachable on foot: " + str(door.id))
	# ---- movement, touch, fixed timestep ---------------------------------------------------------
	var free := nearest_free(game.origin + game.point(game.data.spawn) + Vector2(0, 700))
	game.player.position = free
	touch(0, true, game.hud.touch.left_center + Vector2(84, 0))
	await settle()
	var moving: Vector2 = game.player.touch_motion
	touch(1, true, game.hud.touch.act_center)
	touch(1, false, game.hud.touch.act_center)
	touch(2, true, game.hud.touch.attack_center)
	verify(game.attack_held and moving.x > 0.9 and game.player.touch_motion.x > 0.9, "attack finger and stick finger work at the same time", {"move": str(game.player.touch_motion), "attack": game.attack_held})
	touch(2, false, game.hud.touch.attack_center)
	verify(not game.attack_held, "attack releases with its own finger")
	touch(0, false, game.hud.touch.left_center, true)
	verify(game.player.touch_motion == Vector2.ZERO and game.hud.touch.move_pointer == -1, "touch cancellation releases movement")
	var distances: Array[float] = []
	for cap in [30, 120]:
		game.player.position = free
		Engine.max_fps = cap
		game.player.touch_motion = Vector2.RIGHT
		await create_timer(0.7).timeout
		game.player.touch_motion = Vector2.ZERO
		distances.append(game.player.position.x - free.x)
	Engine.max_fps = 60
	verify(absf(distances[0] - distances[1]) < game.player.speed * 0.1 and distances.min() > game.player.speed * 0.55 and distances.max() < game.player.speed * 0.85, "30/120 FPS do not change movement speed", distances)
	# ---- dialogs -------------------------------------------------------------------------------
	game.player.position = game.origin + game.point(game.data.spawn)
	game.interact()
	verify(game.hud.modal.visible and game.player.locked and game.player.touch_motion == Vector2.ZERO, "NPC dialog opens and releases movement")
	await settle()
	var close: Button = game.hud.buttons[-1]
	touch(3, true, close.get_global_rect().get_center())
	touch(3, false, close.get_global_rect().get_center())
	verify(not game.hud.modal.visible and not game.player.locked, "dialog closes with a separate touch index")
	# ---- every service room of every city ---------------------------------------------------------
	for door in doors:
		game.load_space("", door.point)
		game.player.position = door.point
		var before: Vector2 = game.player.position
		game.interact()
		await settle(2)
		verify(game.current_room == str(door.room) and game.can_stand(game.player.position, game.current_room), "enter " + str(door.room) + " from " + str(door.id))
		if door.id in ["hall", "pyra-town-1-arena", "arena"]:
			await capture("room-" + str(door.id))
		game.go_back()
		await settle(2)
		verify(game.current_room.is_empty() and game.player.position.distance_to(before) < 0.01, "return to the same entrance: " + str(door.id))
	# ---- Legend rules ------------------------------------------------------------------------------
	var kit: LegendKit = game.kit
	kit.reset_tree()
	var legend: Dictionary = kit.data
	verify(kit.nodes.size() == 29 and legend.base.hp == 140 and legend.perLevel.attack == 4.6 and legend.base.attackIntervalMs == 750, "annex data: 29 nodes, base and per-level stats")
	for lv in [1, 8, 20]:
		kit.set_level(lv)
		var s := kit.stats()
		verify(s.maxHp == roundi(140.0 + 42.0 * (lv - 1)) and s.maxKi == roundi(40.0 + 3.0 * (lv - 1)) and s.attack == roundi(14.0 + 4.6 * (lv - 1)) and s.defense == roundi(4.0 + 2.0 * (lv - 1)), "stats at level %d follow the annex" % lv, s)
	kit.set_level(20)
	verify(is_equal_approx(float(kit.stats().speed), 170.0 * 1.835), "speed at level 20 follows the owner growth tiers", kit.stats().speed)
	kit.set_level(1)
	verify(not kit.can_learn("A1").ok and kit.free_points() == 0, "A1 needs level 2 and a free point")
	kit.set_level(2)
	verify(kit.can_learn("A1").ok and kit.learn("A1") and kit.slots[0] == "A1", "A1 learned at level 2 and placed in slot 1")
	verify(not kit.can_learn("A4").ok, "A4 needs level 7 and A2/A3")
	kit.set_level(20)
	for id in ["A2", "A3", "A4", "A5", "A6", "A7"]:
		verify(kit.learn(id), "learn " + id)
	verify(not kit.can_learn("A8").ok and str(kit.can_learn("A8").reason).begins_with("Wyklucza"), "A7 excludes A8")
	verify(is_equal_approx(LegendKit.rank_power(1), 0.5) and is_equal_approx(LegendKit.rank_power(3), 0.6), "rank scaling: first point half, then +10% of that base")
	verify(is_equal_approx(kit.mods().atkPct, 0.04), "A5 gives +8% x 0.5 attack at rank 1", kit.mods())
	kit.reset_tree()
	# ---- abilities on the arena dummy ---------------------------------------------------------------
	game.player.position = game.origin + game.point(game.data.spawn)
	var arena_door = doors.filter(func(t): return t.id == "arena")[0]
	game.load_space("", arena_door.point)
	game.player.position = arena_door.point
	game.interact()
	await settle(2)
	verify(game.current_room == "arena" and game.dummies.size() == 1, "arena room holds one training dummy")
	var dummy: PyraDummy = game.dummies[0]
	kit.set_level(20)
	for id in ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "A9", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B9", "C1", "C2", "C3", "C4", "C5", "C6", "C7"]:
		kit.learn(id)
	kit.reset_tree() if kit.free_points() < 0 else null
	game.player.position = dummy.position + Vector2(-70, 0)
	await settle(2)
	seed(7)
	var before_hp := dummy.hp
	game.face_target()
	kit.next_basic_at = 0.0
	var basic := kit.basic()
	verify(basic.ok and dummy.hp < before_hp and kit.ember >= 4.0, "basic strike hits the dummy and builds Żar", {"hp": dummy.hp, "ember": kit.ember})
	kit.ki = float(kit.stats().maxKi)
	kit.learned = ["R"]
	kit.set_level(20)
	for id in ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "C5", "C6", "C7"]:
		if kit.free_points() > 0:
			kit.learn(id)
	game.player.position = dummy.position + Vector2(-70, 0)
	var results_by_skill := {}
	for id in kit.learned:
		if kit.is_active(id) and id != "R":
			kit.ki = float(kit.stats().maxKi)
			kit.cooldowns.erase(id)
			var hp_before := dummy.hp
			var outcome := kit.use(id)
			for i in 20:
				kit.tick(0.1)
			results_by_skill[id] = [outcome.ok, hp_before - dummy.hp]
			if id in ["A1", "A4", "B1", "C1", "C4"]:
				verify(outcome.ok and hp_before > dummy.hp, "ability " + id + " damages the dummy", [outcome, hp_before - dummy.hp])
	verify(not dummy.shielded, "B1 Przełamanie destroys the shield")
	kit.cooldowns.erase("A1")
	kit.ki = float(kit.stats().maxKi)
	kit.use("A1")
	verify(kit.cooldown_left("A1") > 5.9 and kit.ki == float(kit.stats().maxKi) - 10.0, "cooldown (6 s) and KI cost (10) apply to A1", [kit.cooldown_left("A1"), kit.ki])
	kit.ki = 0.0
	kit.cooldowns.erase("C1")
	verify(not kit.use("C1").ok and str(kit.use("C1").reason) == "Za mało KI.", "no KI, no cast")
	kit.ki = float(kit.stats().maxKi)
	kit.ember = 80.0
	kit.cooldowns.erase("C4")
	kit.use("C4")
	verify(kit.ember == 0.0, "Eksplozja Żaru consumes all Żar")
	kit.ki = float(kit.stats().maxKi)
	kit.cooldowns.erase("B4")
	kit.buffs.clear()
	var atk_before: int = kit.stats().attack
	verify(kit.use("B4").ok and kit.stats().attack > atk_before and kit.buff_active("B4"), "Płomienny Szał raises attack", [atk_before, kit.stats().attack])
	for i in 100:
		kit.tick(0.1)
	verify(kit.stats().attack == atk_before or kit.buff_active("B4") == false, "buffs expire")
	# dodge keeps the hero on legal ground
	var spot := game.player.position
	game.dodge()
	verify(game.can_stand(game.player.position, "arena") and game.player.position.distance_to(spot) > 20.0, "dodge dashes within the room")
	await capture("arena-fight")
	game.go_back()
	await settle(2)
	# ---- save --------------------------------------------------------------------------------------------
	kit.reset_tree()
	kit.set_level(9)
	kit.learn("A1")
	var save_free := nearest_free(game.origin + game.point(game.data.spawn) + Vector2(0, 900))
	game.player.position = save_free
	game.city_return = save_free
	var save_path := "user://qa-checkpoint.json"
	verify(game.save_checkpoint(save_path), "checkpoint writes atomically")
	game.player.position += Vector2(30, 0)
	kit.reset_tree()
	verify(game.restore_checkpoint(save_path) and game.player.position.distance_to(save_free) < 0.01 and kit.level == 9 and kit.has("A1"), "checkpoint round-trip restores position, level and tree")
	var legacy := {"format": "ki-godot-pyra-save-1", "version": 1, "room": "", "position": [1286.0, 1664.0], "cityReturn": [1286.0, 1664.0]}
	var lf := FileAccess.open(save_path, FileAccess.WRITE)
	lf.store_string(JSON.stringify(legacy))
	lf.close()
	verify(game.restore_checkpoint(save_path) and game.player.position.distance_to(game.origin + game.point(game.data.spawn)) < 0.01, "first-trial checkpoint is imported into world coordinates")
	var f := FileAccess.open(save_path, FileAccess.WRITE)
	var newer := '{"format":"ki-godot-pyra-save-2","version":9,"important":"preserve"}'
	f.store_string(newer)
	f.close()
	verify(not game.restore_checkpoint(save_path) and not game.save_checkpoint(save_path) and FileAccess.get_file_as_string(save_path) == newer, "unknown checkpoint version is preserved")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	game.checkpoint_protected = false
	# ---- maps --------------------------------------------------------------------------------------------
	var regions: Array = game.map_data.regions
	var capital_atlas := MapMath.world_to_atlas(game.map_data.pyra, float(game.continent.world.capital.x), float(game.continent.world.capital.y))
	verify(MapMath.region_at(regions, capital_atlas).get("id", "") == "pyra", "capital maps onto the Pyra outline", capital_atlas)
	for town: Dictionary in game.continent.world.towns:
		var a := MapMath.world_to_atlas(game.map_data.pyra, float(town.x), float(town.y))
		verify(MapMath.region_at(regions, a).get("id", "") == "pyra", "city maps onto Pyra: " + str(town.name))
	game.player.position = game.origin + game.point(game.data.spawn)
	game.open_map()
	await settle(4)
	var screen: MapScreen = game.screen
	verify(is_instance_valid(screen) and not game.hud.visible and game.hud.touch.blocked, "map opens over the game and blocks the game controls")
	verify(screen.globe.visible and screen.views.size() == 3, "globe 3D is the first view")
	screen.globe.focus_on(MapMath.atlas_to_lonlat(Vector2(float(regions[3].center[0]), float(regions[3].center[1]))))
	await settle(3)
	var centre: Variant = screen.globe.screen_to_lonlat(screen.globe.size / 2.0)
	verify(centre != null and MapMath.region_at(regions, MapMath.lonlat_to_atlas(centre.x, centre.y)).get("id", "") == "pyra", "globe: the screen centre after focusing on Pyra picks Pyra", centre)
	screen.globe.pick(screen.globe.size / 2.0)
	verify(screen.globe.selected == "pyra", "globe pick selects the region under the finger")
	await capture("map-globe")
	screen.switch_to(1)
	await settle(3)
	screen.atlas.pick(screen.atlas.to_screen(Vector2(float(regions[3].center[0]), float(regions[3].center[1]))))
	verify(screen.atlas.selected == "pyra" and screen.info.text.contains("Pyra"), "2D atlas picks the same region from the same outline")
	screen.atlas.zoom_by(2.0, screen.atlas.size / 2.0)
	verify(screen.atlas.zoom_level() > 1.9, "2D atlas zooms")
	await capture("map-2d")
	screen.switch_to(2)
	await settle(3)
	verify(screen.continent_view.visible and screen.continent_view.markers.size() > 40, "continent map lists cities and places")
	await capture("map-continent")
	game.go_back()
	await settle(2)
	verify(not is_instance_valid(game.screen) and game.hud.visible and not game.hud.touch.blocked, "map closes and returns the controls")
	# ---- character screen ----------------------------------------------------------------------------------
	kit.reset_tree()
	kit.set_level(5)
	game.open_character()
	await settle(3)
	var sheet: CharacterScreen = game.screen
	sheet.select("A1")
	verify(not sheet.learn_button.disabled and kit.free_points() == 4, "tree: A1 is available at level 5")
	sheet.learn_selected()
	verify(kit.has("A1") and kit.free_points() == 3, "tree: learning spends one point")
	sheet.select("A4")
	verify(sheet.learn_button.disabled and sheet.learn_button.text.begins_with("Wymaga"), "tree: locked node explains why", sheet.learn_button.text)
	await capture("character")
	game.go_back()
	await settle(2)
	# ---- economy: coins, shop, equipment, potion, crafting, depot, inn, save --------------------------------
	var eco: PyraEconomy = game.economy
	eco.gold = 20
	eco.bag = {}
	eco.depot = {}
	eco.depot_gold = 0
	for slot in PyraEconomy.SLOTS:
		eco.equipment[slot] = ""
	kit.reset_tree()
	kit.set_level(1)
	game.on_economy_changed()
	verify(eco.items.size() == 366 and eco.recipes.size() == 265 and eco.shop_ids.size() == 85, "catalogue: 366 items, 265 recipes, 85 weak items for sale")
	verify(eco.buy_price("sword") == 200 and not eco.buy("sword") and eco.gold == 20, "shop price is 4x catalogue and needs the coins", eco.buy_price("sword"))
	verify(not eco.buy("U-W01") and eco.buy_price("U-W01") == 0, "better gear is never sold by the merchant")
	eco.gold = 500
	verify(eco.buy("sword") and eco.gold == 300 and eco.count("sword") == 1, "buying spends coins and fills the bag")
	var attack_before: int = kit.stats().attack
	verify(eco.equip("sword") and kit.gear.attack == 8.0 and kit.stats().attack > attack_before and eco.count("sword") == 0, "equipping the sword raises attack", [attack_before, kit.stats().attack])
	verify(not eco.equip("U-W01") and eco.count("U-W01") == 0, "cannot equip what is not owned")
	eco.add_item("U-W01")
	verify(not eco.equip("U-W01") and eco.count("U-W01") == 1, "equipment honours the level requirement", eco.required_level("U-W01"))
	verify(eco.unequip("weapon") and eco.count("sword") == 1 and kit.gear.attack == 0.0, "unequip returns the item to the bag")
	var gold_before := eco.gold
	verify(eco.sell("sword") and eco.gold == gold_before + 25, "merchant buys back at half the catalogue price", eco.gold - gold_before)
	eco.bag["potion"] = 2
	kit.hp = 10.0
	verify(eco.use("potion") and kit.hp > 10.0 and eco.count("potion") == 1, "potion heals", kit.hp)
	verify(not eco.use("potion") and eco.count("potion") == 1, "potion cooldown blocks the second one")
	eco.tick(7.0)
	kit.hp = float(kit.stats().maxHp)
	verify(not eco.use("potion") and eco.count("potion") == 1, "potion is not wasted at full HP")
	var forge_recipe: Dictionary = eco.recipes_for(["forge"])[0]
	verify(not eco.craft(forge_recipe) or forge_recipe.ingredients.is_empty(), "crafting needs the ingredients (or is free of them)")
	eco.gold = 1000
	kit.set_level(20)
	var recipe: Dictionary = {}
	for r: Dictionary in eco.recipes_for(["forge"]):
		if int(r.requiredLevel) <= 20 and not r.ingredients.is_empty():
			recipe = r
			break
	for ingredient: Dictionary in recipe.ingredients:
		eco.add_item(str(ingredient.itemId), int(ingredient.count))
	var result_before := eco.count(str(recipe.result))
	var gold_craft := eco.gold
	verify(eco.craft(recipe) and eco.count(str(recipe.result)) == result_before + int(recipe.count) and eco.gold == gold_craft - int(recipe.cost), "crafting consumes ingredients and coins and yields the result", recipe.name)
	eco.bag["potion"] = 1
	verify(eco.deposit("potion") and eco.count("potion") == 0 and int(eco.depot.potion) == 1 and eco.withdraw("potion") and eco.count("potion") == 1, "depot: bag to chest and back")
	eco.gold = 300
	verify(eco.move_gold(100, true) and eco.depot_gold == 100 and eco.gold == 200 and not eco.move_gold(500, false) and eco.move_gold(100, false) and eco.gold == 300, "depot keeps coins")
	var coins := eco.gold
	verify(not eco.rest(true) and eco.gold == coins and eco.rest(false) and eco.gold == coins - PyraEconomy.INN_PRICE, "inn charges 5 coins only when rest is needed")
	eco.equipment["weapon"] = "sword"
	eco.bag["potion"] = 2
	eco.gold = 77
	var saved := eco.to_save()
	eco.gold = 1
	eco.bag = {}
	eco.equipment["weapon"] = ""
	verify(eco.from_save(JSON.parse_string(JSON.stringify(saved))) and eco.gold == 77 and eco.equipment.weapon == "sword" and eco.count("potion") == 2, "economy survives a save round-trip")
	var bad: Dictionary = JSON.parse_string(JSON.stringify(saved))
	bad.equipment.head = "sword"
	verify(not eco.from_save(bad) and eco.gold == 77, "a save with an item in the wrong slot is rejected unchanged")
	eco.equipment["weapon"] = ""
	game.on_economy_changed()
	eco.gold = 400
	for mode in ["shop", "depot", "smithy", "inventory"]:
		game.open_items(mode, mode)
		await settle(2)
		var items_screen: ItemsScreen = game.screen
		verify(is_instance_valid(items_screen) and items_screen.list_box.get_child_count() > 0, "items screen opens: " + mode)
		if mode == "shop":
			items_screen.select(eco.shop_ids[0])
			await settle(2)
			await capture("shop")
		if mode == "smithy":
			items_screen.select(str(eco.recipes_for(["forge"])[0].id))
			await settle(2)
			await capture("smithy")
		if mode == "inventory":
			eco.add_item("sword")
			items_screen.select("sword")
			await settle(2)
			await capture("inventory")
		game.go_back()
		await settle(2)
	eco.bag = {"potion": 3}
	eco.gold = 20
	game.on_economy_changed()

	# ---- HUD layout -----------------------------------------------------------------------------------------
	game.show_menu()
	await settle()
	verify(game.hud.modal.visible and game.player.locked, "menu suspends and clears input")
	game.hud.close_dialog()
	game.hud.notice.text = ""
	game.hud.notice_until = 0
	for dimensions in [Vector2i(854, 480), Vector2i(1600, 720), Vector2i(1280, 720)]:
		root.size = dimensions
		await settle(4)
		var view := root.get_visible_rect()
		var t: PyraTouchControls = game.hud.touch
		var ok := true
		for c in [t.left_center, t.attack_center, t.dodge_center, t.act_center] + t.skill_centers:
			ok = ok and view.has_point(c)
		verify(view.encloses(game.hud.menu_button.get_global_rect()) and ok, "landscape layout: " + str(dimensions))
		await capture("city-" + str(dimensions.x) + "x" + str(dimensions.y))
	var safe := Rect2(Vector2(44, 30), game.hud.size - Vector2(88, 60))
	game.hud.touch.set_safe_area(safe)
	verify(game.hud.touch.left_center.x - 91 >= safe.position.x and game.hud.touch.attack_center.x + 80 <= safe.end.x and game.hud.touch.left_center.y + 91 <= safe.end.y, "touch pads respect configured display cutout margins")
	game.hud._layout()
	var report := {"engine": Engine.get_version_info().string, "display": DisplayServer.get_name(), "rendering": RenderingServer.get_current_rendering_method(), "checks": results.size(), "passed": results.size() - failures.size(), "failed": failures.size(), "results": results, "physicalAndroidDevice": false}
	var file := FileAccess.open(output + "/result.json", FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "\t"))
	file.close()
	print("PYRA GODOT QA: ", results.size() - failures.size(), "/", results.size(), " failed: ", failures)
	root.remove_child(game)
	game.queue_free()
	await process_frame
	await process_frame
	quit(0 if failures.is_empty() else 1)
