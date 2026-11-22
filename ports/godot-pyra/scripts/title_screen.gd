class_name PyraTitleScreen
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)

signal city_started(city: PyraGame)

const CITY_PATH := "res://scenes/city.tscn"
const Characters := preload("res://scripts/characters.gd")
const INTRO_VIDEO_PATHS := ["res://assets/branding/intro.ogv", "res://service_preview/pyra/assets/branding/intro.ogv"]
const INTRO_LAST_PATHS := ["res://assets/branding/intro-last.webp", "res://service_preview/pyra/assets/branding/intro-last.webp"]
const INTRO_SIZE := Vector2(1280.0, 720.0)
const INTRO_MAX_CROP := 0.10
const INTRO_SKIP_AFTER := 0.8

var loading := false
var city_instance: PyraGame
var start_button := Button.new()
var status := Label.new()
var powered := TextureRect.new()
var powered_caption := Label.new()
var version_label := Label.new()
var content := VBoxContainer.new()
var safe_root := Control.new()
var active_pointer := -1
var mouse_armed := false
var gate_active := false
var overlay_active := false
var gate_done := false

var intro := TextureRect.new()
var floor_shade := TextureRect.new()
var menu_music := AudioStreamPlayer.new()

# OTA-capable owner intro film player (runs whenever the installed APK's boot.gd did NOT play intro.ogv!)
var intro_overlay: Control
var intro_video: VideoStreamPlayer
var intro_last_frame: TextureRect
var intro_skip_pill: PanelContainer
var intro_playing := false
var intro_waiting_tap := false
var intro_elapsed := 0.0

func _load_menu_stream() -> AudioStream:
	for p in ["res://service_preview/pyra/assets/audio/music/menu.mp3", "res://assets/audio/music/menu.mp3"]:
		if ResourceLoader.exists(p):
			var loaded := load(p)
			if loaded is AudioStream:
				return loaded
		if FileAccess.file_exists(p):
			var mp3 := AudioStreamMP3.new()
			mp3.data = FileAccess.get_file_as_bytes(p)
			mp3.loop = true
			return mp3
	return null

func start_menu_music() -> void:
	if intro_playing or intro_waiting_tap:
		return
	var vol := 0.35
	if FileAccess.file_exists("user://audio.json"):
		var v: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://audio.json"))
		if v is Dictionary:
			vol = clampf(float((v as Dictionary).get("music", vol)), 0.0, 1.0)
	if vol <= 0.01:
		menu_music.stop()
		return
	if menu_music.stream == null:
		menu_music.stream = _load_menu_stream()
	if menu_music.stream is AudioStreamMP3:
		(menu_music.stream as AudioStreamMP3).loop = true
	menu_music.volume_db = linear_to_db(maxf(vol * 0.72, 0.0001))
	if menu_music.stream != null and not menu_music.playing:
		menu_music.play()

func stop_menu_music() -> void:
	if menu_music.playing:
		menu_music.stop()

func _intro_volume() -> float:
	var music := 0.35
	if FileAccess.file_exists("user://audio.json"):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://audio.json"))
		if value is Dictionary:
			music = clampf(float((value as Dictionary).get("music", music)), 0.0, 1.0)
	return clampf(music * 1.6, 0.0, 1.0)

func _load_intro_stream() -> VideoStream:
	for p in INTRO_VIDEO_PATHS:
		if ResourceLoader.exists(p):
			var res := load(p)
			if res is VideoStream:
				return res as VideoStream
		if FileAccess.file_exists(p):
			var vs := VideoStreamTheora.new()
			vs.file = p
			return vs
	return null

func _load_intro_last_tex() -> Texture2D:
	for p in INTRO_LAST_PATHS:
		if ResourceLoader.exists(p):
			var res := load(p)
			if res is Texture2D:
				return res as Texture2D
		if FileAccess.file_exists(p):
			var bytes := FileAccess.get_file_as_bytes(p)
			if not bytes.is_empty():
				var img := Image.new()
				if img.load_webp_from_buffer(bytes) == OK:
					return ImageTexture.create_from_image(img)
	return null

