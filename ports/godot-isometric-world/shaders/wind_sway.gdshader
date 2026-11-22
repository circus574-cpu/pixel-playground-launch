shader_type canvas_item;

uniform float sway_strength : hint_range(0.0, 16.0) = 3.2;
uniform float sway_speed : hint_range(0.2, 5.0) = 1.65;
uniform float phase_offset = 0.0;

void vertex() {
	// Anchor trunk/roots at UV.y == 1.0, sway upper canopy smoothly with breeze
	float flex = clamp(1.0 - UV.y, 0.0, 1.0);
	float flex2 = flex * flex;
	float gust = sin(TIME * sway_speed + phase_offset) * 0.72 + sin(TIME * sway_speed * 2.13 + phase_offset * 1.7) * 0.28;
	VERTEX.x += gust * sway_strength * flex2;
}
