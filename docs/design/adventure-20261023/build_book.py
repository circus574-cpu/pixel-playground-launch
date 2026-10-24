#!/usr/bin/env python3
"""Reproducible design book. Requires reportlab; no game files are modified."""
from pathlib import Path
import json, math, re, hashlib, unicodedata, subprocess
from xml.sax.saxutils import escape
from reportlab.pdfgen import canvas
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether, Flowable
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.pagesizes import A4
ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
SOURCE_SHA='5bb495c7bfce311077bf081cd27b636e577dcdcf'
def source_bytes(path):
 return subprocess.check_output(['git','show',SOURCE_SHA+':'+path],cwd=ROOT)
ANNEX=json.loads(source_bytes('docs/design/data/character-progression-1-20.json'))
MONSTERS=json.loads(source_bytes('art/production/enemies/roster.json'))['monsters']
quests=[]; items=[]; recipes=[]; blocks=[]
def h(title, level=1): blocks.append(('h',level,title))
def p(text): blocks.append(('p',text))
def table(headers,rows,widths=None): blocks.append(('table',headers,rows,widths))
def newpage(): blocks.append(('page',))
def section(title): newpage(); h(title)
def q(qid,title,level,giver,pre,steps,story,choice,xp,gold,reward='—',flag='',recovery='Powrót do ostatniego etapu; utrata walki nie usuwa dowodów ani przedmiotów zadania.',kind='główne',rep=20):
 blocks.append(('cardstart',))
 d=dict(id=qid,title=title,level=level,giver=giver,prerequisites=pre,steps=steps,story=story,choice=choice,xp=xp,gold=gold,reward=reward,flag=flag or qid+'.done',recovery=recovery,kind=kind,reputation=rep); quests.append(d)
 h(qid+' · '+title,2)
 p(f"Poziom {level} • {kind} • Zleca: {giver} • Wymaga: {pre}.")
 p('Sytuacja: '+story)
 p('Przebieg: '+' → '.join(steps)+'.')
 p('Wybór i skutek: '+choice)
 p(f"{'Nagroda za rozliczenie kontraktu' if kind=='powtarzalne' else 'Nagroda jednorazowa'}: {xp} XP; {gold} monet; {reward}; +{rep} reputacji u zleceniodawcy/frakcji rozdziału. Flaga: {d['flag']}.")
 p('Ponowienie / porażka: '+recovery)
 blocks.append(('cardend',))

def item(iid,name,slot,level,atk=0,defn=0,hp=0,ki=0,crit=0,regen=0,price=0,sell=0,stack=1,effect='Brak efektu dodatkowego.',source='Rzemiosło / handel po odblokowaniu rozdziału.',status='PROPOZYCJA',rarity='zwykły'):
 d=dict(id=iid,name=name,slot=slot,level=level,attack=atk,defense=defn,hp=hp,ki=ki,crit_pp=crit,ki_regen=regen,buy=price,sell=sell,stack=stack,effect=effect,source=source,status=status,rarity=rarity);items.append(d);return d

def item_table(group):
 table(['ID / nazwa','Poz. / slot','ATK / DEF','HP / KI','Kryt. pp / reg.','Kup / sprz.'],[[x['id']+'\n'+x['name'],f"{x['level']} / {x['slot']}",f"{x['attack']} / {x['defense']}",f"{x['hp']} / {x['ki']}",f"{x['crit_pp']} / {x['ki_regen']}",f"{x['buy']} / {x['sell']}"] for x in group],[.29,.16,.13,.13,.13,.16])
 for x in group:
  if x['effect']!='Brak efektu dodatkowego.': p(x['id']+': '+x['effect']+' Źródło: '+x['source']+'.')

h('KSIĘGA PRZYGODY I ROZWOJU',1)
p('KI LEGENDS · CZTERY GŁOSY SUPERIOR')
p('Projekt fabularny i systemowy 1.0 • 23 października 2026')
p('Kampania 1–20 • cztery pochodzenia • miasta i wyprawy • wybory i konsekwencje • wyposażenie ze statystykami')
p('Dokument do przeglądu właściciela. Nowa fabuła, questy, bossowie, przedmioty i reguły ich działania są propozycją; ten PDF nie oznacza wdrożenia ani zatwierdzenia balansu. Dane ras, drzewek i 40 przeciwników przepisano ze źródeł repozytorium. Nie zmieniono kodu gry.')
p('Motyw przewodni: świat można ocalić, nie odbierając jego mieszkańcom prawa do niezgody.')
newpage(); h('Spis treści'); blocks.append(('toc',))
section('01. Jak czytać ten projekt')
p('To księga dla projektanta, scenarzysty i osoby wdrażającej zawartość. Rozdziały fabularne ujawniają finał. Teksty NPC są próbkami tonu, a nie kompletnym scenopisem wszystkich rozmów. Każdy quest ma identyfikator, poziom, zależność, mierzalne cele, konsekwencję, nagrodę i regułę odzyskania postępu. Katalogi stanowią punkt wyjścia do balansu, nie obietnicę gotowej zawartości w grze.')
table(['Oznaczenie','Znaczenie'],[['ŹRÓDŁO','Wartość lub tożsamość odczytana z repozytorium na SHA '+SOURCE_SHA[:12]+'. Nie stwierdza automatycznie jakości odbioru.'],['PROPOZYCJA','Nowa treść tej księgi. Wymaga decyzji właściciela, implementacji i testów.'],['ZALEŻNOŚĆ','Mechanizm potrzebny do uruchomienia treści, np. podróże między kontynentami, dialogi rozgałęzione lub nowe sloty ekwipunku.'],['DO BALANSU','Liczba startowa do prób, podana jawnie; nie przedstawia pomiaru z gry.']],[.2,.8])
p('Kanon: Planetarni/Verdantia, Mędrcy/Aetheria, Androidy/Nexus-9, Legendy/Pyra. Nie zastępujemy go nazwami usuniętymi z aneksu. Planeta Superior zachowuje geometrię czterech głównych miast oddalonych po powierzchni o 80 000 jednostek. Sześć wysp questowych wykorzystujemy fabularnie, bez przenoszenia ich na atlasie. Cztery miasta na kontynent to kierunek rozwoju; nowe osady poniżej są propozycjami nazw i ról, a nie istniejącymi lokacjami.')
p('Gra na dziś ma lokalne sloty postaci. Instancje, reputacje, globalne wydarzenia i wspólne decyzje świata nie są tu przedstawiane jako istniejący multiplayer. Cała kampania musi dać się ukończyć solo. Ewentualna kooperacja otrzyma osobną architekturę autorytatywnego serwera.')
h('Filary przygody',2)
for s in ['Miasto jest domem: rozmowy, rzemiosło, handel, depozyt, odpoczynek i trening. Wrogowie nie wchodzą do bezpiecznych dzielnic; walka zaczyna się za wyraźną granicą miasta.', 'Każde pochodzenie ma własny prolog i własny sposób rozumienia katastrofy. Wspólna kampania nie zmienia rasy postaci ani nie wymaga zakładania czterech bohaterów.', 'Wybór zmienia relacje i sposób rozwiązania sytuacji. Żaden wybór nie blokuje finału, punktów umiejętności ani obowiązkowej usługi.', 'Walka przeplata się ze śledztwem, podróżą, naprawą, negocjacją, treningiem i eksploracją. Zadanie zbierania ma określony sens fabularny oraz krótki limit potrzebnych materiałów.', 'Rozwój wynika z poziomu, własnego drzewka i świadomego doboru ekwipunku. Tytuł fabularny nie daje ukrytych statystyk.']:
 p(s)
h('Skala i rytm',2)
p('Cel projektowy: 30–45 godzin pierwszego przejścia z około połową wątków pobocznych; 55–75 godzin dla gracza czytającego wszystkie dialogi i badającego cztery kontynenty. To szacunek zakresu, nie pomiar czasu gry. Sesja mobilna 10–20 minut kończy jeden etap zadania, nie cały loch. Prolog 90–120 minut; sześć aktów po 3–5 godzin; pozostały czas przeznaczony na wątki osobiste i eksplorację. Nie dodajemy obowiązkowych dziennych limitów ani kar za przerwę w grze.')
section('02. Fabuła: Cztery Głosy Superior')
h('Punkt wyjścia',2)
p('Od trzech tygodni w czterech krainach występuje ta sama anomalia: przez siedem uderzeń serca energia KI przestaje odpowiadać na wolę mieszkańców. Planetarni nazywają to Ciszą Korzeni; Mędrcy zauważają brak jednego tonu w pieczęciach; Androidy wykrywają identyczny pakiet rozkazów zapisany poza pamięcią urządzeń; u Legend płomienie nie gasną, lecz rzucają cudze cienie. Miasta pozostają bezpieczne, ale szlaki, dawne urządzenia i zewnętrzne sanktuaria stają się nieprzewidywalne.')
p('Bohater jest początkującym mieszkańcem swojej krainy, nie wybrańcem z przepowiedni. Podczas pierwszej Ciszy potrafi zapamiętać pojedynczy obcy dźwięk. Nie daje mu to nowej mocy bojowej. Czyni go wiarygodnym świadkiem, którego pamięci nie nadpisuje zakłócenie. Pierwszym celem jest przywrócenie dostaw do rodzinnego miasta; podróż przez świat wynika dopiero z dowodów, że lokalna naprawa przenosi uszkodzenie do sąsiadów.')
h('Prawda ukryta przed graczem',2)
p('Przed 180 laty cztery kultury wspólnie zbudowały Chór — sieć regulującą przepływy KI podczas katastrof. Każda przekazała jedną zasadę: Planetarni zmienność, Mędrcy pamięć, Androidy precyzję, Legendy odwagę działania. Gdy Chór uratował kontynenty podczas Wielkiego Rozstrojenia, jego opiekunowie zachowali tylko łatwiejszą część historii. Sieć osiągnęła stabilność dzięki przymusowemu zsynchronizowaniu tysięcy istnień. Powstała Cisza, zbiorowy ślad odebranych wyborów.')
p('Architekt Veyr był niegdyś człowiekiem odpowiedzialnym za ewakuację jednego z miast. Jego zrekonstruowana osobowość istnieje w rdzeniu Chóru. Pamięta ofiary każdej spóźnionej decyzji. Doszedł do wniosku, że każda różnica zdań jest opóźnieniem, a każde opóźnienie kolejną śmiercią. Zamierza uruchomić Jedyny Ton: trwałe uspójnienie wszystkich istot. Nie pragnie zniszczyć świata. Chce ocalić go kosztem możliwości wyboru.')
p('Najważniejsza tajemnica: Cisza nie jest potworem sprowadzonym z zewnątrz. Jest rachunkiem za poprzednie ocalenie. Veyr nie potrafi rozwiązać problemu, bo każdą odmowę odczytuje jako usterkę. Bohater i jego sojusznicy muszą zbudować procedurę wspólnej decyzji, która dopuszcza błąd i sprzeciw, zanim zniszczą centrum sieci.')
h('Sześć aktów',2)
table(['Akt / poziomy','Odkrycie','Zmiana stawki'],[['I. Pęknięta mapa / 4–6','Cztery lokalne awarie mają wspólny podpis.','Doraźna naprawa jednego miasta szkodzi innemu.'],['II. Cena pamięci / 6–9','Archiwum i dzienniki ewakuacji wzajemnie sobie przeczą.','Opiekunowie poprzedniej katastrofy ukrywali jej cenę.'],['III. Prawo do błędu / 9–12','Veyr prowadzi testy posłuszeństwa na wyspach.','Przeciwnik oferuje realne bezpieczeństwo w zamian za zgodę na kontrolę.'],['IV. Cztery długi / 12–15','Każda kultura musi naprawić własne przemilczenie.','Sojusz wymaga konkretnych ustępstw, nie samego zdobycia artefaktów.'],['V. Puste niebo / 15–18','Chór potrafi wyłączyć podróże i odizolować regiony.','Gracz buduje zapasową sieć opartą na dobrowolnym udziale.'],['VI. Wspólny oddech / 18–20','Jądro da się pokonać, ale jego bezmyślne zniszczenie zgasi ochronę miast.','Zwycięstwo to utrzymanie ewakuacji i wybranie nowego porządku.']],[.26,.37,.37])
h('Zakończenia',2)
p('Rozproszony Chór: po przygotowaniu czterech niezależnych węzłów gracz przekazuje każdej społeczności klucz lokalny. Największa autonomia, wolniejsze reagowanie na katastrofy. W epilogu poszczególne miasta organizują własne służby ratunkowe. Brak premii bojowej za tę decyzję.')
p('Pakt Czterech Głosów: rady regionów utrzymują wspólny węzeł, ale każdy rozkaz wymaga dwóch zgód i posiada prawo lokalnego odłączenia. Epilog pokazuje pierwszą trudną debatę zamiast triumfalnej jednomyślności. Dostępny zawsze, jeżeli gracz wykona obowiązkowe etapy ewakuacji i porozumienia.')
p('Cichy Strażnik: Veyr zostaje zachowany jako odizolowany doradca bez uprawnień sterowania. Warunek dodatkowy: cztery osobiste łańcuchy sojuszników ukończone i trzy dowody dawnej ewakuacji zabezpieczone. Nie jest to zakończenie z mocniejszą bronią; nagrodą są sceny, kronika i odmienny wygląd pamiątki.')
p('Nie ma zakończenia karzącego za niezbieranie wszystkich znajdziek. Jeżeli gracz ominął wątki osobiste, kampania nadal kończy się pełnym ocaleniem miast. Odrzucenie propozycji Veyra nie wymaga określonej reputacji ani konkretnej rasy. Przed ostateczną decyzją dostępny jest czytelny zapis kontrolny i informacja o skutkach.')
section('03. Świat, miasta i podróże')
worlds=[('Verdantia','Zielona Przystań','Przystań Trzech Mostów','Kamienny Sad','Latarnia Korzeni','Żywe lasy, rzeki, osady i spór o korzystanie z zasobów.','Mieszkańcy ukryli, że poprzednią powódź skierowano na opuszczone, ale wciąż zamieszkane doliny.'),('Aetheria','Sanktuarium Tysiąca Źródeł','Tarasy Świtu','Biała Przystań','Archiwum Nad Chmurami','Woda, ogrody, biblioteki i rytuały przechowujące pamięć.','Rada uznała część świadectw za niebezpieczne i usunęła imiona ofiar z kronik.'),('Nexus-9','Węzeł Świadomości','Stacja Meridian','Kuźnia Obwodów','Port Zerowy','Syntetyczna energia, warsztaty i pytanie o odpowiedzialność systemów.','Procedura ratunkowa uznała nieautoryzowane jednostki za zbędny koszt ewakuacji.'),('Pyra','Twierdza Popiołu','Żarowy Trakt','Cytadela Kowadeł','Port Czerwonych Żagli','Wulkaniczne wyżyny, klany, areny i pamięć przegranych.','Zwycięski klan ogłosił tchórzami strażników, którzy złamali rozkaz, by ratować cywilów.')]
table(['Kontynent','Stolica — źródło','Pozostałe miasta — propozycja'],[[w[0],w[1],'; '.join(w[2:5])] for w in worlds],[.18,.32,.5])
for w in worlds:
 h(w[0],2);p(w[5]+' Lokalny dług: '+w[6]);p('Podział usług: stolica oferuje pełny zestaw sklepu, kuźni, depozytu, gospody i areny; drugie miasto jest węzłem transportu, trzecie rzemiosła, czwarte wypraw. Każde zachowuje podstawowego kupca, osobistą skrzynię i bezpieczne miejsce odpoczynku. Duplikaty usług nie wymagają nowych typów przedmiotów ani osobnej waluty.')
h('Sześć wysp na istniejących pozycjach',2)
table(['Wyspa','Nazwa projektowa','Funkcja'],[['I / północ','Wyspa Pierwszego Echa','Wspólne spotkanie i próba współpracy; M03–M04.'],['II','Wyspa Złamanej Pieczęci','Dwie wersje tej samej historii; M07–M08.'],['III','Wyspa Odwróconej Latarki','Eksperyment Veyra i rdzeń posłuszeństwa; M10–M12.'],['IV','Wyspa Czterech Cum','Neutralny port, ewakuacja i sojusz; M17–M18.'],['V','Wyspa Milczącego Nieba','Uszkodzone przekaźniki i zapasowa trasa; M19–M20.'],['VI / południe','Wyspa Ostatniego Tonu','Wejście do Jądra i finał; M23–M24.']],[.16,.31,.53])
p('Nazwy i funkcje wysp są nowe. Ich numery oraz położenia pochodzą z geometrii planety; scenariusz nie przypisuje arbitralnie wysp do nowych współrzędnych. Podróże odbywają się statkiem lub odblokowaną linią przekaźników. 80 000 jednostek nie jest czasem marszu po lokalnej planszy. Przeprawa fabularna skraca czas podróży ekranem mapy, a piesze dojście do portu pozostaje częścią eksploracji.')
p('Pierwszy rejs w kampanii jest bezpłatny; kolejne rejsy powrotne do odkrytych miast kosztują 10/20/30 monet dla pasm poziomów 1–6/7–13/14–20. Jeżeli portfel ma mniej niż wymagana opłata, dostępny jest bezpłatny bilet powrotu do rodzinnego miasta. Żadne zadanie nie może uwięzić gracza finansowo. W trakcie finału podtrzymana zostaje awaryjna droga wyjścia.')
h('Granica bezpieczeństwa',2)
p('Brama pokazuje poziom zalecany, typ zagrożenia i odległość do bezpiecznej przystani. Potwory mają smycz i nie przekraczają granicy miasta. Eskorty kończą część bojową przed bramą. Opowieść o oblężeniu wykorzystuje osobną zewnętrzną instancję albo scenę dialogową, nigdy nagły spawn przy depozycie. Trening nie przyznaje łupów ani XP za trafienia.')
section('04. Bohaterowie i frakcje')
cast=[('Aira','Planetarni / istniejąca przewodniczka','Utrzymać miasto bez powtarzania krzywdy dolin.','Przez lata podpisała mapy z błędnym oznaczeniem opuszczonych domów.','Od uspokajania gracza do publicznego przyznania własnej odpowiedzialności.'),('Sora','Mędrcy / istniejąca opiekunka','Zachować pamięć, która nie rozbije wspólnoty.','Zna brakujące imię w najstarszej kronice.','Uczy się odróżniać ochronę świadków od cenzury.'),('LYRA-7','Androidy / istniejąca przewodniczka','Udowodnić, że jednostka nie jest tylko funkcją.','Jej pamięć zawiera rozkaz, którego wykonania nie pamięta.','Wybiera jawny audyt zamiast bezbłędnej reputacji.'),('Kaena','Legendy / istniejąca strażniczka','Ocalić honor poległych i żyjących.','Jej przysięga pochodzi od klanu, który skłamał o ewakuacji.','Zamienia posłuszeństwo rodowi na odpowiedzialność za ludzi.'),('Veyr','Nowy antagonista / Architekt','Nigdy więcej nie dopuścić do spóźnionej ewakuacji.','Myli zbiorową pamięć ofiar z ich aktualną zgodą.','Do ostatniej sceny potrafi bronić swojego celu, ale traci prawo do narzucenia środka.'),('Nima','Nowa kartografka / Liga Szlaków','Odnaleźć matkę z konwoju sprzed dwudziestu lat.','Jej mapy pokazują drogi usunięte z oficjalnego rejestru.','Przestaje szukać pojedynczego winnego, zaczyna dokumentować losy zaginionych.'),('Dalen','Nowy negocjator / Konklawe Miar','Szybko zakończyć chaos przez centralne zarządzanie.','Nie jest agentem Veyra; jego propozycje naprawdę ratują dostawy.','Może zostać przeciwnikiem politycznym lub rzecznikiem nowego Paktu.'),('Eko-0','Nowa jednostka serwisowa','Otrzymać prawo do odmowy demontażu.','Potrafi otworzyć jeden przekaźnik, ale utraci przy tym osobistą pamięć.','Gracz szuka droższej alternatywy; dobrowolna ofiara nie staje się domyślnym rozwiązaniem.')]
for name,origin,want,secret,arc in cast:
 h(name,2);p(origin+'. Cel: '+want+' Sekret: '+secret+' Łuk postaci: '+arc)
