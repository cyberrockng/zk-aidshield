'use client';

import { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import {
  fetchStats,
  fetchIsPaused,
  buildSetPausedTransaction,
  buildFundTransaction,
  buildSetVendorTransaction,
  checkVendorActive,
  buildSetGovernanceTransaction,
  fetchGovernanceThreshold,
  checkGovernorActive,
  submitSignedTransaction,
  type CampaignStats,
} from '@/lib/soroban';
import { isFreighterInstalled, connectWallet, signTx } from '@/lib/freighter';
import {
  CONTRACT_ID, VERIFIER_CONTRACT_ID, EXPLORER_BASE,
  stroopsToXlm, shortHex, DISBURSEMENT_ID, MERKLE_ROOT, ISSUER_PUBLIC_KEY, ISSUER_KEY_ID, // MERKLE_ROOT kept for existing use
} from '@/lib/constants';
import type { BeneficiaryCredential } from '@/lib/credential';
import { encodeEncryptedCredentialQr, prettyCredentialJson } from '@/lib/credential-qr';
import type { DeliveryMode, IssuanceLedgerResponse } from '@/lib/issuance-ledger';

type FundStep = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';
type PauseStep = 'idle' | 'building' | 'signing' | 'submitting' | 'done' | 'error';
type IssueStep = 'idle' | 'issuing' | 'done' | 'error';
type VendorStep = 'idle' | 'checking' | 'building' | 'signing' | 'submitting' | 'done' | 'error';
type GovernanceStep = 'idle' | 'checking' | 'building' | 'signing' | 'submitting' | 'done' | 'error';

interface CsvRow { name: string; id: string; wallet: string }

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const nameIdx = header.indexOf('name');
  const idIdx = header.findIndex((h) => h === 'id' || h === 'beneficiary_id');
  const walletIdx = header.findIndex((h) => h === 'wallet' || h === 'address');
  if (nameIdx < 0 || idIdx < 0 || walletIdx < 0) {
    throw new Error('CSV must have columns: name, id (or beneficiary_id), wallet (or address)');
  }
  return lines.slice(1).filter((l) => l.trim()).map((line) => {
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const wallet = cols[walletIdx] ?? '';
    if (!/^G[A-Z0-9]{55}$/.test(wallet)) throw new Error(`Invalid Stellar address: ${wallet}`);
    return { name: cols[nameIdx] ?? '', id: cols[idIdx] ?? '', wallet };
  });
}

interface BeneficiarySlot {
  index: number;
  claimant_address: string;
}

interface BeneficiaryList {
  disbursement_id: string;
  merkle_root: string;
  total_slots: number;
  slots: BeneficiarySlot[];
}

