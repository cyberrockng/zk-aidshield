import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .filter((file) => ![
    'package-lock.json',
    'apps/web/package-lock.json',
    'packages/merkle-tools/package-lock.json',
    'circuits/aidshield-groth16/package-lock.json',
  ].includes(file));

const patterns = [
  { name: 'Stellar secret key', regex: /\bS[A-Z2-7]{55}\b/g },
  { name: 'OpenAI-style API key', regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Anthropic API key', regex: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { name: 'Upstash REST token assignment', regex: /\bUPSTASH_REDIS_REST_TOKEN\s*=\s*["']?[^"'\s<.][^"'\s]*/g },
  { name: 'Issuer secret assignment', regex: /\bISSUER_SECRET_KEY\s*=\s*["']?[^"'\s<.][^"'\s]*/g },
  { name: 'Admin secret assignment', regex: /\bADMIN_API_SECRET\s*=\s*["']?[^"'\s<.][^"'\s]*/g },
  { name: 'Ledger HMAC secret assignment', regex: /\bLEDGER_HMAC_SECRET\s*=\s*["']?[^"'\s<.][^"'\s]*/g },
];

function isAllowedTemplate(line) {
  return [
    'replace-with',
    'your-',
    'example',
    'placeholder',
    '${secret}',
    '...',
    '<',
    'demo-secret',
    'ledger-secret',
    'never-commit',
  ].some((marker) => line.toLowerCase().includes(marker));
}

const findings = [];

for (const file of files) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (isAllowedTemplate(line)) return;
    for (const pattern of patterns) {
      pattern.regex.lastIndex = 0;
      if (pattern.regex.test(line)) {
        findings.push(`${file}:${index + 1} ${pattern.name}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error('Potential committed secrets found:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secret scan passed across ${files.length} tracked files.`);
