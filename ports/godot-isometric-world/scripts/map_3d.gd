extends SubViewportContainer
## Rotatable & Zoomable AAA 3D Continent Relief Map for KI Legends ([M] Mapa 3D).
## Progressive Zoom LOD:
## - Overview: Canonical painted relief island, Capital Crown Star, Town/Stronghold Shields, major highways & Exp-Zones.
## - Medium Zoom: ALL real in-game roads (highways, city streets, ring avenues, footpaths) & bridges sharpen crisply.
## - Close Zoom: Small crisp dots for EVERY enterable utility building + roof footprints sharpen in 3D space.
## - Street-Level Zoom: Individual enterable building names, gates, houses & live Hero/NPC positions appear cleanly.

const MapStyle := preload("res://scripts/map_style.gd")

var world: Node2D
var vp := SubViewport.new()
var root := Node3D.new()
var terrain_node := MeshInstance3D.new()
var cam := Camera3D.new()
var hero_pin := MeshInstance3D.new()
var capital_pin := MeshInstance3D.new()
var pins := Node3D.new()
var relief_heights := PackedFloat32Array()
var relief_grid := 256
var terrain_mat: ShaderMaterial

var yaw := -0.42
var pitch := 0.72
var distance := 780.0
var focus_offset := Vector2.ZERO
var dragging := false
var panning := false
const STEP := 2

func _ready() -> void:
	stretch = true
	vp.own_world_3d = true
	vp.transparent_bg = false
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE
	add_child(vp)
	vp.add_child(root)

	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.06, 0.14, 0.24, 1.0)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.86, 0.90, 0.96)
	e.ambient_light_energy = 0.85
	e.fog_enabled = true
	e.fog_light_color = Color(0.06, 0.14, 0.24)
	e.fog_density = 0.00045
	env.environment = e
	root.add_child(env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42.0, -35.0, 0.0)
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.15
	root.add_child(sun)

	var ocean_mesh := PlaneMesh.new()
	ocean_mesh.size = Vector2(9000.0, 9000.0)
	var ocean_mat := StandardMaterial3D.new()
	ocean_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ocean_mat.albedo_color = Color(0.085, 0.185, 0.305, 1.0)
	var ocean_node := MeshInstance3D.new()
	ocean_node.mesh = ocean_mesh
	ocean_node.material_override = ocean_mat
	ocean_node.position = Vector3(0.0, -1.2, 0.0)
	root.add_child(ocean_node)

	root.add_child(terrain_node)
	root.add_child(pins)

	capital_pin.mesh = make_cone(9.0, 28.0, Color(1.0, 0.88, 0.36), Color(0.75, 0.50, 0.12))
	root.add_child(capital_pin)

	hero_pin.mesh = make_cone(7.5, 24.0, Color(0.28, 0.98, 1.0), Color(0.08, 0.45, 0.78))
	root.add_child(hero_pin)

	cam.fov = 36.0
	cam.near = 2.0
	cam.far = 3600.0
	root.add_child(cam)
	rebuild_for_region()

func _relief_at_grid(gx: int, gz: int) -> float:
	if relief_heights.is_empty():
		return 0.0
	var cx := clampi(gx, 0, relief_grid - 1)
	var cz := clampi(gz, 0, relief_grid - 1)
	return relief_heights[cz * relief_grid + cx]

func relief_at_world(wx: float, wz: float) -> float:
	if world == null or relief_heights.is_empty():
		return 10.0
	var ws: float = float(world.world_size)
	var gx := clampi(int(round(wx / ws * float(relief_grid - 1))), 0, relief_grid - 1)
	var gz := clampi(int(round(wz / ws * float(relief_grid - 1))), 0, relief_grid - 1)
	return _relief_at_grid(gx, gz)

func zoom_detail_level() -> float:
	return clampf((880.0 - distance) / 660.0, 0.0, 1.0)

func focus_on_capital_close(dist_m: float = 280.0) -> void:
	if world == null:
		return
	var half: float = float(world.world_size) * 0.5
	var cap_p: Vector2 = world.capital_center
	focus_offset = Vector2(cap_p.x - half, cap_p.y - half)
	distance = clampf(dist_m, 145.0, 1450.0)
	pitch = 0.88
	yaw = -0.35

