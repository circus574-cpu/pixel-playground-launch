extends Node2D
## KI Legends — 2D Isometric World, 4 Continents (1024×1024m), Spline Road Network,
## 24 Exp-Zone Combat Clearings, Vivid Water/Lakes/Oceans/Lava, Rich Painted Architecture,
## Blender Geometry Nodes Fortifications, 40 NPCs, 41 Monsters, 10 Fauna Animals & Real 3D Globe.

const ActorScript := preload("res://scripts/actor_view.gd")
const AmbientScript := preload("res://scripts/ambient_fx.gd")
const Map3DScript := preload("res://scripts/map_3d.gd")
const AtlasOverlayScript := preload("res://scripts/atlas_overlay.gd")
const PremiumMinimapScript := preload("res://scripts/premium_minimap.gd")
const WorldAtmosphereScript := preload("res://scripts/world_atmosphere.gd")
const RpgHudScript := preload("res://scripts/rpg_hud.gd")
const GmPanelScript := preload("res://scripts/gm_panel.gd")
const InteriorRoomScript := preload("res://scripts/interior_room.gd")
const LabyrinthRoomScript := preload("res://scripts/labyrinth_room.gd")
const DialogueStripScript := preload("res://scripts/dialogue_strip.gd")
const LoadingScreenScript := preload("res://scripts/loading_screen.gd")
const QuestJournalScript := preload("res://scripts/quest_journal.gd")
const GameMenuScript := preload("res://scripts/game_menu.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")
const CombatVfxScript := preload("res://scripts/combat_vfx.gd")
const StickScript := preload("res://scripts/stick.gd")
const AudioScript := preload("res://scripts/world_audio.gd")
const MapStyle := preload("res://scripts/map_style.gd")

const ISO_W := 5.6
const ISO_D := 2.8
const ISO_H := 3.8
const STEP := 4
const SPEED := 22.0
const RECALL_CHANNEL_S := 2.5
const RECALL_COOLDOWN_S := 45.0
const SPRITE_SCALE := 0.56
const JOYSTICK_DEADZONE_PX := 14.0
const JOYSTICK_MAX_RADIUS_PX := 62.0
const PROP_CHUNK_PX := 640.0

const REGION_ORDER := ["pyra", "verdant", "aether", "nexus"]
const OCEAN_NEIGHBORS := {
	"verdant": {"east": "aether", "west": "aether", "south": "pyra", "north": "pyra"},
	"aether": {"west": "verdant", "east": "verdant", "south": "nexus", "north": "nexus"},
	"pyra": {"east": "nexus", "west": "nexus", "north": "verdant", "south": "verdant"},
	"nexus": {"west": "pyra", "east": "pyra", "north": "aether", "south": "aether"},
}
const REGION_TITLES := {
	"pyra": "Pyra — Twierdza Popiołu i Wulkaniczny Kontynent",
	"verdant": "Verdantia — Zielona Przystań i Szmaragdowa Dolina",
	"aether": "Aetheria — Lodowe Sanktuarium i Śnieżne Szczyty",
	"nexus": "Nexus-9 — Węzeł Świadomości i Obwody Rdzeni",
}
const HERO_ACTORS := {
	"pyra": ["pyra.hero", "Ignis (Wojownik Pyry)"],
	"verdant": ["verdant.hero", "Sylvan (Strażnik Verdantii)"],
	"aether": ["aether.hero", "Aurelius (Mędrzec Aetherii)"],
	"nexus": ["nexus.hero", "Cypher-9 (Egzekutor Nexusa)"],
}

var current_land := "pyra"
var region_title := "Pyra — Twierdza Popiołu"
var grid_size := 512
var world_size := 4096.0
var safe_city_radius := 250.0
var capital_center := Vector2(2048.0, 2048.0)
var heights := PackedFloat32Array()
var walkable := PackedByteArray()
var surface_img: Image
var sub_biomes: Array = []
var roads: Array = []
var landmarks: Array = []
var buildings: Array = []
var npcs_data: Array = []
var exp_zones: Array = []
var monsters_data: Array = []
var fauna_data: Array = []
var labyrinths_data: Array = []
var treasures_data: Array = []
var gatherables_data: Array = []
var waystones_data: Array = []
var props: Array = []

var actors_db: Dictionary = {}
var monsters_db: Dictionary = {}
var animals_db: Dictionary = {}

var ocean_skirt := MeshInstance2D.new()
var terrain_mesh := Node2D.new()
var terrain_chunks: Array[Dictionary] = []
var _last_sync_scan_ms := -9999
var _last_sync_scan_pos := Vector2(-9999.0, -9999.0)
var ysort := Node2D.new()
var combat_vfx: Node2D
var hero
var live_agents: Array[Dictionary] = []
var prop_nodes: Array[Node2D] = []
var prop_chunks: Dictionary = {}
var _visible_prop_chunks: Dictionary = {}
var wind_shader: Shader
var wind_mats: Array[ShaderMaterial] = []
var treasure_nodes: Dictionary = {}
var opened_treasures: Dictionary = {}
var _treasure_pending := {}
var _gather_pending := {}
var gatherable_nodes: Dictionary = {}
var gatherable_cd: Dictionary = {}
var waystone_nodes: Dictionary = {}
var discovered_waystones: Dictionary = {}
var ground_loot: Array[Dictionary] = []
var last_combat_time := -99.0
var recall_channel := 0.0
var recall_cooldown := 0.0
var _cull_accum := 0.0
var _ocean_cross_cd := 0.0
var camera := Camera2D.new()
var hud := CanvasLayer.new()
var atmosphere: Control
var rpg_hud: Control
var gm_panel: Control
var game_menu: Control
var interior_room: Control
var labyrinth_room: Control
var dialogue_strip: Control
var loading_screen: Control
var quest_journal: Control
var is_booting := false
var btn_enter_bldg := Button.new()
var btn_talk_npc := Button.new()
var btn_open_treasure := Button.new()
var btn_gather := Button.new()
var combat_toast_lbl := Label.new()
var combat_toast_t := 0.0
var premium_minimap: Control
var map_3d: SubViewportContainer
var atlas_overlay: Control
var stick_layer := Control.new()
var shadow_tex: Texture2D

var hero_pos := Vector2(512.0, 512.0)
var target_pos := Vector2(-1.0, -1.0)
var motion := Vector2.ZERO
var map_expanded := false
var atlas_expanded := false
var gm_open := false
var in_interior := false
var in_labyrinth := false
var nearest_treasure: Dictionary = {}
var nearest_gatherable: Dictionary = {}
const RACE_TO_LAND := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}
var start_race := ""
var hero_race_land := ""
var start_land := "pyra"
var start_level := 0
var start_gold := -1
var start_name := ""
var server_char_id := ""
var server_character: Dictionary = {}
const POSITION_LAYOUT := "superior-isometric-v1"
const LOOT_PICKUP_RADIUS := 16.0
var _position_sent := {}
var _position_pending := false
var _region_load_id := 0

var server_action_fn: Callable = Callable()
var gm_access_fn: Callable = Callable()
var _had_gm_access := false
var _gm_ki_preview := false
var server_ping_fn: Callable = Callable()
var last_ping_ms := -1
var _ping_poll_t := 0.0
var _ping_in_flight := false
var initial_music_vol := 0.45
var initial_ambience_vol := 0.55
var initial_sfx_vol := 0.80
var initial_hud_layout: Dictionary = {}
var audio_settings_fn: Callable = Callable()
var hud_layout_changed_fn: Callable = Callable()
var return_to_char_select_fn: Callable = Callable()
var logout_fn: Callable = Callable()
var quit_game_fn: Callable = Callable()
var combo_step := 0
var combo_reset_t := 0.0
var ki_mode_timer := 0.0
var audio: Node
var nearest_enterable: Dictionary = {}
var nearest_npc_agent: Dictionary = {}
var active_talk_agent: Dictionary = {}
var gm_speed_mult := 1.0
var gm_noclip := false
var gm_map_teleport_mode := false
var gm_minimap_teleport := false
var zoom_level := 1.15
var move_pointer := -1
var move_origin := Vector2.ZERO
var pinch_pointers: Dictionary = {}
var pinch_distance := 0.0
var tex_cache: Dictionary = {}
var current_exp_idx := 0
var world_time := 0.0
var camera_shake_t := 0.0
var camera_shake_dur := 0.01
var camera_shake_amp := 0.0

func trigger_camera_shake(amp: float, dur: float) -> void:
	if amp >= camera_shake_amp or camera_shake_t <= 0.0:
		camera_shake_amp = amp
		camera_shake_dur = maxf(dur, 0.05)
		camera_shake_t = camera_shake_dur

func _stop_lingering_loading_audio() -> void:
	var root := get_tree().root if get_tree() != null else null
	if root == null:
		return
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var nd: Node = stack.pop_back()
		if nd is AudioStreamPlayer and (audio == null or not audio.is_ours(nd)):
			var ap := nd as AudioStreamPlayer
			if ap.playing:
				ap.stop()
		for ch in nd.get_children():
			stack.append(ch)

func _ready() -> void:
	audio = AudioScript.new()
	add_child(audio)
	audio.set_volumes(initial_music_vol, initial_sfx_vol, initial_ambience_vol)
	shadow_tex = make_shadow_tex()
	wind_shader = load("res://shaders/wind_sway.gdshader")
	if wind_shader != null:
		for wi in 6:
			var wm := ShaderMaterial.new()
			wm.shader = wind_shader
			wm.set_shader_parameter("sway_speed", 1.35 + float(wi % 3) * 0.24)
			wm.set_shader_parameter("sway_amount", 0.015 + float(wi % 2) * 0.005)
			wm.set_shader_parameter("phase_offset", float(wi) * 1.15)
			wind_mats.append(wm)
	ocean_skirt.z_index = -15
	add_child(ocean_skirt)
	terrain_mesh.z_index = -10
	add_child(terrain_mesh)
	ysort.y_sort_enabled = true
	ysort.z_index = 0
	add_child(ysort)
	combat_vfx = CombatVfxScript.new()
	add_child(combat_vfx)

	camera.enabled = true
	camera.zoom = Vector2(zoom_level, zoom_level)
	add_child(camera)

	add_child(hud)
	loading_screen = LoadingScreenScript.new()
	loading_screen.world = self
	loading_screen.z_index = 200
	hud.add_child(loading_screen)

	var is_qa := ("--qa" in OS.get_cmdline_user_args() or "--qa" in OS.get_cmdline_args())
	if is_qa:
		load_databases()
		build_hud()
		switch_region("pyra")
		call_deferred("_stop_lingering_loading_audio")
		call_deferred("run_qa")
	else:
		is_booting = true
		loading_screen.show_loading("Wczytywanie bazy ras, potworów, zwierząt i 40 NPC…", 0.14, "KI Legends • Planeta Superior")
		audio.play_music("loading")
		call_deferred("_boot_world_async")

func _boot_world_async() -> void:
	await get_tree().process_frame
	load_databases()
	loading_screen.set_stage(0.38, "Budowanie interfejsu HUD, minimapy i Globusa 3D…", "4 kontynenty • 24 malowane wnętrza budynków")
	await get_tree().process_frame
	await get_tree().process_frame
	build_hud()
	var load_title := str(REGION_TITLES.get(start_land, REGION_TITLES["pyra"]))
	loading_screen.set_stage(0.68, "Generowanie terenu, sieci dróg, kamieni szlaku i budynków…", "Kontynent: %s" % load_title)
	await get_tree().process_frame
	await get_tree().process_frame
	hero_race_land = str(RACE_TO_LAND.get(start_race, start_land)) if start_race != "" else start_land
	if rpg_hud != null and rpg_hud.has_method("set_hero_land"):
		rpg_hud.set_hero_land(hero_race_land)
	switch_region(start_land)
	if not server_character.is_empty():
		apply_server_character(server_character)
		restore_server_position()
	elif rpg_hud != null:
		if start_name != "":
			rpg_hud.hero_custom_name = start_name
		if start_level > 0:
			rpg_hud.hero_level = start_level
			rpg_hud.recalc_stats(false)
		if start_gold >= 0:
			rpg_hud.hero_gold = start_gold
	loading_screen.set_stage(0.92, "Kalibracja kamery, dialogów NPC i obiektów świata…", "Synchronizacja gotowa")
	call_deferred("_stop_lingering_loading_audio")
	await get_tree().process_frame
	await get_tree().process_frame
	is_booting = false
	loading_screen.finish_loading()

func _exit_tree() -> void:
	tex_cache.clear()
	ActorScript.sheet_cache.clear()
	AmbientScript.soft_texture = null
	CombatVfxScript._glow_tex = null
	ForgedUI._tex_cache.clear()
	MapStyle.title_font = null
	MapStyle.vignette_texture = null

func load_databases() -> void:
	if FileAccess.file_exists("res://data/actors.json"):
		var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/actors.json"))
		if parsed is Dictionary:
			actors_db = parsed
	if FileAccess.file_exists("res://data/monsters.json"):
		var parsed_m: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/monsters.json"))
		if parsed_m is Dictionary:
			monsters_db = (parsed_m as Dictionary).get("monsters", {})
	if FileAccess.file_exists("res://data/animals.json"):
		var parsed_a: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/animals.json"))
		if parsed_a is Dictionary:
			animals_db = (parsed_a as Dictionary).get("animals", {})

func is_server_authoritative() -> bool:
	return server_char_id != "" and server_action_fn.is_valid()

func apply_server_character(ch: Dictionary) -> void:
	if ch.is_empty():
		return
	server_character = ch.duplicate(true)
	if rpg_hud != null and rpg_hud.has_method("apply_server_character"):
		rpg_hud.apply_server_character(ch)
	var st: Dictionary = ch.get("state", {})
	if interior_room != null and interior_room.has_method("apply_server_bank"):
		interior_room.apply_server_bank(st)
	if dialogue_strip != null and dialogue_strip.has_method("apply_server_quests"):
		dialogue_strip.apply_server_quests(st)
	if quest_journal != null and quest_journal.has_method("apply_server_goals") and ch.has("goals") and ch["goals"] is Array:
		quest_journal.apply_server_goals(ch["goals"] as Array)
	var prog: Dictionary = st.get("progress", {}) if st.get("progress") is Dictionary else {}
	var opened_arr = prog.get("openedTreasures", [])
	if opened_arr is Array:
		for tid in opened_arr:
			opened_treasures[str(tid)] = true
		_refresh_treasure_nodes_visibility()
	var disc_ws = prog.get("discoveredWaystones", [])
	if disc_ws is Array:
		for wid in disc_ws:
			discovered_waystones[str(wid)] = true
		_refresh_waystone_nodes()

func dispatch_server_action(payload: Dictionary, on_done: Callable = Callable()) -> bool:
	if not is_server_authoritative():
		return false
	var t0 := Time.get_ticks_msec()
	server_action_fn.call(server_char_id, payload, func(res: Dictionary) -> void:
		last_ping_ms = maxi(1, int(Time.get_ticks_msec() - t0))
		if bool(res.get("ok", false)):
			var ch: Dictionary = res.get("character", {})
			if not ch.is_empty() and str(payload["type"]) != "save_position" and int(ch.get("revision", 0)) >= int(server_character.get("revision", 0)):
				apply_server_character(ch)
			if bool(res.get("teleportCapital", false)):
				teleport_to_capital()
		if on_done.is_valid():
			on_done.call(res)
	)
	return true

func restore_server_position() -> bool:
	var saved: Variant = (server_character.get("state", {}) as Dictionary).get("position")
	if not (saved is Dictionary) or saved.get("layout") != POSITION_LAYOUT or saved.get("land") != current_land:
		return false
	var pos := Vector2(float(saved.get("x", -1.0)), float(saved.get("z", -1.0)))
	if not _can_save_world_point(pos):
		return false
	hero_pos = pos
	target_pos = Vector2(-1.0, -1.0)
	sync_hero(true)
	return true

func _can_save_world_point(pos: Vector2) -> bool:
	return pos.is_finite() and not walkable.is_empty() and is_walkable(pos.x, pos.y)

func save_server_position() -> void:
	if not is_server_authoritative() or is_booting or gm_noclip or _position_pending:
		return
	if str(server_character.get("land", "")) != current_land or not _can_save_world_point(hero_pos):
		return
	# hero_pos stays at the surface entrance while inside a building or labyrinth.
	var point := hero_pos.snapped(Vector2(0.01, 0.01))
	if not _can_save_world_point(point):
		point = hero_pos
	var state: Dictionary = server_character.get("state", {})
	var payload := {
		"type": "save_position",
		"land": current_land,
		"layout": POSITION_LAYOUT,
		"epoch": int(state.get("positionEpoch", 0)),
		"position": {"x": point.x, "z": point.y},
	}
	if payload == _position_sent:
		return
	_position_pending = true
	dispatch_server_action(payload, func(result: Dictionary) -> void:
		_position_pending = false
		if bool(result.get("ok", false)):
			_position_sent = payload
	)

func trigger_server_ping() -> void:
	if _ping_in_flight or not server_ping_fn.is_valid():
		return
	_ping_in_flight = true
	var t0 := Time.get_ticks_msec()
	server_ping_fn.call(func(ok: bool, rtt_ms: int = -1) -> void:
		_ping_in_flight = false
		if ok:
			last_ping_ms = rtt_ms if rtt_ms >= 0 else maxi(1, int(Time.get_ticks_msec() - t0))
		else:
			last_ping_ms = -1
	)

func rebuild_hero(land: String) -> void:
	if hero != null and is_instance_valid(hero):
		hero.queue_free()
	hero = ActorScript.new()
	var actor_land := hero_race_land if hero_race_land != "" else land
	var h_info: Array = HERO_ACTORS.get(actor_land, ["pyra.hero", "Ignis"])
	var h_key: String = str(h_info[0])
	var h_name: String = start_name if start_name != "" else str(h_info[1])
	if actors_db.has(h_key):
		var h_def: Dictionary = actors_db[h_key]
		hero.setup(h_def, h_name, false, true, "hero")
	hero.ki_race = _hero_race_key()
	hero.scale = Vector2(0.45, 0.45)
	ysort.add_child(hero)

func surface_color_for(land: String) -> Vector3:
	match land:
		"pyra":
			return Vector3(1.0, 0.28, 0.04)
		"verdant":
			return Vector3(0.10, 0.66, 0.82)
		"aether":
			return Vector3(0.16, 0.82, 0.94)
		"nexus":
			return Vector3(0.08, 0.88, 0.98)
		_:
			return Vector3(1.0, 0.28, 0.04)

func load_tex(path: String) -> Texture2D:
	if tex_cache.has(path):
		return tex_cache[path]
	if FileAccess.file_exists(path):
		var bytes := FileAccess.get_file_as_bytes(path)
		if not bytes.is_empty():
			var img := Image.new()
			var err := img.load_webp_from_buffer(bytes) if path.ends_with(".webp") else (img.load_png_from_buffer(bytes) if path.ends_with(".png") else img.load_jpg_from_buffer(bytes))
			if err == OK:
				var tex := ImageTexture.create_from_image(img)
				tex_cache[path] = tex
				return tex
	if ResourceLoader.exists(path):
		var res := load(path)
		if res is Texture2D:
			tex_cache[path] = res
			return res
	return null

func switch_region(land: String) -> void:
	if not REGION_TITLES.has(land):
		return
	_region_load_id += 1
	current_land = land
	region_title = REGION_TITLES[land]
	current_exp_idx = 0
	load_terrain(land)
	rebuild_hero(land)
	build_isometric_mesh()
	build_world_objects_and_actors()
	var spawn := capital_center + Vector2(0.0, 22.0)
	hero_pos = spawn if is_walkable(spawn.x, spawn.y) else capital_center
	if audio != null:
		audio.play_music(land)
		audio.play_ambience(land, true)
	if not is_booting and is_server_authoritative():
		dispatch_server_action({"type": "travel", "land": land})
	target_pos = Vector2(-1.0, -1.0)
	if premium_minimap != null:
		premium_minimap.load_region_texture(land)
	if atmosphere != null:
		atmosphere.set_region(land)
	if rpg_hud != null:
		rpg_hud.set_region(land)
	sync_hero(true)
	if map_3d != null:
		map_3d.rebuild_for_region()
	if atlas_overlay != null:
		atlas_overlay.sync_live_hero()

