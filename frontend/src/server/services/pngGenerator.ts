import sharp from "sharp";

/** Optional target output size; the SVG may be supersampled above this. */
export interface PngTarget {
  maxWidth: number;
  maxHeight: number;
}

/**
 * Rasterize a renderer SVG into a PNG buffer. The SVG is emitted at the final
 * pixel dimensions (or, when supersampled, a multiple of them), so the only
 * resize here is the anti-aliasing downsample back to the target size.
 * Supersampling keeps hairlines thin and crisp; no unsharp mask is applied so
 * the output stays true to the source drawing's line weights.
 */
export async function generatePng(svg: string, target?: PngTarget): Promise<Buffer> {
  let pipeline = sharp(Buffer.from(svg)).flatten({ background: "#ffffff" });

  if (target) {
    pipeline = pipeline.resize({
      width: target.maxWidth,
      height: target.maxHeight,
      fit: "inside",
      kernel: sharp.kernel.lanczos3,
      withoutEnlargement: true,
    });
  }

  return pipeline.png({ compressionLevel: 9 }).toBuffer();
}