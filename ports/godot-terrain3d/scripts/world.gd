extends Node3D
## Isolated 1 km² Pyra study. No production saves, combat data or canonical coordinates are modified.
var terrain: Node3D
var hero := CharacterBody3D.new()
var camera := Camera3D.new()
var heading := Label.new()
var touch_vector := Vector2.ZERO
var move_pointer := -1
var move_origin := Vector2.ZERO
var camera_overview := false
var capture_mode := false
var input_enabled := true
var rng := RandomNumberGenerator.new()
var materials: Dictionary = {}
var texture_cache: Dictionary = {}
var config: Dictionary

func _ready() -> void:
	config = JSON.parse_string(FileAccess.get_file_as_string("res://data/terrain.json"))
	rng.seed = int(config.seed)
	capture_mode = "--qa" in OS.get_cmdline_user_args()
	if not ClassDB.class_exists("Terrain3D"):
		push_error("Terrain3D dependency missing: install pinned addon with bootstrap-terrain3d.sh")
		get_tree().quit(2)
		return
	build_lighting()
	build_terrain()
	await get_tree().process_frame
	import_height()
	build_city()
	build_environment()
	build_hero()
	build_interface()
	if capture_mode: run_qa.call_deferred()

func map_texture(name: String) -> Texture2D:
	if not texture_cache.has(name):
		var source: Texture2D = load("res://materials/%s.webp" % name)
		var image := source.get_image()
		if image.is_compressed(): image.decompress()
		image.convert(Image.FORMAT_RGBA8)
		image.generate_mipmaps()
		texture_cache[name] = ImageTexture.create_from_image(image)
	return texture_cache[name]

func texture_material(name: String, tint: Color = Color.WHITE) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = map_texture(name)
	m.albedo_color = tint
	m.roughness = 0.9
	m.uv1_scale = Vector3(2, 2, 2)
	return m

func color_material(color: Color, emit: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	m.roughness = 0.75
	if emit > 0:
		m.emission_enabled = true
		m.emission = color
		m.emission_energy_multiplier = emit
	return m

func build_lighting() -> void:
	var environment := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("17283e")
	sky_material.sky_horizon_color = Color("727580")
	sky_material.ground_horizon_color = Color("4a4c56")
	sky_material.ground_bottom_color = Color("24272e")
	sky.sky_material = sky_material
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("9aaec7")
	env.ambient_light_energy = 0.55
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.fog_enabled = true
	env.fog_light_color = Color("697581")
	env.fog_density = 0.00012
	environment.environment = env
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-36, -34, 0)
	sun.light_color = Color("ffe3c4")
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 350
	add_child(sun)

func build_terrain() -> void:
	camera.current = true
	camera.fov = 54
	camera.far = 1800
	camera.position = Vector3(-65,40,80)
	add_child(camera)
	terrain = ClassDB.instantiate("Terrain3D")
	terrain.name = "Terrain3D"
	terrain.call("set_camera",camera)
	terrain.set("free_editor_textures",false)
	terrain.set("region_size", 256)
	terrain.set("vertex_spacing", 2.0)
	terrain.set("collision_mode", 1)
	var assets: Resource = ClassDB.instantiate("Terrain3DAssets")
	for i in config.texture_assets.size():
		var name: String = config.texture_assets[i]
		var asset: Resource = ClassDB.instantiate("Terrain3DTextureAsset")
		asset.call("set_id", i)
		asset.call("set_asset_name", name)
		asset.call("set_albedo_texture", map_texture(name))
		asset.call("set_roughness", 0.15)
		asset.call("set_uv_scale", 0.15)
		assets.call("set_texture_asset", i, asset)
	terrain.call("set_assets", assets)
	add_child(terrain)

func import_height() -> void:
	var height := Image.create_from_data(512, 512, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes("res://data/height.r32"))
	var control := Image.create_from_data(512, 512, false, Image.FORMAT_RF, FileAccess.get_file_as_bytes("res://data/control.r32"))
	var maps: Array[Image] = [height, control, null]
	terrain.call("get_data").call("import_images", maps, Vector3(-512, 0, -512), 0.0, 1.0)

func ground(x: float, z: float) -> float:
	var y: float = terrain.call("get_data").call("get_height", Vector3(x, 0, z))
	return y if is_finite(y) else 12.0

