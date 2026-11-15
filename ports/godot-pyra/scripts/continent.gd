class_name PyraContinent
extends Node2D
## Whole Pyra continent (65600 x 42304 units, Superior v2 geometry).
## Terrain is one shader quad driven by the published biome/land grids; roads are textured strips;
## scenery streams in per 2048-unit chunk. Collision is the published walk mask (navigation + terrain + colliders).

const WORLD := Vector2(65600, 42304)
const CHUNK := 2048
const MASK_CELL := 16
const ROAD_TEXTURES := ["road1", "road2", "road3", "road4"]
const TERRAIN_TEXTURES := ["ash", "basalt", "lava-bank", "gravel", "water", "shore", "lava", "leaves", "ash-rock"]
const RECORD := 16

var meta: Dictionary
var world: Dictionary
var textures: Array[Texture2D] = []
var objects_bin := PackedByteArray()
var walk := PackedByteArray()
var walk_w := 0
var walk_h := 0
var terrain := ColorRect.new()
var floor_layer := Node2D.new()
var below := Node2D.new()
var sorted := Node2D.new()
var overlay := Node2D.new()
var chunks: Dictionary = {}   # "cx,cy" -> Array of nodes
var loaded: Dictionary = {}   # "cx,cy" -> Node2D parent for the chunk's sprites
var margin_chunks := 0
var view_pad := 360.0
var ready_ok := false

func _ready() -> void:
	setup()

static func load_json(path: String) -> Variant:
	return JSON.parse_string(FileAccess.get_file_as_string(path))

static func mipmapped(texture: Texture2D) -> Texture2D:
	var image := texture.get_image()
	if image == null or image.is_empty():
		return texture
	if image.is_compressed():
		image.decompress()
	image.generate_mipmaps()
	return ImageTexture.create_from_image(image)

func setup() -> void:
	if ready_ok:
		return
	meta = load_json("res://data/continent.terrain.json")
	world = load_json("res://data/continent/world.json")
	objects_bin = FileAccess.get_file_as_bytes("res://data/continent/objects.bin")
	for item: Dictionary in world.textures:
		textures.append(load(item.path))
	walk = FileAccess.get_file_as_bytes("res://data/continent/walk.bin")
	walk_w = int(meta.width)
	walk_h = int(meta.height)
	build_terrain()
	add_child(terrain)
	add_child(floor_layer)
	add_child(below)
	sorted.y_sort_enabled = true
	add_child(sorted)
	add_child(overlay)
	ready_ok = true

func build_terrain() -> void:
	terrain.position = Vector2.ZERO
	terrain.size = WORLD
	terrain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = load("res://assets/continent/terrain.gdshader")
	material.set_shader_parameter("biome_ctrl", load("res://assets/continent/ctrl-biome.png"))
	material.set_shader_parameter("land_ctrl", load("res://assets/continent/ctrl-land.png"))
	material.set_shader_parameter("world_size", WORLD)
	for key: String in TERRAIN_TEXTURES:
		material.set_shader_parameter("t_" + key.replace("-", "_"), mipmapped(load("res://assets/continent/terrain/%s.webp" % key)))
	material.set_shader_parameter("road_mask", load("res://assets/continent/road-mask.png"))
	material.set_shader_parameter("road_class", load("res://assets/continent/road-class.png"))
	material.set_shader_parameter("t_roads", build_road_atlas())
	var plazas := PackedVector4Array()
	for town: Dictionary in world.towns:
		var b: Dictionary = town.bounds
		plazas.append(Vector4(float(b.x) + 220.0, float(b.y) + 220.0, float(b.width) - 440.0, float(b.height) - 440.0))
	material.set_shader_parameter("plaza_rects", plazas)
	terrain.material = material

func build_road_atlas() -> Texture2D:
	# The four road materials stacked in one texture (they tile in world space, as in the browser game).
	var rows: Array[Image] = []
	for name: String in ROAD_TEXTURES:
		var image := (load("res://assets/continent/terrain/%s.webp" % name) as Texture2D).get_image()
		if image.is_compressed():
			image.decompress()
		image.convert(Image.FORMAT_RGBA8)
		image.resize(512, 122, Image.INTERPOLATE_LANCZOS)
		rows.append(image)
	var atlas := Image.create(512, 122 * rows.size(), false, Image.FORMAT_RGBA8)
	for i in rows.size():
		atlas.blit_rect(rows[i], Rect2i(0, 0, 512, 122), Vector2i(0, 122 * i))
	return ImageTexture.create_from_image(atlas)

