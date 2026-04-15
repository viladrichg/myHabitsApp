/**
 * MultiSeriesChart Component
 *
 * A robust visualization component supporting:
 * - Multiple simultaneous series/lines
 * - Proper gap handling (missing data = line break, no interpolation)
 * - Mandatory visible axes with readable labels
 * - Configurable Y-axis range
 * - Time-based X-axis (days or months based on zoom)
 */

import { View, Text } from 'react-native';
import { useMemo } from 'react';
import { CartesianChart, Line } from 'victory-native';
import { Circle } from '@shopify/react-native-skia';
import { THEMES } from '@/lib/database/types';

export interface ChartDataPoint {
  value: number | null; // null means missing data
  date: string; // YYYY-MM-DD
  label: string;
}

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  data: ChartDataPoint[];
}

interface MultiSeriesChartProps {
  series: ChartSeries[];
  height?: number;
  yAxisMin?: number;
  yAxisMax?: number;
  yAxisLabel?: string;
  xAxisLabel?: string;
  showPoints?: boolean;
  formatYLabel?: (value: number) => string;
  formatXLabel?: (date: string, index: number, total: number) => string;
}

// Generate all dates in a range for proper alignment
const generateDateRange = (startDate: string, endDate: string): string[] => {
  const dates: string[] = [];
  const start = new Date(startDate + 'T12:00:00');
  const end = new Date(endDate + 'T12:00:00');

  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }

  return dates;
};

