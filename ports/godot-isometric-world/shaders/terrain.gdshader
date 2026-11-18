shader_type canvas_item;
render_mode unshaded;

uniform sampler2D mat_0_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_1_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_2_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_3_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D water_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
uniform vec3 surface_color = vec3(1.0, 0.28, 0.04);
uniform float uv_scale = 88.0;

void fragment() {
	vec4 weights = texture(weights_tex, UV);
	weights /= max(dot(weights, vec4(1.0)), 0.001);
	vec2 uv = UV * uv_scale;

	vec3 c0 = texture(mat_0_tex, uv).rgb;
	vec3 c1 = texture(mat_1_tex, uv).rgb;
	vec3 c2 = texture(mat_2_tex, uv * 1.25).rgb;
	vec3 c3 = texture(mat_3_tex, uv * 0.85).rgb;

	vec3 ground = c0 * weights.r + c1 * weights.g + c2 * weights.b + c3 * weights.a;
	vec4 surf = texture(surface_tex, UV);

	// Spline Road & Plaza stone paving (Blue channel of surface_tex)
	float road_m = surf.b;
	if (road_m > 0.02) {
		float curb = smoothstep(0.12, 0.32, road_m) * (1.0 - smoothstep(0.32, 0.56, road_m));
		vec3 road_col = mix(c2 * 1.12, vec3(0.86, 0.78, 0.64), 0.18);
		road_col = mix(road_col, road_col * 0.62, curb * 0.85);
		ground = mix(ground, road_col, smoothstep(0.10, 0.48, road_m));
	}

	// Apply vertex hillshading & relief normals ONLY to solid ground and roads
	vec3 final_rgb = ground * COLOR.rgb;

	// Vivid Water: Rivers, Lakes, Ocean Bays (Green channel of surface_tex)
	float water_m = surf.g;
	if (water_m > 0.05) {
		vec2 w_uv1 = uv * 0.55 + vec2(TIME * 0.035, -TIME * 0.022);
		vec2 w_uv2 = uv * 0.80 + vec2(-TIME * 0.024, TIME * 0.031);
		vec3 w_tex = 0.5 * texture(water_tex, w_uv1).rgb + 0.5 * texture(water_tex, w_uv2).rgb;
		float wave = sin(uv.x * 3.8 + TIME * 2.1) * cos(uv.y * 3.4 - TIME * 1.8) * 0.5 + 0.5;
		vec3 shallow_col = mix(vec3(0.10, 0.68, 0.82), w_tex * 1.25, 0.35);
		vec3 deep_col = mix(vec3(0.04, 0.28, 0.62), w_tex * 0.95, 0.35);
		vec3 water_rgb = mix(shallow_col, deep_col, smoothstep(0.28, 0.82, water_m));
		water_rgb += vec3(0.22, 0.52, 0.68) * pow(wave, 3.0) * 0.38;
		float foam = smoothstep(0.14, 0.32, water_m) * (1.0 - smoothstep(0.32, 0.54, water_m));
		foam += pow(wave, 5.0) * 0.22 * smoothstep(0.25, 0.75, water_m);
		water_rgb = mix(water_rgb, vec3(0.92, 0.98, 1.0), clamp(foam * 0.9, 0.0, 0.92));
		final_rgb = mix(final_rgb, water_rgb, smoothstep(0.12, 0.38, water_m));
	}

	// Molten Lava & Magma Calderas (Red channel of surface_tex) — Pure Emissive
	float lava_m = surf.r;
	if (lava_m > 0.05) {
		vec2 l_uv1 = uv * 0.45 + vec2(TIME * 0.022, TIME * 0.015);
		vec2 l_uv2 = uv * 0.72 + vec2(-TIME * 0.018, TIME * 0.024);
		vec3 l_tex = 0.5 * texture(water_tex, l_uv1).rgb + 0.5 * texture(water_tex, l_uv2).rgb;
		float pulse = 0.5 + 0.5 * sin(uv.x * 2.6 + uv.y * 2.2 + TIME * 2.4);
		float core = smoothstep(0.38, 0.88, lava_m);
		vec3 crust_col = vec3(0.45, 0.08, 0.02);
		vec3 magma_orange = vec3(1.0, 0.36, 0.04);
		vec3 magma_yellow = vec3(1.0, 0.88, 0.24);
		vec3 lava_rgb = mix(crust_col, magma_orange, smoothstep(0.18, 0.55, lava_m));
		lava_rgb = mix(lava_rgb, magma_yellow, core * (0.45 + 0.45 * pulse));
		lava_rgb = mix(lava_rgb, l_tex * vec3(1.3, 0.65, 0.15), 0.28);
		float rim_ember = smoothstep(0.10, 0.26, lava_m) * (1.0 - smoothstep(0.26, 0.46, lava_m));
		lava_rgb += vec3(1.0, 0.42, 0.08) * rim_ember * 0.75;
		final_rgb = mix(final_rgb, lava_rgb, smoothstep(0.10, 0.34, lava_m));
	}

	// Cyan Ki Conduits / Waterfall Cascade Foam (Alpha channel of surface_tex)
	float energy_m = 1.0 - surf.a;
	if (energy_m > 0.05) {
		float e_pulse = 0.65 + 0.35 * sin(uv.x * 4.5 - uv.y * 4.5 + TIME * 3.5);
		vec3 energy_rgb = mix(vec3(0.18, 0.82, 1.0), vec3(0.88, 0.98, 1.0), energy_m * e_pulse);
		final_rgb = mix(final_rgb, energy_rgb, smoothstep(0.10, 0.45, energy_m));
	}

	COLOR = vec4(final_rgb, 1.0);
}
