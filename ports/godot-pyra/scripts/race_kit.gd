class_name RaceKit
extends RefCounted
## Common machinery of the four race kits (Legends, Planetary, Sages, Androids): stats from the owner annex, the 29-node tree
## with ranks, buffs, shields, circles of light, channels, timers, crits and cooldowns. Numbers follow src/game/kit/base.ts and
## the race files one to one: owner 12.11.2026 rank scaling (first point = half the bonus, then +10% of that base),
## crit x1.5, half-up rounding. Race subclasses add the racial resource and the ten active abilities.

signal said(text: String)
signal effect(kind: String, at: Vector2, radius: float, ability: String)
signal damage_dealt(foe: Node, amount: int, crit: bool)
signal changed

## Damage classes of the hero's attacks (the `tags` of the browser kits' strikes); monsters' weaknesses refer to them.
const TAGS := {
	"legend": {"default": ["physical", "fire"], "B1": ["physical", "stun"], "C1": ["area", "fire"], "C4": ["area", "fire"], "C9": ["area", "fire"]},
	"planetary": {"default": ["physical"], "B1": ["area", "physical"], "B4": ["area", "physical", "stun"], "A9": ["physical", "area"]},
	"sage": {"default": ["ki"], "A9": ["area", "ki"]},
	"android": {"default": ["electric"], "B4": ["area", "electric", "stun"], "C1": ["area", "electric"]},
}
const RANGED_RACES := ["sage", "android"]
const CRIT_MULT := 1.5
const BASE_HP_REGEN := 0.003   # per second out of combat, as in the browser game
const MAX_MOVE_SPEED := 1200.0
const SLOTS := 4
const DODGE_DISTANCE := 170.0
const DODGE_COOLDOWN := 0.9

var data: Dictionary
var race := ""
var nodes: Dictionary = {}    # id -> node dictionary
var node_order: Array[String] = []
var level := 1
var xp := 0
var learned: Array[String] = []   # an id listed N times = rank N
var slots: Array[String] = ["", "", "", ""]
var hp := 1.0
var ki := 1.0
var cooldowns: Dictionary = {}     # id -> seconds left
var buffs: Array[Dictionary] = []
var shields: Array[Dictionary] = []
var debuffs: Array[Dictionary] = []   # effects put on the hero by monsters: {k, pct, until}
var dot_carry := 0.0
var circles: Array[Dictionary] = []
var channel: Dictionary = {}
var timers: Array[Dictionary] = []
var now := 0.0
var next_basic_at := 0.0
var next_dodge_at := 0.0
var next_eat_at := 0.0
var in_combat_until := 0.0
var dead := false
var lock_s := 0.0
var gear: Dictionary = {}          # aggregated equipment bonuses (PyraEconomy.gear())
var base_range := 78.0
var last_basic_at := -1000.0

# Port to the game world (set by PyraGame).
var player_position: Callable = func() -> Vector2: return Vector2.ZERO
var player_facing: Callable = func() -> Vector2: return Vector2.DOWN
var foes_in: Callable = func(_center: Vector2, _radius: float) -> Array: return []
var dash_towards: Callable = func(_to: Vector2, _distance: float) -> void: pass
var target: Callable = func() -> Node: return null
var terrain_at: Callable = func() -> String: return "open"

func _init(race_data: Dictionary) -> void:
	data = race_data
	race = str(race_data.race)
	for node: Dictionary in race_data.nodes:
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
	refresh()
	changed.emit()
	return true

func refresh() -> void:
	pass

func refill_if_first() -> void:
	hp = minf(hp, float(stats().maxHp))
	ki = minf(ki, float(stats().maxKi))

func reset_tree() -> void:
	learned = ["R"]
	slots = ["", "", "", ""]
	cooldowns.clear()
	buffs.clear()
	shields.clear()
	circles.clear()
	channel = {}
	timers.clear()
	on_reset()
	refresh()
	refill_if_first()
	changed.emit()

func on_reset() -> void:
	pass

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
	while free_points() < 0 or not valid_tree():
		learned.pop_back()
	for i in SLOTS:
		if slots[i] != "" and not has(slots[i]):
			slots[i] = ""
	xp = 0
	refresh()
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

static func no_mods() -> Dictionary:
	return {"atkPct": 0.0, "critAdd": 0.0, "defPct": 0.0, "hpPct": 0.0, "kiPct": 0.0, "kiRegenPct": 0.0, "speedPct": 0.0, "rangePct": 0.0,
		"intervalPct": 0.0, "kiCostPct": 0.0, "ccPct": 0.0, "hpRegenOoc": 0.0, "hpRegenAlways": 0.0}

