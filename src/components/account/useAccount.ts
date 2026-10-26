import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../integrations/supabase/client";
import { accountsDb, myRoles, type AppRole, type Profile } from "../../game/account/cloudPort";

export type AccountState = {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
};

/** Signed-in player, profile and staff roles; follows sign-in and sign-out in every tab. */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({
    ready: false,
    session: null,
    profile: null,
    roles: [],
  });
  useEffect(() => {
    let cancelled = false;
    const load = async (session: Session | null) => {
      if (!session) {
        if (!cancelled) setState({ ready: true, session: null, profile: null, roles: [] });
        return;
      }
      const [{ data: profile }, roles] = await Promise.all([
        accountsDb.from("profiles").select("*").eq("id", session.user.id).maybeSingle(),
        myRoles(session.user.id),
      ]);
      if (!cancelled) setState({ ready: true, session, profile: profile ?? null, roles });
    };
    void supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      // Never await inside the auth callback; it would block the client's own session lock.
      setTimeout(() => void load(session), 0);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);
  return state;
}
