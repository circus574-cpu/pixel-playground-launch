class_name PyraGate
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)
const Service := preload("res://scripts/service_screen.gd")
## The way into the game on a device that carries only the base: sign in (or play offline), check the server (maintenance, minimum
## version), reconcile the cloud save with the local one, then download the content of the land the hero starts in. The same screen
## shows the progress when a land that is not on the device yet is entered later (`download_land`).

signal choice_made(index: int)

const SAVE_PATH := "user://city-checkpoint-v1.json"
const Characters := preload("res://scripts/characters.gd")
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
var dl_dock := PanelContainer.new()
var dl_title_lbl := Label.new()
var dl_speed_lbl := Label.new()
var dl_bar := ProgressBar.new()
var dl_bytes_lbl := Label.new()
var dl_meta_lbl := Label.new()

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
	panel.add_theme_stylebox_override("panel", Look.window(44.0))
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

	# Unified bottom forged loading dock (same layout & styling across boot, world packs & lands)
	var dock_sb := StyleBoxFlat.new()
	dock_sb.bg_color = Color(0.03, 0.035, 0.065, 0.92)
	dock_sb.border_color = Color(0.78, 0.62, 0.28, 0.88)
	dock_sb.set_border_width_all(2)
	dock_sb.set_corner_radius_all(14)
	dock_sb.content_margin_left = 24
	dock_sb.content_margin_right = 24
	dock_sb.content_margin_top = 14
	dock_sb.content_margin_bottom = 14
	dl_dock.name = "BottomDownloadDock"
	dl_dock.add_theme_stylebox_override("panel", dock_sb)
	dl_dock.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	dl_dock.z_index = 40
	dl_dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dl_dock.visible = false
	var dock_vb := VBoxContainer.new()
	dock_vb.add_theme_constant_override("separation", 7)
	dl_dock.add_child(dock_vb)
	var row_top := HBoxContainer.new()
	row_top.add_theme_constant_override("separation", 12)
	dl_title_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dl_title_lbl.add_theme_font_size_override("font_size", 19)
	dl_title_lbl.add_theme_color_override("font_color", Color("f4ead0"))
	dl_speed_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	dl_speed_lbl.add_theme_font_size_override("font_size", 20)
	dl_speed_lbl.add_theme_color_override("font_color", Color("ffd46a"))
	row_top.add_child(dl_title_lbl)
	row_top.add_child(dl_speed_lbl)
	dock_vb.add_child(row_top)
	var bar_bg := StyleBoxFlat.new()
	bar_bg.bg_color = Color(0.07, 0.09, 0.14, 0.96)
	bar_bg.border_color = Color(0.45, 0.36, 0.20, 0.85)
	bar_bg.set_border_width_all(1)
	bar_bg.set_corner_radius_all(8)
	var bar_fill := StyleBoxFlat.new()
	bar_fill.bg_color = Color(0.93, 0.72, 0.24, 1.0)
	bar_fill.set_corner_radius_all(7)
	dl_bar.add_theme_stylebox_override("background", bar_bg)
	dl_bar.add_theme_stylebox_override("fill", bar_fill)
	dl_bar.custom_minimum_size = Vector2(0, 18)
	dl_bar.show_percentage = false
	dock_vb.add_child(dl_bar)
	var row_bot := HBoxContainer.new()
	row_bot.add_theme_constant_override("separation", 12)
	dl_bytes_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dl_bytes_lbl.add_theme_font_size_override("font_size", 15)
	dl_bytes_lbl.add_theme_color_override("font_color", Color("d2d9e6"))
	dl_meta_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	dl_meta_lbl.add_theme_font_size_override("font_size", 14)
	dl_meta_lbl.add_theme_color_override("font_color", Color("9cb0cc"))
	row_bot.add_child(dl_bytes_lbl)
	row_bot.add_child(dl_meta_lbl)
	dock_vb.add_child(row_bot)
	add_child(dl_dock)
	_layout_dl_dock()
	resized.connect(_layout_dl_dock)

