extends RefCounted
## The look of the interface that can change with an update from the server.
##
## Why this file exists next to scripts/skin.gd (PyraSkin): the first scene of the APK (scripts/boot.gd) calls PyraSkin.install() BEFORE it mounts the
## code downloaded from the server, so on an installed app PyraSkin stays exactly as it was in the APK, whatever the server sends. Release 1.1 broke the
## sign-in window that way (it called a PyraSkin function the installed 1.0 did not have). Everything new about the look lives here instead: this file is
## loaded only after the core is mounted (by path, no class_name), and its pictures come from data/ui-art.json (base64 WebP), which travels in the core too.
## Rule: never change the functions of scripts/skin.gd; tests/smoke.gd checks that its list of functions stays the one of APK 1.0.

static var textures: Dictionary = {}
static var pictures: Dictionary = {}
static var letters_font: Font

## A picture of data/ui-art.json ("window", "stone"), or null.
static func picture(name: String) -> Texture2D:
	if textures.has(name):
		return textures[name]
	if pictures.is_empty() and FileAccess.file_exists("res://data/ui-art.json"):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/ui-art.json"))
		if value is Dictionary:
			pictures = (value as Dictionary).get("pictures", {})
	var texture: Texture2D = null
	if pictures.has(name):
		var image := Image.new()
		if image.load_webp_from_buffer(Marshalls.base64_to_raw(str(pictures[name]))) == OK:
			image.generate_mipmaps()
			texture = ImageTexture.create_from_image(image)
	textures[name] = texture
	return texture

## A window: the owner's stone texture inside and the stone-and-gold frame over it; the APK's own frame when the pictures are missing.
static func window(content: float = 48.0, tint: Color = Color.WHITE) -> StyleBox:
	var frame := picture("window")
	var stone := picture("stone")
	if frame == null or stone == null:
		return PyraSkin.window(content, tint)
	var box := WindowBox.new()
	box.frame = frame
	box.stone = stone
	box.tint = tint
	box.set_content_margin_all(content)
	return box

## The lava stone behind a whole screen (inventory, character, map): dimmed so that the content stays readable. Null without the picture.
static func backdrop(dim: float = 0.45) -> TextureRect:
	var stone := picture("stone")
	if stone == null:
		return null
	var back := TextureRect.new()
	back.texture = stone
	back.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	back.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	back.modulate = Color(dim, dim, dim)
	return back

## A heading in the owner's gold letters (white tint: the letters carry their own colour).
static func style_heading(label: Label, size: int) -> void:
	label.add_theme_font_override("font", title_font())
	label.add_theme_font_size_override("font_size", size)
	label.add_theme_color_override("font_color", Color.WHITE)

class WindowBox extends StyleBox:
	const CORNER := 64.0   # corner slice of the frame picture
	var frame: Texture2D
	var stone: Texture2D
	var tint := Color.WHITE

	func _draw(to_canvas_item: RID, rect: Rect2) -> void:
		var inner := rect.grow(-18.0)
		if inner.has_area():
			var source := stone.get_size()
			var grow := maxf(1.0, maxf(inner.size.x / source.x, inner.size.y / source.y))
			RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, inner, stone.get_rid(), Rect2(Vector2.ZERO, inner.size / grow), tint)
		var rid := frame.get_rid()
		var fs := frame.get_size()
		var c := CORNER
		var period := (fs.x - 2.0 * c) / 2.0      # the border is two repeats of one stone pattern
		var start := c + period * 0.5             # a repeat taken from the middle of the strip: its neighbours are the same pattern, so no seam shows
		# the four corners
		RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(rect.position, Vector2(c, c)), rid, Rect2(0, 0, c, c), tint)
		RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(Vector2(rect.end.x - c, rect.position.y), Vector2(c, c)), rid, Rect2(fs.x - c, 0, c, c), tint)
		RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(Vector2(rect.position.x, rect.end.y - c), Vector2(c, c)), rid, Rect2(0, fs.y - c, c, c), tint)
		RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(rect.end - Vector2(c, c), Vector2(c, c)), rid, Rect2(fs.x - c, fs.y - c, c, c), tint)
		# the four edges, tile by tile at whole repeats (the last one cut short)
		var x := rect.position.x + c
		while x < rect.end.x - c - 0.01:
			var w := minf(period, rect.end.x - c - x)
			RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(x, rect.position.y, w, c), rid, Rect2(start, 0, w, c), tint)
			RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(x, rect.end.y - c, w, c), rid, Rect2(start, fs.y - c, w, c), tint)
			x += period
		var y := rect.position.y + c
		while y < rect.end.y - c - 0.01:
			var h := minf(period, rect.end.y - c - y)
			RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(rect.position.x, y, c, h), rid, Rect2(0, start, c, h), tint)
			RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, Rect2(rect.end.x - c, y, c, h), rid, Rect2(fs.x - c, start, c, h), tint)
			y += period

