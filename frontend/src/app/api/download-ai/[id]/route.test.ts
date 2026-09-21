import { describe, expect, it, afterEach } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GET } from "./route";

/** Fresh sandboxed temp dir + env wiring per test. */
function makeSandbox(): string {
  const dir = mkdtempSync(join(tmpdir(), "dwg2png-download-ai-"));
  mkdirSync(join(dir, "uploads"), { recursive: true });
  mkdirSync(join(dir, "outputs"), { recursive: true });
  process.env.TEMP_DIR = dir;
  delete process.env.CLEANUP_AGE_MINUTES;
  return dir;
}

const request = () => new Request("http://localhost/api/download-ai/x") as never;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const VALID_ID = "73f939c6-1c05-4ee2-83e4-e4e4d64af738";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("GET /api/download-ai/[id]", () => {
  let sandbox: string;

  afterEach(() => {
    if (sandbox) {
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it("serves an existing AI-generated PNG with an attachment disposition", async () => {
    sandbox = makeSandbox();
    writeFileSync(join(sandbox, "outputs", `${VALID_ID}.ai.png`), PNG_BYTES);
    writeFileSync(join(sandbox, "outputs", `${VALID_ID}.ai.png.name`), "floor-plan-ai.png", "utf8");

    const res = await GET(request(), params(VALID_ID));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Content-Disposition")).toContain('filename="floor-plan-ai.png"');
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(new Uint8Array(PNG_BYTES));
  });

  it("falls back to a generic name when the sidecar is missing", async () => {
    sandbox = makeSandbox();
    writeFileSync(join(sandbox, "outputs", `${VALID_ID}.ai.png`), PNG_BYTES);

    const res = await GET(request(), params(VALID_ID));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Disposition")).toContain('filename="dwg-ai-generation.png"');
  });

  it("returns 404 for an invalid conversion id", async () => {
    sandbox = makeSandbox();
    const res = await GET(request(), params("../../etc/passwd"));
    expect(res.status).toBe(404);
  });

  it("returns 404 JSON when the AI output file does not exist", async () => {
    sandbox = makeSandbox();
    const res = await GET(request(), params(VALID_ID));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(false);
  });
});
