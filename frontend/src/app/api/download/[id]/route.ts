import type { NextRequest } from "next/server";
import { getConfig } from "@/server/config";
import { sweepTempDirs } from "@/server/services/fileCleanup";
import { httpStatusForCode, userMessageForCode } from "@/server/utils/errors";
import type { ErrorCode } from "@/server/utils/errors";
import { isSafeConversionId, outputPath } from "@/server/utils/storage";
import { readFileSync, existsSync } from "node:fs";

export const runtime = "nodejs";

function log(message: string): void {
  console.info(`[download] ${message}`);
}

/**
 * GET /api/download/[id]
 * Serves the PNG produced for a conversion. The file is intentionally NOT
 * deleted here so the in-page preview and the "Download PNG" button can both
 * use the same URL; temp copies are reclaimed by the age-based sweep.
 * IDs are validated strictly to prevent path traversal.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSafeConversionId(id)) {
    log(`Rejected download for invalid conversion id "${id}".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  const outputAbs = outputPath(getConfig().outputsDir, id);
  const nameAbs = `${outputAbs}.name`;

  if (!existsSync(outputAbs)) {
    log(`Download requested for missing output "${id}.png".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  const png = readFileSync(outputAbs);
  const hasName = existsSync(nameAbs);
  let baseName = "dwg-conversion.png";
  if (hasName) {
    try {
      baseName = readFileSync(nameAbs, "utf8") || baseName;
    } catch {
      // Fall back to the generic name.
    }
  }
  const safeBase = baseName.replace(/[^\w.\- ]+/g, "_");

  // Best-effort periodic cleanup of expired temp files. Runs after the file
  // has been read so the requested conversion can never sweep itself away;
  // only resources older than the configured age are ever removed.
  try {
    sweepTempDirs([getConfig().uploadsDir, getConfig().outputsDir], getConfig().cleanupAgeMs);
  } catch {
    // Best-effort.
  }

  return new Response(new Uint8Array(png), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${safeBase}"`,
      "Content-Length": String(png.byteLength),
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(code: ErrorCode) {
  return Response.json(
    { success: false, error: userMessageForCode(code) },
    { status: httpStatusForCode(code) }
  );
}