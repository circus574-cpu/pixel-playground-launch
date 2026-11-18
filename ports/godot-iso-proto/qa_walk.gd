extends SceneTree
## Walks the hero through the prototype and checks the collisions in LOGICAL game units: the river and the zone edge stop the hero, the bridge lets it cross,
## and the city zone is 4000 x 2500 units. godot --path ports/godot-iso-proto --write-movie /tmp/iso.avi --fixed-fps 30 --resolution 1280x720 --script res://qa_walk.gd
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
func in_water(l: Vector2) -> bool:
	var w: Vector2 = main.to_world(l)
	for poly: Array in main.scene.water_world:
		var pts := PackedVector2Array()
		for q: Array in poly: pts.append(Vector2(q[0], q[1]))
		if Geometry2D.is_point_in_polygon(w, pts): return true
	return false
func _initialize() -> void:
	run.call_deferred()
func run() -> void:
	main = load("res://main.tscn").instantiate()
	root.add_child(main)
	await frames(10)
	main.use_script_motion = true
	check(is_equal_approx(main.unit * float(main.scene.world[0]), 4000.0), "the city zone is 4000 units wide (unit %.2f per metre)" % main.unit)
	check(absf(float(main.scene.world[1]) * main.unit - 2500.0) < 1.0, "and 2500 units high")
	for s in [[Vector2(1, 0), 1.6], [Vector2(0, -1), 1.4], [Vector2(-1, 0), 1.4], [Vector2(0, 1), 1.8], [Vector2(1, 1), 1.2], [Vector2(1, 0), 1.2]]:
		await walk(s[0], s[1])
	main.hero.position = main.to_logical(-12.0, -6.5)
	await frames(2)
	await walk(Vector2(1, 1), 14.0)       # screen down-right = logical east: towards the river and past it, if nothing stopped the hero
	check(not in_water(main.hero.position), "the river stops the hero (it is not in the water)")
	var br: Dictionary = main.scene.placements.filter(func(p): return p.proto == "bridge")[0]
	var start: Vector2 = main.to_logical(float(br.x) - 10.0, float(br.y))
	main.hero.position = start
	await frames(2)
	await walk(Vector2(1, 1), 5.0)        # logical +x (east) over the bridge
	check(main.hero.position.x > start.x + 400.0, "the hero walks over the bridge (moved %.0f units)" % (main.hero.position.x - start.x))
	await walk(Vector2(1, 1), 40.0)
	check(absf(main.hero.position.x) < 2000.0 and absf(main.hero.position.y) < 1250.0, "the zone edge keeps the hero inside 4000 x 2500")
	await walk(Vector2(0, 0), 0.5)
	print("ISO PROTO QA failures ", failures)
	quit(1 if failures > 0 else 0)