func reset_overview() -> void:
	if world == null:
		return
	focus_offset = Vector2.ZERO
	distance = float(world.world_size) * 0.90
	pitch = 0.72
	yaw = -0.42

func rebuild_for_region() -> void:
	if world == null:
		return
	var land: String = str(world.current_land)
	var rdir := "res://regions/" + land
	var relief_path := rdir + "/relief_3d.r32"
	if FileAccess.file_exists(relief_path):
		relief_heights = FileAccess.get_file_as_bytes(relief_path).to_float32_array()
		relief_grid = int(round(sqrt(float(relief_heights.size()))))
	else:
		relief_heights = world.heights
		relief_grid = int(world.grid_size)

	var ws: float = float(world.world_size)
	distance = ws * 0.90
	focus_offset = Vector2.ZERO

	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for gz in range(0, relief_grid - STEP, STEP):
		for gx in range(0, relief_grid - STEP, STEP):
			var p00 := cell(gx, gz, ws)
			var p10 := cell(gx + STEP, gz, ws)
			var p11 := cell(gx + STEP, gz + STEP, ws)
			var p01 := cell(gx, gz + STEP, ws)
			tri(st, p00, p10, p11)
			tri(st, p00, p11, p01)
	st.generate_normals()
	terrain_node.mesh = st.commit()

	terrain_mat = ShaderMaterial.new()
	terrain_mat.shader = load("res://shaders/map_3d.gdshader")
	var art_tex: Texture2D = world.load_tex("%s/map_art.png" % rdir)
	if art_tex == null:
		art_tex = world.load_tex("%s/minimap_hq.png" % rdir)
	var surf_tex: Texture2D = world.load_tex("%s/surface.png" % rdir)
	terrain_mat.set_shader_parameter("map_art_tex", art_tex)
	terrain_mat.set_shader_parameter("surface_tex", surf_tex)
	terrain_mat.set_shader_parameter("has_surface", 1.0 if surf_tex != null else 0.0)
	terrain_mat.set_shader_parameter("zoom_detail", zoom_detail_level())
	terrain_mat.set_shader_parameter("is_pyra", 1.0 if land == "pyra" else 0.0)
	terrain_mat.set_shader_parameter("is_aether", 1.0 if land == "aether" else 0.0)
	terrain_node.material_override = terrain_mat

	var half := ws * 0.5
	var cap_p: Vector2 = world.capital_center
	capital_pin.position = Vector3(cap_p.x - half, relief_at_world(cap_p.x, cap_p.y) * 1.45 + 12.0, cap_p.y - half)

	for child in pins.get_children():
		child.queue_free()
	for ez: Dictionary in world.exp_zones:
		var pin := MeshInstance3D.new()
		pin.mesh = make_cone(6.0, 18.0, Color(1.0, 0.36, 0.22), Color(0.55, 0.10, 0.06))
		var lp := _snap_pin_to_land(float(ez.x), float(ez.z), ws)
		pin.position = Vector3(lp.x - half, relief_at_world(lp.x, lp.y) * 1.45 + 9.0, lp.y - half)
		pins.add_child(pin)

func _snap_pin_to_land(ex: float, ez_z: float, ws: float) -> Vector2:
	var center: Vector2 = world.capital_center if world != null else Vector2(ws * 0.5, ws * 0.5)
	var p := Vector2(ex, ez_z)
	for step in 16:
		var t := 1.0 - float(step) * 0.045
		var cand := center.lerp(p, t)
		if relief_at_world(cand.x, cand.y) > 2.5:
			return cand
	return center.lerp(p, 0.62)

func cell(gx: int, gz: int, ws: float) -> Dictionary:
	var half := ws * 0.5
	var u := float(gx) / float(relief_grid - 1)
	var v := float(gz) / float(relief_grid - 1)
	var wx := u * ws
	var wz := v * ws
	var h := _relief_at_grid(gx, gz)
	var sx := _relief_at_grid(gx + 2, gz) - _relief_at_grid(gx - 2, gz)
	var sz := _relief_at_grid(gx, gz + 2) - _relief_at_grid(gx, gz - 2)
	var n := Vector3(-sx, 3.2, -sz).normalized()
	var shade := clampf(0.68 + 0.44 * n.dot(Vector3(-0.55, 0.72, -0.42).normalized()), 0.46, 1.18)
	var c := Color(shade, shade * 0.99, shade * 0.97, 1.0)
	return {"p": Vector3(wx - half, h * 1.45, wz - half), "c": c, "uv": Vector2(u, v)}

