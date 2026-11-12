import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkClientData, ecdsaSignature, toBase64Url, verifyAssertion } from '../src/features/app-lock/webauthn-verification.ts';
import { parseLockRecord } from '../src/features/app-lock/pin-credentials.ts';

function derSignature(raw) {
  const encode = (part) => {
    let number = part;
    while (number.length > 1 && number[0] === 0) number = number.slice(1);
    if (number[0] & 128) number = Uint8Array.from([0, ...number]);
    return [2, number.length, ...number];
  };
  const body = [...encode(raw.slice(0, 32)), ...encode(raw.slice(32))];
  return Uint8Array.from([48, body.length, ...body]).buffer;
}

async function fixture() {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const origin = 'https://gawin.example';
  const rpId = 'gawin.example';
  const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const credential = { kind: 'webauthn', id: toBase64Url(new Uint8Array([1, 2, 3])), publicKey: toBase64Url(await crypto.subtle.exportKey('spki', keys.publicKey)), userId: toBase64Url(new Uint8Array([4, 5, 6])), rpId, origin };
  const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge, origin, crossOrigin: false })).buffer;
  const authenticator = new Uint8Array(37);
  authenticator.set(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId))));
  authenticator[32] = 5; // User presence AND user verification.
  const data = new Uint8Array(69);
  data.set(authenticator);
  data.set(new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON)), 37);
  const signature = derSignature(new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, keys.privateKey, data)));
  return { credential, challenge, origin, assertion: { id: credential.id, clientDataJSON, authenticatorData: authenticator.buffer, signature, userHandle: null } };
}

test('a fresh assertion with verified user presence and a valid signature unlocks locally', async () => {
  const f = await fixture();
  await verifyAssertion(f.assertion, f.credential, f.challenge, f.origin);
});

test('replayed challenges, another origin, another credential and modified signatures are rejected', async () => {
  const f = await fixture();
  await assert.rejects(verifyAssertion(f.assertion, f.credential, 'another-challenge', f.origin));
  await assert.rejects(verifyAssertion(f.assertion, f.credential, f.challenge, 'https://other.example'));
  await assert.rejects(verifyAssertion({ ...f.assertion, id: 'wrong-id' }, f.credential, f.challenge, f.origin));
  await assert.rejects(verifyAssertion({ ...f.assertion, userHandle: new Uint8Array([9, 9]).buffer }, f.credential, f.challenge, f.origin));
  const signature = new Uint8Array(f.assertion.signature.slice(0));
  signature[signature.length - 1] ^= 1;
  await assert.rejects(verifyAssertion({ ...f.assertion, signature: signature.buffer }, f.credential, f.challenge, f.origin));
  const different = await fixture();
  await assert.rejects(verifyAssertion(f.assertion, { ...f.credential, publicKey: different.credential.publicKey }, f.challenge, f.origin));
});

test('missing user verification, user presence, and a wrong relying party hash fail closed', async () => {
  const f = await fixture();
  for (const flags of [0, 1, 4]) {
    const authenticator = new Uint8Array(f.assertion.authenticatorData.slice(0));
    authenticator[32] = flags;
    await assert.rejects(verifyAssertion({ ...f.assertion, authenticatorData: authenticator.buffer }, f.credential, f.challenge, f.origin));
  }
  await assert.rejects(verifyAssertion(f.assertion, { ...f.credential, rpId: 'other.example' }, f.challenge, f.origin));
});

test('registration rejects cross-origin client data and the wrong ceremony type', () => {
  const data = (extra) => new TextEncoder().encode(JSON.stringify({ type: 'webauthn.create', origin: 'https://gawin.example', challenge: 'fresh', ...extra })).buffer;
  assert.doesNotThrow(() => checkClientData(data({}), 'webauthn.create', 'fresh', 'https://gawin.example'));
  for (const extra of [{ crossOrigin: true }, { topOrigin: 'https://other.example' }, { type: 'webauthn.get' }]) {
    assert.throws(() => checkClientData(data(extra), 'webauthn.create', 'fresh', 'https://gawin.example'));
  }
});

test('DER signature conversion handles padded integers and rejects malformed signatures', () => {
  const raw = new Uint8Array(64).fill(255);
  assert.deepEqual(ecdsaSignature(derSignature(raw)), raw);
  const short = new Uint8Array(64);
  short[31] = 1;
  short[63] = 2;
  assert.deepEqual(ecdsaSignature(derSignature(short)), short);
  for (const invalid of [new Uint8Array(0), raw, Uint8Array.from([48, 6, 2, 1, 128, 2, 1, 1])]) {
    assert.throws(() => ecdsaSignature(invalid.buffer));
  }
});

test('existing PIN records survive the upgrade, while invalid biometric metadata is rejected', async () => {
  const base = { version: 1, pin: { salt: 'ab'.repeat(16), hash: 'cd'.repeat(32) }, recoveryHash: 'ef'.repeat(32), delay: 30, failures: 0, blockedUntil: 0 };
  assert.deepEqual(parseLockRecord(JSON.stringify(base)), base);
  const native = { ...base, biometric: { kind: 'native' } };
  assert.deepEqual(parseLockRecord(JSON.stringify(native)), native);
  const f = await fixture();
  const web = { ...base, biometric: f.credential };
  assert.deepEqual(parseLockRecord(JSON.stringify(web)), web);
  for (const biometric of [null, { kind: 'unknown' }, { kind: 'webauthn', id: 'incomplete' }]) {
    assert.throws(() => parseLockRecord(JSON.stringify({ ...base, biometric })));
  }
});
