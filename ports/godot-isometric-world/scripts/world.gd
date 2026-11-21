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
const DialogueStripScript := preload("res://scripts/dialogue_strip.gd")
const LoadingScreenScript := preload("res://scripts/loading_screen.gd")
const QuestJournalScript := preload("res://scripts/quest_journal.gd")
const StickScript := preload("res://scripts/stick.gd")
const AudioScript := preload("res://scripts/world_audio.gd")
const MapStyle := preload("res://scripts/map_style.gd")

const ISO_W := 5.6
const ISO_D := 2.8
const ISO_H := 3.8
const STEP := 2
const SPEED := 46.0
const SPRITE_SCALE := 0.56

const REGION_ORDER := ["pyra", "verdant", "aether", "nexus"]
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
var props: Array = []

var actors_db: Dictionary = {}
var monsters_db: Dictionary = {}
var animals_db: Dictionary = {}

var terrain_mesh := MeshInstance2D.new()
var ysort := Node2D.new()
var hero
var live_agents: Array[Dictionary] = []
var prop_nodes: Array[Node2D] = []
var _cull_accum := 0.0
var camera := Camera2D.new()
var hud := CanvasLayer.new()
var atmosphere: Control
var rpg_hud: Control
var gm_panel: Control
var interior_room: Control
var dialogue_strip: Control
var loading_screen: Control
var quest_journal: Control
var is_booting := false
var btn_enter_bldg := Button.new()
var btn_talk_npc := Button.new()
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
const RACE_TO_LAND := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}
var start_race := ""
var hero_race_land := ""
var start_land := "pyra"
var start_level := 0
var start_gold := -1
var start_name := ""
var server_char_id := ""
var server_character: Dictionary = {}
var server_action_fn: Callable = Callable()
var audio: Node
var nearest_enterable: Dictionary = {}
var nearest_npc_agent: Dictionary = {}
var active_talk_agent: Dictionary = {}
var gm_speed_mult := 1.0
var gm_noclip := false
var gm_map_teleport_mode := false
var gm_minimap_teleport := false
var zoom_level := 1.75
var move_pointer := -1
var move_origin := Vector2.ZERO
var pinch_pointers: Dictionary = {}
var pinch_distance := 0.0
var tex_cache: Dictionary = {}
var current_exp_idx := 0
var world_time := 0.0

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
	shadow_tex = make_shadow_tex()
	terrain_mesh.z_index = -10
	add_child(terrain_mesh)
	ysort.y_sort_enabled = true
	ysort.z_index = 0
	add_child(ysort)

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
		call_deferred("_boot_world_async")

func _boot_world_async() -> void:
	await get_tree().process_frame
	load_databases()
	loading_screen.set_stage(0.38, "Budowanie interfejsu HUD, minimapy i Globusa 3D…", "4 kontynenty • 24 malowane wnętrza budynków")
	await get_tree().process_frame
	await get_tree().process_frame
	build_hud()
	loading_screen.set_stage(0.68, "Generowanie terenu, sieci 309 dróg i 59 budynków…", "Kontynent: Pyra — Twierdza Popiołu")
	await get_tree().process_frame
	await get_tree().process_frame
	hero_race_land = str(RACE_TO_LAND.get(start_race, start_land)) if start_race != "" else start_land
	if rpg_hud != null and rpg_hud.has_method("set_hero_land"):
		rpg_hud.set_hero_land(hero_race_land)
	switch_region(start_land)
	if not server_character.is_empty():
		apply_server_character(server_character)
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

func dispatch_server_action(payload: Dictionary, on_done: Callable = Callable()) -> bool:
	if not is_server_authoritative():
		return false
	server_action_fn.call(server_char_id, payload, func(res: Dictionary) -> void:
		if bool(res.get("ok", false)):
			var ch: Dictionary = res.get("character", {})
			if not ch.is_empty():
				apply_server_character(ch)
			if bool(res.get("teleportCapital", false)):
				teleport_to_capital()
		if on_done.is_valid():
			on_done.call(res)
	)
	return true

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
	if ResourceLoader.exists(path):
		var res := load(path)
		if res is Texture2D:
			tex_cache[path] = res
			return res
	var abs_path := ProjectSettings.globalize_path(path)
	if FileAccess.file_exists(path) or FileAccess.file_exists(abs_path):
		var img := Image.new()
		var err := img.load(abs_path if FileAccess.file_exists(abs_path) else path)
		if err == OK:
			var tex := ImageTexture.create_from_image(img)
			tex_cache[path] = tex
			return tex
	return null

