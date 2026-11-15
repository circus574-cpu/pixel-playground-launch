class_name PlanetaryKit
extends RaceKit
## Planetary (Verdantia): mobile melee fighter. Racial mechanic: adaptation to terrain (B2). Port of src/game/kit/planetary.ts.

var series := 0

func _init(race_data: Dictionary) -> void:
	super._init(race_data)
	base_range = 78.0

func mods() -> Dictionary:
	var m := RaceKit.no_mods()
	var terrain: String = str(terrain_at.call()) if has("B2") else "open"
	var adapt := bonus_rank("B2")
	if has("A2"): m.speedPct += 0.06 * bonus_rank("A2")
	if has("A6"): m.critAdd = 0.05 * bonus_rank("A6")
	if has("B3"): m.defPct += 0.08 * bonus_rank("B3")
	if has("C2"): m.hpPct = 0.1 * bonus_rank("C2")
	if has("C3"): m.hpRegenOoc = 0.01 * bonus_rank("C3")
	if has("C5"): m.ccPct = -0.25 * bonus_rank("C5")
	if terrain == "forest": m.kiRegenPct = 0.3 * adapt
	if terrain == "rock": m.defPct += 0.1 * adapt
	if terrain == "water": m.speedPct += 0.08 * adapt
	return m

func resource_label() -> String:
	if not has("B2"):
		return "Adaptacja: poznaj B2"
	return "Teren: %s" % {"forest": "las (+KI)", "rock": "skały (+obrona)", "water": "woda (+szybkość)"}.get(str(terrain_at.call()), "otwarty")

func resource_ratio() -> float:
	return 1.0 if has("B2") and str(terrain_at.call()) != "open" else 0.0

func cooldown_of(id: String) -> float:
	var base := super.cooldown_of(id)
	return base * maxf(0.1, 1.0 - 0.3 * bonus_rank("A8")) if id == "A1" and has("A8") else base

func do_basic() -> Dictionary:
	var foe := pick_foe(float(stats().range))
	if foe == null:
		return no_target()
	var p: Vector2 = player_position.call()
	series = 1 if now - last_basic_at > 1.8 else series + 1
	var third := series % 3 == 0
	var next := take_next_hit()
	effect.emit("swing", p, 0.0, "R")
	strike(foe, 1.3 if third else 1.0, float(next.bonus), bool(next.crit), false, "R")
	return {"ok": true, "reason": "", "foe": foe}

func on_kill(_foe: Node) -> void:
	if has("A5"):
		add_buff({"id": "A5", "ms": 4000, "speedPct": 0.15 * bonus_rank("A5")})

func aoe(id: String, center: Vector2, radius: float, mult: float, extra: Callable) -> Array:
	var next := take_next_hit()
	var foes: Array = foes_in.call(center, radius)
	effect.emit("burst", center, radius, id)
	for f in foes:
		strike(f, mult, float(next.bonus), bool(next.crit), false, id)
		extra.call(f)
	return foes

