import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
  convertInchesToTwip,
  ShadingType,
  Header,
  Footer,
  PageNumber,
} from 'docx';
import {
  RepresentativeQuoteItem,
  MeaningUnitItem,
  TriangulationEntryItem,
  InterviewResponseItem,
  InterviewCodeItem,
} from './api';

// Design tokens consistent with the system Word exporter (wordExport.ts & interviewWordExport.ts)
const FONT_NAME = 'Calibri';
const COLOR_PRIMARY = '1E3A8A';    // Academic navy blue
const COLOR_SECONDARY = '4B5563';  // Slate gray
const COLOR_MUTED = '6B7280';      // Muted gray
const COLOR_BORDER = 'D1D5DB';     // Soft subtle gray border
const COLOR_BG_HEADER = 'F1F5F9';  // Slate-100 header fill
const COLOR_BG_CARD = 'F8FAFC';    // Soft slate-50 fill for cards / notes
const COLOR_ACCENT = '9E4A28';     // Terra / Amber badge

// RQ Theme Colors
const COLOR_RQ1_TEXT = '166534';   // Dark emerald green
const COLOR_RQ1_BG = 'EAF4EE';     // Soft green tint
const COLOR_RQ2_TEXT = '1E40AF';   // Academic blue
const COLOR_RQ2_BG = 'EBF3F9';     // Soft blue tint
const COLOR_RQ3_TEXT = '92400E';   // Dark amber
const COLOR_RQ3_BG = 'FEF7EA';     // Soft amber tint

// Triangulation Relationship Colors
const COLOR_REL_CONFIRMS_TEXT = '166534';
const COLOR_REL_CONFIRMS_BG = 'EAF4EE';
const COLOR_REL_EXPLAINS_TEXT = '1E40AF';
const COLOR_REL_EXPLAINS_BG = 'EBF3F9';
const COLOR_REL_CONTRADICTS_TEXT = '991B1B';
const COLOR_REL_CONTRADICTS_BG = 'FEE2E2';
const COLOR_REL_ADDS_TEXT = '92400E';
const COLOR_REL_ADDS_BG = 'FEF7EA';

const BORDER_SUBTLE = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: COLOR_BORDER,
};

const CELL_BORDERS_DEFAULT = {
  top: BORDER_SUBTLE,
  bottom: BORDER_SUBTLE,
  left: BORDER_SUBTLE,
  right: BORDER_SUBTLE,
};

const NO_BORDER = {
  style: BorderStyle.NONE,
  size: 0,
  color: 'FFFFFF',
};

export interface ExportChapter4FindingsData {
  quotes: RepresentativeQuoteItem[];
  selectedTeacher?: string;
  lang?: 'en' | 'vi';
  generatedDate?: string;
}

export interface ExportPerTeacherCaseData {
  teacherId: string;
  meaningUnits?: MeaningUnitItem[];
  triangulation?: TriangulationEntryItem[];
  responses?: InterviewResponseItem[];
  lang?: 'en' | 'vi';
  generatedDate?: string;
}

export interface ExportTeacherTranscriptData {
  teacherId: string;
  responses: InterviewResponseItem[];
  meaningUnits?: MeaningUnitItem[];
  lang?: 'en' | 'vi';
  generatedDate?: string;
}

export interface ExportQualitativeSynthesisData {
  runId?: string;
  codes: InterviewCodeItem[];
  triangulation: TriangulationEntryItem[];
  quotes?: RepresentativeQuoteItem[];
  lang?: 'en' | 'vi';
  generatedDate?: string;
}

function getRQTitle(rq: string, isVi: boolean): string {
  switch (rq) {
    case 'RQ1':
      return isVi
        ? 'RQ1: Chiến Lược Quản Lý Lớp Học Trực Tuyến (Strategies)'
        : 'RQ1: Online Classroom Management Strategies';
    case 'RQ2':
      return isVi
        ? 'RQ2: Nhận Thức & Đánh Giá Của Giáo Viên (Perceptions & Rationale)'
        : 'RQ2: Teacher Perceptions & Pedagogical Rationale';
    case 'RQ3':
      return isVi
        ? 'RQ3: Thách Thức Sư Phạm & Giải Pháp Thực Tiễn (Challenges & Solutions)'
        : 'RQ3: Pedagogical Challenges & Adaptive Solutions';
    default:
      return rq;
  }
}

function getRelevanceLabel(rel: string, isVi: boolean): string {
  switch (rel) {
    case 'explains_observation':
      return isVi ? 'Giải thích thực hành video' : 'Explains Video Practice';
    case 'representative':
      return isVi ? 'Chiến lược điển hình' : 'Representative Strategy';
    case 'notable_difference':
      return isVi ? 'Khác biệt / Điểm đặc biệt' : 'Notable Divergence';
    case 'answers_rq':
      return isVi ? 'Trả lời trực tiếp RQ' : 'Directly Answers RQ';
    default:
      return rel;
  }
}

function getRelationshipBadge(rel: string, isVi: boolean): { label: string; textColor: string; bgColor: string } {
  switch (rel) {
    case 'confirms':
      return {
        label: isVi ? 'Xác Nhận (Confirms)' : 'Confirms Practice',
        textColor: COLOR_REL_CONFIRMS_TEXT,
        bgColor: COLOR_REL_CONFIRMS_BG,
      };
    case 'explains':
      return {
        label: isVi ? 'Giải Thích Lý Do (Explains)' : 'Explains Rationale',
        textColor: COLOR_REL_EXPLAINS_TEXT,
        bgColor: COLOR_REL_EXPLAINS_BG,
      };
    case 'contradicts':
      return {
        label: isVi ? 'Khác Biệt (Divergent)' : 'Contradicts / Divergent',
        textColor: COLOR_REL_CONTRADICTS_TEXT,
        bgColor: COLOR_REL_CONTRADICTS_BG,
      };
    case 'adds_info':
      return {
        label: isVi ? 'Bổ Sung Bối Cảnh (Adds Context)' : 'Adds Context',
        textColor: COLOR_REL_ADDS_TEXT,
        bgColor: COLOR_REL_ADDS_BG,
      };
    default:
      return {
        label: rel,
        textColor: COLOR_SECONDARY,
        bgColor: COLOR_BG_HEADER,
      };
  }
}

