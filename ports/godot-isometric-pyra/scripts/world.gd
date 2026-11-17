extends Node2D
## Real 2D renderer. Geometry, navigation, map and authoring view share the same height/control data.
const SX := 8.0
const SY := 4.0
const SH := 9.797958971
const N := 512
var height_bytes: PackedByteArray
var control_bytes: PackedByteArray
var walk_bytes: PackedByteArray
var config: Dictionary
var buildings: Array
var hero_world := Vector2(-40,50)
var hero: PyraActor
var camera := Camera2D.new()
var actors := Node2D.new()
var textures: Array[Texture2D] = []
var motion := Vector2.ZERO
var move_pointer := -1
var move_origin := Vector2.ZERO
var target_world := Vector2.ZERO
var has_target := false
var map_view := SubViewport.new()
var map_camera := Camera2D.new()
var map_holder := SubViewportContainer.new()
var hud := CanvasLayer.new()
var status := Label.new()
var map_marker := Label.new()
var tilemap := TileMapLayer.new()
var ground_meshes := 0
var rng := RandomNumberGenerator.new()
var test_results: Dictionary = {}
var controlled := true
var occupied: Dictionary = {}
var map_refresh := 0.0
var follow_camera := true
var map_expanded := false
var map_caption := Label.new()
var map_grid: Control
var map_button := Button.new()
var mode_button := Button.new()
var map_3d: SubViewportContainer
var mode_3d := false
var decorations: Array[Dictionary]=[]
var stick: Control
var building_art: Dictionary = {}
var building_sprites: Dictionary = {}
var legacy_buildings := "--legacy-buildings" in OS.get_cmdline_user_args()

func sample_height(p: Vector2) -> float:
	var q := (p+Vector2(512,512))/2
	var ix := clampi(floori(q.x),0,N-2)
	var iy := clampi(floori(q.y),0,N-2)
	var tx := clampf(q.x-ix,0,1)
	var ty := clampf(q.y-iy,0,1)
	var a := height_bytes.decode_float((iy*N+ix)*4)
	var b := height_bytes.decode_float((iy*N+ix+1)*4)
	var c := height_bytes.decode_float(((iy+1)*N+ix)*4)
	var d := height_bytes.decode_float(((iy+1)*N+ix+1)*4)
	return lerpf(lerpf(a,b,tx),lerpf(c,d,tx),ty)

func iso(p: Vector2, altitude: float = INF) -> Vector2:
	var h := sample_height(p) if is_inf(altitude) else altitude
	return Vector2((p.x-p.y)*SX,(p.x+p.y)*SY-h*SH)

func flat_inverse(p: Vector2, altitude: float) -> Vector2:
	var y := p.y+altitude*SH
	return Vector2((p.x/SX+y/SY)*.5,(y/SY-p.x/SX)*.5)

func grid_cell(p: Vector2) -> Vector2i:
	return Vector2i(clampi(floori((p.x+512)/128),0,7),clampi(floori((p.y+512)/128),0,7))

func texture_id(p: Vector2) -> int:
	var q := Vector2i((p+Vector2(512,512))/2)
	return int(control_bytes.decode_u32((clampi(q.y,0,511)*512+clampi(q.x,0,511))*4)>>27)&31

func walkable(p: Vector2) -> bool:
	if absf(p.x)>500 or absf(p.y)>500:return false
	var q := Vector2i((p+Vector2(512,512))/2)
	if not walk_bytes.is_empty() and walk_bytes[q.y*N+q.x]==0:return false
	for building: Dictionary in buildings:
		var b := Vector2(building.xz[0],building.xz[1])
		var size := Vector2(building.size[0],building.size[1])
		if Rect2(b-size/2,size).grow(.8).has_point(p):return false
	return true

