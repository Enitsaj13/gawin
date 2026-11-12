import Constants from 'expo-constants';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { useToast } from '@/components/toast';
import { useAppLock } from '@/features/app-lock/app-lock-context';
import { BiometricIcon } from '@/features/app-lock/biometric-icon';
import { PinModal, PinMode } from '@/features/app-lock/pin-screen';
import {
  BackupReminderDays,
  useFeedback,
  usePreferences,
} from '@/features/preferences/preferences-context';
import { useTodos } from '@/features/todos/todos-context';
import {
  AppearanceMode,
  ThemeColors,
  useAppTheme,
  useThemeStyles,
} from '@/theme/theme';

const REMINDER_OPTIONS: { label: string; value: BackupReminderDays }[] = [
  { label: 'Every 7 days', value: 7 },
  { label: 'Every 14 days', value: 14 },
  { label: 'Every 30 days', value: 30 },
  { label: 'Never', value: 0 },
];

const APPEARANCE_OPTIONS: { label: string; value: AppearanceMode }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

export default function SettingsScreen() {
  const styles = useThemeStyles(createStyles);
  const { statusBarStyle } = useAppTheme();
  const feedback = useFeedback();
  const lock = useAppLock();
  const { showToast } = useToast();
  const [pinMode, setPinMode] = useState<Exclude<PinMode, 'unlock'> | null>(null);
  const [lockError, setLockError] = useState('');
  const { dailyDefaults } = useTodos();
  const {
    preferences,
    setAppearanceMode,
    setBackupReminderDays,
    setHapticsEnabled,
    setReducedMotion,
  } = usePreferences();

  const update = (action: () => void) => {
    feedback.selection();
    action();
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <BackButton />
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.offlineLabel}>On device</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.eyebrow}>Appearance</Text>
          <View accessibilityRole="radiogroup" style={styles.appearanceOptions}>
            {APPEARANCE_OPTIONS.map((option) => {
              const selected = preferences.appearanceMode === option.value;
              return (
                <Pressable
                  accessibilityLabel={`${option.label} appearance`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={option.value}
                  onPress={() => update(() => setAppearanceMode(option.value))}
                  style={({ pressed }) => [
                    styles.appearanceOption,
                    selected && styles.appearanceOptionSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <AppearanceIcon mode={option.value} selected={selected} />
                  <Text
                    style={[
                      styles.appearanceLabel,
                      selected && styles.appearanceLabelSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Daily routines</Text>
            <Pressable
              accessibilityLabel={`Manage daily defaults. ${dailyDefaults.length} saved.`}
              accessibilityRole="button"
              onPress={() => router.push('/defaults')}
              style={({ pressed }) => [
                styles.navigationRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>Daily defaults</Text>
                <Text style={styles.navigationBody}>
                  Tasks that arrive fresh in Today each morning.
                </Text>
              </View>
              <Text style={styles.navigationCount}>{dailyDefaults.length}</Text>
              <Text style={styles.navigationArrow}>→</Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Privacy</Text>
            <SettingToggle
              enabled={lock.enabled}
              label="App Lock"
              onPress={() => { feedback.selection(); setPinMode(lock.enabled ? 'disable' : 'setup'); }}
            />
            <Text style={styles.sectionBody}>
              {lock.enabled ? (lock.biometricEnabled ? 'Unlock with your PIN or your device.' : 'Your six-digit PIN is required when opening Gawin.') : 'Keep access private with a six-digit PIN. Works offline.'}
            </Text>
            {lock.enabled ? <>
              <SettingToggle
                enabled={lock.biometricEnabled}
                disabled={!lock.biometricEnabled && !lock.deviceCapability?.supported}
                label={lock.deviceCapability?.label ?? 'Device unlock'}
                icon={<BiometricIcon kind={lock.deviceCapability?.icon ?? 'device'} size={18} />}
                onPress={() => { feedback.selection(); setPinMode(lock.biometricEnabled ? 'biometric-disable' : 'biometric-enable'); }}
              />
              <Text style={styles.sectionBody}>{lock.deviceCapability?.description ?? 'Checking device support…'}</Text>
              <Pressable accessibilityRole="button" onPress={() => setPinMode('change')} style={({ pressed }) => [styles.navigationRow, pressed && styles.pressed]}>
                <Text style={styles.navigationTitle}>Change PIN</Text>
                <Text style={styles.navigationArrow}>→</Text>
              </Pressable>
              <Text style={styles.subsectionTitle}>Lock after leaving</Text>
              <View style={styles.optionList}>
                {([{ label: 'Immediately', value: 0 }, { label: 'After 30 seconds', value: 30 }] as const).map((option) => (
                  <Pressable accessibilityRole="radio" accessibilityState={{ checked: lock.delay === option.value }} key={option.value} onPress={() => {
                    feedback.selection();
                    setLockError('');
                    void lock.setDelay(option.value).catch(() => setLockError('Could not save that setting. Please try again.'));
                  }} style={({ pressed }) => [styles.optionRow, pressed && styles.pressed]}>
                    <Text style={styles.optionText}>{option.label}</Text>
                    <View style={[styles.radio, lock.delay === option.value && styles.radioSelected]}>{lock.delay === option.value ? <View style={styles.radioDot} /> : null}</View>
                  </Pressable>
                ))}
              </View>
              <Pressable accessibilityRole="button" onPress={lock.lockNow} style={({ pressed }) => [styles.navigationRow, pressed && styles.pressed]}>
                <Text style={styles.navigationTitle}>Lock now</Text>
                <Text style={styles.navigationArrow}>→</Text>
              </Pressable>
              {lockError ? <Text accessibilityLiveRegion="polite" style={styles.sectionBody}>{lockError}</Text> : null}
            </> : null}
            <Text style={styles.sectionBody}>App Lock protects access in Gawin. Exported backups remain readable and do not include your PIN or recovery code.</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Interaction</Text>
            <SettingToggle
              enabled={preferences.hapticsEnabled}
              label="Haptic feedback"
              onPress={() =>
                update(() => setHapticsEnabled(!preferences.hapticsEnabled))
              }
            />
            <SettingToggle
              enabled={preferences.reducedMotion}
              label="Reduce motion"
              onPress={() =>
                update(() => setReducedMotion(!preferences.reducedMotion))
              }
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Backup & data</Text>
            <Pressable
              accessibilityLabel="Open backup and restore"
              accessibilityRole="button"
              onPress={() => router.push('/backup')}
              style={({ pressed }) => [
                styles.navigationRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.navigationCopy}>
                <Text style={styles.navigationTitle}>Backup & restore</Text>
                <Text style={styles.navigationBody}>
                  {preferences.lastBackupAt
                    ? `Last backup ${formatSettingsDate(preferences.lastBackupAt)}`
                    : 'No backup created on this device yet.'}
                </Text>
              </View>
              <Text style={styles.navigationArrow}>→</Text>
            </Pressable>
            <Text style={styles.subsectionTitle}>Remind me to back up</Text>
            <Text style={styles.sectionBody}>
              Gawin only reminds you. It never creates or uploads a backup
              without your action.
            </Text>
            <View style={styles.optionList}>
              {REMINDER_OPTIONS.map((option) => {
                const selected =
                  preferences.backupReminderDays === option.value;
                return (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    key={option.value}
                    onPress={() =>
                      update(() => setBackupReminderDays(option.value))
                    }
                    style={({ pressed }) => [
                      styles.optionRow,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.optionText}>{option.label}</Text>
                    <View style={[styles.radio, selected && styles.radioSelected]}>
                      {selected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Task reminders</Text>
            <Text style={styles.sectionBody}>
              {Platform.OS === 'web'
                ? 'Web reminders work while Gawin is open. A future native installation can alert you while the app is closed.'
                : 'Reminders are scheduled locally on this device. Gawin does not send task titles to a server.'}
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>About</Text>
            <View style={styles.aboutList}>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Storage</Text>
                <Text style={styles.aboutValue}>Offline · On device</Text>
              </View>
              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>Version</Text>
                <Text style={styles.aboutValue}>
                  {Constants.expoConfig?.version ?? '1.0.0'}
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
      {pinMode ? <PinModal
        key={pinMode}
        mode={pinMode}
        onClose={() => setPinMode(null)}
        onDone={() => {
          showToast(pinMode === 'setup' ? 'App Lock enabled' : pinMode === 'disable' ? 'App Lock turned off' : pinMode === 'biometric-enable' ? 'Device unlock enabled' : pinMode === 'biometric-disable' ? 'Device unlock turned off' : 'PIN changed', 'edit');
          setPinMode(null);
        }}
      /> : null}
    </SafeAreaView>
  );
}

function formatSettingsDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SettingToggle({
  enabled,
  label,
  onPress,
  icon,
  disabled = false,
}: {
  enabled: boolean;
  label: string;
  onPress: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}) {
  const styles = useThemeStyles(createStyles);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        disabled && styles.disabledSetting,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.settingLabelGroup}>{icon}<Text style={styles.settingText}>{label}</Text></View>
      <View style={[styles.toggle, enabled && styles.toggleEnabled]}>
        <View style={[styles.toggleKnob, enabled && styles.toggleKnobEnabled]} />
      </View>
    </Pressable>
  );
}

function AppearanceIcon({
  mode,
  selected,
}: {
  mode: AppearanceMode;
  selected: boolean;
}) {
  const styles = useThemeStyles(createStyles);
  if (mode === 'system') {
    return (
      <View
        style={[
          styles.systemIcon,
          selected && styles.appearanceIconSelected,
        ]}
      >
        <View
          style={[
            styles.systemIconHalf,
            selected && styles.systemIconHalfSelected,
          ]}
        />
      </View>
    );
  }

  if (mode === 'light') {
    return (
      <View style={styles.sunIcon}>
        <View style={[styles.sunRayVertical, selected && styles.sunRaySelected]} />
        <View style={[styles.sunRayHorizontal, selected && styles.sunRaySelected]} />
        <View
          style={[
            styles.sunCore,
            selected && styles.appearanceIconSelected,
            selected && styles.sunCoreSelected,
          ]}
        />
      </View>
    );
  }

  return (
    <Text
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[
        styles.moonGlyph,
        selected && styles.moonGlyphSelected,
      ]}
    >
      ☾
    </Text>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
    backgroundColor: colors.background,
  },
  header: {
    minHeight: 115,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 23,
    paddingTop: 23,
  },
  backButton: {
    width: 32,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -1.25,
  },
  offlineLabel: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  content: {
    paddingHorizontal: 24,
    paddingBottom: 42,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
    letterSpacing: 0.45,
    textTransform: 'uppercase',
  },
  settingRow: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  settingLabelGroup: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  disabledSetting: { opacity: 0.5 },
  settingText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  toggle: {
    width: 38,
    height: 22,
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  toggleEnabled: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  toggleKnob: {
    width: 14,
    height: 14,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  toggleKnobEnabled: {
    alignSelf: 'flex-end',
    borderColor: colors.accentText,
    backgroundColor: colors.accentText,
  },
  section: {
    marginTop: 36,
  },
  navigationRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  navigationCopy: {
    minWidth: 0,
    flex: 1,
  },
  navigationTitle: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  navigationBody: {
    marginTop: 3,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
  },
  navigationCount: {
    minWidth: 22,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textAlign: 'center',
  },
  navigationArrow: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
  },
  sectionBody: {
    marginTop: 8,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    lineHeight: 16,
  },
  subsectionTitle: {
    marginTop: 22,
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  optionList: {
    marginTop: 14,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  optionRow: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  optionText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  radio: {
    width: 15,
    height: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  radioSelected: {
    borderColor: colors.accent,
  },
  radioDot: {
    width: 7,
    height: 7,
    backgroundColor: colors.accent,
  },
  aboutList: {
    marginTop: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  aboutRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  aboutLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  aboutValue: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  pressed: {
    opacity: 0.5,
  },
  appearanceOptions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  appearanceOption: {
    minHeight: 58,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: colors.border,
  },
  appearanceOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  appearanceLabel: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  appearanceLabelSelected: {
    color: colors.accentText,
  },
  appearanceIconSelected: {
    borderColor: colors.accentText,
  },
  systemIcon: {
    width: 14,
    height: 14,
    overflow: 'hidden',
    borderWidth: 1.2,
    borderColor: colors.textSecondary,
  },
  systemIconHalf: {
    width: 6,
    height: 12,
    backgroundColor: colors.textSecondary,
  },
  systemIconHalfSelected: {
    backgroundColor: colors.accentText,
  },
  sunIcon: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sunCore: {
    width: 7,
    height: 7,
    borderWidth: 1.2,
    borderColor: colors.textSecondary,
    backgroundColor: colors.background,
  },
  sunCoreSelected: {
    backgroundColor: colors.accent,
  },
  sunRayVertical: {
    position: 'absolute',
    width: 1.2,
    height: 16,
    backgroundColor: colors.textSecondary,
  },
  sunRayHorizontal: {
    position: 'absolute',
    width: 16,
    height: 1.2,
    backgroundColor: colors.textSecondary,
  },
  sunRaySelected: {
    backgroundColor: colors.accentText,
  },
  moonGlyph: {
    width: 18,
    height: 18,
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 19,
    lineHeight: 19,
    textAlign: 'center',
  },
  moonGlyphSelected: {
    color: colors.accentText,
  },
});
