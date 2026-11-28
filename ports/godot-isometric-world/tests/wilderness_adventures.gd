extends SceneTree

class FixtureHud extends Control:
	var hero_level := 8
	var hero_gold := 0

	func _refresh_visuals() -> void:
		pass

class FixtureWorld extends "res://scripts/world.gd":
	func _ready() -> void:
		set_process(false)
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
				btn_talk_npc, btn_open_treasure, btn_gather, btn_event_interact, combat_toast_lbl, stick_layer]:
			add_child(node)
		rpg_hud = FixtureHud.new()
		hud.add_child(rpg_hud)
		dialogue_strip = DialogueStripScript.new()
		dialogue_strip.world = self
		hud.add_child(dialogue_strip)
		load_databases()

	func sync_hero(_force_scan: bool = false) -> void:
		pass

	func layout_minimap() -> void:
		pass

var checks := 0
var failures := 0

func expect(condition: bool, message: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: " + message)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var world := FixtureWorld.new()
	root.add_child(world)
	var engine = world.quest_engine
	var quests: Array = engine.playable_quests.filter(func(q: Dictionary) -> bool: return q.get("frontier", false))
	expect(quests.size() == 8, "All eight authored adventures load beside the original catalog")
	for land: String in ["pyra", "verdant", "aether", "nexus"]:
		world.current_land = land
		world.load_terrain(land)
		var nav := AStarGrid2D.new()
		nav.region = Rect2i(0, 0, world.grid_size, world.grid_size)
		nav.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
		nav.update()
		for z in world.grid_size:
			for x in world.grid_size:
				if world.walkable[z * world.grid_size + x] == 0:
					nav.set_point_solid(Vector2i(x, z))
		for quest: Dictionary in quests:
			if quest.continent == land:
				verify_adventure(world, nav, quest)
	world.free()
	print("Wilderness adventures — %d/%d checks passed" % [checks - failures, checks])
	quit(1 if failures else 0)

func verify_adventure(world: FixtureWorld, nav: AStarGrid2D, quest: Dictionary) -> void:
	var engine = world.quest_engine
	var ident: String = quest.id
	var land: String = quest.continent
	var npc := row_for(world.npcs_data, quest.giverNpcId)
	var marker := row_for(world.buildings, ident)
	var cache := row_for(world.treasures_data, ident + "-cache")
	expect(not npc.is_empty() and not marker.is_empty() and not cache.is_empty(), ident + " has a scout, landmark and cache")
	if npc.is_empty() or marker.is_empty() or cache.is_empty():
		return

	for row: Dictionary in [npc, marker, cache]:
		var pos := Vector2(row.x, row.z)
		# A landmark occupies its centre. Approach the margin where the quest will trigger.
		if row == marker:
			pos = point_from_nearby_walkable(world, pos)
		expect(world.is_walkable(pos.x, pos.y), ident + " has clear approach")
		expect(pos.distance_to(world.capital_center) > world.safe_city_radius + 200.0, ident + " sits outside the safe city")
		expect(not nav.get_id_path(to_grid(world, world.capital_center), to_grid(world, pos)).is_empty(),
			ident + " reachable from the capital")
	var guards: Array = world.monsters_data.filter(func(enemy: Dictionary) -> bool:
		return str(enemy.id).begins_with(ident + "-guard-"))
	expect(not guards.is_empty(), ident + " has an encounter")
	for guard: Dictionary in guards:
		var home := Vector2(guard.x, guard.z)
		expect(world.is_walkable(home.x, home.y), ident + " spawns on dry terrain")
		expect(home.distance_to(Vector2(npc.x, npc.z)) >= 170.0, ident + " leaves room to talk to the scout")

	world.rpg_hud.hero_level = int(quest.recommendedLevel) - 1
	expect(not engine.accept_quest(ident), ident + " enforces the stated level")
	world.rpg_hud.hero_level += 1
	expect(engine.marker_for_npc(npc.id, npc.name, land) == "!", ident + " is discoverable at its NPC")
	expect(not engine.npc_matches_canonical(npc.id, npc.actor_id, npc.name), ident + " binds by unique NPC id")
	expect(engine.dialogues_by_npc.has(npc.id), ident + " loads authored dialogue")
	var dialogue: Dictionary = engine.dialogues_by_npc[npc.id]
	world.open_npc_dialogue(npc)
	expect(world.dialogue_strip.full_text == dialogue.greetings[0], ident + " shows the scout's own story")
	world.dialogue_strip.close_dialogue()
	# Some players discover the supply cache before accepting the commission.
	if ident.ends_with("listonoszka"):
		expect(world.claim_treasure_reward(cache), ident + " allows early discovery")
	expect(engine.accept_quest(ident), ident + " can be accepted")
	for stage: Dictionary in quest.stages:
		for objective: Dictionary in stage.objectives:
			match str(objective.type):
				"visit", "discover":
					var pos := Vector2(objective.coordinates.x, objective.coordinates.y)
					var target := point_from_nearby_walkable(world, pos)
					engine.on_hero_position(world.capital_center, land)
					var progress: Dictionary = engine.active_quests[ident].counts
					expect(not progress.has(objective.id), ident + " does not auto-discover from city")
					engine.on_hero_position(target, land)
				"combat":
					engine.on_monster_killed(objective.targetId, land, "different-spawn")
					expect(not engine.active_quests[ident].counts.has(objective.id), ident + " ignores same species elsewhere")
					engine.on_monster_killed(objective.targetId, land, objective.targetSpawnId)
				"retrieve":
					if not world.is_treasure_opened(cache.id):
						expect(not engine.is_quest_ready_to_turn_in(ident), ident + " requires the cache")
						expect(world.claim_treasure_reward(cache), ident + " can recover the cache")
					engine.on_hero_position(Vector2(cache.x, cache.z), land)
	expect(engine.is_quest_ready_to_turn_in(ident), ident + " advances every authored objective")
	expect(engine.marker_for_npc(npc.id, npc.name, land) == "?", ident + " points back to the quest giver")
	var old_gold: int = world.rpg_hud.hero_gold
	world.open_npc_dialogue(npc)
	for control: Node in world.dialogue_strip.choices_vbox.get_children():
		if control is Button and control.text.begins_with("? ODBIERZ"):
			control.pressed.emit()
			break
	expect(engine.completed_quests.has(ident), ident + " can turn in through dialogue")
	expect(world.dialogue_strip.full_text == dialogue.quests[ident].after, ident + " shows its ending")
	world.dialogue_strip.close_dialogue()
	expect(world.rpg_hud.hero_gold == old_gold + int(quest.reward.coins), ident + " grants configured reward")
	expect(not engine.complete_quest(ident) and not engine.accept_quest(ident), ident + " pays only once")

func to_grid(world: FixtureWorld, pos: Vector2) -> Vector2i:
	return Vector2i((pos / world.world_size * float(world.grid_size - 1)).round())

func point_from_nearby_walkable(world: FixtureWorld, pos: Vector2) -> Vector2:
	if world.is_walkable(pos.x, pos.y):
		return pos
	for i in range(8):
		var point := pos + Vector2.from_angle(i * TAU / 8.0) * 30.0
		if world.is_walkable(point.x, point.y):
			return point
	return pos

func row_for(rows: Array, id: String) -> Dictionary:
	for row: Dictionary in rows:
		if row.get("id", "") == id:
			return row
	return {}
