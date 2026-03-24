import { View, Text, ScrollView, Pressable, Modal, Dimensions } from 'react-native';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Info, TrendingUp, Check, Maximize2, Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, { Line as SvgLine, Text as SvgText, G } from 'react-native-svg';
import { THEMES, DailyEntry, ChartTimeframe } from '@/lib/database/types';
import { useAllEntries, useSettings } from '@/lib/state/data-layer';
import {
  useTimeframe,
  useRange,
  useSetTimeframe,
  useSetCustomRange,
  useIsCustomRange,
  useSetAllRange,
  filterEntriesByRange,
} from '@/lib/state/time-range-store';
import {
  useTrackableVariables,
  useVariableLabelMap,
  useVariableColorMap,
} from '@/lib/state/custom-variables-store';
import {
  getCustomVariableColumns,
  getAllCustomVariableValues,
} from '@/lib/database/db';
import {
  calculateFieldData,
  calculateMonthlyFieldData,
  generateDatesInRange,
  lightenColor,
  computeIntervalDerivative,
  type MonthBreakdown,
  type FieldCalculation,
  type MonthlyFieldCalculation,
  type DerivativeInterval,
  type ChartSeriesData,
  type DerivativeSeriesData,
  type DerivativePoint,
} from '@/lib/charts/calculations';

// -----------------------------------------------------------------------
// Step Chart for Derivative (one horizontal bar per interval, no connectors)
// -----------------------------------------------------------------------

interface DerivativeStepChartProps {
  fieldData: DerivativeSeriesData[];
  totalDateCount: number;
  height: number;
  theme: typeof THEMES['dark'];
}

const DerivativeStepChart = ({ fieldData, totalDateCount, height, theme }: DerivativeStepChartProps) => {
  const allPoints = fieldData.flatMap((fd) => fd.points);
  if (allPoints.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>No hi ha dades</Text>
      </View>
    );
  }

  const maxVal = Math.max(...allPoints.map((p) => p.value), 0.01);
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const screenWidth = Dimensions.get('window').width - 64;
  const chartWidth = screenWidth - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const toX = (idx: number) => paddingLeft + (idx / Math.max(totalDateCount - 1, 1)) * chartWidth;
  const toY = (val: number) => paddingTop + chartHeight - (val / maxVal) * chartHeight;

  const yTicks = [0, 0.5, 1.0].map((t) => t * maxVal);

  return (
    <View style={{ height }}>
      <Svg width={screenWidth} height={height}>
        {/* Y-axis grid + labels */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          const label = maxVal < 1 ? tick.toFixed(2) : tick.toFixed(1);
          return (
            <G key={i}>
              <SvgLine
                x1={paddingLeft - 4}
                y1={y}
                x2={paddingLeft + chartWidth}
                y2={y}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.5}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize={9}
                fill={theme.textSecondary}
                textAnchor="end"
              >
                {label}
              </SvgText>
            </G>
          );
        })}

        {/* One horizontal segment per interval point — no connectors between segments */}
        {fieldData.map((fd) =>
          fd.points.map((point) => {
            const x1 = toX(point.startIdx);
            const x2 = toX(point.endIdx);
            const y = toY(point.value);
            return (
              <SvgLine
                key={`${fd.field}-${point.startIdx}`}
                x1={x1}
                y1={y}
                x2={x2}
                y2={y}
                stroke={fd.color}
                strokeWidth={3}
                strokeLinecap="round"
              />
            );
          })
        )}
      </Svg>
    </View>
  );
};

// -----------------------------------------------------------------------
// Multi-field accumulated chart
// -----------------------------------------------------------------------
interface MultiFieldAccumulatedChartProps {
  fieldData: ChartSeriesData[];
  height: number;
  allDatesInRange: string[];
  isFullScreen: boolean;
  maxY: number;
  minY?: number;
  theme: typeof THEMES['dark'];
}

