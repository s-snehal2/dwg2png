# DWG → PNG Converter

A small self-hosted web app that converts DWG drawings to PNG images. The
whole stack is **TypeScript/JavaScript (Next.js + Node.js)** — no Python, no
separate API service. Conversion happens in-process inside the Next.js route,
so nothing is ever sent to a third party.

> **Developer documentation:** in-depth architecture, data models, API
> reference, configuration, and error taxonomy live in
> [`docs/DEVELOPMENT.mdx`](docs/DEVELOPMENT.mdx).

## How it works

The pipeline is deliberately modular so each stage is unit-testable:

```
Browser ─► POST /api/convert ─► reader  (acad-ts:  DWG  → normalized model)
                                    │
                                    ▼
                             parser  (Drawing: entities, exploded inserts)
                                    │
                                    ▼
                             bounds  (fit viewport + margin)
                                    │
                                    ▼
                            renderer (own SVG renderer → clean SVG)
                                    │
                                    ▼
                             sharp   (SVG → white PNG)
                                    │
                                    ▼
                 save output + sidecar → GET /api/download/[id] (one-shot)
```

**Every paper-space layout becomes its own sheet.** One DWG upload renders one
PNG per renderable layout (in tab order) — each with its own conversion id,
preview card, download, and AI-image slot.

**Model space is exported too, split by drawing.** In a multi-layout DWG the
model space holds every layout's geometry parked side by side, so fitting all of
it to one canvas makes each individual drawing unreadable. It is therefore cut
at the widest whitespace gaps into separate crops named `Model`, `Model 2`, and
so on, each fitted to its own bounds — which is what makes each one readable.
The crops follow the layouts in the output.

**One drawing in, one PNG out.** No layout is ever silently dropped. A sheet
that renders almost empty is still exported, and the UI notes it as *sparse*
rather than *skipped*. The only layouts left out are those with no content at
all — no border, no title block, no viewport — since there is nothing to
rasterize.

Rather than relying on acad-ts's own SVG writer, we normalize its parsed model
into a small internal `Drawing` model and render our own SVG. That decouples
the rasterization from the DWG parser and keeps the renderer fully ours.

- **Reader** — `@node-projects/acad-ts` (MIT, pure TypeScript) parses the DWG,
  sitting behind a port so it could be swapped later.
- **Parser** — extracts MVP entities into a normalized model; `INSERT`s are
  expanded via `insert.explode()`. Unsupported entity types are **counted as
  skipped** with a warning; identical warnings are aggregated into one line per
  type (`Unsupported entity "HATCH" was skipped (37 occurrences).`) so large
  drawings don't produce a wall of repeated messages.
- **Renderer** — our own SVG generator (arcs/ellipses/bulges are sampled
  polylines, Y axis flipped, text rotation applied, XML escaped). The output
  **adopts the drawing's own aspect ratio** — within `MAX_PNG_DIMENSION` each
  dimension is capped independently, so a wide or tall drawing keeps its true
  proportions instead of being letterboxed or padded into a different shape.
- **Raster** — [sharp](https://sharp.pixelplumbing.com/) (Apache-2.0, via
  libvips) flattens the SVG onto a white PNG.

### Supported files & entities (MVP)

- DWG versions **R13 (AC1012)** through **AC1032** (AutoCAD 2018 and newer —
  the format has not changed since 2018, so AC1032 also covers AutoCAD 2019
  through 2027).
- **Multi-sheet DWGs.** Every paper-space layout (sheet) in the DWG is exported
  as its own PNG, matching the tabs shown in AutoCAD, followed by the model-space
  crops. A DWG with more layout sheets than `MAX_LAYOUTS` (default 100) is
  rejected with a clear message instead of rendering unbounded sheets. Model
  crops share that same budget: when the layouts leave too few slots, the crops
  are merged together rather than dropped, so no drawing content is ever lost.
- Modelspace entities: **LINE, CIRCLE, ARC, LWPOLYLINE/POLYLINE/2D/3D,
  POINT, ELLIPSE, TEXT, MTEXT**, and **INSERT** (expanded to their block's
  entities, capped to avoid runaway recursion).
- Older pre-R13 DWGs (r1.x–r12) and password-protected files are rejected.
- Other entity types (HATCH, SPLINE, SOLID, dimension objects, …) are skipped
  with a warning rather than failing.

### Known limitations

- MTEXT formatting (`\P` line breaks) is flattened to spaces; alignment and
  per-character formatting beyond the base height aren't applied.
- Text uses the drawing's insertion point/height with a default font; text
  style baselines aren't fully modeled.
- Model space is exported alongside the layouts, split into one crop per
  drawing. Drawings are told apart by whitespace: a gap worth less than
  `MODEL_CLUSTER_GAP_FRACTION` of the overall model size is treated as part of
  the same drawing, so a dense drawing is never shredded into unreadable tiles.
- DWG is a reverse-engineered format; acad-ts does not decode 100% of every
  feature of every version. Most files convert cleanly; a rare one may surface
  as skipped entities or a friendly error — never a hang.

## Configuration

