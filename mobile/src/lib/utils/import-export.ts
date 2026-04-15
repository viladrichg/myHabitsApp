/**
 * Import/Export Module
 *
 * Handles data import with strict schema validation, duplicate prevention,
 * and support for CSV/JSON formats.
 *
 * CSV headers always use the CURRENT variable labels from the store.
 * Import strictly validates that headers match current labels.
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { DailyEntry } from '../database/types';
import { saveDailyEntry } from '../database/db';

// =============================================================================
// SCHEMA DEFINITION
// =============================================================================

export interface ImportSchema {
  date: { type: 'date'; required: true };
  bedtime: { type: 'time'; required: false };
  wakeupTime: { type: 'time'; required: false };
  sleepQuality: { type: 'number'; min: 1; max: 10; required: false };
  workedAtJob: { type: 'boolean'; required: false };
  workedAtHome: { type: 'boolean'; required: false };
  fum: { type: 'boolean'; required: false };
  gat: { type: 'boolean'; required: false };
  meditation: { type: 'boolean'; required: false };
  yoga: { type: 'boolean'; required: false };
  dibuix: { type: 'boolean'; required: false };
  llegir: { type: 'boolean'; required: false };
  sports: { type: 'json_array'; required: false };
  notes: { type: 'string'; required: false };
}

export interface ParsedEntry {
  date: string;
  bedtime: string | null;
  wakeupTime: string | null;
  sleepQuality: number | null;
  workedAtJob: boolean;
  workedAtHome: boolean;
  fum: boolean;
  gat: boolean;
  meditation: boolean;
  yoga: boolean;
  dibuix: boolean;
  llegir: boolean;
  counter: number | null;
  sports: string;
  // undefined = CSV cell was empty → preserve any existing note
  // null = explicitly clear the note
  // string = set this note text
  notes: string | null | undefined;
}

/**
 * Variable display labels used as CSV column headers.
 * Maps internal variable IDs to user-facing labels.
 */
export interface VariableLabels {
  workedAtJob: string;
  workedAtHome: string;
  fum: string;
  gat: string;
  meditation: string;
  yoga: string;
  dibuix: string;
  llegir: string;
  sports: string;
}

export const DEFAULT_VARIABLE_LABELS: VariableLabels = {
  workedAtJob: 'WorkedAtJob',
  workedAtHome: 'WorkedAtHome',
  fum: 'Fum',
  gat: 'Gat',
  meditation: 'Meditation',
  yoga: 'Yoga',
  dibuix: 'Dibuix',
  llegir: 'Llegir',
  sports: 'Sports',
};

export interface ImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  replaced: number;
  errors: string[];
  warnings: string[];
}

export interface ConflictInfo {
  conflictingDates: string[];
  newDates: string[];
  totalEntries: number;
}

export interface ValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export type ConflictResolution = 'replace' | 'skip' | 'cancel';

// =============================================================================
// COLUMN MAPPING
// =============================================================================

/** Normalize a header string: lowercase, no spaces */
function normalizeHeader(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '');
}

/**
 * Static column map for fields that don't change with variable labels.
 * Also includes legacy/fallback mappings for backwards compatibility.
 */
const STATIC_COLUMN_MAP: Record<string, keyof ParsedEntry> = {
  // Date
  date: 'date',
  fecha: 'date',
  data: 'date',

  // Bedtime
  bedtime: 'bedtime',
  bed_time: 'bedtime',

  // Wakeup
  wakeup: 'wakeupTime',
  wakeuptime: 'wakeupTime',
  wakeup_time: 'wakeupTime',

  // Sleep quality
  sleepquality: 'sleepQuality',
  sleep_quality: 'sleepQuality',
  quality: 'sleepQuality',

  // Notes
  notes: 'notes',
  note: 'notes',
  comments: 'notes',

  // Counter
  counter: 'counter',

  // Legacy variable mappings (for backwards compatibility; label mappings override these)
  workedatjob: 'workedAtJob',
  worked_at_job: 'workedAtJob',
  workedathome: 'workedAtHome',
  worked_at_home: 'workedAtHome',
  fum: 'fum',
  gat: 'gat',
  meditation: 'meditation',
  yoga: 'yoga',
  dibuix: 'dibuix',
  llegir: 'llegir',
  sports: 'sports',
  sport: 'sports',
  activities: 'sports',
};

/** Build a complete column map including current variable labels */
function buildColumnMap(labels?: VariableLabels): Record<string, keyof ParsedEntry> {
  const map: Record<string, keyof ParsedEntry> = { ...STATIC_COLUMN_MAP };
  if (!labels) return map;

  const add = (label: string, field: keyof ParsedEntry) => {
    map[normalizeHeader(label)] = field;
  };

  add(labels.workedAtJob, 'workedAtJob');
  add(labels.workedAtHome, 'workedAtHome');
  add(labels.fum, 'fum');
  add(labels.gat, 'gat');
  add(labels.meditation, 'meditation');
  add(labels.yoga, 'yoga');
  add(labels.dibuix, 'dibuix');
  add(labels.llegir, 'llegir');
  add(labels.sports, 'sports');

  return map;
}

/**
 * Validate that normalized CSV headers include all required variable labels.
 * Returns list of error strings (empty if all present).
 */
