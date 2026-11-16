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
var terrain := ColorRect.new()          # sea-coloured backdrop; the ground itself is baked chunk textures
var ground := Node2D.new()
var ground_material: ShaderMaterial
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
	add_child(ground)
	add_child(floor_layer)
	add_child(below)
	sorted.y_sort_enabled = true
	add_child(sorted)
	add_child(overlay)
	ready_ok = true

func texture_at(index: int) -> Texture2D:
	if textures[index] == null:
		var path := str(cfg.textures[index].path)
		if requested.has(index):
			textures[index] = ResourceLoader.load_threaded_get(path)   # waits for the worker
			requested.erase(index)
		else:
			textures[index] = load(path)
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
	var sea := (load(str(cfg.files.water)) as Texture2D).get_image()
	if sea.is_compressed():
		sea.decompress()
	sea.resize(1, 1, Image.INTERPOLATE_BILINEAR)
	terrain.color = sea.get_pixel(0, 0)
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
	ground_material = material   # used by the ground bakers; the land is never shaded live

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

# ---- baked ground ---------------------------------------------------------------------------
# The ground shader is expensive (many texture reads per pixel) and its result never changes, so it is rendered once per
# 512-unit square into a texture (about one pixel per unit) and drawn as a plain sprite afterwards. Squares are baked
# a few per frame ahead of the camera and freed behind it; neighbours overlap by a few pixels, so there are no seams.

const GROUND := 512
const GROUND_MARGIN := 4
const GROUND_PAD := 320.0
const GROUND_BAKES_PER_FRAME := 1

var ground_bake: Dictionary = {}     # key -> {"viewport", "sprite", "age"}
var ground_queue: Array[String] = []

func ground_range(area: Rect2) -> Rect2i:
	var x0 := maxi(0, int(floor(area.position.x / GROUND)))
	var x1 := mini(int(world_size.x / GROUND), int(floor(area.end.x / GROUND)))
	var y0 := maxi(0, int(floor(area.position.y / GROUND)))
	var y1 := mini(int(world_size.y / GROUND), int(floor(area.end.y / GROUND)))
	return Rect2i(x0, y0, x1 - x0 + 1, y1 - y0 + 1)

func update_ground(shown: Rect2) -> void:
	var want := ground_range(shown.grow(GROUND_PAD))
	var keep := ground_range(shown.grow(GROUND_PAD + 384.0))
	for key: String in ground_bake.keys():
		var parts := key.split(",")
		if not keep.has_point(Vector2i(int(parts[0]), int(parts[1]))):
			var entry: Dictionary = ground_bake[key]
			(entry.sprite as Node).queue_free()
			(entry.viewport as Node).queue_free()
			ground_bake.erase(key)
	var fresh: Array[String] = []
	for cy in range(want.position.y, want.end.y):
		for cx in range(want.position.x, want.end.x):
			var key := "%d,%d" % [cx, cy]
			if not ground_bake.has(key) and not ground_queue.has(key):
				fresh.append(key)
	var centre := shown.get_center()
	fresh.sort_custom(func(a: String, b: String) -> bool: return ground_center(a).distance_squared_to(centre) < ground_center(b).distance_squared_to(centre))
	ground_queue.append_array(fresh)
	for i in range(ground_queue.size() - 1, -1, -1):
		var parts := ground_queue[i].split(",")
		if not keep.has_point(Vector2i(int(parts[0]), int(parts[1]))):
			ground_queue.remove_at(i)

func ground_center(key: String) -> Vector2:
	var parts := key.split(",")
	return Vector2((float(parts[0]) + 0.5) * GROUND, (float(parts[1]) + 0.5) * GROUND)

