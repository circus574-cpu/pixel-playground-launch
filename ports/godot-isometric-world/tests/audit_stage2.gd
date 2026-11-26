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
	for viewport in [Vector2i(320, 568), Vector2i(360, 640), Vector2i(390, 844), Vector2i(852, 393), Vector2i(1600, 720)]:
		view.size = viewport
		await process_frame
		await process_frame
		var available := Rect2(Vector2.ZERO, viewport)
		expect(available.encloses(panel.panel.get_rect()), "chat panel fits %s" % str(viewport))
		expect(panel.trigger.size.y >= 44.0 and panel.send_button.size.y >= 44.0, "mobile chat targets keep 44 px")
	# Confirm trigger does not collide with bottom-center XP bar at 1600x720
	var xp_bar_rect := Rect2(600.0, 676.0, 400.0, 28.0)
	expect(not panel.trigger.get_rect().intersects(xp_bar_rect), "chat trigger does not overlap centered XP bar")

	panel.add_line({"scope": "world", "nick": "Orion", "text": "Kod [b]przykład[/b]"})
	panel.add_line({"scope": "local", "nick": "Ari", "text": "Tu jestem"})
	panel.add_line({"scope": "party", "nick": "Ari", "text": "Na bossa!"})
	panel.add_line({"scope": "guild", "nick": "Orion", "guildTag": "ZKI", "text": "Zbiórka w Pyrze"})
	panel._select_channel("world")
	expect(panel.transcript.text == "Orion: Kod [b]przykład[/b]", "scope filter and plain text")
	panel._select_channel("local")
	expect(panel.transcript.text == "Ari: Tu jestem", "local transcript")
	panel._select_channel("party")
	expect(panel.transcript.text == "Ari: Na bossa!", "party channel transcript")
	panel._select_channel("guild")
	expect(panel.transcript.text == "<ZKI> Orion: Zbiórka w Pyrze", "guild channel transcript with tag")
	panel._select_channel("whisper")
	expect(panel.recipient.visible, "whisper has a recipient field")

	# Friends, Party + Party HUD, Guild UI & Classic RPG Paperdoll Profile Card
	panel.open_mode("friends")
	panel.apply_friends({"accepted": [{"accountId": "a2", "nick": "Ari", "online": true, "land": "pyra", "level": 5}], "incoming": [], "outgoing": []})
	expect(panel.friends_body.visible, "friends tab switches cleanly")
	panel.apply_party({"partyId": "p1", "leaderId": "u1", "members": [
		{"id": "u1", "nick": "Orion", "name": "Orion", "level": 5, "land": "pyra", "hp": 250, "maxHp": 250, "power": 500, "isLeader": true},
		{"id": "u2", "nick": "Ari", "name": "Ari", "level": 5, "land": "pyra", "hp": 240, "maxHp": 250, "power": 490, "isLeader": false},
	]})
	expect(panel.party_hud.visible, "party HUD shows for 2+ members")
	panel.apply_guild({"guild": {"id": "g1", "name": "Zakon Ki", "tag": "ZKI", "role": "leader", "members": []}})
	expect((panel.mode_buttons["guild"] as Button).text == "<ZKI>", "guild mode tab displays <TAG>")
	panel.show_profile({"id": "p-fixture", "name": "Ari", "nick": "Ari", "race": "legend", "level": 5, "power": 640, "guildTag": "ZKI", "guildName": "Zakon Ki", "equipment": {"weapon": "pyra_blade"}, "canInviteParty": true, "canInviteGuild": true})
	expect(panel.profile_body.visible, "paperdoll profile card renders with guild and equipment")
	panel.close_panel()

	var peer := {"id": "p-fixture", "x": 230.0, "y": 200.0, "race": "legend", "nick": "Ari", "level": 3, "f": 5, "pose": "walk"}
	ghosts.accept({"land": "pyra", "peers": [peer]})
	expect(ghosts.actors.has("p-fixture") and world.live_agents.is_empty(), "remote actor is separate from gameplay")
	var actor = ghosts.actors["p-fixture"]["actor"]
	expect(actor.direction == "up-left" and actor.label.text == "Ari · Poz. 3", "direction and nameplate loaded")
	peer["guildTag"] = "ZKI"
	peer["inParty"] = true
	peer["x"] = 250.0
	peer["ki"] = true
	var old_pos: Vector2 = ghosts.actors["p-fixture"]["shown"]
	ghosts.accept({"land": "pyra", "peers": [peer]})
	ghosts._process(0.016)
	var shown: Vector2 = ghosts.actors["p-fixture"]["shown"]
	expect(shown.x > old_pos.x and shown.x < 250.0, "peer movement interpolates")
	expect(actor.ki_mode_active, "peer activates KI aura")
	expect(actor.label.text == "Ari · Poz. 3\n<ZKI>", "guild tag renders on second nameplate line")
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
	var second_chat := []
	var friend_invites := []
	var party_invites := []
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
		else:
			peer_world.live_link.chat_received.connect(func(frame: Dictionary) -> void: second_chat.append(frame))
			peer_world.live_link.friend_invite_received.connect(func(frame: Dictionary) -> void: friend_invites.append(frame))
			peer_world.live_link.party_invite_received.connect(func(frame: Dictionary) -> void: party_invites.append(frame))

	var deadline := Time.get_ticks_msec() + 5000
	while Time.get_ticks_msec() < deadline and world.live_peers.actors.is_empty():
		await process_frame
	expect(not world.live_peers.actors.is_empty(), "world sees another Godot client over WebSocket")
	if not world.live_peers.actors.is_empty():
		var id := str(world.live_peers.actors.keys()[0])
		var remote = world.live_peers.actors[id]["actor"]
		var remote_nick := str(world.live_peers.actors[id].get("nick", ""))
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

		# Social protocol over real WebSocket between 2 Godot clients: Friends -> Party -> Party Chat -> Guild
		if not remote_nick.is_empty():
			world.live_link.request_friend(remote_nick)
			deadline = Time.get_ticks_msec() + 3000
			while Time.get_ticks_msec() < deadline and friend_invites.is_empty():
				await process_frame
			if not friend_invites.is_empty():
				second.live_link.accept_friend(str(friend_invites[0].get("fromAccountId", "")))
				deadline = Time.get_ticks_msec() + 3000
				while Time.get_ticks_msec() < deadline and (world.live_panel.friends_data.get("accepted", []) as Array).is_empty():
					await process_frame
			expect(not (world.live_panel.friends_data.get("accepted", []) as Array).is_empty(), "two Godot clients become persistent friends")

			# Space past 450ms social cooldown
			var pause_until := Time.get_ticks_msec() + 500
			while Time.get_ticks_msec() < pause_until:
				await process_frame
			world.live_link.invite_party(remote_nick)
			deadline = Time.get_ticks_msec() + 3000
			while Time.get_ticks_msec() < deadline and party_invites.is_empty():
				await process_frame
			if not party_invites.is_empty():
				second.live_link.respond_party(str(party_invites[0].get("partyId", "")), true)
				deadline = Time.get_ticks_msec() + 3000
				while Time.get_ticks_msec() < deadline and (world.live_panel.party_data.get("members", []) as Array).size() < 2:
					await process_frame
			expect((world.live_panel.party_data.get("members", []) as Array).size() == 2 and world.live_panel.party_hud.visible, "two Godot clients form a live party with Party HUD")

			# Party chat after 1.25s chat cooldown
			var chat_pause := Time.get_ticks_msec() + 1300
			while Time.get_ticks_msec() < chat_pause:
				await process_frame
			world.live_link.send_chat("party", "Razem na smoka!")
			deadline = Time.get_ticks_msec() + 3000
			while Time.get_ticks_msec() < deadline and not second_chat.any(func(f: Dictionary) -> bool: return str(f.get("scope", "")) == "party"):
				await process_frame
			expect(second_chat.any(func(f: Dictionary) -> bool: return str(f.get("scope", "")) == "party"), "party chat reaches second Godot client")

			# Create guild and verify <TAG> updates hero nameplate
			world.live_link.create_guild("Straż Ki", "SKI")
			deadline = Time.get_ticks_msec() + 3000
			while Time.get_ticks_msec() < deadline and str(world.live_link.guild_tag) != "SKI":
				await process_frame
			expect(str(world.live_link.guild_tag) == "SKI" and world.hero.label.text.contains("<SKI>"), "guild creation sets <TAG> on hero nameplate")

			# Clean up guild & party
			second.live_link.leave_party()
			pause_until = Time.get_ticks_msec() + 500
			while Time.get_ticks_msec() < pause_until:
				await process_frame
			world.live_link.leave_guild()
	second.queue_free()
