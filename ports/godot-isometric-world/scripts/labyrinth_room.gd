extends Control
## AAA Atmospheric Playable Dungeon Labyrinth Mode for KI Legends (8 unique biome-themed dungeons).
## Features real textured stone/moss/obsidian/ice/cyber floors, 3D-extruded y-sorted dungeon walls,
## real animated 3D Hero & Monster Guardian actors (IsoWorldActor), painted dungeon props (chests,
## flickering firepots/lanterns, barrels, crates, weapon racks), full CombatVFX, volumetric lighting,
## drifting biome atmosphere particles, dedicated dark dungeon soundtracks & premium creature SFX,
## fog-of-war exploration, crisp mobile-first HUD, and seamless exit portal back to the continent.

const MapStyle := preload("res://scripts/map_style.gd")
const ForgedUI := preload("res://scripts/forged_ui.gd")
const ActorScript := preload("res://scripts/actor_view.gd")
const CombatVfxScript := preload("res://scripts/combat_vfx.gd")

const TILE_PX := 124.0
const WALL_H := 42.0
const HERO_RADIUS := 24.0
const HERO_SPEED := 320.0

const THEME_PALETTES := {
	"pyra": {
		"bg": Color(0.045, 0.020, 0.016, 1.0),
		"wall_top": Color(0.32, 0.19, 0.15, 1.0),
		"wall_side": Color(0.18, 0.10, 0.08, 1.0),
		"wall_edge": Color(1.0, 0.46, 0.14, 0.92),
		"floor_tint": Color(0.76, 0.62, 0.56, 1.0),
		"accent": Color(1.0, 0.56, 0.18, 1.0),
		"torch": Color(1.0, 0.62, 0.22, 1.0),
		"particle": Color(1.0, 0.54, 0.16, 0.90),
	},
	"verdant": {
		"bg": Color(0.018, 0.036, 0.024, 1.0),
		"wall_top": Color(0.18, 0.30, 0.20, 1.0),
		"wall_side": Color(0.10, 0.19, 0.12, 1.0),
		"wall_edge": Color(0.38, 0.96, 0.56, 0.88),
		"floor_tint": Color(0.64, 0.78, 0.62, 1.0),
		"accent": Color(0.38, 0.98, 0.58, 1.0),
		"torch": Color(0.54, 1.0, 0.64, 1.0),
		"particle": Color(0.56, 1.0, 0.62, 0.88),
	},
	"aether": {
		"bg": Color(0.020, 0.036, 0.064, 1.0),
		"wall_top": Color(0.26, 0.36, 0.48, 1.0),
		"wall_side": Color(0.14, 0.22, 0.32, 1.0),
		"wall_edge": Color(0.48, 0.90, 1.0, 0.92),
		"floor_tint": Color(0.66, 0.78, 0.92, 1.0),
		"accent": Color(0.46, 0.94, 1.0, 1.0),
		"torch": Color(0.54, 0.88, 1.0, 1.0),
		"particle": Color(0.72, 0.95, 1.0, 0.88),
	},
	"nexus": {
		"bg": Color(0.016, 0.028, 0.046, 1.0),
		"wall_top": Color(0.19, 0.24, 0.32, 1.0),
		"wall_side": Color(0.10, 0.14, 0.20, 1.0),
		"wall_edge": Color(0.16, 0.96, 1.0, 0.94),
		"floor_tint": Color(0.58, 0.70, 0.80, 1.0),
		"accent": Color(0.18, 0.98, 1.0, 1.0),
		"torch": Color(0.24, 0.94, 1.0, 1.0),
		"particle": Color(0.28, 0.98, 1.0, 0.90),
	},
}

const GUARDIAN_POOLS := {
	"lab-pyra-caldera":  ["pyra-golem-ruin", "pyra-skalny-berserker", "pyra-ognista-salamandra"],
	"lab-pyra-dragon":   ["pyra-byk-areny", "pyra-plomien-duch", "pyra-skorpion-obsydianowy"],
	"lab-verdant-roots": ["verdant-straznik-ruin", "verdant-korzeniowy-pelzacz", "verdant-cierniowy-wilk"],
	"lab-verdant-lotus": ["verdant-lesny-pajak", "verdant-lisciak-skrytobojca", "verdant-mchowy-szlamak"],
	"lab-aether-glacier":["aether-lew-swiatyni", "aether-pergaminowy-straznik", "aether-szmaragdowy-waz"],
	"lab-aether-astro":  ["aether-duch-bibliotekarza", "aether-oko-wiedzy", "aether-marionetka-rytualu"],
	"lab-nexus-core":    ["nexus-straznik-rdzenia", "nexus-pies-lowca", "nexus-pajak-spawalniczy"],
	"lab-nexus-mechs":   ["nexus-wiezyczka-autonomiczna", "nexus-skaner-gasienicowy", "nexus-latarnia-plazmowa"],
}

static var _tex_cache: Dictionary = {}
static var _glow_tex: Texture2D = null
static var _vignette_tex: Texture2D = null

var world: Node2D
var current_land := "pyra"
var current_theme := "pyra"
var lab_data: Dictionary = {}
var grid_rows: Array[String] = []
var maze_w := 15
var maze_h := 15
var visited: Dictionary = {}
var hero_px := Vector2(186.0, 186.0)
var hero_facing := Vector2(0.0, 1.0)
var exit_px := Vector2(186.0, 186.0)
var chests: Array[Dictionary] = []
var guardians: Array[Dictionary] = []
var float_texts: Array[Dictionary] = []
var ground_drops: Array[Dictionary] = []
var braziers: Array[Dictionary] = []
var decor_props: Array[Dictionary] = []
var atmos_particles: Array[Dictionary] = []
var _visit_id := 0
var elapsed := 0.0
var atk_cd := 0.0
var dodge_invuln_t := 0.0
var step_audio_t := 0.0
var _step_alt := false
var _shake_t := 0.0
var _shake_amp := 0.0
var skill_rings: Array[Dictionary] = []
var nearest_chest: Dictionary = {}
var nearest_guard_idx := -1
var near_exit := false

# Layered real-world 2D dungeon scene nodes inside this Control
var world_root: Node2D
var floor_layer: Node2D
var ysort_layer: Node2D
var wall_nodes: Dictionary = {}
var chest_nodes: Array[Sprite2D] = []
var brazier_nodes: Array[Sprite2D] = []
var prop_nodes: Array[Sprite2D] = []
var hero_actor: Node2D = null
var light_layer: Node2D
var vfx_layer: Node2D
var hud_overlay: Control

var btn_exit := Button.new()
var btn_open_chest := Button.new()
var btn_attack := Button.new()
var btn_potion := Button.new()
var btn_dodge := Button.new()
var btn_ki_mode := Button.new()
var skill_btns: Array[Button] = []
var toast_lbl := Label.new()
var toast_timer := 0.0

var _floor_tex_a: Texture2D = null
var _floor_tex_b: Texture2D = null
var _wall_tex: Texture2D = null
var _chest_tex: Texture2D = null
var _brazier_tex: Texture2D = null
var _lantern_tex: Texture2D = null

static func _load_tex(path: String) -> Texture2D:
	if _tex_cache.has(path):
		return _tex_cache[path] as Texture2D
	if FileAccess.file_exists(path):
		var bytes := FileAccess.get_file_as_bytes(path)
		if not bytes.is_empty():
			var img := Image.new()
			var err := ERR_CANT_OPEN
			if path.ends_with(".webp"):
				err = img.load_webp_from_buffer(bytes)
			elif path.ends_with(".png"):
				err = img.load_png_from_buffer(bytes)
			elif path.ends_with(".jpg") or path.ends_with(".jpeg"):
				err = img.load_jpg_from_buffer(bytes)
			if err == OK:
				var tex := ImageTexture.create_from_image(img)
				_tex_cache[path] = tex
				return tex
	if ResourceLoader.exists(path):
		var loaded := load(path)
		if loaded is Texture2D:
			_tex_cache[path] = loaded
			return loaded as Texture2D
	return null

static func _ensure_procedural_textures() -> void:
	if _glow_tex == null:
		var sz := 96
		var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
		var half := float(sz) * 0.5
		for y in sz:
			for x in sz:
				var dx := (float(x) + 0.5 - half) / half
				var dy := (float(y) + 0.5 - half) / half
				var d := sqrt(dx * dx + dy * dy)
				var a := clampf(pow(maxf(0.0, 1.0 - d), 2.1), 0.0, 1.0)
				img.set_pixel(x, y, Color(1.0, 1.0, 1.0, a))
		_glow_tex = ImageTexture.create_from_image(img)
	if _vignette_tex == null:
		var w := 128
		var h := 72
		var img2 := Image.create(w, h, false, Image.FORMAT_RGBA8)
		for y in h:
			var ny := (float(y) + 0.5) / float(h) * 2.0 - 1.0
			for x in w:
				var nx := (float(x) + 0.5) / float(w) * 2.0 - 1.0
				var r := sqrt(nx * nx * 0.85 + ny * ny * 1.15)
				var a := clampf(pow(maxf(0.0, r - 0.52) / 0.88, 1.85) * 0.78, 0.0, 0.82)
				img2.set_pixel(x, y, Color(0.01, 0.01, 0.02, a))
		_vignette_tex = ImageTexture.create_from_image(img2)

func _ready() -> void:
	visible = false
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_preset(Control.PRESET_FULL_RECT)
	_ensure_procedural_textures()
	_build_scene_layers()
	_build_ui()
	resized.connect(_layout_ui)
	_layout_ui()

func _build_scene_layers() -> void:
	world_root = Node2D.new()
	world_root.z_index = 1
	add_child(world_root)

	floor_layer = Node2D.new()
	floor_layer.z_index = 1
	floor_layer.draw.connect(_draw_dungeon_floor)
	world_root.add_child(floor_layer)

	ysort_layer = Node2D.new()
	ysort_layer.y_sort_enabled = true
	ysort_layer.z_index = 5
	world_root.add_child(ysort_layer)

	vfx_layer = CombatVfxScript.new()
	vfx_layer.z_index = 18
	world_root.add_child(vfx_layer)

	light_layer = Node2D.new()
	light_layer.z_index = 26
	var add_mat := CanvasItemMaterial.new()
	add_mat.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	light_layer.material = add_mat
	light_layer.draw.connect(_draw_dungeon_lights)
	world_root.add_child(light_layer)

	hud_overlay = Control.new()
	hud_overlay.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_overlay.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud_overlay.z_index = 40
	hud_overlay.draw.connect(_draw_dungeon_hud)
	add_child(hud_overlay)

