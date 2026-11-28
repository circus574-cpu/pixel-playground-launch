extends RefCounted
## Unified Seamless Forged Obsidian & Burnished Gold UI Kit for KI Legends.
## Provides 9-slice seamless panels, forged metallic buttons (gold / slate / crimson),
## consistent header bars with "← WSTECZ" navigation, and Android display safe-area helpers.

const MapStyle := preload("res://scripts/map_style.gd")

const FORGED_DIR := "res://assets/ui/forged/"
static var _tex_cache: Dictionary = {}

static func load_tex(path: String) -> Texture2D:
	if path.is_empty():
		return null
	if _tex_cache.has(path):
		return _tex_cache[path] as Texture2D
	if ResourceLoader.exists(path):
		var res := load(path)
		if res is Texture2D:
			_tex_cache[path] = res
			return res
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
				var tex := ImageTexture.create_from_image(img)
				_tex_cache[path] = tex
				return tex
	return null

static func panel_box(pad_x: float = 42.0, pad_y: float = 38.0, tint: Color = Color.WHITE) -> StyleBox:
	var tex := load_tex(FORGED_DIR + "panel_forged.webp")
	var cx := maxf(pad_x, 42.0)
	var cy := maxf(pad_y, 38.0)
	if tex == null:
		return compact_panel_box(cx, cy)
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

static func compact_panel_box(pad_x: float = 16.0, pad_y: float = 12.0, border: Color = Color(0.84, 0.66, 0.32, 0.94)) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.055, 0.05, 0.075, 0.94)
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.shadow_color = Color(0.0, 0.0, 0.0, 0.45)
	sb.shadow_size = 5
	sb.shadow_offset = Vector2(0.0, 3.0)
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	return sb

static func button_box(variant: String = "slate", state: String = "normal", pad_x: float = 24.0, pad_y: float = 10.0) -> StyleBox:
	var file := "btn_forged_slate.webp"
	if variant == "gold":
		file = "btn_forged_gold.webp"
	elif variant == "crimson":
		file = "btn_forged_crimson.webp"
	var tex := load_tex(FORGED_DIR + file)
	if tex == null:
		return square_button_box(variant, state, pad_x, pad_y)
	var sb := StyleBoxTexture.new()
	sb.texture = tex
	sb.texture_margin_left = 44.0
	sb.texture_margin_right = 44.0
	sb.texture_margin_top = 16.0
	sb.texture_margin_bottom = 16.0
	sb.axis_stretch_horizontal = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.axis_stretch_vertical = StyleBoxTexture.AXIS_STRETCH_MODE_STRETCH
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	match state:
		"hover":
			sb.modulate_color = Color(1.16, 1.14, 1.10, 1.0)
		"pressed":
			sb.modulate_color = Color(0.84, 0.80, 0.76, 1.0)
		"disabled":
			sb.modulate_color = Color(0.45, 0.44, 0.46, 0.72)
		_:
			sb.modulate_color = Color.WHITE
	return sb

static func square_button_box(variant: String = "slate", state: String = "normal", pad_x: float = 8.0, pad_y: float = 6.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	var bg := Color(0.11, 0.10, 0.14, 0.96)
	var bd := Color(0.84, 0.66, 0.34, 0.94)
	if variant == "gold":
		bg = Color(0.28, 0.19, 0.06, 0.98)
		bd = Color(1.0, 0.84, 0.40, 0.98)
	elif variant == "crimson":
		bg = Color(0.28, 0.08, 0.08, 0.96)
		bd = Color(0.92, 0.44, 0.34, 0.95)
	match state:
		"hover":
			bg = bg.lightened(0.14)
		"pressed":
			bg = bg.darkened(0.14)
		"disabled":
			bg = bg.darkened(0.30)
			bd.a = 0.45
	sb.bg_color = bg
	sb.border_color = bd
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(12)
	sb.shadow_color = Color(0.0, 0.0, 0.0, 0.42)
	sb.shadow_size = 4
	sb.shadow_offset = Vector2(0.0, 2.0)
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	return sb

static func style_button(btn: Button, variant: String = "slate", font_sz: int = 18, pad_x: float = 24.0, pad_y: float = 10.0) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for st_name in ["normal", "hover", "pressed", "disabled"]:
		btn.add_theme_stylebox_override(st_name, button_box(variant, st_name, pad_x, pad_y))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	btn.add_theme_font_override("font", MapStyle.font() if variant == "gold" else MapStyle.body_font())
	btn.add_theme_font_size_override("font_size", font_sz)
	var col := Color(1.0, 0.96, 0.84) if variant == "gold" else (Color(1.0, 0.90, 0.88) if variant == "crimson" else Color(0.96, 0.93, 0.86))
	btn.add_theme_color_override("font_color", col)
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_pressed_color", Color(1.0, 0.88, 0.50))
	btn.add_theme_color_override("font_disabled_color", Color(0.55, 0.52, 0.50, 0.72))
	btn.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.96))
	btn.add_theme_constant_override("outline_size", 4)

static func style_square_button(btn: Button, variant: String = "slate", font_sz: int = 22) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	btn.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for st_name in ["normal", "hover", "pressed", "disabled"]:
		btn.add_theme_stylebox_override(st_name, square_button_box(variant, st_name, 6.0, 4.0))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	btn.add_theme_font_override("font", MapStyle.font())
	btn.add_theme_font_size_override("font_size", font_sz)
	btn.add_theme_color_override("font_color", Color(1.0, 0.95, 0.80))
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_pressed_color", Color(1.0, 0.86, 0.46))
	btn.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.96))
	btn.add_theme_constant_override("outline_size", 4)

static func inset_card(border: Color = Color(0.58, 0.46, 0.24, 0.72), bg: Color = Color(0.07, 0.065, 0.095, 0.90), pad_x: int = 12, pad_y: int = 8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.content_margin_left = pad_x
	sb.content_margin_right = pad_x
	sb.content_margin_top = pad_y
	sb.content_margin_bottom = pad_y
	return sb

static func make_header_bar(title_txt: String, on_back: Callable, back_label: String = "← WSTECZ", subtitle_txt: String = "") -> HBoxContainer:
	var bar := HBoxContainer.new()
	bar.add_theme_constant_override("separation", 18)

	var btn_back := Button.new()
	btn_back.text = back_label
	btn_back.custom_minimum_size = Vector2(190.0, 56.0)
	style_button(btn_back, "slate", 20, 24.0, 10.0)
	btn_back.pressed.connect(on_back)
	bar.add_child(btn_back)

	var tbox := VBoxContainer.new()
	tbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tbox.alignment = BoxContainer.ALIGNMENT_CENTER
	tbox.add_theme_constant_override("separation", 3)
	var lbl := Label.new()
	lbl.text = title_txt
	lbl.add_theme_font_override("font", MapStyle.font())
	lbl.add_theme_font_size_override("font_size", 26)
	lbl.add_theme_color_override("font_color", Color(1.0, 0.92, 0.62))
	lbl.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.98))
	lbl.add_theme_constant_override("outline_size", 5)
	tbox.add_child(lbl)
	if not subtitle_txt.is_empty():
		var sub := Label.new()
		sub.text = subtitle_txt
		sub.add_theme_font_override("font", MapStyle.body_font())
		sub.add_theme_font_size_override("font_size", 17)
		sub.add_theme_color_override("font_color", Color(0.88, 0.85, 0.78))
		tbox.add_child(sub)
	bar.add_child(tbox)
	return bar
