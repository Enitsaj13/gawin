import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors, useThemeStyles } from '@/theme/theme';
import { useReminders } from './reminders-context';

export function NotificationSettings() {
  const styles = useThemeStyles(createStyles);
  const reminders = useReminders();
  const [message, setMessage] = useState('');
  const run = async (action: () => Promise<void>, success: string) => {
    setMessage('');
    try { await action(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Please try again.'); }
  };
  const info = reminders.info;
  return <View>
    <View style={styles.statusRow}><Text style={styles.title}>Notifications</Text><Text style={styles.status}>{info?.connected ? 'Connected' : info?.permission === 'denied' ? 'Blocked' : 'Not connected'}</Text></View>
    <Text style={styles.body}>{info?.description ?? 'Checking notification support…'}</Text>
    {Platform.OS === 'web' ? <Text style={styles.body}>When Gawin is closed, reminders use your phone’s notification sound. Manage Sounds and Focus in your phone settings. The Alarm sound switch in Clock controls only the in-app alarm.</Text> : null}
    {info?.supported && info.configured && !info.connected ? <>
      {Platform.OS === 'web' ? <Text style={styles.body}>Only reminder times and this device’s notification subscription are shared. Task titles stay private unless you choose to show them.</Text> : null}
      <Pressable accessibilityRole="button" accessibilityState={{ busy: reminders.busy }} disabled={reminders.busy || !reminders.online || info.permission === 'denied'} onPress={() => void run(reminders.connect, 'Notifications enabled on this device. Your reminders will now sync.')} style={[styles.primary, (reminders.busy || !reminders.online || info.permission === 'denied') && styles.disabled]}><Text style={styles.primaryText}>{reminders.busy ? 'Connecting…' : 'Enable notifications'}</Text></Pressable>
    </> : null}
    {info?.connected ? <>
      <Pressable accessibilityRole="switch" accessibilityState={{ checked: info.showTitles, disabled: reminders.busy }} disabled={reminders.busy} onPress={() => void run(() => reminders.privacy(!info.showTitles), reminders.online ? 'Notification privacy updated.' : 'Saved here. Background changes will sync when connected.')} style={styles.row}>
        <Text style={styles.title}>Show task titles</Text><View style={[styles.checkbox, info.showTitles && styles.checked]}><Text style={styles.check}>{info.showTitles ? '✓' : ''}</Text></View>
      </Pressable>
      <Text style={styles.body}>Off keeps notification text private, including while Gawin is locked.</Text>
      <Pressable accessibilityRole="button" disabled={reminders.busy || !reminders.online} onPress={() => void run(reminders.test, 'Test sent. Check your notifications.')} style={[styles.row, (reminders.busy || !reminders.online) && styles.disabled]}><Text style={styles.link}>Send test notification</Text><Text style={styles.arrow}>→</Text></Pressable>
      {Platform.OS === 'web' ? <Pressable accessibilityRole="button" disabled={reminders.busy || !reminders.online} onPress={() => void run(reminders.disconnect, 'Background reminders disconnected on this device.')} style={[styles.row, (reminders.busy || !reminders.online) && styles.disabled]}><Text style={styles.link}>Disconnect reminders</Text><Text style={styles.arrow}>→</Text></Pressable> : null}
    </> : null}
    {!reminders.online ? <Text style={styles.body}>Offline. New reminders and cancellations are waiting for connection.</Text> : null}
    {reminders.syncError ? <><Text style={styles.body}>{reminders.syncError}</Text><Pressable accessibilityRole="button" disabled={reminders.busy || !reminders.online} onPress={reminders.retry} style={[styles.row, (reminders.busy || !reminders.online) && styles.disabled]}><Text style={styles.link}>Retry reminder sync</Text><Text style={styles.arrow}>→</Text></Pressable></> : null}
    {message ? <Text accessibilityLiveRegion="polite" style={styles.message}>{message}</Text> : null}
    {Platform.OS === 'web' && info?.connected ? <Text style={styles.body}>The nearest 100 reminders within a year sync for background delivery. Others stay in-app and sync as space becomes available.</Text> : null}
    <Text style={styles.body}>Reminders are notifications, not guaranteed alarms. Delivery can be delayed and follows your phone’s Focus and notification settings.</Text>
  </View>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  title: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: colors.textSecondary }, statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 18 }, status: { fontFamily: 'SpaceMono_400Regular', fontSize: 9, color: colors.textMuted },
  body: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 18, color: colors.textMuted, marginTop: 8 }, row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderColor: colors.border, gap: 10 },
  link: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textSecondary, textDecorationLine: 'underline' }, arrow: { color: colors.textMuted, fontSize: 14 },
  checkbox: { width: 18, height: 18, borderWidth: 1, borderColor: colors.borderStrong, justifyContent: 'center', alignItems: 'center' }, checked: { backgroundColor: colors.accent, borderColor: colors.accent }, check: { color: colors.accentText, fontSize: 12 },
  primary: { minHeight: 48, backgroundColor: colors.accent, justifyContent: 'center', alignItems: 'center', marginTop: 18 }, primaryText: { color: colors.accentText, fontFamily: 'SpaceMono_700Bold', fontSize: 11 },
  disabled: { opacity: 0.45 }, message: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 18, color: colors.textSecondary, marginTop: 14 },
});
