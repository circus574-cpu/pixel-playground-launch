class_name RaceScreen
extends Control
## Forged Obsidian & Gold Race Selection Screen for KI Legends.
## Features LIVE animated hero sprites from actors.json (NO static concept-doc JPGs!),
## real Ki-Mode transformation animation (idle -> transform -> kiidle / kiattack) with
## multi-layered racial Ki Aura VFX, pixel-aligned cards, and consistent "← WSTECZ" header.

const Look := preload("res://scripts/look.gd")
const FORGED_BASE := "res://service_preview/pyra/assets/ui/forged/"

signal chosen(race: String)
signal closed

const RACES := ["planetary", "sage", "android", "legend"]
const RACE_HERO_KEY := {
	"planetary": "verdant.hero",
	"sage": "aether.hero",
	"android": "nexus.hero",
	"legend": "pyra.hero",
}
const RACE_AURA := {
	"planetary": {"core": Color(0.32, 0.96, 0.56), "rim": Color(1.0, 0.90, 0.42), "bg": Color(0.05, 0.14, 0.09), "role_short": "Wojownik wręcz"},
	"sage":      {"core": Color(0.38, 0.86, 1.0),  "rim": Color(1.0, 0.92, 0.52), "bg": Color(0.06, 0.10, 0.18), "role_short": "Mag i wsparcie"},
	"android":   {"core": Color(0.24, 0.82, 1.0),  "rim": Color(0.74, 0.58, 1.0), "bg": Color(0.06, 0.08, 0.16), "role_short": "Strzelec z tarczami"},
	"legend":    {"core": Color(1.0, 0.42, 0.14),  "rim": Color(1.0, 0.88, 0.34), "bg": Color(0.16, 0.06, 0.04), "role_short": "Wojownik burst"},
}

var selected := ""
var cards: Dictionary = {}
var stages: Dictionary = {}
var confirm: Button
var details := Label.new()
var allow_close := false
var tex_cache: Dictionary = {}
var actors_data: Dictionary = {}
var root_box: VBoxContainer
var _ui_sfx: AudioStreamPlayer

