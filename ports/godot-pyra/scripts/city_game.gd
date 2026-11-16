class_name PyraGame
extends Node2D
const GmPanel := preload("res://scripts/gm_panel.gd")
const GmTools := preload("res://scripts/gm_tools.gd")
const GameMenu := preload("res://scripts/game_menu.gd")
const BrowserImport := preload("res://scripts/browser_import.gd")   # characters of the browser game (loaded by path: it can arrive with a server update)
var gm_tools: RefCounted
## KI Legends / Pyra on Godot: the whole continent (Superior v2 geometry), four safe cities with six service
## interiors each, the Legend with her full kit, plus the 2D map and 3D globe. No enemies and no spawns yet.

const CITY_PATH := "res://data/city.generated.json"
const ACTORS_PATH := "res://data/actors.json"
const ROOMS_PATH := "res://data/rooms.json"
const PYRA_CAPITAL_OFFSET := Vector2(44564.286027, 12168.472)
## The warden of each continent's capital tells about the lairs of its bosses (the browser game has one for Verdantia, Kaelen;
## the other three are written for the port in the same voice).
const WARDENS := {
	"verdant": {"name": "Kaelen", "role": "Strażnik Leża Ygdrashy", "dialogue": "Stoisz przed matecznikiem puszczy. W głębi drzew czuwa Ygdrasha – pradawna matka korzeni. Jej pnącza więżą, a jad zatruwa nieuważnych. Używaj ognia i unikaj trujących kałuż!"},
	"aether": {"name": "Ilvara", "role": "Strażniczka Leży Sanktuarium", "dialogue": "Kronikarze zapisali dwa imiona, o których szepcze się za murami Sanktuarium. Nie idź tam bez planu i bez mikstur."},
	"nexus": {"name": "Strażnik K-7", "role": "Strażnik Leży Rdzenia", "dialogue": "Czujniki wykryły dwie jednostki nieznanej klasy poza murami Węzła. Procedura zaleca przygotowanie przed kontaktem."},
	"pyra": {"name": "Draven", "role": "Strażnik Leży Krateru", "dialogue": "Na południu, w lawowych kraterach, zbierają moc dwaj, którym nikt nie śmiał stanąć na drodze. Pamiętaj: leża bossów to nie miejsce dla słabych."},
}
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
var boss_data: Dictionary
var dungeon_data: Dictionary
var dungeon: PyraDungeon
var world_events: PyraWorldEvents
var remote: PyraRemotePlayers
var chat_log: Array[String] = []
var chat_panel: PyraChat
var autosave_clock := 0.0
var cloud_pushing := false
var cloud_dialog_open := false
var world_time := 40.0                  # seconds of the game day (480 s, night from 300 s); not saved, the day starts in the morning
var day_tint := CanvasModulate.new()
var citizens: Array[Dictionary] = []    # street NPCs that stroll around their post
var citizen_clock := 0.0
var dungeon_state: Dictionary = {}     # dungeon id -> {"keys", "gates", "chests", "secrets"}: id lists, saved with the character
var dungeon_explored: Dictionary = {}  # "<id>#<floor>" -> automap cells (kept while the game runs)
var respawn_timer := -1.0
var quests: PyraQuests
var story := PyraStory.new()
var skip_intro := false                       # tests start many characters and do not want the story screen
var fed_clock := 0.0                          # the "fed" tracker entry is refreshed once a second while it lasts
var fed_shown := false
var combo_count := 0                          # basic strikes in the current chain: attack, attack2, finisher
var combo_at := -10.0
var shake := 0.0                              # camera shake amplitude in pixels, decays by itself
var hit_stopping := false
var perfect_dodges := 0
var dodge_at := -10.0                         # when the last dodge began (seconds)
var perfect_until := 0.0                      # no second perfect dodge before this time
var heavy_until := 0.0                        # the hit clip is not replayed before this time
var target_ring: PyraTargetRing = PyraTargetRing.new()
var walk_time := 0.0                          # seconds of walking, for the first tutorial step
var rewarding_tutorial := false
var quest_actors: Array[Dictionary] = []     # {actor, role, town} for the "!" and "?" marks
var audio: PyraAudio
var quest_timer := 0.0
var ambience_timer := 0.0
var talk_turns: Dictionary = {}   # npc key -> how many times the hero has talked (rotates greetings and rumors)
var last_town := ""
var last_level := 0
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
	boss_data = PyraContinent.load_json("res://data/bosses.json")
	dungeon_data = PyraContinent.load_json("res://data/dungeons.json")
	audio = PyraAudio.new()
	add_child(audio)
	quests = PyraQuests.new(PyraContinent.load_json("res://data/quests.json"))
	story.changed.connect(on_story_changed)
	quests.level_of = func() -> int: return kit.level if kit != null else 1
	quests.item_count = func(id: String) -> int: return economy.count(id)
	quests.item_take = func(id: String, n: int) -> bool: return economy.remove_item(id, n)
	quests.rewarded.connect(on_quest_reward)
	quests.announce.connect(func(text: String) -> void:
		hud.toast(text)
		if text.begins_with("Zadanie ukończone"):
			audio.sfx("common/quest-complete")
		elif text.begins_with("Nowe zadanie"):
			audio.sfx("ui/quest-accept")
		else:
			audio.sfx("ui/quest-update"))
	quests.changed.connect(refresh_quest_ui)
	map_data = PyraContinent.load_json("res://data/map.json")
	get_tree().quit_on_go_back = false
	origin = PYRA_CAPITAL_OFFSET
	add_child(day_tint)
	economy = PyraEconomy.new(PyraContinent.load_json("res://data/economy.json"))
	economy.heal_callback = func(fraction: float) -> bool:
		var top := float(kit.stats().maxHp)
		if kit.hp >= top or healing_blocked():
			return false
		kit.heal(top * fraction)
		return true
	economy.add_foods(PyraContinent.load_json("res://data/food.json"))
	economy.eat_callback = func(food: Dictionary) -> Dictionary:
		if healing_blocked():
			return {"ok": false, "reason": "Nie możesz teraz jeść."}
		return kit.eat(food)
	economy.heal_amount_callback = func(amount: float) -> bool:
		var top := float(kit.stats().maxHp)
		if kit.hp >= top or healing_blocked():
			return false
		kit.heal(amount)
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
	hud.touch.potion_requested.connect(use_potion)
	hud.menu_requested.connect(show_menu)
	hud.map_requested.connect(open_map)
	hud.character_requested.connect(open_character)
	hud.inventory_requested.connect(func() -> void: open_items("inventory", "Plecak i wyposażenie"))
	hud.zoom_requested.connect(cycle_zoom)
	hud.gm_requested.connect(open_gm)
	KiNet.online().session_changed.connect(sync_staff_access)
	sync_staff_access()
	gm_tools = GmTools.new()
	gm_tools.setup(self, KiNet.online())
	hud.dialog_changed.connect(func(open: bool): player.locked = open or input_suspended)
	var boot_race := "legend"
	var boot_land := "pyra"
	if "--fresh" not in OS.get_cmdline_user_args() and FileAccess.file_exists(SAVE_PATH):
		# Open straight in the land of the saved character (a slim install only has that land's content).
		var peek: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
		if peek is Dictionary and WORLD_OF_RACE.has(str(peek.get("race", ""))) and (str(peek.get("land", "")) in ALL_LANDS):
			boot_race = str(peek.race)
			boot_land = str(peek.land)
	set_race(boot_race)
	enter_land(boot_land)
	var args := OS.get_cmdline_user_args()
	var restored := false
	if "--fresh" not in args:
		restored = restore_checkpoint()
	hud.refresh(kit)
	KiNet.core_ok()   # the first land stands: a downloaded core (scripts/boot.gd) has proved itself
	start_online.call_deferred()
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
	kit.said.connect(func(text: String) -> void:
		hud.toast(text)
		if text.begins_with("Poziom "):
			audio.sfx("common/level-up")
		elif PyraAudio.is_refusal(text):
			audio.sfx("common/no-energy"))
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
	quest_actors = [] as Array[Dictionary]
	citizens = [] as Array[Dictionary]
	last_town = ""
	if id == "pyra":
		build_pyra_capital()
	build_land_places()
	if not is_instance_valid(monsters):
		monsters = PyraMonsters.new()
		add_child(monsters)
	monsters.setup(self, monster_data, PyraContinent.load_json("res://data/lands/%s/spawns.json" % id))
	if not is_instance_valid(world_events):
		world_events = PyraWorldEvents.new()
		add_child(world_events)
	var land_events: Array = []
	for e: Dictionary in quests.data.events:
		if str(e.continent) == id:
			land_events.append(e)
	world_events.setup(self, land_events, event_anchors(land_events.size()))
	var start := at if at.x >= 0.0 else Vector2(float(land.arrival.x), float(land.arrival.y))
	city_return = start
	current_room = ""
	room_town = ""
	input_suspended = false
	load_space("", start)
	continent.update_view(camera_view(), true)   # the hero never starts in an empty land
	hud.set_land(land_id, continent.world_size, minimap_markers())
	audio.play_music(world_id)

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
	quest_actors.append({"actor": actor, "role": role, "town": settlement_at(at)})
	var target := {"kind": "npc", "id": role, "name": display_name, "point": at, "definition": {"name": display_name, "role": title, "dialogue": dialogue}}
	outdoor_targets.append(target)
	if role != "warden":   # the warden stands at his post; the others walk a little
		citizens.append({"actor": actor, "target": target, "home": at, "goal": at, "wait": randf() * 4.0, "speed": randf_range(26.0, 38.0), "radius": 110.0 if role != "guide" else 70.0})

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
	if WARDENS.has(land_id):
		var capital_settlement: Dictionary = land.settlements[0]
		var warden: Dictionary = WARDENS[land_id]
		add_street_npc("warden", str(warden.name), str(warden.role), str(warden.dialogue), Vector2(float(capital_settlement.x), float(capital_settlement.y)) + Vector2(-260, 130))
	for entrance: Dictionary in (dungeon_data.lands as Dictionary).get(land_id, []):
		outdoor_targets.append({"kind": "dungeon", "id": entrance.id, "name": "Jaskinia", "title": "Wejście do jaskini", "point": Vector2(float(entrance.x), float(entrance.y)) + Vector2(0, 70), "entrance": entrance})
		markers.points.append({"point": Vector2(float(entrance.x), float(entrance.y)) + Vector2(0, 70)})
	for place: Dictionary in land.famous:
		outdoor_targets.append({"kind": "place", "id": place.id, "name": place.name, "point": Vector2(float(place.x), float(place.y))})

