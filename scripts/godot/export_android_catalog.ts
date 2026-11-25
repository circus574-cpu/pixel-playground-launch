#!/usr/bin/env tsx
/**
 * Exports canonical ANDROID_ITEM_CATALOG from src/server/godot/economy.ts
 * to ports/godot-isometric-world/data/items_catalog.json so Godot client UI
 * (Shop, Smithy, Character Sheet, Bank, GM Panel) stays 100% in sync with server.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ANDROID_ITEM_CATALOG,
  BACKPACK_SIZE,
  BANK_SIZE,
  TRAINING_COOLDOWN_MS,
} from "../../src/server/godot/economy";

const outPath = resolve("ports/godot-isometric-world/data/items_catalog.json");
const payload = {
  version: 2,
  backpack_size: BACKPACK_SIZE,
  bank_size: BANK_SIZE,
  training_cooldown_s: TRAINING_COOLDOWN_MS / 1000,
  items: ANDROID_ITEM_CATALOG,
};
writeFileSync(outPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
console.log(`Exported ${ANDROID_ITEM_CATALOG.length} canonical items to ${outPath}`);
