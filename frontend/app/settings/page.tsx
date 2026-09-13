'use client';

import React, { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { api, AIFlowsSettingsData, AIModelItem, APIKeyItem, FlowConfigItem, TestPingResult } from '@/lib/api';
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
  ExternalLink,
  Sliders,
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
}

const FLOW_METAS: Record<string, FlowMeta> = {
  video_extraction: {
    titleEn: 'Video Extraction & Chunking',
    titleVi: 'Bóc Tách & Nhận Diện Video',
    stepEn: 'Step 01 • Multimodal Understanding',
    stepVi: 'Bước 01 • Đa Phương Thức (Video/Audio)',
    descEn: 'Multimodal video understanding, chunk processing & timestamp extraction.',
    descVi: 'Xem và phân tích video/audio theo từng chunk để bóc tách hành vi và câu thoại.',
    badgeEn: 'Direct File API',
    badgeVi: 'Google Video API',
    badgeClass: 'pill-amber',
    requireMultimodal: true,
  },
  checklist_mapping: {
    titleEn: 'Checklist Mapping & Scoring',
    titleVi: 'Khớp Tiêu Chí Khung Quan Sát',
    stepEn: 'Step 02 • Pedagogical Alignment',
    stepVi: 'Bước 02 • Đối Chiếu Khung Sư Phạm',
    descEn: 'Maps and scores extracted classroom events against observation checklist rubrics.',
    descVi: 'Khớp các hành vi thô đã bóc tách vào từng chỉ báo trong bảng kiểm sư phạm.',
    badgeEn: 'Pedagogical Mapping',
    badgeVi: 'Khớp Tiêu Chí',
    badgeClass: 'pill-blue',
    requireMultimodal: false,
  },
  thematic_analysis: {
    titleEn: 'Teaching Themes & Categories',
    titleVi: 'Chủ Đề Sư Phạm & Lý Thuyết Nền',
    stepEn: 'Step 03 • Grounded Theory Themes',
    stepVi: 'Bước 03 • Phân Tích Định Tính (Grounded Theory)',
    descEn: 'Synthesizes Grounded Theory categories & themes with empirical reasoning traces.',
    descVi: 'Gom cụm các chiến thuật lặp lại thành Category và Theme kèm lập luận định tính.',
    badgeEn: 'Reasoning Trace',
    badgeVi: 'Lập Luận Định Tính',
    badgeClass: 'pill-purple',
    requireMultimodal: false,
  },
  interview_generator: {
    titleEn: 'Dynamic Interview Questions',
    titleVi: 'Sinh Bộ Câu Hỏi Phỏng Vấn',
    stepEn: 'Step 04 • Teacher Inquiry',
    stepVi: 'Bước 04 • Phỏng Vấn Sâu Giáo Viên',
    descEn: 'Generates evidence-grounded interview inquiry questionnaires citing actual video timestamps.',
    descVi: 'Tạo bộ câu hỏi phỏng vấn sâu cá nhân hóa trích dẫn mốc thời gian thực tế trong video.',
    badgeEn: 'Evidence Citations',
    badgeVi: 'Trích Dẫn Bằng Chứng',
    badgeClass: 'pill-green',
    requireMultimodal: false,
  },
  codebook_generation: {
    titleEn: 'Observation Code Book Synthesis',
    titleVi: 'Tổng Hợp Sổ Mã Quan Sát',
    stepEn: 'Step 05 • Standardized Codebook',
    stepVi: 'Bước 05 • Chuẩn Hóa Sổ Mã (Code Book)',
    descEn: 'Synthesizes standardized qualitative observation codes directly from raw events.',
    descVi: 'Đọc toàn bộ sự kiện thô để sinh định nghĩa, tiêu chí bao gồm/loại trừ và ví dụ.',
    badgeEn: 'Raw Event Grounded',
    badgeVi: 'Tổng Hợp Sự Kiện Thô',
    badgeClass: 'pill-amber',
    requireMultimodal: false,
  },
};

const FLOW_ORDER = [
  'video_extraction',
  'checklist_mapping',
  'thematic_analysis',
  'interview_generator',
  'codebook_generation',
];

