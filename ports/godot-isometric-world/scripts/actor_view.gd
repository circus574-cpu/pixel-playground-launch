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
	"takeoff": true, "land": true, "heavy_strike": true, "ki_blast": true,
	"kiattack": true, "kiattack2": true, "kiskill": true, "kiskillb": true, "kiskillc": true,
	"kifinisher": true, "kidodge": true, "kiguard": true, "kihit": true, "kihitheavy": true,
	"kideath": true, "kirespawn": true, "kivictory": true, "kichannel": true, "kiinteract": true, "kitransform": true,
}

static var sheet_cache: Dictionary = {}
static var _ki_glow_tex: Texture2D = null
static var _ki_wisp_tex: Texture2D = null

const KI_CLIP_MAP := {
	"sk_A1": "kiskill",
	"sk_A4": "kiskill",
	"sk_A9": "kifinisher",
	"sk_B1": "kiskillb",
	"sk_B4": "kiskillb",
	"sk_B9": "kiguard",
	"sk_C1": "kiskillc",
	"sk_C4": "kiskillc",
	"sk_C9": "kiskillc",
	"attack3": "kiattack2",
}

const KI_PALETTE := {
	"legend":    {"main": Color(1.0, 0.54, 0.16), "edge": Color(1.0, 0.24, 0.08), "core": Color(1.0, 0.95, 0.72)},
	"planetary": {"main": Color(0.28, 0.95, 0.52), "edge": Color(0.96, 0.84, 0.24), "core": Color(0.88, 1.0, 0.82)},
	"sage":      {"main": Color(0.34, 0.86, 1.0),  "edge": Color(0.58, 0.48, 1.0), "core": Color(0.92, 0.98, 1.0)},
	"android":   {"main": Color(0.16, 0.96, 0.98), "edge": Color(0.78, 0.34, 1.0), "core": Color(0.90, 0.98, 1.0)},
	"gm":        {"main": Color(0.38, 0.92, 1.0),  "edge": Color(1.0, 0.82, 0.28), "core": Color(0.98, 0.99, 1.0)},
}

const GM_FLY_ALTITUDE := 76.0

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
var is_gm_avatar := false
var gm_flying := false
var gm_boost := false
var gm_fly_height := 0.0
var _base_sprite_pos := Vector2.ZERO
var _base_label_y := -140.0
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
var is_boss := false
var boss_phase := 1
var boss_shield_active := false
var weapon_glow_tier := 0
var is_locked_target := false
var status_flags: Dictionary = {}

func _ki_pal() -> Dictionary:
	if is_gm_avatar:
		return KI_PALETTE["gm"]
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
	shadow_scale = clampf(display.x / 120.0, 0.55, 2.25)
	sprite.scale = display / cell
	sprite.position = Vector2((0.5 - float(data.origin[0])) * display.x, (0.5 - float(data.origin[1])) * display.y)
	_base_sprite_pos = sprite.position
	if str(data.get("id", "")) == "hero-gm-3d":
		is_gm_avatar = true
		ki_race = "gm"
	if not display_name.is_empty():
		var full_text := display_name
		if kind == "monster" and level > 0:
			if is_boss:
				full_text = "☠ BOSS Poz.%d %s" % [level, display_name]
			else:
				full_text = ("★ Poz.%d %s" % [level, display_name]) if elite else ("Poz.%d %s" % [level, display_name])
		elif kind == "npc" and not role.is_empty():
			full_text = "%s\n<%s>" % [display_name, role]
		label.text = full_text
		_base_label_y = -display.y - (58.0 if is_boss else (52.0 if kind == "npc" and not role.is_empty() else (44.0 if elite else 36.0)))
		label.position = Vector2(-260, _base_label_y)
		label.size = Vector2(520, 58)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size", 28 if is_gm_avatar else (26 if is_boss else (24 if elite else (21 if kind != "hero" else 23))))
		var fcol := Color("ffe87a") if is_gm_avatar else Color("ffe8b8")
		if kind == "monster":
			fcol = Color("ff4838") if is_boss else (Color("ffd54a") if elite else (Color("ff7860") if level >= 10 else Color("ffbe78")))
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
		var mapped := str(KI_CLIP_MAP.get(wanted, ""))
		if not mapped.is_empty() and ensure_clip(mapped):
			return mapped
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
	var has_ki_mapped := not prefix.is_empty() and not str(KI_CLIP_MAP.get(chosen, "")).is_empty() and ensure_clip(str(KI_CLIP_MAP.get(chosen, "")))
	if not has_ki_mapped and not ensure_clip(prefix + chosen) and not ensure_clip(chosen):
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

