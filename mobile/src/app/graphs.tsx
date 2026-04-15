import { View, Text, ScrollView, Pressable, Modal, Dimensions } from 'react-native';
import { useState, useMemo, useCallback, useEffect } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Info, TrendingUp, Check, Maximize2, Calendar, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import Svg, {
  Line as SvgLine,
  Text as SvgText,
  G,
  Path,
  Defs,
  LinearGradient as SvgLinearGradient,
  Stop,
} from 'react-native-svg';
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
  computeTrendRitme,
  type TrendPoint,
  type MonthBreakdown,
  type FieldCalculation,
  type MonthlyFieldCalculation,
  type ChartSeriesData,
} from '@/lib/charts/calculations';

// ─────────────────────────────────────────────────────────────────────────────
// Shared X-axis helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pick at most `max` evenly-spaced indices from the date array,
 * always including first and last.
 * WHY: showing every date label causes overlap and is unreadable at
 * any zoom level beyond ~7 days.
 */
const sparseXIndices = (total: number, max: number): number[] => {
  if (total === 0) return [];
  if (total <= max) return Array.from({ length: total }, (_, i) => i);
  const indices: number[] = [];
  for (let i = 0; i < max; i++) {
    indices.push(Math.round((i / (max - 1)) * (total - 1)));
  }
  return indices;
};

/**
 * Format a YYYY-MM-DD string as dd/MM/yyyy.
 * WHY: the previous MM/DD format is ambiguous (US-centric) and omits the year,
 * making long-range charts impossible to interpret correctly.
 */
const fmtDate = (iso: string): string => {
  const p = iso.split('-');
  return `${p[2]}/${p[1]}/${p[0]}`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Multi-field accumulated / monthly chart
// REWRITTEN: X-axis now uses dd/MM/yyyy, max 6 labels, with vertical
// grid lines aligned exactly to the label positions.
// ─────────────────────────────────────────────────────────────────────────────

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
  if (fieldData.flatMap((fd) => fd.data).length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.textSecondary }}>No hi ha dades</Text>
      </View>
    );
  }

  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  // Extra bottom padding for rotated dd/MM/yyyy labels (they need more space)
  const paddingBottom = 44;
  const svgWidth = Dimensions.get('window').width - 64;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const yMin = minY;
  const yMax = Math.max(maxY, yMin + 1);
  const yRange = yMax - yMin || 1;
  const total = allDatesInRange.length;

  const toX = (idx: number) =>
    paddingLeft + (idx / Math.max(total - 1, 1)) * chartW;
  const toY = (val: number) =>
    paddingTop + chartH - ((val - yMin) / yRange) * chartH;

  // Y-axis: 5 ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1.0].map((t) => yMin + t * yRange);

  // X-axis: max 6 labels on normal view, 10 on fullscreen
  // Each label gets its own vertical grid line — lines and labels are in sync.
  const targetLabels = isFullScreen ? 10 : 6;
  const xLabelIndices = sparseXIndices(total, targetLabels);

  return (
    <View style={{ height: height + paddingBottom - 28 }}>
      <Svg width={svgWidth} height={height + paddingBottom - 28}>
        {/* Y-axis grid lines + labels */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          const label = Number.isInteger(tick) ? String(tick) : tick.toFixed(1);
          return (
            <G key={`yt-${i}`}>
              <SvgLine
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartW}
                y2={y}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.4}
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

        {/* X-axis: vertical grid lines aligned to label positions, then rotated labels */}
        {xLabelIndices.map((idx) => {
          const date = allDatesInRange[idx];
          if (!date) return null;
          const x = toX(idx);
          const labelY = paddingTop + chartH + 12;
          return (
            <G key={`xl-${idx}`}>
              {/* Subtle vertical grid line — same x as the label below */}
              <SvgLine
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={paddingTop + chartH}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.35}
              />
              {/* Tick mark */}
              <SvgLine
                x1={x}
                y1={paddingTop + chartH}
                x2={x}
                y2={paddingTop + chartH + 4}
                stroke={theme.border}
                strokeWidth={1}
              />
              {/* Date label: rotated -40° to avoid overlap on dd/MM/yyyy strings */}
              <G transform={`rotate(-40, ${x}, ${labelY})`}>
                <SvgText
                  x={x}
                  y={labelY}
                  fontSize={9}
                  fill={theme.textSecondary}
                  textAnchor="end"
                >
                  {fmtDate(date)}
                </SvgText>
              </G>
            </G>
          );
        })}

        {/* Data lines — one segment per consecutive pair within a series */}
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

