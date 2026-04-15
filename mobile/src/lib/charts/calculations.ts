import { DailyEntry } from '@/lib/database/types';

// -----------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------

export interface TrendPoint {
  date: string;   // YYYY-MM-DD of the endpoint of this interval
  value: number;  // smoothed improvement rate (>= 0, clamped)
}

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

// -----------------------------------------------------------------------
// Trend / Ritme computation (replaces "Taxa de canvi")
// -----------------------------------------------------------------------

/**
 * Computes a smooth "improvement rhythm" curve from an accumulated series.
 *
 * WHY this replaces computeIntervalDerivative ("Taxa de canvi"):
 *   The old approach used non-overlapping fixed intervals (1d, 3d, 7d).
 *   This produced isolated horizontal stubs — erratic, hard to read, and
 *   misleading when data was sparse (missing days created giant gaps).
 *
 * NEW approach:
 *   1. Take only the valid (non-null) accumulated-value data points.
 *   2. For every consecutive pair, compute slope = Δvalue / Δdays.
 *      This is the per-day improvement rate for that interval.
 *   3. Clamp negatives to 0 — accumulated values only go up, but we
 *      still clamp defensively so the chart never shows negative rhythm.
 *   4. Apply a simple moving average to smooth out noise.
 *   5. Result: a continuous line of points — no gaps from missing days.
 *
 * The x-axis date of each point is the END date of each interval.
 */
export const computeTrendRitme = (
  accumulatedValues: (number | null)[],
  allDates: string[],
  smoothingWindow: number = 5,
): TrendPoint[] => {
  // Step 1: collect valid (date, value) pairs from the accumulated series
  const valid: { date: string; value: number }[] = [];
  for (let i = 0; i < allDates.length; i++) {
    const v = accumulatedValues[i];
    if (v !== null && v !== undefined) {
      valid.push({ date: allDates[i]!, value: v });
    }
  }

  if (valid.length < 2) return [];

  // Step 2: per-interval slopes between consecutive valid points
  const raw: { date: string; slope: number }[] = [];
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1]!;
    const curr = valid[i]!;
    const msPerDay = 1000 * 60 * 60 * 24;
    const dayDiff = Math.max(
      1,
      (new Date(curr.date + 'T12:00:00').getTime() -
        new Date(prev.date + 'T12:00:00').getTime()) / msPerDay,
    );
    // Step 3: clamp negatives
    const slope = Math.max(0, (curr.value - prev.value) / dayDiff);
    raw.push({ date: curr.date, slope });
  }

  if (raw.length === 0) return [];

  // Step 4: moving average — smooths out single-day noise
  const halfW = Math.floor(smoothingWindow / 2);
  const smoothed: TrendPoint[] = raw.map((_, i) => {
    const lo = Math.max(0, i - halfW);
    const hi = Math.min(raw.length - 1, i + halfW);
    let sum = 0, count = 0;
    for (let j = lo; j <= hi; j++) { sum += raw[j]!.slope; count++; }
    return { date: raw[i]!.date, value: sum / count };
  });

  return smoothed;
};

// -----------------------------------------------------------------------
// Kept for backward compatibility — but no longer used in the UI
// -----------------------------------------------------------------------

/**
 * Computes non-overlapping interval slopes.
 * @deprecated Use computeTrendRitme instead.
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
