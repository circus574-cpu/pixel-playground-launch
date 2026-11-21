extends Control
## Uses the normal authenticated HTTP transport, never a local GM flag. Preview is a disposable private World2D.
signal picked(action: String)
const SCENE := "res://service_preview/pyra/world.tscn"
const FORGED_BASE := "res://service_preview/pyra/assets/ui/forged/"
const MENU_MUSIC_PATHS := ["res://service_preview/pyra/assets/audio/music/menu.mp3", "res://assets/audio/music/menu.mp3"]
const AUDIO_PREFS_PATH := "user://audio.json"
const Look := preload("res://scripts/look.gd")

var request: Callable
var allowed := false
var preview: SubViewportContainer
var world: Node2D
var close_button: Button
var page_card := PanelContainer.new()
var page := VBoxContainer.new()
var caption := Label.new()
var timer := Timer.new()
var checking := false
var full_mode := false
var char_id := ""
var server_chars: Dictionary = {}
var active_server_char: Dictionary = {}
var char_view: Node
var autosave := Timer.new()
var menu_music := AudioStreamPlayer.new()
var _tex_cache: Dictionary = {}
const HOME := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}

func _load_tex(path: String) -> Texture2D:
	if _tex_cache.has(path):
		return _tex_cache[path] as Texture2D
	if ResourceLoader.exists(path):
		var loaded := load(path)
		if loaded is Texture2D:
			_tex_cache[path] = loaded
			return loaded
	if FileAccess.file_exists(path):
		var bytes := FileAccess.get_file_as_bytes(path)
		if not bytes.is_empty():
			var img := Image.new()
			if img.load_webp_from_buffer(bytes) == OK:
				var tex := ImageTexture.create_from_image(img)
				_tex_cache[path] = tex
				return tex
	return null

func _forged_panel(pad_x: float = 40.0, pad_y: float = 34.0) -> StyleBox:
	var tex := _load_tex(FORGED_BASE + "panel_forged.webp")
	var cx := maxf(pad_x, 38.0)
	var cy := maxf(pad_y, 34.0)
	if tex == null:
		return Look.window(cx)
	var sb := StyleBoxTexture.new()
	sb.texture = tex
	sb.texture_margin_left = 38.0
	sb.texture_margin_right = 38.0
	sb.texture_margin_top = 38.0
	sb.texture_margin_bottom = 38.0
	sb.content_margin_left = cx
	sb.content_margin_right = cx
	sb.content_margin_top = cy
	sb.content_margin_bottom = cy
	return sb

func _style_forged_btn(btn: Button, variant: String = "slate", font_sz: int = 20) -> void:
	btn.focus_mode = Control.FOCUS_NONE
	var fname := "btn_forged_gold.webp" if variant == "gold" else ("btn_forged_crimson.webp" if variant == "crimson" else "btn_forged_slate.webp")
	var tex := _load_tex(FORGED_BASE + fname)
	for st_name in ["normal", "hover", "pressed", "disabled"]:
		if tex != null:
			var sb := StyleBoxTexture.new()
			sb.texture = tex
			sb.texture_margin_left = 44.0
			sb.texture_margin_right = 44.0
			sb.texture_margin_top = 16.0
			sb.texture_margin_bottom = 16.0
			sb.content_margin_left = 24.0
			sb.content_margin_right = 24.0
			sb.content_margin_top = 8.0
			sb.content_margin_bottom = 8.0
			if st_name == "hover":
				sb.modulate_color = Color(1.15, 1.13, 1.08, 1.0)
			elif st_name == "pressed":
				sb.modulate_color = Color(0.84, 0.80, 0.76, 1.0)
			btn.add_theme_stylebox_override(st_name, sb)
		else:
			btn.add_theme_stylebox_override(st_name, PyraSkin.button_box(st_name, 20.0, 8.0))
	btn.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	var use_gold_bmp := (variant == "gold") and not ("←" in btn.text)
	if use_gold_bmp:
		btn.add_theme_font_override("font", Look.title_font())
		btn.add_theme_color_override("font_color", Color.WHITE)
	else:
		btn.add_theme_font_override("font", ThemeDB.fallback_font)
		btn.add_theme_color_override("font_color", Color("fff4d6") if variant == "gold" else Color("f4ece0"))
	btn.add_theme_font_size_override("font_size", font_sz)
	btn.add_theme_color_override("font_hover_color", Color.WHITE)
	btn.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.01, 0.96))
	btn.add_theme_constant_override("outline_size", 4)

