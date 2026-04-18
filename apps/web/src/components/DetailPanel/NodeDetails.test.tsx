import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodeDetails } from './NodeDetails';
import type { GraphNode } from '@carto-ecp/shared';

function baseNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'node-1',
    eic: '17V000000498771C',
    displayName: 'INTERNET-2',
    organization: 'RTE',
    country: 'FR',
    lat: 48.89,
    lng: 2.34,
    kind: 'RTE_ENDPOINT',
    process: 'TP',
    networks: ['TP', 'CORE'],
    creationTs: '2025-01-01T00:00:00Z',
    modificationTs: '2025-01-02T00:00:00Z',
    urls: [],
    isDefaultPosition: false,
    ...overrides,
  };
}

describe('NodeDetails', () => {
  it('renders all core fields from a fully populated node', () => {
    render(<NodeDetails node={baseNode()} />);
    expect(screen.getByRole('heading', { name: /INTERNET-2/ })).toBeInTheDocument();
    expect(screen.getByText('17V000000498771C')).toBeInTheDocument();
    expect(screen.getByText('RTE_ENDPOINT')).toBeInTheDocument();
    expect(screen.getByText('RTE')).toBeInTheDocument();
    expect(screen.getByText('FR')).toBeInTheDocument();
    expect(screen.getByText('TP, CORE')).toBeInTheDocument();
    expect(screen.getByText('TP')).toBeInTheDocument();
  });

  it('renders "—" placeholder when country is null', () => {
    render(<NodeDetails node={baseNode({ country: null })} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders "—" placeholder when networks is empty', () => {
    render(<NodeDetails node={baseNode({ networks: [] })} />);
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows default-position warning banner when isDefaultPosition is true', () => {
    render(<NodeDetails node={baseNode({ isDefaultPosition: true })} />);
    expect(screen.getByText(/Position par défaut/i)).toBeInTheDocument();
  });

  it('renders URLs section only when node.urls is non-empty', () => {
    const { rerender } = render(<NodeDetails node={baseNode({ urls: [] })} />);
    expect(screen.queryByRole('heading', { name: /URLs/i })).not.toBeInTheDocument();

    rerender(
      <NodeDetails
        node={baseNode({ urls: [{ network: 'TP', url: 'http://example.com' }] })}
      />,
    );
    expect(screen.getByRole('heading', { name: /URLs/i })).toBeInTheDocument();
    expect(screen.getByText('http://example.com', { exact: false })).toBeInTheDocument();
  });
});
