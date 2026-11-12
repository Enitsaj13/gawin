import { router, useGlobalSearchParams, useRootNavigationState } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/toast';
import { useTodos } from '@/features/todos/todos-context';
import { ThemeColors, useThemeStyles } from '@/theme/theme';
import { useReminders } from './reminders-context';
import { formatTaskTime } from './schedule';

export function ReminderNavigation() {
  const { reminderTask } = useGlobalSearchParams<{ reminderTask?: string | string[] }>();
  const state = useRootNavigationState();
  const { isReady, todos } = useTodos();
  const { openTaskId, consumeOpenTask } = useReminders();
  const { showToast } = useToast();
  const handled = useRef('');
  const requested = (Array.isArray(reminderTask) ? reminderTask[0] : reminderTask) || openTaskId;
  useEffect(() => {
    if (!requested) { handled.current = ''; return; }
    if (!state?.key || !isReady || handled.current === requested) return;
    handled.current = requested;
    if (todos.some((task) => task.id === requested)) router.replace({ pathname: '/task/[id]', params: { id: requested } });
    else { router.replace('/'); showToast('This task is no longer available', 'reminder'); }
    consumeOpenTask();
  }, [consumeOpenTask, isReady, requested, showToast, state?.key, todos]);
  return null;
}

export function ReminderAlert() {
  const styles = useThemeStyles(createStyles);
  const { activeTask, dismiss, snooze } = useReminders();
  if (!activeTask) return null;
  return <Modal animationType="fade" onRequestClose={dismiss} transparent visible>
    <View style={styles.backdrop}>
      <View accessibilityViewIsModal style={styles.panel}>
        <Text style={styles.eyebrow}>Reminder</Text>
        <Text style={styles.title}>{activeTask.title}</Text>
        <Text style={styles.time}>{formatTaskTime(activeTask) || new Date(activeTask.reminderAt!).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => void snooze()} style={styles.secondary}><Text style={styles.secondaryText}>Snooze 5 min</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={dismiss} style={styles.primary}><Text style={styles.primaryText}>Dismiss</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => { dismiss(); router.push({ pathname: '/task/[id]', params: { id: activeTask.id } }); }} style={styles.link}><Text style={styles.linkText}>Open task →</Text></Pressable>
        <Text style={styles.note}>Dismissing keeps the task unfinished.</Text>
      </View>
    </View>
  </Modal>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.scrim }, panel: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: colors.surface, padding: 26, borderTopWidth: 1, borderColor: colors.accent },
  eyebrow: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, textTransform: 'uppercase', color: colors.textMuted }, title: { fontFamily: 'SpaceMono_700Bold', fontSize: 23, lineHeight: 34, color: colors.text, marginTop: 12 },
  time: { fontFamily: 'SpaceMono_400Regular', fontSize: 16, color: colors.textSecondary, marginTop: 10 }, actions: { flexDirection: 'row', gap: 10, marginTop: 28 },
  secondary: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accent }, primary: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  secondaryText: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, color: colors.text }, primaryText: { fontFamily: 'SpaceMono_700Bold', fontSize: 10, color: colors.accentText },
  link: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', marginTop: 10 }, linkText: { color: colors.textSecondary, fontFamily: 'SpaceMono_700Bold', fontSize: 10, textDecorationLine: 'underline' }, note: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: colors.textMuted, lineHeight: 16 },
});
