import { z } from "zod";
import type { Principal } from "./repository";

/** Verifies the bearer with the configured account authority, never decoded user_metadata. */
export function accountVerifier(config: { url: string; publishableKey: string }) {
  const project = new URL(config.url).origin;
  if (!project.startsWith("https://")) throw Error("Account authority must use HTTPS");
  if (!config.publishableKey) throw Error("Account authority is not configured");
  return async (token: unknown): Promise<Principal> => {
    const bearer = z.string().min(16).max(8192).parse(token);
    const response = await fetch(project + "/auth/v1/user", {
      headers: { apikey: config.publishableKey, Authorization: "Bearer " + bearer },
      signal: AbortSignal.timeout(8000),
      redirect: "error",
    });
    if (!response.ok) throw Error("UNAUTHENTICATED");
    const data = z
      .object({ id: z.string().uuid(), is_anonymous: z.boolean().optional() })
      .parse(await response.json());
    if (data.is_anonymous) throw Error("UNAUTHENTICATED");
    return { project, subject: data.id };
  };
}

/** Staff rights come from protected account rows, never browser claims/user_metadata. */
export async function accountRole(
  config: { url: string; publishableKey: string },
  token: string,
  subject: string,
): Promise<"admin" | "gm" | undefined> {
  const url = new URL("/rest/v1/user_roles", config.url);
  url.searchParams.set("select", "role");
  url.searchParams.set("user_id", "eq." + z.string().uuid().parse(subject));
  const response = await fetch(url, {
    headers: { apikey: config.publishableKey, Authorization: "Bearer " + token },
    signal: AbortSignal.timeout(8000),
    redirect: "error",
  });
  if (!response.ok) throw Error("ROLE_VERIFICATION_FAILED");
  const rows = z.array(z.object({ role: z.enum(["admin", "gm"]) })).parse(await response.json());
  return rows.some((r) => r.role === "admin")
    ? "admin"
    : rows.some((r) => r.role === "gm")
      ? "gm"
      : undefined;
}
