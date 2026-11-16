class_name PyraMonster
extends Node2D
## One of the 40 bestiary monsters (plus the helper creatures they summon), played by the rules exported from the browser game:
## stats, basic attack, skills and traits. Implemented: idle wandering / routes, aggro (day and night, opportunists, provoked),
## chase, leash and return, keep-distance, still / fly / ghost, basic melee and ranged attacks, skills of every mode (melee, ranged
## volley, burst with damage zones, leap, charge, self: call / guard / reduce / heal / summon), telegraphs, retreat, flee after hits,
## dive, rage, ramp, weaknesses by damage class, front armour and back bonus, curl, reflect, exposed phases, burrow, ambush, split
## and merge, revive, explode and death zones, trail, webs, medic, turret (turning, overheating), interrupt, brittle tail.
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
var mark_def := 0.0
var sealed_until := 0.0
var seal_bonus := 0.0
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
var exposed_pct := 0.0
var flash := 0.0
var shown_hp := 1.0
var dash: Dictionary = {}
var leap: Dictionary = {}
var volley: Array[Dictionary] = []
# state of the rarer traits
var hits_taken := 0
var curl_until := 0.0
var revived := false
var concealed := false
var invulnerable := false
var burrow_phase := ""          # "", "up", "under"
var burrow_left := 0.0
var ambush_hidden_until := 0.0
var dive_count := 0
var route_index := 0
var tail_broken := false
var ramp_stacks := 0
var ramp_clock := 0.0
var turret_shots := 0
var turret_off_until := 0.0
var trail_clock := 0.0
var web_clock := 0.0
var split_done := false
var split_partner: PyraMonster
var split_orig_max := 0.0
var split_merge_at := 0.0
var flee_hits := 0
var no_reward := false
# bosses: phases, signature mechanics, flight
var boss: Dictionary = {}
var boss_phase := 0
var boss_script: PyraBossScript
var base_def: Dictionary = {}
var flying := false
var buff_pct := 0.0
var buff_until := 0.0

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
	if traits().has("ambush"):
		concealed = true

## A boss: the combat translation of the browser game (`def`), its catalogue entry (`info`) and phase 1 at once.
func setup_boss(info: Dictionary, definition: Dictionary, at: Vector2, parent_manager: Node, index: int) -> void:
	boss = info
	base_def = definition
	setup(definition, at, parent_manager, index)
	boss_script = PyraBossScript.new(self, str(info.id))
	update_boss_phase()

## Phases are monotonic (several thresholds can be skipped by one hit): attack list, attack and speed follow the phase.
func update_boss_phase() -> void:
	if boss.is_empty() or hp <= 0.0:
		return
	var fraction := hp / max_hp * 100.0
	var target := boss_phase
	for p: Dictionary in boss.phases:
		if fraction <= float(p.hpThresholdPercent) and int(p.phaseNumber) > target:
			target = int(p.phaseNumber)
	if target == boss_phase:
		return
	boss_phase = target
	var info: Dictionary = {}
	for p: Dictionary in boss.phases:
		if int(p.phaseNumber) == boss_phase:
			info = p
	var mods: Dictionary = info.get("statModifiers", {})
	def = base_def.duplicate(true)
	def.atk = float(base_def.atk) * float(mods.get("atkMultiplier", 1.0))
	def.speed = float(base_def.speed) * float(mods.get("speedMultiplier", 1.0))
	var allowed: Array = info.unlockedAttacks
	var skills: Array = []
	for s: Dictionary in base_def.skills:
		if allowed.has(s.id):
			skills.append(s)
	def.skills = skills
	if not casting.is_empty() and not allowed.has(str(casting.skill.id)):
		casting = {}
	if boss_phase > 1:
		manager.say("Faza %d: %s" % [boss_phase, str(info.name)])
	boss_script.phase_entered(boss_phase)
	flying = boss_script.is_flyer()

func boss_damage_taken() -> float:
	if boss.is_empty():
		return 1.0
	var table := 1.0
	for p: Dictionary in boss.phases:
		if int(p.phaseNumber) == boss_phase:
			table = float((p.get("statModifiers", {}) as Dictionary).get("damageTakenMultiplier", 1.0))
	return boss_script.damage_mult(table) if boss_script.overrides_damage() else table

func sound_id() -> String:
	return str(def.get("sound", def.id))

func traits() -> Dictionary:
	return def.traits