static func _film_rect(area: Vector2) -> Rect2:
	var contain := minf(area.x / INTRO_SIZE.x, area.y / INTRO_SIZE.y)
	var cover := maxf(area.x / INTRO_SIZE.x, area.y / INTRO_SIZE.y)
	var factor := minf(cover, contain / (1.0 - INTRO_MAX_CROP))
	var film := INTRO_SIZE * factor
	var cut := maxf(0.0, film.y - area.y)
	return Rect2(Vector2((area.x - film.x) / 2.0, -cut * 0.8), film)

func _fit_intro_overlay() -> void:
	if intro_overlay == null or not is_instance_valid(intro_overlay):
		return
	var area := size
	if area.x <= 0.0 or area.y <= 0.0:
		return
	var rect := _film_rect(area)
	if intro_video != null:
		intro_video.position = rect.position
		intro_video.size = rect.size
	if intro_last_frame != null:
		intro_last_frame.position = rect.position
		intro_last_frame.size = rect.size

func _try_play_ota_intro() -> bool:
	if DisplayServer.get_name() == "headless" or "--skip-intro" in OS.get_cmdline_user_args():
		return false
	var stream := _load_intro_stream()
	if stream == null:
		return false
	Engine.set_meta("ki_intro_played", true)
	stop_menu_music()
	intro_overlay = Control.new()
	intro_overlay.name = "OwnerIntroOverlay"
	intro_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	intro_overlay.clip_contents = true
	intro_overlay.mouse_filter = Control.MOUSE_FILTER_STOP
	intro_overlay.z_index = 250
	add_child(intro_overlay)

	var bg := ColorRect.new()
	bg.color = Color(0.051, 0.082, 0.125, 1.0)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	intro_overlay.add_child(bg)

	intro_last_frame = TextureRect.new()
	intro_last_frame.texture = _load_intro_last_tex()
	intro_last_frame.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	intro_last_frame.stretch_mode = TextureRect.STRETCH_SCALE
	intro_last_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	intro_last_frame.visible = false
	intro_overlay.add_child(intro_last_frame)

	intro_video = VideoStreamPlayer.new()
	intro_video.stream = stream
	intro_video.expand = true
	intro_video.volume_db = linear_to_db(maxf(0.0001, _intro_volume()))
	intro_video.mouse_filter = Control.MOUSE_FILTER_IGNORE
	intro_video.finished.connect(_on_intro_video_finished)
	intro_overlay.add_child(intro_video)

	intro_skip_pill = PanelContainer.new()
	var ps := StyleBoxFlat.new()
	ps.bg_color = Color(0.03, 0.04, 0.08, 0.72)
	ps.border_color = Color(0.88, 0.72, 0.36, 0.75)
	ps.set_border_width_all(1)
	ps.set_corner_radius_all(16)
	ps.content_margin_left = 16
	ps.content_margin_right = 16
	ps.content_margin_top = 6
	ps.content_margin_bottom = 6
	intro_skip_pill.add_theme_stylebox_override("panel", ps)
	intro_skip_pill.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_RIGHT)
	intro_skip_pill.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	intro_skip_pill.grow_vertical = Control.GROW_DIRECTION_BEGIN
	intro_skip_pill.offset_right = -24
	intro_skip_pill.offset_bottom = -20
	intro_skip_pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	intro_skip_pill.visible = false
	var pl := Label.new()
	pl.text = "Dotknij, aby pominąć ›"
	pl.add_theme_font_size_override("font_size", 15)
	pl.add_theme_color_override("font_color", Color("f3e6c4"))
	intro_skip_pill.add_child(pl)
	intro_overlay.add_child(intro_skip_pill)

	intro_playing = true
	intro_waiting_tap = false
	intro_elapsed = 0.0
	_fit_intro_overlay()
	intro_video.play()
	return true

