shader_type canvas_item;

uniform float saturation : hint_range(0.0, 1.5) = 1.0;
uniform float brightness : hint_range(0.1, 1.5) = 1.0;
uniform float inner_vignette : hint_range(0.0, 0.8) = 0.36;
uniform vec4 rim_glow : source_color = vec4(0.0, 0.0, 0.0, 0.0);

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float aa = max(fwidth(r), 0.02);
	float mask = 1.0 - smoothstep(0.96 - aa, 0.98 + aa, r);
	if (mask <= 0.001) {
		discard;
	}

	vec4 tex = texture(TEXTURE, UV);
	float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
	vec3 col = mix(vec3(lum), tex.rgb, saturation) * brightness;

	// Subtle recessed jewel shadow around circular edge
	float vig = smoothstep(0.62, 0.98, r) * inner_vignette;
	col *= (1.0 - vig);

	// Optional radiant inner aura rim for unlocked/available constellation nodes
	float rim = smoothstep(0.72, 0.96, r) * rim_glow.a;
	col = mix(col, rim_glow.rgb, rim * 0.55);

	COLOR = vec4(col, tex.a * mask);
}
