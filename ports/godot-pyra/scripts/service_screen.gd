extends Control
## Uses the normal authenticated HTTP transport, never a local GM flag. Preview is a disposable private World2D.
signal picked(action: String)
const SCENE := "res://service_preview/pyra/world.tscn"
const FORGED_BASE := "res://service_preview/pyra/assets/ui/forged/"
const MENU_MUSIC_PATHS := [
	"res://service_preview/pyra/assets/audio/music/loading_theme.mp3",
	"res://assets/audio/music/loading_theme.mp3",
	"res://service_preview/pyra/assets/audio/music/menu.mp3",
	"res://assets/audio/music/menu.mp3",
	"res://assets/audio/music/loadings.mp3",
]
const AUDIO_PREFS_PATH := "user://audio.json"
const HUD_LAYOUT_PATH := "user://hud_layout.json"
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
var choosing_char := false
var user_backed_out := false
var autosave := Timer.new()
var menu_music := AudioStreamPlayer.new()
var _tex_cache: Dictionary = {}
var _downloading_packs := false
var _world_packs_ready := false
var _mounted_world_packs: Dictionary = {}
var dl_dock := PanelContainer.new()
var dl_title_lbl := Label.new()
var dl_speed_lbl := Label.new()
var dl_bar := ProgressBar.new()
var dl_bytes_lbl := Label.new()
var dl_meta_lbl := Label.new()
const WORLD_PACK_DIR := "user://content"
const WORLD_PACK_INDEX := "user://content/world_packs_ok.json"
const WORLD_MANIFEST_CACHE := "user://content/manifest.json"
const MAX_PARALLEL_PACKS := 4
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
	var prefs := {"music": 0.45, "sfx": 0.80, "ambience": 0.55}
	if FileAccess.file_exists(AUDIO_PREFS_PATH):
		var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(AUDIO_PREFS_PATH))
		if v is Dictionary:
			prefs["music"] = clampf(float((v as Dictionary).get("music", 0.45)), 0.0, 1.0)
			prefs["sfx"] = clampf(float((v as Dictionary).get("sfx", 0.80)), 0.0, 1.0)
			prefs["ambience"] = clampf(float((v as Dictionary).get("ambience", 0.55)), 0.0, 1.0)
	return prefs

func _on_world_audio_changed(music_v: float, sfx_v: float, amb_v: float = 0.55) -> void:
	var f := FileAccess.open(AUDIO_PREFS_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify({
			"music": clampf(music_v, 0.0, 1.0),
			"sfx": clampf(sfx_v, 0.0, 1.0),
			"ambience": clampf(amb_v, 0.0, 1.0),
		}))
		f.close()

func _read_hud_layout() -> Dictionary:
	if FileAccess.file_exists(HUD_LAYOUT_PATH):
		var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(HUD_LAYOUT_PATH))
		if v is Dictionary:
			return v as Dictionary
	return {}

func _on_world_hud_layout_changed(layout: Dictionary) -> void:
	var f := FileAccess.open(HUD_LAYOUT_PATH, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(layout))
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
	back.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(back)
	var bg_art := _load_tex("res://assets/branding/intro-wide.webp")
	if bg_art != null:
		var bg_rect := TextureRect.new()
		bg_rect.texture = bg_art
		bg_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		bg_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		bg_rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		bg_rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
		bg_rect.modulate = Color(0.26, 0.24, 0.30, 0.45)
		add_child(bg_rect)
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

	# Bottom forged download dock for parallel modular world packs (with live MB/s speed)
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

	resized.connect(layout_preview)
	resized.connect(_layout_dl_dock)
	set_process_unhandled_key_input(true)

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
			user_backed_out = false
			open_world(true)
			timer.start()
			return await picked
		return "continue"
	show_status(status)
	timer.start()
	return await picked

func show_menu_card() -> void:
	# Clean menu after user presses ← WSTECZ from Character Select / Race Screen.
	# Stays visible without timer yanking the player back!
	user_backed_out = true
	caption.text = "Menu główne konta. Wybierz akcję poniżej."
	for child in page.get_children():
		if child is Button: child.queue_free()
	button("WEJDŹ DO GRY", func():
		user_backed_out = false
		open_world(true)
	, "gold")
	button("ZMIEŃ KONTO / WYLOGUJ", func():
		if KiNet.online().has_method("logout"):
			KiNet.online().logout()
		picked.emit("login")
	, "slate")
	button("ZAMKNIJ GRĘ", func(): picked.emit("quit"), "crimson")
	page_card.show()

