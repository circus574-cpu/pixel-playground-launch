class_name PyraQuests
extends RefCounted
## Quest engine of the browser game (src/game/quests/engine.ts + v2Tracker.ts) played in Godot: 102 playable quests of the four
## continents (main, side, hidden, intercontinental), objectives talk / combat / discover / visit / deliver, stages, unlock
## conditions, rewards, first-discovery rewards of famous and hidden places, one-time reward protection. Same rules, same data
## (data/quests.json, exported by scripts/godot/export-quests.ts); experience, coins and items are handed to the game through the
## `rewarded` signal instead of a separate save.

signal changed
signal rewarded(xp: int, coins: int, items: Dictionary, source: String)
signal announce(text: String)

const DISCOVER_RADIUS := 450.0
const ITEMS := ["potion", "tusk", "sword", "vest"]

var data: Dictionary
var by_id: Dictionary = {}
var famous_by_key: Dictionary = {}     # id and mapPointId -> famous location
var hidden_by_id: Dictionary = {}
var city_of_settlement: Dictionary = {}  # "<continent>/<settlement>" -> city id
var npcs_by_city: Dictionary = {}
var quests: Dictionary = {}            # id -> {state, stage, progress, completions}
var talked: Array = []
var discovered: Array = []
var discovery_claimed: Array = []
var reward_claimed: Array = []
var factions: Dictionary = {}
var tracked := ""
var level_of: Callable = func() -> int: return 1
var item_count: Callable = func(_id: String) -> int: return 0
var item_take: Callable = func(_id: String, _n: int) -> bool: return false

func _init(quest_data: Dictionary) -> void:
	data = quest_data
	for q: Dictionary in data.quests:
		by_id[q.id] = q
	for f: Dictionary in data.famous:
		famous_by_key[f.id] = f
		famous_by_key[f.mapPointId] = f
	for h: Dictionary in data.hidden:
		hidden_by_id[h.id] = h
	for continent: String in data.places:
		for city_id: String in data.places[continent].cities:
			city_of_settlement["%s/%s" % [continent, data.places[continent].cities[city_id].settlement]] = city_id
	for c: Dictionary in data.cities:
		npcs_by_city[c.id] = c.npcs
	sync()

# ---- availability ------------------------------------------------------------------------------

func is_discovered(key: String) -> bool:
	if discovered.has(key):
		return true
	if famous_by_key.has(key):
		var f: Dictionary = famous_by_key[key]
		return discovered.has(f.id) or discovered.has(f.mapPointId)
	return false

func unlocked(q: Dictionary) -> bool:
	if not bool(q.playableInCurrentRuntime):
		return false
	var cond: Dictionary = q.unlockCondition
	if int(cond.get("minLevel", 0)) > level_of.call():
		return false
	for req: String in cond.get("prerequisiteQuestIds", []):
		if str(quests.get(req, {}).get("state", "")) != "completed":
			return false
	for loc: String in cond.get("requiredDiscoveredLocationIds", []):
		if not is_discovered(loc):
			return false
	if cond.has("requiredItemId") and int(item_count.call(str(cond.requiredItemId))) <= 0:
		return false
	if cond.has("requiredTalkedNpcId") and not talked.has(str(cond.requiredTalkedNpcId)):
		return false
	return true

func sync() -> void:
	for q: Dictionary in data.quests:
		var open := unlocked(q)
		if not quests.has(q.id):
			quests[q.id] = {"state": "available" if open else "unavailable", "stage": 0, "progress": {}, "completions": 0}
		else:
			var rec: Dictionary = quests[q.id]
			if rec.state == "unavailable" and open:
				rec.state = "available"
			elif rec.state == "available" and not open:
				rec.state = "unavailable"
	if tracked != "":
		var t: Dictionary = quests.get(tracked, {})
		if t.is_empty() or (t.state != "active" and t.state != "available"):
			tracked = ""
	if tracked == "":
		for id: String in quests:
			if quests[id].state == "active":
				tracked = id
				break

func state_of(id: String) -> String:
	return str(quests.get(id, {}).get("state", "unavailable"))

# ---- start and progress ------------------------------------------------------------------------

