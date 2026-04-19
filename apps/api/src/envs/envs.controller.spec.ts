import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { EnvsController } from './envs.controller.js';
import { EnvsService } from './envs.service.js';

describe('EnvsController', () => {
  let ctrl: EnvsController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EnvsController],
      providers: [{ provide: EnvsService, useValue: { listEnvs: async () => ['OPF', 'PROD', 'PFRFI'] } }],
    }).compile();
    ctrl = moduleRef.get(EnvsController);
  });

  it('returns distinct env names from service', async () => {
    const result = await ctrl.list();
    expect(result).toEqual(['OPF', 'PROD', 'PFRFI']);
  });

  it('returns empty array when no envs', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [EnvsController],
      providers: [{ provide: EnvsService, useValue: { listEnvs: async () => [] } }],
    }).compile();
    const localCtrl = moduleRef.get(EnvsController);
    const result = await localCtrl.list();
    expect(result).toEqual([]);
  });
});
