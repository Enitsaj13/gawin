import { PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { ThemeColors, useAppTheme, useThemeStyles } from '@/theme/theme';
import { useAppLock } from './app-lock-context';
import { LockIcon, PinScreen } from './pin-screen';

export function AppLockGate({ children }: PropsWithChildren) {
  const lock = useAppLock();
  const { colors } = useAppTheme();
  const styles = useThemeStyles(createStyles);
  if (!lock.ready) return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  if (lock.storageError) return <View style={styles.cover}>
    <LockIcon />
    <Text style={styles.title}>App Lock could not load.</Text>
    <Text style={styles.body}>Gawin will stay closed until it can read your lock settings.</Text>
    <Pressable accessibilityRole="button" onPress={() => void lock.retryLoad()} style={styles.retry}><Text style={styles.title}>Try again</Text></Pressable>
  </View>;
  if (lock.enabled && lock.locked) return <PinScreen mode="unlock" />;
  return <View style={{ flex: 1 }}>
    {children}
    {lock.enabled && lock.covered ? <Modal animationType="none" visible onRequestClose={() => undefined}>
      <View style={styles.cover}><LockIcon /><Text style={styles.title}>Gawin</Text></View>
    </Modal> : null}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  cover: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontFamily: 'SpaceMono_700Bold', fontSize: 13, color: colors.text, textAlign: 'center' },
  body: { marginTop: 10, maxWidth: 300, fontFamily: 'SpaceMono_400Regular', fontSize: 11, lineHeight: 19, color: colors.textMuted, textAlign: 'center' },
  retry: { padding: 20, marginTop: 12, borderBottomWidth: 1, borderColor: colors.borderStrong },
});
