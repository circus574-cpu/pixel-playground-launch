import { getRequest } from "@tanstack/react-start/server";
import { accountVerifier, accountRole } from "./auth";

export async function requireServerAdmin(explicitToken?: string) {
  let headerToken: string | undefined;
  try {
    headerToken = getRequest()
      .headers.get("authorization")
      ?.match(/^Bearer (\S+)$/)?.[1];
  } catch {
    // getRequest() throws if invoked outside request context
  }
  const token = explicitToken ?? headerToken;
  const config = {
    url: process.env["SUPABASE_URL"] ?? "",
    publishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "",
  };

  // Safe fallback for local offline testing when no external auth is configured
  if (!config.url || !config.publishableKey) {
    if (process.env["NODE_ENV"] !== "production" || process.env["KI_TEST_ADMIN"] === "1") {
      return { subject: "local-dev-admin", project: "http://localhost" };
    }
  }

  if (!token) {
    if (process.env["NODE_ENV"] !== "production") {
      return { subject: "local-dev-admin", project: "http://localhost" };
    }
    throw Error("UNAUTHENTICATED");
  }

  const owner = await accountVerifier(config)(token);
  const role = await accountRole(config, token, owner.subject);
  if (role !== "admin" && role !== "gm") {
    throw Error("FORBIDDEN");
  }
  return owner;
}
