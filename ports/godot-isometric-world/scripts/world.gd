extends Node2D
## KI Legends — 2D Isometric World & 4 Capitals + Planet Atlas (Godot 4.6.3)
## Shares height.r32, control.r32, walkable.u8, weights.png, surface.png, and Blender isometric
## sprites across Pyra, Verdantia, Aetheria, Nexus-9, the 3D relief map, and the Planet Atlas.

const ActorScript := preload("res://scripts/actor_view.gd")
const Map3DScript := preload("res://scripts/map_3d.gd")
const AtlasOverlayScript := preload("res://scripts/atlas_overlay.gd")
const StickScript := preload("res://scripts/stick.gd")

const ISO_W := 5.6
const ISO_D := 2.8
const ISO_H := 3.8
const STEP := 2
const SPEED := 22.0

const REGION_ORDER := ["pyra", "verdant", "aether", "nexus"]
const REGION_TITLES := {
	"pyra": "Pyra — Twierdza Popiołu",
	"verdant": "Verdantia — Zielona Przystań",
	"aether": "Aetheria — Sanktuarium Tysiąca Źródeł",
	"nexus": "Nexus-9 — Węzeł Świadomości",
}

var current_land := "pyra"
var region_title := "Pyra — Twierdza Popiołu"
var grid_size := 512
var world_size := 256.0
var heights := PackedFloat32Array()
var walkable := PackedByteArray()
var landmarks: Array = []
var buildings: Array = []
var props: Array = []

var terrain_mesh := MeshInstance2D.new()
var ysort := Node2D.new()
var hero: Node2D
var camera := Camera2D.new()
var hud := CanvasLayer.new()
var info_label := Label.new()
var minimap_rect := TextureRect.new()
var minimap_markers := Control.new()
var map_3d: SubViewportContainer
var atlas_overlay: Control
var stick_layer := Control.new()
var region_bar := HBoxContainer.new()

var hero_pos := Vector2(88.0, 174.0)
var target_pos := Vector2(-1.0, -1.0)
var motion := Vector2.ZERO
var map_expanded := false
var atlas_expanded := false
var zoom_level := 0.92
var move_pointer := -1
var move_origin := Vector2.ZERO
var pinch_pointers: Dictionary = {}
var pinch_distance := 0.0
var tex_cache: Dictionary = {}

func _ready() -> void:
	add_child(terrain_mesh)
	ysort.y_sort_enabled = true
	add_child(ysort)

	hero = ActorScript.new()
	var actors: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/actors.json"))
	hero.setup(actors["pyra.hero"], "Ignis", false, true)
	hero.scale = Vector2(0.54, 0.54)
	ysort.add_child(hero)

	camera.enabled = true
	camera.zoom = Vector2(zoom_level, zoom_level)
	add_child(camera)

	build_hud()
	switch_region("pyra")

	if "--qa" in OS.get_cmdline_user_args() or "--qa" in OS.get_cmdline_args():
		call_deferred("run_qa")

func surface_color_for(land: String) -> Vector3:
	match land:
		"pyra":
			return Vector3(1.0, 0.24, 0.03)
		"verdant":
			return Vector3(0.14, 0.56, 0.74)
		"aether":
			return Vector3(0.18, 0.80, 0.90)
		"nexus":
			return Vector3(0.08, 0.88, 0.98)
		_:
			return Vector3(1.0, 0.24, 0.03)

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
	load_terrain(land)
	build_isometric_mesh()
	build_landmarks_and_buildings()
	build_minimap_texture()
	if landmarks.size() > 0:
		hero_pos = Vector2(float(landmarks[0].x), float(landmarks[0].z))
	else:
		hero_pos = Vector2(128.0, 128.0)
	target_pos = Vector2(-1.0, -1.0)
	sync_hero()
	if map_3d != null:
		map_3d.rebuild_for_region()
	minimap_markers.queue_redraw()
	if atlas_overlay != null:
		atlas_overlay.queue_redraw()

