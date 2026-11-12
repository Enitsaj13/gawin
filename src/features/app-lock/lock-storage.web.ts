import { LOCK_STORAGE_KEY } from './pin-credentials';

export async function readLock() { return window.localStorage.getItem(LOCK_STORAGE_KEY); }
export async function writeLock(value: string) { window.localStorage.setItem(LOCK_STORAGE_KEY, value); }
export async function removeLock() { window.localStorage.removeItem(LOCK_STORAGE_KEY); }

export async function withLockOperation<T>(action: () => Promise<T>): Promise<T> {
  // Keep retry counters and credential changes consistent across open tabs.
  if (navigator.locks) return navigator.locks.request('gawin-app-lock', action);
  return action();
}