func mesh_at(mesh: Mesh, material: Material, position: Vector3, parent: Node3D = null) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	node.mesh = mesh
	node.material_override = material
	node.position = position
	(parent if parent != null else self).add_child(node)
	return node

func block(size: Vector3, position: Vector3, material: Material, collides: bool = true) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	var node := mesh_at(mesh, material, position)
	if collides:
		var body := StaticBody3D.new()
		var shape := CollisionShape3D.new()
		var box := BoxShape3D.new()
		box.size = size
		shape.shape = box
		body.add_child(shape)
		node.add_child(body)
	return node

func hip_roof(width: float, depth: float, height: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := [Vector3(width / 2, 0, depth / 2), Vector3(width * 0.38, height * 0.28, depth * 0.38), Vector3(width * 0.06, height, depth * 0.06)]
	for level in 2:
		for side in 4:
			var corners: Array[Vector3] = []
			for index in [side, (side+1)%4]:
				var sx := -1.0 if index in [0, 3] else 1.0
				var sz := -1.0 if index in [0, 1] else 1.0
				corners.append(Vector3(rings[level].x*sx,rings[level].y,rings[level].z*sz))
			for index in [side, (side+1)%4]:
				var sx := -1.0 if index in [0, 3] else 1.0
				var sz := -1.0 if index in [0, 1] else 1.0
				corners.append(Vector3(rings[level+1].x*sx,rings[level+1].y,rings[level+1].z*sz))
			for index in [0,1,2,1,3,2]:
				st.set_uv(Vector2(float(index%2),float(index/2)))
				st.add_vertex(corners[index])
	st.generate_normals()
	return st.commit()

func building(x: float, z: float, width: float, depth: float, height: float, tiers: int = 1) -> void:
	var y := ground(x,z)
	block(Vector3(width+2,2,depth+2),Vector3(x,y,z),materials.basalt)
	block(Vector3(width,height,depth),Vector3(x,y+height/2,z),materials.basalt)
	for sx in [-1,1]:
		for sz in [-1,1]:
			block(Vector3(.8,height+.5,.8),Vector3(x+sx*width*.45,y+height/2,z+sz*depth*.45),materials.gold,false)
	block(Vector3(3.8,5,.2),Vector3(x,y+2.5,z+depth/2+.15),materials.dark,false)
	for side in [-1,1]:
		block(Vector3(2.2,2,.25),Vector3(x+side*width*.28,y+height*.6,z+depth/2+.2),materials.lit,false)
	mesh_at(hip_roof(width+6,depth+6,5),materials.roof,Vector3(x,y+height,z))
	if tiers > 1:
		block(Vector3(width*.65,4,depth*.65),Vector3(x,y+height+4,z),materials.basalt)
		mesh_at(hip_roof(width*.8,depth*.8,5),materials.roof,Vector3(x,y+height+6,z))

func build_city() -> void:
	materials.basalt = texture_material("basalt", Color("aaa5a2"))
	materials.ash = texture_material("ash")
	materials.roof = color_material(Color("6a1e1b"))
	materials.gold = color_material(Color("bd9050"))
	materials.dark = color_material(Color("13151a"))
	materials.lit = color_material(Color("ffad52"),1.2)
	for b in [[-75,-20,22,18,10,1],[-20,-60,30,24,15,2],[60,-40,20,18,10,1],[65,40,20,20,9,1],[45,100,24,18,11,1],[-80,115,22,18,9,1],[-110,45,16,16,10,1]]:
		building(b[0],b[1],b[2],b[3],b[4],b[5])
	# One open gateway; broad streets are not filled with buildings or props.
	for x in [-63,-17]:
		var y := ground(x,150)
		block(Vector3(7,17,7),Vector3(x,y+8.5,150),materials.basalt)
		mesh_at(hip_roof(12,12,5),materials.roof,Vector3(x,y+17,150))
	block(Vector3(53,3,5),Vector3(-40,ground(-40,150)+16,150),materials.gold,false)
	for p in [Vector2(-90,-55),Vector2(30,-20),Vector2(85,95),Vector2(-100,80),Vector2(-62,140),Vector2(-18,140)]:
		var y := ground(p.x,p.y)
		block(Vector3(.7,5,.7),Vector3(p.x,y+2.5,p.y),materials.dark,false)
		var lamp := OmniLight3D.new()
		lamp.position = Vector3(p.x,y+5,p.y)
		lamp.light_color = Color("ff9e46")
		lamp.light_energy = 2
		lamp.omni_range = 12
		add_child(lamp)
		var flame := SphereMesh.new()
		flame.radius = .6
		flame.height = 1.6
		mesh_at(flame,materials.lit,Vector3(p.x,y+5,p.y))

func build_environment() -> void:
	var rock_scene: PackedScene = load("res://models/rock-0.glb")
	var rock_node := rock_scene.instantiate()
	var meshes := rock_node.find_children("*","MeshInstance3D",true,false)
	var rock: Mesh = (meshes[0] as MeshInstance3D).mesh if not meshes.is_empty() else (rock_node as MeshInstance3D).mesh
	rock_node.free()
	var instances := MultiMeshInstance3D.new()
	var batch := MultiMesh.new()
	batch.transform_format = MultiMesh.TRANSFORM_3D
	batch.mesh = rock
	var transforms: Array[Transform3D] = []
	for i in 1800:
		var x := rng.randf_range(-480,480)
		var z := rng.randf_range(-480,480)
		if Vector2(x,z-35).length() < 155: continue
		var y := ground(x,z)
		if y < 3: continue
		var scale := Vector3(rng.randf_range(1,5),rng.randf_range(1,4),rng.randf_range(1,5))
		transforms.append(Transform3D(Basis(Vector3.UP,rng.randf_range(0,TAU)).scaled(scale),Vector3(x,y-.6,z)))
	batch.instance_count = transforms.size()
	for i in transforms.size(): batch.set_instance_transform(i,transforms[i])
	instances.multimesh = batch
	instances.material_override = materials.basalt
	instances.visibility_range_end = 320
	instances.visibility_range_end_margin = 45
	add_child(instances)
	var lava_material := color_material(Color("ff4c08"),2.5)
	for i in 40:
		var z := -480.0+i*24
		if absf(z-45) < 85: continue
		var x := 165+26*sin(z/85)
		block(Vector3(18,.2,25),Vector3(x,-5,z),lava_material,false)

func build_hero() -> void:
	hero.name = "Explorer"
	hero.floor_snap_length = 1.2
	hero.floor_max_angle = deg_to_rad(40)
	var collision := CollisionShape3D.new()
	var capsule := CapsuleShape3D.new()
	capsule.radius = .45
	capsule.height = 1.9
	collision.shape = capsule
	collision.position.y = .95
	hero.add_child(collision)
	var body := CapsuleMesh.new()
	body.radius = .45
	body.height = 1.9
	mesh_at(body,color_material(Color("aa3428")),Vector3(0,.95,0),hero)
	hero.position = Vector3(-40, ground(-40,50)+2,50)
	add_child(hero)
	terrain.call("set_camera",camera)
	terrain.call("set_collision_target",hero)
	update_camera(1)

func build_interface() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	heading.text = "KI LEGENDS · PYRA 3D — PRÓBA TERENU\nWASD / strzałki / lewy kciuk: ruch · F1: panorama · R: powrót"
	heading.position = Vector2(22,16)
	heading.add_theme_font_size_override("font_size",18)
	heading.add_theme_color_override("font_color",Color("ffe7b7"))
	heading.add_theme_color_override("font_shadow_color",Color.BLACK)
	heading.add_theme_constant_override("shadow_offset_x",2)
	heading.add_theme_constant_override("shadow_offset_y",2)
	layer.add_child(heading)
	var panorama := Button.new()
	panorama.text = "PANORAMA"
	panorama.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	panorama.position = Vector2(1090,20)
	panorama.custom_minimum_size = Vector2(160,56)
	panorama.pressed.connect(func():camera_overview = not camera_overview)
	layer.add_child(panorama)

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed:
		if event.keycode == KEY_F1: camera_overview = not camera_overview
		if event.keycode == KEY_R: hero.position = Vector3(-40,ground(-40,50)+2,50)
	if event is InputEventScreenTouch:
		if event.pressed and event.position.x < get_viewport().get_visible_rect().size.x*.45 and move_pointer == -1:
			move_pointer = event.index
			move_origin = event.position
		elif event.index == move_pointer and (not event.pressed or event.canceled):
			move_pointer = -1
			touch_vector = Vector2.ZERO
	if event is InputEventScreenDrag and event.index == move_pointer:
		touch_vector = ((event.position-move_origin)/65).limit_length(1)

func _notification(what: int) -> void:
	if what == NOTIFICATION_APPLICATION_FOCUS_OUT:
		move_pointer = -1
		touch_vector = Vector2.ZERO

func _physics_process(delta: float) -> void:
	if not is_instance_valid(terrain) or not hero.is_inside_tree(): return
	var input := touch_vector
	if input_enabled:
		input += Vector2(float(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT))-float(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)),float(Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN))-float(Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP)))
	else: input = Vector2.ZERO
	input = input.limit_length(1)
	var direction := Vector3(input.x,0,input.y).rotated(Vector3.UP,-PI/4)
	hero.velocity.x = direction.x * 8
	hero.velocity.z = direction.z * 8
	hero.velocity.y -= 24*delta
	hero.move_and_slide()
	if hero.position.y < -25: hero.position = Vector3(-40,ground(-40,50)+2,50)
	update_camera(delta)

