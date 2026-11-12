import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { DayCard } from '@/features/todos/day-card';
import { useTodos } from '@/features/todos/todos-context';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

export default function UpcomingScreen() {
  const styles = useThemeStyles(createStyles);
  const { statusBarStyle } = useAppTheme();
  const { getTodosForDate, today, todos, toggleTodo } = useTodos();
  const upcomingDates = [...new Set(todos.map((todo) => todo.date))]
    .filter((date) => date > today)
    .sort((first, second) => first.localeCompare(second));

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.page}>
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            hitSlop={12}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/')}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <BackButton />
          </Pressable>
          <Text style={styles.title}>Upcoming</Text>
          <Text style={styles.dayCount}>{upcomingDates.length} {upcomingDates.length === 1 ? 'day' : 'days'}</Text>
        </View>

        {upcomingDates.length ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.dayGrid}>
              {upcomingDates.map((date) => (
                <DayCard
                  date={date}
                  key={date}
                  onOpen={() => router.push({ pathname: '/day/[date]', params: { date } })}
                  onToggle={toggleTodo}
                  todos={getTodosForDate(date)}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing scheduled ahead.</Text>
            <Text style={styles.emptyBody}>Choose a date when creating a task.</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  page: {
    width: '100%',
    maxWidth: 560,
    flex: 1,
    alignSelf: 'center',
    backgroundColor: colors.background,
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
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 22,
    letterSpacing: -1.25,
  },
  dayCount: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 90,
    paddingHorizontal: 24,
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyBody: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.45,
  },
});
