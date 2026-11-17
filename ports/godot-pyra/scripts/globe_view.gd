class_name GlobeView
extends SubViewportContainer
## 3D planet Superior: a sphere wrapping the painted atlas, drifting clouds, region outlines from the same traced polygons
## as the 2D map, markers for the settlements and for the hero. Drag to turn, pinch / wheel to zoom, tap to pick a region.

signal region_picked(id: String)
signal detail_requested(id: String)

const GLOBE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_back;
#include "res://shaders/map_artwork.gdshaderinc"
uniform sampler2D cloud_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D select_tex : filter_linear;
uniform float cloud_shift = 0.0;
uniform float select_on = 0.0;
void fragment() {
	vec3 c = map_artwork(UV);
	float cl = texture(cloud_tex, vec2(UV.x + cloud_shift, UV.y)).r;
	float cl_shadow = texture(cloud_tex, vec2(UV.x + cloud_shift - 0.004, UV.y + 0.003)).r;
	vec3 sun = normalize(vec3(-0.45, 0.4, 0.8));
	float ndl = dot(NORMAL, sun);
	float lit = clamp(ndl, 0.0, 1.0);
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.2);
	float water = smoothstep(0.02, 0.12, c.b - max(c.r, c.g));
	vec3 col = c * (0.36 + 0.82 * lit);
	col *= 1.0 - cl_shadow * 0.22 * lit;
	// sun glint on the sea, warm band along the terminator
	vec3 refl = reflect(-sun, NORMAL);
	float glint = pow(clamp(dot(refl, VIEW), 0.0, 1.0), 38.0) * water;
	col += vec3(1.0, 0.95, 0.82) * glint * 0.55;
	col += vec3(1.0, 0.55, 0.25) * smoothstep(0.0, 0.25, ndl) * (1.0 - smoothstep(0.25, 0.5, ndl)) * 0.10;
	col = mix(col, vec3(1.0), cl * 0.28 * (0.4 + 0.6 * lit));
	float m = texture(select_tex, UV).r * select_on;
	col = mix(col, vec3(1.0, 0.82, 0.38), m * (0.26 + 0.08 * sin(TIME * 3.0)));
	col += vec3(0.30, 0.55, 1.0) * rim * 0.75;
	ALBEDO = col;
}
""" 

const CLOUD_SHADER := """
shader_type spatial;
render_mode unshaded, cull_back, blend_mix, depth_draw_never;
uniform sampler2D cloud_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float cloud_shift = 0.0;
void fragment() {
	float cl = texture(cloud_tex, vec2(UV.x + cloud_shift * 1.6, UV.y)).r;
	vec3 sun = normalize(vec3(-0.45, 0.4, 0.8));
	float lit = clamp(dot(NORMAL, sun), 0.0, 1.0);
	ALBEDO = vec3(1.0) * (0.55 + 0.45 * lit);
	ALPHA = clamp(cl * cl * 0.55, 0.0, 0.6);
}
"""

const ATMOSPHERE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_back, blend_add, depth_draw_never;
void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.4);
	ALBEDO = vec3(0.28, 0.55, 1.0) * f * 1.3;
	ALPHA = clamp(f, 0.0, 1.0);
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
var distance := 3.8
var velocity := Vector2.ZERO
var idle := 0.0
var dragging := false
var drag_moved := false
var drag_start := Vector2.ZERO
var selected := ""
var player_marker: Node3D
var clouds := 0.0
var cloud_material := ShaderMaterial.new()
var select_view := SubViewport.new()
var select_poly := Polygon2D.new()

static func surface(lon_deg: float, lat_deg: float, radius: float = 1.0) -> Vector3:
	var lon := deg_to_rad(lon_deg)
	var lat := deg_to_rad(lat_deg)
	return Vector3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon)) * radius

func setup(color: Texture2D, cloud: Texture2D, region_list: Array, player_atlas: Vector2, settlement_marks: Array[Dictionary] = []) -> void:
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
	globe_material.set_shader_parameter("canonical_tex", color)
	globe_material.set_shader_parameter("linear_input", true)
	globe_material.set_shader_parameter("relief_tex", load("res://assets/map/artwork/superior-relief.png"))
	globe_material.set_shader_parameter("cloud_tex", cloud)
	planet.mesh = build_sphere(96, 192)
	planet.material_override = globe_material
	pivot.add_child(planet)
	var cloud_shader := Shader.new()
	cloud_shader.code = CLOUD_SHADER
	cloud_material.shader = cloud_shader
	cloud_material.set_shader_parameter("cloud_tex", cloud)
	var cloud_shell := MeshInstance3D.new()
	cloud_shell.mesh = build_sphere(48, 96)
	cloud_shell.scale = Vector3.ONE * 1.014
	cloud_shell.material_override = cloud_material
	pivot.add_child(cloud_shell)
	var atmosphere := MeshInstance3D.new()
	var atmosphere_mesh := SphereMesh.new()
	atmosphere_mesh.radius = 1.0
	atmosphere_mesh.height = 2.0
	atmosphere_mesh.radial_segments = 96
	atmosphere_mesh.rings = 48
	atmosphere.mesh = atmosphere_mesh
	atmosphere.scale = Vector3.ONE * 1.07
	var atmosphere_shader := Shader.new()
	atmosphere_shader.code = ATMOSPHERE_SHADER
	var atmosphere_material := ShaderMaterial.new()
	atmosphere_material.shader = atmosphere_shader
	atmosphere.material_override = atmosphere_material
	viewport.add_child(atmosphere)
	# selected region mask in atlas space (painted into a small texture, sampled by the planet shader)
	select_view.size = Vector2i(1024, 512)
	select_view.disable_3d = true
	select_view.transparent_bg = false
	select_view.render_target_update_mode = SubViewport.UPDATE_ONCE
	var backdrop := ColorRect.new()
	backdrop.color = Color.BLACK
	backdrop.size = Vector2(1024, 512)
	select_view.add_child(backdrop)
	select_poly.color = Color.WHITE
	select_view.add_child(select_poly)
	viewport.add_child(select_view)
	globe_material.set_shader_parameter("select_tex", select_view.get_texture())
	pivot.add_child(outlines)
	pivot.add_child(markers)
	viewport.add_child(pivot)
	build_outlines()
	add_marker(MapMath.atlas_to_lonlat(player_atlas), Color("ff4a2e"), 0.030)
	player_marker = markers.get_child(markers.get_child_count() - 1)
	for mark in settlement_marks:
		add_marker(MapMath.atlas_to_lonlat(mark.atlas), Color("ffd36a"), 0.014)
	for region: Dictionary in regions:
		if region.kind == "continent":
			var label := Label3D.new()
			label.text = str(region.name)
			label.font = MapStyle.font()
			label.font_size = 44
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

static var glow_texture: GradientTexture2D

func glow(core: Color) -> Texture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.34, 0.5, 1.0])
	g.colors = PackedColorArray([core, core, Color(core.r, core.g, core.b, 0.35), Color(core.r, core.g, core.b, 0.0)])
	var tex := GradientTexture2D.new()
	tex.gradient = g
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 64
	tex.height = 64
	return tex

func add_marker(lonlat: Vector2, color: Color, radius: float) -> void:
	var sprite := Sprite3D.new()
	sprite.texture = glow(color)
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.shaded = false
	sprite.double_sided = true
	sprite.pixel_size = radius * 2.6 / 64.0
	sprite.transparent = true
	sprite.position = surface(lonlat.x, lonlat.y, 1.02)
	markers.add_child(sprite)

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
	for child in highlight.get_children():
		child.queue_free()
	for region: Dictionary in regions:
		if region.id == id:
			highlight.add_child(line_mesh(region_points(region, 1.006), Color(1.0, 0.9, 0.5, 1.0)))
			highlight.visible = true
			var scaled := PackedVector2Array()
			for p in MapMath.polygon(region):
				scaled.append(p * 0.512)
			select_poly.polygon = scaled
			select_view.render_target_update_mode = SubViewport.UPDATE_ONCE
			globe_material.set_shader_parameter("select_on", 1.0)
			return
	highlight.visible = false
	globe_material.set_shader_parameter("select_on", 0.0)

func zoom_by(factor: float) -> void:
	if factor > 1.0 and distance <= 3.46:
		var region := MapMath.region_at(regions, MapMath.lonlat_to_atlas(lon0, lat0))
		var target := str(region.get("id", selected))
		if target != "":
			detail_requested.emit(target)
			return
	distance = clampf(distance / factor, 3.45, 5.2)
	apply_rotation()

func _process(delta: float) -> void:
	if not is_visible_in_tree():
		return
	clouds += delta * 0.0028
	globe_material.set_shader_parameter("cloud_shift", clouds)
	cloud_material.set_shader_parameter("cloud_shift", clouds)
	idle += delta
	if not dragging:
		lon0 -= velocity.x * delta
		lat0 = clampf(lat0 + velocity.y * delta, -80.0, 80.0)
		velocity *= pow(0.02, delta)
		if idle > 3.0:
			lon0 += 4.5 * delta
	apply_rotation()
	if is_instance_valid(player_marker):
		player_marker.scale = Vector3.ONE * (1.0 + 0.3 * sin(Time.get_ticks_msec() / 220.0))

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
