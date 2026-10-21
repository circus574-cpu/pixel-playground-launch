"""Create an offline, self-contained review of a packed actor without changing the game."""
import argparse
import base64
import json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("manifest", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
pack = json.loads(args.manifest.read_text())
assets = {}
for asset in pack["assets"]:
    assets[asset["id"]] = {
        "image": "data:image/webp;base64," + base64.b64encode(
            (args.manifest.parent / asset["url"]).read_bytes()
        ).decode(),
        "frames": json.loads((args.manifest.parent / asset["atlasUrl"]).read_text())["frames"],
    }
data = json.dumps({"actor": pack["actors"][0], "assets": assets}).replace("<", "\\u003c")
html = """<!doctype html><html lang="pl"><meta charset="utf-8">
<title>KI Legends — Planetarny: przegląd animacji</title>
<style>
body{margin:20px;background:#18212b;color:#edf2f7;font:15px system-ui}
header{display:flex;gap:14px;align-items:center;flex-wrap:wrap}
h1{font-size:20px}button,select{font:inherit;padding:8px}
canvas{display:block;max-width:100%;height:auto;margin-top:16px}
p{max-width:1050px;line-height:1.5}
</style>
<h1>Planetarny — 416 klatek, 7 animacji, 8 kierunków</h1>
<p>Podgląd techniczny atlasów klienta 128×128. Czerwony znacznik wskazuje stały punkt stóp
(0,5; 0,75). To nie jest akceptacja artystyczna ani zastępstwo testu w grze.</p>
<header><button id="play">Pauza</button><button id="background">Zmień tło</button>
<label>Animacja <select id="state"><option value="all">Wszystkie</option></select></label>
<label>Tempo <select id="speed"><option value="1">1×</option><option value="0.5">0,5×</option>
<option value="0.25">0,25×</option></select></label></header>
<canvas id="view" aria-label="Ośmiokierunkowe animacje Planetarnego"></canvas>
<script>
const data=__DATA__;
const canvas=document.getElementById('view'),ctx=canvas.getContext('2d');
const states=Object.keys(data.actor.clips),directions=Object.keys(data.actor.clips.idle.directions);
const images={};let ready=false,playing=true,light=false,clock=0,last=0;
for(const state of states){const option=document.createElement('option');option.value=state;
option.textContent=state;document.getElementById('state').appendChild(option)}
Promise.all(Object.entries(data.assets).map(([id,a])=>new Promise(resolve=>{
const image=new Image();image.onload=()=>{images[id]=image;resolve()};image.src=a.image
}))).then(()=>{ready=true});
document.getElementById('play').onclick=()=>{playing=!playing;
document.getElementById('play').textContent=playing?'Pauza':'Odtwarzaj'};
document.getElementById('background').onclick=()=>{light=!light};
function draw(now){const delta=last?Math.min(now-last,100):0;last=now;
if(playing)clock+=delta*Number(document.getElementById('speed').value);
if(ready){const selected=document.getElementById('state').value;
const rows=selected==='all'?states:[selected],cell=144,height=164;
canvas.width=cell*8;canvas.height=height*rows.length;
ctx.fillStyle=light?'#d8dde3':'#263341';ctx.fillRect(0,0,canvas.width,canvas.height);
rows.forEach((state,row)=>directions.forEach((direction,col)=>{
const clip=data.actor.clips[state],names=clip.directions[direction];
// Non-looping clips replay after a short review hold; their actual game flags remain unchanged.
const duration=names.length/clip.fps*1000;
const phase=clock%(duration+(clip.loop?0:650));
const name=names[Math.min(names.length-1,Math.floor(phase/1000*clip.fps))];
const frame=data.assets[clip.asset].frames[name].frame,x=col*cell+8,y=row*height;
ctx.drawImage(images[clip.asset],frame.x,frame.y,frame.w,frame.h,x,y,128,128);
ctx.strokeStyle='#ff6c70';ctx.beginPath();ctx.moveTo(x+59,y+96);ctx.lineTo(x+69,y+96);
ctx.moveTo(x+64,y+91);ctx.lineTo(x+64,y+101);ctx.stroke();
ctx.fillStyle=light?'#18212b':'#edf2f7';ctx.font='12px system-ui';
ctx.fillText(state+' / '+direction,col*cell+4,row*height+145);
}));}requestAnimationFrame(draw)}requestAnimationFrame(draw);
</script></html>""".replace("__DATA__", data)
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(html)
print("Self-contained animation review:", args.output)
