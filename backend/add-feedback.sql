CREATE TABLE IF NOT EXISTS feedback (
    feedback_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES benutzer(user_id),
    screen       VARCHAR(200),
    notiz        TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
GRANT ALL PRIVILEGES ON TABLE feedback TO crm_user;
