'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Sidebar } from '@/components/Sidebar';
import { PipelineNotificationCenter } from '@/components/PipelineNotificationCenter';

import { useSidebar } from '@/lib/sidebarContext';
import { PanelLeft } from 'lucide-react';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggleSidebar } = useSidebar();
  const [checking, setChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const token = api.getToken();
    const isLoginPage = pathname?.startsWith('/login');

    if (!token) {
      setIsAuthenticated(false);
      if (!isLoginPage) {
        router.replace('/login');
      }
    } else {
      setIsAuthenticated(true);
      if (isLoginPage) {
        router.replace('/');
      }
    }
    setChecking(false);
  }, [pathname, router]);

  const isLoginPage = pathname?.startsWith('/login');

  // If on login page, render full screen without sidebar
  if (isLoginPage) {
    return <main style={{ width: '100vw', minHeight: '100vh' }}>{children}</main>;
  }

  // If checking authentication or unauthenticated on protected route
  if (checking || !isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        width: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg)',
        color: 'var(--text-muted)',
        fontFamily: 'var(--font-sans)',
        fontSize: '14px',
        gap: '12px',
      }}>
        <div style={{
          width: '20px',
          height: '20px',
          border: '2px solid var(--card-border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span>Verifying research session...</span>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Authenticated: Render with Sidebar & Top Activity Header
  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        minWidth: 0,
      }}>
        {/* Top Activity Header */}
        <header style={{
          height: '56px',
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          backdropFilter: 'blur(8px)',
          borderBottom: '1px solid var(--card-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 28px',
          flexShrink: 0,
          zIndex: 100,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {collapsed && (
              <button
                onClick={toggleSidebar}
                title="Expand Sidebar"
                aria-label="Expand Sidebar"
                style={{
                  background: 'transparent',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-sm, 6px)',
                  padding: '6px 8px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  backgroundColor: '#FFFFFF',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--accent)';
                  e.currentTarget.style.color = 'var(--accent)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--card-border)';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <PanelLeft size={16} />
                <span>Menu</span>
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <PipelineNotificationCenter />
          </div>
        </header>

        <main style={{
          flex: 1,
          padding: '32px 44px',
          overflowY: 'auto',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}