func _on_intro_video_finished() -> void:
	if not intro_playing:
		return
	intro_playing = false
	if intro_video != null:
		intro_video.stop()
		intro_video.visible = false
	if intro_skip_pill != null:
		intro_skip_pill.visible = false
	if intro_last_frame != null and intro_last_frame.texture != null:
		intro_last_frame.visible = true
		intro_waiting_tap = true
	else:
		_finish_ota_intro()

func _finish_ota_intro() -> void:
	intro_playing = false
	intro_waiting_tap = false
	if intro_video != null and is_instance_valid(intro_video):
		intro_video.stop()
	if intro_overlay != null and is_instance_valid(intro_overlay):
		intro_overlay.queue_free()
	intro_overlay = null
	intro_video = null
	intro_last_frame = null
	intro_skip_pill = null
	start_menu_music()
	start_city.call_deferred()

func _ready() -> void:
	get_tree().quit_on_go_back = false
	PyraSkin.install(get_tree())
	Look.install_letters(get_tree())
	menu_music.name = "MenuMusicPlayer"
	add_child(menu_music)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	# The owner's key art as a landscape composition (the game is landscape-only): it fills the whole screen.
	intro.texture = load("res://assets/branding/intro-wide.webp")
	intro.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	intro.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	intro.texture_filter = CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	intro.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	intro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(intro)
	var gradient := Gradient.new()
	gradient.set_color(0, Color(0.02, 0.035, 0.055, 0.0))
	gradient.set_color(1, Color(0.02, 0.035, 0.055, 0.94))
	var gradient_texture := GradientTexture2D.new()
	gradient_texture.gradient = gradient
	gradient_texture.fill_from = Vector2(0, 0)
	gradient_texture.fill_to = Vector2(0, 1)
	floor_shade.texture = gradient_texture
	floor_shade.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	floor_shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(floor_shade)
	add_child(safe_root)
	safe_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.add_child(content)
	content.add_theme_constant_override("separation", 10)
	content.alignment = BoxContainer.ALIGNMENT_END
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	status.text = "CZTERY ŚWIATY  ·  JEDNA LEGENDA"
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.add_theme_font_size_override("font_size", 15)
	status.add_theme_color_override("font_color", Color("e6dcc4"))
	status.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.02, 0.95))
	status.add_theme_constant_override("outline_size", 6)
	content.add_child(status)
	start_button.text = "ZACZNIJ PRZYGODĘ"
	start_button.custom_minimum_size = Vector2(380, 70)
	start_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	start_button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	start_button.focus_mode = Control.FOCUS_NONE
	start_button.add_theme_font_override("font", Look.title_font())
	start_button.add_theme_font_size_override("font_size", 25)
	start_button.add_theme_color_override("font_color", Color("fff1ce"))
	PyraSkin.style_button(start_button)
	start_button.add_theme_stylebox_override("normal", PyraSkin.button_box("hover", 30.0, 12.0))   # the start button always shines
	start_button.pressed.connect(start_city)
	content.add_child(start_button)
	powered.texture = load("res://assets/branding/godot/logo-large-color-dark.svg")
	powered.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	powered.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	powered.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.add_child(powered)
	powered_caption.text = "Powered by GODOT ENGINE"
	powered_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	powered_caption.add_theme_font_size_override("font_size", 14)
	powered_caption.add_theme_color_override("font_color", Color("d6e0dc"))
	powered_caption.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.02, 0.95))
	powered_caption.add_theme_constant_override("outline_size", 5)
	safe_root.add_child(powered_caption)
	version_label.text = "KI LEGENDS  " + shown_version()
	version_label.add_theme_font_size_override("font_size", 14)
	version_label.add_theme_color_override("font_color", Color("d6e0dc"))
	version_label.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.02, 0.95))
	version_label.add_theme_constant_override("outline_size", 5)
	version_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.add_child(version_label)
	resized.connect(_layout)
	_layout()
	if Engine.has_meta("ki_autostart"):
		Engine.remove_meta("ki_autostart")   # set by scripts/boot.gd after the entry film already played
		Engine.set_meta("ki_intro_played", true)
		start_menu_music.call_deferred()
		start_city.call_deferred()
	elif not Engine.has_meta("ki_intro_played") and _try_play_ota_intro():
		pass
	else:
		start_menu_music.call_deferred()

