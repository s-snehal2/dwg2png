import { DwgReader } from "@node-projects/acad-ts";
import type { CadDocument } from "@node-projects/acad-ts";

/**
 * The DWG engine abstraction. The rest of the application only depends on
 * `RawDwgData`, never on a concrete reader. Replacing acad-ts with another
 * engine later means implementing this single interface.
 */
export interface RawDwgData {
  /** DWG version string, e.g. "AC1032", when the header could be read. */
  version: string | null;
  document: CadDocument;
}

export interface DwgReaderPort {
  read(arrayBuffer: ArrayBuffer): RawDwgData;
}

export class AcadDwgReader implements DwgReaderPort {
  read(arrayBuffer: ArrayBuffer): RawDwgData {
    return {
      document: DwgReader.readFromStream(arrayBuffer),
      version: null,
    };
  }
}

export function createDwgReader(): DwgReaderPort {
  return new AcadDwgReader();
}