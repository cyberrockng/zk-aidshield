import type { BeneficiaryCredential } from './credential';

export const CREDENTIAL_QR_PREFIX = 'aidshield:credential:v2:';

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

export function encodeCredentialQr(credential: BeneficiaryCredential): string {
  return `${CREDENTIAL_QR_PREFIX}${base64UrlEncode(JSON.stringify(credential))}`;
}

export function decodeCredentialQr(payload: string): BeneficiaryCredential {
  const trimmed = payload.trim();
  const json = trimmed.startsWith(CREDENTIAL_QR_PREFIX)
    ? base64UrlDecode(trimmed.slice(CREDENTIAL_QR_PREFIX.length))
    : trimmed;
  return JSON.parse(json) as BeneficiaryCredential;
}

export function prettyCredentialJson(credential: BeneficiaryCredential): string {
  return JSON.stringify(credential, null, 2);
}
