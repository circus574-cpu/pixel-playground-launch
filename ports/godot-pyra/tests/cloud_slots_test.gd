extends SceneTree
## Cloud saves per character: every character of the device gets a cloud slot of its own (1..3) at its first upload, a fourth stays on the device,
## switching characters uploads to the right slot, a new device takes the cloud characters as characters, and a legacy save keeps slot 1.
## godot --headless --audio-driver Dummy --path ports/godot-pyra --script res://tests/cloud_slots_test.gd
const Characters := preload("res://scripts/characters.gd")
var failures := 0

## An in-memory server: three slots per account, revision counter, stale writes refused (409).
class Cloud extends PyraOnline:
	var rows: Dictionary = {}   # slot -> {revision, save}
	func request(method: int, path: String, body: Variant = null, _token: bool = true, _timeout: float = 15.0, _retry: bool = true) -> Dictionary:
		await get_tree().process_frame
		if not path.begins_with("/ws/godot/saves"):
			return {"status": 404, "json": {}}
		if path == "/ws/godot/saves":
			var list: Array = []
			for slot: int in rows:
				var save: Dictionary = rows[slot].save
				list.append({"slot": slot, "revision": rows[slot].revision, "race": save.race, "land": save.land, "level": int(save.kit.level), "updatedAt": "2026-11-17T12:00:00Z"})
			return {"status": 200, "json": {"saves": list}}
		var slot := int(path.get_slice("/", path.get_slice_count("/") - 1))
		if method == HTTPClient.METHOD_GET:
			if not rows.has(slot):
				return {"status": 404, "json": {}}
			return {"status": 200, "json": {"revision": rows[slot].revision, "save": rows[slot].save}}
		var current: int = int(rows[slot].revision) if rows.has(slot) else 0
		if int((body as Dictionary).baseRevision) != current:
			return {"status": 409, "json": {"serverRevision": current}}
		rows[slot] = {"revision": current + 1, "save": (body as Dictionary).save}
		return {"status": 200, "json": {"revision": current + 1}}

func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok:
		failures += 1

func frames(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	for path in ["user://city-checkpoint-v1.json", "user://cave-test.json", "user://core.json"]:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(path))
	var dir := DirAccess.open("user://characters")
	if dir != null:
		for f in dir.get_files():
			DirAccess.remove_absolute(ProjectSettings.globalize_path("user://characters/" + f))
	var hub := KiNet.hub()
	var old := hub.online_node
	hub.remove_child(old)
	var cloud := Cloud.new()
	hub.online_node = cloud
	hub.content_node.online = cloud
	hub.add_child(cloud)
	old.queue_free()
	cloud.access_token = "qa"
	cloud.refresh_token = "qa"
	cloud.account_id = "qa-account"
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await frames(5)
	landing.start_city()
	while is_instance_valid(landing):
		await process_frame
	var game: PyraGame = root.get_children().filter(func(n: Node) -> bool: return n is PyraGame)[0]
	game.skip_intro = true
	game.set_process(false)
	game.monsters.set_process(false)
	await frames(10)
	# four characters on one account
	var ids: Array[String] = []
	for race in ["legend", "planetary", "sage", "android"]:
		await game.start_new_character(race)
		await frames(5)
		game.kit.set_level(2 + ids.size())
		game.save_checkpoint(game.SAVE_PATH, true)
		await game.push_cloud(false)
		await frames(10)
		ids.append(game.character_id)
	check(cloud.rows.size() == 3, "the cloud holds three characters (%d)" % cloud.rows.size())
	check(cloud.rows.has(1) and cloud.rows[1].save.race == "legend" and cloud.rows.has(2) and cloud.rows[2].save.race == "planetary" and cloud.rows.has(3) and cloud.rows[3].save.race == "sage", "each character has its own slot (legend 1, planetary 2, sage 3)")
	check(game.cloud_slot == -1, "the fourth character stays on the device")
	# the third character goes on being saved into ITS slot
	await game.switch_character(ids[1])
	await frames(10)
	check(game.cloud_slot == 2 and game.race == "planetary", "switching keeps the slot of the character")
	game.kit.set_level(9)
	game.save_checkpoint(game.SAVE_PATH, true)
	await frames(30)
	check(int(cloud.rows[2].save.kit.level) == 9 and int(cloud.rows[1].save.kit.level) == 2, "the save of the planetary reaches slot 2 and nothing else")
	check(int(cloud.rows[2].revision) > int(cloud.rows[1].revision), "slot 2 was written more often than slot 1 (revisions %d, %d)" % [int(cloud.rows[2].revision), int(cloud.rows[1].revision)])
	# a second device: no local characters, the same account
	game.queue_free()
	await frames(5)
	var dir2 := DirAccess.open("user://characters")
	for f in dir2.get_files():
		DirAccess.remove_absolute(ProjectSettings.globalize_path("user://characters/" + f))
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://city-checkpoint-v1.json"))
	cloud.revisions = {}
	cloud.cloud_revision = 0
	var gate := PyraGate.new()
	root.add_child(gate)
	await gate.reconcile_cloud()
	var roster := Characters.list()
	check(roster.size() == 3, "a new device receives the three cloud characters (%d)" % roster.size())
	var by_race: Dictionary = {}
	for e in roster:
		by_race[e.race] = e
	check(by_race.has("planetary") and int(by_race["planetary"].level) == 9 and int(by_race["planetary"].cloudSlot) == 2, "the planetary arrives with level 9 and slot 2")
	check(FileAccess.file_exists("user://city-checkpoint-v1.json"), "one of them is the active one")
	# a legacy save (before slots): the active character becomes slot 1 when the revision matches
	gate.queue_free()
	for f in DirAccess.open("user://characters").get_files():
		DirAccess.remove_absolute(ProjectSettings.globalize_path("user://characters/" + f))
	var legacy: Dictionary = (cloud.rows[1].save as Dictionary).duplicate(true)
	legacy.erase("cloudSlot")
	legacy.erase("characterId")
	Characters.write("user://city-checkpoint-v1.json", legacy)
	cloud.revisions = {1: int(cloud.rows[1].revision)}
	var gate2 := PyraGate.new()
	root.add_child(gate2)
	await gate2.reconcile_cloud()
	var legacy_ok := Characters.list().filter(func(e: Dictionary) -> bool: return int(e.cloudSlot) == 1 and e.race == "legend")
	check(legacy_ok.size() == 1, "the legacy save keeps slot 1 without a dialog")
	var count_after := Characters.list().size()
	check(count_after == 3, "and the other cloud characters are taken over (%d)" % count_after)
	print("FAILURES ", failures)
	quit(1 if failures > 0 else 0)
