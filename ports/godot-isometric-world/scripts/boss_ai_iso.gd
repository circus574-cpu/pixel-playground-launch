extends RefCounted
## Stage 4: 41-Monster Differentiated AI, Elemental Weaknesses, Ground Telegraphs,
## Persistent Hazard Zones, Hero Debuffs, and 8 Multi-Phase Canonical Bosses.

const BossVisuals := preload("res://scripts/boss_visuals.gd")

var world: Node2D
var bosses_db: Array[Dictionary] = []
var active_telegraphs: Array[Dictionary] = []
var active_hazards: Array[Dictionary] = []
var safe_spots: Array[Dictionary] = []
var hero_debuffs: Dictionary = {} # key -> {"t": float, "dps": float, "acc": float}
var _active_boss_id := ""

const WEAK_LABELS := {
	"fire": "🔥 OGIEŃ",
	"electric": "⚡ ELEKTR.",
	"ki": "✦ KI",
	"water": "💧 WODA",
	"area": "💥 OBSZAR",
	"physical": "⚔ FIZ.",
	"stun": "★ OGŁUSZ.",
}

const DEBUFF_META := {
	"slow": {"label": "SPOWOL.", "col": Color(0.42, 0.78, 1.0)},
	"root": {"label": "UNIERUCH.", "col": Color(0.46, 0.92, 0.42)},
	"stun": {"label": "OGŁUSZ.", "col": Color(1.0, 0.88, 0.24)},
	"poison": {"label": "TRUCIZNA", "col": Color(0.32, 0.96, 0.42)},
	"burn": {"label": "PODPAL.", "col": Color(1.0, 0.46, 0.16)},
	"bleed": {"label": "KRWAW.", "col": Color(0.96, 0.22, 0.24)},
	"armorDown": {"label": "PANC.-25%", "col": Color(0.92, 0.62, 0.28)},
	"healBlock": {"label": "BLOK LECZ.", "col": Color(0.94, 0.24, 0.68)},
}

func setup(w: Node2D) -> void:
	world = w
	load_bosses()

func load_bosses() -> void:
	bosses_db.clear()
	if not FileAccess.file_exists("res://data/bosses.json"):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/bosses.json"))
	if parsed is Dictionary:
		var arr: Variant = (parsed as Dictionary).get("bosses", [])
		if arr is Array:
			for b: Variant in arr:
				if b is Dictionary:
					bosses_db.append(b as Dictionary)

func clear_transient() -> void:
	active_telegraphs.clear()
	active_hazards.clear()
	safe_spots.clear()
	hero_debuffs.clear()
	_active_boss_id = ""

# ==============================================================================
# 1) ELEMENTAL WEAKNESSES & HERO DEBUFF QUERIES
# ==============================================================================
func hero_attack_elements(race_k: String, nid: String, skill_idx: int, is_aoe: bool, ki_active: bool) -> Array[String]:
	var els: Array[String] = []
	match race_k:
		"legend":
			els.append("fire")
			els.append("physical")
			if nid in ["C1", "C4", "C9", "T"] or ki_active:
				els.append("ki")
			if nid == "B1":
				els.append("stun")
		"planetary":
			els.append("physical")
			if nid in ["C1", "C4", "C9"] or (world != null and world.has_method("is_in_water") and world.is_in_water(world.hero_pos.x, world.hero_pos.y)):
				els.append("water")
			if nid in ["B1", "B4", "B9", "T"] or ki_active:
				els.append("ki")
			if nid in ["B4", "B9"]:
				els.append("stun")
		"sage":
			els.append("ki")
			els.append("water")
			if nid == "A9" or nid == "A1":
				els.append("fire")
		"android":
			els.append("electric")
			els.append("ki")
			if nid == "B4":
				els.append("stun")
			if skill_idx == 0:
				els.append("physical")
		_:
			els.append("physical")
	if is_aoe:
		els.append("area")
	return els

func compute_element_modifier(target: Dictionary, elements: Array[String]) -> Dictionary:
	var weak: Dictionary = target.get("weak", {}) if target.get("weak") is Dictionary else {}
	var best_mult := 1.0
	var matched_key := ""
	for el: String in elements:
		if weak.has(el):
			var m := float(weak[el])
			if m > best_mult or (matched_key.is_empty() and m != 1.0):
				best_mult = m
				matched_key = el
	# Boss dynamic vulnerability/armor modifiers
	if bool(target.get("is_boss", false)):
		var b_mult := float(target.get("boss_dmg_taken_mult", 1.0))
		if bool(target.get("boss_shield_active", false)):
			b_mult *= 0.25
		if float(target.get("boss_vuln_t", 0.0)) > 0.05:
			b_mult *= 1.40
		best_mult *= b_mult
	else:
		var traits: Dictionary = target.get("traits", {}) if target.get("traits") is Dictionary else {}
		if bool(traits.get("frontArmor", false)) and float(target.get("stun_t", 0.0)) <= 0.05:
			best_mult *= 0.82
		if bool(target.get("curled", false)):
			best_mult *= 0.55
	var tag := ""
	if best_mult >= 1.15:
		tag = "SŁABOŚĆ!"
	elif best_mult <= 0.75:
		tag = "ODPORNOŚĆ"
	return {"mult": clampf(best_mult, 0.20, 2.50), "tag": tag, "key": matched_key}

func weakness_tags_for(ag: Dictionary) -> Array[String]:
	var out: Array[String] = []
	var weak: Dictionary = ag.get("weak", {}) if ag.get("weak") is Dictionary else {}
	for k: String in weak.keys():
		var m := float(weak[k])
		if m > 1.05:
			var lbl := str(WEAK_LABELS.get(k, k.to_upper()))
			out.append("%s ×%.1f" % [lbl, m])
	if bool(ag.get("is_boss", false)) and out.is_empty():
		var wtxt := str(ag.get("boss_weakness_text", ""))
		if not wtxt.is_empty():
			out.append(wtxt.substr(0, 34))
	return out

func apply_hero_debuff(kind: String, dur: float, dps: float = 0.0) -> void:
	if dur <= 0.05:
		return
	var cur: Dictionary = hero_debuffs.get(kind, {"t": 0.0, "dps": 0.0, "acc": 0.0})
	cur["t"] = maxf(float(cur.get("t", 0.0)), dur)
	cur["dps"] = maxf(float(cur.get("dps", 0.0)), dps)
	hero_debuffs[kind] = cur
	if world != null and world.hero != null and world.hero.has_method("show_damage_number"):
		var meta: Dictionary = DEBUFF_META.get(kind, {"label": kind.to_upper(), "col": Color(1.0, 0.5, 0.3)})
		world.hero.show_damage_number(str(meta["label"]), meta["col"] as Color, false)

func is_hero_healing_blocked() -> bool:
	return float((hero_debuffs.get("healBlock", {}) as Dictionary).get("t", 0.0)) > 0.05

func is_hero_rooted() -> bool:
	return float((hero_debuffs.get("root", {}) as Dictionary).get("t", 0.0)) > 0.05

func is_hero_stunned() -> bool:
	return float((hero_debuffs.get("stun", {}) as Dictionary).get("t", 0.0)) > 0.05

func get_hero_slow_mult() -> float:
	if is_hero_stunned() or is_hero_rooted():
		return 0.0
	if float((hero_debuffs.get("slow", {}) as Dictionary).get("t", 0.0)) > 0.05:
		return 0.68
	return 1.0

func get_hero_armor_down_mult() -> float:
	if float((hero_debuffs.get("armorDown", {}) as Dictionary).get("t", 0.0)) > 0.05:
		return 0.75
	return 1.0

