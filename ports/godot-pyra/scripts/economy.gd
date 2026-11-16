class_name PyraEconomy
extends RefCounted
## Coins, bag, equipment, depot, shop and crafting of the city services.
## Rules are the browser game's (docs/FABULA-I-EKWIPUNEK.md, economy of 12.11.2026): the merchant sells only weak items
## (common/uncommon) at 4x the catalogue price (min 60 per level), buys back at half; better gear comes only from crafting.
## Data: data/economy.json, exported from src/game/items by scripts/godot/export-economy.ts.

signal changed
signal said(text: String)

const SLOTS := ["head", "weapon", "armor", "offhand", "hands", "ring", "amulet", "feet"]
const SLOT_NAMES := {"head": "Hełm", "weapon": "Broń", "armor": "Pancerz", "offhand": "Tarcza", "hands": "Rękawice", "ring": "Pierścień", "amulet": "Amulet / artefakt", "feet": "Buty"}
const STATIONS_PYRA := ["forge", "alchemy", "runic", "cyber_fabricator", "projekt_ksiegi"]   # the browser shows all five stations
const STATION_NAMES := {"forge": "Kuźnia", "alchemy": "Alchemia", "runic": "Runy", "cyber_fabricator": "Fabrykator", "projekt_ksiegi": "Księgi"}
const PASSIVE_KEYS := ["maxHpPercent", "maxKiPercent", "atkPercent", "defPercent", "kiRegenPercent", "moveSpeedPercent", "kiCostReductionPercent", "damageReductionPercent", "hpRegenPercent", "critChancePoints"]
const BAG_STACKS := 40
const INN_PRICE := 5
const RARITY_NAMES := {"common": "pospolity", "uncommon": "niepospolity", "rare": "rzadki", "epic": "epicki", "legendary": "legendarny"}
const RARITY_COLORS := {"common": Color("d6d2c8"), "uncommon": Color("7fdc7f"), "rare": Color("66aaff"), "epic": Color("c08aff"), "legendary": Color("ffb347")}
const STAT_LABELS := {"atkBonus": "Atak +%s", "defBonus": "Obrona +%s", "hpBonus": "HP +%s", "kiBonus": "KI +%s", "kiRegenBonus": "Regeneracja KI +%s",
	"atkPercent": "Atak +%s%%", "defPercent": "Obrona +%s%%", "maxHpPercent": "Maks. HP +%s%%", "maxKiPercent": "Maks. KI +%s%%", "moveSpeedPercent": "Szybkość ruchu +%s%%",
	"kiRegenPercent": "Regeneracja KI +%s%%", "critChancePoints": "Krytyk +%s pkt", "critChancePercent": "Krytyk +%s pkt", "hpRegenPercent": "Regeneracja HP +%s%%",
	"damageReductionPercent": "Redukcja obrażeń +%s%%", "kiCostReductionPercent": "Koszt KI −%s%%", "speedMultiplier": "Szybkość ×%s"}

var items: Dictionary = {}
var recipes: Array = []
var shop_ids: Array[String] = []
var gold := 20
var bag: Dictionary = {}
var equipment: Dictionary = {}
var depot: Dictionary = {}
var depot_gold := 0
var level := 1
var potion_cooldown := 0.0
var upgrades: Dictionary = {}          # slot -> upgrade level bought at the smith
var caps: Dictionary = {}
var passive_sets: Dictionary = {}
var equipment_sets: Dictionary = {}
var upgrade_max: Dictionary = {}
var upgrade_cost: Dictionary = {}
var heal_amount_callback: Callable = func(_amount: float) -> bool: return false
var heal_callback: Callable = func(_fraction: float) -> bool: return false

func _init(data: Dictionary) -> void:
	for item: Dictionary in data.items:
		items[item.id] = item
	recipes = data.recipes
	caps = data.caps
	passive_sets = data.passiveSets
	equipment_sets = data.equipmentSets
	upgrade_max = data.upgrades.max
	upgrade_cost = data.upgrades.cost
	for item: Dictionary in data.items:
		if float(item.shopPrice) > 0.0:
			shop_ids.append(str(item.id))
	shop_ids.sort_custom(func(a: String, b: String) -> bool:
		var ia: Dictionary = items[a]
		var ib: Dictionary = items[b]
		if int(ia.level) != int(ib.level):
			return int(ia.level) < int(ib.level)
		return str(ia.name) < str(ib.name))
	for slot in SLOTS:
		equipment[slot] = ""
	bag["potion"] = 3

