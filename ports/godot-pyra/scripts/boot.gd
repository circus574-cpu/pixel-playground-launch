extends Control
## The first scene of the app. It brings the game's own CODE and DATA up to date from the server, then starts the game.
##
## The APK carries a complete game (it works offline, on the version it was built from). The server may additionally offer a "core"
## pack for this APK (`core-c<versionCode>`): the scripts, scenes, shaders and rules data of a newer build. The pack is downloaded
## once, verified (size and SHA-256), kept in user://content and mounted over the APK's files BEFORE anything of the game is loaded,
## so a change to the game reaches the player from inside the game, without installing a new APK.
##
## What it cannot change: the engine, the permissions and project settings, the app icon, anything native. Those need a new APK;
## the server then raises the minimum client (admin panel).
##
## This script must not name any class of the game (not even through a typed variable): a class used here would be loaded from the
## APK before the pack is mounted and the pack could no longer replace it. Everything here is plain engine API.
##
## Entry animation: the owner's intro film (assets/branding/intro.ogv, Ogg Theora, 10 s with sound) plays full screen while the update check
## runs underneath. A touch after 0.8 s skips it; when it ends the last frame ("TOUCH TO START") stays until the player touches the
## screen, then the game starts without a second start button (the title screen starts the game by itself). Nothing waits for the film
## in headless runs or when `play_intro` is off (tests); a film that cannot be loaded is skipped.
##
## Safety: a core that does not compile, does not mount or never reaches the first city is put on a "bad" list and the APK's own
## code runs instead (after a restart, because a mounted pack cannot be unmounted). The decision rules are static functions and are
## tested in tests/smoke.gd; the whole flow is tested by scripts/godot/e2e_core.py.

signal finished(report: Dictionary)

const CLIENT_CODE := 101                 # service-preview bootstrap; cannot mount a cached c100 core
const STATE_PATH := "user://core.json"
const DIR := "user://content"
const TARGET := "res://scenes/title.tscn"
const MAX_TRIES := 3                     # launches of a core that never reached the first city before it is given up
const ASK_TIMEOUT := 6.0
const INTRO_VIDEO := "res://assets/branding/intro.ogv"
const INTRO_LAST := "res://assets/branding/intro-last.webp"
const INTRO_SIZE := Vector2(1280.0, 720.0)
const MAX_CROP := 0.10                  # share of the film's height that may be cut off on a wide screen
const SKIP_AFTER := 0.8
const RANGE_STREAMS := 4
const RANGE_MIN_BYTES := 2097152        # split files >= 2 MB across 4 parallel HTTP Range streams
const BOOT_MUSIC_PATHS := [
	"res://assets/audio/music/loading_theme.mp3",
	"res://service_preview/pyra/assets/audio/music/loading_theme.mp3",
	"res://assets/audio/music/loadings.mp3",
	"res://assets/audio/music/menu.mp3",
]

var change_scene := true                 # tests turn this off and read `finished`
var play_intro := true                   # tests turn this off; headless runs never play it
var status := Label.new()
var bar := ProgressBar.new()
var quit_button := Button.new()
var box := VBoxContainer.new()           # title, status and progress on the dark background (shown when no film plays)
var pill := PanelContainer.new()         # the same status as a small pill over the film
var pill_label := Label.new()
var dl_dock := PanelContainer.new()      # unified bottom forged loading bar with live speed (MB/s)
var dl_status_lbl := Label.new()
var dl_speed_lbl := Label.new()
var dl_detail_lbl := Label.new()
var dl_meta_lbl := Label.new()
var boot_music := AudioStreamPlayer.new()
var _boot_music_fade := 1.0
var _boot_music_target_db := -10.0
var video := VideoStreamPlayer.new()
var last_frame := TextureRect.new()
var intro_on := false                    # the film is playing
var intro_over := true                   # no film, or it has ended or was skipped
var intro_elapsed := 0.0
var touched := false
var work_done := false
var intro_started := false

# ---- decisions (static, tested) ------------------------------------------------------------------------

static func pack_id() -> String:
	return "core-c%d" % CLIENT_CODE

static func empty_state() -> Dictionary:
	return {"file": "", "sha256": "", "bytes": 0, "good": "", "attempts": 0, "bad": []}

