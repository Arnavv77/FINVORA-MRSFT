import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  ReferenceArea
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { KPICard } from '../components/common/KPICard';
import { ChartCard } from '../components/common/ChartCard';
import { formatINR, formatINRCompact, formatDate, formatPercent } from '../utils/formatters';
import { INITIAL_RECEIVABLES_AGING, INITIAL_PAYABLES_AGING } from '../data/mockData';
import { fetchCashForecast, simulateScenario, ForecastApiResponse } from '../lib/api';
import {
  Sparkles,
  ShieldAlert,
  CheckCircle2,
  RotateCcw,
  Play,
  Receipt,
  Building2,
  Activity,
  Layers
} from 'lucide-react';

export const CashFlowPage: React.FC = () => {
  const {
    forecastData: contextForecastData,
    availableCash,
    duplicateHoldExecuted,
    actualTheme
  } = useFinancial();

  // Horizon & Scenario Controls
  const [horizonDays, setHorizonDays] = useState<30 | 60 | 90>(30);
  const [scenarioMode, setScenarioMode] = useState<'base' | 'optimistic' | 'conservative'>('base');

  // Real API State for Baseline & Simulation
  const [baselineForecast, setBaselineForecast] = useState<ForecastApiResponse | null>(null);
  const [scenarioForecast, setScenarioForecast] = useState<ForecastApiResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // What-If Simulation Controls
  const [simType, setSimType] = useState<'delay_payment' | 'delay_receivable'>('delay_payment');
  const [delayDays, setDelayDays] = useState<number>(30);
  const [delayAmount, setDelayAmount] = useState<number>(4000000); // ₹40 Lakhs default

  // Load Real Baseline Forecast from /api/forecast on horizon change
  useEffect(() => {
    let isCancelled = false;
    async function loadForecast() {
      try {
        const data = await fetchCashForecast(horizonDays);
        if (!isCancelled) {
          setBaselineForecast(data);
          // If a scenario was previously active, clear it to avoid stale horizon mismatch
          setScenarioForecast(null);
        }
      } catch (err) {
        console.error('Failed to load forecast from API:', err);
      }
    }

    loadForecast();
    return () => {
      isCancelled = true;
    };
  }, [horizonDays]);

  // Recalculate Scenario calling real /api/simulate
  const handleRecalculateScenario = async () => {
    setIsSimulating(true);
    try {
      const res = await simulateScenario(
        [
          {
            type: simType,
            days: delayDays,
            amount: delayAmount,
          }
        ],
        horizonDays
      );
      setScenarioForecast(res);
    } catch (err) {
      console.error('Failed to simulate scenario:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Reset to Baseline
  const handleResetScenario = () => {
    setScenarioForecast(null);
  };

  // Active dataset: uses real baseline points if fetched, falling back to context
  const activeBaselinePoints = useMemo(() => {
    if (baselineForecast?.points && baselineForecast.points.length > 0) {
      return baselineForecast.points;
    }
    return contextForecastData;
  }, [baselineForecast, contextForecastData]);

  // Safe Cash Buffer from DB or env (default ₹1.00 Cr / 10M)
  const bufferAmount = baselineForecast?.buffer_amount ?? 10000000;

  // Active risk level (scenario overrides baseline if simulated)
  const currentRiskLevel = scenarioForecast?.risk_level ?? baselineForecast?.risk_level ?? 'WATCH';

  // Filter forecast points according to selected horizon & scenario
  const displayedPoints = useMemo(() => {
    const histPoints = activeBaselinePoints.filter(p => p.isHistorical);
    const futurePoints = activeBaselinePoints.filter(p => !p.isHistorical).slice(0, horizonDays);
    const combined = [...histPoints, ...futurePoints];

    // Map simulated future points if scenario is active
    const simFutureMap = new Map<string, number>();
    if (scenarioForecast?.points) {
      scenarioForecast.points
        .filter(p => !p.isHistorical)
        .forEach(p => simFutureMap.set(p.date, p.forecastBalanceBase));
    }

    return combined.map(p => {
      let chosenForecast = p.forecastBalanceBase;
      if (scenarioMode === 'optimistic') chosenForecast = p.forecastBalanceOptimistic;
      if (scenarioMode === 'conservative') chosenForecast = p.forecastBalanceConservative;

      const simVal = !p.isHistorical && simFutureMap.has(p.date)
        ? simFutureMap.get(p.date)!
        : null;

      return {
        date: p.date.slice(5),
        fullDate: p.date,
        actual: p.isHistorical ? p.actualBalance : null,
        forecast: !p.isHistorical ? chosenForecast : null,
        simulated: simVal,
        upperBand: !p.isHistorical ? p.uncertaintyUpper : null,
        lowerBand: !p.isHistorical ? p.uncertaintyLower : null,
        inflow: p.inflows,
        outflow: p.outflows,
        net: p.netCashFlow,
        isHistorical: p.isHistorical
      };
    });
  }, [activeBaselinePoints, horizonDays, scenarioMode, scenarioForecast]);

  // Stats calculation
  const stats = useMemo(() => {
    const futureOnly = displayedPoints.filter(p => !p.isHistorical && p.forecast !== null);
    let lowest = availableCash;
    let lowestDate = 'N/A';
    let shortfallDate: string | null = null;

    futureOnly.forEach(p => {
      const val = p.forecast || 0;
      if (val < lowest) {
        lowest = val;
        lowestDate = p.fullDate;
      }
      if (val < bufferAmount && !shortfallDate) {
        shortfallDate = p.fullDate;
      }
    });

    const endingCash = futureOnly.length > 0 ? (futureOnly[futureOnly.length - 1].forecast || 0) : availableCash;

    // Simulated ending cash if scenario is active
    const simEndingCash = scenarioForecast?.projected_closing_cash ?? null;

    return {
      lowest,
      lowestDate,
      shortfallDate,
      endingCash,
      simEndingCash
    };
  }, [displayedPoints, availableCash, bufferAmount, scenarioForecast]);

  // Chart domain minimum to accommodate negative dips and buffer
  const yDomainMin = useMemo(() => {
    const minVal = Math.min(stats.lowest, 0);
    return Math.floor(minVal * 1.1);
  }, [stats.lowest]);

  const gridColor = actualTheme === 'dark' ? '#222624' : '#E2E8F0';
  const actualLineColor = actualTheme === 'dark' ? '#10B981' : '#059669';
  const forecastLineColor = actualTheme === 'dark' ? '#F5A623' : '#D97706';
  const simulatedLineColor = '#F59E0B'; // goldenish yellow amber for what-if scenario

  // Risk Level styling helper
  const getRiskBadge = (level: string) => {
    switch (level) {
      case 'SAFE':
        return {
          bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
          dot: 'bg-emerald-500',
          label: 'SAFE LIQUIDITY',
          desc: 'Projected closing cash exceeds safe working capital buffer.'
        };
      case 'WATCH':
        return {
          bg: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
          dot: 'bg-amber-500',
          label: 'WATCH RESERVE',
          desc: 'Projected balance dips within 50% - 100% of minimum buffer.'
        };
      case 'HIGH_RISK':
        return {
          bg: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
          dot: 'bg-orange-500',
          label: 'HIGH RISK',
          desc: 'Projected balance falls below 50% of buffer threshold.'
        };
      case 'CRITICAL':
      default:
        return {
          bg: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
          dot: 'bg-rose-500',
          label: 'CRITICAL DEPLETION',
          desc: 'Projected cash flow enters negative deficit without intervention.'
        };
    }
  };

  const riskBadge = getRiskBadge(currentRiskLevel);

  return (
    <div className="space-y-6">
      {/* Forecast Controls Header */}
      <div className="p-5 sm:p-6 rounded-2xl glass-card border border-[var(--card-border)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            Multi-Horizon Cash-Flow & Working Capital Projections
          </h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Grounded stochastic telemetry factoring historical collections, departmental commitments, and minimum cash buffer ({formatINRCompact(bufferAmount)}).
          </p>
        </div>

        {/* Horizon & Scenario Switchers */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Horizon Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--divider)] text-xs">
            <button
              onClick={() => setHorizonDays(30)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                horizonDays === 30 ? 'bg-[#F59E0B] text-black font-bold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              30d
            </button>
            <button
              onClick={() => setHorizonDays(60)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                horizonDays === 60 ? 'bg-[#F59E0B] text-black font-bold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              60d
            </button>
            <button
              onClick={() => setHorizonDays(90)}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                horizonDays === 90 ? 'bg-[#F59E0B] text-black font-bold shadow-xs' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              90d
            </button>
          </div>

          {/* Scenario Mode Buttons */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--divider)] text-xs">
            <button
              onClick={() => setScenarioMode('conservative')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                scenarioMode === 'conservative'
                  ? 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/50 font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Conservative
            </button>
            <button
              onClick={() => setScenarioMode('base')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                scenarioMode === 'base'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50 font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Base Case
            </button>
            <button
              onClick={() => setScenarioMode('optimistic')}
              className={`px-3 py-1 rounded-lg font-medium transition-all ${
                scenarioMode === 'optimistic'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50 font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Optimistic
            </button>
          </div>
        </div>
      </div>

      {/* KPI Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Current Liquid Cash"
          value={formatINRCompact(availableCash)}
          subtitle="Cleared bank ledger balances"
          change={{ value: '+4.2%', isPositive: true }}
          exactValueTooltip={`Exact: ${formatINR(availableCash)}`}
        />

        <KPICard
          title={`Projected ${horizonDays}-Day Ending`}
          value={formatINRCompact(stats.simEndingCash ?? stats.endingCash)}
          subtitle={scenarioForecast ? `With simulated adjustment` : `Under ${scenarioMode} assumptions`}
          change={{
            value: formatPercent((((stats.simEndingCash ?? stats.endingCash) - availableCash) / availableCash) * 100),
            isPositive: (stats.simEndingCash ?? stats.endingCash) >= availableCash
          }}
          alertLevel={(stats.simEndingCash ?? stats.endingCash) < bufferAmount ? 'warning' : 'none'}
          exactValueTooltip={`Exact: ${formatINR(stats.simEndingCash ?? stats.endingCash)}`}
        />

        <KPICard
          title="Safe Cash Buffer"
          value={formatINRCompact(bufferAmount)}
          subtitle={
            (stats.simEndingCash ?? stats.endingCash) >= bufferAmount
              ? `Healthy +${formatINRCompact((stats.simEndingCash ?? stats.endingCash) - bufferAmount)} surplus`
              : `Deficit -${formatINRCompact(bufferAmount - (stats.simEndingCash ?? stats.endingCash))} below threshold`
          }
          alertLevel={(stats.simEndingCash ?? stats.endingCash) < bufferAmount ? 'critical' : 'none'}
          exactValueTooltip={`Threshold: ${formatINR(bufferAmount)}`}
        />

        <KPICard
          title="Liquidity Risk Status"
          value={riskBadge.label}
          subtitle={riskBadge.desc}
          alertLevel={currentRiskLevel === 'SAFE' ? 'none' : currentRiskLevel === 'WATCH' ? 'warning' : 'critical'}
        />
      </div>

      {/* Primary Forecast Chart with Safe Buffer and Risk Zone */}
      <ChartCard
        title={`Cash Balance Trajectory (${horizonDays} Days)`}
        action={
          <div className="flex items-center gap-2">
            {scenarioForecast && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                Scenario Active: {scenarioForecast.scenario_label}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-medium bg-[var(--surface-muted)] text-[var(--text-secondary)] capitalize border border-[var(--divider)]">
              {scenarioMode}
            </span>
          </div>
        }
      >
        <div className="h-88 w-full pt-1">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={displayedPoints} margin={{ top: 15, right: 20, left: 10, bottom: 5 }}>
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
                domain={[yDomainMin, 'auto']}
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
                formatter={(val: any, name: any) => {
                  const label =
                    name === 'actual' ? 'Actual Cash' :
                    name === 'forecast' ? `Baseline Forecast (${scenarioMode})` :
                    name === 'simulated' ? 'Simulated Scenario' :
                    'Uncertainty Bound';
                  return [formatINR(Number(val)), label];
                }}
              />

              {/* Shaded Risk Zone below Buffer Line */}
              <ReferenceArea
                y1={yDomainMin}
                y2={bufferAmount}
                fill="#EF4444"
                fillOpacity={actualTheme === 'dark' ? 0.07 : 0.04}
              />

              {/* Horizontal Minimum Safe Cash Buffer Line */}
              <ReferenceLine
                y={bufferAmount}
                stroke="#EF4444"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Min Safe Buffer (${formatINRCompact(bufferAmount)})`,
                  position: 'insideTopLeft',
                  fill: '#EF4444',
                  fontSize: 11,
                  fontWeight: 600
                }}
              />

              {/* Uncertainty Band */}
              <Area
                type="monotone"
                dataKey="upperBand"
                stroke="none"
                fill={forecastLineColor}
                fillOpacity={actualTheme === 'dark' ? 0.08 : 0.06}
              />

              {/* Historical Actuals Line */}
              <Line
                type="monotone"
                dataKey="actual"
                stroke={actualLineColor}
                strokeWidth={2.5}
                dot={false}
              />

              {/* Baseline Forecast Line */}
              <Line
                type="monotone"
                dataKey="forecast"
                stroke={forecastLineColor}
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={false}
              />

              {/* Simulated What-If Scenario Line */}
              {scenarioForecast && (
                <Line
                  type="monotone"
                  dataKey="simulated"
                  stroke={simulatedLineColor}
                  strokeWidth={2.5}
                  strokeDasharray="2 2"
                  dot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Chart Legend Footer */}
        <div className="flex flex-wrap items-center justify-between text-xs text-[var(--text-secondary)] pt-3 border-t border-[var(--divider)] mt-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: actualLineColor }} />
              Historical Actuals (Cleared Ledger)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 border-t-2 border-dashed" style={{ borderColor: forecastLineColor }} />
              Reconciled Baseline ({scenarioMode})
            </span>
            {scenarioForecast && (
              <span className="flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                <span className="w-3 h-0.5 border-t-2 border-dashed border-[#F59E0B]" />
                Simulated Adjustment
              </span>
            )}
            <span className="flex items-center gap-1.5 text-rose-500 font-medium">
              <span className="w-3 h-0.5 border-t-2 border-dashed border-rose-500" />
              Minimum Safe Buffer ({formatINRCompact(bufferAmount)})
            </span>
          </div>
          <span className="text-[11px] text-[var(--text-muted)]">
            Shaded red area indicates working capital buffer shortfall zone
          </span>
        </div>
      </ChartCard>

      {/* STEP 4: What-If Scenario Simulator Panel */}
      <div className="p-5 sm:p-6 rounded-2xl glass-card border border-[var(--card-border)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[var(--divider)]">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#F59E0B]" />
              <h3 className="text-base font-bold text-[var(--text-primary)]">
                What-If Scenario Simulator
              </h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 font-medium border border-amber-500/20">
                Live Backend Engine
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Simulate vendor payment rescheduling and customer receipt deferrals to evaluate dynamic impact on buffer health.
            </p>
          </div>

          {/* Scenario Type Selector */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--divider)] text-xs">
            <button
              onClick={() => setSimType('delay_payment')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                simType === 'delay_payment'
                  ? 'bg-[#F59E0B] text-black font-bold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Vendor Payment Delay
            </button>
            <button
              onClick={() => setSimType('delay_receivable')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                simType === 'delay_receivable'
                  ? 'bg-[#F59E0B] text-black font-bold shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Customer Receivable Delay
            </button>
          </div>
        </div>

        {/* Simulation Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {/* Deferral Days */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span>Deferral Duration</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{delayDays} Days</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="10"
                max="60"
                step="5"
                value={delayDays}
                onChange={(e) => setDelayDays(Number(e.target.value))}
                className="w-full h-2 bg-[var(--surface-muted)] rounded-lg appearance-none cursor-pointer accent-[#F59E0B]"
              />
            </div>
            <div className="flex justify-between text-[10px] text-[var(--text-muted)]">
              <span>10d</span>
              <span>30d</span>
              <span>60d</span>
            </div>
          </div>

          {/* Deferral Amount */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-[var(--text-primary)] flex items-center justify-between">
              <span>{simType === 'delay_payment' ? 'Vendor Outflow to Defer' : 'Customer Inflow Delayed'}</span>
              <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{formatINR(delayAmount)}</span>
            </label>
            <div className="flex items-center gap-2">
              {[2500000, 4000000, 6000000].map(amt => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setDelayAmount(amt)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-all ${
                    delayAmount === amt
                      ? 'border-amber-500 bg-amber-500/10 text-amber-800 dark:text-amber-300 font-bold'
                      : 'border-[var(--divider)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:border-[var(--card-border)]'
                  }`}
                >
                  {formatINRCompact(amt)}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              {simType === 'delay_payment'
                ? 'Relieves near-term outflow, preserving working capital during buffer stress.'
                : 'Models delayed client receipt, testing liquidity tolerance.'}
            </p>
          </div>

          {/* Action Buttons: Recalculate & Reset */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleRecalculateScenario}
              disabled={isSimulating}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black bg-[#F59E0B] hover:bg-[#D97706] active:scale-[0.98] transition-all disabled:opacity-50 shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isSimulating ? 'Simulating...' : 'Recalculate Scenario'}</span>
            </button>

            {scenarioForecast && (
              <button
                onClick={handleResetScenario}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] border border-[var(--divider)] transition-all"
                title="Restore exact baseline"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>

        {/* STEP 5: Baseline vs Scenario Comparison Table */}
        {scenarioForecast && baselineForecast && (
          <div className="mt-4 pt-4 border-t border-[var(--divider)] space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#F59E0B]" />
                <span>Baseline vs Scenario Audit Comparison (Two Verified API Responses)</span>
              </h4>
              <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                Impact: {formatINRCompact((scenarioForecast.projected_closing_cash ?? 0) - (baselineForecast.projected_closing_cash ?? 0))}
              </span>
            </div>

            <div className="overflow-x-auto rounded-xl border border-[var(--card-border)] bg-[var(--surface-subtle)]">
              <table className="w-full text-xs text-left">
                <thead className="bg-[var(--surface-muted)] text-[var(--text-secondary)] font-semibold border-b border-[var(--divider)]">
                  <tr>
                    <th className="py-2.5 px-4">Evaluation Metric</th>
                    <th className="py-2.5 px-4">Reconciled Baseline</th>
                    <th className="py-2.5 px-4 text-amber-600 dark:text-amber-400">Simulated Scenario</th>
                    <th className="py-2.5 px-4">Net Variance</th>
                    <th className="py-2.5 px-4">Affected Horizon Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--divider)] font-mono">
                  {/* Closing Cash */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-[var(--text-primary)]">
                      {horizonDays}-Day Projected Closing Cash
                    </td>
                    <td className="py-2.5 px-4 text-[var(--text-secondary)]">
                      {formatINR(baselineForecast.projected_closing_cash ?? 0)}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-amber-600 dark:text-amber-400">
                      {formatINR(scenarioForecast.projected_closing_cash ?? 0)}
                    </td>
                    <td className="py-2.5 px-4 font-bold">
                      {(() => {
                        const diff = (scenarioForecast.projected_closing_cash ?? 0) - (baselineForecast.projected_closing_cash ?? 0);
                        return (
                          <span className={diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {diff >= 0 ? `+${formatINR(diff)}` : formatINR(diff)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20">
                        {horizonDays}d Window AFFECTED
                      </span>
                    </td>
                  </tr>

                  {/* Liquidity Risk Level */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-[var(--text-primary)]">
                      Working Capital Risk Classification
                    </td>
                    <td className="py-2.5 px-4 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRiskBadge(baselineForecast.risk_level ?? 'WATCH').bg}`}>
                        {baselineForecast.risk_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans font-bold">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getRiskBadge(scenarioForecast.risk_level ?? 'SAFE').bg}`}>
                        {scenarioForecast.risk_level}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans font-medium text-[var(--text-primary)]">
                      {baselineForecast.risk_level} → {scenarioForecast.risk_level}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-[var(--text-secondary)] text-[11px]">
                      {scenarioForecast.risk_level === 'SAFE' && baselineForecast.risk_level !== 'SAFE'
                        ? 'Buffer Deficit Resolved'
                        : 'Simulated Trajectory Updated'}
                    </td>
                  </tr>

                  {/* Buffer Cushion */}
                  <tr>
                    <td className="py-2.5 px-4 font-sans font-medium text-[var(--text-primary)]">
                      Net Headroom Over Safe Buffer ({formatINRCompact(bufferAmount)})
                    </td>
                    <td className="py-2.5 px-4">
                      {formatINR((baselineForecast.projected_closing_cash ?? 0) - bufferAmount)}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-amber-600 dark:text-amber-400">
                      {formatINR((scenarioForecast.projected_closing_cash ?? 0) - bufferAmount)}
                    </td>
                    <td className="py-2.5 px-4 font-bold">
                      {(() => {
                        const diff = (scenarioForecast.projected_closing_cash ?? 0) - (baselineForecast.projected_closing_cash ?? 0);
                        return (
                          <span className={diff >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                            {diff >= 0 ? `+${formatINR(diff)}` : formatINR(diff)}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="py-2.5 px-4 font-sans text-[var(--text-secondary)] text-[11px]">
                      {(scenarioForecast.projected_closing_cash ?? 0) >= bufferAmount
                        ? 'Within Safe Zone'
                        : 'Below Buffer Line'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* STEP 3 & STEP 6: Risk Reasons & Recommended Actions (Grounded in Real DB Data) */}
      {(baselineForecast?.risk_reasons && baselineForecast.risk_reasons.length > 0) && (
        <div className="p-5 sm:p-6 rounded-2xl glass-card border border-amber-500/20 bg-amber-500/[0.02] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Telemetry Risk Drivers & Recommended Actions (Horizon {horizonDays}d)
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Risk Reasons Column */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Identified Cash Drain Factors
              </h4>
              <div className="space-y-2.5">
                {baselineForecast.risk_reasons.map((reason, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]">
                      <div className="flex items-center gap-1.5">
                        {reason.category === 'invoice' && <Receipt className="w-3.5 h-3.5 text-amber-500" />}
                        {reason.category === 'budget' && <Building2 className="w-3.5 h-3.5 text-rose-500" />}
                        {reason.category === 'trend' && <Activity className="w-3.5 h-3.5 text-blue-500" />}
                        <span>{reason.title}</span>
                      </div>
                      {reason.impact_amount && (
                        <span className="font-mono text-amber-600 dark:text-amber-400">
                          {formatINRCompact(reason.impact_amount)}
                        </span>
                      )}
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed">
                      {reason.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Recommended Actions Column (STEP 6: Reused from RiskAlerts table) */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
                Operational Recommendations (Reused from Active Risk Alerts)
              </h4>
              <div className="space-y-2.5">
                {baselineForecast.suggested_actions && baselineForecast.suggested_actions.length > 0 ? (
                  baselineForecast.suggested_actions.map((act, aIdx) => (
                    <div
                      key={aIdx}
                      className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-emerald-500/20 space-y-1 text-xs"
                    >
                      <div className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>Action Item #{aIdx + 1}</span>
                      </div>
                      <p className="text-[var(--text-primary)] leading-relaxed">
                        {act}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-xs text-[var(--text-secondary)]">
                    No active risk alerts requiring immediate escalation.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Aging Analysis: Receivables vs Payables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Receivables Aging */}
        <div className="p-5 sm:p-6 rounded-2xl glass-card space-y-4 border border-[var(--card-border)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Receivables Aging (Inflows)</h3>
              <p className="text-xs text-[var(--text-secondary)]">Total outstanding client receipts: ₹2.20 Cr</p>
            </div>
            <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 font-semibold">92% Collectible</span>
          </div>

          <div className="space-y-3">
            {INITIAL_RECEIVABLES_AGING.map(bucket => (
              <div key={bucket.range} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{bucket.range} ({bucket.count} Invoices)</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{formatINR(bucket.amount)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full"
                    style={{ width: `${bucket.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Payables Aging */}
        <div className="p-5 sm:p-6 rounded-2xl glass-card space-y-4 border border-[var(--card-border)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Payables Aging (Outflows)</h3>
              <p className="text-xs text-[var(--text-secondary)]">Total committed vendor liabilities: ₹1.49 Cr</p>
            </div>
            <span className="text-xs font-mono text-amber-600 dark:text-amber-400 font-semibold">DSO: 28 Days</span>
          </div>

          <div className="space-y-3">
            {INITIAL_PAYABLES_AGING.map(bucket => (
              <div key={bucket.range} className="space-y-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[var(--text-secondary)]">{bucket.range} ({bucket.count} Invoices)</span>
                  <span className="font-mono font-semibold text-[var(--text-primary)]">{formatINR(bucket.amount)}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                  <div
                    className="h-full bg-[#F59E0B] rounded-full"
                    style={{ width: `${bucket.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Forecast Drivers & Assumptions Box */}
      <div className="p-5 rounded-2xl glass-card border border-[var(--card-border)] space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--accent)] flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Underlying Telemetry & Modeling Drivers</span>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-[var(--text-secondary)]">
          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1">
            <span className="font-semibold text-[var(--text-primary)] block">Collections Cadence</span>
            <p>Enterprise customer contracts adhere to Net-30 payment terms with 8% historical variance delay in Q3.</p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1">
            <span className="font-semibold text-[var(--text-primary)] block">Bi-Monthly Payroll Clustering</span>
            <p>Fixed workforce disbursements of ₹42,00,000 scheduled on the 1st and 15th of each calendar month.</p>
          </div>
          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1">
            <span className="font-semibold text-[var(--text-primary)] block">Safe Buffer Telemetry</span>
            <p>
              Dynamic safe cash buffer set to {formatINR(bufferAmount)}. Closing cash of {formatINR(stats.simEndingCash ?? stats.endingCash)} currently establishes a {currentRiskLevel} liquidity stance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
