import { create } from 'zustand';
import { fetchHealth, testAllChannels, type HealthResponse } from '@/utils/api';

interface HealthState {
  health: HealthResponse | null;
  loading: boolean;
  lastRefresh: number | null;
  fetchHealth: () => Promise<void>;
  triggerCheck: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  health: null,
  loading: false,
  lastRefresh: null,

  fetchHealth: async () => {
    set({ loading: true });
    try {
      const data = await fetchHealth();
      set({ health: data, lastRefresh: Date.now() });
    } catch (e) {
      console.error('Failed to fetch health:', e);
    } finally {
      set({ loading: false });
    }
  },

  triggerCheck: async () => {
    set({ loading: true });
    try {
      await testAllChannels();
      const data = await fetchHealth();
      set({ health: data, lastRefresh: Date.now() });
    } catch (e) {
      console.error('Failed to trigger check:', e);
    } finally {
      set({ loading: false });
    }
  },
}));

export function useHealthPolling(intervalMs = 10000) {
  const { fetchHealth } = useHealthStore();

  let timer: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    fetchHealth();
    timer = setInterval(fetchHealth, intervalMs);
  };

  const stop = () => {
    if (timer) clearInterval(timer);
  };

  return { start, stop };
}
