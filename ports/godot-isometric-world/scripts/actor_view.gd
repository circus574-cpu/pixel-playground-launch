class_name IsoWorldActor
extends Node2D
## Animated character / NPC / Monster / Wildlife Animal for KI Legends 2D Isometric World.
## Supports all 47 Hero clips per race (4-hit attack combo, 9 skill-tree animations sk_A1..sk_C9,
## Ki-Mode transformation prefix="ki", dodge, guard, hit, death, respawn, victory, interact)
## and all 7 Monster clips (idle, walk, attack, skill, hit, death, respawn), plus crisp nameplates.

const DIRECTIONS := ["right", "down-right", "down", "down-left", "left", "up-left", "up", "up-right"]
const HERO_SCALE := 1.15
const ONE_SHOT_CLIPS := {
	"attack": true, "attack2": true, "attack3": true, "finisher": true,
	"skill": true, "skillb": true, "skillc": true,
	"sk_A1": true, "sk_A4": true, "sk_A9": true,
	"sk_B1": true, "sk_B4": true, "sk_B9": true,
	"sk_C1": true, "sk_C4": true, "sk_C9": true,
	"dodge": true, "guard": true, "hit": true, "hitheavy": true,
	"death": true, "respawn": true, "victory": true, "channel": true, "interact": true, "transform": true,
	"kiattack": true, "kiattack2": true, "kiskill": true, "kiskillb": true, "kiskillc": true,
	"kifinisher": true, "kidodge": true, "kiguard": true, "kihit": true, "kihitheavy": true,
	"kideath": true, "kirespawn": true, "kivictory": true, "kichannel": true, "kiinteract": true, "kitransform": true,
}

static var sheet_cache: Dictionary = {}

var sprite := AnimatedSprite2D.new()
var label := Label.new()
var definition: Dictionary = {}
var frames := SpriteFrames.new()
var built: Dictionary = {}
var direction := "down"
var state := "idle"
var prefix := ""
var ki_mode_active := false
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
var is_elite := false

func setup(
	data: Dictionary,
	display_name: String = "",
	inside: bool = false,
	hero: bool = false,
	kind: String = "hero",
	level: int = 0,
	q_mark: String = "",
	role: String = "",
	elite: bool = false
) -> void:
	definition = data
	is_hero = hero
	actor_kind = kind
	monster_level = level
	quest_mark = q_mark
	role_title = role
	is_elite = elite
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
			full_text = ("★ Poz.%d %s" % [level, display_name]) if elite else ("Poz.%d %s" % [level, display_name])
		elif kind == "npc" and not role.is_empty():
			full_text = "%s\n<%s>" % [display_name, role]
		label.text = full_text
		label.position = Vector2(-230, -display.y - (52 if kind == "npc" and not role.is_empty() else (44 if elite else 36)))
		label.size = Vector2(460, 56)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 24 if elite else (21 if kind != "hero" else 23))
		var fcol := Color("ffe8b8")
		if kind == "monster":
			fcol = Color("ffd54a") if elite else (Color("ff7860") if level >= 10 else Color("ffbe78"))
		elif kind == "npc":
			fcol = Color("8ef6ff")
		elif kind == "animal":
			fcol = Color("a6f29b")
		label.add_theme_color_override("font_color", fcol)
		label.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.02, 0.98))
		label.add_theme_constant_override("outline_size", 8)
	animate(Vector2.ZERO)
	queue_redraw()

func sheet(path: String) -> Texture2D:
	if not sheet_cache.has(path):
		if ResourceLoader.exists(path):
			sheet_cache[path] = load(path)
		else:
			var abs_p := ProjectSettings.globalize_path(path)
			var img := Image.new()
			if img.load(abs_p) == OK:
				sheet_cache[path] = ImageTexture.create_from_image(img)
	return sheet_cache.get(path, null)

