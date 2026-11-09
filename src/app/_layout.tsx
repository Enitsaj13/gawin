import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
  useFonts,
} from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Appearance, Platform, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/toast';
import {
  PreferencesProvider,
  usePreferences,
} from '@/features/preferences/preferences-context';
import { LoadingScreen } from '@/features/todos/loading-screen';
import { TodosProvider, useTodos } from '@/features/todos/todos-context';
import { useAppTheme } from '@/theme/theme';

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 220, fade: true });

function AppNavigator() {
  const { isReady } = useTodos();
  const [launchFinished, setLaunchFinished] = useState(false);

  if (!launchFinished) {
    return (
      <LoadingScreen
        onFinished={() => setLaunchFinished(true)}
        ready={isReady}
      />
    );
  }

  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
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
    document.documentElement.style.backgroundColor = colors.background;
    document.body.style.backgroundColor = colors.background;
  }, [colors.background, isDark]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ToastProvider>
        <TodosProvider>
          <AppNavigator />
        </TodosProvider>
      </ToastProvider>
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
        <ThemedApp />
      </PreferencesProvider>
    </GestureHandlerRootView>
  );
}
