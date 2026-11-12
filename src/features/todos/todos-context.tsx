import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, Platform } from 'react-native';

import { useToast } from '@/components/toast';
import { fromDateKey, shiftDateKey, todayKey } from '@/lib/date';
import { moveTaskDate } from '@/features/reminders/schedule';

import {
  createTodoBackup,
  mergeTodoBackup,
  RestoreMode,
  TodoBackup,
} from './backup';
import {
  cancelTaskReminder,
  getScheduledReminderIds,
  scheduleTaskReminder,
} from './reminders';
import { RepeatRule, TaskSchedule, Todo } from './types';

const STORAGE_KEY = 'gawin.tasks.v2';
const REPEAT_STORAGE_KEY = 'gawin.repeat-rules.v1';
const LEGACY_STORAGE_KEY = 'todo-journal.tasks.v2';
const LEGACY_REPEAT_STORAGE_KEY = 'todo-journal.repeat-rules.v1';
const REMINDER_IDS_STORAGE_KEY = 'gawin.reminder-ids.v1';
const LAST_REVIEW_DATE_STORAGE_KEY = 'gawin.last-review-date.v1';
const OBSOLETE_STORAGE_KEYS = ['todo-journal.tasks.v1'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

export type ReviewAction = 'delete' | 'keep' | 'move';

type TodosContextValue = {
  activeRepeatCount: number;
  dailyDefaults: RepeatRule[];
  isReady: boolean;
  today: string;
  todos: Todo[];
  pendingReviewTodos: Todo[];
  addDailyDefault: (title: string) => void;
  addTodo: (title: string, date: string, schedule?: TaskSchedule) => void;
  scheduledReminderIds: Record<string, string>;
  refreshReminders: () => void;
  clearTodoReminder: (id: string) => void;
  createBackup: () => TodoBackup;
  deleteTodo: (id: string) => void;
  deleteTodoSeries: (id: string) => void;
  deleteDailyDefault: (id: string) => void;
  duplicateTodo: (id: string) => void;
  editDailyDefault: (id: string, title: string) => void;
  editTodo: (id: string, title: string, updateSeries?: boolean, date?: string, schedule?: TaskSchedule) => void;
  getTodosForDate: (date: string) => Todo[];
  getRepeatDays: (todo: Todo) => number[] | null;
  isTodoRepeating: (todo: Todo) => boolean;
  moveTodoToToday: (id: string) => void;
  reorderTodo: (date: string, id: string, toIndex: number) => void;
  reorderDailyDefault: (id: string, toIndex: number) => void;
  repeatTodoTomorrow: (id: string) => void;
  reviewUnfinishedTodos: (action: ReviewAction, ids?: string[]) => void;
  restoreBackup: (backup: TodoBackup, mode: RestoreMode) => void;
  setTodoReminder: (id: string, reminderAt: string) => Promise<void>;
  startRepeat: (id: string, daysOfWeek: number[]) => void;
  stopRepeat: (id: string) => void;
  toggleDailyDefault: (id: string) => void;
  toggleTodo: (id: string) => void;
};

type TodosData = {
  todos: Todo[];
  repeatRules: RepeatRule[];
};

type ValueUpdater<T> = T | ((current: T) => T);

const TodosContext = createContext<TodosContextValue | null>(null);

function createId(prefix = 'task') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function applyUpdate<T>(update: ValueUpdater<T>, current: T) {
  return typeof update === 'function'
    ? (update as (value: T) => T)(current)
    : update;
}

function isDailyRule(rule: RepeatRule) {
  const days = rule.daysOfWeek ?? EVERY_DAY;
  return days.length === 7 && EVERY_DAY.every((day) => days.includes(day));
}

function ensureScheduledRepeats(data: TodosData, date: string): TodosData {
  const weekday = fromDateKey(date).getDay();
  const dueRules = data.repeatRules.filter(
    (rule) =>
      rule.active &&
      rule.lastCreatedDate < date &&
      (rule.daysOfWeek ?? EVERY_DAY).includes(weekday),
  );
  if (!dueRules.length) return data;

  const additions = dueRules
    .filter(
      (rule) =>
        !data.todos.some(
          (todo) => todo.recurrenceId === rule.id && todo.date === date,
        ),
    )
    .map<Todo>((rule) => ({
      id: createId(),
      title: rule.title,
      completed: false,
      date,
      recurrenceId: rule.id,
    }));
  const dueIds = new Set(dueRules.map((rule) => rule.id));

  return {
    todos: additions.length ? [...data.todos, ...additions] : data.todos,
    repeatRules: data.repeatRules.map((rule) =>
      dueIds.has(rule.id) ? { ...rule, lastCreatedDate: date } : rule,
    ),
  };
}

export function TodosProvider({ children }: PropsWithChildren) {
  const [data, setData] = useState<TodosData>({
    todos: [],
    repeatRules: [],
  });
  const [activeDate, setActiveDate] = useState(todayKey);
  const [isReady, setIsReady] = useState(false);
  const [lastReviewDate, setLastReviewDate] = useState('');
  const [reminderIds, setReminderIds] = useState<Record<string, string>>({});
  const [remindersReady, setRemindersReady] = useState(false);
  const schedulingReminderIdsRef = useRef(new Set<string>());
  const nativeSignatures = useRef<Record<string, string>>({});
  const [reminderRefresh, setReminderRefresh] = useState(0);
  const refreshReminders = useCallback(() => setReminderRefresh((value) => value + 1), []);
  const { showToast } = useToast();
  const { repeatRules, todos } = data;

  const setTodos = useCallback((update: ValueUpdater<Todo[]>) => {
    setData((current) => ({
      ...current,
      todos: applyUpdate(update, current.todos),
    }));
  }, []);

  const setRepeatRules = useCallback(
    (update: ValueUpdater<RepeatRule[]>) => {
      setData((current) => ({
        ...current,
        repeatRules: applyUpdate(update, current.repeatRules),
      }));
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    async function hydrate() {
      try {
        await AsyncStorage.multiRemove(OBSOLETE_STORAGE_KEYS);
        const storedValues = await AsyncStorage.multiGet([
          STORAGE_KEY,
          REPEAT_STORAGE_KEY,
          LEGACY_STORAGE_KEY,
          LEGACY_REPEAT_STORAGE_KEY,
          REMINDER_IDS_STORAGE_KEY,
          LAST_REVIEW_DATE_STORAGE_KEY,
        ]);
        if (!isMounted) return;

        const storedTodos = storedValues[0][1] ?? storedValues[2][1];
        const storedRepeatRules = storedValues[1][1] ?? storedValues[3][1];
        setData(
          ensureScheduledRepeats(
            {
              todos: storedTodos
                ? (JSON.parse(storedTodos) as Todo[])
                : [],
              repeatRules: storedRepeatRules
                ? (JSON.parse(storedRepeatRules) as RepeatRule[])
                : [],
            },
            todayKey(),
          ),
        );
        const scheduledIds = await getScheduledReminderIds().catch(
          () => new Set<string>(),
        );
        if (!isMounted) return;
        const storedReminderIds = storedValues[4][1]
          ? (JSON.parse(storedValues[4][1]) as Record<string, string>)
          : {};
        setReminderIds(
          Object.fromEntries(
            Object.entries(storedReminderIds).filter(([, identifier]) =>
              scheduledIds.has(identifier),
            ),
          ),
        );
        setLastReviewDate(storedValues[5][1] ?? '');
      } catch {
        if (isMounted) {
          setData({ todos: [], repeatRules: [] });
          setReminderIds({});
        }
      } finally {
        if (isMounted) {
          setRemindersReady(true);
          setIsReady(true);
        }
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const updateDate = () => {
      const date = todayKey();
      setActiveDate(date);
      setData((current) => ensureScheduledRepeats(current, date));
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') updateDate();
    });
    // Also advance Today when the app stays open across midnight.
    const timer = setInterval(updateDate, 30_000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.multiSet([
      [STORAGE_KEY, JSON.stringify(todos)],
      [REPEAT_STORAGE_KEY, JSON.stringify(repeatRules)],
    ]);
  }, [isReady, repeatRules, todos]);

  useEffect(() => {
    if (!remindersReady) return;
    void AsyncStorage.setItem(
      REMINDER_IDS_STORAGE_KEY,
      JSON.stringify(reminderIds),
    );
  }, [reminderIds, remindersReady]);

  useEffect(() => {
    if (Platform.OS === 'web' || !isReady || !remindersReady) return;

    const futureReminders = new Map(
      todos
        .filter(
          (todo) =>
            !todo.completed && todo.reminderAt && new Date(todo.reminderAt).getTime() > Date.now(),
        )
        .map((todo) => [todo.id, todo] as const),
    );

    for (const [todoId, identifier] of Object.entries(reminderIds)) {
      const task = futureReminders.get(todoId);
      if (task && nativeSignatures.current[todoId] === JSON.stringify([task.title, task.reminderAt, reminderRefresh])) continue;

      void cancelTaskReminder(identifier)
        .catch(() => undefined)
        .finally(() => {
          setReminderIds((current) => {
            if (current[todoId] !== identifier) return current;
            const next = { ...current };
            delete next[todoId];
            return next;
          });
        });
    }

    for (const todo of futureReminders.values()) {
      if (
        (reminderIds[todo.id] && nativeSignatures.current[todo.id] === JSON.stringify([todo.title, todo.reminderAt, reminderRefresh])) ||
        schedulingReminderIdsRef.current.has(todo.id) ||
        !todo.reminderAt
      ) {
        continue;
      }

      schedulingReminderIdsRef.current.add(todo.id);
      void scheduleTaskReminder(todo.title, todo.reminderAt, false, todo.id)
        .then((identifier) => {
          if (identifier) {
            nativeSignatures.current[todo.id] = JSON.stringify([todo.title, todo.reminderAt, reminderRefresh]);
            setReminderIds((current) => ({
              ...current,
              [todo.id]: identifier,
            }));
          }
        })
        .catch(() => undefined)
        .finally(() => schedulingReminderIdsRef.current.delete(todo.id));
    }
  }, [isReady, reminderIds, remindersReady, reminderRefresh, todos]);

  const addTodo = useCallback(
    (title: string, date: string, schedule: TaskSchedule = {}) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      setTodos((current) => [
        ...current,
        {
          id: createId(),
          title: cleanTitle,
          completed: false,
          date,
          ...schedule,
        },
      ]);
      showToast('Task created', 'create');
    },
    [setTodos, showToast],
  );

  const addDailyDefault = useCallback(
    (title: string) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      const recurrenceId = createId('repeat');
      setData((current) =>
        ensureScheduledRepeats(
          {
            todos: current.todos,
            repeatRules: [
              ...current.repeatRules,
              {
                id: recurrenceId,
                title: cleanTitle,
                lastCreatedDate: shiftDateKey(activeDate, -1),
                active: true,
                daysOfWeek: [...EVERY_DAY],
              },
            ],
          },
          activeDate,
        ),
      );
      showToast('Daily default added', 'create');
    },
    [activeDate, showToast],
  );

  const editDailyDefault = useCallback(
    (id: string, title: string) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      setData((current) => ({
        todos: current.todos.map((todo) =>
          todo.recurrenceId === id && todo.date === activeDate
            ? { ...todo, title: cleanTitle }
            : todo,
        ),
        repeatRules: current.repeatRules.map((rule) =>
          rule.id === id ? { ...rule, title: cleanTitle } : rule,
        ),
      }));
      showToast('Daily default updated', 'edit');
    },
    [activeDate, showToast],
  );

  const toggleDailyDefault = useCallback(
    (id: string) => {
      const rule = repeatRules.find((item) => item.id === id);
      if (!rule) return;

      const willEnable = !rule.active;
      setData((current) => {
        const hasTodayTask = current.todos.some(
          (todo) =>
            todo.recurrenceId === id && todo.date === activeDate,
        );
        const next = {
          ...current,
          repeatRules: current.repeatRules.map((item) =>
            item.id === id
              ? {
                  ...item,
                  active: willEnable,
                  lastCreatedDate:
                    willEnable && !hasTodayTask
                      ? shiftDateKey(activeDate, -1)
                      : item.lastCreatedDate,
                }
              : item,
          ),
        };
        return willEnable
          ? ensureScheduledRepeats(next, activeDate)
          : next;
      });
      showToast(
        willEnable ? 'Daily default enabled' : 'Daily default paused',
        'repeat',
      );
    },
    [activeDate, repeatRules, showToast],
  );

  const deleteDailyDefault = useCallback(
    (id: string) => {
      const deletedRule = repeatRules.find((rule) => rule.id === id);
      if (!deletedRule) return;

      setData((current) => ({
        todos: current.todos.map((todo) => {
          if (todo.recurrenceId !== id) return todo;
          const next = { ...todo };
          delete next.recurrenceId;
          return next;
        }),
        repeatRules: current.repeatRules.filter((rule) => rule.id !== id),
      }));
      showToast('Daily default removed', 'delete');
    },
    [repeatRules, showToast],
  );

  const reorderDailyDefault = useCallback(
    (id: string, toIndex: number) => {
      setRepeatRules((current) => {
        const dailyRules = current.filter(isDailyRule);
        const fromIndex = dailyRules.findIndex((rule) => rule.id === id);
        const nextIndex = Math.min(
          Math.max(toIndex, 0),
          dailyRules.length - 1,
        );
        if (fromIndex < 0 || fromIndex === nextIndex) return current;

        const reordered = [...dailyRules];
        const [movedRule] = reordered.splice(fromIndex, 1);
        reordered.splice(nextIndex, 0, movedRule);

        let dailyIndex = 0;
        return current.map((rule) =>
          isDailyRule(rule) ? reordered[dailyIndex++] : rule,
        );
      });
    },
    [setRepeatRules],
  );

  const duplicateTodo = useCallback(
    (id: string) => {
      const source = todos.find((todo) => todo.id === id);
      if (!source) return;

      setTodos((current) => {
        const sourceIndex = current.findIndex((todo) => todo.id === id);
        if (sourceIndex < 0) return current;

        const copy: Todo = {
          id: createId(),
          title: source.title,
          completed: false,
          date: source.date,
          scheduledTime: source.scheduledTime,
          scheduledAt: source.scheduledAt,
          timeZone: source.timeZone,
        };
        const next = [...current];
        next.splice(sourceIndex + 1, 0, copy);
        return next;
      });
      showToast('Task duplicated', 'create');
    },
    [setTodos, showToast, todos],
  );

  const toggleTodo = useCallback((id: string) => {
    setTodos((current) =>
      current.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    );
  }, [setTodos]);

  const deleteTodo = useCallback(
    (id: string) => {
      const deletedIndex = todos.findIndex((todo) => todo.id === id);
      const deletedTodo = todos[deletedIndex];
      if (!deletedTodo) return;

      setTodos((current) => current.filter((todo) => todo.id !== id));
      showToast('Task deleted', 'delete', {
        actionLabel: 'Undo',
        duration: 4000,
        onAction: () => {
          setTodos((current) => {
            if (current.some((todo) => todo.id === deletedTodo.id)) {
              return current;
            }

            const restored = [...current];
            restored.splice(
              Math.min(Math.max(deletedIndex, 0), restored.length),
              0,
              deletedTodo,
            );
            return restored;
          });
        },
      });
    },
    [setTodos, showToast, todos],
  );

  const deleteTodoSeries = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo?.recurrenceId) {
        deleteTodo(id);
        return;
      }

      const previousData = data;
      const recurrenceId = todo.recurrenceId;
      setData((current) => ({
        todos: current.todos
          .filter((item) => item.id !== id)
          .map((item) => {
            if (item.recurrenceId !== recurrenceId) return item;
            const next = { ...item };
            delete next.recurrenceId;
            return next;
          }),
        repeatRules: current.repeatRules.filter(
          (rule) => rule.id !== recurrenceId,
        ),
      }));
      showToast('Task and future repeats deleted', 'delete', {
        actionLabel: 'Undo',
        duration: 4000,
        onAction: () => setData(previousData),
      });
    },
    [data, deleteTodo, showToast, todos],
  );

  const editTodo = useCallback(
    (id: string, title: string, updateSeries = false, date?: string, schedule?: TaskSchedule) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      const editedTodo = todos.find((todo) => todo.id === id);
      setTodos((current) =>
        current.map((todo) =>
          todo.id === id
            ? { ...(date ? moveTaskDate(todo, date) : todo), title: cleanTitle, ...schedule }
            : todo,
        ),
      );

      if (editedTodo?.recurrenceId && updateSeries) {
        setRepeatRules((current) =>
          current.map((rule) =>
            rule.id === editedTodo.recurrenceId && rule.active
              ? { ...rule, title: cleanTitle }
              : rule,
          ),
        );
      }

      showToast('Task updated', 'edit');
    },
    [setRepeatRules, setTodos, showToast, todos],
  );

  const moveTodoToToday = useCallback(
    (id: string) => {
      setTodos((current) => {
        const todo = current.find((item) => item.id === id);
        if (!todo || todo.date === activeDate) return current;

        return [
          ...current.filter((item) => item.id !== id),
          moveTaskDate(todo, activeDate),
        ];
      });
      showToast('Moved to today', 'move');
    },
    [activeDate, setTodos, showToast],
  );

  const reviewUnfinishedTodos = useCallback(
    (action: ReviewAction, ids: string[] = []) => {
      const selectedIds = new Set(ids);
      if (action === 'move' && selectedIds.size) {
        setTodos((current) => [
          ...current.filter((todo) => !selectedIds.has(todo.id)),
          ...current
            .filter((todo) => selectedIds.has(todo.id))
            .map((todo) => moveTaskDate(todo, activeDate)),
        ]);
        showToast(
          `${selectedIds.size} ${selectedIds.size === 1 ? 'task' : 'tasks'} moved`,
          'move',
        );
      }

      if (action === 'delete' && selectedIds.size) {
        const deletedTodos = todos.filter((todo) => selectedIds.has(todo.id));
        setTodos((current) =>
          current.filter((todo) => !selectedIds.has(todo.id)),
        );
        showToast(
          `${selectedIds.size} ${selectedIds.size === 1 ? 'task' : 'tasks'} deleted`,
          'delete',
          {
            actionLabel: 'Undo',
            duration: 4000,
            onAction: () =>
              setTodos((current) => {
                const existing = new Set(current.map((todo) => todo.id));
                return [
                  ...current,
                  ...deletedTodos.filter((todo) => !existing.has(todo.id)),
                ];
              }),
          },
        );
      }

      setLastReviewDate(activeDate);
      void AsyncStorage.setItem(LAST_REVIEW_DATE_STORAGE_KEY, activeDate);
    },
    [activeDate, setTodos, showToast, todos],
  );

  const reorderTodo = useCallback(
    (date: string, id: string, toIndex: number) => {
      setTodos((current) => {
        const dateTodos = current.filter((todo) => todo.date === date);
        const fromIndex = dateTodos.findIndex((todo) => todo.id === id);
        const nextIndex = Math.min(
          Math.max(toIndex, 0),
          dateTodos.length - 1,
        );

        if (fromIndex < 0 || fromIndex === nextIndex) return current;

        const reordered = [...dateTodos];
        const [movedTodo] = reordered.splice(fromIndex, 1);
        reordered.splice(nextIndex, 0, movedTodo);

        let dateIndex = 0;
        return current.map((todo) =>
          todo.date === date ? reordered[dateIndex++] : todo,
        );
      });
    },
    [setTodos],
  );

  const repeatTodoTomorrow = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo) return;

      const tomorrow = moveTaskDate(todo, shiftDateKey(activeDate, 1));
      setTodos((current) => [
        ...current,
        {
          id: createId(),
          title: todo.title,
          completed: false,
          date: tomorrow.date,
          scheduledTime: tomorrow.scheduledTime,
          scheduledAt: tomorrow.scheduledAt,
          timeZone: tomorrow.timeZone,
          reminderAt: tomorrow.reminderAt,
          reminderMinutes: tomorrow.reminderMinutes,
        },
      ]);
      showToast('Repeated tomorrow', 'repeat');
    },
    [activeDate, setTodos, showToast, todos],
  );

  const startRepeat = useCallback(
    (id: string, daysOfWeek: number[]) => {
      const todo = todos.find((item) => item.id === id);
      const cleanDays = [...new Set(daysOfWeek)]
        .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
        .sort();
      if (!todo || !cleanDays.length) return;

      const existingRule = todo.recurrenceId
        ? repeatRules.find((rule) => rule.id === todo.recurrenceId)
        : undefined;
      const recurrenceId = existingRule?.id ?? createId('repeat');
      setData((current) =>
        ensureScheduledRepeats(
          {
            todos: current.todos.map((item) =>
              item.id === id ? { ...item, recurrenceId } : item,
            ),
            repeatRules: existingRule
              ? current.repeatRules.map((rule) =>
                  rule.id === existingRule.id
                    ? { ...rule, active: true, daysOfWeek: cleanDays }
                    : rule,
                )
              : [
                  ...current.repeatRules,
                  {
                    id: recurrenceId,
                    title: todo.title,
                    lastCreatedDate: todo.date,
                    active: true,
                    daysOfWeek: cleanDays,
                  },
                ],
          },
          activeDate,
        ),
      );
      const label =
        cleanDays.length === 7
          ? 'Repeats daily'
          : cleanDays.join(',') === '1,2,3,4,5'
            ? 'Repeats on weekdays'
            : cleanDays.join(',') === '0,6'
              ? 'Repeats on weekends'
              : 'Repeat schedule saved';
      showToast(label, 'repeat');
    },
    [activeDate, repeatRules, showToast, todos],
  );

  const stopRepeat = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo?.recurrenceId) return;

      setRepeatRules((current) =>
        current.map((rule) =>
          rule.id === todo.recurrenceId ? { ...rule, active: false } : rule,
        ),
      );
      showToast('Repeat stopped', 'repeat');
    },
    [setRepeatRules, showToast, todos],
  );

  const setTodoReminder = useCallback(
    async (id: string, reminderAt: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo || !Number.isFinite(Date.parse(reminderAt)) || new Date(reminderAt).getTime() <= Date.now()) return;

      setTodos((current) =>
        current.map((item) => item.id === id ? { ...item, reminderAt, reminderMinutes: undefined } : item),
      );
      showToast('Reminder saved', 'reminder');
    },
    [setTodos, showToast, todos],
  );

  const clearTodoReminder = useCallback(
    (id: string) => {
      const identifier = reminderIds[id];
      if (identifier) {
        void cancelTaskReminder(identifier).catch(() => undefined);
      }
      setReminderIds((current) => {
        if (!current[id]) return current;
        const next = { ...current };
        delete next[id];
        return next;
      });
      setTodos((current) =>
        current.map((todo) => {
          if (todo.id !== id || !todo.reminderAt) return todo;
          const next = { ...todo };
          delete next.reminderAt;
          delete next.reminderMinutes;
          return next;
        }),
      );
      showToast('Reminder removed', 'reminder');
    },
    [reminderIds, setTodos, showToast],
  );

  const getTodosForDate = useCallback(
    (date: string) => todos.filter((todo) => todo.date === date),
    [todos],
  );

  const isTodoRepeating = useCallback(
    (todo: Todo) =>
      Boolean(
        todo.recurrenceId &&
          repeatRules.some(
            (rule) => rule.id === todo.recurrenceId && rule.active,
          ),
      ),
    [repeatRules],
  );

  const getRepeatDays = useCallback(
    (todo: Todo) => {
      if (!todo.recurrenceId) return null;
      const rule = repeatRules.find(
        (item) => item.id === todo.recurrenceId && item.active,
      );
      return rule ? [...(rule.daysOfWeek ?? EVERY_DAY)] : null;
    },
    [repeatRules],
  );

  const createBackup = useCallback(
    () => createTodoBackup(todos, repeatRules),
    [repeatRules, todos],
  );

  const restoreBackup = useCallback(
    (backup: TodoBackup, mode: RestoreMode) => {
      const previousData = data;
      const restoredData =
        mode === 'merge'
          ? mergeTodoBackup(todos, repeatRules, backup)
          : {
              todos: backup.tasks.map((task) => ({ ...task })),
              repeatRules: backup.repeatRules.map((rule) => ({ ...rule })),
            };

      setData(ensureScheduledRepeats(restoredData, activeDate));
      showToast(mode === 'merge' ? 'Backup merged' : 'Backup restored', 'backup', {
        actionLabel: 'Undo',
        duration: 6000,
        onAction: () => setData(previousData),
      });
    },
    [activeDate, data, repeatRules, showToast, todos],
  );

  const activeRepeatCount = repeatRules.filter((rule) => rule.active).length;
  const dailyDefaults = useMemo(
    () => repeatRules.filter(isDailyRule),
    [repeatRules],
  );
  const pendingReviewTodos = useMemo(() => {
    if (!isReady || lastReviewDate === activeDate) return [];
    const yesterday = shiftDateKey(activeDate, -1);
    return todos.filter(
      (todo) => todo.date === yesterday && !todo.completed,
    );
  }, [activeDate, isReady, lastReviewDate, todos]);

  const value = useMemo(
    () => ({
      activeRepeatCount,
      dailyDefaults,
      scheduledReminderIds: reminderIds,
      refreshReminders,
      isReady,
      today: activeDate,
      todos,
      pendingReviewTodos,
      addDailyDefault,
      addTodo,
      clearTodoReminder,
      createBackup,
      deleteTodo,
      deleteTodoSeries,
      deleteDailyDefault,
      duplicateTodo,
      editDailyDefault,
      editTodo,
      getTodosForDate,
      getRepeatDays,
      isTodoRepeating,
      moveTodoToToday,
      reorderTodo,
      reorderDailyDefault,
      repeatTodoTomorrow,
      reviewUnfinishedTodos,
      restoreBackup,
      setTodoReminder,
      startRepeat,
      stopRepeat,
      toggleDailyDefault,
      toggleTodo,
    }),
    [
      reminderIds,
      refreshReminders,
      isReady,
      activeRepeatCount,
      dailyDefaults,
      activeDate,
      todos,
      pendingReviewTodos,
      addDailyDefault,
      addTodo,
      clearTodoReminder,
      createBackup,
      deleteTodo,
      deleteTodoSeries,
      deleteDailyDefault,
      duplicateTodo,
      editDailyDefault,
      editTodo,
      getTodosForDate,
      getRepeatDays,
      isTodoRepeating,
      moveTodoToToday,
      reorderTodo,
      reorderDailyDefault,
      repeatTodoTomorrow,
      reviewUnfinishedTodos,
      restoreBackup,
      setTodoReminder,
      startRepeat,
      stopRepeat,
      toggleDailyDefault,
      toggleTodo,
    ],
  );

  return (
    <TodosContext.Provider value={value}>{children}</TodosContext.Provider>
  );
}

export function useTodos() {
  const context = useContext(TodosContext);

  if (!context) {
    throw new Error('useTodos must be used inside TodosProvider');
  }

  return context;
}
