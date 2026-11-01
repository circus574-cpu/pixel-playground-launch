import postgres, { type Sql } from "postgres";

let globalSql: Sql | null = null;

export function getDatabaseUrl(): string | undefined {
  return (
    process.env["DATABASE_URL"] ||
    process.env["KI_ONLINE_TEST_DATABASE_URL"] ||
    process.env["GAME_DATABASE_URL"]
  );
}

export function getGameDb(): Sql | null {
  const url = getDatabaseUrl();
  if (!url) return null;
  if (!globalSql) {
    globalSql = postgres(url, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 5,
      connection: {
        application_name: "ki-admin-service",
        statement_timeout: 8000,
        lock_timeout: 2000,
      },
    });
  }
  return globalSql;
}

export async function closeGameDb(): Promise<void> {
  if (globalSql) {
    await globalSql.end().catch(() => {});
    globalSql = null;
  }
}
