const timers = new Map<string, ReturnType<typeof setTimeout>>();

export async function scheduleTaskReminder(
  title: string,
  reminderAt: string,
  requestPermission: boolean,
) {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  let permission = Notification.permission;
  if (permission === 'default' && requestPermission) {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') return null;

  const identifier = `web-reminder-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
  const delay = Math.max(new Date(reminderAt).getTime() - Date.now(), 0);
  const timer = setTimeout(() => {
    void showWebNotification(title);
    timers.delete(identifier);
  }, delay);
  timers.set(identifier, timer);
  return identifier;
}

async function showWebNotification(title: string) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification('Gawin', { body: title });
      return;
    }

    new Notification('Gawin', { body: title });
  } catch {
    // Browsers can revoke permission or restrict notifications at any time.
  }
}

export async function cancelTaskReminder(identifier: string) {
  const timer = timers.get(identifier);
  if (timer) clearTimeout(timer);
  timers.delete(identifier);
}

export async function getScheduledReminderIds() {
  return new Set<string>();
}