func switch_region(land: String) -> void:
	if not REGION_TITLES.has(land):
		return
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
	sync_hero()
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
			if str(b.get("role", "")) in ["landmark", "hall", "arena", "smithy", "inn", "shop", "depot"]:
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
			landmarks.append({"id": str(ez.get("id", "")), "title": str(ez.get("name", "")), "x": ezc["x"], "z": ezc["z"]})

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

func vertex_color(gx: int, gz: int) -> Color:
	var hx := heights[grid_index(gx + 2, gz)] - heights[grid_index(gx - 2, gz)]
	var hz := heights[grid_index(gx, gz + 2)] - heights[grid_index(gx, gz - 2)]
	var normal := Vector3(-hx, 3.6, -hz).normalized()
	var sun := Vector3(-0.55, 0.74, -0.38).normalized()
	var shade := clampf(0.54 + 0.56 * normal.dot(sun), 0.34, 1.15)
	return Color(shade, shade * 0.98, shade * 0.95, 1.0)

func build_isometric_mesh() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for gz in range(0, grid_size - STEP, STEP):
		for gx in range(0, grid_size - STEP, STEP):
			var p00 := grid_vertex(gx, gz)
			var p10 := grid_vertex(gx + STEP, gz)
			var p11 := grid_vertex(gx + STEP, gz + STEP)
			var p01 := grid_vertex(gx, gz + STEP)
			emit_tri(st, p00, p10, p11)
			emit_tri(st, p00, p11, p01)
	terrain_mesh.mesh = st.commit()
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/terrain.gdshader")
	var rdir := "res://regions/" + current_land
	for i in 4:
		var t_png := load_tex("%s/mat_%d.png" % [rdir, i])
		var t_webp := load_tex("%s/mat_%d.webp" % [rdir, i])
		mat.set_shader_parameter("mat_%d_tex" % i, t_png if t_png != null else t_webp)
	mat.set_shader_parameter("water_tex", load_tex("%s/water.png" % rdir))
	mat.set_shader_parameter("weights_tex", load_tex("%s/weights.png" % rdir))
	mat.set_shader_parameter("surface_tex", load_tex("%s/surface.png" % rdir))
	mat.set_shader_parameter("map_art_tex", load_tex("%s/map_art.png" % rdir))
	mat.set_shader_parameter("surface_color", surface_color_for(current_land))
	var ws_s := maxf(world_size / 1024.0, 1.0)
	mat.set_shader_parameter("uv_scale", 88.0 * ws_s)
	mat.set_shader_parameter("world_scale", ws_s)
	terrain_mesh.material = mat

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
	prop_nodes.clear()
	_last_cull_cam = Vector2(1e9, 1e9)
	for child in ysort.get_children():
		if child != hero:
			child.queue_free()

	var body_f: Font = MapStyle.body_font()

	# 1. Painted Architectural Buildings + Blender Geometry Nodes Fortification Walls, Gates, Towers & Bridges
	for b: Dictionary in buildings:
		var bx := float(b.get("x", 512.0))
		var bz := float(b.get("z", 512.0))
		var bh := height_at(bx, bz)
		var sp_path := str(b.get("sprite", ""))
		var bw := float(b.get("w", 420.0))
		var bh_px := float(b.get("h", 420.0))
		var role := str(b.get("role", "building"))

		var node := Node2D.new()
		node.position = iso(bx, bz, bh)
		if role == "bridge":
			node.z_index = -2
		else:
			add_contact_shadow(node, bw, 0.42 if role == "landmark" else 0.34, 4.0)
		var sp := make_fitted_sprite(sp_path, bw, bh_px, 0.54 if role == "bridge" else 0.86)
		node.add_child(sp)

		var fx_kind := AmbientScript.kind_for(sp_path)
		if fx_kind != "":
			var fx := AmbientScript.create(fx_kind, Vector2.ZERO, sp_path)
			node.add_child(fx)

		if role in ["landmark", "hall", "arena", "smithy", "inn", "shop", "depot", "gate"]:
			var lbl := Label.new()
			lbl.text = str(b.get("title", ""))
			lbl.position = Vector2(-190, -bh_px * SPRITE_SCALE * 0.82 - 22.0)
			lbl.size = Vector2(380, 30)
			lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lbl.add_theme_font_override("font", body_f)
			lbl.add_theme_font_size_override("font_size", 18 if role != "landmark" else 21)
			lbl.add_theme_color_override("font_color", Color(1.0, 0.94, 0.74) if role != "landmark" else Color(1.0, 0.84, 0.38))
			lbl.add_theme_color_override("font_outline_color", Color(0.04, 0.02, 0.02, 0.96))
			lbl.add_theme_constant_override("outline_size", 7)
			node.add_child(lbl)

		ysort.add_child(node)

	# 2. Diverse Painted Flora, Trees, Flowers, Waterfalls, Rocks, Ruins, Shrines & Biome Landmarks (culled by camera radius)
	for p: Dictionary in props:
		var px := float(p.get("x", 512.0))
		var pz := float(p.get("z", 512.0))
		var ph := height_at(px, pz)
		var p_path := str(p.get("sprite", ""))
		var pw := float(p.get("w", 260.0))
		var ph_px := float(p.get("h", 280.0))

		var pnode := Node2D.new()
		pnode.position = iso(px, pz, ph)
		add_contact_shadow(pnode, pw, 0.30, 3.0)
		var psp := make_fitted_sprite(p_path, pw, ph_px, 0.88)
		pnode.add_child(psp)

		var p_fx := AmbientScript.kind_for(p_path)
		if p_fx != "":
			var fx_node := AmbientScript.create(p_fx, Vector2.ZERO, p_path)
			pnode.add_child(fx_node)

		ysort.add_child(pnode)
		prop_nodes.append(pnode)

	# 3. 6 Exp-Zone Combat Clearing Banners ("EXPOWISKA Lv. 1..18")
	for ez: Dictionary in exp_zones:
		var ex := float(ez.get("x", 512.0))
		var ez_z := float(ez.get("z", 512.0))
		var eh := height_at(ex, ez_z)
		var ez_node := Node2D.new()
		ez_node.position = iso(ex, ez_z, eh)
		var banner := Label.new()
		banner.text = "⚔ EXPOWISKO: %s" % str(ez.get("name", ""))
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

	# 4. 10 Animated Capital NPCs with Quest Markers (! / ?) and Patrols
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
			"radius": float(n.get("patrol_radius", 14.0)),
			"speed": 0.65,
			"phase": float(idx) * 1.37,
		})

	# 5. 30 Animated Monsters distributed across the 6 Exp-Zones (Lv. 1..18)
	for idx in monsters_data.size():
		var m: Dictionary = monsters_data[idx]
		var mid := str(m.get("actor_id", ""))
		if not monsters_db.has(mid):
			continue
		var m_entry: Dictionary = monsters_db[mid]
		var m_actor_def: Dictionary = m_entry.get("actor", {})
		if m_actor_def.is_empty():
			continue
		var mon_actor := ActorScript.new()
		mon_actor.setup(
			m_actor_def,
			str(m.get("name", "")),
			false,
			false,
			"monster",
			int(m.get("level", 1))
		)
		mon_actor.scale = Vector2(0.47, 0.47)
		var mx := float(m.get("x", 512.0))
		var mz := float(m.get("z", 512.0))
		mon_actor.position = iso(mx, mz, height_at(mx, mz))
		ysort.add_child(mon_actor)
		live_agents.append({
			"node": mon_actor,
			"home": Vector2(mx, mz),
			"pos": Vector2(mx, mz),
			"radius": float(m.get("patrol_radius", 16.0)),
			"speed": 0.95,
			"phase": float(idx) * 1.91,
		})

	# 6. 18 Animated Wildlife Fauna Animals (A-01..A-10) roaming near lakes, rivers & forests
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
		live_agents.append({
			"node": ani_actor,
			"home": Vector2(fx, fz),
			"pos": Vector2(fx, fz),
			"radius": float(fa.get("patrol_radius", 20.0)),
			"speed": 1.15,
			"phase": float(idx) * 2.23,
		})

