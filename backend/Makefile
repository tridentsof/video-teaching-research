.PHONY: run build test migrate-up migrate-down

# Run the development server
run:
	go run cmd/server/main.go

# Build the binary
build:
	go build -o bin/server cmd/server/main.go

# Run all tests
test:
	go test ./... -v

# Run database migrations up
migrate-up:
	@if [ -z "$(DB_URL)" ]; then \
		echo "Error: DB_URL is required. Usage: make migrate-up DB_URL=postgres://..."; \
		exit 1; \
	fi
	migrate -path migrations -database "$(DB_URL)" up

# Roll back database migrations
migrate-down:
	@if [ -z "$(DB_URL)" ]; then \
		echo "Error: DB_URL is required. Usage: make migrate-down DB_URL=postgres://..."; \
		exit 1; \
	fi
	migrate -path migrations -database "$(DB_URL)" down

# Run migrations with .env file
migrate-up-env:
	@export $$(cat .env | grep -v '^#' | xargs) && migrate -path migrations -database "$$DB_URL" up

migrate-down-env:
	@export $$(cat .env | grep -v '^#' | xargs) && migrate -path migrations -database "$$DB_URL" down
