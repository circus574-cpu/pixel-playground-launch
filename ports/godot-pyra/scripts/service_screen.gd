extends Control
## Uses the normal authenticated HTTP transport, never a local GM flag. Preview is a disposable private World2D.
signal picked(action: String)
const SCENE := "res://service_preview/pyra/world.tscn"
var request: Callable
var allowed := false
var preview: SubViewportContainer
var world: Node2D
var close_button: Button
var page := VBoxContainer.new()
var caption := Label.new()
var timer := Timer.new()
var checking := false
var full_mode := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter=Control.MOUSE_FILTER_STOP
	var back:=ColorRect.new()
	back.color=Color("0a101b")
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(back)
	page.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	page.grow_horizontal=Control.GROW_DIRECTION_BOTH
	page.grow_vertical=Control.GROW_DIRECTION_BOTH
	page.custom_minimum_size=Vector2(600,0)
	page.add_theme_constant_override("separation",18)
	add_child(page)
	var title:=Label.new()
	title.text="KI LEGENDS · TEST SERWER"
	title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size",30)
	page.add_child(title)
	caption.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	caption.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	caption.add_theme_font_size_override("font_size",22)
	page.add_child(caption)
	timer.wait_time=3
	timer.timeout.connect(refresh_access)
	add_child(timer)
	resized.connect(layout_preview)
	set_process_unhandled_key_input(true)

func read_status() -> Dictionary:
	if not request.is_valid():return {}
	var result: Dictionary=await request.call(HTTPClient.METHOD_GET,"/ws/godot/status",null,true,8.0)
	if int(result.get("status",0))!=200 or not result.get("json") is Dictionary:return {}
	return result.json

static func permits_preview(status: Dictionary) -> bool:
	return status.get("maintenance")==true and status.get("canPreview")==true and status.get("canEnter")==true

func run() -> String:
	caption.text="Sprawdzanie dostępu…"
	var status:=await read_status()
	if status.get("maintenance")==false and status.get("canEnter")==true:
		if ResourceLoader.exists(SCENE):
			open_world(true)
			timer.start()
			return await picked
		return "continue"
	show_status(status)
	timer.start()
	return await picked

func show_status(status: Dictionary) -> void:
	allowed=permits_preview(status)
	caption.text="Podgląd administratora. Ta scena nie zmienia zapisów postaci." if allowed else str(status.get("message","Nie można sprawdzić serwera. Spróbuj ponownie."))
	for child in page.get_children():
		if child is Button:child.queue_free()
	if allowed:
		button("PROTOTYP IZOMETRYCZNY · PYRA",open_preview)
		button("WEJDŹ DO GRY",func():open_world(true))
	else:
		button("ZALOGUJ JAKO ADMINISTRATOR",func():picked.emit("login"))
	button("SPRAWDŹ PONOWNIE",refresh_access)
	button("ZAMKNIJ",func():picked.emit("quit"))

func button(text: String, action: Callable) -> void:
	var control:=Button.new()
	control.text=text
	control.custom_minimum_size=Vector2(580,84)
	control.add_theme_font_size_override("font_size",22)
	control.pressed.connect(action)
	page.add_child(control)

func refresh_access() -> void:
	if checking:return
	checking=true
	var status:=await read_status()
	checking=false
	if not is_inside_tree():return
	if preview!=null and not full_mode and not permits_preview(status):close_preview()
	if status.get("maintenance")==false and status.get("canEnter")==true:
		if preview==null:
			if ResourceLoader.exists(SCENE):open_world(true)
			else:picked.emit("continue")
		return
	show_status(status)

func open_preview() -> void:
	if checking or preview!=null:return
	checking=true
	var status:=await read_status()
	checking=false
	if not permits_preview(status):
		show_status(status)
		return
	open_world(false)

func open_world(full: bool) -> void:
	if preview!=null:return
	full_mode=full
	if not ResourceLoader.exists(SCENE):
		caption.text="Brak paczki prototypu. Wymagana jest wersja aplikacji z podglądem izometrii."
		return
	var scene:=load(SCENE) as PackedScene
	if scene==null:return
	page.hide()
	preview=SubViewportContainer.new()
	preview.stretch=true
	preview.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(preview)
	var viewport:=SubViewport.new()
	viewport.world_2d=World2D.new()
	viewport.size=Vector2i(get_viewport_rect().size)
	preview.add_child(viewport)
	world=scene.instantiate()
	viewport.add_child(world)
	if not full:
		close_button=Button.new()
		close_button.text="WRÓĆ · TRYB SERWISOWY"
		close_button.custom_minimum_size=Vector2(330,84)
		close_button.add_theme_font_size_override("font_size",20)
		close_button.pressed.connect(close_preview)
		add_child(close_button)
	layout_preview()

func layout_preview() -> void:
	if preview==null or close_button==null:return
	var safe:=Rect2(Vector2.ZERO,get_viewport_rect().size)
	if OS.get_name()=="Android":
		var screen:=DisplayServer.get_display_safe_area()
		if screen.has_area():safe=(get_tree().root.get_screen_transform().affine_inverse()*Rect2(screen)).intersection(safe)
	close_button.position=Vector2(safe.get_center().x-165,safe.position.y+16)

func close_preview() -> void:
	if preview==null:return
	world.motion=Vector2.ZERO
	world.move_pointer=-1
	preview.queue_free()
	preview=null
	world=null
	if close_button!=null:close_button.queue_free()
	close_button=null
	full_mode=false
	page.show()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode==KEY_ESCAPE and preview!=null:
		close_preview()
		get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what==NOTIFICATION_WM_GO_BACK_REQUEST:
		if preview!=null:close_preview()
		else:picked.emit("quit")
