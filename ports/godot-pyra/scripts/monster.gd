class_name PyraMonster
extends Node2D
## One of the 40 bestiary monsters, played by the rules exported from the browser game (stats, basic attack, skills, traits).
## Implemented: idle wandering around home, aggro, provoked monsters, chase, leash and return, keep-distance, still / fly /
## ghost, basic melee and ranged attacks, skills of every mode (melee, ranged volley, burst, leap, charge, self: call / guard /
## reduce / heal), telegraphs, retreat below an HP fraction, rage, death, respawn. Zones, summons, burrow, ambush, split, revive
## and the other rarer traits are listed in the README as not ported yet (the monster then fights with its basic rules).
## It answers the same calls as the training dummy, so every kit ability works on it unchanged.

signal died(monster: PyraMonster)

const BASE_SPEED := 120.0   # px/s at speed 1.0 (0.12 px/ms in the browser)
const DRAW_SCALE := 1.15    # the hero is drawn 15% larger than in the browser (owner request), so the bestiary follows

var def: Dictionary = {}
var manager: Node
var spawn_index := -1
var home := Vector2.ZERO
var hp := 1.0
var max_hp := 1.0
var phase := "idle"          # idle, engage, return, dead
var actor: PyraActor
var facing := Vector2.DOWN
var label := "Potwór"
var provoked := false
var since_hit := 0.0
var stunned := 0.0
var slowed := 0.0
var slow_pct := 0.0
var burning := 0.0
var burn_dps := 0.0
var marked_until := 0.0
var sealed_until := 0.0
var attack_ready := 0.0
var clock := 0.0
var cooldowns: Dictionary = {}
var used: Dictionary = {}
var casting: Dictionary = {}
var wander_target := Vector2.ZERO
var wander_wait := 0.0
var retreat_until := 0.0
var guard := 0.0
var reduce := 0.0
var reduce_until := 0.0
var exposed_until := 0.0
var flash := 0.0
var shown_hp := 1.0
var dash: Dictionary = {}
var leap: Dictionary = {}
var volley: Array[Dictionary] = []

func setup(definition: Dictionary, at: Vector2, parent_manager: Node, index: int) -> void:
	def = definition
	manager = parent_manager
	spawn_index = index
	home = at
	position = at
	max_hp = float(def.hp)
	hp = max_hp
	label = str(def.name)
	actor = PyraActor.new()
	add_child(actor)
	actor.setup(def.actor, "", false)
	actor.scale = Vector2.ONE * DRAW_SCALE
	wander_target = home
	clock = randf() * 3.0

func traits() -> Dictionary:
	return def.traits

func is_marked() -> bool:
	return clock < marked_until

# ---- the interface the kits call -------------------------------------------------------------

func hurt(raw: float, _crit: bool) -> float:
	if phase == "dead":
		return 0.0
	var amount := maxf(1.0, raw - float(def.def) * 0.5)
	if guard > 0.0:
		var soaked := minf(guard, amount)
		guard -= soaked
		amount -= soaked
	if clock < reduce_until:
		amount *= 1.0 - reduce
	if clock < exposed_until:
		amount *= 1.0 + float(traits().get("exposedBonus", 0.0))
	amount = maxf(0.0, amount)
	hp = maxf(0.0, hp - amount)
	since_hit = 0.0
	flash = 0.2
	if not provoked:
		provoked = true
	if phase == "idle" or phase == "return":
		engage()
	if hp <= 0.0:
		die()
	elif randf() < 0.12:
		actor.play_once("hit")
	return amount

func burn(dps: float, seconds: float) -> void:
	burn_dps = dps
	burning = seconds

func stun(seconds: float) -> void:
	stunned = maxf(stunned, seconds)
	casting = {}

func slow(fraction: float, seconds: float) -> void:
	slow_pct = maxf(slow_pct, fraction)
	slowed = maxf(slowed, seconds)

func seal(seconds: float, _vulnerability: float) -> void:
	sealed_until = clock + seconds

func mark(seconds: float, _crit: float, _share: float) -> void:
	marked_until = clock + seconds

