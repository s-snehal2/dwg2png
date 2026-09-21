import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { put, get } from "@vercel/blob";
import {
  saveAiOutput,
  getAiGenerationCount,
  incrementAiGenerationCount,
} from "./outputStore";

vi.mock("@vercel/blob", () => ({
  put: vi.fn(async (pathname: string) => ({ url: `https://blob.test/${pathname}`, pathname })),
  get: vi.fn(async () => null),
  list: vi.fn(async () => ({ blobs: [], hasMore: false })),
  del: vi.fn(async () => undefined),
}));

const mockedPut = vi.mocked(put);
const mockedGet = vi.mocked(get);

const ID = "73f939c6-1c05-4ee2-83e4-e4e4d64af738";
const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

describe("outputStore (blob mode)", () => {
  beforeEach(() => {
    process.env.BLOB_STORE_ID = "test-store";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    mockedPut.mockClear();
    mockedGet.mockReset();
    mockedGet.mockResolvedValue(null);
  });

  afterEach(() => {
    delete process.env.BLOB_STORE_ID;
  });

  it("overwrites an existing AI blob on re-generation instead of throwing", async () => {
    await saveAiOutput(ID, PNG_BYTES, "drawing-ai.png");
    await expect(saveAiOutput(ID, PNG_BYTES, "drawing-ai.png")).resolves.toBeUndefined();

    expect(mockedPut).toHaveBeenCalledTimes(4);
    for (const call of mockedPut.mock.calls) {
      expect(call[2]).toMatchObject({ allowOverwrite: true });
    }
  });

  it("reads and increments the AI generation count", async () => {
    await expect(getAiGenerationCount(ID)).resolves.toBe(0);

    await expect(incrementAiGenerationCount(ID)).resolves.toBe(1);
    expect(mockedPut).toHaveBeenCalledWith(
      expect.stringContaining(".ai.png.count"),
      "1",
      expect.objectContaining({ allowOverwrite: true }),
    );
  });
});
