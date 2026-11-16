class_name PyraActor
extends Node2D
## Animated character. Two source formats: NPC sheets (full cells, `rect` = [x, y, w, h]) and the Legend hero pack
## (trimmed atlas frames, 8 numbers = region + margin). Clips are built lazily, the first time they play.

const DIRECTIONS := ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
## Owner request 15.11.2026: the hero looked too small on the Android build.
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
var base_scale := Vector2.ONE
var base_position := Vector2.ZERO
var one_shot_until := 0.0
var one_shot_clip := ""
var flash := 0.0
var shadow_scale := 1.0
var is_hero := false
var quest_mark := ""   # "!" = has a quest to give, "?" = a quest objective waits here

func setup(data: Dictionary, display_name: String = "", inside: bool = false, hero: bool = false) -> void:
	definition = data
	is_hero = hero
	add_child(sprite)
	add_child(label)
	frames.remove_animation("default")
	sprite.sprite_frames = frames
	var cell := float(data.get("cell", 0))
	if cell == 0.0:
		var first: Dictionary = data.clips.idle.directions.down[0]
		cell = float(first.rect[2])
	var factor := float(data.get("interiorScale", 1.0)) if inside else 1.0
	if hero:
		factor *= HERO_SCALE
	display = Vector2(float(data["size"][0]), float(data["size"][1])) * factor
	shadow_scale = factor
	base_scale = display / cell
	base_position = Vector2((0.5 - float(data.origin[0])) * display.x, (0.5 - float(data.origin[1])) * display.y)
	apply_clip_scale({})
	if not display_name.is_empty():
		label.text = display_name
		label.position = Vector2(-140, -display.y - 24)
		label.size = Vector2(280, 30)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 17)
		label.add_theme_color_override("font_color", Color("ffe5b3"))
		label.add_theme_color_override("font_outline_color", Color(0.08, 0.04, 0.03, 0.95))
		label.add_theme_constant_override("outline_size", 6)
	animate(Vector2.ZERO)
	queue_redraw()

func sheet(path: String) -> Texture2D:
	if not sheet_cache.has(path):
		sheet_cache[path] = load(path)
	return sheet_cache[path]

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
		for item in clip.directions[facing]:
			var atlas := AtlasTexture.new()
			if item is Dictionary:
				atlas.atlas = sheet(item.sheet)
				atlas.region = Rect2(float(item.rect[0]), float(item.rect[1]), float(item.rect[2]), float(item.rect[3]))
			else:
				atlas.atlas = sheet(str(clip.sheet))
				atlas.region = Rect2(float(item[0]), float(item[1]), float(item[2]), float(item[3]))
				atlas.margin = Rect2(float(item[4]), float(item[5]), float(item[6]), float(item[7]))
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

## A clip may carry `scale` (data/actors.json, from scripts/godot/normalize_hero_loops.py): it brings the figure to the idle proportion, anchored on the feet.
func apply_clip_scale(clip: Dictionary) -> void:
	var k := float(clip.get("scale", 1.0))
	sprite.scale = base_scale * k
	sprite.position = base_position * k

func play_clip(clip_name: String) -> void:
	var clip_id := clip_for(clip_name)
	var clip: Dictionary = definition.clips[clip_id]
	var animation := clip_id + ":" + direction
	if not frames.has_animation(animation):
		animation = clip_id + ":down"
	sprite.flip_h = direction in clip.get("mirrored", [])
	apply_clip_scale(clip)
	if sprite.animation != animation or not sprite.is_playing():
		sprite.play(animation)

## One-off clip (attack, skill, hit) that blocks the idle/walk selection until it ends.
func play_once(clip_name: String) -> float:
	var clip_id := clip_for(clip_name)
	if not definition.clips.has(clip_id):
		return 0.0
	var clip: Dictionary = definition.clips[clip_id]
	var frames_count: int = 1
	var facing: Array = clip.directions.get(direction, clip.directions.values()[0])
	frames_count = facing.size()
	var duration := float(frames_count) / maxf(1.0, float(clip.fps))
	one_shot_clip = clip_id
	one_shot_until = Time.get_ticks_msec() / 1000.0 + duration
	var animation := clip_id + ":" + direction
	if not frames.has_animation(animation):
		animation = clip_id + ":down"
	sprite.flip_h = direction in clip.get("mirrored", [])
	apply_clip_scale(clip)
	sprite.play(animation)
	return duration

func animate(motion: Vector2, running: bool = false) -> void:
	if quest_mark != "":
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

func hurt_flash() -> void:
	flash = 0.25
	sprite.modulate = Color(1.0, 0.55, 0.5)

func _process(delta: float) -> void:
	if flash > 0.0:
		flash -= delta
		if flash <= 0.0:
			sprite.modulate = Color.WHITE

func _draw() -> void:
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.32))
	draw_circle(Vector2.ZERO, 22 * shadow_scale, Color(0.02, 0.01, 0.01, 0.32))
	draw_set_transform(Vector2.ZERO)
	if quest_mark != "":
		var top := -display.y - 54.0
		var bob := sin(Time.get_ticks_msec() / 220.0) * 4.0
		var gold := Color("ffd24a") if quest_mark == "!" else Color("8fd0ff")
		draw_circle(Vector2(0, top + bob), 17.0, Color(0.08, 0.05, 0.03, 0.85))
		draw_arc(Vector2(0, top + bob), 17.0, 0, TAU, 24, gold, 2.5, true)
		var f: Font = ThemeDB.fallback_font
		draw_string(f, Vector2(-7, top + bob + 9), quest_mark, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, gold)
