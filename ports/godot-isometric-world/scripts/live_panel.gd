extends Control
## Mobile-first Forged Obsidian & Gold Social Panel for KI Legends Isometric World:
## 6-channel Chat, Persistent Friends, Live Party (2-4) + Party HUD, Persistent Guilds (<TAG>),
## Classic RPG Paperdoll Player Profile Inspection, Live Mini-Feed & Incoming Invite Banner.

const ForgedUI := preload("res://scripts/forged_ui.gd")
const MapStyle := preload("res://scripts/map_style.gd")
const Items := preload("res://scripts/gm_panel.gd")
const RpgHud := preload("res://scripts/rpg_hud.gd")

const CHANNELS := {
	"world": "Świat",
	"land": "Kontynent",
	"local": "Lokalny",
	"party": "Drużyna",
	"guild": "Gildia",
	"whisper": "Szept",
}
const LAND_LABELS := {
	"pyra": "Pyra",
	"verdant": "Verdantia",
	"aether": "Aetheria",
	"nexus": "Nexus-9",
}
const RACE_LABELS := {
	"legend": "Legenda",
	"planetary": "Planetarny",
	"sage": "Mędrzec",
	"android": "Android",
}
const MAX_HISTORY := 100

var world: Node2D
var link: Node

var trigger := Button.new()
var mini_feed := Label.new()
var invite_bar := PanelContainer.new()
var invite_lbl := Label.new()
var invite_accept_btn := Button.new()
var invite_decline_btn := Button.new()
var party_hud := PanelContainer.new()
var party_hud_box := VBoxContainer.new()

var panel := PanelContainer.new()
var mode_bar := GridContainer.new()
var mode_buttons := {}
var active_mode := "chat" # "chat" | "friends" | "party" | "guild" | "profile"

var chat_body := VBoxContainer.new()
var friends_body := VBoxContainer.new()
var party_body := VBoxContainer.new()
var guild_body := VBoxContainer.new()
var profile_body := VBoxContainer.new()

var tabs := GridContainer.new()
var status := Label.new()
var connection_ok := false
var history := []
var channel := "local"
var scroll := ScrollContainer.new()
var transcript := Label.new()
var input := LineEdit.new()
var recipient := LineEdit.new()
var send_button := Button.new()
var buttons := {}

var friends_data: Dictionary = {"accepted": [], "incoming": [], "outgoing": []}
var party_data: Dictionary = {"partyId": "", "leaderId": "", "members": []}
var guild_data: Variant = null
var pending_invite: Dictionary = {} # {"kind": "party"|"guild"|"friend", "id": ..., "label": ...}