func get_hero_debuff_pills() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for k: String in DEBUFF_META.keys():
		if hero_debuffs.has(k):
			var t := float((hero_debuffs[k] as Dictionary).get("t", 0.0))
			if t > 0.05:
				var m: Dictionary = DEBUFF_META[k]
				out.append({"id": k, "label": "%s %.0fs" % [str(m["label"]), ceil(t)], "col": m["col"]})
	return out

# ==============================================================================
# 2) HYDRATING 41 MONSTER SPECIES + SPAWNING 8 CANONICAL BOSSES
# ==============================================================================
func hydrate_monster_agent(ag: Dictionary, m_entry: Dictionary) -> void:
	if m_entry.is_empty():
		return
	var raw_range := float(m_entry.get("range", 95.0))
	var raw_agro := float(m_entry.get("agro", 300.0))
	var raw_spd := float(m_entry.get("speed", 1.0))
	var traits: Dictionary = (m_entry.get("traits", {}) as Dictionary).duplicate(true) if m_entry.get("traits") is Dictionary else {}
	var weak: Dictionary = (m_entry.get("weak", {}) as Dictionary).duplicate(true) if m_entry.get("weak") is Dictionary else {}
	var skills: Array = (m_entry.get("skills", []) as Array).duplicate(true) if m_entry.get("skills") is Array else []
	ag["basic"] = str(m_entry.get("basic", "melee"))
	ag["atk_range"] = clampf(raw_range * 0.38, 42.0, 210.0)
	ag["agro_range"] = clampf(raw_agro * 0.36, 76.0, 235.0)
	ag["atk_cd_base"] = clampf(float(m_entry.get("attackCd", 1500.0)) / 1000.0, 0.85, 2.8)
	ag["speed_mult"] = clampf(raw_spd, 0.0, 1.8)
	ag["chase_speed"] = 0.0 if (bool(traits.get("still", false)) or bool(traits.get("turret", false)) or raw_spd <= 0.01) else clampf(19.5 * raw_spd, 9.0, 31.0)
	ag["def_stat"] = int(m_entry.get("def", 6))
	ag["weak"] = weak
	ag["traits"] = traits
	ag["skills"] = skills
	ag["skill_cds"] = {}
	ag["skill_used_once"] = {}
	ag["revived"] = false
	ag["curled"] = false
	ag["ambush_hidden"] = traits.has("ambush") or traits.has("burrow")
	if bool(ag["ambush_hidden"]) and is_instance_valid(ag.get("node", null)):
		(ag["node"] as Node2D).modulate.a = 0.28

func spawn_region_bosses(land: String) -> void:
	if world == null or bosses_db.is_empty():
		return
	var ActorScript = world.ActorScript
	for b: Dictionary in bosses_db:
		if str(b.get("continent", "")) != land:
			continue
		var bid := str(b.get("id", ""))
		var guardian_id := str(b.get("guardian", ""))
		if not world.monsters_db.has(guardian_id):
			continue
		var m_entry: Dictionary = world.monsters_db[guardian_id]
		var m_actor_def := BossVisuals.actor_definition(bid, m_entry.get("actor", {}))
		if m_actor_def.is_empty():
			continue
		var arena_arr: Array = b.get("arenaPos", [])
		if arena_arr.size() < 2:
			continue
		var bx := float(arena_arr[0])
		var bz := float(arena_arr[1])
		var b_lv := int(b.get("level", 15))
		var stats: Dictionary = b.get("stats", {}) if b.get("stats") is Dictionary else {}
		var b_hp := int(stats.get("hp", 4500))
		var b_atk := int(stats.get("atk", 60))
		var b_def := int(stats.get("def", 35))
		var b_xp := int(stats.get("xp", 550))
		var b_mon: Dictionary = b.get("monster", {}) if b.get("monster") is Dictionary else {}
		var b_actor = ActorScript.new()
		b_actor.is_boss = true
		b_actor.boss_phase = 1
		b_actor.setup(m_actor_def, str(b.get("name", bid)), false, false, "monster", b_lv, "", "", true)
		var sc := 1.75 if b_lv >= 20 else 1.58
		b_actor.scale = Vector2(0.47 * sc, 0.47 * sc)
		b_actor.position = world.iso(bx, bz, world.height_at(bx, bz))
		world.ysort.add_child(b_actor)

		# Derive canonical elemental weaknesses from boss weakness text + continent
		var weak_dict: Dictionary = {}
		var wlow := str(b.get("weakness", "")).to_lower()
		if "ogie" in wlow: weak_dict["fire"] = 1.25
		if "ki" in wlow: weak_dict["ki"] = 1.20
		if "elektr" in wlow or "prąd" in wlow: weak_dict["electric"] = 1.25
		if "wod" in wlow or "mróz" in wlow or "lód" in wlow: weak_dict["water"] = 1.25
		if "ogłusz" in wlow: weak_dict["stun"] = 1.25
		if weak_dict.is_empty():
			weak_dict["ki"] = 1.15

		var b_traits: Dictionary = (b_mon.get("traits", {}) as Dictionary).duplicate(true) if b_mon.get("traits") is Dictionary else {}
		var b_skills: Array = (b_mon.get("skills", []) as Array).duplicate(true) if b_mon.get("skills") is Array else []
		var raw_spd := float(b.get("speed", 0.9))
		var ag := {
			"kind": "monster",
			"id": "boss:%s" % bid,
			"boss_id": bid,
			"is_boss": true,
			"is_elite": true,
			"actor_id": guardian_id,
			"name": str(b.get("name", bid)),
			"boss_title": str(b.get("title", "")),
			"boss_weakness_text": str(b.get("weakness", "")),
			"boss_data": b,
			"boss_phase": 1,
			"boss_atk_mult": 1.0,
			"boss_spd_mult": 1.0,
			"boss_dmg_taken_mult": 1.0,
			"boss_shield_active": false,
			"boss_shield_adds": [],
			"boss_vuln_t": 0.0,
			"boss_mech_t": 5.0,
			"boss_regen_acc": 0.0,
			"level": b_lv,
			"max_hp": b_hp,
			"cur_hp": b_hp,
			"atk": b_atk,
			"def_stat": b_def,
			"atk_cd": 0.0,
			"atk_cd_base": 1.35,
			"atk_range": clampf(float(b.get("range", 180.0)) * 0.42, 65.0, 220.0),
			"agro_range": clampf(float(b.get("agro", 500.0)) * 0.42, 145.0, 260.0),
			"basic": str(b_mon.get("basic", "melee")),
			"speed_mult": raw_spd,
			"chase_speed": 0.0 if (bool(b_traits.get("still", false)) or raw_spd <= 0.01) else clampf(21.0 * raw_spd, 14.0, 30.0),
			"weak": weak_dict,
			"traits": b_traits,
			"skills": b_skills,
			"skill_cds": {},
			"skill_used_once": {},
			"aggro_windup": 0.0,
			"was_aggro": false,
			"atk_count": 0,
			"roared": false,
			"dmg_dealt_to_hero": 0,
			"xp": b_xp,
			"gold": 220 + b_lv * 20,
			"alive": true,
			"death_hide_t": 0.0,
			"respawn_t": 0.0,
			"node": b_actor,
			"home": Vector2(bx, bz),
			"pos": Vector2(bx, bz),
			"radius": 24.0,
			"speed": 14.0,
			"phase": 0.0,
			"ai_state": "idle",
			"ai_timer": 2.0,
			"ai_target": Vector2(bx, bz),
		}
		world.live_agents.append(ag)

