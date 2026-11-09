import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { usePreferences } from '@/features/preferences/preferences-context';

export type AppearanceMode = 'dark' | 'light' | 'system';

export type ThemeColors = {
  accent: string;
  accentText: string;
  background: string;
  border: string;
  borderStrong: string;
  disabled: string;
  shadow: string;
  scrim: string;
  surface: string;
  surfacePressed: string;
  text: string;
  textFaint: string;
  textMuted: string;
  textSecondary: string;
  toastBackground: string;
  toastBorder: string;
  toastText: string;
};

const lightColors: ThemeColors = {
  accent: '#111111',
  accentText: '#ffffff',
  background: '#fbfbf9',
  border: '#d0cfca',
  borderStrong: '#777772',
  disabled: '#aaa9a5',
  shadow: '#111111',
  scrim: 'rgba(0, 0, 0, 0.42)',
  surface: '#fbfbf9',
  surfacePressed: '#f1f1ee',
  text: '#111111',
  textFaint: '#aaa9a3',
  textMuted: '#85847f',
  textSecondary: '#3c3c39',
  toastBackground: '#111111',
  toastBorder: '#5c5c59',
  toastText: '#ffffff',
};

const darkColors: ThemeColors = {
  accent: '#efefe9',
  accentText: '#121211',
  background: '#121211',
  border: '#393936',
  borderStrong: '#77766f',
  disabled: '#55544f',
  shadow: '#000000',
  scrim: 'rgba(0, 0, 0, 0.68)',
  surface: '#181817',
  surfacePressed: '#272724',
  text: '#f1f1eb',
  textFaint: '#686761',
  textMuted: '#92918a',
  textSecondary: '#c6c5bd',
  toastBackground: '#efefe9',
  toastBorder: '#b7b6af',
  toastText: '#121211',
};

export function useAppTheme() {
  const systemScheme = useColorScheme();
  const { preferences } = usePreferences();
  const isDark =
    preferences.appearanceMode === 'dark' ||
    (preferences.appearanceMode === 'system' && systemScheme === 'dark');

  return useMemo(
    () => ({
      colors: isDark ? darkColors : lightColors,
      isDark,
      statusBarStyle: isDark ? ('light' as const) : ('dark' as const),
    }),
    [isDark],
  );
}

export function useThemeStyles<Styles>(
  factory: (colors: ThemeColors) => Styles,
) {
  const { colors } = useAppTheme();
  return useMemo(() => factory(colors), [colors, factory]);
}
