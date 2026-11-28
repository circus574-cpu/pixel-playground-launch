extends SceneTree

class EventIndex extends "res://scripts/world_events_iso.gd":
	func _spawn_event_beacon(_pos: Vector2, _title: String, _prop_kind: String) -> Node2D:
		return Node2D.new()

class ExportWorld extends "res://scripts/world.gd":
	func _init() -> void:
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
				btn_talk_npc, btn_open_treasure, btn_gather, btn_event_interact, combat_toast_lbl, stick_layer]:
			add_child(node)

func _initialize() -> void:
	var world := ExportWorld.new()
	var boss_ai := preload("res://scripts/boss_ai_iso.gd").new()
	boss_ai.load_bosses()
	var atlas := preload("res://scripts/atlas_overlay.gd").new()
	for button: Button in [atlas.btn_back, atlas.btn_teleport, atlas.btn_globe, atlas.btn_atlas,
			atlas.btn_zoom_in, atlas.btn_zoom_out, atlas.btn_center]:
		atlas.add_child(button)
	var engine := preload("res://scripts/quest_engine_iso.gd").new()
	engine.setup(world)
	var events := EventIndex.new()
	events.setup(world)
	var regions := {}
	for land: String in ["pyra", "verdant", "aether", "nexus"]:
		world.load_terrain(land)
		events.build_for_region(land)
		var region := {"events": {}, "objectives": {}, "givers": {}, "talk": {}, "planetBosses": {}}
		for boss: Dictionary in boss_ai.bosses_db:
			if boss.continent == land:
				var pin: Vector2 = atlas.world_to_atlas(land, boss.arenaPos[0], boss.arenaPos[1], world.world_size)
				region.planetBosses[boss.id] = [pin.x, pin.y]
		for event: Dictionary in events.region_events:
			var p: Vector2 = event.pos
			region.events[event.id] = {"position": [p.x, p.y], "spawn": event.mech.get("monster", ""), "count": event.mech.get("count", 0)}
			event.beacon_node.free()
		events.region_events.clear()
		for q: Dictionary in engine.playable_quests:
			if str(q.get("continent", "")) == land:
				region.givers[q.id] = find_npcs(engine, world.npcs_data, str(q.get("giverNpcId", "")))
			for stage: Dictionary in q.get("stages", []):
				for objective: Dictionary in stage.get("objectives", []):
					var objective_land := str(objective.get("continent", ""))
					if not objective_land.is_empty() and objective_land != land:
						continue
					match str(objective.get("type", "")):
						"visit", "discover":
							var point: Vector2 = engine._resolve_objective_world_pos(objective, land)
							region.objectives[objective.id] = [point.x, point.y]
						"retrieve":
							for treasure: Dictionary in world.treasures_data:
								if treasure.get("id") == objective.get("targetId"):
									region.objectives[objective.id] = [treasure.x, treasure.z]
									break
						"talk", "deliver":
							var target := str(objective.get("targetId", ""))
							region.talk[objective.id] = find_npcs(engine, world.npcs_data, target)
		regions[land] = region
	atlas.free()
	world.free()
	var out := FileAccess.open(OS.get_cmdline_user_args()[0], FileAccess.WRITE)
	out.store_string(JSON.stringify(regions))
	quit()

func find_npcs(engine: RefCounted, npcs: Array, target: String) -> Array:
	var indexes := []
	for i: int in range(npcs.size()):
		var npc: Dictionary = npcs[i]
		if engine.npc_matches_canonical(target, str(npc.get("quest_npc_id", npc.get("actor_id", ""))), str(npc.get("name", ""))):
			indexes.append(i)
	return indexes
