class_name AndroidKit
extends RaceKit
## Androids (Nexus-9): precise shooter with shields. Racial mechanic: Core Charge (Ładunek Rdzenia). Port of src/game/kit/android.ts.

var charge := 0.0
var overheat := 0.0
var last_shot := -1000.0

func _init(race_data: Dictionary) -> void:
	super._init(race_data)
	base_range = 360.0

func on_reset() -> void:
	charge = 0.0
	overheat = 0.0

func max_charge() -> float:
	return 70.0 if has("C8") else 150.0 if has("C7") else 100.0

func mods() -> Dictionary:
	var m := RaceKit.no_mods()
	if has("A2"): m.critAdd = 0.06 * bonus_rank("A2")
	if has("A3"): m.rangePct = 0.15 * bonus_rank("A3")
	var iv := 0.0
	if has("A6"): iv -= 0.08 * bonus_rank("A6")
	if has("A7"): iv += 0.1 * bonus_rank("A7")
	m.intervalPct = iv
	if has("B2"): m.defPct = 0.08 * bonus_rank("B2")
	if has("B6"): m.hpRegenAlways = 0.005 * bonus_rank("B6")
	if has("C5"): m.kiPct = 0.12 * bonus_rank("C5")
	return m

func ki_cost(id: String) -> float:
	if id == "C1":
		return maxf(0.0, 15.0 - 3.0 * bonus_rank("C6"))
	return super.ki_cost(id)

func cooldown_of(id: String) -> float:
	var base := super.cooldown_of(id)
	return base * maxf(0.1, 1.0 - 0.35 * bonus_rank("B8")) if id == "B1" and has("B8") else base

func crit_vs(foe: Node) -> float:
	return 15.0 * bonus_rank("A1") if has("A1") and foe.has_method("is_marked") and foe.is_marked() else 0.0

func dealt_vs(foe: Node) -> float:
	return 0.4 * bonus_rank("A7") if has("A7") and foe.has_method("is_marked") and foe.is_marked() else 0.0

func overheat_enabled() -> bool:
	return not has("C8") and not buff_active("T")

func can_attack() -> String:
	return "Przegrzanie rdzenia." if overheat > 0.0 else ""

func resource_label() -> String:
	return "Ładunek %d / %d%s" % [int(round(charge)), int(max_charge()), " (PRZEGRZANIE)" if overheat > 0.0 else ""]

func resource_ratio() -> float:
	return charge / max_charge()

func add_charge(n: float) -> void:
	charge = minf(max_charge(), charge + n * maxf(0.1, 1.0 - 0.15 * bonus_rank("C3")))
	last_shot = now
	if charge >= max_charge() and overheat_enabled():
		overheat = maxf(0.0, 2.0 - 1.0 * bonus_rank("C2"))
		said.emit("Przegrzanie rdzenia!")

func on_tick(delta: float) -> void:
	if overheat > 0.0:
		overheat = maxf(0.0, overheat - delta)
		if overheat == 0.0:
			charge = minf(charge, max_charge() * 0.5)
	if now - last_shot > 1.0 and charge > 0.0:
		charge = maxf(0.0, charge - 6.0 * (1.0 + 0.5 * bonus_rank("C2")) * delta)
	charge = minf(charge, max_charge())

func do_basic() -> Dictionary:
	var foe := pick_foe(float(stats().range))
	if foe == null:
		return no_target()
	var next := take_next_hit()
	effect.emit("swing", player_position.call(), 0.0, "R")
	strike(foe, 1.0, float(next.bonus), bool(next.crit), false, "R")
	if has("A8"):
		var others: Array = (foes_in.call((foe as Node2D).global_position, 220.0) as Array).filter(func(f: Node) -> bool: return f != foe)
		for i in mini(2, others.size()):
			strike(others[i], 0.4 * bonus_rank("A8"), 0.0, false, false, "R")
	add_charge(4.0)
	return {"ok": true, "reason": "", "foe": foe}

func marked_foe() -> Variant:
	var foe := pick_foe(float(stats().range))
	if foe == null:
		return "Brak celu w zasięgu. Podejdź do manekina."
	if not (foe.has_method("is_marked") and foe.is_marked()):
		return "Najpierw oznacz cel (Namierzanie)."
	return foe

