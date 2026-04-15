import * as SQLite from 'expo-sqlite';
import { DailyEntry, AppSettings, CustomSport, UserProfile, DEFAULT_SETTINGS } from './types';

// Open database
const db = SQLite.openDatabaseSync('personal-tracker.db');

// Current active user ID (cached for performance)
let activeUserId: number | null = null;

// Initialize database with tables
export const initializeDatabase = async () => {
  try {
    // Create users table (new - safe addition)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `);

    // Create daily_entries table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS daily_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT UNIQUE NOT NULL,
        bedtime TEXT,
        wakeup_time TEXT,
        sleep_quality INTEGER,
        worked_at_job INTEGER DEFAULT 0,
        worked_at_home INTEGER DEFAULT 0,
        fum INTEGER DEFAULT 0,
        gat INTEGER DEFAULT 0,
        meditation INTEGER DEFAULT 0,
        yoga INTEGER DEFAULT 0,
        sports TEXT DEFAULT '[]',
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Create settings table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        storage_format TEXT DEFAULT 'sqlite',
        theme_style TEXT DEFAULT 'dark',
        calendar_style TEXT DEFAULT 'default',
        summary_display_style TEXT DEFAULT 'percentage',
        chart_timeframe TEXT DEFAULT 'month',
        notifications_enabled INTEGER DEFAULT 0,
        morning_reminder_time TEXT DEFAULT '09:00',
        evening_reminder_time TEXT DEFAULT '23:00',
        reminder_days TEXT DEFAULT '[1,2,3,4,5,6,0]',
        background_color TEXT DEFAULT '#0f172a',
        section_color TEXT DEFAULT '#1e293b',
        button_color TEXT DEFAULT '#3b82f6',
        text_color TEXT DEFAULT '#f1f5f9',
        calendar_color TEXT DEFAULT '#10b981',
        chart_color TEXT DEFAULT '#8b5cf6',
        button_shape TEXT DEFAULT 'rounded',
        card_radius INTEGER DEFAULT 16,
        font_family TEXT DEFAULT 'System',
        font_size INTEGER DEFAULT 16,
        font_weight TEXT DEFAULT 'normal',
        padding INTEGER DEFAULT 16,
        spacing INTEGER DEFAULT 12,
        layout_style TEXT DEFAULT 'card',
        section_labels TEXT,
        section_order TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Migration: Add new columns if they don't exist
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN theme_style TEXT DEFAULT 'dark'`);
    } catch (e) { /* Column already exists */ }
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN calendar_style TEXT DEFAULT 'default'`);
    } catch (e) { /* Column already exists */ }
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN summary_display_style TEXT DEFAULT 'percentage'`);
    } catch (e) { /* Column already exists */ }
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN chart_timeframe TEXT DEFAULT 'month'`);
    } catch (e) { /* Column already exists */ }
    // Migration: display_mode for absolute/percentage value presentation
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN display_mode TEXT DEFAULT 'absolute'`);
    } catch (e) { /* Column already exists */ }
    // Migration: backup scheduling fields
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN backup_frequency TEXT DEFAULT 'none'`);
    } catch (e) { /* Column already exists */ }
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN backup_email TEXT DEFAULT ''`);
    } catch (e) { /* Column already exists */ }
    try {
      await db.execAsync(`ALTER TABLE settings ADD COLUMN last_backup_date TEXT DEFAULT NULL`);
    } catch (e) { /* Column already exists */ }
    // Migration: Add user_id to daily_entries for user scoping (backward compatible)
    try {
      await db.execAsync(`ALTER TABLE daily_entries ADD COLUMN user_id INTEGER DEFAULT NULL`);
    } catch (e) { /* Column already exists */ }
    // Migration: Add dibuix column to daily_entries (backward compatible)
    try {
      await db.execAsync(`ALTER TABLE daily_entries ADD COLUMN dibuix INTEGER DEFAULT 0`);
    } catch (e) { /* Column already exists */ }

    // Migration: Add llegir column to daily_entries (backward compatible)
    try {
      await db.execAsync(`ALTER TABLE daily_entries ADD COLUMN llegir INTEGER DEFAULT 0`);
    } catch (e) { /* Column already exists */ }

    // Migration: Add counter column to daily_entries (backward compatible)
    try {
      await db.execAsync(`ALTER TABLE daily_entries ADD COLUMN counter INTEGER DEFAULT NULL`);
    } catch (e) { /* Column already exists */ }

    // Create custom_variables_meta table (for dynamic variable column tracking)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_variables_meta (
        id TEXT PRIMARY KEY,
        column_name TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Re-apply any previously created custom variable columns
    try {
      const existingCustomVars = await db.getAllAsync<{ id: string; column_name: string }>(
        'SELECT id, column_name FROM custom_variables_meta'
      );
      for (const cv of existingCustomVars) {
        try {
          await db.execAsync(`ALTER TABLE daily_entries ADD COLUMN "${cv.column_name}" INTEGER DEFAULT 0`);
        } catch (e) { /* Column already exists - safe to ignore */ }
      }
    } catch (e) { /* Table not ready yet */ }

    // Create custom_sports table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS custom_sports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    // Insert default settings if not exists
    const settingsResult = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM settings WHERE id = 1'
    );

    if (settingsResult && settingsResult.count === 0) {
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT INTO settings (
          id, storage_format, theme_style, calendar_style, summary_display_style,
          chart_timeframe, notifications_enabled, morning_reminder_time, evening_reminder_time,
          reminder_days, background_color, section_color, button_color, text_color,
          calendar_color, chart_color, button_shape, card_radius, font_family, font_size,
          font_weight, padding, spacing, layout_style, section_labels, section_order,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        1,
        DEFAULT_SETTINGS.storageFormat,
        DEFAULT_SETTINGS.themeStyle,
        DEFAULT_SETTINGS.calendarStyle,
        DEFAULT_SETTINGS.summaryDisplayStyle,
        DEFAULT_SETTINGS.chartTimeframe,
        DEFAULT_SETTINGS.notificationsEnabled ? 1 : 0,
        DEFAULT_SETTINGS.morningReminderTime,
        DEFAULT_SETTINGS.eveningReminderTime,
        DEFAULT_SETTINGS.reminderDays,
        DEFAULT_SETTINGS.backgroundColor,
        DEFAULT_SETTINGS.sectionColor,
        DEFAULT_SETTINGS.buttonColor,
        DEFAULT_SETTINGS.textColor,
        DEFAULT_SETTINGS.calendarColor,
        DEFAULT_SETTINGS.chartColor,
        DEFAULT_SETTINGS.buttonShape,
        DEFAULT_SETTINGS.cardRadius,
        DEFAULT_SETTINGS.fontFamily,
        DEFAULT_SETTINGS.fontSize,
        DEFAULT_SETTINGS.fontWeight,
        DEFAULT_SETTINGS.padding,
        DEFAULT_SETTINGS.spacing,
        DEFAULT_SETTINGS.layoutStyle,
        DEFAULT_SETTINGS.sectionLabels,
        DEFAULT_SETTINGS.sectionOrder,
        now,
        now
      );
    }

    // Add default sports
    const defaultSports = ['Exercise', 'Running', 'Swimming', 'Cycling', 'Yoga', 'Weightlifting'];
    for (const sport of defaultSports) {
      try {
        await db.runAsync(
          'INSERT OR IGNORE INTO custom_sports (name, created_at) VALUES (?, ?)',
          sport,
          new Date().toISOString()
        );
      } catch (error) {
        // Ignore duplicates
      }
    }

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
};

// Daily Entries CRUD operations
export const getDailyEntry = async (date: string): Promise<DailyEntry | null> => {
  try {
    // Validate date format
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      console.warn('Invalid date format for getDailyEntry:', date);
      return null;
    }

    const result = await db.getFirstAsync<any>(
      'SELECT * FROM daily_entries WHERE date = ?',
      date
    );

    if (!result) return null;

    return {
      id: result.id,
      date: result.date,
      bedtime: result.bedtime ?? null,
      wakeupTime: result.wakeup_time ?? null,
      sleepQuality: result.sleep_quality ?? null,
      workedAtJob: Boolean(result.worked_at_job),
      workedAtHome: Boolean(result.worked_at_home),
      fum: Boolean(result.fum),
      gat: Boolean(result.gat),
      meditation: Boolean(result.meditation),
      yoga: Boolean(result.yoga),
      dibuix: Boolean(result.dibuix),
      llegir: Boolean(result.llegir),
      counter: result.counter ?? null,
      sports: result.sports ?? '[]',
      notes: result.notes ?? null,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch (error) {
    console.error('Error getting daily entry:', error);
    return null;
  }
};

export const getAllDailyEntries = async (): Promise<DailyEntry[]> => {
  try {
    const results = await db.getAllAsync<any>('SELECT * FROM daily_entries ORDER BY date DESC');

    return results.map((result) => ({
      id: result.id,
      date: result.date,
      bedtime: result.bedtime,
      wakeupTime: result.wakeup_time,
      sleepQuality: result.sleep_quality,
      workedAtJob: Boolean(result.worked_at_job),
      workedAtHome: Boolean(result.worked_at_home),
      fum: Boolean(result.fum),
      gat: Boolean(result.gat),
      meditation: Boolean(result.meditation),
      yoga: Boolean(result.yoga),
      dibuix: Boolean(result.dibuix),
      llegir: Boolean(result.llegir),
      counter: result.counter ?? null,
      sports: result.sports,
      notes: result.notes,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  } catch (error) {
    console.error('Error getting all daily entries:', error);
    return [];
  }
};

export const saveDailyEntry = async (entry: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> => {
  try {
    // Validate required date field
    if (!entry.date || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) {
      throw new Error('Invalid date format. Expected YYYY-MM-DD');
    }

    // Validate time formats if provided
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    if (entry.bedtime && !timeRegex.test(entry.bedtime)) {
      console.warn('Invalid bedtime format, setting to null:', entry.bedtime);
      entry.bedtime = null;
    }
    if (entry.wakeupTime && !timeRegex.test(entry.wakeupTime)) {
      console.warn('Invalid wakeup time format, setting to null:', entry.wakeupTime);
      entry.wakeupTime = null;
    }

    // Validate sleep quality range (1-10 or null)
    if (entry.sleepQuality !== null && entry.sleepQuality !== undefined) {
      const quality = Number(entry.sleepQuality);
      if (isNaN(quality) || quality < 1 || quality > 10) {
        console.warn('Invalid sleep quality, clamping to valid range:', entry.sleepQuality);
        entry.sleepQuality = Math.max(1, Math.min(10, quality || 5));
      }
    }

    // Ensure sports is valid JSON string
    if (entry.sports && typeof entry.sports === 'string') {
      try {
        JSON.parse(entry.sports);
      } catch {
        console.warn('Invalid sports JSON, resetting to empty array');
        entry.sports = '[]';
      }
    } else {
      entry.sports = '[]';
    }

    const now = new Date().toISOString();
    const existing = await getDailyEntry(entry.date);

    if (existing) {
      // Update
      await db.runAsync(
        `UPDATE daily_entries SET
          bedtime = ?, wakeup_time = ?, sleep_quality = ?,
          worked_at_job = ?, worked_at_home = ?,
          fum = ?, gat = ?,
          meditation = ?, yoga = ?, dibuix = ?, llegir = ?,
          counter = ?,
          sports = ?, notes = ?,
          updated_at = ?
        WHERE date = ?`,
        entry.bedtime,
        entry.wakeupTime,
        entry.sleepQuality,
        entry.workedAtJob ? 1 : 0,
        entry.workedAtHome ? 1 : 0,
        entry.fum ? 1 : 0,
        entry.gat ? 1 : 0,
        entry.meditation ? 1 : 0,
        entry.yoga ? 1 : 0,
        entry.dibuix ? 1 : 0,
        entry.llegir ? 1 : 0,
        entry.counter,
        entry.sports,
        entry.notes,
        now,
        entry.date
      );
    } else {
      // Insert
      await db.runAsync(
        `INSERT INTO daily_entries (
          date, bedtime, wakeup_time, sleep_quality,
          worked_at_job, worked_at_home,
          fum, gat,
          meditation, yoga, dibuix, llegir,
          counter,
          sports, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        entry.date,
        entry.bedtime,
        entry.wakeupTime,
        entry.sleepQuality,
        entry.workedAtJob ? 1 : 0,
        entry.workedAtHome ? 1 : 0,
        entry.fum ? 1 : 0,
        entry.gat ? 1 : 0,
        entry.meditation ? 1 : 0,
        entry.yoga ? 1 : 0,
        entry.dibuix ? 1 : 0,
        entry.llegir ? 1 : 0,
        entry.counter,
        entry.sports,
        entry.notes,
        now,
        now
      );
    }
  } catch (error) {
    console.error('Error saving daily entry:', error);
    throw error;
  }
};

