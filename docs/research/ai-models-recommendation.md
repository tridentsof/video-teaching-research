# Hướng Dẫn & Đề Xuất Mô Hình AI (AI Model Strategies & Recommendations)

Tài liệu này tổng hợp các chiến lược phân bổ mô hình AI cho 5 luồng xử lý chính trong hệ sinh thái **Video Teaching Research**, chia theo 3 chế độ vận hành: **Dư dả (Chất lượng tối đa)**, **Trung bình (Cân bằng)** và **Tối ưu chi phí (Budget)**.

---

## 1. Tổng Quan 5 Luồng Nhiệm Vụ AI (Pipeline Flows)

| Tác vụ | Flow Key | Loại tác vụ | Yêu cầu kỹ thuật |
| :--- | :--- | :--- | :--- |
| **1. Trích xuất sự kiện video** | `video_extraction` | Multimodal (Video + Audio) | Phân tích video dài (10–90 phút), trích xuất mốc thời gian, lời thoại, hành động. **Bắt buộc dùng Gemini 3.7 Flash hoặc Gemini 3.8 Flash**. |
| **2. Khớp nối Checklist** | `checklist_mapping` | Text (Reasoning & JSON) | Ánh xạ sự kiện thô vào 28 tiêu chí sư phạm theo chuẩn JSON schema, cần độ chính xác cao và không bịa đặt (low hallucination). |
| **3. Phân tích chủ đề & Báo cáo** | `thematic_analysis` | Text (Deep Synthesis) | Rút ra insights định tính, phát hiện mẫu hành vi sư phạm, tạo báo cáo học thuật chuyên sâu. |
| **4. Sinh câu hỏi phỏng vấn** | `interview_generator` | Text (Pedagogical Inquiry) | Tạo câu hỏi phản tư (reflective questions) giúp giáo viên tự soi chiếu bài giảng. |
| **5. Sinh bộ mã Codebook** | `codebook_generation` | Text (Structured Coding) | Trích xuất các mã định tính, định nghĩa quy chuẩn và ví dụ minh họa phục vụ nghiên cứu khoa học. |

---

## 2. Các Chế Độ Đề Xuất (3 Modes)

### 🌟 Mode 1: Dư Dả (Chất Lượng Tối Đa - Deep Academic & Qualitative Rigor)
> **Mục tiêu**: Đạt chất lượng học thuật, độ sâu sắc và tính logic cao nhất cho nghiên cứu sư phạm chuyên sâu.

| STT | Luồng công việc (Flow) | Provider | Mô hình đề xuất | Temp | Điểm mạnh & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Video Extraction** | Google Gemini | `gemini-3.7-flash` *(hoặc `gemini-3.8-flash`)* | `0.20` | Native multimodal xử lý video và âm thanh cực nhạy, context 1M–2M tokens, trích xuất chính xác timestamp và trích dẫn. |
| 2 | **Checklist Mapping** | OpenRouter | `anthropic/claude-3.7-sonnet` *(hoặc `openai/gpt-4o`)* | `0.10` | Khả năng suy luận chính xác, tuân thủ JSON 100%, đối chiếu tiêu chí khắt khe và không bị ảo giác dữ liệu. |
| 3 | **Thematic Analysis** | OpenRouter | `anthropic/claude-3.7-sonnet` *(hoặc `deepseek/deepseek-r1`)* | `0.40` | Khả năng lập luận học thuật xuất sắc, tổng hợp định tính đa chiều, phát hiện các mẫu hành vi tinh tế của giáo viên. |
| 4 | **Interview Generator** | OpenRouter | `anthropic/claude-3.7-sonnet` | `0.50` | Câu hỏi phỏng vấn mang tính sư phạm cao, giọng văn tự nhiên và khuyến khích đối thoại chiều sâu. |
| 5 | **Codebook Generation** | OpenRouter | `deepseek/deepseek-r1` *(hoặc `claude-3.7-sonnet`)* | `0.30` | Mô hình suy luận reasoning mạnh giúp phân loại danh mục mã hoá (thematic codes) cực kỳ chuẩn xác và khoa học. |

---

