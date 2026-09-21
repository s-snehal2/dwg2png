import { createDwgReader, type DwgReaderPort, type RawDwgData } from "./dwgReader";
import { parseViews, type ConversionStatistics, type ParsedView } from "./dwgParser";
import { renderToSvg, type RenderOptions } from "./renderer";
import { generatePng } from "./pngGenerator";
import { AppError } from "../utils/errors";
import type { AppConfig } from "../config";
import { validateDwgSignature } from "../utils/fileValidation";

/**
 * Views with more normalized entities than this skip the upsample oversample on
 * the full render: a 6000px canvas with tens of thousands of entities (dims,
 * hatches, insert explosions) is disproportionately slow, so huge drawings
 * render at exact size instead.
 */
const HUGE_ENTITY_SUPERSAMPLE_THRESHOLD = 15000;

/** Oversample factor to use for a full render of a view with this many entities. */
export function supersampleForEntities(entityCount: number, configured: number): number {
  return entityCount >= HUGE_ENTITY_SUPERSAMPLE_THRESHOLD ? 1 : configured;
}

export interface ConversionOutput {
  png: Buffer;
  statistics: ConversionStatistics;
  version: string | null;
  totalDurationMs: number;
  parseDurationMs: number;
  renderDurationMs: number;
  /** Display name of the rendered sheet (e.g. "FLOORING LAYOUT"). */
  viewName: string;
  /** True when this output is the raw model space. */
  isModel: boolean;
}

export interface ConversionLogger {
  info?: (message: string) => void;
}

/** A parsed, render-ready view (model space or a paper-space layout). */
export type InspectedView = ParsedView & { version: string | null };

export interface InspectViewsResult {
  version: string | null;
  views: InspectedView[];
  parseDurationMs: number;
}

/**
 * Select the single drawable page for a one-shot conversion. A DWG with more
 * paper-space layouts than `maxLayouts` is rejected with MULTIPLE_LAYOUTS.
 * Otherwise the paper-space sheet wins over the raw model space, matching the
 * classic behavior (sheets at "full page size" over model only).
 */
export function selectViewForConversion(views: InspectedView[], maxLayouts = 1): InspectedView {
  if (views.length === 0) {
    throw new AppError("NO_DRAWABLE_CONTENT", "No drawable content was found in this DWG file.");
  }
  const layouts = views.filter((view) => !view.isModel);
  if (layouts.length > maxLayouts) {
    throw new AppError(
      "MULTIPLE_LAYOUTS",
      `The DWG contains ${layouts.length} layout sheets; a maximum of ${maxLayouts} is supported.`
    );
  }
  const chosen = layouts[0] ?? views.find((view) => view.isModel);
  return views.find((view) => view.viewId === chosen?.viewId) ?? views[0];
}

/** Options for inspection. */
export interface InspectDwgOptions {
  /**
   * When set, a DWG with more than this many paper-space layouts is rejected
   * with MULTIPLE_LAYOUTS before any heavy model normalization happens. Counting
   * layouts is cheap (table entries only), so multi-sheet files fail fast
   * instead of spending minutes exploding a giant model that will be rejected.
   */
  maxLayouts?: number;
}

/**
 * Validate a DWG payload, read it and enumerate every renderable view.
 * Never touches the disk — pure in-memory inspection so the caller can decide
 * what to do with the parse results.
 */
export async function inspectDwg(
  arrayBuffer: ArrayBuffer,
  logger: ConversionLogger = {},
  overrides?: DwgReaderPort,
  options: InspectDwgOptions = {}
): Promise<InspectViewsResult> {
  const parseStart = Date.now();
  const reader = overrides ?? createDwgReader();

  const signature = validateDwgSignature(new Uint8Array(arrayBuffer, 0, 6));
  if (!signature.ok) {
    throw signature.error;
  }
  if (arrayBuffer.byteLength < 8) {
    throw new AppError("INVALID_FILE", "The uploaded file is too short to be a DWG file.");
  }

  let raw: RawDwgData;
  try {
    raw = reader.read(arrayBuffer);
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    logger.info?.(`Parsing failed: ${err instanceof Error ? err.message : String(err)}`);
    throw new AppError("PARSER_ERROR", err instanceof Error ? err.message : String(err));
  }

  if (options.maxLayouts != null) {
    const paperCount = countPaperLayouts(raw);
    if (paperCount > options.maxLayouts) {
      throw new AppError(
        "MULTIPLE_LAYOUTS",
        `The DWG contains ${paperCount} layout sheets; a maximum of ${options.maxLayouts} is supported.`
      );
    }
  }

  let views: ParsedView[];
  try {
    views = parseViews(raw).views;
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError("PARSER_ERROR", err instanceof Error ? err.message : String(err));
  }

  const version = raw.version ?? versionFromHeader(raw);
  return {
    version,
    views: views.map((view) => ({ ...view, version })),
    parseDurationMs: Date.now() - parseStart,
  };
}

