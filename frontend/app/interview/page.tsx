'use client';

import React, { useState, useEffect } from 'react';
import {
  api,
  InterviewQuestion,
  TeacherAnalysis,
  InterviewBaseQuestion,
  CoreQuestionItem,
  AnalysisRunItem,
} from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { FeatureWorkflowBanner } from '@/components/FeatureWorkflowBanner';
import { PedagogicalNarrativeView } from '@/components/PedagogicalNarrativeView';
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
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  CheckCircle2,
  HelpCircle,
  Layers,
  Filter,
  Zap,
  X,
  FileText,
  FolderArchive,
  Unlock,
  ShieldCheck,
  GitBranch,
  Calendar,
  Info,
  Printer,
} from 'lucide-react';
import Link from 'next/link';
import JSZip from 'jszip';
import { generateInterviewGuideWord, downloadInterviewWordBlob } from '@/lib/interviewWordExport';
import { generateInterviewGuidePdf, generateInterviewGuidePdfBlob } from '@/lib/pdfExport';

export default function InterviewStudioPage() {
  const { t, language } = useTranslation();
  const toast = useToast();

  // Navigation tab state
  const [activeTab, setActiveTab] = useState<'studio' | 'bank'>('studio');

  // Studio tab states
  const [teacherList, setTeacherList] = useState<string[]>([
    'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12',
  ]);
  const [selectedTeacher, setSelectedTeacher] = useState('T01');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [latestRunId, setLatestRunId] = useState<string | null>(null);
  const [activeRunInfo, setActiveRunInfo] = useState<AnalysisRunItem | null>(null);
  const [activeRunNumber, setActiveRunNumber] = useState<number | null>(null);
  const [isLiveFromBackend, setIsLiveFromBackend] = useState(false);
  const [isExportingWord, setIsExportingWord] = useState(false);
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingAllPdf, setIsExportingAllPdf] = useState(false);
  const [exportProgress, setExportProgress] = useState({ current: 0, total: 0 });

  // Core & Dynamic Questions
  const [coreQuestions, setCoreQuestions] = useState<InterviewQuestion[]>([]);
  const [dynamicQuestions, setDynamicQuestions] = useState<InterviewQuestion[]>([]);
  const [teacherAnalysis, setTeacherAnalysis] = useState<TeacherAnalysis | null>(null);

  // Flow A: Core Questions approval banner state
  const [synthesizedCore, setSynthesizedCore] = useState<CoreQuestionItem[]>([]);
  const [coreStatus, setCoreStatus] = useState<'draft' | 'approved'>('draft');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [showCoreModal, setShowCoreModal] = useState(false);
  const [showApproveConfirmModal, setShowApproveConfirmModal] = useState(false);
  const [editingCoreList, setEditingCoreList] = useState<CoreQuestionItem[]>([]);

  // Base Questions Bank tab states
  const [baseQuestions, setBaseQuestions] = useState<InterviewBaseQuestion[]>([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [selectedRQFilter, setSelectedRQFilter] = useState<string>('ALL');
  const [editingBaseQ, setEditingBaseQ] = useState<InterviewBaseQuestion | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newQuestion, setNewQuestion] = useState({
    section: 'Section B',
    section_title: 'Classroom Management Strategies (RQ1)',
    question_index: 23,
    question_text: '',
    rq_category: 'RQ1',
  });

  // Edit individual interview question modal
  const [editingQuestion, setEditingQuestion] = useState<InterviewQuestion | null>(null);

  // 1. Initial Page Load
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
        // keep fallback
      }

      try {
        const [runs, latest] = await Promise.all([
          api.listAnalysisRuns().catch(() => []),
          api.getLatestAnalysisRun().catch(() => null),
        ]);

        let targetId: string | null = null;
        const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const queryRunId = urlParams?.get('run_id');
        const storedRunId = typeof window !== 'undefined' ? localStorage.getItem('active_theme_run_id') : null;

        if (queryRunId && runs?.some((r) => r.id === queryRunId)) {
          targetId = queryRunId;
        } else if (storedRunId && runs?.some((r) => r.id === storedRunId)) {
          targetId = storedRunId;
        } else if (latest?.id) {
          targetId = latest.id;
        } else if (runs && runs.length > 0) {
          targetId = runs[0].id;
        }

        if (targetId) {
          setLatestRunId(targetId);
          fetchCoreQuestionsForRun(targetId);
          const found = runs.find((r) => r.id === targetId);
          if (found) {
            setActiveRunInfo(found);
            const rIdx = runs.findIndex((r) => r.id === targetId);
            setActiveRunNumber(runs.length - rIdx);
          } else if (latest) {
            setActiveRunInfo(latest);
            setActiveRunNumber(runs.length || 1);
          }
        }
      } catch {
        // No run yet
      }

      fetchBaseQuestions();
    };

    initPage();
  }, []);

  const fetchCoreQuestionsForRun = async (runId: string) => {
    try {
      const res = await api.getCoreQuestions(runId);
      if (res && res.core_questions) {
        setSynthesizedCore(res.core_questions);
        setCoreStatus(res.status || 'draft');
      }
    } catch {
      // ignore
    }
  };

  const fetchBaseQuestions = async () => {
    setBankLoading(true);
    try {
      const data = await api.getBaseInterviewQuestions();
      setBaseQuestions(data);
    } catch {
      toast.error('Failed to load base question bank');
    } finally {
      setBankLoading(false);
    }
  };

  // 2. Fetch Teacher Data when Selected Teacher Changes
  useEffect(() => {
    let isCancelled = false;

    const fetchTeacherData = async () => {
      setLoading(true);
      try {
        const data = await api.getTeacherAnalysis(latestRunId || 'latest', selectedTeacher);
        if (isCancelled) return;

        if (data && data.interview_questions && data.interview_questions.length > 0) {
          const core = data.interview_questions.filter((q) => q.type === 'core');
          const dyn = data.interview_questions.filter((q) => q.type === 'dynamic');

          setCoreQuestions(core);
          setDynamicQuestions(dyn);
          setTeacherAnalysis(data.teacher_analysis || null);
          setIsLiveFromBackend(true);
        } else {
          setCoreQuestions([]);
          setDynamicQuestions([]);
          setTeacherAnalysis(null);
          setIsLiveFromBackend(false);
        }
      } catch {
        if (!isCancelled) {
          setCoreQuestions([]);
          setDynamicQuestions([]);
          setTeacherAnalysis(null);
          setIsLiveFromBackend(false);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchTeacherData();

    return () => {
      isCancelled = true;
    };
  }, [selectedTeacher, latestRunId]);

  // Flow A: Synthesize Core Questions
  const handleSynthesizeCore = async () => {
    if (!latestRunId) {
      toast.error(
        t('interviewToastRunPhase6First'),
        { title: t('commonNote'), duration: 6000 }
      );
      return;
    }
    setIsSynthesizing(true);
    try {
      const res = await api.synthesizeCoreQuestions(latestRunId);
      setSynthesizedCore(res.core_questions);
      setCoreStatus('draft');
      toast.success(t('interviewToastSynthesizeSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('interviewToastSynthesizeError'));
    } finally {
      setIsSynthesizing(false);
    }
  };

  // Flow A: Approve Core Questions
  const handleApproveCore = async (questionsToApprove: CoreQuestionItem[]) => {
    if (!latestRunId) return;
    setIsApproving(true);
    try {
      await api.approveCoreQuestions(latestRunId, questionsToApprove);
      setSynthesizedCore(questionsToApprove);
      setCoreStatus('approved');
      setShowCoreModal(false);
      setShowApproveConfirmModal(false);
      toast.success(t('interviewToastApproveSuccess'));
      // Refresh current teacher questions
      const data = await api.getTeacherAnalysis(latestRunId, selectedTeacher);
      if (data && data.interview_questions) {
        setCoreQuestions(data.interview_questions.filter((q) => q.type === 'core'));
        setDynamicQuestions(data.interview_questions.filter((q) => q.type === 'dynamic'));
        setTeacherAnalysis(data.teacher_analysis || null);
        setIsLiveFromBackend(true);
      }
    } catch (err: any) {
      toast.error(err.message || t('interviewToastApproveError'));
    } finally {
      setIsApproving(false);
    }
  };

  // Flow A: Unapprove Core Questions (Revert to Draft)
  const handleUnapproveCore = async () => {
    if (!latestRunId) return;
    setIsApproving(true);
    try {
      await api.unapproveCoreQuestions(latestRunId);
      setCoreStatus('draft');
      toast.success(t('interviewToastUnapproveSuccess'));
    } catch (err: any) {
      toast.error(err.message || t('interviewToastUnapproveError'));
    } finally {
      setIsApproving(false);
    }
  };

  // Save updated individual question
  const handleSaveQuestion = async () => {
    if (!editingQuestion) return;
    try {
      await api.updateInterviewQuestion(
        editingQuestion.id,
        editingQuestion.question_text,
        editingQuestion.rq_category
      );
      toast.success(t('interviewToastUpdateSuccess'));
      setDynamicQuestions((prev) =>
        prev.map((q) => (q.id === editingQuestion.id ? editingQuestion : q))
      );
      setEditingQuestion(null);
    } catch {
      toast.error(t('interviewToastUpdateError'));
    }
  };

  // Base Questions Bank Handlers
  const handleResetDefaults = async () => {
    if (!confirm(t('interviewConfirmReset'))) {
      return;
    }
    setBankLoading(true);
    try {
      const data = await api.resetBaseInterviewQuestions();
      setBaseQuestions(data);
      toast.success(t('interviewToastResetSuccess'));
    } catch {
      toast.error(t('interviewToastResetError'));
    } finally {
      setBankLoading(false);
    }
  };

  const handleCreateBaseQuestion = async () => {
    if (!newQuestion.question_text.trim()) {
      toast.error(t('interviewToastEnterText'));
      return;
    }
    try {
      await api.createBaseInterviewQuestion(newQuestion);
      toast.success(t('interviewToastCreateSuccess'));
      setShowAddModal(false);
      setNewQuestion({
        section: 'Section B',
        section_title: 'Classroom Management Strategies (RQ1)',
        question_index: baseQuestions.length + 1,
        question_text: '',
        rq_category: 'RQ1',
      });
      fetchBaseQuestions();
    } catch {
      toast.error(t('interviewToastCreateError'));
    }
  };

  const handleUpdateBaseQuestion = async () => {
    if (!editingBaseQ) return;
    try {
      await api.updateBaseInterviewQuestion(editingBaseQ.id, editingBaseQ);
      toast.success(t('interviewToastUpdateBaseSuccess'));
      setEditingBaseQ(null);
      fetchBaseQuestions();
    } catch {
      toast.error(t('interviewToastUpdateError'));
    }
  };

  const handleDeleteBaseQuestion = async (id: string) => {
    if (!confirm(t('interviewConfirmDelete'))) return;
    try {
      await api.deleteBaseInterviewQuestion(id);
      toast.success(t('interviewToastDeleteSuccess'));
      fetchBaseQuestions();
    } catch {
      toast.error(t('interviewToastDeleteError'));
    }
  };

  // Export Markdown content
  const getMarkdownContent = () => {
    let md = `# Semi-Structured Interview Guide — Teacher ${selectedTeacher}\n`;
    md += `**Study:** Primary EFL Classroom Management & Speaking Participation (RQ1–RQ3)\n`;
    md += `**Prepared:** ${new Date().toISOString().slice(0, 10)}\n\n`;

    md += `## Part 1: Core Questions (áp dụng cho tất cả giáo viên)\n`;
    if (coreQuestions.length === 0 && synthesizedCore.length > 0) {
      synthesizedCore.forEach((q, i) => {
        md += `${i + 1}. [${q.rq_category}] ${q.question_text}\n`;
      });
    } else {
      coreQuestions.forEach((q, i) => {
        const rqTag = q.rq_category ? `[${q.rq_category}] ` : '';
        md += `${i + 1}. ${rqTag}${q.question_text}\n`;
      });
    }

    md += `\n## Part 2: Participant-specific Follow-up Questions (${selectedTeacher})\n`;
    if (dynamicQuestions.length === 0) {
      md += `*(Chưa có câu hỏi phỏng vấn động cho ${selectedTeacher})*\n`;
    } else {
      dynamicQuestions.forEach((q, i) => {
        const rqTag = q.rq_category ? `[${q.rq_category}] ` : '';
        md += `${i + 1}. ${rqTag}${q.question_text}\n`;
        if (q.evidence_ref) {
          md += `   *(Empirical Evidence: ${q.evidence_ref})*\n`;
        }
      });
    }
    return md;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getMarkdownContent());
      setCopied(true);
      toast.success(`${t('interviewToastCopied')} ${selectedTeacher}`, {
        title: t('commonCopied'),
        duration: 2500,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('commonFailed'));
    }
  };

  const handleExportWord = async () => {
    setIsExportingWord(true);
    try {
      const activeCore = synthesizedCore.length > 0 ? synthesizedCore : coreQuestions;
      const blob = await generateInterviewGuideWord({
        teacherId: selectedTeacher,
        coreQuestions: activeCore,
        dynamicQuestions: dynamicQuestions,
        teacherAnalysis: teacherAnalysis,
        lang: language as ('en' | 'vi'),
      });
      const filename = `Teacher_Interview_Guide_${selectedTeacher}_${new Date().toISOString().slice(0, 10)}.docx`;
      downloadInterviewWordBlob(blob, filename);
      toast.success(t('interviewExportWordSuccess').replace('{teacher}', selectedTeacher));
    } catch (err: any) {
      console.error('Export word error:', err);
      toast.error(t('interviewExportAllError') + (err.message || 'Thử lại sau'));
    } finally {
      setIsExportingWord(false);
    }
  };

  const handleExportAllWord = async () => {
    if (!teacherList || teacherList.length === 0) return;
    setIsExportingAll(true);
    setExportProgress({ current: 0, total: teacherList.length });

    try {
      const zip = new JSZip();
      const activeCore = synthesizedCore.length > 0 ? synthesizedCore : coreQuestions;
      const dateStr = new Date().toISOString().slice(0, 10);

      for (let i = 0; i < teacherList.length; i++) {
        const tId = teacherList[i];
        setExportProgress({ current: i + 1, total: teacherList.length });

        let core = activeCore;
        let dyn: InterviewQuestion[] = [];
        let analysis: TeacherAnalysis | null = null;

        if (tId === selectedTeacher && isLiveFromBackend) {
          dyn = dynamicQuestions;
          analysis = teacherAnalysis;
        } else {
          try {
            const data = await api.getTeacherAnalysis(latestRunId || 'latest', tId);
            if (data && data.interview_questions) {
              if (core.length === 0) {
                core = data.interview_questions.filter((q) => q.type === 'core');
              }
              dyn = data.interview_questions.filter((q) => q.type === 'dynamic');
              analysis = data.teacher_analysis || null;
            }
          } catch (fetchErr) {
            console.warn(`Could not load full teacher analysis for ${tId}:`, fetchErr);
          }
        }

        const docBlob = await generateInterviewGuideWord({
          teacherId: tId,
          coreQuestions: core,
          dynamicQuestions: dyn,
          teacherAnalysis: analysis,
          lang: language as ('en' | 'vi'),
        });

        const docFilename = `Teacher_Interview_Guide_${tId}_${dateStr}.docx`;
        zip.file(docFilename, docBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `Teacher_Interview_Guides_All_${dateStr}.zip`;
      downloadInterviewWordBlob(zipBlob, zipFilename);

      toast.success(
        t('interviewExportAllSuccess').replace('{count}', String(teacherList.length))
      );
    } catch (err: any) {
      console.error('Batch export word error:', err);
      toast.error(t('interviewExportAllError') + (err.message || 'Thử lại sau'));
    } finally {
      setIsExportingAll(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const handleExportPdf = async () => {
    setIsExportingPdf(true);
    try {
      const activeCore = synthesizedCore.length > 0 ? synthesizedCore : coreQuestions;
      await generateInterviewGuidePdf({
        teacherId: selectedTeacher,
        coreQuestions: activeCore,
        dynamicQuestions: dynamicQuestions,
        teacherAnalysis: teacherAnalysis,
        lang: language as ('en' | 'vi'),
      });
      toast.success(t('interviewExportPdfSuccess').replace('{teacher}', selectedTeacher));
    } catch (err: any) {
      console.error('Export PDF error:', err);
      toast.error(t('interviewExportAllError') + (err.message || 'Thử lại sau'));
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleExportAllPdf = async () => {
    if (!teacherList || teacherList.length === 0) return;
    setIsExportingAllPdf(true);
    setExportProgress({ current: 0, total: teacherList.length });

    try {
      const zip = new JSZip();
      const activeCore = synthesizedCore.length > 0 ? synthesizedCore : coreQuestions;
      const dateStr = new Date().toISOString().slice(0, 10);

      for (let i = 0; i < teacherList.length; i++) {
        const tId = teacherList[i];
        setExportProgress({ current: i + 1, total: teacherList.length });

        let core = activeCore;
        let dyn: InterviewQuestion[] = [];
        let analysis: TeacherAnalysis | null = null;

        if (tId === selectedTeacher && isLiveFromBackend) {
          dyn = dynamicQuestions;
          analysis = teacherAnalysis;
        } else {
          try {
            const data = await api.getTeacherAnalysis(latestRunId || 'latest', tId);
            if (data && data.interview_questions) {
              if (core.length === 0) {
                core = data.interview_questions.filter((q) => q.type === 'core');
              }
              dyn = data.interview_questions.filter((q) => q.type === 'dynamic');
              analysis = data.teacher_analysis || null;
            }
          } catch (fetchErr) {
            console.warn(`Could not load full teacher analysis for ${tId}:`, fetchErr);
          }
        }

        const pdfBlob = await generateInterviewGuidePdfBlob({
          teacherId: tId,
          coreQuestions: core,
          dynamicQuestions: dyn,
          teacherAnalysis: analysis,
          lang: language as ('en' | 'vi'),
        });

        const pdfFilename = `Teacher_Interview_Guide_${tId}_${dateStr}.pdf`;
        zip.file(pdfFilename, pdfBlob);
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const zipFilename = `Teacher_Interview_Guides_All_${dateStr}_PDF.zip`;
      downloadInterviewWordBlob(zipBlob, zipFilename);

      toast.success(
        t('interviewExportAllSuccessPdf').replace('{count}', String(teacherList.length))
      );
    } catch (err: any) {
      console.error('Batch export PDF error:', err);
      toast.error(t('interviewExportAllError') + (err.message || 'Thử lại sau'));
    } finally {
      setIsExportingAllPdf(false);
      setExportProgress({ current: 0, total: 0 });
    }
  };

  const getRQBadgeStyle = (rq?: string): React.CSSProperties => {
    switch (rq) {
      case 'RQ1':
        return {
          backgroundColor: 'var(--accent-green-soft, #EAF4EE)',
          color: 'var(--accent-green, #2D6A4F)',
          border: '1px solid #A7F3D0',
        };
      case 'RQ2':
        return {
          backgroundColor: 'var(--accent-blue-soft, #EBF3F9)',
          color: 'var(--accent-blue, #1D5C8A)',
          border: '1px solid #BFDBFE',
        };
      case 'RQ3':
        return {
          backgroundColor: 'var(--accent-amber-soft, #FEF7EA)',
          color: 'var(--accent-amber, #B26A00)',
          border: '1px solid #FDE68A',
        };
      default:
        return {
          backgroundColor: '#F3F4F6',
          color: 'var(--text-muted, #4B5563)',
          border: '1px solid var(--card-border, #E5E7EB)',
        };
    }
  };

  const getRQFullLabel = (rq?: string) => {
    switch (rq) {
      case 'RQ1':
        return 'RQ1: Strategies';
      case 'RQ2':
        return 'RQ2: Perceptions';
      case 'RQ3':
        return 'RQ3: Challenges & Solutions';
      default:
        return rq || 'General';
    }
  };

  const filteredBaseQuestions = baseQuestions.filter((q) => {
    if (selectedRQFilter === 'ALL') return true;
    return q.rq_category === selectedRQFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Header & Tab Switcher */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--card-border)',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '32px',
              fontWeight: 400,
              color: 'var(--accent)',
            }}>
              {t('interviewTitle')}
            </h2>
            <span className="badge badge-audio">Grounded Theory RQ1–RQ3</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px' }}>
            {t('interviewSubtitle')}
          </p>
        </div>

        {/* Tab Toggle */}
        <div style={{
          display: 'flex',
          backgroundColor: 'var(--card-bg, #F3F4F6)',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid var(--card-border)',
          gap: '4px',
        }}>
          <button
            onClick={() => setActiveTab('studio')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'studio' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'studio' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserCheck size={15} />
            <span>{t('interviewTabStudio')}</span>
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              backgroundColor: activeTab === 'bank' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'bank' ? '#FFFFFF' : 'var(--text-muted)',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <BookOpen size={15} />
            <span>{t('interviewTabBank')}</span>
          </button>
        </div>
      </div>

      {/* Feature Workflow & Automation Guidance */}
      <FeatureWorkflowBanner featureKey="interview" />

      {/* ==================== TAB 1: INTERVIEW STUDIO ==================== */}
      {activeTab === 'studio' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ==================== UNIFIED THEME & CORE PROTOCOL CONTROL HUB ==================== */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--card-border)',
            borderLeft: `4px solid ${coreStatus === 'approved' ? 'var(--accent-green, #10B981)' : 'var(--accent-amber, #F59E0B)'}`,
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-sm)',
            overflow: 'hidden',
          }}>
            {/* Top Row: Context, Protocol Identity, Status Badge & Action Controls */}
            <div style={{
              padding: '14px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '14px',
              borderBottom: '1px solid #F1F5F9',
            }}>
              {/* Left: Identity & Theme Run Version */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  backgroundColor: coreStatus === 'approved' ? '#ECFDF5' : '#FFFBEB',
                  color: coreStatus === 'approved' ? '#059669' : '#D97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${coreStatus === 'approved' ? '#A7F3D0' : '#FDE68A'}`,
                  flexShrink: 0,
                }}>
                  {coreStatus === 'approved' ? <ShieldCheck size={20} /> : <GitBranch size={20} />}
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {t('interviewHubCoreTitle')}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '2px 9px',
                      borderRadius: '9999px',
                      backgroundColor: coreStatus === 'approved' ? 'var(--accent-green-soft, #EAF4EE)' : 'var(--accent-amber-soft, #FEF7EA)',
                      color: coreStatus === 'approved' ? 'var(--accent-green, #2D6A4F)' : 'var(--accent-amber, #B26A00)',
                      border: `1px solid ${coreStatus === 'approved' ? '#86EFAC' : '#FCD34D'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {coreStatus === 'approved' ? <CheckCircle2 size={11} /> : <Zap size={11} />}
                      <span>{coreStatus === 'approved' ? t('interviewFlowABadgeApproved') : t('interviewFlowABadgeDraft')}</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                      Run #{activeRunNumber ?? '1'} <code style={{ fontSize: '11px', backgroundColor: '#F1F5F9', padding: '1px 5px', borderRadius: '4px' }}>{latestRunId ? latestRunId.slice(0, 8) : 'latest'}</code>
                    </span>
                    <span>•</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Calendar size={12} />
                      {activeRunInfo?.triggered_at ? new Date(activeRunInfo.triggered_at).toLocaleDateString() : new Date().toLocaleDateString()}
                    </span>
                    {activeRunInfo?.theme_count !== undefined && (
                      <>
                        <span>•</span>
                        <span style={{ fontWeight: 600, color: '#B45309' }}>
                          {activeRunInfo.theme_count} Themes
                        </span>
                      </>
                    )}
                    <span>•</span>
                    <Link
                      href="/themes"
                      style={{
                        fontSize: '12px',
                        color: 'var(--accent)',
                        textDecoration: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontWeight: 600,
                      }}
                    >
                      <span>{t('interviewThemeGoToThemes')}</span>
                      <ExternalLink size={12} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Right: Action Buttons Group */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button
                  onClick={() => {
                    setEditingCoreList([...synthesizedCore]);
                    setShowCoreModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ fontSize: '12.5px', padding: '6px 13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit2 size={13} />
                  <span>{t('interviewEditCoreBtn')} ({synthesizedCore.length})</span>
                </button>

                {coreStatus === 'approved' ? (
                  <button
                    onClick={handleUnapproveCore}
                    disabled={isApproving}
                    className="btn btn-secondary"
                    style={{
                      fontSize: '12.5px',
                      padding: '6px 13px',
                      borderColor: '#CBD5E1',
                      color: '#475569',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                    title={t('interviewUnapproveBtn')}
                  >
                    <Unlock size={13} />
                    <span>{isApproving ? t('commonSaving') : t('interviewUnapproveBtn')}</span>
                  </button>
                ) : (
                  <>
                    <button
                      onClick={handleSynthesizeCore}
                      disabled={isSynthesizing}
                      className="btn btn-secondary"
                      style={{ fontSize: '12.5px', padding: '6px 13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <RefreshCw size={13} className={isSynthesizing ? 'animate-spin' : ''} />
                      <span>{isSynthesizing ? t('commonSaving') : t('interviewResynthesizeBtn')}</span>
                    </button>
                    <button
                      onClick={() => setShowApproveConfirmModal(true)}
                      disabled={isApproving}
                      className="btn btn-primary"
                      title={t('interviewApproveConfirmDesc')}
                      style={{
                        fontSize: '12.5px',
                        padding: '6px 15px',
                        backgroundColor: 'var(--accent-green, #10B981)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      <span>{isApproving ? t('commonInProgress') : t('interviewApproveBtn')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowApproveConfirmModal(true)}
                      style={{
                        border: '1px solid #E2E8F0',
                        background: '#F8FAFC',
                        color: '#64748B',
                        cursor: 'pointer',
                        padding: '5px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '6px',
                      }}
                      title={t('interviewApproveNoticeTitle')}
                    >
                      <HelpCircle size={15} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Bottom Row: Compact 3-Pillar Micro Guidance Strip */}
            <div style={{
              padding: '10px 20px',
              backgroundColor: '#F8FAFC',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}>
                <Info size={13} color="var(--accent)" />
                <span>{t('interviewApproveNoticeTitle')}</span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                gap: '12px',
                fontSize: '12px',
                color: '#475569',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={14} color="#10B981" style={{ flexShrink: 0 }} />
                  <span>{t('interviewHubPillar1')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={14} color="#10B981" style={{ flexShrink: 0 }} />
                  <span>{t('interviewHubPillar2')}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <HelpCircle size={14} color="#6366F1" style={{ flexShrink: 0 }} />
                  <span>{t('interviewHubPillar3')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Teacher Selector Tabs & Action Buttons */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: '#FFFFFF',
              padding: '4px',
              borderRadius: '8px',
              border: '1px solid var(--card-border)',
              boxShadow: 'var(--shadow-sm)',
              overflowX: 'auto',
            }}>
              {teacherList.map((tId) => {
                const isSel = selectedTeacher === tId;
                return (
                  <button
                    key={tId}
                    onClick={() => setSelectedTeacher(tId)}
                    style={{
                      padding: '6px 13px',
                      borderRadius: '6px',
                      border: 'none',
                      backgroundColor: isSel ? 'var(--accent)' : 'transparent',
                      color: isSel ? '#FFFFFF' : 'var(--text-muted)',
                      fontWeight: isSel ? 700 : 600,
                      fontSize: '13px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {tId}
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* Copy Questions */}
              <button
                onClick={handleCopy}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 500,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                  border: '1px solid var(--card-border)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {copied ? <Check size={13.5} color="var(--accent-green)" /> : <Copy size={13.5} />}
                <span>{copied ? t('commonCopied') : t('commonCopyQuestions')}</span>
              </button>

              {/* Single Teacher Word Export */}
              <button
                onClick={handleExportWord}
                disabled={isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#F0FDF4',
                  color: '#166534',
                  border: '1px solid #BBF7D0',
                  cursor: isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('interviewExportWordTooltip').replace('{teacher}', selectedTeacher)}
              >
                {isExportingWord ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} color="#2D6A4F" />}
                <span>
                  {isExportingWord
                    ? t('interviewExportingWord')
                    : t('interviewExportSingleTeacher').replace('{teacher}', selectedTeacher)}
                </span>
              </button>

              {/* Single Teacher PDF Export */}
              <button
                onClick={handleExportPdf}
                disabled={isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#FEF2F2',
                  color: '#991B1B',
                  border: '1px solid #FECACA',
                  cursor: isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('interviewExportPdfTooltip').replace('{teacher}', selectedTeacher)}
              >
                {isExportingPdf ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} color="#DC2626" />}
                <span>
                  {isExportingPdf
                    ? t('interviewExportingPdf')
                    : t('interviewExportSingleTeacherPdf').replace('{teacher}', selectedTeacher)}
                </span>
              </button>

              {/* Subtle Divider */}
              <div style={{ width: '1px', height: '18px', backgroundColor: '#E2E8F0', margin: '0 2px' }} />

              {/* Batch All Teachers Word (ZIP) */}
              <button
                onClick={handleExportAllWord}
                disabled={isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#EFF6FF',
                  color: '#1E40AF',
                  border: '1px solid #BFDBFE',
                  cursor: isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('interviewExportAllTooltip').replace('{count}', String(teacherList.length))}
              >
                {isExportingAll ? <Loader2 size={13} className="animate-spin" /> : <FolderArchive size={13} />}
                <span>
                  {isExportingAll
                    ? t('interviewExportingAllWord')
                        .replace('{current}', String(exportProgress.current))
                        .replace('{total}', String(exportProgress.total))
                    : t('interviewExportAllTeachers').replace('{count}', String(teacherList.length))}
                </span>
              </button>

              {/* Batch All Teachers PDF (ZIP) */}
              <button
                onClick={handleExportAllPdf}
                disabled={isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf}
                style={{
                  height: '30px',
                  padding: '0 10px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#FFF1F2',
                  color: '#9F1239',
                  border: '1px solid #FECDD3',
                  cursor: isExportingWord || isExportingAll || isExportingPdf || isExportingAllPdf ? 'not-allowed' : 'pointer',
                  transition: 'all 0.15s ease',
                }}
                title={t('interviewExportAllPdfTooltip').replace('{count}', String(teacherList.length))}
              >
                {isExportingAllPdf ? <Loader2 size={13} className="animate-spin" /> : <FolderArchive size={13} />}
                <span>
                  {isExportingAllPdf
                    ? t('interviewExportingAllPdf')
                        .replace('{current}', String(exportProgress.current))
                        .replace('{total}', String(exportProgress.total))
                    : t('interviewExportAllTeachersPdf').replace('{count}', String(teacherList.length))}
                </span>
              </button>
            </div>
          </div>

          {/* Main Content Area */}
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
                {t('interviewLoadingTeacher')} {selectedTeacher}...
              </span>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: '24px' }}>
              
              {/* Column Left: Core Questions (Common across all 12 teachers) */}
              <div style={{
                gridColumn: 'span 5',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-md)',
                padding: '22px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <UserCheck size={18} color="var(--accent)" />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                      {t('interviewCoreColTitle')}
                    </h3>
                  </div>
                  <span className="badge badge-audio" style={{ fontSize: '11px' }}>
                    {coreQuestions.length > 0 ? `${coreQuestions.length} ${t('interviewQuestionsCount')}` : `${synthesizedCore.length} ${t('interviewQuestionsCount')}`}
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('interviewCoreColDesc')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(coreQuestions.length > 0 ? coreQuestions : synthesizedCore).map((q: any, idx: number) => {
                    const rq = q.rq_category || 'RQ1';
                    const qText = q.question_text || q;
                    return (
                      <div
                        key={idx}
                        style={{
                          backgroundColor: '#FAF8F4',
                          border: '1px solid var(--card-border-soft, #EFEBE4)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '12px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            ...getRQBadgeStyle(rq),
                          }}>
                            {getRQFullLabel(rq)}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                            #{idx + 1}
                          </span>
                        </div>
                        <div style={{ fontSize: '13px', lineHeight: 1.5, color: 'var(--text-main)' }}>
                          {qText}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Column Right: Participant-specific Follow-up Questions */}
              <div style={{
                gridColumn: 'span 7',
                backgroundColor: '#FFFFFF',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-md)',
                padding: '22px',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Sparkles size={18} color="var(--accent-green)" />
                    <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>
                      {t('interviewDynamicColTitle')} — {selectedTeacher}
                    </h3>
                  </div>
                  <span className="badge badge-audio" style={{ fontSize: '11px' }}>
                    {dynamicQuestions.length} {t('interviewFollowupsCount')}
                  </span>
                </div>

                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('interviewDynamicColDesc')}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {dynamicQuestions.length > 0 ? (
                    dynamicQuestions.map((q, idx) => (
                      <div
                        key={q.id || idx}
                        style={{
                          backgroundColor: '#FAF8F4',
                          border: '1px solid var(--card-border-soft, #EFEBE4)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '14px 16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontFamily: 'var(--font-mono)',
                            ...getRQBadgeStyle(q.rq_category),
                          }}>
                            {getRQFullLabel(q.rq_category)}
                          </span>
                          <button
                            onClick={() => setEditingQuestion({ ...q })}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--accent)',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11.5px',
                              fontWeight: 600,
                            }}
                          >
                            <Edit2 size={12} />
                            <span>{t('commonEdit')}</span>
                          </button>
                        </div>

                        <div style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.45 }}>
                          <strong>{idx + 1}.</strong> {q.question_text}
                        </div>

                        {q.evidence_ref && (
                          <div style={{
                            fontSize: '12px',
                            color: 'var(--accent)',
                            fontFamily: 'var(--font-mono)',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--card-border-soft, #EFEBE4)',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}>
                            <Video size={13} />
                            <span>Evidence: {q.evidence_ref}</span>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{
                      padding: '36px',
                      textAlign: 'center',
                      backgroundColor: '#FAF8F4',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px dashed var(--card-border)',
                      color: 'var(--text-muted)',
                      fontSize: '13px',
                    }}>
                      {t('interviewDynamicEmpty')}
                    </div>
                  )}
                </div>

                {/* Pedagogical Narrative Synthesis */}
                {teacherAnalysis?.markdown_content && (
                  <div style={{ marginTop: '12px' }}>
                    <PedagogicalNarrativeView
                      teacherId={selectedTeacher}
                      markdownContent={teacherAnalysis.markdown_content}
                      contextSummary={teacherAnalysis.context_summary}
                      themeIds={teacherAnalysis.theme_ids}
                    />
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ==================== TAB 2: BASE QUESTIONS BANK (22 CANONICAL) ==================== */}
      {activeTab === 'bank' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Header Bar */}
          <div style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '18px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>
                {t('interviewBankTitle')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {t('interviewBankSubtitle')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button onClick={handleResetDefaults} className="btn btn-secondary" style={{ fontSize: '12.5px' }}>
                <RefreshCw size={14} />
                <span>{t('interviewResetDefaults')}</span>
              </button>
              <button onClick={() => setShowAddModal(true)} className="btn btn-primary" style={{ fontSize: '12.5px' }}>
                <Plus size={14} />
                <span>{t('interviewAddNew')}</span>
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Filter size={14} />
              <span>{t('interviewFilterRQ')}</span>
            </span>
            {['ALL', 'RQ1', 'RQ2', 'RQ3', 'BACKGROUND', 'CLOSING'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedRQFilter(cat)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '16px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: '1px solid',
                  borderColor: selectedRQFilter === cat ? 'var(--accent)' : 'var(--card-border)',
                  backgroundColor: selectedRQFilter === cat ? 'var(--accent)' : '#FFFFFF',
                  color: selectedRQFilter === cat ? '#FFFFFF' : 'var(--text-main)',
                  transition: 'all 0.15s ease',
                }}
              >
                {cat === 'ALL' ? `${t('interviewFilterAll')} (${baseQuestions.length})` : cat}
              </button>
            ))}
          </div>

          {/* Questions List */}
          {bankLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
              <span>{t('interviewLoadingBank')}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredBaseQuestions.map((q) => (
                <div
                  key={q.id}
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '16px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      fontWeight: 700,
                      backgroundColor: '#F3F4F6',
                      color: 'var(--text-main)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      minWidth: '34px',
                      textAlign: 'center',
                    }}>
                      Q{q.question_index}
                    </span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          fontFamily: 'var(--font-mono)',
                          ...getRQBadgeStyle(q.rq_category),
                        }}>
                          {q.rq_category}
                        </span>
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {q.section} • {q.section_title}
                        </span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-main)', marginTop: '2px' }}>
                        {q.question_text}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button
                      onClick={() => setEditingBaseQ({ ...q })}
                      style={{
                        padding: '5px 10px',
                        border: '1px solid var(--card-border)',
                        borderRadius: '4px',
                        backgroundColor: '#FFFFFF',
                        color: 'var(--accent)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Edit2 size={12} />
                      <span>{t('interviewEdit')}</span>
                    </button>
                    <button
                      onClick={() => handleDeleteBaseQuestion(q.id)}
                      style={{
                        padding: '5px 10px',
                        border: '1px solid #FECDD3',
                        borderRadius: '4px',
                        backgroundColor: '#FFF1F2',
                        color: '#E11D48',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Trash2 size={12} />
                      <span>{t('interviewDelete')}</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>
      )}

      {/* MODAL 0: Confirm Approval Modal */}
      {showApproveConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: '12px',
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1px solid #E2E8F0',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#ECFDF5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #A7F3D0',
                flexShrink: 0,
              }}>
                <ShieldCheck size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0, color: '#0F172A' }}>
                  {t('interviewApproveConfirmTitle')}
                </h3>
                <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                  {t('interviewApproveConfirmDesc')}
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: '#F8FAFC',
              border: '1px solid #E2E8F0',
              borderRadius: '8px',
              padding: '14px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', color: '#334155' }}>
                  {t('interviewApproveConfirmPoint1')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <CheckCircle2 size={16} color="#10B981" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', color: '#334155', fontWeight: 600 }}>
                  {t('interviewApproveConfirmPoint2')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <HelpCircle size={16} color="#6366F1" style={{ marginTop: '2px', flexShrink: 0 }} />
                <span style={{ fontSize: '12.5px', color: '#334155' }}>
                  {t('interviewApproveConfirmPoint3')}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <button
                onClick={() => setShowApproveConfirmModal(false)}
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '13px' }}
                disabled={isApproving}
              >
                {t('interviewApproveConfirmCancel')}
              </button>
              <button
                onClick={() => handleApproveCore(synthesizedCore)}
                disabled={isApproving}
                className="btn btn-primary"
                style={{
                  backgroundColor: '#10B981',
                  borderColor: '#059669',
                  padding: '8px 18px',
                  fontSize: '13px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{isApproving ? t('commonInProgress') : t('interviewApproveConfirmSubmit')}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: Edit/Review Core Questions List (Flow A) */}
      {showCoreModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            maxWidth: '780px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                {t('interviewEditCoreTitle')}
              </h3>
              <button
                onClick={() => setShowCoreModal(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  padding: '4px',
                  borderRadius: '4px',
                }}
                title={t('commonClose')}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t('interviewEditCoreDesc')}
              </p>

              {editingCoreList.map((item, idx) => (
                <div key={idx} style={{
                  border: '1px solid var(--card-border)',
                  borderRadius: '6px',
                  padding: '12px',
                  backgroundColor: '#FAF8F4',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700 }}>{t('interviewCoreQuestionNum')} #{idx + 1}</span>
                    <select
                      value={item.rq_category}
                      onChange={(e) => {
                        const updated = [...editingCoreList];
                        updated[idx].rq_category = e.target.value;
                        setEditingCoreList(updated);
                      }}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        borderRadius: '4px',
                        border: '1px solid var(--card-border)',
                      }}
                    >
                      <option value="RQ1">RQ1 - Strategies</option>
                      <option value="RQ2">RQ2 - Perceptions</option>
                      <option value="RQ3">RQ3 - Challenges</option>
                    </select>
                  </div>
                  <textarea
                    rows={2}
                    value={item.question_text}
                    onChange={(e) => {
                      const updated = [...editingCoreList];
                      updated[idx].question_text = e.target.value;
                      setEditingCoreList(updated);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      fontSize: '13px',
                      borderRadius: '4px',
                      border: '1px solid var(--card-border)',
                      fontFamily: 'inherit',
                    }}
                  />
                  {item.rationale && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Rationale: {item.rationale}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '480px' }}>
                <ShieldCheck size={16} color="#059669" style={{ flexShrink: 0 }} />
                <span style={{ fontSize: '11.5px', color: '#64748B', lineHeight: '1.4' }}>
                  {t('interviewModalApproveHint')}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => setShowCoreModal(false)} className="btn btn-secondary">
                  {t('interviewCancel')}
                </button>
                <button
                  onClick={() => handleApproveCore(editingCoreList)}
                  className="btn btn-primary"
                  disabled={isApproving}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <CheckCircle2 size={14} />
                  <span>{isApproving ? t('settingsSaving') : t('interviewSaveAndApprove')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Add New Base Question */}
      {showAddModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('interviewAddBaseTitle')}</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('interviewQuestionContent')}</label>
              <textarea
                rows={3}
                placeholder={t('interviewQuestionPlaceholder')}
                value={newQuestion.question_text}
                onChange={(e) => setNewQuestion({ ...newQuestion, question_text: e.target.value })}
                style={{ padding: '8px 10px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Research Question (RQ)</label>
                <select
                  value={newQuestion.rq_category}
                  onChange={(e) => setNewQuestion({ ...newQuestion, rq_category: e.target.value })}
                  style={{ padding: '8px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
                >
                  <option value="RQ1">RQ1 - Strategies</option>
                  <option value="RQ2">RQ2 - Perceptions</option>
                  <option value="RQ3">RQ3 - Challenges</option>
                  <option value="BACKGROUND">Background</option>
                  <option value="CLOSING">Closing</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('interviewQuestionOrder')}</label>
                <input
                  type="number"
                  value={newQuestion.question_index}
                  onChange={(e) => setNewQuestion({ ...newQuestion, question_index: parseInt(e.target.value) || 1 })}
                  style={{ padding: '8px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                {t('interviewCancel')}
              </button>
              <button onClick={handleCreateBaseQuestion} className="btn btn-primary">
                {t('interviewAddToBank')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: Edit Base Question */}
      {editingBaseQ && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>{t('interviewEditBaseTitle')} (Q{editingBaseQ.question_index})</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('interviewQuestionContent')}</label>
              <textarea
                rows={3}
                value={editingBaseQ.question_text}
                onChange={(e) => setEditingBaseQ({ ...editingBaseQ, question_text: e.target.value })}
                style={{ padding: '8px 10px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Research Question (RQ)</label>
                <select
                  value={editingBaseQ.rq_category}
                  onChange={(e) => setEditingBaseQ({ ...editingBaseQ, rq_category: e.target.value })}
                  style={{ padding: '8px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
                >
                  <option value="RQ1">RQ1 - Strategies</option>
                  <option value="RQ2">RQ2 - Perceptions</option>
                  <option value="RQ3">RQ3 - Challenges</option>
                  <option value="BACKGROUND">Background</option>
                  <option value="CLOSING">Closing</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Section</label>
                <input
                  type="text"
                  value={editingBaseQ.section}
                  onChange={(e) => setEditingBaseQ({ ...editingBaseQ, section: e.target.value })}
                  style={{ padding: '8px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setEditingBaseQ(null)} className="btn btn-secondary">
                {t('interviewCancel')}
              </button>
              <button onClick={handleUpdateBaseQuestion} className="btn btn-primary">
                {t('interviewSave')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: Edit Individual Interview Question */}
      {editingQuestion && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px',
        }}>
          <div style={{
            backgroundColor: '#FFFFFF',
            borderRadius: 'var(--radius-md)',
            maxWidth: '560px',
            width: '100%',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
              {t('interviewEditDynamicTitle')} ({selectedTeacher})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('interviewQuestionContent')}</label>
              <textarea
                rows={4}
                value={editingQuestion.question_text}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, question_text: e.target.value })}
                style={{ padding: '8px 10px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12.5px', fontWeight: 600 }}>{t('interviewTagRQ')}</label>
              <select
                value={editingQuestion.rq_category || 'RQ1'}
                onChange={(e) => setEditingQuestion({ ...editingQuestion, rq_category: e.target.value })}
                style={{ padding: '8px', border: '1px solid var(--card-border)', borderRadius: '4px', fontSize: '13px' }}
              >
                <option value="RQ1">RQ1 — Strategies</option>
                <option value="RQ2">RQ2 — Teachers' Perceptions</option>
                <option value="RQ3">RQ3 — Challenges & Solutions</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setEditingQuestion(null)} className="btn btn-secondary">
                {t('interviewCancel')}
              </button>
              <button onClick={handleSaveQuestion} className="btn btn-primary">
                {t('interviewSave')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