func is_marked() -> bool:
	return clock < marked_until

# ---- the interface the kits call -------------------------------------------------------------

## Damage from the hero: the annex model max(1, raw × multipliers − DEF/2) with the monster's weaknesses and traits.
func hurt(raw: float, _crit: bool, tags: Array = [], _ranged: bool = false) -> float:
	if phase == "dead" or concealed or invulnerable:
		return 0.0
	var mult := 1.0
	var weak: Dictionary = def.weak
	for tag in tags:
		if weak.has(str(tag)):
			var w := float(weak[str(tag)])
			mult = maxf(mult, w) if w >= 1.0 else minf(mult, w)
	if clock < sealed_until:
		mult *= 1.0 + seal_bonus
	var hero_at: Vector2 = manager.player_position()
	var to_hero := (hero_at - position).normalized()
	var rel := facing.dot(to_hero)
	if traits().has("frontArmor") and rel > 0.5:
		mult *= 1.0 - float(traits().frontArmor)
	if traits().has("backBonus") and rel < -0.5:
		mult *= 1.0 + float(traits().backBonus)
	if traits().has("exposedBonus") and (clock < exposed_until or clock < turret_off_until or retreat_until > clock):
		mult *= 1.0 + float(traits().exposedBonus)
	if traits().has("burrow") and burrow_phase == "up":
		mult *= 1.0 + float(traits().burrow.bonus)
	if clock < curl_until and not tags.has("ki") and traits().has("curl"):
		mult *= 1.0 - float(traits().curl.reduce)
	if clock < reduce_until:
		mult *= 1.0 - reduce
	mult *= boss_damage_taken()
	var defense := float(def.def)
	if clock < marked_until:
		defense *= 1.0 - mark_def
	var amount := maxf(1.0, raw * mult - defense / 2.0)
	if guard > 0.0:
		var soaked := minf(guard, amount)
		guard -= soaked
		amount -= soaked
		if amount <= 0.0:
			return 0.0
	hp = maxf(0.0, hp - amount)
	since_hit = 0.0
	flash = 0.2
	provoked = true
	hits_taken += 1
	if phase == "idle" or phase == "return":
		engage()
	var indirect := tags.has("indirect")
	if traits().has("reflect") and not tags.has("ki") and not indirect:
		manager.hurt_player(self, amount * float(traits().reflect), "other", [])
	if traits().has("curl") and hits_taken % int(traits().curl.hits) == 0:
		curl_until = clock + float(traits().curl.ms) / 1000.0
	if traits().has("fleeAfterHits") and not indirect:
		flee_hits += 1
		if flee_hits >= int(traits().fleeAfterHits.hits):
			flee_hits = 0
			retreat_until = clock + float(traits().fleeAfterHits.ms) / 1000.0
	if traits().has("brittleTail") and hits_taken >= int(traits().brittleTail):
		tail_broken = true
	if not casting.is_empty() and traits().has("interrupt") and amount >= max_hp * float(traits().interrupt.pct):
		stun(float(traits().interrupt.stun) / 1000.0)
		manager.say("%s traci koncentrację." % label)
	if traits().has("split") and not split_done and hp > 0.0:
		do_split()
	if hp > 0.0 and not boss.is_empty():
		update_boss_phase()
	if hp <= 0.0:
		if traits().has("revive") and not revived:
			begin_revive()
		else:
			die()
	elif randf() < 0.12:
		actor.play_once("hit")
	return amount

func burn(dps: float, seconds: float) -> void:
	burn_dps = dps
	burning = seconds

func stun(seconds: float) -> void:
	if not boss.is_empty():
		seconds *= 0.25   # bosses resist control: a quarter of the stun, no chain-locking
		if seconds < 0.1:
			return
	stunned = maxf(stunned, seconds)
	casting = {}

func slow(fraction: float, seconds: float) -> void:
	if not boss.is_empty():
		fraction *= 0.5
	slow_pct = maxf(slow_pct, fraction)
	slowed = maxf(slowed, seconds)

func seal(seconds: float, vulnerability: float) -> void:
	sealed_until = clock + seconds
	seal_bonus = vulnerability

func mark(seconds: float, _crit: float, share: float) -> void:
	marked_until = clock + seconds
	mark_def = share

