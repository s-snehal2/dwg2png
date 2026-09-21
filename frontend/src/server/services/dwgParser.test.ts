import { describe, expect, it } from "vitest";
import {
  BlockRecord,
  DimensionLinear,
  Leader,
  Line,
  MText,
  Point,
  Solid,
  Viewport,
  XYZ,
  XY,
  Layout,
} from "@node-projects/acad-ts";
import type { CadDocument } from "@node-projects/acad-ts";
import { parseDwg, parseViews } from "./dwgParser";
import type { RawDwgData } from "./dwgReader";

/** A document whose modelspace holds one supported LINE plus extra entities. */
function fakeRaw(extra: unknown[]): RawDwgData {
  const line = new Line();
  line.startPoint = new XYZ(0, 0, 0);
  line.endPoint = new XYZ(10, 10, 0);
  return {
    version: "AC1027",
    document: {
      layers: [],
      blockRecords: [],
      modelSpace: { entities: [line, ...extra] },
    } as unknown as CadDocument,
  };
}

describe("parseDwg warning aggregation", () => {
  it("groups identical unsupported entities into one line with a count", () => {
    const { statistics } = parseDwg(fakeRaw([{ objectName: "HATCH" }, { objectName: "HATCH" }, { objectName: "HATCH" }]));
    expect(statistics.totalEntities).toBe(4);
    expect(statistics.renderedEntities).toBe(1);
    expect(statistics.skippedEntities).toBe(3);
    expect(statistics.warnings).toEqual(['Unsupported entity "HATCH" was skipped (3 occurrences).']);
  });

  it("sorts multiple unsupported types, one line per type with counts", () => {
    const { statistics } = parseDwg(
      fakeRaw([{ objectName: "SPLINE" }, { objectName: "HATCH" }, { objectName: "HATCH" }, { objectName: "SPLINE" }])
    );
    expect(statistics.warnings).toEqual([
      'Unsupported entity "HATCH" was skipped (2 occurrences).',
      'Unsupported entity "SPLINE" was skipped (2 occurrences).',
    ]);
  });

  it("reports a single unsupported type without a count suffix", () => {
    const { statistics } = parseDwg(fakeRaw([{ objectName: "SPLINE" }]));
    expect(statistics.warnings).toEqual(['Unsupported entity "SPLINE" was skipped.']);
  });

  it("keeps non-repeating generic warnings instead of aggregating them", () => {
    const { statistics } = parseDwg(fakeRaw([null]));
    expect(statistics.warnings).toEqual(["Skipped an entity that could not be recognized."]);
  });
});

/** A document whose paperspace holds a border LINE plus a window VIEWPORT. */
function fakeRawWithPage(includePaper = true): RawDwgData {
  const line = new Line();
  line.startPoint = new XYZ(0, 0, 0);
  line.endPoint = new XYZ(10, 10, 0);

  const border = new Line();
  border.startPoint = new XYZ(10, 10, 0);
  border.endPoint = new XYZ(390, 290, 0);

  const viewport = new Viewport();
  viewport.id = 2;
  viewport.center = new XYZ(200, 150, 0);
  viewport.width = 300;
  viewport.height = 200;
  viewport.viewCenter = new XY(50, 50);
  viewport.viewHeight = 100;

  return {
    version: "AC1027",
    document: {
      layers: [],
      blockRecords: [],
      modelSpace: { entities: [line] },
      ...(includePaper ? { paperSpace: { entities: [border, viewport] } } : {}),
    } as unknown as CadDocument,
  };
}