func _read_audio_prefs() -> Dictionary:
	var prefs := {"music": 0.35, "sfx": 0.70}
	if FileAccess.file_exists(AUDIO_PREFS_PATH):
		var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(AUDIO_PREFS_PATH))
		if v is Dictionary:
			prefs["music"] = clampf(float((v as Dictionary).get("music", 0.35)), 0.0, 1.0)
			prefs["sfx"] = clampf(float((v as Dictionary).get("sfx", 0.70)), 0.0, 1.0)
	return prefs

func _on_world_audio_changed(music_v: float, sfx_v: float) -> void:
	var f := FileAccess.open(AUDIO_PREFS_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify({"music": clampf(music_v, 0.0, 1.0), "sfx": clampf(sfx_v, 0.0, 1.0)}))
		f.close()

func _silence_external_music() -> void:
	# Stop any legacy loading music (PyraAudio / TitleScreen) so loadings.mp3 NEVER plays over menu or gameplay!
	if get_tree() == null or get_tree().root == null:
		return
	var stack: Array[Node] = [get_tree().root]
	while not stack.is_empty():
		var cur: Node = stack.pop_back()
		if cur == self or is_ancestor_of(cur):
			continue
		if cur is AudioStreamPlayer:
			(cur as AudioStreamPlayer).stop()
		if cur.has_method("stop_menu_music"):
			cur.call("stop_menu_music")
		for ch in cur.get_children():
			stack.append(ch)

func _start_menu_music() -> void:
	_silence_external_music()
	var prefs := _read_audio_prefs()
	var mv := float(prefs["music"])
	if mv <= 0.01:
		menu_music.stop()
		return
	if menu_music.stream == null:
		for p in MENU_MUSIC_PATHS:
			if ResourceLoader.exists(p):
				var s := load(p)
				if s is AudioStream:
					menu_music.stream = s
					break
			if FileAccess.file_exists(p):
				var mp3 := AudioStreamMP3.new()
				mp3.data = FileAccess.get_file_as_bytes(p)
				mp3.loop = true
				menu_music.stream = mp3
				break
	if menu_music.stream is AudioStreamMP3:
		(menu_music.stream as AudioStreamMP3).loop = true
	menu_music.volume_db = linear_to_db(maxf(mv * 0.72, 0.0001))
	if menu_music.stream != null and not menu_music.playing:
		menu_music.play()

func _stop_menu_music() -> void:
	if menu_music.playing:
		menu_music.stop()

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(menu_music)
	_start_menu_music.call_deferred()

	var back := ColorRect.new()
	back.color = Color(0.025, 0.02, 0.035, 1.0)
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(back)
	page_card.name = "PageCard"
	page_card.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	page_card.grow_horizontal = Control.GROW_DIRECTION_BOTH
	page_card.grow_vertical = Control.GROW_DIRECTION_BOTH
	page_card.custom_minimum_size = Vector2(660, 0)
	page_card.add_theme_stylebox_override("panel", _forged_panel(46.0, 40.0))
	add_child(page_card)
	page.add_theme_constant_override("separation", 16)
	page_card.add_child(page)
	var title := Label.new()
	title.text = "KI LEGENDS"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	Look.style_heading(title, 34)
	page.add_child(title)
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	caption.add_theme_font_size_override("font_size", 19)
	caption.add_theme_color_override("font_color", Color("e6dac2"))
	page.add_child(caption)
	timer.wait_time = 3
	timer.timeout.connect(refresh_access)
	add_child(timer)
	resized.connect(layout_preview)
	set_process_unhandled_key_input(true)

