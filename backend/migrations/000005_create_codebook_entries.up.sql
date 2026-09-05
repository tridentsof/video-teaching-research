-- ============================================================
-- Code Book Entries
-- Each video can have many codebook entries (observation codes).
-- ============================================================
CREATE TABLE codebook_entries (
    id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id     UUID        NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    code         VARCHAR(200) NOT NULL,
    definition   TEXT        NOT NULL DEFAULT '',
    inclusion_criteria TEXT  NOT NULL DEFAULT '',
    exclusion_criteria TEXT  NOT NULL DEFAULT '',
    example      TEXT        NOT NULL DEFAULT '',
    category     VARCHAR(200) NOT NULL DEFAULT '',
    theme        VARCHAR(200) NOT NULL DEFAULT '',
    sort_order   INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_codebook_entries_video_id ON codebook_entries(video_id);
