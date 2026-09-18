export interface Video {
  id: string;
  teacher_id: string;
  title: string;
  blob_url?: string;
  duration_sec?: number;
  file_size?: number;
  status: string;
  error_msg?: string;
  failed_step?: string;
  uploaded_at: string;
  updated_at?: string;
  processing_mode?: 'chunk' | 'full' | null;
  processing_time_sec?: number | null;
}

export interface RawEvent {
  id: string;
  video_id: string;
  teacher_id: string;
  timestamp_sec: number;
  event_type: 'visual' | 'audio' | 'context';
  event_key: string;
  code?: string;
  quote?: string;
  description: string;
  confidence?: number;
  duration_sec?: number;
  is_duplicate_of?: string;
}

export interface ChecklistItem {
  id: string;
  checklist_id: string;
  section: string;
  text: string;
  sort_order: number;
}

export interface Checklist {
  id: string;
  name: string;
  version: string;
  items?: ChecklistItem[];
}

export interface ReportItemOccurrence {
  timestamp_sec: number;
  timestamp_str?: string;
  confidence: number;
  duration_sec: number;
  code?: string;
  quote?: string;
  context?: string;
}

export interface ReportItem {
  id: string;
  checklist_item_id: string;
  checklist_section: string;
  checklist_text: string;
  count: number;
  avg_confidence?: number;
  avg_duration_sec?: number;
  occurrences: string;
}

export interface Report {
  id: string;
  video_id: string;
  teacher_id: string;
  checklist_id: string;
  checklist_version?: string;
  markdown_content: string;
  generated_at: string;
  items?: ReportItem[];
}

export interface PipelineJob {
  id: string;
  video_id: string;
  step: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'error' | 'cancelled' | 'skipped' | string;
  started_at?: string;
  finished_at?: string;
  error_msg?: string;
}

export interface PipelineStatusSummary {
  video_id: string;
  current_status: string;
  failed_step?: string;
  error_msg?: string;
  jobs: PipelineJob[];
}

export interface AnalysisRunItem {
  id: string;
  status: string;
  triggered_at: string;
  completed_at?: string;
  error_msg?: string;
  core_questions_status?: string;
  theme_count?: number;
  category_count?: number;
  pattern_count?: number;
}

export interface Theme {
  id: string;
  analysis_run_id: string;
  name: string;
  description?: string;
  reasoning_trace?: string;
  category_ids: string[];
  status: 'draft' | 'confirmed';
}

export interface InterviewQuestion {
  id: string;
  teacher_id: string;
  type: 'core' | 'dynamic';
  rq_category?: 'RQ1' | 'RQ2' | 'RQ3' | 'BACKGROUND' | 'CLOSING' | string;
  question_text: string;
  evidence_ref?: string;
  context_notes?: string;
  is_user_edited?: boolean;
  sort_order: number;
}