static func compatible_state(state: Dictionary) -> Dictionary:
	if str(state.get("file",""))!="" and not str(state.file).begins_with("core-c%d-"%CLIENT_CODE):
		return empty_state() # Keep the file on disk; only discard the incompatible bootstrap reference.
	return state

static func read_state(text: String) -> Dictionary:
	var state := empty_state()
	var value: Variant = JSON.parse_string(text) if text != "" else null
	if value is Dictionary:
		state.file = str(value.get("file", ""))
		state.sha256 = str(value.get("sha256", ""))
		state.bytes = int(value.get("bytes", 0))
		state.good = str(value.get("good", ""))
		state.attempts = int(value.get("attempts", 0))
		var bad: Variant = value.get("bad", [])
		if bad is Array:
			for item: Variant in bad:
				if item is String:
					state.bad.append(item)
	return state

## What to do with the core the server offers (`entry`; {} when it offers none) given what is on the device.
## `reached`: the server answered. `cached_ok`: the held file is on disk with the right size and hash.
## Returns {"download": bool, "target": file to mount ("" = the APK's own code), "give_up": a file to put on the bad list or ""}.
static func decide(state: Dictionary, entry: Dictionary, reached: bool, cached_ok: bool) -> Dictionary:
	var bad: Array = state.bad
	var held := str(state.file)
	var offered := str(entry.get("file", ""))
	var want := offered if offered != "" and not bad.has(offered) else ""
	var download := false
	var target := ""
	if reached:
		if want == "":
			target = ""                    # the active release carries no core for this APK (or it is known bad): the APK's own code
		elif want == held and cached_ok:
			target = held
		else:
			target = want
			download = true
	else:
		target = held if held != "" and cached_ok and not bad.has(held) else ""
	if target != "" and not download and str(state.good) != target and int(state.attempts) >= MAX_TRIES:
		return {"download": false, "target": "", "give_up": target}
	return {"download": download, "target": target, "give_up": ""}

## The state after the launch decided to mount `file` (a new file starts with a clean record).
static func note_launch(state: Dictionary, file: String, sha256: String, bytes: int) -> Dictionary:
	var next := state.duplicate(true)
	if file != str(state.file):
		next.file = file
		next.sha256 = sha256
		next.bytes = bytes
		next.good = ""
		next.attempts = 0
	if file != "" and str(next.good) != file:
		next.attempts = int(next.attempts) + 1
	return next

static func server_url() -> String:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--server="):
			return arg.substr(9).rstrip("/")
	var env := OS.get_environment("KI_SERVER")
	if env != "":
		return env.rstrip("/")
	if FileAccess.file_exists("user://server.json"):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://server.json"))
		if value is Dictionary and str(value.get("server", "")) != "":
			return str(value.server).rstrip("/")
	return str(ProjectSettings.get_setting("ki/server/url", "https://kilegends.pl")).rstrip("/")

static func format_speed(bytes_per_sec: float) -> String:
	if bytes_per_sec >= 1048576.0:
		return "%.2f MB/s" % (bytes_per_sec / 1048576.0)
	if bytes_per_sec >= 1024.0:
		return "%.0f KB/s" % (bytes_per_sec / 1024.0)
	return "0 KB/s"

static func format_mb(bytes_val: float) -> String:
	return "%.1f MB" % (bytes_val / 1048576.0)

static func format_streams(count: int) -> String:
	var n := maxi(1, count)
	return "1 wątek · bez limitu" if n == 1 else "%d wątki równolegle · bez limitu" % n

## Names of the game's scripts as they can be loaded (an export lists `x.gd.remap` or `x.gdc`, a pack adds plain `x.gd`).
static func script_names(listing: PackedStringArray) -> Array[String]:
	var seen := {}
	for file in listing:
		var name := file
		if name.ends_with(".remap"):
			name = name.trim_suffix(".remap")
		if name.ends_with(".gdc"):
			name = name.trim_suffix("c")
		if name.ends_with(".gd"):
			seen[name] = true
	var out: Array[String] = []
	for name: String in seen:
		out.append(name)
	out.sort()
	return out

# ---- the scene ------------------------------------------------------------------------------------------