func load_terrain(land: String) -> void:
	var rdir := "res://regions/" + land
	heights = FileAccess.get_file_as_bytes(rdir + "/height.r32").to_float32_array()
	walkable = FileAccess.get_file_as_bytes(rdir + "/walkable.u8")
	var surf_tex: Texture2D = load_tex(rdir + "/surface.png")
	surface_img = surf_tex.get_image() if surf_tex != null else null

	sub_biomes = []
	roads = []
	buildings = []
	npcs_data = []
	exp_zones = []
	monsters_data = []
	fauna_data = []
	labyrinths_data = []
	treasures_data = []
	gatherables_data = []
	waystones_data = []
	gatherable_cd.clear()
	props = []
	landmarks = []

	var bpath := rdir + "/buildings.json"
	if FileAccess.file_exists(bpath):
		var bdata: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(bpath))
		grid_size = int(bdata.get("grid_size", 512))
		world_size = float(bdata.get("world_size", 1024.0))
		safe_city_radius = float(bdata.get("safe_city_radius", 250.0))
		var half := world_size * 0.5
		var cap_arr: Array = bdata.get("capital_center", [0.0, 0.0])
		if cap_arr.size() >= 2:
			capital_center = Vector2(float(cap_arr[0]) + half, float(cap_arr[1]) + half)
		else:
			capital_center = Vector2(half, half)

		for sb: Dictionary in bdata.get("sub_biomes", []):
			var sbc: Dictionary = sb.duplicate()
			sbc["x"] = float(sb.get("x", 0.0)) + half
			sbc["z"] = float(sb.get("z", 0.0)) + half
			sub_biomes.append(sbc)

		for rd: Dictionary in bdata.get("roads", []):
			var conv_pts: Array = []
			for pt: Array in rd.get("pts", []):
				conv_pts.append([float(pt[0]) + half, float(pt[1]) + half])
			roads.append({"tier": str(rd.get("tier", "footpath")), "pts": conv_pts})

		for b: Dictionary in bdata.get("buildings", []):
			var bc: Dictionary = b.duplicate()
			bc["x"] = float(b.get("x", 0.0)) + half
			bc["z"] = float(b.get("z", 0.0)) + half
			if b.has("entrance"):
				var ent_arr: Array = b.get("entrance", [0.0, 0.0])
				bc["entrance"] = [float(ent_arr[0]) + half, float(ent_arr[1]) + half]
			buildings.append(bc)
			if str(b.get("role", "")) in ["landmark", "hall", "arena", "smithy", "inn", "shop", "depot", "labyrinth"]:
				landmarks.append({"id": str(b.get("id", "")), "title": str(b.get("title", "")), "x": bc["x"], "z": bc["z"]})

		for n: Dictionary in bdata.get("npcs", []):
			var nc: Dictionary = n.duplicate()
			nc["x"] = float(n.get("x", 0.0)) + half
			nc["z"] = float(n.get("z", 0.0)) + half
			npcs_data.append(nc)

		for ez: Dictionary in bdata.get("exp_zones", []):
			var ezc: Dictionary = ez.duplicate()
			ezc["x"] = float(ez.get("x", 0.0)) + half
			ezc["z"] = float(ez.get("z", 0.0)) + half
			exp_zones.append(ezc)

		for m: Dictionary in bdata.get("monsters", []):
			var mc: Dictionary = m.duplicate()
			mc["x"] = float(m.get("x", 0.0)) + half
			mc["z"] = float(m.get("z", 0.0)) + half
			monsters_data.append(mc)

		for fa: Dictionary in bdata.get("fauna", []):
			var fac: Dictionary = fa.duplicate()
			fac["x"] = float(fa.get("x", 0.0)) + half
			fac["z"] = float(fa.get("z", 0.0)) + half
			fauna_data.append(fac)

		for lab: Dictionary in bdata.get("labyrinths", []):
			var lc: Dictionary = lab.duplicate(true)
			lc["x"] = float(lab.get("x", 0.0)) + half
			lc["z"] = float(lab.get("z", 0.0)) + half
			labyrinths_data.append(lc)

		for tr: Dictionary in bdata.get("treasures", []):
			var tc: Dictionary = tr.duplicate(true)
			tc["x"] = float(tr.get("x", 0.0)) + half
			tc["z"] = float(tr.get("z", 0.0)) + half
			treasures_data.append(tc)

		for g: Dictionary in bdata.get("gatherables", []):
			var gc: Dictionary = g.duplicate(true)
			gc["x"] = float(g.get("x", 0.0)) + half
			gc["z"] = float(g.get("z", 0.0)) + half
			gatherables_data.append(gc)

		for ws_item: Dictionary in bdata.get("waystones", []):
			var wsc: Dictionary = ws_item.duplicate(true)
			wsc["x"] = float(ws_item.get("x", 0.0)) + half
			wsc["z"] = float(ws_item.get("z", 0.0)) + half
			waystones_data.append(wsc)

		for p: Dictionary in bdata.get("props", []):
			var pc: Dictionary = p.duplicate()
			pc["x"] = float(p.get("x", 0.0)) + half
			pc["z"] = float(p.get("z", 0.0)) + half
			props.append(pc)

func iso(x: float, z: float, h: float) -> Vector2:
	return Vector2((x - z) * ISO_W, (x + z) * ISO_D - h * ISO_H)

func unproject(screen: Vector2, h: float) -> Vector2:
	var sy := screen.y + h * ISO_H
	var a := screen.x / ISO_W
	var b := sy / ISO_D
	return Vector2((a + b) * 0.5, (b - a) * 0.5)

func screen_to_ground(screen: Vector2) -> Vector2:
	var h := height_at(hero_pos.x, hero_pos.y)
	var p := unproject(screen, h)
	for _i in 4:
		h = height_at(p.x, p.y)
		p = unproject(screen, h)
	return p

func grid_index(gx: int, gz: int) -> int:
	return clampi(gz, 0, grid_size - 1) * grid_size + clampi(gx, 0, grid_size - 1)

func height_at(x: float, z: float) -> float:
	if heights.is_empty():
		return 0.0
	var fx := clampf(x / world_size * float(grid_size - 1), 0.0, float(grid_size - 1))
	var fz := clampf(z / world_size * float(grid_size - 1), 0.0, float(grid_size - 1))
	var x0 := int(floor(fx))
	var z0 := int(floor(fz))
	var x1 := mini(grid_size - 1, x0 + 1)
	var z1 := mini(grid_size - 1, z0 + 1)
	var tx := fx - float(x0)
	var tz := fz - float(z0)
	var h0 := lerpf(heights[grid_index(x0, z0)], heights[grid_index(x1, z0)], tx)
	var h1 := lerpf(heights[grid_index(x0, z1)], heights[grid_index(x1, z1)], tx)
	return lerpf(h0, h1, tz)

func is_walkable(x: float, z: float) -> bool:
	if walkable.is_empty():
		return true
	if x < 12.0 or z < 12.0 or x > world_size - 12.0 or z > world_size - 12.0:
		return false
	var gx := int(round(x / world_size * float(grid_size - 1)))
	var gz := int(round(z / world_size * float(grid_size - 1)))
	return walkable[grid_index(gx, gz)] > 0

func is_on_road(x: float, z: float) -> bool:
	if surface_img == null:
		return false
	var sw := surface_img.get_width()
	var sh := surface_img.get_height()
	if sw <= 1 or sh <= 1:
		return false
	var gx := clampi(int(round(x / world_size * float(sw - 1))), 0, sw - 1)
	var gz := clampi(int(round(z / world_size * float(sh - 1))), 0, sh - 1)
	return surface_img.get_pixel(gx, gz).b > 0.24

func is_in_water(x: float, z: float) -> bool:
	if surface_img == null:
		return false
	var sw := surface_img.get_width()
	var sh := surface_img.get_height()
	if sw <= 1 or sh <= 1:
		return false
	var gx := clampi(int(round(x / world_size * float(sw - 1))), 0, sw - 1)
	var gz := clampi(int(round(z / world_size * float(sh - 1))), 0, sh - 1)
	return surface_img.get_pixel(gx, gz).g > 0.28

func vertex_color(gx: int, gz: int) -> Color:
	var hx := heights[grid_index(gx + 2, gz)] - heights[grid_index(gx - 2, gz)]
	var hz := heights[grid_index(gx, gz + 2)] - heights[grid_index(gx, gz - 2)]
	var normal := Vector3(-hx, 3.6, -hz).normalized()
	var sun := Vector3(-0.55, 0.74, -0.38).normalized()
	var shade := clampf(0.54 + 0.56 * normal.dot(sun), 0.34, 1.15)
	return Color(shade, shade * 0.98, shade * 0.95, 1.0)

func _emit_ocean_quad(ost: SurfaceTool, x0: float, z0: float, x1: float, z1: float, edge_h: float) -> void:
	var ws := maxf(world_size, 1.0)
	var o00 := {"pos": iso(x0, z0, edge_h), "uv": Vector2(x0 / ws, z0 / ws), "color": Color.WHITE}
	var o10 := {"pos": iso(x1, z0, edge_h), "uv": Vector2(x1 / ws, z0 / ws), "color": Color.WHITE}
	var o11 := {"pos": iso(x1, z1, edge_h), "uv": Vector2(x1 / ws, z1 / ws), "color": Color.WHITE}
	var o01 := {"pos": iso(x0, z1, edge_h), "uv": Vector2(x0 / ws, z1 / ws), "color": Color.WHITE}
	emit_tri(ost, o00, o10, o11)
	emit_tri(ost, o00, o11, o01)

func build_isometric_mesh() -> void:
	for child in terrain_mesh.get_children():
		child.queue_free()
	terrain_chunks.clear()

	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/terrain.gdshader")
	var rdir := "res://regions/" + current_land
	for i in 4:
		var t_png := load_tex("%s/mat_%d.png" % [rdir, i])
		var t_webp := load_tex("%s/mat_%d.webp" % [rdir, i])
		mat.set_shader_parameter("mat_%d_tex" % i, t_png if t_png != null else t_webp)
	var wtex := load_tex("%s/water.png" % rdir)
	mat.set_shader_parameter("water_tex", wtex)
	var weights_path := "%s/weights.png" % rdir
	if FileAccess.file_exists(weights_path):
		mat.set_shader_parameter("weights_tex", load_tex(weights_path))
	mat.set_shader_parameter("surface_tex", load_tex("%s/surface.png" % rdir))
	mat.set_shader_parameter("map_art_tex", load_tex("%s/map_art.png" % rdir))
	mat.set_shader_parameter("surface_color", surface_color_for(current_land))
	var ws_s := maxf(world_size / 1024.0, 1.0)
	var uv_sc := 88.0 * ws_s
	mat.set_shader_parameter("uv_scale", uv_sc)
	mat.set_shader_parameter("world_scale", ws_s)

	# 8x8 spatial indexed terrain chunks: frustum-culled in _cull_props() so mobile GPU draws ~3,000 tris instead of 131,072!
	var chunk_grid := 8
	var max_g := grid_size - 1
	var chunk_step := maxi(STEP, int(ceil(float(max_g) / float(chunk_grid) / float(STEP))) * STEP)
	for cz in range(0, max_g, chunk_step):
		var gz_end := mini(max_g, cz + chunk_step)
		for cx in range(0, max_g, chunk_step):
			var gx_end := mini(max_g, cx + chunk_step)
			var st := SurfaceTool.new()
			st.begin(Mesh.PRIMITIVE_TRIANGLES)
			var min_p := Vector2(1e9, 1e9)
			var max_p := Vector2(-1e9, -1e9)
			var gz := cz
			while gz < gz_end:
				var gz_next := mini(gz + STEP, gz_end)
				var gx := cx
				while gx < gx_end:
					var gx_next := mini(gx + STEP, gx_end)
					var p00 := grid_vertex(gx, gz)
					var p10 := grid_vertex(gx_next, gz)
					var p11 := grid_vertex(gx_next, gz_next)
					var p01 := grid_vertex(gx, gz_next)
					for v_d: Dictionary in [p00, p10, p11, p01]:
						var vp: Vector2 = v_d["pos"]
						min_p.x = minf(min_p.x, vp.x)
						min_p.y = minf(min_p.y, vp.y)
						max_p.x = maxf(max_p.x, vp.x)
						max_p.y = maxf(max_p.y, vp.y)
					emit_tri(st, p00, p10, p11)
					emit_tri(st, p00, p11, p01)
					gx = gx_next
				gz = gz_next
			st.index()
			var mi := MeshInstance2D.new()
			mi.mesh = st.commit()
			mi.material = mat
			mi.visible = false
			terrain_mesh.add_child(mi)
			var bounds := Rect2(min_p - Vector2(64.0, 64.0), (max_p - min_p) + Vector2(128.0, 128.0))
			terrain_chunks.append({"node": mi, "rect": bounds})

	# 4-strip outer ocean frame around the continent ONLY (zero pixels drawn behind land = eliminates 100% hidden ocean overdraw!)
	var edge_h := heights[0] if not heights.is_empty() else -4.2
	var pad := 2600.0
	var ost := SurfaceTool.new()
	ost.begin(Mesh.PRIMITIVE_TRIANGLES)
	_emit_ocean_quad(ost, -pad, -pad, world_size + pad, 0.0, edge_h)
	_emit_ocean_quad(ost, -pad, world_size, world_size + pad, world_size + pad, edge_h)
	_emit_ocean_quad(ost, -pad, 0.0, 0.0, world_size, edge_h)
	_emit_ocean_quad(ost, world_size, 0.0, world_size + pad, world_size, edge_h)
	ocean_skirt.mesh = ost.commit()
	var omat := ShaderMaterial.new()
	omat.shader = load("res://shaders/ocean_skirt.gdshader")
	omat.set_shader_parameter("water_tex", wtex)
	omat.set_shader_parameter("uv_scale", uv_sc)
	omat.set_shader_parameter("world_scale", ws_s)
	ocean_skirt.material = omat

func grid_vertex(gx: int, gz: int) -> Dictionary:
	var wx := float(gx) * world_size / float(grid_size - 1)
	var wz := float(gz) * world_size / float(grid_size - 1)
	var h := heights[grid_index(gx, gz)]
	var uv := Vector2(float(gx) / float(grid_size - 1), float(gz) / float(grid_size - 1))
	return {"pos": iso(wx, wz, h), "uv": uv, "color": vertex_color(gx, gz)}

func emit_tri(st: SurfaceTool, a: Dictionary, b: Dictionary, c: Dictionary) -> void:
	for v: Dictionary in [a, b, c]:
		st.set_color(v.color)
		st.set_uv(v.uv)
		st.add_vertex(Vector3(v.pos.x, v.pos.y, 0.0))

func make_shadow_tex() -> Texture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.45, 0.78, 1.0])
	g.colors = PackedColorArray([
		Color(0.0, 0.0, 0.0, 0.82),
		Color(0.0, 0.0, 0.0, 0.52),
		Color(0.0, 0.0, 0.0, 0.16),
		Color(0.0, 0.0, 0.0, 0.0),
	])
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 64
	tex.height = 64
	return tex

func add_contact_shadow(parent: Node2D, w_px: float, alpha: float = 0.38, y_off: float = 4.0) -> void:
	if shadow_tex == null:
		return
	var sh := Sprite2D.new()
	sh.texture = shadow_tex
	sh.z_index = -1
	var sx := clampf((w_px * SPRITE_SCALE) / 64.0 * 0.74, 0.65, 11.5)
	sh.scale = Vector2(sx, sx * 0.44)
	sh.position = Vector2(0.0, y_off)
	sh.modulate = Color(0.02, 0.02, 0.05, alpha)
	parent.add_child(sh)

func make_fitted_sprite(tex_path: String, box_w: float, box_h: float, anchor_y: float = 0.88) -> Sprite2D:
	var sp := Sprite2D.new()
	var tex := load_tex(tex_path)
	if tex != null:
		sp.texture = tex
		sp.centered = false
		var tsize := tex.get_size()
		var fit := minf((box_w * SPRITE_SCALE) / maxf(tsize.x, 1.0), (box_h * SPRITE_SCALE) / maxf(tsize.y, 1.0))
		sp.scale = Vector2(fit, fit)
		sp.offset = -Vector2(0.5, anchor_y) * tsize
	return sp

