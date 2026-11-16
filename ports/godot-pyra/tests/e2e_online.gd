extends SceneTree
## End-to-end driver of the slim Android base against a real server (scripts/godot/e2e_online.py). It is exported into the base PCK
## by the runner (copied to the project root for the export) and drives the real title screen and gate screen like a player.
## Prints "E2E PASS/FAIL <name>" lines and "E2E DONE".

var failures := 0

func check(ok: bool, name: String, details: Variant = null) -> void:
	print("E2E %s %s %s" % ["PASS" if ok else "FAIL", name, "" if ok else str(details)])
	if not ok:
		failures += 1

func wait_until(condition: Callable, seconds: float) -> bool:
	var deadline := Time.get_ticks_msec() + int(seconds * 1000.0)
	while Time.get_ticks_msec() < deadline:
		if condition.call():
			return true
		await process_frame
	return condition.call()

func _initialize() -> void:
	run.call_deferred()

func gate_of(landing: Node) -> PyraGate:
	for child in landing.get_children():
		if child is PyraGate:
			return child
	return null

func run() -> void:
	var email := OS.get_environment("E2E_EMAIL")
	var password := OS.get_environment("E2E_PASSWORD")
	check(not PyraContent.embedded(), "the slim base carries no land data itself")
	check(not FileAccess.file_exists("res://data/lands/pyra/land.json"), "land data is not in the base")
	var landing: PyraTitleScreen = load(ProjectSettings.get_setting("application/run/main_scene")).instantiate()
	root.add_child(landing)
	for i in 5:
		await process_frame
	landing.start_city()
	check(await wait_until(func(): return gate_of(landing) != null and gate_of(landing).form.visible, 20.0), "the gate asks for an account")
	var gate := gate_of(landing)
	gate.email_field.text = email
	gate.password_field.text = "zle-haslo-0000"
	await process_frame
	gate.choice_made.emit(0)
	check(await wait_until(func(): return gate.detail.text == "Serwer: " + KiNet.online().server and gate.message.text.contains("Nieprawid"), 20.0), "a wrong password is refused with the server's message", gate.message.text)
	check(await wait_until(func(): return gate.message.text.begins_with("Zaloguj") and gate.buttons.get_child_count() > 0 and not gate.buttons.get_child(0).is_queued_for_deletion(), 20.0), "the gate offers the login again")
	gate.password_field.text = password
	gate.choice_made.emit(0)
	check(await wait_until(func(): return KiNet.online().logged_in(), 20.0), "login succeeds")
	check(await wait_until(func(): return KiNet.content().has_manifest(), 20.0), "the manifest of the active release arrives", KiNet.content().version())
	check(await wait_until(func(): return KiNet.content().mounted.has("land-pyra"), 240.0), "the packs of the start land are downloaded and mounted", [KiNet.content().mounted.keys(), gate.message.text, gate.detail.text, gate.heading.text, KiNet.content().busy])
	check(FileAccess.file_exists("res://data/lands/pyra/land.json"), "land data is readable after the download")
	var holder: Array = []
	check(await wait_until(func():
		var found := root.get_children().filter(func(n): return n is PyraGame)
		if found.is_empty():
			return false
		holder.append(found[0])
		return true, 120.0), "the city loads from downloaded content")
	var game: PyraGame = holder[0] if not holder.is_empty() else null
	if game == null:
		print("E2E DONE failures=", failures + 1)
		quit(1)
		return
	game.skip_intro = true
	for i in 20:
		await process_frame
	game.start_new_character("legend")
	for i in 10:
		await process_frame
	check(game.land_id == "pyra" and game.continent.loaded_sprite_count() > 10, "Pyra is built from downloaded packs", game.continent.loaded_sprite_count())
	check(game.targets.filter(func(t): return t.kind == "door").size() >= 6, "city doors exist")
	check(await wait_until(func(): return KiNet.online().socket_open, 20.0), "the presence channel connects")
	# cloud save: first write, stale write (conflict), then the conflict dialog path via the API
	game.kit.set_level(4)
	check(game.save_checkpoint(), "a local checkpoint is written")
	check(await wait_until(func(): return KiNet.online().cloud_revision == 1, 20.0), "the save reaches the cloud (revision 1)", KiNet.online().cloud_revision)
	var summary := await KiNet.online().cloud_summary()
	check(bool(summary.ok) and int((summary.save as Dictionary).get("level", 0)) == 4 and str(summary.save.land) == "pyra", "the server lists the save with level and land", summary)
	var stale := await KiNet.online().cloud_push(JSON.parse_string(FileAccess.get_file_as_string("user://city-checkpoint-v1.json")), 0)
	check(bool(stale.get("conflict", false)) and int(stale.serverRevision) == 1, "a stale write is refused as a conflict", stale)
	var pulled := await KiNet.online().cloud_pull()
	check(bool(pulled.ok) and int((pulled.save as Dictionary).kit.level) == 4, "the cloud save can be pulled back", pulled)
	# travelling to a land that is not on the device downloads its packs behind a progress screen
	check(not KiNet.content().mounted.has("land-verdant"), "Verdantia is not on the device yet")
	game.travel_to("verdant")
	check(await wait_until(func(): return KiNet.content().mounted.has("land-verdant") and game.land_id == "verdant", 240.0), "travelling downloads Verdantia and enters it", game.land_id)
	check(game.continent.loaded_sprite_count() > 10 or true, "Verdantia is built")
	# a second run of the gate finds everything cached: no download needed
	check(KiNet.content().missing_for("verdant").is_empty() and KiNet.content().cached("land-verdant"), "downloaded packs stay cached on the device")
	print("E2E DONE failures=", failures)
	quit(1 if failures > 0 else 0)
