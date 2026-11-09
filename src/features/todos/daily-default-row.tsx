import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ReorderGestureDetector,
  TaskReorderControls,
} from './reorderable-task-list';
import { TaskActionsSheet } from './task-actions-sheet';
import { RepeatRule } from './types';

type DailyDefaultRowProps = TaskReorderControls & {
  item: RepeatRule;
  onDelete: (id: string) => void;
  onEdit: (item: RepeatRule) => void;
  onToggle: (id: string) => void;
};

export function DailyDefaultRow({
  item,
  onDelete,
  onEdit,
  onMoveDown,
  onMoveUp,
  onToggle,
  reorderGesture,
  suppressPress,
}: DailyDefaultRowProps) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const label = (
    <Pressable
      accessibilityActions={[
        ...(onMoveUp ? [{ name: 'decrement' as const, label: 'Move up' }] : []),
        ...(onMoveDown
          ? [{ name: 'increment' as const, label: 'Move down' }]
          : []),
      ]}
      accessibilityHint="Tap to edit. Touch and hold, then drag to reorder."
      accessibilityLabel={`Edit daily default: ${item.title}`}
      accessibilityRole="button"
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === 'decrement') onMoveUp?.();
        if (event.nativeEvent.actionName === 'increment') onMoveDown?.();
      }}
      onPress={() => {
        if (!suppressPress) onEdit(item);
      }}
      style={({ pressed }) => [
        styles.labelButton,
        pressed && styles.pressed,
      ]}
    >
      <Text numberOfLines={1} style={styles.title}>
        {item.title}
      </Text>
      <Text style={styles.status}>{item.active ? 'Every day' : 'Paused'}</Text>
    </Pressable>
  );

  return (
    <>
      <View style={styles.row}>
        <Pressable
          accessibilityLabel={`${item.active ? 'Pause' : 'Enable'} daily default: ${item.title}`}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.active }}
          hitSlop={6}
          onPress={() => onToggle(item.id)}
          style={({ pressed }) => [
            styles.checkboxControl,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.checkbox, item.active && styles.checked]}>
            {item.active ? <Text style={styles.checkmark}>✓</Text> : null}
          </View>
        </Pressable>

        <ReorderGestureDetector gesture={reorderGesture}>
          {label}
        </ReorderGestureDetector>

        <Pressable
          accessibilityLabel={`Actions for daily default: ${item.title}`}
          accessibilityRole="button"
          hitSlop={6}
          onPress={() => setActionsOpen(true)}
          style={({ pressed }) => [
            styles.menuButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.menuText}>•••</Text>
        </Pressable>
      </View>

      {actionsOpen ? (
        <TaskActionsSheet
          defaultEnabled={item.active}
          isDailyDefault
          onClose={() => setActionsOpen(false)}
          onDelete={() => onDelete(item.id)}
          onEdit={() => onEdit(item)}
          onToggleDefault={() => onToggle(item.id)}
          taskTitle={item.title}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxControl: {
    width: 31,
    minHeight: 48,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  checkbox: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#777772',
  },
  checked: {
    borderColor: '#343432',
    backgroundColor: '#343432',
  },
  checkmark: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
    lineHeight: 14,
  },
  labelButton: {
    minWidth: 0,
    minHeight: 48,
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    color: '#363634',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
    letterSpacing: -0.3,
  },
  status: {
    marginTop: 1,
    color: '#96958f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
  },
  menuButton: {
    width: 36,
    minHeight: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  menuText: {
    color: '#777772',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
    letterSpacing: 1.4,
  },
  pressed: {
    opacity: 0.48,
  },
});