func read_status() -> Dictionary:
	if not request.is_valid(): return {}
	var result: Dictionary = await request.call(HTTPClient.METHOD_GET, "/ws/godot/status", null, true, 8.0)
	if int(result.get("status", 0)) != 200 or not result.get("json") is Dictionary: return {}
	return result.json

static func permits_preview(status: Dictionary) -> bool:
	return status.get("maintenance") == true and status.get("canPreview") == true and status.get("canEnter") == true

func run() -> String:
	caption.text = "Sprawdzanie dostępu…"
	var status := await read_status()
	if status.get("maintenance") == false and status.get("canEnter") == true:
		if ResourceLoader.exists(SCENE):
			open_world(true)
			timer.start()
			return await picked
		return "continue"
	show_status(status)
	timer.start()
	return await picked

func show_status(status: Dictionary) -> void:
	allowed = permits_preview(status)
	caption.text = "Podgląd administratora. Ta scena nie zmienia zapisów postaci." if allowed else str(status.get("message", "Nie można sprawdzić serwera. Spróbuj ponownie."))
	for child in page.get_children():
		if child is Button: child.queue_free()
	if allowed:
		button("WEJDŹ DO GRY", func(): open_world(true), "gold")
		button("PROTOTYP IZOMETRYCZNY · PYRA", open_preview, "slate")
	else:
		button("ZALOGUJ SIĘ", func(): picked.emit("login"), "gold")
	button("SPRAWDŹ PONOWNIE", refresh_access, "slate")
	button("ZAMKNIJ", func(): picked.emit("quit"), "crimson")

func button(text: String, action: Callable, variant: String = "slate") -> void:
	var control := Button.new()
	control.text = text
	control.custom_minimum_size = Vector2(540, 68)
	_style_forged_btn(control, variant, 20)
	control.pressed.connect(action)
	page.add_child(control)

func refresh_access() -> void:
	if checking: return
	checking = true
	var status := await read_status()
	checking = false
	if not is_inside_tree(): return
	if preview != null and not full_mode and not permits_preview(status): close_preview()
	if status.get("maintenance") == false and status.get("canEnter") == true:
		if preview == null and char_view == null:
			if ResourceLoader.exists(SCENE): open_world(true)
			else: picked.emit("continue")
		return
	show_status(status)

func open_preview() -> void:
	if checking or preview != null: return
	checking = true
	var status := await read_status()
	checking = false
	if not permits_preview(status):
		show_status(status)
		return
	open_world(false)

func open_world(full: bool) -> void:
	if preview != null or char_view != null: return
	if full:
		_start_menu_music()
		var chosen: String = await choose_character()
		if chosen == "":
			return
		char_id = chosen
	spawn_world(full)