# ---- spaces (continent and interiors) -------------------------------------------------------

func in_dungeon() -> bool:
	return current_room == "dungeon" and dungeon != null

## Where monsters, hit numbers and ground effects live: the continent outdoors, the room's own layer in a cave.
func monster_parent() -> Node:
	return room_sorted if in_dungeon() else continent.sorted

func fx_parent() -> Node:
	return room_sorted if in_dungeon() else continent.overlay

func stand(at: Vector2) -> bool:
	if in_dungeon():
		return at.is_finite() and dungeon.walkable(at)
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
	if (current_room.is_empty() or in_dungeon()) and is_instance_valid(monsters):
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
	if room != "dungeon":
		leave_dungeon_state()
	current_room = room
	room_town = town
	player.set_interior(not room.is_empty())
	targets = [] as Array[Dictionary]
	if room == "dungeon":
		continent.visible = false
		continent.process_mode = Node.PROCESS_MODE_DISABLED
		monsters.clear_all()
		monsters.process_mode = Node.PROCESS_MODE_INHERIT
		room_bounds = dungeon.bounds()
		room_obstacles = []
		room_root = Node2D.new()
		add_child(room_root)
		room_sorted = Node2D.new()
		room_sorted.y_sort_enabled = true
		room_root.add_child(room_sorted)
		room_sorted.add_child(player)
		dungeon.build(room_root, room_sorted, player)
		hud.set_cave(dungeon)
		targets = dungeon.targets()
		var spots: Array = []
		for g: Dictionary in dungeon.guards:
			spots.append(g)
		monsters.populate_dungeon(spots, func(cell: Vector2i) -> Vector2: return dungeon.center(cell))
		for trap in dungeon.traps:
			monsters.add_zone({"kind": "spikes", "ms": 99999999, "radius": 46, "dps": 0.35}, trap, 28.0 + 6.0 * float(dungeon.reward_tier()))
		camera.limit_left = 0
		camera.limit_top = 0
		camera.limit_right = int(room_bounds.size.x)
		camera.limit_bottom = int(room_bounds.size.y)
		hud.place.text = dungeon.depth_text()
		player.position = at
		dungeon.reveal(at)
		player.visual.face(Vector2.DOWN)
		camera.reset_smoothing()
		input_suspended = false
		player.locked = hud.modal.visible
		queue_redraw()
		return
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
			quest_actors.append({"actor": actor, "role": service_role, "town": town if town != "" else capital_id()})
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

## Quest journal: active quests with their objectives, then the number of open and finished ones. Tapping a title tracks it.
func next_volume(current: float) -> float:
	var steps := [0.0, 0.3, 0.6, 1.0]
	for v: float in steps:
		if v > current + 0.01:
			return v
	return 0.0

func show_journal() -> void:
	var lines: Array[String] = []
	var actions := []
	for id: String in quests.active_ids():
		var q: Dictionary = quests.by_id[id]
		lines.append("▶ %s%s\n%s\n   %s" % [q.title, "  (śledzone)" if quests.tracked == id else "", q.stages[int(quests.quests[id].stage)].narrativeText, "\n   ".join(quests.objectives_text(id))])
		var track_id := id
		actions.append({"text": "ŚLEDŹ: " + str(q.title), "callback": func() -> void:
			quests.tracked = track_id
			quests.changed.emit()
			hud.close_dialog()})
	if lines.is_empty():
		lines.append("Brak aktywnych zadań. Rozmawiaj z mieszkańcami miast — postacie ze znakiem ! mają dla Ciebie zadanie.")
	var open := 0
	var done := 0
	for id: String in quests.quests:
		var st := quests.state_of(id)
		open += 1 if st == "available" else 0
		done += 1 if st == "completed" else 0
	lines.append("\nDostępne do przyjęcia: %d · ukończone: %d" % [open, done])
	hud.show_dialog("Dziennik zadań", "\n\n".join(lines), actions.slice(0, 4))

func capital_id() -> String:
	for s in settlements:
		if str(s.kind) == "capital":
			return str(s.id)
	return str(settlements[0].id) if not settlements.is_empty() else ""

## Settlement a point belongs to (generously: NPCs stand at its edges), the capital when none.
func settlement_at(at: Vector2) -> String:
	for s in settlements:
		if (s.bounds as Rect2).grow(300).has_point(at):
			return str(s.id)
	return capital_id()

func is_quest_land() -> bool:
	return quests.data.places.has(land_id)

func on_quest_reward(xp: int, coins: int, items: Dictionary, source: String) -> void:
	var parts: Array[String] = []
	if xp > 0:
		if kit.add_xp(xp) > 0:
			celebrate_level()
		parts.append("+%d XP" % xp)
	if coins > 0:
		economy.gold += coins
		parts.append("+%d mon." % coins)
		audio.sfx("common/gold")
	for id: String in items:
		economy.add_item(id, int(items[id]))
		parts.append("%s ×%d" % [economy.name_of(id), int(items[id])])
	economy.changed.emit()
	hud.toast("%s: %s" % [source, " · ".join(parts)] if not parts.is_empty() else source)

## The status "fed" as a tracker entry: how long it lasts and what it gives.
func fed_entry() -> Dictionary:
	var left := kit.fed_left()
	if left <= 0.0:
		return {}
	return {"title": "Najedzony · %d s" % ceili(left), "lines": ["+%s%% życia na sekundę" % PyraEconomy.percent_text(float(kit.buff("fed").hpRegenPct))]}

