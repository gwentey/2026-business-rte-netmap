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

  describe('whitelist cleanup (P3-7)', () => {
    it('does not load message_type.csv even if present in the zip', () => {
      const zip = new AdmZip();
      zip.addFile('application_property.csv', Buffer.from('key;value\n'));
      zip.addFile('component_directory.csv', Buffer.from('component_directory_id;name;country;componentType;componentCode;environmentName;organization;ecp.domain;ecp.componentCode;mades.id;mades.endpointUrl;mades.endpointVersion;mades.implementation;mades.implementationVersion;directoryContent\nid1;n;FR;ENDPOINT;c;E;RTE;d;ECP;mid;mUrl;mV;mI;mIV;<xml/>\n'));
      zip.addFile('message_type.csv', Buffer.from('col1;col2\nA;B\n'));
      zip.addFile('message_upload_route.csv', Buffer.from('col1;col2\nA;B\n'));
      const buffer = zip.toBuffer();

      const result = service.extract(buffer);
      expect(result.files.has('message_type.csv')).toBe(false);
      expect(result.files.has('message_upload_route.csv')).toBe(false);
    });
  });
});

describe('ZipExtractorService.listEntries', () => {
  it('returns entry names without extracting content', async () => {
    const AdmZipLib = (await import('adm-zip')).default;
    const z = new AdmZipLib();
    z.addFile('application_property.csv', Buffer.from('a,b\n1,2\n'));
    z.addFile('component_directory.csv', Buffer.from('x,y\n'));
    z.addFile('README.txt', Buffer.from('hello'));
    const buf = z.toBuffer();

    const service = new ZipExtractorService();
    const entries = service.listEntries(buf);

    expect(entries).toHaveLength(3);
    const names = entries.map((e) => e.entryName).sort();
    expect(names).toEqual(['README.txt', 'application_property.csv', 'component_directory.csv']);
  });

  it('returns empty array for an empty ZIP', async () => {
    const AdmZipLib = (await import('adm-zip')).default;
    const z = new AdmZipLib();
    const buf = z.toBuffer();

    const service = new ZipExtractorService();
    expect(service.listEntries(buf)).toEqual([]);
  });

  it('throws on an invalid buffer (not a ZIP)', () => {
    const service = new ZipExtractorService();
    expect(() => service.listEntries(Buffer.from('not a zip file'))).toThrow();
  });
});
