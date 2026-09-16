'use client';

import React, { useEffect, useState } from 'react';
import { Theme, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { ThemeTree } from '@/components/ThemeTree';
import { Sparkles, Network, RefreshCw, Layers, Trash2, AlertCircle, X } from 'lucide-react';

export default function ThemesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [latestRun, setLatestRun] = useState<{ id: string; status: string; triggered_at: string; completed_at?: string } | null>(null);
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false);
  const [isDeletingRun, setIsDeletingRun] = useState(false);
  const [deleteRunError, setDeleteRunError] = useState<string | null>(null);

  const fetchThemes = async () => {
    try {
      setLoading(true);
      // Try to load latest run
      const run = await api.getLatestAnalysisRun();
      setLatestRun(run);
      if (run) {
        const data = await api.getThemes(run.id);
        setThemes(data);
      } else {
        const data = await api.getThemes('default');
        setThemes(data);
      }
    } catch (err: any) {
      setThemes([]);
      toast.error(err?.message || 'Không thể tải danh sách Themes từ hệ thống.', {
        title: 'Tải dữ liệu thất bại',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchThemes();
  }, []);

  const handleRunAnalysis = async () => {
    const toastId = toast.loading('Đang khởi chạy phân tích Grounded Theory trên 24 bài giảng...', {
      title: 'Bắt đầu phân tích',
    });
    try {
      setRunning(true);
      const res = await api.runAnalysis();
      toast.update(toastId, {
        type: 'success',
        title: 'Phân tích đang hoạt động',
        message: `Đợt phân tích ID: ${res.id}. Hệ thống đang quy nạp các cụm chiến lược & chủ đề giảng dạy.`,
        duration: 4500,
      });
      fetchThemes();
    } catch (err: any) {
      toast.update(toastId, {
        type: 'error',
        title: 'Lỗi phân tích',
        message: err.message || 'Không thể khởi chạy phân tích chiến lược',
        duration: 4000,
      });
    } finally {
      setRunning(false);
    }
  };

  const handleDeleteRun = async () => {
    if (!latestRun) return;
    try {
      setIsDeletingRun(true);
      setDeleteRunError(null);
      await api.deleteAnalysisRun(latestRun.id);
      toast.success(`Run ${latestRun.id.slice(0, 8)} removed`, {
        title: t('deleteAnalysisRunSuccess') || 'Đã xóa đợt phân tích thành công!',
      });
      setShowDeleteRunModal(false);

      setLatestRun(null);
      setThemes([]);
    } catch (err: any) {
      setDeleteRunError(err.message || 'Failed to delete analysis run');
    } finally {
      setIsDeletingRun(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--card-border)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 400,
              color: 'var(--accent)',
            }}>
              {t('themesTitle')}
            </h2>
            <span className="badge badge-theme">{t('themesBadge')}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {t('themesDesc')}
          </p>
          {latestRun && (
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
              <span className={`badge ${latestRun.status === 'completed' ? 'badge-confirmed' : 'badge-draft'}`}>
                {latestRun.status}
              </span>
              <span>Run ID: <code>{latestRun.id.slice(0, 8)}</code></span>
              <span>•</span>
              <span>{new Date(latestRun.triggered_at).toLocaleString()}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {latestRun && (
            <button
              onClick={() => {
                setDeleteRunError(null);
                setShowDeleteRunModal(true);
              }}
              disabled={running || isDeletingRun}
              className="btn"
              style={{
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
              }}
              title={t('deleteAnalysisRun') || 'Delete Analysis Run'}
            >
              <Trash2 size={15} />
              <span>{t('deleteAnalysisRun') || 'Delete Run'}</span>
            </button>
          )}

          <button
            onClick={handleRunAnalysis}
            disabled={running}
            className="btn btn-primary"
          >
            <Sparkles size={16} />
            <span>{running ? t('commonInProgress') : t('runPhase6')}</span>
          </button>
        </div>
      </div>

      {/* Teaching Themes List */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '24px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--accent)" />
            <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
              {t('themesListTitle')} ({themes.length})
            </h3>
          </div>
          <button onClick={fetchThemes} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} />
            <span>{t('commonRefresh')}</span>
          </button>
        </div>

        <ThemeTree themes={themes} onRefresh={fetchThemes} />
      </div>

      {/* Delete Analysis Run Modal */}
      {showDeleteRunModal && latestRun && (
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
                    {t('deleteAnalysisRunTitle') || 'Xóa Đợt Phân Tích Grounded Theory'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {t('deleteVideoWarning') || 'Hành động này không thể khôi phục.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteRunModal(false)}
                disabled={isDeletingRun}
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
                <strong>Run ID: {latestRun.id}</strong> ({latestRun.status})
                <br />
                <span style={{ fontSize: '12px', color: '#991B1B', marginTop: '6px', display: 'block' }}>
                  {t('deleteAnalysisRunWarning') || 'Hành động này sẽ xóa đợt phân tích và toàn bộ patterns, categories, themes, và câu hỏi phỏng vấn giáo viên liên quan.'}
                </span>
              </div>

              {deleteRunError && (
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
                  <span>{deleteRunError}</span>
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
                onClick={() => setShowDeleteRunModal(false)}
                disabled={isDeletingRun}
                className="btn btn-secondary"
              >
                {t('commonCancel') || 'Hủy'}
              </button>
              <button
                type="button"
                onClick={handleDeleteRun}
                disabled={isDeletingRun}
                style={{
                  backgroundColor: '#DC2626',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '8px 16px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isDeletingRun ? 'not-allowed' : 'pointer',
                  opacity: isDeletingRun ? 0.7 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={15} />
                <span>{isDeletingRun ? (t('btnDeleting') || 'Đang xóa...') : (t('btnConfirmDeleteRun') || 'Xóa Đợt Phân Tích')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