func set_gm_flight(flying: bool, instant: bool = false) -> void:
	var was := gm_flying
	gm_flying = flying
	if instant:
		gm_fly_height = GM_FLY_ALTITUDE if flying else 0.0
	elif was != flying and is_gm_avatar:
		if flying:
			play_action("takeoff", "hover", 0.62)
		else:
			play_action("land", "idle", 0.52)
	_apply_gm_lift_visuals()
	_queue_ki_redraw()

func set_gm_boost(boosted: bool) -> void:
	gm_boost = boosted
	_queue_ki_redraw()

func get_gm_lift_px() -> float:
	if not is_gm_avatar or gm_fly_height <= 0.1:
		return 0.0
	var bob := 0.0
	if gm_flying and gm_fly_height > GM_FLY_ALTITUDE * 0.55:
		var t_s := Time.get_ticks_msec() / 1000.0
		bob = sin(t_s * 2.8) * 7.0
	return maxf(0.0, gm_fly_height + bob)

func _apply_gm_lift_visuals() -> void:
	var lift := get_gm_lift_px()
	if _base_sprite_pos != Vector2.ZERO:
		sprite.position = Vector2(_base_sprite_pos.x, _base_sprite_pos.y - lift)
	if not label.text.is_empty():
		label.position.y = _base_label_y - lift
	if is_gm_avatar:
		z_index = 12 if lift > 10.0 else 0

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
	var clips_dict: Dictionary = definition.get("clips", {})
	if is_gm_avatar and gm_flying:
		if motion.length_squared() > 0.0004:
			face(motion)
			state = "glide" if clips_dict.has("glide") else "hover"
			play_clip(state, false, maxf(stride_scale, 1.35 if gm_boost else 1.0))
		else:
			state = "hover" if clips_dict.has("hover") else "idle"
			play_clip(state, false, 1.0)
		return
	if motion.length_squared() > 0.0004:
		face(motion)
		state = "run" if running and (clips_dict.has(prefix + "run") or clips_dict.has("run")) else "walk"
		if not clips_dict.has(state) and not clips_dict.has(prefix + state):
			state = "idle"
		var eff_stride := stride_scale * (1.45 if (is_gm_avatar and gm_boost) else 1.0)
		play_clip(state, false, eff_stride)
	else:
		state = "idle"
		play_clip(state, false, 1.0)

