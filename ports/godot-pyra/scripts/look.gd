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
static func window(content: float = 38.0, tint: Color = Color.WHITE) -> StyleBox:
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
		var corner := Vector2.ONE * CORNER
		RenderingServer.canvas_item_add_nine_patch(to_canvas_item, rect, Rect2(Vector2.ZERO, frame.get_size()), frame.get_rid(), corner, corner,
			RenderingServer.NINE_PATCH_TILE_FIT, RenderingServer.NINE_PATCH_TILE_FIT, false, tint)

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
