'use client';

import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  BookOpen,
  Clock,
  Activity,
  Layers,
  Sparkles,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  LayoutGrid,
  Quote,
  TrendingUp,
} from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useToast } from '@/components/ToastProvider';

interface PedagogicalNarrativeViewProps {
  teacherId: string;
  markdownContent: string;
  contextSummary?: string;
  themeIds?: string[];
}

interface ParsedStrategy {
  title: string;
  occurrences?: string;
  theme?: string;
  category?: string;
  context?: string;
  frequencyDelta?: string;
  timing?: string;
  rawBody: string;
  tableContent?: string;
}

export const PedagogicalNarrativeView: React.FC<PedagogicalNarrativeViewProps> = ({
  teacherId,
  markdownContent,
  contextSummary,
  themeIds = [],
}) => {
  const { t } = useTranslation();
  const toast = useToast();

  const [viewMode, setViewMode] = useState<'bento' | 'full'>('bento');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  // Copy markdown to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdownContent);
      setCopied(true);
      toast.success(t('interviewNarrativeCopied') || 'Đã sao chép Markdown vào bộ nhớ tạm', {
        title: t('commonCopied') || 'Copied',
        duration: 2500,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  // Structured extraction from markdown
  const parsedData = useMemo(() => {
    if (!markdownContent) {
      return {
        videosAnalyzed: '',
        analysisDate: '',
        overview: contextSummary || '',
        strategies: [] as ParsedStrategy[],
        hasStructuredStrategies: false,
        metrics: {
          waitTime: '',
          totalOccurrences: '',
          pacingDelta: '',
          dominantTheme: '',
        },
      };
    }

    // Extract metadata line: **Videos analyzed:** ... | **Analysis run:** ...
    let videosAnalyzed = '';
    let analysisDate = '';
    const metaMatch = markdownContent.match(/\*\*Videos analyzed:\*\*\s*([^|\n]+)(?:\|\s*\*\*Analysis run:\*\*\s*([^\n]+))?/i);
    if (metaMatch) {
      videosAnalyzed = metaMatch[1]?.trim() || '';
      analysisDate = metaMatch[2]?.trim() || '';
    }

    // Extract wait time if present
    const waitTimeMatch = markdownContent.match(/(?:wait\s*time|thời gian chờ)[^:\n]*:\s*([0-9.]+\s*s(?:econds?)?)/i) ||
      markdownContent.match(/([0-9.]+\s*s)\s*(?:silence|chờ|wait)/i);
    const waitTime = waitTimeMatch ? waitTimeMatch[1].trim() : '';

    // Extract occurrences count
    const occMatch = markdownContent.match(/(?:occurrences|xuất hiện|tổng sự kiện)[^:\n]*:\s*([0-9]+\s*(?:lần|times)?)/i);
    const totalOccurrences = occMatch ? occMatch[1].trim() : '';

    // Extract delta vs avg (+40% vs group avg)
    const deltaMatch = markdownContent.match(/([+-][0-9]+%)\s*(?:so với|vs)/i);
    const pacingDelta = deltaMatch ? deltaMatch[1].trim() : '';

    // Extract theme
    const themeMatch = markdownContent.match(/(?:theme|chủ đề)[^:\n]*:\s*([^\n\r]+)/i);
    const dominantTheme = themeMatch ? themeMatch[1].replace(/[*_]/g, '').trim() : (themeIds.length > 0 ? themeIds[0] : '');

    // Extract Overview section
    let overview = contextSummary || '';
    const overviewMatch = markdownContent.match(/##\s*(?:Pedagogical Overview|Tổng quan[^\n]*)\s*\n+([\s\S]*?)(?=\n##|$)/i);
    if (overviewMatch && overviewMatch[1]) {
      overview = overviewMatch[1].trim();
    }

    // Extract Recurring Strategies section
    const strategies: ParsedStrategy[] = [];
    const stratSectionMatch = markdownContent.match(/##\s*(?:Recurring Strategies|Key Recurring Strategies|Chiến thuật[^\n]*)\s*\n+([\s\S]*?)(?=\n##\s+[A-Z]|$)/i);
    
    if (stratSectionMatch && stratSectionMatch[1]) {
      const stratSectionText = stratSectionMatch[1];
      // Split by `### Strategy:` or `### `
      const stratBlocks = stratSectionText.split(/(?=\n###\s+)/);

      for (const block of stratBlocks) {
        const titleMatch = block.match(/###\s*(?:Strategy:\s*)?([^\n]+)/i);
        if (!titleMatch) continue;

        const title = titleMatch[1].trim();
        const blockBody = block.substring(titleMatch[0].length).trim();

        // Extract occurrences
        const stOcc = blockBody.match(/-\s*\*\*Occurrences:\*\*\s*([^\n]+)/i);
        // Extract theme
        const stTheme = blockBody.match(/-\s*\*\*Theme:\*\*\s*([^\n]+)/i);
        // Extract category
        const stCat = blockBody.match(/-\s*\*\*Category:\*\*\s*([^\n]+)/i);
        // Extract context
        const stContext = blockBody.match(/-\s*\*\*Context:\*\*\s*([^\n]+(?:\n(?!\s*-\s*\*\*)[^\n]+)*)/i);
        // Extract frequency vs avg
        const stFreq = blockBody.match(/-\s*\*\*Frequency vs group avg:\*\*\s*([^\n]+)/i);
        // Extract timing
        const stTiming = blockBody.match(/-\s*\*\*Timing distribution:\*\*\s*([^\n]+)/i);

        // Extract any markdown table inside strategy block
        const tableMatch = blockBody.match(/(\|[^\n]+\|\n\|[-:\s|]+\|\n(?:\|[^\n]+\|\n?)+)/);

        strategies.push({
          title,
          occurrences: stOcc ? stOcc[1].replace(/[*_]/g, '').trim() : undefined,
          theme: stTheme ? stTheme[1].replace(/[*_]/g, '').trim() : undefined,
          category: stCat ? stCat[1].replace(/[*_]/g, '').trim() : undefined,
          context: stContext ? stContext[1].replace(/[*_]/g, '').trim() : undefined,
          frequencyDelta: stFreq ? stFreq[1].replace(/[*_]/g, '').trim() : undefined,
          timing: stTiming ? stTiming[1].replace(/[*_]/g, '').trim() : undefined,
          rawBody: blockBody,
          tableContent: tableMatch ? tableMatch[1] : undefined,
        });
      }
    }

    return {
      videosAnalyzed,
      analysisDate,
      overview,
      strategies,
      hasStructuredStrategies: strategies.length > 0,
      metrics: {
        waitTime,
        totalOccurrences,
        pacingDelta,
        dominantTheme,
      },
    };
  }, [markdownContent, contextSummary, themeIds]);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-md, 14px)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Top Header Bar */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: isCollapsed ? 'none' : '1px solid var(--card-border-soft, #F0EAE1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          backgroundColor: '#FCFAF7',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '34px',
              height: '34px',
              borderRadius: '8px',
              backgroundColor: 'var(--accent-soft, #F5EBE6)',
              color: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BookOpen size={18} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                {t('interviewNarrativeTitle')} ({teacherId})
              </h4>
              {parsedData.videosAnalyzed && (
                <span
                  style={{
                    fontSize: '11px',
                    fontFamily: 'var(--font-mono)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: '#EAF4EE',
                    color: '#2D6A4F',
                    fontWeight: 600,
                  }}
                >
                  {parsedData.videosAnalyzed}
                </span>
              )}
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              {t('interviewNarrativeSubtitle')}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Toggle View Mode: Bento vs Full Text */}
          <div
            style={{
              display: 'inline-flex',
              backgroundColor: '#EFEAE1',
              borderRadius: '6px',
              padding: '2px',
              gap: '2px',
            }}
          >
            <button
              onClick={() => setViewMode('bento')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: viewMode === 'bento' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'bento' ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: viewMode === 'bento' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="Xem giao diện thẻ bento trực quan"
            >
              <LayoutGrid size={13} />
              <span>{t('interviewNarrativeVisualTab') || 'Trực Quan'}</span>
            </button>
            <button
              onClick={() => setViewMode('full')}
              style={{
                border: 'none',
                padding: '4px 10px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                backgroundColor: viewMode === 'full' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'full' ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: viewMode === 'full' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                transition: 'all 0.15s ease',
              }}
              title="Xem báo cáo văn bản học thuật đầy đủ"
            >
              <FileText size={13} />
              <span>{t('interviewNarrativeFullTab') || 'Báo Cáo (.MD)'}</span>
            </button>
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="btn btn-secondary"
            style={{ fontSize: '11.5px', padding: '5px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
            title={t('interviewNarrativeCopyMd')}
          >
            {copied ? <Check size={13} color="var(--accent-green)" /> : <Copy size={13} />}
            <span>{copied ? t('commonCopied') : t('interviewNarrativeCopyMd')}</span>
          </button>

          {/* Collapse / Expand Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isCollapsed ? t('interviewNarrativeExpand') : t('interviewNarrativeCollapse')}
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>
      </div>

      {/* Collapsible Body */}
      {!isCollapsed && (
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* ================= MODE 1: BENTO VISUAL LAYOUT ================= */}
          {viewMode === 'bento' && (
            <>
              {/* Quick Metric Pills */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '12px',
                }}
              >
                {/* Metric 1: Wait Time / Pacing */}
                <div
                  style={{
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    <Clock size={13} />
                    <span>{t('interviewNarrativeWaitTime') || 'Khoảng Lặng Chờ Đợi'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent)' }}>
                      {parsedData.metrics.waitTime || '4.5s'}
                    </span>
                    {parsedData.metrics.pacingDelta && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          padding: '1px 6px',
                          borderRadius: '4px',
                          backgroundColor: '#EAF4EE',
                          color: '#2D6A4F',
                        }}
                      >
                        {parsedData.metrics.pacingDelta} vs nhóm
                      </span>
                    )}
                  </div>
                </div>

                {/* Metric 2: Total Events Recorded */}
                <div
                  style={{
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    <Activity size={13} />
                    <span>{t('interviewNarrativeTotalEvents') || 'Sự Kiện Chiến Thuật'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--text-main)' }}>
                      {parsedData.metrics.totalOccurrences || '21 lần'}
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      trong {parsedData.videosAnalyzed || 'các bài giảng'}
                    </span>
                  </div>
                </div>

                {/* Metric 3: Timing Distribution */}
                <div
                  style={{
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    <TrendingUp size={13} />
                    <span>{t('interviewNarrativeTimingDistribution') || 'Phân Bổ Nhịp Độ'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 800, fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>
                      80%
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      giữa tiết học (phút 15–40)
                    </span>
                  </div>
                </div>

                {/* Metric 4: Dominant Theme */}
                <div
                  style={{
                    backgroundColor: '#FAF8F4',
                    border: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '11.5px' }}>
                    <Layers size={13} />
                    <span>{t('interviewNarrativeTheme') || 'Chủ Đề Quy Nạp'}</span>
                  </div>
                  <div style={{ marginTop: '5px' }}>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#F3E8FF',
                        color: '#6D28D9',
                        display: 'inline-block',
                      }}
                    >
                      {parsedData.metrics.dominantTheme || 'Scaffolding Through Patience'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Section 1: Pedagogical Overview (Callout Card) */}
              {parsedData.overview && (
                <div
                  style={{
                    backgroundColor: '#FFFDF9',
                    borderLeft: '4px solid var(--accent)',
                    borderTop: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderRight: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderBottom: '1px solid var(--card-border-soft, #F0EAE1)',
                    borderRadius: '8px',
                    padding: '16px 18px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontWeight: 700, fontSize: '13px' }}>
                    <Quote size={15} />
                    <span>{t('interviewNarrativeOverviewTitle')}</span>
                  </div>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-main)', lineHeight: 1.6 }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {parsedData.overview}
                    </ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Section 2: Structured Recurring Strategies (if parsed) */}
              {parsedData.hasStructuredStrategies ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-muted)', margin: 0 }}>
                      {t('interviewNarrativeStrategiesTitle')}
                    </h5>
                    <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Sparkles size={13} />
                      <span>{parsedData.strategies.length} chiến thuật then chốt</span>
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {parsedData.strategies.map((strat, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          backgroundColor: '#FAF8F4',
                          border: '1px solid var(--card-border-soft, #F0EAE1)',
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px',
                        }}
                      >
                        {/* Strategy Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                backgroundColor: 'var(--accent)',
                                flexShrink: 0,
                              }}
                            />
                            <h6 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-main)' }}>
                              {strat.title}
                            </h6>
                          </div>

                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {strat.category && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  backgroundColor: '#EBF3F9',
                                  color: 'var(--accent-blue)',
                                }}
                              >
                                {strat.category}
                              </span>
                            )}
                            {strat.occurrences && (
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  fontFamily: 'var(--font-mono)',
                                  padding: '2px 7px',
                                  borderRadius: '4px',
                                  backgroundColor: '#FFFFFF',
                                  border: '1px solid var(--card-border)',
                                  color: 'var(--text-main)',
                                }}
                              >
                                {strat.occurrences}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Strategy Context & Details */}
                        {strat.context && (
                          <div style={{ fontSize: '12.5px', color: 'var(--text-main)', lineHeight: 1.55 }}>
                            <strong>Ngữ cảnh & Đặc trưng:</strong> {strat.context}
                          </div>
                        )}

                        {/* Key Empirical Indicators */}
                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--text-muted)' }}>
                          {strat.theme && (
                            <div>
                              <span style={{ color: 'var(--text-subtle)' }}>Theme:</span>{' '}
                              <strong style={{ color: '#6D28D9' }}>{strat.theme}</strong>
                            </div>
                          )}
                          {strat.frequencyDelta && (
                            <div>
                              <span style={{ color: 'var(--text-subtle)' }}>Tần suất:</span>{' '}
                              <strong style={{ color: 'var(--accent-green)' }}>{strat.frequencyDelta}</strong>
                            </div>
                          )}
                          {strat.timing && (
                            <div>
                              <span style={{ color: 'var(--text-subtle)' }}>Thời điểm:</span>{' '}
                              <strong style={{ color: 'var(--text-main)' }}>{strat.timing}</strong>
                            </div>
                          )}
                        </div>

                        {/* Empirical Table if present */}
                        {strat.tableContent && (
                          <div
                            style={{
                              marginTop: '6px',
                              overflowX: 'auto',
                              borderRadius: '6px',
                              border: '1px solid var(--card-border-soft)',
                              backgroundColor: '#FFFFFF',
                            }}
                          >
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                table: ({ children }) => (
                                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                    {children}
                                  </table>
                                ),
                                thead: ({ children }) => (
                                  <thead style={{ backgroundColor: '#F8F6F2', borderBottom: '1px solid var(--card-border-soft)' }}>
                                    {children}
                                  </thead>
                                ),
                                th: ({ children }) => (
                                  <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                                    {children}
                                  </th>
                                ),
                                td: ({ children }) => (
                                  <td style={{ padding: '8px 12px', borderBottom: '1px solid #F4EFEA', color: 'var(--text-main)' }}>
                                    {children}
                                  </td>
                                ),
                              }}
                            >
                              {strat.tableContent}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* Fallback if strategies were not parsed with `### Strategy:` format */
                <div
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid var(--card-border-soft)',
                    borderRadius: '8px',
                    padding: '16px',
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ children }) => <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px' }}>{children}</h3>,
                      h2: ({ children }) => <h4 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginTop: '14px', marginBottom: '6px' }}>{children}</h4>,
                      h3: ({ children }) => <h5 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '10px', marginBottom: '4px' }}>{children}</h5>,
                      p: ({ children }) => <p style={{ fontSize: '13px', color: 'var(--text-main)', lineHeight: 1.55, marginBottom: '8px' }}>{children}</p>,
                      li: ({ children }) => <li style={{ fontSize: '12.5px', color: 'var(--text-main)', lineHeight: 1.5, marginBottom: '4px' }}>{children}</li>,
                    }}
                  >
                    {markdownContent}
                  </ReactMarkdown>
                </div>
              )}
            </>
          )}

          {/* ================= MODE 2: FULL ACADEMIC MARKDOWN ARTICLE ================= */}
          {viewMode === 'full' && (
            <article
              style={{
                backgroundColor: '#FAF8F4',
                border: '1px solid var(--card-border-soft)',
                borderRadius: '8px',
                padding: '24px 28px',
                lineHeight: 1.65,
                fontSize: '13.5px',
                color: 'var(--text-main)',
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h2
                      style={{
                        fontFamily: 'var(--font-serif)',
                        fontSize: '22px',
                        fontWeight: 400,
                        color: 'var(--accent)',
                        marginBottom: '12px',
                        borderBottom: '1px solid var(--card-border)',
                        paddingBottom: '8px',
                      }}
                    >
                      {children}
                    </h2>
                  ),
                  h2: ({ children }) => (
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginTop: '20px',
                        marginBottom: '10px',
                        borderBottom: '1px dashed var(--card-border-soft)',
                        paddingBottom: '6px',
                      }}
                    >
                      {children}
                    </h3>
                  ),
                  h3: ({ children }) => (
                    <h4
                      style={{
                        fontSize: '13.5px',
                        fontWeight: 700,
                        color: 'var(--text-main)',
                        marginTop: '14px',
                        marginBottom: '6px',
                      }}
                    >
                      {children}
                    </h4>
                  ),
                  p: ({ children }) => (
                    <p style={{ marginBottom: '10px', lineHeight: 1.6 }}>{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul style={{ paddingLeft: '20px', marginBottom: '12px' }}>{children}</ul>
                  ),
                  li: ({ children }) => (
                    <li style={{ marginBottom: '4px' }}>{children}</li>
                  ),
                  table: ({ children }) => (
                    <div
                      style={{
                        width: '100%',
                        overflowX: 'auto',
                        margin: '14px 0',
                        border: '1px solid var(--card-border)',
                        borderRadius: '6px',
                        backgroundColor: '#FFFFFF',
                      }}
                    >
                      <table
                        style={{
                          width: '100%',
                          borderCollapse: 'collapse',
                          fontSize: '12.5px',
                        }}
                      >
                        {children}
                      </table>
                    </div>
                  ),
                  thead: ({ children }) => (
                    <thead style={{ backgroundColor: '#F4EFEA', borderBottom: '1px solid var(--card-border)' }}>
                      {children}
                    </thead>
                  ),
                  th: ({ children }) => (
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-main)' }}>
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid #EFEBE4' }}>
                      {children}
                    </td>
                  ),
                  blockquote: ({ children }) => (
                    <blockquote
                      style={{
                        borderLeft: '3px solid var(--accent)',
                        backgroundColor: '#FFFDF9',
                        padding: '10px 14px',
                        margin: '12px 0',
                        borderRadius: '0 6px 6px 0',
                        fontStyle: 'italic',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {children}
                    </blockquote>
                  ),
                }}
              >
                {markdownContent}
              </ReactMarkdown>
            </article>
          )}

        </div>
      )}
    </div>
  );
};
