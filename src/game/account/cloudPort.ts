/**
 * Browser access to the account tables (docs/db/2026-10-26-accounts.sql). The generated Cloud
 * types do not list these tables yet, so this module carries its own row types; row-level
 * security in the database decides what each signed-in user may read or change.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "../../integrations/supabase/client";
import type { CloudPort, CloudRow } from "./cloudSaves";

export type AppRole = "admin" | "gm";
export type Profile = { id: string; nick: string; created_at: string; last_seen: string | null };
export type RoleRow = {
  user_id: string;
  role: AppRole;
  granted_by: string | null;
  granted_at: string;
};
export type CharacterRow = CloudRow & {
  user_id: string;
  updated_at: string;
  updated_by: string | null;
};
export type AuditRow = {
  id: number;
  actor: string | null;
  action: string;
  target_user: string | null;
  target_key: string | null;
  before: unknown;
  after: unknown;
  at: string;
};

type Table<Row> = { Row: Row; Insert: Partial<Row>; Update: Partial<Row>; Relationships: [] };
type AccountsDb = {
  public: {
    Tables: {
      profiles: Table<Profile>;
      user_roles: Table<RoleRow>;
      characters: Table<CharacterRow>;
      admin_audit: Table<AuditRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: { app_role: AppRole };
    CompositeTypes: Record<string, never>;
  };
};

export const accountsDb = supabase as unknown as SupabaseClient<AccountsDb>;

const COLUMNS = "save_key, data, revision";

/** The signed-in player's own rows. */
export function cloudPort(userId: string): CloudPort {
  return {
    async list() {
      const { data, error } = await accountsDb
        .from("characters")
        .select(COLUMNS)
        .eq("user_id", userId);
      if (error) throw error;
      return data;
    },
    async insert(key, value) {
      const { data, error } = await accountsDb
        .from("characters")
        .insert({ user_id: userId, save_key: key, data: value })
        .select(COLUMNS)
        .single();
      if (error) throw error;
      return data;
    },
    async update(key, value, revision) {
      const { data, error } = await accountsDb
        .from("characters")
        .update({ data: value })
        .eq("user_id", userId)
        .eq("save_key", key)
        .eq("revision", revision)
        .select(COLUMNS);
      if (error) throw error;
      return data[0] ?? null;
    },
  };
}

export async function touchLastSeen(userId: string) {
  await accountsDb
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", userId);
}

export async function myRoles(userId: string): Promise<AppRole[]> {
  const { data } = await accountsDb.from("user_roles").select("role").eq("user_id", userId);
  return (data ?? []).map((r) => r.role);
}
