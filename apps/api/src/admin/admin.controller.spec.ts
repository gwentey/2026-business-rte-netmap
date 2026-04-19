import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { DangerService } from './danger.service.js';
import { EntsoeService } from './entsoe.service.js';

describe('AdminController', () => {
  let ctrl: AdminController;
  const dangerMock = {
    purgeImports: vi.fn(async () => ({ deletedCount: 5 })),
    purgeOverrides: vi.fn(async () => ({ deletedCount: 3 })),
    purgeAll: vi.fn(async () => ({ imports: 5, overrides: 3, entsoe: 100 })),
  };
  const entsoeMock = {
    upload: vi.fn(async () => ({ count: 42, refreshedAt: '2026-04-20T10:00:00.000Z' })),
    status: vi.fn(async () => ({ count: 42, refreshedAt: '2026-04-20T10:00:00.000Z' })),
  };

  beforeEach(async () => {
    Object.values(dangerMock).forEach((fn) => fn.mockClear());
    Object.values(entsoeMock).forEach((fn) => fn.mockClear());
    const moduleRef = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: DangerService, useValue: dangerMock },
        { provide: EntsoeService, useValue: entsoeMock },
      ],
    }).compile();
    ctrl = moduleRef.get(AdminController);
  });

  it('DELETE purge-imports delegates to DangerService', async () => {
    const result = await ctrl.purgeImports();
    expect(result).toEqual({ deletedCount: 5 });
    expect(dangerMock.purgeImports).toHaveBeenCalled();
  });

  it('DELETE purge-overrides delegates', async () => {
    const result = await ctrl.purgeOverrides();
    expect(result).toEqual({ deletedCount: 3 });
  });

  it('DELETE purge-all delegates', async () => {
    const result = await ctrl.purgeAll();
    expect(result).toEqual({ imports: 5, overrides: 3, entsoe: 100 });
  });

  it('POST entsoe/upload rejects missing file', async () => {
    await expect(ctrl.entsoeUpload(undefined as any)).rejects.toThrow(BadRequestException);
  });

  it('POST entsoe/upload delegates to EntsoeService', async () => {
    const result = await ctrl.entsoeUpload({
      originalname: 'eic.csv', buffer: Buffer.from('x'), mimetype: 'text/csv',
    } as any);
    expect(result.count).toBe(42);
    expect(entsoeMock.upload).toHaveBeenCalled();
  });

  it('GET entsoe/status delegates', async () => {
    const result = await ctrl.entsoeStatus();
    expect(result.count).toBe(42);
  });
});
