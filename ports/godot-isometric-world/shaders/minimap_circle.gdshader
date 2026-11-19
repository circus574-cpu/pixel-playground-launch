shader_type canvas_item;

uniform vec2 center_uv = vec2(0.5, 0.5);
uniform float zoom = 2.0;

void fragment() {
	vec2 p = UV - vec2(0.5);
	float r = length(p) * 2.0;
	if (r > 1.0) {
		discard;
	}
	vec2 sample_uv = center_uv + p / max(zoom, 1.0);
	vec4 col = vec4(0.05, 0.07, 0.09, 1.0);
	if (sample_uv.x >= 0.0 && sample_uv.x <= 1.0 && sample_uv.y >= 0.0 && sample_uv.y <= 1.0) {
		col = texture(TEXTURE, sample_uv);
	} else {
		// Deep ocean abyss outside continent edge
		float grid = sin(sample_uv.x * 160.0) * sin(sample_uv.y * 160.0) * 0.015;
		col = vec4(0.04 + grid, 0.08 + grid, 0.13 + grid, 1.0);
	}

	// Subtle glass lens inner rim shadow + warm cartographic contrast
	float inner_vig = smoothstep(0.72, 1.0, r);
	col.rgb *= mix(1.04, 0.58, inner_vig);

	// Very subtle top-left crystal specular glint
	float glint = smoothstep(0.55, 0.0, length(p - vec2(-0.18, -0.20))) * 0.07;
	col.rgb += vec3(0.95, 0.92, 0.85) * glint;

	// Smooth anti-aliased circular edge
	float edge_alpha = 1.0 - smoothstep(0.972, 1.0, r);
	COLOR = vec4(col.rgb, col.a * edge_alpha);
}
