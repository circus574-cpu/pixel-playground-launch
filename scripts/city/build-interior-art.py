"""Original vector utility art authored for Ki Legends city interiors. No external inputs."""
import json
from pathlib import Path
out=Path('deliveries/city-interiors-1.0.0');out.mkdir(parents=True,exist_ok=True)
def svg(w,h,body):
 return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><defs><linearGradient id="wood" x2="0" y2="1"><stop stop-color="#bd9051"/><stop offset="1" stop-color="#493527"/></linearGradient><linearGradient id="metal" x2=".5" y2="1"><stop stop-color="#c4d0c0"/><stop offset=".5" stop-color="#718481"/><stop offset="1" stop-color="#283f41"/></linearGradient></defs>{body}</svg>'
shadow='<ellipse cx="128" cy="211" rx="99" ry="25" fill="#101f20" opacity=".3"/>'
chest=shadow+'<path d="M35 111L128 76 222 112 222 192 128 224 35 191Z" fill="#443626" stroke="#202d2d" stroke-width="5"/><path d="M35 111L128 145 222 112V174L128 209 35 176Z" fill="url(#wood)"/><path d="M35 111Q32 63 79 50L128 37Q198 44 222 112L128 145Z" fill="url(#wood)" stroke="#3c3027" stroke-width="5"/><path d="M60 118V185M191 121V185M77 50L77 128M176 59L180 127" stroke="#a5a68a" stroke-width="12"/><path d="M36 145L128 178 222 145M128 145V209" fill="none" stroke="#332d25" stroke-width="3"/><rect x="115" y="144" width="27" height="37" rx="6" fill="#d6b361" stroke="#65542f" stroke-width="4"/><circle cx="128" cy="158" r="5" fill="#26382e"/><path d="M128 159V170" stroke="#26382e" stroke-width="5"/>'
anvil=shadow+'<path d="M72 188L99 151 158 151 189 188 182 208 73 208Z" fill="url(#wood)" stroke="#3a3028" stroke-width="5"/><path d="M91 149L106 114 99 83 170 83 157 117 174 151Z" fill="url(#metal)" stroke="#263b3c" stroke-width="5"/><path d="M31 79L91 49 226 49 216 82 167 96 85 96Z" fill="url(#metal)" stroke="#263b3c" stroke-width="5"/><path d="M44 78L94 60 213 60" fill="none" stroke="#d7d3ba" stroke-width="4"/><path d="M165 116L200 156" stroke="#956f44" stroke-width="13"/><path d="M186 139L211 121 226 139 200 157Z" fill="url(#metal)" stroke="#263b3c" stroke-width="4"/>'
dummy=shadow+'<path d="M89 202L128 170 168 203" fill="none" stroke="#6d4a2c" stroke-width="15"/><path d="M128 203V57M56 100H202" stroke="#ad8246" stroke-width="16"/><path d="M88 75Q128 57 168 75L163 141Q128 167 92 143Z" fill="#cfb776" stroke="#715c34" stroke-width="6"/><path d="M93 87L162 128M93 108L162 146M93 130L160 88" stroke="#927d42" stroke-width="4"/><circle cx="128" cy="49" r="27" fill="#d8c287" stroke="#74613c" stroke-width="5"/><path d="M108 38L147 60M111 62L145 39" stroke="#a18e56" stroke-width="3"/><circle cx="128" cy="108" r="22" fill="#8a5135" stroke="#ead395" stroke-width="4"/><circle cx="128" cy="108" r="9" fill="#d6b96d"/>'
shelf=shadow+'<path d="M40 38L205 38 217 191 38 205Z" fill="#3d3025" stroke="#24342d" stroke-width="6"/><path d="M49 49H195V183H49Z" fill="#60442d"/><path d="M47 90H202M47 139H209M42 191H213" stroke="#bd9051" stroke-width="9"/>'
for row in range(3):
 for col in range(6):
  x,y=55+col*23,49+row*49
  shelf+=f'<rect x="{x}" y="{y}" width="17" height="37" rx="2" fill="{["#5d9474","#b39665","#a56b51","#649198","#9b7355","#96a36b"][col]}"/><path d="M{x+3} {y+6}h10M{x+3} {y+28}h10" stroke="#ded0a0" stroke-width="2"/>'
