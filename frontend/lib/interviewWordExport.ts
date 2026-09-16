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
  HeadingLevel,
  convertInchesToTwip,
  ShadingType,
} from 'docx';
import { InterviewQuestion, TeacherAnalysis, CoreQuestionItem } from './api';

export interface ExportInterviewGuideData {
  teacherId: string;
  coreQuestions: (InterviewQuestion | CoreQuestionItem)[];
  dynamicQuestions: InterviewQuestion[];
  teacherAnalysis?: TeacherAnalysis | null;
  generatedDate?: string;
}

const FONT_NAME = 'Calibri';

const BORDER_SUBTLE = {
  style: BorderStyle.SINGLE,
  size: 4,
  color: 'D1D5DB', // light gray
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

const CELL_BORDERS_NONE = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
};

function getRQFullTitle(rq?: string): string {
  switch (rq) {
    case 'RQ1':
      return 'RQ1: Classroom Strategies';
    case 'RQ2':
      return 'RQ2: Teacher Perceptions';
    case 'RQ3':
      return 'RQ3: Challenges & Solutions';
    default:
      return rq || 'General Inquiry';
  }
}

function getRQShading(rq?: string): string {
  switch (rq) {
    case 'RQ1':
      return 'EAF4EE'; // soft green
    case 'RQ2':
      return 'EBF3F9'; // soft blue
    case 'RQ3':
      return 'FEF7EA'; // soft amber
    default:
      return 'F3F4F6'; // soft gray
  }
}

function getRQTextColor(rq?: string): string {
  switch (rq) {
    case 'RQ1':
      return '166534';
    case 'RQ2':
      return '1E40AF';
    case 'RQ3':
      return '92400E';
    default:
      return '374151';
  }
}

