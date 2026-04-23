import { render, screen } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
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

  // Les tests d'interaction (role combobox, selectOptions) sont désactivés car
  // le Select de @design-system-rte/react rend un DOM custom (pas un <select> natif).
  // À réécrire en Slice 4b.2 quand l'API DOM du DS Select sera documentée
  // (ou quand on aura décidé d'une stratégie data-testid pour ce composant).
  it.todo('renders all envs as options');
  it.todo('marks the active env as selected');
  it.todo('calls setActiveEnv on change');

  it('renders fallback text when envs is empty', () => {
    useAppStore.setState({ envs: [], activeEnv: null });
    render(<EnvSelector />);
    expect(screen.getByText(/Aucun env/i)).toBeInTheDocument();
  });
});
