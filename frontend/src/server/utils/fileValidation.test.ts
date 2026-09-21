import { describe, expect, it } from "vitest";
import { validateDwgSignature } from "./fileValidation";

function head(...bytes: number[]): Uint8Array {
  return new Uint8Array(bytes);
}

describe("validateDwgSignature", () => {
  it("accepts a supported AC1018 signature", () => {
    const result = validateDwgSignature(head(0x41, 0x43, 0x31, 0x30, 0x31, 0x38));
    expect(result.ok).toBe(true);
  });

  it("rejects a non-DWG file", () => {
    const result = validateDwgSignature(head(0x50, 0x4b, 0x03, 0x04));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CORRUPTED_DWG");
    }
  });

  it("rejects an unsupported DWG version", () => {
    const result = validateDwgSignature(head(0x41, 0x43, 0x31, 0x30, 0x31, 0x30));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UNSUPPORTED_DWG_VERSION");
      expect(result.error.message).toContain("AC1010");
    }
  });

  it("accepts a signature when the version bytes are shorter than 6", () => {
    const result = validateDwgSignature(head(0x41, 0x43, 0x31, 0x30, 0x31));
    expect(result.ok).toBe(true);
  });
});