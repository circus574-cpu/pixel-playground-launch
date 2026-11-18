#!/usr/bin/env python3
"""Render urban-design boards on actual Godot prototype height and navigation data."""
import json
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.patheffects as effects
import matplotlib.pyplot as plt
from matplotlib.backends.backend_pdf import PdfPages
from matplotlib.colors import LightSource, LinearSegmentedColormap
from matplotlib.lines import Line2D
from matplotlib.path import Path as PolygonPath
from matplotlib.patches import Polygon
import numpy as np
from PIL import Image
from scipy.interpolate import CubicSpline

ROOT = Path(__file__).resolve().parents[2]
PROJECT = ROOT/'ports/godot-isometric-pyra'
OUT = ROOT/'docs/zmiany/2026-11-18/qa/capital-plans'
BG, INK, MUTED, GOLD = '#131b24', '#f4f0e3', '#a4afb8', '#edc073'
NAMES = ['Pyra','Verdantia','Aetheria','Nexus-9']
ROLES = {'hall':'Sala', 'shop':'Sklep', 'inn':'Gospoda', 'arena':'Arena',
         'smithy':'Kuźnia', 'depot':'Depozyt'}
BOUNDS = (slice(109,407),slice(78,441))


def corners(center, size, angle):
    theta = np.radians(angle)
    matrix = np.array([[np.cos(theta), np.sin(theta)],[-np.sin(theta), np.cos(theta)]])
    return np.array([[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]])*size@matrix+center


def curve(points):
    p = np.asarray(points)
    t = np.r_[0,np.cumsum(np.linalg.norm(np.diff(p,axis=0),axis=1))]
    return CubicSpline(t,p,axis=0,bc_type='natural')(np.linspace(0,t[-1],int(t[-1])+1))


def annotate(ax, point, name, offset=(6,6)):
    ax.annotate(name, point, xytext=offset, textcoords='offset points', color=INK,
                fontsize=8, fontweight='medium', zorder=10,
                path_effects=[effects.withStroke(linewidth=3,foreground=BG)])


