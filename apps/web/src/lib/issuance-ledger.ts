export type DeliveryMode =
  | 'issued'
  | 'json_download'
  | 'json_copy'
  | 'encrypted_qr'
  | 'qr_payload_copy';

export interface IssuanceLedgerEntry {
  campaign_id: string;
  slot_index: number;
  claimant_address_hash: string;
  issuer_key_id: string;
  issued_at: number;
  expires_at: number;
  credential_hash: string;
  delivery_modes: DeliveryMode[];
}

export interface IssuanceLedgerSummary {
  total_issued: number;
  issued_today: number;
  active_issuers: number;
  expiring_within_7_days: number;
  storage_backend: 'upstash_redis' | 'local_file';
}

export interface IssuanceLedgerResponse {
  entries: IssuanceLedgerEntry[];
  summary: IssuanceLedgerSummary;
}
