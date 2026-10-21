# Ki Legends — oryginalny dokument, strona 11/12

Transkrypcja tekstowa oryginalnego PDF z 20.10.2026. Nie zawiera oryginalnych ilustracji ani nie zastępuje PDF.

 09 | Produkcja grafiki i animacji
 Rekomendowany pipeline
 • 1. Kanon postaci: zatwierdzenie jednej twarzy, sylwetki, kolorystyki, ubioru i detali dla każdej rasy.

 • 2. Model referencyjny: przygotowanie pierwszego bohatera Legendów; test proporcji i perspektywy w
 istniejącej mapie.

 • 3. Rig i animacja: ruch w ośmiu kierunkach, idle, bieg, atak, trafienie, śmierć; aury jako osobne efekty.

 • 4. Render do 2D: eksport przezroczystych klatek, spójna kamera, oświetlenie i skala; pakowanie w
 atlas.

 • 5. Integracja: test 128 / 144 / 160 jednostek wielkości postaci w świecie i dobór skali do telefonu oraz
 komputera.

 • 6. Rozszerzenie: dopiero po zaakceptowaniu wzorca powielenie pipeline’u na pozostałe rasy.


 Dlaczego nie generować każdej klatki oddzielnie?
 Generowanie setek niezależnych ilustracji zwiększa ryzyko zmian twarzy, uzbrojenia, proporcji i
 kierunku światła między klatkami. Spójny model i rig ułatwiają utrzymanie identycznej postaci w całej
 animacji. Sam Blender nie odtworzy automatycznie idealnego modelu 3D z jednej ilustracji — etap
 modelowania i korekt artystycznych pozostaje istotnym zadaniem.


 Zasady gospodarowania GPU
 Przed uruchomieniem wynajętego GPU należy mieć przygotowane środowisko, modele, skrypty,
 strukturę folderów, referencje i testowy eksport. Najpierw próbka jednej postaci, następnie produkcja
 seryjna. Wersje źródłowe i zasoby muszą być zapisywane na trwałym dysku; nie wolno usuwać
 istniejących modeli i konfiguracji.




KI LEGENDS • Dokument koncepcyjny • 20.10.2026                                                                11