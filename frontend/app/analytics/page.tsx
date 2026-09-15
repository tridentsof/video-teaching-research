'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import {
  api,
  PedagogicalAnalyticsData,
  LessonTrendPoint,
  TeacherQuadrantPoint,
  RadarDimensionPoint,
  TemporalBinPoint,
} from '@/lib/api';
import {
  TrendingUp,
  Download,
  FileSpreadsheet,
  Award,
  Clock,
  MessageSquare,
  Sparkles,
  Info,
  CheckCircle2,
  Calendar,
  Layers,
  Filter,
  RefreshCw,
  Video,
  ChevronDown,
} from 'lucide-react';
import {
  downloadSVG,
  generateTrajectorySVG,
  generateRadarSVG,
  generateStreamSVG,
  generateQuadrantSVG,
} from '@/lib/analytics-svg-exporter';

export default function AnalyticsPage() {
  const { t } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PedagogicalAnalyticsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [cohort, setCohort] = useState<string>('all');
  const [sectionFilter, setSectionFilter] = useState<string>('all');
  const [timeframe, setTimeframe] = useState<string>('all');
  const [trendViewMode, setTrendViewMode] = useState<'perLesson' | 'ma'>('perLesson');

  // Hover states
  const [hoveredLessonIdx, setHoveredLessonIdx] = useState<number | null>(null);
  const [hoveredTeacher, setHoveredTeacher] = useState<TeacherQuadrantPoint | null>(null);
  const [hoveredStreamIdx, setHoveredStreamIdx] = useState<number | null>(null);

  const splineSvgRef = useRef<SVGSVGElement | null>(null);
  const [exportDropdownOpen, setExportDropdownOpen] = useState<boolean>(false);
  const exportDropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(e.target as Node)) {
        setExportDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getPedagogicalAnalytics();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load pedagogical analytics:', err);
      setError(err.message || 'Failed to load live analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter lessons based on teacher cohort & timeframe
  const activeLessons = useMemo(() => {
    if (!data || !data.lessons) return [];
    let list = data.lessons;

    // Filter by specific teacher
    if (cohort !== 'all') {
      list = list.filter((l) => l.teacher_id.toLowerCase() === cohort.toLowerCase());
    }

    // Filter by timeframe
    if (timeframe === 'pre') list = list.slice(0, Math.ceil(list.length / 3));
    else if (timeframe === 'post') list = list.slice(Math.ceil(list.length / 3));

    return list;
  }, [data, cohort, timeframe]);

  // Compute Moving Average (3-lesson window) if selected
  const displayedTrendData = useMemo(() => {
    if (trendViewMode === 'perLesson' || activeLessons.length < 3) return activeLessons;
    return activeLessons.map((item, idx, arr) => {
      const start = Math.max(0, idx - 2);
      const slice = arr.slice(start, idx + 1);
      const count = slice.length;
      return {
        lesson: item.lesson,
        video_id: item.video_id,
        teacher_id: item.teacher_id,
        scaffolding: Number((slice.reduce((acc, cur) => acc + cur.scaffolding, 0) / count).toFixed(1)),
        waitTime: Number((slice.reduce((acc, cur) => acc + cur.waitTime, 0) / count).toFixed(1)),
        praise: Number((slice.reduce((acc, cur) => acc + cur.praise, 0) / count).toFixed(1)),
        agency: Number((slice.reduce((acc, cur) => acc + cur.agency, 0) / count).toFixed(1)),
      };
    });
  }, [activeLessons, trendViewMode]);

  // Teachers quadrant data
  const displayedTeachers = useMemo(() => {
    if (!data || !data.teachers) return [];
    if (cohort !== 'all') {
      return data.teachers.filter((t) => t.id.toLowerCase() === cohort.toLowerCase());
    }
    return data.teachers;
  }, [data, cohort]);

  // Dynamic series visibility based on sectionFilter
  const isSectionVisible = (section: 'A' | 'B' | 'C' | 'E') => {
    if (sectionFilter === 'all') return true;
    return sectionFilter === section;
  };

  // Export CSV Handler
  const handleExportCSV = () => {
    if (!displayedTrendData.length) return;
    const headers = ['Lesson', 'Teacher_ID', 'Scaffolding_SecA', 'WaitTime_SecB', 'Praise_SecC', 'StudentAgency_SecE'];
    const rows = displayedTrendData.map((d) =>
      [d.lesson, d.teacher_id, d.scaffolding, d.waitTime, d.praise, d.agency].join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `pedagogical_metrics_${cohort}_${sectionFilter}_${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(t('analyticsExportCSV') + ' ✓');
  };



  // SVG Dimension Math for Spline Chart
  const svgWidth = 720;
  const svgHeight = 280;
  const paddingX = 45;
  const paddingY = 35;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  // Dynamic max value
  const maxVal = useMemo(() => {
    if (!displayedTrendData.length) return 50;
    const values: number[] = [];
    displayedTrendData.forEach((d) => {
      if (isSectionVisible('A')) values.push(d.scaffolding);
      if (isSectionVisible('B')) values.push(d.waitTime);
      if (isSectionVisible('C')) values.push(d.praise);
      if (isSectionVisible('E')) values.push(d.agency);
    });
    const highest = values.length ? Math.max(...values) : 20;
    return Math.max(20, Math.ceil((highest * 1.15) / 10) * 10);
  }, [displayedTrendData, sectionFilter]);

  const getCoordinates = (val: number, idx: number, total: number) => {
    const x = paddingX + (idx / Math.max(1, total - 1)) * chartW;
    const y = paddingY + chartH - (val / Math.max(1, maxVal)) * chartH;
    return { x, y };
  };

  const generateSmoothPath = (values: number[]) => {
    const points = values.map((val, idx) => getCoordinates(val, idx, values.length));
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2] || p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const pathScaffolding = isSectionVisible('A') ? generateSmoothPath(displayedTrendData.map((d) => d.scaffolding)) : '';
  const pathWaitTime = isSectionVisible('B') ? generateSmoothPath(displayedTrendData.map((d) => d.waitTime)) : '';
  const pathPraise = isSectionVisible('C') ? generateSmoothPath(displayedTrendData.map((d) => d.praise)) : '';
  const pathAgency = isSectionVisible('E') ? generateSmoothPath(displayedTrendData.map((d) => d.agency)) : '';

  const pathScaffoldingArea =
    isSectionVisible('A') && displayedTrendData.length > 0
      ? pathScaffolding +
        ` L ${getCoordinates(0, displayedTrendData.length - 1, displayedTrendData.length).x} ${paddingY + chartH} L ${paddingX} ${paddingY + chartH} Z`
      : '';

  // Radar Chart Calculations
  const radarDimensions: RadarDimensionPoint[] = data?.radar?.length ? data.radar : [];
  const radarCenter = { x: 180, y: 145 };
  const radarRadius = 95;
  const radarAngles = radarDimensions.map((_, i) => (Math.PI * 2 * i) / Math.max(1, radarDimensions.length) - Math.PI / 2);

  const getRadarPoint = (score: number, angle: number) => {
    const r = (Math.min(100, Math.max(0, score)) / 100) * radarRadius;
    return {
      x: radarCenter.x + r * Math.cos(angle),
      y: radarCenter.y + r * Math.sin(angle),
    };
  };

  const getRadarLabel = (key: string) => {
    const sec = key.replace('sec', '');
    if (sec === 'A') return t('analyticsRadarA');
    if (sec === 'B') return t('analyticsRadarB');
    if (sec === 'C') return t('analyticsRadarC');
    if (sec === 'D') return t('analyticsRadarD');
    if (sec === 'E') return t('analyticsRadarE');
    return sec;
  };

  const corpusRadarPath =
    radarDimensions
      .map((d, i) => {
        const pt = getRadarPoint(d.score, radarAngles[i]);
        return `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      })
      .join(' ') + ' Z';

  // Temporal stream bins from live data
  const streamBins: TemporalBinPoint[] = data?.temporal_stream?.length ? data.temporal_stream : [];

  // Export Trajectory SVG with Full Legend
  const handleExportTrajectory = () => {
    if (!displayedTrendData.length) return;
    const svg = generateTrajectorySVG({
      trendData: displayedTrendData,
      cohort,
      sectionFilter,
      timeframe,
      trendViewMode,
      isSectionVisible,
      t,
    });
    downloadSVG(svg, `pedagogical_trajectory_${cohort}_${sectionFilter}_${timeframe}.svg`);
    toast.success(t('analyticsExportSuccess') + ' ✓');
  };

  // Export 5D Radar SVG with Full Legend
  const handleExportRadar = () => {
    if (!radarDimensions.length) return;
    const svg = generateRadarSVG({
      dimensions: radarDimensions,
      cohort,
      timeframe,
      t,
    });
    downloadSVG(svg, `pedagogical_radar_profile_${cohort}_${timeframe}.svg`);
    toast.success(t('analyticsExportSuccess') + ' ✓');
  };

  // Export Intra-Lesson Dynamics Stream SVG with Full Legend
  const handleExportStream = () => {
    if (!streamBins.length) return;
    const svg = generateStreamSVG({
      bins: streamBins,
      cohort,
      timeframe,
      t,
    });
    downloadSVG(svg, `pedagogical_temporal_stream_${cohort}_${timeframe}.svg`);
    toast.success(t('analyticsExportSuccess') + ' ✓');
  };

  // Export Quadrant Map SVG with Full Legend
  const handleExportQuadrant = () => {
    if (!displayedTeachers.length) return;
    const svg = generateQuadrantSVG({
      teachers: displayedTeachers,
      cohort,
      t,
    });
    downloadSVG(svg, `pedagogical_quadrant_map_${cohort}.svg`);
    toast.success(t('analyticsExportSuccess') + ' ✓');
  };

  // Batch Export All 4 Charts
  const handleExportAllCharts = () => {
    handleExportTrajectory();
    setTimeout(() => handleExportRadar(), 200);
    setTimeout(() => handleExportStream(), 400);
    setTimeout(() => handleExportQuadrant(), 600);
    toast.success(t('analyticsExportAllSuccess') + ' ✓');
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Top Header */}
      <section style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        borderBottom: '1px solid var(--card-border)',
        paddingBottom: '20px',
        gap: '20px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              backgroundColor: 'var(--accent-soft)',
              color: 'var(--accent)',
              border: '1px solid var(--card-border)',
            }}>
              <Sparkles size={13} />
              Observation Studio
            </span>
            <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>•</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              {data ? `${t('analyticsCorpusLabel')}: ${data.total_videos} ${t('analyticsVideos')} (${data.total_events.toLocaleString()} ${t('analyticsEvents')})` : '...'}
            </span>
          </div>

          <h1 style={{
            fontFamily: 'var(--font-serif)',
            fontSize: '32px',
            fontWeight: 400,
            color: 'var(--accent)',
            letterSpacing: '-0.5px',
            lineHeight: 1.15,
            margin: '0 0 6px 0',
          }}>
            {t('analyticsTitle')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0 }}>
            {t('analyticsSubtitle')}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchData}
            title={t('analyticsRefresh')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {t('analyticsRefresh')}
          </button>
          <button
            onClick={handleExportCSV}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              transition: 'all 0.15s ease',
            }}
          >
            <FileSpreadsheet size={15} color="var(--accent-green)" />
            {t('analyticsExportCSV')}
          </button>
          {/* High-Res Vector Export Dropdown */}
          <div ref={exportDropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setExportDropdownOpen((prev) => !prev)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                border: '1px solid transparent',
                backgroundColor: 'var(--accent)',
                color: '#FFFFFF',
                boxShadow: 'var(--shadow-sm)',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={15} />
              <span>{t('analyticsExportVector')}</span>
              <ChevronDown
                size={14}
                style={{
                  transform: exportDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.15s ease',
                }}
              />
            </button>

            {exportDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  minWidth: '290px',
                  backgroundColor: 'var(--card-bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.18)',
                  padding: '6px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                {/* Batch Export All */}
                <button
                  onClick={() => {
                    handleExportAllCharts();
                    setExportDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'var(--accent-soft)',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    fontSize: '12.5px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    marginBottom: '4px',
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  <Sparkles size={15} />
                  <span>{t('analyticsExportMenuAll')}</span>
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--card-border-soft)', margin: '2px 0' }} />

                {/* 1. Trajectory */}
                <button
                  onClick={() => {
                    handleExportTrajectory();
                    setExportDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <TrendingUp size={15} color="var(--accent)" />
                  <span>{t('analyticsExportTrajectory')}</span>
                </button>

                {/* 2. Radar */}
                <button
                  onClick={() => {
                    handleExportRadar();
                    setExportDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Award size={15} color="var(--accent-blue)" />
                  <span>{t('analyticsExportRadar')}</span>
                </button>

                {/* 3. Stream */}
                <button
                  onClick={() => {
                    handleExportStream();
                    setExportDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Clock size={15} color="var(--accent-amber)" />
                  <span>{t('analyticsExportStream')}</span>
                </button>

                {/* 4. Quadrant */}
                <button
                  onClick={() => {
                    handleExportQuadrant();
                    setExportDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: 'var(--text-main)',
                    fontSize: '12.5px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    transition: 'background-color 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <CompassIcon size={15} color="var(--accent-purple)" />
                  <span>{t('analyticsExportQuadrant')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter Bar */}
      <section style={{
        backgroundColor: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
        boxShadow: 'var(--shadow-sm)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Teacher Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={14} color="var(--accent)" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {t('analyticsTeacherSelect')}:
            </span>
            <select
              value={cohort}
              onChange={(e) => setCohort(e.target.value)}
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">{t('analyticsTeacherAll')}</option>
              {['T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08'].map((tid) => (
                <option key={tid} value={tid}>
                  {t('analyticsTeacherPrefix')} {tid}
                </option>
              ))}
            </select>
          </div>

          {/* Checklist Section Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={14} color="var(--accent-blue)" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {t('analyticsChecklistSection')}:
            </span>
            <select
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">{t('analyticsSectionAll')}</option>
              <option value="A">{t('analyticsSectionA')}</option>
              <option value="B">{t('analyticsSectionB')}</option>
              <option value="C">{t('analyticsSectionC')}</option>
              <option value="E">{t('analyticsSectionE')}</option>
            </select>
          </div>

          {/* Timeframe Filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} color="var(--accent-green)" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--text-muted)' }}>
              {t('analyticsTimeframe')}:
            </span>
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              style={{
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '6px',
                padding: '6px 12px',
                fontSize: '13px',
                color: 'var(--text-main)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="all">{t('analyticsTimeframeAll')}</option>
              <option value="pre">{t('analyticsTimeframePre')}</option>
              <option value="post">{t('analyticsTimeframePost')}</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
          <CheckCircle2 size={14} color="var(--accent-green)" />
          <span>{t('analyticsSequenceNote')}</span>
        </div>
      </section>

      {/* KPI Bento Grid */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: '16px',
      }}>
        {/* KPI 1 */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--accent)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('kpiTotalEvents')}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-green-soft)',
              color: 'var(--accent-green)',
            }}>
              <TrendingUp size={12} /> {data ? `${data.total_videos} ${t('analyticsVideos')}` : ''}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-main)', lineHeight: 1.1 }}>
            {data ? data.total_events.toLocaleString() : '...'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Layers size={13} /> {t('kpiTotalEventsSub')}
          </div>
        </div>

        {/* KPI 2 */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--accent-green)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('kpiAvgWaitTime')}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-green-soft)',
              color: 'var(--accent-green)',
            }}>
              <Clock size={12} /> {t('analyticsSectionB')}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-main)', lineHeight: 1.1 }}>
            {data ? `${data.avg_wait_time}s` : '...'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <TrendingUp size={13} /> {t('kpiAvgWaitTimeSub')}
          </div>
        </div>

        {/* KPI 3 */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--accent-blue)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('kpiScaffoldingRate')}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-blue-soft)',
              color: 'var(--accent-blue)',
            }}>
              <Award size={12} /> {t('analyticsSectionA')}
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-main)', lineHeight: 1.1 }}>
            {data ? `${data.scaffolding_ratio}%` : '...'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <MessageSquare size={13} /> {t('kpiScaffoldingRateSub')}
          </div>
        </div>

        {/* KPI 4 */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', backgroundColor: 'var(--accent-purple)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {t('kpiAIConfidence')}
            </span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11.5px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '4px',
              backgroundColor: 'var(--accent-purple-soft)',
              color: 'var(--accent-purple)',
            }}>
              <Sparkles size={12} /> Gemini & Claude
            </span>
          </div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-serif)', color: 'var(--text-main)', lineHeight: 1.1 }}>
            {data ? `${data.ai_confidence}%` : '...'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={13} /> {t('kpiAIConfidenceSub')}
          </div>
        </div>
      </section>

      {/* Row 1: Longitudinal Trajectory & 5D Radar */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px',
      }}>
        {/* Main Spline Trajectory Chart */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingUp size={18} color="var(--accent)" />
                {t('chartTrajectoryTitle')}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                {sectionFilter === 'all'
                  ? t('chartTrajectoryDescAll')
                  : `${t('chartTrajectoryDescFiltered')} ${sectionFilter === 'A' ? t('analyticsSectionA') : sectionFilter === 'B' ? t('analyticsSectionB') : sectionFilter === 'C' ? t('analyticsSectionC') : t('analyticsSectionE')}`}
              </p>
            </div>
            
            {/* Controls: View Mode & Direct SVG Export */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '6px', background: 'var(--bg)', padding: '3px', borderRadius: '6px', border: '1px solid var(--card-border)' }}>
                <button
                  onClick={() => setTrendViewMode('perLesson')}
                  style={{
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: trendViewMode === 'perLesson' ? 'var(--card-bg)' : 'transparent',
                    color: trendViewMode === 'perLesson' ? 'var(--accent)' : 'var(--text-muted)',
                    boxShadow: trendViewMode === 'perLesson' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t('chartTrajectoryViewPerLesson')}
                </button>
                <button
                  onClick={() => setTrendViewMode('ma')}
                  style={{
                    border: 'none',
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '4px 10px',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    backgroundColor: trendViewMode === 'ma' ? 'var(--card-bg)' : 'transparent',
                    color: trendViewMode === 'ma' ? 'var(--accent)' : 'var(--text-muted)',
                    boxShadow: trendViewMode === 'ma' ? 'var(--shadow-sm)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {t('chartTrajectoryViewMA')}
                </button>
              </div>

              <button
                onClick={handleExportTrajectory}
                title={t('analyticsExportTrajectory')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Download size={13} color="var(--accent)" />
                <span>{t('analyticsExportSingleBtn')}</span>
              </button>
            </div>
          </div>

          {/* Interactive SVG Spline Chart */}
          <div style={{ position: 'relative', width: '100%', minHeight: '290px' }}>
            <svg
              ref={splineSvgRef}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ width: '100%', height: '100%', overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="scaffoldingGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9E4A28" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#9E4A28" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, Math.round(maxVal / 3), Math.round((maxVal * 2) / 3), maxVal].map((val) => {
                const y = paddingY + chartH - (val / maxVal) * chartH;
                return (
                  <g key={val}>
                    <line
                      x1={paddingX}
                      y1={y}
                      x2={paddingX + chartW}
                      y2={y}
                      stroke="var(--card-border-soft)"
                      strokeDasharray={val === 0 ? 'none' : '3 3'}
                    />
                    <text
                      x={paddingX - 10}
                      y={y + 4}
                      textAnchor="end"
                      fontSize="10.5"
                      fontFamily="var(--font-mono)"
                      fill="var(--text-subtle)"
                    >
                      {val}
                    </text>
                  </g>
                );
              })}

              {/* X Axis Lesson Labels */}
              {displayedTrendData.map((d, i) => {
                const { x } = getCoordinates(0, i, displayedTrendData.length);
                return (
                  <text
                    key={d.lesson + i}
                    x={x}
                    y={paddingY + chartH + 20}
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="var(--font-mono)"
                    fontWeight={hoveredLessonIdx === i ? 700 : 500}
                    fill={hoveredLessonIdx === i ? 'var(--accent)' : 'var(--text-muted)'}
                  >
                    {d.lesson}
                  </text>
                );
              })}

              {/* Area fill for Scaffolding if visible */}
              {pathScaffoldingArea && <path d={pathScaffoldingArea} fill="url(#scaffoldingGradient)" />}

              {/* Spline Lines */}
              {isSectionVisible('A') && <path d={pathScaffolding} fill="none" stroke="#9E4A28" strokeWidth="2.8" strokeLinecap="round" />}
              {isSectionVisible('B') && <path d={pathWaitTime} fill="none" stroke="#2D6A4F" strokeWidth="2.2" strokeLinecap="round" />}
              {isSectionVisible('C') && <path d={pathPraise} fill="none" stroke="#1D5C8A" strokeWidth="2.2" strokeLinecap="round" />}
              {isSectionVisible('E') && <path d={pathAgency} fill="none" stroke="#B26A00" strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" />}

              {/* Hover Interaction Columns */}
              {displayedTrendData.map((d, i) => {
                const { x } = getCoordinates(0, i, displayedTrendData.length);
                const isHovered = hoveredLessonIdx === i;
                const ptScaffold = getCoordinates(d.scaffolding, i, displayedTrendData.length);
                const ptWait = getCoordinates(d.waitTime, i, displayedTrendData.length);
                const ptPraise = getCoordinates(d.praise, i, displayedTrendData.length);
                const ptAgency = getCoordinates(d.agency, i, displayedTrendData.length);

                return (
                  <g
                    key={i}
                    onMouseEnter={() => setHoveredLessonIdx(i)}
                    onMouseLeave={() => setHoveredLessonIdx(null)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* Invisible Hit Area */}
                    <rect
                      x={x - chartW / Math.max(1, displayedTrendData.length * 2)}
                      y={paddingY}
                      width={chartW / Math.max(1, displayedTrendData.length)}
                      height={chartH}
                      fill="transparent"
                    />

                    {isHovered && (
                      <line
                        x1={x}
                        y1={paddingY}
                        x2={x}
                        y2={paddingY + chartH}
                        stroke="var(--accent)"
                        strokeWidth="1"
                        strokeDasharray="3 3"
                      />
                    )}

                    {/* Data Points */}
                    {isSectionVisible('A') && <circle cx={ptScaffold.x} cy={ptScaffold.y} r={isHovered ? 5.5 : 3.5} fill="#9E4A28" stroke="#FFFFFF" strokeWidth="2" />}
                    {isSectionVisible('B') && <circle cx={ptWait.x} cy={ptWait.y} r={isHovered ? 5.5 : 3.5} fill="#2D6A4F" stroke="#FFFFFF" strokeWidth="2" />}
                    {isSectionVisible('C') && <circle cx={ptPraise.x} cy={ptPraise.y} r={isHovered ? 5.5 : 3.5} fill="#1D5C8A" stroke="#FFFFFF" strokeWidth="2" />}
                    {isSectionVisible('E') && <circle cx={ptAgency.x} cy={ptAgency.y} r={isHovered ? 5.5 : 3.5} fill="#B26A00" stroke="#FFFFFF" strokeWidth="2" />}
                  </g>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredLessonIdx !== null && displayedTrendData[hoveredLessonIdx] && (
              <div style={{
                position: 'absolute',
                top: '12px',
                right: '12px',
                backgroundColor: 'rgba(28, 25, 23, 0.95)',
                color: '#FFFFFF',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                pointerEvents: 'none',
                minWidth: '220px',
                backdropFilter: 'blur(4px)',
                zIndex: 10,
              }}>
                <div style={{ fontWeight: 700, borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '4px', marginBottom: '2px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{displayedTrendData[hoveredLessonIdx].lesson} • {displayedTrendData[hoveredLessonIdx].teacher_id}</span>
                  <span style={{ color: '#A8A29E', fontSize: '11px' }}>{t('tooltipTeacher')} {displayedTrendData[hoveredLessonIdx].teacher_id}</span>
                </div>
                {isSectionVisible('A') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#F5A788' }}>• {t('chartTrajectoryLegendScaffolding')}:</span>
                    <strong>{displayedTrendData[hoveredLessonIdx].scaffolding} {t('tooltipEvents')}</strong>
                  </div>
                )}
                {isSectionVisible('B') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#6EE7B7' }}>• {t('chartTrajectoryLegendWaitTime')}:</span>
                    <strong>{displayedTrendData[hoveredLessonIdx].waitTime} {t('tooltipEvents')}</strong>
                  </div>
                )}
                {isSectionVisible('C') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#93C5FD' }}>• {t('chartTrajectoryLegendPraise')}:</span>
                    <strong>{displayedTrendData[hoveredLessonIdx].praise} {t('tooltipEvents')}</strong>
                  </div>
                )}
                {isSectionVisible('E') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#FCD34D' }}>• {t('chartTrajectoryLegendAgency')}:</span>
                    <strong>{displayedTrendData[hoveredLessonIdx].agency} {t('tooltipTurns')}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Spline Chart Legend */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '18px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            flexWrap: 'wrap',
            paddingTop: '6px',
            borderTop: '1px solid var(--card-border-soft)',
          }}>
            {isSectionVisible('A') && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', backgroundColor: '#9E4A28', borderRadius: '2px' }} />
                {t('chartTrajectoryLegendScaffolding')}
              </span>
            )}
            {isSectionVisible('B') && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', backgroundColor: '#2D6A4F', borderRadius: '2px' }} />
                {t('chartTrajectoryLegendWaitTime')}
              </span>
            )}
            {isSectionVisible('C') && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '3px', backgroundColor: '#1D5C8A', borderRadius: '2px' }} />
                {t('chartTrajectoryLegendPraise')}
              </span>
            )}
            {isSectionVisible('E') && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '12px', height: '2px', borderTop: '2px dashed #B26A00' }} />
                {t('chartTrajectoryLegendAgency')}
              </span>
            )}
          </div>
        </div>

        {/* 5-Dimensional Radar Profile */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Award size={18} color="var(--accent-blue)" />
                {t('chartRadarTitle')}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                {t('chartRadarDesc')}
              </p>
            </div>
            <button
              onClick={handleExportRadar}
              title={t('analyticsExportRadar')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={13} color="var(--accent-blue)" />
              <span>{t('analyticsExportSingleBtn')}</span>
            </button>
          </div>

          {/* SVG Radar */}
          <div style={{ position: 'relative', width: '100%', height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg viewBox="0 0 360 290" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              {/* Concentric Web Polygons */}
              {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale) => {
                const ringPath = radarDimensions
                  .map((_, i) => {
                    const pt = getRadarPoint(scale * 100, radarAngles[i]);
                    return `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
                  })
                  .join(' ') + ' Z';

                return (
                  <path
                    key={scale}
                    d={ringPath}
                    fill="none"
                    stroke="var(--card-border)"
                    strokeWidth={scale === 1 ? '1.2' : '0.8'}
                  />
                );
              })}

              {/* Axis spokes */}
              {radarDimensions.map((d, i) => {
                const edgePt = getRadarPoint(100, radarAngles[i]);
                const textPt = getRadarPoint(120, radarAngles[i]);
                return (
                  <g key={d.key}>
                    <line
                      x1={radarCenter.x}
                      y1={radarCenter.y}
                      x2={edgePt.x}
                      y2={edgePt.y}
                      stroke="var(--card-border)"
                      strokeWidth="1"
                    />
                    <text
                      x={textPt.x}
                      y={textPt.y + 4}
                      textAnchor="middle"
                      fontSize="10.5"
                      fontFamily="var(--font-sans)"
                      fontWeight="600"
                      fill="var(--text-muted)"
                    >
                      {getRadarLabel(d.key)}
                    </text>
                  </g>
                );
              })}

              {/* Single Corpus Polygon */}
              {radarDimensions.length > 0 && (
                <path d={corpusRadarPath} fill="rgba(158, 74, 40, 0.22)" stroke="#9E4A28" strokeWidth="2.5" />
              )}
            </svg>
          </div>

          {/* Radar Legend with Counts */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '12px',
            fontSize: '11.5px',
            color: 'var(--text-muted)',
            paddingTop: '6px',
            borderTop: '1px solid var(--card-border-soft)',
            flexWrap: 'wrap',
          }}>
            {radarDimensions.map((d) => (
              <span key={d.key} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#9E4A28', borderRadius: '50%' }} />
                <strong>{d.key.replace('sec', '')}:</strong> {d.count} {t('tooltipEvents')}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Row 2: Intra-Lesson Temporal Dynamics (Stream) & Quadrant Classification */}
      <section style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr',
        gap: '20px',
      }}>
        {/* Intra-Lesson Temporal Stream Area Chart (0-45m) */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} color="var(--accent-amber)" />
                {t('chartStreamTitle')}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                {t('chartStreamDesc')}
              </p>
            </div>
            <div style={{
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}>
              <div style={{
                display: 'flex',
                gap: '14px',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#1D5C8A' }} />
                  {t('chartStreamWarmup')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9E4A28' }} />
                  {t('chartStreamScaffolding')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#2D6A4F' }} />
                  {t('chartStreamStudentTurns')}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6D28D9' }} />
                  {t('chartStreamPraise')}
                </span>
              </div>

              <button
                onClick={handleExportStream}
                title={t('analyticsExportStream')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '5px 10px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  border: '1px solid var(--card-border)',
                  backgroundColor: 'var(--bg)',
                  color: 'var(--text-main)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <Download size={13} color="var(--accent-amber)" />
                <span>{t('analyticsExportSingleBtn')}</span>
              </button>
            </div>
          </div>

          {/* Stream Bars Visualization */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            minHeight: '220px',
            justifyContent: 'center',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(9, 1fr)',
              gap: '6px',
              alignItems: 'flex-end',
              height: '180px',
            }}>
              {streamBins.map((bin, i) => {
                const total = Math.max(1, bin.warmup + bin.scaffolding + bin.studentTurns + bin.praise);
                const isHovered = hoveredStreamIdx === i;

                return (
                  <div
                    key={bin.bin}
                    onMouseEnter={() => setHoveredStreamIdx(i)}
                    onMouseLeave={() => setHoveredStreamIdx(null)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column-reverse',
                      height: '100%',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      transform: isHovered ? 'scaleY(1.02)' : 'scaleY(1)',
                      transition: 'all 0.15s ease',
                      outline: isHovered ? '2px solid var(--accent)' : 'none',
                    }}
                  >
                    <div style={{ height: `${(bin.warmup / total) * 100}%`, backgroundColor: '#1D5C8A', opacity: 0.85 }} />
                    <div style={{ height: `${(bin.scaffolding / total) * 100}%`, backgroundColor: '#9E4A28', opacity: 0.85 }} />
                    <div style={{ height: `${(bin.studentTurns / total) * 100}%`, backgroundColor: '#2D6A4F', opacity: 0.85 }} />
                    <div style={{ height: `${(bin.praise / total) * 100}%`, backgroundColor: '#6D28D9', opacity: 0.85 }} />
                  </div>
                );
              })}
            </div>

            {/* X Labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '6px', textAlign: 'center' }}>
              {streamBins.map((bin, i) => (
                <span
                  key={bin.bin}
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: hoveredStreamIdx === i ? 700 : 500,
                    color: hoveredStreamIdx === i ? 'var(--accent)' : 'var(--text-muted)',
                  }}
                >
                  {bin.bin}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Pedagogical Quadrant Map (Fixed hit-box to prevent hover jitter) */}
        <div style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '22px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 3px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CompassIcon size={18} color="var(--accent-purple)" />
                {t('chartQuadrantTitle')}
              </h3>
              <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0 }}>
                {t('chartQuadrantDesc')}
              </p>
            </div>
            <button
              onClick={handleExportQuadrant}
              title={t('analyticsExportQuadrant')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--bg)',
                color: 'var(--text-main)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={13} color="var(--accent-purple)" />
              <span>{t('analyticsExportSingleBtn')}</span>
            </button>
          </div>

          {/* 2D Coordinate Scatter Space */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '240px',
            backgroundColor: 'var(--bg)',
            border: '1px dashed var(--card-border)',
            borderRadius: 'var(--radius-sm)',
            overflow: 'hidden',
          }}>
            {/* Center Crosshairs */}
            <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', borderTop: '1px dashed var(--card-border)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', borderLeft: '1px dashed var(--card-border)', pointerEvents: 'none' }} />

            {/* Quadrant Watermark Labels */}
            <span style={{ position: 'absolute', top: '8px', right: '8px', fontSize: '10px', color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
              {t('quadrantFacilitative')}
            </span>
            <span style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '10px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
              {t('quadrantStructured')}
            </span>
            <span style={{ position: 'absolute', bottom: '8px', right: '8px', fontSize: '10px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
              {t('quadrantConversational')}
            </span>
            <span style={{ position: 'absolute', bottom: '8px', left: '8px', fontSize: '10px', color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', pointerEvents: 'none', userSelect: 'none' }}>
              {t('quadrantTraditional')}
            </span>

            {/* Teacher Plotted Points with FIXED 28px HIT-BOX and stable coordinates */}
            {displayedTeachers.map((tp) => {
              const isHovered = hoveredTeacher?.id === tp.id;
              return (
                <div
                  key={tp.id}
                  onMouseEnter={() => setHoveredTeacher(tp)}
                  onMouseLeave={() => setHoveredTeacher((prev) => (prev?.id === tp.id ? null : prev))}
                  style={{
                    position: 'absolute',
                    left: `${Math.min(90, Math.max(10, tp.agency))}%`,
                    top: `${Math.min(90, Math.max(10, 100 - tp.scaffolding))}%`,
                    transform: 'translate(-50%, -50%)',
                    width: '28px',
                    height: '28px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    zIndex: isHovered ? 20 : 10,
                  }}
                >
                  {/* Stable circular dot animated with CSS transform only */}
                  <div style={{
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: isHovered ? 'var(--accent)' : 'var(--accent-hover)',
                    border: '2px solid #FFFFFF',
                    boxShadow: isHovered ? '0 0 0 3px rgba(158, 74, 40, 0.35)' : '0 1px 3px rgba(0,0,0,0.2)',
                    transform: isHovered ? 'scale(1.3)' : 'scale(1)',
                    transition: 'transform 0.12s ease-out',
                    pointerEvents: 'none',
                    willChange: 'transform',
                  }} />
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    color: isHovered ? 'var(--accent)' : 'var(--text-muted)',
                    marginTop: '2px',
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}>
                    {tp.id}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Hovered Teacher Details: STRICT FIXED HEIGHT (30px) ensures 0 layout jitter */}
          <div style={{
            fontSize: '11.5px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: '30px',
            minHeight: '30px',
            maxHeight: '30px',
            overflow: 'hidden',
            boxSizing: 'border-box',
            borderTop: '1px solid var(--card-border-soft)',
            paddingTop: '4px',
          }}>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flexShrink: 0 }}>
              {t('tooltipTeacher')} <strong>{hoveredTeacher ? hoveredTeacher.id : '---'}</strong>
            </span>
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right', fontSize: '11px' }}>
              {hoveredTeacher
                ? `${hoveredTeacher.total_events} ${t('tooltipEvents')} • ${t('chartQuadrantAgencyShort')}: ${hoveredTeacher.agency}%`
                : t('tooltipHoverTeacher')}
            </span>
          </div>
        </div>
      </section>

      {/* Qualitative Outlier Evidence Trace Callout */}
      {data?.outlier_evidence && (
        <section style={{
          backgroundColor: 'var(--accent-soft)',
          borderLeft: '4px solid var(--accent)',
          borderRadius: '0 var(--radius-md) var(--radius-md) 0',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              letterSpacing: '0.8px',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              <Info size={14} />
              {t('evidenceTitle')}
            </span>
            <span style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: 'var(--accent-hover)', fontWeight: 600 }}>
              {t('analyticsTeacherPrefix')} {data.outlier_evidence.teacher_id} • {data.outlier_evidence.lesson} • {data.outlier_evidence.timestamp_str}
            </span>
          </div>
          <p style={{
            fontSize: '13.5px',
            lineHeight: 1.55,
            color: 'var(--text-main)',
            fontStyle: 'italic',
            margin: 0,
          }}>
            "{data.outlier_evidence.quote}"
          </p>
          {data.outlier_evidence.context && (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              <strong>{t('evidenceContext')}</strong> {data.outlier_evidence.context}
            </span>
          )}
        </section>
      )}

    </div>
  );
}

// Custom Compass SVG Icon
function CompassIcon({ size = 18, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" fill={color} fillOpacity="0.2" />
    </svg>
  );
}
