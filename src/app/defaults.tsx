import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { useFeedback } from '@/features/preferences/preferences-context';
import { DailyDefaultRow } from '@/features/todos/daily-default-row';
import { ReorderableTaskList } from '@/features/todos/reorderable-task-list';
import { TaskComposer } from '@/features/todos/task-composer';
import { useTodos } from '@/features/todos/todos-context';
import { RepeatRule } from '@/features/todos/types';

type ComposerState =
  | { mode: 'create' }
  | { mode: 'edit'; item: RepeatRule }
  | null;

export default function DailyDefaultsScreen() {
  const feedback = useFeedback();
  const [composer, setComposer] = useState<ComposerState>(null);
  const [isReordering, setIsReordering] = useState(false);
  const {
    addDailyDefault,
    dailyDefaults,
    deleteDailyDefault,
    editDailyDefault,
    reorderDailyDefault,
    today,
    toggleDailyDefault,
  } = useTodos();

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
              router.canGoBack() ? router.back() : router.replace('/settings')
            }
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <BackButton />
          </Pressable>
          <Text style={styles.headerTitle}>Daily defaults</Text>
          <Text style={styles.count}>{dailyDefaults.length}</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          scrollEnabled={!composer && !isReordering}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Ready every day.</Text>
          <Text style={styles.intro}>
            Gawin adds one fresh copy of each enabled default to Today. Missed
            days are never backfilled.
          </Text>

          {dailyDefaults.length ? (
            <View style={styles.list}>
              <ReorderableTaskList
                onDragStateChange={setIsReordering}
                onReorder={reorderDailyDefault}
                renderItem={(item, controls) => (
                  <DailyDefaultRow
                    {...controls}
                    item={item}
                    onDelete={deleteDailyDefault}
                    onEdit={(selected) =>
                      setComposer({ mode: 'edit', item: selected })
                    }
                    onToggle={toggleDailyDefault}
                  />
                )}
                rowHeight={48}
                todos={dailyDefaults}
              />
              <Text style={styles.dragHint}>
                Hold a title and drag to change tomorrow’s order.
              </Text>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No daily defaults yet.</Text>
              <Text style={styles.emptyBody}>
                Add the tasks you want waiting each morning.
              </Text>
            </View>
          )}
        </ScrollView>

        <View pointerEvents="box-none" style={styles.floatingButtonDock}>
          <Pressable
            accessibilityLabel="Add a daily default"
            accessibilityRole="button"
            onPress={() => {
              feedback.impactLight();
              setComposer({ mode: 'create' });
            }}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
          >
            <View style={styles.plusIcon}>
              <View style={styles.plusHorizontal} />
              <View style={styles.plusVertical} />
            </View>
          </Pressable>
        </View>
      </View>

      {composer ? (
        <TaskComposer
          date={today}
          heading={
            composer.mode === 'edit' ? 'Edit daily default' : 'New daily default'
          }
          initialTitle={composer.mode === 'edit' ? composer.item.title : ''}
          key={composer.mode === 'edit' ? composer.item.id : 'new-default'}
          onClose={() => setComposer(null)}
          onSubmit={(title) => {
            if (composer.mode === 'edit') {
              editDailyDefault(composer.item.id, title);
              return;
            }
            addDailyDefault(title);
          }}
          submitLabel={composer.mode === 'edit' ? 'Save default' : 'Add default'}
          visible
        />
      ) : null}
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
  headerTitle: {
    flex: 1,
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 20,
    letterSpacing: -1.1,
  },
  count: {
    color: '#85847f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 100,
  },
  title: {
    color: '#111111',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 24,
    letterSpacing: -1.15,
  },
  intro: {
    maxWidth: 430,
    marginTop: 9,
    color: '#676661',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 10,
    lineHeight: 17,
  },
  list: {
    marginTop: 30,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d0cfca',
    paddingVertical: 5,
  },
  dragHint: {
    marginTop: 14,
    marginBottom: 8,
    color: '#9a9993',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 8,
    textAlign: 'center',
  },
  emptyState: {
    minHeight: 260,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    color: '#3c3c39',
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 13,
  },
  emptyBody: {
    marginTop: 6,
    color: '#96958f',
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  floatingButtonDock: {
    position: 'absolute',
    right: 20,
    bottom: 18,
    zIndex: 10,
  },
  addButton: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 2,
    backgroundColor: '#111111',
  },
  addButtonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.96 }],
  },
  plusIcon: {
    width: 18,
    height: 18,
  },
  plusHorizontal: {
    position: 'absolute',
    top: 8.25,
    right: 0,
    left: 0,
    height: 1.5,
    backgroundColor: '#ffffff',
  },
  plusVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 8.25,
    width: 1.5,
    backgroundColor: '#ffffff',
  },
  pressed: {
    opacity: 0.48,
  },
});