var power := 0
var online := 0
var unread_count := 0
var _mini_lines: Array[String] = []
var _mini_timer := 0.0
var _keyboard := 0
var _draft_sent := ""
var _send_deadline := 0
var _transcript_dirty := false

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE

	_style_button(trigger, "CZAT", "slate", 16)
	trigger.pressed.connect(func() -> void:
		if panel.visible:
			close_panel()
		else:
			open_chat()
	)
	add_child(trigger)

	mini_feed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mini_feed.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	mini_feed.add_theme_font_override("font", MapStyle.body_font())
	mini_feed.add_theme_font_size_override("font_size", 15)
	mini_feed.add_theme_color_override("font_color", Color(0.98, 0.94, 0.80))
	mini_feed.add_theme_color_override("font_outline_color", Color(0.02, 0.015, 0.02, 0.98))
	mini_feed.add_theme_constant_override("outline_size", 5)
	mini_feed.hide()
	add_child(mini_feed)

	# Floating Incoming Invite Banner (Party / Guild / Friend)
	invite_bar.add_theme_stylebox_override("panel", ForgedUI.compact_panel_box(16.0, 8.0, Color(0.98, 0.80, 0.36, 0.96)))
	invite_bar.set_anchors_preset(Control.PRESET_TOP_LEFT)
	invite_bar.hide()
	add_child(invite_bar)
	var inv_h := HBoxContainer.new()
	inv_h.add_theme_constant_override("separation", 10)
	invite_bar.add_child(inv_h)
	invite_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	invite_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	invite_lbl.autowrap_mode = TextServer.AUTOWRAP_OFF
	invite_lbl.clip_text = true
	invite_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	invite_lbl.custom_minimum_size = Vector2(160.0, 36.0)
	invite_lbl.add_theme_font_override("font", MapStyle.body_font())
	invite_lbl.add_theme_font_size_override("font_size", 15)
	invite_lbl.add_theme_color_override("font_color", Color(1.0, 0.94, 0.72))
	inv_h.add_child(invite_lbl)
	_style_button(invite_accept_btn, "AKCEPTUJ", "gold", 14)
	invite_accept_btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	invite_accept_btn.pressed.connect(func() -> void: _respond_pending_invite(true))
	inv_h.add_child(invite_accept_btn)
	_style_button(invite_decline_btn, "ODRZUĆ", "crimson", 14)
	invite_decline_btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	invite_decline_btn.pressed.connect(func() -> void: _respond_pending_invite(false))
	inv_h.add_child(invite_decline_btn)

	# Floating Compact Party HUD (visible on-screen when in a 2-4 player party)
	party_hud.add_theme_stylebox_override("panel", ForgedUI.compact_panel_box(12.0, 8.0, Color(0.42, 0.94, 0.64, 0.88)))
	party_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	party_hud.hide()
	add_child(party_hud)
	party_hud_box.add_theme_constant_override("separation", 4)
	party_hud_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	party_hud.add_child(party_hud_box)

	# Main Social Drawer Panel
	panel.add_theme_stylebox_override("panel", ForgedUI.panel_box(14, 14))
	panel.hide()
	add_child(panel)

	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 8)
	panel.add_child(root)

	var header := HBoxContainer.new()
	header.add_theme_constant_override("separation", 8)
	root.add_child(header)
	status.text = "Łączenie…"
	status.clip_text = true
	status.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	status.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	status.add_theme_font_override("font", MapStyle.body_font())
	status.add_theme_font_size_override("font_size", 15)
	status.add_theme_color_override("font_color", Color(0.92, 0.90, 0.82))
	header.add_child(status)
	var close := Button.new()
	_style_button(close, "Zamknij", "crimson", 15)
	close.pressed.connect(close_panel)
	header.add_child(close)

	# Primary Social Mode Tabs: CZAT | ZNAJOMI | DRUŻYNA | GILDIA
	mode_bar.add_theme_constant_override("h_separation", 4)
	mode_bar.add_theme_constant_override("v_separation", 4)
	root.add_child(mode_bar)
	for entry: Array in [["chat", "CZAT"], ["friends", "ZNAJOMI"], ["party", "DRUŻYNA"], ["guild", "GILDIA"]]:
		var mkey := str(entry[0])
		var mbtn := Button.new()
		_style_button(mbtn, str(entry[1]), "slate", 14)
		mbtn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mbtn.clip_text = true
		mbtn.toggle_mode = true
		mbtn.pressed.connect(func() -> void: _switch_mode(mkey))
		mode_bar.add_child(mbtn)
		mode_buttons[mkey] = mbtn

	for body: VBoxContainer in [chat_body, friends_body, party_body, guild_body, profile_body]:
		body.size_flags_vertical = Control.SIZE_EXPAND_FILL
		body.add_theme_constant_override("separation", 7)
		root.add_child(body)
		body.hide()
	chat_body.show()

	# --- 1. CHAT BODY ---
	tabs.add_theme_constant_override("h_separation", 4)
	tabs.add_theme_constant_override("v_separation", 4)
	for key: String in CHANNELS:
		var button := Button.new()
		_style_button(button, str(CHANNELS[key]), "slate", 13)
		button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		button.clip_text = true
		button.toggle_mode = true
		button.pressed.connect(func() -> void: _select_channel(key))
		tabs.add_child(button)
		buttons[key] = button
	chat_body.add_child(tabs)

	recipient.placeholder_text = "Nick adresata"
	recipient.max_length = 32
	recipient.custom_minimum_size.y = 44
	recipient.add_theme_font_size_override("font_size", 16)
	chat_body.add_child(recipient)

	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	chat_body.add_child(scroll)
	transcript.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	transcript.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	transcript.add_theme_font_override("font", MapStyle.body_font())
	transcript.add_theme_font_size_override("font_size", 16)
	transcript.add_theme_color_override("font_color", Color(0.96, 0.94, 0.88))
	scroll.add_child(transcript)

	var composer := HBoxContainer.new()
	composer.add_theme_constant_override("separation", 6)
	chat_body.add_child(composer)
	input.placeholder_text = "Napisz wiadomość"
	input.max_length = 120
	input.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	input.custom_minimum_size.y = 44
	input.add_theme_font_size_override("font_size", 16)
	input.text_submitted.connect(func(_message: String) -> void: _send())
	composer.add_child(input)
	_style_button(send_button, "Wyślij", "gold", 15)
	send_button.pressed.connect(_send)
	composer.add_child(send_button)

	get_viewport().size_changed.connect(_layout)
	_select_channel(channel)
	_switch_mode("chat")
	set_status(false, "Łączenie…")
	_layout()

func is_open() -> bool:
	return panel.visible

func open_chat() -> void:
	_open_panel_base()
	_switch_mode("chat")

func open_mode(mode_key: String) -> void:
	_open_panel_base()
	_switch_mode(mode_key)

func _open_panel_base() -> void:
	if world != null:
		world.motion = Vector2.ZERO
		world.move_pointer = -1
		world.target_pos = Vector2(-1.0, -1.0)
		if world.get("stick_layer") != null:
			world.stick_layer.queue_redraw()
	unread_count = 0
	_update_trigger_label()
	mini_feed.hide()
	panel.show()
	mouse_filter = Control.MOUSE_FILTER_STOP
	_layout()

func _switch_mode(mode_key: String) -> void:
	active_mode = mode_key
	chat_body.visible = mode_key == "chat"
	friends_body.visible = mode_key == "friends"
	party_body.visible = mode_key == "party"
	guild_body.visible = mode_key == "guild"
	profile_body.visible = mode_key == "profile"
	for mk: String in mode_buttons:
		(mode_buttons[mk] as Button).set_pressed_no_signal(mk == mode_key)
	if mode_key == "chat":
		_refresh_transcript()
	elif mode_key == "friends":
		if link != null and link.has_method("sync_friends"):
			link.sync_friends()
		_rebuild_friends_ui()
	elif mode_key == "party":
		_rebuild_party_ui()
	elif mode_key == "guild":
		if link != null and link.has_method("sync_guild"):
			link.sync_guild()
		_rebuild_guild_ui()

