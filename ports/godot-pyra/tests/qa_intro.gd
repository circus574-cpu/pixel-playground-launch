extends SceneTree
## Native run (xvfb + software GL): plays the entry film for a few seconds and saves screenshots of it (not part of the smoke test).
##   xvfb-run -a -s '-screen 0 1600x720x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra --rendering-method gl_compatibility --script res://tests/qa_intro.gd -- /tmp/intro-qa

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var out := "/tmp/intro-qa"
	for arg in OS.get_cmdline_user_args():
		out = arg
	DirAccess.make_dir_recursive_absolute(out)
	root.size = Vector2i(1600, 720)
	var boot: Control = load("res://scenes/boot.tscn").instantiate()
	boot.set("change_scene", false)
	root.add_child(boot)
	var stamps := [1.5, 4.0, 6.5, 9.0, 10.8]
	var started := Time.get_ticks_msec()
	var shot := 0
	while shot < stamps.size():
		await process_frame
		if (Time.get_ticks_msec() - started) / 1000.0 >= float(stamps[shot]):
			var image := root.get_texture().get_image()
			image.save_png("%s/intro-%d.png" % [out, shot])
			print("QA_INTRO shot ", shot, " intro_on=", boot.get("intro_on"), " over=", boot.get("intro_over"), " video_pos=", (boot.get("video") as VideoStreamPlayer).stream_position)
			shot += 1
	quit(0)