func refresh_quest_ui() -> void:
	var entries: Array[Dictionary] = story.tracker()
	var fed := fed_entry()
	if not fed.is_empty():
		entries.insert(0, fed)
	entries.append_array(quests.tracker())
	hud.quests = entries
	hud.signature = ""
	for entry in quest_actors:
		if is_instance_valid(entry.actor):
			var mark := quests.marker_for(land_id, str(entry.town), str(entry.role)) if is_quest_land() else ""
			if (entry.actor as PyraActor).quest_mark != mark:
				(entry.actor as PyraActor).quest_mark = mark
				(entry.actor as PyraActor).queue_redraw()

func quest_tick(delta: float) -> void:
	if not is_quest_land():
		return
	if kit.level != last_level:
		last_level = kit.level
		quests.sync()
		refresh_quest_ui()
	quest_timer -= delta
	if quest_timer > 0.0:
		return
	quest_timer = 0.5
	if current_room.is_empty():
		quests.near(land_id, player.position)
		var here := ""
		for s in settlements:
			if (s.bounds as Rect2).has_point(player.position):
				here = str(s.id)
		if here != last_town:
			last_town = here
			if here != "":
				quests.enter_town(land_id, here)

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
	var all: Array = targets
	if current_room.is_empty() and is_instance_valid(world_events):
		all = targets + world_events.targets()
	for target in all:
		var d := player.position.distance_to(target.point)
		if d < distance:
			distance = d
			result = target
	return result

## Where each world event of the land plays: on the road between the capital and the other cities, to either side, on open ground.
func event_anchors(count: int) -> Array:
	var anchors: Array = []
	var capital := Vector2(float(land.settlements[0].x), float(land.settlements[0].y))
	var others: Array[Vector2] = []
	for i in range(1, land.settlements.size()):
		others.append(Vector2(float(land.settlements[i].x), float(land.settlements[i].y)))
	for i in count:
		var far: Vector2 = others[i % others.size()] if not others.is_empty() else capital + Vector2(4000, 0)
		var along := capital.lerp(far, clampf(0.34 + 0.1 * float(i / maxi(1, others.size())), 0.3, 0.75))
		var side := (far - capital).normalized().orthogonal() * (320.0 + 110.0 * float(i)) * (1.0 if i % 2 == 0 else -1.0)
		anchors.append(open_ground(along + side))
	return anchors

func interact() -> void:
	if player.locked or hud.modal.visible or is_instance_valid(screen):
		return
	var target := nearest_target()
	if target.is_empty():
		hud.toast("Podejdź do postaci lub wejścia.")
		return
	if target.kind != "door" and target.kind != "dummy" and not in_dungeon_hazard(target):
		player.visual.face(Vector2(target.get("point", player.position)) - player.position)
		player.visual.play_once("interact")
	match target.kind:
		"door":
			audio.sfx("common/door")
			city_return = player.position
			var room := str(target.room)
			if not rooms_data[world_id].has(room):
				hud.toast("Wnętrze nie jest dostępne.")
				return
			load_space(room, point(rooms_data[world_id][room].entry), str(target.town))
		"exit":
			load_space("", city_return)
		"dungeon":
			offer_dungeon(target.entrance)
		"ddown":
			change_floor(1)
		"dup":
			change_floor(-1)
		"dtransit":
			use_transit()
		"dnote":
			hud.show_dialog("Inskrypcja", str(target.text))
			audio.sfx("ui/quest-update")
		"dsecret":
			if dungeon.open_secret(player.position):
				story.milestone("secret")
				audio.sfx("common/door")
				hud.toast("Ściana pęka. Za nią kryje się komora.")
				targets = dungeon.targets()
		"event":
			world_events.use(target)
		"dkey":
			if dungeon.pick_up_key(player.position):
				audio.sfx("common/loot")
				hud.toast("Podniesiono stary klucz. Pasuje do kraty w głębi jaskini.")
				targets = dungeon.targets()
		"dgate":
			if dungeon.open_gate(player.position):
				audio.sfx("common/door")
				hud.toast("Krata ustępuje. Droga do skarbca stoi otworem.")
				targets = dungeon.targets()
			else:
				hud.toast("Krata jest zamknięta. Potrzebny jest klucz.")
		"dchest":
			var reward := dungeon.claim(str(target.id), player.position)
			if not reward.is_empty():
				economy.gold += int(reward.gold)
				economy.add_item("potion", int(reward.potions))
				economy.changed.emit()
				audio.sfx("common/loot")
				hud.toast("Skrzynia: +%d monet, mikstury ×%d." % [int(reward.gold), int(reward.potions)])
				targets = dungeon.targets()
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
			story.note("talk")
			var topic_role := str(ROLE_OF_SERVICE.get(service, "")) if service != "" else str(target.id)
			var remark := PyraStory.reaction(reaction_flags(), int(talk_turns.get("remark", 0)))
			talk_turns["remark"] = int(talk_turns.get("remark", 0)) + 1
			if remark != "":
				extra += "\n\n" + remark
			if not PyraStory.topics(world_id, topic_role).is_empty():
				var topic_name := str(npc.name)
				actions.append({"text": "ROZMOWA", "callback": func() -> void: open_topics(topic_name, topic_role)})
			if is_quest_land():
				var role := str(ROLE_OF_SERVICE.get(service, "")) if service != "" else str(target.id)
				var town := room_town if room_town != "" else (settlement_at(player.position) if service == "" else capital_id())
				quests.talk(land_id, town, role)
				var turn_key := "%s/%s/%s" % [land_id, town, role]
				var turn := int(talk_turns.get(turn_key, 0))
				talk_turns[turn_key] = turn + 1
				var talk := quests.conversation(land_id, town, role, turn)
				if not (talk.lines as Array).is_empty():
					extra += "\n\n" + "\n\n".join(talk.lines)
					if not (talk.rumors as Array).is_empty():
						var rumor_text: String = str(talk.rumors[turn % (talk.rumors as Array).size()])
						actions.append({"text": "POSŁUCHAJ PLOTEK", "callback": func() -> void: hud.show_dialog("Plotki · " + str(talk.who), rumor_text)})
				for offer: Dictionary in quests.offered_by(land_id, town, role):
					extra += "\n\nZadanie: %s (poz. %d)\n%s" % [offer.title, int(offer.recommendedLevel), offer.summary]
					var offered_id: String = str(offer.id)
					actions.append({"text": "PRZYJMIJ: " + str(offer.title), "callback": func() -> void:
						quests.start(offered_id)
						hud.close_dialog()})
				for need: Dictionary in quests.deliveries():
					var have := economy.count(str(need.item))
					if have > 0:
						var item_id: String = str(need.item)
						var amount := mini(have, int(need.needed))
						actions.append({"text": "PRZEKAŻ: %s ×%d" % [economy.name_of(item_id), amount], "callback": func() -> void:
							quests.record("deliver", item_id, amount)
							hud.close_dialog()})
			if str(target.id) == "warden" and service == "":
				for info: Dictionary in boss_data.bosses:
					if str(info.continent) != land_id:
						continue
					extra += "\n\n%s (poz. %d+)\n%s\n%s\nSłabość: %s" % [info.name, int(info.level), info.locationName, info.behavior, info.weakness]
					var boss_id: String = str(info.id)
					actions.append({"text": "WEJDŹ DO LEŻA: " + str(info.name), "callback": func() -> void: enter_boss_lair(boss_id)})
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
	if in_dungeon():
		return false
	if not current_room.is_empty():
		return true
	for s in settlements:
		if (s.bounds as Rect2).grow(12).has_point(at):
			return true
	return false

## The closest thing the hero can fight: a monster outdoors, the training dummy in the arena.
func nearest_foe() -> Node2D:
	if current_room.is_empty() or in_dungeon():
		return monsters.nearest(player.position, 520.0) if is_instance_valid(monsters) else null
	return nearest_dummy()

