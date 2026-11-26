extends SceneTree

const Peers := preload("res://scripts/live_peers.gd")
const ChatPanel := preload("res://scripts/live_panel.gd")

class FixtureWorld extends "res://scripts/world.gd":
	func _ready() -> void:
		set_process(false)
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
			btn_talk_npc, btn_open_treasure, btn_gather, combat_toast_lbl, stick_layer]:
			add_child(node)
		load_databases()

var checks := 0
var failures := 0

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: " + label)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var view := SubViewport.new()
	view.size = Vector2i(320, 568)
	root.add_child(view)
	var world := FixtureWorld.new()
	view.add_child(world)
	var ghosts := Peers.new()
	ghosts.world = world
	world.add_child(ghosts)
	var panel := ChatPanel.new()
	panel.world = world
	world.hud.add_child(panel)
	panel.open_chat()
	await process_frame
	for viewport in [Vector2i(320, 568), Vector2i(360, 640), Vector2i(390, 844), Vector2i(852, 393)]:
		view.size = viewport
		await process_frame
		await process_frame
		var available := Rect2(Vector2.ZERO, viewport)
		expect(available.encloses(panel.panel.get_rect()), "chat panel fits %s" % str(viewport))
		expect(panel.trigger.size.y >= 44.0 and panel.send_button.size.y >= 44.0, "mobile chat targets keep 44 px")
	panel.add_line({"scope": "world", "nick": "Orion", "text": "Kod [b]przykład[/b]"})
	panel.add_line({"scope": "local", "nick": "Ari", "text": "Tu jestem"})
	panel._select_channel("world")
	expect(panel.transcript.text == "Orion: Kod [b]przykład[/b]", "scope filter and plain text")
	panel._select_channel("local")
	expect(panel.transcript.text == "Ari: Tu jestem", "local transcript")
	panel._select_channel("whisper")
	expect(panel.recipient.visible, "whisper has a recipient field")
	panel.close_panel()

	var peer := {"id": "p-fixture", "x": 230.0, "y": 200.0, "race": "legend", "nick": "Ari", "level": 3, "f": 5, "pose": "walk"}
	ghosts.accept({"land": "pyra", "peers": [peer]})
	expect(ghosts.actors.has("p-fixture") and world.live_agents.is_empty(), "remote actor is separate from gameplay")
	var actor = ghosts.actors["p-fixture"]["actor"]
	expect(actor.direction == "up-left" and actor.label.text == "Ari · Poz. 3", "direction and nameplate loaded")
	peer["x"] = 250.0
	peer["ki"] = true
	var old_pos: Vector2 = ghosts.actors["p-fixture"]["shown"]
	ghosts.accept({"land": "pyra", "peers": [peer]})
	ghosts._process(0.016)
	var shown: Vector2 = ghosts.actors["p-fixture"]["shown"]
	expect(shown.x > old_pos.x and shown.x < 250.0, "peer movement interpolates")
	expect(actor.ki_mode_active, "peer activates KI aura")
	ghosts.show_bubble({"scope": "local", "id": "p-fixture", "text": "Cześć"})
	expect(actor.bubble_panel != null and actor.bubble_lbl.text == "Cześć", "local line draws a player bubble")
	ghosts.accept({"land": "aether", "peers": [peer]})
	expect(ghosts.actors.is_empty(), "wrong-continent snapshot clears actors")

	if not OS.get_environment("KI_GODOT_LIVE_TEST_URL").is_empty():
		await run_socket_test(world)
	view.queue_free()
	await process_frame
	print("Etap 2 — %d/%d kontroli Godot" % [checks - failures, checks])
	quit(1 if failures > 0 else 0)

func run_socket_test(world: Node) -> void:
	var url := OS.get_environment("KI_GODOT_LIVE_TEST_URL")
	var second := FixtureWorld.new()
	world.get_parent().add_child(second)
	var worlds := [world, second]
	var chat := []
	for index in 2:
		var peer_world: Node = worlds[index]
		var key := str(index + 1)
		var token := OS.get_environment("KI_GODOT_LIVE_TOKEN_" + key)
		peer_world.server_char_id = OS.get_environment("KI_GODOT_LIVE_CHARACTER_" + key)
		peer_world.server_action_fn = func(_id: String, _payload: Dictionary, _done: Callable) -> void: pass
		peer_world.live_auth_fn = func() -> Dictionary: return {"url": url, "token": token}
		peer_world.hero_pos = Vector2(2200.0 + 20.0 * index, 2000.0)
		peer_world.rebuild_hero("pyra")
		peer_world.hero.state = "walk"
		peer_world.hero.direction = "down-left"
		peer_world._start_live_presence()
		if index == 0:
			peer_world.live_link.chat_received.connect(func(frame: Dictionary) -> void: chat.append(frame))

	var deadline := Time.get_ticks_msec() + 5000
	while Time.get_ticks_msec() < deadline and world.live_peers.actors.is_empty():
		await process_frame
	expect(not world.live_peers.actors.is_empty(), "world sees another Godot client over WebSocket")
	if not world.live_peers.actors.is_empty():
		var id := str(world.live_peers.actors.keys()[0])
		var remote = world.live_peers.actors[id]["actor"]
		expect(remote.direction == "down-left", "remote direction reaches the world actor")
		expect(world.live_link.send_chat("whisper", "Próba Godot", id), "Godot sends a whisper")
		deadline = Time.get_ticks_msec() + 3000
		while Time.get_ticks_msec() < deadline and chat.is_empty():
			await process_frame
		expect(chat.size() == 1 and chat[0].get("scope") == "whisper", "server acknowledges Godot whisper")
		world.live_link.inspect_peer(id)
		deadline = Time.get_ticks_msec() + 3000
		while Time.get_ticks_msec() < deadline and not world.live_panel.profile_body.visible:
			await process_frame
		expect(world.live_panel.profile_body.visible, "nearby player profile opens in the real world overlay")
	second.queue_free()
