export const CONTRACT_ID = 'CDYZQUX3PEMNXUEH3FA363RDIAXT7Y3OENHLZQLD5FE4ZNHMRKA43OSC';
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
