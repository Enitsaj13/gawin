import {
  SpaceMono_400Regular,
  SpaceMono_700Bold,
  useFonts,
} from '@expo-google-fonts/space-mono';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { ToastProvider } from '@/components/toast';
import { LoadingScreen } from '@/features/todos/loading-screen';
import { TodosProvider, useTodos } from '@/features/todos/todos-context';

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
      <ToastProvider>
        <TodosProvider>
          <AppNavigator />
        </TodosProvider>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
