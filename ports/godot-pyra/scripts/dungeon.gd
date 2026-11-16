class_name PyraDungeon
extends RefCounted
## The underground of Superior. The world reserves 22 entrances (`dungeons` of each land, 4 per continent and 1 per island) with the
## status "entrance reserved; interior integration pending" and ships the dungeon-kit art, but no interior. This builds one per entrance,
## always the same for the same entrance (seeded by its id), in three kinds:
##   transit   a tunnel between two continents (the world's "two-sided connections"): one maze whose two ends are the entrances of the two
##             lands; walking through leads out on the other continent
##   chambers  caves of two floors with a vault at the bottom
##   maze      the Great Labyrinth of the continent: three floors, a bigger maze, a guardian at the last vault
## Every floor has corridors and rooms, a key in the open part, a gate on the only way to the vault (or to the stairs down), chests
## (gold and potions: keys, gates and chests are claimed once and saved), guards of the land that get stronger deeper in, spike traps,
## readable inscriptions about the Choir, a secret chamber behind a cracked wall, and an automap that fills in as the hero explores.

const CELL := 160.0
const REACH := 96.0
const BODY := 13.0
const DIRS: Array[Vector2i] = [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]
const TINT := {
	"pyra": {"floor": Color(0.78, 0.60, 0.52), "glow": Color(1.0, 0.5, 0.2), "dark": Color(0.52, 0.44, 0.48)},
	"verdant": {"floor": Color(0.60, 0.74, 0.54), "glow": Color(0.7, 1.0, 0.5), "dark": Color(0.44, 0.54, 0.50)},
	"aether": {"floor": Color(0.82, 0.84, 0.98), "glow": Color(0.7, 0.85, 1.0), "dark": Color(0.50, 0.54, 0.70)},
	"nexus": {"floor": Color(0.52, 0.64, 0.78), "glow": Color(0.4, 0.9, 1.0), "dark": Color(0.40, 0.50, 0.66)},
}
## What is carved on the walls: the story of the Choir told by each culture (the Silence is "the bill for the previous rescue").
const INSCRIPTIONS := {
	"pyra": [
		"„Płomień nie gasł. Rzucał cudze cienie. Wtedy zrozumieliśmy, że ktoś pali się w naszym imieniu.”",
		"Wypalone w kamieniu: STRAŻNICY, KTÓRZY ZŁAMALI ROZKAZ, BY WYPROWADZIĆ DZIECI. Nie ma tu słowa „tchórz”.",
		"Kowal Hurr zapisał: „Chór dał nam odwagę działania. Nie dał jej odwołać.”",
		"Na belce kopalni wydrapano: „Siedem uderzeń serca ciszy. Policz je, a usłyszysz, kto je odebrał.”",
		"„Wygrany klan pisze kroniki. Przegrani piszą po ścianach.”",
		"Pod popiołem leży tabliczka: „Ewakuację odwołano o świcie. Nikt nie wie, kto wydał rozkaz.”",
	],
	"verdant": [
		"Pnącza zapisały w korze: „Powódź skierowano na doliny, które wciąż mają dymiące kominy.”",
		"„Zmienność jest darem Verdantii. Chór zamienił ją w obowiązek.”",
		"Wyryte przy źródle: „Rzeka pamięta, dokąd ją skierowano. Pytaj rzekę.”",
		"Zielarka Elowen zostawiła notatkę: „Cisza Korzeni nie boli. To najgorsze.”",
		"Na korzeniu wyrzeźbiono siedem kresek, szóstą przekreślono.",
		"„Kto ocala, nie pyta, kogo przy tym zalewa.”",
	],
	"aether": [
		"Wymazano imiona. Zostały puste ramki i podpis: „Rada uznała świadectwa za niebezpieczne.”",
		"„Brakuje jednego tonu w pieczęciach. Słychać go dopiero, gdy ucichną inne.”",
		"Kronikarz zapisał na marginesie: „Pamięć jest darem Aetherii. Chór zrobił z niej archiwum bez prawa głosu.”",
		"Na posadzce, drobnym pismem: „Jeśli czytasz te słowa, ktoś jeszcze pamięta.”",
		"„Siedem uderzeń serca. W ósmym wróciło jedno imię. Nie nasze.”",
		"Pod lustrem wyryto: „Odwróć ton, a usłyszysz ofiary ewakuacji.”",
	],
	"nexus": [
		"Rejestr: „Jednostki nieautoryzowane — koszt zbędny. Procedura ratunkowa zakończona sukcesem.”",
		"„Identyczny pakiet rozkazów zapisano poza pamięcią urządzeń. Nadawca: nieokreślony.”",
		"Notatka serwisanta: „Precyzja jest darem Nexusa. Chór zażądał jej bez marginesu błędu.”",
		"Na obudowie wypalono: „Ewakuować można tylko tych, którzy mają numer.”",
		"„Siedem cykli ciszy. W ósmym zgłosił się nasłuch: ktoś prosi o zgodę.”",
		"Log końcowy: „Błąd to nie usterka. Błąd to głos. Zachować.”",
	],
}

