import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CopilotDrawer } from './CopilotDrawer';
import { AskFinvoraDrawer } from './AskFinvoraDrawer';
import { ToastContainer } from '../common/ToastContainer';
import { FinvoraDock } from '../navigation/FinvoraDock';

export const AppShell: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--text-primary)] flex flex-col font-sans relative selection:bg-[#F59E0B]/20 selection:text-[#F59E0B] transition-colors duration-200">
      {/* Atmospheric Background Layers (Non-interactive) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute -top-[15%] left-[10%] w-[600px] h-[600px] rounded-full bg-amber-500/[0.04] dark:bg-amber-500/[0.03] blur-[120px]" />
        <div className="absolute top-[25%] right-[5%] w-[500px] h-[500px] rounded-full bg-sky-500/[0.03] dark:bg-sky-500/[0.02] blur-[140px]" />
      </div>

      {/* Sidebar (Temporarily commented out for dock-only view; code preserved) */}
      {/* <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} /> */}

      {/* Main Layout Area */}
      <div className="flex flex-col min-h-screen relative pb-24">
        {/* Persistent Top Bar */}
        <TopBar onOpenSidebar={() => setSidebarOpen(true)} />

        {/* Page Content Body */}
        <main className="flex-1 p-6 sm:p-7 max-w-[1580px] w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Floating Magnetic Navigation Dock */}
      <div className="finvora-dock-wrapper fixed bottom-4 left-0 right-0 z-20 pointer-events-none flex justify-center px-4 transition-all duration-300">
        <div className="pointer-events-auto">
          <FinvoraDock />
        </div>
      </div>

      {/* Contextual AI Copilot Drawer */}
      <CopilotDrawer />

      {/* Ask FINVORA Conversational Assistant (Sarvam AI) */}
      <AskFinvoraDrawer />

      {/* Global Notifications */}
      <ToastContainer />
    </div>
  );
};

