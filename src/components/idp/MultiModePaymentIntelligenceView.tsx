import React, { useState, useEffect, useMemo } from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Layers,
  ShieldCheck,
  RefreshCw,
  Sparkles,
  X,
  ChevronRight,
  Info,
  Lock,
  Send,
  Database,
  UserCheck,
  Split,
  Eye,
  ArrowRight,
  Search,
  Filter,
  Check,
  AlertOctagon,
  HelpCircle,
  TrendingUp,
  Cpu,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  Terminal,
} from 'lucide-react';
import {
  fetchIDPPaymentDashboard,
  extractAndMatchIDPPayment,
  executeIDPHumanApprovalAction,
  fetchIDPDebtorsList,
  fetchIDPFederatedStatus,
  runIDPFederatedRound,
  seedIDPPaymentDemo,
  IDPDashboardResponse,
  IDPPaymentDashboardItem,
  IDPRecommendationResponse,
  IDPFederatedModelStatus,
} from '../../lib/api';
import { formatINR } from '../../utils/formatters';

interface MultiModePaymentProps {
  onBackToValidations?: () => void;
}

export const MultiModePaymentIntelligenceView: React.FC<MultiModePaymentProps> = ({
  onBackToValidations,
}) => {
  // ── States ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState<boolean>(true);
  const [dashboard, setDashboard] = useState<IDPDashboardResponse | null>(null);
  const [modeFilter, setModeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // HITL Detail / Approval Modal
  const [approvalModalOpen, setApprovalModalOpen] = useState<boolean>(false);
  const [selectedPayment, setSelectedPayment] = useState<IDPPaymentDashboardItem | null>(null);
  const [activeRecommendation, setActiveRecommendation] = useState<IDPRecommendationResponse | null>(null);
  const [fetchingDetail, setFetchingDetail] = useState<boolean>(false);
  const [submittingAction, setSubmittingAction] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Manual Correction State
  const [debtorsList, setDebtorsList] = useState<any[]>([]);
  const [correctionMode, setCorrectionMode] = useState<'none' | 'debtor' | 'invoice' | 'split'>('none');
  const [selectedDebtorId, setSelectedDebtorId] = useState<number | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [splitAmounts, setSplitAmounts] = useState<Record<number, number>>({});
  const [accountantRemarks, setAccountantRemarks] = useState<string>('');
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // XML Preview Modal
  const [xmlModalOpen, setXmlModalOpen] = useState<boolean>(false);
  const [xmlContent, setXmlContent] = useState<string>('');

  // Federated Learning Modal
  const [federatedModalOpen, setFederatedModalOpen] = useState<boolean>(false);
  const [federatedStatus, setFederatedStatus] = useState<IDPFederatedModelStatus | null>(null);
  const [trainingRound, setTrainingRound] = useState<boolean>(false);

  // Ingest / Quick Scenario Runner Modal
  const [scenarioModalOpen, setScenarioModalOpen] = useState<boolean>(false);
  const [ingesting, setIngesting] = useState<boolean>(false);

  // ── Load Dashboard Data ───────────────────────────────────────────────────
  const loadData = async (filter?: string) => {
    try {
      setLoading(true);
      const data = await fetchIDPPaymentDashboard(filter || modeFilter);
      setDashboard(data);
    } catch (err: any) {
      console.error('Failed to load IDP Payment Dashboard:', err);
      setActionMessage({ type: 'error', text: err?.message || 'Error loading dashboard' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(modeFilter);
  }, [modeFilter]);

  // Load debtors for dropdown
  useEffect(() => {
    fetchIDPDebtorsList()
      .then((res) => setDebtorsList(res.debtors || []))
      .catch((err) => console.warn('Could not load debtors list:', err));
  }, []);

  // ── Quick Scenarios Pre-sets ──────────────────────────────────────────────
  const sampleScenarios = [
    {
      id: 1,
      title: 'Cheque Payment (TechCorp)',
      mode: 'CHEQUE',
      amount: 500000,
      ref: '778899',
      payload: {
        cheque_number: '778899',
        cheque_series: 'SB-MICR-01',
        amount: 500000.0,
        bank: 'HDFC Bank Ltd',
        date: '2026-04-14',
        payer_details: {
          drawer_name: 'TechCorp Solutions Pvt Ltd',
          memo: 'Payment for INV-2026-TC-101',
        },
      },
    },
    {
      id: 2,
      title: 'UPI Payment (Apex Cloud)',
      mode: 'UPI',
      amount: 1200000,
      ref: 'UPI-2026-992211',
      payload: {
        upi_transaction_id: 'UPI-2026-992211',
        utr_rrn: '411223344556',
        payer_vpa: 'apexcloud@icici',
        narration: 'Settlement INV-2026-APX-201',
        amount: 1200000.0,
        transaction_date: '2026-04-14',
      },
    },
    {
      id: 6,
      title: 'Partial Payment (Apex Cloud)',
      mode: 'BANK_TRANSFER',
      amount: 150000,
      ref: 'HDFC-INT-7711',
      payload: {
        account_reference: 'HDFC-INT-7711',
        narration: 'Part settlement INV-2026-APX-203',
        payer_details: { name: 'Apex Cloud Infrastructure Ltd' },
        amount: 150000.0,
        date: '2026-04-14',
      },
    },
    {
      id: 7,
      title: 'Multi-Invoice Split (Nova Logistics)',
      mode: 'NEFT',
      amount: 1000000,
      ref: 'NEFT-N20260414-4433',
      payload: {
        utr: 'NEFT-N20260414-4433',
        remitter_name: 'Nova Logistics Network LLP',
        narration: 'Payment for combined fleet logistics INV-NV-302 & 303',
        amount: 1000000.0,
        date: '2026-04-14',
      },
    },
    {
      id: 8,
      title: 'Identical Amount Collision (Anti-Hallucination)',
      mode: 'BANK_TRANSFER',
      amount: 750000,
      ref: 'GEN-TRF-0099',
      payload: {
        account_reference: 'GEN-TRF-0099',
        narration: 'Clearing balance of Rs 750000',
        payer_details: { name: 'General Commercial Clearing A/c' },
        amount: 750000.0,
        date: '2026-04-14',
      },
    },
    {
      id: 10,
      title: 'Unidentified Cash Payment',
      mode: 'CASH',
      amount: 315420,
      ref: 'CASH-RCPT-9999',
      payload: {
        receipt_number: 'CASH-RCPT-9999',
        payer_identity: { name: 'Anonymous Counter Deposit' },
        amount: 315420.0,
        date: '2026-04-14',
      },
    },
  ];

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleResetDemoSeed = async () => {
    try {
      setLoading(true);
      await seedIDPPaymentDemo();
      setActionMessage({ type: 'success', text: 'Deterministic enterprise demo environment seeded!' });
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Error seeding demo' });
    } finally {
      setLoading(false);
    }
  };

  const handleOpenPaymentDetail = async (p: IDPPaymentDashboardItem) => {
    setSelectedPayment(p);
    setCorrectionMode('none');
    setAccountantRemarks('');
    setSelectedDebtorId(null);
    setSelectedInvoiceIds([]);
    setSplitAmounts({});
    setHasPermission(false);
    setApprovalModalOpen(true);

    try {
      setFetchingDetail(true);
      // Run extraction and match to inspect full structured details
      const rec = await extractAndMatchIDPPayment(p.payment_mode, {
        reference_id: p.reference_id,
        amount: p.amount,
        payer_name: p.payer_name,
        payer_vpa: p.payer_vpa,
        narration: p.narration,
        payment_date: p.payment_date,
      });
      setActiveRecommendation(rec);
    } catch (err: any) {
      console.warn('Could not fetch active recommendation detail:', err);
    } finally {
      setFetchingDetail(false);
    }
  };

  const handleExecuteAction = async (action: any) => {
    if (!selectedPayment) return;
    if (action === 'APPROVE_AND_POST' && !hasPermission) {
      alert(`Permission Required: You must grant explicit permission to direct ${formatINR(selectedPayment.amount)} to the ledger of ${selectedPayment.suggested_debtor || 'the person'} before posting.`);
      return;
    }
    try {
      setSubmittingAction(true);
      const res = await executeIDPHumanApprovalAction(selectedPayment.payment_id, {
        action,
        approved_by: 'Senior Accountant (CFO Auth)',
        corrected_debtor_id: selectedDebtorId || undefined,
        corrected_invoice_ids: selectedInvoiceIds.length > 0 ? selectedInvoiceIds : undefined,
        split_allocations:
          Object.keys(splitAmounts).length > 0
            ? Object.entries(splitAmounts).map(([invId, amt]) => ({ invoice_id: Number(invId), amount: Number(amt) }))
            : undefined,
        remarks: accountantRemarks,
      });

      if (res.tally_xml_snippet) {
        setXmlContent(res.tally_xml_snippet);
      }

      setActionMessage({
        type: res.success ? 'success' : 'error',
        text: res.message,
      });
      setApprovalModalOpen(false);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Action failed' });
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleIngestScenario = async (sc: any) => {
    try {
      setIngesting(true);
      const rec = await extractAndMatchIDPPayment(sc.mode, sc.payload);
      setActionMessage({
        type: 'success',
        text: `Ingested ${sc.title}! Matched Tier: ${rec.match_tier} (${rec.confidence_score}%)`,
      });
      setScenarioModalOpen(false);
      await loadData();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Ingestion failed' });
    } finally {
      setIngesting(false);
    }
  };

  const handleOpenFederated = async () => {
    try {
      setFederatedModalOpen(true);
      const status = await fetchIDPFederatedStatus();
      setFederatedStatus(status);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTriggerFederatedRound = async () => {
    try {
      setTrainingRound(true);
      const res = await runIDPFederatedRound();
      setActionMessage({
        type: 'success',
        text: `Federated Learning Round ${res.round_number} complete! Published Global Model ${res.version_tag}.`,
      });
      const status = await fetchIDPFederatedStatus();
      setFederatedStatus(status);
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err?.message || 'Training round failed' });
    } finally {
      setTrainingRound(false);
    }
  };

  // Filtered payments by search
  const filteredPayments = useMemo(() => {
    if (!dashboard?.payments) return [];
    if (!searchQuery.trim()) return dashboard.payments;
    const q = searchQuery.toLowerCase();
    return dashboard.payments.filter(
      (p) =>
        p.reference_id?.toLowerCase().includes(q) ||
        p.payer_name?.toLowerCase().includes(q) ||
        p.suggested_debtor.toLowerCase().includes(q) ||
        p.narration?.toLowerCase().includes(q) ||
        p.payment_mode.toLowerCase().includes(q) ||
        p.match_tier.toLowerCase().includes(q)
    );
  }, [dashboard, searchQuery]);

  // Mode tabs helper
  const modes = [
    { id: 'ALL', label: 'All Modes' },
    { id: 'CHEQUE', label: 'Cheque' },
    { id: 'UPI', label: 'UPI' },
    { id: 'NEFT', label: 'NEFT' },
    { id: 'RTGS', label: 'RTGS' },
    { id: 'IMPS', label: 'IMPS' },
    { id: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { id: 'CASH', label: 'Cash' },
    { id: 'CARD_GATEWAY', label: 'Card / PG' },
  ];

  return (
    <div className="space-y-6">
      {/* ── Top Alert / Message Banner ────────────────────────────────────────── */}
      {actionMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
            actionMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 border-rose-300 text-rose-900 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button onClick={() => setActionMessage(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Hero & Actions Header ────────────────────────────────────────────── */}
      <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider uppercase bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
              FINVORA IDP · PAYMENT INTELLIGENCE
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              HITL Gate Enforced
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Multi-Mode Payment Intelligence & Automated Reconciliation
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Extracts incoming payments across 8 instruments, matches debtors/invoices with explainable confidence, and posts idempotent Tally/ERP receipt vouchers.
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={() => setScenarioModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Ingest / Test Scenarios
          </button>

          <button
            onClick={handleOpenFederated}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-all"
          >
            <Cpu className="w-3.5 h-3.5" />
            Federated Learning
          </button>

          <button
            onClick={handleResetDemoSeed}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Seed Demo Data
          </button>
        </div>
      </div>

      {/* ── KPI Metrics Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Incoming Payments</div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-white mt-1">
            {dashboard?.stats.total_incoming || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">All 8 Payment Modes</div>
        </div>

        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 shadow-sm">
          <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 uppercase">Pending Approval</div>
          <div className="text-xl font-extrabold text-amber-800 dark:text-amber-200 mt-1">
            {dashboard?.stats.pending_approval || 0}
          </div>
          <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Accountant Gate Active</div>
        </div>

        <div className="p-4 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Posted to ERP</div>
          <div className="text-xl font-extrabold text-emerald-800 dark:text-emerald-200 mt-1">
            {dashboard?.stats.posted_reconciled || 0}
          </div>
          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5">Tally Vouchers Verified</div>
        </div>

        <div className="p-4 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 uppercase">Duplicate Alerts</div>
          <div className="text-xl font-extrabold text-rose-800 dark:text-rose-200 mt-1">
            {dashboard?.stats.duplicate_alerts || 0}
          </div>
          <div className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5">Double Post Blocked</div>
        </div>

        <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 shadow-sm">
          <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 uppercase">Unidentified</div>
          <div className="text-xl font-extrabold text-indigo-800 dark:text-indigo-200 mt-1">
            {dashboard?.stats.unidentified || 0}
          </div>
          <div className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-0.5">In Clearing Ledger</div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900 text-white shadow-sm">
          <div className="text-[11px] font-semibold text-slate-400 uppercase">Auto-Recon Rate</div>
          <div className="text-xl font-extrabold text-white mt-1">
            {dashboard?.stats.reconciliation_rate || 0}%
          </div>
          <div className="text-[10px] text-emerald-400 mt-0.5">Explainable Accuracy</div>
        </div>
      </div>

      {/* ── Mode Filters & Search Bar ────────────────────────────────────────── */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1">
            {modes.map((m) => (
              <button
                key={m.id}
                onClick={() => setModeFilter(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  modeFilter === m.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative w-full md:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search reference, payer, debtor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* ── Master Payments Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-blue-600" />
            Incoming Payment Transactions & Match Recommendations
          </h3>
          <span className="text-[11px] text-slate-400">
            Showing {filteredPayments.length} of {dashboard?.payments.length || 0} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-3.5">ID / Mode</th>
                <th className="py-3 px-3.5">Reference / Date</th>
                <th className="py-3 px-3.5">Amount (INR)</th>
                <th className="py-3 px-3.5">Payer / Narration</th>
                <th className="py-3 px-3.5">Suggested Debtor & Ledger</th>
                <th className="py-3 px-3.5">Match Tier & Confidence</th>
                <th className="py-3 px-3.5">Reconciliation Status</th>
                <th className="py-3 px-3.5 text-right">HITL Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-400">
                    No payment records found. Click <strong>"Seed Demo Data"</strong> or <strong>"Ingest / Test Scenarios"</strong>.
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => {
                  const isPosted = p.status === 'POSTED';
                  const isDup = p.status === 'DUPLICATE_SUSPECT';
                  const isAmbig = p.match_tier === 'AMBIGUOUS_DEBTOR';
                  const isUnid = p.match_tier === 'UNIDENTIFIED';

                  return (
                    <tr
                      key={p.payment_id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-850/50 transition-colors"
                    >
                      {/* ID / Mode */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-slate-900 dark:text-white">#{p.payment_id}</div>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                          {p.payment_mode}
                        </span>
                      </td>

                      {/* Reference / Date */}
                      <td className="py-3 px-3.5">
                        <div className="font-mono text-slate-900 dark:text-white font-medium">
                          {p.reference_id || 'N/A'}
                        </div>
                        <div className="text-[10px] text-slate-400">{p.payment_date || 'Today'}</div>
                      </td>

                      {/* Amount */}
                      <td className="py-3 px-3.5 font-bold text-slate-900 dark:text-white">
                        {formatINR(p.amount)}
                      </td>

                      {/* Payer / Narration */}
                      <td className="py-3 px-3.5 max-w-xs">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {p.payer_name || p.payer_vpa || 'Unregistered Payer'}
                        </div>
                        <div className="text-[10px] text-slate-500 truncate" title={p.narration}>
                          {p.narration || 'No memo'}
                        </div>
                      </td>

                      {/* Suggested Debtor & Ledger */}
                      <td className="py-3 px-3.5">
                        <div className="font-bold text-blue-600 dark:text-blue-400">
                          {p.suggested_debtor}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">{p.suggested_ledger}</div>
                      </td>

                      {/* Match Tier & Confidence */}
                      <td className="py-3 px-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wide ${
                              isDup
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : isAmbig
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : isUnid
                                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {p.match_tier}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-600 dark:text-slate-400">
                            {p.confidence_score}%
                          </span>
                        </div>
                      </td>

                      {/* Recon Status */}
                      <td className="py-3 px-3.5">
                        {isPosted ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              POSTED_CONFIRMED
                            </span>
                            {p.erp_voucher_number && (
                              <button
                                onClick={() => {
                                  setXmlContent(`VOUCHER: ${p.erp_voucher_number}\nSystem: Tally Prime XML`);
                                  setXmlModalOpen(true);
                                }}
                                className="text-[10px] text-blue-600 hover:underline block font-mono"
                              >
                                {p.erp_voucher_number}
                              </button>
                            )}
                          </div>
                        ) : isDup ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">
                            <ShieldAlert className="w-3 h-3" />
                            DUPLICATE_HOLD
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                            <Clock className="w-3 h-3" />
                            PENDING_APPROVAL
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3 px-3.5 text-right">
                        <button
                          onClick={() => handleOpenPaymentDetail(p)}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-all inline-flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          Review & Authorize
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL: HUMAN-IN-THE-LOOP APPROVAL & CORRECTION ──────────────────── */}
      {approvalModalOpen && selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-5 shadow-2xl text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  Human-in-the-Loop Approval Centre
                </span>
                <h3 className="text-base font-bold flex items-center gap-2">
                  Review Payment #{selectedPayment.payment_id} ({selectedPayment.payment_mode})
                </h3>
              </div>
              <button
                onClick={() => setApprovalModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Transaction Facts Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Payment Instrument</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">{selectedPayment.payment_mode}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Amount</div>
                <div className="font-bold text-slate-900 dark:text-white mt-0.5">{formatINR(selectedPayment.amount)}</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Reference ID / UTR</div>
                <div className="font-mono font-medium text-slate-900 dark:text-white mt-0.5">
                  {selectedPayment.reference_id || 'None'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400 font-semibold uppercase">Date</div>
                <div className="text-slate-900 dark:text-white mt-0.5">{selectedPayment.payment_date || 'Today'}</div>
              </div>
            </div>

            {/* Narration & Remitter Banner */}
            <div className="p-3 rounded-lg bg-blue-50/60 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs space-y-1">
              <div className="font-semibold text-blue-900 dark:text-blue-300">
                Payer / Remitter: {selectedPayment.payer_name || selectedPayment.payer_vpa || 'Unknown'}
              </div>
              <div className="text-[11px] text-blue-700 dark:text-blue-400">
                Statement Narration: "{selectedPayment.narration || 'N/A'}"
              </div>
            </div>

            {/* Intelligent Recommendation Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Engine Recommendation
                  </span>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                  {selectedPayment.match_tier} · Confidence {selectedPayment.confidence_score}%
                </span>
              </div>

              <div className="text-xs text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/80 p-3 rounded-lg">
                <strong>Explanation: </strong> {selectedPayment.explanation}
              </div>

              {/* Evidence Breakdown */}
              {activeRecommendation?.evidence_breakdown && activeRecommendation.evidence_breakdown.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Supporting Evidence:</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {activeRecommendation.evidence_breakdown.map((ev, i) => (
                      <div
                        key={i}
                        className="p-2 rounded border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-850 flex items-start gap-2"
                      >
                        <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-semibold text-[11px]">{ev.factor} ({ev.weight} pts)</div>
                          <div className="text-[10px] text-slate-500">{ev.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested Invoices Breakdown */}
              {activeRecommendation?.suggested_invoices && activeRecommendation.suggested_invoices.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Allocated Invoices:</div>
                  <div className="space-y-1 text-xs">
                    {activeRecommendation.suggested_invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2 rounded bg-slate-50 dark:bg-slate-800 flex items-center justify-between font-mono"
                      >
                        <span>{inv.invoice_number}</span>
                        <span>Balance: {formatINR(inv.balance_amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Manual Correction Form if triggered */}
            {correctionMode === 'debtor' && (
              <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 space-y-3 text-xs">
                <div className="font-bold text-amber-900 dark:text-amber-200">
                  Select Correct Debtor (Accountant Feedback will be saved to CAFIE Memory):
                </div>
                <select
                  value={selectedDebtorId || ''}
                  onChange={(e) => setSelectedDebtorId(Number(e.target.value))}
                  className="w-full p-2 rounded border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900 text-xs"
                >
                  <option value="">-- Choose Debtor --</option>
                  {debtorsList.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code}) - Balance: {formatINR(d.current_balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Split Allocation Form */}
            {correctionMode === 'split' && (
              <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 space-y-3 text-xs">
                <div className="font-bold text-purple-900 dark:text-purple-200">
                  Manual Multi-Invoice Split Allocations:
                </div>
                <p className="text-[11px] text-purple-700 dark:text-purple-300">
                  Enter custom amount for each invoice. Total must equal payment amount ({formatINR(selectedPayment.amount)}).
                </p>
                <div className="space-y-2">
                  {debtorsList
                    .flatMap((d) => d.open_invoices || [])
                    .slice(0, 4)
                    .map((inv: any) => (
                      <div key={inv.id} className="flex items-center justify-between gap-3 bg-white dark:bg-slate-900 p-2 rounded border">
                        <span className="font-mono">{inv.invoice_number} (Bal: {formatINR(inv.balance_amount)})</span>
                        <input
                          type="number"
                          placeholder="Amount"
                          value={splitAmounts[inv.id] || ''}
                          onChange={(e) =>
                            setSplitAmounts({ ...splitAmounts, [inv.id]: Number(e.target.value) })
                          }
                          className="w-32 p-1 text-xs border rounded bg-slate-50 dark:bg-slate-800 text-right"
                        />
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Target Person's Ledger Destination */}
            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                <span>Person's Ledger Destination</span>
                <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  Amount Directed: {formatINR(selectedPayment.amount)}
                </span>
              </div>
              <div className="text-xs text-slate-800 dark:text-slate-200">
                Directed To Ledger: <strong className="font-mono text-indigo-900 dark:text-indigo-200">{selectedPayment.suggested_ledger || `Sundry Debtors - ${selectedPayment.suggested_debtor}`}</strong>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                Beneficiary / Entity: <strong>{selectedPayment.suggested_debtor || selectedPayment.payer_name || 'Debtor Account'}</strong>
              </div>
            </div>

            {/* Mandatory Permission Checkpoint */}
            <div className="p-3.5 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Permission Required Before Making Changes</span>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">
                The extracted amount of <strong className="font-mono">{formatINR(selectedPayment.amount)}</strong> will be directed and posted to the ledger of <strong>{selectedPayment.suggested_debtor || selectedPayment.payer_name}</strong>. Explicit user permission is required before any accounting entries or changes are executed.
              </p>
              <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer pt-0.5">
                <input
                  type="checkbox"
                  checked={hasPermission}
                  onChange={(e) => setHasPermission(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                />
                <span>I grant authorized permission to direct {formatINR(selectedPayment.amount)} to the person's ledger and post changes</span>
              </label>
            </div>

            {/* Accountant Remarks Input */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-500 uppercase">
                Accountant Approval Remarks (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Verified remitter bank statement. Approved for Tally posting."
                value={accountantRemarks}
                onChange={(e) => setAccountantRemarks(e.target.value)}
                className="w-full p-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            {/* 7 HITL Action Buttons */}
            <div className="border-t border-slate-100 dark:border-slate-800 pt-4 space-y-2.5">
              <div className="text-[10px] font-bold text-slate-400 uppercase">Authorized HITL Actions:</div>
              <div className="flex flex-wrap items-center gap-2">
                {/* 1. Approve & Post */}
                <button
                  onClick={() => handleExecuteAction('APPROVE_AND_POST')}
                  disabled={submittingAction || !hasPermission}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  1. Approve & Post to ERP
                </button>

                {/* 2. Correct Debtor */}
                <button
                  onClick={() => {
                    if (correctionMode === 'debtor' && selectedDebtorId) {
                      handleExecuteAction('CORRECT_DEBTOR');
                    } else {
                      setCorrectionMode('debtor');
                    }
                  }}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 text-xs font-semibold transition-all"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {correctionMode === 'debtor' ? 'Submit Debtor Correction' : '2. Correct Debtor'}
                </button>

                {/* 3. Split Payment */}
                <button
                  onClick={() => {
                    if (correctionMode === 'split' && Object.keys(splitAmounts).length > 0) {
                      handleExecuteAction('SPLIT_PAYMENT');
                    } else {
                      setCorrectionMode('split');
                    }
                  }}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/70 border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-100 text-xs font-semibold transition-all"
                >
                  <Split className="w-3.5 h-3.5" />
                  {correctionMode === 'split' ? 'Post Split Allocations' : '3. Split Payment'}
                </button>

                {/* 4. Reject */}
                <button
                  onClick={() => handleExecuteAction('REJECT')}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 text-xs font-semibold transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                  4. Reject
                </button>

                {/* 5. Mark Unidentified */}
                <button
                  onClick={() => handleExecuteAction('MARK_UNIDENTIFIED')}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 text-xs font-semibold transition-all"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  5. Mark Unidentified
                </button>

                {/* 6. Send for Verification */}
                <button
                  onClick={() => handleExecuteAction('SEND_FOR_VERIFICATION')}
                  disabled={submittingAction}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/70 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 text-xs font-semibold transition-all"
                >
                  <Lock className="w-3.5 h-3.5" />
                  6. Escrow / Hold Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: INGEST & TEST SCENARIOS ──────────────────────────────────── */}
      {scenarioModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                Ingest Incoming Payment · 13 Test Scenarios
              </h3>
              <button onClick={() => setScenarioModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Select one of the deterministic enterprise payment scenarios to extract attributes, evaluate through the reconciliation engine, and test human approval:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {sampleScenarios.map((sc) => (
                <div
                  key={sc.id}
                  onClick={() => handleIngestScenario(sc)}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/40 cursor-pointer transition-all space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-slate-900 dark:text-white">
                      #{sc.id} {sc.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700">
                      {sc.mode}
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                    {formatINR(sc.amount)} · Ref: <span className="font-mono">{sc.ref}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: FEDERATED LEARNING INTELLIGENCE ───────────────────────────── */}
      {federatedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-indigo-600" />
                Federated Payment Intelligence · Privacy Preserving Multi-Tenant AI
              </h3>
              <button onClick={() => setFederatedModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs space-y-1.5">
              <div className="font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
                Differential Privacy & Company Data Isolation Active
              </div>
              <p className="text-[11px] text-indigo-800 dark:text-indigo-300">
                Raw payments, debtor names, and invoice records remain strictly inside local tenant boundaries. Only L2-norm clipped weight updates with (ε={federatedStatus?.epsilon || 1.2}, δ={federatedStatus?.delta || '1e-5'}) Gaussian noise are shared.
              </p>
            </div>

            {/* Participating Isolated Tenants */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-500 uppercase">Participating Isolated Tenants:</div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(federatedStatus?.participants_summary || []).map((p: any) => (
                  <div key={p.code} className="p-2.5 rounded-lg border bg-slate-50 dark:bg-slate-800">
                    <div className="font-bold text-slate-900 dark:text-white">{p.code}</div>
                    <div className="text-[11px] text-slate-500 truncate">{p.name}</div>
                    <div className="text-[10px] text-emerald-600 font-semibold mt-1">
                      {p.samples} samples · Isolated
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Weights */}
            {federatedStatus?.model_weights && (
              <div className="space-y-1.5">
                <div className="text-xs font-bold text-slate-500 uppercase">
                  Global Model Weights ({federatedStatus.version} · Round {federatedStatus.round_number}):
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                  {Object.entries(federatedStatus.model_weights).map(([k, v]) => (
                    <div key={k} className="p-1.5 rounded bg-slate-50 dark:bg-slate-800 flex justify-between">
                      <span className="text-slate-500">{k}</span>
                      <span className="font-bold">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-400">
                Last aggregation: {federatedStatus?.last_aggregated || 'Just now'}
              </span>
              <button
                onClick={handleTriggerFederatedRound}
                disabled={trainingRound}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${trainingRound ? 'animate-spin' : ''}`} />
                Train Round with DP Noise
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: TALLY XML PREVIEW ────────────────────────────────────────── */}
      {xmlModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-3 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-600" />
                Tally Prime XML Receipt Voucher Payload
              </h3>
              <button onClick={() => setXmlModalOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <pre className="p-3 rounded-lg bg-slate-950 text-emerald-400 text-[11px] font-mono overflow-x-auto max-h-80">
              {xmlContent}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

