extends SceneTree
## Isolated material studio: external review pack, no game/save/asset replacement.
var pack := ""
var output := "/tmp/ki-free-materials-preview"

func _initialize() -> void:
	run.call_deferred()

func texture(path: String) -> ImageTexture:
	var image := Image.load_from_file(path)
	if image == null:
		push_error("Missing material image: " + path)
		quit(1)
		return null
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--pack="): pack = arg.substr(7)
		if arg.begins_with("--out="): output = arg.substr(6)
	if pack.is_empty() or DisplayServer.get_name() == "headless":
		push_error("Needs native renderer and --pack=<directory>")
		quit(1)
		return
	var manifest: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(pack.path_join("manifest.json")))
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1500, 900)
	root.content_scale_mode = Window.CONTENT_SCALE_MODE_DISABLED
	var stage := Node3D.new()
	root.add_child(stage)
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color("111923")
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_energy = 0.45
	var world := WorldEnvironment.new()
	world.environment = env
	stage.add_child(world)
	var light := DirectionalLight3D.new()
	light.rotation_degrees = Vector3(-35,-30,0)
	light.light_energy = 1.4
	stage.add_child(light)
	var camera := Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 6.5
	camera.position = Vector3(0,0,12)
	stage.add_child(camera)
	camera.current = true
	var canvas := CanvasLayer.new()
	root.add_child(canvas)
	var heading := Label.new()
	heading.text = "KI LEGENDS | FREE MATERIALS | ACTUAL GODOT RENDER"
	heading.position = Vector2(28,20)
	heading.add_theme_font_size_override("font_size",28)
	canvas.add_child(heading)
	var lands := ["verdant", "aether", "nexus", "pyra", "island-1", "island-2", "island-3", "island-4", "island-5", "island-6"]
	var names := ["VERDANTIA", "AETHERIA", "NEXUS-9", "PYRA", "WYSPA I", "WYSPA II", "WYSPA III", "WYSPA IV", "WYSPA V", "WYSPA VI"]
	var verified: Array[Dictionary] = []
	for i in lands.size():
		var land: String = lands[i]
		var selected: Dictionary = {}
		for entry: Dictionary in manifest.materials:
			for source: String in entry.sources:
				if source.ends_with("/" + land + "/terrain/b0.webp"):
					selected = entry
		if selected.is_empty():
			push_error("No b0 for land " + land)
			quit(1)
			return
		var material := StandardMaterial3D.new()
		for role: String in ["base-color", "normal-opengl", "roughness-estimated"]:
			var info: Dictionary = selected.maps[role]
			var path := pack.path_join(str(info.file))
			if FileAccess.get_sha256(path) != str(info.sha256):
				push_error("Wrong material SHA: " + path)
				quit(1)
				return
			var tex := texture(path)
			if role == "base-color": material.albedo_texture = tex
			elif role == "normal-opengl":
				material.normal_enabled = true
				material.normal_texture = tex
				material.normal_scale = 0.55
			else:
				material.roughness_texture = tex
				material.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
		material.uv1_scale = Vector3(2,2,1)
		var sphere := SphereMesh.new()
		sphere.radius = 0.83
		sphere.height = 1.66
		sphere.radial_segments = 48
		sphere.rings = 24
		var model := MeshInstance3D.new()
		model.mesh = sphere
		model.material_override = material
		model.position = Vector3((i % 5 - 2)*2.2,1.35-floorf(i/5.0)*2.8,0)
		stage.add_child(model)
		var label := Label.new()
		label.text = names[i]
		label.position = Vector2(35+(i%5)*295,385+floori(i/5.0)*385)
		label.size = Vector2(270,36)
		label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		label.add_theme_font_size_override("font_size",20)
		canvas.add_child(label)
		verified.append({"land":land,"material":selected.id,"texturesLoaded":3,"hashesMatch":true})
	for i in 10: await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output.path_join("material-studio.png"))
	var report := FileAccess.open(output.path_join("material-studio.json"),FileAccess.WRITE)
	report.store_string(JSON.stringify({"renderer":DisplayServer.get_name(),"checks":verified,"gameIntegrated":false,"physicalPhoneTested":false,"heightShown":false,"normalScale":0.55},"\t"))
	print("FREE MATERIAL STUDIO ", verified.size(), "/10 materials rendered")
	quit(0)
