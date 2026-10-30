import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wallet,
  TrendingUp,
  Receipt,
  ShieldAlert,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { KPICard } from '../components/common/KPICard';
import { ChartCard } from '../components/common/ChartCard';
import { StatusBadge } from '../components/common/StatusBadge';
import { formatINR, formatINRCompact, formatDate, formatPercent } from '../utils/formatters';

const EXPENSE_PALETTE_DARK = ['#F5A623', '#C27803', '#0D9488', '#64748B', '#8B5CF6', '#E11D48'];
const EXPENSE_PALETTE_LIGHT = ['#D97706', '#B45309', '#0F766E', '#475569', '#7C3AED', '#BE123C'];

export const OverviewPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    availableCash,
    netCashFlow30d,
    outstandingPayables,
    openCriticalRisksCount,
    forecastData,
    anomalies,
    invoices,
    budgets,
    paymentSchedule,
    duplicateHoldExecuted,
    actualTheme
  } = useFinancial();

  const [forecastHorizon, setForecastHorizon] = useState<30 | 60>(60);

  // Top attention items
  const attentionItems = anomalies.filter(a => a.status === 'open' || a.status === 'under_review').slice(0, 3);

  // Department expense allocation for donut chart
  const expenseBreakdown = budgets.map(b => ({
    name: b.department,
    value: b.spent
  }));

  const totalDepartmentSpend = budgets.reduce((acc, b) => acc + b.spent, 0);

  // Filter points for clean high-contrast forecast chart
  const chartPoints = forecastData
    .filter(p => p.dayIndex >= -14 && (p.isHistorical || p.dayIndex <= forecastHorizon))
    .filter((_, idx) => idx % (forecastHorizon === 60 ? 2 : 1) === 0)
    .map(p => ({
      date: p.date.slice(5), // MM-DD
      fullDate: p.date,
      actual: p.isHistorical ? p.actualBalance : null,
      forecast: !p.isHistorical ? p.forecastBalanceBase : null,
      upperBand: !p.isHistorical ? p.uncertaintyUpper : null,
      lowerBand: !p.isHistorical ? p.uncertaintyLower : null,
      isHistorical: p.isHistorical
    }));

  const palette = actualTheme === 'dark' ? EXPENSE_PALETTE_DARK : EXPENSE_PALETTE_LIGHT;
  const gridColor = actualTheme === 'dark' ? '#222624' : '#E2E8F0';
  const actualLineColor = actualTheme === 'dark' ? '#10B981' : '#059669';
  const forecastLineColor = actualTheme === 'dark' ? '#F5A623' : '#D97706';

  return (
    <div className="space-y-6">
      {/* 1. Compact Page Heading & Slim Attention Strip */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-[26px] font-bold tracking-tight text-[var(--text-primary)]">
              Financial Overview
            </h1>
            <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] mt-0.5">
              Your cash position, upcoming payments, and priorities.
            </p>
          </div>

        </div>

        {/* Slim Attention Strip with touch of red light when alert is active */}
        <div className={`relative overflow-hidden px-4 py-2.5 rounded-xl glass-card flex items-center justify-between gap-3 text-xs transition-all ${
          duplicateHoldExecuted
            ? 'border border-[var(--card-border)]'
            : 'border border-rose-500/35 dark:border-rose-500/45 bg-gradient-to-r from-rose-500/[0.08] via-rose-500/[0.02] to-transparent shadow-[0_0_25px_rgba(244,63,94,0.08)]'
        }`}>
          {!duplicateHoldExecuted && (
            <>
              {/* Soft red light touch in background */}
              <div className="pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-rose-500/20 dark:bg-rose-500/25 blur-xl" />
              <div className="pointer-events-none absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-rose-500/50 to-transparent" />
            </>
          )}

          <div className="relative z-10 flex items-center gap-2.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                duplicateHoldExecuted ? 'bg-emerald-400' : 'bg-rose-400'
              }`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                duplicateHoldExecuted ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]'
              }`} />
            </span>
            <span className="text-[var(--text-primary)] font-medium truncate">
              {duplicateHoldExecuted
                ? 'Payment hold enforced on duplicate #INV-2024-8849. ₹6,80,000 cash outflow successfully averted.'
                : 'Duplicate invoice #INV-2024-8849 (₹6,80,000) flagged for payment hold. Awaiting sign-off.'}
            </span>
          </div>

          <button
            onClick={() => navigate(duplicateHoldExecuted ? '/decisions-approvals' : '/risk-anomalies')}
            className={`relative z-10 text-[11px] font-semibold hover:underline shrink-0 flex items-center gap-1 ${
              duplicateHoldExecuted ? 'text-[var(--accent)]' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            <span>{duplicateHoldExecuted ? 'View Decision' : 'Review Signal'}</span>
            <ChevronRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* 2. Four Balanced KPI Cards (140-155px height) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Available Cash"
          value={formatINRCompact(availableCash)}
          subtitle="HDFC & ICICI Current Accounts"
          change={{ value: '+4.2%', isPositive: true }}
          icon={<Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          to="/cash-flow"
          exactValueTooltip={`Exact: ${formatINR(availableCash)}`}
        />

        <KPICard
          title="Net Cash Flow (30d)"
          value={netCashFlow30d >= 0 ? `+${formatINRCompact(netCashFlow30d)}` : formatINRCompact(netCashFlow30d)}
          subtitle="Inflows vs Outflows"
          change={{ value: '+12.8%', isPositive: true }}
          icon={<TrendingUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />}
          to="/financial-data"
          exactValueTooltip={`Exact: ${formatINR(netCashFlow30d)}`}
        />

        <KPICard
          title="Outstanding Payables"
          value={formatINRCompact(outstandingPayables)}
          subtitle={`${invoices.filter(i => i.status === 'pending_approval' || i.status === 'approved').length} Invoices pending release`}
          change={{ value: '-8.5%', isPositive: true }}
          icon={<Receipt className="w-4 h-4 text-sky-600 dark:text-sky-400" />}
          to="/ap-expenses"
          exactValueTooltip={`Exact: ${formatINR(outstandingPayables)}`}
        />

        <KPICard
          title="Priority Risks"
          value={`${openCriticalRisksCount} Critical`}
          subtitle={duplicateHoldExecuted ? '1 outlier under review' : 'Includes Duplicate INV-8849'}
          alertLevel={openCriticalRisksCount > 0 ? 'critical' : 'none'}
          icon={<ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400" />}
          to="/risk-anomalies"
        />
      </div>

      {/* 3. Primary Chart Row: 2:1 Split (Cash Flow Forecast + Spend by Department) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Cash Flow Forecast (2 cols) */}
        <div className="lg:col-span-2">
          <ChartCard
            title="Cash Flow Forecast"
            action={
              <div className="flex items-center gap-3 text-xs">
                {/* Horizon Switcher */}
                <div className="flex items-center p-0.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--divider)]">
                  <button
                    onClick={() => setForecastHorizon(30)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      forecastHorizon === 30
                        ? 'bg-[var(--card-bg-elevated)] text-[var(--text-primary)] shadow-xs font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    30d
                  </button>
                  <button
                    onClick={() => setForecastHorizon(60)}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                      forecastHorizon === 60
                        ? 'bg-[var(--card-bg-elevated)] text-[var(--text-primary)] shadow-xs font-semibold'
                        : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    60d
                  </button>
                </div>



                <button
                  onClick={() => navigate('/cash-flow')}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                  aria-label="View detailed Cash Flow"
                  title="View detailed Cash Flow"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            }
          >
            <div className="h-64 sm:h-72 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--text-muted)"
                    tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                    tickLine={false}
                    tickFormatter={(val) => formatINRCompact(val)}
                    domain={['auto', 'auto']}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      borderColor: 'var(--chart-tooltip-border)',
                      borderRadius: '12px',
                      color: 'var(--chart-tooltip-text)',
                      fontSize: '12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                    }}
                    formatter={(val: any) => [formatINR(Number(val)), 'Cash Balance']}
                  />
                  {/* Uncertainty Band */}
                  <Area
                    type="monotone"
                    dataKey="upperBand"
                    stroke="none"
                    fill={forecastLineColor}
                    fillOpacity={actualTheme === 'dark' ? 0.08 : 0.06}
                  />
                  {/* Historical Line */}
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke={actualLineColor}
                    strokeWidth={2.5}
                    dot={false}
                  />
                  {/* Forecast Line */}
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke={forecastLineColor}
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="mt-2.5 pt-2 border-t border-[var(--divider)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span className="text-[11px] text-[var(--text-muted)]">Historical & forward balance</span>
              <div className="flex items-center gap-1.5 font-mono text-xs">
                <span className="text-[var(--text-secondary)] font-sans text-[11px]">Lowest:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  {duplicateHoldExecuted ? '₹1.54 Cr (Day 48)' : '₹1.47 Cr (Day 48)'}
                </span>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Spend by Department Donut (1 col) */}
        <div>
          <ChartCard
            title="Spend by Department"
            action={
              <button
                onClick={() => navigate('/budget-intelligence')}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors"
                aria-label="View Budget Intelligence"
                title="View detailed budgets"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            }
          >
            <div className="h-52 w-full relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={expenseBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={78}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {expenseBreakdown.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--chart-tooltip-bg)',
                      borderColor: 'var(--chart-tooltip-border)',
                      borderRadius: '12px',
                      color: 'var(--chart-tooltip-text)',
                      fontSize: '12px'
                    }}
                    formatter={(val: any) => [formatINR(Number(val)), 'Spent MTD']}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Generous Center Opening with Total */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">
                  Total
                </span>
                <span className="text-base font-bold font-mono text-[var(--text-primary)]">
                  {formatINRCompact(totalDepartmentSpend)}
                </span>
              </div>
            </div>

            {/* Compact Legend */}
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-2 pt-2 border-t border-[var(--divider)] text-[11px]">
              {budgets.slice(0, 4).map((b, idx) => {
                const pct = ((b.spent / totalDepartmentSpend) * 100).toFixed(0);
                return (
                  <div key={b.id} className="flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: palette[idx % palette.length] }}
                    />
                    <span className="text-[var(--text-secondary)] truncate">{b.department}</span>
                    <span className="text-[var(--text-primary)] font-mono ml-auto shrink-0 font-medium">
                      {pct}%
                    </span>
                  </div>
                );
              })}
            </div>
          </ChartCard>
        </div>
      </div>

      {/* 4. Lower Dashboard: Balanced Grid of Needs Attention & Operational Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Needs Attention List (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight">
                Needs Attention
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Signals requiring review or controller decision
              </p>
            </div>
            <button
              onClick={() => navigate('/risk-anomalies')}
              className="text-xs text-[var(--accent)] hover:underline flex items-center gap-1 font-medium"
            >
              All risks ({anomalies.length}) <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2.5">
            {attentionItems.map(item => {
              const isAlert = item.severity === 'critical';
              return (
                <div
                  key={item.id}
                  onClick={() => navigate('/risk-anomalies')}
                  className={`group relative overflow-hidden p-3.5 rounded-xl glass-card glass-card-hover cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all ${
                    isAlert
                      ? 'border border-rose-500/35 dark:border-rose-500/45 bg-gradient-to-r from-rose-500/[0.07] via-rose-500/[0.02] to-transparent shadow-[0_0_20px_rgba(244,63,94,0.06)] hover:border-rose-500/60'
                      : 'border border-[var(--card-border)]'
                  }`}
                >
                  {isAlert && (
                    <>
                      <div className="pointer-events-none absolute -top-8 -left-8 w-24 h-24 rounded-full bg-rose-500/15 dark:bg-rose-500/20 blur-xl" />
                      <div className="pointer-events-none absolute top-0 left-6 right-6 h-[1px] bg-gradient-to-r from-transparent via-rose-500/40 to-transparent" />
                    </>
                  )}
                  <div className="relative z-10 space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.severity} size="sm" pulse={item.severity === 'critical'} />
                      <span className="text-xs font-semibold text-[var(--text-primary)] truncate">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] truncate">
                      Vendor: <strong className="text-[var(--text-primary)]">{item.vendorName}</strong> • Exposure: <strong className="text-rose-600 dark:text-rose-400 font-mono">{formatINR(item.estimatedExposure)}</strong>
                    </p>
                  </div>

                  <div className="relative z-10 flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono font-medium text-[var(--accent)]">
                      {item.confidenceScore}% confidence
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--surface-muted)] text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-[var(--accent)] border border-[var(--divider)] transition-colors"
                    >
                      Inspect
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Connected Recommendation Card (1 col) */}
        <div>
          <div className="p-5 rounded-2xl glass-card border border-[var(--accent-border)] bg-gradient-to-br from-[var(--card-bg)] to-[var(--accent-light)] space-y-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
              <Sparkles className="w-4 h-4" />
              <span>Copilot Recommendation</span>
            </div>

            <div>
              <h4 className="text-sm font-bold text-[var(--text-primary)] leading-snug">
                {duplicateHoldExecuted
                  ? 'Payment Hold Enforced on #INV-2024-8849'
                  : 'Enforce Immediate Hold on Duplicate Invoice #8849'}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] mt-1.5 leading-relaxed">
                {duplicateHoldExecuted
                  ? 'Disbursement blocked in banking gateway. Cash forecast reflects ₹6.8 L liquidity preservation.'
                  : 'Zenith Cloud Services submitted identical invoice #8849 (₹6,80,000) 4 days after #8841 was settled. Holding it prevents double outflow.'}
              </p>
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Exposure:</span>
                <span className="text-[var(--text-primary)] font-mono font-semibold">₹6,80,000</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Rule:</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono font-medium">RULE-AP-002</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>Action:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Payment Hold</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (duplicateHoldExecuted) {
                  navigate('/decisions-approvals');
                } else {
                  navigate('/risk-anomalies');
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-[#F59E0B] text-black hover:bg-[#D97706] transition-colors flex items-center justify-center gap-1.5 shadow-sm"
            >
              <span>{duplicateHoldExecuted ? 'View Audit Record' : 'Review Evidence & Hold'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Tertiary Row: Upcoming Payments & Budget Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Upcoming Payments */}
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Upcoming Payments
            </h3>
            <button
              onClick={() => navigate('/ap-expenses')}
              className="text-xs text-[var(--accent)] hover:underline font-medium"
            >
              View all →
            </button>
          </div>

          <div className="space-y-2">
            {paymentSchedule.slice(0, 3).map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-xs"
              >
                <div>
                  <div className="font-semibold text-[var(--text-primary)]">{item.vendorName}</div>
                  <div className="text-[11px] text-[var(--text-secondary)]">
                    Due: {item.scheduledDate} • {item.batchName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-semibold text-[var(--text-primary)]">{formatINR(item.amount)}</div>
                  <StatusBadge status={item.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Budget Overview */}
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] tracking-tight">
              Department Budgets
            </h3>
            <button
              onClick={() => navigate('/budget-intelligence')}
              className="text-xs text-[var(--accent)] hover:underline font-medium"
            >
              View all →
            </button>
          </div>

          <div className="space-y-3">
            {budgets.slice(0, 3).map(dept => {
              const pct = Math.min(100, Math.round((dept.spent / dept.allocated) * 100));
              const isOver = dept.spent > dept.allocated;

              return (
                <div key={dept.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[var(--text-primary)]">{dept.department}</span>
                    <span className={`font-mono ${isOver ? 'text-rose-600 dark:text-rose-400 font-semibold' : 'text-[var(--text-secondary)]'}`}>
                      {formatINRCompact(dept.spent)} / {formatINRCompact(dept.allocated)} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isOver ? 'bg-rose-500' : pct > 85 ? 'bg-amber-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
