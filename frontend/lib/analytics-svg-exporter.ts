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
 * 1. Code/Pattern × Coverage Matrix SVG Exporter
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
    ? 'Hình 4.1. Ma Trận Độ Phủ Mã & Mẫu Hành Vi Định Tính Qua 24 Bài Học'
    : 'Figure 4.1. Qualitative Pattern & Code Coverage Matrix Across 24 Lessons';
  const finalTitle = title || defaultTitle;
  const colWidth = viewMode === 'lessons' ? 36 : 60;
  const headerCol1Width = 260;
  const headerCol2Width = 180;
  const summaryColWidth = 120;
  const gridWidth = headerCol1Width + headerCol2Width + columnsList.length * colWidth + summaryColWidth;
  const rowHeight = 34;
  const headerHeight = 120;
  const footerHeight = 70;
  const totalHeight = headerHeight + (rows.length + 1) * rowHeight + footerHeight;
  const totalWidth = Math.max(1200, gridWidth + 80);

  let gridX = 40;
  let gridY = headerHeight;

  // Build Table Header
  let colsSvg = '';
  let startX = gridX + headerCol1Width + headerCol2Width;
  columnsList.forEach((col, idx) => {
    const x = startX + idx * colWidth + colWidth / 2;
    colsSvg += `
      <rect x="${startX + idx * colWidth}" y="${gridY}" width="${colWidth}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
      <text x="${x}" y="${gridY + 22}" font-family="'JetBrains Mono', monospace" font-size="11" font-weight="600" fill="#736B63" text-anchor="middle">${escapeXml(col)}</text>
    `;
  });

  // Table Body Rows
  let rowsSvg = '';
  rows.forEach((r, rIdx) => {
    const y = gridY + (rIdx + 1) * rowHeight;
    const isEven = rIdx % 2 === 0;
    const bgRow = isEven ? '#FFFFFF' : '#FAF8F5';

    // Col 1: Code & Name
    rowsSvg += `
      <rect x="${gridX}" y="${y}" width="${headerCol1Width}" height="${rowHeight}" fill="${bgRow}" stroke="#E8E3D9" stroke-width="1" />
      <text x="${gridX + 12}" y="${y + 21}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="600" fill="#9E4A28">${escapeXml(r.description || r.code)}</text>
    `;

    // Col 2: Category
    rowsSvg += `
      <rect x="${gridX + headerCol1Width}" y="${y}" width="${headerCol2Width}" height="${rowHeight}" fill="${bgRow}" stroke="#E8E3D9" stroke-width="1" />
      <text x="${gridX + headerCol1Width + 12}" y="${y + 21}" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" fill="#736B63">${escapeXml(r.category)}</text>
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
          <circle cx="${cX + colWidth / 2}" cy="${y + rowHeight / 2}" r="5" fill="#9E4A28" />
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
      <text x="${sumX + summaryColWidth / 2}" y="${y + 21}" font-family="'JetBrains Mono', monospace" font-size="11.5" font-weight="700" fill="#9E4A28" text-anchor="middle">${breadth} / ${total} (${pct}%)</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="100%" height="100%" fill="#FFFFFF" />

  <!-- Header -->
  <text x="40" y="44" font-family="'Instrument Serif', Georgia, serif" font-size="24" fill="#9E4A28" font-weight="400">${escapeXml(finalTitle)}</text>
  <text x="40" y="68" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63">${escapeXml(isVi ? 'Ma trận đa trường hợp chứng minh sự xuất hiện định tính phổ quát của các mẫu hành vi sư phạm qua 24 bài giảng.' : 'Cross-case matrix demonstrating recurring qualitative pedagogical codes across the 24-lesson EFL corpus without quantitative scoring.')}</text>
  <text x="40" y="88" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" fill="#A39B92">${escapeXml(isVi ? 'Chú giải: ● = Có bằng chứng định tính xuất hiện trong video/bản ghi. Tổng mẫu: 12 Giáo viên / 24 Bài học.' : 'Legend: ● = Qualitative evidence present in lesson transcript/video. Total Corpus: 12 Teachers / 24 Lessons.')}</text>

  <!-- Grid Header: Col 1 & 2 -->
  <rect x="${gridX}" y="${gridY}" width="${headerCol1Width}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
  <text x="${gridX + 12}" y="${gridY + 22}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#1A1612">${escapeXml(isVi ? 'Mã Định Tính & Mẫu Hành Vi' : 'Pattern / Qualitative Code')}</text>

  <rect x="${gridX + headerCol1Width}" y="${gridY}" width="${headerCol2Width}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
  <text x="${gridX + headerCol1Width + 12}" y="${gridY + 22}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#1A1612">${escapeXml(isVi ? 'Cụm Hành Vi' : 'Category')}</text>

  <!-- Grid Header Columns -->
  ${colsSvg}

  <!-- Grid Header Summary -->
  <rect x="${startX + columnsList.length * colWidth}" y="${gridY}" width="${summaryColWidth}" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
  <text x="${startX + columnsList.length * colWidth + summaryColWidth / 2}" y="${gridY + 22}" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#1A1612" text-anchor="middle">${escapeXml(isVi ? 'Độ Phủ' : 'Breadth')}</text>

  <!-- Grid Body -->
  ${rowsSvg}

  <!-- Footer Note -->
  <text x="40" y="${totalHeight - 25}" font-family="'JetBrains Mono', monospace" font-size="11" fill="#A39B92">Observation Studio Qualitative Analytic Engine • Miles, Huberman &amp; Saldaña Qualitative Data Analysis Standards</text>
</svg>`;
}

/**
 * 2. Theme–Category–Code Analytic Hierarchy Map SVG Exporter (Audit Trail)
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
 * 3. RQ1 Enactment & Traceability Map SVG Exporter
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
  const width = 1440;
  const rowHeight = 150;
  const headerHeight = 110;
  const totalHeight = headerHeight + enactments.length * (rowHeight + 15) + 60;

  let rowsSvg = '';
  let curY = headerHeight;

  enactments.forEach((row, idx) => {
    const y = curY;
    const stratName = isVi && row.strategy_name_vi ? row.strategy_name_vi : row.strategy_name;
    const stratSub = isVi && row.strategy_subtext_vi ? row.strategy_subtext_vi : row.strategy_subtext;
    const enactList = isVi && row.observed_enactments_vi && row.observed_enactments_vi.length > 0
      ? row.observed_enactments_vi
      : row.observed_enactments;

    // Row Container
    rowsSvg += `
      <g id="rq-row-${idx}">
        <!-- Col 1: Strategy -->
        <rect x="40" y="${y}" width="280" height="${rowHeight}" fill="#FBF9F5" stroke="#E8E3D9" stroke-width="1" />
        <text x="56" y="${y + 28}" font-family="'Plus Jakarta Sans', sans-serif" font-size="13.5" font-weight="700" fill="#9E4A28">${escapeXml(stratName)}</text>
        <foreignObject x="56" y="${y + 36}" width="248" height="100">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:11.5px;color:#736B63;line-height:1.4;">
            ${escapeXml(stratSub)}
          </div>
        </foreignObject>

        <!-- Col 2: Observed Enactments -->
        <rect x="320" y="${y}" width="420" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="336" y="${y + 14}" width="388" height="${rowHeight - 28}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:'Plus Jakarta Sans',sans-serif;font-size:11.5px;color:#1A1612;line-height:1.45;">
            ${enactList.map((en) => `<div style="margin-bottom:6px;">• <strong>${escapeXml(en.split(':')[0])}:</strong> ${escapeXml(en.split(':')[1] || '')}</div>`).join('')}
          </div>
        </foreignObject>

        <!-- Col 3: Representative Lessons -->
        <rect x="740" y="${y}" width="200" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="752" y="${y + 14}" width="176" height="${rowHeight - 28}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;flex-wrap:wrap;gap:4px;">
            ${row.representative_lessons.map((ls) => `<span style="background:#FBF9F5;border:1px solid #E8E3D9;padding:2px 6px;border-radius:4px;font-family:'JetBrains Mono',monospace;font-size:11px;color:#1A1612;">${escapeXml(ls)}</span>`).join('')}
          </div>
        </foreignObject>

        <!-- Col 4: Verifiable Quotes -->
        <rect x="940" y="${y}" width="460" height="${rowHeight}" fill="#FFFFFF" stroke="#E8E3D9" stroke-width="1" />
        <foreignObject x="956" y="${y + 10}" width="428" height="${rowHeight - 20}">
          <div xmlns="http://www.w3.org/1999/xhtml" style="display:flex;flex-direction:column;gap:6px;">
            ${row.direct_quotes.slice(0, 2).map((q) => `
              <div style="background:#FBF9F5;border-radius:6px;padding:6px 10px;border-left:3px solid #9E4A28;font-size:11.5px;">
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
  <text x="40" y="64" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" fill="#736B63">${escapeXml(isVi ? 'Chuỗi bằng chứng thực nghiệm kết nối các chiến lược quản lý lớp học với hành vi quan sát được và mốc thời gian video.' : 'Direct empirical audit trail connecting classroom management strategies to observable teacher actions and verifiable video timestamps.')}</text>

  <!-- Table Headers -->
  <rect x="40" y="80" width="280" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="56" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'CHIẾN LƯỢC QUẢN LÝ LỚP HỌC' : 'CLASSROOM MANAGEMENT STRATEGY')}</text>

  <rect x="320" y="80" width="420" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="336" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'HÀNH VI TRIỂN KHAI QUAN SÁT ĐƯỢC' : 'OBSERVED PEDAGOGICAL ENACTMENTS')}</text>

  <rect x="740" y="80" width="200" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="756" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'BÀI GIẢNG TIÊU BIỂU' : 'REPRESENTATIVE LESSONS')}</text>

  <rect x="940" y="80" width="460" height="30" fill="#F4EFE6" stroke="#E8E3D9" stroke-width="1" />
  <text x="956" y="100" font-family="'Plus Jakarta Sans', sans-serif" font-size="11.5" font-weight="700" fill="#1A1612" letter-spacing="0.5">${escapeXml(isVi ? 'TRÍCH DẪN & MỐC THỜI GIAN XÁC THỰC' : 'VERIFIABLE VIDEO QUOTES & TIMESTAMPS')}</text>

  <!-- Content Rows -->
  ${rowsSvg}

  <text x="40" y="${totalHeight - 15}" font-family="'JetBrains Mono', monospace" font-size="11" fill="#A39B92">RQ1 Traceability Matrix • Research Verification Standard • Video Teaching Research</text>
</svg>`;
}

