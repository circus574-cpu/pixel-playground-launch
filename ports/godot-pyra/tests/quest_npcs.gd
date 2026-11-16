extends SceneTree
## Every quest giver of the four races stands in the world: for each town of each quest land the street NPCs carry the names of the quest characters
## bound to the guide and hunter roles, and the service NPCs of the town show the quest character's name (not the capital's).
## godot --headless --path ports/godot-pyra --script res://tests/quest_npcs.gd
var game: PyraGame
var failures := 0
var checks := 0

func verify(ok: bool, text: String) -> void:
	checks += 1
	if not ok:
		failures += 1
		print("FAIL ", text)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	root.size = Vector2i(1280, 720)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	for i in 5:
		await process_frame
	landing.start_city()
	var deadline := Time.get_ticks_msec() + 20000
	while is_instance_valid(landing) and Time.get_ticks_msec() < deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	for i in 10:
		await process_frame
	var towns := 0
	for land_id: String in ["pyra", "verdant", "aether", "nexus"]:
		game.set_race({"pyra": "legend", "verdant": "planetary", "aether": "sage", "nexus": "android"}[land_id])
		game.enter_land(land_id)
		for i in 5:
			await process_frame
		var street: Array[String] = []
		for target: Dictionary in game.outdoor_targets:
			if str(target.kind) == "npc":
				street.append("%s|%s" % [target.id, target.name])
		for s: Dictionary in game.land.settlements:
			if str(s.kind) == "capital":
				continue
			towns += 1
			for role in ["guide", "hunter"]:
				var quest_npc: Dictionary = game.quests.npc_for(land_id, str(s.id), role)
				if quest_npc.is_empty():
					continue
				verify(street.has("%s|%s" % [role, quest_npc.name]), "%s: the %s of %s (%s) stands in the street" % [land_id, role, s.name, quest_npc.name])
			for role in ["merchant", "smith"]:
				var quest_npc: Dictionary = game.quests.npc_for(land_id, str(s.id), role)
				if quest_npc.is_empty():
					continue
				var service := "shop" if role == "merchant" else "smithy"
				game.load_space(service, Vector2(100, 100), str(s.id))
				for i in 3:
					await process_frame
				var inside := ""
				for target: Dictionary in game.targets:
					if str(target.kind) == "npc":
						inside = str(target.name)
				verify(inside == str(quest_npc.name), "%s: the %s of %s inside is %s (expected %s)" % [land_id, role, s.name, inside, quest_npc.name])
				game.load_space("", Vector2(float(s.x), float(s.y)))
				for i in 3:
					await process_frame
	print("QUEST NPCS %d/%d (%d towns)" % [checks - failures, checks, towns])
	quit(1 if failures > 0 else 0)
