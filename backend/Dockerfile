# Build Stage
FROM golang:alpine AS builder

WORKDIR /app

# Install git and build essentials if needed
RUN apk add --no-cache git

# Copy dependency definitions
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build statically linked binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /app/server ./cmd/server

# Final Runtime Stage
FROM alpine:3.20

WORKDIR /app

# Install runtime dependencies: FFmpeg, CA certificates for HTTPS AI calls, tzdata
RUN apk add --no-cache ffmpeg ca-certificates tzdata

# Copy built binary from builder
COPY --from=builder /app/server /app/server

# Create local storage directory
RUN mkdir -p /app/storage/videos

# Expose API port
EXPOSE 8000

# Run API server
CMD ["/app/server"]
