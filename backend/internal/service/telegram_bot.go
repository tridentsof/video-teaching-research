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
	"strings"
	"time"

	"github.com/video-teaching-research/backend/internal/model"
	"github.com/video-teaching-research/backend/internal/repository"
)

// TelegramBotService runs a background worker using Telegram Long Polling to handle chat commands.
type TelegramBotService struct {
	botToken       string
	apiBaseURL     string
	subscriberRepo *repository.TelegramSubscriberRepository
	appBaseURL     string
	httpClient     *http.Client
}

// NewTelegramBotService creates a new TelegramBotService.
func NewTelegramBotService(
	botToken string,
	subscriberRepo *repository.TelegramSubscriberRepository,
	appBaseURL string,
) *TelegramBotService {
	return &TelegramBotService{
		botToken:       strings.TrimSpace(botToken),
		apiBaseURL:     "https://api.telegram.org",
		subscriberRepo: subscriberRepo,
		appBaseURL:     strings.TrimRight(strings.TrimSpace(appBaseURL), "/"),
		httpClient: &http.Client{
			Timeout: 35 * time.Second, // Long-polling timeout is 20-30s
		},
	}
}

// SetAPIBaseURL overrides the Telegram API base URL (useful in tests).
func (s *TelegramBotService) SetAPIBaseURL(baseURL string) {
	s.apiBaseURL = strings.TrimRight(baseURL, "/")
}

// Telegram Update Models
type telegramUpdate struct {
	UpdateID int64            `json:"update_id"`
	Message  *telegramMessage `json:"message,omitempty"`
}

type telegramMessage struct {
	MessageID int64         `json:"message_id"`
	From      *telegramUser `json:"from,omitempty"`
	Chat      telegramChat  `json:"chat"`
	Text      string        `json:"text"`
	Date      int64         `json:"date"`
}

type telegramUser struct {
	ID        int64  `json:"id"`
	IsBot     bool   `json:"is_bot"`
	FirstName string `json:"first_name"`
	Username  string `json:"username,omitempty"`
}

type telegramChat struct {
	ID        int64  `json:"id"`
	Type      string `json:"type"` // 'private', 'group', 'supergroup', 'channel'
	Title     string `json:"title,omitempty"`
	FirstName string `json:"first_name,omitempty"`
	Username  string `json:"username,omitempty"`
}

type telegramUpdatesResponse struct {
	OK     bool             `json:"ok"`
	Result []telegramUpdate `json:"result"`
}

// Start begins the long polling loop in a blocking manner (call in a goroutine).
func (s *TelegramBotService) Start(ctx context.Context) {
	if s.botToken == "" {
		log.Printf("[TelegramBot] Polling disabled: no bot token provided")
		return
	}

	log.Printf("[TelegramBot] Polling worker started — listening for commands (/subscribe, /unsubscribe, /status, /help)...")

	var lastUpdateID int64 = 0

	for {
		select {
		case <-ctx.Done():
			log.Printf("[TelegramBot] Polling worker stopping...")
			return
		default:
		}

		updates, err := s.fetchUpdates(ctx, lastUpdateID+1)
		if err != nil {
			if ctx.Err() != nil {
				return
			}
			log.Printf("[TelegramBot] Error fetching updates: %v (retrying in 5s)", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(5 * time.Second):
				continue
			}
		}

		for _, update := range updates {
			if update.UpdateID > lastUpdateID {
				lastUpdateID = update.UpdateID
			}

			if update.Message != nil && update.Message.Text != "" {
				s.handleMessage(ctx, update.Message)
			}
		}
	}
}

// fetchUpdates calls getUpdates with long polling timeout.
func (s *TelegramBotService) fetchUpdates(ctx context.Context, offset int64) ([]telegramUpdate, error) {
	apiURL := fmt.Sprintf("%s/bot%s/getUpdates?offset=%d&timeout=20", s.apiBaseURL, s.botToken, offset)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, apiURL, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("status %d: %s", resp.StatusCode, string(bodyBytes))
	}

	var res telegramUpdatesResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, err
	}

	if !res.OK {
		return nil, fmt.Errorf("telegram API returned ok: false")
	}

	return res.Result, nil
}

// handleMessage routes incoming chat commands.
func (s *TelegramBotService) handleMessage(ctx context.Context, msg *telegramMessage) {
	text := strings.TrimSpace(msg.Text)
	cmd := strings.ToLower(strings.Fields(text)[0])
	// Strip bot mention if in group (e.g. /subscribe@tesol_video_teaching_bot)
	if atIndex := strings.Index(cmd, "@"); atIndex != -1 {
		cmd = cmd[:atIndex]
	}

	chatID := msg.Chat.ID
	chatType := msg.Chat.Type
	username := ""
	firstName := ""

	if msg.From != nil {
		username = msg.From.Username
		firstName = msg.From.FirstName
	}
	if firstName == "" && msg.Chat.FirstName != "" {
		firstName = msg.Chat.FirstName
	}
	if firstName == "" && msg.Chat.Title != "" {
		firstName = msg.Chat.Title
	}

	switch cmd {
	case "/start", "/subscribe", "/dangky":
		s.handleSubscribe(ctx, chatID, chatType, username, firstName)
	case "/unsubscribe", "/stop", "/huydangky":
		s.handleUnsubscribe(ctx, chatID, firstName)
	case "/status", "/trangthai":
		s.handleStatus(ctx, chatID)
	case "/help", "/trogiup":
		s.handleHelp(ctx, chatID)
	default:
		// Only reply if in private chat to avoid spamming groups
		if chatType == "private" {
			s.handleHelp(ctx, chatID)
		}
	}
}

