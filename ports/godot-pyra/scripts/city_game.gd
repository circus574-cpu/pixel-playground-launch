class_name PyraGame
extends Node2D

const DATA_PATH := "res://data/city.generated.json"
const SAVE_PATH := "user://city-checkpoint-v1.json"
const INTERACTION_RANGE := 160.0
var data: Dictionary
var world := Node2D.new()
var player := PyraPlayer.new()
var camera := Camera2D.new()
var hud := PyraHud.new()
var current_room := ""
var city_return := Vector2.ZERO
var targets: Array[Dictionary] = []
var active_obstacles: Array = []
var active_bounds := Rect2()
var checkpoint_protected := false
var input_suspended := false

func _ready() -> void:
	data = JSON.parse_string(FileAccess.get_file_as_string(DATA_PATH))
	get_tree().quit_on_go_back = false
	add_child(world)
	player.setup(data.actors.hero, float(data.speed))
	add_child(player)
	player.add_child(camera)
	camera.zoom = Vector2(0.8, 0.8)
	camera.position_smoothing_enabled = false
	var ui := CanvasLayer.new()
	add_child(ui)
	ui.add_child(hud)
	hud.touch.motion_changed.connect(func(value: Vector2): player.touch_motion = value)
	hud.touch.interaction_requested.connect(interact)
	hud.menu_requested.connect(show_menu)
	hud.dialog_changed.connect(func(open: bool): player.locked = open or input_suspended)
	city_return = point(data.spawn)
	load_space("", city_return)
	if "--fresh" not in OS.get_cmdline_user_args():
		restore_checkpoint()
	if "--capture" in OS.get_cmdline_user_args():
		capture_frame.call_deferred()

static func point(p: Dictionary) -> Vector2:
	return Vector2(float(p.x), float(p.y))

static func rectangle(r: Dictionary) -> Rect2:
	return Rect2(float(r.x), float(r.y), float(r.width), float(r.height))

func add_collider(r: Dictionary) -> void:
	var body := StaticBody2D.new()
	body.collision_layer = 1
	body.collision_mask = 2
	var shape := CollisionShape2D.new()
	var box := RectangleShape2D.new()
	box.size = Vector2(float(r.width), float(r.height))
	shape.shape = box
	body.position = point(r) + box.size / 2
	body.add_child(shape)
	world.add_child(body)

func add_picture(path: String, at: Vector2, dimensions: Vector2, origin: Vector2, depth: int) -> Sprite2D:
	var image := Sprite2D.new()
	image.texture = load(path)
	image.centered = false
	image.offset = -origin * image.texture.get_size()
	image.scale = dimensions / image.texture.get_size()
	image.position = at
	image.z_index = depth
	world.add_child(image)
	return image

