import React, { useState } from 'react';
import {
  CheckSquare,
  ShieldCheck,
  AlertTriangle,
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  UserCheck,
  Send,
  Sliders,
  Settings,
  Plus
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Drawer } from '../components/common/Drawer';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { formatINR, formatDate } from '../utils/formatters';
import { DecisionProposal, WorkflowRule } from '../types';

export const DecisionsApprovalsPage: React.FC = () => {
  const {
    proposals,
    workflowRules,
    submitProposalForApproval,
    approveProposal,
    rejectProposal,
    executeProposal,
    toggleRule,
    addWorkflowRule,
    role,
    setRole,
    duplicateHoldExecuted,
    showToast
  } = useFinancial();

  // Tab: Proposals vs Workflow Rules
  const [activeTab, setActiveTab] = useState<'proposals' | 'workflows'>('proposals');

  // Selected Proposal for Details / Execution Drawer
  const [selectedProposal, setSelectedProposal] = useState<DecisionProposal | null>(null);

  // Reject Modal State
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  // Execute Confirmation Dialog
  const [isExecuteConfirmOpen, setIsExecuteConfirmOpen] = useState(false);

  // New Workflow Rule Modal
  const [isNewRuleModalOpen, setIsNewRuleModalOpen] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleCondition, setRuleCondition] = useState('');
  const [ruleAction, setRuleAction] = useState('');

  const pendingCount = proposals.filter(p => p.status === 'pending_approval').length;
  const approvedCount = proposals.filter(p => p.status === 'approved').length;
  const executedCount = proposals.filter(p => p.status === 'executed').length;

  const handleApproveClick = (proposal: DecisionProposal) => {
    if (role !== 'manager') {
      showToast('Permission Denied: Only Finance Manager role can approve proposals. Switch to Manager in top bar or profile menu.', 'error');
      return;
    }
    approveProposal(proposal.id);
    setSelectedProposal({ ...proposal, status: 'approved' });
  };

  const handleRejectClick = () => {
    if (!selectedProposal || !rejectionReason.trim()) return;
    rejectProposal(selectedProposal.id, rejectionReason);
    setIsRejectModalOpen(false);
    setRejectionReason('');
    setSelectedProposal(null);
  };

  const handleExecuteConfirmed = () => {
    if (selectedProposal) {
      executeProposal(selectedProposal.id);
      setSelectedProposal(null);
    }
  };

  const handleCreateRuleSubmit = () => {
    if (!ruleName.trim() || !ruleCondition.trim() || !ruleAction.trim()) return;
    addWorkflowRule({
      name: ruleName,
      description: `Custom automated routing policy configured by finance controller`,
      condition: ruleCondition,
      action: ruleAction,
      isActive: true
    });
    setIsNewRuleModalOpen(false);
    setRuleName('');
    setRuleCondition('');
    setRuleAction('');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Tab Controls */}
      <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Decisions, Approvals & Policy Routing
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl mt-1">
            Governed transition pipeline: Draft → Pending Approval → Approved → Simulated Execution. Every action maintains explainability and mathematical verification.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center p-1 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-xs">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'proposals'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Proposals & Sign-offs ({proposals.length})
          </button>
          <button
            onClick={() => setActiveTab('workflows')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'workflows'
                ? 'bg-amber-500 text-stone-950 font-bold shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            Workflow Rules ({workflowRules.length})
          </button>
        </div>
      </div>

      {activeTab === 'proposals' && (
        <div className="space-y-6">
          {/* Status Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl glass-card border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-secondary)] block mb-1">Pending Sign-off</span>
              <div className="text-2xl font-bold font-mono text-amber-500">{pendingCount}</div>
              <span className="text-[10px] text-[var(--text-secondary)]">Awaiting Manager Approval</span>
            </div>

            <div className="p-4 rounded-xl glass-card border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-secondary)] block mb-1">Approved (Ready to Run)</span>
              <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">{approvedCount}</div>
              <span className="text-[10px] text-[var(--text-secondary)]">Dual signatures verified</span>
            </div>

            <div className="p-4 rounded-xl glass-card border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-secondary)] block mb-1">Executed in Ledger</span>
              <div className="text-2xl font-bold font-mono text-sky-500">{executedCount}</div>
              <span className="text-[10px] text-[var(--text-secondary)]">Applied to ERP & forecast</span>
            </div>

            <div className="p-4 rounded-xl glass-card border border-[var(--border-subtle)]">
              <span className="text-xs text-[var(--text-secondary)] block mb-1">Active User Role</span>
              <div className="text-base font-bold text-[var(--text-primary)] mt-1">
                {role === 'manager' ? 'Finance Manager' : 'Finance Analyst'}
              </div>
              <button
                onClick={() => setRole(role === 'manager' ? 'analyst' : 'manager')}
                className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline font-semibold mt-0.5"
              >
                Switch to {role === 'manager' ? 'Analyst' : 'Manager'} ⇄
              </button>
            </div>
          </div>

          {/* Proposals List Card */}
          <div className="p-5 rounded-2xl glass-card space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                  Financial Decision Proposals
                </h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Inspect evidence, verify mathematical impact, approve or execute ledger directives
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {proposals.map(proposal => (
                <div
                  key={proposal.id}
                  onClick={() => setSelectedProposal(proposal)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    proposal.id === 'PROP-2024-001' && proposal.status !== 'executed'
                      ? 'bg-amber-500/10 border-amber-500/40 hover:border-amber-400'
                      : 'bg-[var(--card-bg-elevated)] border-[var(--border-subtle)] hover:border-amber-500/40'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={proposal.status} size="sm" pulse={proposal.status === 'pending_approval'} />
                        <span className="text-xs font-bold text-[var(--text-primary)]">{proposal.title}</span>
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono px-1.5 py-0.5 rounded bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
                          {proposal.id}
                        </span>
                      </div>

                      <p className="text-xs text-[var(--text-secondary)] max-w-2xl line-clamp-1">
                        {proposal.description}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-[var(--text-tertiary)] pt-1">
                        <span>Submitted by: <strong className="text-[var(--text-secondary)]">{proposal.requestedBy}</strong></span>
                        <span>•</span>
                        <span>Reviewer: <strong className="text-[var(--text-secondary)]">{proposal.assignedReviewer}</strong></span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)]">Value Impact</div>
                        <div className="text-sm font-bold font-mono text-[var(--text-primary)]">
                          {formatINR(proposal.amount)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-[var(--text-secondary)]">Confidence</div>
                        <div className="text-xs font-mono font-semibold text-amber-500">
                          {proposal.confidence}%
                        </div>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProposal(proposal);
                        }}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
                      >
                        Inspect Proposal
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Workflows Automation Tab */}
      {activeTab === 'workflows' && (
        <div className="p-5 rounded-2xl glass-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-[var(--text-primary)] tracking-tight">
                Automated Approval & Policy Routing Rules
              </h3>
              <p className="text-xs text-[var(--text-secondary)]">
                Configure autonomous routing for high-value transactions, duplicates, and department spend caps
              </p>
            </div>

            <button
              onClick={() => setIsNewRuleModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Workflow Policy</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workflowRules.map(rule => (
              <div
                key={rule.id}
                className="p-4 rounded-xl bg-[var(--card-bg-elevated)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-3 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-bold text-[var(--text-primary)]">{rule.name}</span>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-colors ${
                        rule.isActive
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30'
                          : 'bg-stone-500/15 text-stone-600 dark:text-stone-400 border-stone-500/20'
                      }`}
                    >
                      {rule.isActive ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)]">{rule.description}</p>
                </div>

                <div className="space-y-1.5 p-2.5 rounded-lg bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Condition:</span>
                    <span className="font-mono text-amber-500">{rule.condition}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-secondary)]">Action:</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">{rule.action}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-tertiary)] pt-1">
                    <span>Times Triggered:</span>
                    <span className="font-mono">{rule.triggerCount} runs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Decision Proposal Details Drawer */}
      <Drawer
        isOpen={Boolean(selectedProposal)}
        onClose={() => setSelectedProposal(null)}
        title={selectedProposal?.title || 'Decision Proposal'}
        subtitle={selectedProposal ? `Target: ${selectedProposal.targetEntityId || 'Enterprise Ledger'}` : ''}
        badge={selectedProposal && <StatusBadge status={selectedProposal.status} />}
        footer={
          selectedProposal ? (
            <div className="flex items-center justify-between w-full">
              <div className="text-xs text-[var(--text-secondary)]">
                Amount: <strong className="text-[var(--text-primary)] font-mono">{formatINR(selectedProposal.amount)}</strong>
              </div>

              <div className="flex items-center gap-2">
                {selectedProposal.status === 'draft' && (
                  <button
                    onClick={() => {
                      submitProposalForApproval(selectedProposal.id);
                      setSelectedProposal({ ...selectedProposal, status: 'pending_approval' });
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Submit for Sign-off</span>
                  </button>
                )}

                {selectedProposal.status === 'pending_approval' && (
                  <>
                    <button
                      onClick={() => setIsRejectModalOpen(true)}
                      className="px-3 py-2 text-xs font-semibold text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 rounded-xl hover:bg-rose-500/10 transition-colors"
                    >
                      Reject with Reason
                    </button>
                    <button
                      onClick={() => handleApproveClick(selectedProposal)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-stone-950 transition-colors flex items-center gap-1.5 shadow-md"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Proposal</span>
                    </button>
                  </>
                )}

                {selectedProposal.status === 'approved' && (
                  <button
                    onClick={() => setIsExecuteConfirmOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors flex items-center gap-1.5 shadow-md animate-pulse"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Execute Decision Directive</span>
                  </button>
                )}

                {selectedProposal.status === 'executed' && (
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Directive Executed in Ledger
                  </span>
                )}
              </div>
            </div>
          ) : null
        }
      >
        {selectedProposal && (
          <div className="space-y-6 text-xs">
            {/* Impact Banner */}
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-amber-600 dark:text-amber-400 uppercase font-semibold">Expected Financial Impact</span>
                <p className="text-xs text-[var(--text-primary)] font-medium mt-1 leading-relaxed">
                  {selectedProposal.expectedImpact}
                </p>
              </div>
              <div className="text-right shrink-0 ml-4">
                <span className="text-[11px] text-[var(--text-secondary)] uppercase font-semibold">Sign-off Confidence</span>
                <div className="text-lg font-mono font-bold text-amber-500">
                  {selectedProposal.confidence}%
                </div>
              </div>
            </div>

            {/* Execution Result if executed */}
            {selectedProposal.status === 'executed' && selectedProposal.executionResultSummary && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                <span className="text-[11px] uppercase font-bold text-emerald-600 dark:text-emerald-300">Live Execution Audit Confirmation</span>
                <p className="text-xs text-emerald-700 dark:text-emerald-200">{selectedProposal.executionResultSummary}</p>
              </div>
            )}

            {/* Supporting Evidence List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                Supporting Telemetry Evidence
              </h4>
              <div className="space-y-1.5">
                {selectedProposal.evidence.map((ev, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-[var(--card-bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] flex items-start gap-2">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <span className="text-xs text-[var(--text-primary)]">{ev}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Model Assumptions */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Key Policy Assumptions
              </h4>
              <div className="space-y-1.5">
                {selectedProposal.assumptions.map((asmp, i) => (
                  <div key={i} className="p-2.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
                    {asmp}
                  </div>
                ))}
              </div>
            </div>

            {/* Workflow Timeline */}
            <div className="space-y-2 pt-2 border-t border-[var(--divider)]">
              <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                Approval Activity Log
              </h4>
              <div className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1 text-[11px] text-[var(--text-secondary)]">
                <div>Created: <strong className="text-[var(--text-primary)]">{selectedProposal.createdAt}</strong> by {selectedProposal.requestedBy}</div>
                <div>Assigned Reviewer: <strong className="text-[var(--text-primary)]">{selectedProposal.assignedReviewer}</strong></div>
                <div>Status: <span className="font-semibold text-amber-500 uppercase">{selectedProposal.status.replace('_', ' ')}</span></div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Reject Modal */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Reject Decision Proposal"
        subtitle="Mandatory justification required for compliance record"
        footer={
          <>
            <button
              onClick={() => setIsRejectModalOpen(false)}
              className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRejectClick}
              disabled={!rejectionReason.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors disabled:opacity-40 shadow-sm"
            >
              Reject Proposal
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <label className="text-xs text-[var(--text-secondary)] block">Rejection Reason:</label>
          <textarea
            rows={3}
            placeholder="e.g. Vendor provided revised commercial terms; duplicate PO voided..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-3 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>
      </Modal>

      {/* Execute Confirmation Dialog */}
      <ConfirmDialog
        isOpen={isExecuteConfirmOpen}
        onClose={() => setIsExecuteConfirmOpen(false)}
        onConfirm={handleExecuteConfirmed}
        title="Execute Directive in Live Ledger?"
        message={
          selectedProposal?.id === 'PROP-2024-001'
            ? 'Executing this directive will enforce a payment hold on #INV-2024-8849, block the payout batch, and update the 60-day cash forecast saving ₹6,80,000.'
            : 'Executing this decision will update ERP records and recalculate enterprise financial telemetry.'
        }
        confirmLabel="Execute Decision"
        type="warning"
      />

      {/* New Workflow Rule Modal */}
      <Modal
        isOpen={isNewRuleModalOpen}
        onClose={() => setIsNewRuleModalOpen(false)}
        title="Create Automated Workflow Policy"
        subtitle="Define triggers, thresholds, and routing actions"
        footer={
          <>
            <button
              onClick={() => setIsNewRuleModalOpen(false)}
              className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateRuleSubmit}
              disabled={!ruleName.trim() || !ruleCondition.trim() || !ruleAction.trim()}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors disabled:opacity-40 shadow-sm"
            >
              Deploy Policy Rule
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-semibold block mb-1">Policy Rule Name:</label>
            <input
              type="text"
              placeholder="e.g. High-Value PO Routing (> ₹25L)"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-semibold block mb-1">Trigger Condition:</label>
            <input
              type="text"
              placeholder="e.g. Invoice Amount > ₹25,00,000 OR Duplicate Score > 85%"
              value={ruleCondition}
              onChange={(e) => setRuleCondition(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-semibold block mb-1">Automated Action:</label>
            <input
              type="text"
              placeholder="e.g. Route to CFO for sign-off & place temporary payment hold"
              value={ruleAction}
              onChange={(e) => setRuleAction(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
