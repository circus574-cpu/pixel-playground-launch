class_name MapScreen
extends Control
const Look := preload("res://scripts/look.gd")   # the look that can change with server updates (see look.gd)
## Planet map: 3D globe, flat atlas, and detailed maps of all ten lands. Same regions, outlines and hero marker in all three.

signal closed
signal travel(land_id: String)

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
var land_id := ""
var travel_button: Button
var picked := ""
var detail_id := ""
var worlds: Dictionary = {}
var cave_labels: Dictionary = {}

func setup(data: Dictionary, world: Dictionary, player: Vector2, region_label: String, cave_names: Dictionary = {}) -> void:
	land_id = str(world.id)
	detail_id = land_id
	cave_labels = cave_names
	worlds[land_id] = world
	map_data = data
	player_world = player
	place_name = region_label
	regions = data.regions
	player_atlas = MapMath.world_to_atlas(data.lands[land_id], player.x, player.y)
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

	var settlements: Array[Dictionary] = []
	for region: Dictionary in regions:
		var id := str(region.id)
		if not worlds.has(id):
			worlds[id] = PyraContinent.load_json("res://data/lands/%s/land.json" % id)
		for settlement: Dictionary in worlds[id].get("settlements", []):
			settlements.append({"atlas": MapMath.world_to_atlas(data.lands[id], float(settlement.x), float(settlement.y)), "label": str(settlement.name), "kind": "city", "land": id})
	globe = GlobeView.new()
	globe.setup(load("res://assets/map/atlas.webp"), load("res://assets/map/globe-clouds.webp"), regions, player_atlas, settlements)
	globe.region_picked.connect(show_region)
	globe.detail_requested.connect(open_detail)
	globe.focus_on(MapMath.atlas_to_lonlat(player_atlas))
	atlas = AtlasView.new()
	atlas.setup(load("res://assets/map/atlas.webp"), regions, player_atlas)
	atlas.marks = settlements
	atlas.region_picked.connect(show_region)
	atlas.detail_requested.connect(open_detail)
	continent_view = ContinentMapView.new()
	load_detail(land_id)
	continent_view.marker_picked.connect(func(label: String): info.text = label)
	views = [globe, atlas, continent_view]
	build_layout()
	switch_to(1)

func make_button(text: String, callback: Callable, minimum: Vector2 = Vector2(150, 64)) -> Button:
	var button := Button.new()
	button.text = text
	button.custom_minimum_size = minimum
	button.focus_mode = Control.FOCUS_NONE
	button.add_theme_font_size_override("font_size", 20)
	button.add_theme_color_override("font_color", Color("fff0cf"))
	PyraSkin.style_button(button)
	button.pressed.connect(callback)
	return button

func make_map_control(text: String, callback: Callable) -> Button:
	var button := make_button(text, callback, Vector2(104, 84))
	for state in ["normal", "hover", "pressed", "disabled"]:
		var box := StyleBoxFlat.new()
		box.bg_color = Color("152536") if state == "pressed" else Color(0.025, 0.035, 0.05, 0.94)
		box.border_color = Color("d7b373")
		box.set_border_width_all(2)
		box.set_corner_radius_all(14)
		box.set_content_margin_all(8)
		button.add_theme_stylebox_override(state, box)
	side_buttons.append(button)
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
	title.add_theme_font_override("font", MapStyle.font())
	title.add_theme_color_override("font_color", Color("f1c77f"))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	for i in 3:
		var button := make_button(["GLOBUS 3D", "MAPA 2D", "KRAINA: " + str(world_name())][i], func(): open_detail(picked if picked != "" else land_id) if i == 2 else switch_to(i), Vector2(i * 0 + 160 if i < 2 else 230, 64))
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
	zoom_column.offset_left = -130
	zoom_column.offset_right = -18
	zoom_column.offset_top = -190
	zoom_column.offset_bottom = 190
	zoom_column.add_theme_constant_override("separation", 10)
	stage.add_child(zoom_column)
	for entry in [["+", 1.3], ["−", 1.0 / 1.3]]:
		var factor: float = entry[1]
		zoom_column.add_child(make_map_control(entry[0], func(): zoom(factor)))
	zoom_column.add_child(make_map_control("TY", focus_player))
	zoom_column.add_child(make_map_control("ŚWIAT", world_overview))
	var card := PanelContainer.new()
	var card_style := StyleBoxFlat.new()
	card_style.bg_color = Color(0.025, 0.035, 0.05, 0.94)
	card_style.border_color = Color("8d6b3e")
	card_style.set_border_width_all(1)
	card_style.set_content_margin_all(14.0)
	card.add_theme_stylebox_override("panel", card_style)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(400, 36)
	info.add_theme_font_size_override("font_size", 17)
	info.add_theme_color_override("font_color", Color("efe0c8"))
	info.text = "22 osady · 4 kontynenty · 6 wysp. Wybierz ląd → KRAINA: drogi i lokacje. Złoty romb: osada; czerwony: Ty."
	var card_row := HBoxContainer.new()
	card_row.add_theme_constant_override("separation", 12)
	info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card_row.add_child(info)
	travel_button = make_button("PODRÓŻ", func(): travel.emit(picked), Vector2(260, 64))
	travel_button.visible = false
	card_row.add_child(travel_button)
	card.add_child(card_row)
	root.add_child(card)

