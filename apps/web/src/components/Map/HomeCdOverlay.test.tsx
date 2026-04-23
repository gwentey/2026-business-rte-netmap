import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { MapContainer } from 'react-leaflet';
import type { GraphNode } from '@carto-ecp/shared';
import { HomeCdOverlay } from './HomeCdOverlay';

/**
 * Tests de rendu fin du overlay : on vérifie la logique d'appariement
 * endpoint→homeCD plutôt que le dessin pixel. Les Polyline de Leaflet
 * produisent des <path> SVG — on compte les occurrences.
 */

function nodeOf(overrides: Partial<GraphNode>): GraphNode {
  return {
    id: overrides.eic ?? 'n',
    eic: overrides.eic ?? 'n',
    displayName: overrides.displayName ?? 'n',
    projectName: null,
    envName: 'X',
    organization: 'Org',
    personName: null,
    email: null,
    phone: null,
    homeCdCode: overrides.homeCdCode ?? null,
    status: null,
    appTheme: null,
    lastSync: null,
    sentMessages: null,
    receivedMessages: null,
    uploadTargets: [],
    interlocutors: [],
    businessApplications: [],
    country: null,
    lat: overrides.lat ?? 48,
    lng: overrides.lng ?? 2,
    kind: overrides.kind ?? 'RTE_ENDPOINT',
    process: null,
    networks: [],
    creationTs: '2026-01-01T00:00:00Z',
    modificationTs: '2026-01-02T00:00:00Z',
    urls: [],
    isDefaultPosition: false,
    ...overrides,
  };
}

function renderInMap(children: React.ReactNode): HTMLElement {
  const { container } = render(
    <MapContainer center={[50, 5]} zoom={4} style={{ height: 100, width: 100 }}>
      {children}
    </MapContainer>,
  );
  return container;
}

describe('HomeCdOverlay', () => {
  it('renders nothing when visible is false', () => {
    const nodes = new Map<string, GraphNode>([
      ['A', nodeOf({ eic: 'A', homeCdCode: 'CD1' })],
      ['CD1', nodeOf({ eic: 'CD1', kind: 'RTE_CD' })],
    ]);
    const container = renderInMap(<HomeCdOverlay nodes={nodes} visible={false} />);
    // leaflet interactive paths : 0 pour les liens overlay (non-interactifs mais visibles)
    expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBe(0);
  });

  it('renders nothing when no node has a homeCdCode', () => {
    const nodes = new Map<string, GraphNode>([
      ['A', nodeOf({ eic: 'A' })],
      ['B', nodeOf({ eic: 'B' })],
    ]);
    const container = renderInMap(<HomeCdOverlay nodes={nodes} visible={true} />);
    expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBe(0);
  });

  it('renders a polyline for each endpoint whose homeCd is in the current graph', () => {
    const nodes = new Map<string, GraphNode>([
      ['EP1', nodeOf({ eic: 'EP1', homeCdCode: 'CD1' })],
      ['EP2', nodeOf({ eic: 'EP2', homeCdCode: 'CD1' })],
      ['EP3', nodeOf({ eic: 'EP3', homeCdCode: 'CD_ABSENT' })],
      ['CD1', nodeOf({ eic: 'CD1', kind: 'RTE_CD' })],
    ]);
    const container = renderInMap(<HomeCdOverlay nodes={nodes} visible={true} />);
    // 2 liens rendus : EP1 → CD1, EP2 → CD1. EP3 skipped car CD_ABSENT pas dans nodes.
    expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBe(2);
  });

  it('skips self-reference when a CD declares itself as its own home', () => {
    const nodes = new Map<string, GraphNode>([
      ['CD1', nodeOf({ eic: 'CD1', kind: 'RTE_CD', homeCdCode: 'CD1' })],
    ]);
    const container = renderInMap(<HomeCdOverlay nodes={nodes} visible={true} />);
    expect(container.querySelectorAll('.leaflet-overlay-pane path').length).toBe(0);
  });
});
