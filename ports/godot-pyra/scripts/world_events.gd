class_name PyraWorldEvents
extends Node
## The 14 world events of the browser catalogue (`ALL_WORLD_EVENTS_V2`: name, minimum level, radius, repeatability, reward). The
## browser only grants their reward and never stages them (no places, no creatures); here each one is played where the hero walks:
## it wakes when he comes near its place on the road between the cities, brings its creatures, hazard clouds and things to do
## (free a courier, restore trail marks, secure signal mirrors, calibrate pylons, neutralise a spore source), pays its reward once
## it is done and then rests (cooldown 300 s, renewable contracts 600 s; "once" events never return). Places, creature lists and
## the sequence are authored for the port.

const RULES := {
	"event-verdant-trail-wolves": {"monsters": [["verdant-cierniowy-wilk", 3]]},
	"event-verdant-missing-courier": {"monsters": [["verdant-lesny-pajak", 1]], "props": [{"kind": "courier", "name": "Posłaniec Neli", "title": "Uwolnij posłańca", "after_kills": true}]},
	"event-verdant-spore-hazard": {"zone": {"kind": "poison", "dps": 0.08, "fx": [{"k": "dot", "id": "poison", "atkPct": 0.06, "ms": 3000}]}, "props": [{"kind": "source", "name": "Źródło zarodników", "title": "Zneutralizuj źródło", "after_kills": false}]},
	"event-verdant-contract-d01": {"monsters": [["verdant-mchowy-szlamak", 3]], "props": [{"kind": "sign", "name": "Znak szlaku", "title": "Odnów znak", "after_kills": true, "count": 3}]},
	"event-verdant-convoy-pending": {"monsters": [["verdant-cierniowy-wilk", 3]], "convoy": true},
	"event-pyra-salamander-swarm": {"monsters": [["pyra-ognista-salamandra", 4]]},
	"event-pyra-ash-storm-hazard": {"zone": {"kind": "ash", "dps": 0.06, "fx": []}, "monsters": [["pyra-popielny-wilk", 2], ["pyra-plomien-duch", 1]]},
	"event-pyra-contract-d07": {"monsters": [["pyra-popielny-wilk", 2], ["pyra-wegielek", 2]]},
	"event-aether-butterfly-prism": {"monsters": [["aether-krysztalowy-motyl", 4]]},
	"event-aether-puppet-ambush": {"monsters": [["aether-marionetka-rytualu", 3]]},
	"event-aether-contract-d04": {"monsters": [["aether-pergaminowy-straznik", 3]], "props": [{"kind": "mirror", "name": "Lustro sygnałowe", "title": "Zabezpiecz odczyt", "after_kills": false, "count": 2}]},
	"event-nexus-drone-patrol": {"monsters": [["nexus-dron-zwiadowca", 3]]},
	"event-nexus-nanite-breach": {"zone": {"kind": "nanite", "dps": 0.05, "fx": [{"k": "armorDown", "pct": 0.3, "ms": 3000}]}, "monsters": [["nexus-roj-nanitow", 3]]},
	"event-nexus-contract-d02": {"monsters": [["nexus-wiezyczka-autonomiczna", 2]], "props": [{"kind": "pylon", "name": "Pylon", "title": "Skalibruj pylon", "after_kills": true, "count": 2}]},
}
const WAKE := 800.0
const SLEEP := 2600.0
const COOLDOWN := 300.0
const CONTRACT_COOLDOWN := 600.0

var game: PyraGame
var list: Array[Dictionary] = []            # the land's events, each with an anchor and a runtime state
var claimed: Array[String] = []             # "once" events already done (saved)
var timer := 0.0
var clock := 0.0

func setup(owner_game: PyraGame, events: Array, anchors: Array) -> void:
	game = owner_game
	clear()
	list = []
	for i in events.size():
		var def: Dictionary = events[i]
		if not RULES.has(str(def.id)):
			continue
		list.append({"def": def, "anchor": anchors[i], "state": "idle", "cooldown_until": 0.0, "monsters": [], "props": [], "zone": null})

func clear() -> void:
	for ev in list:
		sleep_event(ev)

func _process(delta: float) -> void:
	clock += delta
	timer -= delta
	if timer > 0.0 or game == null or not game.current_room.is_empty() or game.kit.dead:
		return
	timer = 0.5
	var hero := game.player.position
	for ev in list:
		var anchor: Vector2 = ev.anchor
		var distance := hero.distance_to(anchor)
		match str(ev.state):
			"idle":
				if distance <= WAKE and can_start(ev):
					start(ev)
			"active":
				if distance > SLEEP:
					sleep_event(ev)
				elif is_complete(ev):
					finish(ev)