func _spawn_minion(kind_id: String, origin: Vector2, boss_owner_id: String = "") -> String:
	if world == null or not world.monsters_db.has(kind_id):
		return ""
	# Limit active minions in world so fights never lag on mobile
	var minion_cnt := 0
	for a: Dictionary in world.live_agents:
		if bool(a.get("is_minion", false)) and bool(a.get("alive", true)):
			minion_cnt += 1
	if minion_cnt >= 8:
		return ""
	var m_entry: Dictionary = world.monsters_db[kind_id]
	var m_actor_def: Dictionary = m_entry.get("actor", {})
	if m_actor_def.is_empty():
		return ""
	var ang := randf() * TAU
	var pos := origin + Vector2(cos(ang), sin(ang)) * randf_range(32.0, 58.0)
	if not world.is_walkable(pos.x, pos.y):
		pos = origin
	var m_lv := maxi(1, int(m_entry.get("level", 4)))
	var m_hp := maxi(65, int(round(float(m_entry.get("hp", 120)) * 0.72)))
	var m_atk := maxi(10, int(round(float(m_entry.get("atk", 18)) * 0.80)))
	var mon_actor = world.ActorScript.new()
	mon_actor.setup(m_actor_def, str(m_entry.get("name", kind_id)), false, false, "monster", m_lv, "", "", false)
	mon_actor.scale = Vector2(0.41, 0.41)
	mon_actor.position = world.iso(pos.x, pos.y, world.height_at(pos.x, pos.y))
	world.ysort.add_child(mon_actor)
	var mid := "minion_%s_%d" % [kind_id, Time.get_ticks_msec() % 100000 + randi() % 999]
	var ag := {
		"kind": "monster",
		"id": mid,
		"actor_id": kind_id,
		"is_minion": true,
		"boss_owner": boss_owner_id,
		"name": str(m_entry.get("name", kind_id)),
		"level": m_lv,
		"is_elite": false,
		"max_hp": m_hp,
		"cur_hp": m_hp,
		"atk": m_atk,
		"atk_cd": 0.6,
		"aggro_windup": 0.4,
		"was_aggro": true,
		"atk_count": 0,
		"roared": true,
		"dmg_dealt_to_hero": 0,
		"xp": 12,
		"gold": 4,
		"alive": true,
		"death_hide_t": 0.0,
		"respawn_t": 99999.0,
		"node": mon_actor,
		"home": origin,
		"pos": pos,
		"radius": 24.0,
		"speed": 14.0,
		"phase": 0.0,
		"ai_state": "idle",
		"ai_timer": 1.0,
		"ai_target": pos,
	}
	hydrate_monster_agent(ag, m_entry)
	world.live_agents.append(ag)
	return mid

# ==============================================================================
# 3) BOSS PHASE TRANSITIONS, DAMAGE HOOKS & DEFEAT
# ==============================================================================
func on_agent_damaged(ag: Dictionary, dmg: int, hit_stun: float, _elements: Array[String]) -> void:
	# Ambush reveal on damage
	if bool(ag.get("ambush_hidden", false)):
		ag["ambush_hidden"] = false
		var nd = ag.get("node", null)
		if is_instance_valid(nd):
			nd.modulate.a = 1.0
	# Reflect trait
	var traits: Dictionary = ag.get("traits", {}) if ag.get("traits") is Dictionary else {}
	if traits.has("reflect") and dmg > 8 and world != null and world.rpg_hud != null:
		var rpct := float(traits.get("reflect", 0.12)) if not (traits["reflect"] is Dictionary) else float((traits["reflect"] as Dictionary).get("pct", 0.12))
		var rdmg := maxi(3, int(round(float(dmg) * clampf(rpct, 0.05, 0.35))))
		_deal_raw_damage_to_hero(rdmg, ag, "ODBICIE")
	if not bool(ag.get("is_boss", false)):
		return
	var bid := str(ag.get("boss_id", ""))
	_active_boss_id = bid
	# Kharzul armored stance breaks on stun or heavy strike!
	if bid == "kharzul" and bool(ag.get("boss_shield_active", false)) and (hit_stun > 0.1 or dmg >= 140):
		ag["boss_shield_active"] = false
		ag["boss_vuln_t"] = 3.5
		var nd = ag.get("node", null)
		if is_instance_valid(nd):
			nd.boss_shield_active = false
			nd.queue_redraw()
		world.show_combat_toast("✦ Pancerz Kharzula PĘKŁ! (+40%% obrażeń przez 3.5s!)", Color(1.0, 0.86, 0.28))

	# Check phase thresholds
	var hp_pct := float(ag.get("cur_hp", 0)) / maxf(1.0, float(ag.get("max_hp", 1))) * 100.0
	var bdata: Dictionary = ag.get("boss_data", {})
	var phases: Array = bdata.get("phases", [])
	var cur_p := int(ag.get("boss_phase", 1))
	for ph: Dictionary in phases:
		var pnum := int(ph.get("phaseNumber", 1))
		var thresh := float(ph.get("hpThresholdPercent", 100.0))
		if pnum > cur_p and hp_pct <= thresh:
			_enter_boss_phase(ag, ph)
			cur_p = pnum

func _enter_boss_phase(ag: Dictionary, ph: Dictionary) -> void:
	var pnum := int(ph.get("phaseNumber", 2))
	var pname := str(ph.get("name", "Faza %d" % pnum))
	var bid := str(ag.get("boss_id", ""))
	ag["boss_phase"] = pnum
	var mods: Dictionary = ph.get("statModifiers", {}) if ph.get("statModifiers") is Dictionary else {}
	ag["boss_atk_mult"] = float(mods.get("atkMultiplier", 1.0))
	ag["boss_spd_mult"] = float(mods.get("speedMultiplier", 1.0))
	ag["boss_dmg_taken_mult"] = float(mods.get("damageTakenMultiplier", 1.0))
	var nd = ag.get("node", null)
	if is_instance_valid(nd):
		nd.boss_phase = pnum
		nd.queue_redraw()
		if world.combat_vfx != null:
			world.combat_vfx.spawn_ki_burst(nd.position, "legend" if pnum >= 3 else "sage", 220.0)
	world.trigger_camera_shake(10.0, 0.45)
	if world.audio != null:
		world.audio.play_monster_sfx(str(ag.get("actor_id", "")), "roar")
	world.show_combat_toast("☠ %s — FAZA %d: %s!" % [str(ag.get("name", bid)), pnum, pname], Color(1.0, 0.44, 0.24) if pnum >= 3 else Color(0.94, 0.56, 1.0))

	# Signature Phase Entry Mechanics per Boss
	var bpos: Vector2 = ag["pos"]
	if bid == "ygdrasha" and pnum == 2:
		_spawn_minion("verdant-mchowy-szlamak", bpos, bid)
		_spawn_minion("verdant-mchowy-szlamak", bpos, bid)
	elif bid == "thorgar" and pnum == 2:
		for _i in 3:
			_spawn_minion("verdant-cierniowy-wilk", bpos, bid)
	elif bid == "arcykaplan-pustki" and pnum == 2:
		ag["boss_shield_active"] = true
		if is_instance_valid(nd):
			nd.boss_shield_active = true
		var adds: Array = []
		for _i in 3:
			var mid := _spawn_minion("aether-swietlik-pieczeci", bpos, bid)
			if not mid.is_empty():
				adds.append(mid)
		ag["boss_shield_adds"] = adds
		world.show_combat_toast("✦ Bariera Pustki aktywna! Pokonaj 3 Świetliki Pieczęci, aby ją rozbić!", Color(0.76, 0.52, 1.0))
	elif bid == "aurelith" and pnum >= 2:
		_spawn_boss_safe_spots(bpos, 3, 6.5, "Kamienny Filar — schroń się przed Oddechem!")
	elif bid == "arbiter-zero" and pnum == 2:
		ag["boss_shield_active"] = true
		if is_instance_valid(nd):
			nd.boss_shield_active = true
		var adds_a: Array = []
		for _i in 2:
			var mid := _spawn_minion("nexus-dron-zwiadowca", bpos, bid)
			if not mid.is_empty():
				adds_a.append(mid)
		ag["boss_shield_adds"] = adds_a
		world.show_combat_toast("⚡ Tarcza Plazmowa Arbitra! Zniszcz 2 drony wsparcia!", Color(0.26, 0.92, 1.0))
	elif bid == "hydra-rdzen" and pnum == 3:
		ag["boss_dmg_taken_mult"] = 1.20
		world.show_combat_toast("⚡ Rdzeń Hydry ODSŁONIĘTY (+20%% obrażeń)!", Color(0.28, 0.96, 1.0))
	elif bid == "kharzul" and pnum == 2:
		ag["boss_shield_active"] = true
		if is_instance_valid(nd):
			nd.boss_shield_active = true
		_spawn_hazard(bpos + Vector2(36, 0), 68.0, 9.0, "danger", float(ag["atk"]) * 0.26, "burn")
	elif bid == "kharzul" and pnum == 3:
		apply_hero_debuff("healBlock", 9.0, 0.0)
		world.show_combat_toast("🔥 KLĄTWA POPIOŁU Kharzula — mikstury leczenia zablokowane (9s)!", Color(1.0, 0.30, 0.42))
	elif bid == "pyrrhax" and pnum == 3:
		_spawn_boss_safe_spots(bpos, 3, 4.2, "Erupcja Wulkanu! Wejdź do zielonej strefy bezpieczeństwa!")
		_queue_telegraph(bpos, 240.0, 3.2, "danger", float(ag["atk"]) * 2.2, ag, "erupcja", true)

