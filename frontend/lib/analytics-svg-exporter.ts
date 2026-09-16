/**
 * High-Resolution Vector (SVG) Exporter for Pedagogical Analytics
 * Publication-ready SVG generation with full explanatory legends, metadata, and high-contrast typography
 */

export interface ExportTrajectoryParams {
  trendData: Array<{
    lesson: string;
    teacher_id: string;
    scaffolding: number;
    waitTime: number;
    praise: number;
    agency: number;
  }>;
  cohort: string;
  sectionFilter: string;
  timeframe: string;
  trendViewMode: 'perLesson' | 'ma';
  isSectionVisible: (section: 'A' | 'B' | 'C' | 'E') => boolean;
  t: (key: any) => string;
}

export interface ExportRadarParams {
  dimensions: Array<{
    key: string;
    score: number;
    count: number;
  }>;
  cohort: string;
  timeframe: string;
  t: (key: any) => string;
}

export interface ExportStreamParams {
  bins: Array<{
    bin: string;
    warmup: number;
    scaffolding: number;
    studentTurns: number;
    praise: number;
  }>;
  cohort: string;
  timeframe: string;
  t: (key: any) => string;
}

export interface ExportQuadrantParams {
  teachers: Array<{
    id: string;
    scaffolding: number;
    agency: number;
    total_events: number;
  }>;
  cohort: string;
  t: (key: any) => string;
}

/**
 * Safely escapes special XML/SVG characters (<, >, &, ', ")
 */
export function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe == null) return '';
  return String(unsafe).replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Downloads an SVG string as a file
 */
