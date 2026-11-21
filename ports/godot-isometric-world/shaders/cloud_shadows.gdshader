shader_type canvas_item;

uniform vec2 drift = vec2(0.015, 0.008);
uniform float intensity = 0.10;
uniform vec4 tint_color = vec4(1.0, 1.0, 1.0, 0.0);

float hash(vec2 p) {
	return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

float noise(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(
		mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
		mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
		u.y
	);
}

float fbm(vec2 p) {
	float v = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		v += a * noise(p);
		p *= 2.02;
		a *= 0.5;
	}
	return v;
}

void fragment() {
	vec2 uv = UV * vec2(3.6, 2.2) + drift * TIME;
	float c = fbm(uv);
	float cloud_shade = smoothstep(0.48, 0.78, c) * intensity;

	// Subtle soft vignette at screen edges for cinematic depth
	vec2 p = UV - vec2(0.5);
	float vig = smoothstep(0.46, 0.84, length(p)) * 0.16;

	// Blend cloud shadow darkness + time-of-day atmospheric tint
	vec3 dark_col = vec3(0.02, 0.04, 0.08);
	float dark_a = clamp(cloud_shade + vig, 0.0, 0.34);
	vec3 out_rgb = mix(dark_col, tint_color.rgb, clamp(tint_color.a * 1.4, 0.0, 1.0));
	float out_a = clamp(max(dark_a, tint_color.a), 0.0, 0.42);
	COLOR = vec4(out_rgb, out_a);
}