func close_panel() -> void:
	input.release_focus()
	recipient.release_focus()
	panel.hide()
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func set_available(enabled: bool) -> void:
	trigger.visible = enabled
	if not enabled:
		mini_feed.hide()
		invite_bar.hide()
		party_hud.hide()
		if panel.visible:
			close_panel()
	else:
		invite_bar.visible = not pending_invite.is_empty()
		var members: Array = party_data.get("members", [])
		party_hud.visible = members.size() >= 2

func _style_button(btn: Button, title: String, variant: String = "slate", fsz: int = 15) -> void:
	btn.text = title
	ForgedUI.style_button(btn, variant, fsz, 10, 6)
	btn.custom_minimum_size = Vector2(44, 44)

func _layout() -> void:
	var viewport := get_viewport_rect()
	var safe := viewport
	if OS.get_name() == "Android":
		var display := DisplayServer.get_display_safe_area()
		if display.has_area():
			var root_vp := get_tree().root
			var root_safe := root_vp.get_screen_transform().affine_inverse() * Rect2(display)
			var root_rect := root_vp.get_visible_rect()
			if root_rect.has_area():
				var scale_to_child := viewport.size / root_rect.size
				safe = Rect2(root_safe.position * scale_to_child, root_safe.size * scale_to_child).intersection(viewport)
	if not safe.has_area():
		safe = viewport
	var allowed_bottom := safe.end.y
	if _keyboard > 0:
		var display_height := maxf(float(DisplayServer.window_get_size().y), 1.0)
		allowed_bottom = minf(allowed_bottom, viewport.size.y * (1.0 - float(_keyboard) / display_height))

	var width := minf(safe.size.x - 20.0, 680.0)
	var min_height := 138.0 if _keyboard > 0 else 210.0
	var max_height := 480.0 if active_mode == "profile" else 440.0
	var panel_height := clampf(allowed_bottom - safe.position.y - 16.0, min_height, max_height)
	mode_bar.columns = 2 if width < 440.0 else 4
	tabs.columns = 3 if width < 520.0 else 6
	if _keyboard > 0:
		tabs.hide()
		mode_bar.hide()
	else:
		tabs.show()
		mode_bar.show()
	panel.size = Vector2(width, panel_height)
	panel.position = Vector2(safe.get_center().x - width * 0.5, maxf(safe.position.y + 8.0, allowed_bottom - panel_height - 8.0))

	# Non-overlapping CZAT trigger placement (never collides with XP bar!)
	if safe.size.x >= 900.0:
		var xp_w := minf(470.0, safe.size.x * 0.35)
		var xp_left := safe.get_center().x - xp_w * 0.5
		var tw := clampf(xp_left - safe.position.x - 26.0, 178.0, 238.0)
		trigger.size = Vector2(tw, 46.0)
		trigger.position = Vector2(maxf(safe.position.x + 14.0, xp_left - tw - 12.0), safe.end.y - 56.0)
	else:
		var tw_n := clampf(safe.size.x - 24.0, 154.0, 224.0)
		trigger.size = Vector2(tw_n, 44.0)
		trigger.position = Vector2(safe.get_center().x - tw_n * 0.5, maxf(safe.position.y + 8.0, safe.end.y - 106.0))

	mini_feed.size = Vector2(minf(safe.size.x - 28.0, 360.0), 46.0)
	mini_feed.position = Vector2(trigger.position.x, maxf(safe.position.y + 10.0, trigger.position.y - 52.0))

	var inv_w := minf(safe.size.x - 32.0, 520.0)
	var inv_x := safe.get_center().x - inv_w * 0.5
	var inv_y := safe.position.y + 14.0
	if safe.size.x >= 1100.0:
		inv_w = minf(safe.size.x - 790.0, 520.0)
		inv_x = clampf(safe.get_center().x - inv_w * 0.5, safe.position.x + 505.0, safe.end.x - 275.0 - inv_w)
	invite_bar.size = Vector2(inv_w, 60.0)
	invite_bar.position = Vector2(inv_x, inv_y)

	# Compact Party HUD under top-left utility bar (or top-center on narrow screens)
	var ph_w := 238.0
	party_hud.size = Vector2(ph_w, 0.0)
	if safe.size.x >= 1000.0:
		party_hud.position = Vector2(safe.position.x + 16.0, safe.position.y + 370.0)
	else:
		party_hud.position = Vector2(safe.position.x + 12.0, safe.position.y + 12.0)

func _process(delta: float) -> void:
	if _mini_timer > 0.0:
		_mini_timer -= delta
		if _mini_timer <= 0.0:
			mini_feed.hide()
	if not panel.visible:
		return
	if _transcript_dirty and chat_body.visible:
		_refresh_transcript()
	if not DisplayServer.has_feature(DisplayServer.FEATURE_VIRTUAL_KEYBOARD):
		return
	var height := DisplayServer.virtual_keyboard_get_height()
	if _keyboard != height:
		_keyboard = height
		_layout()