func teleport_to_capital() -> void:
	var spawn := capital_center + Vector2(0.0, 22.0)
	hero_pos = spawn if is_walkable(spawn.x, spawn.y) else capital_center
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()

func teleport_to_world_pos(land: String, wx: float, wz: float) -> void:
	if land != current_land and REGION_TITLES.has(land):
		switch_region(land)
	var tx := clampf(wx, 18.0, world_size - 18.0)
	var tz := clampf(wz, 18.0, world_size - 18.0)
	if not gm_noclip and not is_walkable(tx, tz):
		# Snap cleanly to nearest walkable dry point within 90m so tap-on-map never gets stuck in water!
		var found := false
		for rad in range(4, 96, 6):
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

	# Large mobile-friendly "WEJDŹ DO BUDYNKU" prompt button (visible when near any of the 59 enterable buildings)
	var est := StyleBoxFlat.new()
	est.bg_color = Color(0.14, 0.11, 0.06, 0.96)
	est.border_color = Color(0.98, 0.78, 0.34, 0.98)
	est.set_border_width_all(3)
	est.set_corner_radius_all(12)
	est.content_margin_left = 18
	est.content_margin_right = 18
	est.content_margin_top = 8
	est.content_margin_bottom = 8
	btn_enter_bldg.add_theme_stylebox_override("normal", est)
	var esh := est.duplicate()
	esh.bg_color = Color(0.24, 0.18, 0.08, 0.98)
	btn_enter_bldg.add_theme_stylebox_override("hover", esh)
	btn_enter_bldg.add_theme_font_override("font", MapStyle.body_font())
	btn_enter_bldg.add_theme_font_size_override("font_size", 17)
	btn_enter_bldg.add_theme_color_override("font_color", Color(1.0, 0.94, 0.74))
	btn_enter_bldg.text = "▶ WEJDŹ DO BUDYNKU"
	btn_enter_bldg.visible = false
	btn_enter_bldg.pressed.connect(func() -> void:
		if not nearest_enterable.is_empty():
			enter_building(nearest_enterable)
	)
	hud.add_child(btn_enter_bldg)

	# Contextual mobile "ROZMAWIAJ Z NPC" button (non-obstructive cyan-gold pill)
	var tst := StyleBoxFlat.new()
	tst.bg_color = Color(0.06, 0.16, 0.22, 0.96)
	tst.border_color = Color(0.36, 0.90, 1.0, 0.98)
	tst.set_border_width_all(3)
	tst.set_corner_radius_all(12)
	tst.content_margin_left = 18
	tst.content_margin_right = 18
	tst.content_margin_top = 8
	tst.content_margin_bottom = 8
	btn_talk_npc.add_theme_stylebox_override("normal", tst)
	var tsh := tst.duplicate()
	tsh.bg_color = Color(0.10, 0.26, 0.34, 0.98)
	btn_talk_npc.add_theme_stylebox_override("hover", tsh)
	btn_talk_npc.add_theme_font_override("font", MapStyle.body_font())
	btn_talk_npc.add_theme_font_size_override("font_size", 17)
	btn_talk_npc.add_theme_color_override("font_color", Color(0.90, 0.98, 1.0))
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

