extends SceneTree

var game: PyraGame
var results: Array[Dictionary] = []
var failures: Array[String] = []
var output := "user://qa"

func _initialize() -> void:
	run.call_deferred()

func verify(condition: bool, name: String, details: Variant = null) -> void:
	results.append({"name":name,"passed":condition,"details":details})
	if not condition:
		failures.append(name)
		push_error("FAILED: " + name + " " + str(details))

func settle(count: int = 3) -> void:
	for i in range(count):
		await process_frame
		await physics_frame

func touch(index: int, pressed: bool, at: Vector2, canceled: bool = false) -> void:
	var event := InputEventScreenTouch.new()
	event.index = index
	event.position = at
	event.pressed = pressed
	event.canceled = canceled
	# Coordinates are viewport-local. Headless windows are physically 64x64, even
	# when the logical stretched canvas is 1280px; push through the real viewport.
	root.push_input(event, true)

func free_start(length: float = 190.0) -> Vector2:
	var bounds := game.active_bounds
	for y in range(int(bounds.position.y + 70), int(bounds.end.y - 70), 45):
		for x in range(int(bounds.position.x + 70), int(bounds.end.x - length - 70), 45):
			var at := Vector2(x,y)
			var free := true
			for i in range(12):
				if not game.can_stand(at + Vector2(length * i / 11,0), ""):
					free = false
			for target in game.targets:
				if at.distance_to(target.point) < game.INTERACTION_RANGE + 40:
					free = false
			if free:
				return at
	return Vector2(-1000,-1000)

func capture(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output + "/" + name + ".png")

