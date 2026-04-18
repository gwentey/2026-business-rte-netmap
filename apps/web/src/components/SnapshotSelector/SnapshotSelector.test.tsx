import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SnapshotSelector } from './SnapshotSelector';
import type { SnapshotSummary } from '@carto-ecp/shared';

vi.mock('../../store/app-store.js', () => ({
  useAppStore: vi.fn(),
}));

import { useAppStore } from '../../store/app-store.js';

function renderWithRouter(): void {
  render(
    <MemoryRouter>
      <SnapshotSelector />
    </MemoryRouter>,
  );
}

function mockStore(opts: {
  snapshots: SnapshotSummary[];
  activeSnapshotId: string | null;
  setActiveSnapshot?: (id: string) => Promise<void>;
  loadSnapshots?: () => Promise<void>;
}): ReturnType<typeof vi.fn> {
  const setActive = opts.setActiveSnapshot ?? vi.fn().mockResolvedValue(undefined);
  const load = opts.loadSnapshots ?? vi.fn().mockResolvedValue(undefined);
  vi.mocked(useAppStore).mockImplementation(((selector: (s: unknown) => unknown) =>
    selector({
      snapshots: opts.snapshots,
      activeSnapshotId: opts.activeSnapshotId,
      setActiveSnapshot: setActive,
      loadSnapshots: load,
      graph: null,
      selectedNodeEic: null,
      selectedEdgeId: null,
      loading: false,
      error: null,
      selectNode: vi.fn(),
      selectEdge: vi.fn(),
    })) as never,
  );
  return setActive as unknown as ReturnType<typeof vi.fn>;
}

function makeSnap(id: string, label: string): SnapshotSummary {
  return {
    id,
    label,
    envName: 'OPF',
    componentType: 'ENDPOINT',
    sourceComponentCode: 'S',
    cdCode: 'C',
    uploadedAt: '2026-04-18T12:00:00Z',
    warningCount: 0,
  };
}

describe('SnapshotSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a CTA link to /upload when snapshots list is empty', () => {
    mockStore({ snapshots: [], activeSnapshotId: null });
    renderWithRouter();
    const link = screen.getByRole('link', { name: /Aucun snapshot/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/upload');
  });

  it('renders <select> with N options and marks active as selected', () => {
    mockStore({
      snapshots: [makeSnap('id-1', 'Snap One'), makeSnap('id-2', 'Snap Two')],
      activeSnapshotId: 'id-2',
    });
    renderWithRouter();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe('id-2');
  });

  it('calls setActiveSnapshot with new id on change', () => {
    const setActive = mockStore({
      snapshots: [makeSnap('id-1', 'Snap One'), makeSnap('id-2', 'Snap Two')],
      activeSnapshotId: 'id-1',
    });
    renderWithRouter();
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'id-2' } });
    expect(setActive).toHaveBeenCalledWith('id-2');
  });
});
