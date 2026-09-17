'use client';

import React, { useEffect, useState } from 'react';
import { Theme, AnalysisRunItem, api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { ThemeTree } from '@/components/ThemeTree';
import { FeatureWorkflowBanner } from '@/components/FeatureWorkflowBanner';
import {
  Sparkles,
  RefreshCw,
  Layers,
  Trash2,
  AlertCircle,
  X,
  CheckCircle2,
  Loader2,
  Clock,
  History,
  Eye,
  Calendar,
} from 'lucide-react';

const STAGES = [
  { key: 'aggregating', labelVi: '1. Tổng hợp dữ liệu', labelEn: '1. Data Aggregation', descVi: '24 Videos & 696 items', descEn: '24 Videos & 696 items' },
  { key: 'detecting', labelVi: '2. Nhận diện Patterns', labelEn: '2. Pattern Detection', descVi: 'Tần suất & Phân bố', descEn: 'Frequency & Distribution' },
  { key: 'categorizing', labelVi: '3. Grounded Theory', labelEn: '3. Grounded Theory', descVi: 'Quy nạp Cụm & Chủ đề', descEn: 'Clustering & Themes' },
  { key: 'synthesizing_core', labelVi: '4. Tổng hợp câu hỏi', labelEn: '4. Core Synthesis', descVi: '22 câu hỏi RQ1–RQ3', descEn: '22 canonical questions' },
  { key: 'generating', labelVi: '5. Hồ sơ giáo viên', labelEn: '5. Teacher Profiles', descVi: '7 Giáo viên & Dẫn chứng', descEn: '7 Teachers with Evidence' },
];

const getStageIndex = (status?: string) => {
  switch (status) {
    case 'aggregating': return 0;
    case 'detecting': return 1;
    case 'categorizing': return 2;
    case 'synthesizing_core': return 3;
    case 'generating': return 4;
    case 'completed': return 5;
    default: return -1;
  }
};

const formatDuration = (triggeredAt: string, completedAt?: string) => {
  if (!completedAt) return null;
  const start = new Date(triggeredAt).getTime();
  const end = new Date(completedAt).getTime();
  const diffSec = Math.max(0, Math.floor((end - start) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return `${m}m ${s}s`;
};

export default function ThemesPage() {
  const { language, t } = useTranslation();
  const toast = useToast();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  // Versioning & Runs state
  const [runsList, setRunsList] = useState<AnalysisRunItem[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [latestRun, setLatestRun] = useState<AnalysisRunItem | null>(null);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Delete modal state
  const [showDeleteRunModal, setShowDeleteRunModal] = useState(false);
  const [runToDelete, setRunToDelete] = useState<AnalysisRunItem | null>(null);
  const [isDeletingRun, setIsDeletingRun] = useState(false);
  const [deleteRunError, setDeleteRunError] = useState<string | null>(null);

  const [elapsedSec, setElapsedSec] = useState(0);

  // Active run currently being viewed
  const currentViewRun = runsList.find((r) => r.id === selectedRunId)
    || (latestRun && latestRun.id === selectedRunId ? latestRun : null)
    || runsList[0]
    || latestRun;

  const isRunActive = Boolean(
    latestRun && ['aggregating', 'detecting', 'categorizing', 'synthesizing_core', 'generating'].includes(latestRun.status)
  );

  // Load runs list and themes
  const fetchData = async (preferredRunId?: string) => {
    try {
      setLoading(true);
      const [runs, latest] = await Promise.all([
        api.listAnalysisRuns(),
        api.getLatestAnalysisRun(),
      ]);

      setRunsList(runs || []);
      setLatestRun(latest);

      // Determine active target run ID
      let targetId: string | null = null;
      const storedRunId = typeof window !== 'undefined' ? localStorage.getItem('active_theme_run_id') : null;
      if (preferredRunId && runs?.some((r) => r.id === preferredRunId)) {
        targetId = preferredRunId;
      } else if (storedRunId && runs?.some((r) => r.id === storedRunId)) {
        targetId = storedRunId;
      } else if (selectedRunId && runs?.some((r) => r.id === selectedRunId)) {
        targetId = selectedRunId;
      } else if (latest?.id) {
        targetId = latest.id;
      } else if (runs && runs.length > 0) {
        targetId = runs[0].id;
      }

      setSelectedRunId(targetId);
      if (targetId && typeof window !== 'undefined') {
        localStorage.setItem('active_theme_run_id', targetId);
      }

      if (targetId) {
        const data = await api.getThemes(targetId);
        setThemes(data || []);
      } else {
        const data = await api.getThemes('default');
        setThemes(data || []);
      }
    } catch (err: any) {
      setThemes([]);
      toast.error(err?.message || (language === 'vi' ? 'Không thể tải danh sách Themes từ hệ thống.' : 'Failed to load Teaching Themes.'), {
        title: language === 'vi' ? 'Tải dữ liệu thất bại' : 'Load Error',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadThemesForRun = async (runId: string) => {
    try {
      setLoading(true);
      setSelectedRunId(runId);
      if (typeof window !== 'undefined') {
        localStorage.setItem('active_theme_run_id', runId);
      }
      const data = await api.getThemes(runId);
      setThemes(data || []);
    } catch (err: any) {
      toast.error(err?.message || (language === 'vi' ? 'Không thể tải themes của phiên này.' : 'Failed to load themes for this run.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRun = (runId: string) => {
    loadThemesForRun(runId);
    setShowHistoryModal(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('active_theme_run_id', runId);
    }
    const target = runsList.find((r) => r.id === runId);
    if (target) {
      toast.info(
        language === 'vi'
          ? `Đang xem kết quả phân tích phiên ID: ${target.id.slice(0, 8)} (${target.theme_count ?? 0} Themes)`
          : `Switched to analysis run ${target.id.slice(0, 8)} (${target.theme_count ?? 0} Themes)`,
        { title: language === 'vi' ? 'Chuyển phiên phân tích' : 'Switched Run', duration: 3000 }
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Timer for active background runs
  useEffect(() => {
    let timer: any = null;
    if (isRunActive) {
      const startTime = latestRun?.triggered_at ? new Date(latestRun.triggered_at).getTime() : Date.now();
      timer = setInterval(() => {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - startTime) / 1000)));
      }, 1000);
    } else {
      setElapsedSec(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunActive, latestRun?.triggered_at]);

  // Polling loop for active background runs
  useEffect(() => {
    let interval: any = null;
    if (isRunActive || running) {
      interval = setInterval(async () => {
        try {
          const run = await api.getLatestAnalysisRun();
          if (run) {
            setLatestRun(run);
            if (run.status === 'completed') {
              setRunning(false);
              // Refresh runs and auto-select newly completed run
              await fetchData(run.id);
              toast.success(
                language === 'vi' ? 'Quy nạp Grounded Theory & Chiến lược hoàn tất thành công!' : 'Grounded Theory & Thematic analysis completed!',
                { title: language === 'vi' ? 'Phân tích hoàn tất' : 'Analysis Completed' }
              );
            } else if (run.status === 'error') {
              setRunning(false);
              toast.error(
                run.error_msg || (language === 'vi' ? 'Đợt phân tích gặp lỗi.' : 'Analysis encountered an error.'),
                { title: language === 'vi' ? 'Lỗi phân tích' : 'Analysis Error' }
              );
            }
          }
        } catch {
          // ignore transient poll error
        }
      }, 2500);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunActive, running, language]);

  const handleRunAnalysis = async () => {
    try {
      setRunning(true);
      const res = await api.runAnalysis();
      toast.info(
        language === 'vi'
          ? `Đợt phân tích ID: ${res.id.slice(0, 8)}. Hệ thống đang xử lý nền qua 5 giai đoạn.`
          : `Run ID: ${res.id.slice(0, 8)}. Background analysis started across 5 stages.`,
        {
          title: language === 'vi' ? 'Đã khởi chạy' : 'Analysis Started',
          duration: 4500,
        }
      );
      setLatestRun({ id: res.id, status: res.status || 'aggregating', triggered_at: new Date().toISOString() });
    } catch (err: any) {
      setRunning(false);
      if (err.message && err.message.includes('already in progress')) {
        toast.warning(
          language === 'vi' ? 'Một đợt phân tích đang hoạt động. Vui lòng theo dõi tiến trình.' : 'An analysis run is already in progress.',
          { title: language === 'vi' ? 'Đang chạy' : 'Already Running' }
        );
        fetchData();
      } else {
        toast.error(err.message || (language === 'vi' ? 'Không thể khởi chạy phân tích' : 'Failed to start analysis'), {
          title: language === 'vi' ? 'Lỗi khởi chạy' : 'Start Error',
        });
      }
    }
  };

  const openDeleteModal = (run: AnalysisRunItem) => {
    setRunToDelete(run);
    setDeleteRunError(null);
    setShowDeleteRunModal(true);
  };

  const handleDeleteRun = async () => {
    if (!runToDelete) return;
    try {
      setIsDeletingRun(true);
      setDeleteRunError(null);
      await api.deleteAnalysisRun(runToDelete.id);
      toast.success(
        language === 'vi' ? `Đã xóa đợt phân tích ${runToDelete.id.slice(0, 8)}` : `Run ${runToDelete.id.slice(0, 8)} removed`,
        {
          title: t('deleteAnalysisRunSuccess'),
        }
      );
      setShowDeleteRunModal(false);

      // Refresh list, switch to next available if current run was deleted
      const updatedList = runsList.filter((r) => r.id !== runToDelete.id);
      setRunsList(updatedList);

      const nextTargetId = runToDelete.id === selectedRunId
        ? (updatedList.length > 0 ? updatedList[0].id : null)
        : selectedRunId;

      if (nextTargetId) {
        await loadThemesForRun(nextTargetId);
      } else {
        setSelectedRunId(null);
        setThemes([]);
      }
      setRunToDelete(null);
    } catch (err: any) {
      setDeleteRunError(err.message || (language === 'vi' ? 'Không thể xóa đợt phân tích' : 'Failed to delete analysis run'));
    } finally {
      setIsDeletingRun(false);
    }
  };

  const currentStageIdx = getStageIndex(latestRun?.status);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: '16px',
        borderBottom: '1px solid var(--card-border)',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '32px',
              fontWeight: 400,
              color: 'var(--accent)',
              margin: 0,
            }}>
              {t('themesTitle')}
            </h2>
            <span className="badge badge-theme">{t('themesBadge')}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, marginTop: '4px' }}>
            {t('themesDesc')}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn btn-secondary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              padding: '8px 14px',
            }}
          >
            <History size={15} />
            <span>{t('runHistoryBtn')} ({runsList.length})</span>
          </button>

          <button
            onClick={handleRunAnalysis}
            disabled={running || isRunActive}
            className="btn btn-primary"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              padding: '8px 16px',
              opacity: (running || isRunActive) ? 0.8 : 1,
              cursor: (running || isRunActive) ? 'not-allowed' : 'pointer',
            }}
          >
            {running || isRunActive ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>{language === 'vi' ? `Đang xử lý (${elapsedSec}s)...` : `Processing (${elapsedSec}s)...`}</span>
              </>
            ) : (
              <>
                <Sparkles size={15} />
                <span>{t('runPhase6')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* VERSION SELECTOR BAR (OPTION 1) */}
      <div style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '12px 18px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
      }}>
        {/* Left: Select run dropdown & status tag */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <Calendar size={14} color="var(--accent)" />
            {t('activeRunLabel') || 'Phiên Phân Tích'}:
          </span>

          {runsList.length > 0 ? (
            <select
              value={currentViewRun?.id || ''}
              onChange={(e) => handleSelectRun(e.target.value)}
              disabled={loading}
              style={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #CBD5E1',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {runsList.map((r, idx) => {
                const runNum = runsList.length - idx;
                const isLatest = r.id === latestRun?.id;
                const dateStr = new Date(r.triggered_at).toLocaleString();
                const thCount = r.theme_count ?? 0;
                return (
                  <option key={r.id} value={r.id}>
                    Run #{runNum} • {dateStr} ({thCount} Themes) {isLatest ? (language === 'vi' ? '★ Mới nhất' : '★ Latest') : ''}
                  </option>
                );
              })}
            </select>
          ) : (
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('noRunsFound') || 'Chưa có phiên phân tích nào'}
            </span>
          )}

          {currentViewRun && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className={`badge ${currentViewRun.status === 'completed' ? 'badge-confirmed' : currentViewRun.status === 'error' ? 'badge-failed' : 'badge-draft'}`}>
                {currentViewRun.status}
              </span>
              <span style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: '12px',
                backgroundColor: '#EFF6FF',
                color: '#2563EB',
                border: '1px solid #BFDBFE',
                fontWeight: 600,
              }}>
                {t('viewingRun') || 'Đang xem'}
              </span>
              {currentViewRun.id === latestRun?.id && (
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  border: '1px solid #FDE68A',
                  fontWeight: 600,
                }}>
                  {t('latestRunLabel') || 'Mới nhất'}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Right: Quick metrics & action button */}
        {currentViewRun && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            <div>
              <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-mono)' }}>
                {currentViewRun.theme_count ?? themes.length}
              </strong> Themes •{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {currentViewRun.category_count ?? '—'}
              </strong> Cụm •{' '}
              <strong style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {currentViewRun.pattern_count ?? '—'}
              </strong> Chiến lược
            </div>

            <button
              onClick={() => openDeleteModal(currentViewRun)}
              disabled={running || isRunActive || isDeletingRun}
              className="btn btn-sm"
              style={{
                backgroundColor: '#FEE2E2',
                color: '#DC2626',
                border: '1px solid #FECACA',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                cursor: (running || isRunActive || isDeletingRun) ? 'not-allowed' : 'pointer',
                opacity: (running || isRunActive || isDeletingRun) ? 0.6 : 1,
              }}
              title={t('deleteAnalysisRun') || 'Xóa phiên'}
            >
              <Trash2 size={13} />
              <span>{t('deleteAnalysisRun') || 'Xóa phiên'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Feature Workflow & Automation Guidance */}
      <FeatureWorkflowBanner featureKey="themes" />

      {/* Real-time Progress Stepper for Active Runs */}
      {(isRunActive || running) && (
        <div style={{
          backgroundColor: '#F8FAFC',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '20px 24px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={18} className="animate-spin" color="var(--accent)" />
              <h4 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                {language === 'vi' ? 'Tiến trình Phân tích Grounded Theory (Background Worker)' : 'Grounded Theory Analysis Progress'}
              </h4>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--accent)', fontWeight: 600 }}>
              <Clock size={15} />
              <span>{elapsedSec}s</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
            {STAGES.map((stage, idx) => {
              const isCurrent = idx === currentStageIdx;
              const isDone = idx < currentStageIdx;

              return (
                <div
                  key={stage.key}
                  style={{
                    backgroundColor: isCurrent ? '#EFF6FF' : '#FFFFFF',
                    border: `1px solid ${isCurrent ? '#BFDBFE' : '#E2E8F0'}`,
                    borderRadius: '8px',
                    padding: '12px',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {isDone ? (
                      <CheckCircle2 size={16} color="#16A34A" />
                    ) : isCurrent ? (
                      <Loader2 size={16} color="#2563EB" className="animate-spin" />
                    ) : (
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1' }} />
                    )}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: isCurrent ? 700 : 600,
                      color: isCurrent ? '#1D4ED8' : isDone ? '#15803D' : 'var(--text-muted)',
                    }}>
                      {language === 'vi' ? stage.labelVi : stage.labelEn}
                    </span>
                  </div>
                  <p style={{
                    fontSize: '11px',
                    color: isCurrent ? '#3B82F6' : 'var(--text-muted)',
                    margin: 0,
                    paddingLeft: '24px',
                  }}>
                    {language === 'vi' ? stage.descVi : stage.descEn}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
            <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
              {t('themesListTitle')} ({themes.length})
            </h3>
            {currentViewRun && (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                — Run ID: <code style={{ fontSize: '12px' }}>{currentViewRun.id.slice(0, 8)}</code>
              </span>
            )}
          </div>
          <button onClick={() => selectedRunId && loadThemesForRun(selectedRunId)} className="btn btn-secondary btn-sm">
            <RefreshCw size={13} />
            <span>{t('commonRefresh')}</span>
          </button>
        </div>

        <ThemeTree themes={themes} onRefresh={() => selectedRunId && loadThemesForRun(selectedRunId)} />
      </div>

      {/* MODAL: RUNS HISTORY TABLE (OPTION 1 DETAIL) */}
      {showHistoryModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1050,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '920px',
            maxHeight: '90vh',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#FEF3C7',
                  color: '#B45309',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <History size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    {t('runHistoryTitle')}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    {t('runHistorySubtitle')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '6px', borderRadius: '6px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Table Content */}
            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: '10px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '12px', textTransform: 'uppercase' }}>
                      <th style={{ padding: '12px 16px' }}>Phiên Chạy (Run)</th>
                      <th style={{ padding: '12px 16px' }}>{t('runTriggeredAt')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>Trạng Thái</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>{t('themesFoundCount')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>{t('categoriesFoundCount')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'center' }}>{t('strategiesFoundCount')}</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>{t('runActions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runsList.length === 0 ? (
                      <tr>
                        <td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          {t('noRunsFound') || 'Chưa có dữ liệu đợt phân tích'}
                        </td>
                      </tr>
                    ) : (
                      runsList.map((run, idx) => {
                        const runNum = runsList.length - idx;
                        const isSelected = run.id === selectedRunId;
                        const isLatest = run.id === latestRun?.id;
                        const duration = formatDuration(run.triggered_at, run.completed_at);

                        return (
                          <tr
                            key={run.id}
                            style={{
                              borderBottom: '1px solid #F1F5F9',
                              backgroundColor: isSelected ? 'rgba(217, 119, 6, 0.06)' : 'transparent',
                              borderLeft: isSelected ? '4px solid var(--accent)' : '4px solid transparent',
                              transition: 'background-color 0.15s',
                            }}
                          >
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>#{runNum}</strong>
                                <code style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{run.id.slice(0, 8)}</code>
                                {isSelected && (
                                  <span style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    backgroundColor: '#EFF6FF',
                                    color: '#2563EB',
                                    fontWeight: 700,
                                  }}>
                                    {t('viewingRun')}
                                  </span>
                                )}
                                {isLatest && (
                                  <span style={{
                                    fontSize: '10px',
                                    padding: '1px 6px',
                                    borderRadius: '10px',
                                    backgroundColor: '#FEF3C7',
                                    color: '#B45309',
                                    fontWeight: 700,
                                  }}>
                                    {t('latestRunLabel')}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px' }}>
                              <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                {new Date(run.triggered_at).toLocaleDateString()} {new Date(run.triggered_at).toLocaleTimeString()}
                              </div>
                              {duration && (
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                  {t('runDuration')}: {duration}
                                </div>
                              )}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                              <span className={`badge ${run.status === 'completed' ? 'badge-confirmed' : run.status === 'error' ? 'badge-failed' : 'badge-draft'}`}>
                                {run.status}
                              </span>
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: '14px' }}>
                              {run.theme_count ?? 0}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                              {run.category_count ?? '—'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                              {run.pattern_count ?? '—'}
                            </td>
                            <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                {isSelected ? (
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)', padding: '4px 8px' }}>
                                    ✓ {t('viewingRun')}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleSelectRun(run.id)}
                                    className="btn btn-secondary btn-sm"
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      fontSize: '12px',
                                      padding: '4px 10px',
                                    }}
                                  >
                                    <Eye size={13} />
                                    <span>{t('viewThisRun')}</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => openDeleteModal(run)}
                                  disabled={isRunActive || running}
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    color: '#94A3B8',
                                    padding: '5px',
                                    borderRadius: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                  }}
                                  title={t('deleteAnalysisRun') || 'Xóa'}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = '#DC2626')}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = '#94A3B8')}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 24px',
              backgroundColor: '#F8FAFC',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {t('totalRunsCount')}: <strong>{runsList.length}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="btn btn-secondary"
                style={{ padding: '6px 16px' }}
              >
                {t('commonClose') || 'Đóng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Analysis Run Modal */}
      {showDeleteRunModal && runToDelete && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100,
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
                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#DC2626', margin: 0 }}>
                    {t('deleteAnalysisRunTitle') || 'Xóa Đợt Phân Tích Grounded Theory'}
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
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
                <strong>Run ID: {runToDelete.id}</strong> ({runToDelete.status})
                <br />
                <span style={{ fontSize: '12px', color: '#991B1B', marginTop: '6px', display: 'block' }}>
                  {t('deleteAnalysisRunWarning') || 'Hành động này sẽ xóa đợt phân tích và toàn bộ patterns, categories, themes liên quan.'}
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
