extends RefCounted
## Stage 4: Canonical 102-Quest Multi-Step Engine + Faction Reputation + HUD Tracker.
## Loads res://data/quests.json, bridges all 28 canonical quest givers to isometric NPCs,
## tracks talk/combat/discover/visit/deliver objectives, and syncs with server `quest_accept`
## & `quest_sync_progress`.

var world: Node2D
var quests_by_id: Dictionary = {}
var playable_quests: Array[Dictionary] = []
var dialogues_by_npc: Dictionary = {}
var famous_places: Array[Dictionary] = []
var hidden_places: Array[Dictionary] = []

var active_quests: Dictionary = {}    # qid -> {"stage": int, "counts": Dictionary}
var completed_quests: Dictionary = {} # qid -> true
var tracked_ids: Array[String] = []
var factions: Dictionary = {"verdant": 0, "pyra": 0, "aether": 0, "nexus": 0}
var discovered_places: Dictionary = {}

# Map every canonical giverNpcId -> matching isometric NPC name fragment & fallback actor_id
const GIVER_ALIAS := {
	"npc-kaena": ["kaena", "pyra.npc.guide"],
	"npc-goro": ["goro", "pyra.npc.smith"],
	"npc-yumi": ["yumi", "pyra.npc.merchant"],
	"npc-rokan": ["rokan", "pyra.npc.hunter"],
	"npc-pyra-captain": ["tsubasa", "pyra.npc.steward"],
	"npc-pyra-smith-east": ["homura", "pyra.npc.alchemist"],
	"npc-pyra-warden-west": ["kazan", "pyra.npc.warden"],
	"npc-aira": ["aira", "verdant.npc.guide"],
	"npc-oren": ["oren", "verdant.npc.steward"],
	"npc-taro": ["taro", "verdant.npc.smith"],
	"npc-lina": ["lina", "verdant.npc.innkeeper"],
	"npc-mio": ["mio", "verdant.npc.merchant"],
	"npc-nela": ["nela", "verdant.npc.keeper"],
	"npc-ren": ["ren", "verdant.npc.hunter"],
	"npc-sora": ["sora", "aether.npc.guide"],
	"npc-enso": ["enso", "aether.npc.smith"],
	"npc-mei": ["mei", "aether.npc.merchant"],
	"npc-ishin": ["ishin", "aether.npc.hunter"],
	"npc-nari": ["kaede", "aether.npc.keeper"],
	"npc-aether-ferryman": ["hoshi", "aether.npc.steward"],
	"npc-aether-observer": ["tenzin", "aether.npc.warden"],
	"npc-lyra7": ["lyra-7", "nexus.npc.guide"],
	"npc-hef4": ["hef-4", "nexus.npc.smith"],
	"npc-mira2": ["mira-2", "nexus.npc.merchant"],
	"npc-axon": ["axon", "nexus.npc.hunter"],
	"npc-eko0": ["sola-6", "nexus.npc.innkeeper"],
	"npc-nexus-portmaster": ["vega-3", "nexus.npc.steward"],
	"npc-nexus-welder": ["aegis-1", "nexus.npc.warden"],
}

func setup(w: Node2D) -> void:
	world = w
	load_data()

func load_data() -> void:
	quests_by_id.clear()
	playable_quests.clear()
	dialogues_by_npc.clear()
	famous_places.clear()
	hidden_places.clear()
	if not FileAccess.file_exists("res://data/quests.json"):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/quests.json"))
	if not (parsed is Dictionary):
		return
	var d: Dictionary = parsed as Dictionary
	for q_v: Variant in d.get("quests", []):
		if not (q_v is Dictionary):
			continue
		var q: Dictionary = q_v as Dictionary
		if not bool(q.get("playableInCurrentRuntime", false)):
			continue
		var qid := str(q.get("id", ""))
		if qid.is_empty():
			continue
		quests_by_id[qid] = q
		playable_quests.append(q)
	for fp: Variant in d.get("famous", []):
		if fp is Dictionary:
			famous_places.append(fp as Dictionary)
	for hp: Variant in d.get("hidden", []):
		if hp is Dictionary:
			hidden_places.append(hp as Dictionary)
	var dlgs: Variant = d.get("dialogues", {})
	if dlgs is Dictionary:
		dialogues_by_npc = dlgs as Dictionary

