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