func build_world_objects_and_actors() -> void:
	live_agents.clear()
	_clear_ground_loot()
	prop_nodes.clear()
	prop_chunks.clear()
	_visible_prop_chunks.clear()
	treasure_nodes.clear()
	gatherable_nodes.clear()
	waystone_nodes.clear()
	_last_cull_cam = Vector2(1e9, 1e9)
	for child in ysort.get_children():
		if child != hero:
			child.queue_free()

	var body_f: Font = MapStyle.body_font()

	var register_chunk := func(nd: Node2D, pos: Vector2) -> void:
		nd.visible = false
		var ck := Vector2i(int(floor(pos.x / PROP_CHUNK_PX)), int(floor(pos.y / PROP_CHUNK_PX)))
		if not prop_chunks.has(ck):
			prop_chunks[ck] = []
		(prop_chunks[ck] as Array).append(nd)

	# 1. Painted Architectural Buildings + Labyrinth Portals + Fortifications & Bridges
	for b: Dictionary in buildings:
		var bx := float(b.get("x", 512.0))
		var bz := float(b.get("z", 512.0))
		var bh := height_at(bx, bz)
		var sp_path := str(b.get("sprite", ""))
		var bw := float(b.get("w", 420.0))
		var bh_px := float(b.get("h", 420.0))
		var role := str(b.get("role", "building"))

		var node := Node2D.new()
		var bpos := iso(bx, bz, bh)
		node.position = bpos
		if role == "bridge":
			node.z_index = -2
		else:
			add_contact_shadow(node, bw, 0.42 if role in ["landmark", "labyrinth"] else 0.34, 4.0)
		var sp := make_fitted_sprite(sp_path, bw, bh_px, 0.54 if role == "bridge" else 0.86)
		node.add_child(sp)

		var fx_kind := AmbientScript.kind_for(sp_path)
		if fx_kind != "":
			var fx := AmbientScript.create(fx_kind, Vector2.ZERO, sp_path)
			node.add_child(fx)

		if role in ["landmark", "hall", "arena", "smithy", "inn", "shop", "depot", "gate", "labyrinth"]:
			var lbl := Label.new()
			lbl.text = ("⚔ LABIRYNT: %s (Poz.%d)" % [str(b.get("title", "")), int(b.get("level", 5))]) if role == "labyrinth" else str(b.get("title", ""))
			lbl.position = Vector2(-240, -bh_px * SPRITE_SCALE * 0.82 - 22.0)
			lbl.size = Vector2(480, 30)
			lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lbl.add_theme_font_override("font", body_f)
			lbl.add_theme_font_size_override("font_size", 20 if role in ["landmark", "labyrinth"] else 18)
			lbl.add_theme_color_override("font_color", Color(0.96, 0.56, 1.0) if role == "labyrinth" else (Color(1.0, 0.84, 0.38) if role == "landmark" else Color(1.0, 0.94, 0.74)))
			lbl.add_theme_color_override("font_outline_color", Color(0.04, 0.02, 0.02, 0.96))
			lbl.add_theme_constant_override("outline_size", 7)
			node.add_child(lbl)

		ysort.add_child(node)
		register_chunk.call(node, bpos)

	# 2. Diverse Painted Flora, Trees, Flowers, Waterfalls, Rocks, Ruins, Shrines & Biome Landmarks (GPU wind sway + spatial chunk culling)
	for pi in props.size():
		var p: Dictionary = props[pi]
		var px := float(p.get("x", 512.0))
		var pz := float(p.get("z", 512.0))
		var ph := height_at(px, pz)
		var p_path := str(p.get("sprite", ""))
		var p_kind := str(p.get("kind", ""))
		var pw := float(p.get("w", 260.0))
		var ph_px := float(p.get("h", 280.0))

		var pnode := Node2D.new()
		var ppos := iso(px, pz, ph)
		pnode.position = ppos
		add_contact_shadow(pnode, pw, 0.30, 3.0)
		var psp := make_fitted_sprite(p_path, pw, ph_px, 0.88)
		if not wind_mats.is_empty():
			var pl := p_path.to_lower()
			if p_kind in ["tree", "bush"] or "tree" in pl or "pine" in pl or "cypress" in pl or "bush" in pl or "fern" in pl or "sakura" in pl or "flower" in pl or "palm" in pl or "willow" in pl or "bonsai" in pl:
				psp.material = wind_mats[pi % wind_mats.size()]
		pnode.add_child(psp)

		var p_fx := AmbientScript.kind_for(p_path)
		if p_fx != "":
			var fx_node := AmbientScript.create(p_fx, Vector2.ZERO, p_path)
			pnode.add_child(fx_node)

		ysort.add_child(pnode)
		prop_nodes.append(pnode)
		register_chunk.call(pnode, ppos)

	# 2b. Hidden World Treasures & Adventure Shrines (6 per continent)
	for tr: Dictionary in treasures_data:
		var tid := str(tr.get("id", ""))
		var tx := float(tr.get("x", 512.0))
		var tz := float(tr.get("z", 512.0))
		var th := height_at(tx, tz)
		var t_req_lv := int(tr.get("min_level", 1))
		var tnode := Node2D.new()
		var tpos := iso(tx, tz, th)
		tnode.position = tpos
		add_contact_shadow(tnode, 240.0, 0.36, 3.0)
		var tsp := make_fitted_sprite("res://assets/library/props/prop_runic_obelisk.webp", 230.0, 275.0, 0.88)
		tnode.add_child(tsp)
		var tlbl := Label.new()
		tlbl.text = ("★ UKRYTY SKARB (Poz.%d+): %s" % [t_req_lv, str(tr.get("title", "Skarb"))]) if t_req_lv > 1 else ("★ UKRYTY SKARB: %s" % str(tr.get("title", "Skarb")))
		tlbl.position = Vector2(-220, -172)
		tlbl.size = Vector2(440, 28)
		tlbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		tlbl.add_theme_font_override("font", body_f)
		tlbl.add_theme_font_size_override("font_size", 16)
		tlbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.36))
		tlbl.add_theme_color_override("font_outline_color", Color(0.06, 0.03, 0.01, 0.98))
		tlbl.add_theme_constant_override("outline_size", 6)
		tnode.add_child(tlbl)
		if opened_treasures.has(tid):
			tnode.modulate = Color(0.55, 0.55, 0.58, 0.55)
			tlbl.text = "✓ ODKRYTO: %s" % str(tr.get("title", "Skarb"))
			tlbl.add_theme_color_override("font_color", Color(0.56, 0.88, 0.66))
		ysort.add_child(tnode)
		treasure_nodes[tid] = tnode
		register_chunk.call(tnode, tpos)

	# 2c. Interactive Wilderness Gatherables & Healing Rest Campfires (Paczka B: 28 per continent)
	for g: Dictionary in gatherables_data:
		var gid := str(g.get("id", ""))
		var gkind := str(g.get("kind", "gather"))
		var gx := float(g.get("x", 512.0))
		var gz := float(g.get("z", 512.0))
		var gh := height_at(gx, gz)
		var gsp_path := str(g.get("sprite", ""))
		var gw := float(g.get("w", 205.0))
		var gh_px := float(g.get("h", 205.0))
		var gnode := Node2D.new()
		var gpos := iso(gx, gz, gh)
		gnode.position = gpos
		add_contact_shadow(gnode, gw, 0.34, 3.0)
		var gsp := make_fitted_sprite(gsp_path, gw, gh_px, 0.86)
		gnode.add_child(gsp)
		var gfx_kind := "fire" if gkind == "campfire" else AmbientScript.kind_for(gsp_path)
		if gfx_kind != "":
			var gfx := AmbientScript.create(gfx_kind, Vector2.ZERO, gsp_path)
			gnode.add_child(gfx)
		var glbl := Label.new()
		glbl.text = ("🔥 %s (Odpoczynek)" % str(g.get("title", "Ognisko"))) if gkind == "campfire" else ("✦ %s" % str(g.get("title", "Surowiec")))
		glbl.position = Vector2(-190, -gh_px * SPRITE_SCALE * 0.84 - 16.0)
		glbl.size = Vector2(380, 26)
		glbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		glbl.add_theme_font_override("font", body_f)
		glbl.add_theme_font_size_override("font_size", 15)
		glbl.add_theme_color_override("font_color", Color(1.0, 0.76, 0.36) if gkind == "campfire" else Color(0.56, 0.98, 0.72))
		glbl.add_theme_color_override("font_outline_color", Color(0.04, 0.02, 0.01, 0.98))
		glbl.add_theme_constant_override("outline_size", 6)
		gnode.add_child(glbl)
		ysort.add_child(gnode)
		gatherable_nodes[gid] = gnode
		register_chunk.call(gnode, gpos)

	# 2d. Discoverable Fast-Travel Waystones (4 per continent)
	for ws_item: Dictionary in waystones_data:
		var wid := str(ws_item.get("id", ""))
		var wwx := float(ws_item.get("x", 512.0))
		var wwz := float(ws_item.get("z", 512.0))
		var wwh := height_at(wwx, wwz)
		var wnode := Node2D.new()
		var wpos := iso(wwx, wwz, wwh)
		wnode.position = wpos
		add_contact_shadow(wnode, 250.0, 0.38, 3.0)
		var wsp := make_fitted_sprite("res://assets/library/props/prop_runic_obelisk.webp", 240.0, 295.0, 0.88)
		wsp.modulate = Color(0.68, 0.96, 1.0, 1.0) if is_waystone_discovered(wid) else Color(0.76, 0.82, 0.92, 0.90)
		wnode.add_child(wsp)
		var wlbl := Label.new()
		wlbl.name = "WsLbl"
		wlbl.text = ("✦ KAMIEŃ SZLAKU: %s" % str(ws_item.get("title", ""))) if is_waystone_discovered(wid) else ("◇ KAMIEŃ SZLAKU: %s (Podejdź)" % str(ws_item.get("title", "")))
		wlbl.position = Vector2(-230, -182)
		wlbl.size = Vector2(460, 28)
		wlbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		wlbl.add_theme_font_override("font", body_f)
		wlbl.add_theme_font_size_override("font_size", 16)
		wlbl.add_theme_color_override("font_color", Color(0.42, 0.98, 1.0) if is_waystone_discovered(wid) else Color(0.84, 0.90, 0.98))
		wlbl.add_theme_color_override("font_outline_color", Color(0.02, 0.04, 0.08, 0.98))
		wlbl.add_theme_constant_override("outline_size", 6)
		wnode.add_child(wlbl)
		ysort.add_child(wnode)
		waystone_nodes[wid] = wnode
		register_chunk.call(wnode, wpos)

	# 3. Exp-Zone Combat Clearing Banners ("EXPOWISKA Lv. 1..18")
	for ez: Dictionary in exp_zones:
		var ex := float(ez.get("x", 512.0))
		var ez_z := float(ez.get("z", 512.0))
		var eh := height_at(ex, ez_z)
		var ez_node := Node2D.new()
		var ez_pos := iso(ex, ez_z, eh)
		ez_node.position = ez_pos
		var banner := Label.new()
		banner.text = "⚔ %s" % str(ez.get("name", ""))
		banner.position = Vector2(-240, -165)
		banner.size = Vector2(480, 34)
		banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		banner.add_theme_font_override("font", body_f)
		banner.add_theme_font_size_override("font_size", 19)
		banner.add_theme_color_override("font_color", Color(1.0, 0.76, 0.28))
		banner.add_theme_color_override("font_outline_color", Color(0.08, 0.02, 0.02, 0.98))
		banner.add_theme_constant_override("outline_size", 7)
		ez_node.add_child(banner)
		ysort.add_child(ez_node)
		register_chunk.call(ez_node, ez_pos)

	# 4. Capital & Wilderness NPCs with Quest Markers (! / ?) and Patrols
	for idx in npcs_data.size():
		var n: Dictionary = npcs_data[idx]
		var aid := str(n.get("actor_id", ""))
		if not actors_db.has(aid):
			continue
		var adef: Dictionary = actors_db[aid]
		var npc_actor := ActorScript.new()
		npc_actor.setup(
			adef,
			str(n.get("name", "")),
			false,
			false,
			"npc",
			0,
			str(n.get("quest_mark", "")),
			str(n.get("role", ""))
		)
		npc_actor.scale = Vector2(0.42, 0.42)
		var nx := float(n.get("x", 512.0))
		var nz := float(n.get("z", 512.0))
		npc_actor.position = iso(nx, nz, height_at(nx, nz))
		ysort.add_child(npc_actor)
		live_agents.append({
			"kind": "npc",
			"id": aid,
			"name": str(n.get("name", "Mieszkaniec")),
			"role": str(n.get("role", "Obywatel")),
			"quest_mark": str(n.get("quest_mark", "")),
			"last_bark_t": -20.0 - float(idx) * 2.5,
			"node": npc_actor,
			"home": Vector2(nx, nz),
			"pos": Vector2(nx, nz),
			"radius": float(n.get("patrol_radius", 18.0)),
			"speed": 10.5,
			"phase": float(idx) * 1.37,
			"ai_state": "idle",
			"ai_timer": randf_range(1.2, 5.2),
			"ai_target": Vector2(nx, nz),
		})

	# 5. Live Canonical Monsters + Named Zone Mini-Boss Elites (Lv. 1..18, 0 inside safe capitals!)
	for idx in monsters_data.size():
		var m: Dictionary = monsters_data[idx]
		var mid := str(m.get("actor_id", ""))
		if not monsters_db.has(mid):
			continue
		var m_entry: Dictionary = monsters_db[mid]
		var m_actor_def: Dictionary = m_entry.get("actor", {})
		if m_actor_def.is_empty():
			continue
		var is_el := bool(m.get("is_elite", false))
		var sc_m := float(m.get("scale_mult", 1.0))
		var mon_actor := ActorScript.new()
		mon_actor.setup(
			m_actor_def,
			str(m.get("name", "")),
			false,
			false,
			"monster",
			int(m.get("level", 1)),
			"",
			"",
			is_el
		)
		mon_actor.scale = Vector2(0.47 * sc_m, 0.47 * sc_m)
		var mx := float(m.get("x", 512.0))
		var mz := float(m.get("z", 512.0))
		mon_actor.position = iso(mx, mz, height_at(mx, mz))
		ysort.add_child(mon_actor)
		var m_lv := int(m.get("level", 1))
		var m_hp := int(m.get("hp", 135 + m_lv * 68 + m_lv * m_lv * 9))
		var m_atk := int(m.get("atk", 16 + m_lv * 8))
		live_agents.append({
			"kind": "monster",
			"id": str(m.get("id", mid)),
			"actor_id": mid,
			"name": str(m.get("name", "Potwór")),
			"level": m_lv,
			"is_elite": is_el,
			"max_hp": m_hp,
			"cur_hp": m_hp,
			"atk": m_atk,
			"atk_cd": 0.0,
			"aggro_windup": 0.0,
			"was_aggro": false,
			"atk_count": 0,
			"roared": false,
			"dmg_dealt_to_hero": 0,
			"xp": int(m.get("xp", 18 + m_lv * 7)),
			"gold": int(m.get("gold", 8 + m_lv * 4)),
			"alive": true,
			"death_hide_t": 0.0,
			"respawn_t": 0.0,
			"node": mon_actor,
			"home": Vector2(mx, mz),
			"pos": Vector2(mx, mz),
			"radius": float(m.get("patrol_radius", 26.0)),
			"speed": 13.0,
			"phase": float(idx) * 1.91,
			"ai_state": "idle",
			"ai_timer": randf_range(1.0, 4.0),
			"ai_target": Vector2(mx, mz),
		})

	# 6. Animated Wildlife Fauna Animals (A-01..A-10) roaming near lakes, rivers & forests
	for idx in fauna_data.size():
		var fa: Dictionary = fauna_data[idx]
		var faid := str(fa.get("actor_id", ""))
		if not animals_db.has(faid):
			continue
		var fa_entry: Dictionary = animals_db[faid]
		var fa_actor_def: Dictionary = fa_entry.get("actor", {})
		if fa_actor_def.is_empty():
			continue
		var ani_actor := ActorScript.new()
		ani_actor.setup(
			fa_actor_def,
			str(fa.get("name", "")),
			false,
			false,
			"animal"
		)
		ani_actor.scale = Vector2(0.44, 0.44)
		var fx := float(fa.get("x", 512.0))
		var fz := float(fa.get("z", 512.0))
		ani_actor.position = iso(fx, fz, height_at(fx, fz))
		ysort.add_child(ani_actor)
		var fa_name := str(fa.get("name", "Dzikie Zwierzę"))
		live_agents.append({
			"id": "animal_%s_%d" % [faid, idx],
			"actor_id": faid,
			"name": fa_name,
			"level": 1,
			"is_elite": false,
			"max_hp": 75,
			"cur_hp": 75,
			"atk": 6,
			"atk_cd": 0.0,
			"dmg_dealt_to_hero": 0,
			"alive": true,
			"death_hide_t": 0.0,
			"respawn_t": 0.0,
			"kind": "animal",
			"node": ani_actor,
			"home": Vector2(fx, fz),
			"pos": Vector2(fx, fz),
			"radius": float(fa.get("patrol_radius", 24.0)),
			"speed": 13.0,
			"phase": float(idx) * 2.23,
			"ai_state": "idle",
			"ai_timer": randf_range(1.5, 4.5),
			"ai_target": Vector2(fx, fz),
		})

func teleport_to_capital() -> void:
	var spawn := capital_center + Vector2(0.0, 22.0)
	hero_pos = spawn if is_walkable(spawn.x, spawn.y) else capital_center
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	if combat_vfx != null and hero != null and combat_vfx.has_method("spawn_teleport_flash"):
		combat_vfx.spawn_teleport_flash(hero.position, _hero_race_key())
	if audio != null:
		audio.sfx("ui/teleport", 0.85, 0.04)

func teleport_to_world_pos(land: String, wx: float, wz: float, show_fx: bool = true) -> void:
	if land != current_land and REGION_TITLES.has(land):
		switch_region(land)
	var tx := clampf(wx, 18.0, world_size - 18.0)
	var tz := clampf(wz, 18.0, world_size - 18.0)
	if not gm_noclip and not is_walkable(tx, tz):
		# Snap cleanly to nearest walkable dry point within 120m so tap-on-map never gets stuck in water!
		var found := false
		for rad in range(4, 126, 6):
			for ak in range(16):
				var ang := TAU * float(ak) / 16.0
				var cx := clampf(tx + cos(ang) * float(rad), 18.0, world_size - 18.0)
				var cz := clampf(tz + sin(ang) * float(rad), 18.0, world_size - 18.0)
				if is_walkable(cx, cz):
					tx = cx
					tz = cz
					found = true
					break
			if found:
				break
	hero_pos = Vector2(tx, tz)
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	if show_fx:
		if combat_vfx != null and hero != null and combat_vfx.has_method("spawn_teleport_flash"):
			combat_vfx.spawn_teleport_flash(hero.position, _hero_race_key())
		if audio != null:
			audio.sfx("ui/teleport", 0.88, 0.04)
		var cname := str(REGION_TITLES.get(current_land, current_land)).split("—")[0].strip_edges()
		show_combat_toast("⚡ Teleportacja → %s (%d, %d)" % [cname, int(round(tx)), int(round(tz))], Color(0.48, 0.96, 1.0))

func cycle_town_stronghold() -> void:
	var towns: Array = []
	for b: Dictionary in buildings:
		if str(b.get("map_kind", "")) == "town":
			towns.append(b)
	if towns.is_empty():
		return
	var pick: Dictionary = towns[current_exp_idx % towns.size()]
	current_exp_idx = (current_exp_idx + 1) % towns.size()
	var ent = pick.get("entrance", [])
	if ent is Array and ent.size() >= 2:
		hero_pos = Vector2(float(ent[0]), float(ent[1]))
	else:
		hero_pos = Vector2(float(pick.get("x", 512.0)), float(pick.get("z", 512.0)) + 48.0)
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()

func cycle_exp_zone() -> void:
	cycle_town_stronghold()

func build_hud() -> void:
	if hud.get_parent() == null:
		add_child(hud)

	atmosphere = WorldAtmosphereScript.new()
	atmosphere.world = self
	hud.add_child(atmosphere)

	rpg_hud = RpgHudScript.new()
	rpg_hud.world = self
	hud.add_child(rpg_hud)
	if not initial_hud_layout.is_empty() and rpg_hud.has_method("apply_hud_layout"):
		rpg_hud.apply_hud_layout(initial_hud_layout)
	quest_journal = QuestJournalScript.new()
	quest_journal.world = self
	quest_journal.z_index = 45
	hud.add_child(quest_journal)

	premium_minimap = PremiumMinimapScript.new()
	premium_minimap.world = self
	hud.add_child(premium_minimap)

	map_3d = Map3DScript.new()
	map_3d.world = self
	map_3d.visible = false
	hud.add_child(map_3d)

	atlas_overlay = AtlasOverlayScript.new()
	atlas_overlay.world = self
	atlas_overlay.visible = false
	hud.add_child(atlas_overlay)

	gm_panel = GmPanelScript.new()
	gm_panel.world = self
	gm_panel.visible = false
	hud.add_child(gm_panel)

	game_menu = GameMenuScript.new()
	game_menu.world = self
	game_menu.visible = false
	hud.add_child(game_menu)

	# Large mobile-friendly Forged "WEJDŹ DO BUDYNKU" prompt button
	ForgedUI.style_button(btn_enter_bldg, "gold", 21, 26.0, 12.0)
	btn_enter_bldg.text = "▶ WEJDŹ DO BUDYNKU"
	btn_enter_bldg.visible = false
	btn_enter_bldg.pressed.connect(func() -> void:
		if not nearest_enterable.is_empty():
			enter_building(nearest_enterable)
	)
	hud.add_child(btn_enter_bldg)

	# Contextual mobile Forged "ROZMAWIAJ Z NPC" button
	ForgedUI.style_button(btn_talk_npc, "slate", 20, 26.0, 11.0)
	btn_talk_npc.text = "▶ ROZMAWIAJ"
	btn_talk_npc.visible = false
	btn_talk_npc.pressed.connect(func() -> void:
		if not nearest_npc_agent.is_empty():
			open_npc_dialogue(nearest_npc_agent)
	)
	hud.add_child(btn_talk_npc)

	interior_room = InteriorRoomScript.new()
	interior_room.world = self
	interior_room.visible = false
	hud.add_child(interior_room)

	labyrinth_room = LabyrinthRoomScript.new()
	labyrinth_room.world = self
	labyrinth_room.visible = false
	hud.add_child(labyrinth_room)

	# Contextual Forged golden "OTWÓRZ UKRYTY SKARB" button
	ForgedUI.style_button(btn_open_treasure, "gold", 21, 26.0, 12.0)
	btn_open_treasure.text = "★ OTWÓRZ UKRYTY SKARB"
	btn_open_treasure.visible = false
	btn_open_treasure.pressed.connect(func() -> void:
		if not nearest_treasure.is_empty():
			claim_treasure_reward(nearest_treasure, "")
	)
	hud.add_child(btn_open_treasure)

	# Contextual Forged button for Wilderness Gatherables & Healing Rest Campfires (Paczka B)
	ForgedUI.style_button(btn_gather, "gold", 21, 26.0, 12.0)
	btn_gather.text = "✦ ZBIERZ SUROWIEC"
	btn_gather.visible = false
	btn_gather.pressed.connect(func() -> void:
		if not nearest_gatherable.is_empty():
			interact_gatherable(nearest_gatherable)
	)
	hud.add_child(btn_gather)

	combat_toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	combat_toast_lbl.add_theme_font_override("font", MapStyle.body_font())
	combat_toast_lbl.add_theme_font_size_override("font_size", 22)
	combat_toast_lbl.add_theme_color_override("font_color", Color(1.0, 0.90, 0.44))
	combat_toast_lbl.add_theme_color_override("font_outline_color", Color(0.04, 0.02, 0.01, 0.98))
	combat_toast_lbl.add_theme_constant_override("outline_size", 7)
	combat_toast_lbl.visible = false
	hud.add_child(combat_toast_lbl)

	dialogue_strip = DialogueStripScript.new()
	dialogue_strip.world = self
	dialogue_strip.visible = false
	hud.add_child(dialogue_strip)

	stick_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	stick_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stick_layer.set_script(StickScript)
	stick_layer.set("world", self)
	hud.add_child(stick_layer)
	layout_minimap()

