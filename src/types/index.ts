// FINVORA TypeScript Data Models

export type UserRole = 'analyst' | 'manager';

export interface SourceConnection {
  id: string;
  name: string;
  type: 'bank' | 'erp' | 'gateway' | 'accounting' | 'payroll';
  status: 'connected' | 'syncing' | 'error' | 'disconnected';
  lastSyncTime: string;
  recordCount: number;
  healthScore: number; // 0 - 100
  accountNumber?: string;
  description: string;
}

export interface Transaction {
  id: string;
  date: string;
  referenceNo: string;
  description: string;
  vendorId?: string;
  vendorName: string;
  category: 'Software & Cloud' | 'Logistics & Supply' | 'Office & Facilities' | 'Legal & Professional' | 'Marketing & Media' | 'Salaries & Benefits' | 'Capital Equipment' | 'Customer Revenue';
  department: 'Engineering' | 'Marketing' | 'Sales & Operations' | 'IT & Infrastructure' | 'HR & Admin' | 'Finance & Legal';
  amount: number;
  type: 'inflow' | 'outflow';
  status: 'cleared' | 'pending' | 'flagged' | 'held';
  source: string;
  isAnomaly?: boolean;
  notes?: string;
}

export interface AnomalyRecord {
  id: string;
  title: string;
  type: 'duplicate_invoice' | 'unusual_transaction' | 'abnormal_vendor_activity' | 'payment_risks' | 'budget_deviations';
  severity: 'critical' | 'warning' | 'info';
  detectedDate: string;
  vendorName: string;
  amount: number;
  estimatedExposure: number;
  status: 'open' | 'under_review' | 'held' | 'resolved' | 'dismissed';
  confidenceScore: number; // e.g. 96%
  ruleTriggered: string;
  evidence: {
    label: string;
    value: string;
    matchHighlight?: boolean;
  }[];
  supportingRecords: {
    recordId: string;
    description: string;
    date: string;
    amount: number;
    source: string;
  }[];
  recommendedAction: string;
  assignedTo?: string;
  reviewHistory: {
    timestamp: string;
    user: string;
    action: string;
    note: string;
  }[];
  dismissReason?: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorCategory: string;
  department: string;
  amount: number;
  issueDate: string;
  dueDate: string;
  status: 'pending_approval' | 'approved' | 'on_hold' | 'paid' | 'overdue' | 'disputed';
  riskLevel: 'high' | 'medium' | 'low';
  priorityScore: number; // 1-100
  priorityReason: string;
  isDuplicateCandidate: boolean;
  duplicateMatchedId?: string;
  gstNumber: string;
  paymentTerms: string;
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }[];
}

export interface PaymentScheduleItem {
  id: string;
  invoiceId: string;
  vendorName: string;
  amount: number;
  scheduledDate: string;
  batchName: string;
  status: 'scheduled' | 'on_hold' | 'released' | 'cancelled';
  impactOnCash: number;
  cashBufferAfterPayment: number;
}

export interface DepartmentBudget {
  id: string;
  department: string;
  headOfDepartment: string;
  allocated: number;
  spent: number;
  committed: number;
  projectedMonthEnd: number;
  historicalSpend: number;
  varianceAmount: number; // positive = overspend, negative = underspend
  variancePercentage: number;
  isUnfavorable: boolean; // higher spend is unfavorable
  status: 'on_track' | 'at_risk' | 'over_budget';
  categories: {
    name: string;
    allocated: number;
    spent: number;
  }[];
}

export interface BudgetReallocationProposal {
  id: string;
  fromDeptId: string;
  fromDeptName: string;
  toDeptId: string;
  toDeptName: string;
  amount: number;
  reason: string;
  submittedAt: string;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
}

export interface CashForecastPoint {
  date: string;
  dayIndex: number;
  isHistorical: boolean;
  actualBalance?: number;
  forecastBalanceBase: number;
  forecastBalanceOptimistic: number;
  forecastBalanceConservative: number;
  uncertaintyUpper: number;
  uncertaintyLower: number;
  inflows: number;
  outflows: number;
  netCashFlow: number;
}

export type ForecastRiskLevel = 'SAFE' | 'WATCH' | 'HIGH_RISK' | 'CRITICAL';

