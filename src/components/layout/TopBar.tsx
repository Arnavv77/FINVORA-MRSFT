import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  MessageSquare,
  Sparkles,
  Bell,
  Sun,
  Moon,
  Calendar,
  Building2,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  User,
  Settings,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { useFinancial } from '../../context/FinancialContext';
import { ConfirmDialog } from '../common/ConfirmDialog';

import { FinvoraLogo } from '../common/FinvoraLogo';

interface TopBarProps {
  onOpenSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSidebar }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    role,
    setRole,
    workspaceName,
    dateRange,
    setDateRange,
    copilotOpen,
    setCopilotOpen,
    resetDemoData,
    anomalies,
    openCriticalRisksCount,
    actualTheme,
    toggleTheme,
    logout
  } = useFinancial();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  // Map route to clean title
  const getPageTitle = (pathname: string) => {
    switch (pathname) {
      case '/':
        return 'Overview';
      case '/financial-data':
        return 'Financial Data';
      case '/risk-anomalies':
        return 'Risk & Anomalies';
      case '/cash-flow':
        return 'Cash Flow & Forecasting';
      case '/ap-expenses':
        return 'AP & Expenses';
      case '/budget-intelligence':
        return 'Budget Intelligence';
      case '/what-if':
        return 'What-If Simulator';
      case '/decisions-approvals':
        return 'Decisions & Approvals';
      case '/data-connections':
        return 'Data Connections';
      case '/about':
        return 'About & Architecture';
      case '/settings':
        return 'Settings';
      default:
        return 'FINVORA';
    }
  };

  const currentTitle = getPageTitle(location.pathname);

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-[var(--topbar-bg)] backdrop-blur-xl border-b border-[var(--topbar-border)] px-4 sm:px-6 flex items-center justify-between gap-3 transition-colors">
        {/* Left: Brand Logo + Page Title */}
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div 
            onClick={() => navigate('/')} 
            className="cursor-pointer flex items-center hover:opacity-90 transition-opacity"
            title="Go to Overview"
          >
            <FinvoraLogo showWordmark={true} size="sm" />
          </div>

          <div className="h-4 w-px bg-[var(--divider)] hidden sm:block" />

          <div className="flex items-center gap-2 truncate">
            <span className="text-[15px] font-semibold text-[var(--text-primary)] tracking-tight truncate">
              {currentTitle}
            </span>
            <span className="hidden md:inline text-xs text-[var(--text-muted)]">•</span>
            <span className="hidden md:inline text-xs text-[var(--text-secondary)] truncate">
              Aethelgard Enterprise
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {/* Date Range Picker */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-xs text-[var(--text-primary)]">
            <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              className="bg-transparent text-[var(--text-primary)] text-xs font-medium focus:outline-none cursor-pointer pr-1"
              aria-label="Select Date Range"
            >
              <option value="Sep 2024 (Q3 FY25)" className="bg-[var(--dialog-bg)] text-[var(--text-primary)]">Sep 2024 (Q3)</option>
              <option value="Last 30 Days" className="bg-[var(--dialog-bg)] text-[var(--text-primary)]">Last 30 Days</option>
              <option value="Last 90 Days" className="bg-[var(--dialog-bg)] text-[var(--text-primary)]">Last 90 Days</option>
              <option value="Full FY 2024-25" className="bg-[var(--dialog-bg)] text-[var(--text-primary)]">Full FY25</option>
            </select>
          </div>

          {/* Sun / Moon Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={actualTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={actualTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--divider)] transition-colors"
          >
            {actualTheme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" />
            )}
          </button>

          {/* Notifications Dropdown */}
          <div className="relative">
            <button
              onClick={() => setNotificationsOpen(!notificationsOpen)}
              className="relative p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] border border-[var(--divider)] transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4 h-4" />
              {openCriticalRisksCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              )}
            </button>

            {notificationsOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setNotificationsOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[var(--dialog-bg)] border border-[var(--divider)] shadow-2xl p-4 z-40 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between pb-2.5 border-b border-[var(--divider)]">
                    <span className="text-xs font-semibold text-[var(--text-primary)]">Intelligence Alerts</span>
                    <span className="text-[10px] text-[var(--accent)] font-mono font-semibold">{openCriticalRisksCount} active</span>
                  </div>
                  <div className="mt-2.5 space-y-2 max-h-60 overflow-y-auto">
                    {anomalies.slice(0, 3).map(a => (
                      <div
                        key={a.id}
                        onClick={() => {
                          setNotificationsOpen(false);
                          navigate('/risk-anomalies');
                        }}
                        className="p-2 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] cursor-pointer transition-colors border border-[var(--divider)] text-xs"
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {a.severity === 'critical' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          )}
                          <span className="font-medium text-[var(--text-primary)] truncate">{a.title}</span>
                        </div>
                        <p className="text-[11px] text-[var(--text-secondary)]">{a.vendorName} • {a.detectedDate}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Ask FINVORA Copilot Button (Radiant AI Shine & Glow) */}
          <div className="relative group">
            {/* Ambient Pulsing Halo */}
            <div 
              className={`absolute -inset-[3px] rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 opacity-75 blur-[9px] transition-all duration-300 group-hover:opacity-100 group-hover:blur-[13px] pointer-events-none ${
                copilotOpen ? 'opacity-95 blur-[12px]' : 'animate-ai-glow'
              }`} 
              aria-hidden="true" 
            />

            {/* Glowing Interactive Surface */}
            <button
              onClick={() => {
                if (location.pathname === '/what-if') {
                  window.dispatchEvent(new CustomEvent('focus-what-if-composer'));
                } else {
                  window.dispatchEvent(new CustomEvent('open-ask-finvora'));
                }
              }}
              className={`relative overflow-hidden flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-300 active:scale-95 border border-amber-200/90 dark:border-amber-300/50 shadow-[0_2px_14px_rgba(245,158,11,0.45)] cursor-pointer select-none ${
                copilotOpen && location.pathname !== '/what-if'
                  ? 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 ring-2 ring-amber-300/80 ring-offset-2 ring-offset-[var(--app-bg)]'
                  : 'bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 hover:scale-[1.03] hover:shadow-[0_4px_20px_rgba(245,158,11,0.6)]'
              }`}
              aria-label="Open FINVORA AI Copilot"
              title="Ask FINVORA AI Copilot"
            >
              {/* Sweeping Light Sheen / Radiant Shimmer Beam */}
              <div className="ai-shine-sheen" aria-hidden="true" />

              {/* Twinkling AI Sparkles Icon */}
              <Sparkles className="w-3.5 h-3.5 text-stone-950 shrink-0 animate-ai-star relative z-10" />

              {/* Button Text */}
              <span className="hidden sm:inline font-extrabold tracking-tight text-stone-950 relative z-10">
                Ask FINVORA
              </span>
            </button>
          </div>

          {/* Profile Menu with Role Switcher */}
          <div className="relative">
            <button
              onClick={() => setProfileMenuOpen(!profileMenuOpen)}
              className="flex items-center gap-2 p-1 pl-1.5 pr-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] hover:border-[var(--accent-border)] transition-colors text-xs"
              aria-label="User Profile Menu"
            >
              <div className="w-6 h-6 rounded-lg bg-[var(--accent-light)] text-[var(--accent)] font-bold flex items-center justify-center text-xs">
                {role === 'manager' ? 'M' : 'A'}
              </div>
              <span className="hidden sm:inline font-medium text-[var(--text-primary)] text-[12px]">
                {role === 'manager' ? 'Manager' : 'Analyst'}
              </span>
              <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
            </button>

            {profileMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setProfileMenuOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-[var(--dialog-bg)] border border-[var(--divider)] shadow-2xl p-3 z-40 animate-in fade-in duration-150 text-xs">
                  <div className="px-2 py-1.5 border-b border-[var(--divider)] mb-2">
                    <div className="font-semibold text-[var(--text-primary)]">
                      {role === 'manager' ? 'Rajesh Gopinathan' : 'Pooja Sharma'}
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {role === 'manager' ? 'Finance Manager (Approver)' : 'Senior Finance Analyst'}
                    </div>
                  </div>

                  {/* Role Switcher Section */}
                  <div className="px-2 py-1 mb-2">
                    <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider block mb-1.5">
                      Demo User Role
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setRole('analyst');
                          setProfileMenuOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                          role === 'analyst'
                            ? 'bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent-border)] font-bold'
                            : 'border-[var(--divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Analyst
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRole('manager');
                          setProfileMenuOpen(false);
                        }}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                          role === 'manager'
                            ? 'bg-[var(--accent-light)] text-[var(--accent)] border-[var(--accent-border)] font-bold'
                            : 'border-[var(--divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        Manager
                      </button>
                    </div>
                  </div>

                  {/* Links */}
                  <div className="pt-2 border-t border-[var(--divider)] space-y-1">
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        navigate('/settings');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)] transition-colors flex items-center gap-2"
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>Appearance & Settings</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        setResetModalOpen(true);
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-2"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reset Demo Data</span>
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        logout();
                        navigate('/login');
                      }}
                      className="w-full text-left px-2 py-1.5 rounded-lg text-[var(--text-secondary)] hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors flex items-center gap-2"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Reset Confirmation Dialog */}
      <ConfirmDialog
        isOpen={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        onConfirm={resetDemoData}
        title="Reset Demo Workspace?"
        message="This will restore all invoices, duplicate anomaly flags, budget reallocations, and cash-flow scenarios back to the initial hackathon demo baseline."
        confirmLabel="Reset Everything"
        type="warning"
      />
    </>
  );
};