func start(id: String) -> bool:
	var q: Dictionary = by_id.get(id, {})
	if q.is_empty() or not bool(q.playableInCurrentRuntime):
		return false
	sync()
	var rec: Dictionary = quests[id]
	if rec.state != "available" and not (rec.state == "completed" and bool(q.repeatable)):
		return false
	var progress := {}
	for obj: Dictionary in q.stages[0].objectives:
		progress[obj.id] = int(obj.targetCount) if obj.type == "discover" and is_discovered(str(obj.targetId)) else 0
	rec.state = "active"
	rec.stage = 0
	rec.progress = progress
	tracked = id
	announce.emit("Nowe zadanie: %s" % q.title)
	evaluate(id)
	changed.emit()
	return true

func matches(objective_target: String, event_target: String) -> bool:
	if objective_target == event_target:
		return true
	if famous_by_key.has(objective_target):
		var f: Dictionary = famous_by_key[objective_target]
		return f.id == event_target or f.mapPointId == event_target
	return false

func evaluate(id: String) -> void:
	var q: Dictionary = by_id[id]
	var rec: Dictionary = quests[id]
	if rec.state != "active":
		return
	var stage := int(rec.stage)
	var stages: Array = q.stages
	while stage < stages.size():
		var done := true
		for obj: Dictionary in stages[stage].objectives:
			if int(rec.progress.get(obj.id, 0)) < int(obj.targetCount):
				done = false
		if not done:
			break
		stage += 1
		if stage < stages.size():
			announce.emit("Etap: %s" % stages[stage].title)
			for obj: Dictionary in stages[stage].objectives:
				if obj.type == "discover" and is_discovered(str(obj.targetId)):
					rec.progress[obj.id] = int(obj.targetCount)
	rec.stage = mini(stage, stages.size() - 1)
	if stage >= stages.size():
		rec.completions = int(rec.completions) + 1
		var first := not reward_claimed.has(id)
		if bool(q.repeatable) or first:
			var r: Dictionary = q.reward
			var items := {}
			if r.has("itemId"):
				items[str(r.itemId)] = int(r.get("itemCount", 1))
			if r.has("factionReputation"):
				var fr: Dictionary = r.factionReputation
				factions[fr.factionId] = int(factions.get(fr.factionId, 0)) + int(fr.amount)
			rewarded.emit(int(r.xp), int(r.coins), items, str(q.title))
			if first:
				reward_claimed.append(id)
		rec.state = "completed"
		announce.emit("Zadanie ukończone: %s" % q.title)
		sync()

## One progress event (combat / talk / discover / visit / deliver) for every active quest.
func record(type: String, target: String, amount: int = 1) -> void:
	if amount <= 0:
		return
	if type == "talk" and not talked.has(target):
		talked.append(target)
	if type == "discover" and not is_discovered(target):
		discover_famous(target)
	var touched := false
	for q: Dictionary in data.quests:
		var rec: Dictionary = quests[q.id]
		if rec.state != "active":
			continue
		var stage: Dictionary = q.stages[int(rec.stage)]
		var modified := false
		for obj: Dictionary in stage.objectives:
			if obj.type != type or not matches(str(obj.targetId), target):
				continue
			var current := int(rec.progress.get(obj.id, 0))
			if current >= int(obj.targetCount):
				continue
			if type == "deliver" and ITEMS.has(str(obj.targetId)):
				var needed := int(obj.targetCount) - current
				var take := mini(mini(int(item_count.call(str(obj.targetId))), needed), amount)
				if take <= 0 or not bool(item_take.call(str(obj.targetId), take)):
					continue
				rec.progress[obj.id] = current + take
			else:
				rec.progress[obj.id] = mini(int(obj.targetCount), current + amount)
			modified = true
		if modified:
			touched = true
			evaluate(q.id)
	sync()
	if touched or type == "talk" or type == "discover":
		changed.emit()

func discover_famous(key: String) -> void:
	if is_discovered(key):
		return
	var f: Dictionary = famous_by_key.get(key, {})
	if f.is_empty():
		discovered.append(key)
	else:
		discovered.append(f.id)
		discovered.append(f.mapPointId)
		if not discovery_claimed.has(f.id):
			discovery_claimed.append(f.id)
			var r: Dictionary = f.reward
			var items := {}
			if r.has("itemId"):
				items[str(r.itemId)] = 1
			if r.has("factionReputation"):
				var fr: Dictionary = r.factionReputation
				factions[fr.factionId] = int(factions.get(fr.factionId, 0)) + int(fr.amount)
			rewarded.emit(int(r.xp), int(r.coins), items, "Odkrycie: %s" % f.name)
			announce.emit("Odkryto: %s" % f.name)
	sync()

