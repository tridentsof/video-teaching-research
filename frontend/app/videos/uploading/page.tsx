'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUpload } from '@/lib/uploadContext';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { PipelineStepper } from '@/components/PipelineStepper';
import { EventTimeline } from '@/components/EventTimeline';
import { api, RawEvent, PipelineJob, Video } from '@/lib/api';
import {
  UploadCloud,
  Loader2,
  ArrowLeft,
  Square,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  XCircle,
  HardDrive,
  Zap,
  Timer,
  CheckCircle2,
  Clock,
  Check,
  FileText,
  Copy,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';

const chunkedStepOrder = [
  { key: 'upload', nameKey: 'stepUploadTitle', descKey: 'stepUploadDesc' },
  { key: 'chunking', nameKey: 'stepChunkingTitle', descKey: 'stepChunkingDesc' },
  { key: 'event_extraction', altKey: 'extracting', nameKey: 'stepExtractingChunkedTitle', descKey: 'stepExtractingChunkedDesc' },
  { key: 'event_merge', altKey: 'merging', nameKey: 'stepMergeTitle', descKey: 'stepMergeDesc' },
  { key: 'mapping', nameKey: 'stepMappingChunkedTitle', descKey: 'stepMappingDesc' },
  { key: 'report_generation', altKey: 'statistics', nameKey: 'stepReportChunkedTitle', descKey: 'stepReportDesc' },
];

const fullVideoStepOrder = [
  { key: 'upload', nameKey: 'stepUploadTitle', descKey: 'stepUploadDesc' },
  { key: 'event_extraction', altKey: 'extracting', nameKey: 'stepExtractingTitle', descKey: 'stepExtractingDesc' },
  { key: 'event_merge', altKey: 'merging', nameKey: 'stepNormalizationTitle', descKey: 'stepNormalizationDesc' },
  { key: 'mapping', nameKey: 'stepMappingTitle', descKey: 'stepMappingDesc' },
  { key: 'report_generation', altKey: 'statistics', nameKey: 'stepReportTitle', descKey: 'stepReportDesc' },
];

export default function VideoUploadingPage() {
  const { activeUpload, cancelUpload, clearUpload } = useUpload();
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [video, setVideo] = useState<Video | null>(null);
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [cancelling, setCancelling] = useState(false);

  // Live stopwatch counter
  useEffect(() => {
    if (!activeUpload || activeUpload.status === 'cancelled' || activeUpload.status === 'error') return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeUpload]);

  // Seamless URL sync & pipeline polling once backend creates video ID
  useEffect(() => {
    if (!activeUpload?.videoId) return;

    // Silently update browser URL without re-mounting or jumping pages
    if (typeof window !== 'undefined' && window.location.pathname.includes('/videos/uploading')) {
      window.history.replaceState(null, '', `/videos/${activeUpload.videoId}`);
    }

    const pollVideoData = async () => {
      try {
        const vid = await api.getVideo(activeUpload.videoId!);
        setVideo(vid);
        const evts = await api.getVideoEvents(activeUpload.videoId!);
        setEvents(evts);
        const status = await api.getPipelineStatus(activeUpload.videoId!);
        if (status?.jobs) setJobs(status.jobs);
      } catch {
        // Continue polling
      }
    };

    pollVideoData();
    const interval = setInterval(pollVideoData, 1500);
    return () => clearInterval(interval);
  }, [activeUpload?.videoId]);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      if (activeUpload?.videoId) {
        await api.cancelPipeline(activeUpload.videoId).catch(() => {});
      }
      cancelUpload();
      toast.warning('Video upload was cancelled.', {
        title: 'Upload Cancelled',
        duration: 3000,
      });
    } finally {
      setCancelling(false);
    }
  };

  const [retrying, setRetrying] = useState(false);

  const handleRetryPipeline = async () => {
    const targetVideoId = video?.id || activeUpload?.videoId;
    if (!targetVideoId) {
      router.push('/upload');
      return;
    }
    setRetrying(true);
    try {
      await api.triggerPipeline(targetVideoId, undefined, activeUpload?.enableChunking ?? true, 'resume');
      toast.success('Pipeline analysis resumed from checkpoint!', {
        title: 'Resumed Analysis',
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to resume pipeline');
    } finally {
      setRetrying(false);
    }
  };

  const handleCopyError = (msg: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(msg);
      toast.info('Error log copied to clipboard', {
        title: 'Copied',
        duration: 2000,
      });
    }
  };

  const formatTimer = (sec: number) => {
    if (!sec || isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatMB = (bytes: number) => {
    if (!bytes || bytes <= 0) return '0.0';
    return (bytes / (1024 * 1024)).toFixed(1);
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (!bytesPerSec || bytesPerSec <= 0) return '0.0 MB/s';
    const mbps = bytesPerSec / (1024 * 1024);
    return `${mbps.toFixed(1)} MB/s`;
  };

  if (!activeUpload) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px 0' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
          <ArrowLeft size={16} />
          <span>{t('commonBackVideos')}</span>
        </Link>
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '36px',
          textAlign: 'center',
          color: 'var(--text-muted)',
        }}>
          <UploadCloud size={40} color="var(--accent)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
            {t('timelineNoEvents')}
          </h3>
          <p style={{ fontSize: '13px', marginBottom: '20px' }}>
            {t('uploadDesc')}
          </p>
          <Link href="/upload" className="btn btn-primary btn-sm">
            <span>{t('uploadNewLesson')}</span>
          </Link>
        </div>
      </div>
    );
  }

  const getStatusLabel = (status: string | undefined) => {
    if (!status) return t('statusPreparing');
    switch (status) {
      case 'uploaded':
        return t('statusPreparing');
      case 'chunking':
        return t('statusChunking');
      case 'extracting':
      case 'event_extraction':
        return t('statusExtracting');
      case 'merging':
      case 'event_merge':
        return t('statusMerging');
      case 'mapping':
        return t('statusMapping');
      case 'statistics':
      case 'report_generation':
        return t('statusStatistics');
      case 'report_generated':
        return t('statusCompleted');
      default:
        return status.replace('_', ' ');
    }
  };

  const isCancelled = activeUpload.status === 'cancelled' || video?.status === 'cancelled';
  const isError =
    activeUpload.status === 'error' ||
    activeUpload.status === 'failed' ||
    video?.status === 'error' ||
    video?.status === 'failed' ||
    jobs.some((j) => j.status === 'failed' || j.status === 'error');
  const isCompleted = video?.status === 'report_generated' || video?.status === 'completed';
  const isRunning = !isCompleted && !isError && !isCancelled;
  const isUploading = isRunning && activeUpload.status === 'uploading' && !video?.id;
  const isServerProcessing = isRunning && !isUploading;
  const isChunked = activeUpload.enableChunking;
  const currentStepOrder = isChunked ? chunkedStepOrder : fullVideoStepOrder;

  const failedStep =
    video?.failed_step ||
    jobs.find((j) => j.status === 'failed' || j.status === 'error')?.step ||
    (activeUpload.status === 'error' || activeUpload.status === 'failed' ? 'upload' : undefined);

  const errorMessage =
    activeUpload.errorMessage ||
    video?.error_msg ||
    jobs.find((j) => j.status === 'failed' || j.status === 'error')?.error_msg ||
    (isError ? 'An unexpected error occurred during video processing.' : '');

  // Calculate total completed duration across all finished jobs if available
  const completedJobs = jobs.filter((j) => j.status === 'completed' && j.started_at && j.finished_at);
  let totalCompletedDuration = elapsedSec;
  if (completedJobs.length > 0) {
    const minStart = Math.min(...completedJobs.map((j) => new Date(j.started_at!).getTime()));
    const maxFinish = Math.max(...completedJobs.map((j) => new Date(j.finished_at!).getTime()));
    if (maxFinish > minStart) {
      totalCompletedDuration = Math.round((maxFinish - minStart) / 1000);
    }
  }

  // Live stopwatch counter (only increments while running; freezes when complete, cancelled, or error)
  useEffect(() => {
    if (!activeUpload || !isRunning) return;
    const timer = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [activeUpload, isRunning]);

  const currentOverallStatus = isError
    ? 'failed'
    : isCancelled
    ? 'cancelled'
    : video?.status
    ? video.status
    : isServerProcessing
    ? 'extracting'
    : 'uploading';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Back Link */}
      <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px', fontWeight: 600 }}>
        <ArrowLeft size={16} />
        <span>{t('commonBackVideos')}</span>
      </Link>

      {/* Header Info */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              fontSize: '14px',
              color: 'var(--accent)',
              backgroundColor: 'var(--accent-soft)',
              padding: '2px 8px',
              borderRadius: '4px',
            }}>
              {activeUpload.teacherId}
            </span>
            <span
              className="badge"
              style={{
                backgroundColor: isError
                  ? '#FEE2E2'
                  : isCancelled
                  ? '#FEF3C7'
                  : isCompleted
                  ? '#DCFCE7'
                  : isServerProcessing || video?.status === 'extracting'
                  ? '#EFF6FF'
                  : '#FAF5EE',
                color: isError
                  ? '#DC2626'
                  : isCancelled
                  ? '#B45309'
                  : isCompleted
                  ? '#166534'
                  : isServerProcessing || video?.status === 'extracting'
                  ? '#2563EB'
                  : 'var(--accent)',
                border: `1px solid ${
                  isError
                    ? '#FECACA'
                    : isCancelled
                    ? '#FDE68A'
                    : isCompleted
                    ? '#86EFAC'
                    : isServerProcessing || video?.status === 'extracting'
                    ? '#BFDBFE'
                    : '#E8D9C8'
                }`,
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: isError
                  ? '#DC2626'
                  : isCancelled
                  ? '#B45309'
                  : isCompleted
                  ? '#16A34A'
                  : isServerProcessing || video?.status === 'extracting'
                  ? '#2563EB'
                  : 'var(--accent)',
              }} />
              {isError
                ? 'UPLOAD FAILED'
                : isCancelled
                ? 'UPLOAD CANCELLED'
                : isCompleted
                ? 'COMPLETED'
                : video?.status
                ? getStatusLabel(video.status).toUpperCase()
                : isServerProcessing
                ? t('liveProcessingBadge')
                : `${t('liveUploadingBadge')} (${activeUpload.percentage}%)`}
            </span>
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '34px',
            fontWeight: 400,
            color: 'var(--text-main)',
            lineHeight: 1.1,
          }}>
            {activeUpload.title}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          {isRunning && (
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="btn btn-sm"
              style={{
                backgroundColor: '#DC2626',
                color: '#FFFFFF',
                borderColor: '#B91C1C',
                padding: '6px 14px',
              }}
            >
              {cancelling ? <Loader2 size={13} className="animate-spin" /> : <Square size={13} fill="currentColor" />}
              <span>{cancelling ? t('commonStopping') : t('commonStop')}</span>
            </button>
          )}

          {isCompleted && (
            <Link href={`/reports/${video?.id || activeUpload.videoId}`} className="btn btn-primary btn-sm" style={{ padding: '7px 16px', fontWeight: 700, gap: '6px', display: 'inline-flex', alignItems: 'center' }}>
              <FileText size={15} />
              <span>{t('viewReport')}</span>
            </Link>
          )}

          {(isCancelled || isError) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {video?.id && (
                <button
                  onClick={handleRetryPipeline}
                  disabled={retrying}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                >
                  {retrying ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
                  <span>{retrying ? 'Retrying...' : 'Retry Pipeline'}</span>
                </button>
              )}
              <Link href="/upload" onClick={clearUpload} className="btn btn-secondary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={14} />
                <span>New Upload</span>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Error / Failure Banner Card */}
      {isError && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: 'var(--radius-md)',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 4px 14px rgba(220, 38, 38, 0.08)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#DC2626',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={20} />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#991B1B', margin: 0 }}>
                  Pipeline Execution Failed
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  {failedStep && (
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#FEE2E2',
                        color: '#B91C1C',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid #FCA5A5',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      Step: {failedStep}
                    </span>
                  )}
                  <span style={{ fontSize: '12px', color: '#7F1D1D' }}>
                    An error occurred while processing this stage.
                  </span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {errorMessage && (
                <button
                  onClick={() => handleCopyError(errorMessage)}
                  className="btn btn-sm btn-secondary"
                  style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: '#FFFFFF' }}
                  title="Copy technical error message"
                >
                  <Copy size={13} />
                  <span>Copy Log</span>
                </button>
              )}
              {video?.id && (
                <button
                  onClick={handleRetryPipeline}
                  disabled={retrying}
                  className="btn btn-sm btn-primary"
                  style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  {retrying ? <Loader2 size={13} className="animate-spin" /> : <RotateCcw size={13} />}
                  <span>{retrying ? 'Restarting...' : 'Retry Analysis'}</span>
                </button>
              )}
            </div>
          </div>

          {errorMessage && (
            <div
              style={{
                backgroundColor: '#1E293B',
                color: '#F87171',
                padding: '12px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                maxHeight: '120px',
                overflowY: 'auto',
                border: '1px solid #334155',
              }}
            >
              {errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Cancelled Banner Card */}
      {isCancelled && (
        <div
          style={{
            backgroundColor: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 'var(--radius-md)',
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '50%',
                backgroundColor: '#FEF3C7',
                border: '1px solid #FCD34D',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D97706',
              }}
            >
              <XCircle size={18} />
            </div>
            <div>
              <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#92400E', margin: 0 }}>
                Analysis Cancelled
              </h4>
              <span style={{ fontSize: '12px', color: '#B45309' }}>
                The pipeline execution was stopped by user request.
              </span>
            </div>
          </div>

          <Link href="/upload" onClick={clearUpload} className="btn btn-primary btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={13} />
            <span>Upload Another Video</span>
          </Link>
        </div>
      )}

      {/* Live Real-Time Analysis Console with In-Place Upload Telemetry */}
      {!isError && !isCancelled && (
        <div
          style={{
            backgroundColor: isCompleted ? '#F0FDF4' : '#F0FDF4',
            border: `1px solid ${isCompleted ? '#86EFAC' : '#BBF7D0'}`,
            borderRadius: 'var(--radius-md)',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: isCompleted ? '0 4px 14px rgba(34, 197, 94, 0.08)' : '0 4px 14px rgba(34, 197, 94, 0.12)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top progress bar: Animated while running, solid green when complete */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: '#DCFCE7',
            overflow: 'hidden',
          }}>
            {isCompleted ? (
              <div style={{ width: '100%', height: '100%', backgroundColor: '#16A34A' }} />
            ) : (
              <div style={{
                width: '50%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, #16A34A, #4ADE80, transparent)',
                animation: 'flowingBar 1.8s ease-in-out infinite',
              }} />
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  color: 'var(--accent-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {isCompleted ? (
                  <CheckCircle2 size={20} color="#16A34A" />
                ) : (
                  <Loader2 size={18} className="animate-spin" />
                )}
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>
                  {isCompleted ? 'Classroom Analysis Complete 🎉' : t('liveProgressTitle')}
                </h4>
                <p style={{ fontSize: '12px', color: '#15803D' }}>
                  {isCompleted
                    ? 'All observation events extracted, deduplicated, mapped to rubric, and report generated.'
                    : isUploading
                    ? `${t('status')}: ${t('liveUploadingBadge')} (${activeUpload.percentage}%) • ${t('liveProgressDesc')}`
                    : isServerProcessing && !video?.status
                    ? `${t('status')}: ${t('statusPreparing')} • ${t('liveProgressDesc')}`
                    : `${t('status')}: ${getStatusLabel(video?.status)} • ${t('liveProgressDesc')}`}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Stopwatch Display */}
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#166534',
                  backgroundColor: '#DCFCE7',
                  border: '1px solid #86EFAC',
                  padding: '4px 12px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: '#16A34A',
                  boxShadow: isCompleted ? 'none' : '0 0 0 3px rgba(22, 163, 74, 0.25)',
                }} />
                <Timer size={13} color="#166534" strokeWidth={2.2} />
                <span>
                  {isCompleted ? t('pipelineTotalDuration') : t('pipelineRunningTime')}:{' '}
                  <strong>{formatTimer(isCompleted ? totalCompletedDuration : elapsedSec)}</strong>
                </span>
                {isCompleted && (
                  <span style={{
                    backgroundColor: '#16A34A',
                    color: '#FFFFFF',
                    fontSize: '9.5px',
                    padding: '1px 6px',
                    borderRadius: '4px',
                    fontWeight: 700,
                    letterSpacing: '0.5px',
                  }}>
                    COMPLETED
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Unified Step Sequence with Live In-Place Upload in Step 1 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentStepOrder.map((stepItem, index) => {
              const isUploadStep = stepItem.key === 'upload';
              const jobForStep = jobs.find(
                (j) => j.step === stepItem.key || (stepItem.altKey && j.step === stepItem.altKey)
              );

              // Upload Step Status
              const isUploadDone = isUploadStep && (isServerProcessing || isCompleted || Boolean(video?.id));
              const isUploadActive = isUploadStep && !isUploadDone && isUploading;

              // Pipeline Steps Status
              const isStepDone = isCompleted || (isUploadStep ? isUploadDone : jobForStep?.status === 'completed');

              // If video is uploaded and we are at step 2, show active loading state
              const isStartingStep2 = isRunning && (video?.status === 'uploaded' || isServerProcessing) && index === 1 && !isStepDone;

              const isStepActive = !isCompleted && (
                isUploadStep
                  ? isUploadActive
                  : jobForStep?.status === 'running' ||
                    video?.status === stepItem.key ||
                    (stepItem.altKey && video?.status === stepItem.altKey) ||
                    isStartingStep2
              );

              return (
                <div
                  key={stepItem.key}
                  style={{
                    backgroundColor: isCompleted ? '#FFFFFF' : isStepActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)',
                    border: `1px solid ${isCompleted ? '#BBF7D0' : isStepActive ? '#86EFAC' : '#E5E7EB'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px 16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: isUploadActive ? '10px' : '0',
                    boxShadow: isStepActive ? '0 2px 8px rgba(34, 197, 94, 0.1)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {isStepDone ? (
                        <CheckCircle2 size={18} color="var(--accent-green)" />
                      ) : isStepActive ? (
                        <div
                          style={{
                            width: '24px',
                            height: '24px',
                            borderRadius: '50%',
                            backgroundColor: '#DCFCE7',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Loader2 size={15} className="animate-spin" color="#166534" />
                        </div>
                      ) : (
                        <Clock size={16} color="#9CA3AF" />
                      )}
                      <div>
                        <span style={{ fontSize: '13px', fontWeight: isStepActive || isCompleted ? 700 : 600, color: isStepActive || isCompleted ? '#166534' : 'var(--text-main)' }}>
                          {t(stepItem.nameKey)}
                        </span>
                        <span style={{ display: 'block', fontSize: '11px', color: isStepActive || isCompleted ? '#15803D' : 'var(--text-muted)' }}>
                          {t(stepItem.descKey)}
                        </span>
                      </div>
                    </div>

                    <div>
                      {isStepDone ? (
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)', fontFamily: 'var(--font-mono)' }}>
                          ✓ {t('commonDone')}
                        </span>
                      ) : isStepActive ? (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#166534',
                            backgroundColor: '#DCFCE7',
                            border: '1px solid #86EFAC',
                            padding: '3px 10px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          <Loader2 size={11} className="animate-spin" />
                          {isUploadStep ? `${activeUpload.percentage}%` : `${t('commonInProgress')}...`}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>{t('commonQueued')}</span>
                      )}
                    </div>
                  </div>

                  {/* Embedded Live Upload Telemetry inside Step 1 */}
                  {isUploadStep && isUploadActive && (
                    <div style={{
                      backgroundColor: '#F7F5F0',
                      borderRadius: '6px',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      marginTop: '4px',
                      border: '1px solid #EFEBE4',
                    }}>
                      <div style={{
                        height: '6px',
                        backgroundColor: '#E8E2D8',
                        borderRadius: '999px',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%',
                          width: `${activeUpload.percentage}%`,
                          background: 'linear-gradient(90deg, #16A34A, #22C55E)',
                          borderRadius: '999px',
                          transition: 'width 0.2s ease',
                        }} />
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                        fontWeight: 500,
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <HardDrive size={12} color="var(--accent)" />
                          <span><strong>{formatMB(activeUpload.loadedBytes)} MB</strong> / {formatMB(activeUpload.totalBytes)} MB</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={12} color="var(--accent)" />
                          <span><strong>{formatSpeed(activeUpload.speedBytesPerSec)}</strong></span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Timer size={12} color="var(--accent)" />
                          <span>{t('liveUploadRemaining')}: <strong>~{activeUpload.etaSeconds > 0 ? `${activeUpload.etaSeconds}s` : '...'}</strong></span>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Completion Action Banner */}
          {isCompleted && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 18px',
              backgroundColor: '#FFFFFF',
              border: '1px solid #86EFAC',
              borderRadius: 'var(--radius-sm)',
              marginTop: '6px',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <h5 style={{ fontSize: '13px', fontWeight: 700, color: '#166534', marginBottom: '2px' }}>
                  Research Report Ready
                </h5>
                <p style={{ fontSize: '11.5px', color: '#15803D', margin: 0 }}>
                  {events.length} pedagogical events extracted and rubric checklist statistics computed.
                </p>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link
                  href={`/reports/${video?.id || activeUpload.videoId}`}
                  className="btn btn-primary btn-sm"
                  style={{ gap: '6px', display: 'inline-flex', alignItems: 'center', fontWeight: 700 }}
                >
                  <FileText size={14} />
                  <span>{t('viewReport')}</span>
                </Link>
                <Link
                  href="/"
                  onClick={clearUpload}
                  className="btn btn-secondary btn-sm"
                >
                  <span>{t('commonBackVideos')}</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stepper Card */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700 }}>
            {t('analysisProgress')}
          </h3>
          <span style={{
            fontSize: '12px',
            color: isCancelled ? '#B45309' : isError ? '#DC2626' : isCompleted ? '#166534' : 'var(--accent)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {isRunning && <Loader2 size={12} className="animate-spin" />}
            {isCompleted && <Check size={14} strokeWidth={3} color="#16A34A" />}
            {isCancelled
              ? 'Cancelled'
              : isError
              ? 'Failed'
              : isCompleted
              ? 'COMPLETED'
              : isServerProcessing
              ? t('liveProcessingBadge')
              : `${t('liveUploadingBadge')} (${activeUpload.percentage}%)`}
          </span>
        </div>
        <PipelineStepper
          status={currentOverallStatus as any}
          failedStep={failedStep}
          jobs={jobs}
          isChunked={activeUpload.enableChunking}
          uploadPercentage={isCancelled || isError ? undefined : activeUpload.percentage}
        />
      </div>

      {/* Extracted Events Timeline */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
            {t('timelineTitle')}
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {events.length} {t('eventsCount')}
          </span>
        </div>

        {events.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isRunning ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', backgroundColor: '#FAF8F4', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
                  <Loader2 size={16} className="animate-spin" color="var(--accent)" />
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('waitingEventsStream')}
                  </span>
                </div>
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="animate-shimmer"
                    style={{
                      height: '68px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--card-border)',
                    }}
                  />
                ))}
              </>
            ) : (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px', backgroundColor: '#FAF8F4', borderRadius: 'var(--radius-sm)' }}>
                No pedagogical events detected for this recording.
              </div>
            )}
          </div>
        ) : (
          <EventTimeline events={events} />
        )}
      </div>
    </div>
  );
}