func tri(st: SurfaceTool, a: Dictionary, b: Dictionary, c: Dictionary) -> void:
	for v: Dictionary in [a, b, c]:
		st.set_color(v.c)
		st.set_uv(v.uv)
		st.add_vertex(v.p)

func make_cone(r: float, h: float, top: Color, rim: Color) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.vertex_color_use_as_albedo = true
	st.set_material(mat)
	for i in 12:
		var a0 := TAU * float(i) / 12.0
		var a1 := TAU * float(i + 1) / 12.0
		var p0 := Vector3(cos(a0) * r, 0, sin(a0) * r)
		var p1 := Vector3(cos(a1) * r, 0, sin(a1) * r)
		st.set_color(top)
		st.add_vertex(Vector3(0, h, 0))
		st.set_color(rim)
		st.add_vertex(p0)
		st.add_vertex(p1)
	return st.commit()

func _process(_d: float) -> void:
	if not visible or world == null:
		return
	var ws: float = float(world.world_size)
	var half := ws * 0.5
	var hp: Vector2 = world.hero_pos
	hero_pin.position = Vector3(hp.x - half, relief_at_world(hp.x, hp.y) * 1.45 + 10.0, hp.y - half)
	var pin_sc := clampf(distance / 820.0, 0.26, 1.0)
	var show_cones := (distance > 460.0)
	capital_pin.visible = show_cones
	hero_pin.visible = show_cones
	capital_pin.scale = Vector3.ONE * pin_sc
	hero_pin.scale = Vector3.ONE * pin_sc
	for child in pins.get_children():
		if child is Node3D:
			(child as Node3D).scale = Vector3.ONE * pin_sc

	if terrain_mat != null:
		terrain_mat.set_shader_parameter("zoom_detail", zoom_detail_level())

	var ty := relief_at_world(focus_offset.x + half, focus_offset.y + half) * 1.45 + 12.0
	var target := Vector3(focus_offset.x, ty, focus_offset.y)
	var dir := Vector3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw))
	cam.look_at_from_position(target + dir * distance, target, Vector3.UP)
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.button_index == MOUSE_BUTTON_LEFT:
			dragging = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_MIDDLE:
			panning = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			distance = clampf(distance * 0.86, 145.0, 1450.0)
			if world != null and distance < 460.0 and focus_offset.length() < 4.0:
				var half: float = float(world.world_size) * 0.5
				focus_offset = focus_offset.lerp(world.capital_center - Vector2(half, half), 0.35)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			distance = clampf(distance / 0.86, 145.0, 1450.0)
			if distance > 780.0:
				focus_offset = focus_offset.lerp(Vector2.ZERO, 0.35)
	elif event is InputEventMouseMotion:
		var mm: InputEventMouseMotion = event
		if dragging:
			if Input.is_key_pressed(KEY_SHIFT):
				pan_map(mm.relative)
			else:
				orbit(mm.relative)
		elif panning:
			pan_map(mm.relative)

func orbit(rel: Vector2) -> void:
	yaw -= rel.x * 0.009
	pitch = clampf(pitch + rel.y * 0.007, 0.32, 1.38)

func pan_map(rel: Vector2) -> void:
	var scale_p := distance * 0.0014
	var right_v := Vector2(cos(yaw), -sin(yaw))
	var fwd_v := Vector2(-sin(yaw), -cos(yaw))
	focus_offset += (-right_v * rel.x + fwd_v * rel.y) * scale_p
	focus_offset.x = clampf(focus_offset.x, -420.0, 420.0)
	focus_offset.y = clampf(focus_offset.y, -420.0, 420.0)

func _project(wx: float, wz: float, h_bias: float = 0.0) -> Variant:
	var ws: float = float(world.world_size)
	var half := ws * 0.5
	var vp_s := Vector2(vp.size)
	if vp_s.x <= 1.0 or vp_s.y <= 1.0:
		return null
	var p3 := Vector3(wx - half, relief_at_world(wx, wz) * 1.45 + h_bias, wz - half)
	if cam.is_position_behind(p3):
		return null
	return cam.unproject_position(p3) * (size / vp_s)

