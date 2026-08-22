'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { ShieldCheck, Eye, EyeOff, Sparkles, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const toast = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!username.trim() || !password.trim()) {
      const msg = 'Please enter your researcher username and password.';
      setError(msg);
      toast.warning(msg, { title: 'Input Required' });
      return;
    }

    try {
      setLoading(true);
      await api.login(username, password);
      const msg = t('authSuccessLogin');
      setSuccessMsg(msg);
      toast.success(msg, { title: 'Authentication Successful' });

      setTimeout(() => {
        window.location.href = '/';
      }, 400);
    } catch (err: any) {
      const msg = err.message || 'Authentication failed. Please check your credentials.';
      setError(msg);
      toast.error(msg, { title: 'Login Failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = () => {
    setUsername('researcher');
    setPassword('Password123!');
    setError(null);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
      backgroundColor: 'var(--bg)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-lg, 16px)',
        padding: '36px 32px',
        boxShadow: '0 12px 36px rgba(26, 22, 18, 0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}>
        {/* Header & Badge */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 12px',
            backgroundColor: 'var(--accent-soft)',
            color: 'var(--accent)',
            borderRadius: '999px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            width: 'fit-content',
            fontFamily: 'var(--font-mono)',
          }}>
            <ShieldCheck size={13} />
            <span>{t('authRoleLab')}</span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '28px',
            fontWeight: 400,
            color: 'var(--text-main)',
            lineHeight: 1.15,
            letterSpacing: '-0.5px',
          }}>
            {t('authPortalTitle')}
          </h1>

          <p style={{
            fontSize: '13px',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}>
            {t('authPortalSubtitle')}
          </p>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FCA5A5',
            color: '#991B1B',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: 1.4,
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            color: '#166534',
            padding: '12px 14px',
            borderRadius: '8px',
            fontSize: '13px',
            lineHeight: 1.4,
          }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Username */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              {t('authUsername')} <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. researcher"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '8px',
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text-main)',
                fontSize: '14px',
                outline: 'none',
                transition: 'border-color 0.15s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
            />
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
              {t('authPassword')} <span style={{ color: 'var(--accent)' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text-main)',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--card-border)'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '2px',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: 'var(--accent)',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '14px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              boxShadow: '0 2px 8px rgba(158, 74, 40, 0.25)',
              transition: 'all 0.15s ease',
            }}
          >
            <span>{loading ? t('authSigningIn') : t('authSignIn')}</span>
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Quick Demo Helper */}
        <div style={{
          paddingTop: '16px',
          borderTop: '1px dashed var(--card-border)',
          display: 'flex',
          justifyContent: 'center',
        }}>
          <button
            type="button"
            onClick={handleQuickDemo}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              background: 'transparent',
              border: 'none',
              color: 'var(--accent)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
          >
            <Sparkles size={13} />
            <span>{t('authQuickDemo')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