func _build_ui() -> void:
	btn_exit.text = "← WSTECZ"
	ForgedUI.style_button(btn_exit, "slate", 20, 24.0, 10.0)
	btn_exit.pressed.connect(func() -> void:
		if world != null and world.has_method("exit_labyrinth"):
			world.exit_labyrinth()
	)
	hud_overlay.add_child(btn_exit)

	btn_open_chest.text = "★ OTWÓRZ UKRYTY SKARB"
	ForgedUI.style_button(btn_open_chest, "gold", 21, 28.0, 12.0)
	btn_open_chest.visible = false
	btn_open_chest.pressed.connect(_try_open_nearest_chest)
	hud_overlay.add_child(btn_open_chest)

	btn_attack.text = "⚔ ATAK [Q]"
	ForgedUI.style_button(btn_attack, "crimson", 19, 18.0, 10.0)
	btn_attack.visible = true
	btn_attack.pressed.connect(perform_labyrinth_attack)
	hud_overlay.add_child(btn_attack)

	btn_potion.text = "🧪 ELIKSIR [H]"
	ForgedUI.style_button(btn_potion, "gold", 17, 14.0, 10.0)
	btn_potion.pressed.connect(_use_labyrinth_potion)
	hud_overlay.add_child(btn_potion)

	btn_dodge.text = "💨 UNIK [V]"
	ForgedUI.style_button(btn_dodge, "slate", 17, 12.0, 10.0)
	btn_dodge.pressed.connect(func() -> void:
		if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_dodge"):
			world.rpg_hud.trigger_dodge()
		else:
			perform_labyrinth_dodge(false)
	)
	hud_overlay.add_child(btn_dodge)

	btn_ki_mode.text = "✦ KI [R]"
	ForgedUI.style_button(btn_ki_mode, "gold", 17, 12.0, 10.0)
	btn_ki_mode.pressed.connect(func() -> void:
		if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
			world.rpg_hud.trigger_skill(5)
	)
	hud_overlay.add_child(btn_ki_mode)

	skill_btns.clear()
	for si in range(1, 5):
		var sb := Button.new()
		sb.text = "[%d]" % si
		ForgedUI.style_button(sb, "slate", 17, 10.0, 8.0)
		var cap_si := si
		sb.pressed.connect(func() -> void:
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
				world.rpg_hud.trigger_skill(cap_si)
		)
		hud_overlay.add_child(sb)
		skill_btns.append(sb)

	toast_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_lbl.add_theme_font_override("font", MapStyle.body_font())
	toast_lbl.add_theme_font_size_override("font_size", 22)
	toast_lbl.add_theme_color_override("font_color", Color(1.0, 0.94, 0.62))
	toast_lbl.add_theme_color_override("font_outline_color", Color(0.03, 0.02, 0.02, 0.98))
	toast_lbl.add_theme_constant_override("outline_size", 7)
	toast_lbl.visible = false
	hud_overlay.add_child(toast_lbl)

func _layout_ui() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = Vector2(1600.0, 720.0)
	btn_exit.position = Vector2(16.0, 14.0)
	btn_exit.size = Vector2(182.0, 54.0)
	var bw := clampf(vs.x * 0.36, 360.0, 500.0)
	btn_open_chest.size = Vector2(bw, 60.0)
	btn_open_chest.position = Vector2((vs.x - bw) * 0.5, vs.y - 166.0)

	# Responsive non-overlapping bottom combat bar (fits cleanly from 1280px to 2400px+)
	var compact := vs.x < 1420.0
	var pot_w := 184.0 if compact else 208.0
	var dod_w := 142.0 if compact else 156.0
	var atk_w := 188.0 if compact else 210.0
	var ki_w := 118.0 if compact else 132.0
	var sk_w := 112.0 if compact else 128.0
	var gap := 8.0 if compact else 10.0

	btn_potion.size = Vector2(pot_w, 58.0)
	btn_potion.position = Vector2(16.0, vs.y - 76.0)
	btn_dodge.size = Vector2(dod_w, 58.0)
	btn_dodge.position = Vector2(16.0 + pot_w + gap, vs.y - 76.0)

	var right_x := vs.x - 16.0
	btn_attack.size = Vector2(atk_w, 60.0)
	btn_attack.position = Vector2(right_x - atk_w, vs.y - 77.0)
	right_x -= atk_w + gap
	btn_ki_mode.size = Vector2(ki_w, 58.0)
	btn_ki_mode.position = Vector2(right_x - ki_w, vs.y - 76.0)
	right_x -= ki_w + gap
	for i in range(skill_btns.size() - 1, -1, -1):
		var sb := skill_btns[i]
		sb.size = Vector2(sk_w, 58.0)
		sb.position = Vector2(right_x - sk_w, vs.y - 76.0)
		right_x -= sk_w + gap
	toast_lbl.size = Vector2(vs.x - 120.0, 44.0)
	toast_lbl.position = Vector2(60.0, 92.0)

func _clear_world_nodes() -> void:
	for c in ysort_layer.get_children():
		c.queue_free()
	wall_nodes.clear()
	chest_nodes.clear()
	brazier_nodes.clear()
	prop_nodes.clear()
	hero_actor = null
	if vfx_layer != null:
		vfx_layer.effects.clear()

static func _safe_tex_region(tex: Texture2D, tx: int, ty: int, req_w: float, req_h: float) -> Rect2:
	var tw := float(tex.get_width())
	var th := float(tex.get_height())
	var rw := minf(req_w, tw)
	var rh := minf(req_h, th)
	var max_x := maxf(0.0, tw - rw)
	var max_y := maxf(0.0, th - rh)
	var rx := fmod(float(absi(tx * 97 + ty * 37)), maxf(1.0, max_x)) if max_x > 1.0 else 0.0
	var ry := fmod(float(absi(ty * 89 + tx * 53)), maxf(1.0, max_y)) if max_y > 1.0 else 0.0
	return Rect2(rx, ry, rw, rh)

func _load_theme_assets(theme: String) -> void:
	var tk := theme if theme in ["pyra", "verdant", "aether", "nexus"] else "pyra"
	current_theme = tk
	_floor_tex_a = _load_tex("res://regions/%s/mat_0.png" % tk)
	var fb_cand := _load_tex("res://regions/%s/mat_1.png" % tk)
	# Only use mat_1 for square floor tiles if it's a square-ish material (>= 300px tall), else use mat_0
	_floor_tex_b = fb_cand if (fb_cand != null and fb_cand.get_height() >= 300) else _floor_tex_a
	# Always use mat_3.png (512x512 rich rock/masonry on all 4 continents) so walls NEVER stretch vertically!
	_wall_tex = _load_tex("res://regions/%s/mat_3.png" % tk)
	if _wall_tex == null:
		_wall_tex = _load_tex("res://regions/%s/mat_0.png" % tk)
	_chest_tex = _load_tex("res://assets/interiors/%s/chest.webp" % tk)
	_brazier_tex = _load_tex("res://assets/interiors/%s/firepot.webp" % tk)
	_lantern_tex = _load_tex("res://assets/interiors/%s/lanterns.webp" % tk)

func _spawn_dungeon_hero() -> void:
	if world == null:
		return
	var actors_db: Dictionary = world.actors_db
	var use_gm := bool(world.get("gm_form_active")) and world.has_method("can_use_gm") and bool(world.can_use_gm()) and actors_db.has("gm.hero")
	var race_land: String = str(world.get("hero_race_land"))
	var hero_key := "gm.hero" if use_gm else (race_land + ".hero")
	if not actors_db.has(hero_key):
		hero_key = current_theme + ".hero"
	if not actors_db.has(hero_key):
		hero_key = "pyra.hero"
	if not actors_db.has(hero_key):
		return
	hero_actor = ActorScript.new()
	var nm := str(world.get("start_name"))
	if use_gm:
		nm = "✦ [GM] " + nm
	hero_actor.setup(actors_db[hero_key], nm, false, true, "hero")
	hero_actor.scale = Vector2(0.76, 0.76) if use_gm else Vector2(0.92, 0.92)
	if world.has_method("_hero_race_key"):
		hero_actor.ki_race = str(world._hero_race_key())
	if float(world.get("ki_mode_timer")) > 0.05:
		hero_actor.set_ki_mode(true, float(world.get("ki_mode_timer")))
	hero_actor.position = hero_px
	ysort_layer.add_child(hero_actor)

func _pick_guardian_actor_id(lab_id: String, idx: int) -> String:
	var pool: Array = GUARDIAN_POOLS.get(lab_id, [])
	if pool.is_empty():
		var fallback := {
			"pyra": ["pyra-golem-ruin", "pyra-byk-areny", "pyra-skalny-berserker"],
			"verdant": ["verdant-straznik-ruin", "verdant-cierniowy-wilk", "verdant-lesny-pajak"],
			"aether": ["aether-lew-swiatyni", "aether-duch-bibliotekarza", "aether-szmaragdowy-waz"],
			"nexus": ["nexus-straznik-rdzenia", "nexus-pies-lowca", "nexus-pajak-spawalniczy"],
		}
		pool = fallback.get(current_theme, fallback["pyra"])
	return str(pool[idx % pool.size()])

func _spawn_dungeon_wall_node(tx: int, ty: int) -> void:
	var wnode := Node2D.new()
	var pos := Vector2(float(tx) * TILE_PX, (float(ty) + 1.0) * TILE_PX)
	wnode.position = pos
	wnode.visible = false
	var pal: Dictionary = THEME_PALETTES.get(current_theme, THEME_PALETTES["pyra"])
	var wall_top: Color = pal["wall_top"]
	var wall_side: Color = pal["wall_side"]
	var wall_edge: Color = pal["wall_edge"]
	var accent: Color = pal["accent"]
	var wall_tex_ref := _wall_tex
	var has_floor_below := not _is_wall(tx, ty + 1)
	var has_floor_above := not _is_wall(tx, ty - 1)
	var has_floor_left := not _is_wall(tx - 1, ty)
	var has_floor_right := not _is_wall(tx + 1, ty)
	var seed_h := int((tx * 73 + ty * 197) % 100)
	wnode.draw.connect(func() -> void:
		# Drawn strictly within tile footprint [-TILE_PX .. 0] so walls NEVER cover north corridors or sprites!
		var cap_h := (TILE_PX - WALL_H) if has_floor_below else TILE_PX
		var top_rect := Rect2(0.0, -TILE_PX, TILE_PX, cap_h)
		var front_rect := Rect2(0.0, -WALL_H, TILE_PX, WALL_H)
		# Textured seamless dungeon masonry cap
		if wall_tex_ref != null:
			var top_src := _safe_tex_region(wall_tex_ref, tx, ty, 240.0, 240.0)
			wnode.draw_texture_rect_region(wall_tex_ref, top_rect, top_src, wall_top.lightened(0.42))
		else:
			wnode.draw_rect(top_rect, wall_top, true)
		# Subtle dark stone shadow near edges facing open corridors (merges adjacent wall tiles seamlessly!)
		if has_floor_above:
			wnode.draw_line(Vector2(0.0, -TILE_PX + 1.5), Vector2(TILE_PX, -TILE_PX + 1.5), Color(wall_edge.r, wall_edge.g, wall_edge.b, 0.26), 2.0)
		if has_floor_left:
			wnode.draw_line(Vector2(1.5, -TILE_PX), Vector2(1.5, 0.0), Color(wall_edge.r, wall_edge.g, wall_edge.b, 0.22), 2.0)
		if has_floor_right:
			wnode.draw_line(Vector2(TILE_PX - 1.5, -TILE_PX), Vector2(TILE_PX - 1.5, 0.0), Color(wall_edge.r, wall_edge.g, wall_edge.b, 0.22), 2.0)
		# Deep extruded vertical stone-block front cliff face (only where wall faces open corridor below!)
		if has_floor_below:
			if wall_tex_ref != null:
				var front_src := _safe_tex_region(wall_tex_ref, tx + 7, ty + 11, 240.0, 128.0)
				wnode.draw_texture_rect_region(wall_tex_ref, front_rect, front_src, wall_side.lightened(0.55))
			else:
				wnode.draw_rect(front_rect, wall_side, true)
			# Carved masonry brick courses & mortar shadows
			wnode.draw_line(Vector2(0.0, -WALL_H * 0.5), Vector2(TILE_PX, -WALL_H * 0.5), Color(0.02, 0.02, 0.03, 0.62), 2.2)
			wnode.draw_line(Vector2(TILE_PX * 0.5, -WALL_H), Vector2(TILE_PX * 0.5, -WALL_H * 0.5), Color(0.02, 0.02, 0.03, 0.50), 2.0)
			wnode.draw_line(Vector2(TILE_PX * 0.25, -WALL_H * 0.5), Vector2(TILE_PX * 0.25, 0.0), Color(0.02, 0.02, 0.03, 0.50), 2.0)
			wnode.draw_line(Vector2(TILE_PX * 0.75, -WALL_H * 0.5), Vector2(TILE_PX * 0.75, 0.0), Color(0.02, 0.02, 0.03, 0.50), 2.0)
			# Glowing carved rune vein / ember fissure / bioluminescent root crack
			if seed_h < 38:
				var rx := TILE_PX * (0.26 + float(seed_h % 5) * 0.12)
				wnode.draw_line(Vector2(rx, -WALL_H + 6.0), Vector2(rx + 9.0, -WALL_H * 0.46), Color(accent.r, accent.g, accent.b, 0.85), 2.6, true)
				wnode.draw_line(Vector2(rx + 9.0, -WALL_H * 0.46), Vector2(rx - 5.0, -5.0), Color(accent.r, accent.g, accent.b, 0.68), 2.0, true)
			# Illuminated top coping rim + soft contact AO shadow on corridor floor
			wnode.draw_line(Vector2(0.0, -WALL_H), Vector2(TILE_PX, -WALL_H), Color(wall_edge.r, wall_edge.g, wall_edge.b, 0.52), 2.4)
			wnode.draw_rect(Rect2(0.0, 0.0, TILE_PX, 20.0), Color(0.01, 0.01, 0.02, 0.46), true)
	)
	ysort_layer.add_child(wnode)
	wall_nodes["%d,%d" % [tx, ty]] = wnode