## The round close button in the top right corner of a full-screen view: a gold-ringed medallion with a cross. It floats over the screen,
## so a long title can never push it off the edge of a phone.
class CloseX extends Button:
	func _init() -> void:
		custom_minimum_size = Vector2(88, 88)
		focus_mode = Control.FOCUS_NONE
		flat = true
		for state in ["normal", "hover", "pressed", "focus", "disabled"]:
			add_theme_stylebox_override(state, StyleBoxEmpty.new())
		mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

	func _draw() -> void:
		var centre := size / 2.0
		var lit := is_pressed() or is_hovered()
		draw_circle(centre, 42.0, Color(0.09, 0.05, 0.05, 0.94))
		draw_arc(centre, 41.0, 0.0, TAU, 56, Color("f0b24a") if lit else Color("d4962f"), 4.0, true)
		draw_arc(centre, 34.0, 0.0, TAU, 56, Color(0.55, 0.25, 0.1, 0.9), 2.0, true)
		var arm := 16.0
		var ink := Color("fff0c8") if lit else Color("ffd98a")
		draw_line(centre + Vector2(-arm, -arm), centre + Vector2(arm, arm), Color(0.35, 0.12, 0.05), 11.0, true)
		draw_line(centre + Vector2(-arm, arm), centre + Vector2(arm, -arm), Color(0.35, 0.12, 0.05), 11.0, true)
		draw_line(centre + Vector2(-arm, -arm), centre + Vector2(arm, arm), ink, 6.0, true)
		draw_line(centre + Vector2(-arm, arm), centre + Vector2(arm, -arm), ink, 6.0, true)

## Puts the close button on `screen` (call it last, so it lies over everything); `callback` runs when it is pressed.
static func add_close(screen: Control, callback: Callable) -> Button:
	var close := CloseX.new()
	close.name = "CloseX"
	close.anchor_left = 1.0
	close.anchor_right = 1.0
	close.offset_left = -108.0
	close.offset_right = -20.0
	close.offset_top = 14.0
	close.offset_bottom = 102.0
	close.z_index = 200
	close.pressed.connect(callback)
	screen.add_child(close)
	return close

## A drop-down list (OptionButton) in the game's look: the open list is a dark stone panel with gold hover rows and large text, not the engine's grey popup.
static func style_picker(picker: OptionButton, text_size: int = 28) -> void:
	var popup := picker.get_popup()
	var panel := StyleBoxFlat.new()
	panel.bg_color = Color(0.07, 0.05, 0.06, 0.98)
	panel.border_color = Color("c18a4b")
	panel.set_border_width_all(3)
	panel.set_corner_radius_all(14)
	panel.content_margin_left = 14.0
	panel.content_margin_right = 14.0
	panel.content_margin_top = 12.0
	panel.content_margin_bottom = 12.0
	var hover := StyleBoxFlat.new()
	hover.bg_color = Color(0.55, 0.3, 0.1, 0.75)
	hover.set_corner_radius_all(8)
	popup.add_theme_stylebox_override("panel", panel)
	popup.add_theme_stylebox_override("hover", hover)
	popup.add_theme_stylebox_override("separator", StyleBoxEmpty.new())
	popup.add_theme_font_size_override("font_size", text_size)
	popup.add_theme_color_override("font_color", Color("f2dfc0"))
	popup.add_theme_color_override("font_hover_color", Color("fff3d0"))
	popup.add_theme_color_override("font_disabled_color", Color("8a7a66"))
	popup.add_theme_constant_override("v_separation", 24)
	popup.add_theme_constant_override("item_start_padding", 16)
	popup.add_theme_constant_override("item_end_padding", 16)
	popup.add_theme_constant_override("h_separation", 14)

