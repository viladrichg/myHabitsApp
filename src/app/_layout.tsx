import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/lib/useColorScheme';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';
import { initializeDatabase, hasAnyUser, refreshActiveUserCache, getSettings } from '@/lib/database/db';

// Configure notifications handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

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

    // Request permissions
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      return;
    }

    // Cancel existing and reschedule
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [mHour, mMin] = settings.morningReminderTime.split(':').map(Number);
    const [eHour, eMin] = settings.eveningReminderTime.split(':').map(Number);

    // Schedule morning notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Tracker',
        body: 'Good morning! Start your day by logging your activities.',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: mHour,
        minute: mMin,
        repeats: true,
      },
    });

    // Schedule evening notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Daily Tracker',
        body: "Don't forget to log today's activities before bed!",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
        hour: eHour,
        minute: eMin,
        repeats: true,
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

  // 👉 REGISTRE DEL SERVICE WORKER (SEPARAT)
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((err) => {
        console.log("Service worker registration failed:", err);
      });
    }
  }, []);

  // 👉 INITIALITZACIÓ DE LA BASE DE DADES (SEPARAT)
  useEffect(() => {
    const initDB = async () => {
      try {
        await initializeDatabase();

        const userExists = await hasAnyUser();
        setIsFirstLaunch(!userExists);

        if (userExists) {
          await refreshActiveUserCache();
          await scheduleNotificationsOnLaunch();
        }

        setDbInitialized(true);
        await SplashScreen.hideAsync();
      } catch (error) {
        console.error("Failed to initialize database:", error);
        setDbInitialized(true);
        await SplashScreen.hideAsync();
      }
    };

    initDB();
  }, []);

  if (!dbInitialized) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <KeyboardProvider>
          <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
          <RootLayoutNav colorScheme={colorScheme} isFirstLaunch={isFirstLaunch} />
        </KeyboardProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  );
}
