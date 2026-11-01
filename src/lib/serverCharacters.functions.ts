/**
 * Funkcje serwerowe TanStack Start do zarządzania postaciami na serwerze gry
 * z poziomu Panelu Administratora (/admin).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireServerAdmin } from "@/server/characters/adminGuard";
import { z } from "zod";
import {
  listAllServerCharacters,
  getServerCharacterDetails,
  updateServerCharacter,
  executeLiveAdminAction,
  type ServerCharacterSummary,
  type ServerCharacterDetail,
  type ServerCharacterUpdatePatch,
  type LiveAdminAction,
} from "@/server/adminCharacterService";

export const listServerCharactersFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        search: z.string().optional(),
        race: z.string().optional(),
        onlyOnline: z.boolean().optional(),
        authToken: z.string().optional(),
      })
      .parse(input || {}),
  )
  .handler(async ({ data }): Promise<ServerCharacterSummary[]> => {
    await requireServerAdmin(data?.authToken);
    const filters: {
      search?: string | undefined;
      race?: string | undefined;
      onlyOnline?: boolean | undefined;
    } = {};
    if (data?.search !== undefined) filters.search = data.search;
    if (data?.race !== undefined) filters.race = data.race;
    if (data?.onlyOnline !== undefined) filters.onlyOnline = data.onlyOnline;
    return listAllServerCharacters(filters);
  });

export const getServerCharacterFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        characterId: z.string().uuid(),
        authToken: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<ServerCharacterDetail | null> => {
    await requireServerAdmin(data.authToken);
    return getServerCharacterDetails(data.characterId);
  });

export const updateServerCharacterFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        characterId: z.string().uuid(),
        patch: z.record(z.any()),
        authToken: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; revision: number; error?: string }> => {
    const admin = await requireServerAdmin(data.authToken);
    return updateServerCharacter(
      data.characterId,
      data.patch as ServerCharacterUpdatePatch,
      admin.subject,
    );
  });

export const executeLiveAdminActionFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        characterId: z.string().uuid(),
        action: z.any(),
        authToken: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; message: string }> => {
    const admin = await requireServerAdmin(data.authToken);
    return executeLiveAdminAction(data.characterId, data.action as LiveAdminAction, admin.subject);
  });