func ensure_clip(clip_name: String) -> bool:
	if built.has(clip_name):
		return built[clip_name]
	var clips_dict: Dictionary = definition.get("clips", {})
	if not clips_dict.has(clip_name):
		built[clip_name] = false
		return false
	var clip: Dictionary = clips_dict[clip_name]
	var is_one_shot := ONE_SHOT_CLIPS.has(clip_name)
	for facing: String in clip.directions:
		var animation := clip_name + ":" + facing
		frames.add_animation(animation)
		var raw_list: Array = clip.directions[facing]
		var chosen_list: Array = raw_list
		var fps := float(clip.get("fps", 12.0))
		# Hero3D raw idle/kiidle frames 5..13 turn sideways/backwards; keep clean direction-locked breathing frames 0..3 ping-ponged!
		if is_hero and (clip_name == "idle" or clip_name == "kiidle") and raw_list.size() >= 16:
			chosen_list = [raw_list[0], raw_list[1], raw_list[2], raw_list[3], raw_list[2], raw_list[1]]
			fps = 5.5
		elif is_hero and (clip_name == "transform" or clip_name == "kitransform") and raw_list.size() >= 18:
			chosen_list = [raw_list[12], raw_list[13], raw_list[14], raw_list[15], raw_list[16], raw_list[17]]
			fps = 12.0
		frames.set_animation_speed(animation, fps)
		frames.set_animation_loop(animation, false if is_one_shot else bool(clip.get("loop", true)))
		for item: Variant in chosen_list:
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
	if vector.length_squared() > 0.0004:
		direction = DIRECTIONS[posmod(roundi(vector.angle() / (PI / 4.0)), 8)]

func clip_for(wanted: String) -> String:
	if not prefix.is_empty():
		var candidate := prefix + wanted
		if ensure_clip(candidate):
			return candidate
	if ensure_clip(wanted):
		return wanted
	if not prefix.is_empty() and ensure_clip(prefix + "idle"):
		return prefix + "idle"
	return "idle"

func play_clip(clip_name: String, force_restart: bool = false, speed_scale: float = 1.0) -> void:
	var clip_id := clip_for(clip_name)
	var clips_dict: Dictionary = definition.get("clips", {})
	if not clips_dict.has(clip_id):
		return
	var clip: Dictionary = clips_dict[clip_id]
	var animation := clip_id + ":" + direction
	if not frames.has_animation(animation):
		animation = clip_id + ":down"
	if not frames.has_animation(animation):
		return
	sprite.flip_h = direction in clip.get("mirrored", [])
	sprite.speed_scale = speed_scale
	if force_restart or sprite.animation != animation or not sprite.is_playing():
		sprite.play(animation)

func play_action(clip_name: String, fallback_clip: String = "attack", lock_sec: float = -1.0) -> float:
	var chosen := clip_name
	if not ensure_clip(prefix + chosen) and not ensure_clip(chosen):
		chosen = fallback_clip
	var resolved := clip_for(chosen)
	var clips_dict: Dictionary = definition.get("clips", {})
	var dur := 0.55
	if clips_dict.has(resolved):
		var clip: Dictionary = clips_dict[resolved]
		var fps := maxf(float(clip.get("fps", 14.0)), 4.0)
		var fcnt := 8
		var dirs: Dictionary = clip.get("directions", {})
		if dirs.has(direction):
			fcnt = (dirs[direction] as Array).size()
		elif dirs.has("down"):
			fcnt = (dirs["down"] as Array).size()
		dur = clampf(float(fcnt) / fps, 0.25, 2.2)
	if lock_sec > 0.0:
		dur = lock_sec
	one_shot_clip = resolved
	one_shot_until = Time.get_ticks_msec() / 1000.0 + dur
	play_clip(chosen, true, 1.0)
	if clip_name in ["hit", "hitheavy"]:
		flash = 0.22
	queue_redraw()
	return dur

func set_ki_mode(enabled: bool) -> void:
	if ki_mode_active == enabled:
		return
	ki_mode_active = enabled
	prefix = "ki" if enabled else ""
	if enabled:
		play_action("transform", "channel")
	else:
		one_shot_until = 0.0
		animate(Vector2.ZERO, false)
	queue_redraw()

func animate(motion: Vector2, running: bool = false, stride_scale: float = 1.0) -> void:
	if quest_mark != "" or actor_kind == "monster" or ki_mode_active:
		queue_redraw()
	if Time.get_ticks_msec() / 1000.0 < one_shot_until:
		return
	if motion.length_squared() > 0.0004:
		face(motion)
		var clips_dict: Dictionary = definition.get("clips", {})
		state = "run" if running and (clips_dict.has(prefix + "run") or clips_dict.has("run")) else "walk"
		if not clips_dict.has(state) and not clips_dict.has(prefix + state):
			state = "idle"
		play_clip(state, false, stride_scale)
	else:
		state = "idle"
		play_clip(state, false, 1.0)

