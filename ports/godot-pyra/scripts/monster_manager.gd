class_name PyraMonsters
extends Node
## Spawns of one land (the published registry `spawns.json`, 8 752 slots over the ten lands): activates the slots near the hero
## (at most 24 monsters, two per update), puts far idle ones back to sleep, keeps killed slots on their respawn timer, and is the
## bridge between the monsters and the game (hurt the hero, projectiles, rewards). Safe cities have no monsters and monsters
## never enter them.

const SHEET_PREFETCH := true

var game: PyraGame
var defs: Dictionary = {}
var kinds: Array = []
var rows: Array = []
var activation := {"radius": 1400.0, "sleepBeyond": 1900.0, "maximumActive": 24, "maximumPerFrameActivations": 2}
var active: Dictionary = {}          # slot index -> PyraMonster
var respawn_at: Dictionary = {}      # slot index -> clock when it may wake again
var cells: Dictionary = {}           # "cx,cy" -> Array of slot indices
var clock := 0.0
var timer := 0.0
var drop_chance := 0.02
var minion_seq := 0
var webs: Dictionary = {}            # monster instance id -> Array of web zones

func setup(owner_game: PyraGame, monster_data: Dictionary, land_spawns: Dictionary) -> void:
	game = owner_game
	active = {}
	respawn_at = {}
	cells = {}
	clock = 0.0
	timer = 0.0
	minion_seq = 0
	webs = {}
	defs = monster_data.monsters
	drop_chance = float(monster_data.dropChance)
	kinds = land_spawns.kinds
	rows = land_spawns.spawns
	activation = land_spawns.activation
	for i in rows.size():
		var key := "%d,%d" % [int(float(rows[i][1]) / 2048.0), int(float(rows[i][2]) / 2048.0)]
		if not cells.has(key):
			cells[key] = []
		(cells[key] as Array).append(i)
	for kind: String in kinds:
		if defs.has(kind):
			var sheet := str((defs[kind].actor.clips.idle as Dictionary).sheet)
			if not ResourceLoader.has_cached(sheet):
				ResourceLoader.load_threaded_request(sheet)

func _process(delta: float) -> void:
	clock += delta
	timer -= delta
	if timer <= 0.0:
		timer = 0.25
		refresh()

## Wake the slots around the hero, sleep the far ones.
func refresh() -> void:
	if game.in_dungeon():
		return   # a dungeon has its own, fixed guards
	var p := player_position()
	var radius := float(activation.radius)
	var sleep_at := float(activation.sleepBeyond)
	for index: int in active.keys():
		var m: PyraMonster = active[index]
		if not is_instance_valid(m):
			active.erase(index)
		elif m.position.distance_to(p) > sleep_at and m.phase != "engage":
			m.queue_free()
			active.erase(index)
	if player_is_safe() or player_dead():
		return
	var woken := 0
	var cx := int(p.x / 2048.0)
	var cy := int(p.y / 2048.0)
	for dy in range(-1, 2):
		for dx in range(-1, 2):
			var list: Array = cells.get("%d,%d" % [cx + dx, cy + dy], [])
			for index: int in list:
				if active.has(index) or clock < float(respawn_at.get(index, 0.0)):
					continue
				if active.size() >= int(activation.maximumActive) or woken >= int(activation.maximumPerFrameActivations):
					return
				var row: Array = rows[index]
				var at := Vector2(float(row[1]), float(row[2]))
				if at.distance_to(p) > radius or in_safe_city(at):
					continue
				var kind := str(kinds[int(row[0])])
				if not defs.has(kind):
					continue
				wake(index, kind, at)
				woken += 1

func wake(index: int, kind: String, at: Vector2) -> void:
	var monster := PyraMonster.new()
	game.monster_parent().add_child(monster)
	monster.setup(defs[kind], at, self, index)
	monster.died.connect(on_died)
	active[index] = monster
	var pack: Variant = defs[kind].traits.get("pack", null)
	if pack != null:
		# wolves and bats come in packs: the slot monster plus a few members around it (no respawn slot of their own)
		var members := int(pack[0]) + randi() % (int(pack[1]) - int(pack[0]) + 1)
		for i in range(1, members):
			if active.size() >= int(activation.maximumActive):
				break
			var angle := TAU * i / float(members)
			var mate := place_monster(kind, at + Vector2.from_angle(angle) * 55.0)
			mate.home = at

func on_died(monster: PyraMonster) -> void:
	active.erase(monster.spawn_index)
	if monster.spawn_index >= 0:
		var wait := float(monster.def.respawn) / 1000.0
		if monster.spawn_index < rows.size() and float(rows[monster.spawn_index][4]) > 0.0:
			wait = float(rows[monster.spawn_index][4]) / 1000.0
		respawn_at[monster.spawn_index] = clock + maxf(wait, 8.0)
	if not monster.no_reward:
		game.reward(monster.def, monster.position)
	if not monster.boss.is_empty():
		game.boss_defeated(monster.boss, monster.position)

