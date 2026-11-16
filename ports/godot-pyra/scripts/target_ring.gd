class_name PyraTargetRing
extends Node2D
## The ring under the foe the hero is fighting: three turning arcs on the ground, wider for bosses.

var radius := 46.0
var spin := 0.0
var tint := Color("ffcf6b")

func _ready() -> void:
	z_index = -1
	visible = false

## Puts the ring under `at`; `wide` is the foe's footprint.
func aim(at: Vector2, wide: float, boss: bool) -> void:
	position = at
	radius = wide
	tint = Color("ff6b4a") if boss else Color("ffcf6b")
	visible = true
	queue_redraw()

func clear() -> void:
	visible = false

func _process(delta: float) -> void:
	if visible:
		spin += delta * 1.7
		queue_redraw()

func _draw() -> void:
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, 0.36))
	var pulse := 1.0 + 0.04 * sin(spin * 3.0)
	for i in 3:
		var a := spin + float(i) * TAU / 3.0
		draw_arc(Vector2.ZERO, radius * pulse, a, a + TAU / 4.2, 18, Color(0.05, 0.02, 0.02, 0.5), 8.0, true)
		draw_arc(Vector2.ZERO, radius * pulse, a, a + TAU / 4.2, 18, tint, 4.0, true)
	draw_set_transform(Vector2.ZERO)