### ⚖️ Mode 2: Trung Bình (Cân Bằng - Hiệu Năng Cao & Chi Phí Hợp Lý)
> **Mục tiêu**: Tối ưu giữa tốc độ phản hồi nhanh, độ thông minh tốt và chi phí vận hành ở mức vừa phải.

| STT | Luồng công việc (Flow) | Provider | Mô hình đề xuất | Temp | Điểm mạnh & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Video Extraction** | Google Gemini | `gemini-3.7-flash` | `0.20` | Tốc độ xử lý video cực nhanh, chi phí rẻ hơn nhiều so với bản Pro trong khi độ chuẩn xác gần tương đương. |
| 2 | **Checklist Mapping** | Google Gemini | `gemini-3.7-flash` | `0.10` | Xử lý JSON schema nhanh, định danh tiêu chí chuẩn xác với chi phí rất tiết kiệm. |
| 3 | **Thematic Analysis** | OpenRouter / Gemini | `deepseek/deepseek-chat` *(V3)* hoặc `gemini-3.7-flash` | `0.40` | DeepSeek V3 có khả năng viết phân tích định tính rất tốt tương đương các model đầu bảng nhưng chi phí chỉ bằng 1/10. |
| 4 | **Interview Generator** | Google Gemini | `gemini-3.7-flash` | `0.50` | Tạo câu hỏi nhanh, tự nhiên, bám sát các sự kiện đã trích xuất. |
| 5 | **Codebook Generation** | OpenRouter / Gemini | `deepseek/deepseek-chat` *(V3)* hoặc `gemini-3.7-flash` | `0.30` | Phân tích và nhóm các mã định tính rõ ràng, cấu trúc gọn gàng. |

---

### 💰 Mode 3: Tối Ưu Chi Phí (Budget / Cost-Optimized - Tiết Kiệm Tối Đa)
> **Mục tiêu**: Chi phí token thấp nhất có thể cho các dự án quy mô lớn, nhưng vẫn đảm bảo độ tin cậy và không bị lỗi parser.

| STT | Luồng công việc (Flow) | Provider | Mô hình đề xuất | Temp | Điểm mạnh & Rationale |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | **Video Extraction** | Google Gemini | `gemini-3.7-flash` *(hoặc `gemini-3.8-flash`)* | `0.20` | Lựa chọn tối ưu duy nhất vừa hỗ trợ video native trực tiếp vừa có giá thành/token rẻ nhất phân khúc. |
| 2 | **Checklist Mapping** | Google Gemini | `gemini-2.5-flash` | `0.10` | Rất rẻ, xử lý ánh xạ bảng tiêu chí nhanh chóng và tuân thủ schema JSON tốt. |
| 3 | **Thematic Analysis** | OpenRouter | `deepseek/deepseek-chat` *(V3)* | `0.35` | Giá token siêu rẻ (~$0.14 - $0.28 / 1M tokens), chất lượng phân tích văn bản vượt trội hơn hẳn các model nhỏ khác. |
| 4 | **Interview Generator** | Google Gemini | `gemini-2.5-flash` | `0.40` | Sinh câu hỏi cơ bản đầy đủ ý và tiết kiệm chi phí tối đa. |
| 5 | **Codebook Generation** | OpenRouter / Gemini | `deepseek/deepseek-chat` *(hoặc `gemini-2.5-flash`)* | `0.25` | Tự động tạo bảng codebook đủ chuẩn nghiên cứu với chi phí gần như không đáng kể. |

---

## 3. Hướng Dẫn Cấu Hình Trên Ứng Dụng

1. Truy cập vào trang **AI Studio / Cài đặt AI** (`/settings`) trên giao diện web.
2. Tại mục **Kho khóa API (Key Vault)**:
   - Thêm khóa **Google Gemini API Key**.
   - Thêm khóa **OpenRouter API Key** (nếu dùng các model Claude, GPT-4o, DeepSeek).
3. Tại mục **Cấu hình luồng AI (Pipeline Flows)**:
   - Gán mô hình tương ứng cho 5 luồng theo một trong 3 bảng cấu hình ở trên.
   - Điều chỉnh mức nhiệt độ (`Temperature`) theo khuyến nghị.
4. Bấm **Lưu thay đổi** để áp dụng ngay lập tức cho các lần chạy pipeline tiếp theo.