var info: Dictionary = {}
var land_id := ""
var theme := "pyra"
var role := "chambers"                      # transit, chambers, maze
var floor_index := 0
var floors_total := 2
var side := "a"                             # transit: which end of the tunnel is this land's entrance
var cave_name := "Jaskinia"
var cave_blurb := ""
var partner_land := ""
var cols := 23
var rows := 17
var kinds: Array = []                       # monster ids of the land, weakest first
var state: Dictionary = {}                  # {"keys", "gates", "chests", "secrets"}: id lists (saved)
var explored: Dictionary = {}               # automap of this floor: Vector2i -> true
var rng := RandomNumberGenerator.new()
var seed_text := ""
var grid := PackedByteArray()
var rooms: Array[Rect2i] = []
var start_room := Rect2i()
var far_room := Rect2i()
var vault_room := Rect2i()
var has_vault := true
var gate_cell := Vector2i(-1, -1)
var key_cell := Vector2i(-1, -1)
var stairs_cell := Vector2i(-1, -1)
var secret_cell := Vector2i(-1, -1)         # the cracked wall
var secret_pocket := Vector2i(-1, -1)       # the chamber behind it
var secret_from := Vector2i(-1, -1)         # the corridor cell the crack is seen from
var chests: Array[Dictionary] = []
var guards: Array[Dictionary] = []
var notes: Array[Dictionary] = []
var traps: Array[Vector2] = []
var props: Array[Dictionary] = []
var dist: Dictionary = {}
var root: Node2D
var sorted: Node2D
var gate_node: Node2D
var key_node: Node2D
var secret_node: Node2D
var crack_node: Node2D
var floor_layer: Node2D
var chest_nodes: Dictionary = {}
var light: PointLight2D
var floor_texture: Texture2D
var art: Dictionary = {}

func setup(entrance: Dictionary, land: String, world: String, land_kinds: Array, progress: Dictionary, floor: int = 0, explored_map: Dictionary = {}) -> void:
	info = entrance
	land_id = land
	theme = world if TINT.has(world) else "pyra"
	kinds = land_kinds
	state = progress
	floor_index = floor
	explored = explored_map
	for key in ["keys", "gates", "chests", "secrets"]:
		if not state.has(key):
			state[key] = []
	var id := str(entrance.id)
	role = "maze" if str(entrance.get("kind", "")) == "maze" else ("transit" if id.contains("transit") else "chambers")
	floors_total = {"maze": 3, "chambers": 2, "transit": 1}[role]
	cave_name = str(entrance.get("name", "Jaskinia"))
	cave_blurb = str(entrance.get("blurb", ""))
	partner_land = str(entrance.get("partnerLand", ""))
	side = str(entrance.get("side", "a"))
	match role:
		"maze":
			cols = 33
			rows = 25
		"transit":
			cols = 43
			rows = 13
		_:
			cols = 25
			rows = 19
	# a transit tunnel is one structure seen from both ends: both entrances share the instance id
	seed_text = str(entrance.get("instanceId", id)) if role == "transit" else id
	var attempt := 0
	while attempt < 12:
		rng.seed = hash("%s#%d#%d" % [seed_text, floor_index, attempt])
		if generate():
			break
		attempt += 1

