class_name PyraContinent
extends Node2D
## One Superior v2 land (continent or island), any of the ten. Terrain is one shader quad driven by the published
## biome/land grids and a road mask; scenery streams in per 2048-unit chunk; collision is the published walk mask
## (navigation + terrain + colliders). Everything is read from data/lands/<id> and assets/lands/<id>.

const CHUNK := 2048
const MASK_CELL := 16
const RECORD := 16

var land_id := ""
var cfg: Dictionary
var world_size := Vector2.ZERO
var textures: Array = []              # lazily loaded Texture2D per scenery sprite index
var objects_bin := PackedByteArray()
var walk := PackedByteArray()
var walk_w := 0
var walk_h := 0
var terrain := ColorRect.new()
var floor_layer := Node2D.new()
var below := Node2D.new()
var sorted := Node2D.new()
var overlay := Node2D.new()
var loaded: Dictionary = {}           # "cx,cy" -> Array of sprites
var view_pad := 360.0
var ready_ok := false

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

static func dummy_texture() -> Texture2D:
	var image := Image.create(4, 4, false, Image.FORMAT_RGBA8)
	image.fill(Color(0.5, 0.5, 0.5, 1.0))
	return ImageTexture.create_from_image(image)

func setup_land(id: String) -> void:
	if ready_ok:
		return
	land_id = id
	cfg = load_json("res://data/lands/%s/land.json" % id)
	world_size = Vector2(float(cfg.width), float(cfg.height))
	objects_bin = FileAccess.get_file_as_bytes("res://data/lands/%s/objects.bin" % id)
	textures.resize((cfg.textures as Array).size())
	walk = FileAccess.get_file_as_bytes("res://data/lands/%s/walk.bin" % id)
	walk_w = int(cfg.grid.nav[0])
	walk_h = int(cfg.grid.nav[1])
	build_terrain()
	add_child(terrain)
	add_child(floor_layer)
	add_child(below)
	sorted.y_sort_enabled = true
	add_child(sorted)
	add_child(overlay)
	ready_ok = true

func texture_at(index: int) -> Texture2D:
	if textures[index] == null:
		textures[index] = load(str(cfg.textures[index].path))
	return textures[index]

func build_road_atlas() -> Texture2D:
	# The road materials stacked in one texture (they tile in world space, as in the browser game).
	var count := int(cfg.roadCount)
	var rt: Array = cfg.roadTile
	var row_h := maxi(64, roundi(512.0 * float(rt[1]) / float(rt[0])))
	var atlas := Image.create(512, row_h * count, false, Image.FORMAT_RGBA8)
	for i in count:
		var image := (load(str(cfg.files["road%d" % i])) as Texture2D).get_image()
		if image.is_compressed():
			image.decompress()
		image.convert(Image.FORMAT_RGBA8)
		image.resize(512, row_h, Image.INTERPOLATE_LANCZOS)
		atlas.blit_rect(image, Rect2i(0, 0, 512, row_h), Vector2i(0, row_h * i))
	return ImageTexture.create_from_image(atlas)

