class_name GlobeView
extends SubViewportContainer
## 3D planet Superior: a sphere wrapping the painted atlas, drifting clouds, region outlines from the same traced polygons
## as the 2D map, markers for the settlements and for the hero. Drag to turn, pinch / wheel to zoom, tap to pick a region.

signal region_picked(id: String)

const GLOBE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_back;
uniform sampler2D color_tex : source_color, filter_linear_mipmap;
uniform sampler2D cloud_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float cloud_shift = 0.0;
void fragment() {
	vec3 c = texture(color_tex, UV).rgb;
	float cl = texture(cloud_tex, vec2(UV.x + cloud_shift, UV.y)).r;
	vec3 sun = normalize(vec3(-0.45, 0.4, 0.8));
	float lit = clamp(dot(NORMAL, sun), 0.0, 1.0);
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.2);
	vec3 col = c * (0.42 + 0.78 * lit);
	col = mix(col, vec3(1.0), cl * 0.30 * (0.4 + 0.6 * lit));
	col += vec3(0.30, 0.55, 1.0) * rim * 0.75;
	ALBEDO = col;
}
"""

var regions: Array = []
var viewport := SubViewport.new()
var pivot := Node3D.new()
var camera := Camera3D.new()
var planet := MeshInstance3D.new()
var globe_material := ShaderMaterial.new()
var outlines := Node3D.new()
var markers := Node3D.new()
var highlight := MeshInstance3D.new()
var lon0 := -52.8
var lat0 := -30.0
var distance := 2.7
var velocity := Vector2.ZERO
var idle := 0.0
var dragging := false
var drag_moved := false
var drag_start := Vector2.ZERO
var selected := ""
var player_marker: MeshInstance3D
var clouds := 0.0

static func surface(lon_deg: float, lat_deg: float, radius: float = 1.0) -> Vector3:
	var lon := deg_to_rad(lon_deg)
	var lat := deg_to_rad(lat_deg)
	return Vector3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)) * radius

func setup(color: Texture2D, cloud: Texture2D, region_list: Array, player_atlas: Vector2) -> void:
	regions = region_list
	stretch = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	viewport.own_world_3d = true
	viewport.transparent_bg = true
	viewport.msaa_3d = Viewport.MSAA_2X
	viewport.handle_input_locally = false
	add_child(viewport)
	camera.fov = 38.0
	camera.position = Vector3(0, 0, distance)
	camera.current = true
	viewport.add_child(camera)
	var shader := Shader.new()
	shader.code = GLOBE_SHADER
	globe_material.shader = shader
	globe_material.set_shader_parameter("color_tex", color)
	globe_material.set_shader_parameter("cloud_tex", cloud)
	planet.mesh = build_sphere(96, 192)
	planet.material_override = globe_material
	pivot.add_child(planet)
	pivot.add_child(outlines)
	pivot.add_child(markers)
	viewport.add_child(pivot)
	build_outlines()
	add_marker(MapMath.atlas_to_lonlat(player_atlas), Color("ff4a2e"), 0.018)
	player_marker = markers.get_child(markers.get_child_count() - 1)
	for region: Dictionary in regions:
		var sp = region.get("settlementPoint")
		if sp != null:
			add_marker(MapMath.atlas_to_lonlat(Vector2(float(sp.x), float(sp.y))), Color("ffd36a"), 0.011)
		if region.kind == "continent":
			var label := Label3D.new()
			label.text = str(region.name)
			label.font_size = 56
			label.pixel_size = 0.0011
			label.outline_size = 14
			label.outline_modulate = Color(0.05, 0.03, 0.02, 0.95)
			label.modulate = Color("ffe9bd") if bool(region.playable) else Color("e6eef7")
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.no_depth_test = false
			var c := MapMath.atlas_to_lonlat(Vector2(float(region.label.x), float(region.label.y)))
			label.position = surface(c.x, c.y, 1.045)
			markers.add_child(label)
	highlight.visible = false
	pivot.add_child(highlight)
	apply_rotation()

func build_sphere(rings: int, segments: int) -> ArrayMesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in rings:
		for s in segments:
			var corners := [[r, s], [r + 1, s + 1], [r + 1, s], [r, s], [r, s + 1], [r + 1, s + 1]]
			for c in corners:
				var lat := 90.0 - 180.0 * float(c[0]) / float(rings)
				var lon := -180.0 + 360.0 * float(c[1]) / float(segments)
				var v := surface(lon, lat)
				tool.set_normal(v)
				tool.set_uv(Vector2(float(c[1]) / float(segments), float(c[0]) / float(rings)))
				tool.add_vertex(v)
	return tool.commit()

func line_mesh(points: PackedVector3Array, color: Color) -> MeshInstance3D:
	var mesh := ImmediateMesh.new()
	mesh.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
	for p in points:
		mesh.surface_set_color(color)
		mesh.surface_add_vertex(p)
	mesh.surface_end()
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	instance.material_override = m
	return instance

func region_points(region: Dictionary, radius: float) -> PackedVector3Array:
	var points := PackedVector3Array()
	var poly := MapMath.polygon(region)
	for p in poly:
		var ll := MapMath.atlas_to_lonlat(p)
		points.append(surface(ll.x, ll.y, radius))
	points.append(points[0])
	return points

func build_outlines() -> void:
	for region: Dictionary in regions:
		var color := Color(1.0, 0.75, 0.4, 0.8) if bool(region.playable) else Color(0.9, 0.95, 1.0, 0.35)
		outlines.add_child(line_mesh(region_points(region, 1.003), color))

func add_marker(lonlat: Vector2, color: Color, radius: float) -> void:
	var mesh := SphereMesh.new()
	mesh.radius = radius
	mesh.height = radius * 2.0
	mesh.radial_segments = 12
	mesh.rings = 6
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = color
	instance.material_override = m
	instance.position = surface(lonlat.x, lonlat.y, 1.012)
	markers.add_child(instance)

func apply_rotation() -> void:
	pivot.basis = Basis(Vector3.RIGHT, deg_to_rad(lat0)) * Basis(Vector3.UP, deg_to_rad(-lon0))
	camera.position = Vector3(0, 0, distance)

func focus_on(lonlat: Vector2) -> void:
	lon0 = lonlat.x
	lat0 = clampf(lonlat.y, -80.0, 80.0)
	velocity = Vector2.ZERO
	idle = 0.0
	apply_rotation()

func select(id: String) -> void:
	selected = id
	if is_instance_valid(highlight.mesh):
		highlight.mesh = null
	for child in highlight.get_children():
		child.queue_free()
	for region: Dictionary in regions:
		if region.id == id:
			var line := line_mesh(region_points(region, 1.006), Color(1.0, 0.9, 0.5, 1.0))
			highlight.add_child(line)
			highlight.visible = true
			return
	highlight.visible = false

func zoom_by(factor: float) -> void:
	distance = clampf(distance / factor, 1.55, 5.0)
	apply_rotation()

func _process(delta: float) -> void:
	if not is_visible_in_tree():
		return
	clouds += delta * 0.0028
	globe_material.set_shader_parameter("cloud_shift", clouds)
	idle += delta
	if not dragging:
		lon0 -= velocity.x * delta
		lat0 = clampf(lat0 + velocity.y * delta, -80.0, 80.0)
		velocity *= pow(0.02, delta)
		if idle > 3.0:
			lon0 += 4.5 * delta
	apply_rotation()
	if is_instance_valid(player_marker):
		player_marker.scale = Vector3.ONE * (1.0 + 0.35 * sin(Time.get_ticks_msec() / 220.0))

func degrees_per_pixel() -> float:
	return 52.0 / maxf(size.y, 1.0) * (distance / 3.1)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom_by(1.12)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom_by(1.0 / 1.12)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			if event.pressed:
				dragging = true
				drag_moved = false
				drag_start = event.position
				velocity = Vector2.ZERO
				idle = 0.0
			else:
				if dragging and not drag_moved:
					pick(event.position)
				dragging = false
				idle = 0.0
	elif event is InputEventMouseMotion and dragging:
		if (event.position - drag_start).length() > 12.0:
			drag_moved = true
		if drag_moved:
			var k := degrees_per_pixel()
			lon0 -= event.relative.x * k
			lat0 = clampf(lat0 + event.relative.y * k, -80.0, 80.0)
			velocity = Vector2(event.relative.x * k * 30.0, event.relative.y * k * 30.0)
			idle = 0.0
	elif event is InputEventMagnifyGesture:
		zoom_by(event.factor)

## Screen point -> {lonlat} when it lands on the sphere.
func screen_to_lonlat(at: Vector2) -> Variant:
	var scale_factor := Vector2(viewport.size) / maxf(size.x, 1.0)
	var local := at * scale_factor.x
	var origin := camera.project_ray_origin(local)
	var direction := camera.project_ray_normal(local)
	var b := origin.dot(direction)
	var c := origin.dot(origin) - 1.0
	var h := b * b - c
	if h < 0.0:
		return null
	var t := -b - sqrt(h)
	var hit := origin + direction * t
	var inside := pivot.basis.inverse() * hit
	return Vector2(rad_to_deg(atan2(inside.x, inside.z)), rad_to_deg(asin(clampf(inside.y, -1.0, 1.0))))

func pick(at: Vector2) -> void:
	var ll: Variant = screen_to_lonlat(at)
	if ll == null:
		return
	var region := MapMath.region_at(regions, MapMath.lonlat_to_atlas(ll.x, ll.y))
	if region.is_empty():
		select("")
		return
	select(str(region.id))
	region_picked.emit(str(region.id))
