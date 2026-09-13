import { api } from './api';

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

function parseBackendLog(raw: any): ActivityLogItem {
  let diffParsed: ActivityDiffItem[] | undefined = undefined;
  if (raw.diff) {
    if (typeof raw.diff === 'string') {
      try {
        diffParsed = JSON.parse(raw.diff);
      } catch {
        diffParsed = undefined;
      }
    } else if (Array.isArray(raw.diff)) {
      diffParsed = raw.diff;
    }
  }

  let metadataParsed: Record<string, any> | undefined = undefined;
  if (raw.metadata) {
    if (typeof raw.metadata === 'string') {
      try {
        metadataParsed = JSON.parse(raw.metadata);
      } catch {
        metadataParsed = undefined;
      }
    } else if (typeof raw.metadata === 'object') {
      metadataParsed = raw.metadata;
    }
  }

  return {
    id: raw.id,
    created_at: raw.created_at,
    category: (raw.category || 'business') as LogCategory,
    module: (raw.module || 'video_pipeline') as LogModule,
    action: raw.action || '',
    target_id: raw.target_id || undefined,
    target_title: raw.target_title || undefined,
    actor: {
      username: raw.actor_username || raw.actor?.username || 'system',
      role: raw.actor_role || raw.actor?.role || 'researcher',
      client_ip: raw.client_ip || raw.actor?.client_ip || undefined,
    },
    summary: raw.summary || '',
    summary_en: raw.summary_en || undefined,
    status: (raw.status || 'success') as LogStatus,
    diff: diffParsed,
    metadata: metadataParsed,
  };
}

export const activityLogService = {
  // Synchronous cache read for instant rendering
  getLogs(): ActivityLogItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return (Array.isArray(parsed) ? parsed : []).filter(
        (item: ActivityLogItem) => item && item.id && !item.id.startsWith('act_0')
      );
    } catch {
      return [];
    }
  },

  // Live fetch from shared PostgreSQL database via backend API
  async fetchLogs(category?: string, module?: string): Promise<ActivityLogItem[]> {
    try {
      const res = await api.getActivityLogs({ category, module, limit: 200 });
      if (res && Array.isArray(res.logs)) {
        const items = res.logs.map(parseBackendLog);
        if (typeof window !== 'undefined' && (!category || category === 'all')) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
          } catch {}
        }
        return items;
      }
    } catch (err) {
      console.warn('Failed to fetch activity logs from backend, falling back to local storage', err);
    }
    return this.getLogs();
  },

  // Saves log to shared PostgreSQL database and local cache
  async addLog(entry: Omit<ActivityLogItem, 'id' | 'created_at'>): Promise<ActivityLogItem> {
    const newLog: ActivityLogItem = {
      ...entry,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };

    // Optimistic local cache update
    const current = this.getLogs();
    const updated = [newLog, ...current];
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to persist activity log to cache', e);
      }
    }

    // Persist to shared database via API
    try {
      await api.createActivityLog({
        category: entry.category,
        module: entry.module,
        action: entry.action,
        target_id: entry.target_id,
        target_title: entry.target_title,
        summary: entry.summary,
        status: entry.status,
        diff: entry.diff,
        metadata: entry.metadata,
      });
    } catch (err) {
      console.warn('Failed to push activity log to backend DB:', err);
    }

    return newLog;
  },

  clearLogs(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    }
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
      l.actor?.username || '',
      l.actor?.role || '',
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
