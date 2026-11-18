# Zmiany — 18.11.2026

## Kamera w prototypie Pyry

W osadzie kamera celuje nieco wyżej i obejmuje około 20% więcej terenu
w poziomie (zoom 0,54). Po wyjściu przechodzi płynnie na 0,65 i wyprzedza
bohatera w kierunku marszu. Po zatrzymaniu wraca nad postać. Bufor przy
granicy łagodzi wahania kadru. Strefa kadrowania obejmuje istniejący
płaskowyż Pyry. Skala sprite'ów i zasady rozgrywki pozostały bez zmian.

[Prototyp Godot 74/74](qa/pyra-camera/prototype.json) obejmuje przejście
w obie strony, bufor na granicy, przesunięcie kadru podczas marszu,
powrót po zatrzymaniu oraz próbę ręcznego zoomu kółkiem i gestem.
[Podgląd w trybie serwisowym 54/54](qa/pyra-camera/service.json).
Testy wykonano w Godot 4.6.3 z programowym OpenGL. Telefon i publikacja
serwerowa czekają na osobny odbiór.