describe("parseDwg paper-space page", () => {
  it("returns a page with viewports and sheet entities when the DWG has a layout", () => {
    const { drawing, statistics } = parseDwg(fakeRawWithPage());
    expect(drawing.page).toBeDefined();
    expect(drawing.page!.viewports).toHaveLength(1);
    expect(drawing.page!.entities).toHaveLength(1);
    expect(statistics.page).toEqual({ entityCount: 1, viewportCount: 1 });

    const vp = drawing.page!.viewports[0];
    expect(vp.minX).toBe(50);
    expect(vp.minY).toBe(50);
    expect(vp.maxX).toBe(350);
    expect(vp.maxY).toBe(250);
    expect(vp.viewCenterX).toBe(50);
    expect(vp.viewCenterY).toBe(50);
    expect(vp.viewHeight).toBe(100);

    // The sheet bounds cover both the border and the viewport rect.
    expect(drawing.page!.bounds.minX).toBe(10);
    expect(drawing.page!.bounds.maxX).toBe(390);
    expect(drawing.page!.bounds.minY).toBe(10);
    expect(drawing.page!.bounds.maxY).toBe(290);
  });

  it("window geometry keeps the paper aspect instead of the raw model bounds", () => {
    const { drawing } = parseDwg(fakeRawWithPage());
    const page = drawing.page!;
    const model = drawing.bounds;
    // The page is 380x280 (portrait-ish sheet) while the model fit alone would
    // be dominated by whatever model extents exist; the page must define the
    // frame so the output is not an ultra-wide strip.
    expect(page.bounds.maxX - page.bounds.minX).toBeCloseTo(380);
    expect(page.bounds.maxY - page.bounds.minY).toBeCloseTo(280);
    expect(page.viewports[0].maxX - page.viewports[0].minX).toBeCloseTo(300);
    expect(page.viewports[0].maxY - page.viewports[0].minY).toBeCloseTo(200);
    void model;
  });

  it("skips the layout paper view and empty windows", () => {
    const paperView = new Viewport();
    paperView.id = Viewport.paperViewId;
    paperView.center = new XYZ(200, 150, 0);
    paperView.width = 380;
    paperView.height = 280;
    paperView.viewCenter = new XY(0, 0);
    paperView.viewHeight = 100;

    const emptyWindow = new Viewport();
    emptyWindow.id = 3;
    emptyWindow.center = new XYZ(0, 0, 0);
    emptyWindow.width = 0;
    emptyWindow.height = 0;
    emptyWindow.viewCenter = new XY(0, 0);
    emptyWindow.viewHeight = 100;

    const border = new Line();
    border.startPoint = new XYZ(10, 10, 0);
    border.endPoint = new XYZ(390, 290, 0);

    const raw: RawDwgData = {
      version: "AC1027",
      document: {
        layers: [],
        blockRecords: [],
        modelSpace: {
          entities: [
            (() => {
              const l = new Line();
              l.startPoint = new XYZ(0, 0, 0);
              l.endPoint = new XYZ(10, 10, 0);
              return l;
            })(),
          ],
        },
        paperSpace: { entities: [border, paperView, emptyWindow] },
      } as unknown as CadDocument,
    };

    const { drawing } = parseDwg(raw);
    expect(drawing.page).toBeDefined();
    expect(drawing.page!.viewports).toHaveLength(0);
    expect(drawing.page!.entities).toHaveLength(1);
  });

  it("falls back to model-only rendering when the DWG has no layout content", () => {
    const { drawing, statistics } = parseDwg(fakeRawWithPage(false));
    expect(drawing.page).toBeUndefined();
    expect(statistics.page).toBeUndefined();
  });
});

