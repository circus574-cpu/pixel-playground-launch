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
static var _ki_glow_tex: Texture2D = null
static var _ki_wisp_tex: Texture2D = null

const KI_PALETTE := {
	"legend":    {"main": Color(1.0, 0.54, 0.16), "edge": Color(1.0, 0.24, 0.08), "core": Color(1.0, 0.95, 0.72)},
	"planetary": {"main": Color(0.28, 0.95, 0.52), "edge": Color(0.96, 0.84, 0.24), "core": Color(0.88, 1.0, 0.82)},
	"sage":      {"main": Color(0.34, 0.86, 1.0),  "edge": Color(0.58, 0.48, 1.0), "core": Color(0.92, 0.98, 1.0)},
	"android":   {"main": Color(0.16, 0.96, 0.98), "edge": Color(0.78, 0.34, 1.0), "core": Color(0.90, 0.98, 1.0)},
}

var sprite := AnimatedSprite2D.new()
var label := Label.new()
var ki_aura_back: Node2D = null
var ki_aura_front: Node2D = null
var definition: Dictionary = {}
var frames := SpriteFrames.new()
var built: Dictionary = {}
var direction := "down"
var state := "idle"
var prefix := ""
var ki_mode_active := false
var ki_aura_alpha := 0.0
var ki_remaining_sec := 0.0
var ki_race := "legend"
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

func _ki_pal() -> Dictionary:
	return KI_PALETTE.get(ki_race, KI_PALETTE["legend"])

static func _ensure_ki_textures() -> void:
	if _ki_glow_tex == null:
		var sz := 64
		var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
		var half := float(sz) * 0.5
		for y in sz:
			for x in sz:
				var dx := (float(x) + 0.5 - half) / half
				var dy := (float(y) + 0.5 - half) / half
				var d := sqrt(dx * dx + dy * dy)
				var a := clampf(pow(maxf(0.0, 1.0 - d), 2.3), 0.0, 1.0)
				img.set_pixel(x, y, Color(1.0, 1.0, 1.0, a))
		_ki_glow_tex = ImageTexture.create_from_image(img)
	if _ki_wisp_tex == null:
		var w := 40
		var h := 96
		var img2 := Image.create(w, h, false, Image.FORMAT_RGBA8)
		for y in h:
			var ny := float(y) / float(h - 1)
			var profile := sin(pow(ny, 0.72) * PI)
			for x in w:
				var nx := (float(x) + 0.5 - float(w) * 0.5) / (float(w) * 0.5)
				var sw := maxf(profile * 0.92, 0.01)
				var dx := absf(nx) / sw
				var a := clampf(pow(maxf(0.0, 1.0 - dx), 2.1) * profile * (1.0 - ny * 0.35), 0.0, 1.0)
				var core_hot := clampf(1.0 - dx * 1.4, 0.0, 1.0)
				img2.set_pixel(x, y, Color(1.0, 0.92 + 0.08 * core_hot, 0.75 + 0.25 * core_hot, a))
		_ki_wisp_tex = ImageTexture.create_from_image(img2)

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
	if is_hero:
		var add_mat := CanvasItemMaterial.new()
		add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		ki_aura_back = Node2D.new()
		ki_aura_back.z_index = -1
		ki_aura_back.material = add_mat
		ki_aura_back.draw.connect(_draw_ki_aura_back)
		add_child(ki_aura_back)
	add_child(sprite)
	if is_hero:
		var add_mat_f := CanvasItemMaterial.new()
		add_mat_f.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		ki_aura_front = Node2D.new()
		ki_aura_front.z_index = 2
		ki_aura_front.material = add_mat_f
		ki_aura_front.draw.connect(_draw_ki_aura_front)
		add_child(ki_aura_front)
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
			var loaded := load(path)
			if loaded is Texture2D:
				sheet_cache[path] = loaded
				return loaded
		if FileAccess.file_exists(path):
			var bytes := FileAccess.get_file_as_bytes(path)
			if not bytes.is_empty():
				var img := Image.new()
				var err := ERR_CANT_OPEN
				if path.ends_with(".webp"):
					err = img.load_webp_from_buffer(bytes)
				elif path.ends_with(".png"):
					err = img.load_png_from_buffer(bytes)
				elif path.ends_with(".jpg") or path.ends_with(".jpeg"):
					err = img.load_jpg_from_buffer(bytes)
				if err == OK:
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

