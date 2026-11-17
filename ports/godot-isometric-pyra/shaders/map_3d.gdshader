shader_type spatial;
render_mode unshaded,cull_disabled;
#include "res://shaders/terrain_material.gdshaderinc"
void fragment() {
	ALBEDO=terrain_albedo(UV)*COLOR.rgb;
}
