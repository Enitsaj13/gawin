import * as Haptics from 'expo-haptics';
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

type SheetMode = 'actions' | 'delete' | 'repeat';

type TaskActionsSheetProps = {
  initialMode?: SheetMode;
  isRepeating?: boolean;
  taskTitle: string;
  onClose: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onMoveToToday?: () => void;
  onRepeatDaily?: () => void;
  onRepeatTomorrow?: () => void;
  onStopRepeating?: () => void;
};

export function TaskActionsSheet({
  initialMode = 'actions',
  isRepeating = false,
  taskTitle,
  onClose,
  onDelete,
  onEdit,
  onMoveToToday,
  onRepeatDaily,
  onRepeatTomorrow,
  onStopRepeating,
}: TaskActionsSheetProps) {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<SheetMode>(initialMode);
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(36));
  const closingRef = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: 180,
        easing: Easing.out(Easing.quad),
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 220,
        easing: Easing.out(Easing.cubic),
        toValue: 0,
        useNativeDriver: true,
      }),
    ]).start();
  }, [backdropOpacity, translateY]);

  const dismiss = (afterClose?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        duration: 150,
        easing: Easing.in(Easing.quad),
        toValue: 0,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        duration: 170,
        easing: Easing.in(Easing.cubic),
        toValue: 36,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      afterClose?.();
    });
  };

  const showDeleteConfirmation = () => {
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Warning,
    ).catch(() => undefined);
    setMode('delete');
  };

  const showRepeatOptions = () => {
    void Haptics.selectionAsync().catch(() => undefined);
    setMode('repeat');
  };

  const editTask = () => dismiss(onEdit);
  const deleteTask = () => dismiss(onDelete);
  const moveToToday = () => dismiss(onMoveToToday);
  const repeatDaily = () => dismiss(onRepeatDaily);
  const repeatTomorrow = () => dismiss(onRepeatTomorrow);
  const stopRepeating = () => dismiss(onStopRepeating);
  const cancelDelete = () => {
    if (initialMode === 'delete') {
      dismiss();
      return;
    }

    setMode('actions');
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
          accessibilityLabel="Close task actions"
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
          <View style={styles.sheetContent}>
            {mode === 'actions' ? (
              <>
                <Text style={styles.eyebrow}>Task actions</Text>
                <Text numberOfLines={2} style={styles.taskTitle}>
                  {taskTitle}
                </Text>

                <View style={styles.actionList}>
                  {onEdit ? (
                    <Pressable
                      accessibilityLabel={`Edit task: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={editTask}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <PencilIcon />
                      <Text style={styles.actionText}>Edit task</Text>
                    </Pressable>
                  ) : null}

                  {onMoveToToday ? (
                    <Pressable
                      accessibilityLabel={`Move task to today: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={moveToToday}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <MoveIcon />
                      <Text style={styles.actionText}>Move to Today</Text>
                    </Pressable>
                  ) : null}

                  {onRepeatDaily || onRepeatTomorrow || onStopRepeating ? (
                    <Pressable
                      accessibilityLabel={`Repeat options for: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={showRepeatOptions}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <RepeatIcon />
                      <Text style={styles.actionText}>
                        {isRepeating ? 'Repeats daily' : 'Repeat task'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {onDelete ? (
                    <Pressable
                      accessibilityLabel={`Delete task: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={showDeleteConfirmation}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <TrashIcon />
                      <Text style={styles.actionText}>Delete task</Text>
                    </Pressable>
                  ) : null}
                </View>

                <Pressable
                  accessibilityLabel="Close task actions"
                  accessibilityRole="button"
                  onPress={() => dismiss()}
                  style={({ pressed }) => [
                    styles.cancelRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
              </>
            ) : mode === 'repeat' ? (
              <>
                <Text style={styles.eyebrow}>Repeat task</Text>
                <Text numberOfLines={2} style={styles.taskTitle}>
                  {taskTitle}
                </Text>

                <View style={styles.actionList}>
                  {isRepeating ? (
                    <Pressable
                      accessibilityLabel={`Stop repeating task: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={stopRepeating}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <RepeatIcon />
                      <Text style={styles.actionText}>Stop daily repeat</Text>
                    </Pressable>
                  ) : (
                    <>
                      {onRepeatTomorrow ? (
                        <Pressable
                          accessibilityLabel={`Repeat task tomorrow: ${taskTitle}`}
                          accessibilityRole="button"
                          onPress={repeatTomorrow}
                          style={({ pressed }) => [
                            styles.actionRow,
                            pressed && styles.pressed,
                          ]}
                        >
                          <MoveIcon />
                          <Text style={styles.actionText}>Repeat tomorrow</Text>
                        </Pressable>
                      ) : null}
                      {onRepeatDaily ? (
                        <Pressable
                          accessibilityLabel={`Repeat task daily: ${taskTitle}`}
                          accessibilityRole="button"
                          onPress={repeatDaily}
                          style={({ pressed }) => [
                            styles.actionRow,
                            pressed && styles.pressed,
                          ]}
                        >
                          <RepeatIcon />
                          <Text style={styles.actionText}>Repeat daily</Text>
                        </Pressable>
                      ) : null}
                    </>
                  )}
                </View>

                <Pressable
                  accessibilityLabel="Back to task actions"
                  accessibilityRole="button"
                  onPress={() => setMode('actions')}
                  style={({ pressed }) => [
                    styles.cancelRow,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.cancelText}>Back</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.eyebrow}>Delete task</Text>
                <Text style={styles.confirmTitle}>Delete this task?</Text>
                <Text numberOfLines={2} style={styles.confirmTaskTitle}>
                  {taskTitle}
                </Text>
                <Text style={styles.confirmBody}>
                  You can undo this for a few seconds.
                </Text>

                <View style={styles.confirmActions}>
                  <Pressable
                    accessibilityLabel="Cancel delete"
                    accessibilityRole="button"
                    onPress={cancelDelete}
                    style={({ pressed }) => [
                      styles.confirmCancel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.confirmCancelText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Confirm delete task: ${taskTitle}`}
                    accessibilityRole="button"
                    onPress={deleteTask}
                    style={({ pressed }) => [
                      styles.confirmDelete,
                      pressed && styles.pressed,
                    ]}
                  >
                    <TrashIcon color="#ffffff" />
                    <Text style={styles.confirmDeleteText}>Delete</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PencilIcon({ color = '#242422' }: { color?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.icon}
    >
      <View style={[styles.pencilBody, { borderColor: color }]} />
      <View style={[styles.pencilTip, { borderColor: color }]} />
    </View>
  );
}

function TrashIcon({ color = '#242422' }: { color?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.icon}
    >
      <View style={[styles.trashHandle, { borderColor: color }]} />
      <View style={[styles.trashLid, { backgroundColor: color }]} />
      <View style={[styles.trashBin, { borderColor: color }]}>
        <View style={[styles.trashLine, { backgroundColor: color }]} />
        <View style={[styles.trashLine, { backgroundColor: color }]} />
      </View>
    </View>
  );
}

function MoveIcon({ color = '#242422' }: { color?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.icon}
    >
      <View style={[styles.moveShaft, { backgroundColor: color }]} />
      <View style={[styles.moveArrowTop, { backgroundColor: color }]} />
      <View style={[styles.moveArrowBottom, { backgroundColor: color }]} />
    </View>
  );
}

function RepeatIcon({ color = '#242422' }: { color?: string }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.icon}
    >
      <View style={[styles.repeatTopLine, { backgroundColor: color }]} />
      <View style={[styles.repeatTopArrow, { borderColor: color }]} />
      <View style={[styles.repeatBottomLine, { backgroundColor: color }]} />
      <View style={[styles.repeatBottomArrow, { borderColor: color }]} />
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
  sheetContent: {
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
  taskTitle: {
    marginTop: 5,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.75,
  },
  actionList: {
    marginTop: 24,
    borderTopWidth: 1,
    borderColor: '#c9c8c3',
  },
  actionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: '#c9c8c3',
  },
  actionText: {
    color: '#242422',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  cancelRow: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#111111',
  },
  cancelText: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  confirmTitle: {
    marginTop: 5,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -0.9,
  },
  confirmTaskTitle: {
    marginTop: 18,
    color: '#3f3f3c',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  confirmBody: {
    marginTop: 6,
    color: '#85847f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
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
  confirmDelete: {
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
  confirmDeleteText: {
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
  pencilBody: {
    position: 'absolute',
    top: 5,
    left: 1,
    width: 11,
    height: 4,
    borderWidth: 1.2,
    transform: [{ rotate: '-45deg' }],
  },
  pencilTip: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 4,
    height: 4,
    borderRightWidth: 1.2,
    borderBottomWidth: 1.2,
  },
  trashHandle: {
    position: 'absolute',
    top: 0,
    left: 5,
    width: 4,
    height: 3,
    borderWidth: 1.2,
    borderBottomWidth: 0,
  },
  trashLid: {
    position: 'absolute',
    top: 3,
    left: 1,
    width: 12,
    height: 1.2,
  },
  trashBin: {
    position: 'absolute',
    top: 5,
    left: 3,
    width: 8,
    height: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1.2,
    borderTopWidth: 0,
  },
  trashLine: {
    width: 1,
    height: 5,
  },
  moveShaft: {
    position: 'absolute',
    top: 6.25,
    left: 1,
    width: 11,
    height: 1.5,
  },
  moveArrowTop: {
    position: 'absolute',
    top: 3,
    right: 1,
    width: 5,
    height: 1.5,
    transform: [{ rotate: '45deg' }],
  },
  moveArrowBottom: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 5,
    height: 1.5,
    transform: [{ rotate: '-45deg' }],
  },
  repeatTopLine: {
    position: 'absolute',
    top: 3,
    left: 1,
    width: 10,
    height: 1.25,
  },
  repeatTopArrow: {
    position: 'absolute',
    top: 1,
    right: 1,
    width: 4,
    height: 4,
    borderTopWidth: 1.25,
    borderRightWidth: 1.25,
    transform: [{ rotate: '45deg' }],
  },
  repeatBottomLine: {
    position: 'absolute',
    right: 1,
    bottom: 3,
    width: 10,
    height: 1.25,
  },
  repeatBottomArrow: {
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
