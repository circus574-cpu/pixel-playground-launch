extends SubViewportContainer
## Rotatable 3D local relief map sharing height.r32, weights.png, surface.png, and landmarks
## with the 2D isometric world across all 4 capitals (Pyra, Verdantia, Aetheria, Nexus-9).
var world: Node2D
var vp := SubViewport.new()
var root := Node3D.new()
var terrain_node := MeshInstance3D.new()
var cam := Camera3D.new()
var hero_pin := MeshInstance3D.new()
var pins := Node3D.new()
var yaw := -0.785398
var pitch := 0.72
var distance := 240.0
var dragging := false
var touches: Dictionary = {}
var pinch_span := 0.0
const STEP := 4

func _ready() -> void:
	stretch = true
	vp.own_world_3d = true
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE
	add_child(vp)
	vp.add_child(root)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.035, 0.032, 0.04, 1)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.92, 0.88, 0.82)
	e.ambient_light_energy = 1.0
	env.environment = e
	root.add_child(env)
	root.add_child(terrain_node)
	root.add_child(pins)
	hero_pin.mesh = make_cone(2.6, 8.5, Color(1, 0.92, 0.35), Color(1, 0.35, 0.1))
	root.add_child(hero_pin)
	cam.fov = 38.0
	cam.near = 1.0
	cam.far = 900.0
	root.add_child(cam)
	rebuild_for_region()

func rebuild_for_region() -> void:
	if world == null or world.heights.is_empty():
		return
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for gz in range(0, world.grid_size - STEP, STEP):
		for gx in range(0, world.grid_size - STEP, STEP):
			var p00 := cell(gx, gz)
			var p10 := cell(gx + STEP, gz)
			var p11 := cell(gx + STEP, gz + STEP)
			var p01 := cell(gx, gz + STEP)
			tri(st, p00, p10, p11)
			tri(st, p00, p11, p01)
	terrain_node.mesh = st.commit()
	var mat := ShaderMaterial.new()
	mat.shader = load("res://shaders/map_3d.gdshader")
	var rdir: String = "res://regions/" + str(world.current_land)
	for i in 4:
		mat.set_shader_parameter("mat_%d_tex" % i, world.load_tex("%s/mat_%d.webp" % [rdir, i]))
	mat.set_shader_parameter("water_tex", world.load_tex("%s/water.png" % rdir))
	mat.set_shader_parameter("weights_tex", world.load_tex("%s/weights.png" % rdir))
	mat.set_shader_parameter("surface_tex", world.load_tex("%s/surface.png" % rdir))
	mat.set_shader_parameter("surface_color", world.surface_color_for(world.current_land))
	terrain_node.material_override = mat

	for child in pins.get_children():
		child.queue_free()
	for lm: Dictionary in world.landmarks:
		var pin := MeshInstance3D.new()
		pin.mesh = make_cone(2.0, 6.5, Color(0.96, 0.65, 0.22), Color(0.55, 0.18, 0.08))
		var lx := float(lm.x)
		var lz := float(lm.z)
		pin.position = Vector3(lx - 128.0, world.height_at(lx, lz) + 3.4, lz - 128.0)
		pins.add_child(pin)

func cell(gx: int, gz: int) -> Dictionary:
	var wx: float = float(gx) * float(world.world_size) / float(world.grid_size - 1)
	var wz: float = float(gz) * float(world.world_size) / float(world.grid_size - 1)
	var h: float = world.heights[gz * world.grid_size + gx]
	var sx: float = world.heights[gz * world.grid_size + mini(world.grid_size - 1, gx + 2)] - world.heights[gz * world.grid_size + maxi(0, gx - 2)]
	var sz: float = world.heights[mini(world.grid_size - 1, gz + 2) * world.grid_size + gx] - world.heights[maxi(0, gz - 2) * world.grid_size + gx]
	var n := Vector3(-sx, 2.0, -sz).normalized()
	var shade := clampf(0.50 + 0.56 * n.dot(Vector3(-0.55, 0.72, -0.42).normalized()), 0.25, 1.15)
	if world.walkable[gz * world.grid_size + gx] == 0:
		shade *= 0.80
	var c := Color(shade, shade * 0.96, shade * 0.92, 1.0)
	var uv := Vector2(float(gx) / float(world.grid_size - 1), float(gz) / float(world.grid_size - 1))
	return {"p": Vector3(wx - 128.0, h, wz - 128.0), "c": c, "uv": uv}

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
	var hp: Vector2 = world.hero_pos
	hero_pin.position = Vector3(hp.x - 128.0, world.height_at(hp.x, hp.y) + 4.4, hp.y - 128.0)
	var target := Vector3(0, 32, 0)
	var dir := Vector3(cos(pitch) * sin(yaw), sin(pitch), cos(pitch) * cos(yaw))
	cam.look_at_from_position(target + dir * distance, target, Vector3.UP)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_LEFT:
			dragging = event.pressed
		elif event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			distance = clampf(distance - 16.0, 120.0, 380.0)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			distance = clampf(distance + 16.0, 120.0, 380.0)
	elif event is InputEventMouseMotion and dragging:
		orbit(event.relative)
	elif event is InputEventScreenTouch:
		if event.pressed:
			touches[event.index] = event.position
		else:
			touches.erase(event.index)
		pinch_span = two_span()
	elif event is InputEventScreenDrag:
		touches[event.index] = event.position
		if touches.size() == 1:
			orbit(event.relative)
		elif touches.size() >= 2:
			var s := two_span()
			if pinch_span > 1.0:
				distance = clampf(distance - (s - pinch_span) * 0.55, 120.0, 380.0)
			pinch_span = s

func orbit(rel: Vector2) -> void:
	yaw -= rel.x * 0.009
	pitch = clampf(pitch + rel.y * 0.007, 0.35, 1.32)

func two_span() -> float:
	if touches.size() < 2:
		return 0.0
	var k := touches.keys()
	return (touches[k[0]] as Vector2).distance_to(touches[k[1]] as Vector2)

func _draw() -> void:
	var f: Font = ThemeDB.fallback_font
	var rect := Rect2(Vector2.ZERO, size)
	draw_rect(rect, Color(0.86, 0.68, 0.36, 0.85), false, 3.0)
	draw_rect(Rect2(12, 10, size.x - 24, 34), Color(0.03, 0.025, 0.025, 0.78))
	var title: String = str(world.region_title) if world != null else "Region"
	draw_string(f, Vector2(22, 33), "%s — mapa 3D (przeciągnij: obrót, kółko: zbliżenie)" % title, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.98, 0.90, 0.72))
	for lm: Dictionary in (world.landmarks if world != null else []):
		var p := Vector3(float(lm.x) - 128.0, world.height_at(float(lm.x), float(lm.z)) + 10.0, float(lm.z) - 128.0)
		if not cam.is_position_behind(p):
			var s := cam.unproject_position(p) * (size / Vector2(vp.size))
			draw_string_outline(f, s + Vector2(-42, -4), str(lm.title), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0.03, 0.02, 0.02, 0.92))
			draw_string(f, s + Vector2(-42, -4), str(lm.title), HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.98, 0.88, 0.66))
