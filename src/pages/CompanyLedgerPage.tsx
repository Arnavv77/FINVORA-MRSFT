import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ArrowUpRight,
  ArrowDownLeft,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Send,
  RefreshCw,
  FileCheck,
  ChevronRight,
  TrendingDown,
  TrendingUp,
  User,
  Scale,
  History,
  FileSpreadsheet
} from 'lucide-react';
import {
  LedgerCompany,
  CompanyLedgerSummary,
  LedgerTransactionItem,
  LedgerTransactionDetail,
  fetchLedgerCompanies,
  fetchCompanyLedgerSummary,
  fetchCompanyLedger,
  fetchLedgerTransactionDetail,
  approveLedgerTransaction,
  rejectLedgerTransaction,
  requestChangesLedgerTransaction,
  resubmitLedgerTransaction,
  seedCompanyLedgerDemo,
} from '../lib/api';

const formatINR = (val: number | undefined | null): string => {
  if (val === undefined || val === null || isNaN(val)) return '₹0.00';
  return '₹' + Number(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export const CompanyLedgerPage: React.FC = () => {
  // Company & Summary state
  const [companies, setCompanies] = useState<LedgerCompany[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);
  const [summary, setSummary] = useState<CompanyLedgerSummary | null>(null);
  const [transactions, setTransactions] = useState<LedgerTransactionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [tableLoading, setTableLoading] = useState<boolean>(false);
  const [seedLoading, setSeedLoading] = useState<boolean>(false);

  // Filters state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [voucherFilter, setVoucherFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');

  // Selected Transaction Modal
  const [selectedTxnId, setSelectedTxnId] = useState<number | null>(null);
  const [txnDetail, setTxnDetail] = useState<LedgerTransactionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'journey' | 'lines' | 'finvora' | 'actions' | 'audit'>('journey');

  // Action Form states
  const [managerRemarks, setManagerRemarks] = useState<string>('');
  const [rejectionReason, setRejectionReason] = useState<string>('');
  const [changeRemarks, setChangeRemarks] = useState<string>('');
  const [resubmitCorrectionNotes, setResubmitCorrectionNotes] = useState<string>('');
  const [actionInProgress, setActionInProgress] = useState<boolean>(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Initial load: Fetch companies
  useEffect(() => {
    loadCompanies();
  }, []);

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const comps = await fetchLedgerCompanies();
      setCompanies(comps);
      if (comps.length > 0) {
        const primary = comps.find((c) => c.company_code === 'CMP-ABC-01') || comps[0];
        setSelectedCompanyId(primary.id);
      }
    } catch (err: any) {
      console.error('Error fetching companies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load summary & transactions when selectedCompanyId changes
  useEffect(() => {
    if (selectedCompanyId) {
      loadLedgerData(selectedCompanyId);
    }
  }, [selectedCompanyId]);

  const loadLedgerData = async (companyId: number) => {
    try {
      setTableLoading(true);
      const [sumRes, txnsRes] = await Promise.all([
        fetchCompanyLedgerSummary(companyId),
        fetchCompanyLedger(companyId, {
          search: searchQuery,
          voucher_type: voucherFilter,
          approval_status: statusFilter,
          from_date: fromDate,
          to_date: toDate,
        }),
      ]);
      setSummary(sumRes);
      setTransactions(txnsRes);
    } catch (err: any) {
      console.error('Error fetching company ledger data:', err);
    } finally {
      setTableLoading(false);
    }
  };

  // Filter apply handler
  const handleApplyFilters = () => {
    if (selectedCompanyId) {
      loadLedgerData(selectedCompanyId);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setVoucherFilter('ALL');
    setStatusFilter('ALL');
    setRiskFilter('ALL');
    setFromDate('');
    setToDate('');
    if (selectedCompanyId) {
      fetchCompanyLedger(selectedCompanyId, {}).then((txns) => {
        setTransactions(txns);
      });
    }
  };

  // Seed demo data handler
  const handleSeedDemo = async () => {
    try {
      setSeedLoading(true);
      const res = await seedCompanyLedgerDemo();
      await loadCompanies();
      if (res.primary_company_id) {
        setSelectedCompanyId(res.primary_company_id);
      }
      setActionSuccessMessage('Successfully reset & loaded standard FINVORA Demo Ledger scenario dataset.');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Failed to seed demo data');
      setTimeout(() => setActionErrorMessage(null), 4000);
    } finally {
      setSeedLoading(false);
    }
  };

  // Open Transaction Detail Modal
  const handleOpenTransaction = async (txnId: number) => {
    setSelectedTxnId(txnId);
    setActiveTab('journey');
    setActionSuccessMessage(null);
    setActionErrorMessage(null);
    setManagerRemarks('');
    setRejectionReason('');
    setChangeRemarks('');
    setResubmitCorrectionNotes('');

    try {
      setDetailLoading(true);
      const detail = await fetchLedgerTransactionDetail(txnId);
      setTxnDetail(detail);
    } catch (err: any) {
      console.error('Failed to load transaction detail:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Refresh current transaction & ledger
  const refreshCurrentTxn = async (txnId: number) => {
    try {
      const detail = await fetchLedgerTransactionDetail(txnId);
      setTxnDetail(detail);
      if (selectedCompanyId) {
        const [sumRes, txnsRes] = await Promise.all([
          fetchCompanyLedgerSummary(selectedCompanyId),
          fetchCompanyLedger(selectedCompanyId, {
            search: searchQuery,
            voucher_type: voucherFilter,
            approval_status: statusFilter,
            from_date: fromDate,
            to_date: toDate,
          }),
        ]);
        setSummary(sumRes);
        setTransactions(txnsRes);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Action Handlers
  const handleApprove = async () => {
    if (!selectedTxnId) return;
    try {
      setActionInProgress(true);
      setActionErrorMessage(null);
      const res = await approveLedgerTransaction(selectedTxnId, {
        manager_id: 'MGR-001',
        manager_name: 'Vikram Aditya (Finance Manager)',
        remarks: managerRemarks || 'Verified 3-way match against contract terms and GRN. Approved for ledger posting.',
      });
      setActionSuccessMessage(res.message);
      await refreshCurrentTxn(selectedTxnId);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Approval action failed');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleReject = async () => {
    if (!selectedTxnId) return;
    if (!rejectionReason.trim()) {
      setActionErrorMessage('Rejection requires a documented reason');
      return;
    }
    try {
      setActionInProgress(true);
      setActionErrorMessage(null);
      const res = await rejectLedgerTransaction(selectedTxnId, {
        manager_id: 'MGR-001',
        manager_name: 'Vikram Aditya (Finance Manager)',
        rejection_reason: rejectionReason,
      });
      setActionSuccessMessage(res.message);
      await refreshCurrentTxn(selectedTxnId);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Rejection action failed');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!selectedTxnId) return;
    if (!changeRemarks.trim()) {
      setActionErrorMessage('Please provide remarks explaining what needs correction');
      return;
    }
    try {
      setActionInProgress(true);
      setActionErrorMessage(null);
      const res = await requestChangesLedgerTransaction(selectedTxnId, {
        manager_id: 'MGR-001',
        manager_name: 'Vikram Aditya (Finance Manager)',
        remarks: changeRemarks,
      });
      setActionSuccessMessage(res.message);
      await refreshCurrentTxn(selectedTxnId);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Request changes failed');
    } finally {
      setActionInProgress(false);
    }
  };

  const handleResubmit = async () => {
    if (!selectedTxnId) return;
    if (!resubmitCorrectionNotes.trim()) {
      setActionErrorMessage('Please specify the correction notes for resubmission');
      return;
    }
    try {
      setActionInProgress(true);
      setActionErrorMessage(null);
      const res = await resubmitLedgerTransaction(selectedTxnId, {
        accountant_id: 'ACCT-104',
        accountant_name: 'Priya Sharma (Senior Accountant)',
        resubmission_notes: resubmitCorrectionNotes,
      });
      setActionSuccessMessage(res.message);
      await refreshCurrentTxn(selectedTxnId);
    } catch (err: any) {
      setActionErrorMessage(err.message || 'Resubmission failed');
    } finally {
      setActionInProgress(false);
    }
  };

  const currentCompany = useMemo(() => {
    return companies.find((c) => c.id === selectedCompanyId);
  }, [companies, selectedCompanyId]);

  const filteredTransactions = useMemo(() => {
    if (riskFilter === 'ALL') return transactions;
    return transactions.filter((t) => t.finvora_risk_tier === riskFilter);
  }, [transactions, riskFilter]);

  // Balance sums for modal
  const linesBalance = useMemo(() => {
    if (!txnDetail || !txnDetail.lines) return { dr: 0, cr: 0, balanced: true };
    const dr = txnDetail.lines.filter((l) => l.entry_type === 'DEBIT').reduce((acc, l) => acc + Number(l.amount), 0);
    const cr = txnDetail.lines.filter((l) => l.entry_type === 'CREDIT').reduce((acc, l) => acc + Number(l.amount), 0);
    const balanced = Math.abs(dr - cr) < 0.01 && dr > 0;
    return { dr, cr, balanced };
  }, [txnDetail]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner / Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-100 dark:border-blue-900/60">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Company Ledger & Manager Approval
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Multi-entity general ledger, 3-way reconciliation audit trail, and authoritative managerial signing workflow.
              </p>
            </div>
          </div>
        </div>

        {/* Company Selector & Seed Button */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-1.5">
            <Building2 className="w-4 h-4 text-slate-500 shrink-0" />
            <select
              aria-label="Select Target Company"
              className="bg-transparent text-sm font-semibold text-slate-800 dark:text-slate-200 outline-none cursor-pointer pr-2"
              value={selectedCompanyId || ''}
              onChange={(e) => setSelectedCompanyId(Number(e.target.value))}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="dark:bg-slate-900 text-slate-900 dark:text-slate-100">
                  {c.name} ({c.company_code})
                </option>
              ))}
            </select>
          </div>

          {currentCompany && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg">
                {currentCompany.financial_year}
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                {currentCompany.currency}
              </span>
            </div>
          )}

          <button
            onClick={handleSeedDemo}
            disabled={seedLoading}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl border border-slate-300 dark:border-slate-700 transition"
            title="Reload initial 5 standard test transactions with balanced double-entries"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${seedLoading ? 'animate-spin text-blue-500' : ''}`} />
            {seedLoading ? 'Resetting...' : 'Reset Demo Data'}
          </button>
        </div>
      </div>

      {/* Global Alerts */}
      {actionSuccessMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-800 dark:text-emerald-300 text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{actionSuccessMessage}</span>
        </div>
      )}
      {actionErrorMessage && (
        <div className="flex items-center gap-3 p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-800 dark:text-rose-300 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{actionErrorMessage}</span>
        </div>
      )}

      {/* KPI Balances & Summary Section */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Opening Balance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Opening Balance</span>
              <Scale className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {formatINR(summary.opening_balance)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Commencement FY {summary.financial_year}
            </div>
          </div>

          {/* Card 2: Total Debit vs Credit */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Posted Activity (Dr / Cr)</span>
              <div className="flex gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5 text-rose-500" />
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
              </div>
            </div>
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-xs text-rose-600 dark:text-rose-400 font-medium">Dr: </span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatINR(summary.total_debit)}</span>
              </div>
              <div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Cr: </span>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatINR(summary.total_credit)}</span>
              </div>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Posted Vouchers: <span className="font-semibold text-slate-700 dark:text-slate-300">{summary.posted_transactions}</span>
            </div>
          </div>

          {/* Card 3: Closing Balance */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Current / Closing Balance</span>
              <TrendingUp className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {formatINR(summary.closing_balance)}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active ledger currency: <span className="font-semibold">{summary.currency}</span>
            </div>
          </div>

          {/* Card 4: Governance & Workflow Metrics */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-medium uppercase tracking-wider">Approval Workflow</span>
              <FileCheck className="w-4 h-4 text-slate-400" />
            </div>
            <div className="grid grid-cols-4 gap-1 text-center mt-1">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/40">
                <div className="text-sm font-bold text-amber-700 dark:text-amber-400">{summary.pending_approvals}</div>
                <div className="text-[10px] text-amber-800 dark:text-amber-300 font-medium">Pending</div>
              </div>
              <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/40">
                <div className="text-sm font-bold text-orange-700 dark:text-orange-400">{summary.changes_requested_transactions}</div>
                <div className="text-[10px] text-orange-800 dark:text-orange-300 font-medium">Changes</div>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40">
                <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{summary.approved_transactions}</div>
                <div className="text-[10px] text-emerald-800 dark:text-emerald-300 font-medium">Approved</div>
              </div>
              <div className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40">
                <div className="text-sm font-bold text-rose-700 dark:text-rose-400">{summary.rejected_transactions}</div>
                <div className="text-[10px] text-rose-800 dark:text-rose-300 font-medium">Rejected</div>
              </div>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 text-center mt-2">
              Total Transactions: <span className="font-semibold">{summary.total_transactions}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search box */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by transaction number, reference, entity, account..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilters()}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Select dropdowns */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Voucher Type Filter */}
            <select
              aria-label="Filter by Voucher Type"
              value={voucherFilter}
              onChange={(e) => setVoucherFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Voucher Types</option>
              <option value="PURCHASE_INVOICE">Purchase Invoice</option>
              <option value="SALES_INVOICE">Sales Invoice</option>
              <option value="PAYMENT_VOUCHER">Payment Voucher</option>
              <option value="RECEIPT_VOUCHER">Receipt Voucher</option>
              <option value="JOURNAL_VOUCHER">Journal Voucher</option>
            </select>

            {/* Status Filter */}
            <select
              aria-label="Filter by Approval Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Statuses</option>
              <option value="SUBMITTED">Submitted</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="CHANGES_REQUESTED">Changes Requested</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>

            {/* Risk Filter */}
            <select
              aria-label="Filter by FINVORA Risk Tier"
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 font-medium"
            >
              <option value="ALL">All Risk Tiers</option>
              <option value="LOW_RISK">Low Risk</option>
              <option value="MEDIUM_RISK">Medium Risk</option>
              <option value="HIGH_RISK">High Risk</option>
            </select>

            {/* Date Pickers */}
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
              <span className="text-[11px] text-slate-400">From:</span>
              <input
                aria-label="Filter From Date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 outline-none"
              />
            </div>
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2 py-1">
              <span className="text-[11px] text-slate-400">To:</span>
              <input
                aria-label="Filter To Date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="bg-transparent text-xs text-slate-700 dark:text-slate-300 outline-none"
              />
            </div>

            {/* Action Buttons */}
            <button
              onClick={handleApplyFilters}
              className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Filter
            </button>
            <button
              onClick={handleClearFilters}
              className="px-3 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Main Ledger Transactions Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              General Ledger Journal Transactions
            </h2>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
              {filteredTransactions.length} records
            </span>
          </div>
          <span className="text-xs text-slate-400">
            Click any transaction to inspect 360° journey, 3-way match, and sign off
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/75 dark:bg-slate-800/40 text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                <th className="py-3 px-4">Txn ID / Ref</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Voucher / Invoice</th>
                <th className="py-3 px-4">Customer / Vendor</th>
                <th className="py-3 px-4">Ledger Account</th>
                <th className="py-3 px-4 text-right">Debit</th>
                <th className="py-3 px-4 text-right">Credit</th>
                <th className="py-3 px-4 text-right">Running Balance</th>
                <th className="py-3 px-4 text-center">FINVORA Risk</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {tableLoading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Loading company ledger records...
                  </td>
                </tr>
              ) : filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    No transactions match the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition cursor-pointer"
                    onClick={() => handleOpenTransaction(t.id)}
                  >
                    <td className="py-3 px-4 font-mono font-semibold text-slate-900 dark:text-slate-100">
                      {t.transaction_number}
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {new Date(t.transaction_date).toLocaleDateString('en-GB')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100">{t.voucher_type.replace('_', ' ')}</div>
                      {t.reference_no && (
                        <div className="text-[11px] font-mono text-slate-400">{t.reference_no}</div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{t.entity_name}</div>
                      {t.entity_code && <div className="text-[10px] text-slate-400 font-mono">{t.entity_code}</div>}
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">{t.ledger_account_name}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {t.debit_amount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{formatINR(t.debit_amount)}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-slate-900 dark:text-slate-100">
                      {t.credit_amount > 0 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{formatINR(t.credit_amount)}</span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {t.posting_status === 'POSTED' ? (
                        formatINR(t.running_balance)
                      ) : (
                        <span className="text-slate-400 italic text-[11px]">Unposted</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          t.finvora_risk_tier === 'LOW_RISK'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
                            : t.finvora_risk_tier === 'MEDIUM_RISK'
                            ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                            : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
                        }`}
                      >
                        {t.finvora_risk_tier === 'LOW_RISK' && <CheckCircle2 className="w-2.5 h-2.5" />}
                        {t.finvora_risk_tier === 'MEDIUM_RISK' && <AlertTriangle className="w-2.5 h-2.5" />}
                        {t.finvora_risk_tier === 'HIGH_RISK' && <ShieldAlert className="w-2.5 h-2.5" />}
                        {t.finvora_risk_tier.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                          t.approval_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800'
                            : t.approval_status === 'REJECTED'
                            ? 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800'
                            : t.approval_status === 'CHANGES_REQUESTED'
                            ? 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800'
                            : 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        }`}
                      >
                        {t.approval_status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleOpenTransaction(t.id)}
                        className="px-2.5 py-1 text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-blue-600 dark:text-blue-400 rounded-lg transition"
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 360-DEGREE TRANSACTION DETAILS MODAL */}
      {selectedTxnId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col my-auto">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Transaction {txnDetail?.transaction_number || '...'}
                    </h3>
                    {txnDetail && (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold border ${
                          txnDetail.finvora_risk_tier === 'LOW_RISK'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : txnDetail.finvora_risk_tier === 'MEDIUM_RISK'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {txnDetail.finvora_risk_tier.replace('_', ' ')}
                      </span>
                    )}
                    {txnDetail?.posting_status === 'POSTED' && (
                      <span className="text-xs px-2 py-0.5 bg-emerald-500 text-white rounded font-semibold">
                        POSTED TO LEDGER
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Entity: <span className="font-semibold text-slate-700 dark:text-slate-300">{txnDetail?.entity_name}</span> | Voucher: <span className="font-semibold">{txnDetail?.voucher_type}</span> | Ref: {txnDetail?.reference_no}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedTxnId(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Lifecycle Stepper */}
            {txnDetail && (
              <div className="px-6 py-3 bg-slate-100/70 dark:bg-slate-800/30 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
                  <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">1</span>
                    Created
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">2</span>
                    Submitted
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className="flex items-center gap-1.5 text-blue-600 font-bold">
                    <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px]">3</span>
                    Auto Validated
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className="flex items-center gap-1.5 text-indigo-600 font-bold">
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[9px]">4</span>
                    FINVORA AI Risked
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className={`flex items-center gap-1.5 ${txnDetail.approval_status === 'APPROVED' ? 'text-emerald-600 font-bold' : txnDetail.approval_status === 'REJECTED' ? 'text-rose-600 font-bold' : txnDetail.approval_status === 'CHANGES_REQUESTED' ? 'text-orange-600 font-bold' : 'text-amber-600 font-bold'}`}>
                    <span className="w-4 h-4 rounded-full bg-slate-600 text-white flex items-center justify-center text-[9px]">5</span>
                    Manager Review ({txnDetail.approval_status.replace('_', ' ')})
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
                  <div className={`flex items-center gap-1.5 ${txnDetail.posting_status === 'POSTED' ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
                    <span className={`w-4 h-4 rounded-full ${txnDetail.posting_status === 'POSTED' ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-600'} flex items-center justify-center text-[9px]`}>6</span>
                    Ledger Post
                  </div>
                </div>
              </div>
            )}

            {/* Modal Tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 px-6 gap-6 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('journey')}
                className={`py-3 border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'journey'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <FileText className="w-4 h-4" /> 360° Journey & 3-Way Match
              </button>
              <button
                onClick={() => setActiveTab('lines')}
                className={`py-3 border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'lines'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <Scale className="w-4 h-4" /> Double-Entry Lines ({txnDetail?.lines.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('finvora')}
                className={`py-3 border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'finvora'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <ShieldCheck className="w-4 h-4" /> FINVORA Intelligence Analysis
              </button>
              <button
                onClick={() => setActiveTab('actions')}
                className={`py-3 border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'actions'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <CheckCircle2 className="w-4 h-4" /> Manager Actions
              </button>
              <button
                onClick={() => setActiveTab('audit')}
                className={`py-3 border-b-2 flex items-center gap-1.5 ${
                  activeTab === 'audit'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <History className="w-4 h-4" /> Audit Log ({txnDetail?.audit_logs.length || 0})
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {detailLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
                  Loading comprehensive transaction journey...
                </div>
              ) : !txnDetail ? (
                <div className="py-12 text-center text-rose-500">
                  Failed to load transaction details.
                </div>
              ) : (
                <>
                  {/* TAB 1: 360° JOURNEY & 3-WAY MATCH */}
                  {activeTab === 'journey' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Vendor/Customer Details */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-blue-500" /> Entity Profile ({txnDetail.entity_type})
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Legal Name:</span>
                              <span className="font-semibold text-slate-800 dark:text-slate-200">{txnDetail.entity_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Entity Code:</span>
                              <span className="font-mono text-slate-700 dark:text-slate-300">{txnDetail.entity_code || 'VEND-STANDARD'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Ledger Account:</span>
                              <span className="font-semibold text-slate-700 dark:text-slate-300">{txnDetail.ledger_account_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Payment Terms:</span>
                              <span className="text-slate-700 dark:text-slate-300">{txnDetail.payment_terms || 'Net 30 Days'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Invoice Metadata */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-indigo-500" /> Invoice Metadata
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between">
                              <span className="text-slate-400">Invoice Number:</span>
                              <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">{txnDetail.invoice_number || txnDetail.reference_no}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Invoice Date:</span>
                              <span className="text-slate-700 dark:text-slate-300">{txnDetail.transaction_date}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Total Billed Value:</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">{formatINR(txnDetail.invoice_amount || txnDetail.total_amount)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-400">Narration / Description:</span>
                              <span className="text-slate-700 dark:text-slate-300 italic">{txnDetail.description}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 3-Way Match Block: PO & GRN */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Purchase Order */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <FileCheck className="w-3.5 h-3.5 text-emerald-500" /> Purchase Order (PO) Match
                            </h4>
                            {txnDetail.po_number ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold border border-emerald-200">
                                LINKED
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                                NO PO LINKED
                              </span>
                            )}
                          </div>
                          {txnDetail.po_number ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">PO Number:</span>
                                <span className="font-mono font-medium">{txnDetail.po_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">PO Authorised Value:</span>
                                <span className="font-semibold">{formatINR(txnDetail.po_amount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Variance vs Invoice:</span>
                                <span className={Math.abs((txnDetail.invoice_amount || txnDetail.total_amount) - (txnDetail.po_amount || 0)) > 10 ? 'text-rose-600 font-semibold' : 'text-emerald-600 font-semibold'}>
                                  {formatINR((txnDetail.invoice_amount || txnDetail.total_amount) - (txnDetail.po_amount || 0))}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">No purchase order reference attached to this voucher.</p>
                          )}
                        </div>

                        {/* Goods Receipt Note */}
                        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" /> Goods Receipt Note (GRN)
                            </h4>
                            {txnDetail.grn_number ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold border border-blue-200">
                                VERIFIED
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold border border-amber-200">
                                NO GRN LINKED
                              </span>
                            )}
                          </div>
                          {txnDetail.grn_number ? (
                            <div className="space-y-1 text-xs">
                              <div className="flex justify-between">
                                <span className="text-slate-400">GRN Number:</span>
                                <span className="font-mono font-medium">{txnDetail.grn_number}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Physical Goods Value:</span>
                                <span className="font-semibold">{formatINR(txnDetail.grn_amount)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-slate-400">Inspection Status:</span>
                                <span className="text-emerald-600 font-semibold">Accepted in Good Condition</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Goods/Service physical receipt note has not been attached.</p>
                          )}
                        </div>
                      </div>

                      {/* Supporting Documents */}
                      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                          Supporting Electronic Documents
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {txnDetail.supporting_documents && txnDetail.supporting_documents.length > 0 ? (
                            txnDetail.supporting_documents.map((doc, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-300"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-500" />
                                <span>{doc.filename || doc.name || `Document-${idx + 1}.pdf`}</span>
                                <span className="text-[10px] text-slate-400 uppercase">({doc.type || doc.doc_type || 'PDF'})</span>
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-slate-400">No supporting scanned invoices or PDFs attached.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: DOUBLE-ENTRY JOURNAL LINES */}
                  {activeTab === 'lines' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2">
                          <Scale className="w-4 h-4 text-blue-500" />
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                            Strict Double-Entry Balancing Verification:
                          </span>
                        </div>
                        {linesBalance.balanced ? (
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> BALANCED (&Sigma; Debit == &Sigma; Credit)
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> UNBALANCED IMBALANCE
                          </span>
                        )}
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                              <th className="py-2.5 px-3">Account Name</th>
                              <th className="py-2.5 px-3">Entry Type</th>
                              <th className="py-2.5 px-3 text-right">Debit (₹)</th>
                              <th className="py-2.5 px-3 text-right">Credit (₹)</th>
                              <th className="py-2.5 px-3">Line Narration</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {txnDetail.lines.map((line, idx) => (
                              <tr key={line.id || idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">{line.account_name}</td>
                                <td className="py-2.5 px-3 text-[11px] font-bold">
                                  <span className={line.entry_type === 'DEBIT' ? 'text-rose-600' : 'text-emerald-600'}>
                                    {line.entry_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-600 dark:text-rose-400">
                                  {line.entry_type === 'DEBIT' ? formatINR(line.amount) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  {line.entry_type === 'CREDIT' ? formatINR(line.amount) : '-'}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 italic">{line.narration || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-slate-100/80 dark:bg-slate-800/80 font-bold border-t border-slate-300 dark:border-slate-700">
                              <td colSpan={2} className="py-2.5 px-3 text-right">Total:</td>
                              <td className="py-2.5 px-3 text-right font-mono text-rose-600 dark:text-rose-400">
                                {formatINR(linesBalance.dr)}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                                {formatINR(linesBalance.cr)}
                              </td>
                              <td className="py-2.5 px-3"></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* TAB 3: FINVORA INTELLIGENCE */}
                  {activeTab === 'finvora' && (
                    <div className="space-y-4">
                      {/* Risk Score & Recommendation Card */}
                      <div
                        className={`p-4 rounded-xl border ${
                          txnDetail.finvora_risk_tier === 'LOW_RISK'
                            ? 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800'
                            : txnDetail.finvora_risk_tier === 'MEDIUM_RISK'
                            ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800'
                            : 'bg-rose-50/70 border-rose-200 dark:bg-rose-950/30 dark:border-rose-800'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <ShieldAlert className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                            <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                              FINVORA Advisory Risk Assessment: {txnDetail.finvora_risk_tier.replace('_', ' ')}
                            </h4>
                          </div>
                          <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                            Risk Score: {txnDetail.finvora_risk_score} / 100
                          </span>
                        </div>
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {txnDetail.finvora_recommendation || 'Standard audit completed'}
                        </p>
                      </div>

                      {/* Findings / Risk Reasons List */}
                      <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300">
                          Deterministic Intelligence Checks ({txnDetail.finvora_risk_reasons.length})
                        </div>
                        <div className="divide-y divide-slate-200 dark:divide-slate-800">
                          {txnDetail.finvora_risk_reasons.map((reason, i) => (
                            <div key={i} className="p-3 text-xs flex items-start gap-3">
                              {txnDetail.finvora_risk_tier === 'HIGH_RISK' ? (
                                <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                              ) : txnDetail.finvora_risk_tier === 'MEDIUM_RISK' ? (
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                              )}
                              <div className="text-slate-700 dark:text-slate-300 font-medium">
                                {reason}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-[11px] text-blue-800 dark:text-blue-300">
                        <strong>Architectural Guarantee:</strong> FINVORA risk scores are strictly advisory indicators computed via deterministic business equations. No generative model performs financial balance mutations or independently signs accounting vouchers.
                      </div>
                    </div>
                  )}

                  {/* TAB 4: MANAGER ACTIONS WORKFLOW */}
                  {activeTab === 'actions' && (
                    <div className="space-y-6">
                      {txnDetail.posting_status === 'POSTED' ? (
                        <div className="p-6 text-center rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-600 dark:text-emerald-400" />
                          <h4 className="text-sm font-bold">Transaction Already Approved & Posted</h4>
                          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                            Approved by {txnDetail.approved_by || 'Manager'} on{' '}
                            {txnDetail.approved_at ? new Date(txnDetail.approved_at).toLocaleString() : 'N/A'}.
                          </p>
                          <p className="text-[11px] text-emerald-600 dark:text-emerald-500 mt-2 font-mono">
                            Remarks: {txnDetail.manager_remarks || 'None'}
                          </p>
                        </div>
                      ) : txnDetail.approval_status === 'REJECTED' ? (
                        <div className="p-6 text-center rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300">
                          <XCircle className="w-8 h-8 mx-auto mb-2 text-rose-600 dark:text-rose-400" />
                          <h4 className="text-sm font-bold">Transaction Rejected by Management</h4>
                          <p className="text-xs text-rose-700 dark:text-rose-400 mt-1">
                            Rejected by {txnDetail.rejected_by || 'Manager'} on{' '}
                            {txnDetail.rejected_at ? new Date(txnDetail.rejected_at).toLocaleString() : 'N/A'}.
                          </p>
                          <p className="text-xs font-semibold text-rose-900 dark:text-rose-200 mt-2">
                            Reason: {txnDetail.rejection_reason}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {/* ACTION 1: APPROVE */}
                          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-950/20 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-sm">
                                <CheckCircle2 className="w-4 h-4" />
                                Approve & Post
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Verify double-entry equations, log signature, and post journal lines directly to company books.
                              </p>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Manager Remarks (Optional):</label>
                                <input
                                  type="text"
                                  placeholder="e.g. Verified against PO rate, cleared for posting"
                                  value={managerRemarks}
                                  onChange={(e) => setManagerRemarks(e.target.value)}
                                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                                />
                              </div>
                            </div>
                            <button
                              onClick={handleApprove}
                              disabled={actionInProgress}
                              className="mt-4 w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                              {actionInProgress ? 'Posting...' : 'Approve & Post'}
                            </button>
                          </div>

                          {/* ACTION 2: REJECT */}
                          <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50/30 dark:bg-rose-950/20 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300 font-bold text-sm">
                                <XCircle className="w-4 h-4" />
                                Reject Voucher
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Refuse approval. Mandatory audit justification required; record is preserved for compliance.
                              </p>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                                  Rejection Reason <span className="text-rose-500">*</span>:
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Document reason for rejection (mandatory)..."
                                  value={rejectionReason}
                                  onChange={(e) => setRejectionReason(e.target.value)}
                                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-900"
                                />
                              </div>
                            </div>
                            <button
                              onClick={handleReject}
                              disabled={actionInProgress}
                              className="mt-4 w-full py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              {actionInProgress ? 'Processing...' : 'Reject Transaction'}
                            </button>
                          </div>

                          {/* ACTION 3: REQUEST CHANGES */}
                          <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/20 flex flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 font-bold text-sm">
                                <RotateCcw className="w-4 h-4" />
                                Request Changes
                              </div>
                              <p className="text-xs text-slate-600 dark:text-slate-400">
                                Route voucher back to Senior Accountant with clear instructions on corrections required.
                              </p>
                              <div className="space-y-1">
                                <label className="text-[11px] font-medium text-amber-700 dark:text-amber-300">
                                  Explanation for Correction <span className="text-amber-500">*</span>:
                                </label>
                                <textarea
                                  rows={2}
                                  placeholder="Specify what needs correction (tax code, missing GRN, etc.)..."
                                  value={changeRemarks}
                                  onChange={(e) => setChangeRemarks(e.target.value)}
                                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-900"
                                />
                              </div>
                            </div>
                            <button
                              onClick={handleRequestChanges}
                              disabled={actionInProgress}
                              className="mt-4 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5"
                            >
                              <RotateCcw className="w-4 h-4" />
                              {actionInProgress ? 'Sending...' : 'Request Changes'}
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ACCOUNTANT RESUBMISSION WORKFLOW (Active when CHANGES_REQUESTED) */}
                      {txnDetail.approval_status === 'CHANGES_REQUESTED' && (
                        <div className="p-5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                            <Send className="w-4 h-4" /> Accountant Correction & Resubmission Terminal
                          </h4>
                          <p className="text-xs text-slate-600 dark:text-slate-400 mb-3">
                            The manager requested modifications. Provide documented clarification or corrected amounts, then resubmit to the review queue.
                          </p>
                          <div className="space-y-2">
                            <label className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                              Accountant Correction Notes:
                            </label>
                            <textarea
                              rows={2}
                              placeholder="e.g. Attached verified GRN note, recomputed TDS section, ready for re-review"
                              value={resubmitCorrectionNotes}
                              onChange={(e) => setResubmitCorrectionNotes(e.target.value)}
                              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                            />
                            <button
                              onClick={handleResubmit}
                              disabled={actionInProgress}
                              className="py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2"
                            >
                              <Send className="w-3.5 h-3.5" />
                              Resubmit to Manager Queue
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 5: AUDIT LOG & DECISION TRAIL */}
                  {activeTab === 'audit' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600 dark:text-slate-400 mb-2">
                        Immutable Cryptographic Audit Trail
                      </div>
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
                        {txnDetail.audit_logs.map((log, idx) => (
                          <div key={log.id || idx} className="relative">
                            <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-900" />
                            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-slate-800 dark:text-slate-200">
                                  {log.action.replace('_', ' ')}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">
                                  {log.created_at ? new Date(log.created_at).toLocaleString() : 'Just now'}
                                </span>
                              </div>
                              <p className="text-slate-600 dark:text-slate-400">{log.action_summary || log.summary}</p>
                              <div className="text-[10px] text-slate-400 mt-1">
                                Role: <span className="font-semibold text-slate-600 dark:text-slate-300">{log.performed_by_role || 'SYSTEM'}</span> ({log.performed_by_user || 'system'})
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyLedgerPage;
