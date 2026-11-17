import type { AccountService } from "./accounts/service";
import type { GodotStore, Settings } from "./godot/store";

export const SERVICE_MESSAGE = "Serwer jest w trakcie konserwacji. Wróć za chwilę.";

/** The existing maintenance switch controls website, browser game and Android.
 * Admission uses database roles; a downloaded pack or a client-side role grants nothing.
 */
export class ServiceAccess {
  private held: { settings: Settings; until: number } | null = null;
  constructor(
    private readonly store: () => Pick<GodotStore, "settings"> | null,
    private readonly accounts: () => Pick<AccountService, "subjectOf" | "roles"> | null,
  ) {}

  invalidate() {
    this.held = null;
  }

  async status(token?: unknown) {
    const store = this.store();
    if (!store) throw Error("SERVICE_UNAVAILABLE");
    if (!this.held || this.held.until <= Date.now()) {
      const settings = await store.settings();
      this.held = { settings, until: Date.now() + 500 };
    }
    const settings = this.held.settings;
    const accounts = this.accounts();
    const subject = accounts?.subjectOf(token);
    const admin =
      settings.maintenance &&
      !!subject &&
      !!accounts &&
      (await accounts.roles(subject)).includes("admin");
    return {
      maintenance: settings.maintenance,
      message: settings.maintenanceMessage || SERVICE_MESSAGE,
      canEnter: !settings.maintenance || admin,
      canPreview: settings.maintenance && admin,
    };
  }

  async require(token?: unknown) {
    if (!(await this.status(token)).canEnter) throw Error("MAINTENANCE");
  }
}
