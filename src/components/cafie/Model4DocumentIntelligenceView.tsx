import React, { useState, useEffect } from 'react';
import {
  Brain,
  ShieldAlert,
  FileText,
  Boxes,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  AlertOctagon,
  Building,
  Check,
  X,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Database,
  Sliders,
  DollarSign,
  Info,
  ShieldCheck,
  AlertCircle,
  UploadCloud,
  FileSearch,
  ArrowRight,
  Cpu,
  Layers,
  CreditCard,
} from 'lucide-react';
import { MultiModePaymentIntelligenceView } from '../idp/MultiModePaymentIntelligenceView';
import { formatINR } from '../../utils/formatters';
import {
  fetchCAFIEModel4Dashboard,
  fetchCAFIEModel4Datasets,
  resetCAFIEModel4Demo,
  submitCAFIEModel4Decision,
  uploadCAFIEModel4BillFile,
  uploadCAFIEModel4BillJson,
  Model4DashboardTelemetry,
  Model4DatasetsResponse,
  Model4ValidationResult,
  BillUploadResponse,
} from '../../lib/api';

export const Model4DocumentIntelligenceView: React.FC = () => {
  const [telemetry, setTelemetry] = useState<Model4DashboardTelemetry | null>(null);
  const [datasets, setDatasets] = useState<Model4DatasetsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [resetting, setResetting] = useState<boolean>(false);
  const [subView, setSubView] = useState<'validations' | 'datasets' | 'payment_intelligence'>('validations');
  const [datasetSubTab, setDatasetSubTab] = useState<'invoices' | 'pos' | 'grns' | 'vendors'>('invoices');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterMatchStatus, setFilterMatchStatus] = useState<string>('ALL');
  const [filterRiskLevel, setFilterRiskLevel] = useState<string>('ALL');

  // Decision Modal State
  const [decisionModalOpen, setDecisionModalOpen] = useState<boolean>(false);
  const [selectedValidation, setSelectedValidation] = useState<Model4ValidationResult | null>(null);
  const [decisionAction, setDecisionAction] = useState<'approve' | 'reject' | 'hold'>('hold');
  const [decisionRemarks, setDecisionRemarks] = useState<string>('');
  const [submittingDecision, setSubmittingDecision] = useState<boolean>(false);
  const [hasPermission, setHasPermission] = useState<boolean>(false);

  // Expanded evidence accordion
  const [expandedRowId, setExpandedRowId] = useState<number | null>(null);

  // Bill Upload Modal State
  const [uploadModalOpen, setUploadModalOpen] = useState<boolean>(false);
  const [uploadingBill, setUploadingBill] = useState<boolean>(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [billTextPayload, setBillTextPayload] = useState<string>('');
  const [uploadResult, setUploadResult] = useState<BillUploadResponse | null>(null);
  const [uploadSourceMode, setUploadSourceMode] = useState<'sample' | 'file' | 'text'>('sample');

  const loadData = async () => {
    try {
      setLoading(true);
      const [telemetryRes, datasetsRes] = await Promise.all([
        fetchCAFIEModel4Dashboard(),
        fetchCAFIEModel4Datasets(),
      ]);
      setTelemetry(telemetryRes);
      setDatasets(datasetsRes);
    } catch (err) {
      console.error('Failed to load Model 4 data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Pre-configured Sample Bills for quick testing
  const sampleBills = [
    {
      label: 'Sample 1: Clean Match (Dell Desktops)',
      badge: 'CLEAN MATCH',
      color: 'border-emerald-300 text-emerald-800 bg-emerald-50 dark:bg-emerald-950/30',
      text: `TAX INVOICE INV-2026-UP-101
Vendor: TechCorp Solutions Pvt Ltd (VEND-101)
PO Reference: PO-2026-101
Invoice Date: 2026-10-25
Line Item: Dell OptiPlex 7090 Business Desktop | Qty: 50 | Unit Price: 45,000 | Total: 2,250,000.00
Subtotal: INR 2,250,000.00
Tax (GST 18%): INR 405,000.00
Total Amount: INR 2,655,000.00
Bank Account: 50200012345678
IFSC: HDFC0001234`
    },
    {
      label: 'Sample 2: Over-Billed Quantity (NVMe SSDs)',
      badge: 'QTY MISMATCH (+20 EA)',
      color: 'border-amber-300 text-amber-800 bg-amber-50 dark:bg-amber-950/30',
      text: `TAX INVOICE INV-2026-UP-102
Vendor: Apex Cloud Infrastructure (VEND-102)
PO Reference: PO-2026-102
Invoice Date: 2026-10-26
Line Item: Enterprise NVMe SSD 3.84TB U.2 | Billed Qty: 100 | Unit Price: 12,000 | Total: 1,200,000.00
Subtotal: INR 1,200,000.00
Tax (GST 18%): INR 216,000.00
Total Amount: INR 1,416,000.00
Bank Account: 001105009876
IFSC: ICIC0000011
Note: Billed full 100 units though warehouse GRN rejected 20 damaged units!`
    },
    {
      label: 'Sample 3: Price Escalation (Microcontrollers)',
      badge: 'PRICE MISMATCH (+20%)',
      color: 'border-rose-300 text-rose-800 bg-rose-50 dark:bg-rose-950/30',
      text: `TAX INVOICE INV-2026-UP-103
Vendor: Quantum Chipset Ltd (VEND-103)
PO Reference: PO-2026-103
Invoice Date: 2026-10-28
Line Item: Industrial Microcontroller Core IC | Qty: 200 | Unit Price: 1,800.00 | Total: 360,000.00
Subtotal: INR 360,000.00
Tax (GST 18%): INR 64,800.00
Total Amount: INR 424,800.00
Bank Account: 334455667788
IFSC: SBIN0004567
Notice: Invoiced rate of INR 1,800 exceeds contracted PO rate of INR 1,500 (+INR 300/unit escalation).`
    },
    {
      label: 'Sample 4: Phishing Bank Account Hijack Alert',
      badge: '3-WAY MISMATCH',
      color: 'border-red-400 text-red-700 bg-red-100 dark:bg-red-950/60 font-bold',
      text: `TAX INVOICE INV-2026-UP-107
Vendor: Metro Facilities & Maintenance (VEND-107)
PO Reference: PO-2026-107
Invoice Date: 2026-10-29
Line Item: Chiller Plant Overhaul & Annual Servicing | Qty: 1 | Rate: 380,000.00
Subtotal: INR 380,000.00
Tax (GST 18%): INR 68,400.00
Total Amount: INR 448,400.00
Bank Account: 99887766554433
IFSC: YESB0000999
CRITICAL WARNING: Remittance bank A/C 99887766554433 does not match registered HDFC A/C 50200099887766!`
    }
  ];

  const handleResetDemo = async (targetSeed?: number) => {
    // Alternate seeds deterministically across the 3 batches if not provided
    const currentSeed = telemetry?.ml_models?.seed || 42;
    const nextSeed = targetSeed !== undefined ? targetSeed : (currentSeed + 1);
    try {
      setResetting(true);
      await resetCAFIEModel4Demo(nextSeed);
      await loadData();
    } catch (err) {
      console.error('Failed to reset demo:', err);
    } finally {
      setResetting(false);
    }
  };

  const handleExtractAndMatch = async () => {
    try {
      setUploadingBill(true);
      setUploadResult(null);

      let response: BillUploadResponse;
      if (uploadedFile) {
        response = await uploadCAFIEModel4BillFile(uploadedFile, billTextPayload);
      } else {
        const textToProcess = billTextPayload.trim() || sampleBills[0].text;
        response = await uploadCAFIEModel4BillJson(textToProcess);
      }

      setUploadResult(response);
      await loadData(); // Refresh table telemetry
    } catch (err: any) {
      console.error('Upload / match failed:', err);
      alert(err.message || 'Failed to extract bill and match.');
    } finally {
      setUploadingBill(false);
    }
  };

  const openDecisionModal = (val: Model4ValidationResult, action: 'approve' | 'reject' | 'hold') => {
    setSelectedValidation(val);
    setDecisionAction(action);
    setHasPermission(false);
    setDecisionRemarks(
      action === 'approve'
        ? 'Verified PO, GRN quantities, and pricing against contract terms. Approved for payment.'
        : action === 'reject'
        ? 'Discrepancy exceeds risk tolerance. Rejected transaction.'
        : 'Holding payment pending clarification of discrepancy and credit note receipt.'
    );
    setDecisionModalOpen(true);
  };

  const handleConfirmDecision = async () => {
    if (!selectedValidation) return;
    if (!hasPermission) {
      alert("Permission Required: You must grant explicit permission to direct this amount to the vendor's ledger before any changes can be committed.");
      return;
    }
    try {
      setSubmittingDecision(true);
      await submitCAFIEModel4Decision(selectedValidation.id, decisionAction, decisionRemarks);
      setDecisionModalOpen(false);
      setSelectedValidation(null);
      await loadData();
    } catch (err) {
      console.error('Failed to record decision:', err);
    } finally {
      setSubmittingDecision(false);
    }
  };

  const filteredValidations = (telemetry?.recent_validations || []).filter((v) => {
    const matchesSearch =
      v.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.po_number && v.po_number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus =
      filterMatchStatus === 'ALL' || v.three_way_match_status === filterMatchStatus;

    const matchesRisk =
      filterRiskLevel === 'ALL' || v.risk_level === filterRiskLevel;

    return matchesSearch && matchesStatus && matchesRisk;
  });

  return (
    <div className="space-y-6">
      {/* ── TOP ACTION & STATUS BANNER (CLEAN WHITE / SLATE THEME) ─────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 text-slate-900 dark:text-white shadow-sm relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-full bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1">
                <Brain className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                ENTERPRISE MODEL 4
              </span>
              <span className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center gap-1">
                <Database className="w-3 h-3 text-blue-500" />
                {telemetry?.batch_name || 'Q1 Enterprise IT Hardware'}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {telemetry?.dataset_version || 'v4.0.0-seed-42'}
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
              Enterprise Document Intelligence & Predictive Validation Engine
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
              Automated 3-Way PO-GRN-Invoice matching with hardcoded rotational enterprise scenarios, PaddleOCR bill extraction, and 4 independently measurable baseline ML models.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
            {/* Upload Bill Button */}
            <button
              onClick={() => {
                setUploadResult(null);
                setBillTextPayload(sampleBills[0].text);
                setUploadModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-sm"
              title="Upload invoice file or paste bill text for OCR extraction & 3-way match"
            >
              <UploadCloud className="w-4 h-4 text-white" />
              UPLOAD BILL & 3-WAY MATCH
            </button>

            {/* Rotational Reset Buttons */}
            <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-0.5">
              <button
                onClick={() => handleResetDemo(0)}
                disabled={resetting || loading}
                className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                title="Load Batch 1: Q1 IT Hardware"
              >
                Q1
              </button>
              <button
                onClick={() => handleResetDemo(1)}
                disabled={resetting || loading}
                className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                title="Load Batch 2: Q2 Industrial Networking"
              >
                Q2
              </button>
              <button
                onClick={() => handleResetDemo(2)}
                disabled={resetting || loading}
                className="px-2 py-1.5 text-[11px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 rounded transition-colors disabled:opacity-50"
                title="Load Batch 3: Q3 Cloud Data Center"
              >
                Q3
              </button>
            </div>

            <button
              onClick={() => handleResetDemo()}
              disabled={resetting || loading}
              className="flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100 transition-all shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${resetting ? 'animate-spin' : ''}`} />
              {resetting ? 'Retraining...' : 'RESET DEMO'}
            </button>
          </div>
        </div>

        {/* Notice Disclaimer Banner */}
        <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span>
              <strong>Hardcoded Data Rotation:</strong> Reset rotates through 3 distinct corporate supply chain datasets (Q1, Q2, Q3) and retrains all 4 baseline ML models in memory.
            </span>
          </div>
          <div className="text-slate-400 font-mono text-[10px]">
            Model 4 v4.0.0 &bull; Scikit-Learn 1.9.0 &bull; PaddleOCR Engine
          </div>
        </div>
      </div>

      {/* ── TOP KPI TELEMETRY CARDS ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            Total Documents
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {(telemetry?.total_purchase_orders || 0) +
              (telemetry?.total_goods_receipts || 0) +
              (telemetry?.total_invoices || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            {telemetry?.total_purchase_orders || 0} PO &bull; {telemetry?.total_goods_receipts || 0} GRN &bull; {telemetry?.total_invoices || 0} Invoices
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            Clean 3-Way Match
          </div>
          <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {telemetry?.match_status_breakdown?.MATCHED || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Zero discrepancy verified
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            Discrepancy Cases
          </div>
          <div className="text-xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {(telemetry?.total_validations || 0) - (telemetry?.match_status_breakdown?.MATCHED || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Qty, Price, Dupes & Anomaly
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
            High Risk Flags
          </div>
          <div className="text-xl font-bold text-red-600 dark:text-red-400 mt-1">
            {telemetry?.risk_level_breakdown?.HIGH || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Require Manager Review
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5 text-rose-500" />
            Financial Exposure
          </div>
          <div className="text-lg font-bold text-rose-600 dark:text-rose-400 mt-1 truncate">
            {formatINR(telemetry?.total_financial_exposure || 0)}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Total Disputed Value
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-3.5 shadow-sm">
          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Building className="w-3.5 h-3.5 text-blue-500" />
            Active Vendors
          </div>
          <div className="text-xl font-bold text-slate-900 dark:text-white mt-1">
            {telemetry?.total_vendors || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">
            Profiled Enterprise Suppliers
          </div>
        </div>
      </div>

      {/* ── FOUR BASELINE ML MODELS PERFORMANCE GRID ─────────────────────── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-slate-700 dark:text-slate-300" />
              Baseline Machine Learning Models & Evaluation Metrics
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Four independently measurable baseline models trained on synthetic enterprise data
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
            Retrained in-memory with Seed {telemetry?.ml_models?.seed || 42}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Model 1: Document Classifier */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">1. Document Classifier</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300">
                  TF-IDF + LR
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Logistic Regression on TF-IDF word n-grams (PO, GRN, INV, Vendor Profile)
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Accuracy</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {((telemetry?.ml_models?.document_classifier?.accuracy || 0.96) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Weighted F1</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {((telemetry?.ml_models?.document_classifier?.f1_score || 0.95) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Precision</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((telemetry?.ml_models?.document_classifier?.precision || 0.96) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Recall</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((telemetry?.ml_models?.document_classifier?.recall || 0.95) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>Samples: {telemetry?.ml_models?.document_classifier?.samples_count || 100}</span>
              <span className="text-emerald-600 font-medium">TRAINED</span>
            </div>
          </div>

          {/* Model 2: Invoice Risk Classifier */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">2. Invoice Risk</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  Random Forest
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Predicts LOW / MEDIUM / HIGH risk using quantity, price variance, and terms
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Accuracy</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {((telemetry?.ml_models?.invoice_risk_classifier?.accuracy || 0.88) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Weighted F1</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {((telemetry?.ml_models?.invoice_risk_classifier?.f1_score || 0.87) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Precision</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((telemetry?.ml_models?.invoice_risk_classifier?.precision || 0.89) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Recall</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((telemetry?.ml_models?.invoice_risk_classifier?.recall || 0.88) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>Samples: {telemetry?.ml_models?.invoice_risk_classifier?.samples_count || 120}</span>
              <span className="text-emerald-600 font-medium">TRAINED</span>
            </div>
          </div>

          {/* Model 3: Financial Anomaly Detector */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">3. Financial Anomaly</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                  Isolation Forest
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Unsupervised outlier isolation on amounts, unusual tax spikes, and unit prices
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Contamination</span>
                  <span className="font-bold text-slate-900 dark:text-white">15.0%</span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Outlier Ratio</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">
                    {((telemetry?.ml_models?.financial_anomaly_detector?.anomaly_outlier_ratio || 0.15) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">F1 Score</span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {((telemetry?.ml_models?.financial_anomaly_detector?.f1_score || 0.90) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Outliers Found</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {telemetry?.ml_models?.financial_anomaly_detector?.outlier_samples_flagged || 15}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>Samples: {telemetry?.ml_models?.financial_anomaly_detector?.samples_count || 115}</span>
              <span className="text-emerald-600 font-medium">TRAINED</span>
            </div>
          </div>

          {/* Model 4: Vendor Risk Predictor */}
          <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60 rounded-lg p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-white">4. Vendor Risk</span>
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                  Random Forest
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                Classifies vendor risk (LOW / MED / HIGH) on fill rate, lead time, and bank changes
              </p>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Accuracy</span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {((telemetry?.ml_models?.vendor_risk_predictor?.accuracy || 0.86) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Weighted F1</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {((telemetry?.ml_models?.vendor_risk_predictor?.f1_score || 0.85) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Precision</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((telemetry?.ml_models?.vendor_risk_predictor?.precision || 0.87) * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="bg-white dark:bg-slate-900 p-2 rounded border border-slate-100 dark:border-slate-800">
                  <span className="text-slate-400 block text-[10px]">Recall</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {((telemetry?.ml_models?.vendor_risk_predictor?.recall || 0.86) * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
              <span>Samples: {telemetry?.ml_models?.vendor_risk_predictor?.samples_count || 80}</span>
              <span className="text-emerald-600 font-medium">TRAINED</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── WORKSPACE VIEW TOGGLE (Validations vs Datasets) ───────────────── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSubView('validations')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              subView === 'validations'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Predictive Validations Feed ({telemetry?.recent_validations?.length || 0})
          </button>

          <button
            onClick={() => setSubView('datasets')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              subView === 'datasets'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            Enterprise Datasets Explorer
          </button>

          <button
            onClick={() => setSubView('payment_intelligence')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
              subView === 'payment_intelligence'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" />
            Multi-Mode Payment Intelligence
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-blue-700 text-white font-extrabold uppercase">
              NEW
            </span>
          </button>
        </div>

        {subView === 'validations' && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search invoice, vendor, PO..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500 w-44 sm:w-56"
              />
            </div>

            <select
              value={filterMatchStatus}
              onChange={(e) => setFilterMatchStatus(e.target.value)}
              className="py-1 px-2 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="ALL">All Matches</option>
              <option value="MATCHED">Clean Matched</option>
              <option value="QUANTITY_MISMATCH">Quantity Mismatch</option>
              <option value="PRICE_MISMATCH">Price Mismatch</option>
              <option value="DUPLICATE">Duplicate Attempt</option>
              <option value="MISSING_GRN">Missing GRN</option>
              <option value="MISSING_PO">Missing PO</option>
              <option value="MULTI_ANOMALY">Multi Anomaly</option>
            </select>

            <select
              value={filterRiskLevel}
              onChange={(e) => setFilterRiskLevel(e.target.value)}
              className="py-1 px-2 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="LOW">Low Risk</option>
              <option value="MEDIUM">Medium Risk</option>
              <option value="HIGH">High Risk</option>
            </select>
          </div>
        )}
      </div>

      {/* ── WORKSPACE VIEW A: VALIDATIONS FEED ────────────────────────────── */}
      {subView === 'validations' && (
        <div className="space-y-3">
          {filteredValidations.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-12 text-center text-slate-400">
              <AlertOctagon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-medium">No validations match the current filters</p>
              <p className="text-xs text-slate-400 mt-1">Try resetting the search query or match status dropdown.</p>
            </div>
          ) : (
            filteredValidations.map((val) => {
              const isExpanded = expandedRowId === val.id;

              let matchBadge = { bg: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800', label: '3-WAY MATCHED' };
              if (val.three_way_match_status === 'QUANTITY_MISMATCH') {
                matchBadge = { bg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800', label: `QTY MISMATCH (+${val.quantity_delta} EA)` };
              } else if (val.three_way_match_status === 'PRICE_MISMATCH') {
                matchBadge = { bg: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800', label: `PRICE MISMATCH (+INR ${val.price_delta})` };
              } else if (val.three_way_match_status === 'DUPLICATE') {
                matchBadge = { bg: 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800', label: 'DUPLICATE INVOICE' };
              } else if (val.three_way_match_status === 'MISSING_GRN') {
                matchBadge = { bg: 'bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-800', label: 'MISSING GRN' };
              } else if (val.three_way_match_status === 'MISSING_PO') {
                matchBadge = { bg: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800', label: 'MISSING PO' };
              } else if (val.three_way_match_status === 'MULTI_ANOMALY') {
                matchBadge = { bg: 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-300 dark:border-red-800', label: 'STATISTICAL ANOMALY' };
              } else if (val.three_way_match_status === '3-WAY MISMATCH' || val.three_way_match_status === 'THREE_WAY_MISMATCH' || val.three_way_match_status === 'BANK_MISMATCH') {
                matchBadge = { bg: 'bg-red-600 text-white font-bold border-red-700 shadow-sm', label: '3-WAY MISMATCH' };
              }

              let decBadge = { bg: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300', label: 'PENDING REVIEW' };
              if (val.decision_status === 'APPROVED') {
                decBadge = { bg: 'bg-emerald-600 text-white', label: 'APPROVED' };
              } else if (val.decision_status === 'REJECTED') {
                decBadge = { bg: 'bg-rose-600 text-white', label: 'REJECTED' };
              } else if (val.decision_status === 'HELD') {
                decBadge = { bg: 'bg-amber-600 text-white', label: 'ON HOLD' };
              }

              return (
                <div
                  key={val.id}
                  className={`bg-white dark:bg-slate-900 border rounded-xl transition-all shadow-sm ${
                    val.risk_level === 'HIGH'
                      ? 'border-red-300 dark:border-red-900/60'
                      : val.risk_level === 'MEDIUM'
                      ? 'border-amber-300 dark:border-amber-900/60'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-white text-sm font-mono">
                          {val.invoice_number}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${matchBadge.bg}`}>
                          {matchBadge.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${decBadge.bg}`}>
                          {decBadge.label}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {val.vendor_name} ({val.vendor_code})
                        </span>
                        {val.po_number && (
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            PO: {val.po_number}
                          </span>
                        )}
                        {val.grn_number && (
                          <span className="font-mono text-slate-500 dark:text-slate-400">
                            GRN: {val.grn_number}
                          </span>
                        )}
                      </div>

                      {/* 4 ML Model Inferences Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                          Doc: {val.doc_classification_label} ({(val.doc_classification_confidence * 100).toFixed(0)}%)
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          val.invoice_risk_prediction === 'HIGH'
                            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                        }`}>
                          Inv Risk: {val.invoice_risk_prediction}
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          val.anomaly_prediction === 'ANOMALY'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200'
                            : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                        }`}>
                          Anomaly: {val.anomaly_prediction} ({(val.anomaly_score * 100).toFixed(0)}%)
                        </span>
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          val.vendor_risk_prediction === 'HIGH'
                            ? 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                        }`}>
                          Vendor: {val.vendor_risk_prediction}
                        </span>
                      </div>
                    </div>

                    {/* Risk Score & Exposure Bar */}
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">
                          Composite Risk
                        </div>
                        <div className="flex items-baseline justify-end gap-1">
                          <span className={`text-xl font-black ${
                            val.risk_level === 'HIGH'
                              ? 'text-red-600 dark:text-red-400'
                              : val.risk_level === 'MEDIUM'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}>
                            {val.composite_risk_score}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold">/100</span>
                        </div>
                        <div className="text-[10px] text-slate-500 font-medium">
                          Exposure: {formatINR(val.financial_exposure)}
                        </div>
                      </div>

                      {/* Manager Decision Buttons */}
                      <div className="flex items-center gap-1.5 pl-2 border-l border-slate-100 dark:border-slate-800">
                        <button
                          onClick={() => openDecisionModal(val, 'approve')}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 transition-colors"
                          title="Approve for payment"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => openDecisionModal(val, 'hold')}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/50 dark:hover:bg-amber-900/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800 transition-colors"
                          title="Place on hold"
                        >
                          Hold
                        </button>
                        <button
                          onClick={() => openDecisionModal(val, 'reject')}
                          className="px-2.5 py-1.5 text-xs font-semibold rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/50 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 transition-colors"
                          title="Reject invoice"
                        >
                          Reject
                        </button>

                        <button
                          onClick={() => setExpandedRowId(isExpanded ? null : val.id)}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                          title="Toggle details"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Evidence & Recommendations */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 rounded-b-xl space-y-3">
                      <div>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
                          Audited Supporting Evidence ({val.supporting_evidence.length})
                        </div>
                        {val.supporting_evidence.length === 0 ? (
                          <div className="text-xs text-slate-500 italic">No discrepancy evidence recorded. Clean match.</div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {val.supporting_evidence.map((ev, eIdx) => (
                              <div
                                key={eIdx}
                                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded p-2.5 text-xs space-y-1"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-semibold text-slate-900 dark:text-white flex items-center gap-1">
                                    <AlertCircle className={`w-3.5 h-3.5 ${
                                      ev.severity === 'CRITICAL' ? 'text-red-500' : 'text-amber-500'
                                    }`} />
                                    {ev.category}
                                  </span>
                                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase ${
                                    ev.severity === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {ev.severity}
                                  </span>
                                </div>
                                <p className="text-slate-600 dark:text-slate-300 text-[11px]">{ev.description}</p>
                                <div className="text-[10px] text-slate-400 font-mono pt-0.5">
                                  Observed: <span className="text-slate-700 dark:text-slate-300 font-medium">{String(ev.observed_value)}</span> &bull; Expected: <span className="text-slate-700 dark:text-slate-300 font-medium">{String(ev.expected_value)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Actionable Recommendations
                        </div>
                        <ul className="space-y-1">
                          {val.recommendations.map((rec, rIdx) => (
                            <li key={rIdx} className="text-xs text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                              <span className="text-blue-500 font-bold">&bull;</span>
                              <span>{rec}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {val.decisions && val.decisions.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-blue-500" />
                            Manager Governance Audit History
                          </div>
                          <div className="space-y-1">
                            {val.decisions.map((dec) => (
                              <div
                                key={dec.id}
                                className="text-[11px] bg-slate-100 dark:bg-slate-800 p-2 rounded flex items-center justify-between text-slate-600 dark:text-slate-300"
                              >
                                <div>
                                  <span className="font-bold uppercase text-slate-900 dark:text-white mr-2">[{dec.action}]</span>
                                  <span>{dec.manager_remarks}</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-mono">By {dec.user_id}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── WORKSPACE VIEW B: DATASETS EXPLORER ───────────────────────────── */}
      {subView === 'datasets' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                Hardcoded Synthetic Enterprise Dataset ({telemetry?.batch_name || 'Q1 Batch'})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ground-truth enterprise records across Purchase Orders, Warehouse GRNs, Invoices, and Vendor Master
              </p>
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
              <button
                onClick={() => setDatasetSubTab('invoices')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  datasetSubTab === 'invoices'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Invoices ({datasets?.invoices?.length || 0})
              </button>

              <button
                onClick={() => setDatasetSubTab('pos')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  datasetSubTab === 'pos'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Purchase Orders ({datasets?.purchase_orders?.length || 0})
              </button>

              <button
                onClick={() => setDatasetSubTab('grns')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  datasetSubTab === 'grns'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Goods Receipts ({datasets?.goods_receipt_notes?.length || 0})
              </button>

              <button
                onClick={() => setDatasetSubTab('vendors')}
                className={`px-3 py-1 text-xs font-semibold rounded transition-colors ${
                  datasetSubTab === 'vendors'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                Vendors ({datasets?.vendor_master?.length || 0})
              </button>
            </div>
          </div>

          {/* Invoices Table */}
          {datasetSubTab === 'invoices' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5">Invoice #</th>
                    <th className="p-2.5">PO Ref</th>
                    <th className="p-2.5">Vendor Name</th>
                    <th className="p-2.5">Subtotal</th>
                    <th className="p-2.5">Tax (GST)</th>
                    <th className="p-2.5">Total Amount</th>
                    <th className="p-2.5">Bank Account & IFSC</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(datasets?.invoices || []).map((inv) => (
                    <tr key={inv.invoice_number} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">{inv.invoice_number}</td>
                      <td className="p-2.5 font-mono text-slate-500">{inv.po_number || '—'}</td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{inv.vendor_name}</td>
                      <td className="p-2.5 font-mono">{formatINR(inv.subtotal_amount)}</td>
                      <td className="p-2.5 font-mono text-slate-500">{formatINR(inv.tax_amount)}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">{formatINR(inv.total_amount)}</td>
                      <td className="p-2.5 font-mono text-[11px] text-slate-500">
                        {inv.bank_account_number ? `${inv.bank_account_number} (${inv.ifsc_code})` : '—'}
                      </td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {inv.payment_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Purchase Orders Table */}
          {datasetSubTab === 'pos' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5">PO Number</th>
                    <th className="p-2.5">Vendor</th>
                    <th className="p-2.5">Department</th>
                    <th className="p-2.5">Issue Date</th>
                    <th className="p-2.5">Due Date</th>
                    <th className="p-2.5">Total Amount</th>
                    <th className="p-2.5">Line Items Count</th>
                    <th className="p-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(datasets?.purchase_orders || []).map((po) => (
                    <tr key={po.po_number} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">{po.po_number}</td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{po.vendor_name}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{po.department}</td>
                      <td className="p-2.5 font-mono text-slate-500">{po.issue_date}</td>
                      <td className="p-2.5 font-mono text-slate-500">{po.delivery_due_date}</td>
                      <td className="p-2.5 font-mono font-bold text-slate-900 dark:text-white">{formatINR(po.total_amount)}</td>
                      <td className="p-2.5 font-mono">{po.items?.length || 0} items</td>
                      <td className="p-2.5">
                        <span className="px-2 py-0.5 text-[9px] font-bold rounded bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                          {po.approval_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Goods Receipt Notes Table */}
          {datasetSubTab === 'grns' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5">GRN Number</th>
                    <th className="p-2.5">PO Ref</th>
                    <th className="p-2.5">Warehouse</th>
                    <th className="p-2.5">Carrier</th>
                    <th className="p-2.5">Received Qty</th>
                    <th className="p-2.5">Accepted Qty</th>
                    <th className="p-2.5">Rejected Qty</th>
                    <th className="p-2.5">QC Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(datasets?.goods_receipt_notes || []).map((grn) => (
                    <tr key={grn.grn_number} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">{grn.grn_number}</td>
                      <td className="p-2.5 font-mono text-slate-500">{grn.po_number}</td>
                      <td className="p-2.5 text-slate-600 dark:text-slate-400">{grn.warehouse_id}</td>
                      <td className="p-2.5 text-slate-500">{grn.carrier_name || 'Direct'}</td>
                      <td className="p-2.5 font-mono">{grn.received_quantity}</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{grn.accepted_quantity}</td>
                      <td className="p-2.5 font-mono font-bold text-rose-600 dark:text-rose-400">{grn.rejected_quantity}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded ${
                          grn.quality_inspection_status === 'PASSED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}>
                          {grn.quality_inspection_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Vendor Master Table */}
          {datasetSubTab === 'vendors' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="p-2.5">Vendor Code</th>
                    <th className="p-2.5">Name</th>
                    <th className="p-2.5">Category</th>
                    <th className="p-2.5">GSTIN</th>
                    <th className="p-2.5">Registered Bank</th>
                    <th className="p-2.5">Fill Rate</th>
                    <th className="p-2.5">Discrepancies</th>
                    <th className="p-2.5">Risk Rating</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {(datasets?.vendor_master || []).map((v) => (
                    <tr key={v.vendor_code} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                      <td className="p-2.5 font-bold font-mono text-slate-900 dark:text-white">{v.vendor_code}</td>
                      <td className="p-2.5 font-medium text-slate-800 dark:text-slate-200">{v.vendor_name}</td>
                      <td className="p-2.5 text-slate-500">{v.category}</td>
                      <td className="p-2.5 font-mono text-slate-500">{v.gst_number || '—'}</td>
                      <td className="p-2.5 font-mono text-slate-500">{v.registered_bank_account} ({v.registered_ifsc})</td>
                      <td className="p-2.5 font-mono font-bold text-emerald-600 dark:text-emerald-400">{v.delivery_fill_rate}%</td>
                      <td className="p-2.5 font-mono">{v.discrepancy_count}</td>
                      <td className="p-2.5">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${
                          v.risk_label === 'LOW'
                            ? 'bg-emerald-100 text-emerald-700'
                            : v.risk_label === 'MEDIUM'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-rose-100 text-rose-700'
                        }`}>
                          {v.risk_label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── SUBVIEW 3: MULTI-MODE PAYMENT INTELLIGENCE ──────────────────────── */}
      {subView === 'payment_intelligence' && (
        <MultiModePaymentIntelligenceView onBackToValidations={() => setSubView('validations')} />
      )}

      {/* ── BILL UPLOAD & 3-WAY RECONCILIATION MODAL ───────────────────────── */}
      {uploadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-3xl w-full shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <UploadCloud className="w-5 h-5 text-blue-600" />
                  Bill Document Upload & Predictive 3-Way Match
                </h3>
                <p className="text-xs text-slate-500">
                  Upload invoice document or pick a scenario. PaddleOCR extracts billing data, reconciles with PO/GRN, and predicts risk.
                </p>
              </div>
              <button
                onClick={() => setUploadModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Upload Method Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
              <button
                onClick={() => setUploadSourceMode('sample')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  uploadSourceMode === 'sample'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                1-Click Sample Invoices
              </button>
              <button
                onClick={() => setUploadSourceMode('file')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  uploadSourceMode === 'file'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Upload File (Image / PDF / Text)
              </button>
              <button
                onClick={() => setUploadSourceMode('text')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  uploadSourceMode === 'text'
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                }`}
              >
                Paste Invoice Text
              </button>
            </div>

            {/* Mode 1: 1-Click Sample Invoices */}
            {uploadSourceMode === 'sample' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sampleBills.map((s, idx) => (
                    <button
                      key={idx}
                      onClick={() => setBillTextPayload(s.text)}
                      className={`text-left p-3 rounded-lg border transition-all ${
                        billTextPayload === s.text
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-950/20 ring-1 ring-blue-500'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-900 dark:text-white">{s.label}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${s.color}`}>
                          {s.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 font-mono">
                        {s.text.split('\n').slice(0, 3).join(' • ')}
                      </p>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Bill Raw Content (OCR input):
                  </label>
                  <textarea
                    rows={4}
                    value={billTextPayload}
                    onChange={(e) => setBillTextPayload(e.target.value)}
                    className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Mode 2: File Upload */}
            {uploadSourceMode === 'file' && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-6 text-center hover:border-blue-500 transition-colors">
                  <UploadCloud className="w-10 h-10 text-slate-400 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Drag and drop your Invoice image or PDF here
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Supports PNG, JPG, JPEG, PDF, TXT. PaddleOCR extracts text automatically.
                  </p>
                  <input
                    type="file"
                    accept=".png,.jpg,.jpeg,.pdf,.txt,.csv"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setUploadedFile(e.target.files[0]);
                      }
                    }}
                    className="mt-3 text-xs"
                  />
                  {uploadedFile && (
                    <div className="mt-2 text-xs text-blue-600 dark:text-blue-400 font-semibold">
                      Selected: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(1)} KB)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Mode 3: Text Paste */}
            {uploadSourceMode === 'text' && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Paste Raw Invoice / Bill Text:
                </label>
                <textarea
                  rows={6}
                  value={billTextPayload}
                  onChange={(e) => setBillTextPayload(e.target.value)}
                  placeholder="Paste scanned OCR text, invoice line items, PO numbers, amounts..."
                  className="w-full text-xs font-mono rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Action Button */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-[11px] text-slate-500">
                Uses PaddleOCR & Bull 3-Way Reconciliation
              </span>
              <button
                onClick={handleExtractAndMatch}
                disabled={uploadingBill}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md disabled:opacity-50"
              >
                {uploadingBill ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Extracting & Reconciling...
                  </>
                ) : (
                  <>
                    <FileSearch className="w-3.5 h-3.5" />
                    EXTRACT WITH OCR & 3-WAY MATCH
                  </>
                )}
              </button>
            </div>

            {/* Results Section inside Modal */}
            {uploadResult && (
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
                <div className="border rounded-lg p-3 text-xs flex items-center justify-between bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200">
                  <span className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {uploadResult.message}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-white dark:bg-slate-900 border-emerald-300 text-emerald-800 dark:text-emerald-300">
                    Source: {uploadResult.extracted_bill.extraction_source} &bull; Conf: {(uploadResult.extracted_bill.ocr_confidence * 100).toFixed(0)}%
                  </span>
                </div>

                {/* Extracted Details & Comparison Table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Extracted Bill Details */}
                  <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-lg space-y-1.5 border border-slate-200 dark:border-slate-700">
                    <div className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center justify-between">
                      <span>Extracted Bill Data</span>
                      <span className="font-mono text-blue-600 dark:text-blue-400">{uploadResult.extracted_bill.invoice_number}</span>
                    </div>
                    <div>Vendor: <span className="font-medium text-slate-800 dark:text-slate-200">{uploadResult.extracted_bill.vendor_name} ({uploadResult.extracted_bill.vendor_code})</span></div>
                    <div>Referenced PO: <span className="font-mono font-medium">{uploadResult.extracted_bill.po_number || 'None'}</span></div>
                    <div>Billed Total: <span className="font-bold font-mono text-slate-900 dark:text-white">{formatINR(uploadResult.extracted_bill.total_amount)}</span></div>
                    <div>Bank Account: <span className="font-mono text-[11px]">{uploadResult.extracted_bill.bank_account_number || 'N/A'} ({uploadResult.extracted_bill.ifsc_code || 'N/A'})</span></div>
                    <div>Line Items Count: <span className="font-mono">{uploadResult.extracted_bill.items.length} item(s)</span></div>
                    <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                      <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 flex items-center justify-between">
                        <span>Directed Person's Ledger:</span>
                        <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{formatINR(uploadResult.extracted_bill.total_amount)}</span>
                      </div>
                      <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300">
                        Sundry Creditors — {uploadResult.extracted_bill.vendor_name} ({uploadResult.extracted_bill.vendor_code})
                      </div>
                      <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3 inline shrink-0" />
                        Requires explicit user permission before posting changes to ledger
                      </div>
                    </div>
                  </div>

                  {/* 3-Way Match Comparison */}
                  <div className={`p-3.5 rounded-lg space-y-1.5 border transition-all ${
                    uploadResult.validation_result.three_way_match_status === 'MATCHED'
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-400 dark:border-emerald-700 shadow-sm'
                      : 'bg-red-50/50 dark:bg-red-950/20 border-red-300 dark:border-red-800 shadow-sm'
                  }`}>
                    <div className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700 pb-1 flex items-center justify-between">
                      <span>3-Way Verification Status</span>
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded uppercase shadow-sm ${
                        uploadResult.validation_result.three_way_match_status === 'MATCHED'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-red-600 text-white'
                      }`}>
                        {uploadResult.validation_result.three_way_match_status === 'MATCHED'
                          ? '3-WAY MATCHED'
                          : uploadResult.validation_result.three_way_match_status === '3-WAY MISMATCH' || uploadResult.validation_result.three_way_match_status === 'THREE_WAY_MISMATCH'
                          ? '3-WAY MISMATCH'
                          : uploadResult.validation_result.three_way_match_status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div>
                      Quantity Verification: <span className={`font-semibold ${
                        uploadResult.three_way_comparison.quantity_status.startsWith('MATCHED')
                          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-red-700 dark:text-red-400 font-bold'
                      }`}>{uploadResult.three_way_comparison.quantity_status}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Billed: {uploadResult.three_way_comparison.billed_quantity} EA vs GRN Accepted: {uploadResult.three_way_comparison.accepted_quantity} EA</span>
                    </div>
                    <div>
                      Unit Price Verification: <span className={`font-semibold ${
                        uploadResult.three_way_comparison.price_status.startsWith('MATCHED')
                          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-red-700 dark:text-red-400 font-bold'
                      }`}>{uploadResult.three_way_comparison.price_status}</span>
                      <span className="text-[10px] text-slate-400 block font-mono">Billed: INR {uploadResult.three_way_comparison.billed_unit_price} vs PO Rate: INR {uploadResult.three_way_comparison.contract_unit_price}</span>
                    </div>
                    <div>
                      Bank Account Match: <span className={`font-semibold ${
                        uploadResult.three_way_comparison.bank_status === 'MATCHED'
                          ? 'text-emerald-700 dark:text-emerald-300 font-bold'
                          : 'text-red-700 dark:text-red-400 font-bold'
                      }`}>
                        {uploadResult.three_way_comparison.bank_status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ML Predictions & Risk Score */}
                <div className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">ML Baseline Model Inferences:</div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 text-[10px] font-mono">
                        Class: {uploadResult.validation_result.doc_classification_label}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 text-[10px] font-mono">
                        Invoice Risk: {uploadResult.validation_result.invoice_risk_prediction}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 text-[10px] font-mono">
                        Anomaly: {uploadResult.validation_result.anomaly_prediction}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 text-[10px] font-mono">
                        Vendor Risk: {uploadResult.validation_result.vendor_risk_prediction}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Composite Risk</div>
                    <div className="text-xl font-black text-slate-900 dark:text-white">
                      {uploadResult.validation_result.composite_risk_score} <span className="text-[10px] text-slate-400 font-bold">/ 100</span>
                    </div>
                    <div className="text-[10px] font-semibold text-rose-600">
                      Disputed Exposure: {formatINR(uploadResult.validation_result.financial_exposure)}
                    </div>
                  </div>
                </div>

                {/* Modal Governance Actions */}
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setUploadModalOpen(false);
                      openDecisionModal(uploadResult.validation_result, 'approve');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white"
                  >
                    Approve Bill
                  </button>
                  <button
                    onClick={() => {
                      setUploadModalOpen(false);
                      openDecisionModal(uploadResult.validation_result, 'hold');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded bg-amber-600 hover:bg-amber-500 text-white"
                  >
                    Hold for Review
                  </button>
                  <button
                    onClick={() => {
                      setUploadModalOpen(false);
                      openDecisionModal(uploadResult.validation_result, 'reject');
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    Reject Bill
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── MANAGER GOVERNANCE DECISION MODAL ────────────────────────────── */}
      {decisionModalOpen && selectedValidation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 max-w-lg w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-slate-700 dark:text-slate-300" />
                Human Manager Decision: {decisionAction.toUpperCase()}
              </h3>
              <button
                onClick={() => setDecisionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg space-y-1">
                <div>
                  Invoice: <span className="font-bold font-mono text-slate-900 dark:text-white">{selectedValidation.invoice_number}</span>
                </div>
                <div>
                  Vendor: <span className="font-medium text-slate-800 dark:text-slate-200">{selectedValidation.vendor_name}</span>
                </div>
                <div>
                  Status: <span className="font-bold text-slate-900 dark:text-white">{selectedValidation.three_way_match_status}</span>
                </div>
                <div>
                  Composite Risk: <span className="font-bold">{selectedValidation.composite_risk_score} / 100 ({selectedValidation.risk_level})</span>
                </div>
                <div>
                  Financial Exposure: <span className="font-bold text-rose-600">{formatINR(selectedValidation.financial_exposure)}</span>
                </div>
              </div>

              {/* Person's Ledger Destination */}
              <div className="p-3 rounded-lg bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                  <span>Ledger Direction Details</span>
                  <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Amount: {formatINR(uploadResult?.extracted_bill.total_amount || 0)}
                  </span>
                </div>
                <div className="text-xs text-slate-800 dark:text-slate-200">
                  Target Ledger: <strong className="font-mono text-indigo-900 dark:text-indigo-200">Sundry Creditors — {selectedValidation.vendor_name} ({selectedValidation.vendor_code})</strong>
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  Ledger A/C: <strong>#{selectedValidation.vendor_code}</strong> &bull; Currency: <strong>INR</strong>
                </div>
              </div>

              {/* Mandatory Permission Checkpoint */}
              <div className="p-3.5 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Permission Required Before Making Changes</span>
                </div>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  The extracted amount of <strong className="font-mono">{formatINR(uploadResult?.extracted_bill.total_amount || 0)}</strong> will be directed and posted to the ledger of <strong>{selectedValidation.vendor_name}</strong>. Explicit user permission is required before any accounting entries or changes are committed.
                </p>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-900 dark:text-white cursor-pointer pt-0.5">
                  <input
                    type="checkbox"
                    checked={hasPermission}
                    onChange={(e) => setHasPermission(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                  />
                  <span>I grant authorized permission to direct {uploadResult ? formatINR(uploadResult.extracted_bill.total_amount) : 'this amount'} to the vendor's ledger and commit changes</span>
                </label>
              </div>

              <div>
                <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1">
                  Manager Remarks & Audit Justification:
                </label>
                <textarea
                  rows={2}
                  value={decisionRemarks}
                  onChange={(e) => setDecisionRemarks(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2.5 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-slate-500"
                  placeholder="Provide audit reasoning for this action..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setDecisionModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDecision}
                disabled={submittingDecision || !hasPermission}
                className={`px-4 py-2 text-xs font-bold rounded-lg text-white transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 ${
                  decisionAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-500/20'
                    : decisionAction === 'reject'
                    ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'
                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'
                }`}
              >
                {submittingDecision ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    Recording...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    Confirm & Grant Permission ({decisionAction.toUpperCase()})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
