extends Node
## Hand-arranged environmental scenes for four EXISTING Pyra stories.
## Reads quest state; no new quests, rewards, saves, colliders or map coordinates.
const ROOT := "res://assets/objects/"
const ART := {
	"banner":"pyra-art-clan-banner-8948b6e89b.png",
	"cart":"043aaba1-pyra-continent-cart.webp",
	"ruin":"5f186a05-pyra-continent-ruin.webp",
	"log":"9d31ebfd-ki-v2-objects-pyra-log-1.webp",
	"sign":"ec9ccb6a-pyra-continent-sign.webp",
}
# Each scene has its own composition and an existing quest consequence.
# Arrays: art key, X/Y offset, width/height. Props leave the central approach open.
const SCENES := {
	"famous-pyra-1": {"quest":"O-P06", "fire":"after", "props":[
		["ruin",-210,-110,170,150],["banner",-120,-80,52,140],
		["banner",150,-70,52,140],["sign",-105,100,65,75]]},
	"famous-pyra-2": {"quest":"H-P01", "fire":"always", "props":[
		["banner",-145,-100,36,100],["banner",145,-100,36,100],
		["banner",-95,-200,36,100],["banner",95,-200,36,100],
		["log",-170,80,120,70],["sign",110,110,60,70]]},
	"famous-pyra-3": {"quest":"O-P05", "fire":"always", "props":[
		["ruin",-210,-60,115,105],["ruin",210,-60,115,105],
		["banner",-150,100,48,130],["banner",150,100,48,130],
		["sign",0,-160,65,75]]},
	"famous-pyra-4": {"quest":"O-P01", "fire":"never", "props":[
		["cart",-190,70,170,125],["log",-125,-85,170,85],
		["sign",130,75,65,75],["banner",150,-110,45,125]]},
}
const WAKE := 1150.0
const SLEEP := 1600.0
var game: PyraGame
var active: Dictionary = {}
var clock := 0.0

func setup(owner_game: PyraGame) -> void:
	game = owner_game
	refresh()

func _process(delta: float) -> void:
	clock += delta
	if clock<0.5:return
	clock=0.0
	refresh()

func completed(id: String) -> bool:
	return str(game.quests.quests.get(id,{}).get("state",""))=="completed"

func refresh() -> void:
	if game==null or game.land_id!="pyra":return
	if not game.current_room.is_empty():
		clear()
		return
	for place: Dictionary in game.land.famous:
		var id := str(place.id)
		if not SCENES.has(id):continue
		var anchor := Vector2(float(place.x),float(place.y))
		var distance := game.player.position.distance_to(anchor)
		if active.has(id) and distance>SLEEP:
			(active[id].node as Node).queue_free()
			active.erase(id)
		if distance<=WAKE and not active.has(id):
			create_scene(id,anchor)
		if active.has(id):
			var resolved := completed(str(SCENES[id].quest))
			var fire: Node2D = active[id].fire
			fire.visible = str(SCENES[id].fire)=="always" or (str(SCENES[id].fire)=="after" and resolved)
			for banner: Sprite2D in active[id].banners:
				banner.modulate = Color.WHITE if resolved else Color(0.78,0.74,0.70)
			active[id].resolved = resolved

func create_scene(id: String, anchor: Vector2) -> void:
	var node := Node2D.new()
	node.name = "StoryPlace_"+id
	node.position = anchor
	node.y_sort_enabled = true
	game.continent.sorted.add_child(node)
	var banners: Array[Sprite2D] = []
	var count := 0
	for spec: Array in SCENES[id].props:
		var offset := Vector2(float(spec[1]),float(spec[2]))
		# Existing walk data wins: omit a decorative prop over water/obstacles.
		if not game.continent.walkable(anchor+offset):continue
		var key := str(spec[0])
		var tex: Texture2D = load(ROOT+str(ART[key]))
		var sprite := PyraContinent.make_sprite(tex,offset,Vector2(float(spec[3]),float(spec[4])),Vector2(0.5,0.92))
		node.add_child(sprite)
		if key=="banner":banners.append(sprite)
		count+=1
	var fire := PyraAmbient.create("fire",Vector2(0,-90),"")
	node.add_child(fire)
	active[id] = {"node":node,"fire":fire,"banners":banners,"resolved":false,"props":count,"quest":SCENES[id].quest}

func clear() -> void:
	for entry: Dictionary in active.values():
		if is_instance_valid(entry.node):entry.node.queue_free()
	active.clear()

func _exit_tree() -> void:
	clear()
