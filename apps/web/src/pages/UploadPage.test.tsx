import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UploadPage } from './UploadPage';

vi.mock('../lib/api.js', () => ({
  api: {
    createImport: vi.fn(),
    listEnvs: vi.fn().mockResolvedValue([]),
  },
}));

const mockLoadEnvs = vi.fn().mockResolvedValue(undefined);

vi.mock('../store/app-store.js', () => ({
  useAppStore: vi.fn((selector: (s: { loadEnvs: () => Promise<void> }) => unknown) =>
    selector({ loadEnvs: mockLoadEnvs }),
  ),
}));

import { api } from '../lib/api.js';

function setup(initialPath = '/upload'): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <UploadPage />
    </MemoryRouter>,
  );
}

function makeZipFile(): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'test.zip', {
    type: 'application/zip',
  });
}

function makeImportDetail(overrides: Partial<{
  id: string;
  label: string;
  envName: string;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  warnings: { code: string; message: string }[];
  stats: { componentsCount: number; pathsCount: number; messagingStatsCount: number };
}> = {}): {
  id: string;
  envName: string;
  label: string;
  fileName: string;
  dumpType: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';
  sourceComponentEic: null;
  sourceDumpTimestamp: null;
  uploadedAt: string;
  effectiveDate: string;
  warnings: { code: string; message: string }[];
  stats: { componentsCount: number; pathsCount: number; messagingStatsCount: number };
} {
  return {
    id: 'import-1',
    envName: 'OPF',
    label: 'My Import',
    fileName: 'test.zip',
    dumpType: 'ENDPOINT',
    sourceComponentEic: null,
    sourceDumpTimestamp: null,
    uploadedAt: '2026-04-18T12:00:00Z',
    effectiveDate: '2026-04-18T12:00:00Z',
    warnings: [],
    stats: { componentsCount: 5, pathsCount: 2, messagingStatsCount: 0 },
    ...overrides,
  };
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadEnvs.mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders form with correct heading and enabled submit button', () => {
    setup();
    expect(screen.getByRole('heading', { name: /Importer un dump ECP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Importer/i })).toBeEnabled();
  });

  it('initialises envName from ?env= query param', () => {
    setup('/upload?env=PROD');
    const envInput = screen.getByPlaceholderText(/OPF \/ PROD/i) as HTMLInputElement;
    expect(envInput.value).toBe('PROD');
  });

  it('defaults envName to OPF when no query param', () => {
    setup();
    const envInput = screen.getByPlaceholderText(/OPF \/ PROD/i) as HTMLInputElement;
    expect(envInput.value).toBe('OPF');
  });

  it('calls api.createImport with file + envName + label on submit', async () => {
    vi.mocked(api.createImport).mockResolvedValueOnce(makeImportDetail({ label: 'My Import', envName: 'PROD' }));
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.clear(screen.getByPlaceholderText(/Semaine 15/i));
    await userEvent.type(screen.getByPlaceholderText(/Semaine 15/i), 'My Import');
    await userEvent.clear(screen.getByPlaceholderText(/OPF \/ PROD/i));
    await userEvent.type(screen.getByPlaceholderText(/OPF \/ PROD/i), 'PROD');
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(api.createImport).toHaveBeenCalledWith(expect.any(File), 'PROD', 'My Import');
    });
  });

  it('calls loadEnvs after successful import', async () => {
    vi.mocked(api.createImport).mockResolvedValueOnce(makeImportDetail());
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Semaine 15/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(mockLoadEnvs).toHaveBeenCalledOnce();
    });
  });

  it('shows loading state while createImport promise is pending', async () => {
    const capture: { resolve: ((value: unknown) => void) | null } = { resolve: null };
    vi.mocked(api.createImport).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          capture.resolve = resolve as (v: unknown) => void;
        }),
    );
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Semaine 15/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Envoi en cours/i })).toBeDisabled();
    });
    if (capture.resolve) capture.resolve(makeImportDetail());
  });

  it('renders success section with "Voir sur la carte" button after upload', async () => {
    vi.mocked(api.createImport).mockResolvedValueOnce(makeImportDetail({ label: 'OK', stats: { componentsCount: 3, pathsCount: 1, messagingStatsCount: 0 } }));
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Semaine 15/i), 'OK');
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voir sur la carte/i })).toBeInTheDocument();
    });
  });

  it('renders error alert when createImport rejects', async () => {
    vi.mocked(api.createImport).mockRejectedValueOnce(new Error('Upload failed XYZ'));
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Semaine 15/i), 'E');
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Upload failed XYZ');
    });
  });

  it('renders warnings <details> section when result.warnings is non-empty', async () => {
    vi.mocked(api.createImport).mockResolvedValueOnce(
      makeImportDetail({
        label: 'W',
        warnings: [
          { code: 'UNKNOWN_EIC', message: 'unknown a' },
          { code: 'UNKNOWN_EIC', message: 'unknown b' },
        ],
        stats: { componentsCount: 1, pathsCount: 0, messagingStatsCount: 0 },
      }),
    );
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Semaine 15/i), 'W');
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 avertissement/i)).toBeInTheDocument();
    });
  });

  it('shows validation error when submitting without required fields', async () => {
    setup();
    await userEvent.click(screen.getByRole('button', { name: /Importer/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Fichier, label et environnement sont requis');
    });
    expect(api.createImport).not.toHaveBeenCalled();
  });
});
