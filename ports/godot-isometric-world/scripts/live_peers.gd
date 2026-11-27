extends Node
## Remote actors are presentation-only and stay outside live_agents (AI, collision and rewards).

const Actor := preload("res://scripts/actor_view.gd")
const MAX_PEERS := 24
const SNAP_DISTANCE := 125.0
const DIR_VEC := {
	"right": Vector2(1.0, 0.0),
	"down-right": Vector2(0.7, 0.7),
	"down": Vector2(0.0, 1.0),
	"down-left": Vector2(-0.7, 0.7),
	"left": Vector2(-1.0, 0.0),
	"up-left": Vector2(-0.7, -0.7),
	"up": Vector2(0.0, -1.0),
	"up-right": Vector2(0.7, -0.7),
}

var world: Node2D
var actors := {}
var friend_nicks := {} # lowercase nick -> true
var _art_by_race := {}

func set_friends(accepted_list: Array) -> void:
	friend_nicks.clear()
	for entry: Variant in accepted_list:
		if entry is Dictionary:
			var n := str((entry as Dictionary).get("nick", "")).to_lower()
			if not n.is_empty():
				friend_nicks[n] = true
	for entry: Dictionary in actors.values():
		_apply_nameplate_color(entry)

func _apply_nameplate_color(entry: Dictionary) -> void:
	var actor: Node2D = entry["actor"]
	if not is_instance_valid(actor):
		return
	if bool(entry.get("gm", false)):
		actor.label.add_theme_color_override("font_color", Color("ffe87a"))
		return
	var in_party := bool(entry.get("in_party", false))
	var is_friend := friend_nicks.has(str(entry.get("nick", "")).to_lower())
	var col := Color("72ff9e") if in_party else (Color("ffe27a") if is_friend else Color("92edfb"))
	actor.label.add_theme_color_override("font_color", col)

func accept(frame: Dictionary) -> void:
	if str(frame.get("land", "")) != world.current_land or world.in_labyrinth or world.in_interior:
		clear()
		return
	var seen := {}
	var list: Array = frame.get("peers", [])
	for row: Variant in list.slice(0, MAX_PEERS):
		if not row is Dictionary:
			continue
		var peer: Dictionary = row
		var id := str(peer.get("id", ""))
		var at := Vector2(float(peer.get("x", 0.0)), float(peer.get("y", 0.0)))
		if id.is_empty() or not at.is_finite():
			continue
		seen[id] = true
		var current: Dictionary = actors.get(id, {})
		var race := str(peer.get("race", ""))
		var is_gm: bool = bool(peer.get("gm", false)) and bool(world.actors_db.has("gm.hero"))
		var avatar_key := "gm" if is_gm else race
		if not current.is_empty() and str(current.get("avatar_key", "")) != avatar_key:
			_remove(id)
			current = {}
		if current.is_empty():
			current = _add(id, race, at, is_gm)
			if current.is_empty():
				continue
		var actor: Node2D = current["actor"]
		var nick := str(peer.get("nick", ""))
		var char_name := str(peer.get("name", ""))
		var disp := char_name if not char_name.is_empty() else nick
		if is_gm:
			disp = "✦ [GM] %s" % disp
		var gtag := str(peer.get("guildTag", ""))
		var lv := int(peer.get("level", 1))
		actor.label.text = ("%s · Poz. %d\n<%s>" % [disp, lv, gtag]) if not gtag.is_empty() else ("%s · Poz. %d" % [disp, lv])
		var dy: float = float(actor.display.y) if actor.get("display") is Vector2 else 110.0
		var base_ly := -dy - (54.0 if not gtag.is_empty() else 36.0)
		actor._base_label_y = base_ly
		var lift_p: float = float(actor.get_gm_lift_px()) if actor.has_method("get_gm_lift_px") else 0.0
		actor.label.position = Vector2(-260, base_ly - lift_p)
		current["nick"] = nick
		current["in_party"] = bool(peer.get("inParty", false))
		current["gm"] = is_gm
		_apply_nameplate_color(current)
		actor.direction = Actor.DIRECTIONS[clampi(int(peer.get("f", 2)), 0, 7)]
		var transformed := bool(peer.get("ki", false))
		if bool(actor.ki_mode_active) != transformed:
			actor.set_ki_mode(transformed)
		if is_gm:
			var want_fly := bool(peer.get("fly", false))
			var want_boost := bool(peer.get("boost", false))
			if bool(actor.gm_flying) != want_fly:
				actor.set_gm_flight(want_fly, false)
				if world != null and world.get("combat_vfx") != null:
					if want_fly and world.combat_vfx.has_method("spawn_gm_liftoff"):
						world.combat_vfx.spawn_gm_liftoff(actor.position)
					elif not want_fly and world.combat_vfx.has_method("spawn_gm_land"):
						world.combat_vfx.spawn_gm_land(actor.position)
			if bool(actor.gm_boost) != want_boost:
				actor.set_gm_boost(want_boost)
				if want_boost and world != null and world.get("combat_vfx") != null and world.combat_vfx.has_method("spawn_gm_boost_burst"):
					world.combat_vfx.spawn_gm_boost_burst(actor.position, float(actor.get_gm_lift_px()))
		var pose := str(peer.get("pose", "idle"))
		var action := int(peer.get("action", 0))
		if action > 0 and action != int(current["action"]) and Actor.ONE_SHOT_CLIPS.has(pose):
			actor.play_action(pose, "idle")
			current["action"] = action
			_spawn_peer_vfx(actor, "gm" if is_gm else race, pose)
		elif Time.get_ticks_msec() / 1000.0 >= float(actor.one_shot_until):
			if is_gm and bool(actor.gm_flying):
				actor.play_clip(pose if pose in ["hover", "glide"] else "hover")
			else:
				actor.play_clip(pose if pose in ["walk", "run"] else "idle")
		current["target"] = at
	for id: String in actors.keys():
		if not seen.has(id):
			_remove(id)

