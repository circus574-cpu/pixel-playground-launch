class_name LegendKit
extends RaceKit
## Legends (Pyra): melee burst warrior. Racial mechanic: Żar (Ember). Port of src/game/kit/legend.ts.

var ember := 0.0
var streak := 0
var last_hit_at := -1000.0
var was_in_combat := false

func _init(race_data: Dictionary) -> void:
	super._init(race_data)
	base_range = 78.0

func on_reset() -> void:
	ember = 0.0

func mods() -> Dictionary:
	var m := RaceKit.no_mods()
	if has("A5"): m.atkPct = 0.08 * bonus_rank("A5")
	if has("A6"): m.critAdd = 0.06 * bonus_rank("A6")
	if has("B2"): m.defPct = 0.08 * bonus_rank("B2")
	if has("B3"): m.hpPct = 0.1 * bonus_rank("B3")
	if has("C6") and ember >= 100.0: m.kiRegenPct = 0.5 * bonus_rank("C6")
	return m

func dealt_vs(_foe: Node) -> float:
	var bonus := minf(0.1, ember * 0.001)
	if has("A8") and (foes_in.call(player_position.call(), 200.0) as Array).size() == 1:
		bonus += 0.25 * bonus_rank("A8")
	return bonus

func resource_label() -> String:
	return "Żar %d / 100" % int(round(ember))

func resource_ratio() -> float:
	return ember / 100.0

func gain_ember(n: float) -> void:
	ember = minf(100.0, ember + n * (1.0 + 0.5 * bonus_rank("C2")))

func after_strike(_foe: Node, dealt: float, indirect: bool) -> void:
	if not indirect and dealt > 0.0:
		gain_ember(4.0)
		streak = 1 if now - last_hit_at > 2.5 else streak + 1
		last_hit_at = now
		if has("A3") and streak >= 3:
			streak = 0
			add_buff({"id": "A3", "ms": 4000, "intervalPct": -0.1 * bonus_rank("A3")})

func on_tick(delta: float) -> void:
	var fighting := in_combat()
	if buff_active("T"):
		ember = 100.0
	elif fighting and not was_in_combat and has("C5"):
		ember = maxf(ember, 20.0)
	elif not fighting:
		ember = maxf(0.0, ember - 5.0 / (1.0 + bonus_rank("C2")) * delta)
	was_in_combat = fighting

func on_kill(_foe: Node) -> void:
	if has("B6"):
		heal(float(stats().maxHp) * 0.03 * bonus_rank("B6"))

func lethal_save() -> bool:
	if not buff_active("B9"):
		return false
	remove_buff("B9")
	hp = 1.0
	heal(float(stats().maxHp) * 0.3 * bonus_rank("B9"))
	said.emit("Ostatni Płomień ocalił Cię przed śmiercią.")
	return true

func ignite(foe: Node, total_atk: float, ms: float) -> void:
	if is_instance_valid(foe) and foe.has_method("burn"):
		foe.burn(float(stats().attack) * total_atk / (ms / 1000.0), ms / 1000.0)

func do_basic() -> Dictionary:
	var p: Vector2 = player_position.call()
	var foe := pick_foe(base_range + 18.0)
	effect.emit("swing", p, 0.0, "R")
	if foe != null:
		strike(foe, 1.0, 0.0, false, false, "R")
	return {"ok": true, "reason": "", "foe": foe}

func cuts(id: String, foe: Node, count: int, total: float, gap: float, burn: Array) -> void:
	var each := total / float(count)
	var foe_ref: WeakRef = weakref(foe)
	for i in count:
		schedule(float(i) * gap, func() -> void:
			var cut_foe: Node = foe_ref.get_ref() as Node
			if not is_instance_valid(cut_foe) or cut_foe.hp <= 0.0:
				return
			var p: Vector2 = player_position.call()
			if p.distance_to((cut_foe as Node2D).global_position) > base_range + 28.0:
				return
			effect.emit("slash", p, 0.0, id)
			strike(cut_foe, each, 0.0, false, false, id)
			if not burn.is_empty() and i == count - 1:
				ignite(cut_foe, float(burn[0]), float(burn[1])))

func cast(id: String) -> Dictionary:
	var p: Vector2 = player_position.call()
	var reach := base_range + 14.0
	match id:
		"A1":
			var foe := pick_foe(reach)
			if foe == null:
				return no_target()
			var five := has("A7")
			var total := (cast_damage("A1", 1.8) + (0.8 * bonus_rank("A7") * cast_growth("A1") if five else 0.0))
			cuts("A1", foe, 5 if five else 3, total, 0.15, [0.3 * bonus_rank("A2"), 3000.0] if has("A2") else [])
			return {"ok": true, "reason": "", "clip": "attack"}
		"A4":
			var foe2 := pick_foe(300.0)
			if foe2 == null:
				return no_target()
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
				return no_target()
			cuts("A9", foe3, 8, cast_damage("A9", 4.2), 0.12, [])
			return {"ok": true, "reason": "", "clip": "finisher"}
		"B1":
			var foe4 := pick_foe(reach)
			if foe4 == null:
				return no_target()
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
			effect.emit("burst", p, radius, "C1")
			for f in foes_in.call(p, radius):
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
			effect.emit("burst", p, r, "C4")
			for f2 in foes_in.call(p, r):
				strike(f2, mult, 0.0, false, false, "C4")
			ember = 0.0
			return {"ok": true, "reason": "", "clip": "skillc"}
		"C9":
			var chosen: Node = target.call()
			var facing: Vector2 = player_facing.call()
			var at: Vector2 = (chosen as Node2D).global_position if is_instance_valid(chosen) else p + facing * 150.0
			effect.emit("burst", at, 240.0, "C9")
			for f3 in foes_in.call(at, 240.0):
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
