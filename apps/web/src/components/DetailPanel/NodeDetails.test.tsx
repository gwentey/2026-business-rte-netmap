import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NodeDetails } from './NodeDetails';
import type { GraphNode } from '@carto-ecp/shared';

function baseNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'node-1',
    eic: '17V000000498771C',
    displayName: 'INTERNET-2',
    projectName: null,
    envName: 'PFRFI',
    organization: 'RTE',
    personName: null,
    email: null,
    phone: null,
    homeCdCode: null,
    status: null,
    appTheme: null,
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

  it('displays the projectName chip when it differs from displayName', () => {
    render(
      <NodeDetails
        node={baseNode({ displayName: 'Paris-Est RTE', projectName: 'INTERNET-EP2' })}
      />,
    );
    expect(screen.getByText(/Projet ECP/i)).toBeInTheDocument();
    expect(screen.getByText('INTERNET-EP2')).toBeInTheDocument();
  });

  it('hides the projectName chip when displayName already equals projectName', () => {
    render(
      <NodeDetails
        node={baseNode({ displayName: 'INTERNET-EP2', projectName: 'INTERNET-EP2' })}
      />,
    );
    expect(screen.queryByText(/Projet ECP/i)).not.toBeInTheDocument();
  });

  it('renders envName row from Import meta', () => {
    render(<NodeDetails node={baseNode({ envName: 'PFRFI' })} />);
    expect(screen.getByText('Environnement')).toBeInTheDocument();
    expect(screen.getByText('PFRFI')).toBeInTheDocument();
  });

  it('renders Contact section with mailto and tel links when populated', () => {
    render(
      <NodeDetails
        node={baseNode({
          personName: 'Jane Doe',
          email: 'jane@rte-france.com',
          phone: '0033612345678',
        })}
      />,
    );
    expect(screen.getByText('Contact')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    const mail = screen.getByRole('link', { name: 'jane@rte-france.com' });
    expect(mail).toHaveAttribute('href', 'mailto:jane@rte-france.com');
    const tel = screen.getByRole('link', { name: '0033612345678' });
    expect(tel).toHaveAttribute('href', 'tel:0033612345678');
  });

  it('hides Contact section when all contact fields are null', () => {
    render(<NodeDetails node={baseNode()} />);
    expect(screen.queryByText('Contact')).not.toBeInTheDocument();
  });

  it('renders Config section with status badge when status is known', () => {
    render(<NodeDetails node={baseNode({ status: 'ACTIVE', appTheme: 'WHITE' })} />);
    expect(screen.getByText('Config ECP')).toBeInTheDocument();
    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('WHITE')).toBeInTheDocument();
  });

  it('renders homeCdCode as plain text when the CD is not in current env', () => {
    render(<NodeDetails node={baseNode({ homeCdCode: '17V000002014106G' })} />);
    expect(screen.getByText('17V000002014106G')).toBeInTheDocument();
    // Pas de bouton tant que le CD node n'est pas dans le graph store
    expect(screen.queryByRole('button', { name: /Aller à/ })).not.toBeInTheDocument();
  });
});