func _draw_ki_aura_back() -> void:
	var gm_vis := is_gm_avatar and is_hero
	var a := ki_aura_alpha
	if gm_vis:
		var gm_floor := 0.42 + (0.34 if (gm_flying or gm_fly_height > 4.0) else 0.0) + (0.28 if gm_boost else 0.0)
		a = maxf(a, clampf(gm_floor, 0.0, 1.0))
	if not is_hero or a <= 0.01:
		return
	_ensure_ki_textures()
	var c := ki_aura_back
	var pal := _ki_pal()
	var mc: Color = pal["main"]
	var ec: Color = pal["edge"]
	var cc: Color = pal["core"]
	var t_s := Time.get_ticks_msec() / 1000.0
	var body_h := maxf(display.y * 1.08, 128.0)
	var lift := get_gm_lift_px()
	var fly_frac := clampf(lift / GM_FLY_ALTITUDE, 0.0, 1.0)
	var pulse := 1.0 + sin(t_s * (8.4 if gm_boost else 6.2)) * 0.11

	# 1. Ground isometric luminous Ki seal & expanding shockwave rings (always stays anchored on ground!)
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
		var wph := fposmod(t_s * (1.25 if gm_boost else 0.85) + float(wi) * 0.5, 1.0)
		var wr := (24.0 + wph * (76.0 if gm_vis else 60.0)) * shadow_scale
		c.draw_arc(Vector2.ZERO, wr, 0.0, TAU, 36, Color(mc.r, mc.g, mc.b, (1.0 - wph) * 0.62 * a), 3.4 * (1.0 - wph * 0.5), true)
	c.draw_set_transform(Vector2.ZERO)

	# 1B. GameMaster Airborne Levitation Updraft Vortex + Under-Boots Halo (between earth and floating boots!)
	if gm_vis and fly_frac > 0.04:
		# Rising air-pressure vortex rings floating between ground and levitating boots
		for vi in 3:
			var vph := fposmod(t_s * (1.45 if gm_boost else 0.95) + float(vi) / 3.0, 1.0)
			var vy := -lerpf(4.0, lift + 10.0, vph)
			var vr := lerpf(54.0, 26.0, vph) * shadow_scale
			var va := sin(vph * PI) * 0.78 * fly_frac
			c.draw_set_transform(Vector2(0.0, vy), 0.0, Vector2(1.0, 0.38))
			c.draw_arc(Vector2.ZERO, vr, 0.0, TAU, 36, Color(mc.r, mc.g, mc.b, va), 3.4, true)
			c.draw_arc(Vector2.ZERO, vr * 0.76, 0.0, TAU, 28, Color(ec.r, ec.g, ec.b, va * 0.80), 2.2, true)
			c.draw_set_transform(Vector2.ZERO)
		# Radiant celestial halo disc directly beneath levitating boots
		c.draw_set_transform(Vector2(0.0, -lift + 6.0), 0.0, Vector2(1.0, 0.38))
		c.draw_circle(Vector2.ZERO, 44.0 * shadow_scale * pulse, Color(mc.r, mc.g, mc.b, 0.30 * fly_frac))
		c.draw_arc(Vector2.ZERO, 42.0 * shadow_scale * pulse, 0.0, TAU, 40, Color(ec.r, ec.g, ec.b, 0.92 * fly_frac), 3.6, true)
		c.draw_arc(Vector2.ZERO, 28.0 * shadow_scale, 0.0, TAU, 32, Color(cc.r, cc.g, cc.b, 0.88 * fly_frac), 2.4, true)
		for seg_b in 6:
			var ang_b := -t_s * 3.1 + float(seg_b) * (TAU / 6.0)
			c.draw_arc(Vector2.ZERO, 36.0 * shadow_scale, ang_b, ang_b + 0.45, 8, Color(cc.r, cc.g, cc.b, 0.95 * fly_frac), 2.6, true)
		c.draw_set_transform(Vector2.ZERO)
		# Soft vertical levitation energy column connecting ground sigil to hovering boots
		if _ki_glow_tex != null:
			var col_w := 44.0 * shadow_scale
			c.draw_texture_rect(_ki_glow_tex, Rect2(-col_w, -lift - 12.0, col_w * 2.0, lift + 16.0), false, Color(mc.r, mc.g, mc.b, 0.28 * fly_frac))

	# 2. Broad feathered radiant aura envelope framing behind hero body (lifts cleanly with flight!)
	if _ki_glow_tex != null:
		var rx := (88.0 if gm_vis else 82.0) * shadow_scale * pulse
		var ry := body_h * 0.96 * pulse
		c.draw_texture_rect(_ki_glow_tex, Rect2(-rx, -lift - body_h * 0.56 - ry * 0.56, rx * 2.0, ry * 1.44), false, Color(ec.r, ec.g, ec.b, (0.48 if gm_boost else 0.40) * a))
		c.draw_texture_rect(_ki_glow_tex, Rect2(-rx * 0.72, -lift - body_h * 0.52 - ry * 0.46, rx * 1.44, ry * 1.14), false, Color(mc.r, mc.g, mc.b, (0.58 if gm_boost else 0.48) * a))

	# 3. 16 surging anime Ki flame tongues rising BEHIND & AROUND hero silhouette (pushed outward so hero stands crisp in center)
	if _ki_wisp_tex != null:
		for i in 16:
			var h0 := fposmod(sin(float(i * 97 + 13)) * 43758.5453, 1.0)
			var h1 := fposmod(sin(float(i * 193 + 41)) * 43758.5453, 1.0)
			var ph := fposmod(t_s * ((1.95 if gm_boost else 1.35) + 0.75 * h0) + h1, 1.0)
			var side_sign := -1.0 if i % 2 == 0 else 1.0
			var spread := (34.0 + 30.0 * h0) * (1.0 - ph * 0.22) * shadow_scale
			var wx := side_sign * spread + sin(ph * 9.0 + float(i) * 1.3) * 7.0
			var wy := -lift - 4.0 - ph * body_h * 1.15
			var ww := (1.0 - ph * 0.42) * (28.0 + 18.0 * h1) * shadow_scale
			var wh := (1.0 - ph * 0.25) * (68.0 + 36.0 * h0)
			var wcol := ec.lerp(mc, ph * 0.68).lerp(cc, 0.22)
			wcol.a = sin(ph * PI) * 0.76 * a
			c.draw_texture_rect(_ki_wisp_tex, Rect2(wx - ww * 0.5, wy - wh * 0.75, ww, wh), false, wcol)

	# 4. Twin luminous Ki energy ribbons spiraling BEHIND the hero (silky-smooth 32-point curves, never crossing face/torso)
	var rib_mult := 1.0 if (ki_mode_active or gm_boost) else (0.58 if gm_vis else 1.0)
	for rib in 2:
		var pts := PackedVector2Array()
		var base_phase := float(rib) * PI + t_s * (5.0 if gm_boost else 3.2)
		for step in 32:
			var frac := float(step) / 31.0
			var ang := base_phase + frac * TAU * 1.15
			var rad := (48.0 - frac * 6.0 + sin(t_s * 4.5 + frac * 4.0) * 3.0) * shadow_scale
			var sx := cos(ang) * rad
			var sy := -lift - 10.0 - frac * body_h * 1.02 + sin(ang) * 7.0
			pts.append(Vector2(sx, sy))
		if pts.size() >= 2:
			c.draw_polyline(pts, Color(ec.r, ec.g, ec.b, 0.36 * a * rib_mult), 6.2, true)
			c.draw_polyline(pts, Color(mc.r, mc.g, mc.b, 0.62 * a * rib_mult), 3.0, true)
			c.draw_polyline(pts, Color(cc.r, cc.g, cc.b, 0.78 * a * rib_mult), 1.3, true)

	# 5. Crackling outer Ki lightning arcs snapping around outer perimeter behind hero
	if ki_mode_active or gm_boost:
		var arc_cnt := 6 if gm_boost else 4
		var frame_tick := int(t_s * (18.0 if gm_boost else 14.0))
		for li in arc_cnt:
			var side_l := -1.0 if li % 2 == 0 else 1.0
			var lh := fposmod(sin(float(li * 73 + frame_tick * 19)) * 43758.5453, 1.0)
			if lh < 0.22:
				continue
			var y0 := -lift - 14.0 - lh * body_h * 0.56
			var p0 := Vector2(side_l * (42.0 + lh * 20.0) * shadow_scale, y0)
			var p1 := Vector2(side_l * (38.0 + (1.0 - lh) * 24.0) * shadow_scale, y0 - 38.0 - lh * 32.0)
			var lpts := PackedVector2Array([p0])
			var perp := (p1 - p0).orthogonal().normalized()
			for seg in range(1, 5):
				var frac := float(seg) / 5.0
				var jit := (fposmod(sin(float(li * 41 + seg * 29 + frame_tick * 53)) * 43758.5453, 1.0) - 0.5) * 16.0
				lpts.append(p0.lerp(p1, frac) + perp * jit)
			lpts.append(p1)
			c.draw_polyline(lpts, Color(ec.r, ec.g, ec.b, 0.52 * a), 4.4, true)
			c.draw_polyline(lpts, Color(mc.r, mc.g, mc.b, 0.84 * a), 2.4, true)
			c.draw_polyline(lpts, Color(cc.r, cc.g, cc.b, 0.94 * a), 1.2, true)