func update_camera(delta: float) -> void:
	var target := Vector3(0,20,-30) if camera_overview else hero.position+Vector3(0,1,0)
	var wanted := Vector3(-290,275,330) if camera_overview else target+Vector3(-12,15,19)
	camera.position = camera.position.lerp(wanted,1-exp(-6*delta))
	camera.look_at(target)

func run_qa() -> void:
	var out := "/workspace/ki-terrain3d/qa"
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="): out = arg.substr(6)
	DirAccess.make_dir_recursive_absolute(out)
	input_enabled = false
	for i in 120: await get_tree().physics_frame
	var settled := hero.position
	var on_floor := hero.is_on_floor()
	var movement: Array[Dictionary] = []
	for fps in [30,120]:
		Engine.max_fps = fps
		hero.position = Vector3(-40,ground(-40,50)+1,50)
		hero.velocity = Vector3.ZERO
		for i in 15: await get_tree().physics_frame
		input_enabled = true
		var touch := InputEventScreenTouch.new()
		touch.index = 4
		touch.position = Vector2(160,560)
		touch.pressed = true
		get_viewport().push_input(touch,true)
		var drag := InputEventScreenDrag.new()
		drag.index = 4
		drag.position = Vector2(225,560)
		get_viewport().push_input(drag,true)
		# A second thumb is released while the first remains on the stick.
		var second := InputEventScreenTouch.new()
		second.index = 7
		second.position = Vector2(1100,560)
		second.pressed = true
		get_viewport().push_input(second,true)
		second.pressed = false
		get_viewport().push_input(second,true)
		var kept_motion := move_pointer == 4 and touch_vector.length() > .9
		var start := hero.position
		var elapsed := 0.0
		while elapsed < 2.0:
			await get_tree().physics_frame
			elapsed += get_physics_process_delta_time()
		touch.pressed = false
		touch.canceled = true
		get_viewport().push_input(touch,true)
		var distance := Vector2(hero.position.x-start.x,hero.position.z-start.z).length()
		var cancel_released := move_pointer == -1 and touch_vector == Vector2.ZERO
		movement.append({"fps_cap":fps,"distance":distance,"sim_seconds":elapsed,"second_thumb_keeps_movement":kept_motion,"cancel_releases":cancel_released,"on_floor":hero.is_on_floor()})
		input_enabled = false
	Engine.max_fps = 0
	hero.position = settled
	hero.velocity = Vector3.ZERO
	for i in 30: await get_tree().physics_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("city-play.jpg"),.93)
	camera_overview = true
	for i in 120: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("terrain-overview.jpg"),.93)
	var report := {"terrain3d":ClassDB.class_exists("Terrain3D"),"regions":terrain.call("get_data").call("get_region_count"),"hero_on_floor":on_floor,"hero_position":str(settled),"floor_delta":absf(settled.y-ground(settled.x,settled.z)),"renderer":RenderingServer.get_video_adapter_name(),"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"texture_bytes":Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED),"fps":Engine.get_frames_per_second(),"android_device_tested":false,"gameplay_port_complete":false,"movement":movement}
	var file := FileAccess.open(out.path_join("runtime-results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("TERRAIN_QA ",JSON.stringify(report))
	var movement_ok := true
	for check in movement:
		movement_ok = movement_ok and check.second_thumb_keeps_movement and check.cancel_releases and check.on_floor and absf(float(check.distance)-8*float(check.sim_seconds))<.4
	report["movement_passed"] = movement_ok
	file = FileAccess.open(out.path_join("runtime-results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	get_tree().quit(0 if on_floor and report.regions==4 and movement_ok else 1)
