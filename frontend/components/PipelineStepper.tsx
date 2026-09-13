'use client';

import React from 'react';
import { useTranslation } from '@/lib/i18n';
import { Check, Loader2, AlertCircle, Minus, XCircle } from 'lucide-react';
import { PipelineJob } from '@/lib/api';

interface PipelineStepperProps {
  status: string;
  failedStep?: string;
  isChunked?: boolean;
  uploadPercentage?: number;
  jobs?: PipelineJob[];
}

const chunkedSteps = [
  { key: 'uploaded', labelKey: 'stepUpload', stepName: 'upload' },
  { key: 'chunked', labelKey: 'stepChunking', stepName: 'chunking' },
  { key: 'extracted', labelKey: 'stepExtraction', stepName: 'event_extraction' },
  { key: 'mapped', labelKey: 'stepMapping', stepName: 'mapping' },
  { key: 'report_generated', labelKey: 'stepReport', stepName: 'report_generation' },
];

const fullVideoSteps = [
  { key: 'uploaded', labelKey: 'stepUpload', stepName: 'upload' },
  { key: 'extracted', labelKey: 'stepExtraction', stepName: 'event_extraction' },
  { key: 'mapped', labelKey: 'stepMapping', stepName: 'mapping' },
  { key: 'report_generated', labelKey: 'stepReport', stepName: 'report_generation' },
];

const chunkedStatusOrder: Record<string, number> = {
  uploading: 0,
  uploaded: 0,
  chunking: 1,
  chunked: 1,
  extracting: 2,
  extracted: 2,
  merging: 2,
  merged: 2,
  review_pending: 2,
  mapping: 3,
  mapped: 3,
  statistics: 4,
  generating_report: 4,
  report_generated: 4,
  completed: 4,
};

const fullVideoStatusOrder: Record<string, number> = {
  uploading: 0,
  uploaded: 0,
  chunking: 1,
  chunked: 1,
  extracting: 1,
  extracted: 1,
  merging: 1,
  merged: 1,
  review_pending: 1,
  mapping: 2,
  mapped: 2,
  statistics: 3,
  generating_report: 3,
  report_generated: 3,
  completed: 3,
};

const chunkedStepNameToIndex: Record<string, number> = {
  upload: 0,
  chunking: 1,
  event_extraction: 2,
  extraction: 2,
  event_merge: 2,
  merge: 2,
  deduplication: 2,
  mapping: 3,
  statistics: 4,
  report_generation: 4,
  report: 4,
};

const fullVideoStepNameToIndex: Record<string, number> = {
  upload: 0,
  event_extraction: 1,
  extraction: 1,
  event_merge: 1,
  merge: 1,
  normalization: 1,
  mapping: 2,
  statistics: 3,
  report_generation: 3,
  report: 3,
};

