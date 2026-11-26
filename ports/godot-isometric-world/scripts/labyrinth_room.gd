extends Control
## Playable Dungeon Labyrinth Mode for KI Legends (8 unique biome-themed 15x15 mazes across Superior).
## Features fog-of-war exploration, smooth WASD & touch-joystick movement, 4 hidden treasure chests per
## labyrinth (server-authoritative claim_treasure), 3 patrolling labyrinth guardians (live combat),
## biome lighting, maze minimap, and seamless exit portal back to the continent.

const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")

const TILE_PX := 74.0
const HERO_RADIUS := 18.0
const HERO_SPEED := 235.0

const THEME_PALETTES := {
	"pyra": {
		"bg": Color(0.05, 0.025, 0.02, 1.0),
		"wall_top": Color(0.22, 0.13, 0.11, 1.0),
		"wall_side": Color(0.11, 0.06, 0.05, 1.0),
		"wall_edge": Color(0.95, 0.42, 0.14, 0.72),
		"floor_a": Color(0.16, 0.11, 0.09, 1.0),
		"floor_b": Color(0.13, 0.09, 0.075, 1.0),
		"accent": Color(1.0, 0.56, 0.18, 1.0),
	},
	"verdant": {
		"bg": Color(0.02, 0.045, 0.03, 1.0),
		"wall_top": Color(0.13, 0.22, 0.15, 1.0),
		"wall_side": Color(0.07, 0.13, 0.08, 1.0),
		"wall_edge": Color(0.36, 0.90, 0.52, 0.68),
		"floor_a": Color(0.12, 0.16, 0.11, 1.0),
		"floor_b": Color(0.10, 0.135, 0.095, 1.0),
		"accent": Color(0.42, 0.96, 0.58, 1.0),
	},
	"aether": {
		"bg": Color(0.03, 0.05, 0.085, 1.0),
		"wall_top": Color(0.20, 0.28, 0.38, 1.0),
		"wall_side": Color(0.11, 0.16, 0.24, 1.0),
		"wall_edge": Color(0.48, 0.88, 1.0, 0.76),
		"floor_a": Color(0.15, 0.20, 0.27, 1.0),
		"floor_b": Color(0.125, 0.17, 0.23, 1.0),
		"accent": Color(0.52, 0.92, 1.0, 1.0),
	},
	"nexus": {
		"bg": Color(0.02, 0.04, 0.06, 1.0),
		"wall_top": Color(0.14, 0.18, 0.24, 1.0),
		"wall_side": Color(0.07, 0.10, 0.15, 1.0),
		"wall_edge": Color(0.16, 0.94, 0.98, 0.78),
		"floor_a": Color(0.10, 0.13, 0.17, 1.0),
		"floor_b": Color(0.08, 0.105, 0.14, 1.0),
		"accent": Color(0.22, 0.98, 1.0, 1.0),
	},
}

var world: Node2D
var current_land := "pyra"
var lab_data: Dictionary = {}
var grid_rows: Array[String] = []
var maze_w := 15
var maze_h := 15
var visited: Dictionary = {}
var hero_px := Vector2(111.0, 111.0)
var hero_facing := Vector2(0.0, 1.0)
var exit_px := Vector2(111.0, 111.0)
var chests: Array[Dictionary] = []
var guardians: Array[Dictionary] = []
var float_texts: Array[Dictionary] = []
var ground_drops: Array[Dictionary] = []
var _visit_id := 0
var elapsed := 0.0
var atk_cd := 0.0
var dodge_invuln_t := 0.0
var skill_rings: Array[Dictionary] = []
var nearest_chest: Dictionary = {}
var nearest_guard_idx := -1
var near_exit := false

var btn_exit := Button.new()
var btn_open_chest := Button.new()
var btn_attack := Button.new()
var btn_potion := Button.new()
var btn_dodge := Button.new()
var btn_ki_mode := Button.new()
var skill_btns: Array[Button] = []
var toast_lbl := Label.new()
var toast_timer := 0.0

func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_build_ui()
	resized.connect(_layout_ui)
	_layout_ui()

func _build_ui() -> void:
	btn_exit.text = "← WSTECZ"
	ForgedUI.style_button(btn_exit, "slate", 16, 22.0, 8.0)
	btn_exit.pressed.connect(func() -> void:
		if world != null and world.has_method("exit_labyrinth"):
			world.exit_labyrinth()
	)
	add_child(btn_exit)

	btn_open_chest.text = "★ OTWÓRZ UKRYTY SKARB"
	ForgedUI.style_button(btn_open_chest, "gold", 17, 24.0, 10.0)
	btn_open_chest.visible = false
	btn_open_chest.pressed.connect(_try_open_nearest_chest)
	add_child(btn_open_chest)

	btn_attack.text = "⚔ ATAK [Q]"
	ForgedUI.style_button(btn_attack, "crimson", 16, 18.0, 8.0)
	btn_attack.visible = true
	btn_attack.pressed.connect(perform_labyrinth_attack)
	add_child(btn_attack)

	btn_potion.text = "🧪 ELIKSIR HP [H]"
	ForgedUI.style_button(btn_potion, "gold", 14, 18.0, 8.0)
	btn_potion.pressed.connect(_use_labyrinth_potion)
	add_child(btn_potion)

	btn_dodge.text = "💨 UNIK [V]"
	ForgedUI.style_button(btn_dodge, "slate", 14, 14.0, 8.0)
	btn_dodge.pressed.connect(func() -> void:
		if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_dodge"):
			world.rpg_hud.trigger_dodge()
		else:
			perform_labyrinth_dodge(false)
	)
	add_child(btn_dodge)

	btn_ki_mode.text = "✦ KI [R]"
	ForgedUI.style_button(btn_ki_mode, "gold", 14, 14.0, 8.0)
	btn_ki_mode.pressed.connect(func() -> void:
		if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
			world.rpg_hud.trigger_skill(5)
	)
	add_child(btn_ki_mode)

	skill_btns.clear()
	for si in range(1, 5):
		var sb := Button.new()
		sb.text = "[%d]" % si
		ForgedUI.style_button(sb, "slate", 13, 10.0, 6.0)
		var cap_si := si
		sb.pressed.connect(func() -> void:
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
				world.rpg_hud.trigger_skill(cap_si)
		)
		add_child(sb)
		skill_btns.append(sb)

	toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_lbl.add_theme_font_override("font", MapStyle.body_font())
	toast_lbl.add_theme_font_size_override("font_size", 18)
	toast_lbl.add_theme_color_override("font_color", Color(1.0, 0.92, 0.56))
	toast_lbl.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.02, 0.98))
	toast_lbl.add_theme_constant_override("outline_size", 6)
	toast_lbl.visible = false
	add_child(toast_lbl)

