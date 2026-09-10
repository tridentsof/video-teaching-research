'use client';

import React, { useEffect, useState, useMemo } from 'react';
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
  Search,
  RotateCcw,
  X,
  Filter,
  SlidersHorizontal,
  Pencil,
  Check,
} from 'lucide-react';

export default function VideoListPage() {
  const { t } = useTranslation();
  const { activeUpload } = useUpload();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Edit / Reassign Teacher modal state
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTeacherId, setEditTeacherId] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

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

  const handleOpenEdit = (v: Video) => {
    setEditingVideo(v);
    setEditTeacherId(v.teacher_id);
    setEditTitle(v.title);
    setEditError(null);
  };

  const handleCloseEdit = () => {
    if (savingEdit) return;
    setEditingVideo(null);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVideo) return;
    if (!editTeacherId.trim()) {
      setEditError(t('newTeacher'));
      return;
    }

    try {
      setSavingEdit(true);
      setEditError(null);
      const updated = await api.updateVideo(editingVideo.id, {
        teacher_id: editTeacherId.trim(),
        title: editTitle.trim() || undefined,
      });

      setVideos((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setEditingVideo(null);
      setEditSuccess(t('videoUpdateSuccess'));
      setTimeout(() => setEditSuccess(null), 4500);
    } catch (err: any) {
      setEditError(err.message || 'Failed to update video');
    } finally {
      setSavingEdit(false);
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

  // Unique list of teachers from videos
  const teacherIds = useMemo(() => {
    return Array.from(new Set(videos.map((v) => v.teacher_id).filter(Boolean))).sort();
  }, [videos]);

  // Filtered & sorted video list
  const filteredVideos = useMemo(() => {
    return videos
      .filter((v) => {
        // 1. Keyword search (title & teacher_id)
        if (searchTerm.trim()) {
          const query = searchTerm.toLowerCase().trim();
          const titleMatch = (v.title || '').toLowerCase().includes(query);
          const teacherMatch = (v.teacher_id || '').toLowerCase().includes(query);
          if (!titleMatch && !teacherMatch) return false;
        }

        // 2. Status filter
        if (statusFilter !== 'all') {
          if (statusFilter === 'completed') {
            if (v.status !== 'report_generated' && v.status !== 'completed') return false;
          } else if (statusFilter === 'in_progress') {
            if (!['uploading', 'chunking', 'extracting', 'event_extraction', 'merging', 'event_merge', 'mapping', 'statistics', 'generating_report', 'report_generation'].includes(v.status)) {
              return false;
            }
          } else if (statusFilter === 'queued') {
            if (v.status !== 'uploaded') return false;
          } else if (statusFilter === 'error') {
            if (v.status !== 'failed' && v.status !== 'error') return false;
          } else if (statusFilter === 'cancelled') {
            if (v.status !== 'cancelled') return false;
          }
        }

        // 3. Teacher filter
        if (teacherFilter !== 'all') {
          if (v.teacher_id !== teacherFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const timeA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
          const timeB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
          return timeB - timeA;
        }
        if (sortBy === 'oldest') {
          const timeA = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
          const timeB = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
          return timeA - timeB;
        }
        if (sortBy === 'title_asc') {
          return (a.title || '').localeCompare(b.title || '');
        }
        if (sortBy === 'title_desc') {
          return (b.title || '').localeCompare(a.title || '');
        }
        if (sortBy === 'duration_desc') {
          return (b.duration_sec || 0) - (a.duration_sec || 0);
        }
        if (sortBy === 'duration_asc') {
          return (a.duration_sec || 0) - (b.duration_sec || 0);
        }
        return 0;
      });
  }, [videos, searchTerm, statusFilter, teacherFilter, sortBy]);

  const isFiltered = searchTerm.trim() !== '' || statusFilter !== 'all' || teacherFilter !== 'all' || sortBy !== 'newest';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setTeacherFilter('all');
    setSortBy('newest');
  };

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

      {/* Success Notification Banner */}
      {editSuccess && (
        <div
          style={{
            backgroundColor: '#F0FDF4',
            border: '1px solid #86EFAC',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            color: '#166534',
            fontSize: '13px',
            fontWeight: 600,
            animation: 'fadeIn 0.2s ease-out',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} color="#16A34A" />
            <span>{editSuccess}</span>
          </div>
          <button
            onClick={() => setEditSuccess(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#166534' }}
          >
            <X size={14} />
          </button>
        </div>
      )}

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
          { label: t('statTotalLessons'), value: videos.filter((v) => v.status === 'report_generated' || v.status === 'completed').length, badge: t('statTarget24') },
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

      {/* Video Repository Table & Filters */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}>
        {/* Table Header with Counts */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
              {t('navVideos')}
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {isFiltered
                ? t('filterShowingCount')
                    .replace('{count}', filteredVideos.length.toString())
                    .replace('{total}', videos.length.toString())
                : `${videos.length} ${t('videosInRepo')}`}
            </span>
          </div>

          {isFiltered && (
            <button
              onClick={resetFilters}
              className="btn btn-secondary btn-sm"
              style={{
                fontSize: '12px',
                padding: '5px 10px',
                color: 'var(--accent)',
                borderColor: '#E8D9C8',
                backgroundColor: 'var(--accent-soft)',
              }}
            >
              <RotateCcw size={12} />
              <span>{t('filterReset')}</span>
            </button>
          )}
        </div>

        {/* Filter Toolbar */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 1.8fr) repeat(3, minmax(140px, 1fr))',
          gap: '10px',
          alignItems: 'center',
          backgroundColor: '#FAF8F4',
          padding: '12px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--card-border-soft)',
        }}>
          {/* Keyword Search */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '10px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t('filterSearchPlaceholder')}
              style={{
                width: '100%',
                padding: '7px 28px 7px 30px',
                fontSize: '12px',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--card-border)',
                borderRadius: '6px',
                color: 'var(--text-main)',
                outline: 'none',
              }}
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '2px',
                }}
                title="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              border: statusFilter !== 'all' ? '1px solid var(--accent)' : '1px solid var(--card-border)',
              borderRadius: '6px',
              color: statusFilter !== 'all' ? 'var(--accent)' : 'var(--text-main)',
              fontWeight: statusFilter !== 'all' ? 600 : 400,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">{t('filterAllStatuses')}</option>
            <option value="completed">{t('filterCompleted')}</option>
            <option value="in_progress">{t('filterInProgress')}</option>
            <option value="queued">{t('filterQueued')}</option>
            <option value="error">{t('filterFailed')}</option>
            <option value="cancelled">{t('filterCancelled')}</option>
          </select>

          {/* Teacher Filter */}
          <select
            value={teacherFilter}
            onChange={(e) => setTeacherFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              border: teacherFilter !== 'all' ? '1px solid var(--accent)' : '1px solid var(--card-border)',
              borderRadius: '6px',
              color: teacherFilter !== 'all' ? 'var(--accent)' : 'var(--text-main)',
              fontWeight: teacherFilter !== 'all' ? 600 : 400,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">{t('filterAllTeachers')}</option>
            {teacherIds.map((tid) => (
              <option key={tid} value={tid}>
                {tid}
              </option>
            ))}
          </select>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              border: sortBy !== 'newest' ? '1px solid var(--accent)' : '1px solid var(--card-border)',
              borderRadius: '6px',
              color: sortBy !== 'newest' ? 'var(--accent)' : 'var(--text-main)',
              fontWeight: sortBy !== 'newest' ? 600 : 400,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="newest">{t('sortNewest')}</option>
            <option value="oldest">{t('sortOldest')}</option>
            <option value="title_asc">{t('sortTitleAsc')}</option>
            <option value="title_desc">{t('sortTitleDesc')}</option>
            <option value="duration_desc">{t('sortDurationDesc')}</option>
            <option value="duration_asc">{t('sortDurationAsc')}</option>
          </select>
        </div>

        {/* Video Table */}
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
            {isUploadingOnly &&
              (!activeUpload?.videoId || !videos.some((v) => v.id === activeUpload.videoId)) &&
              (statusFilter === 'all' || statusFilter === 'in_progress') && (
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

            {filteredVideos.map((v) => {
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

                      {!isRunning && (
                        <button
                          onClick={() => handleOpenEdit(v)}
                          className="btn btn-secondary btn-sm"
                          title={t('editVideo')}
                          style={{
                            padding: '6px 9px',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <Pencil size={13} />
                          <span>{t('editVideo')}</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Empty state when no items match filters */}
            {filteredVideos.length === 0 && !loading && (
              <tr>
                <td colSpan={5} style={{ padding: '48px 20px', textAlign: 'center' }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '10px',
                  }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-soft)',
                      color: 'var(--accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Filter size={20} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                      {t('filterNoResultsTitle')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '360px' }}>
                      {t('filterNoResultsDesc')}
                    </div>
                    {isFiltered && (
                      <button
                        onClick={resetFilters}
                        className="btn btn-secondary btn-sm"
                        style={{ marginTop: '8px' }}
                      >
                        <RotateCcw size={12} />
                        <span>{t('filterReset')}</span>
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Video & Reassign Teacher Modal */}
      {editingVideo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(28, 25, 23, 0.55)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCloseEdit();
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--card-border)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: 'var(--text-main)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Pencil size={18} color="var(--accent)" />
                  <span>{t('editVideoModalTitle')}</span>
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', lineHeight: 1.4 }}>
                  {t('editVideoModalDesc')}
                </p>
              </div>
              <button
                onClick={handleCloseEdit}
                disabled={savingEdit}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Error Message */}
            {editError && (
              <div style={{
                backgroundColor: '#FEE2E2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <AlertCircle size={15} />
                <span>{editError}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSaveEdit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Teacher ID Field */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('newTeacher')}
                </label>
                <input
                  type="text"
                  value={editTeacherId}
                  onChange={(e) => setEditTeacherId(e.target.value.toUpperCase().trim())}
                  placeholder={t('selectTeacherPlaceholder')}
                  required
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    fontWeight: 700,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--accent)',
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />

                {/* Quick select chip pills */}
                {teacherIds.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      {t('quickSelectTeacher')}:
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {teacherIds.map((tid) => (
                        <button
                          key={tid}
                          type="button"
                          onClick={() => setEditTeacherId(tid)}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: editTeacherId === tid ? 700 : 500,
                            color: editTeacherId === tid ? '#FFFFFF' : 'var(--text-main)',
                            backgroundColor: editTeacherId === tid ? 'var(--accent)' : '#FAF5EE',
                            border: editTeacherId === tid ? '1px solid var(--accent)' : '1px solid #E8D9C8',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          {editTeacherId === tid && <Check size={10} />}
                          <span>{tid}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Lesson Title Field */}
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('videoTitleLabel')}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={t('videoTitlePlaceholder')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border)',
                    borderRadius: '6px',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Info Notice */}
              <div style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '6px',
                padding: '10px 12px',
                fontSize: '12px',
                color: '#475569',
                lineHeight: 1.4,
              }}>
                <strong>💡 {t('commonNote') || 'Lưu ý'}:</strong> {t('editVideoModalDesc')}
              </div>

              {/* Modal Actions */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  disabled={savingEdit}
                  className="btn btn-secondary"
                  style={{ fontSize: '13px' }}
                >
                  <span>{t('commonCancel')}</span>
                </button>
                <button
                  type="submit"
                  disabled={savingEdit || !editTeacherId.trim()}
                  className="btn btn-primary"
                  style={{ fontSize: '13px' }}
                >
                  {savingEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  <span>{savingEdit ? t('btnSaving') : t('btnSaveVideo')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

