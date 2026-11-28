extends Node
## Sound of the isometric world: continent soundtracks (crossfading), city/world ambience beds,
## 40 race skill SFX, per-monster SFX, footsteps & UI feedback with organic pitch variation.
## Searches OTA preview audio first (res://service_preview/pyra/assets/audio/) then host APK audio (res://assets/audio/).

const MUSIC := {
	"pyra": "pyra",
	"verdant": "verdantia",
	"aether": "aetheria",
	"nexus": "nexus",
	"loading": "loading_theme",
	"menu": "menu",
}
const HOST_ROOT := "res:" + "//assets/audio/"
const HOST_GM_ROOT := "res:" + "//assets/gm/sfx/"
const HOST_PREMIUM_ROOT := "res:" + "//assets/premium_sfx/"
const FADE := 1.4
const STEP_INTERVAL := 0.44
const POOL := 16

var music_volume := 0.45
var ambience_volume := 0.55
var sfx_volume := 0.80
var muted := false
var music_a := AudioStreamPlayer.new()
var music_b := AudioStreamPlayer.new()
var ambience := AudioStreamPlayer.new()
var gm_flight_loop := AudioStreamPlayer.new()
var gm_flight_gain := 0.0
var gm_flight_target := 0.0
var gm_flight_pitch := 1.0
var gm_flight_pitch_target := 1.0
var pool: Array[AudioStreamPlayer] = []
var cache: Dictionary = {}
var last_played: Dictionary = {}
var active_music := ""
var active_ambience := ""
var fading_in: AudioStreamPlayer
var fading_out: AudioStreamPlayer
var fade_t := 1.0
var step_clock := 0.0
var _step_alt := false
var _mon_atk_alt := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for p in [music_a, music_b, ambience, gm_flight_loop]:
		add_child(p)
	for i in POOL:
		var s := AudioStreamPlayer.new()
		add_child(s)
		pool.append(s)

func set_volumes(music_v: float, sfx_v: float, amb_v: float = -1.0) -> void:
	music_volume = clampf(music_v, 0.0, 1.0)
	sfx_volume = clampf(sfx_v, 0.0, 1.0)
	if amb_v >= 0.0:
		ambience_volume = clampf(amb_v, 0.0, 1.0)
	var mdb := music_db()
	if fading_in != null and fading_in.playing:
		fading_in.volume_db = mdb
	if ambience.playing:
		ambience.volume_db = ambience_db()
	if gm_flight_loop.playing:
		gm_flight_loop.volume_db = _gm_flight_db()

func set_muted(on: bool) -> void:
	muted = on
	if fading_in != null and fading_in.playing:
		fading_in.volume_db = music_db()
	if ambience.playing:
		ambience.volume_db = ambience_db()
	if gm_flight_loop.playing:
		gm_flight_loop.volume_db = _gm_flight_db()

func _gm_flight_db() -> float:
	if muted or sfx_volume <= 0.01 or gm_flight_gain <= 0.002:
		return -80.0
	return linear_to_db(maxf(sfx_volume * gm_flight_gain, 0.0001))

func _load_from(path: String) -> AudioStream:
	if ResourceLoader.exists(path):
		var s := load(path)
		if s is AudioStream:
			return s as AudioStream
	if FileAccess.file_exists(path) and path.ends_with(".mp3"):
		var bytes := FileAccess.get_file_as_bytes(path)
		if not bytes.is_empty():
			var mp3 := AudioStreamMP3.new()
			mp3.data = bytes
			return mp3
	return null

