extends SceneTree
## Writes one content pack (PCK) from a list of {"pck": "res://...", "disk": "/abs/path"} entries.
## godot --headless --path ports/godot-pyra --script res://tools/pack_builder.gd -- list.json out.pck
## Used by scripts/godot/build_packs.py; not part of the shipped game (excluded from exports).

func _initialize() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		push_error("usage: -- list.json out.pck")
		quit(2)
		return
	var entries: Variant = JSON.parse_string(FileAccess.get_file_as_string(args[0]))
	if not entries is Array:
		push_error("bad list")
		quit(2)
		return
	var packer := PCKPacker.new()
	if packer.pck_start(args[1]) != OK:
		push_error("cannot start " + args[1])
		quit(1)
		return
	for entry: Dictionary in entries:
		if packer.add_file(str(entry.pck), str(entry.disk)) != OK:
			push_error("cannot add " + str(entry.pck))
			quit(1)
			return
	if packer.flush() != OK:
		quit(1)
		return
	quit(0)
