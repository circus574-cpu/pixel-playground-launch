extends Node2D
## KI Legends — 2D Isometric World, 4 Continents (1024×1024m), Spline Road Network,
## 24 Exp-Zone Combat Clearings, Vivid Water/Lakes/Oceans/Lava, Rich Painted Architecture,
## Blender Geometry Nodes Fortifications, 40 NPCs, 41 Monsters, 10 Fauna Animals & Real 3D Globe.

const ActorScript := preload("res://scripts/actor_view.gd")
const AmbientScript := preload("res://scripts/ambient_fx.gd")
const Map3DScript := preload("res://scripts/map_3d.gd")
const AtlasOverlayScript := preload("res://scripts/atlas_overlay.gd")
const StickScript := preload("res://scripts/stick.gd")

const ISO_W := 5.6
const ISO_D := 2.8
const ISO_H := 3.8
const STEP := 2
const SPEED := 34.0
const SPRITE_SCALE := 0.56

const REGION_ORDER := ["pyra", "verdant", "aether", "nexus"]
const REGION_TITLES := {
	"pyra": "Pyra — Twierdza Popiołu i Wulkaniczny Kontynent",
	"verdant": "Verdantia — Zielona Przystań i Szmaragdowa Dolina",
	"aether": "Aetheria — Sanktuarium Tysiąca Źródeł i Niebiańskie Tarasy",
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
var world_size := 1024.0
var safe_city_radius := 180.0
var heights := PackedFloat32Array()
var walkable := PackedByteArray()
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
var camera := Camera2D.new()
var hud := CanvasLayer.new()
var hud_panel := PanelContainer.new()
var info_label := Label.new()
var minimap_rect := TextureRect.new()
var minimap_markers := Control.new()
var map_3d: SubViewportContainer
var atlas_overlay: Control
var stick_layer := Control.new()
var region_bar := HBoxContainer.new()

var hero_pos := Vector2(512.0, 512.0)
var target_pos := Vector2(-1.0, -1.0)
var motion := Vector2.ZERO
var map_expanded := false
var atlas_expanded := false
var zoom_level := 0.80
var move_pointer := -1
var move_origin := Vector2.ZERO
var pinch_pointers: Dictionary = {}
var pinch_distance := 0.0
var tex_cache: Dictionary = {}
var current_exp_idx := 0
var world_time := 0.0

func _ready() -> void:
	load_databases()
	add_child(terrain_mesh)
	ysort.y_sort_enabled = true
	add_child(ysort)

	camera.enabled = true
	camera.zoom = Vector2(zoom_level, zoom_level)
	add_child(camera)

	build_hud()
	switch_region("pyra")

	if "--qa" in OS.get_cmdline_user_args() or "--qa" in OS.get_cmdline_args():
		call_deferred("run_qa")

func _exit_tree() -> void:
	ActorScript.sheet_cache.clear()
	AmbientScript.soft_texture = null
	var style = preload("res://scripts/map_style.gd")
	style.title_font = null
	style.vignette_texture = null
	tex_cache.clear()

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

func rebuild_hero(land: String) -> void:
	if hero != null and is_instance_valid(hero):
		hero.queue_free()
	hero = ActorScript.new()
	var h_info: Array = HERO_ACTORS.get(land, ["pyra.hero", "Ignis"])
	var h_key: String = str(h_info[0])
	var h_name: String = str(h_info[1])
	if actors_db.has(h_key):
		var h_def: Dictionary = actors_db[h_key]
		hero.setup(h_def, h_name, false, true, "hero")
	hero.scale = Vector2(0.62, 0.62)
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
		var err := img.load_webp_from_buffer(FileAccess.get_file_as_bytes(path)) if path.ends_with(".webp") else img.load(path)
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
	build_minimap_texture()
	hero_pos = Vector2(world_size * 0.5, world_size * 0.5 + 18.0)
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	if map_3d != null:
		map_3d.rebuild_for_region()
	minimap_markers.queue_redraw()
	if atlas_overlay != null:
		atlas_overlay.queue_redraw()

func load_terrain(land: String) -> void:
	var rdir := "res://regions/" + land
	heights = FileAccess.get_file_as_bytes(rdir + "/height.r32").to_float32_array()
	walkable = FileAccess.get_file_as_bytes(rdir + "/walkable.u8")

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
		safe_city_radius = float(bdata.get("safe_city_radius", 180.0))
		var half := world_size * 0.5

		for b: Dictionary in bdata.get("buildings", []):
			var bc: Dictionary = b.duplicate()
			bc["x"] = float(b.get("x", 0.0)) + half
			bc["z"] = float(b.get("z", 0.0)) + half
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
	mat.set_shader_parameter("surface_color", surface_color_for(current_land))
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
	for child in ysort.get_children():
		if child != hero:
			child.queue_free()

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
		var sp := make_fitted_sprite(sp_path, bw, bh_px, 0.86 if role != "bridge" else 0.65)
		node.add_child(sp)

		var fx_kind := AmbientScript.kind_for(sp_path)
		if fx_kind != "":
			var fx := AmbientScript.create(fx_kind, Vector2.ZERO, sp_path)
			node.add_child(fx)

		if role in ["landmark", "hall", "arena", "smithy", "inn", "shop", "depot", "gate"]:
			var lbl := Label.new()
			lbl.text = str(b.get("title", ""))
			lbl.position = Vector2(-135, -bh_px * SPRITE_SCALE * 0.82 - 22.0)
			lbl.size = Vector2(270, 26)
			lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			lbl.add_theme_font_size_override("font_size", 14 if role != "landmark" else 16)
			lbl.add_theme_color_override("font_color", Color(1.0, 0.94, 0.74) if role != "landmark" else Color(1.0, 0.84, 0.38))
			lbl.add_theme_color_override("font_outline_color", Color(0.04, 0.02, 0.02, 0.96))
			lbl.add_theme_constant_override("outline_size", 6)
			node.add_child(lbl)

		ysort.add_child(node)

	# 2. 290 Diverse Painted Flora, Trees, Flowers, Waterfalls, Rocks, Ruins, Shrines & Camps
	for p: Dictionary in props:
		var px := float(p.get("x", 512.0))
		var pz := float(p.get("z", 512.0))
		var ph := height_at(px, pz)
		var p_path := str(p.get("sprite", ""))
		var pw := float(p.get("w", 260.0))
		var ph_px := float(p.get("h", 280.0))

		var pnode := Node2D.new()
		pnode.position = iso(px, pz, ph)
		var psp := make_fitted_sprite(p_path, pw, ph_px, 0.88)
		pnode.add_child(psp)

		var p_fx := AmbientScript.kind_for(p_path)
		if p_fx != "":
			var fx_node := AmbientScript.create(p_fx, Vector2.ZERO, p_path)
			pnode.add_child(fx_node)

		ysort.add_child(pnode)

	# 3. 6 Exp-Zone Combat Clearing Banners ("EXPOWISKA Lv. 1..18")
	for ez: Dictionary in exp_zones:
		var ex := float(ez.get("x", 512.0))
		var ez_z := float(ez.get("z", 512.0))
		var eh := height_at(ex, ez_z)
		var ez_node := Node2D.new()
		ez_node.position = iso(ex, ez_z, eh)
		var banner := Label.new()
		banner.text = "⚔ EXPOWISKO: %s" % str(ez.get("name", ""))
		banner.position = Vector2(-210, -145)
		banner.size = Vector2(420, 32)
		banner.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		banner.add_theme_font_size_override("font_size", 17)
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
		npc_actor.scale = Vector2(0.58, 0.58)
		var nx := float(n.get("x", 512.0))
		var nz := float(n.get("z", 512.0))
		npc_actor.position = iso(nx, nz, height_at(nx, nz))
		ysort.add_child(npc_actor)
		live_agents.append({
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
		mon_actor.scale = Vector2(0.60, 0.60)
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

	# 6. 16 Animated Wildlife Fauna Animals (A-01..A-10) roaming near lakes, rivers & forests
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
		ani_actor.scale = Vector2(0.56, 0.56)
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
	hero_pos = Vector2(world_size * 0.5, world_size * 0.5 + 18.0)
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	minimap_markers.queue_redraw()

func cycle_exp_zone() -> void:
	if exp_zones.is_empty():
		return
	var ez: Dictionary = exp_zones[current_exp_idx % exp_zones.size()]
	current_exp_idx = (current_exp_idx + 1) % exp_zones.size()
	hero_pos = Vector2(float(ez.get("x", 512.0)), float(ez.get("z", 512.0)))
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	minimap_markers.queue_redraw()

func build_hud() -> void:
	add_child(hud)
	var panel := hud_panel
	panel.position = Vector2(14, 14)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.04, 0.03, 0.04, 0.88)
	style.border_color = Color(0.84, 0.62, 0.30, 0.90)
	style.set_border_width_all(2)
	style.set_corner_radius_all(8)
	style.content_margin_left = 12
	style.content_margin_right = 12
	style.content_margin_top = 8
	style.content_margin_bottom = 8
	panel.add_theme_stylebox_override("panel", style)

	var vbox := VBoxContainer.new()
	panel.add_child(vbox)
	info_label.add_theme_font_size_override("font_size", 14)
	info_label.add_theme_color_override("font_color", Color("f7e4c1"))
	vbox.add_child(info_label)

	region_bar.add_theme_constant_override("separation", 5)
	for idx in REGION_ORDER.size():
		var land_id: String = REGION_ORDER[idx]
		var btn := Button.new()
		btn.text = "[%d] %s" % [idx + 1, land_id.capitalize()]
		btn.pressed.connect(func() -> void: switch_region(land_id))
		region_bar.add_child(btn)

	var btn_cap := Button.new()
	btn_cap.text = "[C] Stolica"
	btn_cap.pressed.connect(func() -> void: teleport_to_capital())
	region_bar.add_child(btn_cap)

	var btn_exp := Button.new()
	btn_exp.text = "[E] Expowiska (6)"
	btn_exp.pressed.connect(func() -> void: cycle_exp_zone())
	region_bar.add_child(btn_exp)

	var btn_globe := Button.new()
	btn_globe.text = "[G] Globus 3D"
	btn_globe.pressed.connect(func() -> void:
		if atlas_overlay != null:
			atlas_overlay.set_mode("globe")
		toggle_atlas(not atlas_expanded)
	)
	region_bar.add_child(btn_globe)

	var btn_atlas := Button.new()
	btn_atlas.text = "[Tab] Atlas 2D"
	btn_atlas.pressed.connect(func() -> void:
		if atlas_overlay != null:
			atlas_overlay.set_mode("atlas")
		toggle_atlas(true)
	)
	region_bar.add_child(btn_atlas)

	var btn_3d := Button.new()
	btn_3d.text = "[M] Mapa 3D"
	btn_3d.pressed.connect(func() -> void: toggle_map())
	region_bar.add_child(btn_3d)

	vbox.add_child(region_bar)
	hud.add_child(panel)

	minimap_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	minimap_rect.stretch_mode = TextureRect.STRETCH_SCALE
	minimap_rect.mouse_filter = Control.MOUSE_FILTER_STOP
	minimap_rect.gui_input.connect(_on_minimap_input)
	hud.add_child(minimap_rect)

	minimap_markers.mouse_filter = Control.MOUSE_FILTER_IGNORE
	minimap_markers.draw.connect(_draw_minimap_markers)
	minimap_rect.add_child(minimap_markers)

	map_3d = Map3DScript.new()
	map_3d.world = self
	map_3d.visible = false
	hud.add_child(map_3d)

	atlas_overlay = AtlasOverlayScript.new()
	atlas_overlay.world = self
	atlas_overlay.visible = false
	hud.add_child(atlas_overlay)

	stick_layer.set_anchors_preset(Control.PRESET_FULL_RECT)
	stick_layer.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stick_layer.set_script(StickScript)
	stick_layer.set("world", self)
	hud.add_child(stick_layer)
	layout_minimap()

func build_minimap_texture() -> void:
	var rdir := "res://regions/" + current_land
	var weights := Image.new()
	weights.load_png_from_buffer(FileAccess.get_file_as_bytes(rdir + "/weights.png"))
	var surface := Image.new()
	surface.load_png_from_buffer(FileAccess.get_file_as_bytes(rdir + "/surface.png"))
	var img := Image.create(256, 256, false, Image.FORMAT_RGBA8)
	for y in 256:
		for x in 256:
			var gx := x * 2
			var gz := y * 2
			var w := weights.get_pixel(gx, gz)
			var s := surface.get_pixel(gx, gz)
			var c := Color(0.24, 0.28, 0.22) * w.r + Color(0.38, 0.46, 0.34) * w.g + Color(0.76, 0.68, 0.54) * w.b + Color(0.34, 0.32, 0.36) * w.a
			c = c * vertex_color(gx, gz).r
			if s.b > 0.15:
				c = c.lerp(Color(0.86, 0.78, 0.62), s.b * 0.75)
			if s.g > 0.15:
				c = c.lerp(Color(0.08, 0.58, 0.86), s.g * 0.90)
			if s.r > 0.15:
				c = c.lerp(Color(1.0, 0.38, 0.06), s.r * 0.95)
			if (1.0 - s.a) > 0.15:
				c = c.lerp(Color(0.28, 0.92, 1.0), (1.0 - s.a) * 0.90)
			img.set_pixel(x, y, Color(c.r, c.g, c.b, 0.95))
	minimap_rect.texture = ImageTexture.create_from_image(img)

func layout_minimap() -> void:
	var vp := get_viewport_rect().size
	hud_panel.visible = not (map_expanded or atlas_expanded)
	if map_expanded:
		var rect := Rect2(Vector2(64.0, 28.0), Vector2(vp.x - 128.0, vp.y - 56.0))
		map_3d.position = rect.position
		map_3d.size = rect.size
		map_3d.visible = true
		minimap_rect.visible = false
	else:
		map_3d.visible = false
		minimap_rect.visible = not atlas_expanded
		minimap_rect.size = Vector2(215, 215)
		minimap_rect.position = Vector2(vp.x - 231, 14)
	minimap_markers.size = minimap_rect.size
	minimap_markers.queue_redraw()
	if atlas_overlay != null:
		atlas_overlay.position = Vector2(24, 20)
		atlas_overlay.size = Vector2(vp.x - 48, vp.y - 40)
		atlas_overlay.visible = atlas_expanded

func toggle_map() -> void:
	if atlas_expanded:
		atlas_expanded = false
	map_expanded = not map_expanded
	layout_minimap()
	stick_layer.queue_redraw()

func toggle_atlas(open: bool) -> void:
	atlas_expanded = open
	if atlas_expanded:
		map_expanded = false
	layout_minimap()
	if atlas_overlay != null:
		atlas_overlay.queue_redraw()
	stick_layer.queue_redraw()

func _on_minimap_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		toggle_map()

func _draw_minimap_markers() -> void:
	var s := minimap_rect.size
	minimap_markers.draw_rect(Rect2(Vector2.ZERO, s), Color(0.84, 0.64, 0.32, 0.90), false, 2.5)
	# Safe Capital circle
	var c_center := Vector2(0.5 * s.x, 0.5 * s.y)
	minimap_markers.draw_arc(c_center, (safe_city_radius / world_size) * s.x, 0, TAU, 32, Color(0.35, 0.92, 0.55, 0.65), 1.5, true)
	# 6 Exp-Zones (red combat rings)
	for ez: Dictionary in exp_zones:
		var ep := Vector2(float(ez.x) / world_size * s.x, float(ez.z) / world_size * s.y)
		minimap_markers.draw_circle(ep, 5.0, Color(1.0, 0.28, 0.18, 0.92))
		minimap_markers.draw_arc(ep, 7.5, 0, TAU, 16, Color(1.0, 0.85, 0.35, 0.9), 1.5, true)
	# Hero marker
	var hp := Vector2(hero_pos.x / world_size * s.x, hero_pos.y / world_size * s.y)
	minimap_markers.draw_circle(hp, 5.5, Color(0.2, 0.95, 1.0))
	minimap_markers.draw_arc(hp, 8.0, 0, TAU, 20, Color(1, 1, 1, 0.9), 1.8, true)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_M:
			toggle_map()
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
			if event.position.x > get_viewport_rect().size.x * 0.42:
				var world_click: Vector2 = get_canvas_transform().affine_inverse() * event.position
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
	zoom_level = clampf(z, 0.45, 1.85)
	camera.zoom = Vector2(zoom_level, zoom_level)

func _process(delta: float) -> void:
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
		try_move(world_dir * SPEED * delta)
	if hero != null:
		hero.animate(screen_dir, true)
	sync_hero()

	# Animate all living NPCs, Monsters, and Wildlife Fauna animals
	for ag: Dictionary in live_agents:
		var node = ag["node"]
		if not is_instance_valid(node):
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

func try_move(step: Vector2) -> void:
	var h_now := height_at(hero_pos.x, hero_pos.y)
	for candidate: Vector2 in [hero_pos + step, Vector2(hero_pos.x + step.x, hero_pos.y), Vector2(hero_pos.x, hero_pos.y + step.y)]:
		if is_walkable(candidate.x, candidate.y) and absf(height_at(candidate.x, candidate.y) - h_now) < 5.5:
			hero_pos = candidate
			minimap_markers.queue_redraw()
			return

func sync_hero() -> void:
	var h := height_at(hero_pos.x, hero_pos.y)
	if hero != null:
		hero.position = iso(hero_pos.x, hero_pos.y, h)
		camera.position = hero.position + Vector2(0, -34)
	var nearest := ""
	var best := 9999.0
	for lm: Dictionary in landmarks:
		var d := hero_pos.distance_to(Vector2(float(lm.x), float(lm.z)))
		if d < best:
			best = d
			nearest = str(lm.title)
	var center := Vector2(world_size * 0.5, world_size * 0.5)
	var zone_tag := "BEZPIECZNA STOLICA" if hero_pos.distance_to(center) <= safe_city_radius else "DZIKI KONTYNENT / EXPOWISKO"
	info_label.text = "%s (%s)\nPozycja: (%.0f, %.0f) wys. %.1f m | Lokacja: %s | NPC: %d | Potwory: %d | Fauna: %d" % [
		region_title, zone_tag, hero_pos.x, hero_pos.y, h, nearest, npcs_data.size(), monsters_data.size(), fauna_data.size()
	]

func snap(out_dir: String, file: String) -> String:
	for _i in 4:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	var path := out_dir.path_join(file)
	img.save_jpg(path, 0.93)
	return path

func run_qa() -> void:
	var out_dir := OS.get_environment("ISO_QA_DIR")
	if out_dir.is_empty():
		out_dir = ProjectSettings.globalize_path("res://qa_out")
	DirAccess.make_dir_recursive_absolute(out_dir)

	var probe := Vector2(512.0, 512.0)
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
	var exp_shots := {
		"pyra": "pyra-expzone.jpg",
		"verdant": "verdant-expzone.jpg",
		"aether": "aether-expzone.jpg",
		"nexus": "nexus-expzone.jpg",
	}

	for land: String in REGION_ORDER:
		switch_region(land)
		set_zoom(0.76)
		# 1) Capital City view showing painted architecture, walls/bridges, water/lava, and NPCs
		if land == "pyra":
			hero_pos = Vector2(512.0, 492.0)
		elif land == "verdant":
			hero_pos = Vector2(512.0, 502.0)
		elif land == "aether":
			hero_pos = Vector2(512.0, 496.0)
		else:
			hero_pos = Vector2(512.0, 496.0)
		step_world(0.15)
		shots.append(await snap(out_dir, cap_shots[land]))

		# 2) Exp-Zone Combat Clearing view showing road spur, water/lava shore, perimeter props, and 5 patrolling monsters
		if not exp_zones.is_empty():
			var ez_pick: Dictionary = exp_zones[2 if land == "pyra" else (0 if land == "verdant" else (1 if land == "aether" else 3))]
			hero_pos = Vector2(float(ez_pick.x), float(ez_pick.z))
			step_world(0.25)
			shots.append(await snap(out_dir, exp_shots[land]))

		regions_report[land] = {
			"title": region_title,
			"world_size_m": world_size,
			"grid_size": grid_size,
			"buildings_count": buildings.size(),
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

	# 4) 2D Planet Superior Relief Atlas screenshot
	if atlas_overlay != null:
		atlas_overlay.set_mode("atlas")
	for _i in 4:
		await get_tree().process_frame
	shots.append(await snap(out_dir, "planet-atlas.jpg"))
	toggle_atlas(false)

	# 5) 3D Local Continent Relief Map screenshot
	switch_region("pyra")
	toggle_map()
	for _i in 5:
		await get_tree().process_frame
	map_3d.orbit(Vector2(65, -16))
	shots.append(await snap(out_dir, "map-3d.jpg"))
	toggle_map()

	var report := {
		"project": "ports/godot-isometric-world",
		"phase": "Phase A + Phase C Full Continents, Spline Roads, 24 Exp-Zones, Water/Lava, 338 Painted Assets + GeoNodes Walls, 99 Animated Entities & Real 3D Globe",
		"projection_roundtrip_error_m": snappedf(roundtrip_err, 0.0001),
		"regions": regions_report,
		"screenshots": shots,
	}
	var file := FileAccess.open(out_dir.path_join("results.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("ISO_WORLD_QA_OK ", out_dir.path_join("results.json"))
	get_tree().quit(0)
