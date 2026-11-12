import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppMenuSheet } from '@/components/app-menu-sheet';
import { useToast } from '@/components/toast';
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
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

type ComposerState = { mode: 'create' } | { mode: 'edit'; todo: Todo } | null;

const COMPLETION_MESSAGES = [
  'You did it. Day complete.',
  'Well done today!',
  'Today, well done!',
  'You completed today!',
  'Congrats!',
  'Congrats, you did it!',
  'Congrats on finishing!',
  'Congrats—you completed today!',
  'Congrats, day complete!',
  'Congrats on a great day!',
  'Congrats, all done!',
  'Congrats on getting it done!',
  'Congrats—you made it!',
  'Nice work!',
  'Great job!',
  'Nicely done!',
  'Excellent!',
  'Way to go!',
  'You nailed it!',
  'Beautiful work!',
  'Proud of you!',
];

function shuffleMessages(messages: string[]) {
  const shuffled = [...messages];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

export default function HomeScreen() {
  const styles = useThemeStyles(createStyles);
  const { statusBarStyle } = useAppTheme();
  const feedback = useFeedback();
  const { showToast } = useToast();
  const { backupDue } = usePreferences();
  const [composer, setComposer] = useState<ComposerState>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const completionMessages = useRef<string[]>([]);
  const lastCompletionMessage = useRef<string | null>(null);
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
  const upcomingDateCount = new Set(
    todos.filter((todo) => todo.date > today).map((todo) => todo.date),
  ).size;

  const nextCompletionMessage = () => {
    if (!completionMessages.current.length) {
      completionMessages.current = shuffleMessages(COMPLETION_MESSAGES);
      if (
        completionMessages.current.length > 1 &&
        completionMessages.current[0] === lastCompletionMessage.current
      ) {
        [completionMessages.current[0], completionMessages.current[1]] = [
          completionMessages.current[1],
          completionMessages.current[0],
        ];
      }
    }

    const message = completionMessages.current.shift()!;
    lastCompletionMessage.current = message;
    return message;
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style={statusBarStyle} />
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
                      onCompleteAll={
                        !todo.completed && todayTodos.length > 0 &&
                        completedTodayCount === todayTodos.length - 1
                          ? () => showToast(nextCompletionMessage(), 'complete')
                          : undefined
                      }
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
          allowDateSelection={
            composer.mode !== 'edit' || !isTodoRepeating(composer.todo)
          }
          date={composer.mode === 'edit' ? composer.todo.date : today}
          heading={composer.mode === 'edit' ? 'Edit task' : 'New task'}
          initialTitle={composer.mode === 'edit' ? composer.todo.title : ''}
          key={composer.mode === 'edit' ? composer.todo.id : 'new-task'}
          onClose={() => setComposer(null)}
          onSubmit={(title, selectedDate, updateSeries) => {
            if (composer.mode === 'edit') {
              editTodo(composer.todo.id, title, updateSeries, selectedDate);
              return;
            }

            addTodo(title, selectedDate);
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
          upcomingDateCount={upcomingDateCount}
          pastDateCount={pastDateCount}
        />
      ) : null}
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
    backgroundColor: colors.background,
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
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 24,
    letterSpacing: -1.3,
  },
  todayDate: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    letterSpacing: -0.45,
  },
  weekday: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  dayStatus: {
    alignItems: 'flex-end',
    gap: 2,
  },
  progress: {
    color: colors.textFaint,
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
    borderColor: colors.textSecondary,
  },
  menuActionText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  backupDue: {
    color: colors.textMuted,
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
    backgroundColor: colors.accent,
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
    backgroundColor: colors.accentText,
  },
  plusVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 8.25,
    width: 1.5,
    backgroundColor: colors.accentText,
  },
});
