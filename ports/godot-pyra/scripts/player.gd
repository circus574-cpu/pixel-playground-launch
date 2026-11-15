class_name PyraPlayer
extends CharacterBody2D

var speed := 180.0
var touch_motion := Vector2.ZERO
var locked := false
var visual: PyraActor
var actor_data: Dictionary

func setup(data: Dictionary, base_speed: float) -> void:
	actor_data = data
	speed = base_speed
	var shape := CircleShape2D.new()
	shape.radius = 12.0
	var collider := CollisionShape2D.new()
	collider.shape = shape
	add_child(collider)
	collision_layer = 2
	collision_mask = 1
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	set_interior(false)

func set_interior(inside: bool) -> void:
	if is_instance_valid(visual):
		remove_child(visual)
		visual.queue_free()
	visual = PyraActor.new()
	add_child(visual)
	visual.setup(actor_data, "", inside)

func desired_motion() -> Vector2:
	if locked:
		return Vector2.ZERO
	var keyboard := Vector2(
		float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT)) - float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)),
		float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN)) - float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)))
	return keyboard.normalized() if keyboard.length_squared() > 0.0 else touch_motion.limit_length(1.0)

func _physics_process(_delta: float) -> void:
	velocity = desired_motion() * speed
	var before := position
	move_and_slide()
	visual.animate(position - before)
	z_index = clampi(roundi(position.y), -4090, 4090)