func _layout_dl_dock() -> void:
	var left_pad := 36.0
	var right_pad := 36.0
	var bot_pad := 22.0
	if OS.get_name() == "Android" and get_tree() != null and get_tree().root != null:
		var safe := DisplayServer.get_display_safe_area()
		if safe.has_area() and size.x > 0.0 and size.y > 0.0:
			var local_safe := (get_tree().root.get_screen_transform().affine_inverse() * Rect2(safe)).intersection(Rect2(Vector2.ZERO, size))
			left_pad = maxf(36.0, local_safe.position.x + 18.0)
			right_pad = maxf(36.0, size.x - local_safe.end.x + 18.0)
			bot_pad = maxf(22.0, size.y - local_safe.end.y + 14.0)
	dl_dock.offset_left = left_pad
	dl_dock.offset_right = -right_pad
	dl_dock.offset_bottom = -bot_pad
	dl_dock.offset_top = -(bot_pad + 96.0)

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

static func _fmt_speed(bps: float) -> String:
	if bps >= 1048576.0:
		return "%.2f MB/s" % (bps / 1048576.0)
	if bps >= 1024.0:
		return "%.0f KB/s" % (bps / 1024.0)
	return "0 KB/s"

static func _fmt_streams(count: int) -> String:
	var n := maxi(1, count)
	return "1 wątek · bez limitu" if n == 1 else "%d wątki równolegle · bez limitu" % n

# ---- boot ---------------------------------------------------------------------------------------------

## Returns true when the game may start (the start land's content is mounted), false when the player gave up.
func run_boot() -> bool:

	while true:
		var signed_in := false
		if KiNet.online().logged_in():
			say("KI LEGENDS", "Logowanie…")
			signed_in = await KiNet.online().resume()
		if not signed_in and not offline_mode:
			var service_action:=await service_entry()
			if service_action=="quit":return false
			var mode := await login_form(service_action!="login")
			if mode == "quit":
				return false
			signed_in = mode == "login"
			offline_mode = mode == "offline"
		if signed_in:
			var service_action:=await service_entry()
			if service_action=="quit":return false
			if service_action=="login":
				await login_form(false)
				continue
		var reached := false
		if not offline_mode or KiNet.online().logged_in():
			say("KI LEGENDS", "Łączenie z serwerem…")
			var m := await KiNet.content().fetch_manifest()
			reached = bool(m.ok)
			if not reached:
				if bool(m.get("blocked", false)):
					var again := await offer_message("Serwer", str(m.message), ["SPRÓBUJ PONOWNIE", "WYJDŹ"])
					if again == 0:
						continue
					return false
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

func service_entry() -> String:
	var screen:=Service.new()
	screen.request=KiNet.online().request
	panel.hide()
	add_child(screen)
	var action: String=await screen.run()
	screen.queue_free()
	panel.show()
	return action

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

func login_form(allow_offline: bool = true) -> String:
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
		if allow_offline and offline_possible():
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

## Compares the cloud saves of the account (one per character, slots 1..3) with this device's characters: a cloud save with no character here
## becomes a character here; a character whose cloud save changed elsewhere asks the player which one to keep.
func reconcile_cloud() -> void:
	var online := KiNet.online()
	say("KI LEGENDS", "Sprawdzam zapisy w chmurze…")
	var listed := await online.cloud_list()
	if not bool(listed.ok) or (listed.saves as Array).is_empty():
		return
	var roster := Characters.list()
	# the single save of the releases before 1.13 was cloud slot 1: the character this device played belongs to it
	if not roster.any(func(e: Dictionary) -> bool: return int(e.cloudSlot) > 0) and local_save_exists():
		var active_id := str(Characters.read(SAVE_PATH).get("characterId", ""))
		if active_id != "":
			Characters.set_cloud_slot(active_id, 1)
			roster = Characters.list()
	for row: Dictionary in listed.saves:
		var slot := int(row.slot)
		var owner: Dictionary = {}
		for entry in roster:
			if int(entry.cloudSlot) == slot:
				owner = entry
		var known_revision := int(online.revisions.get(slot, 0))
		if owner.is_empty():
			await take_cloud_character(slot)
		elif int(row.revision) != known_revision:
			var text := "Zapis w chmurze postaci (%s, slot %d: poziom %d, kraina %s, %s) różni się od zapisu na tym urządzeniu (poziom %d). Który zachować?" % [str(owner.race), slot, int(row.level), str(row.land), str(row.updatedAt).replace("T", " ").substr(0, 16), int(owner.level)]
			if await offer_message("Zapis w chmurze", text, ["UŻYJ ZAPISU Z CHMURY", "ZACHOWAJ TEN Z URZĄDZENIA"]) == 0:
				await take_cloud_character(slot, str(owner.id))
			else:
				online.use_slot(slot)
				online.cloud_revision = int(row.revision)   # the next upload deliberately replaces the cloud save
				online.store_cloud_state()

