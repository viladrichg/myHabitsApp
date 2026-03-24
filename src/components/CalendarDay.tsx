import { View, Text, Pressable } from 'react-native';
import { cn } from '@/lib/cn';
import { DailyEntry } from '@/lib/database/types';
import { getDayColor, getFilterDots, FilterOption } from '@/lib/utils/calendar-utils';
import * as Haptics from 'expo-haptics';

interface CalendarDayProps {
  date: string;
  entry: DailyEntry | null;
  isToday: boolean;
  isCurrentMonth: boolean;
  onPress: (date: string) => void;
  activeFilters: FilterOption[];
}

export function CalendarDay({
  date,
  entry,
  isToday,
  isCurrentMonth,
  onPress,
  activeFilters,
}: CalendarDayProps) {
  const dayNumber = parseInt(date.split('-')[2], 10);
  const dayColor = getDayColor(entry);
  const dots = activeFilters.length > 0 ? getFilterDots(entry, activeFilters) : [];

  const getBackgroundColor = () => {
    if (!isCurrentMonth) return 'bg-transparent';
    if (dots.length > 0) return 'bg-slate-100'; // Neutral when filtering
    if (!entry) return 'bg-slate-100';

    switch (dayColor) {
      case 'red':
        return 'bg-red-500';
      case 'green':
        return 'bg-green-500';
      case 'yellow':
        return 'bg-yellow-400';
      default:
        return 'bg-slate-200';
    }
  };

  const getTextColor = () => {
    if (!isCurrentMonth) return 'text-slate-300';
    if (dots.length > 0) return 'text-slate-700';
    if (!entry) return 'text-slate-500';

    switch (dayColor) {
      case 'red':
      case 'green':
        return 'text-white';
      case 'yellow':
        return 'text-slate-800';
      default:
        return 'text-slate-700';
    }
  };

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress(date);
      }}
      className={cn(
        'aspect-square items-center justify-center rounded-lg m-0.5',
        getBackgroundColor(),
        isToday && 'border-2 border-blue-500'
      )}
    >
      <Text className={cn('text-sm font-medium', getTextColor())}>{dayNumber}</Text>

      {/* Sleep quality indicator - small number */}
      {entry?.sleepQuality && (
        <Text className="text-[8px] text-slate-500 mt-0.5">{entry.sleepQuality}</Text>
      )}

      {/* Filter dots */}
      {dots.length > 0 && (
        <View className="flex-row gap-0.5 mt-0.5">
          {dots.slice(0, 3).map((color, index) => (
            <View
              key={index}
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: color }}
            />
          ))}
        </View>
      )}
    </Pressable>
  );
}
