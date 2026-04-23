import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { ComponentsAdminTable } from './ComponentsAdminTable.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    listAdminComponents: vi.fn(),
    upsertOverride: vi.fn(),
    deleteOverride: vi.fn(),
    listEnvs: vi.fn(),
    listImports: vi.fn(),
    getGraph: vi.fn(),
    createImport: vi.fn(),
    inspectBatch: vi.fn(),
    updateImport: vi.fn(),
    deleteImport: vi.fn(),
  },
}));

function fakeRow(overrides: Partial<any> = {}): any {
  return {
    eic: '17V-A',
    current: {
      displayName: 'Test Endpoint',
      type: 'ENDPOINT',
      organization: 'RTE',
      country: 'FR',
      lat: 48.85,
      lng: 2.35,
      isDefaultPosition: false,
    },
    override: null,
    importsCount: 2,
    ...overrides,
  };
}

describe('ComponentsAdminTable', () => {
  beforeEach(() => {
    vi.mocked(api.listAdminComponents).mockReset();
    vi.mocked(api.upsertOverride).mockReset();
    vi.mocked(api.deleteOverride).mockReset();
  });
  afterEach(() => { vi.clearAllMocks(); });

  it('renders one row per component with EIC and displayName', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-A', current: { ...fakeRow().current, displayName: 'Alpha' } }),
      fakeRow({ eic: '17V-B', current: { ...fakeRow().current, displayName: 'Beta' } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => {
      expect(screen.getByText('17V-A')).toBeInTheDocument();
      expect(screen.getByText('17V-B')).toBeInTheDocument();
      expect(screen.getByText('Alpha')).toBeInTheDocument();
      expect(screen.getByText('Beta')).toBeInTheDocument();
    });
  });

  it('filters by search text (eic, displayName, organization, country)', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-AAA', current: { ...fakeRow().current, displayName: 'Alpha', organization: 'APG' } }),
      fakeRow({ eic: '17V-BBB', current: { ...fakeRow().current, displayName: 'Beta', organization: 'Tennet' } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('Alpha')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/EIC, nom/i);
    await userEvent.type(searchInput, 'APG');
    await waitFor(() => {
      expect(screen.getByText('17V-AAA')).toBeInTheDocument();
      expect(screen.queryByText('17V-BBB')).not.toBeInTheDocument();
    });
  });

  it('filters to overridden only when toggle is checked', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-A', override: null }),
      fakeRow({ eic: '17V-B', override: {
        displayName: null, type: null, organization: null, country: null,
        lat: null, lng: null, tagsCsv: null, notes: null,
        updatedAt: '2026-04-20T00:00:00.000Z',
      } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('17V-A')).toBeInTheDocument());
    const toggle = screen.getByLabelText(/surchargés/i);
    await userEvent.click(toggle);
    await waitFor(() => {
      expect(screen.queryByText('17V-A')).not.toBeInTheDocument();
      expect(screen.getByText('17V-B')).toBeInTheDocument();
    });
  });

  it('opens override modal on edit click', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-EDIT' }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('17V-EDIT')).toBeInTheDocument());
    const editBtn = screen.getByRole('button', { name: /éditer/i });
    await userEvent.click(editBtn);
    expect(screen.getByRole('heading', { name: /Surcharge pour 17V-EDIT/i })).toBeInTheDocument();
  });

  it('[Export JSON] "Tout exporter" declenche un download de TOUS les rows meme avec un filtre actif', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-ALPHA', current: { ...fakeRow().current, displayName: 'Alpha', organization: 'APG' } }),
      fakeRow({ eic: '17V-BETA', current: { ...fakeRow().current, displayName: 'Beta', organization: 'Tennet' } }),
    ]);
    const createObjectURL = vi.fn().mockReturnValue('blob:x');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });

    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('17V-ALPHA')).toBeInTheDocument());

    // Applique un filtre (1 seul match)
    const searchInput = screen.getByPlaceholderText(/EIC, nom/i);
    await userEvent.type(searchInput, 'APG');
    await waitFor(() => expect(screen.queryByText('17V-BETA')).not.toBeInTheDocument());

    // Le bouton affiche TOUJOURS 2 (total des rows, pas filtered)
    const btn = screen.getByRole('button', { name: /Tout exporter \(2\)/ });
    await userEvent.click(btn);
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    // Le blob contient les 2 lignes
    const blobArg = createObjectURL.mock.calls[0]![0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    const text = await blobArg.text();
    const parsed = JSON.parse(text);
    expect(parsed.totals.total).toBe(2);
    expect(parsed.components).toHaveLength(2);
    expect(parsed.components.map((c: { eic: string }) => c.eic).sort()).toEqual(['17V-ALPHA', '17V-BETA']);
  });

  it('[Export JSON] le bouton est disable quand aucun composant en DB', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([]);
    render(<ComponentsAdminTable />);
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Tout exporter \(0\)/ });
      expect(btn).toBeDisabled();
    });
  });
});
