extends SceneTree
## Real Godot service UI, isolated prototype, input, maps and save sentinels. No production HTTP or credentials.
const Service := preload("res://scripts/service_screen.gd")
const Boot := preload("res://scripts/boot.gd")
var status: Dictionary={"maintenance":true,"canEnter":false,"canPreview":false,"message":"Serwer jest w trakcie konserwacji."}
var checks: Dictionary={}
var output:="/tmp/ki-service-godot"
var screen: Control

func _initialize() -> void:
	run.call_deferred()

func request(_method: int,_path: String,_body: Variant,_with_token: bool,_timeout: float) -> Dictionary:
	return {"status":200,"json":status.duplicate()}

func frames(n: int) -> void:
	for i in n:await process_frame

func check(name: String,ok: bool) -> void:
	checks[name]=ok
	print("PASS " if ok else "FAIL ",name)

func shot(name: String) -> void:
	if DisplayServer.get_name()=="headless":return
	await frames(3)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(output.path_join(name),.92)

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--qa-output="):output=arg.trim_prefix("--qa-output=")
	DirAccess.make_dir_recursive_absolute(output)
	root.size=Vector2i(1280,720)
	var originals: Dictionary={}
	for name in ["city-checkpoint-v1.json","account.json","cloud.json","characters.json"]:
		var path: String="user://"+name
		originals[path]=FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
	check("ordinary_not_allowed",not Service.permits_preview(status))
	var old_core:=Boot.empty_state()
	old_core.file="core-c100-old.pck"
	check("c100_core_cannot_override_new_apk",Boot.compatible_state(old_core).file=="")
	old_core.file="core-c101-current.pck"
	check("matching_core_keeps_bootstrap_state",Boot.compatible_state(old_core).file==old_core.file)
	check("missing_status_denied",not Service.permits_preview({}))
	check("local_role_not_accepted",not Service.permits_preview({"maintenance":true,"roles":["admin"]}))
	screen=Service.new()
	screen.request=request
	root.add_child(screen)
	screen.run()
	await frames(5)
	await screen.open_preview()
	check("ordinary_cannot_create_preview",screen.preview==null)
	await shot("maintenance-player.jpg")
	status={"maintenance":true,"canEnter":true,"canPreview":true}
	await screen.refresh_access()
	await shot("maintenance-admin.jpg")
	await screen.open_preview()
	await frames(30)
	check("preview_is_running",screen.preview!=null and screen.world.hero!=null)
	check("return_button_outside_joystick",screen.close_button.position.y+screen.close_button.size.y<root.size.y*.5)
	var world: Node2D=screen.world
	check("isolated_world2d",world.get_world_2d()!=root.world_2d)
	check("same_data_height",FileAccess.get_sha256("res://service_preview/pyra/data/height.r32")=="186b5bd6bc80da84a31b1c3fabd08bf413fde187b151360fe797355218a85324")
	var viewport: SubViewport=screen.preview.get_child(0)
	var touch:=InputEventScreenTouch.new()
	touch.index=3;touch.pressed=true;touch.position=Vector2(180,540)
	viewport.push_input(touch,true)
	var drag:=InputEventScreenDrag.new()
	drag.index=3;drag.position=Vector2(245,540)
	viewport.push_input(drag,true)
	var second:=InputEventScreenTouch.new()
	second.index=5;second.pressed=true;second.position=Vector2(900,450)
	viewport.push_input(second,true)
	var at: Vector2=world.hero_world
	for i in 60:await physics_frame
	check("touch_movement_in_service_viewport",world.hero_world.distance_to(at)>4 and world.move_pointer==3)
	touch.pressed=false;touch.canceled=true
	viewport.push_input(touch,true)
	check("cancel_releases_service_joystick",world.move_pointer==-1 and world.motion==Vector2.ZERO)
	await shot("isometric-in-service.jpg")
	world.toggle_map()
	await frames(10)
	check("map2d_shared_in_service",world.map_view.world_2d==world.get_world_2d())
	await shot("map2d-in-service.jpg")
	world.toggle_map_mode()
	await frames(10)
	var alignment: Dictionary=world.map_3d.validate_alignment()
	check("map3d_shared_in_service",alignment.height_max_m<.001 and alignment.projection_max_px<.05 and alignment.shares_textures)
	await shot("map3d-in-service.jpg")
	screen.close_button.pressed.emit()
	await frames(5)
	check("return_disposes_viewport",screen.preview==null and screen.world==null and screen.page.visible)
	await screen.open_preview()
	await frames(5)
	check("can_open_again",screen.world!=null)
	status={"maintenance":true,"canEnter":false,"canPreview":false}
	await screen.refresh_access()
	await frames(5)
	check("role_revocation_closes_preview",screen.preview==null and not screen.allowed)
	for path: String in originals:
		var after:=FileAccess.get_sha256(path) if FileAccess.file_exists(path) else "MISSING"
		check("save_unchanged_"+path.get_file(),after==originals[path])
	screen.queue_free()
	await frames(5)
	var failed:=checks.values().filter(func(ok):return not ok).size()
	var file:=FileAccess.open(output.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":checks,"passed":checks.size()-failed,"failed":failed,"renderer":RenderingServer.get_current_rendering_method(),"android_device_tested":false},"\t"))
	file.close()
	quit(0 if failed==0 else 1)
