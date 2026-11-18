shader_type canvas_item;
render_mode unshaded;
uniform sampler2D ash_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D basalt_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D paving_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D cliff_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
uniform vec4 hazard_color : source_color = vec4(1.0,0.19,0.015,1.0);
uniform bool water_enabled = false;
#include "res://shaders/study_water.gdshaderinc"
void fragment() {
	vec4 weights=texture(weights_tex,UV);
	weights/=max(dot(weights,vec4(1.0)),0.001);
	vec2 uv=UV*(1024.0/7.0);
	vec3 albedo=texture(ash_tex,uv).rgb*weights.r+texture(basalt_tex,uv).rgb*weights.g+texture(paving_tex,uv).rgb*weights.b+texture(cliff_tex,uv).rgb*weights.a;
	float lava=texture(surface_tex,UV).r;
	vec3 surface = water_enabled ? study_water(UV, lava, TIME) : hazard_color.rgb;
	COLOR=vec4(mix(albedo*COLOR.rgb,surface,lava),1.0);
}