export function downloadSVG(svgContent: string, filename: string) {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * 1. Longitudinal Trajectory SVG with Full Legend & Header
 */
export function generateTrajectorySVG({
  trendData,
  cohort,
  sectionFilter,
  timeframe,
  trendViewMode,
  isSectionVisible,
  t,
}: ExportTrajectoryParams): string {
  const width = 880;
  const height = 480;
  const paddingX = 55;
  const chartTop = 85;
  const chartH = 220;
  const chartW = width - paddingX * 2;

  // Max value calculation
  const values: number[] = [];
  trendData.forEach((d) => {
    if (isSectionVisible('A')) values.push(d.scaffolding);
    if (isSectionVisible('B')) values.push(d.waitTime);
    if (isSectionVisible('C')) values.push(d.praise);
    if (isSectionVisible('E')) values.push(d.agency);
  });
  const highest = values.length ? Math.max(...values) : 20;
  const maxVal = Math.max(20, Math.ceil((highest * 1.15) / 10) * 10);

  const getCoordinates = (val: number, idx: number, total: number) => {
    const x = paddingX + (idx / Math.max(1, total - 1)) * chartW;
    const y = chartTop + chartH - (val / Math.max(1, maxVal)) * chartH;
    return { x, y };
  };

  const generateSmoothPath = (pts: Array<{ x: number; y: number }>) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] || p2;
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  // Grid Lines
  const gridSteps = [0, Math.round(maxVal / 3), Math.round((maxVal * 2) / 3), maxVal];
  const gridLinesSVG = gridSteps
    .map((val) => {
      const y = chartTop + chartH - (val / maxVal) * chartH;
      return `
        <line x1="${paddingX}" y1="${y}" x2="${paddingX + chartW}" y2="${y}" stroke="#E5E7EB" stroke-dasharray="${val === 0 ? 'none' : '3 3'}" stroke-width="1" />
        <text x="${paddingX - 12}" y="${y + 4}" text-anchor="end" font-size="10.5" font-family="'SF Mono', Menlo, Consolas, monospace" fill="#6B7280">${val}</text>
      `;
    })
    .join('');

  // X Axis Lesson Labels
  const xLabelsSVG = trendData
    .map((d, i) => {
      const { x } = getCoordinates(0, i, trendData.length);
      return `<text x="${x}" y="${chartTop + chartH + 22}" text-anchor="middle" font-size="11" font-family="'SF Mono', Menlo, Consolas, monospace" font-weight="600" fill="#4B5563">${escapeXml(d.lesson)}</text>`;
    })
    .join('');

  // Path & Dots Generation
  const scaffoldPts = trendData.map((d, i) => getCoordinates(d.scaffolding, i, trendData.length));
  const waitPts = trendData.map((d, i) => getCoordinates(d.waitTime, i, trendData.length));
  const praisePts = trendData.map((d, i) => getCoordinates(d.praise, i, trendData.length));
  const agencyPts = trendData.map((d, i) => getCoordinates(d.agency, i, trendData.length));

  const pathA = isSectionVisible('A') ? generateSmoothPath(scaffoldPts) : '';
  const pathB = isSectionVisible('B') ? generateSmoothPath(waitPts) : '';
  const pathC = isSectionVisible('C') ? generateSmoothPath(praisePts) : '';
  const pathE = isSectionVisible('E') ? generateSmoothPath(agencyPts) : '';

  const dotsSVG = trendData
    .map((d, i) => {
      let circles = '';
      if (isSectionVisible('A')) circles += `<circle cx="${scaffoldPts[i].x.toFixed(1)}" cy="${scaffoldPts[i].y.toFixed(1)}" r="4" fill="#9E4A28" stroke="#FFFFFF" stroke-width="2" />`;
      if (isSectionVisible('B')) circles += `<circle cx="${waitPts[i].x.toFixed(1)}" cy="${waitPts[i].y.toFixed(1)}" r="4" fill="#2D6A4F" stroke="#FFFFFF" stroke-width="2" />`;
      if (isSectionVisible('C')) circles += `<circle cx="${praisePts[i].x.toFixed(1)}" cy="${praisePts[i].y.toFixed(1)}" r="4" fill="#1D5C8A" stroke="#FFFFFF" stroke-width="2" />`;
      if (isSectionVisible('E')) circles += `<circle cx="${agencyPts[i].x.toFixed(1)}" cy="${agencyPts[i].y.toFixed(1)}" r="4" fill="#B26A00" stroke="#FFFFFF" stroke-width="2" />`;
      return circles;
    })
    .join('');

  const areaA =
    isSectionVisible('A') && trendData.length > 0
      ? `<path d="${pathA} L ${scaffoldPts[scaffoldPts.length - 1].x} ${chartTop + chartH} L ${paddingX} ${chartTop + chartH} Z" fill="#9E4A28" fill-opacity="0.1" />`
      : '';

  const teacherLabel = cohort === 'all' ? t('analyticsTeacherAll') : `${t('analyticsTeacherPrefix')} ${cohort}`;
  const timeframeLabel = timeframe === 'all' ? t('analyticsTimeframeAll') : timeframe === 'pre' ? t('analyticsTimeframePre') : t('analyticsTimeframePost');
  const modeLabel = trendViewMode === 'perLesson' ? t('chartTrajectoryViewPerLesson') : t('chartTrajectoryViewMA');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .title { font-size: 18px; font-weight: 700; fill: #1F2937; }
    .subtitle { font-size: 11.5px; fill: #6B7280; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .legend-title { font-size: 10.5px; font-weight: 700; fill: #4B5563; text-transform: uppercase; letter-spacing: 0.6px; }
    .legend-name { font-size: 11.5px; font-weight: 700; }
    .legend-desc { font-size: 11px; fill: #4B5563; }
  </style>

  <!-- Clean Canvas Background -->
  <rect width="100%" height="100%" fill="#FFFFFF" rx="8" />
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#E5E7EB" rx="8" />

  <!-- Title & Research Header -->
  <text x="${paddingX}" y="36" class="title">${escapeXml(t('chartTrajectoryTitle'))}</text>
  <text x="${paddingX}" y="56" class="subtitle">${escapeXml(t('analyticsCorpusLabel'))}: ${escapeXml(teacherLabel)}  |  ${escapeXml(t('analyticsTimeframe'))}: ${escapeXml(timeframeLabel)}  |  ${escapeXml(t('chartTrajectoryViewPerLesson'))}: ${escapeXml(modeLabel)}</text>

  <!-- Grid & Axes -->
  ${gridLinesSVG}
  ${xLabelsSVG}

  <!-- Paths & Data -->
  ${areaA}
  ${pathA ? `<path d="${pathA}" fill="none" stroke="#9E4A28" stroke-width="2.8" stroke-linecap="round" />` : ''}
  ${pathB ? `<path d="${pathB}" fill="none" stroke="#2D6A4F" stroke-width="2.2" stroke-linecap="round" />` : ''}
  ${pathC ? `<path d="${pathC}" fill="none" stroke="#1D5C8A" stroke-width="2.2" stroke-linecap="round" />` : ''}
  ${pathE ? `<path d="${pathE}" fill="none" stroke="#B26A00" stroke-width="2.2" stroke-dasharray="5 4" stroke-linecap="round" />` : ''}
  ${dotsSVG}

  <!-- Explanatory Legend Section (Below Chart) -->
  <g transform="translate(${paddingX}, ${chartTop + chartH + 42})">
    <line x1="0" y1="0" x2="${chartW}" y2="0" stroke="#E5E7EB" stroke-width="1" />
    <text x="0" y="18" class="legend-title">PEDAGOGICAL STRATEGY CLASSIFICATION &amp; EXPLANATION:</text>

    <!-- Section A -->
    <g transform="translate(0, 32)">
      <line x1="0" y1="4" x2="22" y2="4" stroke="#9E4A28" stroke-width="3" stroke-linecap="round" />
      <circle cx="11" cy="4" r="3.5" fill="#9E4A28" stroke="#FFFFFF" stroke-width="1.5" />
      <text x="30" y="8" class="legend-name" fill="#9E4A28">${escapeXml(t('chartTrajectoryLegendScaffolding'))}:</text>
      <text x="285" y="8" class="legend-desc">Teacher instructional cues, conceptual hints, and guided question scaffolding</text>
    </g>

    <!-- Section B -->
    <g transform="translate(0, 49)">
      <line x1="0" y1="4" x2="22" y2="4" stroke="#2D6A4F" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="11" cy="4" r="3.5" fill="#2D6A4F" stroke="#FFFFFF" stroke-width="1.5" />
      <text x="30" y="8" class="legend-name" fill="#2D6A4F">${escapeXml(t('chartTrajectoryLegendWaitTime'))}:</text>
      <text x="285" y="8" class="legend-desc">Extended wait-time pauses (&gt;3s) allowing student reflection &amp; cognitive formulation</text>
    </g>

    <!-- Section C -->
    <g transform="translate(0, 66)">
      <line x1="0" y1="4" x2="22" y2="4" stroke="#1D5C8A" stroke-width="2.5" stroke-linecap="round" />
      <circle cx="11" cy="4" r="3.5" fill="#1D5C8A" stroke="#FFFFFF" stroke-width="1.5" />
      <text x="30" y="8" class="legend-name" fill="#1D5C8A">${escapeXml(t('chartTrajectoryLegendPraise'))}:</text>
      <text x="285" y="8" class="legend-desc">Constructive affirmation, praise for effort, and positive feedback reinforcement</text>
    </g>

    <!-- Section E -->
    <g transform="translate(0, 83)">
      <line x1="0" y1="4" x2="22" y2="4" stroke="#B26A00" stroke-width="2.5" stroke-dasharray="5 3" stroke-linecap="round" />
      <circle cx="11" cy="4" r="3.5" fill="#B26A00" stroke="#FFFFFF" stroke-width="1.5" />
      <text x="30" y="8" class="legend-name" fill="#B26A00">${escapeXml(t('chartTrajectoryLegendAgency'))}:</text>
      <text x="285" y="8" class="legend-desc">Student-initiated questions, peer discourse, and autonomous exploration turns</text>
    </g>
  </g>
</svg>`;
}

/**
 * 2. 5D Pedagogical Radar SVG with Full Legend & Header
 */
export function generateRadarSVG({
  dimensions,
  cohort,
  timeframe,
  t,
}: ExportRadarParams): string {
  const width = 640;
  const height = 540;
  const centerX = width / 2;
  const centerY = 210;
  const radius = 115;

  const count = Math.max(1, dimensions.length);
  const angles = dimensions.map((_, i) => (Math.PI * 2 * i) / count - Math.PI / 2);

  const getPoint = (score: number, angle: number) => {
    const r = (Math.min(100, Math.max(0, score)) / 100) * radius;
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle),
    };
  };

  const getLabel = (key: string) => {
    const sec = key.replace('sec', '');
    if (sec === 'A') return t('analyticsRadarA');
    if (sec === 'B') return t('analyticsRadarB');
    if (sec === 'C') return t('analyticsRadarC');
    if (sec === 'D') return t('analyticsRadarD');
    if (sec === 'E') return t('analyticsRadarE');
    return sec;
  };

  // Concentric Rings
  const ringsSVG = [0.2, 0.4, 0.6, 0.8, 1.0]
    .map((scale) => {
      const pts = angles.map((a) => {
        const pt = getPoint(scale * 100, a);
        return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
      });
      const percentY = centerY - scale * radius;
      return `
        <polygon points="${pts.join(' ')}" fill="none" stroke="#E5E7EB" stroke-width="${scale === 1 ? '1.5' : '0.8'}" />
        <text x="${centerX + 4}" y="${percentY - 2}" font-size="9" fill="#9CA3AF" font-family="'SF Mono', Menlo, monospace">${Math.round(scale * 100)}%</text>
      `;
    })
    .join('');

  // Spokes & Axis Labels
  const spokesSVG = dimensions
    .map((d, i) => {
      const edge = getPoint(100, angles[i]);
      const labelPt = getPoint(124, angles[i]);
      return `
        <line x1="${centerX}" y1="${centerY}" x2="${edge.x.toFixed(1)}" y2="${edge.y.toFixed(1)}" stroke="#D1D5DB" stroke-width="1" />
        <text x="${labelPt.x.toFixed(1)}" y="${(labelPt.y + 4).toFixed(1)}" text-anchor="middle" font-size="11.5" font-weight="600" fill="#374151">${escapeXml(getLabel(d.key))}</text>
      `;
    })
    .join('');

  // Polygon Path & Points
  const polygonPoints = dimensions
    .map((d, i) => {
      const pt = getPoint(d.score, angles[i]);
      return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
    })
    .join(' ');

  const vertexCircles = dimensions
    .map((d, i) => {
      const pt = getPoint(d.score, angles[i]);
      return `
        <circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="4.5" fill="#9E4A28" stroke="#FFFFFF" stroke-width="2" />
        <text x="${pt.x.toFixed(1)}" y="${(pt.y - 8).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" fill="#9E4A28" font-family="'SF Mono', monospace">${Math.round(d.score)}%</text>
      `;
    })
    .join('');

  const teacherLabel = cohort === 'all' ? t('analyticsTeacherAll') : `${t('analyticsTeacherPrefix')} ${cohort}`;

  // Explanatory breakdown items
  const legendItems = dimensions
    .map((d, idx) => {
      const yOffset = 26 + idx * 20;
      return `
        <g transform="translate(0, ${yOffset})">
          <circle cx="6" cy="4" r="4" fill="#9E4A28" />
          <text x="18" y="8" font-size="11.5" font-weight="700" fill="#1F2937">${escapeXml(getLabel(d.key))}:</text>
          <text x="190" y="8" font-size="11" fill="#4B5563">Score: <strong>${Math.round(d.score)}%</strong>  •  Count: <strong>${d.count}</strong> ${escapeXml(t('tooltipEvents'))}</text>
        </g>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .title { font-size: 18px; font-weight: 700; fill: #1F2937; }
    .subtitle { font-size: 11.5px; fill: #6B7280; }
    .legend-title { font-size: 10.5px; font-weight: 700; fill: #4B5563; text-transform: uppercase; letter-spacing: 0.6px; }
  </style>

  <!-- Clean Canvas Background -->
  <rect width="100%" height="100%" fill="#FFFFFF" rx="8" />
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#E5E7EB" rx="8" />

  <!-- Header -->
  <text x="45" y="36" class="title">${escapeXml(t('chartRadarTitle'))}</text>
  <text x="45" y="56" class="subtitle">${escapeXml(t('analyticsCorpusLabel'))}: ${escapeXml(teacherLabel)}  |  ${escapeXml(t('analyticsTimeframe'))}: ${escapeXml(timeframe.toUpperCase())}  |  5 Core Pedagogical Dimensions</text>

  <!-- Radar Graph -->
  ${ringsSVG}
  ${spokesSVG}
  <polygon points="${polygonPoints}" fill="#9E4A28" fill-opacity="0.22" stroke="#9E4A28" stroke-width="2.6" />
  ${vertexCircles}

  <!-- Legend & Explanations below -->
  <g transform="translate(45, 390)">
    <line x1="0" y1="0" x2="${width - 90}" y2="0" stroke="#E5E7EB" stroke-width="1" />
    <text x="0" y="16" class="legend-title">DIMENSIONAL METRICS &amp; EVENT SUMMARY:</text>
    ${legendItems}
  </g>
</svg>`;
}

/**
 * 3. Intra-Lesson Temporal Dynamics SVG with Full Legend & Header
 */
export function generateStreamSVG({
  bins,
  cohort,
  timeframe,
  t,
}: ExportStreamParams): string {
  const width = 880;
  const height = 480;
  const paddingX = 55;
  const chartTop = 85;
  const chartH = 200;
  const chartW = width - paddingX * 2;

  const binCount = Math.max(1, bins.length);
  const colWidth = (chartW - (binCount - 1) * 8) / binCount;

  const barsSVG = bins
    .map((bin, i) => {
      const total = Math.max(1, bin.warmup + bin.scaffolding + bin.studentTurns + bin.praise);
      const x = paddingX + i * (colWidth + 8);

      const hWarm = (bin.warmup / total) * chartH;
      const hScaffold = (bin.scaffolding / total) * chartH;
      const hTurns = (bin.studentTurns / total) * chartH;
      const hPraise = (bin.praise / total) * chartH;

      // stacked from bottom to top
      const yWarm = chartTop + chartH - hWarm;
      const yScaffold = yWarm - hScaffold;
      const yTurns = yScaffold - hTurns;
      const yPraise = yTurns - hPraise;

      return `
        <g>
          <rect x="${x.toFixed(1)}" y="${yPraise.toFixed(1)}" width="${colWidth.toFixed(1)}" height="${hPraise.toFixed(1)}" fill="#6D28D9" opacity="0.9" />
          <rect x="${x.toFixed(1)}" y="${yTurns.toFixed(1)}" width="${colWidth.toFixed(1)}" height="${hTurns.toFixed(1)}" fill="#2D6A4F" opacity="0.9" />
          <rect x="${x.toFixed(1)}" y="${yScaffold.toFixed(1)}" width="${colWidth.toFixed(1)}" height="${hScaffold.toFixed(1)}" fill="#9E4A28" opacity="0.9" />
          <rect x="${x.toFixed(1)}" y="${yWarm.toFixed(1)}" width="${colWidth.toFixed(1)}" height="${hWarm.toFixed(1)}" fill="#1D5C8A" opacity="0.9" />
          <rect x="${x.toFixed(1)}" y="${chartTop}" width="${colWidth.toFixed(1)}" height="${chartH}" fill="none" stroke="#E5E7EB" stroke-width="1" rx="3" />
          <!-- Bin Label -->
          <text x="${(x + colWidth / 2).toFixed(1)}" y="${chartTop + chartH + 20}" text-anchor="middle" font-size="11" font-family="'SF Mono', Menlo, monospace" font-weight="600" fill="#4B5563">${escapeXml(bin.bin)}</text>
        </g>
      `;
    })
    .join('');

  const teacherLabel = cohort === 'all' ? t('analyticsTeacherAll') : `${t('analyticsTeacherPrefix')} ${cohort}`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .title { font-size: 18px; font-weight: 700; fill: #1F2937; }
    .subtitle { font-size: 11.5px; fill: #6B7280; }
    .legend-title { font-size: 10.5px; font-weight: 700; fill: #4B5563; text-transform: uppercase; letter-spacing: 0.6px; }
    .legend-name { font-size: 11.5px; font-weight: 700; }
    .legend-desc { font-size: 11px; fill: #4B5563; }
  </style>

  <!-- Clean Canvas Background -->
  <rect width="100%" height="100%" fill="#FFFFFF" rx="8" />
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#E5E7EB" rx="8" />

  <!-- Header -->
  <text x="${paddingX}" y="36" class="title">${escapeXml(t('chartStreamTitle'))}</text>
  <text x="${paddingX}" y="56" class="subtitle">${escapeXml(t('analyticsCorpusLabel'))}: ${escapeXml(teacherLabel)}  |  ${escapeXml(t('analyticsTimeframe'))}: ${escapeXml(timeframe.toUpperCase())}  |  Temporal Activity Density (0–45 min)</text>

  <!-- Background Grid Horizontal Lines -->
  <line x1="${paddingX}" y1="${chartTop}" x2="${paddingX + chartW}" y2="${chartTop}" stroke="#E5E7EB" stroke-dasharray="3 3" />
  <line x1="${paddingX}" y1="${chartTop + chartH / 2}" x2="${paddingX + chartW}" y2="${chartTop + chartH / 2}" stroke="#E5E7EB" stroke-dasharray="3 3" />
  <line x1="${paddingX}" y1="${chartTop + chartH}" x2="${paddingX + chartW}" y2="${chartTop + chartH}" stroke="#D1D5DB" stroke-width="1.2" />

  <!-- Stacked Bars & X Labels -->
  ${barsSVG}

  <!-- Explanatory Legend below -->
  <g transform="translate(${paddingX}, ${chartTop + chartH + 42})">
    <line x1="0" y1="0" x2="${chartW}" y2="0" stroke="#E5E7EB" stroke-width="1" />
    <text x="0" y="18" class="legend-title">INSTRUCTIONAL SEGMENT CLASSIFICATION &amp; PHASES:</text>

    <!-- Warmup -->
    <g transform="translate(0, 32)">
      <rect x="0" y="0" width="16" height="10" fill="#1D5C8A" rx="2" />
      <text x="24" y="9" class="legend-name" fill="#1D5C8A">${escapeXml(t('chartStreamWarmup'))}:</text>
      <text x="240" y="9" class="legend-desc">Initial lesson activation, prior knowledge elicitation, and goal orientation</text>
    </g>

    <!-- Scaffolding -->
    <g transform="translate(0, 49)">
      <rect x="0" y="0" width="16" height="10" fill="#9E4A28" rx="2" />
      <text x="24" y="9" class="legend-name" fill="#9E4A28">${escapeXml(t('chartStreamScaffolding'))}:</text>
      <text x="240" y="9" class="legend-desc">Explicit teacher modeling, structured explanation, and procedural guidance</text>
    </g>

    <!-- Student Turns -->
    <g transform="translate(0, 66)">
      <rect x="0" y="0" width="16" height="10" fill="#2D6A4F" rx="2" />
      <text x="24" y="9" class="legend-name" fill="#2D6A4F">${escapeXml(t('chartStreamStudentTurns'))}:</text>
      <text x="240" y="9" class="legend-desc">Active student verbalization, peer discussions, and independent practice turns</text>
    </g>

    <!-- Praise -->
    <g transform="translate(0, 83)">
      <rect x="0" y="0" width="16" height="10" fill="#6D28D9" rx="2" />
      <text x="24" y="9" class="legend-name" fill="#6D28D9">${escapeXml(t('chartStreamPraise'))}:</text>
      <text x="240" y="9" class="legend-desc">Positive reinforcement, constructive synthesis, and formative closing review</text>
    </g>
  </g>
</svg>`;
}

/**
 * 4. Pedagogical Quadrant Map SVG with Full Legend & Header
 */
export function generateQuadrantSVG({
  teachers,
  cohort,
  t,
}: ExportQuadrantParams): string {
  const width = 720;
  const height = 560;
  const paddingX = 55;
  const chartTop = 85;
  const chartH = 290;
  const chartW = width - paddingX * 2;

  const midX = paddingX + chartW / 2;
  const midY = chartTop + chartH / 2;

  // Scatter dots
  const teacherDots = teachers
    .map((tp) => {
      const agencyPct = Math.min(90, Math.max(10, tp.agency)) / 100;
      const scaffoldPct = Math.min(90, Math.max(10, tp.scaffolding)) / 100;

      const x = paddingX + agencyPct * chartW;
      const y = chartTop + (1 - scaffoldPct) * chartH;

      return `
        <g>
          <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="7" fill="#9E4A28" stroke="#FFFFFF" stroke-width="2.5" />
          <text x="${x.toFixed(1)}" y="${(y + 16).toFixed(1)}" text-anchor="middle" font-size="10.5" font-weight="700" font-family="'SF Mono', Menlo, monospace" fill="#9E4A28">${escapeXml(tp.id)}</text>
        </g>
      `;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    text { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    .title { font-size: 18px; font-weight: 700; fill: #1F2937; }
    .subtitle { font-size: 11.5px; fill: #6B7280; }
    .quadrant-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .legend-title { font-size: 10.5px; font-weight: 700; fill: #4B5563; text-transform: uppercase; letter-spacing: 0.6px; }
    .legend-name { font-size: 11px; font-weight: 700; fill: #1F2937; }
    .legend-desc { font-size: 10.5px; fill: #4B5563; }
  </style>

  <!-- Clean Canvas Background -->
  <rect width="100%" height="100%" fill="#FFFFFF" rx="8" />
  <rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="none" stroke="#E5E7EB" rx="8" />

  <!-- Header -->
  <text x="${paddingX}" y="36" class="title">${escapeXml(t('chartQuadrantTitle'))}</text>
  <text x="${paddingX}" y="56" class="subtitle">${escapeXml(t('chartQuadrantXLabel'))} (X) vs ${escapeXml(t('chartQuadrantYLabel'))} (Y)  |  4 Teaching Archetypes</text>

  <!-- Coordinate Box -->
  <rect x="${paddingX}" y="${chartTop}" width="${chartW}" height="${chartH}" fill="#FAFAF9" stroke="#D6D3D1" stroke-width="1.2" rx="4" />

  <!-- Crosshairs -->
  <line x1="${paddingX}" y1="${midY}" x2="${paddingX + chartW}" y2="${midY}" stroke="#D6D3D1" stroke-dasharray="4 4" stroke-width="1" />
  <line x1="${midX}" y1="${chartTop}" x2="${midX}" y2="${chartTop + chartH}" stroke="#D6D3D1" stroke-dasharray="4 4" stroke-width="1" />

  <!-- Quadrant Watermarks -->
  <!-- Top Right: Facilitative Mentors -->
  <text x="${paddingX + chartW - 12}" y="${chartTop + 20}" text-anchor="end" class="quadrant-label" fill="#9E4A28">${escapeXml(t('quadrantFacilitative'))}</text>
  <!-- Top Left: Structured Direct -->
  <text x="${paddingX + 12}" y="${chartTop + 20}" text-anchor="start" class="quadrant-label" fill="#6B7280">${escapeXml(t('quadrantStructured'))}</text>
  <!-- Bottom Left: Traditional Guided -->
  <text x="${paddingX + 12}" y="${chartTop + chartH - 12}" text-anchor="start" class="quadrant-label" fill="#6B7280">${escapeXml(t('quadrantTraditional'))}</text>
  <!-- Bottom Right: Open Conversational -->
  <text x="${paddingX + chartW - 12}" y="${chartTop + chartH - 12}" text-anchor="end" class="quadrant-label" fill="#6B7280">${escapeXml(t('quadrantConversational'))}</text>

  <!-- Axes Arrows & Labels -->
  <text x="${midX}" y="${chartTop + chartH + 24}" text-anchor="middle" font-size="11" font-weight="600" fill="#4B5563">Student Agency &amp; Production Ratio (%) →</text>
  <text x="${paddingX - 12}" y="${midY}" text-anchor="middle" transform="rotate(-90 ${paddingX - 12} ${midY})" font-size="11" font-weight="600" fill="#4B5563">Teacher Scaffolding Quality (%) →</text>

  <!-- Plotted Teacher Dots -->
  ${teacherDots}

  <!-- Explanatory Legend below -->
  <g transform="translate(${paddingX}, ${chartTop + chartH + 42})">
    <line x1="0" y1="0" x2="${chartW}" y2="0" stroke="#E5E7EB" stroke-width="1" />
    <text x="0" y="16" class="legend-title">PEDAGOGICAL ARCHETYPE DEFINITIONS:</text>

    <!-- Quadrant I & II -->
    <g transform="translate(0, 30)">
      <text x="0" y="8" class="legend-name" fill="#9E4A28">• ${escapeXml(t('quadrantFacilitative'))}:</text>
      <text x="180" y="8" class="legend-desc">High scaffolding + High student agency. Strategic prompting with ample student autonomy.</text>
    </g>

    <g transform="translate(0, 47)">
      <text x="0" y="8" class="legend-name" fill="#4B5563">• ${escapeXml(t('quadrantStructured'))}:</text>
      <text x="180" y="8" class="legend-desc">High scaffolding + Lower student agency. Explicit direct modeling with teacher-led cadence.</text>
    </g>

    <!-- Quadrant III & IV -->
    <g transform="translate(0, 64)">
      <text x="0" y="8" class="legend-name" fill="#4B5563">• ${escapeXml(t('quadrantConversational'))}:</text>
      <text x="180" y="8" class="legend-desc">Lower scaffolding + High student agency. Open student-centric discussion with fluid facilitation.</text>
    </g>

    <g transform="translate(0, 81)">
      <text x="0" y="8" class="legend-name" fill="#4B5563">• ${escapeXml(t('quadrantTraditional'))}:</text>
      <text x="180" y="8" class="legend-desc">Lower scaffolding + Lower student agency. Conventional transmission lecture and silent listening.</text>
    </g>
  </g>
</svg>`;
}
