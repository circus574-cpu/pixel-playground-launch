extends SceneTree
var output := "/tmp/android-audit-dialogues"
var results: Array[Dictionary] = []
var lines: Array[Dictionary] = []
func check(ok: bool, id: String, kind: String, detail := "") -> void:
	results.append({"passed":ok,"id":id,"kind":kind,"detail":detail})
	if not ok:print("DIALOGUE FAIL ",id," ",detail)
func _initialize() -> void:run.call_deferred()
func run() -> void:
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("--out="):output=arg.substr(6)
	DirAccess.make_dir_recursive_absolute(output)
	var data: Dictionary = PyraContinent.load_json("res://data/quests.json")
	var engine := PyraQuests.new(data)
	for city: Dictionary in data.cities:
		var land := str(city.continent)
		var city_spec: Dictionary = data.places[land].cities.get(str(city.id),{})
		var settlement := str(city_spec.get("settlement",""))
		for npc: Dictionary in city.npcs:
			var role := str(npc.bindingId).trim_prefix(land+".npc.")
			var d: Dictionary = data.dialogues.get(str(npc.id),{})
			check(not d.is_empty(),str(npc.id),"npc-source")
			if d.is_empty():continue
			for i in (d.greetings as Array).size():
				var reply := engine.conversation(land,settlement,role,i)
				var text := str(d.greetings[i])
				check((reply.lines as Array).has(text),str(npc.id)+"/greeting/%d"%i,"greeting",text)
				lines.append({"npc":npc.id,"name":npc.name,"land":land,"town":settlement,"role":role,"kind":"greeting","text":text})
			var reply := engine.conversation(land,settlement,role,0)
			for i in (d.rumors as Array).size():
				check((reply.rumors as Array).has(str(d.rumors[i])),str(npc.id)+"/rumor/%d"%i,"rumor",str(d.rumors[i]))
				lines.append({"npc":npc.id,"name":npc.name,"land":land,"town":settlement,"role":role,"kind":"rumor","text":str(d.rumors[i])})
			for qid: String in d.quests:
				for pair in [["available","before"],["active","during"],["completed","after"]]:
					engine.quests[qid]={"state":pair[0],"progress":{},"stage":0,"completions":0}
					var answer := engine.conversation(land,settlement,role,0)
					var text := str(d.quests[qid].get(pair[1],""))
					var reached := false
					for line: String in answer.lines:
						if not text.is_empty() and line.contains(text):reached=true
					check(reached,str(npc.id)+"/"+qid+"/"+str(pair[1]),"quest-branch",text)
					lines.append({"npc":npc.id,"name":npc.name,"land":land,"town":settlement,"role":role,"kind":pair[1],"quest":qid,"text":text,"reachableInConversation":reached})
	var talk: Dictionary = PyraStory.data()
	for role: String in talk.roleTopics:
		for topic: Dictionary in talk.roleTopics[role]:
			for world: String in talk.worlds:
				var topics := PyraStory.topics(world,role)
				check(topics.any(func(t):return str(t.text)==str(topic.text)),world+"/"+role+"/"+str(topic.id),"role-topic")
	for world: String in talk.worlds:
		for key: String in PyraStory.WORLD_TOPIC_ORDER:
			var found := PyraStory.topics(world,"guide").filter(func(t):return str(t.id).ends_with(":"+key))
			check(found.size()==1,world+"/"+key,"world-topic")
	for rule: Dictionary in talk.reactions:
		var flag := {str(rule.when):true}
		var variants: Array = talk.reactions.filter(func(r):return r.when==rule.when)
		var reachable := false
		for i in variants.size():
			if PyraStory.reaction(flag,i)==str(rule.text):reachable=true
		check(reachable,str(rule.when)+"/"+str(rule.text).left(35),"reaction")
	var failed := results.filter(func(r):return not r.passed).size()
	var file := FileAccess.open(output+"/result.json",FileAccess.WRITE)
	file.store_string(JSON.stringify({"checks":results.size(),"passed":results.size()-failed,"failed":failed,"catalogNpcCount":data.dialogues.size(),"dialogueLines":lines,"results":results,"fixtures":"Quest states are explicitly seeded to exercise before/during/after branches; these are not claimed as naturally unlocked at level 3."},"\t"));file.close()
	print("DIALOGUE AUDIT ",results.size()-failed,"/",results.size())
	quit(1 if failed else 0)