## Passive modifiers of the learned nodes (fractions). Overridden by every race.
func mods() -> Dictionary:
	return no_mods()

static func round_half_up(x: float) -> int:
	return int(floor(x + 0.5))

func circle_defence() -> float:
	var p: Vector2 = player_position.call()
	var best := 0.0
	for c in circles:
		if float(c.get("defPct", 0.0)) > 0.0 and p.distance_to(Vector2(float(c.x), float(c.y))) <= float(c.radius):
			best = maxf(best, float(c.defPct))
	return best

func stats(layer: int = 4) -> Dictionary:
	var base: Dictionary = data.base
	var per: Dictionary = data.perLevel
	var lv := float(level - 1)
	var v := func(key: String) -> float: return float(base[key]) + float(per[key]) * lv
	var m: Dictionary = mods() if layer >= 2 else no_mods()
	var g: Dictionary = gear if layer >= 3 else {}
	var gv := func(key: String) -> float: return float(g.get(key, 0.0))
	var buff := func(field: String) -> float: return buff_sum(field) if layer >= 4 else 0.0
	var atk_pct: float = float(m.atkPct) + buff.call("atkPct")
	var def_pct: float = float(m.defPct) + buff.call("defPct") + (circle_defence() if layer >= 4 else 0.0)
	var speed_mult: float = float(g.get("speedMultiplier", 1.0)) * (1.0 + gv.call("moveSpeedPercent") / 100.0) * (1.0 + float(m.speedPct) + buff.call("speedPct"))
	var cost_mul: float = 1.0 + float(m.kiCostPct) - gv.call("kiCostReductionPercent") / 100.0
	if layer >= 4 and has_buff("noKi"):
		cost_mul = 0.0
	return {
		"maxHp": round_half_up(v.call("hp") * (1.0 + float(m.hpPct)) * (1.0 + gv.call("maxHpPercent") / 100.0) + gv.call("hpBonus")),
		"maxKi": round_half_up(v.call("ki") * (1.0 + float(m.kiPct)) * (1.0 + gv.call("maxKiPercent") / 100.0) + gv.call("kiBonus")),
		"attack": maxi(1, round_half_up(v.call("attack") * (1.0 + atk_pct) * (1.0 + gv.call("atkPercent") / 100.0) + gv.call("attack") * (1.0 + atk_pct))),
		"defense": maxi(0, round_half_up((v.call("defense") * (1.0 + def_pct) * (1.0 + gv.call("defPercent") / 100.0) + gv.call("defense") * (1.0 + def_pct)) * (1.0 - debuff_pct("armorDown") if layer >= 4 else 1.0))),
		"speed": minf(MAX_MOVE_SPEED, float(base.speed) * speed_growth(level) * speed_mult),
		"kiRegen": (v.call("kiRegen") * (1.0 + float(m.kiRegenPct) + buff.call("kiRegenPct")) + gv.call("kiRegenBonus")) * (1.0 + gv.call("kiRegenPercent") / 100.0),
		"crit": v.call("criticalChancePercent") + float(m.critAdd) * 100.0 + gv.call("critChancePoints"),
		"attackInterval": maxf(200.0, float(base.attackIntervalMs) * (1.0 + float(m.intervalPct) + buff.call("intervalPct"))),
		"range": base_range * (1.0 + float(m.rangePct)),
		"kiCostMul": maxf(0.0, cost_mul),
		"cooldownMul": maxf(0.1, 1.0 + buff.call("cooldownPct")),
		"dealt": (1.0 + buff.call("dealtPct")) * (1.0 - debuff_pct("weaken") if layer >= 4 else 1.0),
	}

func stat_breakdown() -> Array:
	var raw := stats(1)
	var with_skills := stats(2)
	var with_gear := stats(3)
	var total := stats(4)
	var rows := []
	for item in [["maxHp", "Maksymalne HP"], ["maxKi", "Maksymalne KI"], ["attack", "Atak"], ["defense", "Obrona"], ["speed", "Szybkość ruchu"], ["kiRegen", "Regeneracja KI / s"], ["crit", "Szansa krytyczna %"], ["attackInterval", "Odstęp ataków (ms)"], ["range", "Zasięg ataku"]]:
		var k: String = item[0]
		rows.append({"key": k, "label": item[1], "base": raw[k], "skills": float(with_skills[k]) - float(raw[k]), "items": float(with_gear[k]) - float(with_skills[k]), "effects": float(total[k]) - float(with_gear[k]), "total": total[k]})
	return rows

# ---- time ------------------------------------------------------------------------------------

func in_combat() -> bool:
	return now < in_combat_until