function validateVariableHeaders(
  normalizedHeaders: string[],
  labels: VariableLabels
): string[] {
  const errors: string[] = [];
  const expected: [string, string][] = [
    [labels.workedAtJob, 'WorkedAtJob'],
    [labels.workedAtHome, 'WorkedAtHome'],
    [labels.fum, 'Fum'],
    [labels.gat, 'Gat'],
    [labels.meditation, 'Meditation'],
    [labels.yoga, 'Yoga'],
    [labels.dibuix, 'Dibuix'],
    [labels.llegir, 'Llegir'],
    [labels.sports, 'Sports'],
  ];

  for (const [label] of expected) {
    if (!normalizedHeaders.includes(normalizeHeader(label))) {
      errors.push(`"${label}"`);
    }
  }
  return errors;
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;

function validateDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

function validateTime(value: string): boolean {
  return TIME_REGEX.test(value);
}

function parseBoolean(value: string | boolean | number | undefined | null): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (!value) return false;
  const v = String(value).toLowerCase().trim();
  return v === 'true' || v === '1' || v === 'yes' || v === 'y' || v === 'si' || v === 'sí';
}

function parseNumber(value: string | number | undefined | null, min: number, max: number): number | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return null;
  return Math.max(min, Math.min(max, num));
}

function parseSportsArray(value: string | string[] | undefined | null): string {
  if (!value) return '[]';

  if (Array.isArray(value)) {
    const filtered = value.filter((s) => typeof s === 'string' && s.trim());
    return JSON.stringify(filtered);
  }

  const strValue = String(value).trim();

  if (
    strValue === '' ||
    strValue.toLowerCase() === 'false' ||
    strValue === '[]' ||
    strValue.toLowerCase() === 'null' ||
    strValue === '0'
  ) {
    return '[]';
  }

  if (strValue.startsWith('[')) {
    try {
      const parsed = JSON.parse(strValue);
      if (Array.isArray(parsed)) {
        const filtered = parsed.filter((s) => typeof s === 'string' && s.trim());
        return JSON.stringify(filtered);
      }
    } catch {
      // Not valid JSON, continue
    }
  }

  if (strValue.includes(',')) {
    const sports = strValue
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter((s) => s && s.toLowerCase() !== 'false');
    return JSON.stringify(sports);
  }

  if (strValue && strValue !== '[]') {
    return JSON.stringify([strValue]);
  }

  return '[]';
}

// =============================================================================
// CSV PARSING — RFC 4180 compliant (handles multiline quoted fields)
// =============================================================================

/**
 * Parse the entire CSV content character by character.
 * Handles quoted fields that contain newlines, commas, quotes, and accented chars.
 * Returns raw rows (first row is the header).
 */
function parseCSVContent(content: string, sep: string = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;

  while (i < content.length) {
    const ch = content[i];

    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < content.length && content[i + 1] === '"') {
          // Escaped double-quote inside quoted field
          field += '"';
          i += 2;
        } else {
          // End of quoted field
          inQuotes = false;
          i++;
        }
      } else {
        // Everything inside quotes is literal (including \n)
        field += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === sep) {
        row.push(field.trim());
        field = '';
        i++;
      } else if (ch === '\r' && i + 1 < content.length && content[i + 1] === '\n') {
        // Windows-style CRLF
        row.push(field.trim());
        field = '';
        rows.push(row);
        row = [];
        i += 2;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field.trim());
        field = '';
        rows.push(row);
        row = [];
        i++;
      } else {
        field += ch;
        i++;
      }
    }
  }

  // Handle last field / row
  if (field !== '' || row.length > 0) {
    row.push(field.trim());
    rows.push(row);
  }

  return rows;
}

