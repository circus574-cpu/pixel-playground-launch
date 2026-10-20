import { SAVE_KEY } from "./session";

/** Isolated manual QA save; same rules and persistence, no reset or gameplay shortcuts. */
export const PLAYTEST_ID = "stage2-1-20261020";
export const PLAYTEST_SAVE_KEY = SAVE_KEY + ":" + PLAYTEST_ID;
export function isPlaytest(search: string): boolean {
  return new URLSearchParams(search).get("playtest") === PLAYTEST_ID;
}
export function playtestSaveKey(search: string): string {
  return isPlaytest(search) ? PLAYTEST_SAVE_KEY : SAVE_KEY;
}