## Eats a meal (data/food.json): the status "fed" heals `regenPerSecond` of max HP every second for `seconds`, in combat too.
## One meal at a time; a new one replaces the old one only if it still has more to give. Returns {ok, reason}.
func eat(food: Dictionary) -> Dictionary:
	if dead:
		return {"ok": false, "reason": ""}
	if now < next_eat_at:
		return {"ok": false, "reason": ""}
	if hp >= float(stats().maxHp):
		return {"ok": false, "reason": "Zdrowie jest pełne."}
	var rate := float(food.regenPerSecond)
	var seconds := float(food.seconds)
	var current := buff("fed")
	if not current.is_empty() and float(current.hpRegenPct) * fed_left() >= rate * seconds:
		return {"ok": false, "reason": "Jesteś jeszcze najedzony."}
	var fed := {"id": "fed", "ms": seconds * 1000.0, "hpRegenPct": rate, "food": str(food.id)}
	if food.has("extra") and (food.extra as Dictionary).has("kiRegenPct"):
		fed["kiRegenPct"] = float(food.extra.kiRegenPct)
	add_buff(fed)
	next_eat_at = now + 2.0
	return {"ok": true, "reason": ""}

## Seconds the status "fed" still lasts (0 when not fed).
func fed_left() -> float:
	var current := buff("fed")
	return maxf(0.0, float(current.until) - now) if not current.is_empty() else 0.0

func schedule(delay: float, action: Callable) -> void:
	timers.append({"at": now + delay, "fn": action})

func add_buff(buff: Dictionary) -> void:
	buff["until"] = now + float(buff.ms) / 1000.0
	buffs = buffs.filter(func(b: Dictionary) -> bool: return b.id != buff.id)
	buffs.append(buff)

## A status from a monster (slow, weaken, armorDown, mark, blind, fog, silence, dot ...). Same kind refreshes; stronger wins.
func add_debuff(kind: String, pct: float, seconds: float) -> void:
	for d in debuffs:
		if d.k == kind:
			d.pct = maxf(float(d.pct), pct)
			d.until = maxf(float(d.until), now + seconds)
			return
	debuffs.append({"k": kind, "pct": pct, "until": now + seconds})

func debuff_pct(kind: String) -> float:
	for d in debuffs:
		if d.k == kind and now < float(d.until):
			return float(d.pct)
	return 0.0

func debuff_left(kind: String) -> float:
	for d in debuffs:
		if d.k == kind:
			return maxf(0.0, float(d.until) - now)
	return 0.0

func clear_debuffs() -> void:
	debuffs.clear()
	dot_carry = 0.0

func buff_active(id: String) -> bool:
	for b in buffs:
		if b.id == id:
			return true
	return false

func buff(id: String) -> Dictionary:
	for b in buffs:
		if b.id == id:
			return b
	return {}

func has_buff(flag: String) -> bool:
	for b in buffs:
		if bool(b.get(flag, false)):
			return true
	return false

func remove_buff(id: String) -> void:
	buffs = buffs.filter(func(b: Dictionary) -> bool: return b.id != id)

func add_shield(shield: Dictionary) -> void:
	shield["until"] = now + float(shield.ms) / 1000.0
	shields = shields.filter(func(s: Dictionary) -> bool: return s.id != shield.id)
	shields.append(shield)

func shield_total() -> float:
	var total := 0.0
	for s in shields:
		total += float(s.amount)
	return total

func add_circle(circle: Dictionary) -> void:
	circle["until"] = now + float(circle.ms) / 1000.0
	circles.append(circle)

func start_channel(c: Dictionary) -> void:
	interrupt_channel("replaced")
	c["elapsed"] = 0.0
	c["next"] = float(c.every) / 1000.0
	c["origin"] = player_position.call()
	channel = c

func interrupt_channel(reason: String) -> void:
	if channel.is_empty():
		return
	var c := channel
	channel = {}
	if reason != "finished":
		(c.on_end as Callable).call(false)
	said.emit("Przerwano: %s" % ("ruch" if reason == "move" else "trafienie" if reason == "hit" else "kanał"))

func on_tick(_delta: float) -> void:
	pass

