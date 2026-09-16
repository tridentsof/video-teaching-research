'use client';

import React, { useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import {
  CornerDownRight,
  Zap,
  Hand,
  BookOpen,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export type FeatureWorkflowKey =
  | 'videos'
  | 'upload'
  | 'checklists'
  | 'codebook'
  | 'reports'
  | 'analytics'
  | 'themes'
  | 'interview';

interface FeatureWorkflowBannerProps {
  featureKey: FeatureWorkflowKey;
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
};

export const FeatureWorkflowBanner: React.FC<FeatureWorkflowBannerProps> = ({
  featureKey,
  defaultExpanded = true,
}) => {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(defaultExpanded);

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
        borderLeft: '4px solid var(--accent, #9E4A28)',
        borderRadius: 'var(--radius-md, 14px)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(40, 30, 20, 0.04))',
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

          {/* Predecessor step */}
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