func _ready() -> void:
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	config=JSON.parse_string(FileAccess.get_file_as_string("res://data/terrain.json"))
	buildings=JSON.parse_string(FileAccess.get_file_as_string("res://data/buildings.json"))
	height_bytes=FileAccess.get_file_as_bytes("res://data/height.r32")
	control_bytes=FileAccess.get_file_as_bytes("res://data/control.r32")
	walk_bytes=FileAccess.get_file_as_bytes("res://data/walkable.u8")
	rng.seed=int(config.seed)
	for name: String in config.texture_assets:
		var source: Texture2D=load("res://materials/%s.webp"%name)
		var image:=source.get_image()
		if image.is_compressed():image.decompress()
		image.generate_mipmaps()
		textures.append(ImageTexture.create_from_image(image))
	build_ground()
	build_tilemap()
	actors.y_sort_enabled=true
	add_child(actors)
	build_objects()
	var definitions: Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://data/actors.json"))
	hero=PyraActor.new()
	hero.setup(definitions["pyra.hero"],"",false,true)
	hero.position=iso(hero_world)
	actors.add_child(hero)
	var npc:=PyraActor.new()
	npc.setup(definitions["pyra.npc.guide"],"Kaena")
	npc.position=iso(Vector2(-31,28))
	actors.add_child(npc)
	camera.position=hero.position
	camera.zoom=Vector2.ONE*.65
	add_child(camera)
	build_hud()
	if "--qa" in OS.get_cmdline_user_args():run_qa.call_deferred()

func ground_shade(point: Vector2) -> Color:
	var normal:=Vector3(-(sample_height(point+Vector2(2,0))-sample_height(point-Vector2(2,0)))/4,1,-(sample_height(point+Vector2(0,2))-sample_height(point-Vector2(0,2)))/4).normalized()
	var shade:=clampf(normal.dot(Vector3(-.5,1,-.3).normalized())*.55+.45,.3,1)
	return Color(shade,shade*.98,shade*.96)

func build_ground() -> void:
	var material:=ShaderMaterial.new()
	material.shader=load("res://shaders/terrain.gdshader")
	for i in 4: material.set_shader_parameter(["ash_tex","basalt_tex","paving_tex","cliff_tex"][i],textures[i])
	material.set_shader_parameter("weights_tex",load("res://data/weights.png"))
	material.set_shader_parameter("surface_tex",load("res://data/surface.png"))
	for cy in range(0,128,16):
		for cx in range(0,128,16):
			var verts:=PackedVector3Array()
			var uv:=PackedVector2Array()
			var colors:=PackedColorArray()
			for diagonal in range(31):
				for dy in range(16):
					var dx:=diagonal-dy
					if dx<0 or dx>=16:continue
					var p:=Vector2((cx+dx)*8-512,(cy+dy)*8-512)
					var corners: Array[Vector2]=[p,p+Vector2(8,0),p+Vector2(0,8),p+Vector2(8,8)]
					for k in [0,1,2,1,3,2]:
						var point:=corners[k]
						var screen:=iso(point)
						verts.append(Vector3(screen.x,screen.y,0))
						uv.append((point+Vector2(512,512))/1024)
						colors.append(ground_shade(point))
			var arrays:=[]
			arrays.resize(Mesh.ARRAY_MAX)
			arrays[Mesh.ARRAY_VERTEX]=verts
			arrays[Mesh.ARRAY_TEX_UV]=uv
			arrays[Mesh.ARRAY_COLOR]=colors
			var mesh:=ArrayMesh.new()
			mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
			var node:=MeshInstance2D.new()
			node.mesh=mesh
			node.material=material
			node.z_index=-100
			add_child(node)
			ground_meshes+=1

func build_tilemap() -> void:
	var image:=Image.create(128,64,false,Image.FORMAT_RGBA8)
	var source:=textures[2].get_image()
	for y in 64:
		for x in 128:
			var dx:=(x+.5)/64-1
			var dy:=(y+.5)/32-1
			if absf(dx)+absf(dy)>1:continue
			var u:=(dx+dy+1)*.5
			var v:=(dy-dx+1)*.5
			image.set_pixel(x,y,source.get_pixel(clampi(int(u*source.get_width()),0,source.get_width()-1),clampi(int(v*source.get_height()),0,source.get_height()-1)))
	image.generate_mipmaps()
	var tileset:=TileSet.new()
	tileset.tile_shape=TileSet.TILE_SHAPE_ISOMETRIC
	tileset.tile_layout=TileSet.TILE_LAYOUT_DIAMOND_DOWN
	tileset.tile_size=Vector2i(128,64)
	var atlas:=TileSetAtlasSource.new()
	atlas.texture=ImageTexture.create_from_image(image)
	atlas.texture_region_size=Vector2i(128,64)
	atlas.create_tile(Vector2i.ZERO)
	tileset.add_source(atlas,0)
	tilemap.tile_set=tileset
	tilemap.z_index=-90
	tilemap.modulate.a=0.0
	add_child(tilemap)
	tilemap.position=Vector2(0,-12*SH)-tilemap.map_to_local(Vector2i.ZERO)
	for z in range(-12,18):
		for x in range(-15,12):
			var p:=Vector2(x*8,z*8)
			if texture_id(p)==2 and absf(sample_height(p)-12)<.05:
				tilemap.set_cell(Vector2i(x,z),0,Vector2i.ZERO)

