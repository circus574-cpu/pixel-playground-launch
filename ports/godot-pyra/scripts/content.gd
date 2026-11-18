class_name PyraContent
extends Node
## Downloadable content. The APK carries the code, the interface, the four heroes and the rules data; everything a land needs
## (scenery, monsters, NPCs, interiors, music) is a PCK pack on the server. The manifest (/ws/godot/manifest) lists the packs, their
## SHA-256 and which packs each land needs; packs are downloaded once into user://content, verified, and mounted with
## ProjectSettings.load_resource_pack. A build that carries everything itself (editor, desktop test export) needs no downloads.

signal progress(info: Dictionary)

const DIR := "user://content"
const MANIFEST_PATH := "user://content/manifest.json"
const RETRIES := 3

var online: PyraOnline
var manifest: Dictionary = {}
var pack_base := ""
var news := ""
var mounted: Dictionary = {}          # pack id -> true
var busy := false
var cancelled := false

## True when the game carries all its data itself (editor, full desktop export): nothing to download.
static var embedded_state := -1   # decided once, before any pack is mounted (a mounted pack also makes the file exist)

static func embedded() -> bool:
	if embedded_state < 0:
		embedded_state = 1 if FileAccess.file_exists("res://data/lands/pyra/land.json") and not OS.get_cmdline_user_args().has("--force-content") else 0
	return embedded_state == 1

func version() -> String:
	return str(manifest.get("version", ""))

func has_manifest() -> bool:
	return not manifest.is_empty()

func load_cached_manifest() -> void:
	if FileAccess.file_exists(MANIFEST_PATH):
		var value: Variant = JSON.parse_string(FileAccess.get_file_as_string(MANIFEST_PATH))
		if value is Dictionary and value.has("manifest"):
			manifest = value.manifest
			pack_base = str(value.get("packBase", ""))

func store_manifest(raw: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	var file := FileAccess.open(MANIFEST_PATH, FileAccess.WRITE)
	if file != null:
		file.store_string(JSON.stringify(raw))
		file.close()

## Asks the server for the active release. Returns {"ok", "status", "message", "blocked"}: blocked = maintenance or client too old.
func fetch_manifest() -> Dictionary:
	var result := await online.request(HTTPClient.METHOD_GET, "/ws/godot/manifest?client=%d" % KiNet.CLIENT_CODE, null, true, 15.0)
	var status := int(result.status)
	if status == 200 and result.json is Dictionary and result.json.has("manifest"):
		manifest = result.json.manifest
		pack_base = str(result.json.packBase)
		news = str(result.json.get("news", ""))
		store_manifest(result.json)
		return {"ok": true, "status": status}
	var message := PyraOnline.message_of(result, "Serwer nie odpowiada.")
	return {"ok": false, "status": status, "message": message, "blocked": status == 503 and result.json is Dictionary or status == 426}

# ---- what a land needs --------------------------------------------------------------------------------

func packs_for_land(land: String) -> Array:
	var list: Variant = (manifest.get("lands", {}) as Dictionary).get(land, [])
	return list if list is Array else []

func pack_file(id: String) -> String:
	return "%s/%s" % [DIR, str(manifest.packs[id].file)]

## The pack's files are readable (it is mounted, or the build carries it itself).
func present(id: String) -> bool:
	if embedded() or mounted.has(id):
		return true
	return false

func cached(id: String) -> bool:
	if not manifest.get("packs", {}).has(id):
		return false
	var path := pack_file(id)
	if not FileAccess.file_exists(path):
		return false
	var file := FileAccess.open(path, FileAccess.READ)
	if file == null:
		return false
	var size := file.get_length()
	file.close()
	return size == int(manifest.packs[id].bytes)

func missing_for(land: String) -> Array:
	var out: Array = []
	if embedded():
		return out
	for id: String in packs_for_land(land):
		if not present(id):
			out.append(id)
	return out

func all_packs() -> Array:
	return (manifest.get("packs", {}) as Dictionary).keys()

func bytes_to_download(ids: Array) -> int:
	var total := 0
	for id: String in ids:
		if not present(id) and not cached(id):
			total += int(manifest.packs[id].bytes)
	return total

# ---- download and mount --------------------------------------------------------------------------------

func mount(id: String) -> bool:
	if mounted.has(id):
		return true
	var global := ProjectSettings.globalize_path(pack_file(id))
	if ProjectSettings.load_resource_pack(global, true):
		mounted[id] = true
		return true
	return false

## Makes the packs readable: mounts cached ones, downloads the rest (progress signal), verifies SHA-256. {"ok": bool, "message": ""}
func ensure(ids: Array) -> Dictionary:
	if embedded():
		return {"ok": true}
	busy = true
	cancelled = false
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	var todo: Array = []
	for id: String in ids:
		if not present(id):
			todo.append(id)
	var total_bytes := 0
	for id: String in todo:
		total_bytes += int(manifest.packs[id].bytes)
	var done_before := 0
	for index in todo.size():
		var id: String = todo[index]
		var entry: Dictionary = manifest.packs[id]
		if not cached(id):
			var got := await download(id, index, todo.size(), done_before, total_bytes)
			if not got.ok:
				busy = false
				return got
		if not mount(id):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(pack_file(id)))
			busy = false
			return {"ok": false, "message": "Nie udało się wczytać paczki %s." % id}
		done_before += int(entry.bytes)
		progress.emit({"pack": id, "index": index + 1, "count": todo.size(), "done": done_before, "total": total_bytes})
	busy = false
	return {"ok": true}

