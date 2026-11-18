class_name IsoWorldActor
extends Node2D
## Animated character / NPC / Monster / Wildlife Animal for KI Legends 2D Isometric World.
## Supports 8-direction sprite sheets, trimmed atlas frames, grounded contact shadow,
## floating quest markers (! / ?), monster level badges, and health bars.

const DIRECTIONS := ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
const HERO_SCALE := 1.15
static var sheet_cache: Dictionary = {}

var sprite := AnimatedSprite2D.new()
var label := Label.new()
var definition: Dictionary = {}
var frames := SpriteFrames.new()
var built: Dictionary = {}
var direction := "down"
var state := "idle"
var prefix := ""
var display := Vector2.ZERO
var one_shot_until := 0.0
var one_shot_clip := ""
var flash := 0.0
var shadow_scale := 1.0
var is_hero := false
var actor_kind := "hero" # "hero", "npc", "monster", "animal"
var quest_mark := ""
var role_title := ""
var monster_level := 0
var hp_ratio := 1.0

func setup(
	data: Dictionary,
	display_name: String = "",
	inside: bool = false,
	hero: bool = false,
	kind: String = "hero",
	level: int = 0,
	q_mark: String = "",
	role: String = ""
) -> void:
	definition = data
	is_hero = hero
	actor_kind = kind
	monster_level = level
	quest_mark = q_mark
	role_title = role
	add_child(sprite)
	add_child(label)
	if frames.has_animation("default"):
		frames.remove_animation("default")
	sprite.sprite_frames = frames
	var cell := float(data.get("cell", 0))
	if cell == 0.0:
		var first: Variant = data.clips.idle.directions.down[0]
		if first is Dictionary:
			cell = float((first as Dictionary).rect[2])
		elif first is Array:
			cell = float((first as Array)[2])
		else:
			cell = 200.0
	var factor := float(data.get("interiorScale", 1.0)) if inside else 1.0
	if hero:
		factor *= HERO_SCALE
	elif kind == "monster":
		factor *= 1.08
	display = Vector2(float(data["size"][0]), float(data["size"][1])) * factor
	shadow_scale = clampf(display.x / 120.0, 0.55, 1.85)
	sprite.scale = display / cell
	sprite.position = Vector2((0.5 - float(data.origin[0])) * display.x, (0.5 - float(data.origin[1])) * display.y)
	if not display_name.is_empty():
		var full_text := display_name
		if kind == "monster" and level > 0:
			full_text = "Lv.%d %s" % [level, display_name]
		elif kind == "npc" and not role.is_empty():
			full_text = "%s\n<%s>" % [display_name, role]
		label.text = full_text
		label.position = Vector2(-150, -display.y - (38 if kind == "npc" and not role.is_empty() else 26))
		label.size = Vector2(300, 44)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 15 if kind != "hero" else 17)
		var fcol := Color("ffe5b3")
		if kind == "monster":
			fcol = Color("ff8c72") if level >= 10 else Color("GY" if false else "ffb870")
		elif kind == "npc":
			fcol = Color("8ef6ff")
		elif kind == "animal":
			fcol = Color("a6f29b")
		label.add_theme_color_override("font_color", fcol)
		label.add_theme_color_override("font_outline_color", Color(0.06, 0.03, 0.03, 0.96))
		label.add_theme_constant_override("outline_size", 6)
	animate(Vector2.ZERO)
	queue_redraw()

func sheet(path: String) -> Texture2D:
	if not sheet_cache.has(path):
		if ResourceLoader.exists(path):
			sheet_cache[path] = load(path)
		elif FileAccess.file_exists(path):
			var img := Image.new()
			var err := img.load_webp_from_buffer(FileAccess.get_file_as_bytes(path)) if path.ends_with(".webp") else img.load(path)
			if err == OK:
				sheet_cache[path] = ImageTexture.create_from_image(img)
	return sheet_cache.get(path, null)

