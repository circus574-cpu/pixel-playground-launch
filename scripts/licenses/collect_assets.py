#!/usr/bin/env python3
"""Inventory tracked art, PDF images, declared external assets and models; never modify asset files."""
import csv, hashlib, io, json, pathlib, re, subprocess
ROOT=pathlib.Path(__file__).resolve().parents[2]; OUT=ROOT/'docs/licenses'
EXT={'.png','.jpg','.jpeg','.webp','.svg','.ico','.gif','.avif','.blend','.obj','.glb','.gltf','.fbx','.target','.mhw','.mhskel','.pdf','.ttf','.woff','.woff2','.otf','.safetensors','.ckpt','.ply','.stl','.mtl','.exr','.hdr','.ktx','.ktx2'}
def sha(b):return hashlib.sha256(b).hexdigest()
def profile(author,source,license,basis,evidence,status):return dict(authorOrGenerator=author,source=source,license=license,commercialBasis=basis,evidence=evidence,status=status)
PROFILES={
'PDF':profile('Autor tekstu/ilustracji nieustalony; dokument dostarczony przez właściciela','PDF właściciela; 10 unikalnych ilustracji','Brak udokumentowanej licencji na ilustracje','NIEPOTWIERDZONA: przekazanie PDF i zapis „przekazane przez autora” nie dowodzą praw','docs/INDEX.md; docs/ARCHITEKTURA-I-TESTY.md; evidence/pdf-images.json','BLOKADA_REFERENCJI'),
'REF':profile('Autor oryginalnej ilustracji nieustalony','Obraz JPEG osadzony w PDF właściciela','Nieustalona','NIEPOTWIERDZONA: potrzebna licencja/umowa autora na adaptacje i komercję','scripts/prepare_stage31_art.py; evidence/pdf-images.json','BLOKADA_REFERENCJI'),
'SAGE':profile('Deklarowane OpenAI image_gen + Blender/CUDA; autor referencji nieustalony','Referencja Mędrców z PDF → malowane widoki → deformacja 2D → atlas','Brak potwierdzonej licencji pierwowzoru; warunki generatora wymagają powiązania z sesją','NIEPOTWIERDZONA: zgoda wizualna nie licencjonuje pierwowzoru; CC0 pilota nie dotyczy tego stroju','art/production/heroes/sage/v3/sources/painted-design-provenance.json; docs/RASY-I-POSTACIE.md','BLOKADA_REFERENCJI'),
'PLANETARY':profile('Blender/CUDA, skrypty repo; master deklarowany Animagine XL 3.1; autor referencji nieustalony','Master img2img na podstawie origins-v1/planetary-full.webp; rig MakeHuman + własny strój','Baza MakeHuman CC0; model Open RAIL++-M; brak praw do pierwowzoru','NIEPOTWIERDZONA dla całości: CC0 siatki i licencja modelu nie obejmują cudzej ilustracji/postaci','art/production/heroes/planetary/v1/sources/planetary-master.json; scripts/gpu/animate_planetary.py; docs/RASY-I-POSTACIE.md','BLOKADA_REFERENCJI'),
'CC0':profile('MakeHuman Community / autorzy upstream','makehumancommunity/makehuman@a8bc2d54ff0ac92e78ff71431b1023eda42bf482','CC0-1.0 (wyłącznie dane assetów, nie aplikacja MakeHuman)','POTWIERDZONA w zakresie plików bazy: CC0 pozwala na komercję; nie obejmuje znaków ani praw osób trzecich','scripts/gpu/planetary-rig-base.json; evidence/source-receipts.json; evidence/makehuman-license.txt','ZWERYFIKOWANA_LICENCJA_BAZY'),
'OPENAI':profile('Deklarowane OpenAI built-in imagegen; wersja modelu nieujawniona','Generacja i eksport opisane w repo','Nie nadano SPDX grafice; warunki usługi + prawa do inputów niepowiązane z sesją','WARUNKOWA: udokumentować sesję/konto/obowiązujące warunki oraz prawa do wszystkich inputów','public/game/assets/README.md; docs/ZASADY.md; evidence/terms-openai.html','POCHODZENIE_OPISANE_PRAWA_NIEPOTWIERDZONE'),
'ANIME':profile('Deklarowane OpenAI built-in imagegen + Pillow/NumPy','Oddzielne obrazy materiałów/obiektów; eksport lokalny','Nie nadano SPDX grafice; brak dowodu warunków konkretnej generacji','WARUNKOWA: manifest/prompt/hash identyfikują pliki, nie umowę ani prawo do inputów','docs/GPU-I-ZASOBY.md; public/game/assets/anime-forest-v1/manifest.json; scripts/anime-sources.json; docs/ANIME-GENERATION-PROMPTS.json','POCHODZENIE_OPISANE_PRAWA_NIEPOTWIERDZONE'),
'FOREST':profile('Deklarowane OpenAI ImageGen + Pillow/NumPy','Cztery arkusze źródłowe, kadry, lokalny eksport forest-v3','Nie nadano SPDX grafice; brak dowodu warunków konkretnej generacji','WARUNKOWA: potrzebne oryginały i powiązanie generacji z warunkami/prawami do inputów','docs/GPU-I-ZASOBY.md; public/game/assets/forest-v3/manifest.json; scripts/build_forest.py','POCHODZENIE_OPISANE_PRAWA_NIEPOTWIERDZONE'),
'CANDIDATE':profile('Deklarowane OpenAI built-in imagegen + obróbka lokalna','Niezależne generacje kandydatów anime','Nie nadano SPDX grafice; prawa kontraktowe niepotwierdzone','WARUNKOWA: manifest i prompty nie są potwierdzeniem praw komercyjnych','art/candidates/anime-v1/README.md; art/candidates/anime-v1/manifest.json; art/candidates/anime-v1/prompts.json','POCHODZENIE_OPISANE_PRAWA_NIEPOTWIERDZONE'),
'LOVABLE':profile('Deklarowane narzędzie obrazów Lovable; dostawca/model/sesja nieustalone','Grafiki chmur i kosmosu dodane przez Lovable','Warunki usługi Lovable; brak powiązania tej generacji z kontem/warunkami','WARUNKOWA: aktualne warunki mówią o AI Output z zastrzeżeniem praw osób trzecich; nie dowodzą historii tych plików','docs/SWIAT-I-MIASTA.md; evidence/terms-lovable.html; Git 3830180','POCHODZENIE_OPISANE_PRAWA_NIEPOTWIERDZONE'),
'ATLAS':profile('Autor/generator atlasu niepotwierdzony','Malowany atlas planety Superior w repo; Git 0884ae1','Nieustalona','NIEPOTWIERDZONA: commit i własność projektu nie stanowią licencji na obraz','docs/SWIAT-I-MIASTA.md; Git 0884ae1','BRAK_DOWODU_PRAW'),
'GLOBE':profile('Lokalny skrypt Python/Pillow/SciPy; autor atlasu niepotwierdzony','Pochodna src/assets/planet-map/atlas-3840.webp','Dziedziczy nierozstrzygnięte prawa do atlasu','NIEPOTWIERDZONA: obróbka mapy nie usuwa praw do źródła','scripts/build_globe_textures.py; docs/SWIAT-I-MIASTA.md','BRAK_DOWODU_PRAW'),
'CODE':profile('Kod/skrypty repozytorium; autorzy według historii Git','Proceduralna geometria / eksport z kodu projektu','Brak osobnej licencji/umowy przeniesienia praw do grafiki w repo','WARUNKOWA: źródło odtwarzalne; potwierdzić uprawnienia do kodu i wkładów','scripts/build_stage3_worlds.py; scripts/create-technical-art.ts; historia Git','ODTWARZALNE_PRAWA_DO_WKLADOW_DO_POTWIERDZENIA'),
'QA':profile('Zrzut QA / kompozycja; autorzy grafiki widocznej wewnątrz według źródeł','Przeglądarka/render/filmstrip projektu','Pochodna widocznych zasobów; brak niezależnego oczyszczenia praw','NIE do niezależnej komercyjnej dystrybucji przed wyjaśnieniem praw przedstawionych zasobów','docs/qa/; e2e/; docs/ARCHITEKTURA-I-TESTY.md','DZIEDZICZY_STATUS_ZASOBOW'),
'UNKNOWN':profile('Nieustalony autor/generator','Plik repozytorium; brak dowodu źródła','Nieustalona','NIEPOTWIERDZONA: potrzebny oryginał i licencja/umowa','historia Git; brak dokumentu licencyjnego dla pliku','BRAK_DOWODU_PRAW'),
'EXTERNAL':profile('Nieustalony autor/generator','Metadane obiektu Lovable/R2; oryginalny obraz poza repo','Nieustalona','NIEPOTWIERDZONA: identyfikator/rozmiar/data uploadu nie nadają praw','src/assets/cover.png.asset.json; src/assets/test-background.png.asset.json','BRAK_DOWODU_PRAW'),
'ANIMAGINE':profile('Cagliostro Research Lab / autorzy bazowego SDXL','Hugging Face cagliostrolab/animagine-xl-3.1@483f0c322568ed13697ed01dd0be07204746d12b','CreativeML Open RAIL++-M według przypiętej karty modelu','WARUNKOWA: pozwolenie na komercję z ograniczeniami użycia; brak gwarancji praw do outputu/inputu','art/production/city-v1/model-source.json; evidence/animagine-readme.txt; evidence/animagine-base-license.txt','LICENCJA_MODELU_ODNALEZIONA_PRAWA_OUTPUTU_ODREBNE'),
'DREAM':profile('Deklarowany DreamShaper XL Turbo 2.1 / Lykon; pochodzenie checkpointu niezweryfikowane','GPU checkpoint wymieniony w historycznym raporcie','Nieustalona dla dokładnego checkpointu SHA','NIEPOTWIERDZONA: brak przypiętej karty/licencji/URL pliku; nie przenosić licencji Animagine','docs/zmiany/2026-10-21/qa/runtime-restore-20261021/models-verified.json','BRAK_LICENCJI_DOKLADNEGO_CHECKPOINTU')}

