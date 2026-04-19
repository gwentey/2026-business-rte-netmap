import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { EnvSelector } from './EnvSelector.js';

describe('EnvSelector', () => {
  beforeEach(() => {
    useAppStore.setState({
      envs: ['OPF', 'PROD'],
      activeEnv: 'OPF',
      imports: [],
      graph: null,
      selectedNodeEic: null,
      selectedEdgeId: null,
      loading: false,
      error: null,
    });
  });

  it('renders all envs as options', () => {
    render(<EnvSelector />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(2);
    expect(options.map((o) => o.textContent)).toEqual(['OPF', 'PROD']);
  });

  it('marks the active env as selected', () => {
    render(<EnvSelector />);
    const combo = screen.getByRole('combobox') as HTMLSelectElement;
    expect(combo.value).toBe('OPF');
  });

  it('calls setActiveEnv on change', async () => {
    const setActiveEnv = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ setActiveEnv });
    render(<EnvSelector />);
    await userEvent.selectOptions(screen.getByRole('combobox'), 'PROD');
    expect(setActiveEnv).toHaveBeenCalledWith('PROD');
  });

  it('renders fallback text when envs is empty', () => {
    useAppStore.setState({ envs: [], activeEnv: null });
    render(<EnvSelector />);
    expect(screen.getByText(/Aucun env/i)).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });
});