// ─────────────────────────────────────────────────────────────────────────────
// Trend / Ritme chart (replaces "Taxa de canvi" / DerivativeStepChart)
//
// WHY the old chart was deleted:
//   DerivativeStepChart rendered isolated horizontal stubs per fixed interval
//   (1d/3d/7d). Problems:
//   - Stubs were disconnected — no visual continuity between intervals
//   - Fixed-interval approach created large gaps when data was sparse
//   - Showed raw per-interval volatility, not a rhythm or trend
//   - The interval selector (1d/3d/7d) added complexity without insight
//
// NEW design:
//   - Smooth filled area chart (gradient fill + solid line on top)
//   - Y-axis: normalized improvement rate (0 = no improvement, 1 = peak)
//   - X-axis: same sparse dd/MM/yyyy labels with aligned grid lines
//   - Multiple fields shown as overlaid lines with a shared legend
// ─────────────────────────────────────────────────────────────────────────────

interface TrendRitmeChartProps {
  // One entry per selected field, with pre-computed TrendPoints
  series: { field: string; color: string; label: string; points: TrendPoint[] }[];
  allDatesInRange: string[];
  height: number;
  theme: typeof THEMES['dark'];
}

/** Build a smooth cubic-bezier SVG path through the given pixel points. */
const buildSmoothPath = (pts: { x: number; y: number }[]): string => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0]!.x.toFixed(1)} ${pts[0]!.y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]!;
    const curr = pts[i]!;
    const cpx = ((prev.x + curr.x) / 2).toFixed(1);
    d += ` C ${cpx} ${prev.y.toFixed(1)}, ${cpx} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
  }
  return d;
};

/** Close the line path at the chart bottom to form a filled area. */
const buildAreaPath = (pts: { x: number; y: number }[], bottom: number): string => {
  if (pts.length < 2) return '';
  const line = buildSmoothPath(pts);
  const last = pts[pts.length - 1]!;
  const first = pts[0]!;
  return `${line} L ${last.x.toFixed(1)} ${bottom.toFixed(1)} L ${first.x.toFixed(1)} ${bottom.toFixed(1)} Z`;
};

const TrendRitmeChart = ({
  series,
  allDatesInRange,
  height,
  theme,
}: TrendRitmeChartProps) => {
  const allPoints = series.flatMap((s) => s.points);

  if (allPoints.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.textSecondary, fontSize: 12 }}>
          Not enough data — add more entries to see the trend.
        </Text>
      </View>
    );
  }

  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 44;
  const svgWidth = Dimensions.get('window').width - 64;
  const chartW = svgWidth - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;
  const chartBottom = paddingTop + chartH;

  const total = allDatesInRange.length;

  // Global max across all series — all series share the same Y scale
  // so relative rhythm is comparable between fields.
  const maxVal = Math.max(...allPoints.map((p) => p.value), 0.001);

  // Map date to its pixel X position using allDatesInRange as the ruler.
  // WHY: TrendPoints only exist for recorded days, but we still want their
  // x-position to reflect the real calendar (sparse = wider gaps).
  const dateIndex = new Map(allDatesInRange.map((d, i) => [d, i]));
  const toX = (date: string) => {
    const idx = dateIndex.get(date) ?? 0;
    return paddingLeft + (idx / Math.max(total - 1, 1)) * chartW;
  };
  const toY = (val: number) =>
    paddingTop + chartH - (val / maxVal) * chartH;

  // Y-axis: 3 ticks (0 %, 50 %, 100 % of peak)
  const yTicks = [0, 0.5, 1.0].map((t) => t * maxVal);

  // X-axis: sparse dd/MM/yyyy labels
  const xLabelIndices = sparseXIndices(total, 6);

  return (
    <View style={{ height: height + paddingBottom - 28 }}>
      <Svg width={svgWidth} height={height + paddingBottom - 28}>
        <Defs>
          {series.map((s, si) => (
            <SvgLinearGradient
              key={`grad-${si}`}
              id={`trendGrad${si}`}
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <Stop offset="0" stopColor={s.color} stopOpacity="0.35" />
              <Stop offset="1" stopColor={s.color} stopOpacity="0.02" />
            </SvgLinearGradient>
          ))}
        </Defs>

        {/* Y-axis grid */}
        {yTicks.map((tick, i) => {
          const y = toY(tick);
          const pct = Math.round((tick / maxVal) * 100);
          return (
            <G key={`yt-${i}`}>
              <SvgLine
                x1={paddingLeft}
                y1={y}
                x2={paddingLeft + chartW}
                y2={y}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.4}
              />
              <SvgText
                x={paddingLeft - 6}
                y={y + 4}
                fontSize={9}
                fill={theme.textSecondary}
                textAnchor="end"
              >
                {`${pct}%`}
              </SvgText>
            </G>
          );
        })}

        {/* X-axis: vertical grid lines + rotated dd/MM/yyyy labels */}
        {xLabelIndices.map((idx) => {
          const date = allDatesInRange[idx];
          if (!date) return null;
          const x = toX(date);
          const labelY = chartBottom + 12;
          return (
            <G key={`xl-${idx}`}>
              <SvgLine
                x1={x}
                y1={paddingTop}
                x2={x}
                y2={chartBottom}
                stroke={theme.border}
                strokeWidth={0.5}
                opacity={0.35}
              />
              <SvgLine
                x1={x}
                y1={chartBottom}
                x2={x}
                y2={chartBottom + 4}
                stroke={theme.border}
                strokeWidth={1}
              />
              <G transform={`rotate(-40, ${x}, ${labelY})`}>
                <SvgText
                  x={x}
                  y={labelY}
                  fontSize={9}
                  fill={theme.textSecondary}
                  textAnchor="end"
                >
                  {fmtDate(date)}
                </SvgText>
              </G>
            </G>
          );
        })}

        {/* Series: area fill + line, drawn back-to-front */}
        {series.map((s, si) => {
          if (s.points.length < 2) return null;
          const pixelPts = s.points.map((p) => ({ x: toX(p.date), y: toY(p.value) }));
          const areaD = buildAreaPath(pixelPts, chartBottom);
          const lineD = buildSmoothPath(pixelPts);
          return (
            <G key={`series-${si}`}>
              {/* Gradient fill under the curve */}
              <Path d={areaD} fill={`url(#trendGrad${si})`} />
              {/* Solid line on top */}
              <Path d={lineD} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </G>
          );
        })}
      </Svg>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function GraphsScreen() {
  const router = useRouter();

  const timeframe = useTimeframe();
  const range = useRange();
  const setTimeframe = useSetTimeframe();
  const setCustomRange = useSetCustomRange();
  const isCustomRange = useIsCustomRange();
  const setAllRange = useSetAllRange();

  const { data: allEntries = [] } = useAllEntries();
  const { data: settings } = useSettings();
  const theme = THEMES[settings?.themeStyle ?? 'dark'];

  const trackableVariables = useTrackableVariables();
  const labelMap = useVariableLabelMap();
  const colorMap = useVariableColorMap();

  const [customVarData, setCustomVarData] = useState<Record<string, Record<string, number>>>({});
  const [customVarColumnMap, setCustomVarColumnMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const columns = await getCustomVariableColumns();
        if (columns.length === 0) return;
        const colMap: Record<string, string> = {};
        for (const c of columns) colMap[c.id] = c.columnName;
        setCustomVarColumnMap(colMap);
        const data = await getAllCustomVariableValues(columns.map((c) => c.columnName));
        setCustomVarData(data);
      } catch (_) { /* non-fatal */ }
    };
    load();
  }, []);

  const filteredEntries = useMemo(
    () => filterEntriesByRange(allEntries, range),
    [allEntries, range],
  );

  const allDatesInRange = useMemo(
    () => generateDatesInRange(range.startDate, range.endDate),
    [range],
  );

  const [selectedFields, setSelectedFields] = useState<string[]>(['workedAtJob']);
  const [showFieldSelector, setShowFieldSelector] = useState<boolean>(false);
  const [showAccumulated, setShowAccumulated] = useState<boolean>(true);
  const [showMonthly, setShowMonthly] = useState<boolean>(false);
  const [collapsedSummaries, setCollapsedSummaries] = useState<Set<string>>(new Set());

  const toggleSummary = (id: string) => {
    setCollapsedSummaries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [showStartDatePicker, setShowStartDatePicker] = useState<boolean>(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState<boolean>(false);
  const [tempStartDate, setTempStartDate] = useState<Date>(new Date(range.startDate));
  const [tempEndDate, setTempEndDate] = useState<Date>(new Date(range.endDate));

  const toggleField = useCallback((field: string) => {
    Haptics.selectionAsync();
    setSelectedFields((prev) => {
      const exists = prev.includes(field);
      if (exists) {
        const next = prev.filter((f) => f !== field);
        return next.length > 0 ? next : [field];
      }
      return [...prev, field];
    });
  }, []);

  // Accumulated calculations
  const fieldCalculations = useMemo(() => {
    const out: Record<string, FieldCalculation> = {};
    for (const fieldId of selectedFields) {
      out[fieldId] = calculateFieldData(
        filteredEntries, fieldId, allDatesInRange,
        customVarData, customVarColumnMap[fieldId],
      );
    }
    return out;
  }, [filteredEntries, selectedFields, allDatesInRange, customVarData, customVarColumnMap]);

  // Monthly calculations
  const monthlyCalculations = useMemo(() => {
    const out: Record<string, MonthlyFieldCalculation> = {};
    for (const fieldId of selectedFields) {
      out[fieldId] = calculateMonthlyFieldData(
        filteredEntries, fieldId, allDatesInRange,
        customVarData, customVarColumnMap[fieldId],
      );
    }
    return out;
  }, [filteredEntries, selectedFields, allDatesInRange, customVarData, customVarColumnMap]);

  // Main chart series
  const accumulatedChartData = useMemo((): ChartSeriesData[] =>
    selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      const calc = fieldCalculations[fieldId];
      if (!calc) return { field: fieldId, color, data: [] };
      return {
        field: fieldId, color,
        data: allDatesInRange
          .map((date, idx) => {
            const val = calc.values[idx];
            if (val === null || val === undefined) return null;
            return { index: idx, label: String(idx + 1), date, value: val };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null),
      };
    }),
  [selectedFields, allDatesInRange, fieldCalculations, colorMap]);

  const monthlyChartData = useMemo((): ChartSeriesData[] =>
    selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      const calc = monthlyCalculations[fieldId];
      if (!calc) return { field: fieldId, color, data: [] };
      return {
        field: fieldId, color,
        data: allDatesInRange
          .map((date, idx) => {
            const val = calc.monthlyValues[idx];
            if (val === null || val === undefined) return null;
            return { index: idx, label: String(idx + 1), date, value: val };
          })
          .filter((d): d is NonNullable<typeof d> => d !== null),
      };
    }),
  [selectedFields, allDatesInRange, monthlyCalculations, colorMap]);

  const mainChartData = useMemo((): ChartSeriesData[] => {
    if (!showAccumulated && !showMonthly) return [];
    const series: ChartSeriesData[] = [];
    if (showAccumulated) series.push(...accumulatedChartData);
    if (showMonthly) {
      for (const fd of monthlyChartData) {
        series.push({ ...fd, color: showAccumulated ? lightenColor(fd.color, 0.55) : fd.color });
      }
    }
    return series;
  }, [showAccumulated, showMonthly, accumulatedChartData, monthlyChartData]);

  const maxYValue = useMemo(() => {
    let max = 1;
    for (const fieldId of selectedFields) {
      if (showAccumulated) {
        const c = fieldCalculations[fieldId];
        if (c && c.total > max) max = c.total;
      }
      if (showMonthly) {
        const c = monthlyCalculations[fieldId];
        if (c) {
          const mMax = c.monthlyValues.reduce((a: number, b) => Math.max(a, b ?? 0), 0);
          const aMax = c.accumulatedValues.reduce((a: number, b) => Math.max(a, b ?? 0), 0);
          max = Math.max(max, mMax, aMax);
        }
      }
    }
    return max;
  }, [fieldCalculations, monthlyCalculations, selectedFields, showAccumulated, showMonthly]);

  const hasData = mainChartData.some((f) => f.data.some((d) => d.value > 0));

  // ─────────────────────────────────────────────────────────────────────────
  // Trend / Ritme data
  // Uses accumulated values as input — monthly would introduce artificial
  // resets that create false downward slopes at month boundaries.
  // ─────────────────────────────────────────────────────────────────────────
  const trendSeries = useMemo(
    () =>
      selectedFields
        .filter(() => showAccumulated || showMonthly)
        .map((fieldId) => {
          const color = colorMap[fieldId] ?? '#3b82f6';
          const label = labelMap[fieldId] ?? fieldId;
          const calc = fieldCalculations[fieldId];
          if (!calc) return { field: fieldId, color, label, points: [] as TrendPoint[] };
          const points = computeTrendRitme(calc.values, allDatesInRange, 5);
          return { field: fieldId, color, label, points };
        }),
    [selectedFields, fieldCalculations, allDatesInRange, colorMap, labelMap, showAccumulated, showMonthly],
  );

  const trendHasData = trendSeries.some((s) => s.points.length >= 2);

  // Summary
  const fieldSummaries = useMemo(() => {
    return selectedFields.map((fieldId) => {
      const color = colorMap[fieldId] ?? '#3b82f6';
      const label = labelMap[fieldId] ?? fieldId;
      if (showMonthly) {
        const calc = monthlyCalculations[fieldId];
        if (!calc) return null;
        return {
          fieldId, label, total: calc.total,
          registeredDays: calc.registeredDays,
          slope: calc.registeredDays > 0 ? calc.total / calc.registeredDays : 0,
          color,
          monthlyBreakdown: calc.monthlyBreakdown,
        };
      }
      const calc = fieldCalculations[fieldId];
      if (!calc) return null;
      return {
        fieldId, label, total: calc.total,
        registeredDays: calc.registeredDays,
        slope: calc.registeredDays > 0 ? calc.total / calc.registeredDays : 0,
        color,
        monthlyBreakdown: undefined as MonthBreakdown[] | undefined,
      };
    }).filter(Boolean) as {
      fieldId: string; label: string; total: number;
      registeredDays: number; slope: number; color: string;
      monthlyBreakdown?: MonthBreakdown[];
    }[];
  }, [fieldCalculations, monthlyCalculations, selectedFields, colorMap, labelMap, showMonthly]);

  const handleTimeframeChange = (tf: ChartTimeframe) => {
    Haptics.selectionAsync();
    if (tf === 'all') setAllRange(allEntries);
    else setTimeframe(tf);
  };

  const handleCustomRangeApply = () => {
    setCustomRange(
      tempStartDate.toISOString().split('T')[0]!,
      tempEndDate.toISOString().split('T')[0]!,
    );
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

  const builtInVariables = trackableVariables.filter((v) => v.isBuiltIn);
  const customVariables = trackableVariables.filter((v) => !v.isBuiltIn);

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // Widget order: 1. Summary  2. Trend/Ritme  3. Main chart
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>

          {/* ── Header + range selector ── */}
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TrendingUp size={20} color={theme.accent} />
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginLeft: 8 }}>Gràfics</Text>
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
                      interval: '7',
                    },
                  });
                }}
                style={{ padding: 8, backgroundColor: theme.bg, borderRadius: 8 }}
              >
                <Maximize2 size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            {/* Timeframe pills */}
            <View style={{ flexDirection: 'row', backgroundColor: theme.bg, borderRadius: 10, padding: 3, marginBottom: 14 }}>
              {timeframeOptions.map((option) => {
                const isActive = timeframe === option.value && !isCustomRange;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => handleTimeframeChange(option.value)}
                    style={{
                      flex: 1, alignItems: 'center', justifyContent: 'center',
                      paddingVertical: 7, borderRadius: 8,
                      backgroundColor: isActive ? theme.accent : 'transparent',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? '#fff' : theme.textSecondary, lineHeight: 16 }}>
                      {option.label}
                    </Text>
                    {option.subLabel && (
                      <Text style={{ fontSize: 9, fontWeight: '500', color: isActive ? 'rgba(255,255,255,0.75)' : theme.textSecondary, lineHeight: 11, marginTop: 1 }}>
                        {option.subLabel}
                      </Text>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* Custom date range */}
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

          {/* ── Chart type toggles ── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowAccumulated((v) => !v); }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: showAccumulated ? theme.accent : theme.border, backgroundColor: showAccumulated ? theme.accent + '22' : 'transparent' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: showAccumulated ? theme.accent : theme.textSecondary }}>Acumulat</Text>
              <Text style={{ fontSize: 10, color: showAccumulated ? theme.accent + 'cc' : theme.textSecondary, marginTop: 1 }}>total acumulat</Text>
            </Pressable>
            <Pressable
              onPress={() => { Haptics.selectionAsync(); setShowMonthly((v) => !v); }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: showMonthly ? '#10b981' : theme.border, backgroundColor: showMonthly ? '#10b98122' : 'transparent' }}
            >
              <Text style={{ fontSize: 14, fontWeight: '700', color: showMonthly ? '#10b981' : theme.textSecondary }}>Mensual</Text>
              <Text style={{ fontSize: 10, color: showMonthly ? '#10b981cc' : theme.textSecondary, marginTop: 1 }}>reinicia per mes</Text>
            </Pressable>
          </View>

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

          {/* ── Field selector ── */}
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
                  {showAccumulated && showMonthly ? 'Acumulat + Mensual'
                    : showAccumulated ? 'Recompte acumulat al llarg del temps'
                    : showMonthly ? 'Vista amb reinici mensual'
                    : 'Cap tipus de gràfic seleccionat'}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {selectedFields.slice(0, 3).map((fieldId) => (
                  <View key={fieldId} style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: colorMap[fieldId] ?? '#3b82f6' }} />
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
                    <View key={fieldId} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: color + '20', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 6 }} />
                      <Text style={{ fontSize: 12, color: theme.text }}>{label}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </Pressable>

          {/* ═══════════════════════════════════════════════════════════════
              WIDGET 1 — SUMMARY
              Shown first so the user sees totals/rates before the charts.
          ═══════════════════════════════════════════════════════════════ */}
          {fieldSummaries.length > 0 && (showAccumulated || showMonthly) && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: theme.text, marginBottom: 12 }}>Resum dades</Text>
              <View style={{ gap: 4 }}>
                {fieldSummaries.map((summary) => {
                  const isCollapsed = collapsedSummaries.has(summary.fieldId);
                  return (
                    <View key={summary.fieldId} style={{ backgroundColor: theme.bg, borderRadius: 12, overflow: 'hidden', marginBottom: 8 }}>
                      <Pressable
                        onPress={() => toggleSummary(summary.fieldId)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14 }}
                      >
                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: summary.color, marginRight: 10 }} />
                        <Text style={{ fontSize: 14, color: theme.text, flex: 1, fontWeight: '600' }}>{summary.label}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 16, fontWeight: 'bold', color: summary.color }}>{summary.total}</Text>
                            <Text style={{ fontSize: 9, color: theme.textSecondary }}>total</Text>
                          </View>
                          {isCollapsed ? <ChevronDown size={16} color={theme.textSecondary} /> : <ChevronUp size={16} color={theme.textSecondary} />}
                        </View>
                      </Pressable>

                      {!isCollapsed && (
                        <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 6 }}>
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

                          {showMonthly && summary.monthlyBreakdown && summary.monthlyBreakdown.length > 0 && (
                            <View style={{ borderLeftWidth: 2, borderLeftColor: summary.color + '40', paddingLeft: 12, gap: 6, marginTop: 4 }}>
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

          {/* ═══════════════════════════════════════════════════════════════
              WIDGET 2 — TREND / RITME
              Shows improvement rhythm as a smooth gradient area chart.
              Only appears when there is enough data for the computation.
          ═══════════════════════════════════════════════════════════════ */}
          {(showAccumulated || showMonthly) && (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 16 }}>
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: theme.text }}>Trend / Ritme</Text>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>
                  Improvement rhythm — smoothed slope, negative values hidden
                </Text>
              </View>

              {/* Multi-field legend */}
              {selectedFields.length > 1 && trendHasData && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 }}>
                  {trendSeries.map((s) => (
                    <View key={s.field} style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 14, height: 3, borderRadius: 2, backgroundColor: s.color, marginRight: 5 }} />
                      <Text style={{ fontSize: 10, color: theme.textSecondary }}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TrendRitmeChart
                series={trendSeries}
                allDatesInRange={allDatesInRange}
                height={200}
                theme={theme}
              />

              <Text style={{ fontSize: 10, color: theme.textSecondary, textAlign: 'center', marginTop: 6 }}>
                Per-day improvement rate, moving-average smoothed
              </Text>
            </View>
          )}

          {/* ═══════════════════════════════════════════════════════════════
              WIDGET 3 — MAIN DATA CHART
              Accumulated and/or monthly lines with correct X-axis.
          ═══════════════════════════════════════════════════════════════ */}
          {!showAccumulated && !showMonthly ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 32, marginBottom: 16, alignItems: 'center' }}>
              <Info size={40} color={theme.textSecondary} />
              <Text style={{ fontSize: 15, color: theme.text, marginTop: 16, textAlign: 'center', fontWeight: '600' }}>Selecciona un tipus de gràfic</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>Activa Acumulat o Mensual (o tots dos) a dalt</Text>
            </View>
          ) : hasData ? (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 16, marginBottom: 32 }}>
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
                Toca la icona per pantalla completa
              </Text>
            </View>
          ) : (
            <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 32, marginBottom: 32, alignItems: 'center' }}>
              <Info size={48} color={theme.textSecondary} />
              <Text style={{ fontSize: 16, color: theme.text, marginTop: 16, textAlign: 'center' }}>No hi ha dades en el rang seleccionat</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginTop: 8, textAlign: 'center' }}>Prova un rang de temps o camp diferent</Text>
            </View>
          )}

        </ScrollView>
      </SafeAreaView>

      {/* Field selector modal */}
      <Modal visible={showFieldSelector} transparent animationType="slide">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }} onPress={() => setShowFieldSelector(false)}>
          <Pressable style={{ backgroundColor: theme.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingBottom: 32, maxHeight: '85%' }} onPress={(e) => e.stopPropagation()}>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ width: 40, height: 4, backgroundColor: theme.border, borderRadius: 2 }} />
            </View>
            <ScrollView style={{ padding: 16 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 6 }}>Selecciona camps</Text>
              <Text style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 18 }}>Selecciona múltiples camps per comparar al mateix gràfic.</Text>

              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Variables predefinides</Text>
              {builtInVariables.map((variable) => {
                const isSelected = selectedFields.includes(variable.id);
                const color = colorMap[variable.id] ?? variable.color;
                const label = labelMap[variable.id] ?? variable.label;
                return (
                  <Pressable
                    key={variable.id}
                    onPress={() => toggleField(variable.id)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 8, backgroundColor: isSelected ? color + '20' : theme.bg, borderRadius: 12, borderWidth: 1, borderColor: isSelected ? color : theme.border }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: color, marginRight: 12 }} />
                    <Text style={{ flex: 1, fontSize: 15, color: theme.text }}>{label}</Text>
                    {isSelected && <Check size={20} color={color} />}
                  </Pressable>
                );
              })}

              {customVariables.length > 0 && (
                <>
                  <View style={{ height: 10 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.textSecondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>Variables personalitzades</Text>
                  {customVariables.map((variable) => {
                    const isSelected = selectedFields.includes(variable.id);
                    const color = colorMap[variable.id] ?? variable.color;
                    const label = labelMap[variable.id] ?? variable.label;
                    return (
                      <Pressable
                        key={variable.id}
                        onPress={() => toggleField(variable.id)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, marginBottom: 8, backgroundColor: isSelected ? color + '20' : theme.bg, borderRadius: 12, borderWidth: 1, borderColor: isSelected ? color : theme.border }}
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

      {/* Start date picker */}
      <Modal visible={showStartDatePicker} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowStartDatePicker(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Data d'inici</Text>
            <DateTimePicker value={tempStartDate} mode="date" display="spinner" onChange={(e, date) => date && setTempStartDate(date)} maximumDate={new Date()} textColor={theme.text} />
            <Pressable onPress={() => { setShowStartDatePicker(false); handleCustomRangeApply(); }} style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Aplicar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* End date picker */}
      <Modal visible={showEndDatePicker} transparent animationType="fade">
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }} onPress={() => setShowEndDatePicker(false)}>
          <View style={{ backgroundColor: theme.card, borderRadius: 16, padding: 20, width: '90%' }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.text, marginBottom: 16, textAlign: 'center' }}>Data de fi</Text>
            <DateTimePicker value={tempEndDate} mode="date" display="spinner" onChange={(e, date) => date && setTempEndDate(date)} maximumDate={new Date()} textColor={theme.text} />
            <Pressable onPress={() => { setShowEndDatePicker(false); handleCustomRangeApply(); }} style={{ backgroundColor: theme.accent, borderRadius: 12, padding: 14, marginTop: 16 }}>
              <Text style={{ color: '#fff', fontWeight: '600', textAlign: 'center' }}>Aplicar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}