func show_status(status: Dictionary) -> void:
	allowed = permits_preview(status)
	caption.text = "Podgląd administratora. Ta scena nie zmienia zapisów postaci." if allowed else str(status.get("message", "Nie można sprawdzić serwera. Spróbuj ponownie."))
	for child in page.get_children():
		if child is Button: child.queue_free()
	if allowed:
		button("WEJDŹ DO GRY", func():
			user_backed_out = false
			open_world(true)
		, "gold")
		button("PROTOTYP IZOMETRYCZNY · PYRA", open_preview, "slate")
	else:
		button("ZALOGUJ SIĘ", func(): picked.emit("login"), "gold")
	button("SPRAWDŹ PONOWNIE", func():
		user_backed_out = false
		refresh_access()
	, "slate")
	button("ZAMKNIJ", func(): picked.emit("quit"), "crimson")

func button(text: String, action: Callable, variant: String = "slate") -> void:
	var control := Button.new()
	control.text = text
	control.custom_minimum_size = Vector2(540, 68)
	_style_forged_btn(control, variant, 20)
	control.pressed.connect(action)
	page.add_child(control)

func refresh_access() -> void:
	if checking or choosing_char or user_backed_out or _downloading_packs: return
	checking = true
	var status := await read_status()
	checking = false
	if not is_inside_tree(): return
	if preview != null and not full_mode and not permits_preview(status): close_preview()
	if status.get("maintenance") == false and status.get("canEnter") == true:
		if preview == null and char_view == null and not choosing_char and not user_backed_out and not _downloading_packs:
			if ResourceLoader.exists(SCENE): open_world(true)
			else: picked.emit("continue")
		return
	if preview == null and char_view == null and not choosing_char and not _downloading_packs:
		show_status(status)

func open_preview() -> void:
	if checking or choosing_char or _downloading_packs or preview != null: return
	checking = true
	var status := await read_status()
	checking = false
	if not permits_preview(status):
		show_status(status)
		return
	open_world(false)

static func _fmt_speed(bps: float) -> String:
	if bps >= 1048576.0:
		return "%.2f MB/s" % (bps / 1048576.0)
	if bps >= 1024.0:
		return "%.0f KB/s" % (bps / 1024.0)
	return "0 KB/s"

static func _fmt_mb(bytes_val: float) -> String:
	return "%.1f MB" % (bytes_val / 1048576.0)

static func _fmt_streams(count: int) -> String:
	var n := maxi(1, count)
	return "1 wątek · bez limitu" if n == 1 else "%d wątki równolegle · bez limitu" % n

func _read_pack_index() -> Dictionary:
	if FileAccess.file_exists(WORLD_PACK_INDEX):
		var v: Variant = JSON.parse_string(FileAccess.get_file_as_string(WORLD_PACK_INDEX))
		if v is Dictionary:
			return v as Dictionary
	return {}

func _save_pack_index(idx: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(WORLD_PACK_DIR))
	var f := FileAccess.open(WORLD_PACK_INDEX, FileAccess.WRITE)
	if f != null:
		f.store_string(JSON.stringify(idx))
		f.close()

func _prune_old_world_packs(keep_files: Dictionary) -> void:
	var dir := DirAccess.open(WORLD_PACK_DIR)
	if dir == null:
		return
	for name in dir.get_files():
		if name.begins_with("world-") and (name.ends_with(".pck") or name.ends_with(".part") or ".part.s" in name) and not keep_files.has(name):
			dir.remove(name)

func _mount_world_pack(id: String, path: String) -> bool:
	if _mounted_world_packs.has(id):
		return true
	var ok := ProjectSettings.load_resource_pack(ProjectSettings.globalize_path(path), true)
	if ok:
		_mounted_world_packs[id] = true
	return ok