func tick(delta: float) -> void:
	now += delta
	lock_s = maxf(0.0, lock_s - delta)
	for id: String in cooldowns.keys():
		cooldowns[id] = maxf(0.0, float(cooldowns[id]) - delta)
	buffs = buffs.filter(func(b: Dictionary) -> bool: return now < float(b.until))
	shields = shields.filter(func(s: Dictionary) -> bool: return now < float(s.until) and float(s.amount) > 0.0)
	debuffs = debuffs.filter(func(d: Dictionary) -> bool: return now < float(d.until))
	var dot_dps := debuff_pct("dot")
	if dot_dps > 0.0 and not dead:
		dot_carry += dot_dps * delta
		if dot_carry >= 1.0:
			var whole := floorf(dot_carry)
			dot_carry -= whole
			hp = maxf(0.0, hp - whole)
			if hp <= 0.0:
				dead = true
	circles = circles.filter(func(c: Dictionary) -> bool: return now < float(c.until))
	var due := timers.filter(func(t: Dictionary) -> bool: return now >= float(t.at))
	timers = timers.filter(func(t: Dictionary) -> bool: return now < float(t.at))
	for t in due:
		(t.fn as Callable).call()
	var s := stats()
	if not dead:
		ki = minf(float(s.maxKi), ki + float(s.kiRegen) * delta)
		var m := mods()
		var regen := (float(m.hpRegenAlways) + (0.0 if in_combat() else float(m.hpRegenOoc) + BASE_HP_REGEN)) * (1.0 + float(gear.get("hpRegenPercent", 0.0)) / 100.0)
		# a meal heals in combat too: the status "fed" carries a share of max HP per second (see eat())
		regen += buff_sum("hpRegenPct")
		if regen > 0.0:
			hp = minf(float(s.maxHp), hp + float(s.maxHp) * regen * delta)
	for c in circles:
		var dps := float(c.get("dps", 0.0))
		var slow := float(c.get("slow", 0.0))
		if dps > 0.0 or slow > 0.0:
			for f in foes_in.call(Vector2(float(c.x), float(c.y)), float(c.radius)):
				if dps > 0.0:
					f.hurt(float(s.attack) * dps * delta, false, ["indirect"])
				if slow > 0.0 and f.has_method("slow"):
					f.slow(slow, 0.5)
	if not channel.is_empty():
		var p: Vector2 = player_position.call()
		if bool(channel.breakOnMove) and p.distance_to(channel.origin) > 8.0:
			interrupt_channel("move")
		else:
			channel.elapsed = float(channel.elapsed) + delta
			while not channel.is_empty() and float(channel.elapsed) >= float(channel.next):
				channel.next = float(channel.next) + float(channel.every) / 1000.0
				(channel.on_tick as Callable).call()
			if not channel.is_empty() and float(channel.elapsed) >= float(channel.ms) / 1000.0:
				var done := channel
				channel = {}
				(done.on_end as Callable).call(true)
	on_tick(delta)

func cooldown_left(id: String) -> float:
	return float(cooldowns.get(id, 0.0))

func cooldown_of(id: String) -> float:
	return float(nodes[id].cd)

func ki_cost(id: String) -> float:
	return float(nodes[id].ki)

# ---- combat ----------------------------------------------------------------------------------

func dealt_vs(_foe: Node) -> float:
	return 0.0

func crit_vs(_foe: Node) -> float:
	return 0.0

func after_strike(_foe: Node, _dealt: float, _indirect: bool) -> void:
	pass

func strike(foe: Node, mult: float, extra: float = 0.0, force_crit: bool = false, indirect: bool = false, ability: String = "R") -> float:
	if not is_instance_valid(foe):
		return 0.0
	var s := stats()
	var miss := debuff_pct("blind") + debuff_pct("fog")
	if miss > 0.0 and randf() < miss:
		said.emit("Pudło!")
		damage_dealt.emit(foe, 0, false)
		return 0.0
	var raw: float = float(s.attack) * mult * float(s.dealt) * (1.0 + extra + dealt_vs(foe))
	var crit := force_crit or randf() * 100.0 < float(s.crit) + crit_vs(foe)
	if crit:
		raw *= CRIT_MULT
	var tag_table: Dictionary = TAGS.get(race, {"default": ["physical"]})
	var tags: Array = tag_table.get(ability, tag_table.default)
	var dealt: float = foe.hurt(raw, crit, tags, race in RANGED_RACES)
	in_combat_until = now + 5.0
	damage_dealt.emit(foe, int(round(dealt)), crit)
	after_strike(foe, dealt, indirect)
	if foe.hp <= 0.0 and foe.has_method("on_defeated"):
		on_kill(foe)
	return dealt

func on_kill(_foe: Node) -> void:
	pass

func heal(amount: float) -> void:
	hp = minf(float(stats().maxHp), hp + amount)

func hot(total: float, ms: float) -> void:
	for i in range(1, 5):
		schedule(ms / 1000.0 / 4.0 * float(i), func() -> void: heal(total / 4.0))

func add_ki(amount: float) -> void:
	ki = minf(float(stats().maxKi), ki + amount)

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

