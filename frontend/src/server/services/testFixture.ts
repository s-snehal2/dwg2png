import { DxfReader, DwgWriter } from "@node-projects/acad-ts";

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
ENDSEC
0
EOF
`.trim();

/**
 * Build a real DWG byte array from a small hand-written DXF via acad-ts.
 * Shared by route/integration tests.
 */
export function minimalDwgBytes(): Uint8Array {
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