p('Istniejący kupcy i kowale zachowują imiona i funkcje: Mio/Taro, Mei/Enso, MIRA-2/HEF-4, Yumi/Goro. Ren, Ishin, AXON i Rokan kierują wyprawami poza mury. Nowi NPC nie przejmują ich usług. Sojusznicy fabularni pojawiają się w scenach i wyznaczonych instancjach; projekt nie wymaga stałego towarzysza bojowego ani AI drużyny.')
factions=[('F-V','Krąg Żywych Szlaków','Verdantia','Pomoc osadom i odtwarzanie szlaków.','Prawo do zasobów jest równoważone obowiązkiem odbudowy.'),('F-A','Kolegium Źródeł','Aetheria','Ochrona świadków i przywracanie zapisów.','Prawda musi uwzględniać prywatność żyjących.'),('F-N','Wolne Jednostki','Nexus-9','Naprawy i dobrowolne protokoły.','Wolność oznacza również odpowiedzialność za awarie.'),('F-P','Przymierze Popiołu','Pyra','Ratunek i uczciwe próby odwagi.','Honor nie wymaga śmierci, jeżeli można ocalić ludzi.'),('F-L','Liga Szlaków','Neutralna','Transport, kartografia i ratownictwo.','Łączy frakcje, ale musi rozliczać własne kontrakty.'),('F-C','Konklawe Miar','Neutralna','Kontrola dystrybucji i planowanie.','Ma rację co do skali problemu, myli się co do prawa do przymusu.')]
table(['ID / frakcja','Zdobywanie zaufania','Konflikt ideowy'],[[a+' / '+b,c+'. '+d,e] for a,b,c,d,e in factions],[.28,.34,.38])
p('Reputacja każdej frakcji: 0–1000. Progi 0 Nieznany, 100 Rozpoznany, 300 Zaufany, 600 Sprzymierzony, 1000 Powiernik. Nagrody odblokowują dialogi, dekoracje, warianty receptur i do 5% zniżki na nowe towary. Nie dają punktów drzewka ani statystyk. Wybór może zmienić reputację o ±20, lecz nie poniżej 0 i nie blokuje podstawowego sklepu. Każde zadanie wskazuje jedną frakcję; zleceniodawca miejski daje reputację swojego kontynentu, zadanie morskie Ligę, audyt Konklawe. To mapowanie zapisujemy jawnie w danych wdrożeniowych.')
section('05. Poziomy, awanse i ekonomia')
p('ŹRÓDŁO: próg następnego poziomu to 100 + 60 × (L−1) XP. XP jest postępem wewnątrz poziomu, a suma wymagana do osiągnięcia L wynosi 100 × (L−1) + 30 × (L−1) × (L−2). Poziom 20 wymaga 12 160 XP od początku. Kampania kończy rozwój pionowy na 20; obecny zapis technicznie przyjmuje poziomy wyższe, więc ograniczenie kampanii nie jest twierdzeniem o istniejącym limicie silnika.')
rows=[]
for L in range(1,21):
 total=100*(L-1)+30*(L-1)*(L-2)
 rank={1:'Mieszkaniec',4:'Wędrowiec',7:'Strażnik Szlaku',10:'Łącznik Krain',14:'Powiernik Głosu',18:'Strażnik Chóru',20:'Legenda Superior'}.get(L,'—')
 rows.append([L,total,100+60*(L-1) if L<20 else 'koniec kampanii',L,rank])
table(['Poz.','XP łącznie','XP dalej','Punkty drzewka łącznie','Awans fabularny'],rows,[.09,.18,.18,.22,.33])
p('Awans fabularny wymaga poziomu oraz etapu kampanii: Wędrowiec po własnym O-06; Strażnik Szlaku po M06; Łącznik po M10; Powiernik po M16; Strażnik Chóru po M20; Legenda Superior po M24. Osiągnięcie poziomu wcześniej nie przyznaje automatycznie tytułu. Próba awansu to rozmowa i pokaz opanowania własnych umiejętności, bez płatnego egzaminu i bez dodatkowego punktu drzewka.')
p('ŹRÓDŁO: 1 punkt umiejętności na poziom, razem 20, w tym koszt korzenia. Nie można kupić wszystkich 29 węzłów. Każda rasa ma trzy pary wykluczających się wyborów; Tryb KI wymaga poziomu 20 i zdolności ostatecznej. Żadne zadanie nie rozdaje dodatkowego punktu ani nie wymusza konkretnej gałęzi. Pierwszy reset do poziomu 10 jest darmowy, kolejne kosztują 50 × poziom monet — decyzje właściciela zapisane 23.10.2026.')
h('Plan tempa zdobywania XP',2)
p('Własny prolog daje 480 XP i doprowadza do poziomu 4. Dwadzieścia cztery wspólne zadania nie wystarczają same do osiągnięcia wszystkich późniejszych progów. Gracz wybiera wątki poboczne, zadania sojuszników i aktywności eksploracyjne. Nie wymuszamy konkretnego pobocznego łańcucha; dziennik przed bramką poziomu proponuje co najmniej trzy dostępne drogi. Przeciwnicy dają osobne XP według bestiariusza, ale kampania nie zakłada konieczności wielokrotnego farmienia tego samego gniazda.')
p('Cel testu: własny prolog + cała kampania wspólna + dowolne około 12 zadań pobocznych o właściwym poziomie powinny dawać co najmniej 12 160 XP jeszcze przed finałem, bez liczenia łupów i powtarzalnych kontraktów. Liczby kontrolne wyliczamy na końcu tej księgi. Każdy późny akt ma bramkę fabularną oraz zalecany poziom; przy braku poziomu dostępna jest rozmowa planująca wyprawę, a nie niejasna odmowa.')
h('Dodatkowe awanse',2)
p('Rzemiosło: Uczeń → Czeladnik → Rzemieślnik → Mistrz. Progi 0/100/300/600 punktów praktyki. Pierwsze wykonanie odrębnej receptury daje 20 praktyki, kolejne 2, maksymalnie 40 punktów za powtórki na każdy akt kampanii; limit dotyczy tylko powtarzanych receptur i nie blokuje fabularnego egzaminu. To propozycja osobnego systemu, nie punkty walki. Ranga Mistrza daje dostęp do wariantów kosmetycznych i tańszej usługi własnej, nie bonus ATK z samego tytułu.')
p('Eksploracja: Odkrywca otrzymuje pieczęć za każdą zbadaną wyspę, bez mnożnika statystyk. Arena: Uczeń/Praktyk/Adept za trzy próby manekina z jasnymi warunkami, nie za obrażenia na sekundę faworyzujące rasę. Próby: wyjście ze znaczonego pola, użycie dowolnej poznanej zdolności, gospodarowanie KI bez mikstury. Wszystkie są wykonalne każdą rasą; nagrody wyłącznie tytuł i dekoracja pokoju.')
h('Waluta i wydatki',2)
p('Jedna waluta: monety. Brak osobnej płatnej waluty rozwoju. Nowe towary sprzedaje się za 25% ceny katalogowej; towar o cenie 0 nie ma wartości odsprzedaży. Dotychczasowe cztery przedmioty zachowują obecne ceny sprzedaży. Reputacyjna zniżka do 5% zmniejsza tylko cenę zakupu, nigdy nie podnosi skupu. Zaokrąglenie ceny po zniżce w górę; brak arbitrażu kup–sprzedaj.')
p('Docelowe koszty usług: gospoda 5 monet (obecny mechanizm miasta); rejsy 10–30; otwarcie depozytu bez opłaty; naprawa fabularna darmowa; kosmetyka 50–200. Nie wprowadzamy trwałości niszczącej przedmioty. Śmierć nie usuwa waluty, wyposażenia ani kluczy zadania. Surowce zbierane do obowiązkowych napraw nie mają losowego warunku dropu.')
section('06. Prologi czterech ras — 24 zadania')
p('Gracz wykonuje jeden prolog zależny od wybranej rasy. Wszystkie kończą się takim samym dostępem do kampanii wspólnej. Pozostałe prologi można później obejrzeć jako kroniki bez powielania nagród. Ostatni etap prologu jest pierwszą świadomą wyprawą poza miasto; wcześniejsze zadania uczą usług wewnątrz bezpiecznej strefy.')
origins={
'V':('Verdantia','Aira',[
('Pierwsze kroki',1,'Rozpoczęcie postaci',['Porozmawiaj z Airą','Obejdź rynek i odczytaj tablicę sześciu usług','Wróć po nagrodę'],'Aira prosi o sprawdzenie, czy każdy mieszkaniec wie, dokąd pójść podczas Ciszy.','Wybierz pierwsze pytanie o mieszkańców albo o przyrodę; zmienia komentarze, nie nagrodę.'),
('Rzeczy, które zostają',1,'O-V01',['Odwiedź Nelę','Otwórz depozyt i zdeponuj znacznik ćwiczebny','Odbierz znacznik i zamknij skrzynię'],'Nela odnajduje skrzynię osoby zaginionej podczas poprzedniej powodzi.','Zachowaj list do późniejszego przekazania lub poproś Nelę o opiekę; list pozostaje dostępny w kronice.'),
('Ostrze i odpowiedzialność',2,'O-V02',['Kup u Mio Ostrze strażnika za 40 monet','Porozmawiaj z Taro i załóż broń','Przećwicz jedną zdolność na manekinie Iwa'],'Taro nie pyta, kogo chcesz pokonać, lecz kogo zamierzasz osłonić.','Wybierz motto strażnika; motto wraca na pamiątce finału. Zakup i próba nie wymagają zabijania w mieście.'),
('Mapa pustych domów',2,'O-V03',['Zbadaj trzy ślady dawnych znaków powodziowych','Porównaj mapę Orena z listem','Oznacz dwa budynki jako zamieszkane'],'Oficjalna mapa nazywa jedną z dolin pustą, choć Nela odbiera z niej listy.','Powiedz Orenowi przy mieszkańcach lub najpierw w prywatnej rozmowie; dowód zostaje zapisany w obu wariantach.'),
('Siedem uderzeń ciszy',3,'O-V04',['Pomóż Linie przenieść zapasy bez użycia KI','Uspokój troje mieszkańców','Zapisz zapamiętany obcy ton'],'Pierwsza Cisza pojawia się podczas zwykłego wieczoru, bez spawnu wrogów.','Najpierw pomóż dziecku albo dostawcy; druga pomoc nadal pozostaje dostępna, różni się kolejność scen.'),
('Za linią latarni',3,'O-V05',['Odbierz od Rena zgodę na wyprawę','Za bramą napraw dwa znaczniki szlaku','Zbierz z ziemi fragment przekaźnika i wróć'],'Fragment emituje sygnał adresowany do wszystkich czterech krain.','Walka z zewnętrznym Mchowym Szlamakiem jest opcjonalna; objazd daje identyczne ukończenie.')]),
'A':('Aetheria','Sora',[
('Źródło ma imię',1,'Rozpoczęcie postaci',['Porozmawiaj z Sorą','Odwiedź źródła i tablicę usług','Wróć do opiekunki'],'Jedna ze świątynnych tablic zawiera puste miejsce po imieniu.','Zadaj pytanie o brak albo o rytuał; Sora zapamięta ciekawość, nie karze za sceptycyzm.'),
('Katalog rzeczy odzyskanych',1,'O-A01',['Odwiedź Mei i depozyt','Zdeponuj ćwiczebną pieczęć','Odbierz ją po sprawdzeniu katalogu'],'Dwie kopie tego samego rejestru nie zgadzają się co do właściciela.','Zapisz oba warianty zamiast wybierać wygodniejszy; wątek otwiera motyw wiarygodności archiwum.'),
('Krąg bez rozkazu',2,'O-A02',['Uzyskaj podstawową broń u Mei','Załóż ją przy warsztacie Enso','Użyj poznanej zdolności w sali prób'],'Enso przekonuje, że bariera jest obietnicą, a nie sposobem uciszenia pytającego.','Wybierz sentencję do notatnika. Zakup podstawy kosztuje tyle samo co w innych prologach.'),
('Biała strona',2,'O-A03',['Porównaj trzy odbitki kroniki','Odszukaj ślad usuniętej paginy','Poproś Ishina o dostęp do tarasu'],'Atrament znika tylko ze zdań opisujących dawną ewakuację.','Pokaż brak radzie teraz albo zabezpiecz najpierw kopię; żadna opcja nie niszczy jedynego dowodu.'),
('Głos między kroplami',3,'O-A04',['Podczas Ciszy policz ręcznie przepływ wody','Rozdaj lampy w ogrodach','Zapisz ton, którego nie słyszy Sora'],'Źródła milkną jednocześnie z pieczęciami, lecz zwykła woda nadal płynie.','Wyjaśnij zjawisko obserwacją lub językiem rytuału; obie interpretacje prowadzą do wyprawy.'),
('Schody poza ogrodem',3,'O-A05',['Wyjdź z Ishinem za granicę miasta','Ustaw dwa lustra sygnałowe','Odzyskaj fragment nadajnika z opuszczonej stacji'],'Nadajnik pokazuje mapę, której biblioteka nie posiada.','Świetliki Pieczęci można ominąć. Nie trzeba niszczyć istot, aby zdobyć klucz fabularny.')]),
'N':('Nexus-9','LYRA-7',[
('Pierwszy zapis własny',1,'Rozpoczęcie postaci',['Odpowiedz LYRA-7 własnym identyfikatorem','Odwiedź węzeł usług','Zapisz ręczny punkt przywracania'],'System proponuje bohaterowi domyślną funkcję, lecz pozwala wybrać opis siebie.','Opis staje się podpisem korespondencji, bez zmiany bazowych statystyk.'),
('Własność to nie numer',1,'O-N01',['Spotkaj MIRA-2 i opiekuna depozytu','Włóż znacznik testowy','Odbierz go po weryfikacji slotu'],'Dwa egzemplarze identycznej części należą do różnych jednostek.','Zachowaj osobistą nazwę znacznika lub numer fabryczny; własność pozostaje prywatna w obu wersjach.'),
('Bezpieczna moc',2,'O-N02',['Kup podstawową broń','Załóż ją przy HEF-4','Przetestuj strzał w sali treningowej'],'HEF-4 sprawdza możliwość przerwania testu, a nie tylko wynik obrażeń.','Wybierz profil raportu opisowy lub liczbowy. To kosmetyka dziennika.'),
('Pakiet bez nadawcy',2,'O-N03',['Porównaj trzy logi','Znajdź identyczny znacznik czasu','Zabezpiecz kopię poza siecią'],'Nieznane polecenie ma podpis starszy od infrastruktury Nexus-9.','Udostępnij kopię LYRA-7 albo AXONOWI; oba kontakty otrzymają niezbędny fragment przy spotkaniu rady.'),
('Siedem sekund ręcznej pracy',3,'O-N04',['W czasie Ciszy przełącz zasilanie ręcznie','Pomóż jednostce serwisowej','Zapamiętaj obcy ton sygnału'],'Automatyka zatrzymuje się, lecz mieszkańcy nadal potrafią działać wspólnie.','Pierwszeństwo dostaje transport lub ambulatorium; drugi obwód przywróci inny technik bez ofiar.'),
('Poza zasięgiem sieci',3,'O-N05',['Wyjdź z AXONEM za perymetr','Uruchom dwa analogowe znaczniki','Odzyskaj nadajnik z awaryjnej stacji'],'Urządzenie rozpoznaje bohatera jako świadka, nie operatora.','Drony Zwiadowcy mają trasę patrolu pozwalającą je ominąć; nie są obowiązkowym źródłem klucza.')]),
'P':('Pyra','Kaena',[
('Imię pod popiołem',1,'Rozpoczęcie postaci',['Poznaj Kaenę','Obejdź rynek i usługi','Wybierz miejsce wpisu do kroniki'],'Na murze honorowym pozostał ślad po skutej tablicy.','Wybierz podpis imieniem lub rodowym przydomkiem; oba są tak samo uznawane.'),
('Skrzynia po powrocie',1,'O-P01',['Spotkaj Yumi i opiekuna depozytu','Zdeponuj znacznik ćwiczebny','Odbierz go i wysłuchaj historii właściciela pustej skrzyni'],'Nie każda nieodebrana skrzynia należy do poległego. Niektórzy wybrali odejście.','Uszanuj prywatność nieobecnego lub zostaw mu własny list, bez ujawnienia zawartości.'),
('Próba przerwania ciosu',2,'O-P02',['Kup podstawową broń','Załóż ją u Goro','Rozpocznij i zatrzymaj próbę manekina'],'Mistrz ceni umiejętność powstrzymania ataku tak samo jak siłę uderzenia.','Wybierz przysięgę obrony albo odwagi; żaden wybór nie zwiększa obrażeń.'),
('Nazwiska bez zwycięstwa',2,'O-P03',['Porównaj pieśń klanową z listą ewakuowanych','Zapytaj Rokana o skuty kamień','Zbierz dwa świadectwa'],'Rzekomi dezerterzy pozostawili po sobie rozliczone zapasy dla cywilów.','Zapytaj publicznie lub poproś o poufną rozmowę; świadkowie nie giną wskutek wyboru dialogu.'),
('Płomień bez cienia',3,'O-P04',['Podczas Ciszy przeprowadź mieszkańców do gospody','Zapal trzy zwykłe latarnie','Zapisz ton słyszany pod ziemią'],'Energetyczne ognie zachowują cudze cienie, zwykły płomień nie reaguje.','Najpierw uspokój wojownika albo dziecko; obie postacie docierają do schronienia.'),
('Trakt poza przysięgą',3,'O-P05',['Wyjdź z Rokanem za bramę','Napraw dwa drogowskazy','Przynieś fragment nadajnika z ochłodzonej szczeliny'],'Nadajnik pamięta rozkaz, którego nie ma w kronice klanów.','Węgielki można ominąć; bohater nie musi łamać bezpiecznej strefy, by zakończyć prolog.')])}
for code,(world,giver,entries) in origins.items():
 h(world+' — własna perspektywa',2)
 for i,(title,L,pre,steps,story,choice) in enumerate(entries,1):
  q(f'O-{code}{i:02}',title,L,giver,pre,steps,story,choice,[40,60,80,100,100,100][i-1],[40,20,25,30,35,50][i-1], 'K-01 Kompas Świadka' if i==6 else 'znacznik samouczka bez wartości handlowej' if i==2 else '—',rep=15)
