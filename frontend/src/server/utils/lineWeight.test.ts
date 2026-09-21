import { describe, expect, it } from "vitest";
import { mapLineWeightToPixels } from "./lineWeight";

describe("mapLineWeightToPixels", () => {
  it("maps a real lineweight (25 = 0.25 mm) at its visible scale", () => {
    expect(mapLineWeightToPixels(25, 10)).toBeCloseTo(2.5);
  });

  it("floors thin lines to keep them visible", () => {
    expect(mapLineWeightToPixels(1, 0.01)).toBe(1);
  });

  it("clamps to the maximum stroke width", () => {
    expect(mapLineWeightToPixels(1000, 10)).toBe(8);
    expect(mapLineWeightToPixels(100, 10)).toBe(8);
  });

  it("uses the 0.25 mm default for ByLayer/ByBlock/Default references", () => {
    expect(mapLineWeightToPixels(-1, 10)).toBeCloseTo(2.5);
    expect(mapLineWeightToPixels(-2, 10)).toBeCloseTo(2.5);
    expect(mapLineWeightToPixels(-3, 10)).toBeCloseTo(2.5);
  });

  it("treats a non-positive lineweight as the default", () => {
    expect(mapLineWeightToPixels(0, 10)).toBeCloseTo(2.5);
  });

  it("allows a smaller minimum to expose the raw millimeters", () => {
    expect(mapLineWeightToPixels(25, 1, 0)).toBeCloseTo(0.25);
  });
});