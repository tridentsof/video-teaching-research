'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { api, AIFlowsSettingsData, AIModelItem, APIKeyItem, FlowConfigItem, TestPingResult, TelegramFlowItem } from '@/lib/api';
import {
  Key,
  Plus,
  Save,
  Zap,
  CheckCircle2,
  Cpu,
  RefreshCw,
  Video,
  CheckSquare,
  Network,
  MessageSquare,
  BookMarked,
  Layers,
  Sparkles,
  ArrowDown,
  Trash2,
  ShieldCheck,
  Activity,
  Edit2,
  ArrowLeft,
  History,
  AlertCircle,
  AlertTriangle,
  ExternalLink,
  Sliders,
  Send,
  Bell,
  Globe,
  Mic,
} from 'lucide-react';
import { ActivityLogView } from '@/components/ActivityLogView';
import { activityLogService } from '@/lib/activityLog';

interface FlowMeta {
  titleEn: string;
  titleVi: string;
  stepEn: string;
  stepVi: string;
  descEn: string;
  descVi: string;
  badgeEn: string;
  badgeVi: string;
  badgeClass: string;
  requireMultimodal: boolean;
  moduleKey: 'video' | 'synthesis' | 'interview';
  uiScreenEn: string;
  uiScreenVi: string;
}

const FLOW_METAS: Record<string, FlowMeta> = {
  video_extraction: {
    titleEn: 'Video Event & Utterance Extraction',
    titleVi: 'Bóc Tách Hành Vi & Câu Thoại Lớp Học',
    stepEn: 'Step 1 on UI • Event Extraction',
    stepVi: 'Bước 1 trên UI • Bóc Tách Sự Kiện',
    descEn: 'Multimodal video/audio chunk processing, pedagogical event segmentation & timestamp extraction.',
    descVi: 'Xử lý video/audio đa phương thức theo chunk hoặc toàn video, bóc tách chuỗi hành vi và câu thoại kèm mốc thời gian.',
    badgeEn: 'Multimodal Video',
    badgeVi: 'Video Đa Phương Thức',
    badgeClass: 'pill-amber',
    requireMultimodal: true,
    moduleKey: 'video',
    uiScreenEn: 'UI: Video Detail (/videos/:id) • Step 1',
    uiScreenVi: 'UI: Chi Tiết Video (/videos/:id) • Bước 1',
  },
  checklist_mapping: {
    titleEn: 'Checklist Mapping & Rubric Scoring',
    titleVi: 'Khớp Tiêu Chí Bảng Kiểm Sư Phạm A–E',
    stepEn: 'Step 2 on UI • Rubric Mapping',
    stepVi: 'Bước 2 trên UI • Khớp Tiêu Chí Khung Quan Sát',
    descEn: 'Maps and scores extracted classroom events against observation checklist rubrics.',
    descVi: 'Khớp các hành vi thô đã bóc tách vào từng chỉ báo trong 5 nhóm tiêu chí A–E và tính điểm sư phạm.',
    badgeEn: 'Pedagogical Rubrics',
    badgeVi: 'Khớp Tiêu Chí',
    badgeClass: 'pill-blue',
    requireMultimodal: false,
    moduleKey: 'video',
    uiScreenEn: 'UI: Video Detail (/videos/:id) • Step 2',
    uiScreenVi: 'UI: Chi Tiết Video (/videos/:id) • Bước 2',
  },
  codebook_generation: {
    titleEn: 'Observation Code Book Synthesis',
    titleVi: 'Tổng Hợp Sổ Mã Quan Sát Định Tính',
    stepEn: 'Code Book Flow • Qualitative Codebook',
    stepVi: 'Quy trình Sổ Mã • Chuẩn Hóa Mã Quan Sát',
    descEn: 'Synthesizes standardized qualitative observation codes, operational definitions, and inclusion/exclusion criteria.',
    descVi: 'Đọc toàn bộ sự kiện thô đã phân tích để sinh định nghĩa, tiêu chí bao hàm/loại trừ và ví dụ thực tế.',
    badgeEn: 'Grounded Events',
    badgeVi: 'Tổng Hợp Sự Kiện Thô',
    badgeClass: 'pill-amber',
    requireMultimodal: false,
    moduleKey: 'synthesis',
    uiScreenEn: 'UI: Observation Code Book (/codebook)',
    uiScreenVi: 'UI: Sổ Mã Quan Sát (/codebook)',
  },
  thematic_analysis: {
    titleEn: 'Teaching Themes & Grounded Theory',
    titleVi: 'Quy Nạp Chủ Đề Sư Phạm & Lý Thuyết Nền',
    stepEn: 'Themes Flow • 5-Stage Grounded Theory',
    stepVi: 'Quy trình Chủ Đề • Grounded Theory 5 Giai Đoạn',
    descEn: 'Synthesizes Grounded Theory categories & core themes with empirical reasoning traces across the corpus.',
    descVi: 'Gom cụm các chiến thuật lặp lại thành Category và Theme kèm lập luận định tính từ toàn bộ video mẫu.',
    badgeEn: 'Reasoning Trace',
    badgeVi: 'Lập Luận Định Tính',
    badgeClass: 'pill-purple',
    requireMultimodal: false,
    moduleKey: 'synthesis',
    uiScreenEn: 'UI: Teaching Themes (/themes)',
    uiScreenVi: 'UI: Chủ Đề Sư Phạm (/themes)',
  },
  interview_generator: {
    titleEn: 'Dynamic Interview Question Generator',
    titleVi: 'Sinh Bộ Câu Hỏi Phỏng Vấn Sâu Giáo Viên',
    stepEn: 'Interview Flow • Evidence-Grounded Questions',
    stepVi: 'Quy trình Phỏng Vấn • Câu Hỏi Theo Bằng Chứng',
    descEn: 'Generates evidence-grounded interview inquiry questionnaires citing actual video timestamps.',
    descVi: 'Tạo bộ câu hỏi phỏng vấn sâu cá nhân hóa cho từng giáo viên, trích dẫn mốc thời gian thực tế trong video.',
    badgeEn: 'Evidence Citations',
    badgeVi: 'Trích Dẫn Bằng Chứng',
    badgeClass: 'pill-green',
    requireMultimodal: false,
    moduleKey: 'synthesis',
    uiScreenEn: 'UI: Interview Guide (/interview)',
    uiScreenVi: 'UI: Bộ Phỏng Vấn (/interview)',
  },
  interview_transcription: {
    titleEn: 'Teacher Interview Audio Transcription',
    titleVi: 'Bóc Băng Ghi Âm Phỏng Vấn Đa Ngữ (EN/VI)',
    stepEn: 'Step 1 on UI • Audio Transcript & Q&A Gate',
    stepVi: 'Step 1 trên UI • Audio Transcript & Q&A Gate',
    descEn: 'Transcribes teacher interview audio recordings with speaker separation, timestamps and Q&A mapping.',
    descVi: 'Bóc băng file ghi âm phỏng vấn giáo viên, tách lượt thoại người hỏi/người trả lời và gán mốc thời gian.',
    badgeEn: 'Audio Multimodal',
    badgeVi: 'Âm Thanh Đa Ngữ',
    badgeClass: 'pill-blue',
    requireMultimodal: true,
    moduleKey: 'interview',
    uiScreenEn: 'UI: Interview Analysis (/interview-analysis) • Step 1',
    uiScreenVi: 'UI: Phân Tích Phỏng Vấn (/interview-analysis) • Step 1',
  },
  interview_analysis: {
    titleEn: 'Interview Qualitative Analysis & Triangulation',
    titleVi: 'Phân Tích Định Tính & Đối Chiếu Tam Giác Quan Sát',
    stepEn: 'Step 2–4 on UI • Meaning Units & Triangulation',
    stepVi: 'Step 2–4 trên UI • Tách Ý, Gắn Mã & Đối Chiếu Tam Giác',
    descEn: 'Segments meaning units, assigns qualitative codes, triangulates with observation themes and selects quotes.',
    descVi: 'Tách meaning units, gợi ý initial codes, đối chiếu tam giác với video quan sát và trích xuất câu trích dẫn.',
    badgeEn: 'Triangulation & Coding',
    badgeVi: 'Đối Chiếu & Gắn Mã',
    badgeClass: 'pill-purple',
    requireMultimodal: false,
    moduleKey: 'interview',
    uiScreenEn: 'UI: Interview Analysis (/interview-analysis) • Step 2–4',
    uiScreenVi: 'UI: Phân Tích Phỏng Vấn (/interview-analysis) • Step 2–4',
  },
};

const FLOW_ORDER = [
  'video_extraction',
  'checklist_mapping',
  'codebook_generation',
  'thematic_analysis',
  'interview_generator',
  'interview_transcription',
  'interview_analysis',
];