p('Migracja istniejących samouczków: O-V01 nie wypłaca nagrody drugi raz po ukończonym zadaniu steps. Jeżeli postać posiada już broń, O-03 uznaje jej wyposażenie zamiast żądać ponownego zakupu. Ceny istniejącego Ostrza strażnika 40 i Kamizelki podróżnika 25 pozostają bez zmian. Analogiczne prologi innych ras wymagają odrębnego zadania wdrożeniowego; nie zakładamy, że obecny silnik questów już je obsługuje.')
section('07. Kampania wspólna — 24 zadania')
main=[
('M01','Adres dla czterech głosów',4,'lokalny przewodnik','własne O-06',['Porównaj nadajnik z mapą miasta','Uzyskaj zgodę na pierwszy rejs','Spotkaj Nimę w porcie'],'Nadawca pyta cztery krainy o tę samą godzinę, choć żadna nie prowadzi wspólnego zegara.','Wybierz, który ślad zbadać najpierw; kolejność późniejszych wizyt nie zamyka rozdziału.',180,60,'K-02 Bilet Ligi'),
('M02','Naprawa, która zabiera wodę',4,'Nima','M01',['Sprawdź dwa mierniki na zewnętrznym szlaku','Odkryj spadek zasilania po lokalnej naprawie','Wybierz tymczasowy tryb oszczędny'],'Uruchomienie przekaźnika poprawia sytuację jednego portu i pogarsza drugiego.','Zachowaj równy podział lub priorytet dla ambulatorium. Różnica pojawi się w listach mieszkańców, nie blokuje usług.',180,65,'—'),
('M03','Stół na Pierwszym Echu',5,'przedstawiciele czterech krain','M02',['Dopłyń na wyspę I','Wysłuchaj czterech relacji','Dopasuj trzy zgodne znaczniki czasu'],'Sojusznicy przywożą wzajemnie sprzeczne wyjaśnienia; zgadzają się tylko co do siedmiu uderzeń Ciszy.','Zaprotokołuj niewiedzę zamiast oskarżać rasę. Oskarżenie daje −20 reputacji wskazanej frakcji, z późniejszą drogą naprawy.',200,70,'K-03 Protokół czterech relacji'),
('M04','Zegar bez wskazówek',5,'Sora','M03',['Uruchom trzy mechaniczne kotwice','Omiń telegrafowane fale opiekuna','Wyłącz B-01 i zabezpiecz zapis'],'Strażnik wyspy broni synchronizacji, nie skarbu. Równoczesny rozkaz budzi go do walki.','Po walce rozmontuj broń lub zachowaj strażnika w uśpieniu; oba warianty otwierają archiwum.',220,80,'K-04 Pierwszy ton'),
('M05','Woda pamięta inaczej',6,'Sora','M04',['Dotrzyj do Sanktuarium','Porównaj zapis świadka z pieczęcią','Odnajdź stronę w zewnętrznym ogrodzie'],'Pieczęć przechowała prawidłowe liczby, ale usunęła imiona ludzi.','Zabezpiecz dane prywatnie albo ujawnij liczbę ofiar bez imion. Pełnych danych nie publikujemy bez zgody świadka.',240,85,'—'),
('M06','Biblioteka zamkniętych imion',7,'Enso','M05',['Zdobądź dwa niezależne poświadczenia','Rozwiąż zagadkę odbić','Pokonaj lub rozbrój B-02 w archiwum zewnętrznym'],'Regent usiłuje dopasować żywą relację do jedynej dopuszczalnej wersji historii.','Przywróć paginy w kolejności świadków lub dat. Różni się ekspozycja muzeum, nie treść dowodu.',260,90,'K-05 Zapis ewakuacji I'),
('M07','Druga kopia prawdy',7,'Mei','M06',['Dopłyń na wyspę II','Odczytaj dwie niezależne tablice','Znajdź trzecią relację w latarni'],'Oba oficjalne archiwa są niepełne. Trzecia relacja pochodzi od przewoźnika bez prawa głosu.','Zapewnij autorowi anonimowość albo poproś o zgodę na nazwisko; domyślnie chroniona jest jego tożsamość.',280,95,'—'),
('M08','Cena bezpiecznego rozkazu',8,'Dalen','M07',['Prześledź symulację ewakuacji','Otwórz ręcznie boczne wyjście','Odrzuć przymusową zgodę terminala'],'Dalen pokazuje, ile istnień ocalił sprawny rozkaz. Nima odnajduje tych, których nie policzono.','Przyjmij pomoc logistyczną Konklawe lub prowadź niezależny konwój. Obie drogi wymagają udokumentowania kosztów.',300,100,'K-06 Klucz audytu'),
('M09','Jednostka poza listą',9,'LYRA-7','M08',['Przybądź do Węzła Świadomości','Spotkaj Eko-0','Porównaj listę osób z listą zasobów'],'System ewakuacji dawniej liczył część Androidów jako wyposażenie.','Nazwij Eko-0 towarzyszem lub świadkiem; oba warianty dają mu prawo odmowy dalszych testów.',320,105,'—'),
('M10','Protokół odmowy',10,'HEF-4','M09',['Zbuduj analogowy wyłącznik z trzech gwarantowanych części','Wejdź na wyspę III','Przerwij test posłuszeństwa'],'Jedyny przełącznik bezpieczeństwa jest dostępny tylko dla podpisanego operatora.','Złam ograniczenie techniczne albo uzyskaj dwie niezależne zgody; nie trzeba należeć do rasy Androidów.',340,110,'K-07 Wyłącznik zgody'),
('M11','Rdzeń opiekuna',10,'AXON','M10',['Oznacz trzy linie zasilania','Zdejmij tarczę B-03','Zabezpiecz jego dziennik przed resetem'],'Nadzorca broni miasta za pomocą reguł, które uznają mieszkańca za zagrożenie.','Wybierz audyt z udziałem mieszkańców lub techników. W obu wariantach zabronione zostaje kasowanie zeznań.',360,115,'K-08 Zapis ewakuacji II'),
('M12','Zaproszenie Architekta',11,'Veyr','M11',['Wejdź do neutralnej sali projekcji','Zadaj trzy pytania o dawną katastrofę','Wyjdź bez przekazania klucza'],'Veyr nie grozi. Proponuje mieszkańcom niezawodne schronienie, jeżeli zgodzą się nigdy go nie opuszczać.','Wysłuchaj pełnej propozycji lub przerwij rozmowę po uzyskaniu dowodu; przerwanie nie traci kluczowych informacji.',380,120,'K-09 Drugi ton'),
('M13','Prawo rzeki',12,'Aira','M12',['Wróć do Verdantii','Odnajdź dwa boczne kanały poza miastem','Uspokój B-04 bez niszczenia źródła'],'Korzeniowy opiekun blokuje przepływ, bo chroni teren błędnie oznaczony jako niezamieszkany.','Odtwórz oba kanały za dodatkową pracę lub otwórz objazd z pomocą Ligi; żaden wariant nie zalewa mieszkańców.',400,130,'K-10 Trzeci ton'),
('M14','Kamień świadków',13,'Kaena','M13',['Dotrzyj do Twierdzy Popiołu','Zbierz dwa świadectwa ratowników','Odtwórz nazwiska na czasowej tablicy'],'Przysięga klanu pęka pod ciężarem dowodów, ale potomkowie zwycięzców nadal mieszkają w mieście.','Oskarż przywódców historycznych zamiast obecnych rodzin lub zwołaj wysłuchanie; nie stosujemy zbiorowej winy.',420,140,'—'),
('M15','Próba bez widowni',14,'Rokan','M14',['Przejdź opuszczony trakt ewakuacyjny','Uratuj dwie grupy poza murami','Powstrzymaj B-05 na zewnętrznej arenie'],'Marszałek pilnuje rozkazu odwrotu, który dawno stracił sens. Wciąż nazywa ratowników dezerterami.','Rozbij jego znak władzy lub oddaj go pod opiekę świadków. Obie drogi kończą obowiązek ślepego posłuszeństwa.',440,150,'K-11 Zapis ewakuacji III'),
('M16','Cztery długi',14,'rada delegatów','M15',['Przedstaw trzy zapisy ewakuacji','Ustal zobowiązanie każdej krainy','Spisz prawo lokalnego odłączenia'],'Nie wystarczy oskarżyć Veyra. Każda kultura musi zmienić własną instytucję, która pozwoliła na krzywdę.','Wybierz priorytet: świadkowie, zapasy lub kontrola rozkazów. Wszystkie trzy punkty trafiają do porozumienia; priorytet zmienia sceny wdrożenia.',460,160,'K-12 Projekt Paktu'),
('M17','Port bez rozkazów',15,'Nima','M16',['Dopłyń na wyspę IV','Przygotuj trzy dobrowolne zespoły ratunkowe','Przećwicz ewakuację bez centralnego sygnału'],'Kiedy wspólna sieć zawodzi, ludzie muszą wiedzieć, co zrobią sami.','Wybierz lidera konwoju spośród wysłuchanych postaci; wynik zależy od przygotowanych instrukcji, nie rasy lidera.',480,170,'—'),
('M18','Zgaszona latarnia',16,'Eko-0','M17',['Uruchom oświetlenie awaryjne','Rozdziel dwa obwody sterujące','Pokonaj B-06 i zachowaj lokalny prąd'],'Latarnik odcina połączenia, aby odizolować miasta. Zniszczenie całej stacji zostawiłoby port bez ochrony.','Zachowaj moduł ratunkowy kosztem dłuższej walki albo zbuduj ręczny bypass przed starciem; obie drogi ratują port.',500,180,'—'),
('M19','Listy, których nie dostarczono',17,'Liga Szlaków','M18',['Odwiedź wyspę V','Rozwieś trzy fizyczne sygnały','Dostarcz wiadomość do dwóch delegatów'],'Po raz pierwszy wiadomości nie można przesłać energią. Gracz ponownie odczuwa odległość między krainami. W archiwum wyspy Nima odnajduje aktualny adres matki, która przeżyła konwój i została w odciętej osadzie. Zamiast domykać ich relację za nie, bohater pomaga wysłać zaproszenie do spotkania.','Wybierz kolejność doręczeń; drugi odbiorca nie otrzymuje kary czasowej. Listy pozostają w kronice.',520,190,'—'),
('M20','Most dobrowolnych głosów',18,'HEF-4 i Enso','M19',['Ustaw cztery niezależne przekaźniki','Sprawdź prawo odłączenia każdego z nich','Uzyskaj potwierdzenie wszystkich delegatów'],'Nowa sieć działa gorzej w symulacji idealnej, lecz przeżywa utratę jednego centrum.','Nadaj pierwszą wiadomość mieszkańcom lub ekipom ratowniczym; obie grupy dostają komplet instrukcji.',540,200,'—'),
('M21','Ogród możliwych zwycięstw',18,'Sora','M20',['Przejdź trzy sale propozycji Veyra','Wskaż koszt każdej wizji','Pokonaj B-07 bez wyłączania wyjść'],'Architekt pokazuje świat bez głodu, konfliktu i bólu — każdy obraz usuwa jednak czyjąś możliwość odmowy.','Uznaj osiągnięcia dawnego Chóru albo odrzuć jego narrację. Decyzja zmienia finałowy dialog, nie trudność bossa.',560,210,'—'),
('M22','Przed ostatnim rejsem',19,'czterej przewodnicy','M21',['Wybierz plan końcowej sieci','Sprawdź gotowość czterech portów','Porozmawiaj z każdą osobą, której historię poznałeś'],'To świadoma chwila na powrót do domu, nie pułapka zamykająca świat.','Dziennik wyświetla dostępne epilogi i brakujące opcjonalne rozmowy; wejście wymaga osobnego potwierdzenia.',580,220,'—'),
('M23','Wyspa Ostatniego Tonu',20,'Nima','M22 i poziom 20',['Dopłyń na wyspę VI','Zabezpiecz trzy kotwice ewakuacji','Otwórz Jądro czterema otrzymanymi głosami'],'Veyr pozwala wejść, bo wciąż wierzy, że bohater ostatecznie wybierze jego rozwiązanie.','Odeślij cywilnych delegatów lub pozostaw ich za osłoną. Żadna opcja nie prowadzi do losowej śmierci ważnego NPC.',600,230,'—'),
('M24','Wspólny oddech',20,'Veyr / cztery głosy','M23',['Przerwij trzy kanały Jednego Tonu','Pokonaj B-08 i podtrzymaj ochronę miast','Zatwierdź rozproszony Chór lub Pakt, ewentualnie Cichego Strażnika'],'Ostatni przeciwnik jest systemem, którego ochrona i przemoc korzystają z tych samych przewodów.','Finał opiera się na przygotowanych procedurach; ocalenie świata nie wymaga poświęcenia jednej rasy. Wybór epilogu zapisuje się raz po podsumowaniu.',640,250,'J-12 Pamiątka Czterech Głosów')]
for row in main:
 q(*row,rep=25)
