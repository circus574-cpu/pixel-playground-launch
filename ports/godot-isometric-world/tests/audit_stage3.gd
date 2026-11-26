extends SceneTree
## Automated Stage 3 Combat, 29-Node Talent Tree, Hotbar [1-4], Dodge/Channel,
## 4-Race Mechanics, Forma KI Clips, 5 New VFX, Target Lock, Wildlife Flee & Labyrinth Test Suite.

const ActorView := preload("res://scripts/actor_view.gd")
const CombatVfx := preload("res://scripts/combat_vfx.gd")
const Hud := preload("res://scripts/rpg_hud.gd")
const Labyrinth := preload("res://scripts/labyrinth_room.gd")

class TestWorld extends "res://scripts/world.gd":
	func _ready() -> void:
		set_process(false)
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
				btn_talk_npc, btn_open_treasure, btn_gather, combat_toast_lbl, stick_layer]:
			add_child(node)
		combat_vfx = CombatVfx.new()
		ysort.add_child(combat_vfx)

	func layout_minimap() -> void:
		pass

	func sync_hero(_force_scan: bool = false) -> void:
		if hero != null:
			hero.position = Vector2(hero_pos.x, hero_pos.y)

	func is_walkable(_x: float, _z: float) -> bool:
		return true

	func height_at(_x: float, _z: float) -> float:
		return 4.0

	func is_in_water(_x: float, _z: float) -> bool:
		return false

	func is_on_road(_x: float, _z: float) -> bool:
		return false

var checks := 0
var failures := 0

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: " + label)

func _make_dummy_agent(aid: String, kind: String, pos: Vector2, hp: int = 400, atk: int = 40) -> Dictionary:
	var av := ActorView.new()
	av.position = pos
	return {
		"id": aid,
		"kind": kind,
		"name": "Test-" + aid,
		"actor_id": "m_pyra_wisp",
		"level": 5,
		"is_elite": false,
		"pos": pos,
		"home": pos,
		"max_hp": hp,
		"cur_hp": hp,
		"atk": atk,
		"atk_cd": 0.0,
		"aggro_windup": 0.0,
		"was_aggro": false,
		"roared": false,
		"alive": true,
		"speed": 12.0,
		"dmg_dealt_to_hero": 0,
		"node": av,
	}

func _unlock_nodes(hud: Control, ids: Array) -> void:
	var umap: Dictionary = hud._unlocked_map()
	for id_v in ids:
		umap[str(id_v)] = true
	hud.recalc_stats(false)

func _initialize() -> void:
	var world := TestWorld.new()
	root.add_child.call_deferred(world)
	run.call_deferred(world)

