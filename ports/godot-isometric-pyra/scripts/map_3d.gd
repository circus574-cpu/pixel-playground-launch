extends SubViewportContainer
## Local 3D map, not another painted atlas. Same height samples, masks, props and actor position as the 2D scene.
var world: Node2D
var viewport:=SubViewport.new()
var camera:=Camera3D.new()
var terrain_mesh:=MeshInstance3D.new()
var player:=MeshInstance3D.new()
var yaw:=45.0
var pitch:=30.0
var dragging:=false
var sprites: Array[Dictionary]=[]

func setup(source: Node2D) -> void:
	world=source
	stretch=true
	stretch_shrink=1
	viewport.own_world_3d=true
	viewport.size=Vector2i(620,265)
	viewport.render_target_update_mode=SubViewport.UPDATE_ONCE
	add_child(viewport)
	var environment:=WorldEnvironment.new()
	environment.environment=Environment.new()
	environment.environment.background_mode=Environment.BG_COLOR
	environment.environment.background_color=Color("080d14")
	viewport.add_child(environment)
	camera.projection=Camera3D.PROJECTION_ORTHOGONAL
	camera.keep_aspect=Camera3D.KEEP_HEIGHT
	camera.size=840
	camera.far=5000
	camera.current=true
	viewport.add_child(camera)
	build_ground()
	build_grid()
	for item: Dictionary in world.decorations:
		var original: Sprite2D=item.sprite
		var sprite:=Sprite3D.new()
		sprite.texture=original.texture
		sprite.billboard=BaseMaterial3D.BILLBOARD_ENABLED
		sprite.shaded=false
		sprite.pixel_size=original.scale.x/sqrt(128.0)
		viewport.add_child(sprite)
		var center:=original.offset+Vector2(original.texture.get_size())*.5
		sprites.append({"node":sprite,"xz":item.xz,"rise":-center.y*sprite.pixel_size,"side":center.x*sprite.pixel_size})
	var sphere:=SphereMesh.new()
	sphere.radius=5
	sphere.height=10
	player.mesh=sphere
	var red:=StandardMaterial3D.new()
	red.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	red.albedo_color=Color("ff4c28")
	player.material_override=red
	viewport.add_child(player)
	update_camera()
	update_player()

func build_ground() -> void:
	var vertices:=PackedVector3Array()
	var uv:=PackedVector2Array()
	var colors:=PackedColorArray()
	for z in 128:
		for x in 128:
			var p:=Vector2(x*8-512,z*8-512)
			var corners: Array[Vector2]=[p,p+Vector2(8,0),p+Vector2(0,8),p+Vector2(8,8)]
			for i in [0,2,1,1,2,3]:
				var q:=corners[i]
				vertices.append(Vector3(q.x,world.sample_height(q),q.y))
				uv.append((q+Vector2(512,512))/1024)
				colors.append(world.ground_shade(q))
	var arrays:=[]
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX]=vertices
	arrays[Mesh.ARRAY_TEX_UV]=uv
	arrays[Mesh.ARRAY_COLOR]=colors
	var mesh:=ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
	terrain_mesh.mesh=mesh
	var material:=ShaderMaterial.new()
	material.shader=load("res://shaders/map_3d_legacy.gdshader" if world.legacy_terrain else "res://shaders/map_3d.gdshader")
	world.material_library.apply(material)
	terrain_mesh.material_override=material
	viewport.add_child(terrain_mesh)