export function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  // Auto-detect separator: use semicolon if it appears more than comma in the first line
  const firstLine = content.trim().split(/\r?\n/)[0] ?? '';
  const semicolons = (firstLine.match(/;/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  const sep = semicolons > commas ? ';' : ',';

  const allRows = parseCSVContent(content, sep);

  // Filter comment lines (start with #) and empty rows
  const dataRows = allRows.filter((r) => {
    const first = (r[0] ?? '').trim();
    return first !== '' && !first.startsWith('#');
  });

  if (dataRows.length < 1) {
    throw new Error('CSV file must have at least a header row');
  }

  // Normalize headers: lowercase + no spaces
  const headers = dataRows[0].map((h) => normalizeHeader(h));
  const rows = dataRows.slice(1);

  return { headers, rows };
}

// =============================================================================
// ENTRY PARSING & VALIDATION
// =============================================================================

export function parseRowToEntry(
  headers: string[],
  values: string[],
  rowIndex: number,
  columnMap?: Record<string, keyof ParsedEntry>
): { entry: ParsedEntry | null; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  const map = columnMap ?? STATIC_COLUMN_MAP;
  const rawEntry: Record<string, string> = {};

  // Map columns to canonical names
  headers.forEach((header, index) => {
    const canonicalName = map[header];
    if (canonicalName && values[index] !== undefined) {
      rawEntry[canonicalName as string] = values[index];
    }
  });

  // Validate required date
  if (!rawEntry['date']) {
    errors.push({ row: rowIndex, field: 'date', value: '', message: 'Date is required' });
    return { entry: null, errors };
  }

  if (!validateDate(rawEntry['date'])) {
    errors.push({
      row: rowIndex,
      field: 'date',
      value: rawEntry['date'],
      message: 'Invalid date format. Expected YYYY-MM-DD',
    });
    return { entry: null, errors };
  }

  // Validate optional time fields
  let bedtime: string | null = null;
  if (rawEntry['bedtime']) {
    if (validateTime(rawEntry['bedtime'])) {
      bedtime = rawEntry['bedtime'];
    } else {
      errors.push({ row: rowIndex, field: 'bedtime', value: rawEntry['bedtime'], message: 'Invalid time format. Expected HH:mm' });
    }
  }

  let wakeupTime: string | null = null;
  if (rawEntry['wakeupTime']) {
    if (validateTime(rawEntry['wakeupTime'])) {
      wakeupTime = rawEntry['wakeupTime'];
    } else {
      errors.push({ row: rowIndex, field: 'wakeupTime', value: rawEntry['wakeupTime'], message: 'Invalid time format. Expected HH:mm' });
    }
  }

  // Notes: undefined means cell was empty → preserve existing note
  const rawNotes = rawEntry['notes'];
  const notes: string | null | undefined =
    rawNotes !== undefined && rawNotes !== '' ? rawNotes : undefined;

  const entry: ParsedEntry = {
    date: rawEntry['date'],
    bedtime,
    wakeupTime,
    sleepQuality: parseNumber(rawEntry['sleepQuality'], 1, 10),
    workedAtJob: parseBoolean(rawEntry['workedAtJob']),
    workedAtHome: parseBoolean(rawEntry['workedAtHome']),
    fum: parseBoolean(rawEntry['fum']),
    gat: parseBoolean(rawEntry['gat']),
    meditation: parseBoolean(rawEntry['meditation']),
    yoga: parseBoolean(rawEntry['yoga']),
    dibuix: parseBoolean(rawEntry['dibuix']),
    llegir: parseBoolean(rawEntry['llegir']),
    counter: parseNumber(rawEntry['counter'], 0, 25),
    sports: parseSportsArray(rawEntry['sports']),
    notes,
  };

  return { entry, errors };
}

// =============================================================================
// IMPORT FUNCTIONS
// =============================================================================

export async function importFromCSV(
  content: string,
  existingDates: Set<string>,
  labels?: VariableLabels
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    replaced: 0,
    errors: [],
    warnings: [],
  };

  try {
    const { headers, rows } = parseCSV(content);

    // Check date column
    const hasDateColumn = headers.some((h) => h === 'date' || h === 'data' || h === 'fecha');
    if (!hasDateColumn) {
      result.errors.push('CSV must have a "Data" column for dates.');
      return result;
    }

    // Try to match headers with current variable labels; fall back to static map for old exports
    let columnMap = buildColumnMap(labels);
    if (labels) {
      const missingCols = validateVariableHeaders(headers, labels);
      if (missingCols.length > 0) {
        // Fall back to static column map so old exports still import correctly
        columnMap = buildColumnMap(undefined);
        result.warnings.push('Some CSV column names did not match current variable names. Imported using best-effort matching.');
      }
    }
    const importedDates = new Set<string>();

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 2;
      const { entry, errors } = parseRowToEntry(headers, rows[i], rowIndex, columnMap);

      if (errors.length > 0) {
        errors.forEach((e) => result.errors.push(`Row ${e.row}: ${e.field} — ${e.message} (value: "${e.value}")`));
        result.skipped++;
        continue;
      }

      if (!entry) {
        result.skipped++;
        continue;
      }

      if (existingDates.has(entry.date)) {
        result.warnings.push(`Row ${rowIndex}: Date ${entry.date} already exists, skipping`);
        result.skipped++;
        continue;
      }

      if (importedDates.has(entry.date)) {
        result.warnings.push(`Row ${rowIndex}: Duplicate date ${entry.date} in import file, skipping`);
        result.skipped++;
        continue;
      }

      try {
        await saveDailyEntry({ ...entry, notes: entry.notes ?? null });
        importedDates.add(entry.date);
        result.imported++;
      } catch (error) {
        result.errors.push(`Row ${rowIndex}: Failed to save — ${String(error)}`);
        result.skipped++;
      }
    }

    result.success = result.imported > 0 || result.errors.length === 0;
  } catch (error) {
    result.errors.push(`Parse error: ${String(error)}`);
  }

  return result;
}

export async function importFromJSON(
  content: string,
  existingDates: Set<string>
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    replaced: 0,
    errors: [],
    warnings: [],
  };

  try {
    let data = JSON.parse(content);
    if (!Array.isArray(data)) data = [data];

    const importedDates = new Set<string>();

    for (let i = 0; i < data.length; i++) {
      const rawEntry = data[i];
      const rowIndex = i + 1;

      if (!rawEntry.date || !validateDate(rawEntry.date)) {
        result.errors.push(`Entry ${rowIndex}: Invalid or missing date`);
        result.skipped++;
        continue;
      }

      if (existingDates.has(rawEntry.date)) {
        result.warnings.push(`Entry ${rowIndex}: Date ${rawEntry.date} already exists, skipping`);
        result.skipped++;
        continue;
      }

      if (importedDates.has(rawEntry.date)) {
        result.warnings.push(`Entry ${rowIndex}: Duplicate date ${rawEntry.date} in import file, skipping`);
        result.skipped++;
        continue;
      }

      const entry: Omit<DailyEntry, 'id' | 'createdAt' | 'updatedAt'> = {
        date: rawEntry.date,
        bedtime: rawEntry.bedtime && validateTime(rawEntry.bedtime) ? rawEntry.bedtime : null,
        wakeupTime:
          (rawEntry.wakeupTime || rawEntry.wakeup_time) &&
          validateTime(rawEntry.wakeupTime || rawEntry.wakeup_time)
            ? rawEntry.wakeupTime || rawEntry.wakeup_time
            : null,
        sleepQuality: parseNumber(rawEntry.sleepQuality ?? rawEntry.sleep_quality, 1, 10),
        workedAtJob: parseBoolean(rawEntry.workedAtJob ?? rawEntry.worked_at_job),
        workedAtHome: parseBoolean(rawEntry.workedAtHome ?? rawEntry.worked_at_home),
        fum: parseBoolean(rawEntry.fum),
        gat: parseBoolean(rawEntry.gat),
        meditation: parseBoolean(rawEntry.meditation),
        yoga: parseBoolean(rawEntry.yoga),
        dibuix: parseBoolean(rawEntry.dibuix),
        llegir: parseBoolean(rawEntry.llegir),
        counter: parseNumber(rawEntry.counter ?? null, 0, 25),
        sports: parseSportsArray(rawEntry.sports),
        notes: rawEntry.notes ?? null,
      };

      try {
        await saveDailyEntry(entry);
        importedDates.add(rawEntry.date);
        result.imported++;
      } catch (error) {
        result.errors.push(`Entry ${rowIndex}: Failed to save — ${String(error)}`);
        result.skipped++;
      }
    }

    result.success = result.imported > 0 || result.errors.length === 0;
  } catch (error) {
    result.errors.push(`JSON parse error: ${String(error)}`);
  }

  return result;
}

