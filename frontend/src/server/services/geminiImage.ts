import { AppError } from "../utils/errors";
import type { AppConfig } from "../config";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts: GeminiPart[] };
  }>;
}

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Call the Gemini Nano Banana 2 REST API to generate a photorealistic
 * visualization of the supplied architectural drawing PNG using a
 * static prompt. Returns the generated image as a PNG Buffer.
 */
export async function generateDrawingImage(
  png: Buffer,
  config: AppConfig,
): Promise<{ image: Buffer; durationMs: number }> {
  const started = Date.now();

  if (!config.geminiApiKey) {
    throw new AppError("AI_NOT_CONFIGURED", "No GEMINI_API_KEY configured.");
  }

  const model = config.geminiModel || "gemini-3.1-flash-image";
  const prompt = config.geminiPrompt || "Generate a realistic visualization of this architectural drawing.";

  const body = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: png.toString("base64"),
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(
    `${GEMINI_API_URL}/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": config.geminiApiKey,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    },
  ).catch((err) => {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      throw new AppError("AI_GENERATION_ERROR", "The AI image request timed out after 90 seconds. Please try again.");
    }
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AppError("AI_GENERATION_ERROR", "The AI image request was aborted. Please try again.");
    }
    throw err;
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new AppError("AI_GENERATION_ERROR", "Gemini API rate limit exceeded. Please try again shortly.");
    }
    if (res.status === 403) {
      throw new AppError("AI_NOT_CONFIGURED", "Gemini API key is invalid or has no access.");
    }
    throw new AppError(
      "AI_GENERATION_ERROR",
      `Gemini API error ${res.status}: ${errorBody.slice(0, 200)}`,
    );
  }

  const data = (await res.json()) as GeminiResponse;
  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new AppError("AI_GENERATION_ERROR", "Gemini returned no candidates.");
  }

  // Find the image part in the response.
  for (const part of candidate.content?.parts ?? []) {
    if (part.inlineData?.mimeType?.startsWith("image/") && part.inlineData.data) {
      return {
        image: Buffer.from(part.inlineData.data, "base64"),
        durationMs: Date.now() - started,
      };
    }
  }

  throw new AppError("AI_GENERATION_ERROR", "Gemini returned no image in its response.");
}
