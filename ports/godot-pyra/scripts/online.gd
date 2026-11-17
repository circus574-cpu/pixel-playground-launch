class_name PyraOnline
extends Node
## The Android game's connection to the Ki Legends server: account (the same accounts as the web game, /ws/auth/*), cloud saves with
## revision locking (/ws/godot/saves) and the presence channel (/ws/godot/live: other players of the land and local chat).
## The Android game is a local PvE simulation: the server keeps the player's save and shows other players as cosmetic ghosts,
## it never decides combat, loot, experience or position.

signal session_changed
signal peers_changed(peers: Array)
signal chat_received(nick: String, text: String)
signal live_state_changed(connected: bool)

const SESSION_PATH := "user://account.json"
const CLOUD_PATH := "user://cloud.json"
const SLOTS := 3                   # the server keeps up to three cloud saves per account: one per character (scripts/characters.gd)

var server := ""
var access_token := ""
var refresh_token := ""
var roles: Array = []            # "admin" / "gm" of the signed-in account (from the server; not stored on the device)
var remember := true            # "Zapamiętaj mnie": without it the sign-in lives only until the app is closed (nothing is written to disk)
var account_id := ""
var nick := ""
var online_count := 0
var slot := 1                      # the cloud slot of the character being played (set by use_slot)
var revisions: Dictionary = {}     # slot (int) -> revision this device last read or wrote (this account)
var cloud_revision := 0            # that revision for the current slot
var last_error := ""

var socket: WebSocketPeer
var socket_open := false
var live_land := ""
var live_timer := 0.0
var live_reconnect := 0.0
var live_payload: Callable = Callable()
var peers: Array = []

func _ready() -> void:
	server = resolve_server()
	load_session()

## Command line (--server=URL), environment (KI_SERVER), user://server.json, then the project setting.
static func resolve_server() -> String:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			return arg.substr(9).rstrip("/")
	var env := OS.get_environment("KI_SERVER")
	if env != "":
		return env.rstrip("/")
	if FileAccess.file_exists("user://server.json"):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://server.json"))
		if value is Dictionary and str(value.get("server", "")) != "":
			return str(value.server).rstrip("/")
	return str(ProjectSettings.get_setting("ki/server/url", "https://kilegends.pl")).rstrip("/")

func logged_in() -> bool:
	return refresh_token != "" and account_id != ""

# ---- HTTP -------------------------------------------------------------------------------------------

## One request: {"status": int (0 = no connection), "json": parsed body or null, "headers": PackedStringArray}.
func request(method: int, path: String, body: Variant = null, with_token: bool = true, timeout: float = 15.0, retry: bool = true) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = timeout
	add_child(http)
	var headers := PackedStringArray(["Accept: application/json"])
	var payload := ""
	if body != null:
		headers.append("Content-Type: application/json")
		payload = JSON.stringify(body)
	if with_token and access_token != "":
		headers.append("Authorization: Bearer " + access_token)
	var error := http.request(server + path, headers, method, payload)
	if error != OK:
		http.queue_free()
		return {"status": 0, "json": null, "error": "request"}
	var done: Array = await http.request_completed
	http.queue_free()
	if int(done[0]) != HTTPRequest.RESULT_SUCCESS:
		return {"status": 0, "json": null, "error": "net:%d" % int(done[0])}
	var text := (done[3] as PackedByteArray).get_string_from_utf8()
	var json: Variant = JSON.parse_string(text) if text != "" else null
	var result := {"status": int(done[1]), "json": json, "headers": done[2]}
	if int(done[1]) == 401 and with_token and retry and refresh_token != "":
		if await refresh():
			return await request(method, path, body, with_token, timeout, false)
	return result

static func message_of(result: Dictionary, fallback: String) -> String:
	var json: Variant = result.get("json")
	if json is Dictionary and str(json.get("message", "")) != "":
		return str(json.message)
	if int(result.status) == 0:
		return "Brak połączenia z serwerem."
	return fallback

# ---- account ----------------------------------------------------------------------------------------

func adopt(session: Dictionary) -> void:
	access_token = str(session.accessToken)
	refresh_token = str(session.refreshToken)
	var account: Dictionary = session.account
	if account_id != str(account.id):
		revisions = {}
		cloud_revision = 0
	account_id = str(account.id)
	nick = str(account.nick)
	roles = account.get("roles", []) if account.get("roles", []) is Array else []
	save_session()
	session_changed.emit()

## Server roles only; a logged-out session must never keep its staff controls.
func is_staff() -> bool:
	return logged_in() and access_token != "" and (roles.has("admin") or roles.has("gm"))