func choose_character() -> String:
	var Chars = load("res://scripts/characters.gd")
	var online = KiNet.online()
	server_chars.clear()
	active_server_char = {}
	var legacy_server: Dictionary = {}
	var use_authoritative := false
	if online.logged_in():
		var auth_ans: Dictionary = await online.request(HTTPClient.METHOD_GET, "/ws/godot/characters")
		if int(auth_ans.get("status", 0)) == 200 and auth_ans.get("json") is Dictionary:
			use_authoritative = true
			for rec in (auth_ans.json as Dictionary).get("characters", []):
				if rec is Dictionary and str(rec.get("id", "")) != "":
					server_chars[str(rec.get("id", ""))] = rec
		else:
			var answer: Dictionary = await online.request(HTTPClient.METHOD_GET, "/ws/characters")
			if int(answer.get("status", 0)) == 200 and answer.get("json") is Dictionary:
				for record in (answer.json as Dictionary).get("characters", []):
					if record is Dictionary:
						legacy_server["srv-" + str(record.get("id", ""))] = record
			else:
				notice("Nie udało się pobrać postaci z serwera. Spróbuj ponownie.")
	while true:
		var roster: Array[Dictionary] = []
		if use_authoritative:
			for cid in server_chars:
				var rec: Dictionary = server_chars[cid]
				var race := str(rec.get("race", "legend"))
				if not HOME.has(race): continue
				var st: Dictionary = rec.get("state", {})
				var stats: Dictionary = rec.get("stats", {})
				var nodes_arr: Array = st.get("unlockedNodes", [])
				var quests_dict: Dictionary = st.get("completedQuests", {})
				roster.append({
					"id": cid,
					"race": race,
					"level": int(rec.get("level", 1)),
					"land": str(rec.get("land", HOME[race])),
					"time": int(Time.get_unix_time_from_system()),
					"cloudSlot": 0,
					"name": str(rec.get("name", "")),
					"extra": auth_progress_text(rec),
					"gold": int(rec.get("gold", 0)),
					"bankGold": int(st.get("bankGold", 0)),
					"hp": int(st.get("hp", int(stats.get("maxHp", 140)))),
					"maxHp": int(stats.get("maxHp", 140)),
					"ki": int(st.get("ki", int(stats.get("maxKi", 45)))),
					"maxKi": int(stats.get("maxKi", 45)),
					"attack": int(stats.get("attack", 14)),
					"defense": int(stats.get("defense", 5)),
					"critChance": float(stats.get("critChance", 5.0)),
					"speedBonusPct": int(stats.get("speedBonusPct", 0)),
					"xp": int(st.get("xp", 0)),
					"xpNeeded": int(stats.get("xpNeeded", 1400)),
					"talentsCount": nodes_arr.size(),
					"questsCount": quests_dict.size(),
				})
		else:
			for id in legacy_server:
				var player: Dictionary = (legacy_server[id] as Dictionary).get("state", {}).get("player", {})
				var race := str(player.get("race", "legend"))
				if not HOME.has(race): continue
				var lv := int(player.get("level", 1))
				roster.append({
					"id": id,
					"race": race,
					"level": lv,
					"land": HOME[race],
					"time": int(Time.get_unix_time_from_system()),
					"cloudSlot": 0,
					"name": str(player.get("name", "")),
					"extra": progress_text(player),
					"gold": int(player.get("gold", 0)),
					"bankGold": 0,
					"hp": 140 + (lv - 1) * 24,
					"maxHp": 140 + (lv - 1) * 24,
					"ki": 45 + (lv - 1) * 8,
					"maxKi": 45 + (lv - 1) * 8,
					"attack": 14 + (lv - 1) * 4,
					"defense": 5 + (lv - 1) * 2,
					"critChance": 5.0,
					"speedBonusPct": mini(lv - 1, 19) * 5,
					"xp": int(player.get("xp", 0)),
					"xpNeeded": 1400,
					"talentsCount": (player.get("skills", []) as Array).size() if player.get("skills") is Array else 1,
					"questsCount": 0,
				})
			for entry in Chars.list():
				if not legacy_server.has(str(entry.id)):
					roster.append(entry)
		if roster.is_empty():
			var made := await create_character(Chars, legacy_server, use_authoritative)
			if made == "": return ""
			return made
		page_card.hide()
		var view = load("res://scripts/character_select.gd").new()
		view.setup(roster, "")
		char_view = view
		add_child(view)
		var result := [""]
		view.picked.connect(func(id: String) -> void: result[0] = id; view.queue_free())
		view.new_character.connect(func() -> void: result[0] = "#new"; view.queue_free())
		view.closed.connect(func() -> void: result[0] = "#back"; view.queue_free())
		view.delete_requested.connect(func(del_id: String) -> void: result[0] = "#del:" + del_id; view.queue_free())
		await view.tree_exited
		char_view = null
		if result[0] == "" or result[0] == "#back":
			show_status({"maintenance": false, "canEnter": true, "message": "Wybierz akcję lub zaloguj się ponownie."})
			page_card.show()
			return ""
		if str(result[0]).begins_with("#del:"):
			var del_id: String = str(result[0]).substr(5)
			if use_authoritative and server_chars.has(del_id) and online.logged_in():
				var del_ans: Dictionary = await online.request(HTTPClient.METHOD_DELETE, "/ws/godot/characters/%s" % del_id)
				if int(del_ans.get("status", 0)) == 200:
					server_chars.erase(del_id)
					notice("Postać została usunięta z serwera.")
				else:
					notice(PyraOnline.message_of(del_ans, "Nie udało się usunąć postaci na serwerze."))
			else:
				Chars.delete(del_id)
				legacy_server.erase(del_id)
				notice("Postać została usunięta.")
			continue
		if result[0] == "#new":
			var made := await create_character(Chars, legacy_server, use_authoritative)
			if made != "": return made
			continue
		var picked_id := str(result[0])
		if use_authoritative and server_chars.has(picked_id):
			active_server_char = server_chars[picked_id]
			return picked_id
		return adopt_server_character(Chars, legacy_server, picked_id)
	return ""

