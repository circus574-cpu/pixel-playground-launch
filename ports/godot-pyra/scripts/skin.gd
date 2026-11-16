class_name PyraSkin
extends RefCounted
## The look of the whole interface: lava stone and gold, from the owner's frame art (assets/ui/frames, scripts/godot/prepare_ui_frames.py).
## Windows and panels are 9-slice stone frames, buttons are stone pills, and a Theme installed on the root window gives every plain Button, PanelContainer,
## LineEdit and ProgressBar the same look. A piece that is missing from an install falls back to the earlier flat look, so nothing breaks without the art.

const DIR := "res://assets/ui/frames/"
const WINDOW_MARGIN := 64.0       # corner slice of window.webp (px of the texture)
const WINDOW_CONTENT := 38.0      # space between the outer edge and the content of a window
const BUTTON_MARGIN_X := 40.0
const BUTTON_MARGIN_Y := 22.0
const INK := Color("fff0cf")
const GOLD := Color("e6d3ae")
static var cache: Dictionary = {}
static var theme_cache: Theme

static func texture(name: String) -> Texture2D:
	if not cache.has(name):
		var path := DIR + name + ".webp"
		cache[name] = load(path) if ResourceLoader.exists(path) else null
	return cache[name]

## A stone window frame (9-slice, the border tiles along the edges). `content` is the space left inside it.
static func window(content: float = WINDOW_CONTENT, tint: Color = Color.WHITE) -> StyleBox:
	var tex := texture("window")
	var stone := background()
	if tex != null and stone != null:
		var framed := WindowBox.new()
		framed.frame = tex
		framed.stone = stone
		framed.tint = tint
		framed.set_content_margin_all(content)
		return framed
	if tex == null:
		var flat := StyleBoxFlat.new()
		flat.bg_color = Color(0.09, 0.07, 0.08, 0.96)
		flat.border_color = Color("c18a4b")
		flat.set_border_width_all(2)
		flat.set_corner_radius_all(12)
		flat.set_content_margin_all(content * 0.5)
		return flat
	var box := StyleBoxTexture.new()
	box.texture = tex
	box.texture_margin_left = WINDOW_MARGIN
	box.texture_margin_right = WINDOW_MARGIN
	box.texture_margin_top = WINDOW_MARGIN
	box.texture_margin_bottom = WINDOW_MARGIN
	box.axis_stretch_horizontal = StyleBoxTexture.AXIS_STRETCH_MODE_TILE_FIT
	box.axis_stretch_vertical = StyleBoxTexture.AXIS_STRETCH_MODE_TILE_FIT
	box.set_content_margin_all(content)
	box.modulate_color = tint
	return box

## The owner's lava-stone texture: the background of the sign-in screen and the inside of every window.
static func background() -> Texture2D:
	if not cache.has("stone"):
		var path := "res://assets/ui/backgrounds/stone.webp"
		cache["stone"] = load(path) if ResourceLoader.exists(path) else null
	return cache["stone"]

## A window: the stone texture inside (at its own scale, never squeezed) and the stone-and-gold frame over it.
class WindowBox extends StyleBox:
	var frame: Texture2D
	var stone: Texture2D
	var tint := Color.WHITE

	func _draw(to_canvas_item: RID, rect: Rect2) -> void:
		var inner := rect.grow(-18.0)
		if inner.has_area():
			var source := stone.get_size()
			var grow := maxf(1.0, maxf(inner.size.x / source.x, inner.size.y / source.y))
			RenderingServer.canvas_item_add_texture_rect_region(to_canvas_item, inner, stone.get_rid(), Rect2(Vector2.ZERO, inner.size / grow), tint)
		var corner := Vector2.ONE * PyraSkin.WINDOW_MARGIN
		RenderingServer.canvas_item_add_nine_patch(to_canvas_item, rect, Rect2(Vector2.ZERO, frame.get_size()), frame.get_rid(), corner, corner,
			RenderingServer.NINE_PATCH_TILE_FIT, RenderingServer.NINE_PATCH_TILE_FIT, false, tint)