// =============================================================================
// NOTES-ONLY IMPORT
// =============================================================================

export interface NotesOnlyEntry {
  date: string;
  notes: string;
}

export interface NotesImportResult {
  success: boolean;
  updated: number;
  inserted: number;
  skipped: number;
  errors: string[];
  warnings: string[];
}

/**
 * Parse notes-only CSV (Data,Notes format).
 * Multi-line notes in quoted cells are fully supported.
 * Empty notes cells are skipped (no change to existing notes).
 */
export function parseNotesOnlyCSV(content: string): { entries: NotesOnlyEntry[]; errors: string[] } {
  const entries: NotesOnlyEntry[] = [];
  const errors: string[] = [];

  try {
    const { headers, rows } = parseCSV(content);

    const dateIndex = headers.findIndex((h) => h === 'date' || h === 'data' || h === 'fecha');
    const notesIndex = headers.findIndex((h) => h === 'notes' || h === 'note' || h === 'comments');

    if (dateIndex === -1) {
      errors.push('CSV must have a "Data" column');
      return { entries, errors };
    }
    if (notesIndex === -1) {
      errors.push('CSV must have a "Notes" column');
      return { entries, errors };
    }

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowIndex = i + 2;
      const date = row[dateIndex]?.trim();
      // Notes field: use the raw value from the parsed row (already unquoted by parseCSVContent)
      const notes = row[notesIndex] ?? '';

      if (!date) {
        errors.push(`Row ${rowIndex}: Missing date`);
        continue;
      }
      if (!validateDate(date)) {
        errors.push(`Row ${rowIndex}: Invalid date format "${date}". Expected YYYY-MM-DD`);
        continue;
      }
      // Skip empty notes — do not clear existing notes
      if (!notes.trim()) continue;

      entries.push({ date, notes });
    }
  } catch (e) {
    errors.push(`CSV parse error: ${String(e)}`);
  }

  return { entries, errors };
}

/**
 * Import notes only. Updates ONLY the Notes field.
 * Does not touch any other field.
 * If the date doesn't exist, the row is skipped.
 * If the note cell is empty, the existing note is preserved.
 */
