import type { NextRequest } from "next/server";
import { getConfig } from "@/server/config";
import { readOutput, sweepExpiredOutputs } from "@/server/services/outputStore";
import { httpStatusForCode, userMessageForCode } from "@/server/utils/errors";
import type { ErrorCode } from "@/server/utils/errors";
import { isSafeConversionId } from "@/server/utils/storage";

export const runtime = "nodejs";

function log(message: string): void {
  console.info(`[download] ${message}`);
}

/**
 * GET /api/download/[id]
 * Serves the PNG produced for a conversion. On Vercel the output lives in
 * Blob (durable across serverless instances); locally it is read from disk.
 * The file is intentionally NOT deleted on download so the in-page preview
 * and the "Download PNG" button can both use the same URL; age-based sweeping
 * reclaims outputs.
 * IDs are validated strictly to prevent path traversal.
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!isSafeConversionId(id)) {
    log(`Rejected download for invalid conversion id "${id}".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  const stored = await readOutput(id);
  if (!stored) {
    log(`Download requested for missing output "${id}.png".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  const safeBase = stored.fileName.replace(/[^\w.\- ]+/g, "_");

  // Best-effort periodic cleanup of expired outputs. Runs after the file has
  // been read so the requested conversion can never sweep itself away.
  try {
    await sweepExpiredOutputs(getConfig().cleanupAgeMs);
  } catch {
    // Best-effort.
  }

  return new Response(new Uint8Array(stored.buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Disposition": `attachment; filename="${safeBase}"`,
      "Content-Length": String(stored.buffer.byteLength),
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