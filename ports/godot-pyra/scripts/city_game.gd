class_name PyraGame
extends Node2D
## KI Legends / Pyra on Godot: the whole continent (Superior v2 geometry), four safe cities with six service
## interiors each, the Legend with her full kit, plus the 2D map and 3D globe. No enemies and no spawns yet.

const CITY_PATH := "res://data/city.generated.json"
const ACTORS_PATH := "res://data/actors.json"
const ROOMS_PATH := "res://data/rooms.json"
const PYRA_CAPITAL_OFFSET := Vector2(44564.286027, 12168.472)
const ROLE_OF_SERVICE := {"shop": "merchant", "hall": "steward", "inn": "innkeeper", "smithy": "smith", "depot": "keeper", "arena": "trainer"}
const WORLD_OF_RACE := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}
const HOME_OF_RACE := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}
const LEGEND_PATH := "res://data/legend.json"
const SAVE_PATH := "user://city-checkpoint-v1.json"
const ALL_LANDS := ["pyra", "verdant", "aether", "nexus", "island-1", "island-2", "island-3", "island-4", "island-5", "island-6"]
const SAVE_FORMAT := "ki-godot-pyra-save-2"
const INTERACTION_RANGE := 160.0
const ZOOMS := [0.6, 0.8, 1.0]
const SERVICE_NAME := {"shop": "Sklep", "hall": "Sala Przysięgi", "inn": "Gospoda", "smithy": "Kuźnia", "depot": "Depozyt", "arena": "Arena"}

var data: Dictionary          # first-trial city (capital layout, rooms, NPC sheets), local frame
var hero: Dictionary
var actors: Dictionary
var rooms_data: Dictionary
var race := "legend"
var land_id := "pyra"
var land: Dictionary
var world_id := "pyra"
var continent: PyraContinent
var kit: RaceKit
var economy: PyraEconomy
var player := PyraPlayer.new()
var camera := Camera2D.new()
var hud := PyraHud.new()
var ui := CanvasLayer.new()
var markers: PyraMarkers
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
var monsters: PyraMonsters
var monster_data: Dictionary
var respawn_timer := -1.0
var prefetch_timer := 0.0
var prefetch_pending: Dictionary = {}   # path -> true while a worker thread loads it
var prefetch_hold: Array[Resource] = []  # the last few prefetched pictures and sheets, kept so entering a door does not decode them

## Interiors and their keepers are decoded on worker threads while the hero walks up to a door, so opening it never hitches.
func prefetch_rooms() -> void:
	for path: String in prefetch_pending.keys():
		var status := ResourceLoader.load_threaded_get_status(path)
		if status == ResourceLoader.THREAD_LOAD_LOADED:
			prefetch_hold.append(ResourceLoader.load_threaded_get(path))
			prefetch_pending.erase(path)
			while prefetch_hold.size() > 14:
				prefetch_hold.pop_front()
		elif status != ResourceLoader.THREAD_LOAD_IN_PROGRESS:
			prefetch_pending.erase(path)
	if not current_room.is_empty():
		return
	for target: Dictionary in outdoor_targets:
		if target.kind != "door" or player.position.distance_to(target.point) > 900.0:
			continue
		var spec: Dictionary = rooms_data[world_id].get(str(target.room), {})
		if spec.is_empty():
			continue
		var paths: Array[String] = [str(spec.picture)]
		var key := "%s.npc.%s" % [world_id, ROLE_OF_SERVICE.get(str(target.room), "")]
		if actors.has(key):
			for clip: Dictionary in (actors[key].clips as Dictionary).values():
				if clip.has("sheet"):
					paths.append(str(clip.sheet))
		for path in paths:
			if not prefetch_pending.has(path) and not ResourceLoader.has_cached(path):
				prefetch_pending[path] = true
				ResourceLoader.load_threaded_request(path)

