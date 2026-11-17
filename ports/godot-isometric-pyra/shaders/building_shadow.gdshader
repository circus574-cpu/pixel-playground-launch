shader_type canvas_item;
render_mode unshaded;
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float falloff = exp(-3.5 * dot(p, p));
	float edge = 1.0 - smoothstep(0.65, 1.0, max(abs(p.x), abs(p.y)));
	COLOR = vec4(0.10, 0.055, 0.075, 0.42 * falloff * edge);
}
