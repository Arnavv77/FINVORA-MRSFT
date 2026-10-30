import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Send,
  Sparkles,
  Sliders,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Play,
  TrendingDown,
  TrendingUp,
  FileText,
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Trash2,
  Bookmark,
  Check,
  HelpCircle,
  Shield,
  Layers,
  Calendar,
  MessageSquare
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { useFinancial } from '../context/FinancialContext';
import { ChartCard } from '../components/common/ChartCard';
import { Modal } from '../components/common/Modal';
import { FinvoraLogo } from '../components/common/FinvoraLogo';
import { formatINR, formatINRCompact, formatDate } from '../utils/formatters';
import {
  SimulationParams,
  SimulationResult,
  SavedScenario,
  ScenarioChatMessage,
  FinvoraRecommendation
} from '../types';
import {
  DEFAULT_SIMULATION_PARAMS,
  interpretScenarioPrompt,
  calculateScenario
} from '../utils/scenarioEngine';
import { simulateScenario, sendCopilotChat, fetchScenarioRecommendation } from '../lib/api';

const PROMPT_SUGGESTIONS = [
  'What if revenue falls by 10%?',
  'What if customer payments arrive 15 days late?',
  'What if operating expenses rise by 8%?',
  'What if we invest ₹20 lakh in equipment?'
];

// Utility component to render clean, readable messages without raw # or * characters
const CleanFormattedMessage: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 leading-relaxed text-xs">
      {lines.map((line, idx) => {
        // Strip any leading markdown hashes (#)
        const cleanLine = line.replace(/^#{1,6}\s*/, '').trim();

        if (!cleanLine) {
          return <div key={idx} className="h-1" />;
        }

        // Bullet line handling
        const isBullet = cleanLine.startsWith('•') || cleanLine.startsWith('-');
        const content = isBullet ? cleanLine.replace(/^[•\-]\s*/, '') : cleanLine;

        // Split by bold (**...**) or clean any remaining asterisks
        const parts = content.split(/(\*\*.*?\*\*|\*.*?\*)/g);

        const renderedLine = parts.map((part, pIdx) => {
          if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
            const inner = part.replace(/^\*+|\*+$/g, '').replace(/[#*]/g, '');
            return (
              <strong key={pIdx} className="font-semibold text-[var(--text-primary)]">
                {inner}
              </strong>
            );
          }
          return part.replace(/[*#]/g, '');
        });

        // Header detection (e.g., "Simulation Executed" or "Key Financial Drivers")
        const isHeader = !isBullet && (
          line.trim().startsWith('#') ||
          cleanLine.endsWith(':') ||
          cleanLine.toLowerCase().includes('simulation executed') ||
          cleanLine.toLowerCase().includes('key financial drivers') ||
          cleanLine.toLowerCase().includes('scenario stress-test')
        );

        if (isHeader) {
          return (
            <div key={idx} className="font-bold text-[var(--text-primary)] text-xs pt-1 pb-0.5 border-b border-[var(--divider)] mb-1">
              {renderedLine}
            </div>
          );
        }

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-1.5 pl-0.5">
              <span className="text-amber-500 font-bold shrink-0">•</span>
              <span>{renderedLine}</span>
            </div>
          );
        }

        return (
          <p key={idx} className="text-[var(--text-primary)]">
            {renderedLine}
          </p>
        );
      })}
    </div>
  );
};