export async function importNotesOnly(
  content: string,
  existingEntriesMap: Map<string, DailyEntry>
): Promise<NotesImportResult> {
  const result: NotesImportResult = {
    success: false,
    updated: 0,
    inserted: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const { entries, errors } = parseNotesOnlyCSV(content);
  result.errors.push(...errors);

  if (entries.length === 0 && errors.length > 0) return result;

  const processedDates = new Set<string>();

  for (const { date, notes } of entries) {
    if (processedDates.has(date)) {
      result.warnings.push(`Duplicate date ${date} in import file, using first occurrence`);
      result.skipped++;
      continue;
    }
    processedDates.add(date);

    const existingEntry = existingEntriesMap.get(date);
    if (!existingEntry) {
      // Per spec: date doesn't exist → skip (no error)
      result.skipped++;
      continue;
    }

    try {
      await saveDailyEntry({
        ...existingEntry,
        date: existingEntry.date,
        bedtime: existingEntry.bedtime ?? null,
        wakeupTime: existingEntry.wakeupTime ?? null,
        sleepQuality: existingEntry.sleepQuality ?? null,
        workedAtJob: existingEntry.workedAtJob ?? false,
        workedAtHome: existingEntry.workedAtHome ?? false,
        fum: existingEntry.fum ?? false,
        gat: existingEntry.gat ?? false,
        meditation: existingEntry.meditation ?? false,
        yoga: existingEntry.yoga ?? false,
        dibuix: existingEntry.dibuix ?? false,
        llegir: existingEntry.llegir ?? false,
        counter: existingEntry.counter ?? null,
        sports: existingEntry.sports ?? '[]',
        notes, // Only this changes
      });
      result.updated++;
    } catch (error) {
      result.errors.push(`Date ${date}: Failed to save — ${String(error)}`);
      result.skipped++;
    }
  }

  result.success = result.updated > 0 || result.inserted > 0 || result.errors.length === 0;
  return result;
}

// =============================================================================
// FILE HANDLING
// =============================================================================

export function parseFileForConflicts(
  content: string,
  fileType: 'json' | 'csv',
  labels?: VariableLabels
): { dates: string[]; entries: ParsedEntry[]; errors: string[] } {
  const dates: string[] = [];
  const entries: ParsedEntry[] = [];
  const errors: string[] = [];

  if (fileType === 'json') {
    try {
      let data = JSON.parse(content);
      if (!Array.isArray(data)) data = [data];

      for (let i = 0; i < data.length; i++) {
        const rawEntry = data[i];
        if (rawEntry.date && validateDate(rawEntry.date)) {
          dates.push(rawEntry.date);
          entries.push({
            date: rawEntry.date,
            bedtime: rawEntry.bedtime && validateTime(rawEntry.bedtime) ? rawEntry.bedtime : null,
            wakeupTime:
              (rawEntry.wakeupTime || rawEntry.wakeup_time) &&
              validateTime(rawEntry.wakeupTime || rawEntry.wakeup_time)
                ? rawEntry.wakeupTime || rawEntry.wakeup_time
                : null,
            sleepQuality: parseNumber(rawEntry.sleepQuality ?? rawEntry.sleep_quality, 1, 10),
            workedAtJob: parseBoolean(rawEntry.workedAtJob ?? rawEntry.worked_at_job),
            workedAtHome: parseBoolean(rawEntry.workedAtHome ?? rawEntry.worked_at_home),
            fum: parseBoolean(rawEntry.fum),
            gat: parseBoolean(rawEntry.gat),
            meditation: parseBoolean(rawEntry.meditation),
            yoga: parseBoolean(rawEntry.yoga),
            dibuix: parseBoolean(rawEntry.dibuix),
            llegir: parseBoolean(rawEntry.llegir),
            counter: parseNumber(rawEntry.counter ?? null, 0, 25),
            sports: parseSportsArray(rawEntry.sports),
            notes: rawEntry.notes ?? undefined,
          });
        } else {
          errors.push(`Entry ${i + 1}: Invalid or missing date`);
        }
      }
    } catch (e) {
      errors.push(`JSON parse error: ${String(e)}`);
    }
  } else {
    try {
      const { headers, rows } = parseCSV(content);

      // Try to match headers with current variable labels; fall back to static map for old exports
      let columnMap = buildColumnMap(labels);
      if (labels) {
        const missingCols = validateVariableHeaders(headers, labels);
        if (missingCols.length > 0) {
          // Fall back to static column map so old exports still import correctly
          columnMap = buildColumnMap(undefined);
        }
      }
      for (let i = 0; i < rows.length; i++) {
        const { entry, errors: rowErrors } = parseRowToEntry(headers, rows[i], i + 2, columnMap);
        if (entry) {
          dates.push(entry.date);
          entries.push(entry);
        }
        rowErrors.forEach((e) => errors.push(`Row ${e.row}: ${e.message}`));
      }
    } catch (e) {
      errors.push(`CSV parse error: ${String(e)}`);
    }
  }

  return { dates, entries, errors };
}

export function detectConflicts(
  importDates: string[],
  existingDates: Set<string>
): ConflictInfo {
  const conflictingDates: string[] = [];
  const newDates: string[] = [];

  for (const date of importDates) {
    if (existingDates.has(date)) {
      conflictingDates.push(date);
    } else {
      newDates.push(date);
    }
  }

  return { conflictingDates, newDates, totalEntries: importDates.length };
}

export async function pickFileAndCheckConflicts(
  existingDates: Set<string>,
  labels?: VariableLabels
): Promise<{
  conflicts: ConflictInfo;
  entries: ParsedEntry[];
  fileType: string;
  errors: string[];
} | null> {
  try {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: [
        'application/json',
        'text/csv',
        'text/comma-separated-values',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '*/*',
      ],
      copyToCacheDirectory: true,
    });

    if (pickerResult.canceled) return null;

    const file = pickerResult.assets[0];
    const fileName = file.name?.toLowerCase() ?? '';

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm') || fileName.endsWith('.xls')) {
      return {
        conflicts: { conflictingDates: [], newDates: [], totalEntries: 0 },
        entries: [],
        fileType: 'excel',
        errors: ['Excel files cannot be imported directly. Please export to CSV first.'],
      };
    }

    const content = await FileSystem.readAsStringAsync(file.uri);
    const trimmed = content.trim();

    let fileType: 'json' | 'csv';
    if (fileName.endsWith('.json') || trimmed.startsWith('[') || trimmed.startsWith('{')) {
      fileType = 'json';
    } else {
      fileType = 'csv';
    }

    const { dates, entries, errors } = parseFileForConflicts(content, fileType, labels);
    const conflicts = detectConflicts(dates, existingDates);

    return { conflicts, entries, fileType, errors };
  } catch (error) {
    return {
      conflicts: { conflictingDates: [], newDates: [], totalEntries: 0 },
      entries: [],
      fileType: 'unknown',
      errors: [`File error: ${String(error)}`],
    };
  }
}

/**
 * Import entries with conflict resolution.
 * When an entry has notes=undefined (empty CSV cell), existing notes are preserved.
 * Pass existingEntriesMap to enable note preservation on "replace".
 */