## Frees every monster (before the hero goes underground, and again when he returns).
func clear_all() -> void:
	for m: PyraMonster in active.values():
		if is_instance_valid(m):
			m.queue_free()
	active.clear()
	webs.clear()

## Guards of a dungeon: placed at once, at fixed spots; elite ones are tougher and pay double.
func populate_dungeon(guards: Array, centre_of: Callable) -> void:
	clear_all()
	for g: Dictionary in guards:
		if not defs.has(str(g.kind)):
			continue
		var built: Dictionary = (defs[str(g.kind)] as Dictionary).duplicate(true)
		if bool(g.get("guardian", false)):
			built["hp"] = float(built.hp) * 4.0
			built["atk"] = float(built.atk) * 1.5
			built["xp"] = int(built.xp) * 5
			built["name"] = "Strażnik Labiryntu: " + str(built.name)
		elif bool(g.elite):
			built["hp"] = float(built.hp) * 2.0
			built["atk"] = float(built.atk) * 1.3
			built["xp"] = int(built.xp) * 2
			built["name"] = str(built.name) + " (elita)"
		var at: Vector2 = centre_of.call(g.cell)
		var monster := PyraMonster.new()
		game.monster_parent().add_child(monster)
		var slot := extra_slot()
		monster.setup(built, at, self, slot)
		monster.died.connect(on_died)
		active[slot] = monster

## Removes a monster from the books without a reward (the half of a merged swarm).
func forget(monster: PyraMonster) -> void:
	active.erase(monster.spawn_index)
	monster.phase = "dead"

func extra_slot() -> int:
	minion_seq += 1
	return -minion_seq

func place_monster(kind: String, at: Vector2) -> PyraMonster:
	var monster := PyraMonster.new()
	game.monster_parent().add_child(monster)
	var slot := extra_slot()
	monster.setup(defs[kind], at, self, slot)
	monster.died.connect(on_died)
	active[slot] = monster
	return monster

## The combat definition of a boss: the browser's translation (`bossMonster`), the art of the continent's apex guardian at 180 px,
## melee attacks that reach as far as the body (the browser lets them reach the whole aggro radius), and a keep-distance for
## ranged bosses so they do not walk into the hero between casts.
func boss_definition(info: Dictionary) -> Dictionary:
	var built: Dictionary = (info.monster as Dictionary).duplicate(true)
	var guardian: Dictionary = defs[str(info.guardian)]
	built["actor"] = (guardian.actor as Dictionary).duplicate(true)
	built.actor["size"] = [180, 180]
	built["sound"] = str(info.sound)
	built["lootItems"] = []
	built["pool"] = {"ids": [], "weights": [], "total": 0}
	built["id"] = "boss:" + str(info.id)
	var skills: Array = PyraBossScript.augment(str(info.id), built.skills)
	for skill: Dictionary in skills:
		if str(skill.mode) == "melee":
			skill["range"] = float(info.range)
	built["skills"] = skills
	var rule: Dictionary = (built.traits as Dictionary).duplicate()
	if float(info.range) >= 300.0 and float(info.speed) > 0.0:
		rule["keep"] = float(info.range) * 0.55
	built["traits"] = rule
	return built

func boss_info(id: String) -> Dictionary:
	for b: Dictionary in game.boss_data.bosses:
		if str(b.id) == id:
			return b
	return {}

func live_boss(id: String) -> PyraMonster:
	for m: PyraMonster in active.values():
		if is_instance_valid(m) and not m.boss.is_empty() and str(m.boss.id) == id and m.phase != "dead":
			return m
	return null

## Spawns a boss (or returns the one already alive: entering the lair twice never duplicates it).
func spawn_boss(id: String, at: Vector2) -> PyraMonster:
	var existing := live_boss(id)
	if existing != null:
		return existing
	var info := boss_info(id)
	if info.is_empty():
		return null
	var monster := PyraMonster.new()
	game.monster_parent().add_child(monster)
	var slot := extra_slot()
	monster.setup_boss(info, boss_definition(info), at, self, slot)
	monster.died.connect(on_died)
	active[slot] = monster
	monster.engage()
	return monster

## The second half of a splitting swarm: same creature, a fraction of the health, no reward of its own.
func spawn_clone(source: PyraMonster, at: Vector2, part: float) -> PyraMonster:
	var clone := place_monster(str(source.def.id), at)
	clone.max_hp = part
	clone.hp = part
	clone.split_done = true
	clone.no_reward = true
	clone.engage()
	return clone

