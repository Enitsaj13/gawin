import { getRandomBytesAsync } from 'expo-crypto';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useFeedback } from '@/features/preferences/preferences-context';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';
import { useAppLock } from './app-lock-context';
import { recoveryCode } from './pin-credentials';

export type PinMode = 'setup' | 'change' | 'disable' | 'unlock';
type Stage = 'verify' | 'create' | 'confirm' | 'save-recovery' | 'recover';

export function LockIcon() {
  const styles = useThemeStyles(createStyles);
  return <View accessible={false} style={styles.lockIcon}><View style={styles.lockArch} /><View style={styles.lockBody}><View style={styles.lockMark} /></View></View>;
}

function PinPad({ busy, onComplete }: { busy: boolean; onComplete: (pin: string) => Promise<void> }) {
  const styles = useThemeStyles(createStyles);
  const feedback = useFeedback();
  const [digits, setDigits] = useState('');
  const pending = useRef(false);
  const input = (value: string) => {
    if (busy || pending.current) return;
    if (value === 'delete') { setDigits((current) => current.slice(0, -1)); return; }
    feedback.selection();
    const next = digits + value;
    setDigits(next);
    if (next.length === 6) {
      pending.current = true;
      void onComplete(next).finally(() => { pending.current = false; setDigits(''); });
    }
  };
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (/^\d$/.test(event.key) || event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        input(/^\d$/.test(event.key) ? event.key : 'delete');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return <>
    <View accessibilityLabel={`${digits.length} of 6 digits entered`} style={styles.dots}>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.dot, index < digits.length && styles.dotFilled]} />)}
    </View>
    <View style={styles.keypad}>
      {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'delete'].map((key) => key ? (
        <Pressable
          accessibilityLabel={key === 'delete' ? 'Delete last digit' : key}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          key={key}
          onPress={() => input(key)}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed, busy && styles.disabled]}
        ><Text style={key === 'delete' ? styles.deleteKey : styles.keyText}>{key === 'delete' ? 'Delete' : key}</Text></Pressable>
      ) : <View key="blank" style={styles.key} />)}
    </View>
  </>;
}

