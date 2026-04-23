import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OrganizationEntryRow } from '@carto-ecp/shared';
import { OrganizationsAdminTab } from './OrganizationsAdminTab';
import { api } from '../../lib/api';

vi.mock('../../lib/api', () => ({
  api: {
    listOrganizations: vi.fn(),
    createOrganization: vi.fn(),
    updateOrganization: vi.fn(),
    deleteOrganization: vi.fn(),
    importOrganizations: vi.fn(),
    exportOrganizations: vi.fn(),
  },
}));

function row(overrides: Partial<OrganizationEntryRow>): OrganizationEntryRow {
  return {
    id: 'id-' + Math.random().toString(36).slice(2),
    organizationName: 'test',
    displayName: 'Test Org',
    country: 'FR',
    address: null,
    typeHint: 'TSO',
    lat: null,
    lng: null,
    notes: null,
    userEdited: false,
    seedVersion: 1,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('OrganizationsAdminTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('affiche la liste des organisations au mount', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([
      row({ displayName: 'Swissgrid AG', country: 'CH' }),
      row({ displayName: 'Amprion', country: 'DE' }),
    ]);
    render(<OrganizationsAdminTab />);
    await waitFor(() => {
      expect(screen.getByText('Swissgrid AG')).toBeInTheDocument();
      expect(screen.getByText('Amprion')).toBeInTheDocument();
    });
    expect(screen.getByText(/2 \/ 2 organisations/)).toBeInTheDocument();
  });

  it('filtre par recherche texte', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([
      row({ displayName: 'Swissgrid AG', country: 'CH', organizationName: 'swissgrid ag' }),
      row({ displayName: 'Amprion', country: 'DE', organizationName: 'amprion' }),
      row({ displayName: 'Elia', country: 'BE', organizationName: 'elia' }),
    ]);
    const user = userEvent.setup();
    render(<OrganizationsAdminTab />);
    await waitFor(() => expect(screen.getByText('Elia')).toBeInTheDocument());

    const input = screen.getByPlaceholderText(/Rechercher/i);
    await user.type(input, 'swiss');

    expect(screen.getByText('Swissgrid AG')).toBeInTheDocument();
    expect(screen.queryByText('Amprion')).not.toBeInTheDocument();
    expect(screen.queryByText('Elia')).not.toBeInTheDocument();
  });

  it('affiche le badge edite quand userEdited=true', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([
      row({ displayName: 'Edited Org', userEdited: true }),
    ]);
    render(<OrganizationsAdminTab />);
    await waitFor(() => expect(screen.getByText('Edited Org')).toBeInTheDocument());
    expect(screen.getByText(/1 éditée\(s\) par l'utilisateur/)).toBeInTheDocument();
  });

  it('le bouton Exporter JSON appelle api.exportOrganizations', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([]);
    vi.mocked(api.exportOrganizations).mockResolvedValue(
      new Blob(['{"version":1,"entries":[]}'], { type: 'application/json' }),
    );
    const createObjectURL = vi.fn().mockReturnValue('blob:x');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { value: createObjectURL, configurable: true });
    Object.defineProperty(URL, 'revokeObjectURL', { value: revokeObjectURL, configurable: true });

    const user = userEvent.setup();
    render(<OrganizationsAdminTab />);
    await waitFor(() => expect(screen.getByText(/Exporter JSON/)).toBeInTheDocument());
    await user.click(screen.getByText(/Exporter JSON/));
    await waitFor(() => {
      expect(api.exportOrganizations).toHaveBeenCalled();
      expect(createObjectURL).toHaveBeenCalled();
    });
  });

  it('affiche un message si liste vide', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([]);
    render(<OrganizationsAdminTab />);
    await waitFor(() =>
      expect(screen.getByText(/Aucune organisation en mémoire/)).toBeInTheDocument(),
    );
  });

  it('bouton Nouvelle ouvre le modal en mode creation', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([]);
    const user = userEvent.setup();
    render(<OrganizationsAdminTab />);
    await waitFor(() => expect(screen.getByText(/Nouvelle organisation/)).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: /Nouvelle organisation/ }));
    // Modal ouvert → titre "Nouvelle organisation" visible dans le modal h3
    expect(screen.getAllByText(/Nouvelle organisation/).length).toBeGreaterThan(1);
  });

  it('bouton Editer ouvre le modal pre-rempli', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([
      row({ displayName: 'To Edit', country: 'FR' }),
    ]);
    const user = userEvent.setup();
    render(<OrganizationsAdminTab />);
    await waitFor(() => expect(screen.getByText('To Edit')).toBeInTheDocument());
    await user.click(screen.getByText(/🖊 Éditer/));
    // Modal en mode edit → bouton "Supprimer" visible
    expect(screen.getByRole('button', { name: /Supprimer/ })).toBeInTheDocument();
  });

  it('importer JSON : affiche le bilan apres import', async () => {
    vi.mocked(api.listOrganizations).mockResolvedValue([]);
    vi.mocked(api.importOrganizations).mockResolvedValue({
      inserted: 3,
      updated: 1,
      skipped: 0,
      errors: [],
    });
    render(<OrganizationsAdminTab />);
    await waitFor(() => expect(screen.getByText(/Importer JSON/)).toBeInTheDocument());
    const fileInput = document.querySelector<HTMLInputElement>('input[type="file"]');
    expect(fileInput).not.toBeNull();
    const file = new File(['{"entries":[]}'], 'orgs.json', { type: 'application/json' });
    fireEvent.change(fileInput!, { target: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByText(/Import terminé/)).toBeInTheDocument();
      expect(screen.getByText(/3/)).toBeInTheDocument();
    });
  });
});
