/** The content volume: release folders with the manifest's packs, kept as plain files so Caddy or Node can serve them with Range. */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

export const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,39}$/;
export const PACK_FILE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*-[0-9a-f]{12}\.pck$/;
export const MAX_PACK_BYTES = 400 * 1024 * 1024;

export type PackEntry = { file: string; bytes: number; sha256: string; files?: number };
export type ContentManifest = {
  format: "ki-godot-content-1";
  version: string;
  engine?: string;
  createdAt?: string;
  packs: Record<string, PackEntry>;
  lands: Record<string, string[]>;
};

export class ContentError extends Error {
  constructor(
    readonly code:
      | "BAD_VERSION"
      | "BAD_FILE"
      | "TOO_LARGE"
      | "HASH_MISMATCH"
      | "MISSING_PACK"
      | "BAD_MANIFEST"
      | "NOT_FOUND",
    message?: string,
  ) {
    super(message ?? code);
  }
}

export class ContentFiles {
  constructor(readonly root: string) {}

  releaseDir(version: string) {
    if (!VERSION_PATTERN.test(version)) throw new ContentError("BAD_VERSION");
    return path.join(this.root, "releases", version);
  }

  packPath(version: string, file: string) {
    if (!PACK_FILE_PATTERN.test(file)) throw new ContentError("BAD_FILE");
    return path.join(this.releaseDir(version), file);
  }

  async stat(version: string, file: string) {
    try {
      const s = await stat(this.packPath(version, file));
      return s.isFile() ? s : null;
    } catch (error) {
      if (error instanceof ContentError) throw error;
      return null;
    }
  }

  open(version: string, file: string, range?: { start: number; end: number }) {
    return createReadStream(this.packPath(version, file), range);
  }

  async list(version: string): Promise<string[]> {
    try {
      return (await readdir(this.releaseDir(version))).filter((f) => PACK_FILE_PATTERN.test(f));
    } catch {
      return [];
    }
  }

  /** Streams an upload into the release folder; the file only appears under its final name once its SHA-256 matches. */
  async save(version: string, file: string, body: Readable, sha256: string): Promise<number> {
    if (!/^[0-9a-f]{64}$/.test(sha256)) throw new ContentError("HASH_MISMATCH");
    const final = this.packPath(version, file);
    if (!file.includes("-" + sha256.slice(0, 12) + ".pck")) throw new ContentError("HASH_MISMATCH");
    await mkdir(path.dirname(final), { recursive: true });
    const temp = final + ".part-" + process.pid + "-" + Date.now();
    const hash = createHash("sha256");
    let length = 0;
    try {
      await pipeline(
        body,
        async function* (source: AsyncIterable<Buffer>) {
          for await (const chunk of source) {
            length += chunk.length;
            if (length > MAX_PACK_BYTES) throw new ContentError("TOO_LARGE");
            hash.update(chunk);
            yield chunk;
          }
        },
        createWriteStream(temp, { flags: "wx", mode: 0o640 }),
      );
      if (hash.digest("hex") !== sha256) throw new ContentError("HASH_MISMATCH");
      await rename(temp, final);
      return length;
    } catch (error) {
      await unlink(temp).catch(() => {});
      throw error;
    }
  }

  async sha256Of(version: string, file: string): Promise<string> {
    const hash = createHash("sha256");
    for await (const chunk of this.open(version, file)) hash.update(chunk as Buffer);
    return hash.digest("hex");
  }

  /** A manifest is publishable only when every pack it names exists with exactly the declared size and hash. */
  async verify(manifest: ContentManifest): Promise<void> {
    if (manifest.format !== "ki-godot-content-1" || !manifest.packs || !manifest.lands)
      throw new ContentError("BAD_MANIFEST");
    for (const [name, entry] of Object.entries(manifest.packs)) {
      if (!/^[a-z0-9-]+$/.test(name)) throw new ContentError("BAD_MANIFEST", name);
      const s = await this.stat(manifest.version, entry.file);
      if (!s) throw new ContentError("MISSING_PACK", entry.file);
      if (s.size !== entry.bytes) throw new ContentError("HASH_MISMATCH", entry.file);
      if ((await this.sha256Of(manifest.version, entry.file)) !== entry.sha256)
        throw new ContentError("HASH_MISMATCH", entry.file);
    }
    for (const [land, needs] of Object.entries(manifest.lands))
      for (const need of needs)
        if (!manifest.packs[need]) throw new ContentError("BAD_MANIFEST", `${land}:${need}`);
  }

  async remove(version: string) {
    await rm(this.releaseDir(version), { recursive: true, force: true });
  }
}
