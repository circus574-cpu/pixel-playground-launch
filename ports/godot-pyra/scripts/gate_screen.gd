class_name PyraGate
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)
## The way into the game on a device that carries only the base: sign in (or play offline), check the server (maintenance, minimum
## version), reconcile the cloud save with the local one, then download the content of the land the hero starts in. The same screen
## shows the progress when a land that is not on the device yet is entered later (`download_land`).

signal choice_made(index: int)

const SAVE_PATH := "user://city-checkpoint-v1.json"
const LOGIN_PATH := "user://login.json"   # what "Zapamiętaj mnie" keeps: the e-mail for the next sign-in form (the session itself is in user://account.json)

var panel := PanelContainer.new()
var box := VBoxContainer.new()
var heading := Label.new()
var message := Label.new()
var form := VBoxContainer.new()
var buttons := HBoxContainer.new()
var bar := ProgressBar.new()
var detail := Label.new()
var email_field := LineEdit.new()
var password_field := LineEdit.new()
var nick_field := LineEdit.new()
var remember_box := CheckBox.new()
var show_box := CheckBox.new()
var offline_mode := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.025, 0.04, 0.6)   # the title picture stays visible behind the sign-in window
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.grow_horizontal = Control.GROW_DIRECTION_BOTH   # it grows from the middle of the screen, not from its top-left corner
	panel.grow_vertical = Control.GROW_DIRECTION_BOTH
	panel.custom_minimum_size = Vector2(700, 0)
	panel.add_theme_stylebox_override("panel", Look.window(30.0))
	add_child(panel)
	panel.add_child(box)
	box.add_theme_constant_override("separation", 8)
	heading.add_theme_font_override("font", Look.title_font())
	heading.add_theme_font_size_override("font_size", 34)
	heading.add_theme_color_override("font_color", Color.WHITE)   # the letters carry their own gold
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(heading)
	message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	message.add_theme_font_size_override("font_size", 18)
	message.add_theme_color_override("font_color", Color("e6dcc4"))
	message.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(message)
	box.add_child(form)
	form.add_theme_constant_override("separation", 8)
	for pair in [[email_field, "E-mail", false], [nick_field, "Nick (tylko przy zakładaniu konta)", false], [password_field, "Hasło", true]]:
		var field: LineEdit = pair[0]
		field.placeholder_text = pair[1]
		field.secret = pair[2]
		field.custom_minimum_size = Vector2(0, 46)
		field.add_theme_font_size_override("font_size", 20)
		form.add_child(field)
	remember_box.text = "Zapamiętaj mnie"
	remember_box.button_pressed = true
	remember_box.focus_mode = Control.FOCUS_NONE
	remember_box.add_theme_font_size_override("font_size", 19)
	remember_box.add_theme_color_override("font_color", Color("e6dcc4"))
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		remember_box.add_theme_stylebox_override(state, StyleBoxEmpty.new())   # a check box, not a button: no pill behind it
	form.add_child(remember_box)
	show_box.text = "Pokaż hasło"
	show_box.focus_mode = Control.FOCUS_NONE
	show_box.add_theme_font_size_override("font_size", 19)
	for state in ["normal", "hover", "pressed", "hover_pressed", "disabled", "focus"]:
		show_box.add_theme_stylebox_override(state, StyleBoxEmpty.new())
	show_box.toggled.connect(func(on: bool) -> void: password_field.secret = not on)   # to see what the phone's keyboard really typed
	form.add_child(show_box)
	nick_field.visible = false
	bar.custom_minimum_size = Vector2(0, 26)
	bar.show_percentage = false
	bar.visible = false
	box.add_child(bar)
	detail.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	detail.add_theme_font_size_override("font_size", 15)
	detail.add_theme_color_override("font_color", Color("b8b09c"))
	detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	box.add_child(detail)
	buttons.alignment = BoxContainer.ALIGNMENT_CENTER
	buttons.add_theme_constant_override("separation", 12)
	box.add_child(buttons)
	form.visible = false

func say(title: String, text: String, extra: String = "") -> void:
	heading.text = title
	message.text = text
	detail.text = extra

func offer(options: Array) -> int:
	for child in buttons.get_children():
		child.queue_free()
	var index := 0
	for text: String in options:
		var button := Button.new()
		button.text = text
		button.custom_minimum_size = Vector2(190, 56)
		button.add_theme_font_size_override("font_size", 18)
		button.pressed.connect(func(i := index) -> void: choice_made.emit(i))
		buttons.add_child(button)
		index += 1
	var picked: int = await choice_made
	for child in buttons.get_children():
		child.queue_free()
	return picked

