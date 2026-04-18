import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GraphResponse, SnapshotSummary } from '@carto-ecp/shared';
import { api } from '../lib/api.js';

type AppState = {
  activeSnapshotId: string | null;
  snapshots: SnapshotSummary[];
  graph: GraphResponse | null;
  selectedNodeEic: string | null;
  selectedEdgeId: string | null;
  loading: boolean;
  error: string | null;

  loadSnapshots: () => Promise<void>;
  setActiveSnapshot: (id: string) => Promise<void>;
  selectNode: (eic: string | null) => void;
  selectEdge: (id: string | null) => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeSnapshotId: null,
      snapshots: [],
      graph: null,
      selectedNodeEic: null,
      selectedEdgeId: null,
      loading: false,
      error: null,

      loadSnapshots: async () => {
        set({ loading: true, error: null });
        try {
          const list = await api.listSnapshots();
          set({ snapshots: list, loading: false });
          const id = get().activeSnapshotId;
          const persistedStillValid = id !== null && list.some((s) => s.id === id);

          if (persistedStillValid) {
            await get().setActiveSnapshot(id);
          } else if (list.length > 0) {
            await get().setActiveSnapshot(list[0]!.id);
          }
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      setActiveSnapshot: async (id: string) => {
        set({ loading: true, error: null, selectedNodeEic: null, selectedEdgeId: null });
        try {
          const graph = await api.getGraph(id);
          set({ activeSnapshotId: id, graph, loading: false });
        } catch (err) {
          set({ loading: false, error: (err as Error).message });
        }
      },

      selectNode: (eic) => set({ selectedNodeEic: eic, selectedEdgeId: null }),
      selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeEic: null }),
    }),
    {
      name: 'carto-ecp-store',
      partialize: (s) => ({ activeSnapshotId: s.activeSnapshotId }),
    },
  ),
);