def classify(p):
    if p.endswith('.pdf'):return 'PDF'
    if p.startswith(('docs/qa/','docs/zmiany/')):return 'QA'
    if '/stage3/references/' in p:return 'REF'
    if '/origins-v1/' in p:return 'CANDIDATE' if p.endswith('loading-world.webp') else 'REF'
    if '/rig-base/' in p:return 'CC0'
    if '/heroes/planetary/' in p or '/gpu/hero-planetary/' in p:return 'PLANETARY'
    if '/heroes/sage/' in p or '/gpu/hero-sage/' in p:return 'SAGE'
    if '/anime-forest-v1/' in p:return 'ANIME'
    if '/forest-v3/' in p:return 'FOREST'
    if p.startswith('art/candidates/anime-v1/'):return 'CANDIDATE'
    if p.startswith('src/assets/planet-map/'):
        n=pathlib.Path(p).name
        return 'ATLAS' if n.startswith('atlas-') else 'LOVABLE' if n.startswith('globe-clouds') or n=='space.jpg' else 'GLOBE'
    if '/stage3/' in p or '/technical-v1/' in p or '/technical-rig/' in p or p.startswith('art/pipeline/examples/'):return 'CODE'
    if p.startswith(('art/races/','art/worlds/')):return 'UNKNOWN'
    if p.startswith('public/game/assets/'):return 'OPENAI'
    return 'UNKNOWN'