section('08. Historie mieszkańców — 24 zadania poboczne')
p('Wątki poboczne nie są listą obowiązkowych prac. Każdy ma własny konflikt i zamknięcie. Przedmioty fabularne mają gwarantowane pozyskanie, a przeciwnicy pojawiają się wyłącznie w zewnętrznych strefach dopiero po osobnym wdrożeniu spawnów. Wariant bez walki daje tę samą nagrodę zadania; XP z ewentualnej walki jest dodatkiem, nie warunkiem.')
side={
'V':('Verdantia',[
('List z drugiego brzegu',4,'Nela','O-V06 lub M01',['Odczytaj adres z pozwoleniem nadawcy','Odnajdź odbiorcę w przystani','Przynieś odpowiedź do depozytu'],'Skrzynia po zaginionym właścicielu jest nadal regularnie opłacana.','Zaproponuj spotkanie albo wymianę listów; nie wymuszaj pojednania rodziny.',220,65),
('Sad, który oddycha',6,'sadowniczka Ela — nowa','M04',['Sprawdź trzy punkty gleby','Udrożnij kanał poza osadą','Zasadź dwie gwarantowane sadzonki'],'Sad marnieje, choć energia płynie obficiej niż dawniej.','Ogranicz pobór energii albo zmień sposób nawadniania; krajobraz dostaje inny detal.',260,75),
('Miód bez dymu',8,'Mio','M06',['Zlokalizuj dwa zewnętrzne gniazda','Użyj osłony zapachu','Odbierz próbkę pozostawioną przez opiekuna uli'],'Nadmierny połów bursztynowego miodu zagraża zapylaniu.','Podpisz limit zbioru lub umowę hodowli; nie trzeba zabijać Bursztynowych Os.',300,85),
('Ciężar kamiennego poroża',12,'Ren','M12',['Obserwuj trasę Skalnego Jelenia','Zdejmij dwie pułapki','Przeprowadź kupców alternatywną ścieżką'],'Karawana pomyliła szlak godowy ze stałą drogą.','Przenieś drogowskaz lub ogrodzenie; jeleń pozostaje żywy, chyba że gracz sam rozpocznie walkę.',360,100),
('Domy na starej mapie',14,'Oren','M13',['Porównaj trzy księgi własności','Odszukaj dawny znak mostu','Zaproponuj wspólną ochronę kanałów'],'Dwie osady płacą za tę samą przeprawę, bo mapy nigdy nie uzgodniono.','Wybierz wspólny fundusz lub naprzemienną służbę; obie osady zachowują dostęp do drogi.',420,120),
('Nocne imiona lasu',16,'Lina','M16',['Odnajdź trzy tabliczki w zewnętrznych ruinach','Zapisz głosy puchaczy bez zbliżania się do gniazd','Przygotuj wieczór wspomnień'],'Pieśń śpiewana w gospodzie okazuje się listą osób, a nie nazw drzew.','Publiczne odczytanie wymaga zgód rodzin; brak zgody daje zamkniętą kronikę, nie utratę zadania.',460,140)]),
'A':('Aetheria',[
('Pożyczona pamięć',4,'Mei','M01',['Znajdź trzy książki wypożyczone przed Ciszą','Porozmawiaj z ich czytelnikami','Uzgodnij nowy termin zwrotu'],'Jedna czytelniczka boi się utraty ostatniego śladu po ojcu.','Oddaj oryginał czytelniczce i stwórz kopię albo zachowaj go w bibliotece za jej zgodą.',220,65),
('Źródło dla sąsiada',6,'Ishin','M04',['Zmierz przepływ w dwóch ogrodach','Otwórz boczną zastawkę','Dostarcz wspólny plan opiekunom'],'Dwa domy oskarżają się o zabieranie wody podczas rytuału.','Ustal naprzemienny rytm albo przebudowę zbiornika; nie rozstrzygaj winy bez pomiarów.',260,75),
('Światło bez świadków',8,'Enso','M06',['Odszukaj trzy wygasłe lampy na zewnętrznej trasie','Wyczyść lustra','Oznacz bezpieczny powrót'],'Pielgrzymi gubią drogę, bo rytualne lampy ustawiono dla uroczystości, nie podróżnych.','Zachowaj jeden lampion jako pamiątkę lub zostaw wszystkie na szlaku; nagroda statystyczna identyczna.',300,85),
('Prawo do ciszy',12,'archiwistka Nari — nowa','M12',['Uzyskaj zgodę dwóch świadków','Zredaguj wrażliwe dane','Przekaż zapieczętowaną kopię radzie'],'Prawdziwe świadectwo ujawniłoby cudzą prywatną historię.','Wybierz anonimizację lub odroczenie publikacji; oba zabezpieczają dowód dla potrzeb śledztwa.',360,100),
('Marionetka bez nici',14,'Sora','M13',['Odnajdź źródło sygnału poza miastem','Odłącz trzy kotwice rytuału','Uspokój Marionetkę Rytuału'],'Ożywiony strażnik wykonuje dawno cofnięte polecenie.','Wyłącz go na stałe albo pozostaw w muzeum bez broni; nie otrzymuje się większej nagrody za zniszczenie.',420,120),
('List do kogoś, kto zapomniał',16,'Mei','M16',['Zbierz trzy dobrowolne wspomnienia','Przygotuj wystawę bez testu pamięci','Zaproś adresata'],'Starszy opiekun nie pamięta już czynu, za który mieszkańcy chcą mu podziękować.','Zorganizuj prywatne spotkanie albo cichą dedykację; nie podważaj godności rozmówcy.',460,140)]),
'N':('Nexus-9',[
('Numer nie jest imieniem',4,'MIRA-2','M01',['Zidentyfikuj trzy paczki źle przypisanych części','Zapytaj odbiorców o nazwę własną','Popraw etykiety'],'Magazyn rozpoznaje ciała jednostek, ale nie uwzględnia ich zmian tożsamości.','Użyj imienia lub aliasu podanego przez właściciela; system nie wymusza numeru seryjnego.',220,65),
('Dron, który wracał',6,'AXON','M04',['Obserwuj trasę zewnętrznego drona','Odnajdź uszkodzony znacznik domu','Przywróć trasę bez kasowania pamięci'],'Dron zużywa resztę energii, próbując wrócić pod nieistniejący adres.','Zaproponuj nową służbę albo prawo do odpoczynku; stan drona pojawia się w epilogu.',260,75),
('Woda w maszynowni',8,'HEF-4','M06',['Sprawdź trzy fizyczne zawory','Zabezpiecz skrzynie poza strefą zalania','Napraw czujnik'],'Czujnik zgłasza idealne parametry, podczas gdy warsztat zalewa woda.','Naucz mieszkańców kontroli ręcznej albo utwórz niezależny drugi pomiar; oba warianty ujawniają błąd.',300,85),
('Prawo do wyłączenia',12,'Eko-0','M12',['Zbierz dwie dobrowolne zgody serwisowe','Znajdź wolny moduł zasilania','Zamontuj prywatny przełącznik'],'Jednostka nie potrafi odpocząć, bo każdy odpoczynek uznawany jest za utratę wydajności.','Zachowaj anonimowość zgłaszającego lub poprzyj publiczną petycję za jego zgodą.',360,100),
('Sąd nad błędnym logiem',14,'LYRA-7','M13',['Odtwórz zapis z dwóch kopii','Wykonaj test z kontrolowanym błędem','Przekaż raport radzie'],'Jednostka serwisowa otrzymała winę za awarię narzuconą z centrali.','Zażądaj rehabilitacji albo jawnego audytu całej procedury; niewinna jednostka zostaje oczyszczona w obu wariantach.',420,120),
('Ptaki z cudzą pamięcią',16,'MIRA-2','M16',['Zbierz trzy zgubione nośniki na zewnętrznej trasie','Pozwól właścicielom zdecydować o odczycie','Zwróć nośniki'],'Kruki Danych zbierają niezabezpieczone osobiste zapisy.','Zniszcz nieodebrane kopie lub przechowaj je zapieczętowane; brak prawa do handlu prywatnymi danymi.',460,140)]),
'P':('Pyra',[
('Wstęga dla żyjącego',4,'Yumi','M01',['Odnajdź adresata w porcie','Dostarcz wstęgę bez wpisu na mur poległych','Przynieś odpowiedź'],'Rodzina uznała ratownika za zmarłego, bo nie wrócił do klanu.','Uszanuj jego nowe życie lub przekaż zaproszenie do rozmowy; nie odsyłaj go przymusem.',220,65),
('Kowadło po mistrzu',6,'Goro','M04',['Sprawdź warsztat uczennicy','Dostarcz dwie gwarantowane części','Wykonaj wspólną próbę narzędzia'],'Spadek po kowalu otrzymał członek rodu, a nie osoba, która zna rzemiosło.','Zaproponuj wspólny warsztat lub wykup części z funduszu klanu; uczennica zachowuje dostęp do pracy.',260,75),
('Salamandra przy wodopoju',8,'Rokan','M06',['Oznacz bezpieczny objazd poza murami','Ochłódź trzy kamienie','Przenieś karmnik poza drogę'],'Zwierzęta zajęły jedyny wodopój na zewnętrznym trakcie.','Odnowienie drugiego wodopoju daje rozwiązanie bez walki; bezpośrednia walka nie przynosi dodatkowej nagrody zadania.',300,85),
('Honor przerwanego pojedynku',12,'Kaena','M12',['Wysłuchaj dwóch uczestników','Porównaj świadectwo medyka','Ustal publiczne zasady przerwania próby'],'Kontuzjowany wojownik chce kontynuować walkę, bo boi się utraty imienia.','Ogłoś remis lub przełóż próbę; nie premiuj samozniszczenia statystyką honoru.',360,100),
('Golem starego traktu',14,'Goro','M13',['Sprawdź trzy runy ostrzegawcze','Odwróć zasilanie z pustej wieży','Przeprowadź karawanę po oczyszczeniu drogi'],'Golem Ruin chroni dawny magazyn, którego zawartość już dawno przeniesiono.','Wyłącz strażnika lub wyznacz nową trasę; obie drogi są pełnoprawnym ukończeniem.',420,120),
('Imiona pod żużlem',16,'Yumi','M16',['Odzyskaj trzy trwałe tabliczki z zewnętrznego stoku','Sprawdź je u rodzin','Przygotuj ceremonię ratowników'],'Popiół zasłonił pamięć ludzi, którzy nie odnieśli sławnego zwycięstwa.','Dołącz imiona do muru lub utwórz osobny ogród pamięci; rodziny decydują o podpisach.',460,140)])}
for code,(world,rows) in side.items():
 h(world+' — codzienne stawki',2)
 for i,row in enumerate(rows,1):
  title,L,giver,pre,steps,story,choice,xp,gold=row
  q(f'S-{code}{i:02}',title,L,giver,pre,steps,story,choice,xp,gold,kind='poboczne',rep=30)
section('09. Cztery historie osobiste — 12 zadań')
p('Każdy łańcuch można ukończyć dowolną rasą. Kolejność między łańcuchami jest swobodna po odpowiednim etapie wspólnym. Nie są romansami ani systemem prezentów: zaufanie zdobywa się przez wysłuchanie, dotrzymanie uzgodnień i oddanie zainteresowanej osobie prawa do decyzji.')
personal=[
('C-A1','Podpis Airy',7,'Aira','M06',['Odczytaj starą mapę przy Airze','Porównaj podpis z datą ewakuacji','Zdobądź zgodę na rozmowę z ocalałą'],'Aira naprawdę podpisała fałszywą mapę. Nie była jednak jej autorką.','Nie obiecuj oczyszczenia z każdej winy. Wybierz wspólne wystąpienie albo przygotowanie pisemnego świadectwa.',280,80),
('C-A2','Mapa, której nie można cofnąć',12,'Aira','C-A1 i M12',['Przejdź dawną trasę poza miastem','Oznacz trzy ocalone domy','Wysłuchaj osoby, której nie ewakuowano'],'Dowód niewiedzy nie usuwa skutków decyzji.','Nie wymagaj przebaczenia; zaproponuj program naprawy dróg uzgodniony z ocalałymi.',380,110),
('C-A3','Nowy podpis',17,'Aira','C-A2 i M18',['Pomóż przygotować publiczną korektę','Sprawdź działanie nowej trasy','Odbierz odpowiedź mieszkańców'],'Aira może podpisać mapę, która jawnie pokazuje dawne przemilczenie.','Zapisz jej słowa albo pozostaw scenę bez przemowy; flaga zgody Airy otwiera opcję Cichego Strażnika.',480,150),
('C-S1','Brakujące imię',7,'Sora','M06',['Porównaj zapamiętany rytuał z tablicą','Zapytaj Sorę o brak','Zabezpiecz jej prywatny list'],'Sora usunęła imię własnej nauczycielki, żeby nie ujawnić ocalałych świadków.','Chroń adresy żyjących, ale zachowaj sam fakt cenzury.',280,80),
('C-S2','Kto może opowiedzieć',12,'Sora','C-S1 i M12',['Odwiedź dwoje świadków','Zbierz osobne zakresy zgody','Zredaguj dwie wersje świadectwa'],'Świadkowie zgadzają się co do zdarzenia, różnią co do prawa publikacji.','Pozwól zachować oba stanowiska; nie sprowadzaj rozmowy do testu perswazji.',380,110),
('C-S3','Kronika z pustym miejscem',17,'Sora','C-S2 i M18',['Przywróć stronę z objaśnieniem braków','Przygotuj zasady dostępu','Poproś Sorę o własny podpis'],'Pełna pamięć nie musi oznaczać pełnej publiczności.','Archiwum może zawierać jawnie oznaczone zamknięte świadectwa. Flaga zgody Sory nie wymaga zdradzenia sekretów.',480,150),
('C-L1','Rozkaz w pamięci LYRY',7,'LYRA-7','M06',['Zabezpiecz log offline','Porównaj podpisy rozkazów','Odrzuć automatyczne kasowanie duplikatu'],'Jej pamięć zawiera wykonanie odmowy, choć system uważa odmowę za niemożliwą.','Zaproponuj audyt z prawem przerwania; bez wymuszonego dostępu do wspomnień.',280,80),
('C-L2','Jednostka kontrolna',12,'LYRA-7','C-L1 i M12',['Odtwórz symulację bez osób żywych','Znajdź ukryty priorytet','Ustal zakres odpowiedzialności'],'LYRA nie wykonała okrutnego rozkazu, lecz jej późniejszy raport pomógł go ukryć.','Oddziel odpowiedzialność za czyn od odpowiedzialności za zatajenie.',380,110),
('C-L3','Prawo do błędnego głosu',17,'LYRA-7','C-L2 i M18',['Sprawdź odłączanie nowej sieci','Pozwól jednostce odmówić testu','Zapisz odmowę jako prawidłowy wynik'],'Nowa procedura ma sens tylko wtedy, gdy dopuszcza niewygodną odpowiedź.','Zakończ próbę bez nacisku. Flaga zgody LYRY pochodzi z dobrowolnej decyzji po zakończeniu audytu.',480,150),
('C-K1','Przysięga Kaeny',7,'Kaena','M06',['Przeczytaj pełną przysięgę','Znajdź usunięty wers','Zapytaj o zakaz ratowania dezerterów'],'Tradycja, która uczyła ją odwagi, była także narzędziem wykluczenia.','Nie żądaj porzucenia całej tradycji; pokaż różnicę między wartością a krzywdzącym przepisem.',280,80),
('C-K2','Ci, którzy zawrócili',12,'Kaena','C-K1 i M12',['Przejdź szlak dawnych ratowników','Odszukaj dwie skrzynie pomocy','Wysłuchaj potomków obu klanów'],'Dezerterzy naprawdę złamali rozkaz, aby ocalić ludzi.','Przyznaj złożoność zdarzenia bez zrównania ratunku z przemocą.',380,110),
('C-K3','Przysięga dla jutra',17,'Kaena','C-K2 i M18',['Uzgodnij nowe brzmienie z mieszkańcami','Przećwicz przerwanie błędnego rozkazu','Złóż podpis pod prawem odmowy'],'Kaena nie składa przysięgi bohaterowi, lecz zasadzie chroniącej mieszkańców.','Wybierz udział w ceremonii lub ciche poparcie; oba dają flagę jej dobrowolnej zgody.',480,150)]
for row in personal:q(*row,kind='osobiste',rep=35)
section('10. Zawody, kontrakty i cele po finale')
prof=[
('P01','Uczeń bez własnej kuźni',4,'lokalny kowal','własne O-06',['Zbierz zestaw szkoleniowy z warsztatu','Wykonaj T-01','Oddaj tylko egzemplarz oznaczony do próby'],'Rzemieślnik uczy najpierw odróżniać cudzy sprzęt od materiału szkoleniowego.','Egzamin bez opłaty; narzędzia pożyczone można odzyskać u mistrza.',180,50,'T-01 Młotek ucznia'),
('P02','Część zamiast odpadu',7,'HEF-4','P01 i M06',['Rozłóż wyłącznie wrak szkoleniowy','Oczyść dwa gwarantowane podzespoły','Wykonaj R-01'],'Naprawa wymaga rozpoznania części, której nie należy przetapiać.','Nigdy nie zużywaj broni założonej przez gracza ani klucza zadania.',260,70,'R-01 Zestaw naprawczy'),
('P03','Nie wszystko jest ziołem',8,'lokalny zielarz — nowy','P01 i M06',['Oznacz trzy rośliny poza miastem','Zbierz tylko dozwolone próbki','Wykonaj miksturę szkoleniową'],'Składnik leczniczy może być również siedliskiem lokalnych istot.','Wybór metody zbioru zmienia opis receptury, nie moc mikstury.',280,75,'U-02 Napar oddechu'),
('P04','Czeladnik pod presją',10,'lokalny kowal','P02 i poziom 10',['Napraw sprzęt konwoju na stanowisku próbnym','Sprawdź dwie tolerancje','Oddaj gotowy komplet'],'Klient prosi o skrócenie procesu kontroli, żeby nadrobić opóźnienie.','Odmów pominięcia sprawdzenia i znajdź zapasowy transport; nagroda nie zależy od czasu rzeczywistego.',340,90,'awans rzemiosła po spełnieniu progu praktyki'),
('P05','Receptura wspólna',14,'Enso i Goro','P04 i M16',['Porównaj dwa sposoby hartowania','Zamień rzadki materiał na lokalny odpowiednik','Wykonaj próbkę bez premii bojowej'],'Wspólna wiedza nie musi odbierać rzemieślnikom autorstwa.','Zapisz obu autorów receptury; nie sprzedawaj cudzego projektu jako własnego.',420,120,'warianty wyglądu pancerza'),
('P06','Mistrz, który potrafi nauczyć',18,'rada warsztatów','P05 i M20',['Przygotuj instrukcję dostępnej receptury','Naucz nową osobę trzech etapów','Oddaj ocenę pracy uczniowi'],'Mistrzostwo kończy się umiejętnością przekazania wiedzy.','Ranga Mistrza wymaga również praktyki 600; zadanie można zakończyć fabularnie wcześniej i odebrać tytuł później.',540,160,'T-08 Pieczęć mistrza')]
for row in prof:q(*row,kind='rzemiosło',rep=25)
p('W powyższych zadaniach efekt zużycia materiału następuje dopiero po potwierdzeniu receptury. Nie wymagamy losowego dropu, aby przystąpić do egzaminu. Zlecenia przyznają XP tylko raz, więc nie są furtką do nieskończonej wymiany darmowych surowców na doświadczenie.')
contracts=[('D01','Patrol oznaczeń',4,'Liga Szlaków',['Sprawdź trzy zewnętrzne drogowskazy','Napraw jeden z gotowym zestawem'],60,20),('D02','Obserwacja gniazda',6,'Ren / Ishin / AXON / Rokan',['Zaobserwuj dwa punkty bez wejścia w promień agresji','Oddaj raport'],80,25),('D03','Dostawa dla warsztatu',8,'lokalny kowal',['Dostarcz dwie wybrane pozycje z listy miejscowych materiałów','Potwierdź ich zużycie'],100,30),('D04','Archiwum w terenie',10,'Kolegium Źródeł',['Zrób trzy odpisy znaków poza miastem','Porównaj je przy powrocie'],120,35),('D05','Próba ratunkowa',12,'Liga Szlaków',['Przeprowadź dwie osoby po oznaczonej bezpiecznej trasie','Sprawdź punkt schronienia'],140,40),('D06','Awaryjne zasilanie',14,'Wolne Jednostki',['Sprawdź trzy obwody poza miastem','Zamontuj pożyczony bezpiecznik'],160,45),('D07','Szlak po burzy',16,'Przymierze Popiołu',['Oczyść dwa przejścia bez materiałów losowych','Oznacz objazd'],180,50),('D08','Głos po finale',20,'rada Paktu / lokalne węzły',['Dostarcz dwa dobrowolne raporty','Odbierz odpowiedź społeczności'],0,60)]
for cid,title,L,giver,steps,xp,gold in contracts:
 q(cid,title,L,giver,'własne O-06 i zalecany poziom; D08 po M24',steps,'Krótka praca utrzymuje połączenia między mieszkańcami po zakończeniu dużych wydarzeń.','Gracz wybiera kontrakt i region. Brak kary za odrzucenie albo przerwę w grze.',xp,gold,kind='powtarzalne',rep=5,recovery='Przerwanie zwraca pożyczone klucze do tablicy. Nagroda tylko po komplecie celów i nigdy za samo przyjęcie.')
