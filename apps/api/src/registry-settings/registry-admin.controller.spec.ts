import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { RegistryAdminController } from './registry-admin.controller.js';
import { RegistrySettingsService } from './registry-settings.service.js';

describe('RegistryAdminController', () => {
  let ctrl: RegistryAdminController;
  const settingsMock = {
    listProcessColors: vi.fn(async () => [
      { process: 'TP', color: '#111111', isOverride: false, default: '#111111' },
    ]),
    upsertProcessColor: vi.fn(async () => undefined),
    resetProcessColor: vi.fn(async () => undefined),
    listRteEndpoints: vi.fn(async () => [
      { eic: '17V-A', code: 'A', displayName: 'A', city: 'Paris', lat: 48.8, lng: 2.3, hasOverride: false },
    ]),
  };

  beforeEach(async () => {
    Object.values(settingsMock).forEach((fn) => fn.mockClear());
    const moduleRef = await Test.createTestingModule({
      controllers: [RegistryAdminController],
      providers: [
        { provide: RegistrySettingsService, useValue: settingsMock },
      ],
    }).compile();
    ctrl = moduleRef.get(RegistryAdminController);
  });

  it('GET registry/process-colors delegates to listProcessColors', async () => {
    const result = await ctrl.listColors();
    expect(result).toEqual([
      { process: 'TP', color: '#111111', isOverride: false, default: '#111111' },
    ]);
    expect(settingsMock.listProcessColors).toHaveBeenCalled();
  });

  it('PUT registry/process-colors/:process delegates to upsertProcessColor', async () => {
    const result = await ctrl.upsertColor('TP', { color: '#abcdef' });
    expect(result).toEqual({ ok: true });
    expect(settingsMock.upsertProcessColor).toHaveBeenCalledWith('TP', '#abcdef');
  });

  it('PUT registry/process-colors/:process rejects body missing color', async () => {
    await expect(ctrl.upsertColor('TP', {})).rejects.toThrow(BadRequestException);
    expect(settingsMock.upsertProcessColor).not.toHaveBeenCalled();
  });

  it('PUT registry/process-colors/:process rejects body with extra unknown keys', async () => {
    await expect(ctrl.upsertColor('TP', { color: '#abcdef', foo: 1 })).rejects.toThrow(
      BadRequestException,
    );
    expect(settingsMock.upsertProcessColor).not.toHaveBeenCalled();
  });

  it('DELETE registry/process-colors/:process delegates to resetProcessColor', async () => {
    await ctrl.deleteColor('TP');
    expect(settingsMock.resetProcessColor).toHaveBeenCalledWith('TP');
  });

  it('GET registry/rte-endpoints delegates to listRteEndpoints', async () => {
    const result = await ctrl.listEndpoints();
    expect(result).toEqual([
      { eic: '17V-A', code: 'A', displayName: 'A', city: 'Paris', lat: 48.8, lng: 2.3, hasOverride: false },
    ]);
    expect(settingsMock.listRteEndpoints).toHaveBeenCalled();
  });
});
