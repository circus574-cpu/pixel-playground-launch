extends RefCounted
## Peaceful animals (data/food.json): they never attack, run away when hurt and give exactly one food. An animal exists in the world
## only when its art has been prepared (data/animals.json, written by scripts/godot/prepare_animals.py); until then they are only data.
## They are monsters of the monster manager with the trait "peaceful", so targeting, damage, loot and respawn work as for every monster.
## No class_name on purpose: a new class name added after an APK was built is invisible to that APK (the list of global classes lives in it),
## so a core pack could not deliver this file. It is loaded by path: `const Animals := preload("res://scripts/animals.gd")`.

const HERD := 10                 # animals of one kind per land of their world
const HERO_SPEED := 170.0        # px/s of the hero; "fleeSpeed" is a share of it
const BASE_SPEED := 120.0        # px/s at speed 1.0 of a monster (monster.gd)

static func art_data() -> Dictionary:
	var value: Variant = PyraContinent.load_json("res://data/animals.json") if FileAccess.file_exists("res://data/animals.json") else {}
	return value if value is Dictionary else {}

## The animals of `world` whose art exists.
static func usable(food_data: Dictionary, art: Dictionary, world: String) -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for animal: Dictionary in food_data.get("animals", []):
		if str(animal.world) == world and (art.get("animals", {}) as Dictionary).has(str(animal.id)):
			out.append(animal)
	return out

## The monster definition of an animal: no attack, no aggro, flees; its drop is the food it is named after.
static func definition(animal: Dictionary, actor: Dictionary) -> Dictionary:
	return {
		"id": str(animal.id), "world": str(animal.world), "name": str(animal.name), "level": 1, "hp": int(animal.hp), "atk": 0, "def": 0, "xp": 0,
		"speed": float(animal.fleeSpeed) * HERO_SPEED / BASE_SPEED, "range": 0, "agro": 0, "attackCd": 1000, "basic": "melee", "weak": {},
		"traits": {"peaceful": true, "leash": 500, "wander": 260}, "skills": [], "loot": [], "gold": [0, 0], "respawn": int(float(animal.respawnSeconds) * 1000.0),
		"sizeClass": "S" if int(animal.hp) < 100 else "M", "lootItems": [{"item": str(animal.drop), "chance": 1.0}],
		"pool": {"ids": [], "weights": [], "total": 0}, "actor": actor,
	}

## Spawn rows ([kind index, x, y, leash, respawn ms]) of `count` animals scattered over the land on ground the hero can stand on, outside the cities.
## The same land always gives the same places.
static func rows(kind_index: int, animal: Dictionary, land_id: String, width: float, height: float, can_stand: Callable, in_city: Callable, count: int = HERD) -> Array:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash("%s/%s" % [land_id, str(animal.id)])
	var out: Array = []
	var tries := 0
	while out.size() < count and tries < 400:
		tries += 1
		var at := Vector2(rng.randf_range(0.08, 0.92) * width, rng.randf_range(0.08, 0.92) * height)
		if bool(can_stand.call(at)) and not bool(in_city.call(at)):
			out.append([kind_index, roundi(at.x), roundi(at.y), 500, int(float(animal.respawnSeconds) * 1000.0)])
	return out
