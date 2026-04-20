import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';
import { ProcessColorsEditor } from './ProcessColorsEditor.js';
import { api } from '../../lib/api.js';
import { useAppStore } from '../../store/app-store.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    getProcessColors: vi.fn(),
    setProcessColor: vi.fn(),
    resetProcessColor: vi.fn(),
  },
}));

function row(
  process: string,
  color: string,
  isOverride: boolean,
  def?: string,
): any {
  return { process, color, isOverride, default: def ?? color };
}

describe('ProcessColorsEditor', () => {
  beforeEach(() => {
    vi.mocked(api.getProcessColors).mockReset();
    vi.mocked(api.setProcessColor).mockReset();
    vi.mocked(api.resetProcessColor).mockReset();
    useAppStore.setState({ activeEnv: null, graph: null });
  });
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders 8 rows from api.getProcessColors', async () => {
    vi.mocked(api.getProcessColors).mockResolvedValue([
      row('TP', '#3b82f6', false),
      row('UK-CC-IN', '#f97316', false),
      row('CORE', '#a855f7', false),
      row('MARI', '#22c55e', false),
      row('PICASSO', '#f59e0b', false),
      row('VP', '#ec4899', false),
      row('MIXTE', '#4b5563', false),
      row('UNKNOWN', '#9ca3af', false),
    ]);
    render(<ProcessColorsEditor />);
    await waitFor(() => {
      expect(screen.getByText('TP')).toBeInTheDocument();
      expect(screen.getByText('UK-CC-IN')).toBeInTheDocument();
      expect(screen.getByText('MIXTE')).toBeInTheDocument();
    });
  });

  it('save click calls api.setProcessColor and reloads list', async () => {
    vi.mocked(api.getProcessColors).mockResolvedValue([row('TP', '#3b82f6', false)]);
    vi.mocked(api.setProcessColor).mockResolvedValue(undefined);
    render(<ProcessColorsEditor />);
    await waitFor(() => expect(screen.getByText('TP')).toBeInTheDocument());

    const picker = screen.getByLabelText(/Choisir la couleur pour TP/i) as HTMLInputElement;
    fireEvent.change(picker, { target: { value: '#aabbcc' } });

    // Refresh mock: after save, reload returns the new color with isOverride=true
    vi.mocked(api.getProcessColors).mockResolvedValue([row('TP', '#aabbcc', true, '#3b82f6')]);

    const saveBtn = await screen.findByRole('button', { name: /Enregistrer/i });
    await waitFor(() => expect(saveBtn).not.toBeDisabled());
    await userEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.setProcessColor).toHaveBeenCalledWith('TP', '#aabbcc');
    });
    // reload runs : 2 total getProcessColors calls (initial + after save)
    await waitFor(() => {
      expect(api.getProcessColors).toHaveBeenCalledTimes(2);
    });
  });

  it('shows the "surchargé" badge when isOverride is true and hides it after reset', async () => {
    vi.mocked(api.getProcessColors).mockResolvedValueOnce([
      row('CORE', '#a855f7', true, '#aabbcc'),
    ]);
    vi.mocked(api.resetProcessColor).mockResolvedValue(undefined);
    vi.mocked(api.getProcessColors).mockResolvedValueOnce([
      row('CORE', '#aabbcc', false),
    ]);
    render(<ProcessColorsEditor />);
    await waitFor(() => expect(screen.getByText('CORE')).toBeInTheDocument());
    expect(screen.getByText(/surchargé/i)).toBeInTheDocument();

    const resetBtn = screen.getByRole('button', { name: /Réinitialiser/i });
    await userEvent.click(resetBtn);
    await waitFor(() => {
      expect(api.resetProcessColor).toHaveBeenCalledWith('CORE');
    });
    await waitFor(() => {
      expect(screen.queryByText(/surchargé/i)).not.toBeInTheDocument();
    });
  });
});