func world_name() -> String:
	for region: Dictionary in regions:
		if region.id == detail_id:
			return str(region.name)
	return land_id

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
			open_detail(land_id)
			continent_view.focus(player_world, 3.0)

func switch_to(index: int) -> void:
	current = index
	for i in views.size():
		views[i].visible = i == index
		tabs[i].disabled = i == index
	title.text = ["GLOBUS PLANETY SUPERIOR", "MAPA PLANETY — ATLAS 2D", "MAPA SZCZEGÓŁOWA: " + str(world_name()).to_upper()][index]
	if index == 1:
		atlas.overview()
	elif index == 2:
		continent_view.focus(continent_view.world_size / 2.0, 1.0)

func world_overview() -> void:
	switch_to(1)
	atlas.overview()

func load_detail(id: String) -> void:
	if not worlds.has(id):
		return
	detail_id = id
	var world: Dictionary = worlds[id]
	var list: Array[Dictionary] = []
	for settlement: Dictionary in world.get("settlements", []):
		list.append({"point": Vector2(float(settlement.x), float(settlement.y)), "label": str(settlement.name), "kind": "city"})
	var counters: Dictionary = {}
	for place: Dictionary in world.get("places", []):
		var label := str(place.name)
		if label == "" and cave_labels.has(str(place.id)):
			label = str(cave_labels[str(place.id)])
		if label == "":
			if place.kind == "wilderness":
				continue
			counters[place.kind] = int(counters.get(place.kind, 0)) + 1
			label = "%s %d" % [str(place.label).capitalize(), int(counters[place.kind])]
		list.append({"point": Vector2(float(place.x), float(place.y)), "label": label, "kind": str(place.kind)})
	for place: Dictionary in world.get("famous", []):
		list.append({"point": Vector2(float(place.x), float(place.y)), "label": str(place.name), "kind": "famous"})
	continent_view.setup(load("res://assets/lands/%s/map.webp" % id), list, player_world, Vector2(float(world.width), float(world.height)))
	continent_view.show_player = id == land_id
	if tabs.size() > 2:
		tabs[2].text = "KRAINA: " + world_name()

func open_detail(id: String) -> void:
	load_detail(id)
	switch_to(2)
	show_region(id)

func region_text(region: Dictionary) -> String:
	var text := "%s · %s" % [str(region.name), str(region.summary)]
	if str(region.id) == land_id:
		text += " · Tu jesteś: %s." % place_name
	else:
		text += " · KRAINA: podgląd lokacji. PODRÓŻ: przenieś postać."
	return text

func show_region(id: String) -> void:
	for region: Dictionary in regions:
		if region.id == id:
			info.text = region_text(region)
			globe.select(id)
			atlas.selected = id
			picked = id
			tabs[2].text = "KRAINA: " + str(region.name)
			travel_button.visible = id != land_id
			travel_button.text = "PODRÓŻ: " + str(region.name).to_upper()
			return