// handleSubscribe registers user in DB and sends a welcome message.
func (s *TelegramBotService) handleSubscribe(ctx context.Context, chatID int64, chatType, username, firstName string) {
	if s.subscriberRepo != nil {
		sub := &model.TelegramSubscriber{
			ChatID:    chatID,
			ChatType:  chatType,
			Username:  username,
			FirstName: firstName,
			IsActive:  true,
		}
		if err := s.subscriberRepo.UpsertSubscriber(ctx, sub); err != nil {
			log.Printf("[TelegramBot] Error registering subscriber %d: %v", chatID, err)
			_ = s.sendReply(ctx, chatID, "❌ <i>Có lỗi xảy ra khi lưu đăng ký vào hệ thống. Vui lòng thử lại sau!</i>")
			return
		}
	}

	displayName := firstName
	if displayName == "" {
		displayName = "bạn"
	}

	reply := fmt.Sprintf(`🎉 <b>Đăng ký thành công!</b>

Xin chào <b>%s</b>! Tài khoản của bạn đã được lưu vào hệ thống thông báo Video Teaching Research.

✅ Bạn sẽ tự động nhận kết quả ngay khi có video hoàn thành phân tích hoặc gặp lỗi.

📌 <b>Các lệnh hỗ trợ:</b>
• <code>/status</code> - Kiểm tra trạng thái đăng ký
• <code>/unsubscribe</code> - Hủy nhận thông báo
• <code>/help</code> - Xem lại hướng dẫn`, html.EscapeString(displayName))

	_ = s.sendReply(ctx, chatID, reply)
	log.Printf("[TelegramBot] User %s (%d) successfully subscribed", firstName, chatID)
}

// handleUnsubscribe deactivates the subscriber.
func (s *TelegramBotService) handleUnsubscribe(ctx context.Context, chatID int64, firstName string) {
	if s.subscriberRepo != nil {
		if err := s.subscriberRepo.DeactivateSubscriber(ctx, chatID); err != nil {
			log.Printf("[TelegramBot] Error deactivating subscriber %d: %v", chatID, err)
		}
	}

	reply := `👋 <b>Đã hủy nhận thông báo thành công.</b>

Bạn sẽ không còn nhận tin nhắn khi có video phân tích xong nữa.
Khi nào muốn tiếp tục theo dõi, bạn chỉ cần gõ <code>/subscribe</code> bất kỳ lúc nào!`

	_ = s.sendReply(ctx, chatID, reply)
	log.Printf("[TelegramBot] User (%d) unsubscribed", chatID)
}

// handleStatus displays subscription details.
func (s *TelegramBotService) handleStatus(ctx context.Context, chatID int64) {
	statusStr := "Chưa đăng ký (Đang tắt)"
	totalActive := 0

	if s.subscriberRepo != nil {
		sub, _ := s.subscriberRepo.GetByChatID(ctx, chatID)
		if sub != nil && sub.IsActive {
			statusStr = "Đang nhận thông báo (Active) ✅"
		}
		totalActive, _ = s.subscriberRepo.CountActive(ctx)
	}

	reply := fmt.Sprintf(`📊 <b>Trạng thái thông báo:</b>

• <b>Tài khoản của bạn:</b> %s
• <b>Tổng người/nhóm đang theo dõi:</b> %d
• <b>Hệ thống backend:</b> Đang kết nối bình thường ✅

<i>Gõ /subscribe để kích hoạt hoặc /unsubscribe để tạm dừng.</i>`, statusStr, totalActive)

	_ = s.sendReply(ctx, chatID, reply)
}

// handleHelp sends available commands guide.
func (s *TelegramBotService) handleHelp(ctx context.Context, chatID int64) {
	reply := `🤖 <b>Trợ lý Thông báo Video Teaching Research</b>

Bot này sẽ tự động gửi kết quả phân tích video (Events trích xuất, Checklist mapping, Báo cáo & Codebook) đến bạn ngay khi hoàn tất.

📌 <b>Danh sách lệnh:</b>
• <code>/subscribe</code> - Đăng ký nhận thông báo phân tích video
• <code>/unsubscribe</code> - Hủy nhận thông báo
• <code>/status</code> - Kiểm tra trạng thái tài khoản của bạn
• <code>/help</code> - Hiển thị menu trợ giúp này`

	_ = s.sendReply(ctx, chatID, reply)
}

// sendReply sends an HTML message to a chat ID.
func (s *TelegramBotService) sendReply(ctx context.Context, chatID int64, htmlMsg string) error {
	apiURL := fmt.Sprintf("%s/bot%s/sendMessage", s.apiBaseURL, s.botToken)
	body := map[string]interface{}{
		"chat_id":                  chatID,
		"text":                     htmlMsg,
		"parse_mode":                "HTML",
		"disable_web_page_preview": true,
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

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}