func set_status(connected: bool, message: String) -> void:
	connection_ok = connected
	status.text = message
	input.editable = connected
	send_button.disabled = not connected
	if not connected or message != "Połączono":
		_draft_sent = ""
	if not connected:
		update_online(0, 0)
		party_data = {"partyId": "", "leaderId": "", "members": []}
		party_hud.hide()

func _update_trigger_label() -> void:
	var badge := " [+%d]" % unread_count if unread_count > 0 else ""
	if connection_ok:
		trigger.text = "CZAT (%d) · KI %d%s" % [online, power, badge]
	else:
		trigger.text = "CZAT"

func update_online(count: int, ki_power: int) -> void:
	online = count
	power = ki_power
	_update_trigger_label()

func _select_channel(key: String) -> void:
	channel = key
	for entry: String in buttons:
		(buttons[entry] as Button).set_pressed_no_signal(entry == key)
	recipient.visible = channel == "whisper"
	_refresh_transcript()

func add_line(frame: Dictionary) -> void:
	if link != null and str(frame.get("id", "")) == str(link.peer_id) and str(frame.get("text", "")) == _draft_sent:
		if input.text.strip_edges() == _draft_sent:
			input.clear()
		_draft_sent = ""
		status.text = "Połączono"
	history.append(frame)
	if history.size() > MAX_HISTORY:
		history.pop_front()
	_transcript_dirty = true
	if not panel.visible and trigger.visible:
		var is_mine := link != null and str(frame.get("id", "")) == str(link.peer_id)
		if not is_mine:
			unread_count = mini(unread_count + 1, 99)
			_update_trigger_label()
		var sc_lbl := str(CHANNELS.get(str(frame.get("scope", "local")), "Czat"))
		var line_txt := "[%s] %s: %s" % [sc_lbl, str(frame.get("nick", "")), str(frame.get("text", ""))]
		_mini_lines.append(line_txt)
		if _mini_lines.size() > 2:
			_mini_lines.pop_front()
		mini_feed.text = "\n".join(_mini_lines)
		mini_feed.show()
		_mini_timer = 8.0

func _refresh_transcript() -> void:
	_transcript_dirty = false
	var lines := PackedStringArray()
	for line: Dictionary in history:
		if line.get("scope") != channel:
			continue
		var sender := str(line.get("nick", ""))
		var gtag := str(line.get("guildTag", ""))
		if not gtag.is_empty():
			sender = "<%s> %s" % [gtag, sender]
		if line.has("toNick"):
			sender += " → " + str(line["toNick"])
		lines.append("%s: %s" % [sender, str(line.get("text", ""))])
	transcript.text = "\n".join(lines)
	if scroll.is_inside_tree():
		_scroll_to_end.call_deferred()

func _scroll_to_end() -> void:
	if is_instance_valid(scroll):
		scroll.scroll_vertical = int(scroll.get_v_scroll_bar().max_value)

func _send() -> void:
	if channel == "whisper" and recipient.text.strip_edges().is_empty():
		status.text = "Wpisz nick adresata."
		return
	if not _draft_sent.is_empty() and Time.get_ticks_msec() < _send_deadline:
		return
	if link != null and link.send_chat(channel, input.text, recipient.text):
		_draft_sent = input.text.strip_edges()
		_send_deadline = Time.get_ticks_msec() + 3000

# ==============================================================================
# INCOMING INVITE BANNER (PARTY / GUILD / FRIEND)
# ==============================================================================

func show_invite_banner(kind: String, inv_id: String, message: String) -> void:
	pending_invite = {"kind": kind, "id": inv_id, "label": message}
	invite_lbl.text = message
	invite_bar.visible = trigger.visible
	_layout()

func _respond_pending_invite(accept: bool) -> void:
	if pending_invite.is_empty() or link == null:
		invite_bar.hide()
		return
	var kind := str(pending_invite.get("kind", ""))
	var inv_id := str(pending_invite.get("id", ""))
	pending_invite.clear()
	invite_bar.hide()
	if kind == "party":
		link.respond_party(inv_id, accept)
	elif kind == "guild":
		link.respond_guild(inv_id, accept)
	elif kind == "friend":
		if accept:
			link.accept_friend(inv_id)
		else:
			link.remove_friend(inv_id)

# ==============================================================================
# SOCIAL STATE UPDATES (FRIENDS, PARTY + HUD, GUILD)
# ==============================================================================

func apply_friends(frame: Dictionary) -> void:
	friends_data = {
		"accepted": frame.get("accepted", []),
		"incoming": frame.get("incoming", []),
		"outgoing": frame.get("outgoing", []),
	}
	var inc: Array = friends_data["incoming"]
	if mode_buttons.has("friends"):
		(mode_buttons["friends"] as Button).text = ("ZNAJOMI (%d)" % inc.size()) if not inc.is_empty() else "ZNAJOMI"
	if active_mode == "friends":
		_rebuild_friends_ui()

func apply_party(frame: Dictionary) -> void:
	party_data = {
		"partyId": str(frame.get("partyId", "")),
		"leaderId": str(frame.get("leaderId", "")),
		"members": frame.get("members", []),
	}
	var members: Array = party_data["members"]
	if mode_buttons.has("party"):
		(mode_buttons["party"] as Button).text = ("DRUŻYNA (%d)" % members.size()) if members.size() >= 2 else "DRUŻYNA"
	_rebuild_party_hud()
	if active_mode == "party":
		_rebuild_party_ui()