func verify_staff() -> bool:
	if not logged_in():
		roles = []
		session_changed.emit()
		return false
	var expected := account_id
	var result := await request(HTTPClient.METHOD_GET, "/ws/auth/me")
	# A response belonging to a previous account cannot grant access to the next account.
	if account_id != expected:
		return false
	if int(result.status) == 200 and result.json is Dictionary:
		var account: Dictionary = result.json.get("account", {})
		roles = account.get("roles", []) if str(account.get("id", "")) == expected and account.get("roles", []) is Array else []
	else:
		roles = []
	session_changed.emit()
	return is_staff()

func login(email: String, password: String) -> Dictionary:
	var result := await request(HTTPClient.METHOD_POST, "/ws/auth/login", {"email": email, "password": password}, false)
	if int(result.status) == 200 and result.json is Dictionary:
		adopt(result.json)
		load_cloud_state()
	return result

func register(email: String, password: String, new_nick: String) -> Dictionary:
	return await request(HTTPClient.METHOD_POST, "/ws/auth/register", {"email": email, "password": password, "nick": new_nick}, false)

func refresh() -> bool:
	if refresh_token == "":
		return false
	var result := await request(HTTPClient.METHOD_POST, "/ws/auth/refresh", {"refreshToken": refresh_token}, false, 15.0, false)
	if int(result.status) == 200 and result.json is Dictionary:
		adopt(result.json)
		return true
	if int(result.status) == 401 or int(result.status) == 400:
		sign_out_local()
	return false

func logout() -> void:
	if refresh_token != "":
		await request(HTTPClient.METHOD_POST, "/ws/auth/logout", {"refreshToken": refresh_token}, false, 8.0, false)
	sign_out_local()

func sign_out_local() -> void:
	access_token = ""
	refresh_token = ""
	account_id = ""
	nick = ""
	roles = []
	if FileAccess.file_exists(SESSION_PATH):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION_PATH))
	close_live()
	session_changed.emit()

func save_session() -> void:
	if not remember:
		if FileAccess.file_exists(SESSION_PATH):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(SESSION_PATH))
		return
	var file := FileAccess.open(SESSION_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({"refreshToken": refresh_token, "accountId": account_id, "nick": nick, "server": server}))
		file.close()

func load_session() -> void:
	if not FileAccess.file_exists(SESSION_PATH):
		return
	var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(SESSION_PATH))
	if value is Dictionary and str(value.get("server", server)) == server and str(value.get("refreshToken", "")) != "":
		refresh_token = str(value.refreshToken)
		account_id = str(value.get("accountId", ""))
		nick = str(value.get("nick", ""))
		load_cloud_state()

## Silent sign-in with the stored refresh token (a new one comes back; the old one stops working).
func resume() -> bool:
	if refresh_token == "":
		return false
	return await refresh()

# ---- cloud saves ------------------------------------------------------------------------------------

func load_cloud_state() -> void:
	revisions = {}
	cloud_revision = 0
	if FileAccess.file_exists(CLOUD_PATH):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(CLOUD_PATH))
		if value is Dictionary and str(value.get("account", "")) == account_id:
			var saved: Variant = value.get("revisions", null)
			if saved is Dictionary:
				for key: Variant in (saved as Dictionary):
					revisions[int(str(key))] = int((saved as Dictionary)[key])
			elif value.has("revision"):
				revisions[1] = int(value.revision)   # the one-save file of releases before 1.13 held slot 1
	cloud_revision = int(revisions.get(slot, 0))

func store_cloud_state() -> void:
	revisions[slot] = cloud_revision
	var saved: Dictionary = {}
	for key: Variant in revisions:
		saved[str(key)] = int(revisions[key])
	var file := FileAccess.open(CLOUD_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({"account": account_id, "revisions": saved}))
		file.close()

## Makes `number` (1..3) the cloud slot of the following pull / push: the revision of that slot becomes the current one.
func use_slot(number: int) -> void:
	revisions[slot] = cloud_revision
	slot = clampi(number, 1, SLOTS)
	cloud_revision = int(revisions.get(slot, 0))

## All the cloud saves of the account: {"ok": bool, "saves": [{slot, revision, race, land, level, updatedAt, ...}]}.
func cloud_list() -> Dictionary:
	var result := await request(HTTPClient.METHOD_GET, "/ws/godot/saves")
	if int(result.status) != 200 or not result.json is Dictionary:
		return {"ok": false, "status": int(result.status), "saves": []}
	var rows: Array = []
	for row: Variant in (result.json.get("saves", []) as Array):
		if row is Dictionary and int(row.slot) >= 1 and int(row.slot) <= SLOTS:
			rows.append(row)
	return {"ok": true, "saves": rows}

