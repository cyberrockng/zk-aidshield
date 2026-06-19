import type { BeneficiaryCredential } from './credential';

export const CREDENTIAL_QR_PREFIX = 'aidshield:credential:v2:';
export const ENCRYPTED_CREDENTIAL_QR_PREFIX = 'aidshield:credential:v2+enc:';

const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

function base64UrlEncode(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlToBytes(input: string): Uint8Array {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  return Uint8Array.from(Buffer.from(padded, 'base64'));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function getCrypto(): Crypto {
  const cryptoImpl = globalThis.crypto;
  if (!cryptoImpl?.subtle) throw new Error('WebCrypto is required for encrypted credential QR payloads');
  return cryptoImpl;
}

async function deriveQrKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const trimmed = passphrase.trim();
  if (trimmed.length < 8) throw new Error('QR passphrase must be at least 8 characters');

  const cryptoImpl = getCrypto();
  const keyMaterial = await cryptoImpl.subtle.importKey(
    'raw',
    new TextEncoder().encode(trimmed),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return cryptoImpl.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function encodeCredentialQr(credential: BeneficiaryCredential): string {
  return `${CREDENTIAL_QR_PREFIX}${base64UrlEncode(JSON.stringify(credential))}`;
}

export async function encodeEncryptedCredentialQr(
  credential: BeneficiaryCredential,
  passphrase: string,
): Promise<string> {
  const cryptoImpl = getCrypto();
  const salt = cryptoImpl.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = cryptoImpl.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveQrKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(credential));
  const ciphertext = new Uint8Array(await cryptoImpl.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext));

  return `${ENCRYPTED_CREDENTIAL_QR_PREFIX}${bytesToBase64Url(salt)}.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

export async function decodeCredentialQr(payload: string, passphrase?: string): Promise<BeneficiaryCredential> {
  const trimmed = payload.trim();
  let json: string;

  if (trimmed.startsWith(ENCRYPTED_CREDENTIAL_QR_PREFIX)) {
    const body = trimmed.slice(ENCRYPTED_CREDENTIAL_QR_PREFIX.length);
    const [saltRaw, ivRaw, cipherRaw] = body.split('.');
    if (!saltRaw || !ivRaw || !cipherRaw) throw new Error('Malformed encrypted credential QR payload');
    if (!passphrase?.trim()) throw new Error('Passphrase required for encrypted credential QR');

    try {
      const salt = base64UrlToBytes(saltRaw);
      const iv = base64UrlToBytes(ivRaw);
      const ciphertext = base64UrlToBytes(cipherRaw);
      const key = await deriveQrKey(passphrase, salt);
      const plaintext = await getCrypto().subtle.decrypt(
        { name: 'AES-GCM', iv: toArrayBuffer(iv) },
        key,
        toArrayBuffer(ciphertext),
      );
      json = new TextDecoder().decode(plaintext);
    } catch {
      throw new Error('Could not decrypt credential QR. Check the passphrase.');
    }
  } else if (trimmed.startsWith(CREDENTIAL_QR_PREFIX)) {
    json = base64UrlDecode(trimmed.slice(CREDENTIAL_QR_PREFIX.length));
  } else {
    json = trimmed;
  }

  return JSON.parse(json) as BeneficiaryCredential;
}

export function prettyCredentialJson(credential: BeneficiaryCredential): string {
  return JSON.stringify(credential, null, 2);
}