func can_start(ev: Dictionary) -> bool:
	var def: Dictionary = ev.def
	if clock < float(ev.cooldown_until) or game.kit.level < int(def.minLevel):
		return false
	return not (str(def.repeatability) == "once" and claimed.has(str(def.id)))

func start(ev: Dictionary) -> void:
	var def: Dictionary = ev.def
	var rule: Dictionary = RULES[str(def.id)]
	var anchor: Vector2 = ev.anchor
	ev.state = "active"
	game.hud.toast("Wydarzenie: %s" % def.name)
	game.audio.sfx("ui/quest-update")
	var power := 20.0 + 4.0 * float(def.minLevel)
	if rule.has("zone"):
		var zone_rule: Dictionary = (rule.zone as Dictionary).duplicate(true)
		zone_rule["ms"] = 99999999
		zone_rule["radius"] = float(def.radius) + 40.0
		ev.zone = game.monsters.add_zone(zone_rule, anchor, power)
	var index := 0
	for entry: Array in rule.get("monsters", []):
		for n in int(entry[1]):
			var angle := TAU * float(index) / maxf(1.0, float(total_monsters(rule))) + 0.4
			var at: Vector2 = game.open_ground(anchor + Vector2.from_angle(angle) * (float(def.radius) * 0.7))
			var monster: PyraMonster = game.monsters.place_monster(str(entry[0]), at)
			monster.home = anchor
			monster.no_reward = false
			(ev.monsters as Array).append(monster)
			index += 1
	for spec: Dictionary in rule.get("props", []):
		for n in int(spec.get("count", 1)):
			var prop := EventProp.new()
			var offset := Vector2.from_angle(TAU * float(n) / float(maxi(1, int(spec.get("count", 1)))) + 1.2) * (60.0 + 50.0 * n) if int(spec.get("count", 1)) > 1 else Vector2.ZERO
			prop.setup(spec, game.open_ground(anchor + offset))
			game.monster_parent().add_child(prop)
			(ev.props as Array).append(prop)
	if rule.get("convoy", false):
		var cart := EventProp.new()
		cart.setup({"kind": "cart", "name": "Konwój", "title": "", "after_kills": false, "ambient": true}, anchor)
		cart.path_from = anchor + Vector2(-380, 0)
		cart.path_to = anchor + Vector2(380, 0)
		game.monster_parent().add_child(cart)
		(ev.props as Array).append(cart)

func total_monsters(rule: Dictionary) -> int:
	var total := 0
	for entry: Array in rule.get("monsters", []):
		total += int(entry[1])
	return total

func kills_done(ev: Dictionary) -> bool:
	for m: Variant in ev.monsters:
		if is_instance_valid(m) and (m as PyraMonster).phase != "dead":
			return false
	return true

func is_complete(ev: Dictionary) -> bool:
	if not kills_done(ev):
		return false
	for prop: Variant in ev.props:
		if is_instance_valid(prop) and not (prop as EventProp).ambient and not (prop as EventProp).done:
			return false
	return true

func finish(ev: Dictionary) -> void:
	var def: Dictionary = ev.def
	var reward: Dictionary = def.reward
	var levels: int = game.kit.add_xp(int(reward.xp))
	game.economy.gold += int(reward.coins)
	var names: Array[String] = ["+%d XP" % int(reward.xp), "+%d mon." % int(reward.coins)]
	if reward.has("itemId") and game.economy.items.has(str(reward.itemId)) and game.economy.add_item(str(reward.itemId)):
		names.append(game.economy.name_of(str(reward.itemId)))
	game.economy.changed.emit()
	game.hud.toast("%s — ukończone! %s" % [def.name, " · ".join(names)])
	game.audio.sfx("common/quest-complete")
	if str(def.repeatability) == "once":
		claimed.append(str(def.id))
	ev.cooldown_until = clock + (CONTRACT_COOLDOWN if str(def.repeatability) == "renewable_contract" else COOLDOWN)
	sleep_event(ev)
	if levels > 0:
		game.hud.toast("Awans na poziom %d!" % game.kit.level)

## Takes the event's creatures, props and clouds off the map (it can start again later unless it is done for good).
func sleep_event(ev: Dictionary) -> void:
	for m: Variant in ev.monsters:
		if is_instance_valid(m):
			(m as Node).queue_free()
			if game != null and game.monsters != null:
				game.monsters.active.erase((m as PyraMonster).spawn_index)
	for p: Variant in ev.props:
		if is_instance_valid(p):
			(p as Node).queue_free()
	if is_instance_valid(ev.zone):
		(ev.zone as Node).queue_free()
	ev.monsters = []
	ev.props = []
	ev.zone = null
	ev.state = "idle"