func item(id: String) -> Dictionary:
	return items.get(id, {})

func icon_path(id: String) -> String:
	return "res://assets/icons/items/%s.webp" % id

func name_of(id: String) -> String:
	return str(item(id).get("name", id))

func rarity_color(id: String) -> Color:
	return RARITY_COLORS.get(str(item(id).get("rarity", "common")), Color.WHITE)

func stat_lines(id: String) -> Array[String]:
	var lines: Array[String] = []
	var stats: Dictionary = item(id).get("stats", {})
	for key: String in stats:
		var value := float(stats[key])
		var text := str(snappedf(value, 0.01)).trim_suffix(".0")
		lines.append((STAT_LABELS.get(key, key + " %s") as String) % text)
	return lines

func stacks() -> int:
	return bag.size()

func count(id: String) -> int:
	return int(bag.get(id, 0))

func say(text: String) -> void:
	said.emit(text)

# ---- bag -------------------------------------------------------------------------------------

func add_item(id: String, amount: int = 1) -> bool:
	if not items.has(id) or amount < 1:
		return false
	if not bag.has(id) and bag.size() >= BAG_STACKS:
		say("Plecak jest pełny.")
		return false
	bag[id] = count(id) + amount
	changed.emit()
	return true

func remove_item(id: String, amount: int = 1) -> bool:
	if count(id) < amount:
		return false
	var left := count(id) - amount
	if left <= 0:
		bag.erase(id)
	else:
		bag[id] = left
	changed.emit()
	return true

# ---- shop ------------------------------------------------------------------------------------

func buy_price(id: String) -> int:
	return int(item(id).get("shopPrice", 0))

func sell_value(id: String) -> int:
	var def := item(id)
	if def.is_empty():
		return 0
	var price := int(def.price)
	return maxi(1, price / 2) if price > 0 else maxi(5, int(def.level) * 8)

func buy(id: String) -> bool:
	var price := buy_price(id)
	if price <= 0:
		say("Kupiec oferuje tylko podstawowe przedmioty. Lepsze wytworzysz w kuźni.")
		return false
	if gold < price:
		say("Potrzeba %d monet, by kupić: %s." % [price, name_of(id)])
		return false
	if not add_item(id, 1):
		return false
	gold -= price
	say("Kupiono: %s za %d monet." % [name_of(id), price])
	changed.emit()
	return true

func sell(id: String) -> bool:
	if not remove_item(id, 1):
		return false
	var value := sell_value(id)
	gold += value
	say("Sprzedano: %s (+%d monet)." % [name_of(id), value])
	changed.emit()
	return true

# ---- equipment -------------------------------------------------------------------------------

func slot_of(id: String) -> String:
	var slot = item(id).get("slot")
	return str(slot) if slot != null else ""

func required_level(id: String) -> int:
	return int(item(id).get("level", 1))

func equip(id: String) -> bool:
	var slot := slot_of(id)
	if slot == "" or count(id) < 1:
		say("Tego nie można założyć.")
		return false
	if required_level(id) > level:
		say("%s wymaga poziomu %d." % [name_of(id), required_level(id)])
		return false
	remove_item(id, 1)
	var previous := str(equipment[slot])
	equipment[slot] = id
	if previous != "":
		add_item(previous, 1)
	say("Założono: %s." % name_of(id))
	changed.emit()
	return true

func unequip(slot: String) -> bool:
	var id := str(equipment.get(slot, ""))
	if id == "":
		return false
	if not bag.has(id) and bag.size() >= BAG_STACKS:
		say("Plecak jest pełny.")
		return false
	equipment[slot] = ""
	add_item(id, 1)
	say("Zdjęto: %s." % name_of(id))
	changed.emit()
	return true

