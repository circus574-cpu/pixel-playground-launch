extends Control
## Uses the normal authenticated HTTP transport, never a local GM flag. Preview is a disposable private World2D.
signal picked(action: String)
const SCENE := "res://service_preview/pyra/world.tscn"
var request: Callable
var allowed := false
var preview: SubViewportContainer
var world: Node2D
var close_button: Button
var page := VBoxContainer.new()
var caption := Label.new()
var timer := Timer.new()
var checking := false
var full_mode := false
var char_id := ""
var char_view: Node
var autosave := Timer.new()
const HOME := {"legend": "pyra", "planetary": "verdant", "sage": "aether", "android": "nexus"}

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter=Control.MOUSE_FILTER_STOP
	var back:=ColorRect.new()
	back.color=Color("0a101b")
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(back)
	page.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	page.grow_horizontal=Control.GROW_DIRECTION_BOTH
	page.grow_vertical=Control.GROW_DIRECTION_BOTH
	page.custom_minimum_size=Vector2(600,0)
	page.add_theme_constant_override("separation",18)
	add_child(page)
	var title:=Label.new()
	title.text="KI LEGENDS · TEST SERWER"
	title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size",30)
	page.add_child(title)
	caption.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	caption.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	caption.add_theme_font_size_override("font_size",22)
	page.add_child(caption)
	timer.wait_time=3
	timer.timeout.connect(refresh_access)
	add_child(timer)
	resized.connect(layout_preview)
	set_process_unhandled_key_input(true)

func read_status() -> Dictionary:
	if not request.is_valid():return {}
	var result: Dictionary=await request.call(HTTPClient.METHOD_GET,"/ws/godot/status",null,true,8.0)
	if int(result.get("status",0))!=200 or not result.get("json") is Dictionary:return {}
	return result.json

static func permits_preview(status: Dictionary) -> bool:
	return status.get("maintenance")==true and status.get("canPreview")==true and status.get("canEnter")==true

func run() -> String:
	caption.text="Sprawdzanie dostępu…"
	var status:=await read_status()
	if status.get("maintenance")==false and status.get("canEnter")==true:
		if ResourceLoader.exists(SCENE):
			open_world(true)
			timer.start()
			return await picked
		return "continue"
	show_status(status)
	timer.start()
	return await picked

func show_status(status: Dictionary) -> void:
	allowed=permits_preview(status)
	caption.text="Podgląd administratora. Ta scena nie zmienia zapisów postaci." if allowed else str(status.get("message","Nie można sprawdzić serwera. Spróbuj ponownie."))
	for child in page.get_children():
		if child is Button:child.queue_free()
	if allowed:
		button("PROTOTYP IZOMETRYCZNY · PYRA",open_preview)
		button("WEJDŹ DO GRY",func():open_world(true))
	else:
		button("ZALOGUJ JAKO ADMINISTRATOR",func():picked.emit("login"))
	button("SPRAWDŹ PONOWNIE",refresh_access)
	button("ZAMKNIJ",func():picked.emit("quit"))

func button(text: String, action: Callable) -> void:
	var control:=Button.new()
	control.text=text
	control.custom_minimum_size=Vector2(580,84)
	control.add_theme_font_size_override("font_size",22)
	control.pressed.connect(action)
	page.add_child(control)

func refresh_access() -> void:
	if checking:return
	checking=true
	var status:=await read_status()
	checking=false
	if not is_inside_tree():return
	if preview!=null and not full_mode and not permits_preview(status):close_preview()
	if status.get("maintenance")==false and status.get("canEnter")==true:
		if preview==null:
			if ResourceLoader.exists(SCENE):open_world(true)
			else:picked.emit("continue")
		return
	show_status(status)

func open_preview() -> void:
	if checking or preview!=null:return
	checking=true
	var status:=await read_status()
	checking=false
	if not permits_preview(status):
		show_status(status)
		return
	open_world(false)

func open_world(full: bool) -> void:
	if preview!=null or char_view!=null:return
	if full:
		var chosen: String=await choose_character()
		if chosen=="":return
		char_id=chosen
	spawn_world(full)

