import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BackButton } from '@/components/back-button';
import { useTodos } from '@/features/todos/todos-context';
import { useReminders } from '@/features/reminders/reminders-context';
import { supportsAlarmSound } from '@/features/reminders/notifications';
import { currentTimeZone, formatTaskTime, nextTimedTask } from '@/features/reminders/schedule';
import { formatJournalDate } from '@/lib/date';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

export default function ClockScreen() {
  const styles = useThemeStyles(createStyles);
  const { statusBarStyle } = useAppTheme();
  const { todos } = useTodos();
  const reminders = useReminders();
  const [now, setNow] = useState(Date.now);
  const [message, setMessage] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const next = nextTimedTask(todos, now);
  const upcoming = todos.filter((task) => !task.completed && task.scheduledAt && Date.parse(task.scheduledAt) >= now).sort((a, b) => Date.parse(a.scheduledAt!) - Date.parse(b.scheduledAt!)).slice(0, 6);
  const minutes = next ? Math.max(1, Math.ceil((Date.parse(next.scheduledAt!) - now) / 60_000)) : 0;
  const until = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
  return <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
    <StatusBar style={statusBarStyle} />
    <View style={styles.page}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={12} onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.back}><BackButton /></Pressable>
        <Text style={styles.title}>Clock</Text>
      </View>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.clock}>
          <Text style={styles.date}>{new Date(now).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</Text>
          <Text accessibilityRole="timer" style={styles.digits}>{new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</Text>
          <Text style={styles.zone}>{currentTimeZone()}</Text>
        </View>
        <Text style={styles.eyebrow}>Next up</Text>
        {next ? <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/task/[id]', params: { id: next.id } })} style={styles.next}>
          <Text style={styles.nextTitle}>{next.title}</Text>
          <Text style={styles.nextTime}>{formatJournalDate(next.date)} · {formatTaskTime(next)}</Text>
          <Text style={styles.countdown}>Starts in {until} →</Text>
        </Pressable> : <View style={styles.next}><Text style={styles.nextTitle}>No upcoming times.</Text><Text style={styles.nextTime}>Add a time when creating or editing a task.</Text></View>}
        {supportsAlarmSound ? <View style={styles.soundSection}>
          <Pressable accessibilityRole="switch" accessibilityState={{ checked: reminders.soundEnabled }} onPress={() => {
            setMessage('');
            if (reminders.soundEnabled) { try { reminders.disableSound(); } catch { setMessage('Sound preference could not be saved. Please try again.'); } }
            else void reminders.enableSound().catch((error) => setMessage(error instanceof Error ? error.message : 'Sound could not start. Please try again.'));
          }} style={styles.soundRow}><Text style={styles.soundTitle}>Alarm sound</Text><Text style={styles.soundValue}>{reminders.soundEnabled ? 'On' : 'Off'} →</Text></Pressable>
          <Text style={styles.note}>Hear reminders while Gawin is open. Your sound preference stays saved.</Text>
          <Text style={styles.note}>Adjust your media volume, then dismiss or snooze to stop the alarm.</Text>
          {reminders.soundEnabled && !reminders.soundReady ? <Pressable accessibilityRole="button" onPress={() => { setMessage(''); void reminders.previewSound().catch((error) => setMessage(error instanceof Error ? error.message : 'Tap again to allow audio playback.')); }} style={styles.test}><Text style={styles.link}>Tap to enable sound</Text></Pressable> : null}
          {message ? <Text accessibilityLiveRegion="polite" style={styles.note}>{message}</Text> : null}
        </View> : null}
        <Pressable accessibilityRole="button" onPress={() => router.push('/settings')} style={styles.settings}><Text style={styles.link}>Notification settings →</Text></Pressable>
        <Text style={styles.note}>Manage reminders when Gawin is closed. Choose whether notifications show your task titles.</Text>
        {upcoming.length > 1 ? <View style={styles.upcoming}>
          <Text style={styles.eyebrow}>Coming up</Text>
          {upcoming.slice(1).map((task) => <Pressable accessibilityRole="button" key={task.id} onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })} style={styles.upcomingRow}>
            <Text numberOfLines={1} style={styles.upcomingTitle}>{task.title}</Text><Text style={styles.upcomingTime}>{formatJournalDate(task.date)} · {formatTaskTime(task)}</Text>
          </Pressable>)}
        </View> : null}
      </ScrollView>
    </View>
  </SafeAreaView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background }, page: { width: '100%', maxWidth: 560, flex: 1, alignSelf: 'center' }, header: { minHeight: 88, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 23, paddingTop: 12 },
  back: { width: 32, height: 44, alignItems: 'flex-start', justifyContent: 'center' }, title: { color: colors.text, fontFamily: 'SpaceMono_700Bold', fontSize: 22, letterSpacing: -1.25 }, content: { paddingHorizontal: 24, paddingBottom: 20 },
  clock: { alignItems: 'center', paddingTop: 12, paddingBottom: 26 }, date: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: colors.textMuted }, digits: { fontFamily: 'SpaceMono_700Bold', fontSize: 44, letterSpacing: -2, color: colors.text, marginTop: 12 }, zone: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: colors.textMuted, marginTop: 8 },
  eyebrow: { fontFamily: 'SpaceMono_700Bold', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.7, color: colors.textMuted }, next: { paddingVertical: 16, borderBottomWidth: 1, borderColor: colors.border }, nextTitle: { fontFamily: 'SpaceMono_700Bold', fontSize: 18, lineHeight: 26, color: colors.text }, nextTime: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 18, color: colors.textSecondary, marginTop: 8 }, countdown: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textMuted, marginTop: 10 },
  soundSection: { paddingTop: 12 }, soundRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, soundTitle: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: colors.textSecondary }, soundValue: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: colors.textMuted }, note: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: colors.textMuted, lineHeight: 17, marginTop: 6 }, test: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, link: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textSecondary, textDecorationLine: 'underline' },
  upcoming: { marginTop: 22 }, upcomingRow: { minHeight: 64, justifyContent: 'center', borderBottomWidth: 1, borderColor: colors.border }, upcomingTitle: { fontFamily: 'SpaceMono_400Regular', fontSize: 12, color: colors.textSecondary }, upcomingTime: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: colors.textMuted, marginTop: 5 }, settings: { marginTop: 8, minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
});