## A monster hits the hero: damage through the kit (defence, shields, buffs), numbers, then the statuses it carries.
func hurt_player(monster: PyraMonster, raw: float, _kind: String, fx: Array) -> void:
	if in_safe_city(player.position) or kit.dead or kit.gm_invulnerable:
		return
	if kit.has_buff("invulnerable"):
		check_perfect_dodge()
		return
	var dealt := kit.take_damage(raw)
	PyraFx.number(monster_parent(), player.position + Vector2(0, -90), int(round(dealt)), false, "hurt")
	PyraFx.spawn(monster_parent(), "hurt", player.position, 60.0, "")
	player.visual.hurt_flash()
	var heavy := dealt >= float(kit.stats().maxHp) * 0.15
	var now_s := Time.get_ticks_msec() / 1000.0
	if dealt > 0.0 and not kit.dead and (heavy or now_s >= heavy_until):
		heavy_until = now_s + 0.55
		player.visual.play_once("hitheavy" if heavy else "hit")
	add_shake(9.0 if heavy else 4.0)
	audio.sfx("common/player-hurt")
	for f: Dictionary in fx:
		apply_status(f, monster)
	if kit.dead:
		hud.toast("Poległeś…")

## A ground zone (cloud, fire trail, web) ticks on the hero: damage as a fraction of the owner's attack, then its statuses.
func zone_hit(raw: float, fx: Array, atk: float, at: Vector2) -> void:
	if in_safe_city(player.position) or kit.dead or kit.gm_invulnerable or kit.has_buff("invulnerable"):
		return
	if raw > 0.0:
		var dealt := kit.take_damage(raw)
		PyraFx.number(monster_parent(), player.position + Vector2(0, -90), int(round(dealt)), false, "hurt")
		if kit.dead:
			hud.toast("Poległeś…")
	for f: Dictionary in fx:
		apply_fx(f, atk, at)

func apply_status(f: Dictionary, monster: PyraMonster) -> void:
	apply_fx(f, float(monster.def.atk), monster.position)

func apply_fx(f: Dictionary, atk: float, from: Vector2) -> void:
	var seconds := float(f.get("ms", 0.0)) / 1000.0
	audio.status(str(f.get("id", f.k)))
	match str(f.k):
		"slow":
			kit.add_debuff("slow", float(f.pct), seconds)
		"root", "stun", "fear":
			player.fx_lock = maxf(player.fx_lock, seconds)
			hud.touch.reset()
		"silence", "jam":
			kit.add_debuff("silence", 1.0, seconds)
		"dot":
			kit.add_debuff("dot", atk * float(f.atkPct) * float(f.get("stacks", 1)), seconds)
		"blind", "fog", "weaken", "armorDown", "mark":
			kit.add_debuff(str(f.k), float(f.pct), seconds)
		"breakShield":
			kit.shields.clear()
		"pull":
			player.dash(from, float(f.dist))

## Experience, coins and loot of a defeated monster (rules and drop chances of the browser game).
func reward(def: Dictionary, at: Vector2) -> void:
	if is_quest_land():
		quests.defeated(str(def.id))
	var xp := int(def.xp)
	var levels := kit.add_xp(xp)
	if levels > 0:
		celebrate_level()
	var gold_range: Array = def.gold
	var gold := randi_range(int(gold_range[0]), int(gold_range[1])) if int(gold_range[1]) > 0 else 0
	economy.gold += gold
	if gold > 0:
		audio.sfx("common/gold")
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
	if not names.is_empty():
		audio.sfx("common/loot")
	economy.changed.emit()
	var text := "+%d XP" % xp if xp > 0 else ""
	if gold > 0:
		text += (" · " if text != "" else "") + "+%d mon." % gold
	if not names.is_empty():
		text += (" · " if text != "" else "") + ", ".join(names)
	hud.toast(text if text != "" else "Nic z tego nie ma.")
	if xp > 0:
		PyraFx.number(monster_parent(), at + Vector2(0, -60), xp, true, "xp")

func handle_death(delta: float) -> void:
	if kit.dead and respawn_timer < 0.0:
		respawn_timer = 3.0
		player.locked = true
		hud.touch.reset()
		attack_held = false
		if is_instance_valid(monsters):
			monsters.disengage_all()
		hud.toast("Poległeś. Za 3 s wrócisz do miasta.")
		audio.sfx("common/player-death")
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
	audio.sfx("common/respawn")

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
		story.note("attack")
		var now_s := Time.get_ticks_msec() / 1000.0
		combo_count = 1 if now_s - combo_at > 1.6 else combo_count + 1
		combo_at = now_s
		var clip := combo_clip(combo_count)
		if clip == "finisher":
			add_shake(3.5)
		player.visual.play_once(clip)

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
		story.note("skill")
		player.visual.play_once(str(result.get("clip", "skill")))
	elif str(result.reason) != "":
		hud.toast(str(result.reason))
		audio.sfx("common/no-energy")

func use_potion() -> void:
	if economy.use("potion"):
		audio.sfx("common/potion")

const CAVE_KIND_TEXT := {"transit": "Tunel między kontynentami: wychodzisz na drugim końcu.", "chambers": "Jaskinia o dwóch piętrach, skarbiec na dnie.", "maze": "Wielki Labirynt: trzy piętra i strażnik na dnie."}

## The underground behind an entrance, always the same one for the same entrance; keys, gates, chests and secrets are saved per floor.
func make_dungeon(entrance: Dictionary, floor: int) -> PyraDungeon:
	var kinds: Array = []
	for kind: String in monsters.kinds:
		if monster_data.monsters.has(kind) and not bool(monster_data.monsters[kind].get("minion", false)):
			kinds.append(kind)
	kinds.sort_custom(func(a: String, b: String) -> bool: return int(monster_data.monsters[a].level) < int(monster_data.monsters[b].level))
	var info := entrance.duplicate()
	var top_level := int(monster_data.monsters[kinds[kinds.size() - 1]].level) if not kinds.is_empty() else 1
	info["tier"] = int(top_level / 3) + (1 if str(entrance.kind) == "maze" else 0)
	# a tunnel is one structure with two entrances: both share its progress
	var key := str(entrance.instanceId) if str(entrance.id).contains("transit") else str(entrance.id)
	if not dungeon_state.has(key):
		dungeon_state[key] = {"keys": [], "gates": [], "chests": [], "secrets": []}
	var explored_key := "%s#%d#%s" % [key, floor, str(entrance.get("side", "a"))]
	if not dungeon_explored.has(explored_key):
		dungeon_explored[explored_key] = {}
	var built := PyraDungeon.new()
	built.setup(info, land_id, world_id, kinds, dungeon_state[key], floor, dungeon_explored[explored_key])
	return built

func level_of_kind(kind: String) -> int:
	return int(monster_data.monsters[kind].level)

## At the entrance: the name, the story, the kind of place and the recommended level, then the choice to go in.
func offer_dungeon(entrance: Dictionary) -> void:
	var preview := make_dungeon(entrance, 0)
	var levels := preview.recommended_levels(level_of_kind)
	var text := "%s\n\n%s\nZalecany poziom: %d–%d (Twój: %d)." % [str(entrance.get("blurb", "")), str(CAVE_KIND_TEXT[preview.role]), levels.x, levels.y, kit.level]
	if kit.level + 2 < levels.x:
		text += "\nUwaga: potwory w środku są wyraźnie silniejsze od Ciebie."
	hud.show_dialog(str(entrance.get("name", "Jaskinia")), text, [
		{"text": "WEJDŹ", "callback": func() -> void:
			hud.close_dialog()
			enter_dungeon(entrance)},
		{"text": "ZOSTAŃ NA POWIERZCHNI", "callback": func() -> void: hud.close_dialog()}])

func enter_dungeon(entrance: Dictionary, floor: int = 0, at: Vector2 = Vector2(-1, -1)) -> void:
	if floor == 0:
		city_return = open_ground(Vector2(float(entrance.x), float(entrance.y)) + Vector2(0, 110))
	dungeon = make_dungeon(entrance, floor)
	story.milestone("cave")
	audio.sfx("common/door")
	load_space("dungeon", dungeon.arrival() if at.x < 0.0 else at)
	if floor == 0:
		hud.toast(dungeon.cave_name)
	else:
		hud.toast("Piętro %d z %d" % [floor + 1, dungeon.floors_total])