export async function generateInterviewGuideWord(data: ExportInterviewGuideData): Promise<Blob> {
  const { teacherId, coreQuestions, dynamicQuestions, teacherAnalysis, generatedDate } = data;
  const dateStr = generatedDate || new Date().toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const children: (Paragraph | Table)[] = [];

  // ==========================================
  // 1. TITLE & SUBTITLE
  // ==========================================
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 120 },
      children: [
        new TextRun({
          text: 'SEMI-STRUCTURED TEACHER INTERVIEW PROTOCOL',
          font: FONT_NAME,
          size: 32, // 16pt
          bold: true,
          color: '1E3A8A', // Academic navy blue
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 80 },
      children: [
        new TextRun({
          text: "Research: Primary EFL Teachers' Online Classroom Management Strategies & Student Speaking Participation",
          font: FONT_NAME,
          size: 22, // 11pt
          italics: true,
          color: '4B5563',
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 240 },
      children: [
        new TextRun({
          text: 'Theoretical Framework: Multi-Lesson Video Observation & Grounded Theory Strategy Synthesis',
          font: FONT_NAME,
          size: 19, // 9.5pt
          color: '6B7280',
        }),
      ],
    })
  );

  // ==========================================
  // 2. METADATA SUMMARY TABLE
  // ==========================================
  children.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Participant ID:', font: FONT_NAME, bold: true, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: teacherId, font: FONT_NAME, bold: true, size: 22, color: '9E4A28' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Date Generated:', font: FONT_NAME, bold: true, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: dateStr, font: FONT_NAME, size: 20 })],
                }),
              ],
            }),
          ],
        }),
        new TableRow({
          children: [
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Protocol Type:', font: FONT_NAME, bold: true, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Semi-Structured Interview', font: FONT_NAME, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2200, type: WidthType.DXA },
              shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Core Guide Status:', font: FONT_NAME, bold: true, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 2800, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 120, bottom: 120, left: 140, right: 140 },
              children: [
                new Paragraph({
                  children: [new TextRun({ text: 'Approved & Aligned with RQ1–RQ3', font: FONT_NAME, bold: true, size: 20, color: '166534' })],
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    new Paragraph({ spacing: { before: 200, after: 100 } })
  );

  // ==========================================
  // 3. RESEARCH QUESTIONS (RQ1 - RQ3) SCOPE
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({
          text: 'RESEARCH INQUIRY SCOPE (RQ1 – RQ3)',
          font: FONT_NAME,
          bold: true,
          size: 24, // 12pt
          color: '1E3A8A',
        }),
      ],
    }),
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: [
        new TableRow({
          children: [
            new TableCell({
              width: { size: 1500, type: WidthType.DXA },
              shading: { fill: 'EAF4EE', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'RQ1', font: FONT_NAME, bold: true, size: 20, color: '166534' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8500, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'What classroom management strategies do primary EFL teachers use in online English speaking classes?',
                      font: FONT_NAME,
                      size: 20,
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
              width: { size: 1500, type: WidthType.DXA },
              shading: { fill: 'EBF3F9', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'RQ2', font: FONT_NAME, bold: true, size: 20, color: '1E40AF' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8500, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: "How do teachers perceive the role/effectiveness of classroom management strategies in promoting learners' speaking participation?",
                      font: FONT_NAME,
                      size: 20,
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
              width: { size: 1500, type: WidthType.DXA },
              shading: { fill: 'FEF7EA', type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: 'RQ3', font: FONT_NAME, bold: true, size: 20, color: '92400E' })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 8500, type: WidthType.DXA },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 80, bottom: 80, left: 120, right: 120 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'What challenges do teachers encounter in managing online English speaking classes, and how do they address these challenges?',
                      font: FONT_NAME,
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
    new Paragraph({ spacing: { before: 240, after: 120 } })
  );

  // ==========================================
  // 4. TEACHER PEDAGOGICAL CONTEXT (If present)
  // ==========================================
  if (teacherAnalysis?.markdown_content) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 180, after: 120 },
        children: [
          new TextRun({
            text: `1. TEACHER PEDAGOGICAL PROFILE & CLASSROOM CONTEXT (${teacherId})`,
            font: FONT_NAME,
            bold: true,
            size: 24,
            color: '1E3A8A',
          }),
        ],
      })
    );

    // Clean markdown lines and render
    const lines = teacherAnalysis.markdown_content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    for (const line of lines) {
      if (line.startsWith('#')) {
        const cleanHeading = line.replace(/^#+\s*/, '');
        children.push(
          new Paragraph({
            spacing: { before: 120, after: 60 },
            children: [
              new TextRun({
                text: cleanHeading,
                font: FONT_NAME,
                bold: true,
                size: 21,
                color: '334155',
              }),
            ],
          })
        );
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        const bulletText = line.substring(2);
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { before: 40, after: 40 },
            children: [
              new TextRun({
                text: bulletText,
                font: FONT_NAME,
                size: 20,
              }),
            ],
          })
        );
      } else {
        children.push(
          new Paragraph({
            spacing: { before: 40, after: 60 },
            children: [
              new TextRun({
                text: line,
                font: FONT_NAME,
                size: 20,
              }),
            ],
          })
        );
      }
    }

    children.push(new Paragraph({ spacing: { before: 200, after: 100 } }));
  }

  // ==========================================
  // 5. CORE INTERVIEW QUESTIONS (SECTION 2)
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: '2. CORE SEMI-STRUCTURED INTERVIEW QUESTIONS',
          font: FONT_NAME,
          bold: true,
          size: 24,
          color: '1E3A8A',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 140 },
      children: [
        new TextRun({
          text: 'These core questions represent the common protocol grounded in the 22 canonical semi-structured interview questions, synthesized across 24 lessons to cover RQ1–RQ3 consistently for all 12 teachers.',
          font: FONT_NAME,
          size: 19,
          italics: true,
          color: '4B5563',
        }),
      ],
    })
  );

  const coreRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: [
        new TableCell({
          width: { size: 700, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: CELL_BORDERS_DEFAULT,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 80, right: 80 },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ text: 'No.', font: FONT_NAME, bold: true, size: 20, color: 'FFFFFF' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 2400, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: CELL_BORDERS_DEFAULT,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: 'Research Question', font: FONT_NAME, bold: true, size: 20, color: 'FFFFFF' })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 6900, type: WidthType.DXA },
          shading: { fill: '1E3A8A', type: ShadingType.CLEAR },
          borders: CELL_BORDERS_DEFAULT,
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 120, bottom: 120, left: 140, right: 140 },
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: 'Interview Question & Methodological Rationale',
                  font: FONT_NAME,
                  bold: true,
                  size: 20,
                  color: 'FFFFFF',
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  coreQuestions.forEach((q, idx) => {
    const qText = 'question_text' in q ? q.question_text : '';
    const rq = 'rq_category' in q ? q.rq_category : 'RQ1';
    const rationale = 'rationale' in q ? (q as any).rationale : '';

    const rowShading = idx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';

    const questionChildren: Paragraph[] = [
      new Paragraph({
        spacing: { before: 40, after: rationale ? 40 : 80 },
        children: [
          new TextRun({
            text: qText,
            font: FONT_NAME,
            bold: true,
            size: 20,
            color: '111827',
          }),
        ],
      }),
    ];

    if (rationale) {
      questionChildren.push(
        new Paragraph({
          spacing: { before: 0, after: 60 },
          children: [
            new TextRun({
              text: 'Rationale: ',
              font: FONT_NAME,
              bold: true,
              italics: true,
              size: 18,
              color: '4B5563',
            }),
            new TextRun({
              text: rationale,
              font: FONT_NAME,
              italics: true,
              size: 18,
              color: '6B7280',
            }),
          ],
        })
      );
    }

    coreRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 700, type: WidthType.DXA },
            shading: { fill: rowShading, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: String(idx + 1), font: FONT_NAME, bold: true, size: 20 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 2400, type: WidthType.DXA },
            shading: { fill: getRQShading(rq), type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 100, bottom: 100, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: getRQFullTitle(rq),
                    font: FONT_NAME,
                    bold: true,
                    size: 19,
                    color: getRQTextColor(rq),
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 6900, type: WidthType.DXA },
            shading: { fill: rowShading, type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            margins: { top: 100, bottom: 100, left: 140, right: 140 },
            children: questionChildren,
          }),
        ],
      })
    );
  });

  children.push(
    new Table({
      width: { size: 10000, type: WidthType.DXA },
      rows: coreRows,
    }),
    new Paragraph({ spacing: { before: 240, after: 120 } })
  );

  // ==========================================
  // 6. DYNAMIC / FOLLOW-UP QUESTIONS (SECTION 3)
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 80 },
      children: [
        new TextRun({
          text: `3. PARTICIPANT-SPECIFIC FOLLOW-UP QUESTIONS (${teacherId})`,
          font: FONT_NAME,
          bold: true,
          size: 24,
          color: '1E3A8A',
        }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 140 },
      children: [
        new TextRun({
          text: `These targeted follow-up inquiries are directly grounded in ${teacherId}'s chronological classroom interaction log (verbatim quotes, wait times, turn-taking routines, and digital tool interventions) to probe pedagogical intentions.`,
          font: FONT_NAME,
          size: 19,
          italics: true,
          color: '4B5563',
        }),
      ],
    })
  );

  if (dynamicQuestions.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 100, after: 100 },
        children: [
          new TextRun({
            text: `(No participant-specific follow-up questions generated yet for ${teacherId}. Please click "Approve & Generate Guides" in Interview Studio to generate empirical inquiries).`,
            font: FONT_NAME,
            size: 20,
            italics: true,
            color: '6B7280',
          }),
        ],
      })
    );
  } else {
    const dynamicRows: TableRow[] = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            width: { size: 600, type: WidthType.DXA },
            shading: { fill: '2D3748', type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 60, right: 60 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: 'No.', font: FONT_NAME, bold: true, size: 20, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 1600, type: WidthType.DXA },
            shading: { fill: '2D3748', type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: [new TextRun({ text: 'Target RQ', font: FONT_NAME, bold: true, size: 20, color: 'FFFFFF' })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 3600, type: WidthType.DXA },
            shading: { fill: '2D3748', type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'Classroom Evidence & Timestamps',
                    font: FONT_NAME,
                    bold: true,
                    size: 20,
                    color: 'FFFFFF',
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 4200, type: WidthType.DXA },
            shading: { fill: '2D3748', type: ShadingType.CLEAR },
            borders: CELL_BORDERS_DEFAULT,
            verticalAlign: VerticalAlign.CENTER,
            margins: { top: 120, bottom: 120, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'In-Depth Follow-up Question',
                    font: FONT_NAME,
                    bold: true,
                    size: 20,
                    color: 'FFFFFF',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    dynamicQuestions.forEach((q, idx) => {
      const rq = q.rq_category || 'RQ1';
      const rowShading = idx % 2 === 1 ? 'F8FAFC' : 'FFFFFF';

      const evidenceParagraphs: Paragraph[] = [];
      if (q.evidence_ref) {
        evidenceParagraphs.push(
          new Paragraph({
            spacing: { before: 20, after: 40 },
            children: [
              new TextRun({
                text: q.evidence_ref,
                font: FONT_NAME,
                bold: true,
                size: 19,
                color: '9E4A28', // Terracotta citation accent
              }),
            ],
          })
        );
      }
      if (q.context_notes) {
        evidenceParagraphs.push(
          new Paragraph({
            spacing: { before: 20, after: 20 },
            children: [
              new TextRun({
                text: q.context_notes,
                font: FONT_NAME,
                size: 18,
                color: '4B5563',
              }),
            ],
          })
        );
      }
      if (evidenceParagraphs.length === 0) {
        evidenceParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: 'Based on multi-lesson recurring interactions.',
                font: FONT_NAME,
                italics: true,
                size: 18,
                color: '9CA3AF',
              }),
            ],
          })
        );
      }

      dynamicRows.push(
        new TableRow({
          children: [
            new TableCell({
              width: { size: 600, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 60, right: 60 },
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [new TextRun({ text: String(idx + 1), font: FONT_NAME, bold: true, size: 20 })],
                }),
              ],
            }),
            new TableCell({
              width: { size: 1600, type: WidthType.DXA },
              shading: { fill: getRQShading(rq), type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              verticalAlign: VerticalAlign.CENTER,
              margins: { top: 100, bottom: 100, left: 100, right: 100 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: rq,
                      font: FONT_NAME,
                      bold: true,
                      size: 20,
                      color: getRQTextColor(rq),
                    }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: rq === 'RQ1' ? 'Strategies' : rq === 'RQ2' ? 'Perceptions' : 'Challenges',
                      font: FONT_NAME,
                      size: 17,
                      color: getRQTextColor(rq),
                    }),
                  ],
                }),
              ],
            }),
            new TableCell({
              width: { size: 3600, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: evidenceParagraphs,
            }),
            new TableCell({
              width: { size: 4200, type: WidthType.DXA },
              shading: { fill: rowShading, type: ShadingType.CLEAR },
              borders: CELL_BORDERS_DEFAULT,
              margins: { top: 100, bottom: 100, left: 120, right: 120 },
              children: [
                new Paragraph({
                  spacing: { before: 20, after: 40 },
                  children: [
                    new TextRun({
                      text: q.question_text,
                      font: FONT_NAME,
                      bold: true,
                      size: 20,
                      color: '111827',
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
        rows: dynamicRows,
      }),
      new Paragraph({ spacing: { before: 240, after: 120 } })
    );
  }

  // ==========================================
  // 7. POST-INTERVIEW NOTES & REFLECTIONS (SECTION 4)
  // ==========================================
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 240, after: 100 },
      children: [
        new TextRun({
          text: '4. INTERVIEWER REFLECTION & FIELD NOTES',
          font: FONT_NAME,
          bold: true,
          size: 24,
          color: '1E3A8A',
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
              margins: { top: 160, bottom: 160, left: 160, right: 160 },
              children: [
                new Paragraph({
                  spacing: { before: 0, after: 80 },
                  children: [
                    new TextRun({
                      text: 'Key Participant Responses & Emergent Pedagogical Insights:',
                      font: FONT_NAME,
                      bold: true,
                      size: 20,
                      color: '4B5563',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [
                    new TextRun({
                      text: '• Observed alignment between stated beliefs and video classroom practice:\n',
                      font: FONT_NAME,
                      size: 19,
                      color: '9CA3AF',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 60, after: 60 },
                  children: [
                    new TextRun({
                      text: '• Unexpected constraints mentioned by participant (institutional, technical, learner-level):\n',
                      font: FONT_NAME,
                      size: 19,
                      color: '9CA3AF',
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 60, after: 120 },
                  children: [
                    new TextRun({
                      text: '• Additional follow-up reflections or researcher memos:\n\n\n\n',
                      font: FONT_NAME,
                      size: 19,
                      color: '9CA3AF',
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

  // Build Document with 1-inch margins
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
        children,
      },
    ],
  });

  return await Packer.toBlob(doc);
}

export function downloadInterviewWordBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
