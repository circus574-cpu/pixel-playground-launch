import { useEffect, useState } from "react";
import { subscribeAuth, type AppRole } from "../../game/account/vpsAuth";
import type { Profile } from "../../game/account/cloudPort";

/** The signed-in account, shaped like the previous session object the pages already use. */
export type AccountSession = { user: { id: string; email: string }; access_token: string };
export type AccountState = {
  ready: boolean;
  session: AccountSession | null;
  profile: Profile | null;
  roles: AppRole[];
};

/** Signed-in player (accounts on the VPS), profile and staff roles; follows every tab. */
export function useAccount(): AccountState {
  const [state, setState] = useState<AccountState>({
    ready: false,
    session: null,
    profile: null,
    roles: [],
  });
  useEffect(
    () =>
      subscribeAuth((s) =>
        setState({
          ready: s.ready,
          session:
            s.account && s.accessToken
              ? { user: { id: s.account.id, email: s.account.email }, access_token: s.accessToken }
              : null,
          profile: s.account
            ? {
                id: s.account.id,
                nick: s.account.nick,
                created_at: s.account.createdAt,
                last_seen: s.account.lastLoginAt,
              }
            : null,
          roles: s.account?.roles ?? [],
        }),
      ),
    [],
  );
  return state;
}
