class_name PyraGame
extends Node2D
## KI Legends / Pyra on Godot: the whole continent (Superior v2 geometry), four safe cities with six service
## interiors each, the Legend with her full kit, plus the 2D map and 3D globe. No enemies and no spawns yet.

const CITY_PATH := "res://data/city.generated.json"
const HERO_PATH := "res://data/hero.json"
const LEGEND_PATH := "res://data/legend.json"
const SAVE_PATH := "user://city-checkpoint-v1.json"
const SAVE_FORMAT := "ki-godot-pyra-save-2"
const INTERACTION_RANGE := 160.0
const ZOOMS := [0.6, 0.8, 1.0]
const SERVICE_ACTOR := {"shop": "merchant", "hall": "steward", "inn": "innkeeper", "smithy": "smith", "depot": "keeper", "arena": "trainer"}
const SERVICE_NAME := {"shop": "Sklep", "hall": "Sala Przysięgi", "inn": "Gospoda", "smithy": "Kuźnia", "depot": "Depozyt", "arena": "Arena"}

var data: Dictionary          # first-trial city (capital layout, rooms, NPC sheets), local frame
var hero: Dictionary
var continent := PyraContinent.new()
var kit: LegendKit
var player := PyraPlayer.new()
var camera := Camera2D.new()
var hud := PyraHud.new()
var ui := CanvasLayer.new()
var markers := PyraMarkers.new()
var room_root: Node2D
var room_sorted: Node2D
var current_room := ""
var room_town := ""
var city_return := Vector2.ZERO
var origin := Vector2.ZERO    # capital-local -> world
var targets: Array[Dictionary] = []
var outdoor_targets: Array[Dictionary] = []
var room_bounds := Rect2()
var room_obstacles: Array = []
var dummies: Array[PyraDummy] = []
var current_target: Node
var checkpoint_protected := false
var input_suspended := false
var zoom_index := 1
var stream_center := Vector2(-99999, -99999)
var screen: Control
var attack_held := false
var settlements: Array[Dictionary] = []
var map_data: Dictionary
var time_since_save_check := 0.0

func _ready() -> void:
	data = PyraContinent.load_json(CITY_PATH)
	hero = PyraContinent.load_json(HERO_PATH)
	var legend: Dictionary = PyraContinent.load_json(LEGEND_PATH)
	map_data = PyraContinent.load_json("res://data/map.json")
	get_tree().quit_on_go_back = false
	continent.setup()
	add_child(continent)
	origin = Vector2(float(continent.world.offset[0]), float(continent.world.offset[1]))
	kit = LegendKit.new(legend)
	kit.player_position = func() -> Vector2: return player.position
	kit.player_facing = func() -> Vector2: return player.facing
	kit.foes_in = foes_in
	kit.dash_towards = func(to: Vector2, distance: float) -> void: player.dash(to, distance)
	kit.target = func() -> Node: return current_target
	kit.effect.connect(on_effect)
	kit.damage_dealt.connect(on_damage)
	kit.said.connect(func(text: String) -> void: hud.toast(text))
	continent.overlay.add_child(markers)
	player.setup(hero, float(kit.stats().speed))
	player.can_stand = func(at: Vector2) -> bool: return stand(at)
	camera.position_smoothing_enabled = false
	camera.zoom = Vector2.ONE * float(ZOOMS[zoom_index])
	player.add_child(camera)
	add_child(ui)
	ui.add_child(hud)
	hud.touch.motion_changed.connect(func(value: Vector2): player.touch_motion = value)
	hud.touch.interaction_requested.connect(interact)
	hud.touch.attack_changed.connect(func(held: bool): attack_held = held)
	hud.touch.skill_requested.connect(use_slot)
	hud.touch.dodge_requested.connect(dodge)
	hud.menu_requested.connect(show_menu)
	hud.map_requested.connect(open_map)
	hud.character_requested.connect(open_character)
	hud.zoom_requested.connect(cycle_zoom)
	hud.dialog_changed.connect(func(open: bool): player.locked = open or input_suspended)
	build_capital()
	build_towns()
	city_return = origin + point(data.spawn)
	load_space("", city_return)
	if "--fresh" not in OS.get_cmdline_user_args():
		restore_checkpoint()
	hud.refresh(kit)
	if "--capture" in OS.get_cmdline_user_args():
		capture_frame.call_deferred()

