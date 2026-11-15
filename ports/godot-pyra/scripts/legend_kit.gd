class_name LegendKit
extends RefCounted
## Legends (Pyra): stats, the 29-node tree and the racial resource Żar (Ember).
## Numbers come from the owner annex (data/legend.json) and follow src/game/kit/legend.ts + base.ts one to one:
## owner 12.11.2026 rank scaling (first point = half the bonus, then +10% of that base), crit x1.5, half-up rounding.

signal said(text: String)
signal effect(kind: String, at: Vector2, radius: float, ability: String)
signal damage_dealt(foe: Node, amount: int, crit: bool)
signal changed

const CRIT_MULT := 1.5
const BASE_RANGE := 78.0
const MAX_MOVE_SPEED := 1200.0
const SLOTS := 4
const DODGE_DISTANCE := 170.0
const DODGE_COOLDOWN := 0.9

var data: Dictionary
var nodes: Dictionary = {}    # id -> node dictionary
var node_order: Array[String] = []
var level := 1
var xp := 0
var learned: Array[String] = []   # an id listed N times = rank N
var slots: Array[String] = ["", "", "", ""]
var hp := 1.0
var ki := 1.0
var ember := 0.0
var cooldowns: Dictionary = {}     # id -> seconds left
var buffs: Array[Dictionary] = []
var timers: Array[Dictionary] = []
var now := 0.0
var next_basic_at := 0.0
var next_dodge_at := 0.0
var streak := 0
var last_hit_at := -1000.0
var in_combat_until := 0.0
var was_in_combat := false
var dead := false

# Port to the game world (set by PyraGame).
var player_position: Callable = func() -> Vector2: return Vector2.ZERO
var player_facing: Callable = func() -> Vector2: return Vector2.DOWN
var foes_in: Callable = func(_center: Vector2, _radius: float) -> Array: return []
var dash_towards: Callable = func(_to: Vector2, _distance: float) -> void: pass
var target: Callable = func() -> Node: return null

func _init(legend: Dictionary) -> void:
	data = legend
	for node: Dictionary in legend.nodes:
		nodes[node.id] = node
		node_order.append(node.id)
	learned = ["R"]
	hp = float(stats().maxHp)
	ki = float(stats().maxKi)

# ---- ranks ------------------------------------------------------------------------------------

func rank(id: String) -> int:
	return learned.count(id)

func has(id: String) -> bool:
	return learned.has(id)

static func rank_power(r: int) -> float:
	return 0.0 if r <= 0 else 0.5 * (1.0 + 0.1 * float(r - 1))

func bonus_rank(id: String) -> float:
	return rank_power(rank(id))

static func ranked_multiplier(first_total: float, power: float) -> float:
	return 1.0 + (first_total - 1.0) * power if first_total >= 1.0 else first_total * power

func cast_damage(id: String, first_total: float) -> float:
	return ranked_multiplier(first_total, bonus_rank(id))

func cast_growth(id: String) -> float:
	return bonus_rank(id) / rank_power(1)

# ---- points and learning ---------------------------------------------------------------------

func skill_points_total() -> int:
	return level

func free_points() -> int:
	return skill_points_total() - learned.size()

func can_learn(id: String) -> Dictionary:
	if not nodes.has(id):
		return {"ok": false, "reason": "Nieznany węzeł."}
	var node: Dictionary = nodes[id]
	if id == "R" and has("R"):
		return {"ok": false, "reason": "Już poznane."}
	if level < int(node.minLevel):
		return {"ok": false, "reason": "Wymaga poziomu %d." % int(node.minLevel)}
	if free_points() < 1:
		return {"ok": false, "reason": "Brak punktów umiejętności."}
	var requires: Array = node.requires
	if not requires.is_empty():
		var any := false
		for req: String in requires:
			if has(req):
				any = true
		if not any:
			var names := []
			for req: String in requires:
				names.append(str(nodes[req].name))
			return {"ok": false, "reason": "Wymaga: " + " lub ".join(names) + "."}
	var excludes := str(node.excludes)
	if not excludes.is_empty() and has(excludes):
		return {"ok": false, "reason": "Wyklucza się z: %s." % str(nodes[excludes].name)}
	return {"ok": true, "reason": ""}

