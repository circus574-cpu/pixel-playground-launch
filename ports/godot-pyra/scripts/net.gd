class_name KiNet
extends Node
## The game's connection to the server (account, cloud saves, presence) and its downloadable content, one node for the whole run.
## It is created on first use (no autoload, so test scripts that replace the main loop work too): KiNet.online(), KiNet.content().
## CLIENT_CODE is the Android versionCode of this build; the server can refuse older ones (admin panel: minimum client).

const CLIENT_CODE := 9

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

static func hub() -> KiNet:
	if instance == null or not is_instance_valid(instance):
		instance = KiNet.new()
		(Engine.get_main_loop() as SceneTree).root.add_child(instance)
	return instance

static func online() -> PyraOnline:
	return hub().online_node

static func content() -> PyraContent:
	return hub().content_node
