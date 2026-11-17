extends SceneTree
## Read-only external GLB inspection. No installation, rigging or animation claims.
var source := ""
var output := "/tmp/ki-meshy-audit"

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--model="): source = arg.substr(8)
		if arg.begins_with("--out="): output = arg.substr(6)
	if source.is_empty():
		push_error("Provide an external --model=<absolute GLB path>")
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(output)
	var document := GLTFDocument.new()
	var state := GLTFState.new()
	var error := document.append_from_file(source,state)
	if error != OK:
		push_error("GLB import failed: %s"%error)
		quit(1)
		return
	var model: Node3D = document.generate_scene(state)
	if model == null:
		quit(1)
		return
	root.size = Vector2i(800,1000)
	root.msaa_3d = Viewport.MSAA_4X
	var stage := Node3D.new()
	root.add_child(stage)
	stage.add_child(model)
	var bounds := AABB()
	var first := true
	var mesh_count := 0
	var material_count := 0
	var skeletons := 0
	var animations: Array[String] = []
	var queue: Array[Node] = [model]
	while not queue.is_empty():
		var node: Node = queue.pop_front()
		for child in node.get_children(): queue.append(child)
		if node is MeshInstance3D:
			var box: AABB = node.global_transform*node.get_aabb()
			bounds = box if first else bounds.merge(box)
			first = false
			mesh_count += 1
			if node.mesh != null: material_count += node.mesh.get_surface_count()
		if node is Skeleton3D: skeletons += 1
		if node is AnimationPlayer:
			for name in node.get_animation_list(): animations.append(str(name))
	if first or bounds.size.y <= 0:
		push_error("No bounded renderable mesh")
		quit(1)
		return
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("202632")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color(0.9,0.94,1.0)
	environment.ambient_light_energy = 0.35
	var world := WorldEnvironment.new()
	world.environment = environment
	stage.add_child(world)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-35,-35,0)
	key.light_energy = 0.8
	stage.add_child(key)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-15,140,0)
	fill.light_energy = 0.3
	stage.add_child(fill)
	var center := bounds.get_center()
	model.position -= Vector3(center.x,bounds.position.y,center.z)
	var height := bounds.size.y
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.keep_aspect = Camera3D.KEEP_HEIGHT
	camera.size = maxf(height,bounds.size.x/0.8)*1.15
	camera.position = Vector3(0,height*0.65,height*3)
	stage.add_child(camera)
	camera.look_at(Vector3(0,height*0.5,0))
	camera.current = true
	var overlay := CanvasLayer.new()
	root.add_child(overlay)
	var label := Label.new()
	label.position = Vector2(14,14)
	label.add_theme_font_size_override("font_size",20)
	overlay.add_child(label)
	var native := DisplayServer.get_name() != "headless"
	for angle in range(0,360,45):
		# Labels describe model rotation, not an assumed front/back convention.
		model.rotation_degrees.y = angle
		label.text = "MESHY GLB / MODEL ROTATION %d / STATIC"%angle
		for i in 8: await process_frame
		if native:
			await RenderingServer.frame_post_draw
			var image := root.get_texture().get_image()
			if image.save_png(output.path_join("view-%03d.png"%angle)) != OK:
				quit(1)
				return
	var report := {"kind":"external-glb-audit","sourceSha256":FileAccess.get_sha256(source),"meshInstances":mesh_count,
		"materialSurfaces":material_count,"skeletonNodes":skeletons,"animationNames":animations,
		"boundsSize":[bounds.size.x,bounds.size.y,bounds.size.z],"display":DisplayServer.get_name(),
		"renderedRotations":[0,45,90,135,180,225,270,315] if native else [],"scope":"Static source model inspection only. No rig, animation, game integration or phone performance acceptance."}
	var file := FileAccess.open(output.path_join("result.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	file.close()
	print("MESHY_GLTF_IMPORTED ",mesh_count," meshes, ",skeletons," skeletons, ",animations.size()," animations")
	finish.call_deferred()

func finish() -> void:
	for child in root.get_children(): child.queue_free()
	for i in 6: await process_frame
	quit(0)
