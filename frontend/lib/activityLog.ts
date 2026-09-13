export type LogCategory = 'business' | 'admin';

export type LogModule =
  | 'video_pipeline'
  | 'checklist'
  | 'thematic'
  | 'interview'
  | 'export_report'
  | 'ai_routing'
  | 'preset'
  | 'api_vault'
  | 'model_catalog'
  | 'admin_auth';

export type LogStatus = 'success' | 'failed' | 'warning';

export interface ActivityDiffItem {
  field: string;
  label?: string;
  before?: any;
  after?: any;
}

export interface ActivityLogItem {
  id: string;
  created_at: string;
  category: LogCategory;
  module: LogModule;
  action: string;
  target_id?: string;
  target_title?: string;
  actor: {
    username: string;
    role?: string;
    client_ip?: string;
  };
  summary: string;
  summary_en?: string;
  status: LogStatus;
  diff?: ActivityDiffItem[];
  metadata?: Record<string, any>;
}

const STORAGE_KEY = 'vtr_activity_logs';

const INITIAL_LOGS: ActivityLogItem[] = [
  {
    id: 'act_01_checklist',
    created_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    category: 'business',
    module: 'checklist',
    action: 'checklist.update_score',
    target_id: 'TIÊU_CHÍ_2.3',
    target_title: 'Khung Dạy Học Tích Cực • Câu hỏi mở kích thích tư duy',
    actor: {
      username: 'dr_minh',
      role: 'Researcher',
      client_ip: '192.168.1.18',
    },
    summary: 'Chỉnh sửa điểm đánh giá sư phạm và đính kèm mốc thời gian minh chứng trong video.',
    summary_en: 'Adjusted pedagogical rubric score and attached video timestamp evidence.',
    status: 'success',
    diff: [
      { field: 'score', label: 'Điểm đánh giá', before: 3, after: 4 },
      { field: 'verified_by_human', label: 'Xác thực chuyên gia', before: false, after: true },
      { field: 'evidence_timestamps', label: 'Mốc minh chứng', before: '[12:10-12:40]', after: '[12:10-12:40], [14:20-15:10]' },
    ],
    metadata: {
      video_id: 'VID_TOAN_LOP8_02',
      teacher: 'Nguyễn Thu Hà',
      step: '02_checklist_mapping',
    },
  },
  {
    id: 'act_02_routing',
    created_at: new Date(Date.now() - 24 * 60 * 1000).toISOString(),
    category: 'admin',
    module: 'ai_routing',
    action: 'ai_flow.update',
    target_id: 'video_extraction',
    target_title: 'Step 01 • Bóc Tách & Nhận Diện Video',
    actor: {
      username: 'admin_lan',
      role: 'Admin',
      client_ip: '192.168.1.45',
    },
    summary: 'Thay đổi model xử lý đa phương thức và nhiệt độ suy luận cho bước bóc tách video.',
    summary_en: 'Updated multimodal model and inference temperature for video extraction.',
    status: 'success',
    diff: [
      { field: 'model_id', label: 'Model xử lý chính', before: 'gemini-2.5-pro', after: 'gemini-3.7-flash' },
      { field: 'temperature', label: 'Độ biến thiên (Temperature)', before: 0.4, after: 0.2 },
      { field: 'fallback_model_id', label: 'Model dự phòng', before: 'gemini-2.5-flash', after: 'gemini-2.5-flash' },
    ],
    metadata: {
      flow_key: 'video_extraction',
      provider: 'gemini',
    },
  },
  {
    id: 'act_03_pipeline',
    created_at: new Date(Date.now() - 61 * 60 * 1000).toISOString(),
    category: 'business',
    module: 'video_pipeline',
    action: 'video.pipeline_run',
    target_id: 'VID_TOAN_LOP8_02',
    target_title: 'Tiết học: Định lý Pytago • GV Nguyễn Thu Hà (45 phút)',
    actor: {
      username: 'dr_minh',
      role: 'Researcher',
      client_ip: '192.168.1.18',
    },
    summary: 'Khởi chạy lại quy trình phân tích tự động 5 bước với bộ prompt chuẩn hóa v2.',
    summary_en: 'Triggered automated 5-step analysis pipeline with standardized prompt v2.',
    status: 'success',
    diff: [
      { field: 'status', label: 'Trạng thái', before: 'idle', after: 'completed' },
      { field: 'chunks_processed', label: 'Số chunks xử lý', before: 0, after: 5 },
      { field: 'events_extracted', label: 'Số hành vi nhận diện', before: 0, after: 38 },
    ],
    metadata: {
      duration_sec: 2700,
      total_time_ms: 42350,
      processing_mode: 'fast',
    },
  },
  {
    id: 'act_04_thematic',
    created_at: new Date(Date.now() - 96 * 60 * 1000).toISOString(),
    category: 'business',
    module: 'thematic',
    action: 'codebook.update_entry',
    target_id: 'CODE_SCAFFOLD_04',
    target_title: 'Sổ Mã • Dàn giáo nhận thức (Scaffolding Inquiry)',
    actor: {
      username: 'thao_nguyen',
      role: 'Pedagogy Coder',
      client_ip: '192.168.1.22',
    },
    summary: 'Mở rộng tiêu chí bao gồm (Inclusion Criteria) cho mã quan sát cử chỉ trợ giúp nhận thức.',
    summary_en: 'Expanded inclusion criteria for scaffolding gestures observation code.',
    status: 'success',
    diff: [
      {
        field: 'inclusion_criteria',
        label: 'Tiêu chuẩn thu nạp',
        before: 'Giáo viên đặt câu hỏi gợi ý khi học sinh lúng túng.',
        after: 'Bao gồm cử chỉ chỉ tay sơ đồ bảng kết hợp câu hỏi gợi ý khi học sinh dừng quá 5 giây.',
      },
    ],
    metadata: {
      category: 'Tương tác thầy - trò',
      theme: 'Chiến thuật dàn giáo sư phạm',
    },
  },
  {
    id: 'act_05_preset',
    created_at: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
    category: 'admin',
    module: 'preset',
    action: 'ai_flow.apply_preset',
    target_id: 'claude-research',
    target_title: 'Preset: Claude 3.7 Sonnet for Reasoning & Gemini for Video',
    actor: {
      username: 'admin_lan',
      role: 'Admin',
      client_ip: '192.168.1.45',
    },
    summary: 'Áp dụng bộ định tuyến mẫu: 3 bước suy luận qua Claude 3.7 Sonnet, bóc tách qua Gemini Flash.',
    summary_en: 'Applied preset routing: Reasoning steps via Claude 3.7 Sonnet, Extraction via Gemini Flash.',
    status: 'success',
    diff: [
      { field: 'checklist_mapping', label: 'Bước 02 Checklist', before: 'gemini-3.7-flash', after: 'claude-3.7-sonnet' },
      { field: 'thematic_analysis', label: 'Bước 03 Chủ Đề', before: 'gemini-3.7-flash', after: 'claude-3.7-sonnet' },
      { field: 'interview_generator', label: 'Bước 04 Phỏng Vấn', before: 'gemini-3.7-flash', after: 'claude-3.7-sonnet' },
    ],
    metadata: {
      preset_key: 'claude-research',
    },
  },
  {
    id: 'act_06_vault',
    created_at: new Date(Date.now() - 185 * 60 * 1000).toISOString(),
    category: 'admin',
    module: 'api_vault',
    action: 'api_key.create',
    target_id: 'key_openrouter_secondary',
    target_title: 'OpenRouter Secondary Key (sk-or-v1-••••4a8e)',
    actor: {
      username: 'admin_lan',
      role: 'Admin',
      client_ip: '192.168.1.45',
    },
    summary: 'Thêm khóa API dự phòng cho nhà cung cấp OpenRouter vào két an toàn.',
    summary_en: 'Registered secondary fallback API key for OpenRouter in secure vault.',
    status: 'success',
    diff: [
      { field: 'provider', label: 'Nhà cung cấp', before: null, after: 'openrouter' },
      { field: 'is_default', label: 'Khóa mặc định', before: null, after: false },
    ],
    metadata: {
      masked_key: 'sk-or-v1-••••••••4a8e',
      provider: 'openrouter',
    },
  },
  {
    id: 'act_07_export',
    created_at: new Date(Date.now() - 240 * 60 * 1000).toISOString(),
    category: 'business',
    module: 'export_report',
    action: 'report.export_docx',
    target_id: 'REP_PYTAGO_KY1',
    target_title: 'Báo Cáo Nghiên Cứu Định Tính Sư Phạm • Lớp 8A2',
    actor: {
      username: 'dr_minh',
      role: 'Researcher',
      client_ip: '192.168.1.18',
    },
    summary: 'Kết xuất hồ sơ quan sát giảng dạy định dạng Microsoft Word (.docx) kèm ma trận chỉ báo.',
    summary_en: 'Exported pedagogical observation dossier to Microsoft Word (.docx) with rubric matrix.',
    status: 'success',
    diff: [
      { field: 'export_format', label: 'Định dạng', before: null, after: 'docx' },
      { field: 'file_size_bytes', label: 'Kích thước', before: null, after: 428190 },
    ],
    metadata: {
      included_events: 38,
      included_themes: 4,
    },
  },
];