func _refresh_treasure_nodes_visibility() -> void:
	for tid: String in treasure_nodes.keys():
		var nd: Node2D = treasure_nodes[tid]
		if not is_instance_valid(nd):
			continue
		if opened_treasures.has(tid):
			nd.modulate = Color(0.55, 0.55, 0.58, 0.55)

func is_treasure_opened(tid: String) -> bool:
	return opened_treasures.has(tid)

func is_waystone_discovered(wid: String) -> bool:
	return discovered_waystones.has(wid)

func _refresh_waystone_nodes() -> void:
	for ws_item: Dictionary in waystones_data:
		var wid := str(ws_item.get("id", ""))
		var wnode: Node2D = waystone_nodes.get(wid, null)
		if not is_instance_valid(wnode):
			continue
		var disc := is_waystone_discovered(wid)
		var lbl := wnode.get_node_or_null("WsLbl") as Label
		if lbl != null:
			lbl.text = ("✦ KAMIEŃ SZLAKU: %s" % str(ws_item.get("title", ""))) if disc else ("◇ KAMIEŃ SZLAKU: %s (Podejdź)" % str(ws_item.get("title", "")))
			lbl.add_theme_color_override("font_color", Color(0.42, 0.98, 1.0) if disc else Color(0.84, 0.90, 0.98))

func _discover_waystone(ws_item: Dictionary) -> void:
	var wid := str(ws_item.get("id", ""))
	if wid.is_empty() or discovered_waystones.has(wid):
		return
	discovered_waystones[wid] = true
	_refresh_waystone_nodes()
	dispatch_server_action({"type": "discover_waystone", "waystoneId": wid})
	if combat_vfx != null and hero != null and combat_vfx.has_method("spawn_teleport_flash"):
		combat_vfx.spawn_teleport_flash(hero.position, _hero_race_key())
	if audio != null:
		audio.sfx("ui/portal", 0.88, 0.04)
	show_combat_toast("✦ Odkryto Kamień Szlaku: %s! Dostępny na Mapie [M]." % str(ws_item.get("title", wid)), Color(0.42, 0.98, 1.0))

func start_recall_to_capital() -> void:
	if in_interior or in_labyrinth:
		return
	if recall_channel > 0.0:
		return
	if hero_pos.distance_to(capital_center) <= safe_city_radius:
		show_combat_toast("Jesteś już w bezpiecznej stolicy!", Color(0.76, 0.92, 1.0))
		return
	if recall_cooldown > 0.05:
		show_combat_toast("Kamień Powrotu ładuje się jeszcze przez %d s." % int(ceil(recall_cooldown)), Color(1.0, 0.72, 0.42))
		return
	target_pos = Vector2(-1.0, -1.0)
	recall_channel = RECALL_CHANNEL_S
	if audio != null:
		audio.sfx("ui/portal", 0.72, 0.05)
	show_combat_toast("🌀 Kamień Powrotu (%.1f s) — nie ruszaj się i unikaj ciosów!" % RECALL_CHANNEL_S, Color(0.46, 0.96, 1.0))

func notify_hero_healed() -> void:
	for ag: Dictionary in live_agents:
		if str(ag.get("kind", "")) == "monster":
			ag["dmg_dealt_to_hero"] = 0

func snapshot_unsettled_damage() -> Array[Dictionary]:
	var entries: Array[Dictionary] = []
	_capture_damage(live_agents, entries)
	if in_labyrinth and is_instance_valid(labyrinth_room):
		_capture_damage(labyrinth_room.guardians, entries)
	return entries

func _capture_damage(agents: Array, entries: Array[Dictionary]) -> void:
	for agent: Dictionary in agents:
		var amount := int(agent.get("dmg_dealt_to_hero", 0))
		if amount > 0:
			entries.append({"agent": agent, "amount": amount})

func settle_potion_damage(before: Array[Dictionary], healed: int) -> int:
	var remaining := healed
	for entry: Dictionary in before:
		var agent: Dictionary = entry["agent"]
		var current := int(agent.get("dmg_dealt_to_hero", 0))
		var settled := mini(remaining, mini(current, int(entry["amount"])))
		agent["dmg_dealt_to_hero"] = current - settled
		remaining -= settled
	var outstanding := 0
	for entry: Dictionary in snapshot_unsettled_damage():
		outstanding += int(entry["amount"])
	return outstanding

func show_combat_toast(msg: String, col: Color = Color(1.0, 0.90, 0.44)) -> void:
	combat_toast_lbl.text = msg
	combat_toast_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	combat_toast_lbl.add_theme_color_override("font_color", col)
	var vp := get_viewport_rect().size
	var left_x := 492.0
	var right_x := maxf(vp.x - 306.0, left_x + 240.0)
	combat_toast_lbl.size = Vector2(right_x - left_x, 56.0)
	combat_toast_lbl.position = Vector2(left_x, 18.0)
	combat_toast_lbl.visible = not (in_interior or in_labyrinth)
	combat_toast_t = 3.8

func recent_world_combat() -> bool:
	return world_time - last_combat_time < 8.0

func _show_campfire_rest(title: String) -> void:
	notify_hero_healed()
	if combat_vfx != null and hero != null:
		combat_vfx.spawn_heal_aura(hero.position, Color(0.38, 0.98, 0.62))
	if hero != null and hero.has_method("show_damage_number"):
		hero.show_damage_number("+100% HP / KI", Color(0.42, 1.0, 0.64), true)
	if audio != null:
		audio.sfx("ui/open", 0.85)
	show_combat_toast("🔥 Odpoczynek przy %s — odzyskano 100%% HP i KI!" % title, Color(0.46, 0.98, 0.68))

func _mark_gathered(gid: String) -> void:
	gatherable_cd[gid] = 90.0
	var node: Node2D = gatherable_nodes.get(gid, null)
	if is_instance_valid(node):
		node.modulate = Color(0.46, 0.46, 0.50, 0.42)
		if combat_vfx != null:
			combat_vfx.spawn_heal_aura(node.position, Color(1.0, 0.88, 0.34))

func interact_gatherable(g: Dictionary) -> void:
	var gid := str(g.get("id", ""))
	if gid.is_empty() or _gather_pending.has(gid) or float(gatherable_cd.get(gid, 0.0)) > 0.0:
		return
	var gkind := str(g.get("kind", "gather"))
	var gtitle := str(g.get("title", "Surowiec"))
	var is_camp := gkind == "campfire"
	if is_camp and recent_world_combat():
		show_combat_toast("Odpocznij po zakończeniu walki.", Color(1.0, 0.58, 0.38))
		return
	if hero != null and hero.has_method("play_action"):
		hero.play_action("interact", "victory", 0.55)
	if is_server_authoritative():
		var region_load := _region_load_id
		var point := {"x": hero_pos.x, "z": hero_pos.y}
		var payload := {"type": "campfire_rest", "siteId": gid, "position": point} if is_camp else {
			"type": "gather_node", "nodeId": gid, "land": current_land, "position": point,
		}
		_gather_pending[gid] = true
		dispatch_server_action(payload, func(res: Dictionary) -> void:
			_gather_pending.erase(gid)
			if region_load != _region_load_id:
				return
			if not bool(res.get("ok", false)):
				show_combat_toast(str(res.get("notice", "")), Color(1.0, 0.58, 0.38))
			elif is_camp:
				gatherable_cd[gid] = 8.0
				_show_campfire_rest(gtitle)
			else:
				_mark_gathered(gid)
				if audio != null:
					audio.sfx("crafting/harvest-ore", 0.84, 0.07)
				show_combat_toast(str(res.get("notice", "")), Color(0.78, 0.94, 0.56))
		)
		return
	if is_camp:
		gatherable_cd[gid] = 8.0
		if rpg_hud != null:
			rpg_hud.hero_hp = rpg_hud.hero_max_hp
			rpg_hud.hero_ki = rpg_hud.hero_max_ki
			rpg_hud._sync_bar_uniforms()
			rpg_hud._refresh_visuals()
		_show_campfire_rest(gtitle)
	else:
		_mark_gathered(gid)
		var rxp := int(g.get("xp", 22))
		var rgold := int(g.get("gold", 12))
		var item_id := str(g.get("item_id", gid))
		var iname := str(g.get("item_name", gtitle))
		var iicon := str(g.get("icon", "emblem_scroll.webp"))
		if rpg_hud != null:
			rpg_hud.hero_gold += rgold
			if rpg_hud.has_method("add_item_to_backpack"):
				var cat_it: Dictionary = GmPanelScript.find_item(item_id)
				if not cat_it.is_empty():
					rpg_hud.add_item_to_backpack(cat_it, 1)
				else:
					rpg_hud.add_item_to_backpack({
						"id": item_id,
						"name": iname,
						"cat": "material",
						"icon": iicon,
						"desc": "Surowiec zebrany na kontynencie %s" % current_land.capitalize(),
						"rarity": Color(0.54, 0.96, 0.68),
					}, 1)
			if rpg_hud.has_method("grant_local_xp"):
				var lvl_up: bool = rpg_hud.grant_local_xp(rxp)
				if lvl_up and audio != null:
					audio.sfx("common/level-up", 0.95, 0.03)
			else:
				rpg_hud._refresh_visuals()
		if hero != null and hero.has_method("show_damage_number"):
			hero.show_damage_number("+1 %s" % iname, Color(1.0, 0.92, 0.42), false)
		if audio != null:
			audio.sfx("crafting/harvest-ore", 0.84, 0.07)
		show_combat_toast("✦ Zebrano: %s (+%d PD, +%d zł)" % [iname, rxp, rgold], Color(0.56, 0.98, 0.72))
	sync_hero()

func claim_treasure_reward(tr: Dictionary, lab_id: String = "", on_done: Callable = Callable()) -> bool:
	var tid := str(tr.get("id", ""))
	if tid.is_empty() or opened_treasures.has(tid) or _treasure_pending.has(tid):
		return false
	var req_lv := maxi(1, int(tr.get("min_level", 1)))
	var hero_lv: int = int(rpg_hud.hero_level) if rpg_hud != null else 1
	if not gm_noclip and hero_lv < req_lv:
		if audio != null:
			audio.sfx("ui/locked", 0.85, 0.04)
		show_combat_toast("🔒 Wymagany Poziom %d, aby otworzyć: %s (masz Poz. %d)!" % [req_lv, str(tr.get("title", "Skarb")), hero_lv], Color(1.0, 0.45, 0.32))
		return false
	if is_server_authoritative():
		var region_load := _region_load_id
		var point: Vector2 = labyrinth_room.hero_px if not lab_id.is_empty() and labyrinth_room != null else hero_pos
		var payload := {"type": "claim_treasure", "treasureId": tid, "position": {"x": point.x, "z": point.y}}
		if not lab_id.is_empty():
			payload["labyrinthId"] = lab_id
		_treasure_pending[tid] = true
		dispatch_server_action(payload, func(res: Dictionary) -> void:
			_treasure_pending.erase(tid)
			if region_load != _region_load_id:
				return
			var ok := bool(res.get("ok", false))
			var notice := str(res.get("notice", ""))
			if ok:
				if hero != null and hero.has_method("play_action"):
					hero.play_action("interact", "victory", 0.55)
				if audio != null:
					audio.sfx("ui/chest", 0.92, 0.04)
			if on_done.is_valid():
				on_done.call(notice)
			else:
				show_combat_toast(notice, Color(1.0, 0.92, 0.40) if ok else Color(1.0, 0.58, 0.38))
			sync_hero()
		)
		return true
	opened_treasures[tid] = true
	_refresh_treasure_nodes_visibility()
	if hero != null and hero.has_method("play_action"):
		hero.play_action("interact", "victory", 0.55)
	var rgold := int(tr.get("gold", 150))
	var rxp := int(tr.get("xp", 95))
	var ritem := str(tr.get("item_id", ""))
	if rpg_hud != null:
		rpg_hud.hero_gold += rgold
		if not ritem.is_empty() and rpg_hud.has_method("add_item_to_backpack"):
			var cat_it: Dictionary = GmPanelScript.find_item(ritem)
			if not cat_it.is_empty():
				rpg_hud.add_item_to_backpack(cat_it, 1)
		if rpg_hud.has_method("grant_local_xp"):
			var lvl_up: bool = rpg_hud.grant_local_xp(rxp)
			if lvl_up and audio != null:
				audio.sfx("common/level-up", 0.95, 0.03)
		else:
			rpg_hud._refresh_visuals()
	if audio != null:
		audio.sfx("ui/chest", 0.92, 0.04)
	show_combat_toast("★ ODKRYTO SKARB: %s (+%d zł, +%d PD)" % [str(tr.get("title", "Skarb")), rgold, rxp], Color(1.0, 0.92, 0.40))
	sync_hero()
	return true

func _clear_ground_loot() -> void:
	for d: Dictionary in ground_loot:
		var nd = d.get("node", null)
		if is_instance_valid(nd):
			nd.queue_free()
	ground_loot.clear()

func _ground_loot_point(origin: Vector2) -> Vector2:
	var base_angle := randf() * TAU
	if origin.distance_to(hero_pos) < 44.0 and not origin.is_equal_approx(hero_pos):
		base_angle = (origin - hero_pos).angle()
	for step in 16:
		var angle := base_angle + TAU * float(step) / 16.0
		var point := origin + Vector2.from_angle(angle) * 32.0
		if is_walkable(point.x, point.y) and point.distance_to(hero_pos) > LOOT_PICKUP_RADIUS:
			return point
	return origin

func spawn_ground_loot(origin_world: Vector2, kind: String, label_txt: String, col: Color, icon_name: String, gold_val: int = 0, item_dict: Dictionary = {}, item_qty: int = 1, apply_local: bool = false, is_rare_beam: bool = false, server_drop: Dictionary = {}) -> void:
	var dest_w := _ground_loot_point(origin_world) if server_drop.is_empty() else Vector2(float(server_drop["x"]), float(server_drop["z"]))
	var start_s := iso(origin_world.x, origin_world.y, height_at(origin_world.x, origin_world.y))
	var dest_s := iso(dest_w.x, dest_w.y, height_at(dest_w.x, dest_w.y))

	var root_n := Node2D.new()
	root_n.position = start_s
	root_n.z_index = 2

	# Diablo-style pulsing ground halo + vertical rarity beam
	var fx_n := Node2D.new()
	fx_n.draw.connect(func() -> void:
		fx_n.draw_set_transform(Vector2(0, 2), 0.0, Vector2(1.0, 0.44))
		fx_n.draw_circle(Vector2.ZERO, 28.0 if is_rare_beam else 21.0, Color(col.r, col.g, col.b, 0.28))
		fx_n.draw_arc(Vector2.ZERO, 26.0 if is_rare_beam else 19.0, 0.0, TAU, 24, Color(col.r, col.g, col.b, 0.86), 2.5, true)
		fx_n.draw_set_transform(Vector2.ZERO)
		if is_rare_beam:
			fx_n.draw_rect(Rect2(-6.0, -104.0, 12.0, 104.0), Color(col.r, col.g, col.b, 0.28), true)
			fx_n.draw_rect(Rect2(-2.2, -88.0, 4.4, 88.0), Color(1.0, 0.96, 0.84, 0.56), true)
	)
	root_n.add_child(fx_n)

	# Crisp item/coin icon sprite
	var icon_n := Sprite2D.new()
	var tex := load_tex("res://assets/ui/icons/" + icon_name)
	if tex != null:
		icon_n.texture = tex
		var sz := maxf(float(tex.get_width()), float(tex.get_height()))
		if sz > 1.0:
			var sc := (40.0 if is_rare_beam else 33.0) / sz
			icon_n.scale = Vector2(sc, sc)
	icon_n.position = Vector2(0.0, -16.0)
	root_n.add_child(icon_n)

	# Diablo-style readable loot nameplate (big outlined label for mobile screens)
	var lbl := Label.new()
	lbl.text = label_txt
	lbl.position = Vector2(-130.0, -58.0 if is_rare_beam else -50.0)
	lbl.size = Vector2(260.0, 28.0)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_font_override("font", MapStyle.body_font())
	lbl.add_theme_font_size_override("font_size", 17 if is_rare_beam else 16)
	lbl.add_theme_color_override("font_color", col)
	lbl.add_theme_color_override("font_outline_color", Color(0.02, 0.015, 0.02, 0.98))
	lbl.add_theme_constant_override("outline_size", 6)
	root_n.add_child(lbl)

	ysort.add_child(root_n)
	ground_loot.append({
		"node": root_n,
		"icon": icon_n,
		"kind": kind,
		"label": label_txt,
		"color": col,
		"start_s": start_s,
		"dest_s": dest_s,
		"world_pos": dest_w,
		"gold": gold_val,
		"item": item_dict,
		"qty": item_qty,
		"server_drop": server_drop,
		"apply_local": apply_local,
		"age": 0.0,
	})

func _step_ground_loot(delta: float) -> void:
	if ground_loot.is_empty():
		return
	var alive: Array[Dictionary] = []
	for d: Dictionary in ground_loot:
		var nd: Node2D = d.get("node", null)
		if not is_instance_valid(nd):
			continue
		var age := float(d["age"]) + delta
		d["age"] = age
		if age > 120.0:
			nd.queue_free()
			continue
		if age < 0.36:
			var f := age / 0.36
			var p_lin: Vector2 = (d["start_s"] as Vector2).lerp(d["dest_s"] as Vector2, f)
			var arc_y := -sin(f * PI) * 48.0
			nd.position = p_lin + Vector2(0.0, arc_y)
		else:
			var bob := sin(age * 4.0) * 3.5
			var ico_n = d.get("icon", null)
			if is_instance_valid(ico_n):
				ico_n.position.y = -16.0 + bob
			nd.position = d["dest_s"]
			var drop: Dictionary = d["server_drop"]
			if not drop.is_empty():
				if bool(drop.get("removed", false)):
					nd.queue_free()
				else:
					if age >= 0.45:
						try_pickup_server_loot(drop, hero_pos, func(notice: String, success: bool) -> void:
							show_combat_toast(notice, Color(1.0, 0.88, 0.28) if success else Color(1.0, 0.58, 0.38))
						)
					alive.append(d)
				continue
			if age >= 0.45 and hero_pos.distance_to(d["world_pos"] as Vector2) <= LOOT_PICKUP_RADIUS:
				var col: Color = d["color"]
				if str(d["kind"]) == "gold":
					var gv := int(d["gold"])
					if bool(d["apply_local"]) and rpg_hud != null and gv > 0:
						rpg_hud.hero_gold += gv
						rpg_hud._refresh_visuals()
					if audio != null:
						audio.sfx("ui/coin", 0.80, 0.06)
					if hero != null and hero.has_method("show_damage_number"):
						hero.show_damage_number("+%d zł" % gv, Color(1.0, 0.90, 0.28), false)
				else:
					var it_d: Dictionary = d["item"]
					var q := int(d["qty"])
					if bool(d["apply_local"]) and rpg_hud != null and not it_d.is_empty() and rpg_hud.has_method("add_item_to_backpack"):
						if not rpg_hud.add_item_to_backpack(it_d, q):
							alive.append(d)
							continue
					if audio != null:
						audio.sfx("ui/chest", 0.78, 0.06)
					if hero != null and hero.has_method("show_damage_number"):
						hero.show_damage_number("+%d %s" % [q, str(it_d.get("name", d["label"]))], col, false)
				nd.queue_free()
				continue
		alive.append(d)
	ground_loot = alive

func server_loot_label(drop: Dictionary) -> String:
	var parts := PackedStringArray()
	var gold := int(drop.get("gold", 0))
	if gold > 0:
		parts.append("%d zł" % gold)
	for item: Dictionary in drop.get("items", []):
		var iid := str(item["id"])
		var item_def: Dictionary = GmPanelScript.find_item(iid)
		parts.append("%s ×%d" % [str(item_def.get("name", iid)), int(item["qty"])])
	return " • ".join(parts)