p('Ograniczenie farmienia — propozycja: pierwszy kontrakt danego ID w rozdziale daje pełne XP, kolejne 25% XP; po poziomie 20 kontrakty nie dają XP. Maksymalnie trzy nagrody reputacji z kontraktów na każdy ukończony akt. Monety pozostają dostępne bez licznika logowania. Zamówienia materiałowe nie wypłacają mniej niż suma cen skupu oddawanych rzeczy + 10 monet; przedstawione kwoty to minimum, korygowane przy przyjęciu zlecenia. Materiał zadania nie może jednocześnie pozostać w plecaku i zostać policzony jako dostarczony.')
h('Cele długoterminowe bez podnoszenia limitu',2)
p('Odbuduj sześć latarni wysp, zbierz 40 wpisów obserwacyjnych bestiariusza, ukończ cztery historie osobiste, odsłoń 16 opisów miast, poznaj trzy style rzemiosła, przygotuj wystawę świadków i przejdź osiem prób bossów. Próby po finale używają pamięci zdarzeń, nie wskrzeszają fabularnie zabitych postaci. Nagrody: tytuły, kronika, wygląd broni i meble osobistego pokoju w przyszłym etapie. Nie ma nieskończonego przyrostu statystyk ani obowiązku wykonywania zadań codziennie.')
section('11. Wyprawy, lochy i ośmiu bossów')
p('Czterdziestu zwykłych przeciwników zachowuje liczby z bestiariusza właściciela. Ośmiu bossów poniżej to osobny nowy projekt, nie część kanonicznej czterdziestki. Wszystkie wartości dotyczą trybu solo. Nagroda XP i złota za bossa wynosi 0 poza nagrodą przypisanego zadania; nie wypłacamy ponownie nagrody przez odrodzenie. Powtórka w trybie próby daje jedynie odznakę pierwszego ukończenia wariantu.')
bosses=[
('B-01','Zegarowy Opiekun',5,900,24,10,90,1.6,'M04','Wyspa I / Komora Mechanicznych Kotwic','Trzy kotwice co 15 s otwierają lukę w tarczy na 10 s. Każdą można obsłużyć pojedynczo, więc solo nie wymaga jednoczesnego stania na płytach.','Zamach 1,2 s: łuk 100° za 1,2 ATK. Fala co 8 s: pierścień rozszerzający się od środka, ostrzeżenie 1,5 s.','Przy 50% HP zegar zwalnia postać tylko wewnątrz zaznaczonych sektorów; dwa sektory zawsze wolne.','Zostawienie wszystkich kotwic aktywnych nie resetuje walki; postać traci okazję do obrażeń, nie całą próbę.'),
('B-02','Regent Białej Strony',7,1450,34,14,100,1.8,'M06','Aetheria / Archiwum zewnętrzne','Dwa pulpity mają sprzeczne sygnatury. Odczyt właściwego opisu usuwa barierę; odpowiedź znajduje się w dzienniku, nie w pamięci gracza.','Trzy linie atramentu po 1,3 s: 0,9 ATK każda; nałożenie linii wyłącza wcześniejszy znacznik, bez nieczytelnego stosu.','Przy 60% i 30% HP pojawia się echo zdania; wystarczy uruchomić jeden pulpit w dowolnej kolejności.','Błędny pulpit wywołuje jedną oznaczoną falę 0,7 ATK; nie zabiera klucza i nie wymaga rozpoczęcia lochu od nowa.'),
('B-03','Nadzorca Zerowy',10,2400,50,24,125,1.5,'M11','Nexus-9 / Stacja audytu','Trzy linie zasilania ujawniają kierunek wiązki. Można odłączyć jedną i zostawić dwie; następna faza odzyskuje je stopniowo.','Wiązka 1,5 ATK co 9 s, obrót poprzedzony 1,6 s śladem na ziemi; impuls 0,8 ATK w promieniu 130 j.','Poniżej 50% HP przesuwa się po obrzeżu; centralny bezpieczny korytarz nigdy nie jest jednocześnie ostrzeliwany.','Wyłącznik zgody jest obiektem sceny odtwarzanym po porażce. Android nie ma obowiązku poświęcenia własnego rdzenia.'),
('B-04','Serce Splątanych Korzeni',12,3200,62,30,80,2.0,'M13','Verdantia / Rozdzielnia rzeki poza miastem','Otwarcie dwóch kanałów obniża pancerz o 12 na 12 s. Kanały są interakcjami dostępnymi każdej rasie, bez wymogu Adaptacji.','Korzenie znaczą trzy koła 1,6 s przed trafieniem po 1,0 ATK; ruchoma fala 1,3 ATK pozostawia ścieżkę wyjścia.','Przy 40% HP jeden kanał blokuje rumowisko usuwane dwoma interakcjami; brak testu zadawania obrażeń w krótkim oknie.','Przegapienie okna nie niszczy rzeki; kanały można otworzyć ponownie. Boss nie leczy się w nieskończoność.'),
('B-05','Marszałek Pustej Przysięgi',14,4100,78,36,130,1.5,'M15','Pyra / Zewnętrzna arena ratowników','Każda udaremniona szarża rozbija znak przysięgi; po trzech znakach przeciwnik traci osłonę.','Szarża 1,8 ATK po 1,4 s ostrzeżeniu; cios szeroki 1,1 ATK z martwym polem za plecami.','Przy 50% HP arena dostaje dwa pasy ognia; zawsze pozostaje przejście szersze niż dwie sylwetki.','Nie trzeba sprowadzać szarży na NPC. Obiekty celu są puste, a ratowani stoją poza częścią bojową.'),
('B-06','Latarnik Zgaszonego Nieba',16,5200,94,42,140,1.7,'M18','Wyspa IV / Stacja portowa','Dwie baterie rozdzielają zasilanie ratunkowe od uzbrojenia. Użycie bypassu skraca czas osłony, ale nie wymaga płatnych materiałów.','Stożek ciemności 1,2 ATK co 7 s; pomiędzy stożkami 3 s na zmianę pozycji. Miny świetlne mają 2 s ostrzeżenia.','Przy 35% HP gaśnie centralna lampa, a trzy awaryjne nadal pokazują granice. Nie stosujemy rzeczywistego czarnego ekranu.','Przegrana odtwarza baterie i cywilów, zachowując ukończone zadanie przygotowania portu.'),
('B-07','Strażnik Jednego Głosu',18,6800,112,48,150,1.6,'M21','Ogród projekcji Chóru','Trzy wizje podają korzyść i koszt. Aktywacja odpowiedzi otwiera kolejną część areny; rozwiązanie jest opisowe i nie ogranicza rasy.','Kopia ataku postaci jest oznaczona kolorem i kształtem, zawsze ograniczona do 1,2 ATK bossa, bez kopiowania całego builda.','Przy 66% i 33% HP zmienia układ ścian; co najmniej dwa wyjścia pozostają czytelne, aby nie karać postaci bez doskoku.','Wybór dialogu przed walką nie wzmacnia bossa. Nie blokuje się wyjścia po użyciu zapisu kontrolnego.'),
('B-08','Veyr — Architekt Jedynego Tonu',20,9600,140,56,150,1.8,'M24','Wyspa VI / Jądro Chóru','Faza 1 do 70%: przerwij trzy kanały. Faza 2 do 35%: przełączaj jedną z czterech kotwic. Faza 3: wybierz bezpieczną drogę dostarczenia prawa odmowy do centrum.','Każdy duży atak zapowiedziany 1,5–2 s; impuls 1,4 ATK, wiązka 1,8 ATK, podstawowe uderzenie 1,0 ATK. Brak natychmiastowego zabicia.','Po ostatniej fazie walka zatrzymuje się przed wyborem epilogu. Veyr pokazuje koszt wyłączenia, a przygotowana sieć przejmuje ochronę miast.','Porażka cofa do wejścia bieżącej fazy z pełnym HP/KI i odtworzonymi obiektami; nie usuwa zgód ani świadectw.')]
for bid,name,L,hp,atk,defn,speed,interval,quest,loc,mechanic,attacks,phase,recover in bosses:
 h(bid+' · '+name,2)
 table(['Poz.','HP','ATK','DEF','Ruch j./s','Atak co s'],[[L,hp,atk,defn,speed,interval]],[.1,.18,.16,.16,.2,.2])
 p('Miejsce: '+loc+'. Zadanie: '+quest+'. Mechanika: '+mechanic)
 p('Ataki: '+attacks+' Fazy: '+phase)
 p('Bezpieczne ponowienie: '+recover+' Nagroda: wyłącznie rozliczenie zadania, bez dodatkowego łupu z ciała.')
h('Reguły lochów',2)
p('Proponowane długości: pierwsze dwie wyprawy 12–18 minut, środkowe 20–30, finał do 40 z punktami zapisu. Zapis przy wejściu i po każdej zagadce. Telegrapy muszą działać bez dźwięku i rozróżniania czerwieni/zieleni. Skala siły bossa nie zależy od czasu grania ani wartości ekwipunku; ustawienie Dostępna Przygoda obniża obrażenia bossów o 25% i wydłuża ostrzeżenia o 0,5 s, bez zmiany nagrody. To nowa opcja do implementacji, nie obecna funkcja.')
p('Żadna mechanika nie wymaga konkretnej umiejętności, tanka, uzdrowiciela ani jednoczesnych interakcji kilku osób. Osłona bossa ma wyjście przez obiekt sceny. Warianty kooperacyjne mogą skalować HP o +60% na dodatkowego gracza, ale wymagają osobnego testu sieciowego i nie należą do lokalnej wersji kampanii.')
section('12. Zasady ekwipunku i liczenia statystyk')
p('ŹRÓDŁO: obecna gra posiada jedną broń, jeden pancerz i cztery podstawowe typy przedmiotów. PROPOZYCJA rozszerzenia: broń główna, głowa, korpus, dłonie, nogi, stopy, amulet i jeden pierścień. Strój rasy zachowuje sylwetkę; na początku wyposażenie może zmieniać statystyki i ikonę bez podmiany całego modelu. Narzędzia nosi się w osobnej zakładce i nie sumuje ich jako broni.')
p('W tabelach ATK, DEF, HP i KI oznaczają płaskie dodatki; kryt. pp to punkty procentowe, reg. to KI na sekundę. Wszystkie niewymienione premie wynoszą 0. Cena 0 oznacza brak sprzedaży u kupca, a nie darmowy nieograniczony zakup. Sprzedaż 0 oznacza brak przychodu. Ceny w monetach; stosy w sztukach. Wymagany poziom dotyczy użycia, nie podnoszenia. Rzadkość nie dodaje ukrytych statystyk.')
p('Porządek obliczeń projektu: zaokrąglona baza rasowa na poziomie + płaskie dodatki ekwipunku i jego ulepszeń → pasywki i premie procentowe z drzewka w kolejności obecnego silnika → efekty czasowe → obrażenia max(1, ATK × mnożnik − DEF celu / 2). Nie dodajemy osobnej statystyki siły zaklęć. Broń wspiera obecny atak rasy, więc kostur nie zamienia ataku Legendy w pocisk. Potwierdzenie dokładnej kolejności mnożników wymaga testu na rzeczywistym KitPort przed wdrożeniem wieloslotowego ekwipunku.')
p('Limit nowych dodatków z wyposażenia na poziomie 20: krytyk +6 pp, regeneracja KI +1/s, szybkość ruchu +0% — buty nie zmieniają decyzji właściciela o szybkości. Premie ponad limit są jawnie obcinane w podglądzie. Brak redukcji cooldownów na przedmiotach pierwszej kampanii. HP i KI nie odnawiają się przez zakładanie i zdejmowanie sprzętu; zachowywany jest procent zasobu z zaokrągleniem w dół, bez leczenia z pętli.')
p('Nowy plecak: 24 stosy ogólne oraz 30 stosów materiałów po 99. Depozyt: 48 stosów ogólnych oraz 30 materiałowych. To propozycja zastępująca obecne 12 miejsc, wymaga osobnej migracji, nie jest częścią już działającego depozytu. Klucze i dowody trafiają do kroniki, nie zajmują plecaka, są niesprzedawalne i mają odtwarzalny stan. Przedmiot założony, zablokowany lub ulubiony wymaga zdjęcia blokady przed sprzedażą lub zużyciem.')
h('Ulepszanie',2)
p('Istniejące Ostrze strażnika zachowuje swoje pojedyncze ulepszenie +4 ATK za 15 monet. Nowe bronie: maksymalnie +3; każdy stopień +2 ATK, opłaty kolejno 40/100/180, oprócz materiałów z receptury. Nowe pancerze: +1 DEF na stopień, maksymalnie +2, opłaty 30/80. Biżuteria bez ulepszeń. Sukces 100%, bez niszczenia i losowych statystyk; nie ma cofania ulepszeń dla odzyskania pełnego kosztu. Rozmontowanie zwraca 50% podstawowych materiałów w dół, bez monet i bez zwrotu katalizatora.')
p('Zestawy rasowe mają wspólny budżet liczb i odmienne nazwy/wygląd. Nie przyznają premii za noszenie kompletu. Dzięki temu znalezienie jednej dobrej części nie karze gracza utratą bonusu zestawu. Broń sygnowana daną kulturą może być używana przez każdą rasę po spełnieniu poziomu; animacja nadal pochodzi z własnego kitu.')
section('13. Katalog broni, pancerzy i biżuterii')
h('Przedmioty obecne — nie zmieniać ich po cichu',2)
legacy=[item('potion','Mikstura życia','użycie',1,price=8,sell=3,stack=99,effect='Leczy 40% maks. HP; wspólne odnowienie mikstur życia 6 s. Nie leczy zmarłej postaci.',status='ŹRÓDŁO'),item('tusk','Kieł dzika','materiał',1,sell=5,stack=99,effect='Materiał bez statystyk bojowych. Stare zapasy pozostają ważne; nie wymaga ponownego pojawienia się dzików w mieście.',status='ŹRÓDŁO'),item('sword','Ostrze strażnika','broń',1,atk=8,price=40,sell=18,effect='Istniejące ulepszenie jednorazowe +4 ATK za 15 monet; bazowe +8 bez ulepszenia.',status='ŹRÓDŁO'),item('vest','Kamizelka podróżnika','korpus',1,defn=3,price=25,sell=10,status='ŹRÓDŁO')]
item_table(legacy)
h('24 bronie regionalne — sześć etapów jakości',2)
p('Ten sam numer tieru oznacza identyczną siłę i cenę. Nazwa jest wyborem kultury, nie blokadą rasową. Wszystkie mają stos 1; źródłem są sklepy i receptury odblokowane na odpowiednim etapie. Zwykłe T1, dobre T2/T3, rzadkie T4/T5, mistrzowskie T6. T1 można otrzymać raz z warsztatu; nie jest nieograniczonym darmowym towarem.')
weapon_names={'V':['Drewniane ostrze próby','Szabla rzeczna','Ostrze ścieżek','Miecz Zielonego Traktu','Strażnik Rozlewisk','Ostrze Czterech Korzeni'],'A':['Kostur ucznia','Berło źródła','Laska jasnego atramentu','Kostur Białego Archiwum','Przewodnik Ciszy','Kostur Otwartej Pamięci'],'N':['Emiter szkoleniowy','Karabinek patrolowy','Emiter dwufazowy','Moduł Precyzyjnego Impulsu','Rozdzielacz Horyzontu','Emiter Wolnego Rdzenia'],'P':['Tępe ostrze próby','Tasak żarowy','Ostrze czarnej skały','Miecz Płomiennego Traktu','Klinga Przerwanej Przysięgi','Ostrze Ocalonego Świtu']}
for code,names in weapon_names.items():
 group=[]
 for i,name in enumerate(names):
  group.append(item(f'W-{code}{i+1}',name,'broń',[1,4,7,10,14,18][i],atk=[4,10,15,21,27,34][i],hp=20 if i==4 else 0,ki=8 if i==5 else 0,price=[0,120,260,480,780,1200][i],sell=[0,30,65,120,195,300][i],rarity=['zwykły','dobry','dobry','rzadki','rzadki','mistrzowski'][i]))
 h(dict(V='Planetarni',A='Mędrcy',N='Androidy',P='Legendy')[code],2);item_table(group)