func _ready() -> void:
	data = PyraContinent.load_json(CITY_PATH)
	actors = PyraContinent.load_json(ACTORS_PATH)
	rooms_data = PyraContinent.load_json(ROOMS_PATH)
	monster_data = PyraContinent.load_json("res://data/monsters.json")
	map_data = PyraContinent.load_json("res://data/map.json")
	get_tree().quit_on_go_back = false
	origin = PYRA_CAPITAL_OFFSET
	economy = PyraEconomy.new(PyraContinent.load_json("res://data/economy.json"))
	economy.heal_callback = func(fraction: float) -> bool:
		var top := float(kit.stats().maxHp)
		if kit.hp >= top:
			return false
		kit.heal(top * fraction)
		return true
	economy.changed.connect(on_economy_changed)
	economy.said.connect(func(text: String) -> void: hud.toast(text))
	camera.position_smoothing_enabled = false
	camera.zoom = Vector2.ONE * float(ZOOMS[zoom_index])
	player.can_stand = func(at: Vector2) -> bool: return stand(at)
	player.add_child(camera)
	add_child(ui)
	ui.add_child(hud)
	hud.touch.motion_changed.connect(func(value: Vector2): player.touch_motion = value)
	hud.touch.interaction_requested.connect(interact)
	hud.touch.attack_changed.connect(func(held: bool): attack_held = held)
	hud.touch.skill_requested.connect(use_slot)
	hud.touch.dodge_requested.connect(dodge)
	hud.touch.potion_requested.connect(func() -> void: economy.use("potion"))
	hud.menu_requested.connect(show_menu)
	hud.map_requested.connect(open_map)
	hud.character_requested.connect(open_character)
	hud.inventory_requested.connect(func() -> void: open_items("inventory", "Plecak i wyposażenie"))
	hud.zoom_requested.connect(cycle_zoom)
	hud.dialog_changed.connect(func(open: bool): player.locked = open or input_suspended)
	set_race("legend")
	enter_land(str(HOME_OF_RACE[race]))
	var args := OS.get_cmdline_user_args()
	var restored := false
	if "--fresh" not in args:
		restored = restore_checkpoint()
	hud.refresh(kit)
	if not restored and "--fresh" not in args and not checkpoint_protected:
		open_race_screen.call_deferred(false)
	if "--capture" in OS.get_cmdline_user_args():
		capture_frame.call_deferred()

## Chooses the race of the character: hero art, kit (stats, tree, abilities) and the home world.
func set_race(new_race: String) -> void:
	race = new_race
	var legend: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % race)
	kit = RaceKits.create(race, legend)
	kit.player_position = func() -> Vector2: return player.position
	kit.player_facing = func() -> Vector2: return player.facing
	kit.foes_in = foes_in
	kit.dash_towards = func(to: Vector2, distance: float) -> void: player.dash(to, distance)
	kit.target = func() -> Node: return current_target if is_instance_valid(current_target) else null
	kit.changed.connect(func() -> void: economy.level = kit.level)
	kit.effect.connect(on_effect)
	kit.damage_dealt.connect(on_damage)
	kit.said.connect(func(text: String) -> void: hud.toast(text))
	kit.gear = economy.gear()
	kit.terrain_at = func() -> String: return continent.terrain_kind(player.position) if is_instance_valid(continent) else "open"
	hero = actors[str(WORLD_OF_RACE[race]) + ".hero"]
	for clip: Dictionary in (hero.clips as Dictionary).values():   # decode every animation sheet of the hero off the main thread
		var sheet := str(clip.get("sheet", ""))
		if sheet != "" and not ResourceLoader.has_cached(sheet):
			ResourceLoader.load_threaded_request(sheet)
	player.setup(hero, float(kit.stats().speed))
	economy.level = kit.level

static func point(p: Dictionary) -> Vector2:
	return Vector2(float(p.x), float(p.y))

static func rectangle(r: Dictionary) -> Rect2:
	return Rect2(float(r.x), float(r.y), float(r.width), float(r.height))

# ---- world building ------------------------------------------------------------------------