/**
 * 1. Generate Chapter 4 Findings Word Document (Representative Interview Quotes)
 */
export async function generateChapter4FindingsWord(data: ExportChapter4FindingsData): Promise<Blob> {
  const { quotes, selectedTeacher, lang = 'en', generatedDate } = data;
  const isVi = lang === 'vi';

  const dateStr =
    generatedDate ||
    new Date().toLocaleDateString(isVi ? 'vi-VN' : 'en-GB', {
      day: '2-digit',
      month: isVi ? '2-digit' : 'short',
      year: 'numeric',
    });

  const children: (Paragraph | Table)[] = [];

  // =========================================================================
  // 1. TITLE & RESEARCH CONTEXT HEADER
  // =========================================================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: isVi
            ? 'CHƯƠNG 4: KẾT QUẢ NGHIÊN CỨU & TRÍCH DẪN PHỎNG VẤN TIÊU BIỂU'
            : 'CHAPTER 4 FINDINGS: REPRESENTATIVE QUALITATIVE INTERVIEW QUOTES',
          font: FONT_NAME,
          size: 30, // 15pt
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: isVi
            ? "Nghiên cứu: Chiến lược quản lý lớp học trực tuyến & Khả năng tương tác nói tiếng Anh của học sinh tiểu học"
            : "Research: Primary EFL Teachers' Online Classroom Management Strategies & Student Speaking Participation",
          font: FONT_NAME,
          size: 20, // 10pt
          italics: true,
          color: COLOR_SECONDARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: isVi
            ? 'Hồ sơ trích dẫn thực nghiệm phục vụ viết luận văn Thạc sĩ / Tiến sĩ (Chuẩn định dạng APA 7th)'
            : 'Curated Empirical Quotation Evidence for Thesis Chapter 4 (APA 7th Format Compliance)',
          font: FONT_NAME,
          size: 18, // 9pt
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // =========================================================================
  // 2. METADATA & DATASET SUMMARY TABLE
  // =========================================================================
  const rq1Count = quotes.filter((q) => q.rq_category === 'RQ1').length;
  const rq2Count = quotes.filter((q) => q.rq_category === 'RQ2').length;
  const rq3Count = quotes.filter((q) => q.rq_category === 'RQ3').length;
  const teacherScopeText = selectedTeacher
    ? `${isVi ? 'Giáo viên đang chọn' : 'Selected Teacher'}: ${selectedTeacher}`
    : (isVi ? 'Toàn bộ 12 Giáo viên (T01–T12)' : 'All 12 Teachers (T01–T12)');

  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: isVi ? 'TỔNG QUAN DỮ LIỆU TRÍCH DẪN ĐỊNH TÍNH' : 'QUALITATIVE EVIDENCE SUMMARY',
          font: FONT_NAME,
          size: 22, // 11pt
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        // Row 1: Scope & Date
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Phạm vi khảo sát:' : 'Target Participant(s):', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: teacherScopeText, font: FONT_NAME, bold: true, size: 19, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Ngày kết xuất:' : 'Export Date:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: dateStr, font: FONT_NAME, size: 19, color: COLOR_SECONDARY })],
                }),
              ],
            }),
          ],
        }),
        // Row 2: Total Quotes & Breakdown
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Tổng số trích dẫn:' : 'Total Golden Quotes:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `${quotes.length} ${isVi ? 'câu trích dẫn chọn lọc' : 'selected quotes'}`, font: FONT_NAME, bold: true, size: 19, color: COLOR_ACCENT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Phân bổ theo RQ:' : 'Distribution by RQ:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `RQ1: ${rq1Count} | RQ2: ${rq2Count} | RQ3: ${rq3Count}`, font: FONT_NAME, size: 19, color: COLOR_SECONDARY }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 100, after: 180 },
      children: [
        new TextRun({
          text: isVi
            ? 'Phương pháp luận: Các phát ngôn được tuyển chọn qua quy trình 6 bước phân tích định tính chuyên sâu (bóc băng nguyên văn, phân tách đơn vị ý nghĩa, mã hóa ban đầu và đối chiếu tam giác với video quan sát).'
            : 'Methodological Note: Quotes were curated through a 6-phase qualitative inquiry pipeline (verbatim transcription, meaning unit segmentation, initial coding, and triangulated validation against video observation).',
          font: FONT_NAME,
          size: 18,
          italics: true,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // =========================================================================
  // 3. RESEARCH QUESTION SECTIONS & CALLOUT QUOTES
  // =========================================================================
  const rqCategories = ['RQ1', 'RQ2', 'RQ3'] as const;

  for (const rq of rqCategories) {
    const rqQuotes = quotes.filter((q) => q.rq_category === rq);

    let rqThemeColor = COLOR_PRIMARY;
    if (rq === 'RQ1') {
      rqThemeColor = COLOR_RQ1_TEXT;
    } else if (rq === 'RQ2') {
      rqThemeColor = COLOR_RQ2_TEXT;
    } else if (rq === 'RQ3') {
      rqThemeColor = COLOR_RQ3_TEXT;
    }

    // RQ Heading Bar
    children.push(
      new Paragraph({
        spacing: { before: 240, after: 80 },
        children: [
          new TextRun({
            text: getRQTitle(rq, isVi),
            font: FONT_NAME,
            size: 24, // 12pt
            bold: true,
            color: rqThemeColor,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 0, after: 120 },
        children: [
          new TextRun({
            text: isVi
              ? `Tổng số trích dẫn đại diện cho ${rq}: ${rqQuotes.length} phát ngôn`
              : `Representative evidence pool for ${rq}: ${rqQuotes.length} selected excerpt(s)`,
            font: FONT_NAME,
            size: 18,
            color: COLOR_MUTED,
            italics: true,
          }),
        ],
      })
    );

    if (rqQuotes.length === 0) {
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 120 },
          children: [
            new TextRun({
              text: isVi
                ? `(Chưa có câu trích dẫn nào được chọn cho ${rq})`
                : `(No representative quotes selected for ${rq} yet)`,
              font: FONT_NAME,
              size: 19,
              color: COLOR_MUTED,
              italics: true,
            }),
          ],
        })
      );
      continue;
    }

    // Render each quote as an APA-styled Callout Table with thick left border
    rqQuotes.forEach((quote) => {
      const quoteLeftBorder = {
        style: BorderStyle.SINGLE,
        size: 24, // 3pt left accent bar
        color: rqThemeColor,
      };

      const quoteCellBorders = {
        top: NO_BORDER,
        bottom: NO_BORDER,
        left: quoteLeftBorder,
        right: NO_BORDER,
      };

      const sourceText = quote.quote_source || (isVi ? 'Phỏng vấn sâu' : 'In-depth Interview');
      const relevanceLabel = getRelevanceLabel(quote.relevance_type, isVi);

      children.push(
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 10000, type: WidthType.DXA },
                  shading: { fill: COLOR_BG_CARD, type: ShadingType.CLEAR },
                  borders: quoteCellBorders,
                  margins: { top: 120, bottom: 120, left: 180, right: 180 },
                  children: [
                    // Excerpt Text
                    new Paragraph({
                      spacing: { before: 0, after: 80 },
                      children: [
                        new TextRun({
                          text: `"${quote.quote_text.trim()}"`,
                          font: FONT_NAME,
                          size: 21, // 10.5pt
                          italics: true,
                          color: '0F172A',
                        }),
                      ],
                    }),
                    // Attribution Line
                    new Paragraph({
                      spacing: { before: 40, after: 0 },
                      children: [
                        new TextRun({
                          text: `— ${isVi ? 'Giáo viên' : 'Teacher'} ${quote.teacher_id}`,
                          font: FONT_NAME,
                          bold: true,
                          size: 19,
                          color: rqThemeColor,
                        }),
                        new TextRun({
                          text: ` • ${sourceText} • `,
                          font: FONT_NAME,
                          size: 18,
                          color: COLOR_MUTED,
                        }),
                        new TextRun({
                          text: `${isVi ? 'Ý nghĩa' : 'Relevance'}: `,
                          font: FONT_NAME,
                          bold: true,
                          size: 18,
                          color: COLOR_SECONDARY,
                        }),
                        new TextRun({
                          text: relevanceLabel,
                          font: FONT_NAME,
                          italics: true,
                          size: 18,
                          color: COLOR_SECONDARY,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 0, after: 100 },
          children: [],
        })
      );
    });
  }

  // =========================================================================
  // 4. APA 7th THESIS IN-TEXT CITATION GUIDELINES
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 260, after: 80 },
      children: [
        new TextRun({
          text: isVi
            ? 'HƯỚNG DẪN TRÍCH DẪN TRONG LUẬN VĂN THEO CHUẨN APA 7TH'
            : 'APA 7TH IN-TEXT CITATION GUIDELINES FOR CHAPTER 4',
          font: FONT_NAME,
          size: 22,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 10000, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 60 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? '1. Định dạng trích dẫn nguyên văn ngắn (dưới 40 từ):'
                        : '1. Short direct quotations (fewer than 40 words):',
                      font: FONT_NAME,
                      bold: true,
                      size: 19,
                      color: '1E293B',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 80 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? 'Đặt trong dấu ngoặc kép liền dòng: Khi mô tả việc ổn định trật tự, giáo viên chia sẻ: "[Nội dung phát ngôn]" (Giáo viên T01, phỏng vấn bán cấu trúc, tháng 3/2026).'
                        : 'Embed within text with quotation marks: When describing classroom routines, the teacher noted, "[Quote text]" (Teacher T01, semi-structured interview, March 2026).',
                      font: FONT_NAME,
                      size: 18,
                      italics: true,
                      color: COLOR_SECONDARY,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 40, after: 60 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? '2. Định dạng khối trích dẫn độc lập (Block Quotation - từ 40 từ trở lên):'
                        : '2. Block quotations (40 words or more):',
                      font: FONT_NAME,
                      bold: true,
                      size: 19,
                      color: '1E293B',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 0 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? 'Thụt lề toàn bộ khối trích dẫn 0.5 inch (1.27 cm) từ lề trái, không đặt trong dấu ngoặc kép, giãn dòng 1.5 hoặc double spacing theo quy định của trường đào tạo.'
                        : 'Indent the whole block 0.5 inches (1.27 cm) from the left margin without quotation marks, maintaining consistent spacing per thesis requirements.',
                      font: FONT_NAME,
                      size: 18,
                      italics: true,
                      color: COLOR_SECONDARY,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Document Assembly with 1-inch margins, running header, and footer
  const headerTitle = isVi
    ? 'Luận Văn: Quản Lý Lớp Học Trực Tuyến & Tương Tác Nói EFL — Trích Dẫn Chương 4'
    : 'EFL Classroom Management Research — Chapter 4 Qualitative Quotations';

  const footerText = isVi
    ? 'Tài liệu nghiên cứu định tính nội bộ • Bảo mật thông tin người tham gia'
    : 'Internal Qualitative Research Protocol • Participant Confidentiality Maintained';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: headerTitle,
                    font: FONT_NAME,
                    size: 16, // 8pt
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${footerText} | `,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: isVi ? 'Trang ' : 'Page ',
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * 2. Generate Step 5: Per-Teacher Case Analysis Word Document
 */
export async function generatePerTeacherCaseWord(data: ExportPerTeacherCaseData): Promise<Blob> {
  const { teacherId, meaningUnits = [], triangulation = [], lang = 'en', generatedDate } = data;
  const isVi = lang === 'vi';

  const dateStr =
    generatedDate ||
    new Date().toLocaleDateString(isVi ? 'vi-VN' : 'en-GB', {
      day: '2-digit',
      month: isVi ? '2-digit' : 'short',
      year: 'numeric',
    });

  const children: (Paragraph | Table)[] = [];

  // Filter triangulation entries for this teacher
  const teacherTriangulation = triangulation.filter((t) => t.teacher_ref === teacherId);

  // =========================================================================
  // 1. TITLE & SUBTITLE
  // =========================================================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: isVi
            ? `BÁO CÁO PHÂN TÍCH CA ĐIỂN HÌNH THEO GIÁO VIÊN: ${teacherId}`
            : `PER-TEACHER QUALITATIVE CASE STUDY REPORT: TEACHER ${teacherId}`,
          font: FONT_NAME,
          size: 30, // 15pt
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: isVi
            ? 'Phân tích nghiên cứu ca: Đối chiếu tam giác hóa giữa video thực nghiệm và phỏng vấn hồi cứu'
            : 'Qualitative Case Study: Triangulation of Classroom Observation Practice and In-Depth Interview',
          font: FONT_NAME,
          size: 20, // 10pt
          italics: true,
          color: COLOR_SECONDARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: isVi
            ? 'Cơ sở dữ liệu luận văn Chương 4: Bằng chứng hành vi, đơn vị ý nghĩa & mô hình sư phạm cá thể'
            : 'Thesis Chapter 4 Empirical Dossier: Behavioral Evidence, Meaning Units & Individual Pedagogical Profile',
          font: FONT_NAME,
          size: 18, // 9pt
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // =========================================================================
  // 2. TEACHER PROFILE & CASE METADATA TABLE
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: isVi ? 'HỒ SƠ TỔNG QUAN CA NGHIÊN CỨU' : 'TEACHER CASE STUDY PROFILE',
          font: FONT_NAME,
          size: 22,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        // Row 1: Teacher ID & Observed Lessons
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Mã giáo viên:' : 'Teacher ID:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: teacherId, font: FONT_NAME, bold: true, size: 20, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Tiết dạy quan sát:' : 'Observed Lessons:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `${teacherId}_L1 & ${teacherId}_L2`, font: FONT_NAME, bold: true, size: 19, color: COLOR_ACCENT })],
                }),
              ],
            }),
          ],
        }),
        // Row 2: Meaning Units & Triangulated Findings
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Đơn vị ý nghĩa:' : 'Meaning Units:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `${meaningUnits.length} ${isVi ? 'đơn vị đã phân tách' : 'extracted units'}`, font: FONT_NAME, size: 19, color: COLOR_SECONDARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Phát hiện đối chiếu:' : 'Triangulated Findings:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `${teacherTriangulation.length} ${isVi ? 'phát hiện tam giác hóa' : 'confirmed points'}`, font: FONT_NAME, size: 19, color: COLOR_SECONDARY })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 180 },
      children: [],
    })
  );

  // =========================================================================
  // 3. PART I: IN-DEPTH INTERVIEW MEANING UNITS & INITIAL CODES TABLE
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({
          text: isVi
            ? 'PHẦN I: DANH SÁCH ĐƠN VỊ Ý NGHĨA & MÃ HÓA BAN ĐẦU (MEANING UNITS)'
            : 'PART I: IN-DEPTH INTERVIEW MEANING UNITS & INITIAL CODING',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: isVi
            ? `Các phát ngôn nguyên văn của giáo viên ${teacherId} được phân đoạn thành từng đơn vị ngữ nghĩa độc lập kèm phân loại chuyên môn.`
            : `Verbatim interview statements of Teacher ${teacherId} segmented into distinct semantic units with emergent codes and categories.`,
          font: FONT_NAME,
          size: 18,
          italics: true,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  if (meaningUnits.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [
          new TextRun({
            text: isVi
              ? `(Chưa có đơn vị ý nghĩa nào được phân tách cho giáo viên ${teacherId})`
              : `(No meaning units segmented for Teacher ${teacherId} yet)`,
            font: FONT_NAME,
            size: 19,
            italics: true,
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  } else {
    const unitsTableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 700, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'Ý số' : 'No.', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Mã Ban Đầu / Category' : 'Initial Code / Category', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 6900, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Phát Ngôn Nguyên Văn (Verbatim Statement)' : 'Verbatim Statement / Excerpt', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
        ],
      }),
    ];

    meaningUnits.forEach((unit, idx) => {
      const rowShading = idx % 2 === 1 ? COLOR_BG_CARD : 'FFFFFF';
      const codeText = unit.initial_code || (isVi ? 'Chưa gắn mã' : 'Uncoded');
      const catText = unit.category ? `[${unit.category}]` : '';

      unitsTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 700, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: `#${unit.unit_index || idx + 1}`, font: FONT_NAME, size: 18, color: COLOR_SECONDARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: codeText, font: FONT_NAME, bold: true, size: 18, color: COLOR_PRIMARY }),
                  ],
                }),
                catText
                  ? new Paragraph({
                      spacing: { before: 20, after: 0 },
                      children: [new TextRun({ text: catText, font: FONT_NAME, italics: true, size: 16, color: COLOR_MUTED })],
                    })
                  : new Paragraph({ children: [] }),
              ],
            }),
            new TableCell({
              width: { size: 6900, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `"${unit.unit_text.trim()}"`,
                      font: FONT_NAME,
                      size: 18,
                      italics: true,
                      color: '1E293B',
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 10000, type: WidthType.DXA },
        rows: unitsTableRows,
      }),
      new Paragraph({
        spacing: { before: 40, after: 160 },
        children: [],
      })
    );
  }

  // =========================================================================
  // 4. PART II: OBSERVATION-INTERVIEW TRIANGULATION MATRIX
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: isVi
            ? 'PHẦN II: MA TRẬN ĐỐI CHIẾU TAM GIÁC HÓA (TRIANGULATION MATRIX)'
            : 'PART II: VIDEO OBSERVATION VS. INTERVIEW TRIANGULATION MATRIX',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: isVi
            ? `Đối sánh trực tiếp giữa hành vi thực tế quan sát qua video tiết dạy (${teacherId}_L1 & ${teacherId}_L2) và phản hồi tự đánh giá trong phỏng vấn.`
            : `Direct cross-examination between observed video classroom practices (${teacherId}_L1 & ${teacherId}_L2) and self-reported interview explanations.`,
          font: FONT_NAME,
          size: 18,
          italics: true,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  if (teacherTriangulation.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 140 },
        children: [
          new TextRun({
            text: isVi
              ? `(Chưa có cặp đối chiếu tam giác hóa nào được ghi nhận riêng cho ${teacherId}. Hãy chạy bước "Đối Chiếu Tam Giác" trong hệ thống).`
              : `(No specific triangulation records found for ${teacherId}. Run the Triangulation step in Interview Analysis studio).`,
            font: FONT_NAME,
            size: 19,
            italics: true,
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  } else {
    const triTableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Phát Hiện Quan Sát Video' : 'Video Observation Finding', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3800, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Bằng Chứng Phỏng Vấn Tự Thuật' : 'Teacher Interview Self-Report', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2600, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'Mối Quan Hệ Định Tính' : 'Qualitative Relationship', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
        ],
      }),
    ];

    teacherTriangulation.forEach((entry, idx) => {
      const rowShading = idx % 2 === 1 ? COLOR_BG_CARD : 'FFFFFF';
      const badge = getRelationshipBadge(entry.relationship, isVi);

      triTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: entry.observation_finding, font: FONT_NAME, size: 18, color: '0F172A' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3800, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.TOP,
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `"${entry.interview_evidence.trim()}"`,
                      font: FONT_NAME,
                      size: 18,
                      italics: true,
                      color: '1E293B',
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              shading: { fill: badge.bgColor, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: badge.label,
                      font: FONT_NAME,
                      bold: true,
                      size: 18,
                      color: badge.textColor,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 10000, type: WidthType.DXA },
        rows: triTableRows,
      }),
      new Paragraph({
        spacing: { before: 40, after: 160 },
        children: [],
      })
    );
  }

  // =========================================================================
  // 5. PART III: QUALITATIVE CASE SYNTHESIS & REFLEXIVE MEMOS
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: isVi
            ? 'PHẦN III: TỔNG HỢP CA SƯ PHẠM & GHI CHÚ SUY NGẪM NGHIÊN CỨU'
            : 'PART III: PEDAGOGICAL CASE SYNTHESIS & RESEARCHER REFLECTIVE MEMOS',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 10000, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 140, bottom: 140, left: 160, right: 160 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 60 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? `1. Đặc điểm sư phạm nổi bật của ca giáo viên ${teacherId}:`
                        : `1. Salient pedagogical features of Teacher ${teacherId}:`,
                      font: FONT_NAME,
                      bold: true,
                      size: 19,
                      color: '1E293B',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 80 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? `• Mức độ nhất quán giữa chiến lược quan sát trong 2 tiết (${teacherId}_L1 & ${teacherId}_L2) và lý giải mục tiêu sư phạm khi phỏng vấn.\n• Điểm mạnh cốt lõi trong duy trì kỷ luật trực tuyến và thúc đẩy học sinh nói tiếng Anh.`
                        : `• Level of congruence between observed practices across 2 lessons (${teacherId}_L1 & ${teacherId}_L2) and post-lesson reflections.\n• Core strengths in sustaining online engagement and stimulating oral participation.`,
                      font: FONT_NAME,
                      size: 18,
                      color: COLOR_SECONDARY,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 40, after: 60 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? '2. Ghi chú suy ngẫm của nhà nghiên cứu (Researcher Memos & Thesis Writing Notes):'
                        : '2. Researcher reflective memos for thesis drafting (Chapter 4):',
                      font: FONT_NAME,
                      bold: true,
                      size: 19,
                      color: '1E293B',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 120 },
                  children: [
                    new TextRun({
                      text: isVi
                        ? '• Khoảng cách giữa nhận thức và thực tế (nếu có):\n\n• Đóng góp của ca này cho việc trả lời các câu hỏi nghiên cứu RQ1, RQ2, RQ3:\n\n\n'
                        : '• Divergence between beliefs and classroom enactment (if any):\n\n• Case contribution to answering overarching research questions RQ1, RQ2, RQ3:\n\n\n',
                      font: FONT_NAME,
                      size: 18,
                      color: COLOR_MUTED,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    })
  );

  // Document Assembly
  const headerTitle = isVi
    ? `Luận Văn: Báo Cáo Ca Giáo Viên ${teacherId} — Phân Tích Định Tính Chương 4`
    : `EFL Classroom Research — Case Study Report: Teacher ${teacherId}`;

  const footerText = isVi
    ? 'Tài liệu nghiên cứu định tính nội bộ • Dữ liệu ẩn danh chuẩn đạo đức nghiên cứu'
    : 'Qualitative Research Dossier • Anonymized Participant Ethical Compliance';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: headerTitle,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: `${footerText} | `,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: isVi ? 'Trang ' : 'Page ',
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * 3. Generate Teacher Interview Verbatim Transcript Word Document
 */
