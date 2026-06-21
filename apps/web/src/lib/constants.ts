// All values read from NEXT_PUBLIC_* env vars first; hard-coded testnet values are
// fallbacks so the app works without a .env.local during development.

export const CONTRACT_ID =
  process.env.NEXT_PUBLIC_CONTRACT_ID ||
  'CDCT4TCFKSIBOCFV6OATUJB2Y3GOF72KIG7NLOAK7Z4HMGYF4PE3V5NC';

export const VERIFIER_CONTRACT_ID =
  process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ||
  'CAVU2HNFWXALJG2FNFWZA4Y3WBV7VL5W7LBP4WYMZQFG26XHQNLTSAHQ';

export const XLM_SAC_ADDRESS =
  process.env.NEXT_PUBLIC_XLM_SAC_ADDRESS ||
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

export const ADMIN_ADDRESS =
  process.env.NEXT_PUBLIC_ADMIN_ADDRESS ||
  'GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ';

export const ISSUER_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_ISSUER_PUBLIC_KEY ||
  'GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4';

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
  '6631aeabd22a5cbca2274005d52490c4ee556c4eb7d97927e3eb9b724a26c2a7';

// SHA-256 of the Groth16 verification key JSON (circuits/aidshield-groth16/build/verification_key.json).
// Lets judges independently verify the on-chain VK matches the circuit build.
export const VK_HASH =
  process.env.NEXT_PUBLIC_VK_HASH ||
  'c243d169dcf36311eb4d12d5f0fe3016f8d6da21e7e41ca88474c0b477d4d128';

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

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(s: string): Uint8Array {
  const bytes: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of s) {
    const v = BASE32_ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`Invalid base32 char: ${ch}`);
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bytes.push((buf >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Uint8Array.from(bytes);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// Encodes a Stellar G... public key as a zero-padded 32-byte field element.
// StrKey decodes to version(1) + key(32) + checksum(2). We use key[1..31].
// 31 bytes (248 bits) always fits below the BLS12-381 scalar field prime (255 bits).
export function stellarAddressToField(address: string): string {
  const decoded = base32Decode(address);
  const fieldBytes = decoded.subarray(2, 33);
  return bytesToHex(fieldBytes).padStart(64, '0');
}

export const ISSUER_KEY_ID =
  process.env.NEXT_PUBLIC_ISSUER_KEY_ID ||
  stellarAddressToField(ISSUER_PUBLIC_KEY);