func enter_building(b: Dictionary) -> void:
	if b.is_empty() or interior_room == null:
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
	if in_interior:
		if interior_room != null:
			interior_room.visible = true
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
		if stick_layer != null:
			stick_layer.visible = true
		return
	if interior_room != null:
		interior_room.visible = false
	var show_world_ui := not (map_expanded or atlas_expanded)
	var rpg_modal_open: bool = gm_open or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character)))
	var dlg_open: bool = dialogue_strip != null and bool(dialogue_strip.is_open)
	if rpg_hud != null:
		rpg_hud.visible = show_world_ui
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
			premium_minimap.position = Vector2(vp.x - 288.0, 10.0)
	if stick_layer != null:
		stick_layer.visible = show_world_ui and not rpg_modal_open
	if atlas_overlay != null:
		atlas_overlay.position = Vector2(24, 20)
		atlas_overlay.size = Vector2(vp.x - 48, vp.y - 40)
		atlas_overlay.visible = atlas_expanded
	if gm_panel != null:
		gm_panel.visible = gm_open and show_world_ui
	var bw := clampf(vp.x * 0.34, 280.0, 420.0)
	btn_enter_bldg.size = Vector2(bw, 52.0)
	btn_enter_bldg.position = Vector2((vp.x - bw) * 0.5, vp.y - 148.0)
	btn_enter_bldg.visible = show_world_ui and not rpg_modal_open and not dlg_open and not nearest_enterable.is_empty()
	var tw := clampf(vp.x * 0.30, 250.0, 360.0)
	btn_talk_npc.size = Vector2(tw, 50.0)
	var talk_y := (vp.y - 208.0) if btn_enter_bldg.visible else (vp.y - 148.0)
	btn_talk_npc.position = Vector2((vp.x - tw) * 0.5, talk_y)
	btn_talk_npc.visible = show_world_ui and not rpg_modal_open and not dlg_open and not nearest_npc_agent.is_empty()

