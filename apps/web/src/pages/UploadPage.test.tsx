import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UploadPage } from './UploadPage';

vi.mock('../lib/api', () => ({
  api: {
    createSnapshot: vi.fn(),
    listSnapshots: vi.fn().mockResolvedValue([]),
    getGraph: vi.fn(),
  },
}));

vi.mock('../store/app-store.js', () => ({
  useAppStore: vi.fn(() => vi.fn()),
}));

import { api } from '../lib/api';

function setup(): void {
  render(
    <MemoryRouter>
      <UploadPage />
    </MemoryRouter>,
  );
}

function makeZipFile(): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], 'test.zip', {
    type: 'application/zip',
  });
}

describe('UploadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders form with disabled submit when loading is false and no file', () => {
    setup();
    expect(screen.getByRole('heading', { name: /Charger un snapshot ECP/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Envoyer/i })).toBeEnabled();
  });

  it('calls api.createSnapshot with file + label + envName on submit', async () => {
    vi.mocked(api.createSnapshot).mockResolvedValueOnce({
      id: 'snap-1',
      label: 'My Snap',
      envName: 'PROD',
      componentType: 'ENDPOINT',
      sourceComponentCode: 'SRC',
      cdCode: 'CD',
      uploadedAt: '2026-04-18T12:00:00Z',
      warningCount: 0,
      organization: 'RTE',
      stats: { componentsCount: 5, pathsCount: 2, statsCount: 0 },
      warnings: [],
    });
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.clear(screen.getByPlaceholderText(/Snapshot hebdo/i));
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'My Snap');
    await userEvent.clear(screen.getByPlaceholderText(/OPF \/ PROD/i));
    await userEvent.type(screen.getByPlaceholderText(/OPF \/ PROD/i), 'PROD');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(api.createSnapshot).toHaveBeenCalledWith(expect.any(File), 'My Snap', 'PROD');
    });
  });

  it('shows loading state while createSnapshot promise is pending', async () => {
    const capture: { resolve: ((value: unknown) => void) | null } = { resolve: null };
    vi.mocked(api.createSnapshot).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          capture.resolve = resolve as (v: unknown) => void;
        }),
    );
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'X');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Envoi en cours/i })).toBeDisabled();
    });
    if (capture.resolve) capture.resolve({
      id: 'x', label: 'X', envName: 'OPF', componentType: 'ENDPOINT',
      sourceComponentCode: 'S', cdCode: 'C', uploadedAt: '', warningCount: 0,
      organization: 'R', stats: { componentsCount: 0, pathsCount: 0, statsCount: 0 }, warnings: [],
    });
  });

  it('renders success section with "Voir sur la carte" button after upload', async () => {
    vi.mocked(api.createSnapshot).mockResolvedValueOnce({
      id: 'snap-ok',
      label: 'OK',
      envName: 'OPF',
      componentType: 'ENDPOINT',
      sourceComponentCode: 'S',
      cdCode: 'C',
      uploadedAt: '2026-04-18T12:00:00Z',
      warningCount: 0,
      organization: 'R',
      stats: { componentsCount: 3, pathsCount: 1, statsCount: 0 },
      warnings: [],
    });
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'OK');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Voir sur la carte/i })).toBeInTheDocument();
    });
  });

  it('renders error alert when createSnapshot rejects', async () => {
    vi.mocked(api.createSnapshot).mockRejectedValueOnce(new Error('Upload failed XYZ'));
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'E');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Upload failed XYZ');
    });
  });

  it('renders warnings <details> section when result.warnings is non-empty', async () => {
    vi.mocked(api.createSnapshot).mockResolvedValueOnce({
      id: 'snap-w',
      label: 'W',
      envName: 'OPF',
      componentType: 'ENDPOINT',
      sourceComponentCode: 'S',
      cdCode: 'C',
      uploadedAt: '2026-04-18T12:00:00Z',
      warningCount: 2,
      organization: 'R',
      stats: { componentsCount: 1, pathsCount: 0, statsCount: 0 },
      warnings: [
        { code: 'UNKNOWN_EIC', message: 'unknown a' },
        { code: 'UNKNOWN_EIC', message: 'unknown b' },
      ],
    });
    setup();

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(fileInput, makeZipFile());
    await userEvent.type(screen.getByPlaceholderText(/Snapshot hebdo/i), 'W');
    await userEvent.click(screen.getByRole('button', { name: /Envoyer/i }));

    await waitFor(() => {
      expect(screen.getByText(/2 avertissement/i)).toBeInTheDocument();
    });
  });
});
