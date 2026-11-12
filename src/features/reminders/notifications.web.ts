import type { NotificationInfo, ReminderEvent, RemoteReminder, RemoteStatus } from './types';

const API = (process.env.EXPO_PUBLIC_REMINDER_API_URL ?? '').replace(/\/$/, '');
const STORAGE = 'gawin.push-device.v1';
type Device = { id: string; token: string; connected: boolean; showTitles: boolean; revision: number; api: string; resetSubscription?: boolean };
let registration: ServiceWorkerRegistration | null = null;
let audio: AudioContext | null = null;
let audioTimer: ReturnType<typeof setInterval> | undefined;
let audioStop: ReturnType<typeof setTimeout> | undefined;
let retryNotBefore = 0;
let retryMessage = '';
const GENERIC = 'You have an upcoming task.';
export function isOnline() { return navigator.onLine; }
export const supportsAlarmSound = true;
function saved(): Device | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
    return value && /^[a-f0-9]{32}$/.test(value.id) && /^[a-f0-9]{64}$/.test(value.token) &&
      typeof value.api === 'string' && typeof value.connected === 'boolean' && typeof value.showTitles === 'boolean' &&
      Number.isSafeInteger(value.revision) ? value : null;
  } catch { return null; }
}
function save(device: Device) { localStorage.setItem(STORAGE, JSON.stringify(device)); }
function randomHex(size: number) { return Array.from(crypto.getRandomValues(new Uint8Array(size)), (byte) => byte.toString(16).padStart(2, '0')).join(''); }
function apiConfigured() {
  try { const url = new URL(API); return url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)); } catch { return false; }
}
export async function notificationInfo(): Promise<NotificationInfo> {
  const supported = window.isSecureContext && 'Notification' in window && 'PushManager' in window && 'serviceWorker' in navigator;
  const device = saved();
  const connected = Boolean(device?.connected && device.api === API && supported && Notification.permission === 'granted');
  return { supported, configured: apiConfigured(), connected, permission: supported ? Notification.permission : 'unavailable', showTitles: device?.showTitles ?? false,
    description: !supported ? 'On iPhone, add Gawin to your Home Screen to enable background notifications.'
      : Notification.permission === 'denied' ? 'Notifications are blocked. Allow Gawin in your phone or browser settings.'
        : !apiConfigured() ? 'Background reminders are not connected yet. In-app reminders work while Gawin is open.'
          : connected ? 'Background notifications are connected. Delivery needs internet and follows your phone settings.'
            : 'Connect this device to receive reminders while Gawin is closed.' };
}
async function getRegistration() {
  if (registration?.active) return registration;
  const existing = await navigator.serviceWorker.getRegistration('/');
  if (!existing) await navigator.serviceWorker.register(__DEV__ ? '/reminder-sw.js' : '/sw.js', { scope: '/', updateViaCache: 'none' });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Notification setup is taking too long. Reopen Gawin and try again.')), 12_000); }),
    ]);
    return registration;
  } finally { clearTimeout(timer); }
}
async function request(path: string, method: string, data?: unknown) {
  if (!isOnline()) throw new Error('Connect to the internet to update background reminders.');
  if (!apiConfigured()) throw new Error('Background reminders are not connected yet.');
  if (method !== 'DELETE' && Date.now() < retryNotBefore) throw new Error(retryMessage);
  const device = saved();
  let response: Response;
  try { response = await fetch(`${API}${path}`, { method, cache: 'no-store', signal: AbortSignal.timeout(15_000), headers: {
    'Content-Type': 'application/json', ...(device ? { Authorization: `Bearer ${device.token}` } : {}),
  }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }); }
  catch { throw new Error('Could not reach the reminder service. Your changes are saved and will retry.'); }
  let result: { error?: unknown; publicKey?: string; reminders?: RemoteStatus[]; registration?: string };
  try { result = await response.json(); }
  catch { throw new Error('The reminder service did not respond correctly. Please try again.'); }
  if (!response.ok) {
    if (device && (response.status === 401 || response.status === 410)) save({ ...device, connected: false, resetSubscription: response.status === 410 });
    const message = typeof result.error === 'string' ? result.error : 'Reminders could not sync. Please try again.';
    const retrySeconds = Number(response.headers.get('Retry-After'));
    if ([429, 503].includes(response.status) && retrySeconds > 0 && Number.isFinite(retrySeconds)) {
      retryNotBefore = Date.now() + Math.min(retrySeconds, 86400) * 1000;
      retryMessage = message;
    }
    if (response.status === 409 && method === 'PUT' && !path.endsWith('/reminders') && device) {
      save({ ...device, connected: false, resetSubscription: true });
    }
    throw new Error(message);
  }
  return result;
}
function publicKeyBytes(key: string) {
  const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - key.length % 4) % 4));
  return Uint8Array.from(decoded, (letter) => letter.charCodeAt(0));
}
export async function connectNotifications() {
  // Request permission directly from the user's button press.
  const permission = 'Notification' in window ? (Notification.permission === 'granted' ? Promise.resolve('granted') : Notification.requestPermission()) : Promise.resolve('denied');
  if (await permission !== 'granted') throw new Error('Allow notifications to connect reminders on this device.');
  const worker = await getRegistration();
  const config = await request('/v1/config', 'GET');
  if (typeof config.publicKey !== 'string') throw new Error('The reminder service is not ready. Please try again later.');
  if (config.registration !== 'automatic') throw new Error('Notification setup is being updated. Please try again later.');
  const old = saved();
  let subscription = await worker.pushManager.getSubscription();
  const expectedKey = publicKeyBytes(config.publicKey);
  const subscribedKey = subscription?.options.applicationServerKey ? new Uint8Array(subscription.options.applicationServerKey) : null;
  const changedKey = subscribedKey && (subscribedKey.length !== expectedKey.length || !subscribedKey.every((byte, index) => byte === expectedKey[index]));
  if ((!old || old.api !== API || old.resetSubscription || changedKey) && subscription) { await subscription.unsubscribe(); subscription = null; }
  if (!subscription) subscription = await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKeyBytes(config.publicKey) });
  const device = old?.api === API ? old : { id: randomHex(16), token: randomHex(32), connected: false, showTitles: false, revision: 0, api: API };
  save(device);
  await request(`/v1/devices/${device.id}`, 'PUT', { subscription: subscription.toJSON() });
  save({ ...device, connected: true, resetSubscription: false });
  await setNotificationPrivacy(device.showTitles);
}
export async function disconnectNotifications() {
  const device = saved();
  if (!device) return;
  await request(`/v1/devices/${device.id}`, 'DELETE');
  save({ ...device, connected: false });
  const subscription = await (await getRegistration()).pushManager.getSubscription();
  await subscription?.unsubscribe().catch(() => undefined);
}
export async function testNotification() {
  const device = saved();
  if (!device?.connected) throw new Error('Connect notifications first.');
  await request(`/v1/devices/${device.id}/test`, 'POST', {});
}
export async function synchronizeReminders(rows: RemoteReminder[]): Promise<RemoteStatus[]> {
  const device = saved();
  if (!device?.connected || device.api !== API) throw new Error('Connect notifications in Settings.');
  const revision = Math.max(Date.now(), device.revision + 1);
  save({ ...device, revision });
  const result = await request(`/v1/devices/${device.id}/reminders`, 'PUT', { revision, reminders: rows });
  return result.reminders as RemoteStatus[];
}
export async function fetchReminderStatuses(): Promise<RemoteStatus[]> {
  const device = saved();
  if (!device?.connected) return [];
  return (await request(`/v1/devices/${device.id}/reminders`, 'GET')).reminders as RemoteStatus[];
}
export async function reminderVersion(row: Omit<RemoteReminder, 'version'>) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(row)))), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
export function persistOutbox(rows: RemoteReminder[]) { localStorage.setItem('gawin.reminder-outbox.v1', JSON.stringify(rows)); }

