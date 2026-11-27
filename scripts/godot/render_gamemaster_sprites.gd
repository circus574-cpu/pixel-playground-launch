extends SceneTree
## Renders all 8 isometric animation clips of KI-Legends-GameMaster.glb into 5-direction
## transparent PNG frames (down, down-right, right, up-right, up; left directions mirrored in packer),
## preserving full-body framing even during airborne hover/glide/takeoff/land clips so actor_view.gd
## drives real-time vertical levitation height and ground shadows with zero clipping.
##
## Usage:
##   xvfb-run -a -s '-screen 0 1280x960x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy \
##     --path ports/godot-isometric-world --rendering-method gl_compatibility \
##     --script ../../scripts/godot/render_gamemaster_sprites.gd -- \
##     --glb /path/to/KI-Legends-GameMaster.glb --out /tmp/gm_frames [--size 512] [--pitch 22]

const DIRS := ["down", "down-right", "right", "up-right", "up"]
const YAW := {
	"down": 0.0,
	"down-right": 45.0,
	"right": 90.0,
	"up-right": 135.0,
	"up": 180.0,
}

# clip_key -> { anim, n, t0, t1, loop, normalize_y }
const CLIP_SPECS := {
	"idle":         {"anim": "takeoff",      "n": 6,  "t0": 0.0,  "t1": 0.22, "loop": true,  "normalize_y": false, "pingpong": true},
	"walk":         {"anim": "walk",         "n": 14, "t0": 0.0,  "t1": -1.0, "loop": true,  "normalize_y": false},
	"takeoff":      {"anim": "takeoff",      "n": 12, "t0": 0.0,  "t1": -1.0, "loop": false, "normalize_y": true},
	"hover":        {"anim": "hover",        "n": 14, "t0": 0.0,  "t1": -1.0, "loop": true,  "normalize_y": true},
	"glide":        {"anim": "glide",        "n": 12, "t0": 0.0,  "t1": -1.0, "loop": true,  "normalize_y": true},
	"land":         {"anim": "land",         "n": 10, "t0": 0.0,  "t1": -1.0, "loop": false, "normalize_y": true},
	"heavy_strike": {"anim": "heavy_strike", "n": 16, "t0": 0.0,  "t1": -1.0, "loop": false, "normalize_y": false},
	"ki_blast":     {"anim": "ki_blast",     "n": 16, "t0": 0.0,  "t1": -1.0, "loop": false, "normalize_y": false},
}

func _initialize() -> void:
	run.call_deferred()

func _arg(name: String, fallback: String) -> String:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == name and i + 1 < args.size():
			return args[i + 1]
	return fallback

func _load_glb(path: String) -> Node3D:
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	if doc.append_from_file(path, state) != OK:
		return null
	return doc.generate_scene(state) as Node3D

func _skeleton_y_bounds(skeleton: Skeleton3D, model: Node3D, unit_scale: float) -> Vector2:
	var low := 1.0e9
	var high := -1.0e9
	var to_model := model.global_transform.affine_inverse() * skeleton.global_transform
	for b in skeleton.get_bone_count():
		var p: Vector3 = (to_model * skeleton.get_bone_global_pose(b).origin) * unit_scale
		low = minf(low, p.y)
		high = maxf(high, p.y)
	return Vector2(low, high)

