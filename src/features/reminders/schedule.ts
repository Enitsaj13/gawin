import type { TaskSchedule, Todo } from '../todos/types';
import type { RemoteReminder, RemoteStatus } from './types';

export const REMINDER_OPTIONS = [0, 5, 10, 15, 30] as const;
export const REMINDER_GRACE = 15 * 60_000;
export const MAX_BACKGROUND_REMINDERS = 100;
export const REMINDER_HORIZON = 366 * 86400_000;
export function needsReminderStatusRefresh(desired: RemoteReminder[], acknowledged: RemoteStatus[], now = Date.now()) {
  return desired.some((row) => row.dueAt <= now && !acknowledged.some((item) =>
    item.id === row.id && item.version === row.version && ['sent', 'failed'].includes(item.status)));
}
export function currentTimeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
export function validTime(value: unknown): value is string { return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value); }
function wallParts(instant: number, zone: string) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(instant).filter((part) => part.type !== 'literal').map((part) => [part.type, Number(part.value)]));
}
export function scheduledInstant(date: string, time: string, zone: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTime(time)) throw new Error('Choose a valid date and time.');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  const matches = (candidate: number) => {
    const parts = wallParts(candidate, zone);
    return parts.year === year && parts.month === month && parts.day === day && parts.hour === hour && parts.minute === minute;
  };
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = wallParts(instant, zone);
    instant += target - Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  }
  if (!matches(instant)) throw new Error('That time is skipped by a clock change. Choose another time.');
  // Prefer the first occurrence of a repeated wall-clock time at a DST change.
  for (const offset of [-120, -90, -60, -30]) if (matches(instant + offset * 60_000)) return new Date(instant + offset * 60_000).toISOString();
  return new Date(instant).toISOString();
}
export function reminderLabel(minutes: number) { return minutes === 0 ? 'At start' : `${minutes} minutes before`; }
export function formatTaskTime(task: TaskSchedule) {
  if (!task.scheduledAt) return '';
  return new Date(task.scheduledAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: task.timeZone, ...(task.timeZone && task.timeZone !== currentTimeZone() ? { timeZoneName: 'short' as const } : {}) });
}
export function nextTimedTask(tasks: Todo[], now = Date.now()) {
  return tasks.filter((task) => !task.completed && task.scheduledAt && Date.parse(task.scheduledAt) >= now)
    .sort((first, second) => Date.parse(first.scheduledAt!) - Date.parse(second.scheduledAt!))[0];
}
export function reminderKey(task: Pick<Todo, 'id' | 'reminderAt'>) { return `${task.id}|${task.reminderAt}`; }
export function activeReminders(tasks: Todo[], now = Date.now()) {
  return tasks.filter((task) => !task.completed && task.reminderAt && Date.parse(task.reminderAt) + REMINDER_GRACE > now);
}
export function backgroundReminders(tasks: Todo[], now = Date.now()) {
  return activeReminders(tasks, now)
    .filter((task) => Date.parse(task.reminderAt!) <= now + REMINDER_HORIZON)
    .sort((first, second) => Date.parse(first.reminderAt!) - Date.parse(second.reminderAt!))
    .slice(0, MAX_BACKGROUND_REMINDERS);
}
export function moveTaskDate(task: Todo, date: string): Todo {
  if (date === task.date) return task;
  const next = { ...task, date };
  delete next.reminderAt;
  if (task.scheduledTime && task.timeZone) {
    try {
      next.scheduledAt = scheduledInstant(date, task.scheduledTime, task.timeZone);
      if (task.reminderMinutes !== undefined) next.reminderAt = new Date(Date.parse(next.scheduledAt) - task.reminderMinutes * 60_000).toISOString();
    } catch { delete next.scheduledAt; delete next.scheduledTime; delete next.reminderMinutes; delete next.timeZone; }
  }
  return next;
}

export function resolveSchedule(value: TaskSchedule, date: string, originalDate: string, initial: TaskSchedule): TaskSchedule {
  const result: TaskSchedule = {
    scheduledTime: value.scheduledTime, scheduledAt: value.scheduledAt, timeZone: value.timeZone,
    reminderAt: value.reminderAt, reminderMinutes: value.reminderMinutes,
  };
  if (value.scheduledTime) {
    result.timeZone = value.timeZone ?? currentTimeZone();
    result.scheduledAt = date === originalDate && value.scheduledTime === initial.scheduledTime && initial.scheduledAt && value.timeZone === initial.timeZone
      ? initial.scheduledAt : scheduledInstant(date, value.scheduledTime, result.timeZone);
    if (value.reminderMinutes !== undefined) {
      result.reminderAt = new Date(Date.parse(result.scheduledAt) - value.reminderMinutes * 60_000).toISOString();
      if (Date.parse(result.reminderAt) <= Date.now() && result.reminderAt !== initial.reminderAt) throw new Error('That reminder time has passed. Choose another time or turn the reminder off.');
      if (Date.parse(result.reminderAt) > Date.now() + REMINDER_HORIZON) throw new Error('Reminders can be scheduled up to a year ahead.');
    }
  } else if (date !== originalDate) { delete result.reminderAt; }
  return result;
}

export function quickReminderOptions(scheduledAt?: string, now = Date.now()) {
  const start = scheduledAt ? Date.parse(scheduledAt) : NaN;
  if (Number.isFinite(start)) return REMINDER_OPTIONS.filter((minutes) => minutes === 0 || minutes === 5)
    .map((minutes) => ({ label: reminderLabel(minutes), dueAt: start - minutes * 60_000 }))
    .filter((option) => option.dueAt > now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return [
    { label: 'In 1 hour', dueAt: now + 60 * 60_000 },
    { label: 'Tomorrow morning', dueAt: tomorrow.getTime() },
  ].sort((a, b) => a.dueAt - b.dueAt);
}
