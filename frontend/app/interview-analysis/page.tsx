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
import {
  generateChapter4FindingsWord,
  generatePerTeacherCaseWord,
  downloadWordBlob,
} from '@/lib/qualitativeWordExport';
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
  Lock,
  AlertTriangle,
  Target,
  Eye,
  Zap,
  Info,
  FileAudio,
  X,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { FeatureWorkflowBanner } from '@/components/FeatureWorkflowBanner';
import { exportQualitativeZipPackage } from '@/lib/qualitativeZipExport';

export default function InterviewAnalysisPage() {
  const { t, language } = useTranslation();
  const toast = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

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
  const [isAligningQA, setIsAligningQA] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [allTeacherStatuses, setAllTeacherStatuses] = useState<Record<string, string>>({});
  const [editingRawText, setEditingRawText] = useState('');
  const [editingResponseText, setEditingResponseText] = useState('');
  const [isLoadingTeacher, setIsLoadingTeacher] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Drag & drop and Overwrite confirmation state
  const [isDragging, setIsDragging] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [overwriteMode, setOverwriteMode] = useState<'replace_audio' | 'full_reset'>('replace_audio');

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
  const [isExportingChapter4Word, setIsExportingChapter4Word] = useState<boolean>(false);
  const [isExportingTeacherCaseWord, setIsExportingTeacherCaseWord] = useState<boolean>(false);

  // Download All Qualitative ZIP export state
  const [showZipExportModal, setShowZipExportModal] = useState<boolean>(false);
  const [zipExportScope, setZipExportScope] = useState<'all' | 'current'>('all');
  const [isExportingZip, setIsExportingZip] = useState<boolean>(false);
  const [zipExportProgress, setZipExportProgress] = useState<{
    current: number;
    total: number;
    message: string;
    percentage: number;
  } | null>(null);

  // Derived state: transcribing in memory OR in database status
  const isCurrentlyTranscribing = isTranscribing || activeResponse?.transcript_status === 'transcribing';

  // Derived state: Step 1 Completion & Q&A Cards presence
  const qaCards = responses.filter((r) => r.question_text !== 'Full Teacher Interview Recording');
  const finalizedCardsCount = qaCards.filter((c) => c.transcript_status === 'finalized').length;
  const isTranscriptAvailable = Boolean(
    (activeResponse?.raw_transcript && activeResponse.raw_transcript.trim() !== '') ||
    (activeResponse?.response_text && activeResponse.response_text.trim() !== '') ||
    (editingRawText && editingRawText.trim() !== '')
  );
  // STRICT GATING: Step 1 is complete ONLY when Q&A cards exist AND all cards are finalized!
  const isStep1Finalized = qaCards.length > 0 && finalizedCardsCount === qaCards.length;
  const isStep1Complete = isStep1Finalized;

  // Auto-redirect to 'transcript' tab if current tab is locked for the selected teacher (wait until loading finishes)
  useEffect(() => {
    if (!isLoadingTeacher && !isStep1Complete && activeTab !== 'transcript') {
      setActiveTab('transcript');
    }
  }, [isLoadingTeacher, isStep1Complete, activeTab]);

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

  // Reload teacher responses when selectedTeacher or activeRunId changes with cancellation protection
  useEffect(() => {
    let isCancelled = false;

    async function fetchTeacherData() {
      if (!selectedTeacher) return;
      setIsLoadingTeacher(true);

      // Immediately clear state so previous teacher's data is never displayed for the new teacher
      setResponses([]);
      setActiveResponse(null);
      setEditingRawText('');
      setEditingResponseText('');
      setMeaningUnits([]);

      try {
        const [res, units] = await Promise.all([
          api.getInterviewResponses(selectedTeacher, activeRunId),
          api.getMeaningUnits(selectedTeacher).catch(() => []),
        ]);

        if (isCancelled) return;

        const responseList = res || [];
        setResponses(responseList);
        if (responseList.length > 0) {
          const primary = responseList[0];
          setActiveResponse(primary);
          setEditingRawText(primary.raw_transcript || '');
          setEditingResponseText(primary.response_text || '');
        } else {
          setActiveResponse(null);
          setEditingRawText('');
          setEditingResponseText('');
        }
        setMeaningUnits(units || []);
      } catch (err) {
        if (!isCancelled) {
          console.error('Failed to load teacher data:', err);
          setResponses([]);
          setActiveResponse(null);
          setEditingRawText('');
          setEditingResponseText('');
          setMeaningUnits([]);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingTeacher(false);
        }
      }
    }

    fetchTeacherData();

    return () => {
      isCancelled = true;
    };
  }, [selectedTeacher, activeRunId]);

  // Load quotes and triangulation for run
  useEffect(() => {
    if (!activeRunId) return;
    loadRunLevelData();
  }, [activeRunId]);

  // Fetch summary status for all teachers
  async function loadAllTeacherStatuses() {
    if (!activeRunId) return;
    try {
      const all = await api.getInterviewResponses('all', activeRunId);
      if (all && all.length > 0) {
        const map: Record<string, string> = {};
        all.forEach((r) => {
          if (!map[r.teacher_id] || r.transcript_status === 'transcribing' || r.transcript_status === 'finalized') {
            map[r.teacher_id] = r.transcript_status;
          }
        });
        setAllTeacherStatuses(map);
      }
    } catch {
      // ignore
    }
  }

  // Real-time polling loop for active transcription, alignment, and background state
  useEffect(() => {
    loadAllTeacherStatuses();

    const isTaskRunning = isCurrentlyTranscribing || isAligningQA || isSegmenting || isGeneratingCodes || isTriangulating;
    const intervalTime = isTaskRunning ? 2000 : 5000;

    const interval = setInterval(async () => {
      // 1. Refresh all teacher statuses
      loadAllTeacherStatuses();

      // 2. Refresh selected teacher responses & meaning units (skip if teacher is actively loading)
      if (selectedTeacher && !isLoadingTeacher) {
        try {
          const res = await api.getInterviewResponses(selectedTeacher, activeRunId);
          if (res && res.length > 0) {
            setResponses(res);
            const primary = res[0];
            setActiveResponse((prev) => {
              // If status just transitioned from transcribing to transcribed
              if (prev && prev.transcript_status === 'transcribing' && primary.transcript_status !== 'transcribing') {
                toast.success(
                  language === 'vi'
                    ? `Bóc băng cho Giáo viên ${selectedTeacher} đã hoàn tất!`
                    : `Transcription for Teacher ${selectedTeacher} completed!`
                );
                setIsTranscribing(false);
              }
              return primary;
            });

            // Update texts if currently empty or newly transcribed
            setEditingRawText((prev) => {
              if (!prev.trim() && primary.raw_transcript) {
                return primary.raw_transcript;
              }
              return prev;
            });
            setEditingResponseText((prev) => {
              if (!prev.trim() && primary.response_text) {
                return primary.response_text;
              }
              return prev;
            });
          } else {
            // When polling returns empty and no active transcription is in progress, ensure responses is synced to empty
            if (!isCurrentlyTranscribing && !isAligningQA) {
              setResponses([]);
              setActiveResponse(null);
            }
          }

          // If on meaning units tab, refresh units
          if (activeTab === 'units') {
            const units = await api.getMeaningUnits(selectedTeacher);
            setMeaningUnits(units || []);
          }
        } catch {
          // ignore transient poll error
        }
      }

      // 3. Refresh run-level data if on those tabs
      if (activeRunId && (activeTab === 'coding' || activeTab === 'triangulation' || activeTab === 'quotes')) {
        loadRunLevelData();
      }
    }, intervalTime);

    return () => clearInterval(interval);
  }, [selectedTeacher, activeRunId, isLoadingTeacher, isCurrentlyTranscribing, isAligningQA, isSegmenting, isGeneratingCodes, isTriangulating, activeTab, language]);

  async function loadTeacherData(showLoading = false) {
    if (!selectedTeacher) return;
    if (showLoading) {
      setIsLoadingTeacher(true);
      setResponses([]);
      setActiveResponse(null);
      setEditingRawText('');
      setEditingResponseText('');
      setMeaningUnits([]);
    }
    try {
      const [res, units] = await Promise.all([
        api.getInterviewResponses(selectedTeacher, activeRunId),
        api.getMeaningUnits(selectedTeacher).catch(() => []),
      ]);
      const responseList = res || [];
      setResponses(responseList);
      if (responseList.length > 0) {
        const primary = responseList[0];
        setActiveResponse(primary);
        setEditingRawText(primary.raw_transcript || '');
        setEditingResponseText(primary.response_text || '');
      } else {
        setActiveResponse(null);
        setEditingRawText('');
        setEditingResponseText('');
      }
      setMeaningUnits(units || []);
    } catch (err) {
      console.error('Failed to load teacher data:', err);
      if (showLoading) {
        setResponses([]);
        setActiveResponse(null);
        setEditingRawText('');
        setEditingResponseText('');
        setMeaningUnits([]);
      }
    } finally {
      if (showLoading) {
        setIsLoadingTeacher(false);
      }
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

  // Audio file selection / drop handler
  function handleFileSelected(file: File) {
    if (isCurrentlyTranscribing) {
      toast.warning(
        language === 'vi'
          ? 'Đang có tiến trình bóc băng âm thanh. Vui lòng ấn "Hủy bóc băng" trước khi chọn file mới!'
          : 'Transcription is in progress. Please click "Cancel Transcription" before uploading a new file!'
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Check if teacher already has an existing recording
    if (activeResponse && activeResponse.audio_blob_path) {
      setPendingAudioFile(file);
      setOverwriteMode('replace_audio');
      setShowOverwriteModal(true);
      return;
    }

    // No existing file -> upload directly
    executeAudioUpload(file, 'full_reset');
  }

  async function executeAudioUpload(file: File, mode: 'replace_audio' | 'full_reset') {
    setIsUploading(true);
    try {
      const uploaded = await api.uploadInterviewAudio(selectedTeacher, activeRunId, file, mode);
      toast.success(
        mode === 'replace_audio'
          ? (language === 'vi'
              ? `Đã thay thế file ghi âm ${file.name} và bảo toàn dữ liệu phỏng vấn!`
              : `Replaced audio file ${file.name} while preserving existing analysis!`)
          : (language === 'vi'
              ? `Đã làm mới dữ liệu và tải lên file ${file.name} cho giáo viên ${selectedTeacher}!`
              : `Uploaded audio ${file.name} and reset interview data for ${selectedTeacher}!`)
      );
      setShowOverwriteModal(false);
      setPendingAudioFile(null);
      await loadTeacherData();
      await loadRunLevelData();
      setActiveResponse(uploaded);
    } catch (err: any) {
      toast.error(err.message || 'Audio upload failed');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function handleAudioInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileSelected(file);
  }

  // Trigger AI Transcription
  async function handleTranscribe() {
    if (!activeResponse) {
      toast.error(language === 'vi' ? 'Chưa có file ghi âm nào' : 'No audio recording selected');
      return;
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsTranscribing(true);
    try {
      const res = await api.transcribeInterviewAudio(activeResponse.id, controller.signal);
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
      if (err.name === 'AbortError' || controller.signal.aborted) {
        toast.info(t('iaCancelledOperation'));
      } else {
        toast.error(err.message || 'Transcription failed');
      }
    } finally {
      setIsTranscribing(false);
      abortControllerRef.current = null;
    }
  }

  // Cancel in-flight transcription
  async function handleCancelTranscribe() {
    if (!activeResponse) return;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    try {
      await api.cancelInterviewTranscription(activeResponse.id);
      await loadTeacherData();
    } catch (err: any) {
      console.warn('Failed to call cancel transcribe API:', err);
    }
    setIsTranscribing(false);
    toast.info(t('iaCancelledOperation'));
  }

  // Cancel any running AI task in subsequent steps
  function handleCancelCurrentTask() {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsSegmenting(false);
    setIsGeneratingCodes(false);
    setIsTriangulating(false);
    setIsSelectingQuotes(false);
    setIsAligningQA(false);
    toast.info(t('iaCancelledOperation'));
  }

  // Trigger AI Q&A Semantic Alignment with prepared questions
  async function handleAlignQA() {
    if (!selectedTeacher) return;
    const textToAlign = transcriptMode === 'raw' ? editingRawText : (activeResponse?.raw_transcript || editingRawText);
    if (!textToAlign || !textToAlign.trim()) {
      toast.error(language === 'vi' ? 'Chưa có lời thoại phỏng vấn để phân tách!' : 'No interview transcript available to align.');
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsAligningQA(true);
    try {
      const res = await api.alignAndSplitQA(selectedTeacher, activeRunId, textToAlign, controller.signal);
      setResponses(res || []);
      toast.success(t('iaAlignQASuccess'));
      setTranscriptMode('polished');
      await loadTeacherData();
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        toast.info(t('iaCancelledOperation'));
      } else {
        toast.error(err.message || 'Q&A alignment failed');
      }
    } finally {
      setIsAligningQA(false);
      abortControllerRef.current = null;
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

  // Finalize all Q&A cards for the current teacher
  async function handleFinalizeAllQA() {
    if (qaCards.length === 0) return;
    setIsFinalizing(true);
    try {
      await Promise.all(
        qaCards.map((c) => api.finalizeInterviewResponse(c.id, c.response_text))
      );
      toast.success(
        language === 'vi'
          ? `Đã chốt & thẩm định thành công toàn bộ ${qaCards.length} thẻ Q&A!`
          : `Successfully finalized all ${qaCards.length} Q&A cards!`
      );
      await loadTeacherData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to finalize Q&A cards');
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
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSegmenting(true);
    try {
      const units = await api.segmentMeaningUnits(activeResponse.id, controller.signal);
      setMeaningUnits(units);
      toast.success(
        language === 'vi'
          ? `Đã tách thành công ${units.length} đơn vị ý nghĩa (Meaning Units)!`
          : `Successfully segmented into ${units.length} meaning units!`
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        toast.info(t('iaCancelledOperation'));
      } else {
        toast.error(err.message || 'Segmentation failed');
      }
    } finally {
      setIsSegmenting(false);
      abortControllerRef.current = null;
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
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsGeneratingCodes(true);
    try {
      const res = await api.generateInterviewCodes(selectedTeacher, activeRunId, controller.signal);
      setMeaningUnits(res.meaning_units);
      setInterviewCodes(res.codes);
      toast.success(
        language === 'vi'
          ? `AI đã gợi ý mã ban đầu và phân nhóm cho ${res.meaning_units.length} đơn vị ý nghĩa!`
          : `AI generated initial codes and categories for ${res.meaning_units.length} units!`
      );
      await loadRunLevelData();
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        toast.info(t('iaCancelledOperation'));
      } else {
        toast.error(err.message || 'Coding failed');
      }
    } finally {
      setIsGeneratingCodes(false);
      abortControllerRef.current = null;
    }
  }

  // Trigger Triangulation
  async function handleRunTriangulation() {
    if (!activeRunId) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsTriangulating(true);
    try {
      const entries = await api.runInterviewTriangulation(activeRunId, controller.signal);
      setTriangulationEntries(entries);
      toast.success(
        language === 'vi'
          ? `Đã hoàn thành đối chiếu tam giác với ${entries.length} mối liên hệ được phân tích!`
          : `Triangulation complete with ${entries.length} relationships analyzed!`
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        toast.info(t('iaCancelledOperation'));
      } else {
        toast.error(err.message || 'Triangulation failed');
      }
    } finally {
      setIsTriangulating(false);
      abortControllerRef.current = null;
    }
  }

  // Trigger Quote Selection
  async function handleSelectQuotes() {
    if (!activeRunId) return;
    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsSelectingQuotes(true);
    try {
      const res = await api.selectRepresentativeQuotes(activeRunId, controller.signal);
      setQuotes(res);
      toast.success(
        language === 'vi'
          ? `Đã tuyển chọn ${res.length} câu trích dẫn tiêu biểu cho luận văn!`
          : `Selected ${res.length} representative quotes for thesis write-up!`
      );
    } catch (err: any) {
      if (err.name === 'AbortError' || controller.signal.aborted) {
        toast.info(t('iaCancelledOperation'));
      } else {
        toast.error(err.message || 'Quote selection failed');
      }
    } finally {
      setIsSelectingQuotes(false);
      abortControllerRef.current = null;
    }
  }

  // Toggle quote inclusion
  async function handleToggleQuote(quote: RepresentativeQuoteItem) {
    const updated = !quote.is_selected;
    try {
      await api.toggleQuoteSelection(quote.id, updated);
      setQuotes(quotes.map((q) => (q.id === quote.id ? { ...q, is_selected: updated } : q)));
    } catch (err: any) {
      toast.error(language === 'vi' ? 'Cập nhật trạng thái trích dẫn thất bại' : 'Failed to update quote status');
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

  // Export Chapter 4 Quotes to Word (.docx)
  async function handleExportChapter4Word() {
    let targetQuotes = quotes.filter((q) => q.is_selected);
    if (targetQuotes.length === 0) {
      targetQuotes = quotes;
    }
    if (targetQuotes.length === 0) {
      toast.error(t('iaNoQuotesToExport'));
      return;
    }

    try {
      setIsExportingChapter4Word(true);
      const toastId = toast.loading(t('iaExportingWord'));
      const blob = await generateChapter4FindingsWord({
        quotes: targetQuotes,
        selectedTeacher: selectedTeacher || undefined,
        lang: language as 'en' | 'vi',
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Thesis_Chapter4_Quotes_${selectedTeacher || 'All'}_${dateStr}.docx`;
      downloadWordBlob(blob, filename);
      toast.dismiss(toastId);
      toast.success(t('iaExportChapter4WordSuccess'));
    } catch (err) {
      console.error('Failed to export Chapter 4 Word:', err);
      toast.error(language === 'vi' ? 'Lỗi khi xuất file Word. Vui lòng thử lại.' : 'Failed to export Word document. Please try again.');
    } finally {
      setIsExportingChapter4Word(false);
    }
  }

  // Export Step 5: Per-Teacher Case Analysis to Word (.docx)
  async function handleExportTeacherCaseWord() {
    if (!selectedTeacher) {
      return;
    }

    try {
      setIsExportingTeacherCaseWord(true);
      const toastId = toast.loading(t('iaExportingWord'));
      const blob = await generatePerTeacherCaseWord({
        teacherId: selectedTeacher,
        meaningUnits,
        triangulation: triangulationEntries,
        responses,
        lang: language as 'en' | 'vi',
      });
      const dateStr = new Date().toISOString().slice(0, 10);
      const filename = `Teacher_Case_Analysis_${selectedTeacher}_${dateStr}.docx`;
      downloadWordBlob(blob, filename);
      toast.dismiss(toastId);
      toast.success(t('iaExportTeacherCaseWordSuccess'));
    } catch (err) {
      console.error('Failed to export Teacher Case Word:', err);
      toast.error(language === 'vi' ? 'Lỗi khi xuất file Word. Vui lòng thử lại.' : 'Failed to export Word document. Please try again.');
    } finally {
      setIsExportingTeacherCaseWord(false);
    }
  }

  // Export & Download All Qualitative Data (.zip)
  async function handleDownloadAllZip() {
    try {
      setIsExportingZip(true);
      const toastId = toast.loading(t('iaExportZipStarting'));

      await exportQualitativeZipPackage({
        scope: zipExportScope,
        selectedTeacher,
        teacherList: teachers,
        activeRunId,
        lang: language as 'en' | 'vi',
        onProgress: (progress) => {
          setZipExportProgress(progress);
        },
      });

      toast.dismiss(toastId);
      toast.success(t('iaExportZipSuccess'));
      setShowZipExportModal(false);
    } catch (err) {
      console.error('Failed to export qualitative ZIP package:', err);
      toast.error(t('iaExportZipError'));
    } finally {
      setIsExportingZip(false);
      setZipExportProgress(null);
    }
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
        return <span className="badge badge-neutral">{t('iaStatusDraft')}</span>;
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
            {t('navInterview')}
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
            {t('iaAiFlowConfig')}
          </Link>
        </div>
      </div>

      {/* Feature Workflow & Automation Guidance */}
      <FeatureWorkflowBanner featureKey="interview_analysis" />

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
              const status = allTeacherStatuses[tid];
              let dotColor = 'transparent';
              let isSpinning = false;
              if (status === 'transcribing') {
                dotColor = '#3B82F6';
                isSpinning = true;
              } else if (status === 'finalized') {
                dotColor = '#10B981';
              } else if (status === 'transcribed') {
                dotColor = '#6366F1';
              } else if (status === 'uploaded') {
                dotColor = '#F59E0B';
              }

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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  {isSelected && isLoadingTeacher ? (
                    <RefreshCw size={11} className="animate-spin" />
                  ) : status ? (
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: dotColor,
                        display: 'inline-block',
                      }}
                      className={isSpinning ? 'animate-pulse' : undefined}
                      title={`Status: ${status}`}
                    />
                  ) : null}
                  <span>{tid}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Actions: Analysis Run Selector & Download All ZIP Package */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t('iaAnalysisRun')}</span>
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

          {/* Download All Qualitative Data ZIP Button */}
          <button
            onClick={() => setShowZipExportModal(true)}
            disabled={isExportingZip}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(158, 74, 40, 0.4)',
              backgroundColor: 'rgba(158, 74, 40, 0.08)',
              color: 'var(--accent)',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: isExportingZip ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: 'var(--shadow-sm)',
            }}
            title={t('iaDownloadAllZipTooltip')}
          >
            <Package size={14} />
            <span>{t('iaDownloadAllZipBtn')}</span>
          </button>
        </div>
      </div>

      {/* 6 Workflow Tabs Bar with Step Gating */}
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
          { key: 'transcript', label: t('iaTabAudioTranscript'), icon: Volume2, count: qaCards.length, locked: false },
          { key: 'units', label: t('iaTabMeaningUnits'), icon: Layers, count: meaningUnits.length, locked: !isStep1Complete },
          { key: 'coding', label: t('iaTabCoding'), icon: BookOpen, count: interviewCodes.length, locked: !isStep1Complete },
          { key: 'triangulation', label: t('iaTabTriangulation'), icon: ShieldCheck, count: triangulationEntries.length, locked: !isStep1Complete },
          { key: 'teacher_case', label: t('iaTabPerTeacher'), icon: FileCheck2, locked: !isStep1Complete },
          { key: 'quotes', label: t('iaTabQuotes'), icon: Sparkles, count: quotes.filter((q) => q.is_selected).length, locked: !isStep1Complete },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          const isLocked = tab.locked;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (isLocked) {
                  toast.warning(t('iaStep1LockedMsg'));
                  return;
                }
                setActiveTab(tab.key as TabKey);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)',
                border: isLocked ? '1px dashed rgba(0, 0, 0, 0.14)' : 'none',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.6 : 1,
                fontSize: '13px',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#FFFFFF' : isLocked ? 'var(--text-subtle)' : 'var(--text-muted)',
                backgroundColor: isActive ? 'var(--accent)' : isLocked ? 'rgba(0,0,0,0.02)' : 'transparent',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              title={isLocked ? t('iaStep1LockedMsg') : tab.label}
            >
              <Icon size={15} />
              <span>{tab.label}</span>
              {isLocked ? (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '10px',
                  backgroundColor: '#E5E7EB',
                  color: '#4B5563',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                }}>
                  <Lock size={10} /> {t('iaLockedBadge')}
                </span>
              ) : (
                tab.count !== undefined && tab.count > 0 && (
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
                )
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: AUDIO UPLOAD & DUAL-MODE TRANSCRIPT REVIEW */}
      {activeTab === 'transcript' && (
        isLoadingTeacher ? (
          <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '20px', alignItems: 'start' }}>
            {/* Left Panel Skeleton */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '22px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div className="animate-pulse-soft" style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                <div className="animate-pulse-soft" style={{ width: '150px', height: '18px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
              </div>
              <div className="animate-pulse-soft" style={{ width: '100%', height: '12px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
              <div className="animate-pulse-soft" style={{ width: '80%', height: '12px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
              <div className="animate-pulse-soft" style={{ width: '100%', height: '110px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC', marginTop: '6px' }} />
              <div style={{ paddingTop: '16px', borderTop: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="animate-pulse-soft" style={{ width: '60%', height: '14px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                <div className="animate-pulse-soft" style={{ width: '100%', height: '38px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC' }} />
              </div>
            </div>

            {/* Right Panel Skeleton */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-md)',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div className="animate-pulse-soft" style={{ width: '280px', height: '24px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                  <div className="animate-pulse-soft" style={{ width: '160px', height: '13px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                </div>
                <div className="animate-pulse-soft" style={{ width: '180px', height: '36px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="animate-pulse-soft" style={{ width: '100%', height: '14px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                <div className="animate-pulse-soft" style={{ width: '92%', height: '14px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                <div className="animate-pulse-soft" style={{ width: '85%', height: '14px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                <div className="animate-pulse-soft" style={{ width: '90%', height: '14px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
              </div>
              <div className="animate-pulse-soft" style={{ width: '100%', height: '280px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC', marginTop: '10px' }} />
            </div>
          </div>
        ) : (
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
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isUploading && !isCurrentlyTranscribing) {
                    setIsDragging(true);
                  }
                }}
                onDragEnter={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isUploading && !isCurrentlyTranscribing) {
                    setIsDragging(true);
                  }
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  if (isUploading || isCurrentlyTranscribing) return;
                  const droppedFile = e.dataTransfer?.files?.[0];
                  if (droppedFile) {
                    handleFileSelected(droppedFile);
                  }
                }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: isDragging ? '2px dashed var(--accent-green, #2D6A4F)' : '2px dashed var(--accent)',
                  backgroundColor: isDragging ? 'var(--accent-green-soft, #EAF4EE)' : 'var(--accent-soft)',
                  transform: isDragging ? 'scale(1.02)' : 'none',
                  cursor: (isUploading || isCurrentlyTranscribing) ? 'not-allowed' : 'pointer',
                  opacity: isCurrentlyTranscribing ? 0.65 : 1,
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  boxShadow: isDragging ? '0 8px 24px rgba(45, 106, 79, 0.15)' : 'none',
                }}
              >
                <UploadCloud
                  size={32}
                  style={{
                    color: isDragging ? 'var(--accent-green, #2D6A4F)' : 'var(--accent)',
                    marginBottom: '8px',
                    transform: isDragging ? 'scale(1.15)' : 'none',
                    transition: 'transform 0.2s ease',
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: isDragging ? 'var(--accent-green, #2D6A4F)' : 'var(--accent)' }}>
                  {isDragging
                    ? t('iaDragDropActive')
                    : isUploading
                    ? (language === 'vi' ? 'Đang tải lên...' : 'Uploading...')
                    : isCurrentlyTranscribing
                    ? (language === 'vi' ? 'Đang bóc băng (hủy trước nếu muốn đổi file)' : 'Transcribing (cancel first to replace file)')
                    : t('iaDragDropLabel')}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {t('iaDragDropHint')}
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*,.mp3,.m4a,.wav,.ogg,.webm"
                  onChange={handleAudioInputChange}
                  disabled={isUploading || isCurrentlyTranscribing}
                  style={{ display: 'none' }}
                />
              </label>

              {/* Uploaded File Info & AI Transcribe Action */}
              {activeResponse && (
                <div style={{ marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>{t('iaStatusLabel')}</span>
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
                    <FileAudio size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '6px' }} />
                    {activeResponse.audio_filename || 'interview_audio.mp3'}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={handleTranscribe}
                      disabled={isCurrentlyTranscribing}
                      style={{
                        width: '100%',
                        padding: '10px 16px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: isCurrentlyTranscribing ? 'var(--text-muted)' : 'var(--accent)',
                        color: '#FFFFFF',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: isCurrentlyTranscribing ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: 'var(--shadow-sm)',
                      }}
                    >
                      {isCurrentlyTranscribing ? (
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
                    {isCurrentlyTranscribing && (
                      <button
                        onClick={handleCancelTranscribe}
                        style={{
                          width: '100%',
                          padding: '8px 16px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid #EF4444',
                          backgroundColor: '#FEE2E2',
                          color: '#DC2626',
                          fontSize: '12.5px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                        }}
                      >
                        <X size={14} />
                        <span>{t('iaCancelTranscribe')}</span>
                      </button>
                    )}
                  </div>
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

                {/* Progress Bar & Timestamps */}
                <div style={{ marginBottom: '10px' }}>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={(e) => seekTo(parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      cursor: 'pointer',
                      accentColor: 'var(--accent)',
                    }}
                  />
                </div>

                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  marginBottom: '12px',
                }}>
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
                    <span>{isPlaying ? t('iaPlaybackPause') : t('iaPlaybackPlay')}</span>
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
                  {language === 'vi'
                    ? `Lời Thoại Phỏng Vấn — Giáo Viên ${selectedTeacher}`
                    : `Teacher ${selectedTeacher} Interview Transcript`}
                </h3>
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {t('iaLanguageLabel')}{' '}
                  <strong style={{ textTransform: 'uppercase', color: 'var(--text-main)' }}>
                    {(!activeResponse?.language || activeResponse.language.trim() === '' || activeResponse.transcript_status === 'uploaded' || activeResponse.transcript_status === 'draft')
                      ? 'N/A'
                      : activeResponse.language}
                  </strong>{' '}
                  • {t('iaStatusLabel')}{' '}
                  {activeResponse?.transcript_status
                    ? renderStatusBadge(activeResponse.transcript_status)
                    : t('iaStatusDraft')}
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{t('iaModePolished')}</span>
                  <span style={{
                    fontSize: '10.5px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: transcriptMode === 'polished'
                      ? 'rgba(255, 255, 255, 0.25)'
                      : isStep1Finalized
                        ? 'var(--accent-green-soft)'
                        : qaCards.length > 0
                          ? 'var(--accent-amber-soft)'
                          : 'var(--card-border)',
                    color: transcriptMode === 'polished'
                      ? '#FFFFFF'
                      : isStep1Finalized
                        ? 'var(--accent-green)'
                        : qaCards.length > 0
                          ? 'var(--accent-amber)'
                          : 'var(--text-subtle)',
                  }}>
                    {qaCards.length > 0
                      ? isStep1Finalized
                        ? `${qaCards.length} ${language === 'vi' ? 'thẻ (Đã chốt)' : 'cards (Finalized)'}`
                        : `${finalizedCardsCount}/${qaCards.length} ${language === 'vi' ? 'thẻ (Đang duyệt)' : 'cards (Reviewing)'}`
                      : t('iaMode2NotCreated')}
                  </span>
                </button>
              </div>
            </div>

            {/* RATIONALE CALLOUT CARD — Shown when raw transcript exists but Q&A Cards not generated yet */}
            {isTranscriptAvailable && qaCards.length === 0 && (
              <div style={{
                backgroundColor: '#FFFDF9',
                border: '1.5px solid #F59E0B',
                borderRadius: 'var(--radius-md)',
                padding: '20px 24px',
                marginBottom: '20px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 700, fontSize: '15px' }}>
                    <AlertTriangle size={18} />
                    <span>{t('iaRationaleTitle')}</span>
                  </div>
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent-amber-soft)',
                    color: 'var(--accent-amber)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(178, 106, 0, 0.25)',
                  }}>
                    {t('iaRationaleSubtitle')}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6', marginBottom: '14px' }}>
                  {t('iaRationaleDesc')}
                </p>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '12px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}>
                    <Target size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: 'var(--text-main)' }}>{t('iaRationaleContextTitle')}</strong>
                      <p style={{ color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.45' }}>
                        {t('iaRationaleContextDesc')}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}>
                    <Eye size={18} color="var(--accent-blue)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: 'var(--text-main)' }}>{t('iaRationaleHumanTitle')}</strong>
                      <p style={{ color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.45' }}>
                        {t('iaRationaleHumanDesc')}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px',
                  }}>
                    <ShieldCheck size={18} color="var(--accent-green)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <strong style={{ color: 'var(--text-main)' }}>{t('iaRationaleQuotesTitle')}</strong>
                      <p style={{ color: 'var(--text-muted)', marginTop: '2px', lineHeight: '1.45' }}>
                        {t('iaRationaleQuotesDesc')}
                      </p>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleAlignQA}
                    disabled={isAligningQA || !editingRawText.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 18px',
                      backgroundColor: '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isAligningQA || !editingRawText.trim() ? 'not-allowed' : 'pointer',
                      boxShadow: '0 1px 3px rgba(124, 58, 237, 0.25)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isAligningQA ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{t('iaAlignQALoading')}</span>
                      </>
                    ) : (
                      <>
                        <Zap size={14} />
                        <span>{t('iaAutoAlignBtn')}</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setTranscriptMode('polished')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 16px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{t('iaViewMode2Btn')}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* PENDING FINALIZATION BANNER — Shown when Q&A cards exist but user hasn't finalized all */}
            {qaCards.length > 0 && !isStep1Finalized && (
              <div style={{
                backgroundColor: '#FFFDF9',
                border: '1.5px solid #F59E0B',
                borderRadius: 'var(--radius-md)',
                padding: '18px 22px',
                marginBottom: '20px',
                boxShadow: '0 4px 14px rgba(245, 158, 11, 0.08)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#B45309', fontWeight: 700, fontSize: '14.5px' }}>
                    <AlertTriangle size={18} color="#D97706" />
                    <span>{t('iaQaDraftPendingTitle')}</span>
                  </div>
                  <span style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    backgroundColor: 'var(--accent-amber-soft)',
                    color: 'var(--accent-amber)',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    border: '1px solid rgba(178, 106, 0, 0.25)',
                  }}>
                    {t('iaQaDraftPendingSubtitle').replace('{finalized}', String(finalizedCardsCount)).replace('{total}', String(qaCards.length))}
                  </span>
                </div>

                <p style={{ fontSize: '13px', color: '#4B5563', lineHeight: '1.6', marginBottom: '14px' }}>
                  {t('iaQaDraftPendingDesc')}
                </p>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleFinalizeAllQA}
                    disabled={isFinalizing}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '9px 18px',
                      backgroundColor: 'var(--accent)',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isFinalizing ? 'not-allowed' : 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isFinalizing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{t('iaFinalizingAll')}</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={15} />
                        <span>{t('iaFinalizeAllQABtn')} ({finalizedCardsCount}/{qaCards.length})</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => setTranscriptMode('polished')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 16px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text-main)',
                      border: '1px solid var(--card-border)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <span>{t('iaViewMode2Btn')}</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* SUCCESS BANNER — Step 1.2 Q&A Completed & Finalized */}
            {isStep1Finalized && (
              <div style={{
                backgroundColor: '#F8FDF9',
                border: '1.5px solid var(--accent-green)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                boxShadow: '0 2px 8px rgba(45, 106, 79, 0.06)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckCircle2 size={20} color="var(--accent-green)" />
                  <div>
                    <strong style={{ color: 'var(--accent-green)', fontSize: '14px' }}>
                      {t('iaQaCompletedBanner').replace('{count}', String(qaCards.length)).replace('{teacher}', selectedTeacher)}
                    </strong>
                    <p style={{ color: '#4B5563', fontSize: '12.5px', marginTop: '2px', margin: 0 }}>
                      {language === 'vi'
                        ? 'Dữ liệu phỏng vấn đã được chuẩn hóa và xác thực. Toàn bộ các bước tiếp theo đã được mở khóa.'
                        : 'Interview responses have been standardized and validated. All subsequent analysis steps are unlocked.'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('units')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '9px 18px',
                    backgroundColor: 'var(--accent-green)',
                    color: '#FFFFFF',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span>{t('iaProceedToUnitsBtn')}</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            )}

            {/* MODE 1: RAW AUDIO TRANSCRIPT VIEW */}
            {transcriptMode === 'raw' && (
              <div>
                {!isTranscriptAvailable && !activeResponse && responses.length === 0 ? (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '52px 24px',
                    border: '2px dashed var(--card-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FCFAF7',
                    margin: '10px 0 20px',
                  }}>
                    <div style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--accent-soft)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '16px',
                      color: 'var(--accent)',
                      border: '1px solid rgba(158, 74, 40, 0.15)',
                    }}>
                      <FileText size={30} />
                    </div>

                    <h4 style={{
                      fontFamily: 'var(--font-serif)',
                      fontSize: '22px',
                      fontWeight: 400,
                      color: 'var(--text-main)',
                      marginBottom: '8px',
                    }}>
                      {t('iaEmptyTitle').replace('{teacher}', selectedTeacher)}
                    </h4>

                    <p style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      maxWidth: '520px',
                      lineHeight: '1.6',
                      marginBottom: '24px',
                    }}>
                      {t('iaEmptyDesc')}
                    </p>

                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          backgroundColor: 'var(--accent)',
                          color: '#FFFFFF',
                          border: 'none',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 20px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <UploadCloud size={16} />
                        <span>{t('iaEmptyUploadBtn')}</span>
                      </button>

                      <button
                        onClick={() => {
                          setEditingRawText(' ');
                        }}
                        style={{
                          backgroundColor: 'var(--bg)',
                          color: 'var(--text-main)',
                          border: '1px solid var(--card-border)',
                          borderRadius: 'var(--radius-sm)',
                          padding: '10px 18px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <FileText size={16} />
                        <span>{t('iaEmptyInputTextBtn')}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {t('iaRawTranscriptTip')}
                      </span>
                      <span className="badge badge-audio">{t('iaVerbatimTimeline')}</span>
                    </div>

                    <textarea
                      value={editingRawText}
                      onChange={(e) => setEditingRawText(e.target.value)}
                      placeholder={t('iaRawPlaceholder')}
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
                  </>
                )}

                {/* Bottom guidance card in Mode 1 */}
                <div style={{
                  marginTop: '16px',
                  padding: '14px 18px',
                  backgroundColor: 'var(--sidebar-bg)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--card-border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    <Info size={16} color="var(--accent)" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      {t('iaRawBottomHint')}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      if (qaCards.length > 0) {
                        setTranscriptMode('polished');
                      } else {
                        handleAlignQA();
                      }
                    }}
                    disabled={isAligningQA || !editingRawText.trim()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: qaCards.length > 0 ? 'var(--accent)' : '#7C3AED',
                      color: '#FFFFFF',
                      border: 'none',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: isAligningQA || !editingRawText.trim() ? 'not-allowed' : 'pointer',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {isAligningQA ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>{t('iaAlignQALoading')}</span>
                      </>
                    ) : qaCards.length > 0 ? (
                      <>
                        <span>{t('iaViewMode2Btn')}</span>
                        <ArrowRight size={13} />
                      </>
                    ) : (
                      <>
                        <Zap size={14} />
                        <span>{t('iaAutoAlignBtn')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* MODE 2: POLISHED Q&A CARDS VIEW */}
            {transcriptMode === 'polished' && (() => {
              const qaCards = responses.filter((r) => r.question_text !== 'Full Teacher Interview Recording');
              return (
                <div>
                  <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {t('iaStructuredDesc')}
                      </span>
                      <span className="badge badge-visual">{t('iaStructuredBadge')}</span>
                    </div>

                    <button
                      onClick={handleAlignQA}
                      disabled={isAligningQA || !editingRawText.trim()}
                      title={t('iaAlignQADesc')}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 14px',
                        backgroundColor: '#7C3AED',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: isAligningQA || !editingRawText.trim() ? 'not-allowed' : 'pointer',
                        opacity: isAligningQA || !editingRawText.trim() ? 0.6 : 1,
                        transition: 'all 0.15s ease',
                        boxShadow: '0 1px 2px rgba(124, 58, 237, 0.2)',
                      }}
                    >
                      {isAligningQA ? (
                        <>
                          <RefreshCw size={13} className="animate-spin" />
                          <span>{t('iaAlignQALoading')}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={13} />
                          <span>{t('iaAlignQABtn')}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '450px', overflowY: 'auto' }}>
                    {qaCards.length > 0 ? (
                      qaCards.map((resp, idx) => (
                        <div
                          key={resp.id}
                          style={{
                            padding: '16px',
                            backgroundColor: 'var(--bg)',
                            border: '1px solid var(--card-border)',
                            borderLeft: resp.transcript_status === 'finalized' ? '4px solid var(--accent-green)' : '4px solid #F59E0B',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="badge badge-neutral" style={{ fontWeight: 600 }}>
                                {t('iaQuestionNumber')}{idx + 1}
                              </span>
                              {resp.transcript_status === 'finalized' ? (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: 'var(--accent-green)',
                                  backgroundColor: 'var(--accent-green-soft)',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <CheckCircle2 size={11} /> {t('iaCardFinalizedBadge')}
                                </span>
                              ) : (
                                <span style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  color: '#B45309',
                                  backgroundColor: '#FEF3C7',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  <Clock size={11} /> {t('iaCardDraftBadge')}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {t('iaTeacherLabel')} {resp.teacher_id}
                            </span>
                          </div>
                          <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '10px' }}>
                            {resp.question_text || t('iaTeacherQuestionPlaceholder')}
                          </h4>
                          <textarea
                            defaultValue={resp.response_text}
                            onBlur={(e) => {
                              if (e.target.value !== resp.response_text) {
                                api.finalizeInterviewResponse(resp.id, e.target.value).then(() => {
                                  toast.success(language === 'vi' ? 'Đã cập nhật câu trả lời' : 'Updated response');
                                  loadTeacherData();
                                });
                              }
                            }}
                            placeholder={t('iaTeacherAnswerPlaceholder')}
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
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', backgroundColor: 'var(--sidebar-bg)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginBottom: '6px' }}>
                          {t('iaEmptyQa')}
                        </div>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          {t('iaEmptyQaCta')}
                        </div>
                        <button
                          onClick={handleAlignQA}
                          disabled={isAligningQA || !editingRawText.trim()}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '8px 18px',
                            backgroundColor: '#7C3AED',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '13px',
                            fontWeight: 600,
                            cursor: isAligningQA || !editingRawText.trim() ? 'not-allowed' : 'pointer',
                            opacity: isAligningQA || !editingRawText.trim() ? 0.6 : 1,
                          }}
                        >
                          {isAligningQA ? (
                            <>
                              <RefreshCw size={14} className="animate-spin" />
                              <span>{t('iaAlignQALoading')}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles size={14} />
                              <span>{t('iaAlignQABtn')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bottom Actions in Mode 2 */}
            <div style={{
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid var(--card-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              {!isStep1Finalized ? (
                <button
                  onClick={handleFinalizeAllQA}
                  disabled={isFinalizing || qaCards.length === 0}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 22px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: 'var(--accent)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: isFinalizing || qaCards.length === 0 ? 'not-allowed' : 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <CheckCircle2 size={16} />
                  <span>
                    {isFinalizing
                      ? t('iaFinalizingAll')
                      : `${t('iaFinalizeAllQABtn')} (${finalizedCardsCount}/${qaCards.length})`}
                  </span>
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-green)', fontWeight: 600, fontSize: '13.5px' }}>
                  <CheckCircle2 size={18} />
                  <span>
                    {language === 'vi'
                      ? `Đã chốt toàn bộ ${qaCards.length}/${qaCards.length} thẻ Q&A`
                      : `All ${qaCards.length}/${qaCards.length} Q&A cards finalized`}
                  </span>
                </div>
              )}

              {isStep1Finalized ? (
                <button
                  onClick={() => setActiveTab('units')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '10px 20px',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    backgroundColor: 'var(--accent-green)',
                    color: '#FFFFFF',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  <span>{t('iaProceedToUnitsBtn')}</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {language === 'vi'
                    ? 'Chốt toàn bộ câu hỏi để mở khóa Step 2'
                    : 'Finalize all questions to unlock Step 2'}
                </span>
              )}
            </div>
          </div>
        </div>
      )
    )}

      {/* TAB 2: MEANING UNITS SEGMENTATION */}
      {activeTab === 'units' && (
        isLoadingTeacher ? (
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '24px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div className="animate-pulse-soft" style={{ width: '260px', height: '26px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
                <div className="animate-pulse-soft" style={{ width: '180px', height: '14px', borderRadius: '4px', backgroundColor: '#ECE6DC' }} />
              </div>
              <div className="animate-pulse-soft" style={{ width: '140px', height: '36px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC' }} />
            </div>
            <div className="animate-pulse-soft" style={{ width: '100%', height: '48px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC' }} />
            <div className="animate-pulse-soft" style={{ width: '100%', height: '220px', borderRadius: 'var(--radius-sm)', backgroundColor: '#ECE6DC' }} />
          </div>
        ) : (
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
                  {t('iaUnitsTitle')} — {t('iaTeacherLabel')} {selectedTeacher}
                </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t('iaUnitsSubtitle')}
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
              {isSegmenting && (
                <button
                  onClick={handleCancelCurrentTask}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #EF4444',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                  <span>{t('iaCancel')}</span>
                </button>
              )}
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
                <span>{t('iaProceedCoding')}</span>
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
              placeholder={t('iaAddUnitPlaceholder')}
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
                  <th style={{ width: '70px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {t('iaActions')}
                  </th>
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
                          {u.initial_code || t('iaUncoded')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span className="badge badge-theme">
                          {u.category || t('iaUncategorized')}
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
                      {language === 'vi' ? (
                        <>
                          Chưa có Meaning Units nào. Bấm nút <strong>"{t('iaSegmentBtn')}"</strong> để tự động bóc tách từ câu trả lời của giáo viên {selectedTeacher}.
                        </>
                      ) : (
                        <>
                          No meaning units found yet. Click <strong>"{t('iaSegmentBtn')}"</strong> to automatically extract from Teacher {selectedTeacher}'s responses.
                        </>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )
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
                  {t('iaCodingTitle')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                  {t('iaCodingSubtitle')}
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
                {isGeneratingCodes && (
                  <button
                    onClick={handleCancelCurrentTask}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid #EF4444',
                      backgroundColor: '#FEE2E2',
                      color: '#DC2626',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} />
                    <span>{t('iaCancel')}</span>
                  </button>
                )}
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
                  <span>{t('iaProceedTriangulation')}</span>
                </button>
              </div>
            </div>

            {/* Coding Matrix */}
            <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)' }}>
                    <th style={{ width: '45%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('iaVerbatimQuote')}
                    </th>
                    <th style={{ width: '25%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('iaInitialCode')}
                    </th>
                    <th style={{ width: '30%', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('iaCategory')}
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
                          placeholder={t('iaAssignCodePlaceholder')}
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
                          placeholder={t('iaAssignCategoryPlaceholder')}
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
                {t('iaAggregatedCodebook')}
              </h4>
              <div style={{ overflowX: 'auto', border: '1px solid var(--card-border)', borderRadius: 'var(--radius-sm)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg)', borderBottom: '1px solid var(--card-border)' }}>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('iaInitialCode')}</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('iaCategory')}</th>
                      <th style={{ width: '100px', padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', textAlign: 'center' }}>{t('iaFrequency')}</th>
                      <th style={{ padding: '10px 14px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('iaTeachers')}</th>
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
                {t('iaTriangulationTitle')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t('iaTriangulationSubtitle')}
              </p>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
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
              {isTriangulating && (
                <button
                  onClick={handleCancelCurrentTask}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #EF4444',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                  <span>{t('iaCancel')}</span>
                </button>
              )}
            </div>
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
                    {t('iaTeacherLabel')}
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
                        <span className="badge badge-visual">{entry.teacher_ref || t('iaGeneral')}</span>
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
                      {language === 'vi' ? (
                        <>
                          Chưa có dữ liệu đối chiếu tam giác. Bấm <strong>"{t('iaRunTriangulationBtn')}"</strong> để AI tự động so sánh toàn diện.
                        </>
                      ) : (
                        <>
                          No triangulation data available yet. Click <strong>"{t('iaRunTriangulationBtn')}"</strong> for automated AI comparison.
                        </>
                      )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header Action Bar with Word Export */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 20px',
            boxShadow: 'var(--shadow-sm)',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontWeight: 400, color: 'var(--accent)', margin: 0 }}>
                {t('iaTabPerTeacher')} — {t('iaTeacherLabel')} {selectedTeacher}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                {language === 'vi'
                  ? `Hồ sơ nghiên cứu ca điển hình: Đối chiếu tam giác giữa video lớp học (${selectedTeacher}_L1, ${selectedTeacher}_L2) và phỏng vấn sâu.`
                  : `Individual teacher case study dossier: Triangulating video classroom practice (${selectedTeacher}_L1, ${selectedTeacher}_L2) and in-depth interview.`}
              </p>
            </div>

            <button
              onClick={handleExportTeacherCaseWord}
              disabled={isExportingTeacherCaseWord}
              title={t('iaExportTeacherCaseWordTooltip')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 18px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                backgroundColor: 'var(--accent)',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                cursor: isExportingTeacherCaseWord ? 'not-allowed' : 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                transition: 'all 0.15s ease',
              }}
            >
              {isExportingTeacherCaseWord ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span>{t('iaExportTeacherCaseWord')}</span>
            </button>
          </div>

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
                {t('iaTeacherLabel')} {selectedTeacher} — {t('iaProfileTitle')}
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {language === 'vi'
                ? `Dữ liệu quan sát rút ra từ 2 tiết dạy thực tế của giáo viên ${selectedTeacher}.`
                : `Observation evidence extracted from 2 analyzed lessons of Teacher ${selectedTeacher}.`}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                  {t('iaVideoLessons')}
                </span>
                <p style={{ fontSize: '13.5px', margin: '4px 0 0 0', fontWeight: 600 }}>
                  {selectedTeacher}_L1 & {selectedTeacher}_L2
                </p>
              </div>

              <div style={{ padding: '12px 14px', backgroundColor: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: '4px solid var(--accent-green)' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent-green)', textTransform: 'uppercase' }}>
                  {t('iaTriangulatedConfirmations')}
                </span>
                <p style={{ fontSize: '12.5px', margin: '4px 0 0 0', color: 'var(--text-muted)' }}>
                  {triangulationEntries.filter((t) => t.teacher_ref === selectedTeacher).length}{' '}
                  {t('iaTriangulatedFindingsCount')}
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
                {t('iaTeacherLabel')} {selectedTeacher} — {t('iaExplanationsTitle')}
              </h3>
            </div>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              {language === 'vi'
                ? `Phát ngôn trực tiếp từ buổi phỏng vấn sâu của giáo viên ${selectedTeacher}.`
                : `Direct statements from in-depth interview with Teacher ${selectedTeacher}.`}
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
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{u.initial_code || t('iaUncoded')}</span>
                      <span className="badge badge-theme" style={{ fontSize: '10px' }}>{u.category || t('iaGeneral')}</span>
                    </div>
                    <span style={{ color: 'var(--text-main)', fontStyle: 'italic' }}>"{u.unit_text}"</span>
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '12.5px', textAlign: 'center', padding: '24px' }}>
                  {t('iaEmptyTeacherUnits')}
                </div>
              )}
            </div>
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
                {t('iaTabQuotes')} {t('iaQuotesThesisCitation')}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: 0 }}>
                {t('iaQuotesSubtitle')}
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
                    {rq === 'all' ? t('iaAllRqs') : rq}
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
              {isSelectingQuotes && (
                <button
                  onClick={handleCancelCurrentTask}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #EF4444',
                    backgroundColor: '#FEE2E2',
                    color: '#DC2626',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                  <span>{t('iaCancel')}</span>
                </button>
              )}

              <button
                onClick={handleExportChapter4Word}
                disabled={isExportingChapter4Word}
                title={t('iaExportChapter4WordTooltip')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 16px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isExportingChapter4Word ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                  transition: 'all 0.15s ease',
                }}
              >
                {isExportingChapter4Word ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Download size={14} />
                )}
                <span>{t('iaExportChapter4Word')}</span>
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
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {t('iaTeacherLabel')} {q.teacher_id}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        • {q.quote_source || t('iaInterviewSource')}
                      </span>
                      <span className="badge badge-theme" style={{ fontSize: '10px' }}>
                        {q.relevance_type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button
                        onClick={() => copyQuoteToClipboard(q.quote_text, q.id)}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
                        title={t('iaCopyQuote')}
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
                {language === 'vi' ? (
                  <>
                    Chưa có câu trích dẫn nào. Bấm <strong>"{t('iaSelectQuotesBtn')}"</strong> để lọc các phát ngôn xuất sắc nhất từ dữ liệu phỏng vấn.
                  </>
                ) : (
                  <>
                    No quotes available yet. Click <strong>"{t('iaSelectQuotesBtn')}"</strong> to curate golden excerpts from interview data.
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Smart Overwrite Confirmation Modal */}
      {showOverwriteModal && pendingAudioFile && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(26, 22, 18, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => {
            if (!isUploading) {
              setShowOverwriteModal(false);
              setPendingAudioFile(null);
              if (fileInputRef.current) fileInputRef.current.value = '';
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg, 20px)',
              maxWidth: '580px',
              width: '100%',
              padding: '28px',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  backgroundColor: 'var(--accent-amber-soft, #FEF7EA)',
                  border: '1px solid rgba(178, 106, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-amber, #B26A00)',
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  {t('iaOverwriteModalTitle')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                  {t('iaOverwriteModalDesc').replace('{teacher}', selectedTeacher)}
                </p>
              </div>
            </div>

            {/* Existing data summary chips */}
            <div
              style={{
                backgroundColor: '#FAF8F5',
                border: '1px solid var(--card-border)',
                borderRadius: 'var(--radius-sm)',
                padding: '10px 14px',
                marginBottom: '20px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
                fontSize: '12px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-main)',
                }}
              >
                <Mic size={12} style={{ color: 'var(--accent)' }} />
                <span>{t('iaOverwriteKeepCurrentAudio')} <strong>{activeResponse?.audio_filename || 'audio.mp3'}</strong></span>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-main)',
                }}
              >
                <FileText size={12} style={{ color: 'var(--accent-blue)' }} />
                <span>{t('iaOverwriteKeepUnitsCount')} <strong>{meaningUnits.length}</strong></span>
              </div>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid var(--card-border)',
                  color: 'var(--text-main)',
                }}
              >
                <Sparkles size={12} style={{ color: 'var(--accent-amber)' }} />
                <span>{t('iaOverwriteKeepQuotesCount')} <strong>{quotes.filter((q) => q.teacher_id === selectedTeacher).length}</strong></span>
              </div>
            </div>

            {/* Overwrite Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
              {/* Option 1: Replace Audio Only */}
              <div
                onClick={() => setOverwriteMode('replace_audio')}
                style={{
                  border: overwriteMode === 'replace_audio' ? '2px solid var(--accent)' : '2px solid var(--card-border)',
                  backgroundColor: overwriteMode === 'replace_audio' ? 'var(--accent-soft)' : '#FFFFFF',
                  borderRadius: 'var(--radius-md, 14px)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: overwriteMode === 'replace_audio' ? '2px solid var(--accent)' : '2px solid var(--text-subtle, #A39B92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                >
                  {overwriteMode === 'replace_audio' && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent)' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {t('iaOverwriteOptAudioTitle')}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--accent-green-soft, #EAF4EE)',
                        color: 'var(--accent-green, #2D6A4F)',
                      }}
                    >
                      {t('iaOverwriteOptAudioBadge')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {t('iaOverwriteOptAudioDesc')}
                  </div>
                </div>
              </div>

              {/* Option 2: Full Reset */}
              <div
                onClick={() => setOverwriteMode('full_reset')}
                style={{
                  border: overwriteMode === 'full_reset' ? '2px solid var(--accent-red, #C92A2A)' : '2px solid var(--card-border)',
                  backgroundColor: overwriteMode === 'full_reset' ? 'var(--accent-red-soft, #FFF5F5)' : '#FFFFFF',
                  borderRadius: 'var(--radius-md, 14px)',
                  padding: '14px 16px',
                  cursor: 'pointer',
                  transition: 'all 0.18s ease',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    width: '18px',
                    height: '18px',
                    borderRadius: '50%',
                    border: overwriteMode === 'full_reset' ? '2px solid var(--accent-red, #C92A2A)' : '2px solid var(--text-subtle, #A39B92)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginTop: '2px',
                    flexShrink: 0,
                  }}
                >
                  {overwriteMode === 'full_reset' && (
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-red, #C92A2A)' }} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {t('iaOverwriteOptResetTitle').replace('{teacher}', selectedTeacher)}
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--accent-red-soft, #FFF5F5)',
                        color: 'var(--accent-red, #C92A2A)',
                      }}
                    >
                      {t('iaOverwriteOptResetBadge')}
                    </span>
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.45 }}>
                    {t('iaOverwriteOptResetDesc')}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  setShowOverwriteModal(false);
                  setPendingAudioFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  border: '1px solid var(--card-border)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-main)',
                }}
              >
                {t('iaCancel')}
              </button>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => {
                  if (pendingAudioFile) {
                    executeAudioUpload(pendingAudioFile, overwriteMode);
                  }
                }}
                style={{
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  backgroundColor: overwriteMode === 'full_reset' ? 'var(--accent-red, #C92A2A)' : 'var(--accent)',
                  color: '#FFFFFF',
                  boxShadow: 'var(--shadow-sm)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {isUploading ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>{language === 'vi' ? 'Đang tải lên...' : 'Uploading...'}</span>
                  </>
                ) : (
                  <span>{overwriteMode === 'full_reset' ? t('iaOverwriteBtnReset') : t('iaOverwriteBtnReplace')}</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Download All Qualitative Data ZIP Modal */}
      {showZipExportModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(26, 22, 18, 0.55)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
          onClick={() => {
            if (!isExportingZip) {
              setShowZipExportModal(false);
            }
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-lg, 20px)',
              maxWidth: '620px',
              width: '100%',
              padding: '28px',
              boxShadow: 'var(--shadow-lg)',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(158, 74, 40, 0.1)',
                    border: '1px solid rgba(158, 74, 40, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Package size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-main)' }}>
                    {t('iaDownloadAllModalTitle')}
                  </h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)' }}>
                    {t('iaDownloadAllModalSubtitle')}
                  </p>
                </div>
              </div>

              {!isExportingZip && (
                <button
                  type="button"
                  onClick={() => setShowZipExportModal(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    padding: '4px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* Scope Selection */}
            {!isExportingZip ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '22px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)' }}>
                  {t('iaExportScopeLabel')}
                </label>

                {/* Option 1: All 12 Teachers */}
                <div
                  onClick={() => setZipExportScope('all')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: zipExportScope === 'all' ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                    backgroundColor: zipExportScope === 'all' ? 'rgba(158, 74, 40, 0.04)' : 'var(--bg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <input
                    type="radio"
                    name="zipScope"
                    checked={zipExportScope === 'all'}
                    onChange={() => setZipExportScope('all')}
                    style={{ marginTop: '3px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{t('iaExportScopeAll')}</span>
                      <span style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(158, 74, 40, 0.12)',
                        color: 'var(--accent)',
                      }}>
                        {language === 'vi' ? 'Khuyên dùng' : 'Recommended'}
                      </span>
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {t('iaExportScopeAllDesc')}
                    </p>
                  </div>
                </div>

                {/* Option 2: Current Teacher Only */}
                <div
                  onClick={() => setZipExportScope('current')}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 'var(--radius-md)',
                    border: zipExportScope === 'current' ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                    backgroundColor: zipExportScope === 'current' ? 'rgba(158, 74, 40, 0.04)' : 'var(--bg)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <input
                    type="radio"
                    name="zipScope"
                    checked={zipExportScope === 'current'}
                    onChange={() => setZipExportScope('current')}
                    style={{ marginTop: '3px', accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {t('iaExportScopeCurrent').replace('{teacher}', selectedTeacher)}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                      {t('iaExportScopeCurrentDesc').replace('{teacher}', selectedTeacher)}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Live Progress State */
              <div style={{
                padding: '20px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--card-border)',
                marginBottom: '22px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <RefreshCw size={15} className="animate-spin" style={{ color: 'var(--accent)' }} />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {zipExportProgress?.message || t('iaExportZipStarting')}
                    </span>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                    {zipExportProgress?.percentage ?? 0}%
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div style={{
                  width: '100%',
                  height: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(0, 0, 0, 0.08)',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${zipExportProgress?.percentage ?? 0}%`,
                    height: '100%',
                    backgroundColor: 'var(--accent)',
                    transition: 'width 0.25s ease-out',
                    borderRadius: '4px',
                  }} />
                </div>
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowZipExportModal(false)}
                disabled={isExportingZip}
                style={{
                  padding: '9px 18px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'transparent',
                  color: 'var(--text-main)',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: isExportingZip ? 'not-allowed' : 'pointer',
                  opacity: isExportingZip ? 0.6 : 1,
                }}
              >
                {t('iaCancel')}
              </button>

              <button
                type="button"
                onClick={handleDownloadAllZip}
                disabled={isExportingZip}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 20px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: 'var(--accent)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: isExportingZip ? 'not-allowed' : 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'opacity 0.15s ease',
                  opacity: isExportingZip ? 0.8 : 1,
                }}
              >
                {isExportingZip ? (
                  <>
                    <RefreshCw size={15} className="animate-spin" />
                    <span>{zipExportProgress?.percentage ?? 0}%</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>{t('iaExportStartBtn')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
