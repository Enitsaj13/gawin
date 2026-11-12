import assert from 'node:assert/strict';
import { test } from 'node:test';
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { activeReminders, backgroundReminders, moveTaskDate, needsReminderStatusRefresh, nextTimedTask, quickReminderOptions, resolveSchedule, scheduledInstant } from '../src/features/reminders/schedule.ts';

registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) return next(new URL(`../src/${specifier.slice(2)}.ts`, import.meta.url).href, context);
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const path = resolve(dirname(fileURLToPath(context.parentURL)), `${specifier}.ts`);
    if (existsSync(path)) return next(pathToFileURL(path).href, context);
  }
  return next(specifier, context);
} });
const { createTodoBackup, parseTodoBackup } = await import('../src/features/todos/backup.ts');

test('a task uses its chosen timezone, including midnight and non-hour offsets', () => {
  assert.equal(scheduledInstant('2027-01-12', '15:00', 'Asia/Manila'), '2027-01-12T07:00:00.000Z');
  assert.equal(scheduledInstant('2027-01-12', '00:00', 'Asia/Manila'), '2027-01-11T16:00:00.000Z');
  assert.equal(scheduledInstant('2027-01-12', '15:00', 'Asia/Kathmandu'), '2027-01-12T09:15:00.000Z');
  assert.throws(() => scheduledInstant('2027-02-30', '15:00', 'Asia/Manila'));
});
test('DST gaps are rejected and ambiguous times use the earlier occurrence', () => {
  assert.throws(() => scheduledInstant('2027-03-14', '02:30', 'America/New_York'));
  assert.equal(scheduledInstant('2027-11-07', '01:30', 'America/New_York'), '2027-11-07T05:30:00.000Z');
});
test('schedule editing never overwrites a task title, ID or date with old values', (t) => {
  t.mock.method(Date, 'now', () => Date.parse('2027-01-01T00:00:00Z'));
  const value = { id: 'old-id', title: 'Old name', date: '2027-01-11', scheduledTime: '15:00', timeZone: 'Asia/Manila', reminderMinutes: 10 };
  const schedule = resolveSchedule(value, '2027-01-12', '2027-01-11', {});
  assert.equal(schedule.scheduledAt, '2027-01-12T07:00:00.000Z');
  assert.equal(schedule.reminderAt, '2027-01-12T06:50:00.000Z');
  assert.equal(schedule.id, undefined); assert.equal(schedule.title, undefined); assert.equal(schedule.date, undefined);
  assert.throws(() => resolveSchedule({ scheduledTime: '15:00', timeZone: 'UTC', reminderMinutes: 0 }, '2020-01-01', '2020-01-01', {}));
});
test('moving a timed task retains its wall time and recomputes its reminder', () => {
  const task = { id: 'a', title: 'Meeting', completed: false, date: '2027-01-12', scheduledTime: '15:00', timeZone: 'Asia/Manila', scheduledAt: '2027-01-12T07:00:00.000Z', reminderMinutes: 10, reminderAt: '2027-01-12T06:50:00.000Z' };
  const moved = moveTaskDate(task, '2027-01-13');
  assert.equal(moved.scheduledAt, '2027-01-13T07:00:00.000Z');
  assert.equal(moved.reminderAt, '2027-01-13T06:50:00.000Z');
  assert.equal(task.date, '2027-01-12');
  const backup = parseTodoBackup(JSON.stringify(createTodoBackup([moved], [])));
  assert.deepEqual(backup.tasks[0], moved);
  const invalid = { ...moved, scheduledTime: '16:00' };
  assert.throws(() => parseTodoBackup(JSON.stringify(createTodoBackup([invalid], []))));
  const legacy = { id: 'legacy', title: 'Untimed', date: '2027-01-12', completed: false };
  assert.deepEqual(parseTodoBackup(JSON.stringify(createTodoBackup([legacy], []))).tasks[0], legacy);
});
test('next task ignores completed or past tasks and does not reorder the list', () => {
  const tasks = [
    { id: 'later', completed: false, scheduledAt: '2027-01-12T09:00:00Z', reminderAt: '2027-01-12T08:50:00Z' },
    { id: 'done', completed: true, scheduledAt: '2027-01-12T08:00:00Z', reminderAt: '2027-01-12T07:50:00Z' },
    { id: 'past', completed: false, scheduledAt: '2027-01-12T06:00:00Z', reminderAt: '2027-01-12T05:50:00Z' },
  ];
  const now = Date.parse('2027-01-12T07:00:00Z');
  assert.equal(nextTimedTask(tasks, now).id, 'later');
  assert.deepEqual(tasks.map((task) => task.id), ['later', 'done', 'past']);
  assert.deepEqual(activeReminders(tasks, now).map((task) => task.id), ['later']);
});
test('background delivery selects the nearest 100 reminders without losing local tasks', () => {
  const now = Date.parse('2027-01-12T07:00:00Z');
  const tasks = Array.from({ length: 102 }, (_, index) => ({ id: String(index), completed: false, reminderAt: new Date(now + (102 - index) * 60_000).toISOString() }));
  const distant = { id: 'distant', completed: false, reminderAt: new Date(now + 367 * 86400_000).toISOString() };
  const selected = backgroundReminders([...tasks, distant], now);
  assert.equal(selected.length, 100);
  assert.equal(selected[0].id, '101');
  assert.equal(selected.at(-1).id, '2');
  assert.equal(tasks[0].id, '0');
  assert.deepEqual(backgroundReminders([distant], now), []);
});
test('delivery status polling waits until due and stops when the matching schedule is terminal', () => {
  const desired = [{ id: 'task', version: 'latest', dueAt: 10_000 }];
  assert.equal(needsReminderStatusRefresh(desired, [], 9_999), false);
  assert.equal(needsReminderStatusRefresh(desired, [], 10_000), true);
  assert.equal(needsReminderStatusRefresh(desired, [{ ...desired[0], status: 'queued' }], 10_000), true);
  assert.equal(needsReminderStatusRefresh(desired, [{ ...desired[0], status: 'sent' }], 10_000), false);
  assert.equal(needsReminderStatusRefresh(desired, [{ ...desired[0], status: 'failed' }], 10_000), false);
  assert.equal(needsReminderStatusRefresh(desired, [{ ...desired[0], version: 'old', status: 'sent' }], 10_000), true);
  assert.equal(needsReminderStatusRefresh([], [], 10_000), false);
});

test('untimed quick reminders use honest labels and chronological future dates after midnight approaches', () => {
  const now = new Date(2026, 10, 12, 23, 30).getTime();
  const options = quickReminderOptions(undefined, now);
  assert.deepEqual(options.map((item) => item.label), ['In 1 hour', 'Tomorrow morning']);
  assert.equal(options[0].dueAt, now + 3600000);
  assert.equal(new Date(options[1].dueAt).getHours(), 9);
  assert.equal(new Date(options[1].dueAt).getDate(), 13);
  assert.ok(options.every((item) => item.dueAt > now));
});
test('timed quick reminders use the task instant and exclude passed offsets', () => {
  const now = Date.parse('2026-11-12T12:00:00Z');
  const start = new Date(now + 10 * 60000).toISOString();
  assert.deepEqual(quickReminderOptions(start, now).map((item) => item.dueAt), [now + 10 * 60000, now + 5 * 60000]);
  assert.deepEqual(quickReminderOptions(start, now + 6 * 60000).map((item) => item.label), ['At start']);
  assert.deepEqual(quickReminderOptions(start, now + 10 * 60000), []);
});
