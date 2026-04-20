import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RegistryAdminTab } from './RegistryAdminTab.js';

vi.mock('./ProcessColorsEditor.js', () => ({
  ProcessColorsEditor: () => <div data-testid="colors-editor">Colors</div>,
}));

vi.mock('./RteEndpointsTable.js', () => ({
  RteEndpointsTable: ({ onEdit }: { onEdit: (eic: string) => void }) => (
    <button type="button" onClick={() => onEdit('17V-TEST-EIC')}>
      mock-trigger-edit
    </button>
  ),
}));

describe('RegistryAdminTab', () => {
  it('renders both sections and forwards onEdit from RteEndpointsTable to onEditComponent', async () => {
    const onEditComponent = vi.fn();
    render(<RegistryAdminTab onEditComponent={onEditComponent} />);
    expect(screen.getByText(/Couleurs des process/i)).toBeInTheDocument();
    expect(screen.getByText(/Endpoints RTE/i)).toBeInTheDocument();
    expect(screen.getByTestId('colors-editor')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /mock-trigger-edit/i }));
    expect(onEditComponent).toHaveBeenCalledWith('17V-TEST-EIC');
  });
});
