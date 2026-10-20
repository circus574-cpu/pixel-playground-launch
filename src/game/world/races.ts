export const RACE_IDS = ["planetary", "sage", "android", "legend"] as const;
export type RaceId = (typeof RACE_IDS)[number];
export const WORLD_IDS = ["verdant", "aether", "nexus", "pyra"] as const;
export type WorldId = (typeof WORLD_IDS)[number];
export const RACES: Record<
  RaceId,
  {
    name: string;
    world: WorldId;
    title: string;
    description: string;
    culture: string;
    energy: string;
    color: string;
    portrait: string;
    visual: "human-v2";
  }
> = {
  planetary: {
    name: "Planetarni",
    world: "verdant",
    title: "W rytmie żywej planety",
    description: "Odkrywcy i strażnicy równowagi. Każda ścieżka prowadzi do nowej historii.",
    culture: "Wspólnoty podróżników, rzemieślników i obrońców natury.",
    energy: "Żywa energia ziemi · adaptacja",
    color: "#b9d994",
    portrait: "/game/assets/stage3/references/planetary.jpg",
    visual: "human-v2",
  },
  sage: {
    name: "Mędrcy",
    world: "aether",
    title: "Wiedza jest formą potęgi",
    description: "Strażnicy pradawnych źródeł KI. Cisza sanktuariów skrywa pamięć całych epok.",
    culture: "Szkoły energii, medytacja i mistrzowie starożytnych rytuałów.",
    energy: "Skupione KI · duchowa dyscyplina",
    color: "#8ee8da",
    portrait: "/game/assets/stage3/references/sage.jpg",
    visual: "human-v2",
  },
  android: {
    name: "Androidy",
    world: "nexus",
    title: "Świadomość poza granicami ciała",
    description: "Syntetyczni odkrywcy, którzy pytają, gdzie kończy się maszyna, a zaczyna dusza.",
    culture: "Logika, doskonalenie i odpowiedzialność za rozwój świadomości.",
    energy: "Energia rdzenia · precyzja",
    color: "#85caff",
    portrait: "/game/assets/stage3/references/android.jpg",
    visual: "human-v2",
  },
  legend: {
    name: "Legendy",
    world: "pyra",
    title: "Twoje czyny staną się dziedzictwem",
    description:
      "Wojownicze klany strzegą aren i ruin, w których nadal płonie energia dawnych mistrzów.",
    culture: "Honor, rywalizacja i trening pod okiem strażników dziedzictwa.",
    energy: "Żywiołowe KI · siła woli",
    color: "#ffad78",
    portrait: "/game/assets/stage3/references/legend.jpg",
    visual: "human-v2",
  },
};
