import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppMenuSheet } from '@/components/app-menu-sheet';
import { BackButton } from '@/components/back-button';
import { DayCard } from '@/features/todos/day-card';
import { useTodos } from '@/features/todos/todos-context';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';

export default function HistoryScreen() {
  const styles = useThemeStyles(createStyles);
  const { colors, statusBarStyle } = useAppTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { getTodosForDate, today, todos, toggleTodo } = useTodos();
  const pastDates = [...new Set(todos.map((todo) => todo.date))]
    .filter((date) => date < today)
    .sort((first, second) => second.localeCompare(first));
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matchingTodos = (date: string) =>
    getTodosForDate(date).filter(
      (todo) =>
        !normalizedQuery ||
        todo.title.toLocaleLowerCase().includes(normalizedQuery),
    );
  const visibleDates = pastDates.filter((date) => matchingTodos(date).length);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <StatusBar style={statusBarStyle} />
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
              accessibilityLabel="Open Gawin menu"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => setMenuOpen(true)}
              style={({ pressed }) => [
                styles.menuAction,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.menuActionText}>Menu →</Text>
            </Pressable>
          </View>
        </View>

        {pastDates.length ? (
          <View style={styles.searchWrap}>
            <TextInput
              accessibilityLabel="Search past tasks"
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
              maxLength={80}
              onChangeText={setQuery}
              placeholder="Search past tasks"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              selectionColor={colors.accent}
              style={[styles.searchInput, Platform.OS === 'web' && styles.searchInputWeb]}
              value={query}
            />
          </View>
        ) : null}

        {visibleDates.length ? (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.dayGrid}>
              {visibleDates.map((date) => (
                <DayCard
                  date={date}
                  key={date}
                  onOpen={() =>
                    router.push({ pathname: '/day/[date]', params: { date } })
                  }
                  onToggle={toggleTodo}
                  todos={matchingTodos(date)}
                />
              ))}
            </View>
          </ScrollView>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>
              {pastDates.length ? 'No matching tasks.' : 'No past tasks.'}
            </Text>
            <Text style={styles.emptyBody}>
              {pastDates.length
                ? 'Try another word.'
                : 'Completed days will appear here.'}
            </Text>
          </View>
        )}
      </View>
      {menuOpen ? <AppMenuSheet onClose={() => setMenuOpen(false)} /> : null}
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
  headerMeta: {
    alignItems: 'flex-end',
    gap: 7,
  },
  menuAction: {
    minHeight: 24,
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderColor: colors.textSecondary,
  },
  menuActionText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  searchWrap: {
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  searchInput: {
    minHeight: 42,
    borderBottomWidth: 1,
    borderColor: colors.borderStrong,
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
    paddingVertical: 10,
  },
  searchInputWeb: {
    outlineWidth: 0,
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
  },
  emptyTitle: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 14,
  },
  emptyBody: {
    marginTop: 6,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  pressed: {
    opacity: 0.45,
  },
});
