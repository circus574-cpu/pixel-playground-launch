import { STREAM_TEXTURE_BUDGET_BYTES } from "./streamBudget";

/**
 * Budżet warstwy podłoża. Audyt 11.11.2026 zmierzył 198–240 MiB tekstur przy suficie 192 MiB,
 * bo `streamTextureBytes` liczył tylko atlasy z katalogu, a upieczone canvasy chunków żyły poza
 * licznikiem. Ten moduł domyka rachunek: podłoże ma swój jawny koszt i dobiera rozdzielczość tak,
 * żeby suma z atlasami zmieściła się w tym samym suficie.
 *
 * Degradacja idzie po rozdzielczości, nie po treści: gracz dostaje mniej pikseli podłoża, a nie
 * mniej obiektów świata. Liczba chunków zostaje bez zmian, żeby nie ruszać streamingu ani zapisów.
 */
export const GROUND_CHUNK_LIMIT = 12;
/** Kandydaci od najlepszego do najtańszego; 512 to podłoga, poniżej której podłoże traci czytelność. */
export const GROUND_RESOLUTIONS = [1024, 768, 512] as const;

export function groundTextureBytes(resolution: number, chunks = GROUND_CHUNK_LIMIT): number {
  return chunks * resolution * resolution * 4;
}

/**
 * Największa rozdzielczość nieprzekraczająca `preferred`, przy której atlasy i podłoże mieszczą się
 * w budżecie. Gdy nie mieści się żadna, zwraca najtańszą — budżet ma być dotrzymany, a nie udawany.
 */
export function chooseGroundResolution(
  atlasBytes: number,
  preferred: number,
  chunks = GROUND_CHUNK_LIMIT,
): number {
  for (const resolution of GROUND_RESOLUTIONS) {
    if (resolution > preferred) continue;
    if (atlasBytes + groundTextureBytes(resolution, chunks) <= STREAM_TEXTURE_BUDGET_BYTES)
      return resolution;
  }
  return GROUND_RESOLUTIONS[GROUND_RESOLUTIONS.length - 1]!;
}

/**
 * Opt-in profil wydajności (Faza 5): `?ki-ground-res=512` (albo 768 / 1024) obniża sufit pieczenia
 * podłoża. Koszt pieczenia rośnie z kwadratem rozdzielczości, więc 1024→512 to ~4× tańsza pieczeń
 * i krótsze zamrożenie przy wejściu w chunk. Bez parametru zwraca null — domyślne zachowanie bez zmian.
 * Wartość spoza listy kandydatów jest ignorowana (null), żeby nie piec w przypadkowej rozdzielczości.
 */
export function groundResolutionOverride(search: string): number | null {
  const raw = new URLSearchParams(search).get("ki-ground-res");
  if (!raw) return null;
  const value = Number(raw);
  return (GROUND_RESOLUTIONS as readonly number[]).includes(value) ? value : null;
}

/**
 * Adaptacyjne pieczenie w profilu wydajności. Gdy pojedyncza pieczeń przekracza budżet klatki,
 * nie dokładamy drugiej w tej samej klatce (najgorsze zamrożenie = 2 pieczenie naraz). Bez profilu
 * zawsze 2, żeby domyślne zachowanie zostało nietknięte. Raz wykryta wolna pieczeń utrzymuje 1/klatkę.
 */
export const BAKE_FRAME_BUDGET_MS = 100;
export function bakesPerFrame(lastBakeMs: number, profileActive: boolean): number {
  if (!profileActive) return 2;
  return lastBakeMs > BAKE_FRAME_BUDGET_MS ? 1 : 2;
}
