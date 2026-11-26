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

	world.free()
	print("Etap 1 — %d/%d kontroli Godot" % [checks - failures, checks])
	quit(1 if failures > 0 else 0)