func _layout_ui() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1600.0, 720.0)
	btn_exit.position = Vector2(16.0, 10.0)
	btn_exit.size = Vector2(164.0, 48.0)
	var bw := clampf(vs.x * 0.34, 280.0, 420.0)
	btn_open_chest.size = Vector2(bw, 54.0)
	btn_open_chest.position = Vector2((vs.x - bw) * 0.5, vs.y - 148.0)
	btn_potion.size = Vector2(196.0, 50.0)
	btn_potion.position = Vector2(20.0, vs.y - 70.0)
	btn_dodge.size = Vector2(138.0, 50.0)
	btn_dodge.position = Vector2(226.0, vs.y - 70.0)

	# Bottom-right full Stage 3 skill bar: [1][2][3][4] [KI R] [ATAK Q]
	var atk_w := 176.0
	var ki_w := 112.0
	var sk_w := 114.0
	var gap := 8.0
	var right_x := vs.x - 18.0
	btn_attack.size = Vector2(atk_w, 54.0)
	btn_attack.position = Vector2(right_x - atk_w, vs.y - 72.0)
	right_x -= atk_w + gap
	btn_ki_mode.size = Vector2(ki_w, 54.0)
	btn_ki_mode.position = Vector2(right_x - ki_w, vs.y - 72.0)
	right_x -= ki_w + gap
	for i in range(skill_btns.size() - 1, -1, -1):
		var sb := skill_btns[i]
		sb.size = Vector2(sk_w, 54.0)
		sb.position = Vector2(right_x - sk_w, vs.y - 72.0)
		right_x -= sk_w + gap
	toast_lbl.size = Vector2(vs.x - 120.0, 36.0)
	toast_lbl.position = Vector2(60.0, 78.0)

func enter_labyrinth(land: String, data: Dictionary) -> void:
	_visit_id += 1
	ground_drops.clear()
	skill_rings.clear()
	dodge_invuln_t = 0.0
	current_land = land
	lab_data = data.duplicate(true)
	grid_rows.clear()
	for row in data.get("grid", []):
		grid_rows.append(str(row))
	maze_h = grid_rows.size()
	maze_w = grid_rows[0].length() if maze_h > 0 else 15
	var sp: Array = data.get("spawn", [1, 1])
	hero_px = Vector2((float(sp[0]) + 0.5) * TILE_PX, (float(sp[1]) + 0.5) * TILE_PX)
	exit_px = hero_px
	visited.clear()
	float_texts.clear()
	elapsed = 0.0
	atk_cd = 0.0
	chests.clear()
	for c: Dictionary in data.get("chests", []):
		var cc := c.duplicate(true)
		cc["px"] = Vector2((float(c.get("tx", 1)) + 0.5) * TILE_PX, (float(c.get("ty", 1)) + 0.5) * TILE_PX)
		chests.append(cc)
	guardians.clear()
	for g: Dictionary in data.get("guardians", []):
		var gc := g.duplicate(true)
		var gpos := Vector2((float(g.get("tx", 5)) + 0.5) * TILE_PX, (float(g.get("ty", 5)) + 0.5) * TILE_PX)
		gc["home"] = gpos
		gc["px"] = gpos
		gc["max_hp"] = int(g.get("hp", 800))
		gc["cur_hp"] = int(g.get("hp", 800))
		gc["atk"] = int(g.get("atk", 90))
		gc["atk_cd"] = 0.0
		gc["dmg_dealt_to_hero"] = 0
		gc["alive"] = true
		gc["hit_flash"] = 0.0
		gc["stun_t"] = 0.0
		gc["burn_t"] = 0.0
		gc["burn_dps"] = 0.0
		gc["burn_acc"] = 0.0
		gc["slow_t"] = 0.0
		guardians.append(gc)
	_reveal_around_hero()
	_show_toast("Wchodzisz do: %s • Pokonaj strażników i odnajdź 4 ukryte skarby!" % str(data.get("title", "Labirynt")))
	_layout_ui()
	visible = true
	queue_redraw()

func _is_wall(tx: int, ty: int) -> bool:
	if tx < 0 or ty < 0 or ty >= maze_h or tx >= maze_w:
		return true
	return grid_rows[ty].unicode_at(tx) == 35 # '#'

func _can_stand(p: Vector2) -> bool:
	var offs := [
		Vector2(-HERO_RADIUS, -HERO_RADIUS),
		Vector2(HERO_RADIUS, -HERO_RADIUS),
		Vector2(-HERO_RADIUS, HERO_RADIUS),
		Vector2(HERO_RADIUS, HERO_RADIUS),
	]
	for o: Vector2 in offs:
		var q := p + o
		var tx := int(floor(q.x / TILE_PX))
		var ty := int(floor(q.y / TILE_PX))
		if _is_wall(tx, ty):
			return false
	return true

func _reveal_around_hero() -> void:
	var htx := int(floor(hero_px.x / TILE_PX))
	var hty := int(floor(hero_px.y / TILE_PX))
	for dy in range(-3, 4):
		for dx in range(-3, 4):
			if dx * dx + dy * dy <= 11:
				var nx := htx + dx
				var ny := hty + dy
				if nx >= 0 and ny >= 0 and nx < maze_w and ny < maze_h:
					visited["%d,%d" % [nx, ny]] = true

func _show_toast(msg: String) -> void:
	toast_lbl.text = msg
	toast_lbl.visible = true
	toast_timer = 4.2

func _is_chest_opened(cid: String) -> bool:
	if world != null and world.has_method("is_treasure_opened"):
		return bool(world.is_treasure_opened(cid))
	return false

func _try_open_nearest_chest() -> void:
	if nearest_chest.is_empty():
		return
	var cid := str(nearest_chest.get("id", ""))
	if _is_chest_opened(cid):
		return
	var cpos: Vector2 = nearest_chest["px"]
	for g: Dictionary in guardians:
		if bool(g.get("alive", false)) and (g["px"] as Vector2).distance_to(cpos) < 115.0:
			_show_toast("⚔ Strażnik (%s) broni tej komnaty! Pokonaj go, aby otworzyć skrzynię." % str(g.get("name", "Strażnik")))
			return
	var lab_id := str(lab_data.get("id", ""))
	if world != null and world.is_server_authoritative():
		var visit := _visit_id
		world.claim_treasure_reward(nearest_chest, lab_id, func(notice: String) -> void:
			if visible and visit == _visit_id:
				_show_toast(notice)
		)
		return
	var claimed := true
	if world != null and world.has_method("claim_treasure_reward"):
		claimed = bool(world.claim_treasure_reward(nearest_chest, lab_id))
	if not claimed:
		return
	var msg := "SKARB: %s (+%d zł, +%d PD)" % [
		str(nearest_chest.get("title", "Skrzynia")),
		int(nearest_chest.get("gold", 150)),
		int(nearest_chest.get("xp", 95)),
	]
	_show_toast(msg)
	float_texts.append({
		"pos": nearest_chest["px"] as Vector2,
		"txt": "+%d zł  +%d PD" % [int(nearest_chest.get("gold", 150)), int(nearest_chest.get("xp", 95))],
		"col": Color(1.0, 0.88, 0.34),
		"t": 1.6,
	})
	queue_redraw()

