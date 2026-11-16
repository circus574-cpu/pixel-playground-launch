class_name PyraBossScript
extends RefCounted
## The signature mechanics of the eight bosses. The browser game plays phases, attack lists and damage multipliers from
## `src/game/bosses/catalog.ts`; its catalogue text promises more (regeneration, helpers, barriers, closing arena, safe zones,
## overheating, pillars, burning floor). Those promises are played here, per boss, on top of the same data. Numbers that the
## catalogue does not give (zone damage, ring speed, pillar count) are authored for the port and listed in the README.

const FLYERS := ["aurelith", "pyrrhax"]

var boss: PyraMonster
var id := ""
var manager: Node
var lights: Array = []           # arcykaplan: the three lights that carry the barrier
var drones: Array = []
var pillars: Array = []
var ring: ArenaRing
var overheat_clock := 0.0
var fire_clock := 0.0
var safe_spots: Array[Vector2] = []
var breath_to := Vector2.ZERO
var breath_from := Vector2.ZERO
var barrier_announced := false

func _init(monster: PyraMonster, boss_id: String) -> void:
	boss = monster
	id = boss_id
	manager = monster.manager

## Attack lists as the browser translates them, plus the ground zones the catalogue text describes.
static func augment(boss_id: String, skills: Array) -> Array:
	var out: Array = []
	for s: Dictionary in skills:
		var skill := s.duplicate(true)
		match str(skill.id):
			"arcykaplan-pieczec":
				skill["zone"] = {"kind": "void", "ms": 5000, "radius": 250, "dps": 0.16}
			"pyrrhax-deszcz":
				skill["zone"] = {"kind": "lava", "ms": 4000, "radius": 140, "dps": 0.14}
			"pyrrhax-fala":
				skill["zone"] = {"kind": "fire", "ms": 2500, "radius": 150, "dps": 0.1}
			"ygdrasha-burza":
				skill["zone"] = {"kind": "poison", "ms": 5000, "radius": 250, "dps": 0.1, "fx": [{"k": "dot", "id": "poison", "atkPct": 0.08, "ms": 3000}]}
			"thorgar-wycie":
				skill["fx"] = [{"k": "blind", "pct": 0.35, "ms": 3000}]
		out.append(skill)
	return out

func is_flyer() -> bool:
	return FLYERS.has(id) and boss.boss_phase >= 2

func blocks_healing() -> bool:
	return id == "kharzul" and boss.boss_phase >= 3 and boss.phase == "engage"

## True when the script supplies the whole damage-taken multiplier (barrier, overheating) instead of the phase table.
func overrides_damage() -> bool:
	return id == "arcykaplan-pustki" or id == "arbiter-zero"

func damage_mult(phase_mult: float) -> float:
	match id:
		"arcykaplan-pustki":
			return 0.3 if boss.boss_phase == 2 and barrier_up() else 1.0
		"arbiter-zero":
			if boss.boss_phase == 1:
				return 0.85
			if boss.boss_phase == 3:
				return 1.4 if overheat_clock >= 20.0 else 1.0
			return 1.0
	return phase_mult

func barrier_up() -> bool:
	for light: Variant in lights:
		if is_instance_valid(light) and (light as PyraMonster).phase != "dead":
			return true
	return false

func overheated() -> bool:
	return id == "arbiter-zero" and boss.boss_phase == 3 and overheat_clock >= 20.0