func _ensure_world_packs() -> bool:
	if _world_packs_ready:
		return true
	# Fast path: monolithic core-c101 or desktop embedded already carries all world assets.
	if FileAccess.file_exists("res://service_preview/pyra/regions/pyra/height.r32") and FileAccess.file_exists("res://service_preview/pyra/assets/actors/hero-legend-walk-v3-idle-0.webp"):
		_world_packs_ready = true
		return true
	_downloading_packs = true
	var online = KiNet.online()
	var manifest: Dictionary = {}
	var pack_base := ""
	var res: Dictionary = await online.request(HTTPClient.METHOD_GET, "/ws/godot/manifest?client=%d" % KiNet.CLIENT_CODE, null, true, 15.0)
	if int(res.get("status", 0)) == 200 and res.get("json") is Dictionary and (res.json as Dictionary).has("manifest"):
		manifest = (res.json as Dictionary).get("manifest", {})
		pack_base = str((res.json as Dictionary).get("packBase", ""))
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(WORLD_PACK_DIR))
		var mf := FileAccess.open(WORLD_MANIFEST_CACHE, FileAccess.WRITE)
		if mf != null:
			mf.store_string(JSON.stringify(res.json))
			mf.close()
	elif FileAccess.file_exists(WORLD_MANIFEST_CACHE):
		var cached_m: Variant = JSON.parse_string(FileAccess.get_file_as_string(WORLD_MANIFEST_CACHE))
		if cached_m is Dictionary and (cached_m as Dictionary).has("manifest"):
			manifest = (cached_m as Dictionary).get("manifest", {})
			pack_base = str((cached_m as Dictionary).get("packBase", ""))
	var lands: Dictionary = manifest.get("lands", {}) if manifest.get("lands") is Dictionary else {}
	var packs_map: Dictionary = manifest.get("packs", {}) if manifest.get("packs") is Dictionary else {}
	var world_ids_v: Variant = lands.get("world", [])
	var world_ids: Array = world_ids_v if world_ids_v is Array else []
	if world_ids.is_empty():
		_downloading_packs = false
		_world_packs_ready = true
		return true

	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(WORLD_PACK_DIR))
	var ok_index := _read_pack_index()
	var keep_files: Dictionary = {}
	var missing: Array[Dictionary] = []
	for raw_id in world_ids:
		var pid := str(raw_id)
		if not packs_map.has(pid) or not (packs_map[pid] is Dictionary):
			continue
		var entry: Dictionary = packs_map[pid]
		var fname := str(entry.get("file", ""))
		var want_bytes := int(entry.get("bytes", 0))
		var want_sha := str(entry.get("sha256", ""))
		keep_files[fname] = true
		if _mounted_world_packs.has(pid):
			continue
		var fpath := "%s/%s" % [WORLD_PACK_DIR, fname]
		var is_cached := false
		if FileAccess.file_exists(fpath):
			var probe := FileAccess.open(fpath, FileAccess.READ)
			var sz := probe.get_length() if probe != null else -1
			if probe != null:
				probe.close()
			if sz == want_bytes:
				if str(ok_index.get(fname, "")) == want_sha:
					is_cached = true
				elif FileAccess.get_sha256(fpath) == want_sha:
					ok_index[fname] = want_sha
					_save_pack_index(ok_index)
					is_cached = true
		if is_cached:
			if _mount_world_pack(pid, fpath):
				continue
			DirAccess.remove_absolute(ProjectSettings.globalize_path(fpath))
			ok_index.erase(fname)
		missing.append({"id": pid, "file": fname, "bytes": want_bytes, "sha256": want_sha, "attempts": 0})

	if missing.is_empty():
		_prune_old_world_packs(keep_files)
		_downloading_packs = false
		_world_packs_ready = true
		return true

	# Parallel multi-stream download with unified bottom progress bar & live MB/s speed (no limit!)
	page_card.hide()
	_layout_dl_dock()
	dl_dock.visible = true
	_start_menu_music()
	var total_packs := missing.size()
	var total_bytes := 0.0
	for m in missing:
		total_bytes += float(m["bytes"])
	total_bytes = maxf(1.0, total_bytes)
	dl_bar.max_value = total_bytes
	dl_bar.value = 0.0
	var queue: Array[Dictionary] = missing.duplicate()
	var active: Array[Dictionary] = []
	var completed_bytes := 0.0
	var completed_count := 0
	var failed_ids: Array[String] = []
	var last_t := Time.get_ticks_msec()
	var last_b := 0.0
	var smooth_bps := 0.0

	# Single large missing pack (>= 2 MB): split across 4 parallel HTTP Range streams too!
	if queue.size() == 1 and int(queue[0]["bytes"]) >= 2097152:
		var single_job: Dictionary = queue[0]
		var ranged_ok := await _download_world_pack_ranged(online, pack_base, single_job, ok_index)
		if ranged_ok:
			queue.clear()
			completed_bytes = float(single_job["bytes"])
			completed_count = 1

	while not queue.is_empty() or not active.is_empty():
		while active.size() < MAX_PARALLEL_PACKS and not queue.is_empty():
			var job: Dictionary = queue.pop_front()
			var final_path := "%s/%s" % [WORLD_PACK_DIR, str(job["file"])]
			var part_path := final_path + ".part"
			var http := HTTPRequest.new()
			http.download_file = part_path
			http.download_chunk_size = 1048576
			http.body_size_limit = -1
			http.timeout = 0.0
			http.use_threads = true
			add_child(http)
			var url := str(online.server) + pack_base + str(job["file"])
			var headers := PackedStringArray()
			if str(online.access_token) != "":
				headers.append("Authorization: Bearer " + str(online.access_token))
			var worker := {
				"job": job,
				"final": final_path,
				"part": part_path,
				"http": http,
				"done": false,
				"result": -1,
				"code": 0,
			}
			http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
				worker["result"] = result
				worker["code"] = code
				worker["done"] = true)
			if http.request(url, headers) != OK:
				http.queue_free()
				job["attempts"] = int(job["attempts"]) + 1
				if int(job["attempts"]) < 3:
					queue.append(job)
				else:
					failed_ids.append(str(job["id"]))
			else:
				active.append(worker)

		var in_flight := 0.0
		var still_active: Array[Dictionary] = []
		for w in active:
			var http: HTTPRequest = w["http"]
			if bool(w["done"]):
				http.queue_free()
				var job: Dictionary = w["job"]
				var part_p := str(w["part"])
				var final_p := str(w["final"])
				var valid := false
				if int(w["result"]) == HTTPRequest.RESULT_SUCCESS and int(w["code"]) == 200 and FileAccess.file_exists(part_p):
					var pr := FileAccess.open(part_p, FileAccess.READ)
					var got_sz := pr.get_length() if pr != null else -1
					if pr != null:
						pr.close()
					if got_sz == int(job["bytes"]) and FileAccess.get_sha256(part_p) == str(job["sha256"]):
						DirAccess.rename_absolute(ProjectSettings.globalize_path(part_p), ProjectSettings.globalize_path(final_p))
						if _mount_world_pack(str(job["id"]), final_p):
							ok_index[str(job["file"])] = str(job["sha256"])
							_save_pack_index(ok_index)
							completed_bytes += float(job["bytes"])
							completed_count += 1
							valid = true
				if not valid:
					if FileAccess.file_exists(part_p):
						DirAccess.remove_absolute(ProjectSettings.globalize_path(part_p))
					job["attempts"] = int(job["attempts"]) + 1
					if int(job["attempts"]) < 3:
						queue.append(job)
					else:
						failed_ids.append(str(job["id"]))
			else:
				in_flight += float(http.get_downloaded_bytes())
				still_active.append(w)
		active = still_active

		var cur_total := minf(total_bytes, completed_bytes + in_flight)
		var now_t := Time.get_ticks_msec()
		var dt_ms := now_t - last_t
		if dt_ms >= 200:
			var inst_bps := maxf(0.0, cur_total - last_b) / (float(dt_ms) / 1000.0)
			smooth_bps = inst_bps if smooth_bps <= 1.0 else lerpf(smooth_bps, inst_bps, 0.35)
			last_t = now_t
			last_b = cur_total
		var pct := int(clampf(100.0 * cur_total / total_bytes, 0.0, 100.0))
		dl_bar.value = cur_total
		dl_title_lbl.text = "Pobieranie zasobów świata (%d/%d)…" % [mini(completed_count + active.size(), total_packs), total_packs]
		dl_speed_lbl.text = "⚡ %s" % _fmt_speed(smooth_bps)
		dl_bytes_lbl.text = "%s / %s · %d%%" % [_fmt_mb(cur_total), _fmt_mb(total_bytes), pct]
		dl_meta_lbl.text = _fmt_streams(active.size())
		await get_tree().process_frame

	dl_dock.visible = false
	_downloading_packs = false
	if not failed_ids.is_empty():
		caption.text = "Nie udało się pobrać części zasobów (%s). Sprawdź połączenie i spróbuj ponownie." % ", ".join(failed_ids)
		for child in page.get_children():
			if child is Button: child.queue_free()
		button("SPRÓBUJ PONOWNIE", func():
			user_backed_out = false
			open_world(full_mode)
		, "gold")
		button("ZAMKNIJ GRĘ", func(): picked.emit("quit"), "crimson")
		page_card.show()
		return false
	_prune_old_world_packs(keep_files)
	_world_packs_ready = true
	return true

