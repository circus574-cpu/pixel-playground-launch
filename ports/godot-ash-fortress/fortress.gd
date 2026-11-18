extends Node3D

# Coordinates run from the gate in the southwest toward the Crown in the north.
const AREAS := [
	[Rect2(-17, 12, 12, 10), 0.0],
	[Rect2(-14, -4, 17, 16), 3.0],
	[Rect2(-4, -7, 20, 6), 3.0],
	[Rect2(-16, -22, 15, 13), 10.0],
	[Rect2(6, 1, 17, 14), 0.0],
]
const STAIRS := [
	[Rect2(-12, 12, 4, 6), 3.0, 0.0],
	[Rect2(-9, -9, 4, 5.1), 10.0, 3.0],
	[Rect2(9, -1.1, 4, 4.1), 3.0, 0.0],
]
const CHUNK := 12
var chunks: Dictionary = {}
var active: Dictionary = {}
var obstacles: Array[Rect2] = []
var hero := Vector2(-10, 19)
var destination := Vector2.INF
var marker: MeshInstance3D
var camera := Camera3D.new()
var overview := true
var stone: StandardMaterial3D
var ash: StandardMaterial3D
var lava: StandardMaterial3D
var roof: StandardMaterial3D
var iron: StandardMaterial3D
var fire: StandardMaterial3D
var paving: StandardMaterial3D
var rng := RandomNumberGenerator.new()

func _ready() -> void:
	rng.seed = 20261118
	stone = material(Color("776970"), "res://assets/bazalt-klif.png")
	ash = material(Color("b4a6a1"), "res://assets/popiol-taras.png")
	lava = material(Color("ef6b25"), "res://assets/lawa-nurt.png", Color("f04915"))
	roof = material(Color("592d36"))
	iron = material(Color("403a46"))
	fire = material(Color("ffab42"), "", Color("ff7023"))
	paving = material(Color("b6a19b"), "res://assets/bazalt-klif.png")
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("30262e")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("c9b7c7")
	environment.environment.ambient_light_energy = 0.68
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-53, -38, 0)
	sun.light_color = Color("ffcaa5")
	sun.light_energy = 1.18
	add_child(sun)
	add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.current = true
	build_city()
	marker = MeshInstance3D.new()
	var body := CapsuleMesh.new()
	body.radius = 0.27
	body.height = 1.18
	marker.mesh = body
	marker.material_override = material(Color("86e2ce"))
	add_child(marker)
	place_camera()
	stream_chunks()
	var hud := CanvasLayer.new()
	add_child(hud)
	var hint := Label.new()
	hint.text = "Twierdza Popiołu  •  WASD / strzałki lub dotknij drogi  •  Tab: kamera"
	hint.position = Vector2(18, 14)
	hud.add_child(hint)
	var button := Button.new()
	button.text = "Zmień widok"
	button.position = Vector2(18, 44)
	button.pressed.connect(toggle_camera)
	hud.add_child(button)
	if "--test-route" in OS.get_cmdline_user_args():
		test_route()
	if "--capture" in OS.get_cmdline_user_args():
		capture_view.call_deferred()

func capture_view() -> void:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var result := get_viewport().get_texture().get_image().save_png("res://podglad-pyry.png")
	get_tree().quit(result)

func material(color: Color, path := "", emission := Color.BLACK) -> StandardMaterial3D:
	var result := StandardMaterial3D.new()
	result.albedo_color = color
	if ResourceLoader.exists(path):
		result.albedo_texture = load(path)
	if emission != Color.BLACK:
		result.emission_enabled = true
		result.emission = emission
		result.emission_energy_multiplier = 0.55
	return result

func height_at(p: Vector2) -> float:
	for stair in STAIRS:
		var rect: Rect2 = stair[0]
		if rect.grow(0.015).has_point(p):
			return lerpf(stair[1], stair[2], clampf((p.y - rect.position.y) / rect.size.y, 0, 1))
	for area in AREAS:
		var rect: Rect2 = area[0]
		if rect.has_point(p):
			return area[1]
	return -INF

func can_move(p: Vector2, from: Vector2) -> bool:
	if absf(height_at(p) - height_at(from)) > 0.8:
		return false
	if is_inf(height_at(p)):
		return false
	for rect in obstacles:
		if rect.grow(0.27).has_point(p):
			return false
	return true

func chunk_for(p: Vector2) -> Node3D:
	var key := Vector2i((p / CHUNK).floor())
	if not chunks.has(key):
		chunks[key] = Node3D.new()
	return chunks[key]

func mesh_at(mesh: Mesh, mat: Material, pos: Vector3) -> MeshInstance3D:
	var instance := MeshInstance3D.new()
	instance.mesh = mesh
	instance.material_override = mat
	instance.position = pos
	chunk_for(Vector2(pos.x, pos.z)).add_child(instance)
	return instance

