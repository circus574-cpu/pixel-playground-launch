#!/usr/bin/env node
/**
 * Writes the publication log the /admin "Dziennik" tab shows: the latest changes on main (each one
 * reached production through the Aruba deploy and its quality gate) and the newest entries of the
 * daily change journals in docs/zmiany. Run by .github/workflows/aruba-production.yml right before
 * the release bundle is packed; needs git history (fetch-depth) and docs/zmiany.
 *
 * Usage: node scripts/build_publications.mjs <output.json> [limit]
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const [, , output = "public/publications.json", limitArg = "40"] = process.argv;
const limit = Math.max(1, Math.min(200, Number(limitArg) || 40));

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });

/** Turns one first-parent commit into a readable entry; null for noise (plain sync merges). */
export function publicationEntry(sha, date, subject, body) {
  if (/^Merge (remote-tracking )?branch /.test(subject)) return null;
  const pr = /^Merge (?:PR|pull request) #(\d+)/.exec(subject)?.[1];
  const firstBodyLine = body
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !/^(Co-Authored-By|Claude-Session|Signed-off-by):/i.test(l));
  const title = pr
    ? (firstBodyLine ?? subject.replace(/^Merge (?:PR|pull request) #\d+:?\s*/, ""))
    : subject;
  return {
    sha: sha.slice(0, 7),
    date,
    pr: pr ? Number(pr) : null,
    title,
    technical: pr ? subject.replace(/^Merge (?:PR|pull request) #\d+:?\s*/, "") : null,
  };
}

/** `### N. Title` headings of the newest daily journals. */
export function journalEntries(root, days = 5) {
  const dir = path.join(root, "docs", "zmiany");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && existsSync(path.join(dir, d, "ZMIANY.md")))
    .sort()
    .reverse()
    .slice(0, days)
    .map((date) => ({
      date,
      items: readFileSync(path.join(dir, date, "ZMIANY.md"), "utf8")
        .split("\n")
        .filter((l) => /^###\s+/.test(l))
        .map((l) => l.replace(/^###\s+(\d+\.\s*)?/, "").trim())
        .reverse(),
    }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const raw = git(
    "log",
    "--first-parent",
    `-n${limit * 2}`,
    "--format=%H%x1f%cI%x1f%s%x1f%b%x1e",
    "HEAD",
  );
  const entries = raw
    .split("\x1e")
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => {
      const [sha = "", date = "", subject = "", body = ""] = r.split("\x1f");
      return publicationEntry(sha, date, subject, body);
    })
    .filter(Boolean)
    .slice(0, limit);
  const data = {
    format: "ki-publications-1",
    generatedAt: new Date().toISOString(),
    deployedSha: git("rev-parse", "--short=7", "HEAD").trim(),
    entries,
    journal: journalEntries(process.cwd()),
  };
  writeFileSync(output, JSON.stringify(data, null, 2) + "\n");
  console.log(
    `Wrote ${entries.length} publications and ${data.journal.length} journal days to ${output}`,
  );
}