func ensure_clip(clip_name: String) -> bool:
	if built.has(clip_name):
		return built[clip_name]
	if not definition.clips.has(clip_name):
		built[clip_name] = false
		return false
	var clip: Dictionary = definition.clips[clip_name]
	for facing: String in clip.directions:
		var animation := clip_name + ":" + facing
		frames.add_animation(animation)
		frames.set_animation_speed(animation, float(clip.fps))
		frames.set_animation_loop(animation, bool(clip.loop))
		for item: Variant in clip.directions[facing]:
			var atlas := AtlasTexture.new()
			if item is Dictionary:
				var d_item: Dictionary = item
				atlas.atlas = sheet(str(d_item.sheet))
				atlas.region = Rect2(float(d_item.rect[0]), float(d_item.rect[1]), float(d_item.rect[2]), float(d_item.rect[3]))
			elif item is Array:
				var a_item: Array = item
				atlas.atlas = sheet(str(clip.sheet))
				atlas.region = Rect2(float(a_item[0]), float(a_item[1]), float(a_item[2]), float(a_item[3]))
				atlas.margin = Rect2(float(a_item[4]), float(a_item[5]), float(a_item[6]), float(a_item[7]))
			frames.add_frame(animation, atlas)
	built[clip_name] = true
	return true

func face(vector: Vector2) -> void:
	if vector.length_squared() > 0.001:
		direction = DIRECTIONS[posmod(roundi(vector.angle() / (PI / 4.0)), 8)]

func clip_for(wanted: String) -> String:
	var candidate := prefix + wanted
	if ensure_clip(candidate):
		return candidate
	return wanted if ensure_clip(wanted) else "idle"

func play_clip(clip_name: String) -> void:
	var clip_id := clip_for(clip_name)
	var clip: Dictionary = definition.clips[clip_id]
	var animation := clip_id + ":" + direction
	if not frames.has_animation(animation):
		animation = clip_id + ":down"
	sprite.flip_h = direction in clip.get("mirrored", [])
	if sprite.animation != animation or not sprite.is_playing():
		sprite.play(animation)

func animate(motion: Vector2, running: bool = false) -> void:
	if quest_mark != "" or actor_kind == "monster":
		queue_redraw()
	if Time.get_ticks_msec() / 1000.0 < one_shot_until:
		return
	if motion.length_squared() > 0.001:
		face(motion)
		state = "run" if running and definition.clips.has(prefix + "run") else "walk"
		if not definition.clips.has(state) and not definition.clips.has(prefix + state):
			state = "idle"
	else:
		state = "idle"
	play_clip(state)

func _draw() -> void:
	# Grounded contact shadow + faction/aggro ring
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.36))
	draw_circle(Vector2.ZERO, 24.0 * shadow_scale, Color(0.02, 0.01, 0.01, 0.36))
	if actor_kind == "monster":
		draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 24, Color(1.0, 0.25, 0.15, 0.55), 2.2)
	elif actor_kind == "npc":
		draw_arc(Vector2.ZERO, 24.0 * shadow_scale, 0.0, TAU, 24, Color(0.28, 0.88, 1.0, 0.55), 2.0)
	elif is_hero:
		draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 28, Color(1.0, 0.82, 0.32, 0.78), 2.5)
	draw_set_transform(Vector2.ZERO)

	# Monster HP bar
	if actor_kind == "monster":
		var bw := 56.0
		var bh := 6.0
		var bp := Vector2(-bw * 0.5, -display.y - 8.0)
		draw_rect(Rect2(bp - Vector2(1, 1), Vector2(bw + 2, bh + 2)), Color(0.04, 0.02, 0.02, 0.92))
		draw_rect(Rect2(bp, Vector2(bw * clampf(hp_ratio, 0.0, 1.0), bh)), Color(0.94, 0.22, 0.16, 0.96))

	# NPC Quest Marker (! or ?)
	if actor_kind == "npc" and not quest_mark.is_empty():
		var bob := sin(Time.get_ticks_msec() / 220.0) * 3.5
		var qp := Vector2(0.0, -display.y - 54.0 + bob)
		var qcol := Color(1.0, 0.84, 0.22) if quest_mark == "!" else Color(0.32, 0.92, 1.0)
		draw_circle(qp, 13.0, Color(0.06, 0.04, 0.05, 0.92))
		draw_arc(qp, 13.0, 0.0, TAU, 20, qcol, 2.2)
		var f := ThemeDB.fallback_font
		draw_string(f, qp + Vector2(-4.5, 6.0), quest_mark, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, qcol)
