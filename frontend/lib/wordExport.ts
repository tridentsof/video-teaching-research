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
  HeadingLevel,
} from 'docx';
import { Report, Video, ReportItem, ReportItemOccurrence } from './api';

export interface ExportReportData {
  report: Report;
  video?: Video | null;
  observationNo?: string;
  className?: string;
  platform?: string;
  generalNotes?: string;
  lang?: 'en' | 'vi';
}

export const SECTION_NAMES: Record<string, string> = {
  A: 'Section A. Establishing Online Rules and Routines',
  B: 'Section B. Managing Turn-taking and Speaking Participation',
  C: 'Section C. Sustaining Learner Attention and Engagement',
  D: 'Section D. Providing Scaffolding and Positive Reinforcement',
  E: 'Section E. Using Digital Tools to Support Learning and Interaction',
};

export const SECTION_NAMES_VI: Record<string, string> = {
  A: 'Phần A. Thiết lập quy tắc và nền nếp trực tuyến',
  B: 'Phần B. Quản lý lượt nói và sự tham gia phát biểu',
  C: 'Phần C. Duy trì sự chú ý và tương tác của học sinh',
  D: 'Phần D. Hỗ trợ sư phạm (Scaffolding) và khích lệ tích cực',
  E: 'Phần E. Sử dụng công cụ số hỗ trợ học tập và tương tác',
};

export const DEFAULT_CHECKLIST_STRUCTURE: Record<string, string[]> = {
  A: [
    'Teacher explains classroom rules',
    'Teacher reminds students of classroom expectations',
    'Teacher establishes lesson routines',
    'Teacher provides clear task instructions',
    'Teacher manages transitions between activities',
  ],
  B: [
    'Teacher nominates students to speak',
    'Teacher encourages volunteers',
    'Teacher provides wait time',
    'Teacher encourages quieter learners',
    'Teacher balances speaking opportunities',
    'Teacher organises pair/group speaking tasks',
  ],
  C: [
    'Teacher monitors learner attention',
    'Teacher checks understanding',
    'Teacher asks follow-up questions',
    'Teacher redirects distracted learners',
    'Teacher maintains lesson pace',
    'Teacher motivates learners to participate',
  ],
  D: [
    'Teacher models target language',
    'Teacher provides sentence starters',
    'Teacher uses prompts',
    'Teacher gives praise and encouragement',
    'Teacher provides corrective feedback',
    'Teacher adjusts support based on learners\' responses',
  ],
  E: [
    'Teacher uses the chat box',
    'Teacher uses reaction icons',
    'Teacher uses breakout rooms',
    'Teacher shares screen',
    'Teacher uses a digital whiteboard',
    'Teacher uses polls or annotation tools',
  ],
};

// Design tokens consistent with Interview Studio
const DEFAULT_FONT = 'Calibri';
const COLOR_PRIMARY = '1E3A8A';    // Academic navy blue
const COLOR_SECONDARY = '4B5563';  // Slate gray
const COLOR_MUTED = '6B7280';      // Muted gray
const COLOR_BORDER = 'D1D5DB';     // Soft subtle gray border
const COLOR_BG_HEADER = 'F1F5F9';  // Slate-100 header fill
const COLOR_BG_CARD = 'F8FAFC';    // Soft slate-50 fill for cards / notes
const COLOR_ACCENT = '9E4A28';     // Terra / Amber badge for Teacher ID
const COLOR_YES_TEXT = '166534';   // Dark emerald green
const COLOR_YES_BG = 'EAF4EE';     // Soft mint green fill
const COLOR_NO_TEXT = '9CA3AF';    // Muted gray
const COLOR_TIMESTAMP = '2563EB';  // Academic blue

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

