extends SceneTree
## Automated QA Suite for GameMaster 3D Character Integration, Flight, Obstacle Bypass,
## Acceleration Skill (3.5x), Celestial VFX, Towering Scale & Remote Peer Sync.

const WorldScript := preload("res://scripts/world.gd")
const ActorScript := preload("res://scripts/actor_view.gd")
const LivePeersScript := preload("res://scripts/live_peers.gd")

var passed := 0
var failed := 0

func _check(cond: bool, msg: String) -> void:
	if cond:
		passed += 1
		print("PASS: ", msg)
	else:
		failed += 1
		printerr("FAIL: ", msg)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	# 1. Verify actors.json has gm.hero with all 8 rendered clips, valid WebP sheets, and towering scale > regular hero
	var raw: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/actors.json"))
	_check(raw is Dictionary, "actors.json parses as Dictionary")
	var actors_db: Dictionary = raw as Dictionary
	_check(actors_db.has("gm.hero"), "actors.json contains gm.hero entry")
	var gm_def: Dictionary = actors_db.get("gm.hero", {})
	var reg_def: Dictionary = actors_db.get("pyra.hero", {})
	var gm_sz: Array = gm_def.get("size", [0, 0])
	var reg_sz: Array = reg_def.get("size", [133, 133])
	_check(float(gm_sz[0]) >= float(reg_sz[0]) * 1.5, "GameMaster size (%s) is >= 1.5x larger than regular hero (%s)" % [str(gm_sz), str(reg_sz)])

	var gm_clips: Dictionary = gm_def.get("clips", {})
	for clip_k in ["idle", "walk", "takeoff", "hover", "glide", "land", "heavy_strike", "ki_blast"]:
		_check(gm_clips.has(clip_k), "gm.hero has clip '%s'" % clip_k)
		if gm_clips.has(clip_k):
			var sp := str((gm_clips[clip_k] as Dictionary).get("sheet", ""))
			_check(FileAccess.file_exists(sp), "gm.hero sheet exists: %s" % sp)
			var dirs: Dictionary = (gm_clips[clip_k] as Dictionary).get("directions", {})
			_check(dirs.size() == 8, "gm.hero clip '%s' has all 8 directions" % clip_k)

	# 2. Boot real World instance on pyra with GM access toggled off vs on
	var world := WorldScript.new()
	world.start_land = "pyra"
	world.hero_race_land = "pyra"
	world.start_name = "TestGM"
	var gm_state := {"allow": false}
	world.gm_access_fn = func() -> bool: return bool(gm_state["allow"])
	root.add_child(world)
	for _i in 6:
		await process_frame

	# 2a. Non-staff cannot activate GM Form, Flight, or Boost
	_check(not world.can_use_gm(), "Regular player has can_use_gm() == false")
	_check(not world.toggle_gm_form(true), "Regular player cannot enable GM Form")
	_check(not world.toggle_gm_flight(true), "Regular player cannot enable GM Flight")
	_check(not world.toggle_gm_boost(true), "Regular player cannot enable GM Boost")
	_check(not bool(world.gm_form_active) and not bool(world.gm_flying) and not bool(world.gm_boost_active), "Regular player GM flags stay false")

	# Verify regular hero display height before GM transform
	var reg_disp_y: float = float(world.hero.display.y)
	_check(reg_disp_y > 100.0, "Regular hero initialized (display.y=%.1f)" % reg_disp_y)

	# 2b. Grant staff access and verify HUD exposes only gm_form and gm_boost before transformation
	gm_state["allow"] = true
	world._refresh_gm_access()
	world.rpg_hud._refresh_visuals()
	await process_frame
	await process_frame
	_check(world.can_use_gm(), "Staff account has can_use_gm() == true")
	var hud_ids: Array[String] = []
	for hb: Dictionary in world.rpg_hud.util_hitboxes:
		hud_ids.append(str(hb.get("id", "")))
	_check("gm_form" in hud_ids, "HUD draws FORMA GM hitbox for staff")
	_check("gm_fly" not in hud_ids, "HUD hides LOT [L] before transformation")
	_check("gm_boost" in hud_ids, "HUD draws TURBO [U] hitbox for staff")

	# 2c. Activate GM Form and verify towering scale + celestial nameplate + GM clips
	_check(world.toggle_gm_form(true), "Staff can activate GameMaster Form")
	_check(bool(world.gm_form_active), "gm_form_active is true")
	await process_frame
	await process_frame
	var flight_visible := false
	for hb: Dictionary in world.rpg_hud.util_hitboxes:
		if hb.get("id") == "gm_fly":
			flight_visible = true
	_check(flight_visible, "HUD draws LOT [L] after transformation")
	_check(bool(world.hero.is_gm_avatar), "hero.is_gm_avatar is true")
	_check(float(world.hero.display.y) >= reg_disp_y * 1.5, "GameMaster avatar display.y (%.1f) is >= 1.5x regular hero (%.1f)" % [float(world.hero.display.y), reg_disp_y])
	_check(world.hero.label.text.begins_with("✦ [GM]"), "GameMaster nameplate shows ✦ [GM] prefix: %s" % world.hero.label.text)

	# 2d. Activate Flight -> lifts smoothly above ground, elevates z_index, bypasses obstacles!
	_check(world.toggle_gm_flight(true), "Staff can activate Flight")
	_check(bool(world.gm_flying) and bool(world.hero.gm_flying), "gm_flying synced to hero actor")
	_check(str(world.hero.one_shot_clip) == "takeoff", "Takeoff animation plays on liftoff")
	for _f in 45:
		world.hero._process(0.03)
	_check(float(world.hero.gm_fly_height) >= ActorScript.GM_FLY_ALTITUDE * 0.9, "GM rises to flight altitude (%.1f px)" % float(world.hero.gm_fly_height))
	_check(world.hero.z_index == 12, "Flying GM renders above buildings/props (z_index=%d)" % world.hero.z_index)
	_check(world.hero.sprite.position.y < world.hero._base_sprite_pos.y - 50.0, "Sprite lifts cleanly above ground shadow")

	# Verify airborne hover & glide animations
	world.hero.one_shot_until = 0.0
	world.hero.animate(Vector2.ZERO, false)
	_check(str(world.hero.state) == "hover", "Airborne stationary plays 'hover'")
	world.hero.animate(Vector2(1.0, 0.3), true)
	_check(str(world.hero.state) == "glide", "Airborne moving plays 'glide'")

	# Verify obstacle bypass while flying (move straight onto an inland unwalkable rock/building/water tile!)
	var blocked_spot := Vector2(-1.0, -1.0)
	for gx in range(200, int(world.world_size) - 200, 16):
		for gz in range(200, int(world.world_size) - 200, 16):
			if not world.is_walkable(float(gx), float(gz)):
				blocked_spot = Vector2(float(gx), float(gz))
				break
		if blocked_spot.x > 0.0:
			break
	_check(blocked_spot.x > 0.0, "Found an unwalkable obstacle/water tile at %s" % str(blocked_spot))
	world.hero_pos = blocked_spot - Vector2(4.0, 0.0)
	world.try_move(Vector2(4.0, 0.0))
	_check(world.hero_pos.distance_to(blocked_spot) < 0.5, "Flying GM flies straight over obstacle tile (pos=%s)" % str(world.hero_pos))

	# Verify Acceleration / Boost skill (3.5x) & VFX
	_check(world.toggle_gm_boost(true), "Staff can activate Acceleration Boost (3.5x)")
	_check(bool(world.gm_boost_active) and bool(world.hero.gm_boost), "gm_boost_active synced to hero actor")
	var snap: Dictionary = world._live_snapshot()
	_check(bool(snap.get("gm", false)) and bool(snap.get("fly", false)) and bool(snap.get("boost", false)), "Live snapshot publishes gm/fly/boost flags")

	# Verify GameMaster Combat animations & VFX (heavy_strike + ki_blast)
	world.combat_vfx.effects.clear()
	world.perform_combat_attack(0)
	_check(str(world.hero.one_shot_clip) == "heavy_strike", "GM basic attack plays heavy_strike")
	_check(world.combat_vfx.effects.size() >= 2, "GM heavy_strike spawns multi-layer celestial VFX (%d)" % world.combat_vfx.effects.size())
	world.combat_vfx.effects.clear()
	world.perform_combat_attack(1, 1.0, "A1")
	_check(str(world.hero.one_shot_clip) == "ki_blast", "GM skill attack plays ki_blast")
	_check(world.combat_vfx.effects.size() >= 2, "GM ki_blast spawns beam + burst VFX (%d)" % world.combat_vfx.effects.size())

	# Verify Landing safely finds walkable ground when hovering over an obstacle!
	_check(not world.is_walkable(world.hero_pos.x, world.hero_pos.y), "Still hovering directly over unwalkable obstacle before landing")
	_check(not world.toggle_gm_flight(false), "Landing disables gm_flying")
	_check(world.is_walkable(world.hero_pos.x, world.hero_pos.y), "Safe landing moves GM onto nearest walkable tile (%s)" % str(world.hero_pos))
	for _f2 in 45:
		world.hero._process(0.03)
	_check(float(world.hero.gm_fly_height) <= 0.5 and world.hero.z_index == 0, "Landed GM returns to altitude 0 and z_index 0")

	# 3. Verify Remote Online Peer renders as Giant Flying GameMaster via LivePeers
	var lp := LivePeersScript.new()
	lp.world = world
	world.add_child(lp)
	lp.accept({
		"land": "pyra",
		"peers": [{
			"id": "p_gm",
			"nick": "ArcyMistrz",
			"name": "Władca Ki",
			"race": "legend",
			"level": 40,
			"x": world.hero_pos.x + 14.0,
			"y": world.hero_pos.y + 8.0,
			"f": 2,
			"pose": "hover",
			"action": 1001,
			"ki": false,
			"gm": true,
			"fly": true,
			"boost": true,
		}]
	})
	_check(lp.actors.has("p_gm"), "Remote GameMaster peer spawned in LivePeers")
	if lp.actors.has("p_gm"):
		var r_actor: Node2D = lp.actors["p_gm"]["actor"]
		_check(bool(r_actor.is_gm_avatar) and bool(r_actor.gm_flying) and bool(r_actor.gm_boost), "Remote GM peer shows gm_avatar, flight & boost")
		_check(float(r_actor.display.y) >= reg_disp_y * 1.5, "Remote GM peer is towering size (%.1f)" % float(r_actor.display.y))
		_check(r_actor.label.text.begins_with("✦ [GM]"), "Remote GM peer has golden ✦ [GM] nameplate")

	# 4. Verify revoking staff access immediately reverts GameMaster Form, Flight & Boost
	gm_state["allow"] = false
	world._refresh_gm_access()
	_check(not bool(world.gm_form_active) and not bool(world.gm_flying) and not bool(world.gm_boost_active), "Revoking staff access cleanly disables GM Form/Flight/Boost")
	_check(not bool(world.hero.is_gm_avatar), "Hero reverts to regular race model on staff revocation")

	# 5. Verify zero invisible ghost walls on Pyra north exit & smooth walking from capital plaza + all 4 continents' roads
	_check(world.is_walkable(2075.0, 1672.0), "Pyra north exit (2075, 1672) has NO invisible wall after walkability sanitization")
	world.hero_pos = Vector2(2075.0, 1740.0)
	for _s in 36:
		world.try_move(Vector2(0.0, -3.0))
	_check(world.hero_pos.y <= 1650.0, "Grounded hero walks smoothly north through Pyra exit without snagging (end_y=%.1f)" % world.hero_pos.y)
	for land_k in ["pyra", "verdant", "aether", "nexus"]:
		world.load_terrain(land_k)
		_check(world.is_walkable(world.capital_center.x, world.capital_center.y), "%s capital_center is walkable" % land_k)
		var blk_road := 0
		var sw: int = world.surface_img.get_width()
		var sh: int = world.surface_img.get_height()
		for gz in range(0, world.grid_size, 4):
			var sz := clampi(int(round(float(gz) / float(world.grid_size - 1) * float(sh - 1))), 0, sh - 1)
			for gx in range(0, world.grid_size, 4):
				var sx := clampi(int(round(float(gx) / float(world.grid_size - 1) * float(sw - 1))), 0, sw - 1)
				if world.surface_img.get_pixel(sx, sz).b > 0.25 and world.walkable[gz * world.grid_size + gx] == 0:
					blk_road += 1
		_check(blk_road == 0, "%s has 0 blocked road tiles (got %d)" % [land_k, blk_road])

	# 6. Verify all 8 bespoke mastered GameMaster MP3 SFX load cleanly & flight wind loop activates/stops
	for sfx_k in ["gm_transform", "gm_takeoff", "gm_land", "gm_boost_on", "gm_boost_off", "gm_flight_loop", "gm_heavy_strike", "gm_ki_blast"]:
		var st: AudioStream = world.audio.load_stream("sfx/gm/%s.mp3" % sfx_k)
		_check(st != null, "GameMaster SFX loads cleanly: %s.mp3" % sfx_k)
	world.audio.set_gm_flight_audio(true, true, true)
	_check(world.audio.gm_flight_target > 0.5 and world.audio.gm_flight_pitch_target > 1.1, "Airborne boost flight wind loop targets elevated gain & pitch")
	world.audio.set_gm_flight_audio(false, false, false)
	_check(world.audio.gm_flight_target <= 0.001, "Landing smoothly fades out airborne flight wind loop")

	# 7. Verify all 40 premium monster archetype MP3s + 8 dungeon soundtrack/SFX MP3s load cleanly
	var arch_list: Array[String] = ["beast", "insect_spider", "serpent_slime", "stone_golem", "fire_dragon", "frost_crystal", "arcane_spirit", "mech_cyber", "plant_druid", "boss_colossus"]
	var mon_loaded := 0
	for arch: String in arch_list:
		for ev: String in ["atk1", "atk2", "roar", "die"]:
			var mst: AudioStream = world.audio.load_stream("sfx/premium_mon/%s_%s.mp3" % [arch, ev])
			if mst != null:
				mon_loaded += 1
	_check(mon_loaded == 40, "All 40 studio-mastered monster archetype MP3s load cleanly (%d/40)" % mon_loaded)
	var dun_loaded := 0
	for dk: String in ["lab_pyra", "lab_verdant", "lab_aether", "lab_nexus", "chest_open", "portal_enter", "dungeon_step", "guardian_alert"]:
		var dst: AudioStream = world.audio.load_stream("sfx/premium_dun/%s.mp3" % dk)
		if dst != null:
			dun_loaded += 1
	_check(dun_loaded == 8, "All 8 dungeon soundtrack & SFX MP3s load cleanly (%d/8)" % dun_loaded)

	# 8. Verify AAA Labyrinth loads real 3D Hero Actor, real Biome Guardian Actors, textured walls/floors, and dungeon audio
	world.load_terrain("verdant")
	_check(world.labyrinths_data.size() >= 1, "Verdantia has real labyrinth definitions (%d)" % world.labyrinths_data.size())
	if world.labyrinths_data.size() >= 1:
		world.labyrinth_room.enter_labyrinth("verdant", world.labyrinths_data[0])
		await process_frame
		_check(world.labyrinth_room.hero_actor != null and is_instance_valid(world.labyrinth_room.hero_actor), "AAA Labyrinth spawns real animated 3D Hero Actor")
		_check(world.labyrinth_room.guardians.size() >= 2, "AAA Labyrinth spawns biome monster guardians (%d)" % world.labyrinth_room.guardians.size())
		var actors_ok := 0
		for g: Dictionary in world.labyrinth_room.guardians:
			if g.get("node") != null and is_instance_valid(g["node"]):
				actors_ok += 1
		_check(actors_ok == world.labyrinth_room.guardians.size(), "Every labyrinth guardian has a real animated IsoWorldActor (%d/%d)" % [actors_ok, world.labyrinth_room.guardians.size()])
		_check(world.labyrinth_room._floor_tex_a != null and world.labyrinth_room._wall_tex != null, "AAA Labyrinth loaded biome floor & stone wall textures")
		_check(world.labyrinth_room.braziers.size() >= 2, "AAA Labyrinth placed flickering torch braziers (%d)" % world.labyrinth_room.braziers.size())
		world.labyrinth_room.on_exit_labyrinth()

	print("GAMEMASTER_AUDIT_SUMMARY passed=%d failed=%d" % [passed, failed])
	quit(0 if failed == 0 else 1)
