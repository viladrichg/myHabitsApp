import { create } from 'zustand';
import { ChartTimeframe } from '../database/types';

export interface TimeRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export interface TimeRangeState {
  // Current timeframe selection
  timeframe: ChartTimeframe;

  // Explicit date boundaries (derived from timeframe or custom)
  range: TimeRange;

  // Whether using custom range instead of preset timeframe
  isCustomRange: boolean;

  // Anchor date for calculating range (defaults to today)
  anchorDate: string | null;

  // Actions
  setTimeframe: (timeframe: ChartTimeframe) => void;
  setTimeframeWithAnchor: (timeframe: ChartTimeframe, anchorDate: string) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  clearCustomRange: () => void;
  getDateRange: () => TimeRange;
  setAllRange: (entries: { date: string }[]) => void;
}

// Helper to calculate date range from timeframe with optional anchor date
const calculateRangeFromTimeframe = (timeframe: ChartTimeframe, anchorDate?: string): TimeRange => {
  // Use anchor date or today
  const endDateObj = anchorDate ? new Date(anchorDate + 'T12:00:00') : new Date();
  const endDate = endDateObj.toISOString().split('T')[0];
  let startDate: string;

  switch (timeframe) {
    case 'week': {
      const weekAgo = new Date(endDateObj);
      weekAgo.setDate(weekAgo.getDate() - 7);
      startDate = weekAgo.toISOString().split('T')[0];
      break;
    }
    case '15days': {
      const fifteenDaysAgo = new Date(endDateObj);
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
      startDate = fifteenDaysAgo.toISOString().split('T')[0];
      break;
    }
    case 'month': {
      const monthAgo = new Date(endDateObj);
      monthAgo.setDate(monthAgo.getDate() - 30);
      startDate = monthAgo.toISOString().split('T')[0];
      break;
    }
    case '3months': {
      const threeMonthsAgo = new Date(endDateObj);
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      startDate = threeMonthsAgo.toISOString().split('T')[0];
      break;
    }
    case '6months': {
      const sixMonthsAgo = new Date(endDateObj);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      startDate = sixMonthsAgo.toISOString().split('T')[0];
      break;
    }
    case 'year': {
      const yearAgo = new Date(endDateObj);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      startDate = yearAgo.toISOString().split('T')[0];
      break;
    }
    case 'all': {
      // For 'all', we use a very wide range; actual filtering uses entry dates
      const farPast = new Date(2000, 0, 1);
      startDate = farPast.toISOString().split('T')[0];
      break;
    }
    default: {
      const monthAgo = new Date(endDateObj);
      monthAgo.setDate(monthAgo.getDate() - 30);
      startDate = monthAgo.toISOString().split('T')[0];
    }
  }

  return { startDate, endDate };
};

export const useTimeRangeStore = create<TimeRangeState>((set, get) => ({
  timeframe: 'month',
  range: calculateRangeFromTimeframe('month'),
  isCustomRange: false,
  anchorDate: null,

  setTimeframe: (timeframe: ChartTimeframe) => {
    const range = calculateRangeFromTimeframe(timeframe);
    set({ timeframe, range, isCustomRange: false, anchorDate: null });
  },

  setTimeframeWithAnchor: (timeframe: ChartTimeframe, anchorDate: string) => {
    const range = calculateRangeFromTimeframe(timeframe, anchorDate);
    set({ timeframe, range, isCustomRange: false, anchorDate });
  },

  setCustomRange: (startDate: string, endDate: string) => {
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
      console.warn('Invalid date format for custom range');
      return;
    }

    // Ensure startDate <= endDate
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    set({ range: { startDate, endDate }, isCustomRange: true, anchorDate: null });
  },

  clearCustomRange: () => {
    const { timeframe } = get();
    const range = calculateRangeFromTimeframe(timeframe);
    set({ range, isCustomRange: false, anchorDate: null });
  },

  getDateRange: () => {
    return get().range;
  },

  setAllRange: (entries: { date: string }[]) => {
    if (entries.length === 0) {
      const range = calculateRangeFromTimeframe('month');
      set({ timeframe: 'all' as ChartTimeframe, range, isCustomRange: false, anchorDate: null });
      return;
    }
    const sorted = entries.map((e) => e.date).sort();
    const startDate = sorted[0];
    const endDate = sorted[sorted.length - 1];
    set({ timeframe: 'all' as ChartTimeframe, range: { startDate, endDate }, isCustomRange: false, anchorDate: null });
  },
}));

// Selector hooks for optimized re-renders
export const useTimeframe = () => useTimeRangeStore((s) => s.timeframe);
export const useRange = () => useTimeRangeStore((s) => s.range);
export const useIsCustomRange = () => useTimeRangeStore((s) => s.isCustomRange);
export const useSetTimeframe = () => useTimeRangeStore((s) => s.setTimeframe);
export const useSetTimeframeWithAnchor = () => useTimeRangeStore((s) => s.setTimeframeWithAnchor);
export const useSetCustomRange = () => useTimeRangeStore((s) => s.setCustomRange);
export const useSetAllRange = () => useTimeRangeStore((s) => s.setAllRange);

// Helper to filter entries by current time range
export const filterEntriesByRange = <T extends { date: string }>(
  entries: T[],
  range: TimeRange
): T[] => {
  return entries.filter((entry) => {
    return entry.date >= range.startDate && entry.date <= range.endDate;
  });
};
