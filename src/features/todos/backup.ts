import { fromDateKey, toDateKey } from '@/lib/date';
import { REMINDER_OPTIONS, scheduledInstant, validTime } from '@/features/reminders/schedule';

import type { RepeatRule, Todo } from './types';

export const BACKUP_FORMAT = 'gawin-backup';
export const BACKUP_SCHEMA_VERSION = 2;

const LEGACY_BACKUP_FORMATS = ['todo-journal-backup'];

const MAX_BACKUP_ITEMS = 50_000;
const MAX_ID_LENGTH = 200;
const MAX_TITLE_LENGTH = 80;

export type TodoBackup = {
  format: typeof BACKUP_FORMAT;
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  exportedAt: string;
  tasks: Todo[];
  repeatRules: RepeatRule[];
};

export type RestoreMode = 'merge' | 'replace';

export class BackupValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupValidationError';
  }
}

export function createTodoBackup(
  tasks: Todo[],
  repeatRules: RepeatRule[],
): TodoBackup {
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tasks: tasks.map((task) => ({ ...task })),
    repeatRules: repeatRules.map((rule) => ({ ...rule })),
  };
}

export function parseTodoBackup(content: string): TodoBackup {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new BackupValidationError('This file does not contain valid JSON.');
  }

  if (!isRecord(parsed)) {
    throw new BackupValidationError('This is not a Gawin backup.');
  }

  if (
    parsed.format !== BACKUP_FORMAT &&
    !LEGACY_BACKUP_FORMATS.includes(String(parsed.format))
  ) {
    throw new BackupValidationError('This is not a Gawin backup.');
  }

  if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    if (
      typeof parsed.schemaVersion === 'number' &&
      parsed.schemaVersion > BACKUP_SCHEMA_VERSION
    ) {
      throw new BackupValidationError(
        'This backup was created by a newer version of the app.',
      );
    }

    throw new BackupValidationError('This backup version is not supported.');
  }

  if (
    typeof parsed.exportedAt !== 'string' ||
    Number.isNaN(Date.parse(parsed.exportedAt))
  ) {
    throw new BackupValidationError('The backup date is invalid.');
  }

  if (!Array.isArray(parsed.tasks) || !Array.isArray(parsed.repeatRules)) {
    throw new BackupValidationError('The backup data is incomplete.');
  }

  if (
    parsed.tasks.length > MAX_BACKUP_ITEMS ||
    parsed.repeatRules.length > MAX_BACKUP_ITEMS
  ) {
    throw new BackupValidationError('This backup contains too many items.');
  }

  const tasks = parsed.tasks.map((task, index) => validateTask(task, index));
  const repeatRules = parsed.repeatRules.map((rule, index) =>
    validateRepeatRule(rule, index),
  );

  ensureUniqueIds(tasks, 'task');
  ensureUniqueIds(repeatRules, 'repeat rule');

  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date(parsed.exportedAt).toISOString(),
    tasks,
    repeatRules,
  };
}

export function mergeTodoBackup(
  localTasks: Todo[],
  localRepeatRules: RepeatRule[],
  backup: TodoBackup,
) {
  const localTaskIds = new Set(localTasks.map((task) => task.id));
  const localRuleIds = new Set(localRepeatRules.map((rule) => rule.id));

  return {
    todos: [
      ...localTasks,
      ...backup.tasks.filter((task) => !localTaskIds.has(task.id)),
    ],
    repeatRules: [
      ...localRepeatRules,
      ...backup.repeatRules.filter((rule) => !localRuleIds.has(rule.id)),
    ],
  };
}

