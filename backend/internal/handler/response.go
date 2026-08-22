package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ErrorResponse is the standard error response format used across all endpoints.
type ErrorResponse struct {
	Error   string `json:"error"`
	Details string `json:"details,omitempty"`
}

// RespondError sends a standardized error JSON response.
func RespondError(c *gin.Context, status int, message string) {
	c.JSON(status, ErrorResponse{Error: message})
}

// RespondErrorWithDetails sends a standardized error JSON response with additional details.
func RespondErrorWithDetails(c *gin.Context, status int, message, details string) {
	c.JSON(status, ErrorResponse{Error: message, Details: details})
}

// RespondSuccess sends a JSON response with the given data.
func RespondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, data)
}

// RespondCreated sends a 201 JSON response with the given data.
func RespondCreated(c *gin.Context, data interface{}) {
	c.JSON(http.StatusCreated, data)
}
