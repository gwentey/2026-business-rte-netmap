import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

const fakeDetail = {
  id: 'fake-id', envName: 'X', label: 'l', fileName: 'f.zip',
  dumpType: 'ENDPOINT' as const,
  sourceComponentEic: null, sourceDumpTimestamp: null,
  uploadedAt: '2026-04-19T00:00:00.000Z',
  effectiveDate: '2026-04-19T00:00:00.000Z',
  warnings: [],
  stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
};

const fakeService = {
  createImport: async () => fakeDetail,
  listImports: async () => [fakeDetail],
  deleteImport: async () => undefined,
};

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
      ctrl.create(
        { label: 'l' } as any,
        { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects body with missing label', async () => {
    await expect(
      ctrl.create(
        { envName: 'X' } as any,
        { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects file with wrong MIME type', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l' },
        { originalname: 'x.txt', buffer: Buffer.from('hi'), mimetype: 'text/plain' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects file with wrong magic bytes', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l' },
        { originalname: 'x.zip', buffer: Buffer.from([0xDE, 0xAD, 0xBE, 0xEF]), mimetype: 'application/zip' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('calls service on valid input', async () => {
    const result = await ctrl.create(
      { envName: 'X', label: 'l' },
      { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]), mimetype: 'application/zip' } as any,
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
      { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
    );
    expect(result).toBeTruthy();
  });

  it('rejects invalid dumpType', async () => {
    await expect(
      ctrl.create(
        { envName: 'X', label: 'l', dumpType: 'INVALID' } as any,
        { originalname: 'x.zip', buffer: Buffer.from([0x50, 0x4b, 0x03, 0x04]), mimetype: 'application/zip' } as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
