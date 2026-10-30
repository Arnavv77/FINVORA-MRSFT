import React, { useState } from 'react';
import {
  Network,
  RefreshCw,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Building,
  Key,
  Database,
  ExternalLink
} from 'lucide-react';
import { useFinancial } from '../context/FinancialContext';
import { StatusBadge } from '../components/common/StatusBadge';
import { Modal } from '../components/common/Modal';

export const DataConnectionsPage: React.FC = () => {
  const { sources, refreshSource, showToast } = useFinancial();
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('Axis Bank Corporate API');
  const [isConnecting, setIsConnecting] = useState(false);

  const handleSimulatedConnect = () => {
    setIsConnecting(true);
    setTimeout(() => {
      setIsConnecting(false);
      setIsConnectModalOpen(false);
      showToast(`Connected ${selectedProvider} via secure OAuth2 token`, 'success');
    }, 1200);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Connected Financial Systems & API Integrations
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl mt-1">
            Live ingestion connectors for Indian banks (HDFC, ICICI), SAP S/4HANA ERP, RazorpayX payouts, and Zoho Books accounting.
          </p>
        </div>

        <button
          onClick={() => setIsConnectModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors shadow-md shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Connect New Source</span>
        </button>
      </div>

      {/* Sources Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sources.map(src => (
          <div
            key={src.id}
            className="p-5 rounded-2xl glass-card border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 transition-colors"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{src.name}</h3>
                  <span className="text-[11px] text-[var(--text-secondary)] font-mono">{src.accountNumber}</span>
                </div>
                <StatusBadge status={src.status} size="sm" pulse={src.status === 'syncing'} />
              </div>

              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {src.description}
              </p>
            </div>

            <div className="space-y-2 pt-3 border-t border-[var(--divider)] text-xs">
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Ingested Records:</span>
                <span className="font-mono text-[var(--text-primary)] font-medium">{src.recordCount.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Pipeline Health:</span>
                <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">{src.healthScore}% SLA</span>
              </div>
              <div className="flex justify-between text-[var(--text-secondary)]">
                <span>Last Polled:</span>
                <span className="text-[var(--text-secondary)]">{src.lastSyncTime}</span>
              </div>

              <button
                onClick={() => refreshSource(src.id)}
                className="w-full mt-2 py-2 rounded-xl bg-[var(--surface-muted)] hover:bg-[var(--hover-bg)] text-xs font-semibold text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
                <span>Trigger Ingestion Sync</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Connect Modal */}
      <Modal
        isOpen={isConnectModalOpen}
        onClose={() => setIsConnectModalOpen(false)}
        title="Connect Enterprise Data Source"
        subtitle="Authenticate via Indian Banking Open API or ERP Service Account"
        footer={
          <>
            <button
              onClick={() => setIsConnectModalOpen(false)}
              className="px-4 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSimulatedConnect}
              disabled={isConnecting}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors disabled:opacity-40 shadow-sm"
            >
              {isConnecting ? 'Authenticating Gateway...' : 'Establish Secure Connection'}
            </button>
          </>
        }
      >
        <div className="space-y-4 text-xs">
          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-semibold block mb-1">Select Integration Provider:</label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-colors"
            >
              <option value="Axis Bank Corporate API">Axis Bank Corporate API (Host-to-Host)</option>
              <option value="Kotak Mahindra Bank NetBanking">Kotak Mahindra Bank Corporate Treasury</option>
              <option value="Oracle NetSuite ERP">Oracle NetSuite ERP (SuiteTalk API)</option>
              <option value="TallyPrime Cloud Bridge">TallyPrime Cloud Server Bridge</option>
              <option value="GSTN Portal E-Way E-Invoice">GSTN Portal E-Invoicing Sandbox</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-[var(--text-secondary)] font-semibold block mb-1">Environment / Account ID:</label>
            <input
              type="text"
              defaultValue="CORP-ACC-99210-PROD"
              className="w-full bg-[var(--input-bg)] border border-[var(--border-subtle)] rounded-xl p-2.5 text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-amber-500/50 transition-colors"
            />
          </div>

          <div className="p-3 rounded-xl bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[11px] text-[var(--text-secondary)]">
            <span className="text-[var(--text-primary)] font-medium">Demo Mode:</span> In this hackathon environment, connecting a new source establishes a simulated sandbox connector with automated synthetic transaction telemetry.
          </div>
        </div>
      </Modal>
    </div>
  );
};
