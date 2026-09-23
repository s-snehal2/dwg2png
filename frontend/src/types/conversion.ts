export interface ConversionStatistics {
  totalEntities: number;
  renderedEntities: number;
  skippedEntities: number;
  warnings: string[];
}

export interface ConversionResult {
  success: boolean;
  conversionId: string;
  originalFileName: string;
  /** The human-friendly output filename (e.g. "drawing.png"). */
  fileName: string;
  /** PNG size in bytes. */
  size: number;
  version: string | null;
  statistics: ConversionStatistics;
  warnings: string[];
  durationMs?: number;
}

export interface ConversionError {
  success: false;
  error: string;
}

export interface AiImageResult {
  success: boolean;
  conversionId: string;
  fileName: string;
  size: number;
  durationMs: number;
  /** AI generations used for this conversion after this request. */
  generationsUsed: number;
  /** Maximum AI generations allowed per conversion. */
  generationsLimit: number;
}

export interface TilesviewResult {
  success: boolean;
  conversionId: string;
  customRoomsId: number;
}