func push(from: Vector2, distance: float) -> void:
	if not boss.is_empty():
		return
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
	if traits().has("ambush") and concealed:
		concealed = false
	if traits().has("burrow") and burrow_phase == "":
		burrow_phase = "up"
		burrow_left = float(traits().burrow.up) / 1000.0

func begin_revive() -> void:
	revived = true
	invulnerable = true
	hp = 1.0
	casting = {}
	actor.play_once("death")
	manager.say("%s odradza się…" % label)
	var tween := create_tween()
	tween.tween_interval(1.8)
	tween.tween_callback(func() -> void:
		if phase == "dead":
			return
		hp = max_hp * float(traits().revive)
		invulnerable = false
		actor.play_once("respawn"))

func die() -> void:
	phase = "dead"
	casting = {}
	dash = {}
	leap = {}
	concealed = false
	if boss_script != null:
		boss_script.cleanup()
	if traits().has("explode"):
		var boom: Dictionary = traits().explode
		manager.puff(position, float(boom.radius))
		if position.distance_to(target_pos()) <= float(boom.radius):
			manager.hurt_player(self, float(def.atk) * float(boom.atk), "area", [])
	if traits().has("deathZone"):
		manager.add_zone(traits().deathZone, position, float(def.atk), self)
	if split_partner != null and is_instance_valid(split_partner):
		split_partner.split_partner = null
	actor.play_once("death")
	manager.audio().monster_sound(sound_id(), "die", position.distance_to(target_pos()))
	died.emit(self)
	var tween := create_tween()
	tween.tween_interval(1.4)
	tween.tween_property(actor, "modulate:a", 0.0, 0.6)
	tween.tween_callback(queue_free)

func do_split() -> void:
	var rule: Dictionary = traits().split
	split_done = true
	split_orig_max = max_hp
	var part := maxf(1.0, roundf(max_hp * float(rule.hpPct)))
	max_hp = part
	hp = minf(hp, part)
	var clone: PyraMonster = manager.spawn_clone(self, position + Vector2(34, 22), part)
	split_partner = clone
	clone.split_partner = self
	split_merge_at = clock + float(rule.merge) / 1000.0
	manager.say("%s rozdziela się!" % label)

func merge_back() -> void:
	if split_partner == null or not is_instance_valid(split_partner) or split_partner.phase == "dead":
		split_partner = null
		return
	max_hp = split_orig_max
	hp = minf(max_hp, hp + split_partner.hp)
	manager.say("%s łączy się z powrotem." % label)
	manager.forget(split_partner)
	split_partner.queue_free()
	split_partner = null

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
	if traits().has("webSlow") and not manager.in_own_web(self):
		speed *= float(traits().webSlow)
	return BASE_SPEED * speed

func can_walk(to: Vector2) -> bool:
	if traits().get("fly", false) or traits().get("ghost", false) or burrow_phase == "under" or flying:
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
		hurt(burn_dps * delta, false, ["indirect"])
		if phase == "dead":
			return
	if slowed > 0.0:
		slowed -= delta
		if slowed <= 0.0:
			slow_pct = 0.0
	if retreat_until > 0.0 and clock >= retreat_until:
		retreat_until = 0.0
	if split_partner != null and split_merge_at > 0.0 and clock >= split_merge_at:
		split_merge_at = 0.0
		merge_back()
	if ramp_stacks > 0 and clock - ramp_clock > 4.0:
		ramp_stacks = 0
	actor.visible = not concealed
	if boss_script != null:
		boss_script.tick(delta)
		actor.position.y = lerpf(actor.position.y, -44.0 if flying else 0.0, minf(1.0, delta * 3.0))
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
	shown_hp = lerpf(shown_hp, hp / max_hp, minf(1.0, delta * 8.0))
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
			if not bool(dash.hit) and float(dash.missStun) > 0.0:
				stun(float(dash.missStun) / 1000.0)
				exposed_until = clock + float(dash.missStun) / 1000.0 + 0.5
				exposed_pct = float(dash.exposed)
			dash = {}
	if not leap.is_empty():
		leap.t = float(leap.t) + delta
		var k: float = clampf(float(leap.t) / float(leap.duration), 0.0, 1.0)
		position = (leap.from as Vector2).lerp(leap.to, k)
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
	if phase == "engage" and not concealed:
		if traits().has("trail"):
			trail_clock -= delta
			if trail_clock <= 0.0:
				trail_clock = 0.45
				manager.add_zone(traits().trail, position, float(def.atk), self)
		if traits().has("webs"):
			web_clock -= delta
			if web_clock <= 0.0:
				web_clock = 6.0
				manager.lay_web(self, traits().webs)