## Stairs: one floor down (+1) or up (-1); the other floor is built from the same entrance, so it is always the same one.
func change_floor(delta: int) -> void:
	if dungeon == null:
		return
	var entrance := dungeon.info
	var next_floor := dungeon.floor_index + delta
	if next_floor < 0:
		return
	dungeon.cleanup()
	var target := make_dungeon(entrance, next_floor)
	dungeon = target
	var at := target.arrival()
	if delta < 0 and target.stairs_cell.x >= 0:
		at = target.center(target.stairs_cell) + Vector2(0, 100)
	audio.sfx("common/door")
	load_space("dungeon", at)
	hud.toast("Piętro %d z %d" % [next_floor + 1, target.floors_total])

## The far end of a tunnel: out on the other continent, at its entrance.
func use_transit() -> void:
	if dungeon == null or dungeon.partner_land == "":
		return
	var partner := dungeon.partner_land
	var partner_id := str(dungeon.info.get("partnerId", ""))
	if not await ensure_land_content(partner):
		return
	var out_at := Vector2.ZERO
	for entrance: Dictionary in (dungeon_data.lands as Dictionary).get(partner, []):
		if str(entrance.id) == partner_id:
			out_at = Vector2(float(entrance.x), float(entrance.y)) + Vector2(0, 110)
	enter_land(partner)
	var exit_at := open_ground(out_at)
	player.position = exit_at
	city_return = exit_at
	continent.update_view(camera_view(), true)
	hud.toast("Wyszedłeś na drugim końcu tunelu: %s." % str(land.name))
	audio.sfx("common/door")

func leave_dungeon_state() -> void:
	if dungeon != null:
		dungeon.cleanup()
		dungeon = null
	if is_instance_valid(hud):
		hud.set_cave(null)
	if is_instance_valid(monsters):
		monsters.clear_all()

## The day: 480 s, evening from 270 s, night from 300 s to 450 s, dawn until 480 s.
func is_night() -> bool:
	return fmod(world_time, 480.0) >= 300.0

func night_factor() -> float:
	var t := fmod(world_time, 480.0)
	if t < 270.0:
		return 0.0
	if t < 300.0:
		return (t - 270.0) / 30.0
	if t < 450.0:
		return 1.0
	return 1.0 - (t - 450.0) / 30.0

func update_day(delta: float) -> void:
	world_time += delta
	var night := night_factor()
	PyraAmbient.night = night if current_room.is_empty() else 0.0
	if in_dungeon():
		day_tint.color = dungeon.ambient()
	elif not current_room.is_empty():
		day_tint.color = Color.WHITE
	else:
		var dusk := clampf(night * 2.0, 0.0, 1.0) * (1.0 - clampf((night - 0.5) * 2.0, 0.0, 1.0))
		var base := Color.WHITE.lerp(Color(0.5, 0.56, 0.84), night * 0.85)
		day_tint.color = base.lerp(Color(1.0, 0.78, 0.62), dusk * 0.5)

## Street NPCs stroll around their post, stop and look at the hero when he comes near, and keep their talk point on themselves.
func update_citizens(delta: float) -> void:
	for c in citizens:
		var actor: PyraActor = c.actor
		if not is_instance_valid(actor):
			continue
		var distance := actor.position.distance_to(player.position)
		if distance > 1500.0:
			continue
		if distance < 150.0:
			actor.animate(Vector2.ZERO)
			actor.face(player.position - actor.position)
			continue
		c.wait = float(c.wait) - delta
		if float(c.wait) > 0.0:
			actor.animate(Vector2.ZERO)
			continue
		var goal: Vector2 = c.goal
		var to_goal := goal - actor.position
		if to_goal.length() < 8.0:
			c.wait = randf_range(2.0, 6.0)
			var pick: Vector2 = (c.home as Vector2) + Vector2.from_angle(randf() * TAU) * randf() * float(c.radius)
			c.goal = pick if continent.walkable(pick) and not in_blocked_spot(pick) else actor.position
			actor.animate(Vector2.ZERO)
			continue
		var next := actor.position + to_goal.normalized() * float(c.speed) * delta
		if continent.walkable(next):
			actor.position = next
			actor.animate(to_goal)
			(c.target as Dictionary)["point"] = next
		else:
			c.goal = actor.position
			actor.animate(Vector2.ZERO)

func in_blocked_spot(_at: Vector2) -> bool:
	return false

## Kharzul's burning arena (phase 3) takes healing away.
func healing_blocked() -> bool:
	if not is_instance_valid(monsters):
		return false
	for m: PyraMonster in monsters.active.values():
		if is_instance_valid(m) and m.boss_script != null and m.boss_script.blocks_healing():
			hud.toast("Płomienie Kharzula blokują leczenie.")
			return true
	return false

## The point of a boss's lair (a famous place of the land) moved to open ground outside every safe city.
func boss_lair(info: Dictionary) -> Vector2:
	var places: Dictionary = quests.data.places[land_id].famous
	var centre := Vector2(float(land.arrival.x), float(land.arrival.y)) + Vector2(900, 0)
	if places.has(str(info.get("associatedLocationId", ""))):
		var spot: Dictionary = places[str(info.associatedLocationId)]
		centre = Vector2(float(spot.x), float(spot.y))
	return open_ground(centre)

func open_ground(centre: Vector2) -> Vector2:
	if continent.walkable(centre) and not in_safe_city(centre):
		return centre
	for ring in range(1, 40):
		var distance := 48.0 * ring
		for step in 16:
			var candidate := centre + Vector2.from_angle(TAU * step / 16.0) * distance
			if candidate.x > 0.0 and candidate.y > 0.0 and continent.walkable(candidate) and not in_safe_city(candidate):
				return candidate
	return centre

## The warden opens the way to a boss's lair: the hero stands at its edge and the boss waits (a boss already alive is reused).
func enter_boss_lair(boss_id: String) -> void:
	var info := monsters.boss_info(boss_id)
	if info.is_empty():
		return
	hud.close_dialog()
	var lair := boss_lair(info)
	var arrive := open_ground(lair + Vector2(-260, 120))
	if not current_room.is_empty():
		load_space("", arrive)
	else:
		player.position = arrive
	continent.update_view(camera_view(), true)
	var boss := monsters.spawn_boss(boss_id, open_ground(lair))
	if boss == null:
		return
	boss.home = lair
	hud.toast("%s: %s czeka na walkę!" % [info.locationName, info.name])
	audio.sfx("common/door")

## Reward of a boss: the experience already came with the kill; the loot table rolls here and goes to the bag.
func boss_defeated(info: Dictionary, at: Vector2) -> void:
	story.milestone("boss")
	celebrate("ZWYCIĘSTWO", 12.0)
	var names: Array[String] = []
	for drop: Dictionary in info.lootTable:
		if randf() * 100.0 >= float(drop.chancePercent):
			continue
		var quantity := int(drop.minCount) + randi() % (int(drop.maxCount) - int(drop.minCount) + 1)
		if economy.add_item(str(drop.itemId), quantity):
			names.append("%s ×%d" % [drop.itemName, quantity])
		else:
			names.append("%s ×%d (plecak pełny — porzucone)" % [drop.itemName, quantity])
	hud.toast("%s pokonany! Łup: %s" % [info.name, ", ".join(names) if not names.is_empty() else "brak"])
	audio.sfx("common/quest-complete")

func dodge() -> void:
	if player.locked or input_suspended:
		return
	var direction := player.touch_motion if player.touch_motion.length() > 0.1 else player.facing
	var result := kit.dodge(direction)
	if result.ok:
		dodge_at = Time.get_ticks_msec() / 1000.0
		story.note("dodge")
		player.visual.play_once("dodge")
		audio.sfx("common/dodge")