export function PinScreen({ mode, onClose, onDone, onBusyChange }: { mode: PinMode; onClose?: () => void; onDone?: () => void; onBusyChange?: (busy: boolean) => void }) {
  const styles = useThemeStyles(createStyles);
  const { colors, statusBarStyle } = useAppTheme();
  const lock = useAppLock();
  const feedback = useFeedback();
  const [stage, setStage] = useState<Stage>(mode === 'setup' ? 'create' : 'verify');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now);
  const [recovering, setRecovering] = useState(false);
  const previousPin = useRef('');
  const newPin = useRef('');
  const inFlight = useRef(false);
  const seconds = Math.max(0, Math.ceil((lock.blockedUntil - now) / 1000));

  useEffect(() => {
    if (!lock.blockedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [lock.blockedUntil]);

  const perform = async (action: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    onBusyChange?.(true);
    setBusy(true);
    setError('');
    try { await action(); } catch (failure) {
      feedback.warning();
      setError(failure instanceof Error ? failure.message : 'Something went wrong. Please try again.');
    } finally { inFlight.current = false; onBusyChange?.(false); setBusy(false); setNow(Date.now()); }
  };

  const complete = async (pin: string) => perform(async () => {
    if (stage === 'verify') {
      if (mode === 'unlock') { await lock.unlock(pin); return; }
      if (mode === 'disable') { await lock.disable(pin); onDone?.(); return; }
      await lock.authenticate(pin);
      previousPin.current = pin;
      setStage('create');
    } else if (stage === 'create') {
      newPin.current = pin;
      setStage('confirm');
    } else if (stage === 'confirm') {
      if (pin !== newPin.current) throw new Error('PINs do not match. Try confirming again.');
      if (mode === 'setup') {
        setCode(recoveryCode(await getRandomBytesAsync(16)));
        setStage('save-recovery');
      } else if (recovering) {
        await lock.recover(code, pin);
      } else {
        await lock.changePin(previousPin.current, pin);
        onDone?.();
      }
    }
  });

  const title = stage === 'save-recovery' ? 'Save your recovery code'
    : stage === 'recover' ? 'Recover access'
    : stage === 'confirm' ? 'Confirm your PIN'
    : stage === 'create' ? (mode === 'setup' ? 'Create your PIN' : 'Create a new PIN')
    : mode === 'disable' ? 'Turn off App Lock' : mode === 'change' ? 'Enter your current PIN' : 'Enter your PIN';
  const description = stage === 'save-recovery' ? 'Keep this somewhere safe outside Gawin. You can use it to reset a forgotten PIN.'
    : stage === 'recover' ? 'Enter the recovery code you saved when enabling App Lock.'
    : stage === 'confirm' ? 'Enter those six digits once more.'
    : stage === 'create' ? 'Choose six digits to keep Gawin private.'
    : mode === 'disable' ? 'Enter your PIN to remove the lock.'
    : mode === 'change' ? 'Verify it before choosing a new one.' : 'A quiet space, just for you.';

  return <SafeAreaView edges={['top', 'bottom']} style={styles.screen}>
    <StatusBar style={statusBarStyle} />
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>Gawin</Text>
        {onClose ? <Pressable accessibilityRole="button" disabled={busy} onPress={onClose} style={styles.cancel}><Text style={styles.linkText}>Cancel</Text></Pressable> : null}
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <LockIcon />
          <Text accessibilityRole="header" style={styles.heading}>{title}</Text>
          <Text style={styles.description}>{description}</Text>
          {stage === 'save-recovery' ? <>
            <Text selectable style={styles.recoveryCode}>{code}</Text>
            <Text style={styles.note}>Select and copy this code. Without your PIN or recovery code, you cannot unlock Gawin.</Text>
            <Pressable accessibilityRole="button" disabled={busy} onPress={() => void perform(async () => { await lock.enable(newPin.current, code); onDone?.(); })} style={[styles.primary, busy && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Enabling…' : 'I saved my code · Enable lock'}</Text></Pressable>
          </> : stage === 'recover' ? <>
            <TextInput
              accessibilityLabel="Recovery code"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={48}
              onChangeText={setCode}
              placeholder="XXXX-XXXX-XXXX-XXXX-…"
              placeholderTextColor={colors.textMuted}
              selectionColor={colors.accent}
              style={[styles.recoveryInput, Platform.OS === 'web' && styles.webInput]}
              value={code}
            />
            <Text style={styles.note}>Your saved recovery code stays valid after resetting your PIN.</Text>
            <Pressable accessibilityRole="button" disabled={busy || seconds > 0 || !code.trim()} onPress={() => void perform(async () => { await lock.authenticateRecovery(code); setRecovering(true); setStage('create'); })} style={[styles.primary, (busy || seconds > 0 || !code.trim()) && styles.disabled]}><Text style={styles.primaryText}>{busy ? 'Checking…' : 'Continue'}</Text></Pressable>
          </> : <PinPad key={stage} busy={busy || seconds > 0} onComplete={complete} />}
          <Text accessibilityLiveRegion="polite" style={styles.message}>{seconds > 0 ? `Try again in ${seconds}s.` : busy ? 'Please wait…' : error || ' '}</Text>
          {mode === 'unlock' && (stage === 'verify' || stage === 'recover') ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setError(''); setCode(''); setStage(stage === 'verify' ? 'recover' : 'verify'); }} style={styles.textButton}><Text style={styles.linkText}>{stage === 'verify' ? 'Forgot PIN?' : 'Use PIN instead'}</Text></Pressable> : null}
          {stage === 'confirm' && !busy ? <Pressable accessibilityRole="button" onPress={() => { newPin.current = ''; setError(''); setStage('create'); }} style={styles.textButton}><Text style={styles.linkText}>Choose a different PIN</Text></Pressable> : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

export function PinModal({ mode, onClose, onDone }: { mode: Exclude<PinMode, 'unlock'>; onClose: () => void; onDone: () => void }) {
  const busy = useRef(false);
  return <Modal animationType="fade" onRequestClose={() => { if (!busy.current) onClose(); }} visible><PinScreen mode={mode} onClose={onClose} onDone={onDone} onBusyChange={(value) => { busy.current = value; }} /></Modal>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  topBar: { width: '100%', maxWidth: 560, alignSelf: 'center', minHeight: 70, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontFamily: 'SpaceMono_700Bold', fontSize: 14, color: colors.text },
  cancel: { minHeight: 44, justifyContent: 'center' },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingTop: 24, paddingBottom: 40 },
  content: { width: '100%', maxWidth: 340, alignSelf: 'center', alignItems: 'center' },
  lockIcon: { width: 24, height: 28, marginBottom: 22 },
  lockArch: { position: 'absolute', width: 14, height: 14, left: 5, top: 0, borderWidth: 1.5, borderColor: colors.textSecondary, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  lockBody: { position: 'absolute', width: 24, height: 18, bottom: 0, borderWidth: 1.5, borderColor: colors.textSecondary, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  lockMark: { width: 1.5, height: 5, backgroundColor: colors.textSecondary },
  heading: { fontFamily: 'SpaceMono_700Bold', fontSize: 20, color: colors.text, textAlign: 'center', letterSpacing: -0.7 },
  description: { marginTop: 10, fontFamily: 'SpaceMono_400Regular', fontSize: 11, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 15, marginTop: 34, marginBottom: 25 },
  dot: { width: 9, height: 9, borderWidth: 1, borderColor: colors.borderStrong },
  dotFilled: { backgroundColor: colors.accent, borderColor: colors.accent },
  keypad: { width: '100%', maxWidth: 290, flexDirection: 'row', flexWrap: 'wrap' },
  key: { width: '33.333%', minHeight: 60, alignItems: 'center', justifyContent: 'center' },
  keyPressed: { backgroundColor: colors.surfacePressed },
  keyText: { fontFamily: 'SpaceMono_400Regular', fontSize: 25, color: colors.text },
  deleteKey: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textSecondary },
  message: { minHeight: 38, marginTop: 14, fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },
  textButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  linkText: { fontFamily: 'SpaceMono_400Regular', fontSize: 10, color: colors.textSecondary, textDecorationLine: 'underline' },
  recoveryCode: { width: '100%', marginTop: 30, paddingVertical: 22, paddingHorizontal: 10, borderWidth: 1, borderColor: colors.borderStrong, fontFamily: 'SpaceMono_700Bold', fontSize: 13, lineHeight: 25, color: colors.text, textAlign: 'center' },
  note: { marginTop: 14, fontFamily: 'SpaceMono_400Regular', fontSize: 10, lineHeight: 18, color: colors.textMuted, textAlign: 'center' },
  recoveryInput: { width: '100%', minHeight: 54, marginTop: 26, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.accent, fontFamily: 'SpaceMono_400Regular', fontSize: 13, color: colors.text },
  webInput: { outlineWidth: 0 },
  primary: { alignSelf: 'stretch', minHeight: 52, marginTop: 26, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
  primaryText: { fontFamily: 'SpaceMono_700Bold', fontSize: 11, color: colors.accentText, textAlign: 'center' },
  disabled: { opacity: 0.45 },
});
