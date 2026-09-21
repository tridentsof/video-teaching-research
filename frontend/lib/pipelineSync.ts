'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, api } from '@/lib/api';
import { FeatureWorkflowKey } from '@/components/FeatureWorkflowBanner';

export type SyncState = 'synced' | 'stale' | 'running_predecessor' | 'initial';

export interface AffectedStepInfo {
  featureKey: FeatureWorkflowKey;
  nameVi: string;
  nameEn: string;
  route: string;
  actionLabelVi: string;
  actionLabelEn: string;
  actionType: 'run_analysis' | 'generate_codebook' | 'navigate';
}

export interface ReanalyzedVideoGroup {
  videoId: string;
  teacherId: string;
  title: string;
  reanalyzedAt: string;
  affectedSteps: AffectedStepInfo[];
}

export const DOWNSTREAM_FEATURES: Record<string, AffectedStepInfo> = {
  codebook: {
    featureKey: 'codebook',
    nameVi: 'Sổ Mã Quan Sát (Codebook)',
    nameEn: 'Qualitative Codebook',
    route: '/codebook',
    actionLabelVi: 'Sinh lại sổ mã',
    actionLabelEn: 'Regenerate Codebook',
    actionType: 'generate_codebook',
  },
  reports: {
    featureKey: 'reports',
    nameVi: 'Báo Cáo Tiết Dạy (Reports)',
    nameEn: 'Individual Lesson Reports',
    route: '/reports',
    actionLabelVi: 'Xem báo cáo mới',
    actionLabelEn: 'View Latest Report',
    actionType: 'navigate',
  },
  analytics: {
    featureKey: 'analytics',
    nameVi: 'Đối Sánh & Xu Hướng (Analytics)',
    nameEn: 'Pedagogical Analytics',
    route: '/analytics',
    actionLabelVi: 'Cập nhật đối sánh',
    actionLabelEn: 'Refresh Analytics',
    actionType: 'navigate',
  },
  themes: {
    featureKey: 'themes',
    nameVi: 'Chủ Đề Cốt Lõi (Teaching Themes)',
    nameEn: 'Teaching Themes Synthesis',
    route: '/themes',
    actionLabelVi: 'Khởi chạy quy nạp lại',
    actionLabelEn: 'Rerun Inductive Synthesis',
    actionType: 'run_analysis',
  },
  interview: {
    featureKey: 'interview',
    nameVi: 'Bộ Câu Hỏi Phỏng Vấn (Interview Studio)',
    nameEn: 'Interview Protocol Studio',
    route: '/interview',
    actionLabelVi: 'Xem & Sinh câu hỏi GV',
    actionLabelEn: 'Review & Generate Questions',
    actionType: 'navigate',
  },
};

const getCheckpointKey = (featureKey: FeatureWorkflowKey, videoId?: string): string => {
  return `pipeline_sync_checkpoint_${featureKey}_${videoId || 'corpus'}`;
};

export const getStoredCheckpoint = (featureKey: FeatureWorkflowKey, videoId?: string): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(getCheckpointKey(featureKey, videoId));
  } catch {
    return null;
  }
};

export const markStepSynced = (featureKey: FeatureWorkflowKey, videoId?: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const nowIso = new Date().toISOString();
    localStorage.setItem(getCheckpointKey(featureKey, videoId), nowIso);
    window.dispatchEvent(new CustomEvent('pipeline-sync-updated', { detail: { featureKey, videoId, syncedAt: nowIso } }));
  } catch {
    // ignore local storage errors
  }
};

export const markVideoReanalyzed = (videoId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const nowIso = new Date().toISOString();
    localStorage.setItem(`pipeline_video_reanalyzed_${videoId}`, nowIso);
    window.dispatchEvent(new CustomEvent('pipeline-sync-updated', { detail: { videoId, reanalyzedAt: nowIso } }));
  } catch {
    // ignore
  }
};

export interface UsePipelineSyncResult {
  syncState: SyncState;
  staleReasonVi: string | null;
  staleReasonEn: string | null;
  reanalyzedCount: number;
  isSyncing: boolean;
  triggerSync: () => Promise<boolean>;
  reanalyzedGroups: ReanalyzedVideoGroup[];
  refresh: () => Promise<void>;
}

