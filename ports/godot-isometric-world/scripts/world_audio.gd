extends Node
## Sound of the isometric world: one looping music track per continent (crossfading), city/world ambience bed and UI/gameplay
## effects. It reads the owner's mp3 files from res://assets/audio (mounted by the host app's music/sfx packs); when a file is
## not there (standalone QA) it stays silent instead of failing.

const MUSIC := {"pyra": "pyra", "verdant": "verdantia", "aether": "aetheria", "nexus": "nexus", "loading": "loadings"}
## Built at runtime so the preview packager (which rewrites the res:// prefix of scripts) leaves host audio paths alone.
const ROOT := "res:" + "//"
const FADE := 1.4
const STEP_INTERVAL := 0.34
const POOL := 10

var music_volume := 0.3
var sfx_volume := 0.6
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

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for p in [music_a, music_b, ambience]:
		add_child(p)
	for i in POOL:
		var s := AudioStreamPlayer.new()
		add_child(s)
		pool.append(s)

func load_stream(path: String) -> AudioStream:
	if cache.has(path):
		return cache[path]
	if not ResourceLoader.exists(path):
		return null
	var s: AudioStream = load(path)
	cache[path] = s
	return s

func is_ours(n: Node) -> bool:
	return n == self or is_ancestor_of(n)

func music_db() -> float:
	return linear_to_db(maxf(music_volume * (1.0 if active_music == "loading" else 0.7), 0.0001))

func play_music(key: String) -> void:
	if not MUSIC.has(key) or key == active_music:
		return
	var s := load_stream(ROOT + "assets/audio/music/%s.mp3" % MUSIC[key])
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
	var bed := load_stream(ROOT + "assets/audio/sfx/ambience/%s.mp3" % name)
	if bed == null:
		ambience.stop()
		return
	if bed is AudioStreamMP3:
		(bed as AudioStreamMP3).loop = true
	ambience.stream = bed
	ambience.volume_db = linear_to_db(maxf(music_volume * 0.45, 0.0001))
	ambience.play()

func sfx(name: String, gain: float = 1.0) -> void:
	var now := Time.get_ticks_msec() / 1000.0
	if now - float(last_played.get(name, -10.0)) < 0.05:
		return
	var s := load_stream(ROOT + "assets/audio/sfx/%s.mp3" % name)
	if s == null:
		return
	last_played[name] = now
	for p in pool:
		if not p.playing:
			p.stream = s
			p.volume_db = linear_to_db(maxf(sfx_volume * gain, 0.0001))
			p.play()
			return

func step(delta: float, moving: bool, land: String, interior: bool) -> void:
	if not moving:
		step_clock = STEP_INTERVAL * 0.5
		return
	step_clock -= delta
	if step_clock > 0.0:
		return
	step_clock = STEP_INTERVAL
	var surface: String = {"verdant": "grass", "aether": "stone", "nexus": "metal", "pyra": "ash"}.get(land, "dirt")
	if interior:
		surface = "metal" if land == "nexus" else "wood"
	sfx("steps/" + surface, 0.45)

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
