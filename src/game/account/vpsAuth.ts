/**
 * Browser client of the player accounts on the VPS (/ws/auth/*). The access token lives only in
 * memory; the refresh token in localStorage so a player stays signed in. Every tab follows sign-in
 * and sign-out through the storage event.
 */
export type AppRole = "admin" | "gm";
export type VpsAccount = {
  id: string;
  email: string;
  nick: string;
  roles: AppRole[];
  createdAt: string;
  lastLoginAt: string | null;
};
type SessionResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  account: VpsAccount;
};
export type AuthSnapshot = {
  ready: boolean;
  account: VpsAccount | null;
  accessToken: string | null;
};

const REFRESH_KEY = "ki-legends:account-refresh-v1";
const BASE = "/ws/auth";

export class AuthError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const storage = {
  get: () => {
    try {
      return window.localStorage.getItem(REFRESH_KEY);
    } catch {
      return null;
    }
  },
  set: (value: string | null) => {
    try {
      if (value) window.localStorage.setItem(REFRESH_KEY, value);
      else window.localStorage.removeItem(REFRESH_KEY);
    } catch {
      /* private mode: session lasts for this tab only */
    }
  },
};

async function call<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  const response = await fetch(BASE + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  } & T;
  if (!response.ok)
    throw new AuthError(
      data.error ?? "HTTP_" + response.status,
      data.message ?? "Serwer kont jest chwilowo niedostępny.",
    );
  return data;
}

let snapshot: AuthSnapshot = { ready: false, account: null, accessToken: null };
let expiresAt = 0;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pending: Promise<void> | null = null;
const listeners = new Set<(s: AuthSnapshot) => void>();

function publish(next: AuthSnapshot) {
  snapshot = next;
  for (const l of listeners) l(snapshot);
}

function adopt(session: SessionResponse) {
  storage.set(session.refreshToken);
  expiresAt = Date.now() + session.expiresIn * 1000;
  if (refreshTimer) clearTimeout(refreshTimer);
  // Refresh a minute before the access token expires.
  refreshTimer = setTimeout(() => void refresh(), Math.max(5_000, (session.expiresIn - 60) * 1000));
  publish({ ready: true, account: session.account, accessToken: session.accessToken });
}

function signedOut() {
  storage.set(null);
  expiresAt = 0;
  if (refreshTimer) clearTimeout(refreshTimer);
  publish({ ready: true, account: null, accessToken: null });
}

/** Exchanges the stored refresh token for a new session (rotates it). */
export function refresh(): Promise<void> {
  if (pending) return pending;
  const token = storage.get();
  if (!token) {
    signedOut();
    return Promise.resolve();
  }
  pending = call<SessionResponse>("/refresh", { refreshToken: token })
    .then(adopt)
    .catch((error: unknown) => {
      // Network trouble keeps the stored session for the next attempt; a rejected token ends it.
      if (error instanceof AuthError) signedOut();
      else publish({ ...snapshot, ready: true });
    })
    .finally(() => {
      pending = null;
    });
  return pending;
}

let started = false;
/** Restores the session once per page and follows other tabs. */
export function startAuth() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.addEventListener("storage", (e) => {
    if (e.key !== REFRESH_KEY) return;
    if (!e.newValue) signedOut();
    else if (!snapshot.account) void refresh();
  });
  void refresh();
}

export function subscribeAuth(listener: (s: AuthSnapshot) => void) {
  listeners.add(listener);
  startAuth();
  listener(snapshot);
  return () => void listeners.delete(listener);
}

export const authSnapshot = () => snapshot;

/** A valid access token for the game server and admin API, refreshed when close to expiry. */
export async function accessToken(): Promise<string> {
  startAuth();
  if (pending) await pending;
  if (snapshot.accessToken && Date.now() < expiresAt - 30_000) return snapshot.accessToken;
  await refresh();
  if (!snapshot.accessToken) throw new AuthError("UNAUTHENTICATED", "Zaloguj się ponownie.");
  return snapshot.accessToken;
}

export async function login(email: string, password: string) {
  adopt(await call<SessionResponse>("/login", { email, password }));
}
export async function register(email: string, password: string, nick: string) {
  return call<{ message: string }>("/register", { email, password, nick });
}
export async function confirmEmail(token: string) {
  adopt(await call<SessionResponse>("/confirm", { token }));
}
export async function resendActivation(email: string) {
  return call<{ message: string }>("/resend", { email });
}
export async function forgotPassword(email: string) {
  return call<{ message: string }>("/forgot", { email });
}
export async function resetPassword(token: string, password: string) {
  adopt(await call<SessionResponse>("/reset", { token, password }));
}
export async function logout() {
  const token = storage.get();
  signedOut();
  if (token) await call("/logout", { refreshToken: token }).catch(() => undefined);
}

/* ------------------------------ administration ----------------------------- */

export type AdminAccount = VpsAccount & { confirmed: boolean };
export type AdminAuditRow = {
  id: string;
  at: string;
  actor: string | null;
  action: string;
  target: string | null;
  details: unknown;
  actor_nick: string | null;
  target_nick: string | null;
};

export async function adminAccounts(query = "") {
  const q = query ? "?q=" + encodeURIComponent(query) : "";
  return (
    await call<{ accounts: AdminAccount[] }>("/admin/accounts" + q, undefined, await accessToken())
  ).accounts;
}
export async function adminSetRole(userId: string, role: AppRole, granted: boolean) {
  await call("/admin/roles", { userId, role, granted }, await accessToken());
}
export async function adminAudit() {
  return (await call<{ audit: AdminAuditRow[] }>("/admin/audit", undefined, await accessToken()))
    .audit;
}