func auth_progress_text(rec: Dictionary) -> String:
	var st: Dictionary = rec.get("state", {})
	var stats: Dictionary = rec.get("stats", {})
	var lines: Array[String] = []
	lines.append("HP %d/%d · KI %d/%d" % [int(st.get("hp", 1)), int(stats.get("maxHp", 140)), int(st.get("ki", 0)), int(stats.get("maxKi", 45))])
	lines.append("ATK %d · DEF %d · KRYT %.1f%%" % [int(stats.get("attack", 14)), int(stats.get("defense", 5)), float(stats.get("critChance", 5.0))])
	lines.append("PD %d/%d · Złoto %d (Bank %d)" % [int(st.get("xp", 0)), int(stats.get("xpNeeded", 1400)), int(rec.get("gold", 0)), int(st.get("bankGold", 0))])
	var nodes: Array = st.get("unlockedNodes", [])
	var quests: Dictionary = st.get("completedQuests", {})
	lines.append("Talenty: %d · Zlecenia: %d" % [nodes.size(), quests.size()])
	return "\n".join(lines)

func progress_text(player: Dictionary) -> String:
	var lines: Array[String] = []
	lines.append("PD: %d · złoto: %d" % [int(player.get("xp", 0)), int(player.get("gold", 0))])
	var skills: Variant = player.get("skills", [])
	if skills is Array: lines.append("umiejętności: %d" % (skills as Array).size())
	return "\n".join(lines)

func adopt_server_character(Chars, server: Dictionary, id: String) -> String:
	if not server.has(id): return id
	if Chars.read(Chars.slot_path(id)).is_empty():
		var player: Dictionary = (server[id] as Dictionary).get("state", {}).get("player", {})
		var race := str(player.get("race", "legend"))
		Chars.write(Chars.slot_path(id), {"characterId": id, "race": race, "land": HOME.get(race, "pyra"), "name": str(player.get("name", "")), "kit": {"level": int(player.get("level", 1))}, "gold": int(player.get("gold", 20)), "cloudSlot": 0})
	return id

