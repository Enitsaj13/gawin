import { type Dispatch, type SetStateAction, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TaskSchedule } from '@/features/todos/types';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';
import { currentTimeZone, REMINDER_OPTIONS, reminderLabel, scheduledInstant } from './schedule';
import { useReminders } from './reminders-context';

export function ScheduleFields({ value, onChange, date, onExpand, expanded, setExpanded }: { value: TaskSchedule; onChange: (value: TaskSchedule) => void; date: string; onExpand: () => void; expanded: 'time' | 'reminder' | null; setExpanded: Dispatch<SetStateAction<'time' | 'reminder' | null>> }) {
  const styles = useThemeStyles(createStyles);
  const { colors } = useAppTheme();
  const { info } = useReminders();
  const [hour, setHour] = useState('9');
  const [minute, setMinute] = useState('00');
  const [period, setPeriod] = useState<'AM' | 'PM'>('AM');
  const [error, setError] = useState('');
  const label = value.scheduledTime ? (() => { const [h, m] = value.scheduledTime.split(':').map(Number); return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`; })() : 'No time';
  const toggle = (field: 'time' | 'reminder') => {
    Keyboard.dismiss(); onExpand(); setError('');
    if (field === 'time') {
      const [h, m] = (value.scheduledTime ?? '09:00').split(':').map(Number);
      setHour(String(h % 12 || 12)); setMinute(String(m).padStart(2, '0')); setPeriod(h >= 12 ? 'PM' : 'AM');
    }
    setExpanded((current) => current === field ? null : field);
  };
  const applyTime = () => {
    if (!/^\d{1,2}$/.test(hour) || Number(hour) < 1 || Number(hour) > 12 || !/^\d{1,2}$/.test(minute) || Number(minute) > 59) { setError('Use an hour from 1–12 and minutes from 00–59.'); return; }
    const time = `${String(Number(hour) % 12 + (period === 'PM' ? 12 : 0)).padStart(2, '0')}:${String(Number(minute)).padStart(2, '0')}`;
    try { scheduledInstant(date, time, value.timeZone ?? currentTimeZone()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Choose another time.'); return; }
    onChange({ ...value, scheduledTime: time, timeZone: value.timeZone ?? currentTimeZone() }); setExpanded(null); Keyboard.dismiss();
  };
  return <View style={styles.fields}>
    <View style={styles.summaries}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Task time: ${label}`} accessibilityState={{ expanded: expanded === 'time' }} onPress={() => toggle('time')} style={styles.row}>
      <Text style={styles.label}>Time</Text><Text style={styles.value}>{label} {expanded === 'time' ? '−' : '+'}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === 'reminder' }} onPress={() => toggle('reminder')} style={styles.row}>
      <Text style={styles.label}>Remind me</Text><Text style={styles.value}>{value.reminderMinutes !== undefined ? reminderLabel(value.reminderMinutes) : value.reminderAt ? 'Custom reminder' : 'Off'} {expanded === 'reminder' ? '−' : '+'}</Text>
    </Pressable>
    </View>
    {expanded === 'time' ? <View style={styles.picker}>
      <View style={styles.timeInputs}>
        <TextInput accessibilityLabel="Hour, 1 to 12" keyboardType="number-pad" maxLength={2} onChangeText={(text) => setHour(text.replace(/\D/g, ''))} value={hour} selectTextOnFocus selectionColor={colors.accent} style={[styles.numberInput, Platform.OS === 'web' && styles.webInput]} />
        <Text style={styles.separator}>:</Text>
        <TextInput accessibilityLabel="Minute, 00 to 59" keyboardType="number-pad" maxLength={2} onChangeText={(text) => setMinute(text.replace(/\D/g, ''))} value={minute} selectTextOnFocus selectionColor={colors.accent} style={[styles.numberInput, Platform.OS === 'web' && styles.webInput]} />
        <View style={styles.periodGroup}>{(['AM', 'PM'] as const).map((item) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: period === item }} key={item} onPress={() => setPeriod(item)} style={[styles.period, period === item && styles.selected]}><Text style={[styles.periodText, period === item && styles.selectedText]}>{item}</Text></Pressable>)}</View>
      </View>
      <Text style={styles.note}>Times in {value.timeZone ?? currentTimeZone()}</Text>
      {error ? <Text accessibilityLiveRegion="polite" style={styles.note}>{error}</Text> : null}
      <View style={styles.pickerActions}>
        <Pressable accessibilityRole="button" onPress={() => { onChange({ scheduledTime: undefined, scheduledAt: undefined, timeZone: undefined, reminderAt: undefined, reminderMinutes: undefined }); setExpanded(null); }} style={styles.link}><Text style={styles.linkText}>Remove time</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={applyTime} style={styles.done}><Text style={styles.doneText}>Set time</Text></Pressable>
      </View>
    </View> : null}
    {expanded === 'reminder' ? <View style={styles.picker}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Reminder timing" style={styles.options}>
      {[undefined, ...REMINDER_OPTIONS].map((minutes) => {
        const selected = minutes === undefined ? !value.reminderAt && value.reminderMinutes === undefined : value.reminderMinutes === minutes;
        return <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected, disabled: minutes !== undefined && !value.scheduledTime }} disabled={minutes !== undefined && !value.scheduledTime} key={minutes ?? 'off'} onPress={() => { onChange({ ...value, reminderAt: undefined, reminderMinutes: minutes }); setExpanded(null); }} style={({ pressed }) => [styles.option, minutes !== undefined && !value.scheduledTime && styles.disabled, pressed && styles.optionPressed]}>
          <View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <View style={styles.radioCheck} /> : null}</View>
          <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{minutes === undefined ? 'Off' : minutes === 0 ? 'At start' : `${minutes} min before`}</Text>
        </Pressable>;
      })}
      </View>
      <Text style={styles.note}>{!value.scheduledTime ? 'Choose a task time first.' : info?.connected ? 'Background reminders follow your phone settings. Delivery can be delayed.' : 'Until notifications are connected in Settings, alerts only appear while Gawin is open.'}</Text>
    </View> : null}
  </View>;
}

