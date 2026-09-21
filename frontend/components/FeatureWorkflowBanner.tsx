'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { usePipelineSync } from '@/lib/pipelineSync';
import {
  CornerDownRight,
  Zap,
  Hand,
  BookOpen,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

export type FeatureWorkflowKey =
  | 'videos'
  | 'upload'
  | 'checklists'
  | 'codebook'
  | 'reports'
  | 'analytics'
  | 'themes'
  | 'interview'
  | 'interview_analysis';

interface FeatureWorkflowBannerProps {
  featureKey: FeatureWorkflowKey;
  videoId?: string;
  defaultExpanded?: boolean;
}

interface FeatureMeta {
  mode: 'auto' | 'manual' | 'reference' | 'semi_auto';
  stepKey: string;
  runsAfterKey: string;
  autoTextKey: string;
  descKey: string;
}

const FEATURE_META_MAP: Record<FeatureWorkflowKey, FeatureMeta> = {
  videos: {
    mode: 'auto',
    stepKey: 'wfVideosStep',
    runsAfterKey: 'wfVideosRunsAfter',
    autoTextKey: 'wfVideosAutoText',
    descKey: 'wfVideosDesc',
  },
  upload: {
    mode: 'auto',
    stepKey: 'wfUploadStep',
    runsAfterKey: 'wfUploadRunsAfter',
    autoTextKey: 'wfUploadAutoText',
    descKey: 'wfUploadDesc',
  },
  checklists: {
    mode: 'reference',
    stepKey: 'wfChecklistsStep',
    runsAfterKey: 'wfChecklistsRunsAfter',
    autoTextKey: 'wfChecklistsAutoText',
    descKey: 'wfChecklistsDesc',
  },
  codebook: {
    mode: 'auto',
    stepKey: 'wfCodebookStep',
    runsAfterKey: 'wfCodebookRunsAfter',
    autoTextKey: 'wfCodebookAutoText',
    descKey: 'wfCodebookDesc',
  },
  reports: {
    mode: 'auto',
    stepKey: 'wfReportsStep',
    runsAfterKey: 'wfReportsRunsAfter',
    autoTextKey: 'wfReportsAutoText',
    descKey: 'wfReportsDesc',
  },
  analytics: {
    mode: 'auto',
    stepKey: 'wfAnalyticsStep',
    runsAfterKey: 'wfAnalyticsRunsAfter',
    autoTextKey: 'wfAnalyticsAutoText',
    descKey: 'wfAnalyticsDesc',
  },
  themes: {
    mode: 'manual',
    stepKey: 'wfThemesStep',
    runsAfterKey: 'wfThemesRunsAfter',
    autoTextKey: 'wfThemesAutoText',
    descKey: 'wfThemesDesc',
  },
  interview: {
    mode: 'semi_auto',
    stepKey: 'wfInterviewStep',
    runsAfterKey: 'wfInterviewRunsAfter',
    autoTextKey: 'wfInterviewAutoText',
    descKey: 'wfInterviewDesc',
  },
  interview_analysis: {
    mode: 'semi_auto',
    stepKey: 'wfInterviewAnalysisStep',
    runsAfterKey: 'wfInterviewAnalysisRunsAfter',
    autoTextKey: 'wfInterviewAnalysisAutoText',
    descKey: 'wfInterviewAnalysisDesc',
  },
};

export const FeatureWorkflowBanner: React.FC<FeatureWorkflowBannerProps> = ({
  featureKey,
  videoId,
  defaultExpanded = true,
}) => {
  const { language, t } = useTranslation();
  const toast = useToast();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const {
    syncState,
    staleReasonVi,
    staleReasonEn,
    isSyncing,
    triggerSync,
  } = usePipelineSync(featureKey, videoId);

  const meta = FEATURE_META_MAP[featureKey];
  if (!meta) return null;

  const renderBadge = () => {
    switch (meta.mode) {
      case 'auto':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-green-soft, #EAF4EE)',
              color: 'var(--accent-green, #2D6A4F)',
              border: '1px solid rgba(45, 106, 79, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <Zap size={13} style={{ fill: 'currentColor' }} />
            <span>{t(meta.autoTextKey)}</span>
          </span>
        );
      case 'manual':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-amber-soft, #FEF7EA)',
              color: 'var(--accent-amber, #B26A00)',
              border: '1px solid rgba(178, 106, 0, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <Hand size={13} />
            <span>{t(meta.autoTextKey)}</span>
          </span>
        );
      case 'reference':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-blue-soft, #EBF3F9)',
              color: 'var(--accent-blue, #1D5C8A)',
              border: '1px solid rgba(29, 92, 138, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <BookOpen size={13} />
            <span>{t(meta.autoTextKey)}</span>
          </span>
        );
      case 'semi_auto':
        return (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 600,
              padding: '4px 12px',
              borderRadius: '999px',
              backgroundColor: 'var(--accent-purple-soft, #F3E8FF)',
              color: 'var(--accent-purple, #6D28D9)',
              border: '1px solid rgba(109, 40, 217, 0.25)',
              whiteSpace: 'nowrap',
            }}
          >
            <Sparkles size={13} />
            <span>{t(meta.autoTextKey)}</span>
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border, #E8E3D9)',
        borderLeft: syncState === 'stale' ? '4px solid #D97706' : '4px solid var(--accent, #9E4A28)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(40, 30, 20, 0.04))',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top row: Step Sequence, Predecessor, Automation Badge, Collapse Toggle */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
          }}
        >
          {/* Step Pill */}
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: '6px',
              backgroundColor: 'var(--accent-soft, #F5EBE6)',
              color: 'var(--accent, #9E4A28)',
              border: '1px solid rgba(158, 74, 40, 0.25)',
              letterSpacing: '0.2px',
            }}
          >
            {t(meta.stepKey)}
          </span>

          {/* Predecessor step with Dynamic Status */}
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              color: 'var(--text-muted, #736B63)',
              backgroundColor: '#F7F3EC',
              padding: '3px 10px',
              borderRadius: '6px',
              border: '1px solid #EAE3D5',
            }}
          >
            <CornerDownRight size={13} style={{ color: 'var(--accent, #9E4A28)', flexShrink: 0 }} />
            <span>
              <strong style={{ color: 'var(--text-main, #1A1612)' }}>{t('wfRunsAfterLabel')}</strong>{' '}
              {t(meta.runsAfterKey)}
            </span>

            {/* Dynamic Sync Status Pill */}
            {featureKey !== 'videos' && featureKey !== 'upload' && featureKey !== 'checklists' && (
              <span
                style={{
                  marginLeft: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  fontWeight: 600,
                  padding: '1px 8px',
                  borderRadius: '999px',
                  backgroundColor:
                    syncState === 'stale'
                      ? '#FEF3C7'
                      : syncState === 'running_predecessor'
                      ? '#DBEAFE'
                      : '#DCFCE7',
                  color:
                    syncState === 'stale'
                      ? '#B45309'
                      : syncState === 'running_predecessor'
                      ? '#1E40AF'
                      : '#15803D',
                  border: `1px solid ${
                    syncState === 'stale'
                      ? '#FDE68A'
                      : syncState === 'running_predecessor'
                      ? '#BFDBFE'
                      : '#BBF7D0'
                  }`,
                }}
              >
                {syncState === 'stale' ? (
                  <>
                    <AlertTriangle size={10} />
                    <span>{t('wfStatusStale')}</span>
                  </>
                ) : syncState === 'running_predecessor' ? (
                  <>
                    <Loader2 size={10} className="animate-spin" />
                    <span>{t('wfStatusRunning')}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={10} />
                    <span>{t('wfStatusSynced')}</span>
                  </>
                )}
              </span>
            )}
          </span>
        </div>

        {/* Right side: Automation Badge & Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {renderBadge()}

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              color: 'var(--text-subtle, #A39B92)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
            }}
            title={expanded ? 'Thu gọn / Collapse' : 'Mở rộng / Expand'}
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Dynamic Warning & Take Action Box when Stale */}
      {syncState === 'stale' && (
        <div
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: '10px',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1, minWidth: '240px' }}>
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: '#FEF3C7',
                color: '#D97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                marginTop: '1px',
              }}
            >
              <AlertTriangle size={15} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400E' }}>
                {t('wfSyncWarningTitle')}
              </div>
              <div style={{ fontSize: '12px', color: '#B45309', marginTop: '2px', lineHeight: 1.4 }}>
                {(language === 'vi' ? staleReasonVi : staleReasonEn) || t('wfSyncWarningDesc')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              const ok = await triggerSync();
              if (ok) {
                toast.success(
                  language === 'vi'
                    ? `Đã kích hoạt đồng bộ thành công cho bước ${t(meta.stepKey)}.`
                    : `Successfully triggered synchronization for ${t(meta.stepKey)}.`,
                  {
                    title: language === 'vi' ? 'Đồng bộ thành công' : 'Sync Succeeded',
                  }
                );
              } else {
                toast.info(
                  language === 'vi'
                    ? 'Đang tiến hành đồng bộ dữ liệu với kết quả mới nhất.'
                    : 'Synchronizing with latest video analysis results.',
                  {
                    title: language === 'vi' ? 'Đang đồng bộ' : 'Syncing Data',
                  }
                );
              }
            }}
            disabled={isSyncing}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '8px',
              backgroundColor: '#D97706',
              color: '#FFFFFF',
              border: 'none',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
              opacity: isSyncing ? 0.7 : 1,
              transition: 'all 0.15s ease',
              whiteSpace: 'nowrap',
            }}
          >
            <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
            <span>{isSyncing ? t('wfSyncingBtn') : t('wfTakeActionBtn')}</span>
          </button>
        </div>
      )}

      {/* Expandable description and operational guide */}
      {expanded && (
        <div
          style={{
            fontSize: '12.8px',
            color: 'var(--text-muted, #736B63)',
            lineHeight: 1.5,
            paddingTop: '8px',
            borderTop: '1px dashed var(--card-border-soft, #F0EAE1)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <Info
            size={15}
            style={{
              flexShrink: 0,
              marginTop: '2px',
              color: 'var(--accent, #9E4A28)',
            }}
          />
          <div>
            <strong style={{ color: 'var(--text-main, #1A1612)' }}>
              {t('wfOperationalGuide')}
            </strong>{' '}
            {t(meta.descKey)}
          </div>
        </div>
      )}
    </div>
  );
};
