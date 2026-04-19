import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { ImportsAdminTable } from './ImportsAdminTable.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    listEnvs: vi.fn().mockResolvedValue(['OPF', 'PROD']),
    listImports: vi.fn(),
    updateImport: vi.fn(),
    deleteImport: vi.fn(),
    createImport: vi.fn(),
    inspectBatch: vi.fn(),
    getGraph: vi.fn(),
  },
}));

function fakeImportDetail(overrides: Partial<any> = {}): any {
  return {
    id: 'i1', envName: 'OPF', label: 'Import 1', fileName: 'file1.zip',
    dumpType: 'ENDPOINT' as const,
    sourceComponentEic: '17V-A', sourceDumpTimestamp: '2026-04-17T21:27:17.000Z',
    uploadedAt: '2026-04-17T22:00:00.000Z',
    effectiveDate: '2026-04-17T21:27:17.000Z',
    warnings: [],
    stats: { componentsCount: 10, pathsCount: 5, messagingStatsCount: 2 },
    ...overrides,
  };
}

describe('ImportsAdminTable', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: 'OPF', envs: ['OPF', 'PROD'], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null, loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
    });
    vi.mocked(api.listEnvs).mockReset();
    vi.mocked(api.listImports).mockReset();
    vi.mocked(api.updateImport).mockReset();
    vi.mocked(api.deleteImport).mockReset();
    vi.mocked(api.listEnvs).mockResolvedValue(['OPF', 'PROD']);
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('renders a row per import with label and sourceEic', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'Alpha', sourceComponentEic: '17V-A' }),
      fakeImportDetail({ id: 'i2', label: 'Beta', sourceComponentEic: '17V-B', fileName: 'file2.zip' }),
    ]);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => {
      expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
    });
    expect(screen.getByText('17V-A')).toBeInTheDocument();
    expect(screen.getByText('17V-B')).toBeInTheDocument();
  });

  it('filters imports by search text (label, fileName, sourceEic)', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'Alpha', fileName: 'a.zip', sourceComponentEic: '17V-AAA' }),
      fakeImportDetail({ id: 'i2', label: 'Beta', fileName: 'b.zip', sourceComponentEic: '17V-BBB' }),
    ]);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(screen.getByDisplayValue('Alpha')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/label, filename/i);
    await userEvent.type(searchInput, 'BBB');
    await waitFor(() => {
      expect(screen.queryByDisplayValue('Alpha')).not.toBeInTheDocument();
      expect(screen.getByDisplayValue('Beta')).toBeInTheDocument();
    });
  });

  it('opens confirm modal on delete click and calls api.deleteImport on confirm', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'To delete' }),
    ]);
    vi.mocked(api.deleteImport).mockResolvedValue(undefined);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(screen.getByDisplayValue('To delete')).toBeInTheDocument());

    const deleteBtn = screen.getByRole('button', { name: /supprimer import/i });
    await userEvent.click(deleteBtn);
    expect(screen.getByRole('heading', { name: /Supprimer l'import/i })).toBeInTheDocument();

    const confirmBtn = screen.getByRole('button', { name: /^Supprimer$/ });
    await userEvent.click(confirmBtn);
    expect(api.deleteImport).toHaveBeenCalledWith('i1');
  });

  it('filters by env when env select is changed', async () => {
    vi.mocked(api.listImports).mockResolvedValue([]);
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(api.listImports).toHaveBeenCalledWith('OPF'));
    const envSelect = screen.getByLabelText(/Env/i);
    await userEvent.selectOptions(envSelect, 'PROD');
    await waitFor(() => expect(api.listImports).toHaveBeenCalledWith('PROD'));
  });

  it('calls api.updateImport when effectiveDate loses focus with a new value', async () => {
    vi.mocked(api.listImports).mockResolvedValue([
      fakeImportDetail({ id: 'i1', label: 'row', effectiveDate: '2026-04-17T21:27:17.000Z' }),
    ]);
    vi.mocked(api.updateImport).mockResolvedValue(fakeImportDetail({ id: 'i1' }));
    render(<MemoryRouter><ImportsAdminTable /></MemoryRouter>);
    await waitFor(() => expect(screen.getByDisplayValue('row')).toBeInTheDocument());
    const dateInput = screen.getAllByDisplayValue(/2026-04-17T\d{2}:27/)[0]!;
    await userEvent.clear(dateInput);
    await userEvent.type(dateInput, '2030-01-15T10:00');
    dateInput.blur();
    await waitFor(() => {
      expect(api.updateImport).toHaveBeenCalledWith('i1', expect.objectContaining({ effectiveDate: expect.stringContaining('2030-01-15') }));
    });
  });
});