def render(key, continent, plan):
    src = PROJECT/('data' if key=='pyra' else f'studies/{key}')
    relief = np.fromfile(src/'height.r32','<f4').reshape(512,512)
    walk = np.fromfile(src/'walkable.u8','u1').reshape(512,512)!=0
    hazard = np.asarray(Image.open(src/('surface.png' if key=='pyra' else 'hazards.png')).convert('RGB'))[:,:,0]>127
    current = json.loads((src/'city-layout.json').read_text())
    buildings = json.loads((src/'buildings.json').read_text())
    report = {'districts':len(plan['districts']), 'blocks':0, 'existing_buildings':len(buildings),
              'squares':len(plan['squares']), 'routes':[], 'terrain_review':[]}
    fig = plt.figure(figsize=(13,9.2),facecolor=BG)
    ax = fig.add_axes([.055,.11,.663,.755])
    side = fig.add_axes([.748,.125,.214,.71])
    side.axis('off')
    fig.text(.055,.94,continent.upper()+'   /   SUPERIOR',fontsize=11,color=plan['accent'],fontweight='bold')
    fig.text(.055,.893,plan['title'],fontsize=27,color=INK,fontweight='bold')
    fig.text(.748,.91,'PLAN DZIELNIC',fontsize=13,color=GOLD,fontweight='bold')
    fig.text(.748,.883,'Propozycja do oceny',fontsize=10,color=MUTED)

    zix,xix=BOUNDS
    z,x=np.arange(-512,512,2)[zix],np.arange(-512,512,2)[xix]
    relief_cut=relief[BOUNDS]
    shades=LightSource(azdeg=314,altdeg=39).shade(relief_cut,
        cmap=LinearSegmentedColormap.from_list(key,['#1d2834','#455565','#78818a']),
        vert_exag=1.15,dx=2,dy=2,blend_mode='soft')
    ax.imshow(shades,extent=(x[0]-1,x[-1]+1,z[0]-1,z[-1]+1),origin='lower')
    ax.contour(x,z,relief_cut,levels=np.arange(-20,140,10),colors='#adb7bb',alpha=.24,linewidths=.5)
    ax.contourf(x,z,hazard[BOUNDS],levels=[.5,1.5],
                colors=[{'pyra':'#a84c33','verdantia':'#36789a','aetheria':'#578ba8','nexus':'#1a202a'}[key]],alpha=.94)
    existing = []
    for street in current['streets']:
        coords=np.asarray(street['centerline'])
        ax.plot(*coords.T,color='#e0d7bb',alpha=.75,lw=2.1,zorder=3)
        existing.append(coords)
    for plaza in current['plazas']:
        ax.add_patch(Polygon(plaza['polygon'],fc='#e0d7bb',ec='none',alpha=.68,zorder=3))
    street_points = np.concatenate(existing+[curve(points) for _,points in plan['routes']])
    occupied = [PolygonPath(corners(b['xz'],b['size'],0)) for b in buildings]
    occupied += [PolygonPath(corners(point,size,rotation)) for _,point,size,rotation in plan['squares']]
    occupied += [PolygonPath(plaza['polygon']) for plaza in current['plazas']]
    for b in buildings:
        ax.add_patch(Polygon(corners(b['xz'],b['size'],0),fc='#26323a',ec='#f2e4c2',linewidth=1.05,zorder=5))
        annotate(ax,b['xz'],ROLES[b['id']],(2,5))

    for i,(district,tone) in enumerate(zip(plan['districts'],[plan['accent'],'#d1b8e7','#e8b87b'],strict=True),1):
        boundary=PolygonPath(district['polygon'])
        ax.add_patch(Polygon(district['polygon'],fc=tone,ec=tone,alpha=.19,lw=1.7,zorder=2))
        ax.add_patch(Polygon(district['polygon'],fill=False,ec=tone,linestyle=(0,(3,3)),linewidth=1.1,zorder=3))
        for bx,bz,w,d,r in district['blocks']:
            block=corners([bx,bz],[w,d],r)
            assert boundary.contains_points(block).all(), (key,district['name'],(bx,bz))
            block_path=PolygonPath(block)
            assert not block_path.contains_points(street_points,radius=10).any(), (key,'street clearance',(bx,bz))
            assert not any(block_path.intersects_path(other,filled=True) for other in occupied), (key,'occupied',(bx,bz))
            occupied.append(block_path)
            report['blocks']+=1
            cell=((block+512)//2).astype(int)
            cx,cz=cell.T
            needs_grade=not walk[cz,cx].all()
            if needs_grade:report['terrain_review'].append({'district':district['name'],'block':[bx,bz]})
            ax.add_patch(Polygon(block,fc=tone,ec=tone,alpha=.68,linewidth=.85,
                                 hatch='////' if needs_grade else None,zorder=4))
        polygon=np.asarray(district['polygon'])
        center=polygon.mean(axis=0)
        if min(np.linalg.norm(center-point) for _,point,_,_ in plan['squares'])<23:
            center+=np.array([-26,-12])
        ax.text(*center,str(i),color=BG,fontsize=12,fontweight='bold',ha='center',va='center',zorder=11,
                bbox={'boxstyle':'circle,pad=.30','fc':tone,'ec':BG,'lw':1})
        y=.94-(i-1)*.148
        side.text(0,y,f'{i}  {district["name"]}',color=tone,fontsize=11,fontweight='bold')
        side.text(0,y-.041,district['use'],color=INK,fontsize=8.6,wrap=True)

    for name,points in plan['routes']:
        coords=curve(points)
        cells=((coords+512)//2).astype(int)
        cx,cz=cells.T
        assert cells.min()>=0 and cells.max()<512,name
        needs_work=~walk[cz,cx]
        report['routes'].append({'name':name,'current_surface_blocked_samples':int(needs_work.sum()),'samples':len(coords)})
        ax.plot(*coords.T,color=BG,lw=4.5,alpha=.7,zorder=5)
        ax.plot(*coords.T,color=plan['accent'],lw=2.8,zorder=6)
        marked=coords.copy();marked[~needs_work]=np.nan
        ax.plot(*marked.T,color='#f18b79',lw=3.0,linestyle='dashed',zorder=7)
    for index,(name,point,size,rotation) in enumerate(plan['squares'],1):
        ax.add_patch(Polygon(corners(point,size,rotation),fc=GOLD,ec='#fff0c2',linewidth=1.0,zorder=8))
        ax.text(*point,chr(64+index),color=BG,fontsize=10,fontweight='bold',ha='center',va='center',zorder=9)
        side.text(0,.48-(index-1)*.041,f'{chr(64+index)}   {name}',color=GOLD,fontsize=9.3)
    for name,point in plan['edges']:
        ax.scatter(*point,s=26,marker='D',color=GOLD,edgecolor=BG,zorder=9)
        annotate(ax,point,name,(5,-12))
    side.text(0,.535,'NOWE PLACE',color=INK,fontsize=10,fontweight='bold')
    legend=[Line2D([0],[0],color='#e0d7bb',lw=2,label='Istniejące ulice i place'),
            Line2D([0],[0],color=plan['accent'],lw=3,label='Projektowane ulice'),
            Line2D([0],[0],color='#f18b79',lw=2,ls='--',label='Odcinek wymaga robót w terenie'),
            Line2D([0],[0],color='#d1b8e7',lw=0,marker='s',label='Kwartał pod zabudowę'),
            Line2D([0],[0],color='#f2e4c2',lw=0,marker='s',markerfacecolor='#26323a',label='Istniejący budynek'),
            Line2D([0],[0],color=GOLD,lw=0,marker='D',label='Brama lub punkt dojazdowy')]
    side.legend(handles=legend,loc='upper left',bbox_to_anchor=(-.02,.315),frameon=False,labelcolor=INK,fontsize=8.5)
    side.text(0,.07,f'{report["blocks"]} kwartałów · {len(plan["districts"])} dzielnice',color=INK,fontsize=10)
    side.text(0,.025,'Poziomice co 10 m',color=MUTED,fontsize=8)
    ax.set_facecolor('#263544')
    ax.set(xlim=(-353,357),ylim=(293,-291),aspect='equal')
    ax.set_xticks([]);ax.set_yticks([])
    for spine in ax.spines.values():spine.set_color('#667784')
    ax.plot([-332,-282],[267,267],color=INK,lw=2.5,zorder=12)
    ax.text(-307,257,'50 m',color=INK,fontsize=8,ha='center',zorder=12)
    ax.annotate('N',xy=(329,-278),xytext=(329,-247),ha='center',color=INK,fontsize=9,
                arrowprops={'arrowstyle':'-|>','color':INK})
    fig.text(.055,.062,plan['subtitle'],color=INK,fontsize=12)
    fig.text(.055,.037,'Relief z prototypu Godot · proponowane kwartały to rezerwy terenu · nie są aktywną zabudową',color=MUTED,fontsize=8.6)
    return fig,report


def main():
    plans=json.loads((ROOT/'docs/design/superior-capital-plans.json').read_text())['capitals']
    OUT.mkdir(parents=True,exist_ok=True)
    report={}
    with PdfPages(OUT/'stolice-superiora.pdf',metadata={'Title':'KI Legends · Plany stolic Superiora'}) as pdf:
        for (key,plan),continent in zip(plans.items(),NAMES,strict=True):
            fig,data=render(key,continent,plan)
            fig.savefig(OUT/f'{key}.jpg',dpi=120,facecolor=BG,pil_kwargs={'quality':92})
            pdf.savefig(fig,dpi=140,facecolor=BG)
            plt.close(fig)
            report[key]=data
    (OUT/'terrain-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({name:{k:d[k] for k in ('districts','blocks','squares')} for name,d in report.items()}))


if __name__=='__main__':
    main()
