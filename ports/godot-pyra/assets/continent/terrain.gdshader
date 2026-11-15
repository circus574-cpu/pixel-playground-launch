shader_type canvas_item;
// Ground of any Superior land: four biome weights and the land mask come from the published 32-unit terrain grid, a road
// mask (16 units) is painted with the land's road materials, settlements get a feathered paved courtyard. Per-land look
// (textures, tile size, overlay bands, shore rule, molten crust) is passed in as uniforms.

uniform sampler2D biome_ctrl : filter_linear, repeat_disable;
uniform sampler2D land_ctrl : filter_linear, repeat_disable;
uniform sampler2D t_b0 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_b1 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_b2 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_b3 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_water : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_shore : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_special : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_over1 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_over2 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D road_mask : filter_linear, repeat_disable;
uniform sampler2D road_class : filter_nearest, repeat_disable;
uniform sampler2D t_roads : source_color, filter_linear, repeat_enable;
uniform vec2 world_size = vec2(65600.0, 42304.0);
uniform vec2 tile = vec2(768.0, 768.0);
uniform vec2 road_tile = vec2(768.0, 128.0);
uniform float road_rows = 4.0;
uniform float has_special = 0.0;
uniform vec4 shore_mask = vec4(1.0);
uniform vec4 over1_mask = vec4(0.0);
uniform vec4 over2_mask = vec4(0.0);
uniform vec4 over1_p = vec4(1.0);   // periods a, b, c and threshold
uniform vec4 over2_p = vec4(1.0);
uniform vec2 over1_cfg = vec2(0.0); // mode (0 none, 1 three sines, 2 sin+cos, 3 always), alpha
uniform vec2 over2_cfg = vec2(0.0);
uniform vec4 plaza_rects[4];

varying vec2 wp;

void vertex() {
	wp = VERTEX;
}

// Triangle-wave coordinate: the texture is mirrored at every tile edge, so no seam can show.
vec2 tri(vec2 u) {
	return 1.0 - abs(1.0 - 2.0 * fract(u * 0.5));
}

vec4 tri_sample(sampler2D t, vec2 u) {
	// Gradients come from the unfolded coordinate, so mip selection stays continuous across the mirror folds.
	return textureGrad(t, tri(u), dFdx(u) * 0.5, dFdy(u) * 0.5);
}

vec4 tex2(sampler2D t, vec2 p) {
	// Two scales break the visible repetition of a tile.
	vec4 a = tri_sample(t, p / tile);
	vec4 b = tri_sample(t, p / (tile * 2.7) + vec2(0.37, 0.11));
	return mix(a, b, 0.38);
}

float edge_noise(vec2 p) {
	return sin(p.x / 173.0 + sin(p.y / 241.0) * 1.7) * 0.5 + sin(p.y / 131.0 + sin(p.x / 197.0) * 1.3) * 0.5;
}

float band(vec2 p, vec4 prm, float mode) {
	if (mode < 0.5) return -99.0;
	if (mode < 1.5) return sin(p.x / prm.x) + sin(p.y / prm.y) + sin((p.x + p.y) / prm.z) - prm.w;
	if (mode < 2.5) return sin(p.x / prm.x) + cos(p.y / prm.y) - prm.w;
	return 1.0;
}