func try_pickup_server_loot(drop: Dictionary, position: Vector2, feedback: Callable) -> void:
	var point := Vector2(float(drop["x"]), float(drop["z"]))
	if position.distance_to(point) > LOOT_PICKUP_RADIUS:
		drop.erase("step_away")
		return
	if bool(drop.get("pending", false)) or bool(drop.get("step_away", false)) or Time.get_ticks_msec() < int(drop.get("retry_at", 0)):
		return
	var payload := {
		"type": "pickup_loot",
		"token": str(drop["token"]),
		"land": str(drop["land"]),
		"position": {"x": position.x, "z": position.y},
	}
	if drop.has("room"):
		payload["room"] = str(drop["room"])
	drop["pending"] = true
	dispatch_server_action(payload, func(res: Dictionary) -> void:
		drop["pending"] = false
		var ok := bool(res.get("ok", false))
		var code := str(res.get("errorCode", ""))
		drop["removed"] = ok or code == "NOT_FOUND"
		if ok and audio != null:
			audio.sfx("ui/chest" if not (drop.get("items", []) as Array).is_empty() else "ui/coin", 0.80)
		if code == "BACKPACK_FULL":
			drop["step_away"] = true
		drop["retry_at"] = Time.get_ticks_msec() + 1800
		if feedback.is_valid():
			feedback.call(str(res.get("notice", "")), ok)
	)

func request_pve_defeat(target_id: String, point: Vector2, hp_cost: int, resolved: Callable) -> bool:
	return dispatch_server_action({
		"type": "pve_defeat",
		"targetId": target_id,
		"land": current_land,
		"drop": {"x": point.x, "z": point.y},
		"hpCost": clampi(hp_cost, 0, 5000),
	}, resolved)

func _report_surface_defeat(agent_id: String, origin: Vector2, hp_cost: int, elite: bool) -> bool:
	var region_load := _region_load_id
	return request_pve_defeat(agent_id, _ground_loot_point(origin), hp_cost, func(res: Dictionary) -> void:
		if region_load != _region_load_id:
			return
		var drop: Dictionary = res.get("lootDrop", {})
		var ok := bool(res.get("ok", false))
		if ok and not drop.is_empty():
			var items: Array = drop.get("items", [])
			var def: Dictionary = GmPanelScript.find_item(str(items[0]["id"])) if not items.is_empty() else {}
			var icon := str(def.get("icon", "gear-coin.webp"))
			spawn_ground_loot(origin, "gold" if items.is_empty() else "item", server_loot_label(drop), Color(1.0, 0.88, 0.28), icon, 0, {}, 0, false, elite, drop)
		show_combat_toast(str(res.get("notice", "")), Color(1.0, 0.84, 0.42) if ok else Color(1.0, 0.55, 0.36))
	)

func report_monster_kill(spawn_id: String, lvl: int, mname: String, hp_cost: int = 0, is_elite: bool = false, drop_pos: Vector2 = Vector2(-1.0, -1.0)) -> void:
	var base_xp := (18 + lvl * 7) * (3 if is_elite else 1)
	var hero_lv: int = int(rpg_hud.hero_level) if rpg_hud != null else 1
	var lv_diff := hero_lv - lvl
	var rxp := maxi(5, int(round(float(base_xp) * 0.25))) if lv_diff >= 5 else (maxi(8, int(round(float(base_xp) * 0.50))) if lv_diff >= 3 else base_xp)
	var rgold := (8 + lvl * 4) * (3 if is_elite else 1)
	var loot_origin := drop_pos if drop_pos.x >= 0.0 else hero_pos
	if _report_surface_defeat(spawn_id, loot_origin, hp_cost, is_elite):
		return
	if rpg_hud != null:
		# Offline/local mode: spawn physical Diablo drops that credit gold & items on walk-over!
		spawn_ground_loot(loot_origin, "gold", "★ %d Złota" % rgold, Color(1.0, 0.88, 0.28), "gear-coin.webp", rgold, {}, 1, true, is_elite)
		if is_elite:
			var core_it: Dictionary = GmPanelScript.find_item("mat_elite_core")
			if not core_it.is_empty():
				spawn_ground_loot(loot_origin, "item", "★ %s" % str(core_it.get("name", "Rdzeń Elity")), Color(0.96, 0.56, 1.0), str(core_it.get("icon", "emblem_crystal.webp")), 0, core_it, 1, true, true)
			var pot_it: Dictionary = GmPanelScript.find_item("potion_hp")
			if not pot_it.is_empty():
				spawn_ground_loot(loot_origin, "item", "★ %s" % str(pot_it.get("name", "Eliksir")), Color(1.0, 0.48, 0.42), str(pot_it.get("icon", "potion-hp.webp")), 0, pot_it, 1, true, false)
		elif randf() < 0.35:
			var pot_n: Dictionary = GmPanelScript.find_item("potion_hp")
			if not pot_n.is_empty():
				spawn_ground_loot(loot_origin, "item", "★ %s" % str(pot_n.get("name", "Eliksir")), Color(1.0, 0.48, 0.42), str(pot_n.get("icon", "potion-hp.webp")), 0, pot_n, 1, true, false)
		if rpg_hud.has_method("grant_local_xp"):
			var lvl_up: bool = rpg_hud.grant_local_xp(rxp)
			if lvl_up and audio != null:
				audio.sfx("common/level-up", 0.95, 0.03)
		else:
			rpg_hud._refresh_visuals()
	if is_elite:
		show_combat_toast("★ POKONANO ELITĘ: %s! (+%d PD) — podejdź po łup!" % [mname, rxp], Color(1.0, 0.86, 0.24))
	else:
		show_combat_toast("⚔ Pokonano: %s (Poz.%d) • +%d PD — łup na ziemi!" % [mname, lvl, rxp], Color(1.0, 0.78, 0.36))

func handle_hero_defeat() -> void:
	if in_labyrinth:
		exit_labyrinth()
	recall_channel = 0.0
	if audio != null:
		audio.sfx("common/player-death", 0.95)
	if hero != null and hero.has_method("set_ki_mode"):
		ki_mode_timer = 0.0
		hero.set_ki_mode(false)
	if hero != null and hero.has_method("play_action"):
		hero.play_action("death", "hitheavy", 0.70)
	for ag: Dictionary in live_agents:
		if str(ag.get("kind", "")) == "monster":
			ag["cur_hp"] = int(ag.get("max_hp", 200))
			ag["dmg_dealt_to_hero"] = 0
			ag["atk_cd"] = 0.0
			ag["was_aggro"] = false
			var mnd = ag.get("node", null)
			if is_instance_valid(mnd):
				mnd.hp_ratio = 1.0
				mnd.queue_redraw()
	if not dispatch_server_action({"type": "hero_defeat"}):
		if rpg_hud != null:
			rpg_hud.hero_xp = maxf(0.0, floor(rpg_hud.hero_xp * 0.90))
			rpg_hud.hero_hp = maxf(1.0, round(rpg_hud.hero_max_hp * 0.65))
			rpg_hud.hero_ki = maxf(0.0, round(rpg_hud.hero_max_ki * 0.65))
			rpg_hud._sync_bar_uniforms()
			rpg_hud._refresh_visuals()
		teleport_to_capital()
		if hero != null and hero.has_method("play_action"):
			hero.play_action("respawn", "interact", 0.65)
		if audio != null:
			audio.sfx("common/respawn", 0.85)
	show_combat_toast("☠ PORAŻKA W WALCE! Tracisz 10% PD i budzisz się w bezpiecznej stolicy.", Color(1.0, 0.36, 0.28))

func _hero_race_key() -> String:
	if rpg_hud != null and rpg_hud.has_method("_race_key"):
		return str(rpg_hud._race_key())
	return str({"pyra": "legend", "verdant": "planetary", "aether": "sage", "nexus": "android"}.get(hero_race_land if hero_race_land != "" else current_land, "legend"))

func _hero_aim_screen_dir(best_idx: int) -> Vector2:
	if best_idx >= 0 and hero != null:
		var mnd = live_agents[best_idx].get("node", null)
		if is_instance_valid(mnd):
			var d: Vector2 = (mnd.position as Vector2) - (hero.position as Vector2)
			if d.length_squared() > 1.0:
				return d.normalized()
	var dir_map := {
		"right": Vector2(1.0, 0.0), "down-right": Vector2(0.7, 0.7), "down": Vector2(0.0, 1.0),
		"down-left": Vector2(-0.7, 0.7), "left": Vector2(-1.0, 0.0), "up-left": Vector2(-0.7, -0.7),
		"up": Vector2(0.0, -1.0), "up-right": Vector2(0.7, -0.7),
	}
	var d_name := str(hero.direction) if hero != null else "down-right"
	return dir_map.get(d_name, Vector2(0.7, 0.7)) as Vector2

func _activate_ki_mode_visuals(race_k: String, duration_sec: float = 20.0) -> void:
	ki_mode_timer = duration_sec
	if hero != null and hero.has_method("set_ki_mode"):
		hero.ki_race = race_k
		if bool(hero.ki_mode_active):
			hero.set_ki_remaining(duration_sec)
			hero.play_action("kitransform", "kiskillc")
		else:
			hero.set_ki_mode(true, duration_sec)
	trigger_camera_shake(13.0, 0.60)
	if combat_vfx != null and hero != null:
		combat_vfx.spawn_transform_pillar(hero.position, race_k)
	if audio != null:
		if audio.has_method("play_transform_sfx"):
			audio.play_transform_sfx(race_k)
		else:
			audio.sfx("development/ki-charge", 0.95)
	show_combat_toast("✦ FORMA KI AKTYWNA (%ds) — +25%% ATK, +15%% DEF, +10%% SPD i aura KI!" % int(round(duration_sec)), Color(0.42, 0.98, 1.0))

func activate_ki_mode_gm(duration_sec: float = 20.0) -> void:
	if not can_use_gm():
		return
	_gm_ki_preview = true
	_activate_ki_mode_visuals(_hero_race_key(), duration_sec)

func perform_combat_attack(skill_idx: int, surge_mult: float = 1.0) -> void:
	if in_labyrinth and labyrinth_room != null and labyrinth_room.has_method("perform_labyrinth_attack"):
		labyrinth_room.perform_labyrinth_attack()
		return
	if in_interior or map_expanded or atlas_expanded:
		return
	recall_channel = 0.0
	var race_k := _hero_race_key()
	var is_ranged_race := race_k in ["sage", "android"]
	var passives: Dictionary = rpg_hud.get_talent_passives() if (rpg_hud != null and rpg_hud.has_method("get_talent_passives")) else {}
	var range_mult := 1.0 + float(passives.get("rangeMult", 0.0))
	var base_reach := (220.0 if is_ranged_race else 125.0) if skill_idx == 0 else (290.0 if skill_idx == 5 else 250.0)
	var reach := base_reach * range_mult
	var mult := 1.0 if skill_idx == 0 else (1.45 if skill_idx < 4 else (1.85 if skill_idx == 4 else 2.25))
	mult *= (1.0 + float(passives.get("dmgMult", 0.0))) * maxf(surge_mult, 1.0)
	if skill_idx == 1 and float(passives.get("burnBonus", 0.0)) > 0.0:
		mult *= (1.0 + float(passives.get("burnBonus", 0.0)))
	if ki_mode_timer > 0.0:
		mult *= 1.25
	var base_atk := 34
	if rpg_hud != null and rpg_hud.has_method("get_total_attack"):
		base_atk = int(rpg_hud.get_total_attack())

	# Find nearest alive monster OR wildlife animal (and all in AoE for skill 3 / skill 5 Ki burst)
	var best_idx := -1
	var best_d := reach
	var hit_indices: Array[int] = []
	for idx in live_agents.size():
		var ag: Dictionary = live_agents[idx]
		var ag_k := str(ag.get("kind", ""))
		if (ag_k != "monster" and ag_k != "animal") or not bool(ag.get("alive", true)):
			continue
		var d := hero_pos.distance_to(ag["pos"] as Vector2)
		if d < best_d:
			best_d = d
			best_idx = idx
		if (skill_idx == 5 or skill_idx == 3) and d < reach:
			hit_indices.append(idx)

	# Face target immediately before playing attack/skill animation
	if best_idx >= 0 and hero != null:
		var tpos: Vector2 = live_agents[best_idx]["pos"]
		var dv := tpos - hero_pos
		var s_face := Vector2(dv.x - dv.y, (dv.x + dv.y) * 0.5)
		if s_face.length_squared() > 0.01 and hero.has_method("face"):
			hero.face(s_face)

	var aim_dir := _hero_aim_screen_dir(best_idx)
	var target_node = live_agents[best_idx].get("node", null) if best_idx >= 0 else null

	# ALWAYS play full 47-clip hero combat animation, racial VFX & skill SFX (even on air swing!)
	if skill_idx == 5:
		if rpg_hud != null and rpg_hud.has_method("is_hotbar_skill_unlocked") and not rpg_hud.is_hotbar_skill_unlocked(5):
			show_combat_toast("Forma KI [T] odblokowuje się od poz. 20 w drzewku [K] (wymaga A9, B9 lub C9)!", Color(1.0, 0.68, 0.34))
			return
		_gm_ki_preview = false
		_activate_ki_mode_visuals(race_k, 20.0)
	elif skill_idx == 0:
		var combo_clips := ["attack", "attack2", "attack3", "finisher"]
		var cur_step := combo_step % 4
		var chosen := str(combo_clips[cur_step])
		combo_step = (combo_step + 1) % 4
		combo_reset_t = 2.4
		if hero != null and hero.has_method("play_action"):
			hero.play_action(chosen, "attack")
		if combat_vfx != null and hero != null:
			if is_ranged_race and is_instance_valid(target_node):
				combat_vfx.spawn_bolt(hero.position, target_node.position, race_k, 1.0)
			else:
				combat_vfx.spawn_slash(hero.position, aim_dir, race_k, 1.15 if cur_step == 3 else 0.92, cur_step % 2 == 1)
		if audio != null:
			audio.play_race_skill(race_k, "R")
	else:
		var sk_clips := ["sk_A1", "sk_B1", "sk_C1", "sk_A4"]
		var sk_fbs := ["skill", "skillb", "skillc", "finisher"]
		var sk_sfx := ["A1", "B1", "C1", "A4"]
		var si := clampi(skill_idx - 1, 0, 3)
		if hero != null and hero.has_method("play_action"):
			hero.play_action(str(sk_clips[si]), str(sk_fbs[si]))
		if combat_vfx != null and hero != null:
			if skill_idx == 1:
				combat_vfx.spawn_slash(hero.position, aim_dir, race_k, 1.38, false)
				if is_ranged_race and is_instance_valid(target_node):
					combat_vfx.spawn_bolt(hero.position, target_node.position, race_k, 1.25)
			elif skill_idx == 2:
				combat_vfx.spawn_shield_dome(hero.position, race_k)
				if hero.has_method("show_damage_number"):
					hero.show_damage_number("OSŁONA KI", Color(0.42, 0.94, 1.0), false)
			elif skill_idx == 3:
				combat_vfx.spawn_ki_burst(hero.position, race_k, 170.0)
			else:
				var end_pos: Vector2 = (target_node.position as Vector2) if is_instance_valid(target_node) else (hero.position + aim_dir * 135.0)
				combat_vfx.spawn_bolt(hero.position, end_pos, race_k, 1.35)
				combat_vfx.spawn_ki_burst(end_pos, race_k, 125.0)
		if audio != null:
			audio.play_race_skill(race_k, str(sk_sfx[si]))

	if skill_idx != 5 and skill_idx != 3 and best_idx >= 0:
		hit_indices = [best_idx]
	if hit_indices.is_empty():
		return

	last_combat_time = world_time
	var hero_lv: int = int(rpg_hud.hero_level) if rpg_hud != null else 1
	var crit_pct: float = float(rpg_hud.get_total_crit()) if (rpg_hud != null and rpg_hud.has_method("get_total_crit")) else 6.0
	var kill_heal_pct := float(passives.get("killHealPct", 0.0))
	var any_kill := false
	for h_idx: int in hit_indices:
		var target: Dictionary = live_agents[h_idx]
		var is_animal := (str(target.get("kind", "")) == "animal")
		var m_lvl := int(target.get("level", 1))
		var is_el := bool(target.get("is_elite", false))
		var lv_penalty := 0.65 if (m_lvl - hero_lv >= 3) else 1.0
		var is_crit := randf() * 100.0 < crit_pct
		var crit_mult := 1.55 if is_crit else 1.0
		var dmg := maxi(8, int(round(float(base_atk) * mult * lv_penalty * crit_mult * randf_range(0.92, 1.18))))
		target["cur_hp"] = maxi(0, int(target.get("cur_hp", 200)) - dmg)
		var mnode = target.get("node", null)
		if is_crit:
			trigger_camera_shake(4.5, 0.14)
		if audio != null:
			audio.sfx("common/hit-crit" if is_crit else "common/hit", 0.82)
		if is_instance_valid(mnode):
			mnode.hp_ratio = clampf(float(target["cur_hp"]) / maxf(float(target["max_hp"]), 1.0), 0.0, 1.0)
			mnode.queue_redraw()
			if combat_vfx != null:
				combat_vfx.spawn_impact(mnode.position, race_k, is_crit)
			if mnode.has_method("show_damage_number"):
				var tag := "KRYT! -" if is_crit else "-"
				var dcol := Color(1.0, 0.86, 0.22) if is_crit else Color(1.0, 0.42, 0.26)
				mnode.show_damage_number("%s%d" % [tag, dmg], dcol, is_crit)
		if int(target["cur_hp"]) <= 0:
			any_kill = true
			var hp_cost := int(target.get("dmg_dealt_to_hero", 0))
			target["dmg_dealt_to_hero"] = 0
			target["alive"] = false
			target["was_aggro"] = false
			target["death_hide_t"] = 0.85
			target["respawn_t"] = 22.0 if is_animal else (45.0 if is_el else 11.0)
			if kill_heal_pct > 0.0 and rpg_hud != null:
				rpg_hud.hero_hp = minf(rpg_hud.hero_max_hp, rpg_hud.hero_hp + rpg_hud.hero_max_hp * kill_heal_pct)
			if is_instance_valid(mnode):
				mnode.hp_ratio = 0.0
				if is_el and combat_vfx != null:
					combat_vfx.spawn_ki_burst(mnode.position, race_k, 145.0)
				if mnode.has_method("play_action"):
					mnode.play_action("death", "hit", 0.85)
			if audio != null:
				audio.play_monster_sfx(str(target.get("actor_id", "")), "die")
			if is_animal:
				if not _report_surface_defeat(str(target["id"]), target["pos"] as Vector2, hp_cost, false):
					_report_local_animal_kill(target)
			else:
				report_monster_kill(str(target["id"]), m_lvl, str(target.get("name", "Potwór")), hp_cost, is_el, target["pos"] as Vector2)
		else:
			if is_instance_valid(mnode) and mnode.has_method("play_action"):
				mnode.play_action("hit", "hit", 0.28)
	if any_kill and skill_idx != 5 and hero != null and hero.has_method("play_action"):
		hero.play_action("victory", "interact", 0.55)

func _report_local_animal_kill(target: Dictionary) -> void:
	var aname := str(target.get("name", "Zwierzę"))
	var agold := randi_range(6, 14)
	var axp := 14
	spawn_ground_loot(target["pos"] as Vector2, "gold", "★ %d Złota" % agold, Color(1.0, 0.88, 0.28), "gear-coin.webp", agold, {}, 1, true, false)
	if randf() < 0.45:
		var hpot: Dictionary = GmPanelScript.find_item("potion_hp_small")
		if not hpot.is_empty():
			spawn_ground_loot(target["pos"] as Vector2, "item", "★ %s" % str(hpot.get("name", "Mikstura")), Color(1.0, 0.52, 0.42), str(hpot.get("icon", "potion-hp.webp")), 0, hpot, 1, true, false)
	if rpg_hud != null and rpg_hud.has_method("grant_local_xp"):
		var lvl_up: bool = rpg_hud.grant_local_xp(axp)
		if lvl_up and audio != null:
			audio.sfx("common/level-up", 0.95, 0.03)
	show_combat_toast("⚔ Upolowano: %s (+%d PD) — podejdź po łup!" % [aname, axp], Color(1.0, 0.84, 0.42))

