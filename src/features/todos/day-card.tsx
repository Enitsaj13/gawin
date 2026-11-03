import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatJournalDate, formatWeekday } from '@/lib/date';

import { TaskRow } from './task-row';
import { Todo } from './types';

type DayCardProps = {
  date: string;
  todos: Todo[];
  onOpen: () => void;
  onToggle: (id: string) => void;
};

export function DayCard({ date, todos, onOpen, onToggle }: DayCardProps) {
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityLabel={`Open tasks for ${formatJournalDate(date)}`}
        onPress={onOpen}
        style={({ pressed }) => [styles.heading, pressed && styles.pressed]}
      >
        <Text style={styles.date}>{formatJournalDate(date)}</Text>
        <Text style={styles.weekday}>{formatWeekday(date, true)}</Text>
      </Pressable>

      {todos.length === 0 ? (
        <Pressable onPress={onOpen} style={styles.emptyArea}>
          <Text style={styles.emptyText}>No tasks</Text>
        </Pressable>
      ) : (
        todos
          .slice(0, 4)
          .map((todo) => (
            <TaskRow compact key={todo.id} onToggle={onToggle} todo={todo} />
          ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '50%',
    minHeight: 177,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7d7d3',
    paddingHorizontal: 16,
    paddingTop: 22,
    paddingBottom: 14,
    backgroundColor: '#fbfbf9',
  },
  heading: {
    minHeight: 27,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pressed: {
    opacity: 0.45,
  },
  date: {
    flexShrink: 1,
    color: '#262624',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 11,
    letterSpacing: -0.6,
  },
  weekday: {
    color: '#8a8984',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  emptyArea: {
    flex: 1,
    justifyContent: 'center',
  },
  emptyText: {
    color: '#aaa9a3',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
});