func load_stream(rel_path: String) -> AudioStream:
	if cache.has(rel_path):
		return cache[rel_path] as AudioStream
	# Bespoke GameMaster SFX live in assets/gm/sfx/ (ships in core-c101, relocated automatically in OTA preview)
	if rel_path.begins_with("sfx/gm/"):
		var gm_file := rel_path.trim_prefix("sfx/gm/")
		for gp in ["res://assets/gm/sfx/" + gm_file, HOST_GM_ROOT + gm_file]:
			var gs := _load_from(gp)
			if gs != null:
				cache[rel_path] = gs
				return gs
		return null
	# Premium mastered monster archetype SFX & dungeon soundtracks/SFX (ships in core-c101)
	if rel_path.begins_with("sfx/premium_mon/"):
		var mf := rel_path.trim_prefix("sfx/premium_mon/")
		for mp in ["res://assets/premium_sfx/monsters/" + mf, HOST_PREMIUM_ROOT + "monsters/" + mf]:
			var ms := _load_from(mp)
			if ms != null:
				cache[rel_path] = ms
				return ms
		return null
	if rel_path.begins_with("sfx/premium_dun/"):
		var df := rel_path.trim_prefix("sfx/premium_dun/")
		for dp in ["res://assets/premium_sfx/dungeon/" + df, HOST_PREMIUM_ROOT + "dungeon/" + df]:
			var ds := _load_from(dp)
			if ds != null:
				cache[rel_path] = ds
				return ds
		return null
	# Try OTA pack path (rewritten to res://service_preview/pyra/assets/audio/...) FIRST, then APK host path!
	for p in ["res://assets/audio/" + rel_path, HOST_ROOT + rel_path]:
		var s := _load_from(p)
		if s != null:
			cache[rel_path] = s
			return s
	return null

func is_ours(n: Node) -> bool:
	return n == self or is_ancestor_of(n)

func music_db() -> float:
	if muted or music_volume <= 0.01:
		return -80.0
	return linear_to_db(maxf(music_volume * 0.78, 0.0001))

func ambience_db() -> float:
	if muted or ambience_volume <= 0.01:
		return -80.0
	# City crowd chatter reduced by 20% (0.80x) per owner feedback so city voices stay soft and natural
	var bed_mult := 0.80 if active_ambience == "city" else 1.0
	return linear_to_db(maxf(ambience_volume * 0.46 * bed_mult, 0.0001))

func play_music(key: String) -> void:
	if not MUSIC.has(key) or key == active_music:
		return
	var s := load_stream("music/%s.mp3" % MUSIC[key])
	if s == null:
		return
	if s is AudioStreamMP3:
		(s as AudioStreamMP3).loop = true
	var next := music_b if fading_in == music_a else music_a
	fading_out = fading_in
	fading_in = next
	active_music = key
	next.stream = s
	next.volume_db = -60.0
	next.play()
	fade_t = 0.0

func play_ambience(land: String, safe: bool) -> void:
	var name := "city" if safe else str(MUSIC.get(land, ""))
	if name == active_ambience:
		return
	active_ambience = name
	var bed := load_stream("sfx/ambience/%s.mp3" % name)
	if bed == null:
		ambience.stop()
		return
	if bed is AudioStreamMP3:
		(bed as AudioStreamMP3).loop = true
	ambience.stream = bed
	ambience.volume_db = ambience_db()
	ambience.play()

func sfx(name: String, gain: float = 1.0, pitch_jitter: float = 0.06, pitch_base: float = 1.0) -> void:
	if muted or sfx_volume <= 0.01:
		return
	var now := Time.get_ticks_msec() / 1000.0
	if now - float(last_played.get(name, -10.0)) < 0.045:
		return
	var s := load_stream("sfx/%s.mp3" % name)
	if s == null:
		return
	last_played[name] = now
	for p in pool:
		if not p.playing:
			p.stream = s
			p.pitch_scale = pitch_base * (randf_range(1.0 - pitch_jitter, 1.0 + pitch_jitter) if pitch_jitter > 0.0 else 1.0)
			p.volume_db = linear_to_db(maxf(sfx_volume * gain, 0.0001))
			p.play()
			return

func play_race_skill(race: String, node_id: String, gain: float = 0.96) -> void:
	var rk := race if race in ["legend", "planetary", "sage", "android"] else "legend"
	var clean_id := node_id if node_id in ["R", "A1", "A4", "A9", "B1", "B4", "B9", "C1", "C4", "C9"] else "R"
	var path := "%s/%s" % [rk, clean_id]
	if load_stream("sfx/%s.mp3" % path) != null:
		sfx(path, gain, 0.05)
	else:
		sfx("common/hit", gain * 0.92, 0.08)