func _ready() -> void:
	PyraSkin.install(get_tree())
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	clip_contents = true
	var back := ColorRect.new()
	back.color = Color(0.051, 0.082, 0.125, 1.0)
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(back)
	last_frame.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	last_frame.stretch_mode = TextureRect.STRETCH_SCALE   # placed by fit_video, like the film
	last_frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	last_frame.visible = false
	add_child(last_frame)
	video.mouse_filter = Control.MOUSE_FILTER_IGNORE
	video.visible = false
	add_child(video)
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	box.custom_minimum_size = Vector2(620, 0)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.add_theme_constant_override("separation", 14)
	add_child(box)
	var title := Label.new()
	title.text = "KI LEGENDS"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size", 44)
	title.add_theme_color_override("font_color", Color("f1c77f"))
	if ResourceLoader.exists("res://assets/branding/cinzel-bold.ttf"):
		title.add_theme_font_override("font", load("res://assets/branding/cinzel-bold.ttf"))
	box.add_child(title)
	status.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	status.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	status.add_theme_font_size_override("font_size", 20)
	status.add_theme_color_override("font_color", Color("d9cdb4"))
	box.add_child(status)
	quit_button.text = "ZAMKNIJ"
	quit_button.custom_minimum_size = Vector2(0, 60)
	quit_button.visible = false
	quit_button.pressed.connect(func() -> void: get_tree().quit())
	box.add_child(quit_button)
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.03, 0.04, 0.08, 0.78)
	style.set_corner_radius_all(18)
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 6
	style.content_margin_bottom = 6
	pill.add_theme_stylebox_override("panel", style)
	pill.set_anchors_and_offsets_preset(Control.PRESET_CENTER_TOP)
	pill.grow_horizontal = Control.GROW_DIRECTION_BOTH
	pill.offset_top = 18
	pill.visible = false
	pill.mouse_filter = Control.MOUSE_FILTER_IGNORE
	pill_label.add_theme_font_size_override("font_size", 18)
	pill_label.add_theme_color_override("font_color", Color("f3e6c4"))
	pill.add_child(pill_label)
	add_child(pill)

	# Unified bottom forged loading dock (same layout & styling across boot, world packs & lands)
	var dock_sb := StyleBoxFlat.new()
	dock_sb.bg_color = Color(0.03, 0.035, 0.065, 0.92)
	dock_sb.border_color = Color(0.78, 0.62, 0.28, 0.88)
	dock_sb.set_border_width_all(2)
	dock_sb.set_corner_radius_all(14)
	dock_sb.content_margin_left = 24
	dock_sb.content_margin_right = 24
	dock_sb.content_margin_top = 14
	dock_sb.content_margin_bottom = 14
	dl_dock.name = "BottomDownloadDock"
	dl_dock.add_theme_stylebox_override("panel", dock_sb)
	dl_dock.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	dl_dock.z_index = 40
	dl_dock.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dl_dock.visible = false
	var dock_vb := VBoxContainer.new()
	dock_vb.add_theme_constant_override("separation", 7)
	dl_dock.add_child(dock_vb)
	var top_hb := HBoxContainer.new()
	top_hb.add_theme_constant_override("separation", 12)
	dl_status_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dl_status_lbl.add_theme_font_size_override("font_size", 19)
	dl_status_lbl.add_theme_color_override("font_color", Color("f4ead0"))
	dl_speed_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	dl_speed_lbl.add_theme_font_size_override("font_size", 20)
	dl_speed_lbl.add_theme_color_override("font_color", Color("ffd46a"))
	top_hb.add_child(dl_status_lbl)
	top_hb.add_child(dl_speed_lbl)
	dock_vb.add_child(top_hb)
	var bar_bg := StyleBoxFlat.new()
	bar_bg.bg_color = Color(0.07, 0.09, 0.14, 0.96)
	bar_bg.border_color = Color(0.45, 0.36, 0.20, 0.85)
	bar_bg.set_border_width_all(1)
	bar_bg.set_corner_radius_all(8)
	var bar_fill := StyleBoxFlat.new()
	bar_fill.bg_color = Color(0.93, 0.72, 0.24, 1.0)
	bar_fill.set_corner_radius_all(7)
	bar.add_theme_stylebox_override("background", bar_bg)
	bar.add_theme_stylebox_override("fill", bar_fill)
	bar.custom_minimum_size = Vector2(0, 18)
	bar.show_percentage = false
	bar.visible = true
	dock_vb.add_child(bar)
	var bot_hb := HBoxContainer.new()
	bot_hb.add_theme_constant_override("separation", 12)
	dl_detail_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dl_detail_lbl.add_theme_font_size_override("font_size", 15)
	dl_detail_lbl.add_theme_color_override("font_color", Color("d2d9e6"))
	dl_meta_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	dl_meta_lbl.add_theme_font_size_override("font_size", 14)
	dl_meta_lbl.add_theme_color_override("font_color", Color("9cb0cc"))
	bot_hb.add_child(dl_detail_lbl)
	bot_hb.add_child(dl_meta_lbl)
	dock_vb.add_child(bot_hb)
	add_child(dl_dock)
	_layout_dl_dock()

	boot_music.name = "BootLoadingMusic"
	add_child(boot_music)
	resized.connect(fit_video)
	resized.connect(_layout_dl_dock)
	start_intro()
	if not intro_on:
		start_boot_music()
	run.call_deferred()