## A stone pill for a button in one of the states "normal", "hover", "pressed", "disabled".
static func button_box(state: String = "normal", margin_x: float = 22.0, margin_y: float = 8.0) -> StyleBox:
	var name := "button" if state == "normal" else "button-" + state
	var tex := texture(name)
	if tex == null:
		var flat := StyleBoxFlat.new()
		flat.bg_color = {"normal": Color("533421"), "hover": Color("704b2d"), "pressed": Color("704b2d"), "disabled": Color("2a211f")}.get(state, Color("533421"))
		flat.border_color = Color("986c42")
		flat.set_border_width_all(2)
		flat.set_corner_radius_all(12)
		flat.content_margin_left = margin_x
		flat.content_margin_right = margin_x
		return flat
	var box := StyleBoxTexture.new()
	box.texture = tex
	box.texture_margin_left = BUTTON_MARGIN_X
	box.texture_margin_right = BUTTON_MARGIN_X
	box.texture_margin_top = BUTTON_MARGIN_Y
	box.texture_margin_bottom = BUTTON_MARGIN_Y
	box.content_margin_left = margin_x
	box.content_margin_right = margin_x
	box.content_margin_top = margin_y
	box.content_margin_bottom = margin_y
	return box

## A dark inset for text fields: the stone colour with a gold line.
static func field_box(focused: bool = false) -> StyleBoxFlat:
	var box := StyleBoxFlat.new()
	box.bg_color = Color(0.055, 0.042, 0.05, 0.96)
	box.border_color = Color("ffb454") if focused else Color("b8793a")
	box.set_border_width_all(2)
	box.set_corner_radius_all(12)
	box.content_margin_left = 14
	box.content_margin_right = 14
	box.content_margin_top = 8
	box.content_margin_bottom = 8
	return box

## Styles every plain Button of a screen the same way (a screen that wants its own look sets overrides, which win over this).
static func style_button(button: Button) -> void:
	for state in ["normal", "hover", "pressed", "disabled"]:
		button.add_theme_stylebox_override(state, button_box(state))
	button.add_theme_color_override("font_color", INK)
	button.add_theme_color_override("font_hover_color", Color("ffffff"))
	button.add_theme_color_override("font_pressed_color", Color("ffd36a"))
	button.add_theme_color_override("font_disabled_color", Color("8a7a6a"))

static func make_theme() -> Theme:
	var theme := Theme.new()
	for state in ["normal", "hover", "pressed", "disabled"]:
		theme.set_stylebox(state, "Button", button_box(state))
	theme.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	theme.set_color("font_color", "Button", INK)
	theme.set_color("font_hover_color", "Button", Color("ffffff"))
	theme.set_color("font_pressed_color", "Button", Color("ffd36a"))
	theme.set_color("font_disabled_color", "Button", Color("8a7a6a"))
	theme.set_stylebox("panel", "PanelContainer", window())
	theme.set_stylebox("panel", "Panel", window())
	theme.set_stylebox("normal", "LineEdit", field_box())
	theme.set_stylebox("focus", "LineEdit", field_box(true))
	theme.set_color("font_color", "LineEdit", INK)
	theme.set_color("font_placeholder_color", "LineEdit", Color("9c8e78"))
	theme.set_color("caret_color", "LineEdit", Color("ffd36a"))
	theme.set_stylebox("background", "ProgressBar", button_box("pressed", 0.0, 0.0))
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("e0832b")
	fill.set_corner_radius_all(10)
	theme.set_stylebox("fill", "ProgressBar", fill)
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		theme.set_stylebox(state, "CheckBox", StyleBoxEmpty.new())   # a check box is not a button: no pill behind it
	theme.set_color("font_color", "CheckBox", GOLD)
	theme.set_color("font_hover_color", "CheckBox", Color("ffffff"))
	theme.set_color("font_pressed_color", "CheckBox", Color("ffd36a"))
	return theme

## Puts the look on the whole game (every Control under the root window), once.
static func install(tree: SceneTree) -> void:
	if tree.root.theme == null:
		if theme_cache == null:
			theme_cache = make_theme()
		tree.root.theme = theme_cache

## A round frame (assets/ui/frames/ring-*.webp) around a circle of radius `inner` that must stay visible inside it.
static func draw_ring(canvas: Control, name: String, center: Vector2, outer_radius: float) -> bool:
	var tex := texture(name)
	if tex == null:
		return false
	canvas.draw_texture_rect(tex, Rect2(center - Vector2.ONE * outer_radius, Vector2.ONE * outer_radius * 2.0), false)
	return true
