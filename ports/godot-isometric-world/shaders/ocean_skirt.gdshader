shader_type canvas_item;
render_mode unshaded;

uniform sampler2D water_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float uv_scale = 352.0;
uniform float world_scale = 4.0;

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
	vec2 uv = UV * uv_scale;
	float ws = max(world_scale, 1.0);
	float n_shore = fbm(UV * 68.0 * sqrt(ws));
	vec2 w_uv1 = uv * 0.48 + vec2(TIME * 0.024, -TIME * 0.016);
	vec2 w_uv2 = uv * 0.74 + vec2(-TIME * 0.018, TIME * 0.022);
	vec3 w_tex = 0.5 * texture(water_tex, w_uv1).rgb + 0.5 * texture(water_tex, w_uv2).rgb;

	float caustic1 = fbm(uv * 1.35 + vec2(TIME * 0.32, -TIME * 0.24));
	float caustic2 = fbm(uv * 1.85 - vec2(TIME * 0.26, TIME * 0.30));
	float caustic = pow(clamp(caustic1 * caustic2 * 2.1, 0.0, 1.0), 2.2);

	vec3 water_rgb = mix(vec3(0.03, 0.20, 0.42), w_tex * 0.72, 0.28);
	water_rgb += vec3(0.26, 0.62, 0.72) * caustic * 0.2475;
	float wave_glint = pow(max(0.0, sin(uv.x * 3.2 + uv.y * 2.1 + TIME * 1.8 + n_shore * 5.0)), 8.0);
	water_rgb += vec3(0.62, 0.84, 0.94) * wave_glint * 0.22;

	COLOR = vec4(water_rgb, 1.0);
}
