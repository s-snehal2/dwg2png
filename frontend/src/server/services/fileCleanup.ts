import { readdirSync, statSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Automatic cleanup of temporary files. Directories are swept for files whose
 * modification time is older than the configured age. Best-effort: failures
 * deleting a single file never break the request.
 */
export function sweepDirectory(dir: string, olderThanMs: number): number {
  const now = Date.now();
  let removed = 0;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return 0;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const stats = statSync(full);
      if (stats.isFile() && now - stats.mtimeMs > olderThanMs) {
        rmSync(full, { force: true });
        removed += 1;
      }
    } catch {
      // Skip files that vanished or can't be inspected.
    }
  }
  return removed;
}

export function sweepTempDirs(dirs: string[], olderThanMs: number): number {
  let removed = 0;
  for (const dir of dirs) {
    removed += sweepDirectory(dir, olderThanMs);
  }
  return removed;
}