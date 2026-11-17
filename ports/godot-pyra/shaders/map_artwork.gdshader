shader_type canvas_item;
render_mode unshaded;
#include "res://shaders/map_artwork.gdshaderinc"
void fragment() { COLOR = vec4(map_artwork(UV), 1.0); }
