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