export const deleteDailyEntry = async (date: string): Promise<void> => {
  try {
    await db.runAsync('DELETE FROM daily_entries WHERE date = ?', date);
  } catch (error) {
    console.error('Error deleting daily entry:', error);
    throw error;
  }
};

// Settings CRUD operations
export const getSettings = async (): Promise<AppSettings | null> => {
  try {
    const result = await db.getFirstAsync<any>('SELECT * FROM settings WHERE id = 1');

    if (!result) return null;

    return {
      id: result.id,
      storageFormat: result.storage_format,
      themeStyle: result.theme_style || 'dark',
      calendarStyle: result.calendar_style || 'default',
      summaryDisplayStyle: result.summary_display_style || 'percentage',
      chartTimeframe: result.chart_timeframe || 'month',
      displayMode: result.display_mode || 'absolute',
      notificationsEnabled: Boolean(result.notifications_enabled),
      morningReminderTime: result.morning_reminder_time,
      eveningReminderTime: result.evening_reminder_time,
      reminderDays: result.reminder_days,
      backgroundColor: result.background_color,
      sectionColor: result.section_color,
      buttonColor: result.button_color,
      textColor: result.text_color,
      calendarColor: result.calendar_color,
      chartColor: result.chart_color,
      buttonShape: result.button_shape,
      cardRadius: result.card_radius,
      fontFamily: result.font_family,
      fontSize: result.font_size,
      fontWeight: result.font_weight,
      padding: result.padding,
      spacing: result.spacing,
      layoutStyle: result.layout_style,
      sectionLabels: result.section_labels,
      sectionOrder: result.section_order,
      backupFrequency: result.backup_frequency || 'none',
      backupEmail: result.backup_email || '',
      lastBackupDate: result.last_backup_date || null,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  } catch (error) {
    console.error('Error getting settings:', error);
    return null;
  }
};

export const updateSettings = async (settings: Partial<Omit<AppSettings, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const current = await getSettings();

    if (!current) {
      throw new Error('Settings not initialized');
    }

    const updated = { ...current, ...settings, updatedAt: now };

    await db.runAsync(
      `UPDATE settings SET
        storage_format = ?, theme_style = ?, calendar_style = ?, summary_display_style = ?,
        chart_timeframe = ?, display_mode = ?,
        notifications_enabled = ?,
        morning_reminder_time = ?, evening_reminder_time = ?, reminder_days = ?,
        background_color = ?, section_color = ?, button_color = ?, text_color = ?,
        calendar_color = ?, chart_color = ?,
        button_shape = ?, card_radius = ?,
        font_family = ?, font_size = ?, font_weight = ?,
        padding = ?, spacing = ?, layout_style = ?,
        section_labels = ?, section_order = ?,
        backup_frequency = ?, backup_email = ?, last_backup_date = ?,
        updated_at = ?
      WHERE id = 1`,
      updated.storageFormat,
      updated.themeStyle,
      updated.calendarStyle,
      updated.summaryDisplayStyle,
      updated.chartTimeframe,
      updated.displayMode,
      updated.notificationsEnabled ? 1 : 0,
      updated.morningReminderTime,
      updated.eveningReminderTime,
      updated.reminderDays,
      updated.backgroundColor,
      updated.sectionColor,
      updated.buttonColor,
      updated.textColor,
      updated.calendarColor,
      updated.chartColor,
      updated.buttonShape,
      updated.cardRadius,
      updated.fontFamily,
      updated.fontSize,
      updated.fontWeight,
      updated.padding,
      updated.spacing,
      updated.layoutStyle,
      updated.sectionLabels,
      updated.sectionOrder,
      updated.backupFrequency,
      updated.backupEmail,
      updated.lastBackupDate,
      now
    );
  } catch (error) {
    console.error('Error updating settings:', error);
    throw error;
  }
};

