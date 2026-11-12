import type { WebBiometricCredential } from './biometric-types';

export function toBase64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Invalid device credential.');
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export function checkClientData(data: ArrayBuffer, type: 'webauthn.create' | 'webauthn.get', challenge: string, origin: string) {
  const client = JSON.parse(new TextDecoder().decode(data));
  if (client.type !== type || client.challenge !== challenge || client.origin !== origin ||
      client.crossOrigin === true || (client.topOrigin !== undefined && client.topOrigin !== origin)) {
    throw new Error('Device verification did not match this unlock request.');
  }
}

export async function checkAuthenticatorData(data: ArrayBuffer, rpId: string) {
  const bytes = new Uint8Array(data);
  const rpHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)));
  if (bytes.length < 37 || !rpHash.every((byte, index) => byte === bytes[index]) || (bytes[32] & 0x05) !== 0x05) {
    throw new Error('Device presence and verification are required.');
  }
  return bytes;
}

// WebAuthn ES256 signatures use ASN.1 DER; WebCrypto expects a 64-byte r || s.
export function ecdsaSignature(signature: ArrayBuffer): Uint8Array<ArrayBuffer> {
  const der = new Uint8Array(signature);
  if (der.length < 8 || der[0] !== 0x30 || der[1] !== der.length - 2) throw new Error('Invalid device signature.');
  const raw = new Uint8Array(64);
  let offset = 2;
  for (let part = 0; part < 2; part += 1) {
    if (der[offset++] !== 0x02) throw new Error('Invalid device signature.');
    const length = der[offset++];
    if (!length || length > 33 || offset + length > der.length || (der[offset] & 0x80)) throw new Error('Invalid device signature.');
    let integer = der.slice(offset, offset + length);
    if (integer[0] === 0 && integer.length > 1) {
      if (!(integer[1] & 0x80)) throw new Error('Invalid device signature.');
      integer = integer.slice(1);
    }
    if (integer.length > 32) throw new Error('Invalid device signature.');
    raw.set(integer, (part + 1) * 32 - integer.length);
    offset += length;
  }
  if (offset !== der.length) throw new Error('Invalid device signature.');
  return raw;
}

export async function verifyAssertion(
  assertion: { id: string; clientDataJSON: ArrayBuffer; authenticatorData: ArrayBuffer; signature: ArrayBuffer; userHandle: ArrayBuffer | null },
  credential: WebBiometricCredential,
  challenge: string,
  origin: string,
) {
  if (origin !== credential.origin || assertion.id !== credential.id ||
      (assertion.userHandle !== null && toBase64Url(assertion.userHandle) !== credential.userId)) {
    throw new Error('This device credential does not match Gawin.');
  }
  checkClientData(assertion.clientDataJSON, 'webauthn.get', challenge, origin);
  const authenticator = await checkAuthenticatorData(assertion.authenticatorData, credential.rpId);
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', assertion.clientDataJSON));
  const signedData = new Uint8Array(authenticator.length + clientHash.length);
  signedData.set(authenticator);
  signedData.set(clientHash, authenticator.length);
  const key = await crypto.subtle.importKey('spki', fromBase64Url(credential.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, ecdsaSignature(assertion.signature), signedData)) {
    throw new Error('Device verification failed. Use your PIN or try again.');
  }
}
