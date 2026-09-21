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
  Sparkles,
} from 'lucide-react';
import { usePipelineSync, markVideoReanalyzed, markStepSynced } from '@/lib/pipelineSync';

export const PipelineNotificationCenter: React.FC = () => {
  const router = useRouter();
  const toast = useToast();
  const { language, t } = useTranslation();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'activity' | 'sync'>('activity');
  const [syncingKey, setSyncingKey] = useState<string | null>(null);

  const { reanalyzedGroups, reanalyzedCount, refresh: refreshSync } = usePipelineSync();

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
            if (v.status === 'error' || v.status === 'failed') {
              toast.error(
                language === 'vi'
                  ? `Tiến trình phân tích bài giảng "${v.title || v.teacher_id}" đã bị gián đoạn.`
                  : `Analysis for lesson "${v.title || v.teacher_id}" was interrupted.`,
                {
                  title: language === 'vi' ? `Phân tích bị gián đoạn (${v.teacher_id})` : `Analysis Interrupted (${v.teacher_id})`,
                  duration: 8000,
                  action: {
                    label: language === 'vi' ? 'Xem & Chạy lại →' : 'Review & Retry →',
                    onClick: () => router.push(`/videos/${v.id}`),
                  },
                }
              );
            } else if (v.status === 'report_generated' || v.status === 'completed') {
              markVideoReanalyzed(v.id);
              toast.success(
                language === 'vi'
                  ? `Báo cáo phân tích sư phạm cho "${v.title || v.teacher_id}" đã sẵn sàng.`
                  : `Classroom analysis report for "${v.title || v.teacher_id}" is ready.`,
                {
                  title: language === 'vi' ? `Báo cáo hoàn tất (${v.teacher_id})` : `Analysis Ready (${v.teacher_id})`,
                  duration: 6000,
                  action: {
                    label: language === 'vi' ? 'Xem báo cáo →' : 'View Report →',
                    onClick: () => router.push(`/reports/${v.id}`),
                  },
                }
              );
            } else if (v.status === 'cancelled') {
              toast.warning(
                language === 'vi'
                  ? `Tiến trình phân tích bài giảng "${v.title || v.teacher_id}" đã bị dừng.`
                  : `Analysis for lesson "${v.title || v.teacher_id}" was cancelled.`,
                {
                  title: language === 'vi' ? `Đã dừng phân tích (${v.teacher_id})` : `Analysis Cancelled (${v.teacher_id})`,
                  duration: 6000,
                  action: {
                    label: language === 'vi' ? 'Chi tiết →' : 'Details →',
                    onClick: () => router.push(`/videos/${v.id}`),
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

  const failedVideos = videos.filter((v) => v.status === 'error' || v.status === 'failed');
  const runningVideos = videos.filter((v) =>
    ['uploading', 'running', 'processing', 'chunking', 'chunked', 'extracting', 'extracted', 'merging', 'review_pending', 'mapping', 'mapped', 'statistics'].includes(v.status)
  );
  const cancelledVideos = videos.filter((v) => v.status === 'cancelled');

  const totalBadges = failedVideos.length + runningVideos.length + cancelledVideos.length;

  const handleRetry = async (e: React.MouseEvent, videoId: string, title: string, mode: 'resume' | 'restart' = 'resume') => {
    e.stopPropagation();
    try {
      setRetryingId(videoId);
      markVideoReanalyzed(videoId);
      // Optimistically update video status in local state so badge and list update immediately
      setVideos((prev) =>
        prev.map((v) =>
          v.id === videoId
            ? { ...v, status: 'chunking', failed_step: undefined, error_msg: undefined }
            : v
        )
      );
      await api.triggerPipeline(videoId, undefined, true, mode);
      const isResume = mode === 'resume';
      toast.info(
        isResume
          ? (language === 'vi' ? `Đã tiếp tục phân tích từ checkpoint cho "${title}".` : `Analysis resumed from checkpoint for "${title}".`)
          : (language === 'vi' ? `Đã khởi động lại toàn bộ phân tích cho "${title}".` : `Full analysis restarted for "${title}".`),
        {
          title: isResume
            ? (language === 'vi' ? 'Đã tiếp tục phân tích' : 'Analysis Resumed')
            : (language === 'vi' ? 'Đã chạy lại phân tích' : 'Analysis Restarted'),
        }
      );
      await fetchVideosAndCheckTransitions();
    } catch (err: any) {
      toast.error(
        err.message || (language === 'vi' ? 'Không thể chạy lại phân tích' : 'Failed to restart analysis'),
        { title: language === 'vi' ? 'Lỗi chạy lại' : 'Restart Error' }
      );
      await fetchVideosAndCheckTransitions();
    } finally {
      setRetryingId(null);
    }
  };

  const handleCancel = async (e: React.MouseEvent, videoId: string, title: string) => {
    e.stopPropagation();
    try {
      await api.cancelPipeline(videoId);
      toast.warning(
        language === 'vi' ? `Đã dừng phân tích bài giảng "${title}".` : `Analysis stopped for "${title}".`,
        {
          title: language === 'vi' ? 'Đã dừng phân tích' : 'Analysis Stopped',
        }
      );
      await fetchVideosAndCheckTransitions();
    } catch (err: any) {
      toast.error(
        err.message || (language === 'vi' ? 'Không thể dừng phân tích' : 'Failed to stop analysis'),
        { title: language === 'vi' ? 'Lỗi dừng phân tích' : 'Stop Error' }
      );
    }
  };

  const handleQuickSync = async (e: React.MouseEvent, group: typeof reanalyzedGroups[0]) => {
    e.stopPropagation();
    try {
      setSyncingKey(group.videoId);
      try {
        await api.generateCodebook(group.videoId);
      } catch {
        // ignore if not applicable
      }
      markStepSynced('codebook', group.videoId);
      markStepSynced('themes');
      markStepSynced('interview');
      localStorage.removeItem(`pipeline_video_reanalyzed_${group.videoId}`);
      window.dispatchEvent(new CustomEvent('pipeline-sync-updated', { detail: { videoId: group.videoId } }));
      toast.success(
        language === 'vi'
          ? `Đã đồng bộ thành công các bước hạ nguồn cho "${group.title}".`
          : `Successfully synchronized downstream steps for "${group.title}".`,
        {
          title: language === 'vi' ? 'Đã đồng bộ' : 'Synchronized',
        }
      );
      await refreshSync();
    } catch (err: any) {
      toast.error(err.message || 'Error syncing', { title: 'Sync Error' });
    } finally {
      setSyncingKey(null);
    }
  };

  const manualRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchVideosAndCheckTransitions(), refreshSync()]);
    setLoading(false);
  };

  const totalBadgesWithSync = totalBadges + reanalyzedGroups.length;

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
          color: (failedVideos.length > 0 || cancelledVideos.length > 0 || reanalyzedGroups.length > 0)
            ? (failedVideos.length > 0 ? '#DC2626' : '#D97706')
            : 'var(--text-main)',
          fontWeight: 600,
          fontSize: '13px',
          transition: 'all 0.15s ease',
        }}
        title="Video Analysis & Pipeline Activity"
      >
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Bell size={16} />
          {(failedVideos.length > 0 || cancelledVideos.length > 0 || reanalyzedGroups.length > 0) && (
            <span
              style={{
                position: 'absolute',
                top: '-5px',
                right: '-5px',
                width: '8px',
                height: '8px',
                backgroundColor: failedVideos.length > 0 ? '#DC2626' : '#D97706',
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
        ) : cancelledVideos.length > 0 ? (
          <span
            style={{
              backgroundColor: '#FFFBEB',
              color: '#D97706',
              border: '1px solid #FDE68A',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {cancelledVideos.length} {t('filterCancelled')}
          </span>
        ) : reanalyzedGroups.length > 0 ? (
          <span
            style={{
              backgroundColor: '#FEF3C7',
              color: '#B45309',
              border: '1px solid #FDE68A',
              padding: '1px 6px',
              borderRadius: '10px',
              fontSize: '11px',
              fontWeight: 700,
            }}
          >
            {reanalyzedGroups.length} {t('wfSyncTabTitle')}
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
            width: '420px',
            maxWidth: '92vw',
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
              padding: '12px 18px',
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
              {totalBadgesWithSync > 0 && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: failedVideos.length > 0 ? '#FEE2E2' : runningVideos.length > 0 ? '#E0E7FF' : '#FEF3C7',
                    color: failedVideos.length > 0 ? '#991B1B' : runningVideos.length > 0 ? '#3730A3' : '#92400E',
                  }}
                >
                  {totalBadgesWithSync}
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

          {/* Sub Tabs: Activity vs Sync Required */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--card-border)',
              backgroundColor: '#FAF8F4',
              padding: '0 12px',
              gap: '6px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('activity')}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'activity' ? '2px solid var(--accent)' : '2px solid transparent',
                color: activeTab === 'activity' ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <span>{language === 'vi' ? 'Tiến Trình Video' : 'Pipeline Activity'}</span>
              {totalBadges > 0 && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: failedVideos.length > 0 ? '#FEE2E2' : '#E5DFD5',
                    color: failedVideos.length > 0 ? '#991B1B' : 'var(--text-main)',
                  }}
                >
                  {totalBadges}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('sync')}
              style={{
                flex: 1,
                padding: '8px 10px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                background: 'none',
                borderBottom: activeTab === 'sync' ? '2px solid #D97706' : '2px solid transparent',
                color: activeTab === 'sync' ? '#D97706' : 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <AlertTriangle size={12} style={{ color: reanalyzedGroups.length > 0 ? '#D97706' : 'inherit' }} />
                <span>{t('wfSyncTabTitle')}</span>
              </div>
              {reanalyzedGroups.length > 0 && (
                <span
                  style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '999px',
                    backgroundColor: '#FEF3C7',
                    color: '#B45309',
                    border: '1px solid #FDE68A',
                  }}
                >
                  {reanalyzedGroups.length}
                </span>
              )}
            </button>
          </div>

          {/* List Content */}
          <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
            {activeTab === 'sync' ? (
              /* TAB: SYNC REQUIRED */
              <div>
                {reanalyzedGroups.length === 0 ? (
                  <div style={{ padding: '36px 20px', textAlign: 'center' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '50%',
                        backgroundColor: '#DCFCE7',
                        color: '#15803D',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 12px auto',
                      }}
                    >
                      <CheckCircle2 size={22} />
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {t('wfStatusSynced')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, maxWidth: '280px', margin: '0 auto' }}>
                      {t('wfSyncAllClean')}
                    </div>
                  </div>
                ) : (
                  <div>
                    {reanalyzedGroups.map((group) => (
                      <div
                        key={group.videoId}
                        style={{
                          padding: '14px 16px',
                          borderBottom: '1px solid var(--card-border)',
                          backgroundColor: '#FFFDF9',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                              }}
                            >
                              <AlertTriangle size={14} />
                            </div>
                            <div>
                              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                                {group.title}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Clock size={11} />
                                <span>{new Date(group.reanalyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                <span style={{ opacity: 0.5 }}>•</span>
                                <span>{group.teacherId}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => handleQuickSync(e, group)}
                            disabled={syncingKey === group.videoId}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 9px',
                              borderRadius: '6px',
                              backgroundColor: '#D97706',
                              color: '#FFFFFF',
                              border: 'none',
                              fontSize: '11px',
                              fontWeight: 600,
                              cursor: syncingKey === group.videoId ? 'not-allowed' : 'pointer',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <RefreshCw size={11} className={syncingKey === group.videoId ? 'animate-spin' : ''} />
                            <span>{syncingKey === group.videoId ? t('wfSyncingBtn') : (language === 'vi' ? 'Sync Tất Cả' : 'Sync All')}</span>
                          </button>
                        </div>

                        {/* Affected Steps List */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                            backgroundColor: '#FAF8F4',
                            padding: '8px 10px',
                            borderRadius: '8px',
                            border: '1px solid #EFEAE1',
                          }}
                        >
                          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {t('wfSyncAffectedSteps')}
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {group.affectedSteps.map((step) => (
                              <button
                                key={step.featureKey}
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  router.push(step.route);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '4px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid #E5DFD5',
                                  fontSize: '11px',
                                  color: 'var(--text-main)',
                                  cursor: 'pointer',
                                  fontWeight: 500,
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.borderColor = 'var(--accent, #9E4A28)';
                                  e.currentTarget.style.color = 'var(--accent, #9E4A28)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.borderColor = '#E5DFD5';
                                  e.currentTarget.style.color = 'var(--text-main)';
                                }}
                                title={language === 'vi' ? step.actionLabelVi : step.actionLabelEn}
                              >
                                <span>{language === 'vi' ? step.nameVi.split('(')[0].trim() : step.nameEn}</span>
                                <ArrowRight size={10} style={{ opacity: 0.6 }} />
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* TAB: PIPELINE ACTIVITY */
              <div>
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

                  <p
                    style={{
                      fontSize: '12px',
                      color: '#B91C1C',
                      marginTop: '2px',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      lineHeight: '1.4',
                    }}
                    title={video.error_msg || t('interruptedDesc')}
                  >
                    {video.error_msg || t('interruptedDesc')}
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

            {/* Cancelled Items */}
            {cancelledVideos.map((video) => (
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
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFFBEB')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#FFFDF9')}
              >
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    backgroundColor: '#FEF3C7',
                    color: '#D97706',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: '2px',
                  }}
                >
                  <Clock size={15} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '11px',
                        fontWeight: 700,
                        backgroundColor: '#FEF3C7',
                        color: '#92400E',
                        padding: '1px 6px',
                        borderRadius: '3px',
                      }}
                    >
                      {video.teacher_id}
                    </span>
                    <span style={{ fontSize: '11px', color: '#D97706', fontWeight: 700 }}>
                      {t('filterCancelled')}
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

                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={(e) => handleRetry(e, video.id, video.title, 'resume')}
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

            {/* Empty State */}
            {failedVideos.length === 0 && runningVideos.length === 0 && cancelledVideos.length === 0 && (
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