func _draw_capital_crown_star(pos: Vector2, r: float) -> void:
	var pts := PackedVector2Array()
	for i in 16:
		var ang := -PI * 0.5 + TAU * float(i) / 16.0
		var rad := r if (i % 2 == 0) else (r * 0.45)
		pts.append(pos + Vector2(cos(ang), sin(ang)) * rad)
	draw_colored_polygon(pts, Color(1.0, 0.86, 0.28, 1.0))
	pts.append(pts[0])
	draw_polyline(pts, Color(0.14, 0.07, 0.02, 0.98), 1.8, true)
	draw_circle(pos, r * 0.28, Color(1.0, 0.98, 0.88, 1.0))

func _draw_town_shield(pos: Vector2, r: float) -> void:
	var pts := PackedVector2Array([
		pos + Vector2(0.0, -r),
		pos + Vector2(r * 0.88, -r * 0.35),
		pos + Vector2(r * 0.72, r * 0.52),
		pos + Vector2(0.0, r),
		pos + Vector2(-r * 0.72, r * 0.52),
		pos + Vector2(-r * 0.88, -r * 0.35),
	])
	draw_colored_polygon(pts, Color(0.76, 0.88, 0.98, 0.98))
	pts.append(pts[0])
	draw_polyline(pts, Color(0.08, 0.12, 0.18, 0.98), 1.6, true)
	draw_circle(pos, r * 0.30, Color(1.0, 0.84, 0.36, 1.0))

func _draw_service_dot(pos: Vector2, fill: Color, r: float) -> void:
	draw_circle(pos, r + 1.6, Color(0.05, 0.04, 0.03, 0.95))
	draw_circle(pos, r, fill)
	draw_circle(pos + Vector2(-r * 0.25, -r * 0.25), r * 0.28, Color(1.0, 1.0, 1.0, 0.55))