func toggle_quest_journal() -> void:
	if quest_journal != null:
		quest_journal.toggle_journal()

func toggle_gm_panel(force_open: Variant = null) -> void:
	if in_interior:
		return
	var next_v: bool = (not gm_open) if force_open == null else bool(force_open)
	gm_open = next_v
	if gm_open:
		map_expanded = false
		atlas_expanded = false
		if rpg_hud != null:
			rpg_hud.close_modals()
		if gm_panel != null:
			gm_panel.refresh_content()
	layout_minimap()
	if rpg_hud != null:
		rpg_hud._refresh_visuals()

func toggle_map() -> void:
	if in_interior:
		return
	if atlas_expanded:
		atlas_expanded = false
	if gm_open:
		gm_open = false
	map_expanded = not map_expanded
	layout_minimap()
	stick_layer.queue_redraw()

func toggle_atlas(open: bool) -> void:
	if in_interior and open:
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
	if in_interior:
		if event is InputEventKey and event.pressed and not event.echo:
			if event.keycode == KEY_ESCAPE:
				if dialogue_strip != null and bool(dialogue_strip.is_open):
					dialogue_strip.close_dialogue(false)
				elif interior_room != null and bool(interior_room.service_open):
					interior_room.toggle_service_panel(false)
				else:
					exit_building()
				return
		elif event is InputEventScreenTouch:
			handle_touch(event)
		elif event is InputEventScreenDrag:
			handle_drag(event)
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F1 or event.keycode == KEY_P:
			toggle_gm_panel()
			return
		elif event.keycode == KEY_ESCAPE and dialogue_strip != null and bool(dialogue_strip.is_open):
			dialogue_strip.close_dialogue(true)
			return
		elif event.keycode == KEY_R:
			if not nearest_npc_agent.is_empty():
				open_npc_dialogue(nearest_npc_agent)
				return
		elif event.keycode == KEY_F or event.keycode == KEY_ENTER:
			if not nearest_enterable.is_empty():
				enter_building(nearest_enterable)
				return
		elif event.keycode == KEY_ESCAPE and gm_open:
			toggle_gm_panel(false)
			return
		elif event.keycode == KEY_M:
			toggle_map()
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
			if atlas_overlay != null:
				atlas_overlay.set_mode("atlas")
			toggle_atlas(not atlas_expanded)
			return
		elif event.keycode == KEY_E:
			cycle_exp_zone()
			return
		elif event.keycode == KEY_C:
			teleport_to_capital()
			return
		elif event.keycode == KEY_1:
			switch_region("pyra")
			return
		elif event.keycode == KEY_2:
			switch_region("verdant")
			return
		elif event.keycode == KEY_3:
			switch_region("aether")
			return
		elif event.keycode == KEY_4:
			switch_region("nexus")
			return
		elif event.keycode == KEY_EQUAL or event.keycode == KEY_PLUS:
			set_zoom(zoom_level * 1.12)
		elif event.keycode == KEY_MINUS:
			set_zoom(zoom_level / 1.12)
	if gm_open or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character))):
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
			# Tap directly on an outdoor NPC to start non-obstructive dialogue!
			for ag: Dictionary in live_agents:
				if str(ag.get("kind", "")) != "npc":
					continue
				var nd = ag.get("node", null)
				if is_instance_valid(nd) and world_click.distance_to(nd.position + Vector2(0, -32)) < 68.0:
					if hero_pos.distance_to(ag["pos"] as Vector2) < 95.0:
						open_npc_dialogue(ag)
						return
			if event.position.x > get_viewport_rect().size.x * 0.42:
				target_pos = screen_to_ground(world_click)
	elif event is InputEventScreenTouch:
		handle_touch(event)
	elif event is InputEventScreenDrag:
		handle_drag(event)

