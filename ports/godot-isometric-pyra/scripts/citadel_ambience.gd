extends Node2D
## Presentation-only lantern flicker and short chimney plumes.

var lanterns: PackedVector2Array
var chimneys: PackedVector2Array
var elapsed := 0.0
var soft_disc: GradientTexture2D

func _ready() -> void:
	z_index=2
	var ramp:=Gradient.new()
	ramp.offsets=PackedFloat32Array([0.0,.38,1.0])
	ramp.colors=PackedColorArray([Color.WHITE,Color(1,1,1,.54),Color(1,1,1,0)])
	soft_disc=GradientTexture2D.new()
	soft_disc.gradient=ramp
	soft_disc.fill=GradientTexture2D.FILL_RADIAL
	soft_disc.fill_from=Vector2(.5,.5)
	soft_disc.fill_to=Vector2(1,.5)
	soft_disc.width=32
	soft_disc.height=32

func _process(delta: float) -> void:
	elapsed+=delta
	queue_redraw()

func _draw() -> void:
	if not soft_disc:return
	for index in lanterns.size():
		var pulse:=sin(elapsed*5.8+index*1.7)*.035+sin(elapsed*10.3+index)*.025
		puff(lanterns[index],23,Color(1,.50,.16,.21+pulse))
	for index in chimneys.size():
		for step in 4:
			var age:=fposmod(elapsed*.46+step*.25+index*.17,1.0)
			var drift:=Vector2(age*24+sin(age*4+index)*5,-age*66)
			var opacity:=sin(age*PI)*.16
			puff(chimneys[index]+drift,10+age*19,Color(.70,.65,.63,opacity))

func puff(position_on_map: Vector2, radius: float, tint: Color) -> void:
	var extent:=Vector2.ONE*radius
	draw_texture_rect(soft_disc,Rect2(position_on_map-extent,extent*2),false,tint)
