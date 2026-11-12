import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { createECDH, randomBytes, hkdfSync, createDecipheriv } from 'node:crypto';
import { handleRequest, dispatchDue, validateReminders, validSubscription } from '../services/reminders/worker.ts';

class Database {
  constructor(sqlite) { this.sqlite = sqlite; }
  prepare(sql) {
    const sqlite = this.sqlite;
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async first() { return sqlite.prepare(sql).get(...args) ?? null; },
      async all() { return { results: sqlite.prepare(sql).all(...args), success: true }; },
      async run() { const result = sqlite.prepare(sql).run(...args); return { success: true, meta: { changes: Number(result.changes) } }; },
    };
  }
  async batch(statements) {
    this.sqlite.exec('BEGIN');
    try { const values = []; for (const statement of statements) values.push(await statement.run()); this.sqlite.exec('COMMIT'); return values; }
    catch (error) { this.sqlite.exec('ROLLBACK'); throw error; }
  }
}
async function fixture(t) {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  sqlite.exec(readFileSync(new URL('../services/reminders/migrations/0001_reminders.sql', import.meta.url), 'utf8'));
  t.after(() => sqlite.close());
  const receiver = createECDH('prime256v1'); receiver.generateKeys();
  const vapid = createECDH('prime256v1'); vapid.generateKeys();
  const auth = randomBytes(16);
  const subscription = { endpoint: 'https://web.push.apple.com/test', keys: { p256dh: receiver.getPublicKey().toString('base64url'), auth: auth.toString('base64url') } };
  const env = { DB: new Database(sqlite), APP_ORIGIN: 'https://gawin.example', VAPID_PUBLIC_KEY: vapid.getPublicKey().toString('base64url'), VAPID_PRIVATE_KEY: vapid.getPrivateKey().toString('base64url'), VAPID_SUBJECT: 'mailto:owner@example.com', SETUP_CODE: randomBytes(32).toString('hex') };
  const id = randomBytes(16).toString('hex'), token = randomBytes(32).toString('hex');
  const api = (path = '', method = 'GET', data, extra = {}) => handleRequest(new Request(`https://reminders.example/v1/devices/${id}${path}`, { method, headers: { Origin: env.APP_ORIGIN, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra }, ...(data === undefined ? {} : { body: JSON.stringify(data) }) }), env);
  const connect = await api('', 'PUT', { subscription }, { 'X-Setup-Code': env.SETUP_CODE });
  assert.equal(connect.status, 200);
  const now = Date.now();
  const row = { id: 'meeting', version: 'a'.repeat(64), dueAt: now - 1000 };
  const sync = (rows, revision) => api('/reminders', 'PUT', { reminders: rows, revision });
  return { env, sqlite, receiver, auth, subscription, api, row, now, sync };
}
function decryptPush(body, receiver, auth) {
  const bytes = Buffer.from(body);
  const salt = bytes.subarray(0, 16), keyLength = bytes[20], sender = bytes.subarray(21, 21 + keyLength);
  const shared = receiver.computeSecret(sender);
  const info = Buffer.concat([Buffer.from('WebPush: info\0'), receiver.getPublicKey(), sender]);
  const ikm = hkdfSync('sha256', shared, auth, info, 32);
  const key = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16);
  const nonce = hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12);
  const encrypted = bytes.subarray(21 + keyLength);
  const decipher = createDecipheriv('aes-128-gcm', key, nonce);
  decipher.setAuthTag(encrypted.subarray(-16));
  const plain = Buffer.concat([decipher.update(encrypted.subarray(0, -16)), decipher.final()]);
  let end = plain.length - 1; while (plain[end] === 0) end--;
  assert.equal(plain[end], 2);
  return JSON.parse(plain.subarray(0, end).toString());
}

