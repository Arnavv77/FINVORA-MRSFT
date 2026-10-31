import { AnomalyRecord, DepartmentBudget, CashForecastPoint, FinvoraRecommendation, RiskReasonItem, ForecastRiskLevel } from '../types';

const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000/api';
const cleanBase = rawBase.replace(/\/+$/, '');
const API_BASE = cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`;


export interface DashboardSummaryResponse {
  total_balance: number;
  monthly_inflow: number;
  monthly_outflow: number;
  open_risk_count: number;
  budget_health_pct: number;
}

export interface ForecastApiResponse {
  points: CashForecastPoint[];
  dates: string[];
  predicted: number[];
  baseline: number[];
  scenario_label?: string;
  buffer_amount?: number;
  risk_level?: ForecastRiskLevel;
  projected_closing_cash?: number;
  risk_reasons?: RiskReasonItem[];
  suggested_actions?: string[];
}

export interface SimulationAdjustment {
  type: string; // 'delay_payment' | 'add_expense'
  vendor_id?: number;
  amount?: number;
  days?: number;
}

export interface RiskActionResponse {
  id: number | string;
  status: string;
  risk_type?: string;
  score?: number;
}

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`API Error [${res.status}] ${res.statusText}: ${errorText}`);
  }

  return res.json() as Promise<T>;
}

/**
 * 1. Dashboard Summary KPI fetch
 */
export async function fetchDashboardSummary(): Promise<DashboardSummaryResponse> {
  return request<DashboardSummaryResponse>('/dashboard/summary');
}

/**
 * 2. Risk Alerts list
 */
export async function fetchRiskAlerts(status?: string): Promise<AnomalyRecord[]> {
  const query = status && status !== 'all' ? `?status=${encodeURIComponent(status)}` : '?status=all';
  const data = await request<AnomalyRecord[]>(`/risks${query}`);
  return data.map(item => ({
    ...item,
    id: String(item.id),
  }));
}

/**
 * 3. Risk Alert detail
 */
export async function fetchRiskDetail(id: number | string): Promise<AnomalyRecord> {
  const data = await request<AnomalyRecord>(`/risks/${id}`);
  return {
    ...data,
    id: String(data.id),
  };
}

/**
 * 4. Risk Action (approve, dismiss, hold, etc.)
 */
export async function takeRiskAction(
  id: number | string,
  action: string,
  note?: string,
  dismissReason?: string
): Promise<RiskActionResponse> {
  return request<RiskActionResponse>(`/risks/${id}/action`, {
    method: 'POST',
    body: JSON.stringify({ action, note, dismissReason }),
  });
}

/**
 * 5. Cash Forecast
 */
export async function fetchCashForecast(horizon: number = 30): Promise<ForecastApiResponse> {
  return request<ForecastApiResponse>(`/forecast?horizon=${horizon}`);
}

/**
 * 6. Scenario Simulation
 */
export async function simulateScenario(
  adjustments: SimulationAdjustment[],
  horizon: number = 30
): Promise<ForecastApiResponse> {
  return request<ForecastApiResponse>('/simulate', {
    method: 'POST',
    body: JSON.stringify({ adjustments, horizon }),
  });
}

/**
 * 7. Department Budgets
 */
export async function fetchDepartmentBudgets(): Promise<DepartmentBudget[]> {
  return request<DepartmentBudget[]>('/budget');
}

/**
 * 8. Copilot AI Chat
 */
export interface CopilotChatApiResponse {
  reply: string;
  kpis: {
    accuracy: number;
    feasibility: number;
    impact?: string;
    feasibilityNote?: string;
    auditConfidence?: 'High' | 'Very High' | 'Verified';
  };
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

export async function sendCopilotChat(message: string): Promise<CopilotChatApiResponse> {
  return request<CopilotChatApiResponse>('/copilot/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function fetchScenarioRecommendation(
  query: string,
  scenarioParams?: Record<string, any>,
  simulationResult?: Record<string, any>
): Promise<FinvoraRecommendation> {
  return request<FinvoraRecommendation>('/copilot/scenario-recommendation', {
    method: 'POST',
    body: JSON.stringify({
      query,
      scenario_params: scenarioParams,
      simulation_result: simulationResult,
    }),
  });
}

/**
 * 9. Ask FINVORA - MCP-based Bilingual Voice & Text Agent powered by Sarvam AI
 */
export interface ToolTraceItem {
  tool: string;
  arguments: Record<string, any>;
  ok: boolean;
  ms: number;
}

export interface AskFinvoraResponse {
  answer: string;
  sources: string[];
  disclaimer: string;
  language?: string;
  tool_trace?: ToolTraceItem[];
}

export interface VoiceAskResponse {
  transcript: string;
  answer: string;
  audio_base64?: string;
  mime?: string;
  language?: string;
  tool_trace?: ToolTraceItem[];
  sources?: string[];
  disclaimer?: string;
  error?: string | null;
}

export async function askFinvora(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; content: string }> = [],
  language: 'auto' | 'en-IN' | 'hi-IN' = 'auto'
): Promise<AskFinvoraResponse> {
  return request<AskFinvoraResponse>('/ask', {
    method: 'POST',
    body: JSON.stringify({ message, history, language }),
  });
}

export async function askFinvoraVoice(
  audioBlob: Blob,
  language: 'auto' | 'en-IN' | 'hi-IN' = 'auto',
  filename: string = 'recording.webm'
): Promise<VoiceAskResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('language', language);

  const url = `${API_BASE}/ask/voice`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Voice ask error [${res.status}]: ${err}`);
  }

  return res.json() as Promise<VoiceAskResponse>;
}

