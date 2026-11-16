class_name PyraTitleScreen
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)

signal city_started(city: PyraGame)

const CITY_PATH := "res://scenes/city.tscn"
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
var gate_done := false

var intro := TextureRect.new()
var floor_shade := TextureRect.new()

func _ready() -> void:
	get_tree().quit_on_go_back = false
	PyraSkin.install(get_tree())
	Look.install_letters(get_tree())
	var music := PyraAudio.new()
	add_child(music)
	music.play_music.call_deferred("loading")
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
		Engine.remove_meta("ki_autostart")   # set by scripts/boot.gd after the entry film said "touch to start"
		start_city.call_deferred()

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

func start_city() -> void:
	if loading or gate_active or is_instance_valid(city_instance):
		return
	if not gate_done and not PyraContent.embedded():
		run_gate()
		return
	begin_load()

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
	begin_load()

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

func _process(_delta: float) -> void:
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
	if gate_active:
		return
	if loading:
		if event is InputEventScreenTouch or event is InputEventMouseButton or event is InputEventKey:
			get_viewport().set_input_as_handled()
		return
	var hit := start_button.get_global_rect()
	if event is InputEventScreenTouch:
		if event.pressed and not event.canceled and active_pointer == -1 and hit.has_point(event.position):
			active_pointer = event.index
		elif not event.pressed or event.canceled:
			if active_pointer == event.index:
				active_pointer = -1
				if not event.canceled and hit.has_point(event.position):
					start_city()
		get_viewport().set_input_as_handled()
	elif event is InputEventMouseButton and event.device != InputEvent.DEVICE_ID_EMULATION and event.button_index == MOUSE_BUTTON_LEFT:
		if event.pressed:
			mouse_armed = hit.has_point(event.position)
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
