// Both 2D and 3D call the same world-space material function.
uniform sampler2DArray ash_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray basalt_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray paving_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray cliff_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D surface_tex : filter_linear;
uniform sampler2D environment_tex : filter_linear;
uniform sampler2D transition_tex : filter_linear, repeat_enable;

float terrain_noise(vec2 p) {
	vec2 i=floor(p); vec2 f=fract(p); f=f*f*(3.0-2.0*f);
	vec4 n=sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1,1),vec2(127.1,311.7))))*43758.5453;
	n=fract(n);
	return mix(mix(n.x,n.y,f.x),mix(n.z,n.w,f.x),f.y);
}

vec3 terrain_sample(sampler2DArray tex,vec2 uv,float layer,float breakup) {
	// Smoothly choose offsets; gradients come from the unwarped coordinates.
	float k=breakup*8.0; float i=floor(k); float f=fract(k);
	vec2 a=sin(vec2(3.0,7.0)*i), b=sin(vec2(3.0,7.0)*(i+1.0));
	vec2 dx=dFdx(uv), dy=dFdy(uv);
	return mix(textureGrad(tex,vec3(uv+a,layer),dx,dy).rgb,textureGrad(tex,vec3(uv+b,layer),dx,dy).rgb,smoothstep(0.15,0.85,f));
}

vec3 terrain_albedo(vec2 map_uv) {
	vec2 world=map_uv*1024.0;
	vec4 env=texture(environment_tex,map_uv);
	float breakup=terrain_noise(world/29.0);
	vec4 w=texture(weights_tex,map_uv);
	float transition=texture(transition_tex,world/53.0).r-0.5;
	w=max(w+w*(vec4(1.0)-w)*transition*0.35,vec4(0.0));
	w/=max(dot(w,vec4(1.0)),0.001);
	float soil_layer=env.b>env.a && env.b>0.18?2.0:(env.a>0.18?3.0:1.0);
	float soil_mix=max(max(env.a,env.b)*0.85,breakup*0.16);
	vec3 soil=mix(terrain_sample(ash_tex,world/8.0,0.0,breakup),terrain_sample(ash_tex,world/8.0,soil_layer,breakup),soil_mix);
	float stone_layer=env.g>0.50?2.0:(env.r>0.28?1.0:0.0);
	vec3 stone=terrain_sample(basalt_tex,world/7.0,stone_layer,breakup);
	float road_layer=terrain_noise(world/85.0)>0.65?1.0:0.0;
	vec3 road=terrain_sample(paving_tex,world/3.0,road_layer,breakup);
	float cliff_layer=env.g<0.12?2.0:(env.r>0.75?3.0:(env.g>0.58?1.0:0.0));
	vec3 cliff=terrain_sample(cliff_tex,world/12.0,cliff_layer,breakup);
	vec3 color=soil*w.r+stone*w.g+road*w.b+cliff*w.a;
	float lava=texture(surface_tex,map_uv).r;
	if(lava>0.01){
		vec3 hot=terrain_sample(basalt_tex,world/6.0,3.0,breakup);
		color=mix(color,hot+vec3(0.35,0.035,0.001),lava);
	}
	return color*(0.94+terrain_noise(world/110.0)*0.12);
}