func discover_hidden(id: String) -> void:
	var h: Dictionary = hidden_by_id.get(id, {})
	if h.is_empty() or h.status != "active_in_engine" or discovered.has(id):
		return
	discovered.append(id)
	var r: Dictionary = h.reward
	var items := {}
	if r.has("itemId"):
		items[str(r.itemId)] = 1
	rewarded.emit(int(r.xp), int(r.coins), items, "Ukryte miejsce: %s" % h.name)
	announce.emit("Odkryto ukryte miejsce: %s" % h.name)
	sync()
	changed.emit()

# ---- world events the game feeds in ------------------------------------------------------------

func enter_town(continent: String, settlement_id: String) -> void:
	var city: String = str(city_of_settlement.get("%s/%s" % [continent, settlement_id], ""))
	if city != "":
		record("visit", city)

## A conversation with the game NPC of role `role` in town `settlement_id` counts for every quest NPC bound to it.
func talk(continent: String, settlement_id: String, role: String) -> void:
	var binding := "%s.npc.%s" % [continent, role]
	var city: String = str(city_of_settlement.get("%s/%s" % [continent, settlement_id], ""))
	record("talk", binding)
	record("deliver", binding)
	for npc: Dictionary in npcs_by_city.get(city, []):
		if npc.bindingId == binding:
			record("talk", str(npc.id))
			record("deliver", str(npc.id))

func near(continent: String, at: Vector2) -> void:
	var p: Dictionary = data.places.get(continent, {})
	for id: String in p.get("famous", {}):
		var f: Dictionary = p.famous[id]
		if not discovered.has(id) and at.distance_to(Vector2(float(f.x), float(f.y))) < DISCOVER_RADIUS:
			record("discover", id)
	for id: String in p.get("hidden", {}):
		var h: Dictionary = p.hidden[id]
		var radius := float(hidden_by_id.get(id, {}).get("radius", 0.0))
		if not discovered.has(id) and at.distance_to(Vector2(float(h.x), float(h.y))) < radius + 200.0:
			discover_hidden(id)

func defeated(monster_kind: String) -> void:
	record("combat", monster_kind)

# ---- what the NPCs and the HUD ask -------------------------------------------------------------

## Quests this game NPC offers right now (available state), for the dialogue.
func offered_by(continent: String, settlement_id: String, role: String) -> Array:
	var binding := "%s.npc.%s" % [continent, role]
	var city: String = str(city_of_settlement.get("%s/%s" % [continent, settlement_id], ""))
	var out: Array = []
	for npc: Dictionary in npcs_by_city.get(city, []):
		if npc.bindingId != binding:
			continue
		for q: Dictionary in data.quests:
			if q.giverNpcId == npc.id and quests[q.id].state == "available":
				out.append(q)
	return out

## Authored conversation of the quest NPC(s) bound to this game NPC: greeting (rotating), rumors and what they say about each of
## their quests depending on its state (before / during / after). Empty when the game NPC has no quest character in this town.
func conversation(continent: String, settlement_id: String, role: String, turn: int) -> Dictionary:
	var binding := "%s.npc.%s" % [continent, role]
	var city: String = str(city_of_settlement.get("%s/%s" % [continent, settlement_id], ""))
	var lines: Array[String] = []
	var rumors: Array[String] = []
	var who := ""
	for npc: Dictionary in npcs_by_city.get(city, []):
		if npc.bindingId != binding:
			continue
		var d: Dictionary = data.dialogues.get(npc.id, {})
		if d.is_empty():
			continue
		if who == "":
			who = str(d.npcName)
		var greetings: Array = d.greetings
		lines.append(str(greetings[turn % greetings.size()]))
		for r in d.rumors:
			rumors.append(str(r))
		for q: Dictionary in data.quests:
			if q.giverNpcId != npc.id or not d.quests.has(q.id):
				continue
			var text: Dictionary = d.quests[q.id]
			match state_of(q.id):
				"available":
					lines.append("«%s»\n%s" % [q.title, text.before])
				"active":
					lines.append("«%s» (w toku)\n%s" % [q.title, text.during])
				"completed":
					lines.append("«%s» (ukończone)\n%s" % [q.title, text.after])
	return {"who": who, "lines": lines, "rumors": rumors}

