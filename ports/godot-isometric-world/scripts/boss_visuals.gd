extends RefCounted
## Directional sprites baked from Meshy GLBs for the isometric renderer.

const CELL := 256
const SHEET_DIR := "res://assets/monsters/boss-premium/"
const DIRECTIONS := ["down", "down-left", "left", "up-left", "up", "up-right", "right", "down-right"]

static func actor_definition(boss_id: String, fallback: Dictionary) -> Dictionary:
	if fallback.is_empty():
		return fallback
	var sheet := SHEET_DIR + boss_id + ".webp"
	if not FileAccess.file_exists(sheet) and not ResourceLoader.exists(sheet):
		return fallback
	var definition := fallback.duplicate()
	definition["cell"] = CELL
	definition["boss_motion"] = true
	definition["origin"] = [0.5, 0.8195]
	var original_clips: Dictionary = fallback.get("clips", {})
	var clips := {}
	# Preserve the original timing metadata. The baked view is held for each clip
	# until dedicated motion frames are available.
	for clip_name: String in original_clips:
		var original: Dictionary = original_clips[clip_name]
		var original_directions: Dictionary = original.get("directions", {})
		var frames := {}
		for index in range(DIRECTIONS.size()):
			var facing: String = DIRECTIONS[index]
			var rect := [(index % 4) * CELL, (index >> 2) * CELL, CELL, CELL, 0, 0, 0, 0]
			var original_frames: Array = original_directions.get(facing, original_directions.get("down", []))
			var still_frames := []
			still_frames.resize(maxi(1, original_frames.size()))
			still_frames.fill(rect)
			frames[facing] = still_frames
		clips[clip_name] = {"sheet": sheet, "directions": frames, "fps": original.get("fps", 12.0), "loop": original.get("loop", true)}
	definition["clips"] = clips
	return definition
