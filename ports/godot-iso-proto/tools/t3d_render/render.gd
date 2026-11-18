extends Node3D
## godot --path . --rendering-driver vulkan -- --data res://data --out /workspace/iso-proto/t3d/terrain3d.png [--w 2000 --h 1240]
const NAMES := ["grass", "dirt", "rock", "sand", "cobble", "water", "moss", "gravel"]
var args: Dictionary = {}

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
	var data := arg("--data", "res://data")
	var out := arg("--out", "/tmp/terrain3d.png")
	var w := int(arg("--w", "2000"))
	var h := int(arg("--h", "1240"))
	var meta: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(data + "/meta.json"))
	var vp := SubViewport.new()
	vp.size = Vector2i(w, h)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	vp.screen_space_aa = Viewport.SCREEN_SPACE_AA_FXAA
	add_child(vp)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_WIDTH
	cam.size = float(arg("--ortho", "104"))
	cam.near = 1.0
	cam.far = 800.0
	# the same camera as the Blender objects: yaw 45, elevation 30, 200 m away from the origin, +1 m up (blender x,y,z -> godot x,z,-y)
	var e := deg_to_rad(30.0)
	var yw := deg_to_rad(45.0)
	cam.position = Vector3(200.0 * cos(e) * sin(yw), 200.0 * sin(e) + 1.0, 200.0 * cos(e) * cos(yw))
	cam.rotation_degrees = Vector3(-30.0, 45.0, 0.0)
	vp.add_child(cam)
	cam.current = true
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0, 0, 0, 0)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.62, 0.7, 0.85)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.92
	env.ssao_enabled = true
	env.ssao_radius = 1.6
	env.ssao_intensity = 2.2
	env.adjustment_enabled = true
	env.adjustment_saturation = 0.98
	env.adjustment_contrast = 1.06
	var we := WorldEnvironment.new()
	we.environment = env
	vp.add_child(we)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-46.0, -62.0, 0.0)
	sun.light_energy = 2.3
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 500.0
	sun.shadow_blur = 1.6
	vp.add_child(sun)
	var terrain: Terrain3D = ClassDB.instantiate("Terrain3D")
	terrain.name = "Terrain3D"
	terrain.set_camera(cam)
	terrain.free_editor_textures = false
	terrain.region_size = 256
	terrain.vertex_spacing = float(meta.step)
	terrain.collision_mode = 0
	var assets: Terrain3DAssets = ClassDB.instantiate("Terrain3DAssets")
	for i in NAMES.size():
		var asset: Terrain3DTextureAsset = ClassDB.instantiate("Terrain3DTextureAsset")
		asset.id = i
		asset.name = NAMES[i]
		asset.albedo_texture = tex("%s/tex_%s_albedo.png" % [data, NAMES[i]])
		asset.normal_texture = tex("%s/tex_%s_normal.png" % [data, NAMES[i]])
		asset.uv_scale = 0.12 if NAMES[i] != "cobble" else 0.07
		assets.set_texture_asset(i, asset)
	terrain.assets = assets
	vp.add_child(terrain)
	terrain.material.world_background = 0
	terrain.material.set("auto_shader", false)
	await get_tree().process_frame
	var nx := int(meta.nx)
	var ny := int(meta.ny)
	var height := Image.create_from_data(nx, ny, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes(data + "/height.f32"))
	var control := Image.create_from_data(nx, ny, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes(data + "/control.f32"))
	var maps: Array[Image] = [height, control, null]
	terrain.data.import_images(maps, Vector3(float(meta.x0), 0.0, -float(meta.y1)), 0.0, 1.0)
	# the river surface: a translucent sheet just under the bank line
	var water := MeshInstance3D.new()
	var plane := PlaneMesh.new()
	plane.size = Vector2(46, 116)
	water.mesh = plane
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color(0.2, 0.7, 0.78, 0.38)
	wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	wm.roughness = 0.08
	wm.metallic_specular = 0.9
	wm.shading_mode = BaseMaterial3D.SHADING_MODE_PER_PIXEL
	water.material_override = wm
	water.position = Vector3(2, -0.12, 8)
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	vp.add_child(water)
	for i in 90:
		await get_tree().process_frame
	var img := vp.get_texture().get_image()
	img.save_png(out)
	print("RENDERED ", out, " ", img.get_size(), " regions ", terrain.data.get_region_count())
	get_tree().quit(0)
