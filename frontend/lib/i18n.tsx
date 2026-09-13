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
  navCodeBook: { en: 'Code Book', vi: 'Sổ Mã Quan Sát' },
  navThemes: { en: 'Teaching Themes', vi: 'Chiến Lược & Chủ Đề' },
  navInterview: { en: 'Interview Studio', vi: 'Bộ Câu Hỏi Phỏng Vấn' },
  navSettings: { en: 'Admin Center', vi: 'Admin Center' },
  navApiDocs: { en: 'API Docs', vi: 'Tài Liệu API' },
  language: { en: 'Language', vi: 'Ngôn Ngữ' },

  // AI Studio
  aiStudioTitle: { en: 'AI Pipeline Studio & Dynamic Model Router', vi: 'AI Pipeline Studio & Điều Hướng Model' },
  aiStudioSubtitle: { en: 'Interactive Stage Flowgraph • Database-Driven Model Routing & API Key Vault', vi: 'Sơ Đồ Chuỗi Xử Lý Trực Quan • Quản Lý Model & Kho Khóa API Tự Động' },
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
  tabAdminCenter: { en: 'Admin Center', vi: 'Admin Center' },
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
  resetPipeline: { en: 'Reset Pipeline', vi: 'Reset Pipeline' },
  resetPipelineTitle: { en: 'Reset Pipeline', vi: 'Reset Pipeline' },
  resetPipelineDesc: {
    en: 'Delete all analysis results and return to initial uploaded status.',
    vi: 'Xóa tất cả kết quả phân tích và quay lại trạng thái ban đầu.',
  },
  resetPipelineCascadeWarning: {
    en: 'This will delete: chunks, events, mappings, reports, codebook, pipeline jobs. The original video file will be kept.',
    vi: 'Sẽ xóa: chunks, events, mappings, reports, codebook, pipeline jobs. Video gốc sẽ được giữ lại.',
  },
  resetPipelineSuccess: { en: 'Pipeline reset successfully! Video returned to uploaded status.', vi: 'Reset pipeline thành công! Video đã quay lại trạng thái uploaded.' },
  btnConfirmReset: { en: 'Reset Pipeline', vi: 'Reset Pipeline' },
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
  checklistsSecA: { en: 'Section A. Establishing Online Rules and Routines', vi: 'Section A. Establishing Online Rules and Routines' },
  checklistsSecB: { en: 'Section B. Managing Turn-taking and Speaking Participation', vi: 'Section B. Managing Turn-taking and Speaking Participation' },
  checklistsSecC: { en: 'Section C. Sustaining Learner Attention and Engagement', vi: 'Section C. Sustaining Learner Attention and Engagement' },
  checklistsSecD: { en: 'Section D. Providing Scaffolding and Positive Reinforcement', vi: 'Section D. Providing Scaffolding and Positive Reinforcement' },
  checklistsSecE: { en: 'Section E. Using Digital Tools to Support Learning and Interaction', vi: 'Section E. Using Digital Tools to Support Learning and Interaction' },

  // Reports
  reportsDesc: {
    en: 'Formatted observational findings per lesson, ready for academic research thesis citations and qualitative analysis.',
    vi: 'Báo cáo kết quả quan sát từng bài giảng, sẵn sàng cho trích dẫn luận văn nghiên cứu và phân tích định tính.'
  },
  reportsReadFull: { en: 'Read Full Report', vi: 'Xem Toàn Bộ Báo Cáo' },
  reportsVersion: { en: 'Observation v1.0', vi: 'Quan Sát v1.0' },
  reportsExportWord: { en: 'Export Word (.docx)', vi: 'Xuất File Word (.docx)' },
  reportsExportingWord: { en: 'Generating Word...', vi: 'Đang tạo file Word...' },
  reportsDownloadMd: { en: 'Download Markdown', vi: 'Tải File Markdown' },
  reportsColIndicators: { en: 'Indicators', vi: 'Indicators' },
  reportsColObserved: { en: 'Observed', vi: 'Observed' },
  reportsColFrequency: { en: 'Frequency', vi: 'Frequency' },
  reportsColTimestamp: { en: 'Timestamp', vi: 'Timestamp' },
  reportsColContext: { en: 'Context', vi: 'Context' },
  reportsObservedYes: { en: 'Yes', vi: 'Yes' },
  reportsObservedNo: { en: 'No', vi: 'No' },
  reportsLessonInfo: { en: 'Lesson Information', vi: 'Lesson Information' },
  reportsGeneralNotes: { en: 'General Observation Notes', vi: 'General Observation Notes' },
  reportsChecklistTitle: { en: 'Classroom Observation Checklist', vi: 'Classroom Observation Checklist' },
  reportsObservationNo: { en: 'Observation No.', vi: 'Observation No.' },
  reportsTeacher: { en: 'Teacher', vi: 'Teacher' },
  reportsDate: { en: 'Date', vi: 'Date' },
  reportsClass: { en: 'Class', vi: 'Class' },
  reportsPlatform: { en: 'Platform (Zoom/Google Meet)', vi: 'Platform (Zoom/Google Meet)' },
  reportsLessonTopic: { en: 'Lesson Topic', vi: 'Lesson Topic' },
  reportsDuration: { en: 'Duration', vi: 'Duration' },

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

  // Interview Studio
  interviewTitle: { en: 'Teacher Interview Guide', vi: 'Bộ Câu Hỏi Phỏng Vấn Giáo Viên' },
  interviewDesc: {
    en: 'Semi-structured interview questions and follow-ups generated from observed video moments to explore teachers\' instructional choices.',
    vi: 'Bộ câu hỏi phỏng vấn bán cấu trúc và câu hỏi đào sâu sinh từ các khoảnh khắc video thực tế để tìm hiểu ý đồ sư phạm của giáo viên.'
  },
  interviewBadge: { en: 'Evidence-based', vi: 'Dựa Trên Dẫn Chứng' },
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
  authNotSignedIn: { en: 'Not Signed In', vi: 'Chưa Đăng Nhập' }
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
