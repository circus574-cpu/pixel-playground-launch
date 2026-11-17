// Presentation only. The canonical texture owns shores/lakes and the date-line seam.
uniform sampler2D canonical_tex : source_color, filter_linear_mipmap;
uniform sampler2D relief_tex : source_color, filter_linear_mipmap;
uniform bool linear_input = false;
vec3 map_srgb(vec3 c) {
	return linear_input ? mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)) : c;
}
float map_water(vec3 raw) {
	vec3 c = map_srgb(raw);
	// White/blue glacial relief is land; only saturated dark/mid blue is water.
	return step(0.035, c.b - max(c.r, c.g)) * step(c.r, 0.50) * step(c.g, 0.72);
}
vec3 map_artwork(vec2 uv) {
	vec3 canonical = texture(canonical_tex, uv).rgb;
	vec3 relief = texture(relief_tex, uv).rgb;
	float water = map_water(canonical);
	float same_surface = 1.0 - abs(water - map_water(relief));
	vec2 step_uv = 6.0 / vec2(textureSize(canonical_tex, 0));
	float coast = 0.0;
	for (int x = -1; x <= 1; x++) {
		for (int y = -1; y <= 1; y++) {
			vec2 sample_uv = clamp(uv + vec2(float(x), float(y)) * step_uv, vec2(0.0), vec2(1.0));
			coast = max(coast, abs(water - map_water(texture(canonical_tex, sample_uv).rgb)));
		}
	}
	float seam = smoothstep(0.0, 0.012, min(uv.x, 1.0 - uv.x));
	return mix(canonical, relief, same_surface * (1.0 - coast) * seam);
}