## Helper creatures called by a monster (e.g. the wasp swarm); they fight at once and leave no respawn slot.
func summon(source: PyraMonster, kind: String, count: int) -> void:
	summon_kind(source, kind, count)
	say("%s przywołuje pomocników!" % source.label)

func summon_kind(source: PyraMonster, kind: String, count: int) -> Array:
	var made: Array = []
	if not defs.has(kind):
		return made
	for i in count:
		var at := source.position + Vector2.from_angle(TAU * (i + randf() * 0.5) / float(maxi(1, count))) * randf_range(90.0, 150.0)
		var helper := place_monster(kind, at)
		helper.home = source.home
		helper.engage()
		made.append(helper)
	return made

func say(text: String) -> void:
	game.hud.toast(text)

func hurt_ally_near(source: PyraMonster, radius: float) -> bool:
	for m: PyraMonster in active.values():
		if m != source and is_instance_valid(m) and m.phase != "dead" and m.hp < m.max_hp * 0.8 and m.position.distance_to(source.position) <= radius:
			return true
	return false

func apply_effects(fx: Array, monster: PyraMonster) -> void:
	for f: Dictionary in fx:
		game.apply_status(f, monster)

## A damage / status area left on the ground: poison clouds, fire trails, spider webs.
func add_zone(rule: Dictionary, at: Vector2, atk: float, _source: PyraMonster = null) -> Zone:
	var zone := Zone.new()
	zone.setup(self, rule, at, atk)
	game.fx_parent().add_child(zone)
	return zone

func lay_web(source: PyraMonster, rule: Dictionary) -> void:
	var key := source.get_instance_id()
	var list: Array = webs.get(key, [])
	list = list.filter(func(z: Variant) -> bool: return is_instance_valid(z))
	if list.size() < int(rule.max):
		var at := source.home + Vector2.from_angle(randf() * TAU) * randf() * float(rule.radius)
		list.append(add_zone(rule.zone, at, float(source.def.atk), source))
	webs[key] = list

func in_own_web(source: PyraMonster) -> bool:
	for z: Variant in webs.get(source.get_instance_id(), []):
		if is_instance_valid(z) and (z as Zone).covers(source.position):
			return true
	return false

func foes_in(center: Vector2, radius: float) -> Array:
	var found := []
	for m: PyraMonster in active.values():
		if is_instance_valid(m) and m.phase != "dead" and m.position.distance_to(center) <= radius + 36.0:
			found.append(m)
	return found

func nearest(center: Vector2, radius: float) -> PyraMonster:
	var best: PyraMonster = null
	var best_d := radius
	for m: PyraMonster in active.values():
		if is_instance_valid(m) and m.phase != "dead":
			var d := m.position.distance_to(center)
			if d < best_d:
				best_d = d
				best = m
	return best

func disengage_all() -> void:
	for m: PyraMonster in active.values():
		if is_instance_valid(m) and m.phase == "engage":
			m.phase = "return"

# ---- what the monsters ask of the game ------------------------------------------------------------

func audio() -> PyraAudio:
	return game.audio

func player_position() -> Vector2:
	return game.player.position

func player_is_safe() -> bool:
	return game.in_safe_city(game.player.position)

func player_dead() -> bool:
	return game.kit.dead

func player_hp_ratio() -> float:
	return game.kit.hp / maxf(1.0, float(game.kit.stats().maxHp))

func is_night() -> bool:
	return game.is_night()

func in_safe_city(at: Vector2) -> bool:
	return game.in_safe_city(at)

func walkable(at: Vector2) -> bool:
	return game.stand(at)

func hurt_player(monster: PyraMonster, raw: float, kind: String, fx: Array) -> void:
	game.hurt_player(monster, raw, kind, fx)

func puff(at: Vector2, radius: float) -> void:
	PyraFx.spawn(game.fx_parent(), "burst", at, radius, "M")

func shoot(monster: PyraMonster, from: Vector2, to: Vector2, raw: float, fx: Array) -> void:
	var shot := Shot.new()
	shot.setup(self, monster, from, to, raw, fx)
	game.fx_parent().add_child(shot)

func call_allies(source: PyraMonster, radius: float, count: int) -> void:
	var woken := 0
	for m: PyraMonster in active.values():
		if m != source and is_instance_valid(m) and m.phase == "idle" and m.position.distance_to(source.position) <= radius and woken < count + 1:
			m.engage()
			woken += 1

func heal_allies(source: PyraMonster, radius: float, fraction: float) -> void:
	for m: PyraMonster in active.values():
		if is_instance_valid(m) and m.phase != "dead" and m.position.distance_to(source.position) <= radius:
			m.hp = minf(m.max_hp, m.hp + m.max_hp * fraction)

