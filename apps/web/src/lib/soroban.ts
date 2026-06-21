import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  SorobanRpc,
  scValToNative,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import {
  CONTRACT_ID,
  ADMIN_ADDRESS,
  NETWORK_PASSPHRASE,
  RPC_URL,
  DISBURSEMENT_ID,
  MERKLE_ROOT,
  stellarAddressToField,
} from './constants';

// The Stellar SDK (12.x) fails to parse getTransaction responses from newer RPC nodes
// with "Bad union switch: N". Use raw JSON-RPC fetch for polling instead.
async function rpcGetTransaction(hash: string): Promise<{ status: string; errorResultXdr?: string }> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getTransaction', params: { hash } }),
  });
  const json = await res.json() as { result?: { status: string; errorResultXdr?: string }; error?: { message: string } };
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result!;
}

export interface CampaignStats {
  disbursement_id: Buffer;
  merkle_root: Buffer;
  payout_amount: bigint;
  escrow_balance: bigint;
  claimed_count: number;
}

export interface ClaimEntry {
  index: number;
  secret: string;
  leaf: string;
  merkle_path: string[];
  path_indices: boolean[];
}

function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith('http:') });
}

function getContract(): Contract {
  return new Contract(CONTRACT_ID);
}

export async function fetchStats(): Promise<CampaignStats> {
  const server = getServer();
  const contract = getContract();
  const op = contract.call('stats');

  const account = await server.getAccount(ADMIN_ADDRESS);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Stats simulation failed: ${sim.error}`);
  }

  const raw = scValToNative(sim.result!.retval) as Record<string, unknown>;
  return {
    disbursement_id: raw.disbursement_id as Buffer,
    merkle_root: raw.merkle_root as Buffer,
    payout_amount: raw.payout_amount as bigint,
    escrow_balance: raw.escrow_balance as bigint,
    claimed_count: raw.claimed_count as number,
  };
}

export async function checkNullifier(nullifierHex: string): Promise<boolean> {
  const server = getServer();
  const contract = getContract();

  const nullifierBytes = Buffer.from(nullifierHex, 'hex');
  const op = contract.call('is_nullifier_used', xdr.ScVal.scvBytes(nullifierBytes));

  const account = await server.getAccount(ADMIN_ADDRESS);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return false;

  return scValToNative(sim.result!.retval) as boolean;
}

/**
 * Encode ProofPublicInputs as the Soroban ScMap the contract expects.
 *
 * The Rust struct fields are sorted lexicographically by name (Soroban XDR encoding):
 *   claimant_address_field, disbursement_id, expires_at, issuer_key_id, merkle_root, nullifier
 *
 * claimant_address_field is BytesN<32> (field element derived from the Ed25519 key).
 */
function buildPublicInputsScVal(
  nullifierHex: string,
  claimantAddressField: string, // 62-hex string from stellarAddressToField()
  expiresAt: number,
  issuerKeyId: string,
): xdr.ScVal {
  const fieldBytes = Buffer.alloc(32, 0);
  const fieldHex = Buffer.from(claimantAddressField, 'hex');
  fieldHex.copy(fieldBytes, 32 - fieldHex.length); // right-align in 32 bytes

  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('claimant_address_field'),
      val: xdr.ScVal.scvBytes(fieldBytes),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('disbursement_id'),
      val: xdr.ScVal.scvBytes(Buffer.from(DISBURSEMENT_ID, 'hex')),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('expires_at'),
      val: nativeToScVal(BigInt(expiresAt), { type: 'u64' }),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('issuer_key_id'),
      val: xdr.ScVal.scvBytes(Buffer.from(issuerKeyId, 'hex')),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('merkle_root'),
      val: xdr.ScVal.scvBytes(Buffer.from(MERKLE_ROOT, 'hex')),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('nullifier'),
      val: xdr.ScVal.scvBytes(Buffer.from(nullifierHex, 'hex')),
    }),
  ]);
}

export async function buildClaimTransaction(
  claimantAddress: string,
  nullifierHex: string,
  proofHex: string,  // 384-byte Groth16 proof (pi_a || pi_b || pi_c, BLS12-381 uncompressed affine)
  expiresAt: number,
  issuerKeyId: string,
): Promise<string> {
  const server = getServer();
  const contract = getContract();

  const claimantField = stellarAddressToField(claimantAddress);
  const publicInputs = buildPublicInputsScVal(nullifierHex, claimantField, expiresAt, issuerKeyId);
  const proofBytes = xdr.ScVal.scvBytes(Buffer.from(proofHex, 'hex'));

  const op = contract.call(
    'claim',
    Address.fromString(claimantAddress).toScVal(),
    publicInputs,
    proofBytes,
  );

  const account = await server.getAccount(claimantAddress);
  const tx = new TransactionBuilder(account, {
    fee: String(500_000), // higher fee for cross-contract call + proof bytes
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Claim simulation failed: ${sim.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();
  return assembled.toXDR();
}

export async function buildVoucherClaimTransaction(
  claimantAddress: string,
  vendorAddress: string,
  nullifierHex: string,
  proofHex: string,
  expiresAt: number,
  issuerKeyId: string,
): Promise<string> {
  const server = getServer();
  const contract = getContract();

  const claimantField = stellarAddressToField(claimantAddress);
  const publicInputs = buildPublicInputsScVal(nullifierHex, claimantField, expiresAt, issuerKeyId);
  const proofBytes = xdr.ScVal.scvBytes(Buffer.from(proofHex, 'hex'));

  const op = contract.call(
    'claim_to_vendor',
    Address.fromString(claimantAddress).toScVal(),
    Address.fromString(vendorAddress).toScVal(),
    publicInputs,
    proofBytes,
  );

  const account = await server.getAccount(claimantAddress);
  const tx = new TransactionBuilder(account, {
    fee: String(500_000),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Voucher claim simulation failed: ${sim.error}`);
  }

  return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function submitSignedTransaction(signedXDR: string): Promise<string> {
  const server = getServer();
  const { TransactionBuilder: TB } = await import('@stellar/stellar-sdk');
  const signedTx = TB.fromXDR(signedXDR, NETWORK_PASSPHRASE);
  const result = await server.sendTransaction(signedTx);

  if (result.status === 'ERROR') {
    throw new Error(`Transaction rejected: ${JSON.stringify(result.errorResult)}`);
  }
  if (result.status !== 'PENDING' && result.status !== 'DUPLICATE') {
    throw new Error(`Unexpected send status: ${result.status}`);
  }

  const hash = result.hash;
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await rpcGetTransaction(hash);
    if (status.status === 'SUCCESS') return hash;
    if (status.status === 'FAILED') {
      throw new Error('Transaction failed on-chain: ' + JSON.stringify(status));
    }
    // 'NOT_FOUND' means still pending — keep polling
  }
  throw new Error('Transaction confirmation timed out after 60 s — check Stellar Explorer');
}

