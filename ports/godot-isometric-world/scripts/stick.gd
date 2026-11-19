extends Control
var world: Node2D
func _draw() -> void:
	if world == null or world.map_expanded or world.atlas_expanded:
		return
	if world.move_pointer < 0:
		return
	if world.rpg_hud != null and (world.rpg_hud.show_talents or world.rpg_hud.show_character):
		return
	var center: Vector2 = world.move_origin
	var displacement: Vector2 = world.motion * 42.0
	draw_circle(center, 62, Color(0.03, 0.025, 0.025, 0.32))
	draw_arc(center, 62, 0, TAU, 48, Color(0.85, 0.65, 0.35, 0.6), 2, true)
	draw_circle(center + displacement, 24, Color(0.8, 0.6, 0.35, 0.5))
