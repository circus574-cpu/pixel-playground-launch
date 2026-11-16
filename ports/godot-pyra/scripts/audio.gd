class_name PyraAudio
extends Node
## Sound of the game, the rules of src/game/sfx.ts and music.ts: owner's music (one loop per continent, the loading theme on
## the title, crossfading), ambience beds (city inside safe walls, otherwise the world's own), the ElevenLabs effects (hits,
## the four races' abilities, monsters, status effects, UI, doors, loot), footsteps by surface, a minimum gap between repeats of
## one sound. Volumes persist in user://audio.json (music 30 %, effects 60 % by default, like the browser game).

const SETTINGS_PATH := "user://audio.json"
const MUSIC := {"loading": "loadings", "verdant": "verdantia", "aether": "aetheria", "nexus": "nexus", "pyra": "pyra"}
const AMBIENCE := {"verdant": "verdantia", "aether": "aetheria", "nexus": "nexus", "pyra": "pyra"}
const ABILITY_SOUNDS := ["R", "A1", "A4", "A9", "B1", "B4", "B9", "C1", "C4", "C9"]
const STATUS_SOUNDS := {"slow": "slow", "stun": "stun", "root": "slow", "fear": "stun", "burn": "burn", "poison": "poison", "bleed": "poison", "dot": "burn"}
const GAPS := {"common/hit": 0.07, "common/hit-armor": 0.09, "common/hit-crit": 0.12}
const CONTINENT_GAIN := 0.7
const FADE := 1.2
const STEP_INTERVAL := 0.34
const STEP_GAIN := 0.45
const POOL := 14

var music_volume := 0.3
var sfx_volume := 0.6
var music_a := AudioStreamPlayer.new()
var music_b := AudioStreamPlayer.new()
var ambience := AudioStreamPlayer.new()
var active_music := ""
var active_ambience := ""
var fading_in: AudioStreamPlayer
var fading_out: AudioStreamPlayer
var fade_t := 1.0
var pool: Array[AudioStreamPlayer] = []
var cache: Dictionary = {}
var last_played: Dictionary = {}
var step_clock := 0.0

func _ready() -> void:
	load_settings()
	for player in [music_a, music_b, ambience]:
		add_child(player)
	for i in POOL:
		var p := AudioStreamPlayer.new()
		add_child(p)
		pool.append(p)
	process_mode = Node.PROCESS_MODE_ALWAYS

func load_settings() -> void:
	if FileAccess.file_exists(SETTINGS_PATH):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(SETTINGS_PATH))
		if value is Dictionary:
			music_volume = clampf(float(value.get("music", music_volume)), 0.0, 1.0)
			sfx_volume = clampf(float(value.get("sfx", sfx_volume)), 0.0, 1.0)

func save_settings() -> void:
	var file := FileAccess.open(SETTINGS_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify({"music": music_volume, "sfx": sfx_volume}))
		file.close()

func set_volumes(music: float, sfx: float) -> void:
	music_volume = clampf(music, 0.0, 1.0)
	sfx_volume = clampf(sfx, 0.0, 1.0)
	save_settings()
	apply_music_volume()

func stream(path: String) -> AudioStream:
	if not cache.has(path):
		cache[path] = load(path) if ResourceLoader.exists(path) else null
	return cache[path]

func music_target() -> float:
	return music_volume * (1.0 if active_music == "loading" else CONTINENT_GAIN)

func apply_music_volume() -> void:
	var target := music_target()
	var db := linear_to_db(maxf(target, 0.0001))
	if fading_in == null:
		return
	fading_in.volume_db = db if fade_t >= 1.0 else fading_in.volume_db
	ambience.volume_db = linear_to_db(maxf(music_volume * 0.45, 0.0001))

## Background music: one loop per continent, the loading theme elsewhere; a change crossfades.
func play_music(track: String) -> void:
	var key := track if MUSIC.has(track) else "loading"
	if key == active_music:
		return
	var music_stream := stream("res://assets/audio/music/%s.mp3" % MUSIC[key])
	if music_stream == null:
		return
	if music_stream is AudioStreamMP3:
		(music_stream as AudioStreamMP3).loop = true
	var next := music_b if fading_in == music_a else music_a
	fading_out = fading_in
	fading_in = next
	active_music = key
	next.stream = music_stream
	next.volume_db = -60.0
	next.play()
	fade_t = 0.0

