/** Boss trials are limited to the isolated playtest document. Never enabled on the public route. */
export const bossPreviewEnabled = (path: string, search: string) =>
  path === "/scripts/playtest.html" && new URLSearchParams(search).get("ki-bosses") === "1";