func box(pos: Vector3, size: Vector3, mat: Material) -> MeshInstance3D:
	var mesh := BoxMesh.new()
	mesh.size = size
	return mesh_at(mesh, mat, pos)

func column(pos: Vector3, top: float, bottom: float, tall: float, sides: int, mat: Material) -> void:
	var mesh := CylinderMesh.new()
	mesh.top_radius = top
	mesh.bottom_radius = bottom
	mesh.height = tall
	mesh.radial_segments = sides
	mesh_at(mesh, mat, pos)

func tower(p: Vector2, ground: float, size: float) -> void:
	column(Vector3(p.x, ground + size * 0.68, p.y), size * .46, size * .62, size * 1.36, 8, iron)
	column(Vector3(p.x, ground + size * 1.65, p.y), 0.04, size * .54, size * .72, 8, roof)
	obstacles.append(Rect2(p - Vector2.ONE * size * .45, Vector2.ONE * size * .9))

func house(p: Vector2, ground: float, size: Vector2, forge := false) -> void:
	box(Vector3(p.x, ground + 0.85, p.y), Vector3(size.x, 1.7, size.y), stone)
	var cap := PrismMesh.new()
	cap.size = Vector3(size.x + .32, .95, size.y + .35)
	mesh_at(cap, roof, Vector3(p.x, ground + 2.16, p.y))
	box(Vector3(p.x, ground + .61, p.y + size.y * .51), Vector3(.62, 1.12, .08), fire if forge else iron)
	for dx in [-.36, .36]:
		box(Vector3(p.x + size.x * dx, ground + 1.1, p.y + size.y * .514), Vector3(.25,.37,.09), fire)
	if forge:
		column(Vector3(p.x + size.x * .34, ground + 2.1, p.y - size.y * .25), .27, .47, 4.2, 6, iron)
	obstacles.append(Rect2(p - size * .5, size))

func ground_piece(rect: Rect2, h: float) -> void:
	for x in range(floori(rect.position.x), ceili(rect.end.x), 4):
		for z in range(floori(rect.position.y), ceili(rect.end.y), 4):
			var width := minf(4, rect.end.x - x)
			var depth := minf(4, rect.end.y - z)
			var c := Vector3(x + width / 2, h - 0.15, z + depth / 2)
			box(c, Vector3(width, .3, depth), ash)
			box(c - Vector3(0, (h + 4) / 2, 0), Vector3(width, h + 4, depth), stone)

func wall(a: Vector2, b: Vector2, h: float) -> void:
	var center := (a + b) * .5
	var angle := -(b - a).angle()
	box(Vector3(center.x, h + .81, center.y), Vector3(a.distance_to(b), 1.62, .48), stone).rotation.y = angle
	var count := ceili(a.distance_to(b) / .83)
	for i in count:
		var p := a.lerp(b, (i + .5) / count)
		box(Vector3(p.x, h + 1.77, p.y), Vector3(.49, .39, .55), iron).rotation.y = angle

func lava_river() -> void:
	var strip := SurfaceTool.new()
	strip.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for i in 49:
		var x := -15.0 + i * .97
		var z := 24.0 - maxf(0.0, x - 3.0) * .29 + sin(i * .24) * 1.2
		for side in [-1.0, 1.0]:
			strip.set_normal(Vector3.UP)
			strip.set_uv(Vector2(i / 7.0, (side + 1) * .5))
			strip.add_vertex(Vector3(x, -3.46, z + side * (1.8 + .4 * sin(i * .36))))
	lava.cull_mode = BaseMaterial3D.CULL_DISABLED
	mesh_at(strip.commit(), lava, Vector3(6, 0, 18)).position = Vector3.ZERO

