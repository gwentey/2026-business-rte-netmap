import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/api', () => ({
  api: {
    listSnapshots: vi.fn(),
    getGraph: vi.fn(),
    createSnapshot: vi.fn(),
  },
}));

import { api } from '../lib/api';

// Import fresh store per test to avoid state leak via the Zustand singleton
async function freshStore() {
  vi.resetModules();
  const mod = await import('./app-store');
  return mod.useAppStore;
}

describe('app-store — loadSnapshots bascule activeSnapshotId invalide', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('switches to list[0] when persisted activeSnapshotId is not in the fresh list', async () => {
    localStorage.setItem(
      'carto-ecp-store',
      JSON.stringify({ state: { activeSnapshotId: 'stale-id-deleted' }, version: 0 }),
    );
    vi.mocked(api.listSnapshots).mockResolvedValueOnce([
      {
        id: 'fresh-id-1',
        label: 'Fresh 1',
        envName: 'OPF',
        componentType: 'ENDPOINT',
        sourceComponentCode: 'S',
        cdCode: 'C',
        uploadedAt: '2026-04-18T12:00:00Z',
        warningCount: 0,
      },
    ]);
    vi.mocked(api.getGraph).mockResolvedValueOnce({
      nodes: [],
      edges: [],
      bounds: { north: 0, south: 0, east: 0, west: 0 },
      mapConfig: { rteClusterLat: 48.8918, rteClusterLng: 2.2378, rteClusterOffsetDeg: 0.6, rteClusterProximityDeg: 0.01 },
    });

    const useStore = await freshStore();
    await useStore.getState().loadSnapshots();

    expect(useStore.getState().activeSnapshotId).toBe('fresh-id-1');
    expect(api.getGraph).toHaveBeenCalledWith('fresh-id-1');
  });

  it('keeps persisted id and loads its graph when it IS in the list', async () => {
    localStorage.setItem(
      'carto-ecp-store',
      JSON.stringify({ state: { activeSnapshotId: 'valid-id' }, version: 0 }),
    );
    vi.mocked(api.listSnapshots).mockResolvedValueOnce([
      {
        id: 'valid-id',
        label: 'Valid',
        envName: 'OPF',
        componentType: 'ENDPOINT',
        sourceComponentCode: 'S',
        cdCode: 'C',
        uploadedAt: '2026-04-18T12:00:00Z',
        warningCount: 0,
      },
    ]);
    vi.mocked(api.getGraph).mockResolvedValueOnce({
      nodes: [],
      edges: [],
      bounds: { north: 0, south: 0, east: 0, west: 0 },
      mapConfig: { rteClusterLat: 48.8918, rteClusterLng: 2.2378, rteClusterOffsetDeg: 0.6, rteClusterProximityDeg: 0.01 },
    });

    const useStore = await freshStore();
    await useStore.getState().loadSnapshots();

    expect(useStore.getState().activeSnapshotId).toBe('valid-id');
    expect(api.getGraph).toHaveBeenCalledWith('valid-id');
  });
});
