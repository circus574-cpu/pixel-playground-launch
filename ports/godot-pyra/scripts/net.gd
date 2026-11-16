class_name KiNet
extends Node
## The game's connection to the server (account, cloud saves, presence) and its downloadable content, one node for the whole run.
## It is created on first use (no autoload, so test scripts that replace the main loop work too): KiNet.online(), KiNet.content().
## CLIENT_CODE is the Android versionCode of this build; the server can refuse older ones (admin panel: minimum client).

const CLIENT_CODE := 12

static var instance: KiNet

var online_node: PyraOnline
var content_node: PyraContent

func _init() -> void:
	name = "KiNet"
	online_node = PyraOnline.new()
	add_child(online_node)
	content_node = PyraContent.new()
	content_node.online = online_node
	add_child(content_node)

func _ready() -> void:
	content_node.load_cached_manifest()

## The downloaded core (scripts and data, see scripts/boot.gd) has started the game: remember that it works.
static func core_ok() -> void:
	if not FileAccess.file_exists("user://core.json"):
		return
	var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://core.json"))
	if value is Dictionary and str(value.get("file", "")) != "" and str(value.get("good", "")) != str(value.file):
		value["good"] = value.file
		value["attempts"] = 0
		var file := FileAccess.open("user://core.json", FileAccess.WRITE)
		if file != null:
			file.store_string(JSON.stringify(value))
			file.close()

static func hub() -> KiNet:
	if instance == null or not is_instance_valid(instance):
		instance = KiNet.new()
		(Engine.get_main_loop() as SceneTree).root.add_child(instance)
	return instance

static func online() -> PyraOnline:
	return hub().online_node

static func content() -> PyraContent:
	return hub().content_node