def main():
    paths=subprocess.check_output(['git','ls-files'],cwd=ROOT,text=True).splitlines();rows=[]
    for p in paths:
        if pathlib.Path(p).suffix.lower() not in EXT:continue
        b=(ROOT/p).read_bytes();kind=classify(p);r={'path':p,'profile':kind,**PROFILES[kind], 'bytes':len(b),'sha256':sha(b),'identityEvidence':'local bytes hashed; not evidence of rights'}
        if b.startswith(b'version https://git-lfs.github.com/spec/v1\n'):
            oid=re.search(rb'oid sha256:([0-9a-f]{64})',b).group(1).decode();size=int(re.search(rb'size (\d+)',b).group(1))
            r.update(sha256=oid,bytes=size,pointerSha256=sha(b),identityEvidence='LFS pointer OID/declared size only; binary not read in this audit')
        if kind in ('ANIME','FOREST'):
            manifest=json.loads((ROOT/pathlib.Path(p).parent/'manifest.json').read_text());obj=next((o for o in manifest.get('objects',[]) if o.get('name')==pathlib.Path(p).stem),None)
            if obj:r['source']+='; '+obj['source']
        if kind=='REF' and '/origins-v1/' in p:r['source']='public/game/assets/stage3/references/'+pathlib.Path(p).name.split('-')[0]+'.jpg → crop/resize WebP'
        rows.append(r)
    # External object references are included individually without pretending the image bytes are local.
    for name in ('cover.png','test-background.png'):
        p='src/assets/'+name+'.asset.json';m=json.loads((ROOT/p).read_text());rows.append({'path':m['url'],'profile':'EXTERNAL',**PROFILES['EXTERNAL'],'bytes':m['size'],'sha256':None,'identityEvidence':'descriptor only; original binary not retrieved','descriptor':p,'assetId':m['asset_id'],'createdAt':m['created_at']})
    pdf='docs/design/Ki_Legends_Dokument_Projektowy_Rasy_i_Etapy_Produkcji.pdf'
    listing=subprocess.check_output(['pdfimages','-list',str(ROOT/pdf)],text=True)
    prefix=pathlib.Path('/tmp/ki-license-inventory-pdf');subprocess.run(['pdfimages','-j',str(ROOT/pdf),str(prefix)],check=True)
    pdfrows=[]; bysha={r['sha256']:r['path'] for r in rows if '/stage3/references/' in r['path']}
    for line in listing.splitlines()[2:]:
        parts=line.split()
        if len(parts)<12 or parts[2]!='image':continue
        page,idx,obj=int(parts[0]),int(parts[1]),int(parts[10]);file=pathlib.Path(f'{prefix}-{idx:03d}.jpg');b=file.read_bytes()
        r={'path':pdf+f'#page={page}&image={idx}&object={obj}','profile':'REF',**PROFILES['REF'],'bytes':len(b),'sha256':sha(b),'identityEvidence':'pdfimages -j: exact embedded JPEG stream hashed','pdfPage':page,'pdfImageIndex':idx,'pdfObject':obj,'matchesTrackedReference':bysha.get(sha(b))}
        pdfrows.append(r);rows.append(r)
    (OUT/'evidence/pdf-images.json').write_text(json.dumps({'pdfSha256':sha((ROOT/pdf).read_bytes()),'imagePlacements':len(pdfrows),'uniqueImages':len({r['sha256'] for r in pdfrows}),'images':pdfrows},ensure_ascii=False,indent=2)+'\n')
    provenance=json.loads((ROOT/'art/production/heroes/sage/v3/sources/painted-design-provenance.json').read_text())
    for d,m in provenance['directional_masters'].items():rows.append({'path':m['path'],'profile':'SAGE',**PROFILES['SAGE'],'bytes':None,'sha256':m['sha256'],'identityEvidence':'manifest declaration only; path absent from this branch','availability':'DECLARED_ABSENT'})
    for m in json.loads((ROOT/'docs/zmiany/2026-10-21/qa/runtime-restore-20261021/models-verified.json').read_text()):
        kind='ANIMAGINE' if 'animagine' in m['path'] else 'DREAM';rows.append({'path':m['path'],'profile':kind,**PROFILES[kind],'bytes':m['bytes'],'sha256':m['sha256'],'identityEvidence':'historical report only; no GPU access/current binary hash performed','availability':'EXTERNAL_GPU'})
    # Embedded font license names are evidence from the actual PDF binary, not a package declaration.
    import fitz
    from fontTools.ttLib import TTFont
    fonts=[];seen=set();document=fitz.open(str(ROOT/pdf))
    for page in document:
        for font in page.get_fonts(full=True):
            xref=font[0]
            if xref in seen:continue
            seen.add(xref);name,extension,kind,data=document.extract_font(xref)
            entry={'xref':xref,'name':name,'extension':extension,'embeddedBytes':len(data),'sha256':sha(data) if data else None}
            if data:
                tt=TTFont(io.BytesIO(data));entry['names']={str(i):list(dict.fromkeys(n.toUnicode() for n in tt['name'].names if n.nameID==i)) for i in [0,8,13,14]}
                rows.append(dict(path=pdf+f'#embedded-font-xref={xref}',profile='PDF_FONT',authorOrGenerator='DejaVu fonts team; Bitstream Inc.; Tavmjong Bah',source='Font embedded in original PDF; extracted name-table copyright/license',license='Bitstream Vera + Arev font permissions; DejaVu changes public domain',commercialBasis='Commercial redistribution subject to full notices, naming restrictions and no standalone sale; embedded grant retained in PDF',evidence='evidence/pdf-fonts.json; evidence/PDF-FONT-NOTICES.txt',status='ZWERYFIKOWANY_TEKST_LICENCJI_W_PLIKU',sha256=sha(data),bytes=len(data),identityEvidence='Embedded font bytes extracted and hashed in this audit'))
            fonts.append(entry)
    (OUT/'evidence/pdf-fonts.json').write_text(json.dumps(fonts,ensure_ascii=False,indent=2)+'\n')
    font_notices=list(dict.fromkeys(text for font in fonts for text in font.get('names',{}).get('13',[])))
    (OUT/'evidence/PDF-FONT-NOTICES.txt').write_text('KI LEGENDS — PDF embedded DejaVuSans / DejaVuSans-Bold font notices\n\n'+'\n\n'.join(font_notices)+'\n')
    rows.sort(key=lambda r:r['path'])
    doc={'schemaVersion':1,'auditedBase':'d9599277924e6c3f1ce99b43e2a1b20654b42c22','date':'2026-10-22','trackedFileCount':sum(pathlib.Path(p).suffix.lower() in EXT for p in paths),'profiles':PROFILES,'assets':rows}
    (OUT/'asset-inventory.json').write_text(json.dumps(doc,ensure_ascii=False,indent=2)+'\n')
    columns=['path','authorOrGenerator','source','license','commercialBasis','evidence','status','sha256','bytes','identityEvidence','profile']
    with (OUT/'asset-inventory.csv').open('w',newline='') as f:
        w=csv.DictWriter(f,fieldnames=columns,extrasaction='ignore');w.writeheader();w.writerows(rows)
    print('Assets:',len(rows),'tracked:',doc['trackedFileCount'],'PDF unique:',len({r['sha256'] for r in pdfrows}))
if __name__=='__main__':main()
