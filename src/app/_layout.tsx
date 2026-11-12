import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
  useFonts,
} from '@expo-google-fonts/space-mono';
import { Stack, type SuspenseFallbackProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Appearance, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/toast';
import { AppLockProvider } from '@/features/app-lock/app-lock-context';
import { AppLockGate } from '@/features/app-lock/app-lock-gate';
import {
  PreferencesProvider,
  usePreferences,
} from '@/features/preferences/preferences-context';
import { LoadingScreen } from '@/features/todos/loading-screen';
import { NavigationSkeleton } from '@/features/todos/navigation-skeleton';
import { TodosProvider, useTodos } from '@/features/todos/todos-context';
import { useAppTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 220, fade: true });

function AppNavigator() {
  const { isReady } = useTodos();
  const { colors } = useAppTheme();
  const [launchFinished, setLaunchFinished] = useState(false);

  if (!launchFinished) {
    return (
      <LoadingScreen
        onFinished={() => setLaunchFinished(true)}
        ready={isReady}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </View>
  );
}

export function SuspenseFallback(_props: SuspenseFallbackProps) {
  return <DelayedNavigationSkeleton />;
}

function DelayedNavigationSkeleton() {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 120);
    return () => clearTimeout(timer);
  }, []);

  return visible ? (
    <NavigationSkeleton />
  ) : (
    <View style={{ flex: 1, backgroundColor: colors.background }} />
  );
}

function ThemedApp() {
  const { colors, isDark } = useAppTheme();
  const { preferences } = usePreferences();

  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(
      preferences.appearanceMode === 'system'
        ? 'auto'
        : preferences.appearanceMode,
    );
  }, [preferences.appearanceMode]);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
    document.documentElement.style.backgroundColor = colors.background;
    document.body.style.backgroundColor = colors.background;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', colors.background);
  }, [colors.background, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <AppLockGate>
        <ToastProvider>
          <TodosProvider>
            <AppNavigator />
          </TodosProvider>
        </ToastProvider>
      </AppLockGate>
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });
  const resourcesReady = fontsLoaded || Boolean(fontError);

  useEffect(() => {
    if (resourcesReady) SplashScreen.hide();
  }, [resourcesReady]);

  if (!resourcesReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PreferencesProvider>
        <AppLockProvider>
          <ThemedApp />
        </AppLockProvider>
      </PreferencesProvider>
    </GestureHandlerRootView>
  );
}
