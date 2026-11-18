shader_type canvas_item;
render_mode unshaded;
uniform sampler2D mat_0_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_1_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_2_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mat_3_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D water_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
uniform vec3 surface_color = vec3(1.0, 0.24, 0.03);
void fragment() {
	vec4 weights = texture(weights_tex, UV);
	weights /= max(dot(weights, vec4(1.0)), 0.001);
	vec2 uv = UV * (256.0 / 6.0);
	vec3 albedo = texture(mat_0_tex, uv).rgb * weights.r
		+ texture(mat_1_tex, uv).rgb * weights.g
		+ texture(mat_2_tex, uv).rgb * weights.b
		+ texture(mat_3_tex, uv).rgb * weights.a;
	float liquid = texture(surface_tex, UV).r;
	vec3 liquid_rgb = mix(surface_color, texture(water_tex, uv * 0.65).rgb, 0.45);
	albedo = mix(albedo, liquid_rgb, liquid);
	COLOR = vec4(albedo * COLOR.rgb, 1.0);
}