/** Number of paper-space layouts in the DWG (cheap: layout table entries only). */
function countPaperLayouts(raw: RawDwgData): number {
  const layouts = raw.document.layouts;
  if (layouts) {
    let count = 0;
    for (const layout of layouts) {
      if (layout.isPaperSpace) {
        count++;
      }
    }
    if (count > 0) {
      return count;
    }
  }
  return raw.document.paperSpace ? 1 : 0;
}

/**
 * Render one already-inspected view to a full-size PNG (supersampled, then
 * downscaled to fit the configured maximum dimension).
 */
export async function renderViewPng(
  view: InspectedView,
  config: AppConfig,
  logger: ConversionLogger = {}
): Promise<ConversionOutput> {
  const started = Date.now();
  const renderStart = Date.now();
  const maxDimension = config.maxPngDimension;
  logger.info?.(
    `Rendering view "${view.name}"${view.isModel ? "" : " (layout)"} at up to ${maxDimension}px.`
  );

  try {
    const options: RenderOptions = {
      colorMode: colorModeFromEnv(),
      maxWidth: maxDimension,
      maxHeight: maxDimension,
      margin: config.marginPx,
      minStrokePx: config.minStrokePx,
      supersample: supersampleForEntities(view.drawing.entities.length, config.pngSupersample),
    };
    const svg = renderToSvg(view.drawing, options);
    const png = await generatePng(svg, {
      maxWidth: maxDimension,
      maxHeight: maxDimension,
    });
    const renderDurationMs = Date.now() - renderStart;
    logger.info?.(`Rendered SVG and generated PNG (${png.byteLength} bytes) in ${renderDurationMs}ms.`);
    return {
      png,
      statistics: view.statistics,
      version: view.version,
      totalDurationMs: Date.now() - started,
      parseDurationMs: 0,
      renderDurationMs,
      viewName: view.name,
      isModel: view.isModel,
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    logger.info?.(`Rendering failed: ${err instanceof Error ? err.message : String(err)}`);
    throw new AppError("RENDER_ERROR", err instanceof Error ? err.message : String(err));
  }
}

/**
 * The one-shot conversion orchestrator: inspect → pick the single sheet →
 * render to PNG. A DWG with more paper-space layouts than `config.maxLayouts`
 * is rejected with MULTIPLE_LAYOUTS, so only one result is ever produced.
 */
export async function convertDwg(
  arrayBuffer: ArrayBuffer,
  config: AppConfig,
  logger: ConversionLogger = {},
  overrides?: DwgReaderPort
): Promise<ConversionOutput> {
  const started = Date.now();
  logger.info?.(`Conversion started (${arrayBuffer.byteLength} bytes received).`);

  const inspected = await inspectDwg(arrayBuffer, logger, overrides, { maxLayouts: config.maxLayouts });
  const view = selectViewForConversion(inspected.views, config.maxLayouts);
  logger.info?.(
    `Parsed DWG${inspected.version ? ` (${inspected.version})` : ""}: ${view.statistics.totalEntities} entities, ${view.statistics.renderedEntities} rendered, ${view.statistics.skippedEntities} skipped.` +
      (view.statistics.page
        ? ` Paper-space page with ${view.statistics.page.entityCount} sheet entities and ${view.statistics.page.viewportCount} viewport(s).`
        : " No paper-space page; falling back to raw model bounds.")
  );

  const output = await renderViewPng(view, config, logger);
  return {
    ...output,
    parseDurationMs: inspected.parseDurationMs,
    totalDurationMs: Date.now() - started,
  };
}

function versionFromHeader(raw: { document: { header?: { version?: unknown } | null } }): string | null {
  const version = raw.document.header?.version;
  return typeof version === "string" ? version : null;
}

function colorModeFromEnv(): RenderOptions["colorMode"] {
  return process.env.COLOR_MODE?.toLowerCase() === "color" ? "color" : "monochrome";
}
