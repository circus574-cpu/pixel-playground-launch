import {
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
  scrypt as scryptCb,
  timingSafeEqual,
} from "node:crypto";

/** scrypt parameters: ~64 MiB memory per hash, a few tens of ms on the VPS. */
const N = 1 << 15;
const R = 8;
const P = 1;
const KEY = 64;
const MAXMEM = 128 * N * R * 2;

function scrypt(password: string, salt: Buffer, n: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, KEY, { N: n, r, p, maxmem: MAXMEM }, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
}

/** `scrypt$N$r$p$salt$hash` (base64url). */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [kind, n, r, p, salt, hash] = stored.split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64url");
  const actual = await scrypt(
    password,
    Buffer.from(salt, "base64url"),
    Number(n),
    Number(r),
    Number(p),
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Random URL-safe token for links and sessions; only its SHA-256 is stored. */
export const newToken = () => randomBytes(32).toString("base64url");
export const tokenHash = (token: string) => createHash("sha256").update(token).digest();

/**
 * Signing key for access tokens: AUTH_TOKEN_SECRET when set, otherwise derived from the private
 * DATABASE_URL (stable across restarts, never sent anywhere).
 */
export function signingKey(env: NodeJS.ProcessEnv = process.env): Buffer {
  const explicit = env["AUTH_TOKEN_SECRET"];
  if (explicit && explicit.length >= 32) return Buffer.from(explicit, "utf8");
  const source = env["DATABASE_URL"] || env["KI_ONLINE_TEST_DATABASE_URL"];
  if (!source) throw Error("AUTH_NOT_CONFIGURED");
  return Buffer.from(hkdfSync("sha256", source, "ki-legends", "access-token-v1", 32));
}

export type AccessClaims = { sub: string; exp: number; iat: number; typ: "access" };
const b64 = (v: unknown) => Buffer.from(JSON.stringify(v)).toString("base64url");
const HEADER = b64({ alg: "HS256", typ: "JWT" });

/** Short-lived HS256 access token for the game server and admin API. */
export function signAccess(subject: string, key: Buffer, ttlSeconds = 900, now = Date.now()) {
  const iat = Math.floor(now / 1000);
  const body = b64({ sub: subject, iat, exp: iat + ttlSeconds, typ: "access" });
  const sig = createHmac("sha256", key)
    .update(HEADER + "." + body)
    .digest("base64url");
  return HEADER + "." + body + "." + sig;
}

export function verifyAccess(token: string, key: Buffer, now = Date.now()): AccessClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== HEADER) return null;
  const expected = createHmac("sha256", key)
    .update(parts[0] + "." + parts[1])
    .digest();
  const given = Buffer.from(parts[2]!, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const claims = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as AccessClaims;
    if (claims.typ !== "access" || typeof claims.sub !== "string") return null;
    if (!(claims.exp > Math.floor(now / 1000))) return null;
    return claims;
  } catch {
    return null;
  }
}