export default function SettingsPage() {
  const { t, language } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [settingsData, setSettingsData] = useState<AIFlowsSettingsData | null>(null);
  const [flowState, setFlowState] = useState<Record<string, { model_id: string; api_key_id?: string; temperature: number; fallback_model_id?: string }>>({});
  const [selectedFlowKey, setSelectedFlowKey] = useState<string>('video_extraction');
  const [activePreset, setActivePreset] = useState<string>('custom');
  const [activeAdminTab, setActiveAdminTab] = useState<'admin_center' | 'activity_log'>('admin_center');

  // Key Modal State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [editingKeyId, setEditingKeyId] = useState<string | null>(null);
  const [newKeyProvider, setNewKeyProvider] = useState('gemini');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeySecret, setNewKeySecret] = useState('');
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

  // Load Settings
  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.getAIFlowsSettings();
      setSettingsData(res);

      const stateMap: Record<string, { model_id: string; api_key_id?: string; temperature: number; fallback_model_id?: string }> = {};
      (res?.flows || []).forEach((f) => {
        stateMap[f.flow_key] = {
          model_id: f.model_id,
          api_key_id: f.api_key_id,
          temperature: f.temperature,
          fallback_model_id: f.fallback_model_id,
        };
      });
      setFlowState(stateMap);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load AI settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const currentFlow = flowState[selectedFlowKey] || {
    model_id: 'gemini-3.7-flash',
    temperature: 0.2,
  };

  const currentMeta = FLOW_METAS[selectedFlowKey] || FLOW_METAS.video_extraction;
  const currentModelInfo = (settingsData?.models || []).find((m) => m.id === currentFlow.model_id);

  // Update handlers
  const handleModelChange = (modelId: string) => {
    setFlowState((prev) => ({
      ...prev,
      [selectedFlowKey]: {
        ...prev[selectedFlowKey],
        model_id: modelId,
      },
    }));
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

    if (preset === 'all-flash') {
      FLOW_ORDER.forEach((key) => {
        updated[key] = {
          ...updated[key],
          model_id: 'gemini-3.7-flash',
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
      updated.video_extraction = { ...updated.video_extraction, model_id: 'gemini-3.7-flash' };
      updated.checklist_mapping = { ...updated.checklist_mapping, model_id: 'claude-3.7-sonnet' };
      updated.thematic_analysis = { ...updated.thematic_analysis, model_id: 'claude-3.7-sonnet' };
      updated.interview_generator = { ...updated.interview_generator, model_id: 'claude-3.7-sonnet' };
      updated.codebook_generation = { ...updated.codebook_generation, model_id: 'gemini-3.7-flash' };
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
        model_id: flowState[k]?.model_id || 'gemini-3.7-flash',
        api_key_id: flowState[k]?.api_key_id,
        temperature: flowState[k]?.temperature ?? 0.2,
        fallback_model_id: flowState[k]?.fallback_model_id,
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
        diff: payload.map((p) => ({
          field: p.flow_key,
          label: (FLOW_METAS[p.flow_key] ? (language === 'vi' ? FLOW_METAS[p.flow_key].titleVi : FLOW_METAS[p.flow_key].titleEn) : p.flow_key),
          after: `${p.model_id} (temp: ${p.temperature})`,
        })),
      });

      toast.success(t('aiStudioSavedSuccess'));
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Test Ping
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
      const modelId = currentFlow.model_id;

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
    setNewKeyIsDefault(false);
    setIsKeyModalOpen(true);
  };

  const openEditKey = (k: APIKeyItem) => {
    setEditingKeyId(k.id);
    setNewKeyProvider(k.provider);
    setNewKeyLabel(k.label);
    setNewKeySecret(''); // ZERO EXPOSURE: never display or load existing secret
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
      if (editingKeyId) {
        await api.updateAPIKey(editingKeyId, {
          label: newKeyLabel.trim(),
          key_secret: newKeySecret.trim() ? newKeySecret.trim() : undefined,
          is_default: newKeyIsDefault,
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
        await api.createAPIKey(newKeyProvider, newKeyLabel.trim(), newKeySecret.trim(), newKeyIsDefault);
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
    setModelFormId(m.id);
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
    if (!editingModelId && !modelFormId.trim()) {
      toast.error('Model ID / API Identifier is required');
      return;
    }

    try {
      setSavingModel(true);
      if (editingModelId) {
        await api.updateAIModel(editingModelId, {
          display_name: modelFormDisplayName.trim(),
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
          summary: `Cập nhật thông số kỹ thuật mô hình "${modelFormDisplayName.trim()}" trong danh mục.`,
          summary_en: `Updated specifications for model "${modelFormDisplayName.trim()}" in catalog.`,
          status: 'success',
        });
        toast.success(t('aiStudioModelSaved'));
      } else {
        await api.createAIModel({
          id: modelFormId.trim(),
          provider: modelFormProvider,
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
          target_id: modelFormId.trim(),
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
      case 'thematic_analysis':
        return <Network size={20} />;
      case 'interview_generator':
        return <MessageSquare size={20} />;
      case 'codebook_generation':
        return <BookMarked size={20} />;
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
      case 'thematic_analysis':
        return 'icon-themes';
      case 'interview_generator':
        return 'icon-questions';
      case 'codebook_generation':
        return 'icon-codebook';
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
              : t('tabAdminCenter')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            {activeAdminTab === 'activity_log'
              ? (language === 'vi' ? 'Theo dõi biến động cấu hình hệ thống AI Studio và dấu vết can thiệp phân tích sư phạm' : 'Audit trail tracking both AI Studio configuration adjustments and pedagogical research operations')
              : t('aiStudioSubtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
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
          {activeAdminTab === 'admin_center' && (
            <button
              onClick={handleSaveAll}
              disabled={saving || loading}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '13px', fontWeight: 600, padding: '9px 18px', borderRadius: '8px' }}
            >
              {saving ? <RefreshCw size={15} className="animate-spin" /> : <Save size={15} />}
              <span>{saving ? t('commonSaving') : t('aiStudioSaveAll')}</span>
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
          onClick={() => setActiveAdminTab('admin_center')}
          style={{
            padding: '10px 18px',
            fontSize: '13.5px',
            fontWeight: 600,
            color: activeAdminTab === 'admin_center' ? 'var(--accent)' : 'var(--text-muted)',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeAdminTab === 'admin_center' ? '2px solid var(--accent)' : '2px solid transparent',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all 0.15s ease',
          }}
        >
          <Sliders size={16} />
          <span>{t('tabAdminCenter')}</span>
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

      {/* Tab 2: Activity Log */}
      {activeAdminTab === 'activity_log' && (
        <ActivityLogView onNavigateTab={(tab) => setActiveAdminTab(tab as any)} />
      )}

      {/* Tab 1: Admin Center Content */}
      {activeAdminTab === 'admin_center' && (
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
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: k.provider === 'gemini' ? '#15803D' : '#7E22CE' }} />
              <span>{k.label}</span>
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
            </div>
          </div>

          {/* Flow Nodes in Sequence */}
          {FLOW_ORDER.map((flowKey, idx) => {
            const meta = FLOW_METAS[flowKey];
            const cfg = flowState[flowKey] || { model_id: 'gemini-3.7-flash', temperature: 0.2 };
            const isSelected = selectedFlowKey === flowKey;

            return (
              <React.Fragment key={flowKey}>
                <div
                  onClick={() => setSelectedFlowKey(flowKey)}
                  style={{
                    backgroundColor: isSelected ? 'var(--card-bg)' : 'var(--bg)',
                    border: isSelected ? '2px solid var(--accent)' : '1.5px solid var(--card-border)',
                    borderRadius: '10px',
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    boxShadow: isSelected ? '0 0 0 3px rgba(146, 64, 14, 0.12)' : 'none',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      className={`node-icon-box ${getNodeIconBoxClass(flowKey)}`}
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {getNodeIcon(flowKey)}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                        {language === 'vi' ? meta.stepVi : meta.stepEn}
                      </span>
                      <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {language === 'vi' ? meta.titleVi : meta.titleEn}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{cfg.model_id}</span>
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

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <span className={`pill ${meta.badgeClass}`} style={{ fontSize: '11px', fontWeight: 600, padding: '3px 8px', borderRadius: '12px' }}>
                      {language === 'vi' ? meta.badgeVi : meta.badgeEn}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                      Temp: {cfg.temperature.toFixed(2)}
                    </span>
                  </div>
                </div>

                {idx < FLOW_ORDER.length - 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '14px', color: '#B5AFA6' }}>
                    <ArrowDown size={15} />
                  </div>
                )}
              </React.Fragment>
            );
          })}
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
        }}>
          <div style={{ paddingBottom: '14px', borderBottom: '1px solid var(--card-border)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
              {t('aiStudioNodeInspector')}
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
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
              value={currentFlow.model_id}
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
              {(settingsData?.models || [])
                .filter((m) => !currentMeta.requireMultimodal || m.supports_multimodal)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
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
                  placeholder="e.g. Gemini Paid Backup Account"
                  required
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Secret API Key String
                  </label>
                  {editingKeyId && (
                    <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: 600 }}>
                      (Optional Overwrite)
                    </span>
                  )}
                </div>
                <input
                  type="password"
                  value={newKeySecret}
                  onChange={(e) => setNewKeySecret(e.target.value)}
                  placeholder={editingKeyId ? '•••••••••••••••• (Leave blank to keep existing secret)' : 'AIzaSy... or sk-or-...'}
                  required={!editingKeyId}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '6px', border: '1.5px solid var(--card-border)', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {editingKeyId
                    ? (language === 'vi' ? 'Khóa hiện tại được bảo mật và không hiển thị. Chỉ nhập chuỗi mới nếu bạn muốn thay đổi.' : 'Current key is kept securely secret. Enter a new string only if you want to overwrite it.')
                    : 'Secret token used to authenticate against AI provider endpoints.'}
                </span>
              </div>

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
                            backgroundColor: m.provider === 'gemini' ? '#DCFCE7' : '#F3E8FF',
                            color: m.provider === 'gemini' ? '#15803D' : '#7E22CE',
                          }}>
                            {m.provider}
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
                            ID: {m.id}
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
                      disabled={!!editingModelId}
                      placeholder={modelFormProvider === 'openrouter' ? 'e.g. meta-llama/llama-3.3-70b-instruct' : 'e.g. gemini-2.0-flash-exp'}
                      required
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '6px',
                        border: '1.5px solid var(--card-border)',
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        backgroundColor: editingModelId ? 'rgba(0,0,0,0.03)' : 'var(--bg)',
                      }}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Exact API string identifier used when sending prompt requests.
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