## A number box (SpinBox) in the game's look: the same dark field with a gold edge as the text fields.
static func style_spin(spin: SpinBox, text_size: int = 26) -> void:
	var edit := spin.get_line_edit()
	edit.add_theme_font_size_override("font_size", text_size)
	edit.add_theme_stylebox_override("normal", PyraSkin.field_box(false))
	edit.add_theme_stylebox_override("focus", PyraSkin.field_box(true))
	edit.add_theme_stylebox_override("read_only", PyraSkin.field_box(false))
	edit.add_theme_color_override("font_color", Color("f6e7cc"))
	edit.add_theme_color_override("font_uneditable_color", Color("8a7a66"))
	edit.alignment = HORIZONTAL_ALIGNMENT_CENTER

## An empty space in a top bar where the close button floats, so the bar's own buttons never lie under it.
static func reserve_close(bar: Control) -> void:
	var gap := Control.new()
	gap.custom_minimum_size = Vector2(96, 0)
	gap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(gap)

## The owner's gold letters (data/letters.json, scripts/godot/prepare_letters.py) as a font: capitals and small letters with the Polish ones, digits,
## punctuation and symbols; anything the sheet lacks comes from the title font (Cinzel). Null when the data is missing.
static func letters() -> Font:
	if letters_font != null:
		return letters_font
	if not FileAccess.file_exists("res://data/letters.json"):
		return null
	var data: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/letters.json"))
	if not data is Dictionary:
		return null
	var image := Image.new()
	if image.load_webp_from_buffer(Marshalls.base64_to_raw(str(data.atlas))) != OK:
		return null
	var cap := int(data.cap)
	var size := Vector2i(cap, 0)
	var font := FontFile.new()
	font.fixed_size = cap
	font.fixed_size_scale_mode = TextServer.FIXED_SIZE_SCALE_ENABLED
	font.set_texture_image(0, size, 0, image)
	font.set_cache_ascent(0, cap, float(data.ascent))
	font.set_cache_descent(0, cap, float(data.descent))
	var spacing := float(data.spacing)
	for letter: String in (data.glyphs as Dictionary):
		var g: Dictionary = data.glyphs[letter]
		var r: Array = g.rect
		for code in [letter.unicode_at(0)]:   # the sheet has its own small letters, digits, punctuation and symbols
			font.set_glyph_texture_idx(0, size, code, 0)
			font.set_glyph_uv_rect(0, size, code, Rect2(float(r[0]), float(r[1]), float(r[2]), float(r[3])))
			font.set_glyph_size(0, size, code, Vector2(float(r[2]), float(r[3])))
			font.set_glyph_offset(0, size, code, Vector2(0.0, -float(g.rise)))
			font.set_glyph_advance(0, cap, code, Vector2(float(r[2]) + spacing, 0.0))
	font.set_glyph_advance(0, cap, " ".unicode_at(0), Vector2(float(data.space), 0.0))
	var fallback: Font = load("res://assets/branding/cinzel-bold.ttf")
	if fallback != null:
		font.fallbacks = [fallback]
	letters_font = font
	return font

## Titles: the owner's letters, or the plain title font.
static func title_font() -> Font:
	var font := letters()
	return font if font != null else load("res://assets/branding/cinzel-bold.ttf")

## The gold letters on every button of the game (the theme installed by the APK's boot.gd gets the font and white text, so the letters keep their own colour).
static func install_letters(tree: SceneTree) -> void:
	var font := letters()
	if font == null or tree.root.theme == null:
		return
	var theme := tree.root.theme
	theme.set_font("font", "Button", font)
	theme.set_font("font", "CheckBox", font)
	for name in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color", "font_focus_color"]:
		theme.set_color(name, "Button", Color.WHITE if name != "font_disabled_color" else Color(0.6, 0.6, 0.6))
	theme.set_color("font_color", "CheckBox", Color.WHITE)
	theme.set_color("font_hover_color", "CheckBox", Color.WHITE)
	theme.set_color("font_pressed_color", "CheckBox", Color.WHITE)
