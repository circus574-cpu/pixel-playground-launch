extends SubViewportContainer
## Rotatable & Zoomable AAA 3D Continent Relief Map for KI Legends ([M] Mapa 3D).
## Uses studio-grade painted heraldic medallions (ZERO primitive cones/pyramids!) draped onto 3D relief:
## - Overview: Canonical painted relief island, Royal Capital Citadel Starburst medallion, Heraldic Town Shields,
##   live Hero Portrait medallion & all planar trunk highways.
## - Medium Zoom: ALL real in-game roads (highways, city streets, footpaths) & single-span Bridge badges sharpen.
## - Close / Street Zoom: Painted service medallions for EVERY enterable utility building + building titles & rooftops.

const MapStyle := preload("res://scripts/map_style.gd")

var world: Node2D
var vp := SubViewport.new()
var root := Node3D.new()
var terrain_node := MeshInstance3D.new()
var cam := Camera3D.new()
var relief_heights := PackedFloat32Array()
var relief_grid := 256
var terrain_mat: ShaderMaterial
var icon_cache: Dictionary = {}

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

	cam.fov = 36.0
	cam.near = 2.0
	cam.far = 3600.0
	root.add_child(cam)
	_build_mobile_buttons()
	resized.connect(_layout_mobile_buttons)
	_layout_mobile_buttons()
	rebuild_for_region()

var btn_close_3d := Button.new()
var btn_zin_3d := Button.new()
var btn_zout_3d := Button.new()

func _style_3d_btn(btn: Button, bg: Color, border: Color, fsz: int = 16) -> void:
	var st := StyleBoxFlat.new()
	st.bg_color = bg
	st.border_color = border
	st.set_border_width_all(2)
	st.set_corner_radius_all(8)
	btn.add_theme_stylebox_override("normal", st)
	var sth := st.duplicate()
	sth.bg_color = bg.lightened(0.15)
	btn.add_theme_stylebox_override("hover", sth)
	btn.add_theme_font_override("font", MapStyle.body_font())
	btn.add_theme_font_size_override("font_size", fsz)
	btn.add_theme_color_override("font_color", Color(1.0, 0.94, 0.80))

func _build_mobile_buttons() -> void:
	btn_close_3d.text = "✕ ZAMKNIJ"
	_style_3d_btn(btn_close_3d, Color(0.32, 0.10, 0.10, 0.96), Color(0.98, 0.56, 0.36, 0.98), 16)
	btn_close_3d.pressed.connect(func() -> void:
		if world != null:
			world.toggle_map()
	)
	add_child(btn_close_3d)

	btn_zin_3d.text = "+"
	_style_3d_btn(btn_zin_3d, Color(0.14, 0.10, 0.06, 0.94), Color(0.88, 0.70, 0.36, 0.96), 22)
	btn_zin_3d.pressed.connect(func() -> void:
		distance = clampf(distance * 0.78, 145.0, 1450.0)
		queue_redraw()
	)
	add_child(btn_zin_3d)

	btn_zout_3d.text = "−"
	_style_3d_btn(btn_zout_3d, Color(0.14, 0.10, 0.06, 0.94), Color(0.88, 0.70, 0.36, 0.96), 22)
	btn_zout_3d.pressed.connect(func() -> void:
		distance = clampf(distance * 1.28, 145.0, 1450.0)
		queue_redraw()
	)
	add_child(btn_zout_3d)

func _layout_mobile_buttons() -> void:
	var w := maxf(size.x, 320.0)
	var h := maxf(size.y, 240.0)
	btn_close_3d.position = Vector2(w - 152.0, 8.0)
	btn_close_3d.size = Vector2(140.0, 46.0)
	btn_zin_3d.position = Vector2(w - 64.0, h * 0.5 - 60.0)
	btn_zin_3d.size = Vector2(52.0, 52.0)
	btn_zout_3d.position = Vector2(w - 64.0, h * 0.5 + 4.0)
	btn_zout_3d.size = Vector2(52.0, 52.0)

