import JSZip from 'jszip';
import {
  api,
  InterviewResponseItem,
  MeaningUnitItem,
  InterviewCodeItem,
  TriangulationEntryItem,
  RepresentativeQuoteItem,
} from './api';
import {
  generatePerTeacherCaseWord,
  generateTeacherTranscriptWord,
  generateChapter4FindingsWord,
  generateQualitativeSynthesisWord,
} from './qualitativeWordExport';

export interface ExportQualitativeZipOptions {
  scope: 'all' | 'current';
  selectedTeacher: string;
  teacherList: string[];
  activeRunId: string;
  lang?: 'en' | 'vi';
  onProgress?: (progress: {
    current: number;
    total: number;
    message: string;
    percentage: number;
  }) => void;
}

/**
 * Orchestrates multi-teacher qualitative data fetching, Word document generation,
 * folder tree packaging, and browser ZIP download.
 */
export async function exportQualitativeZipPackage(options: ExportQualitativeZipOptions): Promise<void> {
  const {
    scope,
    selectedTeacher,
    teacherList,
    activeRunId,
    lang = 'en',
    onProgress,
  } = options;

  const isVi = lang === 'vi';
  const targetTeachers = scope === 'all' ? teacherList : [selectedTeacher];
  const dateStr = new Date().toISOString().slice(0, 10);

  // Total steps: N teachers + 1 (Cross-case synthesis) + 1 (Compression)
  const totalSteps = targetTeachers.length + 2;
  let currentStep = 0;

  const reportProgress = (msg: string) => {
    currentStep++;
    const percentage = Math.min(100, Math.round((currentStep / totalSteps) * 100));
    if (onProgress) {
      onProgress({
        current: currentStep,
        total: totalSteps,
        message: msg,
        percentage,
      });
    }
  };

  if (onProgress) {
    onProgress({
      current: 0,
      total: totalSteps,
      message: isVi ? 'Đang khởi tạo gói dữ liệu định tính...' : 'Initializing qualitative archive...',
      percentage: 0,
    });
  }

  const zip = new JSZip();

  // 1. Fetch common run-level data (Triangulation, Codes, Quotes)
  let runTriangulation: TriangulationEntryItem[] = [];
  let runCodes: InterviewCodeItem[] = [];
  let runQuotes: RepresentativeQuoteItem[] = [];

  try {
    const [triRes, codesRes, quotesRes] = await Promise.all([
      api.getInterviewTriangulation(activeRunId).catch(() => []),
      api.getInterviewCodes(activeRunId).catch(() => []),
      api.getRepresentativeQuotes(activeRunId).catch(() => []),
    ]);
    runTriangulation = triRes;
    runCodes = codesRes;
    runQuotes = quotesRes;
  } catch (err) {
    console.warn('Could not load run-level qualitative synthesis data:', err);
  }

  // 2. Process each teacher folder
  for (let i = 0; i < targetTeachers.length; i++) {
    const teacherId = targetTeachers[i];
    reportProgress(
      isVi
        ? `Đang thu thập và xuất hồ sơ giáo viên ${teacherId} (${i + 1}/${targetTeachers.length})...`
        : `Fetching and generating dossier for Teacher ${teacherId} (${i + 1}/${targetTeachers.length})...`
    );

    let responses: InterviewResponseItem[] = [];
    let meaningUnits: MeaningUnitItem[] = [];

    try {
      const [respData, muData] = await Promise.all([
        api.getInterviewResponses(teacherId, activeRunId).catch(() => []),
        api.getMeaningUnits(teacherId).catch(() => []),
      ]);
      responses = respData;
      meaningUnits = muData;
    } catch (teacherFetchErr) {
      console.warn(`Error fetching qualitative data for ${teacherId}:`, teacherFetchErr);
    }

    // Filter triangulation items specific to this teacher
    const teacherTriangulation = runTriangulation.filter((t) => t.teacher_ref === teacherId);

    // Generate Word Documents
    const [caseReportBlob, transcriptBlob] = await Promise.all([
      generatePerTeacherCaseWord({
        teacherId,
        meaningUnits,
        triangulation: teacherTriangulation,
        responses,
        lang,
        generatedDate: dateStr,
      }),
      generateTeacherTranscriptWord({
        teacherId,
        responses,
        meaningUnits,
        lang,
        generatedDate: dateStr,
      }),
    ]);

    // Folder: TXX_Teacher/
    const teacherFolder = zip.folder(`${teacherId}_Teacher`);
    if (teacherFolder) {
      teacherFolder.file(`Teacher_Case_Study_Report_${teacherId}.docx`, caseReportBlob);
      teacherFolder.file(`Teacher_Interview_Transcript_Q&A_${teacherId}.docx`, transcriptBlob);
    }
  }

  // 3. Process Cross_Case_Synthesis/ folder
  reportProgress(
    isVi
      ? 'Đang tạo báo cáo tổng hợp nghiên cứu, sổ tay mã hóa & trích dẫn Chương 4...'
      : 'Generating cross-case synthesis, thematic codebook & Chapter 4 quotes...'
  );

  const [synthesisBlob, chapter4QuotesBlob] = await Promise.all([
    generateQualitativeSynthesisWord({
      runId: activeRunId,
      codes: runCodes,
      triangulation: runTriangulation,
      quotes: runQuotes,
      lang,
      generatedDate: dateStr,
    }),
    generateChapter4FindingsWord({
      quotes: runQuotes,
      selectedTeacher: scope === 'current' ? selectedTeacher : undefined,
      lang,
      generatedDate: dateStr,
    }),
  ]);

  const crossCaseFolder = zip.folder('Cross_Case_Synthesis');
  if (crossCaseFolder) {
    crossCaseFolder.file('Thematic_Codebook_and_Triangulation_Synthesis.docx', synthesisBlob);
    crossCaseFolder.file('Thesis_Chapter4_Representative_Quotes.docx', chapter4QuotesBlob);
  }

  // 4. Compress ZIP Archive
  reportProgress(
    isVi ? 'Đang nén tập tin ZIP và hoàn tất gói tải xuống...' : 'Compressing ZIP archive and preparing download...'
  );

  const zipContent = await zip.generateAsync(
    {
      type: 'blob',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    },
    (metadata) => {
      // Smooth fine-grained compression progress
      if (onProgress && metadata.percent) {
        const basePct = Math.round(((totalSteps - 1) / totalSteps) * 100);
        const compPct = Math.round((metadata.percent / 100) * (100 - basePct));
        onProgress({
          current: totalSteps,
          total: totalSteps,
          message: isVi
            ? `Đang nén tập tin ZIP (${Math.round(metadata.percent)}%)...`
            : `Compressing ZIP package (${Math.round(metadata.percent)}%)...`,
          percentage: Math.min(100, basePct + compPct),
        });
      }
    }
  );

  // 5. Trigger Browser Download
  const filename =
    scope === 'all'
      ? `Post_Interview_Qualitative_Analysis_All_12Teachers_${dateStr}.zip`
      : `Post_Interview_Qualitative_Analysis_${selectedTeacher}_${dateStr}.zip`;

  const url = URL.createObjectURL(zipContent);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
