import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { FinancialProvider, useFinancial } from './context/FinancialContext';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './components/auth/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { FinancialDataPage } from './pages/FinancialDataPage';
import { RiskAnomaliesPage } from './pages/RiskAnomaliesPage';
import { CashFlowPage } from './pages/CashFlowPage';
import { APExpensesPage } from './pages/APExpensesPage';
import { BudgetIntelligencePage } from './pages/BudgetIntelligencePage';
import { WhatIfSimulatorPage } from './pages/WhatIfSimulatorPage';
import { DecisionsApprovalsPage } from './pages/DecisionsApprovalsPage';
import { ContextAwareIntelligencePage } from './pages/ContextAwareIntelligencePage';
import { DataConnectionsPage } from './pages/DataConnectionsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AboutPage } from './pages/AboutPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useFinancial();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {/* Login page — directly accessible or redirected to when unauthenticated */}
      <Route path="/login" element={<LoginPage />} />

      {/* Main application protected by authentication */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="financial-data" element={<FinancialDataPage />} />
        <Route path="risk-anomalies" element={<RiskAnomaliesPage />} />
        <Route path="cash-flow" element={<CashFlowPage />} />
        <Route path="ap-expenses" element={<APExpensesPage />} />
        <Route path="budget-intelligence" element={<BudgetIntelligencePage />} />
        <Route path="what-if" element={<WhatIfSimulatorPage />} />
        <Route path="decisions-approvals" element={<DecisionsApprovalsPage />} />
        <Route path="context-intelligence" element={<ContextAwareIntelligencePage />} />
        <Route path="data-connections" element={<DataConnectionsPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fallback for any unknown route */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <FinancialProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </FinancialProvider>
  );
};

export default App;