function formatSeconds(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function buildSingleReportChildren(
  data: ExportReportData,
  fontName = DEFAULT_FONT,
  cellBorders = CELL_BORDERS_DEFAULT
): (Paragraph | Table)[] {
  const { report, video, observationNo, className, platform, generalNotes, lang = 'en' } = data;
  const isVi = lang === 'vi';

  // Map existing items
  const itemsByText: Record<string, ReportItem> = {};
  if (report.items) {
    for (const item of report.items) {
      itemsByText[item.checklist_text.trim().toLowerCase()] = item;
    }
  }

  const sectionsToRender = ['A', 'B', 'C', 'D', 'E'];
  const docChildren: (Paragraph | Table)[] = [];

  // ==========================================
  // 1. TITLE & SUBTITLE
  // ==========================================
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [
        new TextRun({
          text: isVi ? 'BẢNG KIỂM QUAN SÁT LỚP HỌC TRỰC TUYẾN' : 'CLASSROOM OBSERVATION CHECKLIST',
          font: fontName,
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
          font: fontName,
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
            ? 'Khung nghiên cứu: Bảng kiểm quan sát video sư phạm 5 phần (Phần A đến E - 29 Chỉ báo hành vi)'
            : 'Theoretical Framework: 5-Section Classroom Observation Protocol (Sections A to E - 29 Indicators)',
          font: fontName,
          size: 18, // 9pt
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // ==========================================
  // 2. LESSON INFORMATION (METADATA TABLE)
  // ==========================================
  const obsNum = observationNo || (video ? `#${video.id.slice(0, 8)}` : '#01');
  const teacherName = video?.teacher_id || report.teacher_id || '___________';
  const dateStr = video?.uploaded_at
    ? new Date(video.uploaded_at).toISOString().split('T')[0]
    : (report.generated_at ? new Date(report.generated_at).toISOString().split('T')[0] : '___________');
  const cls = className || (isVi ? 'Lớp tiếng Anh trực tuyến' : 'Online English Class');
  const plat = platform || 'Zoom';
  const topic = video?.title || '___________';
  const durationStr = video?.duration_sec ? `${formatSeconds(video.duration_sec)}` : '___________';

  docChildren.push(
    new Paragraph({
      spacing: { before: 140, after: 100 },
      children: [
        new TextRun({
          text: isVi ? 'THÔNG TIN TIẾT HỌC QUAN SÁT' : 'LESSON OBSERVATION INFORMATION',
          font: fontName,
          size: 22, // 11pt
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        // Row 1: Observation No. & Teacher ID
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Lượt quan sát:' : 'Observation No.:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: obsNum, font: fontName, bold: true, size: 20, color: COLOR_PRIMARY })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Giáo viên:' : 'Teacher ID:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: teacherName, font: fontName, bold: true, size: 21, color: COLOR_ACCENT })],
                }),
              ],
            }),
          ],
        }),
        // Row 2: Date & Duration
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Ngày quan sát:' : 'Date:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: dateStr, font: fontName, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Thời lượng:' : 'Duration:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: durationStr, font: fontName, size: 20 })],
                }),
              ],
            }),
          ],
        }),
        // Row 3: Class & Platform
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Lớp học:' : 'Class:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: cls, font: fontName, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Nền tảng:' : 'Platform:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: plat, font: fontName, size: 20 })],
                }),
              ],
            }),
          ],
        }),
        // Row 4: Lesson Topic
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Chủ đề bài học:' : 'Lesson Topic:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7800, type: WidthType.DXA },
              columnSpan: 3,
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: topic, font: fontName, size: 20, bold: true })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 180, after: 80 } })
  );

  // ==========================================
  // 3. SECTIONS A TO E CHECKLIST TABLES
  // ==========================================
  for (const sec of sectionsToRender) {
    const secTitle = (isVi ? SECTION_NAMES_VI[sec] : SECTION_NAMES[sec]) || (isVi ? `Phần ${sec}` : `Section ${sec}`);
    const indicatorList = DEFAULT_CHECKLIST_STRUCTURE[sec] || [];

    docChildren.push(
      new Paragraph({
        spacing: { before: 240, after: 120 },
        children: [
          new TextRun({
            text: secTitle,
            font: fontName,
            size: 23, // ~11.5pt
            bold: true,
            color: COLOR_PRIMARY,
          }),
        ],
      })
    );

    // Table Header
    const tableRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 3400, type: WidthType.DXA },
            shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: isVi ? 'Chỉ báo hành vi' : 'Indicators', font: fontName, size: 20, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1100, type: WidthType.DXA },
            shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: isVi ? 'Quan sát' : 'Observed', font: fontName, size: 20, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1100, type: WidthType.DXA },
            shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: isVi ? 'Tần suất' : 'Frequency', font: fontName, size: 20, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1600, type: WidthType.DXA },
            shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 100, right: 100 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: isVi ? 'Mốc thời gian' : 'Timestamp', font: fontName, size: 20, bold: true, color: '1E293B' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2800, type: WidthType.DXA },
            shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: isVi ? 'Bối cảnh / Dẫn chứng' : 'Context / Evidence', font: fontName, size: 20, bold: true, color: '1E293B' })],
              }),
            ],
          }),
        ],
      }),
    ];

    // Data rows
    for (const indicatorText of indicatorList) {
      const match = itemsByText[indicatorText.trim().toLowerCase()];
      let count = 0;
      let occurrences: ReportItemOccurrence[] = [];

      if (match) {
        count = match.count || 0;
        if (match.occurrences) {
          if (Array.isArray(match.occurrences)) {
            occurrences = match.occurrences;
          } else if (typeof match.occurrences === 'string') {
            try {
              const parsed = JSON.parse(match.occurrences);
              if (Array.isArray(parsed)) {
                occurrences = parsed;
              }
            } catch {
              occurrences = [];
            }
          }
        }
      }

      const isObserved = count > 0;
      const observedText = isObserved ? 'Yes' : 'No';
      const freqText = isObserved ? String(count) : '-';

      const timestampParagraphs: Paragraph[] = [];
      if (Array.isArray(occurrences) && occurrences.length > 0) {
        for (const occ of occurrences) {
          const ts = occ.timestamp_str || formatSeconds(occ.timestamp_sec);
          timestampParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20 },
              children: [new TextRun({ text: ts, font: fontName, size: 19, color: COLOR_TIMESTAMP })],
            })
          );
        }
      } else {
        timestampParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: '-', font: fontName, size: 19, color: COLOR_NO_TEXT })],
          })
        );
      }

      const contextParagraphs: Paragraph[] = [];
      if (Array.isArray(occurrences) && occurrences.length > 0) {
        const uniqueContexts = Array.from(
          new Set(
            occurrences
              .map((o) => o?.context || o?.quote || o?.code || '')
              .filter((c) => c && c.trim().length > 0)
          )
        );
        if (uniqueContexts.length > 0) {
          for (const ctx of uniqueContexts) {
            contextParagraphs.push(
              new Paragraph({
                spacing: { before: 20, after: 20 },
                children: [new TextRun({ text: ctx, font: fontName, size: 19, italics: true, color: '374151' })],
              })
            );
          }
        } else {
          contextParagraphs.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: '', font: fontName, size: 19 })],
            })
          );
        }
      } else {
        contextParagraphs.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: '', font: fontName, size: 19 })],
          })
        );
      }

      tableRows.push(
        new TableRow({
          children: [
            // Indicator text
            new TableCell({
              width: { size: 3400, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  spacing: { before: 40, after: 40 },
                  children: [new TextRun({ text: indicatorText, font: fontName, size: 20, color: '1F2937' })],
                }),
              ],
            }),
            // Observed (Yes / No)
            new TableCell({
              width: { size: 1100, type: WidthType.DXA },
              shading: isObserved ? { fill: COLOR_YES_BG, type: ShadingType.CLEAR } : undefined,
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 40, after: 40 },
                  children: [
                    new TextRun({
                      text: observedText,
                      font: fontName,
                      size: 20,
                      bold: isObserved,
                      color: isObserved ? COLOR_YES_TEXT : COLOR_NO_TEXT,
                    }),
                  ],
                }),
              ],
            }),
            // Frequency
            new TableCell({
              width: { size: 1100, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 80, right: 80 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 40, after: 40 },
                  children: [
                    new TextRun({
                      text: freqText,
                      font: fontName,
                      size: 20,
                      bold: isObserved,
                      color: isObserved ? COLOR_PRIMARY : COLOR_NO_TEXT,
                    }),
                  ],
                }),
              ],
            }),
            // Timestamp
            new TableCell({
              width: { size: 1600, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: timestampParagraphs,
            }),
            // Context
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: contextParagraphs,
            }),
          ],
        })
      );
    }

    docChildren.push(
      new Table({
        width: { size: 10000, type: WidthType.DXA },
        rows: tableRows,
      })
    );
  }

  // ==========================================
  // 4. GENERAL OBSERVATION NOTES (STYLED CARD)
  // ==========================================
  docChildren.push(
    new Paragraph({
      spacing: { before: 300, after: 100 },
      children: [
        new TextRun({
          text: isVi ? 'GHI CHÚ QUAN SÁT CHUNG' : 'GENERAL OBSERVATION NOTES',
          font: fontName,
          size: 22,
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    })
  );

  const notesChildren: Paragraph[] = [];
  if (generalNotes && generalNotes.trim().length > 0) {
    notesChildren.push(
      new Paragraph({
        spacing: { before: 60, after: 100 },
        children: [
          new TextRun({
            text: generalNotes,
            font: fontName,
            size: 20,
            color: '1F2937',
          }),
        ],
      })
    );
  }

  const dotLines = [
    '...........................................................................................................................................................',
    '...........................................................................................................................................................',
    '...........................................................................................................................................................',
  ];
  for (const line of dotLines) {
    notesChildren.push(
      new Paragraph({
        spacing: { before: 60, after: 60 },
        children: [
          new TextRun({
            text: line,
            font: fontName,
            size: 19,
            color: '9CA3AF',
          }),
        ],
      })
    );
  }

  docChildren.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 10000, type: WidthType.DXA },
              shading: { fill: COLOR_BG_CARD, type: ShadingType.CLEAR },
              borders: cellBorders,
              margins: { top: 120, bottom: 120, left: 160, right: 160 },
              children: notesChildren,
            }),
          ],
        }),
      ],
    })
  );

  return docChildren;
}

