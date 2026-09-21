import { describe, expect, it } from "vitest";
import { TAU, arcBounds, arcFromBulge, arcSpan, normalizeAngle } from "./geometry";

describe("normalizeAngle", () => {
  it("keeps [0, 2π) in range", () => {
    expect(normalizeAngle(0)).toBeCloseTo(0);
    expect(normalizeAngle(TAU)).toBeCloseTo(0);
    expect(normalizeAngle(-Math.PI)).toBeCloseTo(Math.PI);
    expect(normalizeAngle(3 * Math.PI)).toBeCloseTo(Math.PI);
  });
});

describe("arcSpan", () => {
  it("normalizes a CCW sweep into (0, 2π]", () => {
    expect(arcSpan(0, Math.PI)).toBeCloseTo(Math.PI);
    expect(arcSpan(Math.PI, 0)).toBeCloseTo(Math.PI);
    expect(arcSpan(0, 0)).toBeCloseTo(TAU);
    expect(arcSpan(Math.PI, Math.PI / 2)).toBeCloseTo(TAU - Math.PI / 2);
  });
});

describe("arcFromBulge", () => {
  it("computes a semicircle for a bulge of 1 (90° included angle = 180° sweep?) ", () => {
    // bulge = tan(θ/4); θ = 180° → bulge = tan(45°) = 1.
    const arc = arcFromBulge({ x: 0, y: 0 }, { x: 2, y: 0 }, 1);
    expect(arc).not.toBeNull();
    if (arc) {
      expect(arc.radius).toBeCloseTo(1);
      expect(arc.center.x).toBeCloseTo(1);
      expect(arc.center.y).toBeCloseTo(0);
      // CCW (bulge > 0) means the apex is above the chord.
      expect(arc.startAngle).toBeCloseTo(Math.PI);
      expect(arc.endAngle).toBeCloseTo(0);
    }
  });

  it("flips the direction for a negative bulge", () => {
    const arc = arcFromBulge({ x: 0, y: 0 }, { x: 2, y: 0 }, -1);
    expect(arc).not.toBeNull();
    if (arc) {
      expect(arc.radius).toBeCloseTo(1);
      expect(arc.center.y).toBeCloseTo(0);
      expect(arc.clockwise).toBe(true);
    }
  });

  it("returns null for coincident endpoints", () => {
    expect(arcFromBulge({ x: 1, y: 1 }, { x: 1, y: 1 }, 0.5)).toBeNull();
  });

  it("returns null for a zero bulge (straight segment)", () => {
    expect(arcFromBulge({ x: 0, y: 0 }, { x: 2, y: 0 }, 0)).toBeNull();
  });
});

describe("arcBounds", () => {
  it("bounds a full circle", () => {
    const box = arcBounds({ x: 100, y: 100 }, 10, 0, Math.PI * 2);
    expect(box.minX).toBeCloseTo(90);
    expect(box.maxX).toBeCloseTo(110);
    expect(box.minY).toBeCloseTo(90);
    expect(box.maxY).toBeCloseTo(110);
  });

  it("bounds a quarter arc starting at 0", () => {
    const box = arcBounds({ x: 0, y: 0 }, 10, 0, Math.PI / 2);
    expect(box.minX).toBeCloseTo(0);
    expect(box.maxX).toBeCloseTo(10);
    expect(box.minY).toBeCloseTo(0);
    expect(box.maxY).toBeCloseTo(10);
  });

  it("detects extremes the arc crosses inside a CCW sweep", () => {
    const box = arcBounds({ x: 0, y: 0 }, 10, Math.PI, 0);
    // Sweep π → 2π (lower semicircle, crossing 270°).
    expect(box.minX).toBeCloseTo(-10);
    expect(box.maxX).toBeCloseTo(10);
    expect(box.minY).toBeCloseTo(-10);
    expect(box.maxY).toBeCloseTo(0);
  });
});