func load_space(room: String, at: Vector2) -> void:
	input_suspended = true
	player.locked = true
	hud.touch.reset()
	for child in world.get_children():
		world.remove_child(child)
		child.queue_free()
	targets.clear()
	current_room = room
	player.set_interior(not room.is_empty())
	if room.is_empty():
		active_bounds = rectangle(data.bounds)
		active_obstacles = data.obstacles
		for tile: Dictionary in data.floor:
			add_picture(tile.texture, point(tile), Vector2(float(tile.width), float(tile.height)), Vector2.ZERO, -2000)
		for object: Dictionary in data.objects:
			var depth := roundi(float(object.y))
			if object.layer == "below":
				depth = -1000
			elif object.layer == "overhead" or object.layer == "atmosphere":
				depth = 4000
			add_picture(object.texture, point(object), Vector2(float(object["size"][ 0]), float(object["size"][ 1])), Vector2(float(object.origin[0]), float(object.origin[1])), depth)
		for building: Dictionary in data.buildings:
			targets.append({"kind":"door", "id":building.id, "name":building.name, "point":point(building.door), "definition":building})
		hud.place.text = data.name
		camera.limit_right = int(data["size"][ 0])
		camera.limit_bottom = int(data["size"][ 1])
	else:
		var spec: Dictionary = data.rooms[room]
		active_bounds = Rect2(0, 0, float(spec.width), float(spec.height))
		active_obstacles = spec.obstacles
		add_picture(spec.picture, Vector2.ZERO, active_bounds.size, Vector2.ZERO, -2000)
		targets.append({"kind":"exit", "id":"exit", "name":"Wyjście do miasta", "point":point(spec.exit)})
		if room == "depot":
			targets.append({"kind":"landmark", "id":"chest", "name":"Skrzynia depozytu", "point":point(spec.chest)})
		elif room == "arena":
			targets.append({"kind":"landmark", "id":"dummy", "name":"Manekin treningowy", "point":point(spec.dummy)})
		for building: Dictionary in data.buildings:
			if building.id == room:
				hud.place.text = building.name
		camera.limit_right = int(spec.width)
		camera.limit_bottom = int(spec.height)
	for npc: Dictionary in data.npcs:
		var building := str(npc.get("building", ""))
		if building != current_room:
			continue
		var pos := point(npc) if room.is_empty() else point(data.rooms[room].npc)
		var actor := PyraActor.new()
		actor.position = pos
		actor.z_index = roundi(pos.y)
		world.add_child(actor)
		actor.setup(data.actors[npc.id], npc.name, not room.is_empty())
		targets.append({"kind":"npc", "id":npc.id, "name":npc.name, "point":pos, "definition":npc})
	for obstacle: Dictionary in active_obstacles:
		add_collider(obstacle)
	# The prototype ends at the safe city's border, without inventing enemies or a wilderness map.
	for wall in [Rect2(active_bounds.position - Vector2(30,30), Vector2(30,active_bounds.size.y+60)), Rect2(active_bounds.position + Vector2(active_bounds.size.x, -30),Vector2(30,active_bounds.size.y+60)), Rect2(active_bounds.position - Vector2(0,30),Vector2(active_bounds.size.x,30)), Rect2(active_bounds.position + Vector2(0,active_bounds.size.y),Vector2(active_bounds.size.x,30))]:
		add_collider({"x":wall.position.x,"y":wall.position.y,"width":wall.size.x,"height":wall.size.y})
	camera.limit_left = 0
	camera.limit_top = 0
	player.position = at
	camera.reset_smoothing()
	input_suspended = false
	player.locked = hud.modal.visible
	queue_redraw()

func nearest_target() -> Dictionary:
	var result: Dictionary = {}
	var distance := INTERACTION_RANGE
	for target in targets:
		var d := player.position.distance_to(target.point)
		if d < distance:
			distance = d
			result = target
	return result

func interact() -> void:
	if player.locked or hud.modal.visible:
		return
	var target := nearest_target()
	if target.is_empty():
		hud.toast("Podejdź do postaci lub wejścia.")
		return
	match target.kind:
		"door":
			city_return = player.position
			load_space(target.id, point(data.rooms[target.id].entry))
		"exit":
			load_space("", city_return)
		"npc":
			var npc: Dictionary = target.definition
			hud.show_dialog(npc.name + " · " + npc.role, npc.dialogue)
		"landmark":
			hud.show_dialog(target.name, "Punkt pochodzi z istniejącego miasta. Ta próba obejmuje ruch, wnętrza i rozmowy. Ekwipunek, depozyt przedmiotów i walka będą przenoszone w kolejnym etapie.")

func _process(_delta: float) -> void:
	if not is_instance_valid(hud) or not is_instance_valid(player):
		return
	var target := nearest_target()
	hud.touch.enabled_target = not target.is_empty()
	hud.touch.queue_redraw()
	hud.hint.text = "E · " + str(target.name) if not target.is_empty() else "WASD / joystick · podejdź do wejścia lub NPC"
	queue_redraw()

func _draw() -> void:
	for target in targets:
		if target.kind == "door" or target.kind == "exit":
			draw_arc(target.point, 26, 0, TAU, 32, Color(1.0,0.72,0.35,0.5), 2, true)
	# Small actual-city plan, drawn only in the debug tests via coordinates rather than a second renderer.

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.physical_keycode == KEY_E or event.physical_keycode == KEY_SPACE:
			interact()
		elif event.physical_keycode == KEY_ESCAPE:
			go_back()
		elif event.physical_keycode == KEY_F11:
			DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)