func push(from: Vector2, distance: float) -> void:
	step_to(position + (position - from).normalized() * minf(distance, 60.0), 9999.0)

func break_shield() -> void:
	guard = 0.0

func on_defeated() -> void:
	pass

# ---- life cycle ------------------------------------------------------------------------------

func engage() -> void:
	if phase == "dead":
		return
	phase = "engage"
	provoked = true

func die() -> void:
	phase = "dead"
	casting = {}
	dash = {}
	leap = {}
	actor.play_once("death")
	died.emit(self)
	var tween := create_tween()
	tween.tween_interval(1.4)
	tween.tween_property(actor, "modulate:a", 0.0, 0.6)
	tween.tween_callback(queue_free)

func target_pos() -> Vector2:
	return manager.player_position()

func player_safe() -> bool:
	return manager.player_is_safe()

func speed_px() -> float:
	var speed := float(def.speed)
	var below: Variant = traits().get("slowBelow", null)
	if below != null and hp / max_hp < float(below.hp):
		speed *= float(below.mult)
	if slowed > 0.0:
		speed *= 1.0 - slow_pct
	return BASE_SPEED * speed

func can_walk(to: Vector2) -> bool:
	if traits().get("fly", false) or traits().get("ghost", false):
		return not manager.in_safe_city(to)
	return manager.walkable(to) and not manager.in_safe_city(to)

func step_to(to: Vector2, max_distance: float) -> bool:
	var delta_v := to - position
	var distance := minf(delta_v.length(), max_distance)
	if distance <= 0.01:
		return true
	var next := position + delta_v.normalized() * distance
	if can_walk(next):
		position = next
		return true
	var x_only := position + Vector2(delta_v.normalized().x * distance, 0.0)
	if can_walk(x_only):
		position = x_only
		return true
	var y_only := position + Vector2(0.0, delta_v.normalized().y * distance)
	if can_walk(y_only):
		position = y_only
		return true
	return false

func face_toward(point: Vector2) -> void:
	var v := point - position
	if v.length_squared() > 1.0:
		facing = v.normalized()
		actor.face(v)

# ---- per-frame behaviour ---------------------------------------------------------------------

func _process(delta: float) -> void:
	if phase == "dead":
		return
	clock += delta
	since_hit += delta
	flash = maxf(0.0, flash - delta)
	if burning > 0.0:
		burning -= delta
		hurt(burn_dps * delta, false)
		if phase == "dead":
			return
	if slowed > 0.0:
		slowed -= delta
		if slowed <= 0.0:
			slow_pct = 0.0
	if clock >= retreat_until and retreat_until > 0.0:
		retreat_until = 0.0
	if stunned > 0.0:
		stunned -= delta
		actor.animate(Vector2.ZERO)
		queue_redraw()
		return
	run_effects(delta)
	if not casting.is_empty():
		update_cast(delta)
	else:
		think(delta)
	var shown_target := hp / max_hp
	shown_hp = lerpf(shown_hp, shown_target, minf(1.0, delta * 8.0))
	actor.sprite.modulate = Color(1.0, 0.6, 0.55) if flash > 0.0 else Color.WHITE
	queue_redraw()