## Embedded animated showcase stage for each race card:
## renders atmospheric elemental chamber, runic pedestal, real animated hero3d clips
## (idle -> transform -> kiidle / kiattack), and smooth feathered radiant anime Ki Aura VFX.
class RaceStageView extends Control:
	static var _glow_tex: Texture2D = null
	static var _wisp_tex: Texture2D = null

	var race_id: String = "legend"
	var hero_def: Dictionary = {}
	var core_col: Color = Color(1.0, 0.55, 0.2)
	var rim_col: Color = Color(1.0, 0.86, 0.35)
	var bg_col: Color = Color(0.10, 0.05, 0.05)

	var clips: Dictionary = {}
	var current_clip: String = "idle"
	var clip_t: float = 0.0
	var ki_active: bool = false
	var transform_flash: float = 0.0
	var _burst_fired: bool = false
	var aura_t: float = 0.0
	var showcase_cycle_t: float = 0.0
	var tex_loader: Callable

	static func _ensure_vfx_textures() -> void:
		if _glow_tex == null:
			var sz := 96
			var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
			var half := float(sz) * 0.5
			for y in sz:
				for x in sz:
					var dx := (float(x) + 0.5 - half) / half
					var dy := (float(y) + 0.5 - half) / half
					var d := sqrt(dx * dx + dy * dy)
					var a := clampf(pow(maxf(0.0, 1.0 - d), 2.4), 0.0, 1.0)
					img.set_pixel(x, y, Color(1.0, 1.0, 1.0, a))
			_glow_tex = ImageTexture.create_from_image(img)
		if _wisp_tex == null:
			var w := 48
			var h := 112
			var img2 := Image.create(w, h, false, Image.FORMAT_RGBA8)
			for y in h:
				var ny := float(y) / float(h - 1) # 0 top tip -> 1 bottom base
				var profile := sin(pow(ny, 0.72) * PI)
				for x in w:
					var nx := (float(x) + 0.5 - float(w) * 0.5) / (float(w) * 0.5)
					var sw := maxf(profile * 0.92, 0.01)
					var dx := absf(nx) / sw
					var a := clampf(pow(maxf(0.0, 1.0 - dx), 2.1) * profile * (1.0 - ny * 0.35), 0.0, 1.0)
					var core_hot := clampf(1.0 - dx * 1.4, 0.0, 1.0)
					img2.set_pixel(x, y, Color(1.0, 0.92 + 0.08 * core_hot, 0.75 + 0.25 * core_hot, a))
			_wisp_tex = ImageTexture.create_from_image(img2)

	func configure(race: String, def: Dictionary, palette: Dictionary, loader: Callable) -> void:
		_ensure_vfx_textures()
		race_id = race
		hero_def = def
		core_col = palette.get("core", Color(1.0, 0.6, 0.2)) as Color
		rim_col = palette.get("rim", Color(1.0, 0.88, 0.4)) as Color
		bg_col = palette.get("bg", Color(0.08, 0.05, 0.06)) as Color
		tex_loader = loader
		clip_contents = true
		mouse_filter = Control.MOUSE_FILTER_IGNORE
		size_flags_horizontal = Control.SIZE_EXPAND_FILL
		size_flags_vertical = Control.SIZE_EXPAND_FILL
		custom_minimum_size = Vector2(0, 220)
		# Curated ZERO-SPIN front-facing sequences across all 4 races:
		# Raw hero3d idle/kiidle frames 5..13 turn sideways/backwards; frames 0..3 are steady front-facing breathing.
		_build_curated_clip("idle", [{"src": "idle", "indices": [0, 1, 2, 3, 2, 1]}], 5.5)
		_build_curated_clip("kiidle", [{"src": "kiidle", "indices": [0, 1, 2, 3, 2, 1]}], 6.0)
		# Real Ki transformation: gather energy front-facing -> raise fists -> blinding burst into Awakened Ki Form!
		_build_curated_clip("transform", [
			{"src": "channel", "indices": [5, 6, 7, 8, 9]},
			{"src": "transform", "indices": [13, 14, 15, 16]},
			{"src": "kitransform", "indices": [15, 16, 17]},
		], 11.5)
		# Periodic heroic Ki surge while selected (100% front-facing, zero spin)
		_build_curated_clip("kipulse", [
			{"src": "kichannel", "indices": [5, 6, 7, 8, 9, 11, 12, 13, 11, 8, 6]},
		], 11.0)
		current_clip = "idle"
		clip_t = randf() * 0.9

	func _load_raw_frames(cname: String) -> Dictionary:
		var cdict: Dictionary = hero_def.get("clips", {})
		if not cdict.has(cname):
			return {}
		var c: Dictionary = cdict[cname]
		var dirs: Dictionary = c.get("directions", {})
		var chosen_dir := "down"
		if not dirs.has(chosen_dir):
			if dirs.has("down-right"):
				chosen_dir = "down-right"
			elif not dirs.is_empty():
				chosen_dir = str(dirs.keys()[0])
			else:
				return {}
		var sheet_path := str(c.get("sheet", ""))
		var tex: Texture2D = null
		if tex_loader.is_valid() and not sheet_path.is_empty():
			tex = tex_loader.call(sheet_path)
		if tex == null:
			return {}
		var arr: Array = dirs[chosen_dir]
		var mirrored: bool = chosen_dir in c.get("mirrored", [])
		var parsed: Array = []
		for item in arr:
			if item is Array and (item as Array).size() >= 8:
				var a: Array = item
				parsed.append({
					"region": Rect2(float(a[0]), float(a[1]), float(a[2]), float(a[3])),
					"margin": Rect2(float(a[4]), float(a[5]), float(a[6]), float(a[7])),
					"tex": tex,
					"mirrored": mirrored,
				})
			elif item is Dictionary:
				var d: Dictionary = item
				var r: Array = d.get("rect", [0, 0, 200, 200])
				parsed.append({
					"region": Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3])),
					"margin": Rect2(0, 0, 0, 0),
					"tex": tex,
					"mirrored": mirrored,
				})
		if parsed.is_empty():
			return {}
		return {"frames": parsed, "fps": maxf(float(c.get("fps", 10.0)), 4.0)}

	func _build_curated_clip(out_name: String, segments: Array, fps: float) -> void:
		var combined: Array = []
		for seg: Dictionary in segments:
			var src_name := str(seg.get("src", ""))
			var raw := _load_raw_frames(src_name)
			if raw.is_empty():
				continue
			var src_frames: Array = raw["frames"]
			var indices: Array = seg.get("indices", [])
			if indices.is_empty():
				for f in src_frames:
					combined.append(f)
			else:
				for idx_v in indices:
					var idx := int(idx_v)
					if idx >= 0 and idx < src_frames.size():
						combined.append(src_frames[idx])
		if combined.is_empty() and out_name != "idle":
			var fallback := _load_raw_frames(out_name)
			if not fallback.is_empty():
				combined = fallback["frames"]
		if not combined.is_empty():
			clips[out_name] = {"fps": fps, "frames": combined}

	func set_selected_ki(active: bool, replay_transform: bool = true) -> void:
		ki_active = active
		if active:
			showcase_cycle_t = 0.0
			_burst_fired = false
			if replay_transform and clips.has("transform"):
				current_clip = "transform"
				clip_t = 0.0
				transform_flash = 0.55
			elif clips.has("kiidle"):
				current_clip = "kiidle"
				clip_t = 0.0
				transform_flash = 0.45
		else:
			current_clip = "idle"
			clip_t = 0.0
			transform_flash = 0.0
			_burst_fired = false
		queue_redraw()

	func _process(delta: float) -> void:
		aura_t += delta
		clip_t += delta
		if transform_flash > 0.0:
			transform_flash = maxf(0.0, transform_flash - delta * 1.15)
		if ki_active:
			showcase_cycle_t += delta
			var cinfo: Dictionary = clips.get(current_clip, {})
			var dur := 1.05
			var f_idx := 0
			if not cinfo.is_empty():
				var fps := float(cinfo["fps"])
				dur = float((cinfo["frames"] as Array).size()) / fps
				f_idx = int(floor(clip_t * fps))
			# Peak Ki flash & shockwave right as normal form bursts into Awakened Ki Form (frame 9+)
			if current_clip == "transform" and not _burst_fired and f_idx >= 9:
				_burst_fired = true
				transform_flash = 1.0
			if current_clip == "transform" and clip_t >= dur:
				current_clip = "kiidle" if clips.has("kiidle") else "idle"
				clip_t = 0.0
			elif current_clip == "kipulse" and clip_t >= dur:
				current_clip = "kiidle" if clips.has("kiidle") else "idle"
				clip_t = 0.0
			elif current_clip == "kiidle" and showcase_cycle_t >= 4.5 and clips.has("kipulse"):
				showcase_cycle_t = 0.0
				current_clip = "kipulse"
				clip_t = 0.0
				transform_flash = 0.40
		queue_redraw()

	func _hash01(idx: int, salt: int) -> float:
		var v := sin(float(idx * 127 + salt * 311) * 1.137) * 43758.5453
		return v - floorf(v)

	func _draw_glow(pos: Vector2, rad_x: float, rad_y: float, col: Color) -> void:
		if _glow_tex != null:
			draw_texture_rect(_glow_tex, Rect2(pos - Vector2(rad_x, rad_y), Vector2(rad_x * 2.0, rad_y * 2.0)), false, col)

	func _draw_ki_lightning(p0: Vector2, p1: Vector2, col: Color, seed_i: int) -> void:
		var pts := PackedVector2Array([p0])
		var segs := 5
		var perp := (p1 - p0).orthogonal().normalized()
		for k in range(1, segs):
			var frac := float(k) / float(segs)
			var jitter := (_hash01(seed_i * 7 + k, int(aura_t * 14.0)) - 0.5) * 16.0
			pts.append(p0.lerp(p1, frac) + perp * jitter)
		pts.append(p1)
		draw_polyline(pts, Color(col.r, col.g, col.b, col.a * 0.45), 4.2, true)
		draw_polyline(pts, Color(1.0, 0.98, 0.90, col.a * 0.92), 1.5, true)

	func _draw() -> void:
		var sz := size
		if sz.x < 10.0 or sz.y < 10.0:
			return
		var cx := sz.x * 0.5
		var foot_y := sz.y * 0.835
		var body_h := minf(sz.y * 0.68, 210.0)
		var pulse := 1.0 + sin(aura_t * 4.6) * 0.06

		# 1. Atmospheric elemental chamber backdrop (soft feathered gradients, never pitch flat black)
		draw_rect(Rect2(Vector2.ZERO, sz), Color(0.032, 0.028, 0.048, 0.98), true)
		_draw_glow(Vector2(cx, foot_y - body_h * 0.35), sz.x * 0.78, sz.y * 0.58, Color(bg_col.r * 2.4, bg_col.g * 2.4, bg_col.b * 2.4, 0.85 if ki_active else 0.55))
		_draw_glow(Vector2(cx, foot_y), sz.x * 0.62, sz.y * 0.28, Color(core_col.r, core_col.g, core_col.b, 0.34 if ki_active else 0.14))
		# Ambient drifting elemental motes in all 4 chambers
		for m in 8:
			var mph := fposmod(aura_t * (0.28 + 0.18 * _hash01(m, 21)) + _hash01(m, 22), 1.0)
			var mx := sz.x * (0.12 + 0.76 * _hash01(m, 23)) + sin(mph * 5.0 + float(m)) * 6.0
			var my := sz.y * (0.90 - mph * 0.80)
			_draw_glow(Vector2(mx, my), 6.0, 6.0, Color(rim_col.r, rim_col.g, rim_col.b, (0.36 if ki_active else 0.18) * sin(mph * PI)))

		var rim_frame := core_col.lerp(rim_col, 0.45) if ki_active else Color(0.54, 0.44, 0.28)
		rim_frame.a = 0.78 if ki_active else 0.34
		draw_rect(Rect2(Vector2(1.0, 1.0), sz - Vector2(2.0, 2.0)), rim_frame, false, 1.6)

		# 2. Perspective ground pedestal & glowing runic Ki circle
		var ped_r := minf(sz.x * 0.37, 82.0)
		draw_set_transform(Vector2(cx, foot_y), 0.0, Vector2(1.0, 0.36))
		draw_circle(Vector2.ZERO, ped_r * 1.02, Color(0.015, 0.012, 0.025, 0.80))
		if ki_active:
			_draw_glow(Vector2.ZERO, ped_r * 1.45 * pulse, ped_r * 1.45 * pulse, Color(core_col.r, core_col.g, core_col.b, 0.52))
			draw_arc(Vector2.ZERO, ped_r * 1.06 * pulse, 0.0, TAU, 44, Color(core_col.r, core_col.g, core_col.b, 0.92), 3.6, true)
			draw_arc(Vector2.ZERO, ped_r * 0.78, 0.0, TAU, 36, Color(rim_col.r, rim_col.g, rim_col.b, 0.88), 2.2, true)
			for seg in 6:
				var a0 := aura_t * 1.2 + float(seg) * (TAU / 6.0)
				draw_arc(Vector2.ZERO, ped_r * 0.92, a0, a0 + 0.42, 8, Color(1.0, 0.98, 0.86, 0.88), 2.2, true)
		else:
			draw_arc(Vector2.ZERO, ped_r * 0.88, 0.0, TAU, 36, Color(core_col.r, core_col.g, core_col.b, 0.38), 2.0, true)
			draw_arc(Vector2.ZERO, ped_r * 0.62, 0.0, TAU, 28, Color(rim_col.r, rim_col.g, rim_col.b, 0.24), 1.4, true)
		draw_set_transform(Vector2.ZERO)

		# 3. Back-layer REAL Smooth Feathered Anime KI AURA (vertical plasma column + feathered flame tongues!)
		if ki_active:
			var center_y := foot_y - body_h * 0.44
			_draw_glow(Vector2(cx, center_y), ped_r * 1.15 * pulse, body_h * 0.68 * pulse, Color(core_col.r, core_col.g, core_col.b, 0.56))
			_draw_glow(Vector2(cx, center_y + 10.0), ped_r * 0.72 * pulse, body_h * 0.54 * pulse, Color(rim_col.r, rim_col.g, rim_col.b, 0.62))
			_draw_glow(Vector2(cx, center_y + 16.0), ped_r * 0.42, body_h * 0.36, Color(1.0, 0.98, 0.90, 0.44))
			if _wisp_tex != null:
				for i in 10:
					var ph := fposmod(aura_t * (0.95 + 0.55 * _hash01(i, 1)) + _hash01(i, 2), 1.0)
					var side_f := (_hash01(i, 3) - 0.5) * 2.0
					var wx := cx + side_f * ped_r * (0.18 + 0.56 * (1.0 - ph * 0.35)) + sin(ph * 7.0 + float(i)) * 7.0
					var wy := foot_y - 16.0 - ph * (body_h * 0.82)
					var ww := (1.0 - ph * 0.45) * (28.0 + 18.0 * _hash01(i, 4))
					var wh := (1.0 - ph * 0.30) * (76.0 + 44.0 * _hash01(i, 5))
					var wcol := core_col.lerp(rim_col, ph * 0.65)
					wcol.a = sin(ph * PI) * 0.72
					draw_texture_rect(_wisp_tex, Rect2(wx - ww * 0.5, wy - wh * 0.75, ww, wh), false, wcol)

		# 4. Real Animated Hero3D Sprite Frame (ZERO-SPIN front-facing heroic stance!)
		var cinfo: Dictionary = clips.get(current_clip, clips.get("idle", {}))
		if not cinfo.is_empty():
			var frames_arr: Array = cinfo["frames"]
			var fps: float = float(cinfo["fps"])
			var f_idx := int(floor(clip_t * fps)) % maxi(1, frames_arr.size())
			if current_clip == "transform":
				f_idx = mini(int(floor(clip_t * fps)), frames_arr.size() - 1)
			var fdata: Dictionary = frames_arr[f_idx]
			var reg: Rect2 = fdata["region"]
			var marg: Rect2 = fdata["margin"]
			var tex: Texture2D = fdata["tex"] as Texture2D
			var cell := float(hero_def.get("cell", 200.0))
			var target_cell_px := clampf(minf(sz.x * 0.96, sz.y * 0.88), 150.0, 248.0)
			var sc := target_cell_px / maxf(cell, 1.0)
			var cell_tl := Vector2(cx - target_cell_px * 0.5, foot_y - target_cell_px * 0.90)
			var draw_pos := cell_tl + marg.position * sc
			var draw_sz := reg.size * sc
			var tint := Color(1.10, 1.07, 1.03, 1.0) if ki_active else Color(0.92, 0.91, 0.95, 1.0)
			if transform_flash > 0.25:
				var boost := (transform_flash - 0.25) * 0.75
				tint = Color(1.0 + boost, 1.0 + boost * 0.88, 1.0 + boost * 0.70, 1.0)
			if bool(fdata.get("mirrored", false)):
				draw_texture_rect_region(tex, Rect2(Vector2(draw_pos.x + draw_sz.x, draw_pos.y), Vector2(-draw_sz.x, draw_sz.y)), reg, tint)
			else:
				draw_texture_rect_region(tex, Rect2(draw_pos, draw_sz), reg, tint)

		# 5. Front-layer Electric Ki Arcs, Feathered Ascending Sparks & Shockwave Ring
		if ki_active:
			for arc_i in 4:
				var side_a := -1.0 if arc_i % 2 == 0 else 1.0
				var base_y := foot_y - 18.0 - _hash01(arc_i, 31) * body_h * 0.45
				var p0 := Vector2(cx + side_a * ped_r * 0.48, base_y)
				var p1 := Vector2(cx + side_a * ped_r * 0.24, base_y - 46.0 - _hash01(arc_i, 32) * 44.0)
				var acol := rim_col.lerp(core_col, 0.35)
				acol.a = 0.82
				_draw_ki_lightning(p0, p1, acol, arc_i + 1)
			for j in 12:
				var sp_ph := fposmod(aura_t * (1.2 + 0.65 * _hash01(j, 7)) + _hash01(j, 8), 1.0)
				var sx := cx + (_hash01(j, 9) - 0.5) * ped_r * 1.45 + sin(sp_ph * 7.0 + float(j)) * 8.0
				var sy := foot_y - 10.0 - sp_ph * (body_h * 0.95)
				var sr := (1.0 - sp_ph) * 8.0 + 3.0
				_draw_glow(Vector2(sx, sy), sr, sr, Color(rim_col.r, rim_col.g, rim_col.b, (1.0 - sp_ph) * 0.90))
				draw_circle(Vector2(sx, sy), maxf(1.2, (1.0 - sp_ph) * 2.2), Color(1.0, 0.99, 0.92, (1.0 - sp_ph) * 0.95))
			if transform_flash > 0.02:
				var e := 1.0 - transform_flash
				var shock_r := ped_r * (0.58 + e * 1.35)
				draw_set_transform(Vector2(cx, foot_y - 10.0), 0.0, Vector2(1.0, 0.40))
				draw_arc(Vector2.ZERO, shock_r, 0.0, TAU, 40, Color(rim_col.r, rim_col.g, rim_col.b, transform_flash * 0.92), 6.0 * transform_flash + 1.5, true)
				draw_set_transform(Vector2.ZERO)
				_draw_glow(Vector2(cx, foot_y - body_h * 0.42), ped_r * (0.9 + e * 0.7), body_h * 0.55, Color(1.0, 0.96, 0.82, transform_flash * 0.48))

			var f := ThemeDB.fallback_font
			var badge_txt := "✦ TRANSFORMACJA KI ✦" if current_clip == "transform" else "✦ FORMA KI ✦"
			var bw := f.get_string_size(badge_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x + 20.0
			var br := Rect2(cx - bw * 0.5, 10.0, bw, 24.0)
			draw_rect(br, Color(0.05, 0.04, 0.07, 0.88), true)
			draw_rect(br, Color(rim_col.r, rim_col.g, rim_col.b, 0.92), false, 1.5)
			var tw := f.get_string_size(badge_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
			draw_string(f, Vector2(cx - tw * 0.5, br.position.y + 16.5), badge_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.95, 0.76))

func _load_tex(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if tex_cache.has(path):
		return tex_cache[path] as Texture2D
	if ResourceLoader.exists(path):
		var res := load(path)
		if res is Texture2D:
			tex_cache[path] = res
			return res
	var candidates: Array[String] = [path]
	if path.begins_with("res://assets/actors/"):
		candidates.append("res://service_preview/pyra/" + path.substr(6))
	for cand in candidates:
		if FileAccess.file_exists(cand):
			var bytes := FileAccess.get_file_as_bytes(cand)
			if not bytes.is_empty():
				var img := Image.new()
				var err := img.load_webp_from_buffer(bytes) if cand.ends_with(".webp") else (img.load_png_from_buffer(bytes) if cand.ends_with(".png") else img.load_jpg_from_buffer(bytes))
				if err == OK:
					var tex := ImageTexture.create_from_image(img)
					tex_cache[path] = tex
					return tex
	return null

func _play_sfx(rel_path: String) -> void:
	var candidates := [
		"res://assets/audio/sfx/" + rel_path,
		"res://service_preview/pyra/assets/audio/sfx/" + rel_path,
	]
	for p in candidates:
		if FileAccess.file_exists(p):
			var raw := FileAccess.get_file_as_bytes(p)
			if not raw.is_empty():
				var stream := AudioStreamMP3.new()
				stream.data = raw
				if _ui_sfx == null:
					_ui_sfx = AudioStreamPlayer.new()
					add_child(_ui_sfx)
				_ui_sfx.stream = stream
				_ui_sfx.volume_db = -6.0
				_ui_sfx.play()
				return

func _forged_panel(pad_x: float = 34.0, pad_y: float = 36.0, tint: Color = Color.WHITE) -> StyleBox:
	var tex := _load_tex(FORGED_BASE + "panel_forged.webp")
	var cx := maxf(pad_x, 34.0)
	var cy := maxf(pad_y, 36.0)
	if tex == null:
		return Look.window(cx, tint)
	var sb := StyleBoxTexture.new()
	sb.texture = tex
	sb.texture_margin_left = 38.0
	sb.texture_margin_right = 38.0
	sb.texture_margin_top = 38.0
	sb.texture_margin_bottom = 38.0
	sb.axis_stretch_horizontal = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.axis_stretch_vertical = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.content_margin_left = cx
	sb.content_margin_right = cx
	sb.content_margin_top = cy
	sb.content_margin_bottom = cy
	sb.modulate_color = tint
	return sb

func _style_btn(btn: Button, variant: String = "slate", font_sz: int = 20, use_title_font: bool = true) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	var fname := "btn_forged_gold.webp" if variant == "gold" else "btn_forged_slate.webp"
	var tex := _load_tex(FORGED_BASE + fname)
	for st_name in ["normal", "hover", "pressed", "disabled"]:
		if tex != null:
			var sb := StyleBoxTexture.new()
			sb.texture = tex
			sb.texture_margin_left = 44.0
			sb.texture_margin_right = 44.0
			sb.texture_margin_top = 16.0
			sb.texture_margin_bottom = 16.0
			sb.content_margin_left = 26.0
			sb.content_margin_right = 26.0
			sb.content_margin_top = 6.0 if use_title_font else 8.0
			sb.content_margin_bottom = 12.0 if use_title_font else 8.0
			if st_name == "hover":
				sb.modulate_color = Color(1.15, 1.13, 1.08, 1.0)
			elif st_name == "pressed":
				sb.modulate_color = Color(0.84, 0.80, 0.76, 1.0)
			elif st_name == "disabled":
				sb.modulate_color = Color(0.45, 0.44, 0.46, 0.72)
			btn.add_theme_stylebox_override(st_name, sb)
		else:
			btn.add_theme_stylebox_override(st_name, PyraSkin.button_box(st_name, 20.0, 8.0))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	if use_title_font:
		btn.add_theme_font_override("font", Look.title_font())
	btn.add_theme_font_size_override("font_size", font_sz)
	btn.add_theme_color_override("font_color", Color.WHITE if use_title_font else Color("f4ece0"))
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_disabled_color", Color(0.65, 0.62, 0.58, 0.85))
	btn.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.96))
	btn.add_theme_constant_override("outline_size", 4)

