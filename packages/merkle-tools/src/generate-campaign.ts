/**
 * Campaign generator — converts a beneficiary list into:
 *   - merkle_root  (stored in Soroban)
 *   - per-beneficiary claim secrets and witness paths (shared privately)
 *   - campaign.json output for use by the frontend and deploy scripts
 *
 * Usage:
 *   node --import tsx/esm src/generate-campaign.ts [--seed]
 *   --seed  uses a hardcoded demo list instead of reading local beneficiaries.json
 *
 * Real beneficiary lists are intentionally local-only. Copy
 * beneficiaries.sample.json to beneficiaries.json when you need a template.
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { computeLeaf, randomSecret, stellarAddressToFieldBigint } from "./hash.js";
import { buildMerkleTree, getMerkleWitness, toHex32, toHexDisplay, TREE_DEPTH } from "./merkle.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Beneficiary {
  name: string;           // display only — never goes on-chain
  id: string;             // display only — never goes on-chain
  wallet: string;         // Stellar G... address pre-committed in the leaf
}

interface BeneficiaryClaim {
  index: number;
  claimant_address: string; // Stellar G... address — the only wallet that can use this slot
  secret: string;           // hex — shared privately with beneficiary
  leaf: string;             // hex — Poseidon(secret, disbursement_id, claimant_address_field)
  merkle_path: string[];    // hex array — Merkle witness
  path_indices: boolean[];
  expires_at: number;       // Unix timestamp bound into the Merkle leaf
  issuer_key_id: string;    // hex — active issuer field element bound into the leaf
  // nullifier is derived at claim time: Poseidon(secret, disbursement_id, address, 1)
  // Name/ID deliberately excluded — zero PII in output files
}

interface CampaignOutput {
  disbursement_id: string;
  merkle_root: string;
  payout_amount_stroops: number;
  expires_at: number;
  issuer_public_key: string;
  issuer_key_id: string;
  beneficiary_count: number;
  generated_at: string;
  claims: BeneficiaryClaim[];
}

// ── Demo seed data ─────────────────────────────────────────────────────────────
// Wallets pre-committed into the Merkle tree for the hackathon demo.
// Slot 0 is the admin/deployer wallet; slot 1 is the issuer wallet; slot 2 is the demo claimant.
// Each leaf = Poseidon(secret, disbursement_id, wallet_field, expires_at, issuer_key_id).

const DEMO_BENEFICIARIES: Beneficiary[] = [
  { name: "Beneficiary A", id: "AID-001", wallet: "GC7HI64WEJDEOFOD7Q65SUCVPJ2JR5ZVVVBN2Q545ZQN6NFCDQ2OVYVJ" },
  { name: "Beneficiary B", id: "AID-002", wallet: "GARLD45BJRFBNTB7Y7UAQBHD45MBC4AAOFDRK73CY6BYNTWAHE7FZAY4" },
  { name: "Beneficiary C", id: "AID-003", wallet: "GD7KEWXME3KNSEUZIZZZEHTXC5AQCQOZLL2TTKQGR2OBXA2YJBXM7WQS" },
];

const DEMO_DISBURSEMENT_ID = "0000000000000000000000000000000000000000000000000000000000000001";
const DEMO_PAYOUT_STROOPS = 10_000_000; // 1 XLM
const DEMO_ISSUER_PUBLIC_KEY = "GD3ZN2NWPHCALNNA24Q2CDCIJAPJNC5EV5KRIVLBWIT3S3Y4JXOBZDEO";

function configuredDemoIssuer(): string {
  return process.env.ISSUER_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_ISSUER_PUBLIC_KEY ?? DEMO_ISSUER_PUBLIC_KEY;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isSeed = process.argv.includes("--seed");

  let beneficiaries: Beneficiary[];
  let disbursementIdHex: string;
  let payoutStroops: number;
  let expiresAt: number;
  let issuerPublicKey: string;

  if (isSeed) {
    console.log("Using demo seed data (3 beneficiaries)...");
    beneficiaries = DEMO_BENEFICIARIES;
    disbursementIdHex = DEMO_DISBURSEMENT_ID;
    payoutStroops = DEMO_PAYOUT_STROOPS;
    expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    issuerPublicKey = configuredDemoIssuer();
  } else {
    const configPath = "beneficiaries.json";
    if (!existsSync(configPath)) {
      console.error(`❌  ${configPath} not found. Run with --seed for demo data.`);
      console.error(`    beneficiaries.json must contain:`);
      console.error(`    { "disbursement_id": "...", "payout_amount_stroops": 10000000,`);
      console.error(`      "beneficiaries": [{ "name": "...", "id": "...", "wallet": "G..." }] }`);
      console.error(`    You can copy beneficiaries.sample.json to beneficiaries.json for a synthetic template.`);
      process.exit(1);
    }
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    beneficiaries = config.beneficiaries;
    disbursementIdHex = config.disbursement_id;
    payoutStroops = config.payout_amount_stroops;
    expiresAt = config.expires_at ?? Math.floor(Date.now() / 1000) + 30 * 24 * 3600;
    issuerPublicKey = config.issuer_public_key ?? configuredDemoIssuer();
  }

  const disbursementId = BigInt("0x" + disbursementIdHex);
  const issuerKeyId = stellarAddressToFieldBigint(issuerPublicKey);

  console.log(`\n📋 Generating campaign for ${beneficiaries.length} beneficiaries`);
  console.log(`   Disbursement ID: 0x${disbursementIdHex}`);
  console.log(`   Payout per claim: ${payoutStroops / 1_000_000} XLM\n`);
  console.log(`   Expires at: ${new Date(expiresAt * 1000).toISOString()}`);
  console.log(`   Issuer: ${issuerPublicKey}\n`);

  // Step 1: Generate secrets and compute wallet-bound leaves
  // leaf = Poseidon(secret, disbursement_id, claimant_address_field, expires_at, issuer_key_id) — matches circuit
  console.log("🔑 Generating secrets and computing wallet-bound Poseidon (BLS12-381) leaves...");
  const claims: BeneficiaryClaim[] = [];
  const leaves: bigint[] = [];

  for (let i = 0; i < beneficiaries.length; i++) {
    const secret = randomSecret();
    const addrField = stellarAddressToFieldBigint(beneficiaries[i].wallet);
    const leaf = await computeLeaf(secret, disbursementId, addrField, BigInt(expiresAt), issuerKeyId);
    leaves.push(leaf);
    claims.push({
      index: i,
      claimant_address: beneficiaries[i].wallet,
      secret: toHex32(secret),
      leaf: toHex32(leaf),
      merkle_path: [], // filled after tree build
      path_indices: [],
      expires_at: expiresAt,
      issuer_key_id: toHex32(issuerKeyId),
    });
    console.log(`   [${i}] wallet: ${beneficiaries[i].wallet.slice(0, 10)}… leaf: ${toHexDisplay(leaf).slice(0, 18)}...`);
  }

  // Step 2: Build Merkle tree
  console.log("\n🌲 Building Merkle tree (depth 8, 256 slots)...");
  const tree = await buildMerkleTree(leaves);
  console.log(`   Root: ${toHexDisplay(tree.root)}`);

  // Step 3: Generate witness paths for each beneficiary
  console.log("\n🔍 Generating witness paths...");
  for (const claim of claims) {
    const witness = getMerkleWitness(tree, claim.index);
    claim.merkle_path = witness.path.map(toHex32);
    claim.path_indices = witness.indices;
  }

  // Step 4: Write campaign output
  const output: CampaignOutput = {
    disbursement_id: disbursementIdHex,
    merkle_root: toHex32(tree.root),
    payout_amount_stroops: payoutStroops,
    expires_at: expiresAt,
    issuer_public_key: issuerPublicKey,
    issuer_key_id: toHex32(issuerKeyId),
    beneficiary_count: beneficiaries.length,
    generated_at: new Date().toISOString(),
    claims,
  };

  const outPath = "campaign.json";
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n✅ Campaign generated successfully!`);
  console.log(`   Output: ${outPath}`);
  console.log(`\n📌 Store this on Soroban (initialize contract call):`);
  console.log(`   disbursement_id: ${disbursementIdHex}`);
  console.log(`   merkle_root:     ${toHex32(tree.root)}`);
  console.log(`   payout_stroops:  ${payoutStroops}`);
  console.log(`\n⚠️  campaign.json contains private claim secrets.`);
  console.log(`   Share each claim entry ONLY with the corresponding beneficiary.`);
  console.log(`   Never publish the full file on-chain or in a public repo.\n`);

}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});
