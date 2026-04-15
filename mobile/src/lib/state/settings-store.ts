import { create } from 'zustand';
import { AppSettings, DEFAULT_SETTINGS } from '../database/types';

interface SettingsStore {
  settings: AppSettings | null;
  setSettings: (settings: AppSettings) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  setSettings: (settings) => set({ settings }),
  updateSettings: (newSettings) =>
    set((state) => ({
      settings: state.settings ? { ...state.settings, ...newSettings } : null,
    })),
}));