func set_ki_mode(enabled: bool, duration_sec: float = 20.0) -> void:
	if enabled:
		ki_remaining_sec = maxf(duration_sec, 0.5)
		ki_aura_alpha = maxf(ki_aura_alpha, 0.25)
	else:
		ki_remaining_sec = 0.0
	if ki_mode_active == enabled:
		_queue_ki_redraw()
		return
	ki_mode_active = enabled
	prefix = "ki" if enabled else ""
	if enabled:
		play_action("transform", "channel")
	else:
		one_shot_until = 0.0
		animate(Vector2.ZERO, false)
	_queue_ki_redraw()

func set_ki_remaining(rem_sec: float) -> void:
	ki_remaining_sec = maxf(0.0, rem_sec)

func _queue_ki_redraw() -> void:
	queue_redraw()
	if ki_aura_back != null:
		ki_aura_back.queue_redraw()
	if ki_aura_front != null:
		ki_aura_front.queue_redraw()

func animate(motion: Vector2, running: bool = false, stride_scale: float = 1.0) -> void:
	if quest_mark != "" or actor_kind == "monster":
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

func _draw_ki_aura_back() -> void:
	if not is_hero or ki_aura_alpha <= 0.01:
		return
	_ensure_ki_textures()
	var c := ki_aura_back
	var pal := _ki_pal()
	var mc: Color = pal["main"]
	var ec: Color = pal["edge"]
	var cc: Color = pal["core"]
	var t_s := Time.get_ticks_msec() / 1000.0
	var a := ki_aura_alpha
	var body_h := maxf(display.y * 1.08, 128.0)
	var pulse := 1.0 + sin(t_s * 6.8) * 0.11

	# 1. Ground isometric luminous Ki seal & expanding shockwave rings
	c.draw_set_transform(Vector2(0, -2), 0.0, Vector2(1.0, 0.42))
	c.draw_circle(Vector2.ZERO, 66.0 * shadow_scale * pulse, Color(ec.r, ec.g, ec.b, 0.24 * a))
	c.draw_circle(Vector2.ZERO, 48.0 * shadow_scale * pulse, Color(mc.r, mc.g, mc.b, 0.34 * a))
	c.draw_arc(Vector2.ZERO, 56.0 * shadow_scale * pulse, 0.0, TAU, 44, Color(ec.r, ec.g, ec.b, 0.85 * a), 4.2, true)
	c.draw_arc(Vector2.ZERO, 40.0 * shadow_scale * (1.0 + cos(t_s * 5.2) * 0.06), 0.0, TAU, 36, Color(mc.r, mc.g, mc.b, 0.92 * a), 3.0, true)
	# Counter-rotating runic arcs
	for seg in 8:
		var a0 := t_s * 2.1 + float(seg) * (TAU / 8.0)
		c.draw_arc(Vector2.ZERO, 48.0 * shadow_scale, a0, a0 + 0.38, 8, Color(cc.r, cc.g, cc.b, 0.90 * a), 2.8, true)
		var a1 := -t_s * 1.4 + float(seg) * (TAU / 8.0)
		c.draw_arc(Vector2.ZERO, 33.0 * shadow_scale, a1, a1 + 0.30, 6, Color(mc.r, mc.g, mc.b, 0.72 * a), 2.0, true)
	# Expanding energy pulse waves along the ground
	for wi in 2:
		var wph := fposmod(t_s * 0.85 + float(wi) * 0.5, 1.0)
		var wr := (24.0 + wph * 60.0) * shadow_scale
		c.draw_arc(Vector2.ZERO, wr, 0.0, TAU, 36, Color(mc.r, mc.g, mc.b, (1.0 - wph) * 0.58 * a), 3.2 * (1.0 - wph * 0.5), true)
	c.draw_set_transform(Vector2.ZERO)

	# 2. Broad feathered radiant aura envelope behind hero body
	if _ki_glow_tex != null:
		var rx := 74.0 * shadow_scale * pulse
		var ry := body_h * 0.92 * pulse
		c.draw_texture_rect(_ki_glow_tex, Rect2(-rx, -body_h * 0.56 - ry * 0.56, rx * 2.0, ry * 1.42), false, Color(ec.r, ec.g, ec.b, 0.42 * a))
		c.draw_texture_rect(_ki_glow_tex, Rect2(-rx * 0.68, -body_h * 0.52 - ry * 0.44, rx * 1.36, ry * 1.12), false, Color(mc.r, mc.g, mc.b, 0.54 * a))
		c.draw_texture_rect(_ki_glow_tex, Rect2(-rx * 0.40, -body_h * 0.48 - ry * 0.32, rx * 0.80, ry * 0.82), false, Color(cc.r, cc.g, cc.b, 0.32 * a))

	# 3. 16 surging anime Ki flame tongues rising behind and around hero silhouette
	if _ki_wisp_tex != null:
		for i in 16:
			var h0 := fposmod(sin(float(i * 97 + 13)) * 43758.5453, 1.0)
			var h1 := fposmod(sin(float(i * 193 + 41)) * 43758.5453, 1.0)
			var ph := fposmod(t_s * (1.35 + 0.75 * h0) + h1, 1.0)
			var side_f := (h0 - 0.5) * 2.0
			var spread := (24.0 + 34.0 * (1.0 - ph * 0.35)) * shadow_scale
			var wx := side_f * spread + sin(ph * 10.0 + float(i) * 1.3) * 8.0
			var wy := -4.0 - ph * body_h * 1.12
			var ww := (1.0 - ph * 0.42) * (28.0 + 18.0 * h1) * shadow_scale
			var wh := (1.0 - ph * 0.25) * (66.0 + 38.0 * h0)
			var wcol := ec.lerp(mc, ph * 0.68).lerp(cc, clampf((1.0 - absf(side_f)) * 0.35, 0.0, 0.35))
			wcol.a = sin(ph * PI) * 0.72 * a
			c.draw_texture_rect(_ki_wisp_tex, Rect2(wx - ww * 0.5, wy - wh * 0.75, ww, wh), false, wcol)