func learn(id: String) -> bool:
	if not can_learn(id).ok:
		return false
	learned.append(id)
	if is_active(id):
		assign_free_slot(id)
	refill_if_first()
	changed.emit()
	return true

func refill_if_first() -> void:
	hp = minf(hp, float(stats().maxHp))
	ki = minf(ki, float(stats().maxKi))

func reset_tree() -> void:
	learned = ["R"]
	slots = ["", "", "", ""]
	cooldowns.clear()
	buffs.clear()
	timers.clear()
	ember = 0.0
	refill_if_first()
	changed.emit()

func is_active(id: String) -> bool:
	return nodes.has(id) and str(nodes[id].type) in ["active", "ultimate", "ki-mode"]

func assign_free_slot(id: String) -> void:
	if slots.has(id):
		return
	for i in SLOTS:
		if slots[i] == "":
			slots[i] = id
			return

func assign_slot(index: int, id: String) -> void:
	if index < 0 or index >= SLOTS or not (id == "" or (has(id) and is_active(id))):
		return
	for i in SLOTS:
		if slots[i] == id and id != "":
			slots[i] = ""
	slots[index] = id
	changed.emit()

func set_level(value: int) -> void:
	level = clampi(value, 1, 20)
	# Points are one per level; if the level drops, forget the nodes that no longer fit (latest learned first).
	while free_points() < 0 or not valid_tree():
		learned.pop_back()
	for i in SLOTS:
		if slots[i] != "" and not has(slots[i]):
			slots[i] = ""
	xp = 0
	hp = float(stats().maxHp)
	ki = float(stats().maxKi)
	changed.emit()

func valid_tree() -> bool:
	for id in learned:
		var node: Dictionary = nodes[id]
		if level < int(node.minLevel):
			return false
	return true

static func xp_needed(lv: int) -> int:
	return 100 + (lv - 1) * 60

func add_xp(amount: int) -> int:
	var gained := 0
	xp += amount
	while level < 20 and xp >= xp_needed(level):
		xp -= xp_needed(level)
		level += 1
		gained += 1
	if gained > 0:
		hp = float(stats().maxHp)
		ki = float(stats().maxKi)
		said.emit("Poziom %d! Masz nowy punkt umiejętności." % level)
	changed.emit()
	return gained

# ---- stats -----------------------------------------------------------------------------------

static func speed_growth(lv: int) -> float:
	var tiers := [[9, 0.05], [19, 0.04], [29, 0.035], [1000000, 0.03]]
	var growth := 0.0
	var prev := 1
	for tier in tiers:
		growth += maxf(0.0, float(mini(lv, int(tier[0])) - prev)) * float(tier[1])
		if lv <= int(tier[0]):
			break
		prev = int(tier[0])
	return 1.0 + growth

func buff_sum(field: String) -> float:
	var total := 0.0
	for buff in buffs:
		total += float(buff.get(field, 0.0))
	return total

func mods() -> Dictionary:
	var m := {"atkPct": 0.0, "critAdd": 0.0, "defPct": 0.0, "hpPct": 0.0, "kiRegenPct": 0.0}
	if has("A5"): m.atkPct = 0.08 * bonus_rank("A5")
	if has("A6"): m.critAdd = 0.06 * bonus_rank("A6")
	if has("B2"): m.defPct = 0.08 * bonus_rank("B2")
	if has("B3"): m.hpPct = 0.1 * bonus_rank("B3")
	if has("C6") and ember >= 100.0: m.kiRegenPct = 0.5 * bonus_rank("C6")
	return m

static func round_half_up(x: float) -> int:
	return int(floor(x + 0.5))

