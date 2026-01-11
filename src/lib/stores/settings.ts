import { writable } from 'svelte/store';

// Define the shape of our settings
export interface Settings {
  hideRanking: boolean;
  timeCapsuleEnabled: boolean;
}

// Default settings
const defaultSettings: Settings = {
  hideRanking: false,
  timeCapsuleEnabled: true, // Default to true or user preference
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(defaultSettings);

  return {
    subscribe,
    set,
    update,
    // Initialize from localStorage on mount (client-side only)
    init: () => {
      if (typeof window === 'undefined') return;

      const stored = localStorage.getItem('trilines_settings');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          set({ ...defaultSettings, ...parsed });
        } catch (e) {
          console.warn('Failed to parse settings', e);
        }
      }

      // Subscribe to changes to persist them
      subscribe((value) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('trilines_settings', JSON.stringify(value));
        }
      });
    },
    toggleHideRanking: () => {
      update((s) => ({ ...s, hideRanking: !s.hideRanking }));
    },
    toggleTimeCapsule: () => {
      update(s => {
        const next = { ...s, timeCapsuleEnabled: !s.timeCapsuleEnabled };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('trilines_settings', JSON.stringify(next));
        }
        return next;
      });
    }
  };
}

export const settings = createSettingsStore();