export interface RiskReasonItem {
  category: 'invoice' | 'budget' | 'trend';
  title: string;
  detail: string;
  impact_amount?: number;
  entity_name?: string;
}

export interface AgingBucket {
  range: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface SimulationParams {
  name?: string;
  horizonDays: 30 | 60;
  revenueChangePct: number; // -50% to +50%
  collectionDelayDays: number; // 0 to 60 days
  expenseChangePct: number; // -50% to +50%
  paymentRescheduleDays: number; // 0 to 60 days
  capexHiringCost: number; // ₹0 to ₹1,00,00,000
  capexDay?: number; // 1 to 60
  affectedScope?: string;
  baselineReference?: string;
}

export interface SimulationResult {
  endingCash: number;
  lowestCash: number;
  shortfallDate: string | null;
  shortfallAmount: number;
  isReserveBreached: boolean;
  isNegativeCashBreached: boolean;
  reserveThreshold: number;
  baselineEndingCash: number;
  baselineLowestCash: number;
  deltaCash: number;
  delayedBeyondHorizonAmount: number;
  operatingResultImpact: number;
  explanation: string[];
  keyDrivers: { label: string; impact: number; description: string }[];
  simulatedPoints: {
    date: string;
    dayIndex: number;
    baseline: number;
    simulated: number;
  }[];
}

export interface SavedScenario {
  id: string;
  name: string;
  createdAt: string;
  params: SimulationParams;
  endingCash: number;
  lowestCash: number;
  deltaCash: number;
  notes: string;
  revision?: number;
}

export interface FinvoraRecommendation {
  title: string;
  executive_summary: string;
  feasibility_score: number;
  financial_impact: string;
  risk_level: 'Low' | 'Moderate' | 'High' | string;
  action_steps: string[];
  proposal_recommendation: string;
  audit_confidence?: string;
}

export interface ScenarioChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  timestamp: string;
  text: string;
  sourceChips?: string[];
  proposedAssumptions?: SimulationParams;
  scenarioRevision?: number;
  isInterpretation?: boolean;
  resultSnapshot?: {
    endingCash: number;
    deltaCash: number;
    lowestCash: number;
    isReserveBreached: boolean;
  };
  followUpSuggestions?: string[];
  isUnsupported?: boolean;
  recommendation?: FinvoraRecommendation;
  recommendationLoading?: boolean;
  userQuery?: string;
  simulationResult?: SimulationResult;
}

export interface DecisionProposal {
  id: string;
  title: string;
  type: 'payment_hold' | 'budget_reallocation' | 'payment_approval' | 'capex_freeze';
  severity: 'critical' | 'warning' | 'info';
  amount: number;
  description: string;
  evidence: string[];
  expectedImpact: string;
  assumptions: string[];
  confidence: number;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'executed';
  requestedBy: string;
  assignedReviewer: string;
  createdAt: string;
  updatedAt: string;
  rejectionReason?: string;
  targetEntityId?: string; // invoiceId, deptId, anomalyId
  executionResultSummary?: string;
}

export interface WorkflowRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  isActive: boolean;
  triggerCount: number;
}

export interface CopilotKPIs {
  accuracy: number;        // e.g. 97.4 (% confidence / accuracy)
  feasibility: number;     // e.g. 95 (% execution / implementation feasibility)
  impact?: string;         // e.g. "₹6.80L Protected"
  feasibilityNote?: string;// e.g. "Instant payment hold available via CFO sign-off"
  auditConfidence?: 'High' | 'Very High' | 'Verified';
}

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'finvora';
  timestamp: string;
  text: string;
  kpis?: CopilotKPIs;
  citations?: {
    type: 'invoice' | 'vendor' | 'department' | 'risk';
    title: string;
    referenceId: string;
  }[];
  suggestedActions?: {
    label: string;
    actionType: 'navigate' | 'open_modal' | 'draft_proposal' | 'filter';
    payload: string;
  }[];
}

export interface DataQualityIssue {
  id: string;
  type: 'missing_gst' | 'duplicate_hash' | 'date_anomaly' | 'unmapped_category';
  severity: 'high' | 'medium' | 'low';
  title: string;
  count: number;
  sampleEntity: string;
  action: string;
}
