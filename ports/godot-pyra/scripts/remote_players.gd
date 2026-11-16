class_name PyraRemotePlayers
extends Node
## Other players of the land, as cosmetic ghosts: a hero figure with a nickname that glides to the position the server reports.
## They cannot be hit, talked to or traded with, and they only exist outdoors (the server tells about players of the same land).

const MAX_SHOWN := 24

var game: PyraGame
var figures: Dictionary = {}      # peer id -> {"actor": PyraActor, "target": Vector2, "race": String, "last": Vector2}

func setup(owner_game: PyraGame) -> void:
	game = owner_game

func set_peers(list: Array) -> void:
	var seen: Dictionary = {}
	for peer: Dictionary in list.slice(0, MAX_SHOWN):
		var id := str(peer.id)
		seen[id] = true
		var race := str(peer.race)
		var at := Vector2(float(peer.x), float(peer.y))
		if not figures.has(id) or str(figures[id].race) != race:
			make_figure(id, race, str(peer.nick), at)
		var figure: Dictionary = figures[id]
		figure.target = at
		(figure.actor as PyraActor).label.text = "%s  poz. %d" % [str(peer.nick), int(peer.level)]
	for id: String in figures.keys():
		if not seen.has(id):
			var gone: PyraActor = figures[id].actor
			if is_instance_valid(gone):
				gone.queue_free()
			figures.erase(id)

func make_figure(id: String, race: String, nick: String, at: Vector2) -> void:
	if figures.has(id) and is_instance_valid(figures[id].actor):
		(figures[id].actor as Node).queue_free()
	var key := "%s.hero" % str(PyraGame.WORLD_OF_RACE.get(race, "pyra"))
	if not game.actors.has(key) or not is_instance_valid(game.continent):
		return
	var actor := PyraActor.new()
	actor.position = at
	game.continent.sorted.add_child(actor)
	actor.setup(game.actors[key], nick, false, true)
	actor.modulate = Color(0.85, 0.92, 1.0, 0.78)
	figures[id] = {"actor": actor, "target": at, "race": race, "last": at}

func clear() -> void:
	set_peers([])

func _process(delta: float) -> void:
	var outdoors := game.current_room.is_empty()
	for id: String in figures.keys():
		var figure: Dictionary = figures[id]
		var actor: PyraActor = figure.actor
		if not is_instance_valid(actor):
			figures.erase(id)
			continue
		actor.visible = outdoors
		var to: Vector2 = (figure.target as Vector2) - actor.position
		if to.length() > 600.0:
			actor.position = figure.target
			to = Vector2.ZERO
		var step := minf(to.length(), maxf(90.0, to.length() * 4.0) * delta)
		if to.length() > 4.0:
			actor.position += to.normalized() * step
			actor.animate(to)
		else:
			actor.animate(Vector2.ZERO)
