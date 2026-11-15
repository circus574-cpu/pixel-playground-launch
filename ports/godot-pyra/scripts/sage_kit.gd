class_name SageKit
extends RaceKit
## Sages (Aetheria): ranged mage and support. Racial mechanic: circles of light. Port of src/game/kit/sage.ts.

func _init(race_data: Dictionary) -> void:
	super._init(race_data)
	base_range = 420.0

func mods() -> Dictionary:
	var m := RaceKit.no_mods()
	if has("A6"): m.critAdd = 0.08 * bonus_rank("A6")
	if has("C2"): m.kiPct = 0.15 * bonus_rank("C2")
	if has("C3"): m.kiCostPct = -0.08 * bonus_rank("C3")
	if has("C5"): m.ccPct = -0.25 * bonus_rank("C5")
	return m

func resource_label() -> String:
	return "Kręgi światła: %d" % circles.size()

func resource_ratio() -> float:
	return minf(1.0, float(circles.size()) / 3.0)

func cooldown_of(id: String) -> float:
	var base := super.cooldown_of(id)
	return base * maxf(0.1, 1.0 - 0.2 * bonus_rank("A3")) if id == "A1" and has("A3") else base

func ability_bonus() -> float:
	if not buff_active("C6"):
		return 0.0
	remove_buff("C6")
	return 0.25 * bonus_rank("C6")

func do_basic() -> Dictionary:
	var foe := pick_foe(float(stats().range))
	if foe == null:
		return no_target()
	var next := take_next_hit()
	effect.emit("swing", player_position.call(), 0.0, "R")
	strike(foe, 1.0, float(next.bonus), bool(next.crit), false, "R")
	return {"ok": true, "reason": "", "foe": foe}

func leave_circle(radius: float, at: Vector2 = Vector2.INF) -> void:
	if not has("B2"):
		return
	var center: Vector2 = player_position.call() if at == Vector2.INF else at
	add_circle({"id": "B2", "x": center.x, "y": center.y, "radius": radius, "ms": 5000, "kind": "light", "defPct": 0.1 * bonus_rank("B2"), "weaken": minf(0.9, 0.1 * bonus_rank("B6")) if has("B6") else 0.0})
	effect.emit("buff", center, radius, "B2")

func explode_seal(foe: Node, id: String, bonus: float) -> void:
	if not is_instance_valid(foe) or foe.hp <= 0.0:
		return
	var at: Vector2 = (foe as Node2D).global_position
	effect.emit("burst", at, 120.0, id)
	strike(foe, cast_damage(id, 2.0), bonus, false, false, id)
	if has("A5"):
		for other in foes_in.call(at, 150.0):
			if other != foe:
				strike(other, bonus_rank("A5"), 0.0, false, false, id)
	if has("A7"):
		add_circle({"id": "A7", "x": at.x, "y": at.y, "radius": 120.0, "ms": 3000, "kind": "light", "dps": 0.4 * bonus_rank("A7")})
	if has("A8"):
		add_ki(15.0 * bonus_rank("A8"))

func after_cast(_id: String) -> void:
	leave_circle(100.0)

func ranged_foe() -> Variant:
	var foe := pick_foe(float(stats().range))
	return foe

