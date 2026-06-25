import { NextRequest, NextResponse } from 'next/server';
import { CONTRACT_ID, EXPLORER_BASE, RPC_URL } from '@/lib/constants';
import { requireRateLimit } from '@/lib/rate-limit';

type RpcTransactionResponse = {
  status?: string;
  resultXdr?: string;
  envelopeXdr?: string;
  createdAt?: number;
  applicationOrder?: number;
  latestLedger?: number;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const rateLimitError = requireRateLimit(req, 'verify-receipt', 60);
  if (rateLimitError) return rateLimitError;

  let body: { tx_hash?: string; receipt?: Record<string, unknown> };
  try {
    body = await req.json() as { tx_hash?: string; receipt?: Record<string, unknown> };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const receipt = body.receipt ?? {};
  const txHash = (body.tx_hash ?? (typeof receipt.tx_hash === 'string' ? receipt.tx_hash : ''))?.trim().toLowerCase() ?? '';
  if (!/^[a-f0-9]{64}$/.test(txHash) || /^0+$/.test(txHash)) {
    return NextResponse.json({ error: 'tx_hash must be a non-zero 64-character hex string' }, { status: 400 });
  }

  const rpcResponse = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'aidshield-receipt-check',
      method: 'getTransaction',
      params: { hash: txHash },
    }),
    cache: 'no-store',
  });

  if (!rpcResponse.ok) {
    return NextResponse.json(
      { error: `Stellar RPC returned HTTP ${rpcResponse.status}` },
      { status: 502 },
    );
  }

  const payload = await rpcResponse.json() as { result?: RpcTransactionResponse; error?: { message?: string } };
  if (payload.error) {
    return NextResponse.json({ error: payload.error.message ?? 'Stellar RPC transaction lookup failed' }, { status: 502 });
  }

  const result = payload.result;
  if (!result?.status) {
    return NextResponse.json({ error: 'Transaction was not found on Stellar testnet' }, { status: 404 });
  }

  const declaredContract =
    typeof receipt.contract === 'string'
      ? receipt.contract
      : typeof receipt.disbursement_contract === 'string'
        ? receipt.disbursement_contract
        : null;
  const txSuccess = result.status === 'SUCCESS';
  const contractMatch = declaredContract ? declaredContract === CONTRACT_ID : null;

  return NextResponse.json({
    tx_hash: txHash,
    status: result.status,
    verified: txSuccess,
    receipt_status_verified: txSuccess,
    receipt_verified: false,
    checks: {
      tx_success: txSuccess,
      declared_contract: declaredContract,
      contract_match: contractMatch,
      event_match: 'not_inspected',
      amount_match: 'not_inspected',
      nullifier_match: 'not_inspected',
    },
    limitation:
      'This endpoint verifies Stellar testnet transaction status and compares any declared receipt contract with the configured AidShield contract. It does not yet decode Soroban events, amount, or nullifier from transaction metadata.',
    ledger: result.latestLedger ?? null,
    created_at: result.createdAt ?? null,
    explorer_url: `${EXPLORER_BASE}/tx/${txHash}`,
  });
}
