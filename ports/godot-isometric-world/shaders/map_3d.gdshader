shader_type spatial;
render_mode specular_schlick_ggx;

uniform sampler2D mat_0_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_1_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_2_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_3_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D water_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
uniform vec3 surface_color = vec3(1.0, 0.28, 0.04);

void fragment() {
	vec4 weights = texture(weights_tex, UV);
	weights /= max(dot(weights, vec4(1.0)), 0.001);
	vec2 uv = UV * 64.0;

	vec3 c0 = texture(mat_0_tex, uv).rgb;
	vec3 c1 = texture(mat_1_tex, uv).rgb;
	vec3 c2 = texture(mat_2_tex, uv * 1.25).rgb;
	vec3 c3 = texture(mat_3_tex, uv * 0.85).rgb;
	vec3 ground = c0 * weights.r + c1 * weights.g + c2 * weights.b + c3 * weights.a;

	vec4 surf = texture(surface_tex, UV);
	float road_m = surf.b;
	if (road_m > 0.02) {
		vec3 road_col = mix(c2 * 1.15, vec3(0.88, 0.80, 0.66), 0.22);
		ground = mix(ground, road_col, smoothstep(0.10, 0.45, road_m));
	}

	vec3 emissive = vec3(0.0);
	float rough = 0.78;

	float water_m = surf.g;
	if (water_m > 0.05) {
		vec3 w_col = mix(vec3(0.12, 0.72, 0.86), vec3(0.04, 0.30, 0.66), smoothstep(0.25, 0.80, water_m));
		float foam = smoothstep(0.14, 0.32, water_m) * (1.0 - smoothstep(0.32, 0.54, water_m));
		w_col = mix(w_col, vec3(0.95, 0.99, 1.0), foam * 0.85);
		ground = mix(ground, w_col, smoothstep(0.12, 0.38, water_m));
		emissive += w_col * 0.28 * smoothstep(0.12, 0.38, water_m);
		rough = mix(rough, 0.18, smoothstep(0.12, 0.38, water_m));
	}

	float lava_m = surf.r;
	if (lava_m > 0.05) {
		vec3 l_col = mix(vec3(0.95, 0.28, 0.03), vec3(1.0, 0.86, 0.22), smoothstep(0.35, 0.85, lava_m));
		ground = mix(ground, l_col, smoothstep(0.10, 0.35, lava_m));
		emissive += l_col * 1.45 * smoothstep(0.10, 0.35, lava_m);
		rough = mix(rough, 0.30, smoothstep(0.10, 0.35, lava_m));
	}

	float energy_m = 1.0 - surf.a;
	if (energy_m > 0.05) {
		vec3 e_col = vec3(0.25, 0.88, 1.0);
		ground = mix(ground, e_col, smoothstep(0.10, 0.45, energy_m));
		emissive += e_col * 1.15 * smoothstep(0.10, 0.45, energy_m);
	}

	ALBEDO = ground;
	EMISSION = emissive;
	ROUGHNESS = rough;
}
