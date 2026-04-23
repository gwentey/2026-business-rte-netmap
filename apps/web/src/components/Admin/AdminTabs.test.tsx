import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminTabs } from './AdminTabs.js';

describe('AdminTabs', () => {
  it('renders 6 tabs (Imports, Composants, Organisations, ENTSO-E, Registry, Zone danger) tous enabled', () => {
    render(<AdminTabs active="imports" onChange={() => {}} />);
    expect(screen.getByRole('tab', { name: /Imports/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /Composants/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /Organisations/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /Annuaire ENTSO-E/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /Registry RTE/i })).toBeEnabled();
    expect(screen.getByRole('tab', { name: /Zone danger/i })).toBeEnabled();
  });

  it('calls onChange with the clicked tab id for enabled tabs', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /Imports/i }));
    expect(onChange).toHaveBeenCalledWith('imports');
  });

  it('calls onChange when clicking the Registry RTE tab (now enabled)', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    await userEvent.click(screen.getByRole('tab', { name: /Registry RTE/i }));
    expect(onChange).toHaveBeenCalledWith('registry');
  });
});
