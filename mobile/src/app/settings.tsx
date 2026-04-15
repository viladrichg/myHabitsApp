import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
  Switch,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Database,
  Download,
  Upload,
  Palette,
  Bell,
  Info,
  Check,
  ChevronDown,
  Clock,
  FileText,
  FileSpreadsheet,
  AlertCircle,
  Trash2,
  Plus,
  Sliders,
  X,
} from 'lucide-react-native';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import DateTimePicker from '@react-native-community/datetimepicker';
import { THEMES, ThemeStyle, CalendarStyle, SummaryDisplayStyle, DisplayMode, BackupFrequency, AppSettings } from '@/lib/database/types';
import { parseTime, formatTime } from '@/lib/utils/date-utils';
import {
  useAllEntries,
  useSettings,
  useUpdateSettings,
  useDeleteEntry,
  QUERY_KEYS,
} from '@/lib/state/data-layer';
import {
  pickFileAndCheckConflicts,
  importWithConflictResolution,
  importNotesOnly,
  downloadTemplateByType,
  exportToFile,
  ImportResult,
  ConflictInfo,
  ParsedEntry,
  ConflictResolution,
  ExportFormat,
  TemplateType,
  VariableLabels,
  DEFAULT_VARIABLE_LABELS,
} from '@/lib/utils/import-export';
import { runBackupNow } from '@/lib/utils/backup-scheduler';
import {
  useActivityColors,
  useSetActivityColor,
  useResetColors,
  ActivityField,
  DEFAULT_ACTIVITY_COLORS,
  COLOR_BLIND_SAFE_PALETTE,
  EXTENDED_COLORS,
} from '@/lib/state/color-settings-store';
import {
  useAllVariables,
  useVariablesActions,
  TrackedVariable,
  VariableType,
} from '@/lib/state/custom-variables-store';
import { addCustomVariableColumn, removeCustomVariableColumn } from '@/lib/database/db';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';

// ─────────────────────────────────────────────────────────────────────────────
// Sub-component: A single editable variable row
// ─────────────────────────────────────────────────────────────────────────────

interface VariableRowProps {
  variable: TrackedVariable;
  theme: typeof THEMES.dark;
  onDeletePress: (variable: TrackedVariable) => void;
  onLabelChange: (id: string, newLabel: string) => void;
  onColorPress: (variable: TrackedVariable) => void;
}

function VariableRow({ variable, theme, onDeletePress, onLabelChange, onColorPress }: VariableRowProps) {
  const [localLabel, setLocalLabel] = useState<string>(variable.label);

  // Keep local label in sync when store changes from outside
  useEffect(() => {
    setLocalLabel(variable.label);
  }, [variable.label]);

  const handleEndEditing = useCallback(() => {
    const trimmed = localLabel.trim();
    if (trimmed && trimmed !== variable.label) {
      onLabelChange(variable.id, trimmed);
    } else if (!trimmed) {
      setLocalLabel(variable.label);
    }
  }, [localLabel, variable.label, variable.id, onLabelChange]);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
        gap: 10,
      }}
    >
      {/* Tappable color swatch */}
      <Pressable
        onPress={() => onColorPress(variable)}
        hitSlop={8}
        style={{ flexShrink: 0 }}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: variable.color,
            borderWidth: 2,
            borderColor: theme.border,
          }}
        />
      </Pressable>

      {/* Editable name */}
      <TextInput
        value={localLabel}
        onChangeText={setLocalLabel}
        onEndEditing={handleEndEditing}
        onSubmitEditing={handleEndEditing}
        style={{
          flex: 1,
          fontSize: 14,
          color: theme.text,
          backgroundColor: theme.bg,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderWidth: 1,
          borderColor: theme.border,
        }}
        placeholderTextColor={theme.textSecondary}
        returnKeyType="done"
        blurOnSubmit
      />

      {/* Type badge */}
      <View
        style={{
          backgroundColor: variable.type === 'counter' ? '#8b5cf620' : '#10b98120',
          borderRadius: 6,
          paddingHorizontal: 6,
          paddingVertical: 3,
          flexShrink: 0,
        }}
      >
        <Text style={{ fontSize: 10, color: variable.type === 'counter' ? '#8b5cf6' : '#10b981', fontWeight: '600' }}>
          {variable.type === 'counter' ? 'COUNT' : 'BOOL'}
        </Text>
      </View>

      {/* Delete button (custom variables only) */}
      {!variable.isBuiltIn && (
        <Pressable
          onPress={() => onDeletePress(variable)}
          hitSlop={8}
          style={{ flexShrink: 0 }}
        >
          <Trash2 size={18} color="#ef4444" />
        </Pressable>
      )}
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BackupSection component
// Scheduling state is owned by the settings DB row (backup_frequency,
// backup_email, last_backup_date). This component only reads + mutates those
// fields via updateSettingsMutation and delegates all file/share logic to
// backup-scheduler.ts.
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// BackupSection component
// ─────────────────────────────────────────────────────────────────────────────