func _spawn_boss_safe_spots(center: Vector2, count: int, dur: float, msg: String) -> void:
	for i in count:
		var ang := (float(i) / float(count)) * TAU + randf_range(-0.25, 0.25)
		var sp := center + Vector2(cos(ang), sin(ang)) * randf_range(58.0, 105.0)
		if not world.is_walkable(sp.x, sp.y):
			sp = center + Vector2(cos(ang), sin(ang)) * 38.0
		safe_spots.append({"pos": sp, "radius": 38.0, "life": dur})
		if world.combat_vfx != null:
			world.combat_vfx.spawn_hazard_zone(world.iso(sp.x, sp.y, world.height_at(sp.x, sp.y)), 52.0, dur, "safe")
	world.show_combat_toast("★ %s" % msg, Color(0.36, 0.98, 0.58))

func _is_hero_in_safe_spot() -> bool:
	for sp: Dictionary in safe_spots:
		if world.hero_pos.distance_to(sp["pos"] as Vector2) <= float(sp.get("radius", 38.0)):
			return true
	return false

func on_agent_killed(ag: Dictionary, hp_cost: int) -> bool:
	# Check if killed monster had traits.revive
	var traits: Dictionary = ag.get("traits", {}) if ag.get("traits") is Dictionary else {}
	if not bool(ag.get("is_boss", false)) and bool(traits.get("revive", false)) and not bool(ag.get("revived", false)):
		ag["revived"] = true
		ag["alive"] = true
		ag["cur_hp"] = maxi(25, int(round(float(ag.get("max_hp", 100)) * 0.35)))
		var nd = ag.get("node", null)
		if is_instance_valid(nd):
			nd.hp_ratio = 0.35
			nd.modulate = Color(1.0, 0.85, 1.0, 1.0)
			if nd.has_method("show_damage_number"):
				nd.show_damage_number("ODRODZENIE!", Color(0.84, 0.44, 1.0), true)
		return true # Prevent death!

	# Death hazard / explosion / split traits
	var pos: Vector2 = ag["pos"]
	if traits.has("deathZone") and traits["deathZone"] is Dictionary:
		var dz: Dictionary = traits["deathZone"]
		_spawn_hazard(pos, clampf(float(dz.get("radius", 140.0)) * 0.38, 38.0, 86.0), clampf(float(dz.get("ms", 5000.0)) / 1000.0, 2.0, 8.0), str(dz.get("kind", "poison")), float(ag.get("atk", 20)) * float(dz.get("dps", 0.2)), "poison")
	if traits.has("explode"):
		_queue_telegraph(pos, 64.0, 0.75, "danger", float(ag.get("atk", 25)) * 1.15, ag, "explode", false)
	if traits.has("split") and not bool(ag.get("is_minion", false)):
		_spawn_minion(str(ag.get("actor_id", "")), pos)

	# Minion killed -> check if it breaks a boss barrier shield!
	var owner_bid := str(ag.get("boss_owner", ""))
	if not owner_bid.is_empty():
		for bag: Dictionary in world.live_agents:
			if str(bag.get("boss_id", "")) == owner_bid and bool(bag.get("boss_shield_active", false)):
				var adds: Array = bag.get("boss_shield_adds", [])
				adds.erase(str(ag.get("id", "")))
				bag["boss_shield_adds"] = adds
				if adds.is_empty():
					bag["boss_shield_active"] = false
					bag["boss_vuln_t"] = 4.0
					var bnd = bag.get("node", null)
					if is_instance_valid(bnd):
						bnd.boss_shield_active = false
						bnd.queue_redraw()
					world.show_combat_toast("✦ BARIERA BOSSA ROZBITA! (+40%% obrażeń przez 4s!)", Color(0.36, 0.98, 1.0))

	# Boss Defeat authoritative reporting + ground loot!
	if bool(ag.get("is_boss", false)):
		var bid := str(ag.get("boss_id", ""))
		if _active_boss_id == bid:
			_active_boss_id = ""
		ag["respawn_t"] = 180.0
		var bdata: Dictionary = ag.get("boss_data", {})
		var drop_p: Vector2 = world._ground_loot_point(pos)
		if world.is_server_authoritative():
			var r_load: int = world._region_load_id
			world.dispatch_server_action({
				"type": "boss_defeat",
				"bossId": bid,
				"land": world.current_land,
				"hpCost": clampi(hp_cost, 0, 5000),
				"drop": {"x": drop_p.x, "z": drop_p.y},
			}, func(res: Dictionary) -> void:
				if r_load != world._region_load_id:
					return
				var drop: Dictionary = res.get("lootDrop", {})
				var ok := bool(res.get("ok", false))
				if ok and not drop.is_empty():
					var items: Array = drop.get("items", [])
					var def: Dictionary = world.GmPanelScript.find_item(str(items[0]["id"])) if not items.is_empty() else {}
					var icon := str(def.get("icon", "emblem_crystal.webp"))
					world.spawn_ground_loot(pos, "item" if not items.is_empty() else "gold", world.server_loot_label(drop), Color(1.0, 0.78, 0.22), icon, 0, {}, 0, false, true, drop)
				world.show_combat_toast(str(res.get("notice", "★ POKONANO BOSSA!")), Color(1.0, 0.86, 0.26) if ok else Color(1.0, 0.55, 0.36))
			)
		else:
			var rgold := int(ag.get("gold", 420))
			var rxp := int(ag.get("xp", 550))
			world.spawn_ground_loot(pos, "gold", "★ %d Złota Bossa" % rgold, Color(1.0, 0.88, 0.26), "gear-coin.webp", rgold, {}, 1, true, true)
			for lt: Dictionary in bdata.get("lootTable", []):
				var iid := str(lt.get("itemId", ""))
				var chance := float(lt.get("chancePercent", 100.0))
				if randf() * 100.0 <= chance:
					var item_d: Dictionary = world.GmPanelScript.find_item(iid)
					if not item_d.is_empty():
						var qty := randi_range(int(lt.get("minCount", 1)), int(lt.get("maxCount", 1)))
						world.spawn_ground_loot(pos, "item", "★ %s ×%d" % [str(item_d.get("name", iid)), qty], Color(1.0, 0.74, 0.26), str(item_d.get("icon", "emblem_crystal.webp")), 0, item_d, qty, true, true)
			if world.rpg_hud != null and world.rpg_hud.has_method("grant_local_xp"):
				world.rpg_hud.grant_local_xp(rxp)
			world.show_combat_toast("☠ POKONANO BOSSA: %s! (+%d PD) — epicki łup na ziemi!" % [str(ag.get("name", bid)), rxp], Color(1.0, 0.86, 0.24))
		if world.has_method("on_stage4_entity_killed"):
			world.on_stage4_entity_killed(str(ag.get("id", "")), str(ag.get("actor_id", "")), true)
		return false
	return false

