shader_type canvas_item;
render_mode unshaded;

uniform sampler2D mat_0_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_1_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_2_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_3_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D water_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
uniform sampler2D map_art_tex : source_color, filter_linear;
uniform vec3 surface_color = vec3(1.0, 0.28, 0.04);
uniform float uv_scale = 88.0;
uniform float world_scale = 1.0;
uniform float map_tint_strength = 0.56;

float hash21(vec2 p) {
	p = fract(p * vec2(123.34, 456.21));
	p += dot(p, p + 45.32);
	return fract(p.x * p.y);
}

float vnoise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = hash21(i);
	float b = hash21(i + vec2(1.0, 0.0));
	float c = hash21(i + vec2(0.0, 1.0));
	float d = hash21(i + vec2(1.0, 1.0));
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
	float v = 0.0;
	float amp = 0.5;
	for (int i = 0; i < 3; i++) {
		v += amp * vnoise(p);
		p *= 2.04;
		amp *= 0.5;
	}
	return v;
}

void fragment() {
	vec4 weights = texture(weights_tex, UV);
	weights /= max(dot(weights, vec4(1.0)), 0.001);
	vec2 uv = UV * uv_scale;
	float ws = max(world_scale, 1.0);

	// Single fast macro noise (4 hashes instead of 40!) for dappled sunlight & ground variety
	float n_macro = vnoise(UV * 22.0);

	// Skip unused material texture fetches on mobile GPU (saves 50-70% texture bandwidth)
	vec3 ground = vec3(0.0);
	vec3 c2 = vec3(0.55);
	if (weights.r > 0.01) ground += texture(mat_0_tex, uv).rgb * weights.r;
	if (weights.g > 0.01) ground += texture(mat_1_tex, uv * 0.92).rgb * weights.g;
	if (weights.b > 0.01) {
		c2 = texture(mat_2_tex, uv * 1.25).rgb;
		ground += c2 * weights.b;
	}
	if (weights.a > 0.01) ground += texture(mat_3_tex, uv * 0.85).rgb * weights.a;

	// 1:1 Macro Biome Color Sync with Canonical map_art.png
	vec3 map_col = texture(map_art_tex, UV).rgb;
	float pbr_lum = max(dot(ground, vec3(0.299, 0.587, 0.114)), 0.08);
	float map_lum = max(dot(map_col, vec3(0.299, 0.587, 0.114)), 0.08);
	vec3 detail_grain = clamp(ground / pbr_lum, vec3(0.55), vec3(1.55));
	vec3 synced_ground = clamp(map_col * mix(vec3(1.0), detail_grain, 0.70), vec3(0.0), vec3(1.0));
	float is_snow = smoothstep(0.68, 0.84, map_lum) * (1.0 - smoothstep(0.18, 0.34, max(max(map_col.r, map_col.g), map_col.b) - min(min(map_col.r, map_col.g), map_col.b)));
	ground = mix(ground, synced_ground, clamp(map_tint_strength + is_snow * 0.25, 0.0, 0.88));
	ground *= mix(0.90, 1.10, n_macro);

	vec4 surf = texture(surface_tex, UV);
	float has_surface = surf.r + surf.g + surf.b + (1.0 - surf.a);

	// Fast-path: plain solid ground skips all shore/road/water/lava/conduit noise & branches!
	if (has_surface <= 0.015) {
		COLOR = vec4(ground * COLOR.rgb, 1.0);
	} else {
		float n_shore = vnoise(UV * 68.0 * sqrt(ws));

		// 1. Organic Flagstone / Cobblestone Spline Roads (Blue channel of surface_tex)
		float road_raw = surf.b + (n_shore - 0.5) * 0.14;
		if (road_raw > 0.06) {
			if (weights.b <= 0.01) {
				c2 = texture(mat_2_tex, uv * 1.25).rgb;
			}
			float road_alpha = smoothstep(0.14, 0.44, road_raw);
			float curb = smoothstep(0.12, 0.28, road_raw) * (1.0 - smoothstep(0.28, 0.50, road_raw));
			vec3 road_col = mix(c2 * 1.06, vec3(0.84, 0.77, 0.65), 0.12);
			road_col *= mix(0.94, 1.06, n_shore);
			road_col = mix(road_col, road_col * 0.66, curb * 0.78);
			ground = mix(ground, road_col, road_alpha);
		}

		// Apply vertex hillshading & relief normals to solid ground and roads
		vec3 final_rgb = ground * COLOR.rgb;

		// 2. Painterly Water (single-octave fast caustics)
		if (surf.g > 0.01) {
			float water_m = surf.g + (n_shore - 0.5) * 0.18;
			if (water_m > 0.02) {
				float wet_bank = smoothstep(0.03, 0.19, water_m) * (1.0 - smoothstep(0.22, 0.36, water_m));
				final_rgb *= (1.0 - wet_bank * 0.30);

				if (water_m > 0.14) {
					vec2 w_uv1 = uv * 0.48 + vec2(TIME * 0.024, -TIME * 0.016);
					vec2 w_uv2 = uv * 0.74 + vec2(-TIME * 0.018, TIME * 0.022);
					vec3 w_tex = 0.5 * texture(water_tex, w_uv1).rgb + 0.5 * texture(water_tex, w_uv2).rgb;

					float c_n = vnoise(uv * 1.55 + vec2(TIME * 0.28, -TIME * 0.22));
					float caustic = smoothstep(0.55, 0.92, c_n);

					float depth = smoothstep(0.20, 0.82, water_m);
					vec3 shallow_col = mix(vec3(0.10, 0.56, 0.66), w_tex * 1.05, 0.32);
					vec3 deep_col = mix(vec3(0.03, 0.20, 0.42), w_tex * 0.72, 0.28);
					vec3 water_rgb = mix(shallow_col, deep_col, depth);

					water_rgb += vec3(0.26, 0.62, 0.72) * caustic * (1.0 - depth * 0.55) * 0.48;
					float wave_glint = pow(max(0.0, sin(uv.x * 3.2 + uv.y * 2.1 + TIME * 1.8 + n_shore * 5.0)), 6.0);
					water_rgb += vec3(0.62, 0.84, 0.94) * wave_glint * 0.20;

					float shore_band = smoothstep(0.16, 0.25, water_m) * (1.0 - smoothstep(0.26, 0.40, water_m));
					float broken_foam = shore_band * smoothstep(0.32, 0.74, n_shore + 0.15 * sin(TIME * 2.2 + uv.x * 2.0));
					water_rgb = mix(water_rgb, vec3(0.86, 0.95, 0.98), clamp(broken_foam * 0.72, 0.0, 0.72));

					float water_alpha = smoothstep(0.15, 0.30, water_m);
					final_rgb = mix(final_rgb, water_rgb, water_alpha);
				}
			}
		}

		// 3. Volcanic Lava (single-octave fast magma veins)
		if (surf.r > 0.01) {
			float lava_m = surf.r + (n_shore - 0.5) * 0.18;
			if (lava_m > 0.02) {
				float scorch_bank = smoothstep(0.03, 0.20, lava_m) * (1.0 - smoothstep(0.24, 0.42, lava_m));
				final_rgb *= (1.0 - scorch_bank * 0.52);
				final_rgb += vec3(0.45, 0.12, 0.02) * scorch_bank * 0.26;

				if (lava_m > 0.14) {
					vec2 flow_uv = uv * 0.65 + vec2(TIME * 0.06, TIME * 0.04);
					float crust_n = vnoise(flow_uv * 2.4);
					float vein_n = abs(vnoise(flow_uv * 3.8 + vec2(crust_n * 1.2)) - 0.5) * 2.0;
					float crack = 1.0 - smoothstep(0.04, 0.28, vein_n);
					float pulse = 0.82 + 0.18 * sin(TIME * 2.3 + crust_n * 6.0);

					float core = smoothstep(0.28, 0.86, lava_m);
					vec3 basalt_crust = vec3(0.14, 0.07, 0.06);
					vec3 magma_red = vec3(0.82, 0.18, 0.02);
					vec3 magma_orange = vec3(1.0, 0.46, 0.05);
					vec3 magma_gold = vec3(1.0, 0.88, 0.34);

					float heat = clamp(core * 0.78 + crack * 0.55 - (1.0 - core) * 0.25, 0.0, 1.0) * pulse;
					vec3 lava_rgb = mix(basalt_crust, magma_red, smoothstep(0.12, 0.38, heat));
					lava_rgb = mix(lava_rgb, magma_orange, smoothstep(0.35, 0.68, heat));
					lava_rgb = mix(lava_rgb, magma_gold, smoothstep(0.66, 0.96, heat));

					float lava_alpha = smoothstep(0.15, 0.30, lava_m);
					final_rgb = mix(final_rgb, lava_rgb, lava_alpha);
				}
			}
		}

		// 4. Cyan Ki Conduits / Waterfall Cascade Foam (Alpha channel of surface_tex)
		if (surf.a < 0.96) {
			float energy_m = (1.0 - surf.a) + (n_shore - 0.5) * 0.08;
			if (energy_m > 0.08) {
				float e_pulse = 0.78 + 0.22 * sin(uv.x * 3.8 - uv.y * 3.8 + TIME * 3.0);
				float e_core = smoothstep(0.20, 0.72, energy_m);
				vec3 energy_rgb = mix(vec3(0.08, 0.58, 0.78), vec3(0.68, 0.96, 1.0), e_core * e_pulse);
				final_rgb = mix(final_rgb, energy_rgb, smoothstep(0.12, 0.42, energy_m) * 0.88);
			}
		}

		COLOR = vec4(final_rgb, 1.0);
	}
}