## The version the player sees: 1.0 is the installed app; every release published on the server (1.1, 1.2, ...) is an update of the game that the app downloads
## by itself, and the number of the downloaded release replaces it. `manifest_text` is the stored manifest of the last release (tests pass their own).
static func shown_version(manifest_text: String = "") -> String:
	var app_version := str(ProjectSettings.get_setting("application/config/version", "1.0"))
	if manifest_text == "" and FileAccess.file_exists(PyraContent.MANIFEST_PATH):
		manifest_text = FileAccess.get_file_as_string(PyraContent.MANIFEST_PATH)
	var parser := JSON.new()
	var value: Variant = parser.data if manifest_text != "" and parser.parse(manifest_text) == OK else null
	if value is Dictionary and (value as Dictionary).get("manifest") is Dictionary:
		var release := str(((value as Dictionary).manifest as Dictionary).get("version", ""))
		var parts := release.split(".")
		if parts.size() == 2 and parts[0].is_valid_int() and parts[1].is_valid_int():
			return release
	return app_version

func _layout() -> void:
	var area := Rect2(Vector2.ZERO, size)
	if OS.get_name() == "Android":
		var safe := DisplayServer.get_display_safe_area()
		if safe.has_area():
			area = (get_tree().root.get_screen_transform().affine_inverse() * Rect2(safe)).intersection(area)
	safe_root.position = area.position
	safe_root.size = area.size
	floor_shade.position = Vector2(0, size.y - 260)
	floor_shade.size = Vector2(size.x, 260)
	# Landscape: the start button sits bottom-centre, the engine credit in the bottom-right corner.
	powered.size = Vector2(120, 49)
	powered.position = Vector2(area.size.x - 136, area.size.y - 60)
	powered_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	powered_caption.position = Vector2(area.size.x - 336, powered.position.y - 22)
	powered_caption.size = Vector2(320, 20)
	version_label.position = Vector2(16, area.size.y - 30)
	version_label.size = Vector2(320, 20)
	content.size = Vector2(minf(560, area.size.x - 360), 120)
	content.position = Vector2((area.size.x - content.size.x) / 2, area.size.y - content.size.y - 26)
	_fit_intro_overlay()

func start_city() -> void:
	if loading or gate_active or overlay_active or intro_playing or intro_waiting_tap or is_instance_valid(city_instance):
		return
	if not gate_done and (not PyraContent.embedded() or Engine.has_meta("ki_service_required")):
		Engine.remove_meta("ki_service_required")
		run_gate()
		return
	choose_character()

## A device with only the base installed: sign in, check the server, download the start land, then load the city.
func run_gate() -> void:
	gate_active = true
	start_button.disabled = true
	var gate := PyraGate.new()
	add_child(gate)
	var ready_to_play := await gate.run_boot()
	gate.queue_free()
	gate_active = false
	if not ready_to_play:
		get_tree().quit()
		return
	gate_done = true
	start_button.disabled = false
	choose_character()

## A device with several characters asks which one enters the game (also when a new character was begun and not finished: the old ones must stay reachable).
func choose_character() -> void:
	var roster := Characters.list()
	var no_active := not FileAccess.file_exists(Characters.ACTIVE)
	if "--fresh" in OS.get_cmdline_user_args() or roster.size() < 2 and not (roster.size() == 1 and no_active):
		begin_load()
		return
	overlay_active = true
	start_button.disabled = true
	var view = load("res://scripts/character_select.gd").new()
	view.setup(roster)
	add_child(view)
	view.picked.connect(func(id: String) -> void:
		overlay_active = false
		view.queue_free()
		Characters.activate(id)
		begin_load())
	view.new_character.connect(func() -> void:
		overlay_active = false
		view.queue_free()
		Characters.begin_new()
		begin_load())
	view.closed.connect(func() -> void:
		overlay_active = false
		view.queue_free()
		start_button.disabled = false)