## Same aggregation as `equipmentStats` in the browser game: the weapon sets the base attack, everything else adds.
## Equipment bonuses, exactly as `equipmentStats` of the browser game: flat attack / defence / HP / KI from the items and the
## smith's upgrades, then the percentage stats come from `computePassiveEquipmentBonuses` — item stats, passive artefacts and set
## bonuses, summed over distinct equipped items and capped by the V2 global caps.
func gear() -> Dictionary:
	var g := {"attack": 0.0, "defense": 0.0, "hpBonus": 0.0, "kiBonus": 0.0, "kiRegenBonus": 0.0, "atkPercent": 0.0, "defPercent": 0.0, "maxHpPercent": 0.0, "maxKiPercent": 0.0,
		"kiRegenPercent": 0.0, "moveSpeedPercent": 0.0, "critChancePoints": 0.0, "damageReductionPercent": 0.0, "kiCostReductionPercent": 0.0, "hpRegenPercent": 0.0, "speedMultiplier": 1.0}
	var raw := {}
	for key in PASSIVE_KEYS:
		raw[key] = 0.0
	var set_counts := {}
	var seen := {}
	var any := false
	for slot in SLOTS:
		var id := str(equipment[slot])
		if id == "" or seen.has(id):
			continue
		seen[id] = true
		any = true
		var it := item(id)
		var stats: Dictionary = it.get("stats", {})
		if slot == "weapon":
			g.attack = float(stats.get("atkBonus", 0.0))
		else:
			g.attack += float(stats.get("atkBonus", 0.0))
		g.defense += float(stats.get("defBonus", 0.0))
		if not stats.has("maxHpPercent"):
			g.hpBonus += float(stats.get("hpBonus", 0.0))
		if not stats.has("maxKiPercent"):
			g.kiBonus += float(stats.get("kiBonus", 0.0))
		g.kiRegenBonus += float(stats.get("kiRegenBonus", 0.0))
		if not stats.has("moveSpeedPercent"):
			g.speedMultiplier *= float(stats.get("speedMultiplier", 1.0))
		for key in PASSIVE_KEYS:
			raw[key] += float(stats.get(key, 0.0))
		if not stats.has("critChancePoints"):
			raw["critChancePoints"] += float(stats.get("critChancePercent", 0.0))
		var buff: Variant = it.get("buff", null)
		if buff != null and str(buff.mode) == "passive" and raw.has(str(buff.effect)):
			raw[str(buff.effect)] += float(buff.value)
		if it.get("setId", null) != null:
			set_counts[str(it.setId)] = int(set_counts.get(str(it.setId), 0)) + 1
		var up := int(upgrades.get(slot, 0))
		if up > 0:
			if slot == "weapon":
				g.attack += 2.0 * up
			elif slot != "ring" and slot != "amulet":
				g.defense += float(up)
	for set_id: String in set_counts:
		for rule: Dictionary in passive_sets.get(set_id, equipment_sets.get(set_id, [])):
			if int(set_counts[set_id]) >= int(rule.requiredPieces) and raw.has(str(rule.effect)):
				raw[str(rule.effect)] += float(rule.value)
	if any:
		for key in PASSIVE_KEYS:
			g[key] = minf(float(raw[key]), float(caps.get(key, 1000.0)))
	return g

# ---- reading the gear: comparison, sets, totals --------------------------------------------------------------

const STAT_NAME_OVERRIDES := {"kiCostReductionPercent": "Mniejszy koszt KI", "damageReductionPercent": "Redukcja obrażeń", "speedMultiplier": "Mnożnik szybkości"}

## The bare name of a stat ("Atak", "Obrona", ...) taken from its label.
func stat_name(key: String) -> String:
	if STAT_NAME_OVERRIDES.has(key):
		return str(STAT_NAME_OVERRIDES[key])
	var label: String = STAT_LABELS.get(key, key + " %s")
	return label.get_slice(" +%s", 0).get_slice(" −%s", 0).get_slice(" ×%s", 0).get_slice(" %s", 0)

func stat_suffix(key: String) -> String:
	var label: String = STAT_LABELS.get(key, "")
	return "%" if label.contains("%%") else (" pkt" if label.ends_with(" pkt") else "")

func number_text(value: float) -> String:
	return str(snappedf(value, 0.01)).trim_suffix(".0")