export async function generateTeacherTranscriptWord(data: ExportTeacherTranscriptData): Promise<Blob> {
  const { teacherId, responses = [], meaningUnits = [], lang = 'en', generatedDate } = data;
  const isVi = lang === 'vi';

  const dateStr =
    generatedDate ||
    new Date().toLocaleDateString(isVi ? 'vi-VN' : 'en-GB', {
      day: '2-digit',
      month: isVi ? '2-digit' : 'short',
      year: 'numeric',
    });

  const children: (Paragraph | Table)[] = [];

  // =========================================================================
  // 1. TITLE & RESEARCH CONTEXT HEADER
  // =========================================================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: isVi
            ? `BIÊN BẢN GỠ BĂNG PHỎNG VẤN SÂU: GIÁO VIÊN ${teacherId}`
            : `IN-DEPTH INTERVIEW VERBATIM TRANSCRIPT PROTOCOL: TEACHER ${teacherId}`,
          font: FONT_NAME,
          size: 30,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: isVi
            ? 'Dữ liệu đối thoại nguyên văn, phân đoạn hỏi-đáp (Q&A) & vết kiểm toán định tính'
            : 'Verbatim dialogue records, Question-Response (Q&A) alignment, and qualitative audit trail',
          font: FONT_NAME,
          size: 20,
          italics: true,
          color: COLOR_SECONDARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: isVi
            ? 'Hồ sơ nghiên cứu định tính nội bộ • Bảo mật thông tin & Ẩn danh người tham gia (APA 7th Format)'
            : 'Internal Qualitative Research Dossier • Participant Confidentiality & Anonymity Compliance',
          font: FONT_NAME,
          size: 18,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // =========================================================================
  // 2. METADATA & PROTOCOL SUMMARY TABLE
  // =========================================================================
  const qaResponses = responses.filter((r) => r.question_text !== 'Full Teacher Interview Recording');
  const targetResponses = qaResponses.length > 0 ? qaResponses : responses;
  const finalizedCount = targetResponses.filter((r) => r.transcript_status === 'finalized').length;
  const totalDurationSec = targetResponses.reduce((acc, r) => acc + (r.audio_duration_sec || 0), 0);
  const minutes = Math.floor(totalDurationSec / 60);
  const seconds = Math.round(totalDurationSec % 60);
  const durationText = totalDurationSec > 0 ? `${minutes}m ${seconds}s` : (isVi ? 'Không xác định' : 'N/A');

  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: isVi ? 'THÔNG TIN BUỔI PHỎNG VẤN & TRẠNG THÁI KIỂM ĐỊNH' : 'INTERVIEW PROTOCOL & AUDIT SUMMARY',
          font: FONT_NAME,
          size: 22,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Mã giáo viên:' : 'Teacher ID:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: teacherId, font: FONT_NAME, bold: true, size: 20, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Ngày xuất hồ sơ:' : 'Date Generated:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: dateStr, font: FONT_NAME, size: 19, color: COLOR_SECONDARY })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Số câu hỏi Q&A:' : 'Q&A Items:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${targetResponses.length} ${isVi ? 'câu hỏi gỡ băng' : 'question units'}`,
                      font: FONT_NAME,
                      size: 19,
                      color: COLOR_SECONDARY,
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Trạng thái kiểm chuẩn:' : 'Audit Status:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: `${finalizedCount}/${targetResponses.length} ${isVi ? 'đã chốt (Finalized)' : 'finalized'}`,
                      font: FONT_NAME,
                      bold: true,
                      size: 19,
                      color: finalizedCount === targetResponses.length ? '166534' : '92400E',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 180 },
      children: [],
    })
  );

  // =========================================================================
  // 3. DETAILED VERBATIM Q&A PROTOCOL
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({
          text: isVi ? 'CHI TIẾT ĐỐI THOẠI HỎI - ĐÁP NGUYÊN VĂN (VERBATIM Q&A PROTOCOL)' : 'DETAILED VERBATIM Q&A INTERVIEW PROTOCOL',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 140 },
      children: [
        new TextRun({
          text: isVi
            ? 'Bản ghi nguyên văn các phát ngôn của người phỏng vấn và câu trả lời của giáo viên được khớp mã thời gian và đồng bộ hóa.'
            : 'Synchronized dialogue transcript containing researcher prompts and verbatim teacher verbalizations.',
          font: FONT_NAME,
          size: 18,
          italics: true,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  if (targetResponses.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [
          new TextRun({
            text: isVi
              ? `(Chưa có dữ liệu gỡ băng phỏng vấn được tải lên hoặc ghi nhận cho giáo viên ${teacherId})`
              : `(No interview transcript data recorded for Teacher ${teacherId} yet)`,
            font: FONT_NAME,
            size: 19,
            italics: true,
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  } else {
    targetResponses.forEach((resp, idx) => {
      const qText = resp.question_text || (isVi ? `Câu hỏi phỏng vấn số ${idx + 1}` : `Interview Prompt #${idx + 1}`);
      const textContent = resp.response_text?.trim() || resp.raw_transcript?.trim() || (isVi ? '(Chưa có văn bản gỡ băng)' : '(Transcript unavailable)');
      const associatedUnits = meaningUnits.filter((u) => u.response_id === resp.id);

      // Question Banner
      children.push(
        new Table({
          width: { size: 10000, type: WidthType.DXA },
          rows: [
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 10000, type: WidthType.DXA },
                  shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
                  borders: CELL_BORDERS_DEFAULT,
                  margins: { top: 120, bottom: 120, left: 140, right: 140 },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 40 },
                      children: [
                        new TextRun({
                          text: `${isVi ? 'CÂU HỎI' : 'QUESTION'} #${idx + 1}: `,
                          font: FONT_NAME,
                          bold: true,
                          size: 19,
                          color: COLOR_PRIMARY,
                        }),
                        new TextRun({
                          text: qText,
                          font: FONT_NAME,
                          bold: true,
                          size: 19,
                          color: '1E293B',
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 0, after: 0 },
                      children: [
                        new TextRun({
                          text: `${isVi ? 'Trạng thái' : 'Status'}: ${resp.transcript_status.toUpperCase()} | ${isVi ? 'Ngôn ngữ' : 'Language'}: ${resp.language || 'vi'} | ${isVi ? 'File' : 'Audio'}: ${resp.audio_filename || 'Recording'}`,
                          font: FONT_NAME,
                          size: 16,
                          color: COLOR_MUTED,
                        }),
                      ],
                    }),
                  ],
                }),
              ],
            }),
            new TableRow({
              children: [
                new TableCell({
                  width: { size: 10000, type: WidthType.DXA },
                  borders: CELL_BORDERS_DEFAULT,
                  margins: { top: 140, bottom: 140, left: 160, right: 160 },
                  children: [
                    new Paragraph({
                      spacing: { before: 0, after: 60 },
                      children: [
                        new TextRun({
                          text: `${isVi ? 'Phản hồi nguyên văn của Giáo viên' : `Teacher ${teacherId} Verbatim Verbalization`}:`,
                          font: FONT_NAME,
                          bold: true,
                          size: 18,
                          color: '475569',
                        }),
                      ],
                    }),
                    new Paragraph({
                      spacing: { before: 0, after: associatedUnits.length > 0 ? 100 : 0 },
                      children: [
                        new TextRun({
                          text: `"${textContent}"`,
                          font: FONT_NAME,
                          size: 19,
                          color: '0F172A',
                        }),
                      ],
                    }),
                    ...(associatedUnits.length > 0
                      ? [
                          new Paragraph({
                            spacing: { before: 80, after: 40 },
                            children: [
                              new TextRun({
                                text: isVi
                                  ? `→ Đơn vị ý nghĩa đã phân tách (${associatedUnits.length} units):`
                                  : `→ Segmented Meaning Units (${associatedUnits.length} units):`,
                                font: FONT_NAME,
                                bold: true,
                                size: 17,
                                color: COLOR_ACCENT,
                              }),
                            ],
                          }),
                          ...associatedUnits.map(
                            (u, uIdx) =>
                              new Paragraph({
                                spacing: { before: 20, after: 20 },
                                children: [
                                  new TextRun({
                                    text: `  • [Ý ${uIdx + 1}] "${u.unit_text}" `,
                                    font: FONT_NAME,
                                    size: 17,
                                    color: COLOR_SECONDARY,
                                  }),
                                  new TextRun({
                                    text: `— Mã: ${u.initial_code || 'N/A'} (${u.category || 'General'})`,
                                    font: FONT_NAME,
                                    bold: true,
                                    size: 17,
                                    color: COLOR_PRIMARY,
                                  }),
                                ],
                              })
                          ),
                        ]
                      : []),
                  ],
                }),
              ],
            }),
          ],
        }),
        new Paragraph({
          spacing: { before: 40, after: 120 },
          children: [],
        })
      );
    });
  }

  // Document Assembly
  const headerTitle = isVi
    ? `Luận Văn: Biên Bản Gỡ Băng Phỏng Vấn Giáo Viên ${teacherId}`
    : `Qualitative In-Depth Interview Protocol — Teacher ${teacherId}`;

  const footerText = isVi
    ? 'Tài liệu nghiên cứu gỡ băng nguyên văn • Lưu trữ kiểm toán phương pháp luận (Audit Trail)'
    : 'Verbatim Qualitative Transcript • Methodological Audit Trail Compliance';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: headerTitle,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: footerText,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: '\t\t',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * 4. Generate Thematic Codebook & Cross-Case Triangulation Synthesis Word Document
 */