export async function importWithConflictResolution(
  entries: ParsedEntry[],
  existingDates: Set<string>,
  resolution: ConflictResolution,
  existingEntriesMap?: Map<string, DailyEntry>
): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: 0,
    skipped: 0,
    replaced: 0,
    errors: [],
    warnings: [],
  };

  if (resolution === 'cancel') {
    result.warnings.push('Import cancelled by user');
    return result;
  }

  const importedDates = new Set<string>();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const rowIndex = i + 1;

    if (importedDates.has(entry.date)) {
      result.warnings.push(`Entry ${rowIndex}: Duplicate date ${entry.date} in import file, skipping`);
      result.skipped++;
      continue;
    }

    const isConflict = existingDates.has(entry.date);

    if (isConflict) {
      if (resolution === 'skip') {
        result.warnings.push(`Entry ${rowIndex}: Date ${entry.date} already exists, skipping`);
        result.skipped++;
        continue;
      } else if (resolution === 'replace') {
        try {
          // Preserve existing notes if the CSV cell was empty (notes === undefined)
          let finalNotes: string | null = entry.notes ?? null;
          if (entry.notes === undefined && existingEntriesMap) {
            const existing = existingEntriesMap.get(entry.date);
            finalNotes = existing?.notes ?? null;
          }
          await saveDailyEntry({ ...entry, notes: finalNotes });
          importedDates.add(entry.date);
          result.replaced++;
        } catch (error) {
          result.errors.push(`Entry ${rowIndex}: Failed to replace — ${String(error)}`);
          result.skipped++;
        }
        continue;
      }
    }

    // No conflict — new entry
    try {
      // For new entries: if notes is undefined, save as null (no existing note to preserve)
      await saveDailyEntry({ ...entry, notes: entry.notes ?? null });
      importedDates.add(entry.date);
      result.imported++;
    } catch (error) {
      result.errors.push(`Entry ${rowIndex}: Failed to save — ${String(error)}`);
      result.skipped++;
    }
  }

  result.success = (result.imported > 0 || result.replaced > 0) || result.errors.length === 0;
  return result;
}

export async function pickAndImportFile(
  existingDates: Set<string>
): Promise<{ result: ImportResult; fileType: string } | null> {
  try {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: [
        'application/json',
        'text/csv',
        'text/comma-separated-values',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '*/*',
      ],
      copyToCacheDirectory: true,
    });

    if (pickerResult.canceled) return null;

    const file = pickerResult.assets[0];
    const fileName = file.name?.toLowerCase() ?? '';

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xlsm') || fileName.endsWith('.xls')) {
      return {
        result: {
          success: false,
          imported: 0,
          skipped: 0,
          replaced: 0,
          errors: [
            'Excel files cannot be imported directly.',
            '1. Open the file in Excel, Numbers, or Google Sheets',
            '2. File → Save As → CSV format',
            '3. Import the CSV file',
          ],
          warnings: [],
        },
        fileType: 'excel',
      };
    }

    const content = await FileSystem.readAsStringAsync(file.uri);

    if (fileName.endsWith('.json')) {
      const result = await importFromJSON(content, existingDates);
      return { result, fileType: 'json' };
    } else if (fileName.endsWith('.csv')) {
      const result = await importFromCSV(content, existingDates);
      return { result, fileType: 'csv' };
    } else {
      const trimmed = content.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const result = await importFromJSON(content, existingDates);
        return { result, fileType: 'json' };
      } else {
        const result = await importFromCSV(content, existingDates);
        return { result, fileType: 'csv' };
      }
    }
  } catch (error) {
    return {
      result: {
        success: false,
        imported: 0,
        skipped: 0,
        replaced: 0,
        errors: [`File error: ${String(error)}`],
        warnings: [],
      },
      fileType: 'unknown',
    };
  }
}

// =============================================================================
// TEMPLATE GENERATION — uses current variable labels
// =============================================================================

