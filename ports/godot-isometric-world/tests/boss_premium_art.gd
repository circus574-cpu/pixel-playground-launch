extends SceneTree

const BossAi := preload("res://scripts/boss_ai_iso.gd")
const BossVisuals := preload("res://scripts/boss_visuals.gd")

class TestWorld extends "res://scripts/world.gd":
	func _ready() -> void:
		set_process(false)
		for node: Node in [ocean_skirt, terrain_mesh, ysort, camera, hud, btn_enter_bldg,
				btn_talk_npc, btn_open_treasure, btn_gather, btn_event_interact, combat_toast_lbl, stick_layer]:
			add_child(node)
		load_databases()

var checks := 0
var failures := 0

func expect(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures += 1
		printerr("FAIL: " + label)

func _initialize() -> void:
	run.call_deferred()

func run() -> void:
	var world := TestWorld.new()
	root.add_child(world)
	var ai := BossAi.new()
	ai.setup(world)
	for land: String in ["pyra", "verdant", "aether", "nexus"]:
		ai.spawn_region_bosses(land)
	expect(world.live_agents.size() == 8, "The world spawns its original eight regional bosses")
	for agent: Dictionary in world.live_agents:
		var actor = agent["node"]
		var definition: Dictionary = actor.definition
		var idle: Dictionary = definition.clips.idle
		expect(str(idle.sheet).begins_with(BossVisuals.SHEET_DIR), "A premium atlas is used by " + str(agent.id))
		expect(actor.is_boss, "The actor retains its boss behavior")
		for facing: String in BossVisuals.DIRECTIONS:
			var name := "idle:" + facing
			var frame := actor.sprite.sprite_frames.get_frame_texture(name, 0) as AtlasTexture
			expect(frame != null and frame.atlas != null and frame.atlas.get_size() == Vector2(1024, 512),
				"Renderable atlas frame " + str(agent.id) + " " + facing)
		var template: Dictionary = world.monsters_db[definition.id].actor if world.monsters_db.has(definition.id) else {}
		if not template.is_empty():
			expect(definition.size == template.size, "Retains guardian scale")
		var fallback := {"id": "original"}
		expect(BossVisuals.actor_definition("missing-art", fallback) == fallback, "Missing texture falls back to guardian")
		actor.play_action("attack", "idle", 1.0)
		actor.one_shot_until -= 0.5
		actor._update_boss_motion(0.05)
		expect(actor.sprite.offset.length() > 4.0, "Visual strike reacts without moving world collision")
		expect(str(actor.sprite.animation).begins_with("attack:"), "Attacks can still request their clip")
	world.free()
	print("Premium boss art — %d/%d checks passed" % [checks - failures, checks])
	quit(1 if failures else 0)
