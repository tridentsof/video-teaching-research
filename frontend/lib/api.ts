export interface Video {
  id: string;
  teacher_id: string;
  title: string;
  blob_url?: string;
  duration_sec?: number;
  status: string;
  uploaded_at: string;
}

export interface RawEvent {
  id: string;
  video_id: string;
  teacher_id: string;
  timestamp_sec: number;
  event_type: 'visual' | 'audio' | 'context';
  event_key: string;
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
  confidence: number;
  duration_sec: number;
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
  status: string;
  started_at?: string;
  finished_at?: string;
  error_msg?: string;
}

export interface PipelineStatusSummary {
  video_id: string;
  current_status: string;
  jobs: PipelineJob[];
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
  question_text: string;
  evidence_ref?: string;
  sort_order: number;
}

export interface TeacherAnalysis {
  id: string;
  teacher_id: string;
  theme_ids: string[];
  context_summary?: string;
  markdown_content?: string;
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

  async triggerPipeline(videoId: string, checklistId?: string, enableChunking: boolean = true): Promise<{ message: string; enable_chunking?: boolean }> {
    return request(`/videos/${videoId}/process`, {
      method: 'POST',
      body: JSON.stringify({
        checklist_id: checklistId,
        enable_chunking: enableChunking,
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

  getReportDownloadUrl(videoId: string): string {
    return `${API_BASE}/reports/video/${videoId}/export.md`;
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

  async getLatestAnalysisRun(): Promise<{ id: string; status: string; triggered_at: string; completed_at?: string } | null> {
    try {
      const data = await request<{ run: { id: string; status: string; triggered_at: string; completed_at?: string } | null }>('/analysis/latest');
      return data.run || null;
    } catch {
      return null;
    }
  },

  async getTeacherAnalysis(runId: string, teacherId: string): Promise<{ run_id?: string; teacher_analysis: TeacherAnalysis; interview_questions: InterviewQuestion[] }> {
    return request(`/analysis/${runId}/teachers/${teacherId}`);
  },

  getInterviewDownloadUrl(runId: string, teacherId: string): string {
    return `${API_BASE}/analysis/${runId}/teachers/${teacherId}/interview.md`;
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