func _pin_tex(key: String) -> Texture2D:
	if icon_cache.has(key):
		return icon_cache[key] as Texture2D
	var path := "res://assets/ui/map_icons/pin_%s.webp" % key
	var tex: Texture2D = world.load_tex(path) if (world != null and world.has_method("load_tex")) else null
	if tex == null:
		var abs_p := ProjectSettings.globalize_path(path)
		if FileAccess.file_exists(abs_p):
			var img := Image.new()
			if img.load(abs_p) == OK:
				tex = ImageTexture.create_from_image(img)
	icon_cache[key] = tex
	return tex

func _draw_pin(key: String, pos: Vector2, dia: float) -> void:
	var tex := _pin_tex(key)
	if tex != null:
		draw_circle(pos + Vector2(0.0, 2.0), dia * 0.42, Color(0.02, 0.02, 0.03, 0.50))
		draw_texture_rect(tex, Rect2(pos - Vector2(dia * 0.5, dia * 0.5), Vector2(dia, dia)), false)

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

func _process(_d: float) -> void:
	if not visible or world == null:
		return
	var ws: float = float(world.world_size)
	var half := ws * 0.5
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

func _role_pin_key(role: String) -> String:
	if role in ["hall", "smithy", "inn", "shop", "arena", "depot", "landmark"]:
		return role
	return "landmark"

func _clip_seg_to_rect(a: Vector2, b: Vector2, r: Rect2) -> PackedVector2Array:
	var x0 := a.x
	var y0 := a.y
	var dx := b.x - a.x
	var dy := b.y - a.y
	var t0 := 0.0
	var t1 := 1.0
	var ps := [-dx, dx, -dy, dy]
	var qs := [x0 - r.position.x, r.end.x - x0, y0 - r.position.y, r.end.y - y0]
	for k in 4:
		var p: float = ps[k]
		var q: float = qs[k]
		if absf(p) < 1e-6:
			if q < 0.0:
				return PackedVector2Array()
		else:
			var t := q / p
			if p < 0.0:
				if t > t1:
					return PackedVector2Array()
				if t > t0:
					t0 = t
			else:
				if t < t0:
					return PackedVector2Array()
				if t < t1:
					t1 = t
	return PackedVector2Array([a + Vector2(dx, dy) * t0, a + Vector2(dx, dy) * t1])