static func _has_clean_alpha_cutout(tex: Texture2D) -> bool:
	if tex == null:
		return false
	var img := tex.get_image()
	if img == null or img.get_width() < 24 or img.get_height() < 24:
		return false
	var w := img.get_width()
	var h := img.get_height()
	var transparent_corners := 0
	for pt: Vector2i in [Vector2i(8, 8), Vector2i(w - 9, 8), Vector2i(8, h - 9), Vector2i(w - 9, h - 9)]:
		if img.get_pixelv(pt).a < 0.25:
			transparent_corners += 1
	return transparent_corners >= 2

func _populate_dungeon_props() -> void:
	braziers.clear()
	decor_props.clear()
	var prop_files := ["weapons.webp", "potions.webp", "table.webp"]
	var chest_tiles: Dictionary = {}
	for c: Dictionary in chests:
		chest_tiles["%d,%d" % [int(c.get("tx", 1)), int(c.get("ty", 1))]] = true
	var spawn_tx := int(floor(exit_px.x / TILE_PX))
	var spawn_ty := int(floor(exit_px.y / TILE_PX))

	for ty in range(1, maze_h - 1):
		for tx in range(1, maze_w - 1):
			if _is_wall(tx, ty):
				continue
			var key := "%d,%d" % [tx, ty]
			if chest_tiles.has(key):
				continue
			var open_n := 0
			for d: Vector2i in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				if not _is_wall(tx + d.x, ty + d.y):
					open_n += 1
			var h := (tx * 37 + ty * 91) % 100
			# Place glowing braziers near spawn, intersections, and every ~3rd corridor turn
			var near_spawn := (absi(tx - spawn_tx) + absi(ty - spawn_ty) == 1)
			if (near_spawn or (open_n >= 3 and h < 65) or (open_n == 2 and h < 22)) and _is_wall(tx, ty - 1):
				var bpos := Vector2((float(tx) + 0.22) * TILE_PX, (float(ty) + 0.14) * TILE_PX)
				braziers.append({"tx": tx, "ty": ty, "pos": bpos, "phase": float(h) * 0.13})
				var tex := _brazier_tex if (h % 2 == 0 or _lantern_tex == null) else _lantern_tex
				if tex != null:
					var sp := Sprite2D.new()
					sp.texture = tex
					var sc := 56.0 / maxf(float(tex.get_width()), 1.0)
					sp.scale = Vector2(sc, sc)
					sp.position = bpos
					sp.offset = Vector2(0.0, -float(tex.get_height()) * 0.34)
					sp.visible = false
					ysort_layer.add_child(sp)
					brazier_nodes.append(sp)
					braziers[-1]["node"] = sp
			elif open_n <= 2 and h >= 72 and _is_wall(tx, ty - 1) and not near_spawn:
				var pf: String = str(prop_files[h % prop_files.size()])
				var ptex := _load_tex("res://assets/interiors/%s/%s" % [current_theme, pf])
				if ptex != null and _has_clean_alpha_cutout(ptex):
					var ppos := Vector2((float(tx) + 0.78) * TILE_PX, (float(ty) + 0.16) * TILE_PX)
					var sp2 := Sprite2D.new()
					sp2.texture = ptex
					var sc2 := 54.0 / maxf(float(ptex.get_width()), 1.0)
					sp2.scale = Vector2(sc2, sc2)
					sp2.position = ppos
					sp2.offset = Vector2(0.0, -float(ptex.get_height()) * 0.34)
					sp2.modulate = Color(0.84, 0.84, 0.88, 0.96)
					sp2.visible = false
					ysort_layer.add_child(sp2)
					prop_nodes.append(sp2)
					decor_props.append({"tx": tx, "ty": ty, "node": sp2})

func _init_atmos_particles() -> void:
	atmos_particles.clear()
	for i in 56:
		atmos_particles.append({
			"x": randf_range(-900.0, 900.0),
			"y": randf_range(-520.0, 520.0),
			"vx": randf_range(-14.0, 14.0),
			"vy": randf_range(-28.0, -8.0) if current_theme == "pyra" else randf_range(-16.0, 10.0),
			"sz": randf_range(2.0, 4.6),
			"ph": randf_range(0.0, TAU),
		})

func enter_labyrinth(land: String, data: Dictionary) -> void:
	_visit_id += 1
	_clear_world_nodes()
	ground_drops.clear()
	skill_rings.clear()
	dodge_invuln_t = 0.0
	_shake_t = 0.0
	_shake_amp = 0.0
	current_land = land
	lab_data = data.duplicate(true)
	var theme := str(data.get("theme", land))
	_load_theme_assets(theme)

	grid_rows.clear()
	for row in data.get("grid", []):
		grid_rows.append(str(row))
	maze_h = grid_rows.size()
	maze_w = grid_rows[0].length() if maze_h > 0 else 15
	var sp: Array = data.get("spawn", [1, 1])
	hero_px = Vector2((float(sp[0]) + 0.5) * TILE_PX, (float(sp[1]) + 0.5) * TILE_PX)
	exit_px = hero_px
	visited.clear()
	float_texts.clear()
	elapsed = 0.0
	atk_cd = 0.0

	# Build 3D extruded wall nodes for y-sorting
	for ty in maze_h:
		for tx in maze_w:
			if _is_wall(tx, ty):
				_spawn_dungeon_wall_node(tx, ty)

	# Build real painted treasure chest sprites
	chests.clear()
	for c: Dictionary in data.get("chests", []):
		var cc := c.duplicate(true)
		var cpos := Vector2((float(c.get("tx", 1)) + 0.5) * TILE_PX, (float(c.get("ty", 1)) + 0.52) * TILE_PX)
		cc["px"] = cpos
		if _chest_tex != null:
			var csp := Sprite2D.new()
			csp.texture = _chest_tex
			var csc := 78.0 / maxf(float(_chest_tex.get_width()), 1.0)
			csp.scale = Vector2(csc, csc)
			csp.position = cpos
			csp.offset = Vector2(0.0, -float(_chest_tex.get_height()) * 0.28)
			csp.visible = false
			ysort_layer.add_child(csp)
			cc["node"] = csp
			chest_nodes.append(csp)
		chests.append(cc)

	_populate_dungeon_props()
	_spawn_dungeon_hero()

	# Spawn REAL animated monster guardians (IsoWorldActor) from monsters_db!
	guardians.clear()
	var lab_id := str(data.get("id", ""))
	var monsters_db: Dictionary = world.monsters_db if (world != null and "monsters_db" in world) else {}
	var raw_gs: Array = data.get("guardians", [])
	for gi in raw_gs.size():
		var g: Dictionary = raw_gs[gi]
		var gc := g.duplicate(true)
		var gpos := Vector2((float(g.get("tx", 5)) + 0.5) * TILE_PX, (float(g.get("ty", 5)) + 0.5) * TILE_PX)
		var aid := _pick_guardian_actor_id(lab_id, gi)
		if not monsters_db.has(aid):
			aid = str(g.get("actor_id", aid))
		gc["actor_id"] = aid
		gc["home"] = gpos
		gc["px"] = gpos
		gc["max_hp"] = int(g.get("hp", 800))
		gc["cur_hp"] = int(g.get("hp", 800))
		gc["atk"] = int(g.get("atk", 90))
		gc["atk_cd"] = 0.0
		gc["dmg_dealt_to_hero"] = 0
		gc["alive"] = true
		gc["roared"] = false
		gc["hit_flash"] = 0.0
		gc["stun_t"] = 0.0
		gc["burn_t"] = 0.0
		gc["burn_dps"] = 0.0
		gc["burn_acc"] = 0.0
		gc["slow_t"] = 0.0
		if monsters_db.has(aid):
			var m_entry: Dictionary = monsters_db[aid] as Dictionary
			var m_actor_def: Dictionary = m_entry.get("actor", m_entry) as Dictionary
			if not m_actor_def.is_empty() and m_actor_def.has("clips"):
				var mnode: Node2D = ActorScript.new()
				mnode.setup(m_actor_def, str(g.get("name", "Strażnik")), false, false, "monster", int(g.get("level", 6)), "", "", true)
				mnode.scale = Vector2(0.96, 0.96)
				mnode.position = gpos
				mnode.visible = false
				ysort_layer.add_child(mnode)
				gc["node"] = mnode
		guardians.append(gc)

	_init_atmos_particles()
	_reveal_around_hero()
	if world != null and world.audio != null:
		if world.audio.has_method("play_dungeon_music"):
			world.audio.play_dungeon_music(current_theme)
		if world.audio.has_method("play_dungeon_sfx"):
			world.audio.play_dungeon_sfx("portal_enter", 0.90)
	_show_toast("⚔ Wchodzisz do: %s • Pokonaj strażników i odnajdź %d ukryte skarby!" % [str(data.get("title", "Labirynt")), chests.size()])
	_layout_ui()
	_sync_world_camera()
	visible = true
	_redraw_all()

