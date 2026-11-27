extends SceneTree
## Automated Stage 4 Full MMORPG Content Parity Test Suite:
## 1) 41-Monster AI hydration, elemental weakness multiplier, telegraphs, hazards, debuffs (healBlock) & 8 multi-phase continent bosses
## 2) 14 dynamic road World Events & 102 playable multi-step canonical quests + HUD Quest Tracker + faction reputation
## 3) v3 Catalog (455 items, 265 recipes, 15 V2 sets, 24 heritage weapons, 9 enhance tiers), 3-Tab Smithy, +1..+9 stats & glow, Dojo trials
## 4) 6 procedural Archipelago Islands (island-1..6) walkable terrain, harbor, NPC, monsters, treasure, gatherables & free return
## 5) Rebalanced XP curve (Lv.1->2 = 180 XP)

const ActorView := preload("res://scripts/actor_view.gd")
const CombatVfx := preload("res://scripts/combat_vfx.gd")
const Hud := preload("res://scripts/rpg_hud.gd")
const BossAi := preload("res://scripts/boss_ai_iso.gd")
const WorldEvents := preload("res://scripts/world_events_iso.gd")
const QuestEngine := preload("res://scripts/quest_engine_iso.gd")
const GmPanel := preload("res://scripts/gm_panel.gd")
const InteriorRoom := preload("res://scripts/interior_room.gd")
const AtlasOverlay := preload("res://scripts/atlas_overlay.gd")

class TestWorld extends "res://scripts/world.gd":
	func _ready() -> void:
		set_process(false)
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
				btn_talk_npc, btn_open_treasure, btn_gather, btn_event_interact, combat_toast_lbl, stick_layer]:
			add_child(node)
		combat_vfx = CombatVfx.new()
		ysort.add_child(combat_vfx)
		load_databases()

	func layout_minimap() -> void:
		pass

	func sync_hero(_force_scan: bool = false) -> void:
		if hero != null:
			hero.position = iso(hero_pos.x, hero_pos.y, height_at(hero_pos.x, hero_pos.y))

var checks := 0
var failures := 0

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: " + label)

func _initialize() -> void:
	var world := TestWorld.new()
	root.add_child.call_deferred(world)
	run.call_deferred(world)

