'use client';

import React from 'react';
import { QualitativeEvidenceItem } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { X, Clock } from 'lucide-react';

interface CodeEvidenceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  codeTitle: string;
  codeDescription?: string;
  category?: string;
  theme?: string;
  evidence: QualitativeEvidenceItem[];
}

export const CodeEvidenceDrawer: React.FC<CodeEvidenceDrawerProps> = ({
  isOpen,
  onClose,
  codeTitle,
  codeDescription,
  category,
  theme,
  evidence,
}) => {
  const { t, language } = useTranslation();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(28, 25, 23, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'flex-end',
        transition: 'opacity 0.2s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '520px',
          height: '100%',
          backgroundColor: '#FFFFFF',
          boxShadow: '-6px 0 28px rgba(0, 0, 0, 0.18)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div
          style={{
            padding: '24px 28px 18px 28px',
            borderBottom: '1px solid var(--card-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            backgroundColor: 'var(--bg)',
          }}
        >
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.6px',
                color: 'var(--accent)',
                marginBottom: '6px',
              }}
            >
              <span>{t('qualitativeDrawerTitle')}</span>
            </div>
            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                fontWeight: 400,
                color: 'var(--text-main)',
                lineHeight: 1.2,
                margin: 0,
              }}
            >
              {codeTitle}
            </h3>
            {codeDescription && (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>
                {codeDescription}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={t('qualitativeDrawerClose')}
          >
            <X size={20} />
          </button>
        </div>

        {/* Metadata Context */}
        <div
          style={{
            padding: '12px 28px',
            borderBottom: '1px solid var(--card-border-soft)',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            fontSize: '12px',
          }}
        >
          {category && (
            <div>
              <span style={{ color: 'var(--text-subtle)' }}>{t('qualitativeDrawerCategory')} </span>
              <strong style={{ color: 'var(--text-main)' }}>{category}</strong>
            </div>
          )}
          {theme && (
            <div>
              <span style={{ color: 'var(--text-subtle)' }}>{t('qualitativeDrawerTheme')} </span>
              <strong style={{ color: 'var(--accent)' }}>{theme}</strong>
            </div>
          )}
          <div>
            <span style={{ color: 'var(--text-subtle)' }}>{t('qualitativeDrawerTotalCitations')} </span>
            <strong style={{ color: 'var(--accent-green)' }}>
              {evidence.length} {t('qualitativeDrawerExcerpts')}
            </strong>
          </div>
        </div>

        {/* Body / Evidence List */}
        <div
          style={{
            padding: '24px 28px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', fontWeight: 600 }}>
            {t('qualitativeDrawerEvidenceHeading')}
          </div>

          {evidence.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg)',
                borderRadius: '8px',
                border: '1px dashed var(--card-border)',
              }}
            >
              {t('qualitativeDrawerNoEvidence')}
            </div>
          ) : (
            evidence.map((item, idx) => (
              <div
                key={idx}
                style={{
                  border: '1px solid var(--card-border)',
                  borderRadius: '10px',
                  backgroundColor: 'var(--bg)',
                  padding: '14px 16px',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  borderLeft: '4px solid var(--accent)',
                }}
              >
                {/* Meta line */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        fontSize: '11.5px',
                        backgroundColor: 'var(--card-bg)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--card-border)',
                        color: 'var(--text-main)',
                      }}
                    >
                      {item.lesson}
                    </span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: 'var(--accent-blue)',
                      }}
                    >
                      <Clock size={12} />
                      {item.timestamp_str || '00:00:00'}
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--accent-soft)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontWeight: 600,
                    }}
                  >
                    AI Conf: {Math.round((item.confidence || 0.9) * 100)}%
                  </span>
                </div>

                {/* Direct Quote */}
                <div
                  style={{
                    fontStyle: 'italic',
                    fontSize: '13px',
                    color: 'var(--text-main)',
                    lineHeight: 1.45,
                    padding: '6px 0',
                  }}
                >
                  &ldquo;{item.quote}&rdquo;
                </div>

                {/* Context */}
                {item.context && (
                  <div
                    style={{
                      fontSize: '11.5px',
                      color: 'var(--text-muted)',
                      borderTop: '1px dashed var(--card-border-soft)',
                      paddingTop: '6px',
                      display: 'flex',
                      gap: '4px',
                    }}
                  >
                    <span style={{ color: 'var(--text-subtle)', fontWeight: 600 }}>
                      {t('qualitativeDrawerContext')}
                    </span>
                    <span>{item.context}</span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Drawer Footer */}
        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid var(--card-border)',
            backgroundColor: '#FFFFFF',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            {t('qualitativeDrawerClose')}
          </button>
        </div>
      </div>
    </div>
  );
};