func on_exit_labyrinth() -> void:
	visible = false
	if world != null and world.audio != null:
		var land_theme: String = world.get_theme_land(world.current_land) if world.has_method("get_theme_land") else current_land
		world.audio.play_music(land_theme)
		if world.audio.has_method("play_dungeon_sfx"):
			world.audio.play_dungeon_sfx("portal_enter", 0.72)

func _trigger_shake(amp: float, dur: float) -> void:
	_shake_amp = maxf(_shake_amp, amp)
	_shake_t = maxf(_shake_t, dur)

func _is_wall(tx: int, ty: int) -> bool:
	if tx < 0 or ty < 0 or ty >= maze_h or tx >= maze_w:
		return true
	return grid_rows[ty].unicode_at(tx) == 35 # '#'

func _can_stand(p: Vector2) -> bool:
	var offs := [
		Vector2(-HERO_RADIUS, -HERO_RADIUS),
		Vector2(HERO_RADIUS, -HERO_RADIUS),
		Vector2(-HERO_RADIUS, HERO_RADIUS),
		Vector2(HERO_RADIUS, HERO_RADIUS),
	]
	for o: Vector2 in offs:
		var q := p + o
		var tx := int(floor(q.x / TILE_PX))
		var ty := int(floor(q.y / TILE_PX))
		if _is_wall(tx, ty):
			return false
	return true

func _reveal_around_hero() -> void:
	var htx := int(floor(hero_px.x / TILE_PX))
	var hty := int(floor(hero_px.y / TILE_PX))
	for dy in range(-4, 5):
		for dx in range(-4, 5):
			if dx * dx + dy * dy <= 18:
				var nx := htx + dx
				var ny := hty + dy
				if nx >= 0 and ny >= 0 and nx < maze_w and ny < maze_h:
					var k := "%d,%d" % [nx, ny]
					if not visited.has(k):
						visited[k] = true
						if wall_nodes.has(k):
							var wn: Node2D = wall_nodes[k]
							if is_instance_valid(wn):
								wn.visible = true
	for c: Dictionary in chests:
		var ck := "%d,%d" % [int(c.get("tx", 1)), int(c.get("ty", 1))]
		var cn = c.get("node", null)
		if is_instance_valid(cn):
			cn.visible = visited.has(ck)
			cn.modulate = Color(0.45, 0.42, 0.40, 0.72) if _is_chest_opened(str(c.get("id", ""))) else Color.WHITE
	for b: Dictionary in braziers:
		var bk := "%d,%d" % [int(b["tx"]), int(b["ty"])]
		var bn = b.get("node", null)
		if is_instance_valid(bn):
			bn.visible = visited.has(bk)
	for pr: Dictionary in decor_props:
		var pk := "%d,%d" % [int(pr["tx"]), int(pr["ty"])]
		var pn = pr.get("node", null)
		if is_instance_valid(pn):
			pn.visible = visited.has(pk)

func _show_toast(msg: String) -> void:
	toast_lbl.text = msg
	toast_lbl.visible = true
	toast_timer = 4.2

func _is_chest_opened(cid: String) -> bool:
	if world != null and world.has_method("is_treasure_opened"):
		return bool(world.is_treasure_opened(cid))
	return false

func _try_open_nearest_chest() -> void:
	if nearest_chest.is_empty():
		return
	var cid := str(nearest_chest.get("id", ""))
	if _is_chest_opened(cid):
		return
	var cpos: Vector2 = nearest_chest["px"]
	for g: Dictionary in guardians:
		if bool(g.get("alive", false)) and (g["px"] as Vector2).distance_to(cpos) < 175.0:
			_show_toast("⚔ Strażnik (%s) broni tej komnaty! Pokonaj go, aby otworzyć skrzynię." % str(g.get("name", "Strażnik")))
			return
	var lab_id := str(lab_data.get("id", ""))
	if world != null and world.audio != null and world.audio.has_method("play_dungeon_sfx"):
		world.audio.play_dungeon_sfx("chest_open", 0.96)
	if vfx_layer != null and vfx_layer.has_method("spawn_ki_burst"):
		vfx_layer.spawn_ki_burst(cpos, "gm", 145.0)
	if world != null and world.is_server_authoritative():
		var visit := _visit_id
		world.claim_treasure_reward(nearest_chest, lab_id, func(notice: String) -> void:
			if visible and visit == _visit_id:
				_show_toast(notice)
				_reveal_around_hero()
		)
		return
	var claimed := true
	if world != null and world.has_method("claim_treasure_reward"):
		claimed = bool(world.claim_treasure_reward(nearest_chest, lab_id))
	if not claimed:
		return
	var msg := "★ SKARB: %s (+%d zł, +%d PD)" % [
		str(nearest_chest.get("title", "Skrzynia")),
		int(nearest_chest.get("gold", 150)),
		int(nearest_chest.get("xp", 95)),
	]
	_show_toast(msg)
	float_texts.append({
		"pos": nearest_chest["px"] as Vector2,
		"txt": "+%d zł  +%d PD" % [int(nearest_chest.get("gold", 150)), int(nearest_chest.get("xp", 95))],
		"col": Color(1.0, 0.90, 0.36),
		"t": 1.6,
	})
	_reveal_around_hero()
	_redraw_all()

func _count_hp_potions() -> int:
	return world.rpg_hud.hp_potion_count() if world != null and world.rpg_hud != null else 0

func _use_labyrinth_potion() -> void:
	if world == null or world.rpg_hud == null:
		return
	var hud = world.rpg_hud
	if hud.hero_hp >= hud.hero_max_hp - 0.5:
		_show_toast("Masz już pełne zdrowie (%d/%d HP)." % [int(round(hud.hero_hp)), int(round(hud.hero_max_hp))])
		return
	var found: bool = hud.use_quick_hp_potion(func(ok: bool, item_name: String, restored: float, notice: String) -> void:
		if not visible:
			return
		if not ok:
			_show_toast(notice)
			return
		var heal_amt := int(round(restored))
		if world.audio != null:
			world.audio.sfx("common/potion", 0.90)
		if vfx_layer != null and vfx_layer.has_method("spawn_ki_burst"):
			vfx_layer.spawn_ki_burst(hero_px, "planetary", 110.0)
		float_texts.append({
			"pos": hero_px + Vector2(-16, -54),
			"txt": "+%d HP" % heal_amt,
			"col": Color(0.42, 1.0, 0.58),
			"t": 1.15,
		})
		_show_toast("🧪 Użyto: %s (+%d HP)" % [item_name, heal_amt])
		_redraw_all()
	)
	if not found:
		_show_toast("Brak mikstur HP w plecaku! Kup zapas u Kupca w stolicy.")

func perform_labyrinth_dodge(is_planetary_a1: bool = false) -> void:
	dodge_invuln_t = 0.42 if is_planetary_a1 else 0.35
	var d := hero_facing.normalized()
	if d.length_squared() < 0.01:
		d = Vector2(0.0, 1.0)
	for _s in 7:
		var cand := hero_px + d * 15.0
		if _can_stand(cand):
			hero_px = cand
		else:
			break
	if hero_actor != null and hero_actor.has_method("play_action"):
		hero_actor.play_action("dodge", "walk")
	if world != null and world.audio != null:
		world.audio.sfx("common/dodge", 0.85)
	_reveal_around_hero()
	skill_rings.append({"pos": hero_px, "r": 22.0, "max_r": 96.0, "col": Color(0.42, 0.98, 0.72), "t": 0.36, "dur": 0.36})
	float_texts.append({"pos": hero_px + Vector2(-18, -54), "txt": "UNIK!", "col": Color(0.46, 0.98, 0.72), "t": 0.85})
	_redraw_all()

func _damage_guardian(gi: int, dmg: int, is_crit: bool, kill_heal_pct: float, apply_burn: float = 0.0, apply_stun: float = 0.0, apply_slow: float = 0.0) -> void:
	if gi < 0 or gi >= guardians.size():
		return
	var g: Dictionary = guardians[gi]
	if not bool(g.get("alive", false)):
		return
	var final_dmg := maxi(6, dmg)
	g["cur_hp"] = maxi(0, int(g["cur_hp"]) - final_dmg)
	g["hit_flash"] = 0.22
	var gnode = g.get("node", null)
	if is_instance_valid(gnode):
		gnode.hp_ratio = clampf(float(g["cur_hp"]) / maxf(float(g["max_hp"]), 1.0), 0.0, 1.0)
		gnode.play_action("hit", "idle")
		gnode.queue_redraw()
	if world != null and world.audio != null:
		world.audio.sfx("common/hit-crit" if is_crit else "common/hit", 0.86)
	if is_crit:
		_trigger_shake(7.5, 0.18)
	if apply_burn > 0.0:
		g["burn_t"] = maxf(float(g.get("burn_t", 0.0)), apply_burn)
		g["burn_dps"] = maxf(float(g.get("burn_dps", 0.0)), maxf(10.0, float(final_dmg) * 0.22))
	if apply_stun > 0.0:
		g["stun_t"] = maxf(float(g.get("stun_t", 0.0)), apply_stun)
	if apply_slow > 0.0:
		g["slow_t"] = maxf(float(g.get("slow_t", 0.0)), apply_slow)
	float_texts.append({
		"pos": (g["px"] as Vector2) + Vector2(0, -68),
		"txt": ("KRYT! -%d" % final_dmg) if is_crit else ("-%d" % final_dmg),
		"col": Color(1.0, 0.88, 0.24) if is_crit else Color(1.0, 0.44, 0.30),
		"t": 1.15 if is_crit else 0.98,
	})
	if int(g["cur_hp"]) <= 0:
		g["alive"] = false
		if is_instance_valid(gnode):
			gnode.play_action("death", "hit", 0.75)
			gnode.modulate = Color(0.55, 0.50, 0.50, 0.55)
		if world != null and world.audio != null:
			world.audio.play_monster_sfx(str(g.get("actor_id", "")), "die")
		if vfx_layer != null and vfx_layer.has_method("spawn_ki_burst"):
			vfx_layer.spawn_ki_burst(g["px"] as Vector2, "legend", 130.0)
		_trigger_shake(9.0, 0.24)
		var hp_cost := int(g.get("dmg_dealt_to_hero", 0))
		g["dmg_dealt_to_hero"] = 0
		if kill_heal_pct > 0.0 and world != null and world.rpg_hud != null:
			world.rpg_hud.hero_hp = minf(world.rpg_hud.hero_max_hp, world.rpg_hud.hero_hp + world.rpg_hud.hero_max_hp * kill_heal_pct)
		if world != null and world.is_server_authoritative():
			_report_guardian_defeat(g, hp_cost)
		else:
			if world != null:
				world.report_monster_kill(str(g["id"]), int(g.get("level", 6)), str(g.get("name", "Strażnik")), hp_cost)
			_show_toast("⚔ Pokonano: %s!" % str(g.get("name", "Strażnik")))

