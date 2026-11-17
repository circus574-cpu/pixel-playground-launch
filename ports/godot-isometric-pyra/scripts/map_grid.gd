extends Control
## UI grid derived from the exact world projection and the map's real viewport camera.
var world: Node2D
func screen(p: Vector2) -> Vector2:
	return (world.iso(p)-world.map_camera.position)*world.map_camera.zoom+size/2
func _draw() -> void:
	if world==null:return
	draw_rect(Rect2(Vector2.ZERO,size),Color("d2b176"),false,2)
	for i in 9:
		for axis in 2:
			var line:=PackedVector2Array()
			for step in 33:
				var a:=-512.0+i*128
				var b:=-512.0+step*32
				line.append(screen(Vector2(a,b) if axis==0 else Vector2(b,a)))
			draw_polyline(line,Color(1,.9,.6,.23),1,true)
	for row in 8:
		for col in 8:
			var at:=screen(Vector2(-448+col*128,-448+row*128))
			draw_string(ThemeDB.fallback_font,at,String.chr(65+col)+str(row+1),HORIZONTAL_ALIGNMENT_CENTER,-1,14 if size.x>500 else 8,Color(1,.9,.7,.7))