func run(world: TestWorld) -> void:
	var hud := Hud.new()
	hud.world = world
	world.rpg_hud = hud
	world.hud.add_child(hud)
	var lab := Labyrinth.new()
	lab.world = world
	world.labyrinth_room = lab
	world.hud.add_child(lab)

	var hero_av := ActorView.new()
	var actors_parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/actors.json"))
	var pyra_def: Dictionary = (actors_parsed as Dictionary).get("pyra.hero", {}) if actors_parsed is Dictionary else {}
	expect(not pyra_def.is_empty(), "loaded real pyra.hero 47-clip manifest from actors.json")
	hero_av.setup(pyra_def, "Ignis", false, true, "hero")
	world.hero = hero_av
	world.ysort.add_child(hero_av)

	world.capital_center = Vector2(-500.0, -500.0)
	world.safe_city_radius = 60.0
	world.hero_pos = Vector2(200.0, 200.0)
	hud.hero_land = "pyra"
	hud.current_land = "pyra"
	hud.hero_level = 20
	hud.set_region("pyra")

	# ==========================================================================
	# 1. FORMA KI CLIP RETENTION (KI_CLIP_MAP in actor_view.gd on REAL 47-clip manifest!)
	# ==========================================================================
	hero_av.set_ki_mode(true, 20.0)
	for base_act in ["sk_A1", "sk_B1", "sk_C1", "sk_A4", "sk_B4", "sk_C4", "sk_A9", "sk_B9", "sk_C9", "attack3", "finisher", "guard"]:
		var resolved: String = hero_av.clip_for(base_act)
		expect(resolved.begins_with("ki"), "Forma KI maps " + base_act + " to authentic ki-clip -> " + resolved)
	hero_av.set_ki_mode(false)

	# ==========================================================================
	# 2. TALENT PASSIVES (NO DOUBLE-COUNTING) + ASSIGNABLE HOTBAR [1-4]
	# ==========================================================================
	var lv1_passives: Dictionary = hud.get_talent_passives()
	expect(is_equal_approx(float(lv1_passives["dmgMult"]), 0.0), "dmgMult base is 0.0 (no double-counting)")
	expect(is_equal_approx(float(lv1_passives["rangeMult"]), 0.0), "rangeMult base is 0.0 (no double-counting)")
	expect(not hud.assign_hotbar_slot(1, "B4"), "cannot assign locked skill B4 to hotbar")
	_unlock_nodes(hud, ["A1", "A2", "A3", "A4", "A7", "A8", "A9", "B1", "B4", "B7", "B8", "B9", "C1", "C2", "C3", "C4", "C5", "C6", "C7", "C8", "C9", "T"])
	expect(hud.assign_hotbar_slot(1, "B4"), "assign unlocked B4 to slot 1")
	expect(hud.get_hotbar_node(1) == "B4", "slot 1 now holds B4")
	expect(hud.assign_hotbar_slot(4, "B4"), "reassigning B4 to slot 4 swaps cleanly")
	expect(hud.get_hotbar_node(4) == "B4" and hud.get_hotbar_node(1) != "B4", "duplicate B4 swapped out of slot 1")
	expect(hud.assign_hotbar_slot(1, "A1"), "restore A1 to slot 1")

	# ==========================================================================
	# 3. TARGET LOCK + LEGEND (ŻAR, B4 RAGE, C4 BURN-ALL, B9 LETHAL-SAVE, BURN)
	# ==========================================================================
	var m1 := _make_dummy_agent("m-leg-1", "monster", Vector2(240.0, 200.0), 5000, 999)
	world.ysort.add_child(m1["node"])
	world.live_agents = [m1]
	world.set_locked_target("m-leg-1")
	expect(bool((m1["node"] as ActorView).is_locked_target), "Target Lock highlights ActorView ring")
	var tinfo: Dictionary = world.get_locked_target_info()
	expect(str(tinfo.get("id", "")) == "m-leg-1", "get_locked_target_info returns locked monster")

	hud.hero_res = 0.0
	world.last_combat_time = world.world_time
	world.perform_combat_attack(0, 1.0, "R")
	expect(float(hud.hero_res) >= 5.5, "Legend basic hit generates Żar (+6 w/ C2)")
	world.perform_combat_attack(1, 1.0, "A1")
	expect(float(m1.get("burn_t", 0.0)) > 1.0, "Legend A1+A2 applies burn DoT")
	world.perform_combat_attack(2, 1.0, "B4")
	expect(float(world.hero_buffs.get("rage_t", 0.0)) > 5.0, "Legend B4 activates Gniew rage buff")
	hud.hero_res = 80.0
	world.perform_combat_attack(3, 1.0, "C4")
	expect(float(hud.hero_res) <= 0.1, "Legend C4 consumes all Żar for scaled AoE")

	# Legend B9 Ostatni Płomień lethal-save!
	world.perform_combat_attack(2, 1.0, "B9")
	expect(float(world.hero_buffs.get("last_flame_t", 0.0)) > 3.0, "Legend B9 activates Ostatni Płomień")
	hud.hero_shield_hp = 0.0
	hud.hero_shield_timer = 0.0
	hud.hero_hp = 10.0
	m1["alive"] = true
	m1["cur_hp"] = 3000
	m1["pos"] = Vector2(220.0, 200.0)
	m1["atk_cd"] = 0.0
	m1["aggro_windup"] = 0.0
	m1["was_aggro"] = true
	m1["stun_t"] = 0.0
	world.step_world(0.05)
	expect(float(hud.hero_hp) >= float(hud.hero_max_hp) * 0.25, "Legend B9 prevents lethal death and restores 30% HP")
	expect(float(world.hero_buffs.get("last_flame_t", 0.0)) <= 0.05, "Legend B9 lethal-save consumed after triggering")

	# ==========================================================================
	# 4. DODGE [V] I-FRAMES & KI CHANNELING [X]
	# ==========================================================================
	hud.dodge_cd = 0.0
	var pre_dodge_hp := float(hud.hero_hp)
	hud.trigger_dodge()
	expect(world.dodge_invuln_t > 0.25, "trigger_dodge grants i-frames")
	m1["atk_cd"] = 0.0
	m1["aggro_windup"] = 0.0
	world.step_world(0.05)
	expect(is_equal_approx(float(hud.hero_hp), pre_dodge_hp), "monster hit during Dodge i-frames deals 0 damage")

	world.dodge_invuln_t = 0.0
	world.dodge_dash_t = 0.0
	hud.channel_cd = 0.0
	hud.hero_ki = 10.0
	hud.trigger_channel()
	expect(world.ki_channel_t > 1.5, "trigger_channel starts Ki channeling")
	world.step_world(0.5)
	expect(float(hud.hero_ki) > 15.0, "Ki channeling smoothly regenerates Ki")

	# ==========================================================================
	# 5. ANDROID (ŁADUNEK, OVERHEAT, C4 VENT, A1 MARK, C1 BEAM, C9 FREE KI)
	# ==========================================================================
	hud.hero_land = "nexus"
	hud.set_region("nexus")
	_unlock_nodes(hud, ["A1", "A4", "A7", "A8", "A9", "B1", "B4", "B5", "B9", "C1", "C2", "C4", "C9", "T"])
	world._clear_transient_combat_state()
	var m2 := _make_dummy_agent("m-and-1", "monster", Vector2(260.0, 200.0), 1500, 30)
	world.ysort.add_child(m2["node"])
	world.live_agents = [m2]
	hud.hero_res = 98.0
	world.perform_combat_attack(0, 1.0, "R")
	expect(world.android_overheat_t > 0.5, "Android reaching max Charge triggers Overheat")
	expect(not world.can_hero_cast_skill("A1"), "Android cannot cast A1 while overheated")
	expect(world.can_hero_cast_skill("C4"), "Android CAN cast C4 Emergency Cooling while overheated")
	hud.hero_hp = 50.0
	world.perform_combat_attack(3, 1.0, "C4")
	expect(world.android_overheat_t <= 0.01 and float(hud.hero_res) <= 0.01, "Android C4 clears Overheat and Charge")
	expect(float(hud.hero_hp) > 55.0, "Android C4 heals 10% HP")
	world.perform_combat_attack(1, 1.0, "A1")
	expect(float(m2.get("marked_t", 0.0)) > 4.0 and world.locked_target_id == "m-and-1", "Android A1 marks and locks target")
	hud.hero_res = 60.0
	world.perform_combat_attack(3, 1.0, "C1")
	expect(float(hud.hero_res) <= 0.01, "Android C1 Plasma Beam consumes Charge")
	world.perform_combat_attack(4, 1.0, "C9")
	expect(world.is_free_ki_active() and is_equal_approx(hud.get_hotbar_skill_ki(1), 0.0), "Android C9 Overload makes skills cost 0 KI")

	# ==========================================================================
	# 6. PLANETARY (TERRAIN ADAPTATION, 3-HIT COMBO, A1 DODGE, B1+B5 SHOCKWAVE, C1 HOT)
	# ==========================================================================
	world.current_land = "verdant"
	hud.hero_land = "verdant"
	hud.set_region("verdant")
	_unlock_nodes(hud, ["A1", "A3", "A5", "A7", "A8", "A9", "B1", "B2", "B4", "B5", "B6", "B7", "B8", "B9", "C1", "C4", "C6", "C8", "C9", "T"])
	world._clear_transient_combat_state()
	var m3 := _make_dummy_agent("m-pla-1", "monster", Vector2(245.0, 200.0), 1500, 30)
	world.ysort.add_child(m3["node"])
	world.live_agents = [m3]
	world.perform_combat_attack(1, 1.0, "A1")
	expect(world.dodge_invuln_t > 0.30 and float(world.hero_buffs.get("dodge_empower_t", 0.0)) > 3.0, "Planetary A1 Szybki Unik activates dodge i-frames + empower")
	world.perform_combat_attack(2, 1.0, "B1")
	expect(float(m3.get("slow_t", 0.0)) > 2.0 and world.delayed_seals.size() >= 1, "Planetary B1+B5 slows target and queues 2nd shockwave")
	expect(bool((m3["node"] as ActorView).status_flags.get("slow", false)), "ActorView status_flags records slow dot cleanly")
	hud.hero_hp = 50.0
	world.perform_combat_attack(3, 1.0, "C1")
	world.step_world(0.5)
	expect(float(hud.hero_hp) > 51.0, "Planetary C1 HoT heals smoothly over time")
	expect(hud.hero_res_label.find("Las") >= 0, "Planetary B2 Terrain Adaptation shows Forest bonus on Verdantia")
	world.current_land = "pyra"
	world.step_world(0.05)
	expect(hud.hero_res_label.find("Skała") >= 0, "Planetary B2 Terrain Adaptation switches to Rock bonus on Pyra")

	# ==========================================================================
	# 7. SAGE (B2 LIGHT CIRCLE, A1 SEAL SAFE EVEN IF TARGET DIES, B9 TEMPLE, C9 FREE KI)
	# ==========================================================================
	world.current_land = "aether"
	hud.hero_land = "aether"
	hud.set_region("aether")
	_unlock_nodes(hud, ["A1", "A4", "A5", "A7", "A8", "A9", "B1", "B2", "B3", "B4", "B6", "B9", "C1", "C4", "C6", "C7", "C9", "T"])
	world._clear_transient_combat_state()
	var m4 := _make_dummy_agent("m-sag-1", "monster", Vector2(260.0, 200.0), 800, 30)
	world.ysort.add_child(m4["node"])
	world.live_agents = [m4]
	world.perform_combat_attack(0, 1.0, "R")
	expect(world.active_circles.size() >= 1, "Sage B2 spawns ground Light Circle")
	world.perform_combat_attack(1, 1.0, "A1")
	expect(world.delayed_seals.size() == 1 and float(m4.get("seal_t", 0.0)) > 2.0, "Sage A1 places 3s delayed Energy Seal")
	expect(bool((m4["node"] as ActorView).status_flags.get("seal", false)), "ActorView status_flags records seal dot cleanly")
	# Kill target BEFORE 3s seal detonates -> must NOT crash!
	m4["alive"] = false
	m4["cur_hp"] = 0
	world.step_world(3.2)
	expect(world.delayed_seals.is_empty(), "Sage A1 delayed seal detonates cleanly without crashing when target dies early")
	world.perform_combat_attack(2, 1.0, "B9")
	expect(world._hero_circle_def_bonus() >= 0.29, "Sage B9 Temple grants +30% DEF circle")
	world.perform_combat_attack(3, 1.0, "C9")
	expect(world.is_free_ki_active(), "Sage C9 Enlightenment makes skills free")

	# ==========================================================================
	# 8. 5 NEW COMBAT VFX + WILDLIFE ANIMAL SPRINT-FLEE
	# ==========================================================================
	world.combat_vfx.effects.clear()
	world.combat_vfx.spawn_beam(Vector2.ZERO, Vector2(120, 0), "android", 26.0, 0.5)
	world.combat_vfx.spawn_light_circle(Vector2.ZERO, 90.0, "sage", 3.0, "temple")
	world.combat_vfx.spawn_dash_afterimage(Vector2.ZERO, Vector2(60, 0), "planetary")
	world.combat_vfx.spawn_target_reticle(Vector2(100, 0), "android", 1.2)
	world.combat_vfx.spawn_channel_ring(Vector2.ZERO, "legend", 1.5)
	expect(world.combat_vfx.effects.size() == 5, "all 5 new procedural VFX spawn cleanly")

	var deer := _make_dummy_agent("anim-deer-1", "animal", Vector2(240.0, 200.0), 500, 0)
	world.ysort.add_child(deer["node"])
	world.live_agents = [deer]
	var pre_deer_d := world.hero_pos.distance_to(deer["pos"] as Vector2)
	world._apply_damage_to_agent(0, 20, false, "legend", 0.0)
	expect(float(deer.get("flee_t", 0.0)) > 3.0, "wounded wildlife animal triggers flee timer")
	world.step_world(0.35)
	expect(world.hero_pos.distance_to(deer["pos"] as Vector2) > pre_deer_d + 2.0, "wounded wildlife animal sprints away from hero")

	# ==========================================================================
	# 9. LABYRINTH FULL SKILL BAR + DODGE + SKILL EXECUTION
	# ==========================================================================
	lab.enter_labyrinth("pyra", {
		"id": "lab-test",
		"title": "Test Labirynt",
		"level": 5,
		"spawn": [1, 1],
		"grid": ["#####", "#...#", "#...#", "#...#", "#####"],
		"chests": [],
		"guardians": [{"id": "g1", "name": "Strażnik", "tx": 2, "ty": 1, "hp": 600, "atk": 40, "level": 5}],
	})
	expect(lab.skill_btns.size() == 4, "Labyrinth has 4 assignable skill buttons")
	lab.perform_labyrinth_dodge(false)
	expect(lab.dodge_invuln_t > 0.25, "Labyrinth dodge activates i-frames")
	var g_hp_before := int(lab.guardians[0]["cur_hp"])
	lab.perform_labyrinth_skill(1, "A1")
	expect(int(lab.guardians[0]["cur_hp"]) < g_hp_before, "Labyrinth skill [1] damages guardian")

	print("STAGE3_AUDIT checks=%d failures=%d" % [checks, failures])
	world.free()
	quit(0 if failures == 0 else 1)
