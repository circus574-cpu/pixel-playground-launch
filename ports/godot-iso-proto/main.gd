extends Node2D
## Isometric 2D prototype "Zielona Przystań". The ground (terrain.png) and every object (obj_*.png) are separate resources rendered by tools/build_scene.py
## in Blender; placements, footprints and the river come from scene.json. Objects are y-sorted by their foot point; the hero collides with the river
## (except under the bridge), with the footprints of buildings, trees and rocks, and with the edge of the map.
const DIR := "res://assets/zielona-przystan/"
const HERO_SCALE := 0.42
const SPEED := 150.0
const BLOCKING := ["house_a", "house_b", "house_c", "house_d", "house_moss_a", "house_moss_b", "forge", "tower", "tent_a", "tent_b", "tent_c", "tent_d", "crates", "fence", "pine_l", "pine_s", "oak_l", "oak_s", "fruit", "rock_l", "rock_s", "lamp", "boat_a", "boat_b"]
var scene: Dictionary
var hero: CharacterBody2D
var hero_sprite: Sprite2D
var hero_def: Dictionary
var sheets: Dictionary = {}
var facing := "down"
var clip_time := 0.0
var camera: Camera2D
var label := Label.new()
var scripted_motion := Vector2.ZERO   # tests drive the hero with this instead of the keyboard
var use_script_motion := false

func screen_of(x: float, y: float, z: float = 0.0) -> Vector2:
	var a: Dictionary = scene.axes
	var o: Array = a.offset
	return Vector2(a.x[0] * x + a.y[0] * y + a.z[0] * z + o[0], a.x[1] * x + a.y[1] * y + a.z[1] * z + o[1])

func _ready() -> void:
	scene = JSON.parse_string(FileAccess.get_file_as_string(DIR + "scene.json"))
	var ground := Sprite2D.new()
	ground.texture = load(DIR + "terrain.png")
	ground.centered = false
	add_child(ground)
	var sorted := Node2D.new()
	sorted.y_sort_enabled = true
	add_child(sorted)
	var textures: Dictionary = {}
	var statics := StaticBody2D.new()
	statics.name = "Collision"
	add_child(statics)
	for p: Dictionary in scene.placements:
		var proto: String = p.proto
		var info: Dictionary = scene.sprites[proto]
		if not textures.has(proto):
			textures[proto] = load(DIR + str(info.file))
		var foot := Node2D.new()
		foot.position = Vector2(p.screen[0], p.screen[1])
		var s := Sprite2D.new()
		s.texture = textures[proto]
		s.centered = false
		s.position = Vector2(info.box[0] - info.origin[0], info.box[1] - info.origin[1])
		foot.add_child(s)
		sorted.add_child(foot)
		if BLOCKING.has(proto):
			var fw: float = info.foot[0] * 0.5
			var fd: float = info.foot[1] * 0.5
			if proto.begins_with("pine") or proto.begins_with("oak") or proto == "fruit" or proto.begins_with("rock") or proto == "lamp":
				fw = minf(fw, 0.75); fd = minf(fd, 0.75)
			var rot := deg_to_rad(float(p.rot))
			var pts := PackedVector2Array()
			for c in [Vector2(-fw, -fd), Vector2(fw, -fd), Vector2(fw, fd), Vector2(-fw, fd)]:
				var r := (c as Vector2).rotated(rot)
				pts.append(screen_of(p.x + r.x, p.y + r.y, p.z))
			var cp := CollisionPolygon2D.new()
			cp.polygon = pts
			statics.add_child(cp)
		elif proto == "bridge":
			pass
	for poly: Array in scene.water:
		var cp := CollisionPolygon2D.new()
		var pts := PackedVector2Array()
		for q: Array in poly:
			pts.append(Vector2(q[0], q[1]))
		cp.polygon = pts
		statics.add_child(cp)
	# the map edge: four thick walls around the visible area
	var v: Array = scene.view
	for wall in [Rect2(v[0] - 40, v[1] - 40, v[2] - v[0] + 80, 40), Rect2(v[0] - 40, v[3], v[2] - v[0] + 80, 40), Rect2(v[0] - 40, v[1], 40, v[3] - v[1]), Rect2(v[2], v[1], 40, v[3] - v[1])]:
		var cs := CollisionShape2D.new()
		var rs := RectangleShape2D.new()
		rs.size = (wall as Rect2).size
		cs.shape = rs
		cs.position = (wall as Rect2).get_center()
		statics.add_child(cs)
	# the hero (the Legend of the game's own sheets)
	hero_def = JSON.parse_string(FileAccess.get_file_as_string("res://assets/hero/hero.json"))
	for clip: String in hero_def.clips:
		sheets[clip] = load("res://assets/hero/" + str(hero_def.clips[clip].sheet).get_file())
	hero = CharacterBody2D.new()
	hero.position = screen_of(-12.0, -6.5, 0.4)
	var feet := CollisionShape2D.new()
	var circle := CircleShape2D.new()
	circle.radius = 7.0
	feet.shape = circle
	hero.add_child(feet)
	hero_sprite = Sprite2D.new()
	hero_sprite.centered = false
	hero.add_child(hero_sprite)
	sorted.add_child(hero)
	camera = Camera2D.new()
	camera.zoom = Vector2.ONE * 1.35
	camera.limit_left = int(v[0]); camera.limit_top = int(v[1]); camera.limit_right = int(v[2]); camera.limit_bottom = int(v[3])
	hero.add_child(camera)
	var layer := CanvasLayer.new()
	add_child(layer)
	label.position = Vector2(16, 10)
	label.add_theme_font_size_override("font_size", 22)
	label.add_theme_color_override("font_outline_color", Color.BLACK)
	label.add_theme_constant_override("outline_size", 6)
	label.text = "ZIELONA PRZYSTAŃ  ·  prototyp izometryczny 2D  ·  strzałki / WASD, Shift = bieg"
	layer.add_child(label)
	show_frame("idle", 0.0)

