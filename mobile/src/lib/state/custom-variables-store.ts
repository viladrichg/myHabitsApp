/**
 * Custom Variables Store
 *
 * Manages user-configurable variables for tracking, including:
 * - Built-in variables (workedAtJob, workedAtHome, fum, gat, meditation, yoga, dibuix, llegir, sports)
 * - Custom variables added dynamically by the user
 *
 * Each variable has:
 * - id: internal stable identifier (never changes)
 * - label: display name (user-editable)
 * - color: graph/chart color
 * - type: 'boolean' | 'counter'
 * - isBuiltIn: whether it's a built-in variable
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLOR_BLIND_SAFE_PALETTE } from './color-settings-store';

export type VariableType = 'boolean' | 'counter';

export interface TrackedVariable {
  id: string;             // Stable internal key (never changes)
  label: string;          // Display name (user-editable)
  color: string;          // Graph color
  type: VariableType;     // boolean = on/off, counter = 0-25
  isBuiltIn: boolean;     // Built-in cannot be deleted
  order: number;          // Display order
}

// All built-in variable definitions
export const BUILT_IN_VARIABLES: TrackedVariable[] = [
  { id: 'workedAtJob',  label: 'Worked at Job',  color: COLOR_BLIND_SAFE_PALETTE.blue,    type: 'boolean', isBuiltIn: true, order: 0 },
  { id: 'workedAtHome', label: 'Worked at Home', color: COLOR_BLIND_SAFE_PALETTE.orange,  type: 'boolean', isBuiltIn: true, order: 1 },
  { id: 'fum',          label: 'Fum',            color: COLOR_BLIND_SAFE_PALETTE.red,     type: 'boolean', isBuiltIn: true, order: 2 },
  { id: 'gat',          label: 'Gat',            color: COLOR_BLIND_SAFE_PALETTE.magenta, type: 'boolean', isBuiltIn: true, order: 3 },
  { id: 'meditation',   label: 'Meditation',     color: COLOR_BLIND_SAFE_PALETTE.green,   type: 'boolean', isBuiltIn: true, order: 4 },
  { id: 'yoga',         label: 'Yoga',           color: COLOR_BLIND_SAFE_PALETTE.cyan,    type: 'boolean', isBuiltIn: true, order: 5 },
  { id: 'dibuix',       label: 'Dibuix',         color: COLOR_BLIND_SAFE_PALETTE.yellow,  type: 'boolean', isBuiltIn: true, order: 6 },
  { id: 'llegir',       label: 'Llegir',         color: COLOR_BLIND_SAFE_PALETTE.blue,    type: 'boolean', isBuiltIn: true, order: 7 },
  { id: 'sports',       label: 'Sports (Any)',   color: '#6366f1',                         type: 'boolean', isBuiltIn: true, order: 8 },
  { id: 'counter',      label: 'Counter',        color: '#8b5cf6',                         type: 'counter', isBuiltIn: true, order: 9 },
];

// Color rotation for new custom variables
const CUSTOM_VAR_COLORS = [
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#a78bfa',
  '#14b8a6', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e',
];

interface CustomVariablesState {
  // All variables (built-in + custom), keyed by id
  variables: Record<string, TrackedVariable>;

  // Actions
  addVariable: (label: string, color?: string, type?: VariableType) => string;
  updateVariableLabel: (id: string, label: string) => void;
  updateVariableColor: (id: string, color: string) => void;
  deleteVariable: (id: string) => void;
  resetToDefaults: () => void;

  // Getters
  getAllVariables: () => TrackedVariable[];
  getCustomVariables: () => TrackedVariable[];
  getBuiltInVariables: () => TrackedVariable[];
  getVariable: (id: string) => TrackedVariable | undefined;
}

const buildDefaultVariables = (): Record<string, TrackedVariable> => {
  const map: Record<string, TrackedVariable> = {};
  for (const v of BUILT_IN_VARIABLES) {
    map[v.id] = { ...v };
  }
  return map;
};

export const useCustomVariablesStore = create<CustomVariablesState>()(
  persist(
    (set, get) => ({
      variables: buildDefaultVariables(),

      addVariable: (label, color, type = 'boolean') => {
        const allVars = Object.values(get().variables);
        const customVars = allVars.filter((v) => !v.isBuiltIn);

        // Generate unique id
        const id = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

        // Pick color if not provided
        const assignedColor = color ?? CUSTOM_VAR_COLORS[customVars.length % CUSTOM_VAR_COLORS.length];

        const newVar: TrackedVariable = {
          id,
          label: label.trim() || `Variable ${customVars.length + 1}`,
          color: assignedColor,
          type,
          isBuiltIn: false,
          order: allVars.length,
        };

        set((state) => ({
          variables: { ...state.variables, [id]: newVar },
        }));

        return id;
      },

      updateVariableLabel: (id, label) => {
        set((state) => {
          if (!state.variables[id]) return state;
          return {
            variables: {
              ...state.variables,
              [id]: { ...state.variables[id], label: label.trim() || state.variables[id].label },
            },
          };
        });
      },

      updateVariableColor: (id, color) => {
        set((state) => {
          if (!state.variables[id]) return state;
          return {
            variables: {
              ...state.variables,
              [id]: { ...state.variables[id], color },
            },
          };
        });
      },

      deleteVariable: (id) => {
        set((state) => {
          const v = state.variables[id];
          if (!v || v.isBuiltIn) return state; // Can't delete built-ins
          const newVars = { ...state.variables };
          delete newVars[id];
          return { variables: newVars };
        });
      },

      resetToDefaults: () => {
        set((state) => {
          // Reset labels/colors for built-ins, keep custom variables
          const defaults = buildDefaultVariables();
          const newVars: Record<string, TrackedVariable> = { ...defaults };
          // Keep custom variables unchanged
          for (const [k, v] of Object.entries(state.variables)) {
            if (!v.isBuiltIn) {
              newVars[k] = v;
            }
          }
          return { variables: newVars };
        });
      },

      getAllVariables: () => {
        return Object.values(get().variables).sort((a, b) => a.order - b.order);
      },

      getCustomVariables: () => {
        return Object.values(get().variables)
          .filter((v) => !v.isBuiltIn)
          .sort((a, b) => a.order - b.order);
      },

      getBuiltInVariables: () => {
        return Object.values(get().variables)
          .filter((v) => v.isBuiltIn)
          .sort((a, b) => a.order - b.order);
      },

      getVariable: (id) => {
        return get().variables[id];
      },
    }),
    {
      name: 'custom-variables',
      storage: createJSONStorage(() => AsyncStorage),
      skipHydration: true,
    }
  )
);

// Selectors
// IMPORTANT: These use useShallow to prevent infinite re-render loops.
// Selectors that return arrays or objects MUST use useShallow so Zustand
// can do shallow equality comparison rather than reference equality.

export const useAllVariables = () =>
  useCustomVariablesStore(
    useShallow((s) => Object.values(s.variables).sort((a, b) => a.order - b.order))
  );

export const useCustomVariables = () =>
  useCustomVariablesStore(
    useShallow((s) =>
      Object.values(s.variables).filter((v) => !v.isBuiltIn).sort((a, b) => a.order - b.order)
    )
  );

export const useVariable = (id: string) =>
  useCustomVariablesStore((s) => s.variables[id]);

export const useVariableLabel = (id: string) =>
  useCustomVariablesStore((s) => s.variables[id]?.label ?? id);

export const useVariableColor = (id: string) =>
  useCustomVariablesStore((s) => s.variables[id]?.color ?? '#3b82f6');

export const useVariablesActions = () =>
  useCustomVariablesStore(
    useShallow((s) => ({
      addVariable: s.addVariable,
      updateVariableLabel: s.updateVariableLabel,
      updateVariableColor: s.updateVariableColor,
      deleteVariable: s.deleteVariable,
      resetToDefaults: s.resetToDefaults,
    }))
  );

// Get all trackable variables for graphs (excludes sleepQuality which has its own chart)
export const useTrackableVariables = () =>
  useCustomVariablesStore(
    useShallow((s) =>
      Object.values(s.variables)
        .filter((v) => v.id !== 'sleepQuality')
        .sort((a, b) => a.order - b.order)
    )
  );

// Get variable color map for quick lookup
export const useVariableColorMap = () =>
  useCustomVariablesStore(
    useShallow((s) => {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.variables)) {
        map[k] = v.color;
      }
      return map;
    })
  );

export const useVariableLabelMap = () =>
  useCustomVariablesStore(
    useShallow((s) => {
      const map: Record<string, string> = {};
      for (const [k, v] of Object.entries(s.variables)) {
        map[k] = v.label;
      }
      return map;
    })
  );