func _draw() -> void:
	# Grounded contact shadow + faction/aggro/Ki-mode ring
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.36))
	draw_circle(Vector2.ZERO, 24.0 * shadow_scale, Color(0.02, 0.01, 0.01, 0.38))
	if actor_kind == "monster":
		if is_elite:
			var et := Time.get_ticks_msec() / 1000.0
			var ep := 1.0 + sin(et * 4.5) * 0.08
			draw_circle(Vector2.ZERO, 36.0 * shadow_scale * ep, Color(1.0, 0.34, 0.12, 0.22))
			draw_arc(Vector2.ZERO, 34.0 * shadow_scale * ep, 0.0, TAU, 32, Color(1.0, 0.80, 0.24, 0.92), 3.4)
			draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 24, Color(1.0, 0.22, 0.14, 0.85), 2.4)
		else:
			draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 24, Color(1.0, 0.25, 0.15, 0.62), 2.4)
	elif actor_kind == "npc":
		draw_arc(Vector2.ZERO, 24.0 * shadow_scale, 0.0, TAU, 24, Color(0.28, 0.88, 1.0, 0.58), 2.0)
	elif is_hero:
		if ki_mode_active:
			var t_sec := Time.get_ticks_msec() / 1000.0
			var pulse := 1.0 + sin(t_sec * 6.5) * 0.10
			draw_circle(Vector2.ZERO, 40.0 * shadow_scale * pulse, Color(1.0, 0.68, 0.16, 0.28))
			draw_arc(Vector2.ZERO, 38.0 * shadow_scale * pulse, 0.0, TAU, 36, Color(1.0, 0.86, 0.32, 0.96), 4.0)
			draw_arc(Vector2.ZERO, 28.0 * shadow_scale, 0.0, TAU, 28, Color(1.0, 0.96, 0.72, 0.80), 2.4)
		draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 28, Color(1.0, 0.82, 0.32, 0.80), 2.5)
	draw_set_transform(Vector2.ZERO)

	# Rising Ki Mode flame wisps & sparks around the hero's body
	if is_hero and ki_mode_active:
		var t_s := Time.get_ticks_msec() / 1000.0
		var body_h := maxf(display.y * 0.95, 110.0)
		for i in 10:
			var h0 := fposmod(sin(float(i * 97 + 13)) * 43758.5453, 1.0)
			var h1 := fposmod(sin(float(i * 193 + 41)) * 43758.5453, 1.0)
			var ph := fposmod(t_s * (1.1 + 0.55 * h0) + h1, 1.0)
			var ang := TAU * h1 + t_s * 2.1
			var wx := cos(ang) * 28.0 * shadow_scale
			var wy := -10.0 - ph * body_h
			var ww := (1.0 - ph) * 9.0
			var tip := Vector2(wx + sin(ph * 8.0 + float(i)) * 6.0, wy - 26.0 * (1.0 - ph))
			draw_colored_polygon(PackedVector2Array([
				Vector2(wx - ww, wy + 14.0),
				tip,
				Vector2(wx + ww, wy + 14.0),
			]), Color(1.0, 0.64 + 0.28 * ph, 0.18, 0.58 * (1.0 - ph)))
			draw_circle(Vector2(wx * 1.15, wy - 6.0), (1.0 - ph) * 3.4 + 1.0, Color(1.0, 0.94, 0.65, 0.88 * (1.0 - ph)))

	# Monster HP bar (gilded wider bar for named Elites)
	if actor_kind == "monster":
		var bw := 104.0 if is_elite else 72.0
		var bh := 10.0 if is_elite else 8.0
		var bp := Vector2(-bw * 0.5, -display.y - (14.0 if is_elite else 10.0))
		if is_elite:
			draw_rect(Rect2(bp - Vector2(2, 2), Vector2(bw + 4, bh + 4)), Color(1.0, 0.78, 0.24, 0.96), false, 2.0)
		draw_rect(Rect2(bp - Vector2(1, 1), Vector2(bw + 2, bh + 2)), Color(0.04, 0.02, 0.02, 0.94))
		draw_rect(Rect2(bp, Vector2(bw * clampf(hp_ratio, 0.0, 1.0), bh)), Color(0.96, 0.28, 0.14, 0.98) if is_elite else Color(0.94, 0.22, 0.16, 0.98))

	# NPC Quest Marker (! or ?)
	if actor_kind == "npc" and not quest_mark.is_empty():
		var bob := sin(Time.get_ticks_msec() / 220.0) * 3.5
		var qp := Vector2(0.0, -display.y - 68.0 + bob)
		var qcol := Color(1.0, 0.84, 0.22) if quest_mark == "!" else Color(0.32, 0.92, 1.0)
		draw_circle(qp, 15.0, Color(0.06, 0.04, 0.05, 0.94))
		draw_arc(qp, 15.0, 0.0, TAU, 20, qcol, 2.4)
		var f := ThemeDB.fallback_font
		draw_string(f, qp + Vector2(-5.0, 7.0), quest_mark, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, qcol)

	# Clean Floating RPG Combat Numbers (zero opaque boxes covering monsters!)
	if not float_nums.is_empty():
		var nf := ThemeDB.fallback_font
		for fn: Dictionary in float_nums:
			var age: float = float(fn["age"])
			var dur: float = float(fn["dur"])
			var p: float = clampf(age / maxf(dur, 0.1), 0.0, 1.0)
			var alpha: float = 1.0 if p < 0.62 else clampf((1.0 - p) / 0.38, 0.0, 1.0)
			var txt: String = str(fn["text"])
			var col: Color = fn["col"] as Color
			var fsz: int = int(fn["size"])
			var ox: float = float(fn["ox"])
			var oy: float = -display.y - 62.0 - p * 84.0
			var tw := nf.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fsz).x
			var pos := Vector2(ox - tw * 0.5, oy)
			draw_string_outline(nf, pos, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fsz, 9, Color(0.02, 0.01, 0.01, 0.95 * alpha))
			draw_string(nf, pos, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, fsz, Color(col.r, col.g, col.b, alpha))