func perform_labyrinth_attack() -> void:
	if atk_cd > 0.05:
		return
	var race_k: String = world._hero_race_key() if (world != null and world.has_method("_hero_race_key")) else "legend"
	var is_gm := hero_actor != null and bool(hero_actor.is_gm_avatar)
	if hero_actor != null and hero_actor.has_method("play_action"):
		hero_actor.play_action("heavy_strike" if is_gm else "attack", "attack")
	if world != null and world.audio != null:
		if is_gm:
			world.audio.play_gm_sfx("gm_heavy_strike", 0.92, 0.04)
		else:
			world.audio.play_race_skill(race_k, "R")
	var aim := hero_facing.normalized()
	if nearest_guard_idx >= 0 and nearest_guard_idx < guardians.size() and bool(guardians[nearest_guard_idx].get("alive", false)):
		aim = ((guardians[nearest_guard_idx]["px"] as Vector2) - hero_px).normalized()
		hero_facing = aim
		if hero_actor != null:
			hero_actor.face(aim)
	if vfx_layer != null:
		if is_gm and vfx_layer.has_method("spawn_gm_heavy_strike"):
			vfx_layer.spawn_gm_heavy_strike(hero_px, aim)
		elif vfx_layer.has_method("spawn_slash"):
			vfx_layer.spawn_slash(hero_px, aim, race_k, 1.15, false)
	if nearest_guard_idx < 0 or nearest_guard_idx >= guardians.size():
		atk_cd = 0.42
		return
	var g: Dictionary = guardians[nearest_guard_idx]
	if not bool(g.get("alive", false)):
		return
	var base_atk := 32
	var hero_lv := 1
	var crit_pct := 6.0
	var dmg_mult := 1.0
	var kill_heal_pct := 0.0
	atk_cd = 0.55
	if world != null and world.rpg_hud != null:
		hero_lv = int(world.rpg_hud.hero_level)
		if world.rpg_hud.has_method("get_total_attack"):
			base_atk = int(world.rpg_hud.get_total_attack())
		if world.rpg_hud.has_method("get_total_crit"):
			crit_pct = float(world.rpg_hud.get_total_crit())
		if world.rpg_hud.has_method("get_basic_attack_interval"):
			atk_cd = float(world.rpg_hud.get_basic_attack_interval())
		if world.rpg_hud.has_method("get_talent_passives"):
			var passives: Dictionary = world.rpg_hud.get_talent_passives()
			dmg_mult += float(passives.get("dmgMult", 0.0))
			kill_heal_pct = float(passives.get("killHealPct", 0.0))
	if world != null and float(world.get("ki_mode_timer")) > 0.0:
		dmg_mult *= 1.25
	var g_lvl := int(g.get("level", 6))
	var lv_penalty := 0.65 if (g_lvl - hero_lv >= 3) else 1.0
	var is_crit := randf() * 100.0 < crit_pct
	var crit_mult := 1.60 if is_crit else 1.0
	var dmg := maxi(10, int(round(float(base_atk) * dmg_mult * lv_penalty * crit_mult * randf_range(0.95, 1.26))))
	skill_rings.append({"pos": g["px"] as Vector2, "r": 16.0, "max_r": 72.0, "col": Color(1.0, 0.72, 0.34), "t": 0.24, "dur": 0.24})
	_damage_guardian(nearest_guard_idx, dmg, is_crit, kill_heal_pct)
	_redraw_all()

func perform_labyrinth_skill(skill_idx: int, node_id: String = "") -> void:
	if skill_idx == 0:
		perform_labyrinth_attack()
		return
	var hud = world.rpg_hud if world != null else null
	var race_k: String = world._hero_race_key() if (world != null and world.has_method("_hero_race_key")) else "legend"
	var nid: String = node_id if not node_id.is_empty() else (str(hud.get_hotbar_node(skill_idx)) if (hud != null and hud.has_method("get_hotbar_node")) else "A1")
	var spec: Dictionary = hud.get_skill_spec(nid) if (hud != null and hud.has_method("get_skill_spec")) else {"mult": 1.75, "radius": 240.0}
	var passives: Dictionary = hud.get_talent_passives() if (hud != null and hud.has_method("get_talent_passives")) else {}
	var base_atk := int(hud.get_total_attack()) if (hud != null and hud.has_method("get_total_attack")) else 36
	var hero_lv := int(hud.hero_level) if hud != null else 1
	var crit_pct := float(hud.get_total_crit()) if (hud != null and hud.has_method("get_total_crit")) else 8.0
	var dmg_scale := 1.0 + float(passives.get("dmgMult", 0.0))
	var kill_heal_pct := float(passives.get("killHealPct", 0.0))
	var shield_mult := float(passives.get("shieldMult", 1.0))
	var is_gm := hero_actor != null and bool(hero_actor.is_gm_avatar)

	if nid == "T" or skill_idx == 5:
		if world != null and world.has_method("_activate_ki_mode_visuals"):
			world._activate_ki_mode_visuals(race_k, 20.0)
		if hero_actor != null:
			hero_actor.set_ki_mode(true, 20.0)
		if vfx_layer != null and vfx_layer.has_method("spawn_transform_pillar"):
			vfx_layer.spawn_transform_pillar(hero_px, "gm" if is_gm else race_k)
		if world != null and world.audio != null:
			world.audio.play_transform_sfx(race_k)
		_trigger_shake(10.0, 0.35)
		skill_rings.append({"pos": hero_px, "r": 28.0, "max_r": 260.0, "col": Color(0.36, 0.96, 1.0), "t": 0.55, "dur": 0.55})
		float_texts.append({"pos": hero_px + Vector2(-36, -64), "txt": "✦ FORMA KI!", "col": Color(0.42, 0.98, 1.0), "t": 1.25})
		for gi in guardians.size():
			if bool(guardians[gi].get("alive", false)) and hero_px.distance_to(guardians[gi]["px"] as Vector2) <= 290.0:
				_damage_guardian(gi, maxi(18, int(round(float(base_atk) * 2.10 * dmg_scale))), false, kill_heal_pct, 3.0, 1.0)
		_redraw_all()
		return

	if world != null and float(world.get("ki_mode_timer")) > 0.0:
		dmg_scale *= 1.25

	if hero_actor != null and hero_actor.has_method("play_action"):
		hero_actor.play_action("ki_blast" if is_gm else "skill", "attack")
	if world != null and world.audio != null:
		if is_gm:
			world.audio.play_gm_sfx("gm_ki_blast", 0.94, 0.04)
		else:
			world.audio.play_race_skill(race_k, nid)

	if race_k == "planetary" and nid == "A1":
		perform_labyrinth_dodge(true)
		return
	if hud != null and ((nid == "B1" and race_k in ["android", "sage", "legend"]) or (nid == "C4" and race_k == "planetary") or (nid == "B9" and race_k in ["legend", "android"])):
		var sh_val := (36.0 + float(hud.hero_max_hp) * 0.25) * shield_mult
		hud.hero_shield_hp = maxf(float(hud.hero_shield_hp), sh_val)
		hud.hero_shield_timer = maxf(float(hud.hero_shield_timer), 6.5)
		if vfx_layer != null and vfx_layer.has_method("spawn_ki_burst"):
			vfx_layer.spawn_ki_burst(hero_px, race_k, 130.0)
		skill_rings.append({"pos": hero_px, "r": 20.0, "max_r": 124.0, "col": Color(0.38, 0.94, 1.0), "t": 0.45, "dur": 0.45})
		float_texts.append({"pos": hero_px + Vector2(-34, -58), "txt": "+%d OSŁONA" % int(round(sh_val)), "col": Color(0.42, 0.94, 1.0), "t": 1.15})
		if race_k != "legend":
			_redraw_all()
			return
	if hud != null and ((race_k == "android" and nid == "C4") or (race_k == "planetary" and nid in ["C1", "C9"]) or (race_k == "sage" and nid in ["C1", "C4"])):
		var heal_p := 0.40 if nid == "C9" else (0.20 if nid == "C4" else 0.14)
		var ki_p := 0.30 if (race_k == "sage" and nid == "C1") else 0.0
		if heal_p > 0.0 and not (race_k == "sage" and nid == "C1"):
			var h_add := float(hud.hero_max_hp) * heal_p
			hud.hero_hp = minf(float(hud.hero_max_hp), float(hud.hero_hp) + h_add)
			float_texts.append({"pos": hero_px + Vector2(-24, -58), "txt": "+%d HP" % int(round(h_add)), "col": Color(0.42, 1.0, 0.58), "t": 1.15})
		if ki_p > 0.0:
			var k_add := float(hud.hero_max_ki) * ki_p
			hud.hero_ki = minf(float(hud.hero_max_ki), float(hud.hero_ki) + k_add)
			float_texts.append({"pos": hero_px + Vector2(-24, -58), "txt": "+%d KI" % int(round(k_add)), "col": Color(0.42, 0.92, 1.0), "t": 1.15})
		if vfx_layer != null and vfx_layer.has_method("spawn_ki_burst"):
			vfx_layer.spawn_ki_burst(hero_px, "planetary", 130.0)
		skill_rings.append({"pos": hero_px, "r": 18.0, "max_r": 120.0, "col": Color(0.42, 0.98, 0.64), "t": 0.45, "dur": 0.45})
		_redraw_all()
		return

	# Offensive & AoE Skills with full CombatVFX
	var mult := maxf(1.35, float(spec.get("mult", 1.85)))
	var is_aoe: bool = bool(spec.get("aoe", false)) or (nid in ["C1", "C4", "A4", "B4", "B1", "A9", "B9", "C9"])
	var reach_px := maxf(245.0, float(spec.get("radius", 245.0)))
	var apply_burn := 3.5 if (race_k == "legend" and nid in ["A1", "C1", "C4", "C9"]) else 0.0
	var apply_stun := 1.4 if (nid in ["B1", "B4", "B9"] and race_k in ["legend", "android", "planetary"]) else 0.0
	var apply_slow := 3.5 if (nid in ["B1", "B4"] and race_k in ["planetary", "sage"]) else 0.0
	if vfx_layer != null:
		if is_gm and vfx_layer.has_method("spawn_gm_ki_blast"):
			var end_p := (guardians[nearest_guard_idx]["px"] as Vector2) if (nearest_guard_idx >= 0 and nearest_guard_idx < guardians.size()) else (hero_px + hero_facing.normalized() * 210.0)
			vfx_layer.spawn_gm_ki_blast(hero_px, end_p, 0.0)
		elif vfx_layer.has_method("spawn_ki_burst"):
			vfx_layer.spawn_ki_burst(hero_px, race_k, 195.0)
	_trigger_shake(6.5, 0.20)
	skill_rings.append({"pos": hero_px, "r": 24.0, "max_r": reach_px * 0.85, "col": Color(1.0, 0.64, 0.24) if race_k == "legend" else Color(0.36, 0.92, 1.0), "t": 0.42, "dur": 0.42})
	var targets: Array[int] = []
	for gi in guardians.size():
		if not bool(guardians[gi].get("alive", false)):
			continue
		if hero_px.distance_to(guardians[gi]["px"] as Vector2) <= reach_px:
			targets.append(gi)
			if not is_aoe:
				break
	if targets.is_empty() and nearest_guard_idx >= 0:
		targets.append(nearest_guard_idx)
	for gi in targets:
		var g_lvl := int(guardians[gi].get("level", 6))
		var lv_pen := 0.65 if (g_lvl - hero_lv >= 3) else 1.0
		var is_crit := randf() * 100.0 < crit_pct
		var dmg := maxi(14, int(round(float(base_atk) * mult * dmg_scale * lv_pen * (1.55 if is_crit else 1.0))))
		_damage_guardian(gi, dmg, is_crit, kill_heal_pct, apply_burn, apply_stun, apply_slow)
	_redraw_all()

