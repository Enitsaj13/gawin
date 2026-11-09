import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const PREFERENCES_STORAGE_KEY = 'gawin.preferences.v1';

export type BackupReminderDays = 0 | 7 | 14 | 30;

type Preferences = {
  backupReminderDays: BackupReminderDays;
  backupReminderStartedAt: string;
  hapticsEnabled: boolean;
  lastBackupAt: string | null;
  reducedMotion: boolean;
};

type PreferencesContextValue = {
  backupDue: boolean;
  preferences: Preferences;
  markBackupExported: () => void;
  setBackupReminderDays: (days: BackupReminderDays) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setReducedMotion: (enabled: boolean) => void;
};

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function defaultPreferences(): Preferences {
  return {
    backupReminderDays: 14,
    backupReminderStartedAt: new Date().toISOString(),
    hapticsEnabled: true,
    lastBackupAt: null,
    reducedMotion: false,
  };
}

function parsePreferences(value: string | null): Preferences {
  const defaults = defaultPreferences();
  if (!value) return defaults;

  try {
    const parsed = JSON.parse(value) as Partial<Preferences>;
    const backupReminderDays = [0, 7, 14, 30].includes(
      Number(parsed.backupReminderDays),
    )
      ? (Number(parsed.backupReminderDays) as BackupReminderDays)
      : defaults.backupReminderDays;

    return {
      backupReminderDays,
      backupReminderStartedAt:
        typeof parsed.backupReminderStartedAt === 'string' &&
        !Number.isNaN(Date.parse(parsed.backupReminderStartedAt))
          ? parsed.backupReminderStartedAt
          : defaults.backupReminderStartedAt,
      hapticsEnabled:
        typeof parsed.hapticsEnabled === 'boolean'
          ? parsed.hapticsEnabled
          : defaults.hapticsEnabled,
      lastBackupAt:
        typeof parsed.lastBackupAt === 'string' &&
        !Number.isNaN(Date.parse(parsed.lastBackupAt))
          ? parsed.lastBackupAt
          : null,
      reducedMotion:
        typeof parsed.reducedMotion === 'boolean'
          ? parsed.reducedMotion
          : defaults.reducedMotion,
    };
  } catch {
    return defaults;
  }
}

export function PreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [isReady, setIsReady] = useState(false);
  const [backupCheckTime, setBackupCheckTime] = useState(Date.now);

  useEffect(() => {
    let mounted = true;

    void AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)
      .then((stored) => {
        if (mounted) setPreferences(parsePreferences(stored));
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.setItem(
      PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    );
  }, [isReady, preferences]);

  useEffect(() => {
    const timer = setInterval(() => setBackupCheckTime(Date.now()), 60 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const updatePreference = useCallback(
    <Key extends keyof Preferences>(key: Key, value: Preferences[Key]) => {
      setPreferences((current) => ({ ...current, [key]: value }));
    },
    [],
  );

  const backupDue = useMemo(() => {
    if (!preferences.backupReminderDays) return false;

    const reference =
      preferences.lastBackupAt ?? preferences.backupReminderStartedAt;
    const elapsed = backupCheckTime - new Date(reference).getTime();
    return elapsed >= preferences.backupReminderDays * 24 * 60 * 60 * 1000;
  }, [backupCheckTime, preferences]);

  const value = useMemo<PreferencesContextValue>(
    () => ({
      backupDue,
      preferences,
      markBackupExported: () =>
        updatePreference('lastBackupAt', new Date().toISOString()),
      setBackupReminderDays: (days) =>
        updatePreference('backupReminderDays', days),
      setHapticsEnabled: (enabled) =>
        updatePreference('hapticsEnabled', enabled),
      setReducedMotion: (enabled) =>
        updatePreference('reducedMotion', enabled),
    }),
    [backupDue, preferences, updatePreference],
  );

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside PreferencesProvider');
  }
  return context;
}

export function useFeedback() {
  const { preferences } = usePreferences();
  const enabled = preferences.hapticsEnabled;

  return useMemo(
    () => ({
      impactLight: () => {
        if (!enabled) return;
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => undefined,
        );
      },
      selection: () => {
        if (!enabled) return;
        void Haptics.selectionAsync().catch(() => undefined);
      },
      warning: () => {
        if (!enabled) return;
        void Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Warning,
        ).catch(() => undefined);
      },
    }),
    [enabled],
  );
}
