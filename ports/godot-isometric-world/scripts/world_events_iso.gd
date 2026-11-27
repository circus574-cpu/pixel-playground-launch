extends RefCounted
## Stage 4: 14 Dynamic World Events on Wilderness Roads (ported from quests.json["events"]).
## Wakes on proximity, spawns event raiders/props/hazards, exposes contextual interact & HUD banner,
## and dispatches server-authoritative `complete_world_event`.

var world: Node2D
var events_catalog: Array[Dictionary] = []
var region_events: Array[Dictionary] = [] # active/ready instances on current continent
var claimed_events: Dictionary = {} # eventId -> timestamp or true
var _active_event_id := ""

const EVENT_MECHANICS := {
	"event-verdant-trail-wolves": {"mode": "combat", "monster": "verdant-cierniowy-wilk", "count": 3, "prop": ""},
	"event-verdant-missing-courier": {"mode": "interact", "monster": "verdant-lisciak-skrytobojca", "count": 1, "prop": "courier", "action": "Uratuj kuriera"},
	"event-verdant-spore-hazard": {"mode": "interact", "monster": "verdant-grzybowy-zarodnik", "count": 2, "prop": "source", "action": "Oczyść źródło zarodników"},
	"event-verdant-contract-d01": {"mode": "combat", "monster": "verdant-mchowy-szlamak", "count": 3, "prop": ""},
	"event-verdant-convoy-pending": {"mode": "interact", "monster": "verdant-cierniowy-wilk", "count": 2, "prop": "cart", "action": "Zabezpiecz wóz konwoju"},
	"event-pyra-salamander-swarm": {"mode": "combat", "monster": "pyra-ognista-salamandra", "count": 3, "prop": ""},
	"event-pyra-ash-storm-hazard": {"mode": "interact", "monster": "pyra-plomien-duch", "count": 1, "prop": "sign", "action": "Rozpal latarnię szlaku"},
	"event-pyra-contract-d07": {"mode": "combat", "monster": "pyra-skorpion-obsydianowy", "count": 3, "prop": ""},
	"event-aether-butterfly-prism": {"mode": "interact", "monster": "aether-krysztalowy-motyl", "count": 1, "prop": "mirror", "action": "Ustaw pryzmat luster"},
	"event-aether-puppet-ambush": {"mode": "combat", "monster": "aether-marionetka-rytualu", "count": 3, "prop": ""},
	"event-aether-contract-d04": {"mode": "combat", "monster": "aether-swietlik-pieczeci", "count": 3, "prop": ""},
	"event-nexus-drone-patrol": {"mode": "combat", "monster": "nexus-dron-zwiadowca", "count": 3, "prop": ""},
	"event-nexus-nanite-breach": {"mode": "interact", "monster": "nexus-roj-nanitow", "count": 2, "prop": "pylon", "action": "Zamknij wyrwę nanitów"},
	"event-nexus-contract-d02": {"mode": "combat", "monster": "nexus-pelzacz-serwisowy", "count": 3, "prop": ""},
}

func setup(w: Node2D) -> void:
	world = w
	load_catalog()

func load_catalog() -> void:
	events_catalog.clear()
	if not FileAccess.file_exists("res://data/quests.json"):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/quests.json"))
	if parsed is Dictionary:
		var evs: Variant = (parsed as Dictionary).get("events", [])
		if evs is Array:
			for e: Variant in evs:
				if e is Dictionary:
					events_catalog.append(e as Dictionary)

func apply_server_state(st: Dictionary) -> void:
	var prog: Dictionary = st.get("progress", {}) if st.get("progress") is Dictionary else {}
	var ce: Variant = prog.get("claimedEvents", st.get("claimedEvents", {}))
	if ce is Dictionary:
		for k: String in (ce as Dictionary).keys():
			claimed_events[k] = true

func clear_region() -> void:
	for re: Dictionary in region_events:
		var nd = re.get("beacon_node", null)
		if is_instance_valid(nd):
			nd.queue_free()
	region_events.clear()
	_active_event_id = ""

