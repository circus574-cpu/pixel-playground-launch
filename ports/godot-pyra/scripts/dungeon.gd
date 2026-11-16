class_name PyraDungeon
extends RefCounted
## A cave dungeon. The Superior world reserves 22 cave entrances ("entrance reserved; interior integration pending") and ships the
## dungeon-kit art, but no interior; this builds one per entrance, always the same for the same entrance (seeded by its id):
## a labyrinth of corridors and rooms, a key at the far end of the open part, a gate on the only way to the vault, chests
## (gold and potions, the rule of `dungeonProgress.ts`: keys, gates and chests are claimed once and saved), guards drawn from the
## monsters of the land (stronger deeper in, elite guards at the vault) and spike traps. Presentation uses the 12 dungeon-kit props.

const CELL := 160.0
const COLS := 23
const ROWS := 17
const REACH := 96.0
const BODY := 13.0
const DIRS: Array[Vector2i] = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const TINT := {
	"pyra": {"floor": Color(0.78, 0.60, 0.52), "glow": Color(1.0, 0.5, 0.2), "dark": Color(0.52, 0.44, 0.48)},
	"verdant": {"floor": Color(0.60, 0.74, 0.54), "glow": Color(0.7, 1.0, 0.5), "dark": Color(0.44, 0.54, 0.50)},
	"aether": {"floor": Color(0.82, 0.84, 0.98), "glow": Color(0.7, 0.85, 1.0), "dark": Color(0.50, 0.54, 0.70)},
	"nexus": {"floor": Color(0.52, 0.64, 0.78), "glow": Color(0.4, 0.9, 1.0), "dark": Color(0.40, 0.50, 0.66)},
}

var info: Dictionary = {}
var land_id := ""
var theme := "pyra"
var kinds: Array = []                       # monster ids of the land, weakest first
var state: Dictionary = {}                  # {"keys": [], "gates": [], "chests": []} (saved)
var rng := RandomNumberGenerator.new()
var grid := PackedByteArray()
var rooms: Array[Rect2i] = []
var start_room := Rect2i()
var vault_room := Rect2i()
var gate_cell := Vector2i(-1, -1)
var key_cell := Vector2i(-1, -1)
var chests: Array[Dictionary] = []
var guards: Array[Dictionary] = []
var traps: Array[Vector2] = []
var props: Array[Dictionary] = []
var dist: Dictionary = {}
var root: Node2D
var sorted: Node2D
var gate_node: Node2D
var key_node: Node2D
var chest_nodes: Dictionary = {}
var light: PointLight2D
var floor_texture: Texture2D
var art: Dictionary = {}

func setup(entrance: Dictionary, land: String, world: String, land_kinds: Array, progress: Dictionary) -> void:
	info = entrance
	land_id = land
	theme = world if TINT.has(world) else "pyra"
	kinds = land_kinds
	state = progress
	for key in ["keys", "gates", "chests"]:
		if not state.has(key):
			state[key] = []
	rng.seed = hash(str(entrance.id))
	generate()

func bounds() -> Rect2:
	return Rect2(0, 0, COLS * CELL, ROWS * CELL)

func center(c: Vector2i) -> Vector2:
	return Vector2((c.x + 0.5) * CELL, (c.y + 0.5) * CELL)

func cell_of(p: Vector2) -> Vector2i:
	return Vector2i(int(floor(p.x / CELL)), int(floor(p.y / CELL)))

func is_floor(c: Vector2i) -> bool:
	if c.x < 0 or c.y < 0 or c.x >= COLS or c.y >= ROWS:
		return false
	return grid[c.y * COLS + c.x] == 1

func set_floor(c: Vector2i) -> void:
	if c.x > 0 and c.y > 0 and c.x < COLS - 1 and c.y < ROWS - 1:
		grid[c.y * COLS + c.x] = 1

func gate_closed() -> bool:
	return gate_cell.x >= 0 and not (state.gates as Array).has("gate-1")

func open_cell(c: Vector2i) -> bool:
	return is_floor(c) and not (c == gate_cell and gate_closed())

## Can the hero (or a monster) stand here: the body must fit inside open cells.
func walkable(p: Vector2) -> bool:
	for offset in [Vector2(BODY, 0), Vector2(-BODY, 0), Vector2(0, BODY), Vector2(0, -BODY), Vector2.ZERO]:
		if not open_cell(cell_of(p + offset)):
			return false
	return true