function BackupSection({
  settings,
  updateSettingsMutation,
  theme,
}: {
  settings: AppSettings | null | undefined;
  updateSettingsMutation: ReturnType<typeof useUpdateSettings>;
  theme: typeof THEMES[keyof typeof THEMES];
}) {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const freq = settings?.backupFrequency ?? 'none';
  const lastDate = settings?.lastBackupDate
    ? new Date(settings.lastBackupDate).toLocaleDateString()
    : 'Never';

  const FREQ_OPTIONS: { value: BackupFrequency; label: string }[] = [
    { value: 'none', label: 'Off' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
  ];

  const handleRunNow = async () => {
    setIsRunning(true);
    await runBackupNow();
    setIsRunning(false);
  };

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <Download size={20} color={theme.accent} />
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Scheduled Backups</Text>
      </View>
      <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>
        Generates a CSV of all your data and opens the share sheet. No server — fully offline.
      </Text>

      {/* Frequency selector */}
      <Text style={{ fontSize: 14, color: theme.textSecondary, marginBottom: 8 }}>Backup Frequency</Text>
      <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.border, marginBottom: 16 }}>
        {FREQ_OPTIONS.map((opt) => {
          const active = freq === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => updateSettingsMutation.mutate({ backupFrequency: opt.value })}
              style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: active ? theme.accent : theme.card }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: active ? '#ffffff' : theme.textSecondary }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Last backup + manual trigger */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: theme.textSecondary }}>Last backup: {lastDate}</Text>
        <Pressable
          onPress={handleRunNow}
          disabled={isRunning}
          style={{ backgroundColor: theme.accent, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, opacity: isRunning ? 0.6 : 1 }}
        >
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#ffffff' }}>{isRunning ? 'Generating…' : 'Backup Now'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Settings Screen
// ─────────────────────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const queryClient = useQueryClient();

  // Data from centralized data layer
  const { data: settings, refetch: refetchSettings } = useSettings();
  const theme = THEMES[settings?.themeStyle ?? 'dark'];
  const { data: allEntries = [] } = useAllEntries();
  const updateSettingsMutation = useUpdateSettings();
  const deleteEntryMutation = useDeleteEntry();

  // Color settings
  const activityColors = useActivityColors();
  const setActivityColor = useSetActivityColor();
  const resetColors = useResetColors();

  // Variable management
  const allVariables = useAllVariables();
  const { addVariable, updateVariableLabel, updateVariableColor, deleteVariable } = useVariablesActions();

  // Derive current variable labels (used for CSV headers)
  const variableLabels = useMemo((): VariableLabels => {
    const result = { ...DEFAULT_VARIABLE_LABELS };
    for (const v of allVariables) {
      if (v.id === 'workedAtJob') result.workedAtJob = v.label;
      else if (v.id === 'workedAtHome') result.workedAtHome = v.label;
      else if (v.id === 'fum') result.fum = v.label;
      else if (v.id === 'gat') result.gat = v.label;
      else if (v.id === 'meditation') result.meditation = v.label;
      else if (v.id === 'yoga') result.yoga = v.label;
      else if (v.id === 'dibuix') result.dibuix = v.label;
      else if (v.id === 'llegir') result.llegir = v.label;
      else if (v.id === 'sports') result.sports = v.label;
    }
    return result;
  }, [allVariables]);

  // Map of existing entries by date (for notes preservation on import)
  const existingEntriesMap = useMemo(
    () => new Map(allEntries.map((e) => [e.date, e])),
    [allEntries]
  );

  // ── Notification state ──────────────────────────────────────────────────────
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(false);
  const [morningTime, setMorningTime] = useState<string>('09:00');
  const [eveningTime, setEveningTime] = useState<string>('21:00');
  const [showMorningPicker, setShowMorningPicker] = useState<boolean>(false);
  const [showEveningPicker, setShowEveningPicker] = useState<boolean>(false);
  const [tempMorningTime, setTempMorningTime] = useState<Date>(new Date());
  const [tempEveningTime, setTempEveningTime] = useState<Date>(new Date());

  // ── Modal visibility ────────────────────────────────────────────────────────
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showTemplateModal, setShowTemplateModal] = useState<boolean>(false);
  const [showThemeModal, setShowThemeModal] = useState<boolean>(false);
  const [showCalendarStyleModal, setShowCalendarStyleModal] = useState<boolean>(false);

  // ── Import state ────────────────────────────────────────────────────────────
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [showImportResultModal, setShowImportResultModal] = useState<boolean>(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showConflictModal, setShowConflictModal] = useState<boolean>(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  const [pendingImportEntries, setPendingImportEntries] = useState<ParsedEntry[]>([]);

  // ── Deletion state ──────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [deletionMode, setDeletionMode] = useState<'single' | 'month'>('single');
  const [selectedDeleteDate, setSelectedDeleteDate] = useState<string>('');
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState<boolean>(false);
  const [datesToDelete, setDatesToDelete] = useState<string[]>([]);
  const [showDoubleConfirmModal, setShowDoubleConfirmModal] = useState<boolean>(false);
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // ── Variable management state ───────────────────────────────────────────────
  // Color picker for variable management
  // Add variable modal
  const [showAddVarModal, setShowAddVarModal] = useState<boolean>(false);
  const [newVarName, setNewVarName] = useState<string>('');
  const [newVarType, setNewVarType] = useState<VariableType>('boolean');
  const [isAddingVar, setIsAddingVar] = useState<boolean>(false);

  // Delete variable confirmation modal
  const [showDeleteVarModal, setShowDeleteVarModal] = useState<boolean>(false);
  const [varToDelete, setVarToDelete] = useState<TrackedVariable | null>(null);

  // ── Sync settings to local state ────────────────────────────────────────────
  useEffect(() => {
    if (settings) {
      setNotificationsEnabled(settings.notificationsEnabled);
      setMorningTime(settings.morningReminderTime);
      setEveningTime(settings.eveningReminderTime);
      if (settings.morningReminderTime) setTempMorningTime(parseTime(settings.morningReminderTime));
      if (settings.eveningReminderTime) setTempEveningTime(parseTime(settings.eveningReminderTime));
    }
  }, [settings]);

  // ── Notifications ───────────────────────────────────────────────────────────
  const requestNotificationPermissions = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  };

  const scheduleNotifications = async (morning: string, evening: string) => {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!notificationsEnabled) return;
    const morningParts = morning.split(':').map(Number);
    const eveningParts = evening.split(':').map(Number);
    const mHour = morningParts[0] ?? 9;
    const mMin = morningParts[1] ?? 0;
    const eHour = eveningParts[0] ?? 23;
    const eMin = eveningParts[1] ?? 0;
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Daily Tracker', body: 'Good morning! Start your day by logging your activities.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: mHour, minute: mMin },
    });
    await Notifications.scheduleNotificationAsync({
      content: { title: 'Daily Tracker', body: "Don't forget to log today's activities before bed!" },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: eHour, minute: eMin },
    });
  };

  const handleNotificationsToggle = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Required', 'Please enable notifications in your device settings.');
        return;
      }
    }
    setNotificationsEnabled(value);
    updateSettingsMutation.mutate({ notificationsEnabled: value });
    if (value) {
      await scheduleNotifications(morningTime, eveningTime);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
  };

  const confirmMorningTime = async () => {
    const newTime = formatTime(tempMorningTime);
    setMorningTime(newTime);
    setShowMorningPicker(false);
    updateSettingsMutation.mutate({ morningReminderTime: newTime });
    if (notificationsEnabled) await scheduleNotifications(newTime, eveningTime);
  };

  const confirmEveningTime = async () => {
    const newTime = formatTime(tempEveningTime);
    setEveningTime(newTime);
    setShowEveningPicker(false);
    updateSettingsMutation.mutate({ eveningReminderTime: newTime });
    if (notificationsEnabled) await scheduleNotifications(morningTime, newTime);
  };

  // ── Export / Import ─────────────────────────────────────────────────────────
  const handleExport = async (format: ExportFormat) => {
    const success = await exportToFile(allEntries, format, variableLabels);
    if (success) {
      setShowExportModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Export Failed', 'Could not export data');
    }
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const existingDates = new Set(allEntries.map((e) => e.date));
      const importData = await pickFileAndCheckConflicts(existingDates, variableLabels);
      if (!importData) { setIsImporting(false); return; }
      const { conflicts, entries, fileType, errors } = importData;
      if (fileType === 'excel' || errors.length > 0) {
        setImportResult({ success: false, imported: 0, skipped: 0, replaced: 0, errors, warnings: [] });
        setShowImportResultModal(true);
        setIsImporting(false);
        return;
      }
      if (conflicts.conflictingDates.length > 0) {
        setConflictInfo(conflicts);
        setPendingImportEntries(entries);
        setShowConflictModal(true);
        setIsImporting(false);
        return;
      }
      const result = await importWithConflictResolution(entries, existingDates, 'skip', existingEntriesMap);
      setImportResult(result);
      setShowImportResultModal(true);
      if (result.imported > 0) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Import Failed', 'Could not import data. Please check the file format.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleConflictResolution = async (resolution: ConflictResolution) => {
    setShowConflictModal(false);
    setIsImporting(true);
    try {
      const existingDates = new Set(allEntries.map((e) => e.date));
      const result = await importWithConflictResolution(pendingImportEntries, existingDates, resolution, existingEntriesMap);
      setImportResult(result);
      setShowImportResultModal(true);
      if (result.imported > 0 || result.replaced > 0) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Import Failed', 'Could not complete import.');
    } finally {
      setIsImporting(false);
      setPendingImportEntries([]);
      setConflictInfo(null);
    }
  };

  const handleImportDataNoNotes = async () => {
    setIsImporting(true);
    try {
      const existingDates = new Set(allEntries.map((e) => e.date));
      const importData = await pickFileAndCheckConflicts(existingDates, variableLabels);
      if (!importData) { setIsImporting(false); return; }
      const { conflicts, entries, fileType, errors } = importData;
      if (fileType === 'excel' || errors.length > 0) {
        setImportResult({ success: false, imported: 0, skipped: 0, replaced: 0, errors, warnings: [] });
        setShowImportResultModal(true);
        setIsImporting(false);
        return;
      }
      const entriesWithoutNotes = entries.map((e: ParsedEntry) => {
        const existingEntry = allEntries.find((ex) => ex.date === e.date);
        return { ...e, notes: existingEntry?.notes ?? null };
      });
      if (conflicts.conflictingDates.length > 0) {
        setConflictInfo(conflicts);
        setPendingImportEntries(entriesWithoutNotes);
        setShowConflictModal(true);
        setIsImporting(false);
        return;
      }
      const result = await importWithConflictResolution(entriesWithoutNotes, existingDates, 'skip', existingEntriesMap);
      setImportResult(result);
      setShowImportResultModal(true);
      if (result.imported > 0) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      Alert.alert('Import Failed', 'Could not import data. Please check the file format.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleImportNotesOnly = async () => {
    setIsImporting(true);
    try {
      const pickerResult = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', '*/*'],
        copyToCacheDirectory: true,
      });
      if (pickerResult.canceled) { setIsImporting(false); return; }
      const file = pickerResult.assets[0];
      if (!file) { setIsImporting(false); return; }
      const content = await FileSystem.readAsStringAsync(file.uri);

      // Strip BOM and detect separator, then validate headers
      const stripped = content.replace(/^\uFEFF/, '');
      const firstLine = stripped.trim().split(/\r?\n/)[0] ?? '';
      const sep = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
      const headers = firstLine.split(sep).map((h) =>
        h.trim().toLowerCase().replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '').replace(/\s+/g, '')
      );

      const hasDateColumn = headers.some((h) => h === 'date' || h === 'data' || h === 'fecha');
      const hasNotesColumn = headers.some((h) => h === 'notes' || h === 'note' || h === 'comments' || h === 'nota' || h === 'notas');

      if (!hasDateColumn || !hasNotesColumn) {
        const missing: string[] = [];
        if (!hasDateColumn) missing.push('"Date"');
        if (!hasNotesColumn) missing.push('"Notes"');
        setImportResult({
          success: false, imported: 0, skipped: 0, replaced: 0,
          errors: [`The CSV is missing required columns: ${missing.join(' and ')}.\n\nThe file must have exactly "Date" and "Notes" columns.\n\nFound columns: ${headers.join(', ') || '(none)'}`],
          warnings: [],
        });
        setShowImportResultModal(true);
        setIsImporting(false);
        return;
      }

      const existingEntriesMap = new Map(allEntries.map((e) => [e.date, e]));
      const notesResult = await importNotesOnly(stripped, existingEntriesMap);
      setImportResult({
        success: notesResult.success,
        imported: notesResult.inserted,
        skipped: notesResult.skipped,
        replaced: notesResult.updated,
        errors: notesResult.errors,
        warnings: notesResult.warnings,
      });
      setShowImportResultModal(true);
      if (notesResult.updated > 0 || notesResult.inserted > 0) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.allEntries });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setImportResult({
        success: false, imported: 0, skipped: 0, replaced: 0,
        errors: [`Import failed: ${msg}`],
        warnings: [],
      });
      setShowImportResultModal(true);
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = async (templateType: TemplateType = 'full-import') => {
    const success = await downloadTemplateByType(templateType, variableLabels);
    if (success) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Alert.alert('Download Failed', 'Could not generate template file.');
    }
  };

  // ── Appearance ──────────────────────────────────────────────────────────────
  const handleThemeChange = (themeStyle: ThemeStyle) => {
    updateSettingsMutation.mutate({ themeStyle });
    setShowThemeModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleCalendarStyleChange = (calendarStyle: CalendarStyle) => {
    updateSettingsMutation.mutate({ calendarStyle });
    setShowCalendarStyleModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const themeOptions: { value: ThemeStyle; name: string; preview: string }[] = [
    { value: 'dark',     name: 'Dark',     preview: '#0f172a' },
    { value: 'midnight', name: 'Midnight', preview: '#030712' },
    { value: 'forest',   name: 'Forest',   preview: '#052e16' },
    { value: 'ocean',    name: 'Ocean',    preview: '#0c4a6e' },
    { value: 'nord',     name: 'Nord',     preview: '#2e3440' },
    { value: 'coffee',   name: 'Coffee',   preview: '#1c1008' },
    { value: 'lavender', name: 'Lavender', preview: '#0f0b1e' },
    { value: 'light',    name: 'Light',    preview: '#f8fafc' },
    { value: 'peach',    name: 'Peach',    preview: '#fff5f0' },
    { value: 'mint',     name: 'Mint',     preview: '#f0fdf8' },
    { value: 'sky',      name: 'Sky',      preview: '#f0f9ff' },
    { value: 'lemon',    name: 'Lemon',    preview: '#fefce8' },
  ];

  const calendarStyleOptions: { value: CalendarStyle; name: string }[] = [
    { value: 'default', name: 'Default (Colors + Numbers)' },
    { value: 'minimal', name: 'Minimal (Dots Only)' },
    { value: 'compact', name: 'Compact (Small)' },
    { value: 'detailed', name: 'Detailed (With Sleep)' },
  ];

  // ── Variable management handlers ────────────────────────────────────────────
  const handleLabelChange = useCallback((id: string, newLabel: string) => {
    updateVariableLabel(id, newLabel);
  }, [updateVariableLabel]);

  const handleDeleteVarPress = useCallback((variable: TrackedVariable) => {
    setVarToDelete(variable);
    setShowDeleteVarModal(true);
  }, []);

  // ── Color picker handlers ─────────────────────────────────────────────────
  const [showColorPickerModal, setShowColorPickerModal] = useState<boolean>(false);
  const [colorPickerVariable, setColorPickerVariable] = useState<TrackedVariable | null>(null);

  const handleColorPress = useCallback((variable: TrackedVariable) => {
    setColorPickerVariable(variable);
    setShowColorPickerModal(true);
    Haptics.selectionAsync();
  }, []);

  const handleSelectColor = useCallback((color: string) => {
    if (colorPickerVariable) {
      updateVariableColor(colorPickerVariable.id, color);
      setColorPickerVariable((prev) => prev ? { ...prev, color } : null);
      Haptics.selectionAsync();
    }
  }, [colorPickerVariable, updateVariableColor]);

  const confirmDeleteVariable = async () => {
    if (!varToDelete) return;
    deleteVariable(varToDelete.id);
    await removeCustomVariableColumn(varToDelete.id);
    setShowDeleteVarModal(false);
    setVarToDelete(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleAddVariable = async () => {
    const trimmedName = newVarName.trim();
    if (!trimmedName) return;
    setIsAddingVar(true);
    try {
      const id = addVariable(trimmedName, undefined, newVarType);
      await addCustomVariableColumn(id);
      setShowAddVarModal(false);
      setNewVarName('');
      setNewVarType('boolean');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Could not add variable. Please try again.');
    } finally {
      setIsAddingVar(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

          {/* ── Appearance ─────────────────────────────────────────────────── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Palette size={20} color={theme.accent} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Appearance</Text>
            </View>

            <Pressable
              onPress={() => setShowThemeModal(true)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
            >
              <Text style={{ fontSize: 16, color: theme.text }}>Theme</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: THEMES[settings?.themeStyle || 'dark'].bg, marginRight: 8, borderWidth: 1, borderColor: theme.border }} />
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>{THEMES[settings?.themeStyle || 'dark'].name}</Text>
                <ChevronDown size={16} color={theme.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            </Pressable>

            <Pressable
              onPress={() => setShowCalendarStyleModal(true)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
            >
              <Text style={{ fontSize: 16, color: theme.text }}>Calendar Style</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 14, color: theme.textSecondary }}>{calendarStyleOptions.find((o) => o.value === (settings?.calendarStyle || 'default'))?.name}</Text>
                <ChevronDown size={16} color={theme.textSecondary} style={{ marginLeft: 4 }} />
              </View>
            </Pressable>

            {/* Display Mode: Absolute vs Percentage
                Conversion logic lives in data-layer.ts (useNormalizeValue / normalizeDisplayValue).
                This control only persists the user preference — it never computes values itself. */}
            <View style={{ paddingVertical: 12 }}>
              <Text style={{ fontSize: 16, color: theme.text, marginBottom: 10 }}>Value Display Mode</Text>
              <View style={{ flexDirection: 'row', borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: theme.border }}>
                {(['absolute', 'percentage'] as DisplayMode[]).map((mode) => {
                  const isActive = (settings?.displayMode ?? 'absolute') === mode;
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => {
                        updateSettingsMutation.mutate({ displayMode: mode });
                        Haptics.selectionAsync();
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        alignItems: 'center',
                        backgroundColor: isActive ? theme.accent : theme.card,
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '600', color: isActive ? '#ffffff' : theme.textSecondary }}>
                        {mode === 'absolute' ? 'Absolute' : 'Percentage'}
                      </Text>
                      <Text style={{ fontSize: 11, color: isActive ? '#ffffffaa' : theme.textSecondary, marginTop: 2 }}>
                        {mode === 'absolute' ? 'e.g. 12 days' : 'e.g. 40%'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

          {/* ── Variable Management + Graph Colors ─────────────────────────── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <Sliders size={20} color="#f59e0b" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Variables & Colors</Text>
            </View>

            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>
              Rename variables, change graph colors, and manage custom fields.
            </Text>

            {/* Built-in variables header */}
            <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.8, marginBottom: 6, textTransform: 'uppercase' }}>
              Built-in
            </Text>
            {allVariables
              .filter((v) => v.isBuiltIn)
              .map((variable) => (
                <VariableRow
                  key={variable.id}
                  variable={variable}
                  theme={theme}
                  onDeletePress={handleDeleteVarPress}
                  onLabelChange={handleLabelChange}
                  onColorPress={handleColorPress}
                />
              ))}

            {/* Custom variables header */}
            {allVariables.some((v) => !v.isBuiltIn) && (
              <>
                <Text style={{ fontSize: 12, fontWeight: '700', color: theme.textSecondary, letterSpacing: 0.8, marginTop: 20, marginBottom: 6, textTransform: 'uppercase' }}>
                  Custom
                </Text>
                {allVariables
                  .filter((v) => !v.isBuiltIn)
                  .map((variable) => (
                    <VariableRow
                      key={variable.id}
                      variable={variable}
                      theme={theme}
                      onDeletePress={handleDeleteVarPress}
                      onLabelChange={handleLabelChange}
                      onColorPress={handleColorPress}
                    />
                  ))}
              </>
            )}

            {/* Add New Variable button */}
            <Pressable
              onPress={() => setShowAddVarModal(true)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: theme.accent + '20',
                borderRadius: 12,
                padding: 14,
                marginTop: 16,
                borderWidth: 1,
                borderColor: theme.accent + '60',
                borderStyle: 'dashed',
              }}
            >
              <Plus size={18} color={theme.accent} />
              <Text style={{ marginLeft: 8, color: theme.accent, fontWeight: '600' }}>Add New Variable</Text>
            </Pressable>
          </View>

          {/* ── Notifications ──────────────────────────────────────────────── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Bell size={20} color="#10b981" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Notifications</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, color: theme.text }}>Daily Reminders</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 2 }}>Get reminded to log activities</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={handleNotificationsToggle}
                trackColor={{ false: theme.border, true: theme.accent }}
                thumbColor="#fff"
              />
            </View>

            {notificationsEnabled && (
              <>
                <Pressable
                  onPress={() => setShowMorningPicker(true)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={16} color={theme.textSecondary} />
                    <Text style={{ fontSize: 16, color: theme.text, marginLeft: 8 }}>Morning Reminder</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: theme.accent }}>{morningTime}</Text>
                </Pressable>

                <Pressable
                  onPress={() => setShowEveningPicker(true)}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Clock size={16} color={theme.textSecondary} />
                    <Text style={{ fontSize: 16, color: theme.text, marginLeft: 8 }}>Evening Reminder</Text>
                  </View>
                  <Text style={{ fontSize: 14, color: theme.accent }}>{eveningTime}</Text>
                </Pressable>
              </>
            )}
          </View>

          {/* ── Export & Import ─────────────────────────────────────────────── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Database size={20} color="#8b5cf6" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Data</Text>
            </View>

            <Pressable
              onPress={() => setShowExportModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginBottom: 12 }}
            >
              <Download size={18} color="#fff" />
              <Text style={{ marginLeft: 8, color: '#fff', fontWeight: '600' }}>Export Data</Text>
            </Pressable>

            <Pressable
              onPress={handleImportDataNoNotes}
              disabled={isImporting}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border, opacity: isImporting ? 0.6 : 1 }}
            >
              <Upload size={18} color={theme.text} />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{isImporting ? 'Importing...' : 'Import Data (No Notes)'}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>All fields except notes. Existing notes preserved.</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={handleImportNotesOnly}
              disabled={isImporting}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#f59e0b50', opacity: isImporting ? 0.6 : 1 }}
            >
              <Upload size={18} color="#f59e0b" />
              <View style={{ marginLeft: 8, flex: 1 }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>{isImporting ? 'Importing...' : 'Import Only Notes'}</Text>
                <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 2 }}>Only updates notes. No other fields modified.</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setShowTemplateModal(true)}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: theme.border }}
            >
              <FileSpreadsheet size={18} color="#10b981" />
              <Text style={{ marginLeft: 8, color: theme.text, fontWeight: '600' }}>Download Templates</Text>
            </Pressable>

            <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 12, textAlign: 'center' }}>
              Import supports CSV format.{'\n'}Existing dates are preserved (no overwrite).
            </Text>
          </View>

          {/* ── Storage Info ─────────────────────────────────────────────────── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Info size={20} color={theme.textSecondary} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>About</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: theme.textSecondary }}>Storage</Text>
              <Text style={{ color: theme.text }}>100% Offline SQLite</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: theme.textSecondary }}>Total Entries</Text>
              <Text style={{ color: theme.text }}>{allEntries.length}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
              <Text style={{ color: theme.textSecondary }}>Version</Text>
              <Text style={{ color: theme.text }}>1.2.0</Text>
            </View>
          </View>


          {/* ── Scheduled Backups ──────────────────────────────────────────── */}
          <BackupSection settings={settings} updateSettingsMutation={updateSettingsMutation} theme={theme} />

          {/* ── Data Deletion ──────────────────────────────────────────────── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <Trash2 size={20} color="#ef4444" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Delete Data</Text>
            </View>

            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>
              Permanently delete entries. This action cannot be undone.
            </Text>

            <Pressable
              onPress={() => { setDeletionMode('single'); setShowDeleteModal(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 12, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#ef444450' }}
            >
              <Trash2 size={18} color="#ef4444" />
              <Text style={{ marginLeft: 8, color: '#ef4444', fontWeight: '600' }}>Delete Single Day</Text>
            </Pressable>

            <Pressable
              onPress={() => { setDeletionMode('month'); setShowDeleteModal(true); }}
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#ef444450' }}
            >
              <Trash2 size={18} color="#ef4444" />
              <Text style={{ marginLeft: 8, color: '#ef4444', fontWeight: '600' }}>Delete Entire Month</Text>
            </Pressable>
          </View>

          <View style={{ alignItems: 'center', paddingVertical: 16, marginBottom: 32 }}>
            <Text style={{ fontSize: 12, color: theme.textSecondary, textAlign: 'center' }}>
              All data stored locally on your device{'\n'}No cloud sync or external servers
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>

      {/* ════════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════════ */}

      {/* Color Picker Modal */}
      <Modal visible={showColorPickerModal} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}
          onPress={() => setShowColorPickerModal(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}
          >
            {/* Handle */}
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 20 }} />

            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colorPickerVariable?.color ?? '#3b82f6', borderWidth: 2, borderColor: theme.border }} />
                <Text style={{ fontSize: 17, fontWeight: '700', color: theme.text }}>{colorPickerVariable?.label ?? ''}</Text>
              </View>
              <Pressable onPress={() => setShowColorPickerModal(false)} hitSlop={12}>
                <X size={22} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Color grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {EXTENDED_COLORS.map((color) => {
                const isSelected = colorPickerVariable?.color === color;
                return (
                  <Pressable
                    key={color}
                    onPress={() => handleSelectColor(color)}
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      backgroundColor: color,
                      borderWidth: isSelected ? 3 : 0,
                      borderColor: '#fff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSelected && <Check size={20} color="#fff" />}
                  </Pressable>
                );
              })}
            </View>

            <Pressable
              onPress={() => setShowColorPickerModal(false)}
              style={{ backgroundColor: theme.accent, borderRadius: 14, padding: 14, alignItems: 'center', marginTop: 20 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Done</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Theme Modal — 10-color grid, fits on screen without scrolling */}
      <Modal visible={showThemeModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowThemeModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 20, padding: 24, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 20, textAlign: 'center' }}>Background Color</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
              {themeOptions.map((opt) => {
                const isSelected = settings?.themeStyle === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => handleThemeChange(opt.value)}
                    style={{ alignItems: 'center', width: '17%' }}
                  >
                    <View style={{
                      width: 48, height: 48, borderRadius: 24,
                      backgroundColor: opt.preview,
                      borderWidth: isSelected ? 3 : 1.5,
                      borderColor: isSelected ? theme.accent : theme.border,
                      alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isSelected && <Check size={18} color={opt.value === 'light' ? '#1e293b' : '#fff'} />}
                    </View>
                    <Text style={{ fontSize: 9, color: isSelected ? theme.accent : theme.textSecondary, marginTop: 5, textAlign: 'center', fontWeight: isSelected ? '700' : '400' }}>
                      {opt.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Calendar Style Modal */}
      <Modal visible={showCalendarStyleModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowCalendarStyleModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Calendar Style</Text>
            {calendarStyleOptions.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => handleCalendarStyleChange(opt.value)}
                style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}
              >
                <Text style={{ flex: 1, fontSize: 16, color: theme.text }}>{opt.name}</Text>
                {settings?.calendarStyle === opt.value && <Check size={20} color={theme.accent} />}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Export Format Modal */}
      <Modal visible={showExportModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowExportModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '85%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Export Format</Text>

            <Pressable onPress={() => handleExport('csv-full')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <FileSpreadsheet size={20} color="#10b981" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, color: theme.text }}>CSV Full Dataset</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>All fields: sleep, activities, sports, notes</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => handleExport('csv-data')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <FileSpreadsheet size={20} color="#3b82f6" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, color: theme.text }}>CSV Data Only (No Notes)</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>All fields except notes</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => handleExport('csv-notes')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <FileSpreadsheet size={20} color="#f59e0b" />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={{ fontSize: 16, color: theme.text }}>CSV Notes Only</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>Date and notes only</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => handleExport('json')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.border }}>
              <FileText size={20} color="#3b82f6" />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontSize: 16, color: theme.text }}>JSON</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>For import/backup</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => handleExport('text')} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14 }}>
              <FileText size={20} color="#8b5cf6" />
              <View style={{ marginLeft: 12 }}>
                <Text style={{ fontSize: 16, color: theme.text }}>Plain Text</Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary }}>Human readable</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Template Download Modal */}
      <Modal visible={showTemplateModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowTemplateModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 8 }}>Download Templates</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>Choose a template to download</Text>

            <ScrollView>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, marginTop: 4 }}>Export Templates</Text>
              <Pressable onPress={() => { handleDownloadTemplate('full-export'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <FileSpreadsheet size={18} color="#10b981" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Full Export</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>All fields including notes</Text></View>
              </Pressable>
              <Pressable onPress={() => { handleDownloadTemplate('data-only-export'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <FileSpreadsheet size={18} color="#3b82f6" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Data Only Export (No Notes)</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>All fields except notes</Text></View>
              </Pressable>
              <Pressable onPress={() => { handleDownloadTemplate('notes-only-export'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <FileSpreadsheet size={18} color="#f59e0b" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Notes Only Export</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>Date and notes only</Text></View>
              </Pressable>

              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, marginTop: 16 }}>Import Templates</Text>
              <Pressable onPress={() => { handleDownloadTemplate('full-import'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <FileSpreadsheet size={18} color="#10b981" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Full Import</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>All fields including notes</Text></View>
              </Pressable>
              <Pressable onPress={() => { handleDownloadTemplate('data-only-import'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <FileSpreadsheet size={18} color="#3b82f6" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Data Only Import (No Notes)</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>All fields except notes</Text></View>
              </Pressable>
              <Pressable onPress={() => { handleDownloadTemplate('notes-only-import'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                <FileSpreadsheet size={18} color="#f59e0b" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Notes Only Import</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>Date and notes only</Text></View>
              </Pressable>
              <Pressable onPress={() => { handleDownloadTemplate('blank-import'); setShowTemplateModal(false); }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
                <FileSpreadsheet size={18} color="#94a3b8" /><View style={{ marginLeft: 12, flex: 1 }}><Text style={{ fontSize: 15, color: theme.text }}>Blank Template</Text><Text style={{ fontSize: 11, color: theme.textSecondary }}>Headers only with current variable names</Text></View>
              </Pressable>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* Import Result Modal */}
      <Modal visible={showImportResultModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowImportResultModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              {importResult?.success ? <Check size={24} color="#10b981" /> : <AlertCircle size={24} color="#ef4444" />}
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Import {importResult?.success ? 'Complete' : 'Issues'}</Text>
            </View>

            <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: theme.textSecondary }}>Imported</Text>
                <Text style={{ color: '#10b981', fontWeight: '600' }}>{importResult?.imported ?? 0}</Text>
              </View>
              {(importResult?.replaced ?? 0) > 0 && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: theme.textSecondary }}>Replaced</Text>
                  <Text style={{ color: '#f59e0b', fontWeight: '600' }}>{importResult?.replaced ?? 0}</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.textSecondary }}>Skipped</Text>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>{importResult?.skipped ?? 0}</Text>
              </View>
            </View>

            {importResult?.errors && importResult.errors.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#ef4444', fontWeight: '600', marginBottom: 8 }}>Errors:</Text>
                <ScrollView style={{ maxHeight: 120 }}>
                  {importResult.errors.map((error: string, index: number) => (
                    <Text key={index} style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{error}</Text>
                  ))}
                </ScrollView>
              </View>
            )}

            {importResult?.warnings && importResult.warnings.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#eab308', fontWeight: '600', marginBottom: 8 }}>Warnings:</Text>
                <ScrollView style={{ maxHeight: 120 }}>
                  {importResult.warnings.map((warning: string, index: number) => (
                    <Text key={index} style={{ color: theme.textSecondary, fontSize: 12, marginBottom: 4 }}>{warning}</Text>
                  ))}
                </ScrollView>
              </View>
            )}

            <Pressable onPress={() => setShowImportResultModal(false)} style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: '#fff', fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Import Conflict Resolution Modal */}
      <Modal visible={showConflictModal} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => { setShowConflictModal(false); setPendingImportEntries([]); setConflictInfo(null); }}
        >
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <AlertCircle size={24} color="#f59e0b" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Conflict Detected</Text>
            </View>

            <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, color: theme.text, marginBottom: 8 }}>The import file contains {conflictInfo?.totalEntries ?? 0} entries:</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={{ color: theme.textSecondary }}>New entries:</Text>
                <Text style={{ color: '#10b981', fontWeight: '600' }}>{conflictInfo?.newDates.length ?? 0}</Text>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={{ color: theme.textSecondary }}>Conflicting dates:</Text>
                <Text style={{ color: '#f59e0b', fontWeight: '600' }}>{conflictInfo?.conflictingDates.length ?? 0}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 14, color: theme.text, marginBottom: 16 }}>
              How would you like to handle the {conflictInfo?.conflictingDates.length ?? 0} conflicting entries?
            </Text>

            <Pressable onPress={() => handleConflictResolution('replace')} style={{ backgroundColor: '#ef444420', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#ef4444' }}>
              <Text style={{ color: '#ef4444', fontWeight: '600', marginBottom: 4 }}>Replace All</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Overwrite existing entries with imported data</Text>
            </Pressable>

            <Pressable onPress={() => handleConflictResolution('skip')} style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: theme.border }}>
              <Text style={{ color: theme.text, fontWeight: '600', marginBottom: 4 }}>Skip Conflicts</Text>
              <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Only import new entries, keep existing data</Text>
            </Pressable>

            <Pressable onPress={() => handleConflictResolution('cancel')} style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel Import</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Morning Time Picker Modal */}
      <Modal visible={showMorningPicker} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowMorningPicker(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Morning Reminder</Text>
            <DateTimePicker value={tempMorningTime} mode="time" display="spinner" onChange={(e, time) => time && setTempMorningTime(time)} textColor={theme.text} is24Hour={true} />
            <Pressable onPress={confirmMorningTime} style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Evening Time Picker Modal */}
      <Modal visible={showEveningPicker} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowEveningPicker(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Evening Reminder</Text>
            <DateTimePicker value={tempEveningTime} mode="time" display="spinner" onChange={(e, time) => time && setTempEveningTime(time)} textColor={theme.text} is24Hour={true} />
            <Pressable onPress={confirmEveningTime} style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Done</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Add Variable Modal */}
      <Modal visible={showAddVarModal} transparent animationType="slide">
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <Pressable
            style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
            onPress={() => setShowAddVarModal(false)}
          >
            <Pressable
              onPress={(e) => e.stopPropagation()}
              style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}
            >
              {/* Handle */}
              <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: theme.border, alignSelf: 'center', marginBottom: 20 }} />

              {/* Title */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>New Variable</Text>
                <Pressable onPress={() => setShowAddVarModal(false)} hitSlop={12}>
                  <X size={22} color={theme.textSecondary} />
                </Pressable>
              </View>

              {/* Name input */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Variable Name
              </Text>
              <TextInput
                value={newVarName}
                onChangeText={setNewVarName}
                placeholder="e.g. Cold Shower, Reading..."
                placeholderTextColor={theme.textSecondary}
                style={{
                  backgroundColor: theme.bg,
                  borderRadius: 12,
                  padding: 14,
                  fontSize: 16,
                  color: theme.text,
                  borderWidth: 1,
                  borderColor: theme.border,
                  marginBottom: 20,
                }}
                autoFocus
                returnKeyType="done"
              />

              {/* Type selector */}
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Type
              </Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <Pressable
                  onPress={() => setNewVarType('boolean')}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: newVarType === 'boolean' ? theme.accent : theme.bg,
                    borderWidth: 1,
                    borderColor: newVarType === 'boolean' ? theme.accent : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: newVarType === 'boolean' ? '#fff' : theme.text }}>
                    Boolean
                  </Text>
                  <Text style={{ fontSize: 11, color: newVarType === 'boolean' ? '#ffffffaa' : theme.textSecondary, marginTop: 2 }}>
                    On / Off
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => setNewVarType('counter')}
                  style={{
                    flex: 1,
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    backgroundColor: newVarType === 'counter' ? '#8b5cf6' : theme.bg,
                    borderWidth: 1,
                    borderColor: newVarType === 'counter' ? '#8b5cf6' : theme.border,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: '600', color: newVarType === 'counter' ? '#fff' : theme.text }}>
                    Counter
                  </Text>
                  <Text style={{ fontSize: 11, color: newVarType === 'counter' ? '#ffffffaa' : theme.textSecondary, marginTop: 2 }}>
                    0 to 25
                  </Text>
                </Pressable>
              </View>

              {/* Add button */}
              <Pressable
                onPress={handleAddVariable}
                disabled={!newVarName.trim() || isAddingVar}
                style={{
                  backgroundColor: !newVarName.trim() || isAddingVar ? theme.border : theme.accent,
                  borderRadius: 14,
                  padding: 16,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>
                  {isAddingVar ? 'Adding...' : 'Add Variable'}
                </Text>
              </Pressable>
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      {/* Delete Variable Confirmation Modal */}
      <Modal visible={showDeleteVarModal} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowDeleteVarModal(false)}
        >
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 24, width: '85%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <AlertCircle size={24} color="#ef4444" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 10 }}>
                Delete Variable
              </Text>
            </View>

            <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: varToDelete?.color }} />
              <Text style={{ fontSize: 16, color: theme.text, fontWeight: '600' }}>{varToDelete?.label}</Text>
            </View>

            <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 20, lineHeight: 18 }}>
              This will remove the variable from the list. Existing data in the database column is preserved but will no longer be displayed.
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowDeleteVarModal(false)}
                style={{ flex: 1, backgroundColor: theme.bg, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.border }}
              >
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmDeleteVariable}
                style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Delete</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Data Modal - Step 1 */}
      <Modal visible={showDeleteModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowDeleteModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%', maxHeight: '80%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 8 }}>
              {deletionMode === 'single' ? 'Delete Single Day' : 'Delete Entire Month'}
            </Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>
              {deletionMode === 'single' ? 'Select a date to delete' : 'Select a month and year to delete all entries'}
            </Text>

            {deletionMode === 'single' ? (
              <ScrollView style={{ maxHeight: 300 }}>
                {allEntries.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50).map((entry) => (
                  <Pressable
                    key={entry.date}
                    onPress={() => { setSelectedDeleteDate(entry.date); setDatesToDelete([entry.date]); setShowDeleteModal(false); setShowDeleteConfirmModal(true); }}
                    style={{ paddingVertical: 14, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: theme.border, backgroundColor: theme.bg, marginBottom: 4, borderRadius: 8 }}
                  >
                    <Text style={{ fontSize: 14, color: theme.text }}>{entry.date}</Text>
                    {entry.notes && <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }} numberOfLines={1}>{entry.notes}</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <View>
                <Text style={{ fontSize: 14, color: theme.text, marginBottom: 8 }}>Select Month:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => (
                      <Pressable
                        key={month}
                        onPress={() => { setSelectedMonth(index); Haptics.selectionAsync(); }}
                        style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: selectedMonth === index ? theme.accent : theme.bg, borderWidth: 1, borderColor: selectedMonth === index ? theme.accent : theme.border }}
                      >
                        <Text style={{ fontSize: 14, color: selectedMonth === index ? '#fff' : theme.text }}>{month}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <Text style={{ fontSize: 14, color: theme.text, marginBottom: 8 }}>Select Year:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16, flexGrow: 0 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                      <Pressable
                        key={year}
                        onPress={() => { setSelectedYear(year); Haptics.selectionAsync(); }}
                        style={{ paddingVertical: 10, paddingHorizontal: 14, borderRadius: 8, backgroundColor: selectedYear === year ? theme.accent : theme.bg, borderWidth: 1, borderColor: selectedYear === year ? theme.accent : theme.border }}
                      >
                        <Text style={{ fontSize: 14, color: selectedYear === year ? '#fff' : theme.text }}>{year}</Text>
                      </Pressable>
                    ))}
                  </View>
                </ScrollView>

                <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>
                    Selected: {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth]} {selectedYear}
                  </Text>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginTop: 4 }}>
                    {allEntries.filter((e) => { const d = new Date(e.date); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; }).length} entries found
                  </Text>
                </View>

                <Pressable
                  onPress={() => {
                    const monthEntries = allEntries.filter((e) => { const d = new Date(e.date); return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear; });
                    if (monthEntries.length === 0) { Alert.alert('No Entries', 'No entries found for the selected month.'); return; }
                    setDatesToDelete(monthEntries.map((e) => e.date).sort());
                    setShowDeleteModal(false);
                    setShowDeleteConfirmModal(true);
                  }}
                  style={{ backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Continue to Delete</Text>
                </Pressable>
              </View>
            )}

            <Pressable onPress={() => setShowDeleteModal(false)} style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 14, marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Delete Confirmation Modal - Step 2 */}
      <Modal visible={showDeleteConfirmModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowDeleteConfirmModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <AlertCircle size={24} color="#ef4444" />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#ef4444', marginLeft: 8 }}>Confirm Deletion</Text>
            </View>

            <Text style={{ fontSize: 14, color: theme.text, marginBottom: 12 }}>You are about to permanently delete:</Text>

            <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, marginBottom: 16 }}>
              {deletionMode === 'month' && (
                <Text style={{ fontSize: 14, color: theme.text, marginBottom: 8, fontWeight: '600' }}>
                  {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth]} {selectedYear}
                </Text>
              )}
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>
                Date Range: {datesToDelete.length > 0 ? `${datesToDelete[0]} to ${datesToDelete[datesToDelete.length - 1]}` : '-'}
              </Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#ef4444' }}>
                {datesToDelete.length} record(s) will be deleted
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16, textAlign: 'center' }}>
              This action cannot be undone. Deleted dates can be re-imported later.
            </Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowDeleteConfirmModal(false)} style={{ flex: 1, backgroundColor: theme.bg, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (deletionMode === 'month') {
                    setShowDeleteConfirmModal(false);
                    setShowDoubleConfirmModal(true);
                  } else {
                    (async () => {
                      for (const date of datesToDelete) {
                        await deleteEntryMutation.mutateAsync(date);
                      }
                      setShowDeleteConfirmModal(false);
                      setDatesToDelete([]);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    })();
                  }
                }}
                style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>
                  {deletionMode === 'month' ? 'Continue' : 'Delete'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* Double Confirmation Modal - Step 3 (month only) */}
      <Modal visible={showDoubleConfirmModal} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowDoubleConfirmModal(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
              <AlertCircle size={28} color="#ef4444" />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ef4444', marginLeft: 8 }}>FINAL WARNING</Text>
            </View>

            <View style={{ backgroundColor: '#ef444420', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#ef4444' }}>
              <Text style={{ fontSize: 16, color: theme.text, textAlign: 'center', fontWeight: '600' }}>
                Are you absolutely sure you want to delete{'\n'}
                <Text style={{ color: '#ef4444', fontSize: 18 }}>{datesToDelete.length} records</Text>
                {'\n'}from {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][selectedMonth]} {selectedYear}?
              </Text>
            </View>

            <Text style={{ fontSize: 12, color: '#ef4444', marginBottom: 20, textAlign: 'center', fontWeight: '600' }}>THIS ACTION CANNOT BE UNDONE</Text>

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setShowDoubleConfirmModal(false)} style={{ flex: 1, backgroundColor: theme.accent, borderRadius: 12, padding: 14, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  for (const date of datesToDelete) {
                    await deleteEntryMutation.mutateAsync(date);
                  }
                  setShowDoubleConfirmModal(false);
                  setDatesToDelete([]);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
                style={{ flex: 1, backgroundColor: '#ef4444', borderRadius: 12, padding: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>DELETE ALL</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
