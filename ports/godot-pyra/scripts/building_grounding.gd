class_name PyraBuildingGrounding
extends RefCounted
## Presentation only. Existing bitmaps, sprite anchors and colliders stay intact.
## The six older ki-v2 building images already contain a cast shadow: leave them alone.
var contact_texture: ImageTexture
var grass_material: ShaderMaterial
const ROLES := ["hall", "shop", "arena", "smithy", "depot", "inn"]

static func profile(path: String) -> String:
	var name := path.get_file().get_basename()
	if not ROLES.has(name.get_slice("-", name.get_slice_count("-") - 1)):
		return ""
	if name.contains("-verdant-leaf-"):
		return "grass-platform"
	if name.contains("-painted-"):
		return "contact"
	return ""

func shadow_image() -> ImageTexture:
	if contact_texture != null:
		return contact_texture
	var image := Image.create(128,64,false,Image.FORMAT_RGBA8)
	for y in 64:
		for x in 128:
			var p := (Vector2(x+0.5,y+0.5)-Vector2(64,32))/Vector2(64,32)
			var d := p.length_squared()
			var feather := 1.0-smoothstep(0.55,1.0,d)
			var ambient := exp(-d*3.0)*0.19
			var contact := exp(-pow(p.x/0.85,2.0)*2.0-pow(p.y/0.30,2.0)*2.0)*0.13
			image.set_pixel(x,y,Color(0.035,0.035,0.045,(ambient+contact)*feather))
	image.generate_mipmaps()
	contact_texture = ImageTexture.create_from_image(image)
	return contact_texture

func make_shadow(sprite: Sprite2D) -> Sprite2D:
	var shadow := Sprite2D.new()
	shadow.name = "BuildingContact"
	shadow.texture = shadow_image()
	var size := sprite.texture.get_size()*sprite.scale
	shadow.position = sprite.position+Vector2(0,size.y*0.055)
	shadow.scale = Vector2(size.x/128.0,size.y*0.22/64.0)
	return shadow

func platform_material() -> ShaderMaterial:
	if grass_material == null:
		grass_material = ShaderMaterial.new()
		grass_material.shader = load("res://assets/continent/building_platform.gdshader")
	return grass_material
