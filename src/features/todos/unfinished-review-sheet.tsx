import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFeedback } from '@/features/preferences/preferences-context';
import { formatJournalDate } from '@/lib/date';

import { Todo } from './types';

type UnfinishedReviewSheetProps = {
  onDelete: (ids: string[]) => void;
  onKeep: () => void;
  onMove: (ids: string[]) => void;
  todos: Todo[];
};

export function UnfinishedReviewSheet({
  onDelete,
  onKeep,
  onMove,
  todos,
}: UnfinishedReviewSheetProps) {
  const insets = useSafeAreaInsets();
  const feedback = useFeedback();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState(
    () => new Set(todos.map((todo) => todo.id)),
  );
  const selected = [...selectedIds];

  const toggle = (id: string) => {
    feedback.selection();
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={onKeep}
      statusBarTranslucent
      transparent
      visible
    >
      <View style={styles.modalRoot}>
        <Pressable
          accessibilityLabel="Keep unfinished tasks in history"
          accessibilityRole="button"
          onPress={onKeep}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) }]}
        >
          {confirmDelete ? (
            <View style={styles.content}>
              <Text style={styles.eyebrow}>Yesterday’s tasks</Text>
              <Text style={styles.title}>Delete selected tasks?</Text>
              <Text style={styles.body}>
                {selected.length} {selected.length === 1 ? 'task' : 'tasks'} will
                be removed. You can undo this for a few seconds.
              </Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setConfirmDelete(false)}
                  style={({ pressed }) => [
                    styles.outlineButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.outlineButtonText}>Back</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onDelete(selected)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.content}>
                <Text style={styles.eyebrow}>
                  {formatJournalDate(todos[0]?.date ?? '')}
                </Text>
                <Text style={styles.title}>What should move forward?</Text>
                <Text style={styles.body}>
                  Select unfinished tasks to bring into Today. Unselected tasks
                  stay safely in Past tasks.
                </Text>
              </View>

              <ScrollView
                contentContainerStyle={styles.taskList}
                style={styles.taskScroll}
              >
                {todos.map((todo) => {
                  const checked = selectedIds.has(todo.id);
                  return (
                    <Pressable
                      accessibilityLabel={`${checked ? 'Deselect' : 'Select'} ${todo.title}`}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      key={todo.id}
                      onPress={() => toggle(todo.id)}
                      style={({ pressed }) => [
                        styles.taskRow,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.checkbox, checked && styles.checked]}>
                        {checked ? <Text style={styles.checkmark}>✓</Text> : null}
                      </View>
                      <Text numberOfLines={2} style={styles.taskTitle}>
                        {todo.title}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={styles.footer}>
                <Pressable
                  accessibilityRole="button"
                  disabled={!selected.length}
                  onPress={() => onMove(selected)}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    !selected.length && styles.disabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.primaryButtonText}>Move to Today</Text>
                </Pressable>
                <View style={styles.secondaryActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={onKeep}
                    style={({ pressed }) => [
                      styles.textButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.textButtonText}>Keep in history</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={!selected.length}
                    onPress={() => {
                      feedback.warning();
                      setConfirmDelete(true);
                    }}
                    style={({ pressed }) => [
                      styles.textButton,
                      !selected.length && styles.disabled,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.textButtonText}>Delete selected</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.42)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    maxHeight: '82%',
    alignSelf: 'center',
    borderTopWidth: 1,
    borderColor: '#111111',
    backgroundColor: '#fbfbf9',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 27,
  },
  eyebrow: {
    color: '#74736e',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  title: {
    marginTop: 5,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 21,
    lineHeight: 28,
    letterSpacing: -0.8,
  },
  body: {
    marginTop: 9,
    color: '#74736e',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    lineHeight: 17,
  },
  taskScroll: {
    marginTop: 20,
    flexShrink: 1,
  },
  taskList: {
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderColor: '#d1d0cb',
  },
  taskRow: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderColor: '#d1d0cb',
  },
  checkbox: {
    width: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#686863',
  },
  checked: {
    borderColor: '#343432',
    backgroundColor: '#343432',
  },
  checkmark: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    lineHeight: 13,
  },
  taskTitle: {
    flex: 1,
    color: '#343432',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    lineHeight: 18,
  },
  footer: {
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  primaryButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111111',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  outlineButton: {
    minHeight: 50,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#111111',
  },
  outlineButtonText: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
  },
  secondaryActions: {
    minHeight: 48,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  textButton: {
    minHeight: 48,
    justifyContent: 'center',
  },
  textButtonText: {
    color: '#555550',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  confirmActions: {
    marginTop: 25,
    flexDirection: 'row',
    gap: 10,
  },
  disabled: {
    opacity: 0.34,
  },
  pressed: {
    opacity: 0.52,
  },
});
