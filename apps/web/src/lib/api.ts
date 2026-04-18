import type { GraphResponse, SnapshotDetail, SnapshotSummary } from '@carto-ecp/shared';

type JsonError = { code: string; message: string };

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as Partial<JsonError>;
    throw new Error(err.message ?? `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}

export const api = {
  listSnapshots: (envName?: string): Promise<SnapshotSummary[]> => {
    const qs = envName ? `?envName=${encodeURIComponent(envName)}` : '';
    return fetch(`/api/snapshots${qs}`).then((r) => parseJson<SnapshotSummary[]>(r));
  },
  getSnapshot: (id: string): Promise<SnapshotDetail> =>
    fetch(`/api/snapshots/${id}`).then((r) => parseJson<SnapshotDetail>(r)),
  getGraph: (id: string): Promise<GraphResponse> =>
    fetch(`/api/snapshots/${id}/graph`).then((r) => parseJson<GraphResponse>(r)),
  createSnapshot: async (file: File, label: string, envName: string): Promise<SnapshotDetail> => {
    const form = new FormData();
    form.append('zip', file);
    form.append('label', label);
    form.append('envName', envName);
    const res = await fetch('/api/snapshots', { method: 'POST', body: form });
    return parseJson<SnapshotDetail>(res);
  },
};