func apply_server_state(st: Dictionary) -> void:
	var cq: Variant = st.get("completedQuests", {})
	if cq is Dictionary:
		for k: String in (cq as Dictionary).keys():
			completed_quests[k] = true
			active_quests.erase(k)
	var aq: Variant = st.get("activeQuests", {})
	if aq is Dictionary:
		for qid: String in (aq as Dictionary).keys():
			if completed_quests.has(qid) or not quests_by_id.has(qid):
				continue
			var entry: Variant = aq[qid]
			if entry is Dictionary:
				var ed: Dictionary = entry as Dictionary
				var raw_prog: Variant = ed.get("progress", ed.get("counts", {}))
				active_quests[qid] = {
					"stage": int(ed.get("stage", 0)),
					"counts": (raw_prog as Dictionary).duplicate(true) if raw_prog is Dictionary else {},
				}
				if not (qid in tracked_ids) and tracked_ids.size() < 3:
					tracked_ids.append(qid)
	var fac: Variant = st.get("factions", {})
	if fac is Dictionary:
		for fk: String in (fac as Dictionary).keys():
			factions[fk] = int(fac[fk])

func npc_matches_canonical(canon_npc_id: String, iso_actor_id: String, iso_name: String) -> bool:
	var low_id := iso_actor_id.to_lower()
	var low_name := iso_name.to_lower()
	var low_canon := canon_npc_id.to_lower()
	if low_canon == low_id or low_canon == low_name:
		return true
	var aliases: Array = GIVER_ALIAS.get(canon_npc_id, [])
	for al: String in aliases:
		if low_id == al or (al in low_name):
			return true
	return false

func _hero_level() -> int:
	if world != null and world.rpg_hud != null:
		return int(world.rpg_hud.hero_level)
	return 1

func is_quest_unlocked(q: Dictionary) -> bool:
	var qid := str(q.get("id", ""))
	if completed_quests.has(qid) or active_quests.has(qid):
		return false
	var cond: Dictionary = q.get("unlockCondition", {}) if q.get("unlockCondition") is Dictionary else {}
	var min_lv := int(cond.get("minLevel", q.get("recommendedLevel", 1)))
	if _hero_level() < min_lv:
		return false
	var prereqs: Variant = cond.get("prerequisiteQuestIds", [])
	if prereqs is Array:
		for pre: Variant in prereqs:
			if not completed_quests.has(str(pre)):
				return false
	return true

func _current_stage(qid: String) -> Dictionary:
	if not active_quests.has(qid) or not quests_by_id.has(qid):
		return {}
	var q: Dictionary = quests_by_id[qid]
	var stages: Array = q.get("stages", [])
	var st_i := int((active_quests[qid] as Dictionary).get("stage", 0))
	if st_i < 0 or st_i >= stages.size():
		return {}
	return stages[st_i] as Dictionary

func is_stage_complete(qid: String) -> bool:
	var st := _current_stage(qid)
	if st.is_empty():
		return false
	var counts: Dictionary = (active_quests[qid] as Dictionary).get("counts", {})
	for ob: Dictionary in st.get("objectives", []):
		var oid := str(ob.get("id", ""))
		var need := maxi(1, int(ob.get("targetCount", 1)))
		if int(counts.get(oid, 0)) < need:
			return false
	return true

func is_quest_ready_to_turn_in(qid: String) -> bool:
	if not active_quests.has(qid) or not quests_by_id.has(qid):
		return false
	var q: Dictionary = quests_by_id[qid]
	var stages: Array = q.get("stages", [])
	var st_i := int((active_quests[qid] as Dictionary).get("stage", 0))
	return st_i >= stages.size() - 1 and is_stage_complete(qid)