func think(delta: float) -> void:
	if not leap.is_empty() or not dash.is_empty():
		return
	var player := target_pos()
	var distance := position.distance_to(player)
	var leash := float(traits().get("leash", 400))
	if burrow_phase != "" and tick_burrow(delta, player):
		return
	match phase:
		"idle":
			if traits().has("ambush"):
				concealed = true
				if clock >= ambush_hidden_until and distance <= float(traits().ambush.reveal) and not player_safe() and not manager.player_dead():
					engage()
				return
			if traits().get("still", false):
				actor.animate(Vector2.ZERO)
			elif traits().has("route"):
				follow_route(delta)
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
				if traits().has("ambush"):
					concealed = true
				return
			var back := home - position
			step_to(home, speed_px() * 1.4 * delta)
			actor.animate(back)
			if hp < max_hp:
				hp = minf(max_hp, hp + max_hp * 0.15 * delta)

## Burrowers: surfaced for `up` ms (vulnerable), then underground for `under` ms (untouchable, travelling to the hero), then
## up again next to the hero. Returns true while the monster is underground (no other behaviour then).
func tick_burrow(delta: float, player: Vector2) -> bool:
	if phase != "engage":
		return false
	var rule: Dictionary = traits().burrow
	burrow_left -= delta
	if burrow_phase == "up" and burrow_left <= 0.0:
		burrow_phase = "under"
		burrow_left = float(rule.under) / 1000.0
		concealed = true
		invulnerable = true
		casting = {}
	elif burrow_phase == "under":
		step_to(player, speed_px() * 2.2 * delta)
		if burrow_left <= 0.0:
			burrow_phase = "up"
			burrow_left = float(rule.up) / 1000.0
			concealed = false
			invulnerable = false
			position = player + Vector2.from_angle(randf() * TAU) * 70.0
			actor.play_once("respawn")
		return burrow_phase == "under"
	return false

func follow_route(delta: float) -> void:
	var route: Array = traits().route
	var point := home + Vector2(float(route[route_index][0]), float(route[route_index][1]))
	if position.distance_to(point) < 14.0:
		route_index = (route_index + 1) % route.size()
		return
	step_to(point, speed_px() * 0.5 * delta)
	actor.animate(point - position)

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
	var turret: Variant = traits().get("turret", null)
	if turret != null:
		fight_turret(turret, distance, delta, player)
		return
	face_toward(player)
	var reach := float(def.range)
	var keep := float(traits().get("keep", 0.0))
	var skill := pick_skill(distance)
	if not skill.is_empty():
		begin_cast(skill, player)
		return
	if keep > 0.0 and distance < keep * 0.8:
		var away := (position - player).normalized()
		step_to(position + away * 60.0, speed_px() * delta)
		actor.animate(-away)
		return
	var can_basic := String(def.basic) != "none"
	if can_basic and distance <= reach and clock >= attack_ready:
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

## Turrets never move: they turn towards the hero, fire only when aimed within their arc, overheat after a number of shots and
## stay open (extra damage taken) while switched off.
func fight_turret(turret: Dictionary, distance: float, delta: float, player: Vector2) -> void:
	actor.animate(Vector2.ZERO)
	if clock < turret_off_until:
		return
	var want_angle := (player - position).angle()
	var turn := deg_to_rad(float(turret.turn)) * delta
	var diff := wrapf(want_angle - facing.angle(), -PI, PI)
	facing = Vector2.from_angle(facing.angle() + clampf(diff, -turn, turn))
	actor.face(facing)
	if absf(diff) > deg_to_rad(20.0):
		return
	for s: Dictionary in def.skills:
		if clock >= float(cooldowns.get(str(s.id), 0.0)) and distance <= float(s.range):
			cooldowns[str(s.id)] = clock + float(s.cd) / 1000.0
			actor.play_once("attack")
			var count := maxi(1, int(s.get("volley", 1)))
			for i in count:
				volley.append({"wait": 0.12 * i, "dmg": float(s.get("dmg", 1.0)), "fx": s.get("fx", [])})
			turret_shots += count
			if turret_shots >= int(turret.shots):
				turret_shots = 0
				turret_off_until = clock + float(turret.off) / 1000.0
				manager.say("%s się przegrzewa." % label)
			return

