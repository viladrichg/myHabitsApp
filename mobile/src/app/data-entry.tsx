import { View, Text, Pressable, ScrollView, TextInput, Modal, Keyboard, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useEffect, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, X, Save, Plus, Trash2, ChevronDown, ChevronUp, Minus, Settings2 } from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { saveDailyEntry, getDailyEntry, getCustomVariableColumns, saveCustomVariableValue, getCustomVariableValue } from '@/lib/database/db';
import { formatDate, formatTime, parseTime, getTodayDateString, getPreviousDayString, calculateSleptHours } from '@/lib/utils/date-utils';
import { cn } from '@/lib/cn';
import * as Haptics from 'expo-haptics';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { THEMES, CustomSport } from '@/lib/database/types';
import {
  useDailyEntry,
  useCustomSports,
  useAddSport,
  useDeleteSport,
  useSettings,
  QUERY_KEYS,
} from '@/lib/state/data-layer';
import { useCustomVariables } from '@/lib/state/custom-variables-store';
import { useVariableLabelMap } from '@/lib/state/custom-variables-store';

// Safe time parser with validation and fallback
const safeParseTime = (timeStr: string | null | undefined): Date => {
  if (!timeStr || typeof timeStr !== 'string') {
    return createDefaultTime();
  }

  try {
    const parsed = parseTime(timeStr);
    // Validate the parsed date
    if (isNaN(parsed.getTime())) {
      return createDefaultTime();
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse time:', timeStr, error);
    return createDefaultTime();
  }
};

// Create a fresh default time (current time with safe values)
const createDefaultTime = (): Date => {
  const now = new Date();
  // Ensure valid hours (0-23) and minutes (0-59)
  now.setHours(Math.min(23, Math.max(0, now.getHours())));
  now.setMinutes(Math.min(59, Math.max(0, now.getMinutes())));
  now.setSeconds(0);
  now.setMilliseconds(0);
  return now;
};

// Validate and clamp time values
const validateTime = (date: Date): Date => {
  if (!date || isNaN(date.getTime())) {
    return createDefaultTime();
  }

  const result = new Date(date);
  const hours = result.getHours();
  const minutes = result.getMinutes();

  // Clamp to valid ranges
  result.setHours(Math.min(23, Math.max(0, isNaN(hours) ? 0 : hours)));
  result.setMinutes(Math.min(59, Math.max(0, isNaN(minutes) ? 0 : minutes)));
  result.setSeconds(0);
  result.setMilliseconds(0);

  return result;
};

export default function DataEntryScreen() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { data: settings } = useSettings();
  const theme = THEMES[settings?.themeStyle ?? 'dark'];

  // Selected date with validation
  const initialDate = params.date || getTodayDateString();
  const [selectedDate, setSelectedDate] = useState<string>(initialDate);
  const [showDatePicker, setShowDatePicker] = useState<boolean>(false);

  // Track previous date for change detection
  const prevDateRef = useRef<string>(initialDate);

  // Time picker states - always initialize with fresh default times
  const [showBedtimePicker, setShowBedtimePicker] = useState<boolean>(false);
  const [showWakeupPicker, setShowWakeupPicker] = useState<boolean>(false);
  const [tempBedtime, setTempBedtime] = useState<Date>(() => createDefaultTime());
  const [tempWakeup, setTempWakeup] = useState<Date>(() => createDefaultTime());

  // Sleep tracking
  const [bedtime, setBedtime] = useState<string | null>(null);
  const [wakeupTime, setWakeupTime] = useState<string | null>(null);
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);

  // Work status - now allows multi-selection (both can be true)
  const [workedAtJob, setWorkedAtJob] = useState<boolean>(false);
  const [workedAtHome, setWorkedAtHome] = useState<boolean>(false);

  // Missed objectives
  const [fum, setFum] = useState<boolean>(false);
  const [gat, setGat] = useState<boolean>(false);

  // Activities
  const [meditation, setMeditation] = useState<boolean>(false);
  const [yoga, setYoga] = useState<boolean>(false);
  const [dibuix, setDibuix] = useState<boolean>(false);
  const [llegir, setLlegir] = useState<boolean>(false);
  const [counter, setCounter] = useState<number | null>(null);

  // Sports
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [customSportInput, setCustomSportInput] = useState<string>('');
  const [showSportInput, setShowSportInput] = useState<boolean>(false);
  const [showSportsModal, setShowSportsModal] = useState<boolean>(false);

  // Notes
  const [notes, setNotes] = useState<string>('');

  // Custom variables state
  // State for custom variable values (id -> value, 0 = false, 1 = true for booleans; 0-25 for counters)
  const [customVarValues, setCustomVarValues] = useState<Record<string, number>>({});
  const [customVarColumns, setCustomVarColumns] = useState<Record<string, string>>({}); // id -> columnName

  // Load custom variables from the store (non-built-in only)
  const customVars = useCustomVariables();
  const labelMap = useVariableLabelMap();

  // Load custom variable columns once
  useEffect(() => {
    getCustomVariableColumns().then((cols) => {
      const map: Record<string, string> = {};
      for (const { id, columnName } of cols) {
        map[id] = columnName;
      }
      setCustomVarColumns(map);
    });
  }, []);

  // Load custom variable values when date or columns change
  useEffect(() => {
    if (!selectedDate || Object.keys(customVarColumns).length === 0) return;
    const loadValues = async () => {
      const values: Record<string, number> = {};
      for (const [id, colName] of Object.entries(customVarColumns)) {
        values[id] = await getCustomVariableValue(selectedDate, colName);
      }
      setCustomVarValues(values);
    };
    loadValues();
  }, [selectedDate, customVarColumns]);

  // Load custom sports from centralized data layer
  const { data: customSports = [], refetch: refetchSports } = useCustomSports();

  // Load entry for selected date from centralized data layer
  const { data: existingEntry, isLoading: isLoadingEntry } = useDailyEntry(selectedDate);

  // Get previous day's bedtime for sleep hours calculation
  const previousDayString = getPreviousDayString(selectedDate);
  const { data: previousDayEntry } = useDailyEntry(previousDayString);

  // Calculate slept hours (previous day bedtime -> current day wakeup)
  const sleptHours = calculateSleptHours(previousDayEntry?.bedtime, wakeupTime);

  // Reset all form state - called when date changes or no entry exists
  const resetFormState = useCallback(() => {
    setBedtime(null);
    setWakeupTime(null);
    setSleepQuality(null);
    setWorkedAtJob(false);
    setWorkedAtHome(false);
    setFum(false);
    setGat(false);
    setMeditation(false);
    setYoga(false);
    setDibuix(false);
    setLlegir(false);
    setCounter(null);
    setSelectedSports([]);
    setNotes('');
    // CRITICAL: Reset temp times to fresh default values
    setTempBedtime(createDefaultTime());
    setTempWakeup(createDefaultTime());
  }, []);

  // Load entry data when it changes - DEFENSIVE approach
  useEffect(() => {
    // Check if date actually changed
    const dateChanged = prevDateRef.current !== selectedDate;
    prevDateRef.current = selectedDate;

    if (dateChanged) {
      // Force reset temp times on date change to prevent stale state
      setTempBedtime(createDefaultTime());
      setTempWakeup(createDefaultTime());
    }

    if (existingEntry) {
      // Safely set all values with validation
      setBedtime(existingEntry.bedtime ?? null);
      setWakeupTime(existingEntry.wakeupTime ?? null);
      setSleepQuality(existingEntry.sleepQuality ?? null);
      setWorkedAtJob(Boolean(existingEntry.workedAtJob));
      setWorkedAtHome(Boolean(existingEntry.workedAtHome));
      setFum(Boolean(existingEntry.fum));
      setGat(Boolean(existingEntry.gat));
      setMeditation(Boolean(existingEntry.meditation));
      setYoga(Boolean(existingEntry.yoga));
      setDibuix(Boolean(existingEntry.dibuix));
      setLlegir(Boolean(existingEntry.llegir));
      setCounter(existingEntry.counter ?? null);

      // Parse sports safely
      try {
        const sportsList = existingEntry.sports ? JSON.parse(existingEntry.sports) : [];
        setSelectedSports(Array.isArray(sportsList) ? sportsList : []);
      } catch (e) {
        console.warn('Failed to parse sports:', e);
        setSelectedSports([]);
      }

      setNotes(existingEntry.notes ?? '');

      // CRITICAL FIX: Always set temp times from entry data with validation
      if (existingEntry.bedtime) {
        const parsed = safeParseTime(existingEntry.bedtime);
        setTempBedtime(validateTime(parsed));
      } else {
        setTempBedtime(createDefaultTime());
      }

      if (existingEntry.wakeupTime) {
        const parsed = safeParseTime(existingEntry.wakeupTime);
        setTempWakeup(validateTime(parsed));
      } else {
        setTempWakeup(createDefaultTime());
      }
    } else {
      // No entry for this date - reset everything
      resetFormState();
    }
  }, [existingEntry, selectedDate, resetFormState]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      await saveDailyEntry({
        date: selectedDate,
        bedtime,
        wakeupTime,
        sleepQuality,
        workedAtJob,
        workedAtHome,
        fum,
        gat,
        meditation,
        yoga,
        dibuix,
        llegir,
        counter,
        sports: JSON.stringify(selectedSports),
        notes: notes.trim() || null,
      });
      // Save custom variable values
      for (const [id, colName] of Object.entries(customVarColumns)) {
        const value = customVarValues[id] ?? 0;
        await saveCustomVariableValue(selectedDate, colName, value);
      }
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ['dailyEntry', selectedDate] });
      queryClient.invalidateQueries({ queryKey: ['allDailyEntries'] });
      router.back();
    },
  });

  // Delete sport mutation from centralized data layer
  const deleteSportMutation = useDeleteSport();

  // Add sport mutation from centralized data layer
  const addSportMutation = useAddSport();

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    saveMutation.mutate();
  };

  const handleDateChange = (event: any, date?: Date) => {
    if (event.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (date) {
      const newDate = formatDate(date);
      // CRITICAL: Reset temp times when date changes
      if (newDate !== selectedDate) {
        setTempBedtime(createDefaultTime());
        setTempWakeup(createDefaultTime());
      }
      setSelectedDate(newDate);
    }
  };

  const confirmDatePicker = () => {
    setShowDatePicker(false);
  };

  // FIXED: Safe bedtime confirmation with validation
  const confirmBedtime = () => {
    const validatedTime = validateTime(tempBedtime);
    setTempBedtime(validatedTime);
    setBedtime(formatTime(validatedTime));
    setShowBedtimePicker(false);
  };

  // FIXED: Safe wakeup confirmation with validation
  const confirmWakeup = () => {
    const validatedTime = validateTime(tempWakeup);
    setTempWakeup(validatedTime);
    setWakeupTime(formatTime(validatedTime));
    setShowWakeupPicker(false);
  };

  // FIXED: Safe bedtime picker open handler
  const handleOpenBedtimePicker = () => {
    if (bedtime) {
      // Parse existing time safely
      const parsed = safeParseTime(bedtime);
      setTempBedtime(validateTime(parsed));
    } else {
      // Use fresh default time
      setTempBedtime(createDefaultTime());
    }
    setShowBedtimePicker(true);
  };

  // FIXED: Safe wakeup picker open handler
  const handleOpenWakeupPicker = () => {
    if (wakeupTime) {
      // Parse existing time safely
      const parsed = safeParseTime(wakeupTime);
      setTempWakeup(validateTime(parsed));
    } else {
      // Use fresh default time
      setTempWakeup(createDefaultTime());
    }
    setShowWakeupPicker(true);
  };

  // FIXED: Safe time change handler with validation
  const handleBedtimeChange = (event: any, time?: Date) => {
    if (time) {
      setTempBedtime(validateTime(time));
    }
  };

  // FIXED: Safe time change handler with validation
  const handleWakeupChange = (event: any, time?: Date) => {
    if (time) {
      setTempWakeup(validateTime(time));
    }
  };

  const toggleSport = (sport: string) => {
    Haptics.selectionAsync();
    setSelectedSports((prev) =>
      prev.includes(sport) ? prev.filter((s) => s !== sport) : [...prev, sport]
    );
  };

  const handleAddCustomSport = () => {
    const sportName = customSportInput.trim();
    if (sportName) {
      addSportMutation.mutate(sportName);
      setSelectedSports((prev) => [...prev, sportName]);
      setCustomSportInput('');
      setShowSportInput(false);
    }
  };

  const removeSportFromEntry = (sport: string) => {
    Haptics.selectionAsync();
    setSelectedSports((prev) => prev.filter((s) => s !== sport));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={20}
        >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Date Selection */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>Date</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.bg, borderRadius: 12, padding: 12 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Calendar size={20} color={theme.textSecondary} />
                <Text style={{ marginLeft: 8, fontSize: 16, fontWeight: '500', color: theme.text }}>{selectedDate}</Text>
              </View>
              <ChevronDown size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Date Picker Modal */}
          <Modal visible={showDatePicker} transparent animationType="fade">
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setShowDatePicker(false)}
            >
              <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Select Date</Text>
                <DateTimePicker
                  value={new Date(selectedDate)}
                  mode="date"
                  display="spinner"
                  onChange={handleDateChange}
                  maximumDate={new Date()}
                  textColor={theme.text}
                />
                <Pressable
                  onPress={confirmDatePicker}
                  style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Done</Text>
                </Pressable>
              </View>
            </Pressable>
          </Modal>

          {/* Sleep Tracking - Order: Wakeup, Sleep Quality, Bedtime */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>Sleep</Text>
            <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 12 }}>
              Enter when you woke up and went to bed today
            </Text>

            {/* Computed Slept Hours Display */}
            {sleptHours !== null && (
              <View style={{ backgroundColor: theme.accent + '20', borderRadius: 12, padding: 12, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.accent }}>{sleptHours}</Text>
                <Text style={{ fontSize: 14, color: theme.accent, marginLeft: 6 }}>slept</Text>
              </View>
            )}
            {wakeupTime && !sleptHours && previousDayString && (
              <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center' }}>
                  Enter bedtime for {previousDayString} to calculate slept hours
                </Text>
              </View>
            )}

            {/* 1. Wake-up Time (first) */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 }}>Wake-up Time (today)</Text>
              <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 8 }}>What time you woke up this morning</Text>
              <Pressable
                onPress={handleOpenWakeupPicker}
                style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, color: wakeupTime ? theme.text : theme.textSecondary }}>
                  {wakeupTime || 'Select time'}
                </Text>
                <ChevronDown size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Wakeup Picker Modal */}
            <Modal visible={showWakeupPicker} transparent animationType="fade">
              <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowWakeupPicker(false)}
              >
                <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Wake-up Time</Text>
                  <DateTimePicker
                    value={tempWakeup}
                    mode="time"
                    display="spinner"
                    onChange={handleWakeupChange}
                    textColor={theme.text}
                    is24Hour={true}
                  />
                  <Pressable
                    onPress={confirmWakeup}
                    style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>

            {/* 2. Sleep Quality (second) */}
            <View style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 8 }}>
                Sleep Quality (1-10)
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => (
                  <Pressable
                    key={value}
                    onPress={() => {
                      Haptics.selectionAsync();
                      setSleepQuality(sleepQuality === value ? null : value);
                    }}
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: sleepQuality === value ? theme.accent : theme.bg,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: sleepQuality === value ? '#fff' : theme.text }}>
                      {value}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* 3. Bedtime (third/last) */}
            <View>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 4 }}>Bedtime (today)</Text>
              <Text style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 8 }}>What time you went to bed tonight</Text>
              <Pressable
                onPress={handleOpenBedtimePicker}
                style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, color: bedtime ? theme.text : theme.textSecondary }}>
                  {bedtime || 'Select time'}
                </Text>
                <ChevronDown size={20} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Bedtime Picker Modal */}
            <Modal visible={showBedtimePicker} transparent animationType="fade">
              <Pressable
                style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
                onPress={() => setShowBedtimePicker(false)}
              >
                <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Bedtime</Text>
                  <DateTimePicker
                    value={tempBedtime}
                    mode="time"
                    display="spinner"
                    onChange={handleBedtimeChange}
                    textColor={theme.text}
                    is24Hour={true}
                  />
                  <Pressable
                    onPress={confirmBedtime}
                    style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Done</Text>
                  </Pressable>
                </View>
              </Pressable>
            </Modal>
          </View>

          {/* Work Status - Multi-selection allowed */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>Work</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setWorkedAtJob(!workedAtJob);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: workedAtJob ? '#3b82f6' : theme.bg,
                  borderColor: workedAtJob ? '#2563eb' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: workedAtJob ? '#fff' : theme.text }}>
                  {labelMap['workedAtJob'] ?? 'At Job'}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setWorkedAtHome(!workedAtHome);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: workedAtHome ? '#f97316' : theme.bg,
                  borderColor: workedAtHome ? '#ea580c' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: workedAtHome ? '#fff' : theme.text }}>
                  {labelMap['workedAtHome'] ?? 'At Home'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Missed Objectives */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>Missed Objectives</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setFum(!fum);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: fum ? '#ef4444' : theme.bg,
                  borderColor: fum ? '#dc2626' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: fum ? '#fff' : theme.text }}>{labelMap['fum'] ?? 'Fum'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setGat(!gat);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: gat ? '#ef4444' : theme.bg,
                  borderColor: gat ? '#dc2626' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: gat ? '#fff' : theme.text }}>{labelMap['gat'] ?? 'Gat'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Activities - Option C (Blue when active) */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>Activities</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setMeditation(!meditation);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: meditation ? '#3b82f6' : theme.bg,
                  borderColor: meditation ? '#2563eb' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: meditation ? '#fff' : theme.text }}>{labelMap['meditation'] ?? 'Meditation'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setYoga(!yoga);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: yoga ? '#3b82f6' : theme.bg,
                  borderColor: yoga ? '#2563eb' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: yoga ? '#fff' : theme.text }}>{labelMap['yoga'] ?? 'Yoga'}</Text>
              </Pressable>
            </View>
            {/* Second row: Dibuix and Llegir */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setDibuix(!dibuix);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: dibuix ? '#3b82f6' : theme.bg,
                  borderColor: dibuix ? '#2563eb' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: dibuix ? '#fff' : theme.text }}>{labelMap['dibuix'] ?? 'Dibuix'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setLlegir(!llegir);
                }}
                style={{
                  flex: 1,
                  padding: 16,
                  borderRadius: 12,
                  borderWidth: 2,
                  backgroundColor: llegir ? '#3b82f6' : theme.bg,
                  borderColor: llegir ? '#2563eb' : theme.border,
                }}
              >
                <Text style={{ textAlign: 'center', fontWeight: '600', color: llegir ? '#fff' : theme.text }}>{labelMap['llegir'] ?? 'Llegir'}</Text>
              </Pressable>
            </View>
          </View>

          {/* Custom Variables Section - only shown when custom vars exist */}
          {customVars.length > 0 && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              {/* Section header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <Settings2 size={18} color={theme.textSecondary} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>
                  Custom Variables
                </Text>
              </View>

              {customVars.map((variable, index) => {
                const currentValue = customVarValues[variable.id] ?? 0;

                if (variable.type === 'boolean') {
                  const isActive = currentValue === 1;
                  // Pair booleans in rows of 2
                  const isEvenIndex = index % 2 === 0;
                  const nextVar = customVars[index + 1];
                  const isNextBoolean = nextVar?.type === 'boolean';

                  // Only render on even index to handle pairing; skip odd since already rendered
                  if (!isEvenIndex) return null;

                  return (
                    <View key={variable.id} style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                      {/* Current boolean variable */}
                      <Pressable
                        onPress={() => {
                          Haptics.selectionAsync();
                          setCustomVarValues((prev) => ({
                            ...prev,
                            [variable.id]: isActive ? 0 : 1,
                          }));
                        }}
                        style={{
                          flex: 1,
                          padding: 16,
                          borderRadius: 12,
                          borderWidth: 2,
                          backgroundColor: isActive ? variable.color : theme.bg,
                          borderColor: isActive ? variable.color : theme.border,
                        }}
                      >
                        <Text
                          style={{ textAlign: 'center', fontWeight: '600', color: isActive ? '#fff' : theme.text }}
                          numberOfLines={1}
                        >
                          {variable.label}
                        </Text>
                      </Pressable>

                      {/* Pair with next boolean if available */}
                      {nextVar && isNextBoolean ? (
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            const nextActive = (customVarValues[nextVar.id] ?? 0) === 1;
                            setCustomVarValues((prev) => ({
                              ...prev,
                              [nextVar.id]: nextActive ? 0 : 1,
                            }));
                          }}
                          style={{
                            flex: 1,
                            padding: 16,
                            borderRadius: 12,
                            borderWidth: 2,
                            backgroundColor: (customVarValues[nextVar.id] ?? 0) === 1 ? nextVar.color : theme.bg,
                            borderColor: (customVarValues[nextVar.id] ?? 0) === 1 ? nextVar.color : theme.border,
                          }}
                        >
                          <Text
                            style={{
                              textAlign: 'center',
                              fontWeight: '600',
                              color: (customVarValues[nextVar.id] ?? 0) === 1 ? '#fff' : theme.text,
                            }}
                            numberOfLines={1}
                          >
                            {nextVar.label}
                          </Text>
                        </Pressable>
                      ) : (
                        // Empty spacer to keep layout balanced when odd count
                        <View style={{ flex: 1 }} />
                      )}
                    </View>
                  );
                }

                if (variable.type === 'counter') {
                  return (
                    <View key={variable.id} style={{ marginBottom: 16 }}>
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 12 }}>
                        {variable.label}
                      </Text>
                      {/* +/- counter row */}
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
                        {/* Decrement */}
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            const cur = currentValue;
                            if (cur > 0) {
                              setCustomVarValues((prev) => ({ ...prev, [variable.id]: cur - 1 }));
                            }
                          }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            borderTopRightRadius: 0,
                            borderBottomRightRadius: 0,
                            backgroundColor: theme.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: theme.border,
                          }}
                        >
                          <Minus size={20} color={currentValue > 0 ? theme.text : theme.textSecondary} />
                        </Pressable>

                        {/* Value display */}
                        <View
                          style={{
                            width: 80,
                            height: 48,
                            backgroundColor: variable.color + '18',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderTopWidth: 1,
                            borderBottomWidth: 1,
                            borderColor: theme.border,
                          }}
                        >
                          <Text style={{ fontSize: 22, fontWeight: 'bold', color: variable.color }}>
                            {currentValue}
                          </Text>
                        </View>

                        {/* Increment */}
                        <Pressable
                          onPress={() => {
                            Haptics.selectionAsync();
                            const cur = currentValue;
                            if (cur < 25) {
                              setCustomVarValues((prev) => ({ ...prev, [variable.id]: cur + 1 }));
                            }
                          }}
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 12,
                            borderTopLeftRadius: 0,
                            borderBottomLeftRadius: 0,
                            backgroundColor: theme.bg,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: theme.border,
                          }}
                        >
                          <Plus size={20} color={currentValue < 25 ? theme.text : theme.textSecondary} />
                        </Pressable>
                      </View>

                      {/* Quick-tap row: 0,5,10,15,20,25 */}
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 4 }}>
                        {[0, 5, 10, 15, 20, 25].map((v) => (
                          <Pressable
                            key={v}
                            onPress={() => {
                              Haptics.selectionAsync();
                              setCustomVarValues((prev) => ({ ...prev, [variable.id]: v }));
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: currentValue === v ? variable.color : theme.bg,
                              alignItems: 'center',
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: '600',
                                color: currentValue === v ? '#fff' : theme.textSecondary,
                              }}
                            >
                              {v}
                            </Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  );
                }

                return null;
              })}
            </View>
          )}

          {/* Sports - Option D (Blue when active) */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>Sports</Text>
              <Pressable onPress={() => setShowSportsModal(true)}>
                <Text style={{ fontSize: 14, color: theme.accent }}>Manage Sports</Text>
              </Pressable>
            </View>

            {/* Selected sports for today */}
            {selectedSports.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8 }}>Today's sports (tap to remove):</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {selectedSports.map((sport) => (
                    <Pressable
                      key={sport}
                      onPress={() => removeSportFromEntry(sport)}
                      style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#3b82f6' }}
                    >
                      <Text style={{ color: '#fff', fontWeight: '500', marginRight: 6 }}>{sport}</Text>
                      <X size={14} color="#fff" />
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Available sports */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {customSports.filter((s: CustomSport) => !selectedSports.includes(s.name)).map((sport: CustomSport) => (
                <Pressable
                  key={sport.id}
                  onPress={() => toggleSport(sport.name)}
                  style={{ paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.bg }}
                >
                  <Text style={{ color: theme.text, fontWeight: '500' }}>{sport.name}</Text>
                </Pressable>
              ))}

              {!showSportInput ? (
                <Pressable
                  onPress={() => setShowSportInput(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: theme.border }}
                >
                  <Plus size={16} color={theme.text} />
                  <Text style={{ marginLeft: 4, color: theme.text, fontWeight: '500' }}>Add</Text>
                </Pressable>
              ) : (
                <View style={{ width: '100%', flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput
                    value={customSportInput}
                    onChangeText={setCustomSportInput}
                    placeholder="Sport name"
                    placeholderTextColor={theme.textSecondary}
                    style={{ flex: 1, backgroundColor: theme.bg, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: theme.text }}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={handleAddCustomSport}
                  />
                  <Pressable
                    onPress={handleAddCustomSport}
                    style={{ backgroundColor: '#3b82f6', borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600' }}>Add</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => { setShowSportInput(false); setCustomSportInput(''); }}
                    style={{ backgroundColor: theme.border, borderRadius: 12, paddingHorizontal: 16, justifyContent: 'center' }}
                  >
                    <Text style={{ color: theme.text, fontWeight: '600' }}>Cancel</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>

          {/* Sports Management Modal */}
          <Modal visible={showSportsModal} transparent animationType="fade">
            <Pressable
              style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setShowSportsModal(false)}
            >
              <Pressable style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%', maxHeight: '70%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>Manage Sports</Text>
                  <Pressable onPress={() => setShowSportsModal(false)}>
                    <X size={24} color={theme.textSecondary} />
                  </Pressable>
                </View>
                <ScrollView style={{ maxHeight: 300 }}>
                  {customSports.map((sport: CustomSport) => (
                    <View key={sport.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border }}>
                      <Text style={{ fontSize: 16, color: theme.text }}>{sport.name}</Text>
                      <Pressable
                        onPress={() => deleteSportMutation.mutate(sport.id)}
                        style={{ padding: 8 }}
                      >
                        <Trash2 size={20} color="#ef4444" />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
                <Pressable
                  onPress={() => setShowSportsModal(false)}
                  style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}
                >
                  <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Done</Text>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          {/* Counter (0-25) */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 4 }}>Counter</Text>
            <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 16 }}>
              Daily count (0–25)
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 0 }}>
              {/* Decrement */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  const current = counter ?? 0;
                  if (current > 0) setCounter(current - 1);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  backgroundColor: theme.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Minus size={20} color={(counter ?? 0) > 0 ? theme.text : theme.textSecondary} />
              </Pressable>

              {/* Value display */}
              <View style={{
                width: 80,
                height: 48,
                backgroundColor: theme.accent + '18',
                alignItems: 'center',
                justifyContent: 'center',
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme.border,
              }}>
                <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.accent }}>
                  {counter ?? 0}
                </Text>
              </View>

              {/* Increment */}
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  const current = counter ?? 0;
                  if (current < 25) setCounter(current + 1);
                }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 12,
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  backgroundColor: theme.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: theme.border,
                }}
              >
                <Plus size={20} color={(counter ?? 0) < 25 ? theme.text : theme.textSecondary} />
              </Pressable>
            </View>

            {/* Quick-tap row: 0,5,10,15,20,25 */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 4 }}>
              {[0, 5, 10, 15, 20, 25].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setCounter(v);
                  }}
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    borderRadius: 10,
                    backgroundColor: (counter ?? 0) === v ? theme.accent : theme.bg,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 13, fontWeight: '600', color: (counter ?? 0) === v ? '#fff' : theme.textSecondary }}>
                    {v}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 12 }}>Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any notes for this day..."
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, fontSize: 16, color: theme.text, textAlignVertical: 'top', minHeight: 100 }}
            />
          </View>

          {/* Save Button */}
          <Pressable
            onPress={handleSave}
            disabled={saveMutation.isPending}
            style={{ backgroundColor: theme.accent, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 32, opacity: saveMutation.isPending ? 0.7 : 1 }}
          >
            <Save size={20} color="#ffffff" />
            <Text style={{ marginLeft: 8, color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
              {saveMutation.isPending ? 'Saving...' : 'Save Entry'}
            </Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