export async function fetchIsPaused(): Promise<boolean> {
  const server = getServer();
  const contract = getContract();
  const op = contract.call('is_paused');

  const account = await server.getAccount(ADMIN_ADDRESS);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return true; // fail safe
  return scValToNative(sim.result!.retval) as boolean;
}

export async function buildSetPausedTransaction(
  adminAddress: string,
  paused: boolean,
): Promise<string> {
  const server = getServer();
  const contract = getContract();

  const op = contract.call(
    'set_paused',
    nativeToScVal(paused, { type: 'bool' }),
  );

  const account = await server.getAccount(adminAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`set_paused simulation failed: ${sim.error}`);
  }
  return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function checkVendorActive(vendorAddress: string): Promise<boolean> {
  const server = getServer();
  const contract = getContract();
  const op = contract.call('is_vendor_active', Address.fromString(vendorAddress).toScVal());

  const account = await server.getAccount(ADMIN_ADDRESS);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) return false;
  return scValToNative(sim.result!.retval) as boolean;
}

export async function buildSetVendorTransaction(
  adminAddress: string,
  vendorAddress: string,
  active: boolean,
): Promise<string> {
  const server = getServer();
  const contract = getContract();

  const op = contract.call(
    active ? 'add_vendor' : 'revoke_vendor',
    Address.fromString(vendorAddress).toScVal(),
  );

  const account = await server.getAccount(adminAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`${active ? 'add_vendor' : 'revoke_vendor'} simulation failed: ${sim.error}`);
  }

  return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
}

export async function buildFundTransaction(
  funderAddress: string,
  amountStroops: number,
): Promise<string> {
  const server = getServer();
  const contract = getContract();

  const op = contract.call(
    'fund',
    Address.fromString(funderAddress).toScVal(),
    nativeToScVal(BigInt(amountStroops), { type: 'i128' }),
  );

  const account = await server.getAccount(funderAddress);
  const tx = new TransactionBuilder(account, {
    fee: String(500_000),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Fund simulation failed: ${sim.error}`);
  }

  return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
}