func open_npc_dialogue(ag: Dictionary) -> void:
	if ag.is_empty() or dialogue_strip == null:
		return
	active_talk_agent = ag
	var node = ag.get("node", null)
	dialogue_strip.open_dialogue({
		"id": str(ag.get("id", "")),
		"name": str(ag.get("name", "Mieszkaniec")),
		"role": str(ag.get("role", "Obywatel")),
		"quest_mark": str(ag.get("quest_mark", "")),
		"land": current_land,
		"actor": node,
		"is_interior": false,
	})
	btn_talk_npc.visible = false

func open_interior_dialogue(npc_name: String, b_title: String, b_role: String, actor_node, service_cb: Callable) -> void:
	if dialogue_strip == null:
		return
	active_talk_agent = {}
	dialogue_strip.open_dialogue({
		"id": b_role,
		"name": npc_name,
		"role": b_title,
		"quest_mark": "",
		"land": current_land,
		"actor": actor_node,
		"is_interior": true,
		"building_role": b_role,
		"service_cb": service_cb,
	})

func enter_labyrinth_by_id(lab_id: String) -> void:
	if labyrinth_room == null:
		return
	var found: Dictionary = {}
	for lab: Dictionary in labyrinths_data:
		if str(lab.get("id", "")) == lab_id:
			found = lab
			break
	if found.is_empty():
		return
	var req_lv := maxi(1, int(found.get("level", 6)))
	var hero_lv: int = int(rpg_hud.hero_level) if rpg_hud != null else 1
	if not gm_noclip and hero_lv < req_lv:
		if audio != null:
			audio.sfx("ui/locked", 0.85, 0.04)
		show_combat_toast("🔒 Wymagany Poziom %d, aby wejść do: %s (masz Poz. %d)!" % [req_lv, str(found.get("title", "Labirynt")), hero_lv], Color(1.0, 0.45, 0.32))
		return
	if audio != null:
		audio.sfx("ui/portal", 0.88, 0.04)
	if dialogue_strip != null:
		dialogue_strip.close_dialogue(false)
	active_talk_agent = {}
	in_labyrinth = true
	in_interior = false
	map_expanded = false
	atlas_expanded = false
	gm_open = false
	if rpg_hud != null and rpg_hud.has_method("close_modals"):
		rpg_hud.close_modals()
	target_pos = Vector2(-1.0, -1.0)
	motion = Vector2.ZERO
	move_pointer = -1
	labyrinth_room.enter_labyrinth(current_land, found)
	layout_minimap()
	stick_layer.queue_redraw()

func exit_labyrinth() -> void:
	if not in_labyrinth:
		return
	if audio != null:
		audio.sfx("ui/portal", 0.85, 0.04)
	in_labyrinth = false
	if labyrinth_room != null:
		labyrinth_room.visible = false
	motion = Vector2.ZERO
	move_pointer = -1
	target_pos = Vector2(-1.0, -1.0)
	layout_minimap()
	sync_hero()
	stick_layer.queue_redraw()

func enter_building(b: Dictionary) -> void:
	if b.is_empty():
		return
	if str(b.get("role", "")) == "labyrinth":
		enter_labyrinth_by_id(str(b.get("labyrinth_id", b.get("id", ""))))
		return
	if interior_room == null:
		return
	if audio != null:
		audio.sfx("common/door")
	if dialogue_strip != null:
		dialogue_strip.close_dialogue(false)
	active_talk_agent = {}
	in_interior = true
	map_expanded = false
	atlas_expanded = false
	gm_open = false
	if rpg_hud != null and rpg_hud.has_method("close_modals"):
		rpg_hud.close_modals()
	target_pos = Vector2(-1.0, -1.0)
	motion = Vector2.ZERO
	move_pointer = -1
	interior_room.enter_building(current_land, b)
	layout_minimap()
	stick_layer.queue_redraw()

func exit_building() -> void:
	if not in_interior:
		return
	if dialogue_strip != null:
		dialogue_strip.close_dialogue(false)
	if audio != null:
		audio.sfx("common/door")
	active_talk_agent = {}
	in_interior = false
	motion = Vector2.ZERO
	move_pointer = -1
	target_pos = Vector2(-1.0, -1.0)
	layout_minimap()
	sync_hero()
	stick_layer.queue_redraw()

func cycle_time_of_day() -> void:
	if atmosphere != null:
		var lbl: String = str(atmosphere.cycle_time_mode())
		if rpg_hud != null:
			rpg_hud.set_time_label(lbl)

func layout_minimap() -> void:
	var vp := get_viewport_rect().size
	if in_interior or in_labyrinth:
		if interior_room != null:
			interior_room.visible = in_interior
		if labyrinth_room != null:
			labyrinth_room.visible = in_labyrinth
		if rpg_hud != null:
			rpg_hud.visible = false
		if atmosphere != null:
			atmosphere.visible = false
		if premium_minimap != null:
			premium_minimap.visible = false
		if map_3d != null:
			map_3d.visible = false
		if atlas_overlay != null:
			atlas_overlay.visible = false
		if gm_panel != null:
			gm_panel.visible = false
		btn_enter_bldg.visible = false
		btn_talk_npc.visible = false
		btn_open_treasure.visible = false
		btn_gather.visible = false
		combat_toast_lbl.visible = false
		if stick_layer != null:
			stick_layer.visible = true
		return
	if interior_room != null:
		interior_room.visible = false
	if labyrinth_room != null:
		labyrinth_room.visible = false
	var show_world_ui := not (map_expanded or atlas_expanded)
	var menu_open: bool = game_menu != null and bool(game_menu.visible)
	var q_open: bool = quest_journal != null and bool(quest_journal.visible)
	var hud_edit_on: bool = rpg_hud != null and bool(rpg_hud.get("hud_edit_mode"))
	var rpg_modal_open: bool = gm_open or menu_open or q_open or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character)))
	var dlg_open: bool = dialogue_strip != null and bool(dialogue_strip.is_open)
	if rpg_hud != null:
		rpg_hud.visible = show_world_ui and not (menu_open or q_open or gm_open or dlg_open)
		rpg_hud.z_index = 90 if hud_edit_on else 0
	if atmosphere != null:
		atmosphere.visible = show_world_ui
	if map_expanded:
		var rect := Rect2(Vector2(64.0, 28.0), Vector2(vp.x - 128.0, vp.y - 56.0))
		map_3d.position = rect.position
		map_3d.size = rect.size
		map_3d.visible = true
		if premium_minimap != null:
			premium_minimap.visible = false
	else:
		map_3d.visible = false
		if premium_minimap != null:
			premium_minimap.visible = show_world_ui and not rpg_modal_open
			if "map_tex_rect" in premium_minimap and premium_minimap.map_tex_rect != null:
				premium_minimap.map_tex_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE if hud_edit_on else Control.MOUSE_FILTER_STOP
			var m_off := Vector2.ZERO
			var m_sc := 1.0
			if rpg_hud != null and rpg_hud.has_method("get_zone_offset"):
				m_off = rpg_hud.get_zone_offset("minimap")
				m_sc = float(rpg_hud.get_hud_scale())
			premium_minimap.scale = Vector2(m_sc, m_sc)
			var mw := 276.0 * m_sc
			var mh := 256.0 * m_sc
			premium_minimap.position = Vector2(
				clampf(vp.x - mw - 12.0 + m_off.x, 8.0, maxf(vp.x - mw - 8.0, 8.0)),
				clampf(10.0 + m_off.y, 8.0, maxf(vp.y - mh - 8.0, 8.0))
			)
	if stick_layer != null:
		stick_layer.visible = show_world_ui and not rpg_modal_open and not hud_edit_on
	if atlas_overlay != null:
		atlas_overlay.position = Vector2(16, 14)
		atlas_overlay.size = Vector2(vp.x - 32, vp.y - 28)
		atlas_overlay.visible = atlas_expanded
	if gm_panel != null:
		gm_panel.visible = gm_open and show_world_ui
	if combat_toast_lbl != null and (not show_world_ui or rpg_modal_open or hud_edit_on):
		combat_toast_lbl.visible = false
	_layout_world_prompts(vp, show_world_ui and not rpg_modal_open and not dlg_open and not hud_edit_on)

func _layout_world_prompts(vp: Vector2, allow: bool) -> void:
	var stack_y := vp.y - 168.0
	var bw := clampf(vp.x * 0.38, 320.0, 480.0)
	btn_enter_bldg.visible = allow and not nearest_enterable.is_empty()
	if btn_enter_bldg.visible:
		btn_enter_bldg.size = Vector2(bw, 62.0)
		btn_enter_bldg.position = Vector2((vp.x - bw) * 0.5, stack_y)
		stack_y -= 70.0
	btn_open_treasure.visible = allow and not nearest_treasure.is_empty()
	if btn_open_treasure.visible:
		btn_open_treasure.size = Vector2(bw, 62.0)
		btn_open_treasure.position = Vector2((vp.x - bw) * 0.5, stack_y)
		stack_y -= 70.0
	btn_gather.visible = allow and not nearest_gatherable.is_empty()
	if btn_gather.visible:
		btn_gather.size = Vector2(bw, 62.0)
		btn_gather.position = Vector2((vp.x - bw) * 0.5, stack_y)
		stack_y -= 70.0
	var tw := clampf(vp.x * 0.34, 290.0, 420.0)
	btn_talk_npc.visible = allow and not nearest_npc_agent.is_empty()
	if btn_talk_npc.visible:
		btn_talk_npc.size = Vector2(tw, 60.0)
		btn_talk_npc.position = Vector2((vp.x - tw) * 0.5, stack_y)

func notify_audio_changed(mv: float, sv: float, av: float = -1.0) -> void:
	initial_music_vol = mv
	initial_sfx_vol = sv
	if av >= 0.0:
		initial_ambience_vol = av
	if audio_settings_fn.is_valid():
		if audio_settings_fn.get_argument_count() >= 3:
			audio_settings_fn.call(mv, sv, initial_ambience_vol)
		else:
			audio_settings_fn.call(mv, sv)

func notify_hud_layout_changed(layout: Dictionary) -> void:
	initial_hud_layout = layout.duplicate(true)
	layout_minimap()
	if hud_layout_changed_fn.is_valid():
		hud_layout_changed_fn.call(initial_hud_layout)

func start_hud_editor() -> void:
	if game_menu != null and bool(game_menu.visible):
		game_menu.close_menu()
	if rpg_hud != null and rpg_hud.has_method("enter_hud_editor"):
		rpg_hud.enter_hud_editor()
		layout_minimap()

func request_change_character() -> void:
	if return_to_char_select_fn.is_valid():
		return_to_char_select_fn.call()

func request_logout() -> void:
	if logout_fn.is_valid():
		logout_fn.call()

func request_quit_game() -> void:
	if quit_game_fn.is_valid():
		quit_game_fn.call()
	else:
		get_tree().quit()

func toggle_game_menu(force_open: Variant = null) -> void:
	if game_menu == null:
		return
	var next_v: bool = (not bool(game_menu.visible)) if force_open == null else bool(force_open)
	if next_v:
		gm_open = false
		map_expanded = false
		atlas_expanded = false
		if rpg_hud != null and bool(rpg_hud.get("hud_edit_mode")) and rpg_hud.has_method("exit_hud_editor"):
			rpg_hud.exit_hud_editor(true)
		if rpg_hud != null and rpg_hud.has_method("close_modals"):
			rpg_hud.close_modals()
		if quest_journal != null and bool(quest_journal.visible):
			quest_journal.visible = false
		motion = Vector2.ZERO
		move_pointer = -1
		game_menu.open_menu()
	else:
		game_menu.close_menu()
	layout_minimap()
	if rpg_hud != null:
		rpg_hud._refresh_visuals()

func open_world_map_on_hero() -> void:
	if in_interior or in_labyrinth:
		return
	if game_menu != null and bool(game_menu.visible):
		game_menu.close_menu()
	if quest_journal != null and bool(quest_journal.visible):
		quest_journal.visible = false
	if rpg_hud != null and rpg_hud.has_method("close_modals"):
		rpg_hud.close_modals()
	if atlas_overlay != null and atlas_overlay.has_method("focus_on_hero"):
		atlas_overlay.focus_on_hero(3.8)
	if audio != null:
		audio.sfx("ui/map-open", 0.85, 0.04)
	toggle_atlas(true)

func handle_back_request() -> bool:
	if rpg_hud != null and bool(rpg_hud.get("hud_edit_mode")) and rpg_hud.has_method("exit_hud_editor"):
		rpg_hud.exit_hud_editor(true)
		layout_minimap()
		return true
	if game_menu != null and bool(game_menu.visible):
		toggle_game_menu(false)
		return true
	if dialogue_strip != null and bool(dialogue_strip.is_open):
		dialogue_strip.close_dialogue(true)
		return true
	if in_interior:
		if interior_room != null and bool(interior_room.service_open):
			interior_room.toggle_service_panel(false)
		else:
			exit_building()
		return true
	if in_labyrinth:
		exit_labyrinth()
		return true
	if atlas_expanded:
		toggle_atlas(false)
		return true
	if map_expanded:
		toggle_map()
		return true
	if gm_open:
		toggle_gm_panel(false)
		return true
	if quest_journal != null and bool(quest_journal.visible):
		quest_journal.toggle_journal()
		layout_minimap()
		return true
	if rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character)):
		rpg_hud.close_modals()
		return true
	# Walking in the world -> open real Game Menu (never abruptly kills the game!)
	toggle_game_menu(true)
	return true

func toggle_quest_journal() -> void:
	if quest_journal != null:
		if game_menu != null and bool(game_menu.visible):
			game_menu.close_menu()
		quest_journal.toggle_journal()
		layout_minimap()
		if rpg_hud != null:
			rpg_hud._refresh_visuals()

func can_use_gm() -> bool:
	return gm_access_fn.is_valid() and bool(gm_access_fn.call())

func _refresh_gm_access() -> void:
	var allowed := can_use_gm()
	if allowed == _had_gm_access:
		return
	_had_gm_access = allowed
	if not allowed:
		gm_open = false
		gm_speed_mult = 1.0
		gm_noclip = false
		gm_map_teleport_mode = false
		gm_minimap_teleport = false
		if _gm_ki_preview:
			_gm_ki_preview = false
			ki_mode_timer = 0.0
			if hero != null:
				hero.set_ki_mode(false)
		layout_minimap()
		if atlas_overlay != null:
			atlas_overlay._refresh_mode_buttons()
			atlas_overlay.queue_redraw()
	if rpg_hud != null:
		rpg_hud._refresh_visuals()

func toggle_gm_panel(force_open: Variant = null) -> void:
	if (force_open == null or bool(force_open)) and not can_use_gm():
		return
	if in_interior or in_labyrinth:
		return
	var next_v: bool = (not gm_open) if force_open == null else bool(force_open)
	gm_open = next_v
	if gm_open:
		map_expanded = false
		atlas_expanded = false
		if game_menu != null and bool(game_menu.visible):
			game_menu.close_menu()
		if rpg_hud != null:
			rpg_hud.close_modals()
		if gm_panel != null:
			gm_panel.refresh_content()
	layout_minimap()
	if rpg_hud != null:
		rpg_hud._refresh_visuals()

func toggle_map() -> void:
	if in_interior or in_labyrinth:
		return
	if atlas_expanded:
		atlas_expanded = false
	if gm_open:
		gm_open = false
	map_expanded = not map_expanded
	layout_minimap()
	stick_layer.queue_redraw()

func toggle_atlas(open: bool) -> void:
	if (in_interior or in_labyrinth) and open:
		return
	atlas_expanded = open
	if atlas_expanded:
		map_expanded = false
		gm_open = false
	else:
		gm_map_teleport_mode = false
	layout_minimap()
	if atlas_overlay != null:
		atlas_overlay.sync_live_hero()
	stick_layer.queue_redraw()

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		handle_back_request()
		return
	if game_menu != null and bool(game_menu.visible):
		return
	if rpg_hud != null and bool(rpg_hud.get("hud_edit_mode")):
		return
	if in_labyrinth:
		if event is InputEventScreenTouch:
			handle_touch(event)
		elif event is InputEventScreenDrag:
			handle_drag(event)
		return
	if in_interior:
		if event is InputEventScreenTouch:
			handle_touch(event)
		elif event is InputEventScreenDrag:
			handle_drag(event)
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if (event.keycode == KEY_F1 or event.keycode == KEY_P) and can_use_gm():
			toggle_gm_panel()
			return
		elif event.keycode == KEY_R:
			if not nearest_npc_agent.is_empty():
				open_npc_dialogue(nearest_npc_agent)
				return
			elif rpg_hud != null:
				rpg_hud.trigger_skill(5)
				return
		elif event.keycode == KEY_F or event.keycode == KEY_ENTER:
			if not nearest_enterable.is_empty():
				enter_building(nearest_enterable)
				return
			elif not nearest_treasure.is_empty():
				claim_treasure_reward(nearest_treasure, "")
				return
			elif not nearest_gatherable.is_empty():
				interact_gatherable(nearest_gatherable)
				return
		elif event.keycode == KEY_M:
			if atlas_expanded:
				toggle_atlas(false)
			else:
				open_world_map_on_hero()
			return
		elif event.keycode == KEY_T:
			cycle_time_of_day()
			return
		elif event.keycode == KEY_K:
			if rpg_hud != null:
				rpg_hud.toggle_talents()
			return
		elif event.keycode == KEY_I:
			if rpg_hud != null:
				rpg_hud.toggle_character()
			return
		elif event.keycode == KEY_J:
			toggle_quest_journal()
			return
		elif event.keycode == KEY_Q:
			if rpg_hud != null:
				rpg_hud.trigger_skill(0)
			return
		elif event.keycode == KEY_SPACE:
			if rpg_hud != null:
				rpg_hud.trigger_skill(5)
			return
		elif event.keycode == KEY_Z:
			if premium_minimap != null:
				premium_minimap.toggle_zoom_mode()
			return
		elif event.keycode == KEY_G:
			if atlas_overlay != null:
				atlas_overlay.set_mode("globe")
			toggle_atlas(not atlas_expanded)
			return
		elif event.keycode == KEY_TAB:
			if atlas_expanded:
				toggle_atlas(false)
			else:
				open_world_map_on_hero()
			return
		elif event.keycode == KEY_E:
			cycle_exp_zone()
			return
		elif event.keycode == KEY_C:
			if gm_noclip:
				teleport_to_capital()
			else:
				start_recall_to_capital()
			return
		elif event.keycode == KEY_H:
			if rpg_hud != null and not rpg_hud.use_quick_hp_potion():
				show_combat_toast("Brak eliksirów życia w plecaku.", Color(1.0, 0.56, 0.36))
			return
		elif event.keycode == KEY_1:
			if rpg_hud != null:
				rpg_hud.trigger_skill(1)
			return
		elif event.keycode == KEY_2:
			if rpg_hud != null:
				rpg_hud.trigger_skill(2)
			return
		elif event.keycode == KEY_3:
			if rpg_hud != null:
				rpg_hud.trigger_skill(3)
			return
		elif event.keycode == KEY_4:
			if rpg_hud != null:
				rpg_hud.trigger_skill(4)
			return
		elif event.keycode == KEY_EQUAL or event.keycode == KEY_PLUS:
			set_zoom(zoom_level * 1.12)
		elif event.keycode == KEY_MINUS:
			set_zoom(zoom_level / 1.12)
	if gm_open or (quest_journal != null and bool(quest_journal.visible)) or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character))):
		return
	if map_expanded:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
			toggle_map()
		return
	if atlas_expanded:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
			toggle_atlas(false)
		return
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			set_zoom(zoom_level * 1.1)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			set_zoom(zoom_level / 1.1)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			var world_click: Vector2 = get_canvas_transform().affine_inverse() * event.position
			for ag: Dictionary in live_agents:
				if str(ag.get("kind", "")) != "npc":
					continue
				var nd = ag.get("node", null)
				if is_instance_valid(nd) and world_click.distance_to(nd.position + Vector2(0, -32)) < 68.0:
					if hero_pos.distance_to(ag["pos"] as Vector2) < 95.0:
						open_npc_dialogue(ag)
						return
			if event.position.x > get_viewport_rect().size.x * 0.38:
				target_pos = screen_to_ground(world_click)
	elif event is InputEventScreenTouch:
		handle_touch(event)
	elif event is InputEventScreenDrag:
		handle_drag(event)

