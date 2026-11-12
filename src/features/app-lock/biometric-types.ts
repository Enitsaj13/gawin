export type BiometricIconKind = 'face' | 'fingerprint' | 'device';
export type DeviceUnlockCapability = {
  supported: boolean;
  label: string;
  icon: BiometricIconKind;
  description: string;
};
export type WebBiometricCredential = {
  kind: 'webauthn';
  id: string;
  publicKey: string;
  userId: string;
  rpId: string;
  origin: string;
};
export type BiometricCredential = { kind: 'native' } | WebBiometricCredential;

export class DeviceUnlockError extends Error {
  constructor(message: string, readonly cancelled = false) { super(message); this.name = 'DeviceUnlockError'; }
}