func load_terrain(land: String) -> void:
	var rdir := "res://regions/" + land
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(rdir + "/terrain.json"))
	grid_size = int(meta.get("size", meta.get("grid_size", 512)))
	world_size = float(meta.get("world_size", 256.0))
	landmarks = meta.get("landmarks", [])
	heights = FileAccess.get_file_as_bytes(rdir + "/height.r32").to_float32_array()
	walkable = FileAccess.get_file_as_bytes(rdir + "/walkable.u8")

	buildings = []
	props = []
	var bpath := rdir + "/buildings.json"
	if FileAccess.file_exists(bpath):
		var bdata: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(bpath))
		buildings = bdata.get("buildings", [])
		props = bdata.get("props", [])

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
	if x < 6.0 or z < 6.0 or x > world_size - 6.0 or z > world_size - 6.0:
		return false
	var gx := int(round(x / world_size * float(grid_size - 1)))
	var gz := int(round(z / world_size * float(grid_size - 1)))
	return walkable[grid_index(gx, gz)] > 0

func vertex_color(gx: int, gz: int) -> Color:
	var h0 := heights[grid_index(gx, gz)]
	var hx := heights[grid_index(gx + 2, gz)] - heights[grid_index(gx - 2, gz)]
	var hz := heights[grid_index(gx, gz + 2)] - heights[grid_index(gx, gz - 2)]
	var normal := Vector3(-hx, 2.0, -hz).normalized()
	var sun := Vector3(-0.55, 0.72, -0.42).normalized()
	var shade := clampf(0.48 + 0.58 * normal.dot(sun), 0.24, 1.14)
	if h0 < 2.0:
		shade *= 0.85
	if walkable[grid_index(gx, gz)] == 0:
		shade *= 0.82
	return Color(shade, shade * 0.97, shade * 0.94, 1.0)

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
		mat.set_shader_parameter("mat_%d_tex" % i, load_tex("%s/mat_%d.webp" % [rdir, i]))
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

func build_landmarks_and_buildings() -> void:
	for child in ysort.get_children():
		if child != hero:
			child.queue_free()

	# 1. Architectural buildings rendered from Blender 3D models
	for b: Dictionary in buildings:
		var bx := float(b.x)
		var bz := float(b.z)
		var bh := height_at(bx, bz)
		var node := Node2D.new()
		node.position = iso(bx, bz, bh)
		var sp := Sprite2D.new()
		var tex := load_tex("res://sprites/%s.png" % str(b.sprite))
		if tex != null:
			sp.texture = tex
			var sc := float(b.get("scale", 0.34))
			sp.scale = Vector2(sc, sc)
			var ax := float(b.get("anchor_x", 0.5))
			var ay := float(b.get("anchor_y", 0.88))
			sp.offset = Vector2((0.5 - ax) * tex.get_width(), (0.5 - ay) * tex.get_height())
		node.add_child(sp)
		var lbl := Label.new()
		lbl.text = str(b.get("title", ""))
		lbl.position = Vector2(-110, -108)
		lbl.size = Vector2(220, 26)
		lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		lbl.add_theme_font_size_override("font_size", 14)
		lbl.add_theme_color_override("font_color", Color(1.0, 0.93, 0.74))
		lbl.add_theme_color_override("font_outline_color", Color(0.04, 0.03, 0.03, 0.95))
		lbl.add_theme_constant_override("outline_size", 5)
		node.add_child(lbl)
		ysort.add_child(node)

	# 2. Natural biome scatter props (trees, cliffs, rocks, ruins)
	for p: Dictionary in props:
		var px := float(p.x)
		var pz := float(p.z)
		var ph := height_at(px, pz)
		var pnode := Node2D.new()
		pnode.position = iso(px, pz, ph)
		var psp := Sprite2D.new()
		var ptex := load_tex("res://sprites/%s.png" % str(p.sprite))
		if ptex != null:
			psp.texture = ptex
			var psc := float(p.get("scale", 0.22))
			psp.scale = Vector2(psc, psc)
			var pax := float(p.get("anchor_x", 0.5))
			var pay := float(p.get("anchor_y", 0.88))
			psp.offset = Vector2((0.5 - pax) * ptex.get_width(), (0.5 - pay) * ptex.get_height())
		pnode.add_child(psp)
		ysort.add_child(pnode)

	# 3. District landmark pins
	for lm: Dictionary in landmarks:
		var lx := float(lm.x)
		var lz := float(lm.z)
		var lh := height_at(lx, lz)
		var marker := Node2D.new()
		marker.position = iso(lx, lz, lh)
		var poly := Polygon2D.new()
		poly.color = Color(0.95, 0.68, 0.24, 0.88)
		poly.polygon = PackedVector2Array([Vector2(-9, 0), Vector2(0, -30), Vector2(9, 0), Vector2(0, 5)])
		marker.add_child(poly)
		var label := Label.new()
		label.text = str(lm.title)
		label.position = Vector2(-110, -56)
		label.size = Vector2(220, 24)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 15)
		label.add_theme_color_override("font_color", Color("ffe7ba"))
		label.add_theme_color_override("font_outline_color", Color(0.05, 0.02, 0.02, 0.95))
		label.add_theme_constant_override("outline_size", 5)
		marker.add_child(label)
		ysort.add_child(marker)