func bounds() -> Rect2:
	return Rect2(0, 0, cols * CELL, rows * CELL)

func center(c: Vector2i) -> Vector2:
	return Vector2((c.x + 0.5) * CELL, (c.y + 0.5) * CELL)

func cell_of(p: Vector2) -> Vector2i:
	return Vector2i(int(floor(p.x / CELL)), int(floor(p.y / CELL)))

func is_floor(c: Vector2i) -> bool:
	if c.x < 0 or c.y < 0 or c.x >= cols or c.y >= rows:
		return false
	return grid[c.y * cols + c.x] == 1

func set_floor(c: Vector2i) -> void:
	if c.x > 0 and c.y > 0 and c.x < cols - 1 and c.y < rows - 1:
		grid[c.y * cols + c.x] = 1

func key_id() -> String:
	return "key-%d" % (floor_index + 1)

func gate_id() -> String:
	return "gate-%d" % (floor_index + 1)

func secret_id() -> String:
	return "secret-%d-%s" % [floor_index + 1, seed_text]

func final_floor() -> bool:
	return floor_index >= floors_total - 1

func gate_closed() -> bool:
	return gate_cell.x >= 0 and not (state.gates as Array).has(gate_id())

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

func room_center(r: Rect2i) -> Vector2i:
	return r.position + Vector2i(r.size.x / 2, r.size.y / 2)

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

# ---- generation ----------------------------------------------------------------------------------

## One attempt at a layout; false when the result does not satisfy its own rules (the next attempt uses another seed).
func generate() -> bool:
	grid.resize(cols * rows)
	grid.fill(0)
	rooms = []
	gate_cell = Vector2i(-1, -1)
	key_cell = Vector2i(-1, -1)
	stairs_cell = Vector2i(-1, -1)
	secret_cell = Vector2i(-1, -1)
	secret_pocket = Vector2i(-1, -1)
	var begin := Vector2i(1, rows - 2)
	set_floor(begin)
	var stack: Array[Vector2i] = [begin]
	while not stack.is_empty():
		var c: Vector2i = stack.back()
		var options: Array[Vector2i] = []
		for d: Vector2i in DIRS:
			var n := c + d * 2
			if n.x > 0 and n.y > 0 and n.x < cols - 1 and n.y < rows - 1 and not is_floor(n):
				options.append(d)
		if options.is_empty():
			stack.pop_back()
		else:
			var pick: Vector2i = options[rng.randi() % options.size()]
			set_floor(c + pick)
			set_floor(c + pick * 2)
			stack.append(c + pick * 2)
	start_room = Rect2i(1, rows - 4, 3, 3)
	carve(start_room)
	var wanted := {"maze": 10, "chambers": 6, "transit": 6}[role] as int
	for attempt in 60:
		if rooms.size() >= wanted:
			break
		var w := 5 if rng.randf() < 0.45 else 3
		var h := 3
		var x := 1 + 2 * (rng.randi() % int((cols - 1 - w) / 2))
		var y := 1 + 2 * (rng.randi() % int((rows - 1 - h) / 2))
		var rect := Rect2i(x, y, w, h)
		var clash := rect.grow(1).intersects(start_room)
		for other in rooms:
			clash = clash or rect.grow(1).intersects(other)
		if not clash:
			rooms.append(rect)
			carve(rect)
	if rooms.size() < 3:
		return false
	dist = bfs(begin)
	# rooms from the farthest inwards: the farthest one is the vault (or, in a tunnel, the far end), the next one the vault of the tunnel
	var by_distance: Array[Rect2i] = rooms.duplicate()
	by_distance.sort_custom(func(a: Rect2i, b: Rect2i) -> bool: return int(dist.get(room_center(a), 0)) > int(dist.get(room_center(b), 0)))
	far_room = by_distance[0]
	vault_room = by_distance[1] if role == "transit" else by_distance[0]
	has_vault = true
	var vault_center := room_center(vault_room)
	pick_gate(begin, vault_center)
	if gate_cell.x < 0:
		return false
	if role == "transit" and not dist.has(room_center(far_room)):
		return false   # sealing the vault cut the far end off: try another layout
	var reachable := bfs(begin, gate_cell)
	pick_key(reachable)
	if key_cell.x < 0:
		return false
	if not final_floor():
		stairs_cell = vault_center
	pick_chests(reachable, vault_center)
	pick_guards(vault_center)
	pick_traps(reachable)
	pick_secret(reachable)
	pick_notes(reachable)
	pick_props(vault_center)
	if (state.secrets as Array).has(secret_id()) and secret_cell.x >= 0:
		grid[secret_cell.y * cols + secret_cell.x] = 1   # already opened on an earlier visit
	return true

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
				grid[y * cols + x] = 0
	dist = bfs(begin)
	for y in rows:
		for x in cols:
			if grid[y * cols + x] == 1 and not dist.has(Vector2i(x, y)):
				grid[y * cols + x] = 0
	gate_cell = entry

