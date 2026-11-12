export type ReminderStatus = 'scheduled' | 'pending' | 'failed' | 'sent' | 'expired' | 'setup' | 'limited';
export type NotificationInfo = { supported: boolean; connected: boolean; permission: string; configured: boolean; description: string; showTitles: boolean };
export type RemoteReminder = { id: string; version: string; dueAt: number; body?: string };
export type RemoteStatus = { id: string; version: string; dueAt: number; status: string };
export type ReminderEvent = { type: 'reminder' | 'open'; taskId: string; reminderAt?: string };
