import type { Bounds } from "./bounds";
import type { Block } from "./block";
import type { Entity } from "./entity";
import type { Layer } from "./layer";
import type { Page } from "./page";

/**
 * The normalized, renderer-friendly representation of a DWG drawing.
 * Nothing in here references DWG binary structures or the acad-ts object graph.
 *
 * When the DWG has a paper-space page (a layout), `page` carries the sheet
 * entities and the viewport windows that frame the drawing; the output PNG is
 * then page-proportioned instead of the raw (often ultra-wide) model bounds.
 */
export interface Drawing {
  bounds: Bounds;
  entities: Entity[];
  layers: Layer[];
  blocks: Block[];
  page?: Page;
}