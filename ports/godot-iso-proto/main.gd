extends Node2D
## Isometric 2D prototype "Zielona Przystań". LOGICAL world = the game's world: the city zone is 4000 x 2500 game units (docs/SWIAT-I-MIASTA.md), x east, y south, as the
## Android game uses it; movement, collisions and the hero live there. PRESENTATION is isometric: terrain.png (Terrain3D render) and the object sprites (Blender)
## are placed with the projection fitted in scene.json (metres -> screen pixels); 1 m = scene.unit game units.
const DIR := "res://assets/zielona-przystan/"
const HERO_SCALE := 0.30
const SPEED := 170.0               # game units per second (scripts/player.gd)
const BLOCKING := ["house_a", "house_b", "house_c", "house_d", "house_moss_a", "house_moss_b", "forge", "tower", "tent_a", "tent_b", "tent_c", "tent_d", "crates", "fence", "pine_l", "pine_s", "oak_l", "oak_s", "fruit", "rock_l", "rock_s", "lamp", "boat_a", "boat_b"]
var scene: Dictionary
var unit := 44.64
var hero: CharacterBody2D
var hero_view: Node2D
var hero_sprite: Sprite2D
var hero_shadow: Sprite2D
var hero_def: Dictionary
var sheets: Dictionary = {}
var facing := "down"
var clip_time := 0.0
var camera: Camera2D
var label := Label.new()
var scripted_motion := Vector2.ZERO
var use_script_motion := false
var shadow_texture: GradientTexture2D

func to_logical(x: float, y: float) -> Vector2:
	return Vector2(x * unit, -y * unit)

func to_world(l: Vector2) -> Vector2:
	return Vector2(l.x / unit, -l.y / unit)

func screen_of(x: float, y: float, z: float = 0.0) -> Vector2:
	var a: Dictionary = scene.axes
	var o: Array = a.offset
	return Vector2(a.x[0] * x + a.y[0] * y + a.z[0] * z + o[0], a.x[1] * x + a.y[1] * y + a.z[1] * z + o[1])

func ground_z(x: float, y: float) -> float:
	var g: Dictionary = scene.hgrid
	var fx := clampf((x - float(g.x0)) / float(g.step), 0.0, float(g.nx) - 1.001)
	var fy := clampf((y - float(g.y0)) / float(g.step), 0.0, float(g.ny) - 1.001)
	var ix := int(fx); var iy := int(fy)
	var tx := fx - ix; var ty := fy - iy
	var z: Array = g.z
	var a := lerpf(float(z[iy][ix]), float(z[iy][ix + 1]), tx)
	var b := lerpf(float(z[iy + 1][ix]), float(z[iy + 1][ix + 1]), tx)
	return lerpf(a, b, ty)

func blob(parent: Node, at: Vector2, w: float, h: float, alpha: float) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = shadow_texture
	s.position = at
	s.scale = Vector2(w / 64.0, h / 64.0)
	s.modulate = Color(0, 0, 0, alpha)
	parent.add_child(s)
	return s

