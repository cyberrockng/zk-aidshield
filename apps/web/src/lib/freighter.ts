'use client';

import { NETWORK_PASSPHRASE } from './constants';

export async function getWalletAddress(): Promise<string> {
  if (typeof window === 'undefined') throw new Error('Browser-only');

  const {
    isConnected,
    getAddress,
    requestAccess,
  } = await import('@stellar/freighter-api');

  const connected = await isConnected();
  // v3 may return { isConnected: boolean } or a plain boolean
  const ok =
    typeof connected === 'boolean'
      ? connected
      : (connected as { isConnected: boolean }).isConnected;

  if (!ok) {
    throw new Error(
      'Freighter wallet not found. Install the Freighter browser extension from freighter.app',
    );
  }

  // Request permission if not yet granted
  await requestAccess();

  // v3: getAddress() returns { address: string } or plain string
  const raw = await getAddress();
  if (typeof raw === 'string') return raw;
  return (raw as { address: string }).address;
}

export async function signTx(txXDR: string): Promise<string> {
  const { signTransaction } = await import('@stellar/freighter-api');
  const result = await signTransaction(txXDR, {
    networkPassphrase: NETWORK_PASSPHRASE,
  });
  // v3 may return string or { signedTxXdr: string }
  if (typeof result === 'string') return result;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (result as any).signedTxXdr ?? result;
}
