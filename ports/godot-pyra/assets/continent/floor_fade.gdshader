shader_type canvas_item;
// The capital's painted plaza fades into the wilderness instead of ending on the old trial's rectangular border.
uniform vec4 region = vec4(0.0, 0.0, 2562.0, 2390.0); // world x, y, width, height of the painted square
uniform float feather = 320.0;
varying vec2 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 0.0, 1.0)).xy;
}
void fragment() {
	vec4 c = texture(TEXTURE, UV);
	vec2 inner = min(wp - region.xy, region.xy + region.zw - wp);
	float edge = clamp(min(inner.x, inner.y) / feather, 0.0, 1.0);
	COLOR = vec4(c.rgb, c.a * smoothstep(0.0, 1.0, edge));
}
