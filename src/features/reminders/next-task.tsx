import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTodos } from '@/features/todos/todos-context';
import { ThemeColors, useThemeStyles } from '@/theme/theme';
import { formatTaskTime, nextTimedTask } from './schedule';

export function NextTask() {
  const styles = useThemeStyles(createStyles);
  const { todos, today } = useTodos();
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(timer); }, []);
  const next = nextTimedTask(todos.filter((task) => task.date === today), now);
  if (!next) return null;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Next: ${next.title}, ${formatTaskTime(next)}`} onPress={() => router.push({ pathname: '/task/[id]', params: { id: next.id } })} style={styles.row}>
    <Text numberOfLines={1} style={styles.text}>Next: {next.title} · {formatTaskTime(next)}</Text>
  </Pressable>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({ row: { minHeight: 32, marginTop: 16, justifyContent: 'center' }, text: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textMuted } });
