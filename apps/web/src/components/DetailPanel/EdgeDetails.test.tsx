import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EdgeDetails } from './EdgeDetails';
import type { GraphEdge } from '@carto-ecp/shared';

function baseEdge(overrides: Partial<GraphEdge> = {}): GraphEdge {
  return {
    id: 'eic1::eic2',
    fromEic: '17V000000498771C',
    toEic: '10X1001A1001A345',
    process: 'TP',
    direction: 'OUT',
    transportPatterns: ['DIRECT'],
    intermediateBrokerEic: null,
    messageTypes: ['msg-type-a', 'msg-type-b'],
    activity: {
      connectionStatus: 'CONNECTED',
      lastMessageUp: '2026-04-18T10:00:00Z',
      lastMessageDown: '2026-04-18T09:00:00Z',
      isRecent: true,
    },
    validFrom: '2025-01-01T00:00:00Z',
    validTo: '2099-12-31T00:00:00Z',
    ...overrides,
  };
}

describe('EdgeDetails', () => {
  it('renders core fields : direction, fromEic, toEic, transport, process', () => {
    render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.getByRole('heading', { name: /Flux TP/ })).toBeInTheDocument();
    expect(screen.getByText('OUT')).toBeInTheDocument();
    expect(screen.getByText('17V000000498771C')).toBeInTheDocument();
    expect(screen.getByText('10X1001A1001A345')).toBeInTheDocument();
    expect(screen.getByText('DIRECT')).toBeInTheDocument();
    expect(screen.getByText('CONNECTED')).toBeInTheDocument();
  });

  it('shows "Oui" when isRecent is true, "Non" when false', () => {
    const { rerender } = render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.getByText('Oui')).toBeInTheDocument();
    rerender(
      <EdgeDetails
        edge={baseEdge({ activity: { ...baseEdge().activity, isRecent: false } })}
      />,
    );
    expect(screen.getByText('Non')).toBeInTheDocument();
  });

  it('renders "—" when connectionStatus is null', () => {
    render(
      <EdgeDetails
        edge={baseEdge({ activity: { ...baseEdge().activity, connectionStatus: null } })}
      />,
    );
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('shows broker row only when intermediateBrokerEic is non-null', () => {
    const { rerender } = render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.queryByText('Broker')).not.toBeInTheDocument();
    rerender(<EdgeDetails edge={baseEdge({ intermediateBrokerEic: 'BROKER-EIC' })} />);
    expect(screen.getByText('Broker')).toBeInTheDocument();
    expect(screen.getByText('BROKER-EIC')).toBeInTheDocument();
  });

  it('renders messageTypes count and badges', () => {
    render(<EdgeDetails edge={baseEdge()} />);
    expect(screen.getByText(/Message types \(2\)/i)).toBeInTheDocument();
    expect(screen.getByText('msg-type-a')).toBeInTheDocument();
    expect(screen.getByText('msg-type-b')).toBeInTheDocument();
  });
});
