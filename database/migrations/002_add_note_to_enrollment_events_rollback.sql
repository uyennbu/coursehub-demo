BEGIN;

-- Xóa cột note khỏi bảng enrollment_events (LƯU Ý: Mọi dữ liệu đã lưu trong cột note sẽ bị mất vĩnh viễn)
ALTER TABLE enrollment_events
DROP COLUMN IF EXISTS note;

-- Xóa ghi nhận migration 002
DELETE FROM schema_migrations
WHERE version = '002';

COMMIT;