func build_hud() -> void:
	add_child(hud)
	var panel := PanelContainer.new()
	panel.position = Vector2(14, 14)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.05, 0.04, 0.04, 0.84)
	style.border_color = Color(0.78, 0.56, 0.28, 0.85)
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

	region_bar.add_theme_constant_override("separation", 6)
	for idx in REGION_ORDER.size():
		var land_id: String = REGION_ORDER[idx]
		var btn := Button.new()
		btn.text = "[%d] %s" % [idx + 1, land_id.capitalize()]
		btn.pressed.connect(func(): switch_region(land_id))
		region_bar.add_child(btn)
	var btn_atlas := Button.new()
	btn_atlas.text = "[G] Atlas Planety"
	btn_atlas.pressed.connect(func(): toggle_atlas(not atlas_expanded))
	region_bar.add_child(btn_atlas)
	var btn_3d := Button.new()
	btn_3d.text = "[M] Mapa 3D"
	btn_3d.pressed.connect(func(): toggle_map())
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
	weights.load(ProjectSettings.globalize_path(rdir + "/weights.png"))
	var surface := Image.new()
	surface.load(ProjectSettings.globalize_path(rdir + "/surface.png"))
	var img := Image.create(256, 256, false, Image.FORMAT_RGBA8)
	var liq := surface_color_for(current_land)
	var liq_col := Color(liq.x, liq.y, liq.z, 1.0)
	for y in 256:
		for x in 256:
			var gx := x * 2
			var gz := y * 2
			var w := weights.get_pixel(gx, gz)
			var s := surface.get_pixel(gx, gz).r
			var c := Color(0.24, 0.22, 0.20) * w.r + Color(0.38, 0.44, 0.34) * w.g + Color(0.68, 0.62, 0.50) * w.b + Color(0.28, 0.26, 0.30) * w.a
			c = c * vertex_color(gx, gz).r
			c = c.lerp(liq_col, s)
			img.set_pixel(x, y, Color(c.r, c.g, c.b, 0.94))
	minimap_rect.texture = ImageTexture.create_from_image(img)