# ==============================================================================
# 4) TELEGRAPHS, HAZARD ZONES & HERO DEBUFF TICKING
# ==============================================================================
func _queue_telegraph(world_p: Vector2, radius: float, dur: float, t_kind: String, dmg: float, source_ag: Dictionary, fx_tag: String = "", needs_safe_spot: bool = false, zone_cfg: Dictionary = {}, fx_list: Array = []) -> void:
	active_telegraphs.append({
		"pos": world_p,
		"radius": radius,
		"life": dur,
		"max_life": dur,
		"kind": t_kind,
		"dmg": dmg,
		"source": source_ag,
		"fx_tag": fx_tag,
		"needs_safe": needs_safe_spot,
		"zone": zone_cfg,
		"fx": fx_list,
	})
	if world != null and world.combat_vfx != null:
		world.combat_vfx.spawn_telegraph_ring(world.iso(world_p.x, world_p.y, world.height_at(world_p.x, world_p.y)), radius * 1.45, dur, t_kind)

func _spawn_hazard(world_p: Vector2, radius: float, dur: float, h_kind: String, dps: float, debuff_id: String = "") -> void:
	active_hazards.append({
		"pos": world_p,
		"radius": radius,
		"life": dur,
		"kind": h_kind,
		"dps": maxf(dps, 5.0),
		"debuff": debuff_id,
		"acc": 0.0,
	})
	if world != null and world.combat_vfx != null:
		world.combat_vfx.spawn_hazard_zone(world.iso(world_p.x, world_p.y, world.height_at(world_p.x, world_p.y)), radius * 1.45, dur, h_kind)

func step_global_timers(delta: float, modal_paused: bool) -> void:
	if world == null or modal_paused:
		return
	# 1. Safe spots
	var si := safe_spots.size() - 1
	while si >= 0:
		safe_spots[si]["life"] = float(safe_spots[si]["life"]) - delta
		if float(safe_spots[si]["life"]) <= 0.0:
			safe_spots.remove_at(si)
		si -= 1

	# 2. Hero debuffs (poison / burn / bleed DoT + timer decay)
	var expired_d: Array[String] = []
	for dk: String in hero_debuffs.keys():
		var d: Dictionary = hero_debuffs[dk]
		d["t"] = float(d.get("t", 0.0)) - delta
		var dps := float(d.get("dps", 0.0))
		if dps > 0.1:
			d["acc"] = float(d.get("acc", 0.0)) + delta
			if float(d["acc"]) >= 0.75:
				d["acc"] = float(d["acc"]) - 0.75
				_deal_raw_damage_to_hero(maxi(3, int(round(dps * 0.75))), {}, dk.to_upper())
		if float(d["t"]) <= 0.0:
			expired_d.append(dk)
	for ek: String in expired_d:
		hero_debuffs.erase(ek)

	# 3. Active telegraphs resolving into bursts/hazards
	var ti := active_telegraphs.size() - 1
	while ti >= 0:
		var tg: Dictionary = active_telegraphs[ti]
		tg["life"] = float(tg["life"]) - delta
		if float(tg["life"]) <= 0.0:
			var tpos: Vector2 = tg["pos"]
			var trad := float(tg.get("radius", 60.0))
			var src: Dictionary = tg.get("source", {})
			var src_alive := src.is_empty() or bool(src.get("alive", true))
			var tkind := str(tg.get("kind", "danger"))
			if src_alive or str(tg.get("fx_tag", "")) == "explode":
				if world.combat_vfx != null:
					world.combat_vfx.spawn_ki_burst(world.iso(tpos.x, tpos.y, world.height_at(tpos.x, tpos.y)), "legend" if tkind == "danger" else "planetary", trad * 1.45)
				var hpos_t: Vector2 = world.hero_pos
				var in_blast: bool = hpos_t.distance_to(tpos) <= trad
				var sheltered := bool(tg.get("needs_safe", false)) and _is_hero_in_safe_spot()
				if in_blast and not sheltered:
					if float(world.dodge_invuln_t) > 0.05:
						if world.hero != null and world.hero.has_method("show_damage_number"):
							world.hero.show_damage_number("UNIK!", Color(0.46, 0.98, 0.72), true)
					else:
						_deal_raw_damage_to_hero(maxi(8, int(round(float(tg.get("dmg", 24.0))))), src, "")
						_apply_skill_fx_list(tg.get("fx", []) as Array, float(src.get("atk", 25.0)))
				elif sheltered and world.hero != null and world.hero.has_method("show_damage_number"):
					world.hero.show_damage_number("OSŁONA!", Color(0.36, 0.98, 0.58), true)
				# Thorgar missed charge self-stun!
				if str(tg.get("fx_tag", "")) == "thorgar_charge" and not in_blast and not src.is_empty():
					src["stun_t"] = maxf(float(src.get("stun_t", 0.0)), 1.5)
					world._sync_agent_status_flags(src)
					world.show_combat_toast("★ Thorgar chybił szarżę — OGŁUSZONY na 1.5s!", Color(1.0, 0.90, 0.34))
				# Arbiter Zero overheat window after overload burst!
				if str(tg.get("fx_tag", "")) == "arbiter_overload" and not src.is_empty():
					src["boss_vuln_t"] = 4.0
					world.show_combat_toast("⚡ Arbiter Zero PRZEGRZANY (+40%% obrażeń przez 4s)!", Color(0.32, 0.96, 1.0))
				# Optional persistent hazard zone
				var zcfg: Dictionary = tg.get("zone", {}) if tg.get("zone") is Dictionary else {}
				if not zcfg.is_empty():
					var zrad := clampf(float(zcfg.get("radius", 140.0)) * 0.38, 36.0, 92.0)
					var zdur := clampf(float(zcfg.get("ms", 3500.0)) / 1000.0, 2.0, 8.0)
					var zdps := maxf(6.0, float(src.get("atk", 24.0)) * float(zcfg.get("dps", 0.16)))
					_spawn_hazard(tpos, zrad, zdur, str(zcfg.get("kind", "poison")), zdps, str(zcfg.get("kind", "poison")))
			active_telegraphs.remove_at(ti)
		ti -= 1

	# 4. Persistent hazard zones damaging hero on contact
	var hi := active_hazards.size() - 1
	while hi >= 0:
		var hz: Dictionary = active_hazards[hi]
		hz["life"] = float(hz["life"]) - delta
		if float(hz["life"]) <= 0.0:
			active_hazards.remove_at(hi)
			hi -= 1
			continue
		if (world.hero_pos as Vector2).distance_to(hz["pos"] as Vector2) <= float(hz.get("radius", 48.0)):
			hz["acc"] = float(hz.get("acc", 0.0)) + delta
			if float(hz["acc"]) >= 0.65:
				hz["acc"] = float(hz["acc"]) - 0.65
				if float(world.dodge_invuln_t) <= 0.05:
					_deal_raw_damage_to_hero(maxi(4, int(round(float(hz.get("dps", 10.0)) * 0.65))), {}, "")
					var db := str(hz.get("debuff", ""))
					if db in ["poison", "burn", "slow"]:
						apply_hero_debuff(db, 2.5, float(hz.get("dps", 8.0)) * 0.45 if db != "slow" else 0.0)
		hi -= 1

