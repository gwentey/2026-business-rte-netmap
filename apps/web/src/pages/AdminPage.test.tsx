import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage.js';

// Mock children so AdminPage tests stay pure (no store/api setup).
vi.mock('../components/Admin/ImportsAdminTable.js', () => ({
  ImportsAdminTable: () => <div data-testid="imports-admin-table">Imports Table</div>,
}));
vi.mock('../components/Admin/EntsoeAdminTab.js', () => ({
  EntsoeAdminTab: () => <div data-testid="entsoe-admin-tab">ENTSO-E Tab</div>,
}));
vi.mock('../components/Admin/DangerZoneTab.js', () => ({
  DangerZoneTab: () => <div data-testid="danger-zone-tab">Danger Tab</div>,
}));
vi.mock('../components/Admin/ComponentsAdminTable.js', () => ({
  ComponentsAdminTable: ({ autoOpenEic }: { autoOpenEic?: string | null }) => (
    <div data-testid="components-admin-table">
      ComponentsTable autoOpenEic={autoOpenEic ?? 'null'}
    </div>
  ),
}));
vi.mock('../components/Admin/RegistryAdminTab.js', () => ({
  RegistryAdminTab: ({ onEditComponent }: { onEditComponent: (eic: string) => void }) => (
    <div data-testid="registry-admin-tab">
      <button type="button" onClick={() => onEditComponent('17V-FROM-REGISTRY')}>
        mock-edit
      </button>
    </div>
  ),
}));

describe('AdminPage', () => {
  it('renders title, tabs, and ImportsAdminTable by default', () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(screen.getByText(/Administration/i)).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByTestId('imports-admin-table')).toBeInTheDocument();
  });

  it('switches to Components tab with autoOpenEic when onEditComponent is invoked from Registry', async () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    // Navigate to Registry tab first
    await userEvent.click(screen.getByRole('button', { name: /Registry RTE/i }));
    expect(screen.getByTestId('registry-admin-tab')).toBeInTheDocument();
    // Trigger onEditComponent from the mock
    await userEvent.click(screen.getByRole('button', { name: /mock-edit/i }));
    // Now components tab must be visible with the EIC forwarded
    expect(screen.getByTestId('components-admin-table')).toHaveTextContent('17V-FROM-REGISTRY');
  });
});
