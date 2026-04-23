import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import type { GraphResponse } from '@carto-ecp/shared';
import { useAppStore } from '../../store/app-store';
import { BaFilter } from './BaFilter';

function makeGraph(): GraphResponse {
  return {
    nodes: [
      {
        id: 'A', eic: 'A', kind: 'RTE_ENDPOINT', displayName: 'A',
        projectName: null, envName: 'PFRFI', organization: 'RTE',
        personName: null, email: null, phone: null, homeCdCode: null,
        status: null, appTheme: null, lastSync: null, sentMessages: null,
        receivedMessages: null, uploadTargets: [], interlocutors: [],
        businessApplications: [
          { code: 'OCAPPI', criticality: 'P1' },
          { code: 'PLANET', criticality: 'P2' },
        ],
        country: 'FR', lat: 48, lng: 2, isDefaultPosition: false,
        networks: [], process: null, urls: [],
        creationTs: '2026-01-01T00:00:00Z', modificationTs: '2026-01-01T00:00:00Z',
      },
      {
        id: 'B', eic: 'B', kind: 'RTE_ENDPOINT', displayName: 'B',
        projectName: null, envName: 'PFRFI', organization: 'RTE',
        personName: null, email: null, phone: null, homeCdCode: null,
        status: null, appTheme: null, lastSync: null, sentMessages: null,
        receivedMessages: null, uploadTargets: [], interlocutors: [],
        businessApplications: [{ code: 'KIWI', criticality: 'P3' }],
        country: 'FR', lat: 48, lng: 2, isDefaultPosition: false,
        networks: [], process: null, urls: [],
        creationTs: '2026-01-01T00:00:00Z', modificationTs: '2026-01-01T00:00:00Z',
      },
    ],
    edges: [],
    bounds: { north: 60, south: 40, east: 20, west: -10 },
    mapConfig: {
      rteClusterLat: 48.89, rteClusterLng: 2.24, rteClusterOffsetDeg: 0.6,
      rteClusterProximityDeg: 0.01, defaultLat: 50.85, defaultLng: 4.35,
      processColors: {
        CORE: '#000', 'UK-CC-IN': '#000', TP: '#000', MARI: '#000',
        PICASSO: '#000', VP: '#000', MIXTE: '#000', UNKNOWN: '#000',
      },
    },
  };
}

describe('BaFilter (ADR-040 — panneau intégré dans MapOverlaysTopRight)', () => {
  beforeEach(() => {
    useAppStore.setState({ selectedBaCodes: [] });
    cleanup();
  });

  it('ne rend rien si graph est null', () => {
    const { container } = render(<BaFilter graph={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('ne rend rien si aucun noeud n a de BA', () => {
    const g = makeGraph();
    g.nodes.forEach((n) => (n.businessApplications = []));
    const { container } = render(<BaFilter graph={g} />);
    expect(container.firstChild).toBeNull();
  });

  it('liste toutes les BAs présentes triées par criticité (P1, P2, P3)', () => {
    render(<BaFilter graph={makeGraph()} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]!.getAttribute('aria-label')).toBe('Filtrer OCAPPI');
    expect(checkboxes[1]!.getAttribute('aria-label')).toBe('Filtrer PLANET');
    expect(checkboxes[2]!.getAttribute('aria-label')).toBe('Filtrer KIWI');
  });

  it('clique sur une BA met à jour le store et le compteur', () => {
    render(<BaFilter graph={makeGraph()} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Filtrer OCAPPI' }));
    expect(useAppStore.getState().selectedBaCodes).toEqual(['OCAPPI']);
    expect(screen.getByText(/Filtre BA \(1\)/)).toBeInTheDocument();
  });

  it('le bouton Réinitialiser efface le filtre actif', () => {
    useAppStore.setState({ selectedBaCodes: ['OCAPPI', 'PLANET'] });
    render(<BaFilter graph={makeGraph()} />);
    expect(screen.getByText(/Filtre BA \(2\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Réinitialiser/ }));
    expect(useAppStore.getState().selectedBaCodes).toEqual([]);
  });
});