export default function SettingsPage() {
  const { t, language } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [settingsData, setSettingsData] = useState<AIFlowsSettingsData | null>(null);
  const [flowState, setFlowState] = useState<Record<string, { model_catalog_id: string; api_key_id?: string; temperature: number; fallback_model_catalog_id?: string }>>({});
  const [selectedFlowKey, setSelectedFlowKey] = useState<string>('video_extraction');
  const [activePreset, setActivePreset] = useState<string>('custom');
  const [activeAdminTab, setActiveAdminTab] = useState<'api_config' | 'telegram' | 'activity_log'>('api_config');

  // Key Modal State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [newKeyProvider, setNewKeyProvider] = useState('gemini');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeySecret, setNewKeySecret] = useState('');
  const [newKeyProjectID, setNewKeyProjectID] = useState('');
  const [newKeyRegion, setNewKeyRegion] = useState('us-central1');
  const [newKeyGCSBucket, setNewKeyGCSBucket] = useState('');
  const [newKeyIsDefault, setNewKeyIsDefault] = useState(false);
  const [creatingKey, setCreatingKey] = useState(false);

  // Model Catalog Modal & CRUD State
  const [isModelModalOpen, setIsModelModalOpen] = useState(false);
  const [isModelFormView, setIsModelFormView] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelFormId, setModelFormId] = useState('');
  const [modelFormProvider, setModelFormProvider] = useState('openrouter');
  const [modelFormDisplayName, setModelFormDisplayName] = useState('');
  const [modelFormContextTokens, setModelFormContextTokens] = useState<number>(128000);
  const [modelFormMultimodal, setModelFormMultimodal] = useState(false);
  const [modelFormReasoning, setModelFormReasoning] = useState(true);
  const [modelFormIsActive, setModelFormIsActive] = useState(true);
  const [savingModel, setSavingModel] = useState(false);

  // Telegram Status & Test State
  const [telegramStatus, setTelegramStatus] = useState<{
    is_enabled: boolean;
    has_bot_token: boolean;
    has_webhook_url: boolean;
    has_static_chat_id: boolean;
    active_subscribers: number;
    bot_username: string;
    active_flows?: TelegramFlowItem[];
  } | null>(null);
  const [selectedPreviewFlow, setSelectedPreviewFlow] = useState<'pipeline_completed' | 'pipeline_failed' | 'interview_transcribed' | 'interview_qa_aligned'>('pipeline_completed');
  const [sendingTelegramTest, setSendingTelegramTest] = useState(false);

  // Load Settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getAIFlowsSettings();
      setSettingsData(res);

      const stateMap: Record<string, { model_catalog_id: string; api_key_id?: string; temperature: number; fallback_model_catalog_id?: string }> = {};
      (res?.flows || []).forEach((f) => {
        stateMap[f.flow_key] = {
          model_catalog_id: f.model_catalog_id,
          api_key_id: f.api_key_id,
          temperature: f.temperature,
          fallback_model_catalog_id: f.fallback_model_catalog_id,
        };
      });
      setFlowState(stateMap);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  const fetchTelegramStatus = async () => {
    try {
      const st = await api.getTelegramStatus();
      setTelegramStatus(st);
    } catch (err) {
      console.warn('Failed to load telegram status', err);
    }
  };

  const handleSendTelegramTest = async () => {
    try {
      setSendingTelegramTest(true);
      const res = await api.sendTelegramTest();
      toast.success(res.message || (language === 'vi' ? 'Đã gửi thông báo thử nghiệm thành công!' : 'Test notification sent successfully!'));
      fetchTelegramStatus();
    } catch (err: any) {
      toast.error(err?.message || (language === 'vi' ? 'Không thể gửi tin nhắn thử nghiệm' : 'Failed to send test notification'));
    } finally {
      setSendingTelegramTest(false);
    }
  };

  useEffect(() => {
    fetchSettings();
    fetchTelegramStatus();
  }, []);

  const currentFlow = flowState[selectedFlowKey] || {
    model_catalog_id: '',
    temperature: 0.2,
  };

  const currentMeta = FLOW_METAS[selectedFlowKey] || FLOW_METAS.video_extraction;
  const currentModelInfo = (settingsData?.models || []).find((m) => m.id === currentFlow.model_catalog_id);

  // Update handlers
  const handleModelChange = (modelCatalogId: string) => {
    setFlowState((prev) => {
      const selectedModel = (settingsData?.models || []).find((m) => m.id === modelCatalogId);
      let newKeyId = prev[selectedFlowKey]?.api_key_id;
      const currentKey = (settingsData?.api_keys || []).find((k) => k.id === newKeyId);
      // Auto-switch to a compatible active API key for this provider if current key doesn't match
      if (selectedModel && (!currentKey || currentKey.provider !== selectedModel.provider)) {
        const matchingKey =
          (settingsData?.api_keys || []).find(
            (k) => k.provider === selectedModel.provider && k.status === 'active' && k.is_default
          ) ||
          (settingsData?.api_keys || []).find(
            (k) => k.provider === selectedModel.provider && k.status === 'active'
          );
        newKeyId = matchingKey ? matchingKey.id : undefined;
      }

      return {
        ...prev,
        [selectedFlowKey]: {
          ...prev[selectedFlowKey],
          model_catalog_id: modelCatalogId,
          api_key_id: newKeyId,
        },
      };
    });
    setActivePreset('custom');
  };

  const handleKeyChange = (keyId: string) => {
    setFlowState((prev) => ({
      ...prev,
      [selectedFlowKey]: {
        ...prev[selectedFlowKey],
        api_key_id: keyId ? keyId : undefined,
      },
    }));
    setActivePreset('custom');
  };

  const handleTemperatureChange = (temp: number) => {
    setFlowState((prev) => ({
      ...prev,
      [selectedFlowKey]: {
        ...prev[selectedFlowKey],
        temperature: temp,
      },
    }));
  };

  // Presets
  const applyPreset = (preset: string) => {
    setActivePreset(preset);
    const updated = { ...flowState };

    const getModelCatalogId = (provider: string, modelId: string): string => {
      const found = (settingsData?.models || []).find((m) => m.provider === provider && m.model_id === modelId);
      return found ? found.id : '';
    };

    if (preset === 'all-flash') {
      const gFlashId = getModelCatalogId('gemini', 'gemini-3.7-flash');
      const geminiKey =
        (settingsData?.api_keys || []).find((k) => k.provider === 'gemini' && k.status === 'active' && k.is_default) ||
        (settingsData?.api_keys || []).find((k) => k.provider === 'gemini' && k.status === 'active');
      const gKeyId = geminiKey ? geminiKey.id : undefined;

      FLOW_ORDER.forEach((key) => {
        updated[key] = {
          ...updated[key],
          model_catalog_id: gFlashId || updated[key]?.model_catalog_id,
          api_key_id: gKeyId || updated[key]?.api_key_id,
        };
      });
      activityLogService.addLog({
        category: 'admin',
        module: 'preset',
        action: 'ai_flow.apply_preset',
        target_id: 'all-flash',
        target_title: 'Preset: All-Gemini Flash',
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: 'Áp dụng bộ định tuyến mẫu: Tất cả 5 bước pipeline sử dụng Gemini 3.7 Flash.',
        summary_en: 'Applied preset routing: All 5 pipeline steps routed to Gemini 3.7 Flash.',
        status: 'success',
      });
      toast.success(
        language === 'vi'
          ? 'Đã áp dụng Preset: Tất cả luồng dùng Gemini 3.7 Flash'
          : 'Preset applied: All flows routed to Gemini 3.7 Flash'
      );
    } else if (preset === 'claude-research') {
      const gFlashId = getModelCatalogId('gemini', 'gemini-3.7-flash');
      const geminiKey =
        (settingsData?.api_keys || []).find((k) => k.provider === 'gemini' && k.status === 'active' && k.is_default) ||
        (settingsData?.api_keys || []).find((k) => k.provider === 'gemini' && k.status === 'active');
      const gKeyId = geminiKey ? geminiKey.id : undefined;

      const claudeId = getModelCatalogId('openrouter', 'claude-3.7-sonnet') || getModelCatalogId('openrouter', 'anthropic/claude-3.7-sonnet');
      const openRouterKey =
        (settingsData?.api_keys || []).find((k) => k.provider === 'openrouter' && k.status === 'active' && k.is_default) ||
        (settingsData?.api_keys || []).find((k) => k.provider === 'openrouter' && k.status === 'active');
      const orKeyId = openRouterKey ? openRouterKey.id : undefined;

      updated.video_extraction = { ...updated.video_extraction, model_catalog_id: gFlashId || updated.video_extraction?.model_catalog_id, api_key_id: gKeyId || updated.video_extraction?.api_key_id };
      updated.checklist_mapping = { ...updated.checklist_mapping, model_catalog_id: claudeId || updated.checklist_mapping?.model_catalog_id, api_key_id: orKeyId || updated.checklist_mapping?.api_key_id };
      updated.thematic_analysis = { ...updated.thematic_analysis, model_catalog_id: claudeId || updated.thematic_analysis?.model_catalog_id, api_key_id: orKeyId || updated.thematic_analysis?.api_key_id };
      updated.interview_generator = { ...updated.interview_generator, model_catalog_id: claudeId || updated.interview_generator?.model_catalog_id, api_key_id: orKeyId || updated.interview_generator?.api_key_id };
      updated.codebook_generation = { ...updated.codebook_generation, model_catalog_id: gFlashId || updated.codebook_generation?.model_catalog_id, api_key_id: gKeyId || updated.codebook_generation?.api_key_id };
      activityLogService.addLog({
        category: 'admin',
        module: 'preset',
        action: 'ai_flow.apply_preset',
        target_id: 'claude-research',
        target_title: 'Preset: Claude 3.7 Research & Gemini Video',
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: 'Áp dụng bộ định tuyến mẫu: 3 bước suy luận qua Claude 3.7 Sonnet, bóc tách qua Gemini Flash.',
        summary_en: 'Applied preset routing: Reasoning steps via Claude 3.7 Sonnet, Extraction via Gemini Flash.',
        status: 'success',
      });
      toast.success(
        language === 'vi'
          ? 'Đã áp dụng Preset: Claude 3.7 cho Phân tích & Gemini Flash cho Video'
          : 'Preset applied: Claude 3.7 Sonnet for Reasoning & Gemini Flash for Video'
      );
    } else if (preset === 'vertex-enterprise') {
      const vertexKey =
        (settingsData?.api_keys || []).find((k) => k.provider === 'vertex_ai' && k.status === 'active' && k.is_default) ||
        (settingsData?.api_keys || []).find((k) => k.provider === 'vertex_ai' && k.status === 'active');
      const vKeyId = vertexKey ? vertexKey.id : undefined;

      const vFlashId = getModelCatalogId('vertex_ai', 'gemini-3.7-flash');
      const vProId = getModelCatalogId('vertex_ai', 'gemini-2.5-pro');

      updated.video_extraction = { ...updated.video_extraction, model_catalog_id: vFlashId || updated.video_extraction?.model_catalog_id, api_key_id: vKeyId || updated.video_extraction?.api_key_id };
      updated.checklist_mapping = { ...updated.checklist_mapping, model_catalog_id: vFlashId || updated.checklist_mapping?.model_catalog_id, api_key_id: vKeyId || updated.checklist_mapping?.api_key_id };
      updated.thematic_analysis = { ...updated.thematic_analysis, model_catalog_id: vProId || updated.thematic_analysis?.model_catalog_id, api_key_id: vKeyId || updated.thematic_analysis?.api_key_id };
      updated.interview_generator = { ...updated.interview_generator, model_catalog_id: vProId || updated.interview_generator?.model_catalog_id, api_key_id: vKeyId || updated.interview_generator?.api_key_id };
      updated.codebook_generation = { ...updated.codebook_generation, model_catalog_id: vProId || updated.codebook_generation?.model_catalog_id, api_key_id: vKeyId || updated.codebook_generation?.api_key_id };
      activityLogService.addLog({
        category: 'admin',
        module: 'preset',
        action: 'ai_flow.apply_preset',
        target_id: 'vertex-enterprise',
        target_title: 'Preset: GCP Vertex AI Enterprise',
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: 'Áp dụng bộ định tuyến mẫu: Toàn bộ 5 bước pipeline sử dụng Google Cloud Vertex AI.',
        summary_en: 'Applied preset routing: All 5 pipeline steps routed to Google Cloud Vertex AI.',
        status: 'success',
      });
      toast.success(
        language === 'vi'
          ? 'Đã áp dụng Preset: Toàn bộ pipeline dùng Google Cloud Vertex AI'
          : 'Preset applied: All pipeline flows routed to Google Cloud Vertex AI'
      );
    }

    setFlowState(updated);
  };

  // Save All
  const handleSaveAll = async () => {
    // Validate that every flow has an assigned API key (NO fallback permitted)
    for (const k of FLOW_ORDER) {
      if (!flowState[k]?.api_key_id) {
        const meta = FLOW_METAS[k];
        const flowTitle = language === 'vi' ? meta?.titleVi : meta?.titleEn;
        toast.error(
          language === 'vi'
            ? `Lỗi: Luồng "${flowTitle}" chưa được gán API Key! Hệ thống không dùng fallback, vui lòng gán key từ Vault.`
            : `Error: Flow "${flowTitle}" has no API Key assigned! No fallback permitted, please assign a key.`
        );
        setSelectedFlowKey(k);
        return;
      }
    }

    try {
      setSaving(true);
      const payload = FLOW_ORDER.map((k) => ({
        flow_key: k,
        model_catalog_id: flowState[k]?.model_catalog_id || '',
        api_key_id: flowState[k]?.api_key_id,
        temperature: flowState[k]?.temperature ?? 0.2,
        fallback_model_catalog_id: flowState[k]?.fallback_model_catalog_id,
      }));

      const res = await api.updateAIFlowsSettings(payload);
      setSettingsData(res);

      activityLogService.addLog({
        category: 'admin',
        module: 'ai_routing',
        action: 'ai_flow.update_all',
        target_id: 'ai_pipeline_flows',
        target_title: 'AI Studio • 5 Luồng Xử Lý Pipeline',
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: `Đã lưu thành công cấu hình định tuyến mới cho ${payload.length} luồng xử lý AI.`,
        summary_en: `Successfully saved new routing configurations for ${payload.length} AI pipeline flows.`,
        status: 'success',
        diff: payload.map((p) => {
          const m = (settingsData?.models || []).find((mod) => mod.id === p.model_catalog_id);
          return {
            field: p.flow_key,
            label: (FLOW_METAS[p.flow_key] ? (language === 'vi' ? FLOW_METAS[p.flow_key].titleVi : FLOW_METAS[p.flow_key].titleEn) : p.flow_key),
            after: `${m?.display_name || p.model_catalog_id} (temp: ${p.temperature})`,
          };
        }),
      });

      toast.success(t('aiStudioSavedSuccess'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Ping Testing
  const handleTestPing = async () => {
    const keyId = currentFlow.api_key_id;
    if (!keyId) {
      toast.error(
        language === 'vi'
          ? 'Luồng này chưa được gán API Key! Vui lòng chọn một API Key từ Vault trước khi kiểm tra ping.'
          : 'This flow has no API Key assigned! Please assign a key from vault before testing ping.'
      );
      return;
    }

    try {
      setTesting(true);
      const provider = currentModelInfo?.provider || 'gemini';
      const modelId = currentModelInfo?.model_id || 'gemini-3.7-flash';

      const res = await api.testAIPing(provider, modelId, keyId);
      activityLogService.addLog({
        category: 'admin',
        module: 'ai_routing',
        action: 'model.ping_test',
        target_id: modelId,
        target_title: `Live Ping: ${modelId} (${provider})`,
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: res.success
          ? `Kiểm tra kết nối Live Ping thành công: phản hồi trong ${res.latency_ms}ms qua ${provider.toUpperCase()}.`
          : `Kiểm tra kết nối Live Ping cảnh báo: ${res.message}`,
        status: res.success ? 'success' : 'warning',
        metadata: { latency_ms: res.latency_ms, provider, model_id: modelId },
      });

      if (res.success) {
        toast.success(`Ping OK (${res.latency_ms}ms): ${res.message}`);
      } else {
        toast.warning(`Ping Warning: ${res.message}`);
      }
    } catch (err: any) {
      toast.error(`Ping Failed: ${err?.message}`);
    } finally {
      setTesting(false);
    }
  };

  // Key CRUD Handlers
  const openAddKey = () => {
    setEditingKeyId(null);
    setNewKeyProvider('gemini');
    setNewKeyLabel('');
    setNewKeySecret('');
    setNewKeyProjectID('');
    setNewKeyRegion('us-central1');
    setNewKeyGCSBucket('');
    setNewKeyIsDefault(false);
    setIsKeyModalOpen(true);
  };

  const openEditKey = (k: APIKeyItem) => {
    setEditingKeyId(k.id);
    setNewKeyProvider(k.provider);
    setNewKeyLabel(k.label);
    setNewKeySecret(''); // ZERO EXPOSURE: never display or load existing secret
    setNewKeyProjectID(k.metadata?.project_id || '');
    setNewKeyRegion(k.metadata?.region || 'us-central1');
    setNewKeyGCSBucket(k.metadata?.gcs_bucket || '');
    setNewKeyIsDefault(!!k.is_default);
    setIsKeyModalOpen(true);
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyLabel.trim()) {
      toast.error('Key label is required');
      return;
    }
    if (!editingKeyId && !newKeySecret.trim()) {
      toast.error('API key secret cannot be empty');
      return;
    }

    try {
      setCreatingKey(true);
      let projectID = newKeyProjectID.trim();
      if (newKeyProvider === 'vertex_ai' && !projectID && newKeySecret.trim()) {
        try {
          const parsed = JSON.parse(newKeySecret.trim());
          if (parsed.project_id) {
            projectID = parsed.project_id;
          }
        } catch (_) {}
      }

      const metadata = newKeyProvider === 'vertex_ai' ? {
        project_id: projectID || undefined,
        region: newKeyRegion.trim() || 'us-central1',
        gcs_bucket: newKeyGCSBucket.trim() || undefined,
      } : undefined;

      if (editingKeyId) {
        await api.updateAPIKey(editingKeyId, {
          label: newKeyLabel.trim(),
          key_secret: newKeySecret.trim() ? newKeySecret.trim() : undefined,
          is_default: newKeyIsDefault,
          metadata,
        });
        activityLogService.addLog({
          category: 'admin',
          module: 'api_vault',
          action: 'api_key.update',
          target_id: newKeyLabel.trim(),
          target_title: `API Key • ${newKeyLabel.trim()} (${newKeyProvider.toUpperCase()})`,
          actor: {
            username: api.getCurrentUser()?.username || 'admin',
            role: 'Admin',
          },
          summary: `Cập nhật thông tin khóa API "${newKeyLabel.trim()}" trong két an toàn.`,
          summary_en: `Updated API key "${newKeyLabel.trim()}" in vault.`,
          status: 'success',
        });
        toast.success(language === 'vi' ? 'Đã cập nhật khóa API thành công!' : 'API Key updated successfully!');
      } else {
        await api.createAPIKey(newKeyProvider, newKeyLabel.trim(), newKeySecret.trim(), newKeyIsDefault, metadata);
        activityLogService.addLog({
          category: 'admin',
          module: 'api_vault',
          action: 'api_key.create',
          target_id: newKeyLabel.trim(),
          target_title: `API Key • ${newKeyLabel.trim()} (${newKeyProvider.toUpperCase()})`,
          actor: {
            username: api.getCurrentUser()?.username || 'admin',
            role: 'Admin',
          },
          summary: `Thêm khóa API mới "${newKeyLabel.trim()}" (Provider: ${newKeyProvider.toUpperCase()}) vào két an toàn.`,
          summary_en: `Created new API key "${newKeyLabel.trim()}" in vault.`,
          status: 'success',
        });
        toast.success(language === 'vi' ? 'Đã thêm khóa API thành công!' : 'API Key saved and validated successfully!');
      }
      setIsKeyModalOpen(false);
      setNewKeyLabel('');
      setNewKeySecret('');
      setNewKeyProjectID('');
      setNewKeyRegion('us-central1');
      setNewKeyGCSBucket('');
      await fetchSettings();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save API key');
    } finally {
      setCreatingKey(false);
    }
  };

  // Delete Key
  const handleDeleteKey = async (id: string, label: string) => {
    if (!confirm(`Are you sure you want to delete API key "${label}"?`)) return;
    try {
      await api.deleteAPIKey(id);
      activityLogService.addLog({
        category: 'admin',
        module: 'api_vault',
        action: 'api_key.delete',
        target_id: label,
        target_title: `API Key • ${label}`,
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: `Đã xóa khóa API "${label}" khỏi két an toàn.`,
        summary_en: `Deleted API key "${label}" from vault.`,
        status: 'warning',
      });
      toast.info(`API Key "${label}" deleted`);
      await fetchSettings();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete API key');
    }
  };

  // Model CRUD Handlers
  const openAddModel = () => {
    setEditingModelId(null);
    setModelFormId('');
    setModelFormProvider('openrouter');
    setModelFormDisplayName('');
    setModelFormContextTokens(128000);
    setModelFormMultimodal(false);
    setModelFormReasoning(true);
    setModelFormIsActive(true);
    setIsModelFormView(true);
  };

  const openEditModel = (m: AIModelItem) => {
    setEditingModelId(m.id);
    setModelFormId(m.model_id);
    setModelFormProvider(m.provider);
    setModelFormDisplayName(m.display_name);
    setModelFormContextTokens(m.context_tokens || 128000);
    setModelFormMultimodal(!!m.supports_multimodal);
    setModelFormReasoning(!!m.supports_reasoning);
    setModelFormIsActive(m.is_active !== false);
    setIsModelFormView(true);
  };

  const handleSaveModel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelFormDisplayName.trim()) {
      toast.error('Display Name is required');
      return;
    }
    if (!modelFormId.trim()) {
      toast.error('Model ID / API Identifier is required');
      return;
    }

    try {
      setSavingModel(true);
      const cleanModelId = modelFormId.trim();

      if (editingModelId) {
        await api.updateAIModel(editingModelId, {
          display_name: modelFormDisplayName.trim(),
          model_id: cleanModelId,
          context_tokens: Number(modelFormContextTokens) || 128000,
          supports_multimodal: modelFormMultimodal,
          supports_reasoning: modelFormReasoning,
          is_active: modelFormIsActive,
        });
        activityLogService.addLog({
          category: 'admin',
          module: 'model_catalog',
          action: 'model.update',
          target_id: editingModelId,
          target_title: `Model Catalog • ${modelFormDisplayName.trim()}`,
          actor: {
            username: api.getCurrentUser()?.username || 'admin',
            role: 'Admin',
          },
          summary: `Cập nhật thông số kỹ thuật mô hình "${modelFormDisplayName.trim()}" (${cleanModelId}) trong danh mục.`,
          summary_en: `Updated specifications for model "${modelFormDisplayName.trim()}" (${cleanModelId}) in catalog.`,
          status: 'success',
        });
        toast.success(t('aiStudioModelSaved'));
      } else {
        await api.createAIModel({
          provider: modelFormProvider,
          model_id: cleanModelId,
          display_name: modelFormDisplayName.trim(),
          context_tokens: Number(modelFormContextTokens) || 128000,
          supports_multimodal: modelFormMultimodal,
          supports_reasoning: modelFormReasoning,
          is_active: modelFormIsActive,
        });
        activityLogService.addLog({
          category: 'admin',
          module: 'model_catalog',
          action: 'model.create',
          target_id: cleanModelId,
          target_title: `Model Catalog • ${modelFormDisplayName.trim()}`,
          actor: {
            username: api.getCurrentUser()?.username || 'admin',
            role: 'Admin',
          },
          summary: `Đăng ký mô hình AI mới "${modelFormDisplayName.trim()}" (ID: ${modelFormId.trim()}) vào danh mục.`,
          summary_en: `Registered new model "${modelFormDisplayName.trim()}" in catalog.`,
          status: 'success',
        });
        toast.success(t('aiStudioModelSaved'));
      }
      setIsModelFormView(false);
      await fetchSettings();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save model');
    } finally {
      setSavingModel(false);
    }
  };

  const handleDeleteModel = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete model "${name}" (${id})?`)) return;
    try {
      await api.deleteAIModel(id);
      activityLogService.addLog({
        category: 'admin',
        module: 'model_catalog',
        action: 'model.delete',
        target_id: id,
        target_title: `Model Catalog • ${name} (${id})`,
        actor: {
          username: api.getCurrentUser()?.username || 'admin',
          role: 'Admin',
        },
        summary: `Đã xóa mô hình "${name}" (${id}) khỏi danh mục AI.`,
        summary_en: `Deleted model "${name}" (${id}) from catalog.`,
        status: 'warning',
      });
      toast.info(`Model "${name}" deleted`);
      await fetchSettings();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete model');
    }
  };

  const getNodeIcon = (key: string) => {
    switch (key) {
      case 'video_extraction':
        return <Video size={20} />;
      case 'checklist_mapping':
        return <CheckSquare size={20} />;
      case 'codebook_generation':
        return <BookMarked size={20} />;
      case 'thematic_analysis':
        return <Network size={20} />;
      case 'interview_generator':
        return <MessageSquare size={20} />;
      case 'interview_transcription':
        return <Mic size={20} />;
      case 'interview_analysis':
        return <Sparkles size={20} />;
      default:
        return <Cpu size={20} />;
    }
  };

  const getNodeIconBoxClass = (key: string) => {
    switch (key) {
      case 'video_extraction':
        return 'icon-video';
      case 'checklist_mapping':
        return 'icon-mapping';
      case 'codebook_generation':
        return 'icon-codebook';
      case 'thematic_analysis':
        return 'icon-themes';
      case 'interview_generator':
        return 'icon-questions';
      case 'interview_transcription':
        return 'icon-questions';
      case 'interview_analysis':
        return 'icon-themes';
      default:
        return 'icon-video';
    }
  };

  return (
    <div style={{ padding: '36px 40px', maxWidth: '1200px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', paddingBottom: '16px', borderBottom: '1px solid var(--card-border)' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '34px', fontWeight: 500, color: 'var(--accent)', marginBottom: '4px' }}>
            {activeAdminTab === 'activity_log'
              ? t('tabActivityLog')
              : activeAdminTab === 'telegram'
              ? t('tabTelegramAlerts')
              : t('tabApiConfig')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {activeAdminTab === 'activity_log'
              ? (language === 'vi' ? 'Theo dõi biến động cấu hình hệ thống AI Studio và dấu vết can thiệp phân tích sư phạm' : 'Audit trail tracking both AI Studio configuration adjustments and pedagogical research operations')
              : activeAdminTab === 'telegram'
              ? (language === 'vi' ? 'Quản lý kết nối Telegram Bot, danh sách người nhận đăng ký và kiểm thử thông báo phân tích video' : 'Manage Telegram bot integration, active subscriber channels, and pipeline completion alerts')
              : t('aiStudioSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {activeAdminTab === 'api_config' && (
            <>
              <button
                onClick={() => {
                  setIsModelFormView(false);
                  setIsModelModalOpen(true);
                }}
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '8px' }}
              >
                <Cpu size={15} />
                <span>{t('aiStudioManageModels')}</span>
              </button>
              <button
                onClick={openAddKey}
                className="btn btn-outline"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '8px' }}
              >
                <Key size={15} />
                <span>{t('aiStudioAddKey')}</span>
              </button>
              <button
                onClick={handleSaveAll}
                disabled={saving || loading}
                className="btn btn-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, padding: '9px 18px', borderRadius: '8px' }}
              >
                {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
                <span>{saving ? t('commonSaving') : t('aiStudioSaveAll')}</span>
              </button>
            </>
          )}

          {activeAdminTab === 'telegram' && (
            <button
              onClick={fetchTelegramStatus}
              className="btn btn-outline"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, padding: '9px 16px', borderRadius: '8px' }}
            >
              <RefreshCw size={15} />
              <span>{language === 'vi' ? 'Làm Mới Trạng Thái' : 'Refresh Status'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '4px',
        borderBottom: '1px solid var(--card-border)',
        marginTop: '-12px',
        marginBottom: '4px',
      }}>
        <button
          onClick={() => setActiveAdminTab('api_config')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: activeAdminTab === 'api_config' ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeAdminTab === 'api_config' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Sliders size={16} />
          <span>{t('tabApiConfig')}</span>
        </button>

        <button
          onClick={() => setActiveAdminTab('telegram')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: activeAdminTab === 'telegram' ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeAdminTab === 'telegram' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Bell size={16} />
          <span>{t('tabTelegramAlerts')}</span>
          {(telegramStatus?.active_subscribers ?? 0) > 0 && (
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              padding: '1px 6px',
              borderRadius: '999px',
              backgroundColor: activeAdminTab === 'telegram' ? 'var(--accent)' : 'rgba(34, 197, 94, 0.15)',
              color: activeAdminTab === 'telegram' ? '#FFFFFF' : '#16A34A',
            }}>
              {telegramStatus?.active_subscribers}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveAdminTab('activity_log')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: activeAdminTab === 'activity_log' ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeAdminTab === 'activity_log' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <History size={16} />
          <span>{t('tabActivityLog')}</span>
        </button>
      </div>

      {/* Tab 3: Activity Log */}
      {activeAdminTab === 'activity_log' && (
        <ActivityLogView onNavigateTab={(tab) => setActiveAdminTab(tab as any)} />
      )}

      {/* Tab 1: API Config & Routing Content */}
      {activeAdminTab === 'api_config' && (
        <>
      {/* Top Vault Strip: Saved Keys */}
      <div style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: '12px',
        padding: '16px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              {t('aiStudioActiveVault')}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
              <ShieldCheck size={16} color="var(--accent-green)" />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13.5px', fontWeight: 600 }}>
                {(settingsData?.api_keys || []).length} Registered Keys
              </span>
            </div>
          </div>
        </div>

        {/* Key Vault Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {(settingsData?.api_keys || []).map((k) => (
            <div
              key={k.id}
              style={{
                backgroundColor: 'var(--bg)',
                border: '1.5px solid var(--card-border)',
                borderRadius: '8px',
                padding: '6px 12px',
                fontSize: '12px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: k.provider === 'gemini' ? '#15803D' : k.provider === 'vertex_ai' ? '#0284C7' : '#7E22CE' }} />
              <span>{k.label}</span>
              {k.provider === 'vertex_ai' && (
                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#E0F2FE', color: '#0369A1', textTransform: 'uppercase' }}>
                  Vertex AI
                </span>
              )}
              {k.provider === 'vertex_ai' && k.metadata?.project_id && (
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }} title="GCP Project ID">
                  • {k.metadata.project_id}
                </span>
              )}
              {k.provider === 'vertex_ai' && k.metadata?.gcs_bucket && (
                <span style={{ fontSize: '9.5px', padding: '1px 5px', borderRadius: '4px', backgroundColor: 'rgba(234, 179, 8, 0.12)', color: '#B45309', fontFamily: 'var(--font-mono)', fontWeight: 600 }} title={`GCS Bucket: ${k.metadata.gcs_bucket}`}>
                  gs://{k.metadata.gcs_bucket}
                </span>
              )}
              {k.is_default && (
                <span style={{ fontSize: '9.5px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: '#E0E7FF', color: '#3730A3', textTransform: 'uppercase' }}>
                  Default
                </span>
              )}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                ({k.masked_key})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginLeft: '4px' }}>
                <button
                  onClick={() => openEditKey(k)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' }}
                  title="Edit Key"
                >
                  <Edit2 size={12} />
                </button>
                <button
                  onClick={() => handleDeleteKey(k.id, k.label)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', display: 'flex', alignItems: 'center', padding: '2px' }}
                  title="Delete Key"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
          {(settingsData?.api_keys || []).length === 0 && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              Using environment fallback credentials (.env)
            </span>
          )}
        </div>
      </div>

      {/* Main Studio Layout (Left: Flowgraph, Right: Inspector) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 390px', gap: '24px' }}>
        
        {/* Left: Pipeline Graph Canvas */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}>
          {/* Canvas Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={16} />
              <span>Pipeline Stage Nodes</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginRight: '4px' }}>PRESETS:</span>
              <button
                onClick={() => applyPreset('all-flash')}
                className={`preset-pill ${activePreset === 'all-flash' ? 'active' : ''}`}
                style={{
                  background: activePreset === 'all-flash' ? 'var(--accent-soft)' : 'var(--bg)',
                  borderColor: activePreset === 'all-flash' ? 'var(--accent)' : 'transparent',
                  color: activePreset === 'all-flash' ? 'var(--accent)' : 'inherit',
                  border: '1px solid',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('aiStudioPresetAllFlash')}
              </button>
              <button
                onClick={() => applyPreset('claude-research')}
                className={`preset-pill ${activePreset === 'claude-research' ? 'active' : ''}`}
                style={{
                  background: activePreset === 'claude-research' ? 'var(--accent-soft)' : 'var(--bg)',
                  borderColor: activePreset === 'claude-research' ? 'var(--accent)' : 'transparent',
                  color: activePreset === 'claude-research' ? 'var(--accent)' : 'inherit',
                  border: '1px solid',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('aiStudioPresetClaude')}
              </button>
              <button
                onClick={() => applyPreset('vertex-enterprise')}
                className={`preset-pill ${activePreset === 'vertex-enterprise' ? 'active' : ''}`}
                style={{
                  background: activePreset === 'vertex-enterprise' ? '#E0F2FE' : 'var(--bg)',
                  borderColor: activePreset === 'vertex-enterprise' ? '#0284C7' : 'transparent',
                  color: activePreset === 'vertex-enterprise' ? '#0369A1' : 'inherit',
                  border: '1px solid',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                GCP Vertex AI
              </button>
            </div>
          </div>

          {/* 3 Dedicated Pipeline Module Cards */}
          {(() => {
            const PIPELINE_MODULES = [
              {
                id: 'video',
                title: t('aiStudioModuleVideo'),
                sub: t('aiStudioModuleVideoSub'),
                uiTag: t('aiStudioTagUIVideo'),
                icon: Video,
                color: '#1D5C8A',
                flowKeys: ['video_extraction', 'checklist_mapping'],
                hasSequentialArrows: true,
              },
              {
                id: 'synthesis',
                title: t('aiStudioModuleSynthesis'),
                sub: t('aiStudioModuleSynthesisSub'),
                uiTag: t('aiStudioTagUIThemes'),
                icon: Network,
                color: '#6D28D9',
                flowKeys: ['codebook_generation', 'thematic_analysis', 'interview_generator'],
                hasSequentialArrows: false,
              },
              {
                id: 'interview',
                title: t('aiStudioModuleInterview'),
                sub: t('aiStudioModuleInterviewSub'),
                uiTag: t('aiStudioTagUIInterview'),
                icon: Sparkles,
                color: '#2D6A4F',
                flowKeys: ['interview_transcription', 'interview_analysis'],
                hasSequentialArrows: true,
              },
            ];

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {PIPELINE_MODULES.map((mod) => (
                  <div
                    key={mod.id}
                    style={{
                      backgroundColor: 'var(--bg)',
                      border: '1px solid var(--card-border)',
                      borderRadius: '12px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Module Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--card-border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '8px',
                          backgroundColor: mod.color,
                          color: '#FFFFFF',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <mod.icon size={17} />
                        </div>
                        <div>
                          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {mod.title}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                            {mod.sub}
                          </div>
                        </div>
                      </div>
                      <span style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '10.5px',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--card-bg)',
                        color: 'var(--accent)',
                        border: '1px solid var(--card-border)',
                        whiteSpace: 'nowrap',
                      }}>
                        {mod.uiTag}
                      </span>
                    </div>

                    {/* Module Flow Nodes */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {mod.flowKeys.map((flowKey, mIdx) => {
                        const meta = FLOW_METAS[flowKey];
                        const cfg = flowState[flowKey] || { model_catalog_id: '', temperature: 0.2 };
                        const assignedM = (settingsData?.models || []).find((m) => m.id === cfg.model_catalog_id);
                        const isSelected = selectedFlowKey === flowKey;

                        return (
                          <React.Fragment key={flowKey}>
                            <div
                              onClick={() => setSelectedFlowKey(flowKey)}
                              style={{
                                backgroundColor: isSelected ? 'var(--card-bg)' : '#FFFFFF',
                                border: isSelected ? '2px solid var(--accent)' : '1px solid var(--card-border)',
                                borderRadius: '10px',
                                padding: '12px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                cursor: 'pointer',
                                boxShadow: isSelected ? '0 0 0 3px rgba(146, 64, 14, 0.12)' : 'var(--shadow-sm)',
                                transition: 'all 0.18s ease',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                <div
                                  className={`node-icon-box ${getNodeIconBoxClass(flowKey)}`}
                                  style={{
                                    width: '38px',
                                    height: '38px',
                                    borderRadius: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                  }}
                                >
                                  {getNodeIcon(flowKey)}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                                    {language === 'vi' ? meta.stepVi : meta.stepEn}
                                  </span>
                                  <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)' }}>
                                    {language === 'vi' ? meta.titleVi : meta.titleEn}
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>
                                      {assignedM?.display_name || assignedM?.model_id || cfg.model_catalog_id || (language === 'vi' ? 'Chưa chọn model' : 'No model selected')}
                                    </span>
                                    <span>•</span>
                                    {(() => {
                                      const kObj = (settingsData?.api_keys || []).find((k) => k.id === cfg.api_key_id);
                                      if (kObj) {
                                        return (
                                          <span style={{ color: 'var(--accent-green, #16a34a)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                            <Key size={11} />
                                            <span>{kObj.label}</span>
                                          </span>
                                        );
                                      }
                                      return (
                                        <span style={{ color: 'var(--accent-red, #dc2626)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                          <AlertCircle size={11} />
                                          <span>{language === 'vi' ? 'Chưa gán Key' : 'No Key Assigned'}</span>
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                <span className={`pill ${meta.badgeClass}`} style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '10px' }}>
                                  {language === 'vi' ? meta.badgeVi : meta.badgeEn}
                                </span>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: 'var(--text-muted)' }}>
                                  Temp: {cfg.temperature.toFixed(2)}
                                </span>
                              </div>
                            </div>

                            {mod.hasSequentialArrows && mIdx < mod.flowKeys.length - 1 && (
                              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '10px', color: '#B5AFA6' }}>
                                <ArrowDown size={13} />
                              </div>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* Right: Dynamic Node Inspector Panel */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: '14px',
          padding: '24px',
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: '18px',
          height: 'fit-content',
          position: 'sticky',
          top: '20px',
        }}>
          <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
                {t('aiStudioNodeInspector')}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '10px',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--accent-soft)',
                color: 'var(--accent)',
              }}>
                {language === 'vi' ? currentMeta.uiScreenVi : currentMeta.uiScreenEn}
              </span>
            </div>
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
              {language === 'vi' ? currentMeta.titleVi : currentMeta.titleEn}
            </h3>
            <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '3px' }}>
              {language === 'vi' ? currentMeta.descVi : currentMeta.descEn}
            </p>
          </div>

          {/* Form: Model Selector (Filtered by capability) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
              {t('aiStudioTargetModel')}
            </label>
            <select
              value={currentFlow.model_catalog_id}
              onChange={(e) => handleModelChange(e.target.value)}
              className="select-control"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1.5px solid var(--card-border)',
                backgroundColor: 'var(--bg)',
                fontSize: '13.5px',
                fontWeight: 500,
                outline: 'none',
              }}
            >
              {[
                { id: 'vertex_ai', name: 'Google Cloud Vertex AI' },
                { id: 'gemini', name: 'Google Gemini Direct (AI Studio)' },
                { id: 'openrouter', name: 'OpenRouter Hub' },
              ].map((prov) => {
                const provModels = (settingsData?.models || [])
                  .filter((m) => m.provider === prov.id)
                  .filter((m) => !currentMeta.requireMultimodal || m.supports_multimodal);
                if (provModels.length === 0) return null;
                return (
                  <optgroup key={prov.id} label={prov.name}>
                    {provModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.display_name} ({m.model_id})
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>

          {/* Form: Key Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                {t('aiStudioAssignedKey')} <span style={{ color: 'var(--accent-red, #dc2626)' }}>*</span>
              </label>
              {currentModelInfo && (
                <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                  Provider: <b>{currentModelInfo.provider.toUpperCase()}</b>
                </span>
              )}
            </div>
            <select
              value={currentFlow.api_key_id || ''}
              onChange={(e) => handleKeyChange(e.target.value)}
              className="select-control"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: !currentFlow.api_key_id ? '1.5px solid var(--accent-red, #dc2626)' : '1.5px solid var(--card-border)',
                backgroundColor: 'var(--bg)',
                fontSize: '13.5px',
                fontWeight: 500,
                outline: 'none',
              }}
            >
              <option value="" disabled>
                {language === 'vi' ? '-- Chọn API Key bắt buộc từ Vault --' : '-- Select Required API Key from Vault --'}
              </option>
              {(settingsData?.api_keys || [])
                .filter((k) => !currentModelInfo || k.provider === currentModelInfo.provider)
                .map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label} ({k.masked_key}) {k.status !== 'active' ? `[${k.status.toUpperCase()}]` : ''}
                  </option>
                ))}
            </select>
            {(!settingsData?.api_keys || settingsData.api_keys.filter((k) => !currentModelInfo || k.provider === currentModelInfo.provider).length === 0) && (
              <div style={{ fontSize: '11.5px', color: 'var(--accent-red, #dc2626)', marginTop: '4px', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <AlertCircle size={13} style={{ flexShrink: 0 }} />
                <span>
                  {language === 'vi'
                    ? `Chưa có API Key nào cho ${currentModelInfo?.provider?.toUpperCase() || 'provider này'}. Vui lòng tạo key mới ở Key Vault phía dưới.`
                    : `No API key available for ${currentModelInfo?.provider?.toUpperCase() || 'this provider'}. Please add a key in the Vault below.`}
                </span>
              </div>
            )}
          </div>

          {/* Form: Temperature Slider */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                {t('aiStudioTemperature')}
              </label>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 700, color: 'var(--accent)' }}>
                {currentFlow.temperature.toFixed(2)}
              </span>
            </div>
            <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '12px' }}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={currentFlow.temperature}
                onChange={(e) => handleTemperatureChange(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, marginTop: '4px' }}>
                <span>0.0 Strict & Factual</span>
                <span>1.0 Exploratory</span>
              </div>
            </div>
          </div>

          {/* Model Specs Card */}
          {currentModelInfo && (
            <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '12px', fontSize: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Provider:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
                  {currentModelInfo.provider.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Context Window:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>
                  {currentModelInfo.context_tokens.toLocaleString()} tokens
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Reasoning Support:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: currentModelInfo.supports_reasoning ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  {currentModelInfo.supports_reasoning ? 'Yes (Extended Thinking)' : 'Standard'}
                </span>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={handleTestPing}
              disabled={testing}
              className="btn btn-outline"
              style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600 }}
            >
              {testing ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
              <span>{testing ? 'Testing connection...' : t('aiStudioTestPing')}</span>
            </button>
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="btn btn-primary"
              style={{ width: '100%', padding: '10px', fontSize: '13px', fontWeight: 600 }}
            >
              <CheckCircle2 size={14} />
              <span>{t('aiStudioApplyNode')}</span>
            </button>
          </div>
        </div>
      </div>
      </>
      )}

      {/* Tab 2: Telegram Notifications Dedicated Tab */}
      {activeAdminTab === 'telegram' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Top 3 KPI / Status Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            
            {/* Card 1: Bot Identity */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
            }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Bell size={13} color="var(--accent)" />
                    {language === 'vi' ? 'Bot Thông Báo' : 'Telegram Bot'}
                  </span>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: telegramStatus?.is_enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                    color: telegramStatus?.is_enabled ? '#16A34A' : 'var(--text-muted)',
                    border: telegramStatus?.is_enabled ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--card-border)',
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: telegramStatus?.is_enabled ? '#16A34A' : '#9CA3AF',
                      boxShadow: telegramStatus?.is_enabled ? '0 0 6px #16A34A' : 'none',
                    }} />
                    <span>{telegramStatus?.is_enabled ? (language === 'vi' ? 'Long-polling Active' : 'Long-polling Active') : (language === 'vi' ? 'Chưa cấu hình' : 'Disabled')}</span>
                  </div>
                </div>

                <a
                  href={`https://t.me/${telegramStatus?.bot_username || 'tesol_video_teaching_bot'}`}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: '17px',
                    fontWeight: 700,
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>@{telegramStatus?.bot_username || 'tesol_video_teaching_bot'}</span>
                  <ExternalLink size={15} />
                </a>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {language === 'vi'
                    ? 'Worker nền lắng nghe liên tục các lệnh đăng ký qua Telegram Bot API'
                    : 'Background worker continuously listening for chat commands via Telegram Bot API'}
                </p>
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
                Mode: <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)' }}>Background Daemon</span>
              </div>
            </div>

            {/* Card 2: Subscribers Counter */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <CheckCircle2 size={13} color="var(--accent-green)" />
                  {language === 'vi' ? 'Kênh Nhận Đã Đăng Ký' : 'Active Subscribers'}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                    {telegramStatus?.active_subscribers ?? 0}
                  </span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {language === 'vi' ? 'tài khoản / nhóm' : 'channels / groups'}
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {language === 'vi'
                    ? 'Lưu trữ bền vững trong cơ sở dữ liệu Supabase PostgreSQL'
                    : 'Persisted reliably in shared Supabase PostgreSQL database'}
                </p>
              </div>

              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
                Auto-unsubscribe: <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>Enabled on 403 Forbidden</span>
              </div>
            </div>

            {/* Card 3: Instant Test Alert */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: '20px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: '14px',
            }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                  <Send size={13} color="var(--accent)" />
                  {language === 'vi' ? 'Kiểm Thử Kết Nối' : 'Connection Testing'}
                </span>
                <p style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {language === 'vi'
                    ? 'Gửi ngay một tin nhắn thử nghiệm tới toàn bộ các tài khoản và nhóm đang đăng ký nhận tin.'
                    : 'Dispatch an immediate test notification to all currently active subscriber chats and channels.'}
                </p>
              </div>

              <button
                onClick={handleSendTelegramTest}
                disabled={sendingTelegramTest || !telegramStatus?.is_enabled}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '13px',
                  fontWeight: 600,
                  padding: '10px 16px',
                  borderRadius: '9px',
                  opacity: (!telegramStatus?.is_enabled || sendingTelegramTest) ? 0.6 : 1,
                  width: '100%',
                }}
              >
                <Send size={14} className={sendingTelegramTest ? 'animate-spin' : ''} />
                <span>{sendingTelegramTest ? (language === 'vi' ? 'Đang gửi thông báo...' : 'Sending alert...') : (language === 'vi' ? 'Gửi Thông Báo Thử Nghiệm' : 'Send Test Notification')}</span>
              </button>
            </div>
          </div>

          {/* Active Notification Flows Section (Unified Master Flows - Zero Emoji) */}
          <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid var(--card-border)',
            borderRadius: '14px',
            padding: '22px',
            boxShadow: 'var(--shadow-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--card-border)',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={18} color="var(--accent)" />
                  <span>{language === 'vi' ? 'Các Luồng Công Việc Tích Hợp Thông Báo Telegram' : 'Active Telegram Notification Flows'}</span>
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {language === 'vi'
                    ? 'Hệ thống tự động hóa thông báo cho 2 quy trình trọng tâm: Phân tích Video Giảng dạy & Phỏng vấn Giáo viên.'
                    : 'Automated real-time notifications integrated across 2 core workflows: Video Analysis Pipeline & Teacher Interview Studio.'}
                </p>
              </div>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '12px',
                fontWeight: 600,
                backgroundColor: telegramStatus?.is_enabled ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                color: telegramStatus?.is_enabled ? '#16A34A' : 'var(--text-muted)',
                border: telegramStatus?.is_enabled ? '1px solid rgba(34, 197, 94, 0.25)' : '1px solid var(--card-border)',
              }}>
                <span style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  backgroundColor: telegramStatus?.is_enabled ? '#16A34A' : '#9CA3AF',
                  boxShadow: telegramStatus?.is_enabled ? '0 0 6px #16A34A' : 'none',
                }} />
                <span>{telegramStatus?.is_enabled ? (language === 'vi' ? '2/2 Luồng đang kết nối' : '2/2 Flows Connected') : (language === 'vi' ? 'Tạm dừng / Disabled' : 'Disabled')}</span>
              </div>
            </div>

            {/* 2 Master Flow Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
              gap: '18px',
            }}>
              
              {/* FLOW 1: Video Analysis Pipeline (Unified Completed + Failed) */}
              <div style={{
                backgroundColor: (selectedPreviewFlow === 'pipeline_completed' || selectedPreviewFlow === 'pipeline_failed') ? 'rgba(29, 92, 138, 0.03)' : 'var(--card-bg)',
                border: (selectedPreviewFlow === 'pipeline_completed' || selectedPreviewFlow === 'pipeline_failed') ? '1.5px solid var(--accent-blue, #1D5C8A)' : '1px solid var(--card-border)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'all 0.2s ease',
                boxShadow: (selectedPreviewFlow === 'pipeline_completed' || selectedPreviewFlow === 'pipeline_failed') ? '0 4px 14px rgba(29, 92, 138, 0.08)' : 'none',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: 'rgba(29, 92, 138, 0.1)',
                        color: '#1D5C8A',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Video size={22} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                            {language === 'vi' ? 'Quy Trình Phân Tích Video' : 'Video Analysis Pipeline'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {language === 'vi' ? 'Bóc tách sự kiện, rubric checklist & codebook' : 'Event extraction, rubric mapping & codebook'}
                        </span>
                      </div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--card-border)',
                    }}>
                      video_pipeline
                    </span>
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '14px 0 10px', lineHeight: 1.5 }}>
                    {language === 'vi'
                      ? 'Quản lý toàn bộ thông báo phát sinh trong chu trình xử lý video: từ thông báo tổng hợp khi phân tích hoàn tất thành công đến cảnh báo tức thời khi gặp lỗi.'
                      : 'Manages notifications across the video pipeline lifecycle: sends completion summaries when analysis finishes or immediate alerts if any stage fails.'}
                  </p>

                  {/* Trigger Events Sub-list */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      {language === 'vi' ? 'Các sự kiện kích hoạt (Trigger Events):' : 'Trigger Events:'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewFlow('pipeline_completed')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: selectedPreviewFlow === 'pipeline_completed' ? '#1D5C8A' : 'var(--card-border)',
                          backgroundColor: selectedPreviewFlow === 'pipeline_completed' ? 'rgba(29, 92, 138, 0.1)' : 'var(--bg)',
                          color: selectedPreviewFlow === 'pipeline_completed' ? '#1D5C8A' : 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle2 size={13} color="#16A34A" />
                        <span>{language === 'vi' ? 'Hoàn tất: ' : 'Completed: '}<code>pipeline_completed</code></span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewFlow('pipeline_failed')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: selectedPreviewFlow === 'pipeline_failed' ? '#B26A00' : 'var(--card-border)',
                          backgroundColor: selectedPreviewFlow === 'pipeline_failed' ? 'rgba(178, 106, 0, 0.1)' : 'var(--bg)',
                          color: selectedPreviewFlow === 'pipeline_failed' ? '#B26A00' : 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        <AlertTriangle size={13} color="#B26A00" />
                        <span>{language === 'vi' ? 'Cảnh báo lỗi: ' : 'Failed: '}<code>pipeline_failed</code></span>
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Phạm vi' : 'Module'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Video Pipeline</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Kênh gửi' : 'Target'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Broadcast + Webhook</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Thông tin đính kèm' : 'Payload'}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>Events, Rubric, Report, Stack</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Đích đến' : 'Target URL'}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>/videos/:id</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Trigger: <code style={{ fontFamily: 'var(--font-mono)' }}>pipeline.go</code>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewFlow('pipeline_completed')}
                      style={{
                        fontSize: '11px',
                        color: selectedPreviewFlow === 'pipeline_completed' ? '#FFFFFF' : '#1D5C8A',
                        backgroundColor: selectedPreviewFlow === 'pipeline_completed' ? '#1D5C8A' : 'rgba(29, 92, 138, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {language === 'vi' ? 'Xem mẫu hoàn tất' : 'View Complete'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewFlow('pipeline_failed')}
                      style={{
                        fontSize: '11px',
                        color: selectedPreviewFlow === 'pipeline_failed' ? '#FFFFFF' : '#B26A00',
                        backgroundColor: selectedPreviewFlow === 'pipeline_failed' ? '#B26A00' : 'rgba(178, 106, 0, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {language === 'vi' ? 'Xem mẫu báo lỗi' : 'View Error'}
                    </button>
                  </div>
                </div>
              </div>

              {/* FLOW 2: Interview Studio Workflow (Transcribed + QA Aligned) */}
              <div style={{
                backgroundColor: (selectedPreviewFlow === 'interview_transcribed' || selectedPreviewFlow === 'interview_qa_aligned') ? 'rgba(158, 74, 40, 0.04)' : 'var(--card-bg)',
                border: (selectedPreviewFlow === 'interview_transcribed' || selectedPreviewFlow === 'interview_qa_aligned') ? '1.5px solid var(--accent)' : '1px solid var(--card-border)',
                borderRadius: '14px',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '16px',
                transition: 'all 0.2s ease',
                boxShadow: (selectedPreviewFlow === 'interview_transcribed' || selectedPreviewFlow === 'interview_qa_aligned') ? '0 4px 14px rgba(158, 74, 40, 0.08)' : 'none',
              }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                      <div style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        backgroundColor: 'var(--accent-soft)',
                        color: 'var(--accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        <Mic size={22} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                            {language === 'vi' ? 'Quy Trình Phỏng Vấn Giáo Viên' : 'Interview Studio Workflow'}
                          </span>
                        </div>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {language === 'vi' ? 'Gỡ băng tức thì & bóc tách thẻ Q&A độc lập' : 'Instant transcription & independent Q&A alignment'}
                        </span>
                      </div>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      backgroundColor: 'var(--bg)',
                      color: 'var(--text-muted)',
                      border: '1px solid var(--card-border)',
                    }}>
                      interview_studio
                    </span>
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '14px 0 10px', lineHeight: 1.5 }}>
                    {language === 'vi'
                      ? 'Tách biệt thành 2 thông báo theo 2 giai đoạn độc lập: thông báo tức thì khi audio được gỡ băng xong (~10s) và thông báo sau khi mô hình AI phân loại thành các thẻ Q&A hoàn tất.'
                      : 'Separated into 2 independent notification stages: instant alert right after audio transcription (~10s) and structured alert when AI completes Q&A card alignment.'}
                  </p>

                  {/* Trigger Events Sub-list */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em', marginBottom: '6px' }}>
                      {language === 'vi' ? 'Các sự kiện kích hoạt (Trigger Events):' : 'Trigger Events:'}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedPreviewFlow('interview_transcribed')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent)' : 'var(--card-border)',
                          backgroundColor: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent-soft)' : 'var(--bg)',
                          color: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent)' : 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        <CheckCircle2 size={13} color="var(--accent)" />
                        <span>{language === 'vi' ? 'Gỡ băng xong (~10s): ' : 'Transcribed: '}<code>interview_transcribed</code></span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPreviewFlow('interview_qa_aligned')}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '5px 10px',
                          borderRadius: '8px',
                          fontSize: '11.5px',
                          fontWeight: 600,
                          border: '1px solid',
                          borderColor: selectedPreviewFlow === 'interview_qa_aligned' ? '#9E4A28' : 'var(--card-border)',
                          backgroundColor: selectedPreviewFlow === 'interview_qa_aligned' ? 'rgba(158, 74, 40, 0.12)' : 'var(--bg)',
                          color: selectedPreviewFlow === 'interview_qa_aligned' ? '#9E4A28' : 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        <Layers size={13} color="#9E4A28" />
                        <span>{language === 'vi' ? 'Bóc tách thẻ Q&A: ' : 'Q&A Aligned: '}<code>interview_qa_aligned</code></span>
                      </button>
                    </div>
                  </div>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                    padding: '10px 12px',
                    backgroundColor: 'var(--bg)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Phạm vi' : 'Module'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Interview Studio</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Kênh gửi' : 'Target'}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Broadcast + Webhook</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Thông tin đính kèm' : 'Payload'}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: '11.5px' }}>Teacher ID, Snippet, Q&A List</span>
                    </div>
                    <div>
                      <div style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {language === 'vi' ? 'Đích đến' : 'Target URL'}
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--accent)' }}>/interview-analysis</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--card-border)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Trigger: <code style={{ fontFamily: 'var(--font-mono)' }}>interview_analysis.go</code>
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewFlow('interview_transcribed')}
                      style={{
                        fontSize: '11px',
                        color: selectedPreviewFlow === 'interview_transcribed' ? '#FFFFFF' : 'var(--accent)',
                        backgroundColor: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent)' : 'var(--accent-soft)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {language === 'vi' ? 'Mẫu gỡ băng' : 'Sample Audio'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPreviewFlow('interview_qa_aligned')}
                      style={{
                        fontSize: '11px',
                        color: selectedPreviewFlow === 'interview_qa_aligned' ? '#FFFFFF' : '#9E4A28',
                        backgroundColor: selectedPreviewFlow === 'interview_qa_aligned' ? '#9E4A28' : 'rgba(158, 74, 40, 0.1)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        border: 'none',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {language === 'vi' ? 'Mẫu thẻ Q&A' : 'Sample Q&A'}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* 2-Column Section: Instructions & Live Preview */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '20px' }}>
            
            {/* Left: Step-by-step Guide & Commands */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px',
            }}>
              <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={17} color="var(--accent)" />
                  <span>{language === 'vi' ? 'Hướng Dẫn Kết Nối & Đăng Ký' : 'Connection & Subscription Guide'}</span>
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {language === 'vi'
                    ? 'Thực hiện 3 bước đơn giản để nhận kết quả phân tích video tự động trên thiết bị của bạn:'
                    : 'Follow 3 simple steps to receive automated video pipeline alerts on your devices:'}
                </p>
              </div>

              {/* Steps List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg)',
                    border: '1.5px solid var(--accent)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>1</div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {language === 'vi' ? 'Mở Telegram và tìm bot' : 'Open Telegram and locate bot'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {language === 'vi' ? 'Tìm kiếm ' : 'Search for '}
                      <a
                        href={`https://t.me/${telegramStatus?.bot_username || 'tesol_video_teaching_bot'}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}
                      >
                        @{telegramStatus?.bot_username || 'tesol_video_teaching_bot'}
                      </a>
                      {language === 'vi' ? ' hoặc mở trực tiếp đường dẫn trên bất kỳ thiết bị nào.' : ' or click the direct link.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg)',
                    border: '1.5px solid var(--accent)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>2</div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {language === 'vi' ? 'Nhấn Start hoặc gửi lệnh /subscribe' : 'Press Start or send /subscribe'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {language === 'vi'
                        ? 'Bot sẽ tự động xác nhận và lưu Chat ID vào cơ sở dữ liệu chung để phát thông báo khi video hoặc bản gỡ xong.'
                        : 'Bot will instantly confirm and record your chat ID into shared database for pipeline and transcript alerts.'}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <div style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    backgroundColor: 'var(--bg)',
                    border: '1.5px solid var(--accent)',
                    color: 'var(--accent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>3</div>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                      {language === 'vi' ? 'Hỗ trợ nhóm nghiên cứu (Telegram Group)' : 'Team Research Groups Support'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {language === 'vi'
                        ? 'Thêm bot vào nhóm làm việc chung và gõ /subscribe. Toàn bộ thành viên nhóm sẽ cùng nhận kết quả.'
                        : 'Invite the bot to your group chat and type /subscribe. All team members will receive updates simultaneously.'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Command Reference Table */}
              <div style={{ borderTop: '1px solid var(--card-border)', paddingTop: '14px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
                  {language === 'vi' ? 'Bảng Lệnh Tương Tác Bot' : 'Bot Command Cheat-sheet'}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                  {[
                    { cmd: '/subscribe, /start', desc: language === 'vi' ? 'Đăng ký tài khoản hoặc nhóm nhận thông báo tự động' : 'Subscribe chat/group to pipeline alerts' },
                    { cmd: '/status', desc: language === 'vi' ? 'Xem trạng thái kết nối và số lượng kênh đang nhận tin' : 'Check subscription status & total active subscribers' },
                    { cmd: '/unsubscribe', desc: language === 'vi' ? 'Hủy nhận thông báo (khi nào cần có thể đăng ký lại)' : 'Deactivate notification delivery' },
                    { cmd: '/help', desc: language === 'vi' ? 'Xem hướng dẫn chi tiết từ bot' : 'Display bot instructions and usage guide' },
                  ].map((c) => (
                    <div
                      key={c.cmd}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: '7px',
                        backgroundColor: 'var(--bg)',
                        fontSize: '12.5px',
                      }}
                    >
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)' }}>{c.cmd}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{c.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Realistic Telegram Message Bubble Mockup (Zero Emoji, Clean Typography) */}
            <div style={{
              backgroundColor: 'var(--card-bg)',
              border: '1px solid var(--card-border)',
              borderRadius: '14px',
              padding: '24px',
              boxShadow: 'var(--shadow-sm)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}>
              <div style={{ borderBottom: '1px solid var(--card-border)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={17} color="var(--accent)" />
                    <span>{language === 'vi' ? 'Xem Trước Tin Nhắn Mẫu' : 'Alert Message Preview'}</span>
                  </h3>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {language === 'vi' ? 'Nội dung định dạng theo chuẩn giao tiếp Telegram Bot' : 'Format of automated notifications dispatched via Telegram Bot'}
                  </p>
                </div>
                <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent)', backgroundColor: 'var(--accent-soft)', padding: '2px 8px', borderRadius: '5px' }}>
                  HTML Mode
                </span>
              </div>

              {/* Flow Selector Pills */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewFlow('pipeline_completed')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: selectedPreviewFlow === 'pipeline_completed' ? '#1D5C8A' : 'var(--card-border)',
                    backgroundColor: selectedPreviewFlow === 'pipeline_completed' ? 'rgba(29, 92, 138, 0.1)' : 'var(--bg)',
                    color: selectedPreviewFlow === 'pipeline_completed' ? '#1D5C8A' : 'var(--text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Video size={13} />
                  <span>{language === 'vi' ? 'Video Hoàn Tất' : 'Video Completed'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewFlow('pipeline_failed')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: selectedPreviewFlow === 'pipeline_failed' ? '#B26A00' : 'var(--card-border)',
                    backgroundColor: selectedPreviewFlow === 'pipeline_failed' ? 'rgba(178, 106, 0, 0.1)' : 'var(--bg)',
                    color: selectedPreviewFlow === 'pipeline_failed' ? '#B26A00' : 'var(--text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <AlertTriangle size={13} />
                  <span>{language === 'vi' ? 'Cảnh Báo Lỗi Video' : 'Video Failed'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewFlow('interview_transcribed')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent)' : 'var(--card-border)',
                    backgroundColor: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent-soft)' : 'var(--bg)',
                    color: selectedPreviewFlow === 'interview_transcribed' ? 'var(--accent)' : 'var(--text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Mic size={13} />
                  <span>{language === 'vi' ? 'Gỡ Băng Âm Thanh' : 'Audio Transcribed'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedPreviewFlow('interview_qa_aligned')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: '1px solid',
                    borderColor: selectedPreviewFlow === 'interview_qa_aligned' ? '#9E4A28' : 'var(--card-border)',
                    backgroundColor: selectedPreviewFlow === 'interview_qa_aligned' ? 'rgba(158, 74, 40, 0.12)' : 'var(--bg)',
                    color: selectedPreviewFlow === 'interview_qa_aligned' ? '#9E4A28' : 'var(--text-muted)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <Layers size={13} />
                  <span>{language === 'vi' ? 'Bóc Tách Thẻ Q&A' : 'Q&A Aligned'}</span>
                </button>
              </div>

              {/* Simulated Telegram Chat Bubble (Zero Emoji, Clean Typography) */}
              {selectedPreviewFlow === 'pipeline_completed' && (
                <div style={{
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid #334155',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#38BDF8', letterSpacing: '0.01em' }}>
                    [THÔNG BÁO HOÀN TẤT PHÂN TÍCH VIDEO]
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '12.5px' }}>
                    <div><b>Video:</b> {language === 'vi' ? 'Giảng dạy tiếng Anh - Lớp 10A1' : 'English Teaching - Grade 10A1'}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94A3B8' }}>Mã định danh: 8833bde7-0760-4398-9326-70af38d5a45e</div>
                    <div><b>Thời lượng:</b> 42 phút 15 giây</div>
                    <div><b>Chế độ xử lý:</b> Chunking (Phân đoạn song song)</div>
                    <div><b>Thời gian xử lý:</b> 3m 20s</div>
                    <div><b>Sự kiện trích xuất:</b> 28 sự kiện</div>
                    <div><b>Đối chiếu Rubric:</b> 14 mục checklist</div>
                    <div style={{ color: '#4ADE80' }}><b>Báo cáo quan sát:</b> Đã tạo thành công</div>
                    <div style={{ color: '#4ADE80' }}><b>Qualitative Codebook:</b> Đã tổng hợp</div>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '6px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                      Xem chi tiết kết quả trong hệ thống (/videos/8833bde7...)
                    </span>
                  </div>

                  <div style={{ alignSelf: 'flex-end', fontSize: '10px', color: '#64748B', marginTop: '-4px' }}>
                    16:45 • Đã chuyển phát
                  </div>
                </div>
              )}

              {selectedPreviewFlow === 'pipeline_failed' && (
                <div style={{
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid #7F1D1D',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#F87171', letterSpacing: '0.01em' }}>
                    [CẢNH BÁO SỰ CỐ PHÂN TÍCH VIDEO]
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '12.5px' }}>
                    <div><b>Video:</b> {language === 'vi' ? 'Tiết dạy Toán thực nghiệm' : 'Experimental Math Lesson'}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#94A3B8' }}>Mã định danh: c182de44-991b-4f76-8501-92be34df90a1</div>
                    <div><b>Công đoạn lỗi:</b> <code>event_extraction</code></div>
                    <div style={{ color: '#FCA5A5', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '6px 8px', borderRadius: '6px', fontFamily: 'var(--font-mono)', fontSize: '11.5px', marginTop: '4px' }}>
                      Chi tiết lỗi: Google Vertex AI 429 Quota Exceeded (Resource exhausted)
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '6px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                      Xem chi tiết sự cố trong hệ thống (/videos/c182de44...)
                    </span>
                  </div>

                  <div style={{ alignSelf: 'flex-end', fontSize: '10px', color: '#64748B', marginTop: '-4px' }}>
                    17:12 • Đã chuyển phát
                  </div>
                </div>
              )}

              {selectedPreviewFlow === 'interview_transcribed' && (
                <div style={{
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid #9E4A28',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FDBA74', letterSpacing: '0.01em' }}>
                    [THÔNG BÁO GỠ BĂNG ÂM THANH PHỎNG VẤN]
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '12.5px' }}>
                    <div><b>Giáo viên:</b> <code style={{ color: '#FDBA74' }}>T02</code></div>
                    <div><b>Tệp âm thanh:</b> interview_t02_record.m4a</div>
                    <div><b>Thời lượng âm thanh:</b> 18 phút 45 giây (1125.0s)</div>
                    <div><b>Ngôn ngữ:</b> Tiếng Việt (VI)</div>
                    <div><b>Thời gian gỡ băng:</b> 9.8s (Tức thì)</div>
                    <div><b>Độ dài văn bản:</b> 5,246 ký tự</div>
                    
                    <div style={{
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderLeft: '3px solid #FDBA74',
                      padding: '8px 10px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontStyle: 'italic',
                      color: '#E2E8F0',
                      marginTop: '6px',
                    }}>
                      Trích đoạn: "Chào thầy, hôm nay chúng ta tiếp tục trao đổi về các phương pháp đặt câu hỏi tương tác trong lớp học tiếng Anh..."
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '6px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                      Mở Interview Studio để duyệt bản gỡ (/interview-analysis?teacher=T02)
                    </span>
                  </div>

                  <div style={{ alignSelf: 'flex-end', fontSize: '10px', color: '#64748B', marginTop: '-4px' }}>
                    18:30 • Đã chuyển phát
                  </div>
                </div>
              )}

              {selectedPreviewFlow === 'interview_qa_aligned' && (
                <div style={{
                  backgroundColor: '#1E293B',
                  color: '#F8FAFC',
                  borderRadius: '12px',
                  padding: '16px 18px',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  border: '1px solid #9E4A28',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}>
                  <div style={{ fontSize: '14.5px', fontWeight: 700, color: '#FDBA74', letterSpacing: '0.01em' }}>
                    [THÔNG BÁO BÓC TÁCH THẺ Q&A PHỎNG VẤN]
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px', fontSize: '12.5px' }}>
                    <div><b>Giáo viên:</b> <code style={{ color: '#FDBA74' }}>T02</code></div>
                    <div><b>Số lượng thẻ Q&A đã tạo:</b> 5 thẻ câu hỏi - trả lời</div>
                    <div><b>Thời gian phân tích AI:</b> 45s</div>
                    
                    <div style={{ marginTop: '4px' }}>
                      <b>Danh sách câu hỏi đã bóc tách:</b>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '4px', paddingLeft: '8px', borderLeft: '2px solid #9E4A28', fontSize: '12px', color: '#E2E8F0' }}>
                        <div>• Phương pháp đặt câu hỏi tương tác trong tiết dạy</div>
                        <div>• Quản lý thời lượng hoạt động nhóm</div>
                        <div>• Khó khăn khi triển khai hoạt động Speaking</div>
                        <div>• Đánh giá mức độ tiếp thu của học sinh yếu</div>
                        <div style={{ fontStyle: 'italic', color: '#94A3B8' }}>...và 1 câu hỏi khác</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #334155', paddingTop: '8px', marginTop: '6px' }}>
                    <span style={{ color: '#38BDF8', fontWeight: 600, textDecoration: 'underline', cursor: 'pointer' }}>
                      Xem chi tiết thẻ Q&A trong Interview Studio (/interview-analysis?teacher=T02)
                    </span>
                  </div>

                  <div style={{ alignSelf: 'flex-end', fontSize: '10px', color: '#64748B', marginTop: '-4px' }}>
                    18:32 • Đã chuyển phát
                  </div>
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center' }}>
                {language === 'vi'
                  ? 'Bấm nút "Xem mẫu" ở từng sự kiện phía trên để kiểm tra trước định dạng tin nhắn Telegram tương ứng.'
                  : 'Click "View Sample" on any event above to preview its Telegram notification layout.'}
              </p>
            </div>
          </div>
        </div>
      )}


      {/* Modal: Add / Edit API Key */}
      {isKeyModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '14px',
            width: '500px',
            maxWidth: '92%',
            padding: '28px',
            boxShadow: 'var(--shadow-lg)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} color="var(--accent)" />
                <h3 style={{ fontSize: '18px', fontWeight: 700 }}>
                  {editingKeyId ? (language === 'vi' ? 'Chỉnh Sửa Khóa API' : 'Edit API Key') : (language === 'vi' ? 'Thêm Khóa API Mới' : 'Add AI Provider Key')}
                </h3>
              </div>
              <button
                onClick={() => setIsKeyModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveKey} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Provider
                </label>
                <select
                  value={newKeyProvider}
                  onChange={(e) => setNewKeyProvider(e.target.value)}
                  disabled={!!editingKeyId}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', backgroundColor: 'var(--bg)', fontSize: '13px' }}
                >
                  <option value="gemini">Google Gemini Direct API</option>
                  <option value="vertex_ai">Google Cloud Vertex AI (Service Account)</option>
                  <option value="openrouter">OpenRouter API (Claude 3.7 / GPT-4o / DeepSeek)</option>
                  <option value="anthropic">Anthropic Claude Direct API</option>
                  <option value="openai">OpenAI Direct API</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Key Label / Nickname
                </label>
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder={newKeyProvider === 'vertex_ai' ? 'e.g. GCP Vertex AI Production' : 'e.g. Gemini Paid Backup Account'}
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {newKeyProvider === 'vertex_ai' ? 'Service Account JSON Credentials' : 'Secret API Key String'}
                  </label>
                  {editingKeyId && (
                    <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600 }}>
                      (Optional Overwrite)
                    </span>
                  )}
                </div>
                {newKeyProvider === 'vertex_ai' ? (
                  <textarea
                    value={newKeySecret}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewKeySecret(val);
                      try {
                        const parsed = JSON.parse(val);
                        if (parsed.project_id && !newKeyProjectID) {
                          setNewKeyProjectID(parsed.project_id);
                        }
                      } catch (_) {}
                    }}
                    placeholder={editingKeyId ? '•••••••••••••••• (Leave blank to keep existing credentials)' : 'Paste Service Account JSON content here (or file path)...'}
                    required={!editingKeyId}
                    rows={4}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontFamily: 'var(--font-mono)', fontSize: '12px', resize: 'vertical' }}
                  />
                ) : (
                  <input
                    type="password"
                    value={newKeySecret}
                    onChange={(e) => setNewKeySecret(e.target.value)}
                    placeholder={editingKeyId ? '•••••••••••••••• (Leave blank to keep existing secret)' : 'AIzaSy... or sk-or-...'}
                    required={!editingKeyId}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                  />
                )}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {newKeyProvider === 'vertex_ai'
                    ? (language === 'vi' ? 'Nội dung file JSON Service Account tải từ Google Cloud Console có quyền Vertex AI & Cloud Storage.' : 'GCP Service Account JSON with Vertex AI User and Storage Object Admin roles.')
                    : editingKeyId
                    ? (language === 'vi' ? 'Khóa hiện tại được bảo mật và không hiển thị. Chỉ nhập chuỗi mới nếu bạn muốn thay đổi.' : 'Current key is kept securely secret. Enter a new string only if you want to overwrite it.')
                    : 'Secret token used to authenticate against AI provider endpoints.'}
                </span>
              </div>

              {newKeyProvider === 'vertex_ai' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', backgroundColor: 'var(--bg)', borderRadius: '8px', border: '1px solid var(--card-border)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      GCP Project ID
                    </label>
                    <input
                      type="text"
                      value={newKeyProjectID}
                      onChange={(e) => setNewKeyProjectID(e.target.value)}
                      placeholder="e.g. my-gcp-project"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid var(--card-border)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        Region
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>
                        <input
                          type="checkbox"
                          checked={newKeyRegion === 'global'}
                          onChange={(e) => setNewKeyRegion(e.target.checked ? 'global' : 'us-central1')}
                          style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                        />
                        <span>{language === 'vi' ? 'Toàn cầu (Tự động)' : 'Global (Auto)'}</span>
                      </label>
                    </div>
                    {newKeyRegion === 'global' ? (
                      <div style={{
                        padding: '7px 11px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(37, 99, 235, 0.07)',
                        border: '1px solid rgba(37, 99, 235, 0.22)',
                        fontSize: '11.5px',
                        color: '#1D4ED8',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <span style={{
                          position: 'relative',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '20px',
                          height: '20px',
                          borderRadius: '50%',
                          backgroundColor: '#EFF6FF',
                          border: '1px solid rgba(59, 130, 246, 0.35)',
                          color: '#2563EB',
                          flexShrink: 0,
                        }}>
                          <Globe size={11} strokeWidth={2.2} />
                          <span style={{
                            position: 'absolute',
                            top: '-1px',
                            right: '-1px',
                            width: '5px',
                            height: '5px',
                            borderRadius: '50%',
                            backgroundColor: '#10B981',
                            boxShadow: '0 0 4px #10B981',
                          }} />
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', flexWrap: 'wrap' }}>
                          <strong style={{ fontWeight: 700, color: '#1E40AF' }}>Global Endpoint</strong>
                          <span style={{ color: '#3B82F6', fontSize: '11px' }}>
                            ({language === 'vi' ? 'Tự động định tuyến toàn cầu' : 'Automatic worldwide routing'})
                          </span>
                        </div>
                      </div>
                    ) : (
                      <input
                        type="text"
                        value={newKeyRegion}
                        onChange={(e) => setNewKeyRegion(e.target.value)}
                        placeholder="us-central1"
                        style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid var(--card-border)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                      />
                    )}
                  </div>
                  <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Cloud Storage Bucket (Optional, for Video Extraction)
                    </label>
                    <input
                      type="text"
                      value={newKeyGCSBucket}
                      onChange={(e) => setNewKeyGCSBucket(e.target.value)}
                      placeholder="e.g. my-video-chunks-bucket"
                      style={{ width: '100%', padding: '7px 10px', borderRadius: '5px', border: '1px solid var(--card-border)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                    />
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {language === 'vi' ? 'GCS bucket dùng để tải tạm video chunks trước khi gửi tới Vertex AI Gemini model.' : 'Required for video extraction flow. Video chunks are uploaded here and auto-cleaned after inference.'}
                    </span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                <input
                  type="checkbox"
                  id="key_is_default"
                  checked={newKeyIsDefault}
                  onChange={(e) => setNewKeyIsDefault(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                />
                <label htmlFor="key_is_default" style={{ fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>
                  {language === 'vi' ? 'Đặt làm khóa mặc định cho nhà cung cấp này' : 'Set as default key for this provider'}
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsKeyModalOpen(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="btn btn-primary"
                >
                  {creatingKey ? 'Saving...' : (editingKeyId ? 'Update API Key' : 'Save API Key')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Model Catalog & CRUD Management */}
      {isModelModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{
            backgroundColor: 'var(--card-bg)',
            borderRadius: '14px',
            width: '740px',
            maxWidth: '94%',
            maxHeight: '88vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
          }}>
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '20px 26px',
              borderBottom: '1px solid var(--card-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Cpu size={20} color="var(--accent)" />
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>
                    {isModelFormView
                      ? (editingModelId ? t('aiStudioEditModel') : t('aiStudioAddModel'))
                      : t('aiStudioModelCatalogTitle')}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {isModelFormView
                      ? (editingModelId ? `ID: ${editingModelId}` : 'Register a new model to available flow dropdowns')
                      : `${(settingsData?.models || []).length} Models in database catalog`}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {!isModelFormView && (
                  <button
                    onClick={openAddModel}
                    className="btn btn-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '7px 14px', borderRadius: '7px' }}
                  >
                    <Plus size={14} />
                    <span>{t('aiStudioAddModel')}</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsModelModalOpen(false);
                    setIsModelFormView(false);
                  }}
                  style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--text-muted)', marginLeft: '6px' }}
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '24px 26px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* VIEW 1: Models List Table/Cards */}
              {!isModelFormView && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {(settingsData?.models || []).map((m) => (
                    <div
                      key={m.id}
                      style={{
                        backgroundColor: 'var(--bg)',
                        border: '1.5px solid var(--card-border)',
                        borderRadius: '10px',
                        padding: '14px 18px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '14px',
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '2px 7px',
                            borderRadius: '5px',
                            backgroundColor: m.provider === 'gemini' ? '#DCFCE7' : m.provider === 'vertex_ai' ? '#E0F2FE' : '#F3E8FF',
                            color: m.provider === 'gemini' ? '#15803D' : m.provider === 'vertex_ai' ? '#0284C7' : '#7E22CE',
                          }}>
                            {m.provider === 'vertex_ai' ? 'Vertex AI' : m.provider}
                          </span>
                          <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                            {m.display_name}
                          </span>
                          {m.is_active === false && (
                            <span style={{ fontSize: '11px', color: '#9CA3AF', fontStyle: 'italic' }}>(Disabled)</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            Model: <b>{m.model_id}</b>
                          </span>
                          <span style={{ color: 'var(--card-border)' }}>•</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {(m.context_tokens || 128000).toLocaleString()} tokens
                          </span>
                          {m.supports_multimodal && (
                            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Video size={11} />
                              <span>Video Multimodal</span>
                            </span>
                          )}
                          {m.supports_reasoning && (
                            <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: '#E0E7FF', color: '#3730A3', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <Sparkles size={11} />
                              <span>Reasoning</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          onClick={() => openEditModel(m)}
                          className="btn btn-outline"
                          style={{ padding: '6px 10px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '5px', borderRadius: '6px' }}
                          title="Edit Specs"
                        >
                          <Edit2 size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDeleteModel(m.id, m.display_name)}
                          className="btn btn-outline"
                          style={{ padding: '6px 9px', color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)', borderRadius: '6px' }}
                          title="Delete Model"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {(settingsData?.models || []).length === 0 && (
                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No models found. Click "+ Add New Model" to register one.
                    </div>
                  )}
                </div>
              )}

              {/* VIEW 2: Add / Edit Form */}
              {isModelFormView && (
                <form onSubmit={handleSaveModel} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {t('aiStudioModelProvider')}
                      </label>
                      <select
                        value={modelFormProvider}
                        onChange={(e) => setModelFormProvider(e.target.value)}
                        disabled={!!editingModelId}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', backgroundColor: 'var(--bg)', fontSize: '13px' }}
                      >
                        <option value="openrouter">OpenRouter Hub (Claude, GPT, Llama, DeepSeek...)</option>
                        <option value="gemini">Google Gemini Direct</option>
                        <option value="vertex_ai">Google Cloud Vertex AI</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                        {t('aiStudioModelContextTokens')}
                      </label>
                      <input
                        type="number"
                        value={modelFormContextTokens}
                        onChange={(e) => setModelFormContextTokens(parseInt(e.target.value) || 128000)}
                        placeholder="128000"
                        style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontSize: '13px', fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('aiStudioModelId')}
                    </label>
                    <input
                      type="text"
                      value={modelFormId}
                      onChange={(e) => setModelFormId(e.target.value)}
                      placeholder={
                        modelFormProvider === 'vertex_ai'
                          ? 'e.g. gemini-3.7-flash'
                          : modelFormProvider === 'openrouter'
                          ? 'e.g. anthropic/claude-3.7-sonnet'
                          : 'e.g. gemini-2.5-flash'
                      }
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--card-border)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        backgroundColor: 'var(--bg)',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {language === 'vi'
                        ? 'Mã Model ID kỹ thuật nguyên bản của nhà cung cấp (ví dụ: gemini-3.7-flash, claude-3.7-sonnet, gpt-4o).'
                        : 'Exact vendor technical model ID string (e.g. gemini-3.7-flash, claude-3.7-sonnet, gpt-4o).'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      {t('aiStudioModelDisplayName')}
                    </label>
                    <input
                      type="text"
                      value={modelFormDisplayName}
                      onChange={(e) => setModelFormDisplayName(e.target.value)}
                      placeholder="e.g. Meta: Llama 3.3 70B (OpenRouter)"
                      required
                      style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontSize: '13px' }}
                    />
                  </div>

                  {/* Checkbox Options */}
                  <div style={{
                    backgroundColor: 'var(--bg)',
                    border: '1px solid var(--card-border)',
                    borderRadius: '8px',
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={modelFormMultimodal}
                        onChange={(e) => setModelFormMultimodal(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                      />
                      <span>{t('aiStudioModelMultimodal')} (Required for Step 1 Video Extraction)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={modelFormReasoning}
                        onChange={(e) => setModelFormReasoning(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                      />
                      <span>{t('aiStudioModelReasoning')} (CoT / Extended Thinking)</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={modelFormIsActive}
                        onChange={(e) => setModelFormIsActive(e.target.checked)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--accent)' }}
                      />
                      <span>{t('aiStudioModelIsActive')}</span>
                    </label>
                  </div>

                  {/* Form Footer */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
                    <button
                      type="button"
                      onClick={() => setIsModelFormView(false)}
                      className="btn btn-outline"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                    >
                      <ArrowLeft size={14} />
                      <span>Back to Catalog</span>
                    </button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsModelFormView(false);
                          setIsModelModalOpen(false);
                        }}
                        className="btn btn-outline"
                        style={{ fontSize: '13px' }}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingModel}
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                      >
                        {savingModel ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                        <span>{savingModel ? 'Saving...' : 'Save Model Specs'}</span>
                      </button>
                    </div>
                  </div>
                </form>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