func handle_touch(event: InputEventScreenTouch) -> void:
	var vp := get_viewport_rect().size
	if event.pressed:
		# Strict bottom-left thumb zone ONLY (never activates over top-left HUD or right combat orbs!)
		var in_thumb_zone := (
			event.position.x >= 16.0
			and event.position.x <= vp.x * 0.36
			and event.position.y >= vp.y * 0.48
			and event.position.y <= vp.y - 16.0
		)
		if in_thumb_zone and move_pointer == -1:
			move_pointer = event.index
			move_origin = Vector2(
				clampf(event.position.x, 82.0, maxf(vp.x * 0.32, 92.0)),
				clampf(event.position.y, vp.y * 0.52, maxf(vp.y - 82.0, vp.y * 0.54))
			)
			motion = Vector2.ZERO
			target_pos = Vector2(-1, -1)
		else:
			pinch_pointers[event.index] = event.position
			if pinch_pointers.size() == 2:
				pinch_distance = pinch_span()
	else:
		if event.index == move_pointer:
			move_pointer = -1
			motion = Vector2.ZERO
		pinch_pointers.erase(event.index)
		if pinch_pointers.size() < 2:
			pinch_distance = 0.0
	stick_layer.queue_redraw()

func handle_drag(event: InputEventScreenDrag) -> void:
	if event.index == move_pointer:
		var delta := event.position - move_origin
		var mag := delta.length()
		if mag < JOYSTICK_DEADZONE_PX:
			motion = Vector2.ZERO
		else:
			var scaled := clampf((mag - JOYSTICK_DEADZONE_PX) / (JOYSTICK_MAX_RADIUS_PX - JOYSTICK_DEADZONE_PX), 0.0, 1.0)
			motion = delta.normalized() * scaled
		stick_layer.queue_redraw()
	elif pinch_pointers.has(event.index):
		pinch_pointers[event.index] = event.position
		if pinch_pointers.size() == 2 and pinch_distance > 10.0:
			var span := pinch_span()
			set_zoom(zoom_level * (span / pinch_distance))
			pinch_distance = span

func pinch_span() -> float:
	var keys := pinch_pointers.keys()
	return (pinch_pointers[keys[0]] as Vector2).distance_to(pinch_pointers[keys[1]] as Vector2)

func set_zoom(z: float) -> void:
	zoom_level = clampf(z, 0.65, 2.80)
	camera.zoom = Vector2(zoom_level, zoom_level)

func _process(delta: float) -> void:
	_refresh_gm_access()
	if combat_toast_t > 0.0:
		combat_toast_t -= delta
		if combat_toast_t <= 0.0:
			combat_toast_lbl.visible = false
	if is_booting or in_interior or in_labyrinth:
		return
	if game_menu != null and bool(game_menu.visible):
		return
	if rpg_hud != null and bool(rpg_hud.get("hud_edit_mode")):
		return
	step_world(delta)

func _step_agent_patrol(ag: Dictionary, delta: float, move_speed: float, is_monster: bool) -> Vector2:
	var home: Vector2 = ag["home"]
	var prev_p: Vector2 = ag["pos"]
	var st := str(ag.get("ai_state", "idle"))
	var timer := float(ag.get("ai_timer", 2.0)) - delta
	if st == "idle":
		ag["ai_timer"] = timer
		if timer <= 0.0:
			var max_r := clampf(float(ag.get("radius", 20.0)), 12.0, 34.0)
			var picked := false
			for _attempt in 6:
				var ang := randf() * TAU
				var dist := randf_range(10.0, max_r)
				var cand := home + Vector2(cos(ang), sin(ang)) * dist
				if cand.distance_to(prev_p) < 8.0:
					continue
				if is_monster and cand.distance_to(capital_center) <= safe_city_radius + 18.0:
					continue
				if is_walkable(cand.x, cand.y):
					ag["ai_target"] = cand
					ag["ai_state"] = "walk"
					ag["ai_timer"] = 4.8
					picked = true
					break
			if not picked:
				ag["ai_timer"] = randf_range(2.4, 5.0)
		return prev_p
	# Walking straight toward waypoint at natural steady velocity (eliminates one-leg jitter & glide!)
	var target: Vector2 = ag.get("ai_target", home)
	var diff := target - prev_p
	var dist_left := diff.length()
	if dist_left <= 2.4 or timer <= 0.0:
		ag["ai_state"] = "idle"
		ag["ai_timer"] = randf_range(2.8, 6.2)
		return prev_p
	var step_v := diff.normalized() * minf(move_speed * delta, dist_left)
	var cand_p := prev_p + step_v
	if is_monster and cand_p.distance_to(capital_center) <= safe_city_radius + 16.0:
		ag["ai_state"] = "idle"
		ag["ai_timer"] = randf_range(2.5, 5.0)
		return prev_p
	if not is_walkable(cand_p.x, cand_p.y):
		ag["ai_state"] = "idle"
		ag["ai_timer"] = randf_range(2.2, 4.8)
		return prev_p
	ag["ai_timer"] = timer
	return cand_p

func step_world(delta: float) -> void:
	world_time += delta
	if recall_cooldown > 0.0:
		recall_cooldown = maxf(0.0, recall_cooldown - delta)
	if camera_shake_t > 0.0:
		camera_shake_t = maxf(0.0, camera_shake_t - delta)
		var decay := camera_shake_t / maxf(camera_shake_dur, 0.05)
		var amp := camera_shake_amp * decay * decay
		camera.offset = Vector2(sin(world_time * 74.0) * amp, cos(world_time * 91.0) * amp * 0.72) if camera_shake_t > 0.0 else Vector2.ZERO
	elif camera.offset != Vector2.ZERO:
		camera.offset = Vector2.ZERO
	if _ocean_cross_cd > 0.0:
		_ocean_cross_cd = maxf(0.0, _ocean_cross_cd - delta)
	if combo_reset_t > 0.0:
		combo_reset_t = maxf(0.0, combo_reset_t - delta)
		if combo_reset_t <= 0.0:
			combo_step = 0
	if ki_mode_timer > 0.0:
		ki_mode_timer = maxf(0.0, ki_mode_timer - delta)
		if hero != null and hero.has_method("set_ki_remaining"):
			hero.set_ki_remaining(ki_mode_timer)
		if ki_mode_timer <= 0.0 and hero != null and hero.has_method("set_ki_mode"):
			hero.set_ki_mode(false)
			if rpg_hud != null:
				rpg_hud._refresh_visuals()
	if rpg_hud != null and rpg_hud.has_method("is_perf_hud_enabled") and rpg_hud.is_perf_hud_enabled():
		_ping_poll_t += delta
		if _ping_poll_t >= 4.0:
			_ping_poll_t = 0.0
			trigger_server_ping()
	if not gatherable_cd.is_empty():
		var expired: Array[String] = []
		for gid: String in gatherable_cd.keys():
			var rem := float(gatherable_cd[gid]) - delta
			if rem <= 0.0:
				expired.append(gid)
			else:
				gatherable_cd[gid] = rem
		for gid: String in expired:
			gatherable_cd.erase(gid)
			var gnode: Node2D = gatherable_nodes.get(gid, null)
			if is_instance_valid(gnode):
				gnode.modulate = Color.WHITE

	var key_dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		key_dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		key_dir.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		key_dir.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		key_dir.y += 1.0
	var screen_dir := motion if move_pointer != -1 else key_dir.normalized()
	var move_mag := clampf(screen_dir.length(), 0.0, 1.0)
	var world_dir := Vector2.ZERO
	if screen_dir.length_squared() > 0.001:
		target_pos = Vector2(-1, -1)
		world_dir = Vector2(screen_dir.x + screen_dir.y, screen_dir.y - screen_dir.x).normalized()
	elif target_pos.x >= 0.0:
		var diff := target_pos - hero_pos
		if diff.length() < 1.2:
			target_pos = Vector2(-1, -1)
		else:
			world_dir = diff.normalized()
			screen_dir = Vector2(world_dir.x - world_dir.y, (world_dir.x + world_dir.y) * 0.5).normalized()
			move_mag = 1.0
	var is_moving := world_dir.length_squared() > 0.001
	var is_running := move_mag >= 0.58

	# Return-to-Capital Stone (Kamień Powrotu) channeling
	if recall_channel > 0.0:
		if is_moving:
			recall_channel = 0.0
			show_combat_toast("Kamień Powrotu przerwany przez ruch.", Color(1.0, 0.72, 0.42))
		else:
			recall_channel = maxf(0.0, recall_channel - delta)
			if recall_channel <= 0.0:
				recall_cooldown = RECALL_COOLDOWN_S
				teleport_to_capital()
				show_combat_toast("✦ Kamień Powrotu przeniósł Cię do stolicy!", Color(0.46, 0.98, 1.0))

	if is_moving:
		var stat_spd_mult := 1.0
		if rpg_hud != null and rpg_hud.has_method("get_speed_mult"):
			stat_spd_mult = float(rpg_hud.get_speed_mult())
		var outside_city := hero_pos.distance_to(capital_center) > safe_city_radius
		var road_mult := 1.10 if (outside_city and is_on_road(hero_pos.x, hero_pos.y)) else 1.0
		var ki_spd_mult := 1.10 if ki_mode_timer > 0.0 else 1.0
		var analog_mult := lerpf(0.45, 1.0, move_mag)
		try_move(world_dir * SPEED * analog_mult * gm_speed_mult * stat_spd_mult * road_mult * ki_spd_mult * delta)

	# Out-of-Combat passive HP/KI recovery (+4% HP/s + talent bonus, +6% KI/s after 5s OOC)
	if world_time - last_combat_time >= 5.0 and rpg_hud != null and float(rpg_hud.hero_hp) > 0.0:
		var ooc_hp_bonus := 0.0
		if rpg_hud.has_method("get_talent_passives"):
			ooc_hp_bonus = float((rpg_hud.get_talent_passives() as Dictionary).get("oocHpRegenBonus", 0.0))
		var regenerated := false
		if float(rpg_hud.hero_hp) < float(rpg_hud.hero_max_hp):
			rpg_hud.hero_hp = minf(float(rpg_hud.hero_max_hp), float(rpg_hud.hero_hp) + float(rpg_hud.hero_max_hp) * (0.04 + ooc_hp_bonus) * delta)
			regenerated = true
			if float(rpg_hud.hero_hp) >= float(rpg_hud.hero_max_hp) - 0.5:
				notify_hero_healed()
		if float(rpg_hud.hero_ki) < float(rpg_hud.hero_max_ki):
			rpg_hud.hero_ki = minf(float(rpg_hud.hero_max_ki), float(rpg_hud.hero_ki) + float(rpg_hud.hero_max_ki) * 0.06 * delta)
			regenerated = true
		if regenerated:
			rpg_hud._sync_bar_uniforms()
			rpg_hud._refresh_visuals()

	# Auto-discover nearby Fast-Travel Waystones (within 72m)
	for ws_item: Dictionary in waystones_data:
		var wid := str(ws_item.get("id", ""))
		if not discovered_waystones.has(wid):
			var wpos := Vector2(float(ws_item.get("x", 0.0)), float(ws_item.get("z", 0.0)))
			if hero_pos.distance_to(wpos) <= 72.0:
				_discover_waystone(ws_item)

	var in_safe_now := hero_pos.distance_to(capital_center) <= safe_city_radius
	if audio != null:
		audio.step(delta, is_moving, current_land, false, is_running, is_in_water(hero_pos.x, hero_pos.y), in_safe_now)
		audio.play_ambience(current_land, in_safe_now)
	if hero != null:
		hero.animate(screen_dir, is_running, lerpf(0.62, 1.0, move_mag))
	sync_hero()
	_step_ground_loot(delta)

	var dlg_open: bool = dialogue_strip != null and bool(dialogue_strip.is_open)
	var talk_node = active_talk_agent.get("node", null) if dlg_open else null

	# Auto-close outdoor dialogue smoothly if hero walks away (> 72m)
	if dlg_open and not active_talk_agent.is_empty():
		var tpos: Vector2 = active_talk_agent.get("pos", hero_pos)
		if hero_pos.distance_to(tpos) > 72.0:
			dialogue_strip.close_dialogue(true)
			active_talk_agent = {}
			dlg_open = false
			talk_node = null

	var hero_in_safe := hero_pos.distance_to(capital_center) <= safe_city_radius
	var modal_pauses_combat := (
		gm_open
		or map_expanded
		or atlas_expanded
		or dlg_open
		or (quest_journal != null and bool(quest_journal.visible))
		or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character)))
	)
	var cam_p := camera.position
	var vp_sz := get_viewport_rect().size
	var inv_z := 1.0 / maxf(zoom_level, 0.45)
	var ag_cull_x := vp_sz.x * 0.56 * inv_z + 320.0
	var ag_cull_y := vp_sz.y * 0.56 * inv_z + 280.0

	# Animate living NPCs, Monsters, and Wildlife Fauna animals with natural Waypoint AI + 2-way combat + distance culling
	for idx in live_agents.size():
		var ag: Dictionary = live_agents[idx]
		var node = ag["node"]
		if not is_instance_valid(node):
			continue
		var ag_kind := str(ag.get("kind", "animal"))
		var is_monster := (ag_kind == "monster")
		var is_killable := (is_monster or ag_kind == "animal")
		if is_killable and not bool(ag.get("alive", true)):
			var dh := float(ag.get("death_hide_t", 0.0))
			if dh > 0.0:
				dh = maxf(0.0, dh - delta)
				ag["death_hide_t"] = dh
				if dh <= 0.0:
					node.visible = false
			ag["respawn_t"] = float(ag.get("respawn_t", 0.0)) - delta
			if float(ag["respawn_t"]) <= 0.0:
				ag["alive"] = true
				ag["cur_hp"] = int(ag.get("max_hp", 200))
				ag["dmg_dealt_to_hero"] = 0
				ag["atk_cd"] = 0.0
				ag["aggro_windup"] = 0.0
				ag["was_aggro"] = false
				ag["roared"] = false
				ag["pos"] = ag["home"]
				ag["ai_state"] = "idle"
				ag["ai_timer"] = randf_range(1.2, 3.2)
				node.hp_ratio = 1.0
				node.position = iso((ag["home"] as Vector2).x, (ag["home"] as Vector2).y, height_at((ag["home"] as Vector2).x, (ag["home"] as Vector2).y))
				node.queue_redraw()
				node.visible = true
				if node.has_method("play_action"):
					node.play_action("respawn", "idle", 0.55)
			continue
		if absf(node.position.x - cam_p.x) > ag_cull_x or absf(node.position.y - cam_p.y) > ag_cull_y:
			if node.visible:
				node.visible = false
			continue
		if not node.visible:
			node.visible = true
		if dlg_open and node == talk_node:
			var to_hero: Vector2 = hero_pos - (ag["pos"] as Vector2)
			var face_s := Vector2(to_hero.x - to_hero.y, (to_hero.x + to_hero.y) * 0.5)
			if face_s.length_squared() > 0.01:
				node.face(face_s)
			node.animate(Vector2.ZERO, false)
			continue
		var home: Vector2 = ag["home"]
		var prev_p: Vector2 = ag["pos"]
		var next_p := prev_p
		var stride := 0.62 if ag_kind == "npc" else 0.76
		if is_monster:
			ag["atk_cd"] = maxf(0.0, float(ag.get("atk_cd", 0.0)) - delta)
			ag["aggro_windup"] = maxf(0.0, float(ag.get("aggro_windup", 0.0)) - delta)
			var dist_to_hero := hero_pos.distance_to(prev_p)
			var dist_from_home := prev_p.distance_to(home)
			var was_hurt := int(ag.get("cur_hp", 100)) < int(ag.get("max_hp", 100))
			if not hero_in_safe and not modal_pauses_combat and ((dist_to_hero < 72.0) or (was_hurt and dist_to_hero < 145.0)) and dist_from_home < 165.0:
				stride = 0.96
				if not bool(ag.get("was_aggro", false)):
					ag["was_aggro"] = true
					ag["aggro_windup"] = 0.50
				if not bool(ag.get("roared", false)):
					ag["roared"] = true
					if audio != null and bool(ag.get("is_elite", false)):
						audio.play_monster_sfx(str(ag.get("actor_id", "")), "roar")
				if dist_to_hero > 26.0:
					var chase_step := (hero_pos - prev_p).normalized() * 21.0 * delta
					var cand_p := prev_p + chase_step
					if cand_p.distance_to(capital_center) > safe_city_radius + 16.0 and is_walkable(cand_p.x, cand_p.y):
						next_p = cand_p
				if hero_pos.distance_to(next_p) <= 50.0 and float(ag["atk_cd"]) <= 0.0 and float(ag["aggro_windup"]) <= 0.0:
					ag["atk_cd"] = 1.40
					ag["atk_count"] = int(ag.get("atk_count", 0)) + 1
					last_combat_time = world_time
					if recall_channel > 0.0:
						recall_channel = 0.0
						show_combat_toast("Powrót do stolicy przerwany przez obrażenia!", Color(1.0, 0.48, 0.34))
					var to_h: Vector2 = hero_pos - next_p
					var face_h := Vector2(to_h.x - to_h.y, (to_h.x + to_h.y) * 0.5)
					if face_h.length_squared() > 0.01 and node.has_method("face"):
						node.face(face_h)
					if node.has_method("play_action"):
						node.play_action("skill" if (int(ag["atk_count"]) % 3 == 0) else "attack", "attack")
					if audio != null:
						audio.play_monster_sfx(str(ag.get("actor_id", "")), "atk")
					var m_atk := int(ag.get("atk", 24))
					var m_lvl := int(ag.get("level", 1))
					var hero_lv: int = int(rpg_hud.hero_level) if rpg_hud != null else 1
					var hero_def := int(rpg_hud.get_total_defense()) if (rpg_hud != null and rpg_hud.has_method("get_total_defense")) else 12
					var adv_mult := 1.35 if (m_lvl - hero_lv >= 3) else 1.0
					var dmg := maxi(5, int(round(float(m_atk) * adv_mult - float(hero_def) * 0.55)))
					ag["dmg_dealt_to_hero"] = int(ag.get("dmg_dealt_to_hero", 0)) + dmg
					if audio != null:
						audio.sfx("common/player-hurt", 0.76)
					if hero != null:
						if hero.has_method("show_damage_number"):
							hero.show_damage_number("-%d" % dmg, Color(1.0, 0.34, 0.28), false)
						if Time.get_ticks_msec() / 1000.0 >= float(hero.one_shot_until) and hero.has_method("play_action"):
							hero.play_action("hitheavy" if dmg >= 35 else "hit", "hit", 0.28)
					if rpg_hud != null and rpg_hud.has_method("take_combat_damage") and rpg_hud.take_combat_damage(dmg):
						handle_hero_defeat()
						return
			else:
				ag["roared"] = false
				ag["was_aggro"] = false
				next_p = _step_agent_patrol(ag, delta, float(ag.get("speed", 13.0)), true)
		else:
			next_p = _step_agent_patrol(ag, delta, float(ag.get("speed", 10.5)), false)
		var d_pos := next_p - prev_p
		if d_pos.length_squared() > 0.0001:
			ag["pos"] = next_p
			node.position = iso(next_p.x, next_p.y, height_at(next_p.x, next_p.y))
			var s_dir := Vector2(d_pos.x - d_pos.y, (d_pos.x + d_pos.y) * 0.5)
			node.animate(s_dir if s_dir.length_squared() > 0.0004 else Vector2.ZERO, false, stride)
		else:
			node.animate(Vector2.ZERO, false, stride)

		# Layer 1: Ambient floating World Speech Bubbles only when hero walks close to an NPC
		if ag_kind == "npc" and world_time > 2.5:
			var dist_h := hero_pos.distance_to(next_p)
			var last_b: float = float(ag.get("last_bark_t", -99.0))
			if dist_h < 34.0 and world_time - last_b > 18.0:
				ag["last_bark_t"] = world_time
				if node.has_method("show_bubble"):
					var bark: String = DialogueStripScript.pick_ambient_bark(current_land, str(ag.get("role", "")), idx + int(world_time))
					node.show_bubble(bark, 4.0)

