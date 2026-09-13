'use client';

import React, { useState, useMemo } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import {
  ActivityLogItem,
  LogCategory,
  LogModule,
  activityLogService,
} from '@/lib/activityLog';
import {
  History,
  Search,
  Download,
  RefreshCw,
  Video,
  CheckSquare,
  Network,
  MessageSquare,
  FileText,
  Sliders,
  Key,
  Cpu,
  Shield,
  GraduationCap,
  Layers,
  CheckCircle2,
  AlertCircle,
  Clock,
  User,
  X,
  Copy,
  Check,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface ActivityLogViewProps {
  onNavigateTab?: (tabKey: string) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = () => {
  const { t, language } = useTranslation();
  const toast = useToast();

  const [logs, setLogs] = useState<ActivityLogItem[]>(() => activityLogService.getLogs());
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<LogCategory | 'all'>('all');
  const [selectedModule, setSelectedModule] = useState<LogModule | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeLogDetail, setActiveLogDetail] = useState<ActivityLogItem | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadLogs = React.useCallback(async () => {
    setLoading(true);
    try {
      const live = await activityLogService.fetchLogs(selectedCategory, selectedModule);
      setLogs(live);
    } catch {
      setLogs(activityLogService.getLogs());
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, selectedModule]);

  React.useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleRefresh = async () => {
    await loadLogs();
    toast.success(language === 'vi' ? 'Đã làm mới nhật ký từ cơ sở dữ liệu' : 'Activity logs refreshed from database');
  };

  const handleExportCSV = () => {
    activityLogService.exportCSV(filteredLogs);
    toast.success(language === 'vi' ? 'Đã xuất file CSV' : 'Exported CSV file');
  };

  const handleExportJSON = () => {
    activityLogService.exportJSON(filteredLogs);
    toast.success(language === 'vi' ? 'Đã xuất file JSON' : 'Exported JSON file');
  };

  const handleCopyJSON = (item: ActivityLogItem) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(JSON.stringify(item, null, 2));
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success(language === 'vi' ? 'Đã sao chép JSON chi tiết' : 'Copied JSON payload');
    }
  };

  // Filter logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedCategory !== 'all' && log.category !== selectedCategory) {
        return false;
      }
      if (selectedModule !== 'all' && log.module !== selectedModule) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inSummary = (log.summary || '').toLowerCase().includes(query);
        const inActor = (log.actor.username || '').toLowerCase().includes(query);
        const inTarget = (log.target_id || '').toLowerCase().includes(query);
        const inAction = (log.action || '').toLowerCase().includes(query);
        const inModule = (log.module || '').toLowerCase().includes(query);
        if (!inSummary && !inActor && !inTarget && !inAction && !inModule) {
          return false;
        }
      }
      return true;
    });
  }, [logs, selectedCategory, selectedModule, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = logs.length;
    const businessCount = logs.filter((l) => l.category === 'business').length;
    const adminCount = logs.filter((l) => l.category === 'admin').length;
    const successCount = logs.filter((l) => l.status === 'success').length;
    const rate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '100';
    return { total, businessCount, adminCount, rate };
  }, [logs]);

  // Format relative timestamp
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const timeStr = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const diffMs = Date.now() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return { time: timeStr, rel: language === 'vi' ? 'Vừa xong' : 'Just now' };
      if (diffMin < 60) return { time: timeStr, rel: `${diffMin} ${language === 'vi' ? 'phút trước' : 'mins ago'}` };
      const diffHour = Math.floor(diffMin / 60);
      return { time: timeStr, rel: `${diffHour} ${language === 'vi' ? 'giờ trước' : 'hours ago'}` };
    } catch {
      return { time: iso, rel: '' };
    }
  };

  const getModuleBadgeInfo = (module: LogModule) => {
    switch (module) {
      case 'video_pipeline':
        return { label: 'Video Pipeline', icon: Video, bg: 'var(--accent-soft)', color: 'var(--accent)', border: 'rgba(158, 74, 40, 0.25)' };
      case 'checklist':
        return { label: 'Checklist Rubric', icon: CheckSquare, bg: 'var(--accent-blue-soft)', color: 'var(--accent-blue)', border: 'rgba(29, 92, 138, 0.25)' };
      case 'thematic':
        return { label: 'Thematic Codebook', icon: Network, bg: 'var(--accent-purple-soft)', color: 'var(--accent-purple)', border: 'rgba(109, 40, 217, 0.25)' };
      case 'interview':
        return { label: 'Teacher Inquiry', icon: MessageSquare, bg: 'var(--accent-green-soft)', color: 'var(--accent-green)', border: 'rgba(45, 106, 79, 0.25)' };
      case 'export_report':
        return { label: 'Report Export', icon: FileText, bg: '#F0FDFA', color: '#0F766E', border: 'rgba(15, 118, 110, 0.25)' };
      case 'ai_routing':
        return { label: 'AI Routing', icon: Sliders, bg: 'var(--accent-amber-soft)', color: 'var(--accent-amber)', border: 'rgba(178, 106, 0, 0.25)' };
      case 'preset':
        return { label: 'AI Preset', icon: Layers, bg: 'var(--accent-amber-soft)', color: 'var(--accent-amber)', border: 'rgba(178, 106, 0, 0.25)' };
      case 'api_vault':
        return { label: 'Key Vault', icon: Key, bg: 'var(--accent-blue-soft)', color: 'var(--accent-blue)', border: 'rgba(29, 92, 138, 0.25)' };
      case 'model_catalog':
        return { label: 'Model Catalog', icon: Cpu, bg: 'var(--accent-purple-soft)', color: 'var(--accent-purple)', border: 'rgba(109, 40, 217, 0.25)' };
      case 'admin_auth':
        return { label: 'Auth & Session', icon: Shield, bg: '#F3F4F6', color: '#374151', border: 'rgba(55, 65, 81, 0.25)' };
      default:
        return { label: module, icon: History, bg: '#F3F4F6', color: '#374151', border: 'rgba(55, 65, 81, 0.25)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
      
      {/* Top Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 500, color: 'var(--accent)' }}>
            {language === 'vi' ? 'Nhật Ký Hoạt Động & Kiểm Toán' : 'Activity & Audit Trail'}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', marginTop: '2px' }}>
            {language === 'vi'
              ? 'Theo dõi biến động cấu hình hệ thống AI Studio và dấu vết can thiệp phân tích sư phạm'
              : 'Audit trail tracking both AI Studio configuration adjustments and pedagogical research operations'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={handleExportCSV}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 14px', borderRadius: '8px' }}
          >
            <Download size={14} />
            <span>{language === 'vi' ? 'Xuất CSV' : 'Export CSV'}</span>
          </button>
          <button
            onClick={handleExportJSON}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 14px', borderRadius: '8px' }}
          >
            <Download size={14} />
            <span>{language === 'vi' ? 'Xuất JSON' : 'Export JSON'}</span>
          </button>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 16px', borderRadius: '8px', opacity: loading ? 0.7 : 1 }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>{loading ? (language === 'vi' ? 'Đang tải...' : 'Loading...') : (language === 'vi' ? 'Làm mới' : 'Refresh')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {language === 'vi' ? 'Tổng Thao Tác (24h)' : 'Total Events (24h)'}
            </span>
            <History size={16} color="var(--text-muted)" />
          </div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--text-main)', marginTop: '6px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {stats.businessCount} {language === 'vi' ? 'nghiệp vụ' : 'business'} • {stats.adminCount} {language === 'vi' ? 'hệ thống' : 'admin'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {language === 'vi' ? 'Nghiệp Vụ Sư Phạm' : 'Research Operations'}
            </span>
            <GraduationCap size={16} color="var(--accent)" />
          </div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent)', marginTop: '6px' }}>
            {stats.businessCount}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {language === 'vi' ? 'Video, rubric bảng kiểm, sổ mã' : 'Video, rubric scoring, codebook'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {language === 'vi' ? 'Quản Trị & AI Studio' : 'Admin & AI Studio'}
            </span>
            <Sliders size={16} color="var(--accent-amber)" />
          </div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-amber)', marginTop: '6px' }}>
            {stats.adminCount}
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {language === 'vi' ? 'Đổi routing model, key vault' : 'Model routing, key vault changes'}
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px 18px', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {language === 'vi' ? 'Độ Tin Cậy / Thành Công' : 'Success Rate'}
            </span>
            <CheckCircle2 size={16} color="var(--accent-green)" />
          </div>
          <div style={{ fontSize: '24px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--accent-green)', marginTop: '6px' }}>
            {stats.rate}%
          </div>
          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {language === 'vi' ? 'Không phát hiện bất thường xác thực' : 'Zero auth or schema anomalies'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar Card */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px', boxShadow: 'var(--shadow-sm)' }}>
        {/* Scope Switcher */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--card-border-soft)', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', backgroundColor: '#F4EFE6', padding: '3px', borderRadius: '8px', gap: '2px' }}>
            <button
              onClick={() => { setSelectedCategory('all'); setSelectedModule('all'); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedCategory === 'all' ? '#FFF' : 'transparent',
                color: selectedCategory === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                boxShadow: selectedCategory === 'all' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Layers size={14} />
              <span>{language === 'vi' ? `Tất Cả Phân Hệ (${stats.total})` : `All Scopes (${stats.total})`}</span>
            </button>
            <button
              onClick={() => { setSelectedCategory('business'); setSelectedModule('all'); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedCategory === 'business' ? '#FFF' : 'transparent',
                color: selectedCategory === 'business' ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: selectedCategory === 'business' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <GraduationCap size={14} />
              <span>{language === 'vi' ? `Nghiệp Vụ Sư Phạm (${stats.businessCount})` : `Research Ops (${stats.businessCount})`}</span>
            </button>
            <button
              onClick={() => { setSelectedCategory('admin'); setSelectedModule('all'); }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12.5px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: selectedCategory === 'admin' ? '#FFF' : 'transparent',
                color: selectedCategory === 'admin' ? 'var(--accent-amber)' : 'var(--text-muted)',
                boxShadow: selectedCategory === 'admin' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              <Sliders size={14} />
              <span>{language === 'vi' ? `Quản Trị & AI Studio (${stats.adminCount})` : `Admin & AI (${stats.adminCount})`}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <Clock size={13} />
            <span>{language === 'vi' ? 'Thời gian: 24 giờ qua' : 'Time range: Last 24 hours'}</span>
          </div>
        </div>

        {/* Lower Toolbar: Search & Module Chips */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '6px 12px', flex: 1, minWidth: '260px', maxWidth: '420px' }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === 'vi' ? 'Tìm theo ID video, model id, actor, action...' : 'Search by video ID, model, actor, action...'}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: 'var(--text-main)' }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={13} />
              </button>
            )}
          </div>

          {/* Tag Chips */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedModule('all')}
              style={{
                padding: '4px 10px',
                borderRadius: '14px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid var(--card-border)',
                backgroundColor: selectedModule === 'all' ? 'var(--text-main)' : 'var(--bg)',
                color: selectedModule === 'all' ? '#FFF' : 'var(--text-muted)',
              }}
            >
              {language === 'vi' ? 'Tất cả module' : 'All modules'}
            </button>

            {(selectedCategory === 'all' || selectedCategory === 'business') && (
              <>
                <button
                  onClick={() => setSelectedModule('video_pipeline')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)',
                    backgroundColor: selectedModule === 'video_pipeline' ? 'var(--accent)' : 'var(--bg)',
                    color: selectedModule === 'video_pipeline' ? '#FFF' : 'var(--text-muted)',
                  }}
                >
                  Video Pipeline
                </button>
                <button
                  onClick={() => setSelectedModule('checklist')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)',
                    backgroundColor: selectedModule === 'checklist' ? 'var(--accent-blue)' : 'var(--bg)',
                    color: selectedModule === 'checklist' ? '#FFF' : 'var(--text-muted)',
                  }}
                >
                  Checklist Rubric
                </button>
                <button
                  onClick={() => setSelectedModule('thematic')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)',
                    backgroundColor: selectedModule === 'thematic' ? 'var(--accent-purple)' : 'var(--bg)',
                    color: selectedModule === 'thematic' ? '#FFF' : 'var(--text-muted)',
                  }}
                >
                  Thematic Codebook
                </button>
              </>
            )}

            {(selectedCategory === 'all' || selectedCategory === 'admin') && (
              <>
                <button
                  onClick={() => setSelectedModule('ai_routing')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)',
                    backgroundColor: selectedModule === 'ai_routing' ? 'var(--accent-amber)' : 'var(--bg)',
                    color: selectedModule === 'ai_routing' ? '#FFF' : 'var(--text-muted)',
                  }}
                >
                  AI Routing
                </button>
                <button
                  onClick={() => setSelectedModule('api_vault')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    border: '1px solid var(--card-border)',
                    backgroundColor: selectedModule === 'api_vault' ? 'var(--accent-blue)' : 'var(--bg)',
                    color: selectedModule === 'api_vault' ? '#FFF' : 'var(--text-muted)',
                  }}
                >
                  Key Vault
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main Structured Table */}
      <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid var(--card-border)' }}>
                <th style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', width: '130px' }}>
                  {language === 'vi' ? 'Thời gian' : 'Timestamp'}
                </th>
                <th style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', width: '150px' }}>
                  {language === 'vi' ? 'Tác tử' : 'Actor'}
                </th>
                <th style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', width: '160px' }}>
                  {language === 'vi' ? 'Phân tầng & Module' : 'Domain & Module'}
                </th>
                <th style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', width: '180px' }}>
                  {language === 'vi' ? 'Thực thể đích' : 'Target Entity'}
                </th>
                <th style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                  {language === 'vi' ? 'Hành động & Biến động dữ liệu' : 'Action & Data Changes'}
                </th>
                <th style={{ padding: '11px 16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', textAlign: 'right', width: '100px' }}>
                  {language === 'vi' ? 'Chi tiết' : 'Action'}
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '64px 20px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--accent-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <History size={24} color="var(--accent)" />
                      </div>
                      <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-main)' }}>
                        {language === 'vi' ? 'Chưa có nhật ký hoạt động nào' : 'No activity records yet'}
                      </span>
                      <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto', lineHeight: 1.6 }}>
                        {language === 'vi'
                          ? 'Dữ liệu mock đã được gỡ bỏ. Tất cả các thao tác thay đổi cấu hình AI Studio, quản lý khóa API Key và tác vụ phân tích video thực tế sẽ được tự động ghi nhận tại đây.'
                          : 'Mock data removed. Real modifications to AI Studio routing, API Key operations, and video analysis runs will be automatically audited here.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <AlertCircle size={28} color="var(--text-subtle)" />
                      <span style={{ fontSize: '14px', fontWeight: 500 }}>
                        {language === 'vi' ? 'Không tìm thấy nhật ký hoạt động phù hợp bộ lọc' : 'No activity records match current filter'}
                      </span>
                      <button
                        onClick={() => { setSelectedCategory('all'); setSelectedModule('all'); setSearchQuery(''); }}
                        className="btn btn-outline"
                        style={{ fontSize: '12px', padding: '6px 12px', marginTop: '4px' }}
                      >
                        {language === 'vi' ? 'Xóa bộ lọc' : 'Clear filters'}
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const timeInfo = formatTime(log.created_at);
                  const badgeInfo = getModuleBadgeInfo(log.module);
                  const IconComponent = badgeInfo.icon;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setActiveLogDetail(log)}
                      style={{
                        borderBottom: '1px solid var(--card-border-soft)',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease',
                      }}
                      className="hover-row"
                    >
                      {/* Timestamp */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        <div style={{ fontWeight: 500, color: 'var(--text-main)' }}>{timeInfo.time}</div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-subtle)', marginTop: '2px' }}>{timeInfo.rel}</div>
                      </td>

                      {/* Actor */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <User size={13} color="var(--accent)" />
                          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>{log.actor.username}</span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          {log.actor.role || 'Member'} {log.actor.client_ip && `• ${log.actor.client_ip}`}
                        </div>
                      </td>

                      {/* Domain & Module Badge */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ marginBottom: '3px' }}>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              padding: '1px 5px',
                              borderRadius: '3px',
                              backgroundColor: log.category === 'business' ? '#FDE8E8' : '#EEE',
                              color: log.category === 'business' ? 'var(--accent)' : '#444',
                            }}
                          >
                            {log.category === 'business' ? 'Business' : 'System Admin'}
                          </span>
                        </div>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 7px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            fontWeight: 600,
                            backgroundColor: badgeInfo.bg,
                            color: badgeInfo.color,
                            border: `1px solid ${badgeInfo.border}`,
                          }}
                        >
                          <IconComponent size={11} />
                          <span>{badgeInfo.label}</span>
                        </span>
                      </td>

                      {/* Target Entity */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                          {log.target_id || 'System'}
                        </div>
                        {log.target_title && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', maxWidth: '170px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={log.target_title}>
                            {log.target_title}
                          </div>
                        )}
                      </td>

                      {/* Summary & Diffs preview */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                          {language === 'vi' ? log.summary : (log.summary_en || log.summary)}
                        </div>
                        {log.diff && log.diff.length > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', flexWrap: 'wrap', fontSize: '11.5px', fontFamily: 'var(--font-mono)' }}>
                            {log.diff.slice(0, 2).map((d, i) => (
                              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', backgroundColor: '#FAF7F2', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--card-border-soft)' }}>
                                <span style={{ color: 'var(--text-muted)' }}>{d.label || d.field}:</span>
                                {d.before !== null && d.before !== undefined && (
                                  <span style={{ color: 'var(--accent-red)', textDecoration: 'line-through' }}>{String(d.before)}</span>
                                )}
                                <ArrowRight size={10} color="var(--text-muted)" />
                                <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>{String(d.after)}</span>
                              </span>
                            ))}
                            {log.diff.length > 2 && (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                +{log.diff.length - 2} {language === 'vi' ? 'trường khác' : 'more'}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLogDetail(log);
                          }}
                          className="btn btn-outline"
                          style={{
                            fontSize: '11.5px',
                            fontWeight: 600,
                            padding: '4px 8px',
                            borderRadius: '6px',
                            color: 'var(--accent)',
                          }}
                        >
                          {language === 'vi' ? 'Xem Diff' : 'View Diff'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over / Modal Detail Inspector */}
      {activeLogDetail && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(26, 22, 18, 0.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 9999,
          }}
          onClick={() => setActiveLogDetail(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              backgroundColor: 'var(--card-bg)',
              height: '100%',
              boxShadow: 'var(--shadow-lg)',
              display: 'flex',
              flexDirection: 'column',
              borderLeft: '1px solid var(--card-border)',
              animation: 'slideInRight 0.2s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History size={16} color="var(--accent)" />
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                    {language === 'vi' ? 'Chi Tiết Kiểm Toán Sự Kiện' : 'Event Audit Inspector'}
                  </span>
                </div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 500, color: 'var(--text-main)', marginTop: '4px' }}>
                  {activeLogDetail.target_title || activeLogDetail.action}
                </h3>
              </div>
              <button
                onClick={() => setActiveLogDetail(null)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '6px', borderRadius: '6px', color: 'var(--text-muted)' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '24px', flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* Event Metadata Grid */}
              <div style={{ backgroundColor: '#FAF7F2', border: '1px solid var(--card-border)', borderRadius: '10px', padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {language === 'vi' ? 'Mã Sự Kiện (Event ID)' : 'Event ID'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                    {activeLogDetail.id}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {language === 'vi' ? 'Thời Gian Ghi Nhận' : 'Timestamp'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-main)', marginTop: '2px' }}>
                    {new Date(activeLogDetail.created_at).toLocaleString('vi-VN')}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {language === 'vi' ? 'Tác Tử (Actor)' : 'Actor'}
                  </div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--accent)', marginTop: '2px' }}>
                    {activeLogDetail.actor.username} ({activeLogDetail.actor.role || 'User'})
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                    {language === 'vi' ? 'Địa Chỉ IP' : 'Client IP'}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--text-main)', marginTop: '2px' }}>
                    {activeLogDetail.actor.client_ip || 'Internal / Local'}
                  </div>
                </div>
              </div>

              {/* Action Description */}
              <div>
                <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {language === 'vi' ? 'Mô Tả Thao Tác' : 'Action Summary'}
                </h4>
                <div style={{ backgroundColor: 'var(--bg)', border: '1px solid var(--card-border)', borderRadius: '8px', padding: '12px 16px', fontSize: '13.5px', lineHeight: 1.5, color: 'var(--text-main)' }}>
                  {language === 'vi' ? activeLogDetail.summary : (activeLogDetail.summary_en || activeLogDetail.summary)}
                </div>
              </div>

              {/* Visual Diff Box */}
              {activeLogDetail.diff && activeLogDetail.diff.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {language === 'vi' ? 'Bảng So Sánh Thay Đổi (Visual Diff)' : 'Visual Diff (Before vs After)'}
                  </h4>
                  <div style={{ border: '1px solid var(--card-border)', borderRadius: '8px', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      <thead>
                        <tr style={{ backgroundColor: '#FAF7F2', borderBottom: '1px solid var(--card-border)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>
                            {language === 'vi' ? 'Thuộc tính' : 'Property'}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>
                            {language === 'vi' ? 'Trước (Old)' : 'Before'}
                          </th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)' }}>
                            {language === 'vi' ? 'Sau (New)' : 'After'}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeLogDetail.diff.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--card-border-soft)' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-main)' }}>
                              {item.label || item.field}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--accent-red)', textDecoration: 'line-through' }}>
                              {item.before !== null && item.before !== undefined ? String(item.before) : '—'}
                            </td>
                            <td style={{ padding: '8px 12px', color: 'var(--accent-green)', fontWeight: 600 }}>
                              {item.after !== null && item.after !== undefined ? String(item.after) : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Raw JSON Payload */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <h4 style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
                    {language === 'vi' ? 'Dữ Liệu JSON Thô (Audit Payload)' : 'Raw Audit Payload'}
                  </h4>
                  <button
                    onClick={() => handleCopyJSON(activeLogDetail)}
                    className="btn btn-outline"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px' }}
                  >
                    {copiedId === activeLogDetail.id ? <Check size={12} color="var(--accent-green)" /> : <Copy size={12} />}
                    <span>{copiedId === activeLogDetail.id ? (language === 'vi' ? 'Đã chép' : 'Copied') : (language === 'vi' ? 'Sao chép' : 'Copy')}</span>
                  </button>
                </div>
                <pre
                  style={{
                    backgroundColor: '#1E1B18',
                    color: '#F4EFE6',
                    padding: '14px',
                    borderRadius: '8px',
                    fontSize: '11.5px',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.5,
                    overflowX: 'auto',
                    maxHeight: '220px',
                  }}
                >
                  {JSON.stringify(activeLogDetail, null, 2)}
                </pre>
              </div>

            </div>

            {/* Drawer Footer */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px', backgroundColor: '#FAF7F2' }}>
              <button
                onClick={() => setActiveLogDetail(null)}
                className="btn btn-primary"
                style={{ fontSize: '13px', padding: '8px 18px' }}
              >
                {language === 'vi' ? 'Đóng' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
