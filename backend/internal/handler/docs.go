package handler

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed openapi.yaml
var openAPISpec []byte

const scalarHTML = `<!doctype html>
<html lang="en">
  <head>
    <title>Video Teaching Research API — Scalar Playground</title>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236366f1' stroke-width='2'><polygon points='5 3 19 12 5 21 5 3'></polygon></svg>">
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #0d1117;
      }
    </style>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="/openapi.yaml"
      data-configuration='{
        "theme": "purple",
        "darkMode": true,
        "showSidebar": true,
        "searchHotKey": "k",
        "layout": "modern"
      }'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`

// DocsHandler serves OpenAPI specification and Scalar UI playground.
type DocsHandler struct{}

// NewDocsHandler creates a new DocsHandler.
func NewDocsHandler() *DocsHandler {
	return &DocsHandler{}
}

// OpenAPISpec returns the raw OpenAPI YAML file.
// GET /openapi.yaml
func (h *DocsHandler) OpenAPISpec(c *gin.Context) {
	c.Header("Content-Type", "application/yaml; charset=utf-8")
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "application/yaml; charset=utf-8", openAPISpec)
}

// ScalarUI renders the interactive Scalar API playground.
// GET /docs or GET /scalar
func (h *DocsHandler) ScalarUI(c *gin.Context) {
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, scalarHTML)
}