export async function generateQualitativeSynthesisWord(data: ExportQualitativeSynthesisData): Promise<Blob> {
  const { runId, codes = [], triangulation = [], quotes = [], lang = 'en', generatedDate } = data;
  const isVi = lang === 'vi';

  const dateStr =
    generatedDate ||
    new Date().toLocaleDateString(isVi ? 'vi-VN' : 'en-GB', {
      day: '2-digit',
      month: isVi ? '2-digit' : 'short',
      year: 'numeric',
    });

  const children: (Paragraph | Table)[] = [];

  // =========================================================================
  // 1. TITLE & SUBTITLE
  // =========================================================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: isVi
            ? 'SỔ TAY MÃ HÓA ĐỊNH TÍNH & MA TRẬN ĐỐI CHIẾU TAM GIÁC XUYÊN TRƯỜNG HỢP'
            : 'QUALITATIVE THEMATIC CODEBOOK & CROSS-CASE TRIANGULATION SYNTHESIS',
          font: FONT_NAME,
          size: 30,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 60 },
      children: [
        new TextRun({
          text: isVi
            ? 'Tổng hợp hệ thống mã hóa thực nghiệm, cấu trúc chủ đề và đối chiếu đa nguồn trên 12 giáo viên'
            : 'Comprehensive thematic hierarchy, code frequencies across 12 teachers, and multi-source triangulation matrix',
          font: FONT_NAME,
          size: 20,
          italics: true,
          color: COLOR_SECONDARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [
        new TextRun({
          text: isVi
            ? 'Hồ sơ phương pháp luận nghiên cứu thực nghiệm hỗn hợp (Mixed-Methods Triangulation Protocol - APA 7th)'
            : 'Mixed-Methods Empirical Triangulation Dossier & Thematic Coding Framework (APA 7th Format)',
          font: FONT_NAME,
          size: 18,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // =========================================================================
  // 2. METADATA SUMMARY TABLE
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 120, after: 80 },
      children: [
        new TextRun({
          text: isVi ? 'TỔNG QUAN PHIÊN PHÂN TÍCH ĐỊNH TÍNH' : 'QUALITATIVE ANALYSIS RUN OVERVIEW',
          font: FONT_NAME,
          size: 22,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Phiên phân tích:' : 'Analysis Run:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: runId ? `${runId.slice(0, 8)}...` : 'Latest Active Run', font: FONT_NAME, bold: true, size: 19, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Mẫu nghiên cứu:' : 'Sample Size:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? '12 Giáo viên (T01–T12)' : '12 Teachers (T01–T12)', font: FONT_NAME, bold: true, size: 19, color: COLOR_ACCENT })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Tổng số mã (Codes):' : 'Thematic Codes:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `${codes.length} ${isVi ? 'mã định tính' : 'codes identified'}`, font: FONT_NAME, size: 19, color: COLOR_SECONDARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2400, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Điểm đối chiếu tam giác:' : 'Triangulation Points:', font: FONT_NAME, bold: true, size: 19, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `${triangulation.length} ${isVi ? 'mục tam giác hóa' : 'triangulated entries'}`, font: FONT_NAME, size: 19, color: COLOR_SECONDARY })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 80, after: 180 },
      children: [],
    })
  );

  // =========================================================================
  // 3. PART I: QUALITATIVE THEMATIC CODEBOOK
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 180, after: 80 },
      children: [
        new TextRun({
          text: isVi ? 'PHẦN I: SỔ TAY MÃ HÓA ĐỊNH TÍNH (QUALITATIVE THEMATIC CODEBOOK)' : 'PART I: QUALITATIVE THEMATIC CODEBOOK & HIERARCHY',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: isVi
            ? 'Bảng danh mục mã định tính, chủ đề sư phạm, tần suất xuất hiện và phân bố trên 12 giáo viên tiểu học.'
            : 'Operational qualitative codebook defining emerging pedagogical categories, coding occurrences, and teacher distributions.',
          font: FONT_NAME,
          size: 18,
          italics: true,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  if (codes.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [
          new TextRun({
            text: isVi ? '(Chưa có mã định tính nào trong phiên phân tích này)' : '(No qualitative codes recorded for this analysis run yet)',
            font: FONT_NAME,
            size: 19,
            italics: true,
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  } else {
    const codeRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 600, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'STT' : 'No.', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3000, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Tên mã định tính (Code)' : 'Code Name', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3200, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Chủ đề sư phạm (Category)' : 'Pedagogical Category', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'Tần suất' : 'Freq.', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2000, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'Giáo viên' : 'Teachers', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
        ],
      }),
    ];

    codes.forEach((c, idx) => {
      const isEven = idx % 2 === 0;
      const cellBg = isEven ? 'FFFFFF' : COLOR_BG_CARD;
      const teacherStr = Array.isArray(c.teacher_ids) && c.teacher_ids.length > 0 ? c.teacher_ids.join(', ') : '—';

      codeRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 600, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(idx + 1), font: FONT_NAME, size: 18, color: COLOR_SECONDARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3000, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c.code_name, font: FONT_NAME, bold: true, size: 18, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3200, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: c.category, font: FONT_NAME, size: 18, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1200, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(c.frequency), font: FONT_NAME, bold: true, size: 18, color: COLOR_ACCENT })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2000, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: teacherStr, font: FONT_NAME, size: 17, color: COLOR_SECONDARY })],
                }),
              ],
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 10000, type: WidthType.DXA },
        rows: codeRows,
      }),
      new Paragraph({
        spacing: { before: 40, after: 180 },
        children: [],
      })
    );
  }

  // =========================================================================
  // 4. PART II: CROSS-CASE TRIANGULATION SYNTHESIS MATRIX
  // =========================================================================
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: isVi
            ? 'PHẦN II: MA TRẬN ĐỐI CHIẾU TAM GIÁC ĐA NGUỒN (TRIANGULATION SYNTHESIS)'
            : 'PART II: MULTI-SOURCE EMPIRICAL TRIANGULATION MATRIX',
          font: FONT_NAME,
          size: 24,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: isVi
            ? 'Tổng hợp các mối quan hệ đối chiếu giữa hành vi quan sát qua video và lý giải phỏng vấn định tính của giáo viên.'
            : 'Triangulation synthesis matrix contrasting quantitative classroom video metrics against qualitative interview justifications.',
          font: FONT_NAME,
          size: 18,
          italics: true,
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  if (triangulation.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 40, after: 120 },
        children: [
          new TextRun({
            text: isVi ? '(Chưa có dữ liệu đối chiếu tam giác trong phiên này)' : '(No triangulation entries generated yet)',
            font: FONT_NAME,
            size: 19,
            italics: true,
            color: COLOR_MUTED,
          }),
        ],
      })
    );
  } else {
    const triTableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 600, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'STT' : 'No.', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1000, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'GV' : 'Teacher', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3400, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Phát hiện quan sát Video' : 'Video Observation Finding', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3400, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: isVi ? 'Bằng chứng phỏng vấn hồi cứu' : 'Teacher Interview Reflection', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1600, type: WidthType.DXA },
            shading: { fill: COLOR_PRIMARY, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: isVi ? 'Quan hệ đối chiếu' : 'Triangulation Relation', font: FONT_NAME, bold: true, size: 18, color: 'FFFFFF' })],
              }),
            ],
          }),
        ],
      }),
    ];

    triangulation.forEach((item, idx) => {
      const badge = getRelationshipBadge(item.relationship, isVi);
      const isEven = idx % 2 === 0;
      const cellBg = isEven ? 'FFFFFF' : COLOR_BG_CARD;

      triTableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 600, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(idx + 1), font: FONT_NAME, size: 18, color: COLOR_SECONDARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1000, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: item.teacher_ref || 'All', font: FONT_NAME, bold: true, size: 18, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3400, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: item.observation_finding, font: FONT_NAME, size: 18, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3400, type: WidthType.DXA },
              shading: { fill: cellBg, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: `"${item.interview_evidence}"`, font: FONT_NAME, italics: true, size: 18, color: '334155' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1600, type: WidthType.DXA },
              shading: { fill: badge.bgColor, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: badge.label,
                      font: FONT_NAME,
                      bold: true,
                      size: 17,
                      color: badge.textColor,
                    }),
                  ],
                }),
              ],
            }),
          ],
        })
      );
    });

    children.push(
      new Table({
        width: { size: 10000, type: WidthType.DXA },
        rows: triTableRows,
      }),
      new Paragraph({
        spacing: { before: 40, after: 180 },
        children: [],
      })
    );
  }

  // Document Assembly
  const headerTitle = isVi
    ? 'Luận Văn: Sổ Tay Mã Hóa & Đối Chiếu Tam Giác Đa Nguồn'
    : 'Qualitative Codebook & Multi-Source Triangulation Synthesis';

  const footerText = isVi
    ? 'Hồ sơ phương pháp luận nghiên cứu thực nghiệm • Chuẩn độ tin cậy Lincoln & Guba (1985)'
    : 'Mixed-Methods Methodology Dossier • Trustworthiness & Dependability Compliance';

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({
                    text: headerTitle,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: footerText,
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                  new TextRun({
                    text: '\t\t',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT, ' / ', PageNumber.TOTAL_PAGES],
                    font: FONT_NAME,
                    size: 16,
                    color: COLOR_MUTED,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

/**
 * Trigger file download in browser for generated Word document Blob
 */
export function downloadWordBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