## Things the hero can use right now (E): props whose conditions are met.
func targets() -> Array[Dictionary]:
	var found: Array[Dictionary] = []
	for ev in list:
		if str(ev.state) != "active":
			continue
		for p: Variant in ev.props:
			if not is_instance_valid(p):
				continue
			var prop := p as EventProp
			if prop.ambient or prop.done:
				continue
			if prop.after_kills and not kills_done(ev):
				continue
			found.append({"kind": "event", "id": str(ev.def.id), "name": prop.label_text, "title": prop.title_text, "point": prop.position, "prop": prop})
	return found

func use(target: Dictionary) -> void:
	var prop: EventProp = target.prop
	if prop == null or not is_instance_valid(prop) or prop.done:
		return
	prop.done = true
	game.audio.sfx("ui/quest-update")
	game.hud.toast("%s — gotowe." % prop.label_text)

func to_save() -> Dictionary:
	return {"claimed": claimed}

func from_save(value: Variant) -> void:
	claimed = []
	if value is Dictionary and (value as Dictionary).get("claimed", []) is Array:
		for id in (value as Dictionary).get("claimed", []):
			if id is String and not claimed.has(id):
				claimed.append(id)

## What stands in the world during an event: a courier in a tree, trail signs, mirrors, pylons, a spore source, a cart.
class EventProp extends Node2D:
	var kind := ""
	var label_text := ""
	var title_text := ""
	var after_kills := false
	var ambient := false
	var done := false
	var age := 0.0
	var path_from := Vector2.ZERO
	var path_to := Vector2.ZERO

	func setup(spec: Dictionary, at: Vector2) -> void:
		kind = str(spec.kind)
		label_text = str(spec.name)
		title_text = str(spec.get("title", ""))
		after_kills = bool(spec.get("after_kills", false))
		ambient = bool(spec.get("ambient", false))
		position = at

	func _process(delta: float) -> void:
		age += delta
		if kind == "cart" and path_from != path_to:
			position = path_from.lerp(path_to, 0.5 + 0.5 * sin(age * 0.12))
		queue_redraw()

	func _draw() -> void:
		var glow := 0.5 + 0.5 * sin(age * 3.0)
		var tone := Color(0.4, 0.4, 0.4) if done else Color(1.0, 0.85, 0.35)
		if not done and not ambient:
			draw_circle(Vector2.ZERO, 44.0 + 4.0 * glow, Color(tone.r, tone.g, tone.b, 0.16))
			draw_arc(Vector2.ZERO, 44.0, 0, TAU, 28, Color(tone.r, tone.g, tone.b, 0.8), 2.0, true)
		match kind:
			"courier":
				draw_circle(Vector2(0, -34), 9.0, Color(0.95, 0.8, 0.65))
				draw_rect(Rect2(-9, -26, 18, 26), Color(0.3, 0.55, 0.85) if not done else Color(0.35, 0.4, 0.5))
			"sign":
				draw_rect(Rect2(-3, -42, 6, 42), Color(0.45, 0.3, 0.18))
				draw_rect(Rect2(-18, -52, 36, 18), Color(0.85, 0.75, 0.45) if not done else Color(0.45, 0.45, 0.4))
			"mirror":
				draw_rect(Rect2(-14, -56, 28, 50), Color(0.7, 0.85, 1.0) if not done else Color(0.4, 0.45, 0.55), true)
				draw_rect(Rect2(-14, -56, 28, 50), Color(0.35, 0.4, 0.55), false, 3.0)
			"pylon":
				draw_rect(Rect2(-10, -70, 20, 70), Color(0.3, 0.45, 0.6) if not done else Color(0.3, 0.32, 0.36))
				draw_circle(Vector2(0, -76), 9.0 + 2.0 * glow, Color(0.4, 0.9, 1.0) if not done else Color(0.3, 0.35, 0.4))
			"source":
				draw_circle(Vector2(0, -16), 22.0, Color(0.5, 0.85, 0.3, 0.8) if not done else Color(0.35, 0.4, 0.3))
				for i in 6:
					draw_circle(Vector2.from_angle(age + i * 1.05) * 26.0 + Vector2(0, -16), 5.0, Color(0.7, 0.95, 0.4, 0.6))
			"cart":
				draw_rect(Rect2(-34, -34, 68, 28), Color(0.5, 0.33, 0.18))
				draw_circle(Vector2(-22, -4), 9.0, Color(0.2, 0.15, 0.1))
				draw_circle(Vector2(22, -4), 9.0, Color(0.2, 0.15, 0.1))
