package service

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTelegramBotService_HandleCommands(t *testing.T) {
	var sentTexts []string

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.Contains(r.URL.Path, "sendMessage") {
			bodyBytes, _ := io.ReadAll(r.Body)
			var payload map[string]interface{}
			_ = json.Unmarshal(bodyBytes, &payload)
			if txt, ok := payload["text"].(string); ok {
				sentTexts = append(sentTexts, txt)
			}
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"ok": true}`))
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"ok": true, "result": []}`))
	}))
	defer server.Close()

	botSvc := NewTelegramBotService("test_token", nil, "http://localhost:3000")
	botSvc.SetAPIBaseURL(server.URL)
	botSvc.httpClient = server.Client()

	// 1. Test /help command
	msgHelp := &telegramMessage{
		Chat: telegramChat{ID: 12345, Type: "private"},
		From: &telegramUser{ID: 12345, FirstName: "Alice", Username: "alice"},
		Text: "/help",
	}
	botSvc.handleMessage(context.Background(), msgHelp)

	if len(sentTexts) == 0 || !strings.Contains(sentTexts[0], "Trợ lý Thông báo") {
		t.Errorf("expected /help reply, got %v", sentTexts)
	}

	// 2. Test /subscribe command
	sentTexts = nil
	msgSub := &telegramMessage{
		Chat: telegramChat{ID: 12345, Type: "private"},
		From: &telegramUser{ID: 12345, FirstName: "Alice", Username: "alice"},
		Text: "/subscribe",
	}
	botSvc.handleMessage(context.Background(), msgSub)

	if len(sentTexts) == 0 || !strings.Contains(sentTexts[0], "Đăng ký thành công") {
		t.Errorf("expected /subscribe reply, got %v", sentTexts)
	}

	// 3. Test /unsubscribe command
	sentTexts = nil
	msgUnsub := &telegramMessage{
		Chat: telegramChat{ID: 12345, Type: "private"},
		From: &telegramUser{ID: 12345, FirstName: "Alice", Username: "alice"},
		Text: "/unsubscribe",
	}
	botSvc.handleMessage(context.Background(), msgUnsub)

	if len(sentTexts) == 0 || !strings.Contains(sentTexts[0], "Đã hủy nhận thông báo") {
		t.Errorf("expected /unsubscribe reply, got %v", sentTexts)
	}

	// 4. Test /status command
	sentTexts = nil
	msgStatus := &telegramMessage{
		Chat: telegramChat{ID: 12345, Type: "private"},
		From: &telegramUser{ID: 12345, FirstName: "Alice", Username: "alice"},
		Text: "/status",
	}
	botSvc.handleMessage(context.Background(), msgStatus)

	if len(sentTexts) == 0 || !strings.Contains(sentTexts[0], "Trạng thái thông báo") {
		t.Errorf("expected /status reply, got %v", sentTexts)
	}
}