export interface InterviewBaseQuestion {
  id: string;
  section: string;
  section_title: string;
  question_index: number;
  question_text: string;
  rq_category: 'BACKGROUND' | 'RQ1' | 'RQ2' | 'RQ3' | 'CLOSING' | string;
  is_active: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface CoreQuestionItem {
  index: number;
  question_text: string;
  rq_category: 'RQ1' | 'RQ2' | 'RQ3' | string;
  rationale?: string;
}

export interface TeacherAnalysis {
  id: string;
  teacher_id: string;
  theme_ids: string[];
  context_summary?: string;
  markdown_content?: string;
}

export interface LessonTrendPoint {
  lesson: string;
  video_id: string;
  teacher_id: string;
  scaffolding: number;
  waitTime: number;
  praise: number;
  agency: number;
}

export interface TeacherQuadrantPoint {
  id: string;
  label: string;
  agency: number;
  scaffolding: number;
  total_events: number;
}

export interface RadarDimensionPoint {
  key: string;
  label: string;
  score: number;
  count: number;
}

export interface TemporalBinPoint {
  bin: string;
  warmup: number;
  scaffolding: number;
  studentTurns: number;
  praise: number;
}

export interface OutlierEvidencePoint {
  teacher_id: string;
  lesson: string;
  timestamp_str: string;
  quote: string;
  context: string;
}

export interface PedagogicalAnalyticsData {
  total_events: number;
  total_videos: number;
  total_hours: number;
  avg_wait_time: number;
  scaffolding_ratio: number;
  ai_confidence: number;
  lessons: LessonTrendPoint[];
  teachers: TeacherQuadrantPoint[];
  radar: RadarDimensionPoint[];
  temporal_stream: TemporalBinPoint[];
  outlier_evidence: OutlierEvidencePoint;
}

export interface QualitativeEvidenceItem {
  video_id: string;
  teacher_id: string;
  lesson: string;
  timestamp_sec: number;
  timestamp_str: string;
  quote: string;
  context: string;
  confidence: number;
}

export interface CoverageMatrixCell {
  key: string;
  present: boolean;
  count: number;
}

export interface CoverageMatrixRow {
  pattern_id: string;
  code: string;
  description: string;
  category: string;
  theme: string;
  lesson_cells: CoverageMatrixCell[];
  teacher_cells: CoverageMatrixCell[];
  breadth_lessons: number;
  total_lessons: number;
  breadth_teachers: number;
  total_teachers: number;
  evidence: QualitativeEvidenceItem[];
}

export interface ThematicCode {
  id: string;
  code: string;
  name: string;
  evidence_count: number;
  sample_quotes: QualitativeEvidenceItem[];
}

export interface ThematicCategory {
  id: string;
  name: string;
  name_vi?: string;
  description: string;
  description_vi?: string;
  codes: ThematicCode[];
}

export interface ThematicTheme {
  id: string;
  name: string;
  name_vi?: string;
  description: string;
  description_vi?: string;
  reasoning_trace: string;
  reasoning_trace_vi?: string;
  status: string;
  categories: ThematicCategory[];
}

export interface RQ1EnactmentRow {
  dimension?: string;
  dimension_vi?: string;
  recurring_pattern?: string;
  recurring_pattern_vi?: string;
  observed_enactment?: string;
  observed_enactment_vi?: string;
  strategy_name?: string;
  strategy_name_vi?: string;
  strategy_subtext?: string;
  strategy_subtext_vi?: string;
  observed_enactments?: string[];
  observed_enactments_vi?: string[];
  representative_lessons: string[];
  representative_teachers: string[];
  timestamp_context?: string;
  direct_quotes: QualitativeEvidenceItem[];
}

export interface QualitativeAnalyticsData {
  analysis_run_id: string;
  run_status: string;
  triggered_at: string;
  total_lessons: number;
  total_teachers: number;
  lessons_list: string[];
  teachers_list: string[];
  coverage_matrix: CoverageMatrixRow[];
  thematic_hierarchy: ThematicTheme[];
  rq1_enactment_map: RQ1EnactmentRow[];
}


export interface User {
  id: string;
  username: string;
  created_at: string;
}

export interface AuthResponse {
  token: string;
  expires_at: string;
  user: User;
}

export interface CodebookEntry {
  id?: string;
  video_id?: string;
  code: string;
  definition: string;
  inclusion_criteria: string;
  exclusion_criteria: string;
  example: string;
  category: string;
  theme: string;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface APIKeyMetadata {
  project_id?: string;
  region?: string;
  gcs_bucket?: string;
}

export interface APIKeyItem {
  id: string;
  provider: string;
  label: string;
  masked_key: string;
  metadata?: APIKeyMetadata;
  is_default: boolean;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AIModelItem {
  id: string;
  provider: string;
  model_id: string;
  display_name: string;
  context_tokens: number;
  supports_multimodal: boolean;
  supports_reasoning: boolean;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface FlowConfigItem {
  flow_key: string;
  model_catalog_id: string;
  model_info?: AIModelItem;
  api_key_id?: string;
  api_key_info?: APIKeyItem;
  temperature: number;
  fallback_model_catalog_id?: string;
  fallback_model_info?: AIModelItem;
  updated_at: string;
}

export interface AIFlowsSettingsData {
  flows: FlowConfigItem[];
  models: AIModelItem[];
  api_keys: APIKeyItem[];
}

export interface TestPingResult {
  success: boolean;
  latency_ms: number;
  message: string;
}

// Post-Interview Qualitative Analysis Types
export interface MeaningUnitItem {
  id: string;
  response_id: string;
  teacher_id: string;
  unit_text: string;
  unit_index: number;
  initial_code?: string;
  category?: string;
  is_ai_generated: boolean;
  is_user_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface InterviewResponseItem {
  id: string;
  analysis_run_id: string;
  teacher_id: string;
  question_id?: string;
  question_text: string;
  audio_blob_path?: string;
  audio_filename?: string;
  audio_duration_sec: number;
  language: string;
  raw_transcript?: string;
  transcript_status: 'draft' | 'uploading' | 'transcribing' | 'transcribed' | 'reviewed' | 'finalized' | 'failed';
  response_text: string;
  recorded_at?: string;
  created_at: string;
  updated_at: string;
  meaning_units?: MeaningUnitItem[];
}

export interface InterviewCodeItem {
  id: string;
  analysis_run_id: string;
  code_name: string;
  category: string;
  frequency: number;
  teacher_ids: string[];
  created_at: string;
}

export interface TriangulationEntryItem {
  id: string;
  analysis_run_id: string;
  observation_finding: string;
  interview_evidence: string;
  teacher_ref?: string;
  relationship: 'confirms' | 'explains' | 'contradicts' | 'adds_info';
  theme_id?: string;
  is_ai_generated: boolean;
  is_user_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface RepresentativeQuoteItem {
  id: string;
  analysis_run_id: string;
  teacher_id: string;
  quote_text: string;
  quote_source?: string;
  theme_id?: string;
  rq_category: 'RQ1' | 'RQ2' | 'RQ3';
  relevance_type: 'explains_observation' | 'representative' | 'notable_difference' | 'answers_rq';
  is_selected: boolean;
  created_at: string;
}

export interface TeacherComparisonData {
  teacher_id: string;
  responses: InterviewResponseItem[];
  meaning_units: MeaningUnitItem[];
  triangulation: TriangulationEntryItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';


function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('vtr_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    // Purge invalid/expired credentials immediately to break infinite redirect loops
    localStorage.removeItem('vtr_token');
    localStorage.removeItem('vtr_user');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || `Request failed with status ${res.status}`);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Videos
  async getVideos(): Promise<Video[]> {
    const data = await request<{ videos: Video[] }>('/videos');
    return data.videos || [];
  },

  async getVideo(id: string): Promise<Video> {
    return request<Video>(`/videos/${id}`);
  },

  async updateVideo(id: string, data: { teacher_id: string; title?: string }): Promise<Video> {
    return request<Video>(`/videos/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async deleteVideo(id: string): Promise<void> {
    return request(`/videos/${id}`, {
      method: 'DELETE',
    });
  },

  async bulkDeleteVideos(videoIds: string[]): Promise<{ deleted: string[]; failed: Array<{ id: string; error: string }>; total: number }> {
    return request('/videos/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ video_ids: videoIds }),
    });
  },

  async resetPipeline(videoId: string): Promise<{ message: string; video_id: string; status: string }> {
    return request(`/videos/${videoId}/pipeline`, {
      method: 'DELETE',
    });
  },

  async deleteVideoEvents(videoId: string): Promise<{ message: string; video_id: string; status: string }> {
    return request(`/videos/${videoId}/events`, {
      method: 'DELETE',
    });
  },


  async uploadVideo(teacherId: string, title: string, file: File, durationSec?: number): Promise<Video> {
    const formData = new FormData();
    formData.append('teacher_id', teacherId);
    formData.append('title', title);
    formData.append('file', file);
    if (durationSec && durationSec > 0) {
      formData.append('duration_sec', String(durationSec));
    }

    const headers = await getAuthHeader();
    const res = await fetch(`${API_BASE}/videos/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Upload failed');
    }
    return res.json();
  },

  async triggerPipeline(
    videoId: string,
    checklistId?: string,
    enableChunking: boolean = true,
    mode: 'resume' | 'restart' = 'resume'
  ): Promise<{ message: string; enable_chunking?: boolean; mode?: string }> {
    return request(`/videos/${videoId}/process`, {
      method: 'POST',
      body: JSON.stringify({
        checklist_id: checklistId,
        enable_chunking: enableChunking,
        mode,
      }),
    });
  },

  async cancelPipeline(videoId: string): Promise<{ message: string; video_id: string; status: string }> {
    return request(`/videos/${videoId}/cancel`, {
      method: 'POST',
    });
  },

  async getPipelineStatus(videoId: string): Promise<PipelineStatusSummary> {
    return request<PipelineStatusSummary>(`/videos/${videoId}/pipeline`);
  },

  async getVideoEvents(videoId: string, includeDuplicates = false): Promise<RawEvent[]> {
    const data = await request<{ events: RawEvent[] }>(`/videos/${videoId}/events?include_duplicates=${includeDuplicates}`);
    return data.events || [];
  },

  // Checklists
  async getChecklists(): Promise<Checklist[]> {
    const data = await request<{ checklists: Checklist[] }>('/checklists');
    return data.checklists || [];
  },

  async getChecklist(id: string): Promise<Checklist> {
    return request<Checklist>(`/checklists/${id}`);
  },

  async updateChecklistItems(id: string, items: Array<{ section: string; text: string; sort_order: number }>): Promise<Checklist> {
    return request<Checklist>(`/checklists/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
  },

  // Reports
  async getReport(videoId: string): Promise<Report> {
    return request<Report>(`/reports/video/${videoId}`);
  },

  async deleteReport(videoId: string): Promise<void> {
    return request<void>(`/reports/video/${videoId}`, {
      method: 'DELETE',
    });
  },

  getReportDownloadUrl(videoId: string): string {
    return `${API_BASE}/reports/video/${videoId}/export.md`;
  },


  // Codebook
  async getCodebook(videoId: string): Promise<CodebookEntry[]> {
    const data = await request<{ entries: CodebookEntry[] }>(`/codebook/video/${videoId}`);
    return data.entries || [];
  },

  async saveCodebook(videoId: string, entries: CodebookEntry[]): Promise<CodebookEntry[]> {
    const data = await request<{ entries: CodebookEntry[] }>(`/codebook/video/${videoId}`, {
      method: 'PUT',
      body: JSON.stringify({ entries }),
    });
    return data.entries || [];
  },

  async deleteCodebook(videoId: string): Promise<void> {
    return request<void>(`/codebook/video/${videoId}`, {
      method: 'DELETE',
    });
  },


  async generateCodebook(videoId: string): Promise<CodebookEntry[]> {
    const data = await request<{ entries: CodebookEntry[] }>(`/codebook/video/${videoId}/generate`, {
      method: 'POST',
    });
    return data.entries || [];
  },

  getCodebookExportUrl(): string {
    return `${API_BASE}/codebook/export.xlsx`;
  },

  // Phase 6 Analysis
  async runAnalysis(): Promise<{ id: string; status: string }> {
    return request('/analysis/run', { method: 'POST' });
  },

  async getThemes(runId: string): Promise<Theme[]> {
    const data = await request<{ themes: Theme[] }>(`/analysis/${runId}/themes`);
    return data.themes || [];
  },

  async updateTheme(themeId: string, name: string, description: string, status: string): Promise<void> {
    return request(`/analysis/themes/${themeId}`, {
      method: 'PUT',
      body: JSON.stringify({ name, description, status }),
    });
  },

  async mergeThemes(targetThemeId: string, sourceThemeId: string): Promise<void> {
    return request('/analysis/themes/merge', {
      method: 'POST',
      body: JSON.stringify({ target_theme_id: targetThemeId, source_theme_id: sourceThemeId }),
    });
  },

  async confirmTheme(themeId: string): Promise<void> {
    return request(`/analysis/themes/${themeId}/confirm`, { method: 'PUT' });
  },

  async getLatestAnalysisRun(): Promise<AnalysisRunItem | null> {
    try {
      const data = await request<{ run: AnalysisRunItem | null }>('/analysis/latest');
      return data.run || null;
    } catch {
      return null;
    }
  },

  async listAnalysisRuns(): Promise<AnalysisRunItem[]> {
    try {
      const data = await request<{ runs: AnalysisRunItem[] }>('/analysis/runs');
      return data.runs || [];
    } catch {
      return [];
    }
  },

  async deleteAnalysisRun(runId: string): Promise<void> {
    return request<void>(`/analysis/${runId}`, {
      method: 'DELETE',
    });
  },


  async getTeacherAnalysis(runId: string, teacherId: string): Promise<{ run_id?: string; teacher_analysis: TeacherAnalysis; interview_questions: InterviewQuestion[] }> {
    return request(`/analysis/${runId}/teachers/${teacherId}`);
  },

  getInterviewDownloadUrl(runId: string, teacherId: string): string {
    return `${API_BASE}/analysis/${runId}/teachers/${teacherId}/interview.md`;
  },

  // Base Questions Bank (22 Canonical questions CRUD)
  async getBaseInterviewQuestions(onlyActive: boolean = false): Promise<InterviewBaseQuestion[]> {
    const res = await request<{ questions: InterviewBaseQuestion[] }>(
      `/interview-base-questions${onlyActive ? '?only_active=true' : ''}`
    );
    return res.questions || [];
  },

  async createBaseInterviewQuestion(data: Partial<InterviewBaseQuestion>): Promise<InterviewBaseQuestion> {
    return request<InterviewBaseQuestion>('/interview-base-questions', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateBaseInterviewQuestion(id: string, data: Partial<InterviewBaseQuestion>): Promise<InterviewBaseQuestion> {
    return request<InterviewBaseQuestion>(`/interview-base-questions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteBaseInterviewQuestion(id: string): Promise<{ deleted: boolean }> {
    return request<{ deleted: boolean }>(`/interview-base-questions/${id}`, {
      method: 'DELETE',
    });
  },

  async resetBaseInterviewQuestions(): Promise<InterviewBaseQuestion[]> {
    const res = await request<{ questions: InterviewBaseQuestion[] }>('/interview-base-questions/reset', {
      method: 'POST',
    });
    return res.questions || [];
  },

  // Core Questions Flow A (Review & Approval Gate)
  async getCoreQuestions(runId: string): Promise<{ core_questions: CoreQuestionItem[]; status: 'draft' | 'approved' }> {
    return request<{ core_questions: CoreQuestionItem[]; status: 'draft' | 'approved' }>(
      `/analysis/${runId}/core-questions`
    );
  },

  async synthesizeCoreQuestions(runId: string): Promise<{ core_questions: CoreQuestionItem[]; status: 'draft' }> {
    return request<{ core_questions: CoreQuestionItem[]; status: 'draft' }>(
      `/analysis/${runId}/core-questions/synthesize`,
      { method: 'POST' }
    );
  },

  async approveCoreQuestions(runId: string, questions: CoreQuestionItem[]): Promise<{ status: 'approved'; message: string }> {
    return request<{ status: 'approved'; message: string }>(
      `/analysis/${runId}/core-questions/approve`,
      {
        method: 'POST',
        body: JSON.stringify({ questions }),
      }
    );
  },

  async unapproveCoreQuestions(runId: string): Promise<{ status: 'draft'; message: string }> {
    return request<{ status: 'draft'; message: string }>(
      `/analysis/${runId}/core-questions/unapprove`,
      { method: 'POST' }
    );
  },

  async updateInterviewQuestion(questionId: string, text: string, rqCategory?: string): Promise<{ updated: boolean }> {
    return request<{ updated: boolean }>(
      `/analysis/questions/${questionId}`,
      {
        method: 'PUT',
        body: JSON.stringify({ question_text: text, rq_category: rqCategory }),
      }
    );
  },

  // Auth
  async login(username: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Authentication failed');
    }
    const data: AuthResponse = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('vtr_token', data.token);
      localStorage.setItem('vtr_user', JSON.stringify(data.user));
    }
    return data;
  },

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Registration failed');
    }
    const data: AuthResponse = await res.json();
    if (typeof window !== 'undefined' && data.token) {
      localStorage.setItem('vtr_token', data.token);
      localStorage.setItem('vtr_user', JSON.stringify(data.user));
    }
    return data;
  },

  async getMe(): Promise<User | null> {
    try {
      const data = await request<{ user: User }>('/auth/me');
      return data.user || null;
    } catch {
      return null;
    }
  },

  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vtr_token');
      localStorage.removeItem('vtr_user');
      window.location.href = '/login';
    }
  },