export const activityLogService = {
  getLogs(): ActivityLogItem[] {
    if (typeof window === 'undefined') return INITIAL_LOGS;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LOGS));
        return INITIAL_LOGS;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_LOGS;
    }
  },

  addLog(entry: Omit<ActivityLogItem, 'id' | 'created_at'>): ActivityLogItem {
    const current = this.getLogs();
    const newLog: ActivityLogItem = {
      ...entry,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    const updated = [newLog, ...current];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist activity log', e);
      }
    }
    return newLog;
  },

  clearLogs(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
  },

  resetToDefaults(): ActivityLogItem[] {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_LOGS));
    }
    return INITIAL_LOGS;
  },

  exportCSV(logs: ActivityLogItem[]): void {
    const headers = ['ID', 'Thời gian', 'Phân tầng', 'Phân hệ', 'Hành động', 'Thực thể', 'Tác tử', 'Vai trò', 'Trạng thái', 'Mô tả'];
    const rows = logs.map((l) => [
      l.id,
      l.created_at,
      l.category,
      l.module,
      l.action,
      l.target_id || '',
      l.actor.username,
      l.actor.role || '',
      l.status,
      `"${(l.summary || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `activity_log_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },

  exportJSON(logs: ActivityLogItem[]): void {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `activity_log_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};
