// All values read from NEXT_PUBLIC_* env vars first; hard-coded testnet values are
// fallbacks so the app works without a .env.local during development.

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  'CA2VG5CONVXIHLIIGT4LD6WLPU3ZJVL2UMO7NP2WAEL5R7LHKAZYS7R2';

export const VERIFIER_CONTRACT_ID =
  process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ||
  'CDANBD2PG5XAQYH57ERPSTLRCKODHKKGEPI7OSDEZR5EQ237KHYSELEE';

export const XLM_SAC_ADDRESS =
  process.env.NEXT_PUBLIC_XLM_SAC_ADDRESS ||
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export const ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_ADDRESS ||
  'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ';

export const NETWORK_PASSPHRASE =
  process.env.NEXT_PUBLIC_NETWORK_PASSPHRASE ||
  'Test SDF Network ; September 2015';

export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ||
  'https://soroban-testnet.stellar.org';

export const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ||
  'https://horizon-testnet.stellar.org';

export const EXPLORER_BASE =
  process.env.NEXT_PUBLIC_EXPLORER_BASE ||
  'https://stellar.expert/explorer/testnet';

export const DISBURSEMENT_ID =
  process.env.NEXT_PUBLIC_DISBURSEMENT_ID ||
  '0000000000000000000000000000000000000000000000000000000000000001';

export const MERKLE_ROOT =
  process.env.NEXT_PUBLIC_MERKLE_ROOT ||
  '222cfdd7cbb6d8c91a9e484793b805ed47707fedaf10eff66af45c2d2567adda';

export const STROOPS_PER_XLM = 10_000_000n;

export function stroopsToXlm(stroops: bigint | number): string {
  const n = typeof stroops === 'number' ? BigInt(stroops) : stroops;
  const whole = n / STROOPS_PER_XLM;
  const frac = n % STROOPS_PER_XLM;
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(7, '0').replace(/0+$/, '')}`;
}

export function shortHex(hex: string): string {
  if (hex.length <= 12) return hex;
  return `${hex.slice(0, 6)}…${hex.slice(-6)}`;
}

// Encodes a Stellar G... public key as a 31-byte hex field element (248 bits).
// 31 bytes always fits below both BN254 and BLS12-381 field moduli.
export function stellarAddressToField(address: string): string {
  const { StrKey } = require('@stellar/stellar-sdk') as typeof import('@stellar/stellar-sdk');
  const bytes = StrKey.decodeEd25519PublicKey(address) as Buffer;
  return bytes.slice(1).toString('hex');
}