func _count_hp_potions() -> int:
	return world.rpg_hud.hp_potion_count() if world != null and world.rpg_hud != null else 0

func _use_labyrinth_potion() -> void:
	if world == null or world.rpg_hud == null:
		return
	var hud = world.rpg_hud
	if hud.hero_hp >= hud.hero_max_hp - 0.5:
		_show_toast("Masz już pełne zdrowie (%d/%d HP)." % [int(round(hud.hero_hp)), int(round(hud.hero_max_hp))])
		return
	var found: bool = hud.use_quick_hp_potion(func(ok: bool, item_name: String, restored: float, notice: String) -> void:
		if not visible:
			return
		if not ok:
			_show_toast(notice)
			return
		var heal_amt := int(round(restored))
		float_texts.append({
			"pos": hero_px + Vector2(-12, -26),
			"txt": "+%d HP" % heal_amt,
			"col": Color(0.42, 1.0, 0.58),
			"t": 1.1,
		})
		_show_toast("🧪 Użyto: %s (+%d HP)" % [item_name, heal_amt])
		queue_redraw()
	)
	if not found:
		_show_toast("Brak mikstur HP w plecaku! Kup zapas u Kupca w stolicy.")

func perform_labyrinth_dodge(is_planetary_a1: bool = false) -> void:
	dodge_invuln_t = 0.42 if is_planetary_a1 else 0.35
	var d := hero_facing.normalized()
	if d.length_squared() < 0.01:
		d = Vector2(0.0, 1.0)
	for _s in 6:
		var cand := hero_px + d * 11.0
		if _can_stand(cand):
			hero_px = cand
		else:
			break
	_reveal_around_hero()
	skill_rings.append({"pos": hero_px, "r": 18.0, "max_r": 72.0, "col": Color(0.42, 0.98, 0.72), "t": 0.36, "dur": 0.36})
	float_texts.append({"pos": hero_px + Vector2(-14, -24), "txt": "UNIK!", "col": Color(0.46, 0.98, 0.72), "t": 0.85})
	queue_redraw()

func _damage_guardian(gi: int, dmg: int, is_crit: bool, kill_heal_pct: float, apply_burn: float = 0.0, apply_stun: float = 0.0, apply_slow: float = 0.0) -> void:
	if gi < 0 or gi >= guardians.size():
		return
	var g: Dictionary = guardians[gi]
	if not bool(g.get("alive", false)):
		return
	var final_dmg := maxi(6, dmg)
	g["cur_hp"] = maxi(0, int(g["cur_hp"]) - final_dmg)
	g["hit_flash"] = 0.22
	if apply_burn > 0.0:
		g["burn_t"] = maxf(float(g.get("burn_t", 0.0)), apply_burn)
		g["burn_dps"] = maxf(float(g.get("burn_dps", 0.0)), maxf(10.0, float(final_dmg) * 0.22))
	if apply_stun > 0.0:
		g["stun_t"] = maxf(float(g.get("stun_t", 0.0)), apply_stun)
	if apply_slow > 0.0:
		g["slow_t"] = maxf(float(g.get("slow_t", 0.0)), apply_slow)
	float_texts.append({
		"pos": (g["px"] as Vector2) + Vector2(0, -24),
		"txt": ("KRYT! -%d" % final_dmg) if is_crit else ("-%d" % final_dmg),
		"col": Color(1.0, 0.88, 0.24) if is_crit else Color(1.0, 0.42, 0.28),
		"t": 1.05 if is_crit else 0.95,
	})
	if int(g["cur_hp"]) <= 0:
		g["alive"] = false
		var hp_cost := int(g.get("dmg_dealt_to_hero", 0))
		g["dmg_dealt_to_hero"] = 0
		if kill_heal_pct > 0.0 and world != null and world.rpg_hud != null:
			world.rpg_hud.hero_hp = minf(world.rpg_hud.hero_max_hp, world.rpg_hud.hero_hp + world.rpg_hud.hero_max_hp * kill_heal_pct)
		if world != null and world.is_server_authoritative():
			_report_guardian_defeat(g, hp_cost)
		else:
			if world != null:
				world.report_monster_kill(str(g["id"]), int(g.get("level", 6)), str(g.get("name", "Strażnik")), hp_cost)
			_show_toast("Pokonano: %s" % str(g.get("name", "Strażnik")))

func perform_labyrinth_attack() -> void:
	if atk_cd > 0.05 or nearest_guard_idx < 0 or nearest_guard_idx >= guardians.size():
		return
	var g: Dictionary = guardians[nearest_guard_idx]
	if not bool(g.get("alive", false)):
		return
	var base_atk := 32
	var hero_lv := 1
	var crit_pct := 6.0
	var dmg_mult := 1.0
	var kill_heal_pct := 0.0
	atk_cd = 0.55
	if world != null and world.rpg_hud != null:
		hero_lv = int(world.rpg_hud.hero_level)
		if world.rpg_hud.has_method("get_total_attack"):
			base_atk = int(world.rpg_hud.get_total_attack())
		if world.rpg_hud.has_method("get_total_crit"):
			crit_pct = float(world.rpg_hud.get_total_crit())
		if world.rpg_hud.has_method("get_basic_attack_interval"):
			atk_cd = float(world.rpg_hud.get_basic_attack_interval())
		if world.rpg_hud.has_method("get_talent_passives"):
			var passives: Dictionary = world.rpg_hud.get_talent_passives()
			dmg_mult += float(passives.get("dmgMult", 0.0))
			kill_heal_pct = float(passives.get("killHealPct", 0.0))
	if world != null and float(world.get("ki_mode_timer")) > 0.0:
		dmg_mult *= 1.25
	var g_lvl := int(g.get("level", 6))
	var lv_penalty := 0.65 if (g_lvl - hero_lv >= 3) else 1.0
	var is_crit := randf() * 100.0 < crit_pct
	var crit_mult := 1.60 if is_crit else 1.0
	var dmg := maxi(10, int(round(float(base_atk) * dmg_mult * lv_penalty * crit_mult * randf_range(0.95, 1.26))))
	skill_rings.append({"pos": g["px"] as Vector2, "r": 12.0, "max_r": 54.0, "col": Color(1.0, 0.72, 0.34), "t": 0.24, "dur": 0.24})
	_damage_guardian(nearest_guard_idx, dmg, is_crit, kill_heal_pct)
	queue_redraw()

