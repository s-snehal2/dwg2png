import { mkdirSync } from "node:fs";
import { join, resolve } from "node:path";

export interface AppConfig {
  maxFileSizeBytes: number;
  maxPngDimension: number;
  marginPx: number;
  /** Oversample factor for anti-aliasing (2 = render at 2x, downscale to fit). */
  pngSupersample: number;
  /** Minimum stroke thickness in pixels, so thin CAD lines stay visible. */
  minStrokePx: number;
  /** Maximum number of paper-space layouts accepted; more layouts = rejection. */
  maxLayouts: number;
  cleanupAgeMs: number;
  tempRootDir: string;
  uploadsDir: string;
  outputsDir: string;
  rateLimitMax: number;
  /** Gemini API key for AI image generation (empty = AI features disabled). */
  geminiApiKey: string;
  /** User-visible static prompt sent to Gemini alongside the DWG PNG. */
  geminiPrompt: string;
  /** Gemini image-generation model id (Nano Banana 2). */
  geminiModel: string;
  /** Max successful AI image generations allowed per converted drawing. */
  aiGenerationLimit: number;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveFloat(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveTempRoot(): string {
  const root = process.env.TEMP_DIR ? resolve(process.env.TEMP_DIR) : join(process.cwd(), "temp");
  return root;
}

/**
 * Default static prompt used to turn the converted DWG PNG into a realistic
 * visualization. Overridable via the GEMINI_PROMPT environment variable.
 */
export const DEFAULT_GEMINI_PROMPT = `Generic Drawing-to-Realistic-Image Prompt
Analyze the uploaded architectural drawing/elevation carefully and automatically identify the space, room type, architectural elements, layout, materials, dimensions, openings, furniture positions, fixtures, wall treatments, flooring, ceiling details, and overall design intent visible in the drawing.Generate a highly realistic, photorealistic visualization of the same design shown in the uploaded drawing.
Strict requirements:

Preserve the original architectural design exactly as shown.
Do not change, redesign, remove, add, or relocate any architectural element.
Maintain the same proportions, geometry, openings, walls, columns, doors, windows, niches, furniture positions, fixtures, patterns, and design details.
Interpret the drawing intelligently and infer the appropriate real-world environment from the visual information itself.
If the drawing represents an interior, generate the corresponding realistic interior.
If it represents an exterior elevation, generate the corresponding realistic exterior/elevation.
If it represents a bathroom, bedroom, living area, kitchen, showroom, commercial space, façade, or any other space, automatically recognize it and visualize it accordingly.
Do not require a manual description of what the drawing represents.
Use realistic materials, textures, lighting, reflections, shadows, depth, and perspective appropriate to the identified space.
Maintain all visible design details from the source drawing.
Convert the 2D architectural representation into a convincing real-world photographic visualization while keeping the design unchanged.
Use premium architectural visualization quality with realistic proportions and physically believable lighting.
The final image should look like a professionally photographed completed project based directly on the uploaded drawing.
Text and Drawing Annotation Rule:

Do not include any text, labels, dimensions, measurements, numbers, annotations, arrows, technical notes, room names, material names, or other written information from the uploaded drawing in the generated image.
Use the information in the drawing to understand the design, but do not reproduce the written information visually.
The final generated image must contain no visible CAD/drawing text or technical annotations.
Keep the actual architectural elements represented by the text or annotations unchanged.
Most important: The uploaded drawing is the source of truth. Prioritize its geometry, layout, proportions, and design over assumptions. Only add realistic rendering qualities needed to visualize the design in the real world.
Do not reinterpret the design. Do not introduce a new design. Do not make creative architectural changes.
Output a high-resolution, photorealistic final visualization of the uploaded drawing, with the architectural design preserved exactly and without any visible text or technical annotations.
ABSOLUTE REQUIREMENT: The final generated image must be completely text-free. No letters, words, numbers, labels, dimensions, annotations, symbols, or written markings of any kind should appear anywhere in the image`;

/**
 * Configuration is read from the environment on every call so that tests can
 * override values (e.g. a throwaway TEMP_DIR) without import-order tricks.
 */
export function getConfig(): AppConfig {
  const tempRootDir = resolveTempRoot();
  const uploadsDir = join(tempRootDir, "uploads");
  const outputsDir = join(tempRootDir, "outputs");
  return {
    maxFileSizeBytes: parsePositiveInt(process.env.MAX_FILE_SIZE_MB, 50) * 1024 * 1024,
    maxPngDimension: parsePositiveInt(process.env.MAX_PNG_DIMENSION, 3000),
    marginPx: parsePositiveInt(process.env.MARGIN_PX, 50),
    pngSupersample: parsePositiveInt(process.env.PNG_SUPERSAMPLE, 2),
    minStrokePx: parsePositiveFloat(process.env.MIN_STROKE_PX, 1),
    maxLayouts: parsePositiveInt(process.env.MAX_LAYOUTS, 1),
    cleanupAgeMs: parsePositiveInt(process.env.CLEANUP_AGE_MINUTES, 1440) * 60 * 1000,
    tempRootDir,
    uploadsDir,
    outputsDir,
    rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_PER_MINUTE, 30),
    geminiApiKey: (process.env.GEMINI_API_KEY ?? "").trim(),
    geminiPrompt: (process.env.GEMINI_PROMPT ?? DEFAULT_GEMINI_PROMPT).trim(),
    geminiModel: (process.env.GEMINI_MODEL ?? "gemini-3.1-flash-image").trim(),
    aiGenerationLimit: parsePositiveInt(process.env.AI_GENERATION_LIMIT, 5),
  };
}

/** Ensures the upload/output temp directories exist. */
export function ensureTempDirs(config: AppConfig): void {
  mkdirSync(config.uploadsDir, { recursive: true });
  mkdirSync(config.outputsDir, { recursive: true });
}