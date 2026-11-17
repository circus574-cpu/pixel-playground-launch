extends SceneTree
## Every animation clip of one race in the real game scene, labelled, for a video (Godot movie writer): the 20 ordinary clips, the skills' own clips (`sk_*`), then the Ki form
## (its 18 clips). Scenery hidden, HUD hidden, no monsters.
## godot --path ports/godot-pyra --write-movie /tmp/all.avi --fixed-fps 30 --resolution 1280x720 --rendering-method gl_compatibility --script res://tests/qa_video_all.gd -- --race legend
var game: PyraGame
var race := "legend"
var label := Label.new()

func frames(n: int) -> void:
	for i in n:
		if i % 10 == 0:
			clear_scenery()
		await process_frame

func seconds(s: float) -> void:
	await frames(int(s * 30.0))

func clear_scenery() -> void:
	if game == null or not is_instance_valid(game.continent):
		return
	for node in game.continent.sorted.get_children():
		if node is Sprite2D and node.visible:
			node.visible = false

func _initialize() -> void:
	run.call_deferred()

func say(text: String) -> void:
	label.text = text

func play(actor: PyraActor, clip: String, facing: String, title: String, loops: bool = false) -> void:
	actor.direction = facing
	actor.one_shot_until = 0.0
	say(title)
	var duration: float = float(actor.play_once(clip))
	await seconds(maxf(1.0, duration * (2.0 if loops else 1.0) + 0.4))

func run() -> void:
	var args := OS.get_cmdline_user_args()
	for i in args.size():
		if args[i] == "--race" and i + 1 < args.size():
			race = args[i + 1]
	root.size = Vector2i(1280, 720)
	var landing: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(landing)
	await frames(5)
	landing.start_city()
	var deadline := Time.get_ticks_msec() + 20000
	while is_instance_valid(landing) and Time.get_ticks_msec() < deadline:
		await process_frame
	game = root.get_children().filter(func(n): return n is PyraGame)[0]
	game.skip_intro = true
	await frames(10)
	await game.start_new_character(race)
	await frames(10)
	game.hud.visible = false
	game.player.position = Vector2(float(game.land.width) * 0.5, float(game.land.height) * 0.5)
	game.monsters.clear_all()
	game.monsters.set_process(false)
	game.camera.zoom = Vector2.ONE * 1.5
	game.camera.reset_smoothing()
	var layer := CanvasLayer.new()
	layer.layer = 200
	root.add_child(layer)
	label.position = Vector2(24, 18)
	label.add_theme_font_size_override("font_size", 34)
	label.add_theme_color_override("font_color", Color("ffe9b0"))
	label.add_theme_color_override("font_outline_color", Color.BLACK)
	label.add_theme_constant_override("outline_size", 8)
	layer.add_child(label)
	await seconds(1.0)
	var actor: PyraActor = game.player.visual
	var names: Dictionary = {}
	for node: Dictionary in PyraContinent.load_json("res://data/races/%s.json" % race).nodes:
		names[str(node.id)] = str(node.name)
	var facings := ["down-right", "down", "right", "up-right", "up"]
	var normal := ["idle", "walk", "run", "attack", "attack2", "attack3", "skill", "skillb", "skillc", "finisher", "dodge", "guard", "hit", "hitheavy", "death", "respawn", "victory", "channel", "interact", "transform"]
	var loops := ["idle", "walk", "run", "guard", "channel"]
	say("Forma zwykła: 20 animacji")
	await seconds(1.5)
	for n in normal.size():
		if not actor.definition.clips.has(normal[n]):
			continue
		await play(actor, normal[n], facings[n % facings.size()], "%d/20  %s" % [n + 1, normal[n]], loops.has(normal[n]))
	say("Własne animacje umiejętności: 9")
	await seconds(1.5)
	var k := 0
	for id in ["A1", "A4", "A9", "B1", "B4", "B9", "C1", "C4", "C9"]:
		k += 1
		await play(actor, "sk_" + id, facings[k % facings.size()], "%d/9  %s: %s" % [k, id, str(names.get(id, ""))])
	say("Forma KI: 18 animacji")
	game.player.set_ki_form(true)
	await seconds(2.0)
	var ki := ["idle", "walk", "run", "attack", "attack2", "skill", "skillb", "skillc", "finisher", "dodge", "guard", "hit", "hitheavy", "death", "respawn", "victory", "channel", "transform"]
	for n in ki.size():
		if not actor.definition.clips.has("ki" + ki[n]):
			continue
		await play(actor, ki[n], facings[n % facings.size()], "%d/18  ki%s" % [n + 1, ki[n]], loops.has(ki[n]))
	actor.one_shot_until = 0.0
	say("")
	await seconds(1.0)
	quit(0)
