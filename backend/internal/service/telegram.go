package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// PipelineNotificationStats holds summary statistics to display in the Telegram notification.
type PipelineNotificationStats struct {
	TotalEvents int
	TotalMapped int
	HasReport   bool
	HasCodebook bool
	Duration    time.Duration
}

// TelegramNotifier defines the interface for delivering pipeline notifications.
type TelegramNotifier interface {
	IsEnabled() bool
	NotifyPipelineCompleted(ctx context.Context, video *model.Video, stats *PipelineNotificationStats) error
	NotifyPipelineFailed(ctx context.Context, video *model.Video, failedStep string, errMsg string) error
}

// DefaultTelegramNotifier implements TelegramNotifier.
type DefaultTelegramNotifier struct {
	webhookURL     string
	botToken       string
	chatID         string
	appBaseURL     string
	subscriberRepo *repository.TelegramSubscriberRepository
	httpClient     *http.Client
}

// NewTelegramNotifier creates a new DefaultTelegramNotifier.
func NewTelegramNotifier(webhookURL, botToken, chatID, appBaseURL string) *DefaultTelegramNotifier {
	return &DefaultTelegramNotifier{
		webhookURL: strings.TrimSpace(webhookURL),
		botToken:   strings.TrimSpace(botToken),
		chatID:     strings.TrimSpace(chatID),
		appBaseURL: strings.TrimRight(strings.TrimSpace(appBaseURL), "/"),
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// SetSubscriberRepository attaches the subscriber repository for database broadcasting.
func (n *DefaultTelegramNotifier) SetSubscriberRepository(repo *repository.TelegramSubscriberRepository) {
	n.subscriberRepo = repo
}

// IsEnabled checks if either a webhook URL or a bot token is provided.
func (n *DefaultTelegramNotifier) IsEnabled() bool {
	if n == nil {
		return false
	}
	if n.webhookURL != "" {
		return true
	}
	if n.botToken != "" {
		if n.chatID != "" || n.subscriberRepo != nil {
			return true
		}
	}
	return false
}

type telegramSendMessageRequest struct {
	ChatID                string `json:"chat_id"`
	Text                  string `json:"text"`
	ParseMode             string `json:"parse_mode"`
	DisableWebPagePreview bool   `json:"disable_web_page_preview"`
}

type genericWebhookPayload struct {
	Event      string    `json:"event"`
	Status     string    `json:"status"`
	VideoID    string    `json:"video_id"`
	VideoTitle string    `json:"video_title"`
	Message    string    `json:"message"`
	Text       string    `json:"text"`
	AppURL     string    `json:"app_url,omitempty"`
	Timestamp  time.Time `json:"timestamp"`
}

// NotifyPipelineCompleted sends a success notification with pipeline run details.
func (n *DefaultTelegramNotifier) NotifyPipelineCompleted(ctx context.Context, video *model.Video, stats *PipelineNotificationStats) error {
	if !n.IsEnabled() {
		log.Printf("[Telegram] Notification skipped: neither webhook URL nor bot token configured")
		return nil
	}

	title := video.Title
	if strings.TrimSpace(title) == "" {
		title = "Chưa đặt tên"
	}

	mode := "Full Video (Toàn bộ)"
	if video.ProcessingMode != nil && *video.ProcessingMode == "chunk" {
		mode = "Chunking (Phân đoạn song song)"
	}

	durationStr := "N/A"
	if video.DurationSec != nil && *video.DurationSec > 0 {
		min := *video.DurationSec / 60
		sec := *video.DurationSec % 60
		durationStr = fmt.Sprintf("%d phút %02d giây", min, sec)
	}

	appURL := ""
	if n.appBaseURL != "" {
		appURL = fmt.Sprintf("%s/videos/%s", n.appBaseURL, video.ID)
	}

	var sb strings.Builder
	sb.WriteString("🎬 <b>Phân tích Video hoàn tất!</b>\n\n")
	sb.WriteString(fmt.Sprintf("📹 <b>Video:</b> %s\n", html.EscapeString(title)))
	sb.WriteString(fmt.Sprintf("🆔 <code>%s</code>\n", video.ID.String()))
	sb.WriteString(fmt.Sprintf("⏱ <b>Thời lượng video:</b> %s\n", durationStr))
	sb.WriteString(fmt.Sprintf("⚙️ <b>Chế độ:</b> %s\n", mode))

	if stats != nil {
		if stats.Duration > 0 {
			sb.WriteString(fmt.Sprintf("⏳ <b>Thời gian xử lý:</b> %s\n", stats.Duration.Round(time.Second)))
		}
		sb.WriteString(fmt.Sprintf("🔍 <b>Events trích xuất:</b> %d sự kiện\n", stats.TotalEvents))
		sb.WriteString(fmt.Sprintf("📋 <b>Checklist mappings:</b> %d mục\n", stats.TotalMapped))
		if stats.HasReport {
			sb.WriteString("📊 <b>Báo cáo quan sát:</b> Đã tạo thành công ✅\n")
		}
		if stats.HasCodebook {
			sb.WriteString("📖 <b>Qualitative Codebook:</b> Đã tổng hợp ✅\n")
		}
	}

	if appURL != "" {
		sb.WriteString(fmt.Sprintf("\n🔗 <a href=\"%s\">Xem chi tiết kết quả phân tích</a>\n", appURL))
	}

	msg := sb.String()
	return n.sendMessage(ctx, msg, "pipeline_completed", video, appURL)
}

// NotifyPipelineFailed sends an alert notification when the pipeline encounters an error.
func (n *DefaultTelegramNotifier) NotifyPipelineFailed(ctx context.Context, video *model.Video, failedStep string, errMsg string) error {
	if !n.IsEnabled() {
		return nil
	}

	title := video.Title
	if strings.TrimSpace(title) == "" {
		title = "Chưa đặt tên"
	}

	appURL := ""
	if n.appBaseURL != "" {
		appURL = fmt.Sprintf("%s/videos/%s", n.appBaseURL, video.ID)
	}

	var sb strings.Builder
	sb.WriteString("⚠️ <b>Cảnh báo: Pipeline phân tích video thất bại!</b>\n\n")
	sb.WriteString(fmt.Sprintf("📹 <b>Video:</b> %s\n", html.EscapeString(title)))
	sb.WriteString(fmt.Sprintf("🆔 <code>%s</code>\n", video.ID.String()))
	if failedStep != "" {
		sb.WriteString(fmt.Sprintf("🛑 <b>Bước lỗi:</b> <code>%s</code>\n", html.EscapeString(failedStep)))
	}
	if errMsg != "" {
		displayErr := errMsg
		if len(displayErr) > 1200 {
			displayErr = displayErr[:1200] + "... (còn tiếp)"
		}
		sb.WriteString(fmt.Sprintf("❌ <b>Lỗi chi tiết:</b>\n<code>%s</code>\n", html.EscapeString(displayErr)))
	}
	if appURL != "" {
		sb.WriteString(fmt.Sprintf("\n🔗 <a href=\"%s\">Xem video trong hệ thống</a>\n", appURL))
	}

	msg := sb.String()
	return n.sendMessage(ctx, msg, "pipeline_failed", video, appURL)
}

// sendMessage dispatches the message via direct Bot API or Webhook URL.
func (n *DefaultTelegramNotifier) sendMessage(ctx context.Context, htmlMsg, event string, video *model.Video, appURL string) error {
	// Case 1: Webhook URL is specified
	if n.webhookURL != "" {
		return n.sendViaWebhook(ctx, htmlMsg, event, video, appURL)
	}

	// Case 2: Bot token is available
	if n.botToken != "" {
		// Attempt broadcast to active subscribers in database
		if n.subscriberRepo != nil {
			subs, err := n.subscriberRepo.ListActiveSubscribers(ctx)
			if err == nil && len(subs) > 0 {
				log.Printf("[Telegram] Broadcasting %s to %d registered subscribers...", event, len(subs))
				for _, sub := range subs {
					sendErr := n.sendViaBotAPI(ctx, n.botToken, fmt.Sprintf("%d", sub.ChatID), htmlMsg)
					if sendErr != nil {
						log.Printf("[Telegram] Warning: failed to send to subscriber %d (%s): %v", sub.ChatID, sub.FirstName, sendErr)
						// Auto-deactivate if user blocked bot or chat not found (403)
						if strings.Contains(sendErr.Error(), "403") || strings.Contains(sendErr.Error(), "blocked") {
							_ = n.subscriberRepo.DeactivateSubscriber(ctx, sub.ChatID)
							log.Printf("[Telegram] Deactivated blocked subscriber %d", sub.ChatID)
						}
					}
				}
				return nil
			}
		}

		// Fallback to static chat ID from .env if no database subscribers exist
		if n.chatID != "" {
			return n.sendViaBotAPI(ctx, n.botToken, n.chatID, htmlMsg)
		}
	}

	return nil
}

// sendViaWebhook delivers the message to the configured webhook URL.
func (n *DefaultTelegramNotifier) sendViaWebhook(ctx context.Context, htmlMsg, event string, video *model.Video, appURL string) error {
	u, err := url.Parse(n.webhookURL)
	if err != nil {
		return fmt.Errorf("invalid webhook URL: %w", err)
	}

	// Check if this is a direct Telegram sendMessage URL (e.g., https://api.telegram.org/bot<TOKEN>/sendMessage?chat_id=...)
	if strings.Contains(u.Host, "api.telegram.org") {
		chatID := u.Query().Get("chat_id")
		if chatID == "" {
			chatID = n.chatID
		}

		// Remove chat_id from query params to put it clean in the POST body if needed
		targetURL := n.webhookURL
		if chatID != "" {
			q := u.Query()
			q.Del("chat_id")
			u.RawQuery = q.Encode()
			targetURL = u.String()
		}

		body := telegramSendMessageRequest{
			ChatID:                chatID,
			Text:                  htmlMsg,
			ParseMode:             "HTML",
			DisableWebPagePreview: false,
		}
		jsonBytes, err := json.Marshal(body)
		if err != nil {
			return err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, bytes.NewReader(jsonBytes))
		if err != nil {
			return err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := n.httpClient.Do(req)
		if err != nil {
			return fmt.Errorf("failed to send telegram webhook: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			respBytes, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("telegram API returned status %d: %s", resp.StatusCode, string(respBytes))
		}
		log.Printf("[Telegram] Notification sent successfully via direct Telegram URL")
		return nil
	}

	// Generic webhook payload (Zapier, n8n, Slack relay, custom server, etc.)
	payload := genericWebhookPayload{
		Event:      event,
		Status:     event,
		VideoID:    video.ID.String(),
		VideoTitle: video.Title,
		Message:    htmlMsg,
		Text:       htmlMsg,
		AppURL:     appURL,
		Timestamp:  time.Now(),
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, n.webhookURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send webhook notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("webhook endpoint returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	log.Printf("[Telegram] Notification sent successfully via generic webhook (%s)", n.webhookURL)
	return nil
}

// sendViaBotAPI delivers message directly to Telegram Bot API.
func (n *DefaultTelegramNotifier) sendViaBotAPI(ctx context.Context, token, chatID, htmlMsg string) error {
	apiURL := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", token)
	body := telegramSendMessageRequest{
		ChatID:                chatID,
		Text:                  htmlMsg,
		ParseMode:             "HTML",
		DisableWebPagePreview: false,
	}

	jsonBytes, err := json.Marshal(body)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, apiURL, bytes.NewReader(jsonBytes))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := n.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to call telegram Bot API: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBytes, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("telegram Bot API returned status %d: %s", resp.StatusCode, string(respBytes))
	}

	log.Printf("[Telegram] Notification sent successfully to chat %s", chatID)
	return nil
}