func _report_guardian_defeat(guardian: Dictionary, hp_cost: int) -> void:
	var visit := _visit_id
	var point: Vector2 = guardian["px"]
	if not _can_stand(point):
		point = hero_px
	if hero_px.distance_to(point) <= world.LOOT_PICKUP_RADIUS:
		for direction: Vector2 in [Vector2.UP, Vector2.LEFT, Vector2.DOWN, Vector2.RIGHT]:
			var candidate := point + direction * 34.0
			if _can_stand(candidate) and hero_px.distance_to(candidate) > world.LOOT_PICKUP_RADIUS:
				point = candidate
				break
	world.request_pve_defeat(str(guardian["id"]), point, hp_cost, func(res: Dictionary) -> void:
		if not visible or visit != _visit_id:
			return
		var drop: Dictionary = res.get("lootDrop", {})
		if bool(res.get("ok", false)) and not drop.is_empty():
			drop["elapsed"] = 0.0
			drop["label"] = world.server_loot_label(drop)
			ground_drops.append(drop)
		_show_toast(str(res.get("notice", "")))
	)

func _step_ground_drops(delta: float) -> void:
	if ground_drops.is_empty() or world == null:
		return
	var visit := _visit_id
	var current_drops: Array[Dictionary] = []
	for drop: Dictionary in ground_drops:
		drop["elapsed"] = float(drop["elapsed"]) + delta
		if bool(drop.get("removed", false)) or float(drop["elapsed"]) >= 120.0:
			continue
		if float(drop["elapsed"]) >= 0.45:
			world.try_pickup_server_loot(drop, hero_px, func(notice: String, _ok: bool) -> void:
				if visible and visit == _visit_id:
					_show_toast(notice)
			)
		current_drops.append(drop)
	ground_drops = current_drops

func _unhandled_input(event: InputEvent) -> void:
	if not visible:
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F or event.keycode == KEY_ENTER:
			if not nearest_chest.is_empty():
				_try_open_nearest_chest()
				get_viewport().set_input_as_handled()
		elif event.keycode == KEY_Q or event.keycode == KEY_SPACE:
			perform_labyrinth_attack()
			get_viewport().set_input_as_handled()
		elif event.keycode in [KEY_1, KEY_2, KEY_3, KEY_4]:
			var si := int(event.keycode - KEY_1) + 1
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
				world.rpg_hud.trigger_skill(si)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_R:
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_skill"):
				world.rpg_hud.trigger_skill(5)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_V or event.keycode == KEY_SHIFT:
			if world != null and world.rpg_hud != null and world.rpg_hud.has_method("trigger_dodge"):
				world.rpg_hud.trigger_dodge()
			else:
				perform_labyrinth_dodge(false)
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_H or event.keycode == KEY_E:
			_use_labyrinth_potion()
			get_viewport().set_input_as_handled()

func _sync_skill_bar_labels() -> void:
	if world == null or world.rpg_hud == null:
		return
	var hud = world.rpg_hud
	for i in skill_btns.size():
		var si := i + 1
		var nid: String = hud.get_hotbar_node(si) if hud.has_method("get_hotbar_node") else "A1"
		var unlocked: bool = hud.is_hotbar_skill_unlocked(si) if hud.has_method("is_hotbar_skill_unlocked") else false
		var cd := float(hud.cooldowns[si]) if si < hud.cooldowns.size() else 0.0
		if not unlocked:
			skill_btns[i].text = "[%d] %s 🔒" % [si, nid]
			skill_btns[i].modulate = Color(0.62, 0.62, 0.68, 0.80)
		elif cd > 0.05:
			skill_btns[i].text = "[%d] %.1fs" % [si, cd]
			skill_btns[i].modulate = Color(0.72, 0.82, 0.96, 0.92)
		else:
			skill_btns[i].text = "[%d] %s" % [si, nid]
			skill_btns[i].modulate = Color.WHITE
	var dcd := float(hud.dodge_cd) if ("dodge_cd" in hud) else 0.0
	btn_dodge.text = ("💨 %.1fs" % dcd) if dcd > 0.05 else "💨 UNIK [V]"
	var ki_u: bool = hud.is_hotbar_skill_unlocked(5) if hud.has_method("is_hotbar_skill_unlocked") else false
	var ki_rem := float(world.get("ki_mode_timer"))
	btn_ki_mode.text = ("✦ KI %ds" % int(ceil(ki_rem))) if ki_rem > 0.05 else ("✦ KI [R]" if ki_u else "🔒 KI [R]")
	btn_ki_mode.modulate = Color.WHITE if (ki_u or ki_rem > 0.05) else Color(0.62, 0.62, 0.68, 0.80)

func _sync_world_camera() -> void:
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = size
	var shk := Vector2.ZERO
	if _shake_t > 0.0:
		shk = Vector2(randf_range(-_shake_amp, _shake_amp), randf_range(-_shake_amp, _shake_amp))
	world_root.position = vs * 0.5 - hero_px + shk

func _redraw_all() -> void:
	floor_layer.queue_redraw()
	light_layer.queue_redraw()
	hud_overlay.queue_redraw()
	queue_redraw()

func _process(delta: float) -> void:
	if not visible:
		return
	elapsed += delta
	atk_cd = maxf(0.0, atk_cd - delta)
	dodge_invuln_t = maxf(0.0, dodge_invuln_t - delta)
	if _shake_t > 0.0:
		_shake_t = maxf(0.0, _shake_t - delta)
		if _shake_t <= 0.0:
			_shake_amp = 0.0
	if world != null and float(world.get("ki_mode_timer")) > 0.0:
		world.ki_mode_timer = maxf(0.0, float(world.ki_mode_timer) - delta)
		if world.ki_mode_timer <= 0.0:
			if world.hero != null and world.hero.has_method("set_ki_mode"):
				world.hero.set_ki_mode(false)
			if hero_actor != null and hero_actor.has_method("set_ki_mode"):
				hero_actor.set_ki_mode(false)
	if toast_timer > 0.0:
		toast_timer -= delta
		if toast_timer <= 0.0:
			toast_lbl.visible = false

	# Smooth movement + echoing dungeon footsteps + real 3D actor animation
	var dir := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		dir.x -= 1.0
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		dir.x += 1.0
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		dir.y -= 1.0
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		dir.y += 1.0
	if world != null and int(world.move_pointer) != -1:
		dir = world.motion
	var moved := false
	if dir.length_squared() > 0.001:
		dir = dir.normalized()
		hero_facing = dir
		var step := dir * HERO_SPEED * delta
		if _can_stand(hero_px + step):
			hero_px += step
			moved = true
		elif _can_stand(hero_px + Vector2(step.x, 0.0)):
			hero_px.x += step.x
			moved = true
		elif _can_stand(hero_px + Vector2(0.0, step.y)):
			hero_px.y += step.y
			moved = true
		_reveal_around_hero()
	if hero_actor != null:
		hero_actor.position = hero_px
		hero_actor.animate(dir if moved else Vector2.ZERO, true, 1.0)
	if moved:
		step_audio_t -= delta
		if step_audio_t <= 0.0:
			step_audio_t = 0.36
			_step_alt = not _step_alt
			if world != null and world.audio != null and world.audio.has_method("play_dungeon_sfx"):
				world.audio.play_dungeon_sfx("dungeon_step", 0.36, 0.07)
	else:
		step_audio_t = 0.08

	# Drift atmospheric spores / embers / snowflakes / holo-sparks
	for pt: Dictionary in atmos_particles:
		pt["x"] = float(pt["x"]) + float(pt["vx"]) * delta
		pt["y"] = float(pt["y"]) + float(pt["vy"]) * delta
		if float(pt["x"]) < -920.0: pt["x"] = 920.0
		if float(pt["x"]) > 920.0: pt["x"] = -920.0
		if float(pt["y"]) < -540.0: pt["y"] = 540.0
		if float(pt["y"]) > 540.0: pt["y"] = -540.0

	# Update chests proximity
	nearest_chest = {}
	var best_cd := 112.0
	for c: Dictionary in chests:
		if _is_chest_opened(str(c.get("id", ""))):
			continue
		var d := hero_px.distance_to(c["px"] as Vector2)
		if d < best_cd:
			best_cd = d
			nearest_chest = c
	if not nearest_chest.is_empty():
		btn_open_chest.text = "★ OTWÓRZ: %s" % str(nearest_chest.get("title", "Ukryty Skarb"))
		btn_open_chest.visible = true
	else:
		btn_open_chest.visible = false

	# Update animated monster guardians AI + premium roar/attack SFX
	var kill_heal_pct := float((world.rpg_hud.get_talent_passives() as Dictionary).get("killHealPct", 0.0)) if (world != null and world.rpg_hud != null and world.rpg_hud.has_method("get_talent_passives")) else 0.0
	nearest_guard_idx = -1
	var best_gd := 230.0
	for gi in guardians.size():
		var g: Dictionary = guardians[gi]
		var gnode = g.get("node", null)
		if not bool(g.get("alive", false)):
			continue
		g["hit_flash"] = maxf(0.0, float(g.get("hit_flash", 0.0)) - delta)
		g["atk_cd"] = maxf(0.0, float(g.get("atk_cd", 0.0)) - delta)
		g["stun_t"] = maxf(0.0, float(g.get("stun_t", 0.0)) - delta)
		g["slow_t"] = maxf(0.0, float(g.get("slow_t", 0.0)) - delta)
		var bt := float(g.get("burn_t", 0.0))
		if bt > 0.0:
			g["burn_t"] = maxf(0.0, bt - delta)
			g["burn_acc"] = float(g.get("burn_acc", 0.0)) + delta
			if float(g["burn_acc"]) >= 0.50:
				g["burn_acc"] = float(g["burn_acc"]) - 0.50
				_damage_guardian(gi, maxi(5, int(round(float(g.get("burn_dps", 12.0)) * 0.50))), false, kill_heal_pct)
				if not bool(g.get("alive", false)):
					continue
		var cur_gp: Vector2 = g["px"]
		var prev_gp := cur_gp
		var gkey := "%d,%d" % [int(floor(cur_gp.x / TILE_PX)), int(floor(cur_gp.y / TILE_PX))]
		if is_instance_valid(gnode):
			gnode.visible = visited.has(gkey)
		if float(g.get("stun_t", 0.0)) > 0.05:
			var gd_s := hero_px.distance_to(cur_gp)
			if gd_s < best_gd:
				best_gd = gd_s
				nearest_guard_idx = gi
			if is_instance_valid(gnode):
				gnode.animate(Vector2.ZERO, false)
			continue
		var slow_mult := 0.60 if float(g.get("slow_t", 0.0)) > 0.05 else 1.0
		var home: Vector2 = g["home"]
		var dist_h := hero_px.distance_to(cur_gp)
		var was_hurt := int(g.get("cur_hp", 100)) < int(g.get("max_hp", 100))
		if (dist_h < 220.0 or (was_hurt and dist_h < 320.0)) and cur_gp.distance_to(home) < 380.0:
			if not bool(g.get("roared", false)):
				g["roared"] = true
				if world != null and world.audio != null:
					world.audio.play_monster_sfx(str(g.get("actor_id", "")), "roar")
			if dist_h > 56.0:
				var gstep := (hero_px - cur_gp).normalized() * 175.0 * slow_mult * delta
				if _can_stand(cur_gp + gstep):
					cur_gp += gstep
				elif _can_stand(cur_gp + Vector2(gstep.x, 0.0)):
					cur_gp.x += gstep.x
				elif _can_stand(cur_gp + Vector2(0.0, gstep.y)):
					cur_gp.y += gstep.y
				g["px"] = cur_gp
			if hero_px.distance_to(cur_gp) <= 92.0 and float(g["atk_cd"]) <= 0.0:
				g["atk_cd"] = 1.35
				if is_instance_valid(gnode):
					gnode.face(hero_px - cur_gp)
					gnode.play_action("attack", "idle")
				if world != null and world.audio != null:
					world.audio.play_monster_sfx(str(g.get("actor_id", "")), "atk")
				if dodge_invuln_t > 0.05:
					float_texts.append({"pos": hero_px + Vector2(-18, -58), "txt": "UNIK!", "col": Color(0.46, 0.98, 0.72), "t": 0.9})
				else:
					var g_atk := int(g.get("atk", 90))
					var g_lvl := int(g.get("level", 7))
					var hero_lv := int(world.rpg_hud.hero_level) if (world != null and world.rpg_hud != null) else 1
					var hero_def := int(world.rpg_hud.get_total_defense()) if (world != null and world.rpg_hud != null and world.rpg_hud.has_method("get_total_defense")) else 16
					var adv_mult := 1.35 if (g_lvl - hero_lv >= 3) else 1.0
					var gdmg := maxi(8, int(round(float(g_atk) * adv_mult - float(hero_def) * 0.55)))
					g["dmg_dealt_to_hero"] = int(g.get("dmg_dealt_to_hero", 0)) + gdmg
					_trigger_shake(6.0, 0.16)
					if hero_actor != null and hero_actor.has_method("play_action"):
						hero_actor.play_action("hit", "idle", 0.25)
					float_texts.append({
						"pos": hero_px + Vector2(0, -64),
						"txt": "-%d HP" % gdmg,
						"col": Color(1.0, 0.28, 0.24),
						"t": 1.05,
					})
					if world != null and world.rpg_hud != null and world.rpg_hud.has_method("take_combat_damage"):
						if world.rpg_hud.take_combat_damage(gdmg):
							if world.has_method("handle_hero_defeat"):
								world.handle_hero_defeat()
							return
		else:
			var off := Vector2(cos(elapsed * 1.1 + float(gi) * 2.1), sin(elapsed * 0.9 + float(gi) * 1.7)) * 28.0
			if _can_stand(home + off):
				cur_gp = cur_gp.move_toward(home + off, 70.0 * delta)
				g["px"] = cur_gp
		if is_instance_valid(gnode):
			gnode.position = cur_gp
			var g_mot := cur_gp - prev_gp
			gnode.animate(g_mot if g_mot.length_squared() > 0.05 else Vector2.ZERO, false, 0.85)
		var gd := hero_px.distance_to(cur_gp)
		if gd < best_gd:
			best_gd = gd
			nearest_guard_idx = gi

	btn_attack.text = ("⚔ ATAK (%d)" % int(guardians[nearest_guard_idx]["cur_hp"])) if nearest_guard_idx >= 0 else "⚔ ATAK [Q]"
	var pot_cnt := _count_hp_potions()
	btn_potion.text = "🧪 ELIKSIR (%d) [H]" % pot_cnt
	btn_potion.modulate = Color(1.0, 1.0, 1.0, 1.0) if pot_cnt > 0 else Color(0.66, 0.66, 0.72, 0.78)
	_sync_skill_bar_labels()

	near_exit = hero_px.distance_to(exit_px) < 64.0
	_step_ground_drops(delta)

	var kept_r: Array[Dictionary] = []
	for sr: Dictionary in skill_rings:
		sr["t"] = float(sr["t"]) - delta
		if float(sr["t"]) > 0.0:
			kept_r.append(sr)
	skill_rings = kept_r

	var kept: Array[Dictionary] = []
	for ft: Dictionary in float_texts:
		ft["t"] = float(ft["t"]) - delta
		ft["pos"] = (ft["pos"] as Vector2) + Vector2(0.0, -40.0 * delta)
		if float(ft["t"]) > 0.0:
			kept.append(ft)
	float_texts = kept

	_sync_world_camera()
	_redraw_all()

