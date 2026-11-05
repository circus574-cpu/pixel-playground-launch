import { describe, expect, it } from "vitest";
import { visiblePlaces } from "../components/planet-map/labelLayout";

const px = (screen: number) => screen; // 1 map unit per screen pixel
const bounds: [number, number, number, number] = [0, 0, 2000, 1000];
const place = (id: string, kind: string, x: number, y: number, name = "Obóz · poz. 12") => ({
  id,
  land: "nexus",
  kind,
  name,
  x,
  y,
});

describe("etykiety miejsc na mapie", () => {
  it("nakładające się obozy nie wyświetlają wszystkich nazw naraz", () => {
    const camps = Array.from({ length: 6 }, (_, i) => place("c" + i, "camp", 500 + i * 6, 500));
    const out = visiblePlaces(camps, bounds, 6, px);
    expect(out).toHaveLength(6);
    expect(out.filter((o) => o.named).length).toBe(1);
  });

  it("stolica wygrywa z obozem o to samo miejsce", () => {
    const out = visiblePlaces(
      [place("camp", "camp", 500, 500), place("cap", "capital", 500, 500, "NEXUS-9")],
      bounds,
      6,
      px,
    );
    expect(out.find((o) => o.p.id === "cap")!.named).toBe(true);
    expect(out.find((o) => o.p.id === "camp")!.named).toBe(false);
  });

  it("odległe miejsca zachowują swoje nazwy", () => {
    const out = visiblePlaces(
      [place("a", "camp", 200, 200), place("b", "camp", 900, 400), place("c", "camp", 1500, 800)],
      bounds,
      6,
      px,
    );
    expect(out.every((o) => o.named)).toBe(true);
  });

  it("poza kadrem i przy małym zoomie miejsca znikają lub nie mają nazw", () => {
    expect(visiblePlaces([place("far", "camp", 5000, 5000)], bounds, 6, px)).toHaveLength(0);
    expect(visiblePlaces([place("c", "camp", 500, 500)], bounds, 2, px)).toHaveLength(0);
    const town = visiblePlaces([place("t", "town", 500, 500, "Stacja")], bounds, 1, px);
    expect(town[0]!.named).toBe(false);
  });
});

describe("etykiety: szerokość i ikony ważniejszych miejsc", () => {
  it("nazwa obozu nie przykrywa ikony miasta", () => {
    const out = visiblePlaces(
      [place("town", "town", 500, 500, "Stacja"), place("camp", "camp", 500, 490)],
      bounds,
      6,
      px,
    );
    expect(out.find((o) => o.p.id === "camp")!.named).toBe(false);
  });

  it("szeroka czcionka: dwie długie nazwy obok siebie nie nachodzą na siebie", () => {
    const long = "Kaplica Dezerterów Popiołu";
    // 150 units apart is less than one 26-char Cinzel label at 11 px (~212), so only one fits.
    const out = visiblePlaces(
      [place("a", "camp", 500, 500, long), place("b", "camp", 650, 500, long)],
      bounds,
      6,
      px,
    );
    expect(out.filter((o) => o.named)).toHaveLength(1);
  });
});
