shader_type canvas_item;
varying vec4 vertex_color;
void vertex() {
	vertex_color = COLOR;
}
// Only feather the green ground platform at the bottom of the Verdantia artwork.
// Roof, walls, steps and their original RGB remain untouched; no redraw or recolor.
void fragment() {
	vec4 source = texture(TEXTURE, UV);
	vec2 pixel = TEXTURE_PIXEL_SIZE * 6.0;
	vec4 right = texture(TEXTURE, UV + vec2(pixel.x, 0.0));
	vec4 left = texture(TEXTURE, UV - vec2(pixel.x, 0.0));
	vec4 down = texture(TEXTURE, UV + vec2(0.0, pixel.y));
	vec4 up = texture(TEXTURE, UV - vec2(0.0, pixel.y));
	float edge = (right.a + left.a + down.a + up.a) * 0.25;
	float green = source.g - max(source.r, source.b);
	green = max(green, (right.g - max(right.r, right.b)) * right.a);
	green = max(green, (left.g - max(left.r, left.b)) * left.a);
	green = max(green, (up.g - max(up.r, up.b)) * up.a);
	green = max(green, (down.g - max(down.r, down.b)) * down.a);
	float ground = smoothstep(0.74, 0.86, UV.y);
	float mask = max(smoothstep(0.015, 0.12, green) * ground, smoothstep(0.84, 0.94, UV.y));
	// Adjacent grass includes its dark outline, otherwise the outline survives alone.
	source.a *= mix(1.0, edge * edge * edge, mask * 0.94);
	COLOR = source * vertex_color;
}
