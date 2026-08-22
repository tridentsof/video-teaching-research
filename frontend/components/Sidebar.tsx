'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from '@/lib/i18n';
import { useSidebar } from '@/lib/sidebarContext';
import { User, api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import {
  Video,
  UploadCloud,
  CheckSquare,
  FileText,
  Network,
  Mic,
  Globe,
  Code2,
  LogOut,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';

export const Sidebar: React.FC = () => {
  const pathname = usePathname();
  const { language, setLanguage, t } = useTranslation();
  const { collapsed, toggleSidebar } = useSidebar();
  const toast = useToast();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const current = api.getCurrentUser();
    setUser(current);
  }, [pathname]);

  const navItems = [
    { href: '/', label: t('navVideos'), icon: Video },
    { href: '/upload', label: t('navUpload'), icon: UploadCloud },
    { href: '/checklists', label: t('navChecklists'), icon: CheckSquare },
    { href: '/reports', label: t('navReports'), icon: FileText },
    { href: '/themes', label: t('navThemes'), icon: Network },
    { href: '/interview', label: t('navInterview'), icon: Mic },
    { href: '/docs', label: t('navApiDocs'), icon: Code2, target: '_blank' },
  ];

  return (
    <aside style={{
      width: collapsed ? '76px' : '280px',
      backgroundColor: 'var(--sidebar-bg)',
      borderRight: '1px solid var(--card-border)',
      padding: collapsed ? '24px 10px' : '32px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: '28px',
      position: 'sticky',
      top: 0,
      height: '100vh',
      flexShrink: 0,
      transition: 'width 0.22s cubic-bezier(0.4, 0, 0.2, 1), padding 0.22s cubic-bezier(0.4, 0, 0.2, 1)',
      overflowX: 'hidden',
    }}>
      {/* Brand & Toggle Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        position: 'relative',
        minHeight: '44px',
      }}>
        {!collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, overflow: 'hidden' }}>
            <h1 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '24px',
              fontWeight: 400,
              color: 'var(--accent)',
              letterSpacing: '-0.5px',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
            }}>
              Observation Studio
            </h1>
            <span style={{
              fontSize: '10.5px',
              fontWeight: 600,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}>
              Classroom Video Lab
            </span>
          </div>
        ) : (
          <div
            title="Observation Studio"
            style={{
              width: '38px',
              height: '38px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent)',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-serif)',
              fontSize: '17px',
              fontWeight: 700,
              boxShadow: '0 2px 8px rgba(158, 74, 40, 0.25)',
              cursor: 'pointer',
            }}
            onClick={toggleSidebar}
          >
            OS
          </div>
        )}

        {/* Toggle Collapse Button */}
        {!collapsed && (
          <button
            onClick={toggleSidebar}
            title="Collapse Sidebar"
            aria-label="Collapse Sidebar"
            style={{
              background: 'transparent',
              border: '1px solid transparent',
              borderRadius: 'var(--radius-sm, 6px)',
              padding: '6px',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--card-bg)';
              e.currentTarget.style.borderColor = 'var(--card-border)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <PanelLeftClose size={18} />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              target={item.target}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: '12px',
                padding: collapsed ? '10px 0' : '10px 14px',
                borderRadius: 'var(--radius-sm)',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--card-bg)' : 'transparent',
                borderLeft: !collapsed ? (isActive ? '3px solid var(--accent)' : '3px solid transparent') : 'none',
                fontWeight: isActive ? 600 : 500,
                fontSize: '13px',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
            >
              <Icon size={18} style={{ flexShrink: 0 }} />
              {!collapsed && (
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Session & Auth Bottom Section */}
      <div style={{
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        {/* User Profile Card */}
        {!collapsed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            backgroundColor: 'var(--card-bg)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--card-border)',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {user ? user.username.charAt(0).toUpperCase() : '?'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}>
                  {user ? user.username : 'Researcher'}
                </span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {t('authRoleLab')}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                api.logout();
                setUser(null);
                toast.info(t('authSignOut') || 'Signed out of session', { title: 'Session Ended' });
              }}
              title={t('authSignOut')}
              aria-label={t('authSignOut')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                borderRadius: '4px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#DC2626';
                e.currentTarget.style.backgroundColor = 'rgba(220, 38, 38, 0.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-muted)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <LogOut size={15} />
            </button>
          </div>
        ) : (
          <div
            title={`${user ? user.username : 'Researcher'} (${t('authRoleLab')}) — Click to sign out`}
            onClick={() => {
              api.logout();
              setUser(null);
              toast.info(t('authSignOut') || 'Signed out of session', { title: 'Session Ended' });
            }}
            style={{
              width: '36px',
              height: '36px',
              margin: '0 auto',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              border: '1px solid var(--card-border)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#DC2626';
              e.currentTarget.style.color = '#DC2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--card-border)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
          >
            {user ? user.username.charAt(0).toUpperCase() : '?'}
          </div>
        )}

        {/* Language Switcher */}
        {!collapsed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '12px',
            border: '1px solid var(--card-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Globe size={14} />
              <span>{t('language')}</span>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => {
                  setLanguage('en');
                  toast.info('Language set to English', { duration: 2000 });
                }}
                style={{
                  border: 'none',
                  backgroundColor: language === 'en' ? 'var(--card-bg)' : 'transparent',
                  color: language === 'en' ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: language === 'en' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                EN
              </button>
              <button
                onClick={() => {
                  setLanguage('vi');
                  toast.info('Đã chuyển ngôn ngữ sang Tiếng Việt', { duration: 2000 });
                }}
                style={{
                  border: 'none',
                  backgroundColor: language === 'vi' ? 'var(--card-bg)' : 'transparent',
                  color: language === 'vi' ? 'var(--accent)' : 'var(--text-muted)',
                  fontWeight: 600,
                  padding: '4px 8px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: language === 'vi' ? 'var(--shadow-sm)' : 'none',
                }}
              >
                VI
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => {
              const nextLang = language === 'en' ? 'vi' : 'en';
              setLanguage(nextLang);
              toast.info(nextLang === 'vi' ? 'Đã chuyển sang Tiếng Việt' : 'Language set to English', { duration: 2000 });
            }}
            title={`Switch Language (${language.toUpperCase()})`}
            style={{
              width: '36px',
              height: '36px',
              margin: '0 auto',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'rgba(255, 255, 255, 0.7)',
              border: '1px solid var(--card-border)',
              color: 'var(--accent)',
              fontWeight: 700,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
          >
            {language.toUpperCase()}
          </button>
        )}
      </div>
    </aside>
  );
};