func phase_entered(n: int) -> void:
	match id:
		"arcykaplan-pustki":
			if n == 2:
				lights = manager.summon_kind(boss, "aether-swietlik-pieczeci", 3)
				manager.say("Bariera Odwrócenia KI! Zniszcz trzy Świetliki, aby ją przełamać.")
			elif n == 3:
				ring = ArenaRing.new()
				ring.setup(manager, boss.home, float(boss.def.atk))
				manager.game.fx_parent().add_child(ring)
				manager.say("Zamknięcie Areny — krąg się zaciska!")
		"arbiter-zero":
			if n == 2:
				drones = manager.summon_kind(boss, "nexus-dron-zwiadowca", 2)
			elif n == 3:
				overheat_clock = 0.0
				manager.say("Arbiter się przegrzewa — bez tarczy, ale z napięciem.")
		"aurelith":
			if n == 2:
				manager.say("Aurelith unosi się nad areną.")
			elif n == 3:
				for i in 3:
					var pillar := Pillar.new()
					pillar.position = boss.home + Vector2.from_angle(TAU * (i + randf() * 0.5) / 3.0) * randf_range(240.0, 340.0)
					manager.game.monster_parent().add_child(pillar)
					pillars.append(pillar)
				manager.say("Filary Sanktuarium: schowaj się za nimi przed Oddechem Eteru.")
		"pyrrhax":
			if n == 2:
				manager.say("Pyrrhax wzbija się nad krater.")
			elif n == 3:
				manager.say("Erupcja! Szukaj bezpiecznych kręgów na ziemi.")
		"thorgar":
			if n == 3:
				boss.used.erase("thorgar-wycie")
				boss.cooldowns["thorgar-wycie"] = 0.0
				manager.say("Thorgar wpada w szał!")
		"kharzul":
			if n == 2:
				manager.say("Płomienny szał Kharzula!")
			elif n == 3:
				manager.say("Arena płonie — płomienie blokują leczenie.")
		"ygdrasha":
			if n == 3:
				manager.say("Kielich Ygdrashy rozkwita — jest odsłonięty.")

func tick(delta: float) -> void:
	match id:
		"ygdrasha":
			if boss.boss_phase <= 2 and boss.phase == "engage":
				boss.hp = minf(boss.max_hp, boss.hp + boss.max_hp * 0.01 * delta)
		"arcykaplan-pustki":
			if boss.boss_phase == 2 and not barrier_announced and not barrier_up() and not lights.is_empty():
				barrier_announced = true
				manager.say("Bariera pęka! Arcykapłan jest bezbronny.")
		"arbiter-zero":
			if boss.boss_phase == 3 and boss.phase == "engage":
				overheat_clock = fmod(overheat_clock + delta, 30.0)
				if overheat_clock - delta < 20.0 and overheat_clock >= 20.0:
					manager.say("PRZEGRZANIE — Arbiter przyjmuje więcej obrażeń!")
		"kharzul":
			if boss.boss_phase == 3 and boss.phase == "engage":
				fire_clock -= delta
				if fire_clock <= 0.0:
					fire_clock = 3.2
					var at: Vector2 = manager.player_position() + Vector2.from_angle(randf() * TAU) * randf_range(0.0, 170.0)
					manager.add_zone({"kind": "fire", "ms": 6000, "radius": 120, "dps": 0.2, "delay": 1.1}, at, float(boss.def.atk))
	if boss.phase == "return" or boss.phase == "idle":
		if ring != null:
			ring.visible = false
	elif ring != null:
		ring.visible = true

## Prepares the telegraph of attacks that need a plan from the hero.
func begin_cast(skill: Dictionary, player: Vector2) -> void:
	match str(skill.id):
		"pyrrhax-erupcja":
			safe_spots.clear()
			var centre := boss.position
			for i in 3:
				var spot := player + Vector2.from_angle(TAU * (i + randf() * 0.4) / 3.0) * (60.0 if i == 0 else randf_range(180.0, 380.0))
				if spot.distance_to(centre) > 600.0:
					spot = centre + (spot - centre).normalized() * 600.0
				safe_spots.append(spot)
		"aurelith-oddech":
			breath_from = boss.position
			breath_to = player

## Returns true when the attack was played here instead of by the generic resolver.
func resolve(skill: Dictionary, at: Vector2) -> bool:
	var player: Vector2 = manager.player_position()
	match str(skill.id):
		"pyrrhax-erupcja":
			manager.puff(boss.position, 600.0)
			var safe := false
			for spot in safe_spots:
				safe = safe or player.distance_to(spot) <= 150.0
			if not safe:
				manager.hurt_player(boss, float(boss.def.atk) * float(skill.get("dmg", 2.5)) * boss.damage_scale(), "area", [])
			else:
				manager.say("Schowałeś się w bezpiecznym kręgu.")
			safe_spots.clear()
			return true
		"aurelith-oddech":
			var dir := (breath_to - breath_from).normalized()
			var end := breath_from + dir * 760.0
			manager.puff(breath_to, 90.0)
			var hit := _distance_to_segment(player, breath_from, end) <= 70.0
			if hit:
				for pillar in pillars:
					if is_instance_valid(pillar) and _distance_to_segment((pillar as Node2D).position, breath_from, player) <= 46.0 and (pillar as Node2D).position.distance_to(breath_from) < player.distance_to(breath_from):
						hit = false
			if hit:
				manager.hurt_player(boss, float(boss.def.atk) * float(skill.get("dmg", 2.4)) * boss.damage_scale(), "area", [])
			elif _distance_to_segment(player, breath_from, end) <= 70.0:
				manager.say("Filar przyjął Oddech Eteru.")
			return true
		"thorgar-wycie":
			if boss.boss_phase < 3:
				manager.summon_kind(boss, "verdant-cierniowy-wilk", 3)
			if player.distance_to(boss.position) <= 600.0:
				manager.apply_effects(skill.get("fx", []), boss)
			manager.puff(boss.position, 250.0)
			return true
	return false

