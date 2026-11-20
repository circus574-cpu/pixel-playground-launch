extends Control
## Real Live Loading Screen for KI Legends (styled identically to the intro film).
## Displays the clean 4-hero widescreen artwork (loading_bg.webp) with a real, live
## molten-gold progress bar (0..100%) and exact Polish loading stage description below it.

const MapStyle := preload("res://scripts/map_style.gd")

var world: Node2D
var bg_tex: Texture2D
var obs_tex: Texture2D
var star_tex: Texture2D
var div_tex: Texture2D

var target_progress := 0.0
var shown_progress := 0.0
var stage_text := "Inicjalizacja świata KI Legends…"
var sub_text := ""
var active := false
var fading_out := false
var fade_alpha := 1.0
var gleam_t := 0.0

func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	visible = false
	if world != null and world.has_method("load_tex"):
		bg_tex = world.load_tex("res://assets/ui/loading_bg.webp")
		obs_tex = world.load_tex("res://assets/ui/obsidian/obsidian_bg.webp")
		star_tex = world.load_tex("res://assets/ui/obsidian/star_gold.webp")
		div_tex = world.load_tex("res://assets/ui/obsidian/divider_wide.webp")

func show_loading(initial_stage: String, initial_pct: float = 0.05, sub: String = "") -> void:
	active = true
	fading_out = false
	fade_alpha = 1.0
	modulate.a = 1.0
	target_progress = clampf(initial_pct, 0.0, 1.0)
	shown_progress = target_progress
	stage_text = initial_stage
	sub_text = sub
	visible = true
	mouse_filter = Control.MOUSE_FILTER_STOP
	queue_redraw()

func set_stage(pct: float, stage: String, sub: String = "") -> void:
	target_progress = clampf(pct, 0.0, 1.0)
	if not visible:
		shown_progress = target_progress
		visible = true
		active = true
		fading_out = false
		fade_alpha = 1.0
		modulate.a = 1.0
	stage_text = stage
	sub_text = sub
	queue_redraw()

func set_immediate(pct: float, stage: String, sub: String = "") -> void:
	show_loading(stage, pct, sub)
	shown_progress = clampf(pct, 0.0, 1.0)
	queue_redraw()

func finish_loading() -> void:
	target_progress = 1.0
	shown_progress = 1.0
	stage_text = "Świat gotowy — wchodzenie do gry…"
	fading_out = true
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	queue_redraw()

func hide_immediate() -> void:
	active = false
	fading_out = false
	visible = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _process(delta: float) -> void:
	if not visible:
		return
	gleam_t += delta
	shown_progress = lerpf(shown_progress, target_progress, clampf(delta * 10.0, 0.0, 1.0))
	if absf(target_progress - shown_progress) < 0.005:
		shown_progress = target_progress
	if fading_out:
		fade_alpha = maxf(0.0, fade_alpha - delta * 2.8)
		modulate.a = fade_alpha
		if fade_alpha <= 0.01:
			active = false
			fading_out = false
			visible = false
	queue_redraw()

