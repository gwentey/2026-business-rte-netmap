import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

const fakeDetail = {
  id: 'fake-id', envName: 'X', label: 'l', fileName: 'f.zip',
  dumpType: 'ENDPOINT' as const,
  sourceComponentEic: null, sourceDumpTimestamp: null,
  uploadedAt: '2026-04-19T00:00:00.000Z',
  effectiveDate: '2026-04-19T00:00:00.000Z',
  hasConfigurationProperties: false,
  warnings: [],
  stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
};

const fakeService = {
  createImport: async () => fakeDetail,
  listImports: async () => [fakeDetail],
  deleteImport: async () => undefined,
};

const zipFile = { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' };
const zipFiles = { file: [zipFile] };
const validZipPadded = { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]), mimetype: 'application/zip' };

describe('ImportsController', () => {
  let ctrl: ImportsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [{ provide: ImportsService, useValue: fakeService }],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('rejects body with missing envName', async () => {
    await expect(
      ctrl.create({ label: 'l' } as any, zipFiles as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects body with missing label', async () => {
    await expect(
      ctrl.create({ envName: 'X' } as any, zipFiles as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects file with wrong MIME type', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l' },
        { file: [{ originalname: 'x.txt', buffer: Buffer.from('hi'), mimetype: 'text/plain' }] } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects file with wrong magic bytes', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l' },
        { file: [{ originalname: 'x.zip', buffer: Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]), mimetype: 'application/zip' }] } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('calls service on valid input', async () => {
    const result = await ctrl.create(
      { envName: 'X', label: 'l' },
      { file: [validZipPadded] } as any,
    );
    expect(result.id).toBe('fake-id');
  });

  it('list returns service result', async () => {
    const result = await ctrl.list();
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('fake-id');
  });

  it('delete calls service', async () => {
    await expect(ctrl.delete('some-id')).resolves.toBeUndefined();
  });

  it('accepts dumpType in body (optional)', async () => {
    const result = await ctrl.create(
      { envName: 'X', label: 'l', dumpType: 'BROKER' },
      zipFiles as any,
    );
    expect(result).toBeTruthy();
  });

  it('rejects invalid dumpType', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l', dumpType: 'INVALID' } as any,
        zipFiles as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ImportsController.create — configurationProperties', () => {
  let ctrl: ImportsController;
  const createSpy = vi.fn(async () => fakeDetail);

  beforeEach(async () => {
    createSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            createImport: createSpy,
            inspectBatch: async () => [],
            listImports: async () => [],
            deleteImport: async () => undefined,
          },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('accepts a .properties file alongside the zip', async () => {
    const props = {
      originalname: '17V000000498771C-configuration.properties',
      buffer: Buffer.from('ecp.projectName = INTERNET-EP2\n'),
      mimetype: 'application/octet-stream',
    };
    await ctrl.create(
      { envName: 'X', label: 'l' },
      { file: [validZipPadded], configurationProperties: [props] } as any,
    );
    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        configurationProperties: expect.objectContaining({
          originalname: '17V000000498771C-configuration.properties',
        }),
      }),
    );
  });

  it('rejects a properties file with the wrong extension', async () => {
    const props = {
      originalname: 'config.txt',
      buffer: Buffer.from('ecp.projectName = X\n'),
      mimetype: 'text/plain',
    };
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l' },
        { file: [validZipPadded], configurationProperties: [props] } as any,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROPERTIES_INVALID_EXT' }),
    });
  });

  it('rejects a properties file that is too large', async () => {
    const props = {
      originalname: 'x-configuration.properties',
      buffer: Buffer.alloc(256 * 1024),
      mimetype: 'application/octet-stream',
    };
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l' },
        { file: [validZipPadded], configurationProperties: [props] } as any,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'PROPERTIES_TOO_LARGE' }),
    });
  });
});

