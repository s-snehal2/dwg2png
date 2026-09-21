import type { NextRequest } from "next/server";
import { getConfig, ensureTempDirs } from "@/server/config";
import { generateDrawingImage } from "@/server/services/geminiImage";
import { sweepTempDirs } from "@/server/services/fileCleanup";
import { toAppError, httpStatusForCode, userMessageForCode } from "@/server/utils/errors";
import { isSafeConversionId, outputPath, aiOutputPath, writeBufferFileAtomic } from "@/server/utils/storage";
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { takeRateLimit } from "@/server/utils/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 300;

function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "local";
}

function log(message: string): void {
  console.info(`[generate] ${message}`);
}

/**
 * POST /api/generate/:id
 * Reads the already-converted DWG PNG and sends it to Gemini Nano Banana 2
 * with a static architectural visualization prompt.
 * Stores the generated AI image as outputs/{id}.ai.png.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const config = getConfig();

  if (!isSafeConversionId(id)) {
    log(`Rejected generate for invalid conversion id "${id}".`);
    return errorResponse("INVALID_FILE");
  }

  if (!config.geminiApiKey) {
    log("Generate requested but GEMINI_API_KEY is not configured.");
    return errorResponse("AI_NOT_CONFIGURED");
  }

  // Best-effort periodic cleanup of expired temp files.
  try {
    sweepTempDirs([config.uploadsDir, config.outputsDir], config.cleanupAgeMs);
  } catch (err) {
    log(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!takeRateLimit(clientIp(request), config.rateLimitMax, 60_000)) {
    return errorResponse("RATE_LIMITED");
  }

  const pngAbs = outputPath(config.outputsDir, id);
  if (!existsSync(pngAbs)) {
    log(`Generate requested for missing output "${id}.png".`);
    return errorResponse("FILE_NOT_FOUND");
  }

  let baseName = "dwg-conversion";
  const nameAbs = `${pngAbs}.name`;
  try {
    if (existsSync(nameAbs)) {
      const stored = readFileSync(nameAbs, "utf8");
      if (stored) {
        baseName = stored.replace(/\.png$/i, "");
      }
    }
  } catch {
    // Fall back to the generic name.
  }

  try {
    const png = readFileSync(pngAbs);
    log(`Sending ${id}.png (${png.byteLength} bytes) to Gemini for AI generation.`);

    const { image, durationMs } = await generateDrawingImage(png, config);
    log(`Gemini returned AI image (${image.byteLength} bytes) in ${durationMs}ms.`);

    ensureTempDirs(config);
    const aiPath = aiOutputPath(config.outputsDir, id);
    writeBufferFileAtomic(aiPath, new Uint8Array(image));
    writeFileSync(`${aiPath}.name`, `${baseName}-ai.png`, "utf8");
    log(`AI image written to ${id}.ai.png.`);

    return Response.json(
      {
        success: true,
        conversionId: id,
        fileName: `${baseName}-ai.png`,
        size: image.byteLength,
        durationMs,
      },
      { status: 200 },
    );
  } catch (err) {
    const appError = toAppError(err);
    log(`Generate failed (${appError.code}): ${err instanceof Error ? err.message : String(err)}.`);
    const status = httpStatusForCode(appError.code);
    if (status >= 500) {
      console.error(err);
    }
    return Response.json(
      { success: false, error: userMessageForCode(appError.code) },
      { status },
    );
  }
}

function errorResponse(code: string) {
  return Response.json(
    { success: false, error: userMessageForCode(code as never) },
    { status: httpStatusForCode(code as never) },
  );
}

export async function GET() {
  return errorResponse("INVALID_FILE");
}