func pick_key(reachable: Dictionary) -> void:
	var from_gate := bfs(gate_cell, Vector2i(-2, -2)) if gate_cell.x >= 0 else {}
	var best := -1
	for c: Vector2i in reachable:
		if gate_cell.x >= 0 and int(from_gate.get(c, 99)) < 6:
			continue
		var score := int(reachable[c]) + (6 if neighbours(c) == 1 else 0)
		if score > best and not vault_room.has_point(c) and not start_room.has_point(c) and not far_room.has_point(c):
			best = score
			key_cell = c

func reward_tier() -> int:
	return clampi(int(info.get("tier", 0)) + floor_index, 0, 9)

func pick_chests(reachable: Dictionary, vault_center: Vector2i) -> void:
	chests.clear()
	var open_rooms: Array[Rect2i] = []
	for r: Rect2i in rooms:
		if reachable.has(room_center(r)) and r != vault_room and r != far_room:
			open_rooms.append(r)
	open_rooms.sort_custom(func(a: Rect2i, b: Rect2i) -> bool: return int(reachable.get(a.position, 0)) > int(reachable.get(b.position, 0)))
	var tier := reward_tier()
	for i in mini(2, open_rooms.size()):
		chests.append({"id": "chest-%d-%d" % [floor_index + 1, i + 1], "cell": room_center(open_rooms[i]), "gold": int(round((30 + 18 * tier) * (1.0 + 0.4 * i))), "potions": 1 + i, "vault": false})
	var vault_cell := vault_center + (Vector2i(1, 0) if stairs_cell.x >= 0 else Vector2i.ZERO)
	chests.append({"id": "chest-%d-vault" % (floor_index + 1), "cell": vault_cell, "gold": 120 + 60 * tier, "potions": 3, "vault": true})

