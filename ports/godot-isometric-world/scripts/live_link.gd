extends Node
## Transport for authenticated isometric presence. The launcher owns the account session.

signal peers_received(frame: Dictionary)
signal chat_received(frame: Dictionary)
signal profile_received(frame: Dictionary)
signal status_changed(connected: bool, message: String)

var auth: Callable
var refresh_auth: Callable
var payload: Callable
var character_id := ""
var peer_id := ""
var connected := false

var _socket: WebSocketPeer
var _hello_sent := false
var _wait := 0.0
var _since_connect := 0.0
var _publish_in := 0.0
var _retry_delay := 1.0
var _refreshing := false
var _stopped := false

func _process(delta: float) -> void:
	if _stopped:
		return
	if _socket == null:
		_wait -= delta
		if _wait <= 0.0 and not _refreshing:
			_connect()
		return
	_socket.poll()
	_since_connect += delta
	if _socket.get_ready_state() == WebSocketPeer.STATE_CLOSED:
		_lost(_socket.get_close_code())
		return
	if not connected and _since_connect > 10.0:
		_socket.close()
		_lost(0)
		return
	if _socket.get_ready_state() != WebSocketPeer.STATE_OPEN:
		return
	if not _hello_sent:
		var session: Dictionary = auth.call()
		var token := str(session.get("token", ""))
		if token.is_empty():
			_socket.close()
			_lost(0)
			return
		_hello_sent = _send({"t": "hello", "protocol": 2, "token": token, "characterId": character_id})
	for _i in mini(_socket.get_available_packet_count(), 32):
		var decoded: Variant = JSON.parse_string(_socket.get_packet().get_string_from_utf8())
		if decoded is Dictionary:
			_receive(decoded)
	if connected:
		_publish_in -= delta
		if _publish_in <= 0.0 and payload.is_valid():
			_publish_in = 0.25
			var snapshot: Dictionary = payload.call()
			snapshot["t"] = "pos"
			_send(snapshot)

func _connect() -> void:
	if not auth.is_valid() or not payload.is_valid() or character_id.is_empty():
		_stopped = true
		return
	var session: Dictionary = auth.call()
	var url := str(session.get("url", ""))
	if url.is_empty() or str(session.get("token", "")).is_empty():
		_wait = 3.0
		return
	var next := WebSocketPeer.new()
	next.inbound_buffer_size = 65536
	next.outbound_buffer_size = 32768
	if next.connect_to_url(url) != OK:
		_lost(0)
		return
	_socket = next
	_hello_sent = false
	_since_connect = 0.0

func _lost(code: int) -> void:
	_socket = null
	peer_id = ""
	connected = false
	_wait = _retry_delay
	_retry_delay = minf(_retry_delay * 2.0, 15.0)
	if code == 4000:
		_stopped = true
		status_changed.emit(false, "Gra na żywo otwarta na innym urządzeniu.")
		return
	status_changed.emit(false, "Ponowne łączenie…")
	if code == 1008 and refresh_auth.is_valid() and not _refreshing:
		_refreshing = true
		refresh_auth.call(func() -> void: _refreshing = false)

func _receive(frame: Dictionary) -> void:
	match str(frame.get("t", "")):
		"hello_ok":
			if int(frame.get("protocol", 0)) != 2:
				_socket.close()
				_stopped = true
				status_changed.emit(false, "Serwer nie obsługuje jeszcze gry na żywo.")
				return
			connected = true
			peer_id = str(frame.get("id", ""))
			_retry_delay = 1.0
			_publish_in = 0.16
			status_changed.emit(true, "Połączono")
		"peers":
			if connected:
				peers_received.emit(frame)
		"chat":
			if connected:
				chat_received.emit(frame)
		"profile":
			if connected:
				profile_received.emit(frame)
		"notice":
			if connected:
				status_changed.emit(true, str(frame.get("message", "")))

func _send(frame: Dictionary) -> bool:
	return _socket != null and _socket.get_ready_state() == WebSocketPeer.STATE_OPEN and _socket.send_text(JSON.stringify(frame)) == OK

func send_chat(scope: String, text: String, to: String = "") -> bool:
	if not connected or text.strip_edges().is_empty():
		return false
	var frame := {"t": "chat", "scope": scope, "text": text.strip_edges().left(120)}
	if scope == "whisper":
		frame["to"] = to.strip_edges()
	return _send(frame)

func inspect_peer(id: String) -> void:
	if connected:
		_send({"t": "inspect", "id": id})

func _exit_tree() -> void:
	if _socket != null:
		_socket.close(1000, "world exit")
		_socket.poll()
		_socket = null