## Reads the cloud save of the slot into this device: as the character `id`, or (no id) as a new character; when the device had no active save, it becomes the active one.
func take_cloud_character(slot: int, id: String = "") -> void:
	var pulled := await KiNet.online().cloud_pull(slot)
	if not bool(pulled.ok) or not pulled.save is Dictionary:
		return
	var save: Dictionary = pulled.save
	if id == "":
		id = str(save.get("characterId", ""))
		if id == "" or FileAccess.file_exists(Characters.slot_path(id)):
			id = Characters.new_id()
	save["characterId"] = id
	save["cloudSlot"] = slot
	Characters.write(Characters.slot_path(id), save)
	if not local_save_exists() or str(Characters.read(SAVE_PATH).get("characterId", "")) == id:
		write_local_save(save)

# ---- content ------------------------------------------------------------------------------------------

func _apply_download_progress(title_prefix: String, info: Dictionary) -> void:
	var total_b := maxf(1.0, float(info.get("total", 1)))
	var done_b := clampf(float(info.get("done", 0)), 0.0, total_b)
	var pct := int(clampf(100.0 * done_b / total_b, 0.0, 100.0))
	var idx := int(info.get("index", 1))
	var cnt := maxi(1, int(info.get("count", 1)))
	var bps := float(info.get("bps", 0.0))
	var streams := int(info.get("streams", 1))
	dl_bar.max_value = total_b
	dl_bar.value = done_b
	dl_title_lbl.text = "%s (%d/%d)…" % [title_prefix, mini(idx, cnt), cnt]
	dl_speed_lbl.text = "⚡ %s" % _fmt_speed(bps)
	dl_bytes_lbl.text = "%s / %s · %d%%" % [megabytes(int(done_b)), megabytes(int(total_b)), pct]
	dl_meta_lbl.text = _fmt_streams(streams)

## Downloads and mounts a set of packs with the unified bottom loading dock. Returns {"ok", "message"}.
func download_packs(ids: Array, title_prefix: String = "Pobieranie zasobów świata") -> Dictionary:
	var content := KiNet.content()
	form.visible = false
	bar.visible = false
	var need := content.bytes_to_download(ids)
	panel.hide()
	_layout_dl_dock()
	dl_dock.visible = true
	dl_bar.max_value = maxf(1.0, float(need))
	dl_bar.value = 0.0
	dl_title_lbl.text = "%s…" % title_prefix
	dl_speed_lbl.text = "⚡ 0 KB/s"
	dl_bytes_lbl.text = "0.0 MB / %s · 0%%" % megabytes(need)
	dl_meta_lbl.text = _fmt_streams(mini(4, maxi(1, ids.size())))
	var handler := func(info: Dictionary) -> void:
		_apply_download_progress(title_prefix, info)
	content.progress.connect(handler)
	var result := await content.ensure(ids)
	content.progress.disconnect(handler)
	dl_dock.visible = false
	panel.show()
	if not bool(result.ok):
		detail.text = str(result.get("message", ""))
	return result

## Downloads and mounts what the land needs, with the unified bottom loading dock. Returns true when the land can be entered.
func download_land(land: String) -> bool:
	var content := KiNet.content()
	form.visible = false
	var missing := content.missing_for(land)
	if missing.is_empty():
		return true
	var result := await download_packs(content.packs_for_land(land), "Pobieranie danych krainy")
	return bool(result.ok)
