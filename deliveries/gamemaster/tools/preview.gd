extends SceneTree

const FPS := 24.0
const POLISH := {
	"walk":"CHÓD",
	"hover":"LEWITACJA",
	"takeoff":"START LOTU",
	"flight":"LOT",
	"glide":"SZYBOWANIE",
	"land":"LĄDOWANIE",
	"heavy_strike":"CIĘŻKIE UDERZENIE",
	"ki_blast":"ATAK KI",
}

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 1:
		quit(2)
		return
	var gltf := GLTFDocument.new()
	var state := GLTFState.new()
	var error := gltf.append_from_file(args[0], state)
	if error != OK:
		printerr("GLTF LOAD: ", error)
		quit(3)
		return
	var asset := gltf.generate_scene(state) as Node3D
	var scene := Node3D.new()
	root.add_child(scene)
	scene.add_child(asset)
	var players := asset.find_children("*", "AnimationPlayer", true, false)
	if players.size() != 1:
		printerr("Expected exactly one AnimationPlayer, got ", players.size())
		quit(4)
		return
	var player := players[0] as AnimationPlayer
	print("GAME MASTER CLIPS ", player.get_animation_list())
	var bounds := mesh_bounds(asset)
	print("GAME MASTER REST BOUNDS ", bounds)
	if args.size() == 1:
		quit(0)
		return
	var title := make_stage(scene, bounds)
	var close_up := args.size() > 3 and args[3] == "--portrait"
	var camera := scene.get_node("Orbit") as Camera3D
	player.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var sequence: PackedStringArray = args[1].split(",")
	for name in sequence:
		if not player.has_animation(name):
			printerr("Missing animation ", name)
			quit(5)
			return
		var clip := player.get_animation(name)
		var duration := clip.length
		print("RENDER ", name, " ", duration, " sec")
		player.play(name)
		player.advance(0.0)
		title.text = "GAMEMASTER   /   " + str(POLISH.get(name, name.to_upper()))
		var steps := int(ceil(duration * FPS)) + 1
		for step in steps:
			var t := minf(float(step) / FPS, duration)
			var angle := deg_to_rad(5.0 if close_up else 12.0 + 6.0 * sin(PI * float(step) / steps))
			var center := bounds.get_center()
			var start_y := bounds.position.y
			var height := bounds.size.y
			var focus := Vector3(center.x, start_y + height * (0.72 if name in ["hover","flight","takeoff","land","glide"] else 0.58), center.z)
			var distance := height * (2.85 if name in ["hover","flight","takeoff","land","glide"] else 2.45)
			if close_up:
				focus.y = start_y + height * 0.88
				distance = height * 0.98
			camera.position = focus + Vector3(sin(angle) * distance, (height * 0.025 if close_up else height * 0.14), cos(angle) * distance)
			camera.look_at(focus, Vector3.UP)
			player.seek(t, true)
			await process_frame
			if step == int(steps * 0.47):
				await RenderingServer.frame_post_draw
				var image := root.get_texture().get_image()
				if image.save_png(args[2].path_join(("twarz" if close_up else name) + ".png")) != OK:
					push_error("Screenshot failed for " + name)
	quit(0)

func mesh_bounds(node: Node3D) -> AABB:
	var full := AABB()
	var populated := false
	for child in node.find_children("*", "MeshInstance3D", true, false):
		var instance := child as MeshInstance3D
		var aabb := instance.global_transform * instance.get_aabb()
		full = full.merge(aabb) if populated else aabb
		populated = true
	return full

func make_stage(scene: Node3D, bounds: AABB) -> Label:
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#0a1224")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("#ced8f0")
	environment.environment.ambient_light_energy = 0.44
	scene.add_child(environment)

	var y := bounds.position.y - 0.014
	var plane := MeshInstance3D.new()
	plane.mesh = PlaneMesh.new()
	(plane.mesh as PlaneMesh).size = Vector2(200.0, 200.0)
	var material := ShaderMaterial.new()
	material.shader = Shader.new()
	material.shader.code = """shader_type spatial;
	void fragment() {
		vec2 pos = (UV-vec2(0.5))*200.0;
		vec2 grid = abs(fract(pos*2.5-0.5)-0.5)/max(fwidth(pos*2.5),vec2(0.001));
		float lines = 1.0-min(min(grid.x,grid.y),1.0);
		ALBEDO = mix(vec3(0.027,0.045,0.077),vec3(0.05,0.08,0.12),lines*0.46);
		ROUGHNESS = 0.9;
	}"""
	plane.material_override = material
	plane.position.y = y
	scene.add_child(plane)

	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-53, -28, 0)
	key.light_color = Color("#fff0d6")
	key.light_energy = 1.36
	key.shadow_enabled = true
	key.directional_shadow_max_distance = 18
	scene.add_child(key)

	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-25, 128, 0)
	fill.light_color = Color("#89b7ff")
	fill.light_energy = 1.04
	scene.add_child(fill)

	var camera := Camera3D.new()
	camera.name = "Orbit"
	camera.current = true
	camera.fov = 32
	scene.add_child(camera)
	var layer := CanvasLayer.new()
	scene.add_child(layer)
	var title := Label.new()
	title.position = Vector2(32, 27)
	title.add_theme_font_size_override("font_size", 20)
	title.add_theme_color_override("font_color", Color("#efdaac"))
	title.add_theme_constant_override("outline_size", 5)
	title.add_theme_color_override("font_outline_color", Color("#111c29"))
	layer.add_child(title)
	return title
