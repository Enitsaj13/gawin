import * as SecureStore from 'expo-secure-store';
import { LOCK_STORAGE_KEY } from './pin-credentials';

export const readLock = () => SecureStore.getItemAsync(LOCK_STORAGE_KEY);
export const writeLock = (value: string) => SecureStore.setItemAsync(LOCK_STORAGE_KEY, value, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});
export const removeLock = () => SecureStore.deleteItemAsync(LOCK_STORAGE_KEY);

export async function withLockOperation<T>(action: () => Promise<T>): Promise<T> { return action(); }