func create_character(Chars, server: Dictionary, use_authoritative: bool) -> String:
	page_card.hide()
	var view = RaceScreen.new()
	view.setup(true)
	char_view = view
	add_child(view)
	var race := [""]
	view.chosen.connect(func(r: String) -> void: race[0] = r)
	view.closed.connect(func() -> void: race[0] = "#back")
	while race[0] == "": await get_tree().process_frame
	view.queue_free()
	char_view = null
	if race[0] == "#back": return ""
	var nick := await ask_name(str(race[0]))
	if nick == "": return ""
	var online = KiNet.online()
	if online.logged_in():
		if use_authoritative:
			var created: Dictionary = await online.request(HTTPClient.METHOD_POST, "/ws/godot/characters", {"race": race[0], "name": nick})
			if int(created.get("status", 0)) == 201 and created.get("json") is Dictionary:
				var rec: Dictionary = (created.json as Dictionary).get("character", {})
				var cid := str(rec.get("id", ""))
				if cid != "":
					server_chars[cid] = rec
					active_server_char = rec
					return cid
			notice(PyraOnline.message_of(created, "Serwer nie utworzył postaci (nick zajęty lub niedozwolony)."))
			return ""
		var created2: Dictionary = await online.request(HTTPClient.METHOD_POST, "/ws/characters", {"race": race[0], "name": nick})
		if int(created2.get("status", 0)) == 201 and created2.get("json") is Dictionary:
			var record: Dictionary = created2.json
			var rid := "srv-" + str(record.get("id", ""))
			server[rid] = record
			Chars.write(Chars.slot_path(rid), {"characterId": rid, "race": race[0], "land": HOME[race[0]], "name": nick, "kit": {"level": 1}, "gold": 20, "cloudSlot": 0})
			return rid
		notice(PyraOnline.message_of(created2, "Serwer nie utworzył postaci (nick zajęty lub niedozwolony)."))
		return ""
	var id: String = Chars.new_id()
	Chars.write(Chars.slot_path(id), {"characterId": id, "race": race[0], "land": HOME[race[0]], "name": nick, "kit": {"level": 1}, "gold": 20, "cloudSlot": 0})
	return id

## Forged Obsidian & Gold nick entry anchored near TOP of screen so Android soft keyboard NEVER covers it!
func ask_name(race: String) -> String:
	var overlay := Control.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	overlay.z_index = 104
	var back := ColorRect.new()
	back.color = Color(0.025, 0.02, 0.035, 0.96)
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(back)

	var card := PanelContainer.new()
	card.anchor_left = 0.5
	card.anchor_right = 0.5
	card.anchor_top = 0.0
	card.anchor_bottom = 0.0
	card.offset_left = -360.0
	card.offset_right = 360.0
	card.offset_top = 34.0
	card.offset_bottom = 398.0
	card.add_theme_stylebox_override("panel", _forged_panel(46.0, 40.0))
	overlay.add_child(card)

	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 14)
	card.add_child(box)

	var race_pl := str({"legend": "LEGENDA", "planetary": "PLANETARNY", "sage": "MĘDRZEC", "android": "ANDROID"}.get(race, race))
	var title := Label.new()
	title.text = "NAZWIJ BOHATERA · " + race_pl
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	Look.style_heading(title, 24)
	box.add_child(title)

	var err_lbl := Label.new()
	err_lbl.text = "Wpisz od 3 do 16 znaków (litery, cyfry lub myślnik)."
	err_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	err_lbl.add_theme_font_size_override("font_size", 15)
	err_lbl.add_theme_color_override("font_color", Color("dfd2b8"))
	box.add_child(err_lbl)

	var field := LineEdit.new()
	field.placeholder_text = "Np. Ignis, Jan, Aurelius..."
	field.max_length = 16
	field.custom_minimum_size = Vector2(0, 62)
	field.add_theme_font_size_override("font_size", 24)
	field.add_theme_color_override("font_color", Color("fff6df"))
	field.add_theme_color_override("font_placeholder_color", Color(0.65, 0.62, 0.58, 0.72))
	var f_box := StyleBoxFlat.new()
	f_box.bg_color = Color(0.05, 0.045, 0.075, 0.96)
	f_box.border_color = Color(0.88, 0.70, 0.34, 0.94)
	f_box.set_border_width_all(2)
	f_box.set_corner_radius_all(10)
	f_box.content_margin_left = 16
	f_box.content_margin_right = 16
	field.add_theme_stylebox_override("normal", f_box)
	var f_foc := f_box.duplicate()
	f_foc.border_color = Color(1.0, 0.86, 0.44, 1.0)
	field.add_theme_stylebox_override("focus", f_foc)
	box.add_child(field)

	var done := [false, ""]
	var btn_row := HBoxContainer.new()
	btn_row.add_theme_constant_override("separation", 14)
	box.add_child(btn_row)

	var cancel := Button.new()
	cancel.text = "← WSTECZ"
	cancel.custom_minimum_size = Vector2(180, 62)
	_style_forged_btn(cancel, "slate", 18)
	cancel.pressed.connect(func() -> void: done[0] = true)
	btn_row.add_child(cancel)

	var ok := Button.new()
	ok.text = "UTWÓRZ POSTAĆ"
	ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ok.custom_minimum_size = Vector2(260, 62)
	_style_forged_btn(ok, "gold", 20)
	ok.pressed.connect(func() -> void:
		var cleaned := field.text.strip_edges()
		if cleaned.length() < 3:
			err_lbl.text = "Nick musi mieć co najmniej 3 znaki!"
			err_lbl.add_theme_color_override("font_color", Color(1.0, 0.45, 0.36))
			return
		done[1] = cleaned
		done[0] = true
	)
	btn_row.add_child(ok)

	char_view = overlay
	add_child(overlay)
	field.grab_focus()
	while not done[0]: await get_tree().process_frame
	char_view = null
	overlay.queue_free()
	return str(done[1])

