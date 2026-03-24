import { DailyEntry } from '@/lib/database/types';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface MonthBreakdown {
  monthKey: string;
  label: string;
  total: number;
  days: number;
  registeredDays: number;
  slope: number;
}

export interface FieldCalculation {
  values: (number | null)[];
  total: number;
  registeredDays: number;
}

export interface MonthlyFieldCalculation {
  monthlyValues: (number | null)[];
  accumulatedValues: (number | null)[];
  total: number;
  registeredDays: number;
  monthlyBreakdown: MonthBreakdown[];
}

export type DerivativeInterval = 1 | 3 | 7;

export interface ChartSeriesData {
  field: string;
  color: string;
  data: { index: number; label: string; date: string; value: number }[];
}

export interface DerivativeSeriesData {
  field: string;
  color: string;
  points: DerivativePoint[];
}

export interface DerivativePoint {
  startIdx: number;
  endIdx: number;
  date: string;
  value: number;
}

// -----------------------------------------------------------------------
// Field active check — supports built-in and custom variables
// -----------------------------------------------------------------------
export const isFieldActive = (
  entry: DailyEntry,
  fieldId: string,
  customVarData?: Record<string, Record<string, number>>,
  columnName?: string
): boolean => {
  if (['workedAtJob', 'workedAtHome', 'fum', 'gat', 'meditation', 'yoga', 'dibuix', 'llegir'].includes(fieldId)) {
    return Boolean((entry as any)[fieldId]);
  }
  if (fieldId === 'sports') {
    try {
      return JSON.parse(entry.sports || '[]').length > 0;
    } catch {
      return false;
    }
  }
  if (fieldId === 'counter') {
    return (entry.counter ?? 0) > 0;
  }
  if (columnName && customVarData) {
    const val = customVarData[entry.date]?.[columnName] ?? 0;
    return val > 0;
  }
  return false;
};

// -----------------------------------------------------------------------
// Calculation helpers
// -----------------------------------------------------------------------

export const calculateFieldData = (
  entries: DailyEntry[],
  fieldId: string,
  allDatesInRange: string[],
  customVarData?: Record<string, Record<string, number>>,
  columnName?: string
): FieldCalculation => {
  const entryMap = new Map(entries.map((e) => [e.date, e]));
  let cumulative = 0;
  let registeredDays = 0;
  const values: (number | null)[] = [];

  allDatesInRange.forEach((date) => {
    const entry = entryMap.get(date);
    if (entry) {
      registeredDays++;
      if (isFieldActive(entry, fieldId, customVarData, columnName)) {
        cumulative += 1;
      }
      values.push(cumulative);
    } else {
      values.push(null);
    }
  });

  return { values, total: cumulative, registeredDays };
};

export const calculateMonthlyFieldData = (
  entries: DailyEntry[],
  fieldId: string,
  allDatesInRange: string[],
  customVarData?: Record<string, Record<string, number>>,
  columnName?: string
): MonthlyFieldCalculation => {
  const entryMap = new Map(entries.map((e) => [e.date, e]));
  let overallCumulative = 0;
  let monthlyCumulative = 0;
  let registeredDays = 0;
  let currentMonth = '';

  const monthlyValues: (number | null)[] = [];
  const accumulatedValues: (number | null)[] = [];
  const monthMap = new Map<string, MonthBreakdown>();

  allDatesInRange.forEach((date) => {
    const month = date.substring(0, 7);
    const isNewMonth = month !== currentMonth;
    if (isNewMonth) {
      monthlyCumulative = 0;
      currentMonth = month;
    }

    if (!monthMap.has(month)) {
      const [yr, mo] = month.split('-');
      const d = new Date(Number(yr), Number(mo) - 1, 1);
      const label = d.toLocaleString('default', { month: 'short', year: 'numeric' });
      monthMap.set(month, { monthKey: month, label, total: 0, days: 0, registeredDays: 0, slope: 0 });
    }

    const mBreak = monthMap.get(month)!;
    mBreak.days += 1;

    const entry = entryMap.get(date);
    if (entry) {
      registeredDays++;
      mBreak.registeredDays += 1;
      if (isFieldActive(entry, fieldId, customVarData, columnName)) {
        overallCumulative += 1;
        monthlyCumulative += 1;
        mBreak.total += 1;
      }
      monthlyValues.push(monthlyCumulative === 0 && isNewMonth && monthlyValues.length > 0 ? null : monthlyCumulative);
      accumulatedValues.push(overallCumulative);
    } else {
      monthlyValues.push(null);
      accumulatedValues.push(null);
    }
  });

  const monthlyBreakdown: MonthBreakdown[] = [];
  monthMap.forEach((m) => {
    m.slope = m.registeredDays > 0 ? m.total / m.registeredDays : 0;
    monthlyBreakdown.push(m);
  });

  return { monthlyValues, accumulatedValues, total: overallCumulative, registeredDays, monthlyBreakdown };
};

export const generateDatesInRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

export const lightenColor = (hex: string, alpha: number): string => {
  return hex + Math.round(alpha * 255).toString(16).padStart(2, '0');
};

/**
 * Computes non-overlapping interval slopes.
 */
export const computeIntervalDerivative = (
  values: (number | null)[],
  dates: string[],
  interval: DerivativeInterval
): DerivativePoint[] => {
  const result: DerivativePoint[] = [];
  let i = 0;
  while (i + interval <= values.length) {
    const startVal = values[i];
    const endVal = values[i + interval - 1];

    if (startVal !== null && endVal !== null) {
      let hasReset = false;
      for (let k = i + 1; k < i + interval; k++) {
        const v = values[k];
        if (v !== null && v < (values[k - 1] ?? v)) {
          hasReset = true;
          break;
        }
      }
      if (!hasReset) {
        const slope = (endVal - startVal) / interval;
        if (slope >= 0) {
          result.push({
            startIdx: i,
            endIdx: i + interval - 1,
            date: dates[i] ?? '',
            value: slope,
          });
        }
      }
    }
    i += interval;
  }
  return result;
};
