import type {
  GraphResponse,
  ImportDetail,
  ImportSummary,
  InspectResult,
  AdminComponentRow,
  OverrideUpsertInput,
} from '@carto-ecp/shared';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  async listEnvs(): Promise<string[]> {
    return request<string[]>('/api/envs');
  },

  async listImports(env?: string): Promise<ImportDetail[]> {
    const query = env ? `?env=${encodeURIComponent(env)}` : '';
    return request<ImportDetail[]>(`/api/imports${query}`);
  },

  async createImport(
    file: File,
    envName: string,
    label: string,
    dumpType?: 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER',
    replaceImportId?: string,
  ): Promise<ImportDetail> {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('envName', envName);
    fd.append('label', label);
    if (dumpType) fd.append('dumpType', dumpType);
    if (replaceImportId) fd.append('replaceImportId', replaceImportId);
    return request<ImportDetail>('/api/imports', { method: 'POST', body: fd });
  },

  async updateImport(
    id: string,
    patch: { label?: string; effectiveDate?: string },
  ): Promise<ImportDetail> {
    return request<ImportDetail>(`/api/imports/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },

  async inspectBatch(files: File[], envName?: string): Promise<InspectResult[]> {
    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    if (envName) fd.append('envName', envName);
    return request<InspectResult[]>('/api/imports/inspect', { method: 'POST', body: fd });
  },

  async deleteImport(id: string): Promise<void> {
    await request<void>(`/api/imports/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  async listAdminComponents(): Promise<AdminComponentRow[]> {
    return request<AdminComponentRow[]>('/api/admin/components');
  },

  async upsertOverride(eic: string, patch: OverrideUpsertInput): Promise<unknown> {
    return request<unknown>(`/api/overrides/${encodeURIComponent(eic)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
  },

  async deleteOverride(eic: string): Promise<void> {
    await request<void>(`/api/overrides/${encodeURIComponent(eic)}`, { method: 'DELETE' });
  },

  async getGraph(env: string, refDate?: Date): Promise<GraphResponse> {
    const qs = new URLSearchParams({ env });
    if (refDate) qs.set('refDate', refDate.toISOString());
    return request<GraphResponse>(`/api/graph?${qs.toString()}`);
  },
};
