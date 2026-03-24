/**
 * Centralized Data Layer
 *
 * This module provides a single source of truth for all data access.
 * All graphs, summaries, calendar views, and imports rely on this canonical data model.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import {
  getAllDailyEntries,
  getDailyEntry,
  saveDailyEntry,
  deleteDailyEntry,
  getSettings,
  updateSettings,
  getAllCustomSports,
  addCustomSport,
  deleteCustomSport,
  getActiveUser,
} from '../database/db';
import { DailyEntry, AppSettings, CustomSport, UserProfile } from '../database/types';
import { calculateStatistics, FilterOption } from '../utils/calendar-utils';
import { useRange, filterEntriesByRange, TimeRange } from './time-range-store';

// Query Keys - Single source of truth for cache keys
export const QUERY_KEYS = {
  allEntries: ['allDailyEntries'] as const,
  entry: (date: string) => ['dailyEntry', date] as const,
  settings: ['settings'] as const,
  customSports: ['customSports'] as const,
  activeUser: ['activeUser'] as const,
};

// =============================================================================
// USER QUERIES
// =============================================================================

export const useActiveUser = () => {
  return useQuery({
    queryKey: QUERY_KEYS.activeUser,
    queryFn: getActiveUser,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

// =============================================================================
// ENTRIES QUERIES
// =============================================================================

/**
 * Get all daily entries (unfiltered by date)
 */
export const useAllEntries = () => {
  return useQuery({
    queryKey: QUERY_KEYS.allEntries,
    queryFn: getAllDailyEntries,
    staleTime: 1000 * 30, // 30 seconds
  });
};

/**
 * Get entries filtered by the current time range from the store
 */
export const useFilteredEntries = () => {
  const { data: allEntries = [], ...rest } = useAllEntries();
  const range = useRange();

  const filteredEntries = useMemo(() => {
    return filterEntriesByRange(allEntries, range);
  }, [allEntries, range]);

  return { data: filteredEntries, allEntries, ...rest };
};

/**
 * Get entries for a specific date range (custom, not from store)
 */
export const useEntriesInRange = (startDate: string, endDate: string) => {
  const { data: allEntries = [], ...rest } = useAllEntries();

  const filteredEntries = useMemo(() => {
    return filterEntriesByRange(allEntries, { startDate, endDate });
  }, [allEntries, startDate, endDate]);

  return { data: filteredEntries, ...rest };
};

/**
 * Get a single entry by date
 */
export const useDailyEntry = (date: string | null) => {
  return useQuery({
    queryKey: QUERY_KEYS.entry(date ?? ''),
    queryFn: () => getDailyEntry(date!),
    enabled: !!date && /^\d{4}-\d{2}-\d{2}$/.test(date),
    staleTime: 1000 * 30,
  });
};

/**
 * Create a map of date to entry for quick lookup
 */
export const useEntriesMap = () => {
  const { data: allEntries = [] } = useAllEntries();

  return useMemo(() => {
    const map: Record<string, DailyEntry> = {};
    allEntries.forEach((entry) => {
      map[entry.date] = entry;
    });
    return map;
  }, [allEntries]);
};

// =============================================================================
// STATISTICS QUERIES
// =============================================================================

/**
 * Calculate statistics for filtered entries (respects time range)
 */
export const useFilteredStatistics = (filters?: FilterOption[]) => {
  const { data: filteredEntries = [] } = useFilteredEntries();

  return useMemo(() => {
    return calculateStatistics(filteredEntries, filters);
  }, [filteredEntries, filters]);
};

/**
 * Calculate statistics for all entries (ignores time range)
 */
export const useAllStatistics = (filters?: FilterOption[]) => {
  const { data: allEntries = [] } = useAllEntries();

  return useMemo(() => {
    return calculateStatistics(allEntries, filters);
  }, [allEntries, filters]);
};

/**
 * Get sleep quality data for charts
 */
export const useSleepQualityData = () => {
  const { data: filteredEntries = [] } = useFilteredEntries();

  return useMemo(() => {
    return filteredEntries
      .filter((entry) => entry.sleepQuality !== null && entry.sleepQuality !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry, index) => ({
        value: Math.max(1, Math.min(10, entry.sleepQuality ?? 5)),
        label: String(index + 1),
        date: entry.date,
      }));
  }, [filteredEntries]);
};

// =============================================================================
// ENTRIES MUTATIONS
// =============================================================================

export const useSaveEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>) => {
      await saveDailyEntry(entry);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.entry(variables.date) });
    },
  });
};

export const useDeleteEntry = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (date: string) => {
      await deleteDailyEntry(date);
    },
    onSuccess: (_, date) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.entry(date) });
    },
  });
};

// =============================================================================
// SETTINGS QUERIES & MUTATIONS
// =============================================================================

export const useSettings = () => {
  return useQuery({
    queryKey: QUERY_KEYS.settings,
    queryFn: getSettings,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: Partial<Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>>) => {
      await updateSettings(settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.settings });
    },
  });
};

// =============================================================================
// SPORTS QUERIES & MUTATIONS
// =============================================================================

export const useCustomSports = () => {
  return useQuery({
    queryKey: QUERY_KEYS.customSports,
    queryFn: getAllCustomSports,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

export const useAddSport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (name: string) => {
      await addCustomSport(name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customSports });
    },
  });
};

export const useDeleteSport = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await deleteCustomSport(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.customSports });
    },
  });
};

// =============================================================================
// BULK IMPORT HELPERS
// =============================================================================

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * Bulk import entries with validation
 */
export const useBulkImport = () => {
  const queryClient = useQueryClient();
  const { data: existingEntries = [] } = useAllEntries();

  return useMutation({
    mutationFn: async (entries: Array<Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>>): Promise<ImportResult> => {
      const existingDates = new Set(existingEntries.map((e) => e.date));
      const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

      for (const entry of entries) {
        // Validate date
        if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
          result.errors.push(`Invalid date format: ${entry.date}`);
          result.skipped++;
          continue;
        }

        // Skip existing dates (duplicate prevention)
        if (existingDates.has(entry.date)) {
          result.skipped++;
          continue;
        }

        try {
          await saveDailyEntry(entry);
          existingDates.add(entry.date); // Prevent duplicates within batch
          result.imported++;
        } catch (error) {
          result.errors.push(`Failed to save ${entry.date}: ${String(error)}`);
          result.skipped++;
        }
      }

      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
    },
  });
};
