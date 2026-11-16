class_name PyraStoryScreen
extends Control
## The story told before the first steps: the pages of PyraStory.intro(race), shown one by one with the text appearing letter by letter.
## A tap completes the page, a second tap turns it; POMIŃ ends the story at once. `closed` fires when it is over.

signal closed

const CHARS_PER_SECOND := 46.0

var pages: Array = []
var page_index := 0
var shown := 0.0
var title_label := Label.new()
var body := Label.new()
var counter := Label.new()
var next_button := Button.new()
var skip_button := Button.new()
var finished := false

func setup(title: String, story_pages: Array) -> void:
	pages = story_pages
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var background := TextureRect.new()
	background.texture = load("res://assets/branding/intro-wide.webp")
	background.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	background.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	background.modulate = Color(0.22, 0.22, 0.27)
	add_child(background)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.02, 0.04, 0.55)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)
	var column := VBoxContainer.new()
	column.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	column.offset_left = 90
	column.offset_right = -90
	column.offset_top = 40
	column.offset_bottom = -34
	column.add_theme_constant_override("separation", 18)
	add_child(column)
	title_label.text = title
	title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title_label.add_theme_font_override("font", load("res://assets/branding/cinzel-bold.ttf"))
	title_label.add_theme_font_size_override("font_size", 36)
	title_label.add_theme_color_override("font_color", Color("f1c77f"))
	column.add_child(title_label)
	var middle := CenterContainer.new()
	middle.size_flags_vertical = Control.SIZE_EXPAND_FILL
	column.add_child(middle)
	body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.custom_minimum_size = Vector2(860, 0)
	body.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	body.add_theme_font_size_override("font_size", 27)
	body.add_theme_color_override("font_color", Color("efe2c9"))
	body.add_theme_constant_override("line_spacing", 6)
	middle.add_child(body)
	counter.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	counter.add_theme_font_size_override("font_size", 16)
	counter.add_theme_color_override("font_color", Color("b8a98a"))
	column.add_child(counter)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 20)
	column.add_child(row)
	skip_button.text = "POMIŃ"
	next_button.text = "DALEJ"
	for button: Button in [skip_button, next_button]:
		button.custom_minimum_size = Vector2(220, 60)
		button.add_theme_font_size_override("font_size", 22)
		row.add_child(button)
	skip_button.pressed.connect(finish)
	next_button.pressed.connect(advance)
	show_page(0)

func show_page(index: int) -> void:
	page_index = index
	shown = 0.0
	body.text = str(pages[index]) if index < pages.size() else ""
	body.visible_characters = 0
	counter.text = "%d / %d" % [index + 1, pages.size()]
	next_button.text = "DALEJ" if index < pages.size() - 1 else "ZACZNIJ PRZYGODĘ"

func page_complete() -> bool:
	return body.visible_characters >= body.text.length() or body.visible_characters < 0

func _process(delta: float) -> void:
	if finished or page_complete():
		return
	shown += delta * CHARS_PER_SECOND
	body.visible_characters = mini(int(shown), body.text.length())

## First press completes the page, the next one turns it.
func advance() -> void:
	if finished:
		return
	if not page_complete():
		body.visible_characters = -1
		return
	if page_index >= pages.size() - 1:
		finish()
	else:
		show_page(page_index + 1)

func finish() -> void:
	if finished:
		return
	finished = true
	closed.emit()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and (event.keycode == KEY_SPACE or event.keycode == KEY_ENTER):
		advance()
		get_viewport().set_input_as_handled()
