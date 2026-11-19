shader_type canvas_item;

uniform float fill_ratio : hint_range(0.0, 1.0) = 1.0;
uniform vec4 color_dark : source_color = vec4(0.42, 0.05, 0.06, 1.0);
uniform vec4 color_bright : source_color = vec4(0.95, 0.24, 0.16, 1.0);
uniform vec4 bg_color : source_color = vec4(0.05, 0.04, 0.05, 0.90);
uniform vec4 border_color : source_color = vec4(0.76, 0.60, 0.32, 0.88);
uniform float taper_right : hint_range(0.0, 0.18) = 0.06;
uniform float tick_count : hint_range(0.0, 12.0) = 0.0;
uniform float flow_speed : hint_range(0.0, 3.0) = 0.75;

void fragment() {
	vec2 uv = UV;
	// Graceful chamfered RPG blade-tip silhouette on the right end
	float right_edge = 1.0 - taper_right * uv.y;
	float left_edge = 0.0;
	if (uv.x > right_edge || uv.x < left_edge) {
		discard;
	}

	// Distance to outer perimeter in normalized units
	float d_x = min(uv.x - left_edge, right_edge - uv.x);
	float d_y = min(uv.y, 1.0 - uv.y);

	// Recessed obsidian trough with inner vertical shading
	float trough_shade = 0.72 + 0.35 * sin(uv.y * 3.14159);
	vec3 col = bg_color.rgb * trough_shade;
	float alpha = bg_color.a;

	// Living liquid-energy fill region
	float fill_x = fill_ratio * right_edge;
	float in_fill = 1.0 - smoothstep(fill_x - 0.012, fill_x + 0.004, uv.x);

	if (in_fill > 0.001) {
		// Vertical glass tube shading + subtle animated energy ribbons
		float wave1 = sin(uv.x * 18.0 - TIME * flow_speed * 2.2 + uv.y * 4.5) * 0.5 + 0.5;
		float wave2 = sin(uv.x * 31.0 + TIME * flow_speed * 1.4 - uv.y * 6.0) * 0.5 + 0.5;
		float energy = mix(wave1, wave2, 0.42);

		float v_grad = smoothstep(1.0, 0.12, uv.y);
		vec3 liquid = mix(color_dark.rgb, color_bright.rgb, clamp(v_grad * 0.78 + energy * 0.28, 0.0, 1.0));

		// Crisp upper glass specular reflection ribbon
		float glass_hi = smoothstep(0.34, 0.14, uv.y) * smoothstep(0.02, 0.14, uv.y) * 0.42;
		liquid += vec3(1.0, 0.96, 0.88) * glass_hi;

		// Inner bottom ambient occlusion
		float bot_ao = smoothstep(0.72, 1.0, uv.y) * 0.38;
		liquid *= (1.0 - bot_ao);

		// Glowing leading-edge meniscus flare
		float meniscus = exp(-pow((uv.x - fill_x) / 0.026, 2.0)) * step(0.02, fill_ratio) * step(fill_ratio, 0.995);
		liquid += mix(color_bright.rgb, vec3(1.0, 0.95, 0.82), 0.65) * meniscus * 0.75;

		col = mix(col, liquid, in_fill);
		alpha = mix(alpha, 0.98, in_fill);
	}

	// Optional subtle antique-gold graduation ticks (e.g., 10 segments on XP filament)
	if (tick_count > 1.0) {
		float seg = fract(uv.x * tick_count);
		float tick = (1.0 - smoothstep(0.0, 0.032, min(seg, 1.0 - seg))) * step(0.03, uv.x) * step(uv.x, 0.97);
		col = mix(col, border_color.rgb * 0.75, tick * 0.45);
	}

	// Crisp antique-gold engraved bezel rim (1px equivalent)
	float rim_y = 1.0 - smoothstep(0.05, 0.12, d_y);
	float rim_x = 1.0 - smoothstep(0.004, 0.012, d_x);
	float rim = max(rim_y, rim_x);
	vec3 rim_col = border_color.rgb * (0.75 + 0.45 * (1.0 - uv.y));
	col = mix(col, rim_col, rim * border_color.a);
	alpha = max(alpha, rim * border_color.a);

	COLOR = vec4(col, alpha);
}
