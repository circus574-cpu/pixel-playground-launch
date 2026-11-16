class_name CachedLayer
extends Control
## Draws a Control into a transparent render target once and shows the result as a single textured quad. Re-rendered only
## when `invalidate()` is called, so a HUD made of hundreds of draw commands costs one draw call per frame while idle.

var viewport := SubViewport.new()
var display := TextureRect.new()
var content: Control
var ui_scale := 1.0

func setup(node: Control) -> void:
	content = node
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	viewport.transparent_bg = true
	viewport.disable_3d = true
	viewport.gui_disable_input = true
	viewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR
	add_child(viewport)
	viewport.add_child(content)
	display.texture = viewport.get_texture()
	display.mouse_filter = Control.MOUSE_FILTER_IGNORE
	display.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	display.stretch_mode = TextureRect.STRETCH_SCALE
	display.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR
	add_child(display)

## Logical size of the layer; the render target gets the device resolution so text stays crisp.
func resize_to(logical: Vector2) -> void:
	var root := get_tree().root if is_inside_tree() else null
	ui_scale = clampf(root.get_screen_transform().get_scale().x, 1.0, 3.0) if root != null else 1.0
	viewport.size = Vector2i((logical * ui_scale).round())
	viewport.canvas_transform = Transform2D().scaled(Vector2.ONE * ui_scale)
	content.position = Vector2.ZERO
	content.size = logical
	display.position = Vector2.ZERO
	display.size = logical
	invalidate()

func invalidate() -> void:
	if content != null:
		content.queue_redraw()
		viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
