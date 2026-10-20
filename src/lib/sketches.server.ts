import {
  useSession as getServerSession,
  setResponseHeader,
  getRequest,
} from "@tanstack/react-start/server";
import { createHash, timingSafeEqual } from "node:crypto";

export function passwordMatches(input: string, expected: string) {
  return timingSafeEqual(
    createHash("sha256").update(input).digest(),
    createHash("sha256").update(expected).digest(),
  );
}

export async function sketchSession() {
  const password = process.env["SESSION_SECRET"];
  if (!password) throw new Error("Brak konfiguracji dostępu.");
  setResponseHeader("Cache-Control", "no-store");
  return getServerSession<{ unlocked?: boolean; attempts?: number; retryAt?: number }>({
    password,
    name: "ki-sketches",
    maxAge: 60 * 60 * 24,
    cookie: { httpOnly: true, secure: true, sameSite: "strict", path: "/" },
  });
}

export async function requireSketchAccess() {
  const session = await sketchSession();
  if (!session.data.unlocked) throw new Error("Wpisz hasło, aby uzyskać dostęp.");
  return session;
}

export function checkSketchOrigin() {
  const request = getRequest();
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) throw new Error("Niedozwolone żądanie.");
}
