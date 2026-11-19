extends SubViewportContainer
## Rotatable AAA 3D Continent Relief Map for KI Legends ([M] Mapa 3D).
## Sculpts a real 3D island mesh from regions/<land>/relief_3d.r32 draped with the canonical
## hand-painted continent cartography (regions/<land>/map_art.png), complete with dramatic
## mountain peaks, ocean basin, glowing magma/snow highlights, 3D Capital spire, 6 Exp-Zone pins,
## and live Hero beacon.

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
var yaw := -0.42
var pitch := 0.72
var distance := 780.0
var dragging := false
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
	e.fog_density = 0.00055
	env.environment = e
	root.add_child(env)

	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-42.0, -35.0, 0.0)
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.15
	root.add_child(sun)

	# Seamless infinite ocean skirt beneath the sculpted island mesh
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

	capital_pin.mesh = make_cone(11.0, 34.0, Color(1.0, 0.88, 0.36), Color(0.75, 0.50, 0.12))
	root.add_child(capital_pin)

	hero_pin.mesh = make_cone(9.0, 28.0, Color(0.28, 0.98, 1.0), Color(0.08, 0.45, 0.78))
	root.add_child(hero_pin)

	cam.fov = 36.0
	cam.near = 2.0
	cam.far = 3200.0
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
	distance = ws * 0.92

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

	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/map_3d.gdshader")
	var art_tex: Texture2D = world.load_tex("%s/map_art.png" % rdir)
	if art_tex == null:
		art_tex = world.load_tex("%s/minimap_hq.png" % rdir)
	mat.set_shader_parameter("map_art_tex", art_tex)
	mat.set_shader_parameter("is_pyra", 1.0 if land == "pyra" else 0.0)
	mat.set_shader_parameter("is_aether", 1.0 if land == "aether" else 0.0)
	terrain_node.material_override = mat

	var half := ws * 0.5
	var cap_p: Vector2 = world.capital_center
	capital_pin.position = Vector3(cap_p.x - half, relief_at_world(cap_p.x, cap_p.y) * 1.45 + 16.0, cap_p.y - half)

	for child in pins.get_children():
		child.queue_free()
	for ez: Dictionary in world.exp_zones:
		var pin := MeshInstance3D.new()
		pin.mesh = make_cone(7.0, 22.0, Color(1.0, 0.36, 0.22), Color(0.55, 0.10, 0.06))
		var lp := _snap_pin_to_land(float(ez.x), float(ez.z), ws)
		pin.position = Vector3(lp.x - half, relief_at_world(lp.x, lp.y) * 1.45 + 11.0, lp.y - half)
		pins.add_child(pin)

func _snap_pin_to_land(ex: float, ez_z: float, ws: float) -> Vector2:
	var center: Vector2 = world.capital_center if world != null else Vector2(ws * 0.5, ws * 0.5)
	var p := Vector2(ex, ez_z)
	# Keep exact canonical exp-zone location when already on sculpted land
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
	hero_pin.position = Vector3(hp.x - half, relief_at_world(hp.x, hp.y) * 1.45 + 18.0, hp.y - half)
	var target := Vector3(0.0, 22.0, 0.0)
	var dir := Vector3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw))
	cam.look_at_from_position(target + dir * distance, target, Vector3.UP)
	queue_redraw()

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		var mb: InputEventMouseButton = event
		if mb.button_index == MOUSE_BUTTON_LEFT:
			dragging = mb.pressed
		elif mb.button_index == MOUSE_BUTTON_WHEEL_UP and mb.pressed:
			distance = clampf(distance - 45.0, 300.0, 1500.0)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN and mb.pressed:
			distance = clampf(distance + 45.0, 300.0, 1500.0)
	elif event is InputEventMouseMotion and dragging:
		var mm: InputEventMouseMotion = event
		orbit(mm.relative)

func orbit(rel: Vector2) -> void:
	yaw -= rel.x * 0.009
	pitch = clampf(pitch + rel.y * 0.007, 0.32, 1.35)

func _draw() -> void:
	var f: Font = MapStyle.body_font()
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.86, 0.68, 0.36, 0.90), false, 3.0)
	draw_rect(Rect2(12, 10, size.x - 24, 38), Color(0.03, 0.04, 0.06, 0.84))
	draw_rect(Rect2(12, 10, size.x - 24, 38), Color(0.86, 0.68, 0.36, 0.55), false, 1.5)
	var title: String = str(world.region_title) if world != null else "Kontynent"
	draw_string(f, Vector2(24, 34), "%s — Mapa Reliefowa 3D (Obracaj myszą • Kółko = Zoom • [M] Zamknij)" % title, HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.98, 0.90, 0.72))
	if world == null:
		return
	var ws: float = float(world.world_size)
	var half := ws * 0.5
	var vp_s := Vector2(vp.size)
	if vp_s.x <= 1.0 or vp_s.y <= 1.0:
		return

	# Capital label at dynamic capital_center
	var cap_p: Vector2 = world.capital_center
	var cap_3d := Vector3(cap_p.x - half, relief_at_world(cap_p.x, cap_p.y) * 1.45 + 48.0, cap_p.y - half)
	if not cam.is_position_behind(cap_3d):
		var cs := cam.unproject_position(cap_3d) * (size / vp_s)
		draw_string_outline(f, cs + Vector2(-48, 0), "★ STOLICA", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 5, Color(0.03, 0.02, 0.02, 0.95))
		draw_string(f, cs + Vector2(-48, 0), "★ STOLICA", HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.90, 0.44))

	# Exp-zone labels snapped to land, safely clamped and vertically de-overlapped
	var placed_labels: Array[Rect2] = []
	for ez: Dictionary in world.exp_zones:
		var lp := _snap_pin_to_land(float(ez.x), float(ez.z), ws)
		var p := Vector3(lp.x - half, relief_at_world(lp.x, lp.y) * 1.45 + 32.0, lp.y - half)
		if not cam.is_position_behind(p):
			var s := cam.unproject_position(p) * (size / vp_s)
			var ename := str(ez.name)
			var tw := f.get_string_size(ename, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			var lx := clampf(s.x - tw * 0.5, 18.0, size.x - tw - 18.0)
			var ly := clampf(s.y - 4.0, 66.0, size.y - 16.0)
			var box := Rect2(lx - 4.0, ly - 13.0, tw + 8.0, 16.0)
			for _attempt in 5:
				var hit := false
				for prev: Rect2 in placed_labels:
					if box.intersects(prev):
						ly = clampf(ly + 16.0, 66.0, size.y - 16.0)
						box.position.y = ly - 13.0
						hit = true
						break
				if not hit:
					break
			placed_labels.append(box)
			draw_string_outline(f, Vector2(lx, ly), ename, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0.03, 0.02, 0.02, 0.94))
			draw_string(f, Vector2(lx, ly), ename, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.86, 0.66))