func cast(id: String) -> Dictionary:
	var p: Vector2 = player_position.call()
	var s := stats()
	match id:
		"A1":
			var foe := pick_foe(float(s.range))
			if foe == null:
				return no_target()
			var delay := 3.0
			if foe.has_method("seal"):
				foe.seal(delay, minf(0.9, 0.1 * bonus_rank("A2")) if has("A2") else 0.0)
			effect.emit("slash", p, 0.0, "A1")
			var bonus := ability_bonus()
			schedule(delay, func() -> void: explode_seal(foe, "A1", bonus))
			return {"ok": true, "reason": "", "clip": "skill"}
		"A4":
			var foe2 := pick_foe(float(s.range))
			if foe2 == null:
				return no_target()
			var bonus2 := ability_bonus()
			start_channel({"id": "A4", "ms": 3000.0, "every": 500.0, "breakOnMove": false, "breakOnHit": false,
				"on_tick": func() -> void:
					if not is_instance_valid(foe2) or foe2.hp <= 0.0:
						interrupt_channel("other")
						return
					if (player_position.call() as Vector2).distance_to((foe2 as Node2D).global_position) > float(stats().range):
						return
					effect.emit("slash", player_position.call(), 0.0, "A4")
					strike(foe2, cast_damage("A4", 2.4) / 6.0, bonus2, false, false, "A4"),
				"on_end": func(_done: bool) -> void: pass})
			return {"ok": true, "reason": "", "clip": "channel"}
		"A9":
			var foe3 := pick_foe(float(s.range))
			if foe3 == null:
				return no_target()
			var at: Vector2 = (foe3 as Node2D).global_position
			var bonus3 := ability_bonus()
			effect.emit("burst", at, 200.0, "A9")
			schedule(1.5, func() -> void:
				for f in foes_in.call(at, 200.0):
					strike(f, cast_damage("A9", 4.2), bonus3, false, false, "A9"))
			return {"ok": true, "reason": "", "clip": "skillb"}
		"B1":
			var amount := float(s.maxHp) * 0.15 * bonus_rank("B1") * (1.0 + 0.3 * bonus_rank("B7"))
			add_shield({"id": "B1", "ms": 4000.0 + 2000.0 * bonus_rank("B3"), "amount": amount, "max": amount, "reflectProjectile": minf(0.9, 0.15 * bonus_rank("B5")) if has("B5") else 0.0, "mirror": has("B8")})
			effect.emit("buff", p, 120.0, "B1")
			return {"ok": true, "reason": "", "clip": "guard"}
		"B4":
			var chosen: Node = target.call()
			var center: Vector2 = (chosen as Node2D).global_position if is_instance_valid(chosen) and p.distance_to((chosen as Node2D).global_position) <= float(s.range) else p
			add_circle({"id": "B4", "x": center.x, "y": center.y, "radius": 140.0, "ms": 5000, "kind": "slow", "slow": minf(0.9, 0.4 * bonus_rank("B4")), "weaken": minf(0.9, 0.1 * bonus_rank("B6")) if has("B6") else 0.0})
			effect.emit("buff", center, 140.0, "B4")
			return {"ok": true, "reason": "", "clip": "skillc"}
		"B9":
			add_circle({"id": "B9", "x": p.x, "y": p.y, "radius": 220.0, "ms": 8000, "kind": "temple", "slow": minf(0.9, 0.3 * bonus_rank("B9")), "defPct": 0.3 * bonus_rank("B9"), "weaken": minf(0.9, 0.1 * bonus_rank("B6")) if has("B6") else 0.0})
			effect.emit("buff", p, 220.0, "B9")
			return {"ok": true, "reason": "", "clip": "skillb"}
		"C1":
			start_channel({"id": "C1", "ms": 3000.0, "every": 500.0, "breakOnMove": not has("C8"), "breakOnHit": true,
				"on_tick": func() -> void: add_ki(float(stats().maxKi) * 0.05 * bonus_rank("C1")),
				"on_end": func(done: bool) -> void:
					if done and has("C6"):
						add_buff({"id": "C6", "ms": 6000})})
			return {"ok": true, "reason": "", "clip": "channel"}
		"C4":
			var share := (1.0 + 0.5 * bonus_rank("C7")) * 0.2 * bonus_rank("C4")
			start_channel({"id": "C4", "ms": 3000.0, "every": 500.0, "breakOnMove": true, "breakOnHit": true,
				"on_tick": func() -> void: heal(float(stats().maxHp) * share / 6.0),
				"on_end": func(_done: bool) -> void: pass})
			return {"ok": true, "reason": "", "clip": "channel"}
		"C9":
			add_buff({"id": "C9", "ms": 8000, "noKi": true, "dealtPct": 0.3 * bonus_rank("C9")})
			effect.emit("buff", p, 150.0, "C9")
			return {"ok": true, "reason": "", "clip": "skillc"}
		"T":
			var power := bonus_rank("T")
			add_buff({"id": "T", "ms": 20000, "atkPct": 0.25 * power, "cooldownPct": -0.3 * power, "defPct": 0.15 * power})
			effect.emit("buff", p, 200.0, "T")
			said.emit("Forma Oświecenia")
			return {"ok": true, "reason": "", "clip": "kiskill"}
	return {"ok": false, "reason": "Nieznana zdolność."}
