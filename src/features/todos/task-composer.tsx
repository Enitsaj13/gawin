import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { ViewStyle } from 'react-native';

import { formatJournalDate, fromDateKey, todayKey, toDateKey } from '@/lib/date';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';
import { ScheduleFields, resolveSchedule } from '@/features/reminders/schedule-fields';
import type { TaskSchedule } from './types';

type TaskComposerProps = {
  allowSeriesUpdate?: boolean;
  allowDateSelection?: boolean;
  allowScheduling?: boolean;
  initialSchedule?: TaskSchedule;
  date: string;
  heading?: string;
  initialTitle?: string;
  submitLabel?: string;
  visible: boolean;
  onClose: () => void;
  onSubmit: (title: string, date: string, updateSeries: boolean, schedule: TaskSchedule) => void;
};

type WebViewport = {
  height: number;
  left: number;
  top: number;
  width: number;
};

const webScrollLockStyle: ViewStyle & { overscrollBehavior: 'none' } = {
  overscrollBehavior: 'none',
};

export function TaskComposer({
  allowSeriesUpdate = false,
  allowDateSelection = true,
  allowScheduling = true,
  initialSchedule = {},
  date,
  heading = 'New task',
  initialTitle = '',
  submitLabel = 'Add task',
  visible,
  onClose,
  onSubmit,
}: TaskComposerProps) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useAppTheme();
  const [title, setTitle] = useState(initialTitle);
  const [schedule, setSchedule] = useState<TaskSchedule>(() => ({
    scheduledTime: initialSchedule.scheduledTime, scheduledAt: initialSchedule.scheduledAt,
    timeZone: initialSchedule.timeZone, reminderAt: initialSchedule.reminderAt, reminderMinutes: initialSchedule.reminderMinutes,
  }));
  const [scheduleError, setScheduleError] = useState('');
  const [selectedDate, setSelectedDate] = useState(date);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [scheduleExpanded, setScheduleExpanded] = useState<'time' | 'reminder' | null>(null);
  const [visibleMonth, setVisibleMonth] = useState(() => fromDateKey(date));
  const [updateSeries, setUpdateSeries] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [webViewport, setWebViewport] = useState<WebViewport | null>(null);
  const calendarDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1, 12);
    const offset = firstDay.getDay();
    const dayCount = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0, 12).getDate();
    const count = Math.ceil((offset + dayCount) / 7) * 7;
    return Array.from({ length: count }, (_, index) => {
      const day = index - offset + 1;
      return day > 0 && day <= dayCount
        ? toDateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), day, 12))
        : null;
    });
  }, [visibleMonth]);
  const currentDate = todayKey();
  const currentMonth = fromDateKey(currentDate);
  const canGoToPreviousMonth =
    visibleMonth.getFullYear() > currentMonth.getFullYear() ||
    (visibleMonth.getFullYear() === currentMonth.getFullYear() &&
      visibleMonth.getMonth() > currentMonth.getMonth());

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const viewport = window.visualViewport;
    const updateViewport = () => {
      setWebViewport({
        height: viewport?.height ?? window.innerHeight,
        left: viewport?.offsetLeft ?? 0,
        top: viewport?.offsetTop ?? 0,
        width: viewport?.width ?? window.innerWidth,
      });
    };

    updateViewport();
    viewport?.addEventListener('resize', updateViewport);
    viewport?.addEventListener('scroll', updateViewport);
    window.addEventListener('resize', updateViewport);

    return () => {
      viewport?.removeEventListener('resize', updateViewport);
      viewport?.removeEventListener('scroll', updateViewport);
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  const close = () => {
    setTitle('');
    onClose();
  };

  const submit = () => {
    if (!title.trim()) return;
    try { onSubmit(title, selectedDate, updateSeries, resolveSchedule(schedule, selectedDate, date, initialSchedule)); }
    catch (error) { setScheduleError(error instanceof Error ? error.message : 'Please check the task time.'); return; }
    close();
  };

  return (
    <Modal
      animationType="fade"
      onRequestClose={close}
      transparent
      visible={visible}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'web'
            ? undefined
            : Platform.OS === 'ios'
              ? 'padding'
              : 'height'
        }
        style={[
          styles.keyboardView,
          Platform.OS === 'web' &&
            webViewport && {
              flex: 0,
              position: 'absolute',
              height: webViewport.height,
              left: webViewport.left,
              top: webViewport.top,
              width: webViewport.width,
            },
        ]}
      >
        <View
          style={[
            styles.backdrop,
            Platform.OS === 'web' && webScrollLockStyle,
          ]}
        >
          <Pressable
            accessibilityLabel="Close task editor"
            accessibilityRole="button"
            onPress={close}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.sheet}>
            <ScrollView style={styles.content} contentContainerStyle={styles.contentInner} keyboardShouldPersistTaps="handled" bounces={false} showsVerticalScrollIndicator={false}>
            <Text style={styles.eyebrow}>{formatJournalDate(selectedDate)}</Text>
            <Text style={styles.title}>{heading}</Text>
            <TextInput
              accessibilityLabel="Task title"
              autoFocus
              maxLength={80}
              onBlur={() => setInputFocused(false)}
              onChangeText={setTitle}
              onFocus={() => { setInputFocused(true); setCalendarOpen(false); setScheduleExpanded(null); }}
              onSubmitEditing={submit}
              placeholder="What needs to be done?"
              placeholderTextColor={colors.textMuted}
              returnKeyType="done"
              selectTextOnFocus={Boolean(initialTitle)}
              selectionColor={colors.accent}
              style={[
                styles.input,
                Platform.OS === 'web' && styles.inputWeb,
                Platform.OS === 'web' &&
                  inputFocused &&
                  styles.inputWebFocused,
              ]}
              value={title}
            />
            {allowDateSelection ? (
              <View style={styles.datePicker}>
                <Pressable
                  accessibilityLabel={`Task date: ${formatJournalDate(selectedDate)}. Tap to choose a date.`}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: calendarOpen }}
                  onPress={() => {
                    setScheduleExpanded(null);
                    setCalendarOpen((open) => !open);
                    if (!calendarOpen) {
                      setVisibleMonth(fromDateKey(selectedDate));
                      Keyboard.dismiss();
                    }
                  }}
                  style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
                >
                  <View style={styles.dateSummary}>
                    <Text style={styles.dateLabel}>Date</Text>
                    <Text style={styles.dateValue}>
                      {selectedDate === todayKey() ? 'Today' : formatJournalDate(selectedDate)}
                    </Text>
                  </View>
                  <Text style={styles.dateChevron}>{calendarOpen ? '−' : '+'}</Text>
                </Pressable>
                {calendarOpen ? (
                  <View style={styles.calendar}>
                    <View style={styles.calendarHeader}>
                      <Pressable
                        accessibilityLabel="Previous month"
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !canGoToPreviousMonth }}
                        disabled={!canGoToPreviousMonth}
                        onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))}
                        style={[styles.monthArrowHit, !canGoToPreviousMonth && styles.monthArrowDisabled]}
                      ><Text style={[styles.monthArrow, !canGoToPreviousMonth && styles.monthArrowDisabledText]}>‹</Text></Pressable>
                      <Text style={styles.monthTitle}>{visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
                      <Pressable
                        accessibilityLabel="Next month"
                        accessibilityRole="button"
                        onPress={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))}
                        style={styles.monthArrowHit}
                      ><Text style={styles.monthArrow}>›</Text></Pressable>
                    </View>
                    <View style={styles.calendarGrid}>
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                        <Text key={`${day}-${index}`} style={styles.weekdayCell}>{day}</Text>
                      ))}
                      {calendarDays.map((day, index) => day ? (
                        <Pressable
                          accessibilityLabel={`${formatJournalDate(day)}${day < currentDate ? ', unavailable' : ''}`}
                          accessibilityRole={day < currentDate ? undefined : 'button'}
                          accessibilityState={{ disabled: day < currentDate, selected: day === selectedDate }}
                          disabled={day < currentDate}
                          key={day}
                          onPress={() => { setSelectedDate(day); setScheduleError(''); setCalendarOpen(false); }}
                          style={({ pressed }) => [styles.dayCell, day < currentDate && styles.pastDay, day === selectedDate && styles.selectedDay, pressed && styles.pressed]}
                        ><Text style={[styles.dayText, day < currentDate && styles.pastDayText, day === selectedDate && styles.selectedDayText]}>{fromDateKey(day).getDate()}</Text></Pressable>
                      ) : <View key={`blank-${index}`} style={styles.dayCell} />)}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => { setSelectedDate(todayKey()); setScheduleError(''); setVisibleMonth(fromDateKey(todayKey())); setCalendarOpen(false); }}
                      style={({ pressed }) => [styles.todayShortcut, pressed && styles.pressed]}
                    ><Text style={styles.todayShortcutText}>Today</Text></Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
            {allowScheduling ? <ScheduleFields expanded={scheduleExpanded} setExpanded={setScheduleExpanded} date={selectedDate} value={schedule} onChange={(value) => { setSchedule(value); setScheduleError(''); }} onExpand={() => setCalendarOpen(false)} /> : null}
            {allowSeriesUpdate ? (
              <View style={styles.scopePicker}>
                <Text style={styles.scopeLabel}>Apply name changes to</Text>
                <Text style={styles.scopeLabel}>Time and reminder apply to this task only.</Text>
                <View style={styles.scopeOptions}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: !updateSeries }}
                    onPress={() => setUpdateSeries(false)}
                    style={({ pressed }) => [
                      styles.scopeOption,
                      !updateSeries && styles.scopeOptionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeOptionText,
                        !updateSeries && styles.scopeOptionTextSelected,
                      ]}
                    >
                      Today only
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: updateSeries }}
                    onPress={() => setUpdateSeries(true)}
                    style={({ pressed }) => [
                      styles.scopeOption,
                      updateSeries && styles.scopeOptionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.scopeOptionText,
                        updateSeries && styles.scopeOptionTextSelected,
                      ]}
                    >
                      Today & future
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {scheduleError ? <Text accessibilityLiveRegion="polite" style={styles.error}>{scheduleError}</Text> : null}
            </ScrollView>
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Cancel task editor"
                accessibilityRole="button"
                onPress={close}
                style={({ pressed }) => [
                  styles.cancel,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityLabel={submitLabel}
                accessibilityRole="button"
                disabled={!title.trim()}
                onPress={submit}
                style={({ pressed }) => [
                  styles.add,
                  !title.trim() && styles.addDisabled,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.addText}>{submitLabel}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.scrim,
  },
  sheet: {
    maxHeight: '94%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    borderTopWidth: 1,
    borderColor: colors.accent,
  },
  content: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  contentInner: { paddingBottom: 2 },
  dateSummary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingRight: 16 },
  eyebrow: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  error: { marginTop: 12, color: colors.textSecondary, fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 17 },
  title: {
    marginTop: 4,
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 20,
  },
  input: {
    minHeight: 48,
    marginTop: 12,
    borderBottomWidth: 1,
    borderColor: colors.accent,
    color: colors.text,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 16,
    paddingVertical: 12,
  },
  inputWeb: {
    outlineWidth: 0,
  },
  inputWebFocused: {
    borderBottomWidth: 2,
  },
  datePicker: {
    marginTop: 8,
  },
  dateButton: {
    minHeight: 44,
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateLabel: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
  },
  dateValue: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  dateChevron: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 20,
  },
  calendar: {
    marginTop: 14,
    paddingHorizontal: 4,
  },
  calendarHeader: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthTitle: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  monthArrowHit: {
    width: 40,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthArrowDisabled: {
    opacity: 0.35,
  },
  monthArrowDisabledText: {
    color: colors.textFaint,
  },
  monthArrow: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 20,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekdayCell: {
    width: '14.2857%',
    height: 32,
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  dayCell: {
    width: '14.2857%',
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedDay: {
    backgroundColor: colors.accent,
  },
  dayText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 11,
  },
  pastDay: {
    opacity: 0.38,
  },
  pastDayText: {
    color: colors.textFaint,
  },
  selectedDayText: {
    color: colors.accentText,
    fontFamily: 'SpaceMono_700Bold',
  },
  todayShortcut: {
    alignSelf: 'flex-end',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  todayShortcutText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 10,
    textDecorationLine: 'underline',
  },
  actions: {
    marginTop: 14,
    flexShrink: 0,
    flexDirection: 'row',
    gap: 10,
  },
  scopePicker: {
    marginTop: 12,
  },
  scopeLabel: {
    color: colors.textMuted,
    fontFamily: 'SpaceMono_400Regular',
    fontSize: 9,
    textTransform: 'uppercase',
  },
  scopeOptions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 8,
  },
  scopeOption: {
    minHeight: 38,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  scopeOptionSelected: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  scopeOptionText: {
    color: colors.textSecondary,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 9,
  },
  scopeOptionTextSelected: {
    color: colors.accentText,
  },
  cancel: {
    minHeight: 46,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.accent,
  },
  add: {
    minHeight: 46,
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  addDisabled: {
    backgroundColor: colors.disabled,
  },
  cancelText: {
    color: colors.text,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  addText: {
    color: colors.accentText,
    fontFamily: 'SpaceMono_700Bold',
    fontSize: 12,
  },
  pressed: {
    opacity: 0.58,
  },
});
