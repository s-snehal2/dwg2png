import { describe, expect, it } from "vitest";
import { AppError, toAppError, httpStatusForCode, userMessageForCode } from "./errors";

describe("toAppError", () => {
  it("returns AppError instances unchanged", () => {
    const original = new AppError("CORRUPTED_DWG", "bad header");
    expect(toAppError(original)).toBe(original);
  });

  it("does not misclassify unrecognized errors as parse failures", () => {
    const err = toAppError(new Error("Vercel Blob: something odd happened"));
    expect(err.code).toBe("INTERNAL_ERROR");
  });

  it("maps known keywords to specific codes", () => {
    expect(toAppError(new Error("Gemini API error 500")).code).toBe("AI_GENERATION_ERROR");
    expect(toAppError(new Error("sharp failed to encode")).code).toBe("PNG_GENERATION_ERROR");
    expect(toAppError(new Error("unsupported DWG version")).code).toBe("UNSUPPORTED_DWG_VERSION");
  });

  it("maps non-Error values to INTERNAL_ERROR", () => {
    expect(toAppError("boom").code).toBe("INTERNAL_ERROR");
  });
});

describe("AI_LIMIT_REACHED", () => {
  it("uses HTTP 429 and a user-facing message", () => {
    expect(httpStatusForCode("AI_LIMIT_REACHED")).toBe(429);
    expect(userMessageForCode("AI_LIMIT_REACHED")).toMatch(/maximum/i);
  });
});
