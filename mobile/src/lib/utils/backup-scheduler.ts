/**
 * Backup Scheduler
 *
 * Generates a CSV export and triggers the native share sheet on a
 * weekly or monthly schedule. There is NO server dependency: sharing
 * uses expo-sharing (native share sheet) so the user can send the file
 * to any app — email client, cloud drive, AirDrop, etc.
 *
 * WHERE THIS LOGIC LIVES
 *   Scheduling state is owned by the settings table (backup_frequency,
 *   backup_email, last_backup_date). This file is the single module that
 *   reads those fields and decides whether a backup is due.
 *
 * WHAT RE-ENABLES A BACKUP
 *   Only two conditions trigger a new backup:
 *     1. Manual call to runBackupNow().
 *     2. App launch after the due date has passed (checked in _layout.tsx).
 *
 * OFFLINE BEHAVIOUR
 *   The backup is generated from the local SQLite database. No network
 *   call is made at any point. The share sheet is always available.
 *
 * XCODE / LOCAL BUILD
 *   This file has no Vibecode SDK imports. It depends only on:
 *     - expo-file-system  (bundled with Expo SDK 53)
 *     - expo-sharing      (bundled with Expo SDK 53)
 *     - local DB helpers  (db.ts)
 *     - local export util (import-export.ts)
 */

import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllDailyEntries, getSettings, updateSettings } from '../database/db';
import { BackupFrequency } from '../database/types';
import { entriesToCSV, DEFAULT_VARIABLE_LABELS } from './import-export';

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

export type BackupState = 'idle' | 'generating' | 'sharing' | 'done' | 'error';

let _state: BackupState = 'idle';

export const getBackupState = (): BackupState => _state;

// ─────────────────────────────────────────────────────────────────────────────
// Due-date helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns true if a backup is overdue given the frequency and last backup date.
 * Called once on app launch from _layout.tsx.
 */
export function isBackupDue(
  frequency: BackupFrequency,
  lastBackupDate: string | null
): boolean {
  if (frequency === 'none') return false;
  if (!lastBackupDate) return true; // Never backed up → due immediately

  const last = new Date(lastBackupDate);
  const now = new Date();
  const diffDays = (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);

  if (frequency === 'weekly') return diffDays >= 7;
  if (frequency === 'monthly') return diffDays >= 30;
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Core backup function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a CSV of all entries and opens the native share sheet.
 * Updates last_backup_date in the DB on success.
 *
 * @returns true on success, false on failure (state will be 'error')
 */
export async function runBackupNow(): Promise<boolean> {
  if (_state === 'generating' || _state === 'sharing') return false; // Guard re-entry

  _state = 'generating';
  try {
    const entries = await getAllDailyEntries();
    if (entries.length === 0) {
      _state = 'idle';
      return false;
    }

    const csv = entriesToCSV(entries, DEFAULT_VARIABLE_LABELS);
    const today = new Date().toISOString().split('T')[0];
    const fileName = `backup_${today}.csv`;
    const filePath = `${FileSystem.cacheDirectory}${fileName}`;

    await FileSystem.writeAsStringAsync(filePath, csv, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      _state = 'error';
      return false;
    }

    _state = 'sharing';
    await Sharing.shareAsync(filePath, {
      mimeType: 'text/csv',
      dialogTitle: `Daily Tracker Backup — ${today}`,
      UTI: 'public.comma-separated-values-text',
    });

    // Mark backup as complete
    await updateSettings({ lastBackupDate: new Date().toISOString() });
    _state = 'done';
    return true;
  } catch (err) {
    console.error('[BackupScheduler] backup failed:', err);
    _state = 'error';
    return false;
  }
}

/**
 * Called from _layout.tsx on every app launch.
 * Runs a backup silently if one is due. Does not block the launch sequence.
 */
export async function checkAndRunScheduledBackup(): Promise<void> {
  try {
    const settings = await getSettings();
    if (!settings) return;

    if (isBackupDue(settings.backupFrequency, settings.lastBackupDate)) {
      // Run non-blocking — failures are logged, not thrown
      runBackupNow().catch((e) => console.warn('[BackupScheduler] scheduled run failed:', e));
    }
  } catch (e) {
    console.warn('[BackupScheduler] check failed:', e);
  }
}
