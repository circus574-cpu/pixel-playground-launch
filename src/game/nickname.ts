/** Character nickname rules, shared by the creation form, the save validator and tests. */
export const NICK_MIN = 3;
export const NICK_MAX = 16;
export const DEFAULT_NICK = "Wędrowiec";
const ALLOWED = /^[\p{L}\p{N}][\p{L}\p{N} _'-]*$/u;

export const normalizeNick = (raw: string) => raw.trim().replace(/\s+/g, " ");

/** Empty means "use the default"; anything else must satisfy the rules. Returns a Polish message or "". */
export function nickError(raw: string): string {
  const nick = normalizeNick(raw);
  if (!nick) return "";
  if ([...nick].length < NICK_MIN) return `Nick ma co najmniej ${NICK_MIN} znaki.`;
  if ([...nick].length > NICK_MAX) return `Nick ma najwyżej ${NICK_MAX} znaków.`;
  if (!ALLOWED.test(nick))
    return "Dozwolone są litery, cyfry, spacja oraz znaki _ - ' (zacznij od litery lub cyfry).";
  return "";
}
export const isValidNick = (nick: string) =>
  nick === normalizeNick(nick) && nickError(nick) === "" && nick !== "";