## Loads one of the ten lands and builds its cities, doors, signposts and people. Called at start, on travel and on load.
func enter_land(id: String, at: Vector2 = Vector2(-1, -1)) -> void:
	input_suspended = true
	if is_instance_valid(continent):
		if player.get_parent() != null:
			player.get_parent().remove_child(player)
		remove_child(continent)
		continent.queue_free()
	if is_instance_valid(room_root):
		room_root.queue_free()
		room_root = null
	continent = PyraContinent.new()
	continent.setup_land(id)
	add_child(continent)
	move_child(continent, 0)
	land_id = id
	land = continent.cfg
	world_id = str(land.world)
	markers = PyraMarkers.new()
	continent.overlay.add_child(markers)
	outdoor_targets = [] as Array[Dictionary]
	settlements = [] as Array[Dictionary]
	if id == "pyra":
		build_pyra_capital()
	build_land_places()
	if not is_instance_valid(monsters):
		monsters = PyraMonsters.new()
		add_child(monsters)
	monsters.setup(self, monster_data, PyraContinent.load_json("res://data/lands/%s/spawns.json" % id))
	var start := at if at.x >= 0.0 else Vector2(float(land.arrival.x), float(land.arrival.y))
	city_return = start
	current_room = ""
	room_town = ""
	input_suspended = false
	load_space("", start)
	continent.update_view(camera_view(), true)   # the hero never starts in an empty land
	hud.set_land(land_id, continent.world_size, minimap_markers())

## The first trial's painted capital of Pyra: plaza floor, 53 props and the authored footprints.
func build_pyra_capital() -> void:
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
	for building: Dictionary in land.capitalBuildings:
		continent.sorted.add_child(PyraContinent.make_sprite(continent.texture_at(int(building.t)), Vector2(float(building.x), float(building.y)), Vector2(float(building.w), float(building.h)), Vector2(0.5, 0.92)))
	for obstacle: Dictionary in data.obstacles:
		var r := rectangle(obstacle)
		r.position += origin
		continent.block_rect(r, 12.0)

func add_street_npc(role: String, display_name: String, title: String, dialogue: String, at: Vector2) -> void:
	var key := "%s.npc.%s" % [world_id, role]
	if not actors.has(key):
		return
	var actor := PyraActor.new()
	actor.position = at
	continent.sorted.add_child(actor)
	actor.setup(actors[key], display_name, false)
	outdoor_targets.append({"kind": "npc", "id": role, "name": display_name, "point": at, "definition": {"name": display_name, "role": title, "dialogue": dialogue}})

## Points drawn on the minimap: the cities and the named places of the land.
func minimap_markers() -> Array[Dictionary]:
	var list: Array[Dictionary] = []
	for s: Dictionary in land.settlements:
		list.append({"point": Vector2(float(s.x), float(s.y)), "kind": "city"})
	for place: Dictionary in land.places:
		if str(place.kind) != "wilderness":
			list.append({"point": Vector2(float(place.x), float(place.y)), "kind": str(place.kind)})
	return list

