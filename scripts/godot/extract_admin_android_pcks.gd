extends SceneTree
## Usage: godot --headless --path PORT -s EXTRACTOR -- CORE.pck REGIONS.pck OUTPUT

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() != 3:
		printerr("Expected paths to core, world-regions and output directory.")
		quit(2)
		return
	for path: String in args.slice(0, 2):
		if not ProjectSettings.load_resource_pack(path):
			printerr("Cannot mount " + path)
			quit(1)
			return
	var out := args[2]
	var prefix := "res://service_preview/pyra"
	var files := {
		"data": ["bosses.json", "islands.json", "map.json", "quests.json"],
		"atlas": ["planet_real_world.png"],
	}
	if FileAccess.file_exists(prefix.path_join("data/quests_wilderness.json")):
		(files["data"] as Array).append("quests_wilderness.json")
	for land: String in ["pyra", "verdant", "aether", "nexus"]:
		files["regions/" + land] = ["buildings.json", "minimap_hq.png", "height.r32", "walkable.u8", "surface.png"]
	for directory: String in files:
		var target := out.path_join(directory.get_file())
		DirAccess.make_dir_recursive_absolute(target)
		for name: String in files[directory]:
			var source := prefix.path_join(directory).path_join(name)
			var bytes := FileAccess.get_file_as_bytes(source)
			if bytes.is_empty() and source.ends_with(".png"):
				var texture := ResourceLoader.load(source) as Texture2D
				if texture != null:
					bytes = texture.get_image().save_png_to_buffer()
			var file := FileAccess.open(target.path_join(name), FileAccess.WRITE)
			if bytes.is_empty() or file == null:
				printerr("Cannot extract " + source)
				quit(1)
				return
			file.store_buffer(bytes)
	quit()
