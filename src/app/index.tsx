import { View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, BarChart3, Settings, CheckCircle, Circle, TrendingUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { getTodayDateString } from '@/lib/utils/date-utils';
import { useAllEntries, useDailyEntry, useActiveUser } from '@/lib/state/data-layer';

export default function HomeScreen() {
  const router = useRouter();

  // Load data from centralized data layer
  const { data: activeUser } = useActiveUser();
  const { data: allEntries = [] } = useAllEntries();

  // Load today's entry to check if already saved
  const todayDate = getTodayDateString();
  const { data: todayEntry } = useDailyEntry(todayDate);

  // Calculate stats
  const totalDays = allEntries?.length ?? 0;
  const todaySaved = todayEntry !== null && todayEntry !== undefined;

  const handlePress = (route: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push(route as any);
  };

  return (
    <View className="flex-1">
      <LinearGradient
        colors={['#0f172a', '#1e293b', '#334155']}
        style={{ flex: 1 }}
      >
        <SafeAreaView className="flex-1 px-6">
          {/* Header */}
          <View className="pt-8 pb-6 items-center">
            <Text className="text-4xl font-bold text-white mb-2 text-center">
              {activeUser?.name ? `Hola, ${activeUser.name}` : 'Els meus hàbits'}
            </Text>
            <Text className="text-lg text-slate-300">El teu company personal</Text>
          </View>

          {/* Stats Cards */}
          <View className="flex-row gap-4 mb-6">
            {/* Total Days */}
            <View className="flex-1 bg-slate-800/50 rounded-2xl p-4">
              <Text className="text-slate-400 text-sm mb-1">Dies totals:</Text>
              <Text className="text-white text-2xl font-bold">{totalDays}</Text>
            </View>

            {/* Today Status */}
            <View className="flex-1 bg-slate-800/50 rounded-2xl p-4">
              <Text className="text-slate-400 text-sm mb-1">Avui</Text>
              <View className="flex-row items-center">
                {todaySaved ? (
                  <>
                    <CheckCircle size={20} color="#10b981" />
                    <Text className="text-emerald-400 text-lg font-semibold ml-2">Guardat!</Text>
                  </>
                ) : (
                  <>
                    <Circle size={20} color="#64748b" />
                    <Text className="text-slate-400 text-lg font-semibold ml-2">Not set</Text>
                  </>
                )}
              </View>
            </View>
          </View>

          {/* Main Navigation Buttons */}
          <View className="flex-1 justify-center gap-6">
            {/* Data Entry Button */}
            <Pressable
              onPress={() => handlePress('/data-entry')}
              className="active:opacity-80"
            >
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 24,
                  shadowColor: '#3b82f6',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center mr-4">
                    <Calendar size={28} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-white mb-1">Afegir dada</Text>
                    <Text className="text-sm text-white/80">Registra les teves activitats diàries</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Statistics Button */}
            <Pressable
              onPress={() => handlePress('/statistics')}
              className="active:opacity-80"
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 24,
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center mr-4">
                    <BarChart3 size={28} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-white mb-1">Estadístiques</Text>
                    <Text className="text-sm text-white/80">Veu el teu progrés i tendències</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Graphics Button */}
            <Pressable
              onPress={() => handlePress('/graphs')}
              className="active:opacity-80"
            >
              <LinearGradient
                colors={['#f59e0b', '#d97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 24,
                  shadowColor: '#f59e0b',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center mr-4">
                    <TrendingUp size={28} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-white mb-1">Gràfics</Text>
                    <Text className="text-sm text-white/80">Gràfics acumulats i estadístics</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Settings Button */}
            <Pressable
              onPress={() => handlePress('/settings')}
              className="active:opacity-80"
            >
              <LinearGradient
                colors={['#8b5cf6', '#7c3aed']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 20,
                  padding: 24,
                  shadowColor: '#8b5cf6',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8,
                }}
              >
                <View className="flex-row items-center">
                  <View className="w-14 h-14 bg-white/20 rounded-full items-center justify-center mr-4">
                    <Settings size={28} color="#ffffff" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-2xl font-bold text-white mb-1">Configuració</Text>
                    <Text className="text-sm text-white/80">Personalitza la teva experiència</Text>
                  </View>
                </View>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Footer */}
          <View className="pb-8 items-center">
            <Text className="text-slate-400 text-xs">100% Offline • Local Storage</Text>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </View>
  );
}
