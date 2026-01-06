import { writable } from 'svelte/store';

interface Settings {
  timeCapsuleEnabled: boolean;
}

const defaultSettings: Settings = {
  timeCapsuleEnabled: true,
};

function createSettingsStore() {
  const { subscribe, set, update } = writable<Settings>(defaultSettings);

  return {
    subscribe,
    set,
    update,
    init: () => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('trilines_settings');
        if (stored) {
          try {
            set({ ...defaultSettings, ...JSON.parse(stored) });
          } catch (e) {
            console.warn('Failed to parse settings');
          }
        }
      }
    },
    save: (settings: Settings) => {
      set(settings);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('trilines_settings', JSON.stringify(settings));
      }
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
