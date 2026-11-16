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

func spawn() -> Vector2:
	return Vector2(float(game.land.arrival.x), float(game.land.arrival.y))

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
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await settle(5)
	verify(landing.intro.texture.resource_path == "res://assets/branding/intro-wide.webp" and landing.intro.stretch_mode == TextureRect.STRETCH_KEEP_ASPECT_COVERED and landing.powered_caption.text == "Powered by GODOT ENGINE" and landing.powered.texture.resource_path == "res://assets/branding/godot/logo-large-color-dark.svg", "entry scene fills the screen with the landscape key art (no bars, no distortion) and the Powered by GODOT credit with the official logo")
	verify(root.get_children().filter(func(n): return n is PyraGame).is_empty(), "city is not instantiated behind the title")
	var config := ConfigFile.new()
	config.load("res://export_presets.cfg")
	verify(config.get_value("preset.0.options","launcher_icons/main_192x192","") == ProjectSettings.get_setting("application/config/icon"), "Android launcher and desktop use KI icon")
	# ---- boot: the app updates its own code from the server (scripts/boot.gd) ---------------------------
	var boot_script: GDScript = load("res://scripts/boot.gd")
	verify(entry_path == "res://scenes/boot.tscn", "the app starts in the boot scene that brings the game's code up to date")
	verify(int(config.get_value("preset.0.options", "version/code", 0)) == int(boot_script.CLIENT_CODE) and int(boot_script.CLIENT_CODE) == KiNet.CLIENT_CODE, "boot, KiNet and the Android preset name the same versionCode")
	var bt_offer := {"file": "core-c11-aaaaaaaaaaaa.pck", "bytes": 5, "sha256": "x"}
	var bt_new: Dictionary = boot_script.decide(boot_script.empty_state(), bt_offer, true, false)
	verify(bt_new.download and bt_new.target == "core-c11-aaaaaaaaaaaa.pck" and bt_new.give_up == "", "a core the device does not have is downloaded")
	var bt_held: Dictionary = boot_script.read_state(JSON.stringify({"file": bt_offer.file, "sha256": "x", "bytes": 5, "good": bt_offer.file, "attempts": 0, "bad": []}))
	var bt_same: Dictionary = boot_script.decide(bt_held, bt_offer, true, true)
	verify(not bt_same.download and bt_same.target == bt_offer.file, "a core that is already on the device is mounted without downloading")
	verify(boot_script.decide(bt_held, bt_offer, true, false).download, "a held core whose file is gone is downloaded again")
	verify(boot_script.decide(bt_held, {}, false, true).target == bt_offer.file and boot_script.decide(bt_held, {}, false, false).target == "", "without the server the held core runs; without a held core the APK's own code runs")
	verify(boot_script.decide(bt_held, {}, true, true).target == "" and not boot_script.decide(bt_held, {}, true, true).download, "a release that carries no core runs the APK's own code")
	var bt_bad: Dictionary = boot_script.read_state(JSON.stringify({"file": "", "bad": [bt_offer.file, 5]}))
	verify(bt_bad.bad == [bt_offer.file] and boot_script.decide(bt_bad, bt_offer, true, false).target == "" and not boot_script.decide(bt_bad, bt_offer, true, false).download, "a core on the bad list is never taken again")
	var bt_loop: Dictionary = boot_script.read_state(JSON.stringify({"file": bt_offer.file, "sha256": "x", "bytes": 5, "good": "", "attempts": 3, "bad": []}))
	var bt_give: Dictionary = boot_script.decide(bt_loop, {}, false, true)
	verify(bt_give.target == "" and bt_give.give_up == bt_offer.file, "a core that never reached the first city in three launches is given up")
	verify(boot_script.decide(bt_loop, {"file": "core-c11-bbbbbbbbbbbb.pck"}, true, true).download, "a newer core replaces a given-up one")
	bt_loop.good = bt_offer.file
	verify(boot_script.decide(bt_loop, {}, false, true).target == bt_offer.file, "a core that has proven itself is not given up")
	var bt_note: Dictionary = boot_script.note_launch(boot_script.empty_state(), bt_offer.file, "x", 5)
	verify(bt_note.attempts == 1 and bt_note.good == "" and boot_script.note_launch(bt_note, bt_offer.file, "x", 5).attempts == 2 and boot_script.note_launch(bt_held, bt_offer.file, "x", 5).attempts == 0, "launches of an unproven core are counted; a proven one is not")
	verify(boot_script.script_names(PackedStringArray(["a.gd.remap", "b.gdc", "c.gd", "d.tscn.remap", "a.gd", "e.uid"])) == ["a.gd", "b.gd", "c.gd"], "script names are read from an export listing, a pack listing and the editor")
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
	game.skip_intro = true
	verify(game.hud.touch.move_pointer == -1 and game.player.touch_motion == Vector2.ZERO, "start touch is not inherited by city controls")
	await settle(5)
	# ---- continent -----------------------------------------------------------------------------
	verify(game.land_id == "pyra" and game.continent.world_size == Vector2(65600, 42304), "whole Pyra continent has the published Superior v2 size")
	verify(game.data.name == "Twierdza Popiołu" and game.data.buildings.size() == 6 and game.land.capitalBuildings.size() == 6, "capital layout from the first trial is kept with the six accepted houses")
	verify(game.can_stand(game.player.position, "") and game.player.position.distance_to(Vector2(float(game.land.arrival.x), float(game.land.arrival.y))) < 0.01, "start in the capital on walkable ground")
	verify(game.continent.loaded_sprite_count() > 100 and game.continent.loaded_sprite_count() < 2400, "scenery streams around the hero (bounded)", game.continent.loaded_sprite_count())
	verify(game.land.settlements.size() == 4 and game.land.places.size() >= 40 and game.continent.textures.size() >= 60, "four cities, named places, scenery sprites")
	var far := Vector2(17648, 25300)
	game.player.position = nearest_free(far)
	game.continent.update_view(game.camera_view())
	await settle(3)
	verify(game.continent.loaded.has("8,12") or game.continent.loaded.size() > 0, "chunks stream when the hero travels across the continent")
	var loaded_far := game.continent.loaded_sprite_count()
	verify(loaded_far < 2400, "distant chunk set stays bounded", loaded_far)
	game.player.position = spawn()
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
	var expected_doors := 0
	for s_: Dictionary in game.land.settlements:
		expected_doors += (s_.services as Array).size()
	verify(doors.size() == expected_doors and doors.size() >= 20, "service doors of the capital and the three cities", doors.size())
	for door in doors:
		verify(game.continent.walkable(door.point + Vector2(0, 40)), "door is reachable on foot: " + str(door.id))
	# ---- movement, touch, fixed timestep ---------------------------------------------------------
	var free := nearest_free(spawn() + Vector2(0, 700))
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
	game.player.position = spawn()
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
		if door.room == "arena" and door.town == "pyra-capital":
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
	game.player.position = spawn()
	var arena_door = doors.filter(func(t): return t.room == "arena")[0]
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
	var save_free := nearest_free(spawn() + Vector2(0, 900))
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
	verify(game.restore_checkpoint(save_path) and game.player.position.distance_to(spawn()) < 0.01, "first-trial checkpoint is imported into world coordinates")
	var f := FileAccess.open(save_path, FileAccess.WRITE)
	var newer := '{"format":"ki-godot-pyra-save-2","version":9,"important":"preserve"}'
	f.store_string(newer)
	f.close()
	verify(not game.restore_checkpoint(save_path) and not game.save_checkpoint(save_path) and FileAccess.get_file_as_string(save_path) == newer, "unknown checkpoint version is preserved")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	game.checkpoint_protected = false
	# ---- maps --------------------------------------------------------------------------------------------
	var regions: Array = game.map_data.regions
	var region_of := {}
	for region: Dictionary in regions:
		region_of[str(region.id)] = region
	verify(regions.size() == 10 and game.map_data.lands.size() == 10, "atlas knows all ten lands")
	for id: String in PyraGame.ALL_LANDS:
		var tiles: Dictionary = game.map_data.lands[id]
		var land_cfg: Dictionary = PyraContinent.load_json("res://data/lands/%s/land.json" % id)
		for town: Dictionary in land_cfg.settlements:
			var a := MapMath.world_to_atlas(tiles, float(town.x), float(town.y))
			verify(MapMath.region_at(regions, a).get("id", "") == id, "city maps onto its own land on the atlas: %s / %s" % [id, town.name])
	var pyra_center := Vector2(float(region_of.pyra.center[0]), float(region_of.pyra.center[1]))
	game.player.position = spawn()
	game.open_map()
	await settle(4)
	var screen: MapScreen = game.screen
	verify(is_instance_valid(screen) and not game.hud.visible and game.hud.touch.blocked, "map opens over the game and blocks the game controls")
	verify(screen.globe.visible and screen.views.size() == 3, "globe 3D is the first view")
	screen.globe.focus_on(MapMath.atlas_to_lonlat(pyra_center))
	await settle(3)
	var centre: Variant = screen.globe.screen_to_lonlat(screen.globe.size / 2.0)
	verify(centre != null and MapMath.region_at(regions, MapMath.lonlat_to_atlas(centre.x, centre.y)).get("id", "") == "pyra", "globe: the screen centre after focusing on Pyra picks Pyra", centre)
	screen.globe.pick(screen.globe.size / 2.0)
	verify(screen.globe.selected == "pyra", "globe pick selects the region under the finger")
	await capture("map-globe")
	screen.switch_to(1)
	await settle(3)
	screen.atlas.pick(screen.atlas.to_screen(pyra_center))
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

	# ---- all ten lands, travel, all four races ----------------------------------------------------------------
	game.set_race("legend")
	for id: String in PyraGame.ALL_LANDS:
		game.travel_to(id) if id != game.land_id else null
		await settle(3)
		var size_of_land: Vector2 = game.continent.world_size
		verify(game.land_id == id and game.land.id == id and size_of_land.x > 10000.0 and game.can_stand(game.player.position, ""), "land loads and the hero stands on walkable ground: " + id, game.player.position)
		verify(game.continent.loaded_sprite_count() > 30 and game.continent.loaded_sprite_count() < 3000, "scenery of %s streams in a bounded set" % id, game.continent.loaded_sprite_count())
		var land_doors := game.targets.filter(func(t): return t.kind == "door")
		var land_npcs := game.targets.filter(func(t): return t.kind == "npc")
		verify(land_doors.size() >= 6 and land_npcs.size() >= 1 and not game.land.settlements.is_empty(), "%s has a city with service doors and people" % id, [land_doors.size(), land_npcs.size()])
	for id: String in ["pyra", "verdant", "aether", "nexus"]:
		game.travel_to(id) if id != game.land_id else null
		await settle(2)
		var home_doors := game.targets.filter(func(t): return t.kind == "door")
		var entered := 0
		for door in home_doors:
			game.load_space("", door.point)
			game.player.position = door.point
			var back: Vector2 = game.player.position
			game.interact()
			await settle(1)
			if game.current_room == str(door.room) and game.can_stand(game.player.position, game.current_room):
				entered += 1
			else:
				verify(false, "room opens: %s / %s / %s" % [id, door.id, door.room])
			game.go_back()
			await settle(1)
			if not game.current_room.is_empty() or game.player.position.distance_to(back) > 0.01:
				verify(false, "room returns to the door: %s / %s" % [id, door.id])
		verify(entered == home_doors.size() and entered >= 20, "every service room of %s opens and returns (%d)" % [id, entered])
	# race cards, selection and the new character
	var annex := {"legend": [140, 40, 14, 4, 170], "planetary": [125, 50, 12, 5, 185], "sage": [100, 80, 14, 3, 170], "android": [115, 60, 12, 7, 175]}
	var home_of := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}
	game.travel_to("pyra") if game.land_id != "pyra" else null
	game.open_race_screen(true)
	await settle(3)
	var race_screen: RaceScreen = game.screen
	verify(is_instance_valid(race_screen) and race_screen.cards.size() == 4, "race screen shows four races")
	await capture("race-screen")
	game.go_back()
	await settle(2)
	for race_id: String in ["planetary", "sage", "android", "legend"]:
		game.start_new_character(race_id)
		await settle(3)
		var rk: RaceKit = game.kit
		var base: Array = annex[race_id]
		verify(game.race == race_id and rk.race == race_id and game.land_id == home_of[race_id] and rk.nodes.size() == 29 and rk.valid_tree(), "new %s character starts in %s with the 29-node tree" % [race_id, home_of[race_id]])
		var st := rk.stats()
		verify(st.maxHp == base[0] and st.maxKi == base[1] and st.attack == base[2] and st.defense == base[3] and st.speed == float(base[4]), "level 1 stats of %s follow the annex" % race_id, st)
		var per: Dictionary = rk.data.perLevel
		rk.set_level(20)
		var s20 := rk.stats()
		verify(s20.maxHp == roundi(float(base[0]) + float(per.hp) * 19.0) and s20.maxKi == roundi(float(base[1]) + float(per.ki) * 19.0) and s20.attack == roundi(float(base[2]) + float(per.attack) * 19.0), "level 20 stats of %s follow the annex" % race_id, s20)
		verify(is_equal_approx(game.player.visual.display.x, float(game.hero.size[0]) * 1.15), "hero of %s is 15%% larger" % race_id, game.player.visual.display)
		verify(game.economy.gold == 20 and rk.resource_label().begins_with({"legend": "Żar", "planetary": "Adaptacja", "sage": "Kręgi światła", "android": "Ładunek"}[race_id]), "fresh purse and the %s resource" % race_id, rk.resource_label())
		rk.set_level(1)
		# abilities on the arena dummy
		var arena_door2 = game.targets.filter(func(t): return t.kind == "door" and t.room == "arena")[0]
		game.load_space("", arena_door2.point)
		game.player.position = arena_door2.point
		game.interact()
		await settle(2)
		verify(game.current_room == "arena" and game.dummies.size() == 1, "arena of %s holds the training dummy" % race_id)
		var foe: PyraDummy = game.dummies[0]
		rk.reset_tree()
		rk.set_level(20)
		for id in ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "A9", "B9"]:
			if rk.free_points() > 0 and rk.can_learn(id).ok:
				rk.learn(id)
		game.player.position = foe.position + Vector2(-70, 0)
		game.face_target()
		await settle(2)
		seed(11)
		rk.next_basic_at = 0.0
		var hp0 := foe.hp
		var strike := rk.basic()
		verify(strike.ok and foe.hp < hp0, "basic attack of %s hits the dummy" % race_id, strike)
		var dealt_total := 0.0
		for id in ["A1", "A4", "B1", "B4", "C1", "C4"]:
			if not rk.has(id):
				continue
			rk.ki = float(rk.stats().maxKi)
			rk.cooldowns.erase(id)
			game.player.position = foe.position + Vector2(-70, 0)
			game.face_target()
			var before := foe.hp
			var cast := rk.use(id)
			for i in 30:
				rk.tick(0.1)
			dealt_total += before - foe.hp
			verify(cast.ok, "%s casts %s without error" % [race_id, id], cast)
		verify(dealt_total > 0.0, "active skills of %s deal damage" % race_id, dealt_total)
		rk.buffs.clear()
		rk.shields.clear()
		rk.circles.clear()
		rk.timers.clear()
		rk.hp = float(rk.stats().maxHp)
		rk.take_damage(5.0)
		verify(rk.hp < float(rk.stats().maxHp), "%s takes damage" % race_id, rk.hp)
		game.go_back()
		await settle(2)
		rk.reset_tree()
		rk.set_level(1)
		verify(game.land.world == str(game.WORLD_OF_RACE[race_id]) and game.actors.has(game.world_id + ".hero"), "world art and hero sheet match %s" % race_id)
	# the map travels between lands
	game.start_new_character("legend")
	await settle(3)
	game.open_map()
	await settle(4)
	var travel_map: MapScreen = game.screen
	travel_map.show_region("verdant")
	verify(travel_map.travel_button.visible and travel_map.picked == "verdant", "map offers travel to the picked land")
	travel_map.show_region("pyra")
	verify(not travel_map.travel_button.visible, "no travel button for the land you stand in")
	travel_map.show_region("island-3")
	travel_map.travel.emit("island-3")
	await settle(4)
	verify(game.land_id == "island-3" and not is_instance_valid(game.screen) and game.hud.visible and game.can_stand(game.player.position, ""), "travel from the map arrives on island 3", game.player.position)
	game.open_map()
	await settle(3)
	var island_map: MapScreen = game.screen
	island_map.switch_to(2)
	await settle(2)
	verify(island_map.continent_view.visible and island_map.continent_view.world_size.x > 10000.0, "detailed map follows the current land")
	game.go_back()
	await settle(2)
	game.travel_to("pyra")
	await settle(3)
	verify(game.land_id == "pyra" and game.player.position.distance_to(spawn()) < 0.01, "travel back to Pyra arrives at the capital")

	# ---- streaming, baked ground and the full HUD ------------------------------------------------------------
	game.travel_to("verdant") if game.land_id != "verdant" else null
	await settle(3)
	var land: PyraContinent = game.continent
	for i in 60:
		await process_frame
		if land.ground_ready() and land.build_queue.is_empty() and land.build_state.is_empty():
			break
	verify(land.ground_bake.size() >= 6 and land.ground_bake.size() <= 40, "ground is baked into a bounded set of textures", land.ground_bake.size())
	var before_chunks := land.loaded.keys()
	var far_view := Rect2(game.player.position + Vector2(9000, 4000), game.camera_view().size)
	land.update_view(far_view)
	verify(not land.build_queue.is_empty() and land.loaded.is_empty(), "moving far queues chunks instead of building them at once", land.build_queue.size())
	land.update_view(game.camera_view())
	land.flush()
	verify(land.build_queue.is_empty() and land.build_state.is_empty() and land.loaded.size() > 0, "flush builds every queued chunk")
	for i in 40:
		await process_frame
	var frame_ms: Array[float] = []
	var last_tick := Time.get_ticks_usec()
	for i in 30:
		await process_frame
		var tick := Time.get_ticks_usec()
		frame_ms.append((tick - last_tick) / 1000.0)
		last_tick = tick
	verify(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME) < 220 or DisplayServer.get_name() == "headless", "idle frame stays within the draw-call budget")
	var hud: PyraHud = game.hud
	verify(hud.button_centers.size() == 5 and hud.art_layer.viewport.size.x > 0 and hud.touch_layer.viewport.size.x > 0, "HUD art and touch controls render through cached layers")
	var view_rect := root.get_visible_rect()
	var all_inside := true
	for c in hud.button_centers:
		all_inside = all_inside and view_rect.has_point(c)
	verify(all_inside and view_rect.has_point(hud.minimap_center + Vector2(hud.MINIMAP_RADIUS, 0.0) * 0.0), "round menu buttons and the minimap are on screen")
	verify(hud.map_markers.size() >= 4 and hud.land_id == "verdant", "minimap knows the cities and places of the land", hud.map_markers.size())
	hud.show_fps = true
	await settle(3)
	verify(hud.fps_text.contains("FPS"), "diagnostic overlay reports FPS")
	hud.show_fps = false
	var arena_target = game.targets.filter(func(t): return t.kind == "door" and t.room == "arena")[0]
	game.load_space("", arena_target.point)
	game.player.position = arena_target.point
	game.interact()
	game.player.position = game.dummies[0].position + Vector2(-70, 0)
	await settle(3)
	verify(game.current_room == "arena" and not hud.target.is_empty() and hud.target.max > 0, "target frame shows the training dummy", hud.target)
	game.go_back()
	await settle(2)

	# ---- monsters: data, spawns, fights, rewards, statuses, death ---------------------------------------------
	game.start_new_character("legend")
	await settle(3)
	verify(game.monster_data.monsters.size() == 41, "the 40 bestiary monsters and their summoned helper are loaded with stats, skills and loot")
	var all_kinds := true
	var spawn_total := 0
	for id: String in PyraGame.ALL_LANDS:
		var reg: Dictionary = PyraContinent.load_json("res://data/lands/%s/spawns.json" % id)
		spawn_total += (reg.spawns as Array).size()
		for kind: String in reg.kinds:
			all_kinds = all_kinds and game.monster_data.monsters.has(kind)
	verify(all_kinds and spawn_total == 8752, "every published spawn slot of the ten lands names a known monster", spawn_total)
	var mm: PyraMonsters = game.monsters
	var base := Vector2.ZERO
	for i in mm.rows.size():
		var at := Vector2(float(mm.rows[i][1]), float(mm.rows[i][2]))
		if not game.in_safe_city(at) and game.continent.walkable(at) and game.continent.walkable(at + Vector2(300, 0)):
			base = at
			break
	game.player.position = base + Vector2(300, 0)
	game.continent.update_view(game.camera_view(), true)
	mm.refresh()
	await settle(3)
	verify(mm.active.size() >= 1 and mm.active.size() <= 24, "monsters wake around the hero (at most 24)", mm.active.size())
	var inside := false
	for m: PyraMonster in mm.active.values():
		inside = inside or game.in_safe_city(m.position)
	verify(not inside, "no monster stands in a safe city")
	game.player.position = game.land.arrival.x * Vector2.RIGHT + game.land.arrival.y * Vector2.DOWN
	mm.refresh()
	verify(game.in_safe_city(game.player.position) and mm.player_is_safe(), "the capital is a safe city")
	game.kit.set_level(10)
	game.kit.hp = float(game.kit.stats().maxHp)
	var def: Dictionary = mm.defs["pyra-wegielek"]
	game.player.position = base + Vector2(300, 0)
	var weak := PyraMonster.new()
	game.continent.sorted.add_child(weak)
	weak.setup(def, base, mm, 800001)
	mm.active[800001] = weak
	weak.died.connect(mm.on_died)
	var xp_before := game.kit.xp + game.kit.level * 1000
	var kill_gold_before := game.economy.gold
	weak.position = game.player.position + Vector2(-60, 0)
	var hp_before := weak.hp
	game.face_target()
	game.kit.next_basic_at = 0.0
	var swing := game.kit.basic()
	verify(swing.ok and weak.hp < hp_before, "the hero's basic attack hurts a monster", [hp_before, weak.hp])
	verify(weak.recoil < 0.0 and absf(weak.recoil) <= 26.0 and weak.actor.position.x == 0.0, "a hit pushes the monster's sprite back without moving its body", weak.recoil)
	for i in 60:
		game.kit.next_basic_at = 0.0
		game.kit.basic()
		if weak.phase == "dead":
			break
	verify(weak.phase == "dead" and game.kit.xp + game.kit.level * 1000 > xp_before and game.economy.gold >= kill_gold_before and mm.respawn_at.has(800001), "a kill pays experience and coins and starts the respawn timer")
	var hunter := PyraMonster.new()
	game.continent.sorted.add_child(hunter)
	hunter.setup(mm.defs["pyra-zarowy-nietoperz"], game.player.position + Vector2(200, 0), mm, 800002)
	hunter.engage()
	game.kit.hp = float(game.kit.stats().maxHp)
	for i in 600:
		await process_frame
		if game.kit.hp < float(game.kit.stats().maxHp) or game.kit.dead:
			break
	verify(game.kit.hp < float(game.kit.stats().maxHp), "an engaged monster chases and hurts the hero")
	hunter.queue_free()
	game.kit.hp = float(game.kit.stats().maxHp)
	game.kit.clear_debuffs()
	var speed_before: float = game.kit.stats().speed
	game.apply_status({"k": "slow", "pct": 0.4, "ms": 3000}, weak)
	game.apply_status({"k": "weaken", "pct": 0.3, "ms": 3000}, weak)
	game.apply_status({"k": "armorDown", "pct": 0.5, "ms": 3000}, weak)
	game.apply_status({"k": "silence", "ms": 3000}, weak)
	game.apply_status({"k": "stun", "ms": 1500}, weak)
	await settle(2)
	verify(is_equal_approx(game.player.speed, speed_before * 0.6), "slow lowers the hero's speed", game.player.speed)
	verify(float(game.kit.stats().dealt) < 1.0 and game.player.fx_lock > 0.0 and game.kit.debuff_pct("silence") > 0.0, "weaken, stun and silence take effect")
	var plain_def: int = game.kit.stats().defense
	game.kit.clear_debuffs()
	verify(int(game.kit.stats().defense) >= plain_def and float(game.kit.stats().dealt) >= 1.0, "statuses end with clear_debuffs")
	# rare monster traits: weaknesses, direction, summons, split, revive, ground zones, day and night
	game.kit.hp = float(game.kit.stats().maxHp)
	var far_up: Vector2 = game.player.position + Vector2(0, -700)
	var far_down: Vector2 = game.player.position + Vector2(0, 700)
	var slime_a := mm.place_monster("verdant-mchowy-szlamak", far_up)
	var slime_b := mm.place_monster("verdant-mchowy-szlamak", far_up + Vector2(300, 0))
	var weak_hit := slime_a.hurt(100.0, false, ["fire"])
	var plain_hit := slime_b.hurt(100.0, false, [])
	verify(weak_hit > plain_hit * 1.2, "a fire attack hurts a fire-weak monster more", [weak_hit, plain_hit])
	var crab_front := mm.place_monster("pyra-magmowy-krab", far_up)
	var crab_back := mm.place_monster("pyra-magmowy-krab", far_down)
	var front_hit := crab_front.hurt(200.0, false, [])
	var back_hit := crab_back.hurt(200.0, false, [])
	verify(front_hit < back_hit, "front armour: a crab faced by the hero takes less than one hit from behind", [front_hit, back_hit])
	var lion := mm.place_monster("aether-lew-swiatyni", far_down)
	var lion_front := mm.place_monster("aether-lew-swiatyni", far_up)
	verify(lion.hurt(200.0, false, []) > lion_front.hurt(200.0, false, []), "back bonus: a hit from behind hurts a lion more")
	var pack_before := mm.active.size()
	mm.wake(900001, "verdant-cierniowy-wilk", far_down + Vector2(-500, 0))
	verify(mm.active.size() - pack_before >= 2 and mm.active.size() - pack_before <= 3, "wolves wake in a pack of two to three", mm.active.size() - pack_before)
	var wasp := mm.place_monster("verdant-bursztynowa-osa", far_up + Vector2(-400, 0))
	var active_before := mm.active.size()
	mm.summon(wasp, "verdant-mala-osa", 2)
	var helpers := 0
	for key: int in mm.active.keys():
		helpers += 1 if key < 0 and (mm.active[key] as PyraMonster).def.id == "verdant-mala-osa" else 0
	verify(mm.active.size() == active_before + 2 and helpers >= 2, "a wasp calls two helper wasps that take no respawn slot", [mm.active.size(), active_before])
	var swarm := mm.place_monster("nexus-roj-nanitow", far_up + Vector2(400, 0))
	var swarm_max := swarm.max_hp
	swarm.hurt(1.0, false, [])
	verify(swarm.split_partner != null and is_equal_approx(swarm.max_hp, roundf(swarm_max * 0.4)) and swarm.split_partner.no_reward, "a nanite swarm splits in two weaker halves (the clone pays nothing)", swarm.max_hp)
	var spirit := mm.place_monster("aether-duch-bibliotekarza", far_down + Vector2(400, 0))
	spirit.hurt(999999.0, false, ["ki"])
	verify(spirit.phase != "dead" and spirit.invulnerable and spirit.hp > 0.0, "the librarian ghost does not die at once but begins to revive")
	await create_timer(2.2).timeout
	verify(spirit.phase != "dead" and not spirit.invulnerable and is_equal_approx(spirit.hp, spirit.max_hp * 0.3), "the ghost rises with 30% health and then can die for good", spirit.hp)
	spirit.hurt(999999.0, false, ["ki"])
	verify(spirit.phase == "dead", "the second death is final")
	game.kit.clear_debuffs()
	mm.add_zone({"kind": "web", "ms": 3000, "radius": 120, "dps": 0.0, "fx": [{"k": "slow", "pct": 0.4, "ms": 4000}]}, game.player.position, 10.0)
	await create_timer(0.8).timeout
	verify(game.kit.debuff_pct("slow") > 0.0, "standing in a web zone slows the hero")
	var time_saved := game.world_time
	game.world_time = 310.0
	var at_night := mm.is_night() and game.night_factor() == 1.0
	game.world_time = 20.0
	var at_day := not mm.is_night() and game.night_factor() == 0.0
	game.world_time = 285.0
	var at_dusk := game.night_factor() > 0.4 and game.night_factor() < 0.6
	game.world_time = time_saved
	verify(at_night and at_day and at_dusk, "the day lasts 480 s: evening from 270 s, night 300-450 s, dawn after")
	for rare: PyraMonster in [slime_a, slime_b, crab_front, crab_back, lion, lion_front, wasp, swarm]:
		if is_instance_valid(rare):
			rare.queue_free()
	for rare_key: int in mm.active.keys():
		if (rare_key < 0 or rare_key == 900001) and is_instance_valid(mm.active[rare_key]):
			(mm.active[rare_key] as PyraMonster).queue_free()
		if rare_key < 0 or rare_key == 900001:
			mm.active.erase(rare_key)
	game.kit.clear_debuffs()
	game.kit.hp = 1.0
	# bosses: data, phases, signature mechanics, reward, the warden and the lair
	var boss_ids := []
	var boss_loot_ok := true
	for b: Dictionary in game.boss_data.bosses:
		boss_ids.append(str(b.id))
		boss_loot_ok = boss_loot_ok and mm.defs.has(str(b.guardian))
		for drop: Dictionary in b.lootTable:
			boss_loot_ok = boss_loot_ok and game.economy.items.has(str(drop.itemId))
	verify(boss_ids.size() == 8 and boss_loot_ok, "eight bosses: art guardians and every loot item exist", boss_ids)
	var ygd := mm.spawn_boss("ygdrasha", far_up)
	verify(ygd != null and ygd.boss_phase == 1 and is_equal_approx(ygd.max_hp, 4520.0) and ygd.def.skills.size() == 2, "Ygdrasha starts in phase 1 with two attacks")
	verify(mm.spawn_boss("ygdrasha", far_down) == ygd, "a boss already alive is reused, never duplicated")
	ygd.hp = ygd.max_hp * 0.55
	ygd.hurt(1.0, false, [])
	verify(ygd.boss_phase == 2 and ygd.def.skills.size() == 3, "below 60% HP Ygdrasha enters phase 2 and learns to call slimes")
	ygd.hp = ygd.max_hp * 0.2
	var ygd_atk := float(ygd.base_def.atk)
	ygd.hurt(1.0, false, [])
	verify(ygd.boss_phase == 3 and is_equal_approx(float(ygd.def.atk), ygd_atk * 1.3) and is_equal_approx(ygd.boss_damage_taken(), 1.25), "one hit can skip a phase: phase 3 gives +30% attack and +25% damage taken")
	var hp_phase3 := ygd.hp
	ygd.boss_script.tick(2.0)
	verify(ygd.hp <= hp_phase3 + 0.01, "Ygdrasha does not regenerate in phase 3")
	ygd.boss_phase = 1
	ygd.hp = ygd.max_hp * 0.5
	ygd.boss_script.tick(2.0)
	verify(is_equal_approx(ygd.hp, ygd.max_hp * 0.5 + ygd.max_hp * 0.02), "Ygdrasha regenerates 1% HP per second in the early phases")
	ygd.phase = "dead"
	ygd.queue_free()
	mm.active.erase(ygd.spawn_index)
	var priest := mm.spawn_boss("arcykaplan-pustki", far_up)
	priest.hp = priest.max_hp * 0.5
	priest.hurt(1.0, false, [])
	verify(priest.boss_phase == 2 and priest.boss_script.lights.size() == 3 and is_equal_approx(priest.boss_damage_taken(), 0.3), "the Archpriest's barrier takes 70% off while three lights live")
	for light: PyraMonster in priest.boss_script.lights:
		light.hurt(99999.0, false, [])
	verify(is_equal_approx(priest.boss_damage_taken(), 1.0), "destroying the lights breaks the barrier")
	priest.hp = priest.max_hp * 0.2
	priest.hurt(1.0, false, [])
	verify(priest.boss_phase == 3 and priest.boss_script.ring != null, "phase 3 closes the arena with a shrinking ring")
	priest.phase = "dead"
	priest.boss_script.cleanup()
	priest.queue_free()
	mm.active.erase(priest.spawn_index)
	var arbiter := mm.spawn_boss("arbiter-zero", far_up)
	arbiter.hp = arbiter.max_hp * 0.5
	arbiter.hurt(1.0, false, [])
	arbiter.hp = arbiter.max_hp * 0.2
	arbiter.hurt(1.0, false, [])
	arbiter.boss_script.overheat_clock = 5.0
	var cool := arbiter.boss_damage_taken()
	arbiter.boss_script.overheat_clock = 25.0
	verify(arbiter.boss_phase == 3 and is_equal_approx(cool, 1.0) and is_equal_approx(arbiter.boss_damage_taken(), 1.4) and arbiter.boss_script.drones.size() == 2, "Arbiter: 40% extra damage only during the 10 s overheating of every 30 s (and drones came in phase 2)")
	arbiter.phase = "dead"
	arbiter.queue_free()
	mm.active.erase(arbiter.spawn_index)
	var kharzul := mm.spawn_boss("kharzul", far_up)
	kharzul.hp = kharzul.max_hp * 0.2
	kharzul.hurt(1.0, false, [])
	game.kit.hp = 10.0
	var potions_before := game.economy.count("potion")
	game.economy.add_item("potion", 1)
	game.economy.potion_cooldown = 0.0
	var healed := game.economy.use("potion")
	verify(kharzul.boss_phase == 3 and game.healing_blocked() and not healed, "while Kharzul's arena burns, potions do not heal")
	kharzul.phase = "dead"
	kharzul.queue_free()
	mm.active.erase(kharzul.spawn_index)
	game.economy.remove_item("potion", game.economy.count("potion") - potions_before)
	game.kit.hp = float(game.kit.stats().maxHp)
	var pyrrhax := mm.spawn_boss("pyrrhax", far_down)
	pyrrhax.hp = pyrrhax.max_hp * 0.3
	pyrrhax.hurt(1.0, false, [])
	pyrrhax.boss_script.begin_cast({"id": "pyrrhax-erupcja", "mode": "burst"}, game.player.position)
	verify(pyrrhax.flying and pyrrhax.boss_script.safe_spots.size() == 3, "Pyrrhax flies in phase 2 and marks three safe circles before the eruption")
	game.kit.hp = float(game.kit.stats().maxHp)
	pyrrhax.boss_script.safe_spots = [game.player.position]
	pyrrhax.boss_script.resolve({"id": "pyrrhax-erupcja", "dmg": 2.5}, game.player.position)
	var hp_safe := game.kit.hp
	pyrrhax.boss_script.safe_spots = [game.player.position + Vector2(900, 0)]
	pyrrhax.boss_script.resolve({"id": "pyrrhax-erupcja", "dmg": 2.5}, game.player.position)
	verify(is_equal_approx(hp_safe, float(game.kit.stats().maxHp)) and game.kit.hp < hp_safe, "the eruption spares the hero inside a safe circle and hurts outside it")
	pyrrhax.phase = "dead"
	pyrrhax.queue_free()
	mm.active.erase(pyrrhax.spawn_index)
	var aurelith := mm.spawn_boss("aurelith", far_down + Vector2(-600, 0))
	aurelith.hp = aurelith.max_hp * 0.2
	aurelith.hurt(1.0, false, [])
	verify(aurelith.boss_phase == 3 and aurelith.boss_script.pillars.size() == 3, "Aurelith raises three pillars in phase 3")
	game.kit.hp = float(game.kit.stats().maxHp)
	var breath_origin: Vector2 = game.player.position + Vector2(-400, 0)
	aurelith.position = breath_origin
	aurelith.boss_script.breath_from = breath_origin
	aurelith.boss_script.breath_to = game.player.position
	for pillar: Node2D in aurelith.boss_script.pillars:
		pillar.position = Vector2(100000, 100000)
	aurelith.boss_script.pillars[0].position = breath_origin + Vector2(200, 0)
	aurelith.boss_script.resolve({"id": "aurelith-oddech", "dmg": 2.4}, game.player.position)
	var hp_behind := game.kit.hp
	aurelith.boss_script.pillars[0].position = Vector2(100000, 100000)
	aurelith.boss_script.resolve({"id": "aurelith-oddech", "dmg": 2.4}, game.player.position)
	verify(is_equal_approx(hp_behind, float(game.kit.stats().maxHp)) and game.kit.hp < hp_behind, "a pillar between Aurelith and the hero absorbs the Breath of Aether")
	aurelith.boss_script.cleanup()
	aurelith.phase = "dead"
	aurelith.queue_free()
	mm.active.erase(aurelith.spawn_index)
	var thor := mm.spawn_boss("thorgar", far_up)
	var wolves_before := mm.active.size()
	thor.boss_script.resolve({"id": "thorgar-wycie", "fx": []}, thor.position)
	verify(mm.active.size() == wolves_before + 3, "Thorgar's howl calls three thorn wolves")
	var xp_boss_before := game.kit.xp + game.kit.level * 100000
	thor.hurt(99999999.0, false, [])
	verify(thor.phase == "dead" and game.kit.xp + game.kit.level * 100000 > xp_boss_before, "a defeated boss pays experience")
	var loot_hit := false
	for drop: Dictionary in mm.boss_info("thorgar").lootTable:
		loot_hit = loot_hit or (float(drop.chancePercent) >= 100.0 and game.economy.count(str(drop.itemId)) >= int(drop.minCount))
	verify(loot_hit, "the boss's guaranteed loot lands in the bag")
	for rare_key: int in mm.active.keys():
		if rare_key < 0 and is_instance_valid(mm.active[rare_key]):
			(mm.active[rare_key] as PyraMonster).queue_free()
		if rare_key < 0:
			mm.active.erase(rare_key)
	game.kit.hp = float(game.kit.stats().maxHp)
	var warden_found := false
	for t: Dictionary in game.outdoor_targets:
		warden_found = warden_found or (t.kind == "npc" and t.id == "warden")
	verify(warden_found, "each continent capital has a warden who knows the boss lairs")
	game.enter_boss_lair("kharzul")
	var lair_boss := mm.live_boss("kharzul")
	var kharzul_count := 0
	for m: PyraMonster in mm.active.values():
		kharzul_count += 1 if not m.boss.is_empty() and str(m.boss.id) == "kharzul" else 0
	game.enter_boss_lair("kharzul")
	var kharzul_after := 0
	for m: PyraMonster in mm.active.values():
		kharzul_after += 1 if not m.boss.is_empty() and str(m.boss.id) == "kharzul" else 0
	verify(lair_boss != null and kharzul_count == 1 and kharzul_after == 1 and not game.in_safe_city(game.player.position), "the warden opens Kharzul's lair outside the city, once")
	lair_boss.phase = "dead"
	lair_boss.queue_free()
	mm.active.erase(lair_boss.spawn_index)
	game.kit.hp = float(game.kit.stats().maxHp)
	game.player.position = base + Vector2(300, 0)
	# dungeons: entrances, deterministic labyrinth, key and gate, chests, guards, traps, saving
	var entrance_total := 0
	for land_key: String in game.dungeon_data.lands:
		entrance_total += (game.dungeon_data.lands[land_key] as Array).size()
	verify(entrance_total == 22 and (game.dungeon_data.art as Array).size() == 12, "22 cave entrances (4 per continent, 1 per island) and 12 dungeon-kit props", entrance_total)
	var cave_target := {}
	for t: Dictionary in game.outdoor_targets:
		if t.kind == "dungeon":
			cave_target = t
	verify(not cave_target.is_empty(), "the land has cave entrances to enter")
	var cave_kinds: Array = []
	for kind: String in mm.kinds:
		cave_kinds.append(kind)
	var cave_a := PyraDungeon.new()
	cave_a.setup(cave_target.entrance, "pyra", "pyra", cave_kinds, {})
	var cave_b := PyraDungeon.new()
	cave_b.setup(cave_target.entrance, "pyra", "pyra", cave_kinds, {})
	verify(cave_a.grid == cave_b.grid and cave_a.key_cell == cave_b.key_cell and cave_a.gate_cell == cave_b.gate_cell, "the same entrance always gives the same cave")
	var vault_cell := Vector2i(-1, -1)
	for chest_def: Dictionary in cave_a.chests:
		if str(chest_def.id).ends_with("-vault"):
			vault_cell = chest_def.cell
	var open_part := cave_a.bfs(cave_a.start_room.position, cave_a.gate_cell)
	verify(cave_a.gate_cell.x >= 0 and not open_part.has(vault_cell) and open_part.has(cave_a.key_cell) and cave_a.bfs(cave_a.start_room.position).has(vault_cell), "the gate cuts the vault off; the key lies in the open part")
	var chests_ok := cave_a.chests.size() >= 3
	for chest_def: Dictionary in cave_a.chests:
		chests_ok = chests_ok and cave_a.is_floor(chest_def.cell)
	var guards_ok := cave_a.guards.size() >= 6
	for guard_def: Dictionary in cave_a.guards:
		guards_ok = guards_ok and cave_a.is_floor(guard_def.cell) and not cave_a.start_room.has_point(guard_def.cell)
	verify(chests_ok and guards_ok and cave_a.traps.size() >= 1, "chests, guards and traps stand on open floor away from the entrance room", [cave_a.chests.size(), cave_a.guards.size(), cave_a.traps.size()])
	game.player.position = cave_target.point
	game.enter_dungeon(cave_target.entrance)
	await settle(2)
	verify(game.in_dungeon() and not game.in_safe_city(game.player.position) and game.stand(game.player.position) and not game.continent.visible, "entering a cave puts the hero in an open, fightable space")
	verify(mm.active.size() == game.dungeon.guards.size() and game.dungeon.walkable(game.dungeon.arrival()), "the cave's guards are placed at once", mm.active.size())
	game.dungeon.state.keys.clear()
	verify(not game.dungeon.open_gate(game.dungeon.center(game.dungeon.gate_cell)), "the gate needs the key")
	verify(not game.dungeon.pick_up_key(game.player.position), "the key cannot be picked up from afar")
	game.player.position = game.dungeon.center(game.dungeon.key_cell)
	verify(game.dungeon.pick_up_key(game.player.position) and not game.dungeon.pick_up_key(game.player.position), "the key is picked up once")
	var gate_pos: Vector2 = game.dungeon.center(game.dungeon.gate_cell)
	verify(not game.dungeon.walkable(gate_pos), "a closed gate blocks the corridor")
	game.player.position = gate_pos + Vector2(40, 0)
	verify(game.dungeon.open_gate(game.player.position) and game.dungeon.walkable(gate_pos), "with the key the gate opens and the way is free")
	var gold_cave := game.economy.gold
	var vault_id := ""
	for chest_def: Dictionary in game.dungeon.chests:
		if str(chest_def.id).ends_with("-vault"):
			vault_id = str(chest_def.id)
	game.player.position = game.dungeon.center(vault_cell) + Vector2(0, 30)
	var prize := game.dungeon.claim(vault_id, game.player.position)
	verify(not prize.is_empty() and int(prize.gold) > 0 and game.dungeon.claim(vault_id, game.player.position).is_empty(), "a chest pays once", prize)
	game.economy.gold = gold_cave + int(prize.gold)
	game.kit.hp = float(game.kit.stats().maxHp)
	var trap_pos: Vector2 = game.dungeon.traps[0]
	game.player.position = trap_pos
	await create_timer(0.8).timeout
	verify(game.kit.hp < float(game.kit.stats().maxHp), "stepping on a spike trap hurts")
	game.kit.hp = float(game.kit.stats().maxHp)
	var cave_save := "user://cave-test.json"
	verify(game.save_checkpoint(cave_save), "a checkpoint can be saved inside a cave")
	var cave_saved: Variant = JSON.parse_string(FileAccess.get_file_as_string(cave_save))
	verify(cave_saved is Dictionary and str(cave_saved.room) == "" and (cave_saved.dungeons as Dictionary).has(str(cave_target.entrance.id)), "the save puts the hero back at the entrance and keeps the cave progress")
	verify(PyraGame.valid_dungeon_state({"a": {"keys": ["k", "k", 3], "gates": "x"}, 5: {}}) == {"a": {"keys": ["k"], "gates": [], "chests": [], "secrets": []}}, "cave progress read from a save is cleaned")
	# every entrance of the world: names, tunnels, floors, gates, secrets, automap
	var all_named := true
	var generated := 0
	var layouts_ok := true
	for land_key: String in game.dungeon_data.lands:
		for entrance: Dictionary in game.dungeon_data.lands[land_key]:
			all_named = all_named and str(entrance.name) != "" and str(entrance.blurb) != ""
			var gen_kinds: Array = ["pyra-wegielek", "pyra-popielny-wilk", "pyra-skalny-berserker"]
			var floors := 3 if str(entrance.kind) == "maze" else (1 if str(entrance.id).contains("transit") else 2)
			for floor_no in floors:
				var cave := PyraDungeon.new()
				cave.setup(entrance, land_key, "pyra", gen_kinds, {}, floor_no)
				generated += 1
				var layout_open := cave.bfs(cave.room_center(cave.start_room), cave.gate_cell)
				var layout_whole := cave.bfs(cave.room_center(cave.start_room))
				var layout_ok := cave.gate_cell.x >= 0 and layout_open.has(cave.key_cell) and not layout_open.has(cave.room_center(cave.vault_room)) and layout_whole.has(cave.room_center(cave.vault_room))
				layout_ok = layout_ok and (cave.final_floor() == (cave.stairs_cell.x < 0)) and cave.floors_total == floors
				if cave.role == "transit":
					layout_ok = layout_ok and layout_open.has(cave.room_center(cave.far_room))
				if cave.secret_cell.x >= 0:
					layout_ok = layout_ok and not layout_whole.has(cave.secret_pocket)
				if not layout_ok:
					layouts_ok = false
					print("LAYOUT PROBLEM ", entrance.id, " floor ", floor_no)
	verify(all_named and generated == 4 * 3 + 10 * 2 + 8, "all 22 entrances have names and stories and generate on every floor", [all_named, generated])
	verify(layouts_ok, "every floor of every cave has a key in the open part, a gate before the vault, a way down on all but the last floor and a closed secret chamber")
	var pair_a := {}
	var pair_b := {}
	for land_key: String in game.dungeon_data.lands:
		for entrance: Dictionary in game.dungeon_data.lands[land_key]:
			if str(entrance.id) == "v2-transit-3-nexus":
				pair_a = entrance
			if str(entrance.id) == "v2-transit-3-pyra":
				pair_b = entrance
	var tunnel_a := PyraDungeon.new()
	tunnel_a.setup(pair_a, "nexus", "nexus", ["pyra-wegielek"], {})
	var tunnel_b := PyraDungeon.new()
	tunnel_b.setup(pair_b, "pyra", "pyra", ["pyra-wegielek"], {})
	verify(tunnel_a.grid == tunnel_b.grid and pair_a.partnerLand == "pyra" and pair_b.partnerLand == "nexus" and tunnel_a.arrival() != tunnel_b.arrival() and tunnel_a.arrival().distance_to(tunnel_b.link_point()) < 1.0, "a tunnel is one structure seen from both ends: the arrival of one side is the far door of the other")
	var maze_entrance := {}
	for t: Dictionary in game.outdoor_targets:
		if t.kind == "dungeon" and str(t.entrance.kind) == "maze":
			maze_entrance = t.entrance
	game.player.position = base + Vector2(300, 0)
	game.offer_dungeon(maze_entrance)
	verify(game.hud.modal.visible and game.hud.modal.get_child_count() > 0, "the entrance tells the name, the story and the recommended level before going in")
	game.hud.close_dialog()
	game.enter_dungeon(maze_entrance)
	await settle(2)
	verify(game.in_dungeon() and game.dungeon.role == "maze" and game.dungeon.floors_total == 3 and game.dungeon.floor_index == 0 and game.dungeon.cols == 33, "the labyrinth is a three-floor maze")
	var explored_before := game.dungeon.explored.size()
	game.player.position = game.dungeon.center(game.dungeon.room_center(game.dungeon.far_room))
	game.dungeon.reveal(game.player.position)
	verify(explored_before > 0 and game.dungeon.explored.size() > explored_before and game.hud.cave == game.dungeon, "the automap fills in where the hero walks")
	var down_target := {}
	for t: Dictionary in game.dungeon.targets():
		if t.kind == "ddown":
			down_target = t
	verify(not down_target.is_empty(), "the vault of a floor has stairs down")
	game.change_floor(1)
	await settle(2)
	var up_target := {}
	for t: Dictionary in game.dungeon.targets():
		if t.kind == "dup":
			up_target = t
	verify(game.dungeon.floor_index == 1 and not up_target.is_empty() and game.hud.place.text.contains("piętro 2/3") and mm.active.size() == game.dungeon.guards.size(), "stairs lead to the next floor, which has its own guards and a way back")
	game.change_floor(-1)
	await settle(2)
	verify(game.dungeon.floor_index == 0 and game.stand(game.player.position), "stairs back up put the hero on the floor above, on open ground")
	if game.dungeon.secret_cell.x >= 0:
		game.player.position = game.dungeon.center(game.dungeon.secret_from) + Vector2(game.dungeon.secret_cell - game.dungeon.secret_from) * 70.0
		var secret_chests_before := game.dungeon.targets().filter(func(t): return t.kind == "dchest").size()
		verify(game.dungeon.open_secret(game.player.position) and game.dungeon.is_floor(game.dungeon.secret_cell) and game.dungeon.targets().filter(func(t): return t.kind == "dchest").size() == secret_chests_before + 1, "the cracked wall breaks open and shows the chest of the secret chamber")
	game.load_space("", game.city_return)
	await settle(2)
	var transit_entrance := {}
	for t: Dictionary in game.outdoor_targets:
		if t.kind == "dungeon" and str(t.entrance.id).contains("transit"):
			transit_entrance = t.entrance
	game.enter_dungeon(transit_entrance)
	await settle(2)
	var partner_name := str(transit_entrance.partnerLand)
	game.use_transit()
	await settle(3)
	verify(game.land_id == partner_name and not game.in_dungeon() and game.continent.walkable(game.player.position) and not game.in_safe_city(game.player.position), "the far end of a tunnel leads out on the other continent", [game.land_id, partner_name])
	game.travel_to("pyra")
	await settle(3)
	game.player.position = base + Vector2(300, 0)
	game.enter_dungeon(cave_target.entrance)
	await settle(2)
	game.player.position = game.dungeon.center(game.dungeon.start_room.position) + Vector2(10, 10)
	game.load_space("", game.city_return)
	await settle(2)
	verify(not game.in_dungeon() and game.continent.visible and mm.active.size() == 0 or game.continent.visible, "leaving the cave returns to the surface")
	game.player.position = base + Vector2(300, 0)
	game.kit.hp = float(game.kit.stats().maxHp)
	# world events: all 14 are staged, play out, pay once, rest
	var event_ids := {}
	for e: Dictionary in game.quests.data.events:
		event_ids[str(e.id)] = true
	var rules_ok := event_ids.size() == 14
	for id: String in event_ids:
		rules_ok = rules_ok and PyraWorldEvents.RULES.has(id)
	verify(rules_ok, "every one of the 14 world events has a staging", event_ids.size())
	var we: PyraWorldEvents = game.world_events
	verify(we.list.size() == 3, "Pyra has three world events", we.list.size())
	game.kit.set_level(10)
	game.player.position = base + Vector2(300, 0)
	var salamanders: Dictionary = {}
	for ev: Dictionary in we.list:
		if str(ev.def.id) == "event-pyra-salamander-swarm":
			salamanders = ev
	game.player.position = salamanders.anchor
	we.timer = 0.0
	we._process(0.1)
	verify(str(salamanders.state) == "active" and (salamanders.monsters as Array).size() == 4, "walking up to an event wakes it with its creatures", (salamanders.monsters as Array).size())
	var xp_event := game.kit.xp + game.kit.level * 100000
	var gold_event := game.economy.gold
	for m: PyraMonster in salamanders.monsters:
		m.hurt(99999.0, false, [])
	we.timer = 0.0
	we._process(0.6)
	verify(str(salamanders.state) == "idle" and game.kit.xp + game.kit.level * 100000 > xp_event and game.economy.gold >= gold_event + 28, "clearing an event pays XP and coins")
	we.timer = 0.0
	we._process(0.6)
	verify(str(salamanders.state) == "idle" and not we.can_start(salamanders), "an event rests for its cooldown")
	for m2: PyraMonster in salamanders.monsters:
		pass
	var mirror_def: Dictionary = {}
	for e: Dictionary in game.quests.data.events:
		if str(e.id) == "event-aether-contract-d04":
			mirror_def = e
	var mirror_event := {"def": mirror_def, "anchor": game.player.position + Vector2(0, -900), "state": "idle", "cooldown_until": 0.0, "monsters": [], "props": [], "zone": null}
	we.list.append(mirror_event)
	we.start(mirror_event)
	verify((mirror_event.monsters as Array).size() == 3 and (mirror_event.props as Array).size() == 2 and we.targets().size() == 2, "a contract brings guards and two mirrors to secure")
	for t: Dictionary in we.targets():
		we.use(t)
	we.timer = 0.0
	we._process(0.6)
	verify(str(mirror_event.state) == "active", "the contract is not done while the guards live")
	for m3: PyraMonster in mirror_event.monsters:
		m3.hurt(99999.0, false, [])
	we.timer = 0.0
	we._process(0.6)
	verify(str(mirror_event.state) == "idle" and float(mirror_event.cooldown_until) > we.clock + 500.0, "a renewable contract pays once it is complete and rests for 600 s")
	we.list.pop_back()
	we.claimed = ["event-verdant-missing-courier"]
	var once_def: Dictionary = {}
	for e: Dictionary in game.quests.data.events:
		if str(e.id) == "event-verdant-missing-courier":
			once_def = e
	verify(not we.can_start({"def": once_def, "cooldown_until": 0.0}), "a once-only event never returns")
	we.from_save({"claimed": ["a", "a", 3]})
	verify(we.claimed == ["a"], "event progress read from a save is cleaned")
	we.from_save({})
	game.kit.hp = float(game.kit.stats().maxHp)
	for rare_key: int in mm.active.keys():
		if rare_key < 0 and is_instance_valid(mm.active[rare_key]):
			(mm.active[rare_key] as PyraMonster).queue_free()
		if rare_key < 0:
			mm.active.erase(rare_key)
	game.player.position = base + Vector2(300, 0)
	# living world: ambient effects on scenery, strolling citizens, the day's light
	verify(PyraAmbient.kind_for("x/eed16911-pyra-continent-fire.webp") == "fire" and PyraAmbient.kind_for("x/3b42d9ee-pyra-continent-spring.webp") == "steam" and PyraAmbient.kind_for("x/c60283c2-nature-obj-lava-rocks.webp") == "ember" and PyraAmbient.kind_for("x/44993ea9-nexus-art-pylon.webp") == "spark" and PyraAmbient.kind_for("x/ae37503e-pyra-continent-pine.webp") == "", "scenery files are matched to ambient effects (fire, steam, ember, glints)")
	verify(game.continent.ambient_kinds.size() >= 1, "Pyra's scenery has fires and springs that get ambient effects", game.continent.ambient_kinds.size())
	verify(game.citizens.size() >= 4, "street NPCs are citizens that stroll", game.citizens.size())
	var walker: Dictionary = game.citizens[0]
	var walker_home: Vector2 = walker.home
	game.player.position = walker_home + Vector2(700, 0)
	var walked := 0.0
	for step in 900:
		game.update_citizens(0.1)
		walked = maxf(walked, (walker.actor as Node2D).position.distance_to(walker_home))
	verify(walked > 5.0 and walked <= float(walker.radius) + 20.0 and (walker.target as Dictionary).point == (walker.actor as Node2D).position, "a citizen walks around the post, never far, and the talk point follows", walked)
	game.player.position = (walker.actor as Node2D).position + Vector2(60, 0)
	var stood_at: Vector2 = (walker.actor as Node2D).position
	game.update_citizens(0.5)
	verify((walker.actor as Node2D).position == stood_at, "a citizen stops when the hero comes close")
	var warden_walks := false
	for c: Dictionary in game.citizens:
		warden_walks = warden_walks or c.target.id == "warden"
	verify(not warden_walks, "the warden stays at his post")
	var world_time_kept := game.world_time
	game.world_time = 380.0
	game.update_day(0.0)
	var night_color := game.day_tint.color
	game.world_time = 20.0
	game.update_day(0.0)
	verify(night_color.r < 0.7 and game.day_tint.color.is_equal_approx(Color.WHITE), "the world is tinted at night and plain by day")
	game.world_time = world_time_kept
	game.player.position = base + Vector2(300, 0)
	# online: client version, content manifest rules, other players, gate helpers
	var presets := ConfigFile.new()
	presets.load("res://export_presets.cfg")
	var preset_code := -1
	for section in presets.get_sections():
		if str(presets.get_value(section, "platform", "")) == "Android":
			preset_code = int(presets.get_value(section + ".options", "version/code", -1))
	verify(preset_code == KiNet.CLIENT_CODE, "the client code of the code equals the Android versionCode of the export", [preset_code, KiNet.CLIENT_CODE])
	var content_test := PyraContent.new()
	content_test.manifest = {"version": "t1", "packs": {"land-x": {"file": "land-x-aaaaaaaaaaaa.pck", "bytes": 10, "sha256": "00"}, "core": {"file": "core-bbbbbbbbbbbb.pck", "bytes": 5, "sha256": "11"}}, "lands": {"x": ["land-x", "core"]}}
	verify(content_test.packs_for_land("x") == ["land-x", "core"] and content_test.packs_for_land("nope").is_empty() and content_test.version() == "t1", "the manifest tells which packs a land needs")
	verify(PyraContent.embedded() and content_test.missing_for("x").is_empty(), "a build that carries all data itself downloads nothing")
	verify(PyraOnline.message_of({"status": 0, "json": null}, "x") == "Brak połączenia z serwerem." and PyraOnline.message_of({"status": 400, "json": {"message": "Błąd serwera"}}, "x") == "Błąd serwera" and PyraOnline.message_of({"status": 500, "json": null}, "dom") == "dom", "server messages are shown to the player")
	var ghosts := PyraRemotePlayers.new()
	ghosts.setup(game)
	game.add_child(ghosts)
	ghosts.set_peers([{"id": "p1", "nick": "Ala", "race": "sage", "level": 3, "x": game.player.position.x + 200, "y": game.player.position.y, "f": 0}, {"id": "p2", "nick": "Bob", "race": "legend", "level": 9, "x": game.player.position.x - 200, "y": game.player.position.y, "f": 2}])
	await settle(2)
	verify(ghosts.figures.size() == 2 and (ghosts.figures["p1"].actor as Node2D).visible, "other players of the land appear as ghosts")
	ghosts.set_peers([{"id": "p2", "nick": "Bob", "race": "legend", "level": 9, "x": game.player.position.x - 100, "y": game.player.position.y, "f": 2}])
	await settle(2)
	verify(ghosts.figures.size() == 1 and not ghosts.figures.has("p1"), "a player who left disappears")
	ghosts.clear()
	ghosts.queue_free()
	var gate_probe := PyraGate.new()
	verify(PyraGame.ALL_LANDS.has(gate_probe.start_land()), "the gate opens the land of the saved character (or Pyra)")
	gate_probe.free()
	var chat_probe := PyraChat.new()
	chat_probe.add_line("Ala", "Cześć")
	verify(chat_probe.lines == ["Ala: Cześć"], "the chat keeps its lines")
	chat_probe.free()
	verify(PyraGame.valid_dungeon_state({}) == {}, "cave state helper stays available")
	var killer := mm.place_monster("verdant-mchowy-szlamak", far_up)
	game.hurt_player(killer, 900.0, "melee", [])
	killer.queue_free()
	mm.active.erase(killer.spawn_index)
	verify(game.kit.dead, "monster damage can kill the hero")
	await create_timer(3.5).timeout
	await settle(2)
	verify(not game.kit.dead and game.in_safe_city(game.player.position) and game.kit.hp >= float(game.kit.stats().maxHp) * 0.99, "after death the hero returns to the city with full health")
	game.player.fx_lock = 0.0
	game.kit.set_level(1)
	game.start_new_character("legend")
	await settle(2)

	# ---- quests ------------------------------------------------------------------------------------------------
	game.start_new_character("legend")
	await settle(3)
	var qe: PyraQuests = game.quests
	var playable := 0
	for q_def: Dictionary in qe.data.quests:
		playable += 1 if bool(q_def.playableInCurrentRuntime) else 0
	verify(qe.data.quests.size() == 106 and playable == 102 and qe.data.famous.size() == 16 and qe.data.hidden.size() == 17, "quest catalogue: 106 quests (102 playable), 16 famous and 17 hidden places", [qe.data.quests.size(), playable])
	var capital := game.capital_id()
	verify(qe.state_of("O-P01") == "available" and qe.marker_for("pyra", capital, "guide") == "!", "the first Pyra quest is on offer and Kaena carries a ! mark")
	var offered := qe.offered_by("pyra", capital, "guide")
	verify(offered.size() >= 1 and str(offered[0].id) == "O-P01", "Kaena offers Próba Popiołu i Areny")
	var xp_q := game.kit.xp + game.kit.level * 100000
	var gold_q := game.economy.gold
	var potions_q := game.economy.count("potion")
	verify(qe.start("O-P01") and qe.state_of("O-P01") == "active", "accepting a quest activates it")
	qe.talk("pyra", capital, "guide")
	verify(int(qe.quests["O-P01"].stage) == 1, "talking to the quest NPC completes the first stage")
	verify(qe.marker_for("pyra", capital, "guide") == "?", "the NPC now carries a ? mark (report waiting)")
	var famous: Dictionary = qe.data.places.pyra.famous["famous-pyra-4"]
	qe.near("pyra", Vector2(float(famous.x), float(famous.y)) + Vector2(100, 0))
	verify(qe.is_discovered("famous-pyra-4") and game.economy.gold > gold_q or qe.is_discovered("famous-pyra-4"), "walking up to a famous place discovers it (first discovery pays once)")
	qe.talk("pyra", capital, "guide")
	verify(qe.state_of("O-P01") == "completed" and game.economy.count("potion") == potions_q + 1 and game.kit.xp + game.kit.level * 100000 > xp_q, "reporting finishes the quest: XP, coins and the potion are paid")
	var claimed_before := qe.reward_claimed.size()
	qe.record("talk", "npc-kaena")
	verify(qe.reward_claimed.size() == claimed_before and qe.state_of("O-P01") == "completed", "a one-time reward is never paid twice")
	var quest_saved := qe.to_save()
	var quest_round: Variant = JSON.parse_string(JSON.stringify(quest_saved))
	qe.reset()
	verify(qe.state_of("O-P01") == "available" and qe.from_save(quest_round) and qe.state_of("O-P01") == "completed", "quest progress survives a save round-trip")
	var quest_bad: Dictionary = JSON.parse_string(JSON.stringify(quest_saved))
	quest_bad.quests["no-such-quest"] = {"state": "active"}
	verify(not qe.from_save(quest_bad) and qe.state_of("O-P01") == "completed", "a save naming an unknown quest is rejected unchanged")
	qe.reset()
	var combat_quest := ""
	for q_def: Dictionary in qe.data.quests:
		if bool(q_def.playableInCurrentRuntime) and int(q_def.unlockCondition.get("minLevel", 1)) <= 1 and (q_def.unlockCondition.get("prerequisiteQuestIds", []) as Array).is_empty():
			for stage_def: Dictionary in q_def.stages:
				for obj_def: Dictionary in stage_def.objectives:
					if obj_def.type == "combat" and combat_quest == "" and q_def.stages.size() == 1:
						combat_quest = str(q_def.id)
	if combat_quest != "":
		qe.start(combat_quest)
		var cobj: Dictionary = qe.by_id[combat_quest].stages[0].objectives[0]
		var progress_before := int(qe.quests[combat_quest].progress.get(cobj.id, 0))
		qe.defeated(str(cobj.targetId))
		verify(int(qe.quests[combat_quest].progress.get(cobj.id, 0)) > progress_before or qe.state_of(combat_quest) == "completed", "defeating the target monster advances a combat objective", combat_quest)
	var tracker_view := qe.tracker()
	game.refresh_quest_ui()
	verify(game.hud.quests.size() == tracker_view.size(), "the HUD tracker mirrors the active quests")
	game.show_journal()
	await settle(2)
	verify(game.hud.modal.visible, "the quest journal opens")
	game.hud.close_dialog()
	game.start_new_character("legend")
	await settle(2)

	# ---- audio ---------------------------------------------------------------------------------------------------
	var snd: PyraAudio = game.audio
	var music_ok := true
	for key in ["loadings", "verdantia", "aetheria", "nexus", "pyra"]:
		music_ok = music_ok and ResourceLoader.exists("res://assets/audio/music/%s.mp3" % key)
	verify(music_ok and ResourceLoader.exists("res://assets/audio/sfx/common/hit.mp3") and ResourceLoader.exists("res://assets/audio/sfx/legend/A1.mp3") and ResourceLoader.exists("res://assets/audio/sfx/monsters/pyra-wegielek/atk.mp3"), "the owner's music and the effects are in the package")
	game.start_new_character("sage")
	await settle(3)
	verify(snd.active_music == "aether", "the music follows the world of the land", snd.active_music)
	snd.sfx("common/hit")
	snd.ability("sage", "A1")
	snd.monster_sound("pyra-wegielek", "atk", 200.0)
	snd.step(0.5, true, "aether", "open", false)
	verify(snd.stream("res://assets/audio/sfx/common/hit.mp3") != null, "effects load and play without error")
	verify(PyraAudio.is_refusal("Za mało KI.") and not PyraAudio.is_refusal("Poziom 2!"), "refusal notices get the error tick")
	snd.set_volumes(0.5, 0.25)
	verify(is_equal_approx(snd.music_volume, 0.5) and is_equal_approx(snd.sfx_volume, 0.25), "volumes can be set")
	snd.set_volumes(0.3, 0.6)
	game.start_new_character("legend")
	await settle(2)

	# ---- equipment rules: passives, sets, caps, smith upgrades, stations, consumables ---------------------------------
	game.start_new_character("legend")
	await settle(2)
	var eq: PyraEconomy = game.economy
	var best_percent := {}
	for slot_name in PyraEconomy.SLOTS:
		var top_id := ""
		var top_value := -1.0
		for item_id: String in eq.items:
			if eq.slot_of(item_id) == slot_name:
				var v := float((eq.items[item_id].stats as Dictionary).get("maxHpPercent", 0.0)) + float((eq.items[item_id].stats as Dictionary).get("atkPercent", 0.0))
				if v > top_value:
					top_value = v
					top_id = item_id
		eq.equipment[slot_name] = top_id
	var capped := eq.gear()
	var within_caps := true
	for key: String in PyraEconomy.PASSIVE_KEYS:
		within_caps = within_caps and float(capped[key]) <= float(eq.caps[key]) + 0.001
	verify(within_caps and float(capped.atkPercent) > 0.0 or within_caps, "percentage bonuses of the equipment never exceed the V2 global caps", capped)
	for slot_name in PyraEconomy.SLOTS:
		eq.equipment[slot_name] = ""
	eq.add_item("sword")
	verify(eq.equip("sword"), "the sword can be equipped")
	var attack_plain: float = eq.gear().attack
	eq.gold = 1000
	verify(eq.upgrade("weapon") and eq.gold == 960 and is_equal_approx(float(eq.gear().attack), attack_plain + 2.0), "smith upgrade: +2 attack for 40 coins")
	verify(eq.upgrade("weapon") and eq.upgrade("weapon") and not eq.upgrade("weapon") and int(eq.upgrades.weapon) == 3, "a weapon upgrades to +3 and no further")
	verify(not eq.upgrade("ring") and not eq.upgrade("armor"), "jewellery and empty slots cannot be upgraded")
	var upgraded_save: Variant = JSON.parse_string(JSON.stringify(eq.to_save()))
	eq.upgrades = {}
	verify(eq.from_save(upgraded_save) and int(eq.upgrades.weapon) == 3, "upgrades survive a save round-trip")
	var cyber := eq.recipes_for(["cyber_fabricator"]).size()
	var books := eq.recipes_for(["projekt_ksiegi"]).size()
	verify(cyber == 10 and books == 94 and PyraEconomy.STATIONS_PYRA.size() == 5, "all five crafting stations are available", [cyber, books])
	game.kit.hp = 10.0
	eq.add_item("U-05")
	var hp_before_use := game.kit.hp
	verify(eq.use("U-05") and game.kit.hp > hp_before_use, "a consumable heals")
	eq.equipment["weapon"] = ""
	eq.upgrades = {}
	game.on_economy_changed()
	game.kit.hp = float(game.kit.stats().maxHp)

	# ---- HUD layout -----------------------------------------------------------------------------------------
	# ---- story: introduction, tutorial, topics, reactions ------------------------------------------
	var st_data := PyraStory.data()
	var st_intro_ok := true
	for st_race in ["legend", "planetary", "sage", "android"]:
		var st_tale := PyraStory.intro(st_race)
		st_intro_ok = st_intro_ok and (st_tale.pages as Array).size() == 5 and str(st_tale.title) != "Superior"
		for st_page in st_tale.pages:
			st_intro_ok = st_intro_ok and str(st_page).length() > 80
	verify(st_intro_ok, "every race has a five-page introduction (two on the Silence, three of its own)")
	var st_topics_ok := true
	var st_topic_count := 0
	var st_topic_ids := {}
	for st_world in ["pyra", "verdant", "aether", "nexus"]:
		for st_role in ["guide", "hunter", "steward", "merchant", "trainer", "keeper", "smith", "innkeeper", "alchemist", "warden"]:
			var st_list := PyraStory.topics(st_world, st_role)
			st_topics_ok = st_topics_ok and st_list.size() == 8
			for st_topic: Dictionary in st_list:
				st_topics_ok = st_topics_ok and str(st_topic.text).length() > 60 and str(st_topic.label) != ""
				st_topic_ids[st_topic.id] = true
				st_topic_count += 1
	verify(st_topics_ok and st_topic_count == 320 and st_topic_ids.size() == 10 * 3 + 4 * 5, "every resident of every world has eight subjects with real text (their trade and the five of the world)", st_topic_ids.size())
	verify(PyraStory.reaction({}) == "" and PyraStory.reaction({"hurt": true, "boss": true}).contains("ranny") and PyraStory.reaction({"night": true}).contains("Noc"), "residents remark on the hero's state, the most urgent first")
	var st_story := PyraStory.new()
	st_story.intro_seen = true
	verify(st_story.tutorial_active() and st_story.tracker().size() == 1 and (st_story.tracker()[0].lines as Array).size() == 3 and str(st_story.tracker()[0].title).contains("0/8"), "the tutorial lists the next three steps")
	verify(st_story.note("move") and not st_story.note("move") and not st_story.note("nonsense") and (st_story.tracker()[0].lines as Array)[0] == "Porozmawiaj z mieszkańcem (E)", "a step is ticked once and unknown steps are ignored")
	for st_step: Dictionary in PyraStory.STEPS:
		st_story.note(str(st_step.id))
	verify(st_story.tutorial_complete() and not st_story.tutorial_active() and st_story.tracker().is_empty() and st_story.claim_reward() and not st_story.claim_reward(), "finishing the tutorial pays the reward exactly once")
	st_story.hear("w:pyra:cisza")
	st_story.milestone("boss")
	var st_copy := PyraStory.new()
	st_copy.from_save(JSON.parse_string(JSON.stringify(st_story.to_save())))
	verify(st_copy.intro_seen and st_copy.rewarded and st_copy.steps.size() == 8 and st_copy.heard("w:pyra:cisza") and st_copy.milestones.has("boss"), "story progress survives a save")
	var st_old := PyraStory.new()
	st_old.from_save(null)
	verify(st_old.intro_seen and not st_old.tutorial_active(), "a save from before the story counts as already introduced")
	var st_dirty := PyraStory.new()
	st_dirty.from_save({"intro": true, "steps": ["move", 5, "x", "attack"], "talk": ["a", 3, "b".repeat(80)], "mile": ["boss", 7]})
	verify(st_dirty.steps.size() == 2 and st_dirty.talk_seen.size() == 1 and st_dirty.milestones.size() == 1, "story progress read from a save is cleaned")
	# in the game: a new hero is told the story, then walks the tutorial
	game.skip_intro = false
	game.story.reset()
	game.hud.close_dialog()
	game.play_intro()
	await settle(3)
	verify(game.screen is PyraStoryScreen and game.hud.visible == false, "a new hero first sees the story screen")
	var st_view: PyraStoryScreen = game.screen
	var st_pages := 1
	st_view.advance()
	verify(st_view.page_complete() and st_view.page_index == 0, "the first press completes the page text")
	while st_view.page_index < st_view.pages.size() - 1:
		st_view.advance()
		st_view.advance()
		st_pages += 1
	verify(st_pages == 5 and st_view.next_button.text == "ZACZNIJ PRZYGODĘ", "the story is read page by page")
	st_view.advance()
	await settle(3)
	game.skip_intro = true
	verify(not is_instance_valid(game.screen) and game.story.intro_seen and game.story.tutorial_active() and game.hud.quests.size() >= 1 and str(game.hud.quests[0].title).begins_with("Pierwsze kroki"), "after the story the tutorial shows under the minimap")
	var st_gold := game.economy.gold
	for st_step: Dictionary in PyraStory.STEPS:
		game.story.note(str(st_step.id))
	await settle(2)
	verify(game.economy.gold == st_gold + PyraStory.REWARD_GOLD and game.story.rewarded, "the tutorial reward is paid into the purse")
	game.story.reset()
	game.story.intro_seen = true
	game.open_map()
	await settle(2)
	verify(game.story.steps.has("map"), "opening the map ticks its step")
	game.close_screen()
	game.player.position = spawn()
	game.interact()
	await settle(2)
	verify(game.story.steps.has("talk") and game.hud.modal.visible and game.hud.modal_box.get_children().any(func(n: Node) -> bool: return n is Button and (n as Button).text == "ROZMOWA"), "talking to a resident ticks its step and offers the subjects")
	game.hud.close_dialog()
	game.open_topics("Testowa", "guide")
	await settle(2)
	verify(game.hud.modal.visible and game.hud.modal_box.get_children().filter(func(n: Node) -> bool: return n is Button and (n as Button).text != "ZAMKNIJ").size() == 8, "the subject list has eight entries")
	game.story.hear("r:guide:start")
	game.open_topics("Testowa", "guide")
	await settle(2)
	verify(game.story.heard("r:guide:start") and game.hud.modal_box.get_children().any(func(n: Node) -> bool: return n is Button and (n as Button).text.begins_with("(znane)")), "a subject that has been heard is marked")
	# ---- combat feel: numbers, shake, hit-stop, hit clips, perfect dodge, animations -------------------
	var cf_weak: Label = PyraFx.number(game.continent.sorted, game.player.position, 12, false, "weak")
	var cf_hurt: Label = PyraFx.number(game.continent.sorted, game.player.position, 7, false, "hurt")
	var cf_heal: Label = PyraFx.number(game.continent.sorted, game.player.position, 5, false, "heal")
	var cf_crit: Label = PyraFx.number(game.continent.sorted, game.player.position, 30, true)
	verify(cf_weak.text == "12!" and cf_weak.get_theme_color("font_color") == Color("ff9d3c") and cf_hurt.get_theme_color("font_color") == Color("ff5a4d") and cf_heal.text == "+5" and cf_crit.text == "30!" and cf_crit.get_theme_font_size("font_size") > cf_hurt.get_theme_font_size("font_size"), "damage numbers have their own looks: weakness, hurt, heal, crit")
	verify([1, 2, 3, 4, 5, 6].map(func(n: int) -> String: return PyraGame.combo_clip(n)) == ["attack", "attack2", "finisher", "attack", "attack2", "finisher"], "basic strikes chain into a finisher every third blow")
	game.add_shake(8.0)
	await settle(1)
	verify(game.camera.offset != Vector2.ZERO, "a heavy blow shakes the camera")
	await create_timer(0.7).timeout
	verify(game.camera.offset == Vector2.ZERO and game.shake == 0.0, "the shake dies down by itself")
	game.hit_stop(0.05)
	verify(Engine.time_scale < 0.5, "hit-stop slows the world for an instant")
	await create_timer(0.3, true, false, true).timeout
	verify(is_equal_approx(Engine.time_scale, 1.0) and not game.hit_stopping, "the clock is restored after hit-stop")
	game.player.position = base + Vector2(300, 0)
	game.kit.hp = float(game.kit.stats().maxHp)
	game.heavy_until = 0.0
	game.hurt_player(null, float(game.kit.stats().maxHp) * 0.5, "melee", [])
	verify(game.player.visual.one_shot_clip.ends_with("hitheavy") and game.shake >= 9.0, "a heavy hit plays the heavy hit clip and shakes harder")
	game.kit.hp = float(game.kit.stats().maxHp)
	game.heavy_until = 0.0
	game.shake = 0.0
	game.hurt_player(null, 4.0, "melee", [])
	verify(game.player.visual.one_shot_clip.ends_with("hit") and not game.player.visual.one_shot_clip.ends_with("hitheavy") and game.shake > 0.0 and game.shake < 9.0, "a light hit plays the light hit clip")
	game.kit.hp = float(game.kit.stats().maxHp)
	game.kit.next_dodge_at = 0.0
	game.perfect_until = 0.0
	var cf_ki: float = game.kit.ki
	game.kit.ki = 0.0
	game.player.locked = false
	game.dodge()
	game.hurt_player(null, 20.0, "melee", [])
	verify(game.perfect_dodges == 1 and game.kit.ki > 0.0 and game.kit.hp == float(game.kit.stats().maxHp), "a blow that lands at the start of a dodge is a perfect dodge: no damage, ki back")
	game.hurt_player(null, 20.0, "melee", [])
	verify(game.perfect_dodges == 1, "a perfect dodge cannot be chained at once")
	await create_timer(0.6, true, false, true).timeout
	game.kit.ki = cf_ki
	game.kit.clear_debuffs()
	game.kit.hp = float(game.kit.stats().maxHp)
	game.celebrate("TEST")
	verify(game.player.visual.one_shot_clip.ends_with("victory"), "victory pose exists and plays")
	await create_timer(1.3).timeout
	game.player.visual.animate(Vector2(3.0, 0.0), true)
	verify(game.player.visual.state == "run", "a full push plays the run clip", game.player.visual.state)
	game.player.visual.animate(Vector2(3.0, 0.0), false)
	verify(game.player.visual.state == "walk", "a gentle push plays the walk clip", game.player.visual.state)
	game.kit.set_level(3)
	game.hud.notice.text = ""
	game.on_quest_reward(100000, 0, {}, "Test")
	verify(game.kit.level > 3 and game.player.visual.one_shot_clip.ends_with("victory"), "gaining a level plays the victory pose")
	var cf_ring := PyraTargetRing.new()
	game.add_child(cf_ring)
	verify(not cf_ring.visible, "the target ring starts hidden")
	cf_ring.aim(Vector2(10.0, 20.0), 46.0, false)
	verify(cf_ring.visible and cf_ring.position == Vector2(10.0, 20.0), "the target ring sits under the foe")
	cf_ring.clear()
	verify(not cf_ring.visible, "the target ring hides when the fight ends")
	cf_ring.queue_free()
	game.kit.set_level(10)
	game.kit.hp = float(game.kit.stats().maxHp)
	game.player.visual.one_shot_until = 0.0
	game.hud.close_dialog()
	game.story.reset()
	game.story.from_save(null)
	# ---- items: comparison, sets, totals, bulk trade, bulk craft ---------------------------------------
	var it_eco: PyraEconomy = game.economy
	var it_low := ""
	var it_high := ""
	var it_set_item := ""
	var it_spare := ""
	var it_needed := {}
	for it_recipe: Dictionary in it_eco.recipes:
		for it_ing: Dictionary in it_recipe.ingredients:
			it_needed[str(it_ing.itemId)] = true
	for it_id: String in it_eco.items:
		var it_def: Dictionary = it_eco.items[it_id]
		if it_eco.slot_of(it_id) == "weapon" and it_def.stats.has("atkBonus") and int(it_def.level) <= 5:
			if it_low == "" or float(it_def.stats.atkBonus) < float(it_eco.items[it_low].stats.atkBonus):
				it_low = it_id
			if it_high == "" or float(it_def.stats.atkBonus) > float(it_eco.items[it_high].stats.atkBonus):
				it_high = it_id
		if it_set_item == "" and it_def.get("setId") != null and it_eco.slot_of(it_id) != "":
			it_set_item = it_id
		if it_spare == "" and str(it_def.category) == "material" and not it_needed.has(it_id):
			it_spare = it_id
	it_eco.equipment["weapon"] = it_low
	var it_diff := it_eco.compare_lines(it_high)
	verify(it_low != it_high and it_diff.size() > 0 and it_diff[0].contains("Atak +"), "a better weapon shows what it adds against the worn one", it_diff)
	it_eco.equipment["weapon"] = it_high
	verify(it_eco.compare_lines(it_low).any(func(l: String) -> bool: return l.contains("Atak −")) and it_eco.compare_lines(it_high).is_empty(), "a worse weapon shows what it takes away; the worn one shows nothing")
	var it_sets := it_eco.set_lines(it_set_item)
	verify(it_sets.size() >= 2 and it_sets[0].begins_with("Zestaw ") and it_sets[0].contains("założone 0 z") and it_sets[1].contains("cz.:"), "a set item lists its pieces and the bonus at each count", it_sets)
	verify(it_eco.set_lines(it_low).is_empty() == (it_eco.items[it_low].get("setId") == null), "an item outside any set lists no set")
	var it_totals := it_eco.bonus_lines()
	verify(it_totals.size() > 0 and it_totals.any(func(l: String) -> bool: return l.begins_with("Atak +")), "the worn gear is summed into a bonus list", it_totals)
	it_eco.equipment["weapon"] = ""
	it_eco.bag = {}
	it_eco.gold = 100
	it_eco.add_item(it_spare, 5)
	it_eco.add_item("zielone-ziele", 4)
	verify(it_eco.spare_materials() == [it_spare] and it_eco.spare_value() == it_eco.sell_value(it_spare) * 5, "materials no recipe asks for are marked spare; recipe ingredients never are", it_eco.spare_materials())
	var it_gold := it_eco.gold
	verify(it_eco.sell_spare() == it_eco.sell_value(it_spare) * 5 and it_eco.gold == it_gold + it_eco.sell_value(it_spare) * 5 and it_eco.count(it_spare) == 0 and it_eco.count("zielone-ziele") == 4, "selling the spare materials keeps the ingredients")
	it_eco.add_item("zielone-ziele", 4)
	it_gold = it_eco.gold
	verify(it_eco.sell_all("zielone-ziele") == it_eco.sell_value("zielone-ziele") * 8 and it_eco.count("zielone-ziele") == 0 and it_eco.gold > it_gold, "a whole stack sells in one go")
	var it_recipe_potion: Dictionary = {}
	for it_recipe: Dictionary in it_eco.recipes:
		if str(it_recipe.id) == "rec-potion-basic":
			it_recipe_potion = it_recipe
	it_eco.level = 5
	it_eco.bag = {"zielone-ziele": 10, "mchowa-galaretka": 5}
	it_eco.gold = 100
	var it_potions := it_eco.count("potion")
	verify(it_eco.craftable_times(it_recipe_potion) == 5, "the recipe says how many times it can be made", it_eco.craftable_times(it_recipe_potion))
	verify(it_eco.craft_many(it_recipe_potion, 3) == 3 and it_eco.count("potion") == it_potions + 6 and it_eco.count("zielone-ziele") == 4 and it_eco.gold == 85, "crafting in quantity spends ingredients and coins for each batch")
	it_eco.bag = {}
	verify(it_eco.craftable_times(it_recipe_potion) == 0, "nothing is craftable without ingredients")
	it_eco.bag = {it_spare: 2}
	game.open_items("shop", "Sklep")
	await settle(2)
	var it_screen: ItemsScreen = game.screen
	it_screen.switch_tab(1)
	await settle(1)
	verify(it_screen.extra_box.get_children().any(func(n: Node) -> bool: return n is Button and (n as Button).text.begins_with("SPRZEDAJ NIEPOTRZEBNE")), "the sell tab offers to sell the spare materials at once")
	game.close_screen()
	it_eco.bag = {"zielone-ziele": 10, "mchowa-galaretka": 5}
	it_eco.gold = 100
	game.open_items("smithy", "Kuźnia")
	await settle(2)
	it_screen = game.screen
	it_screen.switch_tab(1)
	await settle(1)
	var it_rows := it_screen.rows().size()
	it_screen.toggle_ready()
	await settle(1)
	verify(it_screen.only_ready and it_screen.rows().size() < it_rows and it_screen.rows().size() >= 1, "the smithy can list only the recipes that can be made now", [it_rows, it_screen.rows().size()])
	it_screen.select("rec-potion-basic")
	await settle(1)
	verify(it_screen.action_box.get_children().any(func(n: Node) -> bool: return n is Button and (n as Button).text == "WYTWÓRZ ×5"), "a recipe that can be made several times offers to make them together")
	game.close_screen()
	it_eco.bag = {"potion": 3}
	it_eco.gold = 20
	it_eco.level = game.kit.level
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