bed=shadow+'<path d="M60 47L179 47 211 189 90 217Z" fill="url(#wood)" stroke="#40352b" stroke-width="6"/><path d="M70 56L169 56 193 173 94 194Z" fill="#e4d9b2"/><path d="M77 87L176 79 196 177 94 197Z" fill="#39765a" stroke="#213f35" stroke-width="4"/><path d="M84 109L180 100M91 143L186 133M98 177L193 166" stroke="#8ea273" stroke-width="4"/><path d="M71 57L160 57 167 84 77 91Z" fill="#f3e9c9" stroke="#b4ab82" stroke-width="3"/>'
desk=shadow+'<path d="M51 115V194M198 115V194M84 129V211M169 128V207" stroke="#60442c" stroke-width="17"/><path d="M36 88L126 57 221 86 221 124 128 153 36 121Z" fill="url(#wood)" stroke="#3e3026" stroke-width="6"/><path d="M45 94L130 68 211 93" stroke="#d1a46a" stroke-width="3" fill="none"/><path d="M89 89L126 78 164 91 127 104Z" fill="#e7d9ac"/><path d="M97 89L126 84 153 91M112 95L135 91" stroke="#817b53" stroke-width="2"/><ellipse cx="178" cy="105" rx="15" ry="8" fill="#d1b66c"/><path d="M172 104V70H182V104" fill="#eee2a8"/><path d="M174 68Q165 54 178 45Q190 60 181 68" fill="#e6b35c"/>'
props=''.join(f'<g transform="translate({i*256} 0)">{s}</g>' for i,s in enumerate([chest,anvil,dummy,shelf,bed,desk]))
(out/'props.svg').write_text(svg(1536,256,props))
planks='<rect width="256" height="256" fill="#604c35"/>'
for row in range(8):
 y=row*32
 planks+=f'<rect x="0" y="{y+1}" width="256" height="30" fill="{["#94794d","#8c7044","#a18456","#90764b"][row%4]}"/>'
 for x in range(-128 if row%2 else 0,256,128):
  planks+=f'<path d="M{x} {y}V{y+32}M{x+7} {y+10}q50 -4 110 2M{x+13} {y+23}q45 3 94 -2" fill="none" stroke="#584831" opacity=".45" stroke-width="2"/>'
(out/'floor.svg').write_text(svg(256,256,planks))
stone='<rect width="256" height="256" fill="#81795b"/>'
for row in range(8):
 for col in range(5):
  x=col*64-(32 if row%2 else 0);y=row*32
  stone+=f'<rect x="{x+2}" y="{y+2}" width="60" height="28" rx="7" fill="{["#bab49a","#aaa78e","#c4bea3","#a7a78b"][(row*3+col)%4]}" stroke="#d3cdb1" stroke-width="1"/>'
(out/'stone.svg').write_text(svg(256,256,stone))
assets=[{'id':'city-props','version':'1.0.0','kind':'image','url':'props.webp','width':1536,'height':256,'grid':{'columns':6,'rows':1}},*[{'id':'city-'+n,'version':'1.0.0','kind':'image','url':n+'.webp','width':256,'height':256} for n in ['floor','stone']]]
refs={f'object.city.{n}':{'asset':'city-props','frame':i} for i,n in enumerate(['chest','anvil','dummy','shelf','bed','desk'])}
refs.update({f'terrain.city-{n}':{'asset':'city-'+n,'tileSize':[256,256]} for n in ['floor','stone']})
manifest={'schemaVersion':1,'id':'city-interiors','version':'1.0.0','technical':False,'previewOnly':False,'assets':assets,'actors':[],'actorBindings':{},'renderBindings':refs,'effects':{}}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(out/'PROVENANCE.md').write_text('# City interiors 1.0.0\n\nOriginal SVG utility illustrations and tile patterns authored as code by Codex for this repository on 2026-10-23. Source: scripts/city/build-interior-art.py. No reference images, external model, checkpoint, external assets or GPU used. Generated files are reproducible from that script. This records authorship/process; it is not an independent legal opinion or proof of exclusive copyright. Existing exterior illustrations retain their existing license status.\n')