func run(world: TestWorld) -> void:
	var hud := Hud.new()
	hud.world = world
	world.rpg_hud = hud
	world.hud.add_child(hud)

	var interior := InteriorRoom.new()
	interior.world = world
	world.interior_room = interior
	world.hud.add_child(interior)

	var hero_av := ActorView.new()
	var actors_parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/actors.json"))
	var pyra_def: Dictionary = (actors_parsed as Dictionary).get("pyra.hero", {}) if actors_parsed is Dictionary else {}
	hero_av.setup(pyra_def, "Ignis", false, true, "hero")
	world.hero = hero_av
	world.ysort.add_child(hero_av)

	world.hero_race_land = "pyra"
	hud.hero_land = "pyra"
	hud.current_land = "pyra"
	hud.hero_level = 20
	hud.hero_gold = 5000
	hud.set_region("pyra")

	# ==========================================================================
	# 1. REBALANCED XP CURVE & V3 CATALOG (455 ITEMS / 265 RECIPES / 15 SETS / 24 HERITAGE / 9 ENHANCE)
	# ==========================================================================
	expect(is_equal_approx(hud.xp_needed_for_level(1), 180.0), "Lv.1->2 XP needed is 180")
	expect(is_equal_approx(hud.xp_needed_for_level(2), 300.0), "Lv.2->3 XP needed is 300")
	expect(hud.xp_needed_for_level(25) > hud.xp_needed_for_level(20), "XP curve scales smoothly past Lv.20")

	var cat: Array[Dictionary] = GmPanel.get_catalog()
	var recs: Array[Dictionary] = GmPanel.get_recipes()
	var eq_sets: Dictionary = GmPanel.get_equipment_sets()
	var leg_heritage: Array[Dictionary] = GmPanel.get_heritage_weapons("legend")
	var enh0: Dictionary = GmPanel.get_enhance_tier(0)
	expect(cat.size() >= 450, "v3 catalog loaded >=450 items (got %d)" % cat.size())
	expect(recs.size() >= 260, "v3 catalog loaded >=260 crafting recipes (got %d)" % recs.size())
	expect(eq_sets.size() >= 15, "v3 catalog loaded >=15 equipment sets (got %d)" % eq_sets.size())
	expect(leg_heritage.size() == 6, "heritage weapons has 6 stages for legend (got %d)" % leg_heritage.size())
	expect(int(enh0.get("nextTier", 0)) == 1 and int(enh0.get("gold", 0)) > 0, "enhance tier 0->1 spec valid")

	# ==========================================================================
	# 2. +1..+9 ENHANCEMENT BOOSTS STATS + WEAPON GLOW TIER + V2 SET BONUS
	# ==========================================================================
	var starter_wep := GmPanel.find_item("weapon_recruit_sword")
	expect(not starter_wep.is_empty(), "starter weapon_recruit_sword found in catalog")
	starter_wep["side"] = -1
	starter_wep["row"] = 2
	hud.equip_slots[2] = starter_wep
	hud.equip_upgrades.clear()
	hud.recalc_stats(false)
	var base_atk := hud.get_total_attack()
	expect(world.hero.weapon_glow_tier == 0, "weapon glow tier 0 at +0")
	hud.equip_upgrades["2"] = 6
	hud.recalc_stats(false)
	expect(hud.get_total_attack() > base_atk, "+6 weapon enhancement raises total ATK (%d -> %d)" % [base_atk, hud.get_total_attack()])
	expect(world.hero.weapon_glow_tier == 2, "weapon glow tier 2 at +6")
	hud.equip_upgrades["2"] = 9
	hud.recalc_stats(false)
	expect(world.hero.weapon_glow_tier == 3, "weapon glow tier 3 at +9")

	# Verify 3-Tab Smithy & Dojo Master Trials UI build cleanly without errors
	interior.enter_building("pyra", {"id": "pyra-smithy", "role": "smithy", "title": "Kuźnia Popiołu"})
	interior.toggle_service_panel(true)
	expect(interior.service_vbox.get_child_count() >= 4, "Smithy Crafting tab populated")
	interior.smithy_tab = "enhance"
	interior._refresh_service_ui()
	expect(interior.service_vbox.get_child_count() >= 5, "Smithy Enhance +1..+9 tab populated")
	interior.smithy_tab = "heritage"
	interior._refresh_service_ui()
	expect(interior.service_vbox.get_child_count() >= 6, "Smithy Heritage I..VI tab populated")
	interior.toggle_service_panel(false)

	# Verify Dojo Master Trial local completion
	interior.enter_building("pyra", {"id": "pyra-arena", "role": "arena", "title": "Arena Popiołu"})
	interior.toggle_service_panel(true)
	interior._start_dojo_trial(hud, "dojo_dodge", "Próba I: Krok Poza Strefę", "Próba Dojo", "spd")
	for _s in 3:
		interior.drill_phase = 0.5
		interior._trigger_drill_strike(hud)
	expect(bool(hud.dojo_trials.get("dojo_dodge", false)), "Dojo Master Trial dojo_dodge completed via rhythm drill")
	interior.toggle_service_panel(false)

	# ==========================================================================
	# 3. 41-MONSTER AI, ELEMENTAL WEAKNESS, DEBUFFS (HEALBLOCK) & 8 CONTINENT BOSSES
	# ==========================================================================
	expect(world.boss_ai != null, "boss_ai_iso initialized on world")
	expect(world.boss_ai.bosses_db.size() == 8, "all 8 continent bosses loaded (got %d)" % world.boss_ai.bosses_db.size())
	var fire_vs_pyra_weak := {"weak": {"fire": 1.35, "water": 0.65}}
	var el_fire: Array[String] = ["fire"]
	var el_water: Array[String] = ["water"]
	var mult_weak: Dictionary = world.boss_ai.compute_element_modifier(fire_vs_pyra_weak, el_fire)
	expect(float(mult_weak.get("mult", 1.0)) > 1.20 and str(mult_weak.get("tag", "")) == "SŁABOŚĆ!", "elemental weakness grants >1.20x + SŁABOŚĆ! tag")
	var mult_res: Dictionary = world.boss_ai.compute_element_modifier(fire_vs_pyra_weak, el_water)
	expect(float(mult_res.get("mult", 1.0)) < 0.85, "elemental resistance reduces damage <0.85x")

	# Debuff system & healBlock blocks HP potion
	world.boss_ai.apply_hero_debuff("healBlock", 5.0, 0.0)
	expect(world.boss_ai.is_hero_healing_blocked(), "healBlock debuff active")
	hud.hero_hp = 50.0
	var hp_pot := GmPanel.find_item("pot_hp")
	hud.backpack_items[0] = hp_pot.duplicate(true)
	hud.backpack_items[0]["qty"] = 2
	hud.use_backpack_slot(0)
	expect(is_equal_approx(float(hud.hero_hp), 50.0), "HP potion blocked while healBlock debuff is active")
	world.boss_ai.clear_transient()

	# Spawn bosses for each continent (2 per continent = 8 total)
	var total_bosses := 0
	for cont: String in ["verdant", "aether", "nexus", "pyra"]:
		world.current_land = cont
		world.heights = PackedFloat32Array()
		world.grid_size = 64
		world.world_size = 4096.0
		world.heights.resize(64 * 64)
		world.heights.fill(5.0)
		world.live_agents.clear()
		world.boss_ai.clear_transient()
		world.boss_ai.spawn_region_bosses(cont)
		var c_bosses := 0
		for ag: Dictionary in world.live_agents:
			if bool(ag.get("is_boss", false)):
				c_bosses += 1
				expect(bool((ag["node"] as ActorView).is_boss), "boss ActorView has is_boss=true on " + cont)
		expect(c_bosses == 2, "2 bosses spawned on %s (got %d)" % [cont, c_bosses])
		total_bosses += c_bosses
	expect(total_bosses == 8, "total 8 bosses spawned across 4 continents")

	# Test Phase transition & Epic Boss HUD data on Pyra boss
	var test_boss: Dictionary = world.live_agents[0]
	world.hero_pos = (test_boss["pos"] as Vector2) + Vector2(24.0, 0.0)
	var bhud: Dictionary = world.boss_ai.get_active_boss_hud()
	expect(not bhud.is_empty() and int(bhud.get("phase", 0)) == 1, "Epic Boss HUD detects nearby boss in Phase 1")
	test_boss["cur_hp"] = int(round(float(test_boss["max_hp"]) * 0.55))
	var empty_els: Array[String] = []
	world.boss_ai.on_agent_damaged(test_boss, 200, 0.0, empty_els)
	expect(int(test_boss.get("boss_phase", 1)) >= 2, "Boss transitions to Phase 2 below threshold")

	# ==========================================================================
	# 4. 102 PLAYABLE CANONICAL QUESTS + 14 WORLD EVENTS
	# ==========================================================================
	expect(world.quest_engine != null, "quest_engine_iso initialized on world")
	expect(world.quest_engine.playable_quests.size() == 102, "all 102 playable canonical quests loaded (got %d)" % world.quest_engine.playable_quests.size())
	var first_q: Dictionary = world.quest_engine.playable_quests[0]
	var fqid := str(first_q.get("id", ""))
	expect(world.quest_engine.accept_quest(fqid), "accept canonical quest " + fqid)
	var tracker: Array[Dictionary] = world.quest_engine.get_tracker_entries()
	expect(tracker.size() >= 1, "HUD Quest Tracker returns active quest entries")
	expect(world.quest_engine.complete_quest(fqid), "complete canonical quest " + fqid)
	expect(bool(world.quest_engine.completed_quests.get(fqid, false)), "completed quest recorded")

	expect(world.world_events != null, "world_events_iso initialized on world")
	expect(world.world_events.events_catalog.size() == 14, "all 14 road world events loaded (got %d)" % world.world_events.events_catalog.size())
	world.world_events.build_for_region("pyra")
	expect(world.world_events.region_events.size() >= 3, "Pyra built road world events (got %d)" % world.world_events.region_events.size())

	# ==========================================================================
	# 5. 6 PROCEDURAL ARCHIPELAGO ISLANDS (island-1..6) & ATLAS INTEGRATION
	# ==========================================================================
	expect(world.islands_db.size() == 6, "all 6 Archipelago Islands loaded from islands.json")
	world.discovered_islands.clear()
	expect(world.sea_voyage_fee_for("island-1") == 0, "first archipelago voyage is FREE (0g)")
	world.discovered_islands["island-1"] = true
	expect(world.sea_voyage_fee_for("island-1") == 10, "repeat voyage to island-1 costs 10g")
	expect(world.sea_voyage_fee_for("island-6") == 30, "repeat voyage to island-6 costs 30g")

	for isl_i in range(1, 7):
		var iid := "island-%d" % isl_i
		expect(world.is_island_land(iid), iid + " recognized as Archipelago Island")
		world.switch_region(iid)
		expect(world.current_land == iid, iid + " became active land")
		expect(is_equal_approx(world.world_size, 512.0), iid + " world_size is 512.0")
		expect(world.is_walkable(world.hero_pos.x, world.hero_pos.y), iid + " harbor spawn is walkable")
		expect(world.live_agents.size() >= 6, iid + " spawned NPC + monsters (got %d)" % world.live_agents.size())
		expect(world.treasures_data.size() >= 1, iid + " spawned island treasure")
		expect(world.gatherables_data.size() >= 3, iid + " spawned campfire + gatherables")
		print("ISLAND_OK ", iid, " agents=", world.live_agents.size())

	# Verify AtlasOverlay loads all 6 islands and projects island coordinates cleanly
	var atlas := AtlasOverlay.new()
	atlas.world = world
	atlas._load_islands_meta()
	expect(atlas.islands_meta.size() == 6, "AtlasOverlay loaded all 6 Archipelago Islands")
	var isl1_ap: Vector2 = atlas.world_to_atlas("island-1", 256.0, 356.0, 512.0)
	expect(isl1_ap.x > 1000.0 and isl1_ap.y < 200.0, "AtlasOverlay projects island-1 coords cleanly")
	atlas.free()

	print("AUDIT_STAGE4_SUMMARY checks=%d failures=%d" % [checks, failures])
	quit(0 if failures == 0 else 1)
