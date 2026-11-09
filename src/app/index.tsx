import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TaskComposer } from '@/features/todos/task-composer';
import { ReorderableTaskList } from '@/features/todos/reorderable-task-list';
import { TaskRow } from '@/features/todos/task-row';
import { useTodos } from '@/features/todos/todos-context';
import { Todo } from '@/features/todos/types';
import { formatJournalDate, formatWeekday } from '@/lib/date';

type ComposerState = { mode: 'create' } | { mode: 'edit'; todo: Todo } | null;

export default function HomeScreen() {
  const [composer, setComposer] = useState<ComposerState>(null);
  const [isReordering, setIsReordering] = useState(false);
  const {
    addTodo,
    deleteTodo,
    editTodo,
    getTodosForDate,
    isTodoRepeating,
    reorderTodo,
    repeatTodoTomorrow,
    startDailyRepeat,
    stopDailyRepeat,
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
                <Pressable
                  accessibilityLabel={
                    pastDateCount
                      ? `Open past tasks. ${pastDateCount} saved ${pastDateCount === 1 ? 'day' : 'days'}.`
                      : 'Open backup and restore'
                  }
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() =>
                    router.navigate(pastDateCount ? '/history' : '/backup')
                  }
                  style={({ pressed }) => [
                    styles.headerAction,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.headerActionText}>
                    {pastDateCount ? 'Past tasks' : 'Backup'}
                  </Text>
                  {pastDateCount ? (
                    <Text style={styles.headerActionCount}>
                      {pastDateCount}
                    </Text>
                  ) : null}
                  <Text style={styles.headerActionArrow}>→</Text>
                </Pressable>
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
                      onDelete={deleteTodo}
                      onEdit={(selectedTodo) =>
                        setComposer({ mode: 'edit', todo: selectedTodo })
                      }
                      onRepeatDaily={startDailyRepeat}
                      onRepeatTomorrow={repeatTodoTomorrow}
                      onStopRepeating={stopDailyRepeat}
                      onToggle={toggleTodo}
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
              void Haptics.impactAsync(
                Haptics.ImpactFeedbackStyle.Light,
              ).catch(() => undefined);
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
          date={today}
          heading={composer.mode === 'edit' ? 'Edit task' : 'New task'}
          initialTitle={composer.mode === 'edit' ? composer.todo.title : ''}
          key={composer.mode === 'edit' ? composer.todo.id : 'new-task'}
          onClose={() => setComposer(null)}
          onSubmit={(title) => {
            if (composer.mode === 'edit') {
              editTodo(composer.todo.id, title);
              return;
            }

            addTodo(title, today);
          }}
          submitLabel={composer.mode === 'edit' ? 'Save changes' : 'Add task'}
          visible
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
  headerAction: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderBottomWidth: 1,
    borderColor: '#2f2f2d',
  },
  headerActionText: {
    color: '#343432',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  headerActionCount: {
    minWidth: 16,
    color: '#888781',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textAlign: 'center',
  },
  headerActionArrow: {
    color: '#343432',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 13,
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
