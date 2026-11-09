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
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

type SheetMode =
  | 'actions'
  | 'delete'
  | 'reminder'
  | 'repeat'
  | 'repeat-custom';

type TaskActionsSheetProps = {
  initialMode?: SheetMode;
  isDailyDefault?: boolean;
  defaultEnabled?: boolean;
  isRepeating?: boolean;
  reminderAt?: string;
  repeatDays?: number[] | null;
  taskTitle: string;
  onClearReminder?: () => void;
  onClose: () => void;
  onDelete?: () => void;
  onDeleteSeries?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onMoveToToday?: () => void;
  onRepeatSchedule?: (daysOfWeek: number[]) => void;
  onRepeatTomorrow?: () => void;
  onSetReminder?: (reminderAt: string) => void;
  onStopRepeat?: () => void;
  onToggleDefault?: () => void;
};

export function TaskActionsSheet({
  initialMode = 'actions',
  isDailyDefault = false,
  defaultEnabled = true,
  isRepeating = false,
  reminderAt,
  repeatDays,
  taskTitle,
  onClearReminder,
  onClose,
  onDelete,
  onDeleteSeries,
  onDuplicate,
  onEdit,
  onMoveToToday,
  onRepeatSchedule,
  onRepeatTomorrow,
  onSetReminder,
  onStopRepeat,
  onToggleDefault,
}: TaskActionsSheetProps) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const { preferences } = usePreferences();
  const [mode, setMode] = useState<SheetMode>(initialMode);
  const [customDays, setCustomDays] = useState(
    () => new Set(repeatDays ?? [1, 2, 3, 4, 5]),
  );
  const [backdropOpacity] = useState(() => new Animated.Value(0));
  const [translateY] = useState(() => new Animated.Value(36));
  const closingRef = useRef(false);

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

  const showDeleteConfirmation = () => {
    feedback.warning();
    setMode('delete');
  };

  const showRepeatOptions = () => {
    feedback.selection();
    setMode('repeat');
  };

  const showReminderOptions = () => {
    feedback.selection();
    setMode('reminder');
  };

  const editTask = () => dismiss(onEdit);
  const deleteTask = () => dismiss(onDelete);
  const deleteSeries = () => dismiss(onDeleteSeries);
  const duplicateTask = () => dismiss(onDuplicate);
  const moveToToday = () => dismiss(onMoveToToday);
  const repeatTomorrow = () => dismiss(onRepeatTomorrow);
  const stopRepeating = () => dismiss(onStopRepeat);
  const toggleDefault = () => dismiss(onToggleDefault);
  const setRepeatSchedule = (days: number[]) =>
    dismiss(() => onRepeatSchedule?.(days));
  const setReminder = (date: Date) => {
    onSetReminder?.(date.toISOString());
    dismiss();
  };
  const clearReminder = () => dismiss(onClearReminder);
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
                <Text style={styles.eyebrow}>
                  {isDailyDefault ? 'Daily default' : 'Task actions'}
                </Text>
                <Text numberOfLines={2} style={styles.taskTitle}>
                  {taskTitle}
                </Text>

                <View style={styles.actionList}>
                  {onEdit ? (
                    <Pressable
                      accessibilityLabel={`Edit ${isDailyDefault ? 'daily default' : 'task'}: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={editTask}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <PencilIcon />
                      <Text style={styles.actionText}>
                        {isDailyDefault ? 'Edit daily default' : 'Edit task'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {onDuplicate ? (
                    <Pressable
                      accessibilityLabel={`Duplicate task: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={duplicateTask}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <DuplicateIcon />
                      <Text style={styles.actionText}>Duplicate task</Text>
                    </Pressable>
                  ) : null}

                  {onToggleDefault ? (
                    <Pressable
                      accessibilityLabel={`${defaultEnabled ? 'Pause' : 'Enable'} daily default: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={toggleDefault}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <RepeatIcon />
                      <Text style={styles.actionText}>
                        {defaultEnabled ? 'Pause daily default' : 'Enable daily default'}
                      </Text>
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

                  {onSetReminder || onClearReminder ? (
                    <Pressable
                      accessibilityLabel={`Reminder options for: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={showReminderOptions}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ReminderIcon />
                      <Text style={styles.actionText}>
                        {reminderAt ? 'Change reminder' : 'Add reminder'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {onRepeatSchedule || onRepeatTomorrow || onStopRepeat ? (
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
                        {isRepeating
                          ? repeatScheduleLabel(repeatDays)
                          : 'Repeat task'}
                      </Text>
                    </Pressable>
                  ) : null}

                  {onDelete ? (
                    <Pressable
                      accessibilityLabel={`${isDailyDefault ? 'Remove daily default' : 'Delete task'}: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={showDeleteConfirmation}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <TrashIcon />
                      <Text style={styles.actionText}>
                        {isDailyDefault ? 'Remove daily default' : 'Delete task'}
                      </Text>
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
                  {onRepeatTomorrow && !isRepeating ? (
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
                  {onRepeatSchedule ? (
                    <>
                      <ScheduleRow
                        label="Every day"
                        onPress={() => setRepeatSchedule([0, 1, 2, 3, 4, 5, 6])}
                      />
                      <ScheduleRow
                        label="Weekdays"
                        onPress={() => setRepeatSchedule([1, 2, 3, 4, 5])}
                      />
                      <ScheduleRow
                        label="Weekends"
                        onPress={() => setRepeatSchedule([0, 6])}
                      />
                      <ScheduleRow
                        label="Choose days"
                        onPress={() => setMode('repeat-custom')}
                      />
                    </>
                  ) : null}
                  {isRepeating && onStopRepeat ? (
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
                      <Text style={styles.actionText}>Stop repeat</Text>
                    </Pressable>
                  ) : null}
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
            ) : mode === 'repeat-custom' ? (
              <>
                <Text style={styles.eyebrow}>Repeat task</Text>
                <Text style={styles.confirmTitle}>Choose days</Text>
                <View style={styles.dayPicker}>
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, day) => {
                    const selected = customDays.has(day);
                    return (
                      <Pressable
                        accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${dayName(day)}`}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        key={`${label}-${day}`}
                        onPress={() => {
                          feedback.selection();
                          setCustomDays((current) => {
                            const next = new Set(current);
                            if (next.has(day)) next.delete(day);
                            else next.add(day);
                            return next;
                          });
                        }}
                        style={({ pressed }) => [
                          styles.dayButton,
                          selected && styles.dayButtonSelected,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayButtonText,
                            selected && styles.dayButtonTextSelected,
                          ]}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <View style={styles.confirmActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setMode('repeat')}
                    style={({ pressed }) => [
                      styles.confirmCancel,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.confirmCancelText}>Back</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!customDays.size}
                    onPress={() =>
                      setRepeatSchedule([...customDays].sort())
                    }
                    style={({ pressed }) => [
                      styles.confirmDelete,
                      !customDays.size && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.confirmDeleteText}>Save schedule</Text>
                  </Pressable>
                </View>
              </>
            ) : mode === 'reminder' ? (
              <>
                <Text style={styles.eyebrow}>Task reminder</Text>
                <Text numberOfLines={2} style={styles.taskTitle}>
                  {taskTitle}
                </Text>
                <View style={styles.actionList}>
                  {getReminderPresets().map((preset) => (
                    <Pressable
                      accessibilityLabel={`${preset.label}: ${taskTitle}`}
                      accessibilityRole="button"
                      key={preset.label}
                      onPress={() => setReminder(preset.date)}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ReminderIcon />
                      <View>
                        <Text style={styles.actionText}>{preset.label}</Text>
                        <Text style={styles.actionMeta}>{preset.detail}</Text>
                      </View>
                    </Pressable>
                  ))}
                  {reminderAt && onClearReminder ? (
                    <Pressable
                      accessibilityLabel={`Remove reminder for: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={clearReminder}
                      style={({ pressed }) => [
                        styles.actionRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <ReminderIcon />
                      <Text style={styles.actionText}>Remove reminder</Text>
                    </Pressable>
                  ) : null}
                </View>
                <Pressable
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
                <Text style={styles.eyebrow}>
                  {isDailyDefault ? 'Daily default' : 'Delete task'}
                </Text>
                <Text style={styles.confirmTitle}>
                  {isDailyDefault ? 'Remove this default?' : 'Delete this task?'}
                </Text>
                <Text numberOfLines={2} style={styles.confirmTaskTitle}>
                  {taskTitle}
                </Text>
                <Text style={styles.confirmBody}>
                  {onDeleteSeries
                    ? 'Choose whether to remove only today’s copy or the daily default too.'
                    : isDailyDefault
                      ? 'Existing tasks stay in history. It will not appear on future days.'
                      : 'You can undo this for a few seconds.'}
                </Text>

                {onDeleteSeries ? (
                  <>
                    <View style={styles.confirmActions}>
                      <Pressable
                        accessibilityLabel={`Delete only today’s task: ${taskTitle}`}
                        accessibilityRole="button"
                        onPress={deleteTask}
                        style={({ pressed }) => [
                          styles.confirmCancel,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.confirmCancelText}>Today only</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel={`Delete today and future repeats: ${taskTitle}`}
                        accessibilityRole="button"
                        onPress={deleteSeries}
                        style={({ pressed }) => [
                          styles.confirmDelete,
                          pressed && styles.pressed,
                        ]}
                      >
                        <TrashIcon color={colors.accentText} />
                        <Text style={styles.confirmDeleteText}>
                          Today & future
                        </Text>
                      </Pressable>
                    </View>
                    <Pressable
                      accessibilityLabel="Cancel delete"
                      accessibilityRole="button"
                      onPress={cancelDelete}
                      style={({ pressed }) => [
                        styles.cancelRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </Pressable>
                  </>
                ) : (
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
                      accessibilityLabel={`Confirm ${isDailyDefault ? 'remove daily default' : 'delete task'}: ${taskTitle}`}
                      accessibilityRole="button"
                      onPress={deleteTask}
                      style={({ pressed }) => [
                        styles.confirmDelete,
                        pressed && styles.pressed,
                      ]}
                    >
                      <TrashIcon color={colors.accentText} />
                      <Text style={styles.confirmDeleteText}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function ScheduleRow({ label, onPress }: { label: string; onPress: () => void }) {
  const styles = useThemeStyles(createStyles);
  return (
    <Pressable
      accessibilityLabel={`Repeat ${label.toLowerCase()}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
    >
      <RepeatIcon />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function getReminderPresets() {
  const now = new Date();
  const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
  const evening = new Date(now);
  evening.setHours(18, 0, 0, 0);
  if (evening <= now) evening.setDate(evening.getDate() + 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  const detail = (date: Date) =>
    `${date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })} · ${date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })}`;

  return [
    { label: 'In one hour', date: inOneHour, detail: detail(inOneHour) },
    { label: 'This evening', date: evening, detail: detail(evening) },
    { label: 'Tomorrow morning', date: tomorrow, detail: detail(tomorrow) },
  ];
}

function repeatScheduleLabel(days?: number[] | null) {
  const schedule = days ?? [0, 1, 2, 3, 4, 5, 6];
  const value = [...schedule].sort().join(',');
  if (value === '0,1,2,3,4,5,6') return 'Repeats daily';
  if (value === '1,2,3,4,5') return 'Repeats on weekdays';
  if (value === '0,6') return 'Repeats on weekends';
  return 'Custom repeat';
}

function dayName(day: number) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day];
}

function useActionIcon(color?: string) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useAppTheme();
  return { color: color ?? colors.textSecondary, styles };
}

function PencilIcon({ color: requestedColor }: { color?: string }) {
  const { color, styles } = useActionIcon(requestedColor);
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

function DuplicateIcon({ color: requestedColor }: { color?: string }) {
  const { color, styles } = useActionIcon(requestedColor);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.icon}
    >
      <View style={[styles.duplicateBack, { borderColor: color }]} />
      <View style={[styles.duplicateFront, { borderColor: color }]} />
    </View>
  );
}

function ReminderIcon({ color: requestedColor }: { color?: string }) {
  const { color, styles } = useActionIcon(requestedColor);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={styles.icon}
    >
      <View style={[styles.reminderDome, { borderColor: color }]} />
      <View style={[styles.reminderLine, { backgroundColor: color }]} />
    </View>
  );
}

function TrashIcon({ color: requestedColor }: { color?: string }) {
  const { color, styles } = useActionIcon(requestedColor);
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

function MoveIcon({ color: requestedColor }: { color?: string }) {
  const { color, styles } = useActionIcon(requestedColor);
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

function RepeatIcon({ color: requestedColor }: { color?: string }) {
  const { color, styles } = useActionIcon(requestedColor);
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
  sheetContent: {
    paddingHorizontal: 24,
    paddingTop: 26,
  },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskTitle: {
    marginTop: 5,
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.75,
  },
  actionList: {
    marginTop: 24,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  actionRow: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  actionText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  actionMeta: {
    marginTop: 1,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
  },
  cancelRow: {
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
    fontSize: 12,
  },
  confirmTitle: {
    marginTop: 5,
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -0.9,
  },
  confirmTaskTitle: {
    marginTop: 18,
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    lineHeight: 20,
  },
  confirmBody: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  confirmActions: {
    marginTop: 24,
    flexDirection: 'row',
    gap: 10,
  },
  dayPicker: {
    marginTop: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 5,
  },
  dayButton: {
    maxWidth: 38,
    height: 38,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  dayButtonSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  dayButtonText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  dayButtonTextSelected: {
    color: colors.accentText,
  },
  confirmCancel: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  confirmDelete: {
    minHeight: 50,
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.accent,
  },
  confirmCancelText: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  confirmDeleteText: {
    color: colors.accentText,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.52,
  },
  disabled: {
    opacity: 0.34,
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
  duplicateBack: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 9,
    height: 9,
    borderWidth: 1.2,
  },
  duplicateFront: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 9,
    height: 9,
    borderWidth: 1.2,
    backgroundColor: colors.surface,
  },
  reminderDome: {
    position: 'absolute',
    top: 1,
    left: 3,
    width: 8,
    height: 9,
    borderTopWidth: 1.2,
    borderRightWidth: 1.2,
    borderLeftWidth: 1.2,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
  },
  reminderLine: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    left: 2,
    height: 1.2,
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
