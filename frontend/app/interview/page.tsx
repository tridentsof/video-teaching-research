'use client';

import React, { useState, useEffect } from 'react';
import { api, InterviewQuestion, TeacherAnalysis } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import {
  Download,
  Sparkles,
  UserCheck,
  Video,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  ExternalLink,
  BookOpen,
} from 'lucide-react';
import Link from 'next/link';

const fallbackCoreQuestions = [
  'Why do you use this strategy?',
  'How do you decide when to use this strategy during a live online lesson?',
  'What challenges or limitations do you face when applying this strategy with young online learners?',
];

const fallbackDynamicQuestions: Record<string, Array<{ text: string; evidence: string }>> = {
  T01: [
    {
      text: 'In video V02 (00:23:15), you waited 7 seconds after asking an open question before nominating a learner. Is this an intentional pacing strategy?',
      evidence: 'Video V02 @ 00:23:15 | +40% above corpus group average wait time',
    },
    {
      text: 'Your praise frequency spikes during phoneme drills (+35%). How do you decide when to offer immediate praise versus delayed corrective feedback?',
      evidence: '18 occurrences across V01 & V02 | Concentrated during phoneme correction',
    },
  ],
  T02: [
    {
      text: 'Across your observed lessons, you utilized sentence starters in 26 instances (+65% vs corpus). What criteria determine when to withdraw this scaffold?',
      evidence: '26 instances across V01 & V02 | Highest in corpus for scaffolding',
    },
  ],
};

