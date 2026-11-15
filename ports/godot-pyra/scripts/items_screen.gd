class_name ItemsScreen
extends Control
## One screen for every item service: merchant (buy / sell), depot (bag <-> chest, coins), smithy (crafting)
## and the player's bag with equipment. All rules live in PyraEconomy.

signal closed

var eco: PyraEconomy
var mode := "shop"
var title_text := ""
var tab := 0
var tab_names: Array = []
var selected := ""
var tab_buttons: Array[Button] = []
var list_box := VBoxContainer.new()
var gold_label := Label.new()
var title := Label.new()
var detail_icon := TextureRect.new()
var detail_title := Label.new()
var detail_meta := Label.new()
var detail_body := Label.new()
var action_box := HBoxContainer.new()
var extra_box := HBoxContainer.new()
var scroll := ScrollContainer.new()
var heal_hint := ""

func setup(economy: PyraEconomy, screen_mode: String, heading: String) -> void:
	eco = economy
	mode = screen_mode
	title_text = heading
	match mode:
		"shop":
			tab_names = ["KUP", "SPRZEDAJ"]
		"depot":
			tab_names = ["DO SKRZYNI", "ZE SKRZYNI"]
		"smithy":
			tab_names = ["KUŹNIA", "ALCHEMIA", "RUNY"]
		"inventory":
			tab_names = ["PLECAK", "WYPOSAŻENIE"]
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var background := ColorRect.new()
	background.color = Color("120d0f")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(background)
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
	title.text = title_text
	title.add_theme_font_size_override("font_size", 26)
	title.add_theme_color_override("font_color", Color("f1c77f"))
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bar.add_child(title)
	gold_label.add_theme_font_size_override("font_size", 22)
	gold_label.add_theme_color_override("font_color", Color("ffd76a"))
	bar.add_child(gold_label)
	for i in tab_names.size():
		var b := make_button(str(tab_names[i]), func(): switch_tab(i), Vector2(150, 58))
		tab_buttons.append(b)
		bar.add_child(b)
	bar.add_child(make_button("ZAMKNIJ", func(): closed.emit(), Vector2(140, 58)))
	root.add_child(bar)
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 14)
	root.add_child(body)
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.scroll_deadzone = 24
	list_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list_box.add_theme_constant_override("separation", 6)
	scroll.add_child(list_box)
	body.add_child(scroll)
	var detail := PanelContainer.new()
	detail.custom_minimum_size = Vector2(500, 0)
	detail.add_theme_stylebox_override("panel", panel(Color(0.09, 0.07, 0.08, 0.96)))
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	detail.add_child(box)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	detail_icon.custom_minimum_size = Vector2(84, 84)
	detail_icon.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	detail_icon.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	head.add_child(detail_icon)
	var head_text := VBoxContainer.new()
	head_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	detail_title.add_theme_font_size_override("font_size", 23)
	detail_title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	head_text.add_child(detail_title)
	detail_meta.add_theme_font_size_override("font_size", 16)
	detail_meta.add_theme_color_override("font_color", Color("bdac9b"))
	head_text.add_child(detail_meta)
	head.add_child(head_text)
	box.add_child(head)
	detail_body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	detail_body.add_theme_font_size_override("font_size", 17)
	detail_body.add_theme_color_override("font_color", Color("e1d4c4"))
	detail_body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(detail_body)
	extra_box.add_theme_constant_override("separation", 8)
	box.add_child(extra_box)
	action_box.add_theme_constant_override("separation", 8)
	box.add_child(action_box)
	body.add_child(detail)
	eco.changed.connect(refresh)
	switch_tab(0)

func panel(color: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = color
	style.border_color = Color("855c39")
	style.set_border_width_all(2)
	style.set_corner_radius_all(12)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 12
	style.content_margin_bottom = 12
	return style

func make_button(text: String, callback: Callable, minimum: Vector2) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = minimum
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 18)
	b.add_theme_color_override("font_color", Color("fff0cf"))
	b.add_theme_color_override("font_disabled_color", Color("8a7a6a"))
	for state in ["normal", "hover", "pressed", "disabled"]:
		var style := StyleBoxFlat.new()
		style.bg_color = {"normal": Color("533421"), "hover": Color("704b2d"), "pressed": Color("704b2d"), "disabled": Color("2a211f")}[state]
		style.border_color = Color("986c42") if state != "disabled" else Color("453a34")
		style.set_border_width_all(2)
		style.set_corner_radius_all(12)
		style.content_margin_left = 12
		style.content_margin_right = 12
		b.add_theme_stylebox_override(state, style)
	b.pressed.connect(callback)
	return b

func switch_tab(index: int) -> void:
	tab = index
	selected = ""
	scroll.scroll_vertical = 0
	refresh()

func select(id: String) -> void:
	selected = id
	refresh()

# ---- list sources -----------------------------------------------------------------------------