func apply_guild(frame: Dictionary) -> void:
	guild_data = frame.get("guild", null)
	if mode_buttons.has("guild"):
		if guild_data is Dictionary:
			(mode_buttons["guild"] as Button).text = "<%s>" % str((guild_data as Dictionary).get("tag", "GILDIA"))
		else:
			(mode_buttons["guild"] as Button).text = "GILDIA"
	if active_mode == "guild":
		_rebuild_guild_ui()

func _clear_box(box: Container) -> void:
	for ch in box.get_children():
		box.remove_child(ch)
		ch.queue_free()

func _rebuild_party_hud() -> void:
	_clear_box(party_hud_box)
	var members: Array = party_data.get("members", [])
	if members.size() < 2 or not trigger.visible:
		party_hud.hide()
		return
	var title := Label.new()
	title.text = "DRUŻYNA (%d/4)" % members.size()
	title.add_theme_font_override("font", MapStyle.font())
	title.add_theme_font_size_override("font_size", 13)
	title.add_theme_color_override("font_color", Color(0.56, 0.98, 0.72))
	party_hud_box.add_child(title)
	for m_var: Variant in members:
		if not m_var is Dictionary:
			continue
		var m: Dictionary = m_var
		var row := Label.new()
		var crown := "★ " if bool(m.get("isLeader", false)) else "• "
		var land_s := str(LAND_LABELS.get(str(m.get("land", "")), str(m.get("land", ""))))
		row.text = "%s%s (Poz.%d)  HP %d/%d · %s" % [
			crown,
			str(m.get("name", m.get("nick", ""))),
			int(m.get("level", 1)),
			int(m.get("hp", 0)),
			int(m.get("maxHp", 1)),
			land_s,
		]
		row.add_theme_font_override("font", MapStyle.body_font())
		row.add_theme_font_size_override("font_size", 13)
		row.add_theme_color_override("font_color", Color(0.96, 0.96, 0.90))
		party_hud_box.add_child(row)
	party_hud.show()
	_layout()

func _rebuild_friends_ui() -> void:
	_clear_box(friends_body)
	var add_row := HBoxContainer.new()
	add_row.add_theme_constant_override("separation", 6)
	friends_body.add_child(add_row)
	var f_in := LineEdit.new()
	f_in.placeholder_text = "Nick gracza do dodania…"
	f_in.max_length = 32
	f_in.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	f_in.custom_minimum_size.y = 44
	f_in.add_theme_font_size_override("font_size", 15)
	add_row.add_child(f_in)
	var f_add := Button.new()
	_style_button(f_add, "+ DODAJ", "gold", 14)
	f_add.pressed.connect(func() -> void:
		if link != null and link.request_friend(f_in.text):
			f_in.clear()
	)
	add_row.add_child(f_add)

	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	friends_body.add_child(sc)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	sc.add_child(list)

	var inc: Array = friends_data.get("incoming", [])
	for entry_v: Variant in inc:
		var e: Dictionary = entry_v
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		var lbl := Label.new()
		lbl.text = "Zaproszenie: %s" % str(e.get("nick", ""))
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_size_override("font_size", 15)
		lbl.add_theme_color_override("font_color", Color(1.0, 0.88, 0.44))
		row.add_child(lbl)
		var acc := Button.new()
		_style_button(acc, "AKCEPTUJ", "gold", 13)
		var acc_id := str(e.get("accountId", e.get("nick", "")))
		acc.pressed.connect(func() -> void:
			if link != null:
				link.accept_friend(acc_id)
		)
		row.add_child(acc)
		var dec := Button.new()
		_style_button(dec, "ODRZUĆ", "crimson", 13)
		dec.pressed.connect(func() -> void:
			if link != null:
				link.remove_friend(acc_id)
		)
		row.add_child(dec)
		list.add_child(row)

	var accepted: Array = friends_data.get("accepted", [])
	if accepted.is_empty() and inc.is_empty():
		var empty := Label.new()
		empty.text = "Brak znajomych. Wpisz nick powyżej lub kliknij innego gracza na mapie!"
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		empty.add_theme_font_size_override("font_size", 15)
		empty.add_theme_color_override("font_color", Color(0.76, 0.74, 0.72))
		list.add_child(empty)

	for entry_v: Variant in accepted:
		var e: Dictionary = entry_v
		var is_on := bool(e.get("online", false))
		var nick := str(e.get("nick", ""))
		var acc_id := str(e.get("accountId", nick))
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		var lbl := Label.new()
		var sub := ("ONLINE · %s · Poz.%d" % [str(LAND_LABELS.get(str(e.get("land", "")), "")), int(e.get("level", 1))]) if is_on else "offline"
		lbl.text = "%s %s (%s)" % ["●" if is_on else "○", nick, sub]
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_size_override("font_size", 15)
		lbl.add_theme_color_override("font_color", Color(0.56, 0.98, 0.72) if is_on else Color(0.68, 0.66, 0.70))
		row.add_child(lbl)
		if is_on:
			var wb := Button.new()
			_style_button(wb, "SZEPT", "slate", 13)
			wb.pressed.connect(func() -> void:
				_switch_mode("chat")
				recipient.text = nick
				_select_channel("whisper")
				input.grab_focus()
			)
			row.add_child(wb)
			var pb := Button.new()
			_style_button(pb, "+ DRUŻYNA", "gold", 13)
			pb.pressed.connect(func() -> void:
				if link != null:
					link.invite_party(nick)
			)
			row.add_child(pb)
		var rm := Button.new()
		_style_button(rm, "USUŃ", "crimson", 13)
		rm.pressed.connect(func() -> void:
			if link != null:
				link.remove_friend(acc_id)
		)
		row.add_child(rm)
		list.add_child(row)

	var outgoing: Array = friends_data.get("outgoing", [])
	for entry_v: Variant in outgoing:
		var e: Dictionary = entry_v
		var row := HBoxContainer.new()
		var lbl := Label.new()
		lbl.text = "Wysłane zaproszenie: %s" % str(e.get("nick", ""))
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_size_override("font_size", 14)
		lbl.add_theme_color_override("font_color", Color(0.76, 0.78, 0.84))
		row.add_child(lbl)
		var can := Button.new()
		_style_button(can, "ANULUJ", "slate", 13)
		var acc_id := str(e.get("accountId", str(e.get("nick", ""))))
		can.pressed.connect(func() -> void:
			if link != null:
				link.remove_friend(acc_id)
		)
		row.add_child(can)
		list.add_child(row)