func begin_load() -> void:
	active_pointer = -1
	mouse_armed = false
	loading = true
	start_button.disabled = true
	start_button.text = "ŁADOWANIE…"
	status.text = "Wczytywanie świata"
	var error := ResourceLoader.load_threaded_request(CITY_PATH)
	if error != OK:
		load_failed()

func load_failed() -> void:
	loading = false
	start_button.disabled = false
	start_button.text = "SPRÓBUJ PONOWNIE"
	status.text = "Nie udało się wczytać gry. Spróbuj ponownie."

func _process(delta: float) -> void:
	if intro_playing:
		intro_elapsed += delta
		if intro_skip_pill != null and intro_elapsed >= INTRO_SKIP_AFTER:
			intro_skip_pill.visible = true
	if not loading:
		return
	var state := ResourceLoader.load_threaded_get_status(CITY_PATH)
	if state == ResourceLoader.THREAD_LOAD_FAILED or state == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
		load_failed()
	elif state == ResourceLoader.THREAD_LOAD_LOADED:
		var scene := ResourceLoader.load_threaded_get(CITY_PATH) as PackedScene
		if scene == null:
			load_failed()
			return
		loading = false
		city_instance = scene.instantiate()
		get_parent().add_child(city_instance)
		get_tree().current_scene = city_instance
		# No touch capture is passed to the city's joystick or action button.
		hide()
		set_process_input(false)
		set_process(false)
		city_started.emit(city_instance)
		queue_free()

func _input(event: InputEvent) -> void:
	if intro_playing or intro_waiting_tap:
		var pressed := false
		if event is InputEventScreenTouch:
			pressed = (event as InputEventScreenTouch).pressed
		elif event is InputEventMouseButton and (event as InputEventMouseButton).device != InputEvent.DEVICE_ID_EMULATION:
			pressed = (event as InputEventMouseButton).pressed
		elif event is InputEventKey:
			var k := event as InputEventKey
			pressed = k.pressed and not k.echo
		if pressed:
			if intro_waiting_tap or (intro_playing and intro_elapsed >= INTRO_SKIP_AFTER):
				_finish_ota_intro()
		if event is InputEventScreenTouch or event is InputEventMouseButton or event is InputEventKey:
			get_viewport().set_input_as_handled()
		return
	if gate_active or overlay_active:
		return
	if loading:
		if event is InputEventScreenTouch or event is InputEventMouseButton or event is InputEventKey:
			get_viewport().set_input_as_handled()
		return
	var hit := start_button.get_global_rect()
	if event is InputEventScreenTouch:
		if event.pressed and not event.canceled and active_pointer == -1 and hit.has_point(event.position):
			active_pointer = event.index
			get_viewport().set_input_as_handled()
		elif not event.pressed or event.canceled:
			if active_pointer == event.index:
				active_pointer = -1
				if not event.canceled and hit.has_point(event.position):
					start_city()
				get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.device != InputEvent.DEVICE_ID_EMULATION and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			mouse_armed = hit.has_point(event.position)
			if mouse_armed:
				get_viewport().set_input_as_handled()
		else:
			var activate := mouse_armed and hit.has_point(event.position)
			mouse_armed = false
			if activate:
				start_city()
				get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and not event.echo and event.physical_keycode in [KEY_ENTER, KEY_KP_ENTER, KEY_SPACE]:
		start_city()
		get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT or what == NOTIFICATION_WM_GO_BACK_REQUEST:
		active_pointer = -1
		mouse_armed = false
