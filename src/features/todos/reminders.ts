import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: AppState.currentState !== 'active',
    shouldSetBadge: false,
    shouldShowBanner: AppState.currentState !== 'active',
    shouldShowList: true,
  }),
});

async function ensureAndroidChannel() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('task-reminders', {
    name: 'Task reminders',
    importance: AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
  });
}

export async function scheduleTaskReminder(
  title: string,
  reminderAt: string,
  requestPermission: boolean,
  taskId?: string,
) {
  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted' || !requestPermission
      ? existing
      : await Notifications.requestPermissionsAsync();

  if (permission.status !== 'granted') return null;

  await ensureAndroidChannel();
  const preferences = await AsyncStorage.getItem('gawin.notification-preferences.v1');
  const showTitles = preferences ? JSON.parse(preferences).showTitles === true : false;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Gawin',
      body: showTitles ? title : 'You have an upcoming task.',
      sound: 'default',
      data: { url: '/', taskId, reminderAt },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(reminderAt),
      channelId: Platform.OS === 'android' ? 'task-reminders' : undefined,
    },
  });
}

export async function cancelTaskReminder(identifier: string) {
  await Notifications.cancelScheduledNotificationAsync(identifier);
}

export async function getScheduledReminderIds() {
  const notifications =
    await Notifications.getAllScheduledNotificationsAsync();
  return new Set(notifications.map((notification) => notification.identifier));
}