var float_nums: Array[Dictionary] = []

func show_damage_number(msg: String, col: Color = Color(1.0, 0.88, 0.34), is_crit: bool = false) -> void:
	float_nums.append({
		"text": msg,
		"col": col,
		"size": 42 if is_crit else 34,
		"ox": randf_range(-24.0, 24.0),
		"age": 0.0,
		"dur": 1.15 if is_crit else 0.95,
	})
	if float_nums.size() > 5:
		float_nums.pop_front()
	queue_redraw()

var bubble_panel: PanelContainer
var bubble_lbl: Label
var bubble_ttl := 0.0
var bubble_max_ttl := 4.0

func _ensure_bubble() -> void:
	if bubble_panel != null:
		return
	bubble_panel = PanelContainer.new()
	bubble_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bubble_panel.z_index = 25
	var st := StyleBoxFlat.new()
	st.bg_color = Color(0.05, 0.045, 0.075, 0.92)
	st.border_color = Color(0.92, 0.74, 0.36, 0.94)
	st.set_border_width_all(2)
	st.set_corner_radius_all(10)
	st.content_margin_left = 14
	st.content_margin_right = 14
	st.content_margin_top = 8
	st.content_margin_bottom = 8
	bubble_panel.add_theme_stylebox_override("panel", st)
	bubble_lbl = Label.new()
	bubble_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bubble_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bubble_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bubble_lbl.custom_minimum_size = Vector2(260.0, 0.0)
	bubble_lbl.add_theme_font_size_override("font_size", 24)
	bubble_lbl.add_theme_color_override("font_color", Color(1.0, 0.96, 0.86))
	bubble_panel.add_child(bubble_lbl)
	bubble_panel.visible = false
	add_child(bubble_panel)

func show_bubble(msg: String, duration: float = 4.2) -> void:
	_ensure_bubble()
	bubble_lbl.text = msg
	bubble_panel.size = Vector2(290.0, 56.0)
	var top_y := -display.y - (136.0 if not quest_mark.is_empty() else 108.0)
	bubble_panel.position = Vector2(-145.0, top_y)
	bubble_panel.modulate = Color(1, 1, 1, 1)
	bubble_panel.visible = true
	bubble_ttl = duration
	bubble_max_ttl = duration

func hide_bubble() -> void:
	bubble_ttl = 0.0
	if bubble_panel != null:
		bubble_panel.visible = false

func _process(delta: float) -> void:
	if flash > 0.0:
		flash = maxf(0.0, flash - delta)
		sprite.modulate = Color(1.55, 0.75, 0.70, 1.0) if flash > 0.0 else Color.WHITE
	if not float_nums.is_empty():
		var alive_nums: Array[Dictionary] = []
		for fn: Dictionary in float_nums:
			fn["age"] = float(fn["age"]) + delta
			if float(fn["age"]) < float(fn["dur"]):
				alive_nums.append(fn)
		float_nums = alive_nums
		queue_redraw()
	if bubble_ttl > 0.0 and bubble_panel != null and bubble_panel.visible:
		bubble_ttl -= delta
		if bubble_ttl <= 0.0:
			bubble_panel.visible = false
		elif bubble_ttl < 0.55:
			bubble_panel.modulate.a = clampf(bubble_ttl / 0.55, 0.0, 1.0)
