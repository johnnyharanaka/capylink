CREATE TABLE links (
    id          BIGSERIAL     PRIMARY KEY,
    slug        VARCHAR(16)   NOT NULL UNIQUE,
    target_url  VARCHAR(2048) NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL,
    expires_at  TIMESTAMPTZ   NOT NULL
);

CREATE INDEX idx_links_expires_at ON links (expires_at);