func neighbours(c: Vector2i) -> int:
	var n := 0
	for d: Vector2i in DIRS:
		n += 1 if is_floor(c + d) else 0
	return n

func in_room(c: Vector2i) -> bool:
	for r: Rect2i in rooms:
		if r.has_point(c):
			return true
	return start_room.has_point(c)

func bfs(from: Vector2i, blocked: Vector2i = Vector2i(-1, -1)) -> Dictionary:
	var seen := {from: 0}
	var queue: Array[Vector2i] = [from]
	var head := 0
	while head < queue.size():
		var c := queue[head]
		head += 1
		for d: Vector2i in DIRS:
			var n := c + d
			if n != blocked and is_floor(n) and not seen.has(n):
				seen[n] = int(seen[c]) + 1
				queue.append(n)
	return seen

func generate() -> void:
	grid.resize(COLS * ROWS)
	grid.fill(0)
	var begin := Vector2i(1, ROWS - 2)
	set_floor(begin)
	var stack: Array[Vector2i] = [begin]
	while not stack.is_empty():
		var c: Vector2i = stack.back()
		var options: Array[Vector2i] = []
		for d: Vector2i in DIRS:
			var n := c + d * 2
			if n.x > 0 and n.y > 0 and n.x < COLS - 1 and n.y < ROWS - 1 and not is_floor(n):
				options.append(d)
		if options.is_empty():
			stack.pop_back()
		else:
			var pick: Vector2i = options[rng.randi() % options.size()]
			set_floor(c + pick)
			set_floor(c + pick * 2)
			stack.append(c + pick * 2)
	start_room = Rect2i(1, ROWS - 4, 3, 3)
	carve(start_room)
	for attempt in 30:
		if rooms.size() >= 6:
			break
		var w := 5 if rng.randf() < 0.45 else 3
		var h := 3
		var x := 1 + 2 * (rng.randi() % int((COLS - 1 - w) / 2))
		var y := 1 + 2 * (rng.randi() % int((ROWS - 1 - h) / 2))
		var rect := Rect2i(x, y, w, h)
		var clash := rect.grow(1).intersects(start_room)
		for other in rooms:
			clash = clash or rect.grow(1).intersects(other)
		if not clash:
			rooms.append(rect)
			carve(rect)
	dist = bfs(begin)
	# the vault: the room (or end of a corridor) farthest from the entrance
	var vault_center := begin
	var best := -1
	for r: Rect2i in rooms:
		var c := r.position + Vector2i(r.size.x / 2, r.size.y / 2)
		if int(dist.get(c, 0)) > best:
			best = int(dist.get(c, 0))
			vault_center = c
			vault_room = r
	if best < 0:
		for c: Vector2i in dist:
			if int(dist[c]) > best:
				best = int(dist[c])
				vault_center = c
		vault_room = Rect2i(vault_center, Vector2i(1, 1))
	pick_gate(begin, vault_center)
	var reachable := bfs(begin, gate_cell) if gate_cell.x >= 0 else dist
	pick_key(reachable)
	pick_chests(reachable, vault_center)
	pick_guards(vault_center)
	pick_traps(reachable)
	pick_props(vault_center)

func carve(rect: Rect2i) -> void:
	for y in range(rect.position.y, rect.end.y):
		for x in range(rect.position.x, rect.end.x):
			set_floor(Vector2i(x, y))

## The vault is made a dead end: every way into its room but one is walled up, and the gate stands on the one left. (Rooms laid
## over the maze make loops, so a gate in a plain corridor would usually be walked around.)
func pick_gate(begin: Vector2i, vault_center: Vector2i) -> void:
	var path: Array[Vector2i] = [vault_center]
	var cursor := vault_center
	while cursor != begin:
		var next := cursor
		for d: Vector2i in DIRS:
			var n := cursor + d
			if dist.has(n) and int(dist[n]) < int(dist[next]):
				next = n
		if next == cursor:
			break
		cursor = next
		path.append(cursor)
	path.reverse()
	var entry := Vector2i(-1, -1)
	for i in range(1, path.size()):
		if vault_room.has_point(path[i]):
			entry = path[i - 1]
			break
	if entry.x < 0 or vault_room.has_point(entry) or start_room.has_point(entry):
		return
	var v0 := vault_room.position
	var v1 := vault_room.end
	for x in range(v0.x - 1, v1.x + 1):
		for y in range(v0.y - 1, v1.y + 1):
			var c := Vector2i(x, y)
			var beside := (x >= v0.x and x < v1.x) or (y >= v0.y and y < v1.y)
			if beside and not vault_room.has_point(c) and c != entry and is_floor(c):
				grid[y * COLS + x] = 0
	dist = bfs(begin)
	for y in ROWS:
		for x in COLS:
			if grid[y * COLS + x] == 1 and not dist.has(Vector2i(x, y)):
				grid[y * COLS + x] = 0
	gate_cell = entry

