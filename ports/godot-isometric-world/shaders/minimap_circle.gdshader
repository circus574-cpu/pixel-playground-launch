shader_type canvas_item;

uniform vec2 center_uv = vec2(0.5, 0.5);
uniform float zoom = 3.2;
uniform float rotation_rad = 0.0;
uniform sampler2D surface_tex : filter_linear_mipmap;
uniform float has_surface = 0.0;
uniform float is_aether = 0.0;
uniform float is_pyra = 0.0;

void fragment() {
	vec2 p = UV - vec2(0.5);
	float r = length(p) * 2.0;
	if (r > 1.0) {
		discard;
	}

	// Rotate map around permanently centered hero!
	float ca = cos(rotation_rad);
	float sa = sin(rotation_rad);
	vec2 p_rot = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
	vec2 sample_uv = center_uv + p_rot / max(zoom, 0.8);

	vec4 col = vec4(0.04, 0.08, 0.13, 1.0);
	if (sample_uv.x >= 0.0 && sample_uv.x <= 1.0 && sample_uv.y >= 0.0 && sample_uv.y <= 1.0) {
		col = texture(TEXTURE, sample_uv);

		// Composite REAL in-game roads, lava, and water directly from surface.png!
		if (has_surface > 0.5) {
			vec4 surf = texture(surface_tex, sample_uv);
			float lava_m = surf.r;
			float water_m = surf.g;
			float road_m = surf.b;

			// Subtle crisp edge sharpening for real water & lava channels at close zoom
			float close_t = clamp((zoom - 1.0) / 2.2, 0.0, 1.0);
			if (lava_m > 0.25) {
				vec3 lava_c = mix(vec3(0.95, 0.28, 0.04), vec3(1.0, 0.72, 0.16), smoothstep(0.25, 0.90, lava_m));
				col.rgb = mix(col.rgb, lava_c, clamp(lava_m * (0.45 + 0.35 * close_t), 0.0, 0.85));
			}
			if (water_m > 0.35) {
				vec3 wat_c = is_aether > 0.5 ? vec3(0.22, 0.56, 0.74) : vec3(0.11, 0.36, 0.54);
				col.rgb = mix(col.rgb, wat_c, clamp((water_m - 0.30) * 0.42 * close_t, 0.0, 0.45));
			}

			// Crisp cartographic road casing + warm stone road surface (pixel-exact to world!)
			float road_edge = smoothstep(0.10, 0.26, road_m) * (1.0 - smoothstep(0.32, 0.48, road_m));
			float road_core = smoothstep(0.22, 0.45, road_m);
			vec3 edge_col = is_aether > 0.5 ? vec3(0.18, 0.24, 0.34) : vec3(0.12, 0.08, 0.05);
			vec3 road_col = is_aether > 0.5
				? vec3(0.62, 0.68, 0.76)
				: (is_pyra > 0.5 ? vec3(0.76, 0.64, 0.48) : vec3(0.88, 0.78, 0.56));
			float vis_strength = mix(0.58, 0.92, close_t);
			col.rgb = mix(col.rgb, edge_col, road_edge * 0.72 * vis_strength);
			col.rgb = mix(col.rgb, road_col, road_core * vis_strength);
		}
	} else {
		float grid = sin(sample_uv.x * 160.0) * sin(sample_uv.y * 160.0) * 0.015;
		col = vec4(0.04 + grid, 0.08 + grid, 0.13 + grid, 1.0);
	}

	// Subtle glass lens inner rim shadow + warm cartographic contrast
	float inner_vig = smoothstep(0.74, 1.0, r);
	col.rgb *= mix(1.04, 0.62, inner_vig);

	// Very subtle top-left crystal specular glint
	float glint = smoothstep(0.55, 0.0, length(p - vec2(-0.18, -0.20))) * 0.06;
	col.rgb += vec3(0.95, 0.92, 0.85) * glint;

	float edge_alpha = 1.0 - smoothstep(0.972, 1.0, r);
	COLOR = vec4(col.rgb, col.a * edge_alpha);
}
