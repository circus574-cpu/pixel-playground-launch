class_name PyraDummy
extends Node2D
## Training dummy of the city arena: takes every blow, never hits back, pays no rewards, heals itself.
## Not an enemy and not a spawn; it only lets the Legend's abilities be tried on a real target.

signal defeated

var max_hp := 6000.0
var hp := 6000.0
var burning := 0.0
var burn_dps := 0.0
var stunned := 0.0
var shielded := true
var idle_time := 0.0
var total_taken := 0.0
var window_taken := 0.0
var window_time := 0.0
var recent_dps := 0.0
var wobble := 0.0
var label := "Manekin treningowy"

func hurt(raw: float, _crit: bool) -> float:
	var amount := maxf(1.0, raw)
	hp = maxf(0.0, hp - amount)
	idle_time = 0.0
	total_taken += amount
	window_taken += amount
	wobble = 0.35
	if hp <= 0.0:
		hp = max_hp
		defeated.emit()
	return amount

func burn(dps: float, seconds: float) -> void:
	burn_dps = dps
	burning = seconds

func stun(seconds: float) -> void:
	stunned = seconds
	wobble = 0.6

func break_shield() -> void:
	shielded = false

func _process(delta: float) -> void:
	if burning > 0.0:
		burning -= delta
		hurt(burn_dps * delta, false)
	if stunned > 0.0:
		stunned -= delta
	idle_time += delta
	window_time += delta
	if window_time >= 1.0:
		recent_dps = window_taken / window_time
		window_taken = 0.0
		window_time = 0.0
	if idle_time > 4.0 and hp < max_hp:
		hp = minf(max_hp, hp + max_hp * 0.5 * delta)
		if hp >= max_hp:
			shielded = true
			total_taken = 0.0
	if wobble > 0.0:
		wobble = maxf(0.0, wobble - delta)
	queue_redraw()

func _draw() -> void:
	var sway := sin(wobble * 30.0) * wobble * 7.0
	# shadow
	draw_set_transform(Vector2(0, -2), 0.0, Vector2(1, 0.3))
	draw_circle(Vector2.ZERO, 44, Color(0.02, 0.01, 0.01, 0.34))
	draw_set_transform(Vector2.ZERO)
	# post
	draw_rect(Rect2(-9 + sway * 0.2, -120, 18, 120), Color("6b4526"))
	draw_rect(Rect2(-9 + sway * 0.2, -120, 6, 120), Color("8a5b33"))
	# body: straw sack
	var body := PackedVector2Array([Vector2(-34 + sway, -98), Vector2(34 + sway, -98), Vector2(40 + sway, -42), Vector2(-40 + sway, -42)])
	draw_colored_polygon(body, Color("c9a560"))
	draw_polyline(body + PackedVector2Array([body[0]]), Color("7a5a2a"), 3.0)
	draw_circle(Vector2(sway * 1.3, -126), 24, Color("d4b46e"))
	draw_arc(Vector2(sway * 1.3, -126), 24, 0, TAU, 28, Color("7a5a2a"), 3.0)
	draw_line(Vector2(-60 + sway, -88), Vector2(60 + sway, -88), Color("6b4526"), 10.0)
	if shielded:
		draw_arc(Vector2(sway, -76), 52, -0.9, 0.9, 20, Color(0.6, 0.8, 1.0, 0.8), 4.0)
	if burning > 0.0:
		for i in 5:
			draw_circle(Vector2(-24 + i * 12 + sway, -100 - fmod(Time.get_ticks_msec() / 18.0 + i * 13.0, 36.0)), 6.0, Color(1.0, 0.5, 0.1, 0.8))
	# health bar
	var ratio := hp / max_hp
	draw_rect(Rect2(-56, -176, 112, 12), Color(0.05, 0.03, 0.03, 0.85))
	draw_rect(Rect2(-54, -174, 108.0 * ratio, 8), Color("d9482b") if ratio > 0.3 else Color("f08a2a"))
