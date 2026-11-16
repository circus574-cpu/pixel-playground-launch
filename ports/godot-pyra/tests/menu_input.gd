extends SceneTree

var hud: PyraHud
var checks: Array[Dictionary] = []
var hits: Array[int] = []
var output := "/tmp/ki-menu-input"

func verify(ok: bool, message: String) -> void:
	checks.append({"passed":ok,"name":message})
	if not ok:
		push_error(message)

func settle() -> void:
	for i in 6:
		await process_frame

func touch(index: int, pressed: bool, at: Vector2, canceled := false) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.pressed = pressed
	event.position = at
	event.canceled = canceled
	root.push_input(event, true)

func drag(index: int, at: Vector2) -> void:
	var event := InputEventScreenDrag.new()
	event.index = index
	event.position = at
	root.push_input(event, true)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i + 1 < args.size():
			output = args[i + 1]
	root.size = Vector2i(1600, 720)
	hud = PyraHud.new()
	root.add_child(hud)
	await settle()
	var actions: Array = []
	for i in 16:
		actions.append({"text":"POZYCJA MENU %d" % i,"callback":func(): hits.append(i)})
	hud.show_dialog("MENU", "Dotyk, przewijanie i anulowanie gestów.", actions)
	await settle()
	var list: ScrollContainer = hud.modal_box.get_children()[2]
	var first: Button = list.get_child(0).get_child(0)
	var point := first.get_global_rect().get_center()
	touch(4, true, point)
	verify(hits.is_empty(), "press starts a gesture without activating an action")
	drag(4, point - Vector2(0, 160))
	touch(4, false, point - Vector2(0, 160))
	await settle()
	verify(hits.is_empty() and list.scroll_vertical > 50, "swiping the action list scrolls without activating a button")
	list.scroll_vertical = 0
	await settle()
	touch(4, true, point)
	touch(4, false, point, true)
	verify(hits.is_empty() and hud.ui_pointer == -1, "cancel releases the captured finger without action")
	touch(4, true, point)
	touch(8, false, point)
	verify(hits.is_empty() and hud.ui_pointer == 4, "another finger cannot confirm the action")
	touch(4, false, point)
	verify(hits.size() == 1, "release by the original finger activates exactly once")
	hits.clear()
	touch(4, true, point)
	hud.notification(MainLoop.NOTIFICATION_APPLICATION_FOCUS_OUT)
	touch(4, false, point)
	verify(hits.is_empty() and hud.ui_pointer == -1, "focus loss cancels the gesture")
	var clipped: Button = list.get_child(0).get_child(10)
	verify(not hud.button_contains(clipped, clipped.get_global_rect().get_center()), "a clipped button is not a hit target")
	# A hidden action is geometrically under the always-visible close button.
	var close: Button = hud.buttons[-1]
	touch(4, true, close.get_global_rect().get_center())
	touch(4, false, close.get_global_rect().get_center())
	verify(not hud.modal.visible and hits.is_empty(), "close cannot activate a clipped action behind it")
	hud.show_dialog("MENU", "Dotyk, przewijanie i anulowanie gestów.", actions)
	await settle()
	for dimensions: Vector2i in [Vector2i(854,480),Vector2i(1600,720),Vector2i(1280,720)]:
		root.size = dimensions
		await settle()
		verify(root.get_visible_rect().encloses(hud.modal.get_global_rect()), "menu fits landscape viewport "+str(dimensions))
		if DisplayServer.get_name() != "headless":
			DirAccess.make_dir_recursive_absolute(output)
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(output+"/menu-%dx%d.png" % [dimensions.x,dimensions.y])
	var failed := checks.filter(func(c): return not c.passed).size()
	DirAccess.make_dir_recursive_absolute(output)
	var file := FileAccess.open(output+"/result.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks.size(),"passed":checks.size()-failed,"failed":failed,"results":checks},"\t"))
	file.close()
	print("MENU INPUT QA ",checks.size()-failed,"/",checks.size())
	root.remove_child(hud)
	hud.queue_free()
	await process_frame
	quit(1 if failed else 0)
