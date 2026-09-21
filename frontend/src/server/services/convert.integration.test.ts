import { describe, expect, it } from "vitest";
import { DxfReader, DwgWriter } from "@node-projects/acad-ts";
import { Line, Viewport, XYZ, XY } from "@node-projects/acad-ts";
import type { CadDocument } from "@node-projects/acad-ts";
import { convertDwg } from "./convertDwg";
import type { AppConfig } from "../config";
import sharp from "sharp";

const TEST_CONFIG: AppConfig = {
  maxFileSizeBytes: 50 * 1024 * 1024,
  maxPngDimension: 1000,
  marginPx: 50,
  pngSupersample: 2,
  minStrokePx: 1.2,
  maxLayouts: 1,
  cleanupAgeMs: 30 * 60 * 1000,
  tempRootDir: "",
  uploadsDir: "",
  outputsDir: "",
  rateLimitMax: 30,
  geminiApiKey: "",
  geminiPrompt: "",
  geminiModel: "gemini-3.1-flash-image",
  aiGenerationLimit: 5,
};

const MINIMAL_DXF = `0
SECTION
2
HEADER
9
$ACADVER
1
AC1027
9
$INSBASE
10
0.0
20
0.0
30
0.0
0
ENDSEC
0
SECTION
2
CLASSES
0
ENDSEC
0
SECTION
2
TABLES
0
ENDSEC
0
SECTION
2
BLOCKS
0
ENDSEC
0
SECTION
2
ENTITIES
0
LINE
8
0
10
10.0
20
10.0
30
0.0
11
20.0
21
10.0
31
0.0
0
CIRCLE
8
0
10
15.0
20
15.0
30
0.0
40
5.0
0
LWPOLYLINE
8
0
90
4
70
1
10
0.0
20
0.0
10
0.0
20
10.0
10
10.0
20
10.0
10
10.0
20
0.0
0
ENDSEC
0
EOF
`.trim();

/** Build a real DWG byte array from a small hand-written DXF via acad-ts. */
function makeDwgBytes(): Uint8Array {
  const document = DxfReader.readFromStream(new TextEncoder().encode(MINIMAL_DXF));
  // The DxfReader returns a document with empty symbol tables; the DWG writer
  // requires the standard entries (text style, linetypes, layers, dimstyles,
  // model/paper space blocks), so re-create the defaults before writing.
  for (const collection of [
    document.lineTypes,
    document.layers,
    document.textStyles,
    document.dimensionStyles,
    document.blockRecords,
  ]) {
    if (collection && typeof collection.createDefaultEntries === "function") {
      collection.createDefaultEntries();
    }
  }
  return DwgWriter.writeToBuffer(document);
}

describe("convertDwg integration", () => {
  it("converts a real DWG into a valid PNG with expected statistics", async () => {
    const bytes = makeDwgBytes();
    expect(bytes.length).toBeGreaterThan(64);
    const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
    expect(signature).toBe("AC10");

    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const result = await convertDwg(arrayBuffer, TEST_CONFIG);

    expect(result.statistics.totalEntities).toBeGreaterThanOrEqual(3);
    expect(result.statistics.renderedEntities).toBe(3);
    expect(result.statistics.skippedEntities).toBe(0);

    // Valid PNG (8-byte magic signature).
    const png = new Uint8Array(result.png);
    const magic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    expect(Array.from(png.slice(0, 8))).toEqual(magic);

    const metadata = await sharp(result.png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBeGreaterThan(0);
    expect(metadata.height).toBeGreaterThan(0);
  });

  it("rejects content that is not a DWG", async () => {
    const garbage = new TextEncoder().encode("not a dwg file at all").buffer;
    await expect(convertDwg(garbage, TEST_CONFIG)).rejects.toMatchObject({ code: "CORRUPTED_DWG" });
  });

  it("renders a paper-space page with a viewport at page proportions", async () => {
    const modelLine = new Line();
    modelLine.startPoint = new XYZ(0, 0, 0);
    modelLine.endPoint = new XYZ(100, 100, 0);

    const border = new Line();
    border.startPoint = new XYZ(10, 10, 0);
    border.endPoint = new XYZ(390, 290, 0);

    const viewport = new Viewport();
    viewport.id = 2;
    viewport.center = new XYZ(200, 150, 0);
    viewport.width = 380;
    viewport.height = 280;
    viewport.viewCenter = new XY(50, 50);
    viewport.viewHeight = 100;

    const document = {
      layers: [],
      blockRecords: [],
      modelSpace: { entities: [modelLine] },
      paperSpace: { entities: [border, viewport] },
    } as unknown as CadDocument;

    const buffer = new TextEncoder().encode("AC1027 page").buffer as ArrayBuffer;

    const result = await convertDwg(
      buffer,
      TEST_CONFIG,
      {},
      { read: () => ({ version: "AC1027", document }) }
    );

    expect(result.statistics.page).toEqual({ entityCount: 1, viewportCount: 1 });

    const metadata = await sharp(result.png).metadata();
    // Page bounds (10,10)-(390,290) = 380x280, scaled into maxWidth 1000 with
    // margin 50: scale = min(900/380, 900/280) so width hits 1000 exactly and
    // the height follows the page's 380x280 sheet ratio.
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(1000);
    expect(metadata.height).toBe(764);
  });
});