extends SceneTree
## Renders the animation clips of a rigged GLB hero (one GLB per clip, as Meshy delivers them) into sprite frames: 8 directions, transparent background,
## orthographic camera looking down at PITCH degrees, one fixed framing for every clip so the figure keeps its scale and its ground line.
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/render_hero_sprites.gd -- --dir /path/clips --out /tmp/frames \
##   [--clips walk,idle,attack] [--size 384] [--pitch 22] [--fps 14] [--dirs down,right] [--frames walk=12,idle=8]
const DIRECTIONS := ["down", "down-right", "right", "up-right", "up", "up-left", "left", "down-left"]
const YAW := {"down": 0.0, "down-right": 45.0, "right": 90.0, "up-right": 135.0, "up": 180.0, "up-left": 225.0, "left": 270.0, "down-left": 315.0}
const LOOPING := ["idle", "walk", "run", "runfast", "kiidle", "guard", "channel"]

func _initialize() -> void:
	run.call_deferred()

func arg(name: String, fallback: String) -> String:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == name and i + 1 < args.size():
			return args[i + 1]
	return fallback

func load_model(path: String) -> Node3D:
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	if doc.append_from_file(path, state) != OK:
		return null
	return doc.generate_scene(state) as Node3D

func run() -> void:
	var dir := arg("--dir", "")
	var out := arg("--out", "/tmp/frames")
	var size := int(arg("--size", "384"))
	var pitch := float(arg("--pitch", "22"))
	var fps := float(arg("--fps", "14"))
	var wanted: PackedStringArray = arg("--clips", "").split(",", false)
	var dirs: PackedStringArray = arg("--dirs", ",".join(DIRECTIONS)).split(",", false)
	var frame_override := {}
	for pair in arg("--frames", "").split(",", false):
		var kv := pair.split("=")
		if kv.size() == 2:
			frame_override[kv[0]] = int(kv[1])
	var files: Array[String] = []
	for f in DirAccess.get_files_at(dir):
		if f.ends_with(".glb"):
			var clip := f.get_basename()
			if wanted.is_empty() or wanted.has(clip):
				files.append(clip)
	files.sort()
	var viewport := SubViewport.new()
	viewport.size = Vector2i(size, size)
	viewport.transparent_bg = true
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)
	var pivot := Node3D.new()
	viewport.add_child(pivot)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-45, 25, 0)
	light.light_energy = 1.25
	viewport.add_child(light)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_CLEAR_COLOR
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.9, 0.88, 0.92)
	env.environment.ambient_light_energy = 0.75
	viewport.add_child(env)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.05
	camera.far = 60.0
	viewport.add_child(camera)
	var framed := false
	var height := 1.9
	var unit_scale := 1.0
	for clip in files:
		var model := load_model("%s/%s.glb" % [dir, clip])
		if model == null:
			print("load failed ", clip)
			continue
		pivot.add_child(model)
		# one framing for all clips: from the first model (feet on the ground at the origin, whole figure plus room for raised arms)
		if not framed:
			# a skinned mesh reports a rest-pose box in odd units: the figure is measured on its skeleton (bone positions, plus the head and feet that bones do not cover)
			var skeleton: Skeleton3D = model.find_children("*", "Skeleton3D", true, false)[0]
			var low := 1.0e9
			var high := -1.0e9
			var mid_x := 0.0
			for b in skeleton.get_bone_count():
				var world := skeleton.global_transform * skeleton.get_bone_global_pose(b).origin
				low = minf(low, world.y)
				high = maxf(high, world.y)
				mid_x += world.x
			mid_x /= float(skeleton.get_bone_count())
			var span := high - low
			var feet := low - span * 0.04
			var top := high + span * 0.12
			unit_scale = 1.9 / (top - feet)
			height = 1.9
			model.scale = Vector3.ONE * unit_scale
			model.position = Vector3(-mid_x * unit_scale, -feet * unit_scale, 0)
			framed = true
			camera.size = height * 1.45
			var distance := height * 4.0
			var p := deg_to_rad(pitch)
			camera.position = Vector3(0, height * 0.5 + sin(p) * distance, cos(p) * distance)
			camera.look_at(Vector3(0, height * 0.52, 0))
			print("scale ", unit_scale, " bone span ", span)
		else:
			model.scale = Vector3.ONE * unit_scale
			model.position = Vector3(0, 0, 0)
		var player: AnimationPlayer = null
		for p in model.find_children("*", "AnimationPlayer", true, false):
			player = p
		if player == null or player.get_animation_list().is_empty():
			print("no animation in ", clip)
			pivot.remove_child(model)
			model.queue_free()
			continue
		var anim_name := ""
		for a in player.get_animation_list():
			if a != "RESET":
				anim_name = a
		var animation := player.get_animation(anim_name)
		var length := animation.length
		var looping := LOOPING.has(clip)
		var count: int = int(frame_override.get(clip, clampi(roundi(length * fps), 6, 28)))
		player.play(anim_name)
		player.pause()
		DirAccess.make_dir_recursive_absolute("%s/%s" % [out, clip])
		for f in count:
			var t := length * float(f) / float(count) if looping else length * float(f) / float(maxi(1, count - 1))
			player.seek(t, true)
			for d in dirs:
				pivot.rotation_degrees.y = float(YAW[d])
				await process_frame
				await RenderingServer.frame_post_draw
				viewport.get_texture().get_image().save_png("%s/%s/%s_%02d.png" % [out, clip, d, f])
		print("clip ", clip, " frames ", count, " length ", snappedf(length, 0.01))
		pivot.remove_child(model)
		model.queue_free()
	print("done")
	quit(0)