func build_city() -> void:
	for area in AREAS:
		ground_piece(area[0], area[1])
	for stair in STAIRS:
		var r: Rect2 = stair[0]
		for i in 16:
			var z := r.position.y + (i + .5) * r.size.y / 16
			var h := lerpf(stair[1], stair[2], (i + .5) / 16)
			box(Vector3(r.get_center().x, h - .12, z), Vector3(r.size.x, .24, r.size.y / 16 + .012), ash)
			for x in [r.position.x, r.end.x]:
				if i % 5 == 0:
					column(Vector3(x, h + .52, z), .19, .23, 1.04, 5, iron)
					column(Vector3(x, h + 1.13, z), .10, .24, .27, 6, fire)
	tower(Vector2(-13.6, 12), 3, 2.6)
	tower(Vector2(-6.3, 12), 3, 2.6)
	box(Vector3(-10, 6.4, 12), Vector3(6, 1.02, .8), iron)
	for p in [Vector2(-14,-19),Vector2(-3,-19),Vector2(-14,-11),Vector2(-3,-11)]:
		tower(p, 10, 2.4)
	wall(Vector2(-14,-19), Vector2(-14,-11), 10)
	wall(Vector2(-3,-19), Vector2(-3,-11), 10)
	wall(Vector2(-14,-11), Vector2(-9,-11), 10)
	wall(Vector2(-5,-11), Vector2(-3,-11), 10)
	wall(Vector2(-14,12), Vector2(-14,2), 3)
	wall(Vector2(-6,12), Vector2(2,12), 3)
	house(Vector2(-8.5,-19), 10, Vector2(7,4))
	for p in [Vector2(-12,-1),Vector2(-12,4),Vector2(-3,7),Vector2(0.5,6)]:
		house(p, 3, Vector2(2.9,2.1))
	for p in [Vector2(15,4),Vector2(20,3),Vector2(19,10),Vector2(9,11)]:
		house(p, 0, Vector2(3.5,3), true)
	box(Vector3(-8.0, 3.025, 4.0), Vector3(3.0,.05,15.5), paving)
	box(Vector3(4.0, 3.027, -4.0), Vector3(23.0,.05,2.8), paving)
	box(Vector3(13.0, .025, 8.0), Vector3(9.0,.05,5.5), paving)
	lava_river()
	for i in 140:
		var p := Vector2(rng.randf_range(-24, 29), rng.randf_range(-25, 24))
		if is_inf(height_at(p)) and p.y < 17:
			var h := rng.randf_range(1.0, 6.0)
			column(Vector3(p.x, h*.5-4, p.y), .24, rng.randf_range(.6, 1.8), h, 5, stone)

func stream_chunks() -> void:
	var center := Vector2i((hero / CHUNK).floor())
	var radius := 4 if overview else 2
	for key: Vector2i in chunks:
		var wanted := maxi(absi(key.x-center.x), absi(key.y-center.y)) <= radius
		if wanted and not active.has(key):
			add_child(chunks[key])
			active[key] = true
		elif not wanted and active.has(key):
			remove_child(chunks[key])
			active.erase(key)

func toggle_camera() -> void:
	overview = not overview
	place_camera()
	stream_chunks()

func place_camera() -> void:
	var target := Vector3(1, 2, -2) if overview else Vector3(hero.x, height_at(hero), hero.y)
	camera.position = target + Vector3(39, 35, 45)
	camera.look_at(target)
	camera.size = 51 if overview else 22

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_TAB:
		toggle_camera()
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		var start := camera.project_ray_origin(event.position)
		var direction := camera.project_ray_normal(event.position)
		for i in 260:
			var hit := start + direction * i * .42
			var p := Vector2(hit.x, hit.z)
			var h := height_at(p)
			if not is_inf(h) and absf(hit.y - h) < .33:
				destination = p
				break

func _physics_process(delta: float) -> void:
	var input := Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")
	input += Vector2(float(Input.is_physical_key_pressed(KEY_D)) - float(Input.is_physical_key_pressed(KEY_A)), float(Input.is_physical_key_pressed(KEY_S)) - float(Input.is_physical_key_pressed(KEY_W)))
	var direction := Vector2.ZERO
	if input.length_squared() > 0.01:
		destination = Vector2.INF
		direction = input.normalized().rotated(-.71)
	elif destination != Vector2.INF:
		if hero.distance_to(destination) < .35:
			destination = Vector2.INF
		else:
			direction = hero.direction_to(destination)
	var step := direction * minf(delta * 6.5, .28)
	for axis in [Vector2(step.x, 0), Vector2(0, step.y)]:
		if can_move(hero + axis, hero):
			hero += axis
	marker.position = Vector3(hero.x, height_at(hero) + .61, hero.y)
	if not overview:
		place_camera()
	stream_chunks()

func test_route() -> void:
	var waypoints := [Vector2(-10,19),Vector2(-10,11),Vector2(-6,4),Vector2(-7,-4),Vector2(-7,-14),Vector2(-7,-4),Vector2(11,-4),Vector2(11,5),Vector2(12,8)]
	for i in range(1, waypoints.size()):
		var start: Vector2 = waypoints[i-1]
		var finish: Vector2 = waypoints[i]
		var count := ceili(start.distance_to(finish) / .15)
		var previous := start
		for step in range(1,count+1):
			var current := start.lerp(finish, float(step)/count)
			if not can_move(current, previous):
				push_error("Przerwana trasa: " + str(current))
				get_tree().quit(1)
				return
			previous = current
	if not is_inf(height_at(Vector2(19,19))):
		get_tree().quit(1)
		return
	print("PASS: brama, targ, Plac Korony, kuźnie i zamknięta krawędź lawy")
	get_tree().quit()
