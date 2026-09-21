import { describe, expect, it } from "vitest";
import { computeViewport, worldToPixel } from "./coordinateMapper";
import type { Bounds } from "../models/bounds";

const SQUARE: Bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100 };

describe("computeViewport", () => {
  it("preserves aspect ratio and reserves the margin", () => {
    const viewport = computeViewport(SQUARE, { maxWidth: 1000, maxHeight: 1000, margin: 50 });
    expect(viewport.scale).toBeCloseTo(900 / 100);
    expect(viewport.canvasWidth).toBe(1000);
    expect(viewport.canvasHeight).toBe(1000);
  });

  it("fits a wide drawing into the width limit", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 100 };
    const viewport = computeViewport(bounds, { maxWidth: 800, maxHeight: 800, margin: 50 });
    expect(viewport.canvasWidth).toBe(800);
    expect(viewport.canvasHeight).toBeLessThan(800);
    expect(viewport.canvasHeight).toBeGreaterThan(0);
  });

  it("clamps a zero-sized drawing to a non-zero canvas", () => {
    const bounds: Bounds = { minX: 5, minY: 5, maxX: 5, maxY: 5 };
    const viewport = computeViewport(bounds, { maxWidth: 400, maxHeight: 400, margin: 50 });
    expect(viewport.canvasWidth).toBeGreaterThan(0);
    expect(viewport.canvasHeight).toBeGreaterThan(0);
  });

  it("adopts a wide drawing's aspect ratio instead of letterboxing it", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 400, maxY: 100 };
    const viewport = computeViewport(bounds, { maxWidth: 800, maxHeight: 800, margin: 50 });
    expect(viewport.canvasWidth).toBe(800);
    expect(viewport.canvasHeight).toBe(275);
    expect(viewport.canvasWidth).toBeGreaterThan(viewport.canvasHeight);
  });

  it("adopts a tall drawing's aspect ratio instead of letterboxing it", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 100, maxY: 400 };
    const viewport = computeViewport(bounds, { maxWidth: 800, maxHeight: 800, margin: 50 });
    expect(viewport.canvasWidth).toBe(275);
    expect(viewport.canvasHeight).toBe(800);
    expect(viewport.canvasHeight).toBeGreaterThan(viewport.canvasWidth);
  });

  it("does not pad the short side of a tall drawing (true aspect ratio)", () => {
    // Tall drawing: the canvas must be narrow, matching the drawing's own
    // proportions, instead of having blank space added on the sides.
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 100, maxY: 4000 };
    const viewport = computeViewport(bounds, { maxWidth: 1000, maxHeight: 1000, margin: 50 });
    expect(viewport.canvasWidth).toBe(123);
    expect(viewport.canvasHeight).toBe(1000);
    expect(viewport.canvasWidth / viewport.canvasHeight).toBeLessThan(0.2);
  });

  it("does not pad the short side of an ultra-wide drawing (true aspect ratio)", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 4000, maxY: 100 };
    const viewport = computeViewport(bounds, { maxWidth: 1000, maxHeight: 1000, margin: 50 });
    expect(viewport.canvasWidth).toBe(1000);
    expect(viewport.canvasHeight).toBe(123);
    expect(viewport.canvasWidth / viewport.canvasHeight).toBeGreaterThan(5);
  });

  it("never exceeds either canvas cap", () => {
    const bounds: Bounds = { minX: 0, minY: 0, maxX: 1200, maxY: 300 };
    const viewport = computeViewport(bounds, { maxWidth: 600, maxHeight: 400, margin: 20 });
    expect(viewport.canvasWidth).toBeLessThanOrEqual(600);
    expect(viewport.canvasHeight).toBeLessThanOrEqual(400);
  });
});

describe("worldToPixel", () => {
  it("inverts the Y axis the way the SVG renderer needs", () => {
    const viewport = computeViewport(SQUARE, { maxWidth: 1000, maxHeight: 1000, margin: 50 });
    const bottomLeft = worldToPixel(0, 0, SQUARE, viewport);
    const topRight = worldToPixel(100, 100, SQUARE, viewport);
    expect(bottomLeft.x).toBeCloseTo(50);
    expect(bottomLeft.y).toBeCloseTo(950);
    expect(topRight.x).toBeCloseTo(950);
    expect(topRight.y).toBeCloseTo(50);
  });

  it("maps the drawing min to the margin on both axes", () => {
    const viewport = computeViewport(SQUARE, { maxWidth: 1000, maxHeight: 1000, margin: 50 });
    const p = worldToPixel(SQUARE.minX, SQUARE.minY, SQUARE, viewport);
    expect(p.x).toBe(50);
    expect(p.y).toBeCloseTo(950);
  });
});