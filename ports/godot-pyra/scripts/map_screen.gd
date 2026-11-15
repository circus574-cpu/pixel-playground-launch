class_name MapScreen
extends Control
## Planet map: 3D globe, flat atlas, and the detailed map of Pyra. Same regions, outlines and hero marker in all three.

signal closed

var map_data: Dictionary
var tabs: Array[Button] = []
var views: Array[Control] = []
var globe: GlobeView
var atlas: AtlasView
var continent_view: ContinentMapView
var info := Label.new()
var title := Label.new()
var current := 0
var player_world := Vector2.ZERO
var player_atlas := Vector2.ZERO
var place_name := ""
var regions: Array = []
var side_buttons: Array[Button] = []

func setup(data: Dictionary, world: Dictionary, player: Vector2, region_label: String) -> void:
	map_data = data
	player_world = player
	place_name = region_label
	regions = data.regions
	player_atlas = MapMath.world_to_atlas(data.pyra, player.x, player.y)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var space := TextureRect.new()
	space.texture = load("res://assets/map/space.jpg")
	space.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	space.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	space.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	space.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(space)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.03, 0.05, 0.45)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(shade)

	globe = GlobeView.new()
	globe.setup(load("res://assets/map/globe-color.webp"), load("res://assets/map/globe-clouds.webp"), regions, player_atlas)
	globe.region_picked.connect(show_region)
	globe.focus_on(MapMath.atlas_to_lonlat(player_atlas))
	atlas = AtlasView.new()
	atlas.setup(load("res://assets/map/atlas.webp"), regions, player_atlas)
	atlas.region_picked.connect(show_region)
	for town: Dictionary in world.towns:
		atlas.marks.append({"atlas": MapMath.world_to_atlas(map_data.pyra, float(town.x), float(town.y)), "label": str(town.name)})
	var capital: Dictionary = world.capital
	atlas.marks.append({"atlas": MapMath.world_to_atlas(map_data.pyra, float(capital.x), float(capital.y)), "label": str(capital.name)})
	continent_view = ContinentMapView.new()
	var list: Array[Dictionary] = [{"point": Vector2(float(capital.x), float(capital.y)), "label": str(capital.name), "kind": "city"}]
	for town: Dictionary in world.towns:
		list.append({"point": Vector2(float(town.x), float(town.y)), "label": str(town.name), "kind": "city"})
	var counters: Dictionary = {}
	for place: Dictionary in world.places:
		var label := str(place.name)
		if label == "":
			if place.kind == "wilderness":
				continue
			counters[place.kind] = int(counters.get(place.kind, 0)) + 1
			label = "%s %d" % [str(place.label).capitalize(), int(counters[place.kind])]
		list.append({"point": Vector2(float(place.x), float(place.y)), "label": label, "kind": "wilderness" if place.kind == "wilderness" else str(place.kind)})
	for place: Dictionary in world.famous:
		list.append({"point": Vector2(float(place.x), float(place.y)), "label": str(place.name), "kind": "famous"})
	continent_view.setup(load("res://assets/map/pyra-map.webp"), list, player)
	continent_view.marker_picked.connect(func(label: String): info.text = label)
	views = [globe, atlas, continent_view]
	build_layout()
	switch_to(0)

func make_button(text: String, callback: Callable, minimum: Vector2 = Vector2(150, 64)) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = minimum
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", 20)
	button.add_theme_color_override("font_color", Color("fff0cf"))
	for state in ["normal", "hover", "pressed"]:
		var style := StyleBoxFlat.new()
		style.bg_color = Color("533421") if state == "normal" else Color("704b2d")
		style.border_color = Color("986c42") if state == "normal" else Color("d4aa68")
		style.set_border_width_all(2)
		style.set_corner_radius_all(12)
		style.content_margin_left = 16
		style.content_margin_right = 16
		button.add_theme_stylebox_override(state, style)
	button.pressed.connect(callback)
	return button

