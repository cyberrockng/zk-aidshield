'use client';

import { NETWORK_PASSPHRASE } from './constants';

export async function isFreighterInstalled(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { isConnected } = await import('@stellar/freighter-api');
    const result = await isConnected();
    if (typeof result === 'boolean') return result;
    return (result as { isConnected: boolean }).isConnected;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string> {
  if (typeof window === 'undefined') throw new Error('Browser-only');

  const installed = await isFreighterInstalled();
  if (!installed) {
    throw new Error(
      'Freighter not found — install the browser extension from freighter.app then reload'
    );
  }

  const { requestAccess, getAddress } = await import('@stellar/freighter-api');

  const accessResult = await requestAccess();
  if (accessResult && typeof accessResult === 'object' && 'error' in accessResult) {
    throw new Error(`Wallet access denied: ${(accessResult as { error: string }).error}`);
  }

  const raw = await getAddress();
  if (typeof raw === 'string') return raw;
  const obj = raw as { address?: string; error?: string };
  if (obj.error) throw new Error(`Could not get address: ${obj.error}`);
  if (obj.address) return obj.address;
  throw new Error('Freighter returned an unexpected response from getAddress()');
}

export const getWalletAddress = connectWallet;

export async function signTx(txXdr: string, address?: string): Promise<string> {
  const { signTransaction } = await import('@stellar/freighter-api');

  const opts: Record<string, unknown> = {
    network: 'TESTNET',
    networkPassphrase: NETWORK_PASSPHRASE,
  };
  if (address) opts.address = address;

  const result = await signTransaction(txXdr, opts);

  if (typeof result === 'string') return result;
  const obj = result as { signedTxXdr?: string; error?: string };
  if (obj.error) throw new Error(`Signing rejected: ${obj.error}`);
  if (obj.signedTxXdr) return obj.signedTxXdr;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any).signedTxXdr ?? (result as any);
}