func direction_of(m: Vector2) -> String:
	var a := fposmod(rad_to_deg(m.angle()) + 360.0, 360.0)   # 0 = right, 90 = down
	var names := ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
	return names[int(round(a / 45.0)) % 8]

func show_frame(clip: String, t: float) -> void:
	var c: Dictionary = hero_def.clips[clip]
	var dirs: Dictionary = c.directions
	var name := facing
	var mirrored: Array = c.get("mirrored", [])
	var key := name
	var flip := false
	if mirrored.has(name):
		flip = true
		key = {"left": "right", "down-left": "down-right", "up-left": "up-right"}[name]
	var frames: Array = dirs[key]
	var f: Array = frames[int(t * float(c.fps)) % frames.size()]
	hero_sprite.texture = sheets[clip]
	hero_sprite.region_enabled = true
	hero_sprite.region_rect = Rect2(f[0], f[1], f[2], f[3])
	var cell := float(hero_def.cell)
	var sc := HERO_SCALE
	hero_sprite.scale = Vector2(sc, sc)
	hero_sprite.flip_h = flip
	var ox := float(f[4])
	if flip:
		ox = cell - float(f[4]) - float(f[2])   # the mirrored picture sits on the other side of the cell
	hero_sprite.position = Vector2((ox - cell * 0.5) * sc, (float(f[5]) - cell * 0.95) * sc)

func _physics_process(delta: float) -> void:
	var m := Vector2.ZERO
	if use_script_motion:
		m = scripted_motion
	else:
		m = Vector2(Input.get_axis("ui_left", "ui_right") + Input.get_axis("ui_left", "ui_right") * 0.0, Input.get_axis("ui_up", "ui_down"))
		if Input.is_key_pressed(KEY_A): m.x -= 1.0
		if Input.is_key_pressed(KEY_D): m.x += 1.0
		if Input.is_key_pressed(KEY_W): m.y -= 1.0
		if Input.is_key_pressed(KEY_S): m.y += 1.0
	var running := Input.is_key_pressed(KEY_SHIFT)
	if m.length() > 0.1:
		m = m.normalized()
		facing = direction_of(m)
		hero.velocity = Vector2(m.x, m.y * 0.55) * SPEED * (1.7 if running else 1.0)
		hero.move_and_slide()
		clip_time += delta
		show_frame("run" if running else "walk", clip_time)
	else:
		hero.velocity = Vector2.ZERO
		clip_time += delta
		show_frame("idle", clip_time)
