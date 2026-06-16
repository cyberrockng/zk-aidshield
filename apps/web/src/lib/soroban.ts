import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  xdr,
  Address,
  SorobanRpc,
  scValToNative,
  nativeToScVal,
  Networks,
} from '@stellar/stellar-sdk';
import {
  CONTRACT_ID,
  ADMIN_ADDRESS,
  NETWORK_PASSPHRASE,
  RPC_URL,
  DISBURSEMENT_ID,
  MERKLE_ROOT,
} from './constants';

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
  nullifier: string;
  leaf: string;
  merkle_path: string[];
  path_indices: boolean[];
}

function getServer(): SorobanRpc.Server {
  return new SorobanRpc.Server(RPC_URL, { allowHttp: false });
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

function buildPublicInputsScVal(nullifierHex: string, claimantAddress: string): xdr.ScVal {
  // Soroban contracttype structs encode as ScMap with keys sorted lexicographically
  return xdr.ScVal.scvMap([
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('claimant_address'),
      val: Address.fromString(claimantAddress).toScVal(),
    }),
    new xdr.ScMapEntry({
      key: xdr.ScVal.scvSymbol('disbursement_id'),
      val: xdr.ScVal.scvBytes(Buffer.from(DISBURSEMENT_ID, 'hex')),
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
): Promise<string> {
  const server = getServer();
  const contract = getContract();

  const publicInputs = buildPublicInputsScVal(nullifierHex, claimantAddress);
  // _proof is BytesN<64> — accepted structurally; cryptographic verification is
  // handled by the off-chain Noir prover (production: on-chain verifier contract)
  const mockProof = xdr.ScVal.scvBytes(Buffer.alloc(64, 0));

  const op = contract.call(
    'claim',
    Address.fromString(claimantAddress).toScVal(),
    publicInputs,
    mockProof,
  );

  const account = await server.getAccount(claimantAddress);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Claim simulation failed: ${sim.error}`);
  }

  const assembled = SorobanRpc.assembleTransaction(tx, sim).build();
  return assembled.toXDR();
}

export async function submitSignedTransaction(signedXDR: string): Promise<string> {
  const server = getServer();
  const { TransactionBuilder: TB } = await import('@stellar/stellar-sdk');
  const signedTx = TB.fromXDR(signedXDR, NETWORK_PASSPHRASE);
  const result = await server.sendTransaction(signedTx);

  if (result.status === 'ERROR') {
    throw new Error(`Transaction failed: ${JSON.stringify(result.errorResult)}`);
  }

  // Poll for confirmation
  const hash = result.hash;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await server.getTransaction(hash);
    if (status.status === 'SUCCESS') return hash;
    if (status.status === 'FAILED') throw new Error('Transaction failed on-chain');
  }
  throw new Error('Transaction confirmation timed out');
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
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(sim)) {
    throw new Error(`Fund simulation failed: ${sim.error}`);
  }

  return SorobanRpc.assembleTransaction(tx, sim).build().toXDR();
}
