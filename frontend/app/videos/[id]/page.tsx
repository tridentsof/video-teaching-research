'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Video, RawEvent, PipelineJob, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { useUpload } from '@/lib/uploadContext';
import { PipelineStepper } from '@/components/PipelineStepper';
import { EventTimeline } from '@/components/EventTimeline';
import {
  ArrowLeft,
  FileText,
  Play,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Terminal,
  Loader2,
  CheckCircle2,
  Clock,
  Square,
  Sparkles,
  Film,
  Scissors,
  Check,
  Timer,
  HardDrive,
  Zap,
} from 'lucide-react';

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

export default function VideoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const { activeUpload } = useUpload();

  const [video, setVideo] = useState<Video | null>(null);
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rerunChunking, setRerunChunking] = useState(false);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const [showTechnicalLog, setShowTechnicalLog] = useState(false);

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [nowTimestamp, setNowTimestamp] = useState<number>(Date.now());

  const modeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(e.target as Node)) {
        setModeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatTimer = (sec: number) => {
    if (!sec || isNaN(sec) || sec < 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const formatDuration = (sec: number) => {
    if (!sec || isNaN(sec) || sec <= 0) return '0s';
    if (sec < 60) return `${sec < 10 ? sec.toFixed(1) : Math.round(sec)}s`;
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  };

  const loadData = async (silent = false) => {
    if (!id) return;
    try {
      if (!silent) setLoading(true);
      const vid = await api.getVideo(id);
      setVideo(vid);

      const evts = await api.getVideoEvents(id);
      setEvents(evts);

      // Fetch pipeline jobs telemetry
      try {
        const pipelineStatus = await api.getPipelineStatus(id);
        if (pipelineStatus && pipelineStatus.jobs) {
          setJobs(pipelineStatus.jobs);
        }
      } catch {
        // Continue
      }
    } catch (err: any) {
      if (!silent) {
        setVideo(null);
        setEvents([]);
        setJobs([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const isRunning =
    retrying ||
    ['chunking', 'extracting', 'merging', 'mapping', 'statistics'].includes(video?.status || '');

  // Find the earliest job started_at or current run time
  const earliestJobStartedAt = jobs
    .filter((j) => j.started_at)
    .map((j) => new Date(j.started_at!).getTime())
    .sort((a, b) => a - b)[0];

  // Live timer tick every 1s when running
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      const now = Date.now();
      setNowTimestamp(now);
      if (earliestJobStartedAt) {
        setElapsedSec(Math.max(0, Math.round((now - earliestJobStartedAt) / 1000)));
      } else {
        setElapsedSec((prev) => prev + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, earliestJobStartedAt]);

  // Calculate total completed duration across all finished jobs
  const completedJobs = jobs.filter((j) => j.status === 'completed' && j.started_at && j.finished_at);
  let totalCompletedDuration = 0;
  if (completedJobs.length > 0) {
    const minStart = Math.min(...completedJobs.map((j) => new Date(j.started_at!).getTime()));
    const maxFinish = Math.max(...completedJobs.map((j) => new Date(j.finished_at!).getTime()));
    if (maxFinish > minStart) {
      totalCompletedDuration = (maxFinish - minStart) / 1000;
    }
  }

  // Determine if this analysis used 10-min chunking or direct full video
  const isChunkedMode = jobs.some((j) => j.step === 'chunking') || (jobs.length === 0 && rerunChunking);
  const currentStepOrder = isChunkedMode ? chunkedStepOrder : fullVideoStepOrder;

  // Poll every 1.5s when active, 6s when idle
  useEffect(() => {
    loadData();
    const intervalMs = isRunning ? 1500 : 6000;
    const interval = setInterval(() => loadData(true), intervalMs);
    return () => clearInterval(interval);
  }, [id, isRunning]);

  const handleRerun = async () => {
    if (!id) return;
    try {
      setRetrying(true);
      setElapsedSec(0);
      await api.triggerPipeline(id, undefined, rerunChunking);
      toast.info(`Analysis started for "${video?.title || id}" (${rerunChunking ? '10-min segments' : 'Full video'}).`, {
        title: 'Analysis Started',
      });
      // Force instant data reload
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to restart analysis: ${err.message}`, {
        title: 'Analysis Error',
      });
      setRetrying(false);
    }
  };

  const handleCancelPipeline = async () => {
    if (!id) return;
    try {
      setCancelling(true);
      await api.cancelPipeline(id);
      toast.warning(`Analysis stopped for "${video?.title || id}".`, {
        title: 'Analysis Stopped',
      });
      setRetrying(false);
      await loadData(true);
    } catch (err: any) {
      toast.error(`Failed to cancel analysis: ${err.message}`, {
        title: 'Cancellation Error',
      });
    } finally {
      setCancelling(false);
    }
  };

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

  // State checks
  const isVideoFailed = video?.status === 'error' && !retrying;
  const failedJob = isVideoFailed ? jobs.find((j) => j.status === 'error') || null : null;
  const failedStepName = failedJob?.step || (isVideoFailed ? (isChunkedMode ? 'chunking' : 'event_extraction') : undefined);

  if (!video && loading) {
    return (
      <div style={{ padding: '40px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Loader2 size={18} className="animate-spin" />
        <span>Loading video and analysis progress...</span>
      </div>
    );
  }

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
              {video?.teacher_id}
            </span>
            <span
              className={isVideoFailed ? 'badge' : 'badge badge-audio'}
              style={
                isVideoFailed
                  ? { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA' }
                  : isRunning
                  ? { backgroundColor: '#EFF6FF', color: '#2563EB', border: '1px solid #BFDBFE' }
                  : video?.status === 'cancelled'
                  ? { backgroundColor: '#FEF3C7', color: '#B45309', border: '1px solid #FDE68A' }
                  : {}
              }
            >
              {isRunning ? t('commonInProgress') : video?.status.replace('_', ' ')}
            </span>

            {/* Completed Total Duration Badge */}
            {!isRunning && video?.status === 'report_generated' && totalCompletedDuration > 0 && (
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--accent)',
                backgroundColor: 'var(--accent-soft)',
                border: '1px solid #E8D9C8',
                padding: '2px 8px',
                borderRadius: '4px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}>
                <Timer size={13} color="var(--accent)" strokeWidth={2.2} />
                <span>{t('pipelineTotalDuration')}: <strong>{formatDuration(totalCompletedDuration)}</strong></span>
              </span>
            )}
          </div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '34px',
            fontWeight: 400,
            color: 'var(--text-main)',
            lineHeight: 1.1,
          }}>
            {video?.title}
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => loadData()} className="btn btn-secondary btn-sm">
            <RefreshCw size={14} className={loading || isRunning ? 'animate-spin' : ''} />
            <span>{t('commonRefresh')}</span>
          </button>

          {video?.status === 'report_generated' && (
            <Link href={`/reports/${video.id}`} className="btn btn-primary btn-sm">
              <FileText size={14} />
              <span>{t('viewReport')}</span>
            </Link>
          )}

          {isRunning && (
            <button
              onClick={handleCancelPipeline}
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

          {!isRunning && (
            <div ref={modeDropdownRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setModeDropdownOpen((prev) => !prev)}
                className="btn btn-secondary btn-sm"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--card-border)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s ease',
                }}
              >
                {!rerunChunking ? (
                  <Film size={14} color="var(--accent)" />
                ) : (
                  <Scissors size={14} color="#736B63" />
                )}
                <span>{!rerunChunking ? t('modeOptFull') : t('modeOptSplit')}</span>
                <ChevronDown
                  size={13}
                  color="var(--text-muted)"
                  style={{
                    transform: modeDropdownOpen ? 'rotate(180deg)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
              </button>

              {modeDropdownOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: '240px',
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    boxShadow: 'var(--shadow-md)',
                    padding: '6px',
                    zIndex: 50,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    animation: 'fadeIn 0.15s ease-out',
                  }}
                >
                  {/* Option 1: Full Video */}
                  <div
                    onClick={() => {
                      setRerunChunking(false);
                      setModeDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: !rerunChunking ? '#FAF5EE' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (rerunChunking) e.currentTarget.style.backgroundColor = '#FAF8F4';
                    }}
                    onMouseLeave={(e) => {
                      if (rerunChunking) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: !rerunChunking ? 'var(--accent-soft)' : '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Film size={13} color={!rerunChunking ? 'var(--accent)' : '#6B7280'} />
                      </div>
                      <div>
                        <span style={{ fontSize: '12px', fontWeight: 600, color: !rerunChunking ? 'var(--accent)' : 'var(--text-main)', display: 'block' }}>
                          {t('modeOptFull')}
                        </span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Direct continuous analysis
                        </span>
                      </div>
                    </div>
                    {!rerunChunking && <Check size={14} color="var(--accent)" strokeWidth={2.5} />}
                  </div>

                  {/* Option 2: 10-Minute Segments */}
                  <div
                    onClick={() => {
                      setRerunChunking(true);
                      setModeDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      backgroundColor: rerunChunking ? '#FAF5EE' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!rerunChunking) e.currentTarget.style.backgroundColor = '#FAF8F4';
                    }}
                    onMouseLeave={(e) => {
                      if (!rerunChunking) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: rerunChunking ? 'var(--accent-soft)' : '#F3F4F6',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Scissors size={13} color={rerunChunking ? 'var(--accent)' : '#6B7280'} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: rerunChunking ? 'var(--accent)' : 'var(--text-main)' }}>
                            {t('modeOptSplit')}
                          </span>
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 4px', borderRadius: '3px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                            Preview
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          10m parts with overlap
                        </span>
                      </div>
                    </div>
                    {rerunChunking && <Check size={14} color="var(--accent)" strokeWidth={2.5} />}
                  </div>
                </div>
              )}
            </div>
          )}

          <button onClick={handleRerun} disabled={retrying || isRunning} className="btn btn-primary btn-sm">
            {retrying || isRunning ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{retrying || isRunning ? t('commonInProgress') : t('rerunPipeline')}</span>
          </button>
        </div>
      </div>

      {/* Live Analysis Console (Visible when running) */}
      {isRunning && (
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
            animation: 'fadeIn 0.25s ease-out',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Flowing animated gradient progress bar on top */}
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
                className="animate-pulse-green"
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
                  {t('status')}: <strong>{getStatusLabel(video?.status)}</strong> • {t('liveProgressDesc')}
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

              <button
                onClick={handleCancelPipeline}
                disabled={cancelling}
                style={{
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  color: '#DC2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '5px 12px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} fill="currentColor" />}
                <span>{cancelling ? t('commonStopping') : t('commonStop')}</span>
              </button>
            </div>
          </div>

          {/* Step Timeline Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {currentStepOrder.map((stepItem, stepIndex) => {
              const isUploadStep = stepItem.key === 'upload';
              const isUploadActive = isUploadStep && activeUpload?.videoId === id && activeUpload?.status === 'uploading';

              const jobForStep = jobs.find(
                (j) => j.step === stepItem.key || (stepItem.altKey && j.step === stepItem.altKey)
              );
              const isStepDone = video?.status === 'report_generated' || (isUploadStep
                ? (jobForStep?.status === 'completed' || (!isUploadActive && Boolean(video?.id)))
                : jobForStep?.status === 'completed');

              // If video is uploaded and we are at step 2, show active loading state
              const isStartingStep2 = isRunning && (video?.status === 'uploaded' || retrying) && stepIndex === 1 && !isStepDone;

              const isStepActive = isRunning && (isUploadStep
                ? isUploadActive
                : jobForStep?.status === 'running' ||
                  video?.status === stepItem.key ||
                  (stepItem.altKey && video?.status === stepItem.altKey) ||
                  isStartingStep2);

              let stepDurationStr = '';
              if (jobForStep && isStepDone && jobForStep.started_at && jobForStep.finished_at) {
                const durSec = (new Date(jobForStep.finished_at).getTime() - new Date(jobForStep.started_at).getTime()) / 1000;
                if (durSec > 0) stepDurationStr = formatDuration(durSec);
              } else if (jobForStep && isStepActive && jobForStep.started_at) {
                const durSec = (nowTimestamp - new Date(jobForStep.started_at).getTime()) / 1000;
                if (durSec > 0) stepDurationStr = formatTimer(Math.max(0, durSec));
              }

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
                          ✓ {t('commonDone')}{stepDurationStr ? ` (${stepDurationStr})` : ''}
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
                          {isUploadActive
                            ? `${activeUpload.percentage}%`
                            : stepDurationStr
                            ? `${t('liveProcessingDuration')} (${stepDurationStr})`
                            : `${t('commonInProgress')}...`}
                        </span>
                      ) : (
                        <span style={{ fontSize: '11px', color: '#9CA3AF', fontWeight: 500 }}>{t('commonQueued')}</span>
                      )}
                    </div>
                  </div>

                  {/* Embedded Live Upload Telemetry inside Step 1 */}
                  {isUploadActive && activeUpload && (
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
                          <span><strong>{((activeUpload.loadedBytes || 0) / (1024 * 1024)).toFixed(1)} MB</strong> / {((activeUpload.totalBytes || 0) / (1024 * 1024)).toFixed(1)} MB</span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Zap size={12} color="var(--accent)" />
                          <span><strong>{((activeUpload.speedBytesPerSec || 0) / (1024 * 1024)).toFixed(1)} MB/s</strong></span>
                        </span>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Timer size={12} color="var(--accent)" />
                          <span>Còn lại: <strong>~{activeUpload.etaSeconds > 0 ? `${activeUpload.etaSeconds}s` : '...'}</strong></span>
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

      {/* Error Alert Card (Visible when video status is error) */}
      {isVideoFailed && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 'var(--radius-md)',
            padding: '22px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  border: '1px solid #FCA5A5',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#991B1B' }}>
                  {t('interruptedTitle')} {failedStepName || 'Execution'}
                </h4>
                <p style={{ fontSize: '13px', color: '#7F1D1D', marginTop: '4px' }}>
                  {t('interruptedDesc')}
                </p>
              </div>
            </div>

            <button
              onClick={handleRerun}
              disabled={retrying}
              className="btn btn-primary btn-sm"
              style={{
                backgroundColor: '#DC2626',
                borderColor: '#B91C1C',
                color: '#FFFFFF',
                padding: '8px 16px',
              }}
            >
              {retrying ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              <span>{t('btnRetryNow')}</span>
            </button>
          </div>

          {/* Error Message Snippet */}
          {failedJob?.error_msg && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <button
                onClick={() => setShowTechnicalLog(!showTechnicalLog)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'none',
                  border: 'none',
                  color: '#991B1B',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: 0,
                  alignSelf: 'flex-start',
                }}
              >
                <Terminal size={14} />
                <span>{showTechnicalLog ? t('btnHideTechLog') : t('btnViewTechLog')}</span>
                {showTechnicalLog ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {showTechnicalLog && (
                <div
                  style={{
                    backgroundColor: '#1E1E1E',
                    color: '#F87171',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    lineHeight: '1.5',
                    overflowX: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    maxHeight: '260px',
                    overflowY: 'auto',
                    border: '1px solid #374151',
                  }}
                >
                  {failedJob.error_msg}
                </div>
              )}
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
          {failedStepName && isVideoFailed && (
            <span style={{ fontSize: '12px', color: '#DC2626', fontWeight: 600 }}>
              {t('haltedAtStep')} {failedStepName}
            </span>
          )}
          {isRunning && (
            <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Loader2 size={12} className="animate-spin" /> {t('commonInProgress')}
            </span>
          )}
        </div>
        <PipelineStepper
          status={video?.status || 'uploaded'}
          failedStep={failedStepName}
          isChunked={isChunkedMode}
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

        {isRunning && events.length === 0 ? (
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
