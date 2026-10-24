import { MONSTERS as CATALOG } from "../monsters/catalog";

/** The 40 owner-bestiary monsters as used by quest objectives (ids from `base.generated.ts`). */
export const MONSTERS = CATALOG;
export const OWNER_BESTIARY_IDS: ReadonlySet<string> = new Set(CATALOG.map((m) => m.id));
