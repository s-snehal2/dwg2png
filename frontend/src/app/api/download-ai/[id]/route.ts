import type { NextRequest } from "next/server";
import { getConfig } from "@/server/config";
import { sweepTempDirs } from "@/server/services/fileCleanup";
import { httpStatusForCode, userMessageForCode } from "@/server/utils/errors";
import type { ErrorCode } from "@/server/utils/errors";
import { isSafeConversionId, aiOutputPath } from "@/server/utils/storage";
import { readFileSync, existsSync } from "node:fs";

export const runtime = "nodejs";

function log(message: string): void {
  console.info(`[download-ai] ${message}`);
}

/**
 * GET /api/download-ai/[id]
 * Serves the AI-generated PNG produced by the /api/generate route.
 * Same structure as /api/download/[id] — no deletion on download,
 * age-based sweep reclaims files.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSafeConversionId(id)) {
    log(`Rejected download for invalid conversion id "${id}".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  const aiPath = aiOutputPath(getConfig().outputsDir, id);
  const nameAbs = `${aiPath}.name`;

  if (!existsSync(aiPath)) {
    log(`Download requested for missing AI output "${id}.ai.png".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  const png = readFileSync(aiPath);
  let baseName = "dwg-ai-generation.png";
  try {
    if (existsSync(nameAbs)) {
      const stored = readFileSync(nameAbs, "utf8");
      if (stored) {
        baseName = stored;
      }
    }
  } catch {
    // Fall back to the generic name.
  }
  const safeBase = baseName.replace(/[^\w.\- ]+/g, "_");

  // Best-effort periodic cleanup.
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
    { status: httpStatusForCode(code) },
  );
}

export async function POST() {
  return errorResponse("INVALID_FILE");
}