func _download_world_pack_ranged(online: Variant, pack_base: String, job: Dictionary, ok_index: Dictionary) -> bool:
	var want_bytes := int(job["bytes"])
	var want_sha := str(job["sha256"])
	var final_p := "%s/%s" % [WORLD_PACK_DIR, str(job["file"])]
	var part_p := final_p + ".part"
	var url := str(online.server) + pack_base + str(job["file"])
	var n := MAX_PARALLEL_PACKS
	var seg_size := int(ceili(float(want_bytes) / float(n)))
	var workers: Array[Dictionary] = []
	var seg_paths: Array[String] = []
	for i in n:
		var seg_clean := "%s.s%d" % [part_p, i]
		if FileAccess.file_exists(seg_clean):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(seg_clean))
	for i in n:
		var s0 := i * seg_size
		if s0 >= want_bytes:
			break
		var s1 := mini(want_bytes - 1, s0 + seg_size - 1)
		var seg_path := "%s.s%d" % [part_p, i]
		seg_paths.append(seg_path)
		var http := HTTPRequest.new()
		http.download_file = seg_path
		http.download_chunk_size = 1048576
		http.body_size_limit = -1
		http.timeout = 0.0
		http.use_threads = true
		add_child(http)
		var headers := PackedStringArray(["Range: bytes=%d-%d" % [s0, s1]])
		if str(online.access_token) != "":
			headers.append("Authorization: Bearer " + str(online.access_token))
		var w := {"http": http, "path": seg_path, "want": s1 - s0 + 1, "done": false, "result": -1, "code": 0}
		http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
			w["result"] = result
			w["code"] = code
			w["done"] = true)
		if http.request(url, headers) != OK:
			for prev in workers:
				var ph: HTTPRequest = prev["http"]
				ph.cancel_request()
				ph.queue_free()
			http.queue_free()
			for sp in seg_paths:
				if FileAccess.file_exists(sp):
					DirAccess.remove_absolute(ProjectSettings.globalize_path(sp))
			return false
		workers.append(w)

	var total_f := float(want_bytes)
	var last_t := Time.get_ticks_msec()
	var last_b := 0.0
	var smooth_bps := 0.0
	var got_full_200 := ""
	var failed := false
	while true:
		var active_count := 0
		var cur_b := 0.0
		for w in workers:
			var http: HTTPRequest = w["http"]
			if bool(w["done"]):
				if int(w["result"]) == HTTPRequest.RESULT_SUCCESS and int(w["code"]) == 200 and got_full_200 == "":
					got_full_200 = str(w["path"])
					break
				if int(w["result"]) != HTTPRequest.RESULT_SUCCESS or int(w["code"]) != 206:
					failed = true
				cur_b += float(w["want"])
			else:
				active_count += 1
				cur_b += float(mini(int(w["want"]), http.get_downloaded_bytes()))
		if got_full_200 != "" or failed or active_count == 0:
			break
		var now_t := Time.get_ticks_msec()
		var dt_ms := now_t - last_t
		if dt_ms >= 200:
			var inst_bps := maxf(0.0, cur_b - last_b) / (float(dt_ms) / 1000.0)
			smooth_bps = inst_bps if smooth_bps <= 1.0 else lerpf(smooth_bps, inst_bps, 0.35)
			last_t = now_t
			last_b = cur_b
		var pct := int(clampf(100.0 * cur_b / total_f, 0.0, 100.0))
		dl_bar.value = cur_b
		dl_title_lbl.text = "Pobieranie zasobów świata (1/1)…"
		dl_speed_lbl.text = "⚡ %s" % _fmt_speed(smooth_bps)
		dl_bytes_lbl.text = "%s / %s · %d%%" % [_fmt_mb(cur_b), _fmt_mb(total_f), pct]
		dl_meta_lbl.text = _fmt_streams(active_count)
		await get_tree().process_frame

	for w in workers:
		var http: HTTPRequest = w["http"]
		if not bool(w["done"]):
			http.cancel_request()
		http.queue_free()

	var ok := false
	if got_full_200 != "":
		var pr := FileAccess.open(got_full_200, FileAccess.READ)
		var sz := pr.get_length() if pr != null else -1
		if pr != null:
			pr.close()
		if sz == want_bytes and FileAccess.get_sha256(got_full_200) == want_sha:
			DirAccess.rename_absolute(ProjectSettings.globalize_path(got_full_200), ProjectSettings.globalize_path(final_p))
			ok = _mount_world_pack(str(job["id"]), final_p)
	elif not failed:
		var all_len_ok := true
		for w in workers:
			var pr := FileAccess.open(str(w["path"]), FileAccess.READ)
			var sz := pr.get_length() if pr != null else -1
			if pr != null:
				pr.close()
			if sz != int(w["want"]):
				all_len_ok = false
				break
		if all_len_ok:
			dl_bar.value = total_f
			dl_title_lbl.text = "Weryfikacja i uruchamianie zasobów…"
			dl_bytes_lbl.text = "%s / %s · 100%%" % [_fmt_mb(total_f), _fmt_mb(total_f)]
			await get_tree().process_frame
			var out := FileAccess.open(part_p, FileAccess.WRITE)
			if out != null:
				var merge_ok := true
				for sp in seg_paths:
					var inp := FileAccess.open(sp, FileAccess.READ)
					if inp == null:
						merge_ok = false
						break
					while inp.get_position() < inp.get_length():
						var chunk := inp.get_buffer(mini(1048576, inp.get_length() - inp.get_position()))
						if chunk.is_empty():
							break
						out.store_buffer(chunk)
					inp.close()
				out.close()
				if merge_ok and FileAccess.get_sha256(part_p) == want_sha:
					DirAccess.rename_absolute(ProjectSettings.globalize_path(part_p), ProjectSettings.globalize_path(final_p))
					ok = _mount_world_pack(str(job["id"]), final_p)

	for sp in seg_paths:
		if FileAccess.file_exists(sp):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(sp))
	if FileAccess.file_exists(part_p):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(part_p))
	if ok:
		ok_index[str(job["file"])] = want_sha
		_save_pack_index(ok_index)
	return ok

