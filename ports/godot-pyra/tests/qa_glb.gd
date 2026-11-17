extends SceneTree
## Renders a GLB character from 8 directions (transparent background, orthographic camera) for a look at the model.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_glb.gd -- --glb /path/model.glb --out /tmp/glb-views [--size 512]
const DIRECTIONS := ["down", "down-right", "right", "up-right", "up", "up-left", "left", "down-left"]

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var glb := ""
	var out := "/tmp/glb-views"
	var size := 512
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--glb" and i + 1 < args.size():
			glb = args[i + 1]
		elif args[i] == "--out" and i + 1 < args.size():
			out = args[i + 1]
		elif args[i] == "--size" and i + 1 < args.size():
			size = int(args[i + 1])
	DirAccess.make_dir_recursive_absolute(out)
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	var err := doc.append_from_file(glb, state)
	if err != OK:
		print("GLB load failed ", err)
		quit(1)
		return
	var model: Node3D = doc.generate_scene(state)
	var viewport := SubViewport.new()
	viewport.size = Vector2i(size, size)
	viewport.transparent_bg = true
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var pivot := Node3D.new()
	viewport.add_child(pivot)
	pivot.add_child(model)
	var box := AABB()
	var first := true
	var triangles := 0
	for mesh_node: Node in model.find_children("*", "MeshInstance3D", true, false):
		var mi := mesh_node as MeshInstance3D
		var local := mi.get_aabb()
		var world := mi.global_transform * local
		box = world if first else box.merge(world)
		first = false
		for s in mi.mesh.get_surface_count():
			var arrays := mi.mesh.surface_get_arrays(s)
			var indices: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
			triangles += indices.size() / 3
	print("AABB ", box, " triangles ", triangles, " skeletons ", model.find_children("*", "Skeleton3D", true, false).size())
	var centre := box.get_center()
	model.position -= Vector3(centre.x, box.position.y, centre.z)
	var height := box.size.y
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = height * 1.15
	camera.position = Vector3(0, height * 0.5, height * 3.0)
	viewport.add_child(camera)
	camera.look_at(Vector3(0, height * 0.5, 0))
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-40, 30, 0)
	light.light_energy = 1.2
	viewport.add_child(light)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_CLEAR_COLOR
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.85, 0.85, 0.9)
	env.environment.ambient_light_energy = 0.7
	viewport.add_child(env)
	for i in DIRECTIONS.size():
		pivot.rotation_degrees.y = float(i) * 45.0
		for f in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		viewport.get_texture().get_image().save_png("%s/%s.png" % [out, DIRECTIONS[i]])
	print("rendered ", DIRECTIONS.size(), " views to ", out)
	quit(0)
