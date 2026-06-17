/**
 * Campaign generator — converts a beneficiary list into:
 *   - merkle_root  (stored in Soroban)
 *   - per-beneficiary claim secrets and witness paths (shared privately)
 *   - campaign.json output for use by the frontend and deploy scripts
 *
 * Usage:
 *   node --import tsx/esm src/generate-campaign.ts [--seed]
 *   --seed  uses a hardcoded demo list instead of reading beneficiaries.json
 */

import { writeFileSync, readFileSync, existsSync } from "fs";
import { computeLeaf, randomSecret } from "./hash.js";
import { buildMerkleTree, getMerkleWitness, toHex32, toHexDisplay, TREE_DEPTH } from "./merkle.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Beneficiary {
  name: string;          // display only — never goes on-chain
  id: string;            // display only — never goes on-chain
}

interface BeneficiaryClaim {
  index: number;
  secret: string;        // hex — shared privately with beneficiary
  leaf: string;          // hex — used to build Merkle tree
  merkle_path: string[]; // hex array — used in Noir proof
  path_indices: boolean[];
  // nullifier is address-bound (derived at claim time from secret+address); not pre-computed
  // Name/ID deliberately excluded — zero PII in output files
}

interface CampaignOutput {
  disbursement_id: string;
  merkle_root: string;
  payout_amount_stroops: number;
  beneficiary_count: number;
  generated_at: string;
  claims: BeneficiaryClaim[];
}

// ── Demo seed data ─────────────────────────────────────────────────────────────

const DEMO_BENEFICIARIES: Beneficiary[] = [
  { name: "Beneficiary A", id: "AID-001" },
  { name: "Beneficiary B", id: "AID-002" },
  { name: "Beneficiary C", id: "AID-003" },
];

const DEMO_DISBURSEMENT_ID = "0000000000000000000000000000000000000000000000000000000000000001";
const DEMO_PAYOUT_STROOPS = 10_000_000; // 1 XLM

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const isSeed = process.argv.includes("--seed");

  let beneficiaries: Beneficiary[];
  let disbursementIdHex: string;
  let payoutStroops: number;

  if (isSeed) {
    console.log("Using demo seed data (3 beneficiaries)...");
    beneficiaries = DEMO_BENEFICIARIES;
    disbursementIdHex = DEMO_DISBURSEMENT_ID;
    payoutStroops = DEMO_PAYOUT_STROOPS;
  } else {
    const configPath = "beneficiaries.json";
    if (!existsSync(configPath)) {
      console.error(`❌  ${configPath} not found. Run with --seed for demo data.`);
      process.exit(1);
    }
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    beneficiaries = config.beneficiaries;
    disbursementIdHex = config.disbursement_id;
    payoutStroops = config.payout_amount_stroops;
  }

  const disbursementId = BigInt("0x" + disbursementIdHex);

  console.log(`\n📋 Generating campaign for ${beneficiaries.length} beneficiaries`);
  console.log(`   Disbursement ID: 0x${disbursementIdHex}`);
  console.log(`   Payout per claim: ${payoutStroops / 1_000_000} XLM\n`);

  // Step 1: Generate secrets and compute leaves
  console.log("🔑 Generating secrets and computing Poseidon (BLS12-381) leaves...");
  const claims: BeneficiaryClaim[] = [];
  const leaves: bigint[] = [];

  for (let i = 0; i < beneficiaries.length; i++) {
    const secret = randomSecret();
    const leaf = await computeLeaf(secret, disbursementId);
    leaves.push(leaf);
    claims.push({
      index: i,
      secret: toHex32(secret),
      leaf: toHex32(leaf),
      merkle_path: [], // filled after tree build
      path_indices: [],
    });
    console.log(`   [${i}] leaf: ${toHexDisplay(leaf).slice(0, 18)}...`);
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
