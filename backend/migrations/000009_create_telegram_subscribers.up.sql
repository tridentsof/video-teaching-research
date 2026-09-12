CREATE TABLE IF NOT EXISTS telegram_subscribers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_id     BIGINT UNIQUE NOT NULL,
    chat_type   VARCHAR(20) NOT NULL DEFAULT 'private',
    username    VARCHAR(100),
    first_name  VARCHAR(150),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_active ON telegram_subscribers(is_active);
CREATE INDEX IF NOT EXISTS idx_telegram_subscribers_chat_id ON telegram_subscribers(chat_id);
