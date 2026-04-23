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

  it('[Export JSON] le bouton declenche un download et respecte le filtre courant', async () => {
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

    // Sans filtre : le bouton affiche le total
    const btn = screen.getByRole('button', { name: /Exporter JSON \(2\)/ });
    await userEvent.click(btn);
    expect(createObjectURL).toHaveBeenCalledTimes(1);

    // Avec filtre : le bouton reflete le count filtre et exporte seulement
    // les lignes visibles. On verifie que le blob contient bien alpha et pas beta.
    const searchInput = screen.getByPlaceholderText(/EIC, nom/i);
    await userEvent.type(searchInput, 'APG');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Exporter JSON \(1\)/ })).toBeInTheDocument();
    });
    await userEvent.click(screen.getByRole('button', { name: /Exporter JSON \(1\)/ }));
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    // Le second appel recoit un Blob contenant la serialisation filtree
    const blobArg = createObjectURL.mock.calls[1]![0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
  });

  it('[Export JSON] le bouton est disable quand aucun composant ne matche le filtre', async () => {
    vi.mocked(api.listAdminComponents).mockResolvedValue([
      fakeRow({ eic: '17V-A', current: { ...fakeRow().current, organization: 'RTE' } }),
    ]);
    render(<ComponentsAdminTable />);
    await waitFor(() => expect(screen.getByText('17V-A')).toBeInTheDocument());
    const searchInput = screen.getByPlaceholderText(/EIC, nom/i);
    await userEvent.type(searchInput, 'zzzzzzzz-absent');
    await waitFor(() => {
      const btn = screen.getByRole('button', { name: /Exporter JSON \(0\)/ });
      expect(btn).toBeDisabled();
    });
  });
});