func pick_key(reachable: Dictionary) -> void:
	var from_gate := bfs(gate_cell, Vector2i(-2, -2)) if gate_cell.x >= 0 else {}
	var best := -1
	for c: Vector2i in reachable:
		if gate_cell.x >= 0 and int(from_gate.get(c, 99)) < 6:
			continue
		var score := int(reachable[c]) + (6 if neighbours(c) == 1 else 0)
		if score > best and not vault_room.has_point(c) and not start_room.has_point(c):
			best = score
			key_cell = c

func pick_chests(reachable: Dictionary, vault_center: Vector2i) -> void:
	chests.clear()
	var open_rooms: Array[Rect2i] = []
	for r: Rect2i in rooms:
		var c := r.position + Vector2i(r.size.x / 2, r.size.y / 2)
		if reachable.has(c) and r != vault_room:
			open_rooms.append(r)
	open_rooms.sort_custom(func(a: Rect2i, b: Rect2i) -> bool: return int(reachable.get(a.position, 0)) > int(reachable.get(b.position, 0)))
	var tier := reward_tier()
	for i in mini(2, open_rooms.size()):
		var r := open_rooms[i]
		chests.append({"id": "chest-%d" % (i + 1), "cell": r.position + Vector2i(r.size.x / 2, r.size.y / 2), "gold": int(round((30 + 18 * tier) * (1.0 + 0.4 * i))), "potions": 1 + i, "vault": false})
	chests.append({"id": "chest-vault", "cell": vault_center, "gold": 120 + 60 * tier, "potions": 3, "vault": true})

func reward_tier() -> int:
	return clampi(int(info.get("tier", 0)), 0, 8)

func pick_guards(vault_center: Vector2i) -> void:
	guards.clear()
	if kinds.is_empty():
		return
	var far := 1
	for c: Vector2i in dist:
		far = maxi(far, int(dist[c]))
	var spots: Array[Dictionary] = []
	for r: Rect2i in rooms:
		var c := r.position + Vector2i(r.size.x / 2, r.size.y / 2)
		if r == vault_room or not dist.has(c):
			continue
		var count := 2 + (rng.randi() % 2)
		for i in count:
			spots.append({"cell": Vector2i(r.position.x + rng.randi() % r.size.x, r.position.y + rng.randi() % r.size.y), "kind_at": float(dist.get(c, 0)) / far})
	for c: Vector2i in dist:
		if neighbours(c) == 1 and int(dist[c]) > 8 and not vault_room.has_point(c) and c != key_cell and spots.size() < 20:
			spots.append({"cell": c, "kind_at": float(dist[c]) / far})
	for s: Dictionary in spots:
		var index := clampi(int(round(float(s.kind_at) * (kinds.size() - 1))), 0, kinds.size() - 1)
		guards.append({"cell": s.cell, "kind": str(kinds[index]), "elite": false})
	for i in 2:
		guards.append({"cell": vault_center + Vector2i(i * 2 - 1, 1 if vault_room.size.y > 1 else 0), "kind": str(kinds[kinds.size() - 1]), "elite": true})

func pick_traps(reachable: Dictionary) -> void:
	traps.clear()
	var cells: Array = []
	for c: Vector2i in reachable:
		if neighbours(c) == 2 and not in_room(c) and int(reachable[c]) > 6 and c != gate_cell:
			cells.append(c)
	for i in mini(6, cells.size()):
		var pick := rng.randi() % cells.size()
		traps.append(center(cells[pick]))
		cells.remove_at(pick)

