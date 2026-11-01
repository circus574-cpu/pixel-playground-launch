/**
 * Funkcje serwerowe TanStack Start (Server Functions) do sterowania serwerem gry
 * z poziomu przeglądarki (Panel Administratora) bez konieczności otwierania terminala.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireServerAdmin } from "@/server/characters/adminGuard";
import { z } from "zod";
import {
  startServerFromAdmin,
  stopServerFromAdmin,
  getServerStatusFromAdmin,
  type ManagedServerStatus,
} from "@/server/managedServer";

export const getGameServerStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ManagedServerStatus> => {
    await requireServerAdmin();
    return getServerStatusFromAdmin();
  },
);

export const startGameServerFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        port: z.number().int().min(1024).max(65535).optional(),
        nodeId: z.string().max(64).optional(),
        name: z.string().max(128).optional(),
        region: z.string().max(128).optional(),
        maxPlayers: z.number().int().min(10).max(5000).optional(),
        tickRateHz: z.number().min(5).max(60).optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data }) => {
    await requireServerAdmin();
    return startServerFromAdmin(data);
  });

export const stopGameServerFn = createServerFn({ method: "POST" }).handler(async () => {
  await requireServerAdmin();
  return stopServerFromAdmin();
});
