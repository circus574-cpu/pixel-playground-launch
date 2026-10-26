import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { GlobeLoading, MapaView } from "../components/planet-map/MapaView";
import { readActiveContinent } from "../components/planet-map/MapChrome";

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
  // Read-only: highlight the active character's continent ("Tu jesteś").
  const [current, setCurrent] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    setCurrent(readActiveContinent(window.localStorage));
    setChecked(true);
  }, []);
  if (!checked) return <GlobeLoading />;
  if (new URLSearchParams(window.location.search).get("ki-world-v1") !== "1")
    document.documentElement.dataset["kiWorldV2"] = "1";
  return <MapaView current={current} />;
}
