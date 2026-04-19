import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ComponentOverrideModal } from './ComponentOverrideModal.js';
import { api } from '../../lib/api.js';

vi.mock('../../lib/api.js', () => ({
  api: {
    upsertOverride: vi.fn().mockResolvedValue({}),
    deleteOverride: vi.fn().mockResolvedValue(undefined),
    listAdminComponents: vi.fn(),
    listEnvs: vi.fn(),
    listImports: vi.fn(),
    getGraph: vi.fn(),
    createImport: vi.fn(),
    inspectBatch: vi.fn(),
    updateImport: vi.fn(),
    deleteImport: vi.fn(),
  },
}));

function fakeRow(overrides: Partial<any> = {}): any {
  return {
    eic: '17V-TEST',
    current: {
      displayName: 'Current Name', type: 'ENDPOINT',
      organization: 'CurrentOrg', country: 'FR',
      lat: 48.85, lng: 2.35, isDefaultPosition: false,
    },
    override: null,
    importsCount: 1,
    ...overrides,
  };
}

describe('ComponentOverrideModal', () => {
  beforeEach(() => {
    vi.mocked(api.upsertOverride).mockReset();
    vi.mocked(api.deleteOverride).mockReset();
    vi.mocked(api.upsertOverride).mockResolvedValue({});
    vi.mocked(api.deleteOverride).mockResolvedValue(undefined);
  });

  it('renders title with EIC and placeholders from current cascade', () => {
    const row = fakeRow();
    render(<ComponentOverrideModal row={row} onClose={() => {}} onSaved={async () => {}} />);
    expect(screen.getByRole('heading', { name: /Surcharge pour 17V-TEST/i })).toBeInTheDocument();
    const nameInput = screen.getByLabelText(/Nom affiché/i) as HTMLInputElement;
    expect(nameInput.placeholder).toContain('Current Name');
  });

  it('calls api.upsertOverride with only modified fields on save', async () => {
    const row = fakeRow();
    const onSaved = vi.fn(async () => {});
    render(<ComponentOverrideModal row={row} onClose={() => {}} onSaved={onSaved} />);
    const nameInput = screen.getByLabelText(/Nom affiché/i);
    await userEvent.type(nameInput, 'New Name');
    const saveBtn = screen.getByRole('button', { name: /Enregistrer/i });
    await userEvent.click(saveBtn);
    expect(api.upsertOverride).toHaveBeenCalledWith('17V-TEST', expect.objectContaining({ displayName: 'New Name' }));
    expect(onSaved).toHaveBeenCalled();
  });

  it('shows "Retirer surcharge" button only when override exists', () => {
    const rowNoOverride = fakeRow({ override: null });
    const { rerender } = render(<ComponentOverrideModal row={rowNoOverride} onClose={() => {}} onSaved={async () => {}} />);
    expect(screen.queryByRole('button', { name: /Retirer surcharge/i })).not.toBeInTheDocument();

    const rowWithOverride = fakeRow({
      override: {
        displayName: 'Custom', type: null, organization: null, country: null,
        lat: null, lng: null, tagsCsv: null, notes: null,
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
    });
    rerender(<ComponentOverrideModal row={rowWithOverride} onClose={() => {}} onSaved={async () => {}} />);
    expect(screen.getByRole('button', { name: /Retirer surcharge/i })).toBeInTheDocument();
  });

  it('calls api.deleteOverride on "Retirer surcharge" click (with confirm)', async () => {
    const rowWithOverride = fakeRow({
      override: {
        displayName: 'Custom', type: null, organization: null, country: null,
        lat: null, lng: null, tagsCsv: null, notes: null,
        updatedAt: '2026-04-20T00:00:00.000Z',
      },
    });
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);

    const onSaved = vi.fn(async () => {});
    render(<ComponentOverrideModal row={rowWithOverride} onClose={() => {}} onSaved={onSaved} />);
    const removeBtn = screen.getByRole('button', { name: /Retirer surcharge/i });
    await userEvent.click(removeBtn);
    expect(api.deleteOverride).toHaveBeenCalledWith('17V-TEST');

    window.confirm = originalConfirm;
  });
});