func pick_props(vault_center: Vector2i) -> void:
	props.clear()
	var floors: Array[Vector2i] = []
	for c: Vector2i in dist:
		floors.append(c)
	var counter := 0
	for c in floors:
		var wall_side := Vector2i.ZERO
		for d: Vector2i in DIRS:
			if not is_floor(c + d):
				wall_side = d
		if wall_side != Vector2i.ZERO:
			counter += 1
			if counter % 7 == 0:
				props.append({"art": "torch-on-a-stand", "pos": center(c) + Vector2(wall_side) * CELL * 0.38, "scale": 0.30, "glow": true})
			elif counter % 17 == 0:
				props.append({"art": "stalagmite-cluster", "pos": center(c) + Vector2(wall_side) * CELL * 0.3, "scale": 0.22})
			elif counter % 23 == 0:
				props.append({"art": "bone-pile", "pos": center(c) + Vector2(wall_side) * CELL * 0.25, "scale": 0.17})
	var decor := ["glowing-crystal-cluster", "cracked-stone-pillar", "an-iron-prison-cage", "bone-pile"]
	if theme == "pyra":
		decor.append("rock-with-glowing-lava-cracks")
	var i := 0
	for r: Rect2i in rooms:
		if r == vault_room or not dist.has(r.position):
			continue
		var art_name: String = decor[i % decor.size()]
		props.append({"art": art_name, "pos": center(r.position) + Vector2(-CELL * 0.1, CELL * 0.2), "scale": 0.30, "glow": art_name == "glowing-crystal-cluster"})
		i += 1
	props.append({"art": "stone-sarcophagus", "pos": center(vault_center) + Vector2(-CELL * 1.1, -CELL * 0.1), "scale": 0.33})
	props.append({"art": "glowing-crystal-cluster", "pos": center(vault_center) + Vector2(CELL * 1.2, -CELL * 0.1), "scale": 0.30, "glow": true})

# ---- interaction ------------------------------------------------------------------------------

func arrival() -> Vector2:
	return center(start_room.position + Vector2i(1, 1))

func exit_point() -> Vector2:
	return center(start_room.position + Vector2i(0, 2)) + Vector2(-40, 36)

func targets() -> Array[Dictionary]:
	var list: Array[Dictionary] = [{"kind": "exit", "id": "exit", "name": "Wyjście z jaskini", "point": exit_point()}]
	if key_cell.x >= 0 and not (state.keys as Array).has("key-1"):
		list.append({"kind": "dkey", "id": "key-1", "name": "Stary klucz", "title": "Podnieś klucz", "point": center(key_cell)})
	if gate_cell.x >= 0 and (state.gates as Array).has("gate-1") == false:
		list.append({"kind": "dgate", "id": "gate-1", "name": "Zamknięta krata", "title": "Otwórz kratę", "point": center(gate_cell)})
	for c: Dictionary in chests:
		if not (state.chests as Array).has(c.id):
			list.append({"kind": "dchest", "id": c.id, "name": "Skrzynia", "title": "Otwórz skrzynię", "point": center(c.cell) + Vector2(0, 30)})
	return list

func near(point: Vector2, target: Vector2) -> bool:
	return point.is_finite() and point.distance_to(target) <= REACH

func pick_up_key(at: Vector2) -> bool:
	if key_cell.x < 0 or (state.keys as Array).has("key-1") or not near(at, center(key_cell)):
		return false
	(state.keys as Array).append("key-1")
	if is_instance_valid(key_node):
		key_node.queue_free()
	return true

func open_gate(at: Vector2) -> bool:
	if gate_cell.x < 0 or (state.gates as Array).has("gate-1") or not (state.keys as Array).has("key-1") or not near(at, center(gate_cell)):
		return false
	(state.gates as Array).append("gate-1")
	if is_instance_valid(gate_node):
		gate_node.queue_free()
	return true

## Claims a chest once and returns its reward, or an empty dictionary.
func claim(id: String, at: Vector2) -> Dictionary:
	for c: Dictionary in chests:
		if c.id == id and not (state.chests as Array).has(id) and near(at, center(c.cell) + Vector2(0, 30)):
			(state.chests as Array).append(id)
			if chest_nodes.has(id) and is_instance_valid(chest_nodes[id]):
				(chest_nodes[id] as Node2D).modulate = Color(0.45, 0.45, 0.5)
			return {"gold": c.gold, "potions": c.potions}
	return {}

# ---- presentation -------------------------------------------------------------------------------

func texture(name: String) -> Texture2D:
	if not art.has(name):
		var path := "res://assets/dungeon/%s.webp" % name
		art[name] = load(path) if ResourceLoader.exists(path) else null
	return art[name]