func _spawn_peer_vfx(actor: Node2D, race: String, pose: String) -> void:
	if world == null or world.get("combat_vfx") == null:
		return
	var vfx = world.combat_vfx
	var dir_v: Vector2 = DIR_VEC.get(str(actor.direction), Vector2(0.7, 0.7)) as Vector2
	if pose == "heavy_strike" and vfx.has_method("spawn_gm_heavy_strike"):
		vfx.spawn_gm_heavy_strike(actor.position, dir_v)
	elif pose == "ki_blast" and vfx.has_method("spawn_gm_ki_blast"):
		var lift_p: float = float(actor.get_gm_lift_px()) if actor.has_method("get_gm_lift_px") else 0.0
		vfx.spawn_gm_ki_blast(actor.position, actor.position + dir_v * 185.0, lift_p)
	elif pose == "takeoff" and vfx.has_method("spawn_gm_liftoff"):
		vfx.spawn_gm_liftoff(actor.position)
	elif pose == "land" and vfx.has_method("spawn_gm_land"):
		vfx.spawn_gm_land(actor.position)
	elif pose in ["transform", "kitransform"]:
		if vfx.has_method("spawn_transform_pillar"):
			vfx.spawn_transform_pillar(actor.position, race)
	elif pose in ["skillc", "kiskillc", "sk_C1", "sk_C4", "sk_C9", "sk_A9", "sk_B9"]:
		if vfx.has_method("spawn_ki_burst"):
			vfx.spawn_ki_burst(actor.position, race, 125.0)
	elif pose in ["skillb", "kiskillb", "sk_B1", "sk_B4"]:
		if vfx.has_method("spawn_shield_dome"):
			vfx.spawn_shield_dome(actor.position, race)
	elif pose in ["attack", "attack2", "attack3", "finisher", "kiattack", "kiattack2", "kifinisher", "skill", "kiskill", "sk_A1", "sk_A4"]:
		if vfx.has_method("spawn_slash"):
			vfx.spawn_slash(actor.position, dir_v, race, 0.85, pose == "attack2")