static func point(p: Dictionary) -> Vector2:
	return Vector2(float(p.x), float(p.y))

static func rectangle(r: Dictionary) -> Rect2:
	return Rect2(float(r.x), float(r.y), float(r.width), float(r.height))

# ---- world building ------------------------------------------------------------------------

func build_capital() -> void:
	# Floor tiles painted for the capital plaza; the whole square fades out at its border.
	var fade := ShaderMaterial.new()
	fade.shader = load("res://assets/continent/floor_fade.gdshader")
	fade.set_shader_parameter("region", Vector4(origin.x, origin.y, float(data["size"][0]), float(data["size"][1])))
	for tile: Dictionary in data.floor:
		var image := Sprite2D.new()
		image.texture = load(tile.texture)
		image.centered = false
		image.scale = Vector2(float(tile.width), float(tile.height)) / image.texture.get_size()
		image.position = origin + point(tile)
		image.material = fade
		continent.floor_layer.add_child(image)
	var building_objects := {}
	for building: Dictionary in data.buildings:
		building_objects[building.objectId] = true
	for object: Dictionary in data.objects:
		if building_objects.has(object.id):
			continue
		var layer_node: Node = continent.below if object.layer == "below" else continent.sorted
		var origin_point := Vector2(float(object.origin[0]), float(object.origin[1]))
		layer_node.add_child(PyraContinent.make_sprite(load(object.texture), origin + point(object), Vector2(float(object["size"][0]), float(object["size"][1])), origin_point))
	# The browser game's accepted city buildings (one painted house per service).
	for building: Dictionary in continent.world.capitalBuildings:
		var sprite := PyraContinent.make_sprite(continent.textures[int(building.t)], Vector2(float(building.x), float(building.y)), Vector2(float(building.w), float(building.h)), Vector2(0.5, 0.92))
		continent.sorted.add_child(sprite)
	for obstacle: Dictionary in data.obstacles:
		var r := rectangle(obstacle)
		r.position += origin
		continent.block_rect(r, 12.0)
	var capital: Dictionary = continent.world.capital
	settlements.append({"id": capital.id, "name": capital.name, "bounds": rectangle(capital.bounds)})
	for building: Dictionary in data.buildings:
		var door := origin + point(building.door)
		outdoor_targets.append({"kind": "door", "id": building.id, "room": building.id, "name": SERVICE_NAME.get(building.id, building.name), "title": building.name, "point": door, "town": capital.id})
		markers.points.append({"point": door})
	for npc: Dictionary in data.npcs:
		var building := str(npc.get("building", ""))
		if building != "":
			continue
		var at := origin + point(npc)
		add_street_npc(str(npc.id), npc.name, npc.role, str(npc.dialogue), at)

func add_street_npc(actor_id: String, display_name: String, role: String, dialogue: String, at: Vector2) -> void:
	if not data.actors.has(actor_id):
		return
	var actor := PyraActor.new()
	actor.position = at
	continent.sorted.add_child(actor)
	actor.setup(data.actors[actor_id], display_name, false)
	outdoor_targets.append({"kind": "npc", "id": actor_id, "name": display_name, "point": at, "definition": {"name": display_name, "role": role, "dialogue": dialogue}})

func build_towns() -> void:
	for town: Dictionary in continent.world.towns:
		settlements.append({"id": town.id, "name": town.name, "bounds": rectangle(town.bounds)})
		for service: Dictionary in town.services:
			var door := point(service.door)
			outdoor_targets.append({"kind": "door", "id": service.id, "room": service.service, "name": SERVICE_NAME.get(service.service, service.service), "title": SERVICE_NAME.get(service.service, service.service) + " · " + town.name, "point": door, "town": town.id})
			markers.points.append({"point": door})
		var guide_at := Vector2(float(town.x), float(town.y)) + Vector2(0, 40)
		add_street_npc("guide", "Opiekun miasta", "Przewodnik", "Witaj w mieście %s. Usługi znajdziesz przy oznaczonych wejściach: sklep, sala, gospoda, kuźnia, depozyt i arena." % town.name, guide_at)
	for guide: Dictionary in continent.world.guides:
		add_street_npc("guide", str(guide.name), "Przewodnik szlaku", str(guide.dialogue), Vector2(float(guide.x), float(guide.y)))
	for place: Dictionary in continent.world.famous:
		outdoor_targets.append({"kind": "place", "id": place.id, "name": place.name, "point": Vector2(float(place.x), float(place.y))})

