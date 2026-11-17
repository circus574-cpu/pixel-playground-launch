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
var quest_mark := ""
var overlay: AnimatedSprite2D   # the second figure during a transformation (the form being revealed)
static var dissolve_shader: Shader
const DISSOLVE_CODE := """
shader_type canvas_item;
uniform float progress = 0.0;
uniform vec4 edge_color : source_color = vec4(1.0, 0.55, 0.15, 1.0);
uniform float edge = 0.09;
varying vec2 local;
void vertex() { local = VERTEX; }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float noise(vec2 p) {
	vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void fragment() {
	vec4 c = texture(TEXTURE, UV) * COLOR;
	float h = clamp((local.y + 128.0) / 256.0, 0.0, 1.0);
	float v = (1.0 - h) * 0.7 + noise(local * 0.06) * 0.3;   // the feet go first, the head last, with a ragged front
	if (v < progress) { discard; }
	float e = smoothstep(progress + edge, progress, v);
	c.rgb = mix(c.rgb, edge_color.rgb * 2.2, e);
	COLOR = c;
}
"""   # "!" = has a quest to give, "?" = a quest objective waits here

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

## The hero of a world: the one rendered from the 3D model, or the painted one when its sheets are not on this device (an installed APK
## that got newer code and data from the server but not the new pictures; those come with a new APK).
static func usable_hero(actors: Dictionary, world: String) -> Dictionary:
	var hero: Dictionary = actors.get(world + ".hero", {})
	var idle: Dictionary = (hero.get("clips", {}) as Dictionary).get("idle", {})
	if not idle.is_empty() and ResourceLoader.exists(str(idle.get("sheet", ""))):
		return hero
	return actors.get(world + ".hero_painted", hero)

func sheet(path: String) -> Texture2D:
	if not sheet_cache.has(path):
		sheet_cache[path] = load(path)
	return sheet_cache[path]

## Clips that stay in memory while the figure exists; every other clip is released after it has not been played for a while (see prune_clips).
const KEEP_CLIPS := ["idle", "walk", "run", "kiidle", "kiwalk", "kirun"]
const CLIP_IDLE_MS := 20000
var clip_used: Dictionary = {}     # clip -> time (ms) it was last asked for
var prune_timer := 0.0

func ensure_clip(clip_name: String) -> bool:
	clip_used[clip_name] = Time.get_ticks_msec()
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

## Transformation into the Ki form (or back): the current figure plays its transformation clip and burns away from the feet up with a glowing
## front, revealing the other form that plays the same movement underneath. Needs the clips "transform" and "kitransform" (or "idle" / "kiidle" going back).
## Returns the duration (0 when the clips are missing: then the form simply switches).
func transform(to_ki: bool, glow: Color = Color(1.0, 0.55, 0.15)) -> float:
	var from_clip := "transform" if to_ki else "kiidle"
	var to_clip := "kitransform" if to_ki else "idle"
	if not ensure_clip(from_clip) or not ensure_clip(to_clip):
		prefix = "ki" if to_ki else ""
		return 0.0
	var clip: Dictionary = definition.clips[from_clip]
	var duration := float((clip.directions.get(direction, clip.directions.values()[0]) as Array).size()) / maxf(1.0, float(clip.fps)) if to_ki else 0.45
	if is_instance_valid(overlay):
		overlay.queue_free()
	overlay = AnimatedSprite2D.new()
	overlay.sprite_frames = frames
	overlay.scale = sprite.scale
	overlay.position = sprite.position
	add_child(overlay)
	move_child(overlay, sprite.get_index())
	var target: Dictionary = definition.clips[to_clip]
	var to_anim := to_clip + ":" + direction
	if not frames.has_animation(to_anim):
		to_anim = to_clip + ":down"
	overlay.flip_h = direction in target.get("mirrored", [])
	overlay.play(to_anim)
	var from_anim := from_clip + ":" + direction
	if not frames.has_animation(from_anim):
		from_anim = from_clip + ":down"
	sprite.flip_h = direction in clip.get("mirrored", [])
	sprite.play(from_anim)
	one_shot_clip = from_clip
	one_shot_until = Time.get_ticks_msec() / 1000.0 + duration
	if dissolve_shader == null:
		dissolve_shader = Shader.new()
		dissolve_shader.code = DISSOLVE_CODE
	var mat := ShaderMaterial.new()
	mat.shader = dissolve_shader
	mat.set_shader_parameter("edge_color", glow)
	mat.set_shader_parameter("progress", 0.0)
	sprite.material = mat
	var tween := create_tween()
	tween.tween_interval(duration * (0.3 if to_ki else 0.0))
	tween.tween_method(func(v: float) -> void: mat.set_shader_parameter("progress", v), 0.0, 1.05, duration * (0.45 if to_ki else 0.9))
	tween.tween_interval(maxf(0.0, duration * (0.25 if to_ki else 0.1)))
	tween.tween_callback(func() -> void:
		prefix = "ki" if to_ki else ""
		sprite.material = null
		if is_instance_valid(overlay):
			overlay.queue_free()
		one_shot_until = 0.0
		animate(Vector2.ZERO))
	return duration

