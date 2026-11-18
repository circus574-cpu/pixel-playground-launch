// Both 2D and 3D call the same world-space material function.
uniform sampler2DArray ash_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray basalt_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray paving_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2DArray cliff_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D weights_tex : filter_linear;
uniform sampler2D plaza_tex : filter_linear;
uniform bool plaza_enabled = false;
uniform sampler2D surface_tex : filter_linear;
uniform sampler2D environment_tex : filter_linear;
uniform sampler2D transition_tex : filter_linear, repeat_enable;

uniform bool city_style_enabled = false;
uniform sampler2D city_surfaces : filter_linear, repeat_disable;
uniform sampler2D city_soil : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D city_pavers : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D city_slabs : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D city_cliff : source_color, filter_linear_mipmap, repeat_enable;

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

vec3 urban_albedo(vec3 native, vec2 world, vec3 mask, float emblem) {
	float dust_tone=0.88+terrain_noise(world/27.0)*0.23;
	vec3 dirt=texture(city_soil,world/10.0).rgb*dust_tone;
	vec3 pavers=texture(city_pavers,world/7.5).rgb*(0.92+terrain_noise(world/48.0)*0.14);
	vec3 slabs=texture(city_slabs,world/8.5).rgb;
	float street=smoothstep(0.38,0.56,mask.g);
	float curb=smoothstep(0.43,0.55,mask.g)*(1.0-smoothstep(0.66,0.77,mask.g));
	float court=smoothstep(0.28,0.74,mask.b);
	vec3 stone=mix(pavers,pavers*0.67+vec3(0.035,0.03,0.026),curb);
	vec3 color=mix(dirt,stone,street);
	color=mix(color,slabs,court);
	color=mix(color,vec3(0.51,0.32,0.13),emblem*0.67);
	return mix(native,color,mask.r);
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
	if(plaza_enabled){
		vec3 zones=texture(plaza_tex,map_uv).rgb;
		road=mix(road,terrain_sample(paving_tex,world/5.0,road_layer,breakup)*1.12,zones.g);
		road*=1.0-zones.r*0.21;
		road=mix(road,vec3(0.54,0.28,0.07),zones.b*0.78);
	}
	float cliff_layer=env.g<0.12?2.0:(env.r>0.75?3.0:(env.g>0.58?1.0:0.0));
	vec3 cliff=terrain_sample(cliff_tex,world/12.0,cliff_layer,breakup);
	if(city_style_enabled && w.a>0.01){
		vec3 strata=texture(city_cliff,vec2(world.x+world.y*0.5,world.y)/21.0).rgb;
		cliff=mix(strata,cliff*0.72,0.24);
	}
	vec3 color=soil*w.r+stone*w.g+road*w.b+cliff*w.a;
	if(city_style_enabled){
		vec3 mask=texture(city_surfaces,map_uv).rgb;
		if(mask.r>0.002){
			color=urban_albedo(color,world,mask,texture(plaza_tex,map_uv).b);
		}
	}
	float lava=texture(surface_tex,map_uv).r;
	if(lava>0.01){
		vec3 hot=terrain_sample(basalt_tex,world/6.0,3.0,breakup);
		color=mix(color,hot+vec3(0.35,0.035,0.001),lava);
	}
	return color*(0.94+terrain_noise(world/110.0)*0.12);
}