# ---- collision ------------------------------------------------------------------------------

func walkable(at: Vector2) -> bool:
	if at.x < 20.0 or at.y < 20.0 or at.x > WORLD.x - 20.0 or at.y > WORLD.y - 20.0:
		return false
	var cx := int(at.x) / MASK_CELL
	var cy := int(at.y) / MASK_CELL
	if cx >= walk_w or cy >= walk_h:
		return false
	return walk[cy * walk_w + cx] > 127

func block_rect(rect: Rect2, grow: float = 12.0) -> void:
	var x0 := maxi(0, int((rect.position.x - grow) / MASK_CELL))
	var x1 := mini(walk_w - 1, int((rect.end.x + grow) / MASK_CELL))
	var y0 := maxi(0, int((rect.position.y - grow) / MASK_CELL))
	var y1 := mini(walk_h - 1, int((rect.end.y + grow) / MASK_CELL))
	for y in range(y0, y1 + 1):
		var row := y * walk_w
		for x in range(x0, x1 + 1):
			walk[row + x] = 0

func free_rect(rect: Rect2) -> void:
	var x0 := maxi(0, int(rect.position.x / MASK_CELL))
	var x1 := mini(walk_w - 1, int(rect.end.x / MASK_CELL))
	var y0 := maxi(0, int(rect.position.y / MASK_CELL))
	var y1 := mini(walk_h - 1, int(rect.end.y / MASK_CELL))
	for y in range(y0, y1 + 1):
		var row := y * walk_w
		for x in range(x0, x1 + 1):
			walk[row + x] = 255

# ---- streaming ------------------------------------------------------------------------------

func chunk_key(cx: int, cy: int) -> String:
	return "%d,%d" % [cx, cy]

func update_view(shown: Rect2) -> void:
	var view := shown.grow(view_pad)
	var x0 := maxi(0, int(floor(view.position.x / CHUNK)) - margin_chunks)
	var x1 := mini(int(WORLD.x / CHUNK), int(floor(view.end.x / CHUNK)) + margin_chunks)
	var y0 := maxi(0, int(floor(view.position.y / CHUNK)) - margin_chunks)
	var y1 := mini(int(WORLD.y / CHUNK), int(floor(view.end.y / CHUNK)) + margin_chunks)
	var wanted := {}
	for cy in range(y0, y1 + 1):
		for cx in range(x0, x1 + 1):
			wanted[chunk_key(cx, cy)] = Vector2i(cx, cy)
	for key: String in loaded.keys():
		if not wanted.has(key):
			unload_chunk(key)
	for key: String in wanted:
		if not loaded.has(key):
			load_chunk(key)

func load_chunk(key: String) -> void:
	var holder: Array = []
	loaded[key] = holder
	var span: Array = world.chunks.get(key, [])
	if span.is_empty():
		return
	var first := int(span[0])
	var count := int(span[1])
	for i in range(first, first + count):
		var base := i * RECORD
		var index := objects_bin.decode_u16(base)
		var w := float(objects_bin.decode_u16(base + 2))
		var h := float(objects_bin.decode_u16(base + 4))
		var under := objects_bin.decode_u8(base + 6) == 1
		var anchor_y := float(objects_bin.decode_u8(base + 7)) / 100.0
		var at := Vector2(objects_bin.decode_float(base + 8), objects_bin.decode_float(base + 12))
		var sprite := make_sprite(textures[index], at, Vector2(w, h), Vector2(0.5, anchor_y))
		if under:
			below.add_child(sprite)
		else:
			sorted.add_child(sprite)
		holder.append(sprite)

func unload_chunk(key: String) -> void:
	for node: Node in loaded[key]:
		if is_instance_valid(node):
			node.queue_free()
	loaded.erase(key)

static func make_sprite(texture: Texture2D, at: Vector2, box: Vector2, origin: Vector2) -> Sprite2D:
	var sprite := Sprite2D.new()
	sprite.texture = texture
	sprite.centered = false
	var size := texture.get_size()
	var fit := minf(box.x / size.x, box.y / size.y)
	sprite.scale = Vector2(fit, fit)
	sprite.offset = -origin * size
	sprite.position = at
	return sprite

func loaded_sprite_count() -> int:
	var total := 0
	for key: String in loaded:
		total += (loaded[key] as Array).size()
	return total