func build_land_places() -> void:
	for s: Dictionary in land.settlements:
		settlements.append({"id": s.id, "name": s.name, "bounds": rectangle(s.bounds), "kind": s.kind})
		for service: Dictionary in s.services:
			var door := point(service.door)
			var label := str(SERVICE_NAME.get(service.service, service.service))
			outdoor_targets.append({"kind": "door", "id": service.id, "room": service.service, "name": label, "title": label + " · " + str(s.name), "point": door, "town": s.id})
			markers.points.append({"point": door})
		if str(s.kind) != "capital":
			var guide_at := Vector2(float(s.x), float(s.y)) + Vector2(0, 40)
			add_street_npc("guide", "Opiekun miasta", "Przewodnik", "Witaj w mieście %s. Usługi znajdziesz przy oznaczonych wejściach: sklep, sala, gospoda, kuźnia, depozyt i arena." % s.name, guide_at)
	for npc: Dictionary in land.npcs:
		if npc.building != null:
			continue
		var role := str(npc.id).trim_prefix("accepted-")
		add_street_npc(role, str(npc.name), str(npc.role), str(npc.dialogue), Vector2(float(npc.x), float(npc.y)))
	for guide: Dictionary in land.guides:
		add_street_npc("guide", str(guide.name), "Przewodnik szlaku", str(guide.dialogue), Vector2(float(guide.x), float(guide.y)))
	for place: Dictionary in land.famous:
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
		var spec: Dictionary = rooms_data[world_id][room]
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
	if current_room.is_empty() and is_instance_valid(monsters):
		found.append_array(monsters.foes_in(center, radius))
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
		if is_instance_valid(monsters):
			monsters.process_mode = Node.PROCESS_MODE_INHERIT
		continent.process_mode = Node.PROCESS_MODE_INHERIT
		continent.sorted.add_child(player)
		targets = outdoor_targets
		camera.limit_left = 0
		camera.limit_top = 0
		camera.limit_right = int(continent.world_size.x)
		camera.limit_bottom = int(continent.world_size.y)
		stream_center = Vector2(-99999, -99999)
	else:
		continent.visible = false
		if is_instance_valid(monsters):
			monsters.disengage_all()
			monsters.process_mode = Node.PROCESS_MODE_DISABLED
		continent.process_mode = Node.PROCESS_MODE_DISABLED
		var spec: Dictionary = rooms_data[world_id][room]
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
		var service_role := str(ROLE_OF_SERVICE.get(room, ""))
		var npc_def := capital_npc(room)
		var npc_at := point(spec.npc)
		var actor_key := "%s.npc.%s" % [world_id, service_role]
		if service_role != "" and actors.has(actor_key):
			var actor := PyraActor.new()
			actor.position = npc_at
			room_sorted.add_child(actor)
			actor.setup(actors[actor_key], str(npc_def.name), true)
			targets.append({"kind": "npc", "id": service_role, "name": str(npc_def.name), "point": npc_at, "definition": npc_def, "service": room})
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
	for npc: Dictionary in land.npcs:
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
	for place: Dictionary in land.places:
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
			if not rooms_data[world_id].has(room):
				hud.toast("Wnętrze nie jest dostępne.")
				return
			load_space(room, point(rooms_data[world_id][room].entry), str(target.town))
		"exit":
			load_space("", city_return)
		"npc":
			var npc: Dictionary = target.definition
			var actions := []
			var service := str(target.get("service", ""))
			var place := town_name(room_town) if room_town != "" else "Twierdza Popiołu"
			match service:
				"inn":
					actions.append({"text": "ODPOCZNIJ (%d monet)" % PyraEconomy.INN_PRICE, "callback": rest_at_inn})
				"shop":
					actions.append({"text": "HANDEL: KUP / SPRZEDAJ", "callback": func(): hud.close_dialog(); open_items("shop", "Sklep · " + place)})
				"smithy":
					actions.append({"text": "KUŹNIA: WYTWARZANIE", "callback": func(): hud.close_dialog(); open_items("smithy", "Kuźnia · " + place)})
				"depot":
					actions.append({"text": "OTWÓRZ SKRZYNIĘ", "callback": func(): hud.close_dialog(); open_items("depot", "Depozyt · " + place)})
			var extra := ""
			if service == "hall":
				extra = "\n\n(Zadania Sali Przysięgi nie są jeszcze przeniesione do wersji Godot.)"
			hud.show_dialog(str(npc.name) + " · " + str(npc.role), str(npc.dialogue) + extra, actions)
		"landmark":
			if target.id == "chest":
				open_items("depot", "Depozyt · " + (town_name(room_town) if room_town != "" else "Twierdza Popiołu"))
			elif target.id == "dummy":
				hud.show_dialog("Manekin treningowy", "Nie oddaje ciosów i nie płaci nagród. Użyj przycisku ATAK oraz zdolności z paska — pasek życia i liczby pokazują obrażenia. Po 4 s bez trafień manekin się leczy.")
			else:
				hud.show_dialog(str(target.name), "Punkt z istniejącego miasta.")
		"place":
			hud.show_dialog(str(target.name), "Znane miejsce Pyry. Odkrywanie lokacji i zadania będą przeniesione razem z mechaniką questów.")

# ---- combat -------------------------------------------------------------------------------

func in_safe_city(at: Vector2) -> bool:
	if not current_room.is_empty():
		return true
	for s in settlements:
		if (s.bounds as Rect2).grow(12).has_point(at):
			return true
	return false

## The closest thing the hero can fight: a monster outdoors, the training dummy in the arena.
func nearest_foe() -> Node2D:
	if current_room.is_empty():
		return monsters.nearest(player.position, 520.0) if is_instance_valid(monsters) else null
	return nearest_dummy()

