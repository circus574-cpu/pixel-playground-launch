extends Node3D

const CLIPS := {
	"walk": "Chód",
	"takeoff": "Start lotu",
	"hover": "Lewitacja",
	"glide": "Szybowanie",
	"land": "Lądowanie",
	"flight": "Pełny lot",
	"heavy_strike": "Ciężkie uderzenie",
	"ki_blast": "Atak KI",
}
const LOOPS := ["walk", "hover", "glide"]

@onready var character: Node3D = $Character
@onready var camera: Camera3D = $Camera3D
@onready var controls: VBoxContainer = $Canvas/Panel/Controls
var player: AnimationPlayer
var eye_view := false

func _ready() -> void:
	var players := character.find_children("*", "AnimationPlayer")
	assert(players.size() == 1, "Model GameMastera wymaga jednego AnimationPlayer.")
	player = players[0] as AnimationPlayer
	for clip: String in CLIPS:
		assert(player.has_animation(clip), "Brak klipu: " + clip)
		if clip in LOOPS:
			player.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
		var button := Button.new()
		button.text = CLIPS[clip]
		button.custom_minimum_size = Vector2(166, 37)
		button.pressed.connect(_play.bind(clip))
		controls.add_child(button)
	var view := Button.new()
	view.text = "Sylwetka / oczy"
	view.custom_minimum_size = Vector2(166, 37)
	view.pressed.connect(_toggle_view)
	controls.add_child(view)
	_place_camera()
	_play("hover")

func _play(clip: String) -> void:
	player.stop()
	player.play(clip)

func _toggle_view() -> void:
	eye_view = not eye_view
	if eye_view:
		_play("walk")
		player.seek(0.22, true)
		player.pause()
	_place_camera()
	if not eye_view and not player.is_playing():
		_play("hover")

func _place_camera() -> void:
	camera.position = Vector3(0.42, 4.08, 4.7) if eye_view else Vector3(3.5, 4.2, 12.2)
	camera.look_at(Vector3(0.0, 3.87 if eye_view else 3.0, 0.45 if not eye_view else 0.0))