/** A raw doc with a Model layout plus two named paper-space sheet layouts. */
function fakeRawWithLayouts(emptySheet = false): RawDwgData {
  const line = new Line();
  line.startPoint = new XYZ(0, 0, 0);
  line.endPoint = new XYZ(10, 10, 0);

  const borderRect = (): Line => {
    const border = new Line();
    border.startPoint = new XYZ(10, 10, 0);
    border.endPoint = new XYZ(390, 290, 0);
    return border;
  };

  const windowViewport = (): Viewport => {
    const viewport = new Viewport();
    viewport.id = 2;
    viewport.center = new XYZ(200, 150, 0);
    viewport.width = 300;
    viewport.height = 200;
    viewport.viewCenter = new XY(50, 50);
    viewport.viewHeight = 100;
    return viewport;
  };

  const modelLayout = new Layout("Model");
  modelLayout.tabOrder = 2;
  modelLayout.associatedBlock = { entities: [] } as unknown as BlockRecord;

  const sheetOne = new Layout("Model 1");
  sheetOne.tabOrder = 1;
  sheetOne.associatedBlock = {
    entities: emptySheet ? [] : [borderRect(), windowViewport()],
  } as unknown as BlockRecord;

  const sheetTwo = new Layout("Model 2");
  sheetTwo.tabOrder = 0;
  sheetTwo.associatedBlock = { entities: [borderRect()] } as unknown as BlockRecord;

  return {
    version: "AC1027",
    document: {
      layers: [],
      blockRecords: [],
      modelSpace: { entities: [line] },
      layouts: [modelLayout, sheetOne, sheetTwo],
    } as unknown as CadDocument,
  };
}

describe("parseViews layout enumeration", () => {
  it("lists the model first, then paper sheets in tab order with dense ids", () => {
    const { views, version } = parseViews(fakeRawWithLayouts());
    expect(version).toBe("AC1027");
    expect(views.map((v) => v.viewId)).toEqual(["model", "layout-0", "layout-1"]);
    expect(views.map((v) => v.name)).toEqual(["Model", "Model 2", "Model 1"]);

    const [model, sheetB, sheetA] = views;
    expect(model.isModel).toBe(true);
    expect(model.drawing.page).toBeUndefined();

    // Sheets are ordered by tabOrder (Model 2 comes before Model 1) and are
    // never marked as the model, even though their names start with "Model".
    expect(sheetB.isModel).toBe(false);
    expect(sheetB.drawing.page?.viewports).toHaveLength(0);
    expect(sheetA.isModel).toBe(false);
    expect(sheetA.drawing.page?.viewports).toHaveLength(1);
    expect(sheetA.statistics.page).toEqual({ entityCount: 1, viewportCount: 1 });

    // Every sheet carries the shared model entities and a sheet-defined frame.
    expect(sheetA.drawing.entities).toHaveLength(1);
    expect(sheetA.drawing.bounds.maxX - sheetA.drawing.bounds.minX).toBeCloseTo(380);
  });

  it("does not surface the Model layout as a duplicate sheet", () => {
    const { views } = parseViews(fakeRawWithLayouts());
    expect(views.filter((v) => v.name === "Model")).toHaveLength(1);
    expect(views).toHaveLength(3);
  });

  it("skips sheets without renderable content but keeps ids dense", () => {
    const { views } = parseViews(fakeRawWithLayouts(true));
    expect(views.map((v) => v.viewId)).toEqual(["model", "layout-0"]);
    expect(views.map((v) => v.name)).toEqual(["Model", "Model 2"]);
  });

  it("falls back to the legacy paper-space block when there is no layout table", () => {
    const raw = fakeRawWithPage();
    const { views } = parseViews(raw);
    expect(views.map((v) => v.viewId)).toEqual(["model", "layout"]);
    expect(views[1].name).toBe("Layout 1");
    expect(views[1].isModel).toBe(false);
    expect(views[1].statistics.page).toEqual({ entityCount: 1, viewportCount: 1 });
  });

  it("returns only the model view when no sheet has content", () => {
    const raw = fakeRawWithPage(false);
    const { views } = parseViews(raw);
    expect(views).toHaveLength(1);
    expect(views[0].viewId).toBe("model");
  });

  it("throws when nothing is renderable at all", () => {
    const raw: RawDwgData = {
      version: "AC1027",
      document: {
        layers: [],
        blockRecords: [],
        modelSpace: { entities: [] },
      } as unknown as CadDocument,
    };
    expect(() => parseViews(raw)).toThrow("No drawable model space content");
  });
});

