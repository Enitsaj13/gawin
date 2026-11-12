import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { BiometricCredential, DeviceUnlockCapability, DeviceUnlockError } from './biometric-types';

export async function deviceUnlockCapability(): Promise<DeviceUnlockCapability> {
  const [hardware, enrolled, types, level] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(), LocalAuthentication.isEnrolledAsync(),
    LocalAuthentication.supportedAuthenticationTypesAsync(), LocalAuthentication.getEnrolledLevelAsync(),
  ]);
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  const fingerprint = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);
  const label = Platform.OS === 'ios' ? (face ? 'Face ID' : fingerprint ? 'Touch ID' : 'Device unlock') : face && fingerprint ? 'Biometric unlock' : fingerprint ? 'Fingerprint unlock' : 'Biometric unlock';
  const supported = hardware && enrolled && level === LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG;
  return { supported, label, icon: face && Platform.OS === 'ios' ? 'face' : fingerprint ? 'fingerprint' : 'device', description: supported
    ? 'Unlock with your device. Your Gawin PIN stays available.'
    : 'Set up Face ID or fingerprint in your device settings first.' };
}

async function prompt(signal: AbortSignal, enrolling = false) {
  if (signal.aborted) throw new DeviceUnlockError('Device unlock was cancelled.', true);
  const cancel = () => { if (Platform.OS === 'android') void LocalAuthentication.cancelAuthenticate(); };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: enrolling ? 'Enable device unlock for Gawin' : 'Unlock Gawin', promptSubtitle: 'Your tasks, kept private',
      cancelLabel: enrolling ? 'Cancel' : 'Use PIN', fallbackLabel: 'Use Gawin PIN', disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
    if (signal.aborted) throw new DeviceUnlockError('Device unlock was cancelled.', true);
    if (!result.success) {
      const cancelled = ['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback'].includes(result.error);
      throw new DeviceUnlockError(cancelled ? 'Use your PIN, or try device unlock again.'
        : result.error === 'lockout' ? 'Biometric unlock is temporarily unavailable. Use your Gawin PIN.'
          : 'Could not verify your identity. Use your PIN or try again.', cancelled);
    }
  } finally { signal.removeEventListener('abort', cancel); }
}

export async function enrollDevice(signal: AbortSignal): Promise<BiometricCredential> {
  if (!(await deviceUnlockCapability()).supported) throw new DeviceUnlockError('Set up device biometrics first. Your PIN is still available.');
  await prompt(signal, true);
  return { kind: 'native' };
}

export async function authenticateDevice(credential: BiometricCredential, signal: AbortSignal): Promise<void> {
  if (credential.kind !== 'native') throw new DeviceUnlockError('Set up device unlock again in Settings.');
  await prompt(signal);
}
