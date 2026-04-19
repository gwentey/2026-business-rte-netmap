import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphResponse, ImportSummary } from '@carto-ecp/shared';
import { api } from '../lib/api.js';

type AppState = {
  activeEnv: string | null;
  envs: string[];
  imports: ImportSummary[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;

  loadEnvs: () => Promise<void>;
  setActiveEnv: (env: string) => Promise<void>;
  loadImports: (env: string) => Promise<void>;
  loadGraph: (env: string, refDate?: Date) => Promise<void>;
  selectNode: (eic: string | null) => void;
  selectEdge: (id: string | null) => void;
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
    }),
    {
      name: 'carto-ecp-store',
      partialize: (s) => ({ activeEnv: s.activeEnv }),
    },
  ),
);
