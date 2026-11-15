class_name PyraActor
extends Node2D

var sprite := AnimatedSprite2D.new()
var label := Label.new()
var definition: Dictionary = {}
var direction := "down"
var state := "idle"

func setup(data: Dictionary, display_name: String = "", inside: bool = false) -> void:
	definition = data
	add_child(sprite)
	add_child(label)
	var frames := SpriteFrames.new()
	frames.remove_animation("default")
	for clip_name: String in data.clips:
		var clip: Dictionary = data.clips[clip_name]
		for facing: String in clip.directions:
			var animation := clip_name + ":" + facing
			frames.add_animation(animation)
			frames.set_animation_speed(animation, float(clip.fps))
			frames.set_animation_loop(animation, bool(clip.loop))
			for item: Dictionary in clip.directions[facing]:
				var atlas := AtlasTexture.new()
				atlas.atlas = load(item.sheet)
				atlas.region = Rect2(float(item.rect[0]), float(item.rect[1]), float(item.rect[2]), float(item.rect[3]))
				frames.add_frame(animation, atlas)
	sprite.sprite_frames = frames
	var first: Dictionary = data.clips.idle.directions.down[0]
	var cell := float(first.rect[2])
	var factor := float(data.interiorScale) if inside else 1.0
	var display := Vector2(float(data["size"][ 0]), float(data["size"][ 1])) * factor
	sprite.scale = display / cell
	sprite.position = Vector2((0.5 - float(data.origin[0])) * display.x, (0.5 - float(data.origin[1])) * display.y)
	if not display_name.is_empty():
		label.text = display_name
		label.position = Vector2(-140, -display.y - 24)
		label.size = Vector2(280, 30)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 17)
		label.add_theme_color_override("font_color", Color("ffe5b3"))
		label.add_theme_color_override("font_shadow_color", Color.BLACK)
		label.add_theme_constant_override("shadow_offset_x", 2)
		label.add_theme_constant_override("shadow_offset_y", 2)
	animate(Vector2.ZERO)
	queue_redraw()

func animate(motion: Vector2) -> void:
	if motion.length_squared() > 0.001:
		var names := ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
		direction = names[posmod(roundi(motion.angle() / (PI / 4.0)), 8)]
		state = "walk" if definition.clips.has("walk") else "idle"
	else:
		state = "idle"
	var animation := state + ":" + direction
	if not sprite.sprite_frames.has_animation(animation):
		animation = state + ":down"
	var clip: Dictionary = definition.clips[state]
	sprite.flip_h = direction in clip.mirrored
	if sprite.animation != animation or not sprite.is_playing():
		sprite.play(animation)

func _draw() -> void:
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.32))
	draw_circle(Vector2.ZERO, 22, Color(0.02, 0.01, 0.01, 0.32))
	draw_set_transform(Vector2.ZERO)
