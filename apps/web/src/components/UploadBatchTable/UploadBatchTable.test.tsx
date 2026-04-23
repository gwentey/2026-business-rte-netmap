import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useAppStore } from '../../store/app-store.js';
import { UploadBatchTable } from './UploadBatchTable.js';

describe('UploadBatchTable (ADR-040 — markup .file-row)', () => {
  beforeEach(() => {
    useAppStore.setState({
      uploadBatch: [],
      uploadInProgress: false,
    });
  });

  it('renders nothing when batch is empty (table is hidden)', () => {
    const { container } = render(<UploadBatchTable />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one row per batch item', () => {
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1024,
          label: 'Item A', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT', confidence: 'HIGH',
          sourceComponentEic: '17V-A', duplicateOf: null,
        } as any,
      ],
    });
    render(<UploadBatchTable />);
    expect(screen.getByText('a.zip')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Item A')).toBeInTheDocument();
    expect(screen.getByText(/17V-A/)).toBeInTheDocument();
  });

  it('shows duplicate warning and replace checkbox', () => {
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'dup', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
          duplicateOf: { importId: 'existing-id', label: 'Old label' },
        } as any,
      ],
    });
    render(<UploadBatchTable />);
    expect(screen.getByText(/Doublon/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Remplacer/i, { selector: 'input' })).toBeInTheDocument();
  });

  it('calls updateBatchItem when label is edited', async () => {
    const updateBatchItem = vi.fn();
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: 'original', forceReplace: false, state: 'inspected',
          dumpType: 'ENDPOINT',
        } as any,
      ],
      updateBatchItem,
    });
    render(<UploadBatchTable />);
    const input = screen.getByDisplayValue('original');
    await userEvent.clear(input);
    await userEvent.type(input, 'X');
    const lastCall = updateBatchItem.mock.calls[updateBatchItem.mock.calls.length - 1];
    expect(lastCall?.[0]).toBe('1');
    expect(lastCall?.[1]).toEqual({ label: 'X' });
  });

  it('shows error state with code', () => {
    useAppStore.setState({
      uploadBatch: [
        {
          id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1,
          label: '', forceReplace: false, state: 'error',
          errorCode: 'INVALID_MAGIC',
          errorMessage: 'Magic bytes invalides',
        } as any,
      ],
    });
    render(<UploadBatchTable />);
    expect(screen.getByText(/INVALID_MAGIC/)).toBeInTheDocument();
  });
});
