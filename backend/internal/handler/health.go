package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// HealthResponse is the response body for the health check endpoint.
type HealthResponse struct {
	Status  string `json:"status"`
	Service string `json:"service"`
}

// HealthCheck returns a simple health status to confirm the server is running.
// GET /healthz
func HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status:  "ok",
		Service: "video-teaching-research-api",
	})
}