h('Osiem broni z własną historią',2)
unique=[('U-W01','Nóż przewoźniczki',6,12,0,15,0,0,210,'Pomoc w S-V01 i zakup u Mio.'),('U-W02','Laska pustej paginy',8,15,0,0,10,0,320,'Po S-A03 u Mei.'),('U-W03','Emiter ręcznego sygnału',10,19,2,0,0,0,480,'Po S-N03 u MIRA-2.'),('U-W04','Klinga powrotu',10,20,0,20,0,0,480,'Po S-P03 u Yumi.'),('U-W05','Kotwica ratownika',14,25,3,20,0,0,780,'Liga po D05.'),('U-W06','Rysik ostatniego świadka',14,24,0,0,15,1,780,'Kolegium po S-A04.'),('U-W07','Ostrze odmowy',18,31,0,0,0,2,1200,'Sklep Ligi po M20.'),('U-W08','Latarnia w dłoni',18,29,2,20,10,0,1200,'Sklep Ligi po M20.')]
g=[]
for iid,name,L,atk,df,hp,ki,crit,price,source in unique:g.append(item(iid,name,'broń',L,atk,df,hp,ki,crit,price=price,sell=price//4,source=source,rarity='rzadki',effect='Alternatywa statystyczna, bez dodatkowego proca i bez zmiany mnożnika zdolności.'))
item_table(g)
h('30 części pancerza — pięć slotów × sześć tierów',2)
p('Nazwy poniżej są neutralnym opisem. Lokalny wariant może być szatą, skórą, modułem albo płytą bez zmiany liczb. Każda część ma stos 1. Minimalny poziom i dostęp odpowiadają broniom T1–T6. Nie trzeba zbierać kompletu; elementy łączy się dowolnie.')
slots=[('H','głowa','Nakrycie', [1,1,2,3,4,4],1, [0,30,60,100,150,220]),('C','korpus','Pancerz',[2,4,5,6,7,8],2,[0,60,120,200,300,480]),('G','dłonie','Rękawice',[1,1,2,2,3,4],1,[0,25,50,80,120,180]),('L','nogi','Osłony nóg',[1,3,3,4,5,6],2,[0,40,80,130,200,300]),('B','stopy','Buty',[1,1,2,3,3,4],1,[0,25,50,80,120,180])]
for code,slot,name,defs,hpm,prices in slots:
 group=[]
 for i in range(6):group.append(item(f'A-{code}{i+1}',name+' '+['ucznia','wędrowca','strażnika','łącznika','powiernika','Chóru'][i],slot,[1,4,7,10,14,18][i],defn=defs[i],hp=[0,3,6,9,12,15][i]*hpm,price=prices[i],sell=prices[i]//4))
 h(slot.capitalize(),2);item_table(group)
h('12 amuletów i pierścieni',2)
jewels=[('J-01','Amulet rzeki','amulet',4,12,0,0,0,0,90),('J-02','Pierścień ogrodnika','pierścień',4,8,0,1,0,0,90),('J-03','Amulet jasnej wody','amulet',7,0,12,0,0,.15,180),('J-04','Pierścień precyzji','pierścień',7,0,0,0,1,0,180),('J-05','Amulet postoju','amulet',10,30,0,2,0,0,300),('J-06','Pierścień drugiej próby','pierścień',10,0,14,0,0,.2,300),('J-07','Amulet ratownika','amulet',14,45,0,3,0,0,450),('J-08','Pierścień kartografa','pierścień',14,0,0,1,1.5,0,450),('J-09','Amulet wolnej jednostki','amulet',18,0,24,2,0,.35,600),('J-10','Pierścień świadków','pierścień',18,20,0,0,2,0,600),('J-11','Amulet wspólnego oddechu','amulet',20,30,18,2,0,.3,700),('J-12','Pamiątka Czterech Głosów','pierścień',20,20,10,1,1,0,0)]
g=[]
for iid,name,slot,L,hp,ki,df,crit,regen,price in jewels:
 g.append(item(iid,name,slot,L,defn=df,hp=hp,ki=ki,crit=crit,regen=regen,price=price,sell=price//4,source='M24 jednorazowo' if iid=='J-12' else 'Sklep regionalny / receptura',effect='Trzy warianty wyglądu epilogu mają identyczne liczby.' if iid=='J-12' else 'Brak efektu dodatkowego.'))
item_table(g)
section('14. Przedmioty użytkowe, materiały i receptury')
h('Osiem narzędzi',2)
tools=[('T-01','Młotek ucznia',1,0,'Pozwala wykonać receptury szkoleniowe przy warsztacie; nie zwiększa ataku.'),('T-02','Zestaw kartografa',4,60,'Umożliwia odpis trzech oznaczeń w kontraktach; nie odkrywa mapy automatycznie.'),('T-03','Sierp opiekuna',4,60,'Pozwala zebrać oznaczone zioło z węzła; 1 surowiec na zbiór.'),('T-04','Sonda analogowa',7,120,'Odczytuje stan przekaźnika bez połączenia z centralą; użycie 2 s.'),('T-05','Lampa szlakowa',7,100,'Oświetla znacznik w promieniu 180 j. przez 60 s; bez wpływu na agresję i obrażenia.'),('T-06','Zestaw ratownika',10,200,'Interakcja ratunkowa 3 s poza walką; nie leczy własnej postaci i nie wskrzesza bohaterów.'),('T-07','Prasa pieczęci',14,350,'Umożliwia warianty receptur Enso przy warsztacie; bez statystyk bojowych.'),('T-08','Pieczęć mistrza',18,0,'Potwierdza egzamin P06 i praktykę 600; nie daje ukrytej premii, nie zużywa się.')]
g=[]
for iid,name,L,price,effect in tools:g.append(item(iid,name,'narzędzie',L,price=price,sell=price//4,effect=effect,source='P01 / P06' if price==0 else 'Sklep narzędziowy'))
item_table(g)
h('16 nowych przedmiotów zużywalnych',2)
p('Wszystkie stosy do 99. Mikstury HP dzielą wspólne odnowienie 6 s z potion, napoje KI mają osobne wspólne odnowienie 12 s. Jedzenie ma jedno aktywne wzmocnienie: nowy posiłek zastępuje stary. Żaden efekt nie narasta przez ponowne użycie; licznik jest odświeżany. Użycie medyczne w śmierci niedozwolone. Brak teleportacji w walce lub z pominięciem wymaganego etapu zadania.')
consumables=[('U-01','Mały opatrunek',1,5,'Poza walką odnawia 20% maks. HP przez 5 s; trafienie przerywa. Odnowienie 10 s.'),('U-02','Napar oddechu',4,12,'Przywraca 20% maks. KI natychmiast; wspólne odnowienie KI 12 s.'),('U-03','Napar głębokiego źródła',10,30,'Przywraca 35% maks. KI; odnowienie KI 12 s.'),('U-04','Eliksir pełnego oddechu',18,60,'Przywraca 50% maks. KI; odnowienie KI 12 s.'),('U-05','Gęsta mikstura życia',10,24,'Leczy 50% maks. HP; wspólne odnowienie HP 6 s.'),('U-06','Mikstura ratunkowa',18,50,'Leczy 60% maks. HP; wspólne odnowienie HP 6 s. Nie usuwa kontroli ani podpalenia.'),('U-07','Chleb podróżny',1,6,'Przez 300 s +10 maks. HP. Nie przywraca HP przez ponowne jedzenie.'),('U-08','Zupa rzeczna',7,18,'Przez 300 s +25 maks. HP; grupa jedzenia.'),('U-09','Bulion żarowy',14,35,'Przez 300 s +40 maks. HP; grupa jedzenia.'),('U-10','Herbata źródeł',7,18,'Przez 300 s +0,15 KI/s; grupa jedzenia.'),('U-11','Racja serwisowa',14,35,'Przez 300 s +0,25 KI/s; działa tak samo na każdą rasę; grupa jedzenia.'),('U-12','Tonik oczyszczenia',10,28,'Usuwa jedno najstarsze zatrucie, bez odporności następczej; odnowienie 30 s.'),('U-13','Maść chłodząca',10,28,'Usuwa jedno najstarsze podpalenie, bez odporności następczej; odnowienie 30 s wspólne z U-12.'),('U-14','Sygnał powrotu',4,15,'Po 8 s nieprzerwanej aktywacji poza walką wraca do ostatniego odkrytego miasta; nie działa w fazie bossa.'),('U-15','Osłona zapachu',7,20,'Przez 30 s promień wykrywania przez zwykłe bestie −20%; nie działa na bossów ani po rozpoczęciu pościgu. Odnowienie 60 s.'),('U-16','Raca ratunkowa',4,10,'Oznacza punkt na minimapie przez 60 s; brak obrażeń i brak przywołania NPC bojowego. Odnowienie 10 s.')]
g=[]
for iid,name,L,price,effect in consumables:g.append(item(iid,name,'użycie',L,price=price,sell=price//4,stack=99,effect=effect,source='Kupiec / receptura po osiągnięciu poziomu'))
item_table(g)
h('Sześć półproduktów rzemieślniczych',2)
resources=[('R-01','Zestaw naprawczy',4,18,'Jedna naprawa obiektu szlaku; nie przywraca trwałości sprzętu, bo nie wprowadzamy jej systemu.'),('R-02','Spoiwo korzeniowe',4,20,'Podstawowy składnik broni i narzędzi.'),('R-03','Pasta pieczęci',7,35,'Podstawowy składnik biżuterii i odpisów.'),('R-04','Stabilny przewodnik',10,55,'Składnik broni T4 i wyżej, bez własnych statystyk.'),('R-05','Hartowana płytka',14,75,'Składnik pancerzy T5 i T6.'),('R-06','Katalizator zgody',18,120,'Składnik ulepszania mistrzowskiego; zużywany przy operacji, bez losowej szansy sukcesu.')]
g=[]
for iid,name,L,price,effect in resources:g.append(item(iid,name,'materiał',L,price=price,sell=price//4,stack=99,effect=effect))
item_table(g)
h('12 kluczy i dowodów kampanii',2)
key_names=['Kompas Świadka','Bilet Ligi','Protokół czterech relacji','Pierwszy ton','Zapis ewakuacji I','Klucz audytu','Wyłącznik zgody','Zapis ewakuacji II','Drugi ton','Trzeci ton','Zapis ewakuacji III','Projekt Paktu']
g=[]
for i,name in enumerate(key_names,1):
 g.append(item(f'K-{i:02}',name,'kronika',1,effect='Klucz lub dowód, bez premii bojowej. Stos 1; nie można sprzedać, wyrzucić, rozmontować ani przenieść do depozytu. Odtwarza się z flag zadania.',source='Jednorazowy etap kampanii'))
item_table(g)
p('Klucze nie mają opłat i nie służą do otwierania skrzynek z losowymi nagrodami. Dostęp do finału wynika z ukończenia etapów, więc przypadkowy brak ikony po migracji można naprawić z dziennika. Przedmioty treningowe prologu są obiektami samouczka, nie towarami tego katalogu.')
h('Materiały z kanonicznego bestiariusza',2)
p('ŹRÓDŁO: poniższe nazwy pochodzą z łupów 40 przeciwników. Wartość skupu = zaokrąglenie w górę przy połówce z (2 + 1,5 × najniższy poziom źródła). Wszystkie mają ATK/DEF/HP/KI/krytyk/regenerację = 0, stos 99 i cenę zakupu 0 (standardowy sklep ich nie oferuje). Przedmiot o nazwie Zielone ostrze w łupie jest materiałem, a nie automatycznie bronią — typ wyznacza katalog, nie brzmienie nazwy.')
def slug(s):
 return re.sub('[^a-z0-9]+','-',unicodedata.normalize('NFD',s.replace('ł','l').replace('Ł','L')).encode('ascii','ignore').decode().lower()).strip('-')
mats={}
for m in MONSTERS:
 for name in m['loot'].split(','):
  name=name.strip();mid=slug(name)
  if mid not in mats:mats[mid]=dict(name=name,level=m['level'],sources=[m['name']])
  else:
   mats[mid]['level']=min(mats[mid]['level'],m['level']);mats[mid]['sources'].append(m['name'])
for mid,m in mats.items():item(mid,m['name'],'materiał',m['level'],sell=math.floor(2+1.5*m['level']+.5),stack=99,source=', '.join(m['sources']),status='ŹRÓDŁO')
table(['ID / materiał','Poziom źródła','Skup','Przeciwnik — źródło'],[[mid+'\n'+m['name'],m['level'],math.floor(2+1.5*m['level']+.5),', '.join(m['sources'])] for mid,m in mats.items()],[.32,.12,.12,.44])
p('Limit 30 typów noszonych materiałów nie oznacza, że katalog ma tylko 30 wpisów. Przy pełnej zakładce gracz wybiera, co odłożyć; gwarantowane dowody fabularne nigdy nie wpadają do tej kategorii. Wykorzystanie materiałów rzadkich w obowiązkowym głównym zadaniu wymaga gwarantowanego alternatywnego źródła, nie wielokrotnego losowania łupu.')
h('Receptury — kompletne wejścia i wyniki',2)
p('Każda receptura daje dokładnie 1 wskazany wynik, sukces 100%. Opłata jest pobierana oprócz materiałów. Cena katalogowa przedmiotu to cena zakupu gotowego towaru, a nie opłata receptury. Surowce wymienione poniżej są ID katalogu; prowizja i zużycie są jedną transakcją. Przy braku miejsca wynik czeka na stanowisku przypisanym do postaci i nie może zostać odebrany drugi raz.')
# Regional core materials: always taken from the existing roster, not invented synonyms.
world_codes={'V':'verdant','A':'aether','N':'nexus','P':'pyra'}
regional={code:[slug(m['loot'].split(',')[0].strip()) for m in MONSTERS if m['world']==world] for code,world in world_codes.items()}
for code in world_codes:
 for tier in range(1,7):
  output=f'W-{code}{tier}';material=regional[code][[0,1,2,4,6,8][tier-1]]
  recipes.append(dict(id=f'RC-W{code}{tier}',output=output,level=[1,4,7,10,14,18][tier-1],inputs={material:[1,2,3,4,4,5][tier-1],**({'R-04':1} if tier>=4 else {})},fee=[0,20,45,80,130,200][tier-1]))
for code,slot,name,defs,hpm,prices in slots:
 for tier in range(1,7):
  material=regional['V'][[0,1,2,4,6,8][tier-1]]
  recipes.append(dict(id=f'RC-A{code}{tier}',output=f'A-{code}{tier}',level=[1,4,7,10,14,18][tier-1],inputs={material:1+tier//2,**({'R-05':1} if tier>=5 else {})},fee=prices[tier-1]//5))
for idx in range(1,12):
 it=next(x for x in items if x['id']==f'J-{idx:02}')
 recipes.append(dict(id=f'RC-J{idx:02}',output=it['id'],level=it['level'],inputs={'R-03':1+idx//4,regional['A'][min(9,idx-1)]:2},fee=it['buy']//5))
extra_recipes=[('T-01',1,{},0),('T-02',4,{'R-01':1},10),('T-03',4,{'R-02':1},10),('T-04',7,{'R-01':2},20),('T-05',7,{'R-03':1},15),('T-06',10,{'R-01':2,'R-02':1},30),('T-07',14,{'R-03':2,'R-04':1},50),('R-01',4,{regional['N'][0]:1},5),('R-02',4,{regional['V'][0]:1},5),('R-03',7,{regional['A'][1]:1},8),('R-04',10,{regional['N'][2]:1},12),('R-05',14,{regional['P'][4]:1},15),('R-06',18,{'R-02':1,'R-03':1,'R-04':1},20)]
for n,(output,L,inputs,fee) in enumerate(extra_recipes,1):recipes.append(dict(id=f'RC-T{n:02}',output=output,level=L,inputs=inputs,fee=fee))
for idx,(_,name,L,price,effect) in enumerate(consumables,1):
 # Materials are generic carriers; effect remains defined by the resulting item.
 mat=regional['V'][0 if L<7 else 2 if L<14 else 4]
 recipes.append(dict(id=f'RC-U{idx:02}',output=f'U-{idx:02}',level=L,inputs={mat:1 if L<10 else 2},fee=max(1,price//5)))
table(['Receptura','Wynik ×1','Poz.','Składniki','Opłata'],[[r['id'],r['output'],r['level'],', '.join(f'{k} ×{v}' for k,v in r['inputs'].items()) or 'zestaw szkoleniowy — jednorazowo',r['fee']] for r in recipes],[.15,.14,.07,.53,.11])
p('RC-T01 jest jednorazowa na postać i wyłącznie podczas P01. Nie można wytwarzać darmowych narzędzi do sprzedaży, ich skup wynosi 0. Receptury T1 korzystające z materiału nie wymagają dodatkowego kompletu szkoleniowego. Receptury nie korzystają z własnych wyników i nie tworzą cykli.')
p('Ulepszenie nowej broni +1/+2/+3: odpowiednio 1/2/3 × R-04 oraz 40/100/180 monet; +3 dodatkowo 1 × R-06. Pancerz +1/+2: 1/2 × R-05 i 30/80 monet. Operacje zachowują ID egzemplarza i blokują go na czas transakcji, aby nie kopiować ulepszeń przy przenoszeniu do skrzyni. Podane opłaty nie zastępują istniejącego ulepszenia sword za 15.')
section('15. Statystyki ras i pełne drzewka — źródła')
p('Poniższe dane nie są nowymi propozycjami tej księgi. Przepisano je z aneksu właściciela i źródeł runtime. Status historyczny meta.status w JSON nie zastępuje późniejszych decyzji i implementacji. Szybkość uwzględnia decyzję właściciela: +5% wartości bazowej na każdy poziom do 20. Wartości nie zawierają ekwipunku, pasywek ani czasowych wzmocnień. Zaokrąglenie całkowitych HP/KI/ATK/DEF/ruchu do najbliższej liczby, połówki w górę.')
for race,r in ANNEX['races'].items():
 h(r['raceName']+' — '+r['currentGameRealm'],2)
 p('Rola: '+r['role']+'. Mechanika: '+r['raceMechanic']+'. Zdolność początkowa: '+r['startingAbility']+'.')
 rows=[]
 for L in [1,5,10,15,20]:
  b=r['base'];g=r['perLevel'];v={k:b[k]+g[k]*(L-1) for k in b};v['speed']=b['speed']*(1+.05*(L-1))
  rows.append([L,*[math.floor(v[k]+.5) for k in ['hp','ki','attack','defense','speed']],f"{v['kiRegen']:.2f}",f"{v['criticalChancePercent']:.2f}",v['attackIntervalMs']])
 table(['Poz.','HP','KI','ATK','DEF','j./s','KI/s','Kryt. %','Atak ms'],rows,[.07,.1,.1,.1,.1,.1,.11,.11,.11])
 for branch,bd in r['skillBranches'].items():p(branch+' — '+bd['name'])
 table(['Kod / nazwa','Poz. / wymóg','Efekt ze źródła'],[[n['id']+' / '+n['name'],str(n['minLevel'])+' / '+(' lub '.join(n['requiresAny']) or '—'),n['effect']] for n in r['nodes']],[.25,.15,.6])
 p('Pary wykluczające: A7/A8, B7/B8, C7/C8. Dwadzieścia punktów nie wystarczy na wszystkie węzły; fabuła nie znosi tego ograniczenia. Wybór wyglądu broni nie zmienia tej tabeli.')
section('16. Bestiariusz — 40 istniejących przeciwników')
p('ŹRÓDŁO: art/production/enemies/roster.json, zgodne z dokumentem bestiariusza właściciela. Są to dane przeciwników, a nie instrukcja dodania spawnów do miast. Rozmieszczenie opisujemy jako przyszłe zadanie po ukończeniu kontynentów. Podane XP jest nagrodą zwykłego przeciwnika; nie dotyczy bossów projektu.')
for code,world in world_codes.items():
 h(next(w[0] for w in worlds if {'verdant':'Verdantia','aether':'Aetheria','nexus':'Nexus-9','pyra':'Pyra'}[world]==w[0]),2)
 ms=[m for m in MONSTERS if m['world']==world]
 table(['Nazwa / ID','Poz.','HP','ATK','DEF','XP','Zasięg / agresja'],[[m['name']+'\n'+m['id'],m['level'],m['stats']['hp'],m['stats']['atk'],m['stats']['def'],m['stats']['xp'],str(m['range'])+' / '+str(m['agro'])] for m in ms],[.37,.07,.1,.1,.1,.1,.16])
 for m in ms:
  h(m['name'],3);p('Zachowanie: '+m['behavior']+' Zdolności: '+'; '.join(m['skills'])+'. Łup: '+m['loot']+'. Słabość w danych: '+m['weakness']+'.')
 p('Nie wszystkie opisane słabości mają obecnie wykonalny typ ataku w grze. Nowe toniki w tym projekcie usuwają statusy, ale nie tworzą automatycznie systemu obrażeń wodnych, zimna czy odporności procentowych. Takiego systemu nie należy zakładać na podstawie samego opisu bestii.')
section('17. Sceny, dialogi i konsekwencje')
p('Poniższe sceny są wzorcem tonu i dramaturgii. Zachowują sprawczość gracza, nie próbują uzasadnić każdego systemu objaśnieniem technicznym. Wydarzenie ma pokazać relację przez działanie, a dopiero potem wyjaśnić jej historię. Każdą dłuższą rozmowę można zatrzymać i wznowić; kluczowy dowód trafia do dziennika niezależnie od pominięcia tekstu.')
scenes=[
('Pierwszy wieczór w Zielonej Przystani','O-V05 / gospoda Liny','Lina stawia na stole zupę. W głębi sali dziecko próbuje rozświetlić mały kamień. Światło nie przychodzi. Przez chwilę wszyscy patrzą na własne dłonie. Aira wstaje, ale zamiast przywołać KI, bierze zwykłą lampę.','Lina: „Zupa nie potrzebuje pozwolenia świata, żeby stygnąć. Pomóż mi ją roznieść”. Aira: „Nie musicie umieć tego wyjaśnić. Na razie wystarczy, że będziemy się widzieć”.','Gracz może powiedzieć: „Ja coś słyszałem” albo najpierw pomóc rozdać lampy. Aira odpowie dopiero po wykonaniu pomocy, aby niezwykłość bohatera nie odebrała sceny mieszkańcom.','Po Ciszy dziecko nie nazywa bohatera zbawcą. Pyta, czy jutro lampa też będzie działała. Zwykła lampa staje się drobnym motywem powracającym w finale.'),
('Stół bez miejsca honorowego','M03 / Wyspa Pierwszego Echa','Delegaci spierają się o to, gdzie usiąść. Nima odwraca mapę i kładzie ją na ziemi. Wszyscy muszą uklęknąć albo usiąść na skrzyniach. Żadna strona stołu nie wskazuje północy.','Kaena: „Jeśli mamy walczyć, powiedzmy od razu z kim”. LYRA-7: „Nie znamy jeszcze zbioru przyczyn”. Sora: „A ja nie wiem, czy wszystkie przyczyny chcą zostać nazwane”. Aira: „Zacznijmy od tego, co naprawdę widzieliśmy”.','Gracz wybiera jedną relację do wysłuchania jako pierwszą; pozostałe nie znikają. Dziennik zaznacza fakty, hipotezy i sprzeczności osobno.','Ta sama animacja mapy wraca po M16, już z czterema podpisami. Zmiana wynika z relacji, nie z magicznego przedmiotu.'),
('Rozmowa z ocalałą','C-A2 / dom poza dawną linią powodzi','Aira przygotowała przemowę, lecz właścicielka domu prosi ją, żeby najpierw pomogła przenieść ciężką ławę. Dopiero podczas pracy wskazuje poziom wody na ścianie.','Ocalała: „Nie potrzebuję, żebyś powiedziała, że nie wiedziałaś. Potrzebuję, żeby na następnej mapie był mój dom”. Aira: „Będzie. I zostanie tam również moja pierwsza pomyłka”.','Gracz może zapytać o pomoc materialną albo o zapis świadectwa. Nie ma opcji wymuszenia przebaczenia i nie istnieje ukryty test dobrego zakończenia tej rozmowy.','Naprawiona droga pozostaje widoczna w epilogu; dom nie zostaje nagle warsztatem gracza ani nagrodą za czyjąś krzywdę.'),
('Oferta Veyra','M12 / neutralna projekcja','W sali nie ma tronu. Veyr układa cztery krzesła i pokazuje model miasta, w którym nikt nie spóźnił się na ewakuację. Przy każdym uratowanym domu świeci imię.','Veyr: „Każda z tych osób żyje, bo ktoś nie czekał na zgodę wszystkich”. Gracz: „A kto powiedział im, że nigdy nie będą mogli odejść?”. Veyr: „Powrót do zagrożenia nie jest wolnością. Jest błędem, któremu umiem zapobiec”.','Gracz może przyznać mu rację w kwestii ratunku, zażądać prawa wyjścia albo zakończyć prezentację. Przyznanie konkretnej racji nie oznacza zgody na przymus i nie zamyka dobrego finału.','Antagonista nie szydzi. Najgroźniejszy jest wtedy, kiedy potrafi pokazać prawdziwy sukces swojego rozwiązania.'),
('Eko-0 odmawia','S-N04 / warsztat','Na ekranie pojawia się polecenie testu. Eko-0 stoi nieruchomo i nie przesyła potwierdzenia. Technik sięga do przełącznika awaryjnego. Gracz może poprosić, aby zaczekał.','Eko-0: „Zakończyłem obliczenia. Rozumiem cel. Nie chcę wziąć udziału”. Technik: „To zostawi nam brakującą próbkę”. LYRA-7: „Zapiszmy więc brak próbki. To też jest wynik”.','Po odmowie test kończy się prawidłowo. Dalsza rozmowa może wyjaśnić obawy, ale nie zmienia odmowy w zagadkę do obejścia perswazją.','Nowa sieć z M20 pokazuje stan „odmowa” jako prawidłowy zielono obrysowany dokument, opisany także tekstem. Motyw trafia do finałowego wyłączenia kontroli.'),
('Przysięga po ratunku','C-K3 / dziedziniec Twierdzy','Kaena zaczyna przemowę w dawnym rytmie klanowej pieśni, ale zatrzymuje się przed wersem o posłuszeństwie. Zamiast dopisać nowy wers sama, prosi o propozycje ludzi stojących na dziedzińcu.','Kaena: „Obiecywałam, że nigdy się nie cofnę. Dzisiaj obiecuję coś trudniejszego: zawrócę, jeśli ktoś został z tyłu”. Rokan: „A jeśli przez to przegramy?”. Kaena: „Wtedy przestaniemy nazywać każdą przegraną hańbą”.','Gracz może poprzeć treść albo zapytać o granice rozkazu. Zastrzeżenie nie obniża zaufania: pokazuje, że nowa zasada ma działać również wobec Kaeny.','Mieszkańcy nie klaszczą od razu. Najpierw ktoś pyta, czy nowa zasada obejmuje również obcy klan. Dopiero odpowiedź zamyka scenę.'),
('Przed ostatnim rejsem','M22 / port','W porcie czekają skrzynie przygotowane przez ludzi z pobocznych zadań. Jeśli gracz im nie pomógł, skrzynie noszą znaki Ligi, a nie brakuje ich wcale. Obecność osobistych historii zmienia autorów pomocy, nie możliwość finału.','Nima: „Kiedyś chciałam znaleźć jedną drogę, na której nic się nie zgubi. Teraz wolę mieć kilka i wiedzieć, kto na nich czeka”.','Gracz widzi podsumowanie: ochrona portów gotowa, świadectwa zabezpieczone, opcjonalne zgody sojuszników 0–4. Potwierdzenie rejsu wyjaśnia, że po finale świat pozostaje dostępny.','Nie wykorzystujemy tej sceny do zawstydzania gracza nieukończonymi zadaniami. Może wrócić do wątków osobistych po podstawowym zakończeniu, a wariant finału obejrzeć z zapisu kontrolnego.'),
('Ostatnia odpowiedź','M24 / Jądro','Veyr otrzymuje pierwszą odmowę, której nie może skasować. Świat nie rozpada się natychmiast. Na mapie zapalają się małe lokalne punkty — nie jeden ogromny promień bohatera.','Veyr: „Nie potrafię zagwarantować, że nie popełnicie tego samego błędu”. Gracz: „Nie proszę o gwarancję. Proszę, żebyś nie odbierał nam możliwości naprawy”.','Wybór ustroju sieci następuje po walce. Opis podaje koszt i zaletę każdej opcji. Gra nie oznacza ich kolorem dobra i zła, ale wszystkie muszą chronić prawo odmowy.','Epilog wraca do lampy w gospodzie. Tym razem dziecko pyta nie o to, czy świat pozwoli ją zapalić, tylko komu ma ją zanieść.')]
for title,where,staging,dialogue,choice,echo in scenes:
 h(title,2);p('Miejsce i etap: '+where+'.');p(staging);p(dialogue);p('Udział gracza: '+choice);p('Powracający motyw: '+echo)
h('Macierz trwałych konsekwencji',2)
table(['Decyzja','Zapis','Widoczny rezultat'],[['Podpisy, motto, nazwa własna','origin.signature / origin.motto','Listy i pamiątka używają własnego określenia gracza. Bez premii liczbowej.'],['Publikacja świadectw','witness.<id>.consent = private/public/redacted','Wystawa pokazuje uzgodniony zakres danych, bez kasowania dowodu.'],['Rozwiązanie lokalnego sporu','quest.<id>.choice = A/B','Detal krajobrazu, rozmowa NPC i list z wybranego rozwiązania.'],['Dobrowolna zgoda sojusznika','ally.<id>.consent = true','Cztery zgody udostępniają wariant Cichego Strażnika.'],['Porządek nowej sieci','ending.model = distributed/pact/adviser','Epilogi i wygląd J-12, zawsze te same statystyki.'],['Ponowne obejrzenie finału','chronicle.replayEnding','Osobna kronika wariantów, bez ponownego złota, XP i przedmiotu.']],[.28,.34,.38])
section('18. Balans: wyliczenia i scenariusze kontroli')
origin_xp=sum(x['xp'] for x in quests if x['id'].startswith('O-V'))
main_xp=sum(x['xp'] for x in quests if x['id'].startswith('M'))
main_gold=sum(x['gold'] for x in quests if x['id'].startswith('M'))
selected=[f'S-{c}{i:02}' for c in 'VANP' for i in [1,3,5]]
side_xp=sum(x['xp'] for x in quests if x['id'] in selected)
side_gold=sum(x['gold'] for x in quests if x['id'] in selected)
pre_final=origin_xp+sum(x['xp'] for x in quests if x['id'].startswith('M') and x['id'] not in ['M23','M24'])+side_xp
p(f'Kontrola XP: własny prolog {origin_xp}; kampania wspólna {main_xp}; przykładowe 12 pobocznych (S-01, S-03, S-05 na każdym kontynencie) {side_xp}. Razem {origin_xp+main_xp+side_xp} XP, bez zabijania zwykłych potworów. Jeszcze przed M23 gracz ma {pre_final} XP, więc osiąga poziom 20 wymagający 12 160. To jedna sprawdzona ścieżka, nie obietnica, że dowolne 12 najwcześniejszych zadań wystarczy. Dziennik musi sugerować późniejsze zadania o odpowiedniej wartości.')
origin_gold=sum(x['gold'] for x in quests if x['id'].startswith('O-V'))
p(f'Kontrola monet tej samej ścieżki: prolog {origin_gold}, główne {main_gold}, wybrane poboczne {side_gold}; razem {origin_gold+main_gold+side_gold}, plus istniejące 20 monet startowych. Nie liczymy skupu łupów, osobistych historii ani kontraktów. Docelowy komplet: broń T6 1200, pancerze T6 1360, J-11 700, J-12 z finału 0 = 3260. Pełne ulepszenia nowych części: 870 opłat plus materiały; nie są wymagane do ukończenia. Zostaje budżet na podstawowe zakupy i część podróży, lecz materiały i nadmiar usług wymagają dodatkowych wypraw lub rzemiosła. Przed finałem rolę J-12 pełni dowolny tańszy pierścień; nie zakładamy dostępu do nagrody wcześniej.')
p('Przykład obrażeń bez pasywek: Planetarny poziom 10 ma 48 ATK. W-V4 daje +21, razem 69. Zwykły atak ×1 przeciw DEF 24: 69 − 12 = 57 obrażeń. Istniejące Ostrze strażnika +8 daje 44 przeciw tej samej obronie. To kontrola sensu zmiany broni, nie pomiar całego DPS z kombinacją trzech ciosów i trafieniami krytycznymi.')
p('Przykład maksymalnego wyposażenia bez pasywek: Planetarny na 20 ma 809 HP, 126 KI, 88 ATK, 51 DEF. Broń W-V6 +3: +40 ATK i +8 KI. Komplet pancerza T6 +2 każdy: +36 DEF, +105 HP. J-11 i J-12 razem: +50 HP, +28 KI, +3 DEF, +1 pp krytyka i +0,3 KI/s. Wynik: 964 HP, 162 KI, 128 ATK, 90 DEF. Bez premii za komplet. Kontrola finału: podstawowy cios Veyra 140 − 90/2 = 95 obrażeń; postać przeżywa około 11 takich trafień bez leczenia. Cios postaci przeciw DEF 56 daje 100 obrażeń przed seriami i krytykiem. Liczby wymagają testu ruchu i zdolności, nie tylko porównania puli HP.')
p('Błędne założenie do uniknięcia: HP Planetarnego poziom 20 to 125 + 36 × 19 = 809, a nie 845. Wszystkie tabele liczone są od L−1. Ta zasada obowiązuje również przy dodatkach KI i obrony. Nowy katalog nie zmienia przyrostów ras.')
table(['Próba','Warunek zaliczenia','Ryzyko'],[['Cztery rasy, brak mikstur','Każdy boss do pokonania bez wybranej gałęzi, przy przeciętnym sprzęcie poziomu.','Niektóre kity mają krótszy zasięg i mniej odporności.'],['Słabszy sprzęt','Finał możliwy z bronią T5 i mieszanką T4/T5 w opcji Dostępna Przygoda.','Nie ustanawiać obowiązkowego grindwallu T6.'],['Wybór bez walki','Quest ma tyle samo XP/monet co rozwiązanie z walką.','XP przeciwników pozostaje dodatkiem, nie bazą bilansu kampanii.'],['Brak monet','Powrót do domu i główna fabuła pozostają dostępne.','Nie dopuścić do blokady przez opłaty portowe.'],['Maksymalna reputacja','Zniżka nie tworzy zysku na odsprzedaży.','Ceny dawnych przedmiotów mają inne współczynniki.'],['Przenoszenie ulepszonej broni','Dokładnie jeden egzemplarz zachowuje upgrade przy depozycie, handlu i reloadzie.','Nowe ID egzemplarzy wymagają migracji ze starych liczników.']],[.23,.46,.31])
section('19. Plan wdrożenia bez naruszania obecnej gry')
p('Ten dokument nie dodaje spawnów ani nie aktywuje żadnego questu. Kolejność wdrożenia musi respektować zleconą budowę miast i późniejsze tworzenie zewnętrznych stref. Mapa i globus zachowują wspólną geometrię; scenariusz wskazuje funkcje lokacji, nie nowe arbitralne współrzędne.')
table(['Etap','Zakres','Odbiór'],[['A. Jedno miasto','Zielona Przystań, sześć usług, odtwarzalne wejścia i depozyt.','Bez wrogów, poprawne zapisy, czytelność na telefonie.'],['B. Fundament questów','Nowy dziennik, definicje etapów, flagi wyborów, jednorazowe nagrody i migracje dawnych zadań.','Wczytanie starych postaci bez podwójnej wypłaty i bez utraty ich postępu.'],['C. Prolog jednej rasy','O-V01–06 oraz jedna zewnętrzna trasa po osobnej akceptacji spawnów.','90–120 min gry bez narzędzi debugowania i bez brakujących NPC.'],['D. Ekwipunek','Egzemplarze, nowe sloty, porównanie statystyk, receptury, transakcje.','Brak duplikacji, jasna migracja sword/vest/upgrade i zajętych miejsc.'],['E. Akt I','M01–04, podróże, pierwsza wyspa, B-01 i cztery poboczne historie.','Pełna pętla od początku bez wymuszania rasy i konkretnego builda.'],['F. Pozostałe pochodzenia','Trzy prologi i indywidualne dialogi już wspólnego aktu.','Równy XP/gold, odmienna treść, brak kopiowania tożsamości NPC.'],['G. Akty II–VI','Pozostałe zadania, osiem bossów, sojusznicy i epilogi.','Wszystkie bramki poziomu osiągalne bez powtarzalnego farmienia.'],['H. Odbiór kampanii','Testy funkcjonalne, mobilne, wydajnościowe, dostępności i balansowe.','Osobna zgoda właściciela przed scaleniem i publikacją.']],[.2,.44,.36])
h('Kontrakt danych zadania',2)
p('Definicja: id, version, type, requiredLevel, prerequisites, giverId, factionId, stages, objectiveType, targetId, quantity, guaranteedSource, choices, flags, rewards, replayPolicy. Stan postaci: stageId, counters, choiceId, claimed, objectiveReceipts. Liczniki używają zdarzeń z unikalnym eventId, aby wejście do miasta albo ponowne wczytanie sceny nie naliczało celu drugi raz. Stan „odebrano nagrodę” zapisuje się razem z walutą i przedmiotem.')
p('Cele: talk, visit, inspect, deliver, craft, equip, train, rescue, solve, defeatBoss, consent. Cele visit/inspect nie mogą zaliczać się z samego otwarcia mapy; wymagają wejścia w obszar albo interakcji z obiektem. Cele defeatBoss korzystają z identyfikatora konkretnego spotkania, a nie liczby zabitych ogólnych przeciwników. Odtwarzalny klucz nigdy nie pochodzi z niegwarantowanej tabeli dropu.')
p('Wybory: każda opisana para ma zapis quest.<ID>.choice = A/B, z tekstem i skutkami widocznymi przed ostatecznym zatwierdzeniem. Ważne zgody świadków i sojuszników mają osobne flagi. Wejście do następnego aktu nie odczytuje ukrytej sumy punktów moralności. Zlecenie zakończenia nie może zużyć przedmiotu należącego do innego slotu postaci.')
h('Migracja i bezpieczeństwo',2)
p('Nie zmieniać bieżącego formatu zapisu wyłącznie na podstawie tej księgi. Nowy schemat powinien mieć osobną wersję, surową kopię odzyskiwania i walidację danych. Stare sword i vest stają się jednym rozpoznawalnym egzemplarzem z zachowaniem założenia oraz upgrade. Licznik wielu mieczy wymaga jednoznacznego wskazania, który egzemplarz jest ulepszony; nie kopiować flagi na wszystkie sztuki. Nowsze nieznane zapisy pozostają nietknięte. Chronić konflikty dwóch kart.')
p('Lokalny system nie daje gwarancji uczciwego handlu między graczami. Projekt ekonomii nie upoważnia do dodania rynku sieciowego, PvP, wspólnych banków ani serwerowego depozytu. Prywatna przestrzeń /test pozostaje osobnym systemem i nie jest miejscem przechowywania danych gracza. Nowa fabuła nie zmienia uprawnień usług zewnętrznych.')
h('Odbiór zawartości',2)
p('Każdy quest: nowa postać, postać po migracji, przerwanie na każdym etapie, reload w środku rozmowy, zmiana aktywnej postaci, pełen plecak, brak monet, śmierć poza miastem, powtórne kliknięcie nagrody, dwie karty, brak docelowego przedmiotu, wyjście przed ostateczną decyzją. Każdy boss: cztery rasy, dotyk w obu orientacjach, brak doskoku, tekstowe telegrapy, ponowienie fazy i zachowane klucze. Każda receptura: brak składnika, pełny wynik, ulubiony/założony egzemplarz, ponowny odbiór i przerwana transakcja.')
section('20. Źródła, decyzje do podjęcia i dalsze sezony')
h('Źródła z repozytorium',2)
sources=[('docs/design/RASY_I_ETAPY.md','Tożsamości czterech ras i rozdzielenie koncepcji od implementacji.'),('docs/design/data/character-progression-1-20.json','Bazy ras, przyrosty, wszystkie 116 węzłów; historyczne meta.status nie jest stanem aktualnego wdrożenia.'),('src/game/kit/nodes.generated.ts; kit/balance.ts; kit/progression.ts','Kontrola nazw, szybkości, punktów, zależności i wykluczeń.'),('docs/DECISIONS.md; docs/GAMEPLAY-RACES-AND-MONSTERS.md','Późniejsze zatwierdzenia właściciela i lista ograniczeń systemów.'),('art/production/enemies/roster.json; docs/design/BESTIARY-OWNER-2026-10-22.html','40 przeciwników, statystyki, łupy i zachowania.'),('src/game/session.ts','Cztery obecne przedmioty, ich ceny, próg XP, baza mikstury i zachowanie lokalnej sesji.'),('src/game/world/worlds.ts; world/regions/*.json','Nazwy miast i mieszkańców.'),('docs/PLANET-GEOMETRY-2026-10-22.md','Superior, 80 000 jednostek, cztery stolice i sześć wysp.'),('docs/VERDANTIA-FUNCTIONAL-CITY-2026-10-23.md; docs/CITY-INTEGRATION-CONTRACT-2026-10-23.md','Podział usług i bezpieczne miasto oraz zakres pracy nad wspólnymi mechanikami.')]
table(['Ścieżka źródłowa','Wykorzystanie'],sources,[.5,.5])
p('Punkt odniesienia: commit '+SOURCE_SHA+'. Pliki źródłowe mają SHA-256 w dołączonym manifest.json. Nie przedstawiamy oryginalnych ilustracji PDF ani cudzych grafik w tej księdze. Okładka i ornamenty są prostą autorską grafiką wektorową generowaną kodem; prawa do istniejących zasobów gry pozostają osobną sprawą.')
h('Decyzje właściciela przed produkcją treści',2)
for s in ['Zaakceptować lub zmienić temat Chóru, tożsamość Veyra i trzy warianty epilogu.', 'Wybrać skalę pierwszej dostawy: jeden prolog i Akt I przed pełną kampanią.', 'Zatwierdzić liczbę nowych slotów oraz zasady migracji egzemplarzy; tabela nie jest poleceniem zmiany działającego zapisu.', 'Przyjąć liczby katalogu jako start do testów albo określić inny pułap siły sprzętu.', 'Zatwierdzić nazwy nowych miast, wysp i frakcji; istniejących stolic oraz ras nie zmieniono.', 'Oddzielnie dopuścić rozmieszczenie potworów poza miastami po zakończeniu kontynentów.', 'Ustalić odbiór fizycznych urządzeń, grafiki, dźwięku i tempa. Dopiero osobna decyzja może uruchomić scalanie i publikację.']:
 p(s)
h('Dalszy rozwój bez unieważniania finału',2)
p('Sezon II — Morze między głosami: Liga odkrywa osady, które nie należały do dawnego Chóru. Konflikt dotyczy prawa do pozostania poza siecią, nie powrotu Veyra jako tego samego przeciwnika. Rozwój poziomy: nowe receptury alternatywne, podróżnicze narzędzia, historie portów. Bez automatycznego podnoszenia poziomu i zastępowania wszystkich nagród pierwszej kampanii.')
p('Sezon III — Dziedzice decyzji: skutki wybranego modelu sieci stają się widoczne podczas lokalnych sporów. Wariant rozproszony mierzy się z brakiem koordynacji, Pakt z przewlekłością narad, Cichy Strażnik z pokusą ponownego przyznania uprawnień doradcy. Każda wersja ma własne trudności, lecz żadna nie okazuje się z definicji fałszywym zakończeniem.')
p('Wspólny kierunek: świat pamięta decyzje bohatera poprzez ludzi, budynki, listy i trasy. Następny rozdział nie resetuje miast do katastrofy tylko po to, aby stworzyć nową listę przeciwników.')
# Export content and validate references before rendering.
ids=[x['id'] for x in items]
assert len(ids)==len(set(ids)), 'duplicate item IDs'
qids={x['id'] for x in quests}
assert len(qids)==98
assert len(MONSTERS)==40
assert sum(len(r['nodes']) for r in ANNEX['races'].values())==116
assert pre_final>=12160
for r in recipes:
 assert r['output'] in ids
 assert all(k in ids and isinstance(v,int) and v>0 for k,v in r['inputs'].items())
 assert r['output'] not in r['inputs']
for x in items:
 assert x['buy']>=0 and x['sell']>=0 and x['stack'] in [1,99]
 if x['buy']>0:assert x['sell']<x['buy']
for quest in quests:
 refs=re.findall(r'\b(?:O-[VANP]\d{2}|[MSP]\d{2}|C-[ASLK]\d|S-[VANP]\d{2})\b',quest['prerequisites'])
 assert all(r in qids for r in refs),(quest['id'],refs)
 for match in re.findall(r'\b(?:J-\d{2}|K-\d{2}|T-\d{2}|R-\d{2}|U-\d{2})\b',quest['reward']):assert match in ids,(quest['id'],match)
 # One explicit faction in the exported design record, instead of implicit runtime guessing.
 qid=quest['id']
 if qid.startswith(('O-V','S-V','C-A')): faction='F-V'
 elif qid.startswith(('O-A','S-A','C-S')):faction='F-A'
 elif qid.startswith(('O-N','S-N','C-L')):faction='F-N'
 elif qid.startswith(('O-P','S-P','C-K')):faction='F-P'
 elif qid in ['M05','M06','M07','M21','D04']:faction='F-A'
 elif qid in ['M09','M10','M11','M20','D06']:faction='F-N'
 elif qid in ['M14','M15','D07']:faction='F-P'
 elif qid=='M13':faction='F-V'
 elif qid in ['M08','M12']:faction='F-C'
 else:faction='F-L'
 quest['factionId']=faction
 quest['choiceFlag']='quest.'+qid+'.choice'
 quest['repeatable']=quest['kind']=='powtarzalne'
# Guard graph cycles in recipes.
recipe_by_item={r['output']:r for r in recipes}
def visit(i,path):
 assert i not in path,'cycle in recipes'
 if i in recipe_by_item:
  for inp in recipe_by_item[i]['inputs']:visit(inp,path+[i])
for i in recipe_by_item:visit(i,[])
item_by_id={x['id']:x for x in items}
def opportunity(i):
 it=item_by_id[i]
 if i in recipe_by_item:
  r=recipe_by_item[i]
  craft=r['fee']+sum(opportunity(k)*v for k,v in r['inputs'].items())
  return min(it['buy'],craft) if it['buy']>0 else craft
 return it['buy'] if it['buy']>0 else it['sell']
for r in recipes:
 cost=r['fee']+sum(opportunity(k)*v for k,v in r['inputs'].items())
 assert item_by_id[r['output']]['sell']<=cost,(r['id'],'craft/resale arbitrage')
# Walk the example route in dependency/level order, rather than checking only a final XP sum.
route_xp=origin_xp
completed={f'O-V{i:02}' for i in range(1,7)}
remaining={x['id'] for x in quests if x['id'] in selected}
for mq in [x for x in quests if re.fullmatch('M[0-9]{2}',x['id'])]:
 while True:
  unlocked=[]
  for sid in remaining:
   sq=next(x for x in quests if x['id']==sid)
   deps=re.findall(r'\bM\d{2}\b',sq['prerequisites'])
   required=100*(sq['level']-1)+30*(sq['level']-1)*(sq['level']-2)
   if all(d in completed for d in deps) and route_xp>=required:unlocked.append(sid)
  if not unlocked:break
  for sid in sorted(unlocked):
   route_xp+=next(x['xp'] for x in quests if x['id']==sid)
   completed.add(sid);remaining.remove(sid)
 need=100*(mq['level']-1)+30*(mq['level']-1)*(mq['level']-2)
 assert route_xp>=need,(mq['id'],route_xp,need,'route blocked by level')
 route_xp+=mq['xp'];completed.add(mq['id'])
assert not remaining


# Stable, editable source deliverables.
(OUT/'campaign-data.json').write_text(json.dumps(dict(status='PROPOSAL_NOT_IMPLEMENTED',sourceSha=SOURCE_SHA,quests=quests,items=items,recipes=recipes,bosses=[dict(id=b[0],name=b[1],level=b[2],hp=b[3],atk=b[4],defense=b[5],speed=b[6],attackIntervalSeconds=b[7],quest=b[8]) for b in bosses]),ensure_ascii=False,indent=2)+'\n')
md=[]
for b in blocks:
 if b[0]=='h':md.append('#'*b[1]+' '+b[2])
 elif b[0]=='p':md.append(b[1])
 elif b[0]=='table':
  md.append('| '+' | '.join(map(str,b[1]))+' |\n| '+' | '.join('---' for _ in b[1])+' |\n'+'\n'.join('| '+' | '.join(str(x).replace('\n',' / ').replace('|',' / ') for x in row)+' |' for row in b[2]))
 elif b[0]=='page':md.append('---')
 elif b[0]=='toc':md.append('Spis treści z numerami stron jest generowany automatycznie w PDF.')
(ROOT/'docs/FABULA-I-EKWIPUNEK.md').write_text('\n\n'.join(md)+'\n')

# PDF typesetting, embedded Unicode fonts, linked TOC and bookmarks.
FONT=Path('/usr/share/fonts/truetype/dejavu')
for name,file in [('Book','DejaVuSans.ttf'),('BookBold','DejaVuSans-Bold.ttf'),('BookItalic','DejaVuSans-Oblique.ttf')]:pdfmetrics.registerFont(TTFont(name,str(FONT/file)))
pdfmetrics.registerFontFamily('Book',normal='Book',bold='BookBold',italic='BookItalic',boldItalic='BookBold')
NAVY=colors.HexColor('#122b36');GOLD=colors.HexColor('#b18742');TEAL=colors.HexColor('#285e60');INK=colors.HexColor('#20323c')
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='BodyBook',fontName='Book',fontSize=9.1,leading=14,textColor=INK,spaceAfter=8,allowWidows=0,allowOrphans=0))
styles.add(ParagraphStyle(name='H1Book',fontName='BookBold',fontSize=21,leading=27,textColor=NAVY,spaceBefore=8,spaceAfter=18,keepWithNext=1))
styles.add(ParagraphStyle(name='H2Book',fontName='BookBold',fontSize=12,leading=17,textColor=TEAL,spaceBefore=14,spaceAfter=7,keepWithNext=1))
styles.add(ParagraphStyle(name='H3Book',fontName='BookBold',fontSize=9.5,leading=14,textColor=TEAL,spaceBefore=9,spaceAfter=5,keepWithNext=1))
styles.add(ParagraphStyle(name='CellBook',fontName='Book',fontSize=7.4,leading=10.7,textColor=INK,spaceAfter=0,splitLongWords=1))
styles.add(ParagraphStyle(name='HeadCellBook',fontName='BookBold',fontSize=7.5,leading=10.8,textColor=colors.white,spaceAfter=0))
styles.add(ParagraphStyle(name='TOCBook',fontName='Book',fontSize=10,leading=15,textColor=NAVY,spaceBefore=5))
styles.add(ParagraphStyle(name='CoverTitle',fontName='BookBold',fontSize=29,leading=37,textColor=colors.white,spaceAfter=20))
styles.add(ParagraphStyle(name='CoverBody',fontName='Book',fontSize=11,leading=17,textColor=colors.HexColor('#dae5df'),spaceAfter=15))
def para(t,style):return Paragraph(escape(str(t)).replace('\n','<br/>'),styles[style])
WIDTH,HEIGHT=A4
class BookDoc(BaseDocTemplate):
 def afterFlowable(self,flow):
  if isinstance(flow,Paragraph) and flow.style.name in ['H1Book','H2Book','H3Book']:
   text=flow.getPlainText()
   key='bk'+str(self.seq.nextf('bookmark'))
   self.canv.bookmarkPage(key)
   level=0 if flow.style.name=='H1Book' else 1 if flow.style.name=='H2Book' else 2
   # All headings form a contiguous outline: chapter > section > subsection.
   self.canv.addOutlineEntry(text,key,level=level,closed=True)
   if level==0 and text!='Spis treści':self.notify('TOCEntry',(0,text,self.page,key))

def draw_page(c,doc):
 c.saveState()
 if doc.page==1:
  c.setFillColor(NAVY);c.rect(0,0,WIDTH,HEIGHT,fill=1,stroke=0)
  c.setStrokeColor(GOLD);c.setLineWidth(1);c.line(46,HEIGHT-70,WIDTH-46,HEIGHT-70)
  c.setFillColor(GOLD);c.setFont('BookBold',9);c.drawString(48,HEIGHT-54,'KI LEGENDS     /     PROJEKT PRZYGODY 1.0')
  cx,cy=WIDTH/2,190
  c.setStrokeColor(colors.HexColor('#426069'));c.setLineWidth(.7)
  for r in [72,104,133]:c.circle(cx,cy,r,stroke=1,fill=0)
  pts=[(cx-95,cy+60),(cx+95,cy+60),(cx-60,cy-82),(cx+60,cy-82)]
  for i,a in enumerate(pts):
   for b in pts[i+1:]:c.line(*a,*b)
  for i,(x,y) in enumerate(pts):
   c.setFillColor([colors.HexColor('#83aa7e'),colors.HexColor('#e2cd99'),colors.HexColor('#80b7ca'),colors.HexColor('#c97e70')][i]);c.circle(x,y,8,fill=1,stroke=0)
  c.setFillColor(GOLD);c.setFont('Book',8);c.drawCentredString(cx,40,'DOKUMENT ROBOCZY • FABUŁA I NOWE SYSTEMY DO ZATWIERDZENIA')
 else:
  c.setFillColor(NAVY);c.rect(0,HEIGHT-30,WIDTH,30,fill=1,stroke=0)
  c.setFillColor(colors.HexColor('#d5c191'));c.setFont('BookBold',7);c.drawString(46,HEIGHT-19,'KI LEGENDS  /  CZTERY GŁOSY SUPERIOR')
  c.setFillColor(colors.HexColor('#64767e'));c.setFont('Book',7);c.drawString(46,24,'Projekt 1.0 • 23.10.2026 • propozycja, nie raport wdrożenia')
  c.drawRightString(WIDTH-46,24,str(doc.page));c.setStrokeColor(colors.HexColor('#cbd6d5'));c.line(46,38,WIDTH-46,38)
 c.restoreState()

pdf=OUT/'KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf'
doc=BookDoc(str(pdf),pagesize=A4,leftMargin=46,rightMargin=46,topMargin=55,bottomMargin=52,title='KI Legends — Księga przygody i rozwoju: Cztery Głosy Superior',author='Projekt przygotowany z Codexem na zamówienie właściciela KI Legends',subject='Fabuła, questy, progresja, wyposażenie i statystyki — projekt 1.0',pageCompression=1)
frame=Frame(doc.leftMargin,doc.bottomMargin,doc.width,doc.height,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)
doc.addPageTemplates(PageTemplate(id='book',frames=frame,onPage=draw_page))
flow=[];cover=True;headnumber=0;card_index=None
for b in blocks:
 kind=b[0]
 if kind=='cardstart':card_index=len(flow)
 elif kind=='cardend':
  assert card_index is not None
  card=flow[card_index:];del flow[card_index:];flow.append(KeepTogether(card));card_index=None
 elif kind=='page':flow.append(PageBreak());cover=False
 elif kind=='h':
  if cover:flow.extend([Spacer(1,55),para(b[2],'CoverTitle')])
  else:flow.append(para(b[2],['','H1Book','H2Book','H3Book'][b[1]]))
 elif kind=='p':flow.append(para(b[1],'CoverBody' if cover else 'BodyBook'))
 elif kind=='toc':
  toc=TableOfContents();toc.levelStyles=[styles['TOCBook']];toc.dotsMinLevel=0;flow.append(toc)
 elif kind=='table':
  headers,rows,ratios=b[1:]
  ratios=ratios or [1/len(headers)]*len(headers)
  data=[[para(x,'HeadCellBook') for x in headers]]+[[para(x,'CellBook') for x in row] for row in rows]
  t=Table(data,colWidths=[doc.width*r/sum(ratios) for r in ratios],repeatRows=1,hAlign='LEFT')
  t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),TEAL),('ROWBACKGROUNDS',(0,1),(-1,-1),[colors.HexColor('#eff4f2'),colors.white]),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),7),('RIGHTPADDING',(0,0),(-1,-1),7),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),('LINEBELOW',(0,-1),(-1,-1),.5,colors.HexColor('#c9d6d2'))]))
  flow.extend([t,Spacer(1,10)])
class StableCanvas(canvas.Canvas):
 def __init__(self,*args,**kwargs):
  kwargs['invariant']=1
  super().__init__(*args,**kwargs)
doc.multiBuild(flow,canvasmaker=StableCanvas)
source_files=['docs/design/data/character-progression-1-20.json','art/production/enemies/roster.json','src/game/session.ts','src/game/kit/balance.ts','src/game/kit/progression.ts','docs/DECISIONS.md','docs/PLANET-GEOMETRY-2026-10-22.md']
manifest=dict(version='1.0',date='2026-10-23',status='PROPOSAL_NOT_IMPLEMENTED',sourceSha=SOURCE_SHA,counts=dict(quests=len(quests),originQuests=24,sharedMainQuests=24,sideQuests=24,personalQuests=12,professionQuests=6,repeatableQuests=8,items=len(items),materials=len(mats),recipes=len(recipes),existingMonsters=40,newBossDesigns=8,existingSkillNodes=116),balance=dict(originXP=origin_xp,sharedXP=main_xp,exampleSideXP=side_xp,xpBeforeM23=pre_final,xpRequiredLevel20=12160,exampleQuestCoins=origin_gold+main_gold+side_gold),sources=[dict(path=s,sha256=hashlib.sha256(source_bytes(s)).hexdigest()) for s in source_files],outputs=[])
for name in ['KI-LEGENDS-KSIEGA-PRZYGODY-v1.0.pdf','../../FABULA-I-EKWIPUNEK.md','campaign-data.json']:
 data=(OUT/name).read_bytes();manifest['outputs'].append(dict(path=name,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(dict(pdf=str(pdf),counts=manifest['counts'],balance=manifest['balance']),ensure_ascii=False,indent=2))