func _layout_dl_dock() -> void:
	var left_pad := 36.0
	var right_pad := 36.0
	var bot_pad := 22.0
	if OS.get_name() == "Android" and get_tree() != null and get_tree().root != null:
		var safe := DisplayServer.get_display_safe_area()
		if safe.has_area() and size.x > 0.0 and size.y > 0.0:
			var local_safe := (get_tree().root.get_screen_transform().affine_inverse() * Rect2(safe)).intersection(Rect2(Vector2.ZERO, size))
			left_pad = maxf(36.0, local_safe.position.x + 18.0)
			right_pad = maxf(36.0, size.x - local_safe.end.x + 18.0)
			bot_pad = maxf(22.0, size.y - local_safe.end.y + 14.0)
	dl_dock.offset_left = left_pad
	dl_dock.offset_right = -right_pad
	dl_dock.offset_bottom = -bot_pad
	dl_dock.offset_top = -(bot_pad + 96.0)

func _load_boot_music_stream() -> AudioStream:
	for p in BOOT_MUSIC_PATHS:
		if ResourceLoader.exists(p):
			var s: Variant = load(p)
			if s is AudioStream:
				return s as AudioStream
		if FileAccess.file_exists(p):
			var bytes := FileAccess.get_file_as_bytes(p)
			if not bytes.is_empty():
				var mp3 := AudioStreamMP3.new()
				mp3.data = bytes
				mp3.loop = true
				return mp3
	return null

func start_boot_music() -> void:
	if DisplayServer.get_name() == "headless":
		return
	var vol := 0.40
	if FileAccess.file_exists("user://audio.json"):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://audio.json"))
		if value is Dictionary:
			vol = clampf(float((value as Dictionary).get("music", vol)), 0.0, 1.0)
	if vol <= 0.01:
		return
	if boot_music.stream == null:
		boot_music.stream = _load_boot_music_stream()
	if boot_music.stream == null:
		return
	if boot_music.stream is AudioStreamMP3:
		(boot_music.stream as AudioStreamMP3).loop = true
	_boot_music_target_db = linear_to_db(maxf(vol * 0.72, 0.0001))
	if not boot_music.playing:
		_boot_music_fade = 0.0
		boot_music.volume_db = -42.0
		boot_music.play()

func stop_boot_music() -> void:
	if boot_music.playing:
		boot_music.stop()

## Starts the film when it may play and exists; otherwise the dark background with the status is all there is.
func start_intro() -> void:
	if not play_intro or DisplayServer.get_name() == "headless":
		return
	var stream: VideoStream = null
	if ResourceLoader.exists(INTRO_VIDEO):
		var res: Resource = load(INTRO_VIDEO)
		if res is VideoStream:
			stream = res as VideoStream
	if stream == null and FileAccess.file_exists(INTRO_VIDEO):
		var vs := VideoStreamTheora.new()
		vs.file = INTRO_VIDEO
		stream = vs
	if stream == null:
		return
	video.stream = stream
	video.volume_db = linear_to_db(maxf(0.0001, intro_volume()))
	if ResourceLoader.exists(INTRO_LAST):
		last_frame.texture = load(INTRO_LAST)
	video.finished.connect(end_intro)
	video.expand = true
	video.visible = true
	box.visible = false
	pill.visible = true
	intro_on = true
	intro_over = false
	intro_started = true
	fit_video()
	video.play()

