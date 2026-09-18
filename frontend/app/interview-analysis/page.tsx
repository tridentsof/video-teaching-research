'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  api,
  InterviewResponseItem,
  MeaningUnitItem,
  InterviewCodeItem,
  TriangulationEntryItem,
  RepresentativeQuoteItem,
  AnalysisRunItem,
} from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import {
  Mic,
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  Volume2,
  Trash2,
  Plus,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Copy,
  Check,
  Download,
  Filter,
  Layers,
  BookOpen,
  HelpCircle,
  ExternalLink,
  MessageSquare,
  FileCheck2,
} from 'lucide-react';
import Link from 'next/link';

export default function InterviewAnalysisPage() {
  const { t, language } = useTranslation();
  const toast = useToast();

  // Active step/tab
  type TabKey = 'transcript' | 'units' | 'coding' | 'triangulation' | 'teacher_case' | 'quotes';
  const [activeTab, setActiveTab] = useState<TabKey>('transcript');

  // Teachers list (T01 - T12)
  const teachers = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08', 'T09', 'T10', 'T11', 'T12'];
  const [selectedTeacher, setSelectedTeacher] = useState<string>('T01');

  // Current analysis run
  const [activeRunId, setActiveRunId] = useState<string>('');
  const [runs, setRuns] = useState<AnalysisRunItem[]>([]);

  // Tab 1: Audio & Transcript state
  const [transcriptMode, setTranscriptMode] = useState<'raw' | 'polished'>('raw');
  const [responses, setResponses] = useState<InterviewResponseItem[]>([]);
  const [activeResponse, setActiveResponse] = useState<InterviewResponseItem | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [editingRawText, setEditingRawText] = useState('');
  const [editingResponseText, setEditingResponseText] = useState('');

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Tab 2: Meaning units state
  const [meaningUnits, setMeaningUnits] = useState<MeaningUnitItem[]>([]);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [newUnitText, setNewUnitText] = useState('');

  // Tab 3: Coding state
  const [interviewCodes, setInterviewCodes] = useState<InterviewCodeItem[]>([]);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);

  // Tab 4: Triangulation state
  const [triangulationEntries, setTriangulationEntries] = useState<TriangulationEntryItem[]>([]);
  const [isTriangulating, setIsTriangulating] = useState(false);

  // Tab 6: Quotes state
  const [quotes, setQuotes] = useState<RepresentativeQuoteItem[]>([]);
  const [isSelectingQuotes, setIsSelectingQuotes] = useState(false);
  const [rqFilter, setRqFilter] = useState<string>('all');
  const [copiedQuoteId, setCopiedQuoteId] = useState<string | null>(null);

  // Initial load: Fetch runs
  useEffect(() => {
    async function loadRuns() {
      try {
        const res = await api.listAnalysisRuns();
        if (res && res.length > 0) {
          setRuns(res);
          setActiveRunId(res[0].id);
        }
      } catch (err) {
        console.error('Failed to load analysis runs:', err);
      }
    }
    loadRuns();
  }, []);

  // Reload teacher responses when selectedTeacher or activeRunId changes
  useEffect(() => {
    loadTeacherData();
  }, [selectedTeacher, activeRunId]);

  // Load quotes and triangulation for run
  useEffect(() => {
    if (!activeRunId) return;
    loadRunLevelData();
  }, [activeRunId]);

  async function loadTeacherData() {
    if (!selectedTeacher) return;
    try {
      const res = await api.getInterviewResponses(selectedTeacher, activeRunId);
      setResponses(res || []);
      if (res && res.length > 0) {
        const primary = res[0];
        setActiveResponse(primary);
        setEditingRawText(primary.raw_transcript || '');
        setEditingResponseText(primary.response_text || '');
      } else {
        setActiveResponse(null);
        setEditingRawText('');
        setEditingResponseText('');
      }

      // Load meaning units
      const units = await api.getMeaningUnits(selectedTeacher);
      setMeaningUnits(units || []);
    } catch (err) {
      console.error('Failed to load teacher data:', err);
    }
  }

  async function loadRunLevelData() {
    if (!activeRunId) return;
    try {
      const [codesData, triData, quotesData] = await Promise.all([
        api.getInterviewCodes(activeRunId).catch(() => []),
        api.getInterviewTriangulation(activeRunId).catch(() => []),
        api.getRepresentativeQuotes(activeRunId).catch(() => []),
      ]);
      setInterviewCodes(codesData || []);
      setTriangulationEntries(triData || []);
      setQuotes(quotesData || []);
    } catch (err) {
      console.error('Failed to load run-level data:', err);
    }
  }

  // Audio file upload handler
  async function handleAudioUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const uploaded = await api.uploadInterviewAudio(selectedTeacher, activeRunId, file);
      toast.success(
        language === 'vi'
          ? `Tải lên file ${file.name} cho giáo viên ${selectedTeacher} thành công!`
          : `Uploaded audio ${file.name} for teacher ${selectedTeacher}!`
      );
      await loadTeacherData();
      setActiveResponse(uploaded);
    } catch (err: any) {
      toast.error(err.message || 'Audio upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  }

  // Trigger AI Transcription
  async function handleTranscribe() {
    if (!activeResponse) {
      toast.error(language === 'vi' ? 'Chưa có file ghi âm nào' : 'No audio recording selected');
      return;
    }
    setIsTranscribing(true);
    try {
      const res = await api.transcribeInterviewAudio(activeResponse.id);
      setActiveResponse(res);
      setEditingRawText(res.raw_transcript || '');
      setEditingResponseText(res.response_text || '');
      toast.success(
        language === 'vi'
          ? 'Đã bóc băng phỏng vấn thành công bằng AI Multimodal!'
          : 'Interview audio transcribed successfully via AI Multimodal!'
      );
      await loadTeacherData();
    } catch (err: any) {
      toast.error(err.message || 'Transcription failed');
    } finally {
      setIsTranscribing(false);
    }
  }

  // Finalize reviewed response
  async function handleFinalize() {
    if (!activeResponse) return;
    setIsFinalizing(true);
    try {
      const textToFinalize = transcriptMode === 'raw' ? editingRawText : editingResponseText;
      const res = await api.finalizeInterviewResponse(activeResponse.id, textToFinalize);
      setActiveResponse(res);
      toast.success(t('iaFinalizedSuccess'));
      await loadTeacherData();
    } catch (err: any) {
      toast.error(err.message || 'Finalization failed');
    } finally {
      setIsFinalizing(false);
    }
  }

  // Trigger Meaning Unit Segmentation
  async function handleSegment() {
    if (!activeResponse) {
      toast.error(language === 'vi' ? 'Vui lòng bóc băng hoặc nhập câu trả lời trước' : 'Please transcribe or enter a response first');
      return;
    }
    setIsSegmenting(true);
    try {
      const units = await api.segmentMeaningUnits(activeResponse.id);
      setMeaningUnits(units);
      toast.success(
        language === 'vi'
          ? `Đã tách thành công ${units.length} đơn vị ý nghĩa (Meaning Units)!`
          : `Successfully segmented into ${units.length} meaning units!`
      );
    } catch (err: any) {
      toast.error(err.message || 'Segmentation failed');
    } finally {
      setIsSegmenting(false);
    }
  }

  // Add a manual Meaning Unit
  async function handleAddMeaningUnit() {
    if (!newUnitText.trim() || !activeResponse) return;
    try {
      const created = await api.createMeaningUnit({
        response_id: activeResponse.id,
        teacher_id: selectedTeacher,
        unit_text: newUnitText.trim(),
        unit_index: meaningUnits.length + 1,
      });
      setMeaningUnits([...meaningUnits, created]);
      setNewUnitText('');
      toast.success(language === 'vi' ? 'Đã thêm đơn vị ý nghĩa' : 'Added meaning unit');
    } catch (err: any) {
      toast.error(err.message || 'Failed to add meaning unit');
    }
  }

  // Delete Meaning Unit
  async function handleDeleteMeaningUnit(id: string) {
    try {
      await api.deleteMeaningUnit(id);
      setMeaningUnits(meaningUnits.filter((u) => u.id !== id));
      toast.success(language === 'vi' ? 'Đã xóa ý' : 'Deleted unit');
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete unit');
    }
  }

  // Trigger Initial Coding & Categorization
  async function handleGenerateCodes() {
    if (meaningUnits.length === 0) {
      toast.error(language === 'vi' ? 'Chưa có Meaning Units nào để mã hóa' : 'No meaning units found to code');
      return;
    }
    setIsGeneratingCodes(true);
    try {
      const res = await api.generateInterviewCodes(selectedTeacher, activeRunId);
      setMeaningUnits(res.meaning_units);
      setInterviewCodes(res.codes);
      toast.success(
        language === 'vi'
          ? `AI đã gợi ý mã ban đầu và phân nhóm cho ${res.meaning_units.length} đơn vị ý nghĩa!`
          : `AI generated initial codes and categories for ${res.meaning_units.length} units!`
      );
      await loadRunLevelData();
    } catch (err: any) {
      toast.error(err.message || 'Coding failed');
    } finally {
      setIsGeneratingCodes(false);
    }
  }

  // Trigger Triangulation
  async function handleRunTriangulation() {
    if (!activeRunId) return;
    setIsTriangulating(true);
    try {
      const entries = await api.runInterviewTriangulation(activeRunId);
      setTriangulationEntries(entries);
      toast.success(
        language === 'vi'
          ? `Đã hoàn thành đối chiếu tam giác với ${entries.length} mối liên hệ được phân tích!`
          : `Triangulation complete with ${entries.length} relationships analyzed!`
      );
    } catch (err: any) {
      toast.error(err.message || 'Triangulation failed');
    } finally {
      setIsTriangulating(false);
    }
  }

  // Trigger Quote Selection
  async function handleSelectQuotes() {
    if (!activeRunId) return;
    setIsSelectingQuotes(true);
    try {
      const res = await api.selectRepresentativeQuotes(activeRunId);
      setQuotes(res);
      toast.success(
        language === 'vi'
          ? `Đã tuyển chọn ${res.length} câu trích dẫn tiêu biểu cho luận văn!`
          : `Selected ${res.length} representative quotes for thesis write-up!`
      );
    } catch (err: any) {
      toast.error(err.message || 'Quote selection failed');
    } finally {
      setIsSelectingQuotes(false);
    }
  }

  // Toggle quote inclusion
  async function handleToggleQuote(quote: RepresentativeQuoteItem) {
    const updated = !quote.is_selected;
    try {
      await api.toggleQuoteSelection(quote.id, updated);
      setQuotes(quotes.map((q) => (q.id === quote.id ? { ...q, is_selected: updated } : q)));
    } catch (err: any) {
      toast.error('Failed to update quote status');
    }
  }

  // Audio playback controls
  function togglePlayPause() {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }

  function seekTo(sec: number) {
    if (!audioRef.current) return;
    audioRef.current.currentTime = sec;
    setCurrentTime(sec);
  }

  function changePlaybackRate(rate: number) {
    if (!audioRef.current) return;
    audioRef.current.playbackRate = rate;
    setPlaybackRate(rate);
  }

  // Jump audio when clicking timestamp in transcript
  function handleTimestampClick(tsStr: string) {
    const match = tsStr.match(/\[?(\d+):(\d+)\]?/);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      seekTo(min * 60 + sec);
      if (audioRef.current && !isPlaying) {
        audioRef.current.play();
        setIsPlaying(true);
      }
    }
  }

  // Copy quote to clipboard
  function copyQuoteToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedQuoteId(id);
    setTimeout(() => setCopiedQuoteId(null), 2000);
    toast.success(language === 'vi' ? 'Đã sao chép vào bộ nhớ tạm' : 'Copied to clipboard');
  }

  // Export quotes to Markdown file
  function exportQuotesToMarkdown() {
    const selected = quotes.filter((q) => q.is_selected);
    if (selected.length === 0) {
      toast.error(language === 'vi' ? 'Chưa có trích dẫn nào được chọn' : 'No quotes selected');
      return;
    }

    let md = `# Qualitative Findings: Representative Teacher Interview Quotes\n\n`;
    md += `*Generated for Primary EFL Classroom Management Research Thesis*\n\n`;

    ['RQ1', 'RQ2', 'RQ3'].forEach((rq) => {
      const rqQuotes = selected.filter((q) => q.rq_category === rq);
      if (rqQuotes.length > 0) {
        md += `## ${rq} Findings\n\n`;
        rqQuotes.forEach((q) => {
          md += `> "${q.quote_text}"\n`;
          md += `> — **Teacher ${q.teacher_id}** (${q.quote_source || 'Interview'}), Relevance: *${q.relevance_type}*\n\n`;
        });
      }
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Thesis_Quotes_${selectedTeacher}_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(language === 'vi' ? 'Đã xuất file Markdown' : 'Exported Markdown');
  }

  // Status badge styling matching Observation Studio aesthetic
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'finalized':
        return <span className="badge badge-audio"><CheckCircle2 size={11} /> {t('iaStatusFinalized')}</span>;
      case 'transcribed':
        return <span className="badge badge-visual"><Clock size={11} /> {t('iaStatusTranscribed')}</span>;
      case 'transcribing':
        return <span className="badge badge-context"><RefreshCw size={11} className="animate-spin" /> {t('iaStatusTranscribing')}</span>;
      case 'uploaded':
        return <span className="badge badge-theme"><Volume2 size={11} /> {t('iaStatusUploaded')}</span>;
      default:
        return <span className="badge badge-neutral">Draft</span>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '80px' }}>
      {/* Top Header & Navigation Quick Links */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--card-border)',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
            <h2 style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '32px',
              fontWeight: 400,
              color: 'var(--accent)',
              lineHeight: 1.1,
            }}>
              {t('interviewAnalysisTitle')}
            </h2>
            <span className="badge badge-theme">Phase 07 • Post-Interview Studio</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', maxWidth: '820px' }}>
            {t('interviewAnalysisSubtitle')}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <Link
            href="/interview"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <MessageSquare size={14} style={{ color: 'var(--accent)' }} />
            {language === 'vi' ? 'Interview Studio' : 'Interview Studio'}
          </Link>
          <Link
            href="/settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <ExternalLink size={14} style={{ color: 'var(--accent)' }} />
            {language === 'vi' ? 'Cấu hình AI Flow' : 'AI Flow Config'}
          </Link>
        </div>
      </div>

      {/* Teacher Selector Card with Analysis Run Filter */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '16px 20px',
        boxShadow: 'var(--shadow-sm)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Teacher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.6px',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            {t('iaTeacherSelect')}:
          </span>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {teachers.map((tid) => {
              const isSelected = selectedTeacher === tid;
              return (
                <button
                  key={tid}
                  onClick={() => setSelectedTeacher(tid)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: isSelected ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                    backgroundColor: isSelected ? 'var(--accent)' : 'var(--bg)',
                    color: isSelected ? '#FFFFFF' : 'var(--text-main)',
                    fontSize: '12.5px',
                    fontWeight: isSelected ? 600 : 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tid}
                </button>
              );
            })}
          </div>
        </div>

        {/* Analysis Run Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Analysis Run:</span>
          <select
            value={activeRunId}
            onChange={(e) => setActiveRunId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--bg)',
              color: 'var(--text-main)',
              fontSize: '12.5px',
              cursor: 'pointer',
              outline: 'none',
            }}
          >
            {runs.map((r) => (
              <option key={r.id} value={r.id}>
                {r.id.slice(0, 8)}... ({new Date(r.triggered_at).toLocaleDateString()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 6 Workflow Tabs Bar */}
      <div style={{
        display: 'flex',
        gap: '4px',
        backgroundColor: 'var(--sidebar-bg)',
        padding: '4px',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--card-border)',
        overflowX: 'auto',
      }}>
        {[
          { key: 'transcript', label: t('iaTabAudioTranscript'), icon: Volume2 },
          { key: 'units', label: t('iaTabMeaningUnits'), icon: Layers, count: meaningUnits.length },
          { key: 'coding', label: t('iaTabCoding'), icon: BookOpen, count: interviewCodes.length },
          { key: 'triangulation', label: t('iaTabTriangulation'), icon: ShieldCheck, count: triangulationEntries.length },
          { key: 'teacher_case', label: t('iaTabPerTeacher'), icon: FileCheck2 },
          { key: 'quotes', label: t('iaTabQuotes'), icon: Sparkles, count: quotes.filter((q) => q.is_selected).length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabKey)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FFFFFF' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--accent)' : 'transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--card-border)',
                  color: isActive ? '#FFFFFF' : 'var(--text-main)',
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUDIO UPLOAD & DUAL-MODE TRANSCRIPT REVIEW */}
      {activeTab === 'transcript' && (
        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
          {/* Left Panel: Audio Manager & Player */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Audio Upload Card */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <Mic size={18} style={{ color: 'var(--accent)' }} />
                <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                  {t('iaUploadTitle')}
                </h3>
              </div>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.45 }}>
                {t('iaUploadDesc')}
              </p>

              <label
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '2px dashed var(--accent)',
                  backgroundColor: 'var(--accent-soft)',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  textAlign: 'center',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <UploadCloud size={32} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--accent)' }}>
                  {isUploading
                    ? (language === 'vi' ? 'Đang tải lên...' : 'Uploading...')
                    : (language === 'vi' ? 'Chọn file ghi âm (.mp3 / .wav / .m4a)' : 'Choose audio (.mp3 / .wav / .m4a)')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Max 250MB • Bilingual EN / VI
                </span>
                <input
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
                  onChange={handleAudioUpload}
                  disabled={isUploading}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Uploaded File Info & AI Transcribe Action */}
              {activeResponse && (
                <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                    {renderStatusBadge(activeResponse.transcript_status)}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-main)',
                    wordBreak: 'break-all',
                    marginBottom: '14px',
                    backgroundColor: 'var(--bg)',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--card-border)',
                  }}>
                    🎵 {activeResponse.audio_filename || 'interview_audio.mp3'}
                  </div>

                  <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    style={{
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isTranscribing ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {isTranscribing ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" />
                        <span>{t('iaTranscribing')}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} />
                        <span>{t('iaTranscribeBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Built-in Audio Player */}
            {activeResponse?.audio_blob_path && (
              <div style={{
                backgroundColor: 'var(--card-bg)',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                boxShadow: 'var(--shadow-sm)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <Volume2 size={16} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {t('iaListenAudio')}
                  </span>
                </div>

                <audio
                  ref={audioRef}
                  src={activeResponse.audio_blob_path}
                  onTimeUpdate={() => audioRef.current && setCurrentTime(audioRef.current.currentTime)}
                  onLoadedMetadata={() => audioRef.current && setDuration(audioRef.current.duration)}
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Scrubber slider */}
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--accent)', marginBottom: '8px' }}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                  <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
                  <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
                </div>

                {/* Play/Pause & Speed */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <button
                    onClick={togglePlayPause}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      backgroundColor: 'var(--accent)',
                      color: '#FFFFFF',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? 'Pause' : 'Play'}</span>
                  </button>

                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[1, 1.25, 1.5].map((rate) => (
                      <button
                        key={rate}
                        onClick={() => changePlaybackRate(rate)}
                        style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          border: '1px solid var(--card-border)',
                          backgroundColor: playbackRate === rate ? 'var(--accent-soft)' : 'var(--bg)',
                          color: playbackRate === rate ? 'var(--accent)' : 'var(--text-muted)',
                          fontSize: '11px',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {rate}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel: Dual-Mode Transcript Review Workspace */}
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            {/* Header & Mode Switcher */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--card-border)',
              paddingBottom: '16px',
              marginBottom: '20px',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-serif)',
                  fontSize: '22px',
                  fontWeight: 400,
                  color: 'var(--accent)',
                  margin: 0,
                }}>
                  Teacher {selectedTeacher} Interview Transcript
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Language: <strong style={{ textTransform: 'uppercase', color: 'var(--text-main)' }}>{activeResponse?.language || 'vi'}</strong> • Status: {activeResponse?.transcript_status || 'draft'}
                </span>
              </div>

              {/* Mode Toggle Pills */}
              <div style={{
                display: 'flex',
                backgroundColor: 'var(--sidebar-bg)',
                padding: '4px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--card-border)',
                gap: '4px',
              }}>
                <button
                  onClick={() => setTranscriptMode('raw')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: transcriptMode === 'raw' ? 'var(--accent)' : 'transparent',
                    color: transcriptMode === 'raw' ? '#FFFFFF' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t('iaModeRaw')}
                </button>
                <button
                  onClick={() => setTranscriptMode('polished')}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    backgroundColor: transcriptMode === 'polished' ? 'var(--accent)' : 'transparent',
                    color: transcriptMode === 'polished' ? '#FFFFFF' : 'var(--text-muted)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t('iaModePolished')}
                </button>
              </div>
            </div>

            {/* MODE 1: RAW AUDIO TRANSCRIPT VIEW */}
            {transcriptMode === 'raw' && (
              <div>
                <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    💡 Tip: Nhấp vào mốc thời gian <code style={{ color: 'var(--accent)', fontWeight: 600 }}>[MM:SS]</code> để tua audio trực tiếp. Bạn có thể sửa văn bản ngay bên dưới.
                  </span>
                  <span className="badge badge-audio">Verbatim Timeline</span>
                </div>

                <textarea
                  value={editingRawText}
                  onChange={(e) => setEditingRawText(e.target.value)}
                  placeholder="Raw transcript with timestamps and speakers will appear here once transcribed..."
                  style={{
                    width: '100%',
                    height: '420px',
                    backgroundColor: '#FAF7F2',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '16px',
                    fontSize: '13.5px',
                    lineHeight: '1.65',
                    color: 'var(--text-main)',
                    fontFamily: 'var(--font-mono)',
                    resize: 'vertical',
                    outline: 'none',
                  }}
                />
              </div>
            )}

            {/* MODE 2: POLISHED Q&A CARDS VIEW */}
            {transcriptMode === 'polished' && (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Giao diện cấu trúc hóa câu hỏi và câu trả lời tương ứng phục vụ phân tích định tính.
                  </span>
                  <span className="badge badge-visual">Structured Q&A Cards</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '450px', overflowY: 'auto' }}>
                  {responses.length > 0 ? (
                    responses.map((resp, idx) => (
                      <div
                        key={resp.id}
                        style={{
                          padding: '16px',
                          backgroundColor: 'var(--bg)',
                          border: '1px solid var(--card-border)',
                          borderLeft: '4px solid var(--accent)',
                          borderRadius: 'var(--radius-sm)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                            Question #{idx + 1}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Teacher {resp.teacher_id}
                          </span>
                        </div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
                          {resp.question_text || 'Teacher Interview Question'}
                        </h4>
                        <textarea
                          defaultValue={resp.response_text}
                          onBlur={(e) => {
                            if (e.target.value !== resp.response_text) {
                              api.finalizeInterviewResponse(resp.id, e.target.value).then(() => {
                                toast.success(language === 'vi' ? 'Đã cập nhật câu trả lời' : 'Updated response');
                              });
                            }
                          }}
                          placeholder="Teacher's answer..."
                          style={{
                            width: '100%',
                            minHeight: '90px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--card-border)',
                            borderRadius: 'var(--radius-sm)',
                            padding: '12px',
                            fontSize: '13px',
                            lineHeight: '1.5',
                            color: 'var(--text-main)',
                            outline: 'none',
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                      Chưa có dữ liệu câu hỏi - trả lời. Vui lòng tải lên audio và bấm Bóc Băng Bằng AI.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Finalize Actions */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <button
                onClick={handleFinalize}
                disabled={isFinalizing || !activeResponse}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isFinalizing ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <CheckCircle2 size={16} />
                <span>{isFinalizing ? 'Finalizing...' : t('iaFinalizeBtn')}</span>
              </button>

              <button
                onClick={() => setActiveTab('units')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span>Chuyển sang Bước 2 (Meaning Units)</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MEANING UNITS SEGMENTATION */}
      {activeTab === 'units' && (
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                Meaning Units Segmentation — Teacher {selectedTeacher}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Tách từng ý sư phạm độc lập theo chuẩn Qualitative Content Analysis (Schreier, 2012).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={handleSegment}
                disabled={isSegmenting}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isSegmenting ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={14} />
                <span>{isSegmenting ? t('iaSegmenting') : t('iaSegmentBtn')}</span>
              </button>
              <button
                onClick={() => setActiveTab('coding')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <span>Sang Bước 3 (Gắn Mã) →</span>
              </button>
            </div>
          </div>

          {/* Quick Add Meaning Unit Form */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '20px',
            backgroundColor: 'var(--bg)',
            padding: '12px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--card-border)',
          }}>
            <input
              type="text"
              value={newUnitText}
              onChange={(e) => setNewUnitText(e.target.value)}
              placeholder="Nhập thủ công thêm một đơn vị ý nghĩa (Meaning Unit)..."
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--card-border)',
                backgroundColor: '#FFFFFF',
                color: 'var(--text-main)',
                fontSize: '13px',
                outline: 'none',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMeaningUnit()}
            />
            <button
              onClick={handleAddMeaningUnit}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} />
              <span>{t('iaAddMeaningUnit')}</span>
            </button>
          </div>

          {/* Meaning Units Table */}
          <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ width: '50px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>#</th>
                  <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('iaUnitText')}</th>
                  <th style={{ width: '220px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('iaInitialCode')}</th>
                  <th style={{ width: '220px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('iaCategory')}</th>
                  <th style={{ width: '70px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {meaningUnits.length > 0 ? (
                  meaningUnits.map((u, idx) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border-soft)' }}>
                      <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>
                        {u.unit_index || idx + 1}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <input
                          defaultValue={u.unit_text}
                          onBlur={(e) => {
                            if (e.target.value !== u.unit_text) {
                              api.updateMeaningUnit(u.id, { unit_text: e.target.value });
                            }
                          }}
                          style={{
                            width: '100%',
                            fontSize: '13px',
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: 'var(--text-main)',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-visual">
                          {u.initial_code || 'Uncoded'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-theme">
                          {u.category || 'Uncategorized'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                        <button
                          onClick={() => handleDeleteMeaningUnit(u.id)}
                          style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Chưa có Meaning Units nào. Bấm nút <strong>"AI Tách Meaning Units"</strong> để tự động bóc tách từ câu trả lời của giáo viên {selectedTeacher}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: INITIAL CODING & CATEGORIZATION */}
      {activeTab === 'coding' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                  Initial Qualitative Coding & Categorization
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  Gắn mã hành vi sư phạm và gom cụm thành các Category cho luận văn.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleGenerateCodes}
                  disabled={isGeneratingCodes}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isGeneratingCodes ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Sparkles size={14} />
                  <span>{isGeneratingCodes ? t('iaGeneratingCodes') : t('iaGenerateCodesBtn')}</span>
                </button>
                <button
                  onClick={() => setActiveTab('triangulation')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--card-border)',
                    backgroundColor: 'var(--bg)',
                    color: 'var(--text-main)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  <span>Sang Bước 4 (Đối Chiếu) →</span>
                </button>
              </div>
            </div>

            {/* Coding Matrix */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ width: '45%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Meaning Unit (Verbatim Quote)
                    </th>
                    <th style={{ width: '25%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Initial Code
                    </th>
                    <th style={{ width: '30%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Pedagogical Category
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {meaningUnits.map((u) => (
                    <tr key={u.id} style={{ borderBottom: '1px solid var(--card-border-soft)' }}>
                      <td style={{ padding: '12px 14px', fontSize: '13px', lineHeight: 1.45, color: 'var(--text-main)' }}>
                        "{u.unit_text}"
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <input
                          defaultValue={u.initial_code || ''}
                          onBlur={(e) => {
                            if (e.target.value !== u.initial_code) {
                              api.updateMeaningUnit(u.id, { initial_code: e.target.value });
                            }
                          }}
                          placeholder="Assign initial code..."
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '12.5px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--card-border)',
                            backgroundColor: 'var(--bg)',
                            color: 'var(--text-main)',
                            outline: 'none',
                          }}
                        />
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <input
                          defaultValue={u.category || ''}
                          onBlur={(e) => {
                            if (e.target.value !== u.category) {
                              api.updateMeaningUnit(u.id, { category: e.target.value });
                            }
                          }}
                          placeholder="Assign category..."
                          style={{
                            width: '100%',
                            padding: '6px 10px',
                            fontSize: '12.5px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--card-border)',
                            backgroundColor: 'var(--bg)',
                            color: 'var(--text-main)',
                            outline: 'none',
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Aggregated Codebook Across Teachers */}
          {interviewCodes.length > 0 && (
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <h4 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--accent)', marginBottom: '14px' }}>
                Tổng Hợp Sổ Mã Phỏng Vấn (All Teachers Aggregated Codebook)
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Initial Code</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Category</th>
                      <th style={{ width: '100px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>Tần suất</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>Giáo viên</th>
                    </tr>
                  </thead>
                  <tbody>
                    {interviewCodes.map((code) => (
                      <tr key={code.id} style={{ borderBottom: '1px solid var(--card-border-soft)' }}>
                        <td style={{ padding: '10px 14px', fontWeight: 600, fontSize: '13px' }}>{code.code_name}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <span className="badge badge-theme">
                            {code.category}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{code.frequency}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {code.teacher_ids?.map((tid) => (
                              <span key={tid} className="badge badge-neutral" style={{ fontSize: '10px' }}>
                                {tid}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: OBSERVATION-INTERVIEW TRIANGULATION */}
      {activeTab === 'triangulation' && (
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                Observation–Interview Triangulation Matrix
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Đối chiếu tam giác giữa phát hiện quan sát thực tế (Video) và trần thuật phỏng vấn của giáo viên.
              </p>
            </div>

            <button
              onClick={handleRunTriangulation}
              disabled={isTriangulating}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isTriangulating ? 'not-allowed' : 'pointer',
              }}
            >
              <ShieldCheck size={16} />
              <span>{isTriangulating ? t('iaRunningTriangulation') : t('iaRunTriangulationBtn')}</span>
            </button>
          </div>

          <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)' }}>
                  <th style={{ width: '35%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('iaObservationFinding')}
                  </th>
                  <th style={{ width: '35%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {t('iaInterviewEvidence')}
                  </th>
                  <th style={{ width: '100px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Teacher
                  </th>
                  <th style={{ width: '160px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('iaRelationship')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {triangulationEntries.length > 0 ? (
                  triangulationEntries.map((entry) => (
                    <tr key={entry.id} style={{ borderBottom: '1px solid var(--card-border-soft)' }}>
                      <td style={{ padding: '12px 14px', fontSize: '13px', lineHeight: 1.5 }}>
                        {entry.observation_finding}
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '13px', lineHeight: 1.5 }}>
                        "{entry.interview_evidence}"
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        <span className="badge badge-visual">{entry.teacher_ref || 'General'}</span>
                      </td>
                      <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                        {entry.relationship === 'confirms' && (
                          <span className="badge badge-audio">{t('iaRelationshipConfirms')}</span>
                        )}
                        {entry.relationship === 'explains' && (
                          <span className="badge badge-visual">{t('iaRelationshipExplains')}</span>
                        )}
                        {entry.relationship === 'contradicts' && (
                          <span className="badge badge-context">{t('iaRelationshipContradicts')}</span>
                        )}
                        {entry.relationship === 'adds_info' && (
                          <span className="badge badge-theme">{t('iaRelationshipAddsInfo')}</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      Chưa có dữ liệu đối chiếu tam giác. Bấm <strong>"Chạy Đối Chiếu Tam Giác"</strong> để AI tự động so sánh toàn diện.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: PER-TEACHER CASE ANALYSIS */}
      {activeTab === 'teacher_case' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          {/* Left: Video Observations */}
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <FileCheck2 size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                Teacher {selectedTeacher} — Video Observation Profile
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Dữ liệu quan sát rút ra từ 2 tiết dạy thực tế của giáo viên {selectedTeacher}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                  Video Lessons
                </span>
                <p style={{ fontSize: '13.5px', margin: '4px 0 0 0', fontWeight: 600 }}>
                  {selectedTeacher}_L1 & {selectedTeacher}_L2
                </p>
              </div>

              <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent-green)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase' }}>
                  Triangulated Confirmations
                </span>
                <p style={{ fontSize: '12.5px', margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
                  {triangulationEntries.filter((t) => t.teacher_ref === selectedTeacher).length} phát hiện đã được đối chiếu với phát ngôn phỏng vấn.
                </p>
              </div>
            </div>
          </div>

          {/* Right: Interview Self-report */}
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '20px',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <Mic size={18} style={{ color: 'var(--accent-purple)' }} />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                Teacher {selectedTeacher} — Interview Explanations
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Phát ngôn trực tiếp từ buổi phỏng vấn sâu của giáo viên {selectedTeacher}.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '380px', overflowY: 'auto' }}>
              {meaningUnits.length > 0 ? (
                meaningUnits.map((u) => (
                  <div key={u.id} style={{
                    padding: '12px',
                    backgroundColor: 'var(--bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--card-border)',
                    fontSize: '12.5px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{u.initial_code || 'Uncoded'}</span>
                      <span className="badge badge-theme" style={{ fontSize: '10px' }}>{u.category || 'General'}</span>
                    </div>
                    <span style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>"{u.unit_text}"</span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '24px' }}>
                  Chưa có meaning units cho giáo viên này.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: REPRESENTATIVE QUOTES & EXPORT */}
      {activeTab === 'quotes' && (
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                {t('iaTabQuotes')} (Thesis Findings Citations)
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                Tuyển chọn những câu trích dẫn đắt giá nhất phân theo Research Questions (RQ1, RQ2, RQ3).
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* RQ Filter Buttons */}
              <div style={{ display: 'flex', gap: '4px' }}>
                {['all', 'RQ1', 'RQ2', 'RQ3'].map((rq) => (
                  <button
                    key={rq}
                    onClick={() => setRqFilter(rq)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: rqFilter === rq ? '1px solid var(--accent)' : '1px solid var(--card-border)',
                      backgroundColor: rqFilter === rq ? 'var(--accent)' : 'var(--bg)',
                      color: rqFilter === rq ? '#FFFFFF' : 'var(--text-main)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    {rq === 'all' ? 'All RQs' : rq}
                  </button>
                ))}
              </div>

              <button
                onClick={handleSelectQuotes}
                disabled={isSelectingQuotes}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isSelectingQuotes ? 'not-allowed' : 'pointer',
                }}
              >
                <Sparkles size={14} />
                <span>{isSelectingQuotes ? t('iaSelectingQuotes') : t('iaSelectQuotesBtn')}</span>
              </button>

              <button
                onClick={exportQuotesToMarkdown}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Download size={14} />
                <span>{t('iaExportBtn')}</span>
              </button>
            </div>
          </div>

          {/* Quotes List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {quotes
              .filter((q) => rqFilter === 'all' || q.rq_category === rqFilter)
              .map((q) => (
                <div
                  key={q.id}
                  style={{
                    padding: '16px 20px',
                    backgroundColor: q.is_selected ? '#FAF7F2' : 'var(--card-bg)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--card-border)',
                    borderLeft: `4px solid ${q.rq_category === 'RQ1' ? 'var(--accent-green)' : q.rq_category === 'RQ2' ? 'var(--accent-blue)' : 'var(--accent-amber)'}`,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span className={`badge ${q.rq_category === 'RQ1' ? 'badge-audio' : q.rq_category === 'RQ2' ? 'badge-visual' : 'badge-context'}`}>
                        {q.rq_category}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Teacher {q.teacher_id}</span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>• {q.quote_source || 'Interview'}</span>
                      <span className="badge badge-theme" style={{ fontSize: '10px' }}>
                        {q.relevance_type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => copyQuoteToClipboard(q.quote_text, q.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title="Copy quote"
                      >
                        {copiedQuoteId === q.id ? <Check size={14} style={{ color: 'var(--accent-green)' }} /> : <Copy size={14} />}
                      </button>

                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', cursor: 'pointer', color: 'var(--text-main)' }}>
                        <input
                          type="checkbox"
                          checked={q.is_selected}
                          onChange={() => handleToggleQuote(q)}
                          style={{ accentColor: 'var(--accent)' }}
                        />
                        <span>{t('iaSelectedQuotes')}</span>
                      </label>
                    </div>
                  </div>

                  <blockquote style={{
                    margin: '8px 0 0 0',
                    fontSize: '13.5px',
                    fontStyle: 'italic',
                    color: 'var(--text-main)',
                    lineHeight: 1.55,
                  }}>
                    "{q.quote_text}"
                  </blockquote>
                </div>
              ))}

            {quotes.length === 0 && (
              <div style={{ textAlign: 'center', padding: '50px', color: 'var(--text-muted)' }}>
                Chưa có câu trích dẫn nào. Bấm <strong>"AI Tuyển Chọn Trích Dẫn Vàng"</strong> để lọc các phát ngôn xuất sắc nhất từ dữ liệu phỏng vấn.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
