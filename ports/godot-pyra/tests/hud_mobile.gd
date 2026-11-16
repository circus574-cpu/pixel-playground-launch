extends SceneTree
const GmPanel := preload("res://scripts/gm_panel.gd")
var hud: PyraHud
var output := "/tmp/ki-hud-mobile"
var checks: Array[Dictionary] = []
var map_hits := 0
var gm_hits := 0

class StaffServer extends PyraOnline:
	var authorized := true
	var unreachable := false
	var calls: Array[String] = []
	func request(_method: int, path: String, _body: Variant = null, _token: bool = true, _timeout: float = 15.0, _retry: bool = true) -> Dictionary:
		calls.append(path)
		await get_tree().process_frame
		if unreachable:
			return {"status":0,"json":null}
		if path == "/ws/auth/me":
			return {"status":200,"json":{"account":{"id":account_id,"roles":["gm"] if authorized else []}}}
		if not authorized:
			return {"status":403,"json":{}}
		if path == "/ws/godot/admin/overview":
			return {"status":200,"json":{"settings":{"activeVersion":"qa-1.7","maintenance":false},"stats":{"accounts":3,"saves":4},"online":{"count":2,"byLand":{"pyra":2}}}}
		return {"status":200,"json":{"saves":[{"nick":"QA-GM","race":"legend","level":12,"land":"pyra","slot":1,"revision":7}]}}

func verify(ok: bool, label: String) -> void:
	checks.append({"passed":ok,"name":label})
	if not ok:
		push_error(label)

func settle() -> void:
	for i in 10:
		await process_frame

func touch(index: int, pressed: bool, at: Vector2, canceled := false) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.pressed = pressed
	event.position = at
	event.canceled = canceled
	root.push_input(event, true)