function getExampleDates(): string[] {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

/** Build the CSV header row using current labels */
function buildHeaderRow(labels: VariableLabels, includeNotes: boolean): string {
  const cols = [
    'Data', 'Wakeup', 'SleepQuality', 'Bedtime',
    labels.workedAtJob, labels.workedAtHome,
    labels.fum, labels.gat,
    labels.meditation, labels.yoga, labels.dibuix, labels.llegir,
    labels.sports,
  ];
  if (includeNotes) cols.push('Notes');
  return cols.join(',');
}

export function generateFullExportTemplate(labels: VariableLabels = DEFAULT_VARIABLE_LABELS): string {
  const dates = getExampleDates();
  const header = buildHeaderRow(labels, true);
  return `# FULL EXPORT TEMPLATE (All Fields)
# Headers use current variable names from Settings → Variables & Colors
${header}
${dates[0]},07:00,8,23:00,1,0,0,0,1,0,0,1,"Running","Example note"
${dates[1]},07:30,7,23:30,0,1,0,0,0,1,0,0,"","Worked from home"
`;
}

export function generateDataOnlyExportTemplate(labels: VariableLabels = DEFAULT_VARIABLE_LABELS): string {
  const dates = getExampleDates();
  const header = buildHeaderRow(labels, false);
  return `# DATA ONLY EXPORT TEMPLATE (No Notes)
# Headers use current variable names from Settings → Variables & Colors
${header}
${dates[0]},07:00,8,23:00,1,0,0,0,1,0,0,1,"Running"
${dates[1]},07:30,7,23:30,0,1,0,0,0,1,0,0,""
`;
}

export function generateNotesOnlyExportTemplate(): string {
  const dates = getExampleDates();
  return `# NOTES ONLY EXPORT TEMPLATE
Data,Notes
${dates[0]},"Morning meditation was great"
${dates[1]},"Rainy day, stayed in"
`;
}

export function generateFullImportTemplate(labels: VariableLabels = DEFAULT_VARIABLE_LABELS): string {
  const dates = getExampleDates();
  const header = buildHeaderRow(labels, true);
  return `# IMPORT FULL DATA TEMPLATE
# ============================================================
# Instructions:
# 1. Delete these comment lines (lines starting with #) before importing
# 2. Fill in your data below the header row
# 3. Save as .csv file
#
# Column headers MUST exactly match current variable names.
# Check Settings → Variables & Colors for current names.
#
# Date: REQUIRED. Format YYYY-MM-DD
# Wakeup / Bedtime: Format HH:mm
# SleepQuality: 1-10
# Boolean fields: 1/0, true/false, yes/no
# ${labels.sports}: comma-separated in quotes: "Running, Yoga"
# Notes: text in quotes, may span multiple lines
#
${header}
${dates[0]},07:00,8,23:00,1,0,0,0,1,0,0,1,"Running","Good day"
${dates[1]},07:30,7,23:30,0,1,0,0,0,1,0,0,"","Worked from home"
${dates[2]},,,,0,0,0,0,0,0,0,0,"",""
`;
}

export function generateDataOnlyImportTemplate(labels: VariableLabels = DEFAULT_VARIABLE_LABELS): string {
  const dates = getExampleDates();
  const header = buildHeaderRow(labels, false);
  return `# IMPORT DATA WITHOUT NOTES TEMPLATE
# ============================================================
# This template imports all fields EXCEPT Notes.
# Existing notes will remain unchanged.
#
# Date: REQUIRED. Format YYYY-MM-DD
# Boolean fields: 1/0, true/false, yes/no
#
${header}
${dates[0]},07:00,8,23:00,1,0,0,0,1,0,0,1,"Running"
${dates[1]},07:30,7,23:30,0,1,0,0,0,1,0,0,""
${dates[2]},,,,0,0,0,0,0,0,0,0,""
`;
}

export function generateNotesOnlyImportTemplate(): string {
  const dates = getExampleDates();
  return `# IMPORT NOTES ONLY TEMPLATE
# ============================================================
# Updates ONLY the Notes field for existing dates.
# Dates not found in the database are skipped.
# Empty note cells are ignored (existing notes preserved).
#
Data,Notes
${dates[0]},"Morning was productive"
${dates[1]},"Rainy day"
${dates[2]},"Rest day"
`;
}

/** Generate a blank import template (header only + one empty row) */
export function generateBlankImportTemplate(labels: VariableLabels = DEFAULT_VARIABLE_LABELS): string {
  const header = buildHeaderRow(labels, true);
  return `${header}
,,,,,,,,,,,,,""\n`;
}

export type TemplateType =
  | 'full-export'
  | 'data-only-export'
  | 'notes-only-export'
  | 'full-import'
  | 'data-only-import'
  | 'notes-only-import'
  | 'blank-import';

export async function downloadTemplateByType(
  templateType: TemplateType,
  labels: VariableLabels = DEFAULT_VARIABLE_LABELS
): Promise<boolean> {
  try {
    let content: string;
    let fileName: string;

    switch (templateType) {
      case 'full-export':
        content = generateFullExportTemplate(labels);
        fileName = 'template-full-export.csv';
        break;
      case 'data-only-export':
        content = generateDataOnlyExportTemplate(labels);
        fileName = 'template-data-only-export.csv';
        break;
      case 'notes-only-export':
        content = generateNotesOnlyExportTemplate();
        fileName = 'template-notes-only-export.csv';
        break;
      case 'full-import':
        content = generateFullImportTemplate(labels);
        fileName = 'template-full-import.csv';
        break;
      case 'data-only-import':
        content = generateDataOnlyImportTemplate(labels);
        fileName = 'template-data-only-import.csv';
        break;
      case 'notes-only-import':
        content = generateNotesOnlyImportTemplate();
        fileName = 'template-notes-only-import.csv';
        break;
      case 'blank-import':
        content = generateBlankImportTemplate(labels);
        fileName = 'template-blank-import.csv';
        break;
    }

    const path = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, content);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, {
        mimeType: 'text/csv',
        dialogTitle: `Download ${templateType} Template`,
      });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Template download error:', error);
    return false;
  }
}

// =============================================================================
// EXPORT FUNCTIONS — use current variable labels in headers
// =============================================================================

/**
 * Full dataset CSV export.
 * Headers use current variable labels.
 * Newest date first.
 */
export function entriesToFullCSV(
  entries: DailyEntry[],
  labels: VariableLabels = DEFAULT_VARIABLE_LABELS
): string {
  const header = buildHeaderRow(labels, true);

  const rows = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      let sportsStr = '';
      try {
        const arr = e.sports ? JSON.parse(e.sports) : [];
        if (Array.isArray(arr) && arr.length > 0) sportsStr = arr.join(', ');
      } catch { /* ignore */ }

      const escapedNotes = (e.notes || '').replace(/"/g, '""');

      return [
        e.date,
        e.wakeupTime || '',
        e.sleepQuality?.toString() || '',
        e.bedtime || '',
        e.workedAtJob ? '1' : '0',
        e.workedAtHome ? '1' : '0',
        e.fum ? '1' : '0',
        e.gat ? '1' : '0',
        e.meditation ? '1' : '0',
        e.yoga ? '1' : '0',
        e.dibuix ? '1' : '0',
        e.llegir ? '1' : '0',
        `"${sportsStr}"`,
        `"${escapedNotes}"`,
      ].join(',');
    })
    .join('\n');

  return header + '\n' + rows;
}

