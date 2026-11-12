// Web reminders are reconciled by RemindersProvider and the push service worker.
export async function scheduleTaskReminder(_title: string, _reminderAt: string, _requestPermission: boolean, _taskId?: string): Promise<string | null> { return null; }
export async function cancelTaskReminder(_identifier: string) { /* No in-page notification timers. */ }
export async function getScheduledReminderIds() { return new Set<string>(); }
