extends SceneTree
## Run with a graphical Godot renderer so the real HUD draw and hitboxes are exercised.

const WorldScript := preload("res://scripts/world.gd")
var checks := 0
var failures := 0

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: ", label)

func gm_button(panel: Node, prefix: String) -> Button:
	for child in panel.find_children("*", "Button", true, false):
		if (child as Button).text.contains(prefix):
			return child as Button
	return null

func utility_rect(hud: Control, id: String) -> Rect2:
	for entry: Dictionary in hud.util_hitboxes:
		if entry["id"] == id:
			return entry["rect"]
	return Rect2()

func redraw(hud: Control) -> void:
	hud._refresh_visuals()
	await RenderingServer.frame_post_draw

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var world := WorldScript.new()
	var access := {"allowed": false}
	world.start_land = "pyra"
	world.gm_access_fn = func() -> bool: return access["allowed"]
	root.add_child(world)
	for _frame in 160:
		if not world.is_booting:
			break
		await process_frame
	if world.is_booting or world.rpg_hud == null:
		printerr("World failed to start")
		quit(1)
		return
	var hud := world.rpg_hud
	await redraw(hud)
	if hud.hotbar_hitboxes.size() != 6:
		printerr("HUD did not render all six logical slots")
		quit(1)
		return

	for land in ["pyra", "verdant", "aether", "nexus"]:
		hud.set_hero_land(land)
		hud.set_region("pyra")
		hud.apply_server_character({"level": 1, "state": {"unlockedNodes": ["R"]}})
		await redraw(hud)
		expect(hud.hotbar_icon_rects[0].is_visible_in_tree() and hud.hotbar_hitboxes[0].has_area(),
			land + " basic attack available at level one")
		for slot in range(1, 6):
			expect(not hud.hotbar_icon_rects[slot].visible and not hud.hotbar_ring_rects[slot].visible
				and not hud.hotbar_hitboxes[slot].has_area(), "%s hides locked slot %d" % [land, slot])

		hud.apply_server_character({"level": 2, "state": {"unlockedNodes": ["R"], "skillPoints": 1}})
		hud._try_unlock_node("A1")
		await redraw(hud)
		var active_rect: Rect2 = hud.hotbar_hitboxes[1]
		expect(hud.hotbar_icon_rects[1].visible and hud.hotbar_ring_rects[1].visible and active_rect.has_area(),
			land + " shows A1 as soon as it is learned")
		hud.cooldowns[1] = 2.0
		hud.hero_ki = 0.0
		await redraw(hud)
		expect(hud.cooldowns[1] > 0.0 and hud.hotbar_icon_rects[1].visible
			and hud.hotbar_hitboxes[1].has_area(), land + " keeps learned A1 visible on cooldown at low KI")

		hud.apply_server_character({"level": 1, "state": {"unlockedNodes": ["R"]}})
		expect(not hud._handle_primary_tap(active_rect.get_center()), land + " ignores stale A1 tap after reset")
		await redraw(hud)
		expect(not hud.hotbar_icon_rects[1].visible and not hud.hotbar_ring_rects[1].visible
			and not hud.hotbar_hitboxes[1].has_area(), land + " removes reset skill completely")

		hud.apply_server_character({"level": 20, "state": {"unlockedNodes": ["R", "A9", "T"],
			"hotbarSlots": ["A9", "B1", "C1", "A4"]}})
		await redraw(hud)
		expect(hud.hotbar_icon_rects[1].visible and hud.get_hotbar_node(1) == "A9"
			and hud.hotbar_hitboxes[1].has_area(), land + " exposes the saved A9 assignment")
		expect(hud.hotbar_icon_rects[5].visible and hud.hotbar_hitboxes[5].has_area(),
			land + " shows the unlocked KI transformation")

	expect(not utility_rect(hud, "gm_fly").has_area(), "Regular player has no flight button")
	access["allowed"] = true
	world._refresh_gm_access()
	await redraw(hud)
	expect(not utility_rect(hud, "gm_fly").has_area(), "Staff without GM form has no flight button")
	expect(utility_rect(hud, "gm_boost").has_area(), "Staff still has Turbo")
	world.toggle_gm_panel(true)
	expect(gm_button(world.gm_panel, "LOT NAD ZIEMIĄ") == null, "GM panel before form has no flight button")
	world.toggle_gm_form(true)
	var fly := gm_button(world.gm_panel, "LOT NAD ZIEMIĄ")
	expect(fly != null, "GM panel adds flight while already open on form activation")
	if fly != null:
		fly.pressed.emit()
		expect(world.gm_flying, "GM panel flight works while in form")
	world.toggle_gm_panel(false)
	await redraw(hud)
	var flight_rect := utility_rect(hud, "gm_fly")
	expect(flight_rect.has_area(), "HUD adds flight in GM form")
	if flight_rect.has_area():
		expect(hud._handle_primary_tap(flight_rect.get_center()) and not world.gm_flying,
			"Flight HUD button lands the GM")
	world.toggle_gm_form(false)
	if flight_rect.has_area():
		expect(not hud._handle_primary_tap(flight_rect.get_center()) and not world.gm_form_active,
			"Stale flight area cannot put staff back into the GM form")
	await redraw(hud)
	expect(not utility_rect(hud, "gm_fly").has_area(), "HUD removes flight after leaving the GM form")
	world.toggle_gm_panel(true)
	expect(gm_button(world.gm_panel, "LOT NAD ZIEMIĄ") == null, "Reopened GM panel has no flight button")
	world.toggle_gm_form(true)
	world.toggle_gm_form(false)
	expect(gm_button(world.gm_panel, "LOT NAD ZIEMIĄ") == null, "Open GM panel removes flight immediately")

	print("HUD visibility: %d/%d passed, %d failed" % [checks - failures, checks, failures])
	quit(0 if failures == 0 else 1)