func _ready() -> void:
	scene = JSON.parse_string(FileAccess.get_file_as_string(DIR + "scene.json"))
	unit = float(scene.unit)
	shadow_texture = GradientTexture2D.new()
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1)); gr.set_color(1, Color(1, 1, 1, 0))
	shadow_texture.gradient = gr
	shadow_texture.fill = GradientTexture2D.FILL_RADIAL
	shadow_texture.fill_from = Vector2(0.5, 0.5); shadow_texture.fill_to = Vector2(1.0, 0.5)
	shadow_texture.width = 64; shadow_texture.height = 64
	var ground := Sprite2D.new()
	ground.texture = load(DIR + "terrain.png")
	ground.centered = false
	add_child(ground)
	var shadows := Node2D.new()
	add_child(shadows)
	var sorted := Node2D.new()
	sorted.y_sort_enabled = true
	add_child(sorted)
	var textures: Dictionary = {}
	var statics := StaticBody2D.new()
	statics.name = "Collision"
	add_child(statics)
	var px_per_m := absf(float(scene.axes.x[0])) * 1.4142
	for p: Dictionary in scene.placements:
		var proto: String = p.proto
		var info: Dictionary = scene.sprites[proto]
		if not textures.has(proto):
			textures[proto] = load(DIR + str(info.file))
		var zg: float = float(p.z)
		var foot := Node2D.new()
		foot.position = Vector2(p.screen[0], p.screen[1])
		var s := Sprite2D.new()
		s.texture = textures[proto]
		s.centered = false
		s.position = Vector2(info.box[0] - info.origin[0], info.box[1] - info.origin[1])
		foot.add_child(s)
		sorted.add_child(foot)
		if proto != "fence" and proto != "dock" and proto != "bridge" and proto != "lamp":
			blob(shadows, foot.position + Vector2(5, 3), float(info.foot[0]) * px_per_m * 0.55, float(info.foot[1]) * px_per_m * 0.3, 0.30)
		if BLOCKING.has(proto):
			var fw: float = info.foot[0] * 0.5
			var fd: float = info.foot[1] * 0.5
			if proto.begins_with("pine") or proto.begins_with("oak") or proto == "fruit" or proto.begins_with("rock") or proto == "lamp":
				fw = minf(fw, 0.75); fd = minf(fd, 0.75)
			var rot := deg_to_rad(float(p.rot))
			var pts := PackedVector2Array()
			for c in [Vector2(-fw, -fd), Vector2(fw, -fd), Vector2(fw, fd), Vector2(-fw, fd)]:
				var r := (c as Vector2).rotated(rot)
				pts.append(to_logical(p.x + r.x, p.y + r.y))
			var cp := CollisionPolygon2D.new()
			cp.polygon = pts
			statics.add_child(cp)
	for poly: Array in scene.water_world:
		var cp := CollisionPolygon2D.new()
		var pts := PackedVector2Array()
		for q: Array in poly:
			pts.append(to_logical(q[0], q[1]))
		cp.polygon = pts
		statics.add_child(cp)
	# the edge of the city zone: 4000 x 2500 units
	var hw := 2000.0
	var hh := 1250.0
	for wall in [Rect2(-hw - 60, -hh - 60, 2 * hw + 120, 60), Rect2(-hw - 60, hh, 2 * hw + 120, 60), Rect2(-hw - 60, -hh, 60, 2 * hh), Rect2(hw, -hh, 60, 2 * hh)]:
		var cs := CollisionShape2D.new()
		var rs := RectangleShape2D.new()
		rs.size = (wall as Rect2).size
		cs.shape = rs
		cs.position = (wall as Rect2).get_center()
		statics.add_child(cs)
	# the hero (the Legend of the game's own sheets): the body is logical, the picture is isometric
	hero_def = JSON.parse_string(FileAccess.get_file_as_string("res://assets/hero/hero.json"))
	for clip: String in hero_def.clips:
		sheets[clip] = load("res://assets/hero/" + str(hero_def.clips[clip].sheet).get_file())
	hero = CharacterBody2D.new()
	hero.position = to_logical(-12.0, -6.5)
	var feet := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 22.0
	feet.shape = circle
	hero.add_child(feet)
	add_child(hero)
	hero_view = Node2D.new()
	sorted.add_child(hero_view)
	hero_shadow = blob(shadows, Vector2.ZERO, 26.0, 11.0, 0.38)
	hero_sprite = Sprite2D.new()
	hero_sprite.centered = false
	hero_view.add_child(hero_sprite)
	camera = Camera2D.new()
	camera.zoom = Vector2.ONE * 1.35
	var v: Array = scene.view
	camera.limit_left = int(v[0]); camera.limit_top = int(v[1]); camera.limit_right = int(v[2]); camera.limit_bottom = int(v[3])
	hero_view.add_child(camera)
	var layer := CanvasLayer.new()
	add_child(layer)
	label.position = Vector2(16, 10)
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_outline_color", Color.BLACK)
	label.add_theme_constant_override("outline_size", 6)
	label.text = "ZIELONA PRZYSTAŃ  ·  strefa miasta 4000 × 2500 j.  ·  strzałki / WASD, Shift = bieg"
	layer.add_child(label)
	sync_view()
	show_frame("idle", 0.0)

func sync_view() -> void:
	var w := to_world(hero.position)
	var sp := screen_of(w.x, w.y, ground_z(w.x, w.y))
	hero_view.position = sp
	hero_shadow.position = sp + Vector2(2, 1)

func direction_of(m: Vector2) -> String:
	var a := fposmod(rad_to_deg(m.angle()) + 360.0, 360.0)
	var names := ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
	return names[int(round(a / 45.0)) % 8]

func show_frame(clip: String, t: float) -> void:
	var c: Dictionary = hero_def.clips[clip]
	var dirs: Dictionary = c.directions
	var mirrored: Array = c.get("mirrored", [])
	var key := facing
	var flip := false
	if mirrored.has(facing):
		flip = true
		key = {"left": "right", "down-left": "down-right", "up-left": "up-right"}[facing]
	var frames: Array = dirs[key]
	var f: Array = frames[int(t * float(c.fps)) % frames.size()]
	hero_sprite.texture = sheets[clip]
	hero_sprite.region_enabled = true
	hero_sprite.region_rect = Rect2(f[0], f[1], f[2], f[3])
	var cell := float(hero_def.cell)
	hero_sprite.scale = Vector2(HERO_SCALE, HERO_SCALE)
	hero_sprite.flip_h = flip
	var ox := float(f[4])
	if flip:
		ox = cell - float(f[4]) - float(f[2])
	hero_sprite.position = Vector2((ox - cell * 0.5) * HERO_SCALE, (float(f[5]) - cell * 0.95) * HERO_SCALE)

func _physics_process(delta: float) -> void:
	var m := Vector2.ZERO
	if use_script_motion:
		m = scripted_motion
	else:
		m = Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_up", "ui_down"))
		if Input.is_key_pressed(KEY_A): m.x -= 1.0
		if Input.is_key_pressed(KEY_D): m.x += 1.0
		if Input.is_key_pressed(KEY_W): m.y -= 1.0
		if Input.is_key_pressed(KEY_S): m.y += 1.0
	var running := Input.is_key_pressed(KEY_SHIFT)
	# keys are screen directions (up = away from the viewer): the isometric view turns the logical plane by 45 degrees
	var logical := Vector2(m.x + m.y, m.y - m.x) if m.length() > 0.1 else Vector2.ZERO
	if logical.length() > 0.1:
		logical = logical.normalized()
		hero.velocity = logical * SPEED * (1.6 if running else 1.0)
		hero.move_and_slide()
		var screen_dir := m.normalized()
		facing = direction_of(Vector2(screen_dir.x, screen_dir.y * 0.8))
		clip_time += delta
		show_frame("run" if running else "walk", clip_time)
	else:
		hero.velocity = Vector2.ZERO
		clip_time += delta
		show_frame("idle", clip_time)
	sync_view()
