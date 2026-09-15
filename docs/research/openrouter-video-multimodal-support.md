# Nghiên Cứu: Hỗ Trợ Multimodal Video Input Qua OpenRouter

Tài liệu kỹ thuật tổng hợp quy chuẩn API chính thức từ **OpenRouter**, đánh giá tính khả thi, phân tích rào cản và lộ trình triển khai tính năng **Trích xuất video (`video_extraction`)** đa nền tảng không phụ thuộc độc quyền vào Google Gemini.

---

## 1. Bối Cảnh & Vấn Đề (Context & Problem Statement)

### 1.1. Hiện trạng hệ thống
- Hệ thống hiện tại tách biệt các luồng xử lý AI:
  - **Luồng Text/Reasoning (2, 3, 4, 5)**: *Checklist Mapping, Thematic Analysis, Interview Generator, Codebook Generation* — Đã hỗ trợ linh hoạt cả **Gemini** lẫn **OpenRouter** (Claude 3.7 Sonnet, GPT-4o, DeepSeek R1).
  - **Luồng 1 (`video_extraction`)**: Hiện bị ràng buộc cứng (`hardcoded check`) chỉ cho phép provider `gemini` thông qua Google Gemini Files API (`generativelanguage.googleapis.com/upload/v1beta/files`).
- Khi người dùng gán một model thuộc OpenRouter cho luồng `video_extraction`, hệ thống trả về lỗi:
  ```text
  video extraction flow 'video_extraction' requires a multimodal video provider (gemini), but 'openrouter' was configured
  ```

### 1.2. Mục tiêu kiến trúc
- Trao quyền quyết định toàn diện cho người dùng (*User-centric AI Routing*).
- Không gán cứng nhà cung cấp (Provider) cho bất kỳ mục đích nào.
- Cho phép luồng trích xuất video tiếp nhận model từ OpenRouter hoặc các provider khác theo chuẩn chung.

---

## 2. Đặc Tả Kỹ Thuật OpenRouter Video Input (Official Docs)