func perform_labyrinth_skill(skill_idx: int, node_id: String = "") -> void:
	if skill_idx == 0:
		perform_labyrinth_attack()
		return
	var hud = world.rpg_hud if world != null else null
	var race_k: String = world._hero_race_key() if (world != null and world.has_method("_hero_race_key")) else "legend"
	var nid: String = node_id if not node_id.is_empty() else (str(hud.get_hotbar_node(skill_idx)) if (hud != null and hud.has_method("get_hotbar_node")) else "A1")
	var spec: Dictionary = hud.get_skill_spec(nid) if (hud != null and hud.has_method("get_skill_spec")) else {"mult": 1.75, "radius": 180.0}
	var passives: Dictionary = hud.get_talent_passives() if (hud != null and hud.has_method("get_talent_passives")) else {}
	var base_atk := int(hud.get_total_attack()) if (hud != null and hud.has_method("get_total_attack")) else 36
	var hero_lv := int(hud.hero_level) if hud != null else 1
	var crit_pct := float(hud.get_total_crit()) if (hud != null and hud.has_method("get_total_crit")) else 8.0
	var dmg_scale := 1.0 + float(passives.get("dmgMult", 0.0))
	var kill_heal_pct := float(passives.get("killHealPct", 0.0))
	var shield_mult := float(passives.get("shieldMult", 1.0))

	if nid == "T" or skill_idx == 5:
		if world != null and world.has_method("_activate_ki_mode_visuals"):
			world._activate_ki_mode_visuals(race_k, 20.0)
		skill_rings.append({"pos": hero_px, "r": 24.0, "max_r": 210.0, "col": Color(0.36, 0.96, 1.0), "t": 0.55, "dur": 0.55})
		float_texts.append({"pos": hero_px + Vector2(-28, -28), "txt": "✦ FORMA KI!", "col": Color(0.42, 0.98, 1.0), "t": 1.2})
		for gi in guardians.size():
			if bool(guardians[gi].get("alive", false)) and hero_px.distance_to(guardians[gi]["px"] as Vector2) <= 235.0:
				_damage_guardian(gi, maxi(18, int(round(float(base_atk) * 2.10 * dmg_scale))), false, kill_heal_pct, 3.0, 1.0)
		queue_redraw()
		return

	if world != null and float(world.get("ki_mode_timer")) > 0.0:
		dmg_scale *= 1.25

	# Dodge / Utility / Shield / Heal skills in Labyrinth
	if race_k == "planetary" and nid == "A1":
		perform_labyrinth_dodge(true)
		return
	if hud != null and ((nid == "B1" and race_k in ["android", "sage", "legend"]) or (nid == "C4" and race_k == "planetary") or (nid == "B9" and race_k in ["legend", "android"])):
		var sh_val := (36.0 + float(hud.hero_max_hp) * 0.25) * shield_mult
		hud.hero_shield_hp = maxf(float(hud.hero_shield_hp), sh_val)
		hud.hero_shield_timer = maxf(float(hud.hero_shield_timer), 6.5)
		skill_rings.append({"pos": hero_px, "r": 16.0, "max_r": 96.0, "col": Color(0.38, 0.94, 1.0), "t": 0.45, "dur": 0.45})
		float_texts.append({"pos": hero_px + Vector2(-26, -26), "txt": "+%d OSŁONA" % int(round(sh_val)), "col": Color(0.42, 0.94, 1.0), "t": 1.1})
		if race_k != "legend":
			queue_redraw()
			return
	if hud != null and ((race_k == "android" and nid == "C4") or (race_k == "planetary" and nid in ["C1", "C9"]) or (race_k == "sage" and nid in ["C1", "C4"])):
		var heal_p := 0.40 if nid == "C9" else (0.20 if nid == "C4" else 0.14)
		var ki_p := 0.30 if (race_k == "sage" and nid == "C1") else 0.0
		if heal_p > 0.0 and not (race_k == "sage" and nid == "C1"):
			var h_add := float(hud.hero_max_hp) * heal_p
			hud.hero_hp = minf(float(hud.hero_max_hp), float(hud.hero_hp) + h_add)
			float_texts.append({"pos": hero_px + Vector2(-18, -28), "txt": "+%d HP" % int(round(h_add)), "col": Color(0.42, 1.0, 0.58), "t": 1.1})
		if ki_p > 0.0:
			var k_add := float(hud.hero_max_ki) * ki_p
			hud.hero_ki = minf(float(hud.hero_max_ki), float(hud.hero_ki) + k_add)
			float_texts.append({"pos": hero_px + Vector2(-18, -28), "txt": "+%d KI" % int(round(k_add)), "col": Color(0.42, 0.92, 1.0), "t": 1.1})
		skill_rings.append({"pos": hero_px, "r": 14.0, "max_r": 90.0, "col": Color(0.42, 0.98, 0.64), "t": 0.45, "dur": 0.45})
		queue_redraw()
		return

	# Offensive & AoE Skills hitting guardians in Labyrinth!
	var mult := maxf(1.35, float(spec.get("mult", 1.85)))
	var is_aoe: bool = bool(spec.get("aoe", false)) or (nid in ["C1", "C4", "A4", "B4", "B1", "A9", "B9", "C9"])
	var reach_px := maxf(185.0, float(spec.get("radius", 185.0)))
	var apply_burn := 3.5 if (race_k == "legend" and nid in ["A1", "C1", "C4", "C9"]) else 0.0
	var apply_stun := 1.4 if (nid in ["B1", "B4", "B9"] and race_k in ["legend", "android", "planetary"]) else 0.0
	var apply_slow := 3.5 if (nid in ["B1", "B4"] and race_k in ["planetary", "sage"]) else 0.0
	skill_rings.append({"pos": hero_px, "r": 20.0, "max_r": reach_px * 0.85, "col": Color(1.0, 0.64, 0.24) if race_k == "legend" else Color(0.36, 0.92, 1.0), "t": 0.42, "dur": 0.42})
	var targets: Array[int] = []
	for gi in guardians.size():
		if not bool(guardians[gi].get("alive", false)):
			continue
		if hero_px.distance_to(guardians[gi]["px"] as Vector2) <= reach_px:
			targets.append(gi)
			if not is_aoe:
				break
	if targets.is_empty() and nearest_guard_idx >= 0:
		targets.append(nearest_guard_idx)
	for gi in targets:
		var g_lvl := int(guardians[gi].get("level", 6))
		var lv_pen := 0.65 if (g_lvl - hero_lv >= 3) else 1.0
		var is_crit := randf() * 100.0 < crit_pct
		var dmg := maxi(14, int(round(float(base_atk) * mult * dmg_scale * lv_pen * (1.55 if is_crit else 1.0))))
		_damage_guardian(gi, dmg, is_crit, kill_heal_pct, apply_burn, apply_stun, apply_slow)
	queue_redraw()