func _draw_ki_aura_front() -> void:
	if not is_hero or ki_aura_alpha <= 0.01:
		return
	_ensure_ki_textures()
	var c := ki_aura_front
	var pal := _ki_pal()
	var mc: Color = pal["main"]
	var ec: Color = pal["edge"]
	var cc: Color = pal["core"]
	var t_s := Time.get_ticks_msec() / 1000.0
	var a := ki_aura_alpha
	var body_h := maxf(display.y * 1.08, 128.0)

	# 1. Twin ascending luminous Ki energy ribbons spiraling around hero (front-facing segments only!)
	for rib in 2:
		var pts := PackedVector2Array()
		var base_phase := float(rib) * PI + t_s * 3.8
		for step in 14:
			var frac := float(step) / 13.0
			var ang := base_phase + frac * TAU * 1.15
			var rad := (34.0 - frac * 10.0 + sin(t_s * 6.0 + frac * 5.0) * 3.5) * shadow_scale
			var sx := cos(ang) * rad
			var sy := -8.0 - frac * body_h * 1.05 + sin(ang) * 7.0
			pts.append(Vector2(sx, sy))
		if pts.size() >= 2:
			c.draw_polyline(pts, Color(ec.r, ec.g, ec.b, 0.42 * a), 8.0, true)
			c.draw_polyline(pts, Color(mc.r, mc.g, mc.b, 0.65 * a), 4.0, true)
			c.draw_polyline(pts, Color(cc.r, cc.g, cc.b, 0.80 * a), 1.6, true)

	# 2. Translucent front-side edge flames framing the hero without obscuring the face
	if _ki_wisp_tex != null:
		for fi in 6:
			var side_f := -1.0 if fi % 2 == 0 else 1.0
			var h0 := fposmod(sin(float(fi * 83 + 17)) * 43758.5453, 1.0)
			var ph := fposmod(t_s * (1.55 + 0.55 * h0) + float(fi) * 0.17, 1.0)
			var wx := side_f * (30.0 + 14.0 * h0 - ph * 10.0) * shadow_scale + sin(ph * 8.0 + float(fi)) * 5.0
			var wy := -6.0 - ph * body_h * 0.92
			var ww := (1.0 - ph * 0.45) * 20.0 * shadow_scale
			var wh := (1.0 - ph * 0.30) * 48.0
			var fc := mc.lerp(cc, 0.35)
			fc.a = sin(ph * PI) * 0.46 * a
			c.draw_texture_rect(_ki_wisp_tex, Rect2(wx - ww * 0.5, wy - wh * 0.72, ww, wh), false, fc)

	# 3. Crackling Ki lightning arcs snapping around hero silhouette
	var frame_tick := int(t_s * 15.0)
	for li in 5:
		var side_l := -1.0 if li % 2 == 0 else 1.0
		var lh := fposmod(sin(float(li * 73 + frame_tick * 19)) * 43758.5453, 1.0)
		if lh < 0.22:
			continue
		var y0 := -14.0 - lh * body_h * 0.58
		var p0 := Vector2(side_l * (26.0 + lh * 20.0) * shadow_scale, y0)
		var p1 := Vector2(side_l * (12.0 + (1.0 - lh) * 26.0) * shadow_scale, y0 - 38.0 - lh * 34.0)
		var lpts := PackedVector2Array([p0])
		var perp := (p1 - p0).orthogonal().normalized()
		for seg in range(1, 5):
			var frac := float(seg) / 5.0
			var jit := (fposmod(sin(float(li * 41 + seg * 29 + frame_tick * 53)) * 43758.5453, 1.0) - 0.5) * 20.0
			lpts.append(p0.lerp(p1, frac) + perp * jit)
		lpts.append(p1)
		c.draw_polyline(lpts, Color(ec.r, ec.g, ec.b, 0.55 * a), 5.0, true)
		c.draw_polyline(lpts, Color(mc.r, mc.g, mc.b, 0.85 * a), 2.8, true)
		c.draw_polyline(lpts, Color(cc.r, cc.g, cc.b, 0.98 * a), 1.3, true)

	# 4. 20 sparkling rising Ki motes & embers with bright white core
	for ei in 20:
		var h0 := fposmod(sin(float(ei * 61 + 7)) * 43758.5453, 1.0)
		var h1 := fposmod(sin(float(ei * 139 + 29)) * 43758.5453, 1.0)
		var ph := fposmod(t_s * (1.20 + 0.85 * h0) + h1, 1.0)
		var ang := TAU * h1 + t_s * (2.2 + h0 * 1.4)
		var ex := cos(ang) * (24.0 + 30.0 * h0) * shadow_scale
		var ey := -6.0 - ph * (body_h * 1.24)
		var er := (1.0 - ph) * 4.2 + 1.2
		var fade := sin(ph * PI) * a
		c.draw_circle(Vector2(ex, ey), er + 2.2, Color(ec.r, ec.g, ec.b, 0.42 * fade))
		c.draw_circle(Vector2(ex, ey), er + 0.8, Color(mc.r, mc.g, mc.b, 0.78 * fade))
		c.draw_circle(Vector2(ex, ey), er * 0.65, Color(cc.r, cc.g, cc.b, 0.98 * fade))

func _draw() -> void:
	# Grounded contact shadow + faction/aggro ring
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
		draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 28, Color(1.0, 0.82, 0.32, 0.80), 2.5)
	draw_set_transform(Vector2.ZERO)

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
	if is_hero and (ki_mode_active or ki_aura_alpha > 0.005):
		var target_a := 1.0 if ki_mode_active else 0.0
		if ki_mode_active and ki_remaining_sec > 0.0 and ki_remaining_sec < 1.2:
			target_a = clampf(ki_remaining_sec / 1.2, 0.15, 1.0)
		var rate := 3.4 if target_a > ki_aura_alpha else 2.2
		ki_aura_alpha = move_toward(ki_aura_alpha, target_a, delta * rate)
		if ki_aura_back != null:
			ki_aura_back.queue_redraw()
		if ki_aura_front != null:
			ki_aura_front.queue_redraw()
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
