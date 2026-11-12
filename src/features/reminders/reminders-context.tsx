import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useAppLock } from '@/features/app-lock/app-lock-context';
import { useTodos } from '@/features/todos/todos-context';
import type { Todo } from '@/features/todos/types';
import * as notifications from './notifications';
import { activeReminders, backgroundReminders, needsReminderStatusRefresh, reminderKey, REMINDER_GRACE } from './schedule';
import type { NotificationInfo, ReminderStatus, RemoteReminder, RemoteStatus } from './types';

type ReminderContext = {
  info: NotificationInfo | null; online: boolean; syncError: string; busy: boolean; soundEnabled: boolean;
  activeTask: Todo | null; openTaskId: string | null;
  status: (todo: Todo) => ReminderStatus | undefined;
  connect: () => Promise<void>; disconnect: () => Promise<void>; test: () => Promise<void>;
  privacy: (show: boolean) => Promise<void>; retry: () => void; dismiss: () => void; snooze: () => Promise<void>;
  enableSound: () => Promise<void>; disableSound: () => void; previewSound: () => void; consumeOpenTask: () => void;
};
const Context = createContext<ReminderContext | null>(null);
export function RemindersProvider({ children }: PropsWithChildren) {
  const { todos, isReady, scheduledReminderIds, refreshReminders, setTodoReminder } = useTodos();
  const lock = useAppLock();
  const [info, setInfo] = useState<NotificationInfo | null>(null);
  const [online, setOnline] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [busy, setBusy] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [active, setActive] = useState<{ id: string; reminderAt: string } | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [desired, setDesired] = useState<RemoteReminder[]>([]);
  const [desiredReady, setDesiredReady] = useState(false);
  const [acknowledged, setAcknowledged] = useState<RemoteStatus[]>([]);
  const [retry, setRetry] = useState(Date.now);
  const eligibleReminders = useMemo(() => backgroundReminders(todos, retry), [todos, retry]);
  const syncing = useRef(false);
  const syncAgain = useRef(false);
  const ackFingerprint = useRef('');
  const latestAcknowledged = useRef<RemoteStatus[]>([]);
  const source = useRef({ todos, unlocked: false, sound: false, active: null as typeof active });
  const presenting = useRef(false);
  const received = useRef(new Set<string>());
  const isForeground = () => Platform.OS === 'web' ? document.visibilityState === 'visible' : AppState.currentState === 'active';

  const refreshInfo = useCallback(async () => {
    try { setInfo(await notifications.notificationInfo()); } catch { setSyncError('Notification settings could not load. Please try again.'); }
    setOnline(notifications.isOnline());
  }, []);
  useEffect(() => { void Promise.resolve().then(refreshInfo); }, [refreshInfo]);
  useEffect(() => {
    source.current = { todos, unlocked: lock.ready && !lock.storageError && !lock.devicePromptActive && !(lock.enabled && (lock.locked || lock.covered)), sound: soundEnabled, active };
    if (!source.current.unlocked) notifications.stopAlarmSound();
  }, [active, lock.covered, lock.devicePromptActive, lock.enabled, lock.locked, lock.ready, lock.storageError, soundEnabled, todos]);

  useEffect(() => {
    if (!isReady) return;
    let cancelled = false;
    void (async () => {
      const rows = await Promise.all(eligibleReminders.map(async (task) => {
          const row = { id: task.id, dueAt: Date.parse(task.reminderAt!), ...(info?.showTitles ? { body: task.title } : {}) };
          return { ...row, version: await notifications.reminderVersion(row) };
        }));
      if (cancelled) return;
      notifications.persistOutbox(rows);
      setDesired((current) => JSON.stringify(current) === JSON.stringify(rows) ? current : rows);
      setDesiredReady(true);
    })().catch(() => { if (!cancelled) setSyncError('Reminder changes could not be saved. Please retry.'); });
    return () => { cancelled = true; };
  }, [eligibleReminders, info?.showTitles, isReady]);

  const synchronize = useCallback(async () => {
    if (Platform.OS !== 'web' || !isReady || !desiredReady || !info?.connected || !notifications.isOnline()) return;
    if (syncing.current) { syncAgain.current = true; return; }
    syncing.current = true;
    const fingerprint = JSON.stringify(desired);
    try {
      // A confirmed future schedule needs no polling until a delivery is due.
      if (fingerprint === ackFingerprint.current && !needsReminderStatusRefresh(desired, latestAcknowledged.current)) return;
      const statuses = fingerprint === ackFingerprint.current ? await notifications.fetchReminderStatuses() : await notifications.synchronizeReminders(desired);
      setAcknowledged(statuses);
      latestAcknowledged.current = statuses;
      ackFingerprint.current = fingerprint;
      setSyncError('');
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Reminders could not sync. Please retry.');
      void refreshInfo();
    } finally {
      syncing.current = false;
      if (syncAgain.current) { syncAgain.current = false; setRetry((value) => Math.max(Date.now(), value + 1)); }
    }
  }, [desired, desiredReady, info?.connected, isReady, refreshInfo]);
  useEffect(() => {
    const timer = setTimeout(() => void synchronize(), 450);
    return () => clearTimeout(timer);
  }, [retry, synchronize]);
  useEffect(() => {
    const refresh = () => { void refreshInfo(); setRetry((value) => Math.max(Date.now(), value + 1)); };
    const timer = setInterval(() => { if (isForeground()) refresh(); }, 30_000);
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); else notifications.stopAlarmSound(); });
    if (Platform.OS === 'web') {
      const visibility = () => { if (isForeground()) refresh(); else notifications.stopAlarmSound(); };
      window.addEventListener('online', refresh); window.addEventListener('offline', refresh); document.addEventListener('visibilitychange', visibility);
      return () => { clearInterval(timer); listener.remove(); window.removeEventListener('online', refresh); window.removeEventListener('offline', refresh); document.removeEventListener('visibilitychange', visibility); };
    }
    return () => { clearInterval(timer); listener.remove(); };
  }, [refreshInfo]);

  useEffect(() => {
    const present = async (task: Todo, pushed: boolean) => {
      if (presenting.current || !source.current.unlocked || !isForeground() || !task.reminderAt) return false;
      const currentActive = source.current.active;
      if (currentActive && source.current.todos.some((item) => item.id === currentActive.id && !item.completed && item.reminderAt === currentActive.reminderAt)) return false;
      presenting.current = true;
      try {
        const key = reminderKey(task);
        if (await notifications.wasPresented(key) || !source.current.unlocked || !isForeground()) return false;
        await notifications.markPresented(key);
        if (!source.current.unlocked || !isForeground() || !source.current.todos.some((item) => item.id === task.id && !item.completed && item.reminderAt === task.reminderAt)) return false;
        source.current.active = { id: task.id, reminderAt: task.reminderAt };
        setActive({ id: task.id, reminderAt: task.reminderAt });
        if (source.current.sound && !pushed && !received.current.has(key)) notifications.playAlarmSound();
        return true;
      } catch { return false; }
      finally { presenting.current = false; }
    };
    const tick = () => {
      if (!source.current.unlocked || !isForeground()) return;
      const now = Date.now();
      const tasks = activeReminders(source.current.todos, now).filter((item) => Date.parse(item.reminderAt!) <= now).sort((a, b) => Date.parse(a.reminderAt!) - Date.parse(b.reminderAt!));
      void (async () => { for (const task of tasks) if (await present(task, false)) break; })();
    };
    const timer = setInterval(tick, 2000);
    const unsubscribe = notifications.notificationEvents((event) => {
      if (event.type === 'open') { setOpenTaskId(event.taskId); return; }
      const task = source.current.todos.find((item) => item.id === event.taskId && !item.completed && item.reminderAt === event.reminderAt);
      if (task) { received.current.add(reminderKey(task)); void present(task, true); }
    });
    return () => { clearInterval(timer); unsubscribe(); notifications.stopAlarmSound(); };
  }, []);

  const activeTask = active ? todos.find((task) => task.id === active.id && !task.completed && task.reminderAt === active.reminderAt) ?? null : null;
  useEffect(() => { if (!activeTask) notifications.stopAlarmSound(); }, [activeTask]);
  const dismiss = () => { notifications.stopAlarmSound(); source.current.active = null; setActive(null); };
  const snooze = async () => {
    if (activeTask) await setTodoReminder(activeTask.id, new Date(Date.now() + 5 * 60_000).toISOString());
    dismiss();
  };
  const action = async (operation: () => Promise<void>) => {
    setBusy(true);
    try { await operation(); ackFingerprint.current = ''; refreshReminders(); setRetry((value) => Math.max(Date.now(), value + 1)); }
    finally { await refreshInfo(); setBusy(false); }
  };
  const status = (todo: Todo): ReminderStatus | undefined => {
    if (!todo.reminderAt || todo.completed) return undefined;
    if (Date.parse(todo.reminderAt) + REMINDER_GRACE <= Date.now()) return 'expired';
    if (Platform.OS !== 'web') return scheduledReminderIds[todo.id] ? 'scheduled' : info?.connected ? 'pending' : 'setup';
    if (!info?.connected) return 'setup';
    if (!eligibleReminders.some((item) => item.id === todo.id)) return 'limited';
    const row = desired.find((item) => item.id === todo.id && item.dueAt === Date.parse(todo.reminderAt!) && item.body === (info?.showTitles ? todo.title : undefined));
    if (!row) return 'pending';
    const ack = acknowledged.find((item) => item.id === row.id && item.version === row.version);
    if (ack?.status === 'sent') return 'sent';
    if (ack?.status === 'failed') return 'failed';
    if (ack) return 'scheduled';
    return syncError && online ? 'failed' : 'pending';
  };

  return <Context.Provider value={{ info, online, syncError, busy, soundEnabled, activeTask, openTaskId, status,
    connect: () => action(() => notifications.connectNotifications()), disconnect: () => action(() => notifications.disconnectNotifications()),
    test: () => action(() => notifications.testNotification()), privacy: (show) => action(() => notifications.setNotificationPrivacy(show)),
    retry: () => { ackFingerprint.current = ''; setRetry((value) => Math.max(Date.now(), value + 1)); }, dismiss, snooze,
    enableSound: async () => { await notifications.enableAlarmSound(); setSoundEnabled(true); notifications.previewAlarmSound(); },
    disableSound: () => { notifications.stopAlarmSound(); setSoundEnabled(false); }, previewSound: notifications.previewAlarmSound,
    consumeOpenTask: () => setOpenTaskId(null),
  }}>{children}</Context.Provider>;
}
export function useReminders() {
  const context = useContext(Context);
  if (!context) throw new Error('Reminders provider is missing.');
  return context;
}