## The film's loudness follows the music volume of the game's settings (user://audio.json; 30 % by default), a little louder than the music.
static func intro_volume() -> float:
	var music := 0.3
	if FileAccess.file_exists("user://audio.json"):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string("user://audio.json"))
		if value is Dictionary:
			music = clampf(float(value.get("music", music)), 0.0, 1.0)
	return clampf(music * 1.6, 0.0, 1.0)

## 16:9 film on a wider phone: scaled up to fill the screen, but at most MAX_CROP of its height is cut off (80 % of that from the top, the rest from the bottom);
## on a screen wider still the film keeps its full width-to-height share and the sides stay in the backdrop colour. The loading bar and the "touch to start"
## caption sit at the bottom of the picture, so they are never cut. The still after the film is placed the same way.
func fit_video() -> void:
	var area := size
	if area.x <= 0.0 or area.y <= 0.0:
		return
	var rect := film_rect(area)
	video.position = rect.position
	video.size = rect.size
	last_frame.position = rect.position
	last_frame.size = rect.size

static func film_rect(area: Vector2) -> Rect2:
	var contain := minf(area.x / INTRO_SIZE.x, area.y / INTRO_SIZE.y)
	var cover := maxf(area.x / INTRO_SIZE.x, area.y / INTRO_SIZE.y)
	var factor := minf(cover, contain / (1.0 - MAX_CROP))
	var film := INTRO_SIZE * factor
	var cut := maxf(0.0, film.y - area.y)
	return Rect2(Vector2((area.x - film.x) / 2.0, -cut * 0.8), film)

func end_intro() -> void:
	if intro_over:
		return
	intro_on = false
	intro_over = true
	video.stop()
	video.visible = false
	last_frame.visible = last_frame.texture != null
	box.visible = last_frame.texture == null
	if last_frame.texture != null:
		pill.visible = not work_done and not dl_dock.visible
	start_boot_music()

func _process(delta: float) -> void:
	if intro_on:
		intro_elapsed += delta
	if _boot_music_fade < 1.0 and boot_music.playing:
		_boot_music_fade = minf(1.0, _boot_music_fade + delta / 0.85)
		boot_music.volume_db = lerpf(-42.0, _boot_music_target_db, _boot_music_fade)

func _input(event: InputEvent) -> void:
	var pressed := false
	if event is InputEventScreenTouch:
		pressed = (event as InputEventScreenTouch).pressed
	elif event is InputEventMouseButton:
		pressed = (event as InputEventMouseButton).pressed
	elif event is InputEventKey:
		var key := event as InputEventKey
		pressed = key.pressed and not key.echo
	if not pressed:
		return
	if intro_on:
		if intro_elapsed >= SKIP_AFTER:
			touched = true
			end_intro()
	elif intro_over:
		touched = true

## The game may start: the update work is done and the player has seen (or skipped) the film and touched the screen. Without a film there is nothing to wait for.
func may_start() -> bool:
	return work_done and (not intro_started or (intro_over and touched))

func say(text: String) -> void:
	status.text = text
	pill_label.text = text

func read_text(path: String) -> String:
	return FileAccess.get_file_as_string(path) if FileAccess.file_exists(path) else ""

func save_state(state: Dictionary) -> void:
	var file := FileAccess.open(STATE_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(state))
		file.close()

func file_path(name: String) -> String:
	return "%s/%s" % [DIR, name]

## The held file is on disk with the size and SHA-256 that were recorded when it was downloaded.
func held_ok(state: Dictionary) -> bool:
	var name := str(state.file)
	if name == "" or not FileAccess.file_exists(file_path(name)):
		return false
	var file := FileAccess.open(file_path(name), FileAccess.READ)
	if file == null:
		return false
	var size := file.get_length()
	file.close()
	return size == int(state.bytes) and FileAccess.get_sha256(file_path(name)) == str(state.sha256)