func _apply_skill_fx_list(fx_list: Array, src_atk: float) -> void:
	for fx: Variant in fx_list:
		if not (fx is Dictionary):
			continue
		var d: Dictionary = fx as Dictionary
		var k := str(d.get("k", ""))
		var dur := clampf(float(d.get("ms", 2500.0)) / 1000.0, 0.8, 7.0)
		if k == "dot":
			var did := str(d.get("id", "poison"))
			var dps := maxf(5.0, src_atk * float(d.get("atkPct", 0.12)))
			apply_hero_debuff(did, dur, dps)
		elif k in ["slow", "root", "stun", "armorDown"]:
			apply_hero_debuff(k, minf(dur, 1.8 if k == "stun" else dur), 0.0)
		elif k == "breakShield" and world.rpg_hud != null:
			world.rpg_hud.hero_shield_hp = 0.0
			world.rpg_hud.hero_shield_timer = 0.0

func _deal_raw_damage_to_hero(raw_dmg: int, ag: Dictionary, _label: String = "") -> void:
	if world == null or world.rpg_hud == null:
		return
	if world.recall_channel > 0.0:
		world.recall_channel = 0.0
		world.show_combat_toast("Powrót do stolicy przerwany przez obrażenia!", Color(1.0, 0.48, 0.34))
	var hero_def := float(world.rpg_hud.get_total_defense()) if world.rpg_hud.has_method("get_total_defense") else 12.0
	var def_mult := get_hero_armor_down_mult()
	if world.ki_mode_timer > 0.0: def_mult += 0.15
	if float(world.hero_buffs.get("fortify_t", 0.0)) > 0.05: def_mult += 0.60
	if float(world.hero_buffs.get("dodge_def_t", 0.0)) > 0.05: def_mult += 0.20
	def_mult += world._hero_circle_def_bonus()
	var dmg := maxi(4, int(round(float(raw_dmg) - (hero_def * maxf(0.35, def_mult)) * 0.48)))
	if not ag.is_empty():
		ag["dmg_dealt_to_hero"] = int(ag.get("dmg_dealt_to_hero", 0)) + dmg
	world.last_combat_time = world.world_time
	if world.audio != null:
		world.audio.sfx("common/player-hurt", 0.72)
	if world.hero != null and world.hero.has_method("show_damage_number"):
		world.hero.show_damage_number("-%d" % dmg, Color(1.0, 0.32, 0.26), false)
	if world.rpg_hud.has_method("take_combat_damage") and world.rpg_hud.take_combat_damage(dmg):
		if float(world.hero_buffs.get("last_flame_t", 0.0)) > 0.05:
			world.hero_buffs["last_flame_t"] = 0.0
			world.rpg_hud.hero_hp = maxf(1.0, round(float(world.rpg_hud.hero_max_hp) * 0.30))
			world.rpg_hud._sync_bar_uniforms()
			world.rpg_hud._refresh_visuals()
			world.show_combat_toast("✦ OSTATNI PŁOMIEŃ uratował Cię przed śmiercią (+30%% HP)!", Color(1.0, 0.80, 0.28))
		else:
			world.handle_hero_defeat()