## The account's heroes: the characters of the server account (the same as in the browser, GET /ws/characters) plus the ones only on
## this device. A hero made here is created on the server (POST /ws/characters: nick and race). Returns the local slot id or "".
func choose_character() -> String:
	var Chars=load("res://scripts/characters.gd")
	var online=KiNet.online()
	var server: Dictionary={}
	if online.logged_in():
		var answer: Dictionary=await online.request(HTTPClient.METHOD_GET,"/ws/characters")
		if int(answer.get("status",0))==200 and answer.get("json") is Dictionary:
			for record in (answer.json as Dictionary).get("characters",[]):
				if record is Dictionary:server["srv-"+str(record.get("id",""))]=record
		else:
			notice("Nie udało się pobrać postaci z serwera. Spróbuj ponownie.")
	while true:
		var roster: Array[Dictionary]=[]
		for id in server:
			var player: Dictionary=(server[id] as Dictionary).get("state",{}).get("player",{})
			var race:=str(player.get("race","legend"))
			if not HOME.has(race):continue
			roster.append({"id":id,"race":race,"level":int(player.get("level",1)),"land":HOME[race],"time":int(Time.get_unix_time_from_system()),"cloudSlot":0,"name":str(player.get("name","")),"extra":progress_text(player)})
		for entry in Chars.list():
			if not server.has(str(entry.id)):roster.append(entry)
		if roster.is_empty():
			var made:=await create_character(Chars,server)
			if made=="":return ""
			continue
		page.hide()
		var view=load("res://scripts/character_select.gd").new()
		view.setup(roster,"")
		char_view=view
		add_child(view)
		var result:=[""]
		view.picked.connect(func(id:String)->void:result[0]=id;view.queue_free())
		view.new_character.connect(func()->void:result[0]="#new";view.queue_free())
		await view.tree_exited
		char_view=null
		if result[0]=="":
			page.show()
			return ""
		if result[0]=="#new":
			var made:=await create_character(Chars,server)
			if made!="":return made
			continue
		return adopt_server_character(Chars,server,str(result[0]))
	return ""

## Current progress of a hero for its card: experience, gold, learned skills, kills/quests when the record has them.
func progress_text(player: Dictionary) -> String:
	var lines: Array[String]=[]
	lines.append("PD: %d · złoto: %d" % [int(player.get("xp",0)),int(player.get("gold",0))])
	var skills: Variant=player.get("skills",[])
	if skills is Array:lines.append("umiejętności: %d" % (skills as Array).size())
	for key in ["kills","quests","questsDone","monstersKilled"]:
		if player.has(key):
			lines.append("%s: %s" % [{"kills":"zabójstwa","quests":"questy","questsDone":"questy","monstersKilled":"potwory"}[key],str(player[key]) if not player[key] is Array and not player[key] is Dictionary else str(player[key].size())])
	return "\n".join(lines)

## A server character becomes a local slot (kept: progress already made on the device is not overwritten).
func adopt_server_character(Chars,server: Dictionary,id: String) -> String:
	if not server.has(id):return id
	if Chars.read(Chars.slot_path(id)).is_empty():
		var player: Dictionary=(server[id] as Dictionary).get("state",{}).get("player",{})
		var race:=str(player.get("race","legend"))
		Chars.write(Chars.slot_path(id),{"characterId":id,"race":race,"land":HOME.get(race,"pyra"),"name":str(player.get("name","")),"kit":{"level":int(player.get("level",1))},"gold":int(player.get("gold",20)),"cloudSlot":0})
	return id

func create_character(Chars,server: Dictionary) -> String:
	page.hide()
	var view=RaceScreen.new()
	view.setup(true)
	char_view=view
	add_child(view)
	var race:=[""]
	view.chosen.connect(func(r:String)->void:race[0]=r)
	view.closed.connect(func()->void:race[0]="#back")
	while race[0]=="":await get_tree().process_frame
	view.queue_free()
	char_view=null
	if race[0]=="#back":return ""
	var nick:=await ask_name(str(race[0]))
	if nick=="":return ""
	var online=KiNet.online()
	if online.logged_in():
		var created: Dictionary=await online.request(HTTPClient.METHOD_POST,"/ws/characters",{"race":race[0],"name":nick})
		if int(created.get("status",0))==201 and created.get("json") is Dictionary:
			var record: Dictionary=created.json
			var rid:="srv-"+str(record.get("id",""))
			server[rid]=record
			Chars.write(Chars.slot_path(rid),{"characterId":rid,"race":race[0],"land":HOME[race[0]],"name":nick,"kit":{"level":1},"gold":20,"cloudSlot":0})
			return rid
		notice(PyraOnline.message_of(created,"Serwer nie utworzył postaci (nick zajęty lub niedozwolony)."))
		return ""
	var id:String=Chars.new_id()
	Chars.write(Chars.slot_path(id),{"characterId":id,"race":race[0],"land":HOME[race[0]],"name":nick,"kit":{"level":1},"gold":20,"cloudSlot":0})
	return id

