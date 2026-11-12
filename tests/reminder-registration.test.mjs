import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createECDH, webcrypto } from 'node:crypto';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../src/features/reminders/notifications.web.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function fixture({ permission = 'granted', existingDevice = false, orphan = false, legacy = false } = {}) {
  const api = 'https://reminders.example';
  const storageKey = 'gawin.push-device.v1';
  const values = new Map();
  const old = { id: 'a'.repeat(32), token: 'b'.repeat(64), connected: true, showTitles: false, revision: 10, api };
  if (existingDevice) values.set(storageKey, JSON.stringify(old));
  const receiver = createECDH('prime256v1'); receiver.generateKeys();
  const key = receiver.getPublicKey();
  let subscribed = existingDevice || orphan;
  let permissionRequests = 0;
  let unsubscribes = 0;
  let subscriptions = 0;
  let now = 1_000_000;
  let responseStatus = 200;
  const calls = [];
  const subscription = {
    options: { applicationServerKey: Uint8Array.from(key).buffer },
    toJSON: () => ({ endpoint: 'https://web.push.apple.com/device', keys: {} }),
    async unsubscribe() { unsubscribes++; subscribed = false; return true; },
  };
  const worker = { active: {}, pushManager: {
    async getSubscription() { return subscribed ? subscription : null; },
    async subscribe() { subscriptions++; subscribed = true; return subscription; },
  } };
  const notification = { permission, async requestPermission() { permissionRequests++; return permission; } };
  const navigator = { onLine: true, serviceWorker: { getRegistration: async () => worker, ready: Promise.resolve(worker) } };
  const indexedDB = { open() {
    const operation = {};
    queueMicrotask(() => {
      operation.result = { close() {}, transaction() {
        const transaction = { objectStore: () => ({ put() { queueMicrotask(() => transaction.oncomplete()); } }) };
        return transaction;
      } };
      operation.onsuccess();
    });
    return operation;
  } };
  const localStorage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const fetch = async (url, options) => {
    calls.push({ url, ...options });
    if (options.method === 'DELETE') return Response.json({ disconnected: true });
    if (responseStatus !== 200) return Response.json({ error: 'Please try again later. Your tasks are saved here.' }, { status: responseStatus, headers: { 'Retry-After': '60' } });
    if (url.endsWith('/v1/config')) return Response.json({ publicKey: key.toString('base64url'), ...(legacy ? {} : { registration: 'automatic' }) });
    return Response.json({ connected: true, reminders: [] });
  };
  const exports = {};
  const Clock = class extends Date { static now() { return now; } };
  new Function('exports', 'require', 'process', 'window', 'navigator', 'Notification', 'localStorage', 'indexedDB', 'crypto', 'fetch', 'Date', '__DEV__', compiled)(
    exports, require, { env: { EXPO_PUBLIC_REMINDER_API_URL: api } }, { isSecureContext: true, Notification: notification, PushManager: {} },
    navigator, notification, localStorage, indexedDB, webcrypto, fetch, Clock, false,
  );
  return { client: exports, calls, old, device: () => JSON.parse(values.get(storageKey) ?? 'null'),
    get permissionRequests() { return permissionRequests; }, get unsubscribes() { return unsubscribes; }, get subscriptions() { return subscriptions; },
    fail: (status) => { responseStatus = status; }, advance: (milliseconds) => { now += milliseconds; },
  };
}

test('notification enrollment is one tap and sends no shared setup secret', async () => {
  const f = fixture();
  await f.client.connectNotifications();
  assert.equal(f.calls.length, 2);
  assert.match(f.calls[0].url, /\/v1\/config$/);
  assert.match(f.calls[1].url, /\/v1\/devices\/[a-f0-9]{32}$/);
  assert.equal(f.calls[1].method, 'PUT');
  assert.equal(new Headers(f.calls[1].headers).has('X-Setup-Code'), false);
  assert.deepEqual(Object.keys(JSON.parse(f.calls[1].body)), ['subscription']);
  assert.equal(f.device().connected, true);
  assert.match(f.device().token, /^[a-f0-9]{64}$/);
});

test('denied notification permission creates no subscription or registration request', async () => {
  const f = fixture({ permission: 'denied' });
  const attempt = f.client.connectNotifications();
  assert.equal(f.permissionRequests, 1, 'permission is requested directly from the button gesture');
  await assert.rejects(attempt, /Allow notifications/);
  assert.equal(f.calls.length, 0);
  assert.equal(f.subscriptions, 0);
  assert.equal(f.device(), null);
});

test('reconnecting preserves existing device credentials and replaces an orphan subscription', async () => {
  const known = fixture({ existingDevice: true });
  await known.client.connectNotifications();
  assert.equal(known.device().id, known.old.id);
  assert.equal(known.device().token, known.old.token);
  assert.equal(known.unsubscribes, 0);
  const orphan = fixture({ orphan: true });
  await orphan.client.connectNotifications();
  assert.equal(orphan.unsubscribes, 1);
  assert.equal(orphan.subscriptions, 1);
});

test('service throttling backs off automatically while disconnect remains available', async () => {
  const f = fixture({ existingDevice: true });
  f.fail(429);
  await assert.rejects(f.client.synchronizeReminders([]), /Please try again later/);
  assert.equal(f.calls.length, 1);
  await assert.rejects(f.client.synchronizeReminders([]), /Please try again later/);
  assert.equal(f.calls.length, 1, 'no network retry before Retry-After');
  f.advance(60_001);
  await assert.rejects(f.client.synchronizeReminders([]), /Please try again later/);
  assert.equal(f.calls.length, 2);
  await f.client.disconnectNotifications();
  assert.equal(f.calls.at(-1).method, 'DELETE');
  assert.equal(f.device().connected, false);
});

test('an older backend gives an update message instead of asking users for a code', async () => {
  const f = fixture({ legacy: true });
  await assert.rejects(f.client.connectNotifications(), /setup is being updated/);
  assert.equal(f.subscriptions, 0);
  assert.equal(f.calls.length, 1);
});
