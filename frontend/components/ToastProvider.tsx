'use client';

import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastOptions {
  title?: string;
  duration?: number;
  action?: ToastAction;
}

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  title?: string;
  duration: number; // in ms; 0 or Infinity for persistent
  action?: ToastAction;
  createdAt: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (type: ToastType, message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
  loading: (message: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
  update: (id: string, updates: { type?: ToastType; message?: string; title?: string; duration?: number; action?: ToastAction }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const DEFAULT_DURATION = 3500;

interface ToastItemProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const remainingTimeRef = useRef<number>(toast.duration);
  const startTimeRef = useRef<number>(Date.now());

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => {
      onDismiss(toast.id);
    }, 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    if (toast.duration <= 0 || toast.type === 'loading') {
      return;
    }

    let animationFrameId: number;
    let lastTick = Date.now();

    const updateTimer = () => {
      const now = Date.now();
      const delta = now - lastTick;
      lastTick = now;

      if (!isPaused) {
        remainingTimeRef.current -= delta;
        const pct = Math.max(0, (remainingTimeRef.current / toast.duration) * 100);
        setProgress(pct);

        if (remainingTimeRef.current <= 0) {
          handleClose();
          return;
        }
      }

      animationFrameId = requestAnimationFrame(updateTimer);
    };

    animationFrameId = requestAnimationFrame(updateTimer);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [toast.duration, toast.type, isPaused, handleClose]);

  // Color configurations based on Warm Editorial Lab palette
  const getThemeStyles = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: <CheckCircle2 size={16} strokeWidth={2.2} />,
          iconBg: '#ECFDF5',
          iconColor: '#059669',
          progressColor: '#059669',
          borderColor: 'rgba(5, 150, 105, 0.2)',
        };
      case 'error':
        return {
          icon: <AlertCircle size={16} strokeWidth={2.2} />,
          iconBg: '#FEF2F2',
          iconColor: '#DC2626',
          progressColor: '#DC2626',
          borderColor: 'rgba(220, 38, 38, 0.2)',
        };
      case 'warning':
        return {
          icon: <AlertTriangle size={16} strokeWidth={2.2} />,
          iconBg: '#FFFBEB',
          iconColor: '#D97706',
          progressColor: '#D97706',
          borderColor: 'rgba(217, 119, 6, 0.2)',
        };
      case 'loading':
        return {
          icon: <Loader2 size={16} className="toast-spin" strokeWidth={2.2} />,
          iconBg: '#F5EBE6',
          iconColor: '#9E4A28',
          progressColor: '#9E4A28',
          borderColor: 'rgba(158, 74, 40, 0.2)',
        };
      case 'info':
      default:
        return {
          icon: <Info size={16} strokeWidth={2.2} />,
          iconBg: '#F5EBE6',
          iconColor: '#9E4A28',
          progressColor: '#9E4A28',
          borderColor: 'rgba(158, 74, 40, 0.2)',
        };
    }
  };

  const theme = getThemeStyles();

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        width: '100%',
        maxWidth: '380px',
        backgroundColor: '#FFFFFF',
        color: '#1A1612',
        borderRadius: '12px',
        border: `1px solid ${theme.borderColor}`,
        boxShadow: '0 12px 32px -4px rgba(26, 22, 18, 0.12), 0 4px 12px -2px rgba(26, 22, 18, 0.06)',
        padding: '14px 16px',
        overflow: 'hidden',
        boxSizing: 'border-box',
        pointerEvents: 'auto',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: isClosing ? 0 : 1,
        transform: isClosing ? 'translateY(8px) scale(0.96)' : 'translateY(0) scale(1)',
      }}
    >
      {/* Type Icon Badge */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '8px',
          backgroundColor: theme.iconBg,
          color: theme.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: '1px',
        }}
      >
        {theme.icon}
      </div>

      {/* Main Toast Content */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          flex: 1,
          minWidth: 0,
        }}
      >
        {toast.title && (
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#1A1612',
              lineHeight: 1.3,
            }}
          >
            {toast.title}
          </div>
        )}
        <div
          style={{
            fontSize: '12.5px',
            color: '#736B63',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {toast.message}
        </div>

        {/* Optional Action Button */}
        {toast.action && (
          <div style={{ marginTop: '6px' }}>
            <button
              onClick={() => {
                toast.action?.onClick();
                handleClose();
              }}
              style={{
                background: 'var(--accent-soft, #F5EBE6)',
                color: 'var(--accent, #9E4A28)',
                border: 'none',
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#EBDAD2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--accent-soft, #F5EBE6)';
              }}
            >
              {toast.action.label}
            </button>
          </div>
        )}
      </div>

      {/* Dismiss Button */}
      <button
        onClick={handleClose}
        aria-label="Dismiss notification"
        style={{
          background: 'transparent',
          border: 'none',
          color: '#A39B92',
          cursor: 'pointer',
          padding: '4px',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.15s ease, background-color 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = '#1A1612';
          e.currentTarget.style.backgroundColor = 'rgba(26, 22, 18, 0.06)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = '#A39B92';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <X size={14} />
      </button>

      {/* Visual Countdown Progress Bar */}
      {toast.duration > 0 && toast.type !== 'loading' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: 'rgba(26, 22, 18, 0.04)',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: theme.progressColor,
              borderRadius: '0 2px 2px 0',
              transition: 'width 0.1s linear',
            }}
          />
        </div>
      ) : toast.type === 'loading' ? (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, #9E4A28, #D97706, #9E4A28)',
            backgroundSize: '200% 100%',
            animation: 'toastShimmer 1.5s infinite linear',
          }}
        />
      ) : null}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, message: string, options?: ToastOptions): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const duration = options?.duration !== undefined 
        ? options.duration 
        : (type === 'loading' ? 0 : DEFAULT_DURATION);

      const newToast: ToastItem = {
        id,
        type,
        message,
        title: options?.title,
        duration,
        action: options?.action,
        createdAt: Date.now(),
      };

      setToasts((prev) => [...prev, newToast]);
      return id;
    },
    []
  );

  const success = useCallback((message: string, options?: ToastOptions) => showToast('success', message, options), [showToast]);
  const error = useCallback((message: string, options?: ToastOptions) => showToast('error', message, options), [showToast]);
  const warning = useCallback((message: string, options?: ToastOptions) => showToast('warning', message, options), [showToast]);
  const info = useCallback((message: string, options?: ToastOptions) => showToast('info', message, options), [showToast]);
  const loading = useCallback((message: string, options?: ToastOptions) => showToast('loading', message, options), [showToast]);

  const update = useCallback(
    (id: string, updates: { type?: ToastType; message?: string; title?: string; duration?: number; action?: ToastAction }) => {
      setToasts((prev) =>
        prev.map((item) => {
          if (item.id === id) {
            const newType = updates.type || item.type;
            const newDuration = updates.duration !== undefined
              ? updates.duration
              : (newType === 'loading' ? 0 : DEFAULT_DURATION);
            return {
              ...item,
              ...updates,
              type: newType,
              duration: newDuration,
            };
          }
          return item;
        })
      );
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, showToast, success, error, warning, info, loading, dismiss, update }}>
      {children}
      {/* Toast Container Stack */}
      <div
        id="observation-studio-toast-container"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          zIndex: 9999,
          maxWidth: '380px',
          width: 'calc(100% - 48px)',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
      <style jsx global>{`
        @keyframes toastSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes toastShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .toast-spin {
          animation: toastSpin 1s linear infinite;
        }
      `}</style>
    </ToastContext.Provider>
  );
};