## What putting `id` on would change against the item worn in its slot: "Atak +3", "Obrona −1" (empty when it is not gear or is worn).
func compare_lines(id: String) -> Array[String]:
	var lines: Array[String] = []
	var slot := slot_of(id)
	if slot == "" or str(equipment.get(slot, "")) == id:
		return lines
	var worn := str(equipment.get(slot, ""))
	var now_stats: Dictionary = item(id).get("stats", {})
	var old_stats: Dictionary = item(worn).get("stats", {}) if worn != "" else {}
	var keys := {}
	for key: String in now_stats:
		keys[key] = true
	for key: String in old_stats:
		keys[key] = true
	for key: String in keys:
		var diff := float(now_stats.get(key, 0.0)) - float(old_stats.get(key, 0.0))
		if is_zero_approx(diff):
			continue
		lines.append("%s %s%s%s" % [stat_name(key), "+" if diff > 0.0 else "−", number_text(absf(diff)), stat_suffix(key)])
	return lines

func effect_text(rule: Dictionary) -> String:
	var key := str(rule.effect)
	var label: String = STAT_LABELS.get(key, key + " %s")
	return label % number_text(float(rule.value))

## How many pieces of the item's set are worn and what the set gives at each count; empty when the item belongs to no set.
func set_lines(id: String) -> Array[String]:
	var lines: Array[String] = []
	var set_value: Variant = item(id).get("setId", null)
	if set_value == null:
		return lines
	var sid := str(set_value)
	var worn := 0
	var seen := {}
	for slot in SLOTS:
		var w := str(equipment[slot])
		if w != "" and not seen.has(w) and str(item(w).get("setId", "")) == sid:
			seen[w] = true
			worn += 1
	var total := 0
	for it: Dictionary in items.values():
		if str(it.get("setId", "")) == sid:
			total += 1
	lines.append("Zestaw %s: założone %d z %d części" % [sid, worn, total])
	for rule: Dictionary in passive_sets.get(sid, equipment_sets.get(sid, [])):
		lines.append("  %s%d cz.: %s" % ["AKTYWNE · " if worn >= int(rule.requiredPieces) else "", int(rule.requiredPieces), effect_text(rule)])
	return lines

## Everything the worn gear gives in total (after the global limits), one line per stat, and the sets that are active.
func bonus_lines() -> Array[String]:
	var lines: Array[String] = []
	var g := gear()
	for pair in [["attack", "Atak +%s"], ["defense", "Obrona +%s"], ["hpBonus", "HP +%s"], ["kiBonus", "KI +%s"], ["kiRegenBonus", "Regeneracja KI +%s"]]:
		if float(g[pair[0]]) > 0.0:
			lines.append((pair[1] as String) % number_text(float(g[pair[0]])))
	for key in PASSIVE_KEYS:
		var value := float(g.get(key, 0.0))
		if value > 0.0:
			var text := (STAT_LABELS.get(key, key + " %s") as String) % number_text(value)
			if value >= float(caps.get(key, 1000.0)) - 0.001:
				text += "  (limit)"
			lines.append(text)
	var counted := {}
	for slot in SLOTS:
		var w := str(equipment[slot])
		var set_value: Variant = item(w).get("setId", null) if w != "" else null
		if set_value != null and not counted.has(str(set_value)):
			counted[str(set_value)] = true
			lines.append(set_lines(w)[0])
	return lines

# ---- trade in bulk -------------------------------------------------------------------------------------------

## Sells the whole stack of `id`; returns the coins it brought.
func sell_all(id: String) -> int:
	var before := gold
	var n := count(id)
	var value := sell_value(id)
	if n <= 0 or not remove_item(id, n):
		return 0
	gold += value * n
	say("Sprzedano: %s ×%d (+%d monet)." % [name_of(id), n, value * n])
	changed.emit()
	return gold - before

## Materials no recipe asks for (and no quest item): safe to sell without a thought.
func spare_materials() -> Array[String]:
	var needed := {}
	for recipe: Dictionary in recipes:
		for ingredient: Dictionary in recipe.ingredients:
			needed[str(ingredient.itemId)] = true
	var out: Array[String] = []
	for id: String in bag:
		var def := item(id)
		if str(def.get("category", "")) == "material" and not needed.has(id) and slot_of(id) == "":
			out.append(id)
	return out

