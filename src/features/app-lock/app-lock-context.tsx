import { getRandomBytesAsync } from 'expo-crypto';
import { AppState, Platform } from 'react-native';
import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { readLock, removeLock, withLockOperation, writeLock } from './lock-storage';
import { createPinCredential, failedAttempt, hashRecovery, LOCK_STORAGE_KEY, LockDelay, LockRecord, matchesPin, matchesRecovery, parseLockRecord } from './pin-credentials';

type AppLockContextValue = {
  ready: boolean;
  storageError: boolean;
  enabled: boolean;
  locked: boolean;
  covered: boolean;
  delay: LockDelay;
  blockedUntil: number;
  retryLoad: () => Promise<void>;
  enable: (pin: string, recovery: string) => Promise<void>;
  authenticate: (pin: string) => Promise<void>;
  authenticateRecovery: (code: string) => Promise<void>;
  unlock: (pin: string) => Promise<void>;
  changePin: (oldPin: string, newPin: string) => Promise<void>;
  recover: (code: string, newPin: string) => Promise<void>;
  disable: (pin: string) => Promise<void>;
  setDelay: (delay: LockDelay) => Promise<void>;
  lockNow: () => void;
};
const Context = createContext<AppLockContextValue | null>(null);

export function AppLockProvider({ children }: PropsWithChildren) {
  const [record, setRecord] = useState<LockRecord | null>(null);
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [locked, setLocked] = useState(true);
  const [covered, setCovered] = useState(false);
  const recordRef = useRef<LockRecord | null>(null);
  const activeRef = useRef(true);
  const sessionRef = useRef(0);
  const busyRef = useRef(false);

  const persist = useCallback(async (next: LockRecord | null) => {
    if (next) await writeLock(JSON.stringify(next));
    else await removeLock();
    recordRef.current = next;
    setRecord(next);
  }, []);

  const retryLoad = useCallback(async () => {
    try {
      const stored = parseLockRecord(await readLock());
      recordRef.current = stored;
      setRecord(stored);
      setStorageError(false);
      setLocked(Boolean(stored));
      setReady(true);
    } catch {
      setStorageError(true);
      setReady(true);
    }
  }, []);

  useEffect(() => { void Promise.resolve().then(retryLoad); }, [retryLoad]);

  const lockNow = useCallback(() => {
    sessionRef.current += 1;
    setLocked(true);
  }, []);

  useEffect(() => {
    let hiddenAt: number | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const visibility = (active: boolean) => {
      activeRef.current = active;
      if (!recordRef.current) return;
      setCovered(!active);
      if (!active && hiddenAt === null) {
        hiddenAt = Date.now();
        const delay = recordRef.current.delay * 1000;
        if (!delay) lockNow();
        else timer = setTimeout(lockNow, delay);
      } else if (active && hiddenAt !== null) {
        clearTimeout(timer);
        if (Date.now() - hiddenAt >= recordRef.current.delay * 1000) lockNow();
        hiddenAt = null;
      }
    };
    if (Platform.OS === 'web') {
      const onVisibility = () => visibility(document.visibilityState === 'visible');
      const onPageHide = () => visibility(false);
      const onStorage = (event: StorageEvent) => {
        // Another tab changed credentials, attempts, or the lock setting.
        if (event.key === LOCK_STORAGE_KEY || event.key === null) {
          lockNow();
          void retryLoad();
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('pagehide', onPageHide);
      window.addEventListener('pageshow', onVisibility);
      window.addEventListener('storage', onStorage);
      onVisibility();
      return () => {
        clearTimeout(timer);
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('pagehide', onPageHide);
        window.removeEventListener('pageshow', onVisibility);
        window.removeEventListener('storage', onStorage);
      };
    }
    visibility(AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => visibility(state === 'active'));
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [lockNow, retryLoad]);

  // Serialize local attempts and reread persisted cooldowns before checking.
  const run = useCallback(async (action: () => Promise<void>) => {
    if (busyRef.current) throw new Error('Please wait a moment.');
    busyRef.current = true;
    try { await withLockOperation(action); } finally { busyRef.current = false; }
  }, []);

  const verify = useCallback(async (value: string, recovery = false) => {
    const current = parseLockRecord(await readLock());
    if (!current) throw new Error('App Lock is unavailable. Reopen Gawin to try again.');
    if (current.blockedUntil > Date.now()) {
      recordRef.current = current;
      setRecord(current);
      throw new Error('Too many attempts. Please wait before trying again.');
    }
    const correct = recovery ? matchesRecovery(value, current.recoveryHash) : await matchesPin(value, current.pin);
    const next = correct ? { ...current, failures: 0, blockedUntil: 0 } : failedAttempt(current);
    await persist(next);
    if (!correct) throw new Error(recovery ? 'That recovery code is incorrect.' : 'That PIN is incorrect. Try again.');
    return next;
  }, [persist]);

  const authenticate = useCallback((pin: string) => run(async () => { await verify(pin); }), [run, verify]);
  const authenticateRecovery = useCallback((code: string) => run(async () => { await verify(code, true); }), [run, verify]);
  const unlock = useCallback((pin: string) => run(async () => {
    const session = sessionRef.current;
    await verify(pin);
    if (session !== sessionRef.current || !activeRef.current) throw new Error('Please unlock again.');
    setLocked(false);
  }), [run, verify]);
  const enable = useCallback((pin: string, recovery: string) => run(async () => {
    if (parseLockRecord(await readLock())) throw new Error('App Lock is already enabled.');
    const credential = await createPinCredential(pin, await getRandomBytesAsync(16));
    await persist({ version: 1, pin: credential, recoveryHash: hashRecovery(recovery), delay: 30, failures: 0, blockedUntil: 0 });
    setLocked(!activeRef.current);
  }), [persist, run]);
  const changePin = useCallback((oldPin: string, newPin: string) => run(async () => {
    const current = await verify(oldPin);
    const credential = await createPinCredential(newPin, await getRandomBytesAsync(16));
    await persist({ ...current, pin: credential });
  }), [persist, run, verify]);
  const recover = useCallback((code: string, newPin: string) => run(async () => {
    const session = sessionRef.current;
    const current = await verify(code, true);
    const credential = await createPinCredential(newPin, await getRandomBytesAsync(16));
    await persist({ ...current, pin: credential });
    if (activeRef.current && session === sessionRef.current) setLocked(false);
  }), [persist, run, verify]);
  const disable = useCallback((pin: string) => run(async () => {
    await verify(pin);
    await persist(null);
    setLocked(false);
    setCovered(false);
  }), [persist, run, verify]);
  const setDelay = useCallback((delay: LockDelay) => run(async () => {
    const current = parseLockRecord(await readLock());
    if (!current || locked) throw new Error('Unlock Gawin first.');
    await persist({ ...current, delay });
  }), [locked, persist, run]);

  return <Context.Provider value={{ ready, storageError, enabled: Boolean(record), locked, covered, delay: record?.delay ?? 30, blockedUntil: record?.blockedUntil ?? 0, retryLoad, enable, authenticate, authenticateRecovery, unlock, changePin, recover, disable, setDelay, lockNow }}>{children}</Context.Provider>;
}

export function useAppLock() {
  const value = useContext(Context);
  if (!value) throw new Error('App Lock provider is missing.');
  return value;
}
