import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPinCredential, failedAttempt, hashRecovery, matchesPin, matchesRecovery, parseLockRecord, recoveryCode } from '../src/features/app-lock/pin-credentials.ts';

test('PIN verification uses a random salt, rejects wrong PINs, and stores no PIN', async () => {
  const first = await createPinCredential('481593', new Uint8Array(16).fill(1));
  const second = await createPinCredential('481593', new Uint8Array(16).fill(2));
  assert.notEqual(first.hash, second.hash);
  assert.equal(await matchesPin('481593', first), true);
  assert.equal(await matchesPin('481594', first), false);
  assert.equal(await matchesPin('123', first), false);
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: undefined });
    assert.equal(await matchesPin('481593', first), true, 'native JS fallback matches WebCrypto');
  } finally {
    Object.defineProperty(globalThis, 'crypto', cryptoDescriptor);
  }
  assert.deepEqual(Object.keys(first).sort(), ['hash', 'salt']);
  await assert.rejects(createPinCredential('12345', new Uint8Array(16)));
});

test('recovery accepts formatting differences and rejects another code', () => {
  const code = recoveryCode(new Uint8Array(16).fill(171));
  const hash = hashRecovery(code);
  assert.equal(matchesRecovery(code.toLowerCase().replaceAll('-', ' '), hash), true);
  assert.equal(matchesRecovery(recoveryCode(new Uint8Array(16).fill(172)), hash), false);
  assert.equal(matchesRecovery('ABCD', hash), false);
});

test('retry delays persist across reloads, escalate, and stay capped', () => {
  let record = { version: 1, pin: { salt: 'ab'.repeat(16), hash: 'cd'.repeat(32) }, recoveryHash: 'ef'.repeat(32), delay: 30, failures: 0, blockedUntil: 0 };
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    record = failedAttempt(record, 1000);
    assert.equal(record.blockedUntil, 0);
  }
  record = failedAttempt(record, 1000);
  assert.equal(parseLockRecord(JSON.stringify(record)).blockedUntil, 31000);
  record = failedAttempt(record, 1000);
  assert.equal(record.blockedUntil, 61000);
  for (let attempt = 0; attempt < 30; attempt += 1) record = failedAttempt(record, 1000);
  assert.equal(record.blockedUntil, 901000);
});

test('corrupt lock records fail closed rather than silently disabling the lock', () => {
  assert.equal(parseLockRecord(null), null);
  for (const invalid of ['{}', 'null', 'invalid', '{"version":2}']) assert.throws(() => parseLockRecord(invalid));
});