  // AI Studio & Model Router Settings
  async getAIFlowsSettings(): Promise<AIFlowsSettingsData> {
    return request<AIFlowsSettingsData>('/settings/ai-flows');
  },

  async updateAIFlowsSettings(flows: Array<{ flow_key: string; model_catalog_id: string; api_key_id?: string; temperature: number; fallback_model_catalog_id?: string }>): Promise<AIFlowsSettingsData> {
    return request<AIFlowsSettingsData>('/settings/ai-flows', {
      method: 'PUT',
      body: JSON.stringify({ flows }),
    });
  },

  async getAPIKeys(): Promise<APIKeyItem[]> {
    const data = await request<{ api_keys: APIKeyItem[] }>('/settings/api-keys');
    return data.api_keys || [];
  },

  async createAPIKey(provider: string, label: string, key_secret: string, is_default = false, metadata?: APIKeyMetadata): Promise<APIKeyItem> {
    return request<APIKeyItem>('/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, label, key_secret, is_default, metadata }),
    });
  },

  async updateAPIKey(
    id: string,
    keyData: { label: string; key_secret?: string; is_default?: boolean; status?: string; metadata?: APIKeyMetadata }
  ): Promise<APIKeyItem> {
    return request<APIKeyItem>(`/settings/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(keyData),
    });
  },

  async deleteAPIKey(id: string): Promise<void> {
    return request(`/settings/api-keys/${id}`, {
      method: 'DELETE',
    });
  },

  async testAIPing(provider: string, model_id: string, api_key_id?: string, key_secret?: string): Promise<TestPingResult> {
    return request<TestPingResult>('/settings/test-ping', {
      method: 'POST',
      body: JSON.stringify({ provider, model_id, api_key_id, key_secret }),
    });
  },

  // AI Model Catalog CRUD
  async getAIModels(): Promise<AIModelItem[]> {
    const data = await request<{ models: AIModelItem[] }>('/settings/models');
    return data.models || [];
  },

  async createAIModel(modelData: {
    provider: string;
    model_id: string;
    display_name: string;
    context_tokens?: number;
    supports_multimodal?: boolean;
    supports_reasoning?: boolean;
    is_active?: boolean;
    sort_order?: number;
  }): Promise<AIModelItem> {
    return request<AIModelItem>('/settings/models', {
      method: 'POST',
      body: JSON.stringify(modelData),
    });
  },

  async updateAIModel(
    id: string,
    modelData: {
      display_name: string;
      model_id?: string;
      context_tokens?: number;
      supports_multimodal?: boolean;
      supports_reasoning?: boolean;
      is_active?: boolean;
      sort_order?: number;
    }
  ): Promise<AIModelItem> {
    return request<AIModelItem>(`/settings/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(modelData),
    });
  },