func play_transform_sfx(race: String) -> void:
	sfx("development/ki-charge", 0.94, 0.02)
	sfx("development/ki-source", 0.68, 0.02)
	play_race_skill(race, "A9", 0.62)

func _monster_archetype(actor_id: String) -> String:
	var k := actor_id.to_lower()
	if k.contains("boss") or k.contains("arbiter") or k.contains("arcykaplan") or k.contains("hydra") or k.contains("aurelith") or k.contains("kustosz") or k.contains("egzekutor"):
		return "boss_colossus"
	if k.contains("golem") or k.contains("skalny") or k.contains("ruin") or k.contains("bazalt") or k.contains("tytan"):
		return "stone_golem"
	if k.contains("smok") or k.contains("plomien") or k.contains("zar") or k.contains("magm") or k.contains("ognist") or k.contains("wegiel") or k.contains("kalder"):
		return "fire_dragon"
	if k.contains("pajak") or k.contains("skorpion") or k.contains("osa") or k.contains("skarabeusz") or k.contains("motyl") or k.contains("roj") or k.contains("krab") or k.contains("gasienic"):
		return "insect_spider"
	if k.contains("waz") or k.contains("szlam") or k.contains("pelzacz") or k.contains("galaret"):
		return "serpent_slime"
	if k.contains("krysztal") or k.contains("lod") or k.contains("mroz") or k.contains("swietlik") or k.contains("mgiel"):
		return "frost_crystal"
	if k.contains("duch") or k.contains("oko") or k.contains("marionet") or k.contains("bibliotek") or k.contains("pergamin") or k.contains("astrolab") or k.contains("pieczec") or k.contains("pustk"):
		return "arcane_spirit"
	if k.contains("nexus") or k.contains("dron") or k.contains("wiezycz") or k.contains("mech") or k.contains("plazm") or k.contains("skaner") or k.contains("rdzen") or k.contains("danych") or k.contains("spawal"):
		return "mech_cyber"
	if k.contains("korzen") or k.contains("lisciak") or k.contains("grzyb") or k.contains("mchow") or k.contains("lotos") or k.contains("druid"):
		return "plant_druid"
	if k.contains("wilk") or k.contains("byk") or k.contains("lew") or k.contains("pies") or k.contains("jelen") or k.contains("puchacz") or k.contains("nietoperz") or k.contains("kruk") or k.contains("zuraw"):
		return "beast"
	if k.begins_with("pyra"):
		return "fire_dragon"
	if k.begins_with("verdant"):
		return "plant_druid"
	if k.begins_with("aether"):
		return "frost_crystal"
	return "beast"

func play_monster_sfx(actor_id: String, kind: String) -> void:
	var arch := _monster_archetype(actor_id)
	var track_kind := kind
	if kind == "atk":
		_mon_atk_alt = not _mon_atk_alt
		track_kind = "atk1" if _mon_atk_alt else "atk2"
	elif kind != "roar" and kind != "die":
		track_kind = "atk1"
	var prem_key := "premium_mon/%s_%s" % [arch, track_kind]
	if load_stream("sfx/%s.mp3" % prem_key) != null:
		var g := 0.94 if kind == "roar" else (0.92 if kind == "die" else 0.90)
		sfx(prem_key, g, 0.07)
		return
	var path := "monsters/%s/%s" % [actor_id, kind]
	if load_stream("sfx/%s.mp3" % path) != null:
		sfx(path, 0.88, 0.08)
	elif kind == "die":
		sfx("common/monster-death", 0.90, 0.08)
	elif kind == "atk":
		sfx("common/hit", 0.78, 0.10)
	elif kind == "roar":
		sfx("common/boss-warning", 0.76, 0.06)

func play_dungeon_music(theme: String) -> void:
	var tk := theme if theme in ["pyra", "verdant", "aether", "nexus"] else "pyra"
	var mkey := "dungeon_" + tk
	if mkey == active_music:
		return
	var s := load_stream("sfx/premium_dun/lab_%s.mp3" % tk)
	if s == null:
		return
	if s is AudioStreamMP3:
		(s as AudioStreamMP3).loop = true
	var next := music_b if fading_in == music_a else music_a
	fading_out = fading_in
	fading_in = next
	active_music = mkey
	next.stream = s
	next.volume_db = -60.0
	next.play()
	fade_t = 0.0
	ambience.stop()
	active_ambience = ""

