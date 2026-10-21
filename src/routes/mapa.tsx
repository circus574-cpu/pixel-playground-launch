import { createFileRoute } from "@tanstack/react-router";
import { PlanetMap } from "../components/planet-map/PlanetMap";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa planety Superior — DEMO · Ki Legends" },
      {
        name: "description",
        content:
          "Interaktywny podgląd DEMO mapy planety Superior: Verdantia, Aetheria, Nexus-9, Pyra i sześć przyszłych wysp questowych.",
      },
      { property: "og:title", content: "Mapa planety Superior — DEMO · Ki Legends" },
      {
        property: "og:description",
        content:
          "Cztery kontynenty pochodzeń i sześć planowanych wysp questowych w interaktywnym podglądzie mapy Ki Legends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaPage,
});

function MapaPage() {
  return <PlanetMap />;
}
