'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'vi';

interface TranslationDict {
  [key: string]: {
    en: string;
    vi: string;
  };
}

export const translations: TranslationDict = {
  // Brand & Sidebar
  brandTitle: { en: 'Observation Studio', vi: 'Observation Studio' },
  brandSub: { en: 'Classroom Video Lab', vi: 'Classroom Video Lab' },
  navVideos: { en: 'Video Repository', vi: 'Kho Video Bài Giảng' },
  navUpload: { en: 'Upload Video', vi: 'Tải Lên Video' },
  navChecklists: { en: 'Observation Checklist', vi: 'Khung Tiêu Chí Quan Sát' },
  navReports: { en: 'Reports & Stats', vi: 'Báo Cáo & Thống Kê' },
  navAnalytics: { en: 'Analytics & Trends', vi: 'Phân Tích & Xu Hướng' },
  navCodeBook: { en: 'Code Book', vi: 'Sổ Mã Quan Sát' },
  navThemes: { en: 'Teaching Themes', vi: 'Chiến Lược & Chủ Đề' },
  navInterview: { en: 'Interview Studio', vi: 'Bộ Câu Hỏi Phỏng Vấn' },
  navInterviewAnalysis: { en: 'Interview Analysis', vi: 'Phân Tích Phỏng Vấn' },
  navSettings: { en: 'Admin Center', vi: 'Admin Center' },
  navApiDocs: { en: 'API Docs', vi: 'Tài Liệu API' },
  language: { en: 'Language', vi: 'Ngôn Ngữ' },

  // Post-Interview Qualitative Analysis
  interviewAnalysisTitle: { en: 'Post-Interview Qualitative Analysis', vi: 'Phân Tích Định Tính Phỏng Vấn Giáo Viên' },
  interviewAnalysisSubtitle: {
    en: 'Comprehensive qualitative inquiry pipeline: Audio transcription, dual-mode review, meaning units segmentation, initial coding, and observation-interview triangulation.',
    vi: 'Quy trình nghiên cứu định tính chuẩn luận văn: Bóc băng ghi âm, review 2 chế độ, tách đơn vị ý nghĩa, gắn mã ban đầu và đối chiếu tam giác với video quan sát.'
  },
  iaTabAudioTranscript: { en: '1. Audio & Transcript Review', vi: '1. Ghi Âm & Review Lời Thoại' },
  iaTabMeaningUnits: { en: '2. Meaning Units', vi: '2. Tách Đơn Vị Ý Nghĩa' },
  iaTabCoding: { en: '3. Initial Coding & Categories', vi: '3. Bảng Mã & Phân Loại' },
  iaTabTriangulation: { en: '4. Observation Triangulation', vi: '4. Đối Chiếu Tam Giác' },
  iaTabPerTeacher: { en: '5. Per-Teacher Case Analysis', vi: '5. Đối Chiếu Từng Giáo Viên' },
  iaTabQuotes: { en: '6. Representative Quotes', vi: '6. Trích Dẫn Tiêu Biểu' },
  iaModeRaw: { en: 'Mode 1: Raw Audio Transcript', vi: 'Chế độ 1: Xem Thô từ Audio' },
  iaModePolished: { en: 'Mode 2: Polished Q&A View', vi: 'Chế độ 2: Giao Diện Làm Đẹp Q&A' },
  iaUploadTitle: { en: 'Upload Teacher Interview Audio', vi: 'Tải Lên File Ghi Âm Phỏng Vấn' },
  iaUploadDesc: {
    en: 'Upload 1 single continuous audio recording (.mp3, .m4a, .wav) for this teacher. AI will transcribe and segment Q&A pairs.',
    vi: 'Tải lên 1 file ghi âm liên tục (.mp3, .m4a, .wav) cho giáo viên này. AI sẽ tự động bóc băng và phân tách cặp câu hỏi - trả lời.'
  },
  iaTranscribeBtn: { en: 'Transcribe with AI', vi: 'Bóc Băng Bằng AI' },
  iaTranscribing: { en: 'Transcribing audio...', vi: 'Đang bóc băng âm thanh...' },
  iaFinalizeBtn: { en: 'Finalize Transcript', vi: 'Chốt & Lưu Lời Thoại' },
  iaFinalizedSuccess: { en: 'Transcript finalized successfully', vi: 'Đã chốt và lưu câu trả lời thành công' },
  iaStatusUploaded: { en: 'Audio Uploaded', vi: 'Đã tải lên audio' },
  iaStatusTranscribing: { en: 'Transcribing...', vi: 'Đang bóc băng...' },
  iaStatusTranscribed: { en: 'Transcribed (Needs Review)', vi: 'Đã bóc băng (Cần duyệt)' },
  iaStatusFinalized: { en: 'Finalized', vi: 'Đã hoàn tất & chốt' },
  iaListenAudio: { en: 'Listen Audio', vi: 'Nghe File Ghi Âm' },
  iaTeacherSelect: { en: 'Select Teacher', vi: 'Chọn Giáo Viên' },
  iaSegmentBtn: { en: 'AI Segment Meaning Units', vi: 'AI Tách Meaning Units' },
  iaSegmenting: { en: 'Segmenting...', vi: 'Đang tách ý...' },
  iaGenerateCodesBtn: { en: 'AI Generate Initial Codes', vi: 'AI Gợi Ý Mã & Category' },
  iaGeneratingCodes: { en: 'Generating codes...', vi: 'Đang tạo mã...' },
  iaRunTriangulationBtn: { en: 'Run Triangulation Analysis', vi: 'Chạy Đối Chiếu Tam Giác' },
  iaRunningTriangulation: { en: 'Triangulating data...', vi: 'Đang đối chiếu tam giác...' },
  iaSelectQuotesBtn: { en: 'AI Select Golden Quotes', vi: 'AI Tuyển Chọn Trích Dẫn Vàng' },
  iaSelectingQuotes: { en: 'Selecting quotes...', vi: 'Đang tuyển chọn trích dẫn...' },
  iaExportBtn: { en: 'Export Chapter 4 Findings', vi: 'Xuất Báo Cáo Luận Văn' },
  iaRelationshipConfirms: { en: 'Confirms', vi: 'Xác Nhận (Confirms)' },
  iaRelationshipExplains: { en: 'Explains Rationale', vi: 'Giải Thích Lý Do (Explains)' },
  iaRelationshipContradicts: { en: 'Divergent / Contradicts', vi: 'Khác Biệt (Contradicts)' },
  iaRelationshipAddsInfo: { en: 'Adds Context', vi: 'Bổ Sung Bối Cảnh (Adds Info)' },
  iaAddMeaningUnit: { en: 'Add Meaning Unit', vi: 'Thêm Đơn Vị Ý Nghĩa' },
  iaUnitIndex: { en: 'Unit #', vi: 'Ý số' },
  iaUnitText: { en: 'Meaning Unit Text', vi: 'Nội dung ý nghĩa' },
  iaInitialCode: { en: 'Initial Code', vi: 'Mã ban đầu' },
  iaCategory: { en: 'Pedagogical Category', vi: 'Danh mục sư phạm' },
  iaFrequency: { en: 'Frequency', vi: 'Tần suất' },
  iaTeachers: { en: 'Teachers', vi: 'Giáo viên' },
  iaObservationFinding: { en: 'Video Observation Finding', vi: 'Phát hiện quan sát Video' },
  iaInterviewEvidence: { en: 'Teacher Interview Evidence', vi: 'Bằng chứng phỏng vấn' },
  iaRelationship: { en: 'Triangulation Relationship', vi: 'Mối quan hệ tam giác' },
  iaQuoteText: { en: 'Quote Text', vi: 'Nội dung trích dẫn' },
  iaQuoteSource: { en: 'Source', vi: 'Nguồn' },
  iaRelevanceType: { en: 'Relevance Type', vi: 'Loại liên quan' },
  iaSelectedQuotes: { en: 'Selected for Thesis', vi: 'Chọn đưa vào luận văn' },

  // Research Analytics & Trends (Qualitative Evidence & Thematic Synthesis)

  analyticsTitle: { en: 'Qualitative Evidence & Thematic Synthesis', vi: 'Bằng Chứng Định Tính & Tổng Hợp Chủ Đề' },
  analyticsSubtitle: { en: 'Academic qualitative research visualizations: Cross-case Coverage Matrix, Inductive Audit Trail, and RQ1 Enactment Framework.', vi: 'Trực quan hoá định tính phục vụ luận văn: Ma trận độ phủ 24 bài giảng, Sơ đồ chuỗi quy nạp (Audit Trail) và Bản đồ truy vết RQ1.' },
  qualitativeStudioTitle: { en: 'Qualitative Evidence & Thematic Synthesis', vi: 'Bằng Chứng Định Tính & Tổng Hợp Chủ Đề' },
  qualitativeStudioSubtitle: {
    en: 'Academic qualitative research visualizations: Cross-case Coverage Matrix, Inductive Audit Trail, and RQ1 Enactment Framework.',
    vi: 'Trực quan hoá định tính phục vụ luận văn: Ma trận độ phủ 24 bài giảng, Sơ đồ chuỗi quy nạp (Audit Trail) và Bản đồ truy vết RQ1.',
  },
  qualitativeMatrixTitle: { en: '1. Observation Framework Dimensions Coverage Matrix', vi: '1. Ma Trận Độ Phủ 5 Kích Thước Quan Sát Luận Văn' },
  qualitativeMatrixSubtitle: {
    en: 'Demonstrates cross-case qualitative presence across 24 lessons (T01-L1 to T12-L2) without evaluative scoring or ranking.',
    vi: 'Thể hiện mức độ xuất hiện thực nghiệm của 5 kích thước quan sát sư phạm qua 24 bài giảng mà không đánh giá hiệu quả hay xếp hạng.',
  },
  qualitativeHierarchyTitle: { en: '2. Grounded Thematic Coding Tree (Audit Trail)', vi: '2. Sơ Đồ Cây Phân Tích Chủ Đề Quy Nạp (Audit Trail)' },
  qualitativeHierarchySubtitle: {
    en: 'Inductive thematic synthesis connecting raw observation excerpts to overarching candidate themes.',
    vi: 'Chuỗi logic quy nạp kết nối trích dẫn thực địa với các chủ đề nghiên cứu bao quát.',
  },
  qualitativeHierarchyPendingTitle: { en: 'Pending Final Thematic Synthesis', vi: 'Chưa có dữ liệu chủ đề chính thức' },
  qualitativeHierarchyPendingDesc: {
    en: 'Final overarching themes will be established following the completion of semi-structured teacher interviews (RQ2 & RQ3) to perform empirical triangulation with the 24-lesson classroom video observation dataset.',
    vi: 'Các chủ đề bao quát (Overarching Themes) sẽ được xác định chính thức sau khi hoàn thành thu thập và phân tích dữ liệu phỏng vấn giáo viên (Semi-structured Interviews) để thực hiện đối chiếu tam giác hóa dữ liệu (Triangulation) với kết quả quan sát 24 bài giảng video.',
  },
  qualitativeHierarchyPendingBadge: { en: 'Pending Interview Data (Phase 2)', vi: 'Chờ Dữ Liệu Phỏng Vấn (Giai đoạn 2)' },
  qualitativeRQ1Title: { en: '3. RQ1 Enactment & Traceability Map', vi: '3. Bản Đồ Truy Vết Triển Khai Chiến Lược (RQ1)' },
  qualitativeRQ1Subtitle: {
    en: 'Direct empirical audit trail: Analytical Dimension → Recurring Pattern → Observed Enactment → Representative Lesson → Timestamp/Context.',
    vi: 'Chuỗi đối chiếu thực nghiệm: Kích Thước Phân Tích → Mẫu Hành Vi Lặp Lại → Hành Vi Quan Sát Được → Bài Giảng Tiêu Biểu → Mốc Thời Gian / Ngữ Cảnh.',
  },
  qualitativeViewLessons: { en: '24 Lessons (T01-L1...T12-L2)', vi: '24 Bài Học (T01-L1...T12-L2)' },
  qualitativeViewTeachers: { en: '12 Teachers (T01...T12)', vi: '12 Giáo Viên (T01...T12)' },
  qualitativeExportMatrixSVG: { en: 'Coverage Matrix (SVG)', vi: 'Ma Trận Độ Phủ (SVG)' },
  qualitativeExportHierarchySVG: { en: 'Hierarchy Tree (SVG)', vi: 'Sơ Đồ Cây (SVG)' },
  qualitativeExportRQ1SVG: { en: 'RQ1 Enactment Map (SVG)', vi: 'Bản Đồ RQ1 (SVG)' },
  qualitativeExportAllBundle: { en: 'Export All 3 Qualitative Diagrams (SVG Bundle)', vi: 'Xuất Toàn Bộ 3 Biểu Đồ Định Tính (SVG)' },
  qualitativeExportWordAPA: { en: 'Word (APA)', vi: 'Word (APA)' },
  qualitativeExportPdfAPA: { en: 'PDF (APA)', vi: 'PDF (APA)' },
  qualitativeExportPdfAPASuccess: { en: 'APA 7th PDF tables exported successfully!', vi: 'Đã xuất bảng PDF APA 7th thành công!' },
  analyticsViewBy: { en: 'View by:', vi: 'Xem theo:' },
  qualitativeTreeView: { en: 'Tree View (SVG)', vi: 'Sơ Đồ Cây (SVG)' },
  qualitativeBentoView: { en: 'Bento Cards', vi: 'Thẻ Phân Cụm' },
  qualitativeFilterStrategy: { en: 'Filter Dimension:', vi: 'Lọc kích thước:' },
  qualitativeAllStrategies: { en: 'All Dimensions', vi: 'Tất cả 5 kích thước' },
  qualitativeColDimension: { en: 'Analytical Dimension (Thesis Framework)', vi: 'Kích Thước Phân Tích (5 Dimensions)' },
  qualitativeColFrameworkSection: { en: 'Observation Framework Section', vi: 'Phần Khung Luận Văn' },
  qualitativeColRQ1Dimension: { en: 'Analytical Dimension', vi: 'Kích Thước Phân Tích' },
  qualitativeColRQ1Pattern: { en: 'Recurring Pattern', vi: 'Mẫu Hành Vi Lặp Lại' },
  qualitativeColRQ1Enactment: { en: 'Observed Enactment', vi: 'Hành Vi Quan Sát Được' },
  qualitativeColRQ1Lessons: { en: 'Representative Lessons', vi: 'Bài Giảng Tiêu Biểu' },
  qualitativeColRQ1TimestampContext: { en: 'Timestamp / Context', vi: 'Mốc Thời Gian & Ngữ Cảnh' },
  qualitativeMatrixLegend: {
    en: 'Legend: ● = Qualitative evidence present in lesson transcript/video. Click dimension name to inspect citations.',
    vi: 'Ký hiệu: ● = Có bằng chứng định tính xuất hiện trong bài học. Bấm vào tên kích thước để xem trích dẫn minh họa.',
  },
  qualitativeMethodStandard: {
    en: 'Observation Framework Standard • Miles & Huberman Qualitative Cross-Case Standard',
    vi: 'Tiêu chuẩn khung quan sát luận văn • Phân tích đa trường hợp định tính Miles & Huberman',
  },
  qualitativeClickToInspect: {
    en: 'Click to inspect raw qualitative citations',
    vi: 'Bấm vào để xem trích dẫn bằng chứng thực địa',
  },
  qualitativeAuditTrailNote: {
    en: 'Lincoln & Guba (1985) Audit Trail Framework • Generated via Observation Studio Qualitative Engine',
    vi: 'Khung chuỗi kiểm tra độc lập Lincoln & Guba (1985) • Trích xuất qua Observation Studio',
  },
  qualitativeColStrategy: { en: 'Classroom Management Strategy', vi: 'Chiến Lược Quản Lý Lớp Học' },
  qualitativeColEnactments: { en: 'Observed Pedagogical Enactments', vi: 'Hành Vi Triển Khai Quan Sát Được' },
  qualitativeColLessons: { en: 'Representative Lessons', vi: 'Bài Giảng Tiêu Biểu' },
  qualitativeColQuotes: { en: 'Verifiable Direct Quotes & Timestamps', vi: 'Trích Dẫn & Mốc Thời Gian Xác Thực' },
  qualitativePatternsCount: { en: 'Patterns', vi: 'Mẫu hành vi' },
  qualitativeDrawerTitle: { en: 'Code Drill-Down & Audit Trail', vi: 'Truy Vết Bằng Chứng & Chuỗi Phân Tích' },
  qualitativeDrawerCategory: { en: 'Category:', vi: 'Phân mục:' },
  qualitativeDrawerTheme: { en: 'Theme:', vi: 'Chủ đề:' },
  qualitativeDrawerTotalCitations: { en: 'Total Citations:', vi: 'Tổng số trích dẫn:' },
  qualitativeDrawerExcerpts: { en: 'excerpts', vi: 'trích dẫn' },
  qualitativeDrawerEvidenceHeading: {
    en: 'Raw Observation Evidence Across Corpus (Direct Citations):',
    vi: 'Bằng chứng quan sát thực địa trên toàn bộ tập dữ liệu (Trích dẫn trực tiếp):',
  },
  qualitativeDrawerNoEvidence: {
    en: 'No raw citations recorded for this code yet.',
    vi: 'Chưa có trích dẫn thực địa được ghi nhận cho mã này.',
  },
  qualitativeDrawerContext: { en: 'Context:', vi: 'Ngữ cảnh:' },
  qualitativeDrawerClose: { en: 'Close', vi: 'Đóng' },

  // Qualitative Thematic Content Bilingual Translations
  theme1Title: { en: 'Theme 1: Multimodal Scaffolding Framework', vi: 'Chủ Đề 1: Khung Giàn Giáo Đa Phương Thức' },
  theme1Desc: {
    en: 'Synchronous integration of visual anchors and digital signaling to sustain the Zone of Proximal Development (ZPD) for young EFL learners.',
    vi: 'Sự kết hợp đồng bộ giữa neo thị giác (Visual anchors) và phản hồi kỹ thuật số nhằm duy trì vùng phát triển gần nhất (ZPD) cho học sinh tiểu học.',
  },
  theme1Reasoning: {
    en: 'AI Synthesis: Teachers strategically leverage split-screen organizers, laser spotlights, and emoji polling to relieve lexical cognitive load prior to oral production.',
    vi: 'Tổng hợp AI: Giáo viên khai thác triệt để đa phương thức trên lớp trực tuyến (slide chia sẻ, con trỏ laser, icon chat) để giảm tải nhận thức từ vựng trước khi yêu cầu học sinh nói trọn câu.',
  },

  theme2Title: { en: 'Theme 2: Pacing & Safe-Failure Environment', vi: 'Chủ Đề 2: Kiểm Soát Nhịp Độ & Môi Trường An Toàn' },
  theme2Desc: {
    en: 'Flexible pacing architecture featuring deliberate silence buffers and effort-oriented praise to neutralize foreign language speaking anxiety.',
    vi: 'Kiến tạo nhịp độ bài học linh hoạt với khoảng đệm im lặng và phản hồi khen ngợi nỗ lực, giải tỏa nỗi sợ sai cho người học EFL trực tuyến.',
  },
  theme2Reasoning: {
    en: 'AI Synthesis: Teachers deliberately elongate wait-time buffers beyond 3 seconds and pivot praise from grammatical correctness to communicative effort.',
    vi: 'Tổng hợp AI: Giáo viên chủ động giãn thời gian chờ (>3s) và chuyển đổi từ khen ngợi kết quả sang khen ngợi sự nỗ lực sửa sai, hình thành tâm lý dám giao tiếp.',
  },

  theme3Title: { en: 'Theme 3: Routine-Governed Learner Agency', vi: 'Chủ Đề 3: Quyền Tự Chủ Điều Phối Qua Quy Tắc' },
  theme3Desc: {
    en: 'Establishment of transparent digital turn-taking protocols (randomized wheel, nomination chains) decentralizing conversational authority.',
    vi: 'Thiết lập các quy tắc trực tuyến công bằng (vòng quay ngẫu nhiên, chỉ định nối tiếp) giúp học sinh làm chủ lượt nói thay vì giáo viên độc thoại.',
  },
  theme3Reasoning: {
    en: 'AI Synthesis: Visual randomized selection routines ensure 100% alertness across the cohort and promote equitable turn allocation without teacher monologue dominance.',
    vi: 'Tổng hợp AI: Quy trình chọn ngẫu nhiên trực quan giúp duy trì sự tập trung 100% của cả lớp và công bằng cơ hội tham gia mà không bị giáo viên độc thoại chi phối.',
  },

  // RQ1 Strategies
  rq1Strat1Title: { en: 'Structured Turn-Taking & Equity Protocols', vi: 'Quy Chuẩn Điều Phối Lượt Nói Công Bằng' },
  rq1Strat1Sub: {
    en: 'Equitable speaking distribution preventing vocal student domination and shielding reluctant participants.',
    vi: 'Điều phối lượt nói công bằng, tránh tình trạng học sinh hoạt ngôn áp đảo hoặc học sinh nhút nhát lẩn tránh.',
  },
  rq1Strat2Title: { en: 'Affective Buffering & Extended Wait Pacing', vi: 'Đệm Cảm Xúc & Kéo Dài Thời Gian Chờ' },
  rq1Strat2Sub: {
    en: 'Pacing regulation creating safe pauses for student self-repair and communication anxiety alleviation.',
    vi: 'Kiểm soát nhịp độ, tạo khoảng lặng an toàn tâm lý giúp học sinh tự sửa lỗi phát âm và giảm âu lo giao tiếp.',
  },
  rq1Strat3Title: { en: 'Multimodal Digital Tool Orchestration', vi: 'Điều Phối Công Cụ Kỹ Thuật Số Đa Phương Thức' },
  rq1Strat3Sub: {
    en: 'Simultaneous mobilization of chat box, reaction icons, and annotation tools to ensure 100% active engagement.',
    vi: 'Khai thác đồng thời hộp chat, icon cảm xúc và bảng vẽ trực tiếp để duy trì sự tham gia của 100% học sinh.',
  },

  analyticsCorpusLabel: { en: 'Corpus', vi: 'Tập dữ liệu' },
  analyticsVideos: { en: 'videos', vi: 'video' },
  analyticsEvents: { en: 'verified pedagogical events', vi: 'sự kiện sư phạm đã xác thực' },
  analyticsExportCSV: { en: 'Export CSV / SPSS', vi: 'Xuất Dữ Liệu CSV / SPSS' },
  analyticsExportVector: { en: 'Export High-Res Vector (Paper)', vi: 'Xuất Hình Vector (Báo Cáo KH)' },
  analyticsExportMenuAll: { en: 'Export All 4 Charts (Vector Bundle)', vi: 'Xuất Toàn Bộ 4 Biểu Đồ (Gói Vector)' },
  analyticsExportTrajectory: { en: 'Longitudinal Trajectory (SVG)', vi: 'Biểu Đồ Tiến Triển Hành Vi (SVG)' },
  analyticsExportRadar: { en: '5-Dimensional Radar Profile (SVG)', vi: 'Hồ Sơ Năng Lực Radar 5D (SVG)' },
  analyticsExportStream: { en: 'Intra-Lesson Dynamics Stream (SVG)', vi: 'Dòng Chảy Phân Bố Tiết Học (SVG)' },
  analyticsExportQuadrant: { en: 'Pedagogical Quadrant Map (SVG)', vi: 'Ma Trận Phân Loại Phong Cách (SVG)' },
  analyticsExportSingleBtn: { en: 'Export SVG', vi: 'Xuất SVG' },
  analyticsExportSuccess: { en: 'Vector graphic exported with full legend & metadata', vi: 'Đã xuất hình vector kèm chú giải & thông số hoàn chỉnh' },
  analyticsExportAllSuccess: { en: 'All 4 publication-ready vector charts exported!', vi: 'Đã xuất thành công toàn bộ 4 biểu đồ vector báo cáo!' },
  analyticsTeacherSelect: { en: 'Teacher', vi: 'Giáo Viên' },
  analyticsTeacherAll: { en: 'All Teachers in Corpus', vi: 'Tất cả giáo viên trong tập dữ liệu' },
  analyticsTeacherPrefix: { en: 'Teacher', vi: 'Giáo viên' },
  analyticsChecklistSection: { en: 'Checklist Section', vi: 'Phân Mục Tiêu Chí' },
  analyticsSectionAll: { en: 'All Strategy Groups (A, B, C, E)', vi: 'Tất cả nhóm tiêu chí (A, B, C, E)' },
  analyticsSectionA: { en: 'Section A: Instructional Scaffolding', vi: 'Mục A: Giàn giáo hướng dẫn' },
  analyticsSectionB: { en: 'Section B: Questioning & Wait-Time', vi: 'Mục B: Đặt câu hỏi & Chờ đợi' },
  analyticsSectionC: { en: 'Section C: Positive Affect & Praise', vi: 'Mục C: Khích lệ cảm xúc' },
  analyticsSectionD: { en: 'Section D: Multimodal Tool Usage', vi: 'Mục D: Ứng dụng đa phương thức' },
  analyticsSectionE: { en: 'Section E: Student Agency & Production', vi: 'Mục E: Quyền tự chủ học sinh' },
  analyticsTimeframe: { en: 'Lesson Sequence', vi: 'Chuỗi Tiết Dạy' },
  analyticsTimeframeAll: { en: 'All Analyzed Sessions', vi: 'Toàn bộ các tiết dạy' },
  analyticsTimeframePre: { en: 'Initial Phase (First 1/3)', vi: 'Giai đoạn đầu (1/3 chuỗi đầu)' },
  analyticsTimeframePost: { en: 'Later Phase (Last 2/3)', vi: 'Giai đoạn sau (2/3 chuỗi sau)' },
  analyticsSequenceNote: { en: 'Chronological session order', vi: 'Sắp xếp theo thứ tự thời gian' },
  analyticsRefresh: { en: 'Refresh', vi: 'Làm Mới' },
  kpiTotalEvents: { en: 'Total Pedagogical Events', vi: 'Tổng Sự Kiện Sư Phạm' },
  kpiTotalEventsSub: { en: 'Extracted and verified across corpus', vi: 'Đã trích xuất & kiểm chứng trên toàn tập mẫu' },
  kpiAvgWaitTime: { en: 'Average Teacher Wait-Time', vi: 'Thời Gian Chờ Trung Bình' },
  kpiAvgWaitTimeSub: { en: 'Pause time for student cognitive processing', vi: 'Thời gian dừng cho học sinh xử lý ngôn ngữ' },
  kpiScaffoldingRate: { en: 'Verbal Scaffolding Ratio', vi: 'Tỷ Lệ Giàn Giáo Lời Nói' },
  kpiScaffoldingRateSub: { en: 'Sentence starters, prompts & elicitation', vi: 'Câu gợi ý, mồi từ & giàn giáo ngữ pháp' },
  kpiAIConfidence: { en: 'AI Evaluation Agreement', vi: 'Độ Tin Cậy AI Khớp Chuẩn' },
  kpiAIConfidenceSub: { en: 'Multimodal observation alignment', vi: 'Mức độ đồng thuận phân tích đa phương thức' },
  chartTrajectoryTitle: { en: 'Longitudinal Pedagogical Trajectory', vi: 'Xu Hướng Tiến Triển Hành Vi Sư Phạm' },
  chartTrajectoryDescAll: { en: 'Analyzed sessions in chronological order • All 4 strategic behavior groups', vi: 'Các tiết dạy thực tế theo thứ tự thời gian • Tất cả 4 nhóm hành vi' },
  chartTrajectoryDescFiltered: { en: 'Analyzed sessions in chronological order • Filtered by', vi: 'Các tiết dạy thực tế theo thứ tự thời gian • Đang lọc theo' },
  chartTrajectoryViewPerLesson: { en: 'Per Lesson', vi: 'Từng Tiết' },
  chartTrajectoryViewMA: { en: '3-Lesson MA', vi: 'Trung Bình 3 Tiết' },
  chartTrajectoryLegendScaffolding: { en: 'Scaffolding Elicitation (Sec A)', vi: 'Giàn Giáo Lời Nói (Mục A)' },
  chartTrajectoryLegendWaitTime: { en: 'Extended Wait Time (>3s) (Sec B)', vi: 'Thời Gian Chờ >3s (Mục B)' },
  chartTrajectoryLegendPraise: { en: 'Specific Praise (Sec C)', vi: 'Khen Ngợi Cụ Thể (Mục C)' },
  chartTrajectoryLegendAgency: { en: 'Student Initiated Turns (Sec E)', vi: 'Lượt Học Sinh Tự Chủ (Mục E)' },
  chartRadarTitle: { en: '5-Dimensional Pedagogical Profile (A–E)', vi: 'Hồ Sơ Sư Phạm 5 Chiều (A–E)' },
  chartRadarDesc: { en: 'Observed distribution across the 5 checklist dimensions', vi: 'Phân bổ trọng số thực tế của toàn bộ tập dữ liệu' },
  chartStreamTitle: { en: 'Intra-Lesson Temporal Dynamics (0–45 min)', vi: 'Dòng Chảy Tiết Học (0–45 phút)' },
  chartStreamDesc: { en: 'Behavioral density per 5-minute block across standard lesson structure.', vi: 'Mật độ các nhóm hành vi theo từng block 5 phút trong cấu trúc tiết dạy chuẩn.' },
  chartStreamWarmup: { en: 'Warm-up & Elicit', vi: 'Khởi Động & Gợi Mở' },
  chartStreamScaffolding: { en: 'Instructional Scaffolding', vi: 'Giàn Giáo Hướng Dẫn' },
  chartStreamStudentTurns: { en: 'Student Turns', vi: 'Học Sinh Thực Hành' },
  chartStreamPraise: { en: 'Praise & Wrap-up', vi: 'Khen Ngợi & Tổng Kết' },
  chartQuadrantTitle: { en: 'Pedagogical Style Classification', vi: 'Phân Loại Phong Cách Sư Phạm' },
  chartQuadrantDesc: { en: 'Teacher positions based on observed classroom behavior ratios', vi: 'Vị trí các giáo viên theo tỷ lệ hành vi quan sát' },
  quadrantFacilitative: { en: 'Facilitative Mentors', vi: 'Người Hướng Dẫn Tương Tác' },
  quadrantStructured: { en: 'Structured Direct', vi: 'Chỉ Dẫn Trực Tiếp Cấu Trúc' },
  quadrantConversational: { en: 'Open Conversational', vi: 'Giao Tiếp Cởi Mở' },
  quadrantTraditional: { en: 'Traditional Guided', vi: 'Dẫn Dắt Truyền Thống' },
  chartQuadrantXLabel: { en: 'Student Agency & Production (%)', vi: 'Mức độ tự chủ học sinh (Agency %)' },
  chartQuadrantYLabel: { en: 'Teacher Scaffolding Quality (%)', vi: 'Chất lượng giàn giáo (Scaffolding %)' },
  evidenceTitle: { en: 'QUALITATIVE OBSERVATION EVIDENCE TRACE', vi: 'TRÍCH XUẤT ĐỊNH TÍNH BẰNG CHỨNG QUAN SÁT' },
  evidenceContext: { en: 'Observation context:', vi: 'Bối cảnh quan sát:' },
  tooltipHoverTeacher: { en: 'Hover point to inspect', vi: 'Rê chuột vào điểm để xem chi tiết' },
  tooltipTeacher: { en: 'Teacher:', vi: 'Giáo viên:' },
  tooltipEvents: { en: 'events', vi: 'sự kiện' },
  tooltipTurns: { en: 'turns', vi: 'lượt' },
  analyticsRadarA: { en: 'A: Scaffolding', vi: 'A: Giàn giáo' },
  analyticsRadarB: { en: 'B: Wait-Time', vi: 'B: Thời gian chờ' },
  analyticsRadarC: { en: 'C: Praise', vi: 'C: Khen ngợi' },
  analyticsRadarD: { en: 'D: Multimodal', vi: 'D: Đa phương thức' },
  analyticsRadarE: { en: 'E: Student Agency', vi: 'E: Tự chủ' },
  chartQuadrantAgencyShort: { en: 'Agency', vi: 'Tự chủ' },
  chartQuadrantScaffoldShort: { en: 'Scaffolding', vi: 'Giàn giáo' },

  // AI Studio
  aiStudioTitle: { en: 'AI Pipeline Studio & Dynamic Model Router', vi: 'AI Pipeline Studio & Điều Hướng Model' },
  aiStudioSubtitle: { en: 'Interactive Stage Flowgraph • Automated Model Routing & API Key Vault', vi: 'Sơ Đồ Chuỗi Xử Lý Trực Quan • Quản Lý Model & Kho Khóa API Tự Động' },
  aiStudioActiveVault: { en: 'Active API Key Vault', vi: 'Kho Khóa API Đang Kích Hoạt' },
  aiStudioAddKey: { en: 'Add API Key', vi: 'Thêm Khóa API' },
  aiStudioSaveAll: { en: 'Save All Settings', vi: 'Lưu Tất Cả Cài Đặt' },
  aiStudioSavedSuccess: { en: 'AI flow configurations saved successfully!', vi: 'Đã lưu cấu hình các luồng AI thành công!' },
  aiStudioNodeInspector: { en: 'NODE INSPECTOR', vi: 'TÙY CHỈNH BƯỚC XỬ LÝ' },
  aiStudioTargetModel: { en: 'Target AI Model', vi: 'Mô Hình AI Sử Dụng' },
  aiStudioAssignedKey: { en: 'Assigned API Key', vi: 'Khóa API Gán Cho Bước Này' },
  aiStudioTemperature: { en: 'Sampling Temperature', vi: 'Nhiệt Độ Lấy Mẫu (Temperature)' },
  aiStudioApplyNode: { en: 'Apply Changes to Flow', vi: 'Áp Dụng Cho Bước Này' },
  aiStudioTestPing: { en: 'Test Live API Ping', vi: 'Kiểm Tra Kết Nối (Ping)' },
  aiStudioPresetAllFlash: { en: 'All-Gemini Flash', vi: 'Toàn Bộ Gemini Flash' },
  aiStudioPresetClaude: { en: 'Claude 3.7 Research', vi: 'Nghiên Cứu Với Claude 3.7' },
  aiStudioPresetCustom: { en: 'Custom', vi: 'Tùy Chọn' },
  aiStudioManageModels: { en: 'Model Catalog', vi: 'Danh Mục Models' },
  aiStudioModelCatalogTitle: { en: 'AI Model Registry & Capabilities', vi: 'Quản Lý Danh Mục Mô Hình AI' },
  aiStudioAddModel: { en: 'Add New Model', vi: 'Thêm Model Mới' },
  aiStudioEditModel: { en: 'Edit Model Specs', vi: 'Chỉnh Sửa Model' },
  aiStudioModelId: { en: 'Model Identifier / API String', vi: 'Mã Model ID (API Name)' },
  aiStudioModelDisplayName: { en: 'Display Name', vi: 'Tên Hiển Thị' },
  aiStudioModelProvider: { en: 'Provider', vi: 'Nhà Cung Cấp' },
  aiStudioModelContextTokens: { en: 'Context Window (Tokens)', vi: 'Kích Thước Ngữ Cảnh (Tokens)' },
  aiStudioModelMultimodal: { en: 'Supports Multimodal (Video/Audio)', vi: 'Hỗ Trợ Đa Phương Thức (Video/Audio)' },
  aiStudioModelReasoning: { en: 'Supports Extended Reasoning', vi: 'Hỗ Trợ Suy Luận Sâu (Reasoning)' },
  aiStudioModelIsActive: { en: 'Active in Model Selectors', vi: 'Kích Hoạt Trong Menu Chọn' },
  aiStudioModelSaved: { en: 'Model saved successfully!', vi: 'Đã lưu mô hình AI thành công!' },
  aiStudioModelDeleted: { en: 'Model removed from catalog', vi: 'Đã xóa mô hình khỏi danh mục' },
  aiStudioEditKey: { en: 'Edit API Key', vi: 'Chỉnh Sửa Khóa API' },
  aiStudioKeySecretPlaceholder: { en: '•••••••••••••••• (Leave blank to keep existing secret)', vi: '•••••••••••••••• (Để trống nếu giữ nguyên khóa hiện tại)' },
  aiStudioKeySecretOverwriteNote: { en: 'For security, the current key is not displayed. Enter a new string only to overwrite it.', vi: 'Vì lý do bảo mật, khóa hiện tại không được hiển thị. Chỉ nhập chuỗi mới nếu bạn muốn ghi đè khóa cũ.' },
  aiStudioKeyDefaultBadge: { en: 'Default Key', vi: 'Khóa Mặc Định' },
  aiStudioKeySetDefault: { en: 'Set as Default for Provider', vi: 'Đặt làm khóa mặc định cho nhà cung cấp' },
  aiStudioKeyStatusActive: { en: 'Active in Flow Routing', vi: 'Kích hoạt sử dụng trong chuỗi' },

  // Admin & Settings Tabs
  tabAdminCenter: { en: 'API Config & Routing', vi: 'Cấu Hình API & Định Tuyến' },
  tabApiConfig: { en: 'API Config & Routing', vi: 'Cấu Hình API & Định Tuyến' },
  tabTelegramAlerts: { en: 'Telegram Notifications', vi: 'Cấu Hình Telegram' },
  tabActivityLog: { en: 'Activity & Audit Trail', vi: 'Nhật Ký Hoạt Động & Kiểm Toán' },

  // Common UI Actions & Words
  commonBack: { en: 'Back', vi: 'Quay Lại' },
  commonBackVideos: { en: 'Back to Video Repository', vi: 'Quay Lại Kho Video' },
  commonBackReports: { en: 'Back to Reports List', vi: 'Quay Lại Danh Sách Báo Cáo' },
  commonRefresh: { en: 'Refresh', vi: 'Làm Mới' },
  commonSave: { en: 'Save', vi: 'Lưu' },
  commonSaving: { en: 'Saving...', vi: 'Đang Lưu...' },
  commonCancel: { en: 'Cancel', vi: 'Hủy' },
  commonAdd: { en: 'Add', vi: 'Thêm' },
  commonAddItem: { en: 'Add Item', vi: 'Thêm Tiêu Chí' },
  commonDelete: { en: 'Delete', vi: 'Xóa' },
  commonEdit: { en: 'Edit', vi: 'Chỉnh Sửa' },
  commonDetails: { en: 'Details', vi: 'Chi Tiết' },
  commonStop: { en: 'Stop', vi: 'Dừng' },
  commonStopping: { en: 'Stopping...', vi: 'Đang Dừng...' },
  commonRestarting: { en: 'Restarting...', vi: 'Đang Khởi Động Lại...' },
  commonDone: { en: 'Done', vi: 'Hoàn Thành' },
  commonFailed: { en: 'Failed', vi: 'Thất Bại' },
  commonInProgress: { en: 'In Progress', vi: 'Đang Xử Lý' },
  commonQueued: { en: 'Queued', vi: 'Đang Chờ' },
  commonCopy: { en: 'Copy Text', vi: 'Sao Chép' },
  commonCopied: { en: 'Copied', vi: 'Đã Sao Chép' },
  commonCopyQuestions: { en: 'Copy Questions', vi: 'Sao Chép Câu Hỏi' },
  commonActive: { en: 'Active', vi: 'Đang Chạy' },
  commonNeedsReview: { en: 'Needs Review', vi: 'Cần Xem Lại' },
  commonNote: { en: 'Note', vi: 'Lưu ý' },
  commonClose: { en: 'Close', vi: 'Đóng' },
  commonSearch: { en: 'Search', vi: 'Tìm kiếm' },

  // Dashboard & Video List
  dashboardTitle: { en: 'Classroom Video Analysis', vi: 'Phân Tích Video Giảng Dạy' },
  dashboardDesc: {
    en: 'AI-assisted video analysis, observation checklist matching, and qualitative teaching strategy synthesis.',
    vi: 'Tự động nhận diện hành vi trong lớp, đối chiếu khung tiêu chí quan sát và tổng hợp chiến lược giảng dạy.'
  },
  uploadNewLesson: { en: 'Upload Lesson Video', vi: 'Tải Video Bài Giảng' },
  status: { en: 'Status', vi: 'Trạng Thái' },
  bannerUploadRunningTitle: { en: 'Video Analysis Pipeline Running', vi: 'Tiến Trình Phân Tích Video Đang Chạy' },
  bannerUploadRunningDesc: { en: 'A lesson video is currently uploading and being analyzed by Gemini AI.', vi: 'Một bài giảng đang được tải lên và phân tích tự động bằng Gemini AI.' },
  btnViewLiveProgress: { en: 'View Live Progress', vi: 'Xem Tiến Trình Trực Tiếp' },
  teacher: { en: 'Teacher', vi: 'Giáo Viên' },
  lessonTitle: { en: 'Lesson Title', vi: 'Tiêu Đề Bài Giảng' },
  duration: { en: 'Duration', vi: 'Thời Lượng' },
  processingTime: { en: 'Processing Time', vi: 'Thời Gian Xử Lý' },
  uploadedAt: { en: 'Uploaded At', vi: 'Ngày Tải Lên' },
  actions: { en: 'Actions', vi: 'Thao Tác' },
  runPipeline: { en: 'Start Analysis', vi: 'Bắt Đầu Phân Tích' },
  rerunPipeline: { en: 'Re-run Analysis', vi: 'Chạy Lại Phân Tích' },
  retryAnalysis: { en: 'Retry Analysis', vi: 'Thử Lại Phân Tích' },
  viewReport: { en: 'View Report', vi: 'Xem Báo Cáo' },
  reviewEvents: { en: 'Review Events', vi: 'Xem Sự Kiện' },
  eventsList: { en: 'Events', vi: 'Sự Kiện' },
  inspectError: { en: 'Inspect Error', vi: 'Kiểm Tra Lỗi' },
  videosInRepo: { en: 'videos in repository', vi: 'video trong kho bài giảng' },
  filterSearchPlaceholder: { en: 'Search by lesson title or teacher ID...', vi: 'Tìm theo tên bài giảng hoặc mã giáo viên...' },
  filterAllStatuses: { en: 'All Statuses', vi: 'Tất Cả Trạng Thái' },
  filterAllModes: { en: 'All Processing Modes', vi: 'Tất Cả Chế Độ' },
  filterModeChunk: { en: 'Chunk Mode', vi: 'Chế Độ Chunk' },
  filterModeFull: { en: 'Full Video Mode', vi: 'Chế Độ Full Video' },
  modeChunk: { en: 'Chunk', vi: 'Chunk' },
  modeFull: { en: 'Full Video', vi: 'Full Video' },
  modeUnprocessed: { en: 'Unprocessed', vi: 'Chưa Xử Lý' },
  modeChunkTooltip: { en: 'Video was sliced into segments and processed with parallel workers', vi: 'Video được chia thành các đoạn và xử lý song song' },
  modeFullTooltip: { en: 'Video was analyzed directly as a single full file with AI', vi: 'Video được gửi trực tiếp toàn bộ để phân tích' },
  modeChangedBadge: { en: 'Mode Changed: Restart Required', vi: 'Chuyển Chế Độ: Yêu Cầu Phân Tích Lại Từ Đầu' },
  modeChangedTooltip: { en: 'Changing processing mode invalidates previous checkpoints. Pipeline will cleanly restart from Step 1.', vi: 'Thay đổi chế độ phân tích sẽ xóa dữ liệu cũ. Hệ thống sẽ phân tích lại từ đầu từ Bước 1.' },
  processingMode: { en: 'Mode', vi: 'Chế Độ' },
  filterCompleted: { en: 'Completed', vi: 'Đã Hoàn Thành' },
  filterInProgress: { en: 'In Progress', vi: 'Đang Xử Lý' },
  filterQueued: { en: 'Queued', vi: 'Đang Chờ' },
  filterFailed: { en: 'Failed / Error', vi: 'Lỗi / Thất Bại' },
  filterCancelled: { en: 'Cancelled', vi: 'Đã Hủy' },
  filterAllTeachers: { en: 'All Teachers', vi: 'Tất Cả Giáo Viên' },
  filterSortBy: { en: 'Sort by', vi: 'Sắp xếp' },
  sortNewest: { en: 'Recently Active / Newest', vi: 'Hoạt động gần nhất / Mới nhất' },
  sortOldest: { en: 'Oldest First', vi: 'Cũ nhất' },
  sortTitleAsc: { en: 'Title (A → Z)', vi: 'Tiêu đề (A → Z)' },
  sortTitleDesc: { en: 'Title (Z → A)', vi: 'Tiêu đề (Z → A)' },
  sortDurationDesc: { en: 'Duration (Longest)', vi: 'Thời lượng (Dài nhất)' },
  sortDurationAsc: { en: 'Duration (Shortest)', vi: 'Thời lượng (Ngắn nhất)' },
  sortProcessingTimeDesc: { en: 'Processing Time (Longest)', vi: 'Thời gian xử lý (Lâu nhất)' },
  sortProcessingTimeAsc: { en: 'Processing Time (Shortest)', vi: 'Thời gian xử lý (Nhanh nhất)' },
  moreActions: { en: 'More Actions', vi: 'Thao tác khác' },
  filterReset: { en: 'Reset Filters', vi: 'Đặt Lại Bộ Lọc' },
  filterShowingCount: { en: 'Showing {count} of {total} lessons', vi: 'Hiển thị {count} / {total} bài giảng' },
  filterNoResultsTitle: { en: 'No matching lessons found', vi: 'Không tìm thấy bài giảng phù hợp' },
  filterNoResultsDesc: { en: 'Try adjusting your search keyword, status, or teacher filter.', vi: 'Thử điều chỉnh từ khóa tìm kiếm, trạng thái hoặc chọn giáo viên khác.' },
  statTotalLessons: { en: 'Total Successful Lessons', vi: 'Tổng Bài Giảng Hoàn Thành' },
  statObservedTeachers: { en: 'Observed Teachers', vi: 'Giáo Viên Quan Sát' },
  statChecklistCriteria: { en: 'Checklist Criteria', vi: 'Tiêu Chí Quan Sát' },
  statTeachingThemes: { en: 'Teaching Themes', vi: 'Chiến Lược Sư Phạm' },
  statTarget24: { en: 'Target: 24 Videos', vi: 'Mục Tiêu: 24 Video' },
  statSectionsAE: { en: 'Sections A–E', vi: 'Sections A–E' },
  statSynthesized: { en: 'Synthesized', vi: 'Đã Tổng Hợp' },
  editVideo: { en: 'Edit / Reassign', vi: 'Sửa / Đổi Giáo Viên' },
  reassignTeacher: { en: 'Reassign Teacher', vi: 'Gán Lại Giáo Viên' },
  editVideoModalTitle: { en: 'Edit Video & Teacher Assignment', vi: 'Chỉnh Sửa Video & Gán Lại Giáo Viên' },
  editVideoModalDesc: {
    en: 'Update the assigned teacher ID and lesson title. Changing the teacher will automatically sync all extracted events and generated reports.',
    vi: 'Cập nhật mã giáo viên và tiêu đề bài giảng. Đổi giáo viên sẽ tự động đồng bộ tất cả sự kiện đã trích xuất và báo cáo đã tạo.'
  },
  currentTeacher: { en: 'Current Teacher', vi: 'Giáo Viên Hiện Tại' },
  newTeacher: { en: 'Assigned Teacher ID *', vi: 'Mã Giáo Viên Được Gán *' },
  selectOrTypeTeacher: { en: 'Select existing teacher or type a new one', vi: 'Chọn giáo viên có sẵn hoặc nhập mã mới' },
  selectTeacherPlaceholder: { en: 'e.g. T01, T02, T12...', vi: 'ví dụ: T01, T02, T12...' },
  videoTitleLabel: { en: 'Lesson Title', vi: 'Tiêu Đề Bài Giảng' },
  videoTitlePlaceholder: { en: 'Enter lesson title...', vi: 'Nhập tiêu đề bài giảng...' },
  btnSaveVideo: { en: 'Save Changes', vi: 'Lưu Thay Đổi' },
  btnSaving: { en: 'Saving...', vi: 'Đang Lưu...' },
  videoUpdateSuccess: { en: 'Video and teacher assignment updated successfully!', vi: 'Đã cập nhật video và gán lại giáo viên thành công!' },
  videoUpdateError: { en: 'Failed to update video: ', vi: 'Không thể cập nhật video: ' },
  cannotEditWhileRunning: { en: 'Cannot edit video while analysis pipeline is running.', vi: 'Không thể chỉnh sửa khi tiến trình phân tích đang chạy.' },
  quickSelectTeacher: { en: 'Quick Select Existing Teacher', vi: 'Chọn Nhanh Giáo Viên Có Sẵn' },

  // Delete video
  deleteVideo: { en: 'Delete Video', vi: 'Xóa Video' },
  deleteVideoTitle: { en: 'Delete Video', vi: 'Xóa Video' },
  deleteVideoWarning: { en: 'This action cannot be undone.', vi: 'Hành động này không thể khôi phục.' },
  deleteVideoCascadeWarning: {
    en: 'All associated data will be deleted: chunks, events, mappings, reports, codebook, pipeline jobs.',
    vi: 'Tất cả dữ liệu liên quan sẽ bị xóa: chunks, events, mappings, reports, codebook, pipeline jobs.',
  },
  deleteConfirmLabel: { en: 'Type "DELETE" to confirm:', vi: 'Nhập "DELETE" để xác nhận:' },
  deleteVideoSuccess: { en: 'Video and all associated data deleted successfully!', vi: 'Đã xóa video và tất cả dữ liệu liên quan thành công!' },
  btnConfirmDelete: { en: 'Delete Permanently', vi: 'Xóa Vĩnh Viễn' },
  btnDeleting: { en: 'Deleting...', vi: 'Đang xóa...' },

  // Reset pipeline
  resetPipeline: { en: 'Reset Pipeline', vi: 'Đặt Lại Tiến Trình' },
  resetPipelineTitle: { en: 'Reset Pipeline', vi: 'Đặt Lại Tiến Trình Phân Tích' },
  resetPipelineDesc: {
    en: 'Delete all analysis results and return to initial uploaded status.',
    vi: 'Xóa tất cả kết quả phân tích và quay lại trạng thái ban đầu.',
  },
  resetPipelineCascadeWarning: {
    en: 'This will delete: chunks, events, mappings, reports, codebook, pipeline jobs. The original video file will be kept.',
    vi: 'Sẽ xóa: chunks, events, mappings, reports, codebook, pipeline jobs. Video gốc sẽ được giữ lại.',
  },
  resetPipelineSuccess: { en: 'Pipeline reset successfully! Video returned to uploaded status.', vi: 'Reset pipeline thành công! Video đã quay lại trạng thái uploaded.' },
  btnConfirmReset: { en: 'Reset Pipeline', vi: 'Đặt Lại Tiến Trình' },
  btnResetting: { en: 'Resetting...', vi: 'Đang reset...' },

  // Delete report
  deleteReport: { en: 'Delete Report', vi: 'Xóa Báo Cáo' },
  deleteReportTitle: { en: 'Delete Observation Report', vi: 'Xóa Báo Cáo Quan Sát' },
  deleteReportWarning: {
    en: 'This will delete the generated report and its item statistics. The video status will roll back to mapped.',
    vi: 'Hành động này sẽ xóa báo cáo và toàn bộ thống kê tiêu chí. Video sẽ quay lại trạng thái đã khớp (mapped).',
  },
  deleteReportSuccess: { en: 'Report deleted successfully!', vi: 'Đã xóa báo cáo thành công!' },
  btnConfirmDeleteReport: { en: 'Delete Report', vi: 'Xóa Báo Cáo' },

  // Delete analysis run
  deleteAnalysisRun: { en: 'Delete Analysis Run', vi: 'Xóa Đợt Phân Tích' },
  deleteAnalysisRunTitle: { en: 'Delete Grounded Theory Analysis Run', vi: 'Xóa Đợt Phân Tích Grounded Theory' },
  deleteAnalysisRunWarning: {
    en: 'This will delete this analysis run and all associated patterns, categories, themes, and teacher interview questions.',
    vi: 'Hành động này sẽ xóa đợt phân tích và toàn bộ patterns, categories, themes, và câu hỏi phỏng vấn giáo viên liên quan.',
  },
  deleteAnalysisRunSuccess: { en: 'Analysis run deleted successfully!', vi: 'Đã xóa đợt phân tích thành công!' },
  btnConfirmDeleteRun: { en: 'Delete Run', vi: 'Xóa Đợt Phân Tích' },

  // Bulk delete videos
  bulkDeleteVideos: { en: 'Delete Selected', vi: 'Xóa Đã Chọn' },
  bulkDeleteTitle: { en: 'Delete Selected Videos', vi: 'Xóa Các Video Đã Chọn' },
  bulkDeleteWarning: {
    en: 'This will permanently delete the selected videos and all their associated data (chunks, events, mappings, reports, codebook).',
    vi: 'Hành động này sẽ xóa vĩnh viễn các video đã chọn và toàn bộ dữ liệu liên quan (chunks, sự kiện, khớp tiêu chí, báo cáo, codebook).',
  },
  bulkDeleteSuccess: { en: 'Selected videos deleted successfully!', vi: 'Đã xóa các video đã chọn thành công!' },
  selectedVideosCount: { en: 'selected', vi: 'đã chọn' },
  selectAll: { en: 'Select All', vi: 'Chọn tất cả' },
  deselectAll: { en: 'Deselect All', vi: 'Bỏ chọn tất cả' },

  // Delete Codebook
  deleteCodebook: { en: 'Clear Codebook', vi: 'Xóa Sổ Mã Hóa' },
  deleteCodebookTitle: { en: 'Clear Codebook Entries', vi: 'Xóa Toàn Bộ Mục Sổ Mã Hóa' },
  deleteCodebookWarning: {
    en: 'This will delete all codebook entries for this video. You can re-generate them with AI anytime.',
    vi: 'Hành động này sẽ xóa toàn bộ mục mã hóa của video này. Bạn có thể dùng AI tạo lại bất cứ lúc nào.',
  },
  deleteCodebookSuccess: { en: 'Codebook cleared successfully!', vi: 'Đã xóa sổ mã hóa thành công!' },
  btnConfirmDeleteCodebook: { en: 'Clear Codebook', vi: 'Xóa Sổ Mã Hóa' },

  // Delete Raw Events
  deleteRawEvents: { en: 'Clear Events', vi: 'Xóa Sự Kiện' },
  deleteRawEventsTitle: { en: 'Clear Extracted Events', vi: 'Xóa Sự Kiện Đã Trích Xuất' },
  deleteRawEventsWarning: {
    en: 'This will delete all extracted events, mappings, and report, resetting the video status back to chunked.',
    vi: 'Hành động này sẽ xóa toàn bộ sự kiện, khớp tiêu chí và báo cáo, đưa video về trạng thái đã cắt đoạn (chunked).',
  },
  deleteRawEventsSuccess: { en: 'Events cleared successfully! Video reset to chunked.', vi: 'Đã xóa sự kiện thành công! Video đã chuyển về trạng thái chunked.' },
  btnConfirmDeleteEvents: { en: 'Clear Events', vi: 'Xóa Sự Kiện' },




  // Upload Page
  uploadDesc: {
    en: 'Upload recorded Zoom MP4 lessons (up to 2GB) for automated classroom event extraction & observation checklist matching.',
    vi: 'Tải video bài giảng Zoom MP4 (tối đa 2GB) để tự động trích xuất sự kiện lớp học và khớp tiêu chí quan sát.'
  },
  uploadTeacherId: { en: 'Teacher ID *', vi: 'Mã Giáo Viên *' },
  uploadLessonTitle: { en: 'Lesson Title', vi: 'Tiêu Đề Bài Giảng' },
  uploadTitlePlaceholder: { en: 'e.g. Lesson 1 — Phonics & Turn-Taking Routines', vi: 'VD: Lesson 1 — Phonics & Turn-Taking Routines' },
  uploadVideoFile: { en: 'Video File (.mp4) *', vi: 'Tệp Video (.mp4) *' },
  uploadDropPrompt: { en: 'Click or drag Zoom MP4 file here', vi: 'Nhấn hoặc kéo thả tệp video MP4 vào đây' },
  uploadDropSub: { en: 'Max 2GB per video recording (720p Recommended)', vi: 'Tối đa 2GB mỗi video bài giảng (khuyến nghị độ phân giải 720p)' },
  uploadProcessingMode: { en: 'Video Processing Mode', vi: 'Chế Độ Phân Tích Video' },
  uploadChooseMode: { en: 'Choose processing mode', vi: 'Chọn phương pháp xử lý' },
  uploadModeSplit: { en: 'Split into 10-minute parts', vi: 'Chia nhỏ 10 phút/đoạn' },
  uploadModeSplitDesc: {
    en: 'Splits video into 10-min parts. Recommended for longer lessons (> 10 mins) to accurately capture turn-taking and classroom routines.',
    vi: 'Chia nhỏ video thành từng đoạn 10 phút. Khuyến nghị cho bài giảng dài (> 10 phút) để nhận diện chi tiết luân phiên lượt lời và nề nếp lớp học.'
  },
  uploadModeFull: { en: 'Process full video', vi: 'Phân tích toàn bộ video' },
  uploadModeFullDesc: {
    en: 'Analyzes the whole video in one pass. Faster, best suited for short teaching clips (< 10 mins).',
    vi: 'Phân tích trực tiếp toàn bộ video liên tục. Xử lý nhanh hơn, phù hợp với các video/clip ngắn (< 10 phút).'
  },
  uploadRecommended: { en: 'Recommended', vi: 'Khuyến Nghị' },
  uploadPreview: { en: 'Preview', vi: 'Bản Thử Nghiệm' },
  uploadDefault: { en: 'Default', vi: 'Mặc Định' },
  uploadDirect: { en: 'Direct', vi: 'Trực Tiếp' },
  uploadBtnSubmit: { en: 'Upload & Start Analysis', vi: 'Tải Lên & Bắt Đầu Phân Tích' },
  uploadBtnUploading: { en: 'Uploading video...', vi: 'Đang tải video lên...' },

  // Stepper (Steps)
  stepUpload: { en: 'Upload', vi: 'Tải Lên' },
  stepChunking: { en: 'Video Slicing', vi: 'Cắt Đoạn (10p)' },
  stepExtraction: { en: 'AI Extraction', vi: 'Nhận Diện Hành Vi' },
  stepDeduplication: { en: 'Deduplication', vi: 'Gộp & Khử Trùng' },
  stepNormalization: { en: 'Timeline Normalization', vi: 'Chuẩn Hóa Dòng Thời Gian' },
  stepMapping: { en: 'Checklist Match', vi: 'Khớp Tiêu Chí' },
  stepReport: { en: 'Report & Stats', vi: 'Báo Cáo & Thống Kê' },

  // Video Detail & Pipeline Live
  analysisProgress: { en: 'Analysis Progress', vi: 'Tiến Trình Phân Tích' },
  liveProgressTitle: { en: 'Real-time Analysis Progress', vi: 'Tiến Trình Phân Tích Trực Tiếp' },
  liveProgressDesc: { en: 'Updating progress automatically', vi: 'Đang tự động cập nhật tiến độ' },
  liveBadgeAnalyzing: { en: 'ANALYZING', vi: 'ĐANG XỬ LÝ' },
  liveUploadTitle: { en: 'Uploading Video...', vi: 'Đang Tải Video Lên...' },
  liveUploadSub: { en: 'Analysis pipeline will start automatically once upload reaches 100%', vi: 'Hệ thống sẽ tự động khởi chạy phân tích AI ngay khi tải xong 100%' },
  liveUploadSpeed: { en: 'Speed', vi: 'Tốc độ' },
  liveUploadRemaining: { en: 'Remaining', vi: 'Còn lại' },
  liveUploadCompleted: { en: 'Upload completed • Initializing pipeline...', vi: 'Tải lên hoàn tất • Đang khởi tạo pipeline...' },
  liveUploadCancel: { en: 'Cancel Upload', vi: 'Hủy Tải Lên' },
  liveUploadingBadge: { en: 'UPLOADING', vi: 'ĐANG TẢI LÊN' },
  liveProcessingBadge: { en: 'INITIALIZING', vi: 'ĐANG KHỞI TẠO' },
  haltedAtStep: { en: 'Halted at step:', vi: 'Bị gián đoạn tại bước:' },
  interruptedTitle: { en: 'Analysis Interrupted at Step:', vi: 'Quá Trình Phân Tích Bị Gián Đoạn Tại Bước:' },
  interruptedDesc: {
    en: 'An error occurred while analyzing this lesson video. You can review the diagnostic error details below or retry the analysis.',
    vi: 'Đã xảy ra lỗi trong quá trình phân tích video bài giảng này. Bạn có thể xem chi tiết nhật ký lỗi bên dưới hoặc thử chạy lại.'
  },
  btnRetryNow: { en: 'Retry Analysis Now', vi: 'Thử Lại Phân Tích Ngay' },
  btnViewTechLog: { en: 'View Technical Error Output', vi: 'Xem Nhật Ký Kỹ Thuật (Debug)' },
  btnHideTechLog: { en: 'Hide Technical Error Output', vi: 'Ẩn Nhật Ký Kỹ Thuật (Debug)' },
  waitingEventsStream: {
    en: 'Extracting classroom interactions. Observed events will appear here in real-time...',
    vi: 'Đang trích xuất tương tác lớp học. Các sự kiện ghi nhận sẽ xuất hiện tại đây theo thời gian thực...'
  },
  modeOptSplit: { en: '10-minute segments', vi: 'Chia đoạn 10 phút' },
  modeOptFull: { en: 'Full video', vi: 'Toàn bộ video' },
  pipelineRunningTime: { en: 'Elapsed', vi: 'Đã chạy' },
  pipelineTotalDuration: { en: 'AI Processing Time', vi: 'Thời gian xử lý AI' },
  videoDuration: { en: 'Video Duration', vi: 'Thời lượng video' },
  fileSize: { en: 'File Size', vi: 'Dung lượng' },
  stepDuration: { en: 'Duration', vi: 'Thời lượng' },
  liveProcessingDuration: { en: 'Processing', vi: 'Đang xử lý' },
  liveTransferringVideo: { en: 'Transferring video to server', vi: 'Đang truyền video lên máy chủ' },
  liveStartingPipeline: { en: 'Initializing analysis pipeline...', vi: 'Đang khởi tạo quy trình phân tích AI...' },
  statusPreparing: { en: 'Preparing Analysis', vi: 'Chuẩn Bị Phân Tích' },
  statusChunking: { en: 'Video Slicing', vi: 'Cắt Đoạn Video' },
  statusExtracting: { en: 'AI Event Extraction', vi: 'Nhận Diện Hành Vi (AI)' },
  statusMerging: { en: 'Timeline Normalization', vi: 'Chuẩn Hóa Dòng Thời Gian' },
  statusMapping: { en: 'Checklist Matching', vi: 'Khớp Tiêu Chí Quan Sát' },
  statusStatistics: { en: 'Synthesizing Report', vi: 'Tổng Hợp Báo Cáo' },
  statusCompleted: { en: 'Completed', vi: 'Hoàn Tất' },

  // Pipeline Step Titles & Descriptions
  stepUploadTitle: { en: 'Step 1: Video Upload', vi: 'Bước 1: Tải Lên Video' },
  stepUploadDesc: { en: 'Upload lesson video file to server', vi: 'Tải tệp video bài giảng lên máy chủ' },
  stepChunkingTitle: { en: 'Step 2: Video Slicing', vi: 'Bước 2: Cắt Đoạn Video (10 Phút)' },
  stepChunkingDesc: { en: 'Partition into 10-minute segments', vi: 'Phân đoạn video thành các phần 10 phút' },
  stepExtractingTitle: { en: 'Step 2: AI Event Extraction', vi: 'Bước 2: Nhận Diện Hành Vi Giảng Dạy (Gemini AI)' },
  stepExtractingChunkedTitle: { en: 'Step 3: Classroom Event Extraction', vi: 'Bước 3: Nhận Diện Hành Vi Giảng Dạy' },
  stepExtractingDesc: { en: 'Direct multimodal extraction from full video', vi: 'Trích xuất đa phương thức trực tiếp từ video gốc' },
  stepExtractingChunkedDesc: { en: 'Identify teacher & student interactions', vi: 'Gemini AI trích xuất tương tác sư phạm' },
  stepNormalizationTitle: { en: 'Step 3: Timeline Normalization', vi: 'Bước 3: Chuẩn Hóa Dòng Thời Gian' },
  stepNormalizationDesc: { en: 'Normalize events and timestamp sequence', vi: 'Định dạng mốc thời gian và chuẩn hóa sự kiện' },
  stepMergeTitle: { en: 'Step 4: Timeline Merge & Deduplication', vi: 'Bước 4: Chuẩn Hóa Dòng Thời Gian' },
  stepMergeDesc: { en: 'Combine and deduplicate events across parts', vi: 'Hợp nhất và khử trùng lặp sự kiện' },
  stepMappingTitle: { en: 'Step 3: Checklist Matching', vi: 'Bước 3: Khớp Tiêu Chí Quan Sát' },
  stepMappingChunkedTitle: { en: 'Step 4: Checklist Matching', vi: 'Bước 4: Khớp Tiêu Chí Quan Sát' },
  stepMappingDesc: { en: 'Match observed events to observation criteria', vi: 'Ánh xạ vào 5 nhóm tiêu chí Sections A–E' },
  stepReportTitle: { en: 'Step 4: Report Synthesis', vi: 'Bước 4: Tổng Hợp Báo Cáo' },
  stepReportChunkedTitle: { en: 'Step 5: Report Synthesis', vi: 'Bước 5: Tổng Hợp Báo Cáo' },
  stepReportDesc: { en: 'Synthesize findings and calculate frequencies', vi: 'Tổng hợp thống kê và sinh báo cáo hoàn chỉnh' },

  // Event Timeline
  timelineTitle: { en: 'Extracted Classroom Events', vi: 'Danh Sách Sự Kiện Lớp Học' },
  eventsCount: { en: 'events captured', vi: 'sự kiện ghi nhận' },
  filterAll: { en: 'All Events', vi: 'Tất Cả' },
  filterVisual: { en: 'Visual', vi: 'Hình Ảnh' },
  filterAudio: { en: 'Audio', vi: 'Âm Thanh' },
  filterContext: { en: 'Context', vi: 'Ngữ Cảnh' },
  timelineSearchPlaceholder: { en: 'Search events (e.g. wait time, points to slide)...', vi: 'Tìm sự kiện (VD: wait time, points to slide)...' },
  timelineNoEvents: { en: 'No events found matching current criteria.', vi: 'Không tìm thấy sự kiện nào phù hợp với bộ lọc hiện tại.' },

  // Checklists Page
  checklistsTitle: { en: 'Observation Checklist', vi: 'Khung Tiêu Chí Quan Sát' },
  checklistsDesc: {
    en: 'Standard observation criteria for evaluating online Zoom English instruction for young learners (Sections A–E).',
    vi: 'Khung tiêu chí chuẩn quan sát và đánh giá giờ dạy tiếng Anh trực tuyến trên Zoom cho trẻ em (Sections A–E).'
  },
  checklistsVersionBadge: { en: 'v1.0 Final', vi: 'Phiên Bản v1.0' },
  checklistsSaveBtn: { en: 'Save Changes', vi: 'Lưu Thay Đổi' },
  checklistsSecA: { en: 'Section A. Establishing Online Rules and Routines', vi: 'Phân Mục A. Thiết Lập Quy Tắc & Nề Nếp Học Trực Tuyến' },
  checklistsSecB: { en: 'Section B. Managing Turn-taking and Speaking Participation', vi: 'Phân Mục B. Quản Lý Lượt Nói & Mức Độ Tham Gia Giao Tiếp' },
  checklistsSecC: { en: 'Section C. Sustaining Learner Attention and Engagement', vi: 'Phân Mục C. Duy Trì Sự Tập Trung & Hứng Thú Của Học Sinh' },
  checklistsSecD: { en: 'Section D. Providing Scaffolding and Positive Reinforcement', vi: 'Phân Mục D. Hỗ Trợ Giàn Giáo Ngôn Ngữ & Củng Cố Tích Cực' },
  checklistsSecE: { en: 'Section E. Using Digital Tools to Support Learning and Interaction', vi: 'Phân Mục E. Ứng Dụng Công Cụ Kỹ Thuật Số Hỗ Trợ Tương Tác' },

  // Reports
  reportsDesc: {
    en: 'Formatted observational findings per lesson, ready for academic research thesis citations and qualitative analysis.',
    vi: 'Báo cáo kết quả quan sát từng bài giảng, sẵn sàng cho trích dẫn luận văn nghiên cứu và phân tích định tính.'
  },
  reportsReadFull: { en: 'Read Full Report', vi: 'Xem Toàn Bộ Báo Cáo' },
  reportsVersion: { en: 'Observation v1.0', vi: 'Quan Sát v1.0' },
  reportsExportWord: { en: 'Word', vi: 'Word' },
  reportsExportingWord: { en: 'Word...', vi: 'Đang xuất...' },
  reportsExportPdf: { en: 'PDF', vi: 'PDF' },
  reportsExportingPdf: { en: 'PDF...', vi: 'Đang xuất...' },
  reportsExportPdfSuccess: { en: 'Observation report successfully exported to PDF!', vi: 'Đã xuất báo cáo quan sát ra file PDF thành công!' },
  reportsExportAllWord: { en: 'Word Dossier', vi: 'Hồ sơ Word' },
  reportsExportingAllWord: { en: 'Word...', vi: 'Đang xuất...' },
  reportsExportAllSuccess: { en: 'All reports successfully exported to Word (.docx)!', vi: 'Đã xuất toàn bộ báo cáo ra file Word (.docx) thành công!' },
  reportsExportAllPdf: { en: 'PDF Dossier', vi: 'Hồ sơ PDF' },
  reportsExportingAllPdf: { en: 'PDF...', vi: 'Đang xuất...' },
  reportsExportAllSuccessPdf: { en: 'All reports successfully exported to PDF (.pdf)!', vi: 'Đã xuất toàn bộ báo cáo ra file PDF (.pdf) thành công!' },
  reportsNoReportsToExport: { en: 'No completed reports available to export.', vi: 'Chưa có báo cáo hoàn thành nào để xuất.' },
  reportsExportProgressFetching: { en: 'Fetching report', vi: 'Đang tải dữ liệu báo cáo' },
  reportsExportProgressCompiling: { en: 'Compiling Word document...', vi: 'Đang đóng gói file Word...' },
  reportsExportProgressCompilingPdf: { en: 'Compiling PDF document...', vi: 'Đang đóng gói file PDF...' },
  reportsDownloadMd: { en: 'Download Markdown', vi: 'Tải File Markdown' },
  reportsColIndicators: { en: 'Indicators', vi: 'Chỉ Báo Quan Sát' },
  reportsColObserved: { en: 'Observed', vi: 'Ghi Nhận' },
  reportsColFrequency: { en: 'Frequency', vi: 'Tần Suất' },
  reportsColTimestamp: { en: 'Timestamp', vi: 'Mốc Thời Gian' },
  reportsColContext: { en: 'Context', vi: 'Ngữ Cảnh & Dẫn Chứng' },
  reportsObservedYes: { en: 'Yes', vi: 'Có' },
  reportsObservedNo: { en: 'No', vi: 'Không' },
  reportsLessonInfo: { en: 'Lesson Information', vi: 'Thông Tin Tiết Dạy' },
  reportsGeneralNotes: { en: 'General Observation Notes', vi: 'Ghi Chú Quan Sát Tổng Quan' },
  reportsChecklistTitle: { en: 'Classroom Observation Checklist', vi: 'Khung Tiêu Chí Quan Sát Lớp Học' },
  reportsObservationNo: { en: 'Observation No.', vi: 'Mã Số Tiết Quan Sát' },
  reportsTeacher: { en: 'Teacher', vi: 'Giáo Viên' },
  reportsDate: { en: 'Date', vi: 'Ngày Quan Sát' },
  reportsClass: { en: 'Class', vi: 'Lớp Học' },
  reportsPlatform: { en: 'Platform (Zoom/Google Meet)', vi: 'Nền Tảng Trực Tuyến' },
  reportsLessonTopic: { en: 'Lesson Topic', vi: 'Chủ Đề Tiết Dạy' },
  reportsDuration: { en: 'Duration', vi: 'Thời Lượng' },

  // Code Book
  codebookTitle: { en: 'Code Book', vi: 'Sổ Mã Quan Sát' },
  codebookDesc: {
    en: 'Synthesized qualitative observation codes grounded in actual video evidence with AI-analyzed inclusion/exclusion criteria. Export all codebooks as a multi-sheet Excel file.',
    vi: 'Bộ mã quan sát định tính chuẩn hóa tổng hợp từ bằng chứng thực tế trong video với tiêu chí bao gồm/loại trừ được phân tích bởi AI. Xuất toàn bộ codebook thành file Excel đa-sheet.'
  },
  codebookExportExcel: { en: 'Export All as Excel', vi: 'Xuất Tất Cả Ra Excel' },
  codebookExporting: { en: 'Exporting...', vi: 'Đang Xuất...' },
  codebookAddEntry: { en: 'Add Code', vi: 'Thêm Mã' },
  codebookSave: { en: 'Save Codebook', vi: 'Lưu Codebook' },
  codebookSaving: { en: 'Saving...', vi: 'Đang Lưu...' },
  codebookRegenerate: { en: 'Regenerate with AI', vi: 'Phân Tích Lại Bằng AI' },
  codebookRegenerating: { en: 'Analyzing with AI...', vi: 'AI Đang Phân Tích...' },
  codebookSearchPlaceholder: { en: 'Search codes, definitions, examples, categories...', vi: 'Tìm kiếm mã, định nghĩa, ví dụ, danh mục...' },
  codebookGeneratedSuccess: { en: 'Codebook generated successfully with AI!', vi: 'Đã sinh sổ mã thành công bằng AI!' },
  codebookAutoGeneratedBadge: { en: 'AI & Video Synthesized', vi: 'Tổng Hợp Từ Video & AI' },
  codebookNoVideos: { en: 'No completed video reports found.', vi: 'Không tìm thấy video đã hoàn tất báo cáo.' },
  codebookNoEntries: { en: 'No codes found for this video.', vi: 'Chưa có mã nào cho video này.' },
  codebookNoEntriesDesc: { en: 'Click "Generate with AI" to analyze and extract observation codes from this lesson.', vi: 'Nhấn "Sinh Mã Bằng AI" để phân tích và trích xuất bộ mã từ bài giảng này.' },
  codebookGenerateNow: { en: 'Generate with AI', vi: 'Sinh Mã Bằng AI Ngay' },
  codebookColCode: { en: 'Code', vi: 'Mã' },
  codebookColDefinition: { en: 'Definition', vi: 'Định Nghĩa' },
  codebookColInclusion: { en: 'Inclusion Criteria', vi: 'Tiêu Chí Bao Gồm' },
  codebookColExclusion: { en: 'Exclusion Criteria', vi: 'Tiêu Chí Loại Trừ' },
  codebookColExample: { en: 'Example & Evidence', vi: 'Ví Dụ & Dẫn Chứng' },
  codebookColCategory: { en: 'Category', vi: 'Danh Mục' },
  codebookColTheme: { en: 'Theme', vi: 'Chủ Đề' },
  codebookEntriesCount: { en: 'observation codes', vi: 'mã quan sát' },

  // Teaching Themes & Strategies
  themesTitle: { en: 'Teaching Themes & Strategies', vi: 'Chiến Lược Giảng Dạy & Chủ Đề' },
  themesDesc: {
    en: 'Qualitative synthesis of recurring teaching patterns and strategies across all recorded lessons, supported by video evidence.',
    vi: 'Tổng hợp định tính các chiến lược và mô thức giảng dạy lặp lại trên toàn bộ bài giảng, kèm dẫn chứng video.'
  },
  themesBadge: { en: 'Teaching Strategies', vi: 'Chiến Lược Giảng Dạy' },
  themesListTitle: { en: 'Identified Teaching Themes', vi: 'Các Chủ Đề Chiến Lược Nhận Diện' },
  themesMergeBtn: { en: 'Merge Themes', vi: 'Gộp Chủ Đề' },
  themesMergeFrom: { en: 'Merge from:', vi: 'Gộp từ chủ đề:' },
  themesMergeInto: { en: 'into target:', vi: 'vào chủ đề đích:' },
  themesSelectSource: { en: 'Select source theme...', vi: 'Chọn chủ đề nguồn...' },
  themesSelectTarget: { en: 'Select target theme...', vi: 'Chọn chủ đề đích...' },
  themesConfirmMerge: { en: 'Confirm Merge', vi: 'Xác Nhận Gộp' },
  themesConfirmedStatus: { en: 'Confirmed', vi: 'Đã Xác Nhận' },
  themesDraftStatus: { en: 'Draft', vi: 'Bản Nháp' },
  themesConfirmThemeBtn: { en: 'Confirm Theme', vi: 'Xác Nhận Chủ Đề' },
  runPhase6: { en: 'Analyze All 24 Lessons', vi: 'Tổng Hợp Tất Cả 24 Bài Giảng' },
  reasoningTrace: { en: 'Evidence & Explanation', vi: 'Dẫn Chứng & Giải Thích' },

  themesEmptyTitle: { en: 'No Teaching Themes Data Yet', vi: 'Chưa có dữ liệu Teaching Themes' },
  themesEmptyDesc: {
    en: 'Click "Analyze All 24 Lessons" to synthesize Grounded Theory themes from all completed lesson reports.',
    vi: 'Hãy nhấn nút "Analyze All 24 Lessons" để khởi chạy phân tích Grounded Theory tổng hợp từ các bài giảng đã hoàn thành.'
  },

  // Versioning & Runs History
  runHistoryTitle: { en: 'Analysis Runs History & Versioning', vi: 'Lịch Sử Các Đợt Phân Tích & Quản Lý Phiên' },
  runHistorySubtitle: { en: 'Review and select past analysis runs, inspect qualitative themes discovered in each session.', vi: 'Xem lại và chọn các đợt phân tích trước, đối chiếu các chủ đề sư phạm phát hiện được trong từng phiên.' },
  runHistoryBtn: { en: 'Runs History', vi: 'Lịch Sử Các Phiên' },
  viewThisRun: { en: 'View This Run', vi: 'Xem Phiên Này' },
  viewingRun: { en: 'Viewing', vi: 'Đang Xem' },
  activeRunLabel: { en: 'Active Run', vi: 'Phiên Đang Xem' },
  latestRunLabel: { en: 'Latest', vi: 'Mới nhất' },
  themesFoundCount: { en: 'Themes', vi: 'Số Themes' },
  categoriesFoundCount: { en: 'Categories', vi: 'Số Cụm' },
  strategiesFoundCount: { en: 'Strategies', vi: 'Chiến Lược' },
  runDuration: { en: 'Duration', vi: 'Thời Lượng' },
  runTriggeredAt: { en: 'Triggered At', vi: 'Thời Gian Bắt Đầu' },
  runActions: { en: 'Actions', vi: 'Thao Tác' },
  totalRunsCount: { en: 'Total Runs', vi: 'Tổng Số Phiên' },

  // Stepper Status Labels
  stepStatusDone: { en: '✓ Done', vi: '✓ Hoàn thành' },
  stepStatusFailed: { en: '✕ Failed', vi: '✕ Thất bại' },
  stepStatusCancelled: { en: '⊘ Cancelled', vi: '⊘ Đã hủy' },
  stepStatusSkipped: { en: '- Skipped', vi: '- Bỏ qua' },
  stepStatusInProgress: { en: 'In Progress', vi: 'Đang xử lý' },

  // Video Pipeline Status & Resume
  statusReviewPending: { en: 'Review Pending', vi: 'Chờ Duyệt' },
  statusMapped: { en: 'Checklist Mapped', vi: 'Đã Khớp Tiêu Chí' },
  statusCancelled: { en: 'Cancelled', vi: 'Đã Hủy' },
  resumeFromStep: { en: 'Resume from', vi: 'Tiếp tục từ' },
  rerunFromStart: { en: 'Restart from Beginning', vi: 'Chạy lại từ đầu' },
  restartAll: { en: 'Restart All', vi: 'Khởi Động Lại Tất Cả' },
  analysisHaltedAt: { en: 'Analysis halted at', vi: 'Phân tích bị dừng tại' },
  analysisStoppedByUserDesc: {
    en: 'You stopped the pipeline. Completed steps remain cached — you can resume without spending extra tokens.',
    vi: 'Bạn đã dừng pipeline. Các bước đã hoàn thành vẫn được lưu — bạn có thể tiếp tục từ chỗ dừng mà không tốn thêm token.'
  },
  smartResumeBadge: {
    en: 'Smart Resume: continue from checkpoint without restarting from scratch.',
    vi: 'Smart Resume: tiếp tục từ checkpoint, không phải chạy lại từ đầu.'
  },
  rerunModeChanged: {
    en: 'Analysis mode changed — restarting clean from Step 1',
    vi: 'Chế độ phân tích đã thay đổi — phân tích lại sạch từ Bước 1'
  },

  // Interview Studio
  interviewTitle: { en: 'Teacher Interview Guide', vi: 'Bộ Câu Hỏi Phỏng Vấn Giáo Viên' },
  interviewDesc: {
    en: 'Semi-structured interview questions and follow-ups generated from observed video moments to explore teachers\' instructional choices.',
    vi: 'Bộ câu hỏi phỏng vấn bán cấu trúc và câu hỏi đào sâu sinh từ các khoảnh khắc video thực tế để tìm hiểu ý đồ sư phạm của giáo viên.'
  },
  interviewSubtitle: {
    en: 'Semi-structured interview design: Synthesize Core Questions from 22 baseline questions and generate evidence-grounded follow-up inquiry for each teacher.',
    vi: 'Thiết kế phỏng vấn bán cấu trúc: Tổng hợp Core Questions từ 22 câu gốc và sinh câu hỏi Follow-up sâu theo mốc thời gian & tương tác của từng GV.'
  },
  interviewBadge: { en: 'Evidence-based', vi: 'Dựa Trên Dẫn Chứng' },
  interviewTabStudio: { en: 'Interview Studio (12 Teachers)', vi: 'Phòng Phỏng Vấn (12 GV)' },
  interviewTabBank: { en: '22 Baseline Questions Bank', vi: 'Ngân Hàng 22 Câu Hỏi Gốc' },
  interviewFlowABadgeDraft: { en: 'Flow A: Core Questions Proposal (Draft)', vi: 'Luồng A: Đề Xuất Core Questions (Dự Thảo)' },
  interviewFlowABadgeApproved: { en: 'Core Questions: Approved', vi: 'Core Questions: Đã Phê Duyệt' },
  interviewFlowASub: { en: 'Synthesized from 22 canonical questions & Teaching Themes', vi: 'Tổng hợp từ 22 câu hỏi gốc & Teaching Themes' },
  interviewFlowAApprovedDesc: {
    en: 'Core questions have been approved and synchronized across all 12 teachers.',
    vi: 'Bộ Core Questions đã được phê duyệt và áp dụng đồng bộ cho 12 giáo viên.'
  },
  interviewFlowADraftDesc: {
    en: 'Core question proposals are currently in draft. You can review, modify, and click Approve.',
    vi: 'Đề xuất Core Questions đang ở dạng dự thảo. Bạn có thể xem xét, chỉnh sửa và bấm Approve.'
  },
  interviewFlowARQNote: {
    en: 'This core set addresses all 3 Research Questions (RQ1: Strategies, RQ2: Perceptions, RQ3: Challenges & Solutions).',
    vi: 'Bộ câu hỏi cốt lõi này trả lời đầy đủ 3 Research Questions (RQ1: Chiến thuật, RQ2: Cảm nhận, RQ3: Thách thức & giải pháp).'
  },
  interviewEditCoreBtn: { en: 'Review & Edit Core Questions', vi: 'Xem & Chỉnh Sửa Core Questions' },
  interviewResynthesizeBtn: { en: 'AI Re-synthesize', vi: 'AI Tổng Hợp Lại' },
  interviewApproveBtn: { en: 'Approve & Synchronize', vi: 'Phê Duyệt & Đồng Bộ' },
  interviewUnapproveBtn: { en: 'Unlock to Edit (Revert to Draft)', vi: 'Mở Khóa Duyệt (Quay Lại Nháp)' },
  interviewToastUnapproveSuccess: { en: 'Core questions unlocked and reverted to Draft.', vi: 'Đã mở khóa duyệt. Bộ câu hỏi chuyển về trạng thái Dự thảo để chỉnh sửa.' },
  interviewToastUnapproveError: { en: 'Failed to unlock core questions.', vi: 'Không thể mở khóa duyệt bộ câu hỏi.' },
  interviewThemeVersionTitle: { en: 'Linked Teaching Theme Version', vi: 'Phiên Phân Tích Chủ Đề Liên Kết' },
  interviewThemeVersionBadge: { en: 'Theme Linked View', vi: 'Xem Theo Phiên Kích Hoạt' },
  interviewThemeVersionNote: { en: 'Interview Studio is locked to this active theme run. To switch versions, please select a different run in Teaching Themes.', vi: 'Interview Studio tự động khóa hiển thị theo phiên chủ đề đang kích hoạt này. Để đổi phiên, vui lòng chuyển tại mục Teaching Themes.' },
  interviewThemeGoToThemes: { en: 'Manage in Teaching Themes', vi: 'Quản Lý Tại Teaching Themes' },
  interviewApproveConfirmTitle: { en: 'Confirm Core Questions Approval', vi: 'Xác Nhận Phê Duyệt Bộ Câu Hỏi Cốt Lõi' },
  interviewApproveConfirmDesc: { en: 'Approving locks these core questions as the standardized research foundation across all 12 teachers while strictly preserving all participant-specific dynamic follow-up questions.', vi: 'Phê duyệt sẽ chốt bộ câu hỏi cốt lõi làm khung nghiên cứu chuẩn hóa cho cả 12 giáo viên và bảo lưu nguyên vẹn toàn bộ câu hỏi đào sâu hiện có.' },
  interviewApproveConfirmPoint1: { en: 'Standardizes common RQ1–RQ3 core inquiry for all 12 teachers.', vi: 'Chuẩn hóa bộ câu hỏi chung RQ1–RQ3 cho toàn bộ 12 giáo viên.' },
  interviewApproveConfirmPoint2: { en: 'All personalized video-evidence questions remain 100% preserved.', vi: 'Bảo lưu nguyên vẹn 100% các câu hỏi đào sâu theo bằng chứng video của từng giáo viên.' },
  interviewApproveConfirmPoint3: { en: 'You can unlock to edit (Unapprove) at any time without data loss.', vi: 'Bạn có thể mở khóa để chỉnh sửa lại bất cứ lúc nào mà không lo mất dữ liệu.' },
  interviewApproveConfirmSubmit: { en: 'Confirm & Synchronize', vi: 'Xác Nhận & Đồng Bộ' },
  interviewApproveConfirmCancel: { en: 'Cancel', vi: 'Hủy' },
  interviewApproveNoticeTitle: { en: 'Approval Workflow & Data Safety Guide', vi: 'Chú Thích Cơ Chế Phê Duyệt & Bảo Toàn Dữ Liệu' },
  interviewApproveNoticeDraftP1: {
    en: 'Standardized Core Baseline: These core questions provide the uniform framework across all 12 teachers to answer RQ1, RQ2, and RQ3.',
    vi: 'Khung cốt lõi chuẩn hóa: Bộ câu hỏi này là khung chuẩn chung hỏi cả 12 giáo viên để trả lời đầy đủ RQ1, RQ2 và RQ3.'
  },
  interviewApproveNoticeDraftP2: {
    en: 'Safe Synchronization: Clicking "Approve & Synchronize" locks this core set and synchronizes it to all teachers without touching or wiping out any participant-specific follow-up questions.',
    vi: 'Đồng bộ an toàn: Nhấn "Phê Duyệt & Đồng Bộ" sẽ chốt khung và đồng bộ cho cả 12 giáo viên mà không xóa hoặc ảnh hưởng đến bất kỳ câu hỏi đào sâu video nào.'
  },
  interviewApproveNoticeDraftP3: {
    en: 'Reversible Anytime: You can click "Unlock to Edit (Unapprove)" at any point to return to Draft mode and adjust questions freely.',
    vi: 'Hoàn tác bất cứ lúc nào: Bạn có thể nhấn "Mở khóa duyệt (Quay lại nháp)" bất cứ lúc nào để chỉnh sửa lại mà không mất dữ liệu.'
  },
  interviewApproveNoticeApprovedP1: {
    en: 'Locked & Synchronized: This core question set is officially approved and locked across all 12 teacher interview guides.',
    vi: 'Đã khóa & Đồng bộ: Bộ câu hỏi cốt lõi đã được phê duyệt chính thức và áp dụng đồng bộ trên phiếu phỏng vấn của cả 12 giáo viên.'
  },
  interviewApproveNoticeApprovedP2: {
    en: 'Individual Evidence Ready: Participant-specific follow-up questions below are fully intact and ready for fieldwork interviewing and Word (.docx) export.',
    vi: 'Bằng chứng sẵn sàng: Toàn bộ câu hỏi đào sâu riêng biệt bên dưới được bảo lưu nguyên vẹn, sẵn sàng để phỏng vấn thực địa và xuất file Word.'
  },
  interviewApproveNoticeApprovedP3: {
    en: 'Need modifications? Click "Unlock to Edit (Revert to Draft)" above to unlock editing without data loss.',
    vi: 'Cần sửa đổi? Nhấn nút "Mở Khóa Duyệt (Quay Lại Nháp)" ở trên để mở khóa chỉnh sửa mà không lo mất dữ liệu.'
  },
  interviewModalApproveHint: {
    en: 'Saving & Approving will lock these core questions across all 12 teachers while strictly preserving all video-evidence dynamic questions. You can unlock to edit at any time.',
    vi: 'Lưu & Phê duyệt sẽ chốt bộ câu hỏi cốt lõi cho 12 giáo viên và bảo lưu nguyên vẹn toàn bộ câu hỏi đào sâu theo video. Bạn có thể mở khóa duyệt lại bất cứ lúc nào.'
  },
  interviewHubCoreTitle: { en: 'Core Protocol (RQ1–RQ3)', vi: 'Đề Cương Cốt Lõi (RQ1–RQ3)' },
  interviewHubCoreSub: { en: 'Standardized baseline inquiry for all 12 teachers', vi: 'Bộ câu hỏi chuẩn áp dụng chung cho tất cả 12 giáo viên' },
  interviewHubPillar1: { en: '8 Standardized RQ1–RQ3 Questions for 12 Teachers', vi: '8 câu hỏi cốt lõi (RQ1–RQ3) chuẩn hóa đồng bộ cho 12 GV' },
  interviewHubPillar2: { en: '100% Video Evidence & Dynamic Follow-ups Safely Preserved', vi: 'Bảo toàn 100% video evidence & câu hỏi đào sâu riêng biệt' },
  interviewHubPillar3: { en: 'Fully Reversible: Unlock back to Draft anytime without data loss', vi: 'Mở khóa duyệt quay lại bản nháp bất cứ lúc nào' },
  interviewLoadingTeacher: { en: 'Loading interview data for teacher', vi: 'Đang tải dữ liệu phỏng vấn của giáo viên' },
  interviewCoreColTitle: { en: 'Core Questions (All 12 Teachers)', vi: 'Core Questions (Chung cho 12 GV)' },
  interviewCoreColDesc: {
    en: 'Baseline inquiry synthesized from the 22 semi-structured questions, aligned with RQ1, RQ2, and RQ3.',
    vi: 'Bộ câu hỏi cốt lõi tổng hợp từ 22 câu hỏi bán cấu trúc gốc, bám sát RQ1, RQ2 và RQ3.'
  },
  interviewDynamicColTitle: { en: 'Participant-Specific Follow-Up Questions', vi: 'Câu Hỏi Phỏng Vấn Sâu Riêng Biệt' },
  interviewDynamicColDesc: {
    en: 'Generated directly from the Chronological Interaction Log (dialogues & behaviors), mapped to RQ1–RQ3 and citing video timestamps.',
    vi: 'Sinh trực tiếp từ Chronological Interaction Log (lời thoại & hành vi), bắt buộc gắn nhãn RQ1–RQ3 và trích dẫn bằng chứng mốc thời gian.'
  },
  interviewDynamicEmpty: {
    en: 'No specific follow-up questions generated yet for this teacher. Click "Approve & Generate Guides" in the banner above.',
    vi: 'Chưa có câu hỏi đào sâu riêng biệt cho giáo viên này. Nhấn "Approve & Generate Guides" ở banner trên để sinh câu hỏi.'
  },
  interviewExportWord: { en: 'Word', vi: 'Word' },
  interviewExportSingleTeacher: { en: 'Word ({teacher})', vi: 'Word ({teacher})' },
  interviewExportingWord: { en: 'Word...', vi: 'Đang xuất...' },
  interviewExportWordSuccess: { en: 'Successfully exported interview guide for {teacher} to Word (.docx)!', vi: 'Đã xuất phiếu phỏng vấn {teacher} ra file Word (.docx) thành công!' },
  interviewExportPdf: { en: 'PDF', vi: 'PDF' },
  interviewExportSingleTeacherPdf: { en: 'PDF ({teacher})', vi: 'PDF ({teacher})' },
  interviewExportingPdf: { en: 'PDF...', vi: 'Đang xuất...' },
  interviewExportPdfSuccess: { en: 'Successfully exported interview guide for {teacher} to PDF (.pdf)!', vi: 'Đã xuất phiếu phỏng vấn {teacher} ra file PDF (.pdf) thành công!' },
  interviewExportAllWord: { en: 'ZIP Word', vi: 'ZIP Word' },
  interviewExportAllTeachers: { en: 'ZIP Word ({count})', vi: 'ZIP Word ({count})' },
  interviewExportingAllWord: { en: 'ZIP ({current}/{total})...', vi: 'ZIP ({current}/{total})...' },
  interviewExportAllSuccess: { en: 'Successfully exported separate Word files for all {count} teachers into ZIP archive!', vi: 'Đã xuất thành công toàn bộ {count} phiếu phỏng vấn GV thành các file Word riêng biệt trong tệp ZIP!' },
  interviewExportAllPdf: { en: 'ZIP PDF', vi: 'ZIP PDF' },
  interviewExportAllTeachersPdf: { en: 'ZIP PDF ({count})', vi: 'ZIP PDF ({count})' },
  interviewExportingAllPdf: { en: 'ZIP ({current}/{total})...', vi: 'ZIP ({current}/{total})...' },
  interviewExportAllSuccessPdf: { en: 'Successfully exported separate PDF files for all {count} teachers into ZIP archive!', vi: 'Đã xuất thành công toàn bộ {count} phiếu phỏng vấn GV thành các file PDF riêng biệt trong tệp ZIP!' },
  interviewExportAllError: { en: 'Error exporting files: ', vi: 'Lỗi khi xuất tệp: ' },
  interviewExportWordTooltip: { en: 'Export interview guide for selected teacher ({teacher}) to Microsoft Word (.docx)', vi: 'Xuất phiếu phỏng vấn riêng cho giáo viên đang chọn ({teacher}) ra file Word (.docx)' },
  interviewExportPdfTooltip: { en: 'Export interview guide for selected teacher ({teacher}) to Adobe PDF (.pdf)', vi: 'Xuất phiếu phỏng vấn riêng cho giáo viên đang chọn ({teacher}) ra file PDF (.pdf)' },
  interviewExportAllTooltip: { en: 'Export separate Word (.docx) files for all {count} teachers (packaged in .zip)', vi: 'Xuất các file Word (.docx) độc lập cho toàn bộ {count} giáo viên (đóng gói trong tệp .zip)' },
  interviewExportAllPdfTooltip: { en: 'Export separate PDF (.pdf) files for all {count} teachers (packaged in .zip)', vi: 'Xuất các file PDF (.pdf) độc lập cho toàn bộ {count} giáo viên (đóng gói trong tệp .zip)' },
  interviewNarrativeTitle: { en: 'Pedagogical Narrative Synthesis', vi: 'Hồ Sơ & Tổng Hợp Sư Phạm' },
  interviewNarrativeSubtitle: {
    en: 'Qualitative synthesis of instructional style, pacing, and communicative patterns',
    vi: 'Tổng hợp định tính về phong cách sư phạm, nhịp độ và mô thức tương tác giao tiếp',
  },
  interviewNarrativeVisualTab: { en: 'Visual Bento', vi: 'Trực Quan' },
  interviewNarrativeFullTab: { en: 'Academic (.MD)', vi: 'Báo Cáo (.MD)' },
  interviewNarrativeCopyMd: { en: 'Copy Markdown', vi: 'Sao Chép Markdown' },
  interviewNarrativeCopied: { en: 'Copied to clipboard', vi: 'Đã sao chép Markdown vào bộ nhớ tạm' },
  interviewNarrativeCollapse: { en: 'Collapse', vi: 'Thu gọn' },
  interviewNarrativeExpand: { en: 'Expand', vi: 'Mở rộng' },
  interviewNarrativeWaitTime: { en: 'Wait Time Interval', vi: 'Khoảng Lặng Chờ Đợi' },
  interviewNarrativeTotalEvents: { en: 'Strategy Events', vi: 'Sự Kiện Chiến Thuật' },
  interviewNarrativeTimingDistribution: { en: 'Timing Distribution', vi: 'Phân Bổ Nhịp Độ' },
  interviewNarrativeTheme: { en: 'Grounded Theme', vi: 'Chủ Đề Quy Nạp' },
  interviewNarrativeOverviewTitle: { en: 'Instructional Style & Pedagogical Overview', vi: 'Tổng Quan Phong Cách Giảng Dạy' },
  interviewNarrativeStrategiesTitle: { en: 'Key Recurring Strategies & Empirical Evidence', vi: 'Chiến Thuật Cốt Lõi & Bằng Chứng Thực Nghiệm' },
  interviewQuestionsCount: { en: 'questions', vi: 'câu' },
  interviewFollowupsCount: { en: 'in-depth follow-up questions', vi: 'câu hỏi đào sâu' },
  interviewBankTitle: { en: '22 Semi-Structured Baseline Questions Bank', vi: 'Ngân Hàng 22 Câu Hỏi Bán Cấu Trúc Gốc' },
  interviewBankDesc: {
    en: 'Methodological framework for interviewing primary EFL online speaking teachers.',
    vi: 'Căn cứ phương pháp luận thiết kế câu hỏi phỏng vấn giáo viên tiểu học dạy tiếng Anh trực tuyến (Primary EFL).'
  },
  interviewResetDefaultsBtn: { en: 'Reset to 22 Default Baseline Questions', vi: 'Reset về 22 Câu Gốc Mặc Định' },
  interviewAddQuestionBtn: { en: '+ Add New Question', vi: '+ Thêm Câu Hỏi Mới' },
  interviewFilterByRQ: { en: 'Filter by RQ:', vi: 'Lọc theo RQ:' },
  interviewFilterAll: { en: 'All', vi: 'Tất cả' },
  interviewLoadingBank: { en: 'Loading baseline questions bank...', vi: 'Đang tải danh sách câu hỏi gốc...' },
  interviewModalEditCoreTitle: { en: 'Edit Core Questions Set (Flow A)', vi: 'Chỉnh Sửa Bộ Core Questions (Flow A)' },
  interviewModalEditCoreDesc: {
    en: 'You can directly edit question wording or change RQ classifications before approving.',
    vi: 'Bạn có thể trực tiếp sửa nội dung từng câu hỏi hoặc thay đổi phân loại RQ1, RQ2, RQ3 trước khi Approve.'
  },
  interviewModalQuestionNumber: { en: 'Question #', vi: 'Câu #' },
  interviewModalApproveSaveBtn: { en: 'Save & Approve Question Set', vi: 'Lưu & Phê Duyệt Bộ Câu Hỏi' },
  interviewModalAddBaseTitle: { en: 'Add Baseline Semi-Structured Question', vi: 'Thêm Câu Hỏi Bán Cấu Trúc Gốc' },
  interviewModalEditBaseTitle: { en: 'Edit Baseline Question', vi: 'Sửa Câu Hỏi Gốc' },
  interviewModalEditDynamicTitle: { en: 'Edit In-Depth Follow-up Question', vi: 'Sửa Câu Hỏi Phỏng Vấn Sâu' },
  interviewFormFieldText: { en: 'Question Content', vi: 'Nội Dung Câu Hỏi' },
  interviewFormPlaceholder: { en: 'Enter interview question in English...', vi: 'Nhập câu hỏi phỏng vấn bằng tiếng Anh...' },
  interviewFormFieldRQ: { en: 'Research Question (RQ Category)', vi: 'Gắn Thẻ Research Question (RQ)' },
  interviewFormFieldIndex: { en: 'Sort Order (Index)', vi: 'Thứ Tự (Index)' },
  interviewFormFieldSection: { en: 'Section Identifier', vi: 'Phân Mục (Section)' },
  interviewBtnAddToBank: { en: 'Add to Question Bank', vi: 'Thêm Vào Ngân Hàng' },
  interviewToastRunPhase6First: {
    en: 'Please run Phase 6 thematic analysis before generating Core Questions.',
    vi: 'Vui lòng chạy phân tích Phase 6 trước khi sinh Core Questions.'
  },
  interviewToastSynthesizeSuccess: {
    en: 'Successfully synthesized Core Questions from 22 baseline questions and themes!',
    vi: 'Đã tổng hợp thành công đề xuất Core Questions từ 22 câu gốc và Themes!'
  },
  interviewToastSynthesizeError: { en: 'Failed to synthesize Core Questions', vi: 'Lỗi khi sinh Core Questions' },
  interviewToastApproveSuccess: {
    en: 'Core Questions approved! Personalized follow-up questions generated for all 12 teachers.',
    vi: 'Đã phê duyệt Core Questions và tự động sinh câu hỏi sâu cho 12 giáo viên!'
  },
  interviewToastApproveError: { en: 'Failed to approve Core Questions', vi: 'Lỗi khi phê duyệt Core Questions' },
  interviewToastUpdateSuccess: { en: 'Interview question updated successfully.', vi: 'Đã cập nhật câu hỏi phỏng vấn.' },
  interviewToastUpdateError: { en: 'Failed to update interview question', vi: 'Lỗi khi cập nhật câu hỏi' },
  interviewConfirmReset: {
    en: 'Are you sure you want to reset the question bank back to the 22 default semi-structured questions?',
    vi: 'Bạn có chắc chắn muốn reset ngân hàng câu hỏi về 22 câu hỏi bán cấu trúc gốc không?'
  },
  interviewToastResetSuccess: {
    en: 'Question bank reset to the 22 canonical baseline questions!',
    vi: 'Đã reset ngân hàng về 22 câu hỏi bán cấu trúc chuẩn!'
  },
  interviewToastResetError: { en: 'Failed to reset questions', vi: 'Lỗi khi reset câu hỏi' },
  interviewToastEnterText: { en: 'Please enter question content.', vi: 'Vui lòng nhập nội dung câu hỏi.' },
  interviewToastCreateSuccess: { en: 'New question added to bank successfully.', vi: 'Đã thêm câu hỏi mới vào ngân hàng.' },
  interviewToastCreateError: { en: 'Failed to add new question', vi: 'Lỗi khi thêm câu hỏi mới' },
  interviewToastUpdateBaseSuccess: { en: 'Baseline question updated successfully.', vi: 'Đã cập nhật câu hỏi gốc.' },
  interviewConfirmDelete: {
    en: 'Are you sure you want to delete this question from the bank?',
    vi: 'Bạn có chắc chắn muốn xóa câu hỏi này khỏi ngân hàng không?'
  },
  interviewToastDeleteSuccess: { en: 'Question deleted from bank.', vi: 'Đã xóa câu hỏi khỏi ngân hàng.' },
  interviewToastDeleteError: { en: 'Failed to delete question', vi: 'Lỗi khi xóa câu hỏi' },
  interviewToastCopied: { en: 'Copied interview guide for', vi: 'Đã copy nội dung phỏng vấn của' },
  coreQuestions: { en: 'Core Questions (All Teachers)', vi: 'Câu Hỏi Chung (Tất Cả Giáo Viên)' },
  coreQuestionsSub: {
    en: 'Core baseline questions asked to all teachers in the observation study.',
    vi: 'Các câu hỏi phỏng vấn nền tảng áp dụng chung cho tất cả giáo viên trong nghiên cứu.'
  },
  dynamicQuestions: { en: 'Follow-up Questions (Based on Video Evidence)', vi: 'Câu Hỏi Chi Tiết (Dựa Trên Dẫn Chứng Video)' },
  dynamicQuestionsSub: {
    en: 'Specific questions referencing exact video timestamps and observed teaching behaviors for',
    vi: 'Các câu hỏi chuyên biệt dẫn chiếu mốc thời gian và hành vi giảng dạy cụ thể của'
  },
  exportMarkdown: { en: 'Export Markdown (.md)', vi: 'Xuất File Markdown (.md)' },
  printPDF: { en: 'Print / Export PDF', vi: 'In / Xuất File PDF' },
  videoEvidenceTag: { en: 'Video Evidence', vi: 'Dẫn Chứng Video' },

  // Activity Center
  actCenterTitle: { en: 'Analysis Activity & Notifications', vi: 'Hoạt Động Xử Lý & Thông Báo' },
  actAllClear: { en: 'All Analyses Clear', vi: 'Tất Cả Đã Xử Lý Xong' },
  actAllClearSub: { en: 'No active errors or pending background jobs.', vi: 'Không có lỗi hoặc tác vụ nền nào đang chờ.' },
  actAutoUpdating: { en: 'Auto-updating', vi: 'Tự động cập nhật' },
  actAllVideos: { en: 'All Videos →', vi: 'Tất Cả Video →' },

  // Authentication
  authSignIn: { en: 'Sign In', vi: 'Đăng Nhập' },
  authSignUp: { en: 'Create Account', vi: 'Tạo Tài Khoản' },
  authSignOut: { en: 'Sign Out', vi: 'Đăng Xuất' },
  authPortalTitle: { en: 'Researcher Sign In', vi: 'Đăng Nhập Nhà Nghiên Cứu' },
  authPortalSubtitle: { en: 'Classroom Video Observation & Teaching Strategy Lab', vi: 'Phòng Phân Tích Video Giảng Dạy & Chiến Lược Sư Phạm' },
  authUsername: { en: 'Username', vi: 'Tên Đăng Nhập' },
  authEmail: { en: 'Academic Email', vi: 'Email Học Thuật' },
  authPassword: { en: 'Password', vi: 'Mật Khẩu' },
  authSigningIn: { en: 'Signing in...', vi: 'Đang đăng nhập...' },
  authSigningUp: { en: 'Creating account...', vi: 'Đang tạo tài khoản...' },
  authSuccessLogin: { en: 'Signed in successfully. Opening workspace...', vi: 'Đăng nhập thành công. Đang mở không gian làm việc...' },
  authSuccessRegister: { en: 'Account created successfully. Redirecting...', vi: 'Tạo tài khoản thành công. Đang chuyển hướng...' },
  authQuickDemo: { en: 'Fill Demo Account', vi: 'Điền Tài Khoản Mẫu' },
  authRoleLab: { en: 'Researcher', vi: 'Nhà Nghiên Cứu' },
  authNotSignedIn: { en: 'Not Signed In', vi: 'Chưa Đăng Nhập' },

  // Feature Workflow & Automation Guidance
  wfStepPrefix: { en: 'Step', vi: 'Bước' },
  wfRunsAfterLabel: { en: 'Runs after:', vi: 'Chạy sau:' },
  wfOperationalGuide: { en: 'Operational Guide & Mechanism:', vi: 'Hướng dẫn thao tác & Cơ chế:' },
  wfAutoRunsBadge: { en: 'Auto-runs after video analysis', vi: 'Tự động chạy sau phân tích video' },
  wfManualBadge: { en: 'Manual / On-demand trigger', vi: 'Khởi chạy thủ công theo yêu cầu' },
  wfReferenceBadge: { en: 'Foundational rubric (Auto-referenced)', vi: 'Khung tiêu chí mẫu (Tham chiếu tự động)' },
  wfSemiAutoBadge: { en: 'Semi-automated (Auto evidence sync)', vi: 'Bán tự động (Tự đồng bộ dẫn chứng)' },

  wfVideosStep: { en: 'Step 1 / 5: Central Data Hub', vi: 'Bước 1 / 5: Trung Tâm Dữ Liệu' },
  wfVideosRunsAfter: { en: 'Starts upon video ingestion', vi: 'Khởi đầu ngay khi tải video lên hệ thống' },
  wfVideosAutoText: { en: 'Auto-runs AI pipeline on upload', vi: 'Tự động chạy pipeline khi có video mới' },
  wfVideosDesc: { en: 'When videos are uploaded, the multimodal AI pipeline triggers automatically (Chunking ➔ Event Extraction ➔ Rubric Mapping ➔ Report). Track live progress or re-run anytime.', vi: 'Khi tải video lên, hệ thống tự động khởi chạy chuỗi xử lý AI (Chunking ➔ Trích xuất sự kiện ➔ Ánh xạ tiêu chí ➔ Tạo báo cáo). Bạn có thể theo dõi tiến độ thời gian thực hoặc bấm chạy lại từng video.' },

  wfUploadStep: { en: 'Step 1.0: Ingestion Setup', vi: 'Bước 1.0: Nạp Dữ Liệu Video' },
  wfUploadRunsAfter: { en: 'Initial step (Prepare MP4 lesson files)', vi: 'Bước khởi đầu quy trình (Chuẩn bị tệp MP4 bài giảng)' },
  wfUploadAutoText: { en: 'Auto-triggers analysis right after upload', vi: 'Tự động bắt đầu phân tích sau khi tải xong' },
  wfUploadDesc: { en: 'As soon as the MP4 video is uploaded, real-time multimodal analysis starts automatically. Enable Auto-Chunking for 5-minute parallel processing to prevent timeouts.', vi: 'Ngay sau khi tệp video MP4 tải lên hoàn tất, hệ thống tự động kích hoạt tiến trình phân tích trực tiếp. Bật "Auto-Chunking" để chia nhỏ video 5 phút giúp tối ưu tốc độ và không bị gián đoạn.' },

  wfChecklistsStep: { en: 'Foundation: Observation Framework', vi: 'Bước Nền Tảng: Khung Tiêu Chí Quan Sát' },
  wfChecklistsRunsAfter: { en: 'Pre-configured before video analysis', vi: 'Thiết lập ban đầu (Trước khi phân tích video)' },
  wfChecklistsAutoText: { en: 'Auto-referenced by AI during analysis', vi: 'Được AI tham chiếu tự động khi phân tích' },
  wfChecklistsDesc: { en: 'Standard 5-section rubric (A-E). AI models automatically load these criteria during Step 3 (Mapping) to score pedagogical events. Criteria can be customized anytime.', vi: 'Khung tiêu chí chuẩn 5 phần (A: Giàn giáo, B: Đặt câu hỏi, C: Khen ngợi, D: Công cụ số, E: Học sinh tự chủ). Mô hình AI tự động đọc bảng kiểm này trong bước Mapping để đối soát và đánh giá từng sự kiện video.' },

  wfCodebookStep: { en: 'Step 2 / 5: Qualitative Coding', vi: 'Bước 2 / 5: Mã Hóa Định Tính' },
  wfCodebookRunsAfter: { en: 'Runs after Video Analysis completes (report_generated)', vi: 'Chạy sau khi Video phân tích xong (Step: report_generated)' },
  wfCodebookAutoText: { en: 'Auto-generates codes upon video completion', vi: 'Tự động tạo mã sau khi video hoàn tất phân tích' },
  wfCodebookDesc: { en: 'Automatically extracts pedagogical codebook (Definitions, Inclusion/Exclusion criteria, Grounded quotes) from completed videos. Export single or combined research reports.', vi: 'Tính năng này trích xuất tự động bảng mã sư phạm (Định nghĩa, Tiêu chí đưa vào/loại trừ, Dẫn chứng trích đoạn) từ các sự kiện video đã hoàn thành. Bạn có thể xem riêng từng video hoặc xuất sổ mã tổng hợp.' },

  wfReportsStep: { en: 'Step 2.5 / 5: Individual Lesson Reports', vi: 'Bước 2.5 / 5: Báo Cáo Từng Tiết Dạy' },
  wfReportsRunsAfter: { en: 'Runs after Video Analysis completes (report_generated)', vi: 'Chạy sau khi Video phân tích xong (Step: report_generated)' },
  wfReportsAutoText: { en: 'Auto-generated immediately when analysis finishes', vi: 'Tự động sinh báo cáo đầy đủ ngay khi phân tích xong' },
  wfReportsDesc: { en: 'Comprehensive observation transcripts, rubric mapping, and duration stats are 100% auto-generated upon video pipeline completion. Ready for Word/DOCX export individually or in batch.', vi: 'Toàn bộ biên bản quan sát, phân loại theo rubric và thống kê thời lượng được tạo tự động 100% khi quy trình phân tích video kết thúc. Sẵn sàng xem chi tiết và xuất Word/DOCX chuyên khảo đơn lẻ hoặc hàng loạt.' },

  wfAnalyticsStep: { en: 'Step 3 / 5: Corpus-Wide Benchmarking', vi: 'Bước 3 / 5: Đối Sánh Toàn Tập Mẫu' },
  wfAnalyticsRunsAfter: { en: 'Runs after 1 or more videos finish analysis', vi: 'Chạy sau khi có một hoặc nhiều video hoàn tất phân tích' },
  wfAnalyticsAutoText: { en: 'Real-time Auto-aggregation from analyzed videos', vi: 'Tự động tổng hợp thời gian thực (Real-time Sync)' },
  wfAnalyticsDesc: { en: 'No manual batch run needed. All longitudinal charts (Trajectory, 5D Radar, Lesson Stream, Pedagogical Quadrant) auto-refresh in real time as videos finish.', vi: 'Không cần bấm nút chạy hay đợi xử lý theo đợt. Ngay khi bất kỳ video nào phân tích xong, các biểu đồ (Xu hướng tiến triển, Radar 5 chiều, Dòng chảy tiết học, Ma trận phong cách) tự động cập nhật ngay lập tức.' },

  wfThemesStep: { en: 'Step 4 / 5: Grounded Theory Synthesis', vi: 'Bước 4 / 5: Quy Nạp Chủ Đề Grounded Theory' },
  wfThemesRunsAfter: { en: 'Runs after the video corpus is fully analyzed', vi: 'Chạy sau khi toàn bộ tập video đã được phân tích đầy đủ' },
  wfThemesAutoText: { en: 'Manual / On-demand run (Click "Run Analysis")', vi: 'Chạy thủ công theo yêu cầu (Bấm "Khởi chạy phân tích")' },
  wfThemesDesc: { en: 'Because this is a multi-stage deep AI inductive process (5 stages across entire corpus), researchers trigger it manually once sufficient video data is collected.', vi: 'Do là tiến trình suy luận quy nạp AI chuyên sâu qua 5 giai đoạn (Gom cụm ➔ Phát hiện Patterns ➔ Grounded Theory ➔ Tổng hợp câu hỏi RQ1-RQ3 ➔ Hồ sơ giáo viên), bạn chủ động bấm nút khởi chạy khi tập mẫu sẵn sàng.' },

  wfInterviewStep: { en: 'Step 5 / 5: Post-Observation Protocol', vi: 'Bước 5 / 5: Hướng Dẫn Phỏng Vấn Hậu Quan Sát' },
  wfInterviewRunsAfter: { en: 'Runs after video analysis & Teaching Themes synthesis', vi: 'Chạy sau khi phân tích video và hoàn tất tổng hợp Themes' },
  wfInterviewAutoText: { en: 'Semi-automated (Auto-links evidence, manual review)', vi: 'Bán tự động (Tự liên kết bằng chứng, duyệt câu hỏi)' },
  wfInterviewDesc: { en: 'System auto-associates observed teacher evidence with questions. Core 22 questions (RQ1–RQ3) can be approved or re-synthesized by AI on demand.', vi: 'Hệ thống tự động liên kết bằng chứng quan sát của từng giáo viên từ các video đã phân tích. Bộ câu hỏi cốt lõi 22 câu (RQ1–RQ3) có thể được phê duyệt hoặc AI tổng hợp lại theo nhu cầu nghiên cứu.' }
};

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key: string) => key,
});

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem('vtr_lang') as Language;
    if (saved === 'en' || saved === 'vi') {
      setLanguage(saved);
    }
  }, []);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem('vtr_lang', lang);
  };

  const t = (key: string): string => {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useTranslation = () => useContext(I18nContext);