/** A raw doc whose model holds a dimension + leader plus their geometry. */
function fakeRawWithAnnotations(): RawDwgData {
  const dimensionLine = new Line();
  dimensionLine.startPoint = new XYZ(0, 0, 0);
  dimensionLine.endPoint = new XYZ(20, 0, 0);

  const arrowhead = new Solid();
  arrowhead.firstCorner = new XYZ(18, -1, 0);
  arrowhead.secondCorner = new XYZ(22, 0, 0);
  arrowhead.thirdCorner = new XYZ(18, 1, 0);
  arrowhead.fourthCorner = new XYZ(18, -1, 0);

  const valueText = new MText();
  valueText.insertPoint = new XYZ(10, -3, 0);
  valueText.height = 2;
  valueText.value = "5.0";

  const defPoint = new Point();
  defPoint.location = new XYZ(0, 0, 0);

  const dimensionBlock = new BlockRecord("*D909");
  dimensionBlock.entities.add(dimensionLine);
  dimensionBlock.entities.add(arrowhead);
  dimensionBlock.entities.add(valueText);
  dimensionBlock.entities.add(defPoint);

  const dimension = new DimensionLinear();
  dimension.block = dimensionBlock;

  const leader = new Leader();
  leader.vertices = [new XYZ(0, 0, 0), new XYZ(100, 0, 0)];
  leader.arrowHeadEnabled = true;

  return {
    version: "AC1027",
    document: {
      layers: [],
      blockRecords: [dimensionBlock],
      modelSpace: { entities: [dimension, leader] },
    } as unknown as CadDocument,
  };
}

describe("parseDwg dimension and leader rendering", () => {
  it("expands a dimension's block into geometry and skips its definition points", () => {
    const { drawing, statistics } = parseDwg(fakeRawWithAnnotations());
    expect(statistics.totalEntities).toBe(2);
    expect(statistics.renderedEntities).toBe(2);
    expect(statistics.skippedEntities).toBe(0);
    expect(statistics.warnings).toEqual([]);

    const types = drawing.entities.map((e) => e.type);
    expect(types).toContain("LINE");
    expect(types).toContain("MTEXT");
    expect(types).not.toContain("POINT");
    // Dimension block produces LINE + SOLID + MTEXT; the leader adds POLYLINE + SOLID.
    expect(types.filter((t) => t === "SOLID")).toHaveLength(2);
    expect(types.filter((t) => t === "POLYLINE")).toHaveLength(1);
  });

  it("keeps the dimension's measured text and the leader path", () => {
    const { drawing } = parseDwg(fakeRawWithAnnotations());
    const text = drawing.entities.find((e) => e.type === "MTEXT");
    expect(text?.type === "MTEXT" && text.text).toBe("5.0");

    const path = drawing.entities.find((e) => e.type === "POLYLINE");
    if (path?.type === "POLYLINE") {
      expect(path.vertices).toHaveLength(2);
      expect(path.vertices.map((v) => [v.x, v.y])).toEqual([
        [0, 0],
        [100, 0],
      ]);
    }
  });

  it("warns and skips a dimension whose block is missing", () => {
    const dimension = new DimensionLinear();
    dimension.block = null;

    const keep = new Line();
    keep.startPoint = new XYZ(0, 0, 0);
    keep.endPoint = new XYZ(10, 0, 0);

    const raw: RawDwgData = {
      version: "AC1027",
      document: {
        layers: [],
        blockRecords: [],
        modelSpace: { entities: [dimension, keep] },
      } as unknown as CadDocument,
    };
    const { statistics } = parseDwg(raw);
    expect(statistics.totalEntities).toBe(2);
    expect(statistics.skippedEntities).toBe(1);
    expect(statistics.warnings).toEqual(['Unsupported entity "DIMENSION" was skipped.']);
  });
});