shader_type canvas_item;
// Pyra ground: biome weights (ash fields, basalt, volcano, canyon) and land mask come from the published
// 32-unit terrain grid; every material tiles every 768 units, as in the browser game.

uniform sampler2D biome_ctrl : filter_linear, repeat_disable;
uniform sampler2D land_ctrl : filter_linear, repeat_disable;
uniform sampler2D t_ash : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_basalt : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_lava_bank : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_gravel : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_water : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_shore : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_lava : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_leaves : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D t_ash_rock : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D road_mask : filter_linear, repeat_disable;
uniform sampler2D road_class : filter_nearest, repeat_disable;
uniform sampler2D t_roads : source_color, filter_linear, repeat_enable;
uniform vec2 world_size = vec2(65600.0, 42304.0);
uniform float tile = 768.0;
uniform float time_scale = 1.0;
uniform vec4 plaza_rects[3];

varying vec2 wp;

void vertex() {
	wp = VERTEX;
}

// Triangle-wave coordinate: the texture is mirrored at every tile edge, so no seam can show.
vec2 tri(vec2 u) {
	return 1.0 - abs(1.0 - 2.0 * fract(u * 0.5));
}

vec4 tex2(sampler2D t, vec2 p) {
	// Two scales break the visible repetition of a 768-unit tile.
	vec4 a = texture(t, tri(p / tile));
	vec4 b = texture(t, tri(p / (tile * 2.7) + vec2(0.37, 0.11)));
	return mix(a, b, 0.38);
}

float edge_noise(vec2 p) {
	return sin(p.x / 173.0 + sin(p.y / 241.0) * 1.7) * 0.5 + sin(p.y / 131.0 + sin(p.x / 197.0) * 1.3) * 0.5;
}

void fragment() {
	vec2 warp = vec2(edge_noise(wp), edge_noise(wp.yx + 91.0)) * 22.0;
	vec2 uv = (wp + warp) / world_size;
	vec4 land = texture(land_ctrl, uv);
	vec4 b = texture(biome_ctrl, uv);
	b.a = max(land.r - b.r - b.g - b.b, 0.0);   // canyon = the rest of the land
	float total = max(b.r + b.g + b.b + b.a, 0.001);
	b /= total;
	float coverage = land.r;
	float n = edge_noise(wp * 0.7) * 0.08;
	float on_land = smoothstep(0.38, 0.62, coverage + n);

	vec3 sea = tex2(t_water, wp + vec2(sin(wp.y / 90.0 + TIME * 0.35 * time_scale) * 7.0, 0.0)).rgb;
	vec3 ground = vec3(0.0);
	if (b.r > 0.01) ground += tex2(t_ash, wp).rgb * b.r;
	if (b.g > 0.01) ground += tex2(t_basalt, wp).rgb * b.g;
	if (b.b > 0.01) ground += tex2(t_lava_bank, wp).rgb * b.b;
	if (b.a > 0.01) ground += tex2(t_gravel, wp).rgb * b.a;

	// Leaf litter on the ash fields, rock scree on the canyons (the same slow bands as the browser game).
	float leaf_band = sin(wp.x / 550.0) + sin(wp.y / 720.0) + sin((wp.x + wp.y) / 1100.0);
	float leaves = smoothstep(0.45, 0.75, leaf_band) * b.r * 0.95;
	if (leaves > 0.01) ground = mix(ground, tex2(t_leaves, wp).rgb, leaves);
	float rock = b.a * 0.8;
	if (rock > 0.01) ground = mix(ground, tex2(t_ash_rock, wp).rgb, rock);

	// Molten crust only on the cells the world marks as impassable lava.
	float molten = smoothstep(0.35, 0.65, land.g);
	if (molten > 0.01) {
		vec3 lava = tex2(t_lava, wp + vec2(0.0, TIME * 6.0 * time_scale)).rgb;
		ground = mix(ground, lava * (1.0 + 0.12 * sin(TIME * 1.7 + wp.x / 60.0)), molten);
	}

	// City courtyards of the three provincial towns: paving inside the settlement, feathered at the edge.
	float plaza = 0.0;
	for (int i = 0; i < 3; i++) {
		vec4 r = plaza_rects[i];
		vec2 d = max(r.xy - wp, wp - (r.xy + r.zw));
		plaza = max(plaza, 1.0 - smoothstep(-90.0, 90.0, max(d.x, d.y)));
	}
	if (plaza > 0.01) {
		vec2 puv = vec2(fract(wp.x / 768.0), mix(0.03, 0.97, fract(wp.y / 128.0)) / 4.0);
		ground = mix(ground, texture(t_roads, puv).rgb * 1.08, plaza * 0.9 * (1.0 - molten));
	}

	// Roads: the published tracks, rasterised at 16 units with feathered edges, painted with the 4 road materials.
	vec2 suv = wp / world_size;
	float rm = texture(road_mask, suv).r;
	if (rm > 0.02) {
		float cls = floor(texture(road_class, suv).r * 255.0 / 64.0 + 0.001);
		vec2 ruv = vec2(fract(wp.x / 768.0), (cls + mix(0.03, 0.97, fract(wp.y / 128.0))) / 4.0);
		vec3 road = texture(t_roads, ruv).rgb;
		ground = mix(ground, road, smoothstep(0.12, 0.7, rm) * 0.97 * (1.0 - molten));
	}

	// Beach band: where the coast fades out.
	float shore_w = (1.0 - abs(coverage - 0.56) * 4.2) * step(0.3, coverage) * step(coverage, 0.82);
	shore_w = clamp(shore_w, 0.0, 1.0) * 0.8 * (1.0 - molten);
	ground = mix(ground, tex2(t_shore, wp).rgb, shore_w * step(0.001, b.r + b.g + b.a));

	vec3 col = mix(sea, ground, on_land);
	// Wet foam on the waterline.
	float foam = (1.0 - smoothstep(0.0, 0.16, abs(coverage - 0.5))) * 0.18;
	col += foam * vec3(0.9, 0.85, 0.8);
	COLOR = vec4(col, 1.0);
}
