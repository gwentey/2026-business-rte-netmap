import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AdminPage } from './AdminPage.js';

// Mock ImportsAdminTable pour que le test AdminPage n'ait pas besoin de setup store/api
vi.mock('../components/Admin/ImportsAdminTable.js', () => ({
  ImportsAdminTable: () => <div data-testid="imports-admin-table">Imports Table</div>,
}));

describe('AdminPage', () => {
  it('renders title, tabs, and ImportsAdminTable by default', () => {
    render(<MemoryRouter><AdminPage /></MemoryRouter>);
    expect(screen.getByText(/Administration/i)).toBeInTheDocument();
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByTestId('imports-admin-table')).toBeInTheDocument();
  });
});
