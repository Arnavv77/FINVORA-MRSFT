import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import {
  UserRole,
  SourceConnection,
  Transaction,
  AnomalyRecord,
  Invoice,
  DepartmentBudget,
  PaymentScheduleItem,
  DecisionProposal,
  WorkflowRule,
  SimulationParams,
  SimulationResult,
  SavedScenario,
  CopilotMessage,
  CashForecastPoint,
  DataQualityIssue
} from '../types';
import {
  INITIAL_DATA_SOURCES,
  INITIAL_DATA_QUALITY_ISSUES,
  INITIAL_TRANSACTIONS,
  INITIAL_ANOMALIES,
  INITIAL_INVOICES,
  INITIAL_DEPARTMENT_BUDGETS,
  INITIAL_DECISION_PROPOSALS,
  INITIAL_WORKFLOW_RULES,
  INITIAL_PAYMENT_SCHEDULE,
  generateCashForecastPoints
} from '../data/mockData';
import { formatINR } from '../utils/formatters';
import { calculateScenario, DEFAULT_SIMULATION_PARAMS } from '../utils/scenarioEngine';
import {
  fetchDashboardSummary,
  fetchRiskAlerts,
  fetchDepartmentBudgets,
  fetchCashForecast,
  takeRiskAction,
  sendCopilotChat
} from '../lib/api';


interface Toast {
  id: string;
  type: 'success' | 'warning' | 'info' | 'error';
  message: string;
  timestamp: number;
}

interface FinancialContextType {
  // Authentication
  isAuthenticated: boolean;
  login: (email?: string) => void;
  logout: () => void;

  // Role & Workspace
  role: UserRole;
  setRole: (role: UserRole) => void;
  workspaceName: string;
  dateRange: string;
  setDateRange: (range: string) => void;

  // Theme Architecture
  themeMode: 'light' | 'dark' | 'system';
  actualTheme: 'light' | 'dark';
  setThemeMode: (mode: 'light' | 'dark' | 'system') => void;
  toggleTheme: () => void;

  // Data
  sources: SourceConnection[];
  qualityIssues: DataQualityIssue[];
  transactions: Transaction[];
  anomalies: AnomalyRecord[];
  invoices: Invoice[];
  budgets: DepartmentBudget[];
  paymentSchedule: PaymentScheduleItem[];
  proposals: DecisionProposal[];
  workflowRules: WorkflowRule[];

  // Cash Forecast & Computed
  forecastData: CashForecastPoint[];
  availableCash: number;
  netCashFlow30d: number;
  outstandingPayables: number;
  openCriticalRisksCount: number;
  isBackendConnected?: boolean;

  // Actions
  refreshSource: (id: string) => void;
  addTransaction: (txn: Omit<Transaction, 'id'>) => void;
  importTransactions: (txns: Transaction[]) => void;
  updateAnomalyStatus: (id: string, status: AnomalyRecord['status'], note?: string, dismissReason?: string) => void;
  assignAnomaly: (id: string, assignee: string) => void;
  placeInvoiceHold: (invoiceId: string) => void;
  reallocateBudget: (fromDeptId: string, toDeptId: string, amount: number, reason: string) => void;