func layout_minimap() -> void:
	var vp := get_viewport_rect().size
	if map_expanded:
		var s := minf(vp.x - 120.0, vp.y - 80.0)
		var rect := Rect2(Vector2((vp.x - s) * 0.5, (vp.y - s) * 0.5), Vector2(s, s))
		map_3d.position = rect.position
		map_3d.size = rect.size
		map_3d.visible = true
		minimap_rect.visible = false
	else:
		map_3d.visible = false
		minimap_rect.visible = not atlas_expanded
		minimap_rect.size = Vector2(210, 210)
		minimap_rect.position = Vector2(vp.x - 226, 16)
	minimap_markers.size = minimap_rect.size
	minimap_markers.queue_redraw()
	if atlas_overlay != null:
		atlas_overlay.position = Vector2(28, 24)
		atlas_overlay.size = Vector2(vp.x - 56, vp.y - 48)
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
	minimap_markers.draw_rect(Rect2(Vector2.ZERO, s), Color(0.82, 0.62, 0.32, 0.85), false, 2.5)
	for lm: Dictionary in landmarks:
		var p := Vector2(float(lm.x) / world_size * s.x, float(lm.z) / world_size * s.y)
		minimap_markers.draw_circle(p, 4.0, Color(0.96, 0.72, 0.25))
	var hp := Vector2(hero_pos.x / world_size * s.x, hero_pos.y / world_size * s.y)
	minimap_markers.draw_circle(hp, 5.5, Color(0.2, 0.95, 1.0))
	minimap_markers.draw_arc(hp, 8.0, 0, TAU, 20, Color(1, 1, 1, 0.85), 1.6, true)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_M:
			toggle_map()
			return
		elif event.keycode == KEY_G:
			toggle_atlas(not atlas_expanded)
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
	zoom_level = clampf(z, 0.52, 1.85)
	camera.zoom = Vector2(zoom_level, zoom_level)

func _process(delta: float) -> void:
	step_world(delta)

func step_world(delta: float) -> void:
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
	hero.animate(screen_dir, true)
	sync_hero()

func try_move(step: Vector2) -> void:
	var h_now := height_at(hero_pos.x, hero_pos.y)
	for candidate: Vector2 in [hero_pos + step, Vector2(hero_pos.x + step.x, hero_pos.y), Vector2(hero_pos.x, hero_pos.y + step.y)]:
		if is_walkable(candidate.x, candidate.y) and absf(height_at(candidate.x, candidate.y) - h_now) < 3.4:
			hero_pos = candidate
			minimap_markers.queue_redraw()
			return

func sync_hero() -> void:
	var h := height_at(hero_pos.x, hero_pos.y)
	hero.position = iso(hero_pos.x, hero_pos.y, h)
	camera.position = hero.position + Vector2(0, -34)
	var nearest := ""
	var best := 999.0
	for lm: Dictionary in landmarks:
		var d := hero_pos.distance_to(Vector2(float(lm.x), float(lm.z)))
		if d < best:
			best = d
			nearest = str(lm.title)
	info_label.text = "%s (2D Izometria)\nPozycja: (%.0f, %.0f) wys. %.1f m | Dzielnica: %s" % [region_title, hero_pos.x, hero_pos.y, h, nearest]

func snap(out_dir: String, file: String) -> String:
	for _i in 3:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	var path := out_dir.path_join(file)
	img.save_jpg(path, 0.92)
	return path

