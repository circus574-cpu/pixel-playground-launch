shader_type canvas_item;
render_mode unshaded;
uniform sampler2D ash_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D basalt_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D paving_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D cliff_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
void fragment() {
	vec4 weights=texture(weights_tex,UV);
	weights/=max(dot(weights,vec4(1.0)),0.001);
	vec2 uv=UV*(1024.0/7.0);
	vec3 albedo=texture(ash_tex,uv).rgb*weights.r+texture(basalt_tex,uv).rgb*weights.g+texture(paving_tex,uv).rgb*weights.b+texture(cliff_tex,uv).rgb*weights.a;
	float lava=texture(surface_tex,UV).r;
	albedo=mix(albedo,vec3(1.0,0.19,0.015),lava);
	COLOR=vec4(albedo*COLOR.rgb,1.0);
}