func pick_skill(distance: float) -> Dictionary:
	var wounded_ally: bool = traits().has("medic") and manager.hurt_ally_near(self, float(traits().medic) + 120.0)
	for s: Dictionary in def.skills:
		var id := str(s.id)
		if clock < float(cooldowns.get(id, 0.0)):
			continue
		if bool(s.get("once", false)) and used.has(id):
			continue
		if s.has("below") and hp / max_hp >= float(s.below):
			continue
		if tail_broken and str(s.mode) == "melee" and traits().has("brittleTail"):
			continue
		if str(s.mode) == "self":
			if s.has("call") and distance < 600.0 and not used.has(id):
				return s
			if s.has("summon") and distance < 700.0:
				return s
			if s.has("heal"):
				if wounded_ally or hp < max_hp * 0.8:
					return s
				continue
			if s.has("buff") or s.has("guard") or s.has("reduce") or s.has("nextAttack"):
				if distance <= float(s.get("range", 400)) + 200.0:
					return s
			continue
		if distance <= float(s.range):
			return s
	return {}

func begin_cast(skill: Dictionary, player: Vector2) -> void:
	var id := str(skill.id)
	cooldowns[id] = clock + float(skill.cd) / 1000.0
	if bool(skill.get("once", false)):
		used[id] = true
	var warn := float(skill.get("telegraph", 0.0)) / 1000.0
	var mode := str(skill.mode)
	if warn <= 0.0:
		warn = 0.35 if mode != "self" else 0.2
	var at := position if bool(skill.get("centred", false)) else player
	casting = {"skill": skill, "left": warn, "total": warn, "at": at, "from": position, "player": player}
	if boss_script != null:
		boss_script.begin_cast(skill, player)
	manager.audio().monster_sound(sound_id(), "atk", position.distance_to(player))
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
	count_dive()

## Divers strike a few times and fly away for a while.
func count_dive() -> void:
	if traits().has("dive"):
		dive_count += 1
		if dive_count >= int(traits().dive.attacks):
			dive_count = 0
			retreat_until = clock + float(traits().dive.away) / 1000.0
	if traits().has("ambush") and phase == "engage" and not concealed:
		concealed = true
		phase = "return"
		ambush_hidden_until = clock + float(traits().ambush.hide) / 1000.0

func resolve(skill: Dictionary, at: Vector2) -> void:
	var mult := float(skill.get("dmg", 1.0))
	var fx: Array = skill.get("fx", [])
	var player := target_pos()
	var opener := float(skill.get("opener", 1.0))
	if boss_script != null and boss_script.resolve(skill, at):
		return
	match str(skill.mode):
		"melee":
			if position.distance_to(player) <= float(skill.range) + 50.0:
				manager.hurt_player(self, float(def.atk) * mult * damage_scale() * opener, "melee", fx)
		"ranged":
			var shots := maxi(1, int(skill.get("volley", 1)))
			for i in shots:
				volley.append({"wait": 0.14 * i, "dmg": mult * damage_scale(), "fx": fx})
		"burst":
			var radius := float(skill.get("radius", 120.0))
			manager.puff(at, radius)
			if mult > 0.0 and player.distance_to(at) <= radius:
				manager.hurt_player(self, float(def.atk) * mult * damage_scale(), "area", fx)
			elif mult <= 0.0 and player.distance_to(at) <= radius and not fx.is_empty():
				manager.apply_effects(fx, self)
			if skill.has("zone"):
				manager.add_zone(skill.zone, at, float(def.atk), self)
		"leap":
			var landing := at
			if not can_walk(landing):
				landing = position
			leap = {"from": position, "to": landing, "t": 0.0, "duration": 0.38, "radius": float(skill.get("radius", 95.0)), "dmg": mult * damage_scale(), "fx": fx}
		"charge":
			var direction := (at - position).normalized()
			dash = {"dir": direction, "speed": 620.0, "left": float(skill.range) + 120.0, "dmg": mult * damage_scale(), "fx": fx, "hit": false, "missStun": float(skill.get("missStun", 0.0)), "exposed": float(skill.get("exposed", 0.0))}
		"self":
			if skill.has("call"):
				manager.call_allies(self, 600.0, int(skill.call))
			if skill.has("guard"):
				guard = max_hp * float(skill.guard.pct)
			if skill.has("reduce"):
				reduce = float(skill.reduce.pct)
				reduce_until = clock + float(skill.reduce.ms) / 1000.0
			if skill.has("heal"):
				manager.heal_allies(self, float(skill.get("range", 300)), float(skill.heal.pct))
			if skill.has("summon"):
				manager.summon(self, str(skill.summon.kind), int(skill.summon.count))
			if skill.has("buff"):
				buff_pct = float(skill.buff.pct)
				buff_until = clock + float(skill.buff.ms) / 1000.0
				manager.puff(position, 90.0)
			if skill.has("nextAttack"):
				ramp_stacks = mini(4, ramp_stacks + 1)
				ramp_clock = clock

