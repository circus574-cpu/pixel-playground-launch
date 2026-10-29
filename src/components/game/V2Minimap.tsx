/**
 * World v2 minimap (preview switch ?ki-world-v2=1): a window of the land's painted map
 * (public/game/worlds/superior-v2/<land>/map.webp, same terrain as the game) centred on the player,
 * with the towns of Argon's quests.
 */
import index from "../../../public/game/worlds/superior-v2/index.json";
import { v2Places } from "../../game/worlds/v2Places";

const VIEW = 9000; // world units shown across the minimap

export function V2Minimap({
  land,
  at,
  projects = [],
}: {
  land: string;
  at: { x: number; y: number };
  projects?: readonly { id: string; name: string; x: number; y: number }[];
}) {
  const feature = index.features.find((f) => f.id === land);
  if (!feature) return null;
  const scale = feature.width / VIEW; // map width in minimap widths
  const towns = Object.values(v2Places(land)?.cities ?? {});
  const pos = (x: number, y: number) => ({
    left: 50 + ((x - at.x) / VIEW) * 100 + "%",
    top: 50 + ((y - at.y) / VIEW) * 100 + "%",
  });
  return (
    <span className="ki-v2-minimap">
      <span
        className="ki-v2-minimap-layer"
        style={{
          width: scale * 100 + "%",
          height: (feature.height / VIEW) * 100 + "%",
          left: 50 - (at.x / VIEW) * 100 + "%",
          top: 50 - (at.y / VIEW) * 100 + "%",
          backgroundImage: `url(/game/worlds/superior-v2/${land}/map.webp)`,
        }}
      />
      {towns.map((t) => (
        <i key={t.settlement} className="ki-v2-minimap-town" style={pos(t.x, t.y)} title={t.name} />
      ))}
      {projects.map((p) => (
        <i
          key={p.id}
          className="ki-v2-minimap-project"
          style={pos(p.x, p.y)}
          title={p.name + " · odbudowano"}
        />
      ))}
      <i className="ki-v2-minimap-me" style={{ left: "50%", top: "50%" }} />
    </span>
  );
}
