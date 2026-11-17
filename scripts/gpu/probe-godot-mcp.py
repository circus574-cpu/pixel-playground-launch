#!/usr/bin/env python3
"""Local stdio protocol probe. An installed server is not automatically attached to ChatGPT's tools."""
import json,os,selectors,subprocess,time
from pathlib import Path
root=Path('/workspace/ki-terrain3d')
log=(root/'qa/godot-mcp-probe-stderr.txt').open('w')
p=subprocess.Popen(['node',str(root/'tools/godot-mcp/build/index.js')],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=log,text=True,env=dict(os.environ,GODOT_PATH=str(root/'tools/godot-bin')))
selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ)

def rpc(request):
    p.stdin.write(json.dumps(request)+'\n');p.stdin.flush()
    end=time.monotonic()+15
    while time.monotonic()<end:
        if not selector.select(1):continue
        line=p.stdout.readline()
        if not line:raise RuntimeError('MCP process exited')
        answer=json.loads(line)
        if answer.get('id')==request.get('id'):return answer
    raise TimeoutError(request.get('method'))

try:
    init=rpc({'jsonrpc':'2.0','id':1,'method':'initialize','params':{'protocolVersion':'2024-11-05','capabilities':{},'clientInfo':{'name':'ki-terrain-probe','version':'1'}}})
    p.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');p.stdin.flush()
    listing=rpc({'jsonrpc':'2.0','id':2,'method':'tools/list'})
    tools=[t['name'] for t in listing['result']['tools']]
    report={'initialize':init,'tools':tools,'attached_to_chatgpt':False}
    if 'get_godot_version' in tools:
        report['version']=rpc({'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'get_godot_version','arguments':{}}})
    if 'get_project_info' in tools:
        report['project']=rpc({'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'get_project_info','arguments':{'projectPath':'/workspace/ki-isometric-pyra'}}})
    (root/'qa/godot-mcp-probe.json').write_text(json.dumps(report,indent=2)+'\n')
    print('MCP_PROTOCOL_OK',len(tools),'tools')
finally:
    p.terminate();p.wait(timeout=5)
