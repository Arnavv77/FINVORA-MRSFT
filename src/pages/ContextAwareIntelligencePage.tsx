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
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { formatINR } from '../utils/formatters';
import {
  fetchCAFIEOverview,
  fetchCAFIEVendors,
  fetchCAFIEInventoryToCash,
  fetchCAFIEReconciliations,
  fetchCAFIEReconciliationDetail,
  fetchCAFIEMemory,
  fetchCAFIEAuditTrail,
  runCAFIELaptopsDemo,
  takeCAFIEAction,
  uploadCAFIEDocument,
  CAFIEOverviewResponse,
  CAFIEVendor,
  CAFIEInventoryToCashResponse,
  CAFIEReconciliationItem,
  CAFIEReconciliationDetailResponse,
  CAFIEMemoryEvent,
  CAFIEAuditLogItem,
} from '../lib/api';

type TabKey =
  | 'overview'
  | 'vendors'
  | 'inventory'
  | 'cross_system'
  | 'memory'
  | 'investigation'
  | 'alerts'
  | 'audit';

export const ContextAwareIntelligencePage: React.FC = () => {
  const { role } = useFinancial();
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  // Loading & Error States
  const [loading, setLoading] = useState<boolean>(true);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [demoRunning, setDemoRunning] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Core Data
  const [overview, setOverview] = useState<CAFIEOverviewResponse | null>(null);
  const [vendors, setVendors] = useState<CAFIEVendor[]>([]);
  const [inventoryData, setInventoryData] = useState<CAFIEInventoryToCashResponse | null>(null);
  const [reconciliations, setReconciliations] = useState<CAFIEReconciliationItem[]>([]);
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [assessmentDetail, setAssessmentDetail] = useState<CAFIEReconciliationDetailResponse | null>(null);
  const [memoryEvents, setMemoryEvents] = useState<CAFIEMemoryEvent[]>([]);
  const [auditLogs, setAuditLogs] = useState<CAFIEAuditLogItem[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals
  const [showDemoModal, setShowDemoModal] = useState<boolean>(false);
  const [showActionModal, setShowActionModal] = useState<boolean>(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'hold_for_verification'>('hold_for_verification');
  const [managerRemarks, setManagerRemarks] = useState<string>('');
  const [actionTargetId, setActionTargetId] = useState<number | null>(null);

  // Document Upload State
  const [uploadingDoc, setUploadingDoc] = useState<boolean>(false);
  const [extractedDoc, setExtractedDoc] = useState<any | null>(null);

  const showToast = (type: 'success' | 'error' | 'info', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 5000);
  };

  // 1. Initial Data Fetch
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [ovData, vData, invData, recData, memData, audData] = await Promise.all([
        fetchCAFIEOverview().catch(() => null),
        fetchCAFIEVendors().catch(() => ({ vendors: [], total_count: 0 })),
        fetchCAFIEInventoryToCash().catch(() => null),
        fetchCAFIEReconciliations().catch(() => ({ reconciliations: [], count: 0 })),
        fetchCAFIEMemory().catch(() => ({ events: [], total_records: 0, cumulative_unresolved_exposure: 0 })),
        fetchCAFIEAuditTrail().catch(() => ({ audit_trail: [], total_records: 0 })),
      ]);

      if (ovData) setOverview(ovData);
      if (vData) setVendors(vData.vendors);
      if (invData) setInventoryData(invData);
      if (recData) {
        setReconciliations(recData.reconciliations);
        if (recData.reconciliations.length > 0 && !selectedAssessmentId) {
          setSelectedAssessmentId(recData.reconciliations[0].id);
        }
      }
      if (memData) setMemoryEvents(memData.events);
      if (audData) setAuditLogs(audData.audit_trail);
    } catch (err: any) {
      showToast('error', `Failed to load CAFIE financial intelligence: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // 2. Fetch Detailed Investigation when selected
  useEffect(() => {
    if (selectedAssessmentId) {
      fetchCAFIEReconciliationDetail(selectedAssessmentId)
        .then(setAssessmentDetail)
        .catch(err => console.error('Error fetching detail:', err));
    }
  }, [selectedAssessmentId]);

  // 3. Run Synthetic Laptop Scenario
  const handleRunLaptopsDemo = async () => {
    setDemoRunning(true);
    try {
      const res = await runCAFIELaptopsDemo();
      showToast('success', 'Enterprise 100-Laptop scenario seeded and evaluated live!');
      setShowDemoModal(true);
      await loadAllData();
      if (res.assessment_id) {
        setSelectedAssessmentId(res.assessment_id);
      }
    } catch (err: any) {
      showToast('error', `Demo run failed: ${err.message}`);
    } finally {
      setDemoRunning(false);
    }
  };

  // 4. Execute Human-in-the-Loop Action
  const handleExecuteAction = async () => {
    if (!actionTargetId || !managerRemarks.trim()) {
      showToast('error', 'Manager audit remarks are mandatory.');
      return;
    }
    setActionLoading(true);
    try {
      await takeCAFIEAction(actionTargetId, actionType, managerRemarks, `user_${role}`, role);
      showToast('success', `Transaction successfully updated to ${actionType.replace('_', ' ')}.`);
      setShowActionModal(false);
      setManagerRemarks('');
      await loadAllData();
      if (selectedAssessmentId) {
        const detail = await fetchCAFIEReconciliationDetail(selectedAssessmentId);
        setAssessmentDetail(detail);
      }
    } catch (err: any) {
      showToast('error', `Action failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Document Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const res = await uploadCAFIEDocument(file);
      setExtractedDoc(res);
      showToast('success', `Document ${file.name} parsed into structured financial facts.`);
    } catch (err: any) {
      showToast('error', `Document upload failed: ${err.message}`);
    } finally {
      setUploadingDoc(false);
    }
  };

  // Filtered lists
  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchSearch =
        !searchQuery ||
        v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        v.vendor_code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRisk =
        riskFilter === 'all' ||
        (riskFilter === 'high' && v.risk_score >= 68) ||
        (riskFilter === 'medium' && v.risk_score >= 38 && v.risk_score < 68) ||
        (riskFilter === 'low' && v.risk_score < 38);
      return matchSearch && matchRisk;
    });
  }, [vendors, searchQuery, riskFilter]);

  const filteredReconciliations = useMemo(() => {
    return reconciliations.filter(r => {
      const matchSearch =
        !searchQuery ||
        r.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.invoice_number.toLowerCase().includes(searchQuery.toLowerCase());
      const matchRisk = riskFilter === 'all' || r.risk_level.toLowerCase() === riskFilter.toLowerCase();
      return matchSearch && matchRisk;
    });
  }, [reconciliations, searchQuery, riskFilter]);

  const filteredMemoryEvents = useMemo(() => {
    return memoryEvents.filter(m => {
      const matchSearch =
        !searchQuery ||
        m.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.event_category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchCategory = categoryFilter === 'all' || m.event_category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [memoryEvents, searchQuery, categoryFilter]);

  const kpis = overview?.kpis || {
    total_vendors_analysed: 35,
    historical_risk_events: 3,
    repeated_vendor_discrepancies: 3,
    invoice_mismatches: 2,
    duplicate_invoices: 0,
    inventory_value_at_risk: 6223200,
    working_capital_blocked: 6223200,
    high_risk_transactions: 1,
    estimated_financial_exposure_detected: 5905000,
  };

  return (
    <div className="space-y-6 pb-24 text-slate-900 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border text-sm font-medium transition-all animate-in fade-in slide-in-from-top-4 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/80 dark:text-emerald-200 dark:border-emerald-800'
              : toastMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-800'
              : 'bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/80 dark:text-blue-200 dark:border-blue-800'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Header Banner with Synthetic Demo Callout */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 md:p-8 text-white shadow-xl border border-slate-800">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Full-Stack AI Module • Live Enterprise Engine</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              Context-Aware Financial Intelligence Engine (CAFIE)
            </h1>
            <p className="text-slate-300 text-sm leading-relaxed">
              Unifying <strong>Adaptive Vendor Intelligence</strong>, <strong>Inventory-to-Cash</strong>,{' '}
              <strong>Cross-System Three-Way Reconciliation</strong>, and persistent{' '}
              <strong>Financial Risk Memory</strong> to prevent losses before disbursements occur.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleRunLaptopsDemo}
              disabled={demoRunning}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              <Play className={`w-4 h-4 fill-current ${demoRunning ? 'animate-spin' : ''}`} />
              <span>{demoRunning ? 'Evaluating Scenario...' : 'Run Laptops Business Scenario'}</span>
            </button>

            <button
              onClick={loadAllData}
              disabled={loading}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-medium text-sm bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border border-slate-700/60 active:scale-95 transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Connectors Bar */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>SAP S/4HANA (MM/FI): <strong>API Connected</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Warehouse WMS: <strong>API Connected</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Financial Memory Engine: <strong>Active (PostgreSQL Indexed)</strong></span>
          </div>
          <div className="flex items-center gap-2 ml-auto text-amber-300 font-medium">
            <span>Governance Role: <strong>{role.toUpperCase()}</strong></span>
          </div>
        </div>
      </div>

      {/* 9 Main KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Vendors Analysed</span>
            <Building className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold">{kpis.total_vendors_analysed}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">100% profiles active</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Historical Risk Events</span>
            <History className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-xl font-bold">{kpis.historical_risk_events}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Indexed in memory</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Repeated Discrepancies</span>
            <TrendingUp className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{kpis.repeated_vendor_discrepancies}</div>
          <div className="text-[11px] text-amber-600/80 mt-1">Multi-cycle patterns</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Invoice Mismatches</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{kpis.invoice_mismatches}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">PO / GRN / Inv deltas</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Duplicate Invoices</span>
            <Layers className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold">{kpis.duplicate_invoices}</div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">Ledger verified</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Inventory at Risk</span>
            <Boxes className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-xl font-bold">{formatINR(kpis.inventory_value_at_risk)}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Excess & slow-moving</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>Working Capital Blocked</span>
            <DollarSign className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400">{formatINR(kpis.working_capital_blocked)}</div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Tied in warehouse</div>
        </div>

        <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
            <span>High-Risk Transactions</span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-rose-600 dark:text-rose-400">{kpis.high_risk_transactions}</div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-1">Held for review</div>
        </div>

        <div className="col-span-2 p-4 rounded-xl bg-gradient-to-br from-rose-50 to-amber-50 dark:from-rose-950/30 dark:to-amber-950/30 border border-rose-200 dark:border-rose-900/40 shadow-sm">
          <div className="flex items-center justify-between text-rose-800 dark:text-rose-300 text-xs font-medium mb-1">
            <span>Estimated Financial Exposure Detected</span>
            <AlertOctagon className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-2xl font-black text-rose-700 dark:text-rose-400 tracking-tight">
            {formatINR(kpis.estimated_financial_exposure_detected)}
          </div>
          <div className="text-[11px] text-rose-600 dark:text-rose-300 font-medium mt-1">
            Preventive payment holds currently active across systems
          </div>
        </div>
      </div>

      {/* Primary Sub-Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: 'overview', label: '1. Intelligence Overview', icon: Brain },
          { key: 'vendors', label: '2. Vendor Intelligence', icon: Building },
          { key: 'inventory', label: '3. Inventory-to-Cash', icon: Boxes },
          { key: 'cross_system', label: '4. Cross-System 3-Way Match', icon: Layers },
          { key: 'memory', label: '5. Financial Risk Memory', icon: History },
          { key: 'investigation', label: '6. Transaction Investigation', icon: FileSearch },
          { key: 'alerts', label: '7. Alerts & Recommendations', icon: ShieldAlert },
          { key: 'audit', label: '8. Audit & Decision History', icon: CheckCircle2 },
        ].map(t => {
          const Icon = t.icon;
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as TabKey)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 1: INTELLIGENCE OVERVIEW
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Risk Distribution Chart */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-indigo-500" />
                  <span>Transaction Risk Distribution</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Calibrated composite scores across 3-way reconciliation, memory, and vendor profile.
                </p>
              </div>

              <div className="h-48 my-3">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={overview?.risk_distribution || [
                        { name: 'High Risk', value: 1, color: '#ef4444' },
                        { name: 'Medium Risk', value: 2, color: '#f59e0b' },
                        { name: 'Low Risk', value: 1, color: '#10b981' },
                      ]}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={4}
                    >
                      {(overview?.risk_distribution || []).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: any) => [`${val} Transactions`, 'Volume']}
                      contentStyle={{
                        borderRadius: '12px',
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconSize={10} wrapperStyle={{ fontSize: '11px' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="text-xs text-center text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                {kpis.high_risk_transactions} high-risk disbursement held pending manager sign-off.
              </div>
            </div>

            {/* Inventory Ageing Distribution */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm lg:col-span-2 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Boxes className="w-4 h-4 text-indigo-500" />
                  <span>Warehouse Inventory Ageing & Blocked Capital</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Valuation of stock cohorts against operational demand velocity (WMS connected).
                </p>
              </div>

              <div className="h-48 my-3">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryData?.ageing_cohorts || []}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                    <XAxis dataKey="cohort" tick={{ fontSize: 11 }} />
                    <YAxis
                      tickFormatter={val => `₹${(val / 100000).toFixed(0)}L`}
                      tick={{ fontSize: 11 }}
                    />
                    <Tooltip
                      formatter={(val: any) => [formatINR(Number(val)), 'Inventory Value']}
                      contentStyle={{
                        borderRadius: '12px',
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#fff',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                <span>Working Capital Blocked: <strong>{formatINR(kpis.working_capital_blocked)}</strong></span>
                <span className="text-indigo-600 dark:text-indigo-400 font-semibold cursor-pointer hover:underline" onClick={() => setActiveTab('inventory')}>
                  View Reorder Recommendations →
                </span>
              </div>
            </div>
          </div>

          {/* Recent Investigations Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Cross-System Transaction Investigations</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Automated three-way matching against SAP POs, WMS GRNs, and AP Invoices.
                </p>
              </div>

              <button
                onClick={() => setActiveTab('cross_system')}
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <span>View Full Registry</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Assessment #</th>
                    <th className="py-2.5 px-3">Vendor</th>
                    <th className="py-2.5 px-3">Invoice Ref</th>
                    <th className="py-2.5 px-3 text-center">3-Way Match</th>
                    <th className="py-2.5 px-3 text-center">Risk Score</th>
                    <th className="py-2.5 px-3">Exposure</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(overview?.recent_investigations || []).map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-3 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        {inv.assessment_number}
                      </td>
                      <td className="py-3 px-3 font-medium">{inv.vendor_name}</td>
                      <td className="py-3 px-3 font-mono text-slate-500">{inv.invoice_number}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                            inv.reconciliation_status === 'matched'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}
                        >
                          {inv.reconciliation_status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-bold ${
                            inv.risk_level === 'HIGH'
                              ? 'text-rose-600 dark:text-rose-400'
                              : inv.risk_level === 'MEDIUM'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {inv.composite_risk_score} ({inv.risk_level})
                        </span>
                      </td>
                      <td className="py-3 px-3 font-semibold">{formatINR(inv.estimated_financial_exposure)}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2.5 py-0.5 rounded-md font-medium text-[10px] ${
                            inv.approval_status === 'held_for_verification'
                              ? 'bg-rose-500/10 text-rose-600 border border-rose-500/30'
                              : inv.approval_status === 'approved'
                              ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-600 border border-amber-500/30'
                          }`}
                        >
                          {inv.approval_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => {
                            setSelectedAssessmentId(inv.id);
                            setActiveTab('investigation');
                          }}
                          className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                        >
                          Inspect
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 2: ADAPTIVE VENDOR INTELLIGENCE
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'vendors' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search vendor name, code, or category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-slate-400" />
              <select
                value={riskFilter}
                onChange={e => setRiskFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium"
              >
                <option value="all">All Risk Levels</option>
                <option value="high">High Risk (&gt;= 68)</option>
                <option value="medium">Medium Risk (38 - 67)</option>
                <option value="low">Low Risk (&lt; 38)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredVendors.map(v => (
              <div
                key={v.vendor_id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-indigo-500/50 transition-all"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] font-mono text-slate-500">{v.vendor_code}</div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                        {v.vendor_name}
                      </h4>
                      <span className="text-[10px] text-slate-400">{v.category}</span>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-base font-black ${
                          v.risk_score >= 68
                            ? 'text-rose-600 dark:text-rose-400'
                            : v.risk_score >= 38
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        {v.risk_score}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase font-semibold">Risk Score</div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Avg Invoice:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{formatINR(v.avg_invoice_amount)}</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Avg Lead Time:</span>
                      <strong className="text-slate-800 dark:text-slate-200">{v.avg_lead_time_days} days</strong>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Historical Discrepancies:</span>
                      <span
                        className={`font-semibold ${
                          v.historical_discrepancy_count > 0 ? 'text-amber-600' : 'text-slate-500'
                        }`}
                      >
                        {v.historical_discrepancy_count} events
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                      <span>Bank Account:</span>
                      <span className="font-mono text-[11px]">{v.bank_account_masked} ({v.ifsc_code})</span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                      v.verification_status === 'flagged'
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    }`}
                  >
                    {v.verification_status.toUpperCase()}
                  </span>

                  <button
                    onClick={() => {
                      setSearchQuery(v.vendor_name);
                      setActiveTab('memory');
                    }}
                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View Memory Timeline →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 3: INVENTORY-TO-CASH INTELLIGENCE
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'inventory' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Warehouse Stock Value</div>
              <div className="text-2xl font-bold mt-1 text-slate-900 dark:text-slate-100">
                {formatINR(inventoryData?.total_inventory_value || 0)}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Quantity on Hand × Unit Cost across {inventoryData?.total_sku_count || 0} active enterprise SKUs.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-medium text-amber-600 dark:text-amber-400">Excess Stock & Working Capital Blocked</div>
              <div className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">
                {formatINR(inventoryData?.working_capital_blocked || 0)}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Stock exceeding lead-time demand + safety buffers, tying up corporate liquidity.
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-medium text-indigo-600 dark:text-indigo-400">30-Day Procurement Cash Outflow Impact</div>
              <div className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
                {formatINR(inventoryData?.cash_flow_impact_30d || 0)}
              </div>
              <div className="text-xs text-slate-400 mt-2">
                Anticipated reorder purchase disbursements feeding directly into Finvora Cash Flow.
              </div>
            </div>
          </div>

          {/* Reorder Recommendations */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-indigo-500" />
                  <span>Optimal Reorder Recommendations (ROQ)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Calculated from daily consumption velocity, supplier lead times, and required safety stocks.
                </p>
              </div>

              <div className="text-xs text-slate-400">
                Formula: ROQ = max(0, LeadTimeDemand + SafetyStock - AvailableStock)
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3">Item Name</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3 text-center">Stock / Safety</th>
                    <th className="py-2.5 px-3 text-center">Reorder Point</th>
                    <th className="py-2.5 px-3 text-center font-bold text-indigo-600">Recommended ROQ</th>
                    <th className="py-2.5 px-3">Estimated Cost</th>
                    <th className="py-2.5 px-3 text-center">Urgency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {(inventoryData?.reorder_recommendations || []).map(r => (
                    <tr key={r.sku} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-medium text-indigo-600">{r.sku}</td>
                      <td className="py-3 px-3 font-medium">{r.item_name}</td>
                      <td className="py-3 px-3 text-slate-500">{r.category}</td>
                      <td className="py-3 px-3 text-center">
                        {r.current_stock} / {r.safety_stock}
                      </td>
                      <td className="py-3 px-3 text-center">{r.reorder_point}</td>
                      <td className="py-3 px-3 text-center font-bold text-indigo-600 dark:text-indigo-400">
                        {r.recommended_reorder_qty} units
                      </td>
                      <td className="py-3 px-3 font-semibold">{formatINR(r.estimated_reorder_cost)}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.urgency === 'High'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {r.urgency}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 4: CROSS-SYSTEM THREE-WAY RECONCILIATION
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'cross_system' && (
        <div className="space-y-6">
          {/* Document Ingestion & Extraction Widget */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-indigo-500" />
                <span>Financial Document Intelligence (OCR / Multi-format Extraction)</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Upload scanned Invoices, GRNs, or POs (PDF, Excel, CSV, PNG) to extract line-item facts into the reconciliation queue.
              </p>
            </div>

            <div>
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer transition-colors shadow-sm active:scale-95">
                <UploadCloud className="w-4 h-4" />
                <span>{uploadingDoc ? 'Extracting Facts...' : 'Upload Document'}</span>
                <input
                  type="file"
                  accept=".pdf,.csv,.xlsx,.png,.jpg,.jpeg"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadingDoc}
                />
              </label>
            </div>
          </div>

          {/* Extracted Document Preview */}
          {extractedDoc && (
            <div className="p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 dark:text-indigo-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Extracted Document Facts: {extractedDoc.document_number}</span>
                </h4>
                <button
                  onClick={() => setExtractedDoc(null)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Dismiss
                </button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                <div>
                  <span className="text-slate-500">Vendor:</span> <strong>{extractedDoc.vendor_name}</strong>
                </div>
                <div>
                  <span className="text-slate-500">PO Ref:</span> <strong>{extractedDoc.po_reference}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Total Amount:</span> <strong>{formatINR(extractedDoc.total_amount)}</strong>
                </div>
                <div>
                  <span className="text-slate-500">Bank Remittance:</span> <strong>{extractedDoc.bank_name} ({extractedDoc.ifsc_code})</strong>
                </div>
              </div>
            </div>
          )}

          {/* Reconciliations Table */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Three-Way Reconciliations Registry (PO + GRN + Invoice)</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Line-item deterministic cross-matching with automated exposure formulation.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={riskFilter}
                  onChange={e => setRiskFilter(e.target.value)}
                  className="px-3 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium"
                >
                  <option value="all">All Risk Levels</option>
                  <option value="high">High Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="low">Low Risk</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Assessment #</th>
                    <th className="py-2.5 px-3">Vendor</th>
                    <th className="py-2.5 px-3">PO / GRN / Invoice</th>
                    <th className="py-2.5 px-3 text-center">3-Way Score</th>
                    <th className="py-2.5 px-3 text-center">Risk Level</th>
                    <th className="py-2.5 px-3">Total Amount</th>
                    <th className="py-2.5 px-3">Exposure</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 text-right">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {filteredReconciliations.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono font-semibold text-indigo-600">
                        {r.assessment_number}
                        {r.is_synthetic_demo && (
                          <span className="ml-1.5 px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold">
                            DEMO
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-medium">{r.vendor_name}</td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">
                        {r.po_number} | {r.grn_number} | {r.invoice_number}
                      </td>
                      <td className="py-3 px-3 text-center font-bold">
                        {r.three_way_match_score}%
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-bold ${
                            r.risk_level === 'HIGH'
                              ? 'text-rose-600'
                              : r.risk_level === 'MEDIUM'
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {r.risk_level} ({r.composite_risk_score})
                        </span>
                      </td>
                      <td className="py-3 px-3">{formatINR(r.total_invoice_amount)}</td>
                      <td className="py-3 px-3 font-semibold text-rose-600">{formatINR(r.estimated_financial_exposure)}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                            r.approval_status === 'held_for_verification'
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : r.approval_status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {r.approval_status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedAssessmentId(r.id);
                              setActiveTab('investigation');
                            }}
                            className="px-2.5 py-1 rounded text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700"
                          >
                            Inspect
                          </button>
                          {r.approval_status !== 'approved' && (
                            <button
                              onClick={() => {
                                setActionTargetId(r.id);
                                setShowActionModal(true);
                              }}
                              className="px-2.5 py-1 rounded text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white"
                            >
                              Decide
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 5: FINANCIAL RISK MEMORY ENGINE
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'memory' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-indigo-900 text-white shadow-lg border border-indigo-800">
            <h3 className="text-base font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-300" />
              <span>Persistent Financial Risk Memory Store</span>
            </h3>
            <p className="text-xs text-indigo-200 mt-1 max-w-2xl leading-relaxed">
              CAFIE indexes every historical variance, delayed delivery, quantity discrepancy, and bank routing change into a persistent memory store.
              When new transactions arrive, relevant evidence is recalled across monthly boundaries without relying on ephemeral LLM context.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                type="text"
                placeholder="Search vendor or memory category..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-medium"
              >
                <option value="all">All Memory Categories</option>
                <option value="quantity_mismatch">Quantity Mismatches</option>
                <option value="price_spike">Price Spikes</option>
                <option value="bank_details_change">Bank Account Changes</option>
                <option value="duplicate_invoice_attempt">Duplicate Invoice Attempts</option>
                <option value="delayed_delivery">Delayed Deliveries</option>
              </select>
            </div>
          </div>

          {/* Timeline of Memory Events */}
          <div className="space-y-4">
            {filteredMemoryEvents.map(m => (
              <div
                key={m.id}
                className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        m.severity === 'critical'
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}
                    >
                      {m.severity}
                    </span>
                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">{m.vendor_name}</span>
                    <span className="text-slate-400 text-xs">•</span>
                    <span className="text-slate-400 text-xs font-mono">{m.event_date}</span>
                  </div>

                  <h4 className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                    {m.event_category.replace(/_/g, ' ').toUpperCase()}
                  </h4>

                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {m.supporting_evidence.map((ev, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="font-medium text-slate-500">{ev.metric}:</span>
                        <span>Expected {ev.expected}, Actual {ev.actual} ({ev.variance})</span>
                      </div>
                    ))}
                  </div>

                  {m.authorized_manager_remarks && (
                    <div className="text-[11px] text-slate-500 italic pt-1">
                      Manager Remark: "{m.authorized_manager_remarks}"
                    </div>
                  )}
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold text-rose-600">
                    {m.financial_impact > 0 ? formatINR(m.financial_impact) : 'Operational Breach'}
                  </div>
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-1 ${
                      m.resolution_status === 'resolved'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {m.resolution_status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 6: TRANSACTION INVESTIGATION & LINE-ITEM DIFF
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'investigation' && (
        <div className="space-y-6">
          {!assessmentDetail ? (
            <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
              <FileSearch className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <h3 className="text-sm font-bold">Select a Transaction from Reconciliations</h3>
              <p className="text-xs text-slate-500 mt-1">
                Choose an item to inspect line-item discrepancies across PO, GRN, and Invoice.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Investigation Header */}
              <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-indigo-600 font-bold">
                      {assessmentDetail.assessment.assessment_number}
                    </span>
                    {assessmentDetail.assessment.is_synthetic_demo && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold">
                        100-LAPTOP DEMO
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold">{assessmentDetail.assessment.vendor_name}</h3>
                  <div className="text-xs text-slate-500 font-mono">
                    PO: {assessmentDetail.assessment.po_number} | GRN: {assessmentDetail.assessment.grn_number} | Invoice: {assessmentDetail.assessment.invoice_number}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-xs text-slate-400">Risk Assessment</div>
                    <div
                      className={`text-xl font-black ${
                        assessmentDetail.assessment.risk_level === 'HIGH'
                          ? 'text-rose-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {assessmentDetail.assessment.composite_risk_score} ({assessmentDetail.assessment.risk_level})
                    </div>
                  </div>

                  {assessmentDetail.assessment.approval_status !== 'approved' && (
                    <button
                      onClick={() => {
                        setActionTargetId(assessmentDetail.assessment.id);
                        setShowActionModal(true);
                      }}
                      className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
                    >
                      Make Decision
                    </button>
                  )}
                </div>
              </div>

              {/* Explainable Recommendation & Action Callout */}
              <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 shadow-sm space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>CAFIE Context-Aware AI Explanation</span>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                  {assessmentDetail.assessment.explanation}
                </p>
                <div className="pt-2 border-t border-amber-200/60 dark:border-amber-800/40 text-xs font-bold text-amber-900 dark:text-amber-200">
                  Recommended Action: {assessmentDetail.assessment.recommended_action}
                </div>
              </div>

              {/* Line-item 3-Way Reconciliation Diff */}
              <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4 flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-500" />
                  <span>Three-Way Line-Item Comparison (PO vs GRN vs Invoice)</span>
                </h4>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3">SKU</th>
                        <th className="py-2.5 px-3">Description</th>
                        <th className="py-2.5 px-3 text-center">PO Qty</th>
                        <th className="py-2.5 px-3 text-center">GRN Qty</th>
                        <th className="py-2.5 px-3 text-center">Inv Qty</th>
                        <th className="py-2.5 px-3 text-right">PO Price</th>
                        <th className="py-2.5 px-3 text-right">Inv Price</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                      {(assessmentDetail.assessment.discrepancy_details?.line_item_diffs || []).map((diff, idx) => (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="py-3 px-3 font-mono font-medium text-indigo-600">{diff.sku}</td>
                          <td className="py-3 px-3 font-medium">{diff.description}</td>
                          <td className="py-3 px-3 text-center">{diff.po_quantity}</td>
                          <td className="py-3 px-3 text-center">{diff.grn_quantity}</td>
                          <td className="py-3 px-3 text-center">{diff.invoice_quantity}</td>
                          <td className="py-3 px-3 text-right">{formatINR(diff.po_unit_price)}</td>
                          <td className="py-3 px-3 text-right">{formatINR(diff.invoice_unit_price)}</td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${
                                diff.status === 'matched'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {diff.status.toUpperCase()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Supporting Evidence Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-rose-500" />
                    <span>Cross-System Evidence Signals</span>
                  </h4>
                  <div className="space-y-2">
                    {assessmentDetail.assessment.evidence.map((ev, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-slate-900 dark:text-slate-100">{ev.title}</span>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                              ev.status === 'CRITICAL'
                                ? 'bg-rose-100 text-rose-800'
                                : ev.status === 'WARNING'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {ev.status}
                          </span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">{ev.detail}</div>
                        <div className="text-[10px] text-indigo-500 font-medium">Layer: {ev.layer}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Recalled Financial Risk Memories */}
                <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-500" />
                    <span>Recalled Historical Risk Memories ({assessmentDetail.recalled_memories.length})</span>
                  </h4>

                  <div className="space-y-2">
                    {assessmentDetail.recalled_memories.map(m => (
                      <div key={m.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 text-xs space-y-1">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-indigo-600 dark:text-indigo-400">
                            {m.event_category.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px]">{m.event_date}</span>
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {m.supporting_evidence.map((s, idx) => (
                            <span key={idx}>
                              {s.metric}: {s.variance}
                            </span>
                          ))}
                        </div>
                        {m.authorized_manager_remarks && (
                          <div className="text-[10px] text-slate-400 italic">
                            Manager note: "{m.authorized_manager_remarks}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 7: ALERTS & RECOMMENDATIONS
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <div className="space-y-5">
          <div className="p-5 rounded-2xl bg-rose-900/90 text-white shadow-lg border border-rose-800">
            <h3 className="text-base font-bold flex items-center gap-2">
              <AlertOctagon className="w-5 h-5 text-rose-300" />
              <span>Prioritized Financial Defense Recommendations</span>
            </h3>
            <p className="text-xs text-rose-200 mt-1 max-w-2xl leading-relaxed">
              Actionable preventive instructions compiled from cross-system reconciliation, inventory velocity, and vendor behavioral history.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  HIGH SEVERITY
                </span>
                <span className="font-bold text-rose-600 text-sm">Protected: ₹47,20,000</span>
              </div>
              <h4 className="text-sm font-bold">ByteCraft Systems: Payment Hold on Laptop Invoice #INV-2026-BCS-991</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Vendor remitted Kotak Mahindra Bank account instead of registered HDFC master profile.
                Given prior January shortfall and February price hike, hold payment until independent callback confirmation.
              </p>
              <div className="pt-2 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline" onClick={() => { setActiveTab('investigation'); }}>
                Inspect Transaction Details →
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  MEDIUM SEVERITY
                </span>
                <span className="font-bold text-amber-600 text-sm">Recovery: ₹8,25,000</span>
              </div>
              <h4 className="text-sm font-bold">HyperScale Systems: Deduct 5 Missing Cisco Switches on #INV-2026-HPS-8841</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Warehouse GRN verified 45 units received vs 50 units billed.
                Issue short-payment debit note of ₹8,25,000 + GST before releasing funds.
              </p>
              <div className="pt-2 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline" onClick={() => { setActiveTab('cross_system'); }}>
                Review 3-Way Reconciliation →
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  MEDIUM SEVERITY
                </span>
                <span className="font-bold text-amber-600 text-sm">Disputed: ₹3,60,000</span>
              </div>
              <h4 className="text-sm font-bold">Apex Growth Media: Enforce Contractual Rate Card on #INV-2026-AGM-9022</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Invoice billed ₹1,65,000 per campaign against approved PO price of ₹1,20,000.
                Hold approval pending revised invoice adhering to master service agreement.
              </p>
              <div className="pt-2 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline" onClick={() => { setActiveTab('cross_system'); }}>
                Review Rate Card Discrepancy →
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                  WORKING CAPITAL
                </span>
                <span className="font-bold text-indigo-600 text-sm">Liquidity: ₹62,23,200</span>
              </div>
              <h4 className="text-sm font-bold">Warehouse Inventory: Liquidate 90+ Day Stagnant Enterprise Components</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Over ₹62 Lakhs tied up in slow-moving servers and switchgear cohorts.
                Delay upcoming replenishment POs to conserve operating cash buffer.
              </p>
              <div className="pt-2 text-xs font-semibold text-indigo-600 cursor-pointer hover:underline" onClick={() => { setActiveTab('inventory'); }}>
                Inspect Inventory Ageing →
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          TAB 8: AUDIT & DECISION HISTORY
         ─────────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-4">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
              <span>Immutable Human-in-the-Loop Governance Audit Log</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Assessment #</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Transition</th>
                    <th className="py-2.5 px-3">Authorized Manager</th>
                    <th className="py-2.5 px-3">Audit Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                  {auditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-3 font-mono text-slate-500">{log.created_at}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-indigo-600">{log.assessment_number}</td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action === 'approve'
                              ? 'bg-emerald-100 text-emerald-800'
                              : log.action === 'reject'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {log.action.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-500">
                        {log.previous_status} → <strong>{log.new_status}</strong>
                      </td>
                      <td className="py-3 px-3 font-medium">
                        {log.user_id} ({log.user_role})
                      </td>
                      <td className="py-3 px-3 text-slate-600 dark:text-slate-300 italic">"{log.manager_remarks}"</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No human decisions recorded yet. Take an action from Reconciliations to initiate the audit trail.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          MODAL: SYNTHETIC BUSINESS DEMONSTRATION WALKTHROUGH
         ─────────────────────────────────────────────────────────────────────────── */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-2xl w-full p-6 md:p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">Demonstration: 100 Enterprise Laptops</h3>
                  <p className="text-xs text-slate-500">ByteCraft Systems & Peripherals Pvt Ltd • ₹40,00,000</p>
                </div>
              </div>
              <button
                onClick={() => setShowDemoModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center justify-between">
                  <span>1. Three-Way Document Consistency</span>
                  <span className="text-emerald-600 font-bold">100% MATCH</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-slate-600 dark:text-slate-400">
                  <div>PO: 100 @ ₹40k (₹40L)</div>
                  <div>GRN: 100 Units Received</div>
                  <div>Inv: 100 @ ₹40k (₹40L)</div>
                </div>
                <p className="text-[11px] text-slate-500 italic">
                  Traditional AP systems would automatically approve this invoice because the numbers match.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                <div className="font-bold text-amber-900 dark:text-amber-300 flex items-center justify-between">
                  <span>2. Financial Risk Memory Recall (Multi-month Context)</span>
                  <span className="text-rose-600 font-bold">CRITICAL MEMORY TRIGGER</span>
                </div>
                <ul className="space-y-1 list-disc list-inside text-slate-700 dark:text-slate-300">
                  <li><strong>January 2026:</strong> Quantity shortfall of 5 RAM modules (-₹1.85L).</li>
                  <li><strong>February 2026:</strong> Unapproved +18% pricing revision on storage.</li>
                  <li><strong>March 2026:</strong> Unverified change in bank account from HDFC to Kotak.</li>
                  <li><strong>April 2026:</strong> New invoice specifies the newly changed Kotak account!</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 space-y-1">
                <div className="font-bold text-rose-800 dark:text-rose-300">
                  3. CAFIE Decision & Exposure Protection
                </div>
                <div className="text-rose-700 dark:text-rose-300 font-semibold">
                  Status: HELD FOR VERIFICATION | Risk Score: 78.5 (HIGH) | Capital at Risk: ₹47,20,000
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  CAFIE held payment before disbursement and generated verification instructions for the authorized manager.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => {
                  setShowDemoModal(false);
                  setActiveTab('investigation');
                }}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-500 transition-colors"
              >
                Inspect Live in Investigation Panel →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────────────────────
          MODAL: HUMAN-IN-THE-LOOP DECISION DIALOG
         ─────────────────────────────────────────────────────────────────────────── */}
      {showActionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
          <div className="max-w-md w-full p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-indigo-500" />
                <span>Execute Governance Decision</span>
              </h3>
              <button
                onClick={() => setShowActionModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1.5">Action Choice:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setActionType('hold_for_verification')}
                    className={`p-2 rounded-xl border text-center font-semibold transition-all ${
                      actionType === 'hold_for_verification'
                        ? 'border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Hold Verification
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('approve')}
                    className={`p-2 rounded-xl border text-center font-semibold transition-all ${
                      actionType === 'approve'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setActionType('reject')}
                    className={`p-2 rounded-xl border text-center font-semibold transition-all ${
                      actionType === 'reject'
                        ? 'border-rose-500 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Reject
                  </button>
                </div>
              </div>

              <div>
                <label className="font-medium text-slate-700 dark:text-slate-300 block mb-1">
                  Manager Audit Remarks <span className="text-rose-500">*</span>:
                </label>
                <textarea
                  rows={3}
                  value={managerRemarks}
                  onChange={e => setManagerRemarks(e.target.value)}
                  placeholder="e.g. Conducted callback confirmation with CFO; bank account verified as authorized secondary account..."
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setShowActionModal(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleExecuteAction}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm disabled:opacity-50"
              >
                {actionLoading ? 'Recording Audit...' : 'Confirm Decision'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContextAwareIntelligencePage;

