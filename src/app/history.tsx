import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { DayCard } from '@/features/todos/day-card';
import { useTodos } from '@/features/todos/todos-context';

export default function HistoryScreen() {
  const { getTodosForDate, today, todos, toggleTodo } = useTodos();
  const pastDates = [...new Set(todos.map((todo) => todo.date))]
    .filter((date) => date < today)
    .sort((first, second) => second.localeCompare(first));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() =>
              router.canGoBack() ? router.back() : router.replace('/')
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <BackButton />
          </Pressable>
          <Text style={styles.title}>Past tasks</Text>
          <View style={styles.headerMeta}>
            <Text style={styles.dayCount}>
              {pastDates.length} {pastDates.length === 1 ? 'day' : 'days'}
            </Text>
            <Pressable
              accessibilityLabel="Open backup and restore"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => router.push('/backup')}
              style={({ pressed }) => [
                styles.backupButton,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.backupText}>Backup</Text>
              <Text style={styles.backupArrow}>→</Text>
            </Pressable>
          </View>
        </View>

        {pastDates.length ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dayGrid}>
              {pastDates.map((date) => (
                <DayCard
                  date={date}
                  key={date}
                  onOpen={() =>
                    router.push({ pathname: '/day/[date]', params: { date } })
                  }
                  onToggle={toggleTodo}
                  todos={getTodosForDate(date)}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No past tasks.</Text>
            <Text style={styles.emptyBody}>
              Completed days will appear here.
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fbfbf9',
  },
  page: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
    backgroundColor: '#fbfbf9',
  },
  header: {
    minHeight: 115,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 23,
    paddingTop: 23,
  },
  backButton: {
    width: 32,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -1.25,
  },
  dayCount: {
    color: '#85847f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 7,
  },
  backupButton: {
    minHeight: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 1,
    borderColor: '#242422',
  },
  backupText: {
    color: '#242422',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  backupArrow: {
    color: '#242422',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 12,
    lineHeight: 15,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: '#d7d7d3',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 90,
  },
  emptyTitle: {
    color: '#3c3c39',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 14,
  },
  emptyBody: {
    marginTop: 6,
    color: '#96958f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  pressed: {
    opacity: 0.45,
  },
});
