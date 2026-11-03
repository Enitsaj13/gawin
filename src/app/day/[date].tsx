import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { TaskComposer } from '@/features/todos/task-composer';
import { TaskRow } from '@/features/todos/task-row';
import { useTodos } from '@/features/todos/todos-context';
import { Todo } from '@/features/todos/types';
import { formatJournalDate, formatWeekday, shiftDateKey } from '@/lib/date';

function isDateKey(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default function DayScreen() {
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const {
    deleteTodo,
    editTodo,
    getTodosForDate,
    isTodoRepeating,
    moveTodoToToday,
    repeatTodoTomorrow,
    startDailyRepeat,
    stopDailyRepeat,
    today,
    toggleTodo,
  } = useTodos();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const requestedDate = Array.isArray(params.date)
    ? params.date[0]
    : params.date;
  const date =
    requestedDate && isDateKey(requestedDate) ? requestedDate : today;
  const todos = getTodosForDate(date);
  const previousDate = shiftDateKey(date, -1);

  const openDate = (nextDate: string) => {
    if (nextDate === today) {
      router.replace('/');
      return;
    }

    router.replace({ pathname: '/day/[date]', params: { date: nextDate } });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <BackButton />
          </Pressable>
          <Text style={styles.title}>{formatJournalDate(date)}</Text>
          <Text style={styles.weekday}>{formatWeekday(date)}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.taskList}
          showsVerticalScrollIndicator={false}
        >
          {todos.length ? (
            todos.map((todo) => (
              <TaskRow
                isRepeating={isTodoRepeating(todo)}
                key={todo.id}
                onDelete={deleteTodo}
                onEdit={setEditingTodo}
                onMoveToToday={
                  date < today && !todo.completed ? moveTodoToToday : undefined
                }
                onRepeatDaily={startDailyRepeat}
                onRepeatTomorrow={repeatTodoTomorrow}
                onStopRepeating={stopDailyRepeat}
                onToggle={toggleTodo}
                todo={todo}
              />
            ))
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Nothing scheduled.</Text>
              <Text style={styles.emptyBody}>A beautifully clear day.</Text>
            </View>
          )}
          {todos.length ? (
            <Text style={styles.deleteHint}>
              Tap a task to edit · Long press to delete
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.dayRail}>
          <Pressable
            onPress={() => openDate(today)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.railText}>Today</Text>
          </Pressable>
          <Pressable
            onPress={() => openDate(date)}
            style={({ pressed }) => [
              styles.activeRailItem,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.activeRailText}>{formatJournalDate(date)}</Text>
            <View style={styles.railIndicator} />
          </Pressable>
          <Pressable
            onPress={() => openDate(previousDate)}
            style={({ pressed }) => pressed && styles.pressed}
          >
            <Text style={styles.railText}>
              {formatJournalDate(previousDate)}
            </Text>
          </Pressable>
        </View>
      </View>

      {editingTodo ? (
        <TaskComposer
          date={date}
          heading="Edit task"
          initialTitle={editingTodo.title}
          key={editingTodo.id}
          onClose={() => setEditingTodo(null)}
          onSubmit={(title) => editTodo(editingTodo.id, title)}
          submitLabel="Save changes"
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
  header: {
    minHeight: 115,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 23,
    paddingTop: 23,
  },
  backButton: {
    width: 32,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -1.25,
  },
  weekday: {
    color: '#85847f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  taskList: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 42,
  },
  emptyState: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#3c3c39',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 14,
  },
  emptyBody: {
    marginTop: 6,
    color: '#96958f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  deleteHint: {
    marginTop: 28,
    color: '#a09f99',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textAlign: 'center',
  },
  dayRail: {
    minHeight: 78,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 23,
    overflow: 'hidden',
  },
  railText: {
    maxWidth: 92,
    color: '#797873',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  activeRailItem: {
    alignItems: 'center',
    paddingTop: 7,
  },
  activeRailText: {
    color: '#282826',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
  },
  railIndicator: {
    width: 30,
    height: 2,
    marginTop: 9,
    backgroundColor: '#2d2d2b',
  },
  pressed: {
    opacity: 0.45,
  },
});
