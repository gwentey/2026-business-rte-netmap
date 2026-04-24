import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { RegistryAdminTab } from './RegistryAdminTab.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    getRteEndpoints: vi.fn(),
    getProcessColors: vi.fn(),
    setProcessColor: vi.fn(),
    resetProcessColor: vi.fn(),
  },
}));

vi.mock('./ProcessColorsEditor.js', () => ({
  ProcessColorsEditor: () => <div data-testid="colors-editor">Colors</div>,
}));

describe('RegistryAdminTab (2 sous-onglets — design carto-rte v2)', () => {
  beforeEach(() => {
    vi.mocked(api.getRteEndpoints).mockResolvedValue([
      {
        eic: '17V-ENDPOINT-1',
        code: 'PAR-001',
        displayName: 'Paris ALMA',
        city: 'Paris',
        lat: 48.85,
        lng: 2.35,
        hasOverride: true,
      },
      {
        eic: '17V-ENDPOINT-2',
        code: 'LYO-002',
        displayName: 'Lyon Jonage',
        city: 'Lyon',
        lat: 45.76,
        lng: 4.83,
        hasOverride: false,
      },
    ]);
  });

  it('affiche la table mapping endpoints par défaut', async () => {
    const onEditComponent = vi.fn();
    render(<RegistryAdminTab onEditComponent={onEditComponent} />);
    expect(await screen.findByText('Paris ALMA')).toBeInTheDocument();
    expect(screen.getByText('Lyon Jonage')).toBeInTheDocument();
    expect(screen.getByText('Non lié')).toBeInTheDocument();
  });

  it('forwards onEdit lorsque "Ouvrir la fiche" est cliqué', async () => {
    const onEditComponent = vi.fn();
    render(<RegistryAdminTab onEditComponent={onEditComponent} />);
    await screen.findByText('Paris ALMA');
    await userEvent.click(screen.getByRole('button', { name: /Ouvrir la fiche/ }));
    expect(onEditComponent).toHaveBeenCalledWith('17V-ENDPOINT-1');
  });

  it('switche vers le sous-onglet "Couleurs des process"', async () => {
    render(<RegistryAdminTab onEditComponent={vi.fn()} />);
    await screen.findByText('Paris ALMA');
    await userEvent.click(screen.getByRole('button', { name: /Couleurs des process/i }));
    expect(screen.getByTestId('colors-editor')).toBeInTheDocument();
  });
});
