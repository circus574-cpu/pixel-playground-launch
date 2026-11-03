import type { ArtObject, FeatureArt } from "./renderSuperior";

/** Render-only replacements: preserve source position, footprint and authored collision data. */
export function nexusScenery(items: readonly ArtObject[]): ArtObject[] {
  const names: Record<string, string> = {
    "object.pylon": "pylon",
    "object.terminal": "terminal",
    "object.reactor": "reactor",
    "object.crystal": "crystal",
    "object.tech-garden": "garden",
  };
  return items.map((item) => {
    const name = names[item.binding];
    return name ? { ...item, binding: "object.nexus-painted." + name } : item;
  });
}

/** Optional garden ornaments use ordinary object streaming; they never enter navigation. */
export function nexusGarden(art: FeatureArt): ArtObject[] {
  const items: ArtObject[] = [];
  const add = (name: string, x: number, y: number, width: number, height: number) =>
    items.push({
      id: "nexus-painted-" + items.length,
      binding: "object.nexus-painted." + name,
      kind: name.includes("tree") ? "tree" : "bush",
      x,
      y,
      width,
      height,
      anchorX: 0.5,
      anchorY: 0.95,
      solid: false,
      layer: "objects",
    });
  for (const b of art.acceptedCityBuildings) {
    add("pinktree", b.x - 340, b.y - 20, 300, 290);
    add("cyanplant", b.x + 310, b.y + 60, 155, 160);
    add("mushrooms", b.x - 290, b.y + 175, 100, 110);
    add("cyanflowers", b.x + 270, b.y + 200, 100, 105);
  }
  return items;
}

/** Decorative links between existing service doors. No navigation/collision data is edited. */
export function nexusWalkways(art: FeatureArt) {
  const doors = art.acceptedCityBuildings.flatMap((b) => (b.door ? [b.door] : []));
  const hall = art.acceptedCityBuildings.find((b) => b.binding.endsWith(".nexus-hall"))?.door;
  if (!hall || !doors.length) return [];
  return [
    {
      points: [
        [hall.x, hall.y],
        [hall.x, Math.max(...doors.map((d) => d.y))],
      ] as [number, number][],
      width: 86,
      kind: "road",
    },
    ...doors
      .filter((d) => Math.abs(d.x - hall.x) > 50)
      .map((d) => ({
        points: [
          [hall.x, d.y],
          [d.x, d.y],
        ] as [number, number][],
        width: 86,
        kind: "road",
      })),
  ];
}
