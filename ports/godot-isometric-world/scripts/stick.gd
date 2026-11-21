extends Control
var world: Node2D

func _draw() -> void:
	if world == null or world.map_expanded or world.atlas_expanded:
		return
	if world.move_pointer < 0:
		return
	if world.rpg_hud != null and (world.rpg_hud.show_talents or world.rpg_hud.show_character):
		return
	if ("game_menu" in world and world.game_menu != null and world.game_menu.visible):
		return
	if ("quest_journal" in world and world.quest_journal != null and world.quest_journal.visible):
		return
	if ("gm_panel" in world and world.gm_panel != null and world.gm_panel.visible):
		return
	if ("npc_dialogue" in world and world.npc_dialogue != null and world.npc_dialogue.visible):
		return
	var center: Vector2 = world.move_origin
	var displacement: Vector2 = world.motion * 46.0
	# Outer forged base
	draw_circle(center, 62.0, Color(0.04, 0.035, 0.05, 0.42))
	draw_arc(center, 62.0, 0.0, TAU, 48, Color(0.86, 0.68, 0.34, 0.72), 2.5, true)
	draw_arc(center, 58.0, 0.0, TAU, 48, Color(0.18, 0.14, 0.10, 0.65), 1.5, true)
	# Inner deadzone ring (14 px)
	draw_arc(center, 14.0, 0.0, TAU, 24, Color(0.86, 0.68, 0.34, 0.32), 1.4, true)
	# Thumb knob
	var knob := center + displacement
	draw_circle(knob, 25.0, Color(0.12, 0.10, 0.09, 0.86))
	draw_circle(knob, 21.0, Color(0.84, 0.64, 0.30, 0.68))
	draw_arc(knob, 24.0, 0.0, TAU, 32, Color(1.0, 0.88, 0.56, 0.90), 2.2, true)

