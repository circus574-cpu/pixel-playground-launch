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

func _ready() -> void:
	get_tree().quit_on_go_back = false
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	var background := TextureRect.new()
	background.texture = load("res://assets/rooms/hall.webp")
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
	var shade := ColorRect.new()
	shade.color = Color(0.025, 0.045, 0.065, 0.91)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	add_child(safe_root)
	safe_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.add_child(content)
	content.add_theme_constant_override("separation", 14)
	content.alignment = BoxContainer.ALIGNMENT_CENTER
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var crest := TextureRect.new()
	crest.texture = load("res://assets/branding/icon.png")
	crest.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	crest.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	crest.custom_minimum_size = Vector2(0, 110)
	crest.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(crest)
	title.text = "KI LEGENDS"
	title.add_theme_font_override("font", load("res://assets/branding/cinzel-bold.ttf"))
	title.add_theme_font_size_override("font_size", 72)
	title.add_theme_color_override("font_color", Color("e5c98c"))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	content.add_child(title)
	var subtitle := Label.new()
	subtitle.text = "CZTERY ŚWIATY. JEDNA LEGENDA."
	subtitle.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	subtitle.add_theme_font_size_override("font_size", 16)
	subtitle.add_theme_color_override("font_color", Color("a6b9b4"))
	content.add_child(subtitle)
	var space := Control.new()
	space.custom_minimum_size.y = 12
	content.add_child(space)
	start_button.text = "WEJDŹ DO PYRY"
	start_button.custom_minimum_size = Vector2(390, 96)
	start_button.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	start_button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	start_button.focus_mode = Control.FOCUS_NONE
	start_button.add_theme_font_size_override("font_size", 24)
	start_button.add_theme_color_override("font_color", Color("fff1ce"))
	var button_style := StyleBoxFlat.new()
	button_style.bg_color = Color("3a3021")
	button_style.border_color = Color("c5a267")
	button_style.set_border_width_all(2)
	button_style.set_corner_radius_all(10)
	start_button.add_theme_stylebox_override("normal", button_style)
	start_button.add_theme_stylebox_override("disabled", button_style)
	start_button.pressed.connect(start_city)
	content.add_child(start_button)
	status.text = "TWIERDZA POPIOŁU  ·  PODRÓŻ ZACZYNA SIĘ TUTAJ"
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.add_theme_font_size_override("font_size", 14)
	status.add_theme_color_override("font_color", Color("b8b7af"))
	content.add_child(status)
	powered.texture = load("res://assets/branding/godot/logo-large-color-dark.svg")
	powered.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	powered.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	powered.mouse_filter = Control.MOUSE_FILTER_IGNORE
	safe_root.add_child(powered)
	powered_caption.text = "Powered by"
	powered_caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	powered_caption.add_theme_font_size_override("font_size", 14)
	powered_caption.add_theme_color_override("font_color", Color("c3d0cc"))
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
	content.size = Vector2(minf(720, area.size.x - 56), 520)
	content.position = (area.size - content.size) / 2 - Vector2(0, 22)
	powered.position = Vector2((area.size.x - 220) / 2, area.size.y - 110)
	powered.size = Vector2(220, 89)
	powered_caption.position = Vector2(0, powered.position.y - 25)
	powered_caption.size = Vector2(area.size.x, 22)

func start_city() -> void:
	if loading or is_instance_valid(city_instance):
		return
	active_pointer = -1
	mouse_armed = false
	loading = true
	start_button.disabled = true
	start_button.text = "ŁADOWANIE…"
	status.text = "Przygotowywanie Twierdzy Popiołu"
	var error := ResourceLoader.load_threaded_request(CITY_PATH)
	if error != OK:
		load_failed()

func load_failed() -> void:
	loading = false
	start_button.disabled = false
	start_button.text = "SPRÓBUJ PONOWNIE"
	status.text = "Nie udało się otworzyć miasta. Spróbuj ponownie."

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