# ---- combat feel ----------------------------------------------------------------------------

## The chain of basic strikes: attack, attack2, finisher, and again.
static func combo_clip(strike: int) -> String:
	return ["attack", "attack2", "finisher"][posmod(strike - 1, 3)]

func add_shake(amount: float) -> void:
	shake = maxf(shake, amount)

## A very short freeze on a heavy blow; the clock is restored by a timer that ignores the slowed time.
func hit_stop(seconds: float) -> void:
	if hit_stopping or not is_inside_tree():
		return
	hit_stopping = true
	Engine.time_scale = 0.08
	await get_tree().create_timer(seconds, true, false, true).timeout
	Engine.time_scale = 1.0
	hit_stopping = false

## A hit that lands in the first moments of a dodge: the world slows for an instant and the hero regains some ki.
func check_perfect_dodge() -> void:
	var now_s := Time.get_ticks_msec() / 1000.0
	if now_s > perfect_until and now_s - dodge_at <= 0.2:
		perfect_until = now_s + 1.2
		perfect_dodges += 1
		kit.ki = minf(float(kit.stats().maxKi), kit.ki + float(kit.stats().maxKi) * 0.12)
		PyraFx.word(monster_parent(), player.position + Vector2(0, -60), "IDEALNY UNIK", Color("9fe8ff"), 30, true)
		audio.sfx("ui/quest-update")
		slow_motion(0.4, 0.35)

func slow_motion(scale: float, seconds: float) -> void:
	if hit_stopping or not is_inside_tree():
		return
	hit_stopping = true
	Engine.time_scale = scale
	await get_tree().create_timer(seconds, true, false, true).timeout
	Engine.time_scale = 1.0
	hit_stopping = false

## The hero's victory pose with a word over their head.
func celebrate(word: String, shake_amount: float = 0.0) -> void:
	player.visual.play_once("victory")
	PyraFx.word(monster_parent(), player.position + Vector2(0, -40), word, Color("ffe08a"), 34, true)
	if shake_amount > 0.0:
		add_shake(shake_amount)

func celebrate_level() -> void:
	audio.sfx("ui/quest-update")
	celebrate("POZIOM %d!" % kit.level)
	hud.toast("Awans! Poziom %d. Masz nowe punkty w drzewku zdolności." % kit.level)

## The ground ring under the foe being fought and the camera shake, once per frame.
func update_feel(delta: float) -> void:
	shake = move_toward(shake, 0.0, delta * 30.0)
	camera.offset = Vector2(randf_range(-1.0, 1.0), randf_range(-1.0, 1.0)) * shake if shake > 0.05 else Vector2.ZERO
	var ring_parent := monster_parent()
	if not is_instance_valid(ring_parent):
		return
	if not is_instance_valid(target_ring):
		target_ring = PyraTargetRing.new()
	if target_ring.get_parent() != ring_parent:
		if target_ring.get_parent() != null:
			target_ring.get_parent().remove_child(target_ring)
		ring_parent.add_child(target_ring)
	var foe: Node2D = nearest_foe()
	var engaged: bool = foe != null and foe.get("phase") != null and str(foe.get("phase")) != "idle" and str(foe.get("phase")) != "dead"
	if engaged:
		var boss: bool = foe.get("boss") != null and not (foe.get("boss") as Dictionary).is_empty()
		target_ring.aim((foe as Node2D).position, 78.0 if boss else 46.0, boss)
	else:
		target_ring.clear()

func in_dungeon_hazard(target: Dictionary) -> bool:
	return str(target.get("kind", "")) == "dsecret"

func _exit_tree() -> void:
	if gm_tools != null:
		gm_tools.dispose()
	Engine.time_scale = 1.0

func on_effect(kind: String, at: Vector2, radius: float, ability: String) -> void:
	audio.ability(race, ability)
	var parent: Node = room_sorted if not current_room.is_empty() else continent.sorted
	PyraFx.spawn(parent, kind, at, radius, ability, player.facing)

func on_damage(foe: Node, amount: int, crit: bool) -> void:
	if amount > 0:
		audio.hit(crit)
	var parent: Node = room_sorted if not current_room.is_empty() else continent.sorted
	var kind := str(foe.get("last_kind")) if foe.get("last_kind") != null else ""
	var style := "crit" if crit else kind
	if amount > 0:
		var toward: Vector2 = ((foe as Node2D).position - player.position)
		PyraFx.spawn(parent, "hit", (foe as Node2D).position, 100.0 if crit else (36.0 if kind == "resist" else 60.0), "weak" if kind == "weak" else ("resist" if kind == "resist" else ""), toward)
	PyraFx.number(parent, (foe as Node2D).position, amount, crit, style)
	if kind == "weak" and amount > 0:
		PyraFx.word(parent, (foe as Node2D).position + Vector2(0, 34), "SŁABOŚĆ", Color("ffb347"), 18)
	if crit:
		add_shake(5.0)
		hit_stop(0.05)
	elif kind == "weak":
		add_shake(3.0)

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
	if story.tutorial_active() and player.moving and not player.locked:
		walk_time += delta
		if walk_time > 1.5:
			story.note("move")

func _process(delta: float) -> void:
	if not is_instance_valid(hud) or not is_instance_valid(player):
		return
	if gm_tools != null:
		gm_tools.tick(delta)
	simulate(minf(delta, 0.05))
	update_feel(delta)
	fed_clock += delta
	if fed_clock >= 1.0:
		fed_clock = 0.0
		var fed_now := kit.fed_left() > 0.0
		if fed_now or fed_shown:
			fed_shown = fed_now
			refresh_quest_ui()
	quest_tick(delta)
	update_day(delta)
	autosave_clock += delta
	if autosave_clock >= 90.0:
		autosave_clock = 0.0
		if KiNet.online().logged_in() and not kit.dead and not player.locked:
			save_checkpoint(SAVE_PATH, true)
	if current_room.is_empty():
		update_citizens(minf(delta, 0.1))
	var terrain := continent.terrain_kind(player.position) if current_room.is_empty() else "open"
	audio.step(delta, player.moving and not player.locked, world_id, terrain, not current_room.is_empty())
	ambience_timer -= delta
	if ambience_timer <= 0.0:
		ambience_timer = 0.6
		audio.play_ambience(world_id, in_safe_city(player.position))
	prefetch_timer -= delta
	if prefetch_timer <= 0.0:
		prefetch_timer = 0.4
		prefetch_rooms()
		if story.tutorial_active() and story.steps.has("move") and current_room.is_empty() and not in_dungeon() and not in_safe_city(player.position):
			story.note("gate")
	var target := nearest_target()
	hud.touch.enabled_target = not target.is_empty()
	hud.touch.action_text = "E"
	hud.hint.text = ("E · " + str(target.get("title", target.name))) if not target.is_empty() else ""
	if in_dungeon():
		hud.place.text = dungeon.depth_text()
	elif current_room.is_empty():
		hud.place.text = region_name() + (" · noc" if is_night() else "")
		var view := camera_view()
		markers.view = view
		if player.position.distance_to(stream_center) > 420.0:
			stream_center = player.position
			continent.update_view(view)
	elif not in_dungeon():
		var dummy := nearest_dummy()
		hud.meter.text = ("Manekin: %d obrażeń/s · %d łącznie" % [int(dummy.recent_dps), int(dummy.total_taken)]) if dummy != null else ""
	if current_room.is_empty() or in_dungeon():
		hud.meter.text = ""
		var foe_out := nearest_foe()
		hud.set_target({"name": foe_out.label if foe_out.boss.is_empty() else "%s · faza %d" % [foe_out.label, foe_out.boss_phase], "hp": foe_out.hp, "max": foe_out.max_hp, "level": int(foe_out.def.level)} if foe_out != null and foe_out.phase != "idle" else {})
		if current_room.is_empty():
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
				use_potion()
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
	elif what == NOTIFICATION_APPLICATION_PAUSED and is_instance_valid(hud) and is_instance_valid(player) and not kit.dead:
		save_checkpoint(SAVE_PATH, true)   # the app is going to the background: keep the progress (and send it to the cloud)
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
	if gm_tools != null:
		gm_tools.cancel_pending()
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
	story.note("map")
	var view := MapScreen.new()
	var cave_names: Dictionary = {}
	for entrance: Dictionary in (dungeon_data.lands as Dictionary).get(land_id, []):
		cave_names[str(entrance.id)] = str(entrance.name)
	view.setup(map_data, land, player.position if current_room.is_empty() else city_return, region_name(), cave_names)
	view.travel.connect(travel_to)
	open_screen(view)