func _draw() -> void:
	var f: Font = MapStyle.body_font()
	var ft: Font = MapStyle.font()
	var rect := Rect2(Vector2.ZERO, size)
	if world == null:
		return
	var detail := zoom_detail_level()
	var zoom_x := clampf(920.0 / maxf(distance, 120.0), 0.7, 6.5)
	var inner_rect := Rect2(10.0, 52.0, size.x - 20.0, size.y - 96.0)

	# 1. ALL REAL IN-GAME VECTOR ROADS draped directly on 3D relief — sharpening with EVERY zoom step!
	if "roads" in world:
		var road_alpha := lerpf(0.55, 0.96, detail)
		for rd: Dictionary in world.roads:
			var raw_pts: Array = rd.get("pts", [])
			if raw_pts.size() < 2:
				continue
			var tier := str(rd.get("tier", "footpath"))
			var spts := PackedVector2Array()
			for pt: Array in raw_pts:
				var sp: Variant = _project(float(pt[0]), float(pt[1]), 2.0)
				if sp != null:
					var spv: Vector2 = sp
					if inner_rect.has_point(spv):
						spts.append(spv)
					else:
						if spts.size() >= 2:
							var w_out := lerpf(1.6, 3.8, detail) if tier in ["highway", "ring"] else lerpf(1.2, 2.8, detail)
							draw_polyline(spts, Color(0.08, 0.05, 0.03, road_alpha * 0.85), w_out + 1.8, true)
							draw_polyline(spts, Color(0.96, 0.86, 0.60, road_alpha) if tier != "footpath" else Color(0.86, 0.76, 0.56, road_alpha * 0.88), w_out, true)
						spts.clear()
			if spts.size() >= 2:
				var w_out := lerpf(1.6, 3.8, detail) if tier in ["highway", "ring"] else lerpf(1.2, 2.8, detail)
				draw_polyline(spts, Color(0.08, 0.05, 0.03, road_alpha * 0.85), w_out + 1.8, true)
				draw_polyline(spts, Color(0.96, 0.86, 0.60, road_alpha) if tier != "footpath" else Color(0.86, 0.76, 0.56, road_alpha * 0.88), w_out, true)

	# 2. Progressive Building & Settlement Symbols (Capital Star vs Town Shield vs Small Enterable Utility Dots!)
	var placed_labels: Array[Rect2] = []
	for b: Dictionary in world.buildings:
		var role := str(b.get("role", ""))
		var mk := str(b.get("map_kind", ""))
		var is_ent := bool(b.get("enterable", false))
		var bx := float(b.get("x", 512.0))
		var bz := float(b.get("z", 512.0))
		var sp_v: Variant = _project(bx, bz, 5.0)
		if sp_v == null:
			continue
		var sp: Vector2 = sp_v
		if not inner_rect.has_point(sp):
			continue

		if role == "bridge" and detail >= 0.18:
			var br := lerpf(3.0, 6.2, detail)
			draw_rect(Rect2(sp - Vector2(br, br * 0.6), Vector2(br * 2.0, br * 1.2)), Color(0.78, 0.60, 0.34, 0.94))
			draw_rect(Rect2(sp - Vector2(br, br * 0.6), Vector2(br * 2.0, br * 1.2)), Color(0.08, 0.05, 0.03, 0.95), false, 1.3)
		elif mk == "capital":
			_draw_capital_crown_star(sp, lerpf(9.5, 13.0, detail))
		elif mk == "town":
			_draw_town_shield(sp, lerpf(7.5, 10.5, detail))
			if detail >= 0.25:
				var tname := str(b.get("title", ""))
				var tw := f.get_string_size(tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
				var lp := Vector2(clampf(sp.x - tw * 0.5, 18.0, size.x - tw - 18.0), clampf(sp.y - 14.0, 66.0, size.y - 48.0))
				draw_string_outline(f, lp, tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0.03, 0.04, 0.06, 0.95))
				draw_string(f, lp, tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.84, 0.92, 1.0))
		elif is_ent and detail >= 0.15:
			# Small crisp dot for EVERY enterable utility building!
			var dot_col := Color(0.98, 0.84, 0.42)
			match role:
				"smithy": dot_col = Color(1.0, 0.52, 0.18)
				"inn": dot_col = Color(1.0, 0.76, 0.34)
				"shop": dot_col = Color(0.32, 0.94, 0.54)
				"arena": dot_col = Color(0.96, 0.30, 0.30)
				"depot": dot_col = Color(0.36, 0.86, 1.0)
				"hall": dot_col = Color(0.88, 0.74, 1.0)
			_draw_service_dot(sp, dot_col, lerpf(3.2, 5.4, detail))
			# At deep zoom, reveal individual enterable utility building names!
			if detail >= 0.58:
				var btitle := str(b.get("title", ""))
				var tw := f.get_string_size(btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
				var lx := clampf(sp.x - tw * 0.5, 18.0, size.x - tw - 18.0)
				var ly := clampf(sp.y - 10.0, 66.0, size.y - 50.0)
				var box := Rect2(lx - 3.0, ly - 11.0, tw + 6.0, 14.0)
				var collides := false
				for prev: Rect2 in placed_labels:
					if box.intersects(prev):
						collides = true
						break
				if not collides:
					placed_labels.append(box)
					draw_string_outline(f, Vector2(lx, ly), btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 4, Color(0.03, 0.02, 0.02, 0.95))
					draw_string(f, Vector2(lx, ly), btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(1.0, 0.94, 0.76))
		elif role in ["house", "gate", "tower"] and detail >= 0.55:
			var hr := lerpf(2.2, 3.8, detail)
			draw_rect(Rect2(sp - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), Color(0.54, 0.48, 0.42, 0.82))
			draw_rect(Rect2(sp - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), Color(0.08, 0.06, 0.05, 0.92), false, 1.0)

	# 3. Capital Banner
	var cap_p: Vector2 = world.capital_center
	var cap_s_v: Variant = _project(cap_p.x, cap_p.y, 44.0)
	if cap_s_v != null:
		var cs: Vector2 = cap_s_v
		if inner_rect.has_point(cs):
			draw_string_outline(ft, cs + Vector2(-46, 0), "★ STOLICA", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 5, Color(0.03, 0.02, 0.02, 0.95))
			draw_string(ft, cs + Vector2(-46, 0), "★ STOLICA", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.90, 0.44))

	# 4. Exp-Zone Labels
	var ws: float = float(world.world_size)
	for ez: Dictionary in world.exp_zones:
		var lp := _snap_pin_to_land(float(ez.x), float(ez.z), ws)
		var es_v: Variant = _project(lp.x, lp.y, 28.0)
		if es_v != null:
			var s: Vector2 = es_v
			if not inner_rect.has_point(s):
				continue
			var ename := str(ez.name)
			var tw := f.get_string_size(ename, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			var lx := clampf(s.x - tw * 0.5, 18.0, size.x - tw - 18.0)
			var ly := clampf(s.y - 4.0, 66.0, size.y - 50.0)
			var box := Rect2(lx - 4.0, ly - 13.0, tw + 8.0, 16.0)
			for _attempt in 5:
				var hit := false
				for prev: Rect2 in placed_labels:
					if box.intersects(prev):
						ly = clampf(ly + 16.0, 66.0, size.y - 50.0)
						box.position.y = ly - 13.0
						hit = true
						break
				if not hit:
					break
			placed_labels.append(box)
			draw_string_outline(f, Vector2(lx, ly), ename, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0.03, 0.02, 0.02, 0.94))
			draw_string(f, Vector2(lx, ly), ename, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.86, 0.66))

	# 5. Live Hero Position Beacon
	var hp_s_v: Variant = _project(world.hero_pos.x, world.hero_pos.y, 24.0)
	if hp_s_v != null:
		var hs: Vector2 = hp_s_v
		if inner_rect.has_point(hs):
			draw_circle(hs, 7.0, Color(0.24, 0.96, 1.0, 0.34))
			draw_circle(hs, 4.2, Color(0.24, 0.96, 1.0, 1.0))
			draw_circle(hs, 2.0, Color(1.0, 1.0, 1.0, 1.0))

	# 6. Top Header Plaque & Bottom Legend Bar
	draw_rect(rect, Color(0.86, 0.68, 0.36, 0.90), false, 3.0)
	draw_rect(Rect2(12, 10, size.x - 24, 38), Color(0.03, 0.04, 0.06, 0.86))
	draw_rect(Rect2(12, 10, size.x - 24, 38), Color(0.86, 0.68, 0.36, 0.55), false, 1.5)
	var title: String = str(world.region_title)
	draw_string(f, Vector2(24, 34), "%s — Mapa 3D (Zoom %.1f× • Kółko = Przybliż szczegóły • Shift+LPM = Przesuń • [M] Zamknij)" % [title, zoom_x], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.98, 0.90, 0.72))

	var leg := Rect2(12, size.y - 38, size.x - 24, 28)
	draw_rect(leg, Color(0.03, 0.04, 0.06, 0.86))
	draw_rect(leg, Color(0.76, 0.58, 0.30, 0.55), false, 1.2)
	var lx_pos := leg.position.x + 22.0
	var ly_mid := leg.position.y + 14.0
	_draw_capital_crown_star(Vector2(lx_pos, ly_mid), 7.0)
	draw_string(f, Vector2(lx_pos + 12, ly_mid + 4), "Stolica", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.90, 0.58))
	lx_pos += 88.0
	_draw_town_shield(Vector2(lx_pos, ly_mid), 6.2)
	draw_string(f, Vector2(lx_pos + 11, ly_mid + 4), "Miasto / Warownia", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.82, 0.90, 1.0))
	lx_pos += 155.0
	_draw_service_dot(Vector2(lx_pos, ly_mid), Color(0.32, 0.94, 0.54), 3.8)
	draw_string(f, Vector2(lx_pos + 10, ly_mid + 4), "Budynek użytkowy (wejście)", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.86, 0.94, 0.86))
	lx_pos += 205.0
	draw_line(Vector2(lx_pos - 8, ly_mid), Vector2(lx_pos + 14, ly_mid), Color(0.96, 0.86, 0.60, 0.95), 3.0, true)
	draw_string(f, Vector2(lx_pos + 20, ly_mid + 4), "Wszystkie drogi i mosty", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.94, 0.88, 0.74))
	lx_pos += 188.0
	draw_circle(Vector2(lx_pos, ly_mid), 4.5, Color(0.96, 0.28, 0.20))
	draw_string(f, Vector2(lx_pos + 10, ly_mid + 4), "Expowiska", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.72, 0.58))