func _draw() -> void:
	var f: Font = MapStyle.body_font()
	var ft: Font = MapStyle.font()
	var rect := Rect2(Vector2.ZERO, size)
	if world == null:
		return
	var detail := zoom_detail_level()
	var zoom_x := clampf(920.0 / maxf(distance, 120.0), 0.7, 6.5)
	var inner_rect := Rect2(10.0, 52.0, size.x - 20.0, size.y - 96.0)

	# 1. ALL 50-80 REAL PLANAR IN-GAME ROADS draped cleanly on 3D relief with Liang-Barsky clipping & 4-tier hierarchy!
	if "roads" in world:
		var tier_order := ["footpath", "regional", "city", "highway"]
		for want_tier: String in tier_order:
			for rd: Dictionary in world.roads:
				var tier := str(rd.get("tier", "footpath"))
				if tier != want_tier:
					continue
				var raw_pts: Array = rd.get("pts", [])
				if raw_pts.size() < 2:
					continue
				var proj_pts: Array = []
				for pt: Array in raw_pts:
					proj_pts.append(_project(float(pt[0]), float(pt[1]), 2.0))
				var w_out := lerpf(2.0, 3.8, detail) if tier == "highway" else (
					lerpf(1.5, 3.0, detail) if tier in ["city", "regional"] else lerpf(1.0, 2.2, detail)
				)
				var alpha := lerpf(0.76, 0.96, detail) if tier == "highway" else (
					lerpf(0.58, 0.92, detail) if tier in ["regional", "city"] else lerpf(0.42, 0.84, detail)
				)
				var core_col := Color(0.98, 0.89, 0.64, alpha) if tier == "highway" else (
					Color(0.95, 0.87, 0.68, alpha) if tier == "city" else (
						Color(0.90, 0.80, 0.58, alpha) if tier == "regional" else Color(0.80, 0.70, 0.52, alpha)
					)
				)
				var casing_col := Color(0.08, 0.05, 0.03, alpha * 0.85)
				for k in range(proj_pts.size() - 1):
					if proj_pts[k] == null or proj_pts[k + 1] == null:
						continue
					var seg := _clip_seg_to_rect(proj_pts[k] as Vector2, proj_pts[k + 1] as Vector2, inner_rect)
					if seg.size() == 2:
						draw_line(seg[0], seg[1], casing_col, w_out + 1.5, true)
				for k in range(proj_pts.size() - 1):
					if proj_pts[k] == null or proj_pts[k + 1] == null:
						continue
					var seg := _clip_seg_to_rect(proj_pts[k] as Vector2, proj_pts[k + 1] as Vector2, inner_rect)
					if seg.size() == 2:
						draw_line(seg[0], seg[1], core_col, w_out, true)

	# 2. Painted Heraldic Map Medallions (Capital Citadel Starburst, Town Shields, Bridge Badges & Service Medallions!)
	var placed_labels: Array[Rect2] = []
	for b: Dictionary in world.buildings:
		var role := str(b.get("role", ""))
		var mk := str(b.get("map_kind", ""))
		var is_ent := bool(b.get("enterable", false))
		var bx := float(b.get("x", 512.0))
		var bz := float(b.get("z", 512.0))
		var sp_v: Variant = _project(bx, bz, 6.0)
		if sp_v == null:
			continue
		var sp: Vector2 = sp_v
		if not inner_rect.has_point(sp):
			continue

		if role == "bridge" and detail >= 0.12:
			_draw_pin("bridge", sp, lerpf(18.0, 26.0, detail))
		elif mk == "capital":
			var cap_d := lerpf(32.0, 42.0, detail)
			_draw_pin("capital", sp, cap_d)
			var cname := "STOLICA"
			var tw := ft.get_string_size(cname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			var lp := Vector2(clampf(sp.x - tw * 0.5, 18.0, size.x - tw - 18.0), clampf(sp.y - cap_d * 0.55, 66.0, size.y - 48.0))
			draw_string_outline(ft, lp, cname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 5, Color(0.03, 0.02, 0.02, 0.96))
			draw_string(ft, lp, cname, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.90, 0.46))
		elif mk == "town":
			var td := lerpf(24.0, 32.0, detail)
			_draw_pin("town", sp, td)
			var tname := str(b.get("title", ""))
			var tw := f.get_string_size(tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x
			var lp := Vector2(clampf(sp.x - tw * 0.5, 18.0, size.x - tw - 18.0), clampf(sp.y - td * 0.55, 66.0, size.y - 48.0))
			var box := Rect2(lp.x - 3.0, lp.y - 12.0, tw + 6.0, 15.0)
			var collides := false
			for prev: Rect2 in placed_labels:
				if box.intersects(prev):
					collides = true
					break
			if not collides:
				placed_labels.append(box)
				draw_string_outline(f, lp, tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0.03, 0.04, 0.06, 0.96))
				draw_string(f, lp, tname, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.86, 0.94, 1.0))
		elif is_ent and detail >= 0.14:
			var sd := lerpf(15.0, 24.0, detail)
			_draw_pin(_role_pin_key(role), sp, sd)
			if detail >= 0.56:
				var btitle := str(b.get("title", ""))
				var tw := f.get_string_size(btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
				var lx := clampf(sp.x - tw * 0.5, 18.0, size.x - tw - 18.0)
				var ly := clampf(sp.y - sd * 0.55, 66.0, size.y - 50.0)
				var box := Rect2(lx - 3.0, ly - 11.0, tw + 6.0, 14.0)
				var collides := false
				for prev: Rect2 in placed_labels:
					if box.intersects(prev):
						collides = true
						break
				if not collides:
					placed_labels.append(box)
					draw_string_outline(f, Vector2(lx, ly), btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 4, Color(0.03, 0.02, 0.02, 0.96))
					draw_string(f, Vector2(lx, ly), btitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(1.0, 0.94, 0.78))
		elif role in ["house", "gate", "tower"] and detail >= 0.52:
			var hr := lerpf(2.4, 4.0, detail)
			draw_rect(Rect2(sp - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), Color(0.56, 0.50, 0.44, 0.84))
			draw_rect(Rect2(sp - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), Color(0.08, 0.06, 0.05, 0.94), false, 1.1)

	# 3. Live Hero Portrait Medallion (replaces the old blue cone!)
	var hp_s_v: Variant = _project(world.hero_pos.x, world.hero_pos.y, 12.0)
	if hp_s_v != null:
		var hs: Vector2 = hp_s_v
		if inner_rect.has_point(hs):
			var hd := lerpf(28.0, 34.0, detail)
			_draw_pin("hero_" + str(world.current_land), hs, hd)

	# 4. Top Header Plaque & Bottom Painted Medallion Legend Bar
	draw_rect(rect, Color(0.86, 0.68, 0.36, 0.90), false, 3.0)
	draw_rect(Rect2(12, 10, size.x - 24, 38), Color(0.03, 0.04, 0.06, 0.88))
	draw_rect(Rect2(12, 10, size.x - 24, 38), Color(0.86, 0.68, 0.36, 0.58), false, 1.5)
	var title: String = str(world.region_title)
	draw_string(f, Vector2(24, 34), "%s — Mapa 3D (Zoom %.1f× • Kółko = Przybliż szczegóły • Shift+LPM = Przesuń • [M] Zamknij)" % [title, zoom_x], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.98, 0.90, 0.72))

	var leg := Rect2(12, size.y - 40, size.x - 24, 30)
	draw_rect(leg, Color(0.03, 0.04, 0.06, 0.88))
	draw_rect(leg, Color(0.76, 0.58, 0.30, 0.58), false, 1.2)
	var lx_pos := leg.position.x + 24.0
	var ly_mid := leg.position.y + 15.0
	_draw_pin("capital", Vector2(lx_pos, ly_mid), 22.0)
	draw_string(f, Vector2(lx_pos + 15, ly_mid + 4), "Stolica", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.90, 0.58))
	lx_pos += 96.0
	_draw_pin("town", Vector2(lx_pos, ly_mid), 20.0)
	draw_string(f, Vector2(lx_pos + 14, ly_mid + 4), "Miasto / Warownia", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.84, 0.92, 1.0))
	lx_pos += 168.0
	_draw_pin("smithy", Vector2(lx_pos, ly_mid), 18.0)
	draw_string(f, Vector2(lx_pos + 13, ly_mid + 4), "Budynek użytkowy (wejście)", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.88, 0.94, 0.86))
	lx_pos += 218.0
	_draw_pin("bridge", Vector2(lx_pos, ly_mid), 18.0)
	draw_string(f, Vector2(lx_pos + 13, ly_mid + 4), "Mosty", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.94, 0.88, 0.74))
	lx_pos += 92.0
	draw_line(Vector2(lx_pos - 6, ly_mid), Vector2(lx_pos + 16, ly_mid), Color(0.96, 0.86, 0.60, 0.95), 3.0, true)
	draw_string(f, Vector2(lx_pos + 22, ly_mid + 4), "Wszystkie drogi", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.94, 0.88, 0.74))
	lx_pos += 144.0
	_draw_pin("hero_" + str(world.current_land), Vector2(lx_pos, ly_mid), 20.0)
	draw_string(f, Vector2(lx_pos + 14, ly_mid + 4), "Twoja pozycja", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.46, 0.96, 1.0))
