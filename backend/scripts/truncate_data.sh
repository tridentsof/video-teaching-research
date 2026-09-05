#!/usr/bin/env bash
# ============================================================
# Script to Truncate Data in Video Teaching Research
# Usage:
#   ./scripts/truncate_data.sh           (Clears operational data, keeps users & checklists)
#   ./scripts/truncate_data.sh --all     (Full wipe including users, re-seeds checklists)
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$BACKEND_DIR")"
MODE="operational"

if [ "$1" == "--all" ]; then
    MODE="all"
fi

# Load DB_URL from backend/.env or .env if not set
if [ -z "$DB_URL" ]; then
    if [ -f "$BACKEND_DIR/.env" ]; then
        DB_URL=$(grep '^DB_URL=' "$BACKEND_DIR/.env" | cut -d '=' -f2-)
    elif [ -f "$ROOT_DIR/.env" ]; then
        DB_URL=$(grep '^DB_URL=' "$ROOT_DIR/.env" | cut -d '=' -f2-)
    fi
fi

if [ -z "$DB_URL" ]; then
    DB_URL="postgresql://postgres:postgres@localhost:5432/postgres?sslmode=disable"
fi

SQL_FILE="$SCRIPT_DIR/truncate_operational_data.sql"
if [ "$MODE" == "all" ]; then
    SQL_FILE="$SCRIPT_DIR/truncate_all_data.sql"
fi

# Mask password for display
DISPLAY_URL=$(echo "$DB_URL" | sed -E 's/:([^:@]+)@/:****@/')

echo "============================================================"
echo " Video Teaching Research - Data Truncation Tool"
echo " Mode: $MODE"
echo " Target DB: $DISPLAY_URL"
echo "============================================================"

# Execute SQL via docker postgres image or local psql
if command -v psql &> /dev/null; then
    echo ">> Executing via local psql..."
    psql "$DB_URL" -f "$SQL_FILE"
elif command -v docker &> /dev/null; then
    echo ">> Executing via Docker postgres image..."
    docker run --rm -i postgres:16-alpine psql "$DB_URL" < "$SQL_FILE"
else
    echo "Error: Neither psql nor docker is available."
    exit 1
fi

# Clean local storage
echo ">> Cleaning local storage directory ($BACKEND_DIR/storage)..."
if [ -d "$BACKEND_DIR/storage" ]; then
    find "$BACKEND_DIR/storage" -mindepth 1 -not -name '.gitkeep' -delete 2>/dev/null || true
fi

echo ">> Data truncation completed successfully!"
