'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Video, CodebookEntry, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import {
  BookMarked,
  Download,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Search,
  CheckCircle2,
  XCircle,
  Quote,
  Loader2,
  Tag,
  Layers,
  Trash2,
  AlertCircle,
  X,
} from 'lucide-react';


// ─── Column definitions for Research Table ──────────────────────────────────
const COLUMNS: Array<{ key: keyof CodebookEntry; labelKey: string; width: string }> = [
  { key: 'code',               labelKey: 'codebookColCode',       width: '15%' },
  { key: 'definition',         labelKey: 'codebookColDefinition', width: '22%' },
  { key: 'inclusion_criteria', labelKey: 'codebookColInclusion',  width: '17%' },
  { key: 'exclusion_criteria', labelKey: 'codebookColExclusion',  width: '17%' },
  { key: 'example',            labelKey: 'codebookColExample',    width: '17%' },
  { key: 'category',           labelKey: 'codebookColCategory',   width: '12%' },
];

// ─── Per-video codebook state ─────────────────────────────────────────────────
interface VideoCodebook {
  video: Video;
  entries: CodebookEntry[];
  loading: boolean;
  generating: boolean;
  expanded: boolean;
}

// ─── Main Page Component ──────────────────────────────────────────────────────
export default function CodeBookPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [codebooks, setCodebooks] = useState<VideoCodebook[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load all completed videos with reports
  useEffect(() => {
    api.getVideos()
      .then((videos) => {
        const eligible = videos.filter((v) => v.status === 'report_generated');
        setCodebooks(
          eligible.map((video) => ({
            video,
            entries: [],
            loading: false,
            generating: false,
            expanded: false,
          }))
        );
      })
      .catch(() => setCodebooks([]))
      .finally(() => setPageLoading(false));
  }, []);

  // Load codebook for video
  const loadCodebook = useCallback(async (videoId: string) => {
    setCodebooks((prev) =>
      prev.map((cb) => (cb.video.id === videoId ? { ...cb, loading: true } : cb))
    );
    try {
      const entries = await api.getCodebook(videoId);
      setCodebooks((prev) =>
        prev.map((cb) =>
          cb.video.id === videoId
            ? { ...cb, entries: entries.length ? entries : [], loading: false }
            : cb
        )
      );
    } catch {
      setCodebooks((prev) =>
        prev.map((cb) => (cb.video.id === videoId ? { ...cb, loading: false } : cb))
      );
    }
  }, []);

  // Toggle expansion and lazily load codebook entries
  const toggleExpand = useCallback((videoId: string) => {
    setCodebooks((prev) =>
      prev.map((cb) => {
        if (cb.video.id !== videoId) return cb;
        const wasExpanded = cb.expanded;
        if (!wasExpanded && cb.entries.length === 0 && !cb.loading) {
          loadCodebook(videoId);
        }
        return { ...cb, expanded: !wasExpanded };
      })
    );
  }, [loadCodebook]);

  // Trigger AI Generation / Regeneration for a video
  const handleGenerate = async (videoId: string) => {
    setCodebooks((prev) =>
      prev.map((cb) => (cb.video.id === videoId ? { ...cb, generating: true } : cb))
    );
    try {
      const entries = await api.generateCodebook(videoId);
      setCodebooks((prev) =>
        prev.map((cb) =>
          cb.video.id === videoId
            ? { ...cb, entries, generating: false, expanded: true }
            : cb
        )
      );
      toast.success(t('codebookGeneratedSuccess'), { title: 'AI Synthesis' });
    } catch (err: any) {
      setCodebooks((prev) =>
        prev.map((cb) => (cb.video.id === videoId ? { ...cb, generating: false } : cb))
      );
      toast.error(`Generation failed: ${err.message}`, { title: 'Error' });
    }
  };

  // Export all codebooks as Excel
  const handleExport = async () => {
    setExporting(true);
    try {
      const token = api.getToken();
      const url = api.getCodebookExportUrl();
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'codebook_export.xlsx';
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success('Excel file downloaded successfully!', { title: 'Export Complete' });
    } catch (err: any) {
      toast.error(`Export failed: ${err.message}`, { title: 'Export Error' });
    } finally {
      setExporting(false);
    }
  };

  const [deletingVideoId, setDeletingVideoId] = useState<string | null>(null);
  const [isDeletingCodebook, setIsDeletingCodebook] = useState(false);

  const handleDeleteCodebook = async (videoId: string) => {
    try {
      setIsDeletingCodebook(true);
      await api.deleteCodebook(videoId);
      toast.success(t('deleteCodebookSuccess') || 'Đã xóa sổ mã hóa thành công!');
      setCodebooks((prev) =>
        prev.map((item) =>
          item.video.id === videoId ? { ...item, entries: [] } : item
        )
      );
      setDeletingVideoId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to clear codebook');
    } finally {
      setIsDeletingCodebook(false);
    }
  };

  const deletingTarget = codebooks.find((c) => c.video.id === deletingVideoId);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* ── Page Header ────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--card-border)',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div style={{ maxWidth: '800px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <BookMarked size={28} style={{ color: 'var(--accent)' }} />
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '34px',
              fontWeight: 500,
              color: 'var(--accent)',
              lineHeight: 1.1,
              letterSpacing: '-0.02em',
            }}>
              {t('codebookTitle')}
            </h2>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#8A5D3B',
              backgroundColor: '#F7EFE6',
              border: '1px solid #EBDBC8',
              borderRadius: '20px',
              padding: '3px 10px',
            }}>
              <Sparkles size={12} />
              {t('codebookAutoGeneratedBadge')}
            </span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.5 }}>
            {t('codebookDesc')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            id="codebook-export-btn"
            onClick={handleExport}
            disabled={exporting || codebooks.length === 0}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
          >
            <Download size={16} />
            <span>{exporting ? t('codebookExporting') : t('codebookExportExcel')}</span>
          </button>
        </div>
      </div>

      {/* ── Search & Filter Bar ─────────────────────────────────────── */}
      {!pageLoading && codebooks.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '8px 16px',
          boxShadow: 'var(--shadow-sm)',
          gap: '10px',
        }}>
          <Search size={16} style={{ color: 'var(--text-subtle)' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('codebookSearchPlaceholder')}
            style={{
              border: 'none',
              outline: 'none',
              width: '100%',
              fontSize: '13.5px',
              color: 'var(--text-main)',
              background: 'transparent',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-subtle)',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '2px 6px',
              }}
            >
              Clear
            </button>
          )}
        </div>
      )}

      {/* ── Loading State ───────────────────────────────────────────── */}
      {pageLoading && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: 'var(--text-muted)',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
        }}>
          <Loader2 size={20} className="animate-spin" />
          <span>Loading video codebooks…</span>
        </div>
      )}

      {/* ── Empty State ─────────────────────────────────────────────── */}
      {!pageLoading && codebooks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <BookMarked size={40} style={{ color: 'var(--text-subtle)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-main)', fontSize: '16px', fontWeight: 600 }}>{t('codebookNoVideos')}</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '6px' }}>
            Run the analysis pipeline on your uploaded videos to automatically synthesize Code Books.
          </p>
        </div>
      )}

      {/* ── Video Codebook Cards ─────────────────────────────────────── */}
      {codebooks.map((cb) => (
        <VideoCodebookCard
          key={cb.video.id}
          cb={cb}
          t={t}
          searchQuery={searchQuery}
          onToggle={() => toggleExpand(cb.video.id)}
          onGenerate={() => handleGenerate(cb.video.id)}
          onDelete={() => setDeletingVideoId(cb.video.id)}
        />
      ))}

      {/* Delete Codebook Modal */}
      {deletingTarget && (
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
                    {t('deleteCodebookTitle') || 'Xóa Toàn Bộ Mục Sổ Mã Hóa'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('deleteVideoWarning') || 'Hành động này không thể khôi phục.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDeletingVideoId(null)}
                disabled={isDeletingCodebook}
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
                <strong>{deletingTarget.video.teacher_id}</strong> — {deletingTarget.video.title} ({deletingTarget.entries.length} {t('codebookEntriesCount')})
                <br />
                <span style={{ fontSize: '12px', color: '#991B1B', marginTop: '6px', display: 'block' }}>
                  {t('deleteCodebookWarning') || 'Hành động này sẽ xóa toàn bộ mục mã hóa của video này. Bạn có thể dùng AI tạo lại bất cứ lúc nào.'}
                </span>
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
                onClick={() => setDeletingVideoId(null)}
                disabled={isDeletingCodebook}
                className="btn btn-secondary"
              >
                {t('commonCancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCodebook(deletingTarget.video.id)}
                disabled={isDeletingCodebook}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isDeletingCodebook ? 'not-allowed' : 'pointer',
                  opacity: isDeletingCodebook ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={15} />
                <span>{isDeletingCodebook ? (t('btnDeleting') || 'Đang xóa...') : (t('btnConfirmDeleteCodebook') || 'Xóa Sổ Mã Hóa')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Video Codebook Card Component ───────────────────────────────────────────
interface CardProps {
  cb: VideoCodebook;
  t: (key: string) => string;
  searchQuery: string;
  onToggle: () => void;
  onGenerate: () => void;
  onDelete: () => void;
}

function VideoCodebookCard({ cb, t, searchQuery, onToggle, onGenerate, onDelete }: CardProps) {

  // Filter entries based on search query
  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return cb.entries;
    const q = searchQuery.toLowerCase();
    return cb.entries.filter((e) =>
      e.code.toLowerCase().includes(q) ||
      e.definition.toLowerCase().includes(q) ||
      e.inclusion_criteria.toLowerCase().includes(q) ||
      e.exclusion_criteria.toLowerCase().includes(q) ||
      e.example.toLowerCase().includes(q) ||
      e.category.toLowerCase().includes(q) ||
      e.theme.toLowerCase().includes(q)
    );
  }, [cb.entries, searchQuery]);

  return (
    <div style={{
      backgroundColor: '#FFFFFF',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--radius-md)',
      boxShadow: cb.expanded ? 'var(--shadow-md, 0 6px 20px rgba(0,0,0,0.06))' : 'var(--shadow-sm)',
      overflow: 'hidden',
      transition: 'all 0.2s ease',
    }}>
      {/* Card Header */}
      <div
        id={`codebook-toggle-${cb.video.id}`}
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '16px 20px',
          cursor: 'pointer',
          userSelect: 'none',
          backgroundColor: cb.expanded ? '#FCFAF7' : '#FFFFFF',
          borderBottom: cb.expanded ? '1px solid var(--card-border)' : 'none',
          transition: 'background-color 0.15s ease',
        }}
      >
        {/* Chevron */}
        <span style={{ color: 'var(--accent)', flexShrink: 0 }}>
          {cb.expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </span>

        {/* Video Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span className="badge badge-audio" style={{ flexShrink: 0, fontWeight: 700 }}>
              {cb.video.teacher_id}
            </span>
            <span style={{
              fontWeight: 600,
              fontSize: '15px',
              color: 'var(--text-main)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {cb.video.title}
            </span>
            {cb.entries.length > 0 && (
              <span style={{
                fontSize: '11.5px',
                fontWeight: 600,
                color: '#4B5563',
                backgroundColor: '#F3F4F6',
                borderRadius: '12px',
                padding: '2px 8px',
                flexShrink: 0,
              }}>
                {cb.entries.length} {t('codebookEntriesCount')}
              </span>
            )}
          </div>
        </div>

        {/* Action Button */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}
        >
          <button
            id={`codebook-regenerate-${cb.video.id}`}
            onClick={onGenerate}
            disabled={cb.generating || cb.loading}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              padding: '6px 12px',
              borderColor: 'var(--card-border)',
            }}
            title={t('codebookRegenerate')}
          >
            {cb.generating ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Sparkles size={13} style={{ color: 'var(--accent)' }} />
            )}
            <span>{cb.generating ? t('codebookRegenerating') : t('codebookRegenerate')}</span>
          </button>

          {cb.entries.length > 0 && (
            <button
              onClick={onDelete}
              disabled={cb.generating || cb.loading}
              className="btn btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12.5px',
                padding: '6px 10px',
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                cursor: 'pointer',
              }}
              title={t('deleteCodebook') || 'Clear Codebook'}
            >
              <Trash2 size={13} />
              <span>{t('deleteCodebook') || 'Clear'}</span>
            </button>
          )}
        </div>
      </div>


      {/* Card Content Table Body */}
      {cb.expanded && (
        <div>
          {cb.loading || cb.generating ? (
            <div style={{
              padding: '50px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
            }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--accent)' }} />
              <span>
                {cb.generating
                  ? 'Analyzing video evidence and synthesizing Code Book criteria…'
                  : 'Loading observation codes…'}
              </span>
            </div>
          ) : cb.entries.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              backgroundColor: '#FAFAF9',
            }}>
              <p style={{ color: 'var(--text-main)', fontSize: '14.5px', fontWeight: 600 }}>
                {t('codebookNoEntries')}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px', marginBottom: '16px' }}>
                {t('codebookNoEntriesDesc')}
              </p>
              <button
                onClick={onGenerate}
                className="btn btn-primary btn-sm"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Sparkles size={14} />
                <span>{t('codebookGenerateNow')}</span>
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                tableLayout: 'fixed',
                minWidth: '1200px',
              }}>
                <thead>
                  <tr style={{ backgroundColor: '#F8F6F1', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ ...thStyle, width: '40px', textAlign: 'center' }}>#</th>
                    {COLUMNS.map((col) => (
                      <th key={col.key} style={{ ...thStyle, width: col.width }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '0.2px', color: '#4A3B32' }}>
                          {t(col.labelKey)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEntries.map((entry, rowIdx) => (
                    <tr
                      key={rowIdx}
                      style={{
                        backgroundColor: rowIdx % 2 === 0 ? '#FFFFFF' : '#FDFCFB',
                        borderBottom: '1px solid #EFECE6',
                        transition: 'background-color 0.1s ease',
                      }}
                    >
                      {/* Index */}
                      <td style={{
                        ...tdStyle,
                        textAlign: 'center',
                        color: 'var(--text-subtle)',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {rowIdx + 1}
                      </td>

                      {/* Code */}
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <span style={{
                            display: 'inline-block',
                            fontWeight: 700,
                            fontSize: '13.5px',
                            color: '#1F2937',
                            backgroundColor: '#F3F4F6',
                            border: '1px solid #E5E7EB',
                            borderRadius: '4px',
                            padding: '3px 8px',
                            width: 'fit-content',
                            fontFamily: 'var(--font-mono)',
                          }}>
                            {entry.code}
                          </span>
                          {entry.theme && (
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontSize: '11px',
                              color: 'var(--text-muted)',
                            }}>
                              <Layers size={10} style={{ opacity: 0.6 }} />
                              {entry.theme}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Definition */}
                      <td style={tdStyle}>
                        <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#374151', margin: 0 }}>
                          {entry.definition}
                        </p>
                      </td>

                      {/* Inclusion Criteria */}
                      <td style={tdStyle}>
                        <div style={{
                          backgroundColor: 'rgba(16, 185, 129, 0.05)',
                          borderLeft: '3px solid #10B981',
                          borderRadius: '0 4px 4px 0',
                          padding: '6px 10px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <CheckCircle2 size={12} style={{ color: '#059669' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#059669', textTransform: 'uppercase' }}>
                              Inclusion
                            </span>
                          </div>
                          <p style={{ fontSize: '12.5px', lineHeight: 1.45, color: '#1F2937', margin: 0 }}>
                            {entry.inclusion_criteria || '—'}
                          </p>
                        </div>
                      </td>

                      {/* Exclusion Criteria */}
                      <td style={tdStyle}>
                        <div style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.04)',
                          borderLeft: '3px solid #EF4444',
                          borderRadius: '0 4px 4px 0',
                          padding: '6px 10px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                            <XCircle size={12} style={{ color: '#DC2626' }} />
                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase' }}>
                              Exclusion
                            </span>
                          </div>
                          <p style={{ fontSize: '12.5px', lineHeight: 1.45, color: '#1F2937', margin: 0 }}>
                            {entry.exclusion_criteria || '—'}
                          </p>
                        </div>
                      </td>

                      {/* Example */}
                      <td style={tdStyle}>
                        {entry.example ? (
                          <div style={{
                            backgroundColor: '#F9FAFB',
                            border: '1px solid #E5E7EB',
                            borderRadius: '6px',
                            padding: '6px 10px',
                            fontSize: '12.5px',
                            lineHeight: 1.45,
                            color: '#4B5563',
                            fontStyle: 'italic',
                          }}>
                            <Quote size={11} style={{ color: 'var(--accent)', opacity: 0.7, marginBottom: '2px' }} />
                            <div>{entry.example}</div>
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>—</span>
                        )}
                      </td>

                      {/* Category */}
                      <td style={tdStyle}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          color: '#6B46C1',
                          backgroundColor: '#F3E8FF',
                          border: '1px solid #E9D5FF',
                          borderRadius: '12px',
                          padding: '3px 9px',
                        }}>
                          <Tag size={11} />
                          {entry.category || 'General'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Table cell styles ────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '12px 14px',
  textAlign: 'left',
  borderRight: '1px solid #EFECE6',
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '12px 14px',
  borderRight: '1px solid #F3F1ED',
  verticalAlign: 'top',
};

