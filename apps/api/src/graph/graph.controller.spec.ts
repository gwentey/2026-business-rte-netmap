import { Test } from '@nestjs/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GraphController } from './graph.controller.js';
import { GraphService } from './graph.service.js';

describe('GraphController', () => {
  let ctrl: GraphController;
  const fakeGraph = {
    nodes: [],
    edges: [],
    bounds: { north: 60, south: 40, east: 20, west: -10 },
    mapConfig: {} as any,
  };
  const getGraphMock = vi.fn(async () => fakeGraph);

  beforeEach(async () => {
    getGraphMock.mockClear();
    const moduleRef = await Test.createTestingModule({
      controllers: [GraphController],
      providers: [{ provide: GraphService, useValue: { getGraph: getGraphMock } }],
    }).compile();
    ctrl = moduleRef.get(GraphController);
  });

  it('rejects missing env', async () => {
    await expect(ctrl.getGraph('' as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects whitespace-only env', async () => {
    await expect(ctrl.getGraph('   ' as any)).rejects.toThrow(BadRequestException);
  });

  it('rejects invalid refDate', async () => {
    await expect(ctrl.getGraph('OPF', 'not-a-date')).rejects.toThrow(BadRequestException);
  });

  it('returns graph on valid env without refDate', async () => {
    const g = await ctrl.getGraph('OPF');
    expect(g.nodes).toEqual([]);
    expect(getGraphMock).toHaveBeenCalledWith('OPF', undefined);
  });

  it('parses refDate and forwards it to service', async () => {
    const iso = '2026-04-19T12:00:00.000Z';
    const g = await ctrl.getGraph('OPF', iso);
    expect(g).toBeTruthy();
    const calls = getGraphMock.mock.calls as unknown as Array<[string, Date | undefined]>;
    const call = calls[0]!;
    expect(call[0]).toBe('OPF');
    expect(call[1]!.toISOString()).toBe(iso);
  });
});
