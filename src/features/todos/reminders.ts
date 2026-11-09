import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
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
) {
  const existing = await Notifications.getPermissionsAsync();
  const permission =
    existing.status === 'granted' || !requestPermission
      ? existing
      : await Notifications.requestPermissionsAsync();

  if (permission.status !== 'granted') return null;

  await ensureAndroidChannel();
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Gawin',
      body: title,
      data: { url: '/' },
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
