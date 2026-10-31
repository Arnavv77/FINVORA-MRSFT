import React, { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Upload,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  ShieldCheck,
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { formatINR, formatDate, exportToCSV } from '../utils/formatters';
import type { Transaction } from '../types';

export const FinancialDataPage: React.FC = () => {
  const {
    sources,
    qualityIssues,
    transactions,
    refreshSource,
    importTransactions
  } = useFinancial();

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Selected Transaction for Details Drawer
  const [selectedTxn, setSelectedTxn] = useState<Transaction | null>(null);

  // CSV Import Modal State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Transaction[]>([]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesSearch =
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.vendorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.referenceNo.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesSource = selectedSource === 'all' || t.source.toLowerCase().includes(selectedSource.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || t.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
      const matchesType = selectedType === 'all' || t.type === selectedType;

      return matchesSearch && matchesSource && matchesCategory && matchesStatus && matchesType;
    });
  }, [transactions, searchQuery, selectedSource, selectedCategory, selectedStatus, selectedType]);

  // Handle mock CSV upload
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImportedFile(file);

      // Generate preview demo data based on imported file name
      const mockParsed: Transaction[] = [
        {
          id: `IMP-${Date.now()}-1`,
          date: '2024-09-24',
          referenceNo: 'CSV-IMPORT-8901',
          description: 'Q3 Enterprise CDN Bandwidth - Fastly Edge',
          vendorName: 'Fastly Global CDN',
          category: 'Software & Cloud',
          department: 'Engineering',
          amount: 240000,
          type: 'outflow',
          status: 'cleared',
          source: 'HDFC Corporate Current A/C'
        },
        {
          id: `IMP-${Date.now()}-2`,
          date: '2024-09-23',
          referenceNo: 'CSV-IMPORT-8902',
          description: 'Client Project Advance - L&T Technology',
          vendorName: 'Larsen & Toubro Tech',
          category: 'Customer Revenue',
          department: 'Sales & Operations',
          amount: 3200000,
          type: 'inflow',
          status: 'cleared',
          source: 'ICICI Treasury & Forex A/C'
        },
        {
          id: `IMP-${Date.now()}-3`,
          date: '2024-09-21',
          referenceNo: 'CSV-IMPORT-8903',
          description: 'Recruitment Agency Success Fee - Engineering Lead',
          vendorName: 'Michael Page India',
          category: 'Office & Facilities',
          department: 'HR & Admin',
          amount: 380000,
          type: 'outflow',
          status: 'pending',
          source: 'RazorpayX Vendor Payouts'
        }
      ];

      setParsedRows(mockParsed);
      setImportStep(2);
    }
  };

  const handleCommitImport = () => {
    importTransactions(parsedRows);
    setIsImportModalOpen(false);
    setImportStep(1);
    setImportedFile(null);
  };

  const handleExportCSV = () => {
    const exportData = filteredTransactions.map(t => ({
      Reference: t.referenceNo,
      Date: t.date,
      Vendor: t.vendorName,
      Description: t.description,
      Category: t.category,
      Department: t.department,
      Amount: t.amount,
      Type: t.type,
      Status: t.status,
      Source: t.source
    }));
    exportToCSV(exportData, 'FINVORA_Transactions');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner: Connected Sources */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Data Pipeline & Ledger Ingestion
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              Real-time synchronization across banking APIs, ERP, and payment rails
            </p>
          </div>
          <button
            onClick={() => sources.forEach(s => refreshSource(s.id))}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:border-[var(--accent-border)] text-xs font-semibold text-[var(--text-primary)] transition-colors shadow-xs"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Sync All Sources</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {sources.map(src => (
            <div
              key={src.id}
              className="p-3.5 rounded-2xl glass-card flex flex-col justify-between space-y-2 border border-[var(--card-border)]"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-[var(--text-primary)] leading-tight truncate">
                  {src.name}
                </span>
                <StatusBadge status={src.status} size="sm" pulse={src.status === 'syncing'} />
              </div>

              <div className="text-[11px] text-[var(--text-secondary)] space-y-0.5">
                <div className="flex justify-between">
                  <span>Records:</span>
                  <span className="font-mono text-[var(--text-primary)] font-medium">{src.recordCount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Health:</span>
                  <span className={`font-mono font-semibold ${
                    src.healthScore >= 80 
                      ? 'text-emerald-600 dark:text-emerald-400' 
                      : src.healthScore >= 70 
                        ? 'text-amber-500 dark:text-amber-400' 
                        : 'text-rose-500 dark:text-rose-400'
                  }`}>{src.healthScore}%</span>
                </div>
                <div className="text-[10px] text-[var(--text-muted)] pt-1">
                  Synced: {src.lastSyncTime}
                </div>
              </div>

              <button
                onClick={() => refreshSource(src.id)}
                className="w-full mt-1 py-1 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center justify-center gap-1 border border-[var(--divider)]"
              >
                <RefreshCw className="w-3 h-3 text-[var(--accent)]" /> Refresh
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Data Quality Summary Banner */}
      <div className="p-4 rounded-2xl glass-card border border-[var(--card-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[var(--accent)] shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
              Automated Data Quality & Hygiene Engine
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              3 integrity issues spotted across 8,690 synced enterprise records. 99.4% data reconciliation confidence.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {qualityIssues.map(issue => (
            <div
              key={issue.id}
              className="px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-xs flex items-center gap-2"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${issue.severity === 'high' ? 'bg-rose-500' : 'bg-amber-500'}`} />
              <span className="text-[var(--text-primary)] font-medium">{issue.title}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] font-mono font-semibold">
                {issue.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transactions Table & Filters Card */}
      <div className="p-5 sm:p-6 rounded-2xl glass-card space-y-4 border border-[var(--card-border)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
              Enterprise Transaction Ledger
            </h3>
            <p className="text-xs text-[var(--text-secondary)]">
              Showing {filteredTransactions.length} of {transactions.length} reconciled entries
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsImportModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-subtle)] border border-[var(--divider)] hover:border-[var(--accent-border)] text-[var(--text-primary)] transition-colors shadow-xs"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--accent)]" />
              <span>Import CSV</span>
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[#F59E0B] text-black hover:bg-[#D97706] transition-colors shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-2 border-t border-[var(--divider)]">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search reference, vendor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl pl-9 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>

          {/* Source Filter */}
          <div>
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="all">All Data Sources</option>
              <option value="HDFC">HDFC Bank</option>
              <option value="SAP">SAP S/4HANA</option>
              <option value="RazorpayX">RazorpayX</option>
              <option value="Zoho">Zoho Books</option>
              <option value="ICICI">ICICI Treasury</option>
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="all">All Expense Categories</option>
              <option value="Software & Cloud">Software & Cloud</option>
              <option value="Logistics & Supply">Logistics & Supply</option>
              <option value="Office & Facilities">Office & Facilities</option>
              <option value="Legal & Professional">Legal & Professional</option>
              <option value="Marketing & Media">Marketing & Media</option>
              <option value="Salaries & Benefits">Salaries & Benefits</option>
              <option value="Capital Equipment">Capital Equipment</option>
              <option value="Customer Revenue">Customer Revenue</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="cleared">Cleared</option>
              <option value="pending">Pending</option>
              <option value="flagged">Flagged Anomaly</option>
              <option value="held">On Hold</option>
            </select>
          </div>

          {/* Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--input-border)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)] cursor-pointer"
            >
              <option value="all">All Cash Flows</option>
              <option value="inflow">Inflows (Receipts)</option>
              <option value="outflow">Outflows (Disbursements)</option>
            </select>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto rounded-xl border border-[var(--divider)]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[var(--surface-muted)] border-b border-[var(--divider)] text-[var(--text-secondary)] uppercase font-semibold text-[11px] tracking-wider">
              <tr>
                <th className="py-3 px-4">Reference & Date</th>
                <th className="py-3 px-4">Vendor / Payee</th>
                <th className="py-3 px-4">Category & Department</th>
                <th className="py-3 px-4">Source Channel</th>
                <th className="py-3 px-4 text-right">Amount (INR)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--divider)]">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[var(--text-secondary)]">
                    No transactions match your current filter parameters.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map(txn => (
                  <tr
                    key={txn.id}
                    onClick={() => setSelectedTxn(txn)}
                    className="hover:bg-[var(--surface-subtle)] cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="font-mono font-medium text-[var(--text-primary)]">{txn.referenceNo}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{formatDate(txn.date)}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-[var(--text-primary)]">{txn.vendorName}</div>
                      <div className="text-[11px] text-[var(--text-secondary)] truncate max-w-xs">{txn.description}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="text-[var(--text-primary)] font-medium">{txn.category}</div>
                      <div className="text-[11px] text-[var(--text-secondary)]">{txn.department}</div>
                    </td>
                    <td className="py-3 px-4 text-[var(--text-secondary)] text-[11px]">
                      {txn.source}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span
                        className={`font-mono font-bold ${
                          txn.type === 'inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-primary)]'
                        }`}
                      >
                        {txn.type === 'inflow' ? '+' : '-'}{formatINR(txn.amount)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={txn.status} size="sm" pulse={txn.status === 'flagged'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTxn(txn);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-[11px] border border-[var(--divider)] transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Details Side Drawer */}
      <Drawer
        isOpen={Boolean(selectedTxn)}
        onClose={() => setSelectedTxn(null)}
        title={selectedTxn?.referenceNo || 'Transaction Details'}
        subtitle={selectedTxn ? `Reconciled from ${selectedTxn.source}` : ''}
        badge={selectedTxn && <StatusBadge status={selectedTxn.status} />}
        footer={
          <button
            onClick={() => setSelectedTxn(null)}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] text-[var(--text-primary)] border border-[var(--divider)] transition-colors"
          >
            Close Details
          </button>
        }
      >
        {selectedTxn && (
          <div className="space-y-6 text-xs">
            {/* Amount Banner */}
            <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] flex items-center justify-between">
              <div>
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold">Net Transaction Amount</span>
                <div className={`text-2xl font-bold font-mono ${selectedTxn.type === 'inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text-primary)]'}`}>
                  {selectedTxn.type === 'inflow' ? '+' : '-'}{formatINR(selectedTxn.amount)}
                </div>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold">Channel</span>
                <div className="text-xs text-[var(--text-primary)] font-medium">{selectedTxn.source}</div>
              </div>
            </div>

            {/* Anomaly Callout if flagged */}
            {selectedTxn.isAnomaly && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 dark:bg-rose-950/40 dark:border-rose-800/50 space-y-1.5">
                <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>Rule Engine Anomaly Triggered</span>
                </div>
                <p className="text-xs text-rose-700 dark:text-rose-200 leading-relaxed">
                  {selectedTxn.notes || 'Identified by predictive risk models for immediate audit.'}
                </p>
              </div>
            )}

            {/* Line items & metadata */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Metadata & Attribution
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Payee / Vendor</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{selectedTxn.vendorName}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Posting Date</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{formatDate(selectedTxn.date)}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Expense Category</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{selectedTxn.category}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                  <span className="text-[10px] text-[var(--text-muted)] block mb-0.5">Department Ledger</span>
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{selectedTxn.department}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1">
              <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">Ledger Memo / Description</span>
              <p className="text-xs text-[var(--text-primary)] leading-relaxed">{selectedTxn.description}</p>
            </div>
          </div>
        )}
      </Drawer>

      {/* CSV Import Modal Wizard */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Import Financial Data via CSV"
        subtitle="Unify bank statements, expense logs, or ERP transaction dumps"
        maxWidth="max-w-2xl"
        footer={
          importStep === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setImportStep(1)}
                className="px-4 py-2 text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCommitImport}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-[#F59E0B] text-black hover:bg-[#D97706] transition-colors"
              >
                Confirm & Reconcile ({parsedRows.length} Rows)
              </button>
            </>
          ) : null
        }
      >
        {importStep === 1 && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-[var(--input-border)] rounded-2xl p-8 text-center hover:border-[var(--accent)] transition-colors bg-[var(--surface-subtle)]">
              <FileSpreadsheet className="w-10 h-10 text-[var(--accent)] mx-auto mb-3" />
              <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                Select bank statement or GL transaction CSV
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-sm mx-auto">
                Supports HDFC, ICICI, SAP GL Exports, RazorpayX payouts, and standard accounting CSV formats.
              </p>
              <div className="mt-4">
                <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-bold hover:bg-[#D97706] transition-colors shadow-xs">
                  <Upload className="w-4 h-4" />
                  <span>Choose CSV File</span>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-[11px] text-[var(--text-secondary)]">
              <span className="text-[var(--text-primary)] font-medium">Quick Demo Tip:</span> Upload any local CSV file or click the button above to load sample enterprise records into the live ledger.
            </div>
          </div>
        )}

        {importStep === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs pb-2 border-b border-[var(--divider)]">
              <span className="text-[var(--text-secondary)]">File: <strong className="text-[var(--text-primary)]">{importedFile?.name || 'statement.csv'}</strong></span>
              <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 65% Column Mapping Validated
              </span>
            </div>

            <div className="text-xs font-semibold text-[var(--text-primary)]">Preview Parsed Rows (Ready for Ingestion):</div>

            <div className="overflow-x-auto max-h-56 rounded-xl border border-[var(--divider)]">
              <table className="w-full text-left text-xs">
                <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)] text-[10px] uppercase font-semibold">
                  <tr>
                    <th className="p-2">Date</th>
                    <th className="p-2">Reference</th>
                    <th className="p-2">Vendor</th>
                    <th className="p-2">Category</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--divider)]">
                  {parsedRows.map((r, idx) => (
                    <tr key={idx} className="hover:bg-[var(--surface-subtle)]">
                      <td className="p-2 text-[var(--text-secondary)]">{r.date}</td>
                      <td className="p-2 font-mono text-[var(--text-primary)]">{r.referenceNo}</td>
                      <td className="p-2 text-[var(--text-primary)]">{r.vendorName}</td>
                      <td className="p-2 text-[var(--text-secondary)]">{r.category}</td>
                      <td className="p-2 text-right font-mono font-semibold text-[var(--text-primary)]">{formatINR(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)]">
              Clicking confirm will append these transactions directly to the reactive ledger and update financial forecasts in real-time.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};