## Rows: {id, text, icon, color, dim}
func rows() -> Array:
	var out: Array = []
	match mode:
		"shop":
			if tab == 0:
				for id in eco.shop_ids:
					var afford := eco.gold >= eco.buy_price(id)
					out.append({"id": id, "text": "%s   ·   poz. %d   ·   %d mon." % [eco.name_of(id), eco.required_level(id), eco.buy_price(id)], "icon": eco.icon_path(id), "color": eco.rarity_color(id), "dim": not afford})
			else:
				for id: String in eco.bag:
					out.append({"id": id, "text": "%s ×%d   ·   skup %d mon." % [eco.name_of(id), eco.count(id), eco.sell_value(id)], "icon": eco.icon_path(id), "color": eco.rarity_color(id), "dim": false})
		"depot":
			var source: Dictionary = eco.bag if tab == 0 else eco.depot
			for id: String in source:
				out.append({"id": id, "text": "%s ×%d" % [eco.name_of(id), int(source[id])], "icon": eco.icon_path(id), "color": eco.rarity_color(id), "dim": false})
		"smithy":
			var station: String = PyraEconomy.STATIONS_PYRA[tab]
			for recipe: Dictionary in eco.recipes_for([station]):
				var check := eco.can_craft(recipe)
				out.append({"id": str(recipe.id), "text": "%s   ·   poz. %d   ·   %d mon." % [recipe.name, int(recipe.requiredLevel), int(recipe.cost)], "icon": eco.icon_path(str(recipe.result)), "color": Color("93e593") if check.ok else Color("9a8f86"), "dim": false})
		"inventory":
			if tab == 0:
				for id: String in eco.bag:
					out.append({"id": id, "text": "%s ×%d%s" % [eco.name_of(id), eco.count(id), ("   ·   " + PyraEconomy.SLOT_NAMES[eco.slot_of(id)]) if eco.slot_of(id) != "" else ""], "icon": eco.icon_path(id), "color": eco.rarity_color(id), "dim": false})
			else:
				for slot in PyraEconomy.SLOTS:
					var id := str(eco.equipment[slot])
					out.append({"id": "slot:" + slot, "text": "%s:  %s" % [PyraEconomy.SLOT_NAMES[slot], eco.name_of(id) if id != "" else "— puste —"], "icon": eco.icon_path(id) if id != "" else "", "color": eco.rarity_color(id) if id != "" else Color(0.6, 0.55, 0.5), "dim": id == ""})
	return out

func refresh() -> void:
	gold_label.text = "Monety: %d" % eco.gold + ("   Skrzynia: %d" % eco.depot_gold if mode == "depot" else "")
	for i in tab_buttons.size():
		tab_buttons[i].disabled = i == tab
	for child in list_box.get_children():
		child.queue_free()
	var list := rows()
	if list.is_empty():
		var empty := Label.new()
		empty.text = {"shop": "Plecak jest pusty.", "depot": "Brak przedmiotów.", "smithy": "Brak receptur.", "inventory": "Plecak jest pusty."}.get(mode, "")
		empty.add_theme_font_size_override("font_size", 19)
		empty.add_theme_color_override("font_color", Color("a69683"))
		list_box.add_child(empty)
	for row: Dictionary in list:
		var b := Button.new()
		b.text = str(row.text)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.clip_text = true
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(0, 66)
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.add_theme_constant_override("icon_max_width", 52)
		b.add_theme_constant_override("h_separation", 12)
		b.add_theme_font_size_override("font_size", 18)
		var color: Color = row.color
		b.add_theme_color_override("font_color", color.darkened(0.45) if bool(row.dim) else color)
		b.add_theme_color_override("font_hover_color", color.lightened(0.2))
		if str(row.icon) != "":
			b.icon = load(str(row.icon))
		var chosen: bool = str(row.id) == selected
		for state in ["normal", "hover", "pressed"]:
			var style := StyleBoxFlat.new()
			style.bg_color = Color(0.28, 0.19, 0.12, 0.95) if chosen else Color(0.13, 0.1, 0.1, 0.95)
			style.border_color = Color("e0b96d") if chosen else Color("4a3a30")
			style.set_border_width_all(2)
			style.set_corner_radius_all(10)
			style.content_margin_left = 10
			b.add_theme_stylebox_override(state, style)
		var id: String = str(row.id)
		b.pressed.connect(func(): select(id))
		list_box.add_child(b)
	show_detail()

# ---- detail and actions ------------------------------------------------------------------------

func clear_actions() -> void:
	for child in action_box.get_children():
		child.queue_free()
	for child in extra_box.get_children():
		child.queue_free()

func item_text(id: String) -> String:
	var lines: Array[String] = eco.stat_lines(id)
	var text := "\n".join(lines)
	var description := str(eco.item(id).get("description", ""))
	if description != "":
		text += ("\n\n" if text != "" else "") + description
	return text