func _draw_ki_aura_front() -> void:
	var gm_vis := is_gm_avatar and is_hero
	var a := ki_aura_alpha
	if gm_vis:
		var gm_floor := 0.42 + (0.34 if (gm_flying or gm_fly_height > 4.0) else 0.0) + (0.28 if gm_boost else 0.0)
		a = maxf(a, clampf(gm_floor, 0.0, 1.0))
	if not is_hero or a <= 0.01:
		return
	var c := ki_aura_front
	var pal := _ki_pal()
	var mc: Color = pal["main"]
	var ec: Color = pal["edge"]
	var cc: Color = pal["core"]
	var t_s := Time.get_ticks_msec() / 1000.0
	var body_h := maxf(display.y * 1.08, 128.0)
	var lift := get_gm_lift_px()

	# Keep front layer strictly AROUND the outer perimeter & below feet — NEVER obscuring the hero sprite!
	# 1. Subtle front-half arc at feet level (follows hovering boots when airborne!)
	c.draw_set_transform(Vector2(0, 2.0 - lift), 0.0, Vector2(1.0, 0.36))
	c.draw_arc(Vector2.ZERO, 44.0 * shadow_scale, 0.12, PI - 0.12, 22, Color(mc.r, mc.g, mc.b, 0.56 * a), 3.0, true)
	c.draw_set_transform(Vector2.ZERO)

	# 2. Outer perimeter rising Ki sparks strictly outside character torso width (|x| >= 38)
	var spark_cnt := 18 if (gm_vis and (gm_flying or gm_boost)) else 12
	for ei in spark_cnt:
		var side_e := -1.0 if ei % 2 == 0 else 1.0
		var h0 := fposmod(sin(float(ei * 61 + 7)) * 43758.5453, 1.0)
		var h1 := fposmod(sin(float(ei * 139 + 29)) * 43758.5453, 1.0)
		var ph := fposmod(t_s * ((1.75 if gm_boost else 1.15) + 0.75 * h0) + h1, 1.0)
		var ex := side_e * (38.0 + 28.0 * h0) * shadow_scale + sin(t_s * 3.2 + float(ei)) * 5.0
		var ey := -lift * 0.45 - 8.0 - ph * (body_h * 1.18 + lift * 0.55)
		var er := (1.0 - ph) * 3.8 + 1.2
		var fade := sin(ph * PI) * 0.88 * a
		c.draw_circle(Vector2(ex, ey), er + 1.8, Color(ec.r, ec.g, ec.b, 0.42 * fade))
		c.draw_circle(Vector2(ex, ey), er * 0.65, Color(cc.r, cc.g, cc.b, 0.94 * fade))