func spare_value() -> int:
	var total := 0
	for id in spare_materials():
		total += sell_value(id) * count(id)
	return total

func sell_spare() -> int:
	var total := 0
	for id in spare_materials():
		total += sell_all(id)
	return total

# ---- crafting in quantity ------------------------------------------------------------------------------------

## How many times the recipe can be made right now (0 when it cannot be made once).
func craftable_times(recipe: Dictionary) -> int:
	if not can_craft(recipe).ok:
		return 0
	var times := 99
	for ingredient: Dictionary in recipe.ingredients:
		times = mini(times, count(str(ingredient.itemId)) / maxi(1, int(ingredient.count)))
	if int(recipe.cost) > 0:
		times = mini(times, gold / int(recipe.cost))
	return maxi(0, times)

func craft_many(recipe: Dictionary, times: int) -> int:
	var made := 0
	for i in times:
		if not craft(recipe):
			break
		made += 1
	return made

## Smith: raises the upgrade level of the equipped item of `slot` (weapon +2 ATK per level up to 3, armour pieces +1 DEF up to 2).
func upgrade(slot: String) -> bool:
	if not upgrade_max.has(slot):
		say("Biżuterii nie można ulepszać.")
		return false
	if str(equipment.get(slot, "")) == "":
		say("Na tym slocie nie ma sprzętu do ulepszenia.")
		return false
	var current := int(upgrades.get(slot, 0))
	if current >= int(upgrade_max[slot]):
		say("Ten przedmiot jest już maksymalnie ulepszony.")
		return false
	var cost := int(upgrade_cost[slot][current])
	if gold < cost:
		say("Ulepszenie kosztuje %d monet." % cost)
		return false
	gold -= cost
	upgrades[slot] = current + 1
	say("Ulepszono: %s na +%d (%s za stopień)." % [name_of(str(equipment[slot])), current + 1, "+2 ATK" if slot == "weapon" else "+1 DEF"])
	changed.emit()
	return true

# ---- consumables -----------------------------------------------------------------------------

func use(id: String) -> bool:
	if count(id) < 1:
		return false
	if id == "potion":
		if potion_cooldown > 0.0:
			say("Mikstura: odnowienie %.0f s." % potion_cooldown)
			return false
		if not heal_callback.call(0.4):
			say("Zdrowie jest pełne.")
			return false
		remove_item(id, 1)
		potion_cooldown = 6.0
		say("Mikstura leczy 40% maks. HP.")
		return true
	if item(id).get("category", "") == "consumable":
		var amount := float(item(id).get("stats", {}).get("hpBonus", 50.0))
		if not heal_amount_callback.call(amount):
			say("Zdrowie jest pełne.")
			return false
		remove_item(id, 1)
		say("Użyto: %s." % name_of(id))
		return true
	say("Tego przedmiotu nie można użyć.")
	return false

func tick(delta: float) -> void:
	potion_cooldown = maxf(0.0, potion_cooldown - delta)

# ---- inn -------------------------------------------------------------------------------------

func rest(full: bool) -> bool:
	if full:
		say("HP i KI są pełne — gospodarz nie bierze opłaty.")
		return false
	if gold < INN_PRICE:
		say("Nocleg kosztuje %d monet." % INN_PRICE)
		return false
	gold -= INN_PRICE
	say("Odpoczynek: -%d monet, HP i KI odnowione." % INN_PRICE)
	changed.emit()
	return true

# ---- depot -----------------------------------------------------------------------------------

func deposit(id: String) -> bool:
	if not remove_item(id, 1):
		return false
	depot[id] = int(depot.get(id, 0)) + 1
	changed.emit()
	return true

func withdraw(id: String) -> bool:
	if int(depot.get(id, 0)) < 1:
		return false
	if not bag.has(id) and bag.size() >= BAG_STACKS:
		say("Plecak jest pełny.")
		return false
	depot[id] = int(depot[id]) - 1
	if int(depot[id]) <= 0:
		depot.erase(id)
	add_item(id, 1)
	return true

func move_gold(amount: int, to_depot: bool) -> bool:
	if to_depot:
		if gold < amount:
			return false
		gold -= amount
		depot_gold += amount
	else:
		if depot_gold < amount:
			return false
		depot_gold -= amount
		gold += amount
	changed.emit()
	return true

