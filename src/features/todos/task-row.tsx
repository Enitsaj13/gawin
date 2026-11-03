import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { TaskActionsSheet } from './task-actions-sheet';
import { Todo } from './types';

type ActionSheetMode = 'actions' | 'delete' | null;

type TaskRowProps = {
  compact?: boolean;
  isRepeating?: boolean;
  todo: Todo;
  onDelete?: (id: string) => void;
  onEdit?: (todo: Todo) => void;
  onMoveToToday?: (id: string) => void;
  onRepeatDaily?: (id: string) => void;
  onRepeatTomorrow?: (id: string) => void;
  onStopRepeating?: (id: string) => void;
  onToggle: (id: string) => void;
};

export function TaskRow({
  compact = false,
  isRepeating = false,
  todo,
  onDelete,
  onEdit,
  onMoveToToday,
  onRepeatDaily,
  onRepeatTomorrow,
  onStopRepeating,
  onToggle,
}: TaskRowProps) {
  const [actionSheetMode, setActionSheetMode] =
    useState<ActionSheetMode>(null);
  const [checkboxScale] = useState(() => new Animated.Value(1));
  const [labelOpacity] = useState(
    () => new Animated.Value(todo.completed ? 0.52 : 1),
  );

  const confirmDelete = () => {
    if (onDelete) setActionSheetMode('delete');
  };

  const openActions = () => {
    if (
      !onDelete &&
      !onEdit &&
      !onMoveToToday &&
      !onRepeatDaily &&
      !onRepeatTomorrow &&
      !onStopRepeating
    ) {
      return;
    }
    void Haptics.selectionAsync().catch(() => undefined);
    setActionSheetMode('actions');
  };

  const pressLabel = () => {
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

    void Haptics.selectionAsync().catch(() => undefined);
    onToggle(todo.id);
  };

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

        <Pressable
          accessibilityHint={onEdit ? 'Opens the task editor' : undefined}
          accessibilityLabel={`${onEdit ? 'Edit' : 'Toggle'} task: ${todo.title}`}
          accessibilityRole="button"
          onLongPress={confirmDelete}
          onPress={pressLabel}
          style={({ pressed }) => [
            styles.labelButton,
            pressed && styles.pressed,
          ]}
        >
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
        </Pressable>

        {!compact &&
        (onEdit ||
          onDelete ||
          onMoveToToday ||
          onRepeatDaily ||
          onRepeatTomorrow ||
          onStopRepeating) ? (
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
          onClose={() => setActionSheetMode(null)}
          onDelete={onDelete ? () => onDelete(todo.id) : undefined}
          onEdit={onEdit ? () => onEdit(todo) : undefined}
          onMoveToToday={
            onMoveToToday ? () => onMoveToToday(todo.id) : undefined
          }
          onRepeatDaily={
            onRepeatDaily ? () => onRepeatDaily(todo.id) : undefined
          }
          onRepeatTomorrow={
            onRepeatTomorrow ? () => onRepeatTomorrow(todo.id) : undefined
          }
          onStopRepeating={
            onStopRepeating ? () => onStopRepeating(todo.id) : undefined
          }
          taskTitle={todo.title}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
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
    borderColor: '#777772',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactCheckbox: {
    width: 15,
    height: 15,
  },
  checked: {
    borderColor: '#343432',
    backgroundColor: '#343432',
  },
  checkmark: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13,
    lineHeight: 15,
  },
  compactCheckmark: {
    fontSize: 10,
    lineHeight: 12,
  },
  label: {
    color: '#363634',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 14,
    letterSpacing: -0.35,
  },
  compactLabel: {
    fontSize: 11,
    letterSpacing: -0.4,
  },
  completedLabel: {
    color: '#777671',
    textDecorationLine: 'line-through',
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
    color: '#767570',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13,
    letterSpacing: 1,
  },
});