func pick_guards(vault_center: Vector2i) -> void:
	guards.clear()
	if kinds.is_empty():
		return
	var far := 1
	for c: Vector2i in dist:
		far = maxi(far, int(dist[c]))
	var cap := {"maze": 28, "chambers": 20, "transit": 18}[role] as int
	var spots: Array[Dictionary] = []
	for r: Rect2i in rooms:
		var c := room_center(r)
		if r == vault_room or not dist.has(c) or (role == "transit" and r == far_room):
			continue
		var count := 2 + (rng.randi() % 2)
		for i in count:
			spots.append({"cell": Vector2i(r.position.x + rng.randi() % r.size.x, r.position.y + rng.randi() % r.size.y), "at": float(dist.get(c, 0)) / far})
	for c: Vector2i in dist:
		if neighbours(c) == 1 and int(dist[c]) > 8 and not vault_room.has_point(c) and c != key_cell and spots.size() < cap:
			spots.append({"cell": c, "at": float(dist[c]) / far})
	for s: Dictionary in spots:
		if guards.size() >= cap:
			break
		# deeper in the floor and deeper in the cave means stronger monsters of the land
		var fraction := (float(floor_index) + float(s.at)) / float(floors_total)
		var index := clampi(int(round(fraction * (kinds.size() - 1))), 0, kinds.size() - 1)
		guards.append({"cell": s.cell, "kind": str(kinds[index]), "elite": false})
	var strongest := str(kinds[kinds.size() - 1])
	for i in 2:
		guards.append({"cell": vault_center + Vector2i(i * 2 - 1, 1 if vault_room.size.y > 1 else 0), "kind": strongest, "elite": true})
	if role == "maze" and final_floor():
		guards.append({"cell": vault_center + Vector2i(0, -1), "kind": strongest, "elite": true, "guardian": true})

func pick_traps(reachable: Dictionary) -> void:
	traps.clear()
	var cells: Array = []
	for c: Vector2i in reachable:
		if neighbours(c) == 2 and not in_room(c) and int(reachable[c]) > 6 and c != gate_cell:
			cells.append(c)
	var count := {"maze": 9, "chambers": 6, "transit": 5}[role] as int
	for i in mini(count, cells.size()):
		var pick := rng.randi() % cells.size()
		traps.append(center(cells[pick]))
		cells.remove_at(pick)

## A wall cell with a corridor on one side and, behind it, a closed one-cell chamber: the crack is the way in.
func pick_secret(reachable: Dictionary) -> void:
	var candidates: Array[Dictionary] = []
	for y in range(2, rows - 3):
		for x in range(2, cols - 3):
			var w := Vector2i(x, y)
			if is_floor(w):
				continue
			for d: Vector2i in DIRS:
				var from := w - d
				var pocket := w + d
				if not reachable.has(from) or in_room(from) or neighbours(from) != 2:
					continue
				var closed := not is_floor(pocket)
				for e: Vector2i in DIRS:
					closed = closed and (e == -d or not is_floor(pocket + e)) and not is_floor(pocket + d)
				if closed and not is_floor(w) and pocket.x > 1 and pocket.y > 1 and pocket.x < cols - 2 and pocket.y < rows - 2:
					candidates.append({"wall": w, "pocket": pocket, "from": from})
	if candidates.is_empty():
		return
	var pick: Dictionary = candidates[rng.randi() % candidates.size()]
	secret_cell = pick.wall
	secret_pocket = pick.pocket
	secret_from = pick.from
	set_floor(secret_pocket)
	chests.append({"id": "chest-%d-secret" % (floor_index + 1), "cell": secret_pocket, "gold": 90 + 45 * reward_tier(), "potions": 2, "vault": true, "secret": true})

func pick_notes(reachable: Dictionary) -> void:
	notes.clear()
	var texts: Array = INSCRIPTIONS[theme]
	var spots: Array = []
	for c: Vector2i in reachable:
		if neighbours(c) == 1 and int(reachable[c]) > 4 and c != key_cell:
			spots.append(c)
	for r: Rect2i in rooms:
		if reachable.has(r.position) and r != vault_room:
			spots.append(r.position)
	for i in mini(3, spots.size()):
		var pick := rng.randi() % spots.size()
		var text: String = texts[(rng.randi() + i + floor_index * 2) % texts.size()]
		notes.append({"id": "note-%d-%d" % [floor_index + 1, i], "cell": spots[pick], "text": text})
		spots.remove_at(pick)