func run_effects(delta: float) -> void:
	if not dash.is_empty():
		var travel: float = minf(float(dash.speed) * delta, float(dash.left))
		var next: Vector2 = position + (dash.dir as Vector2) * travel
		if can_walk(next):
			position = next
		else:
			dash.left = 0.0
		dash.left = float(dash.left) - travel
		if position.distance_to(target_pos()) < 52.0 and not bool(dash.hit):
			dash.hit = true
			manager.hurt_player(self, float(def.atk) * float(dash.dmg), "melee", dash.get("fx", []))
			dash.left = 0.0
		if float(dash.left) <= 0.01:
			if not bool(dash.hit) and float(dash.get("missStun", 0.0)) > 0.0:
				stun(float(dash.missStun))
				exposed_until = clock + float(dash.missStun) + 0.5
			dash = {}
	if not leap.is_empty():
		leap.t = float(leap.t) + delta
		var k: float = clampf(float(leap.t) / float(leap.duration), 0.0, 1.0)
		var next_leap: Vector2 = (leap.from as Vector2).lerp(leap.to, k)
		position = next_leap
		actor.position.y = -sin(k * PI) * 46.0
		if k >= 1.0:
			actor.position.y = 0.0
			var radius := float(leap.radius)
			if position.distance_to(target_pos()) <= radius:
				manager.hurt_player(self, float(def.atk) * float(leap.dmg), "melee", leap.get("fx", []))
			manager.puff(position, radius)
			leap = {}
	for i in range(volley.size() - 1, -1, -1):
		volley[i].wait = float(volley[i].wait) - delta
		if float(volley[i].wait) <= 0.0:
			var shot: Dictionary = volley[i]
			volley.remove_at(i)
			fire(float(shot.dmg), shot.get("fx", []))

func think(delta: float) -> void:
	if not leap.is_empty() or not dash.is_empty():
		return
	var player := target_pos()
	var distance := position.distance_to(player)
	var leash := float(traits().get("leash", 400))
	match phase:
		"idle":
			if traits().get("still", false):
				actor.animate(Vector2.ZERO)
			else:
				wander(delta)
			if can_aggro(distance):
				engage()
		"engage":
			if player_safe() or manager.player_dead() or position.distance_to(home) > leash or giving_up():
				phase = "return"
				return
			if retreat_until > 0.0:
				var away := (position - player).normalized()
				step_to(position + away * 100.0, speed_px() * delta)
				actor.animate(away)
				return
			var retreat: Variant = traits().get("retreat", null)
			if retreat != null and hp / max_hp < float(retreat.below) and not used.has("retreat"):
				used["retreat"] = true
				retreat_until = clock + float(retreat.ms) / 1000.0
				return
			fight(distance, delta, player)
		"return":
			if position.distance_to(home) < 24.0:
				phase = "idle"
				provoked = false
				hp = max_hp
				shown_hp = 1.0
				guard = 0.0
				used.clear()
				return
			var back := home - position
			step_to(home, speed_px() * 1.4 * delta)
			actor.animate(back)
			if hp < max_hp:
				hp = minf(max_hp, hp + max_hp * 0.15 * delta)

func giving_up() -> bool:
	var t := traits()
	return bool(t.get("provoked", false)) and since_hit * 1000.0 > float(t.get("giveUp", 6000))

func can_aggro(distance: float) -> bool:
	if player_safe() or manager.player_dead():
		return false
	if traits().get("provoked", false) and not provoked:
		return false
	var radius := float(def.agro)
	var night: Variant = traits().get("night", null)
	if night != null and not manager.is_night():
		radius *= float(night.day)
	if traits().get("opportunist", null) != null:
		return distance < radius and manager.player_hp_ratio() < float(traits().opportunist)
	return distance <= radius

func wander(delta: float) -> void:
	var radius := float(traits().get("wander", 120))
	wander_wait -= delta
	if wander_wait > 0.0 or position.distance_to(wander_target) < 12.0:
		actor.animate(Vector2.ZERO)
		if wander_wait <= 0.0:
			wander_wait = randf_range(1.5, 4.0)
			wander_target = home + Vector2.from_angle(randf() * TAU) * randf() * radius
		return
	var toward := wander_target - position
	if not step_to(wander_target, speed_px() * 0.45 * delta):
		wander_target = position
	actor.animate(toward)

