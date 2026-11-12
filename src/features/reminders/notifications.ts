import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState } from 'react-native';
import type { NotificationInfo, ReminderEvent, RemoteReminder, RemoteStatus } from './types';

export const supportsAlarmSound = false;
export function isOnline() { return true; }
export async function notificationInfo(): Promise<NotificationInfo> {
  const permission = await Notifications.getPermissionsAsync();
  const settings = await AsyncStorage.getItem('gawin.notification-preferences.v1');
  return { supported: true, connected: permission.granted, permission: permission.status, configured: true,
    showTitles: settings ? JSON.parse(settings).showTitles === true : false,
    description: 'Native reminders are scheduled on this device and can alert you while Gawin is closed.' };
}
export async function connectNotifications(_code: string) {
  if (!(await Notifications.requestPermissionsAsync()).granted) throw new Error('Allow notifications in device Settings to receive reminders.');
}
export async function disconnectNotifications() { throw new Error('Manage notification permission in your phone Settings.'); }
export async function setNotificationPrivacy(showTitles: boolean) { await AsyncStorage.setItem('gawin.notification-preferences.v1', JSON.stringify({ showTitles })); }
export async function testNotification() { await Notifications.scheduleNotificationAsync({ content: { title: 'Gawin', body: 'Reminders are ready on this device.', sound: 'default' }, trigger: null }); }
export async function synchronizeReminders(_rows: RemoteReminder[]): Promise<RemoteStatus[]> { return []; }
export async function fetchReminderStatuses(): Promise<RemoteStatus[]> { return []; }
export async function reminderVersion(row: Omit<RemoteReminder, 'version'>) { return JSON.stringify(row); }
export function persistOutbox(_rows: RemoteReminder[]) { /* Native reminders stay local. */ }
export async function wasPresented(key: string) { return Boolean(await AsyncStorage.getItem(`gawin.reminder-receipt.${key}`)); }
export async function markPresented(key: string) { await AsyncStorage.setItem(`gawin.reminder-receipt.${key}`, String(Date.now())); }
export function notificationEvents(handler: (event: ReminderEvent) => void) {
  const response = (value: Notifications.NotificationResponse) => {
    const data = value.notification.request.content.data;
    if (typeof data?.taskId === 'string') {
      handler({ type: 'open', taskId: data.taskId });
      Notifications.clearLastNotificationResponse();
    }
  };
  const subscription = Notifications.addNotificationResponseReceivedListener(response);
  const last = Notifications.getLastNotificationResponse();
  if (last) response(last);
  return () => subscription.remove();
}
export async function enableAlarmSound() { /* Native notifications control their own audio. */ }
export function playAlarmSound() { /* Native notifications control their own audio. */ }
export function stopAlarmSound() { /* Native notifications control their own audio. */ }
export function previewAlarmSound() { /* Native notifications control their own audio. */ }
export function notificationBody(title: string, showTitles: boolean) { return showTitles ? title : 'You have an upcoming task.'; }
export function foregroundActive() { return AppState.currentState === 'active'; }