func object_sprite(path: String, p: Vector2, width: float) -> Sprite2D:
	var s:=Sprite2D.new()
	s.texture=load(path)
	s.centered=false
	s.offset=Vector2(-s.texture.get_width()/2.0,-s.texture.get_height()*.92)
	s.scale=Vector2.ONE*(width/s.texture.get_width())
	s.position=iso(p)
	actors.add_child(s)
	decorations.append({"sprite":s,"xz":p})
	return s

func build_objects() -> void:
	if not legacy_buildings:
		building_art=JSON.parse_string(FileAccess.get_file_as_string("res://data/building-art.json")).buildings
	for b: Dictionary in buildings:
		var p:=Vector2(b.xz[0],b.xz[1])
		var binding: Dictionary=building_art.get(str(b.id),{})
		var sprite:=object_sprite(str(binding.get("texture",b.texture)),p,float(b.size[0])*16)
		if not binding.is_empty():
			var origin:=Vector2(binding.origin[0],binding.origin[1])
			sprite.offset=-Vector2(sprite.texture.get_size())*origin
			sprite.scale=Vector2.ONE*float(binding.scale)
			building_contact_shadow(p,Vector2(b.size[0],b.size[1]))
		building_sprites[str(b.id)]=sprite
	# Cluster local woodland on the sheltered western slope; scree follows the rift.
	for i in 350:
		var p:=Vector2(rng.randfn(-270,60),rng.randfn(5,95))
		if not walkable(p) or absf(p.x)>470 or absf(p.y)>470 or near_road(p):continue
		var cell:=Vector2i(p/9)
		if occupied.has(cell):continue
		occupied[cell]=true
		object_sprite("res://assets/objects/56b49778-ki-v2-objects-pyra-tree2-0.webp",p,rng.randf_range(110,200))
	for i in 220:
		var z:=rng.randf_range(-460,460)
		var x:=165+26*sin(z/85)+rng.randfn(0,35)
		var p:=Vector2(x,z)
		if sample_height(p)<2:continue
		object_sprite("res://assets/objects/3d90558c-pyra-continent-rocks.webp",p,rng.randf_range(80,160))

func building_contact_shadow(p: Vector2, size: Vector2) -> void:
	# Presentation only; sampled from the SAME terrain, never a collision change.
	var shadow:=Polygon2D.new()
	var points:=PackedVector2Array()
	var uv:=PackedVector2Array()
	for q in [Vector2(-1,-1),Vector2(1,-1),Vector2(1,1),Vector2(-1,1)]:
		points.append(iso(p+q*size*.62))
		uv.append((q+Vector2.ONE)*.5)
	shadow.polygon=points
	shadow.uv=uv
	shadow.z_index=-3
	var material:=ShaderMaterial.new()
	material.shader=preload("res://shaders/building_shadow.gdshader")
	shadow.material=material
	add_child(shadow)

func near_road(p: Vector2) -> bool:
	for path: Array in config.paths:
		for i in path.size()-1:
			var a:=Vector2(path[i][0],path[i][1])
			var b:=Vector2(path[i+1][0],path[i+1][1])
			if Geometry2D.get_closest_point_to_segment(p,a,b).distance_to(p)<10:return true
	return false