func _apply_safe_margins() -> void:
	if root_box == null:
		return
	var pad_l := 20.0
	var pad_r := 20.0
	var pad_t := 12.0
	var pad_b := 14.0
	if OS.get_name() == "Android" and is_inside_tree():
		var vp := get_viewport_rect().size
		var screen := DisplayServer.get_display_safe_area()
		if screen.has_area() and vp.x > 100.0 and vp.y > 100.0:
			var inv := get_tree().root.get_screen_transform().affine_inverse()
			var safe: Rect2 = (inv * Rect2(screen)).intersection(Rect2(Vector2.ZERO, vp))
			pad_l = maxf(pad_l, safe.position.x + 12.0)
			pad_r = maxf(pad_r, (vp.x - safe.end.x) + 12.0)
			pad_t = maxf(pad_t, safe.position.y + 8.0)
			pad_b = maxf(pad_b, (vp.y - safe.end.y) + 12.0)
	root_box.offset_left = pad_l
	root_box.offset_right = -pad_r
	root_box.offset_top = pad_t
	root_box.offset_bottom = -pad_b

func _ready() -> void:
	_apply_safe_margins()
	if not resized.is_connected(_apply_safe_margins):
		resized.connect(_apply_safe_margins)

func setup(can_close: bool = false) -> void:
	allow_close = can_close
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	z_index = 102

	var parsed_actors: Variant = PyraContinent.load_json("res://data/actors.json")
	if parsed_actors is Dictionary:
		actors_data = parsed_actors as Dictionary

	var shade := ColorRect.new()
	shade.color = Color(0.022, 0.018, 0.032, 0.98)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)

	var background := TextureRect.new()
	background.texture = _load_tex("res://assets/branding/intro-wide.webp")
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.modulate = Color(0.20, 0.18, 0.24, 0.42)
	add_child(background)

	root_box = VBoxContainer.new()
	root_box.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root_box.offset_left = 20
	root_box.offset_right = -20
	root_box.offset_top = 12
	root_box.offset_bottom = -14
	root_box.add_theme_constant_override("separation", 8)
	add_child(root_box)

	# Unified Top Bar with "← WSTECZ"
	var top := HBoxContainer.new()
	top.custom_minimum_size.y = 54.0
	top.add_theme_constant_override("separation", 14)
	root_box.add_child(top)
	if allow_close:
		var back_btn := Button.new()
		back_btn.name = "BackButton"
		back_btn.text = "← WSTECZ"
		back_btn.custom_minimum_size = Vector2(182, 54)
		_style_btn(back_btn, "slate", 16, false)
		back_btn.pressed.connect(func() -> void: closed.emit())
		top.add_child(back_btn)

	var title := Label.new()
	title.text = "WYBIERZ SWOJĄ RASĘ"
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	Look.style_heading(title, 30)
	top.add_child(title)
	if allow_close:
		var spacer := Control.new()
		spacer.custom_minimum_size = Vector2(182, 0)
		spacer.mouse_filter = Control.MOUSE_FILTER_IGNORE
		top.add_child(spacer)

	var row := HBoxContainer.new()
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	row.add_theme_constant_override("separation", 12)
	root_box.add_child(row)
	for race in RACES:
		var data: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % race)
		var card := make_card(race, data)
		cards[race] = card
		row.add_child(card)

	details.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	details.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	details.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	details.custom_minimum_size = Vector2(0, 38)
	details.add_theme_font_size_override("font_size", 15)
	details.add_theme_color_override("font_color", Color("f2e4cc"))
	details.text = "Dotknij rasy, aby uruchomić transformację w Formę KI i przejść do wpisania nicku."
	root_box.add_child(details)

	var bar := HBoxContainer.new()
	bar.alignment = BoxContainer.ALIGNMENT_CENTER
	bar.add_theme_constant_override("separation", 14)
	confirm = Button.new()
	confirm.name = "ConfirmRaceButton"
	confirm.text = "WYBIERZ RASĘ POWYŻEJ"
	confirm.custom_minimum_size = Vector2(440, 58)
	confirm.disabled = true
	_style_btn(confirm, "gold", 21, true)
	confirm.pressed.connect(func() -> void:
		if selected != "":
			chosen.emit(selected)
	)
	bar.add_child(confirm)
	root_box.add_child(bar)

