extends RefCounted
## One material palette shared by the actual scene and both maps.
const FAMILIES := ["ash", "basalt", "paving", "cliff"]
var textures: Array = []
var contract: Dictionary = {}
var legacy := false
var weights: Texture2D
var plazas: Texture2D
var surface: Texture2D
var environment: Texture2D
var transition: Texture2D
var hazard_color := Color("ff3004")
var alternate_study := false
var water_enabled := false

func load_assets(use_legacy: bool, data_root: String, study: String) -> void:
	legacy=use_legacy
	var city_weights:=data_root+"/city-weights.png"
	weights=load(city_weights if ResourceLoader.exists(city_weights) else data_root+"/weights.png")
	if ResourceLoader.exists(data_root+"/city-plazas.png"):
		plazas=load(data_root+"/city-plazas.png")
	alternate_study=study!="pyra"
	surface=load(data_root+("/hazards.png" if alternate_study else "/surface.png"))
	match study:
		"verdantia":water_enabled=true
		"aetheria":hazard_color=Color("91bfd4")
		"nexus":hazard_color=Color("282e3a")
	if legacy:
		for family: String in FAMILIES:
			var original: Texture2D=load(data_root+"/materials/"+family+".png" if alternate_study else "res://materials/%s.webp"%family)
			var image:=original.get_image()
			if image.is_compressed():image.decompress()
			image.generate_mipmaps()
			textures.append(ImageTexture.create_from_image(image))
		return
	contract=JSON.parse_string(FileAccess.get_file_as_string("res://data/terrain-materials.json"))
	for family: String in FAMILIES:
		var images: Array[Image]=[]
		for binding: Dictionary in contract.families[family]:
			var source: Texture2D=load(str(binding.texture))
			var image:=source.get_image()
			if image.is_compressed():image.decompress()
			image.convert(Image.FORMAT_RGBA8)
			image.generate_mipmaps()
			images.append(image)
		var array:=Texture2DArray.new()
		assert(array.create_from_images(images)==OK,"Cannot create terrain texture array")
		textures.append(array)
	environment=load("res://data/material-environment.png")
	transition=load("res://data/material-transition.png")

func apply(material: ShaderMaterial) -> void:
	for i in FAMILIES.size():material.set_shader_parameter(FAMILIES[i]+"_tex",textures[i])
	material.set_shader_parameter("weights_tex",weights)
	if plazas!=null:
		material.set_shader_parameter("plaza_tex",plazas)
		material.set_shader_parameter("plaza_enabled",true)
	material.set_shader_parameter("surface_tex",surface)
	if alternate_study:
		material.set_shader_parameter("hazard_color",hazard_color)
		material.set_shader_parameter("water_enabled",water_enabled)
	if not legacy:
		material.set_shader_parameter("environment_tex",environment)
		material.set_shader_parameter("transition_tex",transition)

func validate() -> Dictionary:
	var checks: Dictionary={"four_families":textures.size()==4}
	if legacy:return checks
	var count:=0
	for i in FAMILIES.size():
		var family: String=FAMILIES[i]
		var array: Texture2DArray=textures[i]
		checks[family+"_layers"]=array.get_layers()==contract.families[family].size()
		checks[family+"_512"]=array.get_width()==512 and array.get_height()==512
		checks[family+"_mipmaps"]=array.has_mipmaps()
		for binding: Dictionary in contract.families[family]:
			checks[str(binding.id)+"_hash"]=FileAccess.get_sha256(str(binding.texture))==str(binding.sha256)
		count+=array.get_layers()
	checks["bounded_14_layers"]=count==14
	for field in ["height","control","walkable"]:
		var path: String={"height":"res://data/height.r32","control":"res://data/control.r32","walkable":"res://data/walkable.u8"}[field]
		checks[field+"_unchanged"]=FileAccess.get_sha256(path)==str(contract[field+"_sha256"])
	checks["environment_hash"]=FileAccess.get_sha256("res://data/material-environment.png")==str(contract.environment_sha256)
	checks["transition_hash"]=FileAccess.get_sha256("res://data/material-transition.png")==str(contract.transition_sha256)
	return checks