func _rebuild_party_ui() -> void:
	_clear_box(party_body)
	var inv_row := HBoxContainer.new()
	inv_row.add_theme_constant_override("separation", 6)
	party_body.add_child(inv_row)
	var p_in := LineEdit.new()
	p_in.placeholder_text = "Zaproś gracza do drużyny (nick)…"
	p_in.max_length = 32
	p_in.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	p_in.custom_minimum_size.y = 44
	p_in.add_theme_font_size_override("font_size", 15)
	inv_row.add_child(p_in)
	var p_btn := Button.new()
	_style_button(p_btn, "+ ZAPROŚ", "gold", 14)
	p_btn.pressed.connect(func() -> void:
		if link != null and link.invite_party(p_in.text):
			p_in.clear()
	)
	inv_row.add_child(p_btn)

	var members: Array = party_data.get("members", [])
	var leader_id := str(party_data.get("leaderId", ""))
	var am_leader := link != null and str(link.peer_id) == leader_id
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	party_body.add_child(sc)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	sc.add_child(list)

	if members.is_empty():
		var empty := Label.new()
		empty.text = "Nie należysz do żadnej drużyny (maks. 4 graczy). Wpisz nick lub kliknij gracza na mapie."
		empty.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		empty.add_theme_font_size_override("font_size", 15)
		empty.add_theme_color_override("font_color", Color(0.76, 0.74, 0.72))
		list.add_child(empty)
		return

	for m_v: Variant in members:
		var m: Dictionary = m_v
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		var lbl := Label.new()
		var crown := "★ LIDER · " if bool(m.get("isLeader", false)) else ""
		var land_s := str(LAND_LABELS.get(str(m.get("land", "")), ""))
		lbl.text = "%s%s (%s) · Poz.%d · %s · HP %d/%d · KI %d" % [
			crown,
			str(m.get("name", "")),
			str(m.get("nick", "")),
			int(m.get("level", 1)),
			land_s,
			int(m.get("hp", 0)),
			int(m.get("maxHp", 1)),
			int(m.get("power", 0)),
		]
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		lbl.add_theme_font_size_override("font_size", 15)
		lbl.add_theme_color_override("font_color", Color(0.56, 0.98, 0.72))
		row.add_child(lbl)
		var mid := str(m.get("id", ""))
		if am_leader and link != null and mid != str(link.peer_id):
			var kb := Button.new()
			_style_button(kb, "WYRZUĆ", "crimson", 13)
			kb.pressed.connect(func() -> void:
				if link != null:
					link.kick_party(mid)
			)
			row.add_child(kb)
		list.add_child(row)

	var leave_btn := Button.new()
	_style_button(leave_btn, "OPUŚĆ DRUŻYNĘ", "crimson", 15)
	leave_btn.pressed.connect(func() -> void:
		if link != null:
			link.leave_party()
	)
	party_body.add_child(leave_btn)

