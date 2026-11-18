extends SceneTree
## Runs from the installed 1.14 APK's resource pack. No game preloads before its boot mounts the update.
var checks: Dictionary={}
var output:="/tmp/ki-preview-update-e2e"
var status: Dictionary={"maintenance":true,"canEnter":true,"canPreview":true}

func _initialize() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--qa-output="):output=arg.trim_prefix("--qa-output=")
	run.call_deferred()

func check(name: String,ok: bool) -> void:
	checks[name]=ok
	print("PASS " if ok else "FAIL ",name)

func request(_method: int,_path: String,_body: Variant,_token: bool,_timeout: float) -> Dictionary:
	return {"status":200,"json":status.duplicate()}

func frames(count: int) -> void:
	for i in count:await process_frame

func shot(name: String) -> void:
	await frames(4)
	await RenderingServer.frame_post_draw
	get_root().get_texture().get_image().save_jpg(output.path_join(name),.93)

func run() -> void:
	DirAccess.make_dir_recursive_absolute(output)
	var original: Dictionary={}
	for name in ["characters.json","city-checkpoint-v1.json","cloud.json"]:
		var file:=FileAccess.open("user://"+name,FileAccess.WRITE)
		file.store_string('{"qa":"preserve-exact-bytes","level":3,"inventory":["qa-item"]}')
		file.close()
		original[name]=FileAccess.get_sha256("user://"+name)
	# This is the ORIGINAL APK boot, not a freshly exported bootstrap.
	var boot: Control=load("res://scenes/boot.tscn").instantiate()
	check("original_apk_1_14",str(ProjectSettings.get_setting("application/config/version"))=="1.14")
	check("original_client_101",int(boot.get_script().get_script_constant_map().get("CLIENT_CODE",0))==101)
	boot.change_scene=false
	boot.play_intro=false
	var state:={"done":false,"report":{}}
	boot.finished.connect(func(report: Dictionary):state.report=report;state.done=true)
	root.add_child(boot)
	var deadline:=Time.get_ticks_msec()+90000
	while not state.done and Time.get_ticks_msec()<deadline:await process_frame
	check("boot_completed",state.done)
	check("server_core_mounted",state.report.get("mounted",false))
	check("no_broken_core",str(state.report.get("broken",""))=="")
	# Load the screen only AFTER the existing client has mounted the server PCK.
	var service: Control=load("res://scripts/service_screen.gd").new()
	service.request=request
	root.add_child(service)
	status={"maintenance":true,"canEnter":false,"canPreview":false}
	await service.open_preview()
	check("guest_cannot_open_preview",service.world==null)
	status={"maintenance":true,"canEnter":true,"canPreview":true}
	service.run()
	await frames(6)
	await service.open_preview()
	await frames(12)
	check("preview_open",service.world!=null)
	if service.world!=null:
		var world: Node2D=service.world
		var material_checks: Dictionary=world.material_library.validate()
		for name: String in material_checks:check("downloaded_"+name,bool(material_checks[name]))
		check("new_buildings",world.building_art.size()==6)
		if "--qa-citadel" in OS.get_cmdline_user_args():
			check("citadel_variant",bool(world.citadel_preview))
			check("start_at_royal_square",world.hero_world.distance_to(Vector2(-51,-173))<.05)
			var closed:=0
			for item: Dictionary in world.architecture.props:
				if item.get("entry")=="closed":closed+=1
			check("all_seven_district_buildings",closed==7)
			check("lanterns_and_chimneys",world.district_ambience.lanterns.size()==5 and world.district_ambience.chimneys.size()==3)
		check("private_world",world.get_world_2d()!=root.world_2d)
		await shot("downloaded-preview.jpg")
		world.toggle_map()
		check("downloaded_map2d",world.map_view.world_2d==world.get_world_2d())
		await shot("downloaded-map2d.jpg")
		world.toggle_map_mode()
		await frames(8)
		var alignment: Dictionary=world.map_3d.validate_alignment()
		check("downloaded_map3d",alignment.height_max_m<.001 and alignment.projection_max_px<.05 and alignment.shares_textures)
		await shot("downloaded-map3d.jpg")
		status={"maintenance":true,"canEnter":false,"canPreview":false}
		await service.refresh_access()
		await frames(5)
		check("revoked_access_closes_preview",service.preview==null)
	for name: String in original:
		check("preserved_"+name,FileAccess.get_sha256("user://"+name)==original[name])
	service.queue_free()
	boot.queue_free()
	await frames(5)
	var failed:=checks.values().filter(func(ok):return not ok).size()
	var result:={"checks":checks,"passed":checks.size()-failed,"failed":failed,"boot_report":state.report,"physical_phone":false,"base_apk":"1.14 / c101","new_apk":false,"renderer":RenderingServer.get_current_rendering_method()}
	var file:=FileAccess.open(output.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(result,"\t"))
	file.close()
	print("PREVIEW_UPDATE_E2E ",JSON.stringify(result))
	quit(0 if failed==0 else 1)