func notice(text: String) -> void:
	var panel_n := PanelContainer.new()
	panel_n.z_index = 200
	panel_n.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	panel_n.offset_left = 120
	panel_n.offset_right = -120
	panel_n.offset_top = -104
	panel_n.offset_bottom = -28
	panel_n.add_theme_stylebox_override("panel", _forged_panel(18.0, 12.0))
	var note := Label.new()
	note.text = text
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.add_theme_font_size_override("font_size", 18)
	note.add_theme_color_override("font_color", Color("fff1ce"))
	panel_n.add_child(note)
	add_child(panel_n)
	get_tree().create_timer(4.5).timeout.connect(panel_n.queue_free)

func _run_server_action(cid: String, payload: Dictionary, done_cb: Callable) -> void:
	var online = KiNet.online()
	var ans: Dictionary = await online.request(HTTPClient.METHOD_POST, "/ws/godot/characters/%s/action" % cid, payload)
	var ok := int(ans.get("status", 0)) == 200 and ans.get("json") is Dictionary
	var res: Dictionary = {}
	if ok:
		var j: Dictionary = ans.json
		if j.has("character") and j["character"] is Dictionary:
			active_server_char = j["character"]
			server_chars[cid] = active_server_char
		res = {
			"ok": true,
			"character": j.get("character", {}),
			"notice": str(j.get("notice", "")),
			"teleportCapital": bool(j.get("teleportCapital", false)),
		}
	else:
		res = {
			"ok": false,
			"notice": PyraOnline.message_of(ans, "Serwer odrzucił akcję."),
		}
	if done_cb.is_valid():
		done_cb.call(res)

func _on_world_change_character() -> void:
	close_preview()
	call_deferred("open_world", true)

func _on_world_logout() -> void:
	close_preview()
	if KiNet.online().has_method("logout"):
		KiNet.online().logout()
	picked.emit("login")

func _on_world_quit() -> void:
	close_preview()
	picked.emit("quit")