const MultiFieldAccumulatedChart = ({
  fieldData,
  height,
  allDatesInRange,
  isFullScreen,
  maxY,
  minY = 0,
  theme,
}: MultiFieldAccumulatedChartProps) => {
  const allPoints = fieldData.flatMap((fd) => fd.data);

  if (allPoints.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.textSecondary }}>No hi ha dades</Text>
      </View>
    );
  }

  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const svgWidth = Dimensions.get('window').width - 64;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const yMin = minY;
  const yMax = Math.max(maxY, minY + 1);
  const yRange = yMax - yMin || 1;
  const total = allDatesInRange.length;

  const toX = (idx: number) =>
    paddingLeft + (idx / Math.max(total - 1, 1)) * chartW;
  const toY = (val: number) =>
    paddingTop + chartH - ((val - yMin) / yRange) * chartH;

  // Y-axis: 5 evenly spaced ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => yMin + t * yRange);

  // X-axis: up to 7 evenly spaced date labels
  const xLabelCount = Math.min(isFullScreen ? 14 : 7, allDatesInRange.length);
  const xLabelIndices: number[] = [];
  if (xLabelCount <= 1) {
    xLabelIndices.push(0);
  } else {
    for (let i = 0; i < xLabelCount; i++) {
      xLabelIndices.push(Math.round((i / (xLabelCount - 1)) * (total - 1)));
    }
  }

  return (
    <View style={{ height }}>
      <Svg width={svgWidth} height={height}>
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          const label = Number.isInteger(tick) ? String(tick) : tick.toFixed(1);
          return (
            <G key={`yt-${i}`}>
              <SvgLine
                x1={paddingLeft - 4}
                y1={y}
                x2={paddingLeft + chartW}
                y2={y}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.5}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize={9}
                fill={theme.textSecondary}
                textAnchor="end"
              >
                {label}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis date labels */}
        {xLabelIndices.map((idx) => {
          const date = allDatesInRange[idx];
          if (!date) return null;
          const parts = date.split('-');
          const label = `${parts[1]}/${parts[2]}`;
          return (
            <SvgText
              key={`xl-${idx}`}
              x={toX(idx)}
              y={paddingTop + chartH + 16}
              fontSize={9}
              fill={theme.textSecondary}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}

        {/* One line segment per consecutive data pair per series */}
        {fieldData.map((fd) => {
          if (fd.data.length < 2) return null;
          return fd.data.slice(1).map((pt, i) => {
            const prev = fd.data[i]!;
            return (
              <SvgLine
                key={`${fd.field}-${i}`}
                x1={toX(prev.index)}
                y1={toY(prev.value)}
                x2={toX(pt.index)}
                y2={toY(pt.value)}
                stroke={fd.color}
                strokeWidth={2.5}
                strokeLinecap="round"
              />
            );
          });
        })}
      </Svg>
    </View>
  );
};

// -----------------------------------------------------------------------
// Main screen
// -----------------------------------------------------------------------
export default function GraphsScreen() {
  const router = useRouter();

  // Time range from centralized store
  const timeframe = useTimeframe();
  const range = useRange();
  const setTimeframe = useSetTimeframe();
  const setCustomRange = useSetCustomRange();
  const isCustomRange = useIsCustomRange();
  const setAllRange = useSetAllRange();

  // Data from centralized data layer
  const { data: allEntries = [] } = useAllEntries();
  const { data: settings } = useSettings();
  const theme = THEMES[settings?.themeStyle ?? 'dark'];

  // Dynamic variable support
  const trackableVariables = useTrackableVariables();
  const labelMap = useVariableLabelMap();
  const colorMap = useVariableColorMap();

  // Custom variable DB data: { date -> { columnName -> value } }
  const [customVarData, setCustomVarData] = useState<Record<string, Record<string, number>>>({});
  // Map from variableId -> columnName (for custom variables)
  const [customVarColumnMap, setCustomVarColumnMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const loadCustomVarData = async () => {
      try {
        const columns = await getCustomVariableColumns();
        if (columns.length === 0) return;
        const colMap: Record<string, string> = {};
        for (const c of columns) {
          colMap[c.id] = c.columnName;
        }
        setCustomVarColumnMap(colMap);
        const data = await getAllCustomVariableValues(columns.map((c) => c.columnName));
        setCustomVarData(data);
      } catch (e) {
        // silently fail
      }
    };
    loadCustomVarData();
  }, []);

  // Filter entries by time range
  const filteredEntries = useMemo(() => {
    return filterEntriesByRange(allEntries, range);
  }, [allEntries, range]);

  const allDatesInRange = useMemo(() => {
    return generateDatesInRange(range.startDate, range.endDate);
  }, [range]);

  // Multi-field selection — accepts any string (built-in or custom id)
  const [selectedFields, setSelectedFields] = useState<string[]>(['workedAtJob']);
  const [showFieldSelector, setShowFieldSelector] = useState<boolean>(false);

  // Independent accumulated/monthly toggles
  const [showAccumulated, setShowAccumulated] = useState<boolean>(true);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);

  // Derivative interval
  const [derivativeInterval, setDerivativeInterval] = useState<DerivativeInterval>(7);

  // Collapsible summaries
  const [collapsedSummaries, setCollapsedSummaries] = useState<Set<string>>(new Set());

  const toggleSummary = (id: string) => {
    setCollapsedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Custom date range picker
  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date(range.startDate));
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date(range.endDate));

  const toggleField = useCallback((field: string) => {
    Haptics.selectionAsync();
    setSelectedFields((prev) => {
      const exists = prev.includes(field);
      if (exists) {
        const newFields = prev.filter((f) => f !== field);
        return newFields.length > 0 ? newFields : [field];
      }
      return [...prev, field];
    });
  }, []);

  // Accumulated calculations for each selected field
  const fieldCalculations = useMemo(() => {
    const calculations: Record<string, FieldCalculation> = {};
    for (const fieldId of selectedFields) {
      const colName = customVarColumnMap[fieldId];
      calculations[fieldId] = calculateFieldData(
        filteredEntries,
        fieldId,
        allDatesInRange,
        customVarData,
        colName
      );
    }
    return calculations;
  }, [filteredEntries, selectedFields, allDatesInRange, customVarData, customVarColumnMap]);

  // Monthly calculations for each selected field
  const monthlyCalculations = useMemo(() => {
    const calculations: Record<string, MonthlyFieldCalculation> = {};
    for (const fieldId of selectedFields) {
      const colName = customVarColumnMap[fieldId];
      calculations[fieldId] = calculateMonthlyFieldData(
        filteredEntries,
        fieldId,
        allDatesInRange,
        customVarData,
        colName
      );
    }
    return calculations;
  }, [filteredEntries, selectedFields, allDatesInRange, customVarData, customVarColumnMap]);

  // Build chart series for accumulated lines
  // Null values (missing entries) are excluded to avoid flat/zero segments
  const accumulatedChartData = useMemo((): ChartSeriesData[] => {
    return selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      const calc = fieldCalculations[fieldId];
      if (!calc) return { field: fieldId, color, data: [] };
      return {
        field: fieldId,
        color,
        data: allDatesInRange
          .map((date, idx) => {
            const val = calc.values[idx];
            if (val === null || val === undefined) return null;
            return { index: idx, label: String(idx + 1), date, value: val };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null),
      };
    });
  }, [selectedFields, allDatesInRange, fieldCalculations, colorMap]);

  // Build chart series for monthly lines (full opacity)
  // Null values are excluded to create gaps and prevent false downward lines at month resets
  const monthlyChartData = useMemo((): ChartSeriesData[] => {
    return selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      const calc = monthlyCalculations[fieldId];
      if (!calc) return { field: fieldId, color, data: [] };
      return {
        field: fieldId,
        color,
        data: allDatesInRange
          .map((date, idx) => {
            const val = calc.monthlyValues[idx];
            if (val === null || val === undefined) return null;
            return { index: idx, label: String(idx + 1), date, value: val };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null),
      };
    });
  }, [selectedFields, allDatesInRange, monthlyCalculations, colorMap]);

  // Combined chart series depending on toggle states
  // When both are active: accumulated at full color, monthly at lighter opacity
  const mainChartData = useMemo((): ChartSeriesData[] => {
    if (!showAccumulated && !showMonthly) return [];

    const series: ChartSeriesData[] = [];

    if (showAccumulated) {
      for (const fd of accumulatedChartData) {
        series.push(fd);
      }
    }

    if (showMonthly) {
      for (const fd of monthlyChartData) {
        // When both active, monthly lines get lighter opacity color
        const color = showAccumulated ? lightenColor(fd.color, 0.55) : fd.color;
        series.push({ ...fd, color });
      }
    }

    return series;
  }, [showAccumulated, showMonthly, accumulatedChartData, monthlyChartData]);

  // Max Y for main chart
  const maxYValue = useMemo(() => {
    let max = 1;
    for (const fieldId of selectedFields) {
      if (showAccumulated) {
        const calc = fieldCalculations[fieldId];
        if (calc && calc.total > max) max = calc.total;
      }
      if (showMonthly) {
        const calc = monthlyCalculations[fieldId];
        if (calc) {
          const mMax = calc.monthlyValues.reduce((a: number, b) => Math.max(a, b ?? 0), 0);
          const aMax = calc.accumulatedValues.reduce((a: number, b) => Math.max(a, b ?? 0), 0);
          max = Math.max(max, mMax, aMax);
        }
      }
    }
    return max;
  }, [fieldCalculations, monthlyCalculations, selectedFields, showAccumulated, showMonthly]);

  const hasData = mainChartData.some((f) => f.data.some((d) => d.value > 0));

  // Derivative chart data — one slope per non-overlapping interval of N days
  // Uses the full-length raw values (with nulls) aligned to allDatesInRange
  const derivativeChartData = useMemo((): DerivativeSeriesData[] => {
    if (!showAccumulated && !showMonthly) return [];
    return selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      // Use accumulated values as the base for derivative calculation
      // (monthly values have resets which would generate false negatives)
      const calc = fieldCalculations[fieldId];
      if (!calc) return { field: fieldId, color, points: [] };
      // Raw values aligned to allDatesInRange (null = no entry that day)
      const rawVals: (number | null)[] = allDatesInRange.map((date, idx) => {
        const hasEntry = filteredEntries.some((e) => e.date === date);
        if (!hasEntry) return null;
        return calc.values[idx] ?? null;
      });
      const points = computeIntervalDerivative(rawVals, allDatesInRange, derivativeInterval);
      return { field: fieldId, color, points };
    });
  }, [selectedFields, fieldCalculations, allDatesInRange, filteredEntries, colorMap, showAccumulated, showMonthly, derivativeInterval]);

  const derivativeHasData = derivativeChartData.some((f) => f.points.length > 0);

  const derivativeMaxY = useMemo(() => {
    let max = 0.1;
    for (const fd of derivativeChartData) {
      for (const p of fd.points) {
        if (p.value > max) max = p.value;
      }
    }
    return { max, min: 0 }; // Always 0 minimum - no negatives ever
  }, [derivativeChartData]);

  // Summary metrics
  const fieldSummaries = useMemo(() => {
    return selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      const label = labelMap[fieldId] ?? fieldId;

      if (showMonthly) {
        const calc = monthlyCalculations[fieldId];
        if (!calc) return null;
        const slope = calc.registeredDays > 0 ? calc.total / calc.registeredDays : 0;
        return {
          fieldId,
          label,
          total: calc.total,
          registeredDays: calc.registeredDays,
          slope,
          color,
          monthlyBreakdown: showMonthly ? calc.monthlyBreakdown : undefined,
        };
      } else {
        const calc = fieldCalculations[fieldId];
        if (!calc) return null;
        const slope = calc.registeredDays > 0 ? calc.total / calc.registeredDays : 0;
        return {
          fieldId,
          label,
          total: calc.total,
          registeredDays: calc.registeredDays,
          slope,
          color,
          monthlyBreakdown: undefined,
        };
      }
    }).filter(Boolean) as {
      fieldId: string;
      label: string;
      total: number;
      registeredDays: number;
      slope: number;
      color: string;
      monthlyBreakdown?: MonthBreakdown[];
    }[];
  }, [fieldCalculations, monthlyCalculations, selectedFields, colorMap, labelMap, showMonthly]);

  const handleTimeframeChange = (newTimeframe: ChartTimeframe) => {
    Haptics.selectionAsync();
    if (newTimeframe === 'all') {
      setAllRange(allEntries);
    } else {
      setTimeframe(newTimeframe);
    }
  };

  const handleCustomRangeApply = () => {
    const startStr = tempStartDate.toISOString().split('T')[0];
    const endStr = tempEndDate.toISOString().split('T')[0];
    setCustomRange(startStr, endStr);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const timeframeOptions: { value: ChartTimeframe; label: string; subLabel?: string }[] = [
    { value: 'week', label: '1', subLabel: 'wk' },
    { value: '15days', label: '15', subLabel: 'd' },
    { value: 'month', label: '1', subLabel: 'mo' },
    { value: '3months', label: '3', subLabel: 'mo' },
    { value: '6months', label: '6', subLabel: 'mo' },
    { value: 'year', label: '1', subLabel: 'yr' },
    { value: 'all', label: 'All' },
  ];

  // Separate built-in vs custom trackable variables
  const builtInVariables = trackableVariables.filter((v) => v.isBuiltIn);
  const customVariables = trackableVariables.filter((v) => !v.isBuiltIn);

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

          {/* Header card with range selector */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TrendingUp size={20} color={theme.accent} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>
                  Gràfics
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  router.push({
                    pathname: '/graphs-fullscreen',
                    params: {
                      fields: JSON.stringify(selectedFields),
                      accumulated: showAccumulated ? '1' : '0',
                      monthly: showMonthly ? '1' : '0',
                      interval: String(derivativeInterval),
                    },
                  });
                }}
                style={{ padding: 8, backgroundColor: theme.bg, borderRadius: 8 }}
              >
                <Maximize2 size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Segmented range selector */}
            <View
              style={{
                flexDirection: 'row',
                backgroundColor: theme.bg,
                borderRadius: 10,
                padding: 3,
                marginBottom: 14,
              }}
            >
              {timeframeOptions.map((option) => {
                const isActive = timeframe === option.value && !isCustomRange;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => handleTimeframeChange(option.value)}
                    style={{
                      flex: 1,
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 7,
                      borderRadius: 8,
                      backgroundColor: isActive ? theme.accent : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: isActive ? '#fff' : theme.textSecondary,
                        lineHeight: 16,
                      }}
                    >
                      {option.label}
                    </Text>
                    {option.subLabel && (
                      <Text
                        style={{
                          fontSize: 9,
                          fontWeight: '500',
                          color: isActive ? 'rgba(255,255,255,0.75)' : theme.textSecondary,
                          lineHeight: 11,
                          marginTop: 1,
                        }}
                      >
                        {option.subLabel}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Custom Date Range */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Pressable
                onPress={() => setShowStartDatePicker(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 8, padding: 10 }}
              >
                <Calendar size={14} color={theme.textSecondary} />
                <Text style={{ marginLeft: 6, fontSize: 12, color: theme.text }}>{range.startDate}</Text>
              </Pressable>
              <Text style={{ color: theme.textSecondary }}>fins</Text>
              <Pressable
                onPress={() => setShowEndDatePicker(true)}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.bg, borderRadius: 8, padding: 10 }}
              >
                <Calendar size={14} color={theme.textSecondary} />
                <Text style={{ marginLeft: 6, fontSize: 12, color: theme.text }}>{range.endDate}</Text>
              </Pressable>
            </View>

            <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 8 }}>
              {filteredEntries.length} entrades en {allDatesInRange.length} dies
            </Text>
          </View>

          {/* Independent Accumulated / Monthly toggle chips */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            {/* Accumulated toggle */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowAccumulated((v) => !v);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 11,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: showAccumulated ? theme.accent : theme.border,
                backgroundColor: showAccumulated ? theme.accent + '22' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: showAccumulated ? theme.accent : theme.textSecondary }}>
                Acumulat
              </Text>
              <Text style={{ fontSize: 10, color: showAccumulated ? theme.accent + 'cc' : theme.textSecondary, marginTop: 1 }}>
                total acumulat
              </Text>
            </Pressable>

            {/* Monthly toggle */}
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                setShowMonthly((v) => !v);
              }}
              style={{
                flex: 1,
                alignItems: 'center',
                paddingVertical: 11,
                borderRadius: 12,
                borderWidth: 1.5,
                borderColor: showMonthly ? '#10b981' : theme.border,
                backgroundColor: showMonthly ? '#10b98122' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: showMonthly ? '#10b981' : theme.textSecondary }}>
                Mensual
              </Text>
              <Text style={{ fontSize: 10, color: showMonthly ? '#10b981cc' : theme.textSecondary, marginTop: 1 }}>
                reinicia per mes
              </Text>
            </Pressable>
          </View>

          {/* Legend when both modes are active */}
          {showAccumulated && showMonthly && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 4, marginBottom: 10 }}>
              {selectedFields.map((fieldId) => {
                const color = colorMap[fieldId] ?? '#3b82f6';
                const label = labelMap[fieldId] ?? fieldId;
                const dimColor = lightenColor(color, 0.55);
                return (
                  <View key={fieldId} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: color, marginRight: 3 }} />
                      <Text style={{ fontSize: 10, color: theme.textSecondary }}>{label} acc</Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 14, height: 2, borderRadius: 1, backgroundColor: dimColor, marginRight: 3 }} />
                      <Text style={{ fontSize: 10, color: theme.textSecondary }}>mo</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Field Selector Button */}
          <Pressable
            onPress={() => setShowFieldSelector(true)}
            style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.text }}>
                  {selectedFields.length === 1
                    ? (labelMap[selectedFields[0]] ?? selectedFields[0])
                    : `${selectedFields.length} camps seleccionats`}
                </Text>
                <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 4 }}>
                  {showAccumulated && showMonthly
                    ? 'Acumulat + Mensual'
                    : showAccumulated
                    ? 'Recompte acumulat al llarg del temps'
                    : showMonthly
                    ? 'Vista amb reinici mensual'
                    : 'Cap tipus de gràfic seleccionat'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {selectedFields.slice(0, 3).map((fieldId) => (
                  <View
                    key={fieldId}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 10,
                      backgroundColor: colorMap[fieldId] ?? '#3b82f6',
                    }}
                  />
                ))}
                {selectedFields.length > 3 && (
                  <Text style={{ fontSize: 12, color: theme.textSecondary }}>+{selectedFields.length - 3}</Text>
                )}
              </View>
            </View>

            {selectedFields.length > 1 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {selectedFields.map((fieldId) => {
                  const color = colorMap[fieldId] ?? '#3b82f6';
                  const label = labelMap[fieldId] ?? fieldId;
                  return (
                    <View
                      key={fieldId}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        backgroundColor: color + '20',
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 8,
                      }}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: theme.text }}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Pressable>

          {/* Main Graph Area */}
          {!showAccumulated && !showMonthly ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 32, marginBottom: 16, alignItems: 'center' }}>
              <Info size={40} color={theme.textSecondary} />
              <Text style={{ fontSize: 15, color: theme.text, marginTop: 16, textAlign: 'center', fontWeight: '600' }}>
                Selecciona un tipus de gràfic
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>
                Activa Acumulat o Mensual (o tots dos) a dalt
              </Text>
            </View>
          ) : hasData ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              {/* Legend for multiple fields (when only one mode active) */}
              {selectedFields.length > 1 && !(showAccumulated && showMonthly) && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
                  {selectedFields.map((fieldId) => {
                    const color = colorMap[fieldId] ?? '#3b82f6';
                    const label = labelMap[fieldId] ?? fieldId;
                    return (
                      <View key={fieldId} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 16, height: 4, borderRadius: 2, backgroundColor: color, marginRight: 8 }} />
                        <Text style={{ fontSize: 12, color: theme.text }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <MultiFieldAccumulatedChart
                fieldData={mainChartData}
                height={280}
                allDatesInRange={allDatesInRange}
                isFullScreen={false}
                maxY={maxYValue}
                theme={theme}
              />

              <Text style={{ fontSize: 11, color: theme.textSecondary, textAlign: 'center', marginTop: 8 }}>
                Toca el gràfic per veure el valor  •  Toca la icona per pantalla completa
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 32, marginBottom: 16, alignItems: 'center' }}>
              <Info size={48} color={theme.textSecondary} />
              <Text style={{ fontSize: 16, color: theme.text, marginTop: 16, textAlign: 'center' }}>
                No hi ha dades en el rang seleccionat
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>
                Prova un rang de temps o camp diferent
              </Text>
            </View>
          )}

          {/* Derivative Chart */}
          {(showAccumulated || showMonthly) && selectedFields.length > 0 && derivativeHasData && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              {/* Header + interval selector */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Taxa de canvi</Text>

                {/* Interval segmented control */}
                <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 8, padding: 2 }}>
                  {([1, 3, 7] as DerivativeInterval[]).map((interval) => {
                    const isActive = derivativeInterval === interval;
                    return (
                      <Pressable
                        key={interval}
                        onPress={() => {
                          Haptics.selectionAsync();
                          setDerivativeInterval(interval);
                        }}
                        style={{
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: isActive ? theme.accent : 'transparent',
                        }}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? '#fff' : theme.textSecondary }}>
                          {interval}d
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Legend */}
              {selectedFields.length > 1 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  {derivativeChartData.map((fd) => {
                    const label = labelMap[fd.field] ?? fd.field;
                    return (
                      <View key={fd.field} style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: fd.color, marginRight: 5 }} />
                        <Text style={{ fontSize: 10, color: theme.textSecondary }}>{label}</Text>
                      </View>
                    );
                  })}
                </View>
              )}

              <DerivativeStepChart
                fieldData={derivativeChartData}
                totalDateCount={allDatesInRange.length}
                height={200}
                theme={theme}
              />

              <Text style={{ fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 6 }}>
                Canvi per dia en finestra de {derivativeInterval} dies
              </Text>
            </View>
          )}

          {/* Summary Metrics */}
          {fieldSummaries.length > 0 && (showAccumulated || showMonthly) && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 32 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 12 }}>
                Resum dades
              </Text>
              <View style={{ gap: 4 }}>
                {fieldSummaries.map((summary) => {
                  const isCollapsed = collapsedSummaries.has(summary.fieldId);
                  return (
                    <View
                      key={summary.fieldId}
                      style={{
                        backgroundColor: theme.bg,
                        borderRadius: 12,
                        overflow: 'hidden',
                        marginBottom: 8,
                      }}
                    >
                      {/* Collapsible header row */}
                      <Pressable
                        onPress={() => toggleSummary(summary.fieldId)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                        }}
                      >
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: summary.color, marginRight: 10 }} />
                        <Text style={{ fontSize: 14, color: theme.text, flex: 1, fontWeight: '600' }}>{summary.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: summary.color }}>{summary.total}</Text>
                            <Text style={{ fontSize: 9, color: theme.textSecondary }}>total</Text>
                          </View>
                          {isCollapsed ? (
                            <ChevronDown size={16} color={theme.textSecondary} />
                          ) : (
                            <ChevronUp size={16} color={theme.textSecondary} />
                          )}
                        </View>
                      </Pressable>

                      {/* Expanded content */}
                      {!isCollapsed && (
                        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
                          {/* Stats row */}
                          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 4 }}>
                            <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: 8, padding: 10, alignItems: 'center' }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.text }}>{summary.slope.toFixed(2)}</Text>
                              <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>per dia</Text>
                            </View>
                            <View style={{ flex: 1, backgroundColor: theme.card, borderRadius: 8, padding: 10, alignItems: 'center' }}>
                              <Text style={{ fontSize: 15, fontWeight: '700', color: theme.textSecondary }}>{summary.registeredDays}</Text>
                              <Text style={{ fontSize: 10, color: theme.textSecondary, marginTop: 2 }}>dies registrats</Text>
                            </View>
                          </View>

                          {/* Monthly breakdown */}
                          {showMonthly && summary.monthlyBreakdown && summary.monthlyBreakdown.length > 0 && (
                            <View
                              style={{
                                borderLeftWidth: 2,
                                borderLeftColor: summary.color + '40',
                                paddingLeft: 12,
                                gap: 6,
                                marginTop: 4,
                              }}
                            >
                              {summary.monthlyBreakdown.map((m) => (
                                <View key={m.monthKey} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <Text style={{ fontSize: 12, color: theme.textSecondary, width: 72 }}>{m.label}</Text>
                                  <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={{ fontSize: 13, fontWeight: '600', color: summary.color }}>{m.total}</Text>
                                      <Text style={{ fontSize: 9, color: theme.textSecondary }}>dies actiu</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={{ fontSize: 12, fontWeight: '600', color: theme.text }}>{m.slope.toFixed(2)}</Text>
                                      <Text style={{ fontSize: 9, color: theme.textSecondary }}>per dia</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                      <Text style={{ fontSize: 12, color: theme.textSecondary }}>{m.registeredDays}</Text>
                                      <Text style={{ fontSize: 9, color: theme.textSecondary }}>registrats</Text>
                                    </View>
                                  </View>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      {/* Field Selector Modal */}
      <Modal visible={showFieldSelector} transparent animationType="slide">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
          onPress={() => setShowFieldSelector(false)}
        >
          <Pressable
            style={{
              backgroundColor: theme.card,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingTop: 8,
              paddingBottom: 32,
              maxHeight: '85%',
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2 }} />
            </View>

            <ScrollView style={{ padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 6 }}>
                Selecciona camps
              </Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 18 }}>
                Selecciona múltiples camps per comparar al mateix gràfic.
              </Text>

              {/* Built-in variables */}
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                Variables predefinides
              </Text>
              {builtInVariables.map((variable) => {
                const isSelected = selectedFields.includes(variable.id);
                const color = colorMap[variable.id] ?? variable.color;
                const label = labelMap[variable.id] ?? variable.label;
                return (
                  <Pressable
                    key={variable.id}
                    onPress={() => toggleField(variable.id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 12,
                      marginBottom: 8,
                      backgroundColor: isSelected ? color + '20' : theme.bg,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: isSelected ? color : theme.border,
                    }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, marginRight: 12 }} />
                    <Text style={{ flex: 1, fontSize: 15, color: theme.text }}>{label}</Text>
                    {isSelected && <Check size={20} color={color} />}
                  </Pressable>
                );
              })}

              {/* Custom variables */}
              {customVariables.length > 0 && (
                <>
                  <View style={{ height: 10 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Variables personalitzades
                  </Text>
                  {customVariables.map((variable) => {
                    const isSelected = selectedFields.includes(variable.id);
                    const color = colorMap[variable.id] ?? variable.color;
                    const label = labelMap[variable.id] ?? variable.label;
                    return (
                      <Pressable
                        key={variable.id}
                        onPress={() => toggleField(variable.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingVertical: 14,
                          paddingHorizontal: 12,
                          marginBottom: 8,
                          backgroundColor: isSelected ? color + '20' : theme.bg,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: isSelected ? color : theme.border,
                        }}
                      >
                        <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, marginRight: 12 }} />
                        <Text style={{ flex: 1, fontSize: 15, color: theme.text }}>{label}</Text>
                        {isSelected && <Check size={20} color={color} />}
                      </Pressable>
                    );
                  })}
                </>
              )}

              <View style={{ height: 32 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Start Date Picker Modal */}
      <Modal visible={showStartDatePicker} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowStartDatePicker(false)}
        >
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>
              Data d'inici
            </Text>
            <DateTimePicker
              value={tempStartDate}
              mode="date"
              display="spinner"
              onChange={(e, date) => date && setTempStartDate(date)}
              maximumDate={new Date()}
              textColor={theme.text}
            />
            <Pressable
              onPress={() => {
                setShowStartDatePicker(false);
                handleCustomRangeApply();
              }}
              style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Aplicar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* End Date Picker Modal */}
      <Modal visible={showEndDatePicker} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }}
          onPress={() => setShowEndDatePicker(false)}
        >
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>
              Data de fi
            </Text>
            <DateTimePicker
              value={tempEndDate}
              mode="date"
              display="spinner"
              onChange={(e, date) => date && setTempEndDate(date)}
              maximumDate={new Date()}
              textColor={theme.text}
            />
            <Pressable
              onPress={() => {
                setShowEndDatePicker(false);
                handleCustomRangeApply();
              }}
              style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}
            >
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Aplicar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
