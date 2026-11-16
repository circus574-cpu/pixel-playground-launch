extends Control
## Native, read-only staff overview. All data comes from protected server endpoints.
## No class_name: this file must load on the original APK through a downloaded core.
const Look := preload("res://scripts/look.gd")
signal closed

var net: PyraOnline
var frame := PanelContainer.new()
var body := Label.new()
var refresh_button: Button
var web_button: Button
var busy := false
var request_generation := 0

func setup(connection: PyraOnline) -> void:
	net = connection

func button(text: String, callback: Callable) -> Button:
	var item := Button.new()
	item.text = text
	item.custom_minimum_size = Vector2(180, 88)
	item.add_theme_font_size_override("font_size", 23)
	item.focus_mode = Control.FOCUS_NONE
	PyraSkin.style_button(item)
	item.pressed.connect(callback)
	return item

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = Color(0.01, 0.01, 0.02, 0.9)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(shade)
	frame.add_theme_stylebox_override("panel", Look.window(32))
	add_child(frame)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 12)
	frame.add_child(box)
	var heading := Label.new()
	heading.text = "PANEL GM · ANDROID"
	heading.add_theme_font_override("font", Look.title_font())
	heading.add_theme_font_size_override("font_size", 30)
	box.add_child(heading)
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	box.add_child(row)
	refresh_button = button("ODŚWIEŻ", refresh_data)
	row.add_child(refresh_button)
	web_button = button("KONSOLA WWW", open_web)
	row.add_child(web_button)
	row.add_child(button("WRÓĆ DO GRY", func(): closed.emit()))
	web_button.disabled = true
	var scroll := ScrollContainer.new()
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(scroll)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	body.add_theme_font_size_override("font_size", 25)
	body.add_theme_color_override("font_color", Color("f3dfb5"))
	scroll.add_child(body)
	net.session_changed.connect(account_changed)
	resized.connect(layout)
	layout()
	refresh_data.call_deferred()

func layout() -> void:
	var safe := Rect2(Vector2.ZERO, size)
	if OS.get_name() == "Android":
		var screen_safe := DisplayServer.get_display_safe_area()
		if screen_safe.has_area():
			safe = (get_tree().root.get_screen_transform().affine_inverse() * Rect2(screen_safe)).intersection(safe)
	frame.position = safe.position + Vector2(20, 16)
	frame.size = safe.size - Vector2(40, 32)

func account_changed() -> void:
	if not net.is_staff():
		request_generation += 1
		body.text = "Brak dostępu GM. Zaloguj się na konto z rolą GM lub administratora."
		web_button.disabled = true

func open_web() -> void:
	if net.is_staff() and not web_button.disabled:
		OS.shell_open(net.server + "/admin")

func refresh_data() -> void:
	if busy:
		return
	busy = true
	refresh_button.disabled = true
	web_button.disabled = true
	body.text = "Sprawdzanie uprawnień konta na serwerze…"
	request_generation += 1
	var generation := request_generation
	var account := net.account_id
	# Never fetch privileged data on the strength of a local role flag alone.
	if not await net.verify_staff():
		body.text = "Nie potwierdzono dostępu GM. Sprawdź połączenie i uprawnienia konta."
		finish_refresh()
		return
	if not valid_request(generation, account):
		finish_refresh()
		return
	var overview := await net.request(HTTPClient.METHOD_GET, "/ws/godot/admin/overview")
	if not valid_request(generation, account):
		finish_refresh()
		return
	if int(overview.status) != 200 or not overview.json is Dictionary:
		body.text = PyraOnline.message_of(overview, "Nie odczytano panelu GM (HTTP %d)." % int(overview.status))
		finish_refresh()
		return
	var saves := await net.request(HTTPClient.METHOD_GET, "/ws/godot/admin/saves")
	if not valid_request(generation, account):
		finish_refresh()
		return
	if int(saves.status) in [401, 403]:
		body.text = "Serwer odmówił dostępu. Odśwież uprawnienia lub zaloguj się ponownie."
		finish_refresh()
		return
	body.text = describe(overview.json, saves)
	web_button.disabled = false
	finish_refresh()

func valid_request(generation: int, account: String) -> bool:
	return is_inside_tree() and generation == request_generation and net.account_id == account and net.is_staff()

func finish_refresh() -> void:
	busy = false
	refresh_button.disabled = false

static func describe(data: Dictionary, saves: Dictionary) -> String:
	var settings: Dictionary = data.get("settings", {})
	var online: Dictionary = data.get("online", {})
	var stats: Dictionary = data.get("stats", {})
	var lines := PackedStringArray([
		"SERWER ANDROIDA",
		"Aktywna wersja: %s · przerwa techniczna: %s" % [str(settings.get("activeVersion", "brak danych")), "TAK" if bool(settings.get("maintenance", false)) else "NIE"],
		"Gracze online: %s" % str(online.get("count", "brak danych")),
		"Konta z zapisem: %s · zapisane sloty: %s" % [str(stats.get("accounts", "brak danych")), str(stats.get("saves", "brak danych"))],
		"", "KRAINY · GRACZE ONLINE"
	])
	var lands: Dictionary = online.get("byLand", {})
	if lands.is_empty():
		lines.append("Brak aktywnych krain w odpowiedzi serwera.")
	for land: String in lands:
		lines.append("%s: %s" % [land, str(lands[land])])
	lines.append("\nOSTATNIE ZAPISY W CHMURZE (maks. 200)")
	if int(saves.status) == 200 and saves.json is Dictionary and saves.json.get("saves") is Array:
		var entries: Array = saves.json.saves
		if entries.is_empty():
			lines.append("Brak zapisów.")
		for entry: Dictionary in entries:
			lines.append("%s · %s · poz. %s · %s · slot %s · rewizja %s" % [str(entry.get("nick", "?")), str(entry.get("race", "?")), str(entry.get("level", "?")), str(entry.get("land", "?")), str(entry.get("slot", "?")), str(entry.get("revision", "?"))])
	else:
		lines.append(PyraOnline.message_of(saves, "Nie odczytano listy zapisów (HTTP %d)." % int(saves.status)))
	lines.append("\nPanel w grze służy do podglądu. Pełne narzędzia administracyjne otwiera KONSOLA WWW; strona wymaga własnego logowania.")
	return "\n".join(lines)
