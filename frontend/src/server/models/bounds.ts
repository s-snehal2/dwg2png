export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsWidth(bounds: Bounds): number {
  return bounds.maxX - bounds.minX;
}

export function boundsHeight(bounds: Bounds): number {
  return bounds.maxY - bounds.minY;
}

export function boundsAreValid(bounds: Bounds): boolean {
  return (
    Number.isFinite(bounds.minX) &&
    Number.isFinite(bounds.minY) &&
    Number.isFinite(bounds.maxX) &&
    Number.isFinite(bounds.maxY) &&
    bounds.maxX >= bounds.minX &&
    bounds.maxY >= bounds.minY
  );
}