func cast(id: String) -> Dictionary:
	var p: Vector2 = player_position.call()
	var f: Vector2 = player_facing.call()
	match id:
		"A1":
			dash_towards.call(p + f * 160.0, 160.0)
			add_buff({"id": "dodge", "ms": 400, "invulnerable": true})
			if has("A3"): add_buff({"id": "A3", "ms": 5000, "nextHitPct": 0.25 * bonus_rank("A3")})
			if has("A7"): add_buff({"id": "A7", "ms": 5000, "guaranteedCrit": true})
			if has("A8"): add_buff({"id": "A8", "ms": 1000, "defPct": 0.2 * bonus_rank("A8")})
			effect.emit("buff", p, 90.0, "A1")
			return {"ok": true, "reason": "", "clip": "dodge"}
		"A4":
			aoe("A4", p, 140.0, cast_damage("A4", 1.8), func(_x: Node) -> void: pass)
			return {"ok": true, "reason": "", "clip": "skill"}
		"A9":
			if (foes_in.call(p, 160.0) as Array).is_empty():
				return {"ok": false, "reason": "Brak wrogów w pobliżu."}
			effect.emit("burst", p, 160.0, "A9")
			for i in 5:
				schedule(float(i) * 0.15, func() -> void:
					var alive: Array = foes_in.call(player_position.call(), 160.0)
					if not alive.is_empty():
						strike(alive[i % alive.size()], cast_damage("A9", 4.0) / 5.0, 0.0, false, false, "A9"))
			return {"ok": true, "reason": "", "clip": "finisher"}
		"B1":
			var radius := 120.0 * (1.0 + 0.4 * bonus_rank("B8"))
			var primary := cast_damage("B1", 1.4)
			var got := b1_hit(radius, primary, true)
			if has("B6"):
				var r := bonus_rank("B6")
				add_ki(minf(15.0 * r, float(got) * 5.0 * r))
			if has("B5"):
				schedule(0.5, func() -> void: b1_hit(radius, primary * 0.6 * bonus_rank("B5"), false))
			return {"ok": true, "reason": "", "clip": "skillc"}
		"B4":
			var foe := pick_foe(300.0)
			if foe == null:
				return no_target()
			var gap := maxf(0.0, p.distance_to((foe as Node2D).global_position) - 40.0)
			if gap > 220.0:
				return {"ok": false, "reason": "Cel zbyt daleko (220)."}
			dash_towards.call((foe as Node2D).global_position, gap)
			var q: Vector2 = player_position.call()
			effect.emit("burst", q, 100.0, "B4")
			for x in foes_in.call(q, 100.0):
				strike(x, cast_damage("B4", 2.0), 0.0, false, false, "B4")
				if x.has_method("stun"): x.stun(1.0)
			if has("B7"):
				var amount := float(stats().maxHp) * 0.15 * bonus_rank("B7")
				add_shield({"id": "B7", "ms": 5000, "amount": amount, "max": amount})
			return {"ok": true, "reason": "", "clip": "skill"}
		"B9":
			aoe("B9", p, 220.0, cast_damage("B9", 4.0), func(x: Node) -> void:
				if x.has_method("stun"): x.stun(1.5))
			return {"ok": true, "reason": "", "clip": "skillb"}
		"C1":
			var total := float(stats().maxHp) * 0.12 * bonus_rank("C1") * (1.0 + 0.3 * bonus_rank("C6"))
			hot(total, 4000.0)
			if has("C8"): add_ki(15.0 * bonus_rank("C8"))
			effect.emit("buff", p, 110.0, "C1")
			return {"ok": true, "reason": "", "clip": "channel"}
		"C4":
			var shield_amount := float(stats().maxHp) * 0.18 * bonus_rank("C4")
			add_shield({"id": "C4", "ms": 5000, "amount": shield_amount, "max": shield_amount, "reflectMelee": minf(0.9, 0.2 * bonus_rank("C7")) if has("C7") else 0.0})
			effect.emit("buff", p, 120.0, "C4")
			return {"ok": true, "reason": "", "clip": "guard"}
		"C9":
			var power := bonus_rank("C9")
			heal(float(stats().maxHp) * 0.4 * power)
			var amount2 := float(stats().maxHp) * 0.2 * power
			add_shield({"id": "C9", "ms": 6000, "amount": amount2, "max": amount2})
			effect.emit("buff", p, 160.0, "C9")
			return {"ok": true, "reason": "", "clip": "skillc"}
		"T":
			var power2 := bonus_rank("T")
			add_buff({"id": "T", "ms": 20000, "atkPct": 0.2 * power2, "defPct": 0.15 * power2, "speedPct": 0.1 * power2})
			effect.emit("buff", p, 200.0, "T")
			said.emit("Forma Rezonansu Świata")
			return {"ok": true, "reason": "", "clip": "kiskill"}
	return {"ok": false, "reason": "Nieznana zdolność."}

func b1_hit(radius: float, mult: float, first: bool) -> int:
	var p: Vector2 = player_position.call()
	var foes: Array = foes_in.call(p, radius)
	effect.emit("burst", p, radius, "B1")
	for foe in foes:
		strike(foe, mult, 0.0, false, false, "B1")
		if first:
			if foe.has_method("slow"): foe.slow(0.3, 2.0)
			if has("B8") and foe.has_method("stun"): foe.stun(minf(3.0, 0.5 * bonus_rank("B8")))
	return foes.size()