func pick_props(vault_center: Vector2i) -> void:
	props.clear()
	var counter := 0
	for c: Vector2i in dist:
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

# ---- places the hero meets ------------------------------------------------------------------------

## The room the hero arrives in and the room whose door leads out to the surface: one and the same, except that the far end of a
## tunnel is a door to the other continent (and the far entrance of a tunnel entered from the other side is its start room).
func arrival_room() -> Rect2i:
	return far_room if (role == "transit" and side == "b") else start_room

func link_room() -> Rect2i:
	return start_room if (role == "transit" and side == "b") else far_room

func arrival() -> Vector2:
	return center(room_center(arrival_room()))

func exit_point() -> Vector2:
	var r := arrival_room()
	return center(r.position + Vector2i(0, 2)) + Vector2(-40, 36)

func link_point() -> Vector2:
	return center(room_center(link_room()))

func stairs_up_point() -> Vector2:
	return center(room_center(start_room) + Vector2i(1, 0))

func depth_text() -> String:
	return "%s · piętro %d/%d" % [cave_name, floor_index + 1, floors_total] if floors_total > 1 else cave_name

func targets() -> Array[Dictionary]:
	var list: Array[Dictionary] = []
	if floor_index == 0:
		list.append({"kind": "exit", "id": "exit", "name": "Wyjście z jaskini", "point": exit_point()})
	else:
		list.append({"kind": "dup", "id": "up", "name": "Schody w górę", "title": "Wejdź po schodach w górę", "point": stairs_up_point()})
	if role == "transit":
		list.append({"kind": "dtransit", "id": "transit", "name": "Przejście", "title": "Wyjdź na drugim końcu tunelu", "point": link_point()})
	if stairs_cell.x >= 0:
		list.append({"kind": "ddown", "id": "down", "name": "Schody w dół", "title": "Zejdź niżej", "point": center(stairs_cell) + Vector2(0, 40)})
	if key_cell.x >= 0 and not (state.keys as Array).has(key_id()):
		list.append({"kind": "dkey", "id": key_id(), "name": "Stary klucz", "title": "Podnieś klucz", "point": center(key_cell)})
	if gate_cell.x >= 0 and not (state.gates as Array).has(gate_id()):
		list.append({"kind": "dgate", "id": gate_id(), "name": "Zamknięta krata", "title": "Otwórz kratę", "point": center(gate_cell)})
	for c: Dictionary in chests:
		if bool(c.get("secret", false)) and not (state.secrets as Array).has(secret_id()):
			continue
		if not (state.chests as Array).has(c.id):
			list.append({"kind": "dchest", "id": c.id, "name": "Skrzynia", "title": "Otwórz skrzynię", "point": center(c.cell) + Vector2(0, 30)})
	for n: Dictionary in notes:
		list.append({"kind": "dnote", "id": n.id, "name": "Inskrypcja", "title": "Przeczytaj inskrypcję", "point": center(n.cell), "text": n.text})
	if secret_cell.x >= 0 and not (state.secrets as Array).has(secret_id()):
		list.append({"kind": "dsecret", "id": secret_id(), "name": "Pęknięta ściana", "title": "Zbadaj pęknięcie w ścianie", "point": center(secret_from) + Vector2(secret_cell - secret_from) * 70.0})
	return list

func near(point: Vector2, target: Vector2) -> bool:
	return point.is_finite() and point.distance_to(target) <= REACH

func pick_up_key(at: Vector2) -> bool:
	if key_cell.x < 0 or (state.keys as Array).has(key_id()) or not near(at, center(key_cell)):
		return false
	(state.keys as Array).append(key_id())
	if is_instance_valid(key_node):
		key_node.queue_free()
	return true