func damage_scale() -> float:
	var rage: Variant = traits().get("rage", null)
	var scale := 1.0
	if rage != null:
		scale += float(rage.dmg) * clampf((0.7 - hp / max_hp) / 0.4, 0.0, 1.0)
	if traits().has("ramp"):
		scale += float(traits().ramp) * ramp_stacks
	if clock < buff_until:
		scale += buff_pct
	return scale

func basic_attack(player: Vector2) -> void:
	var interval := float(def.attackCd) / 1000.0
	var rage: Variant = traits().get("rage", null)
	if rage != null and hp / max_hp < float(rage.below):
		interval /= 1.0 + float(rage.speed)
	attack_ready = clock + interval
	actor.play_once("attack")
	manager.audio().monster_sound(sound_id(), "atk", position.distance_to(player))
	var scale := damage_scale()
	if traits().has("ramp"):
		ramp_stacks = mini(4, ramp_stacks + 1)
		ramp_clock = clock
	if String(def.basic) == "ranged":
		var tween := create_tween()
		tween.tween_interval(0.25)
		tween.tween_callback(func() -> void:
			if phase != "dead" and stunned <= 0.0:
				fire(scale, def.get("basicFx", [])))
	else:
		var tween2 := create_tween()
		tween2.tween_interval(0.25)
		tween2.tween_callback(func() -> void:
			if phase != "dead" and stunned <= 0.0 and position.distance_to(target_pos()) <= float(def.range) + 40.0:
				manager.hurt_player(self, float(def.atk) * scale, "melee", def.get("basicFx", [])))
	count_dive()

func fire(mult: float, fx: Array) -> void:
	manager.shoot(self, position + Vector2(0, -float(def.actor.size[1]) * 0.4), target_pos(), float(def.atk) * mult, fx)

# ---- drawing: health bar, name, telegraphs ---------------------------------------------------

func _draw() -> void:
	if phase == "dead" or concealed:
		return
	var top := -float(def.actor.size[1]) * 0.95 * DRAW_SCALE - 8.0
	if shown_hp < 0.999 or phase == "engage":
		var width := 64.0 if boss.is_empty() else 150.0
		draw_rect(Rect2(-width / 2.0 - 1.0, top - 1.0, width + 2.0, 8.0), Color(0.04, 0.02, 0.02, 0.85))
		draw_rect(Rect2(-width / 2.0, top, width * shown_hp, 6.0), Color("d9482b") if shown_hp > 0.3 else Color("f08a2a"))
		if guard > 0.0:
			draw_rect(Rect2(-width / 2.0, top + 6.0, width * clampf(guard / max_hp, 0.0, 1.0), 2.0), Color("9fe3ff"))
	var font: Font = ThemeDB.fallback_font
	var tag := "%s  poz. %d" % [label, int(def.level)]
	if not boss.is_empty():
		tag = "%s · faza %d" % [label, boss_phase]
	var w := font.get_string_size(tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	draw_string_outline(font, Vector2(-w / 2.0, top - 6.0), tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 5, Color(0.05, 0.02, 0.02, 0.95))
	draw_string(font, Vector2(-w / 2.0, top - 6.0), tag, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color("ffd9c8"))
	if clock < curl_until:
		draw_arc(Vector2(0, -20), 38.0, 0, TAU, 28, Color(0.7, 0.8, 1.0, 0.8), 3.0, true)
	if boss_script != null:
		boss_script.draw(self)
	if clock < buff_until:
		draw_arc(Vector2(0, -40), 56.0, 0, TAU, 32, Color(1.0, 0.55, 0.15, 0.85), 4.0, true)
	if not casting.is_empty():
		var skill: Dictionary = casting.skill
		var mode := str(skill.mode)
		var warn := maxf(0.05, float(casting.total))
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
