import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Info
} from 'lucide-react';
import { motion } from 'framer-motion';
import { MagneticDock, type DockItemData } from '../ui/magnetic-dock';
import { useFinancial } from '../../context/FinancialContext';

interface FinvoraDockProps {
  className?: string;
  position?: 'bottom' | 'top' | 'left' | 'right';
  iconSize?: number;
  maxScale?: number;
}

export const FinvoraDock: React.FC<FinvoraDockProps> = ({
  className = '',
  position = 'bottom',
  iconSize = 46,
  maxScale = 1.35
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    openCriticalRisksCount,
    proposals,
    invoices,
    budgets
  } = useFinancial();

  const isOverview =
    location.pathname === '/' ||
    location.pathname === '/overview' ||
    location.pathname === '/workspace';

  const pendingProposalsCount = proposals.filter(p => p.status === 'pending_approval').length;
  const pendingInvoicesCount = invoices.filter(inv => inv.status === 'pending_approval').length;
  const overBudgetDepts = budgets.filter(b => b.status === 'over_budget').length;

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const dockIconClass = "w-5 h-5 text-black dark:text-amber-400 transition-colors duration-150";

  const items: DockItemData[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: <LayoutDashboard className={dockIconClass} />,
      onClick: () => handleNavigate('/'),
      isActive: isOverview
    },
    {
      id: 'financial-data',
      label: 'Financial Data',
      icon: <Database className={dockIconClass} />,
      onClick: () => handleNavigate('/financial-data'),
      isActive: location.pathname === '/financial-data'
    },
    {
      id: 'risk-anomalies',
      label: 'Risk & Anomalies',
      icon: <ShieldAlert className={dockIconClass} />,
      badge: openCriticalRisksCount > 0 ? openCriticalRisksCount : undefined,
      onClick: () => handleNavigate('/risk-anomalies'),
      isActive: location.pathname === '/risk-anomalies'
    },
    {
      id: 'cash-flow',
      label: 'Cash Flow & Forecasting',
      icon: <TrendingUp className={dockIconClass} />,
      onClick: () => handleNavigate('/cash-flow'),
      isActive: location.pathname === '/cash-flow'
    },
    {
      id: 'ap-expenses',
      label: 'AP & Expenses',
      icon: <Receipt className={dockIconClass} />,
      badge: pendingInvoicesCount > 0 ? pendingInvoicesCount : undefined,
      onClick: () => handleNavigate('/ap-expenses'),
      isActive: location.pathname === '/ap-expenses'
    },
    {
      id: 'budget-intelligence',
      label: 'Budget Intelligence',
      icon: <PieChart className={dockIconClass} />,
      badge: overBudgetDepts > 0 ? overBudgetDepts : undefined,
      onClick: () => handleNavigate('/budget-intelligence'),
      isActive: location.pathname === '/budget-intelligence'
    },
    {
      id: 'what-if',
      label: 'What-If Simulator',
      icon: <Sliders className={dockIconClass} />,
      onClick: () => handleNavigate('/what-if'),
      isActive: location.pathname === '/what-if'
    },
    {
      id: 'context-intelligence',
      label: 'Context Intelligence (CAFIE)',
      icon: <Brain className={dockIconClass} />,
      onClick: () => handleNavigate('/context-intelligence'),
      isActive: location.pathname === '/context-intelligence'
    },
    {
      id: 'decisions-approvals',
      label: 'Decisions & Approvals',
      icon: <CheckSquare className={dockIconClass} />,
      badge: pendingProposalsCount > 0 ? pendingProposalsCount : undefined,
      onClick: () => handleNavigate('/decisions-approvals'),
      isActive: location.pathname === '/decisions-approvals'
    },
    {
      id: 'data-connections',
      label: 'Data Connections',
      icon: <Network className={dockIconClass} />,
      onClick: () => handleNavigate('/data-connections'),
      isActive: location.pathname === '/data-connections'
    },
    {
      id: 'about',
      label: 'About',
      icon: <Info className={dockIconClass} />,
      onClick: () => handleNavigate('/about'),
      isActive: location.pathname === '/about'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className={dockIconClass} />,
      onClick: () => handleNavigate('/settings'),
      isActive: location.pathname === '/settings'
    }
  ];

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <motion.div
        key="full-dock"
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="flex flex-col items-center"
      >
        <MagneticDock
          items={items}
          iconSize={iconSize}
          maxScale={maxScale}
          variant="glass"
          position={position}
          magneticDistance={140}
          showLabels={true}
        />
      </motion.div>
    </div>
  );
};

