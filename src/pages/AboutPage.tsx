import React, { useState } from 'react';
import {
  Info,
  Server,
  Cpu,
  Layers,
  ShieldCheck,
  ExternalLink,
  Workflow,
  Sparkles,
  Database,
  ArrowRight,
  Maximize2,
  RefreshCw,
  CheckCircle2,
  Boxes
} from 'lucide-react';

export const AboutPage: React.FC = () => {
  const [iframeKey, setIframeKey] = useState(0);

  const handleRefreshDiagram = () => {
    setIframeKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* 1. Header Banner */}
      <div className="p-6 rounded-2xl glass-card border border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
            Autonomous Financial Intelligence Platform
          </h1>
          <p className="text-xs sm:text-sm text-[var(--text-secondary)] max-w-3xl leading-relaxed">
            FINVORA is an enterprise financial intelligence platform delivering automated ledger integrity auditing,
            predictive 30/60/90-day cash flow forecasting with Prophet & ARIMA models, What-If liquidity stress simulation,
            and autonomous decision proposals backed by NVIDIA NIM AI and deterministic rule-engine governance.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleRefreshDiagram}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-muted)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors"
            title="Reload diagram"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reload</span>
          </button>
          <a
            href="/architecture/finvora-architecture.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-md"
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Open Diagram Fullscreen</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        </div>
      </div>

      {/* 2. Interactive Runtime Architecture Diagram (Archify Showcase) */}
      <div className="p-6 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <Workflow className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                High-Level Runtime Architecture
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Interactive runtime topology generated with Archify. Supports dark/light mode toggle, guided view chapters, and SVG/PNG export.
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Single Primary Path Active
            </span>
            <span>•</span>
            <span>Zero Unresolved Intersects</span>
          </div>
        </div>

        {/* Embedded Standalone HTML Viewer */}
        <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-inner">
          <iframe
            key={iframeKey}
            src="/architecture/finvora-architecture.html"
            title="FINVORA Runtime Architecture Diagram"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"
          />
        </div>
      </div>

      {/* 2.2 Duplicate Invoice Detection & Autonomous Approval Lifecycle (Archify Showcase) */}
      <div className="p-6 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-amber-500" />
              <h2 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                Duplicate Invoice Detection & Autonomous Approval Lifecycle
              </h2>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              End-to-end 8-stage pipeline from OCR ingestion to What-If simulation, proposal generation, manager review gate, and ledger execution.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/architecture/finvora-invoice-lifecycle.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fullscreen</span>
              <ExternalLink className="w-3 h-3 ml-0.5" />
            </a>
          </div>
        </div>

        {/* Embedded Standalone HTML Viewer */}
        <div className="relative w-full h-[620px] rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--card-bg)] shadow-inner">
          <iframe
            key={`lifecycle-${iframeKey}`}
            src="/architecture/finvora-invoice-lifecycle.html"
            title="Duplicate Invoice Detection & Autonomous Approval Lifecycle Diagram"
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin allow-popups allow-downloads"
          />
        </div>

        {/* 8-Stage Architecture Flow Cards */}
        <div className="pt-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-tertiary)] mb-3">
            Pipeline Stages & Component Support
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Step 1 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-500">Stage 1</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">PaddleOCR</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Upload & Read Invoice</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Supplier invoice of ₹6.8L uploaded; extracts supplier, invoice number, amount, and due date.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-500">Stage 2</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Pydantic · Pandas</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Validate & Store</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Checks missing or incorrect fields, corrects formatting errors, and commits with source PDF document.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-rose-500">Stage 3</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Evidence Engine</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Detect & Explain Duplicate</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Flags matching cleared invoice INV-2024-8841, renders side-by-side comparison, and explains warning.
              </p>
            </div>

            {/* Step 4 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-500">Stage 4</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Prophet · ARIMA</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Assess Financial Impact</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Audits AP disbursement schedule and departmental budget; models cash trough if both entries clear.
              </p>
            </div>

            {/* Step 5 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-purple-500">Stage 5</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">FINVORA AI</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Run What-If Scenario</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Simulates "What if we hold extra invoice #8849?", confirms runway assumptions, and calculates delta.
              </p>
            </div>

            {/* Step 6 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-500">Stage 6</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Workflow Engine</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Explain & Propose Action</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Projected cash improves by ₹6.8L; generates structured proposal PROP-2024-001 with 78.4% confidence.
              </p>
            </div>

            {/* Step 7 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">Stage 7</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Role Gate</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Manager Reviews & Decides</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Finance Manager approves hold or rejects with revision feedback, enforcing dual authorization.
              </p>
            </div>

            {/* Step 8 */}
            <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase text-emerald-500">Stage 8</span>
                <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[var(--card-bg)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">Execution Engine</span>
              </div>
              <div className="text-xs font-semibold text-[var(--text-primary)]">Apply & Track Outcome</div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Executes hold separately in AP ledger; refreshes forecast curves, dashboards, and audit history.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Architecture Specification & Components Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Client Tier */}
        <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-500">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400">
              Client Tier
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">FINVORA Web App</h3>
            <p className="text-[11px] text-[var(--text-tertiary)]">React 19 / Vite SPA</p>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 pt-1">
            <li className="flex items-start gap-1.5">
              <span className="text-sky-500 font-bold mt-0.5">•</span>
              <span>Sub-second optimistic UI with local storage cache persistence</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-sky-500 font-bold mt-0.5">•</span>
              <span>Role-based switching: Analyst (Submitter) & Manager (Approver)</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-sky-500 font-bold mt-0.5">•</span>
              <span>Recharts interactive curves & Dark/Light glassmorphism</span>
            </li>
          </ul>
        </div>

        {/* Card 2: Enterprise Core Gateway & Models */}
        <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <Server className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              Enterprise VPC
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">FastAPI & Analytics</h3>
            <p className="text-[11px] text-[var(--text-tertiary)]">REST Gateway :8000</p>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 pt-1">
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-500 font-bold mt-0.5">•</span>
              <span>Ensemble Prophet & ARIMA statistical cash forecast models</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-500 font-bold mt-0.5">•</span>
              <span>What-If parametric simulator with Monte Carlo variance</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-emerald-500 font-bold mt-0.5">•</span>
              <span>Automated duplicate invoice hash collision detection</span>
            </li>
          </ul>
        </div>

        {/* Card 3: External AI Provider */}
        <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400">
              External AI Cloud
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">NVIDIA NIM Cloud</h3>
            <p className="text-[11px] text-[var(--text-tertiary)]">Llama-3.1-70B API</p>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 pt-1">
            <li className="flex items-start gap-1.5">
              <span className="text-purple-500 font-bold mt-0.5">•</span>
              <span>Autonomous strategic recommendations in INR (₹) schema</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-purple-500 font-bold mt-0.5">•</span>
              <span>70% – 80% calibrated confidence proposal synthesis</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-purple-500 font-bold mt-0.5">•</span>
              <span>Zero-downtime deterministic rule engine fallback</span>
            </li>
          </ul>
        </div>

        {/* Card 4: Trust & Security Boundaries */}
        <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400">
              Trust Boundaries
            </span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Zero-Trust Security</h3>
            <p className="text-[11px] text-[var(--text-tertiary)]">Strict Governance</p>
          </div>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 pt-1">
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 font-bold mt-0.5">•</span>
              <span>Dual signature sign-off required for high-exposure transactions</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 font-bold mt-0.5">•</span>
              <span>Isolated SQLite ledger storage shielded in private enterprise VPC</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-amber-500 font-bold mt-0.5">•</span>
              <span>TLS encrypted webhooks for HDFC/ICICI and Zoho ERP feeds</span>
            </li>
          </ul>
        </div>
      </div>

      {/* 4. Primary Request Flow Walkthrough */}
      <div className="p-6 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-2">
          <ArrowRight className="w-4 h-4 text-amber-500" />
          Primary Financial Telemetry Flow (One Primary Path)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
            <div className="text-[10px] font-bold uppercase text-amber-500">Step 1 • Browser</div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">User Telemetry Request</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Analyst or Manager triggers scenario simulation, dashboard refresh, or proposal review.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
            <div className="text-[10px] font-bold uppercase text-amber-500">Step 2 • Gateway</div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">FastAPI Ingestion</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Validates Pydantic payloads, verifies CORS, and dispatches to analytics pipeline.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
            <div className="text-[10px] font-bold uppercase text-amber-500">Step 3 • ML Modeling</div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">Prophet & ARIMA Computation</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Computes daily projections, runway burn rates, and anomaly risk exposure.
            </p>
          </div>
          <div className="p-3.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
            <div className="text-[10px] font-bold uppercase text-amber-500">Step 4 • Ledger State</div>
            <div className="text-xs font-semibold text-[var(--text-primary)]">Ledger Sync & Persist</div>
            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Audited records and approval actions commit to the durable ledger store.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
export default AboutPage;
