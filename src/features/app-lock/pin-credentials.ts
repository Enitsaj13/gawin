import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

const ITERATIONS = 600_000;
export const LOCK_STORAGE_KEY = 'gawin.app-lock.v1';
export type LockDelay = 0 | 30;
export type PinCredential = { salt: string; hash: string };
export type LockRecord = {
  version: 1;
  pin: PinCredential;
  recoveryHash: string;
  delay: LockDelay;
  failures: number;
  blockedUntil: number;
};

function equal(first: string, second: string) {
  let difference = first.length ^ second.length;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first.charCodeAt(index) ^ (second.charCodeAt(index) || 0);
  }
  return difference === 0;
}

async function derive(pin: string, salt: string) {
  const password = utf8ToBytes(pin);
  const saltBytes = hexToBytes(salt);
  // Use the browser's asynchronous implementation when available. Hermes uses
  // the same KDF through noble, yielding between batches to keep input responsive.
  if (globalThis.crypto?.subtle) {
    const key = await globalThis.crypto.subtle.importKey('raw', password, 'PBKDF2', false, ['deriveBits']);
    const result = await globalThis.crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256,
    );
    return bytesToHex(new Uint8Array(result));
  }
  return bytesToHex(await pbkdf2Async(sha256, password, saltBytes, { c: ITERATIONS, dkLen: 32, asyncTick: 10 }));
}

export async function createPinCredential(pin: string, randomSalt: Uint8Array): Promise<PinCredential> {
  if (!/^\d{6}$/.test(pin) || randomSalt.length !== 16) throw new Error('Enter a six-digit PIN.');
  const salt = bytesToHex(randomSalt);
  return { salt, hash: await derive(pin, salt) };
}

export async function matchesPin(pin: string, credential: PinCredential) {
  if (!/^\d{6}$/.test(pin)) return false;
  return equal(await derive(pin, credential.salt), credential.hash);
}

export function recoveryCode(randomBytes: Uint8Array) {
  if (randomBytes.length !== 16) throw new Error('Invalid recovery code.');
  return bytesToHex(randomBytes).toUpperCase().match(/.{4}/g)!.join('-');
}

function normalizeRecovery(code: string) {
  return code.replace(/[\s-]/g, '').toUpperCase();
}

export function hashRecovery(code: string) {
  const normalized = normalizeRecovery(code);
  if (!/^[0-9A-F]{32}$/.test(normalized)) throw new Error('Enter the full recovery code.');
  return bytesToHex(sha256(utf8ToBytes(normalized)));
}

export function matchesRecovery(code: string, hash: string) {
  try { return equal(hashRecovery(code), hash); } catch { return false; }
}

export function failedAttempt(record: LockRecord, now = Date.now()): LockRecord {
  const failures = record.failures + 1;
  const delay = failures >= 5 ? Math.min(30 * 2 ** Math.min(failures - 5, 5), 900) : 0;
  return { ...record, failures, blockedUntil: delay ? now + delay * 1000 : 0 };
}

export function parseLockRecord(value: string | null): LockRecord | null {
  if (value === null) return null;
  const record = JSON.parse(value) as LockRecord;
  if (
    record?.version !== 1 || !/^[a-f0-9]{32}$/.test(record.pin?.salt) ||
    !/^[a-f0-9]{64}$/.test(record.pin?.hash) || !/^[a-f0-9]{64}$/.test(record.recoveryHash) ||
    ![0, 30].includes(record.delay) || !Number.isSafeInteger(record.failures) || record.failures < 0 ||
    !Number.isSafeInteger(record.blockedUntil) || record.blockedUntil < 0
  ) throw new Error('Unable to read App Lock.');
  return record;
}