func ask_server() -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = ASK_TIMEOUT
	add_child(http)
	var url := "%s/ws/godot/manifest?client=%d" % [server_url(), CLIENT_CODE]
	if http.request(url, PackedStringArray(["Accept: application/json"])) != OK:
		http.queue_free()
		return {"reached": false, "entry": {}, "base": ""}
	var done: Array = await http.request_completed
	http.queue_free()
	if int(done[0]) != HTTPRequest.RESULT_SUCCESS:
		return {"reached": false, "entry": {}, "base": ""}
	var json: Variant = JSON.parse_string((done[3] as PackedByteArray).get_string_from_utf8())
	if int(done[1]) != 200 or not json is Dictionary or not (json as Dictionary).has("manifest"):
		# maintenance or a client that is too old: nothing to update now; the gate explains it to the player later
		return {"reached": false, "entry": {}, "base": ""}
	var packs: Dictionary = (json.manifest as Dictionary).get("packs", {})
	var entry: Variant = packs.get(pack_id(), {})
	return {"reached": true, "entry": entry if entry is Dictionary else {}, "base": str(json.get("packBase", ""))}

func _update_dock(title: String, cur_b: float, total_b: float, bps: float, streams: int) -> void:
	var pct := int(clampf(100.0 * cur_b / maxf(1.0, total_b), 0.0, 100.0))
	bar.max_value = maxf(1.0, total_b)
	bar.value = clampf(cur_b, 0.0, maxf(1.0, total_b))
	dl_status_lbl.text = title
	dl_speed_lbl.text = "⚡ %s" % format_speed(bps)
	dl_detail_lbl.text = "%s / %s · %d%%" % [format_mb(cur_b), format_mb(total_b), pct]
	dl_meta_lbl.text = format_streams(streams)

func _verify_file(path: String, want_bytes: int, want_sha: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var probe := FileAccess.open(path, FileAccess.READ)
	var sz := probe.get_length() if probe != null else -1
	if probe != null:
		probe.close()
	return sz == want_bytes and FileAccess.get_sha256(path) == want_sha

func _cleanup_segments(part: String, count: int) -> void:
	for i in count:
		var seg := "%s.s%d" % [part, i]
		if FileAccess.file_exists(seg):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(seg))

func _merge_segments(part: String, seg_paths: Array[String]) -> bool:
	var out := FileAccess.open(part, FileAccess.WRITE)
	if out == null:
		return false
	for seg in seg_paths:
		var inp := FileAccess.open(seg, FileAccess.READ)
		if inp == null:
			out.close()
			return false
		while inp.get_position() < inp.get_length():
			var chunk := inp.get_buffer(mini(1048576, inp.get_length() - inp.get_position()))
			if chunk.is_empty():
				break
			out.store_buffer(chunk)
		inp.close()
	out.close()
	return true

