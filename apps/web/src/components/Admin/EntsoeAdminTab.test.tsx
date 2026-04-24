import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { EntsoeAdminTab } from './EntsoeAdminTab.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    getEntsoeStatus: vi.fn(),
    uploadEntsoe: vi.fn(),
    listAdminComponents: vi.fn(),
    upsertOverride: vi.fn(), deleteOverride: vi.fn(),
    listEnvs: vi.fn(), listImports: vi.fn(), getGraph: vi.fn(),
    createImport: vi.fn(), inspectBatch: vi.fn(),
    updateImport: vi.fn(), deleteImport: vi.fn(),
    purgeImportsAll: vi.fn(), purgeOverridesAll: vi.fn(), purgeAll: vi.fn(),
  },
}));

describe('EntsoeAdminTab', () => {
  beforeEach(() => {
    vi.mocked(api.getEntsoeStatus).mockReset();
    vi.mocked(api.uploadEntsoe).mockReset();
  });

  it('displays "empty" when count is 0', async () => {
    vi.mocked(api.getEntsoeStatus).mockResolvedValue({ count: 0, refreshedAt: null });
    render(<EntsoeAdminTab />);
    await waitFor(() => expect(screen.getByText(/Annuaire vide/i)).toBeInTheDocument());
  });

  it('displays count after status loads', async () => {
    vi.mocked(api.getEntsoeStatus).mockResolvedValue({ count: 14929, refreshedAt: '2026-04-20T10:00:00.000Z' });
    render(<EntsoeAdminTab />);
    await waitFor(() => expect(screen.getAllByText(/14929/).length).toBeGreaterThan(0));
  });

  it('toggles the upload card via "Lancer une synchro manuelle" and uploads a CSV', async () => {
    vi.mocked(api.getEntsoeStatus).mockResolvedValue({ count: 0, refreshedAt: null });
    vi.mocked(api.uploadEntsoe).mockResolvedValue({ count: 42, refreshedAt: '2026-04-20T10:00:00.000Z' });

    render(<EntsoeAdminTab />);
    await waitFor(() => expect(screen.getByText(/Annuaire vide/i)).toBeInTheDocument());

    // Ouvre la carte upload
    await userEvent.click(screen.getByRole('button', { name: /Lancer une synchro manuelle/i }));

    const fileInput = screen.getByLabelText(/Fichier CSV ENTSO-E/i);
    const testFile = new File(['EicCode;...'], 'eic.csv', { type: 'text/csv' });
    await userEvent.upload(fileInput, testFile);

    const uploadBtn = screen.getByRole('button', { name: /Uploader/i });
    vi.mocked(api.getEntsoeStatus).mockResolvedValue({ count: 42, refreshedAt: '2026-04-20T10:00:00.000Z' });
    await userEvent.click(uploadBtn);

    await waitFor(() => {
      expect(api.uploadEntsoe).toHaveBeenCalled();
      expect(screen.getByText(/42 entrées importées/i)).toBeInTheDocument();
    });
  });
});