func _report_guardian_defeat(guardian: Dictionary, hp_cost: int) -> void:
	var visit := _visit_id
	var point: Vector2 = guardian["px"]
	if not _can_stand(point):
		point = hero_px
	if hero_px.distance_to(point) <= world.LOOT_PICKUP_RADIUS:
		for direction: Vector2 in [Vector2.UP, Vector2.LEFT, Vector2.DOWN, Vector2.RIGHT]:
			var candidate := point + direction * 24.0
			if _can_stand(candidate) and hero_px.distance_to(candidate) > world.LOOT_PICKUP_RADIUS:
				point = candidate
				break
	world.request_pve_defeat(str(guardian["id"]), point, hp_cost, func(res: Dictionary) -> void:
		if not visible or visit != _visit_id:
			return
		var drop: Dictionary = res.get("lootDrop", {})
		if bool(res.get("ok", false)) and not drop.is_empty():
			drop["elapsed"] = 0.0
			drop["label"] = world.server_loot_label(drop)
			ground_drops.append(drop)
		_show_toast(str(res.get("notice", "")))
	)

func _step_ground_drops(delta: float) -> void:
	if ground_drops.is_empty() or world == null:
		return
	var visit := _visit_id
	var current_drops: Array[Dictionary] = []
	for drop: Dictionary in ground_drops:
		drop["elapsed"] = float(drop["elapsed"]) + delta
		if bool(drop.get("removed", false)) or float(drop["elapsed"]) >= 120.0:
			continue
		if float(drop["elapsed"]) >= 0.45:
			world.try_pickup_server_loot(drop, hero_px, func(notice: String, _ok: bool) -> void:
				if visible and visit == _visit_id:
					_show_toast(notice)
			)
		current_drops.append(drop)
	ground_drops = current_drops

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F or event.keycode == KEY_ENTER:
			if not nearest_chest.is_empty():
				_try_open_nearest_chest()
				get_viewport().set_input_as_handled()
		elif event.keycode == KEY_Q or event.keycode == KEY_SPACE:
			perform_labyrinth_attack()
			get_viewport().set_input_as_handled()
		elif event.keycode in [KEY_1, KEY_2, KEY_3, KEY_4]:
			var si := int(event.keycode - KEY_1) + 1
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
				world.rpg_hud.trigger_skill(si)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_R:
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
				world.rpg_hud.trigger_skill(5)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_V or event.keycode == KEY_SHIFT:
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_dodge"):
				world.rpg_hud.trigger_dodge()
			else:
				perform_labyrinth_dodge(false)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_H or event.keycode == KEY_E:
			_use_labyrinth_potion()
			get_viewport().set_input_as_handled()

func _sync_skill_bar_labels() -> void:
	if world == null or world.rpg_hud == null:
		return
	var hud = world.rpg_hud
	for i in skill_btns.size():
		var si := i + 1
		var nid: String = hud.get_hotbar_node(si) if hud.has_method("get_hotbar_node") else "A1"
		var unlocked: bool = hud.is_hotbar_skill_unlocked(si) if hud.has_method("is_hotbar_skill_unlocked") else false
		var cd := float(hud.cooldowns[si]) if si < hud.cooldowns.size() else 0.0
		if not unlocked:
			skill_btns[i].text = "[%d] %s 🔒" % [si, nid]
			skill_btns[i].modulate = Color(0.62, 0.62, 0.68, 0.80)
		elif cd > 0.05:
			skill_btns[i].text = "[%d] %.1fs" % [si, cd]
			skill_btns[i].modulate = Color(0.72, 0.82, 0.96, 0.92)
		else:
			skill_btns[i].text = "[%d] %s" % [si, nid]
			skill_btns[i].modulate = Color.WHITE
	var dcd := float(hud.dodge_cd) if ("dodge_cd" in hud) else 0.0
	btn_dodge.text = ("💨 %.1fs" % dcd) if dcd > 0.05 else "💨 UNIK [V]"
	var ki_u: bool = hud.is_hotbar_skill_unlocked(5) if hud.has_method("is_hotbar_skill_unlocked") else false
	var ki_rem := float(world.get("ki_mode_timer"))
	btn_ki_mode.text = ("✦ KI %ds" % int(ceil(ki_rem))) if ki_rem > 0.05 else ("✦ KI [R]" if ki_u else "🔒 KI [R]")
	btn_ki_mode.modulate = Color.WHITE if (ki_u or ki_rem > 0.05) else Color(0.62, 0.62, 0.68, 0.80)