## A monster hits the hero: damage through the kit (defence, shields, buffs), numbers, then the statuses it carries.
func hurt_player(monster: PyraMonster, raw: float, _kind: String, fx: Array) -> void:
	if in_safe_city(player.position) or kit.dead:
		return
	var dealt := kit.take_damage(raw)
	PyraFx.number(continent.sorted, player.position + Vector2(0, -90), int(round(dealt)), false)
	player.visual.hurt_flash()
	for f: Dictionary in fx:
		apply_status(f, monster)
	if kit.dead:
		hud.toast("Poległeś…")

func apply_status(f: Dictionary, monster: PyraMonster) -> void:
	var seconds := float(f.get("ms", 0.0)) / 1000.0
	match str(f.k):
		"slow":
			kit.add_debuff("slow", float(f.pct), seconds)
		"root", "stun", "fear":
			player.fx_lock = maxf(player.fx_lock, seconds)
			hud.touch.reset()
		"silence", "jam":
			kit.add_debuff("silence", 1.0, seconds)
		"dot":
			kit.add_debuff("dot", float(monster.def.atk) * float(f.atkPct) * float(f.get("stacks", 1)), seconds)
		"blind", "fog", "weaken", "armorDown", "mark":
			kit.add_debuff(str(f.k), float(f.pct), seconds)
		"breakShield":
			kit.shields.clear()
		"pull":
			player.dash(monster.position, float(f.dist))

## Experience, coins and loot of a defeated monster (rules and drop chances of the browser game).
func reward(def: Dictionary, at: Vector2) -> void:
	var xp := int(def.xp)
	var levels := kit.add_xp(xp)
	var gold_range: Array = def.gold
	var gold := randi_range(int(gold_range[0]), int(gold_range[1])) if int(gold_range[1]) > 0 else 0
	economy.gold += gold
	var names: Array[String] = []
	for entry: Dictionary in def.lootItems:
		if randf() <= float(entry.chance) and economy.items.has(str(entry.item)):
			economy.add_item(str(entry.item))
			names.append(economy.name_of(str(entry.item)))
	var pool: Dictionary = def.pool
	if float(pool.total) > 0.0 and randf() < float(monster_data.dropChance):
		var pick := randf() * float(pool.total)
		for i in (pool.ids as Array).size():
			pick -= float(pool.weights[i])
			if pick < 0.0:
				economy.add_item(str(pool.ids[i]))
				names.append(economy.name_of(str(pool.ids[i])))
				break
	economy.changed.emit()
	var text := "+%d XP" % xp
	if gold > 0:
		text += " · +%d mon." % gold
	if not names.is_empty():
		text += " · " + ", ".join(names)
	hud.toast(text)
	PyraFx.number(continent.sorted, at + Vector2(0, -60), xp, true)

func handle_death(delta: float) -> void:
	if kit.dead and respawn_timer < 0.0:
		respawn_timer = 3.0
		player.locked = true
		hud.touch.reset()
		attack_held = false
		if is_instance_valid(monsters):
			monsters.disengage_all()
		hud.toast("Poległeś. Za 3 s wrócisz do miasta.")
	if respawn_timer >= 0.0:
		respawn_timer -= delta
		if respawn_timer <= 0.0:
			respawn_timer = -1.0
			respawn_player()

func respawn_player() -> void:
	kit.dead = false
	kit.clear_debuffs()
	kit.hp = float(kit.stats().maxHp)
	kit.ki = float(kit.stats().maxKi)
	player.fx_lock = 0.0
	player.locked = false
	load_space("", Vector2(float(land.arrival.x), float(land.arrival.y)))
	continent.update_view(camera_view(), true)
	hud.toast("Wracasz do miasta.")

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
	var dummy := nearest_foe()
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
	if kit.debuff_pct("silence") > 0.0:
		hud.toast("Zdolności zablokowane (%.0f s)." % kit.debuff_left("silence"))
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

## Simulation runs once per rendered frame with the real frame time (clamped), not on the 60 Hz physics tick: on 90/120 Hz
## displays a fixed tick without interpolation makes the hero and the camera step unevenly.
func simulate(delta: float) -> void:
	if is_instance_valid(screen):
		return
	kit.tick(delta)
	economy.tick(delta)
	player.speed = float(kit.stats().speed) * (1.0 - clampf(kit.debuff_pct("slow"), 0.0, 0.9))
	handle_death(delta)
	player.set_ki_form(kit.buff_active("T"))
	if attack_held:
		do_basic()
	player.step(delta)
	player.z_index = 0

