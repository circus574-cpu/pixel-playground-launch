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

const MAX_PARALLEL := 4
const RANGE_MIN_BYTES := 2097152

func _verify_pack_file(path: String, want_bytes: int, want_sha: String) -> bool:
	if not FileAccess.file_exists(path):
		return false
	var probe := FileAccess.open(path, FileAccess.READ)
	var sz := probe.get_length() if probe != null else -1
	if probe != null:
		probe.close()
	return sz == want_bytes and FileAccess.get_sha256(path) == want_sha

func _download_ranged(id: String, done_before: int, total_bytes: int, total_count: int) -> bool:
	var entry: Dictionary = manifest.packs[id]
	var want_bytes := int(entry.bytes)
	var want_sha := str(entry.sha256)
	var final_path := pack_file(id)
	var part := final_path + ".part"
	var url: String = online.server + pack_base + str(entry.file)
	var n := MAX_PARALLEL
	var seg_size := int(ceili(float(want_bytes) / float(n)))
	var workers: Array[Dictionary] = []
	var seg_paths: Array[String] = []
	for i in n:
		var old_seg := "%s.s%d" % [part, i]
		if FileAccess.file_exists(old_seg):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(old_seg))
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
		online.add_child(http)
		var headers := PackedStringArray(["Range: bytes=%d-%d" % [s0, s1]])
		if online.access_token != "":
			headers.append("Authorization: Bearer " + online.access_token)
		var w := {"http": http, "path": seg_path, "want": s1 - s0 + 1, "done": false, "result": -1, "code": 0}
		http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
			w["result"] = result
			w["code"] = code
			w["done"] = true)
		if http.request(url, headers) != OK:
			for prev in workers:
				var ph: HTTPRequest = prev["http"]
				ph.cancel_request()
				ph.queue_free()
			http.queue_free()
			for sp in seg_paths:
				if FileAccess.file_exists(sp):
					DirAccess.remove_absolute(ProjectSettings.globalize_path(sp))
			return false
		workers.append(w)

	var last_t := Time.get_ticks_msec()
	var last_b := 0.0
	var smooth_bps := 0.0
	var got_full_200 := ""
	var failed := false
	while true:
		if cancelled:
			failed = true
			break
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
		progress.emit({
			"pack": id,
			"index": 1,
			"count": total_count,
			"done": mini(total_bytes, done_before + int(cur_b)),
			"total": total_bytes,
			"bps": smooth_bps,
			"streams": active_count,
		})
		await online.get_tree().process_frame

	for w in workers:
		var http: HTTPRequest = w["http"]
		if not bool(w["done"]):
			http.cancel_request()
		http.queue_free()

	var ok := false
	if got_full_200 != "" and not cancelled:
		if _verify_pack_file(got_full_200, want_bytes, want_sha):
			DirAccess.rename_absolute(ProjectSettings.globalize_path(got_full_200), ProjectSettings.globalize_path(final_path))
			ok = true
	elif not failed and not cancelled:
		var all_len_ok := true
		for w in workers:
			var pr := FileAccess.open(str(w["path"]), FileAccess.READ)
			var sz := pr.get_length() if pr != null else -1
			if pr != null:
				pr.close()
			if sz != int(w["want"]):
				all_len_ok = false
				break
		if all_len_ok:
			var out := FileAccess.open(part, FileAccess.WRITE)
			if out != null:
				var merge_ok := true
				for sp in seg_paths:
					var inp := FileAccess.open(sp, FileAccess.READ)
					if inp == null:
						merge_ok = false
						break
					while inp.get_position() < inp.get_length():
						var chunk := inp.get_buffer(mini(1048576, inp.get_length() - inp.get_position()))
						if chunk.is_empty():
							break
						out.store_buffer(chunk)
					inp.close()
				out.close()
				if merge_ok and _verify_pack_file(part, want_bytes, want_sha):
					DirAccess.rename_absolute(ProjectSettings.globalize_path(part), ProjectSettings.globalize_path(final_path))
					ok = true

	for sp in seg_paths:
		if FileAccess.file_exists(sp):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(sp))
	if FileAccess.file_exists(part):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(part))
	return ok

