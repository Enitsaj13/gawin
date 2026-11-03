import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useToast } from '@/components/toast';
import { shiftDateKey, todayKey } from '@/lib/date';

import {
  createTodoBackup,
  mergeTodoBackup,
  RestoreMode,
  TodoBackup,
} from './backup';
import { RepeatRule, Todo } from './types';

const STORAGE_KEY = 'gawin.tasks.v2';
const REPEAT_STORAGE_KEY = 'gawin.repeat-rules.v1';
const LEGACY_STORAGE_KEY = 'todo-journal.tasks.v2';
const LEGACY_REPEAT_STORAGE_KEY = 'todo-journal.repeat-rules.v1';
const OBSOLETE_STORAGE_KEYS = ['todo-journal.tasks.v1'];

type TodosContextValue = {
  activeRepeatCount: number;
  isReady: boolean;
  today: string;
  todos: Todo[];
  addTodo: (title: string, date: string) => void;
  createBackup: () => TodoBackup;
  deleteTodo: (id: string) => void;
  editTodo: (id: string, title: string) => void;
  getTodosForDate: (date: string) => Todo[];
  isTodoRepeating: (todo: Todo) => boolean;
  moveTodoToToday: (id: string) => void;
  repeatTodoTomorrow: (id: string) => void;
  restoreBackup: (backup: TodoBackup, mode: RestoreMode) => void;
  startDailyRepeat: (id: string) => void;
  stopDailyRepeat: (id: string) => void;
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

function ensureDailyRepeats(data: TodosData, date: string): TodosData {
  const dueRules = data.repeatRules.filter(
    (rule) => rule.active && rule.lastCreatedDate < date,
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
        ]);
        if (!isMounted) return;

        const storedTodos = storedValues[0][1] ?? storedValues[2][1];
        const storedRepeatRules = storedValues[1][1] ?? storedValues[3][1];
        setData(
          ensureDailyRepeats(
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
      } catch {
        if (isMounted) {
          setData({ todos: [], repeatRules: [] });
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    }

    void hydrate();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const date = todayKey();
        setActiveDate(date);
        setData((current) => ensureDailyRepeats(current, date));
      }
    });

    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isReady) return;
    void AsyncStorage.multiSet([
      [STORAGE_KEY, JSON.stringify(todos)],
      [REPEAT_STORAGE_KEY, JSON.stringify(repeatRules)],
    ]);
  }, [isReady, repeatRules, todos]);

  const addTodo = useCallback(
    (title: string, date: string) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      setTodos((current) => [
        ...current,
        {
          id: createId(),
          title: cleanTitle,
          completed: false,
          date,
        },
      ]);
      showToast('Task created', 'create');
    },
    [setTodos, showToast],
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

  const editTodo = useCallback(
    (id: string, title: string) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) return;

      const editedTodo = todos.find((todo) => todo.id === id);
      setTodos((current) =>
        current.map((todo) =>
          todo.id === id ? { ...todo, title: cleanTitle } : todo,
        ),
      );

      if (editedTodo?.recurrenceId) {
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
          { ...todo, date: activeDate },
        ];
      });
      showToast('Moved to today', 'move');
    },
    [activeDate, setTodos, showToast],
  );

  const repeatTodoTomorrow = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo) return;

      setTodos((current) => [
        ...current,
        {
          id: createId(),
          title: todo.title,
          completed: false,
          date: shiftDateKey(activeDate, 1),
        },
      ]);
      showToast('Repeated tomorrow', 'repeat');
    },
    [activeDate, setTodos, showToast, todos],
  );

  const startDailyRepeat = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo) return;

      const existingRule = todo.recurrenceId
        ? repeatRules.find((rule) => rule.id === todo.recurrenceId)
        : undefined;
      if (existingRule?.active) return;

      const recurrenceId = createId('repeat');
      setData((current) =>
        ensureDailyRepeats(
          {
            todos: current.todos.map((item) =>
              item.id === id ? { ...item, recurrenceId } : item,
            ),
            repeatRules: [
              ...current.repeatRules,
              {
                id: recurrenceId,
                title: todo.title,
                lastCreatedDate: todo.date,
                active: true,
              },
            ],
          },
          activeDate,
        ),
      );
      showToast('Repeats daily', 'repeat');
    },
    [activeDate, repeatRules, showToast, todos],
  );

  const stopDailyRepeat = useCallback(
    (id: string) => {
      const todo = todos.find((item) => item.id === id);
      if (!todo?.recurrenceId) return;

      setRepeatRules((current) =>
        current.map((rule) =>
          rule.id === todo.recurrenceId ? { ...rule, active: false } : rule,
        ),
      );
      showToast('Daily repeat stopped', 'repeat');
    },
    [setRepeatRules, showToast, todos],
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

      setData(ensureDailyRepeats(restoredData, activeDate));
      showToast(mode === 'merge' ? 'Backup merged' : 'Backup restored', 'backup', {
        actionLabel: 'Undo',
        duration: 6000,
        onAction: () => setData(previousData),
      });
    },
    [activeDate, data, repeatRules, showToast, todos],
  );

  const activeRepeatCount = repeatRules.filter((rule) => rule.active).length;

  const value = useMemo(
    () => ({
      activeRepeatCount,
      isReady,
      today: activeDate,
      todos,
      addTodo,
      createBackup,
      deleteTodo,
      editTodo,
      getTodosForDate,
      isTodoRepeating,
      moveTodoToToday,
      repeatTodoTomorrow,
      restoreBackup,
      startDailyRepeat,
      stopDailyRepeat,
      toggleTodo,
    }),
    [
      isReady,
      activeRepeatCount,
      activeDate,
      todos,
      addTodo,
      createBackup,
      deleteTodo,
      editTodo,
      getTodosForDate,
      isTodoRepeating,
      moveTodoToToday,
      repeatTodoTomorrow,
      restoreBackup,
      startDailyRepeat,
      stopDailyRepeat,
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
