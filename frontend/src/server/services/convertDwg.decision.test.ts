import { describe, expect, it } from "vitest";
import { selectViewForConversion, supersampleForEntities, type InspectedView } from "./convertDwg";
import type { Drawing } from "../models/drawing";

const baseDrawing: Drawing = {
  bounds: { minX: 0, minY: 0, maxX: 10, maxY: 10 },
  entities: [],
  layers: [],
  blocks: [],
};

function view(viewId: string, name: string, isModel: boolean): InspectedView {
  return {
    viewId,
    name,
    isModel,
    drawing: baseDrawing,
    statistics: { totalEntities: 0, renderedEntities: 0, skippedEntities: 0, warnings: [] },
    version: "AC1027",
  };
}

describe("selectViewForConversion", () => {
  it("renders the single paper sheet directly when the DWG has a model space plus one layout", () => {
    const selected = selectViewForConversion([
      view("model", "Model", true),
      view("layout-0", "Model 1", false),
    ]);
    expect(selected.viewId).toBe("layout-0");
  });

  it("rejects a DWG with more than one layout sheet", () => {
    expect(() =>
      selectViewForConversion([
        view("model", "Model", true),
        view("layout-0", "CIVIL LAYOUT", false),
        view("layout-1", "FLOORING LAYOUT -QUARTZ", false),
      ])
    ).toThrowError(
      expect.objectContaining({
        code: "MULTIPLE_LAYOUTS",
      })
    );
  });

  it("rejects layouts with elevation-like names too (no grouping)", () => {
    expect(() =>
      selectViewForConversion([
        view("model", "Model", true),
        view("layout-0", "ELEVATION AA", false),
        view("layout-1", "ELEVATION BB' (3)", false),
      ])
    ).toThrowError(
      expect.objectContaining({
        code: "MULTIPLE_LAYOUTS",
      })
    );
  });

  it("honours a configured maxLayouts limit", () => {
    const selected = selectViewForConversion(
      [
        view("model", "Model", true),
        view("layout-0", "Layout 1", false),
        view("layout-1", "Layout 2", false),
      ],
      2
    );
    expect(selected.viewId).toBe("layout-0");
  });

  it("uses the model space directly when it is the only renderable view", () => {
    const selected = selectViewForConversion([view("model", "Model", true)]);
    expect(selected.viewId).toBe("model");
  });

  it("picks the single sheet when layouts exist but there is no model content", () => {
    const selected = selectViewForConversion([view("layout-0", "Layout 1", false)]);
    expect(selected.viewId).toBe("layout-0");
  });
});

describe("supersampleForEntities", () => {
  it("keeps the configured oversample for normal drawings", () => {
    expect(supersampleForEntities(1000, 2)).toBe(2);
  });

  it("renders huge drawings at exact size (no oversample)", () => {
    expect(supersampleForEntities(20000, 2)).toBe(1);
  });
});