import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from './app-store.js';
import { api } from '../lib/api.js';

vi.mock('../lib/api.js', () => ({
  api: {
    listEnvs: vi.fn(),
    listImports: vi.fn(),
    getGraph: vi.fn(),
    inspectBatch: vi.fn(),
    createImport: vi.fn(),
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
      uploadBatch: [],
      uploadInProgress: false,
    });
    vi.mocked(api.listEnvs).mockReset();
    vi.mocked(api.listImports).mockReset();
    vi.mocked(api.getGraph).mockReset();
    vi.mocked(api.inspectBatch).mockReset();
    vi.mocked(api.createImport).mockReset();
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

describe('useAppStore — uploadBatch', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: null, envs: [], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null,
      loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
    });
    vi.mocked(api.listEnvs).mockReset();
    vi.mocked(api.listImports).mockReset();
    vi.mocked(api.getGraph).mockReset();
    vi.mocked(api.inspectBatch).mockReset();
    vi.mocked(api.createImport).mockReset();
  });

  it('addBatchFiles inspects and adds items to the batch', async () => {
    vi.mocked(api.inspectBatch).mockResolvedValue([
      {
        fileName: 'a.zip', fileSize: 100, fileHash: 'h1',
        sourceComponentEic: '17V-A', sourceDumpTimestamp: '2026-04-17T21:27:17.000Z',
        dumpType: 'ENDPOINT', confidence: 'HIGH', reason: 'messaging_statistics.csv',
        duplicateOf: null, warnings: [],
      },
    ]);
    const file = new File(['fake'], 'a.zip', { type: 'application/zip' });
    await useAppStore.getState().addBatchFiles([file]);
    const batch = useAppStore.getState().uploadBatch;
    expect(batch).toHaveLength(1);
    expect(batch[0]!.state).toBe('inspected');
    expect(batch[0]!.dumpType).toBe('ENDPOINT');
    expect(batch[0]!.label).toContain('17V-A');  // auto-dérivé du sourceEic
  });

  it('removeBatchItem removes by id', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a'), fileName: 'a', fileSize: 0, label: '', forceReplace: false, state: 'inspected' } as any,
        { id: '2', file: new File([], 'b'), fileName: 'b', fileSize: 0, label: '', forceReplace: false, state: 'inspected' } as any,
      ],
    });
    useAppStore.getState().removeBatchItem('1');
    expect(useAppStore.getState().uploadBatch).toHaveLength(1);
    expect(useAppStore.getState().uploadBatch[0]!.id).toBe('2');
  });

  it('updateBatchItem merges a partial patch', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a'), fileName: 'a', fileSize: 0, label: 'old', forceReplace: false, state: 'inspected' } as any,
      ],
    });
    useAppStore.getState().updateBatchItem('1', { label: 'new', forceReplace: true });
    const item = useAppStore.getState().uploadBatch[0]!;
    expect(item.label).toBe('new');
    expect(item.forceReplace).toBe(true);
  });

  it('submitBatch skips duplicates without forceReplace', async () => {
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF']);
    vi.mocked(api.listImports).mockResolvedValue([]);
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [], edges: [], bounds: { north: 60, south: 40, east: 20, west: -10 },
      mapConfig: {} as any,
    });
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File(['x'], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'item1', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
          duplicateOf: { importId: 'old-id', label: 'old' },
        } as any,
      ],
    });
    await useAppStore.getState().submitBatch('OPF');
    expect(vi.mocked(api.createImport)).not.toHaveBeenCalled();
    expect(useAppStore.getState().uploadBatch[0]!.state).toBe('skipped');
  });

  it('submitBatch uploads and marks done on success', async () => {
    vi.mocked(api.createImport).mockResolvedValue({
      id: 'new-id', envName: 'OPF', label: '', fileName: '', dumpType: 'ENDPOINT',
      sourceComponentEic: null, sourceDumpTimestamp: null,
      uploadedAt: '2026-04-19T00:00:00.000Z', effectiveDate: '2026-04-19T00:00:00.000Z',
      hasConfigurationProperties: false,
      warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
    });
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF']);
    vi.mocked(api.listImports).mockResolvedValue([]);
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [], edges: [], bounds: { north: 60, south: 40, east: 20, west: -10 }, mapConfig: {} as any,
    });
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File(['x'], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'item1', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
          duplicateOf: null,
        } as any,
      ],
    });
    await useAppStore.getState().submitBatch('OPF');
    expect(useAppStore.getState().uploadBatch[0]!.state).toBe('done');
    expect(useAppStore.getState().uploadBatch[0]!.createdImportId).toBe('new-id');
  });

  it('clearBatch empties the batch', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a'), fileName: 'a', fileSize: 0, label: '', forceReplace: false, state: 'inspected' } as any,
      ],
      uploadInProgress: true,
    });
    useAppStore.getState().clearBatch();
    expect(useAppStore.getState().uploadBatch).toEqual([]);
    expect(useAppStore.getState().uploadInProgress).toBe(false);
  });
});

describe('useAppStore — refDate / setRefDate', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: 'OPF', envs: ['OPF'], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null,
      loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
      refDate: null,
    });
    vi.mocked(api.getGraph).mockReset();
  });

  it('defaults refDate to null', () => {
    expect(useAppStore.getState().refDate).toBeNull();
  });

  it('setRefDate updates state and triggers loadGraph with the date', async () => {
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [], edges: [], bounds: { north: 60, south: 40, east: 20, west: -10 }, mapConfig: {} as any,
    });
    const date = new Date('2026-04-17T10:00:00.000Z');
    await useAppStore.getState().setRefDate(date);
    expect(useAppStore.getState().refDate).toEqual(date);
    expect(api.getGraph).toHaveBeenCalledWith('OPF', date);
  });

  it('setRefDate(null) clears refDate and calls loadGraph without date', async () => {
    useAppStore.setState({ refDate: new Date('2026-01-01') });
    vi.mocked(api.getGraph).mockResolvedValue({
      nodes: [], edges: [], bounds: { north: 60, south: 40, east: 20, west: -10 }, mapConfig: {} as any,
    });
    await useAppStore.getState().setRefDate(null);
    expect(useAppStore.getState().refDate).toBeNull();
    expect(api.getGraph).toHaveBeenCalledWith('OPF', undefined);
  });
});
