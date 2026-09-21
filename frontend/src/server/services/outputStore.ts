import { put, get, list, del } from "@vercel/blob";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { getConfig, ensureTempDirs } from "@/server/config";
import { sweepTempDirs } from "@/server/services/fileCleanup";
import { outputPath, aiOutputPath, writeBufferFileAtomic } from "@/server/utils/storage";

/**
 * Output persistence facade.
 *
 * On Vercel (when `BLOB_READ_WRITE_TOKEN` is present) converted PNGs, AI
 * images and their display names live in Vercel Blob so they survive the
 * convert→preview two-request flow on ephemeral serverless filesystems.
 *
 * Everywhere else (local dev, Docker, tests) the original on-disk layout is
 * used — `outputs/{id}.png` + a `{id}.png.name` sidecar — so nothing changes
 * outside Vercel.
 */

export function isBlobEnabled(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
}

const BLOB_PREFIX = "outputs/";

function outputBlobPath(id: string): string {
  return `${BLOB_PREFIX}${id}.png`;
}

function outputNameBlobPath(id: string): string {
  return `${outputBlobPath(id)}.name`;
}

function aiBlobPath(id: string): string {
  return `${BLOB_PREFIX}${id}.ai.png`;
}

function aiNameBlobPath(id: string): string {
  return `${aiBlobPath(id)}.name`;
}

async function putBlob(pathname: string, body: string | Buffer, contentType: string): Promise<void> {
  await put(pathname, body, {
    access: "private",
    contentType,
    cacheControlMaxAge: 60,
  });
}

async function readBlob(pathname: string): Promise<Buffer | null> {
  const result = await get(pathname, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) {
    return null;
  }
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

async function readBlobText(pathname: string): Promise<string | null> {
  const bytes = await readBlob(pathname);
  return bytes ? bytes.toString("utf8") : null;
}

export interface StoredOutput {
  buffer: Buffer;
  fileName: string;
}

/** Persist a converted PNG plus its display filename. */
export async function saveOutput(id: string, png: Uint8Array, fileName: string): Promise<void> {
  if (isBlobEnabled()) {
    await putBlob(outputBlobPath(id), Buffer.from(png), "image/png");
    await putBlob(outputNameBlobPath(id), fileName, "text/plain");
    return;
  }
  const config = getConfig();
  ensureTempDirs(config);
  const abs = outputPath(config.outputsDir, id);
  writeBufferFileAtomic(abs, png);
  writeFileSync(`${abs}.name`, fileName, "utf8");
}

/** Persist an AI-generated PNG plus its display filename. */
export async function saveAiOutput(id: string, png: Uint8Array, fileName: string): Promise<void> {
  if (isBlobEnabled()) {
    await putBlob(aiBlobPath(id), Buffer.from(png), "image/png");
    await putBlob(aiNameBlobPath(id), fileName, "text/plain");
    return;
  }
  const config = getConfig();
  ensureTempDirs(config);
  const abs = aiOutputPath(config.outputsDir, id);
  writeBufferFileAtomic(abs, png);
  writeFileSync(`${abs}.name`, fileName, "utf8");
}

/** Read a converted PNG. Returns null when it no longer exists. */
export async function readOutput(id: string): Promise<StoredOutput | null> {
  if (isBlobEnabled()) {
    const buffer = await readBlob(outputBlobPath(id));
    if (!buffer) {
      return null;
    }
    const storedName = await readBlobText(outputNameBlobPath(id));
    return { buffer, fileName: storedName || "dwg-conversion.png" };
  }
  const abs = outputPath(getConfig().outputsDir, id);
  if (!existsSync(abs)) {
    return null;
  }
  return { buffer: readFileSync(abs), fileName: readSidecarName(`${abs}.name`, "dwg-conversion.png") };
}

/** Read an AI-generated PNG. Returns null when it no longer exists. */
export async function readAiOutput(id: string): Promise<StoredOutput | null> {
  if (isBlobEnabled()) {
    const buffer = await readBlob(aiBlobPath(id));
    if (!buffer) {
      return null;
    }
    const storedName = await readBlobText(aiNameBlobPath(id));
    return { buffer, fileName: storedName || "dwg-ai-generation.png" };
  }
  const abs = aiOutputPath(getConfig().outputsDir, id);
  if (!existsSync(abs)) {
    return null;
  }
  return { buffer: readFileSync(abs), fileName: readSidecarName(`${abs}.name`, "dwg-ai-generation.png") };
}

function readSidecarName(path: string, fallback: string): string {
  try {
    if (existsSync(path)) {
      const stored = readFileSync(path, "utf8");
      if (stored) {
        return stored;
      }
    }
  } catch {
    // Fall back to the generic name.
  }
  return fallback;
}

/** Age-based sweep of expired outputs (uploads + outputs). Best-effort. */
export async function sweepExpiredOutputs(olderThanMs: number): Promise<number> {
  if (isBlobEnabled()) {
    return sweepExpiredBlobs(olderThanMs);
  }
  const config = getConfig();
  return sweepTempDirs([config.uploadsDir, config.outputsDir], olderThanMs);
}

async function sweepExpiredBlobs(olderThanMs: number): Promise<number> {
  const now = Date.now();
  const expired: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({
      prefix: BLOB_PREFIX,
      limit: 1000,
      ...(cursor ? { cursor } : {}),
    });
    for (const blob of page.blobs) {
      if (now - blob.uploadedAt.getTime() > olderThanMs) {
        expired.push(blob.url);
      }
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  if (expired.length > 0) {
    await del(expired);
  }
  return expired.length;
}