void fragment() {
	vec2 warp = vec2(edge_noise(wp), edge_noise(wp.yx + 91.0)) * 22.0;
	vec2 uv = (wp + warp) / world_size;
	vec4 land = texture(land_ctrl, uv);
	vec4 b = texture(biome_ctrl, uv);
	b.a = max(land.r - b.r - b.g - b.b, 0.0);   // the fourth biome is the rest of the land
	float total = max(b.r + b.g + b.b + b.a, 0.001);
	b /= total;
	float coverage = land.r;
	float n = edge_noise(wp * 0.7) * 0.08;
	float on_land = smoothstep(0.38, 0.62, coverage + n);

	vec3 sea = tex2(t_water, wp + vec2(sin(wp.y / 90.0 + TIME * 0.35) * 7.0, 0.0)).rgb;
	vec3 ground = vec3(0.0);
	if (b.r > 0.01) ground += tex2(t_b0, wp).rgb * b.r;
	if (b.g > 0.01) ground += tex2(t_b1, wp).rgb * b.g;
	if (b.b > 0.01) ground += tex2(t_b2, wp).rgb * b.b;
	if (b.a > 0.01) ground += tex2(t_b3, wp).rgb * b.a;

	// Two optional overlay bands per land (leaf litter, snow, crystal crust, damp stone ...).
	float m1 = dot(b, over1_mask);
	if (m1 > 0.01 && over1_cfg.x > 0.5) {
		float k = smoothstep(0.0, 0.3, band(wp, over1_p, over1_cfg.x)) * m1 * over1_cfg.y;
		if (k > 0.01) ground = mix(ground, tex2(t_over1, wp).rgb, k);
	}
	float m2 = dot(b, over2_mask);
	if (m2 > 0.01 && over2_cfg.x > 0.5) {
		float k2 = smoothstep(0.0, 0.3, band(wp, over2_p, over2_cfg.x)) * m2 * over2_cfg.y;
		if (k2 > 0.01) ground = mix(ground, tex2(t_over2, wp).rgb, k2);
	}

	// Molten / charged crust only on the cells the world marks as impassable.
	float molten = smoothstep(0.35, 0.65, land.g) * has_special;
	if (molten > 0.01) {
		vec3 hot = tex2(t_special, wp + vec2(0.0, TIME * 6.0)).rgb;
		ground = mix(ground, hot * (1.0 + 0.12 * sin(TIME * 1.7 + wp.x / 60.0)), molten);
	}

	// City courtyards: paving inside a settlement, feathered at the edge.
	float plaza = 0.0;
	for (int i = 0; i < 4; i++) {
		vec4 r = plaza_rects[i];
		vec2 d = max(r.xy - wp, wp - (r.xy + r.zw));
		plaza = max(plaza, 1.0 - smoothstep(-220.0, 140.0, max(d.x, d.y)));
	}
	if (plaza > 0.01) {
		// Paving: the land's stone biome material, a little lighter than the wilderness.
		ground = mix(ground, tex2(t_b2, wp * 0.8).rgb * 1.12, plaza * 0.85 * (1.0 - molten));
	}

	// Roads: the published tracks, rasterised at 16 units with feathered edges, painted with the land's road materials.
	vec2 suv = wp / world_size;
	float rm = texture(road_mask, suv).r;
	if (rm > 0.02) {
		float cls = min(floor(texture(road_class, suv).r * 255.0 / 40.0), road_rows - 1.0);
		vec2 rt = tri(wp / road_tile);   // mirrored, so the wrap of a road tile leaves no hard edge
		vec2 ruv = vec2(rt.x, (cls + mix(0.03, 0.97, rt.y)) / road_rows);
		vec3 road = texture(t_roads, ruv).rgb;
		ground = mix(ground, road, smoothstep(0.12, 0.7, rm) * 0.97 * (1.0 - molten));
	}

	// Beach band where the coast fades out (not on every biome: see the land's shore rule).
	float shore_w = (1.0 - abs(coverage - 0.56) * 4.2) * step(0.3, coverage) * step(coverage, 0.82);
	shore_w = clamp(shore_w, 0.0, 1.0) * 0.8 * (1.0 - molten) * clamp(dot(b, shore_mask), 0.0, 1.0);
	ground = mix(ground, tex2(t_shore, wp).rgb, shore_w);

	vec3 col = mix(sea, ground, on_land);
	float foam = (1.0 - smoothstep(0.0, 0.16, abs(coverage - 0.5))) * 0.18;
	col += foam * vec3(0.9, 0.85, 0.8);
	COLOR = vec4(col, 1.0);
}