  async deleteAIModel(id: string): Promise<void> {
    return request(`/settings/models/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Activity Logs
  async getActivityLogs(params?: { category?: string; module?: string; limit?: number; offset?: number }): Promise<{ logs: any[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.module && params.module !== 'all') query.set('module', params.module);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    const qs = query.toString();
    return request<{ logs: any[]; total: number }>(`/activity-logs${qs ? `?${qs}` : ''}`);
  },

  async createActivityLog(logData: {
    category: string;
    module: string;
    action: string;
    target_id?: string;
    target_title?: string;
    summary: string;
    status?: string;
    diff?: any;
    metadata?: any;
  }): Promise<{ status: string }> {
    return request<{ status: string }>('/activity-logs', {
      method: 'POST',
      body: JSON.stringify(logData),
    });
  },

  // Telegram Settings & Test
  async getTelegramStatus(): Promise<{
    is_enabled: boolean;
    has_bot_token: boolean;
    has_webhook_url: boolean;
    has_static_chat_id: boolean;
    active_subscribers: number;
    bot_username: string;
  }> {
    return request('/settings/telegram/status');
  },

  async sendTelegramTest(message?: string): Promise<{ status: string; recipients: number; message: string }> {
    return request('/settings/telegram/test', {
      method: 'POST',
      body: JSON.stringify({ message: message || '' }),
    });
  },

  // Research Analytics
  async getPedagogicalAnalytics(): Promise<PedagogicalAnalyticsData> {
    return request<PedagogicalAnalyticsData>('/analytics/pedagogical');
  },

  async getQualitativeAnalytics(): Promise<QualitativeAnalyticsData> {
    return request<QualitativeAnalyticsData>('/analytics/qualitative');
  },

  // --- Post-Interview Analysis API ---

  async uploadInterviewAudio(teacherId: string, runId: string, file: File): Promise<InterviewResponseItem> {
    const formData = new FormData();
    formData.append('teacher_id', teacherId);
    formData.append('analysis_run_id', runId);
    formData.append('audio_file', file);

    const headers = getAuthHeader();
    const res = await fetch(`${API_BASE}/interview-analysis/upload-audio`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || 'Audio upload failed');
    }
    return res.json();
  },

  async transcribeInterviewAudio(responseId: string): Promise<InterviewResponseItem> {
    return request<InterviewResponseItem>(`/interview-analysis/responses/${responseId}/transcribe`, {
      method: 'POST',
    });
  },

  async finalizeInterviewResponse(responseId: string, responseText: string): Promise<InterviewResponseItem> {
    return request<InterviewResponseItem>(`/interview-analysis/responses/${responseId}/finalize`, {
      method: 'PUT',
      body: JSON.stringify({ response_text: responseText }),
    });
  },

  async createManualInterviewResponse(data: {
    analysis_run_id: string;
    teacher_id: string;
    question_text: string;
    response_text: string;
  }): Promise<InterviewResponseItem> {
    return request<InterviewResponseItem>('/interview-analysis/responses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getInterviewResponses(teacherId: string, runId?: string): Promise<InterviewResponseItem[]> {
    const query = runId ? `?run_id=${runId}` : '';
    const data = await request<{ responses: InterviewResponseItem[] }>(`/interview-analysis/responses/${teacherId}${query}`);
    return data.responses || [];
  },

  async deleteInterviewResponse(responseId: string): Promise<void> {
    return request<void>(`/interview-analysis/responses/${responseId}`, {
      method: 'DELETE',
    });
  },

  async segmentMeaningUnits(responseId: string): Promise<MeaningUnitItem[]> {
    const data = await request<{ meaning_units: MeaningUnitItem[] }>(`/interview-analysis/responses/${responseId}/segment`, {
      method: 'POST',
    });
    return data.meaning_units || [];
  },

  async getMeaningUnits(teacherId: string): Promise<MeaningUnitItem[]> {
    const data = await request<{ meaning_units: MeaningUnitItem[] }>(`/interview-analysis/meaning-units/${teacherId}`);
    return data.meaning_units || [];
  },

  async createMeaningUnit(data: {
    response_id: string;
    teacher_id: string;
    unit_text: string;
    unit_index?: number;
    initial_code?: string;
    category?: string;
  }): Promise<MeaningUnitItem> {
    return request<MeaningUnitItem>('/interview-analysis/meaning-units', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateMeaningUnit(id: string, data: {
    unit_text?: string;
    initial_code?: string;
    category?: string;
  }): Promise<MeaningUnitItem> {
    return request<MeaningUnitItem>(`/interview-analysis/meaning-units/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteMeaningUnit(id: string): Promise<void> {
    return request<void>(`/interview-analysis/meaning-units/${id}`, {
      method: 'DELETE',
    });
  },

  async generateInterviewCodes(teacherId: string, runId?: string): Promise<{
    meaning_units: MeaningUnitItem[];
    codes: InterviewCodeItem[];
  }> {
    return request<{
      meaning_units: MeaningUnitItem[];
      codes: InterviewCodeItem[];
    }>('/interview-analysis/codes/generate', {
      method: 'POST',
      body: JSON.stringify({ teacher_id: teacherId, analysis_run_id: runId }),
    });
  },

  async getInterviewCodes(runId?: string): Promise<InterviewCodeItem[]> {
    const query = runId ? `?run_id=${runId}` : '';
    const data = await request<{ codes: InterviewCodeItem[] }>(`/interview-analysis/codes${query}`);
    return data.codes || [];
  },

  async runInterviewTriangulation(runId: string): Promise<TriangulationEntryItem[]> {
    const data = await request<{ triangulation_entries: TriangulationEntryItem[] }>('/interview-analysis/triangulate', {
      method: 'POST',
      body: JSON.stringify({ analysis_run_id: runId }),
    });
    return data.triangulation_entries || [];
  },

  async getInterviewTriangulation(runId?: string): Promise<TriangulationEntryItem[]> {
    const query = runId ? `?run_id=${runId}` : '';
    const data = await request<{ triangulation_entries: TriangulationEntryItem[] }>(`/interview-analysis/triangulation${query}`);
    return data.triangulation_entries || [];
  },

  async updateInterviewTriangulation(id: string, data: {
    relationship?: string;
    observation_finding?: string;
    interview_evidence?: string;
  }): Promise<TriangulationEntryItem> {
    return request<TriangulationEntryItem>(`/interview-analysis/triangulation/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async getPerTeacherComparison(teacherId: string, runId?: string): Promise<TeacherComparisonData> {
    const query = runId ? `?run_id=${runId}` : '';
    return request<TeacherComparisonData>(`/interview-analysis/teacher-comparison/${teacherId}${query}`);
  },

  async selectRepresentativeQuotes(runId: string): Promise<RepresentativeQuoteItem[]> {
    const data = await request<{ quotes: RepresentativeQuoteItem[] }>('/interview-analysis/quotes/select', {
      method: 'POST',
      body: JSON.stringify({ analysis_run_id: runId }),
    });
    return data.quotes || [];
  },

  async getRepresentativeQuotes(runId?: string): Promise<RepresentativeQuoteItem[]> {
    const query = runId ? `?run_id=${runId}` : '';
    const data = await request<{ quotes: RepresentativeQuoteItem[] }>(`/interview-analysis/quotes${query}`);
    return data.quotes || [];
  },

  async toggleQuoteSelection(id: string, isSelected: boolean): Promise<void> {
    return request<void>(`/interview-analysis/quotes/${id}/toggle`, {
      method: 'PUT',
      body: JSON.stringify({ is_selected: isSelected }),
    });
  },


  getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('vtr_token');
  },

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('vtr_user');
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
};