# ---- spaces (continent and interiors) -------------------------------------------------------

func stand(at: Vector2) -> bool:
	if current_room.is_empty():
		return continent.walkable(at)
	if not at.is_finite() or not room_bounds.grow(-12).has_point(at):
		return false
	for obstacle in room_obstacles:
		var r := rectangle(obstacle)
		var closest := at.clamp(r.position, r.end)
		if at.distance_squared_to(closest) < 144:
			return false
	return true

func can_stand(at: Vector2, room: String) -> bool:
	var previous := current_room
	var previous_bounds := room_bounds
	var previous_obstacles := room_obstacles
	if not room.is_empty():
		var spec: Dictionary = data.rooms[room]
		room_bounds = Rect2(0, 0, float(spec.width), float(spec.height))
		room_obstacles = spec.obstacles
	current_room = room
	var result := stand(at)
	current_room = previous
	room_bounds = previous_bounds
	room_obstacles = previous_obstacles
	return result

func foes_in(center: Vector2, radius: float) -> Array:
	var found := []
	for dummy in dummies:
		if is_instance_valid(dummy) and dummy.position.distance_to(center) <= radius + 30.0:
			found.append(dummy)
	return found

func load_space(room: String, at: Vector2, town: String = "") -> void:
	input_suspended = true
	player.locked = true
	hud.touch.reset()
	attack_held = false
	if is_instance_valid(room_root):
		room_root.queue_free()
		room_root = null
	dummies.clear()
	current_target = null
	if player.get_parent() != null:
		player.get_parent().remove_child(player)
	current_room = room
	room_town = town
	player.set_interior(not room.is_empty())
	targets = [] as Array[Dictionary]
	if room.is_empty():
		continent.visible = true
		continent.process_mode = Node.PROCESS_MODE_INHERIT
		continent.sorted.add_child(player)
		targets = outdoor_targets
		camera.limit_left = 0
		camera.limit_top = 0
		camera.limit_right = int(PyraContinent.WORLD.x)
		camera.limit_bottom = int(PyraContinent.WORLD.y)
		stream_center = Vector2(-99999, -99999)
	else:
		continent.visible = false
		continent.process_mode = Node.PROCESS_MODE_DISABLED
		var spec: Dictionary = data.rooms[room]
		room_bounds = Rect2(0, 0, float(spec.width), float(spec.height))
		room_obstacles = spec.obstacles
		room_root = Node2D.new()
		add_child(room_root)
		var picture := Sprite2D.new()
		picture.texture = load(spec.picture)
		picture.centered = false
		picture.scale = room_bounds.size / picture.texture.get_size()
		picture.z_index = -2000
		room_root.add_child(picture)
		room_sorted = Node2D.new()
		room_sorted.y_sort_enabled = true
		room_root.add_child(room_sorted)
		room_sorted.add_child(player)
		targets.append({"kind": "exit", "id": "exit", "name": "Wyjście do miasta", "point": point(spec.exit)})
		var service_actor := str(SERVICE_ACTOR.get(room, ""))
		var npc_def := capital_npc(room)
		var npc_at := point(spec.npc)
		if not service_actor.is_empty() and data.actors.has(service_actor):
			var actor := PyraActor.new()
			actor.position = npc_at
			room_sorted.add_child(actor)
			actor.setup(data.actors[service_actor], str(npc_def.name), true)
			targets.append({"kind": "npc", "id": service_actor, "name": str(npc_def.name), "point": npc_at, "definition": npc_def, "service": room})
		if room == "depot":
			targets.append({"kind": "landmark", "id": "chest", "name": "Skrzynia depozytu", "point": point(spec.chest)})
		elif room == "arena":
			var dummy := PyraDummy.new()
			dummy.position = point(spec.dummy) + Vector2(330, 80)
			dummy.scale = Vector2(1.5, 1.5)
			room_sorted.add_child(dummy)
			dummies.append(dummy)
			targets.append({"kind": "landmark", "id": "dummy", "name": "Manekin treningowy", "point": dummy.position})
		var label := str(SERVICE_NAME.get(room, room))
		camera.limit_left = 0
		camera.limit_top = 0
		camera.limit_right = int(spec.width)
		camera.limit_bottom = int(spec.height)
		hud.place.text = label + (" · " + town_name(town) if town != "" else "")
	player.position = at
	player.visual.face(Vector2.DOWN)
	camera.reset_smoothing()
	input_suspended = false
	player.locked = hud.modal.visible
	queue_redraw()

