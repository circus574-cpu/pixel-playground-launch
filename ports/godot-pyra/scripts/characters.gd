extends RefCounted
## The characters of this device. The game always plays the file `user://city-checkpoint-v1.json` (the active character); every save of it is also kept
## in `user://characters/<id>.json`, so a second character (NOWA POSTAĆ, POSTAĆ Z PRZEGLĄDARKI) no longer replaces the first. Before the game starts the
## player chooses among them (scripts/character_select.gd). Loaded by path (no class_name): the script travels with a server update.

const ACTIVE := "user://city-checkpoint-v1.json"
const DIR := "user://characters"

static func new_id() -> String:
	return "c%d%03d" % [Time.get_unix_time_from_system(), randi() % 1000]

static func slot_path(id: String) -> String:
	return "%s/%s.json" % [DIR, id]

static func read(path: String) -> Dictionary:
	if not FileAccess.file_exists(path):
		return {}
	var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(path))
	return value if value is Dictionary else {}

static func write(path: String, value: Dictionary) -> bool:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	var file := FileAccess.open(path + ".tmp", FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(value))
	file.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(path + ".tmp"), ProjectSettings.globalize_path(path)) == OK

## Keeps a copy of the active save in its slot (called after every save of the active character).
static func store(value: Dictionary) -> void:
	var id := str(value.get("characterId", ""))
	if id != "":
		write(slot_path(id), value)

## An old save without an id gets one; the active save is copied to its slot. Returns the id ("" when there is no valid active save).
static func adopt_active() -> String:
	var value := read(ACTIVE)
	if value.is_empty() or not value.has("race"):
		return ""
	if str(value.get("characterId", "")) == "":
		value["characterId"] = new_id()
		write(ACTIVE, value)
	if not FileAccess.file_exists(slot_path(str(value.characterId))):
		store(value)
	return str(value.characterId)

## [{id, race, level, land, time}] newest first.
static func list() -> Array[Dictionary]:
	adopt_active()
	var out: Array[Dictionary] = []
	var dir := DirAccess.open(DIR)
	if dir == null:
		return out
	for file in dir.get_files():
		if not file.ends_with(".json"):
			continue
		var path := "%s/%s" % [DIR, file]
		var value := read(path)
		var kit: Variant = value.get("kit", {})
		if value.is_empty() or not value.has("race") or not kit is Dictionary:
			continue
		out.append({"id": file.trim_suffix(".json"), "race": str(value.race), "level": int((kit as Dictionary).get("level", 1)), "land": str(value.get("land", "pyra")), "time": FileAccess.get_modified_time(path)})
	out.sort_custom(func(a: Dictionary, b: Dictionary) -> bool: return int(a.time) > int(b.time))
	return out

## Makes the character the active one (the game then starts with it).
static func activate(id: String) -> bool:
	var value := read(slot_path(id))
	if value.is_empty():
		return false
	value["characterId"] = id
	return write(ACTIVE, value)

## The next start has no active save: the game opens the race choice and makes a new character. Saves of the others stay in their slots.
static func begin_new() -> void:
	adopt_active()
	if FileAccess.file_exists(ACTIVE):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(ACTIVE))

static func delete(id: String) -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path(slot_path(id)))
	if str(read(ACTIVE).get("characterId", "")) == id:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(ACTIVE))
