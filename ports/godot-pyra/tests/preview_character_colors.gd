extends SceneTree
## All four races, existing runtime and clips; local candidates and isolated saves.
var pack_file := ""
var output := "/tmp/ki-character-colors"
var game: PyraGame
var checks: Array[Dictionary] = []
var label: Label

func _initialize() -> void:
	run.call_deferred()

func check(ok: bool, id: String) -> void:
	checks.append({"passed":ok,"id":id})
	if not ok: print("COLOR_FAIL ",id)

func settle(count := 4) -> void:
	for i in count: await process_frame

func capture(name: String) -> void:
	if DisplayServer.get_name() == "headless": return
	await settle()
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(output.path_join(name+".png"))

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--pack="): pack_file = arg.substr(7)
		if arg.begins_with("--out="): output = arg.substr(6)
	if pack_file.is_empty():
		quit(1)
		return
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(844,390)
	Engine.max_fps = 60
	var plan: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(pack_file))
	check(plan.kind == "character-color-preview","preview-provenance")
	check(FileAccess.get_sha256("res://data/actors.json") == str(plan.actorSourceSha256),"canonical-actor-sha")
	var bindings: Dictionary = {}
	for row: Dictionary in plan.sheets: bindings[str(row.source)] = row
	var title: PyraTitleScreen = load("res://scenes/title.tscn").instantiate()
	root.add_child(title)
	await settle(6)
	title.start_city()
	while is_instance_valid(title): await process_frame
	game = root.get_children().filter(func(n):return n is PyraGame)[0]
	game.skip_intro = true
	game.set_process(false)
	var overlay := CanvasLayer.new()
	overlay.layer = 120
	root.add_child(overlay)
	label = Label.new()
	label.position = Vector2(8,126)
	label.add_theme_font_size_override("font_size",13)
	overlay.add_child(label)
	for race: String in ["legend","planetary","sage","android"]:
		PyraActor.sheet_cache.clear()
		game.start_new_character(race)
		game.monsters.set_process(false)
		game.monsters.clear_all()
		if is_instance_valid(game.screen): game.close_screen()
		if game.hud.modal.visible: game.hud.close_dialog()
		for i in 50:
			game._process(0.0)
			await process_frame
		var actor := game.player.visual
		var before: Dictionary = actor.definition.duplicate(true)
		var position_before := game.player.position
		var nav_hash := hash(game.continent.walk)
		var speed := game.player.speed
		var sheets: Dictionary = {}
		for clip: String in before.clips:
			var data: Dictionary = before.clips[clip]
			actor.ensure_clip(clip)
			if data.has("sheet"): sheets[str(data.sheet)] = true
			for direction: String in data.directions:
				for frame in data.directions[direction]:
					if frame is Dictionary: sheets[str(frame.sheet)] = true
		var animation: String = actor.sprite.animation
		var frame_index: int = actor.sprite.frame
		var phase: float = actor.sprite.frame_progress
		actor.sprite.pause()
		label.text = "SOURCE / "+race
		await capture(race+"-before")
		for source: String in sheets:
			check(bindings.has(source),race+"-binding-"+source)
			if not bindings.has(source): continue
			var row: Dictionary = bindings[source]
			var external := pack_file.get_base_dir().path_join(str(row.file))
			check(FileAccess.get_sha256(source) == str(row.sourceSha256),race+"-source-sha-"+source)
			check(FileAccess.get_sha256(external) == str(row.sha256),race+"-candidate-sha-"+source)
			var image := Image.load_from_file(external)
			check(image != null and image.get_size() == Vector2i(int(row["size"][0]),int(row["size"][1])),race+"-native-size-"+source)
			if image == null: continue
			PyraActor.sheet_cache[source] = ImageTexture.create_from_image(image)
		actor.frames = SpriteFrames.new()
		actor.frames.remove_animation("default")
		actor.built.clear()
		actor.sprite.sprite_frames = actor.frames
		for clip: String in before.clips:
			actor.ensure_clip(clip)
			var spec: Dictionary = before.clips[clip]
			for direction: String in spec.directions:
				var name := clip+":"+direction
				check(actor.frames.get_frame_count(name) == spec.directions[direction].size(),race+"-count-"+name)
				check(actor.frames.get_animation_speed(name) == float(spec.fps),race+"-fps-"+name)
				check(actor.frames.get_animation_loop(name) == bool(spec.loop),race+"-loop-"+name)
		actor.sprite.play(animation)
		actor.sprite.set_frame_and_progress(frame_index,phase)
		actor.sprite.pause()
		label.text = "CPU COLOR CANDIDATE / "+race
		await capture(race+"-after")
		check(game.player.position == position_before and game.player.speed == speed and hash(game.continent.walk) == nav_hash,race+"-gameplay-unchanged")
		check(actor.definition == before and game.player.actor_data == before,race+"-definitions-unchanged")
		check(actor.sprite.modulate == Color.WHITE and game.day_tint.color == Color.WHITE,race+"-no-fading-tint-in-day")
		var travel := Vector2.RIGHT
		for turn in 8:
			var candidate := Vector2.RIGHT.rotated(turn*PI/4.0)
			var clear := true
			for step in range(1,21):
				if not game.can_stand(game.player.position+candidate*game.player.speed*.75*step/20.0,""): clear = false
			if clear:
				travel = candidate
				break
		var start := game.player.position
		game.player.locked = false
		game.player.touch_motion = travel*.6
		for i in 24:
			game._process(1.0/32)
			await create_timer(1.0/32).timeout
			if DisplayServer.get_name() != "headless":
				await RenderingServer.frame_post_draw
				root.get_texture().get_image().save_png(output.path_join(race+"-walk-%03d.png"%i))
		check((game.player.position-start).dot(travel)>0,race+"-real-walk")
		check(str(actor.sprite.animation).begins_with("walk:"),race+"-walk-animation")
		game.player.touch_motion = Vector2.ZERO
		actor.play_once("attack")
		await settle(4)
		check(str(actor.sprite.animation).begins_with("attack:"),race+"-attack-animation")
		await capture(race+"-attack")
	var failed := checks.filter(func(c):return not c.passed).size()
	var report := {"kind":"character-color-preview","display":DisplayServer.get_name(),"checks":checks.size(),"passed":checks.size()-failed,"failed":failed,"results":checks,"scope":"Actual four-race runtime, all existing clips and directions, isolated save. No new animation or physical phone verification."}
	var file := FileAccess.open(output.path_join("result.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"))
	file.close()
	print("COLOR_RUNTIME ",checks.size()-failed,"/",checks.size())
	finish.call_deferred(1 if failed else 0)

func finish(code: int) -> void:
	root.remove_child(game)
	game.queue_free()
	await settle(4)
	PyraActor.sheet_cache.clear()
	await settle(2)
	quit(code)