func open_gate(at: Vector2) -> bool:
	if gate_cell.x < 0 or (state.gates as Array).has(gate_id()) or not (state.keys as Array).has(key_id()) or not near(at, center(gate_cell)):
		return false
	(state.gates as Array).append(gate_id())
	if is_instance_valid(gate_node):
		gate_node.queue_free()
	return true

## Breaks open the cracked wall: the chamber behind it becomes reachable.
func open_secret(at: Vector2) -> bool:
	if secret_cell.x < 0 or (state.secrets as Array).has(secret_id()) or at.distance_to(center(secret_from) + Vector2(secret_cell - secret_from) * 70.0) > REACH:
		return false
	(state.secrets as Array).append(secret_id())
	grid[secret_cell.y * cols + secret_cell.x] = 1
	if is_instance_valid(secret_node):
		secret_node.queue_free()
	if is_instance_valid(crack_node):
		crack_node.queue_free()
	if is_instance_valid(floor_layer):
		floor_layer.queue_redraw()
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

## The automap: cells close to the hero become known.
func reveal(at: Vector2, radius: int = 3) -> bool:
	var here := cell_of(at)
	var changed := false
	for dx in range(-radius, radius + 1):
		for dy in range(-radius, radius + 1):
			var c := here + Vector2i(dx, dy)
			if dx * dx + dy * dy <= radius * radius + 1 and c.x >= 0 and c.y >= 0 and c.x < cols and c.y < rows and not explored.has(c):
				explored[c] = true
				changed = true
	return changed

func recommended_levels(level_of: Callable) -> Vector2i:
	var low := 99
	var high := 1
	for g: Dictionary in guards:
		var level := int(level_of.call(str(g.kind)))
		low = mini(low, level)
		high = maxi(high, level)
	return Vector2i(mini(low, high), high)

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
	floor_layer = layer
	# walls: a chunk of cave rock on every wall cell that touches a floor cell (the rest is the dark background)
	for y in rows:
		for x in cols:
			var c := Vector2i(x, y)
			var is_secret := c == secret_cell
			if is_floor(c) and not is_secret:
				continue
			var touches := is_secret
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
			sprite.position = Vector2((x + 0.5) * CELL + float((x * 31 + y * 17) % 9 - 4) * 3.0, (y + 1.0) * CELL - 40.0)
			sorted.add_child(sprite)
			if is_secret:
				secret_node = sprite
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
	if floor_index == 0:
		var door := Sprite2D.new()
		door.texture = texture("stone-doorway")
		door.scale = Vector2.ONE * 0.36
		door.offset = Vector2(0, -door.texture.get_height() * 0.5)
		door.position = exit_point() + Vector2(30, 60)
		sorted.add_child(door)
	if role == "transit":
		var portal := Sprite2D.new()
		portal.texture = texture("stone-doorway")
		portal.scale = Vector2.ONE * 0.5
		portal.offset = Vector2(0, -portal.texture.get_height() * 0.5)
		portal.position = link_point() + Vector2(0, 60)
		portal.modulate = Color(0.75, 0.85, 1.0)
		sorted.add_child(portal)
		var halo := Sprite2D.new()
		halo.texture = glow_texture()
		halo.modulate = Color(0.55, 0.8, 1.0, 0.7)
		halo.scale = Vector2.ONE * 2.2
		halo.position = Vector2(0, -portal.texture.get_height() * 0.28)
		var halo_material := CanvasItemMaterial.new()
		halo_material.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
		halo.material = halo_material
		portal.add_child(halo)
	if floor_index > 0:
		var steps := StairsMarker.new()
		steps.up = true
		steps.position = stairs_up_point()
		sorted.add_child(steps)
	if stairs_cell.x >= 0:
		var down := StairsMarker.new()
		down.up = false
		down.position = center(stairs_cell) + Vector2(0, 40)
		sorted.add_child(down)
	if gate_cell.x >= 0 and not (state.gates as Array).has(gate_id()):
		gate_node = Sprite2D.new()
		var bars := gate_node as Sprite2D
		bars.texture = texture("an-iron-prison-cage")
		bars.scale = Vector2.ONE * (CELL * 1.15 / 524.0)
		bars.offset = Vector2(0, -bars.texture.get_height() * 0.5)
		bars.position = center(gate_cell) + Vector2(0, CELL * 0.45)
		sorted.add_child(bars)
	if key_cell.x >= 0 and not (state.keys as Array).has(key_id()):
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
	for n: Dictionary in notes:
		var slab := NoteMarker.new()
		slab.position = center(n.cell) + Vector2(0, 30)
		sorted.add_child(slab)
	if secret_cell.x >= 0 and not (state.secrets as Array).has(secret_id()):
		crack_node = CrackMarker.new()
		crack_node.position = center(secret_from) + Vector2(secret_cell - secret_from) * 70.0 + Vector2(0, 10)
		sorted.add_child(crack_node)
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
		for y in d.rows:
			for x in d.cols:
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

