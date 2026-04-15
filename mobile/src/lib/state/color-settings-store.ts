/**
 * Color Settings Store
 *
 * Manages user-configurable colors for activities and activity pairs.
 * Also manages configurable naming for extreme values.
 * Persists to AsyncStorage with deterministic defaults.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Color-blind safe palette (high contrast)
export const COLOR_BLIND_SAFE_PALETTE = {
  blue: '#0077BB',      // Strong blue
  orange: '#EE7733',    // Orange
  cyan: '#33BBEE',      // Cyan
  magenta: '#EE3377',   // Magenta/pink
  green: '#009988',     // Teal
  yellow: '#CCBB44',    // Yellow
  red: '#CC3311',       // Red
  grey: '#BBBBBB',      // Grey
} as const;

// Extended color palette
export const EXTENDED_COLORS = [
  '#0077BB', '#EE7733', '#33BBEE', '#EE3377', '#009988', '#CCBB44', '#CC3311', '#BBBBBB',
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
  '#ec4899', '#14b8a6', '#a78bfa', '#fb923c', '#4ade80', '#60a5fa', '#f472b6', '#34d399',
  '#fbbf24', '#e879f9', '#2dd4bf', '#fb7185', '#a3e635', '#38bdf8',
];

// Activity field keys (derived from schema)
export type ActivityField =
  | 'workedAtJob'
  | 'workedAtHome'
  | 'fum'
  | 'gat'
  | 'meditation'
  | 'yoga'
  | 'dibuix'
  | 'llegir'
  | 'sports'
  | 'sleepQuality'
  | 'counter'
  | string; // Allow dynamic custom variable IDs

// Default colors for single activities
export const DEFAULT_ACTIVITY_COLORS: Record<string, string> = {
  workedAtJob: COLOR_BLIND_SAFE_PALETTE.blue,
  workedAtHome: COLOR_BLIND_SAFE_PALETTE.orange,
  fum: COLOR_BLIND_SAFE_PALETTE.red,
  gat: COLOR_BLIND_SAFE_PALETTE.magenta,
  meditation: COLOR_BLIND_SAFE_PALETTE.green,
  yoga: COLOR_BLIND_SAFE_PALETTE.cyan,
  dibuix: COLOR_BLIND_SAFE_PALETTE.yellow,
  llegir: COLOR_BLIND_SAFE_PALETTE.blue,
  sports: '#6366f1',
  sleepQuality: '#8b5cf6',
  counter: '#8b5cf6',
};

// Activity pair key format: "activity1|activity2" (alphabetically sorted)
export type ActivityPairKey = string;

// Generate pair key deterministically (always sorted alphabetically)
export const generatePairKey = (activity1: ActivityField, activity2: ActivityField): ActivityPairKey => {
  const sorted = [activity1, activity2].sort();
  return `${sorted[0]}|${sorted[1]}`;
};

// =============================================================================
// EXTREME VALUE NAMING
// =============================================================================

export type ExtremeValueCategory = 'sleepTime' | 'wakeTime' | 'sleepDuration' | 'sleepQuality';

export interface ExtremeValueNames {
  most: string;  // e.g., "Night Owl" for latest bedtime
  least: string; // e.g., "Morning Bird" for earliest bedtime
}

export const DEFAULT_EXTREME_NAMES: Record<ExtremeValueCategory, ExtremeValueNames> = {
  sleepTime: { most: 'Night Owl', least: 'Morning Bird' },      // latest/earliest bedtime -> Night Owl = latest bedtime
  wakeTime: { most: 'Late Riser', least: 'Early Bird' },        // latest/earliest wakeup -> Early Bird = earliest wakeup
  sleepDuration: { most: 'Dormilega', least: 'Nit del Lloro' }, // most/least sleep
  sleepQuality: { most: 'Deep Sleeper', least: 'Light Sleeper' },     // best/worst quality
};

interface ColorSettingsState {
  // Single activity colors (keyed by activity id, supports dynamic keys)
  activityColors: Record<string, string>;

  // Activity pair colors (override single colors when both active)
  pairColors: Record<ActivityPairKey, string>;

  // Extreme value names (configurable labels)
  extremeNames: Record<ExtremeValueCategory, ExtremeValueNames>;

  // Actions
  setActivityColor: (activity: string, color: string) => void;
  setPairColor: (activity1: ActivityField, activity2: ActivityField, color: string) => void;
  removePairColor: (activity1: ActivityField, activity2: ActivityField) => void;
  setExtremeName: (category: ExtremeValueCategory, type: 'most' | 'least', name: string) => void;
  resetExtremeNames: () => void;
  resetToDefaults: () => void;

  // Getters
  getActivityColor: (activity: string) => string;
  getPairColor: (activity1: ActivityField, activity2: ActivityField) => string | null;
  getExtremeName: (category: ExtremeValueCategory, type: 'most' | 'least') => string;
}

export const useColorSettingsStore = create<ColorSettingsState>()(
  persist(
    (set, get) => ({
      activityColors: { ...DEFAULT_ACTIVITY_COLORS },
      pairColors: {},
      extremeNames: { ...DEFAULT_EXTREME_NAMES },

      setActivityColor: (activity, color) => {
        set((state) => ({
          activityColors: {
            ...state.activityColors,
            [activity]: color,
          },
        }));
      },

      setPairColor: (activity1, activity2, color) => {
        const key = generatePairKey(activity1, activity2);
        set((state) => ({
          pairColors: {
            ...state.pairColors,
            [key]: color,
          },
        }));
      },

      removePairColor: (activity1, activity2) => {
        const key = generatePairKey(activity1, activity2);
        set((state) => {
          const newPairColors = { ...state.pairColors };
          delete newPairColors[key];
          return { pairColors: newPairColors };
        });
      },

      setExtremeName: (category, type, name) => {
        set((state) => ({
          extremeNames: {
            ...state.extremeNames,
            [category]: {
              ...state.extremeNames[category],
              [type]: name,
            },
          },
        }));
      },

      resetExtremeNames: () => {
        set({ extremeNames: { ...DEFAULT_EXTREME_NAMES } });
      },

      resetToDefaults: () => {
        set({
          activityColors: { ...DEFAULT_ACTIVITY_COLORS },
          pairColors: {},
          extremeNames: { ...DEFAULT_EXTREME_NAMES },
        });
      },

      getActivityColor: (activity) => {
        return get().activityColors[activity] ?? DEFAULT_ACTIVITY_COLORS[activity] ?? '#3b82f6';
      },

      getPairColor: (activity1, activity2) => {
        const key = generatePairKey(activity1, activity2);
        return get().pairColors[key] ?? null;
      },

      getExtremeName: (category, type) => {
        const names = get().extremeNames[category];
        return names?.[type] ?? DEFAULT_EXTREME_NAMES[category][type];
      },
    }),
    {
      name: 'color-settings',
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
    }
  )
);

// Selectors for optimized re-renders
// useShallow is used for selectors returning objects/records to prevent
// infinite re-render loops from getSnapshot instability.
export const useActivityColors = () => useColorSettingsStore(useShallow((s) => s.activityColors));
export const usePairColors = () => useColorSettingsStore(useShallow((s) => s.pairColors));
export const useExtremeNames = () => useColorSettingsStore(useShallow((s) => s.extremeNames));
export const useSetActivityColor = () => useColorSettingsStore((s) => s.setActivityColor);
export const useSetPairColor = () => useColorSettingsStore((s) => s.setPairColor);
export const useSetExtremeName = () => useColorSettingsStore((s) => s.setExtremeName);
export const useResetExtremeNames = () => useColorSettingsStore((s) => s.resetExtremeNames);
export const useResetColors = () => useColorSettingsStore((s) => s.resetToDefaults);

// Get color for a field, considering pair overrides
export const getEffectiveColor = (
  activity: ActivityField,
  activeActivities: ActivityField[],
  activityColors: Record<string, string>,
  pairColors: Record<ActivityPairKey, string>
): string => {
  // Check for pair color overrides
  for (const other of activeActivities) {
    if (other !== activity) {
      const pairKey = generatePairKey(activity, other);
      if (pairColors[pairKey]) {
        return pairColors[pairKey];
      }
    }
  }

  return activityColors[activity] ?? DEFAULT_ACTIVITY_COLORS[activity] ?? '#3b82f6';
};