  // Proposals & Approval Workflow
  createProposal: (proposal: Omit<DecisionProposal, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => DecisionProposal;
  submitProposalForApproval: (id: string) => void;
  approveProposal: (id: string) => void;
  rejectProposal: (id: string, reason: string) => void;
  executeProposal: (id: string) => void;

  // Workflow Rules
  toggleRule: (id: string) => void;
  addWorkflowRule: (rule: Omit<WorkflowRule, 'id' | 'triggerCount'>) => void;

  // What-If Simulation
  simulationParams: SimulationParams;
  setSimulationParams: React.Dispatch<React.SetStateAction<SimulationParams>>;
  simulationResult: SimulationResult;
  savedScenarios: SavedScenario[];
  saveScenario: (name: string, notes?: string) => void;
  loadScenario: (scenario: SavedScenario) => void;
  deleteScenario: (id: string) => void;
  resetSimulation: () => void;

  // Copilot
  copilotOpen: boolean;
  setCopilotOpen: (open: boolean) => void;
  copilotMessages: CopilotMessage[];
  sendCopilotMessage: (text: string) => Promise<void>;
  clearCopilotMessages: () => void;


  // Toasts & Demo Reset
  toasts: Toast[];
  showToast: (message: string, type?: Toast['type']) => void;
  resetDemoData: () => void;
  duplicateHoldExecuted: boolean;
}

const FinancialContext = createContext<FinancialContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'FINVORA_APP_STATE_V1';

export const FinancialProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return localStorage.getItem('FINVORA_AUTHENTICATED') === 'true';
  });

  const login = (userEmail?: string) => {
    setIsAuthenticated(true);
    localStorage.setItem('FINVORA_AUTHENTICATED', 'true');
    if (userEmail) {
      localStorage.setItem('FINVORA_USER_EMAIL', userEmail);
    }
  };

  const logout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('FINVORA_AUTHENTICATED');
    localStorage.removeItem('FINVORA_USER_EMAIL');
  };

  // Load saved state or defaults
  const [role, setRoleState] = useState<UserRole>(() => {
    return (localStorage.getItem('FINVORA_USER_ROLE') as UserRole) || 'analyst';
  });

  // Theme state with localStorage & system preference sync
  const [themeMode, setThemeModeState] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('FINVORA_THEME_MODE') as 'light' | 'dark' | 'system') || 'system';
  });

  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    media.addEventListener('change', handler);
    return () => media.removeEventListener('change', handler);
  }, []);

  const actualTheme: 'light' | 'dark' = useMemo(() => {
    if (themeMode === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return themeMode;
  }, [themeMode, systemPrefersDark]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (actualTheme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
    }
  }, [actualTheme]);

  const setThemeMode = (mode: 'light' | 'dark' | 'system') => {
    setThemeModeState(mode);
    localStorage.setItem('FINVORA_THEME_MODE', mode);
  };

  const toggleTheme = () => {
    const next = actualTheme === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
  };

  const [dateRange, setDateRange] = useState<string>('Sep 2024 (Q3 FY25)');
  const workspaceName = 'Aethelgard Enterprise India Pvt Ltd';

  const [sources, setSources] = useState<SourceConnection[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_sources`);
    if (saved) {
      try {
        const parsed: SourceConnection[] = JSON.parse(saved);
        return parsed.map(s => {
          const init = INITIAL_DATA_SOURCES.find(i => i.id === s.id);
          return init ? { ...s, healthScore: init.healthScore } : s;
        });
      } catch {
        return INITIAL_DATA_SOURCES;
      }
    }
    return INITIAL_DATA_SOURCES;
  });

  const [qualityIssues] = useState<DataQualityIssue[]>(INITIAL_DATA_QUALITY_ISSUES);

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_txns`);
    return saved ? JSON.parse(saved) : INITIAL_TRANSACTIONS;
  });

  const [anomalies, setAnomalies] = useState<AnomalyRecord[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_anomalies`);
    return saved ? JSON.parse(saved) : INITIAL_ANOMALIES;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_invoices`);
    return saved ? JSON.parse(saved) : INITIAL_INVOICES;
  });

  const [budgets, setBudgets] = useState<DepartmentBudget[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_budgets`);
    return saved ? JSON.parse(saved) : INITIAL_DEPARTMENT_BUDGETS;
  });

  const [paymentSchedule, setPaymentSchedule] = useState<PaymentScheduleItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_schedule`);
    return saved ? JSON.parse(saved) : INITIAL_PAYMENT_SCHEDULE;
  });

  const [proposals, setProposals] = useState<DecisionProposal[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_proposals`);
    if (saved) {
      try {
        const parsed: DecisionProposal[] = JSON.parse(saved);
        // Ensure confidence scores reflect 70-80% variation
        return parsed.map(p => {
          if (p.id === 'PROP-2024-001') return { ...p, confidence: 78.4 };
          if (p.id === 'PROP-2024-002') return { ...p, confidence: 73.2 };
          if (p.id === 'PROP-2024-003') return { ...p, confidence: 76.5 };
          if (p.confidence > 80 || p.confidence < 70) {
            const adjusted = 71.0 + ((Math.abs(p.confidence) % 80) / 80) * 8.5;
            return { ...p, confidence: Number(adjusted.toFixed(1)) };
          }
          return p;
        });
      } catch {
        return INITIAL_DECISION_PROPOSALS;
      }
    }
    return INITIAL_DECISION_PROPOSALS;
  });

  const [workflowRules, setWorkflowRules] = useState<WorkflowRule[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_rules`);
    return saved ? JSON.parse(saved) : INITIAL_WORKFLOW_RULES;
  });

  const [duplicateHoldExecuted, setDuplicateHoldExecuted] = useState<boolean>(() => {
    return localStorage.getItem(`${LOCAL_STORAGE_KEY}_duplicate_held`) === 'true';
  });

  // What-If Simulation State
  const defaultSimulationParams: SimulationParams = DEFAULT_SIMULATION_PARAMS;

  const [simulationParams, setSimulationParams] = useState<SimulationParams>(defaultSimulationParams);

  const [savedScenarios, setSavedScenarios] = useState<SavedScenario[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_scenarios`);
    return saved ? JSON.parse(saved) : [
      {
        id: 'SCEN-01',
        name: 'Festive Slowdown & 15-Day Delay',
        createdAt: '2024-09-22',
        params: {
          name: 'Festive Slowdown & 15-Day Delay',
          horizonDays: 60,
          revenueChangePct: -10,
          collectionDelayDays: 15,
          expenseChangePct: 5,
          paymentRescheduleDays: 0,
          capexHiringCost: 1500000,
          capexDay: 15,
          affectedScope: 'All enterprise operations',
          baselineReference: 'Q3 FY25 Reconciled Base Plan'
        },
        endingCash: 21850000,
        lowestCash: 14200000,
        deltaCash: -6550000,
        notes: 'Simulates 10% lower customer renewals and 15 days delay in collections.'
      }
    ];
  });

  // Copilot State
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [copilotMessages, setCopilotMessages] = useState<CopilotMessage[]>([
    {
      id: 'msg-init',
      sender: 'finvora',
      timestamp: 'Today',
      text: 'Good morning. Live ledger telemetry evaluated.\n\n• **Duplicate Invoice Flagged**: #INV-2024-8849 (₹6,80,000) pending payment hold\n• **Budget Variance**: Marketing & Growth is +18% over threshold\n\nHow can I assist your financial decisions today?',
      kpis: {
        accuracy: 78,
        feasibility: 96.0,
        impact: '₹6.80L Mitigated',
        feasibilityNote: 'Dual ERP match verified; ready for 1-click hold',
        auditConfidence: 'Verified'
      },
      citations: [
        { type: 'risk', title: 'Duplicate INV-2024-8849', referenceId: 'ANOM-2024-001' },
        { type: 'department', title: 'Marketing Overrun', referenceId: 'dept-mktg' }
      ],
      suggestedActions: [
        { label: 'Inspect Duplicate Invoice #8849', actionType: 'navigate', payload: '/risk-anomalies' },
        { label: 'Review Budget Variance', actionType: 'navigate', payload: '/budget-intelligence' }
      ]
    }
  ]);

  // Toasts
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: Toast['type'] = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, type, message, timestamp: Date.now() }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem('FINVORA_USER_ROLE', newRole);
    showToast(`Switched active role to ${newRole === 'manager' ? 'Finance Manager (Approver)' : 'Finance Analyst'}`, 'info');
  };

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_sources`, JSON.stringify(sources));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_txns`, JSON.stringify(transactions));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_anomalies`, JSON.stringify(anomalies));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_invoices`, JSON.stringify(invoices));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_budgets`, JSON.stringify(budgets));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_schedule`, JSON.stringify(paymentSchedule));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_proposals`, JSON.stringify(proposals));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_rules`, JSON.stringify(workflowRules));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_scenarios`, JSON.stringify(savedScenarios));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_duplicate_held`, String(duplicateHoldExecuted));
  }, [sources, transactions, anomalies, invoices, budgets, paymentSchedule, proposals, workflowRules, savedScenarios, duplicateHoldExecuted]);

  // Cash Forecast Points - populated from real backend API, with fallback to generator
  const [forecastData, setForecastData] = useState<CashForecastPoint[]>(() =>
    generateCashForecastPoints(duplicateHoldExecuted)
  );

  // Key KPI values - populated from real backend API dashboard summary, with reactive fallbacks
  const [backendAvailableCash, setBackendAvailableCash] = useState<number | null>(null);
  const [backendNetCashFlow30d, setBackendNetCashFlow30d] = useState<number | null>(null);
  const [backendOpenRiskCount, setBackendOpenRiskCount] = useState<number | null>(null);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(false);

  const fallbackAvailableCash = 18200000;
  const availableCash = backendAvailableCash !== null ? backendAvailableCash : fallbackAvailableCash;

  const fallbackNetCashFlow30d = useMemo(() => {
    const inflows = transactions.filter(t => t.type === 'inflow').reduce((acc, t) => acc + t.amount, 0);
    const outflows = transactions.filter(t => t.type === 'outflow').reduce((acc, t) => acc + t.amount, 0);
    return inflows - outflows;
  }, [transactions]);
  const netCashFlow30d = backendNetCashFlow30d !== null ? backendNetCashFlow30d : fallbackNetCashFlow30d;

  const outstandingPayables = useMemo(() => {
    return invoices
      .filter(inv => inv.status === 'pending_approval' || inv.status === 'approved' || inv.status === 'overdue')
      .reduce((acc, inv) => acc + inv.amount, 0);
  }, [invoices]);

  const fallbackCriticalRisksCount = useMemo(() => {
    return anomalies.filter(a => a.severity === 'critical' && (a.status === 'open' || a.status === 'under_review')).length;
  }, [anomalies]);
  const openCriticalRisksCount = backendOpenRiskCount !== null ? backendOpenRiskCount : fallbackCriticalRisksCount;

  // Real backend data integration: Dashboard KPIs, Risks, Budgets, Forecast
  useEffect(() => {
    let isSubscribed = true;

    async function loadBackendData() {
      try {
        const [summary, risks, deptBudgets, forecast] = await Promise.all([
          fetchDashboardSummary().catch(err => {
            console.warn('Dashboard summary fetch failed, using fallback:', err);
            return null;
          }),
          fetchRiskAlerts().catch(err => {
            console.warn('Risk alerts fetch failed, using fallback:', err);
            return null;
          }),
          fetchDepartmentBudgets().catch(err => {
            console.warn('Department budgets fetch failed, using fallback:', err);
            return null;
          }),
          fetchCashForecast(90).catch(err => {
            console.warn('Cash forecast fetch failed, using fallback:', err);
            return null;
          })
        ]);

        if (!isSubscribed) return;

        if (summary) {
          setBackendAvailableCash(summary.total_balance);
          setBackendNetCashFlow30d(summary.monthly_inflow - summary.monthly_outflow);
          setBackendOpenRiskCount(summary.open_risk_count);
          setIsBackendConnected(true);
        }

        if (risks && risks.length > 0) {
          setAnomalies(risks);
        }

        if (deptBudgets && deptBudgets.length > 0) {
          setBudgets(deptBudgets);
        }

        if (forecast && forecast.points && forecast.points.length > 0) {
          setForecastData(forecast.points);
        }
      } catch (err) {
        console.warn('Backend initialization error:', err);
      }
    }

    loadBackendData();

    return () => {
      isSubscribed = false;
    };
  }, [duplicateHoldExecuted]);

  // Actions
  const refreshSource = (id: string) => {
    setSources(prev => prev.map(s => {
      if (s.id === id) {
        return {
          ...s,
          lastSyncTime: 'Just now',
          status: 'connected',
          recordCount: s.recordCount + 4
        };
      }
      return s;
    }));
    showToast('Source connection synchronized successfully', 'success');
  };

  const addTransaction = (txn: Omit<Transaction, 'id'>) => {
    const newTxn: Transaction = {
      ...txn,
      id: `TXN-${Math.floor(8100 + Math.random() * 900)}`
    };
    setTransactions(prev => [newTxn, ...prev]);
    showToast(`Transaction ${newTxn.referenceNo} recorded`, 'success');
  };

  const importTransactions = (newTxns: Transaction[]) => {
    setTransactions(prev => [...newTxns, ...prev]);
    showToast(`Successfully imported ${newTxns.length} transactions`, 'success');
  };

  const updateAnomalyStatus = (id: string, status: AnomalyRecord['status'], note?: string, dismissReason?: string) => {
    setAnomalies(prev => prev.map(a => {
      if (a.id === id) {
        const historyItem = {
          timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST',
          user: role === 'manager' ? 'Rajesh Gopinathan (Finance Manager)' : 'Pooja Sharma (Analyst)',
          action: `Status changed to ${status.replace('_', ' ').toUpperCase()}`,
          note: note || (dismissReason ? `Dismissed: ${dismissReason}` : 'Status updated via Risk Drawer')
        };
        return {
          ...a,
          status,
          dismissReason: dismissReason || a.dismissReason,
          reviewHistory: [historyItem, ...(a.reviewHistory || [])]
        };
      }
      return a;
    }));

    // Call backend API to persist state
    takeRiskAction(id, status, note, dismissReason).catch(err => {
      console.warn(`Could not sync risk action for ${id} to backend:`, err);
    });

    showToast(`Anomaly ${id} marked as ${status.replace('_', ' ')}`, 'info');
  };

  const assignAnomaly = (id: string, assignee: string) => {
    setAnomalies(prev => prev.map(a => a.id === id ? { ...a, assignedTo: assignee } : a));
    showToast(`Anomaly assigned to ${assignee}`, 'info');
  };

  const placeInvoiceHold = (invoiceId: string) => {
    setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'on_hold' } : inv));
    setPaymentSchedule(prev => prev.map(item => item.invoiceId === invoiceId ? { ...item, status: 'on_hold' } : item));
    showToast(`Invoice ${invoiceId} placed on payment hold`, 'warning');
  };

  const reallocateBudget = (fromDeptId: string, toDeptId: string, amount: number, reason: string) => {
    setBudgets(prev => prev.map(dept => {
      if (dept.id === fromDeptId) {
        return {
          ...dept,
          allocated: dept.allocated - amount,
          varianceAmount: dept.varianceAmount + amount,
          variancePercentage: Number((((dept.spent - (dept.allocated - amount)) / (dept.allocated - amount)) * 100).toFixed(1))
        };
      }
      if (dept.id === toDeptId) {
        const newAllocated = dept.allocated + amount;
        const newVariance = dept.spent - newAllocated;
        return {
          ...dept,
          allocated: newAllocated,
          varianceAmount: newVariance,
          variancePercentage: Number(((newVariance / newAllocated) * 100).toFixed(1)),
          status: newVariance > 0 ? 'over_budget' : 'on_track'
        };
      }
      return dept;
    }));
    showToast(`Reallocated ${formatINR(amount)} successfully`, 'success');
  };

  // Proposal Workflow
  const createProposal = (proposalData: Omit<DecisionProposal, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const rawConf = proposalData.confidence;
    const normalizedConfidence = (rawConf > 80 || rawConf < 70)
      ? Number((71.5 + (Math.abs(rawConf) % 8.0)).toFixed(1))
      : rawConf;

    const newProposal: DecisionProposal = {
      ...proposalData,
      confidence: normalizedConfidence,
      id: `PROP-2024-${Math.floor(100 + Math.random() * 900)}`,
      createdAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST',
      updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST',
      status: 'draft'
    };
    setProposals(prev => [newProposal, ...prev]);
    showToast(`Created proposal: ${newProposal.title}`, 'info');
    return newProposal;
  };

  const submitProposalForApproval = (id: string) => {
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: 'pending_approval',
          updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
        };
      }
      return p;
    }));
    showToast('Proposal submitted for Finance Manager sign-off', 'info');
  };

  const approveProposal = (id: string) => {
    if (role !== 'manager') {
      showToast('Permission Denied: Only Finance Manager role can approve proposals. Please switch role in top bar.', 'error');
      return;
    }
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: 'approved',
          updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
        };
      }
      return p;
    }));
    showToast('Proposal successfully approved! Ready for execution.', 'success');
  };

  const rejectProposal = (id: string, reason: string) => {
    if (role !== 'manager') {
      showToast('Permission Denied: Only Finance Manager role can reject proposals.', 'error');
      return;
    }
    setProposals(prev => prev.map(p => {
      if (p.id === id) {
        return {
          ...p,
          status: 'rejected',
          rejectionReason: reason,
          updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
        };
      }
      return p;
    }));
    showToast('Proposal rejected with documented rationale', 'warning');
  };

  /**
   * The Core Connected Demo Execution:
   * When user executes an approved proposal, e.g. Payment Hold on Duplicate Invoice INV-2024-8849:
   * 1. Proposal status -> 'executed'
   * 2. Invoice INV-2024-8849 status -> 'on_hold'
   * 3. PaymentScheduleItem -> 'on_hold'
   * 4. Anomaly ANOM-2024-001 -> 'held'
   * 5. duplicateHoldExecuted -> true (forecast recomputes instantly)
   */
  const executeProposal = (id: string) => {
    const proposal = proposals.find(p => p.id === id);
    if (!proposal) return;

    if (proposal.status !== 'approved') {
      showToast('Proposal must be approved by Finance Manager before execution.', 'error');
      return;
    }

    if (proposal.type === 'payment_hold' && proposal.targetEntityId === 'INV-2024-8849') {
      setDuplicateHoldExecuted(true);
      setInvoices(prev => prev.map(inv => inv.id === 'INV-2024-8849' ? { ...inv, status: 'on_hold' } : inv));
      setPaymentSchedule(prev => prev.map(item => item.invoiceId === 'INV-2024-8849' ? { ...item, status: 'on_hold' } : item));
      updateAnomalyStatus('ANOM-2024-001', 'held', 'Payment hold executed following formal proposal approval.');

      setProposals(prev => prev.map(p => p.id === id ? {
        ...p,
        status: 'executed',
        executionResultSummary: 'Automated hold placed on HDFC & RazorpayX payout gateways. ₹6,80,000 disbursement blocked.',
        updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
      } : p));

      showToast('ACTION EXECUTED: Invoice #INV-2024-8849 placed on hold! Cash forecast & AP schedules updated.', 'success');
      return;
    }

    if (proposal.type === 'budget_reallocation') {
      reallocateBudget('dept-eng', 'dept-mktg', 450000, 'Approved Q3 Festive Marketing Reallocation');
      setProposals(prev => prev.map(p => p.id === id ? {
        ...p,
        status: 'executed',
        executionResultSummary: 'Transferred ₹4,50,000 from Engineering surplus to Marketing & Growth ledger.',
        updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
      } : p));
      showToast('ACTION EXECUTED: ₹4,50,000 budget reallocated across departments.', 'success');
      return;
    }

    // Default proposal execution
    setProposals(prev => prev.map(p => p.id === id ? {
      ...p,
      status: 'executed',
      executionResultSummary: 'Financial decision executed in ERP and banking ledger.',
      updatedAt: new Date().toLocaleDateString('en-IN') + ' ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) + ' IST'
    } : p));
    showToast('Decision executed successfully', 'success');
  };

  const toggleRule = (id: string) => {
    setWorkflowRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
    showToast('Workflow rule status toggled', 'info');
  };

  const addWorkflowRule = (ruleData: Omit<WorkflowRule, 'id' | 'triggerCount'>) => {
    const newRule: WorkflowRule = {
      ...ruleData,
      id: `RULE-WF-${Math.floor(10 + Math.random() * 90)}`,
      triggerCount: 0
    };
    setWorkflowRules(prev => [...prev, newRule]);
    showToast(`New workflow rule created: ${newRule.name}`, 'success');
  };

  // Deterministic What-If Simulation Engine
  const simulationResult = useMemo<SimulationResult>(() => {
    return calculateScenario(simulationParams, forecastData, duplicateHoldExecuted);
  }, [simulationParams, forecastData, duplicateHoldExecuted]);

  const saveScenario = (name: string, notes: string = '') => {
    const newScenario: SavedScenario = {
      id: `SCEN-${Math.floor(10 + Math.random() * 90)}`,
      name,
      createdAt: new Date().toISOString().slice(0, 10),
      params: { ...simulationParams },
      endingCash: simulationResult.endingCash,
      lowestCash: simulationResult.lowestCash,
      deltaCash: simulationResult.deltaCash,
      notes: notes || `Simulated with revenue ${simulationParams.revenueChangePct}%, delay ${simulationParams.collectionDelayDays}d`
    };
    setSavedScenarios(prev => [newScenario, ...prev]);
    showToast(`Scenario "${name}" saved`, 'success');
  };

  const loadScenario = (scenario: SavedScenario) => {
    setSimulationParams({ ...scenario.params });
    showToast(`Loaded scenario: ${scenario.name}`, 'info');
  };

  const deleteScenario = (id: string) => {
    setSavedScenarios(prev => prev.filter(s => s.id !== id));
    showToast('Saved scenario deleted', 'info');
  };

  const resetSimulation = () => {
    setSimulationParams(defaultSimulationParams);
    showToast('Simulation reset to baseline', 'info');
  };

  // Copilot Logic
  const sendCopilotMessage = async (text: string) => {
    const userMsg: CopilotMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      text
    };

    setCopilotMessages(prev => [...prev, userMsg]);

    try {
      // 1. Live Backend Copilot with NVIDIA NIM LLM & DB Grounding
      const apiRes = await sendCopilotChat(text);
      if (apiRes && apiRes.reply) {
        const botMsg: CopilotMessage = {
          id: `msg-${Date.now() + 1}`,
          sender: 'finvora',
          timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
          text: apiRes.reply,
          kpis: apiRes.kpis,
          citations: apiRes.citations,
          suggestedActions: apiRes.suggestedActions
        };
        setCopilotMessages(prev => [...prev, botMsg]);
        return;
      }
    } catch (err) {
      console.warn('[Copilot API fallback engaged]:', err);
    }

    // 2. Intelligent local financial fallback for any typed question
    let replyText = '';
    let citations: CopilotMessage['citations'] = [];
    let suggestedActions: CopilotMessage['suggestedActions'] = [];
    let kpis: CopilotMessage['kpis'] = undefined;

    const lower = text.toLowerCase();

    if (lower.includes('runway') || lower.includes('burn') || lower.includes('liquidity') || lower.includes('how long')) {
      replyText = `### Cash Runway & Liquidity Assessment\n• **Available Reserves**: **₹2.06 Cr** across HDFC & ICICI accounts\n• **Net Monthly Burn**: ~₹30.82 L/month\n• **Effective Runway**: **6.7 Months** under current operating velocity\n• **Liquidity Status**: Stable, maintaining 2.4x the target reserve buffer of ₹80L.`;
      kpis = {
        accuracy: 78,
        feasibility: 96.0,
        impact: '6.7 Mo Runway',
        feasibilityNote: 'Conservative baseline excluding uncollected enterprise receivables',
        auditConfidence: 'Verified'
      };
      citations = [{ type: 'risk', title: 'Cash Position Telemetry', referenceId: 'GL-BANK-01' }];
      suggestedActions = [{ label: 'Run Runway Stress Test', actionType: 'navigate', payload: '/what-if' }];
    } else if (lower.includes('vendor') || lower.includes('zenith') || lower.includes('hyperscale') || lower.includes('shardul') || lower.includes('supplier')) {
      replyText = `### Vendor Risk & Spend Intelligence\n• **Zenith Cloud**: ₹6,80,000 flagged (#INV-2024-8849) — potential duplicate of settled invoice\n• **HyperScale Systems**: ₹38,50,000 server PO (9.1x historical spike)\n• **Shardul Amarchand**: ₹7,50,000 legal retainer — 4 days overdue\n\n**Action**: Immediate hold recommended on Zenith Cloud pending vendor credit confirmation.`;
      kpis = {
        accuracy: 78,
        feasibility: 98.0,
        impact: '₹45.3L Under Review',
        feasibilityNote: 'Vendor hold does not breach SLA terms or credit covenants',
        auditConfidence: 'Verified'
      };
      citations = [{ type: 'vendor', title: 'Zenith Cloud Services', referenceId: 'VEND-ZENITH' }];
      suggestedActions = [{ label: 'Inspect Vendor Ledger', actionType: 'navigate', payload: '/ap-expenses' }];
    } else if (lower.includes('hire') || lower.includes('hiring') || lower.includes('salary') || lower.includes('headcount') || lower.includes('engineer') || lower.includes('team') || lower.includes('afford')) {
      replyText = `### Headcount & Expansion Feasibility\n• **Liquidity Capacity**: Current cash position of **₹2.06 Cr** supports ongoing payroll obligations\n• **Runway Buffer**: Additional headcount of 3 senior engineers (~₹6.5L/mo burn) reduces runway by only 0.4 months\n• **Recommendation**: Feasible within Q4 hiring plan, provided Engineering surplus of ₹10L is not fully reallocated.`;
      kpis = {
        accuracy: 78,
        feasibility: 91.5,
        impact: '₹6.5L/mo Net Burn',
        feasibilityNote: 'Subject to CFO sign-off on annualized OPEX commitments',
        auditConfidence: 'High'
      };
      citations = [{ type: 'department', title: 'Engineering Headcount', referenceId: 'dept-eng' }];
      suggestedActions = [{ label: 'Simulate Headcount Impact', actionType: 'navigate', payload: '/what-if' }];
    } else if (lower.includes('risk') || lower.includes('anomaly') || lower.includes('fraud') || lower.includes('alert')) {
      replyText = `### Autonomous Risk Matrix\n• **Open Risk Alerts**: 16 active anomalies detected across General Ledger\n• **Top Critical Anomaly**: Duplicate vendor invoice #INV-2024-8849 (₹6.80L)\n• **Top Warning Anomaly**: 9.1x historical spike in hardware procurement (₹38.5L)\n• **Compliance**: 100% GL transactions monitored continuously by FINVORA ML heuristics.`;
      kpis = {
        accuracy: 78,
        feasibility: 96.5,
        impact: '₹45.3L Exposure',
        feasibilityNote: 'Policy rules triggered: DUP_HASH_01, SPIKE_SIGMA_03',
        auditConfidence: 'Verified'
      };
      citations = [{ type: 'risk', title: 'Critical Exposure Matrix', referenceId: 'ANOM-2024-001' }];
      suggestedActions = [{ label: 'Resolve Open Risks', actionType: 'navigate', payload: '/risk-anomalies' }];
    } else if (lower.includes('tax') || lower.includes('gst') || lower.includes('tds') || lower.includes('compliance') || lower.includes('audit')) {
      replyText = `### Tax, GST & Audit Compliance Status\n• **GSTR-2B Reconciliation**: All input tax credits verified across 142 vendor invoices\n• **TDS Deductions**: 194C and 194J withholdings automatically applied on AP runs\n• **Audit Trail**: Every ledger modification and payment hold is cryptographically timestamped for statutory review.`;
      kpis = {
        accuracy: 78,
        feasibility: 97.0,
        impact: '100% Tax Compliant',
        feasibilityNote: 'Aligned with Indian GST & Direct Tax statutory timelines',
        auditConfidence: 'Verified'
      };
      citations = [{ type: 'risk', title: 'GST ITC Reconciliation', referenceId: 'TAX-GST-2B' }];
      suggestedActions = [{ label: 'Inspect Audit Trail', actionType: 'navigate', payload: '/decisions-approvals' }];
    } else if (lower.includes('cash') || lower.includes('balance') || lower.includes('fall') || lower.includes('decline') || lower.includes('shortfall')) {
      replyText = `### Cash Balance Drivers\nProjected liquidity dips near Day 48 due to:\n• **AP Outflows**: ₹38.5L Server PO + ₹18.5L Marketing ad spend\n• **Duplicate Invoice**: ₹6.80L candidate (#INV-2024-8849)\n• **Aged Receivables**: ₹75.0L enterprise AR aged 30+ days\n\n**Recommendation**: Holding duplicate #INV-2024-8849 preserves ₹6.80L and maintains reserves above ₹25L.`;
      kpis = {
        accuracy: 78,
        feasibility: 94.2,
        impact: '₹6.80L Protected',
        feasibilityNote: '1-click CFO approval hold on duplicate vendor release',
        auditConfidence: 'Verified'
      };
      citations = [
        { type: 'invoice', title: 'Duplicate INV-2024-8849', referenceId: 'INV-2024-8849' },
        { type: 'risk', title: 'Cash Shortage Risk', referenceId: 'ANOM-2024-001' }
      ];
      suggestedActions = [
        { label: 'View Duplicate Anomaly', actionType: 'navigate', payload: '/risk-anomalies' },
        { label: 'Review Hold Proposal', actionType: 'navigate', payload: '/decisions-approvals' }
      ];
    } else if (lower.includes('invoice') || lower.includes('review') || lower.includes('duplicate') || lower.includes('hold') || lower.includes('payable') || lower.includes('ap')) {
      replyText = `### Invoices Requiring Review\n• **#INV-2024-8849** (Zenith Cloud): **₹6,80,000** — Critical duplicate candidate of settled #INV-8841.\n• **#INV-2024-8902** (HyperScale Systems): **₹38,50,000** — 9.1x historical spike; needs dual approval.\n• **#INV-2024-8660** (Shardul Amarchand): **₹7,50,000** — Overdue by 4 days.`;
      kpis = {
        accuracy: 78,
        feasibility: 98.0,
        impact: '₹45.3L Under Review',
        feasibilityNote: 'Deterministic SAP ledger cross-match; immediate hold feasible',
        auditConfidence: 'Verified'
      };
      citations = [
        { type: 'invoice', title: 'INV-2024-8849 (Duplicate)', referenceId: 'INV-2024-8849' },
        { type: 'invoice', title: 'INV-2024-8902 (Outlier PO)', referenceId: 'INV-2024-8902' }
      ];
      suggestedActions = [
        { label: 'Open Invoices Ledger', actionType: 'navigate', payload: '/ap-expenses' },
        { label: 'Inspect Evidence', actionType: 'navigate', payload: '/risk-anomalies' }
      ];
    } else if (lower.includes('marketing') || lower.includes('budget') || lower.includes('over budget') || lower.includes('variance') || lower.includes('department') || lower.includes('spend')) {
      replyText = `### Marketing Budget Variance\n• **Status**: ₹48.60L spent vs ₹45.00L allocated (**+18.0% variance**)\n• **Cause**: Unplanned festive paid acquisition push on Meta & Google Ads\n• **Remedy**: Auto-reallocation of ₹4.50L from Engineering's ₹10.0L surplus is drafted.`;
      kpis = {
        accuracy: 78,
        feasibility: 92.0,
        impact: '₹4.50L Rebalanced',
        feasibilityNote: 'Engineering cost-center surplus verified in ledger',
        auditConfidence: 'High'
      };
      citations = [
        { type: 'department', title: 'Marketing Budget', referenceId: 'dept-mktg' },
        { type: 'risk', title: 'Budget Deviation ANOM-2024-003', referenceId: 'ANOM-2024-003' }
      ];
      suggestedActions = [
        { label: 'Review Budget Reallocations', actionType: 'navigate', payload: '/budget-intelligence' },
        { label: 'View Pending Proposal', actionType: 'navigate', payload: '/decisions-approvals' }
      ];
    } else if (lower.includes('15 days') || lower.includes('delay') || lower.includes('late')) {
      replyText = `### 15-Day Delay Stress Test\n• **Cash Impact**: -₹22.4L during Days 20–35\n• **Minimum Reserve**: ₹1.18 Cr (runway buffer drops to 6.2 days)\n• **Assessment**: No insolvency; hold non-critical vendor disbursements to maintain cushion.`;
      kpis = {
        accuracy: 78,
        feasibility: 89.0,
        impact: '-₹22.4L Liquidity Swing',
        feasibilityNote: 'Working capital adjustment via AP rescheduling is viable',
        auditConfidence: 'High'
      };
      suggestedActions = [
        { label: 'Open What-If Simulator', actionType: 'navigate', payload: '/what-if' }
      ];
    } else {
      replyText = `### Enterprise Financial Intelligence\nBased on your live ledger data (**₹2.06 Cr** cash reserves, 16 active alerts):\n• **Payment Holds**: ₹6.80L duplicate invoice (#INV-2024-8849) awaiting confirmation\n• **Budget Monitoring**: Marketing is currently +18% over budget; Engineering has ₹10.0L surplus\n• **Liquidity Outlook**: Operating runway remains healthy at 6.7+ months\n\n*You can ask me any question about invoices, runway, department budgets, tax compliance, or what-if stress tests.*`;
      kpis = {
        accuracy: 78,
        feasibility: 95.0,
        impact: 'Live GL Telemetry',
        feasibilityNote: 'Verified against current GL state',
        auditConfidence: 'Verified'
      };
      suggestedActions = [
        { label: 'What is our runway?', actionType: 'filter', payload: 'What is our cash runway?' },
        { label: 'Which invoices need review?', actionType: 'filter', payload: 'invoices_review' }
      ];
    }

    const botMsg: CopilotMessage = {
      id: `msg-${Date.now() + 1}`,
      sender: 'finvora',
      timestamp: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
      text: replyText,
      kpis,
      citations,
      suggestedActions
    };

    setCopilotMessages(prev => [...prev, botMsg]);
  };

  const clearCopilotMessages = () => {
    setCopilotMessages([]);
    showToast('Conversation cleared', 'info');
  };

  const resetDemoData = () => {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_sources`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_txns`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_anomalies`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_invoices`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_budgets`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_schedule`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_proposals`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_rules`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_scenarios`);
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_duplicate_held`);

    setSources(INITIAL_DATA_SOURCES);
    setTransactions(INITIAL_TRANSACTIONS);
    setAnomalies(INITIAL_ANOMALIES);
    setInvoices(INITIAL_INVOICES);
    setBudgets(INITIAL_DEPARTMENT_BUDGETS);
    setPaymentSchedule(INITIAL_PAYMENT_SCHEDULE);
    setProposals(INITIAL_DECISION_PROPOSALS);
    setWorkflowRules(INITIAL_WORKFLOW_RULES);
    setDuplicateHoldExecuted(false);
    setSimulationParams(defaultSimulationParams);

    showToast('Demo workspace reset to initial connected state', 'info');
  };

  return (
    <FinancialContext.Provider
      value={{
        role,
        setRole,
        workspaceName,
        dateRange,
        setDateRange,
        themeMode,
        actualTheme,
        setThemeMode,
        toggleTheme,
        sources,
        qualityIssues,
        transactions,
        anomalies,
        invoices,
        budgets,
        paymentSchedule,
        proposals,
        workflowRules,
        forecastData,
        availableCash,
        netCashFlow30d,
        outstandingPayables,
        openCriticalRisksCount,
        refreshSource,
        addTransaction,
        importTransactions,
        updateAnomalyStatus,
        assignAnomaly,
        placeInvoiceHold,
        reallocateBudget,
        createProposal,
        submitProposalForApproval,
        approveProposal,
        rejectProposal,
        executeProposal,
        toggleRule,
        addWorkflowRule,
        simulationParams,
        setSimulationParams,
        simulationResult,
        savedScenarios,
        saveScenario,
        loadScenario,
        deleteScenario,
        resetSimulation,
        copilotOpen,
        setCopilotOpen,
        copilotMessages,
        sendCopilotMessage,
        clearCopilotMessages,
        toasts,
        showToast,
        resetDemoData,
        duplicateHoldExecuted,
        isBackendConnected,
        isAuthenticated,
        login,
        logout
      }}
    >
      {children}
    </FinancialContext.Provider>
  );
};

export const useFinancial = () => {
  const context = useContext(FinancialContext);
  if (!context) {
    throw new Error('useFinancial must be used within a FinancialProvider');
  }
  return context;
};
