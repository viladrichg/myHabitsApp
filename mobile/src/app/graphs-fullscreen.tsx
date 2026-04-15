import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { useState, useMemo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { X, ZoomIn, ZoomOut, RotateCw, RefreshCw, TrendingUp } from 'lucide-react-native';
import Svg, {
  Line as SvgLine,
  Text as SvgText,
  Circle,
  G,
  Defs,
  ClipPath,
  Rect,
} from 'react-native-svg';
import Animated, { useSharedValue, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { THEMES } from '@/lib/database/types';
import { useAllEntries, useSettings } from '@/lib/state/data-layer';
import { useRange, filterEntriesByRange } from '@/lib/state/time-range-store';
import {
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
  type ChartSeriesData,
  type FieldCalculation,
  type MonthlyFieldCalculation,
} from '@/lib/charts/calculations';

// ─────────────────────────────────────────────────────────────────────────────
// SVG Chart — pure render, no gesture logic
// ─────────────────────────────────────────────────────────────────────────────
interface ChartSvgProps {
  fieldData: ChartSeriesData[];
  visibleDates: string[];
  chartW: number;
  chartH: number;
  maxY: number;
  theme: typeof THEMES['dark'];
  isHorizontal: boolean;
}

const ChartSvg = ({
  fieldData,
  visibleDates,
  chartW,
  chartH,
  maxY,
  theme,
  isHorizontal,
}: ChartSvgProps) => {
  // Horizontal mode has a wider chart → more X labels / fewer Y ticks needed
  const PAD_LEFT   = 52;
  const PAD_RIGHT  = 16;
  const PAD_TOP    = 14;
  const PAD_BOTTOM = 34;

  const innerW = Math.max(1, chartW - PAD_LEFT - PAD_RIGHT);
  const innerH = Math.max(1, chartH - PAD_TOP - PAD_BOTTOM);

  const total  = visibleDates.length;
  const yMin   = 0;
  const yMax   = Math.max(maxY, 1);
  const yRange = yMax - yMin || 1;

  const toX = (idx: number) =>
    PAD_LEFT + (idx / Math.max(total - 1, 1)) * innerW;
  const toY = (val: number) =>
    PAD_TOP + innerH - ((val - yMin) / yRange) * innerH;

  // More ticks when there's more real estate
  const yTickCount   = isHorizontal ? 5 : 7;
  const maxXLabels   = Math.min(isHorizontal ? 24 : 10, total);

  const yTicks = Array.from({ length: yTickCount }, (_, i) =>
    yMin + (i / Math.max(yTickCount - 1, 1)) * yRange,
  );

  const xLabelIndices: number[] = [];
  if (total > 0) {
    if (maxXLabels <= 1) {
      xLabelIndices.push(0);
    } else {
      for (let i = 0; i < maxXLabels; i++) {
        xLabelIndices.push(Math.round((i / (maxXLabels - 1)) * (total - 1)));
      }
    }
  }

  const allPoints = fieldData.flatMap((fd) => fd.data);

  if (allPoints.length === 0 || total === 0) {
    return (
      <View
        style={{
          width: chartW,
          height: chartH,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <TrendingUp size={32} color={theme.textSecondary} />
        <Text style={{ color: theme.textSecondary, fontSize: 14, marginTop: 8 }}>
          No hi ha dades en el rang seleccionat
        </Text>
      </View>
    );
  }

  const fs = 9.5; // font size

  return (
    <Svg width={chartW} height={chartH}>
      <Defs>
        {/* Clip lines to the inner chart area only */}
        <ClipPath id="fsClip">
          <Rect x={PAD_LEFT} y={PAD_TOP} width={innerW} height={innerH} />
        </ClipPath>
      </Defs>

      {/* ── Axis lines ── */}
      <SvgLine
        x1={PAD_LEFT} y1={PAD_TOP}
        x2={PAD_LEFT} y2={PAD_TOP + innerH}
        stroke={theme.border} strokeWidth={1} opacity={0.7}
      />
      <SvgLine
        x1={PAD_LEFT} y1={PAD_TOP + innerH}
        x2={PAD_LEFT + innerW} y2={PAD_TOP + innerH}
        stroke={theme.border} strokeWidth={1} opacity={0.7}
      />

      {/* ── Y-axis grid + labels ── */}
      {yTicks.map((tick, i) => {
        const y = toY(tick);
        const label =
          tick >= 1000
            ? `${(tick / 1000).toFixed(1)}k`
            : tick >= 100
            ? Math.round(tick).toString()
            : tick >= 10
            ? tick.toFixed(1)
            : tick.toFixed(2);
        return (
          <G key={`yt-${i}`}>
            <SvgLine
              x1={PAD_LEFT} y1={y}
              x2={PAD_LEFT + innerW} y2={y}
              stroke={theme.border} strokeWidth={0.5} opacity={0.25}
            />
            <SvgText
              x={PAD_LEFT - 6}
              y={y + 4}
              fontSize={fs}
              fill={theme.textSecondary}
              textAnchor="end"
            >
              {label}
            </SvgText>
          </G>
        );
      })}

      {/* ── X-axis date labels ── */}
      {xLabelIndices.map((idx) => {
        const date = visibleDates[idx];
        if (!date) return null;
        const parts = date.split('-');
        const label = `${parts[1]}/${parts[2]}`;
        return (
          <SvgText
            key={`xl-${idx}`}
            x={toX(idx)}
            y={PAD_TOP + innerH + 22}
            fontSize={fs}
            fill={theme.textSecondary}
            textAnchor="middle"
          >
            {label}
          </SvgText>
        );
      })}

      {/* ── Data lines — clipped to chart area ── */}
      <G clipPath="url(#fsClip)">
        {fieldData.map((fd, si) => {
          if (fd.data.length < 2) return null;
          return fd.data.slice(1).map((pt, i) => {
            const prev = fd.data[i]!;
            return (
              <SvgLine
                key={`${si}-${fd.field}-${i}`}
                x1={toX(prev.index)} y1={toY(prev.value)}
                x2={toX(pt.index)}  y2={toY(pt.value)}
                stroke={fd.color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            );
          });
        })}
      </G>

      {/* ── Last-point dots ── */}
      {fieldData.map((fd, si) => {
        if (fd.data.length === 0) return null;
        const last = fd.data[fd.data.length - 1]!;
        if (last.index < 0 || last.index >= total) return null;
        return (
          <Circle
            key={`dot-${si}-${fd.field}`}
            cx={toX(last.index)}
            cy={toY(last.value)}
            r={3.5}
            fill={fd.color}
          />
        );
      })}
    </Svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar button helper
// ─────────────────────────────────────────────────────────────────────────────
function ToolBtn({
  onPress,
  active,
  bg,
  children,
}: {
  onPress: () => void;
  active?: boolean;
  bg?: string;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: active ? '#3b82f6' : (bg ?? 'rgba(255,255,255,0.1)'),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </Pressable>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Full-screen screen
// ─────────────────────────────────────────────────────────────────────────────
export default function GraphsFullscreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    fields: string;
    accumulated: string;
    monthly: string;
    interval: string;
  }>();

  const { width: physW, height: physH } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const topPad   = insets.top;
  const botPad   = insets.bottom;
  const leftPad  = insets.left;
  const rightPad = insets.right;

  // ── Manual orientation toggle ──
  const [isHorizontal, setIsHorizontal] = useState(false);

  // Available pixel area for the chart (below the toolbar)
  const TOOLBAR_TOTAL_H = topPad + 52; // safe-area + 52px row
  const availW = physW - leftPad - rightPad;
  const availH = physH - TOOLBAR_TOTAL_H - botPad;

  // Logical chart size:
  //  Portrait  → chartW = availW,  chartH = availH
  //  Horizontal → chartW = availH,  chartH = availW  (then rotate -90°)
  const CHART_W = isHorizontal ? availH : availW;
  const CHART_H = isHorizontal ? availW : availH;

  // ── Viewport (zoom/pan) ──
  const [viewStart, setViewStart] = useState(0);  // 0..1 fraction
  const [viewFrac,  setViewFrac]  = useState(1);  // fraction of data visible

  // Shared values for gesture worklets
  const savedStart = useSharedValue(0);
  const savedFrac  = useSharedValue(1);
  const currStart  = useSharedValue(0);
  const currFrac   = useSharedValue(1);
  const innerWRef  = useSharedValue(Math.max(1, CHART_W - 52 - 16));
  const isHorizRef = useSharedValue(false);

  // Keep shared values in sync
  useEffect(() => {
    innerWRef.value  = Math.max(1, CHART_W - 52 - 16);
    isHorizRef.value = isHorizontal;
  }, [CHART_W, isHorizontal, innerWRef, isHorizRef]);

  // ── Reset helper ──
  const resetViewport = () => {
    setViewStart(0); setViewFrac(1);
    savedStart.value = 0; savedFrac.value = 1;
    currStart.value  = 0; currFrac.value  = 1;
  };

  // ── Gesture: pinch-to-zoom ──
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      const newFrac  = Math.max(0.04, Math.min(1, savedFrac.value / e.scale));
      const delta    = (savedFrac.value - newFrac) / 2;
      const newStart = Math.max(0, Math.min(1 - newFrac, savedStart.value + delta));
      currStart.value = newStart;
      currFrac.value  = newFrac;
      runOnJS(setViewStart)(newStart);
      runOnJS(setViewFrac)(newFrac);
    })
    .onEnd(() => {
      'worklet';
      savedStart.value = currStart.value;
      savedFrac.value  = currFrac.value;
    });

  // ── Gesture: pan ──
  // In portrait: user pans LEFT/RIGHT → translationX
  // In horizontal (chart rotated -90°): time axis runs along physical Y
  //   → user pans UP/DOWN → translationY
  const panGesture = Gesture.Pan()
    .minDistance(4)
    .onUpdate((e) => {
      'worklet';
      const frac = currFrac.value;
      // Choose axis depending on orientation
      const rawDelta = isHorizRef.value ? e.translationY : -e.translationX;
      const delta    = (rawDelta / innerWRef.value) * frac;
      const newStart = Math.max(0, Math.min(1 - frac, savedStart.value + delta));
      currStart.value = newStart;
      runOnJS(setViewStart)(newStart);
    })
    .onEnd(() => {
      'worklet';
      savedStart.value = currStart.value;
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture);

  // ── Parse route params ──
  const selectedFields = useMemo<string[]>(() => {
    try { return JSON.parse(params.fields ?? '["workedAtJob"]'); }
    catch { return ['workedAtJob']; }
  }, [params.fields]);

  const showAccumulated = params.accumulated !== '0';
  const showMonthly     = params.monthly === '1';

  // ── Data stores ──
  const { data: allEntries = [] } = useAllEntries();
  const { data: settings }        = useSettings();
  const theme    = THEMES[settings?.themeStyle ?? 'dark'];
  const range    = useRange();
  const labelMap = useVariableLabelMap();
  const colorMap = useVariableColorMap();

  const [customVarData,      setCustomVarData]      = useState<Record<string, Record<string, number>>>({});
  const [customVarColumnMap, setCustomVarColumnMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const load = async () => {
      try {
        const cols = await getCustomVariableColumns();
        if (cols.length === 0) return;
        const colMap: Record<string, string> = {};
        for (const c of cols) colMap[c.id] = c.columnName;
        setCustomVarColumnMap(colMap);
        const data = await getAllCustomVariableValues(cols.map((c) => c.columnName));
        setCustomVarData(data);
      } catch { /* ignore */ }
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

  const fieldCalculations = useMemo(() => {
    const out: Record<string, FieldCalculation> = {};
    for (const fid of selectedFields) {
      out[fid] = calculateFieldData(
        filteredEntries, fid, allDatesInRange,
        customVarData, customVarColumnMap[fid],
      );
    }
    return out;
  }, [filteredEntries, selectedFields, allDatesInRange, customVarData, customVarColumnMap]);

  const monthlyCalculations = useMemo(() => {
    const out: Record<string, MonthlyFieldCalculation> = {};
    for (const fid of selectedFields) {
      out[fid] = calculateMonthlyFieldData(
        filteredEntries, fid, allDatesInRange,
        customVarData, customVarColumnMap[fid],
      );
    }
    return out;
  }, [filteredEntries, selectedFields, allDatesInRange, customVarData, customVarColumnMap]);

  const accChartData = useMemo((): ChartSeriesData[] =>
    selectedFields.map((fid) => {
      const color = colorMap[fid] ?? '#3b82f6';
      const calc  = fieldCalculations[fid];
      if (!calc) return { field: fid, color, data: [] };
      return {
        field: fid, color,
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

  const moChartData = useMemo((): ChartSeriesData[] =>
    selectedFields.map((fid) => {
      const color = colorMap[fid] ?? '#3b82f6';
      const calc  = monthlyCalculations[fid];
      if (!calc) return { field: fid, color, data: [] };
      return {
        field: fid, color,
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

  const fullChartData = useMemo((): ChartSeriesData[] => {
    if (!showAccumulated && !showMonthly) return [];
    const series: ChartSeriesData[] = [];
    if (showAccumulated) for (const fd of accChartData) series.push(fd);
    if (showMonthly) {
      for (const fd of moChartData) {
        const color = showAccumulated ? lightenColor(fd.color, 0.55) : fd.color;
        series.push({ ...fd, color });
      }
    }
    return series;
  }, [showAccumulated, showMonthly, accChartData, moChartData]);

  const maxYValue = useMemo(() => {
    let max = 1;
    for (const fid of selectedFields) {
      if (showAccumulated) {
        const c = fieldCalculations[fid];
        if (c && c.total > max) max = c.total;
      }
      if (showMonthly) {
        const c = monthlyCalculations[fid];
        if (c) {
          max = Math.max(
            max,
            c.monthlyValues.reduce((a: number, b) => Math.max(a, b ?? 0), 0),
            c.accumulatedValues.reduce((a: number, b) => Math.max(a, b ?? 0), 0),
          );
        }
      }
    }
    return max;
  }, [fieldCalculations, monthlyCalculations, selectedFields, showAccumulated, showMonthly]);

  // ── Viewport → visible slice of data ──
  const total = allDatesInRange.length;

  const { visibleDates, visibleChartData } = useMemo(() => {
    if (total === 0) return { visibleDates: [], visibleChartData: [] };
    const startIdx  = Math.round(viewStart * (total - 1));
    const count     = Math.max(2, Math.round(viewFrac * total));
    const endIdx    = Math.min(total - 1, startIdx + count - 1);
    const vDates    = allDatesInRange.slice(startIdx, endIdx + 1);
    const vData     = fullChartData.map((fd) => ({
      ...fd,
      data: fd.data
        .filter((d) => d.index >= startIdx && d.index <= endIdx)
        .map((d) => ({ ...d, index: d.index - startIdx })),
    }));
    return { visibleDates: vDates, visibleChartData: vData };
  }, [allDatesInRange, fullChartData, viewStart, viewFrac, total]);

  // ── Labels ──
  const modeLabel =
    showAccumulated && showMonthly ? 'Acumulat + Mensual'
    : showAccumulated ? 'Acumulat'
    : showMonthly    ? 'Mensual'
    : '—';

  const zoomPct  = Math.round((1 / viewFrac) * 100);
  const isZoomed = viewFrac < 0.985;

  // ── Zoom button helpers ──
  const zoomIn = () => {
    const newFrac  = Math.max(0.04, viewFrac / 1.6);
    const newStart = Math.max(0, Math.min(1 - newFrac, viewStart + (viewFrac - newFrac) / 2));
    setViewFrac(newFrac); setViewStart(newStart);
    savedFrac.value = newFrac; savedStart.value = newStart;
    currFrac.value  = newFrac; currStart.value  = newStart;
  };
  const zoomOut = () => {
    const newFrac  = Math.min(1, viewFrac * 1.6);
    const newStart = Math.max(0, Math.min(1 - newFrac, viewStart + (viewFrac - newFrac) / 2));
    setViewFrac(newFrac); setViewStart(newStart);
    savedFrac.value = newFrac; savedStart.value = newStart;
    currFrac.value  = newFrac; currStart.value  = newStart;
  };

  // ── Rotation transform ──
  // When horizontal, we render a chart of (availH × availW) logical pixels then
  // rotate it –90° so it fills the physical (availW × availH) screen area below the toolbar.
  //
  //   TX = (physW − availH) / 2   →  re-centres the view horizontally
  //   TY = (availH − availW) / 2  →  re-centres the view vertically
  //   rotate(−90deg)               →  swaps w/h so the chart fills the screen

  const TX = (physW - availH) / 2;
  const TY = (availH - availW) / 2;

  const chartTransform = isHorizontal
    ? ([{ translateX: TX }, { translateY: TY }, { rotate: '-90deg' }] as const)
    : undefined;

  // Chart container is always absolutely positioned, below the toolbar
  const chartContainerStyle = {
    position: 'absolute' as const,
    top: TOOLBAR_TOTAL_H,
    left: isHorizontal ? 0 : leftPad,
    width:  CHART_W,
    height: CHART_H,
    backgroundColor: theme.card,
    ...(chartTransform ? { transform: chartTransform } : {}),
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg, overflow: 'hidden' }}>

      {/* ── Chart canvas (gesture area) — rendered UNDER the toolbar ── */}
      <GestureDetector gesture={composed}>
        <Animated.View style={chartContainerStyle}>
          <ChartSvg
            fieldData={visibleChartData}
            visibleDates={visibleDates}
            chartW={CHART_W}
            chartH={CHART_H}
            maxY={maxYValue}
            theme={theme}
            isHorizontal={isHorizontal}
          />
        </Animated.View>
      </GestureDetector>

      {/* ── Toolbar — ALWAYS on top via absolute + zIndex ── */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: TOOLBAR_TOTAL_H,
          paddingTop: topPad,
          paddingLeft:  leftPad  + 10,
          paddingRight: rightPad + 10,
          backgroundColor: theme.bg,
          zIndex: 20,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 7,
        }}
      >
        {/* Close */}
        <ToolBtn onPress={() => router.back()} bg={theme.card}>
          <X size={16} color={theme.text} />
        </ToolBtn>

        {/* Mode badge */}
        <View
          style={{
            backgroundColor: theme.card,
            borderRadius: 7,
            paddingHorizontal: 8,
            paddingVertical: 4,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', color: theme.accent }}>
            {modeLabel}
          </Text>
        </View>

        {/* Zoom % badge */}
        {isZoomed && (
          <View
            style={{
              backgroundColor: theme.accent + '25',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 3,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '700', color: theme.accent }}>
              {zoomPct}%
            </Text>
          </View>
        )}

        {/* Spacer + compact legend */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'flex-end', overflow: 'hidden' }}>
          {selectedFields.slice(0, 3).map((fid) => {
            const color = colorMap[fid] ?? '#3b82f6';
            const label = labelMap[fid] ?? fid;
            return (
              <View key={fid} style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <View style={{ width: 10, height: 3, borderRadius: 2, backgroundColor: color }} />
                <Text style={{ fontSize: 9, color: theme.textSecondary }} numberOfLines={1}>
                  {label}
                </Text>
              </View>
            );
          })}
          {selectedFields.length > 3 && (
            <Text style={{ fontSize: 9, color: theme.textSecondary }}>
              +{selectedFields.length - 3}
            </Text>
          )}
        </View>

        {/* Reset zoom */}
        <ToolBtn onPress={resetViewport} bg={theme.card} active={isZoomed}>
          <RefreshCw size={14} color={isZoomed ? '#fff' : theme.textSecondary} />
        </ToolBtn>

        {/* Zoom out */}
        <ToolBtn onPress={zoomOut} bg={theme.card}>
          <ZoomOut size={14} color={theme.textSecondary} />
        </ToolBtn>

        {/* Zoom in */}
        <ToolBtn onPress={zoomIn} bg={theme.card}>
          <ZoomIn size={14} color={theme.textSecondary} />
        </ToolBtn>

        {/* Orientation toggle */}
        <ToolBtn
          onPress={() => {
            setIsHorizontal((h) => !h);
            resetViewport();
          }}
          active={isHorizontal}
        >
          <RotateCw size={14} color={isHorizontal ? '#fff' : theme.textSecondary} />
        </ToolBtn>
      </View>

      {/* ── Bottom safe-area filler ── */}
      {botPad > 0 && (
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: botPad,
            backgroundColor: theme.bg,
            zIndex: 5,
          }}
        />
      )}
    </View>
  );
}
