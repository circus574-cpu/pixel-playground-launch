extends SceneTree
## Real HUD panel. Before view isolates old font/casing using archived font bytes.
var output := "/tmp/ki-polish-headings"
var checks: Array[Dictionary] = []
var failures: Array[String] = []

func _initialize() -> void: run.call_deferred()

func check(ok: bool, name: String) -> void:
	checks.append({"name":name,"pass":ok})
	if not ok:
		failures.append(name)
		push_error(name)

func settle() -> void:
	for i in 5: await process_frame

func shot(name: String) -> void:
	if DisplayServer.get_name()=="headless":return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(output.path_join(name+".jpg"),0.97)

func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):output=arg.substr(6)
	DirAccess.make_dir_recursive_absolute(output)
	root.size = Vector2i(1280,720)
	var background := ColorRect.new()
	background.color = Color("19242c")
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.add_child(background)
	var hud := PyraHud.new()
	root.add_child(hud)
	await settle()
	for child in hud.get_children():
		if child is CanvasItem and child!=hud.modal:child.hide()
	var title := "Bastion Złamanej Przysięgi (Cytadela Północy)"
	var body := "Pełny polski alfabet: Ą Ć Ę Ł Ń Ó Ś Ź Ż.\n\nZwykły tekst zachowuje małe litery: ą ć ę ł ń ó ś ź ż.\n\nNagłówek używa jednego fontu i prawdziwych wielkich liter."
	var old := FontFile.new()
	var before_path := ProjectSettings.globalize_path("res://").path_join("../../docs/zmiany/2026-11-17/qa/polish-headings/cinzel-before-latin-only.ttf").simplify_path()
	old.data = FileAccess.get_file_as_bytes(before_path)
	hud.show_dialog(title,body)
	var before: Label = hud.modal_box.get_child(0)
	before.add_theme_font_override("font",old)
	before.text = title
	await settle()
	await shot("before-font-and-case")
	for dimensions: Vector2i in [Vector2i(1280,720),Vector2i(852,393)]:
		root.size = dimensions
		hud.show_dialog(title,body)
		await settle()
		var heading: Label
		# show_dialog hides/frees old rows deferred; select the new visible title.
		for child in hud.modal_box.get_children():
			if child is Label and child.visible:heading=child;break
		check(heading.text=="BASTION ZŁAMANEJ PRZYSIĘGI (CYTADELA PÓŁNOCY)",str(dimensions)+" uppercase includes Ę/Ł/Ó")
		check(heading.get_line_count()>1,str(dimensions)+" long title wraps")
		check(root.get_visible_rect().encloses(heading.get_global_rect()),str(dimensions)+" title stays on screen")
		check(heading.get_theme_font("font")==hud.cinzel,str(dimensions)+" heading uses full Cinzel")
		await shot("after-"+str(dimensions.x)+"x"+str(dimensions.y))
	for c: String in "ĄĆĘŁŃÓŚŹŻąćęłńóśźż":
		check(hud.cinzel.get_supported_chars().contains(c),"Imported font contains "+c)
	check("Zażółć gęślą jaźń".to_upper()=="ZAŻÓŁĆ GĘŚLĄ JAŹŃ","Polish case conversion")
	var file := FileAccess.open(output.path_join("results.json"),FileAccess.WRITE)
	file.store_string(JSON.stringify({"renderer":DisplayServer.get_name(),"checks":checks,"failures":failures,"physicalPhoneTested":false,"beforeView":"Old font and mixed-case source title in the corrected layout, to isolate typography."},"\t"))
	print("POLISH HEADINGS ",checks.size()-failures.size(),"/",checks.size()," pass")
	hud.queue_free()
	background.queue_free()
	await settle()
	quit(0 if failures.is_empty() else 1)
