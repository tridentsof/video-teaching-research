/**
 * High-Resolution Vector (SVG) Exporter for Qualitative Research Analytics
 * Publication-ready SVG generation for Qualitative Thesis (Braun & Clarke / Miles & Huberman)
 */

import { CoverageMatrixRow, ThematicTheme, RQ1EnactmentRow } from './api';

/**
 * Safely escapes special XML/SVG characters (<, >, &, ', ")
 * and normalizes common HTML entities that are not recognized by XML parsers.
 */
export function escapeXml(unsafe: string | number | null | undefined): string {
  if (unsafe == null) return '';
  // Normalize HTML entities that break standard XML parsers
  const normalized = String(unsafe)
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&lsquo;/g, '‘')
    .replace(/&rsquo;/g, '’')
    .replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');

  return normalized.replace(/[<>&'"]/g, (c) => {
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
 * 1. 5 Thesis Dimensions × Coverage Matrix SVG Exporter (Figure 4.1)
 */
export function generateCoverageMatrixSVG({
  rows,
  viewMode,
  columnsList,
  title,
  language = 'en',
}: {
  rows: CoverageMatrixRow[];
  viewMode: 'lessons' | 'teachers';
  columnsList: string[];
  title?: string;
  language?: 'en' | 'vi';
}): string {
  const isVi = language === 'vi';
  const defaultTitle = isVi
    ? 'Hình 4.1. Ma Trận Độ Phủ 5 Kích Thước Quan Sát Luận Văn Qua 24 Bài Học'
    : 'Figure 4.1. Observation Framework Dimensions Coverage Matrix Across 24 Lessons';
  const finalTitle = title || defaultTitle;
  const colWidth = viewMode === 'lessons' ? 36 : 60;
  const headerCol1Width = 320;
  const headerCol2Width = 240;
  const summaryColWidth = 120;
  const gridWidth = headerCol1Width + headerCol2Width + columnsList.length * colWidth + summaryColWidth;
  const rowHeight = 36;
  const headerHeight = 120;
  const footerHeight = 70;
  const totalHeight = headerHeight + (rows.length + 1) * rowHeight + footerHeight;
  const totalWidth = Math.max(1240, gridWidth + 80);

  let gridX = 40;
  let gridY = headerHeight;

  // Build Table Header
  let colsSvg = '';
  let startX = gridX + headerCol1Width + headerCol2Width;
  columnsList.forEach((col, idx) => {
    const x = startX + idx * colWidth + colWidth / 2;
    colsSvg += `
      <rect x="${startX + idx * colWidth}" y="${gridY}" width="${colWidth}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
      <text x="${x}" y="${gridY + 23}" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#736B63" text-anchor="middle">${escapeXml(col)}</text>
    `;
  });

  // Table Body Rows
  let rowsSvg = '';
  rows.forEach((r, rIdx) => {
    const y = gridY + (rIdx + 1) * rowHeight;
    const isEven = rIdx % 2 === 0;
    const bgRow = isEven ? '#FFFFFF' : '#FAF8F5';

    // Col 1: Dimension Name
    rowsSvg += `
      <rect x="${gridX}" y="${y}" width="${headerCol1Width}" height="${rowHeight}" fill="${bgRow}" stroke="#E8E3D9" stroke-width="1" />
      <text x="${gridX + 14}" y="${y + 23}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="600" fill="#9E4A28">${escapeXml(r.description || r.code)}</text>
    `;

    // Col 2: Framework Section
    rowsSvg += `
      <rect x="${gridX + headerCol1Width}" y="${y}" width="${headerCol2Width}" height="${rowHeight}" fill="${bgRow}" stroke="#E8E3D9" stroke-width="1" />
      <text x="${gridX + headerCol1Width + 14}" y="${y + 23}" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" fill="#736B63">${escapeXml(r.category)}</text>
    `;

    // Cells
    const cells = viewMode === 'lessons' ? r.lesson_cells : r.teacher_cells;
    columnsList.forEach((col, cIdx) => {
      const cX = startX + cIdx * colWidth;
      const cell = cells.find((c) => c.key.toLowerCase() === col.toLowerCase());
      const isPresent = cell ? cell.present : false;

      rowsSvg += `
        <rect x="${cX}" y="${y}" width="${colWidth}" height="${rowHeight}" fill="${bgRow}" stroke="#E8E3D9" stroke-width="1" />
      `;
      if (isPresent) {
        rowsSvg += `
          <circle cx="${cX + colWidth / 2}" cy="${y + rowHeight / 2}" r="5.5" fill="#9E4A28" />
        `;
      }
    });

    // Summary Column (Breadth)
    const sumX = startX + columnsList.length * colWidth;
    const breadth = viewMode === 'lessons' ? r.breadth_lessons : r.breadth_teachers;
    const total = viewMode === 'lessons' ? r.total_lessons : r.total_teachers;
    const pct = total > 0 ? Math.round((breadth / total) * 100) : 0;
    rowsSvg += `
      <rect x="${sumX}" y="${y}" width="${summaryColWidth}" height="${rowHeight}" fill="${bgRow}" stroke="#E8E3D9" stroke-width="1" />
      <text x="${sumX + summaryColWidth / 2}" y="${y + 23}" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="#9E4A28" text-anchor="middle">${breadth} / ${total} (${pct}%)</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- Header -->
  <text x="40" y="44" font-family="'Instrument Serif', Georgia, serif" font-size="24" fill="#9E4A28" font-weight="400">${escapeXml(finalTitle)}</text>
  <text x="40" y="68" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63">${escapeXml(isVi ? 'Ma trận thể hiện mức độ xuất hiện thực nghiệm của 5 kích thước quan sát sư phạm qua 24 bài giảng, không đánh giá hiệu quả hay xếp hạng chiến lược.' : 'Cross-case matrix demonstrating empirical occurrence of the 5 observation framework dimensions across 24 lessons without evaluative scoring or ranking.')}</text>
  <text x="40" y="88" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" fill="#A39B92">${escapeXml(isVi ? 'Chú giải: ● = Có bằng chứng định tính xuất hiện trong video/bản ghi. Tổng tập dữ liệu: 12 Giáo viên / 24 Bài học.' : 'Legend: ● = Qualitative evidence present in lesson transcript/video. Total Corpus: 12 Teachers / 24 Lessons.')}</text>

  <!-- Grid Header: Col 1 & 2 -->
  <rect x="${gridX}" y="${gridY}" width="${headerCol1Width}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
  <text x="${gridX + 14}" y="${gridY + 23}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#1A1612">${escapeXml(isVi ? 'Kích Thước Phân Tích (5 Dimensions)' : 'Analytical Dimension (Thesis Framework)')}</text>

  <rect x="${gridX + headerCol1Width}" y="${gridY}" width="${headerCol2Width}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
  <text x="${gridX + headerCol1Width + 14}" y="${gridY + 23}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#1A1612">${escapeXml(isVi ? 'Phần Khung Luận Văn' : 'Observation Framework Section')}</text>

  <!-- Grid Header Columns -->
  ${colsSvg}

  <!-- Grid Header Summary -->
  <rect x="${startX + columnsList.length * colWidth}" y="${gridY}" width="${summaryColWidth}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
  <text x="${startX + columnsList.length * colWidth + summaryColWidth / 2}" y="${gridY + 23}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#1A1612" text-anchor="middle">${escapeXml(isVi ? 'Độ Phủ' : 'Breadth')}</text>

  <!-- Grid Body -->
  ${rowsSvg}

  <!-- Footer Note -->
  <text x="40" y="${totalHeight - 25}" font-family="'JetBrains Mono', monospace" font-size="11" fill="#A39B92">Observation Studio Qualitative Analytic Engine • Miles, Huberman &amp; Saldaña Qualitative Framework Standards</text>
</svg>`;
}

/**
 * 2. Theme–Category–Code Analytic Hierarchy Map SVG Exporter (Audit Trail) (Figure 4.2)
 * Renders pending placeholder when themes are not finalized yet.
 */
export function generateThematicHierarchySVG({
  themes,
  title,
  language = 'en',
}: {
  themes: ThematicTheme[];
  title?: string;
  language?: 'en' | 'vi';
}): string {
  const isVi = language === 'vi';
  const defaultTitle = isVi
    ? 'Hình 4.2. Sơ Đồ Cây Phân Tích Chủ Đề Quy Nạp & Chuỗi Bằng Chứng (Audit Trail)'
    : 'Figure 4.2. Grounded Thematic Coding Tree & Audit Trail';
  const finalTitle = title || defaultTitle;
  const width = 1440;

  // If no finalized themes exist yet (pending interview phase)
  if (!themes || themes.length === 0) {
    const height = 460;
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- Header -->
  <text x="50" y="44" font-family="'Instrument Serif', Georgia, serif" font-size="24" fill="#9E4A28" font-weight="400">${escapeXml(finalTitle)}</text>
  <text x="50" y="68" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63">${escapeXml(isVi ? 'Giai đoạn chờ dữ liệu: Cây chủ đề chính thức sẽ được xác định sau khi hoàn thành phân tích phỏng vấn.' : 'Pending Final Themes: Thematic coding tree will be established following post-interview qualitative synthesis.')}</text>

  <!-- Pending Box -->
  <rect x="50" y="100" width="1340" height="300" rx="10" fill="#FAF8F5" stroke="#E8E3D9" stroke-width="1.5" stroke-dasharray="6 6" />

  <circle cx="720" cy="200" r="32" fill="#F4EFE6" />
  <path d="M 720 185 L 720 207 M 720 215 L 720 219" stroke="#9E4A28" stroke-width="3" stroke-linecap="round" />

  <text x="720" y="260" font-family="'Plus Jakarta Sans', sans-serif" font-size="16" font-weight="700" fill="#1A1612" text-anchor="middle">
    ${escapeXml(isVi ? 'CHƯA CÓ DỮ LIỆU CHỦ ĐỀ CHÍNH THỨC' : 'PENDING FINAL THEMATIC SYNTHESIS')}
  </text>

  <text x="720" y="286" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63" text-anchor="middle">
    ${escapeXml(isVi ? 'Các chủ đề bao quát (Overarching Themes) sẽ được xác định chính thức sau khi hoàn thành thu thập và phân tích dữ liệu phỏng vấn giáo viên (Semi-structured Interviews)' : 'Final overarching themes will be established following the completion of semi-structured teacher interviews (RQ2 & RQ3)')}
  </text>
  <text x="720" y="306" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63" text-anchor="middle">
    ${escapeXml(isVi ? 'để thực hiện đối chiếu tam giác hóa dữ liệu (Triangulation) với kết quả quan sát bài giảng 24 video.' : 'to perform empirical triangulation with the 24-lesson classroom video observation dataset.')}
  </text>

  <rect x="620" y="328" width="200" height="28" rx="6" fill="#F0EBE1" />
  <text x="720" y="346" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="700" fill="#9E4A28" text-anchor="middle">
    ${escapeXml(isVi ? 'GIAI ĐOẠN 2: PHỎNG VẤN' : 'PHASE 2: INTERVIEW DATA')}
  </text>

  <text x="50" y="${height - 20}" font-family="'JetBrains Mono', monospace" font-size="11" fill="#A39B92">Audit Trail Grounded Model • Lincoln &amp; Guba (1985) Dependability Framework • Video Teaching Research</text>
</svg>`;
  }

  const themeCardHeight = 170;
  const spacing = 35;
  const totalHeight = 130 + themes.length * (themeCardHeight + spacing) + 80;

  let contentSvg = '';
  let curY = 120;

  themes.forEach((th, tIdx) => {
    const tBoxY = curY;
    const tBoxHeight = Math.max(themeCardHeight, th.categories.length * 75 + 30);
    const thName = isVi && th.name_vi ? th.name_vi : th.name;
    const thDesc = isVi && th.description_vi ? th.description_vi : th.description;

    // Theme Box (Column 1)
    contentSvg += `
      <g id="theme-${tIdx}">
        <rect x="50" y="${tBoxY}" width="300" height="${tBoxHeight}" rx="8" fill="#FFFFFF" stroke="#9E4A28" stroke-width="2" />
        <text x="70" y="${tBoxY + 34}" font-family="'Instrument Serif', Georgia, serif" font-size="19" fill="#9E4A28">${escapeXml(thName)}</text>
        
        <rect x="70" y="${tBoxY + 48}" width="80" height="18" rx="4" fill="#EAF4EE" />
        <text x="78" y="${tBoxY + 61}" font-family="'Plus Jakarta Sans', sans-serif" font-size="10" font-weight="700" fill="#2D6A4F">${escapeXml(th.status.toUpperCase())}</text>

        <foreignObject x="70" y="${tBoxY + 74}" width="260" height="85">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:11px;color:#736B63;line-height:1.4;">
            ${escapeXml(thDesc)}
          </div>
        </foreignObject>
      </g>
    `;

    // Categories (Column 2) & Codes (Column 3)
    let catY = tBoxY + 10;
    th.categories.forEach((cat) => {
      const catBoxHeight = Math.max(65, cat.codes.length * 40 + 20);
      const catName = isVi && cat.name_vi ? cat.name_vi : cat.name;
      const catDesc = isVi && cat.description_vi ? cat.description_vi : (cat.description || '');

      // Connector line from Theme to Category
      contentSvg += `
        <path d="M 350 ${tBoxY + 60} C 400 ${tBoxY + 60}, 410 ${catY + 30}, 440 ${catY + 30}" fill="none" stroke="#9E4A28" stroke-width="1.6" />
      `;

      // Category Box
      contentSvg += `
        <rect x="440" y="${catY}" width="280" height="${catBoxHeight}" rx="6" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1.5" />
        <text x="456" y="${catY + 24}" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="700" fill="#1A1612">${escapeXml(catName)}</text>
        <text x="456" y="${catY + 40}" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" fill="#736B63">${escapeXml(catDesc)}</text>
      `;

      // Codes & Sample Excerpts
      let codeY = catY + 5;
      cat.codes.forEach((cd) => {
        // Connector from Category to Code
        contentSvg += `
          <path d="M 720 ${catY + 30} C 760 ${catY + 30}, 770 ${codeY + 16}, 800 ${codeY + 16}" fill="none" stroke="#C4B5A5" stroke-width="1.4" />
        `;

        // Code Box
        contentSvg += `
          <rect x="800" y="${codeY}" width="250" height="34" rx="4" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
          <text x="814" y="${codeY + 22}" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#9E4A28">${escapeXml(cd.name || cd.code)}</text>
        `;

        // First sample excerpt
        if (cd.sample_quotes && cd.sample_quotes.length > 0) {
          const q = cd.sample_quotes[0];
          contentSvg += `
            <path d="M 1050 ${codeY + 17} L 1100 ${codeY + 17}" fill="none" stroke="#E8E3D9" stroke-width="1" />
            <rect x="1100" y="${codeY - 6}" width="290" height="46" rx="4" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
            <text x="1112" y="${codeY + 10}" font-family="'JetBrains Mono', monospace" font-size="10" font-weight="700" fill="#1D5C8A">[${escapeXml(q.timestamp_str)}] ${escapeXml(q.lesson)}</text>
            <text x="1112" y="${codeY + 26}" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-style="italic" fill="#44403C">“${escapeXml(q.quote.slice(0, 42))}...”</text>
          `;
        }

        codeY += 44;
      });

      catY += catBoxHeight + 15;
    });

    curY += tBoxHeight + spacing;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- Title & Headers -->
  <text x="50" y="44" font-family="'Instrument Serif', Georgia, serif" font-size="24" fill="#9E4A28" font-weight="400">${escapeXml(finalTitle)}</text>
  <text x="50" y="68" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63">${escapeXml(isVi ? 'Chuỗi phân tích quy nạp: Trích dẫn thực địa → Mã ban đầu → Cụm hành vi → Chủ đề ứng viên.' : 'Inductive analytic progression: Raw Observation Evidence → Initial Codes → Pedagogical Categories → Overarching Candidate Themes.')}</text>

  <!-- Flow Columns Guide -->
  <text x="50" y="102" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#736B63" letter-spacing="0.5">${escapeXml(isVi ? 'CHỦ ĐỀ BAO QUÁT (CHƯƠNG 4)' : 'OVERARCHING THEMES')}</text>
  <text x="440" y="102" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#736B63" letter-spacing="0.5">${escapeXml(isVi ? 'CỤM HÀNH VI (CATEGORIES)' : 'BEHAVIOR CATEGORIES')}</text>
  <text x="800" y="102" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#736B63" letter-spacing="0.5">${escapeXml(isVi ? 'MÃ QUAN SÁT & PATTERNS' : 'INITIAL CODES & PATTERNS')}</text>
  <text x="1100" y="102" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#736B63" letter-spacing="0.5">${escapeXml(isVi ? 'TRÍCH DẪN XÁC THỰC TIÊU BIỂU' : 'KEY VERIFIED EXCERPTS')}</text>

  <!-- Dividers -->
  <line x1="390" y1="88" x2="390" y2="${totalHeight - 40}" stroke="#E8E3D9" stroke-dasharray="4 4" />
  <line x1="760" y1="88" x2="760" y2="${totalHeight - 40}" stroke="#E8E3D9" stroke-dasharray="4 4" />
  <line x1="1075" y1="88" x2="1075" y2="${totalHeight - 40}" stroke="#E8E3D9" stroke-dasharray="4 4" />

  <!-- Content Tree -->
  ${contentSvg}

  <text x="50" y="${totalHeight - 20}" font-family="'JetBrains Mono', monospace" font-size="11" fill="#A39B92">Audit Trail Grounded Model • Lincoln &amp; Guba (1985) Dependability Framework • Video Teaching Research</text>
</svg>`;
}

/**
 * 3. RQ1 Enactment & Traceability Map SVG Exporter (Figure 4.3)
 * Structure: Analytical Dimension -> Recurring Pattern -> Observed Enactment -> Representative Lesson -> Timestamp/Context
 */
export function generateRQ1TraceabilitySVG({
  enactments,
  title,
  language = 'en',
}: {
  enactments: RQ1EnactmentRow[];
  title?: string;
  language?: 'en' | 'vi';
}): string {
  const isVi = language === 'vi';
  const defaultTitle = isVi
    ? 'Hình 4.3. Bản Đồ Truy Vết Triển Khai Thực Nghiệm Câu Hỏi Nghiên Cứu 1 (RQ1)'
    : 'Figure 4.3. Research Question 1 (RQ1) Enactment & Evidence Traceability Map';
  const finalTitle = title || defaultTitle;
  const width = 1520;
  const rowHeight = 155;
  const headerHeight = 110;
  const totalHeight = headerHeight + enactments.length * (rowHeight + 14) + 60;

  const col1Width = 250; // Dimension
  const col2Width = 230; // Recurring Pattern
  const col3Width = 430; // Observed Enactment
  const col4Width = 180; // Representative Lessons
  const col5Width = 390; // Timestamp/Context & Quotes

  let rowsSvg = '';
  let curY = headerHeight;

  enactments.forEach((row, idx) => {
    const y = curY;
    const dimName = isVi && row.dimension_vi ? row.dimension_vi : (row.dimension || row.strategy_subtext || '');
    const patternName = isVi && row.recurring_pattern_vi ? row.recurring_pattern_vi : (row.recurring_pattern || row.strategy_name || '');
    const enactText = isVi && row.observed_enactment_vi ? row.observed_enactment_vi : (row.observed_enactment || (row.observed_enactments && row.observed_enactments[0]) || '');

    // Row Container
    rowsSvg += `
      <g id="rq-row-${idx}">
        <!-- Col 1: Analytical Dimension -->
        <rect x="40" y="${y}" width="${col1Width}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="54" y="${y + 14}" width="${col1Width - 28}" height="${rowHeight - 28}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12.5px;font-weight:700;color:#9E4A28;line-height:1.4;">
            ${escapeXml(dimName)}
          </div>
        </foreignObject>

        <!-- Col 2: Recurring Pattern -->
        <rect x="${40 + col1Width}" y="${y}" width="${col2Width}" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="${40 + col1Width + 14}" y="${y + 14}" width="${col2Width - 28}" height="${rowHeight - 28}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:12px;font-weight:600;color:#1A1612;line-height:1.4;">
            ${escapeXml(patternName)}
          </div>
        </foreignObject>

        <!-- Col 3: Observed Enactment -->
        <rect x="${40 + col1Width + col2Width}" y="${y}" width="${col3Width}" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="${40 + col1Width + col2Width + 14}" y="${y + 14}" width="${col3Width - 28}" height="${rowHeight - 28}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:11.5px;color:#44403C;line-height:1.45;">
            ${escapeXml(enactText)}
          </div>
        </foreignObject>

        <!-- Col 4: Representative Lessons -->
        <rect x="${40 + col1Width + col2Width + col3Width}" y="${y}" width="${col4Width}" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="${40 + col1Width + col2Width + col3Width + 12}" y="${y + 14}" width="${col4Width - 24}" height="${rowHeight - 28}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;flex-wrap:wrap;gap:4px;">
            ${row.representative_lessons.map((ls) => `<span style="background:#FBF9F5;border:1px solid #E8E3D9;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:10.5px;color:#1A1612;">${escapeXml(ls)}</span>`).join('')}
          </div>
        </foreignObject>

        <!-- Col 5: Timestamp / Context & Direct Quotes -->
        <rect x="${40 + col1Width + col2Width + col3Width + col4Width}" y="${y}" width="${col5Width}" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="${40 + col1Width + col2Width + col3Width + col4Width + 12}" y="${y + 10}" width="${col5Width - 24}" height="${rowHeight - 20}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;flex-direction:column;gap:6px;">
            ${row.direct_quotes.slice(0, 2).map((q) => `
              <div style="background:#FBF9F5;border-radius:6px;padding:6px 10px;border-left:3px solid #9E4A28;font-size:11px;">
                <span style="font-family:'JetBrains Mono',monospace;font-weight:700;color:#1D5C8A;">[${escapeXml(q.timestamp_str)}] ${escapeXml(q.lesson)}: </span>
                <span style="font-style:italic;color:#44403C;">“${escapeXml(q.quote)}”</span>
              </div>
            `).join('')}
          </div>
        </foreignObject>
      </g>
    `;

    curY += rowHeight + 12;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- Title & Description -->
  <text x="40" y="40" font-family="'Instrument Serif', Georgia, serif" font-size="24" fill="#9E4A28" font-weight="400">${escapeXml(finalTitle)}</text>
  <text x="40" y="64" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63">${escapeXml(isVi ? 'Chuỗi bằng chứng thực nghiệm: Kích thước phân tích → Mẫu hành vi lặp lại → Hành vi quan sát được → Bài giảng tiêu biểu → Mốc thời gian/Ngữ cảnh.' : 'Empirical audit trail: Analytical Dimension → Recurring Pattern → Observed Enactment → Representative Lesson → Timestamp/Context.')}</text>

  <!-- Table Headers -->
  <rect x="40" y="80" width="${col1Width}" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="54" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'KÍCH THƯỚC PHÂN TÍCH' : 'ANALYTICAL DIMENSION')}</text>

  <rect x="${40 + col1Width}" y="80" width="${col2Width}" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="${40 + col1Width + 14}" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'MẪU HÀNH VI LẶP LẠI' : 'RECURRING PATTERN')}</text>

  <rect x="${40 + col1Width + col2Width}" y="80" width="${col3Width}" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="${40 + col1Width + col2Width + 14}" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'HÀNH VI QUAN SÁT ĐƯỢC' : 'OBSERVED ENACTMENT')}</text>

  <rect x="${40 + col1Width + col2Width + col3Width}" y="80" width="${col4Width}" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="${40 + col1Width + col2Width + col3Width + 12}" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'BÀI GIẢNG TIÊU BIỂU' : 'REPRESENTATIVE LESSONS')}</text>

  <rect x="${40 + col1Width + col2Width + col3Width + col4Width}" y="80" width="${col5Width}" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="${40 + col1Width + col2Width + col3Width + col4Width + 12}" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'MỐC THỜI GIAN & TRÍCH DẪN' : 'TIMESTAMP & DIRECT QUOTES')}</text>

  <!-- Content Rows -->
  ${rowsSvg}

  <text x="40" y="${totalHeight - 15}" font-family="'JetBrains Mono', monospace" font-size="11" fill="#A39B92">RQ1 Traceability Matrix • Observation Framework Standards • Video Teaching Research</text>
</svg>`;
}
