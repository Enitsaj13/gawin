import { router } from 'expo-router';
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
import { ThemeColors, useThemeStyles } from '@/theme/theme';

type AppMenuSheetProps = {
  onClose: () => void;
  pastDateCount?: number;
};

export function AppMenuSheet({
  onClose,
  pastDateCount = 0,
}: AppMenuSheetProps) {
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const { preferences } = usePreferences();
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(32));
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: preferences.reducedMotion ? 0 : 170,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: preferences.reducedMotion ? 0 : 210,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, preferences.reducedMotion, translateY]);

  const dismiss = (destination?: '/defaults' | '/history' | '/settings') => {
    if (closingRef.current) return;
    closingRef.current = true;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: preferences.reducedMotion ? 0 : 140,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: preferences.reducedMotion ? 0 : 160,
        easing: Easing.in(Easing.cubic),
        toValue: 32,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (destination) router.push(destination);
    });
  };

  const navigate = (destination: '/defaults' | '/history' | '/settings') => {
    feedback.selection();
    dismiss(destination);
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
          accessibilityLabel="Close Gawin menu"
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
            <Text style={styles.eyebrow}>Gawin</Text>
            <Text style={styles.title}>More</Text>

            <View style={styles.actionList}>
              {pastDateCount ? (
                <Pressable
                  accessibilityLabel={`Open past tasks. ${pastDateCount} saved ${pastDateCount === 1 ? 'day' : 'days'}.`}
                  accessibilityRole="button"
                  onPress={() => navigate('/history')}
                  style={({ pressed }) => [
                    styles.actionRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <HistoryIcon />
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionText}>Past tasks</Text>
                    <Text style={styles.actionMeta}>
                      {pastDateCount}{' '}
                      {pastDateCount === 1 ? 'saved day' : 'saved days'}
                    </Text>
                  </View>
                  <Text style={styles.arrow}>→</Text>
                </Pressable>
              ) : null}

              <Pressable
                accessibilityLabel="Open daily defaults"
                accessibilityRole="button"
                onPress={() => navigate('/defaults')}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
              >
                <RepeatIcon />
                <View style={styles.actionCopy}>
                  <Text style={styles.actionText}>Daily defaults</Text>
                  <Text style={styles.actionMeta}>
                    Tasks that arrive fresh each morning
                  </Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </Pressable>

              <Pressable
                accessibilityLabel="Open settings"
                accessibilityRole="button"
                onPress={() => navigate('/settings')}
                style={({ pressed }) => [
                  styles.actionRow,
                  pressed && styles.pressed,
                ]}
              >
                <SettingsIcon />
                <View style={styles.actionCopy}>
                  <Text style={styles.actionText}>Settings</Text>
                  <Text style={styles.actionMeta}>
                    Preferences, backup, and app details
                  </Text>
                </View>
                <Text style={styles.arrow}>→</Text>
              </Pressable>
            </View>

            <Pressable
              accessibilityLabel="Close Gawin menu"
              accessibilityRole="button"
              onPress={() => dismiss()}
              style={({ pressed }) => [
                styles.cancel,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function HistoryIcon() {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.icon}>
      <View style={styles.historyPage} />
      <View style={[styles.historyLine, styles.historyLineTop]} />
      <View style={[styles.historyLine, styles.historyLineBottom]} />
    </View>
  );
}

function RepeatIcon() {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.icon}>
      <View style={styles.repeatTopLine} />
      <View style={styles.repeatTopArrow} />
      <View style={styles.repeatBottomLine} />
      <View style={styles.repeatBottomArrow} />
    </View>
  );
}

function SettingsIcon() {
  const styles = useThemeStyles(createStyles);
  return (
    <View style={styles.icon}>
      <View style={[styles.settingLine, styles.settingLineTop]} />
      <View style={[styles.settingKnob, styles.settingKnobTop]} />
      <View style={[styles.settingLine, styles.settingLineBottom]} />
      <View style={[styles.settingKnob, styles.settingKnobBottom]} />
    </View>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.scrim,
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderTopWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 5,
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 21,
    letterSpacing: -0.8,
  },
  actionList: {
    marginTop: 23,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  actionRow: {
    minHeight: 62,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  actionCopy: {
    minWidth: 0,
    flex: 1,
  },
  actionText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  actionMeta: {
    marginTop: 2,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
  },
  arrow: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 14,
  },
  icon: {
    width: 14,
    height: 14,
  },
  historyPage: {
    position: 'absolute',
    top: 1,
    right: 1,
    bottom: 1,
    left: 1,
    borderWidth: 1.2,
    borderColor: colors.textSecondary,
  },
  historyLine: {
    position: 'absolute',
    left: 4,
    height: 1.2,
    backgroundColor: colors.textSecondary,
  },
  historyLineTop: {
    top: 5,
    width: 6,
  },
  historyLineBottom: {
    top: 8,
    width: 4,
  },
  repeatTopLine: {
    position: 'absolute',
    top: 3,
    left: 1,
    width: 10,
    height: 1.25,
    backgroundColor: colors.textSecondary,
  },
  repeatTopArrow: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 4,
    height: 4,
    borderTopWidth: 1.25,
    borderRightWidth: 1.25,
    borderColor: colors.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
  repeatBottomLine: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 10,
    height: 1.25,
    backgroundColor: colors.textSecondary,
  },
  repeatBottomArrow: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    width: 4,
    height: 4,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.textSecondary,
    transform: [{ rotate: '45deg' }],
  },
  settingLine: {
    position: 'absolute',
    right: 1,
    left: 1,
    height: 1.25,
    backgroundColor: colors.textSecondary,
  },
  settingLineTop: {
    top: 4,
  },
  settingLineBottom: {
    bottom: 3,
  },
  settingKnob: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderWidth: 1.2,
    borderColor: colors.textSecondary,
    backgroundColor: colors.surface,
  },
  settingKnobTop: {
    top: 2.5,
    left: 3,
  },
  settingKnobBottom: {
    right: 3,
    bottom: 1.5,
  },
  cancel: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  cancelText: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  pressed: {
    opacity: 0.5,
  },
});