/**
 * Data-only CSV export (no Notes column).
 * Headers use current variable labels.
 */
export function entriesToDataOnlyCSV(
  entries: DailyEntry[],
  labels: VariableLabels = DEFAULT_VARIABLE_LABELS
): string {
  const header = buildHeaderRow(labels, false);

  const rows = [...entries]
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      let sportsStr = '';
      try {
        const arr = e.sports ? JSON.parse(e.sports) : [];
        if (Array.isArray(arr) && arr.length > 0) sportsStr = arr.join(', ');
      } catch { /* ignore */ }

      return [
        e.date,
        e.wakeupTime || '',
        e.sleepQuality?.toString() || '',
        e.bedtime || '',
        e.workedAtJob ? '1' : '0',
        e.workedAtHome ? '1' : '0',
        e.fum ? '1' : '0',
        e.gat ? '1' : '0',
        e.meditation ? '1' : '0',
        e.yoga ? '1' : '0',
        e.dibuix ? '1' : '0',
        e.llegir ? '1' : '0',
        `"${sportsStr}"`,
      ].join(',');
    })
    .join('\n');

  return header + '\n' + rows;
}

/**
 * Notes-only CSV export (Date + Notes only).
 */
export function entriesToNotesOnlyCSV(entries: DailyEntry[]): string {
  const header = 'Data,Notes';

  const rows = entries
    .filter((e) => e.notes && e.notes.trim())
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((e) => {
      const escapedNotes = (e.notes || '').replace(/"/g, '""');
      return `${e.date},"${escapedNotes}"`;
    })
    .join('\n');

  return header + '\n' + rows;
}

/** Legacy alias */
export function entriesToCSV(
  entries: DailyEntry[],
  labels: VariableLabels = DEFAULT_VARIABLE_LABELS
): string {
  return entriesToFullCSV(entries, labels);
}

export function entriesToJSON(entries: DailyEntry[]): string {
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  return JSON.stringify(sorted, null, 2);
}

export function entriesToText(
  entries: DailyEntry[],
  labels: VariableLabels = DEFAULT_VARIABLE_LABELS
): string {
  let text = 'DAILY TRACKER EXPORT\n';
  text += '='.repeat(40) + '\n\n';

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));

  sorted.forEach((e) => {
    text += `Date: ${e.date}\n`;
    if (e.wakeupTime) text += `  Wakeup: ${e.wakeupTime}\n`;
    if (e.sleepQuality) text += `  Sleep Quality: ${e.sleepQuality}/10\n`;
    if (e.bedtime) text += `  Bedtime: ${e.bedtime}\n`;
    if (e.workedAtJob) text += `  ${labels.workedAtJob}: Yes\n`;
    if (e.workedAtHome) text += `  ${labels.workedAtHome}: Yes\n`;
    if (e.fum) text += `  ${labels.fum}: Yes\n`;
    if (e.gat) text += `  ${labels.gat}: Yes\n`;
    if (e.meditation) text += `  ${labels.meditation}: Yes\n`;
    if (e.yoga) text += `  ${labels.yoga}: Yes\n`;
    if (e.dibuix) text += `  ${labels.dibuix}: Yes\n`;
    if (e.llegir) text += `  ${labels.llegir}: Yes\n`;

    try {
      const sports = e.sports ? JSON.parse(e.sports) : [];
      if (sports.length > 0) text += `  ${labels.sports}: ${sports.join(', ')}\n`;
    } catch { /* ignore */ }

    if (e.notes) text += `  Notes: ${e.notes}\n`;
    text += '\n';
  });

  return text;
}

export type ExportFormat = 'csv' | 'json' | 'text' | 'csv-full' | 'csv-notes' | 'csv-data';

export async function exportToFile(
  entries: DailyEntry[],
  format: ExportFormat,
  labels: VariableLabels = DEFAULT_VARIABLE_LABELS
): Promise<boolean> {
  try {
    let content: string;
    let fileName: string;
    let mimeType: string;

    switch (format) {
      case 'csv':
      case 'csv-full':
        content = entriesToFullCSV(entries, labels);
        fileName = 'daily-tracker-full-export.csv';
        mimeType = 'text/csv';
        break;
      case 'csv-notes':
        content = entriesToNotesOnlyCSV(entries);
        fileName = 'daily-tracker-notes-export.csv';
        mimeType = 'text/csv';
        break;
      case 'csv-data':
        content = entriesToDataOnlyCSV(entries, labels);
        fileName = 'daily-tracker-data-export.csv';
        mimeType = 'text/csv';
        break;
      case 'json':
        content = entriesToJSON(entries);
        fileName = 'daily-tracker-export.json';
        mimeType = 'application/json';
        break;
      case 'text':
        content = entriesToText(entries, labels);
        fileName = 'daily-tracker-export.txt';
        mimeType = 'text/plain';
        break;
    }

    const path = `${FileSystem.cacheDirectory}${fileName}`;
    await FileSystem.writeAsStringAsync(path, content);

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(path, { mimeType, dialogTitle: `Export as ${format.toUpperCase()}` });
      return true;
    }
    return false;
  } catch (error) {
    console.error('Export error:', error);
    return false;
  }
}

// =============================================================================
// EMOJI STRIPPING UTILITY
// =============================================================================

export function stripEmojis(str: string): string {
  return str
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, '')
    .replace(/[\u{2600}-\u{26FF}]/gu, '')
    .replace(/[\u{2700}-\u{27BF}]/gu, '')
    .replace(/[\uFE00-\uFE0F]/g, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