func download(id: String, index: int, count: int, done_before: int, total_bytes: int) -> Dictionary:
	var entry: Dictionary = manifest.packs[id]
	var final_path := pack_file(id)
	var part := final_path + ".part"
	var url: String = online.server + pack_base + str(entry.file)
	var last_message := ""
	for attempt in RETRIES:
		if cancelled:
			return {"ok": false, "message": "Przerwano."}
		var http := HTTPRequest.new()
		http.download_file = part
		http.timeout = 0.0
		http.use_threads = true
		online.add_child(http)
		var headers:=PackedStringArray()
		if online.access_token!="":headers.append("Authorization: Bearer "+online.access_token)
		var error := http.request(url,headers)
		if error != OK:
			http.queue_free()
			last_message = "Nie można połączyć się z serwerem."
			await online.get_tree().create_timer(1.5 * float(attempt + 1)).timeout
			continue
		var state := {"finished": false, "result": 0, "code": 0}   # a dictionary: lambdas capture plain variables by value
		http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
			state.result = result
			state.code = code
			state.finished = true)
		while not bool(state.finished):
			if cancelled:
				http.cancel_request()
				http.queue_free()
				return {"ok": false, "message": "Przerwano."}
			progress.emit({"pack": id, "index": index + 1, "count": count, "done": done_before + http.get_downloaded_bytes(), "total": total_bytes})
			await online.get_tree().process_frame
		http.queue_free()
		if int(state.result) != HTTPRequest.RESULT_SUCCESS or int(state.code) != 200:
			last_message = "Pobieranie nie powiodło się (kod %d)." % int(state.code)
			DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
			await online.get_tree().create_timer(1.5 * float(attempt + 1)).timeout
			continue
		var file := FileAccess.open(part, FileAccess.READ)
		var size := file.get_length() if file != null else -1
		if file != null:
			file.close()
		if size != int(entry.bytes) or FileAccess.get_sha256(part) != str(entry.sha256):
			last_message = "Paczka %s jest uszkodzona (suma kontrolna)." % id
			DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
			continue
		DirAccess.rename_absolute(ProjectSettings.globalize_path(part), ProjectSettings.globalize_path(final_path))
		return {"ok": true}
	return {"ok": false, "message": last_message if last_message != "" else "Nie udało się pobrać paczki %s." % id}

## The service world is requested only after the administrator has signed in.
func ensure_service_preview() -> Dictionary:
	var refreshed := await fetch_manifest()
	if not refreshed.ok:
		return refreshed
	# c101 is the existing isolated prototype pack format. C102 never mounts
	# it during boot. Mount it here after an authenticated manifest request.
	const PREVIEW_PACK := "core-c101"
	if not manifest.get("packs", {}).has(PREVIEW_PACK):
		return {"ok": false, "message": "Serwer nie udostępnia paczki prototypu."}
	var entry: Dictionary = manifest.packs[PREVIEW_PACK]
	if mounted.get(PREVIEW_PACK) == entry.file:
		return {"ok": true}
	var path := pack_file(PREVIEW_PACK)
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	busy = true
	cancelled = false
	if not cached(PREVIEW_PACK) or FileAccess.get_sha256(path) != str(entry.sha256):
		var result := await download(PREVIEW_PACK, 0, 1, 0, int(entry.bytes))
		if not result.ok:
			busy = false
			return result
	busy = false
	if not ProjectSettings.load_resource_pack(ProjectSettings.globalize_path(path), true):
		return {"ok": false, "message": "Nie udało się wczytać paczki prototypu."}
	mounted[PREVIEW_PACK] = entry.file
	return {"ok": true}

func ensure_land(land: String) -> Dictionary:
	if not has_manifest():
		return {"ok": false, "message": "Brak informacji o treści gry. Połącz się z internetem."}
	if not (manifest.lands as Dictionary).has(land):
		return {"ok": false, "message": "Serwer nie zna krainy %s." % land}
	return await ensure(packs_for_land(land))

## Removes packs of older releases (they are named by hash, so a changed pack is a new file).
func prune() -> void:
	if not has_manifest():
		return
	var keep: Dictionary = {}
	for id: String in manifest.packs:
		keep[str(manifest.packs[id].file)] = true
	var dir := DirAccess.open(DIR)
	if dir == null:
		return
	for name in dir.get_files():
		if name.ends_with(".pck") and not keep.has(name):
			dir.remove(name)
		elif name.ends_with(".part"):
			dir.remove(name)