export default function MultiSeriesChart({
  series,
  height = 220,
  yAxisMin,
  yAxisMax,
  yAxisLabel,
  xAxisLabel,
  showPoints = true,
  formatYLabel = (v: number) => String(Math.round(v)),
  formatXLabel,
}: MultiSeriesChartProps) {
  const theme = THEMES.dark;

  // Combine all dates from all series for consistent X-axis
  const allDates = useMemo(() => {
    const dateSet = new Set<string>();
    series.forEach(s => {
      s.data.forEach(d => dateSet.add(d.date));
    });
    const sortedDates = Array.from(dateSet).sort();
    if (sortedDates.length < 2) return sortedDates;

    // Fill in all dates in range
    return generateDateRange(sortedDates[0], sortedDates[sortedDates.length - 1]);
  }, [series]);

  // Calculate Y-axis bounds
  const yBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    series.forEach(s => {
      s.data.forEach(d => {
        if (d.value !== null && !isNaN(d.value)) {
          min = Math.min(min, d.value);
          max = Math.max(max, d.value);
        }
      });
    });

    // Use provided bounds if available, otherwise use calculated
    const finalMin = yAxisMin !== undefined ? yAxisMin : Math.floor(min === Infinity ? 0 : min);
    const finalMax = yAxisMax !== undefined ? yAxisMax : Math.ceil(max === -Infinity ? 10 : max);

    // Add some padding if bounds are equal
    if (finalMin === finalMax) {
      return { min: finalMin - 1, max: finalMax + 1 };
    }

    return { min: finalMin, max: finalMax };
  }, [series, yAxisMin, yAxisMax]);

  // For multi-series: render each series separately using its own filtered data
  // This avoids victory-native's strict typing on dynamic yKeys
  const perSeriesData = useMemo(() => {
    return series.map((s) => {
      const dataMap = new Map<string, number | null>();
      s.data.forEach((d) => dataMap.set(d.date, d.value));

      // Only include dates that have data for this series (creates gaps for missing)
      const filtered: { idx: number; value: number; date: string }[] = [];
      allDates.forEach((date, index) => {
        const val = dataMap.get(date);
        if (val !== null && val !== undefined && !isNaN(val)) {
          filtered.push({ idx: index + 1, value: val, date });
        }
      });

      return { color: s.color, data: filtered };
    });
  }, [series, allDates]);

  // Check if any series has data
  const hasAnyData = perSeriesData.some((s) => s.data.length > 0);

  // Generate X-axis format function
  const formatX = useMemo(() => {
    if (formatXLabel) return formatXLabel;
    return (date: string, _index: number, _total: number) => {
      const parts = date.split('-');
      return `${parts[1]}/${parts[2]}`;
    };
  }, [formatXLabel]);

  // No data to display
  if (!hasAnyData || series.length === 0) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: theme.textSecondary }}>No data available</Text>
      </View>
    );
  }

  // Use the first series with data as the primary for the CartesianChart axes
  const primaryData = perSeriesData.find((s) => s.data.length > 0)?.data ?? [];

  return (
    <View style={{ height }}>
      {/* Y-Axis Label */}
      {yAxisLabel && (
        <View style={{
          position: 'absolute',
          left: -20,
          top: height / 2 - 30,
          transform: [{ rotate: '-90deg' }],
          width: 60,
        }}>
          <Text style={{ fontSize: 10, color: theme.textSecondary, textAlign: 'center' }}>
            {yAxisLabel}
          </Text>
        </View>
      )}

      {/* Main Chart */}
      <View style={{ flex: 1, marginLeft: yAxisLabel ? 12 : 0 }}>
        <CartesianChart
          data={primaryData}
          xKey="idx"
          yKeys={['value']}
          domain={{ y: [yBounds.min, yBounds.max] }}
          domainPadding={{ left: 20, right: 20, top: 20, bottom: 10 }}
          axisOptions={{
            font: null,
            tickCount: { x: Math.min(primaryData.length, 7), y: 5 },
            lineColor: theme.border,
            labelColor: theme.textSecondary,
            formatXLabel: (value: unknown) => {
              const idx = parseInt(String(value), 10) - 1;
              if (idx >= 0 && idx < allDates.length) {
                return formatX(allDates[idx], idx, allDates.length);
              }
              return String(value);
            },
            formatYLabel: (value: unknown) => formatYLabel(Number(value)),
          }}
        >
          {({ points }) => (
            <>
              {/* Primary series line */}
              <Line
                points={points.value}
                color={perSeriesData[0]?.color ?? theme.accent}
                strokeWidth={2.5}
                animate={{ type: 'timing', duration: 300 }}
                curveType="linear"
                connectMissingData={false}
              />
              {/* Primary series points */}
              {showPoints && points.value.map((point: { x: number; y: number | null | undefined }, index: number) => {
                if (point.x == null || point.y == null || point.y === undefined) return null;
                return (
                  <Circle
                    key={`point-0-${index}`}
                    cx={point.x}
                    cy={point.y}
                    r={3}
                    color={perSeriesData[0]?.color ?? theme.accent}
                  />
                );
              })}
            </>
          )}
        </CartesianChart>

        {/* Overlay additional series using absolute positioned charts */}
        {perSeriesData.slice(1).map((seriesItem, sIdx) => {
          if (seriesItem.data.length === 0) return null;
          return (
            <View key={`overlay-${sIdx}`} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
              <CartesianChart
                data={seriesItem.data}
                xKey="idx"
                yKeys={['value']}
                domain={{ y: [yBounds.min, yBounds.max] }}
                domainPadding={{ left: 20, right: 20, top: 20, bottom: 10 }}
                axisOptions={{
                  font: null,
                  tickCount: { x: 0, y: 0 },
                  lineColor: 'transparent',
                  labelColor: 'transparent',
                  formatXLabel: () => '',
                  formatYLabel: () => '',
                }}
              >
                {({ points: overlayPoints }) => (
                  <>
                    <Line
                      points={overlayPoints.value}
                      color={seriesItem.color}
                      strokeWidth={2.5}
                      animate={{ type: 'timing', duration: 300 }}
                      curveType="linear"
                      connectMissingData={false}
                    />
                    {showPoints && overlayPoints.value.map((point: { x: number; y: number | null | undefined }, index: number) => {
                      if (point.x == null || point.y == null || point.y === undefined) return null;
                      return (
                        <Circle
                          key={`point-${sIdx + 1}-${index}`}
                          cx={point.x}
                          cy={point.y}
                          r={3}
                          color={seriesItem.color}
                        />
                      );
                    })}
                  </>
                )}
              </CartesianChart>
            </View>
          );
        })}
      </View>

      {/* X-Axis Label */}
      {xAxisLabel && (
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <Text style={{ fontSize: 10, color: theme.textSecondary }}>
            {xAxisLabel}
          </Text>
        </View>
      )}
    </View>
  );
}

/**
 * Specialized chart for sleep hours with dynamic Y-axis range
 */
export function SleepHoursChart({
  data,
  height = 220,
  color = '#8b5cf6',
}: {
  data: ChartDataPoint[];
  height?: number;
  color?: string;
}) {
  // Format decimal hours to HH:MM
  const formatHoursToHHMM = (hours: number): string => {
    const h = Math.floor(hours);
    return `${h}h`;
  };

  // Dynamic Y-axis: min-1 to max+1
  const values = data.filter((d) => d.value !== null).map((d) => d.value as number);
  const minVal = values.length > 0 ? Math.min(...values) : 5;
  const maxVal = values.length > 0 ? Math.max(...values) : 10;

  const series: ChartSeries[] = [{
    id: 'sleepHours',
    name: 'Sleep Hours',
    color,
    data,
  }];

  return (
    <MultiSeriesChart
      series={series}
      height={height}
      yAxisMin={Math.max(0, Math.floor(minVal - 1))}
      yAxisMax={Math.ceil(maxVal + 1)}
      yAxisLabel="Hours"
      formatYLabel={formatHoursToHHMM}
      showPoints={true}
    />
  );
}
