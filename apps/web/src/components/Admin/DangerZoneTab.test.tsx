import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { DangerZoneTab } from './DangerZoneTab.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    purgeImportsAll: vi.fn(),
    purgeOverridesAll: vi.fn(),
    purgeAll: vi.fn(),
    getEntsoeStatus: vi.fn(), uploadEntsoe: vi.fn(),
    listAdminComponents: vi.fn(), upsertOverride: vi.fn(), deleteOverride: vi.fn(),
    listEnvs: vi.fn(), listImports: vi.fn(), getGraph: vi.fn(),
    createImport: vi.fn(), inspectBatch: vi.fn(),
    updateImport: vi.fn(), deleteImport: vi.fn(),
  },
}));

describe('DangerZoneTab', () => {
  beforeEach(() => {
    vi.mocked(api.purgeImportsAll).mockReset();
    vi.mocked(api.purgeOverridesAll).mockReset();
    vi.mocked(api.purgeAll).mockReset();
  });

  it('renders 3 purge buttons', () => {
    render(<DangerZoneTab />);
    expect(screen.getByRole('button', { name: /Purger tous les imports/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Purger toutes les surcharges/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset total/i })).toBeInTheDocument();
  });

  it('opens confirm modal and requires typing PURGER for purge imports', async () => {
    render(<DangerZoneTab />);
    const btn = screen.getAllByRole('button', { name: /Purger tous les imports/i })[0]!;
    await userEvent.click(btn);
    const confirmBtn = screen.getByRole('button', { name: /Confirmer/i });
    expect(confirmBtn).toBeDisabled();

    const input = screen.getByLabelText(/Confirmation/i);
    await userEvent.type(input, 'WRONG');
    expect(confirmBtn).toBeDisabled();

    await userEvent.clear(input);
    await userEvent.type(input, 'PURGER');
    expect(confirmBtn).toBeEnabled();
  });

  it('calls purgeImportsAll when confirming with correct keyword', async () => {
    vi.mocked(api.purgeImportsAll).mockResolvedValue({ deletedCount: 7 });
    render(<DangerZoneTab />);
    await userEvent.click(screen.getAllByRole('button', { name: /Purger tous les imports/i })[0]!);
    await userEvent.type(screen.getByLabelText(/Confirmation/i), 'PURGER');
    await userEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    expect(api.purgeImportsAll).toHaveBeenCalled();
  });

  it('calls purgeAll when confirming Reset total with keyword RESET', async () => {
    vi.mocked(api.purgeAll).mockResolvedValue({ imports: 5, overrides: 3, entsoe: 1000 });
    render(<DangerZoneTab />);
    await userEvent.click(screen.getAllByRole('button', { name: /Reset total/i })[0]!);
    await userEvent.type(screen.getByLabelText(/Confirmation/i), 'RESET');
    await userEvent.click(screen.getByRole('button', { name: /Confirmer/i }));
    expect(api.purgeAll).toHaveBeenCalled();
  });
});