func _process(delta: float) -> void:
	if not is_instance_valid(hud) or not is_instance_valid(player):
		return
	simulate(minf(delta, 0.05))
	prefetch_timer -= delta
	if prefetch_timer <= 0.0:
		prefetch_timer = 0.4
		prefetch_rooms()
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
		var foe_out := nearest_foe()
		hud.set_target({"name": foe_out.label, "hp": foe_out.hp, "max": foe_out.max_hp, "level": int(foe_out.def.level)} if foe_out != null and foe_out.phase != "idle" else {})
		hud.set_player(player.position, player.facing)
	else:
		var foe := nearest_dummy()
		hud.set_target({"name": foe.label, "hp": foe.hp, "max": foe.max_hp} if foe != null and foe.position.distance_to(player.position) < 420.0 else {})
	hud.gold = economy.gold
	hud.potion_count = economy.count("potion")
	hud.potion_cooldown_ratio = clampf(economy.potion_cooldown / 6.0, 0.0, 1.0)
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
			KEY_I:
				open_items("inventory", "Plecak i wyposażenie")
			KEY_H:
				economy.use("potion")
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
	view.setup(map_data, land, player.position if current_room.is_empty() else city_return, region_name())
	view.travel.connect(travel_to)
	open_screen(view)

func open_race_screen(can_close: bool = true) -> void:
	if is_instance_valid(screen):
		return
	var view := RaceScreen.new()
	view.setup(can_close)
	view.chosen.connect(start_new_character)
	open_screen(view)

## A fresh character of the chosen race starts in that race's capital with the starting purse.
func start_new_character(new_race: String) -> void:
	close_screen()
	if not current_room.is_empty():
		load_space("", city_return)
	economy.gold = 20
	economy.bag = {"potion": 3}
	economy.depot = {}
	economy.depot_gold = 0
	for slot in PyraEconomy.SLOTS:
		economy.equipment[slot] = ""
	set_race(new_race)
	enter_land(str(HOME_OF_RACE[new_race]))
	hud.refresh(kit)
	hud.toast("Witaj w %s!" % str(land.name))

func travel_to(id: String) -> void:
	if not (id in ALL_LANDS) or id == land_id:
		return
	close_screen()
	if not current_room.is_empty():
		load_space("", city_return)
	enter_land(id)
	hud.toast("Przybyłeś: %s." % str(land.name))

func open_character() -> void:
	var view := CharacterScreen.new()
	view.setup(kit)
	open_screen(view)

func rest_at_inn() -> void:
	var s := kit.stats()
	var full := kit.hp >= float(s.maxHp) and kit.ki >= float(s.maxKi)
	if economy.rest(full):
		kit.rest_fully()
		hud.close_dialog()

func on_economy_changed() -> void:
	kit.gear = economy.gear()
	kit.refill_if_first()

func open_items(mode: String, heading: String) -> void:
	economy.level = kit.level
	var view := ItemsScreen.new()
	view.setup(economy, mode, heading)
	open_screen(view)

func show_menu() -> void:
	if is_instance_valid(screen):
		return
	hud.show_dialog("KI LEGENDS", "Lewy kciuk: ruch. Prawy: ATAK, cztery zdolności, UNIK i E przy wejściach oraz postaciach. MAPA: globus 3D, mapa 2D i podróże między krainami. POSTAĆ: statystyki i drzewko Twojej rasy. Klawiatura: WASD, Spacja (atak), 1–4, Shift (unik), E, M, C. Potwory żyją poza miastami (miasta są bezpieczne); po śmierci wracasz do stolicy krainy. Manekin czeka na arenach.", [{"text": "ZAPISZ POZYCJĘ I POSTAĆ", "callback": func(): save_checkpoint(); hud.close_dialog()}, {"text": "SAKIEWKA PRÓBNA +500 MONET", "callback": func(): economy.gold += 500; economy.changed.emit(); hud.close_dialog(); hud.toast("Dodano 500 monet próbnych.")}, {"text": "NOWA POSTAĆ (WYBÓR RASY)", "callback": func(): hud.close_dialog(); open_race_screen(true)}, {"text": "FPS I DIAGNOSTYKA: " + ("WYŁĄCZ" if hud.show_fps else "WŁĄCZ"), "callback": func(): hud.show_fps = not hud.show_fps; hud.signature = ""; hud.close_dialog()}, {"text": "LICENCJE SILNIKA", "callback": show_licenses}])