func build_for_region(land: String) -> void:
	clear_region()
	if world == null:
		return
	var matching: Array[Dictionary] = []
	for e: Dictionary in events_catalog:
		if str(e.get("continent", "")) == land:
			matching.append(e)
	if matching.is_empty():
		return

	# Place each event deterministically along outer exp_zones or wilderness roads outside capital
	var anchors: Array[Vector2] = []
	for ez: Dictionary in world.exp_zones:
		var p := Vector2(float(ez.get("x", 0.0)), float(ez.get("z", 0.0)))
		if p.distance_to(world.capital_center) > world.safe_city_radius + 140.0 and world.is_walkable(p.x, p.y):
			anchors.append(p)
	for rd: Dictionary in world.roads:
		var pts: Array = rd.get("pts", [])
		if pts.size() >= 3:
			var mid_pt: Array = pts[int(pts.size() / 2)]
			var p2 := Vector2(float(mid_pt[0]), float(mid_pt[1]))
			if p2.distance_to(world.capital_center) > world.safe_city_radius + 160.0 and world.is_walkable(p2.x, p2.y):
				anchors.append(p2)

	for i in matching.size():
		var e: Dictionary = matching[i]
		var eid := str(e.get("id", ""))
		var cap_c: Vector2 = world.capital_center
		var pos: Vector2 = cap_c + Vector2(360.0 + float(i) * 140.0, 260.0)
		if not anchors.is_empty():
			pos = anchors[(i * 2 + 1) % anchors.size()]
		var mech: Dictionary = EVENT_MECHANICS.get(eid, {"mode": "combat", "monster": "", "count": 2, "prop": ""})
		var beacon := _spawn_event_beacon(pos, str(e.get("name", eid)), str(mech.get("prop", "")))
		region_events.append({
			"id": eid,
			"data": e,
			"mech": mech,
			"pos": pos,
			"state": "dormant", # dormant | active | completed
			"cooldown": 0.0,
			"spawned_ids": [],
			"kills_done": 0,
			"kills_need": int(mech.get("count", 2)),
			"interacted": false,
			"beacon_node": beacon,
		})

func _spawn_event_beacon(pos: Vector2, title: String, prop_kind: String) -> Node2D:
	var nd := Node2D.new()
	nd.position = world.iso(pos.x, pos.y, world.height_at(pos.x, pos.y))
	var sp_path := "res://assets/library/props/prop_runic_obelisk.webp"
	if prop_kind == "cart" or prop_kind == "courier":
		sp_path = "res://assets/library/props/prop_guardian_statue.webp"
	elif prop_kind == "sign" or prop_kind == "mirror":
		sp_path = "res://assets/biomes/verdant_sakura_lantern.webp"
	var sp: Sprite2D = world.make_fitted_sprite(sp_path, 195.0, 230.0, 0.88)
	sp.modulate = Color(1.0, 0.88, 0.42, 0.95)
	nd.add_child(sp)
	var lbl := Label.new()
	lbl.name = "EvLbl"
	lbl.text = "⚡ ZDARZENIE: %s" % title
	lbl.position = Vector2(-230, -162)
	lbl.size = Vector2(460, 28)
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.add_theme_font_override("font", world.MapStyle.body_font())
	lbl.add_theme_font_size_override("font_size", 16)
	lbl.add_theme_color_override("font_color", Color(1.0, 0.86, 0.34))
	lbl.add_theme_color_override("font_outline_color", Color(0.05, 0.02, 0.01, 0.98))
	lbl.add_theme_constant_override("outline_size", 6)
	nd.add_child(lbl)
	world.ysort.add_child(nd)
	return nd

func step(delta: float) -> void:
	if world == null or region_events.is_empty():
		return
	var hpos: Vector2 = world.hero_pos
	for re: Dictionary in region_events:
		var st := str(re.get("state", "dormant"))
		if st == "completed":
			re["cooldown"] = maxf(0.0, float(re.get("cooldown", 0.0)) - delta)
			if float(re["cooldown"]) <= 0.0:
				re["state"] = "dormant"
				re["kills_done"] = 0
				re["interacted"] = false
				var bnd = re.get("beacon_node", null)
				if is_instance_valid(bnd):
					bnd.modulate = Color.WHITE
			continue
		var dist: float = hpos.distance_to(re["pos"] as Vector2)
		if st == "dormant" and dist <= 135.0:
			_wake_event(re)
		elif st == "active":
			if dist <= 220.0:
				_active_event_id = str(re["id"])
			elif _active_event_id == str(re["id"]):
				_active_event_id = ""

