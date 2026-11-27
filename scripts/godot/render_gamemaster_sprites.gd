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
	"glide":        {"anim": "glide",        "n": 14, "t0": 0.0,  "t1": -1.0, "loop": true,  "normalize_y": true},
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

func _add_skel_rot(skel: Skeleton3D, bone_name: String, axis_skel: Vector3, angle_deg: float) -> void:
	if absf(angle_deg) < 0.01:
		return
	var b := skel.find_bone(bone_name)
	if b < 0:
		return
	var par := skel.get_bone_parent(b)
	var pb := skel.get_bone_global_pose(par).basis if par >= 0 else Basis.IDENTITY
	var cur_local := Basis(skel.get_bone_pose_rotation(b))
	var r_skel := Basis(axis_skel.normalized(), deg_to_rad(angle_deg))
	var new_local := (pb.inverse() * r_skel * pb * cur_local).orthonormalized()
	skel.set_bone_pose_rotation(b, new_local.get_rotation_quaternion())
	skel.force_update_all_bone_transforms()

func _smoothstep(edge0: float, edge1: float, x: float) -> float:
	var t := clampf((x - edge0) / maxf(0.0001, edge1 - edge0), 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)

## Applies expressive, anatomically-exact 3D flight poses on top of the GLB skeleton
## (+X = character left, +Y = up, +Z = forward; right-hand +X tilts +Y toward +Z / -Y toward -Z).
func _apply_flight_pose(skel: Skeleton3D, clip_key: String, frac: float) -> void:
	if clip_key == "glide":
		var w := sin(frac * TAU)
		var w2 := cos(frac * TAU)
		# Bold superhuman aerodynamic flight lean (36 deg forward) with proud chest & level eyes
		_add_skel_rot(skel, "Hips", Vector3.RIGHT, 36.0 + 2.5 * w)
		_add_skel_rot(skel, "Spine01", Vector3.RIGHT, -6.0)
		_add_skel_rot(skel, "Spine", Vector3.RIGHT, -6.0)
		_add_skel_rot(skel, "neck", Vector3.RIGHT, -13.0)
		_add_skel_rot(skel, "Head", Vector3.RIGHT, -15.0 - 2.0 * w)
		# Arms swept back like aerodynamic wings, softly bent elbows
		_add_skel_rot(skel, "LeftArm", Vector3.RIGHT, 34.0 + 4.0 * w)
		_add_skel_rot(skel, "LeftArm", Vector3.BACK, 10.0 + 2.0 * w2)
		_add_skel_rot(skel, "LeftForeArm", Vector3.RIGHT, -14.0 + 3.0 * w2)
		_add_skel_rot(skel, "RightArm", Vector3.RIGHT, 34.0 - 4.0 * w)
		_add_skel_rot(skel, "RightArm", Vector3.BACK, -10.0 - 2.0 * w2)
		_add_skel_rot(skel, "RightForeArm", Vector3.RIGHT, -14.0 - 3.0 * w2)
		# Heroic anime flight legs: left knee tucked forward, right leg streaming back, toes pointed
		_add_skel_rot(skel, "LeftUpLeg", Vector3.RIGHT, -26.0 + 4.0 * w)
		_add_skel_rot(skel, "LeftLeg", Vector3.RIGHT, 56.0 + 5.0 * w)
		_add_skel_rot(skel, "LeftFoot", Vector3.RIGHT, 30.0)
		_add_skel_rot(skel, "RightUpLeg", Vector3.RIGHT, 10.0 - 4.0 * w)
		_add_skel_rot(skel, "RightLeg", Vector3.RIGHT, 24.0 + 4.0 * w2)
		_add_skel_rot(skel, "RightFoot", Vector3.RIGHT, 34.0)
	elif clip_key == "hover":
		var w := sin(frac * TAU)
		var w2 := cos(frac * TAU)
		# Majestic floating celestial stance (relaxed curved arms, raised martial-god knee, slow breathing)
		_add_skel_rot(skel, "Hips", Vector3.RIGHT, 7.0 + 2.0 * w)
		_add_skel_rot(skel, "Spine", Vector3.RIGHT, -5.0 + 2.0 * w)
		_add_skel_rot(skel, "Head", Vector3.RIGHT, -3.0 + 2.0 * w2)
		_add_skel_rot(skel, "LeftArm", Vector3.RIGHT, 8.0 + 4.0 * w)
		_add_skel_rot(skel, "LeftArm", Vector3.BACK, 12.0 + 3.0 * w2)
		_add_skel_rot(skel, "LeftForeArm", Vector3.RIGHT, -30.0 + 4.0 * w)
		_add_skel_rot(skel, "RightArm", Vector3.RIGHT, 8.0 - 4.0 * w)
		_add_skel_rot(skel, "RightArm", Vector3.BACK, -12.0 - 3.0 * w2)
		_add_skel_rot(skel, "RightForeArm", Vector3.RIGHT, -30.0 - 4.0 * w)
		_add_skel_rot(skel, "LeftUpLeg", Vector3.RIGHT, -28.0 + 3.5 * w)
		_add_skel_rot(skel, "LeftLeg", Vector3.RIGHT, 50.0 + 3.5 * w)
		_add_skel_rot(skel, "LeftFoot", Vector3.RIGHT, 26.0)
		_add_skel_rot(skel, "RightUpLeg", Vector3.RIGHT, 6.0 - 2.5 * w)
		_add_skel_rot(skel, "RightLeg", Vector3.RIGHT, 18.0 + 3.0 * w2)
		_add_skel_rot(skel, "RightFoot", Vector3.RIGHT, 24.0)
	elif clip_key == "takeoff":
		# Athletic power-gather crouch -> explosive celestial launch into hover stance
		var crouch := sin(clampf(frac / 0.34, 0.0, 1.0) * PI)
		var launch := _smoothstep(0.28, 0.92, frac)
		var arch := sin(clampf((frac - 0.25) / 0.60, 0.0, 1.0) * PI)
		_add_skel_rot(skel, "Hips", Vector3.RIGHT, 16.0 * crouch + 7.0 * launch - 5.0 * arch)
		_add_skel_rot(skel, "Spine", Vector3.RIGHT, 8.0 * crouch - 10.0 * arch - 5.0 * launch)
		_add_skel_rot(skel, "Head", Vector3.RIGHT, 6.0 * crouch - 8.0 * arch - 3.0 * launch)
		_add_skel_rot(skel, "LeftArm", Vector3.RIGHT, -16.0 * crouch + 22.0 * arch + 8.0 * launch)
		_add_skel_rot(skel, "LeftArm", Vector3.BACK, -8.0 * crouch + 18.0 * arch + 12.0 * launch)
		_add_skel_rot(skel, "LeftForeArm", Vector3.RIGHT, -42.0 * crouch - 30.0 * launch)
		_add_skel_rot(skel, "RightArm", Vector3.RIGHT, -16.0 * crouch + 22.0 * arch + 8.0 * launch)
		_add_skel_rot(skel, "RightArm", Vector3.BACK, 8.0 * crouch - 18.0 * arch - 12.0 * launch)
		_add_skel_rot(skel, "RightForeArm", Vector3.RIGHT, -42.0 * crouch - 30.0 * launch)
		_add_skel_rot(skel, "LeftUpLeg", Vector3.RIGHT, -32.0 * crouch - 28.0 * launch)
		_add_skel_rot(skel, "LeftLeg", Vector3.RIGHT, 58.0 * crouch + 50.0 * launch)
		_add_skel_rot(skel, "LeftFoot", Vector3.RIGHT, 26.0 * launch)
		_add_skel_rot(skel, "RightUpLeg", Vector3.RIGHT, -28.0 * crouch + 8.0 * launch)
		_add_skel_rot(skel, "RightLeg", Vector3.RIGHT, 52.0 * crouch + 18.0 * launch)
		_add_skel_rot(skel, "RightFoot", Vector3.RIGHT, 24.0 * launch)
	elif clip_key == "land":
		# Hover stance -> impact-absorbing superhero landing crouch -> noble upright recovery
		var hover_w := 1.0 - _smoothstep(0.05, 0.45, frac)
		var crouch := sin(clampf((frac - 0.22) / 0.56, 0.0, 1.0) * PI)
		_add_skel_rot(skel, "Hips", Vector3.RIGHT, 7.0 * hover_w + 15.0 * crouch)
		_add_skel_rot(skel, "Spine", Vector3.RIGHT, -5.0 * hover_w + 8.0 * crouch)
		_add_skel_rot(skel, "Head", Vector3.RIGHT, -3.0 * hover_w - 6.0 * crouch)
		_add_skel_rot(skel, "LeftArm", Vector3.RIGHT, 8.0 * hover_w + 14.0 * crouch)
		_add_skel_rot(skel, "LeftArm", Vector3.BACK, 12.0 * hover_w + 14.0 * crouch)
		_add_skel_rot(skel, "LeftForeArm", Vector3.RIGHT, -30.0 * hover_w - 24.0 * crouch)
		_add_skel_rot(skel, "RightArm", Vector3.RIGHT, 8.0 * hover_w + 14.0 * crouch)
		_add_skel_rot(skel, "RightArm", Vector3.BACK, -12.0 * hover_w - 14.0 * crouch)
		_add_skel_rot(skel, "RightForeArm", Vector3.RIGHT, -30.0 * hover_w - 24.0 * crouch)
		_add_skel_rot(skel, "LeftUpLeg", Vector3.RIGHT, -28.0 * hover_w - 32.0 * crouch)
		_add_skel_rot(skel, "LeftLeg", Vector3.RIGHT, 50.0 * hover_w + 56.0 * crouch)
		_add_skel_rot(skel, "LeftFoot", Vector3.RIGHT, 26.0 * hover_w)
		_add_skel_rot(skel, "RightUpLeg", Vector3.RIGHT, 6.0 * hover_w - 26.0 * crouch)
		_add_skel_rot(skel, "RightLeg", Vector3.RIGHT, 18.0 * hover_w + 50.0 * crouch)
		_add_skel_rot(skel, "RightFoot", Vector3.RIGHT, 24.0 * hover_w)

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
		var fracs: Array[float] = []
		if pingpong and n >= 4:
			var half_n := n / 2
			for i in n:
				var frac := float(i) / float(half_n) if i <= half_n else float(n - i) / float(maxi(1, n - half_n))
				fracs.append(clampf(frac, 0.0, 1.0))
				times.append(lerpf(t0, t1, clampf(frac, 0.0, 1.0)))
		else:
			for i in n:
				var frac := float(i) / float(n) if is_loop else float(i) / float(maxi(1, n - 1))
				fracs.append(frac)
				times.append(lerpf(t0, t1, frac))

		player.play(anim_name)
		player.pause()

		# Compute smooth root XZ lock + smooth Y normalization for flight clips
		var hips_path: Array[Vector3] = []
		var foot_lows: Array[float] = []
		for i in n:
			player.seek(times[i], true)
			skeleton.force_update_all_bone_transforms()
			_apply_flight_pose(skeleton, clip_key, fracs[i])
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
			_apply_flight_pose(skeleton, clip_key, fracs[f])
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