function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const operation = indexedDB.open('gawin-reminders', 1);
    operation.onupgradeneeded = () => { operation.result.createObjectStore('receipts'); operation.result.createObjectStore('settings'); };
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
  });
}
async function read(store: string, key: string): Promise<unknown> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(store, 'readonly');
    const operation = transaction.objectStore(store).get(key);
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => reject(operation.error);
    transaction.oncomplete = () => db.close();
  });
}
async function write(store: string, key: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(store, 'readwrite');
    transaction.objectStore(store).put(value, key);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
export async function setNotificationPrivacy(showTitles: boolean) {
  const device = saved();
  if (device) save({ ...device, showTitles });
  await write('settings', 'showTitles', showTitles);
}
export async function wasPresented(key: string) { return Boolean(await read('receipts', key)); }
export async function markPresented(key: string) { await write('receipts', key, Date.now()); }
export function notificationEvents(handler: (event: ReminderEvent) => void) {
  const listener = (event: MessageEvent) => {
    if (event.data?.type === 'GAWIN_REMINDER' && typeof event.data.taskId === 'string') handler({ type: 'reminder', taskId: event.data.taskId, reminderAt: event.data.reminderAt });
    if (event.data?.type === 'GAWIN_OPEN_TASK' && typeof event.data.taskId === 'string') handler({ type: 'open', taskId: event.data.taskId });
  };
  navigator.serviceWorker?.addEventListener('message', listener);
  return () => navigator.serviceWorker?.removeEventListener('message', listener);
}
export async function enableAlarmSound() {
  audio ??= new AudioContext();
  await audio.resume();
  if (audio.state !== 'running') throw new Error('Tap again to allow alarm sound in this session.');
}
function tone() {
  if (!audio || audio.state !== 'running' || document.visibilityState !== 'visible') return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const start = audio.currentTime;
  oscillator.type = 'sine'; oscillator.frequency.value = 660;
  volume.gain.setValueAtTime(0, start); volume.gain.linearRampToValueAtTime(0.12, start + 0.02); volume.gain.exponentialRampToValueAtTime(0.001, start + 0.7);
  oscillator.connect(volume); volume.connect(audio.destination);
  oscillator.start(start); oscillator.stop(start + 0.75);
  oscillator.onended = () => { oscillator.disconnect(); volume.disconnect(); };
}
export function stopAlarmSound() { clearInterval(audioTimer); clearTimeout(audioStop); }
export function playAlarmSound() {
  stopAlarmSound(); tone();
  audioTimer = setInterval(tone, 3000);
  audioStop = setTimeout(stopAlarmSound, 60_000);
}
export function previewAlarmSound() { tone(); }
export function notificationBody(title: string, showTitles: boolean) { return showTitles ? title : GENERIC; }
