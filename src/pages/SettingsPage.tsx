import React, { useState } from 'react';
import {
  Settings,
  ShieldCheck,
  Building,
  User,
  Sliders,
  RotateCcw,
  Sparkles,
  Save,
  CheckCircle2,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const {
    role,
    setRole,
    workspaceName,
    resetDemoData,
    showToast,
    themeMode,
    setThemeMode,
    actualTheme
  } = useFinancial();

  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [duplicateConfidenceThreshold, setDuplicateConfidenceThreshold] = useState(85);
  const [outlierSigma, setOutlierSigma] = useState(3.0);
  const [deptOverrunThreshold, setDeptOverrunThreshold] = useState(105);

  const handleSaveSettings = () => {
    showToast('Platform settings saved successfully', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Enterprise Governance & Policy Parameters
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl mt-1">
            Configure appearance modes, risk detection sensitivities, currency conventions, and user role simulation.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-md shrink-0"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Dedicated Appearance & Theme Settings Card */}
      <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Sun className="w-4 h-4 text-amber-500" />
              <span>Appearance & Theme System</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Select your preferred appearance mode. Changes apply instantly across all seven modules and persist in your browser.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[var(--text-secondary)] px-2.5 py-1 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
            Active: <strong className="text-amber-500 capitalize">{actualTheme}</strong> {themeMode === 'system' ? '(Auto)' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Light Mode */}
          <div
            onClick={() => setThemeMode('light')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              themeMode === 'light'
                ? 'bg-amber-500/15 border-amber-500 shadow-sm'
                : 'bg-[var(--card-bg-elevated)] border-[var(--border-subtle)] hover:border-amber-500/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                    <Sun className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-[var(--text-primary)]">Light Mode</span>
                </div>
                {themeMode === 'light' && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Crisp white canvas with clearly visible frosted glassmorphism, refined contrast, and soft ambient shadows.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[var(--divider)] flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <span className="w-2 h-2 rounded-full bg-stone-100 border border-stone-300" />
              <span>White #F8F9FA • Deep bronze & amber</span>
            </div>
          </div>

          {/* Dark Mode */}
          <div
            onClick={() => setThemeMode('dark')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              themeMode === 'dark'
                ? 'bg-amber-500/15 border-amber-500 shadow-sm'
                : 'bg-[var(--card-bg-elevated)] border-[var(--border-subtle)] hover:border-amber-500/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                    <Moon className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-[var(--text-primary)]">Dark Mode</span>
                </div>
                {themeMode === 'dark' && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Smoked charcoal interface with layered glass depth, fine borders, and warm amber emphasis.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[var(--divider)] flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <span className="w-2 h-2 rounded-full bg-stone-900 border border-stone-700" />
              <span>Charcoal #101110 • Smoked glass</span>
            </div>
          </div>

          {/* System Mode */}
          <div
            onClick={() => setThemeMode('system')}
            className={`p-4 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
              themeMode === 'system'
                ? 'bg-amber-500/15 border-amber-500 shadow-sm'
                : 'bg-[var(--card-bg-elevated)] border-[var(--border-subtle)] hover:border-amber-500/40'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <span className="font-bold text-xs text-[var(--text-primary)]">System Preference</span>
                </div>
                {themeMode === 'system' && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Automatically adapts to your operating system or browser theme preference in real-time.
              </p>
            </div>
            <div className="mt-3 pt-2 border-t border-[var(--divider)] flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)]">
              <span>Resolves to: <strong className="text-[var(--text-primary)] capitalize">{actualTheme}</strong></span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workspace & Entity Details */}
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Building className="w-4 h-4 text-amber-500" />
            <span>Enterprise Workspace Details</span>
          </h3>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Legal Entity Name:</label>
              <input
                type="text"
                defaultValue={workspaceName}
                disabled
                className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] opacity-80"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Corporate GSTIN:</label>
                <input
                  type="text"
                  defaultValue="29AABCA9912L1ZP"
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs font-mono text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Reporting Currency:</label>
                <input
                  type="text"
                  defaultValue="INR (₹) - Indian Rupee"
                  disabled
                  className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] opacity-80"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] text-[var(--text-secondary)] block mb-1">Active Fiscal Year:</label>
              <input
                type="text"
                defaultValue="FY 2024-25 (01 Apr 2024 - 31 Mar 2025)"
                className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Demo Role Switcher Card */}
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <User className="w-4 h-4 text-amber-500" />
            <span>Interactive Demo Role Switcher</span>
          </h3>

          <p className="text-xs text-[var(--text-secondary)]">
            Switch roles to test role-based permissions in the decisions and approval center:
          </p>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <div
              onClick={() => setRole('analyst')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                role === 'analyst'
                  ? 'bg-amber-500/15 border-amber-500'
                  : 'bg-[var(--card-bg-elevated)] border-[var(--border-subtle)] hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[var(--text-primary)]">Finance Analyst</span>
                {role === 'analyst' && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Can review telemetry, investigate anomalies, and draft proposals for review.
              </p>
            </div>

            <div
              onClick={() => setRole('manager')}
              className={`p-4 rounded-xl border cursor-pointer transition-all ${
                role === 'manager'
                  ? 'bg-amber-500/15 border-amber-500'
                  : 'bg-[var(--card-bg-elevated)] border-[var(--border-subtle)] hover:border-amber-500/40'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-xs text-[var(--text-primary)]">Finance Manager</span>
                {role === 'manager' && <CheckCircle2 className="w-4 h-4 text-amber-500" />}
              </div>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Has sign-off and approval authority to approve or reject consequential proposals.
              </p>
            </div>
          </div>
        </div>

        {/* Anomaly Detection Sensitivities */}
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Sliders className="w-4 h-4 text-amber-500" />
            <span>AI Risk Engine Sensitivities</span>
          </h3>

          <div className="space-y-4 text-xs">
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[var(--text-primary)]">Duplicate Hash Match Confidence Threshold:</span>
                <span className="font-mono text-amber-500 font-bold">{duplicateConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="70"
                max="99"
                value={duplicateConfidenceThreshold}
                onChange={(e) => setDuplicateConfidenceThreshold(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[var(--text-primary)]">Outlier Spike Sigma (Standard Deviations):</span>
                <span className="font-mono text-amber-500 font-bold">{outlierSigma} σ</span>
              </div>
              <input
                type="range"
                min="1.5"
                max="4.0"
                step="0.1"
                value={outlierSigma}
                onChange={(e) => setOutlierSigma(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[var(--text-primary)]">Department Spend Circuit Breaker Threshold:</span>
                <span className="font-mono text-amber-500 font-bold">{deptOverrunThreshold}%</span>
              </div>
              <input
                type="range"
                min="95"
                max="120"
                value={deptOverrunThreshold}
                onChange={(e) => setDeptOverrunThreshold(Number(e.target.value))}
                className="w-full accent-amber-500"
              />
            </div>
          </div>
        </div>

        {/* Reset Demo Data Card */}
        <div className="p-5 rounded-2xl glass-card space-y-4 border-rose-500/30">
          <h3 className="text-sm font-bold text-rose-600 dark:text-rose-300 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-500" />
            <span>Reset Demo Workspace Data</span>
          </h3>

          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            Re-initializes all local state: restores duplicate invoice #INV-2024-8849, clears executed payment holds, resets department budgets, and restores the original cash forecast.
          </p>

          <button
            onClick={() => setIsResetConfirmOpen(true)}
            className="w-full py-2.5 rounded-xl text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
          >
            Reset All Demo Data
          </button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={resetDemoData}
        title="Reset Entire Demo Workspace?"
        message="This will reset all invoices, anomalies, budget transfers, and saved scenarios back to pristine hackathon demo state."
        confirmLabel="Reset Everything"
        type="warning"
      />
    </div>
  );
};
