extends RefCounted
## Commands for the current local-PvE character, mirroring components/game/StaffTools.tsx.
## A server role check precedes every action. No other account or save slot is edited.
var game: Node
var net: PyraOnline
var busy := false
var mode_account := ""
var role_clock := 0.0
var generation := 0

func setup(scene: Node, connection: PyraOnline) -> void:
	game = scene
	net = connection
	net.session_changed.connect(check_access)

func check_access() -> void:
	if not net.is_staff() or (mode_account != "" and net.account_id != mode_account):
		clear_modes()

func clear_modes() -> void:
	if is_instance_valid(game) and game.kit != null:
		game.kit.gm_invulnerable = false
		game.kit.gm_no_cooldowns = false
	mode_account = ""

func dispose() -> void:
	clear_modes()
	if is_instance_valid(net) and net.session_changed.is_connected(check_access):
		net.session_changed.disconnect(check_access)

func cancel_pending() -> void:
	generation += 1

func tick(delta: float) -> void:
	check_access()
	if mode_account == "":
		return
	role_clock += delta
	if role_clock >= 30.0 and not busy:
		role_clock = 0.0
		revalidate()

func revalidate() -> void:
	busy = true
	if not await net.verify_staff():
		clear_modes()
	busy = false

static func reply(ok: bool, message: String) -> Dictionary:
	return {"ok":ok,"message":message}

static func number(value: Variant) -> bool:
	return (value is float or value is int) and is_finite(float(value))

func execute(command: Dictionary) -> Dictionary:
	if busy:
		return reply(false, "Poczekaj na zakończenie poprzedniej komendy.")
	busy = true
	var account := net.account_id
	var expected := generation
	var character: RefCounted = game.kit
	var allowed := await net.verify_staff()
	if not allowed or account == "" or account != net.account_id or expected != generation or character != game.kit:
		clear_modes()
		busy = false
		return reply(false, "Brak potwierdzonych uprawnień GM/admin.")
	if game.input_suspended or game.checkpoint_protected:
		busy = false
		return reply(false, "Trwa zmiana lokacji lub zapis jest chroniony. Komenda nie została wykonana.")
	var result: Dictionary
	if str(command.get("action", "")) == "teleport":
		result = await teleport(command, account, expected)
	else:
		result = apply(command)
	busy = false
	if bool(result.ok):
		game.quests.sync()
		game.refresh_quest_ui()
		game.hud.refresh(game.kit)
		if not game.save_checkpoint(game.SAVE_PATH, true):
			result.message += " Zmiana działa, ale zapis nie powiódł się — zapisz ponownie z menu."
		game.hud.toast(str(result.message))
	return result

func apply(command: Dictionary) -> Dictionary:
	var action := str(command.get("action", ""))
	match action:
		"level", "setLevel":
			var value: Variant = command.get("value", game.kit.level + 1)
			if not number(value) or float(value) < 1 or float(value) > 20 or float(value) != floorf(float(value)):
				return reply(false, "Wybierz poziom 1–20 (zakres obecnego silnika Android).")
			game.kit.set_level(int(value))
			game.economy.level = game.kit.level
			return reply(true, "Poziom %d. HP i KI odnowione; drzewko dopasowane do poziomu." % game.kit.level)
		"heal":
			if game.kit.dead:
				game.respawn_timer = -1.0
				game.respawn_player()
			game.kit.clear_debuffs()
			game.kit.rest_fully()
			game.player.fx_lock = 0.0
			game.player.locked = is_instance_valid(game.screen)
			return reply(true, "Pełne HP i KI. Usunięto negatywne efekty.")
		"god":
			game.kit.gm_invulnerable = not game.kit.gm_invulnerable
			mode_account = net.account_id
			return reply(true, "Nieśmiertelność " + ("WŁĄCZONA." if game.kit.gm_invulnerable else "WYŁĄCZONA."))
		"unlimited":
			game.kit.gm_no_cooldowns = not game.kit.gm_no_cooldowns
			if game.kit.gm_no_cooldowns:
				game.kit.cooldowns.clear()
			mode_account = net.account_id
			return reply(true, "Brak cooldownów " + ("WŁĄCZONY." if game.kit.gm_no_cooldowns else "WYŁĄCZONY."))
		"gold", "setGold":
			var value: Variant = command.get("value", mini(1000000, game.economy.gold + 1000))
			if not number(value) or float(value) < 0 or float(value) > 1000000:
				return reply(false, "Kwota musi mieścić się w zakresie 0–1 000 000.")
			game.economy.gold = int(value)
			game.economy.changed.emit()
			return reply(true, "Monety: %d." % game.economy.gold)
		"potions":
			var amount: int = mini(10, maxi(0, 99 - game.economy.count("potion")))
			if amount <= 0 or not game.economy.add_item("potion", amount):
				return reply(false, "Nie dodano mikstur: limit 99 lub pełny plecak.")
			return reply(true, "+%d mikstur." % amount)
	return reply(false, "Nieznana komenda GM.")

