'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useUpload } from '@/lib/uploadContext';
import {
  Play,
  FileText,
  ListOrdered,
  Plus,
  AlertCircle,
  Loader2,
  Timer,
  HardDrive,
  Zap,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

export default function VideoListPage() {
  const { t } = useTranslation();
  const { activeUpload } = useUpload();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.getVideos();
      setVideos(data);
      setError(null);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  // Check if there are any active running pipelines or an in-flight upload
  const isAnyRunning =
    Boolean(activeUpload && activeUpload.status !== 'cancelled' && activeUpload.status !== 'error') ||
    videos.some((v) =>
      ['chunking', 'extracting', 'merging', 'mapping', 'statistics'].includes(v.status)
    );

  // Auto-poll when any pipeline or upload is running
  useEffect(() => {
    if (!isAnyRunning) return;
    const timer = setInterval(() => {
      fetchVideos(true);
    }, 2500);
    return () => clearInterval(timer);
  }, [isAnyRunning]);

  const handleTrigger = async (id: string) => {
    try {
      await api.triggerPipeline(id);
      fetchVideos(true);
    } catch (err: any) {
      alert(`Failed to start pipeline: ${err.message}`);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'uploading':
        return t('liveUploadingBadge');
      case 'uploaded':
        return t('commonQueued');
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
      case 'generating_report':
      case 'report_generation':
        return t('statusStatistics');
      case 'report_generated':
      case 'completed':
        return t('statusCompleted');
      case 'failed':
      case 'error':
        return t('commonFailed');
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replace('_', ' ');
    }
  };

  const isVideoRunning = (status: string) => {
    return ['uploading', 'chunking', 'extracting', 'merging', 'mapping', 'statistics', 'generating_report'].includes(status);
  };

  // Find most relevant running video to show in the banner
  const runningVideo =
    videos.find((v) => isVideoRunning(v.status)) ||
    (activeUpload && activeUpload.videoId ? videos.find((v) => v.id === activeUpload.videoId) : null);

  const isUploadingOnly =
    activeUpload && (activeUpload.status === 'uploading' || activeUpload.status === 'server_processing');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--card-border)',
      }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '38px',
            fontWeight: 400,
            color: 'var(--text-main)',
            lineHeight: 1.1,
          }}>
            {t('dashboardTitle')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
            {t('dashboardDesc')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => fetchVideos(false)} className="btn btn-secondary btn-sm" title={t('commonRefresh')}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{t('commonRefresh')}</span>
          </button>
          <Link href="/upload" className="btn btn-primary">
            <Plus size={16} />
            <span>{t('uploadNewLesson')}</span>
          </Link>
        </div>
      </div>

      {/* Live Pipeline / Upload In-Progress Banner */}
      {(isUploadingOnly || runningVideo) && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
            boxShadow: '0 4px 14px rgba(34, 197, 94, 0.12)',
            animation: 'fadeIn 0.25s ease-out',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#DCFCE7',
                border: '1px solid #86EFAC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#16A34A',
                flexShrink: 0,
              }}
            >
              <Loader2 size={20} className="animate-spin" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#166534',
                  fontFamily: 'var(--font-mono)',
                  backgroundColor: '#DCFCE7',
                  padding: '1px 6px',
                  borderRadius: '3px',
                }}>
                  {activeUpload?.teacherId || runningVideo?.teacher_id || 'T01'}
                </span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#166534' }}>
                  {activeUpload?.title || runningVideo?.title}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#15803D',
                    backgroundColor: '#DCFCE7',
                    border: '1px solid #86EFAC',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#16A34A' }} />
                  {isUploadingOnly
                    ? `${t('liveUploadingBadge')} (${activeUpload?.percentage}%)`
                    : getStatusLabel(runningVideo?.status || 'uploaded').toUpperCase()}
                </span>
              </div>
              <p style={{ fontSize: '12px', color: '#15803D' }}>
                {t('bannerUploadRunningDesc')}
              </p>
            </div>
          </div>

          <Link
            href={
              activeUpload?.videoId
                ? `/videos/${activeUpload.videoId}`
                : runningVideo
                ? `/videos/${runningVideo.id}`
                : '/videos/uploading'
            }
            className="btn btn-primary btn-sm"
            style={{
              backgroundColor: '#16A34A',
              borderColor: '#15803D',
              whiteSpace: 'nowrap',
            }}
          >
            <span>{t('btnViewLiveProgress')}</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {/* Stats Highlights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '16px',
      }}>
        {[
          { label: t('statTotalLessons'), value: videos.length, badge: t('statTarget24') },
          { label: t('statObservedTeachers'), value: Array.from(new Set(videos.map((v) => v.teacher_id))).length || '12', badge: 'T01–T12' },
          { label: t('statChecklistCriteria'), value: '28 Items', badge: t('statSectionsAE') },
          { label: t('statTeachingThemes'), value: t('commonActive'), badge: t('statSynthesized') },
        ].map((stat, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '18px 20px',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</span>
            <div style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '28px',
              color: 'var(--accent)',
              margin: '6px 0 2px',
            }}>
              {stat.value}
            </div>
            <span className="badge badge-neutral">{stat.badge}</span>
          </div>
        ))}
      </div>

      {/* Video Repository Table */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
            {t('navVideos')}
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
            {videos.length} {t('videosInRepo')}
          </span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4EFE6', borderBottom: '2px solid var(--card-border)' }}>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>{t('teacher')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>{t('lessonTitle')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>{t('duration')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700 }}>{t('status')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700 }}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {/* In-flight uploading placeholder row if active and not yet saved in DB */}
            {isUploadingOnly && (!activeUpload?.videoId || !videos.some((v) => v.id === activeUpload.videoId)) && (
              <tr style={{ borderBottom: '1px solid var(--card-border)', backgroundColor: '#F0FDF4' }}>
                <td style={{ padding: '14px', fontWeight: 700, color: '#166534' }}>
                  {activeUpload.teacherId}
                </td>
                <td style={{ padding: '14px' }}>
                  <Link
                    href="/videos/uploading"
                    style={{ fontWeight: 600, color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Loader2 size={13} className="animate-spin" />
                    <span>{activeUpload.title}</span>
                  </Link>
                </td>
                <td style={{ padding: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  —
                </td>
                <td style={{ padding: '14px' }}>
                  <span
                    className="badge"
                    style={{
                      backgroundColor: '#DCFCE7',
                      color: '#166534',
                      border: '1px solid #86EFAC',
                      fontWeight: 700,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Loader2 size={11} className="animate-spin" />
                    {t('liveUploadingBadge')} ({activeUpload.percentage}%)
                  </span>
                </td>
                <td style={{ padding: '14px', textAlign: 'right' }}>
                  <Link href="/videos/uploading" className="btn btn-primary btn-sm" style={{ backgroundColor: '#16A34A' }}>
                    <span>{t('btnViewLiveProgress')}</span>
                  </Link>
                </td>
              </tr>
            )}

            {videos.map((v) => {
              const durMin = v.duration_sec ? Math.round(v.duration_sec / 60) : 30;
              const isFailed = v.status === 'error' || v.status === 'failed';
              const isCancelled = v.status === 'cancelled';
              const isRunning = isVideoRunning(v.status);
              const isCompleted = v.status === 'report_generated' || v.status === 'completed';

              return (
                <tr key={v.id} style={{ borderBottom: '1px solid var(--card-border)', backgroundColor: isRunning ? '#FAFCF8' : 'transparent' }}>
                  <td style={{ padding: '14px', fontWeight: 700, color: 'var(--accent)' }}>
                    {v.teacher_id}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <Link
                      href={`/videos/${v.id}`}
                      style={{ fontWeight: 600, color: 'var(--text-main)', textDecoration: 'underline' }}
                    >
                      {v.title}
                    </Link>
                  </td>
                  <td style={{ padding: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                    {durMin ? `~${durMin} min` : '—'}
                  </td>
                  <td style={{ padding: '14px' }}>
                    <span
                      className="badge"
                      title={isFailed && v.error_msg ? v.error_msg : undefined}
                      style={
                        isFailed
                          ? { backgroundColor: '#FEE2E2', color: '#DC2626', border: '1px solid #FECACA', fontWeight: 700, cursor: v.error_msg ? 'help' : 'default' }
                          : isCancelled
                          ? { backgroundColor: '#FEF3C7', color: '#D97706', border: '1px solid #FCD34D', fontWeight: 700 }
                          : isRunning
                          ? {
                              backgroundColor: '#DCFCE7',
                              color: '#166534',
                              border: '1px solid #86EFAC',
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                            }
                          : isCompleted
                          ? { backgroundColor: '#E0F2FE', color: '#0369A1', border: '1px solid #BAE6FD', fontWeight: 600 }
                          : { backgroundColor: '#FAF5EE', color: 'var(--accent)', border: '1px solid #E8D9C8', fontWeight: 600 }
                      }
                    >
                      {isRunning && <Loader2 size={11} className="animate-spin" />}
                      {getStatusLabel(v.status)}
                    </span>
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right' }}>
                    <div style={{ display: 'inline-flex', gap: '8px' }}>
                      <Link
                        href={`/videos/${v.id}`}
                        className={isRunning ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                        style={isRunning ? { backgroundColor: '#16A34A', borderColor: '#15803D' } : {}}
                      >
                        {isRunning ? <Loader2 size={13} className="animate-spin" /> : <ListOrdered size={13} />}
                        <span>{isRunning ? t('btnViewLiveProgress') : isFailed ? t('inspectError') : t('eventsList')}</span>
                      </Link>

                      {isCompleted && (
                        <Link
                          href={`/reports/${v.id}`}
                          className="btn btn-primary btn-sm"
                        >
                          <FileText size={13} />
                          <span>{t('viewReport')}</span>
                        </Link>
                      )}

                      {!isRunning && !isCompleted && (
                        <button
                          onClick={() => handleTrigger(v.id)}
                          className={isFailed ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
                          style={isFailed ? { backgroundColor: 'var(--accent)' } : {}}
                        >
                          <Play size={13} />
                          <span>{isFailed ? t('retryAnalysis') : t('runPipeline')}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
