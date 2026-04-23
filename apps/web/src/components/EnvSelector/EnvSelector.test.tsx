import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore } from '../../store/app-store.js';
import { EnvSelector } from './EnvSelector.js';

const renderSelector = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter>
      <EnvSelector />
    </MemoryRouter>,
  );

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

  it('renders the active env in the chip', () => {
    renderSelector();
    expect(screen.getByText('OPF')).toBeInTheDocument();
  });

  it('opens a listbox on click and lists every env', () => {
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /env/i }));
    const listbox = screen.getByRole('listbox', { name: /environnement/i });
    expect(listbox).toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('calls setActiveEnv when picking another env', () => {
    const setActiveEnv = vi.fn(() => Promise.resolve());
    useAppStore.setState({ setActiveEnv });
    renderSelector();
    fireEvent.click(screen.getByRole('button', { name: /env/i }));
    fireEvent.click(screen.getByRole('option', { name: /PROD/i }));
    expect(setActiveEnv).toHaveBeenCalledWith('PROD');
  });

  it('renders fallback chip when envs is empty', () => {
    useAppStore.setState({ envs: [], activeEnv: null });
    renderSelector();
    expect(screen.getByText(/aucun/i)).toBeInTheDocument();
  });
});