func make_floor_texture() -> Texture2D:
	var noise := FastNoiseLite.new()
	noise.noise_type = FastNoiseLite.TYPE_CELLULAR
	noise.frequency = 0.045
	noise.seed = 7
	noise.cellular_return_type = FastNoiseLite.RETURN_DISTANCE2_SUB
	var fine := FastNoiseLite.new()
	fine.frequency = 0.18
	fine.seed = 11
	var size := 192
	var cobbles := noise.get_seamless_image(size, size)
	var grain := fine.get_seamless_image(size, size)
	var base: Color = TINT[theme].floor
	var image := Image.create(size, size, false, Image.FORMAT_RGBA8)
	for y in size:
		for x in size:
			var edge := clampf(cobbles.get_pixel(x, y).r * 3.2, 0.0, 1.0)
			var shade := 0.55 + 0.45 * edge
			var speck := 0.9 + 0.2 * grain.get_pixel(x, y).r
			image.set_pixel(x, y, Color(base.r * shade * speck, base.g * shade * speck, base.b * shade * speck, 1.0))
	return ImageTexture.create_from_image(image)

func build(parent_root: Node2D, parent_sorted: Node2D, player: Node2D) -> void:
	root = parent_root
	sorted = parent_sorted
	floor_texture = make_floor_texture()
	var layer := FloorLayer.new()
	layer.dungeon = self
	layer.z_index = -2000
	root.add_child(layer)
	# walls: a chunk of cave rock on every wall cell that touches a floor cell (the rest is the dark background)
	for y in ROWS:
		for x in COLS:
			var c := Vector2i(x, y)
			if is_floor(c):
				continue
			var touches := false
			for dx in range(-1, 2):
				for dy in range(-1, 2):
					touches = touches or is_floor(c + Vector2i(dx, dy))
			if not touches:
				continue
			var sprite := Sprite2D.new()
			sprite.texture = texture("cave-wall-chunk")
			sprite.centered = true
			sprite.scale = Vector2.ONE * (CELL * 1.45 / 524.0)
			sprite.flip_h = (x * 7 + y * 3) % 2 == 0
			var variation := 0.72 + 0.16 * float((x * 13 + y * 29) % 5) / 4.0
			sprite.modulate = Color(variation, variation * 0.96, variation * 1.02)
			sprite.position.x += float((x * 31 + y * 17) % 9 - 4) * 3.0
			sprite.position = Vector2((x + 0.5) * CELL, (y + 1.0) * CELL - 40.0)
			sorted.add_child(sprite)
	for p: Dictionary in props:
		var sprite := Sprite2D.new()
		sprite.texture = texture(str(p.art))
		if sprite.texture == null:
			continue
		sprite.scale = Vector2.ONE * float(p.scale)
		sprite.offset = Vector2(0, -sprite.texture.get_height() * 0.5)
		sprite.position = p.pos
		sorted.add_child(sprite)
		if p.get("glow", false):
			var glow := Sprite2D.new()
			glow.texture = glow_texture()
			glow.modulate = Color(TINT[theme].glow.r, TINT[theme].glow.g, TINT[theme].glow.b, 0.55)
			glow.scale = Vector2.ONE * 1.1
			glow.position = Vector2(0, -sprite.texture.get_height() * float(p.scale) * 0.6)
			var mat := CanvasItemMaterial.new()
			mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
			glow.material = mat
			sprite.add_child(glow)
	var door := Sprite2D.new()
	door.texture = texture("stone-doorway")
	door.scale = Vector2.ONE * 0.36
	door.offset = Vector2(0, -door.texture.get_height() * 0.5)
	door.position = exit_point() + Vector2(30, 60)
	sorted.add_child(door)
	if gate_cell.x >= 0 and not (state.gates as Array).has("gate-1"):
		gate_node = Sprite2D.new()
		var bars := gate_node as Sprite2D
		bars.texture = texture("an-iron-prison-cage")
		bars.scale = Vector2.ONE * (CELL * 1.15 / 524.0)
		bars.offset = Vector2(0, -bars.texture.get_height() * 0.5)
		bars.position = center(gate_cell) + Vector2(0, CELL * 0.45)
		sorted.add_child(bars)
	if key_cell.x >= 0 and not (state.keys as Array).has("key-1"):
		key_node = KeyMarker.new()
		key_node.position = center(key_cell)
		sorted.add_child(key_node)
	for c: Dictionary in chests:
		var chest := Sprite2D.new()
		chest.texture = texture("treasure-chest")
		chest.scale = Vector2.ONE * (0.30 if c.vault else 0.22)
		chest.offset = Vector2(0, -chest.texture.get_height() * 0.5)
		chest.position = center(c.cell) + Vector2(0, 40)
		if (state.chests as Array).has(c.id):
			chest.modulate = Color(0.45, 0.45, 0.5)
		sorted.add_child(chest)
		chest_nodes[c.id] = chest
	light = PointLight2D.new()
	var radial := GradientTexture2D.new()
	radial.fill = GradientTexture2D.FILL_RADIAL
	radial.fill_from = Vector2(0.5, 0.5)
	radial.fill_to = Vector2(1.0, 0.5)
	radial.width = 256
	radial.height = 256
	var gradient := Gradient.new()
	gradient.colors = PackedColorArray([Color(1, 0.93, 0.8, 1), Color(1, 0.85, 0.6, 0)])
	radial.gradient = gradient
	light.texture = radial
	light.texture_scale = 5.5
	light.energy = 1.35
	light.position = Vector2(0, -50)
	player.add_child(light)

