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
  Trash2,
  RotateCw,
  Eraser,
  Layers,
  Film,
  MoreHorizontal,
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
  const [modeFilter, setModeFilter] = useState<string>('all');
  const [teacherFilter, setTeacherFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');

  // Edit / Reassign Teacher modal state
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editTeacherId, setEditTeacherId] = useState<string>('');
  const [editTitle, setEditTitle] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSuccess, setEditSuccess] = useState<string | null>(null);

  // Delete video state
  const [deletingVideo, setDeletingVideo] = useState<Video | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [resettingVideo, setResettingVideo] = useState<Video | null>(null);
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // Bulk delete state
  const [selectedVideoIds, setSelectedVideoIds] = useState<string[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState<boolean>(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState<boolean>(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState<string>('');

  // Clear events state
  const [clearingEventsVideo, setClearingEventsVideo] = useState<Video | null>(null);
  const [isClearingEvents, setIsClearingEvents] = useState<boolean>(false);
  const [clearingEventsError, setClearingEventsError] = useState<string | null>(null);


  // Action dropdown menu state
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

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

  // Delete handlers
  const handleOpenDelete = (v: Video) => {
    setDeletingVideo(v);
    setDeleteConfirmText('');
    setDeleteError(null);
  };

  const handleCloseDelete = () => {
    if (isDeleting) return;
    setDeletingVideo(null);
    setDeleteError(null);
    setDeleteConfirmText('');
  };

  const handleConfirmDelete = async () => {
    if (!deletingVideo) return;
    try {
      setIsDeleting(true);
      setDeleteError(null);
      await api.deleteVideo(deletingVideo.id);
      setVideos((prev) => prev.filter((item) => item.id !== deletingVideo.id));
      setDeletingVideo(null);
      setEditSuccess(t('deleteVideoSuccess') || 'Video deleted successfully');
      setTimeout(() => setEditSuccess(null), 4500);
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete video');
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset pipeline handlers
  const handleOpenReset = (v: Video) => {
    setResettingVideo(v);
    setResetError(null);
  };

  const handleCloseReset = () => {
    if (isResetting) return;
    setResettingVideo(null);
    setResetError(null);
  };

  const handleConfirmReset = async () => {
    if (!resettingVideo) return;
    try {
      setIsResetting(true);
      setResetError(null);
      await api.resetPipeline(resettingVideo.id);
      setVideos((prev) =>
        prev.map((item) =>
          item.id === resettingVideo.id
            ? { ...item, status: 'uploaded', error_msg: undefined, failed_step: undefined }
            : item
        )
      );
      setResettingVideo(null);
      setEditSuccess(t('resetPipelineSuccess') || 'Pipeline reset successfully');
      setTimeout(() => setEditSuccess(null), 4500);
    } catch (err: any) {
      setResetError(err.message || 'Failed to reset pipeline');
    } finally {
      setIsResetting(false);
    }
  };

  // Bulk delete handlers
  const handleToggleSelectAll = () => {
    if (selectedVideoIds.length === filteredVideos.length) {
      setSelectedVideoIds([]);
    } else {
      setSelectedVideoIds(filteredVideos.map((v) => v.id));
    }
  };

  const handleToggleSelectVideo = (id: string) => {
    setSelectedVideoIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleConfirmBulkDelete = async () => {
    if (bulkDeleteConfirmText !== 'DELETE') return;
    try {
      setIsBulkDeleting(true);
      setBulkDeleteError(null);
      const res = await api.bulkDeleteVideos(selectedVideoIds);
      if (res.failed && res.failed.length > 0) {
        setBulkDeleteError(`Deleted ${res.deleted.length} videos, but ${res.failed.length} failed.`);
      } else {
        setShowBulkDeleteModal(false);
        setSelectedVideoIds([]);
        setBulkDeleteConfirmText('');
        setEditSuccess(t('bulkDeleteSuccess') || 'Đã xóa các video đã chọn thành công!');
        setTimeout(() => setEditSuccess(null), 4500);
      }
      await fetchVideos(true);
    } catch (err: any) {
      setBulkDeleteError(err.message || 'Failed to bulk delete videos');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Clear events handler
  const handleConfirmClearEvents = async () => {
    if (!clearingEventsVideo) return;
    try {
      setIsClearingEvents(true);
      setClearingEventsError(null);
      await api.deleteVideoEvents(clearingEventsVideo.id);
      setClearingEventsVideo(null);
      setEditSuccess(t('deleteRawEventsSuccess') || 'Events cleared successfully! Video reset to chunked.');
      setTimeout(() => setEditSuccess(null), 4500);
      await fetchVideos(true);
    } catch (err: any) {
      setClearingEventsError(err.message || 'Failed to clear events');
    } finally {
      setIsClearingEvents(false);
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

  // Close open action menu on outside click
  useEffect(() => {
    if (!openActionMenuId) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.action-menu-container')) {
        setOpenActionMenuId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [openActionMenuId]);

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

        // 3. Mode filter
        if (modeFilter !== 'all') {
          if (modeFilter === 'chunk') {
            if (v.processing_mode !== 'chunk') return false;
          } else if (modeFilter === 'full') {
            if (v.processing_mode !== 'full') return false;
          } else if (modeFilter === 'unprocessed') {
            if (v.processing_mode) return false;
          }
        }

        // 4. Teacher filter
        if (teacherFilter !== 'all') {
          if (v.teacher_id !== teacherFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'newest') {
          const timeA = new Date(a.updated_at || a.uploaded_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.uploaded_at || 0).getTime();
          return timeB - timeA;
        }
        if (sortBy === 'oldest') {
          const timeA = new Date(a.uploaded_at || a.updated_at || 0).getTime();
          const timeB = new Date(b.uploaded_at || b.updated_at || 0).getTime();
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
  }, [videos, searchTerm, statusFilter, modeFilter, teacherFilter, sortBy]);

  const isFiltered = searchTerm.trim() !== '' || statusFilter !== 'all' || modeFilter !== 'all' || teacherFilter !== 'all' || sortBy !== 'newest';

  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setModeFilter('all');
    setTeacherFilter('all');
    setSortBy('newest');
  };

  const handleTrigger = async (id: string) => {
    try {
      setVideos((prev) =>
        prev.map((v) =>
          v.id === id
            ? { ...v, status: 'chunking', failed_step: undefined, error_msg: undefined }
            : v
        )
      );
      await api.triggerPipeline(id);
      fetchVideos(true);
    } catch (err: any) {
      alert(`Failed to start pipeline: ${err.message}`);
      fetchVideos(true);
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

          {/* Processing Mode Filter */}
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            style={{
              padding: '7px 10px',
              fontSize: '12px',
              backgroundColor: '#FFFFFF',
              border: modeFilter !== 'all' ? '1px solid var(--accent)' : '1px solid var(--card-border)',
              borderRadius: '6px',
              color: modeFilter !== 'all' ? 'var(--accent)' : 'var(--text-main)',
              fontWeight: modeFilter !== 'all' ? 600 : 400,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="all">{t('filterAllModes')}</option>
            <option value="chunk">{t('filterModeChunk')}</option>
            <option value="full">{t('filterModeFull')}</option>
            <option value="unprocessed">{t('modeUnprocessed')}</option>
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

        {/* Bulk Actions Banner */}
        {selectedVideoIds.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: '8px',
            padding: '10px 16px',
            marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991B1B', fontWeight: 600, fontSize: '13px' }}>
              <span>{selectedVideoIds.length} {t('selectedVideosCount') || 'đã chọn'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => setSelectedVideoIds([])}
                className="btn btn-secondary btn-sm"
              >
                {t('deselectAll') || 'Bỏ chọn'}
              </button>
              <button
                onClick={() => {
                  setBulkDeleteError(null);
                  setBulkDeleteConfirmText('');
                  setShowBulkDeleteModal(true);
                }}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 12px',
                  borderRadius: '6px',
                }}
              >
                <Trash2 size={13} />
                <span>{t('bulkDeleteVideos') || 'Xóa Đã Chọn'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Video Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: '#F4EFE6', borderBottom: '2px solid var(--card-border)' }}>
              <th style={{ padding: '12px 14px', width: '38px', textAlign: 'center' }}>
                <input
                  type="checkbox"
                  checked={filteredVideos.length > 0 && selectedVideoIds.length === filteredVideos.length}
                  onChange={handleToggleSelectAll}
                  style={{ cursor: 'pointer' }}
                />
              </th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, width: '85px', whiteSpace: 'nowrap' }}>{t('teacher')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, minWidth: '220px' }}>{t('lessonTitle')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, width: '90px', whiteSpace: 'nowrap' }}>{t('duration')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, width: '110px', whiteSpace: 'nowrap' }}>{t('processingMode')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'left', fontWeight: 700, width: '130px', whiteSpace: 'nowrap' }}>{t('status')}</th>
              <th style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, width: '180px', whiteSpace: 'nowrap' }}>{t('actions')}</th>
            </tr>
          </thead>
          <tbody>
            {/* In-flight uploading placeholder row if active and not yet saved in DB */}
            {isUploadingOnly &&
              (!activeUpload?.videoId || !videos.some((v) => v.id === activeUpload.videoId)) &&
              (statusFilter === 'all' || statusFilter === 'in_progress') && (
                <tr style={{ borderBottom: '1px solid var(--card-border)', backgroundColor: '#F0FDF4' }}>
                  <td style={{ padding: '14px', textAlign: 'center' }}></td>
                  <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#166534',
                        backgroundColor: '#DCFCE7',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #BBF7D0',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-block',
                      }}
                    >
                      {activeUpload.teacherId}
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <Link
                      href="/videos/uploading"
                      style={{ fontWeight: 600, color: '#166534', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      <Loader2 size={13} className="animate-spin" />
                      <span>{activeUpload.title}</span>
                    </Link>
                  </td>
                  <td style={{ padding: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    —
                  </td>
                  <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                    <span
                      className="badge"
                      style={{
                        backgroundColor: activeUpload?.enableChunking ? '#EEF2FF' : '#FAF5FF',
                        color: activeUpload?.enableChunking ? '#4338CA' : '#6B21A8',
                        border: activeUpload?.enableChunking ? '1px solid #C7D2FE' : '1px solid #E9D5FF',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {activeUpload?.enableChunking ? <Layers size={11} /> : <Film size={11} />}
                      <span>{activeUpload?.enableChunking ? t('modeChunk') : t('modeFull')}</span>
                    </span>
                  </td>
                  <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
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
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Loader2 size={11} className="animate-spin" />
                      {t('liveUploadingBadge')} ({activeUpload.percentage}%)
                    </span>
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <Link href="/videos/uploading" className="btn btn-primary btn-sm" style={{ backgroundColor: '#16A34A', whiteSpace: 'nowrap' }}>
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
                <tr
                  key={v.id}
                  style={{
                    borderBottom: '1px solid var(--card-border)',
                    backgroundColor: selectedVideoIds.includes(v.id) ? '#FEF2F2' : isRunning ? '#FAFCF8' : 'transparent',
                  }}
                >
                  <td style={{ padding: '14px', textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={selectedVideoIds.includes(v.id)}
                      onChange={() => handleToggleSelectVideo(v.id)}
                      disabled={isRunning}
                      style={{ cursor: isRunning ? 'not-allowed' : 'pointer' }}
                    />
                  </td>
                  <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: 'var(--accent)',
                        backgroundColor: '#F7F3EE',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        border: '1px solid #EADBCC',
                        fontSize: '12px',
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-block',
                      }}
                    >
                      {v.teacher_id}
                    </span>
                  </td>
                  <td style={{ padding: '14px' }}>
                    <Link
                      href={`/videos/${v.id}`}
                      style={{
                        fontWeight: 600,
                        color: 'var(--text-main)',
                        textDecoration: 'none',
                        lineHeight: 1.4,
                        display: 'inline-block',
                        wordBreak: 'break-word',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                      onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
                    >
                      {v.title}
                    </Link>
                  </td>

                  <td style={{ padding: '14px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {durMin ? `~${durMin} min` : '—'}
                  </td>
                  <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                    {v.processing_mode === 'chunk' ? (
                      <span
                        className="badge"
                        title={t('modeChunkTooltip')}
                        style={{
                          backgroundColor: '#EEF2FF',
                          color: '#4338CA',
                          border: '1px solid #C7D2FE',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'help',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Layers size={11} />
                        <span>{t('modeChunk')}</span>
                      </span>
                    ) : v.processing_mode === 'full' ? (
                      <span
                        className="badge"
                        title={t('modeFullTooltip')}
                        style={{
                          backgroundColor: '#FAF5FF',
                          color: '#6B21A8',
                          border: '1px solid #E9D5FF',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'help',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <Film size={11} />
                        <span>{t('modeFull')}</span>
                      </span>
                    ) : (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#F3F4F6',
                          color: '#6B7280',
                          border: '1px solid #E5E7EB',
                          fontSize: '11px',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t('modeUnprocessed')}
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '14px', whiteSpace: 'nowrap' }}>
                    <span
                      className="badge"
                      title={isFailed && v.error_msg ? v.error_msg : undefined}
                      style={{
                        whiteSpace: 'nowrap',
                        ...(isFailed
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
                          : { backgroundColor: '#FAF5EE', color: 'var(--accent)', border: '1px solid #E8D9C8', fontWeight: 600 }),
                      }}
                    >
                      {isRunning && <Loader2 size={11} className="animate-spin" />}
                      {getStatusLabel(v.status)}
                    </span>
                  </td>
                  <td style={{ padding: '14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      {/* Primary Action Button */}
                      {isRunning ? (
                        <Link
                          href={`/videos/${v.id}`}
                          className="btn btn-primary btn-sm"
                          style={{ backgroundColor: '#16A34A', borderColor: '#15803D', whiteSpace: 'nowrap' }}
                        >
                          <Loader2 size={13} className="animate-spin" />
                          <span>{t('btnViewLiveProgress')}</span>
                        </Link>
                      ) : isCompleted ? (
                        <Link
                          href={`/reports/${v.id}`}
                          className="btn btn-primary btn-sm"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <FileText size={13} />
                          <span>{t('viewReport')}</span>
                        </Link>
                      ) : isFailed ? (
                        <button
                          onClick={() => handleTrigger(v.id)}
                          className="btn btn-primary btn-sm"
                          style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)', whiteSpace: 'nowrap' }}
                        >
                          <RotateCcw size={13} />
                          <span>{t('retryAnalysis')}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTrigger(v.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <Play size={13} />
                          <span>{t('runPipeline')}</span>
                        </button>
                      )}

                      {/* More Actions Dropdown Menu */}
                      <div className="action-menu-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenActionMenuId(openActionMenuId === v.id ? null : v.id);
                          }}
                          className="btn btn-secondary btn-sm"
                          style={{
                            padding: '6px 8px',
                            color: openActionMenuId === v.id ? 'var(--accent)' : 'var(--text-muted)',
                            backgroundColor: openActionMenuId === v.id ? '#F4EFE6' : undefined,
                          }}
                          title={t('moreActions') || 'More Actions'}
                        >
                          <MoreHorizontal size={15} />
                        </button>

                        {openActionMenuId === v.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 'calc(100% + 4px)',
                              backgroundColor: '#FFFFFF',
                              border: '1px solid var(--card-border)',
                              borderRadius: '8px',
                              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.12), 0 8px 10px -6px rgba(0, 0, 0, 0.08)',
                              minWidth: '185px',
                              zIndex: 100,
                              padding: '5px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              textAlign: 'left',
                            }}
                          >
                            {/* Inspect Error (if failed) */}
                            {isFailed && (
                              <Link
                                href={`/videos/${v.id}`}
                                onClick={() => setOpenActionMenuId(null)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  padding: '7px 10px',
                                  fontSize: '12px',
                                  color: '#DC2626',
                                  borderRadius: '6px',
                                  textDecoration: 'none',
                                  fontWeight: 500,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                              >
                                <AlertCircle size={14} />
                                <span>{t('inspectError')}</span>
                              </Link>
                            )}

                            {/* Events Timeline */}
                            <Link
                              href={`/videos/${v.id}`}
                              onClick={() => setOpenActionMenuId(null)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '7px 10px',
                                fontSize: '12px',
                                color: 'var(--text-main)',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontWeight: 500,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F3EE')}
                              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                            >
                              <ListOrdered size={14} />
                              <span>{t('eventsList')}</span>
                            </Link>

                            {!isRunning && (
                              <>
                                {/* Edit / Reassign */}
                                <button
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenEdit(v);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '7px 10px',
                                    fontSize: '12px',
                                    color: 'var(--text-main)',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    width: '100%',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 500,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#F7F3EE')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Pencil size={14} />
                                  <span>{t('editVideo')}</span>
                                </button>

                                {/* Reset Pipeline */}
                                {(isCompleted || isFailed || isCancelled) && (
                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleOpenReset(v);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      color: '#D97706',
                                      borderRadius: '6px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                      width: '100%',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFFBEB')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <RotateCw size={14} />
                                    <span>{t('resetPipeline') || 'Reset Pipeline'}</span>
                                  </button>
                                )}

                                {/* Clear Events */}
                                {['extracted', 'mapped', 'report_generated', 'completed'].includes(v.status) && (
                                  <button
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      setClearingEventsError(null);
                                      setClearingEventsVideo(v);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      padding: '7px 10px',
                                      fontSize: '12px',
                                      color: '#EA580C',
                                      borderRadius: '6px',
                                      border: 'none',
                                      backgroundColor: 'transparent',
                                      width: '100%',
                                      cursor: 'pointer',
                                      textAlign: 'left',
                                      fontWeight: 500,
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FFF7ED')}
                                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                  >
                                    <Eraser size={14} />
                                    <span>{t('deleteRawEvents') || 'Clear Events'}</span>
                                  </button>
                                )}

                                {/* Divider */}
                                <div style={{ height: '1px', backgroundColor: 'var(--card-border)', margin: '4px 0' }} />

                                {/* Delete Video */}
                                <button
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleOpenDelete(v);
                                  }}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '7px 10px',
                                    fontSize: '12px',
                                    color: '#DC2626',
                                    borderRadius: '6px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    width: '100%',
                                    cursor: 'pointer',
                                    textAlign: 'left',
                                    fontWeight: 500,
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#FEF2F2')}
                                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                                >
                                  <Trash2 size={14} />
                                  <span>{t('deleteVideo') || 'Delete Video'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}

            {/* Empty state when no items match filters */}
            {filteredVideos.length === 0 && !loading && (
              <tr>
                <td colSpan={7} style={{ padding: '48px 20px', textAlign: 'center' }}>
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

      {/* Delete Video Confirmation Modal */}
      {deletingVideo && (
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
            if (e.target === e.currentTarget) handleCloseDelete();
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #FECACA',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#DC2626' }}>
                    {t('deleteVideoTitle') || 'Xóa Video'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('deleteVideoWarning') || 'Hành động này không thể khôi phục.'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDelete}
                disabled={isDeleting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Info about what will be deleted */}
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: '6px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#7F1D1D',
              lineHeight: 1.5,
            }}>
              <strong>{deletingVideo.teacher_id}</strong> — {deletingVideo.title}
              <br />
              <span style={{ fontSize: '12px', color: '#991B1B', marginTop: '6px', display: 'block' }}>
                {t('deleteVideoCascadeWarning') || 'Tất cả dữ liệu liên quan sẽ bị xóa: chunks, events, mappings, reports, codebook, pipeline jobs.'}
              </span>
            </div>

            {deleteError && (
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
                <span>{deleteError}</span>
              </div>
            )}

            {/* Confirmation input */}
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                {t('deleteConfirmLabel') || 'Nhập "DELETE" để xác nhận:'}
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '13px',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  color: '#DC2626',
                  backgroundColor: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '6px',
                  outline: 'none',
                }}
              />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleCloseDelete}
                disabled={isDeleting}
                className="btn btn-secondary"
                style={{ fontSize: '13px' }}
              >
                <span>{t('commonCancel')}</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmText !== 'DELETE'}
                className="btn btn-primary"
                style={{
                  fontSize: '13px',
                  backgroundColor: '#DC2626',
                  borderColor: '#B91C1C',
                  opacity: deleteConfirmText !== 'DELETE' ? 0.5 : 1,
                }}
              >
                {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                <span>{isDeleting ? (t('btnDeleting') || 'Đang xóa...') : (t('btnConfirmDelete') || 'Xóa Vĩnh Viễn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Pipeline Confirmation Modal */}
      {resettingVideo && (
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
            if (e.target === e.currentTarget) handleCloseReset();
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 'var(--radius-md)',
              border: '1px solid #FCD34D',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#FEF3C7',
                  color: '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <RotateCw size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#92400E' }}>
                    {t('resetPipelineTitle') || 'Reset Pipeline'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('resetPipelineDesc') || 'Xóa tất cả kết quả phân tích và quay lại trạng thái ban đầu.'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseReset}
                disabled={isResetting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Info */}
            <div style={{
              backgroundColor: '#FFFBEB',
              border: '1px solid #FCD34D',
              borderRadius: '6px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#92400E',
              lineHeight: 1.5,
            }}>
              <strong>{resettingVideo.teacher_id}</strong> — {resettingVideo.title}
              <br />
              <span style={{ fontSize: '12px', color: '#78350F', marginTop: '6px', display: 'block' }}>
                {t('resetPipelineCascadeWarning') || 'Sẽ xóa: chunks, events, mappings, reports, codebook, pipeline jobs. Video gốc sẽ được giữ lại.'}
              </span>
            </div>

            {resetError && (
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
                <span>{resetError}</span>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={handleCloseReset}
                disabled={isResetting}
                className="btn btn-secondary"
                style={{ fontSize: '13px' }}
              >
                <span>{t('commonCancel')}</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                disabled={isResetting}
                className="btn btn-primary"
                style={{
                  fontSize: '13px',
                  backgroundColor: '#D97706',
                  borderColor: '#B45309',
                }}
              >
                {isResetting ? <Loader2 size={13} className="animate-spin" /> : <RotateCw size={13} />}
                <span>{isResetting ? (t('btnResetting') || 'Đang reset...') : (t('btnConfirmReset') || 'Reset Pipeline')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Dialog */}
      {showBulkDeleteModal && selectedVideoIds.length > 0 && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--card-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#DC2626' }}>
                    {t('bulkDeleteTitle') || 'Xóa Các Video Đã Chọn'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('deleteVideoWarning') || 'Hành động này không thể khôi phục.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#7F1D1D',
                lineHeight: 1.5,
              }}>
                <strong>{selectedVideoIds.length} videos</strong>
                <br />
                <span style={{ fontSize: '12px', color: '#991B1B', marginTop: '6px', display: 'block' }}>
                  {t('bulkDeleteWarning') || 'Hành động này sẽ xóa vĩnh viễn các video đã chọn và toàn bộ dữ liệu liên quan (chunks, sự kiện, khớp tiêu chí, báo cáo, codebook).'}
                </span>
              </div>

              {bulkDeleteError && (
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
                  <span>{bulkDeleteError}</span>
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                  {t('deleteConfirmLabel') || 'Nhập "DELETE" để xác nhận:'}
                </label>
                <input
                  type="text"
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  placeholder="DELETE"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: '1px solid var(--card-border)',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </div>

            <div style={{
              padding: '16px 24px',
              backgroundColor: '#F9FAFB',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}>
              <button
                type="button"
                onClick={() => setShowBulkDeleteModal(false)}
                disabled={isBulkDeleting}
                className="btn btn-secondary"
              >
                {t('commonCancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={handleConfirmBulkDelete}
                disabled={isBulkDeleting || bulkDeleteConfirmText !== 'DELETE'}
                style={{
                  backgroundColor: bulkDeleteConfirmText === 'DELETE' ? '#DC2626' : '#9CA3AF',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: bulkDeleteConfirmText === 'DELETE' && !isBulkDeleting ? 'pointer' : 'not-allowed',
                  opacity: isBulkDeleting ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={15} />
                <span>{isBulkDeleting ? (t('btnDeleting') || 'Đang xóa...') : (t('btnConfirmDelete') || 'Xóa Vĩnh Viễn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Events Confirmation Dialog */}
      {clearingEventsVideo && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '20px 24px',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--card-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#FFEDD5',
                  color: '#EA580C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Eraser size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#EA580C' }}>
                    {t('deleteRawEventsTitle') || 'Xóa Sự Kiện Đã Trích Xuất'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {clearingEventsVideo.teacher_id} — {clearingEventsVideo.title}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setClearingEventsVideo(null)}
                disabled={isClearingEvents}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', borderRadius: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{
                backgroundColor: '#FFF7ED',
                border: '1px solid #FED7AA',
                borderRadius: '6px',
                padding: '12px 14px',
                fontSize: '13px',
                color: '#9A3412',
                lineHeight: 1.5,
              }}>
                {t('deleteRawEventsWarning') || 'Hành động này sẽ xóa toàn bộ sự kiện, khớp tiêu chí và báo cáo, đưa video về trạng thái đã cắt đoạn (chunked). Video gốc và các video chunk vẫn được giữ nguyên.'}
              </div>

              {clearingEventsError && (
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
                  <span>{clearingEventsError}</span>
                </div>
              )}
            </div>

            <div style={{
              padding: '16px 24px',
              backgroundColor: '#F9FAFB',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
            }}>
              <button
                type="button"
                onClick={() => setClearingEventsVideo(null)}
                disabled={isClearingEvents}
                className="btn btn-secondary"
              >
                {t('commonCancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={handleConfirmClearEvents}
                disabled={isClearingEvents}
                style={{
                  backgroundColor: '#EA580C',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isClearingEvents ? 'not-allowed' : 'pointer',
                  opacity: isClearingEvents ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Eraser size={15} />
                <span>{isClearingEvents ? (t('btnDeleting') || 'Đang xóa...') : (t('btnConfirmDeleteEvents') || 'Xóa Sự Kiện')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

