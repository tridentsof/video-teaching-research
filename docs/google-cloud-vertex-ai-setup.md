# Hướng Dẫn Kỹ Thuật: Thiết Lập Xác Thực & Cấu Hình Google Cloud Vertex AI (Official Guide)

> **Tài liệu tham chiếu chuẩn theo Google Cloud Architecture & Vertex AI Documentation.**  
> *Phiên bản áp dụng:* Google Cloud Gemini 2.0 / 2.5 / 3.x trên Vertex AI  
> *Tài liệu chính thức:* [Vertex AI Generative AI Documentation](https://cloud.google.com/vertex-ai/generative-ai/docs) | [Google Cloud IAM Access Control](https://cloud.google.com/vertex-ai/docs/general/access-control) | [GCS Multimodal Video](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/video-understanding)

---

## 1. Kiến Trúc Tích Hợp & Luồng Dữ Liệu (System Architecture)

Hệ thống **Video Teaching Research** giao tiếp với Google Cloud Platform theo mô hình Service-to-Service phi tập trung (Server-to-Server Authentication), tuân thủ nguyên tắc **Zero Trust** và **Least Privilege**:

```mermaid
sequenceDiagram
    autonumber
    participant App as VTR Backend (Go Engine)
    participant OAuth as Google OAuth 2.0 Auth Server
    participant GCS as Cloud Storage Bucket (Staging)
    participant Vertex as Vertex AI Model Endpoint (Gemini)

    Note over App,OAuth: Bước 1: Xác thực phi tập trung (Service Account JWT)
    App->>OAuth: POST https://oauth2.googleapis.com/token (RS256 Signed JWT)
    OAuth-->>App: Trả về Scoped Access Token (Hạn dùng 3600s, Tự động cache & refresh)

    alt Luồng Video Extraction (Multimodal Video)
        Note over App,GCS: Bước 2: Tải video chunk lên GCS tạm thời
        App->>GCS: PUT /vtr-staging-bucket/chunk_001.mp4 (Storage REST API)
        GCS-->>App: 200 OK (gs://vtr-staging-bucket/chunk_001.mp4)

        Note over App,Vertex: Bước 3: Gửi tham chiếu video sang Vertex AI
        App->>Vertex: POST /v1/projects/{proj}/locations/{loc}/publishers/google/models/{model}:generateContent
        Note right of Vertex: Payload: parts[fileData: {fileUri: "gs://...", mimeType: "video/mp4"}]
        Vertex-->>App: 200 OK (Trích xuất sự kiện sư phạm, timestamps, transcript)

        Note over App,GCS: Bước 4: Tự động dọn dẹp file chunk
        App->>GCS: DELETE /vtr-staging-bucket/chunk_001.mp4
        GCS-->>App: 204 No Content (Không phát sinh chi phí lưu trữ)
    else Luồng Text / Suy Luận (Checklist, Codebook, Interview)
        App->>Vertex: POST :generateContent (Gửi trực tiếp prompt & system instruction)
        Vertex-->>App: 200 OK (Kết quả JSON / Markdown phân tích)
    end
```

---

## 2. Bảng Yêu Cầu Phân Quyền (IAM Roles & Least Privilege Matrix)

Theo khuyến nghị bảo mật từ [Google Cloud IAM Best Practices](https://cloud.google.com/iam/docs/best-practices-service-accounts), Service Account chỉ được cấp các vai trò định sẵn (Predefined Roles) tối thiểu:

| Dịch vụ GCP | Role ID | Tên Role hiển thị | Mục đích kỹ thuật |
| :--- | :--- | :--- | :--- |
| **Vertex AI** | `roles/aiplatform.user` | **Vertex AI User** | Cấp quyền `aiplatform.endpoints.predict` để gọi phương thức `:generateContent` trên mô hình Gemini. |
| **Cloud Storage** | `roles/storage.objectAdmin` | **Storage Object Admin** | Cấp quyền `storage.objects.create`, `storage.objects.get`, `storage.objects.delete` để ứng dụng upload chunk video và lập tức xóa sau khi inference hoàn tất. *(Nếu chỉ chạy luồng text, không cần role này)*. |

> [!IMPORTANT]
> **Không cấp vai trò `Owner` hoặc `Editor`** cho Service Account của ứng dụng. Việc sử dụng vai trò đặc quyền quá cao vi phạm nguyên tắc bảo mật thông tin và tạo lỗ hổng khi rò rỉ credential.

---

## 3. Hướng Dẫn Thiết Lập Từng Bước Trên Google Cloud Console

### Bước 1: Thiết Lập Dự Án & Bật APIs (Enable Services)
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/).
2. Chọn Project có sẵn hoặc tạo mới tại [Resource Manager](https://console.cloud.google.com/cloud-resource-manager).
3. Ghi lại chính xác **Project ID** (Lưu ý: *Project ID* là chuỗi định danh duy nhất ví dụ `vtr-prod-451208`, khác với *Project Name*).
4. Kích hoạt các API bắt buộc qua Google API Library:
   - **Vertex AI API**: [`aiplatform.googleapis.com`](https://console.cloud.google.com/marketplace/product/google/aiplatform.googleapis.com) -> Nhấn **Enable**.
   - **Google Cloud Storage API**: [`storage.googleapis.com`](https://console.cloud.google.com/marketplace/product/google/storage.googleapis.com) -> Đảm bảo trạng thái **Enabled**.
   - **Service Usage API**: [`serviceusage.googleapis.com`](https://console.cloud.google.com/marketplace/product/google/serviceusage.googleapis.com) -> Mặc định đã kích hoạt.

---

### Bước 2: Khởi Tạo Cloud Storage Bucket (Phục Vụ Multimodal Video)

Vertex AI Gemini xử lý video thông qua giao thức Google Cloud Storage URI `gs://<bucket>/<path>`.

1. Điều hướng đến: **Navigation Menu (☰)** -> **Cloud Storage** -> **Buckets** ([storage/browser](https://console.cloud.google.com/storage/browser)).
2. Nhấn **Create Bucket**:
   - **Name**: Đặt tên tuân theo quy chuẩn DNS toàn cầu (ví dụ: `vtr-video-staging-<your-project-id>`).
   - **Location type**: Chọn **Region**.
     - Khuyến nghị: Chọn **cùng khu vực** với Vertex AI để giảm tối đa độ trễ upload và **miễn phí cước mạng truyền tải nội bộ (Intra-region Data Transfer is Free)**:
       - `us-central1` (Iowa - Đầy đủ model mới nhất và quota cao nhất).
       - `asia-southeast1` (Singapore - Tối ưu độ trễ cho người dùng tại Đông Nam Á / Việt Nam).
   - **Storage class**: Chọn **Standard**.
   - **Prevent public access**: Bật **Enforce public access prevention on this bucket** (Tuyệt đối không public bucket này ra internet).
   - **Access control**: Chọn **Uniform** (Google Cloud recommended).
3. Nhấn **Create**.
4. **Cấu hình tự dọn dẹp (Bucket Lifecycle Policy)**:
   - Trong chi tiết Bucket, chuyển sang tab **Lifecycle** -> Nhấn **Add a rule**.
   - Action: Chọn **Delete object**.
   - Condition: Chọn **Age** -> Nhập `2` ngày.
   - Nhấn **Save**.  
   *(Cơ chế phòng ngừa: Nếu server mất điện hoặc crash giữa chừng khiến lệnh xóa không thực thi được, GCS sẽ tự động hủy file sau 48h).*

---

### Bước 3: Khởi Tạo Service Account & Phân Quyền (IAM)

1. Điều hướng đến: **IAM & Admin** -> **Service Accounts** ([iam-admin/serviceaccounts](https://console.cloud.google.com/iam-admin/serviceaccounts)).
2. Nhấn **+ Create Service Account**:
   - **Service account name**: `vtr-vertex-agent`
   - **Service account ID**: `vtr-vertex-agent` (tự động điền).
   - **Description**: `Service account for Video Teaching Research AI Engine`.
   - Nhấn **Create and Continue**.
3. **Grant this service account access to project**:
   - Chọn Role thứ nhất: Gõ `Vertex AI User` (mã: `roles/aiplatform.user`).
   - Nhấn **+ Add Another Role**.
   - Chọn Role thứ hai: Gõ `Storage Object Admin` (mã: `roles/storage.objectAdmin`).
   - Nhấn **Continue** -> Nhấn **Done**.

---

### Bước 4: Tạo Và Xuất Khóa Riêng Tư (Service Account Private Key)

1. Trong bảng danh sách Service Accounts, tìm dòng `vtr-vertex-agent@<project-id>.iam.gserviceaccount.com`.
2. Bấm vào biểu tượng ba chấm **Actions (⋮)** ở cuối dòng -> Chọn **Manage keys**.
3. Chọn **Add Key** -> **Create new key**.
4. Chọn định dạng **JSON** -> Nhấn **Create**.
5. Trình duyệt sẽ tải về một file dạng: `<project-id>-<key-id>.json`.

**Cấu trúc chuẩn của file Service Account JSON:**
```json
{
  "type": "service_account",
  "project_id": "vtr-prod-451208",
  "private_key_id": "7b8f9e...",
  "private_key": "-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0...\n-----END RSA PRIVATE KEY-----\n",
  "client_email": "vtr-vertex-agent@vtr-prod-451208.iam.gserviceaccount.com",
  "client_id": "10492837461928374",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/vtr-vertex-agent%40..."
}
```

---

## 4. Tự Động Hóa 100% Qua `gcloud CLI` (Google Cloud SDK)

Đối với kỹ sư hệ thống hoặc môi trường CI/CD, toàn bộ các bước trên được thực thi tự động thông qua bash script chuẩn:

```bash
#!/usr/bin/env bash
set -euo pipefail

# 1. Khai báo thông số cấu hình
PROJECT_ID="vtr-research-prod"       # Thay bằng Project ID của bạn
REGION="us-central1"                # Khu vực khuyến nghị
BUCKET_NAME="vtr-staging-${PROJECT_ID}"
SA_NAME="vtr-vertex-agent"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

# 2. Thiết lập dự án hiện hành
gcloud config set project "${PROJECT_ID}"

# 3. Kích hoạt các API bắt buộc
echo "==> Đang kích hoạt Google Cloud APIs..."
gcloud services enable \
    aiplatform.googleapis.com \
    storage.googleapis.com \
    iamcredentials.googleapis.com

# 4. Khởi tạo GCS Bucket an toàn
echo "==> Đang tạo GCS Bucket: gs://${BUCKET_NAME}..."
gcloud storage buckets create "gs://${BUCKET_NAME}" \
    --location="${REGION}" \
    --default-storage-class="STANDARD" \
    --uniform-bucket-level-access \
    --public-access-prevention

# 5. Khởi tạo Service Account
echo "==> Đang tạo Service Account..."
gcloud iam service-accounts create "${SA_NAME}" \
    --display-name="VTR Vertex AI Automation Agent" \
    --description="Used by Video Teaching Research system for multimodal analysis"

# 6. Gán quyền IAM Least Privilege
echo "==> Đang gắn IAM Roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/aiplatform.user"

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET_NAME}" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/storage.objectAdmin"

# 7. Xuất file Service Account Key
KEY_FILE="./vertex-sa-key-${PROJECT_ID}.json"
echo "==> Đang tạo và xuất Key file về: ${KEY_FILE}..."
gcloud iam service-accounts keys create "${KEY_FILE}" \
    --iam-account="${SA_EMAIL}"

echo "================================================================"
echo "THIẾT LẬP THÀNH CÔNG!"
echo "Project ID: ${PROJECT_ID}"
echo "Region:     ${REGION}"
echo "GCS Bucket: ${BUCKET_NAME}"
echo "Key File:   ${KEY_FILE}"
echo "================================================================"
```

---

## 5. Nhập Cấu Hình Vào Hệ Thống (Application Settings UI)

1. Đăng nhập vào trang quản trị: **`http://localhost:3000/settings`** (Mục **AI Studio**).
2. Tại phần **API Key Vault (Két Khóa An Toàn)**, nhấn **Add AI Provider Key**:
   - **Provider**: Chọn `Google Cloud Vertex AI (Service Account)`.
   - **Key Label**: Đặt tên phân biệt, ví dụ: `GCP Production Key (us-central1)`.
   - **Service Account JSON Credentials**: Mở file `.json` đã tải, copy toàn bộ nội dung và dán vào.
   - **GCP Project ID**: Tự động nhận diện từ file JSON (hoặc điền mã project ID).
   - **Region**: Điền `us-central1` (hoặc region bạn đã tạo bucket).
   - **Cloud Storage Bucket**: Điền tên Bucket vừa tạo (ví dụ `vtr-staging-vtr-research-prod`).
   - Nhấn **Save API Key**.
3. Chuyển sang bảng **Pipeline Stages**:
   - Luồng **`video_extraction`**: Chọn model `Vertex AI: Gemini 3.7 Flash` (hoặc `Gemini 2.5 Pro`) và chọn Key vừa tạo.
   - Luồng **`codebook_generation`** / **`checklist_mapping`**: Tự do phân bổ theo nhu cầu.
4. Bấm **Ping Test** (biểu tượng sóng radar):
   - Hệ thống sẽ gọi REST endpoint của Vertex AI để kiểm tra phản hồi.
   - Khi nhận được thông báo `"Ping Successful: Pong (latency ...ms)"`, hệ thống đã kết nối trực tiếp thành công với Google Cloud.

---

## 6. Danh Mục Model Vertex AI Được Hỗ Trợ (Model Catalog Reference)

| Provider | Mã Model kỹ thuật (`model_id`) | Vertex AI Model Endpoint | Region Hỗ Trợ | Cửa sổ ngữ cảnh (Tokens) | Tối ưu cho tác vụ |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `vertex_ai` | `gemini-3.8-flash` | `publishers/google/models/gemini-3.8-flash` | **`global`** *(Auto-routed)* | **1,048,576** | Phân tích video dung lượng lớn tốc độ cao, khả năng suy luận đa phương thức thế hệ mới nhất. |
| `vertex_ai` | `gemini-3.7-flash` | `publishers/google/models/gemini-3.7-flash` | `us-central1`, `global` | **1,048,576** | Phân tích video dung lượng lớn, nhận diện sự kiện sư phạm tức thì, chi phí tối ưu nhất. |
| `vertex_ai` | `gemini-2.5-pro` | `publishers/google/models/gemini-2.5-pro` | `us-central1`, `asia-southeast1`... | **2,097,152** | Lý luận chuyên sâu (Reasoning), tổng hợp báo cáo định tính phức tạp, sinh bộ mã Codebook sư phạm. |
| `vertex_ai` | `gemini-2.5-flash` | `publishers/google/models/gemini-2.5-flash` | `us-central1`, `asia-southeast1`... | **1,048,576** | Xử lý nhanh, chi phí siêu rẻ cho các tác vụ phân loại checklist và trích xuất sơ bộ. |

> [!NOTE]
> **Quy tắc Endpoint Global vs Regional của Google Cloud**:
> - Đối với model `gemini-3.8-flash`, Google Cloud triển khai trên hạ tầng phân tán **`global` endpoint**: `https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/publishers/google/models/gemini-3.8-flash:generateContent`. Backend hệ thống đã được tích hợp cơ chế tự động định tuyến thông minh sang endpoint `global` (không có prefix `global-`).
> - Đối với các model như `gemini-2.5-flash`, `gemini-2.5-pro`, hệ thống sử dụng regional endpoint tương ứng (ví dụ `https://us-central1-aiplatform.googleapis.com/...`).

---

## 7. Khắc Phục Lỗi Kỹ Thuật (Troubleshooting Matrix)

| Mã lỗi HTTP & Thông báo | Nguyên nhân kỹ thuật | Giải pháp chuẩn theo GCP Docs |
| :--- | :--- | :--- |
| **`400 INVALID_ARGUMENT`**<br>`"Please use a valid role: user, model"` | Vertex AI yêu cầu rõ ràng trường `role: "user"` trong mảng `contents`. | Hệ thống backend đã tự động gắn `Role: "user"` cho tất cả các request tới Vertex AI. |
| **`401 UNAUTHENTICATED`**<br>`"Invalid JWT Signature"` | Private Key trong file JSON bị cắt xén hoặc định dạng không hợp lệ khi copy-paste. | Copy lại toàn bộ file JSON gốc tải về từ Console, đảm bảo có đầy đủ header `-----BEGIN RSA PRIVATE KEY-----`. |
| **`403 PERMISSION_DENIED`**<br>`"Caller does not have permission 'aiplatform.endpoints.predict'"` | Service Account thiếu vai trò `roles/aiplatform.user` trên GCP Project. | Mở **IAM & Admin**, thêm binding role `Vertex AI User` cho email Service Account. Chờ khoảng 1-2 phút để IAM policy được replicate. |
| **`403 PERMISSION_DENIED`**<br>`"storage.objects.create denied"` | Service Account không có quyền ghi dữ liệu vào GCS Bucket đã chỉ định. | Vào **Cloud Storage** -> Click vào Bucket -> tab **Permissions** -> Thêm `roles/storage.objectAdmin` cho Service Account. |
| **`404 NOT_FOUND`**<br>`"Publisher Model not found in location"` | Model chưa được Google triển khai tại Region đã chỉ định (ví dụ `gemini-3.8-flash` gọi vào `us-central1` thay vì `global`). | Hệ thống backend hiện tại tự động điều hướng `gemini-3.8-flash` sang `locations/global` và host `aiplatform.googleapis.com`. Với các model khác, sử dụng `us-central1`. |
| **`429 RESOURCE_EXHAUSTED`**<br>`"Quota exceeded for aiplatform.googleapis.com"` | Vượt ngưỡng giới hạn tốc độ (RPM / TPM) của tier hiện tại trên Google Cloud Project. | Vào **IAM & Admin** -> **Quotas & System Limits** -> Lọc `Vertex AI API` -> Gửi yêu cầu **Increase Quota**. |
