BEGIN;

-- Bổ sung cột note cho bảng enrollment_events
ALTER TABLE enrollment_events
ADD COLUMN note VARCHAR(200);

-- Ghi nhận phiên bản migration đã áp dụng
INSERT INTO schema_migrations (version, description)
VALUES ('002', 'Add note column to enrollment_events');

COMMIT;