## "!" when the NPC has a quest to give, "?" when an active talk or deliver objective waits for them.
func marker_for(continent: String, settlement_id: String, role: String) -> String:
	var binding := "%s.npc.%s" % [continent, role]
	var city: String = str(city_of_settlement.get("%s/%s" % [continent, settlement_id], ""))
	var ids: Array = []
	for npc: Dictionary in npcs_by_city.get(city, []):
		if npc.bindingId == binding:
			ids.append(npc.id)
	for q: Dictionary in data.quests:
		var rec: Dictionary = quests[q.id]
		if rec.state != "active":
			continue
		for obj: Dictionary in q.stages[int(rec.stage)].objectives:
			if (obj.type == "talk" or obj.type == "deliver") and (ids.has(obj.targetId) or obj.targetId == binding) and int(rec.progress.get(obj.id, 0)) < int(obj.targetCount):
				return "?"
	for q: Dictionary in data.quests:
		if ids.has(q.giverNpcId) and bool(q.playableInCurrentRuntime) and quests[q.id].state == "available":
			return "!"
	return ""

## Items that active "deliver" objectives still need: [{item, needed}].
func deliveries() -> Array:
	var out: Array = []
	for q: Dictionary in data.quests:
		var rec: Dictionary = quests[q.id]
		if rec.state != "active":
			continue
		for obj: Dictionary in q.stages[int(rec.stage)].objectives:
			if obj.type == "deliver" and ITEMS.has(str(obj.targetId)):
				var needed := int(obj.targetCount) - int(rec.progress.get(obj.id, 0))
				if needed > 0:
					out.append({"item": str(obj.targetId), "needed": needed})
	return out

func active_ids() -> Array:
	var out: Array = []
	for id: String in quests:
		if quests[id].state == "active":
			out.append(id)
	return out

func objectives_text(id: String) -> Array[String]:
	var q: Dictionary = by_id[id]
	var rec: Dictionary = quests[id]
	var lines: Array[String] = []
	for obj: Dictionary in q.stages[int(rec.stage)].objectives:
		var have := int(rec.progress.get(obj.id, 0))
		var need := int(obj.targetCount)
		lines.append("%s%s" % [obj.description, (" (%d/%d)" % [have, need]) if need > 1 else ("  ✓" if have >= need else "")])
	return lines

## For the HUD tracker: the tracked quest and up to two more active ones.
func tracker() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var order: Array = []
	if tracked != "" and state_of(tracked) == "active":
		order.append(tracked)
	for id in active_ids():
		if not order.has(id):
			order.append(id)
	for id: String in order.slice(0, 3):
		out.append({"title": str(by_id[id].title), "lines": objectives_text(id)})
	return out

# ---- save ---------------------------------------------------------------------------------------

func to_save() -> Dictionary:
	return {"quests": quests.duplicate(true), "talked": talked.duplicate(), "discovered": discovered.duplicate(), "discoveryClaimed": discovery_claimed.duplicate(),
		"rewardClaimed": reward_claimed.duplicate(), "factions": factions.duplicate(), "tracked": tracked}

func from_save(value: Dictionary) -> bool:
	if not (value.get("quests") is Dictionary):
		return false
	for id: String in value.quests:
		if not by_id.has(id):
			return false
	quests = (value.quests as Dictionary).duplicate(true)
	talked = (value.get("talked", []) as Array).duplicate()
	discovered = (value.get("discovered", []) as Array).duplicate()
	discovery_claimed = (value.get("discoveryClaimed", []) as Array).duplicate()
	reward_claimed = (value.get("rewardClaimed", []) as Array).duplicate()
	factions = (value.get("factions", {}) as Dictionary).duplicate()
	tracked = str(value.get("tracked", ""))
	sync()
	changed.emit()
	return true

func reset() -> void:
	quests = {}
	talked = []
	discovered = []
	discovery_claimed = []
	reward_claimed = []
	factions = {}
	tracked = ""
	sync()
	changed.emit()
