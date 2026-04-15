import { View, Text, ScrollView, Pressable, Modal } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Filter, X } from 'lucide-react-native';
import { getMonthDates, getMonthName, getDayOfWeek, calculateSleptHours, getPreviousDayString } from '@/lib/utils/date-utils';
import { FilterOption, getDayColor, getFilterDots } from '@/lib/utils/calendar-utils';
import * as Haptics from 'expo-haptics';
import Svg, { Line as SvgLine, Circle as SvgCircle, Text as SvgText } from 'react-native-svg';
import { Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { THEMES, ChartTimeframe } from '@/lib/database/types';
import {
  useAllEntries,
  useEntriesMap,
  useSettings,
  useCustomSports,
  useDisplayMode,
} from '@/lib/state/data-layer';
import {
  useTimeframe,
  useRange,
  useSetTimeframe,
  useSetTimeframeWithAnchor,
  useSetAllRange,
  filterEntriesByRange,
} from '@/lib/state/time-range-store';
import { calculateStatistics } from '@/lib/utils/calendar-utils';
import {
  useActivityColors,
  COLOR_BLIND_SAFE_PALETTE,
} from '@/lib/state/color-settings-store';
import {
  useVariableLabelMap,
  useVariableColorMap,
} from '@/lib/state/custom-variables-store';
import {
  getCustomVariableColumns,
  getAllCustomVariableValues,
} from '@/lib/database/db';

// ─────────────────────────────────────────────────────────────────────────────
// SVG Line Chart with clickable points and Y-axis min/max labels
// ─────────────────────────────────────────────────────────────────────────────

interface ChartDataPoint {
  idx: number;
  value: number;
  date: string;
  displayValue?: string;
}

interface SelectedPointInfo {
  varName: string;
  value: number;
  displayValue: string;
  date: string;
}

interface StatsSvgChartProps {
  title: string;
  data: ChartDataPoint[];
  color: string;
  yMin: number;
  yMax: number;
  formatY: (v: number) => string;
  formatTooltipValue?: (v: number) => string;
  theme: typeof THEMES['dark'];
  selectedPoint: SelectedPointInfo | null;
  onPointPress: (pt: SelectedPointInfo) => void;
  onDismissPoint: () => void;
  bottomContent?: React.ReactNode;
}

function StatsSvgChart({
  title,
  data,
  color,
  yMin,
  yMax,
  formatY,
  formatTooltipValue,
  theme,
  onPointPress,
  bottomContent,
}: StatsSvgChartProps) {
  const screenWidth = Dimensions.get('window').width;
  const cardPadding = 64; // 16 scrollview + 16 card on each side = 32 per side
  const paddingLeft = 38;
  const paddingRight = 18; // enough room for the rightmost circle (r=6) + margin
  const paddingTop = 16;
  const paddingBottom = 28;
  const svgWidth = screenWidth - cardPadding;
  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = 180;
  const totalHeight = chartHeight + paddingTop + paddingBottom;

  const yRange = yMax - yMin || 1;

  // X position: strictly based on array index (0-based), never exceeds paddingLeft+chartWidth
  const posToX = (arrPos: number): number => {
    if (data.length <= 1) return paddingLeft + chartWidth / 2;
    return paddingLeft + (arrPos / (data.length - 1)) * chartWidth;
  };

  const toY = (val: number) =>
    paddingTop + chartHeight - ((val - yMin) / yRange) * chartHeight;

  // Y-axis tick values: min, mid, max
  const yTicks = [yMin, yMin + yRange / 2, yMax];

  // X-axis date labels: up to 5 evenly spaced
  const xLabelCount = Math.min(data.length, 5);
  const xLabelIndices: number[] = [];
  if (xLabelCount === 1) {
    xLabelIndices.push(0);
  } else {
    for (let i = 0; i < xLabelCount; i++) {
      xLabelIndices.push(Math.round((i / (xLabelCount - 1)) * (data.length - 1)));
    }
  }

  if (data.length === 0) return null;

  const dataMin = Math.min(...data.map((d) => d.value));
  const dataMax = Math.max(...data.map((d) => d.value));

  return (
    <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 24 }}>
      <View style={{ marginBottom: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text }}>{title}</Text>
        <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
          Min: {formatY(dataMin)}  •  Max: {formatY(dataMax)}
        </Text>
      </View>

      <View style={{ overflow: 'hidden' }}>
        <Svg width={svgWidth} height={totalHeight}>
          {/* Horizontal grid lines */}
          {yTicks.map((tick, i) => {
            const y = toY(tick);
            return (
              <SvgLine
                key={i}
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartWidth}
                y2={y}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.6}
              />
            );
          })}

          {/* Y-axis labels */}
          {yTicks.map((tick, i) => (
            <SvgText
              key={i}
              x={paddingLeft - 4}
              y={toY(tick) + 4}
              fontSize={9}
              fill={theme.textSecondary}
              textAnchor="end"
            >
              {formatY(tick)}
            </SvgText>
          ))}

          {/* X-axis labels — strictly use array index for position */}
          {xLabelIndices.map((arrIdx) => {
            const pt = data[arrIdx];
            if (!pt) return null;
            const parts = pt.date.split('-');
            const label = `${parts[1]}/${parts[2]}`;
            return (
              <SvgText
                key={arrIdx}
                x={posToX(arrIdx)}
                y={totalHeight - 4}
                fontSize={9}
                fill={theme.textSecondary}
                textAnchor="middle"
              >
                {label}
              </SvgText>
            );
          })}

          {/* Line segments — array index → X position */}
          {data.slice(1).map((pt, i) => {
            const prev = data[i];
            return (
              <SvgLine
                key={`line-${i}`}
                x1={posToX(i)}
                y1={toY(prev.value)}
                x2={posToX(i + 1)}
                y2={toY(pt.value)}
                stroke={color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          })}

          {/* Clickable point circles */}
          {data.map((pt, arrIdx) => (
            <SvgCircle
              key={`pt-${pt.idx}`}
              cx={posToX(arrIdx)}
              cy={toY(pt.value)}
              r={5}
              fill={color}
              opacity={0.9}
              onPress={() => {
                const dispVal = pt.displayValue ?? (formatTooltipValue ? formatTooltipValue(pt.value) : formatY(pt.value));
                onPointPress({
                  varName: title,
                  value: pt.value,
                  displayValue: dispVal,
                  date: pt.date,
                });
              }}
            />
          ))}
        </Svg>
      </View>

      {bottomContent}
    </View>
  );
}

