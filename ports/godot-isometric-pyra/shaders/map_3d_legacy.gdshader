shader_type spatial;
render_mode unshaded,cull_disabled;
uniform sampler2D ash_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D basalt_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D paving_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D cliff_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D plaza_tex : filter_linear;
uniform bool plaza_enabled = false;
uniform sampler2D surface_tex : filter_linear;
uniform vec4 hazard_color : source_color = vec4(1.0,0.19,0.015,1.0);
uniform bool water_enabled = false;
#include "res://shaders/study_water.gdshaderinc"
void fragment(){
	vec4 w=texture(weights_tex,UV);w/=max(dot(w,vec4(1.0)),0.001);
	vec2 uv=UV*1024.0/7.0;
	vec3 paving=texture(paving_tex,uv).rgb;
	if(plaza_enabled){
		vec2 zones=texture(plaza_tex,UV).rg;
		paving=mix(paving,texture(paving_tex,uv*0.63).rgb*1.12,zones.g);
		paving*=1.0-zones.r*0.21;
	}
	vec3 c=texture(ash_tex,uv).rgb*w.r+texture(basalt_tex,uv).rgb*w.g+paving*w.b+texture(cliff_tex,uv).rgb*w.a;
	float depth = texture(surface_tex,UV).r;
	vec3 surface = water_enabled ? study_water(UV, depth, TIME) : hazard_color.rgb;
	ALBEDO=mix(c*COLOR.rgb,surface,depth);
}
