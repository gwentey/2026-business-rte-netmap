import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminTabs } from './AdminTabs.js';

describe('AdminTabs', () => {
  it('renders 5 tabs with only Imports enabled', () => {
    render(<AdminTabs active="imports" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /Imports/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Composants/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Annuaire ENTSO-E/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Registry RTE/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Zone danger/i })).toBeDisabled();
  });

  it('calls onChange with the clicked tab id for enabled tabs', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /Imports/i }));
    expect(onChange).toHaveBeenCalledWith('imports');
  });

  it('does not call onChange for disabled tabs', async () => {
    const onChange = vi.fn();
    render(<AdminTabs active="imports" onChange={onChange} />);
    const componentsTab = screen.getByRole('button', { name: /Composants/i });
    await userEvent.click(componentsTab).catch(() => {});
    expect(onChange).not.toHaveBeenCalled();
  });
});
