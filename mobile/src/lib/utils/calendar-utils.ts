import { DailyEntry } from '../database/types';

export type DayColor = 'red' | 'green' | 'yellow' | 'blue' | 'pink' | 'orange' | 'neutral';

export interface FilterOption {
  type: 'work-job' | 'work-home' | 'fum' | 'gat' | 'meditation' | 'yoga' | 'llegir' | 'dibuix' | 'sport';
  label: string;
  color: string;
  value?: string; // For specific sport names
}

// Get the color for a day based on the calendar coloring rules
export const getDayColor = (entry: DailyEntry | null): DayColor => {
  if (!entry) return 'neutral';

  // Priority 1: Option B - Fum = RED (highest priority)
  if (entry.fum) {
    return 'red';
  }

  // Priority 2: Option B - Gat = PINK
  if (entry.gat) {
    return 'pink';
  }

  // Check if Option A (Work) is active
  const optionAActive = entry.workedAtJob || entry.workedAtHome;

  // Check if Option C (Activities) is active - includes llegir now
  const optionCActive = entry.meditation || entry.yoga || entry.dibuix || entry.llegir;

  // Check if Option D (Sports) is active
  const sports = entry.sports ? JSON.parse(entry.sports) : [];
  const optionDActive = sports.length > 0;

  // Priority 3: Option C + D active AND Option A NOT active → BLUE
  if (optionCActive && optionDActive && !optionAActive) {
    return 'blue';
  }

  // Count active options (A, C, D)
  let activeCount = 0;
  if (optionAActive) activeCount++;
  if (optionCActive) activeCount++;
  if (optionDActive) activeCount++;

  // Priority 4: A + C + D all present → GREEN
  if (activeCount === 3) {
    return 'green';
  }

  // Priority 5: Any two of A, C, D → YELLOW
  if (activeCount === 2) {
    return 'yellow';
  }

  // Otherwise → Neutral gray
  return 'neutral';
};

// Get the work color specifically
export const getWorkColor = (entry: DailyEntry | null): 'blue' | 'orange' | 'neutral' => {
  if (!entry) return 'neutral';
  if (entry.workedAtJob) return 'blue';
  if (entry.workedAtHome) return 'orange';
  return 'neutral';
};

// Get dots for a day based on active filters
export const getFilterDots = (entry: DailyEntry | null, filters: FilterOption[]): string[] => {
  if (!entry || filters.length === 0) return [];

  const dots: string[] = [];

  for (const filter of filters) {
    switch (filter.type) {
      case 'work-job':
        if (entry.workedAtJob) dots.push(filter.color);
        break;
      case 'work-home':
        if (entry.workedAtHome) dots.push(filter.color);
        break;
      case 'fum':
        if (entry.fum) dots.push(filter.color);
        break;
      case 'gat':
        if (entry.gat) dots.push(filter.color);
        break;
      case 'meditation':
        if (entry.meditation) dots.push(filter.color);
        break;
      case 'yoga':
        if (entry.yoga) dots.push(filter.color);
        break;
      case 'llegir':
        if (entry.llegir) dots.push(filter.color);
        break;
      case 'dibuix':
        if (entry.dibuix) dots.push(filter.color);
        break;
      case 'sport':
        const sports = entry.sports ? JSON.parse(entry.sports) : [];
        if (filter.value) {
          if (sports.includes(filter.value)) dots.push(filter.color);
        } else {
          if (sports.length > 0) dots.push(filter.color);
        }
        break;
    }
  }

  return dots;
};

// Check if an entry matches a filter
export const entryMatchesFilter = (entry: DailyEntry | null, filter: FilterOption): boolean => {
  if (!entry) return false;

  switch (filter.type) {
    case 'work-job':
      return entry.workedAtJob;
    case 'work-home':
      return entry.workedAtHome;
    case 'fum':
      return entry.fum;
    case 'gat':
      return entry.gat;
    case 'meditation':
      return entry.meditation;
    case 'yoga':
      return entry.yoga;
    case 'llegir':
      return entry.llegir;
    case 'dibuix':
      return entry.dibuix;
    case 'sport':
      const sports = entry.sports ? JSON.parse(entry.sports) : [];
      if (filter.value) {
        return sports.includes(filter.value);
      }
      return sports.length > 0;
    default:
      return false;
  }
};

// Calculate statistics for entries
export const calculateStatistics = (entries: DailyEntry[], filters?: FilterOption[]) => {
  let filteredEntries = entries;

  // Apply filters if provided
  if (filters && filters.length > 0) {
    filteredEntries = entries.filter((entry) =>
      filters.every((filter) => entryMatchesFilter(entry, filter))
    );
  }

  // Count days (not activities)
  const stats = {
    totalDays: filteredEntries.length,
    workedAtJob: 0,
    workedAtHome: 0,
    fum: 0,
    gat: 0,
    meditation: 0,
    yoga: 0,
    llegir: 0,
    dibuix: 0,
    sports: {} as Record<string, number>,
    averageSleepQuality: null as number | null,
  };

  let sleepQualitySum = 0;
  let sleepQualityCount = 0;

  for (const entry of filteredEntries) {
    if (entry.workedAtJob) stats.workedAtJob++;
    if (entry.workedAtHome) stats.workedAtHome++;
    if (entry.fum) stats.fum++;
    if (entry.gat) stats.gat++;
    if (entry.meditation) stats.meditation++;
    if (entry.yoga) stats.yoga++;
    if (entry.llegir) stats.llegir++;
    if (entry.dibuix) stats.dibuix++;

    // Count sports
    const sports = entry.sports ? JSON.parse(entry.sports) : [];
    for (const sport of sports) {
      stats.sports[sport] = (stats.sports[sport] || 0) + 1;
    }

    // Average sleep quality - exclude null and 0 (treated as invalid)
    if (entry.sleepQuality !== null && entry.sleepQuality !== undefined && entry.sleepQuality >= 1 && entry.sleepQuality <= 10) {
      sleepQualitySum += entry.sleepQuality;
      sleepQualityCount++;
    }
  }

  if (sleepQualityCount > 0) {
    stats.averageSleepQuality = sleepQualitySum / sleepQualityCount;
  }

  return stats;
};