## The nick of a new hero: a full-screen form; "" when the player goes back.
func ask_name(race: String) -> String:
	var overlay:=Control.new()
	overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var back:=ColorRect.new()
	back.color=Color("0a101b")
	back.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	overlay.add_child(back)
	var box:=VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	box.grow_horizontal=Control.GROW_DIRECTION_BOTH
	box.grow_vertical=Control.GROW_DIRECTION_BOTH
	box.custom_minimum_size=Vector2(620,0)
	box.add_theme_constant_override("separation",18)
	overlay.add_child(box)
	var title:=Label.new()
	title.text="NICK POSTACI · "+str({"legend":"LEGENDA","planetary":"PLANETARNY","sage":"MĘDRZEC","android":"ANDROID"}.get(race,race))
	title.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	title.add_theme_font_size_override("font_size",30)
	box.add_child(title)
	var field:=LineEdit.new()
	field.placeholder_text="Wpisz nick (3–16 znaków)"
	field.max_length=16
	field.custom_minimum_size=Vector2(0,84)
	field.add_theme_font_size_override("font_size",26)
	box.add_child(field)
	var done:=[false,""]
	var ok:=Button.new()
	ok.text="UTWÓRZ POSTAĆ"
	ok.custom_minimum_size=Vector2(0,84)
	ok.add_theme_font_size_override("font_size",24)
	ok.pressed.connect(func()->void:
		if field.text.strip_edges().length()<3:
			title.text="NICK MUSI MIEĆ MIN. 3 ZNAKI"
			return
		done[1]=field.text.strip_edges();done[0]=true)
	box.add_child(ok)
	var cancel:=Button.new()
	cancel.text="WSTECZ"
	cancel.custom_minimum_size=Vector2(0,72)
	cancel.add_theme_font_size_override("font_size",22)
	cancel.pressed.connect(func()->void:done[0]=true)
	box.add_child(cancel)
	add_child(overlay)
	while not done[0]:await get_tree().process_frame
	overlay.queue_free()
	return str(done[1])

func notice(text: String) -> void:
	var note:=Label.new()
	note.text=text
	note.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART
	note.horizontal_alignment=HORIZONTAL_ALIGNMENT_CENTER
	note.add_theme_font_size_override("font_size",22)
	note.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
	note.offset_top=-140
	add_child(note)
	get_tree().create_timer(5.0).timeout.connect(note.queue_free)

func spawn_world(full: bool) -> void:
	full_mode=full
	if not ResourceLoader.exists(SCENE):
		caption.text="Brak paczki prototypu. Wymagana jest wersja aplikacji z podglądem izometrii."
		return
	var scene:=load(SCENE) as PackedScene
	if scene==null:return
	page.hide()
	preview=SubViewportContainer.new()
	preview.stretch=true
	preview.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(preview)
	var viewport:=SubViewport.new()
	viewport.world_2d=World2D.new()
	viewport.size=Vector2i(get_viewport_rect().size)
	preview.add_child(viewport)
	world=scene.instantiate()
	if full and char_id!="":
		var data:Dictionary=load("res://scripts/characters.gd").read(load("res://scripts/characters.gd").slot_path(char_id))
		world.start_race=str(data.get("race","legend"))
		world.start_land=str(data.get("land","pyra"))
		world.start_level=int(data.get("kit",{}).get("level",1))
		world.start_gold=int(data.get("gold",20))
		autosave.wait_time=20.0
		if autosave.get_parent()==null:
			autosave.timeout.connect(save_progress)
			add_child(autosave)
		autosave.start()
	viewport.add_child(world)
	if not full:
		close_button=Button.new()
		close_button.text="WRÓĆ · TRYB SERWISOWY"
		close_button.custom_minimum_size=Vector2(330,84)
		close_button.add_theme_font_size_override("font_size",20)
		close_button.pressed.connect(close_preview)
		add_child(close_button)
	layout_preview()

func layout_preview() -> void:
	if preview==null or close_button==null:return
	var safe:=Rect2(Vector2.ZERO,get_viewport_rect().size)
	if OS.get_name()=="Android":
		var screen:=DisplayServer.get_display_safe_area()
		if screen.has_area():safe=(get_tree().root.get_screen_transform().affine_inverse()*Rect2(screen)).intersection(safe)
	close_button.position=Vector2(safe.get_center().x-165,safe.position.y+16)

## Hero progress (level, gold, land) goes into its local slot every 20 s and on exit. Cloud upload and server authority are not wired yet.
func save_progress() -> void:
	if world==null or char_id=="" or not full_mode or world.get("rpg_hud")==null:return
	var Chars=load("res://scripts/characters.gd")
	var data:Dictionary=Chars.read(Chars.slot_path(char_id))
	if data.is_empty():return
	var hud:Object=world.rpg_hud
	data["kit"]=data.get("kit",{})
	data["kit"]["level"]=int(hud.hero_level)
	data["gold"]=int(hud.hero_gold)
	data["land"]=str(world.current_land)
	data["characterId"]=char_id
	Chars.write(Chars.slot_path(char_id),data)

func close_preview() -> void:
	autosave.stop()
	if full_mode:save_progress()
	if preview==null:return
	world.motion=Vector2.ZERO
	world.move_pointer=-1
	preview.queue_free()
	preview=null
	world=null
	if close_button!=null:close_button.queue_free()
	close_button=null
	full_mode=false
	page.show()

func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and event.keycode==KEY_ESCAPE and preview!=null:
		close_preview()
		get_viewport().set_input_as_handled()

func _notification(what: int) -> void:
	if what==NOTIFICATION_WM_GO_BACK_REQUEST:
		if preview!=null:close_preview()
		else:picked.emit("quit")