export const PipelineStepper: React.FC<PipelineStepperProps> = ({
  status,
  failedStep,
  isChunked = false,
  uploadPercentage,
  jobs = [],
}) => {
  const { t } = useTranslation();
  const isError = status === 'error' || status === 'failed';
  const isCancelled = status === 'cancelled';
  const isUploading = uploadPercentage !== undefined && uploadPercentage < 100;
  const steps = isChunked ? chunkedSteps : fullVideoSteps;
  const statusOrder = isChunked ? chunkedStatusOrder : fullVideoStatusOrder;
  const stepNameToIndex = isChunked ? chunkedStepNameToIndex : fullVideoStepNameToIndex;
  
  // Calculate failure step index
  let errorStepIndex = isChunked ? 1 : 1;
  if (failedStep && stepNameToIndex[failedStep] !== undefined) {
    errorStepIndex = stepNameToIndex[failedStep];
  } else {
    // Check if any job is failed
    const failedJob = jobs.find((j) => j.status === 'failed' || j.status === 'error');
    if (failedJob && stepNameToIndex[failedJob.step] !== undefined) {
      errorStepIndex = stepNameToIndex[failedJob.step];
    }
  }

  const maxIndex = steps.length - 1;
  const currentStepIndex = isError
    ? errorStepIndex
    : isUploading
    ? 0
    : (statusOrder[status] ?? 0);
  const isRunning =
    !isError &&
    !isCancelled &&
    (isUploading || ['uploading', 'chunking', 'extracting', 'merging', 'mapping', 'statistics', 'generating_report'].includes(status));

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      position: 'relative',
      margin: '20px 0',
      padding: '0 10px',
    }}>
      {/* Background connector track */}
      <div style={{
        position: 'absolute',
        top: '19px',
        left: '40px',
        right: '40px',
        height: '3px',
        backgroundColor: 'var(--card-border)',
        zIndex: 0,
      }} />

      {/* Progress connector line for completed steps */}
      {(currentStepIndex > 0 || (isUploading && uploadPercentage > 5)) && (
        <div style={{
          position: 'absolute',
          top: '19px',
          left: '40px',
          width: isUploading
            ? `${(uploadPercentage / 100) * (1 / maxIndex) * 100 * 0.88}%`
            : `${(Math.min(currentStepIndex, maxIndex) / maxIndex) * 100 * 0.88}%`,
          height: '3px',
          backgroundColor: isError ? '#F87171' : isCancelled ? '#FBBF24' : isUploading ? 'var(--accent)' : 'var(--accent-green)',
          zIndex: 0,
          transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
        }}>
          {isRunning && (
            <div style={{
              width: '40px',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, #FFFFFF, transparent)',
              animation: 'flowingBar 1.5s ease-in-out infinite',
            }} />
          )}
        </div>
      )}

      {steps.map((step, idx) => {
        const jobForStep = jobs.find((j) => j.step === step.stepName);
        const isStepSkipped = jobForStep?.status === 'skipped';
        const isDone =
          (!isUploading && currentStepIndex > idx && !isStepSkipped) ||
          (!isError && !isCancelled && !isUploading && currentStepIndex === idx && !isRunning && idx === maxIndex);
        const isActive = !isError && !isCancelled && currentStepIndex === idx;
        const isFailedNode = isError && currentStepIndex === idx;
        const isCancelledNode = isCancelled && currentStepIndex === idx;

        let badgeBg = '#F4EFE6';
        let badgeColor = 'var(--text-muted)';
        let badgeBorder = 'var(--card-border)';

        if (isDone) {
          badgeBg = 'var(--accent-green)';
          badgeColor = '#FFFFFF';
          badgeBorder = 'var(--accent-green)';
        } else if (isFailedNode) {
          badgeBg = '#DC2626';
          badgeColor = '#FFFFFF';
          badgeBorder = '#DC2626';
        } else if (isCancelledNode) {
          badgeBg = '#D97706';
          badgeColor = '#FFFFFF';
          badgeBorder = '#D97706';
        } else if (isStepSkipped) {
          badgeBg = '#E5E7EB';
          badgeColor = '#6B7280';
          badgeBorder = '#D1D5DB';
        } else if (isActive) {
          badgeBg = 'var(--accent)';
          badgeColor = '#FFFFFF';
          badgeBorder = 'var(--accent)';
        }

        return (
          <div
            key={step.key}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div
              className={isActive && isRunning ? 'animate-pulse-glow' : ''}
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                backgroundColor: badgeBg,
                border: `2px solid ${badgeBorder}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: isUploading && idx === 0 ? '11px' : '13px',
                fontFamily: isUploading && idx === 0 ? 'var(--font-mono)' : 'inherit',
                fontWeight: 700,
                color: badgeColor,
                boxShadow: isDone
                  ? '0 0 0 3px var(--accent-green-soft)'
                  : isFailedNode
                  ? '0 0 0 4px #FEE2E2'
                  : isCancelledNode
                  ? '0 0 0 4px #FEF3C7'
                  : isUploading && idx === 0
                  ? '0 0 0 4px var(--accent-soft)'
                  : isActive && !isRunning
                  ? '0 0 0 4px var(--accent-soft)'
                  : 'none',
                transition: 'all 0.25s ease',
              }}
            >
              {isDone ? (
                <Check size={18} strokeWidth={3} />
              ) : isFailedNode ? (
                <AlertCircle size={20} strokeWidth={2.5} />
              ) : isCancelledNode ? (
                <XCircle size={18} strokeWidth={2.5} />
              ) : isStepSkipped ? (
                <Minus size={18} strokeWidth={2.5} />
              ) : isUploading && idx === 0 ? (
                `${uploadPercentage}%`
              ) : isActive && isRunning ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                idx + 1
              )}
            </div>

            <span style={{
              fontSize: '12px',
              fontWeight: isDone || isFailedNode || isCancelledNode || isActive ? 700 : 500,
              color: isDone
                ? 'var(--accent-green)'
                : isFailedNode
                ? '#DC2626'
                : isCancelledNode
                ? '#D97706'
                : isStepSkipped
                ? '#9CA3AF'
                : isUploading && idx === 0
                ? 'var(--accent)'
                : isActive
                ? 'var(--accent)'
                : 'var(--text-muted)',
              textAlign: 'center',
              maxWidth: '96px',
            }}>
              {t(step.labelKey)}
              {isDone && (
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--accent-green)', fontWeight: 600 }}>
                  ✓ Done
                </span>
              )}
              {isFailedNode && (
                <span style={{ display: 'block', fontSize: '10px', color: '#DC2626', fontWeight: 700 }}>
                  ✕ Failed
                </span>
              )}
              {isCancelledNode && (
                <span style={{ display: 'block', fontSize: '10px', color: '#D97706', fontWeight: 700 }}>
                  ⊘ Cancelled
                </span>
              )}
              {isStepSkipped && (
                <span style={{ display: 'block', fontSize: '10px', color: '#6B7280', fontWeight: 600 }}>
                  - Skipped
                </span>
              )}
              {isUploading && idx === 0 && (
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                  {uploadPercentage}%
                </span>
              )}
              {isActive && isRunning && (!isUploading || idx !== 0) && (
                <span style={{ display: 'block', fontSize: '10px', color: 'var(--accent)', fontWeight: 600 }}>
                  In Progress
                </span>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
};

