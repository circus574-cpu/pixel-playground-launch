/**
 * Cloud save sync for the game page. Without a signed-in account (or in an isolated playtest)
 * every call is a no-op and the game keeps its browser-only saves, exactly as before.
 */
import { supabase } from "../../integrations/supabase/client";
import { cloudPort, touchLastSeen } from "../../game/account/cloudPort";
import { pushChanges, syncAll, type SyncReport } from "../../game/account/cloudSaves";
import { isPlaytest } from "../../game/playtest";

const TIMEOUT_MS = 6000;

async function signedInUser(): Promise<string | null> {
  if (typeof window === "undefined" || isPlaytest(window.location.search)) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

/**
 * `full`: two-way sync, only while no game is mounted. Otherwise push-only, safe during play.
 * Never throws and never takes longer than a few seconds: a slow or missing network just leaves
 * the browser saves as they are.
 */
export async function syncCloud(full: boolean): Promise<SyncReport | null> {
  try {
    const user = await signedInUser();
    if (!user) return null;
    const run = (async () => {
      const port = cloudPort(user);
      const report = full
        ? await syncAll(window.localStorage, user, port)
        : await pushChanges(window.localStorage, user, port);
      await touchLastSeen(user);
      return report;
    })();
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS));
    return await Promise.race([run, timeout]);
  } catch {
    return null;
  }
}
