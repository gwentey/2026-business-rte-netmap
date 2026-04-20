import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminTabs } from './AdminTabs.js';

describe('AdminTabs', () => {
  it('renders 5 tabs with Imports, Composants, ENTSO-E, Registry et Zone danger tous enabled', () => {
    render(<AdminTabs active="imports" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Imports/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Composants/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Annuaire ENTSO-E/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Registry RTE/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Zone danger/i })).toBeEnabled();
  });

  it('calls onChange with the clicked tab id for enabled tabs', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Imports/i }));
    expect(onChange).toHaveBeenCalledWith('imports');
  });

  it('calls onChange when clicking the Registry RTE tab (now enabled)', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Registry RTE/i }));
    expect(onChange).toHaveBeenCalledWith('registry');
  });
});
