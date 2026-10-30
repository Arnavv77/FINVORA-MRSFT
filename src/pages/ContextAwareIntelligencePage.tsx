import React, { useState, useEffect, useMemo } from 'react';
import {
  Brain,
  ShieldAlert,
  Boxes,
  Layers,
  History,
  FileSearch,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Play,
  UploadCloud,
  Search,
  Filter,
  ArrowRight,
  TrendingUp,
  AlertOctagon,
  Building,
  Calendar,
  DollarSign,
  FileText,
  UserCheck,
  XCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock,
  Unlock,
  Clock,
  Info,
  Check,
  X,
  PhoneCall,
  FileCheck,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { formatINR } from '../utils/formatters';
import {
  resetCAFIEMODEL2Demo,
  fetchCAFIEMODEL2Transactions,
  assessCAFIEMODEL2Transaction,
  fetchCAFIEMODEL2Assessment,
  takeCAFIEMODEL2Action,
  reassessCAFIEMODEL2Assessment,
  fetchCAFIEMODEL2VendorTimeline,
  fetchCAFIEMODEL2InventorySummary,
  fetchCAFIEMODEL2Audit,
  CAFIEMODEL2Transaction,
  CAFIEMODEL2Assessment,
  CAFIEMODEL2VendorTimeline,
  CAFIEMODEL2InventorySummary,
  CAFIEMODEL2AuditItem,
} from '../lib/api';

export const ContextAwareIntelligencePage: React.FC = () => {
  const { actualTheme } = useFinancial();
  const isDark = actualTheme === 'dark';

  // Navigation tab state: TAB 1 | TAB 2 | TAB 3
  const [activeTab, setActiveTab] = useState<'investigation' | 'vendor_memory' | 'inventory_to_cash'>('investigation');

  // Loading & Action feedback states
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Tab 1 Data States
  const [transactions, setTransactions] = useState<CAFIEMODEL2Transaction[]>([]);
  const [selectedTxId, setSelectedTxId] = useState<number | null>(null);
  const [currentAssessment, setCurrentAssessment] = useState<CAFIEMODEL2Assessment | null>(null);
  const [auditLogs, setAuditLogs] = useState<CAFIEMODEL2AuditItem[]>([]);

  // Tab 2 Data States
  const [vendorTimeline, setVendorTimeline] = useState<CAFIEMODEL2VendorTimeline | null>(null);
  const [vendorSearch, setVendorSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unresolved' | 'resolved'>('all');

  // Tab 3 Data States
  const [inventorySummary, setInventorySummary] = useState<CAFIEMODEL2InventorySummary | null>(null);

  // Verification Modal State
  const [verifyModalOpen, setVerifyModalOpen] = useState<boolean>(false);
  const [verifyMethod, setVerifyMethod] = useState<string>('DIRECT_PHONE_CALLBACK_TO_CFO');
  const [verifyConfirmed, setVerifyConfirmed] = useState<boolean>(true);
  const [verifyRemarks, setVerifyRemarks] = useState<string>('Direct verbal callback to CFO Vikram Mehta at registered mobile number. Beneficiary authentic.');

  // Load Initial Data
  const loadInitialData = async () => {
    setLoading(true);
    setStatusMessage(null);
    try {
      const txRes = await fetchCAFIEMODEL2Transactions(1);
      setTransactions(txRes.transactions);

      const defaultTx = txRes.transactions.find((t) => t.invoice_number === 'INV-0412') || txRes.transactions[0];
      if (defaultTx) {
        setSelectedTxId(defaultTx.id);
        if (defaultTx.assessment_id) {
          const assRes = await fetchCAFIEMODEL2Assessment(defaultTx.assessment_id, 1);
          setCurrentAssessment(assRes);
        } else {
          const assessed = await assessCAFIEMODEL2Transaction(defaultTx.id, false, 1);
          const assRes = await fetchCAFIEMODEL2Assessment(assessed.assessment_id, 1);
          setCurrentAssessment(assRes);
        }

        const vRes = await fetchCAFIEMODEL2VendorTimeline(defaultTx.vendor_id, 1);
        setVendorTimeline(vRes);
      }

      const invRes = await fetchCAFIEMODEL2InventorySummary(1);
      setInventorySummary(invRes);

      const auditRes = await fetchCAFIEMODEL2Audit(1);
      setAuditLogs(auditRes.audit_trail);
    } catch (err: any) {
      console.error('Failed to load CAFIE initial data:', err);
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to load data.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Handle Demo Reset
  const handleResetDemo = async () => {
    setActionLoading(true);
    setStatusMessage({ type: 'info', text: 'Resetting synthetic demonstration scenario for Orion Tech Distributors...' });
    try {
      await resetCAFIEMODEL2Demo(1);
      await loadInitialData();
      setStatusMessage({ type: 'success', text: 'Demo scenario reset successfully. Initial risk score: 63 (HIGH) with Gate G1: HOLD.' });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to reset demo scenario.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Run / Reassess
  const handleRunAssessment = async () => {
    if (!selectedTxId) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await assessCAFIEMODEL2Transaction(selectedTxId, true, 1);
      const assRes = await fetchCAFIEMODEL2Assessment(res.assessment_id, 1);
      setCurrentAssessment(assRes);
      setStatusMessage({
        type: 'success',
        text: `Assessment #${assRes.assessment_number} (v${assRes.version}) generated in ${assRes.total_execution_time_ms}ms across 13 stages.`,
      });
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to run assessment.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Bank Verification
  const handleVerifyBankSubmit = async () => {
    if (!currentAssessment) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await takeCAFIEMODEL2Action(currentAssessment.id, {
        action: 'verify_bank',
        verification_confirmed: verifyConfirmed,
        verification_method: verifyMethod,
        manager_remarks: verifyRemarks,
      });

      setVerifyModalOpen(false);

      if (verifyConfirmed) {
        const updated = await fetchCAFIEMODEL2Assessment(res.assessment_id, 1);
        setCurrentAssessment(updated);
        setStatusMessage({
          type: 'success',
          text: `Bank details verified! Active risk score dropped from 63 to ${updated.composite_risk_score} (${updated.risk_level}). Policy Gate cleared!`,
        });
      } else {
        const updated = await fetchCAFIEMODEL2Assessment(currentAssessment.id, 1);
        setCurrentAssessment(updated);
        setStatusMessage({
          type: 'error',
          text: 'Payment redirection blocked! Fraud prevention event logged in Financial Memory.',
        });
      }

      const auditRes = await fetchCAFIEMODEL2Audit(1);
      setAuditLogs(auditRes.audit_trail);
      if (currentAssessment.vendor_id) {
        const vRes = await fetchCAFIEMODEL2VendorTimeline(currentAssessment.vendor_id, 1);
        setVendorTimeline(vRes);
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to submit verification.' });
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Manager Governance Actions (Approve / Reject / Hold)
  const handleManagerAction = async (action: 'approve' | 'reject' | 'hold') => {
    if (!currentAssessment) return;
    setActionLoading(true);
    setStatusMessage(null);
    try {
      const res = await takeCAFIEMODEL2Action(currentAssessment.id, {
        action,
        manager_remarks: `Authorized manager action: ${action.toUpperCase()} executed via FINVORA Governance Console.`,
      });

      const updated = await fetchCAFIEMODEL2Assessment(currentAssessment.id, 1);
      setCurrentAssessment(updated);

      if (action === 'approve') {
        setStatusMessage({
          type: 'success',
          text: `Disbursement Approved! Simulated SAP Gateway response: ${res.sap_posting_status || 'SIMULATED_POSTED'} (Simulated SAP - not a real posting).`,
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: `Transaction marked as ${action.toUpperCase()}. Audit record created.`,
        });
      }

      const auditRes = await fetchCAFIEMODEL2Audit(1);
      setAuditLogs(auditRes.audit_trail);
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Action blocked: Policy gate G1 requires independent verification before approval.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Filtered vendor timeline events for Tab 2
  const filteredEvents = useMemo(() => {
    if (!vendorTimeline?.events) return [];
    return vendorTimeline.events.filter((e) => {
      const matchesSearch =
        e.category.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        e.remarks.toLowerCase().includes(vendorSearch.toLowerCase());
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'unresolved'
          ? e.status === 'unresolved'
          : e.status !== 'unresolved';
      return matchesSearch && matchesStatus;
    });
  }, [vendorTimeline, vendorSearch, statusFilter]);

  // Inventory 6-Month Issues Chart Data for Tab 3
  const issuesChartData = useMemo(() => {
    const raw = inventorySummary?.demo_sku?.six_month_issues || [27, 34, 43, 30, 39, 37];
    const months = ['Nov 2025', 'Dec 2025', 'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026'];
    return raw.map((val, idx) => ({
      month: months[idx] || `M-${idx + 1}`,
      issues: val,
      mean: 35,
    }));
  }, [inventorySummary]);

  return (
    <div className="min-h-screen bg-slate-50/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6 transition-colors">
      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-600 text-white shadow-md shadow-cyan-600/20">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Context-Aware Financial Intelligence Engine (CAFIE)
                </h1>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                  Model 2.0
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                  DEMO DATA
                </span>
                <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
                  SIMULATED SAP
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cross-system reconciliation, warehouse working capital, persistent risk memory & manager feedback loop
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleResetDemo}
            disabled={actionLoading}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin' : ''}`} />
            Reset Demo
          </button>
          <button
            onClick={handleRunAssessment}
            disabled={actionLoading}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-all shadow-sm"
          >
            <Play className="w-3.5 h-3.5" />
            Run Assessment
          </button>
        </div>
      </div>

      {/* ── NOTIFICATION / STATUS BANNER ────────────────────────────────────── */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300'
              : 'bg-cyan-50 border-cyan-200 text-cyan-800 dark:bg-cyan-950/40 dark:border-cyan-800 dark:text-cyan-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : statusMessage.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600 dark:text-rose-400" />
            ) : (
              <Info className="w-4 h-4 flex-shrink-0 text-cyan-600 dark:text-cyan-400" />
            )}
            <span className="font-medium">{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── NAVIGATION TABS ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('investigation')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'investigation'
              ? 'border-cyan-600 text-cyan-700 dark:text-cyan-400 bg-cyan-50/70 dark:bg-cyan-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ShieldAlert className="w-4 h-4" />
          TAB 1: TRANSACTION INVESTIGATION
        </button>
        <button
          onClick={() => setActiveTab('vendor_memory')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'vendor_memory'
              ? 'border-blue-600 text-blue-700 dark:text-blue-400 bg-blue-50/70 dark:bg-blue-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <History className="w-4 h-4" />
          TAB 2: VENDOR MEMORY
        </button>
        <button
          onClick={() => setActiveTab('inventory_to_cash')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-all ${
            activeTab === 'inventory_to_cash'
              ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/20'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Boxes className="w-4 h-4" />
          TAB 3: INVENTORY-TO-CASH
        </button>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: TRANSACTION INVESTIGATION                                      */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'investigation' && (
        <div className="space-y-6">
          {/* 1. Policy Gate Hero Banner */}
          <div
            className={`p-4 rounded-xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all shadow-sm ${
              currentAssessment?.policy_gate === 'CLEARED'
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200'
                : 'bg-rose-50/80 border-rose-200 text-rose-900 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className={`p-2.5 rounded-lg ${
                  currentAssessment?.policy_gate === 'CLEARED'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300'
                }`}
              >
                {currentAssessment?.policy_gate === 'CLEARED' ? (
                  <Unlock className="w-5 h-5" />
                ) : (
                  <Lock className="w-5 h-5 animate-pulse" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm tracking-wide">
                    {currentAssessment?.policy_gate || 'POLICY GATE G1: HOLD'}
                  </span>
                  <span
                    className={`px-2 py-0.5 text-[10px] uppercase font-bold rounded ${
                      currentAssessment?.policy_gate === 'CLEARED'
                        ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-800 dark:text-emerald-100'
                        : 'bg-rose-200 text-rose-800 dark:bg-rose-800 dark:text-rose-100'
                    }`}
                  >
                    {currentAssessment?.approval_status?.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl">
                  {currentAssessment?.policy_gate === 'CLEARED'
                    ? 'All beneficiary verification checks confirmed. Disbursement ready for simulated SAP S/4HANA release.'
                    : 'G1 Hold active: Unverified beneficiary bank account change detected within 90 days. Disbursement blocked. Independent verification callback required.'}
                </p>
              </div>
            </div>

            {/* Quick Action in Banner */}
            <div className="flex items-center gap-2 self-end md:self-center">
              {currentAssessment?.policy_gate !== 'CLEARED' ? (
                <button
                  onClick={() => setVerifyModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-sm"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Verify Bank Account
                </button>
              ) : (
                <button
                  onClick={() => handleManagerAction('approve')}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm"
                >
                  <FileCheck className="w-3.5 h-3.5" />
                  Approve Disbursement
                </button>
              )}
            </div>
          </div>

          {/* 2. Top Metric KPI Row: Score + 4 Financial Exposure Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {/* Risk Score */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Contextual Risk Score</span>
              <div className="flex items-baseline gap-2 mt-2">
                <span
                  className={`text-3xl font-extrabold tracking-tight ${
                    (currentAssessment?.composite_risk_score || 0) >= 60
                      ? 'text-rose-600 dark:text-rose-400'
                      : (currentAssessment?.composite_risk_score || 0) >= 30
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                  }`}
                >
                  {Math.round(currentAssessment?.composite_risk_score || 63)}
                </span>
                <span className="text-xs font-semibold text-slate-400">/ 100</span>
                <span
                  className={`ml-auto px-2 py-0.5 text-[10px] font-bold rounded ${
                    currentAssessment?.risk_level === 'HIGH'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      : currentAssessment?.risk_level === 'MEDIUM'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  }`}
                >
                  {currentAssessment?.risk_level || 'HIGH'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Deterministic weights: Bank 0.45, Recurr 0.20, Order 0.15
              </p>
            </div>

            {/* Payment at Risk */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Payment at Risk</span>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-white">
                {formatINR(currentAssessment?.payment_at_risk || 4720000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Full invoice total at risk due to unverified beneficiary change
              </p>
            </div>

            {/* Historical Unresolved Exposure */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Historical Unresolved</span>
              <div className="mt-2 text-xl font-bold text-amber-600 dark:text-amber-400">
                {formatINR(currentAssessment?.historical_unresolved_exposure || 342000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Distinct events: Jan Shortfall (₹1.9L) + Feb Rate Hike (₹1.52L)
              </p>
            </div>

            {/* Combined Exposure */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Combined Financial Exposure</span>
              <div className="mt-2 text-xl font-bold text-cyan-600 dark:text-cyan-400">
                {formatINR(currentAssessment?.combined_exposure || 5062000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Payment at risk + Historical unresolved exposure deduplicated
              </p>
            </div>

            {/* Exposure Averted */}
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Exposure Averted / Held</span>
              <div className="mt-2 text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatINR(currentAssessment?.exposure_averted || 4720000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Disbursement held pending verification; fraud loss prevented
              </p>
            </div>
          </div>

          {/* 3. Transaction Details & 3-Way Reconciliation Card */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Three-Way Reconciliation: PO-0412 + GRN-0412 + INV-0412
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Vendor: <span className="text-slate-800 dark:text-slate-200 font-semibold">{currentAssessment?.vendor_name || 'Orion Tech Distributors Pvt Ltd (DEMO)'}</span> | Warehouse: Pune Central (WH-PUN-01)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 text-xs font-bold rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  3-Way Match: PASS (100%)
                </span>
                <span className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  Version: v{currentAssessment?.version || 1}
                </span>
              </div>
            </div>

            {/* Line items table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Item / SKU</th>
                    <th className="py-2.5 px-3">PO Qty</th>
                    <th className="py-2.5 px-3">GRN Qty</th>
                    <th className="py-2.5 px-3">Invoice Qty</th>
                    <th className="py-2.5 px-3">Quantity Delta</th>
                    <th className="py-2.5 px-3">PO Price</th>
                    <th className="py-2.5 px-3">Invoice Price</th>
                    <th className="py-2.5 px-3">Price Delta</th>
                    <th className="py-2.5 px-3 text-right">Line Total (Incl. GST 18%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  <tr>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900 dark:text-white">Orion Enterprise Pro G15 Laptop</div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">SKU-LPT-ORION-G15 (Core i7, 16GB, 512GB SSD)</div>
                    </td>
                    <td className="py-3 px-3">100 units</td>
                    <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-medium">100 units</td>
                    <td className="py-3 px-3">100 units</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-semibold">
                        ΔQ = 0
                      </span>
                    </td>
                    <td className="py-3 px-3">₹40,00,000</td>
                    <td className="py-3 px-3">₹40,00,000</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-400 font-semibold">
                        ΔP = 0
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      ₹47,20,000.00
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Document coordinates callout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Purchase Order:</span>
                <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">PO-0412 (100 units @ ₹40,000 = ₹40,00,000)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Goods Receipt Note:</span>
                <div className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">GRN-0412 (100 units received & accepted)</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Remittance Bank Coordinates:</span>
                <div className="font-semibold text-amber-700 dark:text-amber-400 mt-0.5">Yes Bank (••••7731, IFSC YESB0005678)</div>
              </div>
            </div>
          </div>

          {/* 4. Processing Pipeline: 13 Stages with ms Execution Times */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Deterministic 13-Stage Processing Pipeline (Measured in Milliseconds)
              </h3>
              <span className="text-xs text-cyan-700 dark:text-cyan-400 font-mono font-semibold">
                Total Execution: {currentAssessment?.total_execution_time_ms || 28.5}ms
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-1">
              {(currentAssessment?.pipeline_execution_stages && currentAssessment.pipeline_execution_stages.length > 0
                ? currentAssessment.pipeline_execution_stages
                : [
                    { stage: '1. Transaction Ingestion', execution_time_ms: 1.2, status: 'COMPLETED' },
                    { stage: '2. Document Extraction', execution_time_ms: 2.1, status: 'COMPLETED' },
                    { stage: '3. Three-Way Reconciliation', execution_time_ms: 1.8, status: 'COMPLETED' },
                    { stage: '4. Vendor Behaviour Analysis', execution_time_ms: 1.5, status: 'COMPLETED' },
                    { stage: '5. Financial Memory Retrieval', execution_time_ms: 2.4, status: 'COMPLETED' },
                    { stage: '6. Inventory-to-Cash Analysis', execution_time_ms: 1.9, status: 'COMPLETED' },
                    { stage: '7. Cross-System Validation', execution_time_ms: 1.4, status: 'COMPLETED' },
                    { stage: '8. Evidence Assembly', execution_time_ms: 1.6, status: 'COMPLETED' },
                    { stage: '9. Contextual Risk Scoring', execution_time_ms: 1.1, status: 'COMPLETED' },
                    { stage: '10. Exposure Calculation', execution_time_ms: 1.3, status: 'COMPLETED' },
                    { stage: '11. Explainable Generation', execution_time_ms: 5.2, status: 'COMPLETED' },
                    { stage: '12. Human Approval Routing', execution_time_ms: 0.9, status: 'COMPLETED' },
                    { stage: '13. Memory Write-Back', execution_time_ms: 6.1, status: 'COMPLETED' },
                  ]
              ).map((stage, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Check className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                    <span className="text-slate-700 dark:text-slate-300 font-medium truncate">{stage.stage}</span>
                  </div>
                  <span className="text-[11px] font-mono text-cyan-700 dark:text-cyan-400 font-semibold ml-2">
                    {stage.execution_time_ms}ms
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 5. Evidence Assembly Breakdown */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Evidence Assembly Breakdown (Deterministic Scoring Weights)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Evidence ID</th>
                    <th className="py-2.5 px-3">Layer</th>
                    <th className="py-2.5 px-3">Rule Code</th>
                    <th className="py-2.5 px-3">Title & Explanation</th>
                    <th className="py-2.5 px-3">Weight</th>
                    <th className="py-2.5 px-3 text-right">Exposure</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {(currentAssessment?.evidence || []).map((ev, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono text-cyan-700 dark:text-cyan-400 font-semibold">{ev.id}</td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{ev.layer}</td>
                      <td className="py-3 px-3 font-mono text-slate-500 dark:text-slate-400">{ev.rule_code}</td>
                      <td className="py-3 px-3 max-w-md">
                        <div className="font-semibold text-slate-900 dark:text-white">{ev.title}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{ev.explanation}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded font-mono font-bold bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          {ev.weight.toFixed(2)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                        {formatINR(ev.financial_exposure)}
                      </td>
                    </tr>
                  ))}
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/20 text-slate-500 dark:text-slate-400">
                    <td className="py-2.5 px-3 font-mono">EVID-VEND-PRICE-004</td>
                    <td className="py-2.5 px-3">Adaptive Vendor Intelligence</td>
                    <td className="py-2.5 px-3 font-mono">RULE-PRICE-DRIFT</td>
                    <td className="py-2.5 px-3">
                      Price drift (+0.78%) is within configured tolerance (5.0%). Flag is absent.
                    </td>
                    <td className="py-2.5 px-3 font-mono">0.00</td>
                    <td className="py-2.5 px-3 text-right font-mono">₹0.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* 6. Explainable AI Recommendation & Governance Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Recommendation Narrative */}
            <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Grounded Explainable Financial Intelligence
              </h3>
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                {currentAssessment?.explanation ||
                  'Independent verification required - unusual combination, not a finding of wrongdoing. Three-way matching between PO-0412, GRN-0412, and Invoice INV-0412 is 100% consistent across all line items. However, critical payment security gate G1 triggered: remittance coordinates specify Yes Bank (••••7731) instead of registered HDFC Bank (••••4410) without an authorized verification callback.'}
              </p>
              <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/60 text-xs text-cyan-800 dark:text-cyan-200">
                <span className="font-bold">Recommended Action: </span>
                {currentAssessment?.recommended_action ||
                  'HOLD PAYMENT IMMEDIATELY. Conduct verbal/written signatory callback verification to authenticate Yes Bank account details before releasing funds.'}
              </div>
            </div>

            {/* Manager Actions Box */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Manager Decision Console
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Role-based approval. Gate G1 blocks approval until bank details are verified.
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <button
                  onClick={() => setVerifyModalOpen(true)}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-all shadow-sm"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  Verify Bank Account (Memory Feedback)
                </button>

                <button
                  onClick={() => handleManagerAction('approve')}
                  disabled={actionLoading}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
                    currentAssessment?.policy_gate === 'CLEARED'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Approve Disbursement {currentAssessment?.policy_gate !== 'CLEARED' && '(Blocked by G1)'}
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleManagerAction('reject')}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900 transition-all"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    Reject
                  </button>
                  <button
                    onClick={() => handleManagerAction('hold')}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-750 transition-all"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Hold
                  </button>
                </div>
              </div>

              {currentAssessment?.sap_posting_status === 'SIMULATED_POSTED' && (
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300">
                  <span className="font-bold">SAP Status: </span> SIMULATED_POSTED
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Simulated SAP - not a real posting.</div>
                </div>
              )}
            </div>
          </div>

          {/* 7. Immutable Governance Audit Trail */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              Immutable Governance Audit Trail (Manager Actions)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-950/70 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Audit ID</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Previous Status</th>
                    <th className="py-2.5 px-3">New Status</th>
                    <th className="py-2.5 px-3">User & Role</th>
                    <th className="py-2.5 px-3">Verification Method</th>
                    <th className="py-2.5 px-3">Remarks</th>
                    <th className="py-2.5 px-3 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                  {auditLogs.length > 0 ? (
                    auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono text-cyan-600 dark:text-cyan-400">#{log.id}</td>
                        <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{log.action}</td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{log.previous_status}</td>
                        <td className="py-2.5 px-3 text-emerald-600 dark:text-emerald-400 font-medium">{log.new_status}</td>
                        <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                          {log.user_id} ({log.user_role})
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{log.verification_method || 'N/A'}</td>
                        <td className="py-2.5 px-3 max-w-xs truncate text-slate-600 dark:text-slate-300">{log.manager_remarks}</td>
                        <td className="py-2.5 px-3 text-right text-slate-500 dark:text-slate-400">
                          {log.created_at ? new Date(log.created_at).toLocaleString() : 'N/A'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-slate-400">
                        No audit records logged yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: VENDOR MEMORY                                                  */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'vendor_memory' && (
        <div className="space-y-6">
          {/* Vendor Profile & Delivery Fill Rate Hero */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Delivery Fill Rate</span>
              <div className="mt-2 text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
                {vendorTimeline?.delivery_fill_rate || 94.4}%
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Jan: 45/50 received | Feb: 40/40 received (85/90 = 94.4%)
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Historical Order Baseline</span>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatINR(vendorTimeline?.historical_avg_order_value || 1786000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Trailing average order value across completed purchase cycles
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Weighted Average Unit Price</span>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatINR(vendorTimeline?.weighted_avg_unit_price || 39688.89)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Baseline unit price for SKU-LPT-ORION-G15
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Historical Unresolved Exposure</span>
              <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatINR(vendorTimeline?.historical_unresolved_exposure || 342000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Deduplicated across January short-delivery and February rate hike
              </p>
            </div>
          </div>

          {/* Searchable Chronological Timeline */}
          <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <History className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  Chronological Financial Risk Memory Timeline
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Persistent multi-month evidence vault for {vendorTimeline?.vendor_name || 'Orion Tech Distributors Pvt Ltd (DEMO)'}
                </p>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search memory..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500 w-44"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="all">All Events</option>
                  <option value="unresolved">Unresolved Only</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>

            {/* Timeline Stream */}
            <div className="space-y-3 pt-2">
              {filteredEvents.length > 0 ? (
                filteredEvents.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`p-2 rounded-lg mt-0.5 ${
                          ev.severity === 'critical'
                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                            : ev.severity === 'warning'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                            : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800'
                        }`}
                      >
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            {ev.category.replace('_', ' ').toUpperCase()}
                          </span>
                          <span className="px-2 py-0.5 text-[10px] rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-mono">
                            {ev.date}
                          </span>
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded font-semibold ${
                              ev.status === 'unresolved'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-xl">{ev.remarks}</p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0 self-end md:self-center">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 block font-medium">Financial Exposure</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono">
                        {formatINR(ev.impact)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No events found matching current search criteria.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: INVENTORY-TO-CASH                                              */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'inventory_to_cash' && (
        <div className="space-y-6">
          {/* Inventory Valuation & Working Capital Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Stock Valuation</span>
              <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
                {formatINR(5200000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                130 Units @ ₹40,000 unit cost in Pune Central Warehouse
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Excess Inventory Stock</span>
              <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
                15 Units
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Stock (130) - [90-Day Demand (105) + Safety Stock (10)]
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Working Capital Blocked</span>
              <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
                {formatINR(600000)}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Excess Stock (15 units) × ₹40,000 unit cost = ₹6,00,000.00
              </p>
            </div>

            <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Days of Cover</span>
              <div className="mt-2 text-2xl font-bold text-cyan-600 dark:text-cyan-400">
                111 Days
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                Stock (130) / Daily Demand (1.167 units/day)
              </p>
            </div>
          </div>

          {/* Historical Demand Chart & Uncertainty Range */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                  Six-Month Historical Demand & Issues (Units)
                </h3>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Monthly Mean: <span className="text-cyan-700 dark:text-cyan-400 font-bold">35 Units</span>
                </span>
              </div>

              <div className="h-64 pt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={issuesChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#f1f5f9'} />
                    <XAxis dataKey="month" stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} />
                    <YAxis stroke={isDark ? '#64748b' : '#94a3b8'} fontSize={11} domain={[0, 50]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: isDark ? '#020617' : '#ffffff',
                        borderColor: isDark ? '#334155' : '#e2e8f0',
                        color: isDark ? '#f8fafc' : '#0f172a',
                        fontSize: '11px',
                        borderRadius: '8px',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                      }}
                      formatter={(value: any) => [`${value} units`, 'Issues']}
                    />
                    <Bar dataKey="issues" fill="#0891b2" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Recorded monthly consumption issues: 27, 34, 43, 30, 39, 37. Sample standard deviation = 5.899.
              </p>
            </div>

            {/* 90-Day Demand & Assumptions */}
            <div className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                  <Boxes className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  90-Day Demand & Uncertainty Model
                </h3>

                <div className="space-y-3 pt-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Monthly Mean Demand:</span>
                    <span className="font-bold text-slate-900 dark:text-white">35 Units</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">90-Day Demand Forecast:</span>
                    <span className="font-bold text-cyan-700 dark:text-cyan-400">105 Units</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Sample Std Dev (s):</span>
                    <span className="font-mono text-slate-900 dark:text-white">5.899 Units</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Demand Uncertainty (s × √3):</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">~10 Units</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-slate-500 dark:text-slate-400">Forecast Value Range:</span>
                    <span className="font-bold text-slate-800 dark:text-slate-200">₹2,00,000 — ₹10,00,000</span>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-300">Model Assumptions: </span>
                Calculated assuming 7-day supplier replenishment lead time, safety stock buffer (10 units), and normal distribution uncertainty.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: VERIFY BANK ACCOUNT (MEMORY FEEDBACK) ────────────────────── */}
      {verifyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 space-y-4 shadow-2xl text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                Authorized Beneficiary Bank Verification
              </h3>
              <button onClick={() => setVerifyModalOpen(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <p className="text-slate-600 dark:text-slate-300">
                Remittance details on invoice <span className="font-mono font-bold text-slate-900 dark:text-white">INV-0412</span> specify{' '}
                <span className="text-amber-700 dark:text-amber-400 font-bold">Yes Bank (••••7731)</span> instead of registered{' '}
                <span className="text-slate-500 dark:text-slate-400 font-bold">HDFC Bank (••••4410)</span>.
              </p>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Verification Method</label>
                <select
                  value={verifyMethod}
                  onChange={(e) => setVerifyMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="DIRECT_PHONE_CALLBACK_TO_CFO">Direct Verbal Callback to Supplier CFO</option>
                  <option value="SIGNED_BOARD_RESOLUTION">Dual-Signatory Board Resolution Letter</option>
                  <option value="BANK_OFFICIAL_CONFIRMATION_LETTER">Bank Official Confirmation Letter with Stamp</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Verification Outcome</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyConfirmed(true)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      verifyConfirmed
                        ? 'bg-emerald-50 border-emerald-500 text-emerald-800 dark:bg-emerald-950 dark:border-emerald-600 dark:text-emerald-300'
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Confirmed Authentic
                  </button>
                  <button
                    type="button"
                    onClick={() => setVerifyConfirmed(false)}
                    className={`py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                      !verifyConfirmed
                        ? 'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-950 dark:border-rose-600 dark:text-rose-300'
                        : 'bg-slate-50 border-slate-200 text-slate-500 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-400'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    Unconfirmed / Rejected
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">Authorized Manager Remarks</label>
                <textarea
                  rows={3}
                  value={verifyRemarks}
                  onChange={(e) => setVerifyRemarks(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="Record verification call details, date, time, and signatory name..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setVerifyModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleVerifyBankSubmit}
                disabled={actionLoading}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white shadow-sm transition-all"
              >
                Submit Verification
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextAwareIntelligencePage;