export function usePipelineSync(
  featureKey?: FeatureWorkflowKey,
  targetVideoId?: string
): UsePipelineSyncResult {
  const [syncState, setSyncState] = useState<SyncState>('synced');
  const [staleReasonVi, setStaleReasonVi] = useState<string | null>(null);
  const [staleReasonEn, setStaleReasonEn] = useState<string | null>(null);
  const [reanalyzedCount, setReanalyzedCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [reanalyzedGroups, setReanalyzedGroups] = useState<ReanalyzedVideoGroup[]>([]);

  const evaluateSync = useCallback(async () => {
    try {
      const videos = await api.getVideos();
      if (!Array.isArray(videos)) return;

      const runningPredecessors = videos.filter((v) =>
        ['running', 'chunking', 'extracting', 'mapping', 'review_pending'].includes(v.status)
      );

      const completedVideos = videos.filter((v) => v.status === 'report_generated' || v.status === 'completed');

      const groups: ReanalyzedVideoGroup[] = [];
      let staleForCurrentFeature = false;
      let reasonVi: string | null = null;
      let reasonEn: string | null = null;

      completedVideos.forEach((v) => {
        const explicitReanalyzedAt = typeof window !== 'undefined' ? localStorage.getItem(`pipeline_video_reanalyzed_${v.id}`) : null;
        const videoTimestamp = explicitReanalyzedAt || v.updated_at || v.uploaded_at;
        if (!videoTimestamp) return;

        const affected: AffectedStepInfo[] = [];

        // Check Codebook
        const codebookCp = getStoredCheckpoint('codebook', v.id);
        if (!codebookCp || new Date(videoTimestamp) > new Date(codebookCp)) {
          affected.push(DOWNSTREAM_FEATURES.codebook);
        }

        // Check Themes (Corpus-wide)
        const themesCp = getStoredCheckpoint('themes');
        if (!themesCp || new Date(videoTimestamp) > new Date(themesCp)) {
          affected.push(DOWNSTREAM_FEATURES.themes);
        }

        // Check Interview Studio (Corpus-wide)
        const interviewCp = getStoredCheckpoint('interview');
        if (!interviewCp || new Date(videoTimestamp) > new Date(interviewCp)) {
          affected.push(DOWNSTREAM_FEATURES.interview);
        }

        if (affected.length > 0 && explicitReanalyzedAt) {
          groups.push({
            videoId: v.id,
            teacherId: v.teacher_id,
            title: v.title || v.teacher_id,
            reanalyzedAt: videoTimestamp,
            affectedSteps: affected,
          });
        }

        if (featureKey) {
          if (featureKey === 'videos' || featureKey === 'upload' || featureKey === 'checklists') {
            return;
          }

          if (featureKey === 'codebook' || featureKey === 'reports') {
            if (targetVideoId) {
              if (v.id === targetVideoId) {
                const cp = getStoredCheckpoint(featureKey, targetVideoId);
                if (explicitReanalyzedAt && (!cp || new Date(explicitReanalyzedAt) > new Date(cp))) {
                  staleForCurrentFeature = true;
                  reasonVi = `Video "${v.title || v.teacher_id}" vừa được phân tích lại. Bước này cần được đồng bộ lại.`;
                  reasonEn = `Lesson "${v.title || v.teacher_id}" was recently re-analyzed. This step needs to be re-synchronized.`;
                }
              }
            } else if (explicitReanalyzedAt) {
              const cp = getStoredCheckpoint(featureKey, v.id);
              if (!cp || new Date(explicitReanalyzedAt) > new Date(cp)) {
                staleForCurrentFeature = true;
                reasonVi = `Có video (${v.teacher_id}) vừa được phân tích lại. Cần đồng bộ lại sổ mã/báo cáo.`;
                reasonEn = `Video (${v.teacher_id}) was re-analyzed. Downstream step needs re-synchronization.`;
              }
            }
          } else if (['themes', 'analytics', 'interview', 'interview_analysis'].includes(featureKey)) {
            if (explicitReanalyzedAt) {
              const cp = getStoredCheckpoint(featureKey);
              if (!cp || new Date(explicitReanalyzedAt) > new Date(cp)) {
                staleForCurrentFeature = true;
                const timeStr = new Date(explicitReanalyzedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                if (featureKey === 'interview') {
                  reasonVi = `Video của giáo viên "${v.teacher_id}" vừa chạy lại xong lúc ${timeStr}. Bạn có thể sinh lại câu hỏi cho riêng giáo viên ${v.teacher_id} mà không ảnh hưởng đến các giáo viên khác.`;
                  reasonEn = `Lesson for teacher "${v.teacher_id}" finished re-analysis at ${timeStr}. You can regenerate questions specifically for teacher ${v.teacher_id} without affecting other teachers.`;
                } else if (featureKey === 'themes') {
                  reasonVi = `Video "${v.title || v.teacher_id}" vừa chạy lại xong lúc ${timeStr}. Bạn có thể chạy lại quy nạp chủ đề (Teaching Themes) nếu muốn cập nhật khung phân tích toàn cục.`;
                  reasonEn = `Lesson "${v.title || v.teacher_id}" finished re-analysis at ${timeStr}. You can rerun inductive theme synthesis if you wish to update the corpus-wide framework.`;
                } else {
                  reasonVi = `Video "${v.title || v.teacher_id}" vừa chạy lại xong lúc ${timeStr}. Bước "${DOWNSTREAM_FEATURES[featureKey]?.nameVi || featureKey}" có thể cần đồng bộ lại để cập nhật toàn diện.`;
                  reasonEn = `Lesson "${v.title || v.teacher_id}" finished re-analysis at ${timeStr}. Step "${DOWNSTREAM_FEATURES[featureKey]?.nameEn || featureKey}" may need synchronization.`;
                }
              }
            }
          }
        }
      });

      setReanalyzedGroups(groups);
      setReanalyzedCount(groups.length);

      if (runningPredecessors.length > 0 && featureKey && featureKey !== 'videos' && featureKey !== 'upload' && featureKey !== 'checklists') {
        setSyncState('running_predecessor');
        setStaleReasonVi(`Đang có ${runningPredecessors.length} video trong tiến trình phân tích lại. Hãy đợi hoàn tất trước khi đồng bộ.`);
        setStaleReasonEn(`${runningPredecessors.length} video(s) are currently re-analyzing. Please wait for completion before syncing.`);
      } else if (staleForCurrentFeature) {
        setSyncState('stale');
        setStaleReasonVi(reasonVi);
        setStaleReasonEn(reasonEn);
      } else {
        setSyncState('synced');
        setStaleReasonVi(null);
        setStaleReasonEn(null);
      }
    } catch {
      // Fallback silently
    }
  }, [featureKey, targetVideoId]);

  useEffect(() => {
    evaluateSync();
    const handleSyncEvent = () => {
      evaluateSync();
    };

    window.addEventListener('pipeline-sync-updated', handleSyncEvent);
    const interval = setInterval(evaluateSync, 8000);

    return () => {
      window.removeEventListener('pipeline-sync-updated', handleSyncEvent);
      clearInterval(interval);
    };
  }, [evaluateSync]);

  const triggerSync = async (): Promise<boolean> => {
    if (!featureKey) return false;
    setIsSyncing(true);
    try {
      if (featureKey === 'codebook') {
        if (targetVideoId) {
          await api.generateCodebook(targetVideoId);
          markStepSynced('codebook', targetVideoId);
        } else {
          markStepSynced('codebook');
        }
      } else if (featureKey === 'themes') {
        await api.runAnalysis();
        markStepSynced('themes');
      } else if (featureKey === 'interview') {
        markStepSynced('interview');
      } else {
        markStepSynced(featureKey, targetVideoId);
      }

      await evaluateSync();
      return true;
    } catch {
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    syncState,
    staleReasonVi,
    staleReasonEn,
    reanalyzedCount,
    isSyncing,
    triggerSync,
    reanalyzedGroups,
    refresh: evaluateSync,
  };
}
