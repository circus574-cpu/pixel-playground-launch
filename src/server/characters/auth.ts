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