## The summary of the cloud save of the current slot, or {} (none / offline). Returns {"ok": bool, "save": {...}}.
func cloud_summary() -> Dictionary:
	var listed := await cloud_list()
	if not bool(listed.ok):
		return listed
	for row: Dictionary in listed.saves:
		if int(row.slot) == slot:
			return {"ok": true, "save": row}
	return {"ok": true, "save": {}}

## Reads the save of the current slot, or of `number` when given (it becomes the current slot).
func cloud_pull(number: int = 0) -> Dictionary:
	if number > 0:
		use_slot(number)
	var result := await request(HTTPClient.METHOD_GET, "/ws/godot/saves/%d" % slot)
	if int(result.status) == 200 and result.json is Dictionary:
		cloud_revision = int(result.json.revision)
		store_cloud_state()
		return {"ok": true, "save": result.json.save, "revision": cloud_revision}
	return {"ok": false, "status": int(result.status)}

## Uploads the save. Returns {"ok": true, "revision": n} or {"ok": false, "conflict": true, "serverRevision": n} or {"ok": false}.
func cloud_push(save: Dictionary, base: int = -1, content_version: String = "") -> Dictionary:
	var base_revision := cloud_revision if base < 0 else base
	var body := {"baseRevision": base_revision, "save": save, "clientCode": KiNet.CLIENT_CODE}
	if content_version != "":
		body["contentVersion"] = content_version
	var result := await request(HTTPClient.METHOD_PUT, "/ws/godot/saves/%d" % slot, body, true, 30.0)
	if int(result.status) == 200 and result.json is Dictionary:
		cloud_revision = int(result.json.revision)
		store_cloud_state()
		return {"ok": true, "revision": cloud_revision}
	if int(result.status) == 409 and result.json is Dictionary:
		return {"ok": false, "conflict": true, "serverRevision": int(result.json.serverRevision)}
	last_error = message_of(result, "Zapis w chmurze nie powiódł się.")
	return {"ok": false, "status": int(result.status), "message": last_error}

# ---- presence (other players of the land, local chat) -----------------------------------------------

func live_url() -> String:
	return server.replace("https://", "wss://").replace("http://", "ws://") + "/ws/godot/live"

## Connects (or stays connected) and keeps the server informed of the hero's place; `payload` returns {race, land, level, x, y, facing}.
func start_live(payload: Callable) -> void:
	live_payload = payload
	if socket == null and logged_in():
		open_live()

func open_live() -> void:
	if access_token == "":
		return
	socket = WebSocketPeer.new()
	socket_open = false
	if socket.connect_to_url(live_url()) != OK:
		socket = null
		live_reconnect = 10.0

func close_live() -> void:
	if socket != null:
		socket.close(1000, "bye")
	socket = null
	if socket_open:
		live_state_changed.emit(false)
	socket_open = false
	if not peers.is_empty():
		peers = []
		peers_changed.emit(peers)

func say(text: String) -> void:
	if socket_open and text.strip_edges() != "":
		socket.send_text(JSON.stringify({"t": "chat", "text": text.strip_edges()}))

func _process(delta: float) -> void:
	if socket == null:
		if logged_in() and live_payload.is_valid() and live_reconnect > 0.0:
			live_reconnect -= delta
			if live_reconnect <= 0.0:
				open_live()
		return
	socket.poll()
	match socket.get_ready_state():
		WebSocketPeer.STATE_OPEN:
			if not socket_open:
				socket_open = true
				var hello: Dictionary = live_payload.call() if live_payload.is_valid() else {}
				hello["t"] = "hello"
				hello["token"] = access_token
				socket.send_text(JSON.stringify(hello))
				live_state_changed.emit(true)
			while socket.get_available_packet_count() > 0:
				handle_frame(socket.get_packet().get_string_from_utf8())
			live_timer -= delta
			if live_timer <= 0.0 and live_payload.is_valid():
				live_timer = 0.25
				var pos: Dictionary = live_payload.call()
				pos["t"] = "pos"
				socket.send_text(JSON.stringify(pos))
		WebSocketPeer.STATE_CLOSED:
			var code := socket.get_close_code()
			socket = null
			var was_open := socket_open
			socket_open = false
			if was_open:
				live_state_changed.emit(false)
			if not peers.is_empty():
				peers = []
				peers_changed.emit(peers)
			live_reconnect = 20.0 if code == 4000 else 6.0   # 4000: signed in on another device
			if code == 1008 and refresh_token != "":
				refresh()

func handle_frame(text: String) -> void:
	var frame: Variant = JSON.parse_string(text)
	if not frame is Dictionary:
		return
	match str(frame.get("t", "")):
		"peers":
			peers = frame.peers
			online_count = int(frame.get("online", 0))
			peers_changed.emit(peers)
		"chat":
			chat_received.emit(str(frame.nick), str(frame.text))
