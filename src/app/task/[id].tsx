import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { TaskComposer } from '@/features/todos/task-composer';
import { TaskRow } from '@/features/todos/task-row';
import { useTodos } from '@/features/todos/todos-context';
import { formatJournalDate, formatWeekday } from '@/lib/date';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

export default function TaskScreen() {
  const styles = useThemeStyles(createStyles);
  const { statusBarStyle } = useAppTheme();
  const params = useLocalSearchParams<{ id: string }>();
  const context = useTodos();
  const todo = context.todos.find((task) => task.id === params.id);
  const [editing, setEditing] = useState(false);
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <StatusBar style={statusBarStyle} />
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.back}><BackButton /></Pressable>
        <Text style={styles.title}>Task</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {todo ? <>
          <Text style={styles.date}>{formatWeekday(todo.date)} · {formatJournalDate(todo.date)}</Text>
          <TaskRow detail todo={todo} onToggle={context.toggleTodo} onEdit={() => setEditing(true)} onDelete={context.deleteTodo} onClearReminder={context.clearTodoReminder}
            onSetReminder={(id, at) => { void context.setTodoReminder(id, at); }} onDuplicate={context.duplicateTodo}
            isRepeating={context.isTodoRepeating(todo)} repeatDays={context.getRepeatDays(todo)} onRepeatSchedule={context.startRepeat} onRepeatTomorrow={context.repeatTodoTomorrow} onStopRepeat={context.stopRepeat} onDeleteSeries={context.deleteTodoSeries} />
          <Pressable accessibilityRole="button" onPress={() => todo.date === context.today ? router.push('/') : router.push({ pathname: '/day/[date]', params: { date: todo.date } })} style={styles.link}><Text style={styles.linkText}>View this day →</Text></Pressable>
        </> : <Text style={styles.empty}>This task is no longer available.</Text>}
      </ScrollView>
    </View>
    {editing && todo ? <TaskComposer key={todo.id} allowDateSelection={!context.isTodoRepeating(todo)} allowSeriesUpdate={context.isTodoRepeating(todo)} date={todo.date} heading="Edit task" initialTitle={todo.title} initialSchedule={todo} onClose={() => setEditing(false)} onSubmit={(title, date, series, schedule) => context.editTodo(todo.id, title, series, date, schedule)} submitLabel="Save changes" visible /> : null}
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, page: { width: '100%', maxWidth: 560, flex: 1, alignSelf: 'center' }, header: { minHeight: 115, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 23, paddingTop: 23 },
  back: { width: 32, height: 44, alignItems: 'flex-start', justifyContent: 'center' }, title: { color: colors.text, fontFamily: 'SpaceMono_700Bold', fontSize: 22, letterSpacing: -1.25 }, content: { paddingHorizontal: 24, paddingBottom: 40 }, date: { marginVertical: 20, fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textMuted },
  link: { minHeight: 44, marginTop: 24, justifyContent: 'center', alignSelf: 'flex-start' }, linkText: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: colors.textSecondary, textDecorationLine: 'underline' }, empty: { fontFamily: 'SpaceMono_400Regular', fontSize: 13, color: colors.textMuted, marginTop: 32 },
});