func _draw() -> void:
	# Grounded contact shadow + faction/aggro ring (shrinks & softens dynamically when GameMaster levitates!)
	var lift := get_gm_lift_px()
	var alt_frac := clampf(lift / GM_FLY_ALTITUDE, 0.0, 1.0)
	var sh_mult := lerpf(1.0, 0.60, alt_frac)
	var sh_alpha := lerpf(0.38, 0.22, alt_frac)
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.36))
	draw_circle(Vector2.ZERO, 24.0 * shadow_scale * sh_mult, Color(0.02, 0.01, 0.01, sh_alpha))
	if actor_kind == "monster":
		if is_boss:
			var bt := Time.get_ticks_msec() / 1000.0
			var bp_s := 1.0 + sin(bt * (4.0 + float(boss_phase) * 1.6)) * 0.10
			var phase_col := Color(1.0, 0.36, 0.16, 0.95) if boss_phase <= 1 else (Color(0.92, 0.24, 1.0, 0.96) if boss_phase == 2 else Color(1.0, 0.14, 0.12, 0.98))
			draw_circle(Vector2.ZERO, 48.0 * shadow_scale * bp_s, Color(phase_col.r, phase_col.g, phase_col.b, 0.22))
			draw_arc(Vector2.ZERO, 46.0 * shadow_scale * bp_s, 0.0, TAU, 40, Color(1.0, 0.84, 0.28, 0.96), 4.4)
			draw_arc(Vector2.ZERO, 36.0 * shadow_scale, 0.0, TAU, 32, phase_col, 3.2)
			for seg in 6:
				var ba := bt * (1.2 + float(boss_phase) * 0.5) + float(seg) * (TAU / 6.0)
				draw_arc(Vector2.ZERO, 54.0 * shadow_scale, ba, ba + 0.45, 8, Color(1.0, 0.90, 0.46, 0.88), 2.8)
		elif is_elite:
			var et := Time.get_ticks_msec() / 1000.0
			var ep := 1.0 + sin(et * 4.5) * 0.08
			draw_circle(Vector2.ZERO, 36.0 * shadow_scale * ep, Color(1.0, 0.34, 0.12, 0.22))
			draw_arc(Vector2.ZERO, 34.0 * shadow_scale * ep, 0.0, TAU, 32, Color(1.0, 0.80, 0.24, 0.92), 3.4)
			draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 24, Color(1.0, 0.22, 0.14, 0.85), 2.4)
		else:
			draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 24, Color(1.0, 0.25, 0.15, 0.62), 2.4)
	elif actor_kind == "animal" and hp_ratio < 0.999:
		draw_arc(Vector2.ZERO, 22.0 * shadow_scale, 0.0, TAU, 22, Color(1.0, 0.62, 0.20, 0.72), 2.2)
	elif actor_kind == "npc":
		draw_arc(Vector2.ZERO, 24.0 * shadow_scale, 0.0, TAU, 24, Color(0.28, 0.88, 1.0, 0.58), 2.0)
	elif is_hero:
		if is_gm_avatar:
			var gmt := Time.get_ticks_msec() / 1000.0
			var gmp := 1.0 + sin(gmt * 4.2) * 0.07
			draw_arc(Vector2.ZERO, 34.0 * shadow_scale * gmp, 0.0, TAU, 36, Color(1.0, 0.86, 0.34, 0.92), 3.2)
			draw_arc(Vector2.ZERO, 25.0 * shadow_scale, 0.0, TAU, 28, Color(0.42, 0.94, 1.0, 0.86), 2.4)
		else:
			if weapon_glow_tier > 0:
				var wt := Time.get_ticks_msec() / 1000.0
				var wcol := Color(0.32, 0.86, 1.0, 0.88) if weapon_glow_tier == 1 else (Color(0.84, 0.42, 1.0, 0.92) if weapon_glow_tier == 2 else Color(1.0, 0.84, 0.28, 0.96))
				var wr := (31.0 + float(weapon_glow_tier) * 3.0 + sin(wt * 5.0) * 2.2) * shadow_scale
				draw_circle(Vector2.ZERO, wr, Color(wcol.r, wcol.g, wcol.b, 0.14 + float(weapon_glow_tier) * 0.04))
				draw_arc(Vector2.ZERO, wr, 0.0, TAU, 32, wcol, 2.4 + float(weapon_glow_tier) * 0.6)
			draw_arc(Vector2.ZERO, 26.0 * shadow_scale, 0.0, TAU, 28, Color(1.0, 0.82, 0.32, 0.80), 2.5)
	if is_locked_target:
		var lt := Time.get_ticks_msec() / 1000.0
		var lp := 1.0 + sin(lt * 7.0) * 0.08
		draw_arc(Vector2.ZERO, 42.0 * shadow_scale * lp, 0.0, TAU, 36, Color(1.0, 0.88, 0.24, 0.96), 4.0)
		draw_arc(Vector2.ZERO, 36.0 * shadow_scale, 0.0, TAU, 32, Color(1.0, 0.32, 0.16, 0.90), 2.4)
	draw_set_transform(Vector2.ZERO)
	if is_boss and boss_shield_active:
		var st_b := Time.get_ticks_msec() / 1000.0
		var srad := maxf(display.x * 0.52, 58.0)
		draw_arc(Vector2(0.0, -display.y * 0.46), srad, 0.0, TAU, 36, Color(0.38, 0.92, 1.0, 0.82 + 0.16 * sin(st_b * 6.0)), 3.6)
		draw_circle(Vector2(0.0, -display.y * 0.46), srad, Color(0.28, 0.78, 1.0, 0.14))

	# Monster & Damaged Wildlife Animal HP bar (gilded wider bar for named Elites)
	if actor_kind == "monster" or (actor_kind == "animal" and hp_ratio < 0.999):
		var bw := 104.0 if is_elite else (72.0 if actor_kind == "monster" else 58.0)
		var bh := 10.0 if is_elite else 8.0
		var bp := Vector2(-bw * 0.5, -display.y - (14.0 if is_elite else 10.0))
		if is_elite:
			draw_rect(Rect2(bp - Vector2(2, 2), Vector2(bw + 4, bh + 4)), Color(1.0, 0.78, 0.24, 0.96), false, 2.0)
		draw_rect(Rect2(bp - Vector2(1, 1), Vector2(bw + 2, bh + 2)), Color(0.04, 0.02, 0.02, 0.94))
		draw_rect(Rect2(bp, Vector2(bw * clampf(hp_ratio, 0.0, 1.0), bh)), Color(0.96, 0.28, 0.14, 0.98) if is_elite else (Color(0.94, 0.22, 0.16, 0.98) if actor_kind == "monster" else Color(1.0, 0.64, 0.20, 0.98)))
		if not status_flags.is_empty():
			var st_cols := {
				"burn": Color(1.0, 0.44, 0.12),
				"stun": Color(1.0, 0.92, 0.28),
				"slow": Color(0.44, 0.78, 1.0),
				"marked": Color(0.18, 0.96, 0.98),
				"seal": Color(0.76, 0.48, 1.0),
			}
			var sx := bp.x + 6.0
			var sy := bp.y - 9.0
			for sk in ["burn", "stun", "slow", "marked", "seal"]:
				if bool(status_flags.get(sk, false)):
					draw_circle(Vector2(sx, sy), 5.5, Color(0.04, 0.02, 0.04, 0.92))
					draw_circle(Vector2(sx, sy), 4.0, st_cols[sk] as Color)
					sx += 13.0

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
	var top_y := -display.y - get_gm_lift_px() - (136.0 if not quest_mark.is_empty() else 108.0)
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
	if is_gm_avatar:
		var want_h := GM_FLY_ALTITUDE if gm_flying else 0.0
		var h_rate := 135.0 if gm_flying else 165.0
		gm_fly_height = move_toward(gm_fly_height, want_h, delta * h_rate)
		_apply_gm_lift_visuals()
		_queue_ki_redraw()
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
