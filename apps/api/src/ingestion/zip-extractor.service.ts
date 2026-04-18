import { Injectable } from '@nestjs/common';
import AdmZip from 'adm-zip';
import {
  InvalidUploadException,
  MissingRequiredCsvException,
  PayloadTooLargeException,
} from '../common/errors/ingestion-errors.js';
import {
  IGNORED_CSV_FILES,
  REQUIRED_CSV_FILES,
  SENSITIVE_CSV_FILES,
  USABLE_CSV_FILES,
  type ExtractedZip,
} from './types.js';

const MAX_ENTRY_SIZE = 50 * 1024 * 1024;
const LOADABLE_FILES = new Set<string>([
  ...USABLE_CSV_FILES,
  ...IGNORED_CSV_FILES,
]);
const SENSITIVE = new Set<string>(SENSITIVE_CSV_FILES);

@Injectable()
export class ZipExtractorService {
  extract(buffer: Buffer): ExtractedZip {
    let zip: AdmZip;
    try {
      zip = new AdmZip(buffer);
      if (
        zip.getEntries().length === 0 &&
        !buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
      ) {
        throw new Error('Invalid zip signature');
      }
    } catch (err) {
      throw new InvalidUploadException('Le fichier zip est corrompu ou illisible', {
        cause: (err as Error).message,
      });
    }

    const files = new Map<string, Buffer>();
    for (const entry of zip.getEntries()) {
      if (entry.isDirectory) continue;
      const name = entry.entryName.split('/').pop() ?? entry.entryName;
      if (SENSITIVE.has(name)) continue;
      if (!LOADABLE_FILES.has(name)) continue;

      const data = entry.getData();
      if (data.length > MAX_ENTRY_SIZE) {
        throw new PayloadTooLargeException(data.length);
      }
      files.set(name, data);
    }

    for (const required of REQUIRED_CSV_FILES) {
      if (!files.has(required)) {
        throw new MissingRequiredCsvException(required);
      }
    }

    return { files };
  }
}
