import { clamp } from "./geometry";

/** DWG stores lineweights in 1/100 mm; negative values are special references. */
export const LINE_WEIGHT_BY_LAYER = -1;
export const LINE_WEIGHT_BY_BLOCK = -2;
export const LINE_WEIGHT_DEFAULT = -3;

/** Default effective lineweight (0.25 mm) used for ByLayer/ByBlock/Default. */
const DEFAULT_LINEWEIGHT_MM = 0.25;

/**
 * Convert a raw DWG lineweight (1/100 mm) to a pixel width at the given
 * world-to-pixel scale, clamped to keep thin CAD lines visible.
 */
export function mapLineWeightToPixels(
  lineWeightValue: number,
  scale: number,
  minStrokePx = 1,
  maxStrokePx = 8
): number {
  const millimeters = validLineWeightMillimeters(lineWeightValue);
  const px = millimeters * scale;
  if (!Number.isFinite(px) || px <= 0) {
    return minStrokePx;
  }
  return clamp(px, minStrokePx, maxStrokePx);
}

function validLineWeightMillimeters(value: number): number {
  if (value < 0) {
    return DEFAULT_LINEWEIGHT_MM;
  }
  const millimeters = value / 100;
  return millimeters > 0 ? millimeters : DEFAULT_LINEWEIGHT_MM;
}