## Feet that do not slide: a walking or running clip may carry `refSpeed` (the ground speed, px/s, at which its steps match the ground);
## the clip then plays faster or slower with the real speed of the figure.
func match_gait(ground_speed: float) -> void:
	if not definition.clips.has(sprite.animation.get_slice(":", 0)):
		return
	var clip: Dictionary = definition.clips[sprite.animation.get_slice(":", 0)]
	if not clip.has("refSpeed") or ground_speed <= 0.0 or Time.get_ticks_msec() / 1000.0 < one_shot_until:
		sprite.speed_scale = 1.0
		return
	sprite.speed_scale = clampf(ground_speed / float(clip.refSpeed), 0.45, 1.8)

func hurt_flash() -> void:
	flash = 0.25
	sprite.modulate = Color(1.0, 0.55, 0.5)

## A hero rendered from a 3D model has 38 large sheets (~230 MB if all were in memory at once, more than a phone's graphics memory can spare next to the
## terrain): the clips that have not been played for CLIP_IDLE_MS are released; they are built again, from disk, when played next.
func prune_clips() -> void:
	var now := Time.get_ticks_msec()
	var playing := sprite.animation.get_slice(":", 0) if is_instance_valid(sprite) else ""
	for clip_name: String in built.keys():
		if KEEP_CLIPS.has(clip_name) or clip_name == playing or clip_name == one_shot_clip and now / 1000.0 < one_shot_until + 1.0:
			continue
		if not bool(built[clip_name]) or now - int(clip_used.get(clip_name, 0)) < CLIP_IDLE_MS:
			continue
		var clip: Dictionary = definition.clips[clip_name]
		for facing: String in clip.directions:
			var animation := clip_name + ":" + facing
			if frames.has_animation(animation):
				frames.remove_animation(animation)
		built.erase(clip_name)
		if clip.has("sheet") and sheet_cache.has(str(clip.sheet)):
			sheet_cache.erase(str(clip.sheet))

func _process(delta: float) -> void:
	prune_timer += delta
	if prune_timer >= 5.0:
		prune_timer = 0.0
		prune_clips()
	if flash > 0.0:
		flash -= delta
		if flash <= 0.0:
			sprite.modulate = Color.WHITE

func _draw() -> void:
	# soft contact shadow: a wide faint pool and a tighter darker core, both flattened to the ground
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.34))
	var soft: Texture2D = PyraFx.glow()
	var wide := 34.0 * shadow_scale
	var core := 20.0 * shadow_scale
	draw_texture_rect(soft, Rect2(Vector2(-wide, -wide), Vector2(wide, wide) * 2.0), false, Color(0.02, 0.01, 0.02, 0.5))
	draw_texture_rect(soft, Rect2(Vector2(-core, -core), Vector2(core, core) * 2.0), false, Color(0.0, 0.0, 0.0, 0.55))
	draw_set_transform(Vector2.ZERO)
	if quest_mark != "":
		var top := -display.y - 54.0
		var bob := sin(Time.get_ticks_msec() / 220.0) * 4.0
		var gold := Color("ffd24a") if quest_mark == "!" else Color("8fd0ff")
		draw_circle(Vector2(0, top + bob), 17.0, Color(0.08, 0.05, 0.03, 0.85))
		draw_arc(Vector2(0, top + bob), 17.0, 0, TAU, 24, gold, 2.5, true)
		var f: Font = ThemeDB.fallback_font
		draw_string(f, Vector2(-7, top + bob + 9), quest_mark, HORIZONTAL_ALIGNMENT_LEFT, -1, 26, gold)
