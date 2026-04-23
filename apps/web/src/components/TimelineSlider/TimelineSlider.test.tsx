import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { TimelineSlider } from './TimelineSlider.js';

function fakeImport(id: string, effectiveDate: string): any {
  return {
    id, envName: 'OPF', label: id, fileName: `${id}.zip`,
    dumpType: 'ENDPOINT',
    sourceComponentEic: null, sourceDumpTimestamp: null,
    uploadedAt: '2026-04-17T22:00:00.000Z',
    effectiveDate,
    warnings: [], stats: { componentsCount: 0, pathsCount: 0, messagingStatsCount: 0 },
  };
}

describe('TimelineSlider', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: 'OPF', envs: ['OPF'], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null,
      loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
      refDate: null,
    });
  });

  it('renders nothing when fewer than 2 distinct effectiveDates', () => {
    useAppStore.setState({
      imports: [fakeImport('a', '2026-04-17T10:00:00.000Z')],
    });
    const { container } = render(<TimelineSlider />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders "présent" label when refDate is null (ADR-040)', () => {
    useAppStore.setState({
      imports: [
        fakeImport('a', '2026-04-17T10:00:00.000Z'),
        fakeImport('b', '2026-04-18T10:00:00.000Z'),
      ],
      refDate: null,
    });
    render(<TimelineSlider />);
    expect(screen.getAllByText(/présent/i).length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('button', { name: /Retour au présent/i }),
    ).not.toBeInTheDocument();
  });

  it('renders formatted date label when refDate is set', () => {
    useAppStore.setState({
      imports: [
        fakeImport('a', '2026-04-17T10:00:00.000Z'),
        fakeImport('b', '2026-04-18T10:00:00.000Z'),
      ],
      refDate: new Date('2026-04-17T10:00:00.000Z'),
    });
    render(<TimelineSlider />);
    expect(screen.queryByText(/^présent$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Retour au présent/i })).toBeInTheDocument();
  });

  it('calls setRefDate(null) when "Retour au présent" clicked', async () => {
    const setRefDate = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({
      imports: [
        fakeImport('a', '2026-04-17T10:00:00.000Z'),
        fakeImport('b', '2026-04-18T10:00:00.000Z'),
      ],
      refDate: new Date('2026-04-17T10:00:00.000Z'),
      setRefDate,
    });
    render(<TimelineSlider />);
    await userEvent.click(screen.getByRole('button', { name: /Retour au présent/i }));
    expect(setRefDate).toHaveBeenCalledWith(null);
  });
});