func build_terrain() -> void:
	terrain.position = Vector2.ZERO
	terrain.size = world_size
	terrain.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var material := ShaderMaterial.new()
	material.shader = load("res://assets/continent/terrain.gdshader")
	var base := "res://assets/lands/%s/" % land_id
	material.set_shader_parameter("biome_ctrl", load(base + "ctrl-biome.png"))
	material.set_shader_parameter("land_ctrl", load(base + "ctrl-land.png"))
	material.set_shader_parameter("road_mask", load(base + "road-mask.png"))
	material.set_shader_parameter("road_class", load(base + "road-class.png"))
	material.set_shader_parameter("t_roads", build_road_atlas())
	material.set_shader_parameter("world_size", world_size)
	material.set_shader_parameter("tile", Vector2(float(cfg.tile[0]), float(cfg.tile[1])))
	material.set_shader_parameter("road_tile", Vector2(float(cfg.roadTile[0]), float(cfg.roadTile[1])))
	material.set_shader_parameter("road_rows", float(cfg.roadCount))
	var dummy := dummy_texture()
	for role in ["b0", "b1", "b2", "b3", "water", "shore", "special", "over1", "over2"]:
		var path: String = str(cfg.files.get(role, ""))
		material.set_shader_parameter("t_" + role, mipmapped(load(path)) if path != "" else dummy)
	var overlay_cfg: Dictionary = cfg.overlay
	material.set_shader_parameter("has_special", 1.0 if bool(cfg.hasSpecial) else 0.0)
	var shore: Array = overlay_cfg.get("shore", [1, 1, 1, 1])
	material.set_shader_parameter("shore_mask", Vector4(float(shore[0]), float(shore[1]), float(shore[2]), float(shore[3])))
	for key in ["over1", "over2"]:
		var o: Dictionary = overlay_cfg.get(key, {"mode": 0, "p": [1, 1, 1], "thr": 0, "mask": [0, 0, 0, 0], "alpha": 0})
		var p: Array = o.p
		var m: Array = o.mask
		material.set_shader_parameter(key + "_p", Vector4(float(p[0]), float(p[1]), float(p[2]), float(o.thr)))
		material.set_shader_parameter(key + "_mask", Vector4(float(m[0]), float(m[1]), float(m[2]), float(m[3])))
		material.set_shader_parameter(key + "_cfg", Vector2(float(o.mode), float(o.alpha)))
	var plazas := PackedVector4Array()
	for settlement: Dictionary in cfg.settlements:
		var b: Dictionary = settlement.bounds
		var inset := 220.0
		if str(settlement.kind) == "capital" and land_id == "pyra":
			continue   # the Pyra capital keeps the painted floor of the first trial
		plazas.append(Vector4(float(b.x) + inset, float(b.y) + inset, float(b.width) - 2.0 * inset, float(b.height) - 2.0 * inset))
	while plazas.size() < 4:
		plazas.append(Vector4(-1e6, -1e6, 1.0, 1.0))
	material.set_shader_parameter("plaza_rects", plazas)
	terrain.material = material

# ---- biome lookup (Planetary terrain adaptation) ------------------------------------------------

var biome_image: Image
var land_image: Image

## "forest", "rock", "water" or "open" at a world position, from the same 32-unit grid the ground is painted from.
func terrain_kind(at: Vector2) -> String:
	if biome_image == null:
		biome_image = (load("res://assets/lands/%s/ctrl-biome.png" % land_id) as Texture2D).get_image()
		land_image = (load("res://assets/lands/%s/ctrl-land.png" % land_id) as Texture2D).get_image()
	var x := clampi(int(at.x) / 32, 0, biome_image.get_width() - 1)
	var y := clampi(int(at.y) / 32, 0, biome_image.get_height() - 1)
	if land_image.get_pixel(x, y).r < 0.5:
		return "water"
	var c := biome_image.get_pixel(x, y)
	if c.g > 0.5:
		return "forest"
	if c.b > 0.5:
		return "rock"
	return "open"

# ---- collision ------------------------------------------------------------------------------

func walkable(at: Vector2) -> bool:
	if at.x < 20.0 or at.y < 20.0 or at.x > world_size.x - 20.0 or at.y > world_size.y - 20.0:
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

# ---- streaming ------------------------------------------------------------------------------

func chunk_key(cx: int, cy: int) -> String:
	return "%d,%d" % [cx, cy]

func update_view(shown: Rect2) -> void:
	var view := shown.grow(view_pad)
	var x0 := maxi(0, int(floor(view.position.x / CHUNK)))
	var x1 := mini(int(world_size.x / CHUNK), int(floor(view.end.x / CHUNK)))
	var y0 := maxi(0, int(floor(view.position.y / CHUNK)))
	var y1 := mini(int(world_size.y / CHUNK), int(floor(view.end.y / CHUNK)))
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
	var span: Array = cfg.chunks.get(key, [])
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
		var sprite := make_sprite(texture_at(index), at, Vector2(w, h), Vector2(0.5, anchor_y))
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
