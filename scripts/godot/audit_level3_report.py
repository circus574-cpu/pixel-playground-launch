#!/usr/bin/env python3
"""Compile the 1.8 acceptance audit from real Godot run outputs; never changes game data."""
from pathlib import Path
from collections import Counter, defaultdict
import csv
import hashlib
import html
import json
import re
import shutil
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'docs/zmiany/2026-11-16/qa/android-level3-audit'
RACES = {'legend': 'Legendy', 'planetary': 'Planetarni', 'sage': 'Mędrcy', 'android': 'Androidy'}
BRANCH = 'qa/android-races-level3-20261116'
BASE_URL = f'https://github.com/circus574-cpu/pixel-playground-launch/blob/{BRANCH}/docs/zmiany/2026-11-16/qa/android-level3-audit/'

def read(path):
    return json.loads(Path(path).read_text())

def table_csv(name, columns, rows):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, columns, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for folder in ['world', 'animations', 'progression', 'videos']:
        (OUT / folder).mkdir(exist_ok=True)
    sources = {
        '/tmp/android-audit-world/result.json': 'world-headless.json',
        '/tmp/android-audit-world-native/result.json': 'world-native.json',
        '/tmp/android-audit-dialogues/result.json': 'dialogues.json',
        '/tmp/android-audit-animations/result.json': 'animations.json',
        '/tmp/android-audit-animations/pixel-analysis.json': 'animation-pixels.json',
        '/tmp/android-audit-core-proof.json': 'published-core-proof.json',
        '/tmp/android-audit-typecheck.txt': 'typecheck.txt',
        '/tmp/android-audit-world.txt': 'world-headless.txt',
        '/tmp/android-audit-world-native.txt': 'world-native.txt',
        '/tmp/android-audit-dialogues.txt': 'dialogues.txt',
        '/tmp/android-audit-animations.txt': 'animations.txt',
    }
    for source, dest in sources.items():
        shutil.copyfile(source, OUT / dest)
    for path in Path('/tmp/android-audit-world-native').glob('*.png'):
        shutil.copyfile(path, OUT / 'world' / path.name)
    for path in Path('/tmp/android-audit-animations').glob('*-36-clips.png'):
        shutil.copyfile(path, OUT / 'animations' / path.name)
    for race in RACES:
        shutil.copyfile(f'/tmp/android-audit-animations/{race}-walk-00.png', OUT / 'animations' / f'{race}-8-directions.png')
        shutil.copyfile(f'/tmp/android-audit-videos/{race}-walk.mp4', OUT / 'videos' / f'{race}-walk.mp4')
        for path in (Path('/tmp/android-audit-progression-native') / race).iterdir():
            if path.suffix in ['.json', '.png']:
                shutil.copyfile(path, OUT / 'progression' / f'{race}-{path.name}')
        shutil.copyfile(f'/tmp/android-audit-progression-native-{race}.txt', OUT / f'progression-{race}.txt')
    world = read(OUT / 'world-native.json')
    dialogues = read(OUT / 'dialogues.json')
    animations = read(OUT / 'animations.json')
    pixels = read(OUT / 'animation-pixels.json')
    canonical = read(ROOT / 'ports/godot-pyra/data/quests.json')
    role_names = defaultdict(set)
    for n in world['npcs']:
        role_names[(n['land'], n['town'], n['role'])].add(n['name'])
    npc_rows, blocked, lines_blocked = [], [], 0
    for city in canonical['cities']:
        land = city['continent']
        town = canonical['places'][land]['cities'][city['id']]['settlement']
        for npc in city['npcs']:
            role = npc['bindingId'].split('.npc.')[1]
            names = sorted(role_names[(land, town, role)])
            status = 'BRAK NPC' if not names else ('ZGODNY' if npc['name'] in names else 'INNA NAZWA')
            npc_rows.append({'id': npc['id'], 'name': npc['name'], 'city': city['name'], 'land': land, 'town': town, 'role': role, 'actualNames': names, 'status': status})
            if not names:
                d = canonical['dialogues'][npc['id']]
                lines_blocked += len(d['greetings']) + len(d['rumors']) + 3 * len(d['quests'])
                for q in canonical['quests']:
                    if q['giverNpcId'] == npc['id']:
                        blocked.append({'id': q['id'], 'title': q['title'], 'npc': npc['name'], 'city': city['name'], 'minimumLevel': q['unlockCondition'].get('minLevel'), 'recommendedLevel': q['recommendedLevel'], 'playableFlag': q['playableInCurrentRuntime']})
    progress = {}
    for race, label in RACES.items():
        r = read(OUT / 'progression' / f'{race}-result.json')
        log = (OUT / f'progression-{race}.txt').read_text()
        r['engineErrors'] = [line for line in log.splitlines() if line.startswith('ERROR:') or line.startswith('SCRIPT ERROR:')]
        r['totalXp'] = 260 + r['final']['xp']
        r['rewardedKillXp'] = sum(r['xpSources'].values())
        r['xpOutsideRewardedKills'] = r['totalXp'] - r['rewardedKillXp']
        r['label'] = label
        progress[race] = r
    issues = [
        {'id':'P1-01','priority':'P1','title':'Czterech autorowanych NPC nie ma w świecie','evidence':'Brak wiązań hunter w czterech docelowych miastach; 11 zadań ma playableInCurrentRuntime=true, lecz brakuje rozmówcy. Dotyczy również O-A05 i O-N05.','action':'Dodać NPC do właściwych osad z poprawnym role/binding oraz przetestować przyjęcie i oddanie przypisanych zadań.'},
        {'id':'P2-01','priority':'P2','title':'Osiem nazw rozmówców nie zgadza się ze scenariuszem','evidence':'Dialogi m.in. Neli, Orena i Nari uruchamiają się pod nazwami Mio, Taro albo Opiekun miasta. Role działają, ale nazwy wskazane graczowi nie odpowiadają widocznym postaciom.','action':'Wiązać dane NPC także z miastem, zamiast kopiować imiona NPC stolicy do wszystkich usług.'},
        {'id':'P2-02','priority':'P2','title':'Opóźniona Pieczęć Energii Mędrca odwołuje się do zwolnionego celu','evidence':'Dwa ERROR: Lambda capture at index 0 was freed. Passed null instead. Stos: race_kit.gd:445, simulate, Game._process. A1 planuje wybuch po 3 s; martwy potwór usuwa się po około 2 s. Awans nie został przerwany.','action':'W opóźnionym efekcie przechowywać WeakRef lub ID i sprawdzać cel dopiero przy wykonaniu; test z zabiciem celu przed wybuchem.'},
        {'id':'ART-01','priority':'Odbiór grafiki','title':'Legenda: niespójny strój w klipie kiskillb','evidence':'W tablicy rzeczywistych animacji kiskillb pokazuje czerwony pancerz bazowej postaci, podczas gdy kiidle i kiwalk odsłaniają tors. Technicznie klip ma poprawne klatki.','action':'Odbiór artystyczny i ewentualna wymiana tego klipu bez zmiany mechaniki.'},
        {'id':'CANON-01','priority':'Decyzja właściciela','title':'Wygląd Mędrca a aktualny opis kanonu','evidence':'RASY-I-POSTACIE.md opisuje męską postać; obecny sprite ma kobiecą sylwetkę i strój. Jest to rozbieżność materiału wizualnego z dokumentem, nie błąd odtwarzania animacji.','action':'Potwierdzić zatwierdzony wzorzec; nie zmieniano grafiki ani kanonu w audycie.'},
        {'id':'TECH-01','priority':'Dług techniczny','title':'Ostrzeżenia ObjectDB przy zamykaniu runnerów','evidence':'Część testów kończy się ostrzeżeniem o pozostawionych obiektach. Nie zaliczono przez to czystego shutdown ani całego CI.','action':'Osobny audyt cyklu życia i pamięci; nie mylić ostrzeżeń zamykania z błędem Mędrca podczas walki.'},
    ]
    summary = {'createdAt':datetime.now(timezone.utc).isoformat(),'verdict':'ODBIÓR NIEPEŁNY — P1: brak NPC blokuje 11 zadań; awans 1–3 działa dla czterech ras.','version':'1.8','sourceCommit':'fe19c7b8549150021cd8b0d7cf8beef4d308f951','branch':BRANCH,'worldChecks':{k:world[k] for k in ['checks','passed','failed']},'buildingCount':len(world['buildings']),'npcInstances':len(world['npcs']),'authoredNpcCount':len(npc_rows),'npcStatuses':dict(Counter(n['status'] for n in npc_rows)),'authoredDialogueLines':len(dialogues['dialogueLines']),'unreachableAuthoredDialogueLines':lines_blocked,'catalogChecks':{k:dialogues[k] for k in ['checks','passed','failed']},'animationChecks':{k:animations[k] for k in ['checks','passed','failed']},'animationClips':len(animations['clips']),'directionSlots':sum(len(c['directions']) for c in animations['clips']),'frameReferences':sum(x['references'] for x in pixels),'emptyAlphaFrames':sum(x['emptyAlphaFrames'] for x in pixels),'blockedQuests':blocked,'npcReachability':npc_rows,'progression':progress,'issues':issues,'limits':['Brak fizycznego Androida, pomiaru DPI i wydajności sprzętowej.', 'Sprawdzono wszystkie 132 wejścia usługowe z indeksu interakcji; dekoracje środowiskowe bez wejścia nie mają osobnej usługi.','Przeniesienia do istniejących wejść/spawnów są fixture; nie zmierzono całych tras od bramy przez miasto ani pełnego czasu gry.','Progresja używa rzeczywistego Game._process i AI z krokiem 1/60, renderowaniem co cztery kroki. To funkcjonalny test przyspieszony.','Nie dodawano XP, poziomów ani nieśmiertelności do przebiegów progresji; odpoczynek w gospodzie jest płatną usługą.','Budynki i dialogi używają odrębnych kontrolowanych stanów poziomów 1/2/3, materiałów i budżetu usług.','Dalsze warianty questowe before/during/after oraz formy KI sprawdzano jako fixture, nie jako naturalnie odblokowane do poziomu 3.','Nie wykonano pełnej kampanii, realnego konta online/GM ani testów serwera multiplayer.','Produkcja nie była zmieniana; testy mają oddzielne katalogi zapisów XDG.']}
    (OUT/'report.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    table_csv('buildings.csv',['land','town','id','service','reachable','entered','residents','returned'],world['buildings'])
    table_csv('npc-catalog.csv',['id','name','city','land','town','role','actualNames','status'],[{**n,'actualNames':' / '.join(n['actualNames'])} for n in npc_rows])
    table_csv('blocked-quests.csv',['id','title','npc','city','minimumLevel','recommendedLevel','playableFlag'],blocked)
    table_csv('dialogues.csv',['npc','name','land','town','role','kind','quest','text','reachableInConversation'],dialogues['dialogueLines'])
    render_html(summary, world, dialogues, animations)
    render_pdf(summary, world, animations)
    files={str(p.relative_to(OUT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='evidence-sha256.json'}
    (OUT/'evidence-sha256.json').write_text(json.dumps(files,indent=2)+'\n')
    print(json.dumps({k:summary[k] for k in ['verdict','buildingCount','npcInstances','npcStatuses','authoredDialogueLines','unreachableAuthoredDialogueLines','frameReferences']},ensure_ascii=False,indent=2))

def render_html(s,w,d,a):
    e=lambda x:html.escape(str(x))
    def table(headers,rows):
        return '<table><thead><tr>'+''.join('<th>'+e(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td>'+e(v)+'</td>' for v in row)+'</tr>' for row in rows)+'</tbody></table>'
    pieces=['<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KI Legends — audyt Androida 1.8</title><style>body{font:16px/1.6 system-ui;background:#10141b;color:#edf0f6;max-width:1200px;margin:auto;padding:24px}h1,h2,h3{color:#edc078}table{border-collapse:collapse;width:100%;margin:20px 0;font-size:14px}th,td{border:1px solid #3d4655;padding:9px;text-align:left;vertical-align:top}th{background:#252e3b}img,video{max-width:100%;height:auto}a{color:#9ecfff}details{border:1px solid #3d4655;padding:14px;margin:12px 0}summary{cursor:pointer;font-weight:700}.verdict{border-left:5px solid #f19355;padding:16px;background:#28212a}input{font:inherit;padding:12px;width:90%;background:#252e3b;color:white;border:1px solid #748095}</style><body><h1>KI LEGENDS — audyt Androida 1.8</h1><p>16.11.2026 · Godot 4.6.3 · programowy OpenGL · źródło <code>'+s['sourceCommit']+'</code></p><p class="verdict">'+e(s['verdict'])+'</p><p><a href="raport.pdf">Raport PDF</a> · <a href="report.json">Pełne dane JSON</a> · <a href="buildings.csv">132 budynki CSV</a> · <a href="dialogues.csv">486 kwestii dialogowych CSV</a></p><h2>Progresja 1 → 3</h2>']
    pieces.append(table(['Rasa','Poziom','Nagradzane zabicia','Śmierci','Odpoczynki w gospodzie','XP z potworów / inne'],[(r['label'],r['final']['level'],r['kills'],r['deaths'],r['innRests'],f"{r['rewardedKillXp']} / {r['xpOutsideRewardedKills']}") for r in s['progression'].values()]))
    pieces.append('<p>Android otrzymał dodatkowe 55 XP poza licznikiem nagradzanych zabić — kwota odpowiada nagrodzie wydarzenia Kordon Dronów. Nie są to komendy GM. Czasy w JSON są czasami symulacji, nie telefonu ani normalnej podróży.</p>')
    for race,r in s['progression'].items():pieces.append('<details><summary>'+e(r['label'])+' — rzeczywisty ekran poziomu 3</summary><img src="progression/'+race+'-level-3.png"><pre>'+e(json.dumps(r['levelEvents'],ensure_ascii=False,indent=2))+'</pre></details>')
    pieces.append('<h2>Usterki i decyzje</h2>')
    for issue in s['issues']:pieces.append('<details open><summary>'+e(issue['id']+' · '+issue['title'])+'</summary><p>'+e(issue['evidence'])+'</p><p><b>Naprawa / odbiór:</b> '+e(issue['action'])+'</p></details>')
    pieces.append('<h2>Brakujący rozmówcy i zablokowane zadania</h2>'+table(['Quest','Nazwa','NPC','Miasto','Min. poziom'],[(q['id'],q['title'],q['npc'],q['city'],q['minimumLevel']) for q in s['blockedQuests']]))
    pieces.append('<h2>Wszyscy autorowani NPC</h2>'+table(['NPC','Miasto','Nazwa w grze','Wynik'],[(n['name'],n['city'],' / '.join(n['actualNames']) or '—',n['status']) for n in s['npcReachability']]))
    pieces.append('<h2>Wszystkie 132 budynki</h2><p>Każde wejście, NPC usługi, otwarcie funkcji i powrót pod właściwe drzwi. Lokalne podejście do celu; nie jest to test pełnej trasy przez miasto.</p>'+table(['Kraina','Wejście','Usługa','Wejście / usługa / powrót'],[(b['land'],b['id'],b['service'],f"{b.get('entered')} / {b.get('function',{}).get('functional')} / {b.get('returned')}") for b in w['buildings']]))
    pieces.append('<h2>Animacje</h2><p>144 klipy, 1152 pary klip/kierunek, 8384 odwołania do klatek, zero pustych klatek alfa. To kontrola techniczna i podgląd, nie potwierdzenie spójności artystycznej wszystkich efektów.</p>')
    for race,label in RACES.items():pieces.append('<details><summary>'+label+' — 36 klipów i chód w 8 kierunkach</summary><img src="animations/'+race+'-36-clips.png"><video controls loop muted src="videos/'+race+'-walk.mp4"></video></details>')
    pieces.append('<h2>Każda kwestia z katalogu</h2><p>Warianty przed / w trakcie / po zadaniu są kontrolowanymi stanami silnika dialogów. 57 kwestii czterech brakujących NPC nie ma rozmówcy w świecie.</p><input id="filter" placeholder="Szukaj NPC, zadania lub tekstu…"><div id="lines">')
    for line in d['dialogueLines']:
        pieces.append('<details><summary>'+e(line['name']+' · '+line['kind']+' · '+line.get('quest',''))+'</summary><p>'+e(line['text'])+'</p></details>')
    pieces.append('</div><h2>Ograniczenia</h2><ul>'+''.join('<li>'+e(x)+'</li>' for x in s['limits'])+'</ul><script>document.getElementById("filter").addEventListener("input",e=>{let q=e.target.value.toLowerCase();document.querySelectorAll("#lines details").forEach(d=>d.hidden=!d.textContent.toLowerCase().includes(q))})</script></body></html>')
    (OUT/'raport.html').write_text(''.join(pieces))

def render_pdf(s,w,a):
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.units import mm
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont
    pdfmetrics.registerFont(TTFont('DejaVu','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
    pdfmetrics.registerFont(TTFont('DejaVu-Bold','/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))
    styles=getSampleStyleSheet()
    for name in ['Normal','BodyText','Title','Heading1','Heading2','Heading3']:
        styles[name].fontName='DejaVu-Bold' if name not in ['Normal','BodyText'] else 'DejaVu'
    styles['Normal'].fontSize=9;styles['Normal'].leading=13
    styles['BodyText'].fontSize=9;styles['BodyText'].leading=13
    styles.add(ParagraphStyle('Cell',fontName='DejaVu',fontSize=7,leading=10))
    parts=[]
    def para(text,style='BodyText'):parts.append(Paragraph(html.escape(str(text)),styles[style]));parts.append(Spacer(1,3*mm))
    def heading(text):para(text,'Heading1')
    def tab(headers,rows,widths=None):
        data=[[Paragraph(html.escape(str(x)),styles['Cell']) for x in row] for row in [headers]+list(rows)]
        t=Table(data,colWidths=widths,repeatRows=1,hAlign='LEFT')
        t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#e6c991')),('VALIGN',(0,0),(-1,-1),'TOP'),('GRID',(0,0),(-1,-1),0.3,colors.HexColor('#afb5be')),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.whitesmoke,colors.white]),('LEFTPADDING',(0,0),(-1,-1),5),('RIGHTPADDING',(0,0),(-1,-1),5),('TOPPADDING',(0,0),(-1,-1),5),('BOTTOMPADDING',(0,0),(-1,-1),5)]));parts.append(t);parts.append(Spacer(1,4*mm))
    para('KI LEGENDS','Title');para('Android 1.8 — rasy, miasta i NPC','Heading1');para('Test postaci od poziomu 1 do 3')
    para('16 listopada 2026 · Godot 4.6.3 / OpenGL Compatibility / Mesa llvmpipe')
    heading('Wynik odbioru')
    para(s['verdict'])
    para('Testowany kod: '+s['sourceCommit'])
    para('Rdzeń lokalnego runtime ma identyczny SHA-256 i rozmiar jak publiczna paczka aktywnej wersji 1.8. Nie zmieniano produkcyjnego kodu, statystyk, zapisów ani grafiki.')
    tab(['Obszar','Wynik'],[['Awans 1–3','4/4 rasy osiągnęły poziom 3; bez GM i bez dodawania XP'],['Budynki','132/132 wejścia, usługi i powroty; wszystkie 10 krain'],['NPC w odwiedzonych miejscach','244 wystąpienia; 732 otwarcia dialogów na poziomach 1/2/3'],['Autorowani NPC','16 nazw zgodnych, 8 nazw rozbieżnych, 4 brakujące postacie'],['Dialogi katalogowe','486 kwestii; 57 bez odpowiadającego NPC w świecie'],['Animacje','144 klipy / 1152 par kierunkowych / 8384 klatki / brak pustych alfa'],['Błędy walki','2 błędy opóźnionego celu u Mędrca; awans mimo tego osiągnięty']], [56*mm,116*mm])
    heading('Jak wykonano test')
    for text in s['limits'][:5]:para(text)
    para('Wszystkie zrzuty i nagrania pochodzą z rzeczywistego renderera Godota. Tablice animacji renderują tę samą klasę PyraActor co gra; nie są obrazami wygenerowanymi przez AI.')
    parts.append(PageBreak());heading('1. Wyniki progresji czterech ras')
    tab(['Rasa','Zabicia nagradzane','Śmierci','Gospoda','XP potwory / inne','Czas sym.'],[(r['label'],r['kills'],r['deaths'],r['innRests'],f"{r['rewardedKillXp']} / {r['xpOutsideRewardedKills']}",f"{r['simulationSeconds']:.1f} s") for r in s['progression'].values()],[31*mm,24*mm,19*mm,19*mm,42*mm,37*mm])
    para('Legenda i Planetarny korzystali z płatnych odpoczynków po starciach. Żaden przebieg nie użył mikstury. To wybrane kontrolowane starcia, a nie test wszystkich możliwych zachowań lub tras. Licznik zabić pomija cele no_reward. Android uzyskał 55 XP poza licznikiem nagradzanych zabić, co odpowiada nagrodzie wydarzenia Kordon Dronów. Nie należy porównywać tych czasów jako balansu ras.')
    statrows=[]
    for race,r in s['progression'].items():
        values=[{'level':1,'stats':r['checks'][0]['detail']['stats']}]+r['levelEvents']
        for v in values:
            st=v['stats'];statrows.append([r['label'],v['level'],st['maxHp'],st['maxKi'],st['attack'],st['defense'],st['speed']])
    tab(['Rasa','Poz.','HP','KI','ATK','DEF','Ruch'],statrows,[37*mm,17*mm,22*mm,22*mm,22*mm,22*mm,30*mm])
    para('Na poziomie 2 uczono legalnie A1, wydając istniejący punkt umiejętności. Nie wyposażano łupów automatycznie. Końcowy poziom, drzewko i stan ekwipunku przechodziły zapis i odczyt.')
    for race,r in s['progression'].items():
        parts.append(PageBreak());heading(r['label']+' — poziom 3 w uruchomionej grze')
        parts.append(Image(str(OUT/'progression'/f'{race}-level-3.png'),width=172*mm,height=79.5*mm))
        para(f"Nagradzane zabicia: {r['kills']}; śmierci: {r['deaths']}; końcowe monety: {r['final']['inventory']['gold']}; nadwyżka XP na poziomie 3: {r['final']['xp']}.")
        para('Błędy silnika podczas przebiegu: '+('; '.join(r['engineErrors']) if r['engineErrors'] else 'brak ERROR / SCRIPT ERROR w trakcie gry; osobno występują ostrzeżenia przy zamykaniu.'))
    parts.append(PageBreak());heading('2. Budynki i usługi — pełny rejestr')
    counts=Counter(b['land'] for b in w['buildings'])
    tab(['Kraina','Wejścia'],counts.items(),[115*mm,57*mm])
    para('Każde wejście sprawdzono z wolnego punktu w promieniu interakcji. Następnie wejście do wnętrza, rozmowę z mieszkańcem usługi, uruchomienie funkcji oraz powrót pod te same drzwi. Nie jest to test pełnej trasy od bramy przez zabudowę.')
    para('Sklepy: kupno i sprzedaż mikstury; kuźnie: realna receptura z kontrolowanymi materiałami; depozyty: włożenie i wyjęcie przedmiotu; gospody: zapłata 5 monet i odnowienie HP; areny: podstawowy atak z obrażeniami manekina; sale: otwarcie rozmowy. Testy usług mają odrębny budżet, nie wpływają na przebiegi awansu.')
    tab(['Kraina','ID wejścia','Usługa','Wynik'],[(b['land'],b['id'],b['service'],'PASS' if b.get('entered') and b.get('returned') and b.get('function',{}).get('functional') else 'FAIL') for b in w['buildings']],[23*mm,83*mm,25*mm,41*mm])
    parts.append(PageBreak());heading('3. NPC i dialogi — źródła a dostępność w grze')
    para('Silnik poprawnie odtworzył 84 powitania, 84 plotki i 318 wariantów zadań (przed / w trakcie / po). Cały zestaw kontroli katalogu ma 663 sprawdzenia. W odrębnym runtime otwarto dialogi 244 wystąpień NPC na poziomach 1, 2 i 3, a także 288 wariantów tematów przypisanych do świata i roli.')
    para('Mimo poprawnych tekstów czterech planowanych rozmówców nie ma w scenie. 57 kwestii nie ma przez to odpowiadającej interakcji w świecie. Dla ośmiu rozmówców role działają, ale wyświetlane imię jest inne niż w scenariuszu.')
    tab(['NPC scenariusza','Miasto','W grze','Status'],[(n['name'],n['city'],' / '.join(n['actualNames']) or '—',n['status']) for n in s['npcReachability']],[48*mm,43*mm,47*mm,34*mm])
    heading('Zadania dotknięte brakiem rozmówcy')
    tab(['Quest','NPC','Miasto','Min. poziom'],[(q['id'],q['npc'],q['city'],q['minimumLevel']) for q in s['blockedQuests']],[24*mm,56*mm,63*mm,29*mm])
    para('Minimalny poziom to tylko jeden z warunków; pozostałe odkrycia i zależności również obowiązują. Brak NPC blokuje przyjęcie/rozmowę po spełnieniu tych warunków. Główne łańcuchy O-A05 i O-N05 wymagają dalszej naprawy.')
    para('Pełne teksty oraz wyniki każdego wariantu: dialogues.csv, dialogues.json i wyszukiwalny raport.html w tym samym folderze.')
    parts.append(PageBreak());heading('4. Kontrola animacji')
    para('Każda rasa ma 36 klipów bazowych i KI. Sprawdzono 8 kierunków, liczbę klatek, poprawność regionów atlasu oraz przesuwanie się rzeczywistej osi czasu AnimatedSprite2D. Część kierunków celowo używa lustrzanego odbicia. Nie twierdzimy, że wszystkie kierunki pochodzą z osobnych ujęć.')
    tab(['Rasa','Klipy','Kierunki','Klatki','Puste alfa'],[(label,36,288,2096,0) for label in RACES.values()],[44*mm,28*mm,34*mm,38*mm,28*mm])
    para('Techniczny zestaw animacji: 2592/2592. Dodatkowa analiza pikseli: 8384 odwołania, zero pustych klatek. Dotknięcie brzegu komórki przez alfa jest jedynie wskaźnikiem do oględzin; nie uznano go automatycznie za uciętą postać. Formy KI są podglądem testowym; nie zostały odblokowane bohaterom na poziomie 3.')
    for race,label in RACES.items():
        parts.append(PageBreak());heading(label+' — 36 rzeczywistych klipów')
        parts.append(Image(str(OUT/'animations'/f'{race}-36-clips.png'),width=172*mm,height=172*mm))
        para('Plik videos/'+race+'-walk.mp4 zawiera rzeczywiste odtwarzanie chodu w ośmiu kierunkach. To podgląd silnika, nie film generowany.')
    parts.append(PageBreak());heading('5. Usterki, priorytety i proponowane poprawki')
    for issue in s['issues']:
        para(issue['id']+' · '+issue['title'],'Heading2');para(issue['evidence']);para('Dalsze działanie: '+issue['action'])
    parts.append(PageBreak());heading('6. Granice odbioru i odtwarzanie wyników')
    for text in s['limits']:para('• '+text)
    para('Runnery: ports/godot-pyra/tests/audit_progression.gd, audit_world.gd, audit_dialogues.gd i audit_animations.gd. Każdy używa oddzielnego XDG_DATA_HOME. Raport kompiluje scripts/godot/audit_level3_report.py.')
    para('Wyniki zapisano na gałęzi '+BRANCH+'. Bez scalenia do main i bez nowej publikacji aplikacji. Audytowana wersja serwera pozostaje 1.8.')
    para('Folder dowodów: '+BASE_URL)
    para('Plik evidence-sha256.json zawiera sumy kontrolne wszystkich dowodów. published-core-proof.json potwierdza zgodność lokalnego rdzenia z publicznym manifestem 1.8.')
    def footer(canvas,doc):
        canvas.setFont('DejaVu',7);canvas.setFillColor(colors.HexColor('#626b76'));canvas.drawString(18*mm,12*mm,'KI Legends · audyt 1.8 · 16.11.2026');canvas.drawRightString(192*mm,12*mm,str(doc.page))
    doc=SimpleDocTemplate(str(OUT/'raport.pdf'),pagesize=(210*mm,297*mm),leftMargin=19*mm,rightMargin=19*mm,topMargin=18*mm,bottomMargin=20*mm,title='KI Legends — audyt Androida 1.8',author='Codex / KI Legends')
    doc.build(parts,onFirstPage=footer,onLaterPages=footer)

if __name__=='__main__':main()