func sync_staff_access() -> void:
	hud.set_staff_access(KiNet.online().is_staff())

func open_gm() -> void:
	if is_instance_valid(screen) or input_suspended:
		return
	if not KiNet.online().is_staff():
		hud.toast("Panel GM wymaga konta GM lub administratora.")
		return
	var view := GmPanel.new()
	view.setup(KiNet.online(), self, gm_tools)
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
	if not await ensure_land_content(str(HOME_OF_RACE[new_race])):
		return
	if not current_room.is_empty():
		load_space("", city_return)
	quests.reset()
	story.reset()
	dungeon_state = {}
	world_events.from_save({})
	economy.gold = 20
	economy.upgrades = {}
	economy.bag = {"potion": 3}
	economy.depot = {}
	economy.depot_gold = 0
	for slot in PyraEconomy.SLOTS:
		economy.equipment[slot] = ""
	set_race(new_race)
	enter_land(str(HOME_OF_RACE[new_race]))
	hud.refresh(kit)
	hud.toast("Witaj w %s!" % str(land.name))
	play_intro.call_deferred()

## The story of the race and the first steps: shown once after a new character is made.
func play_intro() -> void:
	var waited := 0
	while (is_instance_valid(screen) or input_suspended) and waited < 120:
		await get_tree().process_frame
		waited += 1
	if skip_intro or story.intro_seen or is_instance_valid(screen):
		return
	var tale := PyraStory.intro(race)
	var view := PyraStoryScreen.new()
	view.setup(str(tale.title), tale.pages)
	open_screen(view)
	await view.closed
	story.intro_seen = true
	story.changed.emit()
	hud.toast("Pierwsze kroki: cele widzisz pod mapką.")
	save_checkpoint(SAVE_PATH, true)

func on_story_changed() -> void:
	refresh_quest_ui()
	if story.claim_reward():
		economy.gold += PyraStory.REWARD_GOLD
		economy.changed.emit()
		audio.sfx("common/quest-complete")
		hud.toast("Pierwsze kroki ukończone! Nagroda: %d monet." % PyraStory.REWARD_GOLD)

## What the resident can say about the hero's deeds right now (see PyraStory.reaction).
func reaction_flags() -> Dictionary:
	var top := float(kit.stats().maxHp)
	return {
		"hurt": kit.hp < top * 0.4,
		"boss": story.milestones.has("boss"),
		"cave": story.milestones.has("cave"),
		"secret": story.milestones.has("secret"),
		"level20": kit.level >= 20,
		"level10": kit.level >= 10,
		"rich": economy.gold >= 1500,
		"night": is_night(),
		"novice": kit.level <= 3,
	}

## The list of subjects a resident talks about; each one is read in a dialog with a way back.
func open_topics(npc_name: String, role: String) -> void:
	var list := PyraStory.topics(world_id, role)
	var actions: Array = []
	for topic: Dictionary in list:
		var entry := topic
		var mark := "(znane) " if story.heard(str(entry.id)) else ""
		actions.append({"text": mark + str(entry.label), "callback": func() -> void:
			story.hear(str(entry.id))
			hud.show_dialog(npc_name + " · " + str(entry.label), str(entry.text), [{"text": "WRÓĆ DO ROZMOWY", "callback": func() -> void: open_topics(npc_name, role)}])})
	hud.show_dialog(npc_name, "O czym chcesz porozmawiać? (%d z %d tematów już znasz)" % [_heard_among(list), list.size()], actions)

func _heard_among(list: Array[Dictionary]) -> int:
	var n := 0
	for topic: Dictionary in list:
		if story.heard(str(topic.id)):
			n += 1
	return n

## Makes sure the data of a land is on the device (downloads it with a progress screen when it is not). False = could not.
func ensure_land_content(id: String) -> bool:
	if KiNet.content().missing_for(id).is_empty():
		return true
	var gate := PyraGate.new()
	ui.add_child(gate)
	player.locked = true
	hud.touch.reset()
	var ok := await gate.download_land(id)
	if not ok:
		gate.say("Pobieranie", "Nie udało się pobrać danych krainy. Sprawdź połączenie i spróbuj ponownie.", gate.detail.text)
		await gate.offer(["ZAMKNIJ"])
	gate.queue_free()
	player.locked = false
	return ok

func travel_to(id: String) -> void:
	if not (id in ALL_LANDS) or id == land_id:
		return
	close_screen()
	if not await ensure_land_content(id):
		return
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
	if mode == "shop" or mode == "smithy":
		story.note("shop")
	economy.level = kit.level
	var view := ItemsScreen.new()
	view.setup(economy, mode, heading)
	open_screen(view)

func show_menu() -> void:
	if is_instance_valid(screen):
		return
	var items: Array[Dictionary] = [
		{"id":"save","text":"ZAPISZ GRĘ","callback":func():save_checkpoint();close_screen()},
		{"id":"map","text":"MAPA ŚWIATA","callback":func():close_screen();open_map()},
		{"id":"character","text":"POSTAĆ I DRZEWKO","callback":func():close_screen();open_character()},
		{"id":"inventory","text":"PLECAK","callback":func():close_screen();open_items("inventory","Plecak i wyposażenie")},
		{"id":"quests","text":"DZIENNIK ZADAŃ","callback":func():close_screen();show_journal()},
		{"id":"gm","text":"NARZĘDZIA GM","staff":true,"callback":func():close_screen();open_gm()},
		{"id":"music","text":"MUZYKA: %d%%" % roundi(audio.music_volume*100),"callback":func():audio.set_volumes(next_volume(audio.music_volume),audio.sfx_volume);close_screen();show_menu()},
		{"id":"sounds","text":"EFEKTY: %d%%" % roundi(audio.sfx_volume*100),"callback":func():audio.set_volumes(audio.music_volume,next_volume(audio.sfx_volume));close_screen();show_menu()},
		{"id":"chat","text":"CZAT OKOLICY","callback":func():close_screen();open_chat()},
		{"id":"new","text":"NOWA POSTAĆ","callback":func():close_screen();open_race_screen(true)},
		{"id":"import","text":"POSTAĆ Z PRZEGLĄDARKI","callback":func():close_screen();BrowserImport.run(self)},
		{"id":"download","text":"POBIERZ KRAINY","callback":func():close_screen();download_everything()},
		{"id":"fps","text":"FPS: "+("WŁ." if hud.show_fps else "WYŁ."),"callback":func():hud.show_fps=not hud.show_fps;hud.signature="";close_screen();show_menu()},
		{"id":"account","text":"WYLOGUJ: "+KiNet.online().nick.left(14) if KiNet.online().logged_in() else "KONTO: TRYB OFFLINE","callback":func():close_screen();if KiNet.online().logged_in():await KiNet.online().logout();hud.toast("Wylogowano. Zalogujesz się ponownie po restarcie aplikacji.")},
		{"id":"licenses","text":"LICENCJE","callback":func():close_screen();show_licenses()},
	]
	var view := GameMenu.new()
	view.setup(items,KiNet.online())
	open_screen(view)