func _process(delta: float) -> void:
	if not visible:
		return
	elapsed += delta
	atk_cd = maxf(0.0, atk_cd - delta)
	dodge_invuln_t = maxf(0.0, dodge_invuln_t - delta)
	if world != null and float(world.get("ki_mode_timer")) > 0.0:
		world.ki_mode_timer = maxf(0.0, float(world.ki_mode_timer) - delta)
		if world.ki_mode_timer <= 0.0 and world.hero != null and world.hero.has_method("set_ki_mode"):
			world.hero.set_ki_mode(false)
	if toast_timer > 0.0:
		toast_timer -= delta
		if toast_timer <= 0.0:
			toast_lbl.visible = false

	var dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		dir.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		dir.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		dir.y += 1.0
	if world != null and int(world.move_pointer) != -1:
		dir = world.motion
	if dir.length_squared() > 0.001:
		dir = dir.normalized()
		hero_facing = dir
		var step := dir * HERO_SPEED * delta
		if _can_stand(hero_px + step):
			hero_px += step
		elif _can_stand(hero_px + Vector2(step.x, 0.0)):
			hero_px.x += step.x
		elif _can_stand(hero_px + Vector2(0.0, step.y)):
			hero_px.y += step.y
		_reveal_around_hero()

	# Update chests proximity
	nearest_chest = {}
	var best_cd := 68.0
	for c: Dictionary in chests:
		if _is_chest_opened(str(c.get("id", ""))):
			continue
		var d := hero_px.distance_to(c["px"] as Vector2)
		if d < best_cd:
			best_cd = d
			nearest_chest = c
	if not nearest_chest.is_empty():
		btn_open_chest.text = "▶ OTWÓRZ: %s" % str(nearest_chest.get("title", "Ukryty Skarb"))
		btn_open_chest.visible = true
	else:
		btn_open_chest.visible = false

	# Update guardians patrol, status debuffs, active chase & counter-attack AI
	var kill_heal_pct := float((world.rpg_hud.get_talent_passives() as Dictionary).get("killHealPct", 0.0)) if (world != null and world.rpg_hud != null and world.rpg_hud.has_method("get_talent_passives")) else 0.0
	nearest_guard_idx = -1
	var best_gd := 165.0
	for gi in guardians.size():
		var g: Dictionary = guardians[gi]
		if not bool(g.get("alive", false)):
			continue
		g["hit_flash"] = maxf(0.0, float(g.get("hit_flash", 0.0)) - delta)
		g["atk_cd"] = maxf(0.0, float(g.get("atk_cd", 0.0)) - delta)
		g["stun_t"] = maxf(0.0, float(g.get("stun_t", 0.0)) - delta)
		g["slow_t"] = maxf(0.0, float(g.get("slow_t", 0.0)) - delta)
		var bt := float(g.get("burn_t", 0.0))
		if bt > 0.0:
			g["burn_t"] = maxf(0.0, bt - delta)
			g["burn_acc"] = float(g.get("burn_acc", 0.0)) + delta
			if float(g["burn_acc"]) >= 0.50:
				g["burn_acc"] = float(g["burn_acc"]) - 0.50
				_damage_guardian(gi, maxi(5, int(round(float(g.get("burn_dps", 12.0)) * 0.50))), false, kill_heal_pct)
				if not bool(g.get("alive", false)):
					continue
		if float(g.get("stun_t", 0.0)) > 0.05:
			var gd_s := hero_px.distance_to(g["px"] as Vector2)
			if gd_s < best_gd:
				best_gd = gd_s
				nearest_guard_idx = gi
			continue
		var slow_mult := 0.60 if float(g.get("slow_t", 0.0)) > 0.05 else 1.0
		var home: Vector2 = g["home"]
		var cur_gp: Vector2 = g["px"]
		var dist_h := hero_px.distance_to(cur_gp)
		var was_hurt := int(g.get("cur_hp", 100)) < int(g.get("max_hp", 100))
		if (dist_h < 120.0 or (was_hurt and dist_h < 185.0)) and cur_gp.distance_to(home) < 220.0:
			if dist_h > 30.0:
				var gstep := (hero_px - cur_gp).normalized() * 130.0 * slow_mult * delta
				if _can_stand(cur_gp + gstep):
					cur_gp += gstep
				elif _can_stand(cur_gp + Vector2(gstep.x, 0.0)):
					cur_gp.x += gstep.x
				elif _can_stand(cur_gp + Vector2(0.0, gstep.y)):
					cur_gp.y += gstep.y
				g["px"] = cur_gp
			if hero_px.distance_to(cur_gp) <= 58.0 and float(g["atk_cd"]) <= 0.0:
				g["atk_cd"] = 1.30
				if dodge_invuln_t > 0.05:
					float_texts.append({"pos": hero_px + Vector2(-12, -26), "txt": "UNIK!", "col": Color(0.46, 0.98, 0.72), "t": 0.9})
				else:
					var g_atk := int(g.get("atk", 90))
					var g_lvl := int(g.get("level", 7))
					var hero_lv := int(world.rpg_hud.hero_level) if (world != null and world.rpg_hud != null) else 1
					var hero_def := int(world.rpg_hud.get_total_defense()) if (world != null and world.rpg_hud != null and world.rpg_hud.has_method("get_total_defense")) else 16
					var adv_mult := 1.35 if (g_lvl - hero_lv >= 3) else 1.0
					var gdmg := maxi(8, int(round(float(g_atk) * adv_mult - float(hero_def) * 0.55)))
					g["dmg_dealt_to_hero"] = int(g.get("dmg_dealt_to_hero", 0)) + gdmg
					float_texts.append({
						"pos": hero_px + Vector2(0, -24),
						"txt": "-%d HP" % gdmg,
						"col": Color(1.0, 0.26, 0.24),
						"t": 1.0,
					})
					if world != null and world.rpg_hud != null and world.rpg_hud.has_method("take_combat_damage"):
						if world.rpg_hud.take_combat_damage(gdmg):
							if world.has_method("handle_hero_defeat"):
								world.handle_hero_defeat()
							return
		else:
			var off := Vector2(cos(elapsed * 1.4 + float(gi) * 2.1), sin(elapsed * 1.1 + float(gi) * 1.7)) * 18.0
			if _can_stand(home + off):
				g["px"] = home + off
		var gd := hero_px.distance_to(g["px"] as Vector2)
		if gd < best_gd:
			best_gd = gd
			nearest_guard_idx = gi
	btn_attack.text = ("⚔ ATAK (%d)" % int(guardians[nearest_guard_idx]["cur_hp"])) if nearest_guard_idx >= 0 else "⚔ ATAK [Q]"
	var pot_cnt := _count_hp_potions()
	btn_potion.text = "🧪 ELIKSIR (%d) [H]" % pot_cnt
	btn_potion.modulate = Color(1.0, 1.0, 1.0, 1.0) if pot_cnt > 0 else Color(0.66, 0.66, 0.72, 0.78)
	_sync_skill_bar_labels()

	near_exit = hero_px.distance_to(exit_px) < 42.0
	_step_ground_drops(delta)

	var kept_r: Array[Dictionary] = []
	for sr: Dictionary in skill_rings:
		sr["t"] = float(sr["t"]) - delta
		if float(sr["t"]) > 0.0:
			kept_r.append(sr)
	skill_rings = kept_r

	var kept: Array[Dictionary] = []
	for ft: Dictionary in float_texts:
		ft["t"] = float(ft["t"]) - delta
		ft["pos"] = (ft["pos"] as Vector2) + Vector2(0.0, -34.0 * delta)
		if float(ft["t"]) > 0.0:
			kept.append(ft)
	float_texts = kept
	queue_redraw()

