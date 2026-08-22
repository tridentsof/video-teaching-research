'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Video, api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useTranslation } from '@/lib/i18n';
import {
  Bell,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  Play,
  ArrowRight,
  RefreshCw,
  X,
  Clock,
} from 'lucide-react';

export const PipelineNotificationCenter: React.FC = () => {
  const router = useRouter();
  const toast = useToast();
  const { t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const prevStatusesRef = useRef<Record<string, string>>({});
  const initialLoadDone = useRef(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const fetchVideosAndCheckTransitions = async () => {
    try {
      const data = await api.getVideos();
      if (!Array.isArray(data)) return;

      setVideos(data);

      // Check for state transitions if initial load has finished
      if (initialLoadDone.current) {
        data.forEach((v) => {
          const oldStatus = prevStatusesRef.current[v.id];
          if (oldStatus && oldStatus !== v.status) {
            if (v.status === 'error') {
              toast.error(
                `Analysis for lesson "${v.title || v.teacher_id}" was interrupted.`,
                {
                  title: `Analysis Interrupted (${v.teacher_id})`,
                  duration: 8000,
                  action: {
                    label: 'Review & Retry →',
                    onClick: () => router.push(`/videos/${v.id}`),
                  },
                }
              );
            } else if (v.status === 'report_generated') {
              toast.success(
                `Classroom analysis report for "${v.title || v.teacher_id}" is ready.`,
                {
                  title: `Analysis Ready (${v.teacher_id})`,
                  duration: 6000,
                  action: {
                    label: 'View Report →',
                    onClick: () => router.push(`/reports/${v.id}`),
                  },
                }
              );
            }
          }
        });
      }

      // Update ref map
      const newMap: Record<string, string> = {};
      data.forEach((v) => {
        newMap[v.id] = v.status;
      });
      prevStatusesRef.current = newMap;
      initialLoadDone.current = true;
    } catch {
      // Ignore polling errors silently
    }
  };

  useEffect(() => {
    fetchVideosAndCheckTransitions();
    const interval = setInterval(fetchVideosAndCheckTransitions, 8000);
    return () => clearInterval(interval);
  }, []);

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const failedVideos = videos.filter((v) => v.status === 'error');
  const runningVideos = videos.filter((v) =>
    ['chunking', 'extracting', 'merging', 'mapping', 'statistics'].includes(v.status)
  );

  const totalBadges = failedVideos.length + runningVideos.length;

  const handleRetry = async (e: React.MouseEvent, videoId: string, title: string) => {
    e.stopPropagation();
    try {
      setRetryingId(videoId);
      await api.triggerPipeline(videoId);
      toast.info(`Analysis restarted for "${title}".`, {
        title: 'Analysis Restarted',
      });
      await fetchVideosAndCheckTransitions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to restart analysis', { title: 'Restart Error' });
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancel = async (e: React.MouseEvent, videoId: string, title: string) => {
    e.stopPropagation();
    try {
      await api.cancelPipeline(videoId);
      toast.warning(`Analysis stopped for "${title}".`, {
        title: 'Analysis Stopped',
      });
      await fetchVideosAndCheckTransitions();
    } catch (err: any) {
      toast.error(err.message || 'Failed to stop analysis', { title: 'Stop Error' });
    }
  };

  const manualRefresh = async () => {
    setLoading(true);
    await fetchVideosAndCheckTransitions();
    setLoading(false);
  };

  return (
    <div style={{ position: 'relative' }} ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 14px',
          backgroundColor: isOpen ? 'var(--card-bg)' : '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          boxShadow: 'var(--shadow-sm)',
          color: failedVideos.length > 0 ? '#DC2626' : 'var(--text-main)',
          fontWeight: 600,
          fontSize: '13px',
          transition: 'all 0.15s ease',
        }}
        title="Video Analysis Activity"
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Bell size={16} />
          {failedVideos.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                width: '8px',
                height: '8px',
                backgroundColor: '#DC2626',
                borderRadius: '50%',
                border: '2px solid #FFFFFF',
              }}
            />
          )}
        </div>
        <span>{t('actCenterTitle').split('&')[0].trim()}</span>

        {failedVideos.length > 0 ? (
          <span
            style={{
              backgroundColor: '#FEF2F2',
              color: '#DC2626',
              border: '1px solid #FECACA',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {failedVideos.length} {t('commonNeedsReview')}
          </span>
        ) : runningVideos.length > 0 ? (
          <span
            style={{
              backgroundColor: '#EFF6FF',
              color: '#2563EB',
              border: '1px solid #BFDBFE',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Loader2 size={10} className="animate-spin" />
            {runningVideos.length} {t('commonActive')}
          </span>
        ) : null}
      </button>

      {/* Popover Drawer */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '400px',
            maxWidth: '90vw',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-lg)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Popover Header */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#FAF8F4',
              borderBottom: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-main)' }}>
                {t('actCenterTitle')}
              </span>
              {totalBadges > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: failedVideos.length > 0 ? '#FEE2E2' : '#E0E7FF',
                    color: failedVideos.length > 0 ? '#991B1B' : '#3730A3',
                  }}
                >
                  {totalBadges}
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={manualRefresh}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
                title={t('commonRefresh')}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
                title={t('commonCancel')}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
            {/* Failed Items First */}
            {failedVideos.map((video) => (
              <div
                key={video.id}
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/videos/${video.id}`);
                }}
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--card-border)',
                  backgroundColor: '#FFFDF9',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFDF9')}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <AlertTriangle size={15} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#FEE2E2',
                        color: '#991B1B',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {video.teacher_id}
                    </span>
                    <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: 700 }}>
                      {t('commonNeedsReview')}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      marginTop: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {video.title || 'Untitled Lesson'}
                  </p>

                  <p style={{ fontSize: '12px', color: '#B91C1C', marginTop: '2px' }}>
                    {t('interruptedDesc')}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={(e) => handleRetry(e, video.id, video.title)}
                      disabled={retryingId === video.id}
                      className="btn btn-primary btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        backgroundColor: 'var(--accent)',
                        height: 'auto',
                      }}
                    >
                      {retryingId === video.id ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Play size={12} />
                      )}
                      <span>{retryingId === video.id ? t('commonRestarting') : t('retryAnalysis')}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        router.push(`/videos/${video.id}`);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
                    >
                      <span>{t('commonDetails')}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Running Items */}
            {runningVideos.map((video) => (
              <div
                key={video.id}
                onClick={() => {
                  setIsOpen(false);
                  router.push(`/videos/${video.id}`);
                }}
                style={{
                  padding: '14px 18px',
                  borderBottom: '1px solid var(--card-border)',
                  backgroundColor: '#FFFFFF',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                }}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#EFF6FF',
                    color: '#2563EB',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Loader2 size={15} className="animate-spin" />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {video.teacher_id}
                    </span>
                    <span style={{ fontSize: '11px', color: '#2563EB', fontWeight: 600 }}>
                      {video.status}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: 'var(--text-main)',
                      marginTop: '4px',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {video.title || 'Untitled Lesson'}
                  </p>

                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('waitingEventsStream')}
                  </p>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={(e) => handleCancel(e, video.id, video.title)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        color: '#DC2626',
                        borderColor: '#FECACA',
                        backgroundColor: '#FEF2F2',
                        height: 'auto',
                      }}
                    >
                      <span>{t('commonStop')}</span>
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(false);
                        router.push(`/videos/${video.id}`);
                      }}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11px', height: 'auto' }}
                    >
                      <span>{t('commonDetails')}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {/* Empty State */}
            {failedVideos.length === 0 && runningVideos.length === 0 && (
              <div
                style={{
                  padding: '36px 20px',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={28} color="var(--accent-green)" />
                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {t('actAllClear')}
                </p>
                <span style={{ fontSize: '12px' }}>
                  {t('actAllClearSub')}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '10px 18px',
              backgroundColor: '#FAF8F4',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '11px',
              color: 'var(--text-muted)',
            }}
          >
            <span>{t('actAutoUpdating')}</span>
            <span
              onClick={() => {
                setIsOpen(false);
                router.push('/');
              }}
              style={{ cursor: 'pointer', color: 'var(--accent)', fontWeight: 600 }}
            >
              {t('actAllVideos')}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
