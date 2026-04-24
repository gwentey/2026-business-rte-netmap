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

describe('BaFilter (select criticité — design carto-rte v2)', () => {
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

  it('rend le label "Filtre BA" et un select avec 4 options', () => {
    render(<BaFilter graph={makeGraph()} />);
    expect(screen.getByText('Filtre BA')).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: /criticité/i });
    expect(select).toBeInTheDocument();
    const options = Array.from(select.querySelectorAll('option'));
    expect(options.map((o) => o.value)).toEqual(['ALL', 'P1', 'P2', 'P3']);
  });

  it('sélectionner P1 ajoute toutes les BAs P1 au store', () => {
    render(<BaFilter graph={makeGraph()} />);
    const select = screen.getByRole('combobox', { name: /criticité/i });
    fireEvent.change(select, { target: { value: 'P1' } });
    expect(useAppStore.getState().selectedBaCodes).toEqual(['OCAPPI']);
  });

  it('sélectionner ALL efface le filtre actif', () => {
    useAppStore.setState({ selectedBaCodes: ['OCAPPI'] });
    render(<BaFilter graph={makeGraph()} />);
    const select = screen.getByRole('combobox', { name: /criticité/i });
    fireEvent.change(select, { target: { value: 'ALL' } });
    expect(useAppStore.getState().selectedBaCodes).toEqual([]);
  });
});
