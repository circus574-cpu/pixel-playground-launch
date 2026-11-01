import { getRequest } from "@tanstack/react-start/server";
import { accountVerifier, accountRole } from "./auth";
export async function requireServerAdmin() {
  const token = getRequest()
    .headers.get("authorization")
    ?.match(/^Bearer (\S+)$/)?.[1];
  const config = {
    url: process.env["SUPABASE_URL"] ?? "",
    publishableKey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "",
  };
  const owner = await accountVerifier(config)(token);
  if (!token || (await accountRole(config, token, owner.subject)) !== "admin")
    throw Error("FORBIDDEN");
}
