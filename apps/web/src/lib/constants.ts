// Disbursement contract v2: real XLM SAC + on-chain verifier (deployed 2026-06-16)
export const CONTRACT_ID = 'CBSGS6OBCWZ7Z464B7IOM2NGPRQ3QY55SYMJVWUGKCBHXOJVG3G7UV6P';
// UltraHonk structural verifier contract (VK: 26a99ba4..., circuit: aidshield-membership)
export const VERIFIER_CONTRACT_ID = 'CATC4XM7FA4HXCX5M27WFLOQEY5C23NHJZTGUJGFMQG6ZQISB7P4OWHH';
// XLM native SAC (Stellar Asset Contract) on testnet
export const XLM_SAC_ADDRESS = 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';
export const ADMIN_ADDRESS = 'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ';
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = 'https://horizon-testnet.stellar.org';
export const EXPLORER_BASE = 'https://stellar.expert/explorer/testnet';

export const DISBURSEMENT_ID = '0000000000000000000000000000000000000000000000000000000000000001';
export const MERKLE_ROOT = '051f8864362ed4acd0eb4d77172a28eb1258438b80ce1314c26797f54122cd0c';

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

// Encodes a Stellar G... public key as a 31-byte hex field element (safe for BN254).
// We use bytes 1-31 (248 bits) so the value always fits inside the BN254 field modulus.
export function stellarAddressToField(address: string): string {
  const { StrKey } = require('@stellar/stellar-sdk') as typeof import('@stellar/stellar-sdk');
  const bytes = StrKey.decodeEd25519PublicKey(address) as Buffer;
  return bytes.slice(1).toString('hex');
}