func cast(id: String) -> Dictionary:
	var p: Vector2 = player_position.call()
	var s := stats()
	match id:
		"A1":
			var foe := pick_foe(float(s.range))
			if foe == null:
				return no_target()
			if foe.has_method("mark"):
				foe.mark(6.0, 15.0, minf(0.9, 0.1 * bonus_rank("A5")) if has("A5") else 0.0)
			effect.emit("slash", p, 0.0, "A1")
			return {"ok": true, "reason": "", "clip": "skill"}
		"A4":
			var target_foe: Variant = marked_foe()
			if target_foe is String:
				return {"ok": false, "reason": target_foe}
			for i in 3:
				schedule(float(i) * 0.15, func() -> void:
					if not is_instance_valid(target_foe) or target_foe.hp <= 0.0:
						return
					effect.emit("slash", player_position.call(), 0.0, "A4")
					strike(target_foe, cast_damage("A4", 2.2) / 3.0, 0.0, false, false, "A4"))
			return {"ok": true, "reason": "", "clip": "attack2"}
		"A9":
			var finish: Variant = marked_foe()
			if finish is String:
				return {"ok": false, "reason": finish}
			var hp_fraction: float = float(finish.hp) / float(finish.max_hp) if "max_hp" in finish else 1.0
			effect.emit("slash", p, 0.0, "A9")
			strike(finish, cast_damage("A9", 6.0 if hp_fraction < 0.3 else 4.0), 0.0, false, false, "A9")
			return {"ok": true, "reason": "", "clip": "finisher"}
		"B1":
			var amount := float(s.maxHp) * 0.18 * bonus_rank("B1") * (1.0 + 0.25 * bonus_rank("B3"))
			add_shield({"id": "B1", "ms": 5000.0, "amount": amount, "max": amount, "reflectProjectile": minf(0.9, 0.25 * bonus_rank("B5")) if has("B5") else 0.0, "reflectMelee": minf(0.9, 0.3 * bonus_rank("B7")) if has("B7") else 0.0})
			effect.emit("buff", p, 120.0, "B1")
			return {"ok": true, "reason": "", "clip": "guard"}
		"B4":
			effect.emit("burst", p, 160.0, "B4")
			for f in foes_in.call(p, 160.0):
				strike(f, cast_damage("B4", 1.2), 0.0, false, false, "B4")
				if f.has_method("push"): f.push(p, 120.0)
				if f.has_method("stun"): f.stun(0.5)
			return {"ok": true, "reason": "", "clip": "skillc"}
		"B9":
			add_buff({"id": "B9", "ms": 6000, "defPct": 0.6 * bonus_rank("B9"), "ccImmune": true})
			effect.emit("buff", p, 150.0, "B9")
			said.emit("Fortyfikacja")
			return {"ok": true, "reason": "", "clip": "skillb"}
		"C1":
			var used := minf(charge, max_charge())
			var mult := cast_damage("C1", 1.0 + used / 50.0)
			var f2: Vector2 = player_facing.call()
			effect.emit("burst", p + f2 * 180.0, 90.0, "C1")
			for foe2 in foes_in.call(p, 360.0):
				var d: Vector2 = (foe2 as Node2D).global_position - p
				var along := d.dot(f2)
				var across := absf(d.x * f2.y - d.y * f2.x)
				if along > 0.0 and along <= 360.0 and across <= 50.0:
					strike(foe2, mult, 0.0, false, false, "C1")
			charge = 0.0
			return {"ok": true, "reason": "", "clip": "skillc"}
		"C4":
			charge = 0.0
			overheat = 0.0
			heal(float(s.maxHp) * 0.1 * bonus_rank("C4"))
			effect.emit("buff", p, 120.0, "C4")
			return {"ok": true, "reason": "", "clip": "channel"}
		"C9":
			add_buff({"id": "C9", "ms": 6000, "noKi": true, "dealtPct": 0.4 * bonus_rank("C9")})
			schedule(6.0, func() -> void:
				lock_s = 2.0
				said.emit("Przeciążenie: układy wyłączone na 2 s."))
			effect.emit("buff", p, 160.0, "C9")
			said.emit("Przeciążenie Systemu")
			return {"ok": true, "reason": "", "clip": "skillc"}
		"T":
			var power := bonus_rank("T")
			add_buff({"id": "T", "ms": 20000, "atkPct": 0.25 * power, "defPct": 0.15 * power})
			overheat = 0.0
			effect.emit("buff", p, 200.0, "T")
			said.emit("Forma Pełnego Rdzenia")
			return {"ok": true, "reason": "", "clip": "kiskill"}
	return {"ok": false, "reason": "Nieznana zdolność."}
