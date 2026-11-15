class_name PyraMarkers
extends Node2D
## Golden rings on the ground at building entrances and signposts; only the ones near the camera are drawn.

var points: Array[Dictionary] = []
var view := Rect2()

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for marker in points:
		var at: Vector2 = marker.point
		if not view.grow(160).has_point(at):
			continue
		var pulse := 0.5 + 0.5 * sin(t * 2.4 + at.x * 0.01)
		draw_set_transform(at, 0.0, Vector2(1.0, 0.36))
		draw_circle(Vector2.ZERO, 62.0, Color(1.0, 0.72, 0.3, 0.10 + 0.07 * pulse))
		draw_arc(Vector2.ZERO, 62.0 + 6.0 * pulse, 0, TAU, 40, Color(1.0, 0.8, 0.4, 0.55 + 0.25 * pulse), 4.0, true)
		draw_arc(Vector2.ZERO, 38.0, 0, TAU, 32, Color(1.0, 0.9, 0.6, 0.55), 2.5, true)
	draw_set_transform(Vector2.ZERO)