func show_licenses() -> void:
	hud.show_dialog("Godot i biblioteki silnika", Engine.get_license_text() + "\n\nTHIRD-PARTY LICENSES\n" + JSON.stringify(Engine.get_license_info(), "\t") + "\n\nCOPYRIGHT NOTICES\n" + JSON.stringify(Engine.get_copyright_info(), "\t") + "\n\nFONT CINZEL\n" + FileAccess.get_file_as_string("res://assets/branding/OFL-Cinzel.txt") + "\n\nOFFICIAL GODOT LOGO\n" + FileAccess.get_file_as_string("res://assets/branding/GODOT-LOGO-NOTICE.txt") + "\n" + FileAccess.get_file_as_string("res://assets/branding/GODOT-LOGO-LICENSE.txt"))

# ---- save ------------------------------------------------------------------------------------

func save_checkpoint(path: String = SAVE_PATH, quiet: bool = false) -> bool:
	if checkpoint_protected or (not in_dungeon() and not can_stand(player.position, current_room)):
		if not quiet:
			hud.toast("Nie zapisano punktu; istniejący plik pozostaje zachowany.")
		return false
	var in_cave := in_dungeon()
	var save_room := "" if in_cave else current_room
	var save_at := city_return if in_cave else player.position
	var value := {"format": SAVE_FORMAT, "version": 2, "race": race, "land": land_id, "room": save_room, "town": room_town, "position": [save_at.x, save_at.y], "cityReturn": [city_return.x, city_return.y], "kit": kit.to_save(), "economy": economy.to_save(), "quests": quests.to_save(), "story": story.to_save(), "dungeons": dungeon_state, "events": world_events.to_save()}
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value))
	file.close()
	var result := DirAccess.rename_absolute(ProjectSettings.globalize_path(path + ".tmp"), ProjectSettings.globalize_path(path)) == OK
	if not quiet:
		hud.toast("Zapisano pozycję i postać." if result else "Nie zapisano punktu próby.")
	if result and path == SAVE_PATH and KiNet.online().logged_in():
		push_cloud(not quiet)
	return result

## Sends the local save to the account's cloud slot. A newer save from another device raises the conflict dialog.
func push_cloud(announce: bool = false) -> void:
	if cloud_pushing or cloud_dialog_open or not FileAccess.file_exists(SAVE_PATH):
		return
	var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if not value is Dictionary:
		return
	cloud_pushing = true
	var outcome := await KiNet.online().cloud_push(value, -1, KiNet.content().version())
	cloud_pushing = false
	if bool(outcome.ok):
		if announce:
			hud.toast("Zapisano w chmurze (wersja %d)." % int(outcome.revision))
	elif bool(outcome.get("conflict", false)):
		show_cloud_conflict(int(outcome.serverRevision))
	elif announce:
		hud.toast(str(outcome.get("message", "Nie zapisano w chmurze.")))

func show_cloud_conflict(server_revision: int) -> void:
	cloud_dialog_open = true
	hud.show_dialog("Zapis w chmurze", "Na koncie jest zapis z innego urządzenia lub nowszy niż ten, od którego zacząłeś. Który ma obowiązywać?", [
		{"text": "NADPISZ CHMURĘ TYM URZĄDZENIEM", "callback": func() -> void:
			cloud_dialog_open = false
			KiNet.online().cloud_revision = server_revision
			KiNet.online().store_cloud_state()
			hud.close_dialog()
			push_cloud(true)},
		{"text": "POBIERZ ZAPIS Z CHMURY", "callback": func() -> void:
			hud.close_dialog()
			var pulled := await KiNet.online().cloud_pull()
			cloud_dialog_open = false
			if bool(pulled.ok) and not await ensure_land_content(str((pulled.save as Dictionary).get("land", "pyra"))):
				hud.toast("Brak danych krainy z zapisu.")
			elif bool(pulled.ok):
				var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
				if file != null:
					file.store_string(JSON.stringify(pulled.save))
					file.close()
				restore_checkpoint()
			else:
				hud.toast("Nie udało się pobrać zapisu z chmury.")},
		{"text": "DECYDUJĘ PÓŹNIEJ", "callback": func() -> void:
			cloud_dialog_open = false
			hud.close_dialog()}])

## What the server is told about the hero (place only; nothing here is authoritative).
func live_payload() -> Dictionary:
	var at: Vector2 = player.position if current_room.is_empty() else city_return
	var facing_index := posmod(int(round(player.facing.angle() / (TAU / 8.0))), 8)
	return {"race": race, "land": land_id, "level": kit.level, "x": at.x, "y": at.y, "facing": facing_index}

func on_peers(list: Array) -> void:
	if is_instance_valid(remote):
		remote.set_peers(list)

func on_chat(nick: String, text: String) -> void:
	chat_log.append("%s: %s" % [nick, text])
	if chat_log.size() > 40:
		chat_log.pop_front()
	if is_instance_valid(chat_panel):
		chat_panel.add_line(nick, text)
	else:
		hud.toast("%s: %s" % [nick, text])

func open_chat() -> void:
	if is_instance_valid(chat_panel) or not KiNet.online().logged_in():
		hud.toast("Czat działa po zalogowaniu.")
		return
	chat_panel = PyraChat.new()
	chat_panel.lines = chat_log.duplicate()
	ui.add_child(chat_panel)

## Downloads the content of every land (for playing without a connection later).
func download_everything() -> void:
	if PyraContent.embedded():
		hud.toast("Ta wersja ma już całą zawartość.")
		return
	if not KiNet.content().has_manifest():
		hud.toast("Brak informacji o treści. Połącz się z internetem.")
		return
	var gate := PyraGate.new()
	ui.add_child(gate)
	player.locked = true
	var all := {}
	for id: String in ALL_LANDS:
		for pack: String in KiNet.content().packs_for_land(id):
			all[pack] = true
	var need := KiNet.content().bytes_to_download(all.keys())
	if need == 0:
		gate.say("Pobieranie", "Wszystkie krainy są już na urządzeniu.")
		await gate.offer(["ZAMKNIJ"])
	else:
		gate.say("Pobieranie świata", "Pobieram wszystkie krainy: %s." % gate.megabytes(need))
		gate.bar.visible = true
		var handler := func(info: Dictionary) -> void:
			gate.bar.max_value = maxf(1.0, float(info.total))
			gate.bar.value = float(info.done)
			gate.detail.text = "%s · %s z %s" % [str(info.pack), gate.megabytes(int(info.done)), gate.megabytes(int(info.total))]
		KiNet.content().progress.connect(handler)
		var result := await KiNet.content().ensure(all.keys())
		KiNet.content().progress.disconnect(handler)
		gate.bar.visible = false
		gate.say("Pobieranie", "Gotowe." if bool(result.ok) else str(result.get("message", "Nie udało się.")))
		await gate.offer(["ZAMKNIJ"])
	gate.queue_free()
	player.locked = false

func start_online() -> void:
	if not KiNet.online().logged_in():
		return
	remote = PyraRemotePlayers.new()
	remote.setup(self)
	add_child(remote)
	KiNet.online().peers_changed.connect(on_peers)
	KiNet.online().chat_received.connect(on_chat)
	KiNet.online().start_live(live_payload)

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
		var saved_quests = value.get("quests", null)
		if saved_quests is Dictionary and quests.from_save(saved_quests):
			pass
		else:
			quests.reset()
		dungeon_state = valid_dungeon_state(value.get("dungeons", {}))
		world_events.from_save(value.get("events", {}))
		story.from_save(value.get("story", null))
		refresh_quest_ui()
	city_return = back
	load_space(room, at, str(value.get("town", "")))
	return true

## Saved cave progress: {id: {keys, gates, chests}} of unique strings; anything else is dropped (the caves start fresh).
static func valid_dungeon_state(value: Variant) -> Dictionary:
	var clean: Dictionary = {}
	if not value is Dictionary:
		return clean
	for key in (value as Dictionary).keys():
		var entry: Variant = value[key]
		if not key is String or not entry is Dictionary:
			continue
		var kept: Dictionary = {}
		for field in ["keys", "gates", "chests", "secrets"]:
			var list: Variant = (entry as Dictionary).get(field, [])
			var strings: Array = []
			if list is Array:
				for item in list:
					if item is String and not strings.has(item):
						strings.append(item)
			kept[field] = strings
		clean[key] = kept
	return clean

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