## Looping bed under everything: the city inside safe walls, otherwise the world's own.
func play_ambience(world: String, safe: bool) -> void:
	var name := "city" if safe else str(AMBIENCE.get(world, ""))
	if name == active_ambience:
		return
	active_ambience = name
	if name == "":
		ambience.stop()
		return
	var bed := stream("res://assets/audio/sfx/ambience/%s.mp3" % name)
	if bed == null:
		return
	if bed is AudioStreamMP3:
		(bed as AudioStreamMP3).loop = true
	ambience.stream = bed
	ambience.volume_db = linear_to_db(maxf(music_volume * 0.45, 0.0001))
	ambience.play()

func _process(delta: float) -> void:
	if fade_t < 1.0:
		fade_t = minf(1.0, fade_t + delta / FADE)
		var target := linear_to_db(maxf(music_target(), 0.0001))
		if fading_in != null:
			fading_in.volume_db = lerpf(-60.0, target, fade_t)
		if fading_out != null:
			fading_out.volume_db = lerpf(target, -60.0, fade_t)
			if fade_t >= 1.0:
				fading_out.stop()

## One effect, e.g. "common/hit" or "legend/A1"; overlapping plays never cut each other, repeats keep a short gap.
func sfx(name: String, gain: float = 1.0) -> void:
	if sfx_volume <= 0.001:
		return
	var now := Time.get_ticks_msec() / 1000.0
	if now - float(last_played.get(name, -10.0)) < float(GAPS.get(name, 0.03)):
		return
	var s := stream("res://assets/audio/sfx/%s.mp3" % name)
	if s == null:
		return
	last_played[name] = now
	for p in pool:
		if not p.playing:
			p.stream = s
			p.volume_db = linear_to_db(maxf(sfx_volume * gain, 0.0001))
			p.play()
			return

func ability(race: String, id: String) -> void:
	if ABILITY_SOUNDS.has(id):
		sfx("%s/%s" % [race, id])

func hit(crit: bool) -> void:
	sfx("common/hit-crit" if crit else "common/hit")

func monster_sound(kind: String, which: String, distance: float) -> void:
	if distance > 1100.0:
		return
	var path := "monsters/%s/%s" % [kind, which]
	if stream("res://assets/audio/sfx/%s.mp3" % path) != null:
		sfx(path, clampf(1.2 - distance / 1100.0, 0.25, 1.0))
	elif which == "die":
		sfx("common/monster-death", clampf(1.2 - distance / 1100.0, 0.25, 1.0))

func status(kind: String) -> void:
	if STATUS_SOUNDS.has(kind):
		sfx("status/%s" % STATUS_SOUNDS[kind])

## Footsteps while the hero walks: surface from the world, the terrain under the hero and whether he is indoors.
func step(delta: float, moving: bool, world: String, terrain: String, interior: bool) -> void:
	if not moving:
		step_clock = STEP_INTERVAL * 0.5
		return
	step_clock -= delta
	if step_clock > 0.0:
		return
	step_clock = STEP_INTERVAL
	var surface := "dirt"
	if interior:
		surface = "metal" if world == "nexus" else "wood"
	elif terrain == "water":
		surface = "water"
	elif terrain == "rock":
		surface = "stone"
	else:
		surface = {"verdant": "grass", "aether": "stone", "nexus": "metal", "pyra": "ash"}.get(world, "dirt")
	sfx("steps/" + surface, STEP_GAIN)

## A notice that says an action was refused gets the short error tick.
static func is_refusal(text: String) -> bool:
	for prefix in ["Brak ", "Nie masz ", "Nie ma ", "Nie można ", "Nie możesz ", "Nie jest ", "Najpierw ", "Za mało", "Limit ", "Zdolności zablokowane", "Pusty slot"]:
		if text.begins_with(prefix):
			return true
	return false