func stats(layer: int = 4) -> Dictionary:
	var base: Dictionary = data.base
	var per: Dictionary = data.perLevel
	var lv := float(level - 1)
	var v := func(key: String) -> float: return float(base[key]) + float(per[key]) * lv
	var m: Dictionary = mods() if layer >= 2 else {"atkPct": 0.0, "critAdd": 0.0, "defPct": 0.0, "hpPct": 0.0, "kiRegenPct": 0.0}
	var atk_pct: float = float(m.atkPct) + (buff_sum("atkPct") if layer >= 3 else 0.0)
	var def_pct: float = float(m.defPct) + (buff_sum("defPct") if layer >= 3 else 0.0)
	var interval_pct := buff_sum("intervalPct") if layer >= 3 else 0.0
	return {
		"maxHp": round_half_up(v.call("hp") * (1.0 + float(m.hpPct))),
		"maxKi": round_half_up(v.call("ki")),
		"attack": maxi(1, round_half_up(v.call("attack") * (1.0 + atk_pct))),
		"defense": maxi(0, round_half_up(v.call("defense") * (1.0 + def_pct))),
		"speed": minf(MAX_MOVE_SPEED, float(base.speed) * speed_growth(level)),
		"kiRegen": v.call("kiRegen") * (1.0 + float(m.kiRegenPct)),
		"crit": v.call("criticalChancePercent") + float(m.critAdd) * 100.0,
		"attackInterval": maxf(200.0, float(base.attackIntervalMs) * (1.0 + interval_pct)),
		"range": BASE_RANGE,
	}

func stat_breakdown() -> Array:
	var raw := stats(1)
	var with_skills := stats(2)
	var total := stats(4)
	var rows := []
	for item in [["maxHp", "Maksymalne HP"], ["maxKi", "Maksymalne KI"], ["attack", "Atak"], ["defense", "Obrona"], ["speed", "Szybkość ruchu"], ["kiRegen", "Regeneracja KI / s"], ["crit", "Szansa krytyczna %"], ["attackInterval", "Odstęp ataków (ms)"]]:
		var k: String = item[0]
		rows.append({"key": k, "label": item[1], "base": raw[k], "skills": float(with_skills[k]) - float(raw[k]), "effects": float(total[k]) - float(with_skills[k]), "total": total[k]})
	return rows

# ---- time ------------------------------------------------------------------------------------

func in_combat() -> bool:
	return now < in_combat_until

func schedule(delay: float, action: Callable) -> void:
	timers.append({"at": now + delay, "fn": action})

func add_buff(buff: Dictionary) -> void:
	buff["until"] = now + float(buff.ms) / 1000.0
	buffs = buffs.filter(func(b: Dictionary) -> bool: return b.id != buff.id)
	buffs.append(buff)

func buff_active(id: String) -> bool:
	for b in buffs:
		if b.id == id:
			return true
	return false

func remove_buff(id: String) -> void:
	buffs = buffs.filter(func(b: Dictionary) -> bool: return b.id != id)

func tick(delta: float) -> void:
	now += delta
	for id: String in cooldowns.keys():
		cooldowns[id] = maxf(0.0, float(cooldowns[id]) - delta)
	buffs = buffs.filter(func(b: Dictionary) -> bool: return now < float(b.until))
	var due := timers.filter(func(t: Dictionary) -> bool: return now >= float(t.at))
	timers = timers.filter(func(t: Dictionary) -> bool: return now < float(t.at))
	for t in due:
		(t.fn as Callable).call()
	var s := stats()
	if not dead:
		var regen := float(s.kiRegen)
		ki = minf(float(s.maxKi), ki + regen * delta)
	# Ember: held at 100 by the transformation, 20 at the start of a fight with C5, otherwise it cools down.
	var fighting := in_combat()
	if buff_active("T"):
		ember = 100.0
	elif fighting and not was_in_combat and has("C5"):
		ember = maxf(ember, 20.0)
	elif not fighting:
		ember = maxf(0.0, ember - 5.0 / (1.0 + bonus_rank("C2")) * delta)
	was_in_combat = fighting

func cooldown_left(id: String) -> float:
	return float(cooldowns.get(id, 0.0))

# ---- combat ----------------------------------------------------------------------------------

func gain_ember(n: float) -> void:
	ember = minf(100.0, ember + n * (1.0 + 0.5 * bonus_rank("C2")))

