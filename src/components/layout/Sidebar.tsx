import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  Database,
  ShieldAlert,
  TrendingUp,
  Receipt,
  PieChart,
  Sliders,
  CheckSquare,
  Network,
  Settings,
  Info,
  X,
  FileSpreadsheet
} from 'lucide-react';
import { useFinancial } from '../../context/FinancialContext';

import { FinvoraLogo } from '../common/FinvoraLogo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { openCriticalRisksCount, proposals, invoices, budgets } = useFinancial();

  const pendingProposalsCount = proposals.filter(p => p.status === 'pending_approval').length;
  const pendingInvoicesCount = invoices.filter(inv => inv.status === 'pending_approval').length;
  const overBudgetDepts = budgets.filter(b => b.status === 'over_budget').length;

  const navItems = [
    {
      to: '/',
      label: 'Overview',
      icon: <LayoutDashboard className="w-[18px] h-[18px] shrink-0" />
    },
    {
      to: '/financial-data',
      label: 'Financial Data',
      icon: <Database className="w-[18px] h-[18px] shrink-0" />
    },
    {
      to: '/company-ledger',
      label: 'Company Ledger',
      icon: <FileSpreadsheet className="w-[18px] h-[18px] shrink-0 text-blue-500" />
    },
    {
      to: '/risk-anomalies',
      label: 'Risk & Anomalies',
      icon: <ShieldAlert className="w-[18px] h-[18px] shrink-0" />,
      badge: openCriticalRisksCount > 0 ? `${openCriticalRisksCount}` : undefined,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/50'
    },
    {
      to: '/cash-flow',
      label: 'Cash Flow & Forecasting',
      icon: <TrendingUp className="w-[18px] h-[18px] shrink-0" />
    },
    {
      to: '/ap-expenses',
      label: 'AP & Expenses',
      icon: <Receipt className="w-[18px] h-[18px] shrink-0" />,
      badge: pendingInvoicesCount > 0 ? `${pendingInvoicesCount}` : undefined,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50'
    },
    {
      to: '/budget-intelligence',
      label: 'Budget Intelligence',
      icon: <PieChart className="w-[18px] h-[18px] shrink-0" />,
      badge: overBudgetDepts > 0 ? `${overBudgetDepts}` : undefined,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/50'
    },
    {
      to: '/what-if',
      label: 'What-If Simulator',
      icon: <Sliders className="w-[18px] h-[18px] shrink-0" />
    },
    {
      to: '/context-intelligence',
      label: 'Context Intelligence (CAFIE)',
      icon: <Brain className="w-[18px] h-[18px] shrink-0 text-indigo-500" />,
      badge: 'AI',
      badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800/50'
    },
    {
      to: '/decisions-approvals',
      label: 'Decisions & Approvals',
      icon: <CheckSquare className="w-[18px] h-[18px] shrink-0" />,
      badge: pendingProposalsCount > 0 ? `${pendingProposalsCount}` : undefined,
      badgeColor: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/50'
    }
  ];

  const bottomNavItems = [
    {
      to: '/data-connections',
      label: 'Data Connections',
      icon: <Network className="w-[18px] h-[18px] shrink-0" />
    },
    {
      to: '/about',
      label: 'About',
      icon: <Info className="w-[18px] h-[18px] shrink-0" />
    },
    {
      to: '/settings',
      label: 'Settings',
      icon: <Settings className="w-[18px] h-[18px] shrink-0" />
    }
  ];

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 dark:bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed top-0 bottom-0 left-0 z-40 w-[232px] bg-[var(--sidebar-bg)] border-r border-[var(--sidebar-border)] backdrop-blur-2xl flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Brand Header with custom Finvora logo */}
        <div>
          <div className="h-16 px-4 border-b border-[var(--sidebar-border)] flex items-center justify-between">
            <NavLink to="/" onClick={onClose} className="group flex items-center">
              <FinvoraLogo size="sm" showWordmark={true} showTagline={true} />
            </NavLink>
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] lg:hidden"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1" aria-label="Main Navigation">
            <div className="px-3 pt-2 pb-1.5 text-[11px] font-medium tracking-wider text-[var(--text-muted)] uppercase">
              Modules
            </div>
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center justify-between px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${isActive
                    ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold shadow-xs'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                  }`
                }
              >
                <div className="flex items-center gap-2.5 truncate">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge && (
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-full border ${item.badgeColor} ml-1 shrink-0`}
                  >
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Bottom Nav / Settings */}
        <div className="p-3 border-t border-[var(--sidebar-border)] space-y-1">
          {bottomNavItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${isActive
                  ? 'bg-[var(--accent-light)] text-[var(--accent)] border border-[var(--accent-border)] font-semibold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Subtle workspace footer */}
          <div className="mt-2 pt-2.5 px-3 border-t border-[var(--divider)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span className="truncate">Aethelgard Enterprise</span>
            <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">INR (₹)</span>
          </div>
        </div>
      </aside>
    </>
  );
};
