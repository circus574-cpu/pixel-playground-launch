class_name PyraPlayer
extends Node2D
## The Legend. Movement is kinematic against the published walk mask (continent) or room rectangles (interiors):
## no physics bodies, so the whole continent costs nothing outside the cells next to the hero.

const FOOT_RADIUS := 12.0
const STEP := 6.0

var speed := 170.0
var touch_motion := Vector2.ZERO
var locked := false
var visual: PyraActor
var actor_data: Dictionary
var can_stand: Callable = func(_p: Vector2) -> bool: return true
var facing := Vector2.DOWN
var moving := false
var inside := false
var ki_form := false

func setup(data: Dictionary, base_speed: float) -> void:
	actor_data = data
	speed = base_speed
	set_interior(false)

func set_interior(is_inside: bool) -> void:
	inside = is_inside
	if is_instance_valid(visual):
		remove_child(visual)
		visual.queue_free()
	visual = PyraActor.new()
	add_child(visual)
	visual.setup(actor_data, "", inside, true)
	visual.prefix = "ki" if ki_form else ""

func set_ki_form(active: bool) -> void:
	if ki_form == active:
		return
	ki_form = active
	visual.prefix = "ki" if active else ""

func desired_motion() -> Vector2:
	if locked:
		return Vector2.ZERO
	var keyboard := Vector2(
		float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)),
		float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN)) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)))
	return keyboard.normalized() if keyboard.length_squared() > 0.0 else touch_motion.limit_length(1.0)

## Slides along walls: full step, else along x, else along y.
func slide(move: Vector2) -> void:
	var steps := maxi(1, ceili(move.length() / STEP))
	var part := move / float(steps)
	for i in steps:
		var next := position + part
		if can_stand.call(next):
			position = next
		elif absf(part.x) > 0.01 and can_stand.call(position + Vector2(part.x, 0.0)):
			position += Vector2(part.x, 0.0)
		elif absf(part.y) > 0.01 and can_stand.call(position + Vector2(0.0, part.y)):
			position += Vector2(0.0, part.y)
		else:
			break

## Instant dash toward `to`, stopping at the first obstacle.
func dash(to: Vector2, distance: float) -> void:
	var direction := (to - position).normalized()
	if direction == Vector2.ZERO:
		direction = facing
	var steps := maxi(1, ceili(distance / STEP))
	for i in steps:
		var next := position + direction * minf(STEP, distance)
		if not can_stand.call(next):
			break
		position = next
	facing = direction
	visual.face(direction)

func step(delta: float) -> void:
	var motion := desired_motion()
	var before := position
	if motion.length_squared() > 0.0:
		slide(motion * speed * delta)
	var moved := position - before
	moving = moved.length_squared() > 0.0001
	if motion.length_squared() > 0.0001:
		facing = motion.normalized()
	visual.animate(moved if moving else Vector2.ZERO, motion.length() > 1.05)
	if moving:
		visual.face(moved)