test('API requires the allowed origin, a connection code for enrollment, and a per-device token', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.api('/reminders', 'GET', undefined, { Origin: 'https://evil.example' })).status, 403);
  assert.equal((await f.api('/reminders', 'GET', undefined, { Authorization: `Bearer ${'0'.repeat(64)}` })).status, 401);
  const id = randomBytes(16).toString('hex');
  const response = await handleRequest(new Request(`https://reminders.example/v1/devices/${id}`, { method: 'PUT', headers: { Origin: f.env.APP_ORIGIN, Authorization: `Bearer ${'1'.repeat(64)}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription: f.subscription }) }), f.env);
  assert.equal(response.status, 403);
  assert.notEqual(f.sqlite.prepare('SELECT token_hash FROM devices').get().token_hash, '1'.repeat(64));
  assert.equal(validSubscription({ ...f.subscription, endpoint: 'https://internal.example/admin' }), false);
  assert.equal(validSubscription({ ...f.subscription, endpoint: 'http://web.push.apple.com/test' }), false);
});
test('monotonic snapshots reject stale writes and cancellation removes pending delivery', async (t) => {
  const f = await fixture(t);
  assert.equal((await f.sync([f.row], 2)).status, 200);
  assert.equal((await f.sync([], 1)).status, 409);
  assert.equal(f.sqlite.prepare('SELECT status FROM reminders').get().status, 'queued');
  assert.equal((await f.sync([], 3)).status, 200);
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('', { status: 201 }); });
  await dispatchDue(f.env, f.now);
  assert.equal(calls, 0);
  assert.equal(f.sqlite.prepare('SELECT status,body FROM reminders').get().status, 'cancelled');
});
test('a full reminder snapshot stays within the free-plan D1 query budget', async (t) => {
  const f = await fixture(t);
  const prepare = t.mock.method(f.env.DB, 'prepare');
  const rows = Array.from({ length: 100 }, (_, index) => ({ ...f.row, id: `task-${index}`, dueAt: f.now + index * 60_000 }));
  const result = await f.sync(rows, 1);
  assert.equal(result.status, 200);
  assert.equal((await result.json()).reminders.length, 100);
  assert.ok(prepare.mock.callCount() <= 50, 'a single request must fit Workers Free query limits');
  assert.equal((await f.sync([rows[0]], 2)).status, 200);
  assert.equal(f.sqlite.prepare("SELECT COUNT(*) AS count FROM reminders WHERE status='cancelled'").get().count, 99);
});
test('encrypted Apple-compatible pushes contain a generic body and are idempotent', async (t) => {
  const f = await fixture(t);
  await f.sync([f.row], 1);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url, request) => {
    calls++;
    assert.equal(url, f.subscription.endpoint);
    assert.equal(new Headers(request.headers).get('content-encoding'), 'aes128gcm');
    assert.match(new Headers(request.headers).get('authorization'), /^vapid /);
    const data = decryptPush(request.body, f.receiver, f.auth);
    assert.equal(data.body, 'You have an upcoming task.');
    assert.equal(data.taskId, f.row.id);
    return new Response('', { status: 201 });
  });
  await Promise.all([dispatchDue(f.env, f.now), dispatchDue(f.env, f.now)]);
  assert.equal(calls, 1);
  assert.equal(f.sqlite.prepare('SELECT status FROM reminders').get().status, 'sent');
  await f.sync([{ ...f.row, version: 'b'.repeat(64), body: 'Changed title' }], 2);
  await dispatchDue(f.env, f.now);
  assert.equal(calls, 1, 'editing text does not redeliver an already-sent time');
});
test('resync keeps an in-flight lease, and cancelling during a send cannot resurrect the reminder', async (t) => {
  const f = await fixture(t);
  await f.sync([f.row], 1);
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    await f.sync([f.row], 2);
    assert.equal(f.sqlite.prepare('SELECT status FROM reminders').get().status, 'sending');
    await dispatchDue(f.env, f.now);
    assert.equal(calls, 1);
    await f.sync([], 3);
    return new Response('', { status: 201 });
  });
  await dispatchDue(f.env, f.now);
  assert.equal(calls, 1);
  assert.equal(f.sqlite.prepare('SELECT status FROM reminders').get().status, 'cancelled');
});
test('temporary failures retry with a bound and expired reminders are not sent', async (t) => {
  const f = await fixture(t);
  await f.sync([f.row], 1);
  let calls = 0; t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response('', { status: 503 }); });
  await dispatchDue(f.env, f.now);
  await dispatchDue(f.env, f.now + 1000);
  assert.equal(calls, 1);
  await dispatchDue(f.env, f.now + 61_000);
  await dispatchDue(f.env, f.now + 182_000);
  assert.equal(calls, 3);
  assert.equal(f.sqlite.prepare('SELECT status FROM reminders').get().status, 'failed');
  await dispatchDue(f.env, f.now + 300_000);
  assert.equal(calls, 3);
  assert.throws(() => validateReminders([{ ...f.row, dueAt: f.now - 16 * 60_000 }], f.now));
  assert.throws(() => validateReminders([f.row, f.row], f.now));
});
test('expired push subscriptions require reconnecting instead of retrying forever', async (t) => {
  const f = await fixture(t); await f.sync([f.row], 1);
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 410 }));
  await dispatchDue(f.env, f.now);
  assert.equal((await f.api('/reminders')).status, 410);
  assert.equal(f.sqlite.prepare('SELECT invalid FROM devices').get().invalid, 1);
});