func _download_ranged(url: String, part: String, want_bytes: int, want_sha: String) -> bool:
	var n := RANGE_STREAMS
	var seg_size := int(ceili(float(want_bytes) / float(n)))
	var workers: Array[Dictionary] = []
	var seg_paths: Array[String] = []
	_cleanup_segments(part, n)
	for i in n:
		var s0 := i * seg_size
		if s0 >= want_bytes:
			break
		var s1 := mini(want_bytes - 1, s0 + seg_size - 1)
		var seg_path := "%s.s%d" % [part, i]
		seg_paths.append(seg_path)
		var http := HTTPRequest.new()
		http.download_file = seg_path
		http.download_chunk_size = 1048576
		http.body_size_limit = -1
		http.timeout = 0.0
		http.use_threads = true
		add_child(http)
		var w := {
			"http": http,
			"path": seg_path,
			"want": s1 - s0 + 1,
			"done": false,
			"result": -1,
			"code": 0,
		}
		http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
			w["result"] = result
			w["code"] = code
			w["done"] = true)
		var hdrs := PackedStringArray(["Range: bytes=%d-%d" % [s0, s1]])
		if http.request(url, hdrs) != OK:
			for prev in workers:
				var ph: HTTPRequest = prev["http"]
				ph.cancel_request()
				ph.queue_free()
			http.queue_free()
			_cleanup_segments(part, n)
			return false
		workers.append(w)

	var total_f := float(want_bytes)
	var last_t := Time.get_ticks_msec()
	var last_b := 0.0
	var smooth_bps := 0.0
	var got_full_200 := ""
	var failed := false
	while true:
		var active_count := 0
		var cur_b := 0.0
		for w in workers:
			var http: HTTPRequest = w["http"]
			if bool(w["done"]):
				if int(w["result"]) == HTTPRequest.RESULT_SUCCESS and int(w["code"]) == 200 and got_full_200 == "":
					got_full_200 = str(w["path"])
					break
				if int(w["result"]) != HTTPRequest.RESULT_SUCCESS or int(w["code"]) != 206:
					failed = true
				cur_b += float(w["want"])
			else:
				active_count += 1
				cur_b += float(mini(int(w["want"]), http.get_downloaded_bytes()))
		if got_full_200 != "" or failed or active_count == 0:
			break
		var now_t := Time.get_ticks_msec()
		var dt_ms := now_t - last_t
		if dt_ms >= 200:
			var inst_bps := maxf(0.0, cur_b - last_b) / (float(dt_ms) / 1000.0)
			smooth_bps = inst_bps if smooth_bps <= 1.0 else lerpf(smooth_bps, inst_bps, 0.35)
			last_t = now_t
			last_b = cur_b
		_update_dock("Pobieram aktualizację gry…", cur_b, total_f, smooth_bps, active_count)
		await get_tree().process_frame

	for w in workers:
		var http: HTTPRequest = w["http"]
		if not bool(w["done"]):
			http.cancel_request()
		http.queue_free()

	if got_full_200 != "":
		if _verify_file(got_full_200, want_bytes, want_sha):
			DirAccess.rename_absolute(ProjectSettings.globalize_path(got_full_200), ProjectSettings.globalize_path(part))
			_cleanup_segments(part, n)
			return true
		_cleanup_segments(part, n)
		return false

	if failed:
		_cleanup_segments(part, n)
		return false

	for w in workers:
		var pr := FileAccess.open(str(w["path"]), FileAccess.READ)
		var got_sz := pr.get_length() if pr != null else -1
		if pr != null:
			pr.close()
		if got_sz != int(w["want"]):
			_cleanup_segments(part, n)
			return false

	_update_dock("Weryfikacja i uruchamianie aktualizacji…", total_f, total_f, smooth_bps, workers.size())
	await get_tree().process_frame
	var merged := _merge_segments(part, seg_paths)
	_cleanup_segments(part, n)
	return merged and _verify_file(part, want_bytes, want_sha)

## Downloads the offered core into user://content, verifies it. {"ok": bool}
func download(entry: Dictionary, base: String) -> Dictionary:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	var final_path := file_path(str(entry.file))
	var part := final_path + ".part"
	var want_bytes := int(entry.bytes)
	var want_sha := str(entry.sha256)
	var total_bytes := maxf(1.0, float(want_bytes))
	var url := server_url() + base + str(entry.file)
	_layout_dl_dock()
	var prev_pill := pill.visible
	pill.visible = false
	dl_dock.visible = true
	bar.visible = true
	_update_dock("Pobieram aktualizację gry…", 0.0, total_bytes, 0.0, RANGE_STREAMS if want_bytes >= RANGE_MIN_BYTES else 1)

	for attempt in 3:
		# Fast path: 4 parallel HTTP Range streams for packs >= 2 MB (first 2 attempts), falling back to single-stream.
		if want_bytes >= RANGE_MIN_BYTES and attempt < 2:
			if await _download_ranged(url, part, want_bytes, want_sha):
				DirAccess.rename_absolute(ProjectSettings.globalize_path(part), ProjectSettings.globalize_path(final_path))
				dl_dock.visible = false
				pill.visible = false
				return {"ok": true}
			if FileAccess.file_exists(part):
				DirAccess.remove_absolute(ProjectSettings.globalize_path(part))

		var http := HTTPRequest.new()
		http.download_file = part
		http.download_chunk_size = 1048576
		http.body_size_limit = -1
		http.timeout = 0.0
		http.use_threads = true
		add_child(http)
		if http.request(url) != OK:
			http.queue_free()
			await get_tree().create_timer(1.0).timeout
			continue
		var box := {"finished": false, "result": 0, "code": 0}   # a dictionary: lambdas capture plain variables by value
		http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
			box.result = result
			box.code = code
			box.finished = true)
		var last_t := Time.get_ticks_msec()
		var last_b := 0
		var smooth_bps := 0.0
		while not bool(box.finished):
			var cur_b := http.get_downloaded_bytes()
			var now_t := Time.get_ticks_msec()
			var dt_ms := now_t - last_t
			if dt_ms >= 200:
				var inst_bps := float(maxi(0, cur_b - last_b)) / (float(dt_ms) / 1000.0)
				smooth_bps = inst_bps if smooth_bps <= 1.0 else lerpf(smooth_bps, inst_bps, 0.35)
				last_t = now_t
				last_b = cur_b
			_update_dock("Pobieram aktualizację gry…", float(cur_b), total_bytes, smooth_bps, 1)
			await get_tree().process_frame
		http.queue_free()
		if int(box.result) == HTTPRequest.RESULT_SUCCESS and int(box.code) == 200 and _verify_file(part, want_bytes, want_sha):
			_update_dock("Weryfikacja i uruchamianie aktualizacji…", total_bytes, total_bytes, smooth_bps, 1)
			DirAccess.rename_absolute(ProjectSettings.globalize_path(part), ProjectSettings.globalize_path(final_path))
			dl_dock.visible = false
			pill.visible = false
			return {"ok": true}
		if FileAccess.file_exists(part):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
		await get_tree().create_timer(1.0 * float(attempt + 1)).timeout
	dl_dock.visible = false
	pill.visible = prev_pill and not work_done
	return {"ok": false}

