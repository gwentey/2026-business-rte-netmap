import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from './app-store.js';
import { api } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  api: {
    listEnvs: vi.fn(),
    listImports: vi.fn(),
    getGraph: vi.fn(),
  },
}));

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: null,
      envs: [],
      imports: [],
      graph: null,
      selectedNodeEic: null,
      selectedEdgeId: null,
      loading: false,
      error: null,
    });
    vi.mocked(api.listEnvs).mockReset();
    vi.mocked(api.listImports).mockReset();
    vi.mocked(api.getGraph).mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loadEnvs sets envs and activates first env when none persisted', async () => {
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF', 'PROD']);
    vi.mocked(api.listImports).mockResolvedValue([]);
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [],
      edges: [],
      bounds: { north: 60, south: 40, east: 20, west: -10 },
      mapConfig: {} as any,
    });

    await useAppStore.getState().loadEnvs();

    expect(useAppStore.getState().envs).toEqual(['OPF', 'PROD']);
    expect(useAppStore.getState().activeEnv).toBe('OPF');
  });

  it('loadEnvs preserves persisted activeEnv if still valid', async () => {
    useAppStore.setState({ activeEnv: 'PROD' });
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF', 'PROD']);
    vi.mocked(api.listImports).mockResolvedValue([]);
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [],
      edges: [],
      bounds: { north: 60, south: 40, east: 20, west: -10 },
      mapConfig: {} as any,
    });

    await useAppStore.getState().loadEnvs();

    expect(useAppStore.getState().activeEnv).toBe('PROD');
  });

  it('loadEnvs resets activeEnv if persisted value no longer exists', async () => {
    useAppStore.setState({ activeEnv: 'DELETED_ENV' });
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF']);
    vi.mocked(api.listImports).mockResolvedValue([]);
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [],
      edges: [],
      bounds: { north: 60, south: 40, east: 20, west: -10 },
      mapConfig: {} as any,
    });

    await useAppStore.getState().loadEnvs();

    expect(useAppStore.getState().activeEnv).toBe('OPF');
  });

  it('loadEnvs with empty list clears activeEnv and graph', async () => {
    useAppStore.setState({ activeEnv: 'OPF', graph: {} as any });
    vi.mocked(api.listEnvs).mockResolvedValue([]);

    await useAppStore.getState().loadEnvs();

    expect(useAppStore.getState().activeEnv).toBeNull();
    expect(useAppStore.getState().graph).toBeNull();
  });

  it('selectNode clears selectedEdgeId', () => {
    useAppStore.setState({ selectedEdgeId: 'edge-1' });
    useAppStore.getState().selectNode('EIC-X');
    expect(useAppStore.getState().selectedNodeEic).toBe('EIC-X');
    expect(useAppStore.getState().selectedEdgeId).toBeNull();
  });
});