func run() -> void:
	var glb_path := _arg("--glb", "")
	var out_dir := _arg("--out", "/tmp/gm_frames")
	var size := int(_arg("--size", "512"))
	var pitch := float(_arg("--pitch", "22"))
	var wanted_raw := _arg("--clips", "")
	var wanted: PackedStringArray = wanted_raw.split(",", false) if not wanted_raw.is_empty() else PackedStringArray()

	if glb_path.is_empty() or not FileAccess.file_exists(glb_path):
		printerr("Missing --glb file: ", glb_path)
		quit(2)
		return

	var viewport := SubViewport.new()
	viewport.size = Vector2i(size, size)
	viewport.transparent_bg = true
	viewport.msaa_3d = Viewport.MSAA_2X
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(viewport)

	var pivot := Node3D.new()
	viewport.add_child(pivot)

	# Studio lighting matching KI-Legends-GameMaster showcase + isometric heroes
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-46, -24, 0)
	key.light_color = Color("#fff2dc")
	key.light_energy = 1.42
	viewport.add_child(key)

	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-22, 134, 0)
	rim.light_color = Color("#7ec2ff")
	rim.light_energy = 0.96
	viewport.add_child(rim)

	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-25, 35, 0)
	fill.light_color = Color("#f6ecff")
	fill.light_energy = 0.45
	viewport.add_child(fill)

	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_CLEAR_COLOR
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.88, 0.91, 0.98)
	env.environment.ambient_light_energy = 0.62
	viewport.add_child(env)

	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.near = 0.05
	camera.far = 80.0
	viewport.add_child(camera)

	var model := _load_glb(glb_path)
	if model == null:
		printerr("Failed to load GLB: ", glb_path)
		quit(3)
		return
	pivot.add_child(model)

	# Prevent frustum culling on large animated bounds and boost glowing blue eyes slightly for crisp sprites
	for mi: MeshInstance3D in model.find_children("*", "MeshInstance3D", true, false):
		mi.extra_cull_margin = 16384.0
		for si in mi.get_surface_override_material_count():
			var mat := mi.get_active_material(si)
			if mat is BaseMaterial3D:
				var bm := mat as BaseMaterial3D
				if bm.emission_enabled:
					bm.emission_energy_multiplier = maxf(bm.emission_energy_multiplier, 5.4)

	var players := model.find_children("*", "AnimationPlayer", true, false)
	var skeletons := model.find_children("*", "Skeleton3D", true, false)
	if players.is_empty() or skeletons.is_empty():
		printerr("GLB missing AnimationPlayer or Skeleton3D")
		quit(4)
		return
	var player := players[0] as AnimationPlayer
	var skeleton := skeletons[0] as Skeleton3D
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL

	var hips := skeleton.find_bone("Hips")
	if hips < 0:
		hips = 0

	# Measure canonical height on grounded walk frame 0 so scale matches render_hero_sprites.gd
	player.play("walk")
	player.seek(0.0, true)
	skeleton.force_update_all_bone_transforms()
	var rest_bounds := _skeleton_y_bounds(skeleton, model, 1.0)
	var span := maxf(rest_bounds.y - rest_bounds.x, 0.5)
	var feet_raw := rest_bounds.x - span * 0.05
	var top_raw := rest_bounds.y + span * 0.16
	var height := 1.9
	var unit_scale := height / (top_raw - feet_raw)
	var base_y := -feet_raw * unit_scale
	var ground_foot_y := rest_bounds.x * unit_scale
	model.scale = Vector3.ONE * unit_scale
	model.position = Vector3(0.0, base_y, 0.0)

	# Generous orthogonal frustum so outstretched arms/hair/ki-blast never clip at edges
	camera.size = height * 1.56
	var dist := height * 4.5
	var p_rad := deg_to_rad(pitch)
	camera.position = Vector3(0.0, height * 0.52 + sin(p_rad) * dist, cos(p_rad) * dist)
	camera.look_at(Vector3(0.0, height * 0.52, 0.0), Vector3.UP)
	print("GM_RENDER_SETUP scale=", snappedf(unit_scale, 0.001), " span=", snappedf(span, 0.01), " clips=", player.get_animation_list())

	var to_model_rest := model.global_transform.affine_inverse() * skeleton.global_transform

	for clip_key: String in CLIP_SPECS.keys():
		if not wanted.is_empty() and not wanted.has(clip_key):
			continue
		var spec: Dictionary = CLIP_SPECS[clip_key]
		var anim_name := str(spec["anim"])
		if not player.has_animation(anim_name):
			printerr("Missing animation in GLB: ", anim_name)
			continue
		var anim := player.get_animation(anim_name)
		var dur := anim.length
		var n := int(spec["n"])
		var t0 := float(spec["t0"])
		var t1 := dur if float(spec["t1"]) < 0.0 else minf(float(spec["t1"]), dur)
		var is_loop := bool(spec["loop"])
		var norm_y := bool(spec["normalize_y"])
		var pingpong := bool(spec.get("pingpong", false))

		var times: Array[float] = []
		if pingpong and n >= 4:
			var half_n := n / 2
			for i in n:
				var frac := float(i) / float(half_n) if i <= half_n else float(n - i) / float(maxi(1, n - half_n))
				times.append(lerpf(t0, t1, clampf(frac, 0.0, 1.0)))
		else:
			for i in n:
				var frac := float(i) / float(n) if is_loop else float(i) / float(maxi(1, n - 1))
				times.append(lerpf(t0, t1, frac))

		player.play(anim_name)
		player.pause()

		# Compute smooth root XZ lock + smooth Y normalization for flight clips
		var hips_path: Array[Vector3] = []
		var foot_lows: Array[float] = []
		for t: float in times:
			player.seek(t, true)
			skeleton.force_update_all_bone_transforms()
			var hp: Vector3 = (to_model_rest * skeleton.get_bone_global_pose(hips).origin) * unit_scale
			hips_path.append(hp)
			var yb := _skeleton_y_bounds(skeleton, model, unit_scale)
			foot_lows.append(yb.x)

		var smooth_xz: Array[Vector2] = []
		var smooth_fy: Array[float] = []
		var rad := maxi(1, n / 4)
		for i in n:
			var acc_xz := Vector2.ZERO
			var acc_y := 0.0
			var cnt := 0
			for k in range(i - rad, i + rad + 1):
				var idx := posmod(k, n) if is_loop else clampi(k, 0, n - 1)
				acc_xz += Vector2(hips_path[idx].x, hips_path[idx].z)
				acc_y += foot_lows[idx]
				cnt += 1
			smooth_xz.append(acc_xz / float(cnt))
			smooth_fy.append(acc_y / float(cnt))

		DirAccess.make_dir_recursive_absolute("%s/%s" % [out_dir, clip_key])
		for f in n:
			player.seek(times[f], true)
			skeleton.force_update_all_bone_transforms()
			var dy := 0.0
			if norm_y:
				# Keep lowest feet cleanly at ground line inside sprite cell; actor_view.gd adds dynamic levitation height!
				dy = -(smooth_fy[f] - ground_foot_y)
			model.position = Vector3(-smooth_xz[f].x, base_y + dy, -smooth_xz[f].y)
			for d: String in DIRS:
				pivot.rotation_degrees.y = float(YAW[d])
				await process_frame
				await RenderingServer.frame_post_draw
				var img := viewport.get_texture().get_image()
				img.save_png("%s/%s/%s_%02d.png" % [out_dir, clip_key, d, f])
		print("GM_RENDER_CLIP ", clip_key, " frames=", n, " src=", anim_name)

	print("GM_RENDER_DONE")
	quit(0)