func _add(id: String, race: String, at: Vector2, is_gm: bool = false) -> Dictionary:
	if actors.size() >= MAX_PEERS:
		return {}
	var def_key := "gm.hero" if is_gm else ""
	if def_key.is_empty():
		var land := str(world.RACE_TO_LAND.get(race, ""))
		var metadata: Array = world.HERO_ACTORS.get(land, [])
		if metadata.is_empty():
			return {}
		def_key = str(metadata[0])
	var definition: Dictionary = world.actors_db.get(def_key, {})
	if definition.is_empty():
		return {}
	var actor := Actor.new()
	var cache_key := "gm" if is_gm else race
	var art: Dictionary = _art_by_race.get(cache_key, {})
	if not art.is_empty():
		actor.frames = art["frames"]
		actor.built = art["built"]
	actor.setup(definition, "Gracz", false, true, "hero")
	if art.is_empty():
		_art_by_race[cache_key] = {"frames": actor.frames, "built": actor.built}
	actor.label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	actor.label.add_theme_color_override("font_color", Color("ffe87a") if is_gm else Color("92edfb"))
	actor.ki_race = "gm" if is_gm else race
	actor.is_gm_avatar = is_gm
	actor.scale = Vector2(0.45, 0.45)
	actor.position = _project(at)
	world.ysort.add_child(actor)
	var entry := {"actor": actor, "target": at, "shown": at, "action": 0, "race": race, "avatar_key": cache_key, "gm": is_gm, "nick": "", "in_party": false, "trail_t": 0.0, "last_pos": actor.position}
	actors[id] = entry
	return entry

func _project(at: Vector2) -> Vector2:
	return world.iso(at.x, at.y, world.height_at(at.x, at.y))

func _process(delta: float) -> void:
	if world.in_interior or world.in_labyrinth:
		if not actors.is_empty():
			clear()
		return
	var weight := 1.0 - exp(-14.0 * delta)
	for entry: Dictionary in actors.values():
		var actor: Node2D = entry["actor"]
		var point: Vector2 = entry["shown"]
		var target: Vector2 = entry["target"]
		entry["shown"] = target if point.distance_to(target) > SNAP_DISTANCE else point.lerp(target, weight)
		actor.position = _project(entry["shown"])
		if bool(entry.get("gm", false)) and (bool(actor.gm_flying) or bool(actor.gm_boost)) and world != null and world.get("combat_vfx") != null:
			entry["trail_t"] = float(entry.get("trail_t", 0.0)) + delta
			if float(entry["trail_t"]) >= 0.075:
				entry["trail_t"] = 0.0
				var lp: Vector2 = entry.get("last_pos", actor.position)
				if lp.distance_to(actor.position) > 8.0 and world.combat_vfx.has_method("spawn_gm_flight_trail"):
					world.combat_vfx.spawn_gm_flight_trail(lp, actor.position, float(actor.get_gm_lift_px()), bool(actor.gm_boost))
				entry["last_pos"] = actor.position

func pick(world_click: Vector2, radius: float = 54.0) -> String:
	var picked := ""
	var best := radius
	for id: String in actors:
		var actor: Node2D = actors[id]["actor"]
		var distance_to_actor := world_click.distance_to(actor.position + Vector2(0.0, -26.0))
		if distance_to_actor < best:
			best = distance_to_actor
			picked = id
	return picked

func show_bubble(frame: Dictionary) -> void:
	if frame.get("scope") != "local":
		return
	var entry: Dictionary = actors.get(str(frame.get("id", "")), {})
	if not entry.is_empty():
		entry["actor"].show_bubble(str(frame.get("text", "")), 4.0)

func _remove(id: String) -> void:
	var entry: Dictionary = actors[id]
	if is_instance_valid(entry["actor"]):
		entry["actor"].hide()
		entry["actor"].queue_free()
	actors.erase(id)

func clear() -> void:
	for id: String in actors.keys():
		_remove(id)