export { resolveSchedule } from './schedule';

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  fields: { marginTop: 4 }, summaries: { flexDirection: 'row', gap: 20 }, row: { flex: 1, minWidth: 0, minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.borderStrong, justifyContent: 'center', gap: 4 },
  label: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: colors.textMuted }, value: { fontFamily: 'SpaceMono_400Regular', fontSize: 11, color: colors.textSecondary },
  picker: { paddingVertical: 10 }, timeInputs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  numberInput: { width: 64, height: 54, textAlign: 'center', borderBottomWidth: 1, borderColor: colors.accent, color: colors.text, fontFamily: 'SpaceMono_400Regular', fontSize: 25 },
  separator: { color: colors.text, fontFamily: 'SpaceMono_400Regular', fontSize: 24 }, webInput: { outlineWidth: 0 }, periodGroup: { marginLeft: 8, gap: 4 },
  period: { paddingHorizontal: 12, minHeight: 30, justifyContent: 'center', borderWidth: 1, borderColor: colors.borderStrong }, periodText: { color: colors.textSecondary, fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent }, selectedText: { color: colors.accentText }, note: { color: colors.textMuted, fontFamily: 'SpaceMono_400Regular', fontSize: 9, lineHeight: 17, marginTop: 10 },
  pickerActions: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, link: { minHeight: 44, justifyContent: 'center' }, linkText: { color: colors.textSecondary, fontFamily: 'SpaceMono_400Regular', fontSize: 10, textDecorationLine: 'underline' },
  done: { backgroundColor: colors.accent, paddingHorizontal: 20, minHeight: 44, justifyContent: 'center' }, doneText: { color: colors.accentText, fontFamily: 'SpaceMono_700Bold', fontSize: 10 },
  options: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 2 },
  option: { minHeight: 44, width: '48%', flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  optionPressed: { opacity: 0.58 },
  optionText: { flexShrink: 1, fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 16, color: colors.textSecondary },
  optionTextSelected: { fontFamily: 'SpaceMono_700Bold', color: colors.text },
  radio: { width: 14, height: 14, flexShrink: 0, borderWidth: 1, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioSelected: { borderColor: colors.accent },
  radioCheck: { width: 4, height: 7, borderRightWidth: 1.5, borderBottomWidth: 1.5, borderColor: colors.accent, transform: [{ translateY: -1 }, { rotate: '45deg' }] },
  disabled: { opacity: 0.35 },
});