func make_card(race: String, data: Dictionary) -> Control:
	var lore: Dictionary = data.get("lore", {})
	var palette: Dictionary = RACE_AURA.get(race, RACE_AURA["legend"])
	var panel := PanelContainer.new()
	panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
	panel.mouse_filter = Control.MOUSE_FILTER_STOP
	panel.add_theme_stylebox_override("panel", card_style(false, Color(str(lore.get("color", "#e8c070")))))

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	panel.add_child(box)

	# LIVE Animated Hero3D + Ki Aura Stage (NO static concept-doc JPG, ZERO-SPIN!)
	var stage := RaceStageView.new()
	var hero_key := str(RACE_HERO_KEY.get(race, "pyra.hero"))
	var hdef: Dictionary = actors_data.get(hero_key, {}) if actors_data.get(hero_key) is Dictionary else {}
	stage.configure(race, hdef, palette, _load_tex)
	box.add_child(stage)
	stages[race] = stage

	# Locked-height bottom info block -> ALL 4 cards align pixel-for-pixel across the row!
	var info_box := VBoxContainer.new()
	info_box.custom_minimum_size = Vector2(0, 82)
	info_box.alignment = BoxContainer.ALIGNMENT_CENTER
	info_box.add_theme_constant_override("separation", 3)
	info_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	box.add_child(info_box)

	var name_lbl := Label.new()
	name_lbl.text = str(data.get("raceName", race)).to_upper()
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_override("font", Look.title_font())
	name_lbl.add_theme_font_size_override("font_size", 22)
	name_lbl.add_theme_color_override("font_color", Color.WHITE)
	name_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info_box.add_child(name_lbl)

	var world_role := Label.new()
	world_role.text = "%s · %s" % [str(lore.get("world", "")), str(palette.get("role_short", data.get("role", "")))]
	world_role.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	world_role.clip_text = true
	world_role.add_theme_font_size_override("font_size", 13)
	world_role.add_theme_color_override("font_color", Color("efe2cc"))
	world_role.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info_box.add_child(world_role)

	var mech_lbl := Label.new()
	mech_lbl.text = "Mechanika: %s" % str(data.get("mechanic", ""))
	mech_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mech_lbl.clip_text = true
	mech_lbl.add_theme_font_size_override("font_size", 12)
	mech_lbl.add_theme_color_override("font_color", (palette.get("rim", Color("ffd98a")) as Color))
	mech_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	info_box.add_child(mech_lbl)

	# Full-card transparent native Button guarantees 100% first-tap touch reliability on Android!
	var hit_btn := Button.new()
	hit_btn.name = "Tap_" + race
	hit_btn.flat = true
	hit_btn.focus_mode = Control.FOCUS_NONE
	hit_btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	hit_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hit_btn.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var empty := StyleBoxEmpty.new()
	for st_n in ["normal", "hover", "pressed", "disabled", "focus"]:
		hit_btn.add_theme_stylebox_override(st_n, empty)
	hit_btn.pressed.connect(func() -> void: select(race))
	panel.add_child(hit_btn)
	return panel

func card_style(active: bool, color: Color) -> StyleBox:
	var tint := Color.WHITE.lerp(color.lightened(0.25), 0.36) * 1.16 if active else Color(0.76, 0.75, 0.78)
	tint.a = 1.0
	return _forged_panel(36.0, 42.0, tint)

func select(race: String) -> void:
	selected = race
	var data: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % race)
	for r: String in cards:
		var rdata: Dictionary = PyraContinent.load_json("res://data/races/%s.json" % r)
		var rlore: Dictionary = rdata.get("lore", {})
		var color := Color(str(rlore.get("color", "#e8c070")))
		(cards[r] as PanelContainer).add_theme_stylebox_override("panel", card_style(r == race, color))
		if stages.has(r):
			(stages[r] as RaceStageView).set_selected_ki(r == race, true)
	var lore: Dictionary = data.get("lore", {})
	var desc := str(lore.get("description", lore.get("summary", lore.get("title", ""))))
	var rname := str(data.get("raceName", race))
	details.text = "%s (%s) — %s" % [rname, str(lore.get("world", "")), desc]
	confirm.disabled = false
	confirm.text = "DALEJ: %s" % rname.to_upper()
	_play_sfx("races/%s-transform.mp3" % race)