func show_licenses() -> void:
	hud.show_dialog("Godot i biblioteki silnika", Engine.get_license_text() + "\n\nTHIRD-PARTY LICENSES\n" + JSON.stringify(Engine.get_license_info(), "\t") + "\n\nCOPYRIGHT NOTICES\n" + JSON.stringify(Engine.get_copyright_info(), "\t") + "\n\nFONT CINZEL\n" + FileAccess.get_file_as_string("res://assets/branding/OFL-Cinzel.txt") + "\n\nOFFICIAL GODOT LOGO\n" + FileAccess.get_file_as_string("res://assets/branding/GODOT-LOGO-NOTICE.txt") + "\n" + FileAccess.get_file_as_string("res://assets/branding/GODOT-LOGO-LICENSE.txt"))

# ---- save ------------------------------------------------------------------------------------

func save_checkpoint(path: String = SAVE_PATH) -> bool:
	if checkpoint_protected or not can_stand(player.position, current_room):
		hud.toast("Nie zapisano punktu; istniejący plik pozostaje zachowany.")
		return false
	var value := {"format": SAVE_FORMAT, "version": 2, "race": race, "land": land_id, "room": current_room, "town": room_town, "position": [player.position.x, player.position.y], "cityReturn": [city_return.x, city_return.y], "kit": kit.to_save(), "economy": economy.to_save()}
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
	var saved_race := str(value.get("race", "legend"))
	var saved_land := str(value.get("land", "pyra"))
	if not WORLD_OF_RACE.has(saved_race) or not (saved_land in ALL_LANDS):
		checkpoint_protected = true
		return false
	var room := str(value.get("room", ""))
	var pos = value.get("position", [])
	var returned = value.get("cityReturn", [])
	var world_of_land := str(PyraContinent.load_json("res://data/lands/%s/land.json" % saved_land).world)
	if (not room.is_empty() and not rooms_data[world_of_land].has(room)) or not number_pair(pos) or not number_pair(returned):
		checkpoint_protected = true
		return false
	var shift := origin if legacy else Vector2.ZERO   # the first trial stored city-local coordinates
	var at := Vector2(float(pos[0]), float(pos[1])) + (shift if room.is_empty() else Vector2.ZERO)
	var back := Vector2(float(returned[0]), float(returned[1])) + shift
	var saved_kit = value.get("kit", {})
	var saved_economy = value.get("economy", null)
	if not legacy and (not saved_kit is Dictionary or (saved_economy != null and not saved_economy is Dictionary)):
		checkpoint_protected = true
		return false
	# Everything is validated against the target land and race before the running game is touched.
	var previous_race := race
	var previous_land := land_id
	var previous_state := kit.to_save()
	var previous_economy := economy.to_save()
	var previous_position := player.position
	if saved_race != race:
		set_race(saved_race)
	if saved_land != land_id:
		enter_land(saved_land, back)
	if not can_stand(at, room) or not can_stand(back, ""):
		checkpoint_protected = true
		rollback(previous_race, previous_land, previous_state, previous_economy, previous_position)
		return false
	if not legacy:
		if not kit.from_save(saved_kit) or (saved_economy != null and not economy.from_save(saved_economy)):
			checkpoint_protected = true
			rollback(previous_race, previous_land, previous_state, previous_economy, previous_position)
			return false
		economy.level = kit.level
	city_return = back
	load_space(room, at, str(value.get("town", "")))
	return true

func rollback(previous_race: String, previous_land: String, previous_state: Dictionary, previous_economy: Dictionary, previous_position: Vector2) -> void:
	if race != previous_race:
		set_race(previous_race)
	if land_id != previous_land:
		enter_land(previous_land, previous_position)
	kit.from_save(previous_state)
	economy.from_save(previous_economy)

func capture_frame() -> void:
	for i in range(8):
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("user://pyra-preview.png")
	print("CAPTURE: ", ProjectSettings.globalize_path("user://pyra-preview.png"))