func _wake_event(re: Dictionary) -> void:
	re["state"] = "active"
	var eid := str(re["id"])
	_active_event_id = eid
	var ev: Dictionary = re["data"]
	var mech: Dictionary = re["mech"]
	var pos: Vector2 = re["pos"]
	var spawned: Array = []
	var mk := str(mech.get("monster", ""))
	var cnt := int(mech.get("count", 2))
	if not mk.is_empty() and world.boss_ai != null:
		for _i in cnt:
			var mid: String = world.boss_ai._spawn_minion(mk, pos, "")
			if not mid.is_empty():
				spawned.append(mid)
	re["spawned_ids"] = spawned
	re["kills_need"] = maxi(1, spawned.size())
	re["kills_done"] = 0
	if world.combat_vfx != null:
		world.combat_vfx.spawn_ki_burst(world.iso(pos.x, pos.y, world.height_at(pos.x, pos.y)), "legend", 160.0)
	world.show_combat_toast("⚡ ZDARZENIE ŚWIATA: %s!" % str(ev.get("name", eid)), Color(1.0, 0.86, 0.34))

func on_agent_killed(agent_id: String) -> void:
	for re: Dictionary in region_events:
		if str(re.get("state", "")) != "active":
			continue
		var sp_ids: Array = re.get("spawned_ids", [])
		if agent_id in sp_ids:
			sp_ids.erase(agent_id)
			re["kills_done"] = int(re.get("kills_done", 0)) + 1
			var mode := str((re["mech"] as Dictionary).get("mode", "combat"))
			if mode == "combat" and sp_ids.is_empty():
				complete_event(re)
			elif mode == "interact" and sp_ids.is_empty() and bool(re.get("interacted", false)):
				complete_event(re)

func get_nearest_interactable() -> Dictionary:
	if world == null:
		return {}
	for re: Dictionary in region_events:
		if str(re.get("state", "")) == "completed":
			continue
		var mech: Dictionary = re["mech"]
		if str(mech.get("mode", "combat")) != "interact":
			continue
		if bool(re.get("interacted", false)):
			continue
		if world.hero_pos.distance_to(re["pos"] as Vector2) <= 68.0:
			return re
	return {}

func interact_with_event(re: Dictionary) -> bool:
	if re.is_empty():
		return false
	if str(re.get("state", "")) == "dormant":
		_wake_event(re)
	re["interacted"] = true
	if world != null and world.hero != null and world.hero.has_method("play_action"):
		world.hero.play_action("interact", "victory", 0.55)
	complete_event(re)
	return true

func complete_event(re: Dictionary) -> void:
	if str(re.get("state", "")) == "completed":
		return
	var eid := str(re["id"])
	var ev: Dictionary = re["data"]
	re["state"] = "completed"
	re["cooldown"] = 300.0
	claimed_events[eid] = true
	if _active_event_id == eid:
		_active_event_id = ""
	var bnd = re.get("beacon_node", null)
	if is_instance_valid(bnd):
		bnd.modulate = Color(0.45, 0.78, 0.55, 0.55)
	var rew: Dictionary = ev.get("reward", {}) if ev.get("reward") is Dictionary else {}
	var rxp := int(rew.get("xp", 140))
	var rgold := int(rew.get("gold", 65))
	if world != null:
		if world.audio != null:
			world.audio.sfx("ui/chest", 0.90, 0.04)
		if world.is_server_authoritative():
			world.dispatch_server_action({
				"type": "complete_world_event",
				"eventId": eid,
				"land": world.current_land,
			}, func(res: Dictionary) -> void:
				world.show_combat_toast(str(res.get("notice", "★ Ukończono zdarzenie świata!")), Color(0.42, 0.98, 0.68))
			)
		else:
			if world.rpg_hud != null:
				world.rpg_hud.hero_gold += rgold
				if world.rpg_hud.has_method("grant_local_xp"):
					world.rpg_hud.grant_local_xp(rxp)
				else:
					world.rpg_hud._refresh_visuals()
			world.show_combat_toast("★ ZDARZENIE UKOŃCZONE: %s (+%d PD, +%d zł)!" % [str(ev.get("name", eid)), rxp, rgold], Color(0.42, 0.98, 0.68))

func get_active_event_hud() -> Dictionary:
	for re: Dictionary in region_events:
		if str(re.get("state", "")) == "active" and (str(re["id"]) == _active_event_id or (world != null and world.hero_pos.distance_to(re["pos"] as Vector2) <= 210.0)):
			var ev: Dictionary = re["data"]
			var mech: Dictionary = re["mech"]
			var mode := str(mech.get("mode", "combat"))
			var prog := "Pokonaj zagrożenie: %d/%d" % [int(re.get("kills_done", 0)), int(re.get("kills_need", 1))] if mode == "combat" else ("%s [F]" % str(mech.get("action", "Zbadaj miejsce")))
			return {
				"id": str(re["id"]),
				"name": str(ev.get("name", "")),
				"desc": str(ev.get("description", "")),
				"progress": prog,
				"pos": re["pos"],
			}
	return {}