## Stairs: steps drawn in perspective with an arrow, glowing so that they are found in the dark.
class StairsMarker extends Node2D:
	var up := false
	var age := 0.0

	func _process(delta: float) -> void:
		age += delta
		queue_redraw()

	func _draw() -> void:
		var pulse := 0.5 + 0.5 * sin(age * 2.5)
		draw_circle(Vector2(0, -10), 64.0, Color(0.9, 0.85, 0.6, 0.10 + 0.08 * pulse))
		for i in 5:
			var width := 90.0 - 8.0 * i
			var y := -6.0 - 11.0 * i if up else -50.0 + 11.0 * i
			var shade := 0.35 + 0.1 * i if up else 0.7 - 0.1 * i
			draw_rect(Rect2(-width / 2.0, y, width, 12.0), Color(shade, shade * 0.95, shade * 0.85))
			draw_line(Vector2(-width / 2.0, y), Vector2(width / 2.0, y), Color(0.9, 0.85, 0.7, 0.6), 1.5)
		var arrow := -66.0 if up else 4.0
		var tip := Vector2(0, arrow - 12.0 if up else arrow + 14.0)
		draw_colored_polygon(PackedVector2Array([tip, Vector2(-12, arrow), Vector2(12, arrow)]), Color(1.0, 0.9, 0.5, 0.8))

## A carved tablet.
class NoteMarker extends Node2D:
	var age := randf() * 6.0

	func _process(delta: float) -> void:
		age += delta
		queue_redraw()

	func _draw() -> void:
		var pulse := 0.5 + 0.5 * sin(age * 2.0)
		draw_circle(Vector2(0, -26), 40.0, Color(0.8, 0.9, 1.0, 0.07 + 0.07 * pulse))
		draw_rect(Rect2(-18, -56, 36, 52), Color(0.62, 0.6, 0.55))
		draw_rect(Rect2(-18, -56, 36, 52), Color(0.3, 0.28, 0.25), false, 2.0)
		for i in 4:
			draw_line(Vector2(-11, -46 + i * 10), Vector2(11, -46 + i * 10), Color(0.25, 0.23, 0.2), 2.0)

## A crack in the rock, glinting where a wall can be broken.
class CrackMarker extends Node2D:
	var age := 0.0

	func _process(delta: float) -> void:
		age += delta
		queue_redraw()

	func _draw() -> void:
		var pulse := 0.5 + 0.5 * sin(age * 3.0)
		draw_circle(Vector2(0, -30), 34.0, Color(1.0, 0.85, 0.5, 0.06 + 0.08 * pulse))
		var points := PackedVector2Array([Vector2(0, -70), Vector2(8, -52), Vector2(-6, -38), Vector2(7, -22), Vector2(-4, -8)])
		draw_polyline(points, Color(0.05, 0.03, 0.03), 5.0)
		draw_polyline(points, Color(1.0, 0.85, 0.5, 0.5 + 0.4 * pulse), 2.0)
