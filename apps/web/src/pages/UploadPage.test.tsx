import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { UploadPage } from './UploadPage.js';
import { useAppStore } from '../store/app-store.js';

vi.mock('../lib/api.js', () => ({
  api: {
    inspectBatch: vi.fn(),
    createImport: vi.fn(),
    listEnvs: vi.fn().mockResolvedValue([]),
    listImports: vi.fn().mockResolvedValue([]),
    getGraph: vi.fn(),
  },
}));

describe('UploadPage', () => {
  beforeEach(() => {
    useAppStore.setState({
      activeEnv: null, envs: [], imports: [], graph: null,
      selectedNodeEic: null, selectedEdgeId: null,
      loading: false, error: null,
      uploadBatch: [], uploadInProgress: false,
    });
  });

  it('renders the dropzone and env input', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByText(/Importer des dumps ECP/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Glissez/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Environnement/i)).toBeInTheDocument();
  });

  it('pre-fills envName from ?env=X query param', () => {
    render(
      <MemoryRouter initialEntries={['/upload?env=PROD']}>
        <UploadPage />
      </MemoryRouter>,
    );
    expect((screen.getByLabelText(/Environnement/i) as HTMLInputElement).value).toBe('PROD');
  });

  it('defaults envName to OPF if no query param', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect((screen.getByLabelText(/Environnement/i) as HTMLInputElement).value).toBe('OPF');
  });

  it('import button is disabled when batch is empty', () => {
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Importer tout/i })).toBeDisabled();
  });

  it('import button is enabled when at least one item is inspected and not skipped', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1, label: 'x', forceReplace: false, state: 'inspected', dumpType: 'ENDPOINT' } as any,
      ],
    });
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByRole('button', { name: /Importer tout/i })).toBeEnabled();
  });

  it('displays summary after submitBatch completes', () => {
    useAppStore.setState({
      uploadBatch: [
        { id: '1', file: new File([], 'a.zip'), fileName: 'a.zip', fileSize: 1, label: 'x', forceReplace: false, state: 'done', createdImportId: 'new-id' } as any,
        { id: '2', file: new File([], 'b.zip'), fileName: 'b.zip', fileSize: 1, label: 'y', forceReplace: false, state: 'error', errorCode: 'INVALID_MAGIC' } as any,
      ],
      uploadInProgress: false,
    });
    render(<MemoryRouter><UploadPage /></MemoryRouter>);
    expect(screen.getByText(/1 créé/i)).toBeInTheDocument();
    expect(screen.getByText(/1 échec/i)).toBeInTheDocument();
  });
});
