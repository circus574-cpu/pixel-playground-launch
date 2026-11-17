extends SceneTree
var output := "/tmp/android-audit-animations"
var results: Array[Dictionary] = []
var samples: Array[Dictionary] = []
func check(ok:bool,id:String,kind:String,detail:Variant=null) -> void:
	results.append({"passed":ok,"id":id,"kind":kind,"detail":detail})
	if not ok:print("ANIMATION FAIL ",id," ",kind)
func _initialize() -> void:run.call_deferred()
func settle(n:=3) -> void:
	for i in n:await process_frame
func caption(parent:Node,text:String,at:Vector2) -> void:
	var label:=Label.new();label.text=text;label.position=at;label.add_theme_font_size_override("font_size",22);label.add_theme_color_override("font_color",Color("f4d196"));parent.add_child(label)
func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):output=arg.substr(6)
	DirAccess.make_dir_recursive_absolute(output)
	var data:Dictionary=PyraContinent.load_json("res://data/actors.json")
	Engine.max_fps=60
	var viewport:=SubViewport.new();viewport.size=Vector2i(1440,1440);viewport.disable_3d=true;viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;root.add_child(viewport)
	for pair in [["legend","pyra"],["planetary","verdant"],["sage","aether"],["android","nexus"]]:
		var race:String=pair[0];var actor_data:Dictionary=data[str(pair[1])+".hero"]
		var stage:=Node2D.new();viewport.add_child(stage)
		caption(stage,race.to_upper()+" · RUNTIME GODOT · 36 KLIPÓW",Vector2(20,8))
		var index:=0;var actors:Array[PyraActor]=[]
		for clip:String in actor_data.clips:
			var actor:=PyraActor.new();stage.add_child(actor);actor.setup(actor_data,"",false,true)
			actor.position=Vector2(120+(index%6)*240,238+(index/6)*230);actor.scale=Vector2.ONE*1.1
			actor.direction="down";actor.play_clip(clip);actors.append(actor)
			caption(stage,clip,Vector2(16+(index%6)*240,42+(index/6)*230))
			var directions:Array=[];var bad_regions:=0;var frame_total:=0
			for direction:String in PyraActor.DIRECTIONS:
				var name:=clip+":"+direction;var has:=actor.frames.has_animation(name)
				check(has,race+"/"+clip+"/"+direction,"direction-present")
				if not has:continue
				var count:=actor.frames.get_frame_count(name);check(count>1,race+"/"+name,"multiple-frames",count)
				directions.append({"direction":direction,"frames":count,"mirrored":direction in actor_data.clips[clip].get("mirrored",[])})
				for i in count:
					var texture:AtlasTexture=actor.frames.get_frame_texture(name,i)
					frame_total+=1
					if texture==null or texture.atlas==null or not Rect2(Vector2.ZERO,texture.atlas.get_size()).encloses(texture.region) or not texture.region.has_area():bad_regions+=1
			check(bad_regions==0,race+"/"+clip,"valid-frame-regions",{"frames":frame_total,"bad":bad_regions})
			samples.append({"race":race,"clip":clip,"fps":actor_data.clips[clip].fps,"loop":actor_data.clips[clip].loop,"directions":directions,"frameReferences":frame_total})
			index+=1
		await create_timer(0.3).timeout
		for i in actors.size():
			var actor:PyraActor=actors[i]
			check(actor.sprite.frame>0,race+"/"+str(actor.sprite.animation),"timeline-advances",{"frame":actor.sprite.frame,"playing":actor.sprite.is_playing()})
		if DisplayServer.get_name()!="headless":
			await RenderingServer.frame_post_draw
			viewport.get_texture().get_image().save_png(output+"/"+race+"-36-clips.png")
		viewport.remove_child(stage);stage.queue_free();await settle(5)
		viewport.size=Vector2i(1440,260)
		var directions_stage:=Node2D.new();viewport.add_child(directions_stage)
		for i in 8:
			var actor:=PyraActor.new();directions_stage.add_child(actor);actor.setup(actor_data,"",false,true)
			actor.position=Vector2(90+i*180,245);actor.scale=Vector2.ONE*1.1
			actor.direction=PyraActor.DIRECTIONS[i];actor.play_clip("walk")
			caption(directions_stage,str(PyraActor.DIRECTIONS[i]),Vector2(8+i*180,10))
		if DisplayServer.get_name()!="headless":
			for frame in 12:
				await create_timer(0.08).timeout
				await RenderingServer.frame_post_draw
				viewport.get_texture().get_image().save_png(output+"/"+race+"-walk-%02d.png"%frame)
		viewport.remove_child(directions_stage);directions_stage.queue_free();await settle(5);viewport.size=Vector2i(1440,1440)
	var failed:=results.filter(func(r):return not r.passed).size()
	var f:=FileAccess.open(output+"/result.json",FileAccess.WRITE);f.store_string(JSON.stringify({"checks":results.size(),"passed":results.size()-failed,"failed":failed,"clips":samples,"display":DisplayServer.get_name(),"results":results,"scope":"All base and KI clips rendered by the actual PyraActor/SpriteFrames runtime. KI is a visual fixture, not claimed unlocked below level 20. Game-play movement/combat covered separately."},"\t"));f.close()
	viewport.queue_free();await settle(8)
	print("ANIMATION AUDIT ",results.size()-failed,"/",results.size())
	quit(1 if failed else 0)