func spawn_world(full: bool) -> void:
	full_mode = full
	if not ResourceLoader.exists(SCENE):
		caption.text = "Brak paczki prototypu. Wymagana jest wersja aplikacji z podglądem izometrii."
		return
	var scene := load(SCENE) as PackedScene
	if scene == null: return
	_stop_menu_music()
	_silence_external_music()
	page_card.hide()
	preview = SubViewportContainer.new()
	preview.stretch = true
	preview.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(preview)
	var viewport := SubViewport.new()
	viewport.world_2d = World2D.new()
	viewport.size = Vector2i(get_viewport_rect().size)
	preview.add_child(viewport)
	world = scene.instantiate()
	var aprefs := _read_audio_prefs()
	world.initial_music_vol = float(aprefs["music"])
	world.initial_sfx_vol = float(aprefs["sfx"])
	world.audio_settings_fn = Callable(self, "_on_world_audio_changed")
	world.return_to_char_select_fn = Callable(self, "_on_world_change_character")
	world.logout_fn = Callable(self, "_on_world_logout")
	world.quit_game_fn = Callable(self, "_on_world_quit")
	if full and not active_server_char.is_empty():
		world.server_char_id = str(active_server_char.get("id", ""))
		world.server_character = active_server_char.duplicate(true)
		world.server_action_fn = Callable(self, "_run_server_action")
		world.start_name = str(active_server_char.get("name", ""))
		world.start_race = str(active_server_char.get("race", "legend"))
		world.start_land = str(active_server_char.get("land", "pyra"))
		world.start_level = int(active_server_char.get("level", 1))
		world.start_gold = int(active_server_char.get("gold", 120))
	elif full and char_id != "":
		var data: Dictionary = load("res://scripts/characters.gd").read(load("res://scripts/characters.gd").slot_path(char_id))
		world.start_name = str(data.get("name", ""))
		world.start_race = str(data.get("race", "legend"))
		world.start_land = str(data.get("land", "pyra"))
		world.start_level = int(data.get("kit", {}).get("level", 1))
		world.start_gold = int(data.get("gold", 20))
		autosave.wait_time = 20.0
		if autosave.get_parent() == null:
			autosave.timeout.connect(save_progress)
			add_child(autosave)
		autosave.start()
	viewport.add_child(world)
	if not full:
		close_button = Button.new()
		close_button.text = "← WRÓĆ · TRYB SERWISOWY"
		close_button.custom_minimum_size = Vector2(320, 62)
		_style_forged_btn(close_button, "slate", 18)
		close_button.pressed.connect(close_preview)
		add_child(close_button)
	layout_preview()

func layout_preview() -> void:
	if preview == null or close_button == null: return
	var safe := Rect2(Vector2.ZERO, get_viewport_rect().size)
	if OS.get_name() == "Android":
		var screen := DisplayServer.get_display_safe_area()
		if screen.has_area(): safe = (get_tree().root.get_screen_transform().affine_inverse() * Rect2(screen)).intersection(safe)
	close_button.position = Vector2(safe.get_center().x - 160, safe.position.y + 14)

func save_progress() -> void:
	if not active_server_char.is_empty(): return
	if world == null or char_id == "" or not full_mode or world.get("rpg_hud") == null: return
	var Chars = load("res://scripts/characters.gd")
	var data: Dictionary = Chars.read(Chars.slot_path(char_id))
	if data.is_empty(): return
	var hud: Object = world.rpg_hud
	data["kit"] = data.get("kit", {})
	data["kit"]["level"] = int(hud.hero_level)
	data["gold"] = int(hud.hero_gold)
	data["land"] = str(world.current_land)
	data["characterId"] = char_id
	Chars.write(Chars.slot_path(char_id), data)

func close_preview() -> void:
	autosave.stop()
	if full_mode: save_progress()
	if preview == null: return
	if world != null and world.get("audio") != null:
		world.audio.stop_all()
	world.motion = Vector2.ZERO
	world.move_pointer = -1
	preview.queue_free()
	preview = null
	world = null
	if close_button != null: close_button.queue_free()
	close_button = null
	full_mode = false
	_start_menu_music()
	page_card.show()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode == KEY_ESCAPE:
		if preview != null and world != null and world.has_method("handle_back_request"):
			world.handle_back_request()
			get_viewport().set_input_as_handled()
		elif char_view != null and char_view.has_signal("closed"):
			char_view.emit_signal("closed")
			get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if preview != null and world != null and world.has_method("handle_back_request"):
			world.handle_back_request()
		elif char_view != null and char_view.has_signal("closed"):
			char_view.emit_signal("closed")
		elif preview != null:
			close_preview()
		else:
			picked.emit("quit")