func _draw() -> void:
	var vs := size
	if vs.x < 64.0 or vs.y < 64.0:
		vs = get_viewport_rect().size
	# 1. Clean 4-Hero KI Legends Widescreen Artwork (cover-fitted cleanly)
	draw_rect(Rect2(Vector2.ZERO, vs), Color(0.03, 0.03, 0.05, 1.0), true)
	if bg_tex != null:
		var ts := bg_tex.get_size()
		var scale_f := maxf(vs.x / maxf(ts.x, 1.0), vs.y / maxf(ts.y, 1.0))
		var dw := ts.x * scale_f
		var dh := ts.y * scale_f
		draw_texture_rect(bg_tex, Rect2((vs.x - dw) * 0.5, (vs.y - dh) * 0.42, dw, dh), false)

	# 2. Subtle Cinematic Bottom Vignette so the real bar & status text pop with 100% clarity
	var vig_h := clampf(vs.y * 0.34, 180.0, 260.0)
	var steps := 14
	for i in steps:
		var t0 := float(i) / float(steps)
		var t1 := float(i + 1) / float(steps)
		var y0 := vs.y - vig_h * (1.0 - t0)
		var y1 := vs.y - vig_h * (1.0 - t1)
		var alpha := pow(t1, 1.45) * 0.88
		draw_rect(Rect2(0.0, y0, vs.x, y1 - y0 + 1.0), Color(0.02, 0.02, 0.04, alpha), true)

	# 3. Real Volcanic Obsidian & Molten-Gold Progress Bar (modeled on the intro film's bar)
	var bar_w := clampf(vs.x * 0.62, 420.0, 820.0)
	var bar_h := 24.0
	var bar_x := (vs.x - bar_w) * 0.5
	var bar_y := vs.y - 108.0
	var bar_rect := Rect2(bar_x, bar_y, bar_w, bar_h)

	# Drop shadow + cracked obsidian backing
	draw_rect(Rect2(bar_x - 3.0, bar_y - 2.0, bar_w + 6.0, bar_h + 8.0), Color(0.0, 0.0, 0.0, 0.72), true)
	if obs_tex != null:
		draw_texture_rect(obs_tex, bar_rect, true, Color(0.65, 0.62, 0.68, 0.96))
	else:
		draw_rect(bar_rect, Color(0.05, 0.04, 0.07, 0.96), true)

	# Live molten-gold energy fill (0..100%)
	var fill_w := (bar_w - 6.0) * clampf(shown_progress, 0.0, 1.0)
	if fill_w > 2.0:
		var fill_r := Rect2(bar_x + 3.0, bar_y + 3.0, fill_w, bar_h - 6.0)
		# Rich amber-gold base + top specular highlight
		draw_rect(fill_r, Color(0.86, 0.50, 0.12, 0.98), true)
		draw_rect(Rect2(fill_r.position.x, fill_r.position.y, fill_r.size.x, fill_r.size.y * 0.48), Color(1.0, 0.84, 0.36, 0.92), true)
		# Animated energy gleam sweeping across the bar
		var gx := fill_r.position.x + fposmod(gleam_t * 280.0, maxf(fill_w + 120.0, 120.0)) - 60.0
		var g_x0 := maxf(gx, fill_r.position.x)
		var g_x1 := minf(gx + 68.0, fill_r.end.x)
		if g_x1 > g_x0:
			draw_rect(Rect2(g_x0, fill_r.position.y, g_x1 - g_x0, fill_r.size.y), Color(1.0, 0.96, 0.76, 0.38), true)
		# Glowing molten tip spark
		var tip := Vector2(fill_r.end.x, bar_y + bar_h * 0.5)
		draw_circle(tip, 10.0, Color(1.0, 0.78, 0.28, 0.42))
		draw_circle(tip, 4.5, Color(1.0, 0.98, 0.86, 0.96))

	# Outer molten-gold border + divider filigree + 4-pointed end stars
	draw_rect(bar_rect, Color(0.98, 0.72, 0.24, 0.98), false, 2.6)
	draw_rect(bar_rect.grow(-2.0), Color(1.0, 0.88, 0.52, 0.36), false, 1.0)
	if div_tex != null:
		draw_texture_rect(div_tex, Rect2(bar_x - 24.0, bar_y - 20.0, bar_w + 48.0, 16.0), false, Color(1.0, 0.94, 0.82, 0.82))
	if star_tex != null:
		draw_texture_rect(star_tex, Rect2(bar_x - 16.0, bar_y + bar_h * 0.5 - 16.0, 32.0, 32.0), false)
		draw_texture_rect(star_tex, Rect2(bar_x + bar_w - 16.0, bar_y + bar_h * 0.5 - 16.0, 32.0, 32.0), false)

	# 4. Exact Percentage & Live Polish Loading Stage Text directly beneath the bar!
	var f: Font = MapStyle.font()
	var fb: Font = MapStyle.body_font()
	var pct_txt := "%d%%" % int(round(shown_progress * 100.0))
	var pw := f.get_string_size(pct_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
	draw_string_outline(f, Vector2(bar_x + bar_w - pw, bar_y - 10.0), pct_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0.02, 0.01, 0.02, 0.96))
	draw_string(f, Vector2(bar_x + bar_w - pw, bar_y - 10.0), pct_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(1.0, 0.88, 0.48))

	var hdr_txt := "ŁADOWANIE ŚWIATA"
	draw_string_outline(f, Vector2(bar_x, bar_y - 10.0), hdr_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 4, Color(0.02, 0.01, 0.02, 0.96))
	draw_string(f, Vector2(bar_x, bar_y - 10.0), hdr_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.96, 0.86, 0.62))

	var sw := fb.get_string_size(stage_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
	var sx := (vs.x - sw) * 0.5
	var sy := bar_y + bar_h + 30.0
	draw_string_outline(fb, Vector2(sx, sy), stage_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 5, Color(0.02, 0.01, 0.02, 0.98))
	draw_string(fb, Vector2(sx, sy), stage_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.98, 0.95, 0.88))

	if not sub_text.is_empty():
		var sub_w := fb.get_string_size(sub_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		var sub_x := (vs.x - sub_w) * 0.5
		draw_string_outline(fb, Vector2(sub_x, sy + 24.0), sub_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 3, Color(0.02, 0.01, 0.02, 0.95))
		draw_string(fb, Vector2(sub_x, sy + 24.0), sub_text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.66, 0.86, 0.96))