func build_grid() -> void:
	var mesh:=ImmediateMesh.new()
	mesh.surface_begin(Mesh.PRIMITIVE_LINES)
	for line in 9:
		for axis in 2:
			for segment in 32:
				for step in [segment,segment+1]:
					var a: float=-512.0+line*128
					var b: float=-512.0+step*32
					var p:=Vector2(a,b) if axis==0 else Vector2(b,a)
					mesh.surface_add_vertex(Vector3(p.x,world.sample_height(p)+.5,p.y))
	mesh.surface_end()
	var node:=MeshInstance3D.new()
	node.mesh=mesh
	var material:=StandardMaterial3D.new()
	material.shading_mode=BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color=Color(.9,.77,.48,.4)
	material.transparency=BaseMaterial3D.TRANSPARENCY_ALPHA
	node.material_override=material
	viewport.add_child(node)
	for row in 8:
		for col in 8:
			var p:=Vector2(-448+col*128,-448+row*128)
			var label:=Label3D.new()
			label.text=String.chr(65+col)+str(row+1)
			label.font_size=48
			label.no_depth_test=true
			label.pixel_size=.6
			label.billboard=BaseMaterial3D.BILLBOARD_ENABLED
			label.position=Vector3(p.x,world.sample_height(p)+3,p.y)
			label.modulate=Color("ead3a1")
			viewport.add_child(label)

func update_camera() -> void:
	var a:=deg_to_rad(yaw)
	var b:=deg_to_rad(pitch)
	camera.position=Vector3(sin(a)*cos(b),sin(b),cos(a)*cos(b))*1800
	camera.look_at(Vector3.ZERO)
	for item in sprites:
		var p: Vector2=item.xz
		item.node.position=Vector3(p.x,world.sample_height(p),p.y)+camera.global_basis.y*float(item.rise)+camera.global_basis.x*float(item.side)
	viewport.render_target_update_mode=SubViewport.UPDATE_ONCE

func update_player() -> void:
	var p: Vector2=world.hero_world
	player.position=Vector3(p.x,world.sample_height(p)+5,p.y)
	if visible:viewport.render_target_update_mode=SubViewport.UPDATE_ONCE

func _gui_input(event: InputEvent) -> void:
	if event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:dragging=event.pressed
	if event is InputEventMouseMotion and dragging:
		yaw-=event.relative.x*.3
		pitch=clampf(pitch+event.relative.y*.15,22,65)
		update_camera()

func validate_alignment() -> Dictionary:
	var projection_error:=0.0
	var height_error:=0.0
	var vertices: PackedVector3Array=terrain_mesh.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	for i in range(0,vertices.size(),383):
		var v:=vertices[i]
		var p:=Vector2(v.x,v.z)
		height_error=maxf(height_error,absf(v.y-world.sample_height(p)))
		var expected: Vector2=Vector2(viewport.size)/2+world.iso(p)*(float(viewport.size.y)/camera.size/sqrt(128.0))
		projection_error=maxf(projection_error,expected.distance_to(camera.unproject_position(v)))
	var shares_textures:=true
	for i in 4:
		shares_textures=shares_textures and terrain_mesh.material_override.get_shader_parameter(["ash_tex","basalt_tex","paving_tex","cliff_tex"][i])==world.textures[i]
	if world.material_library.plazas!=null:
		shares_textures=shares_textures and terrain_mesh.material_override.get_shader_parameter("plaza_tex")==world.material_library.plazas
	shares_textures=shares_textures and terrain_mesh.material_override.get_shader_parameter("weights_tex")==world.material_library.weights
	if not world.legacy_terrain:
		shares_textures=shares_textures and terrain_mesh.material_override.get_shader_parameter("environment_tex")==world.material_library.environment and terrain_mesh.material_override.get_shader_parameter("transition_tex")==world.material_library.transition
	var city_surfaces: Dictionary=world.material_library.city_surfaces
	var shares_city_surfaces:=not city_surfaces.is_empty()
	for parameter: String in city_surfaces:
		shares_city_surfaces=shares_city_surfaces and terrain_mesh.material_override.get_shader_parameter(parameter)==city_surfaces[parameter]
	return {"shares_city_surfaces":shares_city_surfaces,"height_max_m":height_error,"projection_max_px":projection_error,"decorations":sprites.size(),"shares_textures":shares_textures}