func _check_ocean_crossing() -> bool:
	if _ocean_cross_cd > 0.0:
		return false
	var edge := 36.0
	var dir_key := ""
	if hero_pos.x <= edge:
		dir_key = "west"
	elif hero_pos.x >= world_size - edge:
		dir_key = "east"
	elif hero_pos.y <= edge:
		dir_key = "north"
	elif hero_pos.y >= world_size - edge:
		dir_key = "south"
	if dir_key.is_empty():
		return false
	var neigh: Dictionary = OCEAN_NEIGHBORS.get(current_land, {})
	var next_land := str(neigh.get(dir_key, ""))
	if next_land.is_empty() or next_land == current_land:
		return false
	var keep_x := clampf(hero_pos.x, 220.0, world_size - 220.0)
	var keep_z := clampf(hero_pos.y, 220.0, world_size - 220.0)
	_ocean_cross_cd = 2.5
	switch_region(next_land)
	var dest := Vector2(world_size - 180.0, keep_z) if dir_key == "west" else (
		Vector2(180.0, keep_z) if dir_key == "east" else (
			Vector2(keep_x, world_size - 180.0) if dir_key == "north" else Vector2(keep_x, 180.0)
		)
	)
	hero_pos = dest
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	if combat_vfx != null and hero != null and combat_vfx.has_method("spawn_teleport_flash"):
		combat_vfx.spawn_teleport_flash(hero.position, _hero_race_key())
	if audio != null:
		audio.sfx("ui/portal", 0.80, 0.05)
	var cname := str(REGION_TITLES.get(next_land, next_land)).split("—")[0].strip_edges()
	show_combat_toast("⛵ Przeprawa morska → %s!" % cname, Color(0.46, 0.94, 1.0))
	return true

func try_move(step: Vector2) -> void:
	if gm_noclip:
		hero_pos = Vector2(clampf(hero_pos.x + step.x, 12.0, world_size - 12.0), clampf(hero_pos.y + step.y, 12.0, world_size - 12.0))
		_check_ocean_crossing()
		return
	var h_now := height_at(hero_pos.x, hero_pos.y)
	for candidate: Vector2 in [hero_pos + step, Vector2(hero_pos.x + step.x, hero_pos.y), Vector2(hero_pos.x, hero_pos.y + step.y)]:
		if is_walkable(candidate.x, candidate.y) and absf(height_at(candidate.x, candidate.y) - h_now) < 5.5:
			hero_pos = candidate
			_check_ocean_crossing()
			return

var _last_cull_cam := Vector2(1e9, 1e9)
var _last_cull_zoom := -1.0

func _cull_props(force: bool = false) -> void:
	var cam_p := camera.position
	if not force and cam_p.distance_squared_to(_last_cull_cam) < 1600.0 and absf(zoom_level - _last_cull_zoom) < 0.02:
		return
	_last_cull_cam = cam_p
	_last_cull_zoom = zoom_level
	var vp := get_viewport_rect().size
	var inv_z := 1.0 / maxf(zoom_level, 0.45)
	var rx := vp.x * 0.56 * inv_z + 380.0
	var ry := vp.y * 0.56 * inv_z + 340.0
	# Frustum-cull the 64 spatial terrain chunks so mobile GPU only renders visible chunks (~3,000 tris vs 131,072!)
	var cam_rect := Rect2(cam_p - Vector2(rx + 180.0, ry + 180.0), Vector2((rx + 180.0) * 2.0, (ry + 180.0) * 2.0))
	for tc: Dictionary in terrain_chunks:
		var tnode: MeshInstance2D = tc["node"]
		if is_instance_valid(tnode):
			var want_v: bool = (tc["rect"] as Rect2).intersects(cam_rect)
			if tnode.visible != want_v:
				tnode.visible = want_v

	var min_cx := int(floor((cam_p.x - rx) / PROP_CHUNK_PX))
	var max_cx := int(floor((cam_p.x + rx) / PROP_CHUNK_PX))
	var min_cy := int(floor((cam_p.y - ry) / PROP_CHUNK_PX))
	var max_cy := int(floor((cam_p.y + ry) / PROP_CHUNK_PX))
	var next_chunks: Dictionary = {}
	for cy in range(min_cy, max_cy + 1):
		for cx in range(min_cx, max_cx + 1):
			var ck := Vector2i(cx, cy)
			if prop_chunks.has(ck):
				next_chunks[ck] = true
				if not _visible_prop_chunks.has(ck):
					for nd: Node2D in prop_chunks[ck]:
						if is_instance_valid(nd):
							nd.visible = true
	for old_ck: Vector2i in _visible_prop_chunks.keys():
		if not next_chunks.has(old_ck) and prop_chunks.has(old_ck):
			for nd: Node2D in prop_chunks[old_ck]:
				if is_instance_valid(nd):
					nd.visible = false
	_visible_prop_chunks = next_chunks

func sync_hero(force_scan: bool = false) -> void:
	var h := height_at(hero_pos.x, hero_pos.y)
	if hero != null:
		hero.position = iso(hero_pos.x, hero_pos.y, h)
		camera.position = hero.position + Vector2(0, -34)
	_cull_props(force_scan)
	if premium_minimap != null:
		premium_minimap.refresh()
	if atlas_overlay != null and atlas_expanded:
		atlas_overlay.sync_live_hero()

	var now_ms := Time.get_ticks_msec()
	if not force_scan and (now_ms - _last_sync_scan_ms) < 120 and hero_pos.distance_squared_to(_last_sync_scan_pos) < 16.0:
		return
	_last_sync_scan_ms = now_ms
	_last_sync_scan_pos = hero_pos

	var nearest := ""
	var best := 99999.0
	for lm: Dictionary in landmarks:
		var d := hero_pos.distance_to(Vector2(float(lm.x), float(lm.z)))
		if d < best:
			best = d
			nearest = str(lm.title)
	var in_safe := hero_pos.distance_to(capital_center) <= safe_city_radius
	if not in_safe and best > 260.0 and not sub_biomes.is_empty():
		var best_sb_d := 99999.0
		for sb: Dictionary in sub_biomes:
			var sd := hero_pos.distance_to(Vector2(float(sb.get("x", 0.0)), float(sb.get("z", 0.0))))
			if sd < best_sb_d:
				best_sb_d = sd
				nearest = str(sb.get("name", nearest))
	if rpg_hud != null:
		rpg_hud.sync_status(nearest, in_safe)

	# Detect nearest enterable building within 56m of its entrance or center
	var best_b: Dictionary = {}
	var best_bd := 56.0
	for b: Dictionary in buildings:
		if not bool(b.get("enterable", false)):
			continue
		var bx := float(b.get("x", 0.0))
		var bz := float(b.get("z", 0.0))
		var d := hero_pos.distance_to(Vector2(bx, bz))
		var ent = b.get("entrance", [])
		if ent is Array and ent.size() >= 2:
			d = minf(d, hero_pos.distance_to(Vector2(float(ent[0]), float(ent[1]))))
		if d < best_bd:
			best_bd = d
			best_b = b
	nearest_enterable = best_b

	# Detect nearest outdoor NPC within 34m for contextual "ROZMAWIAJ" pill
	var best_npc: Dictionary = {}
	var best_nd := 34.0
	for ag: Dictionary in live_agents:
		if str(ag.get("kind", "")) != "npc":
			continue
		var nd := hero_pos.distance_to(ag["pos"] as Vector2)
		if nd < best_nd:
			best_nd = nd
			best_npc = ag
	nearest_npc_agent = best_npc

	# Detect nearest unopened hidden world treasure within 58m
	var best_tr: Dictionary = {}
	var best_td := 58.0
	for tr: Dictionary in treasures_data:
		var tid := str(tr.get("id", ""))
		if opened_treasures.has(tid):
			continue
		var td := hero_pos.distance_to(Vector2(float(tr.get("x", 0.0)), float(tr.get("z", 0.0))))
		if td < best_td:
			best_td = td
			best_tr = tr
	nearest_treasure = best_tr

	# Detect nearest ready wilderness gatherable or rest campfire within 56m
	var best_g: Dictionary = {}
	var best_gd := 56.0
	for g: Dictionary in gatherables_data:
		var gid := str(g.get("id", ""))
		if float(gatherable_cd.get(gid, 0.0)) > 0.0:
			continue
		var gd := hero_pos.distance_to(Vector2(float(g.get("x", 0.0)), float(g.get("z", 0.0))))
		if gd < best_gd:
			best_gd = gd
			best_g = g
	nearest_gatherable = best_g

	var show_world_ui := not (map_expanded or atlas_expanded or in_interior or in_labyrinth)
	var menu_open: bool = game_menu != null and bool(game_menu.visible)
	var q_open: bool = quest_journal != null and bool(quest_journal.visible)
	var rpg_modal_open: bool = gm_open or menu_open or q_open or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character)))
	var dlg_open: bool = dialogue_strip != null and bool(dialogue_strip.is_open)
	if not nearest_enterable.is_empty():
		var bprefix := "⚔ WEJDŹ DO LABIRYNTU: " if str(nearest_enterable.get("role", "")) == "labyrinth" else "▶ WEJDŹ: "
		btn_enter_bldg.text = "%s%s" % [bprefix, str(nearest_enterable.get("title", "Budynek"))]
	if not nearest_treasure.is_empty():
		btn_open_treasure.text = "★ OTWÓRZ SKARB: %s" % str(nearest_treasure.get("title", "Skarb"))
	if not nearest_gatherable.is_empty():
		var gkind := str(nearest_gatherable.get("kind", "gather"))
		btn_gather.text = ("🔥 ODPOCZNIJ: %s" % str(nearest_gatherable.get("title", "Ognisko"))) if gkind == "campfire" else ("✦ ZBIERZ: %s" % str(nearest_gatherable.get("title", "Surowiec")))
	if not nearest_npc_agent.is_empty():
		btn_talk_npc.text = "▶ ROZMAWIAJ: %s" % str(nearest_npc_agent.get("name", "NPC"))
	_layout_world_prompts(get_viewport_rect().size, show_world_ui and not rpg_modal_open and not dlg_open)

func snap(out_dir: String, file: String) -> String:
	for _i in 4:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	var path := out_dir.path_join(file)
	img.save_jpg(path, 0.93)
	return path

func _find_first_bridge_pos() -> Vector2:
	for b: Dictionary in buildings:
		if str(b.get("role", "")) == "bridge":
			return Vector2(float(b.get("x", capital_center.x)), float(b.get("z", capital_center.y)))
	return capital_center + Vector2(-180.0, 20.0)

func run_qa() -> void:
	var out_dir := OS.get_environment("ISO_QA_DIR")
	if out_dir.is_empty():
		out_dir = ProjectSettings.globalize_path("res://qa_out")
	DirAccess.make_dir_recursive_absolute(out_dir)

	var probe := capital_center
	var h := height_at(probe.x, probe.y)
	var roundtrip := unproject(iso(probe.x, probe.y, h), h)
	var roundtrip_err := probe.distance_to(roundtrip)

	var regions_report: Dictionary = {}
	var shots: Array = []

	var cap_shots := {
		"pyra": "pyra-citadel.jpg",
		"verdant": "verdant-harbor.jpg",
		"aether": "aether-sanctuary.jpg",
		"nexus": "nexus-core.jpg",
	}
	var town_shots := {
		"pyra": "pyra-town.jpg",
		"verdant": "verdant-town.jpg",
		"aether": "aether-town.jpg",
		"nexus": "nexus-town.jpg",
	}

	for land: String in REGION_ORDER:
		switch_region(land)
		set_zoom(0.58)
		# 1) Capital City view framed on paved central plaza showing 4-quarter planned city, planar streets to doors & rotating minimap
		var cap_view := capital_center + Vector2(0.0, 12.0)
		hero_pos = cap_view if is_walkable(cap_view.x, cap_view.y) else capital_center
		if premium_minimap != null:
			premium_minimap.set_heading_immediate(Vector2(0.62, -0.78))
		step_world(0.15)
		shots.append(await snap(out_dir, cap_shots[land]))

		# 2) Outer Town / Stronghold Castle Vista (ZERO monsters/exp-zones!)
		var towns_here: Array = []
		for b: Dictionary in buildings:
			if str(b.get("map_kind", "")) == "town":
				towns_here.append(b)
		if not towns_here.is_empty():
			var t_pick: Dictionary = towns_here[0]
			var ent = t_pick.get("entrance", [])
			if ent is Array and ent.size() >= 2:
				hero_pos = Vector2(float(ent[0]), float(ent[1]))
			else:
				hero_pos = Vector2(float(t_pick.get("x", 512.0)), float(t_pick.get("z", 512.0)) + 48.0)
			if premium_minimap != null:
				premium_minimap.set_heading_immediate(Vector2(-0.70, -0.70))
			step_world(0.25)
			shots.append(await snap(out_dir, town_shots[land]))

		var bridge_cnt := 0
		var enterable_cnt := 0
		for b: Dictionary in buildings:
			if str(b.get("role", "")) == "bridge":
				bridge_cnt += 1
			if bool(b.get("enterable", false)):
				enterable_cnt += 1

		regions_report[land] = {
			"title": region_title,
			"world_size_m": world_size,
			"grid_size": grid_size,
			"capital_center": [capital_center.x - world_size * 0.5, capital_center.y - world_size * 0.5],
			"roads_count": roads.size(),
			"buildings_count": buildings.size(),
			"enterable_buildings_count": enterable_cnt,
			"bridges_count": bridge_cnt,
			"npcs_count": npcs_data.size(),
			"exp_zones_count": exp_zones.size(),
			"monsters_count": monsters_data.size(),
			"fauna_count": fauna_data.size(),
			"props_count": props.size(),
		}

	# 3) Real 3D Planet Superior Globe screenshot
	switch_region("pyra")
	if atlas_overlay != null:
		atlas_overlay.set_mode("globe")
	toggle_atlas(true)
	for _i in 6:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "globe-3d.jpg"))

	# 4) 2D Planet Superior Relief Atlas (Overview + Zoomed-in Progressive LOD with Planar Roads & Painted Heraldic Medallions!)
	if atlas_overlay != null:
		atlas_overlay.set_mode("atlas")
	for _i in 4:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "planet-atlas.jpg"))

	if atlas_overlay != null:
		atlas_overlay.focus_atlas_continent("pyra", 3.5)
	for _i in 4:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "planet-atlas-zoom.jpg"))
	toggle_atlas(false)

	# 5) 3D Local Continent Relief Map (ZERO cones! Painted Heraldic Medallions + Planar Roads)
	switch_region("pyra")
	toggle_map()
	for _i in 5:
		await get_tree().process_frame
	map_3d.orbit(Vector2(65, -16))
	shots.append(await snap(out_dir, "map-3d.jpg"))

	map_3d.focus_on_capital_close(480.0)
	for _i in 5:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "map-3d-zoom.jpg"))
	map_3d.reset_overview()
	toggle_map()

	switch_region("verdant")
	toggle_map()
	for _i in 5:
		await get_tree().process_frame
	map_3d.orbit(Vector2(45, -12))
	shots.append(await snap(out_dir, "map-3d-verdant.jpg"))
	toggle_map()

	# 6) Wilderness Road, Single Continuous Bridge Crossing & Deep Sub-Biome Landscape Showcase
	switch_region("verdant")
	set_zoom(0.58)
	hero_pos = _find_first_bridge_pos()
	if premium_minimap != null:
		premium_minimap.set_heading_immediate(Vector2(0.85, 0.52))
	step_world(0.20)
	shots.append(await snap(out_dir, "wilderness-road.jpg"))

	switch_region("pyra")
	set_zoom(0.58)
	hero_pos = _find_first_bridge_pos()
	if premium_minimap != null:
		premium_minimap.set_heading_immediate(Vector2(-0.82, 0.56))
	step_world(0.20)
	shots.append(await snap(out_dir, "pyra-bridge.jpg"))

	# Deep Pyra Sub-Biome Vista (Sulfur Badlands / Dragon Graveyard / Magma Caldera)
	var deep_pt := capital_center + Vector2(620.0, 260.0)
	for p: Dictionary in props:
		if str(p.get("sub_biome", "")) == "sulfur" and str(p.get("kind", "")) == "landmark":
			deep_pt = Vector2(float(p.get("x", deep_pt.x)), float(p.get("z", deep_pt.y))) + Vector2(36.0, 42.0)
			break
	teleport_to_world_pos("pyra", deep_pt.x, deep_pt.y)
	set_zoom(0.62)
	step_world(0.20)
	shots.append(await snap(out_dir, "pyra-wilderness-biome.jpg"))

	# Live Monster Zone QA (Pyra Zone 1 outside safe capital)
	if not exp_zones.is_empty():
		var ez0: Dictionary = exp_zones[0]
		teleport_to_world_pos("pyra", float(ez0.get("x", deep_pt.x)), float(ez0.get("z", deep_pt.y)) + 28.0)
		set_zoom(0.75)
		step_world(0.20)
		shots.append(await snap(out_dir, "pyra-monster-zone.jpg"))

	# Playable Labyrinth Dungeon QA (Pyra Labirynt Wulkanicznej Kaldery)
	if not labyrinths_data.is_empty():
		gm_noclip = true
		enter_labyrinth_by_id(str((labyrinths_data[0] as Dictionary).get("id", "")))
		for _i in 4:
			await get_tree().process_frame
		shots.append(await snap(out_dir, "labyrinth-dungeon.jpg"))
		exit_labyrinth()
		gm_noclip = false

	# 7) AAA 29-Node Diamond Constellation Skill Tree ([K]) & Paperdoll Character Sheet ([I]) on Pyra
	switch_region("pyra")
	set_zoom(0.58)
	hero_pos = capital_center + Vector2(0.0, 12.0)
	step_world(0.1)
	if rpg_hud != null:
		rpg_hud.toggle_talents()
	for _i in 4:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "talent-tree.jpg"))
	if rpg_hud != null:
		rpg_hud.toggle_character()
	for _i in 4:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "character-sheet.jpg"))
	if rpg_hud != null:
		rpg_hud.close_modals()

	# 9) Walkable Building Interior QA (Pyra Smithy — Kuźnia Żaru)
	var smithy_b: Dictionary = {}
	for b: Dictionary in buildings:
		if bool(b.get("enterable", false)) and str(b.get("role", "")) == "smithy":
			smithy_b = b
			break
	if not smithy_b.is_empty():
		enter_building(smithy_b)
		for _i in 4:
			await get_tree().process_frame
		shots.append(await snap(out_dir, "interior-smithy.jpg"))
		exit_building()

	# 10) Live-World Non-Obstructive NPC Dialogue QA (Bottom Strip + Floating Speech Bubble)
	set_zoom(1.35)
	if live_agents.size() >= 2:
		var ag0: Dictionary = live_agents[0]
		hero_pos = (ag0["pos"] as Vector2) + Vector2(12.0, 14.0)
		step_world(0.1)
		open_npc_dialogue(ag0)
		if dialogue_strip != null:
			dialogue_strip.shown_chars = float(dialogue_strip.full_text.length())
			dialogue_strip.body_lbl.text = dialogue_strip.full_text
		var ag1: Dictionary = live_agents[1]
		if is_instance_valid(ag1.get("node", null)) and ag1["node"].has_method("show_bubble"):
			ag1["node"].show_bubble("Ogień w piecach dziś nie gaśnie!", 5.0)
		for _i in 4:
			await get_tree().process_frame
		shots.append(await snap(out_dir, "npc-dialogue.jpg"))
		if dialogue_strip != null:
			dialogue_strip.close_dialogue(false)

	# 11) Real Live Loading Screen QA (matching the intro film with live molten-gold bar & stage text)
	if loading_screen != null:
		loading_screen.set_immediate(0.68, "Wczytywanie 24 malowanych wnętrz budynków i sieci 309 dróg…", "Kontynent: Pyra — Twierdza Popiołu • 59 budynków użytkowych")
		for _i in 3:
			await get_tree().process_frame
		shots.append(await snap(out_dir, "loading-screen.jpg"))
		loading_screen.hide_immediate()

	var report := {
		"project": "ports/godot-isometric-world",
		"phase": "Live-World Non-Obstructive NPC Dialogue (Floating Speech Bubbles + Bottom Dialogue Strip) & Walkable Building Interiors",
		"projection_roundtrip_error_m": snappedf(roundtrip_err, 0.0001),
		"regions": regions_report,
		"screenshots": shots,
	}
	var file := FileAccess.open(out_dir.path_join("results.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("ISO_WORLD_QA_OK ", out_dir.path_join("results.json"))
	get_tree().quit(0)