class Zone extends Node2D:
	const COLORS := {"poison": Color(0.45, 0.85, 0.25), "fire": Color(1.0, 0.45, 0.12), "web": Color(0.92, 0.94, 1.0), "acid": Color(0.7, 0.95, 0.2), "ice": Color(0.55, 0.85, 1.0), "electric": Color(0.5, 0.75, 1.0), "void": Color(0.62, 0.3, 0.95), "spikes": Color(0.8, 0.75, 0.7), "ash": Color(0.62, 0.52, 0.48), "nanite": Color(0.45, 0.8, 0.95), "lava": Color(1.0, 0.3, 0.08)}
	var manager: PyraMonsters
	var kind := "poison"
	var radius := 60.0
	var life := 3.0
	var dps := 0.0
	var fx: Array = []
	var atk := 1.0
	var tick := 0.0
	var age := 0.0
	var delay := 0.0

	func setup(parent_manager: PyraMonsters, rule: Dictionary, at: Vector2, attack: float) -> void:
		delay = float(rule.get("delay", 0.0))
		manager = parent_manager
		position = at
		kind = str(rule.get("kind", "poison"))
		radius = float(rule.get("radius", 60))
		life = float(rule.get("ms", 3000)) / 1000.0
		dps = float(rule.get("dps", 0.0))
		fx = rule.get("fx", [])
		atk = attack

	func covers(point: Vector2) -> bool:
		return position.distance_to(point) <= radius

	func _process(delta: float) -> void:
		age += delta
		if delay > 0.0:
			delay -= delta   # a warning circle first: no damage until it has filled
			queue_redraw()
			return
		life -= delta
		if life <= 0.0:
			queue_free()
			return
		tick -= delta
		if tick <= 0.0:
			tick = 0.5
			if covers(manager.player_position()):
				manager.game.zone_hit(dps * atk * 0.5, fx, atk, position)
		queue_redraw()

	func _draw() -> void:
		var color: Color = COLORS.get(kind, Color(0.8, 0.5, 0.9))
		var fade := clampf(life / 0.6, 0.0, 1.0)
		if kind == "spikes":
			draw_arc(Vector2.ZERO, radius, 0, TAU, 24, Color(0.9, 0.3, 0.25, 0.28), 2.0, true)
			return
		if delay > 0.0:
			draw_arc(Vector2.ZERO, radius, 0, TAU, 32, Color(color.r, color.g, color.b, 0.9), 2.5, true)
			draw_circle(Vector2.ZERO, radius * (1.0 - delay / maxf(0.1, delay + age)), Color(color.r, color.g, color.b, 0.22))
			return
		if kind == "web":
			draw_circle(Vector2.ZERO, radius, Color(color.r, color.g, color.b, 0.10 * fade))
			for i in 8:
				draw_line(Vector2.ZERO, Vector2.from_angle(i * TAU / 8.0) * radius, Color(color.r, color.g, color.b, 0.55 * fade), 1.5)
			for ring in [0.35, 0.7, 1.0]:
				draw_arc(Vector2.ZERO, radius * ring, 0, TAU, 24, Color(color.r, color.g, color.b, 0.5 * fade), 1.2, true)
		else:
			var pulse := 0.5 + 0.5 * sin(age * 5.0)
			draw_circle(Vector2.ZERO, radius, Color(color.r, color.g, color.b, (0.16 + 0.08 * pulse) * fade))
			draw_arc(Vector2.ZERO, radius, 0, TAU, 32, Color(color.r, color.g, color.b, 0.7 * fade), 2.0, true)

class Shot extends Node2D:
	var owner_monster: PyraMonster
	var manager: PyraMonsters
	var velocity := Vector2.ZERO
	var left := 0.0
	var raw := 0.0
	var fx: Array = []
	var aim := Vector2.ZERO

	func setup(parent_manager: PyraMonsters, monster: PyraMonster, from: Vector2, to: Vector2, damage: float, effects: Array) -> void:
		manager = parent_manager
		owner_monster = monster
		position = from
		aim = to
		var direction := (to - from).normalized()
		velocity = direction * 640.0
		left = maxf(60.0, from.distance_to(to) + 24.0)
		raw = damage
		fx = effects

	func _process(delta: float) -> void:
		var travel := minf(velocity.length() * delta, left)
		position += velocity.normalized() * travel
		left -= travel
		var target := manager.player_position() - Vector2(0, 40)
		if position.distance_to(target) < 46.0:
			manager.game.hurt_player(owner_monster, raw, "projectile", fx)
			queue_free()
		elif left <= 0.01:
			queue_free()
		queue_redraw()

	func _draw() -> void:
		draw_circle(Vector2.ZERO, 11.0, Color(1.0, 0.45, 0.2, 0.35))
		draw_circle(Vector2.ZERO, 6.0, Color(1.0, 0.85, 0.5))
		draw_line(Vector2.ZERO, -velocity.normalized() * 22.0, Color(1.0, 0.6, 0.3, 0.7), 4.0)