export interface TranscribeResponse {
  transcript: string;
  language_code: string;
  error?: string | null;
}

export async function transcribeAudio(
  audioBlob: Blob,
  languageHint: 'auto' | 'en-IN' | 'hi-IN' = 'auto',
  filename: string = 'recording.wav'
): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('language_hint', languageHint);

  const url = `${API_BASE}/ask/transcribe`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Transcription error [${res.status}]: ${err}`);
  }

  return res.json() as Promise<TranscribeResponse>;
}

export interface SpeakResponse {
  audio_base64: string;
  mime: string;
  error?: string | null;
}

export async function synthesizeSpeech(
  text: string,
  language: 'en-IN' | 'hi-IN' = 'en-IN'
): Promise<SpeakResponse> {
  return request<SpeakResponse>('/ask/speak', {
    method: 'POST',
    body: JSON.stringify({ text, language }),
  });
}

// ── Context-Aware Financial Intelligence Engine (CAFIE) Client APIs ──────────

export interface CAFIEKPIs {
  total_vendors_analysed: number;
  historical_risk_events: number;
  repeated_vendor_discrepancies: number;
  invoice_mismatches: number;
  duplicate_invoices: number;
  inventory_value_at_risk: number;
  working_capital_blocked: number;
  high_risk_transactions: number;
  estimated_financial_exposure_detected: number;
}

export interface CAFIERecentInvestigation {
  id: number;
  assessment_number: string;
  vendor_name: string;
  invoice_number: string;
  composite_risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  estimated_financial_exposure: number;
  reconciliation_status: string;
  approval_status: string;
  created_at: string;
}

export interface CAFIEOverviewResponse {
  kpis: CAFIEKPIs;
  risk_distribution: { name: string; value: number; color: string }[];
  inventory_summary: {
    total_inventory_value: number;
    ageing_cohorts: { cohort: string; count: number; value: number }[];
  };
  recent_investigations: CAFIERecentInvestigation[];
  connectors: {
    sap_status: string;
    wms_status: string;
    ocr_status: string;
  };
}

export interface CAFIEVendor {
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  category: string;
  risk_score: number;
  behavioral_anomaly_score: number;
  avg_invoice_amount: number;
  avg_lead_time_days: number;
  total_orders_completed: number;
  historical_discrepancy_count: number;
  cumulative_exposure: number;
  verification_status: string;
  bank_name: string;
  bank_account_masked: string;
  ifsc_code: string;
}

export interface CAFIEInventoryToCashResponse {
  total_sku_count: number;
  total_inventory_value: number;
  excess_inventory_value: number;
  working_capital_blocked: number;
  cash_flow_impact_30d: number;
  ageing_cohorts: { cohort: string; count: number; value: number }[];
  category_summary: { category: string; total_items: number; total_value: number; excess_value: number }[];
  reorder_recommendations: {
    sku: string;
    item_name: string;
    category: string;
    current_stock: number;
    safety_stock: number;
    reorder_point: number;
    recommended_reorder_qty: number;
    estimated_reorder_cost: number;
    lead_time_days: number;
    urgency: string;
  }[];
  uncertainty_margin_pct: number;
  assumptions: string;
}

export interface CAFIEReconciliationItem {
  id: number;
  assessment_number: string;
  vendor_id: number;
  vendor_name: string;
  po_number: string;
  grn_number: string;
  invoice_number: string;
  total_invoice_amount: number;
  three_way_match_score: number;
  composite_risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  estimated_financial_exposure: number;
  reconciliation_status: string;
  approval_status: string;
  is_synthetic_demo: boolean;
  created_at: string;
}

export interface CAFIELineItemDiff {
  sku: string;
  description: string;
  po_quantity: number;
  grn_quantity: number;
  invoice_quantity: number;
  po_unit_price: number;
  invoice_unit_price: number;
  quantity_delta: number;
  price_delta: number;
  status: 'matched' | 'mismatch';
}

export interface CAFIEReconciliationDetailResponse {
  assessment: {
    id: number;
    assessment_number: string;
    vendor_id: number;
    vendor_name: string;
    po_number: string;
    grn_number: string;
    invoice_number: string;
    invoice_total: number;
    invoice_bank: string;
    three_way_match_score: number;
    vendor_behavior_score: number;
    inventory_impact_score: number;
    memory_risk_score: number;
    composite_risk_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    estimated_financial_exposure: number;
    reconciliation_status: string;
    approval_status: string;
    is_synthetic_demo: boolean;
    discrepancy_details: {
      match_score: number;
      reconciliation_status: string;
      has_quantity_mismatch: boolean;
      has_price_mismatch: boolean;
      has_tax_mismatch: boolean;
      duplicate_found: boolean;
      total_financial_exposure: number;
      line_item_diffs: CAFIELineItemDiff[];
    };
    evidence: { layer: string; title: string; status: string; detail: string }[];
    explanation: string;
    recommended_action: string;
    created_at: string;
  };
  recalled_memories: {
    id: number;
    event_category: string;
    event_date: string;
    severity: string;
    financial_impact: number;
    source_documents: Record<string, any>;
    supporting_evidence: { metric: string; expected: string; actual: string; variance: string }[];
    resolution_status: string;
    authorized_manager_remarks?: string;
  }[];
  approval_history: {
    id: number;
    action: string;
    previous_status: string;
    new_status: string;
    manager_remarks: string;
    user_id: string;
    user_role: string;
    created_at: string;
  }[];
}

export interface CAFIEMemoryEvent {
  id: number;
  vendor_id: number;
  vendor_name: string;
  transaction_ref: string;
  event_category: string;
  event_date: string;
  severity: 'critical' | 'warning' | 'info';
  financial_impact: number;
  source_documents: Record<string, any>;
  supporting_evidence: { metric: string; expected: string; actual: string; variance: string }[];
  risk_category: string;
  resolution_status: string;
  authorized_manager_remarks?: string;
}

export interface CAFIEMemoryResponse {
  events: CAFIEMemoryEvent[];
  total_records: number;
  cumulative_unresolved_exposure: number;
}

export interface CAFIEAuditLogItem {
  id: number;
  assessment_id: number;
  assessment_number: string;
  action: string;
  previous_status: string;
  new_status: string;
  manager_remarks: string;
  user_id: string;
  user_role: string;
  created_at: string;
}

export async function fetchCAFIEOverview(): Promise<CAFIEOverviewResponse> {
  return request<CAFIEOverviewResponse>('/cafie/overview');
}

export async function fetchCAFIEVendors(search?: string, riskFilter?: string): Promise<{ vendors: CAFIEVendor[]; total_count: number }> {
  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (riskFilter) params.append('risk_filter', riskFilter);
  const q = params.toString() ? '?' + params.toString() : '';
  return request<{ vendors: CAFIEVendor[]; total_count: number }>('/cafie/vendors' + q);
}

export async function fetchCAFIEInventoryToCash(): Promise<CAFIEInventoryToCashResponse> {
  return request<CAFIEInventoryToCashResponse>('/cafie/inventory-to-cash');
}

export async function fetchCAFIEReconciliations(status?: string, riskLevel?: string): Promise<{ reconciliations: CAFIEReconciliationItem[]; count: number }> {
  const params = new URLSearchParams();
  if (status && status !== 'all') params.append('status', status);
  if (riskLevel && riskLevel !== 'all') params.append('risk_level', riskLevel);
  const q = params.toString() ? '?' + params.toString() : '';
  return request<{ reconciliations: CAFIEReconciliationItem[]; count: number }>('/cafie/reconciliations' + q);
}

export async function fetchCAFIEReconciliationDetail(assessmentId: number | string): Promise<CAFIEReconciliationDetailResponse> {
  return request<CAFIEReconciliationDetailResponse>('/cafie/reconciliations/' + assessmentId);
}

export async function fetchCAFIEMemory(vendorId?: number, category?: string, severity?: string, resolution?: string): Promise<CAFIEMemoryResponse> {
  const params = new URLSearchParams();
  if (vendorId) params.append('vendor_id', String(vendorId));
  if (category && category !== 'all') params.append('category', category);
  if (severity && severity !== 'all') params.append('severity', severity);
  if (resolution && resolution !== 'all') params.append('resolution', resolution);
  const q = params.toString() ? '?' + params.toString() : '';
  return request<CAFIEMemoryResponse>('/cafie/memory' + q);
}

export async function fetchCAFIEVendorTimeline(vendorId: number): Promise<any> {
  return request<any>('/cafie/memory/timeline/' + vendorId);
}

export async function takeCAFIEAction(
  assessmentId: number,
  action: 'approve' | 'reject' | 'hold_for_verification',
  managerRemarks: string,
  userId: string = 'manager_finvora',
  userRole: string = 'manager'
): Promise<any> {
  return request<any>('/cafie/actions/' + assessmentId, {
    method: 'POST',
    body: JSON.stringify({
      action,
      manager_remarks: managerRemarks,
      user_id: userId,
      user_role: userRole,
    }),
  });
}

export async function fetchCAFIEAuditTrail(): Promise<{ audit_trail: CAFIEAuditLogItem[]; total_records: number }> {
  return request<{ audit_trail: CAFIEAuditLogItem[]; total_records: number }>('/cafie/audit-trail');
}

export async function runCAFIELaptopsDemo(): Promise<any> {
  return request<any>('/cafie/demo/run-laptops-scenario', {
    method: 'POST',
  });
}

export async function uploadCAFIEDocument(file: File): Promise<any> {
  const formData = new FormData();
  formData.append('file', file);
  const url = API_BASE + '/cafie/documents/extract';
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error('Document extraction error [' + res.status + ']: ' + err);
  }
  return res.json();
}


// ── Model 2 Dedicated Typed APIs ──────────────────────────────────────────────

export interface CAFIEMODEL2Transaction {
  id: number;
  invoice_number: string;
  invoice_date: string;
  vendor_id: number;
  vendor_name: string;
  po_number: string;
  grn_number: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  bank_name: string;
  bank_account_masked: string;
  status: string;
  has_assessment: boolean;
  assessment_id: number | null;
  assessment_number: string | null;
  version: number;
  composite_risk_score: number;
  risk_level: string;
  policy_gate: string;
  payment_at_risk: number;
  combined_exposure: number;
  sap_posting_status: string | null;
}

export interface CAFIEMODEL2PipelineStage {
  stage: string;
  execution_time_ms: number;
  status: string;
}

export interface CAFIEMODEL2EvidenceItem {
  id: string;
  layer: string;
  rule_code: string;
  title: string;
  explanation: string;
  weight: number;
  supporting_events: string[];
  financial_exposure: number;
}

export interface CAFIEMODEL2Assessment {
  id: number;
  assessment_number: string;
  version: number;
  config_version: string;
  invoice_id: number;
  invoice_number: string;
  invoice_total: number;
  vendor_id: number;
  vendor_name: string;
  po_number: string;
  grn_number: string;
  composite_risk_score: number;
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  policy_gate: string;
  policy_gate_reasons: string[];
  payment_at_risk: number;
  historical_unresolved_exposure: number;
  combined_exposure: number;
  exposure_averted: number;
  three_way_match_score: number;
  reconciliation_status: string;
  approval_status: string;
  explanation: string;
  recommended_action: string;
  evidence: CAFIEMODEL2EvidenceItem[];
  discrepancy_details: any;
  historical_memory_refs: number[];
  pipeline_execution_stages: CAFIEMODEL2PipelineStage[];
  total_execution_time_ms: number;
  sap_posting_status: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CAFIEMODEL2VendorTimeline {
  vendor_id: number;
  vendor_name: string;
  category: string;
  vendor_code: string;
  delivery_fill_rate: number;
  historical_avg_order_value: number;
  weighted_avg_unit_price: number;
  historical_unresolved_exposure: number;
  discrepancy_count: number;
  events: {
    id: number;
    date: string;
    category: string;
    severity: string;
    impact: number;
    status: string;
    source_documents: any;
    supporting_evidence: any;
    remarks: string;
  }[];
}

export interface CAFIEMODEL2InventorySummary {
  total_sku_count: number;
  total_stock_value: number;
  total_excess_inventory_value: number;
  working_capital_blocked: number;
  demo_sku: {
    sku: string;
    name: string;
    opening_stock: number;
    receipt_qty: number;
    stock_after_receipt: number;
    monthly_demand: number;
    demand_90d: number;
    demand_uncertainty: number;
    excess_stock: number;
    excess_value: number;
    days_of_cover: number;
    unit_cost: number;
    six_month_issues: number[];
    forecast_range: string;
  };
  all_items: any[];
}

export interface CAFIEMODEL2AuditItem {
  id: number;
  assessment_id: number;
  assessment_number: string;
  action: string;
  previous_status: string;
  new_status: string;
  manager_remarks: string;
  verification_method: string | null;
  verification_date: string | null;
  user_id: string;
  user_role: string;
  created_at: string;
}

export async function resetCAFIEMODEL2Demo(companyId: number = 1): Promise<any> {
  return request<any>('/cafie/demo/reset?company_id=' + companyId, { method: 'POST' });
}

export async function fetchCAFIEMODEL2Transactions(companyId: number = 1): Promise<{ transactions: CAFIEMODEL2Transaction[]; count: number }> {
  return request<{ transactions: CAFIEMODEL2Transaction[]; count: number }>('/cafie/transactions?company_id=' + companyId);
}

export async function assessCAFIEMODEL2Transaction(invoiceId: number, forceReassess: boolean = false, companyId: number = 1): Promise<any> {
  return request<any>('/cafie/transactions/' + invoiceId + '/assess?company_id=' + companyId + '&force_reassess=' + forceReassess, {
    method: 'POST',
  });
}

export async function fetchCAFIEMODEL2Assessment(assessmentId: number, companyId: number = 1): Promise<CAFIEMODEL2Assessment> {
  return request<CAFIEMODEL2Assessment>('/cafie/assessments/' + assessmentId + '?company_id=' + companyId);
}

export async function takeCAFIEMODEL2Action(
  assessmentId: number,
  payload: {
    action: string;
    manager_remarks?: string;
    verification_confirmed?: boolean;
    verification_method?: string;
    user_id?: string;
    user_role?: string;
    company_id?: number;
  }
): Promise<any> {
  return request<any>('/cafie/assessments/' + assessmentId + '/action', {
    method: 'POST',
    body: JSON.stringify({
      action: payload.action,
      manager_remarks: payload.manager_remarks || '',
      verification_confirmed: payload.verification_confirmed !== undefined ? payload.verification_confirmed : true,
      verification_method: payload.verification_method || 'DIRECT_PHONE_CALLBACK_TO_CFO',
      user_id: payload.user_id || 'manager_finvora',
      user_role: payload.user_role || 'manager',
      company_id: payload.company_id || 1,
    }),
  });
}

export async function reassessCAFIEMODEL2Assessment(assessmentId: number, companyId: number = 1): Promise<any> {
  return request<any>('/cafie/assessments/' + assessmentId + '/reassess?company_id=' + companyId, {
    method: 'POST',
  });
}

export async function fetchCAFIEMODEL2VendorTimeline(vendorId: number, companyId: number = 1): Promise<CAFIEMODEL2VendorTimeline> {
  return request<CAFIEMODEL2VendorTimeline>('/cafie/vendors/' + vendorId + '/timeline?company_id=' + companyId);
}

export async function fetchCAFIEMODEL2InventorySummary(companyId: number = 1): Promise<CAFIEMODEL2InventorySummary> {
  return request<CAFIEMODEL2InventorySummary>('/cafie/inventory/summary?company_id=' + companyId);
}

export async function fetchCAFIEMODEL2Audit(companyId: number = 1): Promise<{ audit_trail: CAFIEMODEL2AuditItem[]; count: number }> {
  return request<{ audit_trail: CAFIEMODEL2AuditItem[]; count: number }>('/cafie/audit?company_id=' + companyId);
}


// ── CAFIE Model 3 Integration, Intelligence & Reliability Client APIs ─────────

export interface CAFIEModel3ServiceInfo {
  service_id: string;
  name: string;
  version: string;
  status: 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'MOCK';
  description: string;
  is_mock: boolean;
  endpoint_or_module: string;
  latency_ms: number;
  error_message?: string;
}

export interface CAFIEModel3AdapterStatus {
  adapter: string;
  status: string;
  integration_mode: string;
  latency_ms?: number;
  timestamp?: string;
  [key: string]: any;
}

export interface CAFIEModel3HealthReport {
  system_status: string;
  version: string;
  uptime_seconds: number;
  timestamp: string;
  components: Array<{
    name: string;
    status: string;
    latency_ms: number;
    details: Record<string, any>;
  }>;
}

export interface CAFIEModel3WorkflowResult {
  workflow_id: string;
  invoice_id: number;
  company_id: number;
  status: string;
  model2_assessment_id?: number;
  risk_score: number;
  risk_level: string;
  policy_gate: string;
  payment_at_risk: number;
  historical_unresolved_exposure: number;
  combined_exposure: number;
  execution_time_ms: number;
  stage_timings: Array<{
    stage: string;
    status: string;
    execution_time_ms: number;
  }>;
  evidence_count: number;
  memory_events_count: number;
  explanation?: string;
  recommended_action?: string;
  errors: string[];
}

export interface CAFIEModel3AuditItem {
  audit_id: number;
  workflow_id: string;
  transaction_id: number;
  vendor_id: number;
  timestamp: string;
  status: string;
  risk_score: number;
  risk_level: string;
  policy_gate: string;
  manager_action?: string;
  feedback_status?: string;
  error_info?: string;
}

export async function fetchCAFIEModel3Health(): Promise<CAFIEModel3HealthReport> {
  return request<CAFIEModel3HealthReport>('/cafie/model3/health');
}

export async function fetchCAFIEModel3Services(): Promise<{ services: CAFIEModel3ServiceInfo[]; total_count: number }> {
  return request<{ services: CAFIEModel3ServiceInfo[]; total_count: number }>('/cafie/model3/services');
}

export async function fetchCAFIEModel3Adapters(): Promise<{ adapters: CAFIEModel3AdapterStatus[]; all_mock: boolean; mode: string }> {
  return request<{ adapters: CAFIEModel3AdapterStatus[]; all_mock: boolean; mode: string }>('/cafie/model3/adapters');
}

export async function executeCAFIEModel3Workflow(invoiceId: number, forceReassess: boolean = false, companyId: number = 1): Promise<CAFIEModel3WorkflowResult> {
  return request<CAFIEModel3WorkflowResult>('/cafie/model3/workflow/execute', {
    method: 'POST',
    body: JSON.stringify({
      invoice_id: invoiceId,
      company_id: companyId,
      force_reassess: forceReassess,
    }),
  });
}

export async function fetchCAFIEModel3Audit(limit: number = 50): Promise<{ audit_records: CAFIEModel3AuditItem[]; count: number }> {
  return request<{ audit_records: CAFIEModel3AuditItem[]; count: number }>('/cafie/model3/audit?limit=' + limit);
}


// ============================================================================
// CAFIE MODEL 4 — Enterprise Document Intelligence & Predictive Validation
// ============================================================================

export interface Model4PurchaseOrder {
  id?: number;
  po_number: string;
  vendor_code: string;
  vendor_name: string;
  department: string;
  issue_date: string;
  delivery_due_date: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  approval_status: string;
  items: Array<{
    line_number: number;
    item_code: string;
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    unit_of_measure?: string;
  }>;
}

export interface Model4GoodsReceiptNote {
  id?: number;
  grn_number: string;
  po_number: string;
  vendor_code: string;
  receipt_date: string;
  warehouse_id: string;
  carrier_name?: string;
  received_quantity: number;
  accepted_quantity: number;
  rejected_quantity: number;
  quality_inspection_status: string;
  rejection_reason?: string;
  items: Array<{
    line_number: number;
    item_code: string;
    description: string;
    received_quantity: number;
    accepted_quantity: number;
    rejected_quantity: number;
    rejection_reason?: string;
  }>;
}

export interface Model4Invoice {
  id?: number;
  invoice_number: string;
  po_number?: string;
  vendor_code: string;
  vendor_name: string;
  invoice_date: string;
  due_date: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  currency: string;
  bank_name?: string;
  bank_account_number?: string;
  ifsc_code?: string;
  payment_status: string;
  items: Array<{
    line_number: number;
    item_code: string;
    description: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  raw_text?: string;
}

export interface Model4VendorMaster {
  id?: number;
  vendor_code: string;
  vendor_name: string;
  category: string;
  gst_number?: string;
  registered_bank_name?: string;
  registered_bank_account?: string;
  registered_ifsc?: string;
  avg_lead_time_days: number;
  delivery_fill_rate: number;
  total_orders_completed: number;
  discrepancy_count: number;
  bank_change_count: number;
  compliance_status: string;
  risk_label: string;
  raw_text?: string;
}

export interface Model4ValidationResult {
  id: number;
  validation_number: string;
  invoice_number: string;
  po_number?: string;
  grn_number?: string;
  vendor_code: string;
  vendor_name: string;
  three_way_match_status: string;
  quantity_delta: number;
  price_delta: number;
  is_duplicate: boolean;
  doc_classification_label: string;
  doc_classification_confidence: number;
  invoice_risk_prediction: string;
  invoice_risk_confidence: number;
  anomaly_prediction: string;
  anomaly_score: number;
  vendor_risk_prediction: string;
  vendor_risk_confidence: number;
  composite_risk_score: number;
  risk_level: string;
  financial_exposure: number;
  recommendations: string[];
  supporting_evidence: Array<{
    category: string;
    severity: string;
    description: string;
    observed_value: any;
    expected_value: any;
  }>;
  decision_status: string;
  created_at?: string;
  decisions?: Array<{
    id: number;
    action: string;
    previous_status: string;
    new_status: string;
    manager_remarks?: string;
    user_id: string;
    created_at?: string;
  }>;
}

export interface Model4DashboardTelemetry {
  total_purchase_orders: number;
  total_goods_receipts: number;
  total_invoices: number;
  total_vendors: number;
  total_validations: number;
  match_status_breakdown: Record<string, number>;
  risk_level_breakdown: Record<string, number>;
  pending_review_count: number;
  approved_count: number;
  rejected_count: number;
  held_count: number;
  total_financial_exposure: number;
  ml_models: Record<string, any>;
  recent_validations: Model4ValidationResult[];
  is_synthetic: boolean;
  dataset_version: string;
  batch_name?: string;
}

export interface Model4DatasetsResponse {
  dataset_version: string;
  is_synthetic: boolean;
  notice: string;
  purchase_orders: Model4PurchaseOrder[];
  goods_receipt_notes: Model4GoodsReceiptNote[];
  invoices: Model4Invoice[];
  vendor_master: Model4VendorMaster[];
}

export interface Model4ResetResponse {
  success: boolean;
  message: string;
  seed: number;
  batch_name?: string;
  dataset_version: string;
  timestamp: string;
  counts: Record<string, number>;
  metrics: Record<string, any>;
}

export async function fetchCAFIEModel4Dashboard(): Promise<Model4DashboardTelemetry> {
  return request<Model4DashboardTelemetry>('/cafie/model4/dashboard');
}

export async function fetchCAFIEModel4Datasets(): Promise<Model4DatasetsResponse> {
  return request<Model4DatasetsResponse>('/cafie/model4/datasets');
}

export async function fetchCAFIEModel4Performance(): Promise<any> {
  return request<any>('/cafie/model4/models/performance');
}

export async function resetCAFIEModel4Demo(seed: number = 42): Promise<Model4ResetResponse> {
  return request<Model4ResetResponse>('/cafie/model4/demo/reset', {
    method: 'POST',
    body: JSON.stringify({ seed }),
  });
}

export async function fetchCAFIEModel4Validations(): Promise<Model4ValidationResult[]> {
  return request<Model4ValidationResult[]>('/cafie/model4/validations');
}

export async function fetchCAFIEModel4ValidationDetail(id: number): Promise<Model4ValidationResult> {
  return request<Model4ValidationResult>(`/cafie/model4/validations/${id}`);
}

export async function submitCAFIEModel4Decision(
  validationId: number,
  action: 'approve' | 'reject' | 'hold',
  remarks?: string
): Promise<Model4ValidationResult> {
  return request<Model4ValidationResult>('/cafie/model4/decisions', {
    method: 'POST',
    body: JSON.stringify({
      validation_id: validationId,
      action,
      manager_remarks: remarks,
      user_id: 'manager_1',
    }),
  });
}


export interface ExtractedBillDetails {
  invoice_number: string;
  po_number?: string;
  vendor_code: string;
  vendor_name: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  bank_account_number?: string;
  ifsc_code?: string;
  items: Array<Record<string, any>>;
  ocr_confidence: number;
  extraction_source: string;
}

export interface ThreeWayComparisonView {
  invoice_number: string;
  po_number?: string;
  grn_number?: string;
  vendor_name: string;
  quantity_status: string;
  price_status: string;
  bank_status: string;
  billed_quantity: number;
  accepted_quantity: number;
  billed_unit_price: number;
  contract_unit_price: number;
  registered_bank_account?: string;
  invoiced_bank_account?: string;
}

export interface BillUploadResponse {
  success: boolean;
  message: string;
  extracted_bill: ExtractedBillDetails;
  three_way_comparison: ThreeWayComparisonView;
  validation_result: Model4ValidationResult;
  raw_ocr_text: string;
}

export async function uploadCAFIEModel4BillFile(
  file?: File,
  rawText?: string,
  poNumber?: string,
  grnNumber?: string,
  vendorCode?: string
): Promise<BillUploadResponse> {
  const formData = new FormData();
  if (file) {
    formData.append('file', file);
  }
  if (rawText) {
    formData.append('raw_text', rawText);
  }
  if (poNumber) {
    formData.append('po_number', poNumber);
  }
  if (grnNumber) {
    formData.append('grn_number', grnNumber);
  }
  if (vendorCode) {
    formData.append('vendor_code', vendorCode);
  }

  const rawBase = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://127.0.0.1:8000/api';
  const cleanBase = rawBase.replace(/\/+$/, '');
  const API_BASE = cleanBase.endsWith('/api') ? cleanBase : `${cleanBase}/api`;

  const res = await fetch(`${API_BASE}/cafie/model4/upload-bill`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to upload bill');
  }
  return res.json();
}

export async function uploadCAFIEModel4BillJson(
  rawText: string,
  poNumber?: string,
  grnNumber?: string,
  vendorCode?: string
): Promise<BillUploadResponse> {
  return request<BillUploadResponse>('/cafie/model4/upload-bill-json', {
    method: 'POST',
    body: JSON.stringify({
      raw_text: rawText,
      po_number: poNumber,
      grn_number: grnNumber,
      vendor_code: vendorCode,
    }),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// IDP Multi-Mode Payment Intelligence & Automated Reconciliation
// ─────────────────────────────────────────────────────────────────────────────

export interface IDPPaymentDashboardItem {
  payment_id: number;
  payment_mode: string;
  amount: number;
  reference_id?: string;
  payment_date?: string;
  payer_name?: string;
  payer_vpa?: string;
  narration?: string;
  status: string;
  match_tier: string;
  confidence_score: number;
  suggested_debtor: string;
  suggested_debtor_code?: string;
  suggested_ledger: string;
  explanation: string;
  evidence_count: number;
  has_erp_voucher: boolean;
  erp_voucher_number?: string;
}

export interface IDPDashboardResponse {
  status: string;
  company: { name: string; code: string };
  stats: {
    total_incoming: number;
    pending_approval: number;
    posted_reconciled: number;
    duplicate_alerts: number;
    unidentified: number;
    reconciliation_rate: number;
    mode_distribution: Record<string, number>;
  };
  payments: IDPPaymentDashboardItem[];
}

export interface IDPEvidenceItem {
  factor: string;
  description: string;
  weight: number;
  verified: boolean;
}

export interface IDPAlternativeMatch {
  debtor_id: number;
  debtor_name: string;
  debtor_code: string;
  suggested_invoice_ids: number[];
  confidence_score: number;
  reason: string;
}

export interface IDPRecommendationResponse {
  payment_id: number;
  payment_mode: string;
  amount: number;
  reference_id?: string;
  payment_date: string;
  payer_name?: string;
  payer_vpa?: string;
  narration?: string;
  match_tier: string;
  confidence_score: number;
  suggested_debtor_id?: number;
  suggested_debtor_name?: string;
  suggested_debtor_code?: string;
  suggested_ledger: string;
  suggested_invoices: Array<{
    id: number;
    invoice_number: string;
    total_amount: number;
    paid_amount: number;
    balance_amount: number;
    status: string;
  }>;
  explanation: string;
  evidence_breakdown: IDPEvidenceItem[];
  alternative_matches: IDPAlternativeMatch[];
  status: string;
  is_duplicate_suspect: boolean;
}

export interface IDPHumanApprovalRequest {
  action: 'APPROVE_AND_POST' | 'CORRECT_DEBTOR' | 'CORRECT_INVOICE' | 'SPLIT_PAYMENT' | 'REJECT' | 'MARK_UNIDENTIFIED' | 'SEND_FOR_VERIFICATION';
  approved_by?: string;
  corrected_debtor_id?: number;
  corrected_invoice_ids?: number[];
  corrected_ledger?: string;
  split_allocations?: Array<{ invoice_id: number; amount: number }>;
  remarks?: string;
  simulate_erp_failure?: boolean;
}

export interface IDPHumanApprovalResponse {
  success: boolean;
  payment_id: number;
  action_taken: string;
  message: string;
  erp_voucher_number?: string;
  erp_status?: string;
  tally_xml_snippet?: string;
  memory_feedback_stored: boolean;
}

export interface IDPFederatedModelStatus {
  version: string;
  round_number: number;
  participants_count: number;
  clipping_norm: number;
  epsilon: number;
  delta: number;
  model_weights: Record<string, number>;
  opt_in_status: boolean;
  is_simulated: boolean;
  last_aggregated: string;
  participants_summary: Array<{
    code: string;
    name: string;
    samples: number;
    status: string;
  }>;
}

export async function fetchIDPPaymentDashboard(modeFilter?: string): Promise<IDPDashboardResponse> {
  const query = modeFilter && modeFilter !== 'ALL' ? `?mode_filter=${encodeURIComponent(modeFilter)}` : '';
  return request<IDPDashboardResponse>(`/idp/payments/dashboard${query}`);
}

export async function extractAndMatchIDPPayment(paymentMode: string, payload: any): Promise<IDPRecommendationResponse> {
  return request<IDPRecommendationResponse>('/idp/payments/extract-and-match', {
    method: 'POST',
    body: JSON.stringify({ payment_mode: paymentMode, payload }),
  });
}

export async function executeIDPHumanApprovalAction(
  paymentId: number,
  req: IDPHumanApprovalRequest
): Promise<IDPHumanApprovalResponse> {
  return request<IDPHumanApprovalResponse>(`/idp/payments/${paymentId}/action`, {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function fetchIDPDebtorsList(): Promise<{ status: string; debtors: any[] }> {
  return request<{ status: string; debtors: any[] }>('/idp/payments/debtors');
}

export async function fetchIDPFederatedStatus(): Promise<IDPFederatedModelStatus> {
  return request<IDPFederatedModelStatus>('/idp/payments/federated/status');
}

export async function runIDPFederatedRound(): Promise<any> {
  return request<any>('/idp/payments/federated/train-round', {
    method: 'POST',
    body: JSON.stringify({ differential_privacy_noise: true }),
  });
}

export async function seedIDPPaymentDemo(): Promise<any> {
  return request<any>('/idp/payments/demo/seed', {
    method: 'POST',
  });
}

// ============================================================================
// FINVORA COMPANY LEDGER & MANAGER APPROVAL WORKFLOW
// ============================================================================

export interface LedgerCompany {
  id: number;
  company_code: string;
  name: string;
  financial_year: string;
  currency: string;
  opening_balance: number;
  current_balance: number;
  is_demo: boolean;
  created_at: string;
}

export interface CompanyLedgerSummary {
  company_id: number;
  company_code: string;
  company_name: string;
  financial_year: string;
  currency: string;
  opening_balance: number;
  total_debit: number;
  total_credit: number;
  closing_balance: number;
  total_transactions: number;
  pending_approvals: number;
  approved_transactions: number;
  rejected_transactions: number;
  changes_requested_transactions: number;
  posted_transactions: number;
}

export interface LedgerEntryLineItem {
  id?: number;
  account_id?: number;
  account_name: string;
  entry_type: 'DEBIT' | 'CREDIT' | string;
  amount: number;
  narration?: string;
}

export interface LedgerTransactionItem {
  id: number;
  transaction_number: string;
  transaction_date: string;
  voucher_type: string;
  reference_no: string;
  entity_name: string;
  entity_code?: string;
  ledger_account_name: string;
  description: string;
  total_amount: number;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  approval_status: 'SUBMITTED' | 'UNDER_REVIEW' | 'CHANGES_REQUESTED' | 'APPROVED' | 'REJECTED' | string;
  posting_status: 'UNPOSTED' | 'POSTED' | 'VOIDED' | string;
  manager_remarks?: string;
  finvora_risk_tier: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | string;
  finvora_risk_score: number;
  is_demo: boolean;
}

export interface LedgerTransactionDetail {
  id: number;
  company_id: number;
  company_code: string;
  company_name: string;
  transaction_number: string;
  voucher_type: string;
  transaction_date: string;
  reference_no: string;
  entity_type: string;
  entity_name: string;
  entity_code?: string;
  ledger_account_name: string;
  description: string;
  total_amount: number;
  debit_amount: number;
  credit_amount: number;
  running_balance: number;

  approval_status: string;
  posting_status: string;
  manager_remarks?: string;
  approved_by?: string;
  approved_at?: string;
  rejected_by?: string;
  rejected_at?: string;
  rejection_reason?: string;
  changes_requested_by?: string;
  changes_requested_at?: string;
  changes_requested_remarks?: string;
  posted_by?: string;
  posted_at?: string;
  resubmission_count: number;

  po_number?: string;
  po_amount?: number;
  invoice_number?: string;
  invoice_amount?: number;
  grn_number?: string;
  grn_amount?: number;
  payment_terms?: string;
  supporting_documents: Array<{ name?: string; url?: string; doc_type?: string; filename?: string; type?: string }>;

  finvora_risk_tier: 'LOW_RISK' | 'MEDIUM_RISK' | 'HIGH_RISK' | string;
  finvora_risk_score: number;
  finvora_risk_reasons: string[];
  finvora_recommendation?: string;

  lines: LedgerEntryLineItem[];
  approvals: Array<Record<string, any>>;
  audit_logs: Array<{
    id?: number;
    action: string;
    performed_by_role?: string;
    performed_by_user?: string;
    action_summary?: string;
    summary?: string;
    created_at?: string;
    details?: Record<string, any>;
  }>;
  comments: Array<Record<string, any>>;
  is_demo: boolean;
  created_at: string;
}

export interface ManagerApproveRequest {
  manager_id?: string;
  manager_name?: string;
  remarks?: string;
}

export interface ManagerRejectRequest {
  manager_id?: string;
  manager_name?: string;
  rejection_reason: string;
}

export interface ManagerRequestChangesRequest {
  manager_id?: string;
  manager_name?: string;
  remarks: string;
}

export interface AccountantResubmitRequest {
  accountant_id?: string;
  accountant_name?: string;
  invoice_amount?: number;
  po_amount?: number;
  grn_amount?: number;
  description?: string;
  resubmission_notes: string;
}

export interface LedgerActionResponse {
  success: boolean;
  message: string;
  transaction_id: number;
  approval_status: string;
  posting_status: string;
  updated_balance?: number;
  audit_event_id?: number;
}

export async function fetchLedgerCompanies(): Promise<LedgerCompany[]> {
  return request<LedgerCompany[]>('/company-ledger/companies');
}

export async function fetchCompanyLedgerSummary(companyId: number): Promise<CompanyLedgerSummary> {
  return request<CompanyLedgerSummary>(`/company-ledger/companies/${companyId}/summary`);
}

export async function fetchCompanyLedger(
  companyId: number,
  filters?: {
    search?: string;
    voucher_type?: string;
    approval_status?: string;
    from_date?: string;
    to_date?: string;
  }
): Promise<LedgerTransactionItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append('search', filters.search);
  if (filters?.voucher_type && filters.voucher_type !== 'ALL') params.append('voucher_type', filters.voucher_type);
  if (filters?.approval_status && filters.approval_status !== 'ALL') params.append('status', filters.approval_status);
  if (filters?.from_date) params.append('start_date', filters.from_date);
  if (filters?.to_date) params.append('end_date', filters.to_date);

  const qs = params.toString() ? `?${params.toString()}` : '';
  return request<LedgerTransactionItem[]>(`/company-ledger/companies/${companyId}/ledger${qs}`);
}

export async function fetchLedgerTransactionDetail(transactionId: number): Promise<LedgerTransactionDetail> {
  return request<LedgerTransactionDetail>(`/company-ledger/transactions/${transactionId}`);
}

export async function approveLedgerTransaction(
  transactionId: number,
  data: ManagerApproveRequest
): Promise<LedgerActionResponse> {
  return request<LedgerActionResponse>(`/company-ledger/transactions/${transactionId}/approve`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function rejectLedgerTransaction(
  transactionId: number,
  data: ManagerRejectRequest
): Promise<LedgerActionResponse> {
  return request<LedgerActionResponse>(`/company-ledger/transactions/${transactionId}/reject`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function requestChangesLedgerTransaction(
  transactionId: number,
  data: ManagerRequestChangesRequest
): Promise<LedgerActionResponse> {
  return request<LedgerActionResponse>(`/company-ledger/transactions/${transactionId}/request-changes`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function resubmitLedgerTransaction(
  transactionId: number,
  data: AccountantResubmitRequest
): Promise<LedgerActionResponse> {
  return request<LedgerActionResponse>(`/company-ledger/transactions/${transactionId}/resubmit`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function seedCompanyLedgerDemo(): Promise<{ status: string; message: string; primary_company_id: number }> {
  return request<{ status: string; message: string; primary_company_id: number }>('/company-ledger/demo/seed', {
    method: 'POST',
  });
}
