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

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for p in [music_a, music_b, ambience]:
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

func set_muted(on: bool) -> void:
	muted = on
	if fading_in != null and fading_in.playing:
		fading_in.volume_db = music_db()
	if ambience.playing:
		ambience.volume_db = ambience_db()

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

func play_monster_sfx(actor_id: String, kind: String) -> void:
	var path := "monsters/%s/%s" % [actor_id, kind]
	if load_stream("sfx/%s.mp3" % path) != null:
		sfx(path, 0.88, 0.08)
	elif kind == "die":
		sfx("common/monster-death", 0.90, 0.08)
	elif kind == "atk":
		sfx("common/hit", 0.78, 0.10)
	elif kind == "roar":
		sfx("common/boss-warning", 0.76, 0.06)

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
	for p in [music_a, music_b, ambience]:
		p.stop()
	active_music = ""
	active_ambience = ""
