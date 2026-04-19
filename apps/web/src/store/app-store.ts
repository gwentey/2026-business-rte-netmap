import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphResponse, ImportDetail } from '@carto-ecp/shared';
import { api } from '../lib/api.js';

type DumpType = 'ENDPOINT' | 'COMPONENT_DIRECTORY' | 'BROKER';

type UploadBatchItem = {
  id: string;
  file: File;
  fileName: string;
  fileSize: number;
  fileHash?: string;
  sourceComponentEic?: string | null;
  sourceDumpTimestamp?: string | null;
  dumpType?: DumpType;
  confidence?: 'HIGH' | 'FALLBACK';
  label: string;
  overrideDumpType?: DumpType;
  duplicateOf?: { importId: string; label: string } | null;
  forceReplace: boolean;
  state: 'pending-inspect' | 'inspected' | 'uploading' | 'done' | 'skipped' | 'error';
  errorCode?: string;
  errorMessage?: string;
  createdImportId?: string;
};

type AppState = {
  activeEnv: string | null;
  envs: string[];
  imports: ImportDetail[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;
  uploadBatch: UploadBatchItem[];
  uploadInProgress: boolean;

  loadEnvs: () => Promise<void>;
  setActiveEnv: (env: string) => Promise<void>;
  loadImports: (env: string) => Promise<void>;
  loadGraph: (env: string, refDate?: Date) => Promise<void>;
  selectNode: (eic: string | null) => void;
  selectEdge: (id: string | null) => void;
  addBatchFiles: (files: File[]) => Promise<void>;
  removeBatchItem: (id: string) => void;
  updateBatchItem: (id: string, patch: Partial<UploadBatchItem>) => void;
  submitBatch: (envName: string) => Promise<void>;
  clearBatch: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeEnv: null,
      envs: [],
      imports: [],
      graph: null,
      selectedNodeEic: null,
      selectedEdgeId: null,
      loading: false,
      error: null,
      uploadBatch: [],
      uploadInProgress: false,

      loadEnvs: async () => {
        set({ loading: true, error: null });
        try {
          const envs = await api.listEnvs();
          set({ envs, loading: false });
          const current = get().activeEnv;
          const stillValid = current != null && envs.includes(current);
          if (stillValid) {
            await get().setActiveEnv(current);
          } else if (envs.length > 0) {
            await get().setActiveEnv(envs[0]!);
          } else {
            // Aucun env disponible — réinitialiser proprement
            set({ activeEnv: null, imports: [], graph: null });
          }
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      setActiveEnv: async (env) => {
        set({
          activeEnv: env,
          selectedNodeEic: null,
          selectedEdgeId: null,
        });
        await Promise.all([get().loadImports(env), get().loadGraph(env)]);
      },

      loadImports: async (env) => {
        try {
          const imports = await api.listImports(env);
          set({ imports });
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      loadGraph: async (env, refDate) => {
        set({ loading: true, error: null });
        try {
          const graph = await api.getGraph(env, refDate);
          set({ graph, loading: false });
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      selectNode: (eic) =>
        set({ selectedNodeEic: eic, selectedEdgeId: null }),
      selectEdge: (id) =>
        set({ selectedEdgeId: id, selectedNodeEic: null }),

      addBatchFiles: async (files) => {
        const existing = get().uploadBatch;
        const pending: UploadBatchItem[] = files.map((file) => ({
          id: crypto.randomUUID(),
          file,
          fileName: file.name,
          fileSize: file.size,
          label: '',
          forceReplace: false,
          state: 'pending-inspect',
        }));
        set({ uploadBatch: [...existing, ...pending] });

        const envName = get().activeEnv ?? undefined;
        try {
          const results = await api.inspectBatch(files, envName);
          set((s) => ({
            uploadBatch: s.uploadBatch.map((item) => {
              if (item.state !== 'pending-inspect') return item;
              const result = results.find((r) => r.fileName === item.fileName);
              if (!result) return item;
              const autoLabel = result.sourceComponentEic
                ? `${result.sourceComponentEic} · ${result.sourceDumpTimestamp?.slice(0, 10) ?? 'n/a'}`
                : item.fileName.replace(/\.zip$/i, '');
              return {
                ...item,
                fileHash: result.fileHash,
                sourceComponentEic: result.sourceComponentEic,
                sourceDumpTimestamp: result.sourceDumpTimestamp,
                dumpType: result.dumpType as DumpType | undefined,
                confidence: result.confidence as 'HIGH' | 'FALLBACK' | undefined,
                duplicateOf: result.duplicateOf,
                label: autoLabel,
                state: 'inspected' as const,
              };
            }),
          }));
        } catch (err) {
          set((s) => ({
            uploadBatch: s.uploadBatch.map((item) =>
              item.state === 'pending-inspect'
                ? { ...item, state: 'error' as const, errorCode: 'INSPECT_FAILED', errorMessage: (err as Error).message }
                : item,
            ),
          }));
        }
      },

      removeBatchItem: (id) => {
        set((s) => ({ uploadBatch: s.uploadBatch.filter((i) => i.id !== id) }));
      },

      updateBatchItem: (id, patch) => {
        set((s) => ({
          uploadBatch: s.uploadBatch.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        }));
      },

      submitBatch: async (envName) => {
        set({ uploadInProgress: true });
        const items = [...get().uploadBatch];
        for (const item of items) {
          if (item.state === 'error' || item.state === 'done' || item.state === 'skipped') continue;
          if (item.duplicateOf && !item.forceReplace) {
            get().updateBatchItem(item.id, { state: 'skipped' });
            continue;
          }
          get().updateBatchItem(item.id, { state: 'uploading' });
          try {
            const detail = await api.createImport(
              item.file,
              envName,
              item.label.trim() || item.fileName,
              item.overrideDumpType ?? item.dumpType,
              item.forceReplace ? item.duplicateOf?.importId : undefined,
            );
            get().updateBatchItem(item.id, { state: 'done', createdImportId: detail.id });
          } catch (err) {
            const msg = (err as Error).message;
            const codeMatch = /:\s*(\{[^}]*\})/.exec(msg);
            let code = 'UPLOAD_FAILED';
            try {
              if (codeMatch) {
                const parsed = JSON.parse(codeMatch[1]!) as Record<string, unknown>;
                if (typeof parsed['code'] === 'string') code = parsed['code'];
              }
            } catch { /* keep default */ }
            get().updateBatchItem(item.id, { state: 'error', errorCode: code, errorMessage: msg });
          }
        }
        set({ uploadInProgress: false });
        await get().loadEnvs();
      },

      clearBatch: () => set({ uploadBatch: [], uploadInProgress: false }),
    }),
    {
      name: 'carto-ecp-store',
      partialize: (s) => ({ activeEnv: s.activeEnv }),
    },
  ),
);
