import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePreferences } from '@/features/preferences/preferences-context';
import { ThemeColors, useThemeStyles } from '@/theme/theme';

const FLOATING_BUTTON_SIZE = 56;
const FLOATING_BUTTON_BOTTOM = 18;
const TOAST_GAP = 12;

type ToastAction =
  | 'backup'
  | 'create'
  | 'delete'
  | 'edit'
  | 'move'
  | 'reminder'
  | 'repeat';

type ToastOptions = {
  actionLabel?: string;
  duration?: number;
  onAction?: () => void;
};

type ToastState = {
  action: ToastAction;
  actionLabel?: string;
  message: string;
  onAction?: () => void;
};

type ToastContextValue = {
  showToast: (
    message: string,
    action: ToastAction,
    options?: ToastOptions,
  ) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastActionIcon({ action }: { action: ToastAction }) {
  const styles = useThemeStyles(createStyles);
  if (action === 'create') {
    return (
      <View style={styles.iconFrame}>
        <View style={styles.createHorizontal} />
        <View style={styles.createVertical} />
      </View>
    );
  }

  if (action === 'edit') {
    return (
      <View style={styles.iconFrame}>
        <View style={styles.editPencil}>
          <View style={styles.editTip} />
        </View>
      </View>
    );
  }

  if (action === 'move') {
    return (
      <View style={styles.iconFrame}>
        <View style={styles.moveShaft} />
        <View style={styles.moveArrowTop} />
        <View style={styles.moveArrowBottom} />
      </View>
    );
  }

  if (action === 'repeat') {
    return (
      <View style={styles.iconFrame}>
        <View style={styles.repeatTopLine} />
        <View style={styles.repeatTopArrow} />
        <View style={styles.repeatBottomLine} />
        <View style={styles.repeatBottomArrow} />
      </View>
    );
  }

  if (action === 'reminder') {
    return (
      <View style={styles.iconFrame}>
        <View style={styles.reminderBell} />
        <View style={styles.reminderBase} />
      </View>
    );
  }

  if (action === 'backup') {
    return (
      <View style={styles.iconFrame}>
        <View style={styles.backupShaft} />
        <View style={styles.backupArrowLeft} />
        <View style={styles.backupArrowRight} />
        <View style={styles.backupTray} />
      </View>
    );
  }

  return (
    <View style={styles.iconFrame}>
      <View style={styles.deleteHandle} />
      <View style={styles.deleteLid} />
      <View style={styles.deleteBody} />
    </View>
  );
}

export function ToastProvider({ children }: PropsWithChildren) {
  const styles = useThemeStyles(createStyles);
  const insets = useSafeAreaInsets();
  const { preferences } = usePreferences();
  const [toastState, setToastState] = useState<ToastState | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(8));
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastIdRef = useRef(0);

  useEffect(
    () => () => {
      toastIdRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const showToast = useCallback(
    (message: string, action: ToastAction, options?: ToastOptions) => {
      toastIdRef.current += 1;
      const toastId = toastIdRef.current;

      if (timerRef.current) clearTimeout(timerRef.current);
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(0);
      translateY.setValue(8);
      setToastState({
        action,
        actionLabel: options?.actionLabel,
        message,
        onAction: options?.onAction,
      });

      Animated.parallel([
        Animated.timing(opacity, {
          duration: preferences.reducedMotion ? 0 : 160,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          duration: preferences.reducedMotion ? 0 : 160,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            duration: preferences.reducedMotion ? 0 : 150,
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            duration: preferences.reducedMotion ? 0 : 150,
            toValue: 5,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && toastIdRef.current === toastId) setToastState(null);
        });
      }, options?.duration ?? (options?.onAction ? 4000 : 2100));
    },
    [opacity, preferences.reducedMotion, translateY],
  );

  const runToastAction = (toast: ToastState) => {
    if (!toast.onAction) return;

    toastIdRef.current += 1;
    if (timerRef.current) clearTimeout(timerRef.current);
    toast.onAction();

    Animated.parallel([
      Animated.timing(opacity, {
        duration: preferences.reducedMotion ? 0 : 120,
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: preferences.reducedMotion ? 0 : 120,
        toValue: 4,
        useNativeDriver: true,
      }),
    ]).start(() => setToastState(null));
  };

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      <View style={styles.root}>
        {children}
        {toastState ? (
          <View
            pointerEvents="box-none"
            style={[
              styles.positioner,
              {
                bottom:
                  insets.bottom +
                  FLOATING_BUTTON_BOTTOM +
                  FLOATING_BUTTON_SIZE +
                  TOAST_GAP,
              },
            ]}
          >
            <Animated.View
              accessibilityLabel={toastState.message}
              accessibilityLiveRegion="polite"
              accessibilityRole="alert"
              accessible={!toastState.onAction}
              style={[styles.toast, { opacity, transform: [{ translateY }] }]}
            >
              <ToastActionIcon action={toastState.action} />
              <Text style={styles.message}>{toastState.message}</Text>
              {toastState.actionLabel && toastState.onAction ? (
                <Pressable
                  accessibilityLabel={toastState.actionLabel}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => runToastAction(toastState)}
                  style={({ pressed }) => [
                    styles.toastAction,
                    pressed && styles.actionPressed,
                  ]}
                >
                  <Text style={styles.toastActionText}>
                    {toastState.actionLabel}
                  </Text>
                </Pressable>
              ) : null}
            </Animated.View>
          </View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) throw new Error('useToast must be used inside ToastProvider');

  return context;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  root: {
    flex: 1,
  },
  positioner: {
    position: 'absolute',
    right: 20,
    left: 20,
    zIndex: 1000,
    alignItems: 'center',
  },
  toast: {
    minWidth: 140,
    maxWidth: 360,
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.toastBackground,
  },
  iconFrame: {
    width: 14,
    height: 14,
  },
  createHorizontal: {
    position: 'absolute',
    top: 6.25,
    right: 1,
    left: 1,
    height: 1.5,
    backgroundColor: colors.toastText,
  },
  createVertical: {
    position: 'absolute',
    top: 1,
    bottom: 1,
    left: 6.25,
    width: 1.5,
    backgroundColor: colors.toastText,
  },
  editPencil: {
    position: 'absolute',
    top: 5,
    left: 0,
    width: 11,
    height: 4,
    borderWidth: 1.25,
    borderColor: colors.toastText,
    transform: [{ rotate: '-45deg' }],
  },
  editTip: {
    position: 'absolute',
    top: -1.25,
    right: -3.75,
    width: 3.5,
    height: 4,
    borderTopWidth: 1.25,
    borderRightWidth: 1.25,
    borderBottomWidth: 1.25,
    borderColor: colors.toastText,
  },
  deleteHandle: {
    position: 'absolute',
    top: 0,
    left: 5,
    width: 4,
    height: 1.25,
    backgroundColor: colors.toastText,
  },
  deleteLid: {
    position: 'absolute',
    top: 2.5,
    left: 2,
    width: 10,
    height: 1.25,
    backgroundColor: colors.toastText,
  },
  deleteBody: {
    position: 'absolute',
    top: 5,
    left: 3,
    width: 8,
    height: 8,
    borderRightWidth: 1.25,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.toastText,
  },
  moveShaft: {
    position: 'absolute',
    top: 6.25,
    left: 1,
    width: 11,
    height: 1.5,
    backgroundColor: colors.toastText,
  },
  moveArrowTop: {
    position: 'absolute',
    top: 3,
    right: 1,
    width: 5,
    height: 1.5,
    backgroundColor: colors.toastText,
    transform: [{ rotate: '45deg' }],
  },
  moveArrowBottom: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.toastText,
    transform: [{ rotate: '-45deg' }],
  },
  repeatTopLine: {
    position: 'absolute',
    top: 3,
    left: 1,
    width: 10,
    height: 1.25,
    backgroundColor: colors.toastText,
  },
  repeatTopArrow: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 4,
    height: 4,
    borderTopWidth: 1.25,
    borderRightWidth: 1.25,
    borderColor: colors.toastText,
    transform: [{ rotate: '45deg' }],
  },
  repeatBottomLine: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 10,
    height: 1.25,
    backgroundColor: colors.toastText,
  },
  repeatBottomArrow: {
    position: 'absolute',
    bottom: 1,
    left: 1,
    width: 4,
    height: 4,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.toastText,
    transform: [{ rotate: '45deg' }],
  },
  reminderBell: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: 8,
    height: 9,
    borderTopWidth: 1.25,
    borderRightWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.toastText,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  reminderBase: {
    position: 'absolute',
    right: 2,
    bottom: 1,
    left: 2,
    height: 3,
    borderTopWidth: 1.25,
    borderBottomWidth: 1.25,
    borderColor: colors.toastText,
  },
  backupShaft: {
    position: 'absolute',
    top: 0,
    left: 6.25,
    width: 1.5,
    height: 8,
    backgroundColor: colors.toastText,
  },
  backupArrowLeft: {
    position: 'absolute',
    top: 5,
    left: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.toastText,
    transform: [{ rotate: '45deg' }],
  },
  backupArrowRight: {
    position: 'absolute',
    top: 5,
    right: 3,
    width: 5,
    height: 1.5,
    backgroundColor: colors.toastText,
    transform: [{ rotate: '-45deg' }],
  },
  backupTray: {
    position: 'absolute',
    right: 1,
    bottom: 0,
    left: 1,
    height: 4,
    borderRightWidth: 1.25,
    borderBottomWidth: 1.25,
    borderLeftWidth: 1.25,
    borderColor: colors.toastText,
  },
  message: {
    flexShrink: 1,
    color: colors.toastText,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    letterSpacing: -0.25,
  },
  toastAction: {
    minHeight: 24,
    justifyContent: 'center',
    marginLeft: 4,
    paddingLeft: 11,
    borderLeftWidth: 1,
    borderColor: colors.toastBorder,
  },
  toastActionText: {
    color: colors.toastText,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.35,
  },
  actionPressed: {
    opacity: 0.5,
  },
});
