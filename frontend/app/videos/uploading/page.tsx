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

  const isCancelled = activeUpload.status === 'cancelled';
  const isError = activeUpload.status === 'error';
  const isServerProcessing = activeUpload.status === 'server_processing' || activeUpload.status === 'pipeline_started';
  const isUploading = activeUpload.status === 'uploading';
  const isChunked = activeUpload.enableChunking;
  const currentStepOrder = isChunked ? chunkedStepOrder : fullVideoStepOrder;

  const currentOverallStatus = isError
    ? 'error'
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
                  : isServerProcessing || video?.status === 'extracting'
                  ? '#EFF6FF'
                  : '#FAF5EE',
                color: isError
                  ? '#DC2626'
                  : isCancelled
                  ? '#B45309'
                  : isServerProcessing || video?.status === 'extracting'
                  ? '#2563EB'
                  : 'var(--accent)',
                border: `1px solid ${
                  isError
                    ? '#FECACA'
                    : isCancelled
                    ? '#FDE68A'
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
                  : isServerProcessing || video?.status === 'extracting'
                  ? '#2563EB'
                  : 'var(--accent)',
              }} />
              {isError
                ? 'UPLOAD FAILED'
                : isCancelled
                ? 'UPLOAD CANCELLED'
                : video?.status === 'report_generated'
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

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {(isUploading || isServerProcessing || (video && video.status !== 'report_generated' && video.status !== 'error')) && (
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

          {video?.status === 'report_generated' && (
            <Link href={`/reports/${video.id}`} className="btn btn-primary btn-sm">
              <FileText size={14} />
              <span>{t('viewReport')}</span>
            </Link>
          )}

          {(isCancelled || isError) && (
            <Link href="/upload" onClick={clearUpload} className="btn btn-primary btn-sm">
              <RefreshCw size={14} />
              <span>{t('btnRetryNow')}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Live Real-Time Analysis Console with In-Place Upload Telemetry */}
      {!isError && !isCancelled && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #BBF7D0',
            borderRadius: 'var(--radius-md)',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.12)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Top animated flowing gradient bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '3px',
            backgroundColor: '#DCFCE7',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '50%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, #16A34A, #4ADE80, transparent)',
              animation: 'flowingBar 1.8s ease-in-out infinite',
            }} />
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
                <Loader2 size={18} className="animate-spin" />
              </div>
              <div>
                <h4 style={{ fontSize: '15px', fontWeight: 700, color: '#166534' }}>
                  {t('liveProgressTitle')}
                </h4>
                <p style={{ fontSize: '12px', color: '#15803D' }}>
                  {isUploading
                    ? `${t('status')}: ${t('liveUploadingBadge')} (${activeUpload.percentage}%) • ${t('liveProgressDesc')}`
                    : isServerProcessing && !video?.status
                    ? `${t('status')}: ${t('statusPreparing')} • ${t('liveProgressDesc')}`
                    : `${t('status')}: ${getStatusLabel(video?.status)} • ${t('liveProgressDesc')}`}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Live Running Stopwatch */}
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
                  boxShadow: '0 0 0 3px rgba(22, 163, 74, 0.25)',
                }} />
                <Timer size={13} color="#166534" strokeWidth={2.2} />
                <span>{t('pipelineRunningTime')}: <strong>{formatTimer(elapsedSec)}</strong></span>
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
              const isUploadDone = isUploadStep && (isServerProcessing || Boolean(video?.id));
              const isUploadActive = isUploadStep && !isUploadDone;

              // Pipeline Steps Status
              const isStepDone = isUploadStep ? isUploadDone : jobForStep?.status === 'completed';

              // If video is uploaded and we are at step 2, show active loading state
              const isStartingStep2 = (video?.status === 'uploaded' || isServerProcessing) && index === 1 && !isStepDone;

              const isStepActive = isUploadStep
                ? isUploadActive
                : jobForStep?.status === 'running' ||
                  video?.status === stepItem.key ||
                  (stepItem.altKey && video?.status === stepItem.altKey) ||
                  isStartingStep2;

              return (
                <div
                  key={stepItem.key}
                  style={{
                    backgroundColor: isStepActive ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)',
                    border: `1px solid ${isStepActive ? '#86EFAC' : '#E5E7EB'}`,
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
                        <span style={{ fontSize: '13px', fontWeight: isStepActive ? 700 : 600, color: isStepActive ? '#166534' : 'var(--text-main)' }}>
                          {t(stepItem.nameKey)}
                        </span>
                        <span style={{ display: 'block', fontSize: '11px', color: isStepActive ? '#15803D' : 'var(--text-muted)' }}>
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
          <span style={{ fontSize: '12px', color: isCancelled ? '#B45309' : isError ? '#DC2626' : 'var(--accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!isCancelled && !isError && <Loader2 size={12} className="animate-spin" />}
            {isCancelled
              ? 'Cancelled'
              : isError
              ? 'Failed'
              : isServerProcessing
              ? t('liveProcessingBadge')
              : `${t('liveUploadingBadge')} (${activeUpload.percentage}%)`}
          </span>
        </div>
        <PipelineStepper
          status={currentOverallStatus as any}
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
          </div>
        ) : (
          <EventTimeline events={events} />
        )}
      </div>
    </div>
  );
}