export default function InterviewStudioPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [teacherList, setTeacherList] = useState<string[]>([
    'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12',
  ]);
  const [selectedTeacher, setSelectedTeacher] = useState('T01');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [isLiveFromBackend, setIsLiveFromBackend] = useState(false);

  const [coreQuestions, setCoreQuestions] = useState<string[]>(fallbackCoreQuestions);
  const [dynamicQuestions, setDynamicQuestions] = useState<Array<{ text: string; evidence?: string }>>([]);
  const [teacherAnalysis, setTeacherAnalysis] = useState<TeacherAnalysis | null>(null);

  // 1. Fetch teachers from actual uploaded videos & check latest analysis run
  useEffect(() => {
    const initPage = async () => {
      try {
        const videos = await api.getVideos();
        if (videos && videos.length > 0) {
          const uniqueTeachers = Array.from(
            new Set(videos.map((v) => v.teacher_id).filter(Boolean))
          ).sort();
          if (uniqueTeachers.length > 0) {
            setTeacherList(uniqueTeachers);
            if (!uniqueTeachers.includes(selectedTeacher)) {
              setSelectedTeacher(uniqueTeachers[0]);
            }
          }
        }
      } catch {
        // Fallback list
      }

      try {
        const run = await api.getLatestAnalysisRun();
        if (run && run.id) {
          setLatestRunId(run.id);
        }
      } catch {
        // No run yet
      }
    };

    initPage();
  }, []);

  // 2. Fetch teacher-specific analysis & interview questions whenever selectedTeacher changes
  useEffect(() => {
    let isCancelled = false;

    const fetchTeacherData = async () => {
      setLoading(true);
      try {
        const data = await api.getTeacherAnalysis(latestRunId || 'latest', selectedTeacher);
        if (isCancelled) return;

        if (data && data.interview_questions && data.interview_questions.length > 0) {
          const core = data.interview_questions
            .filter((q) => q.type === 'core')
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((q) => q.question_text);

          const dyn = data.interview_questions
            .filter((q) => q.type === 'dynamic')
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((q) => ({ text: q.question_text, evidence: q.evidence_ref }));

          if (core.length > 0) setCoreQuestions(core);
          setDynamicQuestions(dyn);
          setTeacherAnalysis(data.teacher_analysis || null);
          setIsLiveFromBackend(true);
        } else {
          // Fallback to sample questions for this teacher if backend has not run Phase 6
          applyFallback(selectedTeacher);
        }
      } catch {
        if (!isCancelled) {
          applyFallback(selectedTeacher);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    const applyFallback = (tId: string) => {
      setCoreQuestions(fallbackCoreQuestions);
      const fallbackDyn = fallbackDynamicQuestions[tId] || fallbackDynamicQuestions['T01'];
      setDynamicQuestions(fallbackDyn);
      setTeacherAnalysis(null);
      setIsLiveFromBackend(false);
    };

    fetchTeacherData();

    return () => {
      isCancelled = true;
    };
  }, [selectedTeacher, latestRunId]);

  const getMarkdownContent = () => {
    let md = `# Interview Questions — ${selectedTeacher}\n`;
    md += `**Prepared:** ${new Date().toISOString().slice(0, 10)}\n\n`;
    md += `## Core Questions (áp dụng cho tất cả giáo viên)\n`;
    coreQuestions.forEach((q, i) => {
      md += `${i + 1}. ${q}\n`;
    });
    md += `\n## Dynamic Questions (sinh từ data của ${selectedTeacher})\n`;
    dynamicQuestions.forEach((q, i) => {
      md += `${i + 1}. ${q.text}\n`;
      if (q.evidence) {
        md += `   *(Evidence: ${q.evidence})*\n`;
      }
    });
    return md;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getMarkdownContent());
      setCopied(true);
      toast.success(`Copied interview questions for ${selectedTeacher} to clipboard`, {
        title: 'Copied',
        duration: 2500,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy questions to clipboard');
    }
  };

  const handleExport = () => {
    if (isLiveFromBackend && latestRunId) {
      window.open(api.getInterviewDownloadUrl(latestRunId, selectedTeacher), '_blank');
      return;
    }

    const md = getMarkdownContent();
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedTeacher}_interview_questions.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`Exported ${selectedTeacher}_interview_questions.md`, {
      title: 'Questions Exported',
      duration: 3000,
    });
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
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '36px',
              fontWeight: 400,
              color: 'var(--accent)',
            }}>
              {t('interviewTitle')}
            </h2>
            <span className="badge badge-audio">{t('interviewBadge')}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {t('interviewDesc')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={handleCopy} className="btn btn-secondary">
            {copied ? <Check size={16} color="var(--accent-green)" /> : <Copy size={16} />}
            <span>{copied ? t('commonCopied') : t('commonCopyQuestions')}</span>
          </button>
          <button onClick={handleExport} className="btn btn-primary">
            <Download size={16} />
            <span>{t('exportMarkdown')}</span>
          </button>
        </div>
      </div>

      {/* Backend Status Notice Banner */}
      {!isLiveFromBackend && (
        <div style={{
          backgroundColor: '#FFFBEB',
          border: '1px solid #FDE68A',
          borderRadius: 'var(--radius-md)',
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#B45309" />
            <span style={{ fontSize: '13px', color: '#92400E', fontWeight: 500 }}>
              Đang hiển thị bộ câu hỏi mẫu. Hãy chạy <strong>Tổng Hợp Bài Giảng (Phase 6)</strong> để AI tự động trích xuất câu hỏi dựa trên video thực tế của từng giáo viên.
            </span>
          </div>
          <Link
            href="/themes"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
              color: '#B45309',
              textDecoration: 'none',
              backgroundColor: '#FEF3C7',
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #FDE68A',
            }}
          >
            <span>Mở Trang Phân Tích Tổng Hợp</span>
            <ExternalLink size={12} />
          </Link>
        </div>
      )}

      {/* Teacher Selector Tabs */}
      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
        {teacherList.map((tId) => {
          const isSel = selectedTeacher === tId;
          return (
            <button
              key={tId}
              onClick={() => setSelectedTeacher(tId)}
              style={{
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid',
                borderColor: isSel ? 'var(--accent)' : 'var(--card-border)',
                backgroundColor: isSel ? 'var(--accent)' : '#FFFFFF',
                color: isSel ? '#FFFFFF' : 'var(--text-main)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span>{tId}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '48px',
          textAlign: 'center',
          color: 'var(--text-muted)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
        }}>
          <Loader2 size={24} className="animate-spin" color="var(--accent)" />
          <span style={{ fontSize: '14px', fontWeight: 500 }}>
            Đang tải câu hỏi phỏng vấn cho giáo viên {selectedTeacher}...
          </span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(12, 1fr)',
          gap: '24px',
        }}>
          {/* Core Questions Card */}
          <div style={{
            gridColumn: 'span 5',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserCheck size={18} color="var(--accent)" />
              <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                {t('coreQuestions')}
              </h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('coreQuestionsSub')}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {coreQuestions.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border-soft, #EFEBE4)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    fontSize: '13.5px',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--accent)' }}>{idx + 1}.</strong> {q}
                </div>
              ))}
            </div>
          </div>

          {/* Dynamic Evidence-Cited Questions Card */}
          <div style={{
            gridColumn: 'span 7',
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="var(--accent-green)" />
                <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                  {t('dynamicQuestions')} — {selectedTeacher}
                </h3>
              </div>
              <span className="badge badge-audio">{t('videoEvidenceTag')}</span>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {t('dynamicQuestionsSub')} {selectedTeacher}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {dynamicQuestions.length > 0 ? (
                dynamicQuestions.map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      backgroundColor: '#FAF8F4',
                      border: '1px solid var(--card-border-soft, #EFEBE4)',
                      borderLeft: '4px solid var(--accent)',
                      borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', lineHeight: 1.45 }}>
                      {idx + 1}. {q.text}
                    </div>
                    {q.evidence && (
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--accent)',
                        fontFamily: 'var(--font-mono)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}>
                        <Video size={13} />
                        <span>{t('reasoningTrace')}: {q.evidence}</span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div style={{
                  padding: '28px',
                  textAlign: 'center',
                  backgroundColor: '#FAF8F4',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px dashed var(--card-border)',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                }}>
                  Chưa có câu hỏi đào sâu riêng biệt cho {selectedTeacher}.
                </div>
              )}
            </div>

            {/* Qualitative Teacher Analysis Summary if available */}
            {teacherAnalysis?.markdown_content && (
              <div style={{
                marginTop: '12px',
                padding: '16px',
                backgroundColor: '#FFFDF9',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', color: 'var(--accent)', fontWeight: 700, fontSize: '13px' }}>
                  <BookOpen size={14} />
                  <span>Tóm Tắt Ý Đồ Sư Phạm ({selectedTeacher})</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {teacherAnalysis.markdown_content}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