func capital_npc(service: String) -> Dictionary:
	for npc: Dictionary in data.npcs:
		if str(npc.get("building", "")) == service:
			return npc
	return {"name": "Mieszkaniec", "role": "Mieszkaniec", "dialogue": ""}

func town_name(id: String) -> String:
	for s in settlements:
		if s.id == id:
			return s.name
	return ""

func region_name() -> String:
	var at := player.position
	for s in settlements:
		if (s.bounds as Rect2).grow(12).has_point(at):
			return str(s.name) + " · strefa bezpieczna"
	var best := ""
	var best_d := INF
	for place: Dictionary in continent.world.places:
		if place.kind != "wilderness":
			continue
		var d := at.distance_squared_to(Vector2(float(place.x), float(place.y)))
		if d < best_d:
			best_d = d
			best = str(place.name)
	return best if best != "" else "Pyra"

# ---- interaction ----------------------------------------------------------------------------

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
	if player.locked or hud.modal.visible or is_instance_valid(screen):
		return
	var target := nearest_target()
	if target.is_empty():
		hud.toast("Podejdź do postaci lub wejścia.")
		return
	match target.kind:
		"door":
			city_return = player.position
			var room := str(target.room)
			if not data.rooms.has(room):
				hud.toast("Wnętrze nie jest dostępne.")
				return
			load_space(room, point(data.rooms[room].entry), str(target.town))
		"exit":
			load_space("", city_return)
		"npc":
			var npc: Dictionary = target.definition
			var actions := []
			if target.get("service", "") == "inn":
				actions.append({"text": "ODPOCZNIJ (HP i KI)", "callback": func(): kit.rest_fully(); hud.close_dialog(); hud.toast("Odpoczęto: HP i KI odnowione.")})
			var service := str(target.get("service", ""))
			var extra := ""
			if service == "shop" or service == "smithy" or service == "depot":
				extra = "\n\n(Ta usługa nie jest jeszcze przeniesiona do wersji Godot: brak ekwipunku i handlu.)"
			hud.show_dialog(str(npc.name) + " · " + str(npc.role), str(npc.dialogue) + extra, actions)
		"landmark":
			if target.id == "dummy":
				hud.show_dialog("Manekin treningowy", "Nie oddaje ciosów i nie płaci nagród. Użyj przycisku ATAK oraz zdolności z paska — pasek życia i liczby pokazują obrażenia. Po 4 s bez trafień manekin się leczy.")
			else:
				hud.show_dialog(str(target.name), "Punkt pochodzi z istniejącego miasta. Ekwipunek i depozyt przedmiotów będą przenoszone w kolejnym etapie.")
		"place":
			hud.show_dialog(str(target.name), "Znane miejsce Pyry. Odkrywanie lokacji i zadania będą przeniesione razem z mechaniką questów.")

# ---- combat -------------------------------------------------------------------------------

func nearest_dummy() -> PyraDummy:
	var best: PyraDummy = null
	var best_d := 520.0
	for dummy in dummies:
		var d := dummy.position.distance_to(player.position)
		if d < best_d:
			best_d = d
			best = dummy
	return best

func face_target() -> void:
	var dummy := nearest_dummy()
	current_target = dummy
	if dummy != null:
		var toward := dummy.position - player.position
		player.facing = toward.normalized()
		player.visual.face(toward)

func do_basic() -> void:
	if player.locked or input_suspended:
		return
	if not kit.basic_ready():
		return
	face_target()
	var result := kit.basic()
	if result.ok:
		player.visual.play_once("attack" if int(kit.streak) % 2 == 0 else "attack2")

func use_slot(index: int) -> void:
	if player.locked or input_suspended or is_instance_valid(screen):
		return
	var id := kit.slots[index]
	if id == "":
		hud.toast("Pusty slot. Przypisz zdolność w ekranie POSTAĆ.")
		return
	face_target()
	var result := kit.use(id)
	if result.ok:
		player.visual.play_once(str(result.get("clip", "skill")))
	elif str(result.reason) != "":
		hud.toast(str(result.reason))