func fight(distance: float, delta: float, player: Vector2) -> void:
	face_toward(player)
	var reach := float(def.range)
	var keep := float(traits().get("keep", 0.0))
	# a skill first
	var skill := pick_skill(distance)
	if not skill.is_empty():
		begin_cast(skill, player)
		return
	if keep > 0.0 and distance < keep * 0.8:
		var away := (position - player).normalized()
		step_to(position + away * 60.0, speed_px() * delta)
		actor.animate(-away)
		return
	var ready_basic := String(def.basic) != "none"
	if ready_basic and distance <= reach and clock >= attack_ready:
		basic_attack(player)
		return
	var want := reach * 0.85 if String(def.basic) == "melee" else maxf(reach * 0.9, keep)
	if distance > want or String(def.basic) == "none":
		var toward := player - position
		if traits().get("flank", false) and distance > reach * 1.5:
			toward = toward.rotated(0.5)
		step_to(position + toward.normalized() * 100.0, speed_px() * delta)
		actor.animate(toward)
	else:
		actor.animate(Vector2.ZERO)

func pick_skill(distance: float) -> Dictionary:
	for s: Dictionary in def.skills:
		var id := str(s.id)
		if clock < float(cooldowns.get(id, 0.0)):
			continue
		if bool(s.get("once", false)) and used.has(id):
			continue
		if s.has("below") and hp / max_hp >= float(s.below):
			continue
		if str(s.mode) == "self":
			if s.has("call") and distance < 600.0 and not used.has(id):
				return s
			if s.has("heal") or s.has("buff") or s.has("guard") or s.has("reduce"):
				if distance <= float(s.get("range", 400)) + 200.0:
					return s
			continue
		if s.has("summon") or s.has("zone") and not s.has("dmg"):
			continue
		if distance <= float(s.range):
			return s
	return {}

func begin_cast(skill: Dictionary, player: Vector2) -> void:
	var id := str(skill.id)
	cooldowns[id] = clock + float(skill.cd) / 1000.0
	if bool(skill.get("once", false)):
		used[id] = true
	var warn := float(skill.get("telegraph", 0.0))
	var mode := str(skill.mode)
	if warn <= 0.0:
		warn = 0.35 if mode != "self" else 0.2
	var at := position if bool(skill.get("centred", false)) else player
	casting = {"skill": skill, "left": warn, "at": at, "from": position, "player": player}
	actor.play_once("skill" if mode != "melee" else "attack")

func update_cast(delta: float) -> void:
	casting.left = float(casting.left) - delta
	actor.animate(Vector2.ZERO)
	if float(casting.left) > 0.0:
		return
	var skill: Dictionary = casting.skill
	var at: Vector2 = casting.at
	casting = {}
	resolve(skill, at)

func resolve(skill: Dictionary, at: Vector2) -> void:
	var mult := float(skill.get("dmg", 1.0))
	var fx: Array = skill.get("fx", [])
	var player := target_pos()
	match str(skill.mode):
		"melee":
			if position.distance_to(player) <= float(skill.range) + 50.0:
				manager.hurt_player(self, float(def.atk) * mult * damage_scale(), "melee", fx)
		"ranged":
			var shots := maxi(1, int(skill.get("volley", 1)))
			for i in shots:
				volley.append({"wait": 0.14 * i, "dmg": mult * damage_scale(), "fx": fx})
		"burst":
			var radius := float(skill.get("radius", 120.0))
			manager.puff(at, radius)
			if player.distance_to(at) <= radius:
				manager.hurt_player(self, float(def.atk) * mult * damage_scale(), "area", fx)
		"leap":
			var landing := at
			if not can_walk(landing):
				landing = position
			leap = {"from": position, "to": landing, "t": 0.0, "duration": 0.38, "radius": float(skill.get("radius", 95.0)), "dmg": mult * damage_scale(), "fx": fx}
		"charge":
			var direction := (at - position).normalized()
			dash = {"dir": direction, "speed": 620.0, "left": float(skill.range) + 120.0, "dmg": mult * damage_scale(), "fx": fx, "hit": false, "missStun": float(skill.get("missStun", 0.0))}
		"self":
			if skill.has("call"):
				manager.call_allies(self, 600.0, int(skill.call))
			if skill.has("guard"):
				guard = max_hp * float(skill.guard.pct)
			if skill.has("reduce"):
				reduce = float(skill.reduce.pct)
				reduce_until = clock + float(skill.reduce.ms) / 1000.0
			if skill.has("heal"):
				manager.heal_allies(self, float(skill.get("range", 300)), float(skill.heal.pct) * 0.5)
	if skill.has("opener") and false:
		pass

