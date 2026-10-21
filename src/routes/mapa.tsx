import { createFileRoute } from "@tanstack/react-router";
import { MapaView } from "../components/planet-map/MapaView";

export const Route = createFileRoute("/mapa")({
  head: () => ({
    meta: [
      { title: "Planeta Superior — globus 3D · Ki Legends" },
      {
        name: "description",
        content:
          "Interaktywny globus 3D planety Superior: Verdantia, Aetheria, Nexus-9, Pyra i sześć przyszłych wysp questowych, z płaską mapą atlasu jako alternatywą.",
      },
      { property: "og:title", content: "Planeta Superior — globus 3D · Ki Legends" },
      {
        property: "og:description",
        content:
          "Obracaj planetę Superior, poznaj cztery kontynenty pochodzeń i sześć planowanych wysp questowych Ki Legends.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapaPage,
});

function MapaPage() {
  return <MapaView />;
}