func megabytes(bytes: int) -> String:
	return "%.1f MB" % (float(bytes) / 1048576.0)

# ---- boot ---------------------------------------------------------------------------------------------

## Returns true when the game may start (the start land's content is mounted), false when the player gave up.
func run_boot() -> bool:

	while true:
		var signed_in := false
		if KiNet.online().logged_in():
			say("KI LEGENDS", "Logowanie…")
			signed_in = await KiNet.online().resume()
		if not signed_in and not offline_mode:
			var mode := await login_form()
			if mode == "quit":
				return false
			signed_in = mode == "login"
			offline_mode = mode == "offline"
		var reached := false
		if not offline_mode or KiNet.online().logged_in():
			say("KI LEGENDS", "Łączenie z serwerem…")
			var m := await KiNet.content().fetch_manifest()
			reached = bool(m.ok)
			if not reached:
				if bool(m.get("blocked", false)):
					var again := await offer_message("Serwer", str(m.message), ["SPRÓBUJ PONOWNIE", "GRAJ OFFLINE"] if offline_possible() else ["SPRÓBUJ PONOWNIE"])
					if again == 0:
						continue
					offline_mode = true
				elif not KiNet.content().has_manifest():
					var retry := await offer_message("Brak połączenia", str(m.message) + "\nPierwsze uruchomienie wymaga internetu, aby pobrać grę.", ["SPRÓBUJ PONOWNIE", "WYJDŹ"])
					if retry == 0:
						continue
					return false
				else:
					offline_mode = true
		if signed_in and reached:
			await reconcile_cloud()
			KiNet.content().prune()
		var land := start_land()
		var ok := await download_land(land)
		if ok:
			return true
		var next := await offer_message("Pobieranie", "Nie udało się przygotować gry.", ["SPRÓBUJ PONOWNIE", "WYJDŹ"])
		if next != 0:
			return false
	return false

func offline_possible() -> bool:
	return PyraContent.embedded() or all_cached(start_land())

func all_cached(land: String) -> bool:
	for id: String in KiNet.content().packs_for_land(land):
		if not KiNet.content().present(id) and not KiNet.content().cached(id):
			return false
	return KiNet.content().has_manifest() and not KiNet.content().packs_for_land(land).is_empty()

func offer_message(title: String, text: String, options: Array) -> int:
	form.visible = false
	bar.visible = false
	say(title, text)
	return await offer(options)

## The land the hero opens in: the land of the local checkpoint, otherwise Pyra.
func start_land() -> String:
	if FileAccess.file_exists(SAVE_PATH):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
		if value is Dictionary and PyraGame.ALL_LANDS.has(str(value.get("land", ""))):
			return str(value.land)
	return "pyra"

static func read_login_prefs() -> Dictionary:
	if FileAccess.file_exists(LOGIN_PATH):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(LOGIN_PATH))
		if value is Dictionary:
			return value
	return {}

## "Zapamiętaj mnie" on: the e-mail is kept for the next form; off: nothing stays on the device.
static func write_login_prefs(email: String, remember_me: bool) -> void:
	if not remember_me:
		if FileAccess.file_exists(LOGIN_PATH):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(LOGIN_PATH))
		return
	var file := FileAccess.open(LOGIN_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({"email": email, "remember": true}))
		file.close()