export async function generateWordReport(data: ExportReportData): Promise<Blob> {
  const fontName = DEFAULT_FONT;
  const cellBorders = CELL_BORDERS_DEFAULT;

  const docChildren = buildSingleReportChildren(data, fontName, cellBorders);

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
        children: docChildren,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export async function generateCombinedWordReport(reportsData: ExportReportData[]): Promise<Blob> {
  const fontName = DEFAULT_FONT;
  const cellBorders = CELL_BORDERS_DEFAULT;

  // Collect unique teachers
  const isVi = reportsData[0]?.lang === 'vi';
  const teachers = Array.from(
    new Set(reportsData.map((r) => r.report.teacher_id || r.video?.teacher_id || 'Unknown'))
  ).filter(Boolean);
  const nowStr = new Date().toISOString().split('T')[0];

  // 1. Cover & Summary Table (Table of Contents) section
  const coverChildren: (Paragraph | Table)[] = [];

  // Super Title
  coverChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [
        new TextRun({
          text: isVi ? 'BÁO CÁO TỔNG HỢP QUAN SÁT LỚP HỌC TOÀN DIỆN' : 'COMPREHENSIVE CLASSROOM OBSERVATION REPORT',
          font: fontName,
          size: 30, // 15pt
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: isVi
            ? 'Tổng hợp toàn bộ video quan sát giảng dạy (Sắp xếp theo Giáo viên và Thứ tự bài giảng)'
            : 'Synthesis of All Teaching Video Observations (Sorted by Teacher and Lesson Sequence)',
          font: fontName,
          size: 21, // 10.5pt
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
            ? 'Khung nghiên cứu: Bảng kiểm quan sát video sư phạm 5 phần (Phần A đến E - 29 Chỉ báo hành vi)'
            : 'Theoretical Framework: 5-Section Academic Checklist (Sections A to E - 29 Behavioral Indicators)',
          font: fontName,
          size: 18, // 9pt
          color: COLOR_MUTED,
        }),
      ],
    })
  );

  // Metadata summary table (Information card)
  coverChildren.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Ngày tạo báo cáo:' : 'Generated Date:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7200, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: nowStr, font: fontName, size: 20 })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Tổng số giáo viên:' : 'Total Teachers:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7200, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${teachers.length}`, font: fontName, bold: true, size: 20, color: COLOR_ACCENT }),
                    new TextRun({ text: ` (${teachers.join(', ')})`, font: fontName, size: 20 }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Tổng số bài quan sát:' : 'Total Video Lessons:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7200, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: `${reportsData.length} ${isVi ? 'tiết học' : 'lessons'}`, font: fontName, bold: true, size: 20, color: COLOR_PRIMARY }),
                  ],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: isVi ? 'Khung quan sát:' : 'Observation Framework:', font: fontName, bold: true, size: 20, color: '1E293B' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 7200, type: WidthType.DXA },
              borders: cellBorders,
              margins: { top: 100, bottom: 100, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: isVi
                        ? 'Bảng kiểm học thuật 5 phần (Phần A đến E - 29 Chỉ báo hành vi)'
                        : '5-Section Academic Checklist (Sections A to E - 29 Behavioral Indicators)',
                      font: fontName,
                      size: 20,
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
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: isVi ? 'MỤC LỤC & BẢNG TỔNG HỢP TIẾT HỌC' : 'TABLE OF CONTENTS & LESSON SUMMARY',
          font: fontName,
          size: 24, // 12pt
          bold: true,
          color: COLOR_PRIMARY,
        }),
      ],
    })
  );

  // Table of Contents Header
  const tocRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 600, type: WidthType.DXA },
          shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 60, right: 60 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: '#', font: fontName, size: 20, bold: true, color: '1E293B' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1400, type: WidthType.DXA },
          shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: isVi ? 'Giáo viên' : 'Teacher', font: fontName, size: 20, bold: true, color: '1E293B' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 4000, type: WidthType.DXA },
          shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 100, right: 100 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: isVi ? 'Chủ đề / Tiêu đề bài học' : 'Lesson Topic / Title', font: fontName, size: 20, bold: true, color: '1E293B' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1400, type: WidthType.DXA },
          shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: isVi ? 'Ngày' : 'Date', font: fontName, size: 20, bold: true, color: '1E293B' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1300, type: WidthType.DXA },
          shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: isVi ? 'Số chỉ báo' : 'Observed', font: fontName, size: 20, bold: true, color: '1E293B' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1300, type: WidthType.DXA },
          shading: { fill: COLOR_BG_HEADER, type: ShadingType.CLEAR },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 100, bottom: 100, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: isVi ? 'Tổng tần suất' : 'Total Freq', font: fontName, size: 20, bold: true, color: '1E293B' })],
            }),
          ],
        }),
      ],
    }),
  ];

  reportsData.forEach((item, idx) => {
    const tId = item.report.teacher_id || item.video?.teacher_id || 'N/A';
    const topic = item.video?.title || item.observationNo || `Observation #${idx + 1}`;
    const dateStr = item.video?.uploaded_at
      ? new Date(item.video.uploaded_at).toISOString().split('T')[0]
      : (item.report.generated_at ? new Date(item.report.generated_at).toISOString().split('T')[0] : 'N/A');

    let observedCount = 0;
    let totalFreq = 0;
    if (item.report.items && Array.isArray(item.report.items)) {
      for (const it of item.report.items) {
        if (it.count > 0) {
          observedCount++;
          totalFreq += it.count;
        }
      }
    }

    tocRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 600, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: String(idx + 1), font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1400, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: tId, font: fontName, size: 20, bold: true, color: COLOR_ACCENT })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4000, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 100, right: 100 },
            children: [
              new Paragraph({
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: topic, font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1400, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 30 },
                children: [new TextRun({ text: dateStr, font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 30 },
                children: [
                  new TextRun({
                    text: `${observedCount} / 29`,
                    font: fontName,
                    size: 20,
                    bold: observedCount > 0,
                    color: observedCount > 0 ? COLOR_YES_TEXT : COLOR_NO_TEXT,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 80, bottom: 80, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 30, after: 30 },
                children: [
                  new TextRun({
                    text: String(totalFreq),
                    font: fontName,
                    size: 20,
                    bold: true,
                    color: COLOR_PRIMARY,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  });

  coverChildren.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: tocRows,
    })
  );

  const sections: any[] = [
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
      children: coverChildren,
    },
  ];

  // 2. Individual Video Report Sections (each starts on a new page)
  for (let i = 0; i < reportsData.length; i++) {
    const reportData = reportsData[i];
    const reportElements = buildSingleReportChildren(reportData, fontName, cellBorders);

    sections.push({
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
      children: reportElements,
    });
  }

  const doc = new Document({
    sections,
  });

  return await Packer.toBlob(doc);
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