func walk_to(destination: Vector2) -> bool:
	var grid := AStarGrid2D.new()
	const CELL := 24
	var box := game.active_bounds
	grid.region = Rect2i(Vector2i(floori(box.position.x/CELL),floori(box.position.y/CELL)),Vector2i(ceili(box.size.x/CELL)+1,ceili(box.size.y/CELL)+1))
	grid.cell_size = Vector2(CELL,CELL)
	grid.offset = Vector2(CELL/2.0,CELL/2.0)
	grid.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	grid.update()
	var goal := Vector2i.ZERO
	var distance := INF
	for y in range(grid.region.position.y,grid.region.end.y):
		for x in range(grid.region.position.x,grid.region.end.x):
			var id := Vector2i(x,y)
			var at := grid.get_point_position(id)
			var free := game.can_stand(at,game.current_room)
			grid.set_point_solid(id,not free)
			if free and at.distance_to(destination) < distance:
				distance = at.distance_to(destination)
				goal = id
	var start := Vector2i(floori(game.player.position.x/CELL),floori(game.player.position.y/CELL))
	if not grid.is_in_boundsv(start) or grid.is_point_solid(start):
		return false
	var route := grid.get_point_path(start,goal)
	if route.is_empty():
		return false
	var deadline := Time.get_ticks_msec() + 30000
	for waypoint in route:
		while game.player.position.distance_to(waypoint) > 14:
			game.player.touch_motion = (waypoint-game.player.position).normalized()
			await physics_frame
			if Time.get_ticks_msec() > deadline:
				game.player.touch_motion = Vector2.ZERO
				return false
	game.player.touch_motion = Vector2.ZERO
	await settle()
	return true

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in range(args.size()):
		if args[i] == "--qa-output" and i+1 < args.size():
			output = args[i+1]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(output))
	var entry_path: String = ProjectSettings.get_setting("application/run/main_scene")
	var landing: PyraTitleScreen = load(entry_path).instantiate()
	root.add_child(landing)
	await settle(5)
	verify(landing.title.text == "KI LEGENDS" and landing.powered.text == "Powered by GODOT ENGINE", "actual entry scene displays brand and Godot credit")
	verify(root.get_children().filter(func(n): return n is PyraGame).is_empty(), "city is not instantiated behind the title")
	var config := ConfigFile.new()
	config.load("res://export_presets.cfg")
	verify(config.get_value("preset.0.options","launcher_icons/main_192x192","") == ProjectSettings.get_setting("application/config/icon"), "Android launcher and desktop use KI icon")
	for viewport: Vector2i in [Vector2i(854,480),Vector2i(1280,720),Vector2i(1600,720)]:
		root.size = viewport
		await settle(5)
		verify(Rect2(Vector2.ZERO,root.get_visible_rect().size).encloses(landing.start_button.get_global_rect()) and not landing.start_button.get_global_rect().intersects(landing.powered.get_global_rect()), "title layout and credit are separate: "+str(viewport))
		await capture("title-%dx%d" % [viewport.x,viewport.y])
	root.size = Vector2i(1280,720)
	await settle(5)
	var play_center := landing.start_button.get_global_rect().get_center()
	touch(5,true,play_center)
	touch(5,false,play_center,true)
	verify(not landing.loading and landing.active_pointer == -1, "cancelled start touch does not load city")
	touch(5,true,play_center)
	landing.notification(MainLoop.NOTIFICATION_APPLICATION_FOCUS_OUT)
	touch(5,false,play_center)
	verify(not landing.loading, "focus loss disarms start button")
	touch(5,true,play_center)
	touch(7,false,play_center)
	verify(not landing.loading and landing.active_pointer == 5, "other finger cannot activate start button")
	touch(5,false,play_center)
	landing.start_city()
	verify(landing.loading and landing.start_button.disabled, "start touch loads city and rejects duplicate activation")
	var load_deadline := Time.get_ticks_msec() + 15000
	while is_instance_valid(landing) and Time.get_ticks_msec() < load_deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0] if root.get_children().any(func(n): return n is PyraGame) else null
	verify(is_instance_valid(game) and root.get_children().filter(func(n): return n is PyraGame).size() == 1, "title hands off to exactly one playable city")
	if not is_instance_valid(game):
		quit(1)
		return
	verify(game.hud.touch.move_pointer == -1 and game.player.touch_motion == Vector2.ZERO, "start touch is not inherited by city controls")
	await settle(5)
	verify(game.data.name == "Twierdza Popiołu" and game.data.buildings.size() == 6 and game.data.npcs.size() == 8,"production capital: six buildings, eight NPCs")
	verify(game.player.speed == float(game.data.speed),"movement speed comes from the owner race base",game.player.speed)
	verify(game.can_stand(game.player.position,""),"canonical start is clear")
	verify(game.targets.filter(func(t): return t.kind == "npc").size() == 2,"only two outdoor NPCs, interior residents stay indoors")
	await capture("city-spawn")
	var directions := ["right","down-right","down","down-left","left","up-left","up","up-right"]
	for i in range(8):
		game.player.visual.animate(Vector2.from_angle(i*PI/4.0))
		verify(game.player.visual.direction == directions[i] and str(game.player.visual.sprite.animation).begins_with("walk:"),"eight-direction clip: "+directions[i])
	game.player.visual.animate(Vector2.LEFT)
	verify(game.player.visual.sprite.flip_h,"left walk preserves production mirrored clip")
	game.player.visual.animate(Vector2.ZERO)
	verify(str(game.player.visual.sprite.animation).begins_with("idle:"),"stopping returns to idle")
	var free := free_start()
	verify(game.can_stand(free,""),"a physically clear movement corridor exists")
	game.player.position = free
	touch(0,true,game.hud.touch.left_center+Vector2(84,0))
	await settle()
	var moving := game.player.touch_motion
	touch(1,true,game.hud.touch.right_center)
	touch(1,false,game.hud.touch.right_center)
	verify(moving.x > 0.9 and game.player.touch_motion.x > 0.9,"second finger action/release preserves joystick",{"before":str(moving),"after":str(game.player.touch_motion)})
	touch(0,false,game.hud.touch.left_center,true)
	verify(game.player.touch_motion == Vector2.ZERO and game.hud.touch.move_pointer == -1,"touch cancellation releases movement")
	# Opening and closing a real NPC dialog must release captured pointers.
	game.player.position = game.point(game.data.spawn)
	game.interact()
	verify(game.hud.modal.visible and game.player.locked and game.player.touch_motion == Vector2.ZERO,"NPC dialog opens and releases movement")
	await settle()
	var close: Button = game.hud.buttons[-1]
	touch(2,true,close.get_global_rect().get_center())
	touch(2,false,close.get_global_rect().get_center())
	verify(not game.hud.modal.visible and not game.player.locked,"dialog closes with a separate touch index")
	touch(0,true,game.hud.touch.left_center+Vector2(84,0))
	verify(game.player.touch_motion.x > 0.9,"joystick works immediately after dialog")
	touch(0,false,game.hud.touch.left_center)
	game.hud.close_dialog()
	# Check actual swept physics against an authored building footprint.
	var tested_collision := false
	for obstacle: Dictionary in game.data.obstacles:
		var box := game.rectangle(obstacle)
		var below := Vector2(box.get_center().x,box.end.y+18)
		if game.active_bounds.encloses(box) and game.can_stand(below,""):
			game.player.position = below
			game.player.touch_motion = Vector2.UP
			for i in range(20):
				await physics_frame
			game.player.touch_motion = Vector2.ZERO
			verify(game.player.position.y >= box.end.y+11.5 and game.player.position.y <= box.end.y+12.2 and game.player.position.y < below.y-2,"authored footprint blocks the CharacterBody2D",{"y":game.player.position.y,"wall":box.end.y,"start":below.y})
			tested_collision = true
			break
	verify(tested_collision,"an authored footprint was tested")
	# Fixed physics must preserve speed at low/high render caps.
	var distances: Array[float] = []
	for cap in [30,120]:
		game.player.position = free
		Engine.max_fps = cap
		game.player.touch_motion = Vector2.RIGHT
		await create_timer(0.7).timeout
		game.player.touch_motion = Vector2.ZERO
		distances.append(game.player.position.x-free.x)
	Engine.max_fps = 60
	verify(absf(distances[0]-distances[1]) < game.player.speed*0.1 and distances.min() > game.player.speed*0.55 and distances.max() < game.player.speed*0.85,"30/120 FPS do not change movement speed",distances)
	# Walk from the source spawn to the hall using actual physics, then interact.
	game.player.position = game.point(game.data.spawn)
	var hall: Dictionary = game.data.buildings.filter(func(b):return b.id == "hall")[0]
	var travelled: bool = await walk_to(game.point(hall.door))
	verify(travelled,"production spawn -> hall door is navigable through CharacterBody2D")
	game.interact()
	await settle()
	verify(game.current_room == "hall","walking to the hall and interacting enters the original room")
	await capture("hall-entered")
	if game.current_room == "hall":
		var resident: Dictionary = game.targets.filter(func(t):return t.kind == "npc")[0]
		var reached: bool = await walk_to(resident.point)
		game.interact()
		await settle()
		verify(reached and game.hud.modal.visible,"walk across the hall and talk to the resident")
		await capture("hall-dialog")
		game.hud.close_dialog()
	game.load_space("",game.city_return)
	await settle()
	# Every entrance and every room has a clear entry and a stable return point.
	for building: Dictionary in game.data.buildings:
		game.player.position = game.point(building.door)
		var before := game.player.position
		verify(game.can_stand(before,""),"clear entrance: "+building.id)
		game.interact()
		await settle()
		verify(game.current_room == building.id and game.can_stand(game.player.position,building.id),"enter original room: "+building.id)
		await capture("room-"+building.id)
		game.go_back()
		await settle()
		verify(game.current_room.is_empty() and game.player.position.distance_to(before)<0.01,"return to the same entrance: "+building.id)
	# The checkpoint has its own format and path; unknown/newer data cannot be overwritten.
	game.player.position = free
	game.city_return = free
	var save_path := "user://qa-checkpoint.json"
	verify(game.save_checkpoint(save_path),"isolated checkpoint writes atomically")
	game.player.position += Vector2(20,0)
	verify(game.restore_checkpoint(save_path) and game.player.position.distance_to(free)<0.01,"checkpoint round-trip")
	var f := FileAccess.open(save_path,FileAccess.WRITE)
	var newer := '{"format":"ki-godot-pyra-save-1","version":9,"important":"preserve"}'
	f.store_string(newer)
	f.close()
	verify(not game.restore_checkpoint(save_path) and not game.save_checkpoint(save_path) and FileAccess.get_file_as_string(save_path)==newer,"unknown checkpoint version is preserved")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(save_path))
	game.checkpoint_protected = false
	game.load_space("",game.point(game.data.spawn))
	await settle()
	game.show_menu()
	await settle()
	verify(game.hud.modal.visible and game.player.locked,"menu suspends and clears input")
	await capture("menu")
	game.hud.close_dialog()
	await settle()
	game.hud.notice.text = ""
	game.hud.notice_until = 0
	# Layout stays inside the real viewport at common Android landscape sizes.
	for dimensions in [Vector2i(854,480),Vector2i(1600,720),Vector2i(1280,720)]:
		root.size = dimensions
		await settle(4)
		var view := root.get_visible_rect()
		verify(view.encloses(game.hud.menu_button.get_global_rect()) and view.has_point(game.hud.touch.left_center) and view.has_point(game.hud.touch.right_center),"landscape layout: "+str(dimensions))
		await capture("city-"+str(dimensions.x)+"x"+str(dimensions.y))
	var safe := Rect2(Vector2(44,30),game.hud.size-Vector2(88,60))
	game.hud.touch.set_safe_area(safe)
	verify(game.hud.touch.left_center.x-91>=safe.position.x and game.hud.touch.right_center.x+65<=safe.end.x and game.hud.touch.left_center.y+91<=safe.end.y,"touch pads respect configured display cutout margins")
	game.hud._layout()
	var report := {"engine":Engine.get_version_info().string,"display":DisplayServer.get_name(),"rendering":RenderingServer.get_current_rendering_method(),"checks":results.size(),"passed":results.size()-failures.size(),"failed":failures.size(),"results":results,"physicalAndroidDevice":false}
	var file := FileAccess.open(output+"/result.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	file.close()
	print("PYRA GODOT QA: ",JSON.stringify(report))
	root.remove_child(game)
	game.queue_free()
	await process_frame
	await process_frame
	quit(0 if failures.is_empty() else 1)
