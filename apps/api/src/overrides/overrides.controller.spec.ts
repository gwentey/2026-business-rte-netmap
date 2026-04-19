import { Test } from '@nestjs/testing';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { OverridesController } from './overrides.controller.js';
import { OverridesService } from './overrides.service.js';

const fakeRow = {
  eic: 'X', displayName: 'x', type: null, organization: null, country: null,
  lat: null, lng: null, tagsCsv: null, notes: null, updatedAt: new Date(),
};

describe('OverridesController', () => {
  let ctrl: OverridesController;
  const upsertSpy = vi.fn(async () => fakeRow);
  const deleteSpy = vi.fn(async () => undefined);
  const listSpy = vi.fn(async () => []);

  beforeEach(async () => {
    upsertSpy.mockClear();
    deleteSpy.mockClear();
    listSpy.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [OverridesController],
      providers: [
        {
          provide: OverridesService,
          useValue: { upsert: upsertSpy, delete: deleteSpy, listAdminComponents: listSpy },
        },
      ],
    }).compile();
    ctrl = moduleRef.get(OverridesController);
  });

  it('GET /admin/components delegates to listAdminComponents', async () => {
    await ctrl.listAdminComponents();
    expect(listSpy).toHaveBeenCalled();
  });

  it('PUT /overrides/:eic with valid body forwards to upsert', async () => {
    await ctrl.upsert('10XAT-APG------Z', { displayName: 'APG', lat: 48.2, lng: 16.4 });
    expect(upsertSpy).toHaveBeenCalledWith('10XAT-APG------Z', { displayName: 'APG', lat: 48.2, lng: 16.4 });
  });

  it('rejects invalid country length (not ISO-2)', async () => {
    await expect(
      ctrl.upsert('X', { country: 'FRA' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects lat out of range', async () => {
    await expect(
      ctrl.upsert('X', { lat: 99 } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects unknown extra fields', async () => {
    await expect(
      ctrl.upsert('X', { foo: 'bar' } as any),
    ).rejects.toThrow(BadRequestException);
  });

  it('DELETE /overrides/:eic delegates to delete', async () => {
    await ctrl.delete('X');
    expect(deleteSpy).toHaveBeenCalledWith('X');
  });
});
