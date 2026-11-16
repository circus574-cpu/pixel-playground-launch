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
## Safety: a core that does not compile, does not mount or never reaches the first city is put on a "bad" list and the APK's own
## code runs instead (after a restart, because a mounted pack cannot be unmounted). The decision rules are static functions and are
## tested in tests/smoke.gd; the whole flow is tested by scripts/godot/e2e_core.py.

signal finished(report: Dictionary)

const CLIENT_CODE := 11                  # versionCode of this APK; the test in smoke.gd keeps it equal to export_presets.cfg
const STATE_PATH := "user://core.json"
const DIR := "user://content"
const TARGET := "res://scenes/title.tscn"
const MAX_TRIES := 3                     # launches of a core that never reached the first city before it is given up
const ASK_TIMEOUT := 6.0

var change_scene := true                 # tests turn this off and read `finished`
var status := Label.new()
var bar := ProgressBar.new()
var quit_button := Button.new()

# ---- decisions (static, tested) ------------------------------------------------------------------------

static func pack_id() -> String:
	return "core-c%d" % CLIENT_CODE

static func empty_state() -> Dictionary:
	return {"file": "", "sha256": "", "bytes": 0, "good": "", "attempts": 0, "bad": []}

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
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var back := ColorRect.new()
	back.color = Color(0.051, 0.082, 0.125, 1.0)
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(back)
	var box := VBoxContainer.new()
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
	bar.custom_minimum_size = Vector2(0, 14)
	bar.show_percentage = false
	bar.visible = false
	box.add_child(bar)
	quit_button.text = "ZAMKNIJ"
	quit_button.custom_minimum_size = Vector2(0, 60)
	quit_button.visible = false
	quit_button.pressed.connect(func() -> void: get_tree().quit())
	box.add_child(quit_button)
	run.call_deferred()

func say(text: String) -> void:
	status.text = text

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

## Downloads the offered core into user://content, verifies it. {"ok": bool}
func download(entry: Dictionary, base: String) -> Dictionary:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	var final_path := file_path(str(entry.file))
	var part := final_path + ".part"
	for attempt in 3:
		var http := HTTPRequest.new()
		http.download_file = part
		http.timeout = 0.0
		http.use_threads = true
		add_child(http)
		if http.request(server_url() + base + str(entry.file)) != OK:
			http.queue_free()
			await get_tree().create_timer(1.0).timeout
			continue
		var box := {"finished": false, "result": 0, "code": 0}   # a dictionary: lambdas capture plain variables by value
		http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
			box.result = result
			box.code = code
			box.finished = true)
		bar.visible = true
		while not bool(box.finished):
			bar.max_value = maxf(1.0, float(entry.bytes))
			bar.value = float(http.get_downloaded_bytes())
			say("Pobieram aktualizację gry… %d%%" % int(100.0 * bar.value / bar.max_value))
			await get_tree().process_frame
		http.queue_free()
		bar.visible = false
		if int(box.result) == HTTPRequest.RESULT_SUCCESS and int(box.code) == 200 and FileAccess.file_exists(part):
			var probe := FileAccess.open(part, FileAccess.READ)
			var size := probe.get_length() if probe != null else -1
			if probe != null:
				probe.close()
			if size == int(entry.bytes) and FileAccess.get_sha256(part) == str(entry.sha256):
				DirAccess.rename_absolute(ProjectSettings.globalize_path(part), ProjectSettings.globalize_path(final_path))
				return {"ok": true}
		DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
		await get_tree().create_timer(1.0 * float(attempt + 1)).timeout
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
		if name.begins_with("core-") and (name.ends_with(".pck") or name.ends_with(".part")) and not keep.has(name):
			dir.remove(name)

func run() -> void:
	var report := {"core": "", "mounted": false, "downloaded": false, "reached": false, "broken": "", "gave_up": ""}
	var state := read_state(read_text(STATE_PATH))
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
			quit_button.visible = true
			finished.emit(report)
			return
	remove_old_cores([target, str(state.file)])
	finished.emit(report)
	if change_scene:
		get_tree().change_scene_to_file(TARGET)
