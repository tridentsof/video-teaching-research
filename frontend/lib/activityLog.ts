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

const INITIAL_LOGS: ActivityLogItem[] = [];

export const activityLogService = {
  getLogs(): ActivityLogItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return [];
      }
      const parsed = JSON.parse(raw);
      // Cleanse any legacy mock items starting with 'act_0'
      const clean = (Array.isArray(parsed) ? parsed : []).filter(
        (item: ActivityLogItem) => item && item.id && !item.id.startsWith('act_0')
      );
      return clean;
    } catch {
      return [];
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