export default function AdminPage() {
  const [stats, setStats] = useState<CampaignStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [isPaused, setIsPaused] = useState<boolean | null>(null);

  const [walletInstalled, setWalletInstalled] = useState<boolean | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState('');

  const [fundAmount, setFundAmount] = useState('50');
  const [fundStep, setFundStep] = useState<FundStep>('idle');
  const [fundTxHash, setFundTxHash] = useState('');
  const [fundError, setFundError] = useState('');

  const [pauseStep, setPauseStep] = useState<PauseStep>('idle');
  const [pauseError, setPauseError] = useState('');
  const [pauseTxHash, setPauseTxHash] = useState('');

  const [vendorAddress, setVendorAddress] = useState('');
  const [vendorStep, setVendorStep] = useState<VendorStep>('idle');
  const [vendorError, setVendorError] = useState('');
  const [vendorTxHash, setVendorTxHash] = useState('');
  const [vendorActive, setVendorActive] = useState<boolean | null>(null);

  const [governorAddress, setGovernorAddress] = useState('');
  const [governanceThreshold, setGovernanceThreshold] = useState(1);
  const [newGovernanceThreshold, setNewGovernanceThreshold] = useState('2');
  const [governorActive, setGovernorActive] = useState<boolean | null>(null);
  const [governanceStep, setGovernanceStep] = useState<GovernanceStep>('idle');
  const [governanceError, setGovernanceError] = useState('');
  const [governanceTxHash, setGovernanceTxHash] = useState('');

  const [recipientAddress, setRecipientAddress] = useState('');
  const [issueStep, setIssueStep] = useState<IssueStep>('idle');
  const [issuedCredential, setIssuedCredential] = useState<BeneficiaryCredential | null>(null);
  const [issueError, setIssueError] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrCopied, setQrCopied] = useState(false);
  const [credentialQr, setCredentialQr] = useState('');
  const [credentialQrPayload, setCredentialQrPayload] = useState('');
  const [credentialQrError, setCredentialQrError] = useState('');
  const [qrPassphrase, setQrPassphrase] = useState('');

  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [adminSecret, setAdminSecret] = useState(() =>
    typeof window === 'undefined' ? '' : window.localStorage.getItem('aidshield_admin_secret') ?? '',
  );

  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryList | null>(null);
  const [beneficiariesError, setBeneficiariesError] = useState<string | null>(null);
  const [issuedBySlot, setIssuedBySlot] = useState<Record<number, boolean>>({});
  const [issuingSlot, setIssuingSlot] = useState<number | null>(null);

  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvError, setCsvError] = useState('');
  const [csvDownloaded, setCsvDownloaded] = useState(false);
  const [issuanceLedger, setIssuanceLedger] = useState<IssuanceLedgerResponse | null>(null);
  const [issuanceLedgerError, setIssuanceLedgerError] = useState('');

  function log(line: string) {
    setActivityLog((prev) => [`[${new Date().toLocaleTimeString()}] ${line}`, ...prev]);
  }

  const adminHeaders = useCallback((contentType = false): HeadersInit => {
    const headers: Record<string, string> = {};
    if (contentType) headers['Content-Type'] = 'application/json';
    if (adminSecret.trim()) headers['x-admin-secret'] = adminSecret.trim();
    return headers;
  }, [adminSecret]);

  useEffect(() => {
    window.localStorage.setItem('aidshield_admin_secret', adminSecret);
  }, [adminSecret]);

  useEffect(() => {
    if (!adminSecret.trim()) {
      setBeneficiariesError('Enter the admin API secret to load registered beneficiaries');
      setBeneficiaries(null);
      return;
    }

    fetch('/api/beneficiaries', { headers: adminHeaders() })
      .then((r) => r.json())
      .then((data: BeneficiaryList & { error?: string }) => {
        if (data.error) { setBeneficiariesError(data.error); return; }
        setBeneficiariesError(null);
        setBeneficiaries(data);
      })
      .catch((e) => setBeneficiariesError(String(e)));
  }, [adminHeaders, adminSecret]);

  const loadIssuanceLedger = useCallback(async () => {
    if (!adminSecret.trim()) {
      setIssuanceLedger(null);
      setIssuanceLedgerError('Enter the admin API secret to load the issuance ledger');
      return;
    }

    try {
      const res = await fetch('/api/issuance-ledger', { headers: adminHeaders() });
      const data = await res.json() as IssuanceLedgerResponse & { error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Failed to load issuance ledger');
      setIssuanceLedger(data);
      setIssuanceLedgerError('');
    } catch (e) {
      setIssuanceLedgerError(String(e));
    }
  }, [adminHeaders, adminSecret]);

  useEffect(() => {
    loadIssuanceLedger();
  }, [loadIssuanceLedger]);

  useEffect(() => {
    let active = true;
    setCredentialQr('');
    setCredentialQrPayload('');
    setCredentialQrError('');
    setQrCopied(false);
    if (!issuedCredential) return;
    const passphrase = qrPassphrase.trim();
    if (!passphrase) {
      setCredentialQrError('Enter a QR passphrase to generate encrypted QR');
      return;
    }

    encodeEncryptedCredentialQr(issuedCredential, passphrase)
      .then((payload) => {
        if (!active) return;
        setCredentialQrPayload(payload);
        return QRCode.toDataURL(payload, {
          errorCorrectionLevel: 'L',
          margin: 2,
          scale: 7,
          color: { dark: '#0d1117', light: '#ffffff' },
        });
      })
      .then((url) => {
        if (!url) return;
        if (active) setCredentialQr(url);
      })
      .catch((e) => {
        if (active) setCredentialQrError(String(e));
      });

    return () => { active = false; };
  }, [issuedCredential, qrPassphrase]);

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    setCsvError('');
    setCsvRows(null);
    setCsvDownloaded(false);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsv(ev.target?.result as string);
        if (rows.length === 0) throw new Error('CSV has no data rows');
        if (rows.length > 256) throw new Error('Maximum 256 beneficiaries per campaign');
        setCsvRows(rows);
        log(`CSV loaded: ${rows.length} beneficiary rows`);
      } catch (err) {
        setCsvError(String(err));
      }
    };
    reader.readAsText(file);
  }

  function handleCsvDownload() {
    if (!csvRows) return;
    const output = {
      disbursement_id: DISBURSEMENT_ID,
      payout_amount_stroops: 10_000_000,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 24 * 3600,
      issuer_public_key: ISSUER_PUBLIC_KEY,
      issuer_key_id: ISSUER_KEY_ID,
      beneficiaries: csvRows.map((r) => ({ name: r.name, id: r.id, wallet: r.wallet })),
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'beneficiaries.json';
    a.click();
    URL.revokeObjectURL(url);
    setCsvDownloaded(true);
    log(`beneficiaries.json downloaded (${csvRows.length} rows) — run npm run generate in packages/merkle-tools`);
  }

  async function handleIssueToSlot(slot: BeneficiarySlot) {
    setIssuingSlot(slot.index);
    log(`Issuing credential to slot #${slot.index} (${slot.claimant_address.slice(0, 8)}…)`);
    try {
      const res = await fetch('/api/issue-credential', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ claimant_address: slot.claimant_address }),
      });
      const data = await res.json() as { error?: string; slot_index?: number };
      if (!res.ok) throw new Error(data.error ?? 'Issue failed');
      const credential = data as BeneficiaryCredential;
      setIssuedCredential(credential);
      setIssueStep('done');
      setCopied(false);
      setIssuedBySlot((prev) => ({ ...prev, [slot.index]: true }));
      log(`Credential issued ✓ slot #${slot.index}`);
      // Trigger download
      const blob = new Blob([prettyCredentialJson(credential)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aidshield-credential-slot${slot.index}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await loadIssuanceLedger();
    } catch (e) {
      log(`Issue error slot #${slot.index}: ${String(e).slice(0, 80)}`);
    } finally {
      setIssuingSlot(null);
    }
  }

  const loadStats = useCallback(async () => {
    setLoadingStats(true);
    setStatsError(null);
    try {
      const [s, paused] = await Promise.all([fetchStats(), fetchIsPaused()]);
      setStats(s);
      setIsPaused(paused);
    } catch (e) {
      setStatsError(String(e));
    } finally {
      setLoadingStats(false);
    }
  }, []);

  const loadGovernanceThreshold = useCallback(async () => {
    try {
      setGovernanceThreshold(await fetchGovernanceThreshold());
    } catch {
      setGovernanceThreshold(1);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadGovernanceThreshold();
    const id = setInterval(loadStats, 15_000);
    return () => clearInterval(id);
  }, [loadStats, loadGovernanceThreshold]);

  useEffect(() => {
    isFreighterInstalled().then(setWalletInstalled);
  }, []);

  async function handleConnectWallet() {
    setWalletError('');
    try {
      const addr = await connectWallet();
      setWalletAddress(addr);
      log(`Wallet connected: ${addr.slice(0, 8)}…${addr.slice(-6)}`);
    } catch (e) {
      setWalletError(String(e));
    }
  }

  async function handleSetPaused(paused: boolean) {
    if (!walletAddress) { setPauseError('Connect your Freighter wallet first'); return; }
    setPauseError('');
    setPauseTxHash('');
    setPauseStep('building');
    log(`${paused ? 'Pausing' : 'Unpausing'} campaign…`);

    try {
      const txXDR = await buildSetPausedTransaction(walletAddress, paused);
      setPauseStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);
      setPauseStep('submitting');
      log('Broadcasting…');
      const hash = await submitSignedTransaction(signedXDR);
      setPauseTxHash(hash);
      setPauseStep('done');
      setIsPaused(paused);
      log(`Campaign ${paused ? 'paused' : 'unpaused'} ✓ tx: ${hash.slice(0, 12)}…`);
      await loadStats();
    } catch (e) {
      const msg = String(e);
      setPauseError(msg);
      setPauseStep('error');
      log(`Pause error: ${msg.slice(0, 80)}`);
    }
  }

  async function handleFund() {
    if (!walletAddress) { setFundError('Connect your Freighter wallet first'); return; }
    setFundError('');
    setFundTxHash('');
    const xlm = parseFloat(fundAmount);
    if (isNaN(xlm) || xlm <= 0) { setFundError('Enter a valid XLM amount'); return; }
    const stroops = Math.round(xlm * 10_000_000);

    try {
      setFundStep('building');
      log(`Building fund tx — ${xlm} XLM`);
      const txXDR = await buildFundTransaction(walletAddress, stroops);
      setFundStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);
      setFundStep('submitting');
      log('Broadcasting…');
      const hash = await submitSignedTransaction(signedXDR);
      setFundTxHash(hash);
      setFundStep('done');
      log(`Funded ✓ tx: ${hash.slice(0, 12)}…`);
      await loadStats();
    } catch (e) {
      const msg = String(e);
      setFundError(msg);
      setFundStep('error');
      log(`Fund error: ${msg.slice(0, 80)}`);
    }
  }

  async function handleCheckVendor() {
    const addr = vendorAddress.trim();
    setVendorError('');
    setVendorActive(null);
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setVendorError('Enter a valid Stellar vendor address');
      return;
    }
    try {
      setVendorStep('checking');
      const active = await checkVendorActive(addr);
      setVendorActive(active);
      setVendorStep('idle');
      log(`Vendor ${addr.slice(0, 8)}… is ${active ? 'approved' : 'not approved'}`);
    } catch (e) {
      setVendorError(String(e));
      setVendorStep('error');
    }
  }

  async function handleSetVendor(active: boolean) {
    const addr = vendorAddress.trim();
    if (!walletAddress) { setVendorError('Connect your Freighter admin wallet first'); return; }
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setVendorError('Enter a valid Stellar vendor address');
      return;
    }
    setVendorError('');
    setVendorTxHash('');
    try {
      setVendorStep('building');
      log(`${active ? 'Approving' : 'Revoking'} vendor ${addr.slice(0, 8)}…`);
      const txXDR = await buildSetVendorTransaction(walletAddress, addr, active);
      setVendorStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);
      setVendorStep('submitting');
      log('Broadcasting vendor update…');
      const hash = await submitSignedTransaction(signedXDR);
      setVendorTxHash(hash);
      setVendorActive(active);
      setVendorStep('done');
      log(`Vendor ${active ? 'approved' : 'revoked'} ✓ tx: ${hash.slice(0, 12)}…`);
    } catch (e) {
      const msg = String(e);
      setVendorError(msg);
      setVendorStep('error');
      log(`Vendor update error: ${msg.slice(0, 80)}`);
    }
  }

  async function handleCheckGovernor() {
    const addr = governorAddress.trim();
    setGovernanceError('');
    setGovernorActive(null);
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setGovernanceError('Enter a valid Stellar governor address');
      return;
    }
    try {
      setGovernanceStep('checking');
      const [active, threshold] = await Promise.all([
        checkGovernorActive(addr),
        fetchGovernanceThreshold(),
      ]);
      setGovernorActive(active);
      setGovernanceThreshold(threshold);
      setGovernanceStep('idle');
      log(`Governor ${addr.slice(0, 8)}… is ${active ? 'active' : 'not active'}; threshold ${threshold}`);
    } catch (e) {
      setGovernanceError(String(e));
      setGovernanceStep('error');
    }
  }

  async function handleSetGovernance(active: boolean) {
    const addr = governorAddress.trim();
    const threshold = Number(newGovernanceThreshold);
    if (!walletAddress) { setGovernanceError('Connect your Freighter admin wallet first'); return; }
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setGovernanceError('Enter a valid Stellar governor address');
      return;
    }
    if (!Number.isInteger(threshold) || threshold < 1) {
      setGovernanceError('Threshold must be a whole number of at least 1');
      return;
    }
    setGovernanceError('');
    setGovernanceTxHash('');
    try {
      setGovernanceStep('building');
      log(`${active ? 'Activating' : 'Revoking'} governor ${addr.slice(0, 8)}… threshold ${threshold}`);
      const txXDR = await buildSetGovernanceTransaction(walletAddress, addr, active, threshold);
      setGovernanceStep('signing');
      log('Waiting for Freighter signature…');
      const signedXDR = await signTx(txXDR, walletAddress);
      setGovernanceStep('submitting');
      log('Broadcasting governance update…');
      const hash = await submitSignedTransaction(signedXDR);
      setGovernanceTxHash(hash);
      setGovernorActive(active);
      setGovernanceThreshold(threshold);
      setGovernanceStep('done');
      log(`Governance updated ✓ tx: ${hash.slice(0, 12)}…`);
    } catch (e) {
      const msg = String(e);
      setGovernanceError(msg);
      setGovernanceStep('error');
      log(`Governance error: ${msg.slice(0, 80)}`);
    }
  }

  async function handleIssueCredential() {
    const addr = recipientAddress.trim();
    if (!addr) { setIssueError('Enter a recipient Stellar address'); return; }
    if (!/^G[A-Z0-9]{55}$/.test(addr)) {
      setIssueError('Invalid Stellar address (must start with G, 56 chars)');
      return;
    }
    setIssueStep('issuing');
    setIssueError('');
    setIssuedCredential(null);
    setCopied(false);
    log(`Issuing credential to ${addr.slice(0, 8)}…`);

    try {
      const res = await fetch('/api/issue-credential', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ claimant_address: addr }),
      });
      if (!res.ok) {
        const { error } = await res.json() as { error: string };
        throw new Error(error);
      }
      const cred = await res.json() as BeneficiaryCredential;
      setIssuedCredential(cred);
      setIssueStep('done');
      log(`Credential issued ✓ slot ${cred.slot_index} → ${addr.slice(0, 8)}…`);
      await loadIssuanceLedger();
    } catch (e) {
      setIssueError(String(e));
      setIssueStep('error');
      log(`Issue error: ${String(e).slice(0, 80)}`);
    }
  }

  function handleDownloadCredential() {
    if (!issuedCredential) return;
    const blob = new Blob([JSON.stringify(issuedCredential, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aidshield-credential-slot${issuedCredential.slot_index}.json`;
    a.click();
    URL.revokeObjectURL(url);
    recordDeliveryMode('json_download');
  }

  async function handleCopyCredential() {
    if (!issuedCredential) return;
    await navigator.clipboard.writeText(prettyCredentialJson(issuedCredential));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    await recordDeliveryMode('json_copy');
  }

  function handleDownloadCredentialQr() {
    if (!credentialQr || !issuedCredential) return;
    const a = document.createElement('a');
    a.href = credentialQr;
    a.download = `aidshield-credential-slot${issuedCredential.slot_index}-qr.png`;
    a.click();
    recordDeliveryMode('encrypted_qr');
  }

  async function handleCopyCredentialQrPayload() {
    if (!credentialQrPayload) return;
    await navigator.clipboard.writeText(credentialQrPayload);
    setQrCopied(true);
    setTimeout(() => setQrCopied(false), 2000);
    await recordDeliveryMode('qr_payload_copy');
  }

  async function credentialHashClient(credential: BeneficiaryCredential): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(credential));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Buffer.from(digest).toString('hex');
  }

  async function recordDeliveryMode(deliveryMode: DeliveryMode) {
    if (!issuedCredential) return;
    try {
      const credential_hash = await credentialHashClient(issuedCredential);
      const res = await fetch('/api/issuance-ledger', {
        method: 'POST',
        headers: adminHeaders(true),
        body: JSON.stringify({ credential_hash, delivery_mode: deliveryMode }),
      });
      if (!res.ok) return;
      await loadIssuanceLedger();
    } catch {
      // Delivery tracking is operational metadata only; credential delivery still succeeds.
    }
  }

  function handleDownloadLedger() {
    if (!issuanceLedger) return;
    const blob = new Blob([JSON.stringify(issuanceLedger, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aidshield-issuance-ledger.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  const fundBusy = fundStep === 'building' || fundStep === 'signing' || fundStep === 'submitting';
  const pauseBusy = pauseStep === 'building' || pauseStep === 'signing' || pauseStep === 'submitting';
  const vendorBusy = vendorStep === 'checking' || vendorStep === 'building' || vendorStep === 'signing' || vendorStep === 'submitting';
  const governanceBusy = governanceStep === 'checking' || governanceStep === 'building' || governanceStep === 'signing' || governanceStep === 'submitting';

  const utilization =
    stats && stats.claimed_count > 0 && stats.payout_amount > 0n
      ? (Number(BigInt(stats.claimed_count) * stats.payout_amount) /
          Number(stats.escrow_balance + BigInt(stats.claimed_count) * stats.payout_amount)) * 100
      : 0;

  return (
    <div>
      <div className="section-panel mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            <span className="badge badge-green">Escrow operations</span>
            <span className="badge badge-blue">Credential issuance</span>
            <span className="badge badge-amber">Governance controls</span>
          </div>
          <h1 className="text-3xl font-bold mb-2">Aid Operations Console</h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
            Issue credentials, approve vendors, manage governors, fund escrow, and monitor campaign health.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="badge" style={{ background: '#1e293b', color: '#94a3b8', fontSize: '0.7rem' }}>
            Stellar Testnet
          </span>
          <a href={`${EXPLORER_BASE}/contract/${CONTRACT_ID}`} target="_blank" rel="noopener noreferrer" className="btn-outline text-sm">
            Explorer ↗
          </a>
        </div>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-2">Operator Authorization</div>
        <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>
          Protected routes require the server-side admin secret before beneficiary slots, credential issuance, or ledger records can load.
        </p>
        <input
          type="password"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="ADMIN_API_SECRET"
          className="input mono"
          autoComplete="off"
        />
      </div>

      {/* ── Campaign State ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-4">Campaign State</div>

        {loadingStats && isPaused === null ? (
          <div className="text-sm py-2" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <div className="space-y-4">
            {/* Paused status + toggle */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-sm font-medium mb-0.5">Claims status</div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>
                  Admin can halt and re-enable claims without redeploying contracts.
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isPaused === null ? (
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>—</span>
                ) : isPaused ? (
                  <span className="badge" style={{ background: '#450a0a', color: '#fca5a5', fontSize: '0.7rem' }}>
                    ⏸ PAUSED
                  </span>
                ) : (
                  <span className="badge badge-green" style={{ fontSize: '0.7rem' }}>
                    ▶ ACTIVE
                  </span>
                )}
                {walletAddress && (
                  <button
                    className={isPaused ? 'btn-primary text-sm' : 'btn-outline text-sm'}
                    style={isPaused ? {} : { color: '#f87171', borderColor: 'rgba(248,81,73,0.4)' }}
                    onClick={() => handleSetPaused(!isPaused)}
                    disabled={pauseBusy || isPaused === null}
                  >
                    {pauseBusy
                      ? pauseStep === 'building' ? 'Building…'
                        : pauseStep === 'signing' ? 'Waiting…'
                        : 'Submitting…'
                      : isPaused ? 'Unpause claims' : 'Pause claims'}
                  </button>
                )}
              </div>
            </div>

            {pauseError && (
              <div className="text-xs p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid rgba(248,81,73,0.25)' }}>
                {pauseError}
              </div>
            )}
            {pauseStep === 'done' && pauseTxHash && (
              <div className="text-xs p-2 rounded-lg" style={{ background: '#0a1f14', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>
                ✓{' '}
                <a href={`${EXPLORER_BASE}/tx/${pauseTxHash}`} target="_blank" rel="noopener noreferrer" className="underline">
                  {shortHex(pauseTxHash)} ↗
                </a>
              </div>
            )}

            {/* Contracts */}
            <div style={{ borderTop: '1px solid var(--border-dim)', paddingTop: '1rem' }}>
              <div className="text-sm font-medium mb-2">Contract addresses</div>
              <div className="space-y-2 text-xs mono">
                {[
                  { label: 'Disbursement', id: CONTRACT_ID },
                  { label: 'Groth16 Verifier', id: VERIFIER_CONTRACT_ID },
                ].map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 flex-wrap">
                    <span style={{ color: 'var(--muted)' }}>{c.label}</span>
                    <a
                      href={`${EXPLORER_BASE}/contract/${c.id}`}
                      target="_blank" rel="noopener noreferrer"
                      className="underline" style={{ color: 'var(--green)', wordBreak: 'break-all' }}
                    >
                      {shortHex(c.id)} ↗
                    </a>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span style={{ color: 'var(--muted)' }}>Merkle root</span>
                  <span style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(MERKLE_ROOT)}</span>
                </div>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span style={{ color: 'var(--muted)' }}>Disbursement ID</span>
                  <span style={{ color: 'var(--muted-2)', wordBreak: 'break-all' }}>{shortHex(DISBURSEMENT_ID)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Governance ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Multi-Admin Governance
          <span className="badge badge-amber" style={{ fontSize: '0.65rem' }}>
            Threshold {governanceThreshold}
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Add field-office governors and raise the approval threshold for sensitive controls such as pause, issuer, root, verifier, and vendor updates.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_120px] gap-3 mb-3">
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              Governor Stellar address (G…)
            </label>
            <input
              type="text"
              placeholder="GXXXXXX…"
              value={governorAddress}
              onChange={(e) => { setGovernorAddress(e.target.value); setGovernanceError(''); setGovernorActive(null); }}
              disabled={governanceBusy}
              className="mono text-sm"
            />
          </div>
          <div>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              Threshold
            </label>
            <input
              type="number"
              min="1"
              step="1"
              value={newGovernanceThreshold}
              onChange={(e) => setNewGovernanceThreshold(e.target.value)}
              disabled={governanceBusy}
              className="mono text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap mb-3">
          <button className="btn-outline text-sm" onClick={handleCheckGovernor} disabled={governanceBusy || !governorAddress.trim()}>
            {governanceStep === 'checking' ? 'Checking…' : 'Check governor'}
          </button>
          <button className="btn-primary text-sm" onClick={() => handleSetGovernance(true)} disabled={governanceBusy || !walletAddress || !governorAddress.trim()}>
            {governanceStep === 'building' || governanceStep === 'signing' || governanceStep === 'submitting' ? 'Updating…' : 'Activate'}
          </button>
          <button className="btn-outline text-sm" onClick={() => handleSetGovernance(false)} disabled={governanceBusy || !walletAddress || !governorAddress.trim()}>
            Revoke
          </button>
          {governorActive !== null && (
            <span className={governorActive ? 'badge badge-green' : 'badge'} style={governorActive ? { fontSize: '0.7rem' } : { background: '#450a0a', color: '#fca5a5', fontSize: '0.7rem' }}>
              {governorActive ? 'Active governor' : 'Not active'}
            </span>
          )}
          {governanceTxHash && (
            <a href={`${EXPLORER_BASE}/tx/${governanceTxHash}`} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--green)' }}>
              Governance tx {shortHex(governanceTxHash)} ↗
            </a>
          )}
        </div>

        {governanceError && (
          <div className="text-xs p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {governanceError}
          </div>
        )}

        <div className="text-xs" style={{ color: 'var(--muted)', lineHeight: 1.55 }}>
          Threshold 1 preserves fast testnet operation. Threshold 2+ requires the admin plus active governor co-signers through the governed contract methods.
        </div>
      </div>

      {/* ── Vendor / Voucher Mode ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Vendor / Voucher Mode
          <span className="badge" style={{ background: '#1f2a44', color: '#93c5fd', fontSize: '0.65rem' }}>
            Restricted aid
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Approve vendors that can receive beneficiary-authorized voucher redemptions. The beneficiary still proves private eligibility and signs the transaction; the contract pays only approved vendors.
        </p>

        <div className="flex gap-3 items-end mb-3 flex-wrap">
          <div className="flex-1" style={{ minWidth: 280 }}>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              Vendor Stellar address (G…)
            </label>
            <input
              type="text"
              placeholder="GXXXXXX…"
              value={vendorAddress}
              onChange={(e) => { setVendorAddress(e.target.value); setVendorError(''); setVendorActive(null); }}
              disabled={vendorBusy}
              className="mono text-sm"
            />
          </div>
          <button className="btn-outline text-sm" onClick={handleCheckVendor} disabled={vendorBusy || !vendorAddress.trim()}>
            {vendorStep === 'checking' ? 'Checking…' : 'Check'}
          </button>
          <button className="btn-primary text-sm" onClick={() => handleSetVendor(true)} disabled={vendorBusy || !walletAddress || !vendorAddress.trim()}>
            {vendorStep === 'building' || vendorStep === 'signing' || vendorStep === 'submitting' ? 'Updating…' : 'Approve'}
          </button>
          <button className="btn-outline text-sm" onClick={() => handleSetVendor(false)} disabled={vendorBusy || !walletAddress || !vendorAddress.trim()}>
            Revoke
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {vendorActive !== null && (
            <span className={vendorActive ? 'badge badge-green' : 'badge'} style={vendorActive ? { fontSize: '0.7rem' } : { background: '#450a0a', color: '#fca5a5', fontSize: '0.7rem' }}>
              {vendorActive ? 'Approved vendor' : 'Not approved'}
            </span>
          )}
          {vendorTxHash && (
            <a href={`${EXPLORER_BASE}/tx/${vendorTxHash}`} target="_blank" rel="noopener noreferrer" className="text-xs underline" style={{ color: 'var(--green)' }}>
              Vendor tx {shortHex(vendorTxHash)} ↗
            </a>
          )}
        </div>

        {vendorError && (
          <div className="text-xs p-3 rounded-lg mt-3" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {vendorError}
          </div>
        )}

        {!walletAddress && (
          <div className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
            Connect the admin Freighter wallet below to approve or revoke vendors on-chain.
          </div>
        )}
      </div>

      {/* ── Issue Credential ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Issue Beneficiary Credential
          <span className="badge" style={{ background: '#0e3a1d', color: 'var(--green-bright)', fontSize: '0.65rem' }}>
            Operator only
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Sign a credential binding the Merkle witness + secret to a specific wallet.
          Only that wallet can use it to generate a valid proof.
        </p>

        <div className="flex gap-3 items-end mb-4 flex-wrap">
          <div className="flex-1" style={{ minWidth: 280 }}>
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
              Recipient Stellar address (G…)
            </label>
            <input
              type="text"
              placeholder="GXXXXXX…"
              value={recipientAddress}
              onChange={(e) => { setRecipientAddress(e.target.value); setIssueError(''); }}
              disabled={issueStep === 'issuing'}
              className="mono text-sm"
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleIssueCredential}
            disabled={issueStep === 'issuing' || !recipientAddress.trim()}
          >
            {issueStep === 'issuing' ? 'Signing…' : 'Issue Credential'}
          </button>
        </div>

        {issueError && (
          <div className="text-sm p-3 rounded-lg mb-3" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {issueError}
          </div>
        )}

        {issuedCredential && issueStep === 'done' && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(63,185,80,0.25)' }}>
            <div
              className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
              style={{ background: '#0a1f14', borderBottom: '1px solid rgba(63,185,80,0.15)' }}
            >
              <div className="flex items-center gap-2">
                <span style={{ color: 'var(--green-bright)', fontWeight: 600, fontSize: '0.875rem' }}>
                  ✓ Credential signed
                </span>
                <span className="mono text-xs" style={{ color: 'var(--muted)' }}>
                  slot {issuedCredential.slot_index} · expires {new Date(issuedCredential.expires_at * 1000).toLocaleDateString()}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--surface-2)', color: 'var(--muted-2)', border: '1px solid var(--border)' }}
                  onClick={handleCopyCredential}
                >
                  {copied ? 'Copied!' : 'Copy JSON'}
                </button>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium"
                  style={{ background: 'var(--green-dim)', color: 'var(--green-bright)', border: '1px solid rgba(63,185,80,0.3)' }}
                  onClick={handleDownloadCredential}
                >
                  Download
                </button>
              </div>
            </div>
            <div className="mono text-xs p-4 overflow-auto max-h-64" style={{ background: '#040d07', color: 'var(--muted)' }}>
              <pre>{prettyCredentialJson(issuedCredential)}</pre>
            </div>
            <div className="px-4 py-4" style={{ background: '#07130b', borderTop: '1px solid rgba(63,185,80,0.15)' }}>
              <div className="flex gap-4 flex-wrap items-center">
                <div
                  className="rounded-lg p-2 flex items-center justify-center"
                  style={{ width: 188, minHeight: 188, background: '#ffffff', border: '1px solid rgba(63,185,80,0.25)' }}
                >
                  {credentialQr ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={credentialQr} alt="Credential QR code" style={{ width: 172, height: 172 }} />
                  ) : (
                    <span className="text-xs" style={{ color: '#111827' }}>
                      {credentialQrError ? 'QR unavailable' : 'Generating QR…'}
                    </span>
                  )}
                </div>
                <div className="flex-1" style={{ minWidth: 220 }}>
                  <div className="text-sm font-semibold mb-1" style={{ color: 'var(--green-bright)' }}>
                    Mobile QR credential
                  </div>
                  <div className="text-xs mb-3 leading-relaxed" style={{ color: 'var(--muted)' }}>
                    Field officers can show this encrypted QR to the beneficiary phone. Share the passphrase separately. After decryption, the claim page still verifies issuer signature, wallet binding, expiry, and nullifier status.
                  </div>
                  <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>
                    QR passphrase
                  </label>
                  <input
                    type="password"
                    value={qrPassphrase}
                    onChange={(e) => setQrPassphrase(e.target.value)}
                    placeholder="8+ characters, share separately"
                    className="text-sm mb-2"
                    autoComplete="new-password"
                  />
                  {credentialQrError && (
                    <div className="text-xs mb-3" style={{ color: '#f87171' }}>
                      {credentialQrError}
                    </div>
                  )}
                  {credentialQrPayload && (
                    <div className="text-xs mb-3" style={{ color: 'var(--green)' }}>
                      Encrypted QR ready. The credential secret is not readable from the QR without this passphrase.
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--green-dim)', color: 'var(--green-bright)', border: '1px solid rgba(63,185,80,0.3)' }}
                      onClick={handleDownloadCredentialQr}
                      disabled={!credentialQr}
                    >
                      Download QR
                    </button>
                    <button
                      className="text-xs px-3 py-1.5 rounded-lg font-medium"
                      style={{ background: 'var(--surface-2)', color: 'var(--muted-2)', border: '1px solid var(--border)' }}
                      onClick={handleCopyCredentialQrPayload}
                      disabled={!credentialQrPayload}
                    >
                      {qrCopied ? 'Copied!' : 'Copy QR payload'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 text-xs" style={{ background: '#0a1f14', color: 'var(--muted)' }}>
              Share privately with the beneficiary by file, JSON, or QR. They load it in{' '}
              <a href="/claim" className="underline" style={{ color: 'var(--green)' }}>Claim</a>{' '}
              — the secret never leaves their device.
            </div>
          </div>
        )}
      </div>

      {/* ── CSV Campaign Builder ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Campaign Builder — CSV Upload
          <span className="badge" style={{ background: '#2d1c3d', color: '#d2a8ff', fontSize: '0.65rem' }}>
            Off-chain
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Upload a CSV of beneficiaries to generate a wallet-bound campaign.
          Required columns: <span className="mono text-xs">name, id, wallet</span>
        </p>

        <div className="mb-3">
          <label className="text-xs block mb-1" style={{ color: 'var(--muted)' }}>
            Beneficiary list (.csv)
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleCsvUpload}
            className="text-sm"
            style={{ color: 'var(--text)' }}
          />
        </div>

        {csvError && (
          <div className="text-xs p-3 rounded-lg mb-3" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {csvError}
          </div>
        )}

        {csvRows && (
          <div>
            <div className="text-xs p-3 rounded-lg mb-3" style={{ background: '#0a1628', color: 'var(--muted)', border: '1px solid var(--border-dim)' }}>
              <div className="font-semibold mb-2" style={{ color: 'var(--text)' }}>
                {csvRows.length} beneficiary row{csvRows.length !== 1 ? 's' : ''} parsed
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {csvRows.map((r, i) => (
                  <div key={i} className="flex gap-3 mono">
                    <span style={{ color: 'var(--muted-2)', minWidth: 24 }}>#{i}</span>
                    <span style={{ minWidth: 80, flexShrink: 0 }}>{r.name}</span>
                    <span style={{ color: 'var(--muted-2)' }}>{r.wallet.slice(0, 8)}…</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-3 items-start flex-wrap">
              <button
                className="btn-primary text-sm"
                onClick={handleCsvDownload}
              >
                {csvDownloaded ? '✓ Downloaded' : 'Download beneficiaries.json'}
              </button>
              {csvDownloaded && (
                <div className="text-xs p-3 rounded-lg flex-1" style={{ background: '#0a1f14', color: 'var(--green)', border: '1px solid var(--green-dim)' }}>
                  Next: place beneficiaries.json in packages/merkle-tools/ then run{' '}
                  <span className="mono">npm run generate</span> to build the Merkle tree and campaign.json.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Registered Beneficiaries ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Registered Beneficiaries
          <span className="badge" style={{ background: '#1c2b3a', color: '#58a6ff', fontSize: '0.65rem' }}>
            Wallet-bound slots
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Pre-approved wallets from campaign.json. Issue credentials to any slot — only the bound wallet can claim.
        </p>

        {beneficiariesError ? (
          <div className="text-xs p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {beneficiariesError.includes('not found')
              ? 'campaign.json not found — run npm run generate in packages/merkle-tools first.'
              : beneficiariesError}
          </div>
        ) : !beneficiaries ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <div className="space-y-2">
            {beneficiaries.slots.map((slot) => (
              <div
                key={slot.index}
                className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg flex-wrap"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border-dim)' }}
              >
                <div className="flex items-center gap-3">
                  <span className="mono text-xs px-2 py-0.5 rounded" style={{ background: 'var(--surface-3)', color: 'var(--muted)' }}>
                    #{slot.index}
                  </span>
                  <span className="mono text-xs" style={{ color: 'var(--text)', wordBreak: 'break-all' }}>
                    {slot.claimant_address}
                  </span>
                </div>
                <button
                  className="text-xs px-3 py-1.5 rounded-lg font-medium flex-shrink-0"
                  style={
                    issuedBySlot[slot.index]
                      ? { background: '#0e3a1d', color: '#3fb950', border: '1px solid rgba(63,185,80,0.3)', cursor: 'default' }
                      : { background: 'var(--surface-3)', color: 'var(--muted-2)', border: '1px solid var(--border)' }
                  }
                  onClick={() => !issuedBySlot[slot.index] && handleIssueToSlot(slot)}
                  disabled={issuingSlot === slot.index || issuedBySlot[slot.index]}
                >
                  {issuedBySlot[slot.index]
                    ? '✓ Issued'
                    : issuingSlot === slot.index
                    ? 'Signing…'
                    : 'Issue & Download'}
                </button>
              </div>
            ))}
            <div className="text-xs pt-1" style={{ color: 'var(--muted)' }}>
              {beneficiaries.total_slots} slot{beneficiaries.total_slots !== 1 ? 's' : ''} · Merkle root{' '}
              <span className="mono">{beneficiaries.merkle_root.slice(0, 12)}…</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Non-PII Issuance Ledger ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1 flex items-center gap-2">
          Non-PII Issuance Ledger
          <span className="badge" style={{ background: '#1c2b3a', color: '#58a6ff', fontSize: '0.65rem' }}>
            Audit trail
          </span>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Durable local issuance records for operator accountability. Wallets are stored as keyed HMAC identifiers, not raw beneficiary data.
        </p>

        {issuanceLedgerError ? (
          <div className="text-xs p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {issuanceLedgerError}
          </div>
        ) : !issuanceLedger ? (
          <div className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Total issued', issuanceLedger.summary.total_issued],
                ['Issued today', issuanceLedger.summary.issued_today],
                ['Issuer keys', issuanceLedger.summary.active_issuers],
                ['Expiring soon', issuanceLedger.summary.expiring_within_7_days],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg p-3" style={{ background: 'var(--surface-2)', border: '1px solid var(--border-dim)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</div>
                  <div className="text-xl font-bold">{value}</div>
                </div>
              ))}
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {issuanceLedger.entries.length === 0 ? (
                <div className="text-xs" style={{ color: 'var(--muted)' }}>No credentials issued in this server ledger yet.</div>
              ) : issuanceLedger.entries.slice(0, 8).map((entry) => (
                <div
                  key={entry.credential_hash}
                  className="rounded-lg p-3 text-xs"
                  style={{ background: 'var(--surface-2)', border: '1px solid var(--border-dim)' }}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <span className="mono" style={{ color: 'var(--green-bright)' }}>slot #{entry.slot_index}</span>
                    <span className="mono" style={{ color: 'var(--muted)' }}>{new Date(entry.issued_at * 1000).toLocaleString()}</span>
                  </div>
                  <div className="mono" style={{ color: 'var(--muted)', wordBreak: 'break-all' }}>
                    wallet_hash: {entry.claimant_address_hash.slice(0, 16)}… · credential_hash: {entry.credential_hash.slice(0, 16)}…
                  </div>
                  <div className="mt-1" style={{ color: 'var(--muted-2)' }}>
                    delivery: {entry.delivery_modes.join(', ')}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="btn-outline text-sm" onClick={loadIssuanceLedger}>
                Refresh Ledger
              </button>
              <button className="btn-primary text-sm" onClick={handleDownloadLedger} disabled={issuanceLedger.entries.length === 0}>
                Export Ledger
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Wallet ── */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold text-sm">Freighter Wallet</span>
          {walletInstalled === false && <span className="badge" style={{ background: '#450a0a', color: '#fca5a5' }}>Not detected</span>}
          {walletInstalled === true && !walletAddress && <span className="badge" style={{ background: '#1c1917', color: '#a8a29e' }}>Installed</span>}
          {walletAddress && <span className="badge badge-green">Connected</span>}
        </div>
        {!walletAddress ? (
          <div>
            <button className="btn-primary w-full" onClick={handleConnectWallet}>
              Connect Freighter
            </button>
            {walletInstalled === false && (
              <p className="text-xs mt-2" style={{ color: '#f87171' }}>
                Freighter not found — <a href="https://freighter.app" target="_blank" rel="noopener noreferrer" className="underline">install the extension</a> then reload.
              </p>
            )}
            {walletError && <p className="text-xs mt-2" style={{ color: '#f87171' }}>{walletError}</p>}
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              Required for pause/unpause and fund escrow. Credential issuance works without a wallet.
            </p>
          </div>
        ) : (
          <div className="mono text-xs p-3 rounded-lg" style={{ background: '#0a1628', wordBreak: 'break-all' }}>
            {walletAddress}
          </div>
        )}
      </div>

      {/* ── Stats ── */}
      {loadingStats && !stats ? (
        <div className="card text-center py-12" style={{ color: 'var(--muted)' }}>Loading on-chain data…</div>
      ) : statsError ? (
        <div className="card text-center py-12" style={{ color: '#f87171' }}>{statsError}</div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Escrow Balance', value: `${stroopsToXlm(stats.escrow_balance)} XLM`, green: true },
            { label: 'Claims Paid', value: String(stats.claimed_count), green: false },
            { label: 'Payout / Claim', value: `${stroopsToXlm(stats.payout_amount)} XLM`, green: false },
            { label: 'Utilization', value: `${utilization.toFixed(1)}%`, green: false },
          ].map((s) => (
            <div key={s.label} className="card">
              <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: 6 }}>{s.label}</div>
              <div className="text-2xl font-bold" style={{ color: s.green ? 'var(--green)' : 'var(--text)' }}>{s.value}</div>
            </div>
          ))}
        </div>
      ) : null}

      {/* ── Fund escrow ── */}
      <div className="card mb-6">
        <div className="font-semibold mb-1">Fund Escrow</div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Deposit XLM from your Freighter wallet into the contract escrow.
        </p>
        <div className="flex gap-3 items-end mb-4">
          <div className="flex-1">
            <label className="text-xs mb-1 block" style={{ color: 'var(--muted)' }}>Amount (XLM)</label>
            <input type="number" min="1" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} disabled={fundBusy} />
          </div>
          <button className="btn-primary" onClick={handleFund} disabled={fundBusy || !walletAddress}>
            {!walletAddress ? 'Connect wallet'
              : fundStep === 'building' ? 'Building…'
              : fundStep === 'signing' ? 'Waiting for signature…'
              : fundStep === 'submitting' ? 'Submitting…'
              : fundStep === 'done' ? 'Fund again'
              : 'Fund Escrow'}
          </button>
        </div>
        {fundStep === 'done' && fundTxHash && (
          <div className="text-sm p-3 rounded-lg mb-3" style={{ background: '#0a1f14', border: '1px solid var(--green-dim)', color: 'var(--green)' }}>
            Funded ✓{' '}
            <a href={`${EXPLORER_BASE}/tx/${fundTxHash}`} target="_blank" rel="noopener noreferrer" className="underline ml-1">
              {shortHex(fundTxHash)} ↗
            </a>
          </div>
        )}
        {fundError && (
          <div className="text-sm p-3 rounded-lg" style={{ background: '#1a0505', color: '#f87171', border: '1px solid #7f1d1d' }}>
            {fundError}
          </div>
        )}
      </div>

      {/* ── Activity log ── */}
      {activityLog.length > 0 && (
        <div className="card">
          <div className="font-semibold mb-3 text-sm">Activity Log</div>
          <div className="space-y-1 mono text-xs" style={{ color: 'var(--muted)' }}>
            {activityLog.map((line, i) => <div key={i}>{line}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}
