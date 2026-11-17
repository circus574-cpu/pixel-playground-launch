shader_type canvas_item;
render_mode unshaded;
#include "res://shaders/terrain_material.gdshaderinc"
void fragment() {
	COLOR=vec4(terrain_albedo(UV)*COLOR.rgb,1.0);
}