// Component to render official AI recommendation within What-If simulation chat
const FinvoraRecommendationCard: React.FC<{
  recommendation: FinvoraRecommendation;
  onDraftProposal: (rec: FinvoraRecommendation) => void;
}> = ({ recommendation, onDraftProposal }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const getRiskBadge = (risk: string) => {
    const r = (risk || '').toLowerCase();
    if (r === 'high') {
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    }
    if (r === 'moderate') {
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    }
    return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
  };

  return (
    <div className="mt-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-[var(--surface-subtle)] to-[var(--surface-muted)] overflow-hidden shadow-xs">
      {/* Header bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-3.5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-5 h-5 rounded-md bg-amber-500 text-stone-950 flex items-center justify-center shrink-0 shadow-xs">
            <Sparkles className="w-3 h-3 fill-current" />
          </div>
          <div className="truncate">
            <span className="text-xs font-bold text-[var(--text-primary)] block truncate">
              What FINVORA Recommends
            </span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              AI Strategic Directive
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
            {recommendation.feasibility_score}% Feasible
          </span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getRiskBadge(recommendation.risk_level)}`}>
            {recommendation.risk_level} Risk
          </span>
          {isExpanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
          )}
        </div>
      </div>

      {/* Body content */}
      {isExpanded && (
        <div className="p-3.5 space-y-3 text-xs">
          <div>
            <h4 className="text-xs font-bold text-[var(--text-primary)] leading-tight">
              {recommendation.title.replace(/[*#]/g, '')}
            </h4>
            {recommendation.financial_impact && (
              <span className="inline-block mt-1 text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--card-bg)] text-[var(--text-secondary)] border border-[var(--divider)]">
                Impact: {recommendation.financial_impact.replace(/[*#]/g, '')}
              </span>
            )}
          </div>

          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] bg-[var(--card-bg-elevated)] p-2.5 rounded-lg border border-[var(--divider)]">
            {recommendation.executive_summary.replace(/[*#]/g, '')}
          </p>

          {recommendation.action_steps && recommendation.action_steps.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider block">
                Prescribed Action Steps:
              </span>
              <div className="space-y-1">
                {recommendation.action_steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-[11px] text-[var(--text-primary)]">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[9px] flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{step.replace(/[*#]/g, '')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--divider)] flex items-center justify-between gap-2">
            <span className="text-[10px] text-[var(--text-muted)] italic truncate">
              {recommendation.audit_confidence || 'Verified by Financial Ledger AI'}
            </span>
            <button
              onClick={() => onDraftProposal(recommendation)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-xs shrink-0"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Draft Directive Proposal</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const WhatIfSimulatorPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    simulationParams,
    setSimulationParams,
    simulationResult,
    savedScenarios,
    saveScenario,
    loadScenario,
    deleteScenario,
    resetSimulation,
    createProposal,
    role,
    availableCash,
    actualTheme,
    showToast,
    forecastData,
    duplicateHoldExecuted
  } = useFinancial();

  const isLight = actualTheme === 'light';

  // Workspace Local State
  const [messages, setMessages] = useState<ScenarioChatMessage[]>(() => {
    const cached = sessionStorage.getItem('finvora_what_if_chat');
    return cached ? JSON.parse(cached) : [];
  });

  const [hasRunScenario, setHasRunScenario] = useState<boolean>(() => {
    return sessionStorage.getItem('finvora_what_if_has_run') === 'true';
  });

  const [scenarioRevision, setScenarioRevision] = useState<number>(1);
  const [previousResult, setPreviousResult] = useState<SimulationResult | null>(null);

  // Staged / Draft assumptions proposed by the assistant before "Run scenario" is clicked
  const [stagedParams, setStagedParams] = useState<SimulationParams>(simulationParams);

  // Composer
  const [inputText, setInputText] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Mobile Tabs
  const [activeMobileTab, setActiveMobileTab] = useState<'conversation' | 'results'>('conversation');

  // Modals & Drawers
  const [isAdjustOpen, setIsAdjustOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isSavedListModalOpen, setIsSavedListModalOpen] = useState(false);
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveNotes, setSaveNotes] = useState('');

  // Persist chat and run status
  useEffect(() => {
    sessionStorage.setItem('finvora_what_if_chat', JSON.stringify(messages));
    sessionStorage.setItem('finvora_what_if_has_run', String(hasRunScenario));
  }, [messages, hasRunScenario]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isInterpreting]);

  // Listen for TopBar "Ask FINVORA" focus event
  useEffect(() => {
    const handleFocusEvent = () => {
      textareaRef.current?.focus();
      if (window.innerWidth < 1024) {
        setActiveMobileTab('conversation');
      }
    };
    window.addEventListener('focus-what-if-composer', handleFocusEvent);
    return () => window.removeEventListener('focus-what-if-composer', handleFocusEvent);
  }, []);

  // Handle prompt submission
  const handleSendMessage = async (customText?: string) => {
    const query = (customText ?? inputText).trim();
    if (!query) return;

    // Add User Message
    const userMsg: ScenarioChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: query
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsInterpreting(true);

    // Check if user is explicitly asking for a recommendation (e.g. "What does FINVORA recommend?", "recommend to do")
    const isExplicitRec = /recommend|recommendation|advice|what should (we|i) do|finvora recommend/i.test(query);
    if (isExplicitRec) {
      // Find the last scenario prompt the user asked
      const lastUserPrompt = [...messages].reverse().find(
        m => m.sender === 'user' && !/recommend|advice/i.test(m.text)
      )?.text || stagedParams.name || 'this scenario';

      const recMsgId = `ast-${Date.now()}`;
      const assistantMsg: ScenarioChatMessage = {
        id: recMsgId,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: `Here is FINVORA's official strategic recommendation for "${lastUserPrompt.replace(/[*#]/g, '')}":`,
        recommendationLoading: true,
        userQuery: lastUserPrompt,
        followUpSuggestions: [
          'Run scenario',
          'What if revenue falls by 10%?',
          'Compare with baseline'
        ]
      };
      setMessages(prev => [...prev, assistantMsg]);
      setIsInterpreting(false);

      try {
        const rec = await fetchScenarioRecommendation(lastUserPrompt, stagedParams, simulationResult);
        setMessages(prev =>
          prev.map(m =>
            m.id === recMsgId
              ? { ...m, recommendation: rec, recommendationLoading: false }
              : m
          )
        );
      } catch (err) {
        console.error('Failed to fetch recommendation:', err);
        setMessages(prev =>
          prev.map(m => (m.id === recMsgId ? { ...m, recommendationLoading: false } : m))
        );
      }
      return;
    }

    try {
      // 1. Parse scenario levers locally with advanced multi-intent parser
      const parsed = interpretScenarioPrompt(query, stagedParams);

      // 2. Fetch live copilot context if available
      let backendReply = '';
      try {
        const copilotRes = await sendCopilotChat(query);
        if (copilotRes && copilotRes.reply) {
          backendReply = copilotRes.reply;
        }
      } catch {
        // Backend offline or error - seamlessly continue with intelligent local engine
      }

      // 3. Compose rich display text
      let textToDisplay = parsed.interpretationText;
      if (backendReply && !parsed.hasSpecificLevers) {
        textToDisplay = `${backendReply}\n\n**Proposed Scenario Stress-Test:**\n${parsed.interpretationText}`;
      }

      // Valid interpretation
      const newStaged: SimulationParams = {
        ...stagedParams,
        ...parsed.assumptions,
        name: query.slice(0, 45).trim()
      };
      setStagedParams(newStaged);

      const msgId = `ast-${Date.now()}`;
      const assistantMsg: ScenarioChatMessage = {
        id: msgId,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: textToDisplay,
        sourceChips: ['Reconciled AR Ledger', 'Net-30 Enterprise Terms', 'Q3 Base Plan', 'Predictive ML Engine'],
        proposedAssumptions: newStaged,
        isInterpretation: true,
        userQuery: query,
        recommendationLoading: true,
        followUpSuggestions: [
          'What does FINVORA recommend for this?',
          ...parsed.followUps
        ]
      };

      setMessages(prev => [...prev, assistantMsg]);

      // Concurrently fetch AI recommendation for this specific question
      fetchScenarioRecommendation(query, newStaged, simulationResult)
        .then(rec => {
          setMessages(prev =>
            prev.map(m =>
              m.id === msgId
                ? { ...m, recommendation: rec, recommendationLoading: false }
                : m
            )
          );
        })
        .catch(err => {
          console.warn('AI recommendation background fetch error:', err);
          setMessages(prev =>
            prev.map(m => (m.id === msgId ? { ...m, recommendationLoading: false } : m))
          );
        });

    } catch (err) {
      console.error('Scenario processing error:', err);
      const fallbackParsed = interpretScenarioPrompt(query, stagedParams);
      const msgId = `ast-${Date.now()}`;
      const assistantMsg: ScenarioChatMessage = {
        id: msgId,
        sender: 'assistant',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        text: fallbackParsed.interpretationText,
        sourceChips: ['General Ledger Heuristics', 'Q3 Base Plan'],
        proposedAssumptions: fallbackParsed.assumptions,
        isInterpretation: true,
        userQuery: query,
        recommendationLoading: true,
        followUpSuggestions: [
          'What does FINVORA recommend for this?',
          ...fallbackParsed.followUps
        ]
      };
      setMessages(prev => [...prev, assistantMsg]);

      fetchScenarioRecommendation(query, fallbackParsed.assumptions, simulationResult)
        .then(rec => {
          setMessages(prev =>
            prev.map(m =>
              m.id === msgId
                ? { ...m, recommendation: rec, recommendationLoading: false }
                : m
            )
          );
        })
        .catch(() => {
          setMessages(prev =>
            prev.map(m => (m.id === msgId ? { ...m, recommendationLoading: false } : m))
          );
        });
    } finally {
      setIsInterpreting(false);
    }
  };

  // Run the staged scenario through the deterministic engine and backend simulate API
  const handleExecuteScenario = (paramsToRun?: SimulationParams) => {
    const activeParams = paramsToRun || stagedParams;

    // 1. Calculate FRESH results synchronously using activeParams to eliminate stale closure state
    const freshResult = calculateScenario(activeParams, forecastData || [], duplicateHoldExecuted);

    setPreviousResult(simulationResult);
    setSimulationParams(activeParams);
    setHasRunScenario(true);
    setScenarioRevision(prev => prev + 1);

    // Call backend /api/simulate with scenario adjustments
    const adjustments: Array<{ type: string; days?: number; amount?: number }> = [];
    if (activeParams.collectionDelayDays > 0) {
      adjustments.push({ type: 'delay_payment', days: activeParams.collectionDelayDays });
    }
    if (activeParams.expenseChangePct !== 0) {
      adjustments.push({ type: 'add_expense', amount: Math.abs(activeParams.expenseChangePct) * 10000 });
    }
    if (adjustments.length > 0) {
      simulateScenario(adjustments, activeParams.horizonDays || 60).catch(err => {
        console.warn('Backend simulate call failed:', err);
      });
    }

    if (window.innerWidth < 1024) {
      setActiveMobileTab('results');
    }

    // Compose rich, dynamic, scenario-tailored analysis message
    const isDeficit = freshResult.deltaCash < 0;
    const isSurplus = freshResult.deltaCash > 0;
    const horizon = activeParams.horizonDays || 60;

    // Build specific active levers description
    const leverDescriptions: string[] = [];
    if (activeParams.revenueChangePct !== 0) {
      leverDescriptions.push(`${activeParams.revenueChangePct > 0 ? '+' : ''}${activeParams.revenueChangePct}% Revenue`);
    }
    if (activeParams.collectionDelayDays > 0) {
      leverDescriptions.push(`${activeParams.collectionDelayDays}d Collection Delay`);
    }
    if (activeParams.expenseChangePct !== 0) {
      leverDescriptions.push(`${activeParams.expenseChangePct > 0 ? '+' : ''}${activeParams.expenseChangePct}% Opex`);
    }
    if (activeParams.capexHiringCost > 0) {
      leverDescriptions.push(`${formatINRCompact(activeParams.capexHiringCost)} Capex/Hiring`);
    }
    if (activeParams.paymentRescheduleDays > 0) {
      leverDescriptions.push(`${activeParams.paymentRescheduleDays}d Vendor Reschedule`);
    }

    const scenarioTitle = leverDescriptions.length > 0
      ? leverDescriptions.join(', ')
      : activeParams.name || 'Custom Scenario';

    let summaryText = `Simulation Executed: ${scenarioTitle}\n\n`;

    if (isDeficit) {
      summaryText += `• Liquidity Impact: Projected ending cash contracts by ${formatINR(Math.abs(freshResult.deltaCash))} versus baseline (ending at ${formatINR(freshResult.endingCash)} over ${horizon} days).\n`;
    } else if (isSurplus) {
      summaryText += `• Liquidity Expansion: Projected ending cash expands by ${formatINR(freshResult.deltaCash)} above baseline (reaching ${formatINR(freshResult.endingCash)} over ${horizon} days).\n`;
    } else {
      summaryText += `• Neutral Trajectory: Cash flow matches baseline plan at ${formatINR(freshResult.endingCash)} over ${horizon} days.\n`;
    }

    // Trough & reserve evaluation
    if (freshResult.isNegativeCashBreached) {
      summaryText += `• CRITICAL DEFICIT: Cash balance enters negative territory, bottoming at ${formatINR(freshResult.lowestCash)} on ${freshResult.shortfallDate ? formatDate(freshResult.shortfallDate) : 'mid-horizon'}. Emergency credit facility or payment holds required.\n`;
    } else if (freshResult.isReserveBreached) {
      summaryText += `• RESERVE BREACH: Liquidity dips below the ₹20.0 L safe reserve around ${freshResult.shortfallDate ? formatDate(freshResult.shortfallDate) : 'Day 25'}, reaching a minimum trough of ${formatINR(freshResult.lowestCash)}.\n`;
    } else {
      summaryText += `• SAFE RESERVE SECURED: Liquidity maintains a healthy cushion above the ₹20.0 L buffer throughout all ${horizon} days, bottoming at ${formatINR(freshResult.lowestCash)}.\n`;
    }

    // Key drivers from calculation engine
    if (freshResult.keyDrivers && freshResult.keyDrivers.length > 0) {
      summaryText += `\nKey Financial Drivers:\n`;
      freshResult.keyDrivers.forEach(kd => {
        summaryText += `• ${kd.label}: ${kd.description} (${kd.impact >= 0 ? '+' : ''}${formatINRCompact(kd.impact)})\n`;
      });
    }

    // Tailored follow-up suggestions based on scenario results
    const followUps: string[] = [];
    if (freshResult.isReserveBreached || isDeficit) {
      followUps.push('What if we cut operating expenses by 8% to offset this?');
      followUps.push('What if we delay vendor payments by 20 days?');
      followUps.push('What if revenue drops by only 5%?');
    } else {
      followUps.push('What if receivables arrive 20 days late?');
      followUps.push('What if we invest ₹25 lakh in growth capex?');
      followUps.push('What if operating expenses rise by 10%?');
    }
    followUps.unshift('What does FINVORA recommend for this?');
    followUps.push('Compare with baseline');

    const resultMsg: ScenarioChatMessage = {
      id: `ast-run-${Date.now()}`,
      sender: 'assistant',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      text: summaryText,
      resultSnapshot: {
        endingCash: freshResult.endingCash,
        deltaCash: freshResult.deltaCash,
        lowestCash: freshResult.lowestCash,
        isReserveBreached: freshResult.isReserveBreached
      },
      userQuery: stagedParams.name || 'this scenario',
      followUpSuggestions: followUps,
      simulationResult: freshResult
    };

    setMessages(prev => [...prev, resultMsg]);
    showToast('Scenario simulated successfully', 'success');
  };

  // Start fresh scenario conversation
  const handleNewScenario = () => {
    setMessages([]);
    setHasRunScenario(false);
    setScenarioRevision(1);
    setPreviousResult(null);
    setStagedParams(DEFAULT_SIMULATION_PARAMS);
    resetSimulation();
    showToast('Started fresh scenario workspace', 'info');
  };

  // Handle Save
  const handleConfirmSave = () => {
    if (!saveName.trim()) return;
    saveScenario(saveName.trim(), saveNotes.trim());
    setIsSaveModalOpen(false);
    setSaveName('');
    setSaveNotes('');
  };

  // Create Proposal for Decisions & Approvals
  const handleCreateProposal = () => {
    createProposal({
      title: `Contingency Plan: Hedge ${stagedParams.collectionDelayDays}d Delay & ${stagedParams.expenseChangePct}% Opex Shift`,
      type: 'capex_freeze',
      severity: simulationResult.isReserveBreached ? 'critical' : 'warning',
      amount: Math.abs(simulationResult.deltaCash),
      description: `Formalized contingency directive generated from What-If scenario simulation (${formatINR(simulationResult.deltaCash)} modeled variance).`,
      evidence: [
        `What-If simulation projected ending balance of ${formatINR(simulationResult.endingCash)} vs baseline ${formatINR(simulationResult.baselineEndingCash)}.`,
        simulationResult.shortfallDate ? `Shortfall detected on ${formatDate(simulationResult.shortfallDate)}.` : 'Safe reserve maintained.',
        `Modeled under assumptions: ${stagedParams.collectionDelayDays}d collection lag and ${stagedParams.expenseChangePct}% opex adjustment.`
      ],
      expectedImpact: `Mitigates potential ${formatINR(Math.abs(simulationResult.deltaCash))} liquidity compression before Q3 close.`,
      assumptions: [
        'Enforces temporary discretionary freeze across non-critical software subscriptions.',
        'Requires treasury approval for invoices exceeding ₹5,00,000.'
      ],
      confidence: 77.5,
      requestedBy: role === 'manager' ? 'Rajesh Gopinathan (Finance Manager)' : 'Pooja Sharma (Analyst)',
      assignedReviewer: 'Rajesh Gopinathan (Finance Manager / CFO)'
    });

    setIsProposalModalOpen(false);
    navigate('/decisions-approvals');
    showToast('Contingency proposal created in Decisions & Approvals', 'success');
  };

  // Fetch AI Recommendation for a specific message and query
  const handleFetchRecommendation = async (messageId: string, queryToUse: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === messageId ? { ...m, recommendationLoading: true } : m))
    );
    try {
      const rec = await fetchScenarioRecommendation(queryToUse, stagedParams, simulationResult);
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? { ...m, recommendation: rec, recommendationLoading: false }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to fetch recommendation:', err);
      setMessages(prev =>
        prev.map(m => (m.id === messageId ? { ...m, recommendationLoading: false } : m))
      );
      showToast('Failed to fetch AI recommendation', 'error');
    }
  };

  // Create Proposal from FINVORA Strategic Recommendation
  const handleCreateRecommendationProposal = (rec: FinvoraRecommendation) => {
    createProposal({
      title: rec.proposal_recommendation || rec.title,
      type: 'capex_freeze',
      severity: (rec.risk_level || '').toLowerCase() === 'high' ? 'critical' : 'warning',
      amount: Math.abs(simulationResult.deltaCash) || 450000,
      description: rec.executive_summary,
      evidence: rec.action_steps && rec.action_steps.length > 0 ? rec.action_steps : [
        `Feasibility score: ${rec.feasibility_score}%`,
        `Modeled financial impact: ${rec.financial_impact}`
      ],
      expectedImpact: rec.financial_impact,
      assumptions: [
        'Strategic phased milestones as determined by FINVORA intelligence engine.',
        'Active working capital reserve lock.'
      ],
      confidence: rec.feasibility_score
        ? Number(Math.min(79.5, Math.max(71.0, rec.feasibility_score > 80 ? 71.0 + (rec.feasibility_score % 8) : rec.feasibility_score)).toFixed(1))
        : 76.5,
      requestedBy: role === 'manager' ? 'Rajesh Gopinathan (Finance Manager)' : 'Pooja Sharma (Analyst)',
      assignedReviewer: 'Rajesh Gopinathan (Finance Manager / CFO)'
    });

    navigate('/decisions-approvals');
    showToast('AI Recommendation proposal created in Decisions & Approvals', 'success');
  };

  return (
    <div className="space-y-5 pb-20">
      {/* 1. Header Bar: Clean, uncluttered, centered */}
      <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5 rounded-2xl glass-card border border-[var(--divider)]">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            What if?
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Ask questions, model operational decisions, and stress-test cash flow with FINVORA.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={() => setIsAdjustOpen(!isAdjustOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
              isAdjustOpen
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                : 'bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-primary)]'
            }`}
            title="Fine-tune simulation levers manually"
          >
            <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Manual levers</span>
          </button>

          <button
            onClick={handleNewScenario}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-primary)] transition-colors cursor-pointer"
            title="Start fresh conversation"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
            <span>New scenario</span>
          </button>

          <button
            onClick={() => setIsSavedListModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-primary)] transition-colors cursor-pointer"
            title="View saved scenarios"
          >
            <Bookmark className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>Saved ({savedScenarios.length})</span>
          </button>

          {hasRunScenario && (
            <button
              onClick={() => {
                setSaveName(stagedParams.name || 'Simulated Scenario');
                setIsSaveModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-xs cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Collapsible Manual Sliders Panel (Centered) */}
      {isAdjustOpen && (
        <div className="max-w-5xl mx-auto w-full p-5 rounded-2xl glass-card border border-[var(--accent-border)] space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-[var(--divider)]">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--accent)]" />
              <h4 className="text-sm font-bold text-[var(--text-primary)]">
                Fine-Tune Levers (Manual Controls)
              </h4>
            </div>
            <button
              onClick={() => setIsAdjustOpen(false)}
              className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Customer Collection Delay */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--text-primary)]">Collection Delay</span>
                <span className="font-mono text-rose-500 font-bold">{stagedParams.collectionDelayDays} days</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={stagedParams.collectionDelayDays}
                onChange={e => setStagedParams({ ...stagedParams, collectionDelayDays: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Revenue Change */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--text-primary)]">Revenue Volume</span>
                <span className={`font-mono font-bold ${stagedParams.revenueChangePct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {stagedParams.revenueChangePct > 0 ? '+' : ''}{stagedParams.revenueChangePct}%
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={stagedParams.revenueChangePct}
                onChange={e => setStagedParams({ ...stagedParams, revenueChangePct: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Operating Expenses */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--text-primary)]">Operating Expenses</span>
                <span className={`font-mono font-bold ${stagedParams.expenseChangePct > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                  {stagedParams.expenseChangePct > 0 ? '+' : ''}{stagedParams.expenseChangePct}%
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={stagedParams.expenseChangePct}
                onChange={e => setStagedParams({ ...stagedParams, expenseChangePct: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Vendor Payment Reschedule */}
            <div className="space-y-1.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--text-primary)]">Vendor Reschedule</span>
                <span className="font-mono text-emerald-500 font-bold">{stagedParams.paymentRescheduleDays} days</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={stagedParams.paymentRescheduleDays}
                onChange={e => setStagedParams({ ...stagedParams, paymentRescheduleDays: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* One-Time Capex */}
            <div className="sm:col-span-2 space-y-1.5 p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
              <div className="flex justify-between items-center">
                <span className="font-semibold text-[var(--text-primary)]">One-Time Capex / Investment</span>
                <span className="font-mono text-rose-500 font-bold">{formatINR(stagedParams.capexHiringCost)}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5000000}
                step={100000}
                value={stagedParams.capexHiringCost}
                onChange={e => setStagedParams({ ...stagedParams, capexHiringCost: Number(e.target.value) })}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--divider)]">
            <button
              onClick={() => setStagedParams(DEFAULT_SIMULATION_PARAMS)}
              className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
            >
              Reset sliders
            </button>
            <button
              onClick={() => handleExecuteScenario()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-xs cursor-pointer"
            >
              Re-calculate scenario
            </button>
          </div>
        </div>
      )}

      {/* 3. The Main Centered Asking & Replying Chat Workspace */}
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex flex-col h-[780px] rounded-3xl glass-card overflow-hidden border border-[var(--divider)] shadow-lg bg-[var(--card-bg)]">
          {/* Chat Header */}
          <div className="px-5 py-3.5 border-b border-[var(--divider)] bg-[var(--card-bg-elevated)] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-sm shadow-xs border border-amber-500/25">
                <Sparkles className="w-4 h-4 fill-current text-amber-500" />
              </div>
              <div>
                <span className="text-sm font-bold text-[var(--text-primary)] block">
                  FINVORA Scenario Copilot
                </span>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Autonomous liquidity simulation & decision modeling
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsAdjustOpen(!isAdjustOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                title="Fine-tune manual levers"
              >
                <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
                <span>Adjust Levers</span>
              </button>
            </div>
          </div>

          {/* Chat Messages Stream */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm">
            {messages.length === 0 ? (
              /* Centered Welcome State inside the Big Chat */
              <div className="h-full flex flex-col items-center justify-center text-center p-4 sm:p-8 space-y-6 max-w-2xl mx-auto animate-in fade-in duration-300">
                <div className="p-4 rounded-3xl bg-[var(--surface-muted)] border border-[var(--divider)] shadow-xs">
                  <FinvoraLogo showWordmark={false} size="lg" />
                </div>

                <div className="space-y-1.5">
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)]">
                    What would you like to explore?
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
                    Ask any question about shocks, customer payment delays, opex increases, or growth investments to simulate cash impact.
                  </p>
                </div>

                {/* Example scenario prompt buttons */}
                <div className="space-y-2 w-full pt-2">
                  <span className="text-xs text-[var(--text-muted)] font-medium">
                    Try asking one of these:
                  </span>
                  <div className="flex flex-wrap justify-center gap-2">
                    {PROMPT_SUGGESTIONS.map((suggestion, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setInputText(suggestion);
                          textareaRef.current?.focus();
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--divider)] hover:border-[var(--accent-border)] transition-all cursor-pointer text-left"
                      >
                        "{suggestion}"
                      </button>
                    ))}
                  </div>
                </div>

                {/* Baseline Metrics Bar */}
                <div className="w-full pt-4 border-t border-[var(--divider)]">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-left text-xs">
                    <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                      <span className="text-[10px] text-[var(--text-muted)] block">Available Cash</span>
                      <span className="text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                        {formatINRCompact(availableCash)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                      <span className="text-[10px] text-[var(--text-muted)] block">60d Ending</span>
                      <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                        {formatINRCompact(simulationResult.baselineEndingCash)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                      <span className="text-[10px] text-[var(--text-muted)] block">Trough Liquidity</span>
                      <span className="text-xs font-bold font-mono text-[var(--text-primary)]">
                        {formatINRCompact(simulationResult.baselineLowestCash)}
                      </span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                      <span className="text-[10px] text-[var(--text-muted)] block">Safe Reserve</span>
                      <span className="text-xs font-bold font-mono text-amber-600 dark:text-amber-400">
                        ₹20.0 L
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Message Stream */
              messages.map(msg => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {msg.sender === 'user' ? 'You' : 'FINVORA'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">• {msg.timestamp}</span>
                  </div>

                  <div
                    className={`p-4 sm:p-5 rounded-2xl leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-amber-500 text-stone-950 font-medium rounded-tr-xs shadow-xs max-w-[85%] text-xs sm:text-sm'
                        : 'bg-[var(--card-bg-elevated)] text-[var(--text-primary)] border border-[var(--divider)] rounded-tl-xs shadow-xs max-w-[96%] w-full space-y-4'
                    }`}
                  >
                    {msg.sender === 'user' ? (
                      <p className="whitespace-pre-wrap">{msg.text.replace(/[*#]/g, '')}</p>
                    ) : (
                      <CleanFormattedMessage text={msg.text} />
                    )}

                    {/* Source Chips */}
                    {msg.sourceChips && msg.sourceChips.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-[var(--divider)]">
                        {msg.sourceChips.map((chip, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-muted)] text-[var(--text-secondary)] font-mono"
                          >
                            [{chip}]
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Inline Proposed Assumptions Card */}
                    {msg.proposedAssumptions && (
                      <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-3">
                        <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                          <span>Interpreted Levers:</span>
                          <span className="text-[11px] text-[var(--accent)] font-mono">
                            {msg.proposedAssumptions.horizonDays} Days Horizon
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Collections</span>
                            <span className={`font-semibold ${msg.proposedAssumptions.collectionDelayDays > 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
                              {msg.proposedAssumptions.collectionDelayDays > 0 ? `+${msg.proposedAssumptions.collectionDelayDays}d Delay` : 'Normal Net-30'}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Revenue</span>
                            <span className={`font-semibold ${msg.proposedAssumptions.revenueChangePct > 0 ? 'text-emerald-500' : msg.proposedAssumptions.revenueChangePct < 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
                              {msg.proposedAssumptions.revenueChangePct !== 0 ? `${msg.proposedAssumptions.revenueChangePct > 0 ? '+' : ''}${msg.proposedAssumptions.revenueChangePct}%` : 'Baseline'}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Opex</span>
                            <span className={`font-semibold ${msg.proposedAssumptions.expenseChangePct > 0 ? 'text-rose-500' : msg.proposedAssumptions.expenseChangePct < 0 ? 'text-emerald-500' : 'text-[var(--text-primary)]'}`}>
                              {msg.proposedAssumptions.expenseChangePct !== 0 ? `${msg.proposedAssumptions.expenseChangePct > 0 ? '+' : ''}${msg.proposedAssumptions.expenseChangePct}%` : 'Baseline'}
                            </span>
                          </div>

                          <div className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Capex / Hiring</span>
                            <span className={`font-semibold ${msg.proposedAssumptions.capexHiringCost > 0 ? 'text-rose-500' : 'text-[var(--text-primary)]'}`}>
                              {msg.proposedAssumptions.capexHiringCost > 0 ? `-${formatINRCompact(msg.proposedAssumptions.capexHiringCost)}` : 'None'}
                            </span>
                          </div>
                        </div>

                        {/* Inline Actions */}
                        <div className="flex items-center gap-2.5 pt-1">
                          <button
                            onClick={() => handleExecuteScenario(msg.proposedAssumptions)}
                            className="flex-1 py-2 px-4 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Run scenario & calculate</span>
                          </button>
                          <button
                            onClick={() => setIsAdjustOpen(true)}
                            className="py-2 px-3 rounded-xl text-xs font-medium bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-primary)] transition-colors cursor-pointer"
                          >
                            Adjust
                          </button>
                        </div>
                      </div>
                    )}

                    {/* If simulation result snapshot or simulationResult is on message */}
                    {(msg.resultSnapshot || msg.simulationResult) && (
                      <div className="space-y-4 pt-2">
                        {/* 4 Metric Cards */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Ending Cash</span>
                            <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                              {formatINRCompact(msg.resultSnapshot ? msg.resultSnapshot.endingCash : simulationResult.endingCash)}
                            </div>
                            <span className={`text-[10px] font-mono font-medium block mt-0.5 ${(msg.resultSnapshot ? msg.resultSnapshot.deltaCash : simulationResult.deltaCash) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'}`}>
                              {(msg.resultSnapshot ? msg.resultSnapshot.deltaCash : simulationResult.deltaCash) >= 0 ? '+' : ''}
                              {formatINRCompact(msg.resultSnapshot ? msg.resultSnapshot.deltaCash : simulationResult.deltaCash)} vs Base
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Lowest Liquidity</span>
                            <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                              {formatINRCompact(msg.resultSnapshot ? msg.resultSnapshot.lowestCash : simulationResult.lowestCash)}
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                              Buffer: ₹20.0 L
                            </span>
                          </div>

                          <div className={`p-3 rounded-xl border ${
                            (msg.resultSnapshot ? msg.resultSnapshot.isReserveBreached : simulationResult.isReserveBreached)
                              ? 'border-amber-500/40 bg-amber-500/10'
                              : 'border-emerald-500/30 bg-emerald-500/5'
                          }`}>
                            <span className="text-[10px] text-[var(--text-muted)] block">Reserve Status</span>
                            <div className={`text-xs font-bold mt-0.5 ${
                              (msg.resultSnapshot ? msg.resultSnapshot.isReserveBreached : simulationResult.isReserveBreached)
                                ? 'text-amber-500'
                                : 'text-emerald-600 dark:text-emerald-400'
                            }`}>
                              {(msg.resultSnapshot ? msg.resultSnapshot.isReserveBreached : simulationResult.isReserveBreached)
                                ? 'Reserve Breach'
                                : 'Buffer Retained'}
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                              {simulationResult.shortfallDate ? `At: ${formatDate(simulationResult.shortfallDate)}` : 'No deficits'}
                            </span>
                          </div>

                          <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
                            <span className="text-[10px] text-[var(--text-muted)] block">Deferred Receipts</span>
                            <div className="text-base font-bold font-mono text-[var(--text-primary)] mt-0.5">
                              {simulationResult.delayedBeyondHorizonAmount > 0
                                ? formatINRCompact(simulationResult.delayedBeyondHorizonAmount)
                                : '₹0'}
                            </div>
                            <span className="text-[10px] text-[var(--text-muted)] block mt-0.5">
                              Past Day {stagedParams.horizonDays}
                            </span>
                          </div>
                        </div>

                        {/* Interactive Trajectory Comparison Chart */}
                        <div className="p-4 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[var(--text-primary)]">
                                Cash Flow Trajectory: Baseline vs Scenario
                              </span>
                            </div>
                            <div className="flex items-center gap-3 text-[11px] text-[var(--text-secondary)]">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 bg-emerald-500 rounded-full" />
                                <span>Baseline</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <span className="w-2.5 h-0.5 bg-amber-500 rounded-full" />
                                <span>Scenario</span>
                              </span>
                            </div>
                          </div>

                          <div className="h-60 w-full pt-1">
                            <ResponsiveContainer width="100%" height="100%">
                              <ComposedChart
                                data={simulationResult.simulatedPoints}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                              >
                                <CartesianGrid
                                  stroke={isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'}
                                  strokeDasharray="3 3"
                                  vertical={false}
                                />
                                <XAxis
                                  dataKey="date"
                                  stroke="var(--text-muted)"
                                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                  tickLine={false}
                                  tickFormatter={val => val.slice(5)}
                                />
                                <YAxis
                                  stroke="var(--text-muted)"
                                  tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                  tickLine={false}
                                  tickFormatter={val => formatINRCompact(val)}
                                  domain={['auto', 'auto']}
                                />
                                <Tooltip
                                  contentStyle={{
                                    backgroundColor: 'var(--chart-tooltip-bg)',
                                    borderColor: 'var(--chart-tooltip-border)',
                                    borderRadius: '12px',
                                    color: 'var(--chart-tooltip-text)',
                                    fontSize: '11px',
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
                                  }}
                                  formatter={(val: any, name: any) => [
                                    formatINR(Number(val)),
                                    name === 'simulated' ? 'Scenario' : 'Baseline'
                                  ]}
                                />
                                <ReferenceLine
                                  y={2000000}
                                  stroke="#F59E0B"
                                  strokeDasharray="3 3"
                                  strokeOpacity={0.6}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="baseline"
                                  stroke="#10B981"
                                  strokeWidth={2}
                                  dot={false}
                                />
                                <Line
                                  type="monotone"
                                  dataKey="simulated"
                                  stroke="#F59E0B"
                                  strokeWidth={2.5}
                                  strokeDasharray={simulationResult.deltaCash === 0 ? undefined : '5 5'}
                                  dot={false}
                                />
                              </ComposedChart>
                            </ResponsiveContainer>
                          </div>

                          <div className="pt-2 border-t border-[var(--divider)] flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              Reserve threshold: ₹20.0 L safe buffer
                            </span>
                            <div className="flex items-center gap-1.5 font-mono text-[11px]">
                              <span>Net Modeled Variance:</span>
                              <span className={(msg.resultSnapshot ? msg.resultSnapshot.deltaCash : simulationResult.deltaCash) >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-rose-500 font-bold'}>
                                {(msg.resultSnapshot ? msg.resultSnapshot.deltaCash : simulationResult.deltaCash) >= 0 ? '+' : ''}
                                {formatINR(msg.resultSnapshot ? msg.resultSnapshot.deltaCash : simulationResult.deltaCash)}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Grounded Key Financial Drivers */}
                        {simulationResult.explanation && simulationResult.explanation.length > 0 && (
                          <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-2">
                            <span className="text-xs font-bold text-[var(--text-primary)] block">
                              Grounded Drivers & Observations:
                            </span>
                            <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                              {simulationResult.explanation.map((item, idx) => (
                                <div key={idx} className="flex items-start gap-2">
                                  <span className="text-amber-500 shrink-0 font-bold">•</span>
                                  <span>{item}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* What FINVORA Recommends Section */}
                    {msg.sender === 'assistant' && (
                      <>
                        {msg.recommendation ? (
                          <FinvoraRecommendationCard
                            recommendation={msg.recommendation}
                            onDraftProposal={handleCreateRecommendationProposal}
                          />
                        ) : msg.recommendationLoading ? (
                          <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                            <Sparkles className="w-4 h-4 animate-spin shrink-0 text-amber-500" />
                            <span className="text-xs">
                              FINVORA AI is synthesizing strategic recommendation from live telemetry...
                            </span>
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-[var(--divider)]">
                            <button
                              onClick={() => handleFetchRecommendation(msg.id, msg.userQuery || msg.text)}
                              className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-gradient-to-r from-amber-500/10 via-[var(--surface-subtle)] to-amber-500/10 hover:from-amber-500/20 hover:to-amber-500/20 border border-amber-500/30 text-[var(--text-primary)] transition-all flex items-center justify-between group shadow-xs cursor-pointer"
                            >
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                                <span className="font-bold text-xs">What FINVORA Recommends</span>
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                                <span>View AI strategic directive</span>
                                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                              </div>
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Follow-up Suggestion Chips */}
                  {msg.followUpSuggestions && msg.followUpSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[95%]">
                      {msg.followUpSuggestions.map((sug, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendMessage(sug)}
                          className="text-[11px] px-3 py-1.5 rounded-xl bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--divider)] hover:border-[var(--accent-border)] transition-colors text-left cursor-pointer"
                        >
                          ↳ {sug}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {isInterpreting && (
              <div className="flex items-center gap-2 p-3.5 rounded-2xl bg-[var(--card-bg-elevated)] border border-[var(--divider)] text-xs text-[var(--text-muted)] w-fit animate-pulse">
                <Sparkles className="w-4 h-4 text-amber-500 animate-spin" />
                <span>FINVORA is structuring financial scenario...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Sticky Bottom Message Composer */}
          <div className="p-3.5 sm:p-4 border-t border-[var(--divider)] bg-[var(--card-bg-elevated)] shrink-0 space-y-2">
            {messages.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px]">
                <span className="text-[10px] text-[var(--text-muted)] font-medium shrink-0">Quick prompts:</span>
                {PROMPT_SUGGESTIONS.slice(0, 3).map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(suggestion)}
                    className="px-2.5 py-1 rounded-lg bg-[var(--surface-subtle)] hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--divider)] transition-colors whitespace-nowrap cursor-pointer shrink-0"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            <div className="relative rounded-2xl bg-[var(--input-bg)] border border-[var(--divider)] focus-within:border-amber-500/60 focus-within:ring-2 focus-within:ring-amber-500/20 transition-all flex items-center p-1">
              <textarea
                ref={textareaRef}
                rows={2}
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="Ask any scenario question... (e.g. What if client collections are delayed by 20 days?)"
                className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-transparent text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none leading-relaxed"
              />
              <div className="flex flex-col items-end gap-1 mr-1">
                <button
                  onClick={() => handleSendMessage()}
                  disabled={!inputText.trim() || isInterpreting}
                  className="px-4 py-2 rounded-xl bg-amber-500 text-stone-950 font-bold hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs cursor-pointer text-xs"
                  aria-label="Send message"
                >
                  <span>Explore</span>
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 text-[10px] text-[var(--text-muted)]">
              <span>Press <kbd className="px-1 py-0.5 rounded bg-[var(--surface-muted)] font-mono text-[9px]">Enter</kbd> to explore • <kbd className="px-1 py-0.5 rounded bg-[var(--surface-muted)] font-mono text-[9px]">Shift + Enter</kbd> for new line</span>
              <span>Grounded on live financial ledger</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Modal: Save Scenario */}
      {isSaveModalOpen && (
        <Modal
          isOpen={isSaveModalOpen}
          onClose={() => setIsSaveModalOpen(false)}
          title="Save Scenario Specification"
        >
          <div className="space-y-4 text-xs">
            <p className="text-[var(--text-secondary)]">
              Store this scenario with its exact parameters for retrospective auditing or peer review.
            </p>

            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-primary)] block">
                Scenario Title
              </label>
              <input
                type="text"
                value={saveName}
                onChange={e => setSaveName(e.target.value)}
                placeholder="e.g. Q4 Festive Collections Delay (-15d)"
                className="w-full p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-[var(--text-primary)] block">
                Assumptions & Commentary
              </label>
              <textarea
                rows={3}
                value={saveNotes}
                onChange={e => setSaveNotes(e.target.value)}
                placeholder="Document underlying macro rationale or customer cohort scope..."
                className="w-full p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] text-[var(--text-primary)] focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--divider)] space-y-1 text-[11px] font-mono">
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Ending Cash:</span>
                <span className="font-bold text-[var(--text-primary)]">{formatINR(simulationResult.endingCash)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--text-muted)]">Delta vs Base:</span>
                <span className={simulationResult.deltaCash >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {simulationResult.deltaCash >= 0 ? '+' : ''}{formatINR(simulationResult.deltaCash)}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                onClick={() => setIsSaveModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                disabled={!saveName.trim()}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-40 transition-colors"
              >
                Confirm & Save
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* 5. Modal: Saved Scenarios Library */}
      {isSavedListModalOpen && (
        <Modal
          isOpen={isSavedListModalOpen}
          onClose={() => setIsSavedListModalOpen(false)}
          title={`Saved Scenarios (${savedScenarios.length})`}
        >
          <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
            {savedScenarios.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                No saved scenarios found. Run and save a scenario to view it here.
              </div>
            ) : (
              savedScenarios.map(scen => (
                <div
                  key={scen.id}
                  className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] hover:border-[var(--accent-border)] transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[var(--text-primary)] truncate">
                        {scen.name}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        {scen.createdAt}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                      {scen.notes}
                    </p>
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span>Ending: {formatINRCompact(scen.endingCash)}</span>
                      <span>Lowest: {formatINRCompact(scen.lowestCash)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => {
                        loadScenario(scen);
                        setStagedParams(scen.params);
                        setHasRunScenario(true);
                        setIsSavedListModalOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors"
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteScenario(scen.id)}
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-rose-500 hover:bg-[var(--surface-muted)] transition-colors"
                      title="Delete saved scenario"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Modal>
      )}

      {/* 6. Modal: Create Formal Proposal */}
      {isProposalModalOpen && (
        <Modal
          isOpen={isProposalModalOpen}
          onClose={() => setIsProposalModalOpen(false)}
          title="Create Decisions & Approvals Proposal"
        >
          <div className="space-y-4 text-xs">
            <p className="text-[var(--text-secondary)] leading-relaxed">
              Convert the simulated scenario into a formal decision proposal for executive controller approval.
            </p>

            <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] space-y-1.5">
              <span className="font-semibold text-[var(--text-primary)] block">Action Directive:</span>
              <p className="text-[11px] text-[var(--text-secondary)]">
                Implement defensive working-capital freeze to protect reserve buffer against projected {formatINR(Math.abs(simulationResult.deltaCash))} shortfall.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
              <span className="font-bold block">Governance Notice:</span>
              <span>
                Running a simulation does not execute payments or alter production ledgers. Confirming below will submit a sign-off proposal to the Controller queue.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setIsProposalModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProposal}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors"
              >
                Submit to Approval Queue →
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