func open_world(full: bool) -> void:
	if preview != null or char_view != null or choosing_char or _downloading_packs: return
	full_mode = full
	var packs_ok := await _ensure_world_packs()
	if not packs_ok or not is_inside_tree():
		return
	if full:
		choosing_char = true
		user_backed_out = false
		_start_menu_music()
		var chosen: String = await choose_character()
		choosing_char = false
		if chosen == "":
			return
		char_id = chosen
	if KiNet.online().is_staff():
		choosing_char = true
		await KiNet.online().verify_staff()
		choosing_char = false
		if not is_inside_tree():
			return
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
			if made == "":
				show_menu_card()
				return ""
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
			show_menu_card()
			return ""
		if str(result[0]).begins_with("#del:"):
			var del_id: String = str(result[0]).substr(5)
			if use_authoritative and server_chars.has(del_id) and online.logged_in():
				var del_ans: Dictionary = await online.request(HTTPClient.METHOD_DELETE, "/ws/godot/characters/%s" % del_id)
				if int(del_ans.get("status", 0)) == 200:
					server_chars.erase(del_id)
					Chars.delete(del_id)
					if str(active_server_char.get("id", "")) == del_id:
						active_server_char = {}
					notice("Postać została trwale usunięta z serwera.")
				else:
					notice(PyraOnline.message_of(del_ans, "Nie udało się usunąć postaci na serwerze."))
			else:
				if del_id.begins_with("srv-") and online.logged_in():
					await online.request(HTTPClient.METHOD_DELETE, "/ws/characters/%s" % del_id.substr(4))
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
	var view = load("res://scripts/race_screen.gd").new()
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
	var caller_world = world
	var ans: Dictionary = await online.request(HTTPClient.METHOD_POST, "/ws/godot/characters/%s/action" % cid, payload)
	if not is_instance_valid(caller_world) or world != caller_world:
		return
	var ok := int(ans.get("status", 0)) == 200 and ans.get("json") is Dictionary
	var res: Dictionary = {}
	if ok:
		var j: Dictionary = ans.json
		if j.get("character") is Dictionary and int(j.character.get("revision", 0)) >= int(active_server_char.get("revision", 0)):
			active_server_char = j["character"]
			server_chars[cid] = active_server_char
		res = {
			"ok": true,
			"character": j.get("character", {}),
			"notice": str(j.get("notice", "")),
			"teleportCapital": bool(j.get("teleportCapital", false)),
			"lootDrop": j.get("lootDrop", {}),
		}
	else:
		var err: Dictionary = ans.json if ans.get("json") is Dictionary else {}
		res = {
			"ok": false,
			"errorCode": str(err.get("error", "")),
			"notice": PyraOnline.message_of(ans, "Serwer odrzucił akcję."),
		}
	if done_cb.is_valid():
		done_cb.call(res)

