import { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  useFeedback,
  usePreferences,
} from '@/features/preferences/preferences-context';
import { ThemeColors, useThemeStyles } from '@/theme/theme';

import {
  ReorderGestureDetector,
  TaskReorderControls,
} from './reorderable-task-list';
import { TaskActionsSheet } from './task-actions-sheet';
import { Todo } from './types';

type ActionSheetMode = 'actions' | 'delete' | null;

type TaskRowProps = Partial<TaskReorderControls> & {
  compact?: boolean;
  isRepeating?: boolean;
  todo: Todo;
  onDelete?: (id: string) => void;
  onDeleteSeries?: (id: string) => void;
  onDuplicate?: (id: string) => void;
  onEdit?: (todo: Todo) => void;
  onClearReminder?: (id: string) => void;
  onMoveToToday?: (id: string) => void;
  onRepeatSchedule?: (id: string, daysOfWeek: number[]) => void;
  onRepeatTomorrow?: (id: string) => void;
  onSetReminder?: (id: string, reminderAt: string) => void;
  onStopRepeat?: (id: string) => void;
  repeatDays?: number[] | null;
  onToggle: (id: string) => void;
};

export function TaskRow({
  compact = false,
  isRepeating = false,
  onMoveDown,
  onMoveUp,
  reorderGesture,
  suppressPress,
  todo,
  onClearReminder,
  onDelete,
  onDeleteSeries,
  onDuplicate,
  onEdit,
  onMoveToToday,
  onRepeatSchedule,
  onRepeatTomorrow,
  onSetReminder,
  onStopRepeat,
  repeatDays,
  onToggle,
}: TaskRowProps) {
  const styles = useThemeStyles(createStyles);
  const feedback = useFeedback();
  const { preferences } = usePreferences();
  const [actionSheetMode, setActionSheetMode] =
    useState<ActionSheetMode>(null);
  const [checkboxScale] = useState(() => new Animated.Value(1));
  const [labelOpacity] = useState(
    () => new Animated.Value(todo.completed ? 0.52 : 1),
  );

  const openActions = () => {
    if (
      !onDelete &&
      !onDuplicate &&
      !onEdit &&
      !onClearReminder &&
      !onMoveToToday &&
      !onRepeatSchedule &&
      !onRepeatTomorrow &&
      !onSetReminder &&
      !onStopRepeat
    ) {
      return;
    }
    feedback.selection();
    setActionSheetMode('actions');
  };

  const pressLabel = () => {
    if (suppressPress) return;

    if (onEdit) {
      onEdit(todo);
      return;
    }

    toggleTask();
  };

  const toggleTask = () => {
    const willComplete = !todo.completed;

    checkboxScale.stopAnimation();
    labelOpacity.stopAnimation();

    if (preferences.reducedMotion) {
      checkboxScale.setValue(1);
      labelOpacity.setValue(willComplete ? 0.52 : 1);
      feedback.selection();
      onToggle(todo.id);
      return;
    }

    checkboxScale.setValue(willComplete ? 0.84 : 0.9);

    Animated.parallel([
      Animated.spring(checkboxScale, {
        bounciness: 5,
        speed: 24,
        toValue: 1,
        useNativeDriver: true,
      }),
      Animated.timing(labelOpacity, {
        duration: 170,
        toValue: willComplete ? 0.52 : 1,
        useNativeDriver: true,
      }),
    ]).start();

    feedback.selection();
    onToggle(todo.id);
  };

  const labelButton = (
    <Pressable
      accessibilityActions={
        onMoveUp || onMoveDown
          ? [
              ...(onMoveUp
                ? [{ name: 'decrement' as const, label: 'Move up' }]
                : []),
              ...(onMoveDown
                ? [{ name: 'increment' as const, label: 'Move down' }]
                : []),
            ]
          : undefined
      }
      accessibilityHint={
        reorderGesture
          ? 'Tap to edit. Touch and hold, then drag to reorder.'
          : onEdit
            ? 'Opens the task editor'
            : undefined
      }
      accessibilityLabel={`${onEdit ? 'Edit' : 'Toggle'} task: ${todo.title}`}
      accessibilityRole="button"
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'decrement') onMoveUp?.();
        if (event.nativeEvent.actionName === 'increment') onMoveDown?.();
      }}
      onPress={pressLabel}
      style={({ pressed }) => [
        styles.labelButton,
        pressed && styles.pressed,
      ]}
    >
      <View>
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.label,
            compact && styles.compactLabel,
            todo.completed && styles.completedLabel,
            { opacity: labelOpacity },
          ]}
        >
          {todo.title}
        </Animated.Text>
        {!compact && todo.reminderAt ? (
          <Text style={styles.reminderLabel}>
            Remind {formatReminder(todo.reminderAt)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <>
      <View style={[styles.row, compact && styles.compactRow]}>
        <Pressable
          accessibilityLabel={`${todo.completed ? 'Mark incomplete' : 'Mark complete'}: ${todo.title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: todo.completed }}
          hitSlop={compact ? 2 : 6}
          onPress={toggleTask}
          style={({ pressed }) => [
            styles.checkboxControl,
            compact && styles.compactCheckboxControl,
            pressed && styles.pressed,
          ]}
        >
          <Animated.View
            style={[
              styles.checkbox,
              compact && styles.compactCheckbox,
              todo.completed && styles.checked,
              { transform: [{ scale: checkboxScale }] },
            ]}
          >
            {todo.completed ? (
              <Text
                style={[styles.checkmark, compact && styles.compactCheckmark]}
              >
                ✓
              </Text>
            ) : null}
          </Animated.View>
        </Pressable>

        {reorderGesture ? (
          <ReorderGestureDetector gesture={reorderGesture}>
            {labelButton}
          </ReorderGestureDetector>
        ) : (
          labelButton
        )}

        {!compact &&
        (onEdit ||
          onDelete ||
          onDuplicate ||
          onClearReminder ||
          onMoveToToday ||
          onRepeatSchedule ||
          onRepeatTomorrow ||
          onSetReminder ||
          onStopRepeat) ? (
          <Pressable
            accessibilityLabel={`Actions for ${todo.title}`}
            accessibilityRole="button"
            hitSlop={6}
            onPress={openActions}
            style={({ pressed }) => [
              styles.menuButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.menuText}>•••</Text>
          </Pressable>
        ) : null}
      </View>

      {actionSheetMode ? (
        <TaskActionsSheet
          initialMode={actionSheetMode}
          isRepeating={isRepeating}
          reminderAt={todo.reminderAt}
          repeatDays={repeatDays}
          onClose={() => setActionSheetMode(null)}
          onClearReminder={
            onClearReminder ? () => onClearReminder(todo.id) : undefined
          }
          onDelete={onDelete ? () => onDelete(todo.id) : undefined}
          onDeleteSeries={
            onDeleteSeries && isRepeating
              ? () => onDeleteSeries(todo.id)
              : undefined
          }
          onDuplicate={onDuplicate ? () => onDuplicate(todo.id) : undefined}
          onEdit={onEdit ? () => onEdit(todo) : undefined}
          onMoveToToday={
            onMoveToToday ? () => onMoveToToday(todo.id) : undefined
          }
          onRepeatSchedule={
            onRepeatSchedule
              ? (daysOfWeek) => onRepeatSchedule(todo.id, daysOfWeek)
              : undefined
          }
          onRepeatTomorrow={
            onRepeatTomorrow ? () => onRepeatTomorrow(todo.id) : undefined
          }
          onSetReminder={
            onSetReminder
              ? (reminderAt) => onSetReminder(todo.id, reminderAt)
              : undefined
          }
          onStopRepeat={
            onStopRepeat ? () => onStopRepeat(todo.id) : undefined
          }
          taskTitle={todo.title}
        />
      ) : null}
    </>
  );
}

function formatReminder(value: string) {
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return sameDay
    ? `today, ${time}`
    : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${time}`;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  row: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactRow: {
    minHeight: 31,
  },
  pressed: {
    opacity: 0.48,
  },
  checkboxControl: {
    width: 31,
    minHeight: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  compactCheckboxControl: {
    width: 24,
    minHeight: 31,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCheckbox: {
    width: 15,
    height: 15,
  },
  checked: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  checkmark: {
    color: colors.accentText,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13,
    lineHeight: 15,
  },
  compactCheckmark: {
    fontSize: 10,
    lineHeight: 12,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 14,
    letterSpacing: -0.35,
  },
  compactLabel: {
    fontSize: 11,
    letterSpacing: -0.4,
  },
  completedLabel: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  reminderLabel: {
    marginTop: 1,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
  },
  labelButton: {
    minWidth: 0,
    minHeight: 40,
    flex: 1,
    justifyContent: 'center',
  },
  menuButton: {
    width: 36,
    minHeight: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  menuText: {
    marginTop: -7,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13,
    letterSpacing: 1,
  },
});