func draw(canvas: Node2D) -> void:
	if not safe_spots.is_empty() and not boss.casting.is_empty():
		for spot in safe_spots:
			var local := canvas.to_local(spot)
			canvas.draw_circle(local, 150.0, Color(0.35, 0.95, 0.5, 0.20))
			canvas.draw_arc(local, 150.0, 0, TAU, 40, Color(0.5, 1.0, 0.6, 0.95), 3.0, true)
	if str(boss.casting.get("skill", {}).get("id", "")) == "aurelith-oddech":
		var from_l := canvas.to_local(breath_from)
		var to_l := canvas.to_local(breath_from + (breath_to - breath_from).normalized() * 760.0)
		var k := 1.0 - clampf(float(boss.casting.left) / maxf(0.05, float(boss.casting.total)), 0.0, 1.0)
		canvas.draw_line(from_l, to_l, Color(1.0, 0.85, 0.3, 0.18 + 0.35 * k), 120.0)
	if overheated():
		canvas.draw_arc(Vector2(0, -60), 70.0, 0, TAU, 32, Color(1.0, 0.35, 0.1, 0.9), 4.0, true)

func cleanup() -> void:
	for pillar in pillars:
		if is_instance_valid(pillar):
			(pillar as Node).queue_free()
	pillars.clear()
	if ring != null and is_instance_valid(ring):
		ring.queue_free()
	for helper in lights + drones:
		if is_instance_valid(helper) and (helper as PyraMonster).phase != "dead":
			(helper as PyraMonster).hurt(999999.0, false, ["indirect"])

static func _distance_to_segment(p: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var len2 := ab.length_squared()
	if len2 < 0.001:
		return p.distance_to(a)
	var t := clampf((p - a).dot(ab) / len2, 0.0, 1.0)
	return p.distance_to(a + ab * t)

## A stone pillar of the Sanctuary: blocks the Breath of Aether for whoever stands behind it.
class Pillar extends Node2D:
	func _draw() -> void:
		draw_rect(Rect2(-20, -92, 40, 92), Color(0.78, 0.74, 0.62))
		draw_rect(Rect2(-26, -100, 52, 12), Color(0.9, 0.86, 0.72))
		draw_rect(Rect2(-26, -10, 52, 10), Color(0.62, 0.58, 0.48))
		draw_line(Vector2(-8, -90), Vector2(-8, -10), Color(0.55, 0.5, 0.4), 2.0)
		draw_line(Vector2(8, -90), Vector2(8, -10), Color(0.55, 0.5, 0.4), 2.0)

## The closing ring of the arena: standing outside it burns.
class ArenaRing extends Node2D:
	const START := 700.0
	const END := 320.0
	const SECONDS := 28.0
	var manager: Node
	var centre := Vector2.ZERO
	var atk := 1.0
	var age := 0.0
	var tick := 0.0

	func setup(parent_manager: Node, at: Vector2, attack: float) -> void:
		manager = parent_manager
		centre = at
		position = at
		atk = attack

	func radius() -> float:
		return lerpf(START, END, clampf(age / SECONDS, 0.0, 1.0))

	func _process(delta: float) -> void:
		if not visible:
			return
		age += delta
		tick -= delta
		if tick <= 0.0:
			tick = 0.5
			if manager.player_position().distance_to(centre) > radius():
				manager.game.zone_hit(atk * 0.12 * 0.5, [], atk, centre)
		queue_redraw()

	func _draw() -> void:
		var r := radius()
		draw_arc(Vector2.ZERO, r, 0, TAU, 96, Color(0.75, 0.4, 1.0, 0.9), 6.0, true)
		draw_arc(Vector2.ZERO, r + 40.0, 0, TAU, 96, Color(0.55, 0.25, 0.9, 0.35), 40.0, true)