func _draw() -> void:
	var pal: Dictionary = THEME_PALETTES.get(str(lab_data.get("theme", current_land)), THEME_PALETTES["pyra"])
	var f: Font = MapStyle.font()
	var fb: Font = MapStyle.body_font()
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = size
	draw_rect(Rect2(Vector2.ZERO, vs), pal["bg"] as Color, true)

	var cam_off := vs * 0.5 - hero_px
	var accent: Color = pal["accent"]
	var wall_top: Color = pal["wall_top"]
	var wall_side: Color = pal["wall_side"]
	var wall_edge: Color = pal["wall_edge"]
	var floor_a: Color = pal["floor_a"]
	var floor_b: Color = pal["floor_b"]

	# Draw discovered maze floor & beveled walls
	for ty in maze_h:
		for tx in maze_w:
			var key := "%d,%d" % [tx, ty]
			if not visited.has(key):
				continue
			var tile_c := Vector2((float(tx) + 0.5) * TILE_PX, (float(ty) + 0.5) * TILE_PX)
			var dist_t := hero_px.distance_to(tile_c) / TILE_PX
			var light := clampf(1.18 - dist_t * 0.16, 0.36, 1.08)
			var scr := Vector2(float(tx) * TILE_PX, float(ty) * TILE_PX) + cam_off
			if scr.x > vs.x + TILE_PX or scr.y > vs.y + TILE_PX or scr.x + TILE_PX < -TILE_PX or scr.y + TILE_PX < -TILE_PX:
				continue
			var tr := Rect2(scr, Vector2(TILE_PX, TILE_PX))
			if _is_wall(tx, ty):
				draw_rect(tr, wall_side * light, true)
				draw_rect(Rect2(scr + Vector2(3, 3), Vector2(TILE_PX - 6, TILE_PX - 14)), wall_top * light, true)
				draw_rect(Rect2(scr + Vector2(3, 3), Vector2(TILE_PX - 6, TILE_PX - 14)), Color(wall_edge.r, wall_edge.g, wall_edge.b, wall_edge.a * light * 0.65), false, 1.5)
			else:
				var fc := floor_a if ((tx + ty) % 2 == 0) else floor_b
				draw_rect(tr, fc * light, true)
				draw_rect(tr, Color(0.02, 0.02, 0.03, 0.25), false, 1.0)

	# Draw Exit Portal at spawn (1, 1)
	var ep := exit_px + cam_off
	var ep_pulse := 0.5 + 0.5 * sin(elapsed * 3.5)
	draw_circle(ep, 22.0 + ep_pulse * 4.0, Color(0.24, 0.88, 1.0, 0.24))
	draw_arc(ep, 20.0, 0.0, TAU, 28, Color(0.45, 0.96, 1.0, 0.92), 3.0, true)
	draw_string(fb, ep + Vector2(-26, -26), "WYJŚCIE", HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(0.76, 0.96, 1.0))

	# Draw 4 Hidden Treasure Chests
	var opened_cnt := 0
	for c: Dictionary in chests:
		var cid := str(c.get("id", ""))
		var opened := _is_chest_opened(cid)
		if opened:
			opened_cnt += 1
		var ckey := "%d,%d" % [int(c.get("tx", 1)), int(c.get("ty", 1))]
		if not visited.has(ckey):
			continue
		var cp: Vector2 = (c["px"] as Vector2) + cam_off
		if not opened:
			var glow_r := 26.0 + 6.0 * sin(elapsed * 4.2)
			draw_circle(cp, glow_r, Color(1.0, 0.82, 0.22, 0.22))
			draw_rect(Rect2(cp - Vector2(16, 12), Vector2(32, 24)), Color(0.56, 0.34, 0.10, 1.0), true)
			draw_rect(Rect2(cp - Vector2(16, 12), Vector2(32, 24)), Color(1.0, 0.86, 0.34, 0.98), false, 2.5)
			draw_rect(Rect2(cp - Vector2(4, 3), Vector2(8, 8)), Color(1.0, 0.92, 0.45, 1.0), true)
			draw_string_outline(fb, cp + Vector2(-46, -18), "★ UKRYTY SKARB", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0.04, 0.02, 0.01, 0.96))
			draw_string(fb, cp + Vector2(-46, -18), "★ UKRYTY SKARB", HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.90, 0.42))
		else:
			draw_rect(Rect2(cp - Vector2(14, 10), Vector2(28, 20)), Color(0.22, 0.18, 0.14, 0.72), true)
			draw_rect(Rect2(cp - Vector2(14, 10), Vector2(28, 20)), Color(0.45, 0.40, 0.32, 0.72), false, 1.5)
			draw_string(fb, cp + Vector2(-28, -15), "OTWARTE", HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color(0.65, 0.72, 0.68))

	# Draw Patrolling Labyrinth Guardians
	for g: Dictionary in guardians:
		if not bool(g.get("alive", false)):
			continue
		var gpos: Vector2 = g["px"]
		var gkey := "%d,%d" % [int(floor(gpos.x / TILE_PX)), int(floor(gpos.y / TILE_PX))]
		if not visited.has(gkey):
			continue
		var gp := gpos + cam_off
		var flash := float(g.get("hit_flash", 0.0)) > 0.01
		draw_circle(gp, 20.0, Color(1.0, 0.85, 0.85, 0.95) if flash else Color(0.78, 0.18, 0.16, 0.94))
		var ring_col := Color(1.0, 0.90, 0.28, 0.98) if float(g.get("stun_t", 0.0)) > 0.05 else Color(1.0, 0.62, 0.32, 0.96)
		draw_arc(gp, 20.0, 0.0, TAU, 24, ring_col, 2.8, true)
		var pct := clampf(float(g["cur_hp"]) / maxf(float(g["max_hp"]), 1.0), 0.0, 1.0)
		draw_rect(Rect2(gp.x - 26.0, gp.y - 34.0, 52.0, 7.0), Color(0.06, 0.04, 0.04, 0.92), true)
		draw_rect(Rect2(gp.x - 25.0, gp.y - 33.0, 50.0 * pct, 5.0), Color(0.96, 0.24, 0.20, 0.98), true)
		var gtitle := "%s Poz.%d" % [str(g.get("name", "Strażnik")), int(g.get("level", 6))]
		draw_string_outline(fb, gp + Vector2(-48, -40), gtitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 4, Color(0.04, 0.01, 0.01, 0.96))
		draw_string(fb, gp + Vector2(-48, -40), gtitle, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(1.0, 0.80, 0.62))

	# Draw Skill Impact & Dodge VFX Rings
	for sr: Dictionary in skill_rings:
		var prog := 1.0 - clampf(float(sr["t"]) / maxf(float(sr["dur"]), 0.05), 0.0, 1.0)
		var rad := lerpf(float(sr["r"]), float(sr["max_r"]), prog)
		var col: Color = sr["col"] as Color
		var sp := (sr["pos"] as Vector2) + cam_off
		draw_arc(sp, rad, 0.0, TAU, 32, Color(col.r, col.g, col.b, (1.0 - prog) * 0.92), 3.6, true)

	for drop: Dictionary in ground_drops:
		var point := Vector2(float(drop["x"]), float(drop["z"]))
		var tile := "%d,%d" % [floori(point.x / TILE_PX), floori(point.y / TILE_PX)]
		if visited.has(tile):
			var screen_point := point + cam_off
			var gold := Color(1.0, 0.86, 0.38)
			draw_circle(screen_point, 14.0, Color(gold, 0.24))
			draw_arc(screen_point, 11.0, 0.0, TAU, 16, gold, 2.1, true)
			var label := str(drop["label"])
			var width := fb.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x
			var label_point := screen_point + Vector2(-width * 0.5, -18.0)
			draw_string_outline(fb, label_point, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 4, Color.BLACK)
			draw_string(fb, label_point, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, gold)

	# Draw Hero in center with glowing torch halo (+ emerald dodge aura when i-frames active!)
	var hp_scr := hero_px + cam_off
	draw_circle(hp_scr, 42.0, Color(accent.r, accent.g, accent.b, 0.12))
	if dodge_invuln_t > 0.05:
		draw_arc(hp_scr, 24.0, 0.0, TAU, 24, Color(0.42, 1.0, 0.72, 0.95), 3.2, true)
	draw_circle(hp_scr, 16.0, Color(0.24, 0.94, 1.0, 0.96))
	draw_arc(hp_scr, 16.0, 0.0, TAU, 24, Color(1.0, 0.94, 0.72, 0.98), 2.6, true)
	draw_line(hp_scr, hp_scr + hero_facing.normalized() * 22.0, Color(1.0, 0.94, 0.72, 0.96), 3.0, true)

	# Floating combat/loot texts
	for ft: Dictionary in float_texts:
		var fp: Vector2 = (ft["pos"] as Vector2) + cam_off
		draw_string_outline(fb, fp, str(ft["txt"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 5, Color(0.02, 0.01, 0.01, 0.98))
		draw_string(fb, fp, str(ft["txt"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, ft["col"] as Color)

	# Top Header Bar
	draw_rect(Rect2(0, 0, vs.x, 68.0), Color(0.04, 0.035, 0.055, 0.94), true)
	draw_line(Vector2(0, 68.0), Vector2(vs.x, 68.0), Color(0.92, 0.72, 0.34, 0.85), 2.0)
	draw_string(f, Vector2(198, 32), "⚔ %s (Poz. %d)" % [str(lab_data.get("title", "Labirynt")), int(lab_data.get("level", 5))], HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(1.0, 0.90, 0.56))
	draw_string(fb, Vector2(198, 54), "%s  •  Skarby: %d/%d  •  [WASD] ruch  •  [Q] atak  •  [1–4] skille  •  [V] unik  •  [R] KI  •  [H] eliksir" % [
		str(lab_data.get("subtitle", "")), opened_cnt, chests.size()
	], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.84, 0.90, 0.96))

	# Live Hero HP / Shield / KI bars in Top-Right Header
	if world != null and world.rpg_hud != null:
		var hud = world.rpg_hud
		var bw_h := 268.0
		var bx_h := vs.x - bw_h - 18.0
		var hp_cur := float(hud.hero_hp)
		var hp_max := maxf(float(hud.hero_max_hp), 1.0)
		var hp_frac := clampf(hp_cur / hp_max, 0.0, 1.0)
		var sh_val := float(hud.hero_shield_hp) if float(hud.hero_shield_timer) > 0.05 else 0.0
		var ki_cur := float(hud.hero_ki)
		var ki_max := maxf(float(hud.hero_max_ki), 1.0)
		var ki_frac := clampf(ki_cur / ki_max, 0.0, 1.0)
		# HP bar
		var hp_rect := Rect2(bx_h, 11.0, bw_h, 21.0)
		draw_rect(hp_rect, Color(0.10, 0.04, 0.05, 0.95), true)
		draw_rect(Rect2(hp_rect.position + Vector2(1, 1), Vector2((bw_h - 2.0) * hp_frac, 19.0)), Color(0.86, 0.18, 0.18, 0.96), true)
		if sh_val > 0.5:
			var sh_frac := clampf(sh_val / hp_max, 0.0, 1.0)
			draw_rect(Rect2(hp_rect.position + Vector2(1, 1), Vector2((bw_h - 2.0) * sh_frac, 5.0)), Color(0.32, 0.94, 1.0, 0.96), true)
		draw_rect(hp_rect, Color(0.92, 0.72, 0.34, 0.85), false, 1.4)
		var hp_txt := "HP %d / %d%s" % [int(round(hp_cur)), int(round(hp_max)), (" [+%d]" % int(round(sh_val))) if sh_val > 0.5 else ""]
		draw_string_outline(fb, Vector2(bx_h + 8.0, 26.5), hp_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, 3, Color(0.02, 0.01, 0.01, 0.98))
		draw_string(fb, Vector2(bx_h + 8.0, 26.5), hp_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 12, Color(1.0, 0.96, 0.92))
		# KI bar
		var ki_rect := Rect2(bx_h, 38.0, bw_h, 18.0)
		draw_rect(ki_rect, Color(0.04, 0.08, 0.14, 0.95), true)
		draw_rect(Rect2(ki_rect.position + Vector2(1, 1), Vector2((bw_h - 2.0) * ki_frac, 16.0)), Color(0.18, 0.70, 0.98, 0.96), true)
		draw_rect(ki_rect, Color(0.45, 0.82, 0.98, 0.80), false, 1.2)
		var ki_txt := "KI %d / %d   •   Poz.%d" % [int(round(ki_cur)), int(round(ki_max)), int(hud.hero_level)]
		draw_string_outline(fb, Vector2(bx_h + 8.0, 51.5), ki_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, 3, Color(0.02, 0.02, 0.04, 0.98))
		draw_string(fb, Vector2(bx_h + 8.0, 51.5), ki_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 11, Color(0.84, 0.96, 1.0))

	# Corner Maze Minimap (top-left below header)
	var mm_cell := 9.0
	var mm_origin := Vector2(18.0, 82.0)
	var mm_sz := Vector2(float(maze_w) * mm_cell + 8.0, float(maze_h) * mm_cell + 8.0)
	draw_rect(Rect2(mm_origin - Vector2(4, 4), mm_sz), Color(0.03, 0.03, 0.05, 0.88), true)
	draw_rect(Rect2(mm_origin - Vector2(4, 4), mm_sz), Color(0.88, 0.68, 0.32, 0.85), false, 1.8)
	for ty in maze_h:
		for tx in maze_w:
			if not visited.has("%d,%d" % [tx, ty]):
				continue
			var r := Rect2(mm_origin + Vector2(float(tx) * mm_cell, float(ty) * mm_cell), Vector2(mm_cell, mm_cell))
			draw_rect(r, Color(0.32, 0.30, 0.36, 0.92) if _is_wall(tx, ty) else Color(0.14, 0.16, 0.22, 0.92), true)
	for c: Dictionary in chests:
		if not _is_chest_opened(str(c.get("id", ""))) and visited.has("%d,%d" % [int(c.get("tx", 1)), int(c.get("ty", 1))]):
			var mp := mm_origin + Vector2((float(c.get("tx", 1)) + 0.5) * mm_cell, (float(c.get("ty", 1)) + 0.5) * mm_cell)
			draw_circle(mp, 3.2, Color(1.0, 0.86, 0.28, 1.0))
	var h_mm := mm_origin + Vector2(hero_px.x / TILE_PX * mm_cell, hero_px.y / TILE_PX * mm_cell)
	draw_circle(h_mm, 3.4, Color(0.24, 0.98, 1.0, 1.0))