func build_hud() -> void:
	add_child(hud)
	var title:=Label.new()
	title.text="KI LEGENDS · PYRA\nPRÓBA IZOMETRII 2D"
	title.position=Vector2(22,18)
	title.add_theme_font_size_override("font_size",23)
	title.add_theme_color_override("font_color",Color("ffe0a6"))
	title.add_theme_color_override("font_outline_color",Color.BLACK)
	title.add_theme_constant_override("outline_size",6)
	hud.add_child(title)
	status.position=Vector2(22,672)
	status.add_theme_font_size_override("font_size",18)
	status.add_theme_color_override("font_outline_color",Color.BLACK)
	status.add_theme_constant_override("outline_size",6)
	hud.add_child(status)
	map_holder.position=Vector2(948,16)
	map_holder.size=Vector2(310,210)
	map_holder.stretch=true
	map_view.size=Vector2i(310,210)
	map_view.disable_3d=true
	map_view.world_2d=get_world_2d()
	map_view.render_target_update_mode=SubViewport.UPDATE_ONCE
	map_holder.add_child(map_view)
	map_camera.position=Vector2(0,-350)
	map_camera.zoom=Vector2.ONE*.018
	map_view.add_child(map_camera)
	hud.add_child(map_holder)
	var grid:=preload("res://scripts/map_grid.gd").new()
	grid.world=self
	map_grid=grid
	grid.position=map_holder.position
	grid.size=map_holder.size
	grid.mouse_filter=Control.MOUSE_FILTER_IGNORE
	hud.add_child(grid)
	map_marker.text="●"
	map_marker.add_theme_color_override("font_color",Color("ff5b37"))
	map_marker.add_theme_font_size_override("font_size",16)
	map_marker.mouse_filter=Control.MOUSE_FILTER_IGNORE
	hud.add_child(map_marker)
	var caption:=map_caption
	caption.text="TEN SAM ŚWIAT · SIATKA 128 m"
	caption.position=Vector2(950,230)
	caption.add_theme_font_size_override("font_size",15)
	hud.add_child(caption)
	map_button.text="MAPA [M]"
	map_button.custom_minimum_size=Vector2(130,84)
	map_button.position=Vector2(1110,270)
	map_button.pressed.connect(toggle_map)
	stick=preload("res://scripts/stick.gd").new()
	stick.world=self
	stick.mouse_filter=Control.MOUSE_FILTER_IGNORE
	hud.add_child(stick)
	hud.add_child(map_button)
	mode_button.text="MAPA 3D"
	mode_button.custom_minimum_size=Vector2(130,84)
	mode_button.pressed.connect(toggle_map_mode)
	hud.add_child(mode_button)
	get_viewport().size_changed.connect(layout_hud)
	layout_hud()

func layout_hud() -> void:
	var viewport:=get_viewport_rect().size
	map_holder.position=Vector2(20,95) if map_expanded else Vector2(viewport.x-332,16)
	map_holder.size=viewport-Vector2(40,190) if map_expanded else Vector2(310,210)
	map_grid.position=map_holder.position
	map_grid.size=map_holder.size
	map_grid.queue_redraw()
	map_camera.zoom=Vector2.ONE*minf(map_holder.size.x/17000,map_holder.size.y/9000)*.95
	map_caption.position=map_holder.position+Vector2(2,map_holder.size.y+4)
	map_button.position=Vector2(viewport.x-152,viewport.y-108)
	mode_button.position=map_button.position-Vector2(150,0)
	if map_3d!=null:
		map_3d.position=map_holder.position
		map_3d.size=map_holder.size
	map_holder.visible=not mode_3d
	map_grid.visible=not mode_3d
	map_marker.visible=not mode_3d
	if map_3d!=null:map_3d.visible=mode_3d
	map_caption.text="TEN SAM ŚWIAT · SIATKA 128 m" if not mode_3d else "TEN SAM TEREN 3D · PRZECIĄGNIJ, ABY OBRÓCIĆ"
	status.position=Vector2(22,viewport.y-42)
	map_view.render_target_update_mode=SubViewport.UPDATE_ONCE

func toggle_map_mode() -> void:
	if map_3d==null:
		map_3d=preload("res://scripts/map_3d.gd").new()
		map_3d.z_index=-1
		hud.add_child(map_3d)
		map_3d.setup(self)
	mode_3d=not mode_3d
	mode_button.text="MAPA 2D" if mode_3d else "MAPA 3D"
	layout_hud()

func toggle_map() -> void:
	map_expanded=not map_expanded
	if stick!=null:stick.queue_redraw()
	move_pointer=-1
	motion=Vector2.ZERO
	layout_hud()

func _exit_tree() -> void:
	PyraActor.sheet_cache.clear()

func _notification(what: int) -> void:
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT:
		move_pointer=-1
		motion=Vector2.ZERO

func _input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode==KEY_M:toggle_map()
	if stick!=null:stick.queue_redraw()
	if map_expanded:return
	if event is InputEventScreenTouch:
		if event.pressed and event.position.x<get_viewport_rect().size.x*.45 and move_pointer==-1:
			move_pointer=event.index
			move_origin=event.position
		elif event.index==move_pointer and (not event.pressed or event.canceled):
			move_pointer=-1
			motion=Vector2.ZERO
	if event is InputEventScreenDrag and event.index==move_pointer:
		motion=((event.position-move_origin)/65).limit_length(1)