func dealt_vs() -> float:
	var bonus := minf(0.1, ember * 0.001)
	if has("A8") and (foes_in.call(player_position.call(), 200.0) as Array).size() == 1:
		bonus += 0.25 * bonus_rank("A8")
	return bonus

func strike(foe: Node, mult: float, extra: float = 0.0, force_crit: bool = false, indirect: bool = false, ability: String = "R") -> float:
	if not is_instance_valid(foe):
		return 0.0
	var s := stats()
	var raw: float = float(s.attack) * mult * (1.0 + extra + dealt_vs())
	var crit := force_crit or randf() * 100.0 < float(s.crit)
	if crit:
		raw *= CRIT_MULT
	var dealt: float = foe.hurt(raw, crit)
	in_combat_until = now + 5.0
	damage_dealt.emit(foe, int(round(dealt)), crit)
	if not indirect and dealt > 0.0:
		gain_ember(4.0)
		streak = 1 if now - last_hit_at > 2.5 else streak + 1
		last_hit_at = now
		if has("A3") and streak >= 3:
			streak = 0
			add_buff({"id": "A3", "ms": 4000, "intervalPct": -0.1 * bonus_rank("A3")})
	if foe.hp <= 0.0 and foe.has_method("on_defeated"):
		on_kill(foe)
	return dealt

func on_kill(_foe: Node) -> void:
	if has("B6"):
		heal(float(stats().maxHp) * 0.03 * bonus_rank("B6"))

func heal(amount: float) -> void:
	hp = minf(float(stats().maxHp), hp + amount)

func ignite(foe: Node, total_atk: float, ms: float) -> void:
	if is_instance_valid(foe) and foe.has_method("burn"):
		foe.burn(float(stats().attack) * total_atk / (ms / 1000.0), ms / 1000.0)

func interval() -> float:
	return float(stats().attackInterval) / 1000.0

func basic_ready() -> bool:
	return now >= next_basic_at

func pick_foe(reach: float) -> Node:
	var p: Vector2 = player_position.call()
	var chosen: Node = target.call()
	if is_instance_valid(chosen) and (chosen as Node2D).global_position.distance_to(p) <= reach:
		return chosen
	var best: Node = null
	var best_d := reach
	for foe in foes_in.call(p, reach):
		var d := (foe as Node2D).global_position.distance_to(p)
		if d <= best_d:
			best_d = d
			best = foe
	return best

## Basic strike. Returns {ok, reason, foe}.
func basic() -> Dictionary:
	if dead:
		return {"ok": false, "reason": ""}
	if now < next_basic_at:
		return {"ok": false, "reason": ""}
	next_basic_at = now + interval()
	var foe := pick_foe(BASE_RANGE + 18.0)
	var p: Vector2 = player_position.call()
	effect.emit("swing", p, 0.0, "R")
	if foe == null:
		return {"ok": true, "reason": "", "foe": null}
	strike(foe, 1.0, 0.0, false, false, "R")
	return {"ok": true, "reason": "", "foe": foe}

func use(id: String) -> Dictionary:
	if dead:
		return {"ok": false, "reason": ""}
	if not has(id) or not is_active(id):
		return {"ok": false, "reason": "Nie poznano tej zdolności."}
	var def: Dictionary = nodes[id]
	if cooldown_left(id) > 0.0:
		return {"ok": false, "reason": "%s: odnowienie %.1f s." % [def.name, cooldown_left(id)]}
	if ki < float(def.ki):
		return {"ok": false, "reason": "Za mało KI."}
	var result := cast(id)
	if result.ok:
		ki -= float(def.ki)
		cooldowns[id] = float(def.cd)
		in_combat_until = maxf(in_combat_until, now + 5.0)
		changed.emit()
	return result