Settings are read from the environment at runtime (see `src/server/config.ts`)
and live in a `.env` file in `frontend/` (Next.js loads it automatically).
Start from the template: `cp frontend/.env.example frontend/.env`.

Every value has a safe default, so you only need to change what matters to you:

| Variable | Default | Meaning |
| --- | --- | --- |
| `TEMP_DIR` | `./temp` | Directory for staged uploads/outputs |
| `MAX_FILE_SIZE_MB` | `50` | Maximum upload size |
| `MAX_LAYOUTS` | `100` | Maximum sheets converted per DWG; exceeding it on the layout count rejects the file, and model crops are merged down to whatever budget the layouts leave |
| `MODEL_CLUSTER_GAP_FRACTION` | `0.03` | Whitespace, as a fraction of the overall model size, that counts as a gap *between* drawings. Lower it to split more eagerly, raise it to keep drawings together |
| `MODEL_CLUSTER_MAX_DEPTH` | `12` | Recursion ceiling for model clustering; caps worst-case crop count at 2^depth |
| `MAX_PNG_DIMENSION` | `3000` | Max output width/height in px |
| `MARGIN_PX` | `50` | Padding around the drawing, in px |
| `CLEANUP_AGE_MINUTES` | `1440` | Age after which temp files are swept |
| `RATE_LIMIT_PER_MINUTE` | `30` | Per-IP convert requests/minute |
| `COLOR_MODE` | *(unset)* | Set to `color` for colored (layer-based) output; default is monochrome |
| `GEMINI_API_KEY` | *(empty)* | Google AI API key; when set, enables AI image generation via Gemini 3.1 Flash (Nano Banana 2) |
| `GEMINI_MODEL` | `gemini-3.1-flash-image` | Gemini model id used for AI image generation |
| `GEMINI_PROMPT` | *(built-in)* | Static prompt sent to Gemini for architectural visualization; see `src/server/config.ts` for the default |
| `MAX_AI_PROMPT_CHARS` | `1000` | Max length of the user-supplied AI image prompt |

> Note: `GEMINI_PROMPT` is optional. Leaving it empty uses the built-in
> architectural-visualization prompt, so you never need to paste the full text
> in. When the user types their own prompt in the UI, it is appended to this
> base prompt so the drawing stays the source of truth while the user steers
> style, lighting, and materials.

**Where the env file goes:** edit `frontend/.env` (Next.js auto-loads it from
the `frontend/` directory).

Start from the template: `cp frontend/.env.example frontend/.env`

Output files are download-safe: `/api/download/[id]` serves the PNG multiple
times (no deletion on download) and temp files are swept after
`CLEANUP_AGE_MINUTES` (default 24 hours).

## Run it

You only need Node.js (18+, LTS recommended) installed. The whole app runs in
one Next.js process.

```bash
# 1. Create your local env file (edit it, e.g. add GEMINI_API_KEY)
cp frontend/.env.example frontend/.env

# 2. Install dependencies
cd frontend
npm install

# 3. Run it
npm run dev              # development server with hot reload
# or for production:
# npm run build && npm start
```

Then open `http://localhost:3000`.

Temporary uploads/outputs go to `frontend/temp/` by default (`TEMP_DIR=./temp`),
and the same API endpoints are used (`/api/convert`, `/api/generate/[id]`,
`/api/download/[id]`, `/api/download-ai/[id]`).

## Test

```bash
cd frontend
npm test             # vitest: unit + integration
```

The integration test builds a real DWG (`DXF → acad-ts DwgWriter`) and asserts
the PNG magic bytes and dimensions.

## Project structure

```
dwg2png/
├── .gitignore
├── README.md
└── frontend/
    ├── .env.example              # template (copy + edit)
    ├── next.config.ts            # serverExternalPackages for sharp + acad-ts
    ├── vitest.config.mts         # vitest config (node env, @ alias)
    └── src/
        ├── app/
        │   ├── page.tsx                     # the conversion screen
        │   ├── api/convert/route.ts         # POST: DWG → PNG + conversionId
        │   ├── api/generate/[id]/route.ts   # POST: DWG PNG → AI photorealistic image (Gemini)
        │   ├── api/download/[id]/route.ts   # GET: one-shot PNG download
        │   └── api/download-ai/[id]/route.ts # GET: Gemini AI image download
        ├── components/                      # DwgUploader / ConversionProgress /
        │                                    #   ConversionResult / ImagePreviewCard /
        │                                    #   ImageLightbox / ErrorMessage
        ├── services/api.ts, types/conversion.ts
        └── server/
            ├── config.ts
            ├── services/        # dwgReader (acad-ts port), dwgParser,
            │                    #   entityExtractor, boundsCalculator,
            │                    #   coordinateMapper, renderer, pngGenerator,
            │                    #   convertDwg (orchestrator), fileCleanup,
            │                    #   geminiImage (AI image generation, Gemini)
            ├── models/          # normalized Drawing / Entity / Bounds /
            │                    #   Layer / Block
            └── utils/           # geometry, errors, fileValidation, lineWeight,
                                 #   rateLimit, storage
```# dwg-to-png-converter