func _physics_process(delta: float) -> void:
	if hero==null:return
	var input:=motion
	if controlled and not map_expanded:
		input+=Vector2(float(Input.is_physical_key_pressed(KEY_D))-float(Input.is_physical_key_pressed(KEY_A)),float(Input.is_physical_key_pressed(KEY_S))-float(Input.is_physical_key_pressed(KEY_W)))
	else:input=Vector2.ZERO
	input=input.limit_length(1)
	var direction:=flat_inverse(input,0).normalized() if input.length_squared()>.001 else Vector2.ZERO
	var next:=hero_world+direction*8*delta
	if walkable(next):hero_world=next
	hero.position=iso(hero_world)
	hero.animate(input)
	if follow_camera:camera.position=hero.position
	map_refresh+=delta
	if map_refresh>.33:
		map_refresh=0
		map_view.render_target_update_mode=SubViewport.UPDATE_ONCE
		if map_3d!=null and mode_3d:map_3d.update_player()
	var cell:=grid_cell(hero_world)
	var street_cell:=tilemap.local_to_map(hero.position-tilemap.position)
	var on_street:=tilemap.get_cell_source_id(street_cell)>=0
	status.text="WASD / lewy kciuk · %s · %s%d · x %.1f / z %.1f"%["Ulica" if on_street else "Teren",String.chr(65+cell.x),cell.y+1,hero_world.x,hero_world.y]
	map_marker.position=map_holder.position+(hero.position-map_camera.position)*map_camera.zoom+map_holder.size/2-Vector2(7,9)