func tap(at: Vector2) -> void:
	touch(7, true, at)
	touch(7, false, at)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--qa-output" and i + 1 < args.size():
			output = args[i + 1]
	DirAccess.make_dir_recursive_absolute(output)
	hud = PyraHud.new()
	root.add_child(hud)
	hud.map_requested.connect(func(): map_hits += 1)
	hud.gm_requested.connect(func(): gm_hits += 1)
	await settle()
	verify(not hud.gm_button.visible, "GM entry hidden from ordinary players")
	for dimensions: Vector2i in [Vector2i(1280,576), Vector2i(844,390), Vector2i(852,393), Vector2i(854,480), Vector2i(1280,720), Vector2i(1600,720)]:
		root.size = dimensions
		await settle()
		for staff in [false,true]:
			hud.set_staff_access(staff)
			await settle()
			var visible := root.get_visible_rect()
			var all_fit := true
			var all_touchable := true
			var separated := true
			for button: Button in hud.button_order:
				var rect := button.get_global_rect()
				var physical := root.get_screen_transform() * rect
				all_fit = all_fit and visible.encloses(rect)
				all_touchable = all_touchable and physical.size.x >= 44 and physical.size.y >= 44
				separated = separated and not rect.intersects(hud.frame_rect) and not rect.intersects(hud.minimap_button.get_global_rect())
				for other: Button in hud.button_order:
					if button != other:
						separated = separated and not rect.intersects(other.get_global_rect())
			verify(all_fit and all_touchable and separated, "navigation fits, >=44 screen pixels, no overlap %s staff=%s" % [str(dimensions),str(staff)])
			var before := map_hits
			tap(hud.minimap_center)
			verify(map_hits == before + 1, "minimap emits map request once %s staff=%s" % [str(dimensions),str(staff)])
	# Large notches consume logical space; staff navigation must reflow rather than overlap the character frame.
	for dimensions: Vector2i in [Vector2i(844,390),Vector2i(854,480),Vector2i(1280,720)]:
		root.size = dimensions
		await settle()
		hud.set_staff_access(true)
		var safe := Rect2(Vector2(70,12), hud.size - Vector2(140,24))
		hud._layout(safe)
		var fits := true
		for button: Button in hud.button_order:
			var rect := button.get_global_rect()
			var physical := root.get_screen_transform() * rect
			fits = fits and safe.encloses(rect) and not rect.intersects(hud.frame_rect) and physical.size.x >= 44 and physical.size.y >= 44
		verify(fits, "staff navigation respects simulated cutouts %s" % str(dimensions))
		hud._layout()
	# Multitouch: a left thumb stays active while the right thumb opens the map.
	hud.set_staff_access(true)
	var before := map_hits
	touch(2, true, hud.touch.left_center + Vector2(40,0))
	var moving := hud.touch.stick
	tap(hud.minimap_center)
	verify(moving.length() > 0 and hud.touch.stick == moving and map_hits == before + 1, "map tap does not steal the left thumb")
	touch(2, false, hud.touch.left_center)
	before = map_hits
	touch(7,true,hud.minimap_center)
	touch(7,false,hud.minimap_center,true)
	verify(map_hits == before and hud.ui_pointer == -1, "canceled minimap tap never opens a screen")
	var corner := hud.minimap_button.get_global_rect().position + Vector2(2,2)
	tap(corner)
	verify(map_hits == before, "minimap square corners are not touch targets")
	tap(hud.gm_button.get_global_rect().get_center())
	verify(gm_hits == 1, "staff HUD button requests the GM panel once")
	hud.show_dialog("NPC", "Rozmowa")
	hud.close_dialog()
	tap(hud.minimap_center)
	verify(map_hits == before + 1, "minimap remains active after closing NPC dialogue")
	root.remove_child(hud)
	hud.queue_free()
	await settle()
	var net := StaffServer.new()
	root.add_child(net)
	net.access_token = "test-access"
	net.refresh_token = "test-refresh"
	net.account_id = "test-account"
	net.roles = ["gm"]
	var panel := GmPanel.new()
	panel.setup(net)
	root.add_child(panel)
	await settle()
	verify(panel.body.text.contains("qa-1.7") and panel.body.text.contains("QA-GM") and panel.body.text.contains("rewizja 7"), "native GM panel shows real response fields (mock server fixture)")
	verify(net.calls == ["/ws/auth/me","/ws/godot/admin/overview","/ws/godot/admin/saves"], "GM panel verifies server roles before protected GET requests")
	for dimensions: Vector2i in [Vector2i(844,390),Vector2i(852,393),Vector2i(854,480),Vector2i(1280,576)]:
		root.size = dimensions
		await settle()
		var physical := root.get_screen_transform() * panel.refresh_button.get_global_rect()
		verify(root.get_visible_rect().encloses(panel.frame.get_global_rect()) and physical.size.x >= 44 and physical.size.y >= 44, "native GM panel fits with >=44 pixel buttons %s" % str(dimensions))
	net.authorized = false
	net.calls.clear()
	panel.refresh_data()
	await settle()
	verify(net.calls == ["/ws/auth/me"] and panel.web_button.disabled and not panel.body.text.contains("QA-GM"), "role revocation clears sensitive data and prevents privileged requests")
	net.authorized = true
	net.unreachable = true
	net.calls.clear()
	panel.refresh_data()
	await settle()
	verify(net.calls == ["/ws/auth/me"] and not net.is_staff() and panel.web_button.disabled, "network failure does not grant staff access")
	net.roles = ["admin"]
	net.sign_out_local()
	verify(net.roles.is_empty() and not net.is_staff(), "logout clears cached staff roles")
	panel.queue_free()
	net.queue_free()
	await settle()
	var failed := checks.filter(func(c): return not c.passed).size()
	var file := FileAccess.open(output+"/result.json", FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks.size(),"passed":checks.size()-failed,"failed":failed,"results":checks},"\t"))
	file.close()
	print("HUD MOBILE QA ", checks.size()-failed,"/",checks.size())
	quit(1 if failed else 0)