func accept_quest(qid: String) -> bool:
	if not quests_by_id.has(qid) or active_quests.has(qid) or completed_quests.has(qid):
		return false
	var q: Dictionary = quests_by_id[qid]
	if not is_quest_unlocked(q):
		return false
	active_quests[qid] = {"stage": 0, "counts": {}}
	if not (qid in tracked_ids):
		if tracked_ids.size() >= 3:
			tracked_ids.pop_front()
		tracked_ids.append(qid)
	# Auto-satisfy opening "talk to giver" step if we just accepted it from them!
	_advance_talk_step(qid, str(q.get("giverNpcId", "")), str(q.get("giverName", "")))
	if world != null:
		if world.is_server_authoritative():
			world.dispatch_server_action({"type": "quest_accept", "questId": qid})
		world.show_combat_toast("📜 Przyjęto zadanie: %s" % str(q.get("title", qid)), Color(1.0, 0.88, 0.36))
		if world.audio != null:
			world.audio.sfx("ui/open", 0.85, 0.04)
		_refresh_npc_markers()
	return true

func _advance_talk_step(qid: String, npc_id: String, npc_name: String) -> bool:
	if not active_quests.has(qid):
		return false
	var st := _current_stage(qid)
	if st.is_empty():
		return false
	var counts: Dictionary = (active_quests[qid] as Dictionary).get("counts", {})
	var changed := false
	for ob: Dictionary in st.get("objectives", []):
		var otype := str(ob.get("type", ""))
		if otype != "talk" and otype != "deliver":
			continue
		var oid := str(ob.get("id", ""))
		var need := maxi(1, int(ob.get("targetCount", 1)))
		if int(counts.get(oid, 0)) >= need:
			continue
		var tid := str(ob.get("targetId", ""))
		if tid.is_empty() or npc_matches_canonical(tid, npc_id, npc_name):
			counts[oid] = need
			changed = true
	if changed:
		_check_stage_progression(qid)
	return changed

func on_talk_to_npc(iso_actor_id: String, iso_name: String) -> Array[String]:
	var advanced: Array[String] = []
	for qid: String in active_quests.keys():
		if _advance_talk_step(qid, iso_actor_id, iso_name):
			advanced.append(qid)
	if not advanced.is_empty():
		_refresh_npc_markers()
	return advanced

func on_monster_killed(actor_id: String, land: String) -> void:
	if actor_id.is_empty():
		return
	var any_changed := false
	for qid: String in active_quests.keys():
		var st := _current_stage(qid)
		if st.is_empty():
			continue
		var counts: Dictionary = (active_quests[qid] as Dictionary).get("counts", {})
		var changed := false
		for ob: Dictionary in st.get("objectives", []):
			if str(ob.get("type", "")) != "combat":
				continue
			var oid := str(ob.get("id", ""))
			var need := maxi(1, int(ob.get("targetCount", 1)))
			if int(counts.get(oid, 0)) >= need:
				continue
			var tid := str(ob.get("targetId", ""))
			var ob_cont := str(ob.get("continent", ""))
			if tid == actor_id or (tid.is_empty() and (ob_cont.is_empty() or ob_cont == land)):
				counts[oid] = mini(need, int(counts.get(oid, 0)) + 1)
				changed = true
				if world != null:
					world.show_combat_toast("📜 %s (%d/%d)" % [str(ob.get("description", tid)), int(counts[oid]), need], Color(0.76, 0.94, 1.0))
		if changed:
			any_changed = true
			_check_stage_progression(qid)
	if any_changed:
		_refresh_npc_markers()

func on_hero_position(pos: Vector2, land: String) -> void:
	if world == null or active_quests.is_empty():
		return
	var any_changed := false
	for qid: String in active_quests.keys():
		var st := _current_stage(qid)
		if st.is_empty():
			continue
		var counts: Dictionary = (active_quests[qid] as Dictionary).get("counts", {})
		var changed := false
		for ob: Dictionary in st.get("objectives", []):
			var otype := str(ob.get("type", ""))
			if otype != "discover" and otype != "visit":
				continue
			var ob_cont := str(ob.get("continent", ""))
			if not ob_cont.is_empty() and ob_cont != land:
				continue
			var oid := str(ob.get("id", ""))
			var need := maxi(1, int(ob.get("targetCount", 1)))
			if int(counts.get(oid, 0)) >= need:
				continue
			var target_p := _resolve_objective_world_pos(ob, land)
			if pos.distance_to(target_p) <= 135.0:
				counts[oid] = need
				changed = true
				discovered_places[str(ob.get("targetId", oid))] = true
				world.show_combat_toast("✦ Odkryto: %s!" % str(ob.get("description", "Lokacja")), Color(0.46, 0.98, 0.82))
		if changed:
			any_changed = true
			_check_stage_progression(qid)
	if any_changed:
		_refresh_npc_markers()

