import { BiometricCredential, DeviceUnlockCapability, DeviceUnlockError } from './biometric-types';
import { checkAuthenticatorData, checkClientData, fromBase64Url, toBase64Url, verifyAssertion } from './webauthn-verification';

export async function deviceUnlockCapability(): Promise<DeviceUnlockCapability> {
  const icon = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'face' : /Android/.test(navigator.userAgent) ? 'fingerprint' : 'device';
  const base = { label: 'Device unlock', icon } as const;
  if (!window.isSecureContext || !globalThis.crypto?.subtle || !globalThis.PublicKeyCredential ||
      !navigator.credentials || !globalThis.AuthenticatorAttestationResponse?.prototype.getPublicKey ||
      !PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
    return { ...base, supported: false, description: 'Device unlock needs a supported browser on HTTPS. Your PIN works here.' };
  }
  const supported = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  return { ...base, supported, description: supported
    ? 'Uses your device’s passkey prompt. Your PIN stays available.'
    : 'Set up device authentication in your phone or browser settings. Your PIN stays available.' };
}

function convertError(error: unknown): never {
  if (error instanceof DOMException && ['NotAllowedError', 'AbortError'].includes(error.name)) {
    throw new DeviceUnlockError('Device unlock was not completed. Use your PIN or try again.', true);
  }
  if (error instanceof DOMException && ['SecurityError', 'NotSupportedError', 'InvalidStateError'].includes(error.name)) {
    throw new DeviceUnlockError('Device unlock is unavailable here. Use your PIN and set it up again in Settings.');
  }
  throw new DeviceUnlockError('Could not verify device unlock. Use your PIN or try again.');
}

export async function enrollDevice(signal: AbortSignal): Promise<BiometricCredential> {
  try {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const userId = crypto.getRandomValues(new Uint8Array(16));
    const rpId = location.hostname;
    // Invoke directly from the button click, before storage or any asynchronous work.
    const result = await navigator.credentials.create({ signal, publicKey: {
      challenge,
      rp: { name: 'Gawin', id: rpId },
      user: { id: userId, name: 'Gawin App Lock', displayName: 'Gawin App Lock' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', residentKey: 'preferred', userVerification: 'required' },
      attestation: 'none', timeout: 60_000,
    } }) as PublicKeyCredential | null;
    if (!result || result.type !== 'public-key' || result.authenticatorAttachment === 'cross-platform') throw new Error('Missing platform credential.');
    const response = result.response as AuthenticatorAttestationResponse;
    const publicKey = response.getPublicKey();
    if (!publicKey || response.getPublicKeyAlgorithm() !== -7) throw new Error('Unsupported key.');
    checkClientData(response.clientDataJSON, 'webauthn.create', toBase64Url(challenge), location.origin);
    const data = await checkAuthenticatorData(response.getAuthenticatorData(), rpId);
    const idLength = data.length >= 55 ? (data[53] << 8) | data[54] : 0;
    if (!(data[32] & 0x40) || !idLength || data.length < 55 + idLength ||
        toBase64Url(data.slice(55, 55 + idLength)) !== toBase64Url(result.rawId)) throw new Error('Invalid credential ID.');
    await crypto.subtle.importKey('spki', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return { kind: 'webauthn', id: toBase64Url(result.rawId), publicKey: toBase64Url(publicKey), userId: toBase64Url(userId), rpId, origin: location.origin };
  } catch (error) { return convertError(error); }
}

export async function authenticateDevice(credential: BiometricCredential, signal: AbortSignal): Promise<void> {
  try {
    if (credential.kind !== 'webauthn' || credential.origin !== location.origin || credential.rpId !== location.hostname) throw new Error('Wrong origin.');
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const result = await navigator.credentials.get({ signal, publicKey: {
      challenge, rpId: credential.rpId, userVerification: 'required', timeout: 60_000,
      allowCredentials: [{ type: 'public-key', id: fromBase64Url(credential.id), transports: ['internal'] }],
    } }) as PublicKeyCredential | null;
    if (!result || result.type !== 'public-key' || result.authenticatorAttachment === 'cross-platform') throw new Error('Missing platform credential.');
    const response = result.response as AuthenticatorAssertionResponse;
    await verifyAssertion({ id: toBase64Url(result.rawId), clientDataJSON: response.clientDataJSON, authenticatorData: response.authenticatorData, signature: response.signature, userHandle: response.userHandle }, credential, toBase64Url(challenge), location.origin);
  } catch (error) { convertError(error); }
}