Theo tài liệu chính thức từ [OpenRouter Docs (Video Inputs)](https://openrouter.ai/docs), OpenRouter đã hỗ trợ multimodal video input trực tiếp thông qua endpoint chuẩn `/chat/completions`.

### 2.1. Endpoint & Giao Thức
- **Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions`
- **Header:**
  ```http
  Authorization: Bearer <OPENROUTER_API_KEY>
  Content-Type: application/json
  HTTP-Referer: https://github.com/video-teaching-research
  X-Title: Video Teaching Research Platform
  ```

### 2.2. Cấu Trúc Request Payload (`video_url`)
Khác với Google Generative AI (upload file nhị phân riêng rồi lấy URI), OpenRouter đóng gói video trực tiếp vào mảng `messages[].content` bằng type `video_url`:

```json
{
  "model": "google/gemini-2.5-flash",
  "temperature": 0.2,
  "messages": [
    {
      "role": "user",
      "content": [
        {
          "type": "text",
          "text": "Trích xuất toàn bộ sự kiện giảng dạy trong đoạn video này theo định dạng JSON chuẩn..."
        },
        {
          "type": "video_url",
          "video_url": {
            "url": "data:video/mp4;base64,AAAAHGZ0eXBtcDQyAAAAAW1wNDJpc29t..."
          }
        }
      ]
    }
  ]
}
```

*Lưu ý:* Ngoài `data:video/mp4;base64,...`, trường `url` cũng hỗ trợ đường dẫn trực tiếp nếu video đã được host công khai trên internet (ví dụ: `https://my-bucket.s3.amazonaws.com/chunk_001.mp4`).

---

## 3. So Sánh: Google Gemini Direct vs. OpenRouter Video

| Tiêu chí | Google Gemini Direct (`gemini`) | OpenRouter Multimodal (`openrouter`) |
| :--- | :--- | :--- |
| **Giao thức tải video** | Resumable Files API (`/upload/v1beta/files`) | Nhúng chuỗi Base64 hoặc public URL vào JSON Chat Payload |
| **Giới hạn kích thước** | Lên tới **2 GB / file** | Phụ thuộc vào giới hạn payload HTTP request (khuyến nghị **< 30–50 MB**) |
| **Overhead dữ liệu** | 0% (truyền nhị phân nguyên bản `streaming chunk`) | **+33% dung lượng** do mã hóa Base64 |
| **Hỗ trợ Model** | Độc quyền các model Google (Gemini 2.5/3.7 Flash, Pro) | Các model có cờ `"video"` trong `input_modalities` (họ Gemini qua OpenRouter, tương lai là Qwen-VL, GPT-4o video nếu mở rộng) |
| **Chi phí / Token** | Tính theo quota trực tiếp của Google Cloud / AI Studio | Tính theo bảng giá token multimodal của OpenRouter |
| **Khả năng xử lý file local** | Tự upload trực tiếp file `.mp4` từ ổ đĩa máy chủ | Phải đọc toàn bộ file vào RAM rồi encode Base64 hoặc upload trung gian |

---

## 4. Ràng Buộc Kỹ Thuật & Cảnh Báo (Constraints & Gotchas)

1. **Ràng buộc Model Modality:**
   - Không phải model nào trên OpenRouter cũng "xem" được video.
   - Nếu người dùng cấu hình các model thuần Text hoặc Text+Image (ví dụ: `anthropic/claude-3.7-sonnet`, `deepseek/deepseek-r1`), API OpenRouter sẽ trả về lỗi:
     ```json
     {"error": {"message": "Unsupported modality: video for model anthropic/claude-3.7-sonnet", "code": 400}}
     ```
   - Các model hỗ trợ video tốt nhất trên OpenRouter hiện tại: `google/gemini-2.5-flash`, `google/gemini-pro-1.5`, v.v.

2. **Áp lực bộ nhớ RAM và Payload Size khi Base64:**
   - Một chunk video 10 phút ở chất lượng 1080p có thể nặng 150MB. Khi encode Base64 sẽ phình lên ~200MB.
   - Gửi 200MB JSON qua HTTP request rất dễ bị Gateway Proxy (Cloudflare / OpenRouter Ingress) ngắt kết nối (`413 Payload Too Large` hoặc `504 Gateway Timeout`).
   - **Giải pháp tối ưu:** Trước khi gửi sang OpenRouter, video chunk cần được ffmpeg nén về độ phân giải 480p/720p hoặc hạ bitrate để file chỉ dao động từ **10MB – 25MB**.

---

## 5. Lộ Trình Triển Khai Trong Codebase (Future Implementation Plan)

Khi tiến hành triển khai tính năng này, các bước cụ thể gồm:

### Bước 1: Cài đặt `AnalyzeVideoChunk` trong `backend/internal/ai/openrouter.go`
- Bổ sung implementation của interface `VideoAnalysisProvider` cho `OpenRouterProvider`:
  ```go
  func (o *OpenRouterProvider) AnalyzeVideoChunk(ctx context.Context, videoFilePath string, prompt string) (string, error) {
      // 1. Đọc file video local
      videoBytes, err := os.ReadFile(videoFilePath)
      if err != nil {
          return "", fmt.Errorf("failed to read video file: %w", err)
      }

      // 2. Encode Base64
      base64Video := base64.StdEncoding.EncodeToString(videoBytes)
      dataURI := fmt.Sprintf("data:video/mp4;base64,%s", base64Video)

      // 3. Tạo payload chat completion với type: "video_url"
      // 4. Gửi lên OpenRouter và nhận JSON response
  }
  ```

### Bước 2: Bỏ logic chặn cứng trong `backend/internal/service/ai_router.go`
- Sửa hàm `GetVideoProviderForFlow`:
  ```go
  // Thay vì:
  // if providerType != "gemini" { return nil, "", fmt.Errorf(...) }

  // Chuyển thành:
  switch providerType {
  case "gemini":
      return s.getGeminiProvider(apiKeySecret, modelName), modelName, nil
  case "openrouter":
      return s.getOpenRouterProvider(apiKeySecret), modelName, nil
  default:
      return nil, "", fmt.Errorf("unsupported provider '%s' for video extraction", providerType)
  }
  ```

### Bước 3: Nâng cấp `AIModelInfo` & Bộ Lọc Giao Diện (`frontend/app/settings/page.tsx`)
- Trong bảng `ai_models`, thêm cờ `supports_video BOOLEAN DEFAULT FALSE` (hoặc kiểm tra `modalities`).
- Cho phép người dùng chọn bất kỳ Model nào có khả năng multimodal cho luồng `video_extraction`.
- Hiển thị badge trực quan trên UI: `[Video Capable]` bên cạnh các model hỗ trợ video.

---

## 6. Tài Liệu Tham Khảo (References)
- [OpenRouter Official Docs - Video Inputs](https://openrouter.ai/docs)
- [OpenRouter Models Modality Filtering](https://openrouter.ai/models)
- [Google Generative AI Files API Specification](https://ai.google.dev/gemini-api/docs/vision)
