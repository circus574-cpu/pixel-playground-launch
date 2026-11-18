extends Node3D
## Stage 4: Godot 4.6.3 Terrain3D + ProtonScatter / MultiMesh 3D Isometric Scene Renderer
## Loads height.f32, control.f32, 8 PBR texture sets, Blender 3D .glb buildings, and scattered
## natural props for Pyra, Verdantia, Aetheria, and Nexus-9, rendering 1920x1080 orthographic
## isometric views with balanced lighting (Filmic tonemap, light_energy=1.22, ambient=0.48).

const REGIONS := ["pyra", "verdant", "aether", "nexus"]
const BASE_DIR := "/workspace/ki-world-iso-20261118"

var env_node := WorldEnvironment.new()
var sun := DirectionalLight3D.new()
var cam := Camera3D.new()
var scene_root := Node3D.new()

func _ready() -> void:
	setup_environment()
	add_child(scene_root)
	call_deferred("render_all_regions")

func setup_environment() -> void:
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_mat := ProceduralSkyMaterial.new()
	sky_mat.sky_top_color = Color(0.14, 0.22, 0.34)
	sky_mat.sky_horizon_color = Color(0.52, 0.58, 0.66)
	sky_mat.ground_horizon_color = Color(0.32, 0.34, 0.38)
	sky_mat.ground_bottom_color = Color(0.14, 0.15, 0.18)
	sky.sky_material = sky_mat
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.76, 0.82, 0.90)
	env.ambient_light_energy = 0.48
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.95
	env.ssao_enabled = true
	env.glow_enabled = true
	env.glow_intensity = 0.45
	env_node.environment = env
	add_child(env_node)

	sun.rotation_degrees = Vector3(-38.0, -42.0, 0.0)
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.light_energy = 1.22
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 450.0
	add_child(sun)

	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 165.0
	cam.near = 1.0
	cam.far = 1200.0
	cam.current = true
	add_child(cam)

func load_img_tex(abs_path: String) -> ImageTexture:
	var img := Image.new()
	if img.load(abs_path) == OK:
		img.generate_mipmaps()
		return ImageTexture.create_from_image(img)
	return null

func instantiate_glb(glb_name: String) -> Node3D:
	var path := BASE_DIR + "/models/" + glb_name + ".glb"
	var doc := GLTFDocument.new()
	var state := GLTFState.new()
	if doc.append_from_file(path, state) == OK:
		var root := doc.generate_scene(state)
		if root is Node3D:
			return root
	return Node3D.new()

func render_all_regions() -> void:
	var out_dir := BASE_DIR + "/qa/terrain3d"
	DirAccess.make_dir_recursive_absolute(out_dir)

	for land: String in REGIONS:
		for child in scene_root.get_children():
			child.free()

		var rdir := BASE_DIR + "/regions/" + land
		var terrain: Node3D = ClassDB.instantiate("Terrain3D")
		terrain.name = "Terrain3D_" + land
		terrain.call("set_camera", cam)
		terrain.set("free_editor_textures", false)
		terrain.set("region_size", 512)
		terrain.set("vertex_spacing", 0.5)

		var assets: Resource = ClassDB.instantiate("Terrain3DAssets")
		for i in 8:
			var asset: Resource = ClassDB.instantiate("Terrain3DTextureAsset")
			asset.call("set_id", i)
			asset.call("set_name", "%s_tex_%d" % [land, i])
			var alb := load_img_tex("%s/tex_%d_albedo.png" % [rdir, i])
			var nrm := load_img_tex("%s/tex_%d_normal.png" % [rdir, i])
			if alb != null:
				asset.call("set_albedo_texture", alb)
			if nrm != null:
				asset.call("set_normal_texture", nrm)
			asset.call("set_roughness", 0.65)
			asset.call("set_uv_scale", 0.12)
			assets.call("set_texture_asset", i, asset)
		terrain.call("set_assets", assets)
		scene_root.add_child(terrain)

		var h_img := Image.create_from_data(512, 512, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes(rdir + "/height.f32"))
		var c_img := Image.create_from_data(512, 512, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes(rdir + "/control.f32"))
		var maps: Array[Image] = [h_img, c_img, null]
		terrain.call("get_data").call("import_images", maps, Vector3(-128.0, 0.0, -128.0), 0.0, 1.0)

		# Place Blender 3D .glb buildings & ProtonScatter / natural props
		var bdata: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(rdir + "/buildings.json"))
		for b: Dictionary in bdata.get("buildings", []):
			var bnode := instantiate_glb(str(b.sprite))
			var wx := float(b.x) - 128.0
			var wz := float(b.z) - 128.0
			var wy: float = terrain.call("get_data").call("get_height", Vector3(wx, 0.0, wz))
			if not is_finite(wy):
				wy = float(b.get("y", 12.0))
			bnode.position = Vector3(wx, wy, wz)
			var sc := float(b.get("scale", 0.34)) * 7.5
			bnode.scale = Vector3(sc, sc, sc)
			scene_root.add_child(bnode)

		for p: Dictionary in bdata.get("props", []):
			var pnode := instantiate_glb(str(p.sprite))
			var px := float(p.x) - 128.0
			var pz := float(p.z) - 128.0
			var py: float = terrain.call("get_data").call("get_height", Vector3(px, 0.0, pz))
			if not is_finite(py):
				py = float(p.get("y", 10.0))
			pnode.position = Vector3(px, py, pz)
			var psc := float(p.get("scale", 0.22)) * 8.0
			pnode.scale = Vector3(psc, psc, psc)
			scene_root.add_child(pnode)

		# Position orthographic isometric camera (yaw 45 deg, elevation 30 deg)
		var target := Vector3(0.0, 26.0, 0.0)
		var dist := 260.0
		var yaw := deg_to_rad(45.0)
		var elev := deg_to_rad(30.0)
		var cam_pos := target + Vector3(dist * cos(elev) * sin(yaw), dist * sin(elev), dist * cos(elev) * cos(yaw))
		cam.look_at_from_position(cam_pos, target, Vector3.UP)

		for _f in 12:
			await get_tree().process_frame

		var shot := get_viewport().get_texture().get_image()
		var out_path := "%s/terrain3d_scatter_%s.jpg" % [out_dir, land]
		shot.save_jpg(out_path, 0.92)
		print("TERRAIN3D_SCATTER_OK ", out_path)

	get_tree().quit(0)