func show_item(id: String) -> void:
	var def := eco.item(id)
	detail_icon.texture = load(eco.icon_path(id))
	detail_title.text = eco.name_of(id)
	detail_title.add_theme_color_override("font_color", eco.rarity_color(id))
	var slot := eco.slot_of(id)
	detail_meta.text = "%s · poz. %d%s" % [PyraEconomy.RARITY_NAMES.get(str(def.rarity), str(def.rarity)), eco.required_level(id), (" · " + PyraEconomy.SLOT_NAMES[slot]) if slot != "" else ""]
	detail_body.text = item_text(id)

func show_detail() -> void:
	clear_actions()
	detail_icon.texture = null
	detail_title.text = ""
	detail_meta.text = ""
	detail_body.text = hint_text()
	if selected == "":
		return
	match mode:
		"shop":
			show_item(selected)
			if tab == 0:
				var price := eco.buy_price(selected)
				var buy := make_button("KUP · %d mon." % price, func(): eco.buy(selected), Vector2(0, 56))
				buy.disabled = eco.gold < price
				action_box.add_child(buy)
			else:
				action_box.add_child(make_button("SPRZEDAJ · +%d mon." % eco.sell_value(selected), func(): eco.sell(selected), Vector2(0, 56)))
		"depot":
			show_item(selected)
			if tab == 0:
				action_box.add_child(make_button("DO SKRZYNI ×1", func(): eco.deposit(selected), Vector2(0, 56)))
			else:
				action_box.add_child(make_button("DO PLECAKA ×1", func(): eco.withdraw(selected), Vector2(0, 56)))
		"smithy":
			show_recipe()
		"inventory":
			show_inventory_item()
	if mode == "depot":
		for amount in [100, 1000]:
			var to_vault := make_button("+%d do skrzyni" % amount, func(): eco.move_gold(amount, true), Vector2(0, 48))
			to_vault.disabled = eco.gold < amount
			extra_box.add_child(to_vault)
			var back := make_button("−%d ze skrzyni" % amount, func(): eco.move_gold(amount, false), Vector2(0, 48))
			back.disabled = eco.depot_gold < amount
			extra_box.add_child(back)

func hint_text() -> String:
	if selected != "":
		return ""
	match mode:
		"shop":
			return "Kupiec sprzedaje tylko podstawowe przedmioty (pospolite i niepospolite) po cenie 4× katalogowej, nie mniej niż 60 monet za poziom. Skupuje za połowę ceny katalogowej. Lepszy sprzęt wytworzysz w kuźni.\n\nWybierz przedmiot z listy."
		"depot":
			return "Skrzynia jest Twoja i tylko Twoja. Przenoś przedmioty i monety między plecakiem a skrzynią.\n\nWybierz przedmiot z listy."
		"smithy":
			return "Wytwarzanie zużywa składniki i monety. Zielone receptury możesz wykonać teraz; szare — brakuje poziomu, składników lub monet.\n\nWybierz recepturę z listy."
	return "Wybierz pozycję z listy."

func show_recipe() -> void:
	var recipe: Dictionary = {}
	for r: Dictionary in eco.recipes:
		if str(r.id) == selected:
			recipe = r
	if recipe.is_empty():
		return
	var result := str(recipe.result)
	detail_icon.texture = load(eco.icon_path(result))
	detail_title.text = "%s ×%d" % [eco.name_of(result), int(recipe.count)]
	detail_title.add_theme_color_override("font_color", eco.rarity_color(result))
	detail_meta.text = "%s · poz. %d · koszt %d mon." % [PyraEconomy.STATION_NAMES.get(str(recipe.station), str(recipe.station)), int(recipe.requiredLevel), int(recipe.cost)]
	var text := "Składniki:\n"
	for ingredient: Dictionary in recipe.ingredients:
		var have := eco.count(str(ingredient.itemId))
		text += "  %s  %d / %d\n" % [eco.name_of(str(ingredient.itemId)), have, int(ingredient.count)]
	var stats := eco.stat_lines(result)
	if not stats.is_empty():
		text += "\nWynik:\n  " + "\n  ".join(stats)
	var check := eco.can_craft(recipe)
	if not check.ok:
		text += "\n\n" + str(check.reason)
	detail_body.text = text
	var craft := make_button("WYTWÓRZ", func(): eco.craft(recipe), Vector2(0, 56))
	craft.disabled = not check.ok
	action_box.add_child(craft)

func show_inventory_item() -> void:
	if selected.begins_with("slot:"):
		var slot := selected.substr(5)
		var id := str(eco.equipment[slot])
		if id == "":
			detail_body.text = "Slot jest pusty. Załóż przedmiot z plecaka."
			return
		show_item(id)
		action_box.add_child(make_button("ZDEJMIJ", func(): eco.unequip(slot), Vector2(0, 56)))
		return
	show_item(selected)
	if eco.slot_of(selected) != "":
		var equip := make_button("ZAŁÓŻ", func(): eco.equip(selected), Vector2(0, 56))
		equip.disabled = eco.required_level(selected) > eco.level
		action_box.add_child(equip)
	if str(eco.item(selected).category) == "consumable":
		action_box.add_child(make_button("UŻYJ", func(): eco.use(selected), Vector2(0, 56)))