func build_layout() -> void:
	var root := VBoxContainer.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 18
	root.offset_right = -18
	root.offset_top = 12
	root.offset_bottom = -12
	root.add_theme_constant_override("separation", 8)
	add_child(root)
	var bar := HBoxContainer.new()
	bar.add_theme_constant_override("separation", 10)
	title.text = "PLANETA SUPERIOR"
	title.add_theme_font_size_override("font_size", 26)
	title.add_theme_color_override("font_color", Color("f1c77f"))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	for i in 3:
		var button := make_button(["GLOBUS 3D", "MAPA 2D", "KONTYNENT PYRA"][i], func(): switch_to(i), Vector2(i * 0 + 160 if i < 2 else 230, 64))
		tabs.append(button)
		bar.add_child(button)
	bar.add_child(make_button("ZAMKNIJ", func(): closed.emit(), Vector2(150, 64)))
	root.add_child(bar)
	var stage := Control.new()
	stage.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stage.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stage.clip_contents = true
	root.add_child(stage)
	for view in views:
		view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		stage.add_child(view)
	var zoom_column := VBoxContainer.new()
	zoom_column.set_anchors_and_offsets_preset(Control.PRESET_CENTER_RIGHT)
	zoom_column.offset_left = -84
	zoom_column.offset_right = -10
	zoom_column.offset_top = -120
	zoom_column.offset_bottom = 120
	zoom_column.add_theme_constant_override("separation", 10)
	stage.add_child(zoom_column)
	for entry in [["+", 1.3], ["−", 1.0 / 1.3]]:
		var factor: float = entry[1]
		zoom_column.add_child(make_button(entry[0], func(): zoom(factor), Vector2(70, 70)))
	zoom_column.add_child(make_button("◎", focus_player, Vector2(70, 70)))
	var card := PanelContainer.new()
	var style := StyleBoxFlat.new()
	style.bg_color = Color(0.08, 0.06, 0.07, 0.88)
	style.border_color = Color("855c39")
	style.set_border_width_all(2)
	style.set_corner_radius_all(12)
	style.content_margin_left = 18
	style.content_margin_right = 18
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	card.add_theme_stylebox_override("panel", style)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(900, 60)
	info.add_theme_font_size_override("font_size", 19)
	info.add_theme_color_override("font_color", Color("efe0c8"))
	info.text = "Jesteś tutaj: %s. Dotknij regionu, aby zobaczyć opis." % place_name
	card.add_child(info)
	root.add_child(card)

func zoom(factor: float) -> void:
	match current:
		0:
			globe.zoom_by(factor)
		1:
			atlas.zoom_by(factor, atlas.size / 2.0)
		2:
			continent_view.zoom_by(factor, continent_view.size / 2.0)

func focus_player() -> void:
	match current:
		0:
			globe.focus_on(MapMath.atlas_to_lonlat(player_atlas))
		1:
			atlas.focus(player_atlas, 3.0)
		2:
			continent_view.focus(player_world, 3.0)

func switch_to(index: int) -> void:
	current = index
	for i in views.size():
		views[i].visible = i == index
		tabs[i].disabled = i == index
	title.text = ["GLOBUS PLANETY SUPERIOR", "MAPA PLANETY — ATLAS 2D", "KONTYNENT PYRA — MAPA SZCZEGÓŁOWA"][index]
	if index == 1:
		atlas.focus(player_atlas, 1.0)
	elif index == 2:
		continent_view.focus(player_world, 1.0)

func region_text(region: Dictionary) -> String:
	var lines := [str(region.name)]
	if str(region.people) != "":
		lines.append("Lud: %s · osada: %s" % [region.people, region.settlement])
	lines.append(str(region.summary))
	lines.append("Dostępny w tej wersji aplikacji: Pyra (Legendy). Pozostałe kontynenty i wyspy będą przeniesione później." if not bool(region.playable) else "Tu jesteś: %s. Cały kontynent Pyry jest w tej wersji grywalny (bez potworów)." % place_name)
	return "\n".join(lines)

func show_region(id: String) -> void:
	for region: Dictionary in regions:
		if region.id == id:
			info.text = region_text(region)
			globe.select(id)
			atlas.selected = id
			return
