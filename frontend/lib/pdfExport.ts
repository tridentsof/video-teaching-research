import { Report, Video, ReportItem, ReportItemOccurrence } from './api';
import {
  SECTION_NAMES,
  SECTION_NAMES_VI,
  DEFAULT_CHECKLIST_STRUCTURE,
  ExportReportData,
} from './wordExport';
import { ExportInterviewGuideData } from './interviewWordExport';

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

// Common PDF CSS styling (Academic APA / Clean Print, full UTF-8 Vietnamese support)
const PDF_BASE_STYLES = `
  font-family: 'Times New Roman', Times, serif;
  color: #111827;
  line-height: 1.45;
  font-size: 11pt;
  background: #ffffff;
  padding: 0;
  margin: 0;
`;

/**
 * Builds HTML string for a single Observation Report
 */
function buildSingleObservationHtml(data: ExportReportData, isStandalone = true): string {
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
  const obsNum = observationNo || (video ? `#${video.id.slice(0, 8)}` : '#01');
  const teacherName = video?.teacher_id || report.teacher_id || '___________';
  const dateStr = video?.uploaded_at
    ? new Date(video.uploaded_at).toISOString().split('T')[0]
    : (report.generated_at ? new Date(report.generated_at).toISOString().split('T')[0] : '___________');
  const cls = className || (isVi ? 'Lớp tiếng Anh trực tuyến' : 'Online English Class');
  const plat = platform || 'Zoom';
  const topic = video?.title || '___________';
  const durationStr = video?.duration_sec ? `${formatSeconds(video.duration_sec)}` : '___________';

  let sectionsHtml = '';

  for (const secKey of sectionsToRender) {
    const secTitle = isVi
      ? (SECTION_NAMES_VI[secKey] || `Phần ${secKey}`)
      : (SECTION_NAMES[secKey] || `Section ${secKey}`);
    const indicators = DEFAULT_CHECKLIST_STRUCTURE[secKey] || [];

    let rowsHtml = '';
    for (const indText of indicators) {
      const match = itemsByText[indText.trim().toLowerCase()];
      let count = 0;
      let occurrences: ReportItemOccurrence[] = [];

      if (match) {
        count = match.count || 0;
        if (match.occurrences) {
          if (Array.isArray(match.occurrences)) {
            occurrences = match.occurrences as ReportItemOccurrence[];
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

      // Timestamps
      let tsStr = '—';
      if (occurrences.length > 0) {
        tsStr = occurrences.map((o) => `[${formatSeconds(o.timestamp_sec)}]`).join(', ');
      }

      // Context & Quotes
      let ctxStr = '—';
      if (occurrences.length > 0) {
        ctxStr = occurrences
          .slice(0, 3)
          .map((o) => {
            const quote = o.quote ? `"${o.quote}"` : '';
            const ctx = o.context ? `(${o.context})` : '';
            return [quote, ctx].filter(Boolean).join(' ');
          })
          .filter(Boolean)
          .join('<br/>');
        if (occurrences.length > 3) {
          ctxStr += `<br/><em style="color:#6b7280; font-size:9pt;">+ ${occurrences.length - 3} ${isVi ? 'dẫn chứng khác' : 'more occurrences'}</em>`;
        }
      }

      const badgeHtml = isObserved
        ? `<span style="background:#EAF4EE; color:#166534; font-weight:bold; padding:2px 6px; border-radius:3px; border:1px solid #A7F3D0; font-size:9.5pt;">${isVi ? 'Có' : 'Yes'}</span>`
        : `<span style="color:#9CA3AF; font-size:9.5pt;">${isVi ? 'Không' : 'No'}</span>`;

      rowsHtml += `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 6px 8px; vertical-align: top; font-size: 10pt;">${indText}</td>
          <td style="padding: 6px 8px; vertical-align: top; text-align: center;">${badgeHtml}</td>
          <td style="padding: 6px 8px; vertical-align: top; text-align: center; font-size: 10pt; font-family: monospace;">${count > 0 ? count : '—'}</td>
          <td style="padding: 6px 8px; vertical-align: top; font-size: 9pt; color: #1E3A8A; font-family: monospace;">${tsStr}</td>
          <td style="padding: 6px 8px; vertical-align: top; font-size: 9pt; color: #374151;">${ctxStr}</td>
        </tr>
      `;
    }

    sectionsHtml += `
      <div style="margin-top: 20px; page-break-inside: avoid;">
        <h3 style="font-size: 11pt; font-weight: bold; color: #1E3A8A; border-bottom: 1.5px solid #1E3A8A; padding-bottom: 4px; margin-bottom: 8px;">
          ${secTitle}
        </h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10pt;">
          <thead>
            <tr style="background: #F1F5F9; border-top: 1.5pt solid #111827; border-bottom: 1pt solid #111827;">
              <th style="padding: 6px 8px; text-align: left; width: 34%; font-weight: bold;">${isVi ? 'Chỉ Báo Hành Vi Sư Phạm' : 'Observable Pedagogical Indicator'}</th>
              <th style="padding: 6px 8px; text-align: center; width: 10%; font-weight: bold;">${isVi ? 'Ghi Nhận' : 'Observed'}</th>
              <th style="padding: 6px 8px; text-align: center; width: 8%; font-weight: bold;">${isVi ? 'Tần Suất' : 'Freq'}</th>
              <th style="padding: 6px 8px; text-align: left; width: 18%; font-weight: bold;">${isVi ? 'Mốc Thời Gian' : 'Timestamps'}</th>
              <th style="padding: 6px 8px; text-align: left; width: 30%; font-weight: bold;">${isVi ? 'Dẫn Chứng & Ngữ Cảnh Lớp Học' : 'Classroom Evidence & Context'}</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  // General Notes Section
  const gNotes = generalNotes || '';
  const notesHtml = gNotes
    ? `
      <div style="margin-top: 24px; padding: 12px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 4px; page-break-inside: avoid;">
        <h4 style="font-size: 10.5pt; font-weight: bold; color: #1E3A8A; margin-bottom: 6px;">
          ${isVi ? 'GHI CHÚ QUAN SÁT TỔNG QUAN CỦA NGHIÊN CỨU VIÊN' : 'RESEARCHER GENERAL OBSERVATION NOTES'}
        </h4>
        <p style="font-size: 10pt; color: #374151; white-space: pre-wrap; line-height: 1.5;">${gNotes}</p>
      </div>
    `
    : '';

  return `
    <div style="${isStandalone ? '' : 'page-break-before: always;'} margin-bottom: 30px;">
      <!-- Title & Header -->
      <div style="text-align: center; margin-bottom: 18px; border-bottom: 2pt solid #1E3A8A; padding-bottom: 12px;">
        <h1 style="font-size: 15pt; font-weight: bold; color: #1E3A8A; margin: 0 0 6px 0; text-transform: uppercase;">
          ${isVi ? 'BẢNG KIỂM QUAN SÁT LỚP HỌC TRỰC TUYẾN' : 'CLASSROOM OBSERVATION CHECKLIST'}
        </h1>
        <div style="font-size: 10pt; font-style: italic; color: #4B5563; margin-bottom: 4px;">
          ${
            isVi
              ? 'Nghiên cứu: Chiến lược quản lý lớp học trực tuyến & Khả năng tương tác nói tiếng Anh của học sinh tiểu học'
              : "Research: Primary EFL Teachers' Online Classroom Management Strategies & Student Speaking Participation"
          }
        </div>
        <div style="font-size: 9pt; color: #6B7280;">
          ${
            isVi
              ? 'Khung nghiên cứu: Bảng kiểm quan sát video sư phạm 5 phần (Phần A đến E - 29 Chỉ báo hành vi)'
              : 'Theoretical Framework: 5-Section Classroom Observation Protocol (Sections A to E - 29 Indicators)'
          }
        </div>
      </div>

      <!-- Metadata Table -->
      <div style="margin-bottom: 18px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border-top: 1.5pt solid #111827; border-bottom: 1.5pt solid #111827;">
          <tr>
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC; width: 18%;">${isVi ? 'Mã Giáo Viên:' : 'Teacher ID:'}</td>
            <td style="padding: 5px 8px; width: 32%; font-weight: bold; color: #1E3A8A;">${teacherName}</td>
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC; width: 18%;">${isVi ? 'Số Thứ Tự Quan Sát:' : 'Observation No.:'}</td>
            <td style="padding: 5px 8px; width: 32%;">${obsNum}</td>
          </tr>
          <tr style="border-top: 1px solid #E5E7EB;">
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Ngày Ghi Nhận:' : 'Observation Date:'}</td>
            <td style="padding: 5px 8px;">${dateStr}</td>
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Thời Lượng Bài Học:' : 'Lesson Duration:'}</td>
            <td style="padding: 5px 8px;">${durationStr}</td>
          </tr>
          <tr style="border-top: 1px solid #E5E7EB;">
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Lớp / Khối Học:' : 'Class / Grade Level:'}</td>
            <td style="padding: 5px 8px;">${cls}</td>
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Nền Tảng Dạy Học:' : 'Digital Platform:'}</td>
            <td style="padding: 5px 8px;">${plat}</td>
          </tr>
          <tr style="border-top: 1px solid #E5E7EB;">
            <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Chủ Đề / Tên Video:' : 'Lesson Title / Topic:'}</td>
            <td colspan="3" style="padding: 5px 8px; font-style: italic;">${topic}</td>
          </tr>
        </table>
      </div>

      <!-- Rubric Sections -->
      ${sectionsHtml}

      <!-- General Notes -->
      ${notesHtml}
    </div>
  `;
}

/**
 * 1. Export Single Classroom Observation Report to PDF
 */
export async function generateObservationPdf(data: ExportReportData): Promise<void> {
  if (typeof window === 'undefined') return;
  const html2pdf = (await import('html2pdf.js')).default;

  const teacherId = data.video?.teacher_id || data.report.teacher_id || 'Teacher';
  const videoId = (data.video?.id || data.report.video_id || '00000000').slice(0, 8);
  const filename = `Classroom_Observation_Checklist_${teacherId}_${videoId}.pdf`;

  const container = document.createElement('div');
  container.style.cssText = PDF_BASE_STYLES;
  container.innerHTML = buildSingleObservationHtml(data, true);
  document.body.appendChild(container);

  try {
    const margin: [number, number, number, number] = [10, 10, 10, 10];
    const opt = {
      margin,
      filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, letterRendering: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 2. Export Combined Observation Reports to PDF
 */
export async function generateCombinedObservationPdf(
  reportsData: ExportReportData[],
  lang: 'en' | 'vi' = 'vi'
): Promise<void> {
  if (typeof window === 'undefined' || !reportsData || reportsData.length === 0) return;
  const html2pdf = (await import('html2pdf.js')).default;

  const isVi = lang === 'vi';
  const now = new Date();
  const dateStamp = now.toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `Combined_Observation_Reports_${dateStamp}.pdf`;

  const uniqueTeachers = new Set<string>();
  reportsData.forEach((d) => {
    const t = d.video?.teacher_id || d.report.teacher_id;
    if (t) uniqueTeachers.add(t);
  });

  // Cover Page HTML
  const coverHtml = `
    <div style="min-height: 900px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; padding: 60px 40px 40px 40px;">
      <div style="font-size: 14pt; letter-spacing: 2px; color: #64748B; font-weight: bold; margin-bottom: 24px; text-transform: uppercase;">
        ${isVi ? 'HỒ SƠ TỔNG HỢP DỮ LIỆU THỰC ĐỊA' : 'COMPREHENSIVE FIELDWORK DATA ARCHIVE'}
      </div>
      <h1 style="font-size: 24pt; font-weight: bold; color: #1E3A8A; line-height: 1.3; margin-bottom: 20px; max-width: 650px;">
        ${
          isVi
            ? 'BÁO CÁO QUAN SÁT LỚP HỌC TRỰC TUYẾN TOÀN BỘ BÀI DẠY'
            : 'COMPLETE CLASSROOM OBSERVATION REPORTS DOSSIER'
        }
      </h1>
      <div style="font-size: 12.5pt; font-style: italic; color: #374151; max-width: 600px; margin-bottom: 30px; line-height: 1.5;">
        ${
          isVi
            ? 'Nghiên cứu: Chiến lược quản lý lớp học trực tuyến & Khả năng tương tác nói tiếng Anh của học sinh tiểu học'
            : "Primary EFL Teachers' Online Classroom Management Strategies & Student Speaking Participation in Vietnam"
        }
      </div>
      <div style="width: 120px; height: 3px; background: #1E3A8A; margin-bottom: 36px;"></div>

      <div style="background: #F8FAFC; border: 1.5pt solid #CBD5E1; border-radius: 6px; padding: 20px 30px; width: 85%; max-width: 520px; margin-bottom: 40px;">
        <h3 style="font-size: 11pt; font-weight: bold; color: #1E3A8A; margin-bottom: 12px; text-transform: uppercase;">
          ${isVi ? 'THỐNG KÊ TẬP MẪU QUAN SÁT (CORPUS STATS)' : 'CORPUS STATISTICAL SUMMARY'}
        </h3>
        <table style="width: 100%; font-size: 10pt; border-collapse: collapse; text-align: left;">
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 6px 0; color: #64748B;">${isVi ? 'Tổng số báo cáo quan sát:' : 'Total Completed Reports:'}</td>
            <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #1E3A8A;">${reportsData.length} ${isVi ? 'Bài học' : 'Lessons'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 6px 0; color: #64748B;">${isVi ? 'Số lượng giáo viên tham gia:' : 'Participating Teachers:'}</td>
            <td style="padding: 6px 0; font-weight: bold; text-align: right; color: #1E3A8A;">${uniqueTeachers.size} ${isVi ? 'Giáo viên' : 'Teachers'}</td>
          </tr>
          <tr style="border-bottom: 1px solid #E2E8F0;">
            <td style="padding: 6px 0; color: #64748B;">${isVi ? 'Khung tiêu chí đánh giá:' : 'Observation Framework:'}</td>
            <td style="padding: 6px 0; font-weight: bold; text-align: right;">5 ${isVi ? 'Phần' : 'Sections'} (A – E)</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748B;">${isVi ? 'Ngày tổng hợp xuất bản:' : 'Generation Date:'}</td>
            <td style="padding: 6px 0; font-weight: bold; text-align: right;">${now.toLocaleDateString(isVi ? 'vi-VN' : 'en-GB')}</td>
          </tr>
        </table>
      </div>
      <div style="font-size: 9.5pt; color: #94A3B8;">
        ${isVi ? 'Dữ liệu phân tích tự động trích xuất từ Video Teaching Research AI Engine' : 'Auto-generated transcript and observational data from Video Teaching Research AI Engine'}
      </div>
    </div>
  `;

  // Combine Cover and all individual reports
  let allReportsHtml = coverHtml;
  for (let i = 0; i < reportsData.length; i++) {
    allReportsHtml += buildSingleObservationHtml(
      { ...reportsData[i], lang },
      false
    );
  }

  const container = document.createElement('div');
  container.style.cssText = PDF_BASE_STYLES;
  container.innerHTML = allReportsHtml;
  document.body.appendChild(container);

  try {
    const margin: [number, number, number, number] = [10, 10, 10, 10];
    const opt = {
      margin,
      filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 1.8, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Builds HTML string for Teacher Interview Guide
 */
function buildInterviewGuideHtml(data: ExportInterviewGuideData): string {
  const { teacherId, coreQuestions, dynamicQuestions, lang = 'en', generatedDate } = data;
  const isVi = lang === 'vi';
  const dateStr = generatedDate || new Date().toLocaleDateString(isVi ? 'vi-VN' : 'en-GB');

  // Core Questions Rows
  let coreRowsHtml = '';
  coreQuestions.forEach((q: any, idx: number) => {
    const qText = q.question_text || '';
    const rq = q.rq_category || q.target_rq || 'RQ1';
    const rationale = q.pedagogical_rationale || q.rationale || '';

    coreRowsHtml += `
      <tr style="border-bottom: 1px solid #E5E7EB;">
        <td style="padding: 6px 8px; vertical-align: top; text-align: center; font-weight: bold; width: 6%; font-size: 10pt;">${idx + 1}</td>
        <td style="padding: 6px 8px; vertical-align: top; text-align: center; width: 10%;">
          <span style="background:#EFF6FF; color:#1D4ED8; font-weight:bold; padding:2px 6px; border-radius:3px; border:1px solid #BFDBFE; font-size:9pt;">
            ${rq}
          </span>
        </td>
        <td style="padding: 6px 8px; vertical-align: top; font-size: 10pt;">
          <div style="font-weight: 600; color: #111827; margin-bottom: 4px;">${qText}</div>
          ${
            rationale
              ? `<div style="font-size: 9pt; color: #4B5563; font-style: italic;">
                  <strong style="color:#1E3A8A;">${isVi ? 'Cơ sở lý do: ' : 'Rationale: '}</strong>${rationale}
                </div>`
              : ''
          }
        </td>
      </tr>
    `;
  });

  // Dynamic Questions Rows
  let dynamicRowsHtml = '';
  if (dynamicQuestions && dynamicQuestions.length > 0) {
    dynamicQuestions.forEach((q: any, idx: number) => {
      const rq = q.rq_category || q.target_rq || 'RQ1';
      const qText = q.question_text || '';
      let evidenceText = q.evidence_ref || q.evidence_quote || '';

      if (q.timestamp_context) {
        evidenceText = `<strong>[${q.timestamp_context}]</strong> ${evidenceText}`;
      }
      if (q.context_notes) {
        evidenceText = `${evidenceText} <em>(${q.context_notes})</em>`;
      }
      if (!evidenceText) {
        evidenceText = isVi ? 'Dựa trên chuỗi tương tác nhiều tiết học.' : 'Based on multi-lesson recurring interactions.';
      }

      dynamicRowsHtml += `
        <tr style="border-bottom: 1px solid #E5E7EB;">
          <td style="padding: 6px 8px; vertical-align: top; text-align: center; font-weight: bold; width: 6%; font-size: 10pt;">${idx + 1}</td>
          <td style="padding: 6px 8px; vertical-align: top; text-align: center; width: 10%;">
            <span style="background:#FEF3C7; color:#92400E; font-weight:bold; padding:2px 6px; border-radius:3px; border:1px solid #FDE68A; font-size:9pt;">
              ${rq}
            </span>
          </td>
          <td style="padding: 6px 8px; vertical-align: top; font-size: 9pt; color: #374151; width: 36%;">
            ${evidenceText}
          </td>
          <td style="padding: 6px 8px; vertical-align: top; font-size: 10pt; font-weight: 600; color: #111827;">
            ${qText}
          </td>
        </tr>
      `;
    });
  } else {
    dynamicRowsHtml = `
      <tr>
        <td colspan="4" style="padding: 12px; text-align: center; color: #6B7280; font-style: italic;">
          ${isVi ? 'Chưa có câu hỏi đào sâu riêng biệt cho giáo viên này.' : 'No participant-specific questions generated.'}
        </td>
      </tr>
    `;
  }

  return `
    <div style="margin-bottom: 30px;">
      <!-- Title & Header -->
      <div style="text-align: center; margin-bottom: 18px; border-bottom: 2pt solid #1E3A8A; padding-bottom: 12px;">
        <h1 style="font-size: 15pt; font-weight: bold; color: #1E3A8A; margin: 0 0 6px 0; text-transform: uppercase;">
          ${isVi ? 'PHIẾU HƯỚNG DẪN PHỎNG VẤN GIÁO VIÊN BÁN CẤU TRÚC' : 'SEMI-STRUCTURED TEACHER INTERVIEW GUIDE'}
        </h1>
        <div style="font-size: 10pt; font-style: italic; color: #4B5563; margin-bottom: 4px;">
          ${
            isVi
              ? 'Chiến lược quản lý lớp học trực tuyến & Khả năng tương tác nói của học sinh tiểu học'
              : "Primary EFL Teachers' Online Classroom Management Strategies & Learner Interaction"
          }
        </div>
        <div style="font-size: 9pt; color: #6B7280;">
          ${isVi ? 'Giao thức nghiên cứu luận văn thạc sĩ / tiến sĩ sư phạm tiếng Anh' : 'Research Protocol - Qualitative Fieldwork Guide'}
        </div>
      </div>

      <!-- Metadata Box -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10pt; border-top: 1.5pt solid #111827; border-bottom: 1.5pt solid #111827; margin-bottom: 20px;">
        <tr>
          <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC; width: 22%;">${isVi ? 'Mã Giáo Viên:' : 'Participant ID:'}</td>
          <td style="padding: 5px 8px; width: 28%; font-weight: bold; color: #1E3A8A;">${teacherId}</td>
          <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC; width: 22%;">${isVi ? 'Ngày Xuất Bản:' : 'Date Generated:'}</td>
          <td style="padding: 5px 8px; width: 28%;">${dateStr}</td>
        </tr>
        <tr style="border-top: 1px solid #E5E7EB;">
          <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Hình Thức:' : 'Protocol Type:'}</td>
          <td style="padding: 5px 8px;">${isVi ? 'Phỏng Vấn Bán Cấu Trúc' : 'Semi-Structured Interview'}</td>
          <td style="padding: 5px 8px; font-weight: bold; background: #F8FAFC;">${isVi ? 'Trạng Thái Guide:' : 'Core Guide Status:'}</td>
          <td style="padding: 5px 8px; font-weight: bold; color: #166534;">${isVi ? 'Đã Phê Duyệt & Khớp RQ1–RQ3' : 'Approved & Aligned with RQ1–RQ3'}</td>
        </tr>
      </table>

      <!-- Section 1: Inquiry Scope -->
      <div style="margin-bottom: 18px; page-break-inside: avoid;">
        <h3 style="font-size: 11pt; font-weight: bold; color: #1E3A8A; border-bottom: 1.5px solid #1E3A8A; padding-bottom: 4px; margin-bottom: 8px;">
          ${isVi ? '1. PHẠM VI CÂU HỎI NGHIÊN CỨU (RQ1 – RQ3)' : '1. RESEARCH INQUIRY SCOPE (RQ1 – RQ3)'}
        </h3>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 9.5pt;">
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px; border-radius: 4px;">
            <strong style="color:#1D4ED8;">RQ1:</strong> ${isVi ? 'Chiến lược quản lý lớp học thực tế' : 'Actual classroom management strategies'}
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px; border-radius: 4px;">
            <strong style="color:#1D4ED8;">RQ2:</strong> ${isVi ? 'Cảm nhận của giáo viên về cơ hội nói' : 'Teacher perceptions on speaking opportunities'}
          </div>
          <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px; border-radius: 4px;">
            <strong style="color:#1D4ED8;">RQ3:</strong> ${isVi ? 'Thách thức & Biện pháp khắc phục sư phạm' : 'Pedagogical challenges & coping mechanisms'}
          </div>
        </div>
      </div>

      <!-- Section 2: Core Semi-structured Questions -->
      <div style="margin-bottom: 22px; page-break-inside: avoid;">
        <h3 style="font-size: 11pt; font-weight: bold; color: #1E3A8A; border-bottom: 1.5px solid #1E3A8A; padding-bottom: 4px; margin-bottom: 8px;">
          ${isVi ? '2. BỘ CÂU HỎI PHỎNG VẤN BÁN CẤU TRÚC CỐT LÕI' : '2. CORE SEMI-STRUCTURED INTERVIEW QUESTIONS'}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background: #F1F5F9; border-top: 1.5pt solid #111827; border-bottom: 1pt solid #111827;">
              <th style="padding: 6px 8px; text-align: center; width: 6%; font-weight: bold;">${isVi ? 'STT' : 'No.'}</th>
              <th style="padding: 6px 8px; text-align: center; width: 10%; font-weight: bold;">${isVi ? 'Mục Tiêu' : 'Target'}</th>
              <th style="padding: 6px 8px; text-align: left; font-weight: bold;">${isVi ? 'Nội Dung Câu Hỏi & Cơ Sở Phương Pháp Luận' : 'Interview Question & Methodological Rationale'}</th>
            </tr>
          </thead>
          <tbody>
            ${coreRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Section 3: Dynamic Follow-up Questions -->
      <div style="margin-bottom: 22px; page-break-inside: avoid;">
        <h3 style="font-size: 11pt; font-weight: bold; color: #9E4A28; border-bottom: 1.5px solid #9E4A28; padding-bottom: 4px; margin-bottom: 8px;">
          ${isVi ? `3. CÂU HỎI ĐÀO SÂU THEO BẰNG CHỨNG THỰC TẾ (${teacherId})` : `3. PARTICIPANT-SPECIFIC DYNAMIC QUESTIONS (${teacherId})`}
        </h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 10pt;">
          <thead>
            <tr style="background: #FFFBEB; border-top: 1.5pt solid #111827; border-bottom: 1pt solid #111827;">
              <th style="padding: 6px 8px; text-align: center; width: 6%; font-weight: bold;">${isVi ? 'STT' : 'No.'}</th>
              <th style="padding: 6px 8px; text-align: center; width: 10%; font-weight: bold;">${isVi ? 'Mục Tiêu' : 'Target'}</th>
              <th style="padding: 6px 8px; text-align: left; width: 36%; font-weight: bold;">${isVi ? 'Dẫn Chứng & Mốc Thời Gian Lớp Học' : 'Classroom Evidence & Timestamps'}</th>
              <th style="padding: 6px 8px; text-align: left; font-weight: bold;">${isVi ? 'Câu Hỏi Phỏng Vấn Sâu Cụ Thể' : 'In-Depth Follow-up Question'}</th>
            </tr>
          </thead>
          <tbody>
            ${dynamicRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Section 4: Reflection & Field Notes -->
      <div style="margin-top: 24px; padding: 12px; background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 4px; page-break-inside: avoid;">
        <h4 style="font-size: 10.5pt; font-weight: bold; color: #1E3A8A; margin-bottom: 6px;">
          ${isVi ? '4. GHI CHÚ QUAN SÁT & SUY NGẪM SAU PHỎNG VẤN' : '4. INTERVIEWER REFLECTION & FIELD NOTES'}
        </h4>
        <div style="height: 120px; border-bottom: 1px dashed #94A3B8; margin-bottom: 12px;"></div>
        <div style="font-size: 9pt; color: #64748B; font-style: italic;">
          ${isVi ? 'Khoảng trống dành cho nghiên cứu viên ghi chép phản hồi trực tiếp khi phỏng vấn.' : 'Blank section reserved for researcher handwriting during the fieldwork session.'}
        </div>
      </div>
    </div>
  `;
}

/**
 * 3. Export Single Teacher Interview Guide to PDF
 */
export async function generateInterviewGuidePdf(data: ExportInterviewGuideData): Promise<void> {
  if (typeof window === 'undefined') return;
  const html2pdf = (await import('html2pdf.js')).default;

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Teacher_Interview_Guide_${data.teacherId}_${dateStr}.pdf`;

  const container = document.createElement('div');
  container.style.cssText = PDF_BASE_STYLES;
  container.innerHTML = buildInterviewGuideHtml(data);
  document.body.appendChild(container);

  try {
    const margin: [number, number, number, number] = [10, 10, 10, 10];
    const opt = {
      margin,
      filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 4. Generate Teacher Interview Guide PDF Blob (for JSZip packaging)
 */
export async function generateInterviewGuidePdfBlob(data: ExportInterviewGuideData): Promise<Blob> {
  if (typeof window === 'undefined') {
    return new Blob([]);
  }
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.style.cssText = PDF_BASE_STYLES;
  container.innerHTML = buildInterviewGuideHtml(data);
  document.body.appendChild(container);

  try {
    const margin: [number, number, number, number] = [10, 10, 10, 10];
    const opt = {
      margin,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    const pdfBlob: Blob = await html2pdf().set(opt).from(container).outputPdf('blob');
    return pdfBlob;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * 5. Export Qualitative Analytics APA Tables to PDF
 */
export async function generateAPATablesPdf(htmlContent: string, filename: string): Promise<void> {
  if (typeof window === 'undefined') return;
  const html2pdf = (await import('html2pdf.js')).default;

  const container = document.createElement('div');
  container.style.cssText = `
    ${PDF_BASE_STYLES}
    padding: 10px;
  `;
  container.innerHTML = htmlContent;
  document.body.appendChild(container);

  try {
    const margin: [number, number, number, number] = [10, 10, 10, 10];
    const opt = {
      margin,
      filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 1.8, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' as const }, // Landscape for APA tables with 12 teachers
      pagebreak: { mode: ['css', 'legacy'] },
    };

    await html2pdf().set(opt).from(container).save();
  } finally {
    document.body.removeChild(container);
  }
}
