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
  fontName = 'Times New Roman',
  cellBorders = {
    top: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    left: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
    right: { style: BorderStyle.SINGLE, size: 6, color: '000000' },
  }
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

  // Title
  docChildren.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 360 },
      children: [
        new TextRun({
          text: isVi ? 'BẢNG KIỂM QUAN SÁT LỚP HỌC TRỰC TUYẾN' : 'Classroom Observation Checklist',
          font: fontName,
          size: 32, // 16pt
          bold: true,
        }),
      ],
    })
  );

  // Lesson Information Header
  docChildren.push(
    new Paragraph({
      spacing: { before: 120, after: 120 },
      children: [
        new TextRun({
          text: isVi ? 'Thông Tin Tiết Học' : 'Lesson Information',
          font: fontName,
          size: 24, // 12pt
          bold: true,
        }),
      ],
    })
  );

  const obsNum = observationNo || (video ? `#${video.id.slice(0, 8)}` : '#01');
  const teacherName = video?.teacher_id || report.teacher_id || '___________';
  const dateStr = video?.uploaded_at ? new Date(video.uploaded_at).toISOString().split('T')[0] : (report.generated_at ? new Date(report.generated_at).toISOString().split('T')[0] : '___________');
  const cls = className || (isVi ? 'Lớp tiếng Anh trực tuyến' : 'Online English Class');
  const plat = platform || 'Zoom';
  const topic = video?.title || '___________';
  const durationStr = video?.duration_sec ? `${formatSeconds(video.duration_sec)}` : '___________';

  const lessonInfoBullets = [
    `- ${isVi ? 'Lượt quan sát' : 'Observation No.'}: ${obsNum}`,
    `- ${isVi ? 'Giáo viên' : 'Teacher'}: ${teacherName}`,
    `- ${isVi ? 'Ngày' : 'Date'}: ${dateStr}`,
    `- ${isVi ? 'Lớp' : 'Class'}: ${cls}`,
    `- ${isVi ? 'Nền tảng (Zoom/Google Meet)' : 'Platform (Zoom/Google Meet)'}: ${plat}`,
    `- ${isVi ? 'Chủ đề bài học' : 'Lesson Topic'}: ${topic}`,
    `- ${isVi ? 'Thời lượng' : 'Duration'}: ${durationStr}`,
  ];

  for (const bullet of lessonInfoBullets) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: bullet,
            font: fontName,
            size: 22, // 11pt
          }),
        ],
      })
    );
  }

  // Spacing after header
  docChildren.push(
    new Paragraph({
      spacing: { before: 180, after: 180 },
      children: [],
    })
  );

  // Render Sections A to E
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
            size: 24, // 12pt
            bold: true,
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
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: isVi ? 'Chỉ báo hành vi' : 'Indicators', font: fontName, size: 21, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: isVi ? 'Quan sát' : 'Observed', font: fontName, size: 21, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1200, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: isVi ? 'Tần suất' : 'Frequency', font: fontName, size: 21, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1600, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: isVi ? 'Mốc thời gian' : 'Timestamp', font: fontName, size: 21, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2600, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [new TextRun({ text: isVi ? 'Bối cảnh / Dẫn chứng' : 'Context', font: fontName, size: 21, bold: true })],
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

      const observedText = count > 0 ? 'Yes' : 'No';
      const freqText = count > 0 ? String(count) : '';
      
      const timestampParagraphs: Paragraph[] = [];
      if (Array.isArray(occurrences) && occurrences.length > 0) {
        for (const occ of occurrences) {
          const ts = occ.timestamp_str || formatSeconds(occ.timestamp_sec);
          timestampParagraphs.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 20, after: 20 },
              children: [new TextRun({ text: ts, font: fontName, size: 20 })],
            })
          );
        }
      } else {
        timestampParagraphs.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: '', font: fontName, size: 20 })],
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
                children: [new TextRun({ text: ctx, font: fontName, size: 20 })],
              })
            );
          }
        } else {
          contextParagraphs.push(
            new Paragraph({
              spacing: { before: 40, after: 40 },
              children: [new TextRun({ text: '', font: fontName, size: 20 })],
            })
          );
        }
      } else {
        contextParagraphs.push(
          new Paragraph({
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: '', font: fontName, size: 20 })],
          })
        );
      }

      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 3400, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [new TextRun({ text: indicatorText, font: fontName, size: 21 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1200, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 60 },
                  children: [new TextRun({ text: observedText, font: fontName, size: 21, bold: count > 0 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1200, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  spacing: { before: 60, after: 60 },
                  children: [new TextRun({ text: freqText, font: fontName, size: 21 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1600, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
              children: timestampParagraphs,
            }),
            new TableCell({
              width: { size: 2600, type: WidthType.DXA },
              borders: cellBorders,
              verticalAlign: VerticalAlign.CENTER,
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

  // General Observation Notes
  docChildren.push(
    new Paragraph({
      spacing: { before: 360, after: 120 },
      children: [
        new TextRun({
          text: isVi ? 'Ghi Chú Quan Sát Chung' : 'General Observation Notes',
          font: fontName,
          size: 24,
          bold: true,
        }),
      ],
    })
  );

  if (generalNotes && generalNotes.trim().length > 0) {
    docChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 120 },
        children: [
          new TextRun({
            text: generalNotes,
            font: fontName,
            size: 22,
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
    docChildren.push(
      new Paragraph({
        spacing: { before: 80, after: 80 },
        children: [
          new TextRun({
            text: line,
            font: fontName,
            size: 20,
            color: '666666',
          }),
        ],
      })
    );
  }

  return docChildren;
}

export async function generateWordReport(data: ExportReportData): Promise<Blob> {
  const fontName = 'Times New Roman';
  const blackBorder = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: '000000',
  };
  const cellBorders = {
    top: blackBorder,
    bottom: blackBorder,
    left: blackBorder,
    right: blackBorder,
  };

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
  const fontName = 'Times New Roman';
  const blackBorder = {
    style: BorderStyle.SINGLE,
    size: 6,
    color: '000000',
  };
  const cellBorders = {
    top: blackBorder,
    bottom: blackBorder,
    left: blackBorder,
    right: blackBorder,
  };

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
      spacing: { before: 240, after: 120 },
      children: [
        new TextRun({
          text: isVi ? 'BÁO CÁO TỔNG HỢP QUAN SÁT LỚP HỌC TOÀN DIỆN' : 'COMPREHENSIVE CLASSROOM OBSERVATION REPORT',
          font: fontName,
          size: 32, // 16pt
          bold: true,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 360 },
      children: [
        new TextRun({
          text: isVi ? 'Tổng hợp toàn bộ video quan sát giảng dạy (Sắp xếp theo Giáo viên và Thứ tự bài giảng)' : 'Synthesis of All Teaching Video Observations (Sorted by Teacher and Lesson Sequence)',
          font: fontName,
          size: 24, // 12pt
          italics: true,
          color: '444444',
        }),
      ],
    })
  );

  // Metadata summary
  const metaBullets = [
    `• ${isVi ? 'Ngày tạo' : 'Generated Date'}: ${nowStr}`,
    `• ${isVi ? 'Tổng số giáo viên' : 'Total Teachers'}: ${teachers.length} (${teachers.join(', ')})`,
    `• ${isVi ? 'Tổng số video quan sát' : 'Total Video Observations'}: ${reportsData.length} ${isVi ? 'tiết học' : 'lessons'}`,
    `• ${isVi ? 'Khung quan sát' : 'Observation Framework'}: ${isVi ? 'Bảng kiểm học thuật 5 phần (Phần A đến E - 29 Chỉ báo)' : '5-Section Academic Checklist (Sections A to E - 29 Indicators)'}`,
  ];

  for (const b of metaBullets) {
    coverChildren.push(
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: b,
            font: fontName,
            size: 22,
          }),
        ],
      })
    );
  }

  coverChildren.push(
    new Paragraph({
      spacing: { before: 280, after: 140 },
      children: [
        new TextRun({
          text: isVi ? 'Mục Lục & Bảng Tổng Hợp' : 'Table of Contents & Summary Table',
          font: fontName,
          size: 26, // 13pt
          bold: true,
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
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: '#', font: fontName, size: 20, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1400, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: isVi ? 'Giáo viên' : 'Teacher', font: fontName, size: 20, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 4000, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: isVi ? 'Chủ đề / Tiêu đề bài học' : 'Lesson Topic / Title', font: fontName, size: 20, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1400, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: isVi ? 'Ngày' : 'Date', font: fontName, size: 20, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1300, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: isVi ? 'Số chỉ báo' : 'Observed', font: fontName, size: 20, bold: true })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 1300, type: WidthType.DXA },
          borders: cellBorders,
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({ text: isVi ? 'Tổng tần suất' : 'Total Freq', font: fontName, size: 20, bold: true })],
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
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: String(idx + 1), font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1400, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: tId, font: fontName, size: 20, bold: true })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4000, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: topic, font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1400, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: dateStr, font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: `${observedCount} / 29`, font: fontName, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1300, type: WidthType.DXA },
            borders: cellBorders,
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: String(totalFreq), font: fontName, size: 20 })],
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
