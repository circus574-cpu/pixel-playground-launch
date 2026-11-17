extends RefCounted
## Brings a character made in the browser game into the Android game.
##
## The browser characters of the signed-in account are read from the server (GET /ws/characters, the same account token as everything else). One of them becomes
## a NEW hero of the Android game: the same race, level, experience, learned skill nodes, gold, bag, materials and worn equipment. What the Android game has no
## counterpart for (an item id it does not know, a skill node that is not valid at that level) is left out, and the player is told how much. The browser character is only
## read: it is never changed or retired, so nothing is lost and the import can be repeated.
## No class_name on purpose (loaded by path, so a server update can deliver it to an installed app).

const RACES := ["legend", "planetary", "sage", "android"]
const LAND_OF_RACE := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}
const RACE_NAMES := {"legend": "Legenda", "planetary": "Planetarny", "sage": "Mędrzec", "android": "Android"}

## One line for the list of characters.
static func summary(record: Dictionary) -> String:
	var player: Dictionary = record.get("state", {}).get("player", {})
	return "%s · %s · poz. %d" % [str(player.get("name", "Postać")), str(RACE_NAMES.get(str(player.get("race", "")), "?")), int(player.get("level", 1))]

## What the Android hero will be: {ok, race, name, level, xp, gold, learned, bag, equipment, skipped_items, skipped_skills}. `known` tells whether an item id exists here.
static func plan(record: Dictionary, known: Callable) -> Dictionary:
	var player: Dictionary = record.get("state", {}).get("player", {})
	var race := str(player.get("race", ""))
	if not RACES.has(race):
		return {"ok": false, "reason": "Nieznana rasa postaci."}
	var level := clampi(int(player.get("level", 1)), 1, 20)
	var bag: Dictionary = {}
	var skipped_items := 0
	var potions := int((player.get("items", {}) as Dictionary).get("potion", 0))
	if potions > 0:
		bag["potion"] = potions
	for source: String in ["bagItems", "materials"]:
		var rows: Variant = player.get(source, {})
		if rows is Dictionary:
			for id: String in (rows as Dictionary):
				var count := int((rows as Dictionary)[id])
				if count <= 0:
					continue
				if bool(known.call(id)):
					bag[id] = int(bag.get(id, 0)) + count
				else:
					skipped_items += count
	var equipment: Dictionary = {}
	var worn: Variant = player.get("equipment", {})
	if worn is Dictionary:
		for slot: String in (worn as Dictionary):
			var id: Variant = (worn as Dictionary)[slot]
			if id == null or str(id) == "":
				continue
			if bool(known.call(str(id))):
				equipment[slot] = str(id)
			else:
				skipped_items += 1
	var learned: Array[String] = []
	for id: Variant in (player.get("skills", ["R"]) as Array):
		learned.append(str(id))
	return {
		"ok": true, "race": race, "name": str(player.get("name", "")), "level": level, "xp": maxi(0, int(player.get("xp", 0))), "gold": maxi(0, int(player.get("gold", 0))),
		"learned": learned, "bag": bag, "equipment": equipment, "skipped_items": skipped_items, "skipped_skills": 0,
	}

## Makes the hero from a plan in a running game (the game must be the PyraGame). Returns the plan with the counts of what could not be taken over.
static func apply(game: Node, imported: Dictionary) -> Dictionary:
	game.skip_intro = true   # the story of a new character is for a character that is new to the player
	await game.start_new_character(str(imported.race))
	var kit: Variant = game.kit
	kit.set_level(int(imported.level))
	kit.xp = mini(int(imported.xp), RaceKit.xp_needed(int(imported.level)) - 1)
	var skipped_skills := 0
	for id: String in (imported.learned as Array):
		if id == "R" and kit.has("R"):
			continue
		if not kit.learn(id):
			skipped_skills += 1
	game.economy.gold = int(imported.gold)
	game.economy.bag = (imported.bag as Dictionary).duplicate()
	for slot: String in (imported.equipment as Dictionary):
		game.economy.equipment[slot] = (imported.equipment as Dictionary)[slot]
	game.economy.changed.emit()
	kit.hp = float(kit.stats().maxHp)
	kit.ki = float(kit.stats().maxKi)
	game.hud.refresh(kit)
	game.save_checkpoint()
	var result := imported.duplicate()
	result["skipped_skills"] = skipped_skills
	return result

## The menu entry: asks the server for the account's browser characters, lets the player pick one, asks once more, then makes the hero.
static func run(game: Node) -> void:
	var net: PyraOnline = KiNet.online()
	if not net.logged_in():
		game.hud.toast("Zaloguj się, żeby wczytać postać z przeglądarki.")
		return
	game.hud.toast("Pobieram postacie z przeglądarki…")
	var answer := await net.request(HTTPClient.METHOD_GET, "/ws/characters")
	if int(answer.status) != 200 or not (answer.json is Dictionary):
		game.hud.toast(PyraOnline.message_of(answer, "Nie udało się pobrać postaci z przeglądarki."))
		return
	var records: Array = (answer.json as Dictionary).get("characters", [])
	if records.is_empty():
		game.hud.toast("Na tym koncie nie ma postaci z przeglądarki.")
		return
	var actions: Array = []
	for record: Dictionary in records:
		var chosen: Dictionary = record
		actions.append({"text": summary(chosen), "callback": func() -> void: confirm(game, chosen)})
	game.hud.show_dialog("POSTAĆ Z PRZEGLĄDARKI", "Wybierz postać. Powstanie z niej NOWA postać w grze Android (ta sama rasa, poziom, umiejętności, złoto i wyposażenie, o ile istnieją w Androidzie). Twoja postać w przeglądarce nie zostanie zmieniona.", actions)

static func confirm(game: Node, record: Dictionary) -> void:
	var made := plan(record, func(id: String) -> bool: return game.economy.items.has(id) or id == "potion")
	if not bool(made.ok):
		game.hud.toast(str(made.reason))
		return
	game.hud.show_dialog("WCZYTAĆ POSTAĆ?", "%s zastąpi obecną postać z Androida (po zapisie). Kontynuować?" % summary(record), [
		{"text": "TAK, WCZYTAJ", "callback": func() -> void: await finish(game, made)},
	])

static func finish(game: Node, made: Dictionary) -> void:
	game.hud.close_dialog()
	var result := await apply(game, made)
	var lost := int(result.skipped_items) + int(result.skipped_skills)
	game.hud.toast("Wczytano postać: poz. %d." % int(result.level) + ("" if lost == 0 else " Pominięto %d rzeczy, których nie ma w Androidzie." % lost))