describe('ImportsController.inspect', () => {
  let ctrl: ImportsController;
  const fakeInspectResult = {
    fileName: 'x.zip',
    fileSize: 100,
    fileHash: 'deadbeef'.repeat(8),
    sourceComponentEic: '17V-A',
    sourceDumpTimestamp: '2026-04-17T21:27:17.000Z',
    dumpType: 'ENDPOINT' as const,
    confidence: 'HIGH' as const,
    reason: 'messaging_statistics.csv',
    duplicateOf: null,
    warnings: [],
  };
  const inspectSpy = vi.fn(async () => [fakeInspectResult]);

  beforeEach(async () => {
    inspectSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            inspectBatch: inspectSpy,
            createImport: async () => ({}),
            listImports: async () => [],
            deleteImport: async () => undefined,
          },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('rejects empty file list', async () => {
    await expect(
      ctrl.inspect({}, undefined, []),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects files with wrong MIME', async () => {
    await expect(
      ctrl.inspect({}, undefined, [
        { originalname: 'a.txt', buffer: Buffer.from('hi'), mimetype: 'text/plain' } as any,
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns InspectResult[] for valid files', async () => {
    const result = await ctrl.inspect({ envName: 'OPF' }, 'OPF', [
      { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
    ]);
    expect(result).toHaveLength(1);
    expect(result[0]!.fileName).toBe('x.zip');
    expect(inspectSpy).toHaveBeenCalledWith(expect.any(Array), 'OPF');
  });

  it('accepts multiple files in one call', async () => {
    inspectSpy.mockResolvedValueOnce([
      { ...fakeInspectResult, fileName: 'a.zip' },
      { ...fakeInspectResult, fileName: 'b.zip' },
    ]);
    const result = await ctrl.inspect({}, undefined, [
      { originalname: 'a.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
      { originalname: 'b.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
    ]);
    expect(result).toHaveLength(2);
  });
});

describe('ImportsController.update', () => {
  let ctrl: ImportsController;
  const updateSpy = vi.fn(async () => ({
    id: 'updated-id', envName: 'X', label: 'new-label', fileName: 'f.zip',
    dumpType: 'ENDPOINT' as const,
    sourceComponentEic: null, sourceDumpTimestamp: null,
    uploadedAt: '2026-04-19T00:00:00.000Z',
    effectiveDate: '2030-01-15T10:00:00.000Z',
    hasConfigurationProperties: false,
    warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
  }));

  beforeEach(async () => {
    updateSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            updateImport: updateSpy,
            createImport: async () => ({}),
            inspectBatch: async () => [],
            listImports: async () => [],
            deleteImport: async () => undefined,
          },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('forwards valid body with label only to service', async () => {
    const result = await ctrl.update('abc-id', { label: 'new-label' });
    expect(result.label).toBe('new-label');
    expect(updateSpy).toHaveBeenCalledWith('abc-id', { label: 'new-label' });
  });

  it('forwards valid body with effectiveDate only', async () => {
    await ctrl.update('abc-id', { effectiveDate: '2030-01-15T10:00:00.000Z' });
    expect(updateSpy).toHaveBeenCalledWith('abc-id', { effectiveDate: '2030-01-15T10:00:00.000Z' });
  });

  it('rejects extra fields via zod strict (dumpType)', async () => {
    await expect(
      ctrl.update('abc-id', { dumpType: 'CD' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects extra fields via zod strict (envName)', async () => {
    await expect(
      ctrl.update('abc-id', { envName: 'OTHER' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid effectiveDate format', async () => {
    await expect(
      ctrl.update('abc-id', { effectiveDate: 'not-a-date' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects empty body', async () => {
    await expect(
      ctrl.update('abc-id', {}),
    ).rejects.toThrow(BadRequestException);
  });
});

describe('ImportsController.create — replaceImportId', () => {
  let ctrl: ImportsController;
  const createSpy = vi.fn(async () => ({
    id: 'new-id', envName: 'X', label: 'l', fileName: 'f.zip',
    dumpType: 'ENDPOINT' as const,
    sourceComponentEic: null, sourceDumpTimestamp: null,
    uploadedAt: '2026-04-19T00:00:00.000Z',
    effectiveDate: '2026-04-19T00:00:00.000Z',
    hasConfigurationProperties: false,
    warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
  }));

  beforeEach(async () => {
    createSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [ImportsController],
      providers: [
        {
          provide: ImportsService,
          useValue: {
            createImport: createSpy,
            inspectBatch: async () => [],
            listImports: async () => [],
            deleteImport: async () => undefined,
          },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(ImportsController);
  });

  it('forwards replaceImportId to service when provided', async () => {
    await ctrl.create(
      { envName: 'X', label: 'l', replaceImportId: '11111111-2222-3333-4444-555555555555' },
      zipFiles as any,
    );
    expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
      replaceImportId: '11111111-2222-3333-4444-555555555555',
    }));
  });

  it('rejects an invalid UUID for replaceImportId', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l', replaceImportId: 'not-a-uuid' },
        zipFiles as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
