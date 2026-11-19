shader_type spatial;
render_mode specular_schlick_ggx;

uniform sampler2D map_art_tex : source_color, filter_linear_mipmap;
uniform float is_pyra = 0.0;
uniform float is_aether = 0.0;

void fragment() {
	vec3 col = texture(map_art_tex, UV).rgb;
	// Detect ocean vs land by blue dominance & low brightness
	float ocean = smoothstep(0.04, 0.14, col.b - max(col.r, col.g)) * (1.0 - smoothstep(0.42, 0.62, col.g));

	// Subtle animated ocean wave shimmer
	float wave = sin(UV.x * 160.0 + TIME * 1.4) * cos(UV.y * 140.0 - TIME * 1.1) * 0.025;
	vec3 ocean_col = col + vec3(0.02, 0.06, 0.09) * wave;
	col = mix(col, ocean_col, ocean);

	// Crisp hand-painted relief shading from vertex hillshade
	vec3 shaded = col * mix(vec3(0.88, 0.92, 0.98), COLOR.rgb, 1.0 - ocean * 0.85);

	// Subtle glowing magma veins on Pyra
	vec3 emissive = vec3(0.0);
	if (is_pyra > 0.5) {
		float lava = smoothstep(0.66, 0.88, col.r) * smoothstep(0.18, 0.45, col.g) * (1.0 - smoothstep(0.18, 0.36, col.b));
		emissive += vec3(1.0, 0.46, 0.08) * lava * (1.1 + 0.25 * sin(TIME * 3.0));
	}
	// Subtle crystalline sheen on Aetheria snow peaks
	if (is_aether > 0.5) {
		float snow = smoothstep(0.76, 0.94, min(col.r, min(col.g, col.b)));
		emissive += vec3(0.14, 0.18, 0.24) * snow * 0.35;
	}

	ALBEDO = shaded;
	EMISSION = emissive;
	ROUGHNESS = mix(0.76, 0.16, ocean);
	METALLIC = mix(0.0, 0.08, ocean);
}