# ==============================================================================
# 5) PER-FRAME DIFFERENTIATED AI STEP FOR MONSTERS & BOSSES
# ==============================================================================
func step_monster_ai(idx: int, ag: Dictionary, delta: float, hero_in_safe: bool, modal_paused: bool) -> Dictionary:
	# Returns {"next_p": Vector2, "stride": float, "handled": bool}
	var prev_p: Vector2 = ag["pos"]
	var home: Vector2 = ag["home"]
	var hpos: Vector2 = world.hero_pos
	var node = ag.get("node", null)
	var is_boss := bool(ag.get("is_boss", false))
	var traits: Dictionary = ag.get("traits", {}) if ag.get("traits") is Dictionary else {}
	var slow_mult := 0.60 if float(ag.get("slow_t", 0.0)) > 0.05 else 1.0
	var b_spd_mult := float(ag.get("boss_spd_mult", 1.0)) if is_boss else 1.0

	ag["atk_cd"] = maxf(0.0, float(ag.get("atk_cd", 0.0)) - delta)
	ag["aggro_windup"] = maxf(0.0, float(ag.get("aggro_windup", 0.0)) - delta)
	if is_boss and float(ag.get("boss_vuln_t", 0.0)) > 0.0:
		ag["boss_vuln_t"] = maxf(0.0, float(ag.get("boss_vuln_t", 0.0)) - delta)

	# Decay per-skill cooldowns
	var scds: Dictionary = ag.get("skill_cds", {})
	for sk_id: String in scds.keys():
		var rem := float(scds[sk_id]) - delta
		if rem <= 0.0:
			scds.erase(sk_id)
		else:
			scds[sk_id] = rem

	if float(ag.get("stun_t", 0.0)) > 0.05:
		return {"next_p": prev_p, "stride": 0.7, "handled": true}

	var dist_to_hero: float = hpos.distance_to(prev_p)
	var dist_from_home := prev_p.distance_to(home)
	var was_hurt := int(ag.get("cur_hp", 100)) < int(ag.get("max_hp", 100))
	var agro_r := float(ag.get("agro_range", 85.0))
	var leash_r := 260.0 if is_boss else 175.0
	var is_provoked_only := bool(traits.get("provoked", false)) and not was_hurt
	var wants_aggro: bool = (not hero_in_safe) and (not modal_paused) and (not is_provoked_only) and ((dist_to_hero <= agro_r) or (was_hurt and dist_to_hero <= agro_r * 1.45)) and dist_from_home < leash_r

	# Ambush reveal
	if bool(ag.get("ambush_hidden", false)) and wants_aggro and dist_to_hero <= minf(agro_r, 85.0):
		ag["ambush_hidden"] = false
		if is_instance_valid(node):
			node.modulate.a = 1.0
			if node.has_method("show_damage_number"):
				node.show_damage_number("ZASADZKA!", Color(1.0, 0.56, 0.24), false)

	if not wants_aggro:
		ag["roared"] = false
		ag["was_aggro"] = false
		if is_boss and str(ag.get("boss_id", "")) == _active_boss_id and dist_to_hero > 300.0:
			_active_boss_id = ""
		if float(ag.get("chase_speed", 18.0)) <= 0.01:
			return {"next_p": prev_p, "stride": 0.65, "handled": true}
		return {"next_p": world._step_agent_patrol(ag, delta, float(ag.get("speed", 13.0)) * slow_mult, true), "stride": 0.76, "handled": true}

	if is_boss:
		_active_boss_id = str(ag.get("boss_id", ""))
		_step_boss_periodic_mechanics(ag, delta)

	if not bool(ag.get("was_aggro", false)):
		ag["was_aggro"] = true
		ag["aggro_windup"] = 0.48
	if not bool(ag.get("roared", false)):
		ag["roared"] = true
		if world.audio != null and (bool(ag.get("is_elite", false)) or is_boss):
			world.audio.play_monster_sfx(str(ag.get("actor_id", "")), "roar")

	# Movement: stationary, ranged kiter, or melee chaser
	var next_p := prev_p
	var chase_spd := float(ag.get("chase_speed", 20.0)) * slow_mult * b_spd_mult
	var atk_r := float(ag.get("atk_range", 50.0))
	var basic_m := str(ag.get("basic", "melee"))
	var pref_d := (atk_r * 0.74) if (basic_m == "ranged" or traits.has("keep")) else 28.0
	if chase_spd > 0.1:
		if dist_to_hero > pref_d + 6.0:
			var step_v: Vector2 = (hpos - prev_p).normalized() * chase_spd * delta
			var cand_p: Vector2 = prev_p + step_v
			if cand_p.distance_to(world.capital_center as Vector2) > float(world.safe_city_radius) + 16.0 and world.is_walkable(cand_p.x, cand_p.y):
				next_p = cand_p
		elif (basic_m == "ranged" or traits.has("keep")) and dist_to_hero < pref_d * 0.55:
			var away_v: Vector2 = (prev_p - hpos).normalized() * chase_spd * 0.65 * delta
			var cand_a: Vector2 = prev_p + away_v
			if cand_a.distance_to(world.capital_center as Vector2) > float(world.safe_city_radius) + 16.0 and world.is_walkable(cand_a.x, cand_a.y):
				next_p = cand_a

	# Try casting a species/boss signature skill first if off cooldown!
	if float(ag.get("aggro_windup", 0.0)) <= 0.0 and _try_cast_agent_skill(ag, next_p, dist_to_hero):
		return {"next_p": next_p, "stride": 0.96, "handled": true}

	# Basic attack (melee or ranged)
	var eff_range := maxf(atk_r, 52.0)
	if basic_m != "none" and hpos.distance_to(next_p) <= eff_range and float(ag["atk_cd"]) <= 0.0 and float(ag["aggro_windup"]) <= 0.0:
		ag["atk_cd"] = float(ag.get("atk_cd_base", 1.40))
		ag["atk_count"] = int(ag.get("atk_count", 0)) + 1
		world.last_combat_time = world.world_time
		var to_h: Vector2 = hpos - next_p
		var face_h := Vector2(to_h.x - to_h.y, (to_h.x + to_h.y) * 0.5)
		if is_instance_valid(node):
			if face_h.length_squared() > 0.01 and node.has_method("face"):
				node.face(face_h)
			if node.has_method("play_action"):
				node.play_action("attack", "attack")
		if world.audio != null:
			world.audio.play_monster_sfx(str(ag.get("actor_id", "")), "atk")
		if basic_m == "ranged" and world.combat_vfx != null and is_instance_valid(node) and world.hero != null:
			var p_col_k := "electric" if world.current_land == "nexus" else ("frost" if world.current_land == "aether" else ("poison" if world.current_land == "verdant" else "danger"))
			world.combat_vfx.spawn_enemy_projectile(node.position, world.hero.position, p_col_k, 0.36)
		if float(world.dodge_invuln_t) > 0.05:
			if world.hero != null and world.hero.has_method("show_damage_number"):
				world.hero.show_damage_number("UNIK!", Color(0.46, 0.98, 0.72), true)
		else:
			var m_atk := float(ag.get("atk", 24)) * float(ag.get("boss_atk_mult", 1.0))
			var m_lvl := int(ag.get("level", 1))
			var hero_lv: int = int(world.rpg_hud.hero_level) if world.rpg_hud != null else 1
			var adv := 1.30 if (m_lvl - hero_lv >= 3) else 1.0
			var raw_d := int(round(m_atk * adv))
			_deal_raw_damage_to_hero(raw_d, ag)
			var refl := float(world.hero_buffs.get("reflect_pct", 0.0))
			if refl > 0.01 and world.rpg_hud != null and float(world.rpg_hud.hero_shield_hp) > 1.0:
				world._apply_damage_to_agent(idx, maxi(4, int(round(float(raw_d) * refl))), false, world._hero_race_key(), 0.0)
	return {"next_p": next_p, "stride": 0.96, "handled": true}

func _step_boss_periodic_mechanics(ag: Dictionary, delta: float) -> void:
	var bid := str(ag.get("boss_id", ""))
	var ph := int(ag.get("boss_phase", 1))
	var hpos: Vector2 = world.hero_pos
	# Ygdrasha 1% HP/s regen in Phases 1–2
	if bid == "ygdrasha" and ph < 3:
		ag["boss_regen_acc"] = float(ag.get("boss_regen_acc", 0.0)) + delta
		if float(ag["boss_regen_acc"]) >= 1.0:
			ag["boss_regen_acc"] = 0.0
			var heal_v := maxi(10, int(round(float(ag["max_hp"]) * 0.01)))
			ag["cur_hp"] = mini(int(ag["max_hp"]), int(ag["cur_hp"]) + heal_v)
			var nd = ag.get("node", null)
			if is_instance_valid(nd):
				nd.hp_ratio = float(ag["cur_hp"]) / maxf(1.0, float(ag["max_hp"]))
				nd.queue_redraw()
	# Periodic arena hazard pulses for Phase 2–3 bosses
	ag["boss_mech_t"] = float(ag.get("boss_mech_t", 6.0)) - delta
	if float(ag["boss_mech_t"]) <= 0.0:
		ag["boss_mech_t"] = 9.5 if ph >= 3 else 13.0
		var bpos: Vector2 = ag["pos"]
		if bid == "arcykaplan-pustki" and ph >= 3:
			var ring_p: Vector2 = hpos + Vector2(randf_range(-25, 25), randf_range(-25, 25))
			_queue_telegraph(ring_p, 72.0, 1.35, "void", float(ag["atk"]) * 1.45, ag, "void_ring", false, {"kind": "void", "ms": 4000, "radius": 160, "dps": 0.22})
		elif bid == "aurelith" and ph >= 2:
			_spawn_boss_safe_spots(bpos, 2, 4.5, "Oddech Eteru! Wejdź pod Filar!")
			_queue_telegraph(hpos, 180.0, 2.5, "frost", float(ag["atk"]) * 1.85, ag, "oddech", true)
		elif bid == "pyrrhax" and ph >= 2:
			for _i in 3:
				var lp: Vector2 = hpos + Vector2(randf_range(-75, 75), randf_range(-75, 75))
				_queue_telegraph(lp, 52.0, 1.4, "danger", float(ag["atk"]) * 1.35, ag, "lava_rain", false, {"kind": "danger", "ms": 4500, "radius": 115, "dps": 0.22})
		elif bid == "hydra-rdzen" and ph >= 2:
			_spawn_hazard(hpos, 52.0, 5.5, "electric", float(ag["atk"]) * 0.24, "slow")