func handle_touch(event: InputEventScreenTouch) -> void:
	var vp := get_viewport_rect().size
	if event.pressed:
		if event.position.x < vp.x * 0.42 and move_pointer == -1:
			move_pointer = event.index
			move_origin = event.position
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
		motion = delta.limit_length(54.0) / 54.0
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
	if is_booting or in_interior:
		return
	step_world(delta)

func step_world(delta: float) -> void:
	world_time += delta
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
	if world_dir.length_squared() > 0.001:
		var stat_spd_mult := 1.0
		if rpg_hud != null and rpg_hud.has_method("get_speed_mult"):
			stat_spd_mult = float(rpg_hud.get_speed_mult())
		try_move(world_dir * SPEED * gm_speed_mult * stat_spd_mult * delta)
	if audio != null:
		audio.step(delta, world_dir.length_squared() > 0.001, current_land, false)
		audio.play_ambience(current_land, hero_pos.distance_to(capital_center) <= safe_city_radius)
	if hero != null:
		hero.animate(screen_dir, true)
	sync_hero()

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

	# Animate all living NPCs, Monsters, and Wildlife Fauna animals + ambient speech bubbles
	for idx in live_agents.size():
		var ag: Dictionary = live_agents[idx]
		var node = ag["node"]
		if not is_instance_valid(node):
			continue
		if dlg_open and node == talk_node:
			# Pause patrol and turn toward hero while talking
			var to_hero: Vector2 = hero_pos - (ag["pos"] as Vector2)
			var face_s := Vector2(to_hero.x - to_hero.y, (to_hero.x + to_hero.y) * 0.5)
			if face_s.length_squared() > 0.01:
				node.face(face_s)
			node.animate(Vector2.ZERO, false)
			continue
		var home: Vector2 = ag["home"]
		var rad: float = float(ag["radius"])
		var spd: float = float(ag["speed"])
		var ph: float = float(ag["phase"])
		var t := world_time * spd + ph
		var next_p := home + Vector2(cos(t), sin(t * 0.75)) * (rad * 0.45)
		var prev_p: Vector2 = ag["pos"]
		var d_pos := next_p - prev_p
		ag["pos"] = next_p
		node.position = iso(next_p.x, next_p.y, height_at(next_p.x, next_p.y))
		var s_dir := Vector2(d_pos.x - d_pos.y, (d_pos.x + d_pos.y) * 0.5)
		node.animate(s_dir if s_dir.length() > 0.01 else Vector2.ZERO, false)

		# Layer 1: Ambient floating World Speech Bubbles when hero walks near an NPC (0% HUD obstruction)
		if str(ag.get("kind", "")) == "npc":
			var dist_h := hero_pos.distance_to(next_p)
			var last_b: float = float(ag.get("last_bark_t", -99.0))
			if dist_h < 50.0 and world_time - last_b > 16.0:
				ag["last_bark_t"] = world_time
				if node.has_method("show_bubble"):
					var bark: String = DialogueStripScript.pick_ambient_bark(current_land, str(ag.get("role", "")), idx + int(world_time))
					node.show_bubble(bark, 4.2)