func cast(id: String) -> Dictionary:
	var p: Vector2 = player_position.call()
	var reach := BASE_RANGE + 14.0
	match id:
		"A1":
			var foe := pick_foe(reach)
			if foe == null:
				return {"ok": false, "reason": "Brak celu w zasięgu. Podejdź do manekina."}
			var five := has("A7")
			var total := (cast_damage("A1", 1.8) + (0.8 * bonus_rank("A7") * cast_growth("A1") if five else 0.0))
			cuts("A1", foe, 5 if five else 3, total, 0.15, [0.3 * bonus_rank("A2"), 3000.0] if has("A2") else [])
			return {"ok": true, "reason": "", "clip": "attack"}
		"A4":
			var foe2 := pick_foe(300.0)
			if foe2 == null:
				return {"ok": false, "reason": "Brak celu w zasięgu. Podejdź do manekina."}
			var gap := maxf(0.0, p.distance_to((foe2 as Node2D).global_position) - 50.0)
			if gap > 220.0:
				return {"ok": false, "reason": "Cel zbyt daleko (200)."}
			dash_towards.call((foe2 as Node2D).global_position, minf(200.0, gap))
			effect.emit("dash", p, 0.0, "A4")
			strike(foe2, cast_damage("A4", 2.2), 0.0, false, false, "A4")
			return {"ok": true, "reason": "", "clip": "skill"}
		"A9":
			var foe3 := pick_foe(reach)
			if foe3 == null:
				return {"ok": false, "reason": "Brak celu w zasięgu. Podejdź do manekina."}
			cuts("A9", foe3, 8, cast_damage("A9", 4.2), 0.12, [])
			return {"ok": true, "reason": "", "clip": "finisher"}
		"B1":
			var foe4 := pick_foe(reach)
			if foe4 == null:
				return {"ok": false, "reason": "Brak celu w zasięgu. Podejdź do manekina."}
			effect.emit("slash", p, 0.0, "B1")
			strike(foe4, cast_damage("B1", 1.5), 0.0, false, false, "B1")
			if foe4.has_method("stun"):
				foe4.stun(1.2)
			if foe4.has_method("break_shield"):
				foe4.break_shield()
			return {"ok": true, "reason": "", "clip": "attack2"}
		"B4":
			var ms := 8000.0 + 4000.0 * bonus_rank("B7")
			add_buff({"id": "B4", "ms": ms, "atkPct": 0.3 * bonus_rank("B4") + 0.1 * bonus_rank("B7"), "defPct": 0.0 if has("B8") else -0.2 * bonus_rank("B4")})
			effect.emit("buff", p, 120.0, "B4")
			said.emit("Płomienny Szał")
			return {"ok": true, "reason": "", "clip": "skillb"}
		"B9":
			add_buff({"id": "B9", "ms": 5000, "lethal": true})
			effect.emit("buff", p, 150.0, "B9")
			said.emit("Ostatni Płomień")
			return {"ok": true, "reason": "", "clip": "guard"}
		"C1":
			var radius := 150.0
			var foes: Array = foes_in.call(p, radius)
			effect.emit("burst", p, radius, "C1")
			for f in foes:
				strike(f, cast_damage("C1", 1.8), 0.0, false, false, "C1")
				if has("C3"):
					ignite(f, 0.4 * bonus_rank("C3"), 4000.0)
			return {"ok": true, "reason": "", "clip": "skillc"}
		"C4":
			var mult := cast_damage("C4", 1.0 + minf(100.0, ember) / 50.0) * (1.0 + 0.25 * bonus_rank("C8"))
			var r := 160.0
			if has("C7"):
				r *= 1.0 + 0.5 * bonus_rank("C7")
			elif has("C8"):
				r *= maxf(0.3, 1.0 - 0.2 * bonus_rank("C8"))
			var hit: Array = foes_in.call(p, r)
			effect.emit("burst", p, r, "C4")
			for f2 in hit:
				strike(f2, mult, 0.0, false, false, "C4")
			ember = 0.0
			return {"ok": true, "reason": "", "clip": "skillc"}
		"C9":
			var chosen: Node = target.call()
			var facing: Vector2 = player_facing.call()
			var at: Vector2 = (chosen as Node2D).global_position if is_instance_valid(chosen) else p + facing * 150.0
			var area: Array = foes_in.call(at, 240.0)
			effect.emit("burst", at, 240.0, "C9")
			for f3 in area:
				strike(f3, cast_damage("C9", 4.5), 0.0, false, false, "C9")
				ignite(f3, 0.5 * bonus_rank("C9"), 5000.0)
			return {"ok": true, "reason": "", "clip": "skillc"}
		"T":
			add_buff({"id": "T", "ms": 20000, "atkPct": 0.3 * bonus_rank("T")})
			ember = 100.0
			effect.emit("buff", p, 200.0, "T")
			said.emit("Forma Płomiennego Legendy")
			return {"ok": true, "reason": "", "clip": "kiskill"}
	return {"ok": false, "reason": "Nieznana zdolność."}

