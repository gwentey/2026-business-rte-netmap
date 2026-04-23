import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentConfigModal } from './ComponentConfigModal';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    getComponentConfig: vi.fn(),
  },
}));

describe('ComponentConfigModal', () => {
  beforeEach(() => {
    vi.mocked(api.getComponentConfig).mockReset();
  });

  it('loads config from API on mount and renders sections', async () => {
    vi.mocked(api.getComponentConfig).mockResolvedValue({
      eic: '17V000000498771C',
      source: {
        importId: 'imp-1',
        label: 'PRFRI EP2',
        envName: 'PFRFI',
        uploadedAt: '2026-04-22T08:00:00Z',
        hasConfigurationProperties: true,
      },
      sections: [
        {
          slug: 'identification',
          name: 'Identification',
          properties: [
            { key: 'ecp.envName', value: 'PFRFI' },
            { key: 'ecp.projectName', value: 'INTERNET-EP2' },
          ],
        },
        {
          slug: 'network',
          name: 'Réseau',
          properties: [{ key: 'ecp.natEnabled', value: 'true' }],
        },
      ],
    });

    render(
      <ComponentConfigModal eic="17V000000498771C" onClose={() => {}} />,
    );

    expect(api.getComponentConfig).toHaveBeenCalledWith('17V000000498771C');
    await waitFor(() =>
      expect(screen.getByText('Identification')).toBeInTheDocument(),
    );
    expect(screen.getByText('Réseau')).toBeInTheDocument();
    expect(screen.getByText('INTERNET-EP2')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText(/PRFRI EP2/)).toBeInTheDocument();
    expect(screen.getByText(/✓ Properties/)).toBeInTheDocument();
  });

  it('displays a warning banner when no source import exists for the EIC', async () => {
    vi.mocked(api.getComponentConfig).mockResolvedValue({
      eic: '17V000000000000X',
      source: null,
      sections: [],
    });

    render(
      <ComponentConfigModal eic="17V000000000000X" onClose={() => {}} />,
    );

    await waitFor(() =>
      expect(screen.getByText(/Aucun dump dans la base/)).toBeInTheDocument(),
    );
  });

  it('renders an (vide) placeholder when a property value is empty', async () => {
    vi.mocked(api.getComponentConfig).mockResolvedValue({
      eic: '17V000000498771C',
      source: {
        importId: 'imp-1',
        label: 'test',
        envName: 'X',
        uploadedAt: '2026-04-22T08:00:00Z',
        hasConfigurationProperties: false,
      },
      sections: [
        {
          slug: 'network',
          name: 'Réseau',
          properties: [{ key: 'ecp.natEnabled', value: '' }],
        },
      ],
    });

    render(
      <ComponentConfigModal eic="17V000000498771C" onClose={() => {}} />,
    );

    await waitFor(() =>
      expect(screen.getByText('(vide)')).toBeInTheDocument(),
    );
    expect(screen.getByText(/✗ Properties/)).toBeInTheDocument();
  });

  it('close button invokes onClose', async () => {
    vi.mocked(api.getComponentConfig).mockResolvedValue({
      eic: 'X',
      source: null,
      sections: [],
    });
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ComponentConfigModal eic="X" onClose={onClose} />);
    const closeBtn = await screen.findByRole('button', { name: 'Fermer' });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