func run_qa() -> void:
	controlled=false
	await get_tree().create_timer(2.0).timeout
	for i in 30:await get_tree().process_frame
	var out:=OS.get_environment("KI_ISO_QA_DIR")
	if out.is_empty():out="user://qa/isometric"
	DirAccess.make_dir_recursive_absolute(out)
	var art_checks: Dictionary={}
	for b: Dictionary in buildings:
		var sprite: Sprite2D=building_sprites[str(b.id)]
		art_checks[str(b.id)+"_anchor"]=sprite.position.distance_to(iso(Vector2(b.xz[0],b.xz[1])))<.001
		art_checks[str(b.id)+"_texture"]=sprite.texture!=null and (legacy_buildings or sprite.texture.resource_path==str(building_art[str(b.id)].texture))
		if not legacy_buildings:
			art_checks[str(b.id)+"_hash"]=FileAccess.get_sha256(str(building_art[str(b.id)].texture))==str(building_art[str(b.id)].sha256)
	if "--building-qa" in OS.get_cmdline_user_args():
		follow_camera=false
		for b: Dictionary in buildings:
			var sprite: Sprite2D=building_sprites[str(b.id)]
			camera.position=sprite.position+Vector2(0,-110)
			camera.zoom=Vector2.ONE*1.2
			for frame in 5:await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_jpg(out.path_join("building-%s.jpg"%b.id),.93)
		follow_camera=true
		camera.zoom=Vector2.ONE*.65
		for frame in 5:await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("city.jpg"),.93)
	follow_camera=false
	camera.position=iso(Vector2(0,30))+Vector2(0,-70)
	camera.zoom=Vector2.ONE*.4
	for i in 45:await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("city-wide.jpg"),.93)
	follow_camera=true
	toggle_map()
	for i in 30:await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("same-world-map.jpg"),.93)
	toggle_map()
	hero_world=Vector2(-235,-285)
	camera.zoom=Vector2.ONE*.55
	for i in 30:await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("western-ridge.jpg"),.93)
	hero_world=Vector2(-40,50)
	camera.zoom=Vector2.ONE*.48
	toggle_map()
	toggle_map_mode()
	for i in 35:await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_jpg(out.path_join("same-world-map-3d.jpg"),.93)
	var map3d_alignment: Dictionary=map_3d.validate_alignment()
	toggle_map_mode()
	toggle_map()
	var roundtrip:=0.0
	for i in 256:
		var p:=Vector2(rng.randf_range(-495,495),rng.randf_range(-495,495))
		roundtrip=maxf(roundtrip,p.distance_to(flat_inverse(iso(p),sample_height(p))))
	hero_world=Vector2(-40,50)
	camera.zoom=Vector2.ONE*.65
	var movement: Array[Dictionary]=[]
	for fps in [30,120]:
		Engine.max_fps=fps
		hero_world=Vector2(-40,50)
		controlled=true
		var touch:=InputEventScreenTouch.new()
		touch.index=4
		touch.pressed=true
		touch.position=Vector2(180,550)
		get_viewport().push_input(touch,true)
		var drag:=InputEventScreenDrag.new()
		drag.index=4
		drag.position=Vector2(245,550)
		get_viewport().push_input(drag,true)
		var other:=InputEventScreenTouch.new()
		other.index=7
		other.pressed=true
		other.position=Vector2(1100,550)
		get_viewport().push_input(other,true)
		other.pressed=false
		get_viewport().push_input(other,true)
		var kept:=move_pointer==4 and motion.length()>.9
		var start:=hero_world
		var elapsed:=0.0
		while elapsed<2:
			await get_tree().physics_frame
			elapsed+=get_physics_process_delta_time()
		touch.pressed=false
		touch.canceled=true
		get_viewport().push_input(touch,true)
		movement.append({"fps_cap":fps,"distance_m":hero_world.distance_to(start),"sim_seconds":elapsed,"second_thumb_keeps_motion":kept,"cancel_releases":move_pointer==-1 and motion==Vector2.ZERO,"walk_animation":hero.sprite.animation})
		controlled=false
	Engine.max_fps=0
	var tile_error:=0.0
	for cell: Vector2i in tilemap.get_used_cells():
		tile_error=maxf(tile_error,(tilemap.map_to_local(cell)+tilemap.position).distance_to(iso(Vector2(cell)*8,12)))
	var map_error:=0.0
	for p in [Vector2(-40,50),Vector2(-235,-285),Vector2(145,85)]:
		var manual:=(iso(p)-map_camera.position)*map_camera.zoom+Vector2(map_view.size)/2
		var actual:=map_view.get_canvas_transform()*iso(p)
		map_error=maxf(map_error,manual.distance_to(actual))
	var movement_ok:=true
	for item in movement:movement_ok=movement_ok and item.second_thumb_keeps_motion and item.cancel_releases and absf(float(item.distance_m)-8*float(item.sim_seconds))<.4
	var report:={"renderer":"Godot 2D / "+RenderingServer.get_current_rendering_method(),"adapter":RenderingServer.get_video_adapter_name(),"height_sha256":FileAccess.get_sha256("res://data/height.r32"),"control_sha256":FileAccess.get_sha256("res://data/control.r32"),"map_shares_actual_World2D":map_view.world_2d==get_world_2d(),"projection_roundtrip_max_m":roundtrip,"terrain_batches":ground_meshes,"tilemap_cells":tilemap.get_used_cells().size(),"fps":Engine.get_frames_per_second(),"hero_animation":hero.sprite.animation,"draw_calls":Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),"texture_bytes":Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED),"android_device_tested":false,"full_game_port":false,"map3d":map3d_alignment,"movement":movement,"movement_passed":movement_ok,"tilemap_alignment_max_px":tile_error,"map_camera_alignment_max_px":map_error}
	var file:=FileAccess.open(out.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("ISO_QA ",JSON.stringify(report))
	var checks: Dictionary={"shared_world_map":report.map_shares_actual_World2D,"projection_roundtrip":roundtrip<.001,"map_camera_alignment":map_error<1,"street_grid_alignment":tile_error<.01,"texture_budget_64_mib":report.texture_bytes<64*1024*1024,"map3d_height":map3d_alignment.height_max_m<.001,"map3d_projection":map3d_alignment.projection_max_px<.05,"map3d_assets_shared":map3d_alignment.shares_textures and map3d_alignment.decorations==decorations.size()}
	for item in movement:
		checks["movement_%d_fps"%item.fps_cap]=absf(float(item.distance_m)-8*float(item.sim_seconds))<.4
		checks["two_thumb_%d_fps"%item.fps_cap]=item.second_thumb_keeps_motion
		checks["pointer_cancel_%d_fps"%item.fps_cap]=item.cancel_releases
	checks.merge(art_checks)
	report["checks"]=checks
	report["passed"]=checks.values().filter(func(v):return v).size()
	report["failed"]=checks.size()-report.passed
	file=FileAccess.open(out.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	print("ISO_CHECKS ",report.passed,"/",checks.size())
	get_tree().quit(0 if report.failed==0 else 1)
