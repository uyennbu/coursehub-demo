-- BƯỚC 1: KIỂM TRA TRƯỚC KHI CHẠY MIGRATION 002
-- 1.1 Đếm tổng số dòng dữ liệu hiện tại
SELECT count(*) AS total_events_before FROM enrollment_events;

-- 1.2 Xem dữ liệu cũ
SELECT id, student_id, class_section_id, event_type, occurred_at
FROM enrollment_events
ORDER BY id DESC
LIMIT 5;

-- 1.3 Xem các migration đã áp dụng
SELECT version, description, applied_at FROM schema_migrations ORDER BY version;


-- BƯỚC 2: CHẠY MIGRATION 002
-- (Thực hiện chạy file database/migrations/002_add_note_to_enrollment_events.sql)


-- BƯỚC 3: KIỂM TRA SAU KHI CHẠY MIGRATION 002
-- 3.1 Đếm lại tổng số dòng -> Phải bằng chính xác số dòng ban đầu (không mất dòng nào)
SELECT count(*) AS total_events_after FROM enrollment_events;

-- 3.2 Kiểm tra cột note mới xuất hiện với giá trị NULL cho dữ liệu cũ
SELECT id, student_id, class_section_id, event_type, note, occurred_at
FROM enrollment_events
ORDER BY id DESC
LIMIT 5;

-- 3.3 Thử cập nhật hoặc chèn một dòng có note
UPDATE enrollment_events
SET note = 'Ghi chu dang ky thanh cong cho buoi demo'
WHERE id = (SELECT max(id) FROM enrollment_events);

-- 3.4 Kiểm tra lại dòng vừa cập nhật note
SELECT id, student_id, class_section_id, note
FROM enrollment_events
WHERE note IS NOT NULL;

-- 3.5 Kiểm tra bảng quản lý migration
SELECT version, description, applied_at FROM schema_migrations ORDER BY version;


-- BƯỚC 4: THỬ NGHIỆM ROLLBACK VÀ ĐÁNH GIÁ MẤT DỮ LIỆU
-- (Thực hiện chạy file database/migrations/002_add_note_to_enrollment_events_rollback.sql)

-- 4.1 Kiểm tra cột note đã biến mất
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'enrollment_events';

-- 4.2 Tổng số dòng vẫn giữ nguyên
SELECT count(*) AS total_events_after_rollback FROM enrollment_events;

-- 4.3 Version '002' đã bị xóa khỏi schema_migrations
SELECT version, description, applied_at FROM schema_migrations ORDER BY version;