func _resolve_objective_world_pos(ob: Dictionary, _land: String) -> Vector2:
	# Map legacy pyra coordinates (0..4000) cleanly onto isometric 4096×4096 continent landmarks/roads
	var coords: Variant = ob.get("coordinates", {})
	if coords is Dictionary:
		var cx := float((coords as Dictionary).get("x", 2048.0))
		var cy := float((coords as Dictionary).get("y", 2048.0))
		return Vector2(clampf(cx, 200.0, world.world_size - 200.0), clampf(cy, 200.0, world.world_size - 200.0))
	return world.capital_center

func _check_stage_progression(qid: String) -> void:
	if not active_quests.has(qid) or not quests_by_id.has(qid):
		return
	var q: Dictionary = quests_by_id[qid]
	var stages: Array = q.get("stages", [])
	var aq: Dictionary = active_quests[qid]
	var st_i := int(aq.get("stage", 0))
	while st_i < stages.size() - 1 and is_stage_complete(qid):
		st_i += 1
		aq["stage"] = st_i
		var next_st: Dictionary = stages[st_i]
		if world != null:
			world.show_combat_toast("📜 Nowy etap zadania: %s" % str(next_st.get("title", "")), Color(0.96, 0.88, 0.42))
	if world != null and world.is_server_authoritative():
		world.dispatch_server_action({
			"type": "quest_sync_progress",
			"questId": qid,
			"stage": int(aq.get("stage", 0)),
			"progress": aq.get("counts", {}),
			"complete": false,
		})

func complete_quest(qid: String) -> bool:
	if not active_quests.has(qid) or not quests_by_id.has(qid):
		return false
	var q: Dictionary = quests_by_id[qid]
	var aq: Dictionary = active_quests[qid]
	var cont := str(q.get("continent", "pyra"))
	var rew: Dictionary = q.get("rewards", {}) if q.get("rewards") is Dictionary else {}
	var rxp := int(rew.get("xp", 120))
	var rgold := int(rew.get("gold", 55))
	var rep := int(rew.get("reputation", 25))
	completed_quests[qid] = true
	active_quests.erase(qid)
	tracked_ids.erase(qid)
	factions[cont] = int(factions.get(cont, 0)) + rep

	if world != null:
		if world.audio != null:
			world.audio.sfx("ui/chest", 0.92, 0.04)
		if world.is_server_authoritative():
			world.dispatch_server_action({
				"type": "quest_sync_progress",
				"questId": qid,
				"stage": int(aq.get("stage", 0)),
				"progress": aq.get("counts", {}),
				"complete": true,
			}, func(res: Dictionary) -> void:
				world.show_combat_toast(str(res.get("notice", "★ Ukończono zadanie!")), Color(0.42, 0.98, 0.68))
			)
		else:
			if world.rpg_hud != null:
				world.rpg_hud.hero_gold += rgold
				if world.rpg_hud.has_method("grant_local_xp"):
					world.rpg_hud.grant_local_xp(rxp)
				else:
					world.rpg_hud._refresh_visuals()
			world.show_combat_toast("★ UKOŃCZONO ZADANIE: %s (+%d PD, +%d zł, +%d rep.)" % [str(q.get("title", qid)), rxp, rgold, rep], Color(0.42, 0.98, 0.68))
		_refresh_npc_markers()
	return true

