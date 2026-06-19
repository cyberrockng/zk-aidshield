import { createHash, createHmac } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BeneficiaryCredential } from './credential';
import type { DeliveryMode, IssuanceLedgerEntry, IssuanceLedgerResponse, IssuanceLedgerSummary } from './issuance-ledger';

const LEDGER_PATH = join(process.cwd(), '.data', 'issuance-ledger.json');

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function ledgerHmacHex(value: string): string {
  const secret = process.env.LEDGER_HMAC_SECRET ?? process.env.ADMIN_API_SECRET;
  if (!secret) throw new Error('LEDGER_HMAC_SECRET is not configured on the server');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function ensureLedgerDir() {
  mkdirSync(join(process.cwd(), '.data'), { recursive: true });
}

function readEntries(): IssuanceLedgerEntry[] {
  try {
    if (!existsSync(LEDGER_PATH)) return [];
    const parsed = JSON.parse(readFileSync(LEDGER_PATH, 'utf8')) as { entries?: IssuanceLedgerEntry[] };
    return Array.isArray(parsed.entries) ? parsed.entries : [];
  } catch {
    return [];
  }
}

function writeEntries(entries: IssuanceLedgerEntry[]) {
  ensureLedgerDir();
  writeFileSync(LEDGER_PATH, JSON.stringify({ entries }, null, 2));
}

export function credentialHash(credential: BeneficiaryCredential): string {
  return sha256Hex(JSON.stringify(credential));
}

export function createLedgerEntry(credential: BeneficiaryCredential, deliveryMode: DeliveryMode = 'issued'): IssuanceLedgerEntry {
  return {
    slot_index: credential.slot_index,
    claimant_address_hash: ledgerHmacHex(credential.claimant_address),
    issuer_key_id: credential.issuer_key_id,
    issued_at: credential.issued_at,
    expires_at: credential.expires_at,
    credential_hash: credentialHash(credential),
    delivery_modes: [deliveryMode],
  };
}

export function appendIssuanceLedgerEntry(credential: BeneficiaryCredential): IssuanceLedgerEntry {
  const entries = readEntries();
  const next = createLedgerEntry(credential);
  const existingIndex = entries.findIndex((entry) => entry.credential_hash === next.credential_hash);

  if (existingIndex >= 0) {
    entries[existingIndex] = {
      ...entries[existingIndex],
      delivery_modes: Array.from(new Set([...entries[existingIndex].delivery_modes, 'issued'])),
    };
  } else {
    entries.push(next);
  }

  writeEntries(entries);
  return next;
}

export function recordLedgerDelivery(credentialHashValue: string, deliveryMode: DeliveryMode): IssuanceLedgerEntry | null {
  const entries = readEntries();
  const index = entries.findIndex((entry) => entry.credential_hash === credentialHashValue);
  if (index < 0) return null;

  entries[index] = {
    ...entries[index],
    delivery_modes: Array.from(new Set([...entries[index].delivery_modes, deliveryMode])),
  };
  writeEntries(entries);
  return entries[index];
}

function summarize(entries: IssuanceLedgerEntry[]): IssuanceLedgerSummary {
  const now = Math.floor(Date.now() / 1000);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySeconds = Math.floor(today.getTime() / 1000);
  const sevenDays = now + 7 * 24 * 3600;

  return {
    total_issued: entries.length,
    issued_today: entries.filter((entry) => entry.issued_at >= todaySeconds).length,
    active_issuers: new Set(entries.map((entry) => entry.issuer_key_id)).size,
    expiring_within_7_days: entries.filter((entry) => entry.expires_at >= now && entry.expires_at <= sevenDays).length,
  };
}

export function readIssuanceLedger(): IssuanceLedgerResponse {
  const entries = readEntries().sort((a, b) => b.issued_at - a.issued_at);
  return { entries, summary: summarize(entries) };
}
