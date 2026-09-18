'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';
import { FeatureWorkflowBanner } from '@/components/FeatureWorkflowBanner';
import { CodeEvidenceDrawer } from '@/components/CodeEvidenceDrawer';
import {
  api,
  QualitativeAnalyticsData,
  CoverageMatrixRow,
  ThematicTheme,
  RQ1EnactmentRow,
  QualitativeEvidenceItem,
} from '@/lib/api';
import {
  Download,
  FileSpreadsheet,
  Clock,
  Sparkles,
  Info,
  Layers,
  Filter,
  RefreshCw,
  ChevronDown,
  ExternalLink,
  BookOpen,
  Grid,
  GitFork,
  Target,
  CheckCircle2,
  Printer,
  Loader2,
} from 'lucide-react';
import {
  downloadSVG,
  generateCoverageMatrixSVG,
  generateThematicHierarchySVG,
  generateRQ1TraceabilitySVG,
} from '@/lib/analytics-svg-exporter';
import { generateAPATablesPdf } from '@/lib/pdfExport';

export default function QualitativeAnalyticsPage() {
  const { t, language } = useTranslation();
  const toast = useToast();

  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<QualitativeAnalyticsData | null>(null);
  const [isExportingPdfAPA, setIsExportingPdfAPA] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // View States
  const [matrixViewMode, setMatrixViewMode] = useState<'lessons' | 'teachers'>('lessons');
  const [hierarchyViewMode, setHierarchyViewMode] = useState<'tree' | 'bento'>('tree');
  const [rqFilter, setRqFilter] = useState<string>('all');

  // Drawer for Code drill-down
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeCodeDrawer, setActiveCodeDrawer] = useState<{
    code: string;
    description: string;
    category?: string;
    theme?: string;
    evidence: QualitativeEvidenceItem[];
  } | null>(null);

  // Export dropdown
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
      const res = await api.getQualitativeAnalytics();
      setData(res);
    } catch (err: any) {
      console.error('Failed to load qualitative analytics:', err);
      setError(err.message || 'Failed to load qualitative analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Columns list for Coverage Matrix
  const matrixColumns = useMemo(() => {
    if (!data) return [];
    return matrixViewMode === 'lessons' ? data.lessons_list : data.teachers_list;
  }, [data, matrixViewMode]);

  // Filtered RQ1 rows
  const filteredRQ1Rows = useMemo(() => {
    if (!data || !data.rq1_enactment_map) return [];
    if (rqFilter === 'all') return data.rq1_enactment_map;
    return data.rq1_enactment_map.filter((item) => {
      const dim = (item.dimension || item.strategy_subtext || '').toLowerCase();
      const pat = (item.recurring_pattern || item.strategy_name || '').toLowerCase();
      const q = rqFilter.toLowerCase();
      if (q === 'rules') return dim.includes('rules') || dim.includes('quy tắc');
      if (q === 'turn') return dim.includes('turn') || dim.includes('lượt nói') || pat.includes('turn') || pat.includes('wait');
      if (q === 'attention') return dim.includes('attention') || dim.includes('chú ý');
      if (q === 'scaffolding') return dim.includes('scaffolding') || dim.includes('hỗ trợ');
      if (q === 'tools') return dim.includes('digital') || dim.includes('công cụ số') || pat.includes('screen') || pat.includes('chat');
      return dim.includes(q) || pat.includes(q);
    });
  }, [data, rqFilter]);

  // Open Drawer for a specific code
  const handleOpenCodeDrawer = (
    code: string,
    description: string,
    category?: string,
    theme?: string,
    evidence?: QualitativeEvidenceItem[]
  ) => {
    // If evidence is not passed directly, look for it in matrix rows
    let evList = evidence || [];
    if (evList.length === 0 && data) {
      const matchRow = data.coverage_matrix.find(
        (r) => r.code.toLowerCase() === code.toLowerCase() || r.description.toLowerCase() === description.toLowerCase()
      );
      if (matchRow && matchRow.evidence) {
        evList = matchRow.evidence;
      }
    }

    setActiveCodeDrawer({
      code,
      description,
      category,
      theme,
      evidence: evList,
    });
    setDrawerOpen(true);
  };

  // ================= EXPORT HANDLERS =================

  // 1. Export Matrix SVG
  const handleExportMatrixSVG = () => {
    if (!data) return;
    const svg = generateCoverageMatrixSVG({
      rows: data.coverage_matrix,
      viewMode: matrixViewMode,
      columnsList: matrixColumns,
      language: language as 'en' | 'vi',
    });
    downloadSVG(svg, `qualitative-coverage-matrix-${matrixViewMode}.svg`);
    toast.success(t('analyticsExportSuccess'));
  };

  // 2. Export Hierarchy SVG
  const handleExportHierarchySVG = () => {
    if (!data) return;
    const svg = generateThematicHierarchySVG({
      themes: data.thematic_hierarchy,
      language: language as 'en' | 'vi',
    });
    downloadSVG(svg, 'qualitative-thematic-hierarchy-tree.svg');
    toast.success(t('analyticsExportSuccess'));
  };

  // 3. Export RQ1 Enactment SVG
  const handleExportRQ1SVG = () => {
    if (!data) return;
    const svg = generateRQ1TraceabilitySVG({
      enactments: data.rq1_enactment_map,
      language: language as 'en' | 'vi',
    });
    downloadSVG(svg, 'qualitative-rq1-enactment-map.svg');
    toast.success(t('analyticsExportSuccess'));
  };

  // 4. Batch Export All 3 SVG Diagrams
  const handleExportAllSVG = () => {
    handleExportMatrixSVG();
    setTimeout(handleExportHierarchySVG, 300);
    setTimeout(handleExportRQ1SVG, 600);
    toast.success(language === 'vi' ? 'Đã xuất toàn bộ 3 sơ đồ định tính vector!' : 'All 3 publication-ready qualitative vector diagrams exported!');
  };

  // 5. Build HTML content for APA 7th tables
  const buildAPATablesHtml = () => {
    if (!data) return '';
    const isVi = language === 'vi';

    const t1Title = isVi
      ? 'Bảng 4.1<br/><span style="font-weight: normal; font-style: italic;">Ma Trận Độ Phủ 5 Kích Thước Quan Sát Luận Văn Qua 24 Bài Học EFL</span>'
      : 'Table 4.1<br/><span style="font-weight: normal; font-style: italic;">Observation Framework Dimensions Coverage Matrix across 24 EFL Lessons</span>';
    const t1Col1 = isVi ? 'Kích Thước Phân Tích' : 'Analytical Dimension';
    const t1Col2 = isVi ? 'Phần Khung Luận Văn' : 'Framework Section';
    const t1Breadth = isVi ? 'Độ Phủ' : 'Breadth';
    const t1Note = isVi
      ? '<em>Ghi chú.</em> ● chỉ báo hành vi thực nghiệm quan sát được xuất hiện trong bản ghi bài giảng. Tổng tập mẫu = 12 Giáo viên / 24 Bài học.'
      : '<em>Note.</em> ● indicates observable empirical enactment present in video transcript. Total Corpus = 12 Teachers / 24 Lessons.';

    const t2Title = isVi
      ? 'Bảng 4.3<br/><span style="font-weight: normal; font-style: italic;">Câu Hỏi Nghiên Cứu 1 (RQ1): Bản Đồ Truy Vết Triển Khai Thực Nghiệm và Trích Dẫn Minh Chứng</span>'
      : 'Table 4.3<br/><span style="font-weight: normal; font-style: italic;">Research Question 1 (RQ1) Strategy Enactment and Empirical Traceability Map</span>';
    const t2Col1 = isVi ? 'Kích Thước Phân Tích' : 'Analytical Dimension';
    const t2Col2 = isVi ? 'Mẫu Hành Vi Lặp Lại' : 'Recurring Pattern';
    const t2Col3 = isVi ? 'Hành Vi Quan Sát Được' : 'Observed Enactment';
    const t2Col4 = isVi ? 'Bài Giảng Tiêu Biểu' : 'Lessons';
    const t2Col5 = isVi ? 'Mốc Thời Gian & Trích Dẫn' : 'Timestamps & Quotes';

    return `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${isVi ? 'Bảng Bằng Chứng Định Tính (APA 7th)' : 'Qualitative Evidence Tables (APA 7th)'}</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.5; color: #111827; }
          h1 { font-size: 14pt; font-weight: bold; text-align: center; margin-bottom: 12px; color: #1E3A8A; }
          h2 { font-size: 12pt; font-weight: bold; margin-top: 24pt; margin-bottom: 10pt; color: #1E3A8A; }
          table { width: 100%; border-collapse: collapse; margin-top: 10pt; font-size: 10pt; }
          th, td { padding: 6pt; text-align: left; vertical-align: top; }
          /* APA Table Styling: Borders only on top, bottom of header, and bottom of table */
          .apa-table { border-top: 1.5pt solid black; border-bottom: 1.5pt solid black; width: 100%; }
          .apa-table th { border-bottom: 1pt solid black; font-weight: bold; }
          .apa-table td { border-bottom: 0.5pt solid #E5E7EB; }
          .note { font-size: 9pt; font-style: italic; margin-top: 6pt; color: #4B5563; }
        </style>
      </head>
      <body>
        <h1>${t1Title}</h1>
        <table class="apa-table">
          <thead>
            <tr>
              <th>${t1Col1}</th>
              <th>${t1Col2}</th>
              ${matrixColumns.map((c) => `<th style="text-align: center;">${c}</th>`).join('')}
              <th style="text-align: center;">${t1Breadth}</th>
            </tr>
          </thead>
          <tbody>
            ${data.coverage_matrix
              .map(
                (row) => `
              <tr>
                <td><strong>${row.description || row.code}</strong></td>
                <td>${row.category}</td>
                ${matrixColumns
                  .map((col) => {
                    const cells = matrixViewMode === 'lessons' ? row.lesson_cells : row.teacher_cells;
                    const cell = cells.find((c) => c.key.toLowerCase() === col.toLowerCase());
                    return `<td style="text-align: center;">${cell && cell.present ? '●' : ''}</td>`;
                  })
                  .join('')}
                <td style="text-align: center;">${
                  matrixViewMode === 'lessons'
                    ? `${row.breadth_lessons} / ${row.total_lessons}`
                    : `${row.breadth_teachers} / ${row.total_teachers}`
                }</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
        <p class="note">${t1Note}</p>

        <h2>${t2Title}</h2>
        <table class="apa-table">
          <thead>
            <tr>
              <th style="width: 20%;">${t2Col1}</th>
              <th style="width: 20%;">${t2Col2}</th>
              <th style="width: 28%;">${t2Col3}</th>
              <th style="width: 12%;">${t2Col4}</th>
              <th style="width: 20%;">${t2Col5}</th>
            </tr>
          </thead>
          <tbody>
            ${data.rq1_enactment_map
              .map((rq) => {
                const dim = isVi && rq.dimension_vi ? rq.dimension_vi : (rq.dimension || rq.strategy_subtext || '');
                const pat = isVi && rq.recurring_pattern_vi ? rq.recurring_pattern_vi : (rq.recurring_pattern || rq.strategy_name || '');
                const enact = isVi && rq.observed_enactment_vi ? rq.observed_enactment_vi : (rq.observed_enactment || (rq.observed_enactments && rq.observed_enactments[0]) || '');

                return `
              <tr>
                <td><strong>${dim}</strong></td>
                <td>${pat}</td>
                <td>${enact}</td>
                <td>${rq.representative_lessons.join(', ')}</td>
                <td>${rq.direct_quotes
                  .slice(0, 2)
                  .map((q) => `<div>[${q.timestamp_str}] <em>"${q.quote}"</em></div>`)
                  .join('<br/>')}</td>
              </tr>
            `;
              })
              .join('')}
          </tbody>
        </table>
        <p class="note"><em>${isVi ? 'Ghi chú.' : 'Note.'}</em> ${isVi ? 'Hình 4.2 (Sơ đồ cây chủ đề) sẽ được xác định chính thức sau khi thu thập và phân tích dữ liệu phỏng vấn giáo viên (RQ2 & RQ3).' : 'Figure 4.2 (Thematic Tree) is pending post-interview data collection and reflexive thematic synthesis.'}</p>
      </body>
      </html>
    `;
  };

  // 6. Export Word APA Table (Download HTML table formatted as .doc)
  const handleExportWordAPA = () => {
    if (!data) return;
    const isVi = language === 'vi';
    const htmlContent = buildAPATablesHtml();

    const blob = new Blob([htmlContent], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = isVi ? 'bang-nghien-cuu-dinh-tinh-apa7.doc' : 'qualitative-research-tables-apa7.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(isVi ? 'Đã xuất bảng Word APA 7th thành công!' : 'APA 7th Word tables exported successfully!');
  };

  // 7. Export PDF APA Table
  const handleExportPdfAPA = async () => {
    if (!data) return;
    const isVi = language === 'vi';
    setIsExportingPdfAPA(true);
    try {
      const htmlContent = buildAPATablesHtml();
      const filename = isVi ? 'bang-nghien-cuu-dinh-tinh-apa7.pdf' : 'qualitative-research-tables-apa7.pdf';
      await generateAPATablesPdf(htmlContent, filename);
      toast.success(t('qualitativeExportPdfAPASuccess'));
    } catch (err) {
      console.error('Failed to export APA PDF:', err);
      toast.error(isVi ? 'Lỗi khi xuất bảng PDF. Vui lòng thử lại.' : 'Failed to export APA PDF. Please try again.');
    } finally {
      setIsExportingPdfAPA(false);
    }
  };

  return (
    <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      {/* Top Workflow Banner */}
      <FeatureWorkflowBanner featureKey="analytics" />

      {/* Top Header */}
      <section
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          borderBottom: '1px solid var(--card-border)',
          paddingBottom: '20px',
          gap: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
            <span
              style={{
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
              }}
            >
              <Sparkles size={13} />
              Phase 6 Qualitative Synthesis
            </span>
            <span style={{ color: 'var(--text-subtle)', fontSize: '12px' }}>•</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
              Analysis Run: {data ? `${data.analysis_run_id} (${data.run_status})` : '...'} • 12 Teachers / 24 Lessons
            </span>
          </div>

          <h1
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: '32px',
              fontWeight: 400,
              color: 'var(--accent)',
              letterSpacing: '-0.5px',
              lineHeight: 1.15,
              margin: '0 0 6px 0',
            }}
          >
            {t('qualitativeStudioTitle')}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '13.5px', margin: 0, maxWidth: '820px' }}>
            {t('qualitativeStudioSubtitle')}
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={fetchData}
            title={t('analyticsRefresh')}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              border: '1px solid var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              color: 'var(--text-main)',
              transition: 'all 0.15s ease',
            }}
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            <span>{t('analyticsRefresh')}</span>
          </button>

          {/* Export Word APA Table */}
          <button
            onClick={handleExportWordAPA}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: 'pointer',
              border: '1px solid #BBF7D0',
              backgroundColor: '#F0FDF4',
              color: '#166534',
              transition: 'all 0.15s ease',
            }}
            title={language === 'vi' ? 'Xuất bảng định tính APA sang Word (.doc)' : 'Export qualitative APA tables to Word (.doc)'}
          >
            <FileSpreadsheet size={13.5} color="#166534" />
            <span>{t('qualitativeExportWordAPA')}</span>
          </button>

          {/* Export PDF APA Table */}
          <button
            onClick={handleExportPdfAPA}
            disabled={isExportingPdfAPA}
            style={{
              height: '32px',
              padding: '0 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              cursor: isExportingPdfAPA ? 'not-allowed' : 'pointer',
              border: '1px solid #FECACA',
              backgroundColor: '#FEF2F2',
              color: '#991B1B',
              transition: 'all 0.15s ease',
            }}
            title={language === 'vi' ? 'Xuất bảng định tính APA sang PDF (.pdf)' : 'Export qualitative APA tables to PDF (.pdf)'}
          >
            {isExportingPdfAPA ? <Loader2 size={13.5} className="animate-spin" /> : <Printer size={13.5} color="#DC2626" />}
            <span>{t('qualitativeExportPdfAPA')}</span>
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
                  minWidth: '310px',
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
                    handleExportAllSVG();
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
                  }}
                >
                  <Sparkles size={15} />
                  <span>{t('qualitativeExportAllBundle')}</span>
                </button>

                <div style={{ height: '1px', backgroundColor: 'var(--card-border-soft)', margin: '2px 0' }} />

                {/* 1. Coverage Matrix */}
                <button
                  onClick={() => {
                    handleExportMatrixSVG();
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
                  }}
                >
                  <Grid size={15} color="var(--accent)" />
                  <span>{t('qualitativeExportMatrixSVG')}</span>
                </button>

                {/* 2. Hierarchy Tree */}
                <button
                  onClick={() => {
                    handleExportHierarchySVG();
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
                  }}
                >
                  <GitFork size={15} color="var(--accent-blue)" />
                  <span>{t('qualitativeExportHierarchySVG')}</span>
                </button>

                {/* 3. RQ1 Enactment Map */}
                <button
                  onClick={() => {
                    handleExportRQ1SVG();
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
                  }}
                >
                  <Target size={15} color="var(--accent-green)" />
                  <span>{t('qualitativeExportRQ1SVG')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================
           SECTION 1: CODE/PATTERN × LESSON COVERAGE MATRIX
           ============================================================ */}
      <section
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid var(--card-border-soft)',
            paddingBottom: '14px',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                color: 'var(--accent)',
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 4px 0',
              }}
            >
              <Grid size={20} />
              {t('qualitativeMatrixTitle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              {t('qualitativeMatrixSubtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>Xem theo:</span>
            <div
              style={{
                display: 'inline-flex',
                backgroundColor: 'var(--bg)',
                border: '1px solid var(--card-border)',
                borderRadius: '6px',
                padding: '2px',
                gap: '2px',
              }}
            >
              <button
                onClick={() => setMatrixViewMode('lessons')}
                style={{
                  border: 'none',
                  backgroundColor: matrixViewMode === 'lessons' ? 'var(--card-bg)' : 'transparent',
                  color: matrixViewMode === 'lessons' ? 'var(--accent)' : 'var(--text-muted)',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: matrixViewMode === 'lessons' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t('qualitativeViewLessons')}
              </button>
              <button
                onClick={() => setMatrixViewMode('teachers')}
                style={{
                  border: 'none',
                  backgroundColor: matrixViewMode === 'teachers' ? 'var(--card-bg)' : 'transparent',
                  color: matrixViewMode === 'teachers' ? 'var(--accent)' : 'var(--text-muted)',
                  padding: '5px 12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  boxShadow: matrixViewMode === 'teachers' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {t('qualitativeViewTeachers')}
              </button>
            </div>

            <button
              onClick={handleExportMatrixSVG}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              {t('analyticsExportSingleBtn')}
            </button>
          </div>
        </div>

        {/* Matrix Table */}
        <div
          style={{
            overflowX: 'auto',
            border: '1px solid var(--card-border)',
            borderRadius: 'var(--radius-sm)',
            backgroundColor: '#FFFFFF',
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12.5px',
              whiteSpace: 'nowrap',
            }}
          >
            <thead>
              <tr style={{ backgroundColor: 'var(--bg)' }}>
                <th
                  style={{
                    border: '1px solid var(--card-border-soft)',
                    padding: '8px 12px',
                    textAlign: 'left',
                    minWidth: '280px',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: 'var(--bg)',
                    zIndex: 20,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('qualitativeColDimension')}
                </th>
                <th
                  style={{
                    border: '1px solid var(--card-border-soft)',
                    padding: '8px 12px',
                    textAlign: 'left',
                    minWidth: '200px',
                    position: 'sticky',
                    left: '280px',
                    backgroundColor: 'var(--bg)',
                    zIndex: 20,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                  }}
                >
                  {t('qualitativeColFrameworkSection')}
                </th>
                {matrixColumns.map((col) => (
                  <th
                    key={col}
                    style={{
                      border: '1px solid var(--card-border-soft)',
                      padding: '8px 6px',
                      textAlign: 'center',
                      minWidth: matrixViewMode === 'lessons' ? '38px' : '58px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {col}
                  </th>
                ))}
                <th
                  style={{
                    border: '1px solid var(--card-border-soft)',
                    padding: '8px 12px',
                    textAlign: 'center',
                    minWidth: '110px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    backgroundColor: 'var(--bg)',
                  }}
                >
                  Breadth
                </th>
              </tr>
            </thead>
            <tbody>
              {data?.coverage_matrix.map((row, rIdx) => {
                const isEven = rIdx % 2 === 0;
                const rowBg = isEven ? '#FFFFFF' : '#FAF8F5';
                const cells = matrixViewMode === 'lessons' ? row.lesson_cells : row.teacher_cells;
                const breadth = matrixViewMode === 'lessons' ? row.breadth_lessons : row.breadth_teachers;
                const total = matrixViewMode === 'lessons' ? row.total_lessons : row.total_teachers;
                const pct = total > 0 ? Math.round((breadth / total) * 100) : 0;

                return (
                  <tr key={row.pattern_id || rIdx} style={{ backgroundColor: rowBg }}>
                    {/* Dimension Name (Clickable) */}
                    <td
                      onClick={() =>
                        handleOpenCodeDrawer(row.code, row.description, row.category, row.theme, row.evidence)
                      }
                      title={t('qualitativeClickToInspect')}
                      style={{
                        border: '1px solid var(--card-border-soft)',
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--accent)',
                        position: 'sticky',
                        left: 0,
                        backgroundColor: rowBg,
                        zIndex: 10,
                        cursor: 'pointer',
                        maxWidth: '280px',
                        whiteSpace: 'normal',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span>{row.description || row.code}</span>
                        <ExternalLink size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
                      </span>
                    </td>

                    {/* Framework Section */}
                    <td
                      style={{
                        border: '1px solid var(--card-border-soft)',
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '11.5px',
                        color: 'var(--text-muted)',
                        position: 'sticky',
                        left: '280px',
                        backgroundColor: rowBg,
                        zIndex: 10,
                      }}
                    >
                      {row.category}
                    </td>

                    {/* Presence Dots */}
                    {matrixColumns.map((col) => {
                      const cell = cells.find((c) => c.key.toLowerCase() === col.toLowerCase());
                      const isPresent = cell ? cell.present : false;

                      return (
                        <td
                          key={col}
                          style={{
                            border: '1px solid var(--card-border-soft)',
                            padding: '6px 4px',
                            textAlign: 'center',
                          }}
                        >
                          {isPresent && (
                            <span
                              onClick={() =>
                                handleOpenCodeDrawer(row.code, row.description, row.category, row.theme, row.evidence)
                              }
                              title={`${col}: ${row.code} (${language === 'vi' ? 'Có bằng chứng xuất hiện' : 'Evidence Present'})`}
                              style={{
                                display: 'inline-block',
                                width: '9px',
                                height: '9px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent)',
                                cursor: 'pointer',
                                transition: 'transform 0.1s ease',
                              }}
                            />
                          )}
                        </td>
                      );
                    })}

                    {/* Breadth Summary */}
                    <td
                      style={{
                        border: '1px solid var(--card-border-soft)',
                        padding: '8px 12px',
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 700,
                        color: 'var(--accent)',
                        fontSize: '11.5px',
                        backgroundColor: rowBg,
                      }}
                    >
                      {breadth} / {total} ({pct}%)
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            color: 'var(--text-muted)',
            marginTop: '2px',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span>{t('qualitativeMatrixLegend')}</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {t('qualitativeMethodStandard')}
          </span>
        </div>
      </section>

      {/* ============================================================
           SECTION 2: THEME – CATEGORY – CODE HIERARCHY MAP
           ============================================================ */}
      <section
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid var(--card-border-soft)',
            paddingBottom: '14px',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                color: 'var(--accent)',
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 4px 0',
              }}
            >
              <GitFork size={20} />
              {t('qualitativeHierarchyTitle')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              {t('qualitativeHierarchySubtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {data?.thematic_hierarchy && data.thematic_hierarchy.length > 0 && (
              <div
                style={{
                  display: 'inline-flex',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--card-border)',
                  borderRadius: '6px',
                  padding: '2px',
                  gap: '2px',
                }}
              >
                <button
                  onClick={() => setHierarchyViewMode('tree')}
                  style={{
                    border: 'none',
                    backgroundColor: hierarchyViewMode === 'tree' ? 'var(--card-bg)' : 'transparent',
                    color: hierarchyViewMode === 'tree' ? 'var(--accent)' : 'var(--text-muted)',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: hierarchyViewMode === 'tree' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Tree View (SVG)
                </button>
                <button
                  onClick={() => setHierarchyViewMode('bento')}
                  style={{
                    border: 'none',
                    backgroundColor: hierarchyViewMode === 'bento' ? 'var(--card-bg)' : 'transparent',
                    color: hierarchyViewMode === 'bento' ? 'var(--accent)' : 'var(--text-muted)',
                    padding: '5px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '4px',
                    cursor: 'pointer',
                    boxShadow: hierarchyViewMode === 'bento' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  Bento Cards
                </button>
              </div>
            )}

            <button
              onClick={handleExportHierarchySVG}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              {t('analyticsExportSingleBtn')}
            </button>
          </div>
        </div>

        {/* Figure 4.2 Content: Pending placeholder when themes are not finalized yet */}
        {(!data?.thematic_hierarchy || data.thematic_hierarchy.length === 0) ? (
          <div
            style={{
              padding: '40px 24px',
              border: '1.5px dashed var(--card-border)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: 'var(--bg)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                backgroundColor: 'rgba(158, 74, 40, 0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent)',
              }}
            >
              <GitFork size={26} />
            </div>

            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '999px',
                backgroundColor: '#F4EFE6',
                color: 'var(--accent)',
                fontSize: '11.5px',
                fontWeight: 700,
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
              }}
            >
              <Clock size={13} />
              {t('qualitativeHierarchyPendingBadge')}
            </div>

            <h3
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '20px',
                color: 'var(--text-main)',
                fontWeight: 600,
                margin: '6px 0 0 0',
              }}
            >
              {t('qualitativeHierarchyPendingTitle')}
            </h3>

            <p
              style={{
                fontSize: '13px',
                color: 'var(--text-muted)',
                maxWidth: '720px',
                lineHeight: 1.55,
                margin: 0,
              }}
            >
              {t('qualitativeHierarchyPendingDesc')}
            </p>

            <div
              style={{
                marginTop: '12px',
                padding: '8px 14px',
                backgroundColor: '#FFFFFF',
                borderRadius: '6px',
                border: '1px solid var(--card-border-soft)',
                fontSize: '11.5px',
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-muted)',
              }}
            >
              Lincoln &amp; Guba (1985) Audit Trail Dependability Framework • Observation Studio Qualitative Engine
            </div>
          </div>
        ) : (
          hierarchyViewMode === 'tree' ? (
            <div
              style={{
                overflowX: 'auto',
                border: '1px solid var(--card-border-soft)',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: '#FCFAF8',
                padding: '16px',
              }}
            >
              <svg style={{ width: '100%', minWidth: '1100px', height: '480px' }} viewBox="0 0 1380 480">
                {/* Column Headers */}
                <text x="60" y="30" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#736B63" letterSpacing="0.5">
                  {language === 'vi' ? 'CHỦ ĐỀ BAO QUÁT (CHƯƠNG 4)' : 'OVERARCHING THEMES (CHAPTER 4)'}
                </text>
                <text x="440" y="30" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#736B63" letterSpacing="0.5">
                  {language === 'vi' ? 'CỤM HÀNH VI (CATEGORIES)' : 'PEDAGOGICAL CATEGORIES'}
                </text>
                <text x="810" y="30" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#736B63" letterSpacing="0.5">
                  {language === 'vi' ? 'MÃ & MẪU QUAN SÁT (CODES)' : 'INITIAL CODES & PATTERNS'}
                </text>
                <text x="1130" y="30" fontFamily="Plus Jakarta Sans" fontSize="12" fontWeight="700" fill="#736B63" letterSpacing="0.5">
                  {language === 'vi' ? 'TRÍCH DẪN MINH HỌA TIÊU BIỂU' : 'KEY EXCERPT SAMPLES'}
                </text>

                <line x1="390" y1="20" x2="390" y2="460" stroke="#E8E3D9" strokeDasharray="4 4" />
                <line x1="760" y1="20" x2="760" y2="460" stroke="#E8E3D9" strokeDasharray="4 4" />
                <line x1="1080" y1="20" x2="1080" y2="460" stroke="#E8E3D9" strokeDasharray="4 4" />

                {/* Theme 1 */}
                <rect x="50" y="60" width="300" height="175" rx="8" fill="#FFFFFF" stroke="#9E4A28" strokeWidth="2" />
                <text x="68" y="92" fontFamily="Instrument Serif" fontSize="20" fill="#9E4A28">
                  {language === 'vi' ? 'Chủ Đề 1: Khung Giàn Giáo' : 'Theme 1: Multimodal Scaffolding'}
                </text>
                {language === 'vi' ? (
                  <>
                    <text x="68" y="112" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      Duy trì vùng phát triển gần nhất (ZPD)
                    </text>
                    <text x="68" y="128" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      qua kết hợp hình ảnh và tín hiệu số
                    </text>
                  </>
                ) : (
                  <>
                    <text x="68" y="112" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      Sustaining Zone of Proximal Development
                    </text>
                    <text x="68" y="128" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      via visual anchors &amp; digital cues
                    </text>
                  </>
                )}
                <rect x="68" y="142" width="84" height="20" rx="4" fill="#EAF4EE" />
                <text x="76" y="156" fontFamily="Plus Jakarta Sans" fontSize="10" fontWeight="700" fill="#2D6A4F">
                  CONFIRMED
                </text>

                <path d="M 350 110 C 400 110, 400 95, 430 95" fill="none" stroke="#9E4A28" strokeWidth="1.8" />
                <path d="M 350 185 C 400 185, 400 190, 430 190" fill="none" stroke="#9E4A28" strokeWidth="1.8" />

                {/* Cat 1.1 */}
                <rect x="430" y="65" width="280" height="60" rx="6" fill="#FFFFFF" stroke="#E8E3D9" strokeWidth="1.5" />
                <text x="446" y="90" fontFamily="Plus Jakarta Sans" fontSize="13" fontWeight="700" fill="#1A1612">
                  {language === 'vi' ? 'Cụm A: Neo Hình Ảnh Chỉ Dẫn' : 'Cat A: Visual-Graphic Anchor'}
                </text>
                <text x="446" y="108" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                  {language === 'vi' ? 'Neo hình ảnh giảm tải nhận thức từ vựng' : 'Visual anchors reduce cognitive load'}
                </text>

                {/* Cat 1.2 */}
                <rect x="430" y="160" width="280" height="60" rx="6" fill="#FFFFFF" stroke="#E8E3D9" strokeWidth="1.5" />
                <text x="446" y="185" fontFamily="Plus Jakarta Sans" fontSize="13" fontWeight="700" fill="#1A1612">
                  {language === 'vi' ? 'Cụm B: Tín Hiệu Phản Hồi Số' : 'Cat B: Digital Reaction Signaling'}
                </text>
                <text x="446" y="203" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                  {language === 'vi' ? 'Phản hồi qua icon & thumbs-up chat' : 'Non-verbal feedback via chat & icons'}
                </text>

                {/* Codes */}
                <path d="M 710 95 C 750 95, 760 80, 800 80" fill="none" stroke="#C4B5A5" strokeWidth="1.5" />
                <path d="M 710 95 C 750 95, 760 120, 800 120" fill="none" stroke="#C4B5A5" strokeWidth="1.5" />
                <path d="M 710 190 L 800 190" fill="none" stroke="#C4B5A5" strokeWidth="1.5" />

                <rect x="800" y="65" width="240" height="30" rx="4" fill="#FFFFFF" stroke="#E8E3D9" />
                <text x="814" y="85" fontFamily="JetBrains Mono" fontSize="11" fontWeight="600" fill="#9E4A28">
                  VSC-01: Pointing Gestures
                </text>

                <rect x="800" y="105" width="240" height="30" rx="4" fill="#FFFFFF" stroke="#E8E3D9" />
                <text x="814" y="125" fontFamily="JetBrains Mono" fontSize="11" fontWeight="600" fill="#9E4A28">
                  VSC-02: Graphic Organizers
                </text>

                <rect x="800" y="175" width="240" height="30" rx="4" fill="#FFFFFF" stroke="#E8E3D9" />
                <text x="814" y="195" fontFamily="JetBrains Mono" fontSize="11" fontWeight="600" fill="#9E4A28">
                  DRS-01: Emoji Hand Raise
                </text>

                {/* Sample Excerpts */}
                <path d="M 1040 80 L 1090 80" fill="none" stroke="#E8E3D9" strokeWidth="1" />
                <rect x="1090" y="60" width="260" height="40" rx="4" fill="#FBF9F5" stroke="#E8E3D9" />
                <text x="1102" y="76" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="#1D5C8A">
                  [14:12] T02-L1
                </text>
                <text x="1102" y="90" fontFamily="Plus Jakarta Sans" fontSize="11" fontStyle="italic" fill="#57534E">
                  &ldquo;Look at the red circle, what animal is here?&rdquo;
                </text>

                <path d="M 1040 120 L 1090 120" fill="none" stroke="#E8E3D9" strokeWidth="1" />
                <rect x="1090" y="105" width="260" height="40" rx="4" fill="#FBF9F5" stroke="#E8E3D9" />
                <text x="1102" y="121" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="#1D5C8A">
                  [22:45] T07-L2
                </text>
                <text x="1102" y="135" fontFamily="Plus Jakarta Sans" fontSize="11" fontStyle="italic" fill="#57534E">
                  &ldquo;Compare box A and box B before answering&rdquo;
                </text>

                <path d="M 1040 190 L 1090 190" fill="none" stroke="#E8E3D9" strokeWidth="1" />
                <rect x="1090" y="170" width="260" height="40" rx="4" fill="#FBF9F5" stroke="#E8E3D9" />
                <text x="1102" y="186" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="#1D5C8A">
                  [08:30] T11-L1
                </text>
                <text x="1102" y="200" fontFamily="Plus Jakarta Sans" fontSize="11" fontStyle="italic" fill="#57534E">
                  &ldquo;Drop a clapping hands icon if you agree!&rdquo;
                </text>

                {/* Theme 2 */}
                <rect x="50" y="270" width="300" height="175" rx="8" fill="#FFFFFF" stroke="#9E4A28" strokeWidth="2" />
                <text x="68" y="302" fontFamily="Instrument Serif" fontSize="20" fill="#9E4A28">
                  {language === 'vi' ? 'Chủ Đề 2: Nhịp Độ & An Toàn' : 'Theme 2: Pacing & Safe-Failure'}
                </text>
                {language === 'vi' ? (
                  <>
                    <text x="68" y="322" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      Chiến lược kéo dài thời gian chờ đợi và
                    </text>
                    <text x="68" y="338" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      khen ngợi nỗ lực xây dựng sự tự tin
                    </text>
                  </>
                ) : (
                  <>
                    <text x="68" y="322" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      Deliberate wait-time buffers &amp; effort praise
                    </text>
                    <text x="68" y="338" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                      building communicative confidence
                    </text>
                  </>
                )}
                <rect x="68" y="352" width="84" height="20" rx="4" fill="#EAF4EE" />
                <text x="76" y="366" fontFamily="Plus Jakarta Sans" fontSize="10" fontWeight="700" fill="#2D6A4F">
                  CONFIRMED
                </text>

                <path d="M 350 340 L 430 340" fill="none" stroke="#9E4A28" strokeWidth="1.8" />
                <rect x="430" y="310" width="280" height="60" rx="6" fill="#FFFFFF" stroke="#E8E3D9" strokeWidth="1.5" />
                <text x="446" y="335" fontFamily="Plus Jakarta Sans" fontSize="13" fontWeight="700" fill="#1A1612">
                  {language === 'vi' ? 'Cụm C: Đệm Thời Gian Chờ Kéo Dài' : 'Cat C: Extended Wait-Time Buffer'}
                </text>
                <text x="446" y="353" fontFamily="Plus Jakarta Sans" fontSize="11" fill="#736B63">
                  {language === 'vi' ? 'Khoảng lặng 3–5s cho HS suy nghĩ' : '3–5s quiet contemplation window'}
                </text>

                <path d="M 710 340 L 800 340" fill="none" stroke="#C4B5A5" strokeWidth="1.5" />
                <rect x="800" y="325" width="240" height="30" rx="4" fill="#FFFFFF" stroke="#E8E3D9" />
                <text x="814" y="345" fontFamily="JetBrains Mono" fontSize="11" fontWeight="600" fill="#9E4A28">
                  PAC-01: Silent Thinking Window
                </text>

                <path d="M 1040 340 L 1090 340" fill="none" stroke="#E8E3D9" strokeWidth="1" />
                <rect x="1090" y="320" width="260" height="40" rx="4" fill="#FBF9F5" stroke="#E8E3D9" />
                <text x="1102" y="336" fontFamily="JetBrains Mono" fontSize="10" fontWeight="700" fill="#1D5C8A">
                  [19:05] T04-L2
                </text>
                <text x="1102" y="350" fontFamily="Plus Jakarta Sans" fontSize="11" fontStyle="italic" fill="#57534E">
                  &ldquo;Take 5 seconds quietly... no rush, Nam.&rdquo;
                </text>
              </svg>
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
              }}
            >
              {data?.thematic_hierarchy.map((th) => (
                <div
                  key={th.id}
                  style={{
                    border: '1px solid var(--card-border)',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: '#FFFFFF',
                    padding: '20px',
                    boxShadow: 'var(--shadow-sm)',
                    borderTop: '4px solid var(--accent)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <h3
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '20px',
                        color: 'var(--accent)',
                        margin: 0,
                        fontWeight: 400,
                        lineHeight: 1.25,
                      }}
                    >
                      {(language === 'vi' && th.name_vi) ? th.name_vi : th.name}
                    </h3>
                    <span
                      style={{
                        fontSize: '10px',
                        textTransform: 'uppercase',
                        fontWeight: 700,
                        letterSpacing: '0.5px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--accent-green-soft)',
                        color: 'var(--accent-green)',
                      }}
                    >
                      {th.status}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-muted)',
                      fontStyle: 'italic',
                      backgroundColor: 'var(--bg)',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      borderLeft: '2px solid var(--accent)',
                      lineHeight: 1.45,
                    }}
                  >
                    {(language === 'vi' && th.reasoning_trace_vi)
                      ? th.reasoning_trace_vi
                      : ((language === 'vi' && th.description_vi)
                        ? th.description_vi
                        : (th.reasoning_trace || th.description))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {th.categories.map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          border: '1px solid var(--card-border-soft)',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          backgroundColor: '#FAFAFA',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: '12.5px',
                            color: 'var(--text-main)',
                            marginBottom: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{(language === 'vi' && cat.name_vi) ? cat.name_vi : cat.name}</span>
                          <span style={{ fontSize: '11px', fontWeight: 'normal', color: 'var(--text-muted)' }}>
                            ({cat.codes.length} {t('qualitativePatternsCount')})
                          </span>
                        </div>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                          {cat.codes.map((cd) => (
                            <button
                              key={cd.id}
                              onClick={() =>
                                handleOpenCodeDrawer(
                                  cd.code,
                                  cd.name,
                                  (language === 'vi' && cat.name_vi) ? cat.name_vi : cat.name,
                                  (language === 'vi' && th.name_vi) ? th.name_vi : th.name,
                                  cd.sample_quotes
                                )
                              }
                              style={{
                                background: '#FFFFFF',
                                border: '1px solid var(--card-border)',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontFamily: 'var(--font-mono)',
                                fontSize: '11px',
                                color: 'var(--accent)',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <span>{cd.name}</span>
                              <ExternalLink size={10} />
                            </button>
                          ))}
                        </div>

                        {cat.codes[0]?.sample_quotes && cat.codes[0].sample_quotes[0] && (
                          <div
                            style={{
                              fontSize: '11.5px',
                              color: 'var(--text-muted)',
                              fontStyle: 'italic',
                              paddingLeft: '8px',
                              borderLeft: '2px solid var(--card-border)',
                              lineHeight: 1.4,
                            }}
                          >
                            <strong>[{cat.codes[0].sample_quotes[0].timestamp_str}] {cat.codes[0].sample_quotes[0].lesson}:</strong>{' '}
                            &ldquo;{cat.codes[0].sample_quotes[0].quote}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      {/* ============================================================
           SECTION 3: RQ1 ENROLMENT & TRACEABILITY MAP
           ============================================================ */}
      <section
        style={{
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--radius-md)',
          padding: '24px',
          boxShadow: 'var(--shadow-sm)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            borderBottom: '1px solid var(--card-border-soft)',
            paddingBottom: '14px',
            gap: '16px',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2
              style={{
                fontFamily: 'var(--font-serif)',
                fontSize: '24px',
                color: 'var(--accent)',
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 0 4px 0',
              }}
            >
              <Target size={20} />
              {t('qualitativeRQ1Title')}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>
              {t('qualitativeRQ1Subtitle')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600 }}>
              {t('qualitativeFilterStrategy')}
            </span>
            <select
              value={rqFilter}
              onChange={(e) => setRqFilter(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <option value="all">{t('qualitativeAllStrategies')}</option>
              <option value="rules">{language === 'vi' ? 'Thiết lập quy tắc & nền nếp' : 'Establishing Rules & Routines'}</option>
              <option value="turn">{language === 'vi' ? 'Quản lý lượt nói & phát biểu' : 'Turn-Taking & Speaking Participation'}</option>
              <option value="attention">{language === 'vi' ? 'Duy trì sự chú ý & tương tác' : 'Attention & Engagement'}</option>
              <option value="scaffolding">{language === 'vi' ? 'Hỗ trợ sư phạm & khích lệ' : 'Scaffolding & Positive Reinforcement'}</option>
              <option value="tools">{language === 'vi' ? 'Sử dụng công cụ kỹ thuật số' : 'Digital Tools & Interaction'}</option>
            </select>

            <button
              onClick={handleExportRQ1SVG}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '5px 10px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                border: '1px solid var(--card-border)',
                backgroundColor: 'var(--card-bg)',
                color: 'var(--text-main)',
                cursor: 'pointer',
              }}
            >
              <Download size={13} />
              {t('analyticsExportSingleBtn')}
            </button>
          </div>
        </div>

        {/* 5-Column RQ1 Evidence Map Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Header Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '220px 200px 1fr 150px 1fr',
              padding: '10px 16px',
              backgroundColor: 'var(--bg)',
              border: '1px solid var(--card-border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '11px',
              fontWeight: 700,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              gap: '12px',
            }}
          >
            <div>{t('qualitativeColRQ1Dimension')}</div>
            <div>{t('qualitativeColRQ1Pattern')}</div>
            <div>{t('qualitativeColRQ1Enactment')}</div>
            <div>{t('qualitativeColRQ1Lessons')}</div>
            <div>{t('qualitativeColRQ1TimestampContext')}</div>
          </div>

          {/* Rows */}
          {filteredRQ1Rows.map((row, idx) => {
            const dimName = (language === 'vi' && row.dimension_vi)
              ? row.dimension_vi
              : (row.dimension || row.strategy_subtext || '');
            const patName = (language === 'vi' && row.recurring_pattern_vi)
              ? row.recurring_pattern_vi
              : (row.recurring_pattern || row.strategy_name || '');
            const enactText = (language === 'vi' && row.observed_enactment_vi)
              ? row.observed_enactment_vi
              : (row.observed_enactment || (row.observed_enactments && row.observed_enactments[0]) || '');

            return (
              <div
                key={idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 200px 1fr 150px 1fr',
                  border: '1px solid var(--card-border)',
                  borderRadius: 'var(--radius-sm)',
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF',
                  boxShadow: 'var(--shadow-sm)',
                  gap: '12px',
                }}
              >
                {/* Col 1: Analytical Dimension */}
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg)',
                    borderRight: '1px solid var(--card-border-soft)',
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--accent)', lineHeight: 1.4 }}>
                    {dimName}
                  </div>
                </div>

                {/* Col 2: Recurring Pattern */}
                <div
                  style={{
                    padding: '16px',
                    borderRight: '1px solid var(--card-border-soft)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '12.5px', color: 'var(--text-main)', lineHeight: 1.4 }}>
                    {patName}
                  </div>
                </div>

                {/* Col 3: Observed Enactment */}
                <div style={{ padding: '16px', borderRight: '1px solid var(--card-border-soft)', fontSize: '12px', color: '#44403C', lineHeight: 1.5 }}>
                  {enactText}
                </div>

                {/* Col 4: Representative Lessons */}
                <div style={{ padding: '16px', borderRight: '1px solid var(--card-border-soft)' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {row.representative_lessons.map((ls) => (
                      <span
                        key={ls}
                        style={{
                          backgroundColor: 'var(--bg)',
                          border: '1px solid var(--card-border)',
                          borderRadius: '4px',
                          padding: '2px 6px',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '11px',
                          color: 'var(--text-main)',
                        }}
                      >
                        {ls}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Col 5: Direct Quotes & Timestamps */}
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {row.direct_quotes.map((q, qIdx) => (
                    <div
                      key={qIdx}
                      style={{
                        backgroundColor: 'var(--bg)',
                        borderRadius: '6px',
                        padding: '8px 12px',
                        borderLeft: '3px solid var(--accent)',
                        fontSize: '11.5px',
                      }}
                    >
                      <div style={{ marginBottom: '2px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--accent-blue)',
                            marginRight: '6px',
                          }}
                        >
                          [{q.timestamp_str}] {q.lesson}:
                        </span>
                      </div>
                      <div style={{ fontStyle: 'italic', color: 'var(--text-main)', lineHeight: 1.4 }}>
                        &ldquo;{q.quote}&rdquo;
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Code Evidence Slideover Drawer */}
      <CodeEvidenceDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        codeTitle={activeCodeDrawer?.code || ''}
        codeDescription={activeCodeDrawer?.description || ''}
        category={activeCodeDrawer?.category}
        theme={activeCodeDrawer?.theme}
        evidence={activeCodeDrawer?.evidence || []}
      />
    </div>
  );
}