func quests_for_npc(iso_actor_id: String, iso_name: String, land: String) -> Dictionary:
	var turn_in: Array[Dictionary] = []
	var talk_step: Array[Dictionary] = []
	var available: Array[Dictionary] = []
	for qid: String in active_quests.keys():
		if not quests_by_id.has(qid):
			continue
		var q: Dictionary = quests_by_id[qid]
		var giver := str(q.get("giverNpcId", ""))
		if is_quest_ready_to_turn_in(qid) and npc_matches_canonical(giver, iso_actor_id, iso_name):
			turn_in.append(q)
		else:
			var st := _current_stage(qid)
			for ob: Dictionary in st.get("objectives", []):
				var ot := str(ob.get("type", ""))
				if (ot == "talk" or ot == "deliver") and npc_matches_canonical(str(ob.get("targetId", "")), iso_actor_id, iso_name):
					talk_step.append(q)
					break
	for q: Dictionary in playable_quests:
		if str(q.get("continent", "")) != land:
			continue
		if not is_quest_unlocked(q):
			continue
		if npc_matches_canonical(str(q.get("giverNpcId", "")), iso_actor_id, iso_name):
			available.append(q)
			if available.size() >= 5:
				break
	return {"turn_in": turn_in, "talk_step": talk_step, "available": available}

func marker_for_npc(iso_actor_id: String, iso_name: String, land: String) -> String:
	var bundle := quests_for_npc(iso_actor_id, iso_name, land)
	if not (bundle["turn_in"] as Array).is_empty():
		return "?"
	if not (bundle["talk_step"] as Array).is_empty():
		return "?"
	if not (bundle["available"] as Array).is_empty():
		return "!"
	return ""

func _refresh_npc_markers() -> void:
	if world == null:
		return
	for ag: Dictionary in world.live_agents:
		if str(ag.get("kind", "")) != "npc":
			continue
		var mk := marker_for_npc(str(ag.get("id", "")), str(ag.get("name", "")), world.current_land)
		ag["quest_mark"] = mk
		var nd = ag.get("node", null)
		if is_instance_valid(nd):
			nd.quest_mark = mk
			nd.queue_redraw()
	if world.rpg_hud != null and world.rpg_hud.has_method("_refresh_visuals"):
		world.rpg_hud._refresh_visuals()

func toggle_track(qid: String) -> void:
	if qid in tracked_ids:
		tracked_ids.erase(qid)
	else:
		if tracked_ids.size() >= 3:
			tracked_ids.pop_front()
		tracked_ids.append(qid)
	if world != null and world.rpg_hud != null and world.rpg_hud.has_method("_refresh_visuals"):
		world.rpg_hud._refresh_visuals()

func is_tracked(qid: String) -> bool:
	return qid in tracked_ids

func get_tracker_entries() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	var order: Array[String] = []
	for tid: String in tracked_ids:
		if active_quests.has(tid):
			order.append(tid)
	for aid: String in active_quests.keys():
		if not (aid in order) and order.size() < 3:
			order.append(aid)
	for qid: String in order:
		if not quests_by_id.has(qid):
			continue
		var q: Dictionary = quests_by_id[qid]
		var st := _current_stage(qid)
		var counts: Dictionary = (active_quests[qid] as Dictionary).get("counts", {})
		var lines: Array[String] = []
		var ready := is_quest_ready_to_turn_in(qid)
		if ready:
			lines.append("✓ Wróć do: %s" % str(q.get("giverName", "Zleceniodawca")))
		else:
			for ob: Dictionary in st.get("objectives", []):
				var oid := str(ob.get("id", ""))
				var need := maxi(1, int(ob.get("targetCount", 1)))
				var cur := mini(need, int(counts.get(oid, 0)))
				var mark := "✓ " if cur >= need else "• "
				lines.append("%s%s (%d/%d)" % [mark, str(ob.get("description", "")), cur, need])
		out.append({
			"id": qid,
			"title": str(q.get("title", qid)),
			"continent": str(q.get("continent", "")),
			"ready": ready,
			"lines": lines,
		})
	return out

func get_journal_lists(land: String) -> Dictionary:
	var active_arr: Array[Dictionary] = []
	var avail_arr: Array[Dictionary] = []
	var done_arr: Array[Dictionary] = []
	for q: Dictionary in playable_quests:
		var qid := str(q.get("id", ""))
		if active_quests.has(qid):
			active_arr.append(q)
		elif completed_quests.has(qid):
			done_arr.append(q)
		elif str(q.get("continent", "")) == land and is_quest_unlocked(q):
			avail_arr.append(q)
	return {
		"active": active_arr,
		"available": avail_arr,
		"completed": done_arr,
		"factions": factions.duplicate(true),
		"total_playable": playable_quests.size(),
	}