var _glow: Texture2D

func glow_texture() -> Texture2D:
	if _glow == null:
		var radial := GradientTexture2D.new()
		radial.fill = GradientTexture2D.FILL_RADIAL
		radial.fill_from = Vector2(0.5, 0.5)
		radial.fill_to = Vector2(1.0, 0.5)
		radial.width = 128
		radial.height = 128
		var gradient := Gradient.new()
		gradient.colors = PackedColorArray([Color(1, 1, 1, 0.9), Color(1, 1, 1, 0)])
		radial.gradient = gradient
		_glow = radial
	return _glow

## The colour the whole canvas is multiplied by inside the cave (the game applies it): a dark, world-tinted gloom.
func ambient() -> Color:
	return TINT[theme].dark

func cleanup() -> void:
	if is_instance_valid(light):
		light.queue_free()

## The floor of the maze: stone tiles on every open cell, shaded where it meets the rock, over a dark background.
class FloorLayer extends Node2D:
	var dungeon: PyraDungeon

	func _draw() -> void:
		var d := dungeon
		draw_rect(d.bounds().grow(400.0), Color(0.03, 0.025, 0.04))
		for y in PyraDungeon.ROWS:
			for x in PyraDungeon.COLS:
				var c := Vector2i(x, y)
				if not d.is_floor(c):
					continue
				var rect := Rect2(x * PyraDungeon.CELL, y * PyraDungeon.CELL, PyraDungeon.CELL, PyraDungeon.CELL)
				draw_texture_rect(d.floor_texture, rect, true)
				var shade := Color(0, 0, 0, 0.45)
				var band := 26.0
				if not d.is_floor(c + Vector2i(0, -1)):
					draw_rect(Rect2(rect.position, Vector2(rect.size.x, band)), shade)
				if not d.is_floor(c + Vector2i(-1, 0)):
					draw_rect(Rect2(rect.position, Vector2(band, rect.size.y)), shade)
				if not d.is_floor(c + Vector2i(1, 0)):
					draw_rect(Rect2(rect.end.x - band, rect.position.y, band, rect.size.y), shade)
				if not d.is_floor(c + Vector2i(0, 1)):
					draw_rect(Rect2(rect.position.x, rect.end.y - band, rect.size.x, band), shade)
		for trap: Vector2 in d.traps:
			draw_circle(trap, 46.0, Color(0.1, 0.05, 0.05, 0.6))
			for i in 7:
				var angle := TAU * i / 7.0
				var tip := trap + Vector2.from_angle(angle) * 30.0
				draw_line(trap + Vector2.from_angle(angle) * 8.0, tip, Color(0.75, 0.72, 0.7), 5.0)

## The old key lying on the floor: a golden key with a pulsing glow.
class KeyMarker extends Node2D:
	var age := 0.0

	func _process(delta: float) -> void:
		age += delta
		queue_redraw()

	func _draw() -> void:
		var pulse := 0.6 + 0.4 * sin(age * 3.0)
		draw_circle(Vector2(0, -20), 38.0, Color(1.0, 0.8, 0.3, 0.18 * pulse))
		draw_circle(Vector2(-12, -26), 9.0, Color(1.0, 0.85, 0.3))
		draw_circle(Vector2(-12, -26), 4.0, Color(0.15, 0.1, 0.05))
		draw_line(Vector2(-4, -26), Vector2(22, -26), Color(1.0, 0.85, 0.3), 5.0)
		draw_line(Vector2(16, -26), Vector2(16, -16), Color(1.0, 0.85, 0.3), 5.0)
		draw_line(Vector2(22, -26), Vector2(22, -18), Color(1.0, 0.85, 0.3), 5.0)