## "" when every script of the game compiles, otherwise the first one that does not.
func broken_script() -> String:
	for name in script_names(DirAccess.get_files_at("res://scripts")):
		var script: Resource = load("res://scripts/" + name)
		if not script is GDScript or not (script as GDScript).can_instantiate():
			return name
	return ""

func remove_old_cores(keep: Array) -> void:
	var dir := DirAccess.open(DIR)
	if dir == null:
		return
	for name in dir.get_files():
		if name.begins_with("core-") and (name.ends_with(".pck") or name.ends_with(".part") or ".part.s" in name) and not keep.has(name):
			dir.remove(name)

func run() -> void:
	var report := {"core": "", "mounted": false, "downloaded": false, "reached": false, "broken": "", "gave_up": ""}
	var state := compatible_state(read_state(read_text(STATE_PATH)))
	say("Sprawdzam aktualizacje gry…")
	var offer: Dictionary = await ask_server()
	report.reached = bool(offer.reached)
	var held_was_ok := held_ok(state)
	var plan := decide(state, offer.entry, bool(offer.reached), held_was_ok)
	if str(plan.give_up) != "":
		state.bad.append(plan.give_up)
		report.gave_up = plan.give_up
	var target := str(plan.target)
	var sha := str(state.sha256)
	var bytes := int(state.bytes)
	if bool(plan.download):
		var got: Dictionary = await download(offer.entry, str(offer.base))
		if bool(got.ok):
			report.downloaded = true
			sha = str(offer.entry.sha256)
			bytes = int(offer.entry.bytes)
		else:
			target = str(state.file) if held_was_ok and not (state.bad as Array).has(state.file) else ""   # could not fetch: keep what we had
	if target != "":
		state = note_launch(state, target, sha, bytes)
	save_state(state)
	report.core = target
	if target != "":
		say("Uruchamiam grę…")
		if ProjectSettings.load_resource_pack(ProjectSettings.globalize_path(file_path(target)), true):
			report.mounted = true
			report.broken = broken_script()
		else:
			report.broken = "(paczka się nie wczytała)"
		if str(report.broken) != "":
			state.bad.append(target)
			save_state(state)
			say("Aktualizacja gry jest uszkodzona. Zamknij grę i uruchom ją ponownie: wróci poprzednia wersja.")
			end_intro()
			last_frame.visible = false
			pill.visible = false
			box.visible = true
			quit_button.visible = true
			finished.emit(report)
			return
	remove_old_cores([target, str(state.file)])
	work_done = true
	pill.visible = false
	finished.emit(report)
	if change_scene:
		while not may_start():
			await get_tree().process_frame
		if intro_started:
			Engine.set_meta("ki_autostart", true)   # the film said "touch to start": the title screen starts the game itself
		stop_boot_music()
		get_tree().change_scene_to_file(TARGET)