func play_dungeon_sfx(key: String, gain: float = 0.90, pitch_jitter: float = 0.04) -> void:
	sfx("premium_dun/" + key, gain, pitch_jitter)

func play_gm_sfx(key: String, gain: float = 0.92, pitch_jitter: float = 0.03, pitch_base: float = 1.0) -> void:
	sfx("gm/" + key, gain, pitch_jitter, pitch_base)

func set_gm_flight_audio(active: bool, boosted: bool, moving: bool) -> void:
	if not active:
		gm_flight_target = 0.0
		gm_flight_pitch_target = 0.96
		return
	gm_flight_target = 0.62 if (boosted and moving) else (0.44 if moving else (0.38 if boosted else 0.28))
	gm_flight_pitch_target = 1.18 if (boosted and moving) else (1.06 if moving else (1.08 if boosted else 0.95))
	if not gm_flight_loop.playing:
		var loop_s := load_stream("sfx/gm/gm_flight_loop.mp3")
		if loop_s != null:
			if loop_s is AudioStreamMP3:
				(loop_s as AudioStreamMP3).loop = true
			gm_flight_loop.stream = loop_s
			gm_flight_loop.volume_db = _gm_flight_db()
			gm_flight_loop.pitch_scale = gm_flight_pitch
			gm_flight_loop.play()

func play_test_chime(race: String = "legend") -> void:
	play_race_skill(race, "A1")

func step(delta: float, moving: bool, land: String, interior: bool, running: bool = true, in_water: bool = false, in_city: bool = false) -> void:
	if not moving:
		step_clock = 0.14
		return
	step_clock -= delta
	if step_clock > 0.0:
		return
	step_clock = STEP_INTERVAL if running else (STEP_INTERVAL * 1.46)
	_step_alt = not _step_alt
	var surface: String = "water" if in_water else str({"verdant": "grass", "aether": "snow", "nexus": "metal", "pyra": "ash"}.get(land, "dirt"))
	if interior:
		surface = "metal" if land == "nexus" else "wood"
	elif in_city and not in_water:
		surface = "metal" if land == "nexus" else "stone"
	# Soft, organic, subtle footsteps with gentle left/right stride pitch alternation
	var lr_pitch := 1.04 if _step_alt else 0.95
	var run_boost := 1.03 if running else 0.96
	sfx("steps/" + surface, 0.36 if running else 0.24, 0.04, lr_pitch * run_boost)

func _process(delta: float) -> void:
	if gm_flight_loop.playing or gm_flight_target > 0.001:
		var rate := 1.9 if gm_flight_target > gm_flight_gain else 2.6
		gm_flight_gain = move_toward(gm_flight_gain, gm_flight_target, delta * rate)
		gm_flight_pitch = lerpf(gm_flight_pitch, gm_flight_pitch_target, clampf(delta * 4.5, 0.0, 1.0))
		if gm_flight_loop.playing:
			gm_flight_loop.volume_db = _gm_flight_db()
			gm_flight_loop.pitch_scale = gm_flight_pitch
			if gm_flight_gain <= 0.002 and gm_flight_target <= 0.001:
				gm_flight_loop.stop()
	if fade_t >= 1.0:
		return
	fade_t = minf(1.0, fade_t + delta / FADE)
	var target := music_db()
	if fading_in != null:
		fading_in.volume_db = lerpf(-60.0, target, fade_t)
	if fading_out != null:
		fading_out.volume_db = lerpf(target, -60.0, fade_t)
		if fade_t >= 1.0:
			fading_out.stop()

func stop_all() -> void:
	for p in [music_a, music_b, ambience, gm_flight_loop]:
		p.stop()
	gm_flight_gain = 0.0
	gm_flight_target = 0.0
	active_music = ""
	active_ambience = ""
