import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  useFeedback,
  usePreferences,
} from '@/features/preferences/preferences-context';

import { TodoBackup } from './backup';

type BackupImportSheetProps = {
  backup: TodoBackup;
  fileName: string;
  onClose: () => void;
  onMerge: () => void;
  onReplace: () => void;
};

export function BackupImportSheet({
  backup,
  fileName,
  onClose,
  onMerge,
  onReplace,
}: BackupImportSheetProps) {
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const { preferences } = usePreferences();
  const [confirmingReplace, setConfirmingReplace] = useState(false);
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(36));
  const closingRef = useRef(false);
  const activeRepeatCount = backup.repeatRules.filter(
    (rule) => rule.active,
  ).length;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: preferences.reducedMotion ? 0 : 180,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: preferences.reducedMotion ? 0 : 220,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, preferences.reducedMotion, translateY]);

  const dismiss = (afterClose?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: preferences.reducedMotion ? 0 : 150,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: preferences.reducedMotion ? 0 : 170,
        easing: Easing.in(Easing.cubic),
        toValue: 36,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      afterClose?.();
    });
  };

  const reviewReplace = () => {
    feedback.warning();
    setConfirmingReplace(true);
  };

  return (
    <Modal
      animationType="none"
      onRequestClose={() => dismiss()}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <Animated.View
          pointerEvents="none"
          style={[styles.scrim, { opacity: backdropOpacity }]}
        />
        <Pressable
          accessibilityLabel="Close backup preview"
          accessibilityRole="button"
          onPress={() => dismiss()}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: Math.max(insets.bottom, 18),
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.content}>
            {confirmingReplace ? (
              <>
                <Text style={styles.eyebrow}>Replace local data</Text>
                <Text style={styles.title}>Replace everything?</Text>
                <Text style={styles.body}>
                  Your current tasks and routines will be replaced by this
                  backup. You can undo immediately after importing.
                </Text>

                <View style={styles.confirmActions}>
                  <Pressable
                    accessibilityLabel="Back to backup preview"
                    accessibilityRole="button"
                    onPress={() => setConfirmingReplace(false)}
                    style={({ pressed }) => [
                      styles.confirmCancel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel="Confirm replace all data"
                    accessibilityRole="button"
                    onPress={() => dismiss(onReplace)}
                    style={({ pressed }) => [
                      styles.confirmReplace,
                      pressed && styles.pressed,
                    ]}
                  >
                    <ReplaceIcon color="#ffffff" />
                    <Text style={styles.confirmReplaceText}>Replace</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.eyebrow}>Import backup</Text>
                <Text style={styles.title}>Review backup</Text>
                <Text numberOfLines={1} style={styles.fileName}>
                  {fileName}
                </Text>

                <View style={styles.summary}>
                  <View style={styles.summaryItem}>
                    <Text style={styles.summaryValue}>{backup.tasks.length}</Text>
                    <Text style={styles.summaryLabel}>
                      {backup.tasks.length === 1 ? 'task' : 'tasks'}
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

                <Text style={styles.exportedAt}>
                  Exported {formatExportDate(backup.exportedAt)}
                </Text>
                <Text style={styles.body}>
                  Merge adds missing items and keeps the tasks already on this
                  device. Replace removes current data first.
                </Text>

                <Pressable
                  accessibilityLabel="Merge imported backup"
                  accessibilityRole="button"
                  onPress={() => dismiss(onMerge)}
                  style={({ pressed }) => [
                    styles.mergeButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <MergeIcon color="#ffffff" />
                  <Text style={styles.mergeText}>Merge backup</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Replace all data from backup"
                  accessibilityRole="button"
                  onPress={reviewReplace}
                  style={({ pressed }) => [
                    styles.replaceButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <ReplaceIcon />
                  <Text style={styles.replaceText}>Replace all data</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Cancel backup import"
                  accessibilityRole="button"
                  onPress={() => dismiss()}
                  style={({ pressed }) => [
                    styles.cancelButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function formatExportDate(value: string) {
  return new Date(value).toLocaleString('en-US', {
    day: '2-digit',
    hour: 'numeric',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function MergeIcon({ color = '#242422' }: { color?: string }) {
  return (
    <View style={styles.icon}>
      <View style={[styles.mergeTop, { backgroundColor: color }]} />
      <View style={[styles.mergeBottom, { backgroundColor: color }]} />
      <View style={[styles.mergeStem, { backgroundColor: color }]} />
    </View>
  );
}

function ReplaceIcon({ color = '#242422' }: { color?: string }) {
  return (
    <View style={styles.icon}>
      <View style={[styles.replaceTop, { backgroundColor: color }]} />
      <View style={[styles.replaceTopArrow, { borderColor: color }]} />
      <View style={[styles.replaceBottom, { backgroundColor: color }]} />
      <View style={[styles.replaceBottomArrow, { borderColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#fbfbf9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  eyebrow: {
    color: '#74736e',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    marginTop: 5,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -0.9,
  },
  fileName: {
    marginTop: 10,
    color: '#777671',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  summary: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#c9c8c3',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#c9c8c3',
  },
  summaryValue: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 17,
  },
  summaryLabel: {
    marginTop: 2,
    color: '#85847f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  exportedAt: {
    marginTop: 14,
    color: '#74736e',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  body: {
    marginTop: 8,
    color: '#5e5d59',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    lineHeight: 16,
  },
  mergeButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 22,
    backgroundColor: '#111111',
  },
  mergeText: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  replaceButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#111111',
  },
  replaceText: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  cancelButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },
  cancelText: {
    color: '#6f6e69',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  confirmActions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 10,
  },
  confirmCancel: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#111111',
  },
  confirmReplace: {
    minHeight: 50,
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#111111',
  },
  confirmCancelText: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  confirmReplaceText: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.52,
  },
  icon: {
    width: 14,
    height: 14,
  },
  mergeTop: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 5,
    height: 1.25,
  },
  mergeBottom: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 5,
    height: 1.25,
  },
  mergeStem: {
    position: 'absolute',
    top: 2,
    left: 6.25,
    width: 1.5,
    height: 10,
    transform: [{ rotate: '-45deg' }],
  },
  replaceTop: {
    position: 'absolute',
    top: 3,
    left: 1,
    width: 10,
    height: 1.25,
  },
  replaceTopArrow: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 4,
    height: 4,
    borderTopWidth: 1.25,
    borderRightWidth: 1.25,
    transform: [{ rotate: '45deg' }],
  },
  replaceBottom: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 10,
    height: 1.25,
  },
  replaceBottomArrow: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    width: 4,
    height: 4,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    transform: [{ rotate: '45deg' }],
  },
});
