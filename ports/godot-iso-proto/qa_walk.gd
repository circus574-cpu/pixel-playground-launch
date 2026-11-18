extends SceneTree
## Walks the hero through the prototype (movie) and checks the collisions: the river and the map edge stop the hero, the bridge lets it cross.
## godot --path ports/godot-iso-proto --write-movie /tmp/iso.avi --fixed-fps 30 --resolution 1280x720 --script res://qa_walk.gd
var main: Node2D
var failures := 0
func check(ok: bool, what: String) -> void:
	print(("ok   " if ok else "FAIL ") + what)
	if not ok: failures += 1
func frames(n: int) -> void:
	for i in n: await process_frame
func walk(dir: Vector2, seconds: float) -> void:
	main.scripted_motion = dir
	await frames(int(seconds * 30.0))
	main.scripted_motion = Vector2.ZERO
func _initialize() -> void:
	run.call_deferred()
func run() -> void:
	main = load("res://main.tscn").instantiate()
	root.add_child(main)
	await frames(10)
	main.use_script_motion = true
	var start: Vector2 = main.hero.position
	# 1. a tour of the market and the harbour
	for s in [[Vector2(1, 0), 1.6], [Vector2(0, -1), 1.4], [Vector2(-1, 0), 1.4], [Vector2(0, 1), 1.8], [Vector2(1, 1), 1.2], [Vector2(1, 0), 1.2]]:
		await walk(s[0], s[1])
	# 2. into the river: the hero must not cross it away from the bridge
	main.hero.position = main.screen_of(-12.0, -6.5, 0.4)
	await frames(2)
	await walk(Vector2(1, 0.3), 6.0)
	var edge: Vector2 = main.hero.position
	var in_water := false
	for poly: Array in main.scene.water:
		var pts := PackedVector2Array()
		for q: Array in poly: pts.append(Vector2(q[0], q[1]))
		if Geometry2D.is_point_in_polygon(edge, pts): in_water = true
	check(not in_water, "the river stops the hero (it is not in the water)")
	# 3. across the bridge: the gap between the two water pieces
	var gap: Array = main.scene.water
	var top_poly: Array = gap[1]
	var bridge_screen: Vector2 = main.screen_of(float(main.scene.placements.filter(func(p): return p.proto == "bridge")[0].x) - 10.0, 10.25, 0.4)
	main.hero.position = bridge_screen
	await frames(2)
	await walk(Vector2(1, 0), 2.5)
	var across: Vector2 = main.hero.position
	check(across.x > bridge_screen.x + 60.0, "the hero walks over the bridge (moved %.0f px)" % (across.x - bridge_screen.x))
	# 4. the map edge
	await walk(Vector2(1, 0), 8.0)
	var v: Array = main.scene.view
	check(main.hero.position.x < float(v[2]) and main.hero.position.y < float(v[3]) and main.hero.position.x > float(v[0]), "the map edge keeps the hero inside")
	await walk(Vector2(0, 0), 0.5)
	print("ISO PROTO QA failures ", failures)
	quit(1 if failures > 0 else 0)