func _rebuild_guild_ui() -> void:
	_clear_box(guild_body)
	if not (guild_data is Dictionary):
		var info := Label.new()
		info.text = "Nie należysz do żadnej gildii. Załóż własny Zakon Ki (nazwa 3–24 znaki, tag 2–5 liter/cyfr):"
		info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		info.add_theme_font_size_override("font_size", 15)
		info.add_theme_color_override("font_color", Color(0.92, 0.88, 0.76))
		guild_body.add_child(info)
		var g_name := LineEdit.new()
		g_name.placeholder_text = "Nazwa gildii (np. Zakon Płomienia)"
		g_name.max_length = 24
		g_name.custom_minimum_size.y = 44
		g_name.add_theme_font_size_override("font_size", 16)
		guild_body.add_child(g_name)
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 8)
		guild_body.add_child(row)
		var g_tag := LineEdit.new()
		g_tag.placeholder_text = "TAG (2–5, np. PYRA)"
		g_tag.max_length = 5
		g_tag.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		g_tag.custom_minimum_size.y = 44
		g_tag.add_theme_font_size_override("font_size", 16)
		row.add_child(g_tag)
		var create_btn := Button.new()
		_style_button(create_btn, "ZAŁÓŻ GILDIĘ", "gold", 15)
		create_btn.pressed.connect(func() -> void:
			if link != null:
				link.create_guild(g_name.text, g_tag.text)
		)
		row.add_child(create_btn)
		return

	var g: Dictionary = guild_data
	var hdr := Label.new()
	hdr.text = "<%s> %s  ·  Twoja ranga: %s" % [str(g.get("tag", "")), str(g.get("name", "")), str(g.get("role", "member")).to_upper()]
	hdr.add_theme_font_override("font", MapStyle.font())
	hdr.add_theme_font_size_override("font_size", 17)
	hdr.add_theme_color_override("font_color", Color(1.0, 0.88, 0.48))
	guild_body.add_child(hdr)

	var my_role := str(g.get("role", "member"))
	if my_role == "leader" or my_role == "officer":
		var inv_row := HBoxContainer.new()
		inv_row.add_theme_constant_override("separation", 6)
		guild_body.add_child(inv_row)
		var gi_in := LineEdit.new()
		gi_in.placeholder_text = "Zaproś gracza do gildii (nick)…"
		gi_in.max_length = 32
		gi_in.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		gi_in.custom_minimum_size.y = 44
		inv_row.add_child(gi_in)
		var gi_btn := Button.new()
		_style_button(gi_btn, "+ ZAPROŚ", "gold", 14)
		gi_btn.pressed.connect(func() -> void:
			if link != null and link.invite_guild(gi_in.text):
				gi_in.clear()
		)
		inv_row.add_child(gi_btn)

	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	guild_body.add_child(sc)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 6)
	sc.add_child(list)

	var members: Array = g.get("members", [])
	for m_v: Variant in members:
		var m: Dictionary = m_v
		var is_on := bool(m.get("online", false))
		var mnick := str(m.get("nick", ""))
		var mrole := str(m.get("role", "member"))
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 6)
		var lbl := Label.new()
		var sub := ("ONLINE · %s · Poz.%d" % [str(LAND_LABELS.get(str(m.get("land", "")), "")), int(m.get("level", 1))]) if is_on else "offline"
		lbl.text = "%s [%s] %s (%s)" % ["●" if is_on else "○", mrole.to_upper(), mnick, sub]
		lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lbl.add_theme_font_size_override("font_size", 15)
		lbl.add_theme_color_override("font_color", Color(0.56, 0.98, 0.72) if is_on else Color(0.70, 0.68, 0.72))
		row.add_child(lbl)
		if (my_role == "leader" and mrole != "leader") or (my_role == "officer" and mrole == "member"):
			var kb := Button.new()
			_style_button(kb, "WYRZUĆ", "crimson", 13)
			var acc_id := str(m.get("accountId", mnick))
			kb.pressed.connect(func() -> void:
				if link != null:
					link.kick_guild(acc_id)
			)
			row.add_child(kb)
		list.add_child(row)

	var leave_btn := Button.new()
	_style_button(leave_btn, "OPUŚĆ GILDIĘ", "crimson", 15)
	leave_btn.pressed.connect(func() -> void:
		if link != null:
			link.leave_guild()
	)
	guild_body.add_child(leave_btn)

# ==============================================================================
# UPGRADED CLASSIC RPG PAPERDOLL PROFILE INSPECTION CARD
# ==============================================================================

