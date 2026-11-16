extends SceneTree
## Visual check of the sign-in dialog (not part of the smoke suite):
## xvfb-run -a -s '-screen 0 1600x900x24' env LIBGL_ALWAYS_SOFTWARE=1 godot --audio-driver Dummy --path ports/godot-pyra \
##   --rendering-method gl_compatibility --script res://tests/qa_login.gd -- /tmp/pyra-login

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var out := "/tmp/pyra-login"
	for arg in OS.get_cmdline_user_args():
		out = arg
	DirAccess.make_dir_recursive_absolute(out)
	root.size = Vector2i(1280, 720)
	var gate := PyraGate.new()
	root.add_child(gate)
	for i in 5:
		await process_frame
	gate.login_form.call_deferred()
	for i in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(out + "/login.png")
	print("shot login")
	quit(0)
