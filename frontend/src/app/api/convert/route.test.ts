import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { POST } from "./route";
import { minimalDwgBytes } from "@/server/services/testFixture";

function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "dwg2png-convert-"));
  mkdirSync(join(dir, "uploads"), { recursive: true });
  mkdirSync(join(dir, "outputs"), { recursive: true });
  process.env.TEMP_DIR = dir;
  delete process.env.CLEANUP_AGE_MINUTES;
  return dir;
}

function multipartRequest(fileName: string, bytes: Uint8Array): never {
  const form = new FormData();
  const blob = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  form.append("file", new File([blob], fileName, { type: "application/octet-stream" }));
  return new Request("http://localhost/api/convert", { method: "POST", body: form }) as never;
}

interface ConversionResultBody {
  success: boolean;
  conversionId: string;
  originalFileName: string;
  fileName: string;
  size: number;
  version: string | null;
  statistics: { totalEntities: number; renderedEntities: number; skippedEntities: number; warnings: string[] };
  warnings: string[];
}

describe("POST /api/convert — direct multipart upload", () => {
  let sandbox: string;

  afterEach(() => {
    if (sandbox) {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("converts the DWG and returns a single PNG result", async () => {
    sandbox = makeSandbox();
    const res = await POST(multipartRequest("drawing.dwg", minimalDwgBytes()));
    expect(res.status).toBe(200);
    const body = (await res.json()) as ConversionResultBody;

    expect(body.success).toBe(true);
    expect(body.originalFileName).toBe("drawing.dwg");
    expect(/^[0-9a-f-]{36}$/.test(body.conversionId)).toBe(true);
    expect(body.fileName).toBe("drawing.png");
    expect(body.size).toBeGreaterThan(0);
    expect(Array.isArray(body.warnings)).toBe(true);
    expect(body.statistics.totalEntities).toBeGreaterThan(0);
    expect(existsSync(join(sandbox, "outputs", `${body.conversionId}.png`))).toBe(true);
    // The staged upload is consumed after conversion.
    const uploads = join(sandbox, "uploads");
    expect(readdirSync(uploads).some((name) => name.endsWith(".dwg"))).toBe(false);
  });

  it("rejects a non-DWG extension", async () => {
    sandbox = makeSandbox();
    const res = await POST(multipartRequest("notes.txt", new TextEncoder().encode("hello")));
    expect(res.status).toBe(400);
  });
});