func bake_ground(key: String) -> void:
	var parts := key.split(",")
	var origin := Vector2(float(parts[0]) * GROUND - GROUND_MARGIN, float(parts[1]) * GROUND - GROUND_MARGIN)
	var span := GROUND + 2 * GROUND_MARGIN
	var viewport := SubViewport.new()
	viewport.size = Vector2i(span, span)
	viewport.disable_3d = true
	viewport.transparent_bg = false
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	viewport.canvas_item_default_texture_filter = Viewport.DEFAULT_CANVAS_ITEM_TEXTURE_FILTER_LINEAR
	var paint := ColorRect.new()
	paint.position = -origin
	paint.size = world_size
	paint.material = ground_material
	viewport.add_child(paint)
	add_child(viewport)
	var sprite := Sprite2D.new()
	sprite.centered = false
	sprite.texture = viewport.get_texture()
	sprite.position = origin
	sprite.visible = false     # shown once the texture has been rendered
	ground.add_child(sprite)
	ground_bake[key] = {"viewport": viewport, "sprite": sprite, "age": 0}

func step_ground(max_new: int) -> void:
	for key: String in ground_bake:
		var entry: Dictionary = ground_bake[key]
		if int(entry.age) < 3:
			entry.age = int(entry.age) + 1
			if int(entry.age) == 3:
				(entry.sprite as Sprite2D).visible = true
	var made := 0
	while made < max_new and not ground_queue.is_empty():
		bake_ground(ground_queue.pop_front())
		made += 1

func ground_ready() -> bool:
	if not ground_queue.is_empty():
		return false
	for key: String in ground_bake:
		if int((ground_bake[key] as Dictionary).age) < 3:
			return false
	return true

# ---- streaming ------------------------------------------------------------------------------
# Chunks are not built in one go: the nearest missing chunk is built in time-boxed slices (a few milliseconds per frame),
# its textures are requested on worker threads beforehand, and unloading is spread over frames too. The hero never waits
# for a chunk, and a texture is never decoded on the main thread while the game is running.

const BUILD_BUDGET_USEC := 2500
const FREE_PER_FRAME := 120
const KEEP_PAD := 900.0

var build_queue: Array[String] = []
var build_state: Dictionary = {}       # key -> next record index (a chunk that is being built)
var chunk_textures: Dictionary = {}    # key -> PackedInt32Array of the texture indices a chunk needs
var requested: Dictionary = {}         # texture index -> true while a threaded load is running
var free_queue: Array[Node] = []
var focus := Vector2.ZERO

func chunk_key(cx: int, cy: int) -> String:
	return "%d,%d" % [cx, cy]

func chunk_range(area: Rect2) -> Rect2i:
	var x0 := maxi(0, int(floor(area.position.x / CHUNK)))
	var x1 := mini(int(world_size.x / CHUNK), int(floor(area.end.x / CHUNK)))
	var y0 := maxi(0, int(floor(area.position.y / CHUNK)))
	var y1 := mini(int(world_size.y / CHUNK), int(floor(area.end.y / CHUNK)))
	return Rect2i(x0, y0, x1 - x0 + 1, y1 - y0 + 1)

## Called when the hero has moved: decides which chunks are wanted. `sync` builds them all at once (entering a land).
func update_view(shown: Rect2, sync: bool = false) -> void:
	focus = shown.get_center()
	update_ground(shown)
	var want := chunk_range(shown.grow(view_pad))
	var keep := chunk_range(shown.grow(view_pad + KEEP_PAD))
	for key: String in loaded.keys():
		var parts := key.split(",")
		if not keep.has_point(Vector2i(int(parts[0]), int(parts[1]))):
			unload_chunk(key)
	for i in range(build_queue.size() - 1, -1, -1):
		var parts := build_queue[i].split(",")
		if not keep.has_point(Vector2i(int(parts[0]), int(parts[1]))):
			build_queue.remove_at(i)
	var fresh: Array[String] = []
	for cy in range(want.position.y, want.end.y):
		for cx in range(want.position.x, want.end.x):
			var key := chunk_key(cx, cy)
			if not loaded.has(key) and not build_queue.has(key):
				fresh.append(key)
	fresh.sort_custom(func(a: String, b: String) -> bool: return chunk_center(a).distance_squared_to(focus) < chunk_center(b).distance_squared_to(focus))
	for key in fresh:
		build_queue.append(key)
		request_textures(key)
	if sync:
		flush()
		while not ground_queue.is_empty():
			bake_ground(ground_queue.pop_front())

func chunk_center(key: String) -> Vector2:
	var parts := key.split(",")
	return Vector2((float(parts[0]) + 0.5) * CHUNK, (float(parts[1]) + 0.5) * CHUNK)

func textures_of(key: String) -> PackedInt32Array:
	if chunk_textures.has(key):
		return chunk_textures[key]
	var seen := {}
	var list := PackedInt32Array()
	var span: Array = cfg.chunks.get(key, [])
	if not span.is_empty():
		for i in range(int(span[0]), int(span[0]) + int(span[1])):
			var index := objects_bin.decode_u16(i * RECORD)
			if not seen.has(index):
				seen[index] = true
				list.append(index)
	chunk_textures[key] = list
	return list

func request_textures(key: String) -> void:
	for index in textures_of(key):
		if textures[index] == null and not requested.has(index):
			requested[index] = true
			ResourceLoader.load_threaded_request(str(cfg.textures[index].path), "Texture2D")

func textures_ready(key: String) -> bool:
	for index in textures_of(key):
		if textures[index] != null:
			continue
		if not requested.has(index):
			request_textures(key)
			return false
		var path := str(cfg.textures[index].path)
		var status := ResourceLoader.load_threaded_get_status(path)
		if status == ResourceLoader.THREAD_LOAD_LOADED:
			textures[index] = ResourceLoader.load_threaded_get(path)
			requested.erase(index)
		elif status == ResourceLoader.THREAD_LOAD_FAILED or status == ResourceLoader.THREAD_LOAD_INVALID_RESOURCE:
			requested.erase(index)
			textures[index] = load(path)
		else:
			return false
	return true

func _process(_delta: float) -> void:
	if not is_visible_in_tree():
		return
	var freed := 0
	while not free_queue.is_empty() and freed < FREE_PER_FRAME:
		var node: Node = free_queue.pop_back()
		if is_instance_valid(node):
			node.queue_free()
		freed += 1
	step_ground(GROUND_BAKES_PER_FRAME)
	step_build(BUILD_BUDGET_USEC)

func step_build(budget_usec: int) -> void:
	var started := Time.get_ticks_usec()
	while Time.get_ticks_usec() - started < budget_usec:
		var key := ""
		for candidate in build_state.keys():
			key = candidate
			break
		if key == "":
			for candidate in build_queue:
				if textures_ready(candidate):
					key = candidate
					build_queue.erase(candidate)
					build_state[key] = 0
					loaded[key] = []
					break
		if key == "":
			return
		build_slice(key, started, budget_usec)

func build_slice(key: String, started: int, budget_usec: int) -> void:
	var holder: Array = loaded[key]
	var span: Array = cfg.chunks.get(key, [])
	var count := 0 if span.is_empty() else int(span[1])
	var done := int(build_state[key])
	while done < count and (Time.get_ticks_usec() - started < budget_usec or budget_usec < 0):
		var i := int(span[0]) + done
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
		done += 1
	if done >= count:
		build_state.erase(key)
	else:
		build_state[key] = done

## Builds everything that is queued, right now (entering a land, tests).
func flush() -> void:
	while not build_queue.is_empty() or not build_state.is_empty():
		var key := ""
		for candidate in build_state.keys():
			key = candidate
			break
		if key == "":
			key = build_queue.pop_front()
			build_state[key] = 0
			loaded[key] = []
		build_slice(key, 0, -1)

func unload_chunk(key: String) -> void:
	build_state.erase(key)
	for node: Node in loaded.get(key, []):
		if is_instance_valid(node):
			free_queue.append(node)
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
