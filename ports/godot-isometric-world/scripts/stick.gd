extends Control
var world: Node2D
func _draw() -> void:
	if world == null or world.map_expanded or world.atlas_expanded:
		return
	var center: Vector2 = world.move_origin if world.move_pointer >= 0 else Vector2(110, get_viewport_rect().size.y - 125)
	var displacement: Vector2 = world.motion * 42 if world.move_pointer >= 0 else Vector2.ZERO
	draw_circle(center, 62, Color(0.03, 0.025, 0.025, 0.32))
	draw_arc(center, 62, 0, TAU, 48, Color(0.85, 0.65, 0.35, 0.6), 2, true)
	draw_circle(center + displacement, 24, Color(0.8, 0.6, 0.35, 0.5))
