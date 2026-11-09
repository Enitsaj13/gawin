import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { useToast } from '@/components/toast';
import { usePreferences } from '@/features/preferences/preferences-context';
import {
  BackupValidationError,
  parseTodoBackup,
  TodoBackup,
} from '@/features/todos/backup';
import { BackupImportSheet } from '@/features/todos/backup-import-sheet';
import {
  exportBackupFile,
  pickBackupFile,
} from '@/features/todos/backup-file';
import { useTodos } from '@/features/todos/todos-context';
import { todayKey } from '@/lib/date';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

const MAX_BACKUP_FILE_SIZE = 5 * 1024 * 1024;

type SelectedBackup = {
  backup: TodoBackup;
  fileName: string;
};

export default function BackupScreen() {
  const styles = useThemeStyles(createStyles);
  const { statusBarStyle } = useAppTheme();
  const [busyAction, setBusyAction] = useState<'export' | 'import' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [selectedBackup, setSelectedBackup] = useState<SelectedBackup | null>(
    null,
  );
  const { activeRepeatCount, createBackup, restoreBackup, todos } = useTodos();
  const { showToast } = useToast();
  const { backupDue, markBackupExported, preferences } = usePreferences();

  const exportBackup = async () => {
    if (busyAction) return;
    setBusyAction('export');
    setError(null);

    try {
      const backup = createBackup();
      const exported = await exportBackupFile(
        backup,
        `gawin-backup-${todayKey()}.json`,
      );
      if (exported) {
        markBackupExported();
        showToast('Backup exported', 'backup');
      }
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Unable to export your backup.'));
    } finally {
      setBusyAction(null);
    }
  };

  const chooseBackup = async () => {
    if (busyAction) return;
    setBusyAction('import');
    setError(null);

    try {
      const file = await pickBackupFile();
      if (!file) return;

      if (file.size && file.size > MAX_BACKUP_FILE_SIZE) {
        throw new BackupValidationError(
          'This backup is too large to import safely.',
        );
      }

      const backup = parseTodoBackup(file.content);
      setSelectedBackup({ backup, fileName: file.fileName });
    } catch (caughtError) {
      setError(getErrorMessage(caughtError, 'Unable to open this backup.'));
    } finally {
      setBusyAction(null);
    }
  };

  const closePreview = () => setSelectedBackup(null);

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
              router.canGoBack() ? router.back() : router.replace('/settings')
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <BackButton />
          </Pressable>
          <Text style={styles.headerTitle}>Backup & restore</Text>
          <Text style={styles.offlineLabel}>Offline</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Keep a copy.</Text>
          <Text style={styles.intro}>
            Export your tasks to a file you control. No account or internet
            connection is required.
          </Text>
          <Text style={[styles.backupStatus, backupDue && styles.backupDue]}>
            {preferences.lastBackupAt
              ? `Last backup: ${formatBackupDate(preferences.lastBackupAt)}`
              : backupDue
                ? 'No recent backup. A new copy is recommended.'
                : 'No backup created on this device yet.'}
          </Text>

          <View style={styles.deviceSummary}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{todos.length}</Text>
              <Text style={styles.summaryLabel}>
                {todos.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{activeRepeatCount}</Text>
              <Text style={styles.summaryLabel}>
                {activeRepeatCount === 1 ? 'routine' : 'routines'}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Export</Text>
            <Text style={styles.sectionTitle}>Create a backup file</Text>
            <Text style={styles.sectionBody}>
              {Platform.OS === 'web'
                ? 'Download a JSON copy you can keep in Files, Drive, or another private folder.'
                : 'Save it to Files, iCloud Drive, Google Drive, or send it with AirDrop.'}
            </Text>
            <Pressable
              accessibilityLabel="Export backup file"
              accessibilityRole="button"
              disabled={Boolean(busyAction)}
              onPress={exportBackup}
              style={({ pressed }) => [
                styles.primaryButton,
                busyAction && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ExportIcon />
              <Text style={styles.primaryButtonText}>
                {busyAction === 'export' ? 'Preparing…' : 'Export backup'}
              </Text>
            </Pressable>
          </View>

          <View style={styles.section}>
            <Text style={styles.eyebrow}>Import</Text>
            <Text style={styles.sectionTitle}>Restore from a file</Text>
            <Text style={styles.sectionBody}>
              The backup is checked and previewed before anything changes.
            </Text>
            <Pressable
              accessibilityLabel="Choose backup file to import"
              accessibilityRole="button"
              disabled={Boolean(busyAction)}
              onPress={chooseBackup}
              style={({ pressed }) => [
                styles.secondaryButton,
                busyAction && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <ImportIcon />
              <Text style={styles.secondaryButtonText}>
                {busyAction === 'import' ? 'Opening…' : 'Choose backup file'}
              </Text>
            </Pressable>
          </View>

          {error ? (
            <View accessibilityLiveRegion="polite" style={styles.errorPanel}>
              <Text style={styles.errorTitle}>Couldn’t complete that.</Text>
              <Text style={styles.errorBody}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.privacyNote}>
            Backup files are readable JSON. Keep them somewhere private because
            they contain your task titles.
          </Text>
        </ScrollView>
      </View>

      {selectedBackup ? (
        <BackupImportSheet
          backup={selectedBackup.backup}
          fileName={selectedBackup.fileName}
          onClose={closePreview}
          onMerge={() => restoreBackup(selectedBackup.backup, 'merge')}
          onReplace={() => restoreBackup(selectedBackup.backup, 'replace')}
        />
      ) : null}
    </SafeAreaView>
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatBackupDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function ExportIcon() {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.icon}>
      <View style={styles.exportShaft} />
      <View style={styles.exportArrowLeft} />
      <View style={styles.exportArrowRight} />
      <View style={styles.exportTray} />
    </View>
  );
}

function ImportIcon() {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.icon}>
      <View style={styles.importShaft} />
      <View style={styles.importArrowLeft} />
      <View style={styles.importArrowRight} />
      <View style={styles.importTray} />
    </View>
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
    fontSize: 20,
    letterSpacing: -1.1,
  },
  offlineLabel: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.45,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 42,
  },
  title: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 25,
    letterSpacing: -1.2,
  },
  intro: {
    maxWidth: 430,
    marginTop: 9,
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    lineHeight: 18,
  },
  backupStatus: {
    marginTop: 11,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  backupDue: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
  },
  deviceSummary: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 28,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  summaryValue: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 18,
  },
  summaryLabel: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  section: {
    marginTop: 32,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.55,
  },
  sectionTitle: {
    marginTop: 5,
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 15,
    letterSpacing: -0.45,
  },
  sectionBody: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    lineHeight: 16,
  },
  primaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 16,
    backgroundColor: colors.accent,
  },
  primaryButtonText: {
    color: colors.accentText,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  secondaryButton: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  secondaryButtonText: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  disabled: {
    opacity: 0.48,
  },
  pressed: {
    opacity: 0.55,
  },
  errorPanel: {
    marginTop: 26,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.accent,
  },
  errorTitle: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  errorBody: {
    marginTop: 4,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    lineHeight: 15,
  },
  privacyNote: {
    marginTop: 30,
    color: colors.textFaint,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    lineHeight: 15,
  },
  icon: {
    width: 14,
    height: 14,
  },
  exportShaft: {
    position: 'absolute',
    top: 4,
    left: 6.25,
    width: 1.5,
    height: 9,
    backgroundColor: colors.accentText,
  },
  exportArrowLeft: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.accentText,
    transform: [{ rotate: '-45deg' }],
  },
  exportArrowRight: {
    position: 'absolute',
    top: 2,
    right: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.accentText,
    transform: [{ rotate: '45deg' }],
  },
  exportTray: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    left: 1,
    height: 4,
    borderRightWidth: 1.25,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.accentText,
  },
  importShaft: {
    position: 'absolute',
    top: 0,
    left: 6.25,
    width: 1.5,
    height: 9,
    backgroundColor: colors.accent,
  },
  importArrowLeft: {
    position: 'absolute',
    top: 6,
    left: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.accent,
    transform: [{ rotate: '45deg' }],
  },
  importArrowRight: {
    position: 'absolute',
    top: 6,
    right: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.accent,
    transform: [{ rotate: '-45deg' }],
  },
  importTray: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    left: 1,
    height: 4,
    borderRightWidth: 1.25,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.accent,
  },
});