func damage_scale() -> float:
	var rage: Variant = traits().get("rage", null)
	if rage == null:
		return 1.0
	var ratio := hp / max_hp
	return 1.0 + float(rage.dmg) * clampf((0.7 - ratio) / 0.4, 0.0, 1.0)

func basic_attack(player: Vector2) -> void:
	var interval := float(def.attackCd) / 1000.0
	var rage: Variant = traits().get("rage", null)
	if rage != null and hp / max_hp < float(rage.below):
		interval /= float(rage.speed)
	attack_ready = clock + interval
	actor.play_once("attack")
	if String(def.basic) == "ranged":
		var tween := create_tween()
		tween.tween_interval(0.25)
		tween.tween_callback(func() -> void: if phase != "dead": fire(1.0 * damage_scale(), def.get("basicFx", [])))
	else:
		var tween2 := create_tween()
		tween2.tween_interval(0.25)
		tween2.tween_callback(func() -> void:
			if phase != "dead" and stunned <= 0.0 and position.distance_to(target_pos()) <= float(def.range) + 40.0:
				manager.hurt_player(self, float(def.atk) * damage_scale(), "melee", def.get("basicFx", [])))

func fire(mult: float, fx: Array) -> void:
	manager.shoot(self, position + Vector2(0, -float(def.actor.size[1]) * 0.4), target_pos(), float(def.atk) * mult, fx)

# ---- drawing: health bar, name, telegraphs ---------------------------------------------------

func _draw() -> void:
	if phase == "dead":
		return
	var top := -float(def.actor.size[1]) * 0.95 * DRAW_SCALE - 8.0
	if shown_hp < 0.999 or phase == "engage":
		var width := 64.0
		draw_rect(Rect2(-width / 2.0 - 1.0, top - 1.0, width + 2.0, 8.0), Color(0.04, 0.02, 0.02, 0.85))
		draw_rect(Rect2(-width / 2.0, top, width * shown_hp, 6.0), Color("d9482b") if shown_hp > 0.3 else Color("f08a2a"))
		if guard > 0.0:
			draw_rect(Rect2(-width / 2.0, top + 6.0, width * clampf(guard / max_hp, 0.0, 1.0), 2.0), Color("9fe3ff"))
	var font: Font = ThemeDB.fallback_font
	var tag := "%s  poz. %d" % [label, int(def.level)]
	var w := font.get_string_size(tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string_outline(font, Vector2(-w / 2.0, top - 6.0), tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 5, Color(0.05, 0.02, 0.02, 0.95))
	draw_string(font, Vector2(-w / 2.0, top - 6.0), tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("ffd9c8"))
	if not casting.is_empty():
		var skill: Dictionary = casting.skill
		var mode := str(skill.mode)
		var warn := maxf(0.05, float(skill.get("telegraph", 0.35)))
		var k := 1.0 - clampf(float(casting.left) / warn, 0.0, 1.0)
		var at: Vector2 = to_local(casting.at)
		if mode == "burst" or mode == "leap":
			var radius := float(skill.get("radius", 100.0))
			draw_circle(at, radius, Color(1.0, 0.25, 0.15, 0.10 + 0.18 * k))
			draw_arc(at, radius, 0, TAU, 40, Color(1.0, 0.4, 0.25, 0.9), 2.5, true)
			draw_arc(at, radius * k, 0, TAU, 40, Color(1.0, 0.7, 0.4, 0.8), 2.0, true)
		elif mode == "charge":
			var line_to := to_local(position + ((casting.at as Vector2) - position).normalized() * (float(skill.range) + 120.0))
			draw_line(Vector2.ZERO, line_to, Color(1.0, 0.3, 0.2, 0.25 + 0.3 * k), 36.0)
		elif mode == "ranged" or mode == "melee":
			draw_circle(Vector2(0, -float(def.actor.size[1]) * 0.4), 10.0 + 10.0 * k, Color(1.0, 0.5, 0.2, 0.5))
