import { create } from "zustand";

import type { Database } from "@/types/database.types";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

type LoadingSlice = {
  profile: boolean;
  tasks: boolean;
};

type AppStore = {
  xp: number;
  tasks: TaskRow[];
  loading: LoadingSlice;
  setXp: (xp: number) => void;
  setTasks: (tasks: TaskRow[]) => void;
  setLoading: (partial: Partial<LoadingSlice>) => void;
  reset: () => void;
};

const initialLoading: LoadingSlice = { profile: true, tasks: true };

/**
 * Mirrors server-backed profile + tasks for AP “state structure” alongside TanStack Query.
 * Query cache remains authoritative; this store is updated from query results in `useAppStoreSync`.
 */
export const useAppStore = create<AppStore>((set) => ({
  xp: 0,
  tasks: [],
  loading: initialLoading,
  setXp: (xp) => set({ xp }),
  setTasks: (tasks) => set({ tasks }),
  setLoading: (partial) =>
    set((s) => ({
      loading: { ...s.loading, ...partial },
    })),
  reset: () => set({ xp: 0, tasks: [], loading: initialLoading }),
}));
