// The two views shade water from the same world-space UV and river mask.
vec3 study_water(vec2 uv, float depth, float clock) {
	vec2 p = uv * 1024.0;
	float shore = 1.0 - smoothstep(0.48, 1.0, depth);
	float swell = sin(p.x * 0.22 + p.y * 0.12 + clock * 0.48);
	float ripple = sin(p.y * 0.73 - p.x * 0.12 + swell * 0.64 + clock * 0.72);
	float sparkle = pow(max(0.0, ripple), 12.0) * (0.35 + 0.65 * max(0.0, swell));
	vec3 deep = vec3(0.035, 0.32, 0.59);
	vec3 shallow = vec3(0.13, 0.70, 0.80);
	vec3 color = mix(deep, shallow, shore * 0.85 + (swell + 1.0) * 0.035);
	return color + sparkle * vec3(0.065, 0.13, 0.13);
}