func _try_cast_agent_skill(ag: Dictionary, cur_pos: Vector2, dist_to_hero: float) -> bool:
	var skills: Array = ag.get("skills", [])
	if skills.is_empty():
		return false
	var hpos: Vector2 = world.hero_pos
	var scds: Dictionary = ag.get("skill_cds", {})
	var used_once: Dictionary = ag.get("skill_used_once", {})
	var is_boss := bool(ag.get("is_boss", false))
	var unlocked_boss_skills: Array = []
	if is_boss:
		var bdata: Dictionary = ag.get("boss_data", {})
		var cur_p := int(ag.get("boss_phase", 1))
		for ph: Dictionary in bdata.get("phases", []):
			if int(ph.get("phaseNumber", 1)) == cur_p:
				unlocked_boss_skills = ph.get("unlockedAttacks", [])
				break
	var hp_ratio := float(ag.get("cur_hp", 100)) / maxf(1.0, float(ag.get("max_hp", 100)))

	for sk_v: Variant in skills:
		if not (sk_v is Dictionary):
			continue
		var sk: Dictionary = sk_v as Dictionary
		var sid := str(sk.get("id", ""))
		if sid.is_empty() or scds.has(sid):
			continue
		if is_boss and not unlocked_boss_skills.is_empty() and not (sid in unlocked_boss_skills):
			continue
		if bool(sk.get("once", false)) and used_once.has(sid):
			continue
		if sk.has("below") and hp_ratio > float(sk.get("below", 1.0)):
			continue
		var s_range := clampf(float(sk.get("range", 240.0)) * 0.42, 48.0, 240.0)
		if dist_to_hero > s_range:
			continue

		# Cast this skill!
		var cd_s := clampf(float(sk.get("cd", 7000.0)) / 1000.0, 3.0, 24.0)
		scds[sid] = cd_s
		if bool(sk.get("once", false)):
			used_once[sid] = true
		ag["atk_cd"] = maxf(float(ag.get("atk_cd", 0.0)), 1.0)
		var node = ag.get("node", null)
		if is_instance_valid(node) and node.has_method("play_action"):
			node.play_action("skill", "attack")
		var mode := str(sk.get("mode", "burst"))
		var dmg_v := float(ag.get("atk", 24)) * float(sk.get("dmg", 1.0)) * float(ag.get("boss_atk_mult", 1.0))
		var tel_s := clampf(float(sk.get("telegraph", 950.0)) / 1000.0, 0.55, 2.2)
		var rad := clampf(float(sk.get("radius", 120.0)) * 0.42, 44.0, 120.0)
		var fx_list: Array = sk.get("fx", []) if sk.get("fx") is Array else []
		var zcfg: Dictionary = sk.get("zone", {}) if sk.get("zone") is Dictionary else {}
		var t_kind := "poison" if ("zarodnik" in sid or "burza" in sid or "chmura" in sid) else ("void" if ("pustk" in sid or "pieczec" in sid) else ("electric" if ("plazm" in sid or "wiazka" in sid or "arbiter" in sid) else "danger"))

		if mode == "self":
			if sk.has("summon") and sk["summon"] is Dictionary:
				var sum: Dictionary = sk["summon"]
				var cnt := mini(3, int(sum.get("count", 2)))
				for _c in cnt:
					_spawn_minion(str(sum.get("kind", "")), cur_pos, str(ag.get("boss_id", "")))
			if is_instance_valid(node) and node.has_method("show_damage_number"):
				node.show_damage_number(str(sk.get("name", "UMIEJĘTNOŚĆ")).to_upper(), Color(1.0, 0.80, 0.30), false)
			return true
		elif mode == "charge" or mode == "leap":
			var target_p: Vector2 = hpos
			if world.combat_vfx != null:
				world.combat_vfx.spawn_charge_line(world.iso(cur_pos.x, cur_pos.y, world.height_at(cur_pos.x, cur_pos.y)), world.iso(target_p.x, target_p.y, world.height_at(target_p.x, target_p.y)), 44.0, tel_s, t_kind)
			var tag := "thorgar_charge" if sid == "thorgar-szarza" else "charge"
			_queue_telegraph(target_p, 52.0, tel_s, t_kind, dmg_v, ag, tag, false, zcfg, fx_list)
			return true
		elif mode == "ranged":
			if world.combat_vfx != null and is_instance_valid(node) and world.hero != null:
				world.combat_vfx.spawn_enemy_projectile(node.position, world.hero.position, t_kind, 0.42)
			_queue_telegraph(hpos, 46.0, 0.45, t_kind, dmg_v, ag, "ranged", false, zcfg, fx_list)
			return true
		else:
			# burst / melee AoE telegraph
			var center_p: Vector2 = cur_pos if bool(sk.get("centred", false)) else hpos
			var fx_tag := "arbiter_overload" if sid == "arbiter-przeciazenie" else sid
			var need_safe := (sid == "pyrrhax-erupcja" or sid == "aurelith-oddech")
			if need_safe:
				_spawn_boss_safe_spots(cur_pos, 3, tel_s + 1.0, "%s! Wejdź do zielonej strefy!" % str(sk.get("name", "Atak")))
			_queue_telegraph(center_p, rad, tel_s, t_kind, dmg_v, ag, fx_tag, need_safe, zcfg, fx_list)
			return true
	return false

# ==============================================================================
# 6) EPIC BOSS HUD DATA PROVIDER
# ==============================================================================
func get_active_boss_hud() -> Dictionary:
	if world == null:
		return {}
	var hpos: Vector2 = world.hero_pos
	var best_ag: Dictionary = {}
	var best_d := 270.0
	for ag: Dictionary in world.live_agents:
		if not bool(ag.get("is_boss", false)) or not bool(ag.get("alive", true)):
			continue
		var d: float = hpos.distance_to(ag["pos"] as Vector2)
		if str(ag.get("boss_id", "")) == _active_boss_id and d <= 310.0:
			best_ag = ag
			break
		if d < best_d:
			best_d = d
			best_ag = ag
	if best_ag.is_empty():
		return {}
	var bdata: Dictionary = best_ag.get("boss_data", {})
	var cur_p := int(best_ag.get("boss_phase", 1))
	var pname := "Faza %d" % cur_p
	var thresholds: Array[float] = []
	for ph: Dictionary in bdata.get("phases", []):
		var thr := float(ph.get("hpThresholdPercent", 100.0))
		if thr < 99.0:
			thresholds.append(thr / 100.0)
		if int(ph.get("phaseNumber", 1)) == cur_p:
			pname = str(ph.get("name", pname))
	var hint := str(best_ag.get("boss_weakness_text", ""))
	if bool(best_ag.get("boss_shield_active", false)):
		hint = "🛡 BARIERA AKTYWNA — zniszcz przywołanych strażników lub ogłusz bossa!"
	elif float(best_ag.get("boss_vuln_t", 0.0)) > 0.05:
		hint = "⚡ BOSS ODSŁONIĘTY (+40%% obrażeń — atakuj teraz!)"
	return {
		"id": str(best_ag.get("boss_id", "")),
		"name": str(best_ag.get("name", "")),
		"title": str(best_ag.get("boss_title", "")),
		"level": int(best_ag.get("level", 15)),
		"hp": float(best_ag.get("cur_hp", 0)),
		"max_hp": float(best_ag.get("max_hp", 100)),
		"phase": cur_p,
		"phase_name": pname,
		"thresholds": thresholds,
		"shield": bool(best_ag.get("boss_shield_active", false)),
		"vulnerable": float(best_ag.get("boss_vuln_t", 0.0)) > 0.05,
		"hint": hint,
	}
