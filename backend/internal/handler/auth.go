package handler

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/video-teaching-research/backend/internal/service"
)

// AuthHandler handles authentication HTTP endpoints.
type AuthHandler struct {
	authService *service.AuthService
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(authService *service.AuthService) *AuthHandler {
	return &AuthHandler{authService: authService}
}

// Register handles user registration.
// POST /api/auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req service.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	resp, err := h.authService.Register(c.Request.Context(), req)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			RespondError(c, http.StatusConflict, err.Error())
			return
		}
		RespondError(c, http.StatusInternalServerError, "registration failed")
		return
	}

	RespondCreated(c, resp)
}

// Login handles user login.
// POST /api/auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req service.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		RespondError(c, http.StatusBadRequest, "invalid request: "+err.Error())
		return
	}

	resp, err := h.authService.Login(c.Request.Context(), req)
	if err != nil {
		if strings.Contains(err.Error(), "invalid username or password") {
			RespondError(c, http.StatusUnauthorized, "invalid username or password")
			return
		}
		RespondError(c, http.StatusInternalServerError, "login failed")
		return
	}

	RespondSuccess(c, resp)
}

// Me returns the authenticated user's information.
// GET /api/auth/me
func (h *AuthHandler) Me(c *gin.Context) {
	username, exists := c.Get("username")
	if !exists {
		RespondError(c, http.StatusUnauthorized, "not authenticated")
		return
	}

	userID, _ := c.Get("user_id")

	RespondSuccess(c, gin.H{
		"user_id":  userID,
		"username": username,
	})
}
