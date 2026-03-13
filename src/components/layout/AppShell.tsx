import React from 'react';
import BottomNav from './BottomNav';
import CadenceFAB from './CadenceFAB';
import { CadenceProvider, useCadence } from '../../context/CadenceContext';

interface AppShellProps {
  children: React.ReactNode;
}

function AppShellInner({ children }: AppShellProps) {
  const { openCadence } = useCadence();

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={{
        height: '100dvh',
        background: '#FAF7F3',
        fontFamily: "'DM Sans', sans-serif",
        maxWidth: '430px',
        margin: '0 auto',
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400;1,500&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: #FAF7F3; }
        ::-webkit-scrollbar { display: none; }
        scrollbar-width: none;
        @keyframes cadence-breathe {
          0%   { transform: scale(1);    opacity: 1; }
          38%  { transform: scale(1.13); opacity: 0.85; }
          100% { transform: scale(1);    opacity: 1; }
        }
        @keyframes cadence-glow {
          0%, 100% { box-shadow: 0 4px 20px rgba(0,0,0,0.28), 0 0 0 1px rgba(201,169,110,0.18), 0 0 0px rgba(201,169,110,0); }
          38%  { box-shadow: 0 4px 20px rgba(0,0,0,0.28), 0 0 0 1px rgba(201,169,110,0.50), 0 0 28px rgba(201,169,110,0.32); }
          100% { box-shadow: 0 4px 20px rgba(0,0,0,0.28), 0 0 0 1px rgba(201,169,110,0.18), 0 0 0px rgba(201,169,110,0); }
        }
        @keyframes cadence-ripple {
          0%   { transform: scale(1);   opacity: 0.45; }
          80%  { transform: scale(1.85); opacity: 0; }
          100% { transform: scale(1.85); opacity: 0; }
        }
        @keyframes cadence-bar-left {
          0%, 100% { height: 10px; opacity: 0.85; }
          45%      { height: 15px; opacity: 1; }
        }
        @keyframes cadence-bar-center {
          0%, 100% { height: 16px; opacity: 0.9; }
          50%      { height: 10px; opacity: 0.75; }
        }
        @keyframes cadence-bar-right {
          0%, 100% { height: 12px; opacity: 0.85; }
          40%      { height: 8px;  opacity: 0.7; }
          70%      { height: 16px; opacity: 1; }
        }
      `}</style>

      {/* ── Top header bar — Horsera brand mark ── */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: '430px',
        minHeight: '48px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        background: 'rgba(250,247,243,0.95)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #EDE7DF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        flexShrink: 0,
      }}>
        <img
          src={`${import.meta.env.BASE_URL}horsera-logo.png`}
          alt="Horsera"
          style={{ height: '30px', width: 'auto', display: 'block' }}
        />
      </header>

      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: '82px', paddingTop: 'calc(48px + env(safe-area-inset-top, 0px))' }}
      >
        {children}
      </main>

      <BottomNav />
      <CadenceFAB onClick={openCadence} />
    </div>
  );
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <CadenceProvider>
      <AppShellInner>{children}</AppShellInner>
    </CadenceProvider>
  );
}
