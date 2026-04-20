import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { RteEndpointsTable } from './RteEndpointsTable.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    getRteEndpoints: vi.fn(),
  },
}));

function ep(eic: string, hasOverride = false): any {
  return {
    eic,
    code: 'CODE-' + eic.slice(-2),
    displayName: 'Name ' + eic.slice(-2),
    city: 'Paris',
    lat: 48.8918,
    lng: 2.2378,
    hasOverride,
  };
}

describe('RteEndpointsTable', () => {
  beforeEach(() => {
    vi.mocked(api.getRteEndpoints).mockReset();
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders one row per endpoint and shows the surchargé badge when hasOverride=true', async () => {
    vi.mocked(api.getRteEndpoints).mockResolvedValue([
      ep('17V000000000AA'),
      ep('17V000000000BB'),
      ep('17V000000000CC', true),
    ]);
    render(<RteEndpointsTable onEdit={() => {}} />);
    await waitFor(() => {
      expect(screen.getByText('17V000000000AA')).toBeInTheDocument();
      expect(screen.getByText('17V000000000BB')).toBeInTheDocument();
      expect(screen.getByText('17V000000000CC')).toBeInTheDocument();
    });
    const badges = screen.getAllByText(/surchargé/i);
    expect(badges).toHaveLength(1);
  });

  it('calls onEdit with the EIC when the Modifier button is clicked', async () => {
    const onEdit = vi.fn();
    vi.mocked(api.getRteEndpoints).mockResolvedValue([ep('17V000000000EIC')]);
    render(<RteEndpointsTable onEdit={onEdit} />);
    await waitFor(() => expect(screen.getByText('17V000000000EIC')).toBeInTheDocument());
    const btn = screen.getByRole('button', { name: /Modifier 17V000000000EIC/i });
    await userEvent.click(btn);
    expect(onEdit).toHaveBeenCalledWith('17V000000000EIC');
  });
});
