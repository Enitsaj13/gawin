import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppMenuSheet } from '@/components/app-menu-sheet';
import {
  useFeedback,
  usePreferences,
} from '@/features/preferences/preferences-context';
import { TaskComposer } from '@/features/todos/task-composer';
import { ReorderableTaskList } from '@/features/todos/reorderable-task-list';
import { TaskRow } from '@/features/todos/task-row';
import { useTodos } from '@/features/todos/todos-context';
import { Todo } from '@/features/todos/types';
import { UnfinishedReviewSheet } from '@/features/todos/unfinished-review-sheet';
import { formatJournalDate, formatWeekday } from '@/lib/date';

type ComposerState = { mode: 'create' } | { mode: 'edit'; todo: Todo } | null;

export default function HomeScreen() {
  const feedback = useFeedback();
  const { backupDue } = usePreferences();
  const [composer, setComposer] = useState<ComposerState>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const {
    addTodo,
    clearTodoReminder,
    deleteTodo,
    deleteTodoSeries,
    duplicateTodo,
    editTodo,
    getTodosForDate,
    getRepeatDays,
    isTodoRepeating,
    pendingReviewTodos,
    reorderTodo,
    repeatTodoTomorrow,
    reviewUnfinishedTodos,
    setTodoReminder,
    startRepeat,
    stopRepeat,
    today,
    todos,
    toggleTodo,
  } = useTodos();
  const todayTodos = getTodosForDate(today);
  const completedTodayCount = todayTodos.filter(
    (todo) => todo.completed,
  ).length;
  const pastDateCount = new Set(
    todos.filter((todo) => todo.date < today).map((todo) => todo.date),
  ).size;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          scrollEnabled={!composer && !isReordering}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.todaySection}>
            <View style={styles.titleRow}>
              <View style={styles.titleGroup}>
                <Text style={styles.title}>Today</Text>
                <Text style={styles.todayDate}>{formatJournalDate(today)}</Text>
              </View>
              <View style={styles.headerMeta}>
                <View style={styles.dayStatus}>
                  <Text style={styles.weekday}>{formatWeekday(today)}</Text>
                  {todayTodos.length ? (
                    <Text style={styles.progress}>
                      {completedTodayCount} / {todayTodos.length} done
                    </Text>
                  ) : null}
                </View>
                <View style={styles.headerLinks}>
                  <Pressable
                    accessibilityLabel="Open Gawin menu"
                    accessibilityRole="button"
                    hitSlop={8}
                    onPress={() => setMenuOpen(true)}
                    style={({ pressed }) => [
                      styles.menuAction,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <Text style={styles.menuActionText}>Menu →</Text>
                  </Pressable>
                </View>
                {backupDue ? (
                  <Pressable
                    accessibilityLabel="A backup is recommended"
                    accessibilityRole="button"
                    onPress={() => router.navigate('/backup')}
                    style={({ pressed }) => pressed && styles.buttonPressed}
                  >
                    <Text style={styles.backupDue}>Backup recommended →</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <View style={styles.todayTasks}>
              {todayTodos.length ? (
                <ReorderableTaskList
                  onDragStateChange={setIsReordering}
                  onReorder={(id, toIndex) =>
                    reorderTodo(today, id, toIndex)
                  }
                  renderItem={(todo, reorderControls) => (
                    <TaskRow
                      {...reorderControls}
                      isRepeating={isTodoRepeating(todo)}
                      onClearReminder={clearTodoReminder}
                      onDelete={deleteTodo}
                      onDeleteSeries={deleteTodoSeries}
                      onDuplicate={duplicateTodo}
                      onEdit={(selectedTodo) =>
                        setComposer({ mode: 'edit', todo: selectedTodo })
                      }
                      onRepeatSchedule={startRepeat}
                      onRepeatTomorrow={repeatTodoTomorrow}
                      onSetReminder={(id, reminderAt) => {
                        void setTodoReminder(id, reminderAt);
                      }}
                      onStopRepeat={stopRepeat}
                      onToggle={toggleTodo}
                      repeatDays={getRepeatDays(todo)}
                      todo={todo}
                    />
                  )}
                  todos={todayTodos}
                />
              ) : (
                <View style={styles.emptyToday} />
              )}
            </View>
          </View>
        </ScrollView>

        <View pointerEvents="box-none" style={styles.floatingButtonDock}>
          <Pressable
            accessibilityLabel="Create a new task"
            accessibilityRole="button"
            accessibilityHint="Opens the new task form"
            onPress={() => {
              feedback.impactLight();
              setComposer({ mode: 'create' });
            }}
            style={({ pressed }) => [
              styles.newTaskButton,
              pressed && styles.floatingButtonPressed,
            ]}
          >
            <View style={styles.plusIcon}>
              <View style={styles.plusHorizontal} />
              <View style={styles.plusVertical} />
            </View>
          </Pressable>
        </View>
      </View>

      {composer ? (
        <TaskComposer
          allowSeriesUpdate={
            composer.mode === 'edit' && isTodoRepeating(composer.todo)
          }
          date={today}
          heading={composer.mode === 'edit' ? 'Edit task' : 'New task'}
          initialTitle={composer.mode === 'edit' ? composer.todo.title : ''}
          key={composer.mode === 'edit' ? composer.todo.id : 'new-task'}
          onClose={() => setComposer(null)}
          onSubmit={(title, updateSeries) => {
            if (composer.mode === 'edit') {
              editTodo(composer.todo.id, title, updateSeries);
              return;
            }

            addTodo(title, today);
          }}
          submitLabel={composer.mode === 'edit' ? 'Save changes' : 'Add task'}
          visible
        />
      ) : null}

      {pendingReviewTodos.length && !composer ? (
        <UnfinishedReviewSheet
          onDelete={(ids) => reviewUnfinishedTodos('delete', ids)}
          onKeep={() => reviewUnfinishedTodos('keep')}
          onMove={(ids) => reviewUnfinishedTodos('move', ids)}
          todos={pendingReviewTodos}
        />
      ) : null}

      {menuOpen ? (
        <AppMenuSheet
          onClose={() => setMenuOpen(false)}
          pastDateCount={pastDateCount}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fbfbf9',
  },
  page: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
    backgroundColor: '#fbfbf9',
  },
  scrollContent: {
    paddingBottom: 94,
  },
  todaySection: {
    minHeight: 314,
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 27,
    justifyContent: 'flex-start',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  titleGroup: {
    minWidth: 0,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 12,
  },
  title: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 24,
    letterSpacing: -1.3,
  },
  todayDate: {
    color: '#888781',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    letterSpacing: -0.45,
  },
  weekday: {
    color: '#85847f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  dayStatus: {
    alignItems: 'flex-end',
    gap: 2,
  },
  progress: {
    color: '#9a9993',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    letterSpacing: -0.3,
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 11,
  },
  headerLinks: {
    alignItems: 'flex-end',
  },
  menuAction: {
    minHeight: 28,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: '#2f2f2d',
  },
  menuActionText: {
    color: '#343432',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  backupDue: {
    color: '#777671',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
    textDecorationLine: 'underline',
  },
  todayTasks: {
    marginTop: 25,
  },
  emptyToday: {
    minHeight: 80,
  },
  floatingButtonDock: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    zIndex: 10,
  },
  newTaskButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    backgroundColor: '#111111',
  },
  floatingButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  buttonPressed: {
    opacity: 0.76,
  },
  plusIcon: {
    width: 18,
    height: 18,
  },
  plusHorizontal: {
    position: 'absolute',
    top: 8.25,
    right: 0,
    left: 0,
    height: 1.5,
    backgroundColor: '#ffffff',
  },
  plusVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 8.25,
    width: 1.5,
    backgroundColor: '#ffffff',
  },
});