export default function StatisticsScreen() {
  const router = useRouter();

  // Activity colors from settings store
  const activityColors = useActivityColors();

  // Variable label and color maps from custom-variables-store
  const labelMap = useVariableLabelMap();
  const variableColorMap = useVariableColorMap();

  // Calendar navigation state
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());

  // Filter state - supports multiple independent boolean filters
  const [activeFilters, setActiveFilters] = useState<FilterOption[]>([]);
  const [showFilterMenu, setShowFilterMenu] = useState<boolean>(false);

  // Selected point for popup
  const [selectedPoint, setSelectedPoint] = useState<SelectedPointInfo | null>(null);

  // Time range from centralized store
  const timeframe = useTimeframe();
  const range = useRange();
  const setTimeframe = useSetTimeframe();
  const setTimeframeWithAnchor = useSetTimeframeWithAnchor();
  const setAllRange = useSetAllRange();

  // Data from centralized data layer
  const { data: allEntries = [] } = useAllEntries();
  const entriesMap = useEntriesMap();
  const { data: settings } = useSettings();
  const theme = THEMES[settings?.themeStyle ?? 'dark'];
  const { data: customSports = [] } = useCustomSports();

  // Custom variable data from DB columns
  const [customVarValues, setCustomVarValues] = useState<Record<string, Record<string, number>>>({});
  const [customVarColumns, setCustomVarColumns] = useState<{ id: string; columnName: string }[]>([]);

  useEffect(() => {
    const loadCustomVarData = async () => {
      try {
        const cols = await getCustomVariableColumns();
        setCustomVarColumns(cols);
        if (cols.length > 0) {
          const colNames = cols.map((c) => c.columnName);
          const values = await getAllCustomVariableValues(colNames);
          setCustomVarValues(values);
        }
      } catch (e) {
        // silently ignore
      }
    };
    loadCustomVarData();
  }, [allEntries]);

  // Filter entries by time range
  const filteredEntries = useMemo(() => {
    return filterEntriesByRange(allEntries, range);
  }, [allEntries, range]);

  // Get dates for current month
  const monthDates = useMemo(() => {
    return getMonthDates(currentYear, currentMonth);
  }, [currentYear, currentMonth]);

  // Get calendar grid
  const calendarGrid = useMemo(() => {
    const firstDate = monthDates[0];
    const lastDate = monthDates[monthDates.length - 1];

    const firstDayOfWeek = getDayOfWeek(firstDate);
    const lastDayOfWeek = getDayOfWeek(lastDate);

    const grid: string[] = [];

    const daysToAddBefore = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
    for (let i = daysToAddBefore; i > 0; i--) {
      const prevDate = new Date(currentYear, currentMonth, -i + 1);
      grid.push(
        `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-${String(prevDate.getDate()).padStart(2, '0')}`
      );
    }

    grid.push(...monthDates);

    const daysToAddAfter = lastDayOfWeek === 0 ? 0 : 7 - lastDayOfWeek;
    for (let i = 1; i <= daysToAddAfter; i++) {
      const nextDate = new Date(currentYear, currentMonth + 1, i);
      grid.push(
        `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`
      );
    }

    return grid;
  }, [monthDates, currentYear, currentMonth]);

  // Calculate statistics for the filtered timeframe
  const timeframeStats = useMemo(() => {
    return calculateStatistics(filteredEntries, activeFilters.length > 0 ? activeFilters : undefined);
  }, [filteredEntries, activeFilters]);

  // Custom variable stats computed from DB column data within the filtered date range
  const customVarStats = useMemo(() => {
    if (customVarColumns.length === 0) return [];

    const filteredDates = new Set(filteredEntries.map((e) => e.date));

    return customVarColumns.map(({ id, columnName }) => {
      let count = 0;
      for (const date of filteredDates) {
        const dayValues = customVarValues[date];
        if (dayValues && dayValues[columnName]) {
          count++;
        }
      }
      return { id, columnName, count };
    });
  }, [customVarColumns, customVarValues, filteredEntries]);

  // Sleep quality data for chart - filtered by timeframe
  // Build with proper gap handling: null values for missing dates
  const sleepQualityChartData = useMemo(() => {
    if (filteredEntries.length === 0) return [];

    const entryMap = new Map(filteredEntries.map(e => [e.date, e]));
    const sorted = filteredEntries
      .filter(e => e.sleepQuality !== null && e.sleepQuality !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (sorted.length === 0) return [];

    // Generate all dates from first to last entry with quality data
    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;
    const dates: string[] = [];
    const start = new Date(startDate + 'T12:00:00');
    const end = new Date(endDate + 'T12:00:00');
    const current = new Date(start);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    // Build data with null for gaps (no zero-fill)
    return dates.map((date, idx) => {
      const entry = entryMap.get(date);
      const quality = entry?.sleepQuality;
      const hasData = quality !== null && quality !== undefined;
      return {
        idx: idx + 1,
        value: hasData ? Math.max(1, Math.min(10, quality ?? 5)) : 0,
        hasData,
        date,
      };
    });
  }, [filteredEntries]);

  // Filter to only data points that have actual values (for line segments)
  const sleepQualityValidData = useMemo(() => {
    return sleepQualityChartData.filter(d => d.hasData);
  }, [sleepQualityChartData]);

  // Calculate average for the current timeframe (excluding null and 0)
  const timeframeAverage = useMemo(() => {
    const validData = sleepQualityValidData.filter(item => item.value >= 1 && item.value <= 10);
    if (validData.length === 0) return null;
    const sum = validData.reduce((acc: number, item) => acc + item.value, 0);
    return sum / validData.length;
  }, [sleepQualityValidData]);

  // Slept hours data for chart - filtered by timeframe
  // Convert HH:MM format to decimal hours for charting, with idx for x-axis
  const sleptHoursData = useMemo(() => {
    // Create a map of all entries by date for quick lookup
    const entriesMapLocal = new Map(filteredEntries.map(e => [e.date, e]));

    let counter = 0;
    return filteredEntries
      .filter((entry) => entry.wakeupTime)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => {
        // Get previous day's entry for bedtime
        const prevDate = getPreviousDayString(entry.date);
        const prevEntry = entriesMapLocal.get(prevDate);
        const sleptHoursStr = calculateSleptHours(prevEntry?.bedtime, entry.wakeupTime);

        if (!sleptHoursStr) return null;

        // Convert HH:MM to decimal hours for chart
        const [hours, mins] = sleptHoursStr.split(':').map(Number);
        const decimalHours = hours + mins / 60;
        counter++;

        return {
          value: Math.round(decimalHours * 10) / 10, // Round to 1 decimal
          idx: counter,
          date: entry.date,
          displayValue: sleptHoursStr, // Keep HH:MM for display
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [filteredEntries]);

  // Dynamic Y-axis bounds for slept hours: min-1h to max+1h
  const sleptHoursYMin = useMemo(() => {
    if (sleptHoursData.length === 0) return 5;
    const minVal = Math.min(...sleptHoursData.map(d => d.value));
    return Math.max(0, Math.floor(minVal - 1));
  }, [sleptHoursData]);

  const sleptHoursYMax = useMemo(() => {
    if (sleptHoursData.length === 0) return 10;
    const maxVal = Math.max(...sleptHoursData.map(d => d.value));
    return Math.ceil(maxVal + 1);
  }, [sleptHoursData]);

  // Calculate average slept hours for the current timeframe
  const sleptHoursAverage = useMemo(() => {
    if (sleptHoursData.length === 0) return null;
    const sum = sleptHoursData.reduce((acc, item) => acc + item.value, 0);
    return sum / sleptHoursData.length;
  }, [sleptHoursData]);

  // Counter data for chart - filtered by timeframe
  const counterChartData = useMemo(() => {
    const withCounter = filteredEntries
      .filter(e => e.counter !== null && e.counter !== undefined)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (withCounter.length === 0) return [];

    let idx = 0;
    return withCounter.map(entry => {
      idx++;
      return {
        idx,
        value: Math.max(0, Math.min(25, entry.counter ?? 0)),
        date: entry.date,
      };
    });
  }, [filteredEntries]);

  const counterAverage = useMemo(() => {
    if (counterChartData.length === 0) return null;
    const sum = counterChartData.reduce((acc, d) => acc + d.value, 0);
    return sum / counterChartData.length;
  }, [counterChartData]);

  const counterMax = useMemo(() => {
    if (counterChartData.length === 0) return null;
    return Math.max(...counterChartData.map(d => d.value));
  }, [counterChartData]);

  const counterMin = useMemo(() => {
    if (counterChartData.length === 0) return null;
    return Math.min(...counterChartData.map(d => d.value));
  }, [counterChartData]);

  // Format decimal hours to HH:MM
  const formatDecimalToHHMM = (decimal: number): string => {
    const hours = Math.floor(decimal);
    const mins = Math.round((decimal - hours) * 60);
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  // Build available filters including individual sports - using color-blind safe palette
  const availableFilters: FilterOption[] = useMemo(() => {
    const baseFilters: FilterOption[] = [
      { type: 'work-job', label: labelMap['workedAtJob'] ?? 'Worked at Job', color: activityColors.workedAtJob },
      { type: 'work-home', label: labelMap['workedAtHome'] ?? 'Worked at Home', color: activityColors.workedAtHome },
      { type: 'fum', label: labelMap['fum'] ?? 'Fum', color: activityColors.fum },
      { type: 'gat', label: labelMap['gat'] ?? 'Gat', color: activityColors.gat },
      { type: 'meditation', label: labelMap['meditation'] ?? 'Meditation', color: activityColors.meditation },
      { type: 'yoga', label: labelMap['yoga'] ?? 'Yoga', color: activityColors.yoga },
      { type: 'llegir', label: labelMap['llegir'] ?? 'Llegir', color: activityColors.llegir },
      { type: 'dibuix', label: labelMap['dibuix'] ?? 'Dibuix', color: activityColors.dibuix },
      { type: 'sport', label: 'Qualsevol esport', color: activityColors.sports },
    ];

    // Add individual sport filters with color-blind safe palette
    const sportColors = Object.values(COLOR_BLIND_SAFE_PALETTE);
    customSports.forEach((sport, index) => {
      baseFilters.push({
        type: 'sport',
        label: sport.name,
        color: sportColors[(index + 3) % sportColors.length], // offset to avoid base colors
        value: sport.name,
      });
    });

    return baseFilters;
  }, [customSports, activityColors, labelMap]);

  const handlePreviousMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let newMonth = currentMonth;
    let newYear = currentYear;

    if (currentMonth === 0) {
      newMonth = 11;
      newYear = currentYear - 1;
    } else {
      newMonth = currentMonth - 1;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);

    // Re-anchor statistics to the last day of the new month if it's a past month
    const today = new Date();
    const isCurrentMonth = newYear === today.getFullYear() && newMonth === today.getMonth();

    if (!isCurrentMonth) {
      const lastDayOfMonth = new Date(newYear, newMonth + 1, 0);
      const anchorDate = lastDayOfMonth.toISOString().split('T')[0];
      setTimeframeWithAnchor(timeframe, anchorDate);
    } else {
      setTimeframe(timeframe);
    }
  };

  const handleNextMonth = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    let newMonth = currentMonth;
    let newYear = currentYear;

    if (currentMonth === 11) {
      newMonth = 0;
      newYear = currentYear + 1;
    } else {
      newMonth = currentMonth + 1;
    }

    setCurrentMonth(newMonth);
    setCurrentYear(newYear);

    // Re-anchor statistics to the last day of the new month if it's a past month
    const today = new Date();
    const isCurrentMonth = newYear === today.getFullYear() && newMonth === today.getMonth();

    if (!isCurrentMonth) {
      const lastDayOfMonth = new Date(newYear, newMonth + 1, 0);
      const anchorDate = lastDayOfMonth.toISOString().split('T')[0];
      setTimeframeWithAnchor(timeframe, anchorDate);
    } else {
      setTimeframe(timeframe);
    }
  };

  const handleDayPress = (date: string) => {
    Haptics.selectionAsync();
    router.push({ pathname: '/data-entry', params: { date } });
  };

  const handleTimeframeChange = (newTimeframe: ChartTimeframe) => {
    Haptics.selectionAsync();

    if (newTimeframe === 'all') {
      setAllRange(allEntries);
      return;
    }

    // Check if viewing a past month - anchor statistics to the last day of that month
    const today = new Date();
    const isCurrentMonth = currentYear === today.getFullYear() && currentMonth === today.getMonth();

    if (!isCurrentMonth) {
      // Get last day of the selected month
      const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);
      const anchorDate = lastDayOfMonth.toISOString().split('T')[0];
      setTimeframeWithAnchor(newTimeframe, anchorDate);
    } else {
      setTimeframe(newTimeframe);
    }
  };

  // Toggle filter - supports multiple simultaneous selections
  const toggleFilter = (filter: FilterOption) => {
    Haptics.selectionAsync();
    setActiveFilters((prev) => {
      const exists = prev.find((f) => f.type === filter.type && f.value === filter.value);
      if (exists) {
        return prev.filter((f) => !(f.type === filter.type && f.value === filter.value));
      }
      return [...prev, filter];
    });
  };

  const clearFilters = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveFilters([]);
  };

  const todayString = new Date().toISOString().split('T')[0];

  // displayMode is persisted in Settings → Appearance → "Value Display Mode".
  // 'absolute' shows raw day counts; 'percentage' divides by totalDays.
  // All arithmetic stays here, not inside individual UI components.
  const displayMode = useDisplayMode();

  const getDisplayValue = (count: number): string => {
    if (displayMode === 'percentage') {
      if (timeframeStats.totalDays === 0) return '0%';
      return `${Math.round((count / timeframeStats.totalDays) * 100)}%`;
    }
    return String(count);
  };

  // Bar width is always a percentage of totalDays (visual only, independent of displayMode)
  const getBarWidth = (count: number): number => {
    if (timeframeStats.totalDays === 0) return 0;
    return Math.round((count / timeframeStats.totalDays) * 100);
  };

  // Render calendar day
  const renderCalendarDay = (date: string) => {
    const entry = entriesMap[date] || null;
    const isCurrentMonth = date.startsWith(`${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`);
    const isToday = date === todayString;
    const dayNumber = parseInt(date.split('-')[2], 10);
    const filtersActive = activeFilters.length > 0;

    // Get color based on whether filters are active
    const dayColor = !filtersActive ? getDayColor(entry) : 'neutral';
    const dots = filtersActive ? getFilterDots(entry, activeFilters) : [];

    const getBackgroundColor = () => {
      if (!isCurrentMonth) return 'transparent';
      if (filtersActive) return theme.bg;
      if (!entry) return theme.bg;
      switch (dayColor) {
        case 'red': return variableColorMap['fum'] ?? '#ef4444';
        case 'pink': return variableColorMap['gat'] ?? '#ec4899';
        case 'blue': return '#3b82f6';
        case 'green': return '#10b981';
        case 'yellow': return '#eab308';
        default: return theme.bg;
      }
    };

    const getTextColor = () => {
      if (!isCurrentMonth) return theme.border;
      if (filtersActive) return theme.text;
      if (!entry) return theme.textSecondary;
      switch (dayColor) {
        case 'red':
        case 'pink':
        case 'blue':
        case 'green': return '#fff';
        case 'yellow': return '#1e293b';
        default: return theme.text;
      }
    };

    return (
      <Pressable
        key={date}
        onPress={() => handleDayPress(date)}
        style={{
          width: '14.28%',
          aspectRatio: 1,
          padding: 2,
        }}
      >
        <View
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 8,
            backgroundColor: getBackgroundColor(),
            borderWidth: isToday ? 2 : 0,
            borderColor: theme.accent,
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '500', color: getTextColor() }}>{dayNumber}</Text>

          {/* Sleep quality indicator - black text, 80% opacity */}
          {entry?.sleepQuality && !filtersActive && (
            <Text style={{ fontSize: 9, fontWeight: '600', color: 'rgba(0, 0, 0, 0.8)', marginTop: 1 }}>{entry.sleepQuality}</Text>
          )}

          {/* Filter dots */}
          {dots.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
              {dots.slice(0, 3).map((color, index) => (
                <View key={index} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: color }} />
              ))}
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  // Render progress bar
  const renderProgressBar = (label: string, count: number, color: string, key?: string) => {
    const barWidth = getBarWidth(count);
    return (
      <View key={key || label} style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
          <Text style={{ fontSize: 14, color: theme.text }}>{label}</Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color }}>
            {getDisplayValue(count)}
          </Text>
        </View>
        <View style={{ height: 8, backgroundColor: theme.bg, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${barWidth}%`, backgroundColor: color, borderRadius: 4 }} />
        </View>
      </View>
    );
  };

  const timeframeOptions: { value: ChartTimeframe; label: string; subLabel?: string }[] = [
    { value: 'week', label: '1', subLabel: 'wk' },
    { value: '15days', label: '15', subLabel: 'day' },
    { value: 'month', label: '1', subLabel: 'mo' },
    { value: '3months', label: '3', subLabel: 'mo' },
    { value: '6months', label: '6', subLabel: 'mo' },
    { value: 'year', label: '1', subLabel: 'yr' },
    { value: 'all', label: 'All' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
          {/* Calendar */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            {/* Month navigation */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Pressable onPress={handlePreviousMonth} style={{ padding: 8 }}>
                <ChevronLeft size={24} color={theme.text} />
              </Pressable>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>
                {getMonthName(currentMonth)} {currentYear}
              </Text>
              <Pressable onPress={handleNextMonth} style={{ padding: 8 }}>
                <ChevronRight size={24} color={theme.text} />
              </Pressable>
            </View>

            {/* Filter controls */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Pressable
                onPress={() => setShowFilterMenu(!showFilterMenu)}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
              >
                <Filter size={16} color={theme.textSecondary} />
                <Text style={{ marginLeft: 8, fontSize: 14, fontWeight: '500', color: theme.text }}>
                  Filtres {activeFilters.length > 0 && `(${activeFilters.length})`}
                </Text>
              </Pressable>
              {activeFilters.length > 0 && (
                <Pressable onPress={clearFilters} style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 14, color: '#ef4444', fontWeight: '500' }}>Esborrar tot</Text>
                </Pressable>
              )}
            </View>

            {/* Filter menu - supports multiple selections */}
            {showFilterMenu && (
              <View style={{ backgroundColor: theme.bg, borderRadius: 12, padding: 12, marginBottom: 12 }}>
                {/* Base filters */}
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, fontWeight: '600' }}>Activitats</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {availableFilters.filter(f => f.type !== 'sport').map((filter) => {
                    const isActive = activeFilters.some((f) => f.type === filter.type && f.value === filter.value);
                    return (
                      <Pressable
                        key={`${filter.type}-${filter.value || ''}`}
                        onPress={() => toggleFilter(filter)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isActive ? filter.color : theme.border,
                          backgroundColor: isActive ? filter.color + '30' : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '500', color: isActive ? filter.color : theme.text }}>
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Sport filters */}
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 8, fontWeight: '600' }}>Esports</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {availableFilters.filter(f => f.type === 'sport').map((filter) => {
                    const isActive = activeFilters.some((f) => f.type === filter.type && f.value === filter.value);
                    return (
                      <Pressable
                        key={`sport-${filter.value || 'any'}`}
                        onPress={() => toggleFilter(filter)}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 8,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isActive ? filter.color : theme.border,
                          backgroundColor: isActive ? filter.color + '30' : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '500', color: isActive ? filter.color : theme.text }}>
                          {filter.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Active filter chips */}
            {activeFilters.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {activeFilters.map((filter, index) => (
                  <View key={index} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: filter.color + '30', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: filter.color, marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: '500', color: theme.text }}>{filter.label}</Text>
                    <Pressable onPress={() => toggleFilter(filter)} style={{ marginLeft: 4, padding: 2 }}>
                      <X size={12} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            {/* Day headers */}
            <View style={{ flexDirection: 'row', marginBottom: 4 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                <View key={day} style={{ flex: 1, alignItems: 'center', paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: theme.textSecondary }}>{day}</Text>
                </View>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {calendarGrid.map(renderCalendarDay)}
            </View>
          </View>

          {/* Time Range Selector */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.textSecondary, marginBottom: 10, textAlign: 'center' }}>Rang de temps</Text>
            <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 10, padding: 3 }}>
              {timeframeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => handleTimeframeChange(option.value)}
                  style={{
                    flex: 1,
                    paddingVertical: 6,
                    borderRadius: 7,
                    backgroundColor: timeframe === option.value ? theme.accent : 'transparent',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: timeframe === option.value ? '#fff' : theme.textSecondary, lineHeight: 14 }}>
                    {option.label}
                  </Text>
                  {option.subLabel && (
                    <Text style={{ fontSize: 9, fontWeight: '500', color: timeframe === option.value ? 'rgba(255,255,255,0.8)' : theme.textSecondary, lineHeight: 11 }}>
                      {option.subLabel}
                    </Text>
                  )}
                </Pressable>
              ))}
            </View>
            <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 8 }}>
              {range.startDate} → {range.endDate} ({timeframeStats.totalDays} dies)
            </Text>
          </View>

          {/* Statistics Summary - Progress Bars (uses time range) */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Resum</Text>

            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12 }}>
                Basat en {timeframeStats.totalDays} dies registrats en el rang seleccionat
              </Text>
            </View>

            {renderProgressBar(labelMap['workedAtJob'] ?? 'Worked at Job', timeframeStats.workedAtJob, variableColorMap['workedAtJob'] ?? '#3b82f6')}
            {renderProgressBar(labelMap['workedAtHome'] ?? 'Worked at Home', timeframeStats.workedAtHome, variableColorMap['workedAtHome'] ?? '#f97316')}
            {renderProgressBar(labelMap['fum'] ?? 'Fum', timeframeStats.fum, variableColorMap['fum'] ?? '#ef4444')}
            {renderProgressBar(labelMap['gat'] ?? 'Gat', timeframeStats.gat, variableColorMap['gat'] ?? '#ec4899')}
            {renderProgressBar(labelMap['meditation'] ?? 'Meditation', timeframeStats.meditation, variableColorMap['meditation'] ?? '#10b981')}
            {renderProgressBar(labelMap['yoga'] ?? 'Yoga', timeframeStats.yoga, variableColorMap['yoga'] ?? '#10b981')}
            {renderProgressBar(labelMap['llegir'] ?? 'Llegir', timeframeStats.llegir, variableColorMap['llegir'] ?? '#3b82f6')}
            {renderProgressBar(labelMap['dibuix'] ?? 'Dibuix', timeframeStats.dibuix, variableColorMap['dibuix'] ?? '#eab308')}

            {/* Custom variable progress bars */}
            {customVarStats.length > 0 && (
              <>
                <View style={{ height: 1, backgroundColor: theme.border, marginVertical: 12 }} />
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 12, fontWeight: '600' }}>Variables personalitzades</Text>
                {customVarStats.map(({ id, count }) => {
                  const label = labelMap[id] ?? id;
                  const color = variableColorMap[id] ?? '#6366f1';
                  return renderProgressBar(label, count, color, `custom-var-${id}`);
                })}
              </>
            )}
          </View>

          {/* Sports Statistics (uses time range) - AFTER Summary bars */}
          {Object.keys(timeframeStats.sports).length > 0 && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16 }}>Esports</Text>
              {Object.entries(timeframeStats.sports)
                .sort(([, a], [, b]) => b - a)
                .map(([sport, count]) => renderProgressBar(sport, count, '#6366f1'))}
            </View>
          )}

          {/* Sleep Quality Chart */}
          {sleepQualityValidData.length > 0 && (
            <StatsSvgChart
              title="Qualitat del son"
              data={sleepQualityValidData}
              color={theme.accent}
              yMin={0}
              yMax={10}
              formatY={(v) => String(Math.round(v))}
              theme={theme}
              selectedPoint={selectedPoint}
              onPointPress={(pt) => setSelectedPoint(pt)}
              onDismissPoint={() => setSelectedPoint(null)}
              bottomContent={
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.accent }}>{timeframeAverage !== null ? timeframeAverage.toFixed(1) : '-'}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Mitjana</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>
                      {sleepQualityValidData.length > 0 ? Math.max(...sleepQualityValidData.map((d) => d.value)) : 0}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Màxim</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ef4444' }}>
                      {sleepQualityValidData.length > 0 ? Math.min(...sleepQualityValidData.map((d) => d.value)) : 0}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Mínim</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>{sleepQualityValidData.length}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Dies</Text>
                  </View>
                </View>
              }
            />
          )}

          {/* Slept Hours Chart */}
          {sleptHoursData.length > 0 && (
            <StatsSvgChart
              title="Hores dormides"
              data={sleptHoursData}
              color="#8b5cf6"
              yMin={sleptHoursYMin}
              yMax={sleptHoursYMax}
              formatY={(v) => `${Math.round(v)}h`}
              formatTooltipValue={(v) => formatDecimalToHHMM(v)}
              theme={theme}
              selectedPoint={selectedPoint}
              onPointPress={(pt) => setSelectedPoint(pt)}
              onDismissPoint={() => setSelectedPoint(null)}
              bottomContent={
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#8b5cf6' }}>
                      {sleptHoursAverage !== null ? formatDecimalToHHMM(sleptHoursAverage) : '-'}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Mitjana</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>
                      {sleptHoursData.length > 0 ? formatDecimalToHHMM(Math.max(...sleptHoursData.map((d) => d.value))) : '-'}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Dormilega</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ef4444' }}>
                      {sleptHoursData.length > 0 ? formatDecimalToHHMM(Math.min(...sleptHoursData.map((d) => d.value))) : '-'}
                    </Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Nit del Lloro</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>{sleptHoursData.length}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Dies</Text>
                  </View>
                </View>
              }
            />
          )}

          {/* Counter Chart */}
          {counterChartData.length > 0 && (
            <StatsSvgChart
              title={labelMap['counter'] ?? 'Counter'}
              data={counterChartData}
              color="#f59e0b"
              yMin={0}
              yMax={25}
              formatY={(v) => String(Math.round(v))}
              theme={theme}
              selectedPoint={selectedPoint}
              onPointPress={(pt) => setSelectedPoint(pt)}
              onDismissPoint={() => setSelectedPoint(null)}
              bottomContent={
                <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#f59e0b' }}>{counterAverage !== null ? counterAverage.toFixed(1) : '-'}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Mitjana</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#10b981' }}>{counterMax ?? '-'}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Màxim</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#ef4444' }}>{counterMin ?? '-'}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Mínim</Text>
                  </View>
                  <View style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.text }}>{counterChartData.length}</Text>
                    <Text style={{ fontSize: 11, color: theme.textSecondary }}>Dies</Text>
                  </View>
                </View>
              }
            />
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Point Detail Popup */}
      {selectedPoint && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setSelectedPoint(null)}>
          <Pressable style={{ flex: 1 }} onPress={() => setSelectedPoint(null)}>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, minWidth: 200, borderWidth: 1, borderColor: theme.border }}>
                <Text style={{ fontSize: 13, color: theme.textSecondary, marginBottom: 4 }}>{selectedPoint.varName}</Text>
                <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.accent, marginBottom: 4 }}>{selectedPoint.displayValue}</Text>
                <Text style={{ fontSize: 13, color: theme.textSecondary }}>{selectedPoint.date}</Text>
                <Pressable onPress={() => setSelectedPoint(null)} style={{ marginTop: 14, alignItems: 'center' }}>
                  <Text style={{ color: theme.accent, fontWeight: '600' }}>Tancar</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
