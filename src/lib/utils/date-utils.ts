import { format, parse } from 'date-fns';

export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

export const parseDate = (dateStr: string): Date => {
  return parse(dateStr, 'yyyy-MM-dd', new Date());
};

export const formatTime = (date: Date): string => {
  return format(date, 'HH:mm');
};

export const parseTime = (timeStr: string): Date => {
  return parse(timeStr, 'HH:mm', new Date());
};

export const getTodayDateString = (): string => {
  return formatDate(new Date());
};

/**
 * Get the previous day's date string
 */
export const getPreviousDayString = (dateStr: string): string => {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() - 1);
  return formatDate(date);
};

/**
 * Calculate slept hours between previous day's bedtime and current day's wake-up time.
 * Returns null if either value is missing.
 *
 * @param previousDayBedtime - Bedtime from the previous day (HH:mm format)
 * @param currentDayWakeup - Wake-up time from the current day (HH:mm format)
 * @returns Hours slept in HH:MM format string, or null if cannot be calculated
 */
export const calculateSleptHours = (
  previousDayBedtime: string | null | undefined,
  currentDayWakeup: string | null | undefined
): string | null => {
  if (!previousDayBedtime || !currentDayWakeup) {
    return null;
  }

  // Validate time formats
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!timeRegex.test(previousDayBedtime) || !timeRegex.test(currentDayWakeup)) {
    return null;
  }

  const [bedHour, bedMin] = previousDayBedtime.split(':').map(Number);
  const [wakeHour, wakeMin] = currentDayWakeup.split(':').map(Number);

  // Calculate minutes from midnight for each
  const bedMinutesFromMidnight = bedHour * 60 + bedMin;
  const wakeMinutesFromMidnight = wakeHour * 60 + wakeMin;

  // Assume bedtime is PM (after noon) and wake-up is AM (before noon)
  // If bedtime is before 12:00 (noon), assume it's actually PM on the same day
  // Standard sleep calculation: bedtime is typically between 20:00-02:00, wakeup between 05:00-12:00

  let sleepMinutes: number;

  if (bedMinutesFromMidnight >= wakeMinutesFromMidnight) {
    // Normal case: bedtime is in the evening (e.g., 22:00), wakeup is morning (e.g., 07:00)
    // Sleep = (24*60 - bedtime) + wakeup
    sleepMinutes = (24 * 60 - bedMinutesFromMidnight) + wakeMinutesFromMidnight;
  } else {
    // Edge case: both times are on the same "side" of midnight
    // This could be a nap or unusual sleep pattern
    // Just calculate the difference
    sleepMinutes = wakeMinutesFromMidnight - bedMinutesFromMidnight;
  }

  // Sanity check: sleep should be between 0 and 24 hours (1440 minutes)
  if (sleepMinutes < 0 || sleepMinutes > 1440) {
    return null;
  }

  // Convert to HH:MM format
  const hours = Math.floor(sleepMinutes / 60);
  const minutes = sleepMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

export const getMonthDates = (year: number, month: number): string[] => {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    dates.push(formatDate(new Date(year, month, day)));
  }

  return dates;
};

export const getDayOfWeek = (dateStr: string): number => {
  const date = parseDate(dateStr);
  return date.getDay(); // 0 = Sunday, 1 = Monday, etc.
};

export const getMonthName = (month: number): string => {
  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return monthNames[month];
};

export const getDayName = (day: number): string => {
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return dayNames[day];
};