func try_move(step: Vector2) -> void:
	if gm_noclip:
		hero_pos = Vector2(clampf(hero_pos.x + step.x, 12.0, world_size - 12.0), clampf(hero_pos.y + step.y, 12.0, world_size - 12.0))
		return
	var h_now := height_at(hero_pos.x, hero_pos.y)
	for candidate: Vector2 in [hero_pos + step, Vector2(hero_pos.x + step.x, hero_pos.y), Vector2(hero_pos.x, hero_pos.y + step.y)]:
		if is_walkable(candidate.x, candidate.y) and absf(height_at(candidate.x, candidate.y) - h_now) < 5.5:
			hero_pos = candidate
			return

var _last_cull_cam := Vector2(1e9, 1e9)
var _last_cull_zoom := -1.0

func _cull_props(force: bool = false) -> void:
	var cam_p := camera.position
	if not force and cam_p.distance_squared_to(_last_cull_cam) < 900.0 and absf(zoom_level - _last_cull_zoom) < 0.02:
		return
	_last_cull_cam = cam_p
	_last_cull_zoom = zoom_level
	var rx := 2400.0 / maxf(zoom_level, 0.50)
	var ry := 1750.0 / maxf(zoom_level, 0.50)
	for nd: Node2D in prop_nodes:
		if not is_instance_valid(nd):
			continue
		var dx := absf(nd.position.x - cam_p.x)
		var dy := absf(nd.position.y - cam_p.y)
		nd.visible = (dx < rx and dy < ry)

func sync_hero() -> void:
	var h := height_at(hero_pos.x, hero_pos.y)
	if hero != null:
		hero.position = iso(hero_pos.x, hero_pos.y, h)
		camera.position = hero.position + Vector2(0, -34)
	_cull_props()
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
	if premium_minimap != null:
		premium_minimap.refresh(nearest, in_safe)
	if atlas_overlay != null and atlas_expanded:
		atlas_overlay.sync_live_hero()

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

	# Detect nearest outdoor NPC within 48m for contextual "ROZMAWIAJ" pill
	var best_npc: Dictionary = {}
	var best_nd := 48.0
	for ag: Dictionary in live_agents:
		if str(ag.get("kind", "")) != "npc":
			continue
		var nd := hero_pos.distance_to(ag["pos"] as Vector2)
		if nd < best_nd:
			best_nd = nd
			best_npc = ag
	nearest_npc_agent = best_npc

	var show_world_ui := not (map_expanded or atlas_expanded or in_interior)
	var rpg_modal_open: bool = gm_open or (rpg_hud != null and (bool(rpg_hud.show_talents) or bool(rpg_hud.show_character)))
	var dlg_open: bool = dialogue_strip != null and bool(dialogue_strip.is_open)
	if not nearest_enterable.is_empty():
		btn_enter_bldg.text = "▶ WEJDŹ: %s" % str(nearest_enterable.get("title", "Budynek"))
	btn_enter_bldg.visible = show_world_ui and not rpg_modal_open and not dlg_open and not nearest_enterable.is_empty()
	if not nearest_npc_agent.is_empty():
		btn_talk_npc.text = "▶ ROZMAWIAJ: %s" % str(nearest_npc_agent.get("name", "NPC"))
	var vp := get_viewport_rect().size
	var tw := clampf(vp.x * 0.30, 250.0, 360.0)
	btn_talk_npc.size = Vector2(tw, 50.0)
	btn_talk_npc.position = Vector2((vp.x - tw) * 0.5, (vp.y - 208.0) if btn_enter_bldg.visible else (vp.y - 148.0))
	btn_talk_npc.visible = show_world_ui and not rpg_modal_open and not dlg_open and not nearest_npc_agent.is_empty()

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

	# 8) Upgraded GM Panel QA (Teleport, Super Speed, Item Creator, Stat Points)
	toggle_gm_panel(true)
	if rpg_hud != null:
		rpg_hud.add_item_to_backpack({"id": "blade_pyra", "name": "Obsydianowy Miecz Żaru", "cat": "weapon", "icon": "emblem_swords.webp", "slot": 2, "atk": 42, "rarity": Color(1.0, 0.46, 0.24)}, 1)
		rpg_hud.add_stat_points_gm("atk", 2)
	for _i in 4:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "gm-panel.jpg"))
	toggle_gm_panel(false)

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