func can_attack() -> String:
	return ""

## Consumes one-shot "next hit" buffs: returns their bonus and whether a crit is guaranteed.
func take_next_hit() -> Dictionary:
	var bonus := 0.0
	var crit := false
	for b in buffs:
		if b.has("nextHitPct"):
			bonus += float(b.nextHitPct)
		if bool(b.get("guaranteedCrit", false)):
			crit = true
	buffs = buffs.filter(func(b: Dictionary) -> bool: return not b.has("nextHitPct") and not bool(b.get("guaranteedCrit", false)))
	return {"bonus": bonus, "crit": crit}

## Basic attack. Returns {ok, reason}.
func basic() -> Dictionary:
	if dead or lock_s > 0.0:
		return {"ok": false, "reason": ""}
	if now < next_basic_at:
		return {"ok": false, "reason": ""}
	var blocked := can_attack()
	if blocked != "":
		return {"ok": false, "reason": blocked}
	var result := do_basic()
	if bool(result.get("ok", false)):
		next_basic_at = now + interval()
		last_basic_at = now
	return result

## Race specific basic strike.
func do_basic() -> Dictionary:
	return {"ok": false, "reason": ""}

func use(id: String) -> Dictionary:
	if dead:
		return {"ok": false, "reason": ""}
	if lock_s > 0.0:
		return {"ok": false, "reason": "Układy wyłączone."}
	if not has(id) or not is_active(id):
		return {"ok": false, "reason": "Nie poznano tej zdolności."}
	var def: Dictionary = nodes[id]
	if cooldown_left(id) > 0.0:
		return {"ok": false, "reason": "%s: odnowienie %.1f s." % [def.name, cooldown_left(id)]}
	var cost := ki_cost(id) * float(stats().kiCostMul)
	if ki < cost:
		return {"ok": false, "reason": "Za mało KI."}
	var result := cast(id)
	if result.ok:
		ki -= cost
		cooldowns[id] = cooldown_of(id) * float(stats().cooldownMul)
		in_combat_until = maxf(in_combat_until, now + 5.0)
		after_cast(id)
		changed.emit()
	return result

func after_cast(_id: String) -> void:
	pass

## Race specific ability. Returns {ok, reason, clip}.
func cast(_id: String) -> Dictionary:
	return {"ok": false, "reason": "Nieznana zdolność."}

func no_target() -> Dictionary:
	return {"ok": false, "reason": "Brak celu w zasięgu. Podejdź do manekina."}

func dodge(direction: Vector2) -> Dictionary:
	if now < next_dodge_at or dead:
		return {"ok": false, "reason": ""}
	var p: Vector2 = player_position.call()
	dash_towards.call(p + direction.normalized() * DODGE_DISTANCE, DODGE_DISTANCE)
	add_buff({"id": "dodge", "ms": 350, "invulnerable": true})
	next_dodge_at = now + DODGE_COOLDOWN
	effect.emit("dash", p, 0.0, "dodge")
	return {"ok": true, "reason": ""}

func lethal_save() -> bool:
	return false

## Damage the player takes: shields first, then HP. `kind` is "melee" or "projectile".
func take_damage(amount: float, kind: String = "melee") -> float:
	if has_buff("invulnerable"):
		return 0.0
	interrupt_channel("hit") if not channel.is_empty() and bool(channel.get("breakOnHit", false)) else null
	var reduced := maxf(1.0, amount * (1.0 - float(gear.get("damageReductionPercent", 0.0)) / 100.0) * (1.0 + debuff_pct("mark")) - float(stats().defense) * 0.5)
	for s in shields:
		if float(s.amount) <= 0.0:
			continue
		if bool(s.get("mirror", false)):
			s.mirror = false
			said.emit("Lustro odbiło atak.")
			return 0.0
		var soaked := minf(float(s.amount), reduced)
		s.amount = float(s.amount) - soaked
		reduced -= soaked
		if reduced <= 0.0:
			return 0.0
	if reduced >= hp and lethal_save():
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

# ---- racial resource (HUD) --------------------------------------------------------------------

func resource_label() -> String:
	return ""

func resource_ratio() -> float:
	return 0.0

func resource_full() -> bool:
	return resource_ratio() >= 1.0

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
			var sid := str(saved_slots[i])
			if sid == "" or (has(sid) and is_active(sid)):
				slots[i] = sid
	refresh()
	hp = clampf(float(value.get("hp", stats().maxHp)), 1.0, float(stats().maxHp))
	ki = clampf(float(value.get("ki", stats().maxKi)), 0.0, float(stats().maxKi))
	changed.emit()
	return true
