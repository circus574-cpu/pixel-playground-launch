extends SubViewportContainer
## 3D planet Superior: a sphere wrapping the painted atlas, drifting clouds, region outlines from the same traced polygons
## as the 2D map, markers for the settlements and for the hero. Drag to turn, wheel to zoom, click to pick a region.

const MapMath := preload("res://scripts/map_math.gd")
const MapStyle := preload("res://scripts/map_style.gd")

signal region_picked(id: String)

const GLOBE_SHADER := """
shader_type spatial;
render_mode unshaded, cull_back;
uniform sampler2D color_tex : source_color, filter_linear_mipmap;
uniform sampler2D cloud_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D select_tex : filter_linear;
uniform float cloud_shift = 0.0;
uniform float select_on = 0.0;
uniform float zoom_detail = 0.0;
void fragment() {
	vec3 c = texture(color_tex, UV).rgb;
	if (zoom_detail > 0.01) {
		vec2 px = vec2(0.00045, 0.0009);
		vec3 blur = (
			texture(color_tex, UV + vec2(px.x, 0.0)).rgb +
			texture(color_tex, UV - vec2(px.x, 0.0)).rgb +
			texture(color_tex, UV + vec2(0.0, px.y)).rgb +
			texture(color_tex, UV - vec2(0.0, px.y)).rgb
		) * 0.25;
		c = clamp(c + (c - blur) * (0.65 * zoom_detail), 0.0, 1.0);
		float grain = fract(sin(dot(floor(UV * 3600.0), vec2(12.9898, 78.233))) * 43758.5453);
		c *= 1.0 + (grain - 0.5) * 0.045 * zoom_detail;
	}
	float cl_fade = 1.0 - smoothstep(0.25, 0.85, zoom_detail);
	float cl = texture(cloud_tex, vec2(UV.x + cloud_shift, UV.y)).r * cl_fade;
	float cl_shadow = texture(cloud_tex, vec2(UV.x + cloud_shift - 0.004, UV.y + 0.003)).r * cl_fade;
	vec3 sun = normalize(vec3(-0.45, 0.4, 0.8));
	float ndl = dot(NORMAL, sun);
	float lit = clamp(ndl, 0.0, 1.0);
	float rim = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.2);
	float water = smoothstep(0.02, 0.12, c.b - max(c.r, c.g));
	vec3 col = c * (0.48 + 0.72 * lit);
	col *= 1.0 - cl_shadow * 0.22 * lit;
	vec3 refl = reflect(-sun, NORMAL);
	float glint = pow(clamp(dot(refl, VIEW), 0.0, 1.0), 38.0) * water;
	col += vec3(1.0, 0.95, 0.82) * glint * 0.55;
	col += vec3(1.0, 0.55, 0.25) * smoothstep(0.0, 0.25, ndl) * (1.0 - smoothstep(0.25, 0.5, ndl)) * 0.10;
	col = mix(col, vec3(1.0), cl * 0.28 * (0.4 + 0.6 * lit));
	float m = texture(select_tex, UV).r * select_on;
	col = mix(col, vec3(1.0, 0.86, 0.44), m * (0.07 + 0.03 * sin(TIME * 3.0)));
	col += vec3(0.30, 0.55, 1.0) * rim * 0.75 * cl_fade;
	ALBEDO = col;
}
"""