// Custom Sports operations
export const getAllCustomSports = async (): Promise<CustomSport[]> => {
  try {
    const results = await db.getAllAsync<any>('SELECT * FROM custom_sports ORDER BY name ASC');
    return results.map((result) => ({
      id: result.id,
      name: result.name,
      createdAt: result.created_at,
    }));
  } catch (error) {
    console.error('Error getting custom sports:', error);
    return [];
  }
};

export const addCustomSport = async (name: string): Promise<void> => {
  try {
    await db.runAsync(
      'INSERT INTO custom_sports (name, created_at) VALUES (?, ?)',
      name,
      new Date().toISOString()
    );
  } catch (error) {
    console.error('Error adding custom sport:', error);
    throw error;
  }
};

export const deleteCustomSport = async (id: number): Promise<void> => {
  try {
    await db.runAsync('DELETE FROM custom_sports WHERE id = ?', id);
  } catch (error) {
    console.error('Error deleting custom sport:', error);
    throw error;
  }
};

// ============ User Management Functions ============

// Check if any user exists (for first launch detection)
export const hasAnyUser = async (): Promise<boolean> => {
  try {
    const result = await db.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) as count FROM users'
    );
    return (result?.count ?? 0) > 0;
  } catch (error) {
    console.error('Error checking for users:', error);
    return false;
  }
};