func teleport(command: Dictionary, account: String, expected: int) -> Dictionary:
	if game.kit.dead or not game.current_room.is_empty():
		return reply(false, "Teleport działa na otwartym terenie, gdy postać żyje.")
	var id := str(command.get("land", game.land_id))
	if not id in game.ALL_LANDS:
		return reply(false, "Nieznana kraina.")
	# A destination's data can be absent on a slim installation; acquire it before reading coordinates.
	if not await game.ensure_land_content(id):
		return reply(false, "Nie pobrano krainy. Pozostajesz w bieżącej lokacji.")
	if account != net.account_id or not await net.verify_staff() or expected != generation:
		return reply(false, "Uprawnienia zmieniły się podczas pobierania. Teleport anulowany.")
	var cfg: Dictionary = PyraContinent.load_json("res://data/lands/%s/land.json" % id)
	var x: Variant = command.get("x", cfg.arrival.x)
	var y: Variant = command.get("y", cfg.arrival.y)
	if not number(x) or not number(y):
		return reply(false, "Współrzędne muszą być skończonymi liczbami.")
	var wanted := Vector2(float(x), float(y))
	var spot: Variant = find_spot(id, wanted, game.continent.walk if id == game.land_id else PackedByteArray())
	if spot == null:
		return reply(false, "Nie można teleportować do wody ani poza mapę. Wybierz ląd.")
	var old_land: String = game.land_id
	var old_point: Vector2 = game.player.position
	game.hud.touch.reset()
	game.attack_held = false
	game.current_target = null
	game.monsters.disengage_all()
	if id != old_land:
		game.enter_land(id, spot)
		spot = find_spot(id, wanted, game.continent.walk)
		if spot == null:
			game.enter_land(old_land, old_point)
			game.player.locked = is_instance_valid(game.screen)
			return reply(false, "Brak miejsca do stania. Przywrócono poprzednią lokację.")
	game.player.position = spot
	game.city_return = spot
	game.camera.reset_smoothing()
	game.continent.update_view(game.camera_view(), true)
	game.player.locked = is_instance_valid(game.screen)
	return reply(true, "Teleport: %s · %d, %d." % [str(game.land.name), roundi(spot.x), roundi(spot.y)])

static func find_spot(id: String, wanted: Vector2, live_walk := PackedByteArray()) -> Variant:
	var cfg: Dictionary = PyraContinent.load_json("res://data/lands/%s/land.json" % id)
	var bounds := Rect2(20, 20, float(cfg.width) - 40, float(cfg.height) - 40)
	if not wanted.is_finite() or not bounds.has_point(wanted):
		return null
	var mask: Image = (load("res://assets/lands/%s/ctrl-land.png" % id) as Texture2D).get_image()
	if mask.is_compressed():
		mask.decompress()
	if mask.get_pixel(int(wanted.x) / 32, int(wanted.y) / 32).r < 0.5:
		return null
	var walk := live_walk if not live_walk.is_empty() else FileAccess.get_file_as_bytes("res://data/lands/%s/walk.bin" % id)
	var width := int(cfg.grid.nav[0])
	var free := func(p: Vector2) -> bool:
		if not bounds.has_point(p):
			return false
		var index := int(p.y) / 16 * width + int(p.x) / 16
		return index < walk.size() and walk[index] > 127
	if free.call(wanted):
		return wanted
	# Bounded CPU search near a blocked tree/building, no random fallback to a different continent.
	for radius in range(16, 4001, 16):
		for step in 32:
			var p := wanted + Vector2.from_angle(TAU * step / 32.0) * radius
			if free.call(p):
				return p
	return null