func dodge() -> void:
	if player.locked or input_suspended:
		return
	var direction := player.touch_motion if player.touch_motion.length() > 0.1 else player.facing
	var result := kit.dodge(direction)
	if result.ok:
		player.visual.play_once("dodge")

func on_effect(kind: String, at: Vector2, radius: float, ability: String) -> void:
	var parent: Node = room_sorted if not current_room.is_empty() else continent.sorted
	PyraFx.spawn(parent, kind, at, radius, ability, player.facing)

func on_damage(foe: Node, amount: int, crit: bool) -> void:
	var parent: Node = room_sorted if not current_room.is_empty() else continent.sorted
	PyraFx.number(parent, (foe as Node2D).position, amount, crit)

# ---- frame loop -----------------------------------------------------------------------------

func _physics_process(delta: float) -> void:
	if not is_instance_valid(hud) or not is_instance_valid(player):
		return
	if is_instance_valid(screen):
		return
	kit.tick(delta)
	player.speed = float(kit.stats().speed)
	player.set_ki_form(kit.buff_active("T"))
	if attack_held:
		do_basic()
	player.step(delta)
	player.z_index = 0

func _process(_delta: float) -> void:
	if not is_instance_valid(hud) or not is_instance_valid(player):
		return
	var target := nearest_target()
	hud.touch.enabled_target = not target.is_empty()
	hud.touch.action_text = "E"
	hud.hint.text = ("E · " + str(target.get("title", target.name))) if not target.is_empty() else ""
	if current_room.is_empty():
		hud.place.text = region_name()
		var view := camera_view()
		markers.view = view
		if player.position.distance_to(stream_center) > 420.0:
			stream_center = player.position
			continent.update_view(view)
	else:
		var dummy := nearest_dummy()
		hud.meter.text = ("Manekin: %d obrażeń/s · %d łącznie" % [int(dummy.recent_dps), int(dummy.total_taken)]) if dummy != null else ""
	if current_room.is_empty():
		hud.meter.text = ""
	hud.refresh(kit)

func camera_view() -> Rect2:
	var viewport := get_viewport_rect().size / camera.zoom
	return Rect2(player.position - viewport / 2.0, viewport)

func cycle_zoom() -> void:
	zoom_index = (zoom_index + 1) % ZOOMS.size()
	camera.zoom = Vector2.ONE * float(ZOOMS[zoom_index])
	stream_center = Vector2(-99999, -99999)
	hud.toast("Powiększenie %d%%" % int(round(float(ZOOMS[zoom_index]) * 100.0)))

# ---- input / lifecycle -----------------------------------------------------------------------

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_E, KEY_F:
				interact()
			KEY_SPACE:
				do_basic()
			KEY_1, KEY_2, KEY_3, KEY_4:
				use_slot(int(event.physical_keycode) - KEY_1)
			KEY_SHIFT:
				dodge()
			KEY_M:
				open_map()
			KEY_C:
				open_character()
			KEY_ESCAPE:
				go_back()
			KEY_F11:
				DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_WINDOWED if DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN else DisplayServer.WINDOW_MODE_FULLSCREEN)
	if event is InputEventKey and event.physical_keycode == KEY_SPACE:
		attack_held = event.pressed

func go_back() -> void:
	if is_instance_valid(screen):
		close_screen()
	elif hud.modal.visible:
		hud.close_dialog()
	elif not current_room.is_empty():
		load_space("", city_return)
	else:
		show_menu()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST and is_instance_valid(hud):
		go_back()
	elif what == NOTIFICATION_APPLICATION_FOCUS_OUT and is_instance_valid(hud):
		for code in [KEY_W, KEY_A, KEY_S, KEY_D, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT]:
			var released := InputEventKey.new()
			released.physical_keycode = code
			released.keycode = code
			released.pressed = false
			Input.parse_input_event(released)
		hud.touch.reset()

# ---- screens ---------------------------------------------------------------------------------

func close_screen() -> void:
	if is_instance_valid(screen):
		screen.queue_free()
	screen = null
	hud.suspended = false
	hud.visible = true
	hud.touch.blocked = false
	hud.touch.reset()
	player.locked = hud.modal.visible
	camera.enabled = true

