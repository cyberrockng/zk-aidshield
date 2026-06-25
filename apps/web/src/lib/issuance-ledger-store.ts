import { createHash, createHmac } from 'crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { BeneficiaryCredential } from './credential';
import type { DeliveryMode, IssuanceLedgerEntry, IssuanceLedgerResponse, IssuanceLedgerSummary } from './issuance-ledger';

const LEDGER_PATH = join(process.cwd(), '.data', 'issuance-ledger.json');
const RESERVATION_PATH = join(process.cwd(), '.data', 'issuance-reservations.json');
const LOCK_PATH = join(process.cwd(), '.data', 'issuance-ledger.lock');
const LOCK_TIMEOUT_MS = 5_000;

export type IssuanceStorageBackend = 'upstash_redis' | 'local_file';

export interface IssuanceReservation {
  ok: boolean;
  reason?: 'slot_already_issued' | 'wallet_already_issued';
  backend: IssuanceStorageBackend;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function ledgerHmacHex(value: string): string {
  const secret = process.env.LEDGER_HMAC_SECRET ?? process.env.ADMIN_API_SECRET;
  if (!secret) throw new Error('LEDGER_HMAC_SECRET is not configured on the server');
  return createHmac('sha256', secret).update(value).digest('hex');
}

function ensureLedgerDir() {
  mkdirSync(join(process.cwd(), '.data'), { recursive: true });
}

function storageBackend(): IssuanceStorageBackend {
  return process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? 'upstash_redis'
    : 'local_file';
}

function durableIssuanceRequired(): boolean {
  return process.env.REQUIRE_DURABLE_ISSUANCE === 'true';
}

async function withLocalLock<T>(fn: () => T | Promise<T>): Promise<T> {
  ensureLedgerDir();
  const started = Date.now();
  while (true) {
    try {
      const fd = openSync(LOCK_PATH, 'wx');
      try {
        return await fn();
      } finally {
        closeSync(fd);
        rmSync(LOCK_PATH, { force: true });
      }
    } catch (error) {
      const code = typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined;
      if (code !== 'EEXIST') throw error;
      if (Date.now() - started > LOCK_TIMEOUT_MS) throw new Error('Timed out waiting for issuance ledger lock');
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
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

function readReservations(): Set<string> {
  try {
    if (!existsSync(RESERVATION_PATH)) return new Set();
    const parsed = JSON.parse(readFileSync(RESERVATION_PATH, 'utf8')) as { reservations?: string[] };
    return new Set(Array.isArray(parsed.reservations) ? parsed.reservations : []);
  } catch {
    return new Set();
  }
}

function writeReservations(reservations: Set<string>) {
  ensureLedgerDir();
  writeFileSync(RESERVATION_PATH, JSON.stringify({ reservations: Array.from(reservations).sort() }, null, 2));
}

function reservationKeys(campaignId: string, slotIndex: number, claimantAddressHash: string): { slotKey: string; walletKey: string } {
  return {
    slotKey: `${campaignId}:slot:${slotIndex}`,
    walletKey: `${campaignId}:wallet:${claimantAddressHash}`,
  };
}

export function credentialHash(credential: BeneficiaryCredential): string {
  return sha256Hex(JSON.stringify(credential));
}

export function createLedgerEntry(credential: BeneficiaryCredential, deliveryMode: DeliveryMode = 'issued'): IssuanceLedgerEntry {
  return {
    campaign_id: credential.campaign_id,
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

function slotAlreadyIssued(entries: IssuanceLedgerEntry[], campaignId: string, slotIndex: number): boolean {
  return entries.some((entry) => (entry.campaign_id ?? campaignId) === campaignId && entry.slot_index === slotIndex);
}

function walletAlreadyIssued(entries: IssuanceLedgerEntry[], campaignId: string, claimantAddressHash: string): boolean {
  return entries.some((entry) => (entry.campaign_id ?? campaignId) === campaignId && entry.claimant_address_hash === claimantAddressHash);
}

async function upstashCommand<T = unknown>(command: unknown[]): Promise<T> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) throw new Error('Upstash Redis environment is not configured');

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash Redis command failed: ${res.status}`);
  const json = await res.json() as { result?: T; error?: string };
  if (json.error) throw new Error(`Upstash Redis command failed: ${json.error}`);
  return json.result as T;
}

async function reserveWithUpstash(campaignId: string, slotIndex: number, claimantAddressHash: string): Promise<IssuanceReservation> {
  const prefix = `aidshield:issuance:${campaignId}`;
  const slotKey = `${prefix}:slot:${slotIndex}`;
  const walletKey = `${prefix}:wallet:${claimantAddressHash}`;
  const value = JSON.stringify({ campaign_id: campaignId, slot_index: slotIndex, issued_at: Math.floor(Date.now() / 1000) });

  const slotResult = await upstashCommand<string | null>(['SET', slotKey, value, 'NX']);
  if (slotResult !== 'OK') {
    return { ok: false, reason: 'slot_already_issued', backend: 'upstash_redis' };
  }

  const walletResult = await upstashCommand<string | null>(['SET', walletKey, value, 'NX']);
  if (walletResult !== 'OK') {
    await upstashCommand<number>(['DEL', slotKey]);
    return { ok: false, reason: 'wallet_already_issued', backend: 'upstash_redis' };
  }

  return { ok: true, backend: 'upstash_redis' };
}

export async function reserveIssuance(campaignId: string, slotIndex: number, claimantAddress: string): Promise<IssuanceReservation> {
  const claimantAddressHash = ledgerHmacHex(claimantAddress);
  const backend = storageBackend();
  if (backend === 'upstash_redis') {
    return reserveWithUpstash(campaignId, slotIndex, claimantAddressHash);
  }
  if (durableIssuanceRequired()) {
    throw new Error('Durable issuance storage is required but Upstash Redis is not configured');
  }

  return withLocalLock(() => {
    const entries = readEntries();
    const reservations = readReservations();
    const { slotKey, walletKey } = reservationKeys(campaignId, slotIndex, claimantAddressHash);
    if (slotAlreadyIssued(entries, campaignId, slotIndex)) {
      return { ok: false, reason: 'slot_already_issued', backend: 'local_file' };
    }
    if (walletAlreadyIssued(entries, campaignId, claimantAddressHash)) {
      return { ok: false, reason: 'wallet_already_issued', backend: 'local_file' };
    }
    if (reservations.has(slotKey)) {
      return { ok: false, reason: 'slot_already_issued', backend: 'local_file' };
    }
    if (reservations.has(walletKey)) {
      return { ok: false, reason: 'wallet_already_issued', backend: 'local_file' };
    }
    reservations.add(slotKey);
    reservations.add(walletKey);
    writeReservations(reservations);
    return { ok: true, backend: 'local_file' };
  });
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
    storage_backend: storageBackend(),
  };
}

export function readIssuanceLedger(): IssuanceLedgerResponse {
  const entries = readEntries().sort((a, b) => b.issued_at - a.issued_at);
  return { entries, summary: summarize(entries) };
}
