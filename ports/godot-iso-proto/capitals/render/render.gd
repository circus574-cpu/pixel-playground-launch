extends Node3D
## godot --path . --rendering-driver vulkan -- --data /root/cap/pyra --out /root/pyra.png [--w 2450 --h 1500]
func arg(name: String, fallback: String) -> String:
	var a := OS.get_cmdline_user_args()
	for i in a.size():
		if a[i] == name and i + 1 < a.size():
			return a[i + 1]
	return fallback

func tex(path: String) -> ImageTexture:
	var image := Image.load_from_file(path)
	image.convert(Image.FORMAT_RGBA8)
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)

func _ready() -> void:
	var data := arg("--data", "")
	var out := arg("--out", "/tmp/cap.png")
	var w := int(arg("--w", "2450"))
	var h := int(arg("--h", "1500"))
	var cfg: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(data + "/config.json"))
	var vp := SubViewport.new()
	vp.size = Vector2i(w, h)
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	add_child(vp)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.size = float(cfg.get("ortho", 5300.0))
	cam.near = 10.0
	cam.far = 20000.0
	var e := deg_to_rad(30.0)
	var yw := deg_to_rad(45.0)
	var target := Vector3(float(cfg.get("cx", 0.0)), 0.0, float(cfg.get("cz", 0.0)))
	cam.position = target + Vector3(6000.0 * cos(e) * sin(yw), 6000.0 * sin(e), 6000.0 * cos(e) * cos(yw))
	cam.rotation_degrees = Vector3(-30.0, 45.0, 0.0)
	vp.add_child(cam)
	cam.current = true
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.1, 0.12, 0.16)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.68, 0.72, 0.82)
	env.ambient_light_energy = 0.75
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.ssao_enabled = true
	env.ssao_radius = 40.0
	env.ssao_intensity = 1.6
	var we := WorldEnvironment.new()
	we.environment = env
	vp.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48.0, -62.0, 0.0)
	sun.light_energy = 2.0
	sun.light_color = Color(1.0, 0.96, 0.88)
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 12000.0
	sun.shadow_blur = 1.4
	vp.add_child(sun)
	var terrain: Terrain3D = ClassDB.instantiate("Terrain3D")
	terrain.name = "Terrain3D"
	terrain.set_camera(cam)
	terrain.free_editor_textures = false
	terrain.region_size = 256
	terrain.vertex_spacing = float(cfg.step)
	terrain.collision_mode = 0
	var assets: Terrain3DAssets = ClassDB.instantiate("Terrain3DAssets")
	for i in 8:
		var asset: Terrain3DTextureAsset = ClassDB.instantiate("Terrain3DTextureAsset")
		asset.id = i
		asset.name = "layer%d" % i
		asset.albedo_texture = tex("%s/tex_%d_albedo.png" % [data, i])
		asset.normal_texture = tex("%s/tex_%d_normal.png" % [data, i])
		asset.uv_scale = float(cfg.uv)
		assets.set_texture_asset(i, asset)
	terrain.assets = assets
	vp.add_child(terrain)
	terrain.material.world_background = 0
	terrain.material.set("auto_shader", false)
	await get_tree().process_frame
	var nx := int(cfg.nx)
	var ny := int(cfg.ny)
	var height := Image.create_from_data(nx, ny, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes(data + "/height.f32"))
	var control := Image.create_from_data(nx, ny, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes(data + "/control.f32"))
	var maps: Array[Image] = [height, control, null]
	terrain.data.import_images(maps, Vector3(float(cfg.x0), 0.0, float(cfg.y0)), 0.0, 1.0)
	# water: a sheet over the whole area (river, lava, sea) or discs (spring pools), with the game's own water / lava texture
	var wt := tex(data + "/water.png")
	var wm := StandardMaterial3D.new()
	wm.albedo_texture = wt
	wm.uv1_scale = Vector3(60, 60, 1)
	wm.texture_repeat = true
	wm.roughness = 0.12
	wm.metallic_specular = 0.8
	var kind := str(cfg.water_kind)
	if kind == "lava":
		wm.emission_enabled = true
		wm.emission_texture = wt
		wm.emission_energy_multiplier = 1.4
		wm.roughness = 0.5
	else:
		wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		wm.albedo_color = Color(1, 1, 1, 0.82)
	var level := float(cfg.water_level)
	if kind == "springs":
		for p: Array in cfg.pools:
			var disc := MeshInstance3D.new()
			var cyl := CylinderMesh.new()
			cyl.top_radius = float(p[2]) * 0.96
			cyl.bottom_radius = float(p[2]) * 0.96
			cyl.height = 2.0
			cyl.radial_segments = 48
			disc.mesh = cyl
			disc.material_override = wm
			disc.position = Vector3(float(p[0]), -9.0, float(p[1]))
			disc.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			vp.add_child(disc)
	elif kind != "none":
		var water := MeshInstance3D.new()
		var plane := PlaneMesh.new()
		plane.size = Vector2(float(nx) * float(cfg.step), float(ny) * float(cfg.step))
		water.mesh = plane
		water.material_override = wm
		water.position = Vector3(0, level, 0)
		water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		vp.add_child(water)
	for i in 100:
		await get_tree().process_frame
	var img := vp.get_texture().get_image()
	img.save_png(out)
	print("RENDERED ", out, " ", img.get_size())
	get_tree().quit(0)