const CLOUD_SHADER := """
shader_type spatial;
render_mode unshaded, cull_back, blend_mix, depth_draw_never;
uniform sampler2D cloud_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float cloud_shift = 0.0;
uniform float cloud_alpha = 1.0;
void fragment() {
	float cl = texture(cloud_tex, vec2(UV.x + cloud_shift * 1.6, UV.y)).r;
	vec3 sun = normalize(vec3(-0.45, 0.4, 0.8));
	float lit = clamp(dot(NORMAL, sun), 0.0, 1.0);
	ALBEDO = vec3(1.0) * (0.55 + 0.45 * lit);
	ALPHA = clamp(cl * cl * 0.55 * cloud_alpha, 0.0, 0.6);
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
var roads_3d := Node3D.new()
var markers := Node3D.new()
var detail_markers := Node3D.new()
var town_labels_3d := Node3D.new()
var bldg_labels_3d := Node3D.new()
var highlight := MeshInstance3D.new()
var lon0 := -52.8
var lat0 := -18.0
var distance := 2.95
var velocity := Vector2.ZERO
var idle := 0.0
var dragging := false
var drag_moved := false
var drag_start := Vector2.ZERO
var pinch_pts: Dictionary = {}
var pinch_dist := 0.0
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

func setup(
	color: Texture2D,
	cloud: Texture2D,
	region_list: Array,
	player_atlas: Vector2,
	continent_data: Dictionary = {},
	region_bboxes: Dictionary = {}
) -> void:
	regions = region_list
	stretch = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	viewport.own_world_3d = true
	viewport.transparent_bg = true
	viewport.msaa_3d = Viewport.MSAA_DISABLED
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.handle_input_locally = false
	add_child(viewport)
	camera.fov = 38.0
	camera.near = 0.01
	camera.far = 30.0
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
	pivot.add_child(roads_3d)
	pivot.add_child(markers)
	pivot.add_child(detail_markers)
	viewport.add_child(pivot)
	build_outlines()
	build_continent_roads_and_details(continent_data, region_bboxes)
	add_marker(MapMath.atlas_to_lonlat(player_atlas), Color("38f5ff"), 0.030, markers)
	player_marker = markers.get_child(markers.get_child_count() - 1)
	for region: Dictionary in regions:
		if str(region.get("kind", "")) == "continent":
			var label := Label3D.new()
			label.text = str(region.get("name", ""))
			label.font = MapStyle.font()
			label.font_size = 64
			label.pixel_size = 0.00115
			label.outline_size = 15
			label.outline_modulate = Color(0.05, 0.03, 0.02, 0.95)
			label.modulate = Color("ffe9bd") if bool(region.get("playable", true)) else Color("e6eef7")
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.no_depth_test = false
			var r_lbl: Dictionary = region.get("label", {"x": 1000.0, "y": 500.0})
			var c := MapMath.atlas_to_lonlat(Vector2(float(r_lbl.get("x", 1000.0)), float(r_lbl.get("y", 500.0))))
			label.position = surface(c.x, c.y, 1.048)
			markers.add_child(label)
	highlight.visible = false
	pivot.add_child(highlight)
	apply_rotation()

var pin_tex_cache: Dictionary = {}

func _load_pin_tex(key: String) -> Texture2D:
	if pin_tex_cache.has(key):
		return pin_tex_cache[key] as Texture2D
	var path := "res://assets/ui/map_icons/pin_%s.webp" % key
	var abs_p := ProjectSettings.globalize_path(path)
	var tex: Texture2D = null
	if FileAccess.file_exists(abs_p):
		var img := Image.new()
		if img.load(abs_p) == OK:
			tex = ImageTexture.create_from_image(img)
	pin_tex_cache[key] = tex
	return tex

func add_icon_marker(lonlat: Vector2, icon_key: String, world_diam: float, parent_node: Node3D = null, elev: float = 1.024) -> Sprite3D:
	var sprite := Sprite3D.new()
	var tex := _load_pin_tex(icon_key)
	if tex != null:
		sprite.texture = tex
		sprite.pixel_size = world_diam / float(max(tex.get_width(), 64))
	else:
		sprite.texture = glow(Color("ffd94a"))
		sprite.pixel_size = world_diam / 64.0
	sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	sprite.shaded = false
	sprite.double_sided = true
	sprite.transparent = true
	sprite.position = surface(lonlat.x, lonlat.y, elev)
	if parent_node != null:
		parent_node.add_child(sprite)
	else:
		markers.add_child(sprite)
	return sprite

func _uv_to_atlas(spec: Variant, u: float, v: float) -> Vector2:
	if spec is Array and (spec as Array).size() >= 6:
		var m: Array = spec
		return Vector2(
			fposmod(float(m[0]) + float(m[1]) * u + float(m[2]) * v, 2000.0),
			clampf(float(m[3]) + float(m[4]) * u + float(m[5]) * v, 0.0, 1000.0)
		)
	var bb: Dictionary = spec
	return Vector2(
		fposmod(lerpf(float(bb["min_x"]), float(bb["max_x"]), u), 2000.0),
		clampf(lerpf(float(bb["min_y"]), float(bb["max_y"]), v), 0.0, 1000.0)
	)

func build_continent_roads_and_details(continent_data: Dictionary, region_bboxes: Dictionary) -> void:
	for rid: String in continent_data.keys():
		if not region_bboxes.has(rid):
			continue
		var cd: Dictionary = continent_data[rid]
		var bb: Variant = region_bboxes[rid]
		var ws := float(cd.get("world_size", 1024.0))
		var half := ws * 0.5
		for rd: Dictionary in cd.get("roads", []):
			var raw_pts: Array = rd.get("pts", [])
			if raw_pts.size() < 2:
				continue
			var tier := str(rd.get("tier", "footpath"))
			var pts3 := PackedVector3Array()
			for pt: Array in raw_pts:
				var u := clampf((float(pt[0]) + half) / ws, 0.0, 1.0)
				var v := clampf((float(pt[1]) + half) / ws, 0.0, 1.0)
				var ap := _uv_to_atlas(bb, u, v)
				var ll := MapMath.atlas_to_lonlat(ap)
				pts3.append(surface(ll.x, ll.y, 1.005))
			var col := Color(1.0, 0.90, 0.62, 0.92) if tier == "highway" else (Color(0.94, 0.84, 0.60, 0.80) if tier in ["city", "regional"] else Color(0.84, 0.74, 0.54, 0.62))
			roads_3d.add_child(line_mesh(pts3, col))

		for b: Dictionary in cd.get("buildings", []):
			var mk := str(b.get("map_kind", ""))
			var is_ent := bool(b.get("enterable", false))
			var role := str(b.get("role", ""))
			if mk != "capital" and mk != "town" and not is_ent:
				continue
			var u := clampf((float(b.get("x", 0.0)) + half) / ws, 0.0, 1.0)
			var v := clampf((float(b.get("z", 0.0)) + half) / ws, 0.0, 1.0)
			var ap := _uv_to_atlas(bb, u, v)
			var ll := MapMath.atlas_to_lonlat(ap)
			var btitle := str(b.get("title", ""))
			if mk == "capital":
				add_icon_marker(ll, "capital", 0.072, markers, 1.024)
				if not btitle.is_empty():
					_add_surface_label(ll, btitle, 40, 0.00072, Color("ffe28a"), town_labels_3d, 1.036)
			elif mk == "town":
				add_icon_marker(ll, "town", 0.052, markers, 1.020)
				if not btitle.is_empty():
					_add_surface_label(ll, btitle, 34, 0.00058, Color("d8f0ff"), town_labels_3d, 1.030)
			elif is_ent:
				var rk := role if role in ["hall", "smithy", "inn", "shop", "arena", "depot", "landmark"] else "landmark"
				add_icon_marker(ll, rk, 0.024, detail_markers, 1.014)
				if not btitle.is_empty():
					_add_surface_label(ll, btitle, 26, 0.00038, Color("fff0cc"), bldg_labels_3d, 1.020)

func _add_surface_label(ll: Vector2, txt: String, fsz: int, px_sz: float, col: Color, parent_nd: Node3D, elev: float) -> void:
	var lbl := Label3D.new()
	lbl.text = txt
	lbl.font = MapStyle.body_font()
	lbl.font_size = fsz
	lbl.pixel_size = px_sz
	lbl.outline_size = 10
	lbl.outline_modulate = Color(0.03, 0.02, 0.02, 0.96)
	lbl.modulate = col
	lbl.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lbl.no_depth_test = false
	lbl.position = surface(ll.x, ll.y, elev)
	parent_nd.add_child(lbl)

func build_sphere(rings: int, segments: int) -> ArrayMesh:
	var tool := SurfaceTool.new()
	tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in rings:
		for s in segments:
			var corners := [[r, s], [r + 1, s + 1], [r + 1, s], [r, s], [r, s + 1], [r + 1, s + 1]]
			for c: Array in corners:
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
	if not points.is_empty():
		points.append(points[0])
	return points

func build_outlines() -> void:
	for region: Dictionary in regions:
		var color := Color(1.0, 0.78, 0.42, 0.88) if bool(region.get("playable", true)) else Color(0.9, 0.95, 1.0, 0.42)
		var pts := region_points(region, 1.003)
		if pts.size() > 1:
			outlines.add_child(line_mesh(pts, color))

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

func add_marker(lonlat: Vector2, _color: Color, _radius: float, parent_node: Node3D = null) -> void:
	add_icon_marker(lonlat, "hero_pyra", 0.092, parent_node, 1.032)

func _exit_tree() -> void:
	viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	select_view.render_target_update_mode = SubViewport.UPDATE_DISABLED
	globe_material.set_shader_parameter("select_tex", null)
	for grp: Node3D in [town_labels_3d, bldg_labels_3d, detail_markers, roads_3d, markers, outlines, highlight]:
		if is_instance_valid(grp):
			for ch in grp.get_children():
				if ch is Label3D:
					(ch as Label3D).font = null
				ch.free()

func apply_rotation() -> void:
	pivot.basis = Basis(Vector3.RIGHT, deg_to_rad(lat0)) * Basis(Vector3.UP, deg_to_rad(-lon0))
	camera.position = Vector3(0, 0, distance)
	var zoom_detail := clampf((2.65 - distance) / 1.50, 0.0, 1.0)
	globe_material.set_shader_parameter("zoom_detail", zoom_detail)
	cloud_material.set_shader_parameter("cloud_alpha", clampf((distance - 1.28) / 0.85, 0.0, 1.0))
	roads_3d.visible = (distance <= 2.85)
	town_labels_3d.visible = (distance <= 2.45)
	detail_markers.visible = (distance <= 2.20)
	bldg_labels_3d.visible = (distance <= 1.72)

func focus_on(lonlat: Vector2) -> void:
	lon0 = lonlat.x
	lat0 = clampf(lonlat.y, -80.0, 80.0)
	velocity = Vector2.ZERO
	idle = 0.0
	apply_rotation()

func set_player_atlas(player_atlas: Vector2) -> void:
	if is_instance_valid(player_marker):
		var ll := MapMath.atlas_to_lonlat(player_atlas)
		player_marker.position = surface(ll.x, ll.y, 1.032)

func set_player_land(land: String) -> void:
	if is_instance_valid(player_marker) and player_marker is Sprite3D:
		var tex := _load_pin_tex("hero_" + land)
		if tex != null:
			(player_marker as Sprite3D).texture = tex


func select(id: String) -> void:
	selected = id
	for child in highlight.get_children():
		child.queue_free()
	for region: Dictionary in regions:
		if str(region.get("id", "")) == id:
			var pts := region_points(region, 1.006)
			if pts.size() > 1:
				highlight.add_child(line_mesh(pts, Color(1.0, 0.92, 0.52, 1.0)))
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
	distance = clampf(distance / factor, 1.09, 5.2)
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
		if idle > 2.5 and distance > 2.1:
			lon0 += 5.5 * delta
	apply_rotation()
	if is_instance_valid(player_marker):
		var ps := clampf((distance - 0.8) * 0.45, 0.35, 1.0)
		player_marker.scale = Vector3.ONE * ps * (1.0 + 0.22 * sin(Time.get_ticks_msec() / 220.0))

func degrees_per_pixel() -> float:
	return 52.0 / maxf(size.y, 1.0) * (distance / 3.1)

func _gui_input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		var st := event as InputEventScreenTouch
		if st.pressed:
			pinch_pts[st.index] = st.position
			if pinch_pts.size() == 2:
				var ks := pinch_pts.keys()
				pinch_dist = (pinch_pts[ks[0]] as Vector2).distance_to(pinch_pts[ks[1]] as Vector2)
		else:
			pinch_pts.erase(st.index)
			if pinch_pts.size() < 2:
				pinch_dist = 0.0
	elif event is InputEventScreenDrag and pinch_pts.has((event as InputEventScreenDrag).index):
		var sd := event as InputEventScreenDrag
		pinch_pts[sd.index] = sd.position
		if pinch_pts.size() == 2 and pinch_dist > 10.0:
			var ks := pinch_pts.keys()
			var nd := (pinch_pts[ks[0]] as Vector2).distance_to(pinch_pts[ks[1]] as Vector2)
			zoom_by(nd / pinch_dist)
			pinch_dist = nd
			idle = 0.0
			return
	if event is InputEventMouseButton:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP and event.pressed:
			zoom_by(1.14)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN and event.pressed:
			zoom_by(1.0 / 1.14)
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
	elif event is InputEventMouseMotion and dragging and pinch_pts.size() < 2:
		if (event.position - drag_start).length() > 12.0:
			drag_moved = true
		if drag_moved:
			var k := degrees_per_pixel()
			lon0 -= event.relative.x * k
			lat0 = clampf(lat0 + event.relative.y * k, -80.0, 80.0)
			velocity = Vector2(event.relative.x * k * 30.0, event.relative.y * k * 30.0)
			idle = 0.0

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
	var ll_v := ll as Vector2
	var region := MapMath.region_at(regions, MapMath.lonlat_to_atlas(ll_v.x, ll_v.y))
	if region.is_empty():
		select("")
		return
	var rid := str(region.get("id", ""))
	select(rid)
	region_picked.emit(rid)
