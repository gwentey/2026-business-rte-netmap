import { describe, it, expect } from 'vitest';
import AdmZip from 'adm-zip';
import { ZipExtractorService } from './zip-extractor.service.js';
import {
  InvalidUploadException,
  MissingRequiredCsvException,
  PayloadTooLargeException,
} from '../common/errors/ingestion-errors.js';

function makeZip(entries: Record<string, string | Buffer>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}

describe('ZipExtractorService', () => {
  const service = new ZipExtractorService();

  it('extracts whitelisted files and skips others', () => {
    const buffer = makeZip({
      'application_property.csv': 'key;value\nfoo;bar',
      'component_directory.csv': 'directoryContent\nx',
      'random_file.txt': 'ignored',
    });
    const result = service.extract(buffer);
    expect(result.files.has('application_property.csv')).toBe(true);
    expect(result.files.has('component_directory.csv')).toBe(true);
    expect(result.files.has('random_file.txt')).toBe(false);
  });

  it('excludes sensitive files from the in-memory map', () => {
    const buffer = makeZip({
      'application_property.csv': 'key;value',
      'component_directory.csv': 'directoryContent\nx',
      'local_key_store.csv': 'secret',
      'registration_store.csv': 'secret',
      'registration_requests.csv': 'secret',
    });
    const result = service.extract(buffer);
    expect(result.files.has('local_key_store.csv')).toBe(false);
    expect(result.files.has('registration_store.csv')).toBe(false);
    expect(result.files.has('registration_requests.csv')).toBe(false);
  });

  it('throws MissingRequiredCsvException if application_property.csv is absent', () => {
    const buffer = makeZip({ 'component_directory.csv': 'x' });
    expect(() => service.extract(buffer)).toThrowError(MissingRequiredCsvException);
  });

  it('throws MissingRequiredCsvException if component_directory.csv is absent', () => {
    const buffer = makeZip({ 'application_property.csv': 'x' });
    expect(() => service.extract(buffer)).toThrowError(MissingRequiredCsvException);
  });

  it('throws InvalidUploadException if the zip is corrupted', () => {
    const garbage = Buffer.from('not a zip file');
    expect(() => service.extract(garbage)).toThrowError(InvalidUploadException);
  });

  it('rejects entries larger than 50MB', () => {
    const huge = Buffer.alloc(51 * 1024 * 1024, 'a');
    const buffer = makeZip({
      'application_property.csv': 'x',
      'component_directory.csv': 'x',
      'message_path.csv': huge,
    });
    expect(() => service.extract(buffer)).toThrowError(PayloadTooLargeException);
  });
});