function validateTask(value: unknown, index: number): Todo {
  if (!isRecord(value)) {
    throw new BackupValidationError(`Task ${index + 1} is invalid.`);
  }

  const task: Todo = {
    id: validateId(value.id, `Task ${index + 1}`),
    title: validateTitle(value.title, `Task ${index + 1}`),
    completed: validateBoolean(value.completed, `Task ${index + 1}`),
    date: validateDate(value.date, `Task ${index + 1}`),
  };

  if (value.recurrenceId !== undefined) {
    task.recurrenceId = validateId(
      value.recurrenceId,
      `Task ${index + 1} recurrence`,
    );
  }

  if (value.reminderAt !== undefined) {
    if (
      typeof value.reminderAt !== 'string' ||
      Number.isNaN(Date.parse(value.reminderAt))
    ) {
      throw new BackupValidationError(
        `Task ${index + 1} has an invalid reminder.`,
      );
    }
    task.reminderAt = new Date(value.reminderAt).toISOString();
  }

  if (value.scheduledTime !== undefined || value.scheduledAt !== undefined || value.timeZone !== undefined) {
    if (!validTime(value.scheduledTime) || typeof value.scheduledAt !== 'string' || !Number.isFinite(Date.parse(value.scheduledAt)) || typeof value.timeZone !== 'string' || value.timeZone.length > 100) throw new BackupValidationError(`Task ${index + 1} has an invalid scheduled time.`);
    try {
      scheduledInstant(task.date, value.scheduledTime, value.timeZone);
      const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: value.timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value.scheduledAt)).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
      if (`${parts.year}-${parts.month}-${parts.day}` !== task.date || `${parts.hour}:${parts.minute}` !== value.scheduledTime) throw new Error();
    } catch { throw new BackupValidationError(`Task ${index + 1} has inconsistent date and time information.`); }
    task.scheduledTime = value.scheduledTime; task.scheduledAt = value.scheduledAt; task.timeZone = value.timeZone;
  }
  if (value.reminderMinutes !== undefined) {
    if (!REMINDER_OPTIONS.includes(value.reminderMinutes as typeof REMINDER_OPTIONS[number]) || !task.scheduledAt || !task.reminderAt || Date.parse(task.reminderAt) !== Date.parse(task.scheduledAt) - Number(value.reminderMinutes) * 60_000) throw new BackupValidationError(`Task ${index + 1} has an invalid reminder offset.`);
    task.reminderMinutes = Number(value.reminderMinutes);
  }

  return task;
}

function validateRepeatRule(value: unknown, index: number): RepeatRule {
  if (!isRecord(value)) {
    throw new BackupValidationError(`Repeat rule ${index + 1} is invalid.`);
  }

  const rule: RepeatRule = {
    id: validateId(value.id, `Repeat rule ${index + 1}`),
    title: validateTitle(value.title, `Repeat rule ${index + 1}`),
    lastCreatedDate: validateDate(
      value.lastCreatedDate,
      `Repeat rule ${index + 1}`,
    ),
    active: validateBoolean(value.active, `Repeat rule ${index + 1}`),
  };

  if (value.daysOfWeek !== undefined) {
    if (
      !Array.isArray(value.daysOfWeek) ||
      !value.daysOfWeek.length ||
      value.daysOfWeek.some(
        (day) => !Number.isInteger(day) || day < 0 || day > 6,
      )
    ) {
      throw new BackupValidationError(
        `Repeat rule ${index + 1} has an invalid schedule.`,
      );
    }
    rule.daysOfWeek = [...new Set(value.daysOfWeek as number[])].sort();
  }

  return rule;
}

function validateId(value: unknown, label: string) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > MAX_ID_LENGTH
  ) {
    throw new BackupValidationError(`${label} has an invalid identifier.`);
  }

  return value;
}

function validateTitle(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new BackupValidationError(`${label} has an invalid title.`);
  }

  const title = value.trim();
  if (!title || title.length > MAX_TITLE_LENGTH) {
    throw new BackupValidationError(`${label} has an invalid title.`);
  }

  return title;
}

function validateBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new BackupValidationError(`${label} contains invalid data.`);
  }

  return value;
}

function validateDate(value: unknown, label: string) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new BackupValidationError(`${label} has an invalid date.`);
  }

  const date = fromDateKey(value);
  if (Number.isNaN(date.getTime()) || toDateKey(date) !== value) {
    throw new BackupValidationError(`${label} has an invalid date.`);
  }

  return value;
}

function ensureUniqueIds(items: { id: string }[], label: string) {
  const ids = new Set<string>();

  for (const item of items) {
    if (ids.has(item.id)) {
      throw new BackupValidationError(
        `The backup contains a duplicate ${label}.`,
      );
    }
    ids.add(item.id);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