func _run_server_ping(done_cb: Callable) -> void:
	var online = KiNet.online()
	var t0 := Time.get_ticks_msec()
	var ans: Dictionary = await online.request(HTTPClient.METHOD_GET, "/ws/godot/status", null, false, 6.0, false)
	var ok := int(ans.get("status", 0)) == 200
	var rtt := maxi(1, int(Time.get_ticks_msec() - t0)) if ok else -1
	if done_cb.is_valid():
		done_cb.call(ok, rtt)

func _on_world_change_character() -> void:
	close_preview()
	call_deferred("open_world", true)

func _on_world_logout() -> void:
	close_preview()
	if KiNet.online().has_method("logout"):
		KiNet.online().logout()
	picked.emit("login")

func _on_world_quit() -> void:
	autosave.stop()
	if full_mode:
		save_progress()
	if world != null and world.get("audio") != null:
		world.audio.stop_all()
	_stop_menu_music()
	picked.emit("quit")
	if get_tree() != null:
		get_tree().call_deferred("quit")

func _is_world_staff(expected_account: String) -> bool:
	var online = KiNet.online()
	return expected_account != "" and online.account_id == expected_account and online.is_staff()

func _presence_session(expected_account: String) -> Dictionary:
	var online = KiNet.online()
	if not online.logged_in() or str(online.account_id) != expected_account:
		return {}
	return {"url": online.live_url(), "token": str(online.access_token)}