func show_profile(frame: Dictionary) -> void:
	_open_panel_base()
	_switch_mode("profile")
	_clear_box(profile_body)

	var pname := str(frame.get("name", ""))
	var pnick := str(frame.get("nick", ""))
	var plv := int(frame.get("level", 1))
	var ppower := int(frame.get("power", 0))
	var prace := str(frame.get("race", "legend"))
	var pgtag := str(frame.get("guildTag", ""))
	var pki := bool(frame.get("ki", false))
	var gtag_part := ("  <%s>" % pgtag) if not pgtag.is_empty() else ""

	var hdr := Label.new()
	hdr.text = "%s (%s)%s  ·  Poz. %d %s  ·  MOC KI: %d%s" % [
		pname, pnick, gtag_part, plv, str(RACE_LABELS.get(prace, prace)), ppower, " [FORMA KI]" if pki else "",
	]
	hdr.autowrap_mode = TextServer.AUTOWRAP_OFF
	hdr.clip_text = true
	hdr.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	hdr.custom_minimum_size = Vector2(200, 26)
	hdr.add_theme_font_override("font", MapStyle.font())
	hdr.add_theme_font_size_override("font_size", 16)
	hdr.add_theme_color_override("font_color", Color(0.46, 0.98, 1.0) if pki else Color(1.0, 0.90, 0.54))
	profile_body.add_child(hdr)

	var equipment_scroll := ScrollContainer.new()
	equipment_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	equipment_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	equipment_scroll.custom_minimum_size = Vector2(0, 148)
	profile_body.add_child(equipment_scroll)

	var gear := HBoxContainer.new()
	gear.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gear.add_theme_constant_override("separation", 10)
	equipment_scroll.add_child(gear)

	var left := VBoxContainer.new()
	left.add_theme_constant_override("separation", 5)
	var right := VBoxContainer.new()
	right.add_theme_constant_override("separation", 5)

	var portrait_box := VBoxContainer.new()
	portrait_box.alignment = BoxContainer.ALIGNMENT_CENTER
	var portrait := TextureRect.new()
	var race_land := str(world.RACE_TO_LAND.get(prace, "pyra")) if world != null else "pyra"
	if world != null and world.has_method("load_tex"):
		portrait.texture = world.load_tex("res://assets/ui/portrait_%s.webp" % race_land)
	portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait.custom_minimum_size = Vector2(92, 134)
	portrait_box.add_child(portrait)

	left.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	gear.add_child(left)
	gear.add_child(portrait_box)
	gear.add_child(right)

	var equipment: Dictionary = frame.get("equipment", {})
	var slot_names: Array = RpgHud.EQUIP_SLOT_NAMES
	const SLOT_KEYS := ["helm", "amulet", "weapon", "gloves", "armor", "shield", "ring", "boots"]
	# Left RPG slots: Hełm(0), Broń(2), Pancerz(4), Rękawice(3); Right RPG slots: Amulet(1), Tarcza(5), Pierścień(6), Buty(7)
	var left_order := [0, 2, 4, 3]
	var right_order := [1, 5, 6, 7]
	for pair: Array in [[left, left_order], [right, right_order]]:
		var col_box: VBoxContainer = pair[0]
		for si: int in pair[1]:
			var row := HBoxContainer.new()
			row.add_theme_constant_override("separation", 6)
			var raw_id := str(equipment.get(str(si), ""))
			if raw_id.is_empty() and si < SLOT_KEYS.size():
				raw_id = str(equipment.get(SLOT_KEYS[si], ""))
			var item: Dictionary = Items.find_item(raw_id)
			var ico_tr := TextureRect.new()
			ico_tr.custom_minimum_size = Vector2(30, 30)
			ico_tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			ico_tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			if not item.is_empty() and world != null and world.has_method("load_tex"):
				var ico_name := str(item.get("icon", ""))
				if not ico_name.is_empty():
					ico_tr.texture = world.load_tex("res://assets/ui/icons/" + ico_name)
			row.add_child(ico_tr)
			var slot_lbl := Label.new()
			slot_lbl.text = "%s: %s" % [str(slot_names[si]), str(item.get("name", "Pusty"))]
			slot_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			slot_lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
			slot_lbl.autowrap_mode = TextServer.AUTOWRAP_OFF
			slot_lbl.clip_text = true
			slot_lbl.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
			slot_lbl.custom_minimum_size = Vector2(80, 30)
			slot_lbl.add_theme_font_override("font", MapStyle.body_font())
			slot_lbl.add_theme_font_size_override("font_size", 14)
			var rcol: Color = item.get("rarity", Color(0.62, 0.58, 0.54)) as Color if not item.is_empty() else Color(0.58, 0.55, 0.52)
			slot_lbl.add_theme_color_override("font_color", rcol)
			row.add_child(slot_lbl)
			col_box.add_child(row)

	var actions := HBoxContainer.new()
	actions.add_theme_constant_override("separation", 6)
	profile_body.add_child(actions)

	var whisper_btn := Button.new()
	_style_button(whisper_btn, "SZEPT", "slate", 13)
	whisper_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	whisper_btn.clip_text = true
	whisper_btn.pressed.connect(func() -> void:
		_switch_mode("chat")
		recipient.text = pnick
		_select_channel("whisper")
		input.grab_focus()
	)
	actions.add_child(whisper_btn)

	var friend_btn := Button.new()
	var already_friend := bool(frame.get("isFriend", false))
	_style_button(friend_btn, "✓ ZNAJOMY" if already_friend else "+ ZNAJOMY", "slate" if already_friend else "gold", 13)
	friend_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	friend_btn.clip_text = true
	friend_btn.disabled = already_friend
	friend_btn.pressed.connect(func() -> void:
		if link != null:
			link.request_friend(pnick)
			friend_btn.disabled = true
			friend_btn.text = "WYSŁANO"
	)
	actions.add_child(friend_btn)

	var party_btn := Button.new()
	var same_party := bool(frame.get("sameParty", false))
	_style_button(party_btn, "W DRUŻYNIE" if same_party else "+ DRUŻYNA", "slate" if same_party else "gold", 13)
	party_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	party_btn.clip_text = true
	party_btn.disabled = same_party or not bool(frame.get("canInviteParty", true))
	party_btn.pressed.connect(func() -> void:
		if link != null:
			link.invite_party(str(frame.get("id", pnick)))
			party_btn.disabled = true
			party_btn.text = "ZAPROSZONO"
	)
	actions.add_child(party_btn)

	if bool(frame.get("canInviteGuild", false)):
		var guild_btn := Button.new()
		_style_button(guild_btn, "+ GILDIA", "gold", 13)
		guild_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		guild_btn.clip_text = true
		guild_btn.pressed.connect(func() -> void:
			if link != null:
				link.invite_guild(str(frame.get("id", pnick)))
				guild_btn.disabled = true
				guild_btn.text = "ZAPROSZONO"
		)
		actions.add_child(guild_btn)

	_layout()
	_layout.call_deferred()