// Get the active user
export const getActiveUser = async (): Promise<UserProfile | null> => {
  try {
    const result = await db.getFirstAsync<any>(
      'SELECT * FROM users WHERE is_active = 1 LIMIT 1'
    );
    if (!result) return null;

    // Cache the active user ID
    activeUserId = result.id;

    return {
      id: result.id,
      name: result.name,
      createdAt: result.created_at,
      isActive: Boolean(result.is_active),
    };
  } catch (error) {
    console.error('Error getting active user:', error);
    return null;
  }
};

// Get all users
export const getAllUsers = async (): Promise<UserProfile[]> => {
  try {
    const results = await db.getAllAsync<any>('SELECT * FROM users ORDER BY created_at ASC');
    return results.map((result) => ({
      id: result.id,
      name: result.name,
      createdAt: result.created_at,
      isActive: Boolean(result.is_active),
    }));
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
};

// Create a new user (safely)
export const createUser = async (name: string): Promise<UserProfile | null> => {
  try {
    // Validate name
    const safeName = (name || '').trim();
    if (!safeName) {
      throw new Error('User name cannot be empty');
    }

    const now = new Date().toISOString();

    // Deactivate all other users first
    await db.runAsync('UPDATE users SET is_active = 0');

    // Insert new user as active
    const result = await db.runAsync(
      'INSERT INTO users (name, is_active, created_at) VALUES (?, 1, ?)',
      safeName,
      now
    );

    // Get the inserted user ID
    const userId = result.lastInsertRowId;
    activeUserId = userId;

    // Migrate existing entries without user_id to this user (for backward compatibility)
    await db.runAsync(
      'UPDATE daily_entries SET user_id = ? WHERE user_id IS NULL',
      userId
    );

    return {
      id: userId,
      name: safeName,
      createdAt: now,
      isActive: true,
    };
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
};

// Switch to a different user
export const switchUser = async (userId: number): Promise<boolean> => {
  try {
    // Deactivate all users
    await db.runAsync('UPDATE users SET is_active = 0');

    // Activate the selected user
    await db.runAsync('UPDATE users SET is_active = 1 WHERE id = ?', userId);

    // Update cache
    activeUserId = userId;

    return true;
  } catch (error) {
    console.error('Error switching user:', error);
    return false;
  }
};

// Get cached active user ID (for quick access)
export const getActiveUserId = (): number | null => {
  return activeUserId;
};

// Refresh active user cache
export const refreshActiveUserCache = async (): Promise<void> => {
  const user = await getActiveUser();
  activeUserId = user?.id ?? null;
};

// =============================================================================
// CUSTOM VARIABLE COLUMN MANAGEMENT
// =============================================================================

// Sanitize a variable id to a safe column name
const toColumnName = (id: string): string => {
  // Replace non-alphanumeric with underscores, prefix with cv_
  return 'cv_' + id.replace(/[^a-zA-Z0-9_]/g, '_');
};

// Add a new column for a custom variable
export const addCustomVariableColumn = async (variableId: string): Promise<string> => {
  const colName = toColumnName(variableId);
  try {
    await db.execAsync(`ALTER TABLE daily_entries ADD COLUMN "${colName}" INTEGER DEFAULT 0`);
  } catch (e) {
    // Column may already exist - that's fine
  }
  // Register in meta table
  try {
    await db.runAsync(
      'INSERT OR IGNORE INTO custom_variables_meta (id, column_name, created_at) VALUES (?, ?, ?)',
      variableId,
      colName,
      new Date().toISOString()
    );
  } catch (e) {
    console.warn('Could not register custom variable column:', e);
  }
  return colName;
};

// Remove a custom variable column meta entry (SQLite can't drop columns, so we just hide it)
export const removeCustomVariableColumn = async (variableId: string): Promise<void> => {
  try {
    await db.runAsync('DELETE FROM custom_variables_meta WHERE id = ?', variableId);
  } catch (e) {
    console.warn('Could not remove custom variable meta:', e);
  }
};

// Get all registered custom variable column names
export const getCustomVariableColumns = async (): Promise<{ id: string; columnName: string }[]> => {
  try {
    const rows = await db.getAllAsync<{ id: string; column_name: string }>(
      'SELECT id, column_name FROM custom_variables_meta ORDER BY created_at ASC'
    );
    return rows.map((r) => ({ id: r.id, columnName: r.column_name }));
  } catch (e) {
    return [];
  }
};

// Get custom variable value for a date
export const getCustomVariableValue = async (date: string, columnName: string): Promise<number> => {
  try {
    const result = await db.getFirstAsync<any>(
      `SELECT "${columnName}" as val FROM daily_entries WHERE date = ?`,
      date
    );
    return result?.val ?? 0;
  } catch (e) {
    return 0;
  }
};

// Get all custom variable values for all entries
export const getAllCustomVariableValues = async (
  columnNames: string[]
): Promise<Record<string, Record<string, number>>> => {
  // Returns: { date: { columnName: value } }
  if (columnNames.length === 0) return {};
  try {
    const cols = columnNames.map((c) => `"${c}"`).join(', ');
    const rows = await db.getAllAsync<any>(
      `SELECT date, ${cols} FROM daily_entries ORDER BY date DESC`
    );
    const result: Record<string, Record<string, number>> = {};
    for (const row of rows) {
      result[row.date] = {};
      for (const col of columnNames) {
        result[row.date][col] = row[col] ?? 0;
      }
    }
    return result;
  } catch (e) {
    return {};
  }
};

// Save a custom variable value for a specific date
export const saveCustomVariableValue = async (
  date: string,
  columnName: string,
  value: number
): Promise<void> => {
  try {
    const existing = await getDailyEntry(date);
    if (existing) {
      await db.runAsync(
        `UPDATE daily_entries SET "${columnName}" = ? WHERE date = ?`,
        value,
        date
      );
    } else {
      // Create a minimal entry first
      const now = new Date().toISOString();
      await db.runAsync(
        `INSERT OR IGNORE INTO daily_entries (date, sports, created_at, updated_at) VALUES (?, '[]', ?, ?)`,
        date, now, now
      );
      await db.runAsync(
        `UPDATE daily_entries SET "${columnName}" = ? WHERE date = ?`,
        value,
        date
      );
    }
  } catch (e) {
    console.error('Error saving custom variable value:', e);
    throw e;
  }
};

export default db;