func open_screen(instance: Control) -> void:
	if is_instance_valid(screen) or input_suspended:
		return
	if hud.modal.visible:
		hud.close_dialog()
	hud.touch.reset()
	hud.touch.blocked = true
	hud.suspended = true
	hud.visible = false
	player.locked = true
	screen = instance
	ui.add_child(screen)
	if screen.has_signal("closed"):
		screen.connect("closed", close_screen)

func open_map() -> void:
	var view := MapScreen.new()
	view.setup(map_data, continent.world, player.position if current_room.is_empty() else city_return, region_name())
	open_screen(view)

func open_character() -> void:
	var view := CharacterScreen.new()
	view.setup(kit)
	open_screen(view)

func show_menu() -> void:
	if is_instance_valid(screen):
		return
	hud.show_dialog("KI LEGENDS — Pyra", "Lewy kciuk: ruch. Prawy: ATAK, cztery zdolności, UNIK i E przy wejściach oraz postaciach. MAPA: globus 3D i mapa 2D. POSTAĆ: statystyki i drzewko Legendy. Klawiatura: WASD, Spacja (atak), 1–4, Shift (unik), E, M, C. W świecie nie ma jeszcze potworów; manekin czeka na arenach miast.", [{"text": "ZAPISZ POZYCJĘ I POSTAĆ", "callback": func(): save_checkpoint(); hud.close_dialog()}, {"text": "LICENCJE SILNIKA", "callback": show_licenses}])

func show_licenses() -> void:
	hud.show_dialog("Godot i biblioteki silnika", Engine.get_license_text() + "\n\nTHIRD-PARTY LICENSES\n" + JSON.stringify(Engine.get_license_info(), "\t") + "\n\nCOPYRIGHT NOTICES\n" + JSON.stringify(Engine.get_copyright_info(), "\t") + "\n\nFONT CINZEL\n" + FileAccess.get_file_as_string("res://assets/branding/OFL-Cinzel.txt"))

# ---- save ------------------------------------------------------------------------------------

func save_checkpoint(path: String = SAVE_PATH) -> bool:
	if checkpoint_protected or not can_stand(player.position, current_room):
		hud.toast("Nie zapisano punktu; istniejący plik pozostaje zachowany.")
		return false
	var value := {"format": SAVE_FORMAT, "version": 2, "room": current_room, "town": room_town, "position": [player.position.x, player.position.y], "cityReturn": [city_return.x, city_return.y], "kit": kit.to_save()}
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value))
	file.close()
	var result := DirAccess.rename_absolute(ProjectSettings.globalize_path(path + ".tmp"), ProjectSettings.globalize_path(path)) == OK
	hud.toast("Zapisano pozycję i postać." if result else "Nie zapisano punktu próby.")
	return result

static func number_pair(value: Variant) -> bool:
	return value is Array and value.size() == 2 and (value[0] is float or value[0] is int) and (value[1] is float or value[1] is int)

func restore_checkpoint(path: String = SAVE_PATH) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var value = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not value is Dictionary:
		checkpoint_protected = true
		return false
	var version := int(value.get("version", 0))
	var format := str(value.get("format", ""))
	var legacy := format == "ki-godot-pyra-save-1" and version == 1
	if not legacy and not (format == SAVE_FORMAT and version == 2):
		checkpoint_protected = true
		return false
	var room := str(value.get("room", ""))
	var pos = value.get("position", [])
	var returned = value.get("cityReturn", [])
	if (not room.is_empty() and not data.rooms.has(room)) or not number_pair(pos) or not number_pair(returned):
		checkpoint_protected = true
		return false
	var shift := origin if legacy else Vector2.ZERO   # the first trial stored city-local coordinates
	var at := Vector2(float(pos[0]), float(pos[1])) + (shift if room.is_empty() else Vector2.ZERO)
	var back := Vector2(float(returned[0]), float(returned[1])) + shift
	if not can_stand(at, room) or not can_stand(back, ""):
		checkpoint_protected = true
		return false
	if not legacy:
		var saved = value.get("kit", {})
		if not saved is Dictionary or not kit.from_save(saved):
			checkpoint_protected = true
			return false
	city_return = back
	load_space(room, at, str(value.get("town", "")))
	return true

func capture_frame() -> void:
	for i in range(8):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("user://pyra-preview.png")
	print("CAPTURE: ", ProjectSettings.globalize_path("user://pyra-preview.png"))
