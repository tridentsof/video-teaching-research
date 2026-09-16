'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Video, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import {
  FileDown,
  ArrowRight,
  Loader2,
  FileCheck,
  GraduationCap,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  generateCombinedWordReport,
  downloadBlob,
  ExportReportData,
} from '@/lib/wordExport';

export default function ReportsIndexPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);

  // Batch export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{
    current: number;
    total: number;
    stage: 'fetching' | 'packing';
    currentTitle?: string;
  } | null>(null);

  useEffect(() => {
    api.getVideos()
      .then((data) => {
        setVideos(data.filter((v) => v.status === 'report_generated'));
      })
      .catch(() => {
        setVideos([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Sort videos: Group/Sort by Teacher ID, then chronologically by video upload/lesson date
  const sortedVideos = useMemo(() => {
    return [...videos].sort((a, b) => {
      // 1. Sort by Teacher ID (natural sort: T01 < T02 < T10)
      const teacherCompare = (a.teacher_id || '').localeCompare(b.teacher_id || '', undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (teacherCompare !== 0) return teacherCompare;

      // 2. Sort chronologically by date/time (Oldest to Newest)
      const timeA = new Date(a.uploaded_at || 0).getTime();
      const timeB = new Date(b.uploaded_at || 0).getTime();
      if (timeA !== timeB) return timeA - timeB;

      // 3. Fallback to lesson title
      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true });
    });
  }, [videos]);

  // Unique teacher count for stats
  const uniqueTeachers = useMemo(() => {
    return Array.from(new Set(sortedVideos.map((v) => v.teacher_id).filter(Boolean)));
  }, [sortedVideos]);

  const handleExportAll = async () => {
    if (sortedVideos.length === 0) {
      toast.warning(t('reportsNoReportsToExport'));
      return;
    }

    setIsExporting(true);
    setExportProgress({
      current: 0,
      total: sortedVideos.length,
      stage: 'fetching',
      currentTitle: '',
    });

    try {
      const exportDataList: ExportReportData[] = [];

      for (let i = 0; i < sortedVideos.length; i++) {
        const v = sortedVideos[i];
        setExportProgress({
          current: i + 1,
          total: sortedVideos.length,
          stage: 'fetching',
          currentTitle: `${v.teacher_id} — ${v.title}`,
        });

        try {
          const report = await api.getReport(v.id);
          exportDataList.push({
            report,
            video: v,
            observationNo: `#${v.id.slice(0, 8)}`,
            className: 'Online English Class',
            platform: 'Zoom',
            generalNotes:
              'Teacher maintains warm, energetic classroom rapport with strong use of positive reinforcement and multi-modal digital tools. Pacing and wait time effectively support second language acquisition for young learners.',
          });
        } catch (fetchErr) {
          console.warn(`Failed to fetch report for video ${v.id}:`, fetchErr);
        }
      }

      if (exportDataList.length === 0) {
        toast.error('Could not retrieve observation reports for any video.');
        return;
      }

      // Step 2: Packing Word Document with Cover & TOC
      setExportProgress({
        current: exportDataList.length,
        total: exportDataList.length,
        stage: 'packing',
      });

      const blob = await generateCombinedWordReport(exportDataList);
      const dateStamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 12);
      const filename = `Combined_Observation_Reports_${dateStamp}.docx`;

      downloadBlob(blob, filename);
      toast.success(t('reportsExportAllSuccess'));
    } catch (err: any) {
      console.error('Batch export failed:', err);
      toast.error(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Header with Title and Export All Button */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '36px',
            fontWeight: 400,
            color: 'var(--accent)',
            letterSpacing: '-0.02em',
          }}>
            {t('navReports')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px', maxWidth: '680px' }}>
            {t('reportsDesc')}
          </p>
        </div>

        {/* Batch Export Action Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={handleExportAll}
            disabled={loading || isExporting || sortedVideos.length === 0}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '10px',
              backgroundColor: isExporting || sortedVideos.length === 0 ? 'var(--text-muted)' : 'var(--accent)',
              color: '#FFFFFF',
              padding: '11px 22px',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              fontWeight: 600,
              border: 'none',
              cursor: isExporting || sortedVideos.length === 0 ? 'not-allowed' : 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.18s ease',
              opacity: sortedVideos.length === 0 && !loading ? 0.6 : 1,
            }}
          >
            {isExporting ? (
              <>
                <Loader2 size={17} className="animate-spin" />
                <span>{t('reportsExportingAllWord')}</span>
              </>
            ) : (
              <>
                <FileDown size={17} />
                <span>{t('reportsExportAllWord')}</span>
                {sortedVideos.length > 0 && (
                  <span style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    padding: '2px 8px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                  }}>
                    {sortedVideos.length}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export Progress Notification Banner */}
      {isExporting && exportProgress && (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          animation: 'fadeIn 0.2s ease-in-out',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={18} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <strong style={{ fontSize: '14.5px', color: 'var(--text-main)' }}>
                {exportProgress.stage === 'fetching'
                  ? `${t('reportsExportProgressFetching')} (${exportProgress.current}/${exportProgress.total})`
                  : t('reportsExportProgressCompiling')}
              </strong>
            </div>
            <span style={{
              fontSize: '13px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: 'var(--accent)',
            }}>
              {Math.round((exportProgress.current / (exportProgress.total || 1)) * 100)}%
            </span>
          </div>

          {/* Progress Bar */}
          <div style={{
            height: '6px',
            backgroundColor: 'var(--card-border-soft)',
            borderRadius: '999px',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.round((exportProgress.current / (exportProgress.total || 1)) * 100)}%`,
              backgroundColor: 'var(--accent)',
              borderRadius: '999px',
              transition: 'width 0.25s ease',
            }} />
          </div>

          {exportProgress.currentTitle && (
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
              {exportProgress.currentTitle}
            </p>
          )}
        </div>
      )}

      {/* Reports Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: '18px',
      }}>
        {sortedVideos.length === 0 && !loading && (
          <Link
            href="/reports/00000000-0000-0000-0000-000000000001"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-audio">Teacher T01</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                Sample Report
              </span>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
              Phonics & Turn-Taking (Sample Observation Checklist)
            </h3>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto',
              paddingTop: '12px',
              borderTop: '1px solid var(--card-border-soft)',
              color: 'var(--accent)',
              fontWeight: 600,
              fontSize: '13px',
            }}>
              <span>{t('reportsReadFull')}</span>
              <ArrowRight size={15} />
            </div>
          </Link>
        )}

        {sortedVideos.map((v) => (
          <Link
            key={v.id}
            href={`/reports/${v.id}`}
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="badge badge-audio">{v.teacher_id}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {v.uploaded_at ? new Date(v.uploaded_at).toLocaleDateString() : t('reportsVersion')}
              </span>
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-main)' }}>
              {v.title}
            </h3>

            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 'auto',
              paddingTop: '12px',
              borderTop: '1px solid var(--card-border-soft)',
              color: 'var(--accent)',
              fontWeight: 600,
              fontSize: '13px',
            }}>
              <span>{t('reportsReadFull')}</span>
              <ArrowRight size={15} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
