import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TaskComposer } from '@/features/todos/task-composer';
import { TaskRow } from '@/features/todos/task-row';
import { useTodos } from '@/features/todos/todos-context';
import { Todo } from '@/features/todos/types';
import { formatJournalDate, formatWeekday } from '@/lib/date';

type ComposerState = { mode: 'create' } | { mode: 'edit'; todo: Todo } | null;

export default function HomeScreen() {
  const [composer, setComposer] = useState<ComposerState>(null);
  const {
    addTodo,
    deleteTodo,
    editTodo,
    getTodosForDate,
    isTodoRepeating,
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
                  accessibilityLabel={`Open past tasks. ${pastDateCount} saved ${pastDateCount === 1 ? 'day' : 'days'}.`}
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => router.navigate('/history')}
                  style={({ pressed }) => [
                    styles.historyButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.historyText}>Past tasks</Text>
                  {pastDateCount ? (
                    <Text style={styles.historyCount}>{pastDateCount}</Text>
                  ) : null}
                  <Text style={styles.historyArrow}>→</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.todayTasks}>
              {todayTodos.length ? (
                todayTodos.map((todo) => (
                  <TaskRow
                    isRepeating={isTodoRepeating(todo)}
                    key={todo.id}
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
                ))
              ) : (
                <View style={styles.emptyToday} />
              )}
            </View>
          </View>
        </ScrollView>

        <View pointerEvents="box-none" style={styles.buttonDock}>
          <Pressable
            accessibilityLabel="Create a new task"
            accessibilityRole="button"
            onPress={() => setComposer({ mode: 'create' })}
            style={({ pressed }) => [
              styles.newTaskButton,
              pressed && styles.buttonPressed,
            ]}
          >
            <View style={styles.plusIcon}>
              <View style={styles.plusHorizontal} />
              <View style={styles.plusVertical} />
            </View>
            <Text style={styles.newTaskText}>New task</Text>
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
  historyButton: {
    minHeight: 28,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderBottomWidth: 1,
    borderColor: '#2f2f2d',
  },
  historyText: {
    color: '#343432',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  historyCount: {
    minWidth: 16,
    color: '#888781',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textAlign: 'center',
  },
  historyArrow: {
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
  buttonDock: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(251, 251, 249, 0.96)',
  },
  newTaskButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    backgroundColor: '#111111',
  },
  buttonPressed: {
    opacity: 0.76,
  },
  plusIcon: {
    width: 12,
    height: 12,
  },
  plusHorizontal: {
    position: 'absolute',
    top: 5.25,
    right: 0,
    left: 0,
    height: 1.5,
    backgroundColor: '#ffffff',
  },
  plusVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 5.25,
    width: 1.5,
    backgroundColor: '#ffffff',
  },
  newTaskText: {
    color: '#ffffff',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13,
  },
});
