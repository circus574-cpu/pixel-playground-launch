import indexV1 from "../../../../public/game/worlds/superior-v1/index.json";
import indexV2 from "../../../../public/game/worlds/superior-v2/index.json";

/**
 * World v2 (45% land geometry, landscape checkpoint) is an opt-in preview: `?ki-world-v2=1`.
 * It uses its own character namespace, so v1 characters and saves are never read or changed.
 */
export const WORLD_V2 =
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).get("ki-world-v2") === "1";
export const WORLD_BASE = WORLD_V2 ? "/game/worlds/superior-v2" : "/game/worlds/superior-v1";
export const WORLD_INDEX = WORLD_V2 ? indexV2 : indexV1;
export const WORLD_NAMESPACE = WORLD_V2 ? ":superior-world-v2" : ":superior-world-v1";

// Lets stylesheets (map, HUD) switch to the v2 presentation.
if (WORLD_V2) document.documentElement.dataset["kiWorldV2"] = "1";
