import type { ConversionError, ConversionResult, AiImageResult, TilesviewResult } from "@/types/conversion";

/** Client wrapper for the DWG → PNG API endpoints. */

/** Whether a fetch was cancelled via an AbortController. */
function isAbortError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "AbortError";
}

/** Shared error handling for JSON-shaped API responses. */
async function parseJsonResponse<T>(res: Response, fallbackMessage: string): Promise<T> {
  const data = (await res.json().catch(() => null)) as (T & ConversionError) | ConversionError | null;

  if (!res.ok || !data || !("success" in data) || !data.success) {
    const message =
      data && "error" in data && typeof data.error === "string"
        ? data.error
        : fallbackMessage;
    throw new Error(message);
  }

  return data as T;
}

/** Convert a DWG directly (no picker) — renders the single drawable sheet. */
export async function convertDwg(
  file: File,
  options?: { signal?: AbortSignal }
): Promise<ConversionResult> {
  const formData = new FormData();
  formData.append("file", file);

  let res: Response;
  try {
    res = await fetch("/api/convert", {
      method: "POST",
      body: formData,
      signal: options?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new Error("Could not reach the server. Please try again.");
  }

  return parseJsonResponse<ConversionResult>(res, "Conversion failed. Please try again.");
}

/** Build the download URL for a completed conversion. */
export function downloadUrl(conversionId: string): string {
  return `/api/download/${encodeURIComponent(conversionId)}`;
}

/** Build the download URL for an AI-generated image. */
export function aiDownloadUrl(conversionId: string): string {
  return `/api/download-ai/${encodeURIComponent(conversionId)}`;
}

/** Call the server to generate an AI image from the already-converted DWG PNG. */
export async function generateAiImage(
  conversionId: string,
  options?: { signal?: AbortSignal }
): Promise<AiImageResult> {
  let res: Response;
  try {
    res = await fetch(`/api/generate/${encodeURIComponent(conversionId)}`, {
      method: "POST",
      signal: options?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new Error("Could not reach the server. Please try again.");
  }

  return parseJsonResponse<AiImageResult>(res, "AI image generation failed. Please try again.");
}

/** Call the server to upload a generated AI image to TilesView. */
export async function sendToTilesview(
  conversionId: string,
  options?: { signal?: AbortSignal }
): Promise<TilesviewResult> {
  let res: Response;
  try {
    res = await fetch(`/api/tilesview/${encodeURIComponent(conversionId)}`, {
      method: "POST",
      signal: options?.signal,
    });
  } catch (err) {
    if (isAbortError(err)) {
      throw err;
    }
    throw new Error("Could not reach the server. Please try again.");
  }
  return parseJsonResponse<TilesviewResult>(res, "Sending to TilesView failed. Please try again.");
}
