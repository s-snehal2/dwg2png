import type { NextRequest } from "next/server";
import { getConfig, ensureTempDirs } from "@/server/config";
import { convertDwg } from "@/server/services/convertDwg";
import { sweepExpiredOutputs, saveOutput } from "@/server/services/outputStore";
import { validateExtension, validateFileSize } from "@/server/utils/fileValidation";
import { toAppError, userMessageForCode, httpStatusForCode } from "@/server/utils/errors";
import { newConversionId, uploadPath, writeBufferFileAtomic, deleteFileIfExists } from "@/server/utils/storage";
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
  console.info(`[convert] ${message}`);
}

/**
 * POST /api/convert
 *
 * Multipart/form-data with a `file` field. Converts the DWG to a single PNG:
 * a DWG with more paper-space layouts than `MAX_LAYOUTS` (default 1) is
 * rejected with MULTIPLE_LAYOUTS. Responds with a single ConversionResult.
 */
export async function POST(request: NextRequest) {
  const config = getConfig();

  try {
    const removed = await sweepExpiredOutputs(config.cleanupAgeMs);
    if (removed > 0) {
      log(`Cleanup removed ${removed} expired temporary file(s).`);
    }
  } catch (err) {
    log(`Cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!takeRateLimit(clientIp(request), config.rateLimitMax, 60_000)) {
    return Response.json(
      { success: false, error: userMessageForCode("RATE_LIMITED") },
      { status: httpStatusForCode("RATE_LIMITED") }
    );
  }

  ensureTempDirs(config);

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { success: false, error: userMessageForCode("INVALID_FILE") },
      { status: httpStatusForCode("INVALID_FILE") }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { success: false, error: userMessageForCode("INVALID_FILE") },
      { status: httpStatusForCode("INVALID_FILE") }
    );
  }

  const extensionCheck = validateExtension(file.name);
  if (!extensionCheck.ok) {
    return Response.json(
      { success: false, error: userMessageForCode(extensionCheck.error.code) },
      { status: httpStatusForCode(extensionCheck.error.code) }
    );
  }

  const sizeCheck = validateFileSize(file.size, config.maxFileSizeBytes);
  if (!sizeCheck.ok) {
    return Response.json(
      { success: false, error: userMessageForCode(sizeCheck.error.code) },
      { status: httpStatusForCode(sizeCheck.error.code) }
    );
  }

  const buffer = await file.arrayBuffer();
  const uploadAbs = uploadPath(config.uploadsDir, newConversionId());
  const originalFileName = file.name;
  const baseName = originalFileName.replace(/\.dwg$/i, "");

  try {
    writeBufferFileAtomic(uploadAbs, new Uint8Array(buffer));
    log(`File received: ${file.name} (${file.size} bytes), stored as ${uploadAbs}.`);

    const output = await convertDwg(buffer, config, { info: log });
    if (!output.png.byteLength) {
      throw new Error("PNG output is empty.");
    }

    const conversionId = newConversionId();
    const fileName = `${baseName}.png`;
    await saveOutput(conversionId, output.png, fileName);

    log(
      `Converted ${file.name} to ${fileName} (${output.png.byteLength} bytes) with sheet "${output.viewName}".`
    );

    return Response.json(
      {
        success: true,
        conversionId,
        originalFileName,
        fileName,
        size: output.png.byteLength,
        version: output.version,
        statistics: output.statistics,
        warnings: output.statistics.warnings,
        durationMs: output.totalDurationMs,
      },
      { status: 200 }
    );
  } catch (err) {
    const appError = toAppError(err);
    log(
      `Conversion failed (${appError.code}): ${err instanceof Error ? err.message : String(err)} for file "${file.name}" (${file.size} bytes).`
    );
    const status = httpStatusForCode(appError.code);
    if (status >= 500) {
      console.error(err);
    }
    return Response.json(
      { success: false, error: userMessageForCode(appError.code) },
      { status }
    );
  } finally {
    deleteFileIfExists(uploadAbs);
    deleteFileIfExists(`${uploadAbs}.name`);
  }
}

export async function GET() {
  return Response.json(
    { success: false, error: "Use POST /api/convert to convert a DWG file." },
    { status: 405 }
  );
}