func _draw() -> void:
	var pal: Dictionary = THEME_PALETTES.get(current_theme, THEME_PALETTES["pyra"])
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = size
	draw_rect(Rect2(Vector2.ZERO, vs), pal["bg"] as Color, true)

func _draw_dungeon_floor() -> void:
	var pal: Dictionary = THEME_PALETTES.get(current_theme, THEME_PALETTES["pyra"])
	var f_tint: Color = pal["floor_tint"]
	var accent: Color = pal["accent"]
	var fb: Font = MapStyle.body_font()
	var c := floor_layer

	# Draw textured stone/moss/lava/ice/cyber dungeon floor tiles with AO shadows & rune inlays
	for ty in maze_h:
		for tx in maze_w:
			if _is_wall(tx, ty):
				continue
			var key := "%d,%d" % [tx, ty]
			if not visited.has(key):
				continue
			var tile_c := Vector2((float(tx) + 0.5) * TILE_PX, (float(ty) + 0.5) * TILE_PX)
			var dist_t := hero_px.distance_to(tile_c) / TILE_PX
			var light := clampf(1.38 - dist_t * 0.14, 0.52, 1.28)
			var tr := Rect2(Vector2(float(tx) * TILE_PX, float(ty) * TILE_PX), Vector2(TILE_PX, TILE_PX))
			var ftex := _floor_tex_a if ((tx + ty) % 2 == 0 or _floor_tex_b == null) else _floor_tex_b
			if ftex != null:
				var src_r := _safe_tex_region(ftex, tx, ty, 240.0, 240.0)
				c.draw_texture_rect_region(ftex, tr, src_r, Color(f_tint.r * light, f_tint.g * light, f_tint.b * light, 1.0))
			else:
				c.draw_rect(tr, f_tint * light * 0.45, true)
			# Subtle dungeon flagstone grout seams & carved stone flagstones
			c.draw_rect(tr, Color(0.01, 0.01, 0.02, 0.32), false, 2.0)
			c.draw_line(tr.position + Vector2(0.0, TILE_PX * 0.5), tr.position + Vector2(TILE_PX, TILE_PX * 0.5), Color(0.02, 0.02, 0.03, 0.24), 1.5)
			c.draw_line(tr.position + Vector2(TILE_PX * 0.5, 0.0), tr.position + Vector2(TILE_PX * 0.5, TILE_PX), Color(0.02, 0.02, 0.03, 0.24), 1.5)
			# Wall-contact ambient occlusion along left/right/bottom walls
			if _is_wall(tx - 1, ty):
				c.draw_rect(Rect2(tr.position, Vector2(14.0, TILE_PX)), Color(0.01, 0.01, 0.02, 0.36), true)
			if _is_wall(tx + 1, ty):
				c.draw_rect(Rect2(tr.position + Vector2(TILE_PX - 14.0, 0.0), Vector2(14.0, TILE_PX)), Color(0.01, 0.01, 0.02, 0.36), true)
			if _is_wall(tx, ty + 1):
				c.draw_rect(Rect2(tr.position + Vector2(0.0, TILE_PX - 12.0), Vector2(TILE_PX, 12.0)), Color(0.01, 0.01, 0.02, 0.32), true)
			# Ancient glowing floor rune sigil on corridor intersections
			if ((tx * 17 + ty * 31) % 5) == 0:
				c.draw_arc(tile_c, 28.0, 0.0, TAU, 24, Color(accent.r, accent.g, accent.b, 0.28 * light), 2.0, true)
				c.draw_arc(tile_c, 18.0, elapsed * 0.4, elapsed * 0.4 + PI * 1.3, 16, Color(accent.r, accent.g, accent.b, 0.34 * light), 1.6, true)

	# Animated Multi-Ring Arcane Exit Portal at spawn
	var ep := exit_px
	var ep_pulse := 1.0 + sin(elapsed * 3.2) * 0.08
	c.draw_set_transform(ep, 0.0, Vector2(1.0, 0.58))
	c.draw_circle(Vector2.ZERO, 48.0 * ep_pulse, Color(0.18, 0.78, 1.0, 0.24))
	c.draw_circle(Vector2.ZERO, 30.0, Color(0.56, 0.96, 1.0, 0.36))
	c.draw_arc(Vector2.ZERO, 46.0 * ep_pulse, 0.0, TAU, 36, Color(0.42, 0.94, 1.0, 0.95), 3.6, true)
	for seg in 6:
		var a0 := elapsed * 2.2 + float(seg) * (TAU / 6.0)
		c.draw_arc(Vector2.ZERO, 36.0, a0, a0 + 0.55, 10, Color(0.92, 0.98, 1.0, 0.92), 2.6, true)
	c.draw_set_transform(Vector2.ZERO)
	c.draw_string_outline(fb, ep + Vector2(-72.0, 44.0), "✦ PORTAL WYJŚCIA", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 5, Color(0.01, 0.02, 0.04, 0.98))
	c.draw_string(fb, ep + Vector2(-72.0, 44.0), "✦ PORTAL WYJŚCIA", HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.76, 0.98, 1.0))

	# Treasure chest floor seals & crisp labels
	for ch: Dictionary in chests:
		var ckey := "%d,%d" % [int(ch.get("tx", 1)), int(ch.get("ty", 1))]
		if not visited.has(ckey):
			continue
		var cp: Vector2 = ch["px"]
		var opened := _is_chest_opened(str(ch.get("id", "")))
		if not opened:
			c.draw_set_transform(cp + Vector2(0.0, 12.0), 0.0, Vector2(1.0, 0.45))
			c.draw_circle(Vector2.ZERO, 46.0 + 6.0 * sin(elapsed * 3.8), Color(1.0, 0.80, 0.22, 0.22))
			c.draw_arc(Vector2.ZERO, 42.0, 0.0, TAU, 32, Color(1.0, 0.88, 0.34, 0.88), 2.8, true)
			c.draw_set_transform(Vector2.ZERO)
			c.draw_string_outline(fb, cp + Vector2(-72.0, 44.0), "★ UKRYTY SKARB", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 5, Color(0.03, 0.02, 0.01, 0.98))
			c.draw_string(fb, cp + Vector2(-72.0, 44.0), "★ UKRYTY SKARB", HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.92, 0.46))
		else:
			c.draw_string_outline(fb, cp + Vector2(-42.0, 40.0), "OTWARTE", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, 4, Color(0.02, 0.02, 0.02, 0.92))
			c.draw_string(fb, cp + Vector2(-42.0, 40.0), "OTWARTE", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.68, 0.74, 0.70))

	# Ground loot drops
	for drop: Dictionary in ground_drops:
		var point := Vector2(float(drop["x"]), float(drop["z"]))
		var tile := "%d,%d" % [floori(point.x / TILE_PX), floori(point.y / TILE_PX)]
		if visited.has(tile):
			var gold := Color(1.0, 0.88, 0.38)
			c.draw_circle(point, 20.0, Color(gold, 0.28))
			c.draw_arc(point, 16.0, 0.0, TAU, 20, gold, 2.6, true)
			var label := str(drop["label"])
			var width := fb.get_string_size(label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
			var lp := point + Vector2(-width * 0.5, -26.0)
			c.draw_string_outline(fb, lp, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 5, Color.BLACK)
			c.draw_string(fb, lp, label, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, gold)

func _draw_dungeon_lights() -> void:
	if _glow_tex == null:
		return
	var pal: Dictionary = THEME_PALETTES.get(current_theme, THEME_PALETTES["pyra"])
	var torch_c: Color = pal["torch"]
	var part_c: Color = pal["particle"]
	var c := light_layer

	# 1. Warm volumetric hero torchlight aura
	var h_flick := 1.0 + sin(elapsed * 7.2) * 0.04 + cos(elapsed * 11.4) * 0.03
	var hr := 250.0 * h_flick
	c.draw_texture_rect(_glow_tex, Rect2(hero_px - Vector2(hr, hr), Vector2(hr * 2.0, hr * 2.0)), false, Color(torch_c.r, torch_c.g, torch_c.b, 0.24))

	# 2. Flickering volumetric brazier light pools
	for b: Dictionary in braziers:
		var bk := "%d,%d" % [int(b["tx"]), int(b["ty"])]
		if not visited.has(bk):
			continue
		var bp: Vector2 = b["pos"]
		var ph := float(b["phase"])
		var flick := 1.0 + sin(elapsed * 8.6 + ph) * 0.09 + cos(elapsed * 14.3 + ph) * 0.05
		var br := 155.0 * flick
		c.draw_texture_rect(_glow_tex, Rect2(bp + Vector2(0.0, -24.0) - Vector2(br, br), Vector2(br * 2.0, br * 2.0)), false, Color(torch_c.r, torch_c.g, torch_c.b, 0.34))
		c.draw_texture_rect(_glow_tex, Rect2(bp + Vector2(0.0, -28.0) - Vector2(28.0, 28.0), Vector2(56.0, 56.0)), false, Color(1.0, 0.95, 0.78, 0.55 * flick))

	# 3. Radiant golden light pillars on unopened chests
	for ch: Dictionary in chests:
		if _is_chest_opened(str(ch.get("id", ""))):
			continue
		var ckey := "%d,%d" % [int(ch.get("tx", 1)), int(ch.get("ty", 1))]
		if not visited.has(ckey):
			continue
		var cp: Vector2 = ch["px"]
		var gr := 120.0 + sin(elapsed * 4.0) * 14.0
		c.draw_texture_rect(_glow_tex, Rect2(cp - Vector2(gr, gr), Vector2(gr * 2.0, gr * 2.0)), false, Color(1.0, 0.84, 0.28, 0.30))

	# 4. Skill / Dodge rings
	for sr: Dictionary in skill_rings:
		var prog := 1.0 - clampf(float(sr["t"]) / maxf(float(sr["dur"]), 0.05), 0.0, 1.0)
		var rad := lerpf(float(sr["r"]), float(sr["max_r"]), prog)
		var col: Color = sr["col"] as Color
		var sp: Vector2 = sr["pos"]
		c.draw_arc(sp, rad, 0.0, TAU, 36, Color(col.r, col.g, col.b, (1.0 - prog) * 0.90), 4.2, true)

	# 5. Drifting biome atmospheric particles (spores / fire embers / frost / holo-sparks)
	for pt: Dictionary in atmos_particles:
		var pp := hero_px + Vector2(float(pt["x"]), float(pt["y"]))
		var pulse := 0.55 + 0.45 * sin(elapsed * 3.2 + float(pt["ph"]))
		var sz := float(pt["sz"])
		c.draw_texture_rect(_glow_tex, Rect2(pp - Vector2(sz * 3.2, sz * 3.2), Vector2(sz * 6.4, sz * 6.4)), false, Color(part_c.r, part_c.g, part_c.b, 0.48 * pulse))
		c.draw_circle(pp, sz * 0.65, Color(1.0, 0.98, 0.90, 0.88 * pulse))

func _draw_dungeon_hud() -> void:
	var c := hud_overlay
	var f: Font = MapStyle.font()
	var fb: Font = MapStyle.body_font()
	var vs := get_viewport_rect().size
	if vs.x < 100.0:
		vs = size

	# Atmospheric moody dungeon vignette framing viewport edges
	if _vignette_tex != null:
		c.draw_texture_rect(_vignette_tex, Rect2(Vector2.ZERO, vs), false, Color(1.0, 1.0, 1.0, 0.88))

	# Floating combat & loot numbers (big, razor-sharp 22px on mobile!)
	var cam_off := world_root.position
	for ft: Dictionary in float_texts:
		var fp: Vector2 = (ft["pos"] as Vector2) + cam_off
		c.draw_string_outline(fb, fp, str(ft["txt"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 22, 6, Color(0.02, 0.01, 0.01, 0.98))
		c.draw_string(fb, fp, str(ft["txt"]), HORIZONTAL_ALIGNMENT_LEFT, -1, 22, ft["col"] as Color)

	# Count opened chests
	var opened_cnt := 0
	for ch: Dictionary in chests:
		if _is_chest_opened(str(ch.get("id", ""))):
			opened_cnt += 1

	# Top Header Bar (tall, crisp, mobile-readable!)
	c.draw_rect(Rect2(0, 0, vs.x, 82.0), Color(0.04, 0.032, 0.052, 0.94), true)
	c.draw_line(Vector2(0, 82.0), Vector2(vs.x, 82.0), Color(0.92, 0.72, 0.34, 0.90), 2.5)
	c.draw_string(f, Vector2(214, 38), "⚔ %s (Poz. %d)" % [str(lab_data.get("title", "Labirynt")), int(lab_data.get("level", 5))], HORIZONTAL_ALIGNMENT_LEFT, -1, 24, Color(1.0, 0.92, 0.58))
	c.draw_string(fb, Vector2(214, 67), "%s  •  Skarby: %d / %d" % [
		str(lab_data.get("subtitle", "")), opened_cnt, chests.size()
	], HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.88, 0.94, 1.0))

	# Big Live Hero HP / Shield / KI bars in Top-Right Header
	if world != null and world.rpg_hud != null:
		var hud = world.rpg_hud
		var bw_h := 330.0
		var bx_h := vs.x - bw_h - 18.0
		var hp_cur := float(hud.hero_hp)
		var hp_max := maxf(float(hud.hero_max_hp), 1.0)
		var hp_frac := clampf(hp_cur / hp_max, 0.0, 1.0)
		var sh_val := float(hud.hero_shield_hp) if float(hud.hero_shield_timer) > 0.05 else 0.0
		var ki_cur := float(hud.hero_ki)
		var ki_max := maxf(float(hud.hero_max_ki), 1.0)
		var ki_frac := clampf(ki_cur / ki_max, 0.0, 1.0)

		var hp_rect := Rect2(bx_h, 11.0, bw_h, 28.0)
		c.draw_rect(hp_rect, Color(0.10, 0.04, 0.05, 0.96), true)
		c.draw_rect(Rect2(hp_rect.position + Vector2(1.5, 1.5), Vector2((bw_h - 3.0) * hp_frac, 25.0)), Color(0.88, 0.18, 0.18, 0.98), true)
		if sh_val > 0.5:
			var sh_frac := clampf(sh_val / hp_max, 0.0, 1.0)
			c.draw_rect(Rect2(hp_rect.position + Vector2(1.5, 1.5), Vector2((bw_h - 3.0) * sh_frac, 6.0)), Color(0.32, 0.94, 1.0, 0.98), true)
		c.draw_rect(hp_rect, Color(0.94, 0.74, 0.36, 0.92), false, 2.0)
		var hp_txt := "HP %d / %d%s" % [int(round(hp_cur)), int(round(hp_max)), (" [+%d]" % int(round(sh_val))) if sh_val > 0.5 else ""]
		c.draw_string_outline(fb, Vector2(bx_h + 10.0, 31.0), hp_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 4, Color(0.02, 0.01, 0.01, 0.98))
		c.draw_string(fb, Vector2(bx_h + 10.0, 31.0), hp_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.97, 0.93))

		var ki_rect := Rect2(bx_h, 45.0, bw_h, 26.0)
		c.draw_rect(ki_rect, Color(0.04, 0.08, 0.14, 0.96), true)
		c.draw_rect(Rect2(ki_rect.position + Vector2(1.5, 1.5), Vector2((bw_h - 3.0) * ki_frac, 23.0)), Color(0.18, 0.72, 0.98, 0.98), true)
		c.draw_rect(ki_rect, Color(0.45, 0.84, 1.0, 0.88), false, 1.8)
		var ki_txt := "KI %d / %d  •  Poz.%d" % [int(round(ki_cur)), int(round(ki_max)), int(hud.hero_level)]
		c.draw_string_outline(fb, Vector2(bx_h + 10.0, 64.0), ki_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, 4, Color(0.02, 0.02, 0.04, 0.98))
		c.draw_string(fb, Vector2(bx_h + 10.0, 64.0), ki_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.88, 0.97, 1.0))

	# Crisp Corner Dungeon Minimap (top-left below header)
	var mm_cell := 12.0
	var mm_origin := Vector2(20.0, 98.0)
	var mm_sz := Vector2(float(maze_w) * mm_cell + 10.0, float(maze_h) * mm_cell + 10.0)
	c.draw_rect(Rect2(mm_origin - Vector2(5, 5), mm_sz), Color(0.03, 0.03, 0.05, 0.90), true)
	c.draw_rect(Rect2(mm_origin - Vector2(5, 5), mm_sz), Color(0.92, 0.72, 0.34, 0.92), false, 2.2)
	for ty in maze_h:
		for tx in maze_w:
			if not visited.has("%d,%d" % [tx, ty]):
				continue
			var r := Rect2(mm_origin + Vector2(float(tx) * mm_cell, float(ty) * mm_cell), Vector2(mm_cell, mm_cell))
			c.draw_rect(r, Color(0.36, 0.34, 0.42, 0.94) if _is_wall(tx, ty) else Color(0.14, 0.18, 0.24, 0.94), true)
	for ch: Dictionary in chests:
		if not _is_chest_opened(str(ch.get("id", ""))) and visited.has("%d,%d" % [int(ch.get("tx", 1)), int(ch.get("ty", 1))]):
			var mp := mm_origin + Vector2((float(ch.get("tx", 1)) + 0.5) * mm_cell, (float(ch.get("ty", 1)) + 0.5) * mm_cell)
			c.draw_circle(mp, 4.2, Color(1.0, 0.88, 0.28, 1.0))
	for g: Dictionary in guardians:
		if bool(g.get("alive", false)):
			var gp: Vector2 = g["px"]
			var gkey := "%d,%d" % [int(floor(gp.x / TILE_PX)), int(floor(gp.y / TILE_PX))]
			if visited.has(gkey):
				var gmp := mm_origin + Vector2(gp.x / TILE_PX * mm_cell, gp.y / TILE_PX * mm_cell)
				c.draw_circle(gmp, 3.8, Color(1.0, 0.28, 0.24, 1.0))
	var h_mm := mm_origin + Vector2(hero_px.x / TILE_PX * mm_cell, hero_px.y / TILE_PX * mm_cell)
	c.draw_circle(h_mm, 4.6, Color(0.24, 0.98, 1.0, 1.0))