func go_back() -> void:
	if hud.modal.visible:
		hud.close_dialog()
	elif not current_room.is_empty():
		load_space("", city_return)
	else:
		show_menu()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST and is_instance_valid(hud):
		go_back()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT and is_instance_valid(hud):
		for code in [KEY_W,KEY_A,KEY_S,KEY_D,KEY_UP,KEY_DOWN,KEY_LEFT,KEY_RIGHT]:
			var released := InputEventKey.new()
			released.physical_keycode = code
			released.keycode = code
			released.pressed = false
			Input.parse_input_event(released)
		hud.touch.reset()

func show_menu() -> void:
	hud.show_dialog("Próba miasta Pyry", "WASD lub joystick: ruch. E / prawy przycisk: rozmowa i wejścia. Esc / Android Wstecz: zamknięcie lub wyjście z budynku. To lokalny prototyp miasta, bez konta i bez postępu z gry przeglądarkowej.", [{"text":"ZAPISZ POZYCJĘ PRÓBY", "callback":func(): save_checkpoint(); hud.close_dialog()}, {"text":"LICENCJE SILNIKA", "callback":show_licenses}])

func show_licenses() -> void:
	hud.show_dialog("Godot i biblioteki silnika", Engine.get_license_text() + "\n\nTHIRD-PARTY LICENSES\n" + JSON.stringify(Engine.get_license_info(), "\t") + "\n\nCOPYRIGHT NOTICES\n" + JSON.stringify(Engine.get_copyright_info(), "\t"))

func can_stand(at: Vector2, room: String) -> bool:
	var bounds := rectangle(data.bounds) if room.is_empty() else Rect2(0,0,float(data.rooms[room].width),float(data.rooms[room].height))
	if not at.is_finite() or not bounds.grow(-12).has_point(at):
		return false
	var obstacles: Array = data.obstacles if room.is_empty() else data.rooms[room].obstacles
	for obstacle: Dictionary in obstacles:
		var r := rectangle(obstacle)
		var closest := at.clamp(r.position, r.end)
		if at.distance_squared_to(closest) < 144:
			return false
	return true

func save_checkpoint(path: String = SAVE_PATH) -> bool:
	if checkpoint_protected or not can_stand(player.position, current_room):
		hud.toast("Nie zapisano punktu; istniejący plik pozostaje zachowany.")
		return false
	var value := {"format":"ki-godot-pyra-save-1","version":1,"room":current_room,"position":[player.position.x,player.position.y],"cityReturn":[city_return.x,city_return.y]}
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value))
	file.close()
	var result := DirAccess.rename_absolute(ProjectSettings.globalize_path(path + ".tmp"), ProjectSettings.globalize_path(path)) == OK
	hud.toast("Zapisano lokalną pozycję próby." if result else "Nie zapisano punktu próby.")
	return result

func restore_checkpoint(path: String = SAVE_PATH) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var value = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not value is Dictionary or value.get("format", "") != "ki-godot-pyra-save-1" or value.get("version",0) != 1:
		checkpoint_protected = true
		return false
	var room := str(value.get("room", ""))
	var pos = value.get("position", [])
	var returned = value.get("cityReturn", [])
	if (not room.is_empty() and not data.rooms.has(room)) or not pos is Array or pos.size() != 2 or not returned is Array or returned.size() != 2:
		checkpoint_protected = true
		return false
	if not (pos[0] is float or pos[0] is int) or not (pos[1] is float or pos[1] is int) or not (returned[0] is float or returned[0] is int) or not (returned[1] is float or returned[1] is int):
		checkpoint_protected = true
		return false
	var at := Vector2(float(pos[0]),float(pos[1]))
	var back := Vector2(float(returned[0]),float(returned[1]))
	if not can_stand(at, room) or not can_stand(back, ""):
		checkpoint_protected = true
		return false
	city_return = back
	load_space(room, at)
	return true

func capture_frame() -> void:
	for i in range(8):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("user://pyra-preview.png")
	print("CAPTURE: ", ProjectSettings.globalize_path("user://pyra-preview.png"))