# ---- crafting --------------------------------------------------------------------------------

func recipes_for(stations: Array) -> Array:
	var list := recipes.filter(func(r: Dictionary) -> bool: return str(r.station) in stations)
	list.sort_custom(func(a: Dictionary, b: Dictionary) -> bool:
		var ca: bool = can_craft(a).ok
		var cb: bool = can_craft(b).ok
		if ca != cb:
			return ca
		if int(a.requiredLevel) != int(b.requiredLevel):
			return int(a.requiredLevel) < int(b.requiredLevel)
		return str(a.name) < str(b.name))
	return list

func can_craft(recipe: Dictionary) -> Dictionary:
	if level < int(recipe.requiredLevel):
		return {"ok": false, "reason": "Wymaga poziomu %d." % int(recipe.requiredLevel)}
	for ingredient: Dictionary in recipe.ingredients:
		if count(str(ingredient.itemId)) < int(ingredient.count):
			return {"ok": false, "reason": "Brakuje: %s." % name_of(str(ingredient.itemId))}
	if gold < int(recipe.cost):
		return {"ok": false, "reason": "Potrzeba %d monet." % int(recipe.cost)}
	var result := str(recipe.result)
	if not bag.has(result) and bag.size() >= BAG_STACKS:
		var frees := false
		for ingredient: Dictionary in recipe.ingredients:
			if count(str(ingredient.itemId)) == int(ingredient.count):
				frees = true
		if not frees:
			return {"ok": false, "reason": "Plecak jest pełny."}
	return {"ok": true, "reason": ""}

func craft(recipe: Dictionary) -> bool:
	var check := can_craft(recipe)
	if not check.ok:
		say(str(check.reason))
		return false
	for ingredient: Dictionary in recipe.ingredients:
		remove_item(str(ingredient.itemId), int(ingredient.count))
	gold -= int(recipe.cost)
	add_item(str(recipe.result), int(recipe.count))
	say("Wytworzono: %s ×%d." % [name_of(str(recipe.result)), int(recipe.count)])
	changed.emit()
	return true

# ---- persistence -----------------------------------------------------------------------------

func to_save() -> Dictionary:
	return {"gold": gold, "bag": bag.duplicate(true), "equipment": equipment.duplicate(true), "depot": depot.duplicate(true), "depotGold": depot_gold, "upgrades": upgrades.duplicate()}

func from_save(value: Dictionary) -> bool:
	var new_bag := {}
	var saved_bag = value.get("bag", {})
	if not saved_bag is Dictionary:
		return false
	for id in saved_bag:
		if not items.has(str(id)) or int(saved_bag[id]) < 1 or not (saved_bag[id] is float or saved_bag[id] is int):
			return false
		new_bag[str(id)] = int(saved_bag[id])
	var new_depot := {}
	var saved_depot = value.get("depot", {})
	if not saved_depot is Dictionary:
		return false
	for id in saved_depot:
		if not items.has(str(id)) or int(saved_depot[id]) < 1:
			return false
		new_depot[str(id)] = int(saved_depot[id])
	var new_equipment := {}
	var saved_equipment = value.get("equipment", {})
	if not saved_equipment is Dictionary:
		return false
	for slot in SLOTS:
		var id := str(saved_equipment.get(slot, ""))
		if id != "" and (not items.has(id) or slot_of(id) != slot):
			return false
		new_equipment[slot] = id
	var coins := int(value.get("gold", 0))
	var vault := int(value.get("depotGold", 0))
	if coins < 0 or vault < 0 or new_bag.size() > BAG_STACKS:
		return false
	var new_upgrades := {}
	var saved_upgrades = value.get("upgrades", {})
	if not saved_upgrades is Dictionary:
		return false
	for slot in saved_upgrades:
		if not upgrade_max.has(str(slot)) or int(saved_upgrades[slot]) < 0 or int(saved_upgrades[slot]) > int(upgrade_max[str(slot)]):
			return false
		new_upgrades[str(slot)] = int(saved_upgrades[slot])
	upgrades = new_upgrades
	bag = new_bag
	depot = new_depot
	equipment = new_equipment
	gold = coins
	depot_gold = vault
	changed.emit()
	return true
