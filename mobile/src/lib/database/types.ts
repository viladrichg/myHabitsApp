// User identity type
export interface UserProfile {
  id: number;
  name: string;
  createdAt: string;
  isActive: boolean;
}

// Database types for daily tracking
export interface DailyEntry {
  id: number;
  date: string; // YYYY-MM-DD format
  userId?: number; // Optional for backward compatibility

  // Sleep tracking
  bedtime: string | null; // HH:mm format
  wakeupTime: string | null; // HH:mm format
  sleepQuality: number | null; // 1-10

  // Work status (mutually exclusive)
  workedAtJob: boolean;
  workedAtHome: boolean;

  // Missed objectives (flags)
  fum: boolean;
  gat: boolean;

  // Activities (multi-select)
  meditation: boolean;
  yoga: boolean;
  dibuix: boolean;
  llegir: boolean;

  // Counter (0-20, nullable for existing entries)
  counter: number | null;

  // Sports (can have multiple)
  sports: string; // JSON array of sport names

  // Notes
  notes: string | null;

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export type ThemeStyle = 'light' | 'dark' | 'midnight' | 'forest' | 'ocean' | 'rose' | 'amber' | 'slate' | 'nord' | 'coffee' | 'lavender' | 'charcoal' | 'arctic' | 'peach' | 'mint' | 'sky' | 'lemon';
export type CalendarStyle = 'default' | 'minimal' | 'compact' | 'detailed';
export type SummaryDisplayStyle = 'percentage' | 'donut' | 'progress' | 'numbers';
export type ChartTimeframe = 'week' | '15days' | 'month' | '3months' | '6months' | 'year' | 'all';

/**
 * Controls how numeric field values are presented across all data-rendering
 * surfaces (tables, stats, charts).
 *
 * 'absolute' — raw cumulative or per-day counts (e.g. "12 days meditation")
 * 'percentage' — value divided by the number of tracked days (e.g. "40%")
 *
 * Conversion is applied exclusively in data-layer hooks (useNormalizedFieldValue,
 * useNormalizedStatistic) so that UI components remain pure renderers.
 */
export type DisplayMode = 'absolute' | 'percentage';

/**
 * Frequency at which the app generates and shares a backup export.
 * 'none' disables automatic backups.
 */
export type BackupFrequency = 'none' | 'weekly' | 'monthly';

export interface AppSettings {
  id: number;

  // Storage settings
  storageFormat: 'sqlite' | 'json';

  // Theme settings
  themeStyle: ThemeStyle;
  calendarStyle: CalendarStyle;
  summaryDisplayStyle: SummaryDisplayStyle;
  chartTimeframe: ChartTimeframe;

  /**
   * Controls how numeric values are displayed across all data surfaces.
   * Conversion is performed in the data layer, never in UI components.
   */
  displayMode: DisplayMode;

  // Notification settings
  notificationsEnabled: boolean;
  morningReminderTime: string; // HH:mm format
  eveningReminderTime: string; // HH:mm format
  reminderDays: string; // JSON array of days (0-6, 0=Sunday)

  // Appearance settings
  backgroundColor: string;
  sectionColor: string;
  buttonColor: string;
  textColor: string;
  calendarColor: string;
  chartColor: string;

  buttonShape: 'rounded' | 'square' | 'pill';
  cardRadius: number;

  fontFamily: string;
  fontSize: number;
  fontWeight: string;

  padding: number;
  spacing: number;
  layoutStyle: 'card' | 'list';

  // Section customization
  sectionLabels: string; // JSON object with custom labels
  sectionOrder: string; // JSON array of section order

  /**
   * Automatic backup configuration.
   * The backup scheduler reads these fields to decide when to generate
   * and share a CSV export. No server is involved — sharing is done via
   * the native share sheet (expo-sharing).
   */
  backupFrequency: BackupFrequency;
  backupEmail: string; // Pre-filled "To" address for the share sheet
  lastBackupDate: string | null; // ISO date string of last successful backup

