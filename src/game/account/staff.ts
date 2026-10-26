/**
 * Special administrator / game-master characters. A character is marked special on creation
 * (kept with the game's saves, so it follows the account to other devices); its tools are
 * enabled only while the signed-in account still holds the role in the database.
 */
import { supabase } from "../../integrations/supabase/client";
import { isPlaytest } from "../playtest";
import type { StaffRole } from "../session";
import { myRoles } from "./cloudPort";
import type { KeyStorage } from "./cloudSaves";

export const STAFF_KEY = "ki-legends:staff-characters";

function read(storage: Pick<KeyStorage, "getItem">): Record<string, StaffRole> {
  try {
    const value: unknown = JSON.parse(storage.getItem(STAFF_KEY) ?? "{}");
    return value && typeof value === "object" ? (value as Record<string, StaffRole>) : {};
  } catch {
    return {};
  }
}

export function staffMark(storage: Pick<KeyStorage, "getItem">, characterId: string) {
  const role = read(storage)[characterId];
  return role === "admin" || role === "gm" ? role : null;
}

export function markStaff(storage: KeyStorage, characterId: string, role: StaffRole) {
  storage.setItem(STAFF_KEY, JSON.stringify({ ...read(storage), [characterId]: role }));
}

/** An administrator may play any special character; a game master only game-master ones. */
export function grants(roles: readonly StaffRole[], mark: StaffRole | null): StaffRole | null {
  if (!mark) return null;
  if (roles.includes("admin")) return mark;
  return mark === "gm" && roles.includes("gm") ? "gm" : null;
}

/** The role this character may use now, checked against the database; null for everyone else. */
export async function verifiedStaffRole(characterId: string): Promise<StaffRole | null> {
  if (typeof window === "undefined" || isPlaytest(window.location.search)) return null;
  const mark = staffMark(window.localStorage, characterId);
  if (!mark) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    return grants(await myRoles(data.session.user.id), mark);
  } catch {
    return null;
  }
}