func _refresh_presence_session(expected_account: String, done: Callable) -> void:
	var online = KiNet.online()
	if online.logged_in() and str(online.account_id) == expected_account:
		await online.request(HTTPClient.METHOD_GET, "/ws/auth/me", null, true, 5.0)
	if done.is_valid():
		done.call()

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
	world.initial_ambience_vol = float(aprefs.get("ambience", 0.55))
	world.initial_sfx_vol = float(aprefs["sfx"])
	world.initial_hud_layout = _read_hud_layout()
	world.audio_settings_fn = Callable(self, "_on_world_audio_changed")
	world.hud_layout_changed_fn = Callable(self, "_on_world_hud_layout_changed")
	world.return_to_char_select_fn = Callable(self, "_on_world_change_character")
	world.logout_fn = Callable(self, "_on_world_logout")
	world.quit_game_fn = Callable(self, "_on_world_quit")
	world.server_ping_fn = Callable(self, "_run_server_ping")
	var online = KiNet.online()
	if online.is_staff():
		world.gm_access_fn = Callable(self, "_is_world_staff").bind(str(online.account_id))
		var staff_refresh := Timer.new()
		staff_refresh.wait_time = 30.0
		staff_refresh.autostart = true
		staff_refresh.timeout.connect(func() -> void:
			if online.is_staff():
				await online.verify_staff()
			else:
				staff_refresh.stop()
		)
		world.add_child(staff_refresh)
	if full and not active_server_char.is_empty():
		world.server_char_id = str(active_server_char.get("id", ""))
		world.server_character = active_server_char.duplicate(true)
		world.server_action_fn = Callable(self, "_run_server_action")
		world.live_auth_fn = Callable(self, "_presence_session").bind(str(online.account_id))
		var presence_account := str(online.account_id)
		world.live_refresh_fn = func(done: Callable) -> void:
			_refresh_presence_session(presence_account, done)
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
	if full and char_id != "":
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
	if not is_instance_valid(world) or char_id == "" or not full_mode or world.get("rpg_hud") == null:
		return
	if not active_server_char.is_empty():
		world.save_server_position()
		return
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
	if what == NOTIFICATION_APPLICATION_PAUSED:
		save_progress()
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if preview != null and world != null and world.has_method("handle_back_request"):
			world.handle_back_request()
		elif char_view != null and char_view.has_signal("closed"):
			char_view.emit_signal("closed")
		elif preview != null:
			close_preview()
		else:
			picked.emit("quit")
