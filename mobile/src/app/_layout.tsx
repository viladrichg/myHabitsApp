import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect, useRef, useState, startTransition } from 'react';
import * as Notifications from 'expo-notifications';
import { initializeDatabase, hasAnyUser, refreshActiveUserCache, getSettings } from '@/lib/database/db';
import { checkAndRunScheduledBackup } from '@/lib/utils/backup-scheduler';
import { useCustomVariablesStore } from '@/lib/state/custom-variables-store';
import { useColorSettingsStore } from '@/lib/state/color-settings-store';

export const unstable_settings = {
  initialRouteName: 'index',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav({ colorScheme, isFirstLaunch }: { colorScheme: 'light' | 'dark' | null | undefined; isFirstLaunch: boolean }) {
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack initialRouteName={isFirstLaunch ? 'welcome' : 'index'}>
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="data-entry" options={{ title: 'Afegir dada', headerBackTitle: 'Inici' }} />
        <Stack.Screen name="statistics" options={{ title: 'Estadístiques', headerBackTitle: 'Inici' }} />
        <Stack.Screen name="graphs" options={{ title: 'Gràfics', headerBackTitle: 'Inici' }} />
        <Stack.Screen name="graphs-fullscreen" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ title: 'Configuració', headerBackTitle: 'Inici' }} />
      </Stack>
    </ThemeProvider>
  );
}



// Helper function to schedule notifications
async function scheduleNotificationsOnLaunch() {
  try {
    const settings = await getSettings();
    if (!settings || !settings.notificationsEnabled) {
      return;
    }

    // Validate times before parsing
    const morningTime = settings.morningReminderTime;
    const eveningTime = settings.eveningReminderTime;
    if (!morningTime || !eveningTime) {
      return;
    }

    // Request permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    // Cancel existing and reschedule
    await Notifications.cancelAllScheduledNotificationsAsync();

    const morningParts = morningTime.split(':').map(Number);
    const eveningParts = eveningTime.split(':').map(Number);
    const mHour = morningParts[0] ?? 9;
    const mMin = morningParts[1] ?? 0;
    const eHour = eveningParts[0] ?? 23;
    const eMin = eveningParts[1] ?? 0;

    // Schedule morning notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Tracker',
        body: 'Good morning! Start your day by logging your activities.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: mHour,
        minute: mMin,
      },
    });

    // Schedule evening notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Tracker',
        body: "Don't forget to log today's activities before bed!",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: eHour,
        minute: eMin,
      },
    });

    console.log('Notifications scheduled successfully');
  } catch (error) {
    console.error('Failed to schedule notifications:', error);
  }
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [dbInitialized, setDbInitialized] = useState<boolean>(false);
  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean>(false);
  // Track whether the layout has been committed so we can safely hide splash
  const splashHiddenRef = useRef<boolean>(false);

  useEffect(() => {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);

  // Rehydrate Zustand persist stores manually after mount to avoid hydrating
  // during React's render/subscribe phase (which causes "Should not already be working")
  useEffect(() => {
    useCustomVariablesStore.persist.rehydrate();
    useColorSettingsStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    const initDB = async () => {
      try {
        await initializeDatabase();

        // Check if this is first launch (no user exists)
        const userExists = await hasAnyUser();

        // If user exists, refresh the active user cache and schedule notifications
        if (userExists) {
          await refreshActiveUserCache();
          // Re-schedule notifications on app launch to ensure they persist
          await scheduleNotificationsOnLaunch();
          // Non-blocking: trigger a scheduled backup if one is due.
          // checkAndRunScheduledBackup reads backup_frequency and last_backup_date
          // from the settings row and opens the share sheet only when overdue.
          checkAndRunScheduledBackup();
        }

        // Batch both state updates together to avoid multiple renders
        // Use startTransition to prevent "Should not already be working" in React 19
        // concurrent mode — the first big render (mounting all providers/screens) must
        // not be scheduled synchronously from a native/JSI callback context.
        startTransition(() => {
          setIsFirstLaunch(!userExists);
          setDbInitialized(true);
        });
      } catch (error) {
        console.error('Failed to initialize database:', error);
        // Still allow app to load even on error - fail safe
        startTransition(() => {
          setDbInitialized(true);
        });
      }
    };

    initDB();
  }, []);

  // Hide splash after DB is ready, using useEffect so it runs after commit.
  // Using useEffect (not onLayout) avoids needing useCallback and keeps timing correct.
  useEffect(() => {
    if (dbInitialized && !splashHiddenRef.current) {
      splashHiddenRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [dbInitialized]);

  // Always render the full provider tree so GestureHandler, KeyboardProvider, and
  // StatusBar mount on the FIRST render — before DB init completes. This prevents
  // the "Should not already be working" error caused by mounting all native-backed
  // providers simultaneously in a single React commit after setDbInitialized(true).
  // RootLayoutNav (the navigation stack) is the only thing deferred.
  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        {dbInitialized && (
          <RootLayoutNav colorScheme={colorScheme} isFirstLaunch={isFirstLaunch} />
        )}
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}