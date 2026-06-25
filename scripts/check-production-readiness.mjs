#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

function loadLocalEnv() {
  const envPath = join(process.cwd(), 'apps', 'web', '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const index = trimmed.indexOf('=');
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim();
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

const requiredServerSecrets = [
  'ISSUER_SECRET_KEY',
  'ADMIN_API_SECRET',
  'LEDGER_HMAC_SECRET',
  'CAMPAIGN_JSON',
];

const optionalProductionControls = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'REQUIRE_DURABLE_ISSUANCE',
  'ADMIN_RATE_LIMIT_MAX',
  'ADMIN_RATE_LIMIT_WINDOW_MS',
];

function present(name) {
  return Boolean(process.env[name] && process.env[name] !== 'replace-me');
}

function status(name) {
  return present(name) ? 'ok' : 'missing';
}

const rows = [
  ...requiredServerSecrets.map((name) => ({ name, required: true, status: status(name) })),
  ...optionalProductionControls.map((name) => ({ name, required: false, status: status(name) })),
];

const durableConfigured = present('UPSTASH_REDIS_REST_URL') && present('UPSTASH_REDIS_REST_TOKEN');
const durableRequired = process.env.REQUIRE_DURABLE_ISSUANCE === 'true';
const failures = rows.filter((row) => row.required && row.status !== 'ok');

if (durableRequired && !durableConfigured) {
  failures.push({
    name: 'durable issuance',
    required: true,
    status: 'REQUIRE_DURABLE_ISSUANCE=true but Upstash Redis is missing',
  });
}

console.log('ZK AidShield production readiness check');
for (const row of rows) {
  const label = row.required ? 'required' : 'optional';
  console.log(`- ${row.name}: ${row.status} (${label})`);
}
console.log(`- durable issuance backend: ${durableConfigured ? 'upstash_redis' : 'local_file/demo'}`);

if (failures.length > 0) {
  console.error('\nReadiness check failed:');
  for (const failure of failures) console.error(`- ${failure.name}: ${failure.status}`);
  process.exit(1);
}

console.log('\nReadiness check passed for configured controls. This does not replace a circuit ceremony or independent audit.');
