shader_type spatial;
render_mode unshaded,cull_disabled;
uniform sampler2D ash_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D basalt_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D paving_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D cliff_tex : source_color,filter_linear_mipmap,repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
void fragment(){
	vec4 w=texture(weights_tex,UV);w/=max(dot(w,vec4(1.0)),0.001);
	vec2 uv=UV*1024.0/7.0;
	vec3 c=texture(ash_tex,uv).rgb*w.r+texture(basalt_tex,uv).rgb*w.g+texture(paving_tex,uv).rgb*w.b+texture(cliff_tex,uv).rgb*w.a;
	c=mix(c,vec3(1.0,0.19,0.015),texture(surface_tex,UV).r);
	ALBEDO=c*COLOR.rgb;
}