func login_form() -> String:
	var online := KiNet.online()
	form.visible = true
	var prefs := read_login_prefs()
	remember_box.button_pressed = bool(prefs.get("remember", true))
	if email_field.text == "":
		email_field.text = str(prefs.get("email", ""))
	bar.visible = false
	var registering := false
	while true:
		nick_field.visible = registering
		say("KI LEGENDS ONLINE", "Zaloguj się kontem Ki Legends (to samo konto co w przeglądarce)." if not registering else "Załóż konto: dostaniesz e-mail z linkiem aktywacyjnym.", "Serwer: " + online.server)
		var labels := ["ZALOGUJ", "UTWÓRZ KONTO" if not registering else "MAM KONTO"]
		if offline_possible():
			labels.append("GRAJ OFFLINE")
		var pick := await offer(labels)
		if pick == 1:
			registering = not registering
			continue
		if pick == 2:
			form.visible = false
			return "offline"
		var email := email_field.text.strip_edges()
		var password := password_field.text
		if email == "" or password == "":
			detail.text = "Podaj e-mail i hasło."
			continue
		say("KI LEGENDS ONLINE", "Chwileczkę…", "Serwer: " + online.server)
		if registering:
			var made := await online.register(email, password, nick_field.text.strip_edges())
			var ok := int(made.status) == 201
			say("KI LEGENDS ONLINE", "Konto utworzone. Kliknij link w e-mailu aktywacyjnym i zaloguj się." if ok else PyraOnline.message_of(made, "Nie udało się założyć konta."))
			if ok:
				registering = false
			await get_tree().create_timer(1.8).timeout
			continue
		online.remember = remember_box.button_pressed
		var result := await online.login(email, password)
		# a phone keyboard likes to add a space after a word: when the password as typed is refused, try it once without spaces at the ends
		if int(result.status) == 401 and password.strip_edges() != password:
			result = await online.login(email, password.strip_edges())
		if int(result.status) == 200:
			write_login_prefs(email, remember_box.button_pressed)
			form.visible = false
			password_field.text = ""
			return "login"
		# what the app really sent (never the password itself, only its length), so a refused sign-in can be explained instead of guessed at
		var sent := "Serwer: %s · odpowiedź %d · wysłano e-mail „%s” (%d znaków) i hasło z %d znaków" % [online.server, int(result.status), email, email.length(), password.length()]
		say("KI LEGENDS ONLINE", PyraOnline.message_of(result, "Logowanie nie powiodło się."), sent)
		await get_tree().create_timer(6.0).timeout   # long enough to read what was sent
	return "quit"

# ---- cloud save ---------------------------------------------------------------------------------------

func local_save_exists() -> bool:
	return FileAccess.file_exists(SAVE_PATH)

func write_local_save(save: Dictionary) -> bool:
	var file := FileAccess.open(SAVE_PATH + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(save))
	file.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(SAVE_PATH + ".tmp"), ProjectSettings.globalize_path(SAVE_PATH)) == OK

## Compares the cloud save with this device's: a missing local save takes the cloud one; a different revision asks the player.
func reconcile_cloud() -> void:
	var online := KiNet.online()
	say("KI LEGENDS", "Sprawdzam zapis w chmurze…")
	var summary := await online.cloud_summary()
	if not bool(summary.ok) or (summary.save as Dictionary).is_empty():
		return
	var cloud: Dictionary = summary.save
	if int(cloud.revision) == online.cloud_revision and local_save_exists():
		return
	var take_cloud := not local_save_exists()
	if not take_cloud:
		var text := "Na tym koncie jest zapis w chmurze (poziom %d, kraina %s, %s), a to urządzenie ma inny zapis. Który zachować?" % [int(cloud.level), str(cloud.land), str(cloud.updatedAt).replace("T", " ").substr(0, 16)]
		take_cloud = await offer_message("Zapis w chmurze", text, ["UŻYJ ZAPISU Z CHMURY", "ZACHOWAJ TEN Z URZĄDZENIA"]) == 0
	if take_cloud:
		var pulled := await online.cloud_pull()
		if bool(pulled.ok):
			write_local_save(pulled.save)
	else:
		online.cloud_revision = int(cloud.revision)   # the next upload deliberately replaces the cloud save
		online.store_cloud_state()

# ---- content ------------------------------------------------------------------------------------------

## Downloads and mounts what the land needs, with a progress bar. Returns true when the land can be entered.
func download_land(land: String) -> bool:
	var content := KiNet.content()
	form.visible = false
	var missing := content.missing_for(land)
	if missing.is_empty():
		return true
	var need := content.bytes_to_download(missing)
	say("Pobieranie świata", "Potrzebne dane krainy: %s" % megabytes(need) if need > 0 else "Wczytywanie danych krainy…")
	bar.visible = true
	bar.max_value = maxf(1.0, float(need))
	bar.value = 0.0
	var handler := func(info: Dictionary) -> void:
		bar.max_value = maxf(1.0, float(info.total))
		bar.value = float(info.done)
		detail.text = "%s · %d/%d · %s z %s" % [str(info.pack), int(info.index), int(info.count), megabytes(int(info.done)), megabytes(int(info.total))]
	content.progress.connect(handler)
	var result := await content.ensure_land(land)
	content.progress.disconnect(handler)
	bar.visible = false
	if not bool(result.ok):
		detail.text = str(result.get("message", ""))
		return false
	return true