func run_qa() -> void:
	var out_dir := OS.get_environment("ISO_QA_DIR")
	if out_dir.is_empty():
		out_dir = ProjectSettings.globalize_path("res://qa_out")
	DirAccess.make_dir_recursive_absolute(out_dir)

	var probe := Vector2(118.5, 162.25)
	var h := height_at(probe.x, probe.y)
	var roundtrip := unproject(iso(probe.x, probe.y, h), h)
	var roundtrip_err := probe.distance_to(roundtrip)

	var regions_report: Dictionary = {}
	var all_landmarks_walkable := true
	var shots: Array = []

	var shot_files := {
		"pyra": "pyra-citadel.jpg",
		"verdant": "verdant-harbor.jpg",
		"aether": "aether-sanctuary.jpg",
		"nexus": "nexus-core.jpg",
	}

	for land: String in REGION_ORDER:
		switch_region(land)
		var lm_report: Array = []
		for lm: Dictionary in landmarks:
			var p := Vector2(float(lm.x), float(lm.z))
			var ok := is_walkable(p.x, p.y)
			all_landmarks_walkable = all_landmarks_walkable and ok
			lm_report.append({"id": lm.id, "title": lm.title, "walkable": ok, "height": snappedf(height_at(p.x, p.y), 0.01)})

		# Focus camera on prime landmark (upper sanctuary/citadel/bridge/core) for region screenshot
		var prime_idx := mini(landmarks.size() - 1, 2 if land == "verdant" else (4 if land == "pyra" else (2 if land == "aether" else 0)))
		var prime: Dictionary = landmarks[prime_idx]
		hero_pos = Vector2(float(prime.x), float(prime.z))
		sync_hero()
		shots.append(await snap(out_dir, shot_files[land]))

		regions_report[land] = {
			"title": region_title,
			"grid_size": grid_size,
			"buildings_count": buildings.size(),
			"props_count": props.size(),
			"landmarks": lm_report,
		}

	# Capture 3D rotatable relief map screenshot on Pyra
	switch_region("pyra")
	toggle_map()
	for _i in 4:
		await get_tree().process_frame
	map_3d.orbit(Vector2(70, -18))
	shots.append(await snap(out_dir, "map-3d.jpg"))
	toggle_map()

	# Capture 2D Isometric Planet Atlas screenshot
	toggle_atlas(true)
	shots.append(await snap(out_dir, "planet-atlas.jpg"))
	toggle_atlas(false)

	# Stair traversal & 30/120 FPS & touch control verification
	hero_pos = Vector2(126.0, 148.0)
	target_pos = Vector2(160.0, 88.0)
	for _i in 180:
		step_world(1.0 / 60.0)
	var after_stairs := hero_pos
	var climbed_height := height_at(after_stairs.x, after_stairs.y)

	var p30 := Vector2(98.0, 174.0)
	hero_pos = p30
	target_pos = Vector2(118.0, 152.0)
	for _i in 30:
		step_world(1.0 / 30.0)
	var end30 := hero_pos

	hero_pos = p30
	target_pos = Vector2(118.0, 152.0)
	for _i in 120:
		step_world(1.0 / 120.0)
	var end120 := hero_pos

	var touch_down := InputEventScreenTouch.new()
	touch_down.index = 0
	touch_down.pressed = true
	touch_down.position = Vector2(120, 580)
	handle_touch(touch_down)
	var drag := InputEventScreenDrag.new()
	drag.index = 0
	drag.position = Vector2(168, 560)
	handle_drag(drag)
	var touch_motion := motion
	var p1 := InputEventScreenTouch.new()
	p1.index = 1
	p1.pressed = true
	p1.position = Vector2(820, 360)
	handle_touch(p1)
	var p2 := InputEventScreenTouch.new()
	p2.index = 2
	p2.pressed = true
	p2.position = Vector2(920, 360)
	handle_touch(p2)
	var zoom_before := zoom_level
	var p2_drag := InputEventScreenDrag.new()
	p2_drag.index = 2
	p2_drag.position = Vector2(980, 360)
	handle_drag(p2_drag)
	var zoom_after := zoom_level
	touch_down.pressed = false
	p1.pressed = false
	p2.pressed = false
	handle_touch(touch_down)
	handle_touch(p1)
	handle_touch(p2)

	var report := {
		"project": "ports/godot-isometric-world",
		"projection_roundtrip_error_m": snappedf(roundtrip_err, 0.0001),
		"all_landmarks_walkable": all_landmarks_walkable,
		"regions": regions_report,
		"stair_climb_end": [snappedf(after_stairs.x, 0.01), snappedf(after_stairs.y, 0.01)],
		"stair_climb_height_m": snappedf(climbed_height, 0.01),
		"fps_30_120_position_delta_m": snappedf(end30.distance_to(end120), 0.01),
		"touch_controls": {
			"left_thumb_motion": [snappedf(touch_motion.x, 0.01), snappedf(touch_motion.y, 0.01)],
			"right_pinch_zoom_before": snappedf(zoom_before, 0.01),
			"right_pinch_zoom_after": snappedf(zoom_after, 0.01),
		},
		"screenshots": shots,
	}
	var file := FileAccess.open(out_dir.path_join("results.json"), FileAccess.WRITE)
	file.store_string(JSON.stringify(report, "  "))
	file.close()
	print("ISO_WORLD_QA_OK ", out_dir.path_join("results.json"))
	get_tree().quit(0)