  // Metadata
  createdAt: string;
  updatedAt: string;
}

export interface CustomSport {
  id: number;
  name: string;
  createdAt: string;
}

// Theme configurations
export const THEMES: Record<ThemeStyle, {
  name: string;
  bg: string;
  card: string;
  text: string;
  textSecondary: string;
  accent: string;
  border: string;
}> = {
  light: {
    name: 'Light',
    bg: '#f8fafc',
    card: '#ffffff',
    text: '#1e293b',
    textSecondary: '#64748b',
    accent: '#3b82f6',
    border: '#e2e8f0',
  },
  dark: {
    name: 'Dark',
    bg: '#0f172a',
    card: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    accent: '#3b82f6',
    border: '#334155',
  },
  midnight: {
    name: 'Midnight',
    bg: '#030712',
    card: '#111827',
    text: '#f9fafb',
    textSecondary: '#9ca3af',
    accent: '#8b5cf6',
    border: '#1f2937',
  },
  forest: {
    name: 'Forest',
    bg: '#052e16',
    card: '#14532d',
    text: '#ecfdf5',
    textSecondary: '#86efac',
    accent: '#22c55e',
    border: '#166534',
  },
  ocean: {
    name: 'Ocean',
    bg: '#0c4a6e',
    card: '#075985',
    text: '#f0f9ff',
    textSecondary: '#7dd3fc',
    accent: '#0ea5e9',
    border: '#0369a1',
  },
  rose: {
    name: 'Rose',
    bg: '#1a0a10',
    card: '#2d1320',
    text: '#fff1f2',
    textSecondary: '#fda4af',
    accent: '#f43f5e',
    border: '#4c1a28',
  },
  amber: {
    name: 'Amber',
    bg: '#1c1500',
    card: '#292100',
    text: '#fffbeb',
    textSecondary: '#fcd34d',
    accent: '#f59e0b',
    border: '#3d2e00',
  },
  slate: {
    name: 'Slate',
    bg: '#1a1f2e',
    card: '#252c3f',
    text: '#e2e8f0',
    textSecondary: '#94a3b8',
    accent: '#64748b',
    border: '#334155',
  },
  nord: {
    name: 'Nord',
    bg: '#2e3440',
    card: '#3b4252',
    text: '#eceff4',
    textSecondary: '#d8dee9',
    accent: '#88c0d0',
    border: '#4c566a',
  },
  coffee: {
    name: 'Coffee',
    bg: '#1c1008',
    card: '#2d1f10',
    text: '#fdf8f0',
    textSecondary: '#d4a96a',
    accent: '#b5752a',
    border: '#3d2a14',
  },
  lavender: {
    name: 'Lavender',
    bg: '#0f0b1e',
    card: '#1a1535',
    text: '#f5f3ff',
    textSecondary: '#c4b5fd',
    accent: '#7c3aed',
    border: '#2e2350',
  },
  charcoal: {
    name: 'Charcoal',
    bg: '#111111',
    card: '#1e1e1e',
    text: '#f5f5f5',
    textSecondary: '#a3a3a3',
    accent: '#737373',
    border: '#2a2a2a',
  },
  arctic: {
    name: 'Arctic',
    bg: '#e8f4f8',
    card: '#ffffff',
    text: '#1a3a4a',
    textSecondary: '#5a8a9f',
    accent: '#0891b2',
    border: '#bae6fd',
  },
  peach: {
    name: 'Peach',
    bg: '#fff5f0',
    card: '#ffede6',
    text: '#3d1a0a',
    textSecondary: '#9a5040',
    accent: '#e8654a',
    border: '#ffccc0',
  },
  mint: {
    name: 'Mint',
    bg: '#f0fdf8',
    card: '#dcfdf0',
    text: '#1a3d2a',
    textSecondary: '#4a8a70',
    accent: '#10b981',
    border: '#a7f3d0',
  },
  sky: {
    name: 'Sky',
    bg: '#f0f9ff',
    card: '#e0f2fe',
    text: '#1a304a',
    textSecondary: '#4a80a0',
    accent: '#0ea5e9',
    border: '#bae6fd',
  },
  lemon: {
    name: 'Lemon',
    bg: '#fefce8',
    card: '#fef9c3',
    text: '#3d3508',
    textSecondary: '#756820',
    accent: '#ca8a04',
    border: '#fde047',
  },
};

// Default settings
export const DEFAULT_SETTINGS: Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'> = {
  storageFormat: 'sqlite',
  themeStyle: 'dark',
  calendarStyle: 'default',
  summaryDisplayStyle: 'percentage',
  chartTimeframe: 'month',
  displayMode: 'absolute',
  notificationsEnabled: false,
  morningReminderTime: '09:00',
  eveningReminderTime: '23:00',
  reminderDays: JSON.stringify([1, 2, 3, 4, 5, 6, 0]), // All days
  backupFrequency: 'none',
  backupEmail: '',
  lastBackupDate: null,

  backgroundColor: '#0f172a',
  sectionColor: '#1e293b',
  buttonColor: '#3b82f6',
  textColor: '#f1f5f9',
  calendarColor: '#10b981',
  chartColor: '#8b5cf6',

  buttonShape: 'rounded',
  cardRadius: 16,

  fontFamily: 'System',
  fontSize: 16,
  fontWeight: 'normal',

  padding: 16,
  spacing: 12,
  layoutStyle: 'card',

  sectionLabels: JSON.stringify({
    sleep: 'Sleep',
    work: 'Work',
    objectives: 'Objectives',
    activities: 'Activities',
    sports: 'Sports',
    notes: 'Notes',
  }),
  sectionOrder: JSON.stringify(['sleep', 'work', 'objectives', 'activities', 'sports', 'notes']),
};