## Makes the packs readable: mounts cached ones, downloads the rest in up to 4 parallel streams (progress signal), verifies SHA-256. {"ok": bool, "message": ""}
func ensure(ids: Array) -> Dictionary:
	if embedded():
		return {"ok": true}
	busy = true
	cancelled = false
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(DIR))
	var todo: Array[String] = []
	for raw_id in ids:
		var id := str(raw_id)
		if not present(id) and manifest.get("packs", {}).has(id):
			todo.append(id)
	var total_bytes := 0
	for id in todo:
		total_bytes += int(manifest.packs[id].bytes)
	var done_bytes := 0
	var completed_count := 0
	var queue: Array[Dictionary] = []

	# Mount already-cached packs immediately first
	for id in todo:
		var entry: Dictionary = manifest.packs[id]
		if cached(id):
			if mount(id):
				done_bytes += int(entry.bytes)
				completed_count += 1
				progress.emit({"pack": id, "index": completed_count, "count": todo.size(), "done": done_bytes, "total": total_bytes, "bps": 0.0, "streams": 1})
				continue
			DirAccess.remove_absolute(ProjectSettings.globalize_path(pack_file(id)))
		queue.append({"id": id, "entry": entry, "attempts": 0})

	# Single large pack (>= 2 MB): split into 4 parallel HTTP Range streams
	if queue.size() == 1 and int((queue[0]["entry"] as Dictionary).bytes) >= RANGE_MIN_BYTES:
		var sid := str(queue[0]["id"])
		if await _download_ranged(sid, done_bytes, total_bytes, todo.size()):
			if mount(sid):
				done_bytes += int((queue[0]["entry"] as Dictionary).bytes)
				completed_count += 1
				progress.emit({"pack": sid, "index": completed_count, "count": todo.size(), "done": done_bytes, "total": total_bytes, "bps": 0.0, "streams": MAX_PARALLEL})
				queue.clear()
			else:
				DirAccess.remove_absolute(ProjectSettings.globalize_path(pack_file(sid)))

	var active: Array[Dictionary] = []
	var last_t := Time.get_ticks_msec()
	var last_b := float(done_bytes)
	var smooth_bps := 0.0
	var last_error := ""

	while not queue.is_empty() or not active.is_empty():
		if cancelled:
			for w in active:
				var h: HTTPRequest = w["http"]
				h.cancel_request()
				h.queue_free()
				if FileAccess.file_exists(str(w["part"])):
					DirAccess.remove_absolute(ProjectSettings.globalize_path(str(w["part"])))
			busy = false
			return {"ok": false, "message": "Przerwano."}

		while active.size() < MAX_PARALLEL and not queue.is_empty():
			var job: Dictionary = queue.pop_front()
			var id := str(job["id"])
			var entry: Dictionary = job["entry"]
			var final_path := pack_file(id)
			var part := final_path + ".part"
			var url: String = online.server + pack_base + str(entry.file)
			var http := HTTPRequest.new()
			http.download_file = part
			http.download_chunk_size = 1048576
			http.body_size_limit = -1
			http.timeout = 0.0
			http.use_threads = true
			online.add_child(http)
			var headers := PackedStringArray()
			if online.access_token != "":
				headers.append("Authorization: Bearer " + online.access_token)
			var worker := {"job": job, "id": id, "final": final_path, "part": part, "http": http, "done": false, "result": -1, "code": 0}
			http.request_completed.connect(func(result: int, code: int, _h: PackedStringArray, _b: PackedByteArray) -> void:
				worker["result"] = result
				worker["code"] = code
				worker["done"] = true)
			if http.request(url, headers) != OK:
				http.queue_free()
				job["attempts"] = int(job["attempts"]) + 1
				last_error = "Nie można połączyć się z serwerem."
				if int(job["attempts"]) < RETRIES:
					queue.append(job)
				else:
					for w in active:
						var ah: HTTPRequest = w["http"]
						ah.cancel_request()
						ah.queue_free()
					busy = false
					return {"ok": false, "message": last_error}
			else:
				active.append(worker)

		var in_flight := 0
		var still_active: Array[Dictionary] = []
		var active_pack := ""
		for w in active:
			var http: HTTPRequest = w["http"]
			if bool(w["done"]):
				http.queue_free()
				var job: Dictionary = w["job"]
				var id := str(w["id"])
				var entry: Dictionary = job["entry"]
				var part_p := str(w["part"])
				var final_p := str(w["final"])
				var valid := false
				if int(w["result"]) == HTTPRequest.RESULT_SUCCESS and int(w["code"]) == 200 and _verify_pack_file(part_p, int(entry.bytes), str(entry.sha256)):
					DirAccess.rename_absolute(ProjectSettings.globalize_path(part_p), ProjectSettings.globalize_path(final_p))
					if mount(id):
						done_bytes += int(entry.bytes)
						completed_count += 1
						valid = true
					else:
						DirAccess.remove_absolute(ProjectSettings.globalize_path(final_p))
						last_error = "Nie udało się wczytać paczki %s." % id
				else:
					last_error = "Pobieranie nie powiodło się (kod %d)." % int(w["code"]) if int(w["code"]) != 200 else "Paczka %s jest uszkodzona (suma kontrolna)." % id
				if not valid:
					if FileAccess.file_exists(part_p):
						DirAccess.remove_absolute(ProjectSettings.globalize_path(part_p))
					job["attempts"] = int(job["attempts"]) + 1
					if int(job["attempts"]) < RETRIES:
						queue.append(job)
					else:
						for rem in active:
							if rem != w and not bool(rem["done"]):
								var rh: HTTPRequest = rem["http"]
								rh.cancel_request()
								rh.queue_free()
						busy = false
						return {"ok": false, "message": last_error}
			else:
				in_flight += http.get_downloaded_bytes()
				if active_pack == "":
					active_pack = str(w["id"])
				still_active.append(w)
		active = still_active

		var cur_total := mini(total_bytes, done_bytes + in_flight)
		var now_t := Time.get_ticks_msec()
		var dt_ms := now_t - last_t
		if dt_ms >= 200:
			var inst_bps := maxf(0.0, float(cur_total) - last_b) / (float(dt_ms) / 1000.0)
			smooth_bps = inst_bps if smooth_bps <= 1.0 else lerpf(smooth_bps, inst_bps, 0.35)
			last_t = now_t
			last_b = float(cur_total)
		progress.emit({
			"pack": active_pack,
			"index": mini(completed_count + active.size(), todo.size()),
			"count": todo.size(),
			"done": cur_total,
			"total": total_bytes,
			"bps": smooth_bps,
			"streams": maxi(1, active.size()),
		})
		await online.get_tree().process_frame

	busy = false
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
		elif name.ends_with(".part") or ".part.s" in name:
			dir.remove(name)