func cuts(id: String, foe: Node, count: int, total: float, gap: float, burn: Array) -> void:
	var each := total / float(count)
	for i in count:
		schedule(float(i) * gap, func() -> void:
			if not is_instance_valid(foe) or foe.hp <= 0.0:
				return
			var p: Vector2 = player_position.call()
			if p.distance_to((foe as Node2D).global_position) > BASE_RANGE + 28.0:
				return
			effect.emit("slash", p, 0.0, id)
			strike(foe, each, 0.0, false, false, id)
			if not burn.is_empty() and i == count - 1:
				ignite(foe, float(burn[0]), float(burn[1])))

func dodge(direction: Vector2) -> Dictionary:
	if now < next_dodge_at or dead:
		return {"ok": false, "reason": ""}
	var p: Vector2 = player_position.call()
	dash_towards.call(p + direction.normalized() * DODGE_DISTANCE, DODGE_DISTANCE)
	add_buff({"id": "dodge", "ms": 350, "invulnerable": true})
	next_dodge_at = now + DODGE_COOLDOWN
	effect.emit("dash", p, 0.0, "dodge")
	return {"ok": true, "reason": ""}

## Damage the player takes. Ostatni Płomień (B9) turns the first lethal blow into 1 HP and heals 30%.
func take_damage(amount: float) -> float:
	if buff_active("dodge"):
		return 0.0
	var reduced := maxf(1.0, amount - float(stats().defense) * 0.5)
	if reduced >= hp and buff_active("B9"):
		remove_buff("B9")
		hp = 1.0
		heal(float(stats().maxHp) * 0.3 * bonus_rank("B9"))
		said.emit("Ostatni Płomień ocalił Cię przed śmiercią.")
		return reduced
	hp = maxf(0.0, hp - reduced)
	in_combat_until = now + 5.0
	if hp <= 0.0:
		dead = true
	return reduced

func rest_fully() -> void:
	hp = float(stats().maxHp)
	ki = float(stats().maxKi)
	dead = false
	changed.emit()

func resource_label() -> String:
	return "Żar %d / 100" % int(round(ember))

# ---- persistence -----------------------------------------------------------------------------

func to_save() -> Dictionary:
	return {"level": level, "xp": xp, "learned": learned, "slots": slots, "hp": hp, "ki": ki}

func from_save(value: Dictionary) -> bool:
	var lv := int(value.get("level", 0))
	var ids = value.get("learned", [])
	if lv < 1 or lv > 20 or not ids is Array or ids.is_empty():
		return false
	var tree: Array[String] = []
	for id in ids:
		if not nodes.has(str(id)):
			return false
		tree.append(str(id))
	var old_level := level
	var old_learned := learned
	level = lv
	learned = tree
	if learned.size() > skill_points_total() or not valid_tree() or learned.count("R") != 1:
		level = old_level
		learned = old_learned
		return false
	xp = clampi(int(value.get("xp", 0)), 0, xp_needed(level) - 1)
	var saved_slots = value.get("slots", [])
	slots = ["", "", "", ""]
	if saved_slots is Array:
		for i in mini(SLOTS, saved_slots.size()):
			var id := str(saved_slots[i])
			if id == "" or (has(id) and is_active(id)):
				slots[i] = id
	hp = clampf(float(value.get("hp", stats().maxHp)), 1.0, float(stats().maxHp))
	ki = clampf(float(value.get("ki", stats().maxKi)), 0.0, float(stats().maxKi))
	changed.emit()
	return true
