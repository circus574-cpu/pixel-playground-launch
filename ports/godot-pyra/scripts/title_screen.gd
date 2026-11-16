class_name PyraTitleScreen
extends Control

signal city_started(city: PyraGame)

const CITY_PATH := "res://scenes/city.tscn"
var loading := false
var city_instance: PyraGame
var start_button := Button.new()
var status := Label.new()
var title := Label.new()
var powered := TextureRect.new()
var powered_caption := Label.new()
var content := VBoxContainer.new()
var safe_root := Control.new()
var active_pointer := -1
var mouse_armed := false

var intro := TextureRect.new()
var floor_shade := TextureRect.new()

func _ready() -> void:
	get_tree().quit_on_go_back = false
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
	start_button.add_theme_font_override("font", load("res://assets/branding/cinzel-bold.ttf"))
	start_button.add_theme_font_size_override("font_size", 25)
	start_button.add_theme_color_override("font_color", Color("fff1ce"))
	var button_style := StyleBoxFlat.new()
	button_style.bg_color = Color(0.16, 0.11, 0.07, 0.9)
	button_style.border_color = Color("e0b96d")
	button_style.set_border_width_all(3)
	button_style.set_corner_radius_all(12)
	start_button.add_theme_stylebox_override("normal", button_style)
	start_button.add_theme_stylebox_override("disabled", button_style)
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
	resized.connect(_layout)
	_layout()

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
	content.size = Vector2(minf(560, area.size.x - 360), 120)
	content.position = Vector2((area.size.x - content.size.x) / 2, area.size.y - content.size.y - 26)

func start_city() -> void:
	if loading or is_instance_valid(city_instance):
		return
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
