extends SceneTree

const Hud := preload("res://scripts/rpg_hud.gd")
const Labyrinth := preload("res://scripts/labyrinth_room.gd")
const Atlas := preload("res://scripts/atlas_overlay.gd")
const Catalog := preload("res://scripts/gm_panel.gd")

class TestWorld extends "res://scripts/world.gd":
	func _ready() -> void:
		set_process(false)
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
				btn_talk_npc, btn_open_treasure, btn_gather, combat_toast_lbl, stick_layer]:
			add_child(node)

	func layout_minimap() -> void:
		pass

	func sync_hero(_force_scan: bool = false) -> void:
		pass

var checks := 0
var failures := 0
var staff := false
var pending := Callable()
var requests := 0
var expected_payload := {}

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: " + label)

func mock_action(_id: String, payload: Dictionary, done: Callable) -> void:
	requests += 1
	expect(payload == expected_payload, "action uses the expected payload")
	pending = done

func _initialize() -> void:
	var world := TestWorld.new()
	root.add_child.call_deferred(world)
	run.call_deferred(world)

func run(world: TestWorld) -> void:
	var hud := Hud.new()
	var atlas := Atlas.new()
	atlas.world = world
	world.add_child(atlas)
	world.atlas_overlay = atlas
	var panel := Catalog.new()
	panel.world = world
	world.add_child(panel)
	world.gm_panel = panel

	world.server_char_id = "fixture"
	world.server_action_fn = mock_action
	expected_payload = {"type": "gm_action", "op": "add_gold", "value": 100}
	panel._send_gm_action("add_gold", {"value": 100})
	expect(requests == 0, "panel cannot send GM action without verified role")
	var shortcut := InputEventKey.new()
	shortcut.keycode = KEY_F1
	shortcut.pressed = true
	world._unhandled_input(shortcut)
	expect(not world.gm_open, "F1 without verified role")
	world.toggle_gm_panel(true)
	expect(not world.gm_open, "direct open without verified role")
	expect(not atlas.btn_teleport.visible, "atlas hides GM teleport")

	world.gm_access_fn = func() -> bool: return staff
	staff = true
	world._refresh_gm_access()
	atlas._refresh_mode_buttons()
	world._unhandled_input(shortcut)
	expect(world.gm_open and atlas.btn_teleport.visible, "staff can open GM and atlas control")
	panel._send_gm_action("add_gold", {"value": 100})
	expect(requests == 1, "staff panel sends the canonical GM action")
	pending.call({"ok": true, "notice": "GM: Potwierdzono."})
	expect(panel.status_lbl.text == "GM: Potwierdzono.", "panel shows server acknowledgement")
	world.server_char_id = ""
	requests = 0
	world.gm_noclip = true
	world.gm_speed_mult = 8.0
	world.gm_map_teleport_mode = true
	staff = false
	world._refresh_gm_access()
	expect(not world.gm_open and not atlas.btn_teleport.visible, "revocation closes controls")
	expect(not world.gm_noclip and world.gm_speed_mult == 1.0 and not world.gm_map_teleport_mode, "revocation clears active privileges")

	world.rpg_hud = hud
	hud.world = world
	world.add_child(hud)
	hud.recalc_stats(true)
	expect(hud.hp_potion_count() == 3, "catalog camelCase stack shown")
	var amount := Hud._restored_vital(hud.backpack_items[0], "healHp")
	var lost := int(amount) + 20
	var agent := {"kind": "monster", "dmg_dealt_to_hero": lost}
	world.live_agents.append(agent)
	hud.hero_hp = hud.hero_max_hp - lost
	hud.hero_ki = 1.0
	var hp_before := hud.hero_hp
	shortcut.keycode = KEY_H
	world._unhandled_input(shortcut)
	expect(hud.hp_potion_count() == 2 and is_equal_approx(hud.hero_hp, hp_before + amount), "local HP use heals and consumes one")
	expect(int(agent["dmg_dealt_to_hero"]) == 20, "local cure settles only healed damage")
	hud.use_backpack_slot(1)
	expect(hud.hero_ki > 1.0, "inventory KI potion works")

	var maze := Labyrinth.new()
	maze.world = world
	world.add_child(maze)
	maze.show()
	world.labyrinth_room = maze
	world.in_labyrinth = true
	world.live_agents.clear()
	maze.guardians.append(agent)
	expect(maze._count_hp_potions() == 2, "labyrinth sees same HP stock")
	world.server_char_id = "fixture"
	expected_payload = {"type": "use_item", "backpackIndex": 0, "expectedItemId": "potion_hp_small"}
	hud.hero_hp = hud.hero_max_hp - lost
	agent["dmg_dealt_to_hero"] = lost
	maze._unhandled_input(shortcut)
	maze.btn_potion.pressed.emit()
	expect(requests == 1 and int(agent["dmg_dealt_to_hero"]) == lost, "in-flight action neither spends twice nor clears damage")
	pending.call({"ok": false, "notice": "Odmowa"})
	expect(int(agent["dmg_dealt_to_hero"]) == lost and hud.hp_potion_count() == 2, "failed action keeps damage and inventory")

	maze._use_labyrinth_potion()
	agent["dmg_dealt_to_hero"] = lost + 5
	hud.hero_hp -= 5.0
	pending.call({"ok": true, "character": {"state": {"hp": hud.hero_max_hp, "backpack": [{"id": "potion_hp_small", "qty": 1}]}}})
	expect(hud.hp_potion_count() == 1, "inventory uses confirmed stack")
	expect(int(agent["dmg_dealt_to_hero"]) == 25, "partial healing preserves remaining and new damage")
	expect(is_equal_approx(hud.hero_hp, hud.hero_max_hp - 25.0), "HP matches remaining damage")

	world.in_labyrinth = false
	maze.hide()
	world.world_size = 512.0
	world.grid_size = 4
	world.walkable.resize(16)
	world.walkable.fill(1)
	world.server_character = {
		"land": world.current_land,
		"state": {"positionEpoch": 2, "position": {
			"layout": world.POSITION_LAYOUT, "land": world.current_land, "x": 180.0, "z": 211.0,
		}},
	}
	expect(world.restore_server_position() and world.hero_pos == Vector2(180.0, 211.0), "restore exterior coordinates")
	world.walkable.fill(0)
	expect(not world.restore_server_position(), "blocked saved point is discarded")
	world.walkable.fill(1)
	expected_payload = {
		"type": "save_position", "land": world.current_land, "epoch": 2,
		"layout": world.POSITION_LAYOUT, "position": {"x": 180.0, "z": 211.0},
	}
	var hp := hud.hero_hp
	world.save_server_position()
	pending.call({"ok": true, "character": {"state": {"hp": 1}}})
	expect(is_equal_approx(hud.hero_hp, hp), "position acknowledgement leaves combat vitals alone")
	var requests_before := requests
	world.save_server_position()
	expect(requests_before == requests, "unchanged position does not send another write")

	var surface_drop := {
		"token": "surface-token", "land": world.current_land, "x": 148.0, "z": 180.0,
	}
	var feedback := func(_notice: String, _ok: bool) -> void: pass
	expected_payload = {
		"type": "pickup_loot", "token": surface_drop["token"], "land": world.current_land,
		"position": {"x": 148.0, "z": 180.0},
	}
	world.try_pickup_server_loot(surface_drop, Vector2(190.0, 180.0), feedback)
	expect(requests_before == requests, "outside pickup radius sends no action")
	world.try_pickup_server_loot(surface_drop, Vector2(148.0, 180.0), feedback)
	world.try_pickup_server_loot(surface_drop, Vector2(148.0, 180.0), feedback)
	expect(requests == requests_before + 1, "standing over drop sends one outstanding pickup")
	pending.call({"ok": false, "errorCode": "BACKPACK_FULL"})
	expect(not bool(surface_drop["removed"]) and bool(surface_drop["step_away"]), "full bag keeps surface loot")
	world.try_pickup_server_loot(surface_drop, Vector2(190.0, 180.0), feedback)
	expect(not surface_drop.has("step_away"), "stepping away allows later retry")

	maze.lab_data = {"id": "test-maze"}
	maze.hero_px = Vector2(111.0, 111.0)
	maze.ground_drops.assign([{
		"token": "maze-token", "land": world.current_land, "room": "test-maze",
		"x": 111.0, "z": 111.0, "elapsed": 0.0,
	}])
	expected_payload = {
		"type": "pickup_loot", "token": "maze-token", "land": world.current_land,
		"room": "test-maze", "position": {"x": 111.0, "z": 111.0},
	}
	maze._step_ground_drops(0.4)
	expect(requests == requests_before + 1, "maze waits for the drop to settle")
	maze._step_ground_drops(0.1)
	expect(requests == requests_before + 2, "maze pickup uses room coordinates")
	pending.call({"ok": true})
	maze._step_ground_drops(0.1)
	expect(maze.ground_drops.is_empty(), "confirmed drop disappears from maze")

	for tier: Array in [
		[3, "Adept Miasta", Vector3i.ZERO],
		[6, "Wojownik Miasta", Vector3i(10, 2, 2)],
		[10, "Weteran Stolicy", Vector3i(25, 4, 4)],
		[15, "Mistrz Ki", Vector3i(50, 8, 6)],
	]:
		for stat: String in hud.training_ranks:
			hud.training_ranks[stat] = tier[0]
		expect(hud.get_training_mastery_title() == tier[1] and hud._training_mastery_bonus() == tier[2], "canonical mastery threshold and flat bonus")
	hud.training_ranks["def"] = 2
	expect(hud.get_training_mastery_title() == "Rekrut" and hud._training_mastery_bonus() == Vector3i.ZERO, "weakest discipline determines mastery")

	var tr := {"id": "fixture-chest", "title": "Skrzynia testowa", "gold": 900, "xp": 80}
	expected_payload = {
		"type": "claim_treasure", "treasureId": "fixture-chest",
		"position": {"x": world.hero_pos.x, "z": world.hero_pos.y},
	}
	var requests_before_chest := requests
	expect(world.claim_treasure_reward(tr), "chest request sent")
	expect(not world.claim_treasure_reward(tr) and requests == requests_before_chest + 1, "outstanding chest request is deduplicated")
	expect(not world.is_treasure_opened("fixture-chest"), "chest awaits server confirmation")
	pending.call({"ok": false, "notice": "Plecak pełny"})
	expect(not world.is_treasure_opened("fixture-chest"), "rejected chest stays closed")
	expect(world.claim_treasure_reward(tr), "rejected chest is retryable")
	pending.call({"ok": true, "character": {"state": {"progress": {"openedTreasures": ["fixture-chest"]}}}})
	expect(world.is_treasure_opened("fixture-chest"), "confirmed progress opens chest")

	var gather := {"id": "fixture-gather", "kind": "gather"}
	expected_payload = {
		"type": "gather_node", "nodeId": "fixture-gather", "land": world.current_land,
		"position": {"x": world.hero_pos.x, "z": world.hero_pos.y},
	}
	world.interact_gatherable(gather)
	pending.call({"ok": false, "notice": "Odczekaj"})
	expect(not world.gatherable_cd.has("fixture-gather"), "server rejection leaves resource available")
	world.interact_gatherable(gather)
	pending.call({"ok": true})
	expect(float(world.gatherable_cd.get("fixture-gather", 0.0)) == 90.0, "accepted gathering starts respawn timer")

	world.free()
	print("Etap 1 — %d/%d kontroli Godot" % [checks - failures, checks])
	quit(1 if failures > 